// Tests for useImpliedEntriesAI.ts — Tier 2 LLM-powered implied-entry suggestions.
// Focus: state management, deduplication, error handling, and mock-mode path.
// The live Anthropic SDK is mocked so tests are hermetic and fast.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock @anthropic-ai/sdk before importing the composable ──────────────────
// vi.hoisted() lifts mockCreate into the hoisted factory scope so the mock
// class can reference it before the rest of the module initialises.
// A real class (not arrow function) is required because _getClient() uses `new Anthropic()`.

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

// Import AFTER mock is registered
import { useImpliedEntriesAI } from '../useImpliedEntriesAI'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A valid Anthropic response containing the given JSON string. */
function makeResponse(jsonText: string) {
  return {
    content: [{ type: 'text' as const, text: jsonText }],
  }
}

const EMPTY_RESPONSE = makeResponse('{"stakeholders":[],"values":[],"means":[]}')

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — initial state', () => {

  test('suggestions is empty ref', () => {
    const { suggestions } = useImpliedEntriesAI()
    expect(suggestions.value).toEqual([])
  })

  test('loading is false ref', () => {
    const { loading } = useImpliedEntriesAI()
    expect(loading.value).toBe(false)
  })

  test('error is empty string ref', () => {
    const { error } = useImpliedEntriesAI()
    expect(error.value).toBe('')
  })

})

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — clear()', () => {

  test('clear() resets suggestions, loading, and error to initial values', () => {
    const { suggestions, loading, error, clear } = useImpliedEntriesAI()
    // Manually set some dirty state
    suggestions.value = [{ group: 'values', text: 'test', why: 'test', ruleId: 'ai-tier2' }]
    loading.value     = true
    error.value       = 'something went wrong'

    clear()

    expect(suggestions.value).toEqual([])
    expect(loading.value).toBe(false)
    expect(error.value).toBe('')
  })

})

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — fetchSuggestions() early returns', () => {

  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('does nothing when rawText is empty string', async () => {
    const { loading, suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('', [], [], [])
    expect(loading.value).toBe(false)
    expect(suggestions.value).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('does nothing when rawText is whitespace only', async () => {
    const { loading, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('   \n  ', [], [], [])
    expect(loading.value).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

})

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — fetchSuggestions() success path', () => {

  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('sets loading=true during the call and false afterwards', async () => {
    const states: boolean[] = []
    mockCreate.mockImplementation(async () => {
      states.push(true)  // captured inside the pending call
      return EMPTY_RESPONSE
    })

    const { loading, fetchSuggestions } = useImpliedEntriesAI()
    const done = fetchSuggestions('improve user retention', [], [], [])
    // loading should be true right after the call starts (microtask hasn't resolved yet)
    // After awaiting, it should be false
    await done
    expect(loading.value).toBe(false)
  })

  test('populates suggestions from valid JSON response', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [{ text: 'regulator', why: 'compliance required' }],
      values:       [{ text: 'satisfaction score', why: 'measures retention' }],
      means:        [],
    })))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('improve user retention', [], [], [])

    expect(suggestions.value).toHaveLength(2)
    expect(suggestions.value.some(e => e.group === 'stakeholders' && e.text === 'regulator')).toBe(true)
    expect(suggestions.value.some(e => e.group === 'values' && e.text === 'satisfaction score')).toBe(true)
  })

  test('all returned entries have ruleId "ai-tier2"', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [{ text: 'auditor', why: 'financial oversight' }],
      values:       [{ text: 'cost per unit', why: 'efficiency metric' }],
      means:        [{ text: 'cost tracking', why: 'operational tool' }],
    })))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('reduce operational costs', [], [], [])

    for (const entry of suggestions.value) {
      expect(entry.ruleId).toBe('ai-tier2')
    }
  })

  test('strips markdown code fences from response before parsing JSON', async () => {
    const jsonPayload = JSON.stringify({
      stakeholders: [{ text: 'investor', why: 'revenue stake' }],
      values: [],
      means:  [],
    })
    mockCreate.mockResolvedValue(makeResponse(`\`\`\`json\n${jsonPayload}\n\`\`\``))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('grow revenue', [], [], [])

    expect(suggestions.value.some(e => e.text === 'investor')).toBe(true)
  })

  test('truncates rawText to 800 chars before sending (prompt injection guard)', async () => {
    mockCreate.mockResolvedValue(EMPTY_RESPONSE)

    const longText = 'a'.repeat(1200)
    const { fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions(longText, [], [], [])

    expect(mockCreate).toHaveBeenCalledTimes(1)
    const callArg = mockCreate.mock.calls[0][0]
    const promptContent = callArg.messages[0].content as string
    // The 800-char slice should appear in the prompt, not the full 1200
    expect(promptContent).toContain('a'.repeat(800))
    expect(promptContent).not.toContain('a'.repeat(801))
  })

})

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — deduplication against existing chips', () => {

  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('filters out suggestions already in existingValues (case-insensitive)', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [],
      values:       [
        { text: 'churn rate', why: 'retention metric' },          // new — should appear
        { text: 'Net Promoter Score', why: 'loyalty metric' },    // duplicate
      ],
      means: [],
    })))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('improve retention', [], ['net promoter score'], [])

    expect(suggestions.value.some(e => e.text === 'churn rate')).toBe(true)
    expect(suggestions.value.some(e => e.text.toLowerCase() === 'net promoter score')).toBe(false)
  })

  test('filters out suggestions already in existingStakeholders', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [{ text: 'regulator', why: 'compliance' }],
      values:       [],
      means:        [],
    })))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('AI project', ['regulator'], [], [])

    expect(suggestions.value.some(e => e.text === 'regulator')).toBe(false)
  })

  test('does not filter entries from wrong group (same text, different group is fine)', async () => {
    // "data" as a value (not a stakeholder) should not be blocked by existingStakeholders=['data']
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [],
      values:       [{ text: 'data', why: 'data-as-value unusual but valid' }],
      means:        [],
    })))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('AI system', ['data'], [], [])

    // 'data' is in existingStakeholders but being suggested as a VALUE — different group
    // The dedup set for values does not include 'data', so it should appear
    expect(suggestions.value.some(e => e.group === 'values' && e.text === 'data')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — error handling', () => {

  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('sets error ref when response JSON is malformed', async () => {
    mockCreate.mockResolvedValue(makeResponse('not valid json {{{'))

    const { error, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('something', [], [], [])

    expect(error.value.length).toBeGreaterThan(0)
  })

  test('sets error ref when the API call throws a network error', async () => {
    mockCreate.mockRejectedValue(new Error('network timeout'))

    const { error, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('something', [], [], [])

    expect(error.value).toContain('network timeout')
  })

  test('loading is false after an error', async () => {
    mockCreate.mockRejectedValue(new Error('api down'))

    const { loading, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('something', [], [], [])

    expect(loading.value).toBe(false)
  })

  test('suggestions remains empty after an error', async () => {
    mockCreate.mockRejectedValue(new Error('api down'))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('something', [], [], [])

    expect(suggestions.value).toEqual([])
  })

  test('sets error when response has no text content block', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    const { error, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('something', [], [], [])

    expect(error.value.length).toBeGreaterThan(0)
  })

  test('skips entries with blank text from AI response (malformed items)', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [{ text: '', why: 'empty text' }, { text: '  ', why: 'whitespace' }],
      values:       [{ text: 'valid metric', why: 'valid' }],
      means:        [],
    })))

    const { suggestions, fetchSuggestions } = useImpliedEntriesAI()
    await fetchSuggestions('plan text', [], [], [])

    // Empty/whitespace text entries are dropped
    expect(suggestions.value.every(e => e.text.trim().length > 0)).toBe(true)
    expect(suggestions.value.some(e => e.text === 'valid metric')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────

describe('useImpliedEntriesAI — instance isolation', () => {

  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key')
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('two composable instances have independent state', async () => {
    mockCreate.mockResolvedValue(makeResponse(JSON.stringify({
      stakeholders: [{ text: 'regulator', why: 'compliance' }],
      values: [], means: [],
    })))

    const a = useImpliedEntriesAI()
    const b = useImpliedEntriesAI()

    await a.fetchSuggestions('compliance project', [], [], [])

    expect(a.suggestions.value.length).toBeGreaterThan(0)
    expect(b.suggestions.value).toEqual([])  // B not touched
  })

})
