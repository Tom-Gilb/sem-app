// UNIT_TYPE=Test
// Feature #183 — Tests for useCycleTime composable

import { describe, it, expect, vi } from 'vitest'
import { useCycleTime } from '../useCycleTime'

// Seed helper mirrored from composable
function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

const STEPS_4 = [
  { id: 'step-0', title: 'Discovery' },
  { id: 'step-1', title: 'Implementation' },
  { id: 'step-2', title: 'Delivery' },
  { id: 'step-3', title: 'Testing' },
]

describe('useCycleTime', () => {
  // 1 — open defaults to false
  it('open starts false', () => {
    const { open } = useCycleTime(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — step count matches input
  it('cycleSteps length matches number of input steps', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    expect(cycleSteps.value).toHaveLength(STEPS_4.length)
  })

  // 3 — leadTime range 2–9
  it('leadTime is in range 2–9', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.leadTime).toBeGreaterThanOrEqual(2)
      expect(s.leadTime).toBeLessThanOrEqual(9)
    }
  })

  // 4 — activeTime range 1–6
  it('activeTime is in range 1–6', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.activeTime).toBeGreaterThanOrEqual(1)
      expect(s.activeTime).toBeLessThanOrEqual(6)
    }
  })

  // 5 — waitTime range 1–5
  it('waitTime is in range 1–5', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.waitTime).toBeGreaterThanOrEqual(1)
      expect(s.waitTime).toBeLessThanOrEqual(5)
    }
  })

  // 6 — cycleTime = activeTime + waitTime
  it('cycleTime equals activeTime + waitTime', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.cycleTime).toBe(s.activeTime + s.waitTime)
    }
  })

  // 7 — flowEfficiency range 0–100
  it('flowEfficiency is in range 0–100', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.flowEfficiency).toBeGreaterThanOrEqual(0)
      expect(s.flowEfficiency).toBeLessThanOrEqual(100)
    }
  })

  // 8 — flowEfficiency formula: Math.round(active / (active + wait) * 100)
  it('flowEfficiency matches Math.round(activeTime / (activeTime + waitTime) * 100)', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      const expected = Math.round((s.activeTime / (s.activeTime + s.waitTime)) * 100)
      expect(s.flowEfficiency).toBe(expected)
    }
  })

  // 9 — isBottleneck when flowEfficiency < 35
  it('isBottleneck is true when flowEfficiency < 35', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      if (s.flowEfficiency < 35) {
        expect(s.isBottleneck).toBe(true)
      }
    }
  })

  // 10 — isBottleneck when cycleTime > avg * 1.5
  it('isBottleneck is true when cycleTime > avgCycleTime * 1.5', () => {
    const { cycleSteps, avgCycleTime } = useCycleTime(() => STEPS_4)
    const avg = avgCycleTime.value
    for (const s of cycleSteps.value) {
      if (s.cycleTime > avg * 1.5) {
        expect(s.isBottleneck).toBe(true)
      }
    }
  })

  // 11 — isBottleneck is false when neither condition is met
  it('isBottleneck is false when flowEfficiency >= 35 AND cycleTime <= avg * 1.5', () => {
    const { cycleSteps, avgCycleTime } = useCycleTime(() => STEPS_4)
    const avg = avgCycleTime.value
    for (const s of cycleSteps.value) {
      if (s.flowEfficiency >= 35 && s.cycleTime <= avg * 1.5) {
        expect(s.isBottleneck).toBe(false)
      }
    }
  })

  // 12 — avgCycleTime is average of cycleTime values
  it('avgCycleTime equals average of all cycleTime values', () => {
    const { cycleSteps, avgCycleTime } = useCycleTime(() => STEPS_4)
    const list = cycleSteps.value
    const expected = list.reduce((sum, s) => sum + s.cycleTime, 0) / list.length
    expect(avgCycleTime.value).toBeCloseTo(expected, 10)
  })

  // 13 — bottleneckCount matches filtered isBottleneck
  it('bottleneckCount equals count of isBottleneck steps', () => {
    const { cycleSteps, bottleneckCount } = useCycleTime(() => STEPS_4)
    const expected = cycleSteps.value.filter((s) => s.isBottleneck).length
    expect(bottleneckCount.value).toBe(expected)
  })

  // 14 — empty steps guard: cycleSteps is empty
  it('empty steps: cycleSteps is empty array', () => {
    const { cycleSteps } = useCycleTime(() => [])
    expect(cycleSteps.value).toHaveLength(0)
  })

  // 15 — empty steps: avgCycleTime is 0
  it('empty steps: avgCycleTime is 0', () => {
    const { avgCycleTime } = useCycleTime(() => [])
    expect(avgCycleTime.value).toBe(0)
  })

  // 16 — empty steps: bottleneckCount is 0
  it('empty steps: bottleneckCount is 0', () => {
    const { bottleneckCount } = useCycleTime(() => [])
    expect(bottleneckCount.value).toBe(0)
  })

  // 17 — deterministic seeding: same steps always produce same output
  it('seeding is deterministic: same steps always produce the same cycleSteps', () => {
    const { cycleSteps: s1 } = useCycleTime(() => STEPS_4)
    const { cycleSteps: s2 } = useCycleTime(() => STEPS_4)
    expect(s1.value).toEqual(s2.value)
  })

  // 18 — leadTime matches seed formula
  it('leadTime matches seed(stepId + "lead", 8) + 2', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.leadTime).toBe(seed(s.stepId + 'lead', 8) + 2)
    }
  })

  // 19 — activeTime matches seed formula
  it('activeTime matches seed(stepId + "active", 6) + 1', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.activeTime).toBe(seed(s.stepId + 'active', 6) + 1)
    }
  })

  // 20 — waitTime matches seed formula
  it('waitTime matches seed(stepId + "wait", 5) + 1', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (const s of cycleSteps.value) {
      expect(s.waitTime).toBe(seed(s.stepId + 'wait', 5) + 1)
    }
  })

  // 21 — copied starts false
  it('copied starts false', () => {
    const { copied } = useCycleTime(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 22 — copyMarkdown contains "Cycle Time"
  it('copyMarkdown clipboard text contains "Cycle Time"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useCycleTime(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Cycle Time')
    vi.unstubAllGlobals()
  })

  // 23 — copyMarkdown contains step titles
  it('copyMarkdown clipboard text contains step titles', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useCycleTime(() => STEPS_4)
    await copyMarkdown()
    for (const step of STEPS_4) {
      expect(clipboardContent).toContain(step.title)
    }
    vi.unstubAllGlobals()
  })

  // 24 — copied is set to true after copyMarkdown
  it('copied is true immediately after copyMarkdown', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const { copied, copyMarkdown } = useCycleTime(() => STEPS_4)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.unstubAllGlobals()
  })

  // 25 — stepId and stepTitle are preserved
  it('cycleSteps preserve stepId and stepTitle from input', () => {
    const { cycleSteps } = useCycleTime(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(cycleSteps.value[i].stepId).toBe(STEPS_4[i].id)
      expect(cycleSteps.value[i].stepTitle).toBe(STEPS_4[i].title)
    }
  })
})
