// UNIT_TYPE=Hook
// useSDK — Anthropic SDK composable for SEM-to-Planguage translation pipeline
// Spec: S.EvoStep2.SDKConfig / S.EvoStep2.PipelineHandler

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { ref } from 'vue'
import { MODEL_ID, SYSTEM_PROMPT, SYSTEM_PROMPT_CACHE_CONTROL } from '../config/llm'
import type { SpecBlock } from '../types/spec'

let _client: Anthropic | null = null

/**
 * Returns the singleton Anthropic client, initialised lazily from the
 * VITE_ANTHROPIC_API_KEY environment variable.
 *
 * @throws {Error} if the API key environment variable is not set
 */
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (!apiKey) {
      throw new Error(
        'VITE_ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.',
      )
    }
    _client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  }
  return _client
}

/**
 * Resets the singleton Anthropic client.
 * Exposed for test isolation — do not call in production code.
 * @internal
 */
export function _resetClientForTest(): void {
  _client = null
}

/**
 * Parses the raw JSON string returned by the LLM into a validated SpecBlock.
 * Throws a descriptive error if the structure does not match the contract.
 */
function parseSpecBlock(raw: string): SpecBlock {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`LLM response is not valid JSON:\n${raw.slice(0, 300)}`)
  }

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.functions) || !Array.isArray(obj.values) || !Array.isArray(obj.solutions)) {
    throw new Error('LLM response is missing required arrays: functions, values, solutions')
  }
  if (obj.functions.length === 0) {
    throw new Error('LLM response has no F (Function) entries')
  }
  if (obj.values.length === 0) {
    throw new Error('LLM response has no V (Value) entries')
  }
  if (obj.solutions.length === 0) {
    throw new Error('LLM response has no S (Solution) entries')
  }

  // Validate that each V entry has the five required measurement fields
  for (const v of obj.values as Array<Record<string, unknown>>) {
    const missing = ['scale', 'meter', 'status', 'tolerable', 'goal'].filter(
      (f) => typeof v[f] !== 'string' || (v[f] as string).trim() === '',
    )
    if (missing.length > 0) {
      throw new Error(
        `V entry "${v.id ?? '?'}" is missing required measurement fields: ${missing.join(', ')}`,
      )
    }
  }

  return obj as unknown as SpecBlock
}

/**
 * Composable for the CE translation pipeline.
 *
 * Calls the Anthropic Messages API with the pinned model and CE system prompt,
 * parses the JSON response into a validated SpecBlock, and exposes reactive
 * loading and error state for the UI.
 *
 * The system prompt is sent with cache_control: { type: "ephemeral" } so that
 * repeated calls with different user input benefit from prompt cache hits
 * (V.PromptCacheHitRate).
 *
 * @returns {{ loading, error, translate }}
 *   - loading: reactive boolean — true while an API call is in flight
 *   - error: reactive string — non-empty when the last call failed
 *   - translate(stakes, ends, means): calls the API; resolves to SpecBlock on
 *     success; sets error and returns null on failure
 *
 * Preconditions: VITE_ANTHROPIC_API_KEY must be set in the environment.
 * Errors: network failures, JSON parse errors, and schema validation failures
 *   are caught, stored in error ref, and returned as null — they do not throw.
 */
export function useSDK() {
  const loading = ref(false)
  const error = ref('')

  async function translate(
    stakes: string,
    ends: string,
    means: string,
  ): Promise<SpecBlock | null> {
    loading.value = true
    error.value = ''

    try {
      const client = getClient()

      const userContent = `Stakes: ${stakes}\nEnds: ${ends}\nMeans: ${means}`

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: SYSTEM_PROMPT_CACHE_CONTROL,
      }

      const response = await client.beta.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        betas: ['prompt-caching-2024-07-31'],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('LLM response contained no text block')
      }

      const spec = parseSpecBlock(textBlock.text.trim())
      return spec
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, translate }
}
