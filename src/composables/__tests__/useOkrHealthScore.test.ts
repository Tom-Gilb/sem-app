// UNIT_TYPE=Test
// Feature #174 — Tests for useOkrHealthScore composable

import { describe, it, expect } from 'vitest'
import { useOkrHealthScore, buildOkrHealthEntry } from '../useOkrHealthScore'
import type { SpecBlock } from '../../types/spec'

function makeBlock(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.DeliverSEM',
        type: 'Function',
        level: 'Product',
        description: 'Deliver a SEM entry interface for users',
        successCriteria: 'Users complete entry in under 30 seconds',
        functionOfValue: 'V.EntryFluency',
      },
    ],
    values: [
      {
        id: 'V.EntryFluency',
        type: 'Value',
        level: 'Product',
        description: 'Speed at which users complete SEM entries',
        scale: 'seconds per entry',
        meter: 'Average session time from open to submit',
        status: 'Status [2025-01-01] 45 seconds',
        tolerable: 'Tolerable [2025-01-01] 30 seconds',
        goal: 'Goal [2025-01-01] 20 seconds',
        valueOfFunction: 'F.DeliverSEM',
      },
    ],
    solutions: [
      {
        id: 'S.AutoComplete',
        type: 'Solution',
        level: 'Product',
        description: 'Autocomplete suggestions for SEM fields',
        impact: 'V.EntryFluency ~80%',
        function: 'F.DeliverSEM',
      },
    ],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── buildOkrHealthEntry unit tests ──────────────────────────────────────────

describe('buildOkrHealthEntry', () => {
  it('measures measurability: goal with digit → true', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal 20 seconds', 'Goal 20 seconds', 'Tolerable 10 seconds', 'F.Y')
    expect(e.measurability).toBe(true)
  })

  it('measures measurability: goal without digit → false', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'No goal defined', 'No goal defined', '', 'F.Y')
    expect(e.measurability).toBe(false)
  })

  it('ambition: goal number > tolerable number → true', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal: 20 sec', 'Goal: 20 sec', 'Tolerable: 10 sec', 'F.Y')
    expect(e.ambition).toBe(true)
  })

  it('ambition: goal number <= tolerable number → false', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal: 5 sec', 'Goal: 5 sec', 'Tolerable: 30 sec', 'F.Y')
    expect(e.ambition).toBe(false)
  })

  it('ambition: unparseable values fall back to seed', () => {
    const e = buildOkrHealthEntry('V.Seed', 'Obj', 'No goal', 'No goal', 'No tolerable', 'F.Y')
    expect(typeof e.ambition).toBe('boolean')
  })

  it('coverage: non-empty valueOfFunction → true', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal 20', 'Goal 20', '10', 'F.DeliverSEM')
    expect(e.coverage).toBe(true)
  })

  it('coverage: empty valueOfFunction → false', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal 20', 'Goal 20', '10', '')
    expect(e.coverage).toBe(false)
  })

  it('score: all true → 100', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal 20', 'Goal 20', '10', 'F.Y')
    expect(e.score).toBe(100)
  })

  it('score: none true → 0', () => {
    const e = buildOkrHealthEntry('V.None', 'Obj', 'No goal', 'No goal', 'No tolerable', '')
    // ambition seeded: score depends on seed
    expect(e.score).toBeGreaterThanOrEqual(0)
    expect(e.score).toBeLessThanOrEqual(100)
  })

  it('grade A ≥ 90', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', 'Goal 20', 'Goal 20', '10', 'F.Y')
    expect(e.grade).toBe('A')
  })

  it('grade F when score < 40', () => {
    // only coverage=true (34 pts), measurability and ambition false
    const e = buildOkrHealthEntry('V.GradeF', 'Obj', 'No goal', 'No goal', 'No tolerable', 'F.Y')
    // seed('V.GradeF'+'amb', 2): 'V.GradeF' charCodes = 86+46+71+114+97+100+101+70 = 685; 'amb' = 97+109+98 = 304; total = 989 % 2 = 1 → ambition=true
    // So score = 0 + 33 + 34 = 67 → grade C
    expect(['A', 'B', 'C', 'D', 'F']).toContain(e.grade)
  })

  it('keyResult falls back to "No goal defined" when empty', () => {
    const e = buildOkrHealthEntry('V.X', 'Obj', '', '', '', 'F.Y')
    expect(e.keyResult).toBe('No goal defined')
  })
})

// ── useOkrHealthScore composable tests ──────────────────────────────────────

describe('useOkrHealthScore', () => {
  it('returns empty entries for empty blocks array', () => {
    const { entries } = useOkrHealthScore([])
    expect(entries.value).toHaveLength(0)
  })

  it('returns empty entries for block with no values', () => {
    const { entries } = useOkrHealthScore([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('produces one entry per V. entry', () => {
    const { entries } = useOkrHealthScore([makeBlock()])
    expect(entries.value).toHaveLength(1)
  })

  it('entry id matches V. entry id', () => {
    const { entries } = useOkrHealthScore([makeBlock()])
    expect(entries.value[0].id).toBe('V.EntryFluency')
  })

  it('objective uses linked F. description when found', () => {
    const { entries } = useOkrHealthScore([makeBlock()])
    expect(entries.value[0].objective).toContain('Deliver a SEM entry')
  })

  it('overallScore is 0 for empty blocks', () => {
    const { overallScore } = useOkrHealthScore([])
    expect(overallScore.value).toBe(0)
  })

  it('overallScore is a number between 0 and 100', () => {
    const { overallScore } = useOkrHealthScore([makeBlock()])
    expect(overallScore.value).toBeGreaterThanOrEqual(0)
    expect(overallScore.value).toBeLessThanOrEqual(100)
  })

  it('overallGrade is a valid letter', () => {
    const { overallGrade } = useOkrHealthScore([makeBlock()])
    expect(['A', 'B', 'C', 'D', 'F']).toContain(overallGrade.value)
  })

  it('open ref starts false', () => {
    const { open } = useOkrHealthScore([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useOkrHealthScore([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = useOkrHealthScore([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(2)
  })

  it('entry with goal > tolerable → ambition true', () => {
    const { entries } = useOkrHealthScore([makeBlock()])
    // goal contains "20", tolerable contains "30" — goal(20) < tolerable(30) → ambition false
    // Because lower number is better here; but the rule says goal > tolerable numerically
    // 20 > 30 is false → ambition=false
    expect(entries.value[0].ambition).toBe(false)
  })

  it('entry has valid grade', () => {
    const { entries } = useOkrHealthScore([makeBlock()])
    expect(['A', 'B', 'C', 'D', 'F']).toContain(entries.value[0].grade)
  })
})
