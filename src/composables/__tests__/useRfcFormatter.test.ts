// UNIT_TYPE=Test
// Feature #130 — useRfcFormatter composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useRfcFormatter } from '../useRfcFormatter'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; goal?: string; scale?: string; meter?: string }>
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
      meter: v.meter ?? '',
      status: '',
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

describe('useRfcFormatter', () => {
  it('generates an abstract containing function and value counts', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'Do Alpha' }],
      values: [{ id: 'V.Speed' }],
      solutions: [{ id: 'S.Cache' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.abstract).toContain('1 function')
    expect(rfc.value.abstract).toContain('1 measurable outcome')
  })

  it('motivation includes value entry goal text', () => {
    const block = makeBlock({
      values: [{ id: 'V.Speed', goal: 'Goal [2026] < 100ms' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.motivation).toContain('V.Speed')
  })

  it('motivation says "No value entries defined" when blocks are empty', () => {
    const { rfc } = useRfcFormatter([])
    expect(rfc.value.motivation).toBe('No value entries defined.')
  })

  it('detailedDesign includes numbered F. entries', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.One', description: 'First function' },
        { id: 'F.Two', description: 'Second function' },
      ],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.detailedDesign).toContain('1. F.One')
    expect(rfc.value.detailedDesign).toContain('2. F.Two')
  })

  it('detailedDesign includes S. implementation entries', () => {
    const block = makeBlock({
      functions: [{ id: 'F.One' }],
      solutions: [{ id: 'S.CacheImpl', description: 'Cache layer' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.detailedDesign).toContain('Implementation: S.CacheImpl')
  })

  it('drawbacks mentions measurability when values lack goals', () => {
    const block = makeBlock({
      values: [{ id: 'V.Unclear', goal: '' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.drawbacks).toContain('measurability')
  })

  it('alternatives section is non-empty', () => {
    const { rfc } = useRfcFormatter([])
    expect(rfc.value.alternatives.length).toBeGreaterThan(0)
  })

  it('unresolved lists V. entries missing Goal, Scale, or Meter', () => {
    const block = makeBlock({
      values: [{ id: 'V.Incomplete', goal: '', scale: '', meter: '' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.unresolved).toContain('V.Incomplete')
  })

  it('unresolved is "no unresolved questions" message when all fields present', () => {
    const block = makeBlock({
      values: [{ id: 'V.Complete', goal: 'Goal [2026] 100', scale: 'ms', meter: 'timer' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.unresolved).toContain('No unresolved questions')
  })

  it('title includes first F. entry id', () => {
    const block = makeBlock({
      functions: [{ id: 'F.MainFeature' }],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.title).toContain('F.MainFeature')
  })

  it('title is "RFC: Untitled Spec" when no functions present', () => {
    const { rfc } = useRfcFormatter([])
    expect(rfc.value.title).toBe('RFC: Untitled Spec')
  })

  it('copyMarkdown includes all section headers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const block = makeBlock({
      functions: [{ id: 'F.Test', description: 'test function' }],
      values: [{ id: 'V.Test', goal: 'Goal [2026] 10', scale: 'units', meter: 'counter' }],
    })
    const { copyMarkdown } = useRfcFormatter([block])
    await copyMarkdown()
    expect(writeText).toHaveBeenCalledOnce()
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('## Abstract')
    expect(text).toContain('## Motivation')
    expect(text).toContain('## Detailed Design')
    expect(text).toContain('## Drawbacks')
    expect(text).toContain('## Alternatives')
    expect(text).toContain('## Unresolved Questions')
  })

  it('copyMarkdown flips copied to true after clipboard write', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const { copyMarkdown, copied } = useRfcFormatter([])
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })

  it('motivation limits to 3 entries plus overflow indicator', () => {
    const block = makeBlock({
      values: [
        { id: 'V.A', goal: 'Goal A' },
        { id: 'V.B', goal: 'Goal B' },
        { id: 'V.C', goal: 'Goal C' },
        { id: 'V.D', goal: 'Goal D' },
        { id: 'V.E', goal: 'Goal E' },
      ],
    })
    const { rfc } = useRfcFormatter([block])
    expect(rfc.value.motivation).toContain('+ 2 more')
  })
})
