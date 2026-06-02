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
// Current implementation: degraded streaming. The middleware returns the full
// response when the subprocess completes; we fire the on('text') handler once
// with the entire text. UI shows no progressive output but doesn't break.

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
    try {
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
        const errText = await res.text()
        throw new Error(`Claude Code adapter error ${res.status}: ${errText}`)
      }

      const data = await res.json() as MiddlewareResponse
      if (!data.ok) {
        throw new Error(data.error)
      }

      // Degraded streaming: fire one chunk with the full text at the end.
      if (data.text) {
        this._textHandlers.forEach(h => h(data.text))
      }
      this._resolve()
    } catch (e) {
      this._reject(e)
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
