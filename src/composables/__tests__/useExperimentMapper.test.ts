// UNIT_TYPE=Test
// Feature #159 — useExperimentMapper composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useExperimentMapper } from '../useExperimentMapper'
import type { SpecBlock } from '../../types/spec'

function makeBlock(opts: {
  valueId?: string
  valueDesc?: string
  valueGoal?: string
  valueTolerable?: string
  functionId?: string
} = {}): SpecBlock {
  const {
    valueId,
    valueDesc = 'A measurable improvement in the product experience',
    valueGoal = '',
    valueTolerable = '',
    functionId,
  } = opts
  return {
    functions: functionId
      ? [{
          id: functionId,
          type: 'Function',
          level: 'Product',
          description: `Desc for ${functionId}`,
          successCriteria: '',
          functionOfValue: '',
        }]
      : [],
    values: valueId
      ? [{
          id: valueId,
          type: 'Value',
          level: 'Product',
          description: valueDesc,
          scale: '',
          meter: '',
          status: '',
          tolerable: valueTolerable,
          goal: valueGoal,
          valueOfFunction: '',
        }]
      : [],
    solutions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useExperimentMapper', () => {
  it('open starts false', () => {
    const { open } = useExperimentMapper([])
    expect(open.value).toBe(false)
  })

  it('copied starts false', () => {
    const { copied } = useExperimentMapper([])
    expect(copied.value).toBe(false)
  })

  it('cards is empty for empty blocks array', () => {
    const { cards } = useExperimentMapper([])
    expect(cards.value).toHaveLength(0)
  })

  it('only V. entries are included — F. only blocks produce no cards', () => {
    const blocks = [makeBlock({ functionId: 'F.Deploy' })]
    const { cards } = useExperimentMapper(blocks)
    expect(cards.value).toHaveLength(0)
  })

  it('one card per V. entry', () => {
    const blocks = [
      makeBlock({ valueId: 'V.Alpha' }),
      makeBlock({ valueId: 'V.Beta' }),
    ]
    const { cards } = useExperimentMapper(blocks)
    expect(cards.value).toHaveLength(2)
  })

  it('card entryId matches V. entry id', () => {
    const { cards } = useExperimentMapper([makeBlock({ valueId: 'V.Fluency' })])
    expect(cards.value[0].entryId).toBe('V.Fluency')
  })

  it('card hypothesis starts with "We believe"', () => {
    const { cards } = useExperimentMapper([makeBlock({ valueId: 'V.Speed' })])
    expect(cards.value[0].hypothesis).toMatch(/^We believe /)
  })

  it('card entryDescription is truncated to 60 chars max', () => {
    const longDesc = 'A'.repeat(100)
    const { cards } = useExperimentMapper([makeBlock({ valueId: 'V.Long', valueDesc: longDesc })])
    expect(cards.value[0].entryDescription.length).toBeLessThanOrEqual(60)
  })

  it('threshold defaults to "> baseline" when no goal or tolerable', () => {
    const { cards } = useExperimentMapper([makeBlock({ valueId: 'V.NoGoal' })])
    expect(cards.value[0].threshold).toBe('> baseline')
  })

  it('threshold uses goal when present', () => {
    const { cards } = useExperimentMapper([makeBlock({ valueId: 'V.HasGoal', valueGoal: 'Goal [Q1] 90%' })])
    expect(cards.value[0].threshold).toBe('Goal [Q1] 90%')
  })

  it('result starts empty string', () => {
    const { cards } = useExperimentMapper([makeBlock({ valueId: 'V.Empty' })])
    expect(cards.value[0].result).toBe('')
  })

  it('setResult updates the results map and card result', () => {
    const { cards, setResult } = useExperimentMapper([makeBlock({ valueId: 'V.Track' })])
    setResult('V.Track', 'Confirmed improvement')
    expect(cards.value[0].result).toBe('Confirmed improvement')
  })

  it('seeding is deterministic — same id produces same hypothesis and metric', () => {
    const blocks = [makeBlock({ valueId: 'V.Deterministic' })]
    const { cards: cards1 } = useExperimentMapper(blocks)
    const { cards: cards2 } = useExperimentMapper(blocks)
    expect(cards1.value[0].hypothesis).toBe(cards2.value[0].hypothesis)
    expect(cards1.value[0].metric).toBe(cards2.value[0].metric)
  })

  it('copyAll writes markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyAll } = useExperimentMapper([makeBlock({ valueId: 'V.Copy' })])
    await copyAll()
    expect(written[0]).toContain('# Lean Experiments')
    expect(written[0]).toContain('V.Copy')
  })

  it('copyAll includes all cards', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const blocks = [
      makeBlock({ valueId: 'V.One' }),
      makeBlock({ valueId: 'V.Two' }),
    ]
    const { copyAll } = useExperimentMapper(blocks)
    await copyAll()
    expect(written[0]).toContain('V.One')
    expect(written[0]).toContain('V.Two')
  })

  it('setResult on unknown id does not throw', () => {
    const { setResult } = useExperimentMapper([])
    expect(() => setResult('V.Unknown', 'some result')).not.toThrow()
  })

  it('mixed F. and V. blocks — only V. entries produce cards', () => {
    const blocks = [
      makeBlock({ valueId: 'V.Real' }),
      makeBlock({ functionId: 'F.Ignored' }),
    ]
    const { cards } = useExperimentMapper(blocks)
    expect(cards.value).toHaveLength(1)
    expect(cards.value[0].entryId).toBe('V.Real')
  })
})
