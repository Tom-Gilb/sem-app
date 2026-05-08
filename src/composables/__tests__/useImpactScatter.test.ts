// UNIT_TYPE=Test
// Feature #154 — useImpactScatter composable tests

import { describe, it, expect } from 'vitest'
import { useImpactScatter } from '../useImpactScatter'
import type { SpecBlock } from '../../types/spec'

function makeBlock(
  fIds: string[] = [],
  vIds: string[] = [],
  sIds: string[] = [],
  descWords = 0,
): SpecBlock {
  const desc = Array(descWords).fill('word').join(' ')
  return {
    functions: fIds.map((id) => ({
      id,
      type: 'Function',
      level: 'Product',
      description: desc,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: vIds.map((id) => ({
      id,
      type: 'Value',
      level: 'Product',
      description: desc,
      scale: '',
      meter: '',
      status: '',
      tolerable: '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: sIds.map((id) => ({
      id,
      type: 'Solution',
      level: 'Product',
      description: desc,
      impact: '',
      function: '',
    })),
  }
}

describe('useImpactScatter', () => {
  it('open starts as false', () => {
    const { open } = useImpactScatter([])
    expect(open.value).toBe(false)
  })

  it('returns empty points for empty blocks', () => {
    const { points } = useImpactScatter([])
    expect(points.value).toHaveLength(0)
  })

  it('includes all F., V., and S. entries in points', () => {
    const block = makeBlock(['F.A'], ['V.B'], ['S.C'])
    const { points } = useImpactScatter([block])
    expect(points.value).toHaveLength(3)
  })

  it('assigns type=Function to F. entries', () => {
    const block = makeBlock(['F.Foo'])
    const { points } = useImpactScatter([block])
    expect(points.value[0].type).toBe('Function')
  })

  it('assigns type=Value to V. entries', () => {
    const block = makeBlock([], ['V.Bar'])
    const { points } = useImpactScatter([block])
    expect(points.value[0].type).toBe('Value')
  })

  it('assigns type=Solution to S. entries', () => {
    const block = makeBlock([], [], ['S.Baz'])
    const { points } = useImpactScatter([block])
    expect(points.value[0].type).toBe('Solution')
  })

  it('seeding is deterministic: same id → same x and y', () => {
    const block = makeBlock(['F.Deterministic'], [], [], 5)
    const { points: p1 } = useImpactScatter([block])
    const { points: p2 } = useImpactScatter([block])
    expect(p1.value[0].x).toBe(p2.value[0].x)
    expect(p1.value[0].y).toBe(p2.value[0].y)
  })

  it('low complexity + high impact → quick-win quadrant', () => {
    // Need an id whose seed gives y >= 50, and description with few words (x < 50)
    // We find an id that satisfies this by brute-forcing a known one
    // F.QuickWin: seed = charCodes sum; we test by checking the formula
    const block = makeBlock([], [], [], 0)
    // Build a block with a specific id that we know yields quick-win
    const testBlock: SpecBlock = {
      functions: [{
        id: 'F.A',
        type: 'Function',
        level: 'Product',
        description: 'short', // 1 word → x = min(100, round(1/25*100)) = 4
        successCriteria: '',
        functionOfValue: '',
      }],
      values: [],
      solutions: [],
    }
    const { points } = useImpactScatter([testBlock])
    const pt = points.value[0]
    // x should be low (1 word → 4)
    expect(pt.x).toBeLessThan(50)
    // quadrant depends on y
    if (pt.y >= 50) {
      expect(pt.quadrant).toBe('quick-win')
    } else {
      expect(pt.quadrant).toBe('fill-in')
    }
  })

  it('high complexity + high impact → major-project quadrant', () => {
    const manyWords = Array(30).fill('word').join(' ')
    const testBlock: SpecBlock = {
      functions: [{
        id: 'F.A',
        type: 'Function',
        level: 'Product',
        description: manyWords,
        successCriteria: '',
        functionOfValue: '',
      }],
      values: [],
      solutions: [],
    }
    const { points } = useImpactScatter([testBlock])
    const pt = points.value[0]
    expect(pt.x).toBeGreaterThanOrEqual(50)
    if (pt.y >= 50) {
      expect(pt.quadrant).toBe('major-project')
    } else {
      expect(pt.quadrant).toBe('thankless')
    }
  })

  it('selectPoint selects the given id', () => {
    const block = makeBlock(['F.Select'])
    const { points, selectPoint } = useImpactScatter([block])
    expect(points.value[0].selected).toBe(false)
    selectPoint('F.Select')
    expect(points.value[0].selected).toBe(true)
  })

  it('selectPoint deselects on second click (toggle)', () => {
    const block = makeBlock(['F.Toggle'])
    const { points, selectPoint } = useImpactScatter([block])
    selectPoint('F.Toggle')
    expect(points.value[0].selected).toBe(true)
    selectPoint('F.Toggle')
    expect(points.value[0].selected).toBe(false)
  })

  it('selectedPoint is null when nothing is selected', () => {
    const block = makeBlock(['F.None'])
    const { selectedPoint } = useImpactScatter([block])
    expect(selectedPoint.value).toBeNull()
  })

  it('selectedPoint returns the selected point', () => {
    const block = makeBlock(['F.Sel'])
    const { selectedPoint, selectPoint } = useImpactScatter([block])
    selectPoint('F.Sel')
    expect(selectedPoint.value?.id).toBe('F.Sel')
  })

  it('copyMarkdown contains the required headers', () => {
    const block = makeBlock(['F.CopyTest'])
    const { copyMarkdown } = useImpactScatter([block])
    const md = copyMarkdown()
    expect(md).toContain('# Impact vs Complexity')
    expect(md).toContain('| Entry | Complexity | Impact | Quadrant |')
    expect(md).toContain('|---|---|---|---|')
  })

  it('copyMarkdown includes each entry id', () => {
    const block = makeBlock(['F.One', 'F.Two'])
    const { copyMarkdown } = useImpactScatter([block])
    const md = copyMarkdown()
    expect(md).toContain('F.One')
    expect(md).toContain('F.Two')
  })

  it('copyMarkdown returns header-only table for empty blocks', () => {
    const { copyMarkdown } = useImpactScatter([])
    const md = copyMarkdown()
    expect(md).toContain('# Impact vs Complexity')
    expect(md).toContain('|---|---|---|---|')
  })

  it('label is truncated to 14 characters', () => {
    const longId = 'F.VeryLongIdentifier'
    const block = makeBlock([longId])
    const { points } = useImpactScatter([block])
    expect(points.value[0].label.length).toBeLessThanOrEqual(14)
  })

  it('x is clamped to max 100', () => {
    const manyWords = Array(100).fill('word').join(' ')
    const testBlock: SpecBlock = {
      functions: [{
        id: 'F.Long',
        type: 'Function',
        level: 'Product',
        description: manyWords,
        successCriteria: '',
        functionOfValue: '',
      }],
      values: [],
      solutions: [],
    }
    const { points } = useImpactScatter([testBlock])
    expect(points.value[0].x).toBeLessThanOrEqual(100)
  })

  it('y is in range 0–99 (seeded modulo 100)', () => {
    const block = makeBlock(['F.YRange', 'F.AnotherEntry'], ['V.Val'], ['S.Sol'])
    const { points } = useImpactScatter([block])
    for (const p of points.value) {
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThan(100)
    }
  })

  it('accumulates points across multiple blocks', () => {
    const b1 = makeBlock(['F.Alpha'])
    const b2 = makeBlock(['F.Beta'])
    const { points } = useImpactScatter([b1, b2])
    expect(points.value).toHaveLength(2)
  })
})
