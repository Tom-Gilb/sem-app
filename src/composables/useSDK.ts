// UNIT_TYPE=Hook
// useSDK — Anthropic SDK composable for SEM-to-Planguage translation pipeline
// Spec: S.EvoStep2.SDKConfig / S.EvoStep2.PipelineHandler / 3P.V.LLMResponseReliability

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID, SYSTEM_PROMPT, SYSTEM_PROMPT_CACHE_CONTROL } from '../config/llm'
// r41 v48 — Tom Gilb 2026-06-16 Model Mode 4-axis config injected into every
// spec/model generation call.  buildModelModeContext returns a structured
// prompt prefix describing Domain · Presentation · Standards · Purpose.
// r41 v51 — gated to activeMode === 'model' so Plan Mode keeps a clean prompt.
import { buildModelModeContext } from './useModelModeContext'
import { useActiveMode } from './useActiveMode'
import type { SpecBlock } from '../types/spec'
import { stampEntry } from '../utils/sourceStamp'
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
 * 2026-06-26 S3 stability sweep + S3-revised (v384) — Tom: "do stability
 * first" then "be conservative and get it right long term".  Audit
 * revealed the prior config was STRUCTURALLY broken:
 *   (a) timeout was 60_000 with comment "fires well before the 100 s
 *       watchdog" — but watchdog is 300_000 (r41 sometime), so the
 *       comment was stale by a factor of 3.
 *   (b) maxRetries was implicit (Anthropic SDK default is 2) — so a
 *       hanging call retried twice silently, stretching total wall time
 *       to 60 × 3 = 180 s+ before the catch block ever ran.  That IS
 *       the "endless feel" Tom hit: not one stuck call, but three.
 *
 * v383 first shipped `timeout: 240_000` — but that ABORTS legitimate
 * 4-5 min generations BEFORE the honest loading-hint copy
 * (`rule_loading_hint_honest_copy.md`) promised the user it could take
 * "up to 3-5 minutes".  Structurally a silent broken promise.
 *
 * v384 — Option C: `timeout: 320_000` (320 s = 5:20).  Comfortably
 * over the honest "3-5 minute" upper band so a real 5-min Sonnet
 * generation completes successfully.  Watchdog raised to 350_000 in
 * parallel (App.vue:_HANG_WATCHDOG_MS) so the SDK abort fires first
 * with 30 s headroom for the catch+finally chain before the watchdog
 * is involved.  `maxRetries: 0` STAYS — no silent retry-stretching;
 * one call, one wait, deterministic abort at 320 s if Anthropic
 * itself hangs.
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
      timeout: 320_000,            // 320 s — comfortably over honest 3-5 min copy upper bound; watchdog at 350 s is the safety net 30 s later (v384 Option C 2026-06-26)
      maxRetries: 0,               // no silent retries — one call, one wait, deterministic abort (S3 fix 2026-06-26)
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
  // r41 v220 (2026-06-20 producer-stamp sweep) — mock spec entries carry
  // the 'system' provenance ("Mock Spec Builder · <Date>") so the demo
  // flow shows the Source chip lit up rather than empty.  Tom's "demo
  // never dies" rule + producer-stamp rule compose: demo data MUST
  // include provenance to honour the No-Silent-Data-Loss SUPREME rule.
  // r41 v415 (Source Attribution SUPREME sweep) — Class B (deterministic mock).
  const mockStamp = {
    generator:  'Mock Spec Builder (No API Key Demo)',
    sourceType: 'system' as const,
    tool:       'buildMockSpec',
    stage:      'seed-sample-plan',
  }
  return {
    functions: [
      stampEntry({
        id:              fId,
        type:            'Function',
        level:           'Product',
        description:     `The system provides ${capability}`,
        presenceTest:    `${capability} capability is present in the deployed system (YES / NO)`,
        functionOfValue: vId,
      }, mockStamp),
    ],
    values: [
      stampEntry({
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
      }, mockStamp),
    ],
    solutions: [
      stampEntry({
        id:          sId,
        type:        'Solution',
        level:       'Product',
        description: means,
        impact:      `${vId} ~${goal}`,
        function:    fId,
      }, mockStamp),
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
function parseSpecBlock(raw: string, stampCtx?: { generator?: string; planName?: string; stage?: string }): SpecBlock {
  let parsed: unknown
  // r41 v40 — Tom Gilb 2026-06-15 "failed to parse" — more aggressive
  // extraction layers before giving up.  LLM responses sometimes have:
  //   - leading prose ("Here's the spec:\n\n{...}")
  //   - markdown code fences with language tag variations (```json, ```JSON, ```)
  //   - trailing commentary after the JSON
  //   - inline single-line JSON object embedded mid-paragraph
  //   - multiple {...} blocks (legacy reasoning + final answer)
  // Each fallback layer below tries harder.
  const stripFences = (s: string): string => s
    .replace(/^```(?:json|JSON|jsonc)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .replace(/```(?:json|JSON|jsonc)?\s*([\s\S]*?)\s*```/i, '$1')
    .trim()
  const cleaned = stripFences(raw)
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Layer 2: greedy {…} extraction — last balanced object wins (LLMs often
    // emit "reasoning {...}" then "final {...}" — use the LAST one).
    const matches = cleaned.match(/\{[\s\S]*\}/g)
    if (matches && matches.length > 0) {
      // Try last block first, then earlier ones, until one parses successfully.
      for (let i = matches.length - 1; i >= 0; i--) {
        try { parsed = JSON.parse(matches[i]); break } catch { /* try next */ }
      }
    }
    // Layer 3: balanced-brace scan from first { to its matching } (handles
    // JSON with embedded prose before/after that breaks the greedy regex).
    if (!parsed) {
      const firstBrace = cleaned.indexOf('{')
      if (firstBrace >= 0) {
        let depth = 0
        let endIdx = -1
        let inString = false
        let escapeNext = false
        for (let i = firstBrace; i < cleaned.length; i++) {
          const c = cleaned[i]
          if (escapeNext) { escapeNext = false; continue }
          if (c === '\\') { escapeNext = true; continue }
          if (c === '"') { inString = !inString; continue }
          if (inString) continue
          if (c === '{') depth++
          else if (c === '}') { depth--; if (depth === 0) { endIdx = i; break } }
        }
        if (endIdx > firstBrace) {
          try { parsed = JSON.parse(cleaned.slice(firstBrace, endIdx + 1)) } catch { /* fall through */ }
        }
      }
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
    // r07-followup (Tom Gilb 2026-06-16 screenshot "after generation … this blank"):
    // The Parameter Discipline SUPREME rule (r03) told the LLM that V. description
    // is RARE — most Values should omit it.  Many existing consumers across the
    // codebase (useSpecModel `_modelNameFromSpec`, gamification, complexity,
    // SWOT, strategy-sharpen, task-suggestions, etc.) read `entry.description`
    // directly with `.trim()` / `.split()` — they crash on undefined.  The
    // cascading crash unmounted the post-generation render and produced the
    // blank screen.  Surgical fix at the sanitiser: any missing or non-string
    // `description` becomes `''` here so every downstream consumer sees a
    // string.  Composes with No-Silent-Data-Loss (data is never dropped — '' is
    // an explicit absence) and the Parameter Discipline rule (Values can still
    // legitimately have empty description; the runtime no longer cares).
    if (typeof entry.description !== 'string') {
      entry.description = ''
    }
  }
  // Same backfill on C. (constraints) and R. (resources) if present.
  if (Array.isArray(obj.constraints)) {
    for (const c of obj.constraints as Array<Record<string, unknown>>) {
      if (typeof c.description !== 'string') c.description = ''
    }
  }
  if (Array.isArray(obj.resources)) {
    for (const r of obj.resources as Array<Record<string, unknown>>) {
      if (typeof r.description !== 'string') r.description = ''
    }
  }

  // r41 v220 (Tom Gilb 2026-06-20 producer-stamp sweep) — every entry the
  // SEM Stage 1 SDK pipeline returns is stamped with provenance so the
  // renderer's Source chips light up in BOTH the in-app card AND the
  // colorful HTML export.  Composes with Conjunction-of-Technologies
  // SUPREME (source-layer badges per finding) + No-Silent-Data-Loss SUPREME.
  const block = obj as unknown as SpecBlock
  // r41 v415 (Source Attribution SUPREME sweep) — Class A (raw-text sourced
  // from the LLM's input stakes text).  Callers can override `stage` via
  // stampCtx; default to Stage 1 which is the primary Stage-1 SDK consumer.
  const stampOpts = {
    generator:  stampCtx?.generator ?? 'SEM Stage 1 SDK',
    planName:   stampCtx?.planName,
    sourceType: 'ai' as const,
    tool:       'translate (Sonnet 4.5)',
    stage:      stampCtx?.stage ?? 'plan-stage-1-input',
  }
  block.functions   = block.functions.map(e => stampEntry(e, stampOpts))
  block.values      = block.values.map(e => stampEntry(e, stampOpts))
  block.solutions   = block.solutions.map(e => stampEntry(e, stampOpts))
  if (block.constraints) block.constraints = block.constraints.map(e => stampEntry(e, stampOpts))
  if (block.resources)   block.resources   = block.resources.map(e => stampEntry(e, stampOpts))
  if (block.stakeholderEntries) {
    block.stakeholderEntries = block.stakeholderEntries.map(e => stampEntry(e, stampOpts))
  }
  return block
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
      // r41 v51 (Tom Gilb 2026-06-16 "crap result of generating specs, very
      // corrupted, it was great") — only inject Model Mode context when the
      // user is ACTUALLY IN Model Mode.  r41 v48 was injecting it on every
      // translate() call, which polluted Plan Mode generation with 10 lines
      // of Domain/Presentation/Standards/Purpose framing that confused the
      // LLM into either timing out (→ buildMockSpec fallback with "HttpsWww"
      // CamelCase garbage) or producing off-shape output.  Plan Mode now
      // gets the original clean prompt; Model Mode keeps the rich context.
      let isModelMode = false
      try { isModelMode = useActiveMode().activeMode.value === 'model' } catch { /* ignore */ }
      const modelModePrefix = isModelMode ? buildModelModeContext() : ''
      const userContent =
        `Return ONLY a JSON object matching exactly: {"functions":[...],"values":[...],"solutions":[...],"constraints":[...]}\n\n` +
        (modelModePrefix ? modelModePrefix + '\n\n' : '') +
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

      const spec = parseSpecBlock(textBlock.text.trim(), { generator: 'SEM Stage 1 SDK (translate)', planName: stakes.trim().split(/[,;]/)[0]?.trim() || undefined })
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
        const parsedMock = parseSpecBlock(fullText.trim(), { generator: 'SEM Stage 1 SDK (mock stream)', planName: stakes.trim().split(/[,;]/)[0]?.trim() || undefined })
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
      // r41 v51 (Tom Gilb 2026-06-16 "crap result of generating specs, very
      // corrupted, it was great") — only inject Model Mode context when the
      // user is ACTUALLY IN Model Mode.  r41 v48 was injecting it on every
      // translate() call, which polluted Plan Mode generation with 10 lines
      // of Domain/Presentation/Standards/Purpose framing that confused the
      // LLM into either timing out (→ buildMockSpec fallback with "HttpsWww"
      // CamelCase garbage) or producing off-shape output.  Plan Mode now
      // gets the original clean prompt; Model Mode keeps the rich context.
      let isModelMode = false
      try { isModelMode = useActiveMode().activeMode.value === 'model' } catch { /* ignore */ }
      const modelModePrefix = isModelMode ? buildModelModeContext() : ''
      const userContent =
        `Return ONLY a JSON object matching exactly: {"functions":[...],"values":[...],"solutions":[...],"constraints":[...]}\n\n` +
        (modelModePrefix ? modelModePrefix + '\n\n' : '') +
        semTripleStream

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: SYSTEM_PROMPT_CACHE_CONTROL,
      }

      // r41 v370 (Tom Gilb 2026-06-25 "nope, all zero" after v369 for-await
      // rewrite still produced zero text): SWITCHED to `messages.create({...
      // stream: true})` which returns a `Stream<RawMessageStreamEvent>` async
      // iterable directly — DIFFERENT code path from `messages.stream(...)`.
      // The latter returns a `MessageStream` wrapper that internally creates
      // the stream lazily on first emitter listener; in some environments
      // (notably Safari Add-to-Dock standalone PWA per hypothesis #2) the
      // wrapper layer can mask SSE chunks.  `messages.create({stream:true})`
      // is the simpler, more direct entry point.
      //
      // Heavy per-stage diagnostic logging via console.error so the in-PWA
      // Diagnostics Panel captures EXACTLY where the pipeline stops:
      //   [translateStream] STAGE: pre-create
      //   [translateStream] STAGE: post-create (object received)
      //   [translateStream] STAGE: for-await entered
      //   [translateStream] STAGE: event yielded — type=...
      //   [translateStream] STAGE: for-await exited — Nth events
      //   [translateStream] STAGE: complete — textLen=N
      // Any missing stage names the failure surface.
      let fullText = ''
      let textDeltaCount = 0
      let allEventCount = 0
      const eventTypeCounts: Record<string, number> = {}
      const streamStart = Date.now()

      console.error('[translateStream] STAGE: pre-create', { userContentLen: userContent.length, systemLen: SYSTEM_PROMPT.length })

      const stream = await client.beta.messages.create({
        model: MODEL_ID,
        max_tokens: 16384,
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        stream: true,  // streaming mode — returns Stream<RawMessageStreamEvent>
      })

      console.error('[translateStream] STAGE: post-create', { hasStream: !!stream, type: typeof stream, hasAsyncIterator: !!(stream as { [Symbol.asyncIterator]?: () => unknown })[Symbol.asyncIterator] })

      console.error('[translateStream] STAGE: for-await about to enter', { elapsedMs: Date.now() - streamStart })

      let stopReason: string | null = null
      try {
        for await (const event of stream as AsyncIterable<{ type: string; delta?: { type: string; text?: string }; message?: { stop_reason?: string } }>) {
          allEventCount++
          eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1

          // Log first 3 events of any type so we see the shape Safari yields
          if (allEventCount <= 3) {
            console.error(`[translateStream] STAGE: event #${allEventCount}`, { type: event.type, hasDelta: !!event.delta, deltaType: event.delta?.type, deltaTextLen: event.delta?.text?.length ?? 0 })
          }

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && typeof event.delta.text === 'string') {
            const delta = event.delta.text
            fullText += delta
            textDeltaCount++
            onChunk(delta)
          }
          if (event.type === 'message_delta' && event.delta && 'stop_reason' in event.delta) {
            stopReason = (event.delta as { stop_reason?: string }).stop_reason ?? null
          }
        }
      } catch (iterErr) {
        console.error('[translateStream] STAGE: for-await THREW', iterErr)
        throw iterErr
      }

      console.error('[translateStream] STAGE: for-await exited', {
        allEventCount,
        textDeltaCount,
        eventTypeCounts,
        textLen: fullText.length,
        elapsedMs: Date.now() - streamStart,
        stopReason,
      })

      // r41 v353 (Tom Gilb 2026-06-25): max_tokens truncation check.
      if (stopReason === 'max_tokens') {
        throw new Error(
          'LLM stream was cut off (max_tokens limit reached). ' +
          'The spec was too large — try splitting your Means into fewer approaches.',
        )
      }

      console.error('[translateStream] STAGE: complete', {
        textLen:       fullText.length,
        textDeltaCount,
        durationMs:    Date.now() - streamStart,
        stopReason,
        firstChars:    fullText.slice(0, 100),
        lastChars:     fullText.slice(-100),
      })

      const streamedSpec = parseSpecBlock(fullText.trim(), { generator: 'SEM Stage 1 SDK (stream)', planName: stakes.trim().split(/[,;]/)[0]?.trim() || undefined })
      if (stakes.trim()) streamedSpec.stakes = stakes.trim()
      return streamedSpec
    } catch (err) {
      // r41 v353 — surface the actual error to the Diagnostics Panel via
      // console.error so the planner can see WHY streaming failed, not just
      // "it failed."  parseApiError translates SDK-shape errors to friendly
      // copy; the raw err object goes to console for stack-trace fidelity.
      console.error('[translateStream] FAILED — falling back through doTranslate to one-shot translate()', err)
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
