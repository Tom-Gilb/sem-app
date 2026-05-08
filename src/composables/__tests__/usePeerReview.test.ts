// UNIT_TYPE=Test
// Tests for usePeerReview composable (Feature #43)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePeerReview } from '../usePeerReview'
import type { SpecBlock } from '../../types/spec'

// No apiKey passed → mock path
vi.stubEnv('VITE_MOCK_MODE', 'false')

const minimalSpec: SpecBlock = {
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

describe('usePeerReview — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('comments starts empty before reviewSpec is called', () => {
    const { comments } = usePeerReview()
    expect(comments.value).toHaveLength(0)
  })

  it('mock mode returns exactly 5 comments', async () => {
    const { comments, reviewSpec } = usePeerReview()
    const promise = reviewSpec(minimalSpec)
    vi.runAllTimersAsync()
    await promise
    expect(comments.value).toHaveLength(5)
  })

  it('all comments have required fields: target, type, comment, severity', async () => {
    const { comments, reviewSpec } = usePeerReview()
    const promise = reviewSpec(minimalSpec)
    vi.runAllTimersAsync()
    await promise

    for (const c of comments.value) {
      expect(typeof c.target).toBe('string')
      expect(c.target.length).toBeGreaterThan(0)
      expect(typeof c.type).toBe('string')
      expect(c.type.length).toBeGreaterThan(0)
      expect(typeof c.comment).toBe('string')
      expect(c.comment.length).toBeGreaterThan(0)
      expect(typeof c.severity).toBe('string')
      expect(['high', 'medium', 'low']).toContain(c.severity)
    }
  })

  it('all 4 types are represented in mock output', async () => {
    const { comments, reviewSpec } = usePeerReview()
    const promise = reviewSpec(minimalSpec)
    vi.runAllTimersAsync()
    await promise

    const types = new Set(comments.value.map((c) => c.type))
    expect(types.has('assumption')).toBe(true)
    expect(types.has('ambiguity')).toBe(true)
    expect(types.has('risk')).toBe(true)
    expect(types.has('contradiction')).toBe(true)
  })

  it('loading toggles true → false', async () => {
    const { loading, reviewSpec } = usePeerReview()
    expect(loading.value).toBe(false)

    const promise = reviewSpec(minimalSpec)
    expect(loading.value).toBe(true)

    vi.runAllTimersAsync()
    await promise

    expect(loading.value).toBe(false)
  })
})
