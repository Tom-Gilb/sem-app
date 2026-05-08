// UNIT_TYPE=Test
// Feature #105 — useSpecBenchmark composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSpecBenchmark } from '../useSpecBenchmark'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'Test value',
    scale: 'percent',
    meter: 'Automated',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80%',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution',
    impact: '',
    function: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [makeF()],
    values: [makeV()],
    solutions: [makeS()],
    ...overrides,
  }
}

describe('useSpecBenchmark', () => {
  it('benchmarkOpen is initially false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { benchmarkOpen } = useSpecBenchmark(spec)
    expect(benchmarkOpen.value).toBe(false)
  })

  it('benchmarks record is empty for null spec', () => {
    const spec = ref<SpecBlock | null>(null)
    const { benchmarks } = useSpecBenchmark(spec)
    expect(Object.keys(benchmarks.value)).toHaveLength(0)
  })

  it('comparisonRows is populated from spec with V. entries', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 80%' })],
    }))
    const { comparisonRows } = useSpecBenchmark(spec)
    expect(comparisonRows.value).toHaveLength(1)
    expect(comparisonRows.value[0].id).toBe('V.Alpha')
  })

  it('setBenchmark updates the record', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha' })],
    }))
    const { benchmarks, setBenchmark } = useSpecBenchmark(spec)
    setBenchmark('V.Alpha', '70')
    expect(benchmarks.value['V.Alpha']).toBe('70')
  })

  it('goalNumeric is parsed from "80%" → 80', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 80%' })],
    }))
    const { comparisonRows } = useSpecBenchmark(spec)
    expect(comparisonRows.value[0].goalNumeric).toBe(80)
  })

  it('benchmarkNumeric is parsed from "70" → 70', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 80%' })],
    }))
    const { comparisonRows, setBenchmark } = useSpecBenchmark(spec)
    setBenchmark('V.Alpha', '70')
    expect(comparisonRows.value[0].benchmarkNumeric).toBe(70)
  })

  it('gap = goalNumeric - benchmarkNumeric = 10', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 80%' })],
    }))
    const { comparisonRows, setBenchmark } = useSpecBenchmark(spec)
    setBenchmark('V.Alpha', '70')
    expect(comparisonRows.value[0].gap).toBe(10)
  })

  it('gapPositive is true when goal > benchmark', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 80%' })],
    }))
    const { comparisonRows, setBenchmark } = useSpecBenchmark(spec)
    setBenchmark('V.Alpha', '70')
    expect(comparisonRows.value[0].gapPositive).toBe(true)
  })

  it('gapPositive is false when goal < benchmark', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 60%' })],
    }))
    const { comparisonRows, setBenchmark } = useSpecBenchmark(spec)
    setBenchmark('V.Alpha', '70')
    expect(comparisonRows.value[0].gapPositive).toBe(false)
  })

  it('gap is null when benchmark is empty string', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Alpha', goal: 'Goal [2026] 80%' })],
    }))
    const { comparisonRows } = useSpecBenchmark(spec)
    // benchmark defaults to "" — gap should be null
    expect(comparisonRows.value[0].gap).toBeNull()
  })
})
