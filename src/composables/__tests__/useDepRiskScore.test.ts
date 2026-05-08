// UNIT_TYPE=Test
// Feature #178 — Tests for useDepRiskScore composable

import { describe, it, expect, vi } from 'vitest'
import { useDepRiskScore } from '../useDepRiskScore'

// Seed helper mirrored from composable for test assertions
function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

const STEPS_4 = [
  { id: 'step-0', title: 'Discovery' },
  { id: 'step-1', title: 'Implementation' },
  { id: 'step-2', title: 'Delivery' },
  { id: 'step-3', title: 'Testing' },
]

const STEPS_WITH_EFFORT = [
  { id: 'step-0', title: 'Alpha', effort: 6 },
  { id: 'step-1', title: 'Beta', effort: 2 },
  { id: 'step-2', title: 'Gamma', effort: 4 },
]

// Steps crafted so we get High, Medium, and Low tiers
// We need riskScore = inboundDeps * effort
// inboundDeps = seed(id + 'dep', 4)  →  0..3
// effort from provided or seed
// For deterministic control, use explicit effort values:
// High: inboundDeps * effort >= 8  (e.g. inboundDeps=3 * effort=4 = 12)
// Medium: >= 3 and < 8
// Low: < 3
const STEPS_HIGH_RISK = [
  // inboundDeps for 'h0' = seed('h0dep', 4), effort=4
  { id: 'h0', title: 'HighRisk', effort: 4 },
]

describe('useDepRiskScore', () => {
  // 1 — open defaults to false
  it('open starts false', () => {
    const { open } = useDepRiskScore(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — entries sorted by riskScore descending
  it('entries are sorted by riskScore descending', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    const scores = entries.value.map((e) => e.riskScore)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
  })

  // 3 — riskScore = inboundDeps * effort
  it('riskScore equals inboundDeps * effort', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    for (const e of entries.value) {
      expect(e.riskScore).toBe(e.inboundDeps * e.effort)
    }
  })

  // 4 — riskTier High when riskScore >= 8
  it('riskTier is "High" when riskScore >= 8', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    const highEntries = entries.value.filter((e) => e.riskScore >= 8)
    for (const e of highEntries) {
      expect(e.riskTier).toBe('High')
    }
  })

  // 5 — riskTier Medium when 3 <= riskScore < 8
  it('riskTier is "Medium" when riskScore >= 3 and < 8', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    const medEntries = entries.value.filter((e) => e.riskScore >= 3 && e.riskScore < 8)
    for (const e of medEntries) {
      expect(e.riskTier).toBe('Medium')
    }
  })

  // 6 — riskTier Low when riskScore < 3
  it('riskTier is "Low" when riskScore < 3', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    const lowEntries = entries.value.filter((e) => e.riskScore < 3)
    for (const e of lowEntries) {
      expect(e.riskTier).toBe('Low')
    }
  })

  // 7 — isCritical when riskTier === 'High'
  it('isCritical is true when and only when riskTier is "High"', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    for (const e of entries.value) {
      expect(e.isCritical).toBe(e.riskTier === 'High')
    }
  })

  // 8 — criticalCount matches isCritical entries
  it('criticalCount matches number of isCritical entries', () => {
    const { entries, criticalCount } = useDepRiskScore(() => STEPS_4)
    const expected = entries.value.filter((e) => e.isCritical).length
    expect(criticalCount.value).toBe(expected)
  })

  // 9 — maxRiskScore is correct
  it('maxRiskScore equals the highest riskScore', () => {
    const { entries, maxRiskScore } = useDepRiskScore(() => STEPS_4)
    const expected = Math.max(...entries.value.map((e) => e.riskScore))
    expect(maxRiskScore.value).toBe(expected)
  })

  // 10 — empty steps → empty entries
  it('empty steps: entries is empty', () => {
    const { entries } = useDepRiskScore(() => [])
    expect(entries.value).toHaveLength(0)
  })

  // 11 — empty steps → criticalCount 0
  it('empty steps: criticalCount is 0', () => {
    const { criticalCount } = useDepRiskScore(() => [])
    expect(criticalCount.value).toBe(0)
  })

  // 12 — empty steps → maxRiskScore 0
  it('empty steps: maxRiskScore is 0', () => {
    const { maxRiskScore } = useDepRiskScore(() => [])
    expect(maxRiskScore.value).toBe(0)
  })

  // 13 — inboundDeps seeded 0–3
  it('inboundDeps is seeded to 0–3', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    for (const e of entries.value) {
      expect(e.inboundDeps).toBeGreaterThanOrEqual(0)
      expect(e.inboundDeps).toBeLessThanOrEqual(3)
    }
  })

  // 14 — effort seeded 1–8 when not provided
  it('effort is seeded to 1–8 when not provided', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    for (const e of entries.value) {
      expect(e.effort).toBeGreaterThanOrEqual(1)
      expect(e.effort).toBeLessThanOrEqual(8)
    }
  })

  // 15 — deterministic seeding
  it('seeding is deterministic: same steps always produce the same entries', () => {
    const { entries: entries1 } = useDepRiskScore(() => STEPS_4)
    const { entries: entries2 } = useDepRiskScore(() => STEPS_4)
    expect(entries1.value).toEqual(entries2.value)
  })

  // 16 — copyMarkdown contains "Dep"
  it('copyMarkdown writes markdown containing "Dep"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useDepRiskScore(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Dep')
    vi.unstubAllGlobals()
  })

  // 17 — copied starts false
  it('copied starts false', () => {
    const { copied } = useDepRiskScore(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 18 — effort uses provided value when > 0
  it('effort uses provided value when effort > 0', () => {
    const { entries } = useDepRiskScore(() => STEPS_WITH_EFFORT)
    const alpha = entries.value.find((e) => e.stepId === 'step-0')
    const beta = entries.value.find((e) => e.stepId === 'step-1')
    const gamma = entries.value.find((e) => e.stepId === 'step-2')
    expect(alpha?.effort).toBe(6)
    expect(beta?.effort).toBe(2)
    expect(gamma?.effort).toBe(4)
  })

  // 19 — inboundDeps matches seed formula
  it('inboundDeps matches seed(stepId + "dep", 4)', () => {
    const { entries } = useDepRiskScore(() => STEPS_4)
    for (const e of entries.value) {
      const expected = seed(e.stepId + 'dep', 4)
      expect(e.inboundDeps).toBe(expected)
    }
  })

  // 20 — copyMarkdown contains all step titles
  it('copyMarkdown contains step titles', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = useDepRiskScore(() => STEPS_WITH_EFFORT)
    await copyMarkdown()
    expect(clipboardContent).toContain('Alpha')
    expect(clipboardContent).toContain('Beta')
    vi.unstubAllGlobals()
  })
})
