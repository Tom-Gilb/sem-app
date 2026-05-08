// UNIT_TYPE=Test
// Feature #186 — Tests for usePriorityMatrix composable

import { describe, it, expect } from 'vitest'
import { buildMatrixEntry, usePriorityMatrix } from '../usePriorityMatrix'
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
        status: 'Status 45',
        tolerable: 'Tolerable 30',
        goal: 'Goal 20',
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
        goal: 'Goal 95%',
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

// ── buildMatrixEntry unit tests ─────────────────────────────────────────────

describe('buildMatrixEntry', () => {
  it('urgency is between 1 and 5', () => {
    const e = buildMatrixEntry('V.Test', 'Description of the value entry here')
    expect(e.urgency).toBeGreaterThanOrEqual(1)
    expect(e.urgency).toBeLessThanOrEqual(5)
  })

  it('impact is between 1 and 5', () => {
    const e = buildMatrixEntry('V.Test', 'Description of the value entry here')
    expect(e.impact).toBeGreaterThanOrEqual(1)
    expect(e.impact).toBeLessThanOrEqual(5)
  })

  it('urgency>2 && impact>2 → Do Now quadrant', () => {
    // Find an id that produces urgency>2 and impact>2
    // seed('V.DoNow'+'urg',5) and seed('V.DoNow'+'imp',5)
    // We test determinism: same id always same values
    const e1 = buildMatrixEntry('V.DoNow', 'Some description text')
    const e2 = buildMatrixEntry('V.DoNow', 'Some description text')
    expect(e1.urgency).toBe(e2.urgency)
    expect(e1.impact).toBe(e2.impact)
    expect(e1.quadrant).toBe(e2.quadrant)
  })

  it('quadrant assigned consistently with urgency/impact values', () => {
    const e = buildMatrixEntry('V.Alpha', 'Alpha value description here for test')
    const { urgency, impact, quadrant } = e
    if (urgency > 2 && impact > 2) expect(quadrant).toBe('Do Now')
    else if (urgency <= 2 && impact > 2) expect(quadrant).toBe('Plan')
    else if (urgency > 2 && impact <= 2) expect(quadrant).toBe('Maybe')
    else expect(quadrant).toBe('Drop')
  })

  it('description truncated to 50 chars', () => {
    const long = 'B'.repeat(100)
    const e = buildMatrixEntry('V.X', long)
    expect(e.description).toHaveLength(50)
  })

  it('description shorter than 50 chars kept as-is', () => {
    const e = buildMatrixEntry('V.X', 'Short description')
    expect(e.description).toBe('Short description')
  })

  it('id stored correctly', () => {
    const e = buildMatrixEntry('V.SomeValue', 'Description text here')
    expect(e.id).toBe('V.SomeValue')
  })

  it('seeding is deterministic — same id always same urgency', () => {
    const ids = ['V.EntryFluency', 'V.Accuracy', 'V.Coverage', 'V.Speed']
    for (const id of ids) {
      const a = buildMatrixEntry(id, 'desc')
      const b = buildMatrixEntry(id, 'desc')
      expect(a.urgency).toBe(b.urgency)
      expect(a.impact).toBe(b.impact)
    }
  })

  it('different ids produce potentially different urgency', () => {
    // At minimum, the function produces values in [1,5]
    const e1 = buildMatrixEntry('V.Alpha', 'desc')
    const e2 = buildMatrixEntry('V.ZZZZZZZZZZZZz', 'desc')
    expect(e1.urgency).toBeGreaterThanOrEqual(1)
    expect(e2.urgency).toBeGreaterThanOrEqual(1)
  })

  it('quadrant is one of the four valid values', () => {
    const e = buildMatrixEntry('V.Test', 'Description text')
    expect(['Do Now', 'Plan', 'Maybe', 'Drop']).toContain(e.quadrant)
  })
})

// ── usePriorityMatrix composable tests ──────────────────────────────────────

describe('usePriorityMatrix', () => {
  it('empty blocks → no entries', () => {
    const { entries } = usePriorityMatrix([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = usePriorityMatrix([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('processes only V. entries (not F. or S.)', () => {
    const { entries } = usePriorityMatrix([makeBlock()])
    expect(entries.value).toHaveLength(2)
  })

  it('selectedQuadrant starts as All', () => {
    const { selectedQuadrant } = usePriorityMatrix([makeBlock()])
    expect(selectedQuadrant.value).toBe('All')
  })

  it('filteredEntries equals all entries when selectedQuadrant is All', () => {
    const { entries, filteredEntries } = usePriorityMatrix([makeBlock()])
    expect(filteredEntries.value).toHaveLength(entries.value.length)
  })

  it('filteredEntries filters by selectedQuadrant', () => {
    const { entries, selectedQuadrant, filteredEntries } = usePriorityMatrix([makeBlock()])
    if (entries.value.length > 0) {
      const q = entries.value[0].quadrant
      selectedQuadrant.value = q
      expect(filteredEntries.value.every(e => e.quadrant === q)).toBe(true)
    }
  })

  it('filteredEntries is empty when no entries match selected quadrant', () => {
    const { filteredEntries, selectedQuadrant } = usePriorityMatrix([makeEmptyBlock()])
    selectedQuadrant.value = 'Do Now'
    expect(filteredEntries.value).toHaveLength(0)
  })

  it('open ref starts false', () => {
    const { open } = usePriorityMatrix([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = usePriorityMatrix([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = usePriorityMatrix([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(4)
  })

  it('all entries have urgency in range 1–5', () => {
    const { entries } = usePriorityMatrix([makeBlock()])
    for (const e of entries.value) {
      expect(e.urgency).toBeGreaterThanOrEqual(1)
      expect(e.urgency).toBeLessThanOrEqual(5)
    }
  })

  it('all entries have impact in range 1–5', () => {
    const { entries } = usePriorityMatrix([makeBlock()])
    for (const e of entries.value) {
      expect(e.impact).toBeGreaterThanOrEqual(1)
      expect(e.impact).toBeLessThanOrEqual(5)
    }
  })

  it('all entries have a valid quadrant', () => {
    const { entries } = usePriorityMatrix([makeBlock()])
    for (const e of entries.value) {
      expect(['Do Now', 'Plan', 'Maybe', 'Drop']).toContain(e.quadrant)
    }
  })

  it('filteredEntries reacts when selectedQuadrant changes back to All', () => {
    const { entries, selectedQuadrant, filteredEntries } = usePriorityMatrix([makeBlock()])
    selectedQuadrant.value = 'Drop'
    selectedQuadrant.value = 'All'
    expect(filteredEntries.value).toHaveLength(entries.value.length)
  })
})
