// UNIT_TYPE=Test
// Tests for useSpecComparison composable (Feature #74)

import { describe, it, expect } from 'vitest'
import { useSpecComparison } from '../useSpecComparison'
import type { DashboardEntry } from '../useProjectDashboard'
import type { SpecBlock } from '../../types/spec'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(id: string, spec: SpecBlock): DashboardEntry {
  return {
    id,
    name: `Spec ${id}`,
    domain: 'General',
    qualityScore: 50,
    entryCount: spec.functions.length + spec.values.length + spec.solutions.length,
    createdAt: new Date(),
    spec,
  }
}

const baseSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Auth',
      type: 'Function',
      level: 'Product',
      description: 'Authenticate users',
      successCriteria: '100% success rate',
      functionOfValue: 'V.AuthRate',
    },
  ],
  values: [
    {
      id: 'V.AuthRate',
      type: 'Value',
      level: 'Product',
      description: 'Auth success rate',
      scale: '% logins',
      meter: 'Server logs',
      status: 'pre-build',
      tolerable: '99%',
      goal: '99.9%',
      valueOfFunction: 'F.Auth',
    },
  ],
  solutions: [
    {
      id: 'S.OAuth',
      type: 'Solution',
      level: 'Product',
      description: 'Integrate OAuth',
      impact: 'V.AuthRate ~99.9%',
      function: 'F.Auth',
    },
  ],
}

// Deep clone utility for test isolation
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

const entryA = makeEntry('entry-a', clone(baseSpec))
const entryB = makeEntry('entry-b', clone(baseSpec))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSpecComparison', () => {
  it('initial state: selectedIds is empty and canCompare is false', () => {
    const { selectedIds, canCompare } = useSpecComparison()
    expect(selectedIds.value).toHaveLength(0)
    expect(canCompare.value).toBe(false)
  })

  it('toggleSelect adds an ID to selectedIds', () => {
    const { selectedIds, toggleSelect } = useSpecComparison()
    toggleSelect('entry-a')
    expect(selectedIds.value).toContain('entry-a')
    expect(selectedIds.value).toHaveLength(1)
  })

  it('toggleSelect with 2 different IDs: canCompare becomes true', () => {
    const { selectedIds, canCompare, toggleSelect } = useSpecComparison()
    toggleSelect('entry-a')
    toggleSelect('entry-b')
    expect(selectedIds.value).toHaveLength(2)
    expect(canCompare.value).toBe(true)
  })

  it('toggleSelect removes an already-selected ID', () => {
    const { selectedIds, toggleSelect } = useSpecComparison()
    toggleSelect('entry-a')
    toggleSelect('entry-b')
    toggleSelect('entry-a') // deselect
    expect(selectedIds.value).not.toContain('entry-a')
    expect(selectedIds.value).toHaveLength(1)
  })

  it('toggleSelect with 2 selected + new ID: replaces second slot', () => {
    const { selectedIds, toggleSelect } = useSpecComparison()
    toggleSelect('entry-a')
    toggleSelect('entry-b')
    toggleSelect('entry-c') // should replace entry-b
    expect(selectedIds.value[0]).toBe('entry-a')
    expect(selectedIds.value[1]).toBe('entry-c')
    expect(selectedIds.value).toHaveLength(2)
  })

  it('compareSpecs with identical specs: isIdentical=true, changedEntries=0', () => {
    const { compareSpecs } = useSpecComparison()
    const result = compareSpecs(entryA, entryB)
    expect(result.isIdentical).toBe(true)
    expect(result.changedEntries).toBe(0)
  })

  it('compareSpecs with one entry added to B: entriesOnlyInB = 1', () => {
    const { compareSpecs } = useSpecComparison()
    const specWithExtra = clone(baseSpec)
    specWithExtra.functions.push({
      id: 'F.Logging',
      type: 'Function',
      level: 'Product',
      description: 'Log user actions',
      successCriteria: 'All actions logged',
      functionOfValue: 'V.AuditRate',
    })
    const entryBExtra = makeEntry('entry-b-extra', specWithExtra)
    const result = compareSpecs(entryA, entryBExtra)
    expect(result.entriesOnlyInB).toBe(1)
  })

  it('compareSpecs with one entry removed from B (present only in A): entriesOnlyInA = 1', () => {
    const { compareSpecs } = useSpecComparison()
    const specMissing = clone(baseSpec)
    specMissing.solutions = [] // remove the solution
    const entryBMissing = makeEntry('entry-b-missing', specMissing)
    const result = compareSpecs(entryA, entryBMissing)
    expect(result.entriesOnlyInA).toBe(1)
  })

  it('compareSpecs with changed field: changedEntries = 1, affected field marked changed', () => {
    const { compareSpecs } = useSpecComparison()
    const specChanged = clone(baseSpec)
    specChanged.values[0].goal = '99.99%' // change the goal field
    const entryBChanged = makeEntry('entry-b-changed', specChanged)
    const result = compareSpecs(entryA, entryBChanged)
    expect(result.changedEntries).toBe(1)
    const valueDiff = result.entryDiffs.find(d => d.id === 'V.AuthRate')
    expect(valueDiff).toBeDefined()
    const goalField = valueDiff!.fields.find(f => f.fieldName === 'goal')
    expect(goalField?.changed).toBe(true)
    expect(goalField?.valueA).toBe('99.9%')
    expect(goalField?.valueB).toBe('99.99%')
  })

  it('compareSpecs: sharedEntries + entriesOnlyInA + entriesOnlyInB = total unique entry count', () => {
    const { compareSpecs } = useSpecComparison()
    // B has one extra function, A has all original (3 entries), B has 4 entries
    const specExtra = clone(baseSpec)
    specExtra.functions.push({
      id: 'F.Extra',
      type: 'Function',
      level: 'Product',
      description: 'Extra',
      successCriteria: '',
      functionOfValue: '',
    })
    const entryBExtra = makeEntry('entry-b-extra2', specExtra)
    const result = compareSpecs(entryA, entryBExtra)
    const total = result.sharedEntries + result.entriesOnlyInA + result.entriesOnlyInB
    // Total unique IDs: F.Auth, V.AuthRate, S.OAuth (shared) + F.Extra (only in B) = 4
    expect(total).toBe(4)
  })

  it('copyComparisonTable output includes "Spec A" and "Spec B" headers', () => {
    const { compareSpecs, copyComparisonTable } = useSpecComparison()
    const result = compareSpecs(entryA, entryB)
    let captured = ''
    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { captured = text; return Promise.resolve() } },
      configurable: true,
    })
    copyComparisonTable(result, 'Spec A', 'Spec B')
    expect(captured).toContain('Spec A')
    expect(captured).toContain('Spec B')
  })

  it('copyComparisonTable includes "≠" symbol for changed entries', () => {
    const { compareSpecs, copyComparisonTable } = useSpecComparison()
    const specChanged = clone(baseSpec)
    specChanged.values[0].scale = 'new scale'
    const entryBChanged = makeEntry('entry-b-diff', specChanged)
    const result = compareSpecs(entryA, entryBChanged)
    let captured = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { captured = text; return Promise.resolve() } },
      configurable: true,
    })
    copyComparisonTable(result, 'Spec A', 'Spec B')
    expect(captured).toContain('≠')
  })
})
