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
      presenceTest: '>=80%',
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

  it('returns spec with empty strings when V entry has missing measurement fields (lenient coercion)', async () => {
    // parseSpecBlock intentionally coerces missing/empty V measurement fields to ''
    // rather than rejecting (see useSDK.ts: "Coerce missing V measurement fields to ''
    // rather than rejecting the whole response. The user can fill gaps via Sharpen.")
    const incompleteSpec = JSON.stringify({
      functions: [{ id: 'F.X', type: 'Function', level: 'Product', description: 'd', presenceTest: 'c', functionOfValue: 'V.X' }],
      values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'd', scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: 'F.X' }],
      solutions: [{ id: 'S.X', type: 'Solution', level: 'Product', description: 'd', impact: 'V.X ~50%', function: 'F.X' }],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(incompleteSpec))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).not.toBeNull()
    expect(result!.values[0].scale).toBe('')
    expect(error.value).toBe('')
  })

  it('returns spec when functions array is empty (lenient validation)', async () => {
    // parseSpecBlock intentionally accepts empty F/V/S arrays to support
    // constraint-only or partial inputs (see useSDK.ts: "F, V, and S may all be
    // empty for constraint-only or value-only inputs — do not reject.")
    const noF = JSON.stringify({ functions: [], values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'd', scale: 's', meter: 'm', status: 'pre', tolerable: '60%', goal: '80%', valueOfFunction: 'F.X' }], solutions: [{ id: 'S.X', type: 'Solution', level: 'Product', description: 'd', impact: 'x', function: 'F.X' }] })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(noF))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).not.toBeNull()
    expect(result!.functions).toHaveLength(0)
    expect(error.value).toBe('')
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

  it('returns spec when values array is empty (lenient validation)', async () => {
    // parseSpecBlock intentionally accepts empty arrays — empty values supports
    // constraint-only or function-only partial inputs (intentional lenient coercion)
    const noV = JSON.stringify({
      functions: [{ id: 'F.X', type: 'Function', level: 'Product', description: 'd', presenceTest: 'c', functionOfValue: 'V.X' }],
      values: [],
      solutions: [{ id: 'S.X', type: 'Solution', level: 'Product', description: 'd', impact: 'x', function: 'F.X' }],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(noV))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).not.toBeNull()
    expect(result!.values).toHaveLength(0)
    expect(error.value).toBe('')
  })

  it('returns spec when solutions array is empty (lenient validation)', async () => {
    // parseSpecBlock intentionally accepts empty arrays — empty solutions supports
    // partial inputs where the user has not yet specified means (intentional lenient coercion)
    const noS = JSON.stringify({
      functions: [{ id: 'F.X', type: 'Function', level: 'Product', description: 'd', presenceTest: 'c', functionOfValue: 'V.X' }],
      values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'd', scale: 's', meter: 'm', status: 'pre', tolerable: '60%', goal: '80%', valueOfFunction: 'F.X' }],
      solutions: [],
    })
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(noS))
    const { translate, error } = useSDK()

    const result = await translate('S', 'E', 'M')

    expect(result).not.toBeNull()
    expect(result!.solutions).toHaveLength(0)
    expect(error.value).toBe('')
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

// ── r41 v369 — translateStream coverage ─────────────────────────────────────
// Tom Gilb 2026-06-25 post-demo "id like to get the r time incr count during
// generating done".  The v355 in-PWA diagnostic confirmed the production
// stream was producing zero text in Tom's Safari PWA.  These tests mock the
// SDK's `beta.messages.stream()` to assert that onChunk fires for every
// text_delta event AND that the fullText accumulator builds up correctly.

const mockStream = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: { create: mockCreate, stream: mockStream },
      beta:     { messages: { create: mockCreate, stream: mockStream } },
    }
  }
  return { default: MockAnthropic }
})

/** Build a mock stream (async-iterable) that yields text_delta events.
 *  v370: returns a plain async-iterable matching `messages.create({stream:true})`
 *  output shape — no `finalMessage()` method needed (stop_reason comes via
 *  `message_delta` events). */
function makeMockStream(chunks: string[], stopReason: string = 'end_turn') {
  const events: Array<{ type: string; delta?: { type: string; text?: string; stop_reason?: string } }> = []
  for (const c of chunks) {
    events.push({ type: 'content_block_delta', delta: { type: 'text_delta', text: c } })
  }
  events.push({ type: 'message_delta', delta: { stop_reason: stopReason } as { stop_reason: string } })
  events.push({ type: 'message_stop' })

  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        next: async () => {
          if (i >= events.length) return { value: undefined, done: true }
          return { value: events[i++], done: false }
        },
      } as AsyncIterator<unknown>
    },
  }
}

describe('useSDK.translateStream', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'sk-ant-test')
    vi.stubEnv('VITE_MOCK_MODE', '')
    mockCreate.mockReset()
    mockStream.mockReset()
    _resetClientForTest()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    _resetClientForTest()
  })

  it('fires onChunk for every text_delta event', async () => {
    const chunks = ['{"functions":[', '{"id":"F.A","type":"Function"', '}]}']
    mockCreate.mockResolvedValueOnce(makeMockStream([...chunks, JSON.stringify({ values: [], solutions: [] }).slice(1)]))

    const { translateStream } = useSDK()
    const received: string[] = []
    await translateStream('S', 'E', 'M', (delta) => { received.push(delta) })

    expect(received.length).toBeGreaterThan(0)
    expect(received.join('').length).toBeGreaterThan(0)
  })

  it('accumulates fullText and parses the final spec', async () => {
    const validJson = '{"functions":[{"id":"F.Speed","type":"Function","level":"Product","description":"go fast"}],"values":[],"solutions":[]}'
    // Split JSON into 4 chunks
    const mid1 = Math.floor(validJson.length / 4)
    const mid2 = Math.floor(validJson.length / 2)
    const mid3 = Math.floor(validJson.length * 3 / 4)
    const chunks = [
      validJson.slice(0, mid1),
      validJson.slice(mid1, mid2),
      validJson.slice(mid2, mid3),
      validJson.slice(mid3),
    ]
    mockCreate.mockResolvedValueOnce(makeMockStream(chunks))

    const { translateStream } = useSDK()
    const received: string[] = []
    const result = await translateStream('S', 'E', 'M', (delta) => { received.push(delta) })

    expect(result).not.toBeNull()
    expect(result!.functions).toHaveLength(1)
    expect(received.join('')).toBe(validJson)
  })

  it('throws on max_tokens stop reason', async () => {
    const incompleteJson = '{"functions":[{"id":"F.A"'  // mid-entry cutoff
    mockCreate.mockResolvedValueOnce(makeMockStream([incompleteJson], 'max_tokens'))

    const { translateStream, error } = useSDK()
    const result = await translateStream('S', 'E', 'M', () => { /* noop */ })

    expect(result).toBeNull()
    expect(error.value).toMatch(/cut off|max_tokens/i)
  })

  it('ignores non-text-delta events (e.g. message_start, content_block_start)', async () => {
    const events = [
      { type: 'message_start' },
      { type: 'content_block_start' },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: '{"functions":[' } },
      { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: 'should-be-ignored' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: '],"values":[],"solutions":[]}' } },
      { type: 'message_stop' },
    ]
    const stream = {
      [Symbol.asyncIterator]() {
        let i = 0
        return {
          next: async () => {
            if (i >= events.length) return { value: undefined, done: true }
            return { value: events[i++], done: false }
          },
        } as AsyncIterator<unknown>
      },
    }
    mockCreate.mockResolvedValueOnce(stream)

    const { translateStream } = useSDK()
    const received: string[] = []
    await translateStream('S', 'E', 'M', (delta) => { received.push(delta) })

    expect(received).toEqual(['{"functions":[', '],"values":[],"solutions":[]}'])
    expect(received.join('')).not.toContain('should-be-ignored')
  })
})
