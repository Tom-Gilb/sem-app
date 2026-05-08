// UNIT_TYPE=Test
// Feature #192 — Tests for useGapAnalysis composable

import { describe, it, expect } from 'vitest'
import { buildGapEntry, useGapAnalysis } from '../useGapAnalysis'
import type { SpecBlock } from '../../types/spec'

function makeV(id: string, goal: string, status: string, description = 'Some value') {
  return {
    id,
    type: 'Value',
    level: 'Product',
    description,
    scale: 'n',
    meter: 'm',
    status,
    tolerable: 'Tolerable 10',
    goal,
    valueOfFunction: 'F.Test',
  }
}

function makeBlock(): SpecBlock {
  return {
    functions: [],
    values: [
      makeV('V.Alpha', 'Goal 100', 'Status 30', 'Alpha value — measuring throughput'),
      makeV('V.Beta', 'Goal 80', 'Status 60', 'Beta value — measuring efficiency'),
      makeV('V.Gamma', 'Goal TBD', 'Status TBD', 'Gamma value — no numbers'),
    ],
    solutions: [],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── buildGapEntry unit tests ──────────────────────────────────────────────────

describe('buildGapEntry', () => {
  it('description truncated to 60 chars', () => {
    const e = buildGapEntry('V.X', 'A'.repeat(100), 'Goal 100', 'Status 30')
    expect(e.description).toHaveLength(60)
  })

  it('description shorter than 60 kept as-is', () => {
    const e = buildGapEntry('V.X', 'Short', 'Goal 100', 'Status 30')
    expect(e.description).toBe('Short')
  })

  it('gapAbs = goalNum - statusNum', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100', 'Status 30')
    expect(e.gapAbs).toBe(70)
  })

  it('gapPct = Math.round(gapAbs / Math.abs(goalNum) * 100)', () => {
    // (100-30)/100*100 = 70%
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100', 'Status 30')
    expect(e.gapPct).toBe(70)
  })

  it('gapAbs null when goalNum unparseable', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal TBD', 'Status 30')
    expect(e.gapAbs).toBeNull()
  })

  it('gapAbs null when statusNum unparseable', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100', 'Status TBD')
    expect(e.gapAbs).toBeNull()
  })

  it('gapPct null when goalNum is 0 (division by zero guard)', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal 0', 'Status 0')
    expect(e.gapPct).toBeNull()
  })

  it('isLargeGap true when gapPct > 50', () => {
    // (100-30)/100 = 70%
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100', 'Status 30')
    expect(e.isLargeGap).toBe(true)
  })

  it('isLargeGap false when gapPct <= 50', () => {
    // (100-60)/100 = 40%
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100', 'Status 60')
    expect(e.isLargeGap).toBe(false)
  })

  it('isLargeGap false when gapPct is null', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal TBD', 'Status TBD')
    expect(e.isLargeGap).toBe(false)
  })

  it('goalNum parsed correctly', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal 75.5', 'Status 30')
    expect(e.goalNum).toBe(75.5)
  })

  it('statusNum parsed correctly', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100', 'Status 42.0')
    expect(e.statusNum).toBe(42.0)
  })

  it('id stored correctly', () => {
    const e = buildGapEntry('V.MyId', 'Desc', 'Goal 100', 'Status 50')
    expect(e.id).toBe('V.MyId')
  })

  it('goal and status stored verbatim', () => {
    const e = buildGapEntry('V.X', 'Desc', 'Goal 100 units', 'Status 50 units')
    expect(e.goal).toBe('Goal 100 units')
    expect(e.status).toBe('Status 50 units')
  })

  it('gapPct negative when status > goal', () => {
    // (50 - 80) / 50 * 100 = -60%
    const e = buildGapEntry('V.X', 'Desc', 'Goal 50', 'Status 80')
    expect(e.gapPct).toBe(-60)
  })
})

// ── useGapAnalysis composable tests ──────────────────────────────────────────

describe('useGapAnalysis', () => {
  it('empty blocks → no entries', () => {
    const { entries } = useGapAnalysis([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = useGapAnalysis([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('processes V. entries from block', () => {
    const { entries } = useGapAnalysis([makeBlock()])
    expect(entries.value).toHaveLength(3)
  })

  it('entries sorted by gapPct descending, nulls last', () => {
    const { entries } = useGapAnalysis([makeBlock()])
    // V.Alpha 70%, V.Beta 25%, V.Gamma null
    const pcts = entries.value.map(e => e.gapPct)
    expect(pcts[0]).toBe(70)
    expect(pcts[1]).toBe(25)
    expect(pcts[2]).toBeNull()
  })

  it('largeGapCount counts entries with isLargeGap true', () => {
    const { entries, largeGapCount } = useGapAnalysis([makeBlock()])
    const expected = entries.value.filter(e => e.isLargeGap).length
    expect(largeGapCount.value).toBe(expected)
  })

  it('avgGapPct is 0 when all gaps are null', () => {
    const block: SpecBlock = {
      functions: [],
      values: [makeV('V.X', 'Goal TBD', 'Status TBD')],
      solutions: [],
    }
    const { avgGapPct } = useGapAnalysis([block])
    expect(avgGapPct.value).toBe(0)
  })

  it('avgGapPct excludes null gapPct values', () => {
    const { entries, avgGapPct } = useGapAnalysis([makeBlock()])
    const withPct = entries.value.filter(e => e.gapPct !== null)
    const expected = Math.round(withPct.reduce((a, e) => a + (e.gapPct as number), 0) / withPct.length)
    expect(avgGapPct.value).toBe(expected)
  })

  it('avgGapPct 0 when blocks empty', () => {
    const { avgGapPct } = useGapAnalysis([])
    expect(avgGapPct.value).toBe(0)
  })

  it('open ref starts false', () => {
    const { open } = useGapAnalysis([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useGapAnalysis([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = useGapAnalysis([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(6)
  })

  it('largeGapCount is 0 when all gapPct <= 50', () => {
    const block: SpecBlock = {
      functions: [],
      values: [makeV('V.X', 'Goal 100', 'Status 60')], // 40% gap
      solutions: [],
    }
    const { largeGapCount } = useGapAnalysis([block])
    expect(largeGapCount.value).toBe(0)
  })

  it('largeGapCount is 1 when one entry has gapPct > 50', () => {
    const block: SpecBlock = {
      functions: [],
      values: [makeV('V.X', 'Goal 100', 'Status 30')], // 70% gap
      solutions: [],
    }
    const { largeGapCount } = useGapAnalysis([block])
    expect(largeGapCount.value).toBe(1)
  })
})
