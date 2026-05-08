// UNIT_TYPE=Test
// Tests for useSpecHistory composable (Feature #29)

import { describe, it, expect, beforeEach } from 'vitest'
import { useSpecHistory } from '../useSpecHistory'
import type { SpecBlock } from '../../types/spec'

function makeSpec(description: string): SpecBlock {
  return {
    functions: [
      {
        id: 'F.Test',
        type: 'Function',
        level: 'Product',
        description: 'Test function',
        successCriteria: 'Success',
        functionOfValue: 'V.Test',
      },
    ],
    values: [
      {
        id: 'V.Test',
        type: 'Value',
        level: 'Product',
        description,
        scale: 'Units',
        meter: 'Observation',
        status: 'pre-build',
        tolerable: '50%',
        goal: '80%',
        valueOfFunction: 'F.Test',
      },
    ],
    solutions: [
      {
        id: 'S.Test',
        type: 'Solution',
        level: 'Product',
        description: 'Test solution',
        impact: 'V.Test ~80%',
        function: 'F.Test',
      },
    ],
  }
}

describe('useSpecHistory', () => {
  let composable: ReturnType<typeof useSpecHistory>

  beforeEach(() => {
    composable = useSpecHistory()
    composable.clearHistory()
  })

  it('addVersion adds to history (newest first)', () => {
    const { history, addVersion } = composable
    const spec1 = makeSpec('First spec')
    const spec2 = makeSpec('Second spec')
    addVersion(spec1, 'Generated')
    addVersion(spec2, 'Make Ambitious')
    expect(history.value).toHaveLength(2)
    // Newest first
    expect(history.value[0].spec.values[0].description).toBe('Second spec')
    expect(history.value[1].spec.values[0].description).toBe('First spec')
    expect(history.value[0].label).toBe('Make Ambitious')
    expect(history.value[1].label).toBe('Generated')
  })

  it('enforces max 10 versions (11th oldest is dropped)', () => {
    const { history, addVersion } = composable
    for (let i = 1; i <= 11; i++) {
      addVersion(makeSpec(`Spec ${i}`), 'Generated')
    }
    expect(history.value).toHaveLength(10)
    // Newest is spec 11, oldest remaining is spec 2 (spec 1 was dropped)
    expect(history.value[0].spec.values[0].description).toBe('Spec 11')
    expect(history.value[9].spec.values[0].description).toBe('Spec 2')
  })

  it('restoreVersion returns the correct spec', () => {
    const { addVersion, restoreVersion, history } = composable
    const spec = makeSpec('Restore me')
    addVersion(spec, 'Generated')
    const id = history.value[0].id
    const restored = restoreVersion(id)
    expect(restored).not.toBeNull()
    expect(restored!.values[0].description).toBe('Restore me')
  })

  it('restoreVersion returns null for unknown id', () => {
    const { restoreVersion } = composable
    expect(restoreVersion('non-existent-id')).toBeNull()
  })

  it('restoreVersion does NOT remove the version from history', () => {
    const { addVersion, restoreVersion, history } = composable
    addVersion(makeSpec('Keep me'), 'Generated')
    const id = history.value[0].id
    restoreVersion(id)
    expect(history.value).toHaveLength(1)
  })

  it('clearHistory empties the array', () => {
    const { addVersion, clearHistory, history } = composable
    addVersion(makeSpec('Spec A'), 'Generated')
    addVersion(makeSpec('Spec B'), 'Lean Plan')
    expect(history.value).toHaveLength(2)
    clearHistory()
    expect(history.value).toHaveLength(0)
  })

  it('summary is truncated to 60 characters', () => {
    const { addVersion, history } = composable
    const longDesc = 'A'.repeat(80)
    addVersion(makeSpec(longDesc), 'Generated')
    expect(history.value[0].summary.length).toBeLessThanOrEqual(60)
  })

  it('summary is NOT truncated when description is 60 chars or fewer', () => {
    const { addVersion, history } = composable
    const shortDesc = 'Short description'
    addVersion(makeSpec(shortDesc), 'Generated')
    expect(history.value[0].summary).toBe(shortDesc)
  })
})
