// UNIT_TYPE=Test
// Feature #112 — useRoiCalculator composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useRoiCalculator, parseExpectedValue, computeRoi, computeBreakeven } from '../useRoiCalculator'
import type { SpecBlock } from '../../types/spec'

function makeBlock(values: Array<{ id: string; goal?: string }>): SpecBlock {
  return {
    functions: [],
    values: values.map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: `Desc for ${v.id}`,
      scale: '',
      meter: '',
      status: '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

describe('parseExpectedValue', () => {
  it('returns 10000 when goal is empty', () => {
    expect(parseExpectedValue('')).toBe(10000)
  })

  it('extracts first numeric value × 0.6', () => {
    expect(parseExpectedValue('Goal: 50000')).toBeCloseTo(30000)
  })

  it('handles comma-formatted numbers', () => {
    expect(parseExpectedValue('Goal: 1,000,000 users')).toBeCloseTo(600000)
  })

  it('returns 10000 when no numeric value found', () => {
    expect(parseExpectedValue('Goal: no numbers here')).toBe(10000)
  })

  it('uses first number when multiple present', () => {
    expect(parseExpectedValue('100 or 200 target')).toBeCloseTo(60)
  })
})

describe('computeRoi', () => {
  it('returns Infinity when cost is 0', () => {
    expect(computeRoi(10000, 0)).toBe(Infinity)
  })

  it('returns expectedValue / cost', () => {
    expect(computeRoi(10000, 5000)).toBe(2)
  })

  it('returns 0 when expectedValue is 0 and cost > 0', () => {
    expect(computeRoi(0, 1000)).toBe(0)
  })

  it('returns fractional ROI', () => {
    expect(computeRoi(1000, 3000)).toBeCloseTo(0.333, 2)
  })
})

describe('computeBreakeven', () => {
  it('returns "N/A" when cost is 0', () => {
    expect(computeBreakeven(10000, 0)).toBe('N/A')
  })

  it('returns "N/A" when expectedValue is 0', () => {
    expect(computeBreakeven(0, 5000)).toBe('N/A')
  })

  it('returns months string with 1 decimal', () => {
    const result = computeBreakeven(12000, 12000)
    // 12000 / (12000/12) = 12 months
    expect(result).toBe('12.0 months')
  })

  it('returns fractional months', () => {
    const result = computeBreakeven(24000, 6000)
    // 6000 / (24000/12) = 6000 / 2000 = 3.0 months
    expect(result).toBe('3.0 months')
  })
})

describe('useRoiCalculator', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('entries is empty when spec is null', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { entries } = useRoiCalculator(specRef)
    expect(entries.value).toHaveLength(0)
  })

  it('entries is built from V. entries when spec is provided', () => {
    const block = makeBlock([{ id: 'V.Alpha' }, { id: 'V.Beta' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries } = useRoiCalculator(specRef)
    expect(entries.value).toHaveLength(2)
  })

  it('entry id matches V. entry id', () => {
    const block = makeBlock([{ id: 'V.EntryFluency' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries } = useRoiCalculator(specRef)
    expect(entries.value[0].id).toBe('V.EntryFluency')
  })

  it('initial cost is 0', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries } = useRoiCalculator(specRef)
    expect(entries.value[0].cost).toBe(0)
  })

  it('initial roi is Infinity when cost is 0', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries } = useRoiCalculator(specRef)
    expect(entries.value[0].roi).toBe(Infinity)
  })

  it('initial breakeven is "N/A" when cost is 0', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries } = useRoiCalculator(specRef)
    expect(entries.value[0].breakeven).toBe('N/A')
  })

  it('updateCost recalculates roi', () => {
    const block = makeBlock([{ id: 'V.Alpha', goal: 'Goal: 12000' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries, updateCost } = useRoiCalculator(specRef)
    // ev = 12000 * 0.6 = 7200
    updateCost('V.Alpha', 3600)
    expect(entries.value[0].roi).toBeCloseTo(2)
  })

  it('updateCost recalculates breakeven', () => {
    const block = makeBlock([{ id: 'V.Alpha', goal: 'Goal: 24000' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries, updateCost } = useRoiCalculator(specRef)
    // ev = 24000 * 0.6 = 14400
    // breakeven = 6000 / (14400/12) = 6000/1200 = 5.0 months
    updateCost('V.Alpha', 6000)
    expect(entries.value[0].breakeven).toBe('5.0 months')
  })

  it('updateCost clamps negative cost to 0', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const specRef = ref<SpecBlock | null>(block)
    const { entries, updateCost } = useRoiCalculator(specRef)
    updateCost('V.Alpha', -500)
    expect(entries.value[0].cost).toBe(0)
  })

  it('sortedByRoi places Infinity entries last', () => {
    const block = makeBlock([{ id: 'V.Alpha', goal: 'Goal: 12000' }, { id: 'V.Beta', goal: 'Goal: 5000' }])
    const specRef = ref<SpecBlock | null>(block)
    const { sortedByRoi, updateCost } = useRoiCalculator(specRef)
    // V.Alpha: ev=7200, cost=3600, roi=2
    updateCost('V.Alpha', 3600)
    // V.Beta: cost=0, roi=Infinity — should be last
    const sorted = sortedByRoi.value
    expect(sorted[sorted.length - 1].roi).toBe(Infinity)
  })

  it('sortedByRoi orders by descending roi (non-Infinity)', () => {
    const block = makeBlock([
      { id: 'V.Low', goal: 'Goal: 1000' },
      { id: 'V.High', goal: 'Goal: 9000' },
    ])
    const specRef = ref<SpecBlock | null>(block)
    const { sortedByRoi, updateCost } = useRoiCalculator(specRef)
    // ev Low = 600, roi = 600/1000 = 0.6
    updateCost('V.Low', 1000)
    // ev High = 5400, roi = 5400/1000 = 5.4
    updateCost('V.High', 1000)
    expect(sortedByRoi.value[0].id).toBe('V.High')
  })

  it('exportMarkdown returns pipe-delimited table', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const specRef = ref<SpecBlock | null>(block)
    const { exportMarkdown } = useRoiCalculator(specRef)
    const md = exportMarkdown()
    expect(md).toContain('|')
    expect(md).toContain('Name')
    expect(md).toContain('ROI')
  })

  it('copied is false initially', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { copied } = useRoiCalculator(specRef)
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown sets copied to true', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const block = makeBlock([{ id: 'V.Alpha' }])
    const specRef = ref<SpecBlock | null>(block)
    const { copyMarkdown, copied } = useRoiCalculator(specRef)
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })
})
