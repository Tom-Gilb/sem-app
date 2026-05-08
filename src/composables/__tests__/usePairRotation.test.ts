// UNIT_TYPE=Test
// Feature #160 — Tests for usePairRotation composable
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { usePairRotation, type PairRotationStep } from '../usePairRotation'

beforeEach(() => {
  Object.assign(globalThis, {
    navigator: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
  })
})

const makeSteps = (names: string[]): PairRotationStep[] =>
  names.map((name, i) => ({ id: `step-${i}`, name }))

describe('usePairRotation', () => {
  // 1 — empty steps produces no pairs
  it('returns empty allPairs for 0 steps', () => {
    const steps = ref<PairRotationStep[]>([])
    const { allPairs } = usePairRotation(steps)
    expect(allPairs.value).toHaveLength(0)
  })

  // 2 — single step produces no pairs
  it('returns empty allPairs for 1 step', () => {
    const steps = ref(makeSteps(['Alpha']))
    const { allPairs } = usePairRotation(steps)
    expect(allPairs.value).toHaveLength(0)
  })

  // 3 — N=2 produces exactly 1 pair
  it('returns 1 pair for 2 steps', () => {
    const steps = ref(makeSteps(['Alpha', 'Beta']))
    const { allPairs } = usePairRotation(steps)
    expect(allPairs.value).toHaveLength(1)
  })

  // 4 — N=3 produces 3 pairs (combinations: 3*2/2)
  it('returns 3 pairs for 3 steps', () => {
    const steps = ref(makeSteps(['Alpha', 'Beta', 'Gamma']))
    const { allPairs } = usePairRotation(steps)
    expect(allPairs.value).toHaveLength(3)
  })

  // 5 — N=4 produces 6 pairs
  it('returns 6 pairs for 4 steps', () => {
    const steps = ref(makeSteps(['A', 'B', 'C', 'D']))
    const { allPairs } = usePairRotation(steps)
    expect(allPairs.value).toHaveLength(6)
  })

  // 6 — every pair has pairCount = 1
  it('every PairRecord starts with pairCount 1', () => {
    const steps = ref(makeSteps(['X', 'Y', 'Z']))
    const { allPairs } = usePairRotation(steps)
    for (const pair of allPairs.value) {
      expect(pair.pairCount).toBe(1)
    }
  })

  // 7 — lastPairedIdx equals the lower step index (i in the outer loop)
  it('lastPairedIdx equals the lower-index step position', () => {
    const steps = ref(makeSteps(['X', 'Y', 'Z']))
    const { allPairs } = usePairRotation(steps)
    // (X=0,Y=1) → lastPairedIdx=0; (X=0,Z=2) → lastPairedIdx=0; (Y=1,Z=2) → lastPairedIdx=1
    expect(allPairs.value[0].lastPairedIdx).toBe(0)
    expect(allPairs.value[1].lastPairedIdx).toBe(0)
    expect(allPairs.value[2].lastPairedIdx).toBe(1)
  })

  // 8 — nextRotation returns at most 3 entries
  it('nextRotation returns at most 3 pairs', () => {
    const steps = ref(makeSteps(['A', 'B', 'C', 'D', 'E']))
    const { nextRotation } = usePairRotation(steps)
    expect(nextRotation.value.length).toBeLessThanOrEqual(3)
  })

  // 9 — nextRotation returns all pairs when < 3 total
  it('nextRotation returns all pairs when fewer than 3 exist', () => {
    const steps = ref(makeSteps(['A', 'B']))
    const { allPairs, nextRotation } = usePairRotation(steps)
    expect(nextRotation.value).toHaveLength(allPairs.value.length)
  })

  // 10 — pairDebt has one entry per step
  it('pairDebt has one entry per step', () => {
    const steps = ref(makeSteps(['A', 'B', 'C']))
    const { pairDebt } = usePairRotation(steps)
    expect(pairDebt.value).toHaveLength(3)
  })

  // 11 — empty steps pairDebt is empty
  it('pairDebt is empty for 0 steps', () => {
    const steps = ref<PairRotationStep[]>([])
    const { pairDebt } = usePairRotation(steps)
    expect(pairDebt.value).toHaveLength(0)
  })

  // 12 — top 2 entries in pairDebt are marked leastRecentlyPaired
  it('marks exactly 2 entries as leastRecentlyPaired when ≥2 steps', () => {
    const steps = ref(makeSteps(['A', 'B', 'C', 'D']))
    const { pairDebt } = usePairRotation(steps)
    const marked = pairDebt.value.filter(d => d.leastRecentlyPaired)
    expect(marked).toHaveLength(2)
  })

  // 13 — only 1 entry marked leastRecentlyPaired for 1 step
  it('marks exactly 1 entry leastRecentlyPaired for 1 step', () => {
    const steps = ref(makeSteps(['OnlyStep']))
    const { pairDebt } = usePairRotation(steps)
    const marked = pairDebt.value.filter(d => d.leastRecentlyPaired)
    expect(marked).toHaveLength(1)
  })

  // 14 — allPairs is deterministic
  it('allPairs is deterministic for same input', () => {
    const s1 = ref(makeSteps(['Build', 'Test', 'Deploy']))
    const s2 = ref(makeSteps(['Build', 'Test', 'Deploy']))
    const { allPairs: p1 } = usePairRotation(s1)
    const { allPairs: p2 } = usePairRotation(s2)
    expect(p1.value).toEqual(p2.value)
  })

  // 15 — PairRecord has all required fields
  it('every PairRecord has required fields', () => {
    const steps = ref(makeSteps(['Alpha', 'Beta']))
    const { allPairs } = usePairRotation(steps)
    const pair = allPairs.value[0]
    expect(pair).toHaveProperty('stepA')
    expect(pair).toHaveProperty('stepB')
    expect(pair).toHaveProperty('stepAName')
    expect(pair).toHaveProperty('stepBName')
    expect(pair).toHaveProperty('pairCount')
    expect(pair).toHaveProperty('lastPairedIdx')
  })

  // 16 — copyMarkdown puts expected markdown content in clipboard
  it('copyMarkdown writes a Markdown table with Step A / Step B / Count columns', () => {
    const steps = ref(makeSteps(['Alpha', 'Beta']))
    const { copyMarkdown } = usePairRotation(steps)
    copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('| Step A |')
    expect(written).toContain('| Step B |')
    expect(written).toContain('| Count |')
    expect(written).toContain('Alpha')
    expect(written).toContain('Beta')
  })

  // 17 — copyMarkdown includes Pair Debt section
  it('copyMarkdown includes a Pair Debt section', () => {
    const steps = ref(makeSteps(['Alpha', 'Beta', 'Gamma']))
    const { copyMarkdown } = usePairRotation(steps)
    copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('Pair Debt')
  })

  // 18 — copied flips to true then resets after 2s
  it('copied flips to true on copyMarkdown and resets after 2s', () => {
    vi.useFakeTimers()
    const steps = ref(makeSteps(['A', 'B']))
    const { copyMarkdown, copied } = usePairRotation(steps)
    expect(copied.value).toBe(false)
    copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })
})
