// Feature #150 — useBurnDown tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useBurnDown, addBusinessDays, type BurnDownStep } from '../useBurnDown'

const TODAY = new Date('2026-05-02')

const makeSteps = (overrides: Partial<BurnDownStep>[] = []): BurnDownStep[] =>
  overrides.map((o, i) => ({
    id: `step-${i}`,
    name: `Step ${i}`,
    ...o,
  }))

describe('useBurnDown', () => {
  // 1 — empty steps: totalEffort = 0
  it('returns totalEffort 0 for empty steps', () => {
    const steps = ref<BurnDownStep[]>([])
    const { totalEffort } = useBurnDown(steps)
    expect(totalEffort.value).toBe(0)
  })

  // 2 — default effort 4 per step
  it('uses default effort of 4 when effort is missing', () => {
    const steps = ref(makeSteps([{}, {}]))
    const { totalEffort } = useBurnDown(steps)
    expect(totalEffort.value).toBe(8)
  })

  // 3 — explicit effort is summed
  it('sums explicit effort values correctly', () => {
    const steps = ref(makeSteps([{ effort: 3 }, { effort: 7 }, { effort: 10 }]))
    const { totalEffort } = useBurnDown(steps)
    expect(totalEffort.value).toBe(20)
  })

  // 4 — burnPoints has N+1 entries
  it('burnPoints has N+1 data points for N steps', () => {
    const steps = ref(makeSteps([{}, {}, {}]))
    const { burnPoints } = useBurnDown(steps)
    expect(burnPoints.value).toHaveLength(4)
  })

  // 5 — burnPoints[0].remaining equals totalEffort
  it('remaining at index 0 equals totalEffort', () => {
    const steps = ref(makeSteps([{ effort: 5 }, { effort: 3 }]))
    const { burnPoints, totalEffort } = useBurnDown(steps)
    expect(burnPoints.value[0].remaining).toBe(totalEffort.value)
  })

  // 6 — ideal line starts at totalEffort and ends at 0
  it('ideal line goes from totalEffort to 0', () => {
    const steps = ref(makeSteps([{ effort: 5 }, { effort: 5 }]))
    const { burnPoints, totalEffort } = useBurnDown(steps)
    const pts = burnPoints.value
    expect(pts[0].ideal).toBe(totalEffort.value)
    expect(pts[pts.length - 1].ideal).toBeCloseTo(0, 5)
  })

  // 7 — day indices are 0..N
  it('day indices are 0 through N inclusive', () => {
    const steps = ref(makeSteps([{}, {}]))
    const { burnPoints } = useBurnDown(steps)
    expect(burnPoints.value.map(p => p.day)).toEqual([0, 1, 2])
  })

  // 8 — remaining decrements by step effort
  it('remaining decrements correctly per step effort', () => {
    const steps = ref(makeSteps([{ effort: 3 }, { effort: 5 }]))
    const { burnPoints } = useBurnDown(steps)
    const pts = burnPoints.value
    expect(pts[0].remaining).toBe(8)
    expect(pts[1].remaining).toBe(5) // 8 - 3
    expect(pts[2].remaining).toBe(0) // 5 - 5
  })

  // 9 — isOnTrack is true when remaining reaches 0
  it('isOnTrack is true when all effort is consumed', () => {
    const steps = ref(makeSteps([{ effort: 4 }]))
    const { isOnTrack } = useBurnDown(steps)
    expect(isOnTrack.value).toBe(true)
  })

  // 10 — completionDate is deterministic (not random)
  it('completionDate is deterministic for same input', () => {
    const steps = ref(makeSteps([{ effort: 5 }, { effort: 3 }]))
    const { completionDate } = useBurnDown(steps)
    const first = completionDate.value
    const second = completionDate.value
    expect(first).toBe(second)
  })

  // 11 — completionDate is a valid ISO date string
  it('completionDate returns a valid ISO date string', () => {
    const steps = ref(makeSteps([{ effort: 3 }]))
    const { completionDate } = useBurnDown(steps)
    expect(completionDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // 12 — idealPolylinePoints and actualPolylinePoints are non-empty strings
  it('polyline point strings are non-empty for non-empty steps', () => {
    const steps = ref(makeSteps([{ effort: 4 }, { effort: 4 }]))
    const { idealPolylinePoints, actualPolylinePoints } = useBurnDown(steps)
    expect(idealPolylinePoints.value.length).toBeGreaterThan(0)
    expect(actualPolylinePoints.value.length).toBeGreaterThan(0)
  })

  // 13 — yTicks has exactly 3 elements
  it('yTicks has exactly 3 tick marks', () => {
    const steps = ref(makeSteps([{ effort: 10 }]))
    const { yTicks } = useBurnDown(steps)
    expect(yTicks.value).toHaveLength(3)
  })

  // 14 — xLabels has N+1 entries matching burnPoints length
  it('xLabels has N+1 entries', () => {
    const steps = ref(makeSteps([{}, {}, {}]))
    const { xLabels } = useBurnDown(steps)
    expect(xLabels.value).toHaveLength(4)
  })

  // 15 — copyMarkdown generates a pipe table
  it('copyMarkdown produces a markdown table string with expected columns', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })
    const steps = ref(makeSteps([{ name: 'Alpha', effort: 3 }]))
    const { copyMarkdown } = useBurnDown(steps)
    copyMarkdown()
    const md: string = writeTextMock.mock.calls[0][0]
    expect(md).toContain('| Step |')
    expect(md).toContain('| Effort |')
    expect(md).toContain('| Remaining |')
    expect(md).toContain('| Ideal |')
    expect(md).toContain('Alpha')
  })

  // 16 — copied flips to true then resets after 2s
  it('copied flips to true on copyMarkdown and resets to false after 2s', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    })
    const steps = ref(makeSteps([{ effort: 2 }]))
    const { copyMarkdown, copied } = useBurnDown(steps)
    expect(copied.value).toBe(false)
    copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })

  // 17 — addBusinessDays skips Saturday
  it('addBusinessDays advances past Saturday to Monday', () => {
    // 2026-05-02 is Saturday... let us pick a known Sat: 2026-05-02 is Saturday
    const sat = new Date('2026-05-02')
    // Adding 0 days: result is Saturday → should advance to Monday 2026-05-04
    const result = addBusinessDays(sat, 0)
    expect(result.getDay()).toBe(1) // Monday
  })

  // 18 — addBusinessDays skips Sunday
  it('addBusinessDays advances past Sunday to Monday', () => {
    // 2026-05-03 is Sunday
    const sun = new Date('2026-05-03')
    const result = addBusinessDays(sun, 0)
    expect(result.getDay()).toBe(1) // Monday
  })

  // 19 — empty steps returns single burnPoint with 0/0
  it('returns a single [0,0,0] point for empty steps', () => {
    const steps = ref<BurnDownStep[]>([])
    const { burnPoints } = useBurnDown(steps)
    expect(burnPoints.value).toHaveLength(1)
    expect(burnPoints.value[0]).toEqual({ day: 0, remaining: 0, ideal: 0 })
  })

  // 20 — burnDownOpen starts false
  it('burnDownOpen starts as false', () => {
    const steps = ref<BurnDownStep[]>([])
    const { burnDownOpen } = useBurnDown(steps)
    expect(burnDownOpen.value).toBe(false)
  })
})
