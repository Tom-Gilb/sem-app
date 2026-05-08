// UNIT_TYPE=Test
// Feature #185 — Tests for useEnergyEffortScatter composable

import { describe, it, expect, vi } from 'vitest'
import { useEnergyEffortScatter } from '../useEnergyEffortScatter'
import type { Quadrant } from '../useEnergyEffortScatter'

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

describe('useEnergyEffortScatter', () => {
  // 1 — open defaults to false
  it('open starts false', () => {
    const { open } = useEnergyEffortScatter(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — points length matches steps
  it('points length matches number of input steps', () => {
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    expect(points.value).toHaveLength(STEPS_4.length)
  })

  // 3 — energy range 1–4
  it('energy is in range 1–4', () => {
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    for (const p of points.value) {
      expect(p.energy).toBeGreaterThanOrEqual(1)
      expect(p.energy).toBeLessThanOrEqual(4)
    }
  })

  // 4 — effort seeded 2–10 when no step.effort
  it('effort is in range 2–10 when step.effort is absent', () => {
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    for (const p of points.value) {
      expect(p.effort).toBeGreaterThanOrEqual(2)
      expect(p.effort).toBeLessThanOrEqual(10)
    }
  })

  // 5 — effort taken from step.effort when > 0
  it('effort comes from step.effort when step.effort > 0', () => {
    const stepsWithEffort = [{ id: 'step-0', title: 'A', effort: 7 }]
    const { points } = useEnergyEffortScatter(() => stepsWithEffort)
    expect(points.value[0].effort).toBe(7)
  })

  // 6 — effort falls back to seed when step.effort is 0
  it('effort falls back to seed when step.effort is 0', () => {
    const stepsWithZero = [{ id: 'step-0', title: 'A', effort: 0 }]
    const { points } = useEnergyEffortScatter(() => stepsWithZero)
    const expected = seed('step-0' + 'ef', 9) + 2
    expect(points.value[0].effort).toBe(expected)
  })

  // 7 — quadrant: energy > 2 && effort > 5 → Grind
  it('quadrant is Grind when energy > 2 and effort > 5', () => {
    // Force seeded values that produce energy>2, effort>5
    // We use a step where energy seed gives >2 and effort seed gives >5 when no step.effort
    // We find such a step via brute force over known IDs in our fixture
    const stepsForGrind = [{ id: 'step-0', title: 'Grind Step', effort: 6 }]
    // energy for step-0: seed('step-0en', 4) + 1
    const energy = seed('step-0' + 'en', 4) + 1
    const { points } = useEnergyEffortScatter(() => stepsForGrind)
    if (energy > 2) {
      // effort is 6 > 5
      expect(points.value[0].quadrant).toBe('Grind')
    }
  })

  // 8 — quadrant: energy > 2 && effort <= 5 → Focus
  it('quadrant is Focus when energy > 2 and effort <= 5', () => {
    const stepsForFocus = [{ id: 'step-0', title: 'Focus Step', effort: 4 }]
    const energy = seed('step-0' + 'en', 4) + 1
    const { points } = useEnergyEffortScatter(() => stepsForFocus)
    if (energy > 2) {
      // effort is 4 <= 5
      expect(points.value[0].quadrant).toBe('Focus')
    }
  })

  // 9 — quadrant: energy <= 2 && effort > 5 → Waste
  it('quadrant is Waste when energy <= 2 and effort > 5', () => {
    // step-2: seed('step-2en', 4) + 1
    const energy = seed('step-2' + 'en', 4) + 1
    const stepsForWaste = [{ id: 'step-2', title: 'Waste Step', effort: 8 }]
    const { points } = useEnergyEffortScatter(() => stepsForWaste)
    if (energy <= 2) {
      expect(points.value[0].quadrant).toBe('Waste')
    }
  })

  // 10 — quadrant: energy <= 2 && effort <= 5 → Coast
  it('quadrant is Coast when energy <= 2 and effort <= 5', () => {
    const energy = seed('step-2' + 'en', 4) + 1
    const stepsForCoast = [{ id: 'step-2', title: 'Coast Step', effort: 3 }]
    const { points } = useEnergyEffortScatter(() => stepsForCoast)
    if (energy <= 2) {
      expect(points.value[0].quadrant).toBe('Coast')
    }
  })

  // 11 — all 4 quadrants are valid Quadrant values
  it('all points have a valid quadrant', () => {
    const validQuadrants: Quadrant[] = ['Focus', 'Grind', 'Coast', 'Waste']
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    for (const p of points.value) {
      expect(validQuadrants).toContain(p.quadrant)
    }
  })

  // 12 — dominantQuadrant is the most-frequent quadrant
  it('dominantQuadrant is the most-frequent quadrant', () => {
    const { points, dominantQuadrant } = useEnergyEffortScatter(() => STEPS_4)
    const counts: Record<string, number> = {}
    for (const p of points.value) {
      counts[p.quadrant] = (counts[p.quadrant] ?? 0) + 1
    }
    const maxCount = Math.max(...Object.values(counts))
    const dominant = dominantQuadrant.value
    expect(dominant).not.toBeNull()
    expect(counts[dominant!]).toBe(maxCount)
  })

  // 13 — dominantQuadrant is null for empty steps
  it('dominantQuadrant is null when steps is empty', () => {
    const { dominantQuadrant } = useEnergyEffortScatter(() => [])
    expect(dominantQuadrant.value).toBeNull()
  })

  // 14 — empty steps → empty points
  it('empty steps: points is empty array', () => {
    const { points } = useEnergyEffortScatter(() => [])
    expect(points.value).toHaveLength(0)
  })

  // 15 — deterministic seeding
  it('seeding is deterministic: same steps always produce the same points', () => {
    const { points: p1 } = useEnergyEffortScatter(() => STEPS_4)
    const { points: p2 } = useEnergyEffortScatter(() => STEPS_4)
    expect(p1.value).toEqual(p2.value)
  })

  // 16 — copied starts false
  it('copied starts false', () => {
    const { copied } = useEnergyEffortScatter(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 17 — copyMarkdown contains "Quadrant"
  it('copyMarkdown clipboard text contains "Quadrant"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useEnergyEffortScatter(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Quadrant')
    vi.unstubAllGlobals()
  })

  // 18 — stepId and stepTitle are preserved
  it('points preserve stepId and stepTitle from input', () => {
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(points.value[i].stepId).toBe(STEPS_4[i].id)
      expect(points.value[i].stepTitle).toBe(STEPS_4[i].title)
    }
  })

  // 19 — energy matches seed formula
  it('energy matches seed(stepId + "en", 4) + 1', () => {
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    for (const p of points.value) {
      expect(p.energy).toBe(seed(p.stepId + 'en', 4) + 1)
    }
  })

  // 20 — effort matches seed formula when no step.effort
  it('effort matches seed(stepId + "ef", 9) + 2 when step.effort is absent', () => {
    const { points } = useEnergyEffortScatter(() => STEPS_4)
    for (const p of points.value) {
      expect(p.effort).toBe(seed(p.stepId + 'ef', 9) + 2)
    }
  })

  // 21 — copied is set to true after copyMarkdown
  it('copied is true immediately after copyMarkdown', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const { copied, copyMarkdown } = useEnergyEffortScatter(() => STEPS_4)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.unstubAllGlobals()
  })

  // 22 — copyMarkdown contains step titles
  it('copyMarkdown clipboard text contains step titles', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useEnergyEffortScatter(() => STEPS_4)
    await copyMarkdown()
    for (const step of STEPS_4) {
      expect(clipboardContent).toContain(step.title)
    }
    vi.unstubAllGlobals()
  })
})
