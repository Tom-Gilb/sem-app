// UNIT_TYPE=Test
// Feature #136 — useSlaGenerator composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useSlaGenerator } from '../useSlaGenerator'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; scale?: string; goal?: string; description?: string; status?: string }>
  solutions?: Array<{ id: string; description?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? '',
      scale: v.scale ?? '',
      meter: '',
      status: v.status ?? '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: (overrides?.solutions ?? []).map(s => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: s.description ?? '',
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useSlaGenerator', () => {
  it('creates one clause per V. entry', () => {
    const block = makeBlock({
      values: [
        { id: 'V.Alpha' },
        { id: 'V.Beta' },
        { id: 'V.Gamma' },
      ],
    })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value).toHaveLength(3)
  })

  it('no clauses when block has no V. entries', () => {
    const block = makeBlock({ values: [] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value).toHaveLength(0)
  })

  it('serviceName defaults to V. entry id', () => {
    const block = makeBlock({ values: [{ id: 'V.MyService' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].serviceName).toBe('V.MyService')
  })

  it('metric defaults to "service availability" when Scale is empty', () => {
    const block = makeBlock({ values: [{ id: 'V.A', scale: '' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].metric).toBe('service availability')
  })

  it('metric is derived from Scale field (first phrase, max 40 chars)', () => {
    const block = makeBlock({ values: [{ id: 'V.A', scale: 'Response time in milliseconds; secondary metric' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].metric).toBe('Response time in milliseconds')
  })

  it('target defaults to "99.9%" when Goal is empty', () => {
    const block = makeBlock({ values: [{ id: 'V.A', goal: '' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].target).toBe('99.9%')
  })

  it('target parses percentage from Goal field', () => {
    const block = makeBlock({ values: [{ id: 'V.A', goal: 'Goal [2026] 99.9%' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].target).toBe('99.9%')
  })

  it('measurementPeriod defaults to "rolling 30 days"', () => {
    const block = makeBlock({ values: [{ id: 'V.A' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].measurementPeriod).toBe('rolling 30 days')
  })

  it('penalty defaults to "5% service credit per breach event"', () => {
    const block = makeBlock({ values: [{ id: 'V.A' }] })
    const { clauses } = useSlaGenerator([block])
    expect(clauses.value[0].penalty).toBe('5% service credit per breach event')
  })

  it('updateClause updates a specific field', () => {
    const block = makeBlock({ values: [{ id: 'V.A' }] })
    const { clauses, updateClause } = useSlaGenerator([block])
    updateClause('V.A', 'serviceName', 'My Custom Service')
    expect(clauses.value[0].serviceName).toBe('My Custom Service')
  })

  it('updateClause updates penalty independently', () => {
    const block = makeBlock({ values: [{ id: 'V.A' }] })
    const { clauses, updateClause } = useSlaGenerator([block])
    updateClause('V.A', 'penalty', '10% credit')
    expect(clauses.value[0].penalty).toBe('10% credit')
  })

  it('copyMarkdown formats one clause per V. entry with correct headings', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      values: [{ id: 'V.Alpha', scale: 'uptime percentage', goal: 'Goal 99.9%' }],
    })
    const { copyMarkdown, copied } = useSlaGenerator([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('**V.Alpha — SLA Clause**')
    expect(written).toContain('- Metric:')
    expect(written).toContain('- Target:')
    expect(written).toContain('- Measurement Period:')
    expect(written).toContain('- Penalty:')
    expect(written).toContain('---')
    expect(copied.value).toBe(true)
  })

  it('copied flag resets after timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({ values: [{ id: 'V.A' }] })
    const { copyMarkdown, copied } = useSlaGenerator([block])
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })

  it('copyMarkdown does nothing when there are no V. entries', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({ values: [] })
    const { copyMarkdown } = useSlaGenerator([block])
    await copyMarkdown()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})
