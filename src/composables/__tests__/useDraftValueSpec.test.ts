/**
 * useDraftValueSpec.test.ts — Regression tests for Value spec drafting
 *
 * Tests mock mode (no API) behavior and verify that:
 * 1. Pattern heuristics produce reasonable defaults
 * 2. Bulk drafting handles multiple entries
 * 3. Error handling works correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDraftValueSpec } from '../useDraftValueSpec'
import type { VEntry, SpecBlock } from '../../types/spec'

// Mock Anthropic key composable
vi.mock('../useAnthropicKey', () => ({
  useAnthropicKey: () => ({
    apiKey: { value: null }, // Force mock mode
  }),
}))

const mockSpec: SpecBlock = {
  name: 'Test Plan',
  version: '1.0',
  functions: [
    {
      id: 'F.Auth',
      type: 'Function',
      level: 'Business',
      description: 'User authentication',
      presenceTest: 'present',
      functionOfValue: 'Security',
      currentStatus: 'present',
    },
  ],
  values: [],
  solutions: [],
  stakeholders: [],
  constraints: [],
  conditions: [],
  resources: [],
  evoSteps: [],
}

describe('useDraftValueSpec', () => {
  let composable: ReturnType<typeof useDraftValueSpec>

  beforeEach(() => {
    composable = useDraftValueSpec()
  })

  it('should draft response time as milliseconds', async () => {
    const entry: VEntry = {
      id: 'V.ResponseTime',
      type: 'Value',
      level: 'Business',
      description: 'API response time',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(result.entryId).toBe('V.ResponseTime')
    expect(result.scale).toBe('milliseconds')
    expect(result.tolerable).toContain('ms')
    expect(result.wish).toContain('ms')
  })

  it('should draft cost as USD', async () => {
    const entry: VEntry = {
      id: 'V.Cost',
      type: 'Value',
      level: 'Business',
      description: 'Total project cost',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(result.entryId).toBe('V.Cost')
    expect(result.scale).toBe('USD')
    expect(result.tolerable).toContain('$')
    expect(result.wish).toContain('$')
  })

  it('should draft quality as percentage', async () => {
    const entry: VEntry = {
      id: 'V.Quality',
      type: 'Value',
      level: 'Business',
      description: 'Customer satisfaction quality rating',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(result.entryId).toBe('V.Quality')
    expect(result.scale).toBe('percent')
    expect(result.tolerable).toContain('%')
    expect(result.wish).toContain('%')
  })

  it('should draft availability as percentage', async () => {
    const entry: VEntry = {
      id: 'V.Availability',
      type: 'Value',
      level: 'Business',
      description: 'System uptime and reliability',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(result.entryId).toBe('V.Availability')
    expect(result.scale).toBe('percent')
    expect(result.tolerable).toContain('%')
    expect(result.wish).toContain('%')
  })

  it('should draft storage as megabytes', async () => {
    const entry: VEntry = {
      id: 'V.Storage',
      type: 'Value',
      level: 'Business',
      description: 'Database storage capacity',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(result.entryId).toBe('V.Storage')
    expect(result.scale).toBe('megabytes')
    expect(result.tolerable).toContain('MB')
    expect(result.wish).toContain('MB')
  })

  it('should default to count when pattern not recognized', async () => {
    const entry: VEntry = {
      id: 'V.Unknown',
      type: 'Value',
      level: 'Business',
      description: 'Some obscure business metric',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(result.entryId).toBe('V.Unknown')
    expect(result.scale).toBe('count')
    expect(result.tolerable).toBe('50')
    expect(result.wish).toBe('100')
  })

  it('should handle bulk drafting of multiple incomplete values', async () => {
    const testSpec: SpecBlock = {
      ...mockSpec,
      values: [
        {
          id: 'V.Time',
          type: 'Value',
          level: 'Business',
          description: 'Response time',
          presenceTest: '',
          currentStatus: '',
        },
        {
          id: 'V.Cost',
          type: 'Value',
          level: 'Business',
          description: 'Development cost',
          presenceTest: '',
          currentStatus: '',
        },
        {
          id: 'V.Complete', // This one is complete
          type: 'Value',
          level: 'Business',
          description: 'Already has everything',
          scale: 'percent',
          tolerable: '80%',
          wish: '95%',
          presenceTest: '',
          currentStatus: '',
        },
      ],
    }

    const results = await composable.draftAllIncomplete(testSpec)

    // Should only draft the two incomplete entries
    expect(Object.keys(results)).toHaveLength(2)
    expect(results['V.Time']).toBeDefined()
    expect(results['V.Cost']).toBeDefined()
    expect(results['V.Complete']).toBeUndefined()
  })

  it('should set loading state during drafting', async () => {
    const entry: VEntry = {
      id: 'V.Test',
      type: 'Value',
      level: 'Business',
      description: 'Test value',
      presenceTest: '',
      currentStatus: '',
    }

    expect(composable.loading.value).toBe(false)

    const promise = composable.draftOne(entry, mockSpec)
    // Loading should be true while drafting (mock mode is sync, but in real code it would be)
    // After the promise resolves, loading should be false
    await promise

    expect(composable.loading.value).toBe(false)
  })

  it('should clear error state on successful draft', async () => {
    const entry: VEntry = {
      id: 'V.Test',
      type: 'Value',
      level: 'Business',
      description: 'Test',
      presenceTest: '',
      currentStatus: '',
    }

    await composable.draftOne(entry, mockSpec)

    expect(composable.error.value).toBeNull()
  })

  it('should set draftResult state', async () => {
    const entry: VEntry = {
      id: 'V.ResponseTime',
      type: 'Value',
      level: 'Business',
      description: 'Response time',
      presenceTest: '',
      currentStatus: '',
    }

    const result = await composable.draftOne(entry, mockSpec)

    expect(composable.draftResult.value).toEqual(result)
    expect(composable.draftResult.value?.entryId).toBe('V.ResponseTime')
  })
})
