// UNIT_TYPE=Test
// Tests for useSpecDiff composable (Feature #26)

import { describe, it, expect } from 'vitest'
import { useSpecDiff } from '../useSpecDiff'
import type { SpecBlock } from '../../types/spec'

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

describe('useSpecDiff — diffSpecs', () => {
  const { diffSpecs } = useSpecDiff()

  it('same spec returns empty array', () => {
    const changes = diffSpecs(baseSpec, deepClone(baseSpec))
    expect(changes).toHaveLength(0)
  })

  it('changed goal field returns one FieldChange with correct old/new values', () => {
    const newSpec = deepClone(baseSpec)
    newSpec.values[0].goal = '99.99%'

    const changes = diffSpecs(baseSpec, newSpec)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      entryId: 'V.AuthRate',
      entryType: 'V',
      field: 'goal',
      oldValue: '99.9%',
      newValue: '99.99%',
    })
  })

  it('new V. entry in newSpec → oldValue "(new entry)"', () => {
    const newSpec = deepClone(baseSpec)
    newSpec.values.push({
      id: 'V.UserRetention',
      type: 'Value',
      level: 'Product',
      description: 'User retention rate',
      scale: '% retained after 30 days',
      meter: 'Analytics',
      status: 'pre-build',
      tolerable: '60%',
      goal: '80%',
      valueOfFunction: 'F.Auth',
    })

    const changes = diffSpecs(baseSpec, newSpec)
    expect(changes.length).toBeGreaterThan(0)
    const newEntryChanges = changes.filter((c) => c.entryId === 'V.UserRetention')
    expect(newEntryChanges.length).toBeGreaterThan(0)
    expect(newEntryChanges.every((c) => c.oldValue === '(new entry)')).toBe(true)
  })

  it('removed F. entry → newValue "(removed)"', () => {
    const newSpec = deepClone(baseSpec)
    newSpec.functions = []

    const changes = diffSpecs(baseSpec, newSpec)
    expect(changes.length).toBeGreaterThan(0)
    const removedChanges = changes.filter((c) => c.entryId === 'F.Auth')
    expect(removedChanges.length).toBeGreaterThan(0)
    expect(removedChanges.every((c) => c.newValue === '(removed)')).toBe(true)
  })

  it('multiple changes across F./V./S. all returned', () => {
    const newSpec = deepClone(baseSpec)
    // Change V. goal
    newSpec.values[0].goal = '99.99%'
    // Change F. description
    newSpec.functions[0].description = 'Authenticate users securely'
    // Change S. impact
    newSpec.solutions[0].impact = 'V.AuthRate ~99.99%'

    const changes = diffSpecs(baseSpec, newSpec)
    expect(changes).toHaveLength(3)

    const vChange = changes.find((c) => c.entryType === 'V' && c.field === 'goal')
    expect(vChange).toBeDefined()
    expect(vChange?.oldValue).toBe('99.9%')
    expect(vChange?.newValue).toBe('99.99%')

    const fChange = changes.find((c) => c.entryType === 'F' && c.field === 'description')
    expect(fChange).toBeDefined()
    expect(fChange?.oldValue).toBe('Authenticate users')
    expect(fChange?.newValue).toBe('Authenticate users securely')

    const sChange = changes.find((c) => c.entryType === 'S' && c.field === 'impact')
    expect(sChange).toBeDefined()
    expect(sChange?.oldValue).toBe('V.AuthRate ~99.9%')
    expect(sChange?.newValue).toBe('V.AuthRate ~99.99%')
  })
})
