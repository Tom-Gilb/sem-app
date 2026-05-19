// UNIT_TYPE=Lib
// ollamaAdapter — drop-in replacement for @anthropic-ai/sdk that routes all
// AI calls to a local Ollama instance instead of api.anthropic.com.
//
// Used via Vite resolve.alias so every `import ... from '@anthropic-ai/sdk'`
// in the codebase is transparently redirected here at build time — zero
// changes required in individual composables.
//
// Config (via .env.local):
//   VITE_OLLAMA_BASE_URL  default: http://localhost:11434
//   VITE_OLLAMA_MODEL     default: llama3.1:8b

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
  betas?: string[]       // ignored — prompt caching not applicable locally
  signal?: AbortSignal   // optional cancellation signal
  [key: string]: unknown
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ollamaBase(): string {
  return (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined) ?? 'http://localhost:11434'
}

function ollamaModel(requestedModel: string): string {
  // Always use the locally configured model; ignore whatever Anthropic model name
  // the composable passed in (e.g. 'claude-sonnet-4-6')
  return (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? requestedModel
}

/** Flatten system field (string | TextBlockParam[]) to a plain string */
function extractSystemText(system: string | TextBlockParam[] | undefined): string {
  if (!system) return ''
  if (typeof system === 'string') return system
  return system.map(b => b.text ?? '').join('\n')
}

/** Convert Anthropic-style messages array to Ollama-compatible format */
function toOllamaMessages(
  system: string | TextBlockParam[] | undefined,
  messages: AnthropicParams['messages'],
): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = []

  const sysText = extractSystemText(system)
  if (sysText) out.push({ role: 'system', content: sysText })

  for (const m of messages) {
    let text: string
    if (typeof m.content === 'string') {
      text = m.content
    } else {
      // Flatten content blocks; skip non-text types (e.g. 'document' PDF blocks)
      // that Ollama cannot handle. A warning is prepended for document blocks so
      // the model understands something was omitted.
      const parts: string[] = []
      for (const block of m.content) {
        if (block.type === 'text' && block.text) {
          parts.push(block.text)
        } else if (block.type === 'document') {
          parts.push('[Note: a document attachment was included but cannot be processed in local mode.]')
        }
      }
      text = parts.join('\n\n')
    }
    out.push({ role: m.role, content: text })
  }

  return out
}

// ── Streaming wrapper ──────────────────────────────────────────────────────────

class OllamaStream {
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
      const ollamaMessages = toOllamaMessages(params.system, params.messages)

      const res = await fetch(`${ollamaBase()}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:           ollamaModel(params.model),
          messages:        ollamaMessages,
          max_tokens:      params.max_tokens,
          stream:          true,
          response_format: { type: 'json_object' },
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Ollama stream error ${res.status}: ${await res.text()}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!            // last partial line stays in buffer
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
            const delta = chunk.choices?.[0]?.delta?.content ?? ''
            if (delta) this._textHandlers.forEach(h => h(delta))
          } catch { /* skip malformed SSE lines */ }
        }
      }

      this._resolve()
    } catch (e) {
      this._reject(e)
    }
  }
}

// ── Messages API ───────────────────────────────────────────────────────────────

class OllamaMessages {
  /** Non-streaming chat completion — mirrors client.messages.create() */
  async create(params: AnthropicParams): Promise<{
    content: TextBlock[]
    stop_reason: string
    usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number }
  }> {
    const ollamaMessages = toOllamaMessages(params.system, params.messages)

    const res = await fetch(`${ollamaBase()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: params.signal,
      body: JSON.stringify({
        model:           ollamaModel(params.model),
        messages:        ollamaMessages,
        max_tokens:      params.max_tokens,
        stream:          false,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?:   { prompt_tokens?: number; completion_tokens?: number }
    }

    const text        = data.choices?.[0]?.message?.content ?? ''
    const finishReason = data.choices?.[0]?.finish_reason ?? 'stop'

    return {
      content:     [{ type: 'text', text }],
      stop_reason: finishReason === 'stop' ? 'end_turn' : finishReason,
      usage: {
        input_tokens:              data.usage?.prompt_tokens     ?? 0,
        output_tokens:             data.usage?.completion_tokens ?? 0,
        cache_read_input_tokens:   0,   // not applicable locally
      },
    }
  }

  /** Streaming chat — mirrors client.beta.messages.stream() */
  stream(params: AnthropicParams): OllamaStream {
    return new OllamaStream(params)
  }
}

// ── Beta namespace (prompt-caching endpoint equivalents) ───────────────────────

class OllamaBeta {
  readonly messages: OllamaMessages

  constructor(messages: OllamaMessages) {
    this.messages = messages
  }
}

// ── Main Anthropic class (drop-in replacement) ─────────────────────────────────

class Anthropic {
  readonly messages: OllamaMessages
  readonly beta:     OllamaBeta

  /** Constructor accepts (and ignores) the same options as the real SDK */
  constructor(_opts?: { apiKey?: string; dangerouslyAllowBrowser?: boolean; timeout?: number }) {
    this.messages = new OllamaMessages()
    this.beta     = new OllamaBeta(this.messages)
  }
}

// ── Namespace — matches `Anthropic.TextBlock` / `.MessageParam` usage in usePlanInput ──
// TypeScript merges the class + namespace declarations into one export.

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Anthropic {
  export type TextBlock      = import('./ollamaAdapter').TextBlock
  export type TextBlockParam = import('./ollamaAdapter').TextBlockParam
  export type MessageParam   = import('./ollamaAdapter').MessageParam
}

export default Anthropic
export { Anthropic }
