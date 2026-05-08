// UNIT_TYPE=Test
// Tests for useLeanPlan composable (Feature #28)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLeanPlan } from '../useLeanPlan'
import type { SpecBlock } from '../../types/spec'

vi.stubEnv('VITE_MOCK_MODE', 'false') // let apiKey absence control mock path

const fullSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Auth',
      type: 'Function',
      level: 'Product',
      description: 'Authenticate users',
      successCriteria: '100% success rate',
      functionOfValue: 'V.AuthRate',
    },
    {
      id: 'F.Search',
      type: 'Function',
      level: 'Product',
      description: 'Search content',
      successCriteria: 'Results in <200ms',
      functionOfValue: 'V.SearchSpeed',
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
    {
      id: 'V.SearchSpeed',
      type: 'Value',
      level: 'Product',
      description: 'Search latency',
      scale: 'p95 latency in ms',
      meter: 'APM dashboard',
      status: 'pre-build',
      tolerable: '500ms',
      goal: '200ms',
      valueOfFunction: 'F.Search',
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
    {
      id: 'S.RedisCache',
      type: 'Solution',
      level: 'Product',
      description: 'Add Redis caching layer',
      impact: 'V.SearchSpeed ~200ms',
      function: 'F.Search',
    },
  ],
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

describe('useLeanPlan — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('mock mode returns SpecBlock with exactly 1 F, 1 V, 1 S', async () => {
    const { reduceScopeToLean } = useLeanPlan() // no apiKey → mock mode
    const promise = reduceScopeToLean(fullSpec)
    vi.runAllTimersAsync()
    const out = await promise

    expect(out).not.toBeNull()
    expect(out!.functions).toHaveLength(1)
    expect(out!.values).toHaveLength(1)
    expect(out!.solutions).toHaveLength(1)
  })

  it('"[Lean]" prefix appears in descriptions', async () => {
    const { reduceScopeToLean } = useLeanPlan()
    const promise = reduceScopeToLean(fullSpec)
    vi.runAllTimersAsync()
    const out = await promise

    expect(out).not.toBeNull()
    expect(out!.functions[0].description).toMatch(/^\[Lean\]/)
    expect(out!.values[0].description).toMatch(/^\[Lean\]/)
    expect(out!.solutions[0].description).toMatch(/^\[Lean\]/)
  })

  it('loading toggles true → false', async () => {
    const { loading, reduceScopeToLean } = useLeanPlan()

    expect(loading.value).toBe(false)
    const promise = reduceScopeToLean(fullSpec)
    expect(loading.value).toBe(true)
    vi.runAllTimersAsync()
    await promise
    expect(loading.value).toBe(false)
  })

  it('empty spec input: loading false, returns null without crash', async () => {
    const { loading, reduceScopeToLean } = useLeanPlan()

    const out = await reduceScopeToLean(emptySpec)
    expect(out).toBeNull()
    expect(loading.value).toBe(false)
  })
})
