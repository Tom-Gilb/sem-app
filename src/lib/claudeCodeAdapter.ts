// UNIT_TYPE=Lib
// claudeCodeAdapter — drop-in replacement for @anthropic-ai/sdk that routes
// all AI calls through Tom's LOCAL Claude Code installation instead of
// api.anthropic.com. Uses Claude Code's OAuth subscription (no API key needed,
// no per-call billing to a separate ANTHROPIC_API_KEY).
//
// Architecture (per CLAUDE.md "Claude-Code-as-AI-Layer Rule"):
//   • Browser-side composables call this adapter (transparently via Vite alias)
//   • This adapter POSTs to /api/claude-code (a Vite dev-server middleware)
//   • The middleware spawns `claude -p --output-format json` as a subprocess
//   • Claude Code CLI uses Tom's OAuth credentials — no API key in the SEM App
//
// Used via Vite resolve.alias so every `import ... from '@anthropic-ai/sdk'`
// in the codebase is transparently redirected here. Zero composable changes
// required.
//
// Config (via .env.local):
//   VITE_AI_PROVIDER=claude-code   — flips the Vite alias
//   VITE_CLAUDE_CODE_URL           — override middleware URL (default /api/claude-code)
//
// Limitations (current implementation):
//   • Streaming falls back to "single chunk at end" — the on('text') handler
//     fires once with the complete response when the subprocess completes.
//     UI will show no progressive text but will not break. Future enhancement:
//     proxy `--output-format stream-json` through SSE.
//   • Cancellation: AbortSignal forwards to fetch; middleware kills the
//     subprocess when the connection drops.
//   • Multi-turn messages are concatenated with role markers into a single
//     prompt string. Most SEM App composables are single-turn so this is fine.
//
// Per-call latency: ~1-2s subprocess cold-start + actual generation time.
// Acceptable since most composables already take 5-30s.

// ── Types (structural equivalents of the Anthropic SDK types used in the app) ──

export interface TextBlock {
  type: 'text'
  text: string
}

export interface TextBlockParam {
  type: 'text'
  text: string
  cache_control?: { type: string }
}

/** Alias — useSDK + useEvoPlannerAPI import this name from the deep SDK path */
export type BetaTextBlockParam = TextBlockParam

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>
}

// Internal param shape passed to messages.create / stream
interface AnthropicParams {
  model: string
  max_tokens?: number
  system?: string | TextBlockParam[]
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; [key: string]: unknown }> }>
  betas?: string[]       // ignored — prompt caching is automatic in Claude Code
  signal?: AbortSignal   // optional cancellation signal
  [key: string]: unknown
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function adapterUrl(): string {
  return (import.meta.env.VITE_CLAUDE_CODE_URL as string | undefined) ?? '/api/claude-code'
}

/**
 * Map Anthropic model names to Claude Code CLI aliases.
 * The CLI accepts both full names ('claude-sonnet-4-6') and short aliases
 * ('sonnet' / 'opus' / 'haiku'). We pass full names through unchanged so the
 * model selection in src/config/llm.ts is preserved verbatim.
 */
function cliModel(requestedModel: string): string {
  return requestedModel
}

/** Flatten system field (string | TextBlockParam[]) to a plain string */
function extractSystemText(system: string | TextBlockParam[] | undefined): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  return system.map(b => b.text ?? '').join('\n')
}

/** Flatten a single message's content (string | content blocks) to plain text */
function extractMessageText(content: string | Array<{ type: string; text?: string; [key: string]: unknown }>): string {
  if (typeof content === 'string') return content
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text)
    } else if (block.type === 'document') {
      parts.push('[Note: a document attachment was included but cannot be processed in local Claude Code mode.]')
    }
  }
  return parts.join('\n\n')
}

/**
 * Concatenate Anthropic-style messages array into a single prompt string.
 * Multi-turn becomes: "[User]: ...\n\n[Assistant]: ...\n\n[User]: ..."
 * Single-turn (the common case) just returns the bare user text.
 */
function messagesToPrompt(messages: AnthropicParams['messages']): string {
  if (messages.length === 1 && messages[0].role === 'user') {
    return extractMessageText(messages[0].content)
  }
  return messages.map(m => {
    const role = m.role === 'user' ? '[User]' : '[Assistant]'
    return `${role}: ${extractMessageText(m.content)}`
  }).join('\n\n')
}

// ── Middleware response shape ──────────────────────────────────────────────────

interface MiddlewareSuccess {
  ok: true
  text: string
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number }
  stop_reason: string
}

interface MiddlewareError {
  ok: false
  error: string
  exit_code?: number
  stderr?: string
}

type MiddlewareResponse = MiddlewareSuccess | MiddlewareError

// ── Streaming wrapper ──────────────────────────────────────────────────────────
//
// Real streaming via Server-Sent Events. The middleware spawns `claude -p
// --output-format stream-json --include-partial-messages` and forwards each
// stdout JSON line as an SSE event. We parse each event and call the registered
// 'text' handlers for each content_block_delta. UI consumers (useSDK,
// useSpecCollaborator, useEvoPlannerAPI) see progressive text in real time.

/**
 * One Claude-CLI streaming event. The CLI emits a sequence of envelope events
 * each carrying a `type` field at the top level:
 *   { type: 'system', subtype: 'init', ... }            — startup
 *   { type: 'system', subtype: 'status', ... }          — status updates
 *   { type: 'rate_limit_event', ... }                   — rate-limit hint
 *   { type: 'stream_event', event: { ... }, ttft_ms? }  — Anthropic SDK events
 *   { type: 'assistant', message: { ... } }             — full assistant msg
 *   { type: 'result', subtype: 'success', result, ... } — terminal summary
 *
 * The actual model text deltas appear inside stream_event envelopes:
 *   { type: 'stream_event', event: { type: 'content_block_delta',
 *     index: 0, delta: { type: 'text_delta', text: '...' } } }
 * Everything else is metadata that the on('text') handler doesn't need.
 */
interface ClaudeCliEvent {
  type?: string
  event?: { type?: string; delta?: { type?: string; text?: string } }
  // Final result event (only at end of stream-json with --include-partial-messages)
  result?: string
  stop_reason?: string
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }
  is_error?: boolean
}

class ClaudeCodeStream {
  private readonly _textHandlers: Array<(t: string) => void> = []
  private _resolve!: () => void
  private _reject!: (e: unknown) => void
  private readonly _done: Promise<void>

  constructor(params: AnthropicParams) {
    this._done = new Promise((res, rej) => { this._resolve = res; this._reject = rej })
    void this._run(params)
  }

  /** Register a text-delta handler — mirrors sdk.stream.on('text', handler) */
  on(event: 'text', handler: (t: string) => void): this {
    if (event === 'text') this._textHandlers.push(handler)
    return this
  }

  /** Resolves when the full response has been streamed */
  async finalMessage(): Promise<void> {
    return this._done
  }

  private async _run(params: AnthropicParams): Promise<void> {
    // Hold a reference to the body-stream reader so the abort handler
    // below can hard-cancel it. WebKit does not always promptly throw
    // from an in-flight `reader.read()` when only the fetch signal aborts —
    // explicitly calling reader.cancel() makes the next .read() resolve
    // with `{done: true}` immediately so the loop exits and the
    // middleware's res.on('close') fires (which SIGTERMs the subprocess).
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

    // Early-out if the signal is already aborted (e.g. cancelFetch fired
    // before this Stream's _run() even started).
    if (params.signal?.aborted) {
      this._reject(new DOMException('Aborted before start', 'AbortError'))
      return
    }

    // Attach an abort listener that forcibly cancels the reader and the
    // wider _done promise the moment cancelFetch fires. Cleanup runs in
    // the finally block so a successful completion does not leak it.
    const onAbort = (): void => {
      if (reader !== null) {
        // Fire-and-forget; cancel() rejects in some browsers when the
        // stream has already closed — that is fine.
        reader.cancel(new DOMException('Aborted', 'AbortError')).catch(() => {})
      }
      this._reject(new DOMException('Aborted', 'AbortError'))
    }
    params.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      // Streaming endpoint — ?stream=1 flips the middleware into SSE mode.
      const url = `${adapterUrl()}?stream=1`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        signal: params.signal,
        body: JSON.stringify({
          model:       cliModel(params.model),
          max_tokens:  params.max_tokens,
          system:      extractSystemText(params.system),
          prompt:      messagesToPrompt(params.messages),
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Claude Code stream error ${res.status}: ${await res.text()}`)
      }

      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   gotError: string | null = null

      // Parse SSE event blocks separated by \n\n. Each block may have
      // multiple "data: ..." lines (concatenated) plus an optional "event: ..."
      // header. We treat the final "event: done" + "data: {ok|error}" pair
      // as the stream terminator from the middleware.
      const processBlock = (block: string): void => {
        // Skip comment-only blocks (e.g. ": stream-open").
        const lines = block.split('\n').filter(l => l.length > 0 && !l.startsWith(':'))
        if (lines.length === 0) return

        let event = 'message'
        const dataParts: string[] = []
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7).trim()
          else if (line.startsWith('data: ')) dataParts.push(line.slice(6))
        }
        if (dataParts.length === 0) return
        const dataStr = dataParts.join('\n')

        // Terminator event from the middleware.
        if (event === 'done') {
          try {
            const payload = JSON.parse(dataStr) as { ok: boolean; error?: string }
            if (!payload.ok && payload.error) gotError = payload.error
          } catch { /* ignore malformed terminator */ }
          return
        }

        // Forward claude CLI event payload. We only handle text_delta — the
        // actual model output. The CLI wraps Anthropic SDK events in a
        // {type: 'stream_event', event: {...}} envelope; we unwrap it.
        // Everything else is metadata useful for debugging.
        try {
          const ev = JSON.parse(dataStr) as ClaudeCliEvent
          if (ev.type === 'stream_event'
              && ev.event?.type === 'content_block_delta'
              && ev.event.delta?.type === 'text_delta'
              && ev.event.delta.text) {
            const text = ev.event.delta.text
            this._textHandlers.forEach(h => h(text))
          }
        } catch { /* skip malformed lines from the CLI */ }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // Split on SSE event boundary (blank line between events).
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          processBlock(block)
        }
      }
      // Final flush in case the last block lacked a trailing blank line.
      if (buffer.trim()) processBlock(buffer)

      if (gotError) throw new Error(gotError)
      this._resolve()
    } catch (e) {
      this._reject(e)
    } finally {
      // Always remove the abort listener; calling onAbort after _done has
      // settled is a no-op but the listener would still hold a reference
      // to the closure (memory leak in long-running sessions).
      params.signal?.removeEventListener('abort', onAbort)
    }
  }
}

// ── Messages API ───────────────────────────────────────────────────────────────

class ClaudeCodeMessages {
  /** Non-streaming chat completion — mirrors client.messages.create() */
  async create(params: AnthropicParams): Promise<{
    content: TextBlock[]
    stop_reason: string
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number }
  }> {
    const res = await fetch(adapterUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: params.signal,
      body: JSON.stringify({
        model:       cliModel(params.model),
        max_tokens:  params.max_tokens,
        system:      extractSystemText(params.system),
        prompt:      messagesToPrompt(params.messages),
      }),
    })

    if (!res.ok) {
      throw new Error(`Claude Code adapter error ${res.status}: ${await res.text()}`)
    }

    const data = await res.json() as MiddlewareResponse
    if (!data.ok) {
      throw new Error(data.error)
    }

    return {
      content:     [{ type: 'text', text: data.text }],
      stop_reason: data.stop_reason,
      usage:       data.usage,
    }
  }

  /** Streaming chat — mirrors client.beta.messages.stream() */
  stream(params: AnthropicParams): ClaudeCodeStream {
    return new ClaudeCodeStream(params)
  }
}

// ── Beta namespace (prompt-caching endpoint equivalents) ───────────────────────

class ClaudeCodeBeta {
  readonly messages: ClaudeCodeMessages

  constructor(messages: ClaudeCodeMessages) {
    this.messages = messages
  }
}

// ── Main Anthropic class (drop-in replacement) ─────────────────────────────────

class Anthropic {
  readonly messages: ClaudeCodeMessages
  readonly beta:     ClaudeCodeBeta

  /** Constructor accepts (and ignores) the same options as the real SDK */
  constructor(_opts?: { apiKey?: string; dangerouslyAllowBrowser?: boolean; timeout?: number }) {
    this.messages = new ClaudeCodeMessages()
    this.beta     = new ClaudeCodeBeta(this.messages)
  }
}

// ── Namespace — matches `Anthropic.TextBlock` / `.MessageParam` usage in usePlanInput ──
// TypeScript merges the class + namespace declarations into one export.

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Anthropic {
  export type TextBlock      = import('./claudeCodeAdapter').TextBlock
  export type TextBlockParam = import('./claudeCodeAdapter').TextBlockParam
  export type MessageParam   = import('./claudeCodeAdapter').MessageParam
}

export default Anthropic
export { Anthropic }
