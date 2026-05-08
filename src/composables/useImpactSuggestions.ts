// UNIT_TYPE=Hook
// useImpactSuggestions — manages the V×S impact matrix with AI/mock suggestions and V/C calculations
// Full implementation — Evo Step 9 (S.Evo9.AIImpactSuggestionHandler)
// Spec: S.Evo9.ImpactEstimationVDTUI / F.EstimateImpactAndPrioritise / V.PrioritisationAccuracy
//       3P.V.LLMResponseReliability (timing instrumentation added Evo Step 10)

import { reactive, computed, ref } from 'vue'
import type { VEntry, SEntry } from '../types/spec'
import type { ImpactMatrix, VCRatio } from '../types/impact'
import { useLoadingState } from './useLoadingState'
import { logLlmCall } from './useAnalyticsEvents'

// --- Deterministic hash for seeding mock values --------------------------------
// Produces a stable integer from a string so identical value+solution pairs always
// yield the same mock impact % across test runs. This is essential for test stability.
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    // djb2-style hash: multiply by 31 and XOR each char code
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Generates a deterministic mock impact value for a given valueId + solutionId pair.
 * Uses two independent hashes to produce a realistic spread across all 5 colour tiers:
 *
 *   tier 0 (10%) →  0            white  — no estimate
 *   tier 1 (10%) → −50 to −79   dark-red — very bad side effect
 *   tier 2 (10%) → −5  to −44   red      — negative side effect
 *   tier 3 (40%) →  30 to  68   brown    — positive impact
 *   tier 4 (30%) →  70 to  99   green    — best impact
 *
 * Both hash inputs differ so tier and inner value are independent.
 */
function deterministicMockImpact(valueId: string, solutionId: string): number {
  const seed  = simpleHash(valueId + solutionId)
  const inner = simpleHash(solutionId + valueId)
  const tier  = seed % 10
  if (tier === 0) return 0
  if (tier === 1) return -((inner % 30) + 50)   // −50 to −79
  if (tier === 2) return -((inner % 40) +  5)   // −5  to −44
  if (tier <= 6)  return  (inner % 39) + 30     // 30  to  68
  return              (inner % 30) + 70          // 70  to  99
}

/**
 * Deterministic mock calendar-weeks estimate for a solution (range 2–23 weeks).
 */
function deterministicMockCalendarWeeks(solutionId: string): number {
  const seed = simpleHash(solutionId + 'weeks')
  return (seed % 22) + 2
}

/**
 * Deterministic mock capital cost in $k for a solution (range $10k–$199k).
 */
function deterministicMockCapitalK(solutionId: string): number {
  const seed = simpleHash(solutionId + 'capk')
  return (seed % 190) + 10
}

// --- V/C calculation helpers --------------------------------------------------

/**
 * Computes V/C ratio for one solution given the current impact matrix.
 *
 * V/C = valueImpactSum / resourceClaim
 * If resourceClaim === 0, V/C = valueImpactSum (unconstrained — display as Infinity in UI).
 */
function computeVCRatio(
  solutionId: string,
  valueIds: string[],
  matrix: ImpactMatrix,
  resourceClaim: number,
): VCRatio {
  // Sum all impact % for this solution across every value row
  const valueImpactSum = valueIds.reduce((sum, vid) => {
    return sum + ((matrix[vid]?.[solutionId]) ?? 0)
  }, 0)

  // Guard against division by zero per spec: if resourceClaim is 0, ratio = valueImpactSum
  const ratio = resourceClaim === 0 ? valueImpactSum : valueImpactSum / resourceClaim

  return { solutionId, valueImpactSum, resourceClaim, ratio }
}

/**
 * Composable that manages the V×S impact matrix for the Impact Estimation VDT.
 *
 * In VITE_MOCK_MODE=true, the matrix is pre-populated with deterministic synthetic
 * values so tests are stable across runs.
 *
 * In real mode, the matrix is populated by calling the Anthropic API (prompt-cached),
 * then exposed for user editing.
 *
 * V/C ratios and ranked solution order recompute reactively whenever any cell changes.
 *
 * @param values - The V. entries from the current SpecBlock
 * @param solutions - The S. entries from the current SpecBlock
 * @param resourceClaims - Resource claim % per solutionId (default 20 when not provided)
 *
 * @returns {{
 *   impactMatrix: ImpactMatrix,
 *   vcRatios: Record<string, number>,
 *   rankedSolutions: string[],
 *   loading: Ref<boolean>,
 *   error: Ref<string|null>,
 *   updateCell: (valueId, solutionId, percent) => void,
 *   loadSuggestions: () => Promise<void>
 * }}
 *
 * Preconditions: values and solutions should have unique ids; resourceClaims defaults to 20.
 * Errors: exposes error.value with a plain-language message on API failure.
 *
 * @example
 * const { impactMatrix, vcRatios, rankedSolutions, updateCell, loadSuggestions } =
 *   useImpactSuggestions(values, solutions, { 'S.Evo9': 25 })
 */
export function useImpactSuggestions(
  values: VEntry[],
  solutions: SEntry[],
  resourceClaims: Record<string, number> = {},
) {
  // --- Reactive state ----------------------------------------------------------

  // The impact matrix: impactMatrix[valueId][solutionId] = 0–100
  const impactMatrix = reactive<ImpactMatrix>({})

  // Calendar time in weeks per solutionId (AI-estimated, user-editable)
  const calendarCosts = reactive<Record<string, number>>({})
  // Capital cost in $k per solutionId (AI-estimated, user-editable)
  const capitalCosts = reactive<Record<string, number>>({})

  // Loading/error state exposed for the view layer (proper refs so watchers can observe them)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { startLoading, stopLoading } = useLoadingState()

  // --- Helpers -----------------------------------------------------------------

  /** Returns the resource claim % for a solution (default 20 when not configured) */
  function getResourceClaim(solutionId: string): number {
    return resourceClaims[solutionId] ?? 20
  }

  // --- Computed V/C ratios (recompute on any impactMatrix mutation) -------------

  // Keyed by solutionId; ratio = valueImpactSum / resourceClaim (or valueImpactSum if claim=0)
  const vcRatios = computed<Record<string, number>>(() => {
    const valueIds = values.map((v) => v.id)
    const result: Record<string, number> = {}
    for (const sol of solutions) {
      const vc = computeVCRatio(sol.id, valueIds, impactMatrix, getResourceClaim(sol.id))
      result[sol.id] = vc.ratio
    }
    return result
  })

  // Solution IDs sorted by V/C ratio descending
  const rankedSolutions = computed<string[]>(() => {
    return [...solutions.map((s) => s.id)].sort((a, b) => {
      const ra = vcRatios.value[a] ?? 0
      const rb = vcRatios.value[b] ?? 0
      return rb - ra
    })
  })

  // --- Action: updateCell -------------------------------------------------------

  /**
   * Updates a single impact matrix cell, clamping the value to 0–100.
   * V/C ratios and ranked solutions recompute reactively after the update.
   *
   * @param valueId - ID of the V. entry (row)
   * @param solutionId - ID of the S. entry (column)
   * @param percent - Impact percentage, clamped to 0–100
   */
  function updateCell(valueId: string, solutionId: string, percent: number): void {
    // Clamp to valid range
    const clamped = Math.min(100, Math.max(-100, percent))

    // Ensure the row object exists before writing
    if (!impactMatrix[valueId]) {
      impactMatrix[valueId] = {}
    }
    impactMatrix[valueId][solutionId] = clamped
  }

  // --- Mock population ---------------------------------------------------------

  /** Fills the matrix with deterministic synthetic values (VITE_MOCK_MODE=true) */
  function populateMockMatrix(): void {
    for (const val of values) {
      if (!impactMatrix[val.id]) {
        impactMatrix[val.id] = {}
      }
      for (const sol of solutions) {
        impactMatrix[val.id][sol.id] = deterministicMockImpact(val.id, sol.id)
      }
    }
    // Populate rough cost estimates
    for (const sol of solutions) {
      calendarCosts[sol.id] = deterministicMockCalendarWeeks(sol.id)
      capitalCosts[sol.id] = deterministicMockCapitalK(sol.id)
    }
  }

  // --- Real mode: Anthropic API call -------------------------------------------

  /**
   * Calls the Anthropic API to get AI-suggested impact percentages for all V×S cells.
   * Uses prompt caching on the system prompt to reduce token cost.
   * Validates that all returned values are 0–100; clamps any out-of-range values.
   *
   * Only called when VITE_MOCK_MODE is not 'true'.
   */
  async function populateFromAPI(): Promise<void> {
    loading.value = true
    error.value = null
    startLoading('impact:suggestions', 'Estimating impact…')

    // 3P.V.LLMResponseReliability — declared before try so catch can reference them
    let _callStart = 0
    let _callSucceeded = false

    try {
      // Dynamically import the SDK only in real mode to keep tests fast
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      // Pass the key explicitly — Vite exposes VITE_* vars via import.meta.env,
      // not process.env, so the SDK's default Node.js key lookup always fails in browser.
      // dangerouslyAllowBrowser is required by the SDK when running client-side;
      // acceptable here because this is a personal planning tool with a user-owned key.
      const client = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
        dangerouslyAllowBrowser: true,
      })

      // Build the prompt asking for impact estimates for each V×S pair
      const valueList = values.map((v) => `- ${v.id}: ${v.description}`).join('\n')
      const solutionList = solutions.map((s) => `- ${s.id}: ${s.description}`).join('\n')

      // System prompt is cacheable — describes the task structure
      const systemPrompt = `You are a Value/Cost analysis assistant. Given Value entries (V.) and Solution entries (S.) from a Planguage spec:
1. Estimate the impact % (0–100) of each solution on each value. Be realistic — not all solutions impact all values equally.
2. Estimate rough implementation costs for each solution: calendarWeeks (integer weeks to implement, 1–52) and capitalK (capital cost in thousands USD, integer, typical range 5–500).

Return ONLY valid JSON in this exact structure:
{
  "matrix": { "<valueId>": { "<solutionId>": <integer 0-100> } },
  "costs": { "<solutionId>": { "calendarWeeks": <integer>, "capitalK": <integer> } }
}
No other text, no markdown fences.`

      const userPrompt = `Values:\n${valueList}\n\nSolutions:\n${solutionList}\n\nEstimate impact percentages for every V×S combination.`

      _callStart = Date.now()

      const response = await client.messages.create({
        model: import.meta.env.VITE_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        // 2048 tokens handles a 10×10 V×S matrix with cost estimates comfortably.
        max_tokens: 4096,
        // Prompt caching: system prompt is large and stable — cache it
        system: [
          {
            type: 'text',
            text: systemPrompt,
            // @ts-ignore — cache_control is part of the Anthropic API but not always typed
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      })

      // Extract the JSON response text
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Anthropic API')
      }

      // Strip markdown code fences if present (Claude sometimes wraps JSON in ```json ... ```)
      const rawText = textBlock.text.trim()
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

      // Parse and validate the structured response
      const parsed = JSON.parse(jsonText) as {
        matrix: ImpactMatrix
        costs?: Record<string, { calendarWeeks?: number; capitalK?: number }>
      }
      if (!parsed.matrix || typeof parsed.matrix !== 'object') {
        throw new Error('API response missing matrix field')
      }

      // Write validated impact values into the reactive matrix
      for (const [valueId, row] of Object.entries(parsed.matrix)) {
        if (!impactMatrix[valueId]) {
          impactMatrix[valueId] = {}
        }
        for (const [solutionId, rawValue] of Object.entries(row)) {
          const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue))
          if (!isNaN(num)) {
            impactMatrix[valueId][solutionId] = Math.min(100, Math.max(0, Math.round(num)))
          }
        }
      }

      // Apply a minimum floor of 10 to any cell left at 0 or missing.
      for (const val of values) {
        for (const sol of solutions) {
          if (!impactMatrix[val.id]) impactMatrix[val.id] = {}
          if ((impactMatrix[val.id][sol.id] ?? 0) === 0) {
            impactMatrix[val.id][sol.id] = 10
          }
        }
      }

      _callSucceeded = true
      const cacheHit = ((response.usage as Record<string, unknown>)?.cache_read_input_tokens as number ?? 0) > 0
      logLlmCall('impact', Date.now() - _callStart, true, cacheHit)

      // Write cost estimates if the API returned them
      if (parsed.costs && typeof parsed.costs === 'object') {
        for (const [solutionId, costObj] of Object.entries(parsed.costs)) {
          if (costObj.calendarWeeks !== undefined && !isNaN(Number(costObj.calendarWeeks))) {
            calendarCosts[solutionId] = Math.max(1, Math.round(Number(costObj.calendarWeeks)))
          }
          if (costObj.capitalK !== undefined && !isNaN(Number(costObj.capitalK))) {
            capitalCosts[solutionId] = Math.max(1, Math.round(Number(costObj.capitalK)))
          }
        }
      } else {
        // API didn't return costs — fall back to mock estimates
        for (const sol of solutions) {
          if (calendarCosts[sol.id] === undefined) calendarCosts[sol.id] = deterministicMockCalendarWeeks(sol.id)
          if (capitalCosts[sol.id] === undefined) capitalCosts[sol.id] = deterministicMockCapitalK(sol.id)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error loading AI suggestions'
      if (!_callSucceeded && _callStart > 0) {
        logLlmCall('impact', Date.now() - _callStart, false, false)
      }
      // API failed — fall back to mock values so cells are never all-zero
      populateMockMatrix()
    } finally {
      loading.value = false
      stopLoading('impact:suggestions')
    }
  }

  // --- loadSuggestions: entry point for the view layer -------------------------

  /**
   * Loads impact suggestions into the matrix. In VITE_MOCK_MODE=true, populates
   * with deterministic synthetic values. In real mode, calls the Anthropic API.
   *
   * Also used by the "Regenerate AI Suggestions" button in ImpactEstimationView.vue.
   */
  async function loadSuggestions(): Promise<void> {
    // Reset the matrix and costs before loading
    for (const val of values) {
      impactMatrix[val.id] = {}
    }
    for (const sol of solutions) {
      delete calendarCosts[sol.id]
      delete capitalCosts[sol.id]
    }

    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      populateMockMatrix()
    } else {
      await populateFromAPI()
    }
  }

  // Auto-populate on composable initialisation
  loadSuggestions().catch(() => {
    // Errors are captured in error.value — no unhandled promise rejection
  })

  return {
    impactMatrix,
    calendarCosts,
    capitalCosts,
    vcRatios,
    rankedSolutions,
    loading,
    error,
    updateCell,
    loadSuggestions,
  }
}
