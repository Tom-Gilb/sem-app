// UNIT_TYPE=Test
// Feature #170 — useValueChain composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useValueChain } from '../useValueChain'
import type { SpecBlock } from '../../types/spec'

function makeBlock(opts: {
  fId?: string
  vId?: string
  sId?: string
  sImpact?: string
} = {}): SpecBlock {
  return {
    functions: opts.fId
      ? [{
          id: opts.fId,
          type: 'Function',
          level: 'Product',
          description: `Description for ${opts.fId} — a longer sentence`,
          successCriteria: '',
          functionOfValue: '',
        }]
      : [],
    values: opts.vId
      ? [{
          id: opts.vId,
          type: 'Value',
          level: 'Product',
          description: `Description for ${opts.vId}`,
          scale: 'Percentage',
          meter: 'Automated test',
          status: '',
          tolerable: '',
          goal: `Goal for ${opts.vId}`,
          valueOfFunction: '',
        }]
      : [],
    solutions: opts.sId
      ? [{
          id: opts.sId,
          type: 'Solution',
          level: 'Product',
          description: `Description for ${opts.sId}`,
          impact: opts.sImpact ?? '',
          function: '',
        }]
      : [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useValueChain', () => {
  it('primaryActivities is empty for empty blocks', () => {
    const { primaryActivities } = useValueChain([])
    expect(primaryActivities.value).toHaveLength(0)
  })

  it('supportActivities is empty for empty blocks', () => {
    const { supportActivities } = useValueChain([])
    expect(supportActivities.value).toHaveLength(0)
  })

  it('primaryActivities maps F. entries', () => {
    const { primaryActivities } = useValueChain([makeBlock({ fId: 'F.Build' })])
    expect(primaryActivities.value).toHaveLength(1)
    expect(primaryActivities.value[0].id).toBe('F.Build')
  })

  it('primaryActivities actType is primary', () => {
    const { primaryActivities } = useValueChain([makeBlock({ fId: 'F.Build' })])
    expect(primaryActivities.value[0].actType).toBe('primary')
  })

  it('supportActivities maps S. entries', () => {
    const { supportActivities } = useValueChain([makeBlock({ sId: 'S.Deploy' })])
    expect(supportActivities.value).toHaveLength(1)
    expect(supportActivities.value[0].id).toBe('S.Deploy')
  })

  it('supportActivities actType is support', () => {
    const { supportActivities } = useValueChain([makeBlock({ sId: 'S.Deploy' })])
    expect(supportActivities.value[0].actType).toBe('support')
  })

  it('primaryActivities caps at 6 entries', () => {
    const blocks: SpecBlock[] = [{
      functions: Array.from({ length: 10 }, (_, i) => ({
        id: `F.Item${i}`,
        type: 'Function',
        level: 'Product',
        description: `Desc ${i}`,
        successCriteria: '',
        functionOfValue: '',
      })),
      values: [],
      solutions: [],
    }]
    const { primaryActivities } = useValueChain(blocks)
    expect(primaryActivities.value.length).toBeLessThanOrEqual(6)
  })

  it('supportActivities caps at 4 entries', () => {
    const blocks: SpecBlock[] = [{
      functions: [],
      values: [],
      solutions: Array.from({ length: 8 }, (_, i) => ({
        id: `S.Item${i}`,
        type: 'Solution',
        level: 'Product',
        description: `Desc ${i}`,
        impact: '',
        function: '',
      })),
    }]
    const { supportActivities } = useValueChain(blocks)
    expect(supportActivities.value.length).toBeLessThanOrEqual(4)
  })

  it('description is truncated to 60 chars', () => {
    const blocks: SpecBlock[] = [{
      functions: [{ id: 'F.Long', type: 'Function', level: 'Product', description: 'x'.repeat(100), successCriteria: '', functionOfValue: '' }],
      values: [],
      solutions: [],
    }]
    const { primaryActivities } = useValueChain(blocks)
    expect(primaryActivities.value[0].description.length).toBeLessThanOrEqual(60)
  })

  it('selectedId starts as null', () => {
    const { selectedId } = useValueChain([])
    expect(selectedId.value).toBeNull()
  })

  it('select sets selectedId', () => {
    const { selectedId, select } = useValueChain([makeBlock({ fId: 'F.A' })])
    select('F.A')
    expect(selectedId.value).toBe('F.A')
  })

  it('select on same id toggles back to null', () => {
    const { selectedId, select } = useValueChain([makeBlock({ fId: 'F.A' })])
    select('F.A')
    select('F.A')
    expect(selectedId.value).toBeNull()
  })

  it('open starts as false', () => {
    const { open } = useValueChain([])
    expect(open.value).toBe(false)
  })

  it('copied starts as false', () => {
    const { copied } = useValueChain([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown writes a pipe table with header row', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useValueChain([makeBlock({ fId: 'F.Copy' })])
    await copyMarkdown()
    expect(written[0]).toContain('| Type |')
    expect(written[0]).toContain('| ID |')
  })

  it('copyMarkdown includes F. entry id in output', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useValueChain([makeBlock({ fId: 'F.InMd' })])
    await copyMarkdown()
    expect(written[0]).toContain('F.InMd')
  })

  it('copyMarkdown does not throw for empty blocks', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const { copyMarkdown } = useValueChain([])
    await expect(copyMarkdown()).resolves.not.toThrow()
  })

  it('outcomeSummary uses V. goal when S. impact references V. id', () => {
    const blocks: SpecBlock[] = [{
      functions: [],
      values: [{ id: 'V.Speed', type: 'Value', level: 'Product', description: 'desc', scale: '', meter: '', status: '', tolerable: '', goal: 'Goal for V.Speed text', valueOfFunction: '' }],
      solutions: [{ id: 'S.Fast', type: 'Solution', level: 'Product', description: 'desc', impact: 'V.Speed ~90%', function: '' }],
    }]
    const { supportActivities } = useValueChain(blocks)
    expect(supportActivities.value[0].outcomeSummary).toContain('Goal for V.Speed')
  })
})
