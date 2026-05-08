// UNIT_TYPE=Test
// Tests for useExecSummary composable (Feature #44)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExecSummary } from '../useExecSummary'
import type { SpecBlock } from '../../types/spec'

// No apiKey passed → mock path
vi.stubEnv('VITE_MOCK_MODE', 'false')

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Guide new users to complete onboarding within two minutes',
      successCriteria: '≥80% completion rate',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Onboarding completion rate',
      scale: '% of users completing onboarding in <2 minutes',
      meter: 'Automated funnel analytics',
      status: 'pre-build',
      tolerable: '60%',
      goal: '85%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Redesign the onboarding checklist with progressive disclosure steps',
      impact: 'V.Test ~85%',
      function: 'F.Test',
    },
  ],
}

describe('useExecSummary — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('summary starts as empty string', () => {
    const { summary } = useExecSummary()
    expect(summary.value).toBe('')
  })

  it('mock mode returns non-empty summary string', async () => {
    const { summary, generateSummary } = useExecSummary()
    const promise = generateSummary(minimalSpec)
    vi.runAllTimersAsync()
    await promise
    expect(summary.value.length).toBeGreaterThan(0)
  })

  it('summary contains F. description snippet', async () => {
    const { summary, generateSummary } = useExecSummary()
    const promise = generateSummary(minimalSpec)
    vi.runAllTimersAsync()
    await promise
    // The first 80 chars of description, lowercased, should appear in sentence 1
    const expectedSnippet = minimalSpec.functions[0].description.slice(0, 80).toLowerCase()
    expect(summary.value.toLowerCase()).toContain(expectedSnippet.toLowerCase())
  })

  it('summary contains V. goal value', async () => {
    const { summary, generateSummary } = useExecSummary()
    const promise = generateSummary(minimalSpec)
    vi.runAllTimersAsync()
    await promise
    expect(summary.value).toContain(minimalSpec.values[0].goal)
  })

  it('loading toggles true → false', async () => {
    const { loading, generateSummary } = useExecSummary()
    expect(loading.value).toBe(false)

    const promise = generateSummary(minimalSpec)
    expect(loading.value).toBe(true)

    vi.runAllTimersAsync()
    await promise

    expect(loading.value).toBe(false)
  })
})
