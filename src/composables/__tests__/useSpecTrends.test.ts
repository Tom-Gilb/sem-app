// UNIT_TYPE=Test
// Feature #93 — useSpecTrends composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { DashboardEntry } from '../useProjectDashboard'
import type { SpecBlock } from '../../types/spec'
import { useSpecTrends } from '../useSpecTrends'

function makeSpec(vCount: number, fCount: number): SpecBlock {
  return {
    functions: Array.from({ length: fCount }, (_, i) => ({
      id: `F.Func${i}`,
      type: 'Function',
      level: 'Product',
      description: `Function number ${i} does something useful`,
      successCriteria: `Criteria ${i}`,
      functionOfValue: `V.Val${i}`,
    })),
    values: Array.from({ length: vCount }, (_, i) => ({
      id: `V.Val${i}`,
      type: 'Value',
      level: 'Product',
      description: `Value number ${i} measures something important`,
      scale: `Scale ${i}`,
      meter: `Meter ${i}`,
      status: `Status ${i}`,
      tolerable: `Tolerable ${i}`,
      goal: `Goal ${i}`,
      valueOfFunction: `F.Func${i}`,
    })),
    solutions: [],
  }
}

function makeEntry(overrides: Partial<DashboardEntry> = {}): DashboardEntry {
  const spec = overrides.spec ?? makeSpec(2, 2)
  return {
    id: crypto.randomUUID(),
    name: 'Test Spec',
    domain: 'Product',
    qualityScore: 70,
    entryCount: spec.functions.length + spec.values.length + spec.solutions.length,
    createdAt: new Date(),
    spec,
    ...overrides,
  }
}

describe('useSpecTrends', () => {
  it('trendsOpen is false initially', () => {
    const entries = ref<DashboardEntry[]>([])
    const { trendsOpen } = useSpecTrends(entries)
    expect(trendsOpen.value).toBe(false)
  })

  it('series is empty when there are 0 specs', () => {
    const entries = ref<DashboardEntry[]>([])
    const { series } = useSpecTrends(entries)
    expect(series.value).toHaveLength(0)
  })

  it('series is empty when there is only 1 spec', () => {
    const entries = ref<DashboardEntry[]>([makeEntry()])
    const { series } = useSpecTrends(entries)
    expect(series.value).toHaveLength(0)
  })

  it('series has 3 entries when there are 2 or more specs', () => {
    const entries = ref<DashboardEntry[]>([makeEntry(), makeEntry()])
    const { series } = useSpecTrends(entries)
    expect(series.value).toHaveLength(3)
  })

  it('series names include "Quality Score", "Word Count", "RICE Avg"', () => {
    const entries = ref<DashboardEntry[]>([makeEntry(), makeEntry()])
    const { series } = useSpecTrends(entries)
    const names = series.value.map(s => s.name)
    expect(names).toContain('Quality Score')
    expect(names).toContain('Word Count')
    expect(names).toContain('RICE Avg')
  })

  it('series[0].values.length equals savedSpecs length', () => {
    const entries = ref<DashboardEntry[]>([makeEntry(), makeEntry(), makeEntry()])
    const { series } = useSpecTrends(entries)
    expect(series.value[0].values).toHaveLength(3)
  })

  it('series[0].min is <= series[0].latest', () => {
    const entries = ref<DashboardEntry[]>([
      makeEntry({ qualityScore: 40 }),
      makeEntry({ qualityScore: 60 }),
      makeEntry({ qualityScore: 80 }),
    ])
    const { series } = useSpecTrends(entries)
    const s = series.value[0]
    expect(s.min).toBeLessThanOrEqual(s.latest)
  })

  it('series[0].max is >= series[0].latest', () => {
    const entries = ref<DashboardEntry[]>([
      makeEntry({ qualityScore: 40 }),
      makeEntry({ qualityScore: 60 }),
      makeEntry({ qualityScore: 80 }),
    ])
    const { series } = useSpecTrends(entries)
    const s = series.value[0]
    expect(s.max).toBeGreaterThanOrEqual(s.latest)
  })

  it('trend is one of the three expected emoji values', () => {
    const entries = ref<DashboardEntry[]>([makeEntry(), makeEntry()])
    const { series } = useSpecTrends(entries)
    const validTrends = ['📈', '📉', '→']
    for (const s of series.value) {
      expect(validTrends).toContain(s.trend)
    }
  })

  it('sparklinePath is a non-empty string when values.length >= 2', () => {
    const entries = ref<DashboardEntry[]>([makeEntry(), makeEntry()])
    const { series } = useSpecTrends(entries)
    for (const s of series.value) {
      expect(typeof s.sparklinePath).toBe('string')
      expect(s.sparklinePath.length).toBeGreaterThan(0)
    }
  })
})
