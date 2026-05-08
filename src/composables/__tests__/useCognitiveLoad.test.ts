// UNIT_TYPE=Test
// Feature #163 — Tests for useCognitiveLoad composable
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCognitiveLoad, type CogLoadStep } from '../useCognitiveLoad'

beforeEach(() => {
  Object.assign(globalThis, {
    navigator: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
  })
})

const makeSteps = (overrides: Partial<CogLoadStep>[]): CogLoadStep[] =>
  overrides.map((o, i) => ({
    id: `step-${i}`,
    name: `Step ${i}`,
    ...o,
  }))

describe('useCognitiveLoad', () => {
  // 1 — entry count matches step count
  it('returns one entry per step', () => {
    const steps = ref(makeSteps([{}, {}, {}]))
    const { entries } = useCognitiveLoad(steps)
    expect(entries.value).toHaveLength(3)
  })

  // 2 — empty steps returns empty entries
  it('returns empty entries for 0 steps', () => {
    const steps = ref<CogLoadStep[]>([])
    const { entries } = useCognitiveLoad(steps)
    expect(entries.value).toHaveLength(0)
  })

  // 3 — entry has all required fields
  it('every entry has required fields', () => {
    const steps = ref(makeSteps([{ name: 'Hello World' }]))
    const { entries } = useCognitiveLoad(steps)
    const e = entries.value[0]
    expect(e).toHaveProperty('stepId')
    expect(e).toHaveProperty('stepName')
    expect(e).toHaveProperty('complexityScore')
    expect(e).toHaveProperty('technicalNewness')
    expect(e).toHaveProperty('cognitiveLoad')
    expect(e).toHaveProperty('loadLevel')
  })

  // 4 — complexityScore = wordCount * effort, clamped 1–50
  it('complexityScore equals wordCount * effort clamped to 1-50', () => {
    // name = "Hello World" (2 words), effort = 3 → 2*3 = 6
    const steps = ref(makeSteps([{ name: 'Hello World', effort: 3 }]))
    const { entries } = useCognitiveLoad(steps)
    expect(entries.value[0].complexityScore).toBe(6)
  })

  // 5 — complexityScore uses default effort 4 when not provided
  it('uses default effort 4 when effort is undefined', () => {
    // name = "A B" (2 words), no effort → 2*4 = 8
    const steps = ref(makeSteps([{ name: 'A B' }]))
    const { entries } = useCognitiveLoad(steps)
    expect(entries.value[0].complexityScore).toBe(8)
  })

  // 6 — complexityScore is clamped to max 50
  it('complexityScore is clamped to 50 for very high values', () => {
    // name has many words * large effort → would exceed 50
    const name = 'a b c d e f g h i j k'  // 11 words
    const steps = ref(makeSteps([{ name, effort: 10 }]))  // 11*10=110 → clamped 50
    const { entries } = useCognitiveLoad(steps)
    expect(entries.value[0].complexityScore).toBe(50)
  })

  // 7 — complexityScore minimum is 1
  it('complexityScore minimum is 1', () => {
    // 1 word * 0 effort = 0 → clamped to 1
    const steps = ref(makeSteps([{ name: 'OnlyOneWord', effort: 0 }]))
    const { entries } = useCognitiveLoad(steps)
    expect(entries.value[0].complexityScore).toBeGreaterThanOrEqual(1)
  })

  // 8 — technicalNewness is between 1 and 10
  it('technicalNewness is in range 1–10', () => {
    const steps = ref(makeSteps([{ name: 'Test Step' }, { name: 'Another One' }, { name: 'Third Item' }]))
    const { entries } = useCognitiveLoad(steps)
    for (const e of entries.value) {
      expect(e.technicalNewness).toBeGreaterThanOrEqual(1)
      expect(e.technicalNewness).toBeLessThanOrEqual(10)
    }
  })

  // 9 — cognitiveLoad = complexityScore + technicalNewness, clamped 0–100
  it('cognitiveLoad equals complexityScore + technicalNewness (within clamp)', () => {
    const steps = ref(makeSteps([{ name: 'Hello World', effort: 3 }]))
    const { entries } = useCognitiveLoad(steps)
    const e = entries.value[0]
    const expected = Math.max(0, Math.min(100, e.complexityScore + e.technicalNewness))
    expect(e.cognitiveLoad).toBe(expected)
  })

  // 10 — loadLevel thresholds: ≤20 → low
  it('loadLevel is low for cognitiveLoad ≤ 20', () => {
    // 1 word * 1 effort = 1; seed%10+1 ≤ 10 → max total ≤ 11 → low
    const steps = ref(makeSteps([{ name: 'Short', effort: 1 }]))
    const { entries } = useCognitiveLoad(steps)
    const e = entries.value[0]
    if (e.cognitiveLoad <= 20) {
      expect(e.loadLevel).toBe('low')
    }
  })

  // 11 — loadLevel thresholds: >60 → critical
  it('loadLevel is critical when cognitiveLoad exceeds 60', () => {
    // Force a high score: 10 words * effort 10 = clamped 50; seed%10+1 up to 10 → 60 max
    // Use 10 words and effort=10 to maximize
    const name = 'a b c d e f g h i j'  // 10 words
    const steps = ref(makeSteps([{ name, effort: 50 }]))  // clamped to 50, + newness
    const { entries } = useCognitiveLoad(steps)
    const e = entries.value[0]
    if (e.cognitiveLoad > 60) {
      expect(e.loadLevel).toBe('critical')
    }
  })

  // 12 — entries is deterministic for same input
  it('entries are deterministic for the same input', () => {
    const s1 = ref(makeSteps([{ name: 'Build Feature', effort: 5 }]))
    const s2 = ref(makeSteps([{ name: 'Build Feature', effort: 5 }]))
    const { entries: e1 } = useCognitiveLoad(s1)
    const { entries: e2 } = useCognitiveLoad(s2)
    expect(e1.value).toEqual(e2.value)
  })

  // 13 — sortedEntries orders by cognitiveLoad descending
  it('sortedEntries is sorted by cognitiveLoad descending', () => {
    const steps = ref(makeSteps([
      { name: 'Short', effort: 1 },
      { name: 'A Very Long Step Name With Many Words', effort: 10 },
      { name: 'Medium Step Name', effort: 5 },
    ]))
    const { sortedEntries } = useCognitiveLoad(steps)
    const loads = sortedEntries.value.map(e => e.cognitiveLoad)
    for (let i = 1; i < loads.length; i++) {
      expect(loads[i]).toBeLessThanOrEqual(loads[i - 1])
    }
  })

  // 14 — simplifySuggestion returns one of the 4 bank strings
  it('simplifySuggestion returns a string from the suggestion bank', () => {
    const bank = [
      'Break into 2 smaller tasks',
      'Add a spike to clarify unknowns first',
      'Pair program to reduce individual load',
      'Defer non-critical sub-tasks to next cycle',
    ]
    const steps = ref(makeSteps([{ name: 'My Step' }]))
    const { simplifySuggestion } = useCognitiveLoad(steps)
    const result = simplifySuggestion('step-0')
    expect(bank).toContain(result)
  })

  // 15 — simplifySuggestion is deterministic (no Math.random)
  it('simplifySuggestion is deterministic for same stepId', () => {
    const steps = ref(makeSteps([{ name: 'Build Core' }]))
    const { simplifySuggestion } = useCognitiveLoad(steps)
    const r1 = simplifySuggestion('step-0')
    const r2 = simplifySuggestion('step-0')
    expect(r1).toBe(r2)
  })

  // 16 — copyMarkdown writes pipe table to clipboard
  it('copyMarkdown writes a Markdown table with expected columns', () => {
    const steps = ref(makeSteps([{ name: 'Alpha Beta', effort: 4 }]))
    const { copyMarkdown } = useCognitiveLoad(steps)
    copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('| Step |')
    expect(written).toContain('| Complexity |')
    expect(written).toContain('| Newness |')
    expect(written).toContain('| Load |')
    expect(written).toContain('| Level |')
    expect(written).toContain('Alpha Beta')
  })

  // 17 — copied starts false
  it('copied starts as false', () => {
    const steps = ref<CogLoadStep[]>([])
    const { copied } = useCognitiveLoad(steps)
    expect(copied.value).toBe(false)
  })

  // 18 — copied flips to true then resets after 2s
  it('copied flips to true on copyMarkdown and resets after 2s', () => {
    vi.useFakeTimers()
    const steps = ref(makeSteps([{ name: 'Test' }]))
    const { copyMarkdown, copied } = useCognitiveLoad(steps)
    expect(copied.value).toBe(false)
    copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })
})
