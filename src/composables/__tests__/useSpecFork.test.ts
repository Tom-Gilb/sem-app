// UNIT_TYPE=Test
// Tests for useSpecFork composable (Feature #49)

import { describe, it, expect } from 'vitest'
import { useSpecFork } from '../useSpecFork'
import type { SpecBlock } from '../../types/spec'

const mockSpec: SpecBlock = {
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
      scale: '% of logins succeeding',
      meter: 'Server logs',
      status: 'pre-build',
      tolerable: '99%',
      goal: '99.9%',
      valueOfFunction: 'F.Auth',
    },
  ],
  solutions: [
    {
      id: 'S.OAuthIntegration',
      type: 'Solution',
      level: 'Product',
      description: 'Integrate OAuth provider',
      impact: 'V.AuthRate ~99.9%',
      function: 'F.Auth',
    },
  ],
}

function deepClone(spec: SpecBlock): SpecBlock {
  return JSON.parse(JSON.stringify(spec))
}

describe('useSpecFork', () => {
  it('forkedSpec starts null', () => {
    const { forkedSpec } = useSpecFork()
    expect(forkedSpec.value).toBeNull()
  })

  it('forkSpec(mockSpec) → forkedSpec is a deep clone (not the same reference)', () => {
    const { forkedSpec, forkSpec } = useSpecFork()
    forkSpec(mockSpec)
    expect(forkedSpec.value).not.toBeNull()
    expect(forkedSpec.value).not.toBe(mockSpec) // different reference
    expect(forkedSpec.value).toEqual(mockSpec)   // same content
    // Mutating the fork should not affect original
    forkedSpec.value!.functions[0].description = 'Changed'
    expect(mockSpec.functions[0].description).toBe('Authenticate users')
  })

  it('mergeSpecs(spec, identicalSpec) → 0 conflicts', () => {
    const { mergeSpecs } = useSpecFork()
    const result = mergeSpecs(mockSpec, deepClone(mockSpec))
    expect(result.conflicts).toHaveLength(0)
  })

  it('mergeSpecs(spec, specWithDifferentGoal) → 1 conflict on "goal" field', () => {
    const { mergeSpecs } = useSpecFork()
    const forked = deepClone(mockSpec)
    forked.values[0].goal = '99.99%'
    const result = mergeSpecs(mockSpec, forked)
    const goalConflict = result.conflicts.find(c => c.field === 'goal' && c.entryId === 'V.AuthRate')
    expect(goalConflict).toBeDefined()
    expect(goalConflict?.original).toBe('99.9%')
    expect(goalConflict?.forked).toBe('99.99%')
    expect(result.conflicts).toHaveLength(1)
  })

  it('mergeSpecs(spec, specWithExtraEntry) → merged includes the extra entry, 0 conflicts', () => {
    const { mergeSpecs } = useSpecFork()
    const forked = deepClone(mockSpec)
    forked.functions.push({
      id: 'F.Logging',
      type: 'Function',
      level: 'Product',
      description: 'Log all events',
      successCriteria: '100% events logged',
      functionOfValue: 'V.LogRate',
    })
    const result = mergeSpecs(mockSpec, forked)
    expect(result.conflicts).toHaveLength(0)
    const extra = result.merged.functions.find(f => f.id === 'F.Logging')
    expect(extra).toBeDefined()
    expect(extra?.description).toBe('Log all events')
  })

  it('clearFork() → forkedSpec back to null', () => {
    const { forkedSpec, forkSpec, clearFork } = useSpecFork()
    forkSpec(mockSpec)
    expect(forkedSpec.value).not.toBeNull()
    clearFork()
    expect(forkedSpec.value).toBeNull()
  })

  it('clearFork() → mergeResult and isMerged also reset', () => {
    const { mergeResult, isMerged, forkSpec, mergeSpecs, clearFork } = useSpecFork()
    forkSpec(mockSpec)
    mergeSpecs(mockSpec, deepClone(mockSpec))
    expect(isMerged.value).toBe(true)
    expect(mergeResult.value).not.toBeNull()
    clearFork()
    expect(isMerged.value).toBe(false)
    expect(mergeResult.value).toBeNull()
  })
})
