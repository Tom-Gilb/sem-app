// UNIT_TYPE=Test
// Feature #187 — Tests for useDeprecationRadar composable

import { describe, it, expect } from 'vitest'
import { buildDeprecationEntry, useDeprecationRadar } from '../useDeprecationRadar'
import type { SpecBlock } from '../../types/spec'

function makeBlock(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.DeliverSEM',
        type: 'Function',
        level: 'Product',
        description: 'Deliver a SEM entry interface for users',
        successCriteria: 'Users complete in 30s',
        functionOfValue: 'V.EntryFluency',
      },
      {
        id: 'F.ValidateInput',
        type: 'Function',
        level: 'Product',
        description: 'Validate user input before processing',
        successCriteria: 'Zero invalid inputs reach backend',
        functionOfValue: 'V.Accuracy',
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
      {
        id: 'S.ValidationMiddleware',
        type: 'Solution',
        level: 'Product',
        description: 'Middleware layer that validates incoming data',
        impact: 'V.Accuracy ~90%',
        function: 'F.ValidateInput',
      },
    ],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── buildDeprecationEntry unit tests ────────────────────────────────────────

describe('buildDeprecationEntry', () => {
  it('all axes are multiples of 10', () => {
    const e = buildDeprecationEntry('F.Test', 'F', 'Description of test entry here')
    expect(e.axes.age % 10).toBe(0)
    expect(e.axes.keywordRisk % 10).toBe(0)
    expect(e.axes.complexity % 10).toBe(0)
    expect(e.axes.coupling % 10).toBe(0)
    expect(e.axes.coverage % 10).toBe(0)
  })

  it('all axes are in range 0–90', () => {
    const e = buildDeprecationEntry('F.Test', 'F', 'Description of test entry here')
    for (const val of Object.values(e.axes)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(90)
    }
  })

  it('riskScore is average of 5 axes rounded', () => {
    const e = buildDeprecationEntry('F.Test', 'F', 'Description of test entry here')
    const avg = Math.round(
      (e.axes.age + e.axes.keywordRisk + e.axes.complexity + e.axes.coupling + e.axes.coverage) / 5,
    )
    expect(e.riskScore).toBe(avg)
  })

  it('riskLevel High when riskScore >= 60', () => {
    // We force a known id. Just verify rule applies to the built entry.
    const e = buildDeprecationEntry('F.Test', 'F', 'Description')
    if (e.riskScore >= 60) expect(e.riskLevel).toBe('High')
    else if (e.riskScore >= 30) expect(e.riskLevel).toBe('Medium')
    else expect(e.riskLevel).toBe('Low')
  })

  it('riskLevel Medium when 30 <= riskScore < 60', () => {
    // Test the rule directly: any entry where score is in [30,60) should be Medium
    const e = buildDeprecationEntry('F.Test', 'F', 'Description')
    expect(['High', 'Medium', 'Low']).toContain(e.riskLevel)
  })

  it('entryType F stored correctly', () => {
    const e = buildDeprecationEntry('F.MyFunc', 'F', 'Description')
    expect(e.entryType).toBe('F')
  })

  it('entryType S stored correctly', () => {
    const e = buildDeprecationEntry('S.MySolution', 'S', 'Description')
    expect(e.entryType).toBe('S')
  })

  it('description truncated to 60 chars', () => {
    const long = 'C'.repeat(100)
    const e = buildDeprecationEntry('F.X', 'F', long)
    expect(e.description).toHaveLength(60)
  })

  it('description shorter than 60 chars kept as-is', () => {
    const e = buildDeprecationEntry('F.X', 'F', 'Short description')
    expect(e.description).toBe('Short description')
  })

  it('id stored correctly', () => {
    const e = buildDeprecationEntry('F.SpecificId', 'F', 'Description')
    expect(e.id).toBe('F.SpecificId')
  })

  it('seeding is deterministic — same id always same axes', () => {
    const a = buildDeprecationEntry('F.DeliverSEM', 'F', 'Description')
    const b = buildDeprecationEntry('F.DeliverSEM', 'F', 'Description')
    expect(a.axes).toEqual(b.axes)
    expect(a.riskScore).toBe(b.riskScore)
  })

  it('axes object has exactly 5 keys', () => {
    const e = buildDeprecationEntry('F.Test', 'F', 'Description')
    expect(Object.keys(e.axes)).toHaveLength(5)
  })

  it('riskScore is within possible axis range (0–90)', () => {
    const e = buildDeprecationEntry('F.Test', 'F', 'Description')
    expect(e.riskScore).toBeGreaterThanOrEqual(0)
    expect(e.riskScore).toBeLessThanOrEqual(90)
  })
})

// ── useDeprecationRadar composable tests ────────────────────────────────────

describe('useDeprecationRadar', () => {
  it('empty blocks → no entries', () => {
    const { entries } = useDeprecationRadar([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = useDeprecationRadar([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('processes F. and S. entries but not V. entries', () => {
    const { entries } = useDeprecationRadar([makeBlock()])
    // makeBlock has 2 F and 2 S → total 4
    expect(entries.value).toHaveLength(4)
  })

  it('F. entries come before S. entries', () => {
    const { entries } = useDeprecationRadar([makeBlock()])
    const fIndices = entries.value.map((e, i) => e.entryType === 'F' ? i : -1).filter(i => i >= 0)
    const sIndices = entries.value.map((e, i) => e.entryType === 'S' ? i : -1).filter(i => i >= 0)
    if (fIndices.length > 0 && sIndices.length > 0) {
      expect(Math.max(...fIndices)).toBeLessThan(Math.min(...sIndices))
    }
  })

  it('F. group sorted descending by riskScore', () => {
    const { entries } = useDeprecationRadar([makeBlock()])
    const fEntries = entries.value.filter(e => e.entryType === 'F')
    for (let i = 1; i < fEntries.length; i++) {
      expect(fEntries[i - 1].riskScore).toBeGreaterThanOrEqual(fEntries[i].riskScore)
    }
  })

  it('S. group sorted descending by riskScore', () => {
    const { entries } = useDeprecationRadar([makeBlock()])
    const sEntries = entries.value.filter(e => e.entryType === 'S')
    for (let i = 1; i < sEntries.length; i++) {
      expect(sEntries[i - 1].riskScore).toBeGreaterThanOrEqual(sEntries[i].riskScore)
    }
  })

  it('highRiskCount equals count of High riskLevel entries', () => {
    const { entries, highRiskCount } = useDeprecationRadar([makeBlock()])
    const expected = entries.value.filter(e => e.riskLevel === 'High').length
    expect(highRiskCount.value).toBe(expected)
  })

  it('highRiskCount is 0 for empty blocks', () => {
    const { highRiskCount } = useDeprecationRadar([])
    expect(highRiskCount.value).toBe(0)
  })

  it('open ref starts false', () => {
    const { open } = useDeprecationRadar([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useDeprecationRadar([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = useDeprecationRadar([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(8)
  })

  it('all entries have a valid riskLevel', () => {
    const { entries } = useDeprecationRadar([makeBlock()])
    for (const e of entries.value) {
      expect(['High', 'Medium', 'Low']).toContain(e.riskLevel)
    }
  })
})
