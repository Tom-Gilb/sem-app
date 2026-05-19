// Spec: S.Evo6.EvoStepPlannerEndpoint / S.Evo6.EvoStepPlannerTests
// Tests that useEvoPlannerAPI correctly wraps the Anthropic SDK, parses EvoStepPlan,
// and manages loading/error reactive state.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEvoPlannerAPI, _resetPlannerClientForTest } from '../useEvoPlannerAPI'
import type { SpecBlock } from '../../types/spec'

// ── Mock @anthropic-ai/sdk ────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  // Must use a real function (not arrow) so it works as a constructor with `new`
  function MockAnthropic() {
    return {
      messages: { create: mockCreate },
      beta: { messages: { create: mockCreate } },
    }
  }
  return { default: MockAnthropic }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A minimal valid SpecBlock with one F, one V, one S entry */
const VALID_SPEC_BLOCK: SpecBlock = {
  functions: [
    {
      id: 'F.EvoStepPlanner',
      type: 'Function',
      level: 'Product',
      description: 'Derive ranked Evo steps from a SpecBlock',
      presenceTest: 'Evo planner returns ≥1 ranked step for any valid SpecBlock (YES / NO)',
      functionOfValue: 'V.EvoStepPlanQuality',
    },
  ],
  values: [
    {
      id: 'V.EvoStepPlanQuality',
      type: 'Value',
      level: 'Product',
      description: 'Quality and completeness of the Evo step plan',
      scale: '% of Evo steps with valid linkedValues and linkedSolutions',
      meter: 'Automated schema validation in useEvoPlannerAPI.ts',
      status: 'pre-build',
      tolerable: '80%',
      goal: '100%',
      valueOfFunction: 'F.EvoStepPlanner',
    },
  ],
  solutions: [
    {
      id: 'S.EvoStepPlannerModule',
      type: 'Solution',
      level: 'Product',
      description: 'useEvoPlannerAPI composable implementing the Evo planner pipeline',
      impact: 'V.EvoStepPlanQuality ~100%',
      function: 'F.EvoStepPlanner',
    },
  ],
}

/** A valid EvoStepPlan JSON string as the LLM would return it (canonical plural schema) */
const VALID_PLAN_JSON = JSON.stringify({
  steps: [
    {
      name: 'S.Evo6.EvoStepPlannerBackend',
      description: 'Implement the backend composable that calls the LLM and parses EvoStepPlan.',
      linkedValues: ['V.EvoStepPlanQuality'],
      linkedSolutions: ['S.EvoStepPlannerModule'],
      effortPercent: 40,
    },
    {
      name: 'S.Evo6.EvoStepPlannerTests',
      description: 'Write Vitest unit tests covering all exit gates for the planner.',
      linkedValues: ['V.EvoStepPlanQuality'],
      linkedSolutions: ['S.EvoStepPlannerModule'],
      effortPercent: 25,
    },
  ],
})

function makeSuccessResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 50 },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useEvoPlannerAPI', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'sk-ant-test')
    // Disable mock mode so tests exercise real SDK paths
    vi.stubEnv('VITE_MOCK_MODE', '')
    mockCreate.mockReset()
    // Reset singleton so each test gets a fresh client instance
    _resetPlannerClientForTest()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    _resetPlannerClientForTest()
  })

  // ── Happy path ────────────────────────────────────────────────────────────────

  it('returns a valid EvoStepPlan on a valid API response', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — valid SpecBlock produces EvoStepPlan
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_PLAN_JSON))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).not.toBeNull()
    expect(result!.steps).toHaveLength(2)
    expect(result!.steps[0].name).toBe('S.Evo6.EvoStepPlannerBackend')
    expect(result!.steps[0].linkedValues).toContain('V.EvoStepPlanQuality')
    expect(result!.steps[0].linkedSolutions).toContain('S.EvoStepPlannerModule')
    expect(result!.steps[0].effortPercent).toBe(40)
    expect(error.value).toBe('')
  })

  it('loading is true while request is in flight, false after', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — loading reactive state
    let resolvePromise!: (v: unknown) => void
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolvePromise = res
        }),
    )

    const { planSteps, loading } = useEvoPlannerAPI()
    const planPromise = planSteps(VALID_SPEC_BLOCK)

    expect(loading.value).toBe(true)

    resolvePromise(makeSuccessResponse(VALID_PLAN_JSON))
    await planPromise

    expect(loading.value).toBe(false)
  })

  it('clears error on a subsequent successful call', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — error cleared on retry
    mockCreate.mockRejectedValueOnce(new Error('First fail'))
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_PLAN_JSON))

    const { planSteps, error } = useEvoPlannerAPI()

    await planSteps(VALID_SPEC_BLOCK)
    expect(error.value).not.toBe('')

    const result = await planSteps(VALID_SPEC_BLOCK)
    expect(result).not.toBeNull()
    expect(error.value).toBe('')
  })

  it('sends SpecBlock fields as part of user message content', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — SpecBlock serialised into user turn
    // The user content is a structured text (not pure JSON) containing the spec JSON
    // embedded in a labelled block. We verify key IDs appear in the sent content.
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_PLAN_JSON))
    const { planSteps } = useEvoPlannerAPI()

    await planSteps(VALID_SPEC_BLOCK)

    const call = mockCreate.mock.calls[0][0]
    const userMsg = call.messages[0].content as string
    expect(userMsg).toContain('F.EvoStepPlanner')
    expect(userMsg).toContain('V.EvoStepPlanQuality')
    expect(userMsg).toContain('S.EvoStepPlannerModule')
  })

  it('sends EVO_PLANNER_PROMPT as system with cache_control ephemeral', async () => {
    // Spec: V.EvoStep6.PlannerPromptCacheHit — system prompt must carry cache_control
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_PLAN_JSON))
    const { planSteps } = useEvoPlannerAPI()

    await planSteps(VALID_SPEC_BLOCK)

    const call = mockCreate.mock.calls[0][0]
    const systemBlock = call.system[0]
    expect(systemBlock.type).toBe('text')
    expect(systemBlock.cache_control).toEqual({ type: 'ephemeral' })
    expect(typeof systemBlock.text).toBe('string')
    expect(systemBlock.text.length).toBeGreaterThan(100)
  })

  // ── Legacy field migration ─────────────────────────────────────────────────────

  it('accepts legacy linkedSolution (singular) and normalises to linkedSolutions array', async () => {
    // Confirms the migration shim: old LLM output with singular linkedSolution field
    // is silently promoted to the canonical linkedSolutions: string[] array.
    const legacyPlanJson = JSON.stringify({
      steps: [
        {
          name: 'S.Evo1.Legacy',
          description: 'A step from an old LLM response using the deprecated singular field.',
          linkedValues: ['V.EvoStepPlanQuality'],
          linkedSolution: 'S.EvoStepPlannerModule', // legacy — singular
          effortPercent: 30,
        },
      ],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(legacyPlanJson))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).not.toBeNull()
    expect(result!.steps[0].linkedSolutions).toEqual(['S.EvoStepPlannerModule'])
    expect(error.value).toBe('')
  })

  // ── Mock mode ─────────────────────────────────────────────────────────────────

  it('mock mode returns 3 hardcoded steps without calling the API', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — VITE_MOCK_MODE=true skips API call
    vi.stubEnv('VITE_MOCK_MODE', 'true')
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(mockCreate).not.toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.steps).toHaveLength(3)
    expect(result!.steps[0].linkedValues.length).toBeGreaterThanOrEqual(1)
    expect(result!.steps[0].linkedSolutions.length).toBeGreaterThanOrEqual(1)
    expect(error.value).toBe('')
  })

  // ── Error paths ────────────────────────────────────────────────────────────────

  it('sets error and returns null on network failure', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — error state on API failure
    mockCreate.mockRejectedValueOnce(new Error('Network error'))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toContain('Network error')
  })

  it('sets error and returns null when response is not valid JSON', async () => {
    // Spec: S.Evo6.EvoStepPlannerTests — malformed JSON → error
    mockCreate.mockResolvedValueOnce(makeSuccessResponse('not json at all'))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/not valid JSON/)
  })

  it('sets error and returns null when SpecBlock has no S entries', async () => {
    // Spec: S.Evo6.EvoStepPlannerTests — missing S. entries → error
    const noSolutions: SpecBlock = { ...VALID_SPEC_BLOCK, solutions: [] }
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(noSolutions)

    expect(result).toBeNull()
    expect(error.value).toMatch(/Solution/)
  })

  it('sets error and returns null when LLM returns an empty steps array', async () => {
    // Spec: S.Evo6.EvoStepPlannerTests — empty steps array → error
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(JSON.stringify({ steps: [] })))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/empty/)
  })

  it('sets error and returns null when a step has no linkedValues', async () => {
    // Spec: S.Evo6.EvoStepPlannerTests — step missing linkedValues → error
    const missingLinkedValues = JSON.stringify({
      steps: [
        {
          name: 'S.Evo6.BadStep',
          description: 'A step with no linked values',
          linkedValues: [],
          linkedSolutions: ['S.EvoStepPlannerModule'],
          effortPercent: 30,
        },
      ],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(missingLinkedValues))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/linkedValues/)
  })

  it('sets error and returns null when a step has no linkedSolutions', async () => {
    // Spec: S.Evo6.EvoStepPlannerTests — step missing linkedSolutions → error
    const missingLinkedSolutions = JSON.stringify({
      steps: [
        {
          name: 'S.Evo6.BadStep',
          description: 'A step with no linked solution',
          linkedValues: ['V.EvoStepPlanQuality'],
          linkedSolutions: [],
          effortPercent: 30,
        },
      ],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(missingLinkedSolutions))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/linkedSolutions/)
  })

  it('sets error and returns null on authentication failure', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — API auth errors must surface in error ref.
    // Note: import.meta.env.VITE_ANTHROPIC_API_KEY is baked by vite-node at module load
    // and cannot be overridden via vi.stubEnv inside a running test. We simulate the
    // equivalent scenario by having the SDK throw an auth-style error.
    mockCreate.mockRejectedValueOnce(new Error('VITE_ANTHROPIC_API_KEY invalid or missing'))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/VITE_ANTHROPIC_API_KEY/)
  })

  it('sets error and returns null when LLM response contains no text block', async () => {
    // Spec: S.Evo6.EvoStepPlannerEndpoint — non-text response must produce a clear error
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'tu1', name: 'fn', input: {} }],
      usage: {},
    })
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/no text block/)
  })

  it('sets error and returns null when LLM response is missing required steps array', async () => {
    // Spec: S.Evo6.EvoStepPlannerTests — missing steps key → error
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(JSON.stringify({ notSteps: [] })))
    const { planSteps, error } = useEvoPlannerAPI()

    const result = await planSteps(VALID_SPEC_BLOCK)

    expect(result).toBeNull()
    expect(error.value).toMatch(/missing required array/)
  })
})
