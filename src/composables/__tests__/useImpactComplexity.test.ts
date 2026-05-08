// UNIT_TYPE=Test
// Feature #154 — useImpactComplexity composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useImpactComplexity,
  charCodeSeed,
  computeComplexity,
  computeImpact,
  computeMedian,
  buildScatterPoints,
  formatScatterMarkdown,
} from '../useImpactComplexity'
import type { SpecBlock } from '../../types/spec'

function makeFEntry(id: string, description: string) {
  return { id, type: 'Function', level: 'Product', description, successCriteria: '', functionOfValue: '' }
}

function makeVEntry(id: string, description: string) {
  return { id, type: 'Value', level: 'Product', description, scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '' }
}

function makeSEntry(id: string, description: string) {
  return { id, type: 'Solution', level: 'Product', description, impact: '', function: '' }
}

function makeBlock(
  fEntries: Array<{ id: string; description: string }> = [],
  vEntries: Array<{ id: string; description: string }> = [],
  sEntries: Array<{ id: string; description: string }> = [],
): SpecBlock {
  return {
    functions: fEntries.map((f) => makeFEntry(f.id, f.description)),
    values: vEntries.map((v) => makeVEntry(v.id, v.description)),
    solutions: sEntries.map((s) => makeSEntry(s.id, s.description)),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('charCodeSeed', () => {
  it('returns sum of char codes', () => {
    expect(charCodeSeed('AB')).toBe('A'.charCodeAt(0) + 'B'.charCodeAt(0))
  })

  it('returns 0 for empty string', () => {
    expect(charCodeSeed('')).toBe(0)
  })
})

describe('computeComplexity', () => {
  it('counts words in description', () => {
    expect(computeComplexity('hello world foo')).toBe(3)
  })

  it('returns 1 for empty description', () => {
    expect(computeComplexity('')).toBe(1)
  })

  it('returns 1 for single word', () => {
    expect(computeComplexity('word')).toBe(1)
  })

  it('handles extra whitespace', () => {
    expect(computeComplexity('  one   two  ')).toBe(2)
  })
})

describe('computeImpact', () => {
  it('returns value between 1 and 100 inclusive', () => {
    const impact = computeImpact('F.SomeFeature')
    expect(impact).toBeGreaterThanOrEqual(1)
    expect(impact).toBeLessThanOrEqual(100)
  })

  it('is deterministic for same id', () => {
    expect(computeImpact('F.Alpha')).toBe(computeImpact('F.Alpha'))
  })

  it('uses charCode sum mod 100 + 1', () => {
    const id = 'F.Test'
    const seed = charCodeSeed(id)
    expect(computeImpact(id)).toBe((seed % 100) + 1)
  })
})

describe('computeMedian', () => {
  it('returns 0 for empty array', () => {
    expect(computeMedian([])).toBe(0)
  })

  it('returns single value for one-element array', () => {
    expect(computeMedian([5])).toBe(5)
  })

  it('returns middle value for odd-length array', () => {
    expect(computeMedian([1, 3, 5])).toBe(3)
  })

  it('returns average of two middle values for even-length array', () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('buildScatterPoints', () => {
  it('returns one point per F. entry', () => {
    const block = makeBlock([{ id: 'F.A', description: 'one two' }])
    const points = buildScatterPoints([block])
    expect(points.filter((p) => p.type === 'Function')).toHaveLength(1)
  })

  it('returns one point per V. entry', () => {
    const block = makeBlock([], [{ id: 'V.A', description: 'one' }])
    const points = buildScatterPoints([block])
    expect(points.filter((p) => p.type === 'Value')).toHaveLength(1)
  })

  it('returns one point per S. entry', () => {
    const block = makeBlock([], [], [{ id: 'S.A', description: 'some desc' }])
    const points = buildScatterPoints([block])
    expect(points.filter((p) => p.type === 'Solution')).toHaveLength(1)
  })

  it('returns empty array for empty blocks', () => {
    expect(buildScatterPoints([])).toHaveLength(0)
  })

  it('combines entries across multiple blocks', () => {
    const b1 = makeBlock([{ id: 'F.X', description: 'desc' }])
    const b2 = makeBlock([{ id: 'F.Y', description: 'desc' }])
    expect(buildScatterPoints([b1, b2])).toHaveLength(2)
  })
})

describe('formatScatterMarkdown', () => {
  it('includes header columns', () => {
    const points = buildScatterPoints([makeBlock([{ id: 'F.A', description: 'test' }])])
    const md = formatScatterMarkdown(points, () => 'quick-win')
    expect(md).toContain('Name')
    expect(md).toContain('Type')
    expect(md).toContain('Complexity')
    expect(md).toContain('Impact')
    expect(md).toContain('Quadrant')
  })

  it('includes separator row', () => {
    const points = buildScatterPoints([makeBlock([{ id: 'F.A', description: 'test' }])])
    const md = formatScatterMarkdown(points, () => 'quick-win')
    expect(md).toContain('---|')
  })

  it('includes entry id in a row', () => {
    const points = buildScatterPoints([makeBlock([{ id: 'F.MyEntry', description: 'test' }])])
    const md = formatScatterMarkdown(points, () => 'fill-in')
    expect(md).toContain('F.MyEntry')
  })

  it('includes quadrant label', () => {
    const points = buildScatterPoints([makeBlock([{ id: 'F.A', description: 'test' }])])
    const md = formatScatterMarkdown(points, () => 'major-project')
    expect(md).toContain('major-project')
  })
})

describe('useImpactComplexity', () => {
  it('returns points for all entry types', () => {
    const block = makeBlock(
      [{ id: 'F.A', description: 'one two three' }],
      [{ id: 'V.A', description: 'four five' }],
      [{ id: 'S.A', description: 'six' }],
    )
    const { points } = useImpactComplexity([block])
    expect(points.value).toHaveLength(3)
  })

  it('returns empty points for empty blocks', () => {
    const { points } = useImpactComplexity([])
    expect(points.value).toHaveLength(0)
  })

  it('selectedId starts as null', () => {
    const { selectedId } = useImpactComplexity([])
    expect(selectedId.value).toBeNull()
  })

  it('selectPoint sets selectedId', () => {
    const block = makeBlock([{ id: 'F.A', description: 'desc' }])
    const { selectPoint, selectedId } = useImpactComplexity([block])
    selectPoint('F.A')
    expect(selectedId.value).toBe('F.A')
  })

  it('selected flag is true for selected point', () => {
    const block = makeBlock([{ id: 'F.A', description: 'desc' }])
    const { points, selectPoint } = useImpactComplexity([block])
    selectPoint('F.A')
    expect(points.value[0].selected).toBe(true)
  })

  it('selected flag is false for non-selected points', () => {
    const block = makeBlock([
      { id: 'F.A', description: 'desc' },
      { id: 'F.B', description: 'desc two' },
    ])
    const { points, selectPoint } = useImpactComplexity([block])
    selectPoint('F.A')
    expect(points.value[1].selected).toBe(false)
  })

  it('quadrantOf returns one of the 4 quadrant strings', () => {
    const block = makeBlock([{ id: 'F.A', description: 'one two three' }])
    const { points, quadrantOf } = useImpactComplexity([block])
    const quadrants = ['quick-win', 'major-project', 'fill-in', 'thankless']
    expect(quadrants).toContain(quadrantOf(points.value[0]))
  })

  it('copied starts as false', () => {
    const { copied } = useImpactComplexity([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown sets copied=true and writes to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const block = makeBlock([{ id: 'F.A', description: 'one two' }])
    const { copyMarkdown, copied } = useImpactComplexity([block])
    await copyMarkdown()
    expect(written[0]).toContain('Name')
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown does nothing when no points', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyMarkdown } = useImpactComplexity([])
    await copyMarkdown()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copied flips back to false after 2s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const block = makeBlock([{ id: 'F.A', description: 'desc' }])
    const { copyMarkdown, copied } = useImpactComplexity([block])
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })

  it('complexity is deterministic', () => {
    const block = makeBlock([{ id: 'F.A', description: 'one two three four' }])
    const { points: p1 } = useImpactComplexity([block])
    const { points: p2 } = useImpactComplexity([block])
    expect(p1.value[0].complexity).toBe(p2.value[0].complexity)
  })

  it('impact is deterministic', () => {
    const block = makeBlock([{ id: 'F.DeterminismCheck', description: 'desc' }])
    const { points: p1 } = useImpactComplexity([block])
    const { points: p2 } = useImpactComplexity([block])
    expect(p1.value[0].impact).toBe(p2.value[0].impact)
  })
})
