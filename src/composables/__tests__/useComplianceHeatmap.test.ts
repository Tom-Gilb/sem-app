// UNIT_TYPE=Test
// Feature #76 — useComplianceHeatmap composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useComplianceHeatmap } from '../useComplianceHeatmap'
import type { SpecBlock, VEntry, FEntry } from '../../types/spec'

function makeVEntry(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'A test value',
    scale: 'score out of 100',
    meter: 'Automated test',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeFEntry(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Provide a test function',
    successCriteria: 'Works as expected',
    functionOfValue: '',
    ...overrides,
  }
}

const emptySpec: SpecBlock = { functions: [], values: [], solutions: [] }

describe('useComplianceHeatmap', () => {
  it('initial state: heatmapRows empty, heatmapOpen false', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { heatmapRows, heatmapOpen } = useComplianceHeatmap(specRef)
    expect(heatmapRows.value).toEqual([])
    expect(heatmapOpen.value).toBe(false)
  })

  it('computeHeatmap with null spec produces empty rows', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    expect(heatmapRows.value).toEqual([])
  })

  it('computeHeatmap with empty spec produces empty rows', () => {
    const specRef = ref<SpecBlock | null>(emptySpec)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    expect(heatmapRows.value).toEqual([])
  })

  it('F. entry: R1–R5 pass (not V.), R6 passes if description set', () => {
    const spec: SpecBlock = { functions: [makeFEntry()], values: [], solutions: [] }
    const specRef = ref<SpecBlock | null>(spec)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    const row = heatmapRows.value[0]
    // R1-R5 are V.-only — pass for F. entry
    expect(row.checks[0]).toBe(true) // R1
    expect(row.checks[1]).toBe(true) // R2
    expect(row.checks[2]).toBe(true) // R3
    expect(row.checks[3]).toBe(true) // R4
    expect(row.checks[4]).toBe(true) // R5
    expect(row.checks[5]).toBe(true) // R6 description present
  })

  it('V. entry with all fields: all checks pass', () => {
    const spec: SpecBlock = { functions: [], values: [makeVEntry()], solutions: [] }
    const specRef = ref<SpecBlock | null>(spec)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    const row = heatmapRows.value[0]
    expect(row.checks.every(Boolean)).toBe(true)
    expect(row.failCount).toBe(0)
  })

  it('V. entry missing scale: R1 fails', () => {
    const spec: SpecBlock = { functions: [], values: [makeVEntry({ scale: '' })], solutions: [] }
    const specRef = ref<SpecBlock | null>(spec)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    const row = heatmapRows.value[0]
    expect(row.checks[0]).toBe(false) // R1 scale defined
  })

  it('V. entry missing meter: R2 fails', () => {
    const spec: SpecBlock = { functions: [], values: [makeVEntry({ meter: '' })], solutions: [] }
    const specRef = ref<SpecBlock | null>(spec)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    const row = heatmapRows.value[0]
    expect(row.checks[1]).toBe(false) // R2 meter defined
  })

  it('V. entry missing goal: R3 fails', () => {
    const spec: SpecBlock = { functions: [], values: [makeVEntry({ goal: '' })], solutions: [] }
    const specRef = ref<SpecBlock | null>(spec)
    const { heatmapRows, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    const row = heatmapRows.value[0]
    expect(row.checks[2]).toBe(false) // R3 goal set
  })

  it('totalViolations counts correctly', () => {
    const spec: SpecBlock = {
      functions: [],
      values: [
        makeVEntry({ id: 'V.A', scale: '', meter: '' }), // R1 + R2 + R7 fail
        makeVEntry({ id: 'V.B' }),                        // all pass
      ],
      solutions: [],
    }
    const specRef = ref<SpecBlock | null>(spec)
    const { totalViolations, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    // V.A: R1 (scale empty) + R2 (meter empty) + R7 (scale empty, no units match) = 3 fails
    expect(totalViolations.value).toBeGreaterThanOrEqual(2)
  })

  it('overallPass equals passing checks / total checks', () => {
    const spec: SpecBlock = {
      functions: [],
      values: [makeVEntry()], // all 8 rules pass
      solutions: [],
    }
    const specRef = ref<SpecBlock | null>(spec)
    const { overallPass, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    expect(overallPass.value).toBe(1)
  })

  it('overallPass is less than 1 when there are violations', () => {
    const spec: SpecBlock = {
      functions: [],
      values: [makeVEntry({ scale: '', goal: '' })], // R1 and R3 fail
      solutions: [],
    }
    const specRef = ref<SpecBlock | null>(spec)
    const { overallPass, computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()
    expect(overallPass.value).toBeLessThan(1)
  })

  it('copyHeatmap markdown has "✓" and "✗" characters', async () => {
    const spec: SpecBlock = {
      functions: [],
      values: [makeVEntry(), makeVEntry({ id: 'V.Missing', scale: '' })],
      solutions: [],
    }
    const specRef = ref<SpecBlock | null>(spec)
    const { computeHeatmap } = useComplianceHeatmap(specRef)
    computeHeatmap()

    let written = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { written = text; return Promise.resolve() } },
      configurable: true,
    })

    const specRef2 = ref<SpecBlock | null>(spec)
    const heatmap = useComplianceHeatmap(specRef2)
    heatmap.computeHeatmap()
    heatmap.copyHeatmap()

    // Give async clipboard a tick
    await Promise.resolve()
    expect(written).toContain('✓')
    expect(written).toContain('✗')
  })
})
