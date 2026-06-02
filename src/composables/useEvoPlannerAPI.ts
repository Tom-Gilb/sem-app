// UNIT_TYPE=Hook
// useEvoPlannerAPI — Anthropic SDK composable for Evo Step Planner pipeline
// Spec: S.Evo6.EvoStepPlannerEndpoint / 3P.V.LLMResponseReliability

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID, EVO_PLANNER_PROMPT, EVO_PLANNER_PROMPT_CACHE_CONTROL } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import type { EvoStepPlan } from '../types/evo-plan'
import { useLoadingState } from './useLoadingState'
import { logLlmCall } from './useAnalyticsEvents'

let _plannerClient: Anthropic | null = null

// Vite HMR dispose — reset the singleton when this module hot-reloads.
// Without this, the client created before `maxRetries: 0` was added persists
// through hot reloads indefinitely; the SDK retries twice per call (100s+ stall)
// and Promise.race never gets a chance to win.  Full page reload would fix it
// too, but HMR dispose makes it automatic (Architectural Resilience Rule).
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _plannerClient = null
  })
}

/**
 * Returns the singleton Anthropic client for the Evo planner pipeline,
 * initialised lazily from the VITE_ANTHROPIC_API_KEY environment variable.
 *
 * @throws {Error} if the API key environment variable is not set
 */
function getPlannerClient(): Anthropic {
  if (!_plannerClient) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
    if (!apiKey && !isLocal) {
      throw new Error('VITE_ANTHROPIC_API_KEY is not set — configure this environment variable to enable the Evo planner pipeline')
    }
    // maxRetries: 0 — disable the SDK's built-in retry logic.
    // By default the SDK retries up to 2× on 429/5xx responses, each retry can
    // take as long as the original call.  This means a 50 s stall retries for
    // another 50 s → 100 s total before the SDK promise settles, which blows
    // past our 75 s Promise.race timeout even though the race fires correctly.
    // With maxRetries: 0, the SDK promise rejects immediately on the first failure,
    // so Promise.race is guaranteed to honour its timeout.
    // We implement our OWN retry at the composable level (re-clicking Generate)
    // instead of hiding it inside the SDK, which gives the user full visibility.
    _plannerClient = new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, maxRetries: 0 })
  }
  return _plannerClient
}

/**
 * Resets the singleton Anthropic client for the Evo planner.
 * Exposed for test isolation — do not call in production code.
 * @internal
 */
export function _resetPlannerClientForTest(): void {
  _plannerClient = null
}

/**
 * Returns a hardcoded mock EvoStepPlan for use when VITE_MOCK_MODE=true.
 * Simulates a plausible 3-step plan derived from any SpecBlock input.
 */
function buildMockEvoPlan(specBlock: SpecBlock): EvoStepPlan {
  const firstSolution = specBlock.solutions[0]?.id ?? 'Mock Solution'
  const firstValue = specBlock.values[0]?.id ?? 'Mock Value'
  const secondValue = specBlock.values[1]?.id ?? firstValue

  return {
    steps: [
      {
        name: `Evo 1 — ${firstSolution} Setup`,
        description: `Set up foundational configuration and scaffolding for ${firstSolution} — implementing the base structure that all subsequent steps build upon.`,
        linkedValues: [firstValue],
        linkedSolutions: [firstSolution],
        effortPercent: 20,
      },
      {
        name: `Evo 2 — ${firstSolution} Core`,
        description: `Implement the core logic of ${firstSolution}, wiring it to the application in preparation for Study-phase measurement of the primary value targets.`,
        linkedValues: [firstValue, secondValue],
        linkedSolutions: [firstSolution],
        effortPercent: 45,
      },
      {
        name: `Evo 3 — ${firstSolution} Tests`,
        description: `Write unit and integration tests for ${firstSolution}, establishing the measurement infrastructure so linked value exit gates can be evaluated in Study.`,
        linkedValues: [firstValue],
        linkedSolutions: [firstSolution],
        effortPercent: 35,
      },
    ],
  }
}

/**
 * Parses the raw JSON string returned by the LLM into a validated EvoStepPlan.
 * Throws a descriptive error if the structure does not match the output contract.
 *
 * @param specBlock - The source spec, used to auto-repair empty linkedSolutions.
 *   Tom 2026-05-15: "that must be your job" — if the LLM omits linkedSolutions
 *   the app silently assigns all available S. IDs rather than surfacing an
 *   internal validation error to the user.
 */
function parseEvoPlan(raw: string, specBlock: SpecBlock): EvoStepPlan {
  let parsed: unknown
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch { /* fall through */ }
    }
    if (!parsed) {
      throw new Error(`LLM response is not valid JSON:\n${raw.slice(0, 300)}`)
    }
  }

  const obj = parsed as Record<string, unknown>
  // Normalise alternative key names local models sometimes use
  if (!Array.isArray(obj.steps)) {
    const alt = obj.evo_steps ?? obj.evoSteps ?? obj.plan?.steps ?? obj.plan
    if (Array.isArray(alt)) obj.steps = alt
  }
  // Last resort: find ANY top-level array whose items look like steps
  if (!Array.isArray(obj.steps)) {
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (!Array.isArray(val) || val.length === 0) continue
      const first = val[0] as Record<string, unknown>
      if (typeof first.name === 'string' || typeof first.description === 'string') {
        obj.steps = val
        break
      }
    }
  }
  if (!Array.isArray(obj.steps)) {
    throw new Error('LLM response is missing required array: steps')
  }
  if (obj.steps.length === 0) {
    throw new Error('LLM response has no Evo steps (steps array is empty)')
  }

  for (const step of obj.steps as Array<Record<string, unknown>>) {
    // Local models sometimes use different field names or omit optional fields —
    // normalise rather than hard-error so the plan still renders
    if (!Array.isArray(step.linkedValues) || step.linkedValues.length === 0) {
      // Try alternative keys the model might have used
      const altLV = step.linked_values ?? step.values ?? step.linkedValue
      step.linkedValues = Array.isArray(altLV) ? altLV : (altLV ? [altLV] : [])
    }
    // Normalise linkedSolutions — accepts plural array (canonical), singular string
    // (legacy LLM output or old sessions), or alternative key names from local models.
    if (!Array.isArray(step.linkedSolutions) || (step.linkedSolutions as unknown[]).length === 0) {
      const altLS =
        step.linkedSolution ??   // legacy singular field — migrate forward
        step.linked_solutions ??
        step.linked_solution ??
        step.solution
      if (Array.isArray(altLS) && altLS.length > 0) {
        step.linkedSolutions = altLS
      } else if (typeof altLS === 'string' && altLS.trim() !== '') {
        step.linkedSolutions = [altLS]
      } else {
        step.linkedSolutions = []
      }
    }
    if (typeof step.effortPercent !== 'number') {
      step.effortPercent = typeof step.effort === 'number' ? step.effort : 25
    }
    // Post-normalisation repair + validation
    // linkedValues: no spec fallback possible — LLM must provide at least one V. ID
    if (!Array.isArray(step.linkedValues) || step.linkedValues.length === 0) {
      throw new Error(`Step "${step.name}" is missing required field: linkedValues — must reference ≥1 V. entry ID`)
    }
    // linkedSolutions: auto-repair by falling back to ALL S. IDs in the spec
    // rather than surfacing a raw validation error to the user.
    // Tom 2026-05-15: "that must be your job" — the LLM occasionally omits this
    // field; assigning all available solutions is always safe because an EvoStep
    // is allowed to implement multiple S. entries.
    if (!Array.isArray(step.linkedSolutions) || step.linkedSolutions.length === 0) {
      const fallback = specBlock.solutions.map(s => s.id).filter(Boolean)
      if (fallback.length > 0) {
        step.linkedSolutions = fallback
      } else {
        // No S. entries in spec at all — still throw, but the spec itself is incomplete
        throw new Error(`Step "${step.name}" has no linkedSolutions and the spec contains no S. entries to fall back on. Add at least one Solution first.`)
      }
    }
  }

  return obj as unknown as EvoStepPlan
}

/**
 * Composable for the Evo Step Planner pipeline.
 *
 * Accepts a SpecBlock JSON input, calls the LLM with the Evo planner system
 * prompt, and returns a validated EvoStepPlan — a ranked list of suggested
 * Evo steps derived from the F./V./S. entries in the SpecBlock.
 *
 * The system prompt is sent with cache_control: { type: "ephemeral" } so that
 * repeated calls with different SpecBlock inputs benefit from prompt cache hits
 * (V.EvoStep6.PlannerPromptCacheHit exit gate: cache_read_input_tokens > 0).
 *
 * Mock mode (VITE_MOCK_MODE=true): returns 3 hardcoded mock steps after a 1s delay
 * without making any API call.
 *
 * Real mode: makes an actual Anthropic API call with prompt caching.
 *
 * @returns {{ loading, error, planSteps }}
 *   - loading: reactive boolean — true while an API call is in flight
 *   - error: reactive string — non-empty when the last call failed
 *   - planSteps(specBlock): calls the API; resolves to EvoStepPlan on success;
 *     sets error and returns null on failure
 *
 * Preconditions: VITE_ANTHROPIC_API_KEY must be set when VITE_MOCK_MODE is not 'true'.
 * Errors: network failures, JSON parse errors, and schema validation failures
 *   are caught, stored in error ref, and returned as null — they do not throw.
 *
 * Spec: S.Evo6.EvoStepPlannerEndpoint
 */
export function useEvoPlannerAPI() {
  const loading = ref(false)
  const error = ref('')
  const { startLoading, stopLoading } = useLoadingState()

  async function planSteps(
    specBlock: SpecBlock,
    cycleLength: 'day' | 'week' | 'month' | 'quarter' = 'week',
    /**
     * Optional streaming progress callback. Fires with the full accumulated
     * text every time a new token chunk arrives from the Claude Code adapter.
     * Tom 2026-06-03 — "streaming" — used by EvoPlanView to extract step
     * names as they appear in the partial JSON and display them live. Safe
     * to omit; non-streaming callers continue to work unchanged.
     *
     * Throttled: only forwarded at most every 150 ms to prevent reactive-update
     * storms when text-deltas arrive every ~30 ms — those storms were
     * starving the event loop so the user's Cancel-button click could not
     * register (Tom 2026-06-03 screenshot, 215s elapsed with Cancel
     * non-responsive).
     */
    onProgress?: (partialText: string) => void,
    /**
     * Optional AbortSignal for cancellation. When the signal fires, the
     * SSE fetch aborts, the Vite middleware's res.on('close') fires,
     * and the claude subprocess is SIGTERM'd. Without this, cancelFetch
     * only set Vue refs but the background work kept going indefinitely.
     */
    signal?: AbortSignal,
  ): Promise<EvoStepPlan | null> {
    loading.value = true
    error.value = ''
    startLoading('evo:planSteps', 'Planning Evo Steps…')

    // Hard timeout guard — Promise.race implementation (Architectural Resilience Rule, 2026-06-02).
    //
    // WHY Promise.race instead of AbortController.signal:
    //   AbortController.signal passed to client.beta.messages.create() depends on the
    //   Anthropic SDK internally forwarding the signal to its underlying fetch() call.
    //   In practice, the browser SDK does not reliably honour the signal in all contexts
    //   (confirmed: 122s elapsed with no abort firing despite a 90s AbortController).
    //
    // WHY maxRetries: 0 is required for this to work:
    //   The Anthropic SDK retries failed requests up to 2× by default (429/5xx).
    //   Each retry can take as long as the original call — a 50 s stall becomes 100 s+.
    //   The SDK promise does NOT reject during retries; it keeps polling internally.
    //   Result: Promise.race fires at 75 s but the SDK promise is still live inside
    //   the retry loop → the UI never stops loading (confirmed: 100 s still showing).
    //   Fix: maxRetries: 0 on the Anthropic client (see getPlannerClient).
    //
    // Promise.race is framework-agnostic and always works when the SDK settles promptly:
    //   - If the API call completes first → race resolves with the API response.
    //   - If 120 s elapse first → race rejects with a sentinel EVO_TIMEOUT error.
    //   - The API call continues in the background but its result is ignored (the
    //     async stack is gone; it cannot write to any reactive state). This is safe.
    //   - clearInterval in finally ensures a successful call cancels the timer.
    //
    // Timeout ceiling rationale:
    //   - 60 s (the original) was set when calls were non-streaming — the user
    //     stared at a blank progress bar with no visible output. Tom 2026-06-02:
    //     "no 66sec ad counting." That ceiling existed because BLANK waits
    //     past 60s feel broken.
    //   - 180 s (streaming, Tom 2026-06-03): with the Claude Code SSE adapter,
    //     EvoPlanView surfaces ACTUAL step names live ("Drafting Evo Step 4:
    //     Education & Job Training Rollout") as they are typed by the model.
    //     The user has continuous visible feedback, not a blank wait — so the
    //     ceiling can be much longer. Detailed 4–5 step plans with long
    //     descriptions legitimately take 90–150 s; capping at 60 s aborted
    //     plans mid-Step-4 (Tom 2026-06-03 screenshot, 107s elapsed at Step 4).
    //   - The Cancel button in EvoPlanView is the user's escape hatch — they
    //     can always abort earlier if they want.
    //   - For non-streaming callers (none currently), the same ceiling applies
    //     but they get no visible feedback. Non-streaming use is discouraged
    //     and should remain a fallback path only.
    //
    // RELIABILITY NOTE (2026-06-02): setTimeout(fn, ms) does NOT reliably fire
    // in WKWebView/Electron — empirically proven when the spinner reached 182s
    // with three independent setTimeout mechanisms all failing simultaneously.
    // setInterval(fn, 1_000) IS reliable in this runtime.  This timeout race
    // uses the same setInterval + tick-count pattern as useEvoPlan.ts's backup.
    const EVO_TIMEOUT_S = onProgress ? 180 : 60
    let _timeoutId: ReturnType<typeof setInterval> | null = null

    // Timeout promise — rejects after EVO_TIMEOUT_S seconds via setInterval tick count.
    const _timeoutRace = new Promise<never>((_, reject) => {
      let _ticks = 0
      _timeoutId = setInterval(() => {
        _ticks++
        if (_ticks >= EVO_TIMEOUT_S) {
          if (_timeoutId !== null) { clearInterval(_timeoutId); _timeoutId = null }
          reject(new Error('EVO_TIMEOUT'))
        }
      }, 1_000)
    })

    // 3P.V.LLMResponseReliability — declared before try so catch can reference them
    let _callStart = 0
    let _callSucceeded = false

    try {
      if (!specBlock.solutions || specBlock.solutions.length === 0) {
        throw new Error('SpecBlock must contain at least one S. (Solution) entry')
      }

      // Mock mode: return hardcoded steps after a 1s simulated delay
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise((r) => setTimeout(r, 1000))
        return buildMockEvoPlan(specBlock)
      }

      const client = getPlannerClient()
      // Cycle length context — informs the LLM of the time-box constraint so that
      // steps are sized to fit the chosen cycle (Tom 2026-06-02 SEM App Book p.179).
      const CYCLE_HOURS: Record<'day' | 'week' | 'month' | 'quarter', number> = {
        day: 8, week: 40, month: 160, quarter: 480,
      }
      const clHours = CYCLE_HOURS[cycleLength]
      const clLabel = cycleLength.charAt(0).toUpperCase() + cycleLength.slice(1)
      const cycleContext = [
        `EVO CYCLE LENGTH: ${clLabel} (~${clHours}h maximum per step).`,
        `CONSTRAINT: Each Evo step MUST fit within ONE ${cycleLength} cycle.`,
        `The effortPercent values across all steps should sum to 100.`,
        `When estimating effort, ensure effortPercent × ${clHours}h ≈ that step's wall-clock time.`,
      ].join('\n')

      const userContent =
        `INPUT SPEC:\n${JSON.stringify(specBlock, null, 2)}\n\n` +
        `${cycleContext}\n\n` +
        `TASK: Derive 2–5 ranked Evo implementation steps from the spec above.\n` +
        `Return ONLY this JSON — no prose, no markdown, no extra keys:\n` +
        `{"steps":[{"name":"Evo 1 — Example Setup","description":"what is being implemented in this step","linkedValues":["Some Value"],"linkedSolutions":["Some Solution"],"effortPercent":25}]}`

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: EVO_PLANNER_PROMPT,
        cache_control: EVO_PLANNER_PROMPT_CACHE_CONTROL,
      }

      _callStart = Date.now()

      // ── Streaming path (Tom 2026-06-03) ──────────────────────────────────
      // When the caller passes onProgress, use client.beta.messages.stream so
      // the partial text flows up to the UI for live step-name extraction.
      // When onProgress is omitted, fall back to .create() — same behaviour as
      // before, slightly less overhead.
      let accumulatedText = ''

      if (onProgress) {
        // ── Throttle the onProgress firing to ≤ ~7Hz ────────────────────
        // Text-deltas arrive at ~30/sec when the model is generating fast.
        // Each delta triggers partialPlanText.value=... → streamedStepNames
        // recompute → evoPlannerPhases recompute → LoadingProgress's
        // phases prop diff → currentPhase recompute. That cascade was
        // saturating the event loop, blocking the Cancel button's click
        // handler from getting scheduled (Tom 2026-06-03 screenshot:
        // Cancel non-responsive at 215s elapsed).
        // 150ms = 6.67Hz updates feels live to humans without starving
        // the event loop. We still ACCUMULATE every token; we just don't
        // re-render reactivity for every one.
        let lastProgressMs = 0
        let pendingFlush: ReturnType<typeof setTimeout> | null = null
        const flushProgress = (): void => {
          lastProgressMs = Date.now()
          if (pendingFlush !== null) { clearTimeout(pendingFlush); pendingFlush = null }
          try { onProgress(accumulatedText) } catch { /* swallow handler errors */ }
        }

        const streamPromise: Promise<void> = (async () => {
          const stream = client.beta.messages.stream({
            model: MODEL_ID,
            max_tokens: 1024,
            system: [systemBlock],
            messages: [{ role: 'user', content: userContent }],
            betas: ['prompt-caching-2024-07-31'],
            signal,  // propagates to the SSE fetch in claudeCodeAdapter
          })
          stream.on('text', (delta: string) => {
            accumulatedText += delta
            const sinceLast = Date.now() - lastProgressMs
            if (sinceLast >= 150) {
              flushProgress()
            } else if (pendingFlush === null) {
              // Schedule a flush at the next throttle boundary so the
              // FINAL chunk is never lost even if it arrives in the
              // throttle window.
              pendingFlush = setTimeout(flushProgress, 150 - sinceLast)
            }
          })
          await stream.finalMessage()
          // Final flush so the UI sees the complete text after the stream ends.
          flushProgress()
        })()
        try {
          await Promise.race([streamPromise, _timeoutRace])
        } finally {
          if (pendingFlush !== null) clearTimeout(pendingFlush)
        }
      } else {
        // Race: API call vs hard timeout. Whichever settles first wins.
        const response = await Promise.race([
          client.beta.messages.create({
            model: MODEL_ID,
            max_tokens: 1024, // Evo plan output is 400–700 tokens (3–5 steps); 4096 was the CE budget by mistake
            system: [systemBlock],
            messages: [{ role: 'user', content: userContent }],
            betas: ['prompt-caching-2024-07-31'],
          }),
          _timeoutRace,
        ])
        const textBlock = response.content.find((b) => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('LLM response contained no text block')
        }
        accumulatedText = textBlock.text
      }

      const plan = parseEvoPlan(accumulatedText.trim(), specBlock)

      _callSucceeded = true
      // Streaming path does not expose cache hit detail directly; treat as miss.
      const cacheHit = false
      logLlmCall('evo-plan', Date.now() - _callStart, true, cacheHit)

      return plan
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)

      // Sentinel check: timeout fired before the API responded.
      if (err instanceof Error && err.message === 'EVO_TIMEOUT') {
        error.value =
          `Evo generation timed out after ${EVO_TIMEOUT_S} seconds. ` +
          `The AI may be overloaded — click Retry or SOS to reset.`

      // Anthropic credit exhaustion — 400 invalid_request_error with billing message.
      // Raw JSON is unreadable; surface a friendly action message instead.
      } else if (errMsg.includes('credit balance is too low') || errMsg.includes('insufficient_quota')) {
        error.value =
          `Anthropic API credits are exhausted. ` +
          `Please top up at console.anthropic.com/settings/billing, then Retry.`

      } else {
        error.value = errMsg
      }
      if (!_callSucceeded && _callStart > 0) {
        logLlmCall('evo-plan', Date.now() - _callStart, false, false)
      }
      return null
    } finally {
      // Clear the interval so it doesn't fire spuriously after a successful call.
      if (_timeoutId !== null) { clearInterval(_timeoutId); _timeoutId = null }
      loading.value = false
      stopLoading('evo:planSteps')
    }
  }

  return { loading, error, planSteps }
}
