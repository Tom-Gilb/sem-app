// UNIT_TYPE=Lib
// ollamaChat — thin fetch wrapper for composables that call api.anthropic.com
// directly (instead of using the @anthropic-ai/sdk class).
//
// Replaces the 7 raw-fetch blocks that look like:
//   fetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': ... }, body: JSON.stringify({...}) })
//
// Usage:
//   const text = await ollamaChat({ system: '...', messages: [{role:'user', content:'...'}], max_tokens: 1024 })

export interface OllamaChatParams {
  /** Anthropic model name is ignored — VITE_OLLAMA_MODEL is always used */
  model?:      string
  max_tokens?: number
  system?:     string
  messages:    Array<{ role: string; content: string }>
}

/**
 * Send a chat request to the local Ollama instance and return the response text.
 * Throws on network errors or non-2xx HTTP status.
 */
export async function ollamaChat(params: OllamaChatParams): Promise<string> {
  const base  = (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined) ?? 'http://localhost:11434'
  const model = (import.meta.env.VITE_OLLAMA_MODEL     as string | undefined) ?? params.model ?? 'llama3.1:8b'

  const messages: Array<{ role: string; content: string }> = []
  if (params.system) messages.push({ role: 'system', content: params.system })
  messages.push(...params.messages)

  const res = await fetch(`${base}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model,
      messages,
      max_tokens:      params.max_tokens,
      stream:          false,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return data.choices?.[0]?.message?.content ?? ''
}
