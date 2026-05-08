// UNIT_TYPE=Test
// Feature #188 — Tests for useSprintRiskHeatmap composable

import { describe, it, expect, vi } from 'vitest'
import { useSprintRiskHeatmap } from '../useSprintRiskHeatmap'

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

describe('useSprintRiskHeatmap', () => {
  // 1 — open defaults to false
  it('open starts false', () => {
    const { open } = useSprintRiskHeatmap(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — heatSteps length matches steps
  it('heatSteps length matches number of input steps', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    expect(heatSteps.value).toHaveLength(STEPS_4.length)
  })

  // 3 — complexity 1–5
  it('complexity is in range 1–5', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      expect(s.complexity).toBeGreaterThanOrEqual(1)
      expect(s.complexity).toBeLessThanOrEqual(5)
    }
  })

  // 4 — depRisk 1–5
  it('depRisk is in range 1–5', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      expect(s.depRisk).toBeGreaterThanOrEqual(1)
      expect(s.depRisk).toBeLessThanOrEqual(5)
    }
  })

  // 5 — pairCoverage 1–5
  it('pairCoverage is in range 1–5', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      expect(s.pairCoverage).toBeGreaterThanOrEqual(1)
      expect(s.pairCoverage).toBeLessThanOrEqual(5)
    }
  })

  // 6 — overallRisk = Math.round(avg of 3 factors)
  it('overallRisk equals Math.round((complexity + depRisk + pairCoverage) / 3)', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      const expected = Math.round((s.complexity + s.depRisk + s.pairCoverage) / 3)
      expect(s.overallRisk).toBe(expected)
    }
  })

  // 7 — riskTier is High when overallRisk >= 4
  it('riskTier is High when overallRisk >= 4', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      if (s.overallRisk >= 4) {
        expect(s.riskTier).toBe('High')
      }
    }
  })

  // 8 — riskTier is Medium when overallRisk >= 3 and < 4
  it('riskTier is Medium when overallRisk >= 3 and < 4', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      if (s.overallRisk >= 3 && s.overallRisk < 4) {
        expect(s.riskTier).toBe('Medium')
      }
    }
  })

  // 9 — riskTier is Low when overallRisk < 3
  it('riskTier is Low when overallRisk < 3', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      if (s.overallRisk < 3) {
        expect(s.riskTier).toBe('Low')
      }
    }
  })

  // 10 — highRiskCount matches High tier count
  it('highRiskCount equals the number of High tier steps', () => {
    const { heatSteps, highRiskCount } = useSprintRiskHeatmap(() => STEPS_4)
    const expected = heatSteps.value.filter((s) => s.riskTier === 'High').length
    expect(highRiskCount.value).toBe(expected)
  })

  // 11 — empty steps → empty heatSteps
  it('empty steps: heatSteps is empty array', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => [])
    expect(heatSteps.value).toHaveLength(0)
  })

  // 12 — empty steps → highRiskCount 0
  it('empty steps: highRiskCount is 0', () => {
    const { highRiskCount } = useSprintRiskHeatmap(() => [])
    expect(highRiskCount.value).toBe(0)
  })

  // 13 — deterministic seeding
  it('seeding is deterministic: same steps always produce the same heatSteps', () => {
    const { heatSteps: s1 } = useSprintRiskHeatmap(() => STEPS_4)
    const { heatSteps: s2 } = useSprintRiskHeatmap(() => STEPS_4)
    expect(s1.value).toEqual(s2.value)
  })

  // 14 — copied starts false
  it('copied starts false', () => {
    const { copied } = useSprintRiskHeatmap(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 15 — copyMarkdown contains "Risk"
  it('copyMarkdown clipboard text contains "Risk"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useSprintRiskHeatmap(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Risk')
    vi.unstubAllGlobals()
  })

  // 16 — stepId preserved
  it('heatSteps preserve stepId from input', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(heatSteps.value[i].stepId).toBe(STEPS_4[i].id)
    }
  })

  // 17 — pairCoverage formula: 5 - seed(stepId + 'pair', 5)
  it('pairCoverage matches 5 - seed(stepId + "pair", 5)', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      const expected = 5 - seed(s.stepId + 'pair', 5)
      expect(s.pairCoverage).toBe(expected)
    }
  })

  // 18 — complexity matches seed formula
  it('complexity matches seed(stepId + "cplx", 5) + 1', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      expect(s.complexity).toBe(seed(s.stepId + 'cplx', 5) + 1)
    }
  })

  // 19 — depRisk matches seed formula
  it('depRisk matches seed(stepId + "deprisk", 5) + 1', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (const s of heatSteps.value) {
      expect(s.depRisk).toBe(seed(s.stepId + 'deprisk', 5) + 1)
    }
  })

  // 20 — copied is set to true after copyMarkdown
  it('copied is true immediately after copyMarkdown', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const { copied, copyMarkdown } = useSprintRiskHeatmap(() => STEPS_4)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.unstubAllGlobals()
  })

  // 21 — stepTitle preserved
  it('heatSteps preserve stepTitle from input', () => {
    const { heatSteps } = useSprintRiskHeatmap(() => STEPS_4)
    for (let i = 0; i < STEPS_4.length; i++) {
      expect(heatSteps.value[i].stepTitle).toBe(STEPS_4[i].title)
    }
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
    const { copyMarkdown } = useSprintRiskHeatmap(() => STEPS_4)
    await copyMarkdown()
    for (const step of STEPS_4) {
      expect(clipboardContent).toContain(step.title)
    }
    vi.unstubAllGlobals()
  })
})
