// UNIT_TYPE=Test
// Feature #190 — Tests for useBugPrediction composable

import { describe, it, expect, vi } from 'vitest'
import { useBugPrediction } from '../useBugPrediction'

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

describe('useBugPrediction', () => {
  // 1 — open defaults false
  it('open starts false', () => {
    const { open } = useBugPrediction(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — predictions length matches steps
  it('predictions length matches number of input steps', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    expect(predictions.value).toHaveLength(STEPS_4.length)
  })

  // 3 — complexity in range 1–5
  it('complexity is in range 1–5', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      expect(p.complexity).toBeGreaterThanOrEqual(1)
      expect(p.complexity).toBeLessThanOrEqual(5)
    }
  })

  // 4 — effort seeded 1–9 when no step.effort
  it('effort is in range 1–9 when step.effort is not provided', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      expect(p.effort).toBeGreaterThanOrEqual(1)
      expect(p.effort).toBeLessThanOrEqual(9)
    }
  })

  // 5 — effort from step.effort when > 0
  it('effort uses step.effort when it is > 0', () => {
    const stepsWithEffort = STEPS_4.map((s, i) => ({ ...s, effort: (i + 1) * 3 }))
    const { predictions } = useBugPrediction(() => stepsWithEffort)
    for (let i = 0; i < stepsWithEffort.length; i++) {
      expect(predictions.value[i].effort).toBe(stepsWithEffort[i].effort)
    }
  })

  // 6 — predictedBugs = Math.round(complexity * effort / 5)
  it('predictedBugs equals Math.round(complexity * effort / 5)', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      const expected = Math.round((p.complexity * p.effort) / 5)
      expect(p.predictedBugs).toBe(expected)
    }
  })

  // 7 — tier Critical when predictedBugs >= 6
  it('tier is Critical when predictedBugs >= 6', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      if (p.predictedBugs >= 6) {
        expect(p.tier).toBe('Critical')
      }
    }
  })

  // 8 — tier High when predictedBugs >= 4 and < 6
  it('tier is High when predictedBugs >= 4 and < 6', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      if (p.predictedBugs >= 4 && p.predictedBugs < 6) {
        expect(p.tier).toBe('High')
      }
    }
  })

  // 9 — tier Medium when predictedBugs >= 2 and < 4
  it('tier is Medium when predictedBugs >= 2 and < 4', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      if (p.predictedBugs >= 2 && p.predictedBugs < 4) {
        expect(p.tier).toBe('Medium')
      }
    }
  })

  // 10 — tier Low when predictedBugs < 2
  it('tier is Low when predictedBugs < 2', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      if (p.predictedBugs < 2) {
        expect(p.tier).toBe('Low')
      }
    }
  })

  // 11 — totalPredicted = sum of all predictedBugs
  it('totalPredicted equals sum of all predictedBugs', () => {
    const { predictions, totalPredicted } = useBugPrediction(() => STEPS_4)
    const expected = predictions.value.reduce((s, p) => s + p.predictedBugs, 0)
    expect(totalPredicted.value).toBe(expected)
  })

  // 12 — criticalCount = count of Critical tier
  it('criticalCount equals count of Critical tier entries', () => {
    const { predictions, criticalCount } = useBugPrediction(() => STEPS_4)
    const expected = predictions.value.filter((p) => p.tier === 'Critical').length
    expect(criticalCount.value).toBe(expected)
  })

  // 13 — empty steps guard
  it('empty steps: predictions is empty array', () => {
    const { predictions } = useBugPrediction(() => [])
    expect(predictions.value).toHaveLength(0)
  })

  // 14 — empty steps: totalPredicted is 0
  it('empty steps: totalPredicted is 0', () => {
    const { totalPredicted } = useBugPrediction(() => [])
    expect(totalPredicted.value).toBe(0)
  })

  // 15 — deterministic
  it('seeding is deterministic: same steps always produce the same predictions', () => {
    const { predictions: p1 } = useBugPrediction(() => STEPS_4)
    const { predictions: p2 } = useBugPrediction(() => STEPS_4)
    expect(p1.value).toEqual(p2.value)
  })

  // 16 — copied starts false
  it('copied starts false', () => {
    const { copied } = useBugPrediction(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 17 — copyMarkdown contains "Bug"
  it('copyMarkdown clipboard text contains "Bug"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useBugPrediction(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Bug')
    vi.unstubAllGlobals()
  })

  // 18 — stepId preserved
  it('predictions preserve stepId from input', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(predictions.value[i].stepId).toBe(STEPS_4[i].id)
    }
  })

  // 19 — stepTitle preserved
  it('predictions preserve stepTitle from input', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(predictions.value[i].stepTitle).toBe(STEPS_4[i].title)
    }
  })

  // 20 — complexity matches seed formula
  it('complexity matches seed(stepId + "cplx", 5) + 1', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      expect(p.complexity).toBe(seed(p.stepId + 'cplx', 5) + 1)
    }
  })

  // 21 — seeded effort matches formula when no step.effort
  it('seeded effort matches seed(stepId + "ef", 9) + 1 when step.effort not provided', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    for (const p of predictions.value) {
      expect(p.effort).toBe(seed(p.stepId + 'ef', 9) + 1)
    }
  })

  // 22 — bugEmoji is one of the 4 expected values
  it('bugEmoji is one of 🟢 🟡 🟠 🔴', () => {
    const { predictions } = useBugPrediction(() => STEPS_4)
    const valid = new Set(['🟢', '🟡', '🟠', '🔴'])
    for (const p of predictions.value) {
      expect(valid.has(p.bugEmoji)).toBe(true)
    }
  })

  // 23 — effort 0 is treated as "not provided" and falls back to seed
  it('effort of 0 on step falls back to seeded value', () => {
    const stepsZero = [{ id: 'step-0', title: 'Zero Effort', effort: 0 }]
    const { predictions } = useBugPrediction(() => stepsZero)
    expect(predictions.value[0].effort).toBe(seed('step-0ef', 9) + 1)
  })
})
