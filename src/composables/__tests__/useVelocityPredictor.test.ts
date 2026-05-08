// UNIT_TYPE=Test
// Feature #193 — Tests for useVelocityPredictor composable

import { describe, it, expect, vi } from 'vitest'
import { useVelocityPredictor } from '../useVelocityPredictor'

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

// Steps with explicit completed flags to control test conditions
const STEPS_MIXED = [
  { id: 'step-0', title: 'Alpha', effort: 5, completed: true },
  { id: 'step-1', title: 'Beta', effort: 7, completed: true },
  { id: 'step-2', title: 'Gamma', effort: 4, completed: false },
  { id: 'step-3', title: 'Delta', effort: 6, completed: false },
]

describe('useVelocityPredictor', () => {
  // 1 — open defaults false
  it('open starts false', () => {
    const { open } = useVelocityPredictor(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — points length matches steps
  it('points length matches number of input steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    expect(points.value).toHaveLength(STEPS_4.length)
  })

  // 3 — effort seeded 2–9 when no step.effort
  it('effort is in range 2–9 when step.effort is not provided', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (const p of points.value) {
      expect(p.effort).toBeGreaterThanOrEqual(2)
      expect(p.effort).toBeLessThanOrEqual(9)
    }
  })

  // 4 — effort from step.effort when > 0
  it('effort uses step.effort when it is > 0', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (let i = 0; i < STEPS_MIXED.length; i++) {
      expect(points.value[i].effort).toBe(STEPS_MIXED[i].effort)
    }
  })

  // 5 — isCompleted from seed when not provided
  it('isCompleted uses seed(stepId+"done", 2) === 1 when step.completed not provided', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (const p of points.value) {
      const expected = seed(p.stepId + 'done', 2) === 1
      expect(p.isCompleted).toBe(expected)
    }
  })

  // 6 — isCompleted uses step.completed when provided
  it('isCompleted uses step.completed when provided', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (let i = 0; i < STEPS_MIXED.length; i++) {
      expect(points.value[i].isCompleted).toBe(STEPS_MIXED[i].completed)
    }
  })

  // 7 — forecast null for completed steps
  it('forecast is null for completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (p.isCompleted) {
        expect(p.forecast).toBeNull()
      }
    }
  })

  // 8 — forecast non-null for non-completed steps
  it('forecast is non-null for non-completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (!p.isCompleted) {
        expect(p.forecast).not.toBeNull()
      }
    }
  })

  // 9 — lowerBound = forecast - 1.5 for non-completed
  it('lowerBound equals forecast - 1.5 for non-completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (!p.isCompleted) {
        expect(p.lowerBound).toBe((p.forecast as number) - 1.5)
      }
    }
  })

  // 10 — upperBound = forecast + 1.5 for non-completed
  it('upperBound equals forecast + 1.5 for non-completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (!p.isCompleted) {
        expect(p.upperBound).toBe((p.forecast as number) + 1.5)
      }
    }
  })

  // 11 — lowerBound null for completed steps
  it('lowerBound is null for completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (p.isCompleted) {
        expect(p.lowerBound).toBeNull()
      }
    }
  })

  // 12 — upperBound null for completed steps
  it('upperBound is null for completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (p.isCompleted) {
        expect(p.upperBound).toBeNull()
      }
    }
  })

  // 13 — avgVelocity = average velocity of all completed steps
  it('avgVelocity equals average velocity of completed steps', () => {
    const { points, avgVelocity } = useVelocityPredictor(() => STEPS_MIXED)
    const completed = points.value.filter((p) => p.isCompleted)
    const expected = completed.reduce((s, p) => s + p.velocity, 0) / completed.length
    expect(avgVelocity.value).toBeCloseTo(expected)
  })

  // 14 — avgVelocity is 0 when no completed steps
  it('avgVelocity is 0 when no completed steps', () => {
    const noneCompleted = STEPS_4.map((s) => ({ ...s, completed: false }))
    const { avgVelocity } = useVelocityPredictor(() => noneCompleted)
    expect(avgVelocity.value).toBe(0)
  })

  // 15 — trend is one of 3 valid values
  it('trend is one of "increasing", "stable", "decreasing"', () => {
    const { trend } = useVelocityPredictor(() => STEPS_MIXED)
    expect(['increasing', 'stable', 'decreasing']).toContain(trend.value)
  })

  // 16 — trend stable when < 2 completed steps
  it('trend is "stable" when fewer than 2 completed steps', () => {
    const oneCompleted = [
      { id: 'step-0', title: 'Alpha', effort: 5, completed: true },
      { id: 'step-1', title: 'Beta', effort: 7, completed: false },
    ]
    const { trend } = useVelocityPredictor(() => oneCompleted)
    expect(trend.value).toBe('stable')
  })

  // 17 — empty steps guard
  it('empty steps: points is empty array', () => {
    const { points } = useVelocityPredictor(() => [])
    expect(points.value).toHaveLength(0)
  })

  // 18 — empty steps: avgVelocity is 0
  it('empty steps: avgVelocity is 0', () => {
    const { avgVelocity } = useVelocityPredictor(() => [])
    expect(avgVelocity.value).toBe(0)
  })

  // 19 — deterministic
  it('seeding is deterministic: same steps produce same points', () => {
    const { points: p1 } = useVelocityPredictor(() => STEPS_4)
    const { points: p2 } = useVelocityPredictor(() => STEPS_4)
    expect(p1.value).toEqual(p2.value)
  })

  // 20 — copied starts false
  it('copied starts false', () => {
    const { copied } = useVelocityPredictor(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 21 — copyMarkdown contains "Velocity"
  it('copyMarkdown clipboard text contains "Velocity"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useVelocityPredictor(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Velocity')
    vi.unstubAllGlobals()
  })

  // 22 — stepId preserved
  it('points preserve stepId from input', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(points.value[i].stepId).toBe(STEPS_4[i].id)
    }
  })

  // 23 — stepTitle preserved
  it('points preserve stepTitle from input', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(points.value[i].stepTitle).toBe(STEPS_4[i].title)
    }
  })

  // 24 — stepIndex is 0-based
  it('stepIndex is 0-based and sequential', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(points.value[i].stepIndex).toBe(i)
    }
  })

  // 25 — velocity equals effort
  it('velocity equals effort for each point', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (const p of points.value) {
      expect(p.velocity).toBe(p.effort)
    }
  })

  // 26 — seeded effort matches formula
  it('seeded effort matches seed(stepId+"vel", 8) + 2 when step.effort not provided', () => {
    const { points } = useVelocityPredictor(() => STEPS_4)
    for (const p of points.value) {
      expect(p.effort).toBe(seed(p.stepId + 'vel', 8) + 2)
    }
  })

  // 27 — forecast >= 1 for non-completed steps
  it('forecast is at least 1 for non-completed steps', () => {
    const { points } = useVelocityPredictor(() => STEPS_MIXED)
    for (const p of points.value) {
      if (!p.isCompleted && p.forecast !== null) {
        expect(p.forecast).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
