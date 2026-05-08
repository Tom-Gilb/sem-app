// UNIT_TYPE=Test
// Tests for useChallenge composable (Feature #13)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChallenge } from '../useChallenge'
import type { SpecBlock } from '../../types/spec'

// Force mock mode by ensuring VITE_MOCK_MODE is treated as true
// We pass no apiKey so the composable falls into mock path
vi.stubEnv('VITE_MOCK_MODE', 'false') // allow apiKey path to control mock

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function',
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
      scale: '% passing',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
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

describe('useChallenge — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns 4 challenge strings in mock mode', async () => {
    const { challenges, challengeSpec } = useChallenge()
    // No apiKey → mock mode
    const promise = challengeSpec(minimalSpec)
    vi.runAllTimersAsync()
    await promise
    expect(challenges.value).toHaveLength(4)
    expect(typeof challenges.value[0]).toBe('string')
  })

  it('loading cycles true → false', async () => {
    const { loading, challengeSpec } = useChallenge()
    expect(loading.value).toBe(false)

    const promise = challengeSpec(minimalSpec)
    expect(loading.value).toBe(true)

    vi.runAllTimersAsync()
    await promise

    expect(loading.value).toBe(false)
  })

  it('error is empty after a successful mock call', async () => {
    const { error, challengeSpec } = useChallenge()
    const promise = challengeSpec(minimalSpec)
    vi.runAllTimersAsync()
    await promise
    expect(error.value).toBe('')
  })
})
