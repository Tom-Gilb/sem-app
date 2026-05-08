// UNIT_TYPE=Hook
// useEvoPlannerAPI — Anthropic SDK composable for Evo Step Planner pipeline
// Spec: S.Evo6.EvoStepPlannerEndpoint / 3P.V.LLMResponseReliability

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
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
    if (!apiKey) {
      throw new Error('VITE_ANTHROPIC_API_KEY is not set — configure this environment variable to enable the Evo planner pipeline')
    }
    _plannerClient = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
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
  const firstSolution = specBlock.solutions[0]?.id ?? 'S.MockSolution'
  const firstValue = specBlock.values[0]?.id ?? 'V.MockValue'
  const secondValue = specBlock.values[1]?.id ?? firstValue

  return {
    steps: [
      {
        name: `S.Evo1.${firstSolution.replace(/^S\./, '')}Config`,
        description: `Set up foundational configuration and scaffolding for ${firstSolution} — delivering the base structure that all subsequent steps build upon.`,
        linkedValues: [firstValue],
        linkedSolution: firstSolution,
        effortPercent: 20,
      },
      {
        name: `S.Evo2.${firstSolution.replace(/^S\./, '')}Core`,
        description: `Implement the core logic of ${firstSolution}, wiring it to the application and validating against the primary value targets.`,
        linkedValues: [firstValue, secondValue],
        linkedSolution: firstSolution,
        effortPercent: 45,
      },
      {
        name: `S.Evo3.${firstSolution.replace(/^S\./, '')}Tests`,
        description: `Write unit and integration tests for ${firstSolution}, ensuring all exit gates for linked values can be measured and verified.`,
        linkedValues: [firstValue],
        linkedSolution: firstSolution,
        effortPercent: 35,
      },
    ],
  }
}

/**
 * Parses the raw JSON string returned by the LLM into a validated EvoStepPlan.
 * Throws a descriptive error if the structure does not match the output contract.
 */
function parseEvoPlan(raw: string): EvoStepPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`LLM response is not valid JSON:\n${raw.slice(0, 300)}`)
  }

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.steps)) {
    throw new Error('LLM response is missing required array: steps')
  }
  if (obj.steps.length === 0) {
    throw new Error('LLM response has no Evo steps (steps array is empty)')
  }

  for (const step of obj.steps as Array<Record<string, unknown>>) {
    if (!Array.isArray(step.linkedValues) || step.linkedValues.length === 0) {
      throw new Error(
        `Evo step "${step.name ?? '?'}" is missing required linkedValues (must have ≥1 V. entry ID)`,
      )
    }
    if (typeof step.linkedSolution !== 'string' || step.linkedSolution.trim() === '') {
      throw new Error(
        `Evo step "${step.name ?? '?'}" is missing required linkedSolution (must be a non-empty S. entry ID)`,
      )
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
      const userContent = JSON.stringify(specBlock, null, 2)

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: EVO_PLANNER_PROMPT,
        cache_control: EVO_PLANNER_PROMPT_CACHE_CONTROL,
      }

      _callStart = Date.now()

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

      const plan = parseEvoPlan(textBlock.text.trim())

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
