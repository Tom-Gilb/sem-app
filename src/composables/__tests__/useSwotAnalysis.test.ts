// UNIT_TYPE=Test
// Feature #147 — useSwotAnalysis composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useSwotAnalysis } from '../useSwotAnalysis'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{
    id: string
    goal?: string
    tolerable?: string
    status?: string
    meter?: string
  }>
  solutions?: Array<{ id: string; description?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map((f) => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? 'Default description text here',
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map((v) => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: '',
      scale: '',
      meter: v.meter ?? 'unit test measurement',
      status: v.status ?? '',
      tolerable: v.tolerable ?? '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: (overrides?.solutions ?? []).map((s) => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: s.description ?? 'solution description',
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSwotAnalysis', () => {
  it('strengths contains V. entries where numeric goal > numeric tolerable', () => {
    const block = makeBlock({
      values: [{ id: 'V.Speed', goal: '100', tolerable: '50' }],
    })
    const { swot } = useSwotAnalysis([block])
    expect(swot.value.strengths.length).toBeGreaterThan(0)
    expect(swot.value.strengths[0]).toContain('V.Speed')
  })

  it('strengths contains V. entries where goal exists and tolerable is missing', () => {
    const block = makeBlock({
      values: [{ id: 'V.Availability', goal: '99.9%', tolerable: '' }],
    })
    const { swot } = useSwotAnalysis([block])
    const hasEntry = swot.value.strengths.some((s) => s.includes('V.Availability'))
    expect(hasEntry).toBe(true)
  })

  it('weaknesses contains V. entries where status includes "At Risk"', () => {
    const block = makeBlock({
      values: [{ id: 'V.Perf', goal: '50', status: 'At Risk' }],
    })
    const { swot } = useSwotAnalysis([block])
    const found = swot.value.weaknesses.some((w) => w.includes('V.Perf'))
    expect(found).toBe(true)
  })

  it('weaknesses contains V. entries where status includes "Below Tolerable"', () => {
    const block = makeBlock({
      values: [{ id: 'V.Cost', goal: '100', status: 'Below Tolerable' }],
    })
    const { swot } = useSwotAnalysis([block])
    const found = swot.value.weaknesses.some((w) => w.includes('V.Cost'))
    expect(found).toBe(true)
  })

  it('weaknesses contains V. entries with no goal field', () => {
    const block = makeBlock({
      values: [{ id: 'V.NoGoal', goal: '' }],
    })
    const { swot } = useSwotAnalysis([block])
    const found = swot.value.weaknesses.some((w) => w.includes('V.NoGoal'))
    expect(found).toBe(true)
  })

  it('weakness label uses format: id + " — goal not met / not set"', () => {
    const block = makeBlock({
      values: [{ id: 'V.Weak', goal: '' }],
    })
    const { swot } = useSwotAnalysis([block])
    expect(swot.value.weaknesses[0]).toBe('V.Weak — goal not met / not set')
  })

  it('opportunities contains one entry per F. entry', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Alpha', description: 'Alpha feature description' },
        { id: 'F.Beta', description: 'Beta feature' },
      ],
    })
    const { swot } = useSwotAnalysis([block])
    expect(swot.value.opportunities).toHaveLength(2)
  })

  it('opportunities label uses format: id + ": " + description.slice(0,40)', () => {
    const block = makeBlock({
      functions: [{ id: 'F.MyFeature', description: 'A short description' }],
    })
    const { swot } = useSwotAnalysis([block])
    expect(swot.value.opportunities[0]).toBe('F.MyFeature: A short description')
  })

  it('opportunities truncates description at 40 chars', () => {
    const longDesc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const block = makeBlock({
      functions: [{ id: 'F.Long', description: longDesc }],
    })
    const { swot } = useSwotAnalysis([block])
    const opp = swot.value.opportunities[0]
    // "F.Long: " + 40 chars
    expect(opp).toBe(`F.Long: ${longDesc.slice(0, 40)}`)
  })

  it('threats contains V. entries where meter is missing', () => {
    const block = makeBlock({
      values: [{ id: 'V.NoMeter', meter: '', goal: '100' }],
    })
    const { swot } = useSwotAnalysis([block])
    const found = swot.value.threats.some((t) => t.includes('V.NoMeter'))
    expect(found).toBe(true)
  })

  it('threats contains S. entries where description is empty', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.EmptyDesc', description: '' }],
    })
    const { swot } = useSwotAnalysis([block])
    const found = swot.value.threats.some((t) => t.includes('S.EmptyDesc'))
    expect(found).toBe(true)
  })

  it('threat label uses format: id + " — incomplete spec coverage"', () => {
    const block = makeBlock({
      values: [{ id: 'V.ThreatItem', meter: '', goal: '50' }],
    })
    const { swot } = useSwotAnalysis([block])
    expect(swot.value.threats[0]).toBe('V.ThreatItem — incomplete spec coverage')
  })

  it('empty blocks produces empty strengths, weaknesses, opportunities, and threats', () => {
    const { swot } = useSwotAnalysis([])
    expect(swot.value.strengths).toHaveLength(0)
    expect(swot.value.weaknesses).toHaveLength(0)
    expect(swot.value.opportunities).toHaveLength(0)
    expect(swot.value.threats).toHaveLength(0)
  })

  it('copyMarkdown writes all 4 sections', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const block = makeBlock({
      functions: [{ id: 'F.Feature', description: 'Test feature' }],
      values: [{ id: 'V.TestVal', goal: '100', tolerable: '50' }],
    })
    const { copyMarkdown } = useSwotAnalysis([block])
    await copyMarkdown()
    expect(writeText).toHaveBeenCalledOnce()
    const text: string = writeText.mock.calls[0][0]
    expect(text).toContain('Strengths')
    expect(text).toContain('Weaknesses')
    expect(text).toContain('Opportunities')
    expect(text).toContain('Threats')
  })

  it('copied starts false, flips true after copyMarkdown, reverts to false after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const block = makeBlock({
      functions: [{ id: 'F.CopyTest', description: 'test' }],
    })
    const { copyMarkdown, copied } = useSwotAnalysis([block])
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })
})
