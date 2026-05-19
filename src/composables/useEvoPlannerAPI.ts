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
    _plannerClient = new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true })
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

  async function planSteps(specBlock: SpecBlock): Promise<EvoStepPlan | null> {
    loading.value = true
    error.value = ''
    startLoading('evo:planSteps', 'Planning Evo Steps…')

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
      // Local models follow end-of-message instructions more reliably than
      // a prefix or a distant system prompt. The schema is repeated after
      // the SpecBlock so it's the last thing the model reads before generating.
      const userContent =
        `INPUT SPEC:\n${JSON.stringify(specBlock, null, 2)}\n\n` +
        `TASK: Derive 2–5 ranked Evo implementation steps from the spec above.\n` +
        `Return ONLY this JSON — no prose, no markdown, no extra keys:\n` +
        `{"steps":[{"name":"Evo 1 — Example Setup","description":"what is being implemented in this step","linkedValues":["Some Value"],"linkedSolutions":["Some Solution"],"effortPercent":25}]}`

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: EVO_PLANNER_PROMPT,
        cache_control: EVO_PLANNER_PROMPT_CACHE_CONTROL,
      }

      _callStart = Date.now()

      const response = await client.beta.messages.create({
        model: MODEL_ID,
        max_tokens: 4096,
        system: [systemBlock],
        messages: [{ role: 'user', content: userContent }],
        betas: ['prompt-caching-2024-07-31'],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('LLM response contained no text block')
      }

      const plan = parseEvoPlan(textBlock.text.trim(), specBlock)

      _callSucceeded = true
      const cacheHit = ((response.usage as Record<string, unknown>)?.cache_read_input_tokens as number ?? 0) > 0
      logLlmCall('evo-plan', Date.now() - _callStart, true, cacheHit)

      return plan
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      if (!_callSucceeded && _callStart > 0) {
        logLlmCall('evo-plan', Date.now() - _callStart, false, false)
      }
      return null
    } finally {
      loading.value = false
      stopLoading('evo:planSteps')
    }
  }

  return { loading, error, planSteps }
}
