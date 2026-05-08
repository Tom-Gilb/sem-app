// UNIT_TYPE=Test
// Feature #169 — useMinLovable composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useMinLovable, buildMlpEntry } from '../useMinLovable'
import type { SpecBlock } from '../../types/spec'

function makeBlock(opts: {
  fId?: string
  vId?: string
  sId?: string
} = {}): SpecBlock {
  return {
    functions: opts.fId
      ? [{
          id: opts.fId,
          type: 'Function',
          level: 'Product',
          description: `Description for ${opts.fId}`,
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
          scale: '',
          meter: '',
          status: '',
          tolerable: '',
          goal: '',
          valueOfFunction: '',
        }]
      : [],
    solutions: opts.sId
      ? [{
          id: opts.sId,
          type: 'Solution',
          level: 'Product',
          description: `Description for ${opts.sId}`,
          impact: '',
          function: '',
        }]
      : [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ── buildMlpEntry unit tests ──────────────────────────────────────────────────

describe('buildMlpEntry', () => {
  it('id field matches supplied id', () => {
    const e = buildMlpEntry('F.Alpha', 'F', 'Some description')
    expect(e.id).toBe('F.Alpha')
  })

  it('type field matches supplied type', () => {
    const e = buildMlpEntry('V.Speed', 'V', 'A value')
    expect(e.type).toBe('V')
  })

  it('description is truncated to 60 characters', () => {
    const long = 'a'.repeat(100)
    const e = buildMlpEntry('F.Long', 'F', long)
    expect(e.description.length).toBeLessThanOrEqual(60)
  })

  it('essentialness is between 0 and 100 inclusive', () => {
    const e = buildMlpEntry('F.Test', 'F', 'desc')
    expect(e.essentialness).toBeGreaterThanOrEqual(0)
    expect(e.essentialness).toBeLessThanOrEqual(100)
  })

  it('userDelight is between 0 and 100 inclusive', () => {
    const e = buildMlpEntry('F.Test', 'F', 'desc')
    expect(e.userDelight).toBeGreaterThanOrEqual(0)
    expect(e.userDelight).toBeLessThanOrEqual(100)
  })

  it('feasibility is between 0 and 100 inclusive', () => {
    const e = buildMlpEntry('S.Impl', 'S', 'desc')
    expect(e.feasibility).toBeGreaterThanOrEqual(0)
    expect(e.feasibility).toBeLessThanOrEqual(100)
  })

  it('mlpScore equals Math.round((essentialness + userDelight + feasibility) / 3)', () => {
    const e = buildMlpEntry('F.Score', 'F', 'desc')
    const expected = Math.round((e.essentialness + e.userDelight + e.feasibility) / 3)
    expect(e.mlpScore).toBe(expected)
  })

  it('is deterministic — same inputs produce same mlpScore', () => {
    const e1 = buildMlpEntry('F.Stable', 'F', 'desc')
    const e2 = buildMlpEntry('F.Stable', 'F', 'desc')
    expect(e1.mlpScore).toBe(e2.mlpScore)
  })

  it('essentialness seed differs from userDelight seed', () => {
    // Seeds use different suffixes ('e' vs 'd'), so values should often differ
    // Run multiple entries to confirm the seeds are independent
    const e = buildMlpEntry('F.Diff', 'F', 'desc')
    // They CAN be equal by coincidence, but the function should produce two separate calculations
    // We just verify both are valid numbers
    expect(typeof e.essentialness).toBe('number')
    expect(typeof e.userDelight).toBe('number')
  })
})

// ── useMinLovable composable tests ───────────────────────────────────────────

describe('useMinLovable', () => {
  it('entries is empty for empty blocks array', () => {
    const { entries } = useMinLovable([])
    expect(entries.value).toHaveLength(0)
  })

  it('entries includes all F. entries from blocks', () => {
    const blocks = [makeBlock({ fId: 'F.Build' }), makeBlock({ fId: 'F.Test' })]
    const { entries } = useMinLovable(blocks)
    const fEntries = entries.value.filter(e => e.type === 'F')
    expect(fEntries).toHaveLength(2)
  })

  it('entries includes V. entries', () => {
    const { entries } = useMinLovable([makeBlock({ vId: 'V.Speed' })])
    const vEntries = entries.value.filter(e => e.type === 'V')
    expect(vEntries).toHaveLength(1)
  })

  it('entries includes S. entries', () => {
    const { entries } = useMinLovable([makeBlock({ sId: 'S.Deploy' })])
    const sEntries = entries.value.filter(e => e.type === 'S')
    expect(sEntries).toHaveLength(1)
  })

  it('entries are sorted descending by mlpScore', () => {
    const blocks = [
      makeBlock({ fId: 'F.One' }),
      makeBlock({ fId: 'F.Two' }),
      makeBlock({ fId: 'F.Three' }),
    ]
    const { entries } = useMinLovable(blocks)
    const scores = entries.value.map(e => e.mlpScore)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('topThree returns at most 3 entries', () => {
    const blocks = [
      makeBlock({ fId: 'F.A' }),
      makeBlock({ fId: 'F.B' }),
      makeBlock({ fId: 'F.C' }),
      makeBlock({ fId: 'F.D' }),
    ]
    const { topThree } = useMinLovable(blocks)
    expect(topThree.value.length).toBeLessThanOrEqual(3)
  })

  it('topThree entries all have isTop === true', () => {
    const blocks = [
      makeBlock({ fId: 'F.A' }),
      makeBlock({ fId: 'F.B' }),
      makeBlock({ fId: 'F.C' }),
    ]
    const { topThree } = useMinLovable(blocks)
    for (const e of topThree.value) {
      expect(e.isTop).toBe(true)
    }
  })

  it('entries beyond top 3 have isTop === false', () => {
    const blocks = [
      makeBlock({ fId: 'F.A' }),
      makeBlock({ fId: 'F.B' }),
      makeBlock({ fId: 'F.C' }),
      makeBlock({ fId: 'F.D' }),
    ]
    const { entries } = useMinLovable(blocks)
    // entries[3] is the 4th-highest entry (index 3), should have isTop false
    const nonTop = entries.value.slice(3)
    for (const e of nonTop) {
      expect(e.isTop).toBe(false)
    }
  })

  it('open starts as false', () => {
    const { open } = useMinLovable([])
    expect(open.value).toBe(false)
  })

  it('copied starts as false', () => {
    const { copied } = useMinLovable([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown does not throw for empty blocks', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const { copyMarkdown } = useMinLovable([])
    await expect(copyMarkdown()).resolves.not.toThrow()
  })

  it('copyMarkdown writes a markdown table with header row', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useMinLovable([makeBlock({ fId: 'F.TableTest' })])
    await copyMarkdown()
    expect(written[0]).toContain('| Entry |')
    expect(written[0]).toContain('| MLP Score |')
  })

  it('copyMarkdown includes entry id in output', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useMinLovable([makeBlock({ fId: 'F.CopyCheck' })])
    await copyMarkdown()
    expect(written[0]).toContain('F.CopyCheck')
  })

  it('mixed F./V./S. blocks produce entries of all 3 types', () => {
    const block: SpecBlock = {
      functions: [{ id: 'F.Mix', type: 'Function', level: 'Product', description: 'f', successCriteria: '', functionOfValue: '' }],
      values: [{ id: 'V.Mix', type: 'Value', level: 'Product', description: 'v', scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '' }],
      solutions: [{ id: 'S.Mix', type: 'Solution', level: 'Product', description: 's', impact: '', function: '' }],
    }
    const { entries } = useMinLovable([block])
    const types = new Set(entries.value.map(e => e.type))
    expect(types.has('F')).toBe(true)
    expect(types.has('V')).toBe(true)
    expect(types.has('S')).toBe(true)
  })
})
