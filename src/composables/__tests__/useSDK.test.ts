// Spec: S.EvoStep2.PipelineHandler / V.EvoStep2.TranslationExitGate
// Tests that useSDK correctly wraps the Anthropic SDK, parses SpecBlock,
// and manages loading/error reactive state.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSDK, _resetClientForTest } from '../useSDK'

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

const VALID_SPEC_JSON = JSON.stringify({
  functions: [
    {
      id: 'F.OnboardingChecklist',
      type: 'Function',
      level: 'Product',
      description: 'Guide new users',
      successCriteria: '>=80%',
      functionOfValue: 'V.OnboardingSpeed',
    },
  ],
  values: [
    {
      id: 'V.OnboardingSpeed',
      type: 'Value',
      level: 'Product',
      description: 'Speed at which users reach first value',
      scale: '% of users in <2 min',
      meter: 'Funnel analytics',
      status: 'pre-build',
      tolerable: '60%',
      goal: '80%',
      valueOfFunction: 'F.OnboardingChecklist',
    },
  ],
  solutions: [
    {
      id: 'S.ProgressiveDisclosure',
      type: 'Solution',
      level: 'Product',
      description: 'Progressive disclosure checklist',
      impact: 'V.OnboardingSpeed ~80%',
      function: 'F.OnboardingChecklist',
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

describe('useSDK', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'sk-ant-test')
    // Disable mock mode so tests exercise real SDK paths, not the demo fallback
    vi.stubEnv('VITE_MOCK_MODE', '')
    mockCreate.mockReset()
    // Reset singleton so each test gets a fresh client instance
    _resetClientForTest()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    _resetClientForTest()
  })

  it('returns a SpecBlock on valid API response', async () => {
    // Spec: V.EvoStep2.TranslationExitGate — valid input produces F+V+S entries
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_SPEC_JSON))
    const { translate, error } = useSDK()

    const result = await translate('Product team', 'Faster onboarding', 'Progressive checklist')

    expect(result).not.toBeNull()
    expect(result!.functions).toHaveLength(1)
    expect(result!.values).toHaveLength(1)
    expect(result!.solutions).toHaveLength(1)
    expect(error.value).toBe('')
  })

  it('loading is true while request is in flight, false after', async () => {
    // Spec: S.EvoStep2.PipelineHandler — loading reactive state
    let resolvePromise!: (v: unknown) => void
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolvePromise = res
        }),
    )

    const { translate, loading } = useSDK()
    const translatePromise = translate('S', 'E', 'M')

    expect(loading.value).toBe(true)

    resolvePromise(makeSuccessResponse(VALID_SPEC_JSON))
    await translatePromise

    expect(loading.value).toBe(false)
  })

  it('sets error and returns null on network failure', async () => {
    // Spec: S.EvoStep2.PipelineHandler — error state on API failure
    mockCreate.mockRejectedValueOnce(new Error('Network error'))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toContain('Network error')
  })

  it('sets error and returns null when response is not valid JSON', async () => {
    // Spec: S.EvoStep2.PipelineHandler — parse error handling
    mockCreate.mockResolvedValueOnce(makeSuccessResponse('not json at all'))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/not valid JSON/)
  })

  it('sets error and returns null when V entry is missing measurement fields', async () => {
    // Spec: V.EvoStep2.TranslationExitGate — V entries must have scale/meter/status/tolerable/goal
    const incompleteSpec = JSON.stringify({
      functions: [{ id: 'F.X', type: 'Function', level: 'Product', description: 'd', successCriteria: 'c', functionOfValue: 'V.X' }],
      values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'd', scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: 'F.X' }],
      solutions: [{ id: 'S.X', type: 'Solution', level: 'Product', description: 'd', impact: 'V.X ~50%', function: 'F.X' }],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(incompleteSpec))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/missing required measurement fields/)
  })

  it('sets error and returns null when spec has no F entries', async () => {
    const noF = JSON.stringify({ functions: [], values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'd', scale: 's', meter: 'm', status: 'pre', tolerable: '60%', goal: '80%', valueOfFunction: 'F.X' }], solutions: [{ id: 'S.X', type: 'Solution', level: 'Product', description: 'd', impact: 'x', function: 'F.X' }] })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(noF))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/no F/)
  })

  it('clears error on a subsequent successful call', async () => {
    // Spec: S.EvoStep2.PipelineHandler — error cleared on retry
    mockCreate.mockRejectedValueOnce(new Error('First fail'))
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_SPEC_JSON))

    const { translate, error } = useSDK()

    await translate('S', 'E', 'M')
    expect(error.value).not.toBe('')

    const result = await translate('S', 'E', 'M')
    expect(result).not.toBeNull()
    expect(error.value).toBe('')
  })

  it('sends user content with stakes/ends/means labels', async () => {
    // Spec: S.EvoStep2.PipelineHandler — correct user message format
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(VALID_SPEC_JSON))
    const { translate } = useSDK()

    await translate('StakesValue', 'EndsValue', 'MeansValue')

    const call = mockCreate.mock.calls[0][0]
    const userMsg = call.messages[0].content as string
    expect(userMsg).toContain('Stakes: StakesValue')
    expect(userMsg).toContain('Ends: EndsValue')
    expect(userMsg).toContain('Means: MeansValue')
  })

  // ── VATester gap tests ────────────────────────────────────────────────────────

  it('sets error and returns null when VITE_ANTHROPIC_API_KEY is not set', async () => {
    // Spec: S.EvoStep2.PipelineHandler — missing API key must produce a clear error
    // Coverage: line 23 — getClient() throw path when apiKey is falsy
    // Stub Ollama vars to '' so isLocal=false and the API key guard fires
    vi.stubEnv('VITE_OLLAMA_MODEL', '')
    vi.stubEnv('VITE_OLLAMA_BASE_URL', '')
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '')
    _resetClientForTest()
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/VITE_ANTHROPIC_API_KEY/)
  })

  it('sets error and returns null when LLM response is missing required arrays', async () => {
    // Spec: S.EvoStep2.PipelineHandler — malformed JSON object (not arrays) must fail validation
    // Coverage: line 55 — parseSpecBlock branch: missing functions/values/solutions arrays
    const malformed = JSON.stringify({ notFunctions: [], notValues: [], notSolutions: [] })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(malformed))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/missing required arrays/)
  })

  it('sets error and returns null when spec has no V entries', async () => {
    // Spec: V.EvoStep2.TranslationExitGate — spec must have ≥1 V entry
    // Coverage: line 61 — empty values array
    const noV = JSON.stringify({
      functions: [{ id: 'F.X', type: 'Function', level: 'Product', description: 'd', successCriteria: 'c', functionOfValue: 'V.X' }],
      values: [],
      solutions: [{ id: 'S.X', type: 'Solution', level: 'Product', description: 'd', impact: 'x', function: 'F.X' }],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(noV))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/no V/)
  })

  it('sets error and returns null when spec has no S entries', async () => {
    // Spec: V.EvoStep2.TranslationExitGate — spec must have ≥1 S entry
    // Coverage: line 64 — empty solutions array
    const noS = JSON.stringify({
      functions: [{ id: 'F.X', type: 'Function', level: 'Product', description: 'd', successCriteria: 'c', functionOfValue: 'V.X' }],
      values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'd', scale: 's', meter: 'm', status: 'pre', tolerable: '60%', goal: '80%', valueOfFunction: 'F.X' }],
      solutions: [],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(noS))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/no S/)
  })

  it('sets error and returns null when LLM response contains no text block', async () => {
    // Spec: S.EvoStep2.PipelineHandler — non-text response must produce a clear error
    // Coverage: line 136 — response.content has no text-type block
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'tu1', name: 'fn', input: {} }], usage: {} })
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).toBeNull()
    expect(error.value).toMatch(/no text block/)
  })
})
