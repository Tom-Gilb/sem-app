// UNIT_TYPE=Hook
// useSDK — Anthropic SDK composable for SEM-to-Planguage translation pipeline
// Spec: S.EvoStep2.SDKConfig / S.EvoStep2.PipelineHandler / 3P.V.LLMResponseReliability

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { ref } from 'vue'
import { MODEL_ID, SYSTEM_PROMPT, SYSTEM_PROMPT_CACHE_CONTROL } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import { useLoadingState } from './useLoadingState'
import { logLlmCall } from './useAnalyticsEvents'
import { parseApiError } from '../utils/parseApiError'

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
      throw new Error('VITE_ANTHROPIC_API_KEY is not set — configure this environment variable to enable the translation pipeline')
    }
    _client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      // 90-second timeout — prevents silent spinning on mobile networks
      // where a TCP connection can stall without triggering an error.
      // The default SDK timeout is 10 minutes which is unusable on mobile.
      timeout: 90_000,
    })
  }
  return _client
}

/**
 * Returns a mock SpecBlock derived from the user's actual SEM input.
 * Used when VITE_ANTHROPIC_API_KEY is not set — lets the full UI flow
 * be demonstrated without a live API connection.
 */
function buildMockSpec(stakes: string, ends: string, means: string): import('../types/spec').SpecBlock {
  // ── ID generation ─────────────────────────────────────────────────────────
  // Strip numbers/punctuation then pick the first N meaningful words as CamelCase.
  const STOP = new Set([
    'a','an','the','in','on','at','of','to','by','as','for','and','or','but',
    'with','from','into','over','within','that','this','these','those',
    'is','are','was','were','days','hours','weeks','months','years',
  ])
  function toCamel(text: string, maxWords = 3): string {
    const slug = text
      .replace(/\d+\s*%?/g, '')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w.toLowerCase()))
      .slice(0, maxWords)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
    return slug || 'Value'
  }

  // ── Extract stakeholder (text before first comma/semicolon) ───────────────
  const stakeholderShort = stakes.split(/[,;]/)[0].trim()

  // ── Extract numeric from→to range ("from 30% to 65%", "50% to 80%") ──────
  const rangeMatch =
    ends.match(/from\s+(\d+(?:\.\d+)?)\s*%?\s+to\s+(\d+(?:\.\d+)?)\s*%/i) ??
    ends.match(/(\d+(?:\.\d+)?)\s*%\s+to\s+(\d+(?:\.\d+)?)\s*%/i)

  let tolerable: string
  let goal: string
  if (rangeMatch) {
    const from = parseFloat(rangeMatch[1])
    const to   = parseFloat(rangeMatch[2])
    tolerable  = `${Math.round((from + to) / 2)}%`
    goal       = `${to}%`
  } else {
    const pctM = ends.match(/(\d+(?:\.\d+)?)\s*%/)
    const pct  = pctM ? parseFloat(pctM[1]) : 90
    tolerable  = `${Math.round(pct * 0.8)}%`
    goal       = `${pct}%`
  }

  // ── Extract key metric phrase ("activation rate", "churn score", etc.) ────
  const metricM = ends.match(
    /\b([\w]+(?:\s+[\w]+)?)\s+(?:rate|time|score|count|ratio|level|index|speed)\b/i,
  )
  const metric = metricM
    ? metricM[0].trim()
    : toCamel(ends, 2)

  // ── Timeframe ("within 60 days", "within 2 weeks") ───────────────────────
  const timeframeM = ends.match(/within\s+(\d+\s+\w+)/i)
  const timeframe  = timeframeM ? ` within ${timeframeM[1]}` : ''

  // ── Build CamelCase IDs ───────────────────────────────────────────────────
  const valueSlug = toCamel(metric, 3)
  const meansSlug = toCamel(
    means.replace(/^(?:implement|use|deploy|build|create|develop|set\s+up)\s+/i, ''),
    3,
  )

  const fId = `F.${valueSlug}`
  const vId = `V.${valueSlug}`
  const sId = `S.${meansSlug}`

  return {
    functions: [
      {
        id:              fId,
        type:            'Function',
        level:           'Product',
        description:     ends,
        successCriteria: `${stakeholderShort} confirms ${metric} reaches ${goal}${timeframe}`,
        functionOfValue: vId,
      },
    ],
    values: [
      {
        id:              vId,
        type:            'Value',
        level:           'Product',
        description:     `${metric}${timeframe}`,
        scale:           `${metric} (%)${timeframe}`,
        meter:           `Measured at each Evo step exit via product analytics; reviewed and approved by ${stakeholderShort}`,
        status:          'pre-build',
        tolerable,
        goal,
        valueOfFunction: fId,
      },
    ],
    solutions: [
      {
        id:          sId,
        type:        'Solution',
        level:       'Product',
        description: means,
        impact:      `${vId} ~${goal}`,
        function:    fId,
      },
    ],
  }
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
  const { startLoading, stopLoading } = useLoadingState()

  async function translate(
    stakes: string,
    ends: string,
    means: string,
    clarifications?: string,
  ): Promise<SpecBlock | null> {
    loading.value = true
    error.value = ''
    startLoading('sdk:translate', 'Translating your plan…')

    // 3P.V.LLMResponseReliability — declared before try so catch can reference them
    let _callStart = 0
    let _callSucceeded = false

    try {
      // Mock mode is only active when VITE_MOCK_MODE=true is explicitly set.
      // A missing API key is a hard error — it surfaces so the user knows
      // their environment is not configured correctly.
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise((r) => setTimeout(r, 1200))
        return buildMockSpec(stakes, ends, means)
      }

      const client = getClient()
      const userContent = clarifications
        ? `Stakes: ${stakes}\nEnds: ${ends}\nMeans: ${means}\n\nAdditional context (user clarifications):\n${clarifications}`
        : `Stakes: ${stakes}\nEnds: ${ends}\nMeans: ${means}`

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: SYSTEM_PROMPT_CACHE_CONTROL,
      }

      _callStart = Date.now()

      const response = await client.beta.messages.create({
        model: MODEL_ID,
        // 4096 tokens comfortably fits a spec with 5 F + 5 V + 5 S entries
        // (typical detailed output ≈ 2 000–3 500 tokens).
        // Sonnet's hard ceiling is 8 192 output tokens.
        max_tokens: 8192,
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        betas: ['prompt-caching-2024-07-31'],
      })

      // Detect truncation before attempting to parse — JSON cut mid-stream
      // produces a misleading "not valid JSON" error instead of the real cause.
      if (response.stop_reason === 'max_tokens') {
        throw new Error(
          'LLM response was cut off (max_tokens limit reached). ' +
          'The spec was too large — try splitting your Means into fewer approaches.',
        )
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('LLM response contained no text block')
      }

      const spec = parseSpecBlock(textBlock.text.trim())

      // Log successful call — cacheHit = cache_read_input_tokens > 0
      _callSucceeded = true
      const cacheHit = ((response.usage as Record<string, unknown>)?.cache_read_input_tokens as number ?? 0) > 0
      logLlmCall('translation', Date.now() - _callStart, true, cacheHit)

      return spec
    } catch (err) {
      const parsed = parseApiError(err)
      error.value = `${parsed.title}: ${parsed.detail}${parsed.actionUrl ? ` ${parsed.actionUrl}` : ''}`
      // Log failed call only when we actually reached the API (callStart was set)
      if (!_callSucceeded && _callStart > 0) {
        logLlmCall('translation', Date.now() - _callStart, false, false)
      }
      return null
    } finally {
      loading.value = false
      stopLoading('sdk:translate')
    }
  }

  /**
   * Streaming variant of translate — calls onChunk with each token as it arrives.
   * Returns the fully parsed SpecBlock once the stream completes.
   * In mock mode: simulates streaming by chunking the mock spec serialisation.
   */
  async function translateStream(
    stakes: string,
    ends: string,
    means: string,
    onChunk: (text: string) => void,
    clarifications?: string,
  ): Promise<SpecBlock | null> {
    loading.value = true
    error.value = ''
    startLoading('sdk:translate', 'Translating your plan…')

    try {
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        const mockSpec = buildMockSpec(stakes, ends, means)
        const fullText = JSON.stringify(mockSpec, null, 2)
        // Simulate streaming by yielding chunks of ~20 characters
        const chunkSize = 20
        for (let i = 0; i < fullText.length; i += chunkSize) {
          const chunk = fullText.slice(i, i + chunkSize)
          onChunk(chunk)
          await new Promise((r) => setTimeout(r, 30))
        }
        return parseSpecBlock(fullText.trim())
      }

      const client = getClient()
      const userContent = clarifications
        ? `Stakes: ${stakes}\nEnds: ${ends}\nMeans: ${means}\n\nAdditional context (user clarifications):\n${clarifications}`
        : `Stakes: ${stakes}\nEnds: ${ends}\nMeans: ${means}`

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: SYSTEM_PROMPT_CACHE_CONTROL,
      }

      let fullText = ''
      const stream = client.beta.messages.stream({
        model: MODEL_ID,
        max_tokens: 8192,
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        betas: ['prompt-caching-2024-07-31'],
      })

      stream.on('text', (delta: string) => {
        fullText += delta
        onChunk(delta)
      })

      await stream.finalMessage()

      return parseSpecBlock(fullText.trim())
    } catch (err) {
      const parsed = parseApiError(err)
      error.value = `${parsed.title}: ${parsed.detail}${parsed.actionUrl ? ` ${parsed.actionUrl}` : ''}`
      return null
    } finally {
      loading.value = false
      stopLoading('sdk:translate')
    }
  }

  return { loading, error, translate, translateStream }
}
