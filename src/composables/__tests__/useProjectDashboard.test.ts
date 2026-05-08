// UNIT_TYPE=Test
// Tests for useProjectDashboard composable (Feature #50)

import { describe, it, expect } from 'vitest'
import { useProjectDashboard } from '../useProjectDashboard'
import type { SpecBlock } from '../../types/spec'

const mockSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Auth',
      type: 'Function',
      level: 'Product',
      description: 'Authenticate users via OAuth',
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

const apiLatencySpec: SpecBlock = {
  functions: [
    {
      id: 'F.API',
      type: 'Function',
      level: 'Product',
      description: 'Serve api requests with low latency',
      successCriteria: 'p99 < 100ms',
      functionOfValue: 'V.Latency',
    },
  ],
  values: [
    {
      id: 'V.Latency',
      type: 'Value',
      level: 'Product',
      description: 'API response latency',
      scale: 'ms p99',
      meter: 'APM traces',
      status: '200ms',
      tolerable: '150ms',
      goal: '80ms',
      valueOfFunction: 'F.API',
    },
  ],
  solutions: [],
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

describe('useProjectDashboard', () => {
  it('entries starts empty', () => {
    const { entries } = useProjectDashboard()
    expect(entries.value).toHaveLength(0)
  })

  it('addEntry(mockSpec) → entries.length === 1', () => {
    const { entries, addEntry } = useProjectDashboard()
    addEntry(mockSpec)
    expect(entries.value).toHaveLength(1)
  })

  it('addEntry with same spec twice → still length 1 (deduplication)', () => {
    const { entries, addEntry } = useProjectDashboard()
    addEntry(mockSpec)
    addEntry(JSON.parse(JSON.stringify(mockSpec))) // same content, new object
    expect(entries.value).toHaveLength(1)
  })

  it('entry has name, domain, qualityScore, entryCount, createdAt', () => {
    const { entries, addEntry } = useProjectDashboard()
    addEntry(mockSpec)
    const entry = entries.value[0]
    expect(typeof entry.name).toBe('string')
    expect(entry.name.length).toBeGreaterThan(0)
    expect(typeof entry.domain).toBe('string')
    expect(typeof entry.qualityScore).toBe('number')
    expect(typeof entry.entryCount).toBe('number')
    expect(entry.entryCount).toBe(3) // 1F + 1V + 1S
    expect(entry.createdAt).toBeInstanceOf(Date)
  })

  it('deriveQualityScore returns 0 for empty spec', () => {
    const { deriveQualityScore } = useProjectDashboard()
    expect(deriveQualityScore(emptySpec)).toBe(0)
  })

  it('removeEntry(id) → entry removed', () => {
    const { entries, addEntry, removeEntry } = useProjectDashboard()
    addEntry(mockSpec)
    const id = entries.value[0].id
    removeEntry(id)
    expect(entries.value).toHaveLength(0)
  })

  it('clearAll() → entries empty', () => {
    const { entries, addEntry, clearAll } = useProjectDashboard()
    addEntry(mockSpec)
    addEntry(apiLatencySpec)
    expect(entries.value.length).toBeGreaterThan(0)
    clearAll()
    expect(entries.value).toHaveLength(0)
  })

  it('deriveDomain detects "Engineering" for api latency spec', () => {
    const { deriveDomain } = useProjectDashboard()
    expect(deriveDomain(apiLatencySpec)).toBe('Engineering')
  })
})
