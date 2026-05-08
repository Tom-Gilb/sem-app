// UNIT_TYPE=Test
// Feature #48 — useKaiCritique composable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKaiCritique } from '../useKaiCritique'
import type { SpecBlock } from '../../types/spec'

// No apiKey passed → mock path
vi.stubEnv('VITE_MOCK_MODE', 'false')

const mockSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function description',
      successCriteria: 'It works',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Test value',
      scale: '% improvement in outcome',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    },
    {
      id: 'V.Second',
      type: 'Value',
      level: 'Product',
      description: 'Second test value',
      scale: 'seconds',
      meter: 'Stopwatch',
      status: '10s',
      tolerable: '5s',
      goal: '2s',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Test solution',
      impact: 'V.Test ~90%',
      function: 'F.Test',
    },
  ],
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

describe('useKaiCritique — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('critiques starts empty before generateCritique is called', () => {
    const { critiques } = useKaiCritique()
    expect(critiques.value).toHaveLength(0)
  })

  it('loading starts false', () => {
    const { loading } = useKaiCritique()
    expect(loading.value).toBe(false)
  })

  it('after generateCritique: exactly 5 critiques returned for full spec', async () => {
    const { critiques, generateCritique } = useKaiCritique()
    const promise = generateCritique(mockSpec)
    vi.runAllTimersAsync()
    await promise
    expect(critiques.value).toHaveLength(5)
  })

  it('all critiques have required fields: id, principle, entryId, issue, suggestion, severity', async () => {
    const { critiques, generateCritique } = useKaiCritique()
    const promise = generateCritique(mockSpec)
    vi.runAllTimersAsync()
    await promise

    for (const c of critiques.value) {
      expect(typeof c.id).toBe('string')
      expect(c.id.length).toBeGreaterThan(0)
      expect(typeof c.principle).toBe('string')
      expect(['measurability', 'specificity', 'traceability', 'ambition', 'clarity']).toContain(c.principle)
      expect(typeof c.entryId).toBe('string')
      expect(c.entryId.length).toBeGreaterThan(0)
      expect(typeof c.issue).toBe('string')
      expect(c.issue.length).toBeGreaterThan(0)
      expect(typeof c.suggestion).toBe('string')
      expect(c.suggestion.length).toBeGreaterThan(0)
      expect(['high', 'medium', 'low']).toContain(c.severity)
    }
  })

  it('all 5 principles are represented in mock output', async () => {
    const { critiques, generateCritique } = useKaiCritique()
    const promise = generateCritique(mockSpec)
    vi.runAllTimersAsync()
    await promise

    const principles = new Set(critiques.value.map(c => c.principle))
    expect(principles.has('measurability')).toBe(true)
    expect(principles.has('specificity')).toBe(true)
    expect(principles.has('traceability')).toBe(true)
    expect(principles.has('ambition')).toBe(true)
    expect(principles.has('clarity')).toBe(true)
  })

  it('loading is false after completion', async () => {
    const { loading, generateCritique } = useKaiCritique()
    expect(loading.value).toBe(false)

    const promise = generateCritique(mockSpec)
    expect(loading.value).toBe(true)

    vi.runAllTimersAsync()
    await promise

    expect(loading.value).toBe(false)
  })

  it('generateCritique on empty spec: returns array with length ≤5 (graceful)', async () => {
    const { critiques, generateCritique } = useKaiCritique()
    const promise = generateCritique(emptySpec)
    vi.runAllTimersAsync()
    await promise

    expect(critiques.value.length).toBeLessThanOrEqual(5)
  })
})
