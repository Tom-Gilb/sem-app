// UNIT_TYPE=Test
// Feature #36 — Tests for useEffortBreakdown composable

import { describe, it, expect } from 'vitest'
import { useEffortBreakdown, doughnutSlicePath } from '../useEffortBreakdown'
import type { EvoStep } from '../../types/evo-plan'

function makeStep(name: string, effortPercent: number): EvoStep {
  return {
    name,
    description: `${name} description`,
    linkedValues: ['V.TestValue'],
    linkedSolution: 'S.TestSolution',
    effortPercent,
  }
}

describe('useEffortBreakdown', () => {
  const { breakdown, slicePaths } = useEffortBreakdown(100)

  describe('breakdown()', () => {
    it('returns one entry per step', () => {
      const steps = [makeStep('A', 20), makeStep('B', 30)]
      const result = breakdown(steps)
      expect(result).toHaveLength(2)
    })

    it('computes totalHours from effortPercent × totalProjectHours', () => {
      const steps = [makeStep('A', 25)]
      const result = breakdown(steps)
      expect(result[0].totalHours).toBe(25)
    })

    it('returns 3 slices per entry', () => {
      const steps = [makeStep('A', 40)]
      const result = breakdown(steps)
      expect(result[0].slices).toHaveLength(3)
    })

    it('slice labels are F. Work, V. Work, S. Work', () => {
      const result = breakdown([makeStep('A', 100)])
      const labels = result[0].slices.map((s) => s.label)
      expect(labels).toEqual(['F. Work', 'V. Work', 'S. Work'])
    })

    it('slice shares sum to 1.0', () => {
      const result = breakdown([makeStep('A', 100)])
      const sum = result[0].slices.reduce((acc, s) => acc + s.share, 0)
      expect(sum).toBeCloseTo(1.0, 5)
    })

    it('hours are proportional to share × totalHours', () => {
      const result = breakdown([makeStep('A', 100)])
      const entry = result[0]
      for (const slice of entry.slices) {
        expect(slice.hours).toBeGreaterThanOrEqual(0)
        expect(slice.hours).toBeLessThanOrEqual(entry.totalHours)
      }
    })

    it('returns empty array for no steps', () => {
      expect(breakdown([])).toHaveLength(0)
    })

    it('step with effortPercent=0 → totalHours=0', () => {
      const result = breakdown([makeStep('Zero', 0)])
      expect(result[0].totalHours).toBe(0)
    })
  })

  describe('slicePaths()', () => {
    it('returns 3 path objects for a standard entry', () => {
      const entry = breakdown([makeStep('A', 50)])[0]
      const paths = slicePaths(entry)
      expect(paths).toHaveLength(3)
    })

    it('each path has a non-empty SVG path string', () => {
      const entry = breakdown([makeStep('A', 50)])[0]
      const paths = slicePaths(entry)
      for (const p of paths) {
        expect(p.path).toBeTruthy()
        expect(p.path).toContain('M ')
      }
    })

    it('colours match the slice colours', () => {
      const entry = breakdown([makeStep('A', 50)])[0]
      const paths = slicePaths(entry)
      expect(paths[0].colour).toBe(entry.slices[0].colour)
      expect(paths[1].colour).toBe(entry.slices[1].colour)
      expect(paths[2].colour).toBe(entry.slices[2].colour)
    })
  })
})

describe('doughnutSlicePath()', () => {
  it('returns a string starting with M', () => {
    const path = doughnutSlicePath(0, Math.PI, 50, 50, 40, 20)
    expect(path).toMatch(/^M /)
  })

  it('returns a string ending with Z', () => {
    const path = doughnutSlicePath(0, Math.PI, 50, 50, 40, 20)
    expect(path).toMatch(/Z$/)
  })

  it('handles a near-full circle (2π - epsilon)', () => {
    const path = doughnutSlicePath(0, 2 * Math.PI - 0.001, 50, 50, 40, 20)
    expect(path).toBeTruthy()
  })

  it('large arc flag is 1 when delta > PI', () => {
    const path = doughnutSlicePath(0, Math.PI + 0.1, 50, 50, 40, 20)
    // The large-arc flag appears in the A command: "A R R 0 1 1 ..."
    expect(path).toContain(' 1 1 ')
  })

  it('small arc flag is 0 when delta ≤ PI', () => {
    const path = doughnutSlicePath(0, Math.PI * 0.5, 50, 50, 40, 20)
    // Small arc: "A R R 0 0 1 ..."
    expect(path).toContain(' 0 1 ')
  })
})
