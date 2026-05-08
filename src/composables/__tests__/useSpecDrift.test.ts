// UNIT_TYPE=Test
// Feature #184 — Tests for useSpecDrift composable

import { describe, it, expect } from 'vitest'
import { buildDriftEntry, useSpecDrift } from '../useSpecDrift'
import type { SpecBlock } from '../../types/spec'

function makeBlock(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.DeliverSEM',
        type: 'Function',
        level: 'Product',
        description: 'Deliver a SEM entry interface',
        successCriteria: 'Users complete in 30s',
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
      {
        id: 'V.Accuracy',
        type: 'Value',
        level: 'Product',
        description: 'Correctness of SEM output data',
        scale: '% correct',
        meter: 'Automated diff',
        status: 'Status 70%',
        tolerable: 'Tolerable 80%',
        goal: '',
        valueOfFunction: 'F.DeliverSEM',
      },
      {
        id: 'V.Coverage',
        type: 'Value',
        level: 'Product',
        description: 'Field coverage across spec entries',
        scale: '% fields filled',
        meter: 'Field audit',
        status: 'Status 50%',
        tolerable: 'Tolerable 90%',
        goal: 'Goal 85%',
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

// ── buildDriftEntry unit tests ──────────────────────────────────────────────

describe('buildDriftEntry', () => {
  it('empty goal → hasDrift true, severity Critical, driftType No goal defined', () => {
    const e = buildDriftEntry('V.X', 'Some description here', '', 'Tolerable 30')
    expect(e.hasDrift).toBe(true)
    expect(e.severity).toBe('Critical')
    expect(e.driftType).toBe('No goal defined')
  })

  it('whitespace-only goal → hasDrift true, severity Critical', () => {
    const e = buildDriftEntry('V.X', 'Some description here', '   ', 'Tolerable 30')
    expect(e.hasDrift).toBe(true)
    expect(e.severity).toBe('Critical')
  })

  it('goal == tolerable numerically → hasDrift true, severity Warning', () => {
    const e = buildDriftEntry('V.X', 'Description', 'Goal 30 seconds', 'Tolerable 30 seconds')
    expect(e.hasDrift).toBe(true)
    expect(e.severity).toBe('Warning')
    expect(e.driftType).toBe('Goal ≤ Tolerable (should be higher)')
  })

  it('goal < tolerable numerically → hasDrift true, severity Warning', () => {
    const e = buildDriftEntry('V.X', 'Description', 'Goal 25', 'Tolerable 30')
    expect(e.hasDrift).toBe(true)
    expect(e.severity).toBe('Warning')
  })

  it('goal > tolerable → hasDrift false, severity OK', () => {
    // Goal 40 > Tolerable 30 → no drift (higher is better implied)
    const e = buildDriftEntry('V.X', 'Description', 'Goal 40 seconds', 'Tolerable 30 seconds')
    expect(e.hasDrift).toBe(false)
    expect(e.severity).toBe('OK')
    expect(e.driftType).toBe('No drift detected')
  })

  it('parses goalNum from goal string', () => {
    const e = buildDriftEntry('V.X', 'Description', 'Goal 42.5 units', 'Tolerable 30')
    expect(e.goalNum).toBe(42.5)
  })

  it('parses tolerableNum from tolerable string', () => {
    const e = buildDriftEntry('V.X', 'Description', 'Goal 50', 'Tolerable 30.0')
    expect(e.tolerableNum).toBe(30.0)
  })

  it('goalNum null when no number in goal', () => {
    const e = buildDriftEntry('V.X', 'Description', 'Goal TBD', 'Tolerable 30')
    expect(e.goalNum).toBeNull()
  })

  it('tolerableNum null when no number in tolerable', () => {
    const e = buildDriftEntry('V.X', 'Description', 'Goal 20', 'Tolerable TBD')
    expect(e.tolerableNum).toBeNull()
  })

  it('description truncated to 60 chars', () => {
    const long = 'A'.repeat(100)
    const e = buildDriftEntry('V.X', long, 'Goal 20', 'Tolerable 30')
    expect(e.description).toHaveLength(60)
  })

  it('description shorter than 60 chars kept as-is', () => {
    const e = buildDriftEntry('V.X', 'Short desc', 'Goal 20', 'Tolerable 10')
    expect(e.description).toBe('Short desc')
  })

  it('goal and tolerable stored verbatim on entry', () => {
    const e = buildDriftEntry('V.X', 'Desc', 'Goal 20 seconds', 'Tolerable 30 seconds')
    expect(e.goal).toBe('Goal 20 seconds')
    expect(e.tolerable).toBe('Tolerable 30 seconds')
  })

  it('non-parseable goal with non-parseable tolerable → OK (no drift)', () => {
    // Neither parsed → can't compare, not "no goal" because goal not empty
    const e = buildDriftEntry('V.X', 'Desc', 'Goal TBD', 'Tolerable TBD')
    expect(e.hasDrift).toBe(false)
    expect(e.severity).toBe('OK')
  })

  it('id stored correctly', () => {
    const e = buildDriftEntry('V.TestId', 'Desc', 'Goal 10', 'Tolerable 5')
    expect(e.id).toBe('V.TestId')
  })
})

// ── useSpecDrift composable tests ───────────────────────────────────────────

describe('useSpecDrift', () => {
  it('empty blocks → no entries', () => {
    const { entries } = useSpecDrift([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = useSpecDrift([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('processes only V. entries (not F. or S.)', () => {
    const { entries } = useSpecDrift([makeBlock()])
    expect(entries.value).toHaveLength(3)
  })

  it('entries sorted Critical first, then Warning, then OK', () => {
    const { entries } = useSpecDrift([makeBlock()])
    const severities = entries.value.map(e => e.severity)
    // V.Accuracy has no goal → Critical; V.Coverage goal < tolerable → Warning; V.EntryFluency goal 20 > tolerable 30 → actually 20 <= 30 so Warning too
    expect(severities[0]).toBe('Critical')
  })

  it('driftCount equals number of hasDrift=true entries', () => {
    const { entries, driftCount } = useSpecDrift([makeBlock()])
    const expected = entries.value.filter(e => e.hasDrift).length
    expect(driftCount.value).toBe(expected)
  })

  it('driftScore is 0 when no drift entries', () => {
    // Goal 50 > Tolerable 30 → no drift
    const block: SpecBlock = {
      functions: [],
      values: [
        {
          id: 'V.Good',
          type: 'Value',
          level: 'Product',
          description: 'Good value',
          scale: 'seconds',
          meter: 'timer',
          status: 'Status 60',
          tolerable: 'Tolerable 30',
          goal: 'Goal 50',
          valueOfFunction: 'F.X',
        },
      ],
      solutions: [],
    }
    const { driftScore } = useSpecDrift([block])
    expect(driftScore.value).toBe(0)
  })

  it('driftScore is 100 when all entries have drift', () => {
    const block: SpecBlock = {
      functions: [],
      values: [
        {
          id: 'V.Bad',
          type: 'Value',
          level: 'Product',
          description: 'Bad value',
          scale: 'seconds',
          meter: 'timer',
          status: 'Status 60',
          tolerable: 'Tolerable 30',
          goal: '',
          valueOfFunction: 'F.X',
        },
      ],
      solutions: [],
    }
    const { driftScore } = useSpecDrift([block])
    expect(driftScore.value).toBe(100)
  })

  it('driftScore is Math.round(driftCount/total*100)', () => {
    const { entries, driftCount, driftScore } = useSpecDrift([makeBlock()])
    const expected = Math.round(driftCount.value / entries.value.length * 100)
    expect(driftScore.value).toBe(expected)
  })

  it('open ref starts false', () => {
    const { open } = useSpecDrift([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useSpecDrift([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = useSpecDrift([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(6)
  })

  it('driftCount is at least 1 with empty-goal V. entry', () => {
    const { driftCount } = useSpecDrift([makeBlock()])
    expect(driftCount.value).toBeGreaterThanOrEqual(1)
  })
})
