// UNIT_TYPE=Hook
// useSDK — Anthropic SDK composable for SEM-to-Planguage translation pipeline
// Spec: S.EvoStep2.SDKConfig / S.EvoStep2.PipelineHandler / 3P.V.LLMResponseReliability

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID, SYSTEM_PROMPT, SYSTEM_PROMPT_CACHE_CONTROL } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import { useLoadingState } from './useLoadingState'
import { logLlmCall } from './useAnalyticsEvents'
import { parseApiError } from '../utils/parseApiError'

let _client: Anthropic | null = null

/**
 * Module-level AbortController for the currently in-flight translate() call.
 * The hung-generation watchdog in App.vue calls cancelCurrentTranslate() when
 * the 100-second timer fires, which aborts the underlying fetch immediately.
 * This prevents Safari from leaving a stalled TCP connection running in the
 * background after the UI has already been reset.
 */
let _translateController: AbortController | null = null

/**
 * Hard-cancel any in-flight translate() call.
 * Safe to call when no call is in flight (no-op).
 * Called by the hung-generation watchdog in App.vue before _forceClearLoading().
 */
export function cancelCurrentTranslate(): void {
  if (_translateController) {
    _translateController.abort()
    _translateController = null
  }
}

/**
 * Returns the singleton Anthropic client, initialised lazily from the
 * VITE_ANTHROPIC_API_KEY environment variable.
 *
 * Timeout is 60 s — comfortably shorter than the 100-second watchdog so the
 * SDK's own abort fires first, the catch block clears loading, and the watchdog
 * never fires in normal operation. (Previous 90 s was too close to the watchdog
 * and Safari's stalled-TCP behaviour caused the watchdog to fire first.)
 *
 * @throws {Error} if the API key environment variable is not set
 */
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
    if (!apiKey && !isLocal) {
      throw new Error('VITE_ANTHROPIC_API_KEY is not set — configure this environment variable to enable the translation pipeline')
    }
    _client = new Anthropic({
      apiKey: apiKey ?? 'local',   // adapter ignores this in local mode
      dangerouslyAllowBrowser: true,
      timeout: 60_000,             // 60 s — fires well before the 100 s watchdog
    })
  }
  return _client
}

/**
 * Returns a mock SpecBlock derived from the user's actual SEM input.
 * Used when VITE_ANTHROPIC_API_KEY is not set — lets the full UI flow
 * be demonstrated without a live API connection.
 */
// Exported 2026-05-13 so `launchDemo()` in App.vue can synthesize a deterministic
// spec without requiring a working API key or network — the demo must NEVER die.
export function buildMockSpec(stakes: string, ends: string, means: string): import('../types/spec').SpecBlock {
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

  // ── Extract all stakeholders (comma/semicolon/and-separated) ────────────
  const stakeholderList = stakes
    .split(/[,;]|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean)
  const stakeholderShort = stakeholderList[0] // primary stakeholder for mock F/V entries

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

  // DD-004 (Tom 2026-05-14, "REPURPOSE: NOT AS SUCCESS. AS PRESENCE OR ABSENCE
  // OF THE DEFINED FUNCTION."): a Function is a binary capability. The
  // description is a bare-noun capability statement; the presenceTest is the
  // YES/NO existence check. The quantitative confirmation (rate, timeframe,
  // stakeholder sign-off) lives on the V. entry's Goal/Tolerable/Meter, not on
  // the F. entry. See design-decisions.md DD-004 and Tom Gilb, *Clear
  // Communication: Logical Language Logistics for Clear Replies and Phrases*
  // (June 2024 — researchgate.net publication 393165120).
  const capability = metric.replace(/\s+(rate|time|score|count|ratio|level|index|speed)$/i, '').trim() || metric
  return {
    functions: [
      {
        id:              fId,
        type:            'Function',
        level:           'Product',
        description:     `The system provides ${capability}`,
        presenceTest:    `${capability} capability is present in the deployed system (YES / NO)`,
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
        meter:           `Measured at each Evo step exit via product analytics; reviewed and approved by ${stakeholderList.join(', ')}`,
        status:          'pre-build',
        tolerable,
        goal,
        valueOfFunction: fId,
        wishStakeholder: stakeholderShort,
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
  // Strip markdown code fences if the model wrapped the output
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Local models sometimes prepend prose — try to extract the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch { /* fall through */ }
    }
    if (!parsed) {
      throw new Error(`LLM response is not valid JSON:\n${raw.slice(0, 300)}`)
    }
  }

  let obj = parsed as Record<string, unknown>

  // Defensive unwrap: local models sometimes nest the spec inside a wrapper object,
  // e.g. { "spec": { "functions": [...], ... } } or { "result": { ... } }.
  // If the top level lacks the required arrays, scan one level deeper for an object
  // that has all three — use it if found, otherwise fall through to the error below.
  if (!Array.isArray(obj.functions) || !Array.isArray(obj.values) || !Array.isArray(obj.solutions)) {
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const nested = val as Record<string, unknown>
        if (Array.isArray(nested.functions) && Array.isArray(nested.values) && Array.isArray(nested.solutions)) {
          obj = nested
          break
        }
      }
    }
  }

  if (!Array.isArray(obj.functions) || !Array.isArray(obj.values) || !Array.isArray(obj.solutions)) {
    throw new Error('LLM response is missing required arrays: functions, values, solutions')
  }
  // F, V, and S may all be empty for constraint-only or value-only inputs — do not reject.
  // The user can add entries via the editor or Sharpen.

  // Coerce missing V measurement fields to '' rather than rejecting the whole response.
  // The user can fill gaps via Sharpen. Also filter out placeholder entries (id '?').
  obj.values = (obj.values as Array<Record<string, unknown>>).filter(
    v => typeof v.id === 'string' && v.id.trim() !== '' && v.id.trim() !== '?',
  )
  for (const v of obj.values as Array<Record<string, unknown>>) {
    for (const f of ['scale', 'meter', 'status', 'tolerable', 'goal']) {
      if (typeof v[f] !== 'string' || (v[f] as string).trim() === '') v[f] = ''
    }
  }

  // Filter placeholder S entries similarly
  obj.solutions = (obj.solutions as Array<Record<string, unknown>>).filter(
    s => typeof s.id === 'string' && s.id.trim() !== '' && s.id.trim() !== '?',
  )

  // Coerce C. entries: ensure scope/rationale/source are present strings.
  // The LLM may still emit legacy `limit` field — migrate it to description if
  // description is empty, and leave scope/rationale as empty strings so the
  // editor can prompt the user to fill them.
  if (Array.isArray(obj.constraints)) {
    for (const c of obj.constraints as Array<Record<string, unknown>>) {
      // Legacy `limit` → description migration (backwards compat with old saved specs)
      if (typeof c.limit === 'string' && c.limit.trim() && !c.description) {
        c.description = c.limit
      }
      delete c.limit
      if (typeof c.scope !== 'string')     c.scope     = ''
      if (typeof c.rationale !== 'string') c.rationale = ''
      // source is optional — only set if absent (undefined / null)
      if (c.source !== undefined && typeof c.source !== 'string') c.source = String(c.source)
    }
  }

  // Normalise the `level` field — local LLMs often misinterpret this as a priority
  // level ("high"/"medium"/"low") instead of a Planguage scope level.  Any value
  // that is not a recognised Planguage level is coerced to "Product".
  const VALID_LEVELS = new Set(['Business', 'Stakeholder', 'Product', 'Solution', 'Evo', 'To-Do', 'Personal'])
  const allEntries = [
    ...(obj.functions as Array<Record<string, unknown>>),
    ...(obj.values    as Array<Record<string, unknown>>),
    ...(obj.solutions as Array<Record<string, unknown>>),
  ]
  for (const entry of allEntries) {
    if (typeof entry.level !== 'string' || !VALID_LEVELS.has(entry.level)) {
      entry.level = 'Product'
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
        const mockS = buildMockSpec(stakes, ends, means)
        if (stakes.trim()) mockS.stakes = stakes.trim()
        return mockS
      }

      const client = getClient()

      // In local Ollama mode the system prompt alone is ~5 000 chars.
      // Ollama's default context window (llama3.1:8b) is 4 096 tokens ≈ 15 000 chars.
      // Untruncated SEM triples from large pasted documents can add another 10 000+
      // chars, reliably pushing the model past its context and returning garbage JSON.
      // Truncate each field here so the total user content stays < 3 000 chars, which
      // leaves room for the system prompt and the JSON output.
      // Anthropic cloud has a 200k token window — no truncation needed there.
      const isOllama = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
      const safeStakes = isOllama ? stakes.slice(0, 400)  : stakes
      const safeEnds   = isOllama ? ends.slice(0, 1500)   : ends
      const safeMeans  = isOllama ? means.slice(0, 800)   : means

      const semTriple = clarifications
        ? `Stakes: ${safeStakes}\nEnds: ${safeEnds}\nMeans: ${safeMeans}\n\nAdditional context (user clarifications):\n${clarifications.slice(0, 400)}`
        : `Stakes: ${safeStakes}\nEnds: ${safeEnds}\nMeans: ${safeMeans}`
      // Reinforce the output schema — local models attend to user-message
      // reminders more reliably than a distant system prompt instruction.
      const userContent =
        `Return ONLY a JSON object matching exactly: {"functions":[...],"values":[...],"solutions":[...],"constraints":[...]}\n\n` +
        semTriple

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: SYSTEM_PROMPT_CACHE_CONTROL,
      }

      _callStart = Date.now()

      // Create a fresh AbortController for this call and expose it so the
      // App.vue watchdog can hard-cancel the underlying fetch if needed.
      const controller = new AbortController()
      _translateController = controller

      const response = await client.beta.messages.create({
        model: MODEL_ID,
        // claude-sonnet-4-6 supports up to 64 000 output tokens.
        // Raised from 8 192 → 16 384 (2026-06-05): the SYSTEM_PROMPT mandates
        // 2–4 sentence descriptions per entry + ≥1 V per stakeholder concern;
        // a complex multi-stakeholder spec with 5+ entries was hitting the old
        // ceiling and returning a truncated/unparseable JSON response.
        max_tokens: 16384,
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        betas: ['prompt-caching-2024-07-31'],
      }, { signal: controller.signal })

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
      // Persist the original stakes string so downstream views (SDR, etc.) can
      // show stakeholders even when the LLM omits the wishStakeholder field on
      // individual V. entries. Optional field — safe to ignore on old specs.
      if (stakes.trim()) spec.stakes = stakes.trim()

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
      // Clear the module-level controller reference — this call is done
      // whether it succeeded, failed, or was aborted by the watchdog.
      _translateController = null
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
        if (stakes.trim()) mockSpec.stakes = stakes.trim()
        const fullText = JSON.stringify(mockSpec, null, 2)
        // Simulate streaming by yielding chunks of ~20 characters
        const chunkSize = 20
        for (let i = 0; i < fullText.length; i += chunkSize) {
          const chunk = fullText.slice(i, i + chunkSize)
          onChunk(chunk)
          await new Promise((r) => setTimeout(r, 30))
        }
        const parsedMock = parseSpecBlock(fullText.trim())
        if (stakes.trim()) parsedMock.stakes = stakes.trim()
        return parsedMock
      }

      const client = getClient()
      const isOllamaStream = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
      const safeStakesS = isOllamaStream ? stakes.slice(0, 400)  : stakes
      const safeEndsS   = isOllamaStream ? ends.slice(0, 1500)   : ends
      const safeMeansS  = isOllamaStream ? means.slice(0, 800)   : means
      const semTripleStream = clarifications
        ? `Stakes: ${safeStakesS}\nEnds: ${safeEndsS}\nMeans: ${safeMeansS}\n\nAdditional context (user clarifications):\n${clarifications.slice(0, 400)}`
        : `Stakes: ${safeStakesS}\nEnds: ${safeEndsS}\nMeans: ${safeMeansS}`
      const userContent =
        `Return ONLY a JSON object matching exactly: {"functions":[...],"values":[...],"solutions":[...],"constraints":[...]}\n\n` +
        semTripleStream

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: SYSTEM_PROMPT_CACHE_CONTROL,
      }

      let fullText = ''
      const stream = client.beta.messages.stream({
        model: MODEL_ID,
        max_tokens: 16384,  // raised from 8192 — 2026-06-05, matches translate() ceiling
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        betas: ['prompt-caching-2024-07-31'],
      })

      stream.on('text', (delta: string) => {
        fullText += delta
        onChunk(delta)
      })

      await stream.finalMessage()

      const streamedSpec = parseSpecBlock(fullText.trim())
      if (stakes.trim()) streamedSpec.stakes = stakes.trim()
      return streamedSpec
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
