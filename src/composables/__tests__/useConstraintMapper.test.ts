// UNIT_TYPE=Test
// Feature #122 — useConstraintMapper composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useConstraintMapper } from '../useConstraintMapper'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; tolerable?: string }>
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
      scale: '',
      meter: '',
      status: '',
      tolerable: v.tolerable ?? '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useConstraintMapper', () => {
  it('returns empty constraints when no blocks have tolerable fields', () => {
    const block = makeBlock({ values: [{ id: 'V.Alpha' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value).toHaveLength(0)
  })

  it('detects time category from "months" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Time', tolerable: 'complete within 6 months' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('time')
  })

  it('detects time category from "deadline" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Deadline', tolerable: 'meet the deadline by Q4' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('time')
  })

  it('detects cost category from "$" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Cost', tolerable: 'budget under $50000' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('cost')
  })

  it('detects cost category from "budget" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Budget', tolerable: 'total budget should not exceed threshold' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('cost')
  })

  it('detects quality category from "%" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Quality', tolerable: 'at least 80% pass rate' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('quality')
  })

  it('detects scope category from "users" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Scope', tolerable: 'max 1000 users per instance' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('scope')
  })

  it('defaults to quality category when no keyword matches', () => {
    const block = makeBlock({ values: [{ id: 'V.Unknown', tolerable: 'something vague here' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].category).toBe('quality')
  })

  it('severity is high when tolerable contains "must"', () => {
    const block = makeBlock({ values: [{ id: 'V.Must', tolerable: 'must be completed by Friday' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].severity).toBe('high')
  })

  it('severity is high when tolerable contains "never"', () => {
    const block = makeBlock({ values: [{ id: 'V.Never', tolerable: 'never exceed threshold' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].severity).toBe('high')
  })

  it('severity is medium when tolerable contains numeric + unit', () => {
    const block = makeBlock({ values: [{ id: 'V.Numeric', tolerable: 'within 30 days of release' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].severity).toBe('medium')
  })

  it('severity is low when no strong keywords present', () => {
    const block = makeBlock({ values: [{ id: 'V.Low', tolerable: 'should be considered' }] })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value[0].severity).toBe('low')
  })

  it('grouped organises constraints into correct categories', () => {
    const block = makeBlock({
      values: [
        { id: 'V.Time', tolerable: '6 months deadline' },
        { id: 'V.Cost', tolerable: '$10000 budget' },
        { id: 'V.Quality', tolerable: '90% accuracy rate' },
        { id: 'V.Scope', tolerable: 'max 500 users' },
      ],
    })
    const { grouped } = useConstraintMapper([block])
    expect(grouped.value.time.length).toBeGreaterThanOrEqual(1)
    expect(grouped.value.cost.length).toBeGreaterThanOrEqual(1)
    expect(grouped.value.quality.length).toBeGreaterThanOrEqual(1)
    expect(grouped.value.scope.length).toBeGreaterThanOrEqual(1)
  })

  it('totalCount matches constraints array length', () => {
    const block = makeBlock({
      values: [
        { id: 'V.A', tolerable: '6 months max' },
        { id: 'V.B', tolerable: '$1000 limit' },
      ],
    })
    const { constraints, totalCount } = useConstraintMapper([block])
    expect(totalCount.value).toBe(constraints.value.length)
  })

  it('highSeverityCount counts only high severity entries', () => {
    const block = makeBlock({
      values: [
        { id: 'V.High1', tolerable: 'must never exceed limit' },
        { id: 'V.High2', tolerable: 'require completion' },
        { id: 'V.Low', tolerable: 'consider optimising' },
      ],
    })
    const { highSeverityCount } = useConstraintMapper([block])
    expect(highSeverityCount.value).toBe(2)
  })

  it('extracts from F. description containing "must not"', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Safe', description: 'the system must not expose private data' }],
    })
    const { constraints } = useConstraintMapper([block])
    expect(constraints.value.some(c => c.blockId === 'F.Safe')).toBe(true)
  })

  it('copyMarkdown contains pipe table headers', async () => {
    let written = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          written = text
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock({ values: [{ id: 'V.Time', tolerable: '6 months' }] })
    const { copyMarkdown } = useConstraintMapper([block])
    await copyMarkdown()
    expect(written).toContain('| Name |')
    expect(written).toContain('Tolerable')
    expect(written).toContain('Category')
    expect(written).toContain('Severity')
    expect(written).toContain('Interpretation')
  })
})
