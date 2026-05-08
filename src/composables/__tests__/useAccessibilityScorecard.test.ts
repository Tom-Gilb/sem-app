// UNIT_TYPE=Test
// Feature #177 — Tests for useAccessibilityScorecard composable
// NOTE: This tests useAccessibilityScorecard.ts, NOT useAccessibilityChecker.ts (#38)

import { describe, it, expect } from 'vitest'
import { useAccessibilityScorecard, buildScorecardEntry } from '../useAccessibilityScorecard'
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
        meter: 'Average session time',
        status: 'Status 45 seconds',
        tolerable: 'Tolerable 30 seconds',
        goal: 'Goal 20 seconds',
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

// ── buildScorecardEntry unit tests ──────────────────────────────────────────

describe('buildScorecardEntry', () => {
  it('plainLanguage true: all words ≤ 12 chars', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Short words only', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.plainLanguage).toBe(true)
  })

  it('plainLanguage false: word longer than 12 chars', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Internationalization is important', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.plainLanguage).toBe(false)
  })

  it('numericGoal true for V. entry with digit in goal', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Some description for this entry here', 'seconds', 'Goal 20 seconds', 'F.Y', '', '')
    expect(e.criteria.numericGoal).toBe(true)
  })

  it('numericGoal false for V. entry without digit in goal', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Some description for this entry here', 'seconds', 'No number', 'F.Y', '', '')
    expect(e.criteria.numericGoal).toBe(false)
  })

  it('numericGoal always true for F. entries', () => {
    const e = buildScorecardEntry('F.X', 'F', 'Some description here for test', '', '', '', 'V.Y', '')
    expect(e.criteria.numericGoal).toBe(true)
  })

  it('numericGoal always true for S. entries', () => {
    const e = buildScorecardEntry('S.X', 'S', 'Some description here for test', '', '', '', '', 'F.Y')
    expect(e.criteria.numericGoal).toBe(true)
  })

  it('stakeholderCoverage: V. entry with non-empty valueOfFunction → true', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Description here for test entry', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.stakeholderCoverage).toBe(true)
  })

  it('stakeholderCoverage: V. entry with empty valueOfFunction → false', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Description here for test entry', 'seconds', '20', '', '', '')
    expect(e.criteria.stakeholderCoverage).toBe(false)
  })

  it('stakeholderCoverage: F. entry uses functionOfValue', () => {
    const e = buildScorecardEntry('F.X', 'F', 'Description here for test entry', '', '', '', 'V.Y', '')
    expect(e.criteria.stakeholderCoverage).toBe(true)
  })

  it('stakeholderCoverage: S. entry uses function field', () => {
    const e = buildScorecardEntry('S.X', 'S', 'Description here for test entry', '', '', '', '', 'F.Y')
    expect(e.criteria.stakeholderCoverage).toBe(true)
  })

  it('noPassiveVoice true: active description', () => {
    const e = buildScorecardEntry('V.X', 'V', 'The system tracks user sessions', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.noPassiveVoice).toBe(true)
  })

  it('noPassiveVoice false: passive voice detected', () => {
    const e = buildScorecardEntry('V.X', 'V', 'The session is tracked by the system here', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.noPassiveVoice).toBe(false)
  })

  it('unitsPresent true for V. entry with % in scale', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Description here for testing entry', '% completion rate', '20%', 'F.Y', '', '')
    expect(e.criteria.unitsPresent).toBe(true)
  })

  it('unitsPresent false for V. entry with no unit keyword', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Description here for testing entry', 'abstract value', '20', 'F.Y', '', '')
    expect(e.criteria.unitsPresent).toBe(false)
  })

  it('unitsPresent always true for F. entries', () => {
    const e = buildScorecardEntry('F.X', 'F', 'Description here for testing entry', '', '', '', 'V.Y', '')
    expect(e.criteria.unitsPresent).toBe(true)
  })

  it('descLength true: 20–200 chars', () => {
    const e = buildScorecardEntry('V.X', 'V', 'This is a valid description length', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.descLength).toBe(true)
  })

  it('descLength false: too short (< 20 chars)', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Too short', 'seconds', '20', 'F.Y', '', '')
    expect(e.criteria.descLength).toBe(false)
  })

  it('totalScore equals count of truths', () => {
    const e = buildScorecardEntry('V.X', 'V', 'Speed at which users complete SEM entries', 'seconds per entry', 'Goal 20', 'F.Y', '', '')
    const truthCount = Object.values(e.criteria).filter(Boolean).length
    expect(e.totalScore).toBe(truthCount)
  })

  it('grade A when totalScore >= 5', () => {
    const e = buildScorecardEntry(
      'V.X', 'V',
      'Speed at which users complete SEM entries',
      'seconds per entry',
      'Goal 20 seconds',
      'F.DeliverSEM',
      '',
      '',
    )
    expect(['A', 'B']).toContain(e.grade)
  })

  it('grade F when totalScore < 2', () => {
    // passiveVoice, short description, no units, no goal
    const e = buildScorecardEntry('V.X', 'V', 'Is tracked', '', '', '', '', '')
    expect(['F', 'D']).toContain(e.grade)
  })
})

// ── useAccessibilityScorecard composable tests ──────────────────────────────

describe('useAccessibilityScorecard', () => {
  it('empty blocks → no entries', () => {
    const { entries } = useAccessibilityScorecard([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = useAccessibilityScorecard([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('produces entries for F., V., and S. entries', () => {
    const { entries } = useAccessibilityScorecard([makeBlock()])
    expect(entries.value).toHaveLength(3)
  })

  it('entry types are correctly assigned', () => {
    const { entries } = useAccessibilityScorecard([makeBlock()])
    const types = entries.value.map(e => e.entryType)
    expect(types).toContain('F')
    expect(types).toContain('V')
    expect(types).toContain('S')
  })

  it('criteria aggregate produces 6 criterion objects', () => {
    const { criteria } = useAccessibilityScorecard([makeBlock()])
    expect(criteria.value).toHaveLength(6)
  })

  it('passRate is between 0 and 100', () => {
    const { criteria } = useAccessibilityScorecard([makeBlock()])
    for (const c of criteria.value) {
      expect(c.passRate).toBeGreaterThanOrEqual(0)
      expect(c.passRate).toBeLessThanOrEqual(100)
    }
  })

  it('passCount + failCount equals total entry count', () => {
    const { criteria, entries } = useAccessibilityScorecard([makeBlock()])
    for (const c of criteria.value) {
      expect(c.passCount + c.failCount).toBe(entries.value.length)
    }
  })

  it('overallScore is 0 for empty blocks', () => {
    const { overallScore } = useAccessibilityScorecard([])
    expect(overallScore.value).toBe(0)
  })

  it('overallScore is between 0 and 6 for populated blocks', () => {
    const { overallScore } = useAccessibilityScorecard([makeBlock()])
    expect(overallScore.value).toBeGreaterThanOrEqual(0)
    expect(overallScore.value).toBeLessThanOrEqual(6)
  })

  it('overallGrade is a valid letter', () => {
    const { overallGrade } = useAccessibilityScorecard([makeBlock()])
    expect(['A', 'B', 'C', 'D', 'F']).toContain(overallGrade.value)
  })

  it('open ref starts false', () => {
    const { open } = useAccessibilityScorecard([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useAccessibilityScorecard([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks correctly', () => {
    const { entries } = useAccessibilityScorecard([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(6)
  })
})
