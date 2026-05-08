// UNIT_TYPE=Test
// Feature #134 — useTechRadar composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useTechRadar, RING_RADII } from '../useTechRadar'
import type { RadarRing } from '../useTechRadar'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; goal?: string; scale?: string }>
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

describe('useTechRadar', () => {
  it('only uses S. entries — F. and V. entries are ignored', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'stable function' }],
      values: [{ id: 'V.Beta', description: 'proven value' }],
      solutions: [{ id: 'S.CoreImpl', description: 'standard proven solution' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value).toHaveLength(1)
    expect(entries.value[0].id).toBe('S.CoreImpl')
  })

  it('returns empty entries for a block with no solutions', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Func' }],
      values: [{ id: 'V.Val' }],
      solutions: [],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value).toHaveLength(0)
  })

  it('assigns Adopt ring for keyword "standard"', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Std', description: 'standard production approach' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Adopt')
  })

  it('assigns Hold ring for keyword "deprecated"', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Old', description: 'deprecated legacy approach' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Hold')
  })

  it('assigns Trial ring for keyword "pilot"', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Pilot', description: 'pilot evaluation approach' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Trial')
  })

  it('assigns Assess ring for keyword "experimental"', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Exp', description: 'experimental prototype approach' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Assess')
  })

  it('defaults to Trial when no keywords match', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Xyz', description: 'does something interesting' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Trial')
  })

  it('priority Adopt wins over Hold when both keywords present', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Mix', description: 'standard but deprecated' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Adopt')
  })

  it('priority Hold wins over Trial when both keywords present', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.MixHT', description: 'deprecated pilot approach' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].ring).toBe('Hold')
  })

  it('truncates label to 16 characters', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.VeryLongIdNameThatExceedsSixteen', description: '' }],
    })
    const { entries } = useTechRadar([block])
    expect(entries.value[0].label.length).toBeLessThanOrEqual(16)
  })

  it('distributes entries evenly within a ring — angles are equally spaced', () => {
    const block = makeBlock({
      solutions: [
        { id: 'S.A', description: 'standard proven' },
        { id: 'S.B', description: 'standard stable' },
        { id: 'S.C', description: 'core production' },
      ],
    })
    const { entries } = useTechRadar([block])
    const adoptEntries = entries.value.filter(e => e.ring === 'Adopt')
    expect(adoptEntries).toHaveLength(3)
    const expectedStep = (2 * Math.PI) / 3
    const angleDiff = Math.abs(adoptEntries[1].angle - adoptEntries[0].angle)
    expect(angleDiff).toBeCloseTo(expectedStep, 5)
  })

  it('ring radii constants are Adopt=55, Trial=100, Assess=145, Hold=190', () => {
    expect(RING_RADII.Adopt).toBe(55)
    expect(RING_RADII.Trial).toBe(100)
    expect(RING_RADII.Assess).toBe(145)
    expect(RING_RADII.Hold).toBe(190)
  })

  it('ringCounts reflects the number of entries per ring', () => {
    const block = makeBlock({
      solutions: [
        { id: 'S.A', description: 'standard proven' },
        { id: 'S.B', description: 'deprecated' },
        { id: 'S.C', description: 'experimental' },
        { id: 'S.D', description: 'no keywords here' },
      ],
    })
    const { ringCounts } = useTechRadar([block])
    expect(ringCounts.value.Adopt).toBe(1)
    expect(ringCounts.value.Hold).toBe(1)
    expect(ringCounts.value.Assess).toBe(1)
    expect(ringCounts.value.Trial).toBe(1)
  })

  it('copyMarkdown produces a pipe-table with Name | Ring | Reason columns', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      solutions: [{ id: 'S.StdSol', description: 'standard approach' }],
    })
    const { copyMarkdown, copied } = useTechRadar([block])
    await copyMarkdown()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('| Name | Ring | Reason |')
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('S.StdSol')
    )
    expect(copied.value).toBe(true)
  })

  it('x and y coordinates are computed from SVG centre + radius * cos/sin(angle)', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.One', description: 'standard proven' }],
    })
    const { entries } = useTechRadar([block])
    const e = entries.value[0]
    const radius = RING_RADII[e.ring as RadarRing]
    const expectedX = 220 + radius * Math.cos(e.angle)
    const expectedY = 220 + radius * Math.sin(e.angle)
    expect(e.x).toBeCloseTo(expectedX, 5)
    expect(e.y).toBeCloseTo(expectedY, 5)
  })
})
