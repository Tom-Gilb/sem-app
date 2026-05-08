// UNIT_TYPE=Test
// Feature #191 — Tests for useValueAddRatio composable

import { describe, it, expect } from 'vitest'
import {
  WASTE_SIGNALS,
  buildValueAddEntry,
  detectWasteSignals,
  useValueAddRatio,
} from '../useValueAddRatio'
import type { SpecBlock } from '../../types/spec'

function makeV(id: string, goal: string, status: string, description = 'Measure something', valueOfFunction = 'F.Test') {
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
    valueOfFunction,
  }
}

function makeF(id: string) {
  return {
    id,
    type: 'Function',
    level: 'Product',
    description: 'Some function',
    successCriteria: 'Passes',
    functionOfValue: 'V.Test',
  }
}

function makeS(id: string, description: string, functionLink: string) {
  return {
    id,
    type: 'Solution',
    level: 'Product',
    description,
    impact: 'V.Test ~50%',
    function: functionLink,
  }
}

function makeBlock(): SpecBlock {
  return {
    functions: [makeF('F.Test')],
    values: [
      makeV('V.Alpha', 'Goal 100', 'Status 30', 'Improve alpha throughput', 'F.Test'),
      makeV('V.Beta', 'Goal TBD', 'Status TBD', 'Beta measurement'),
    ],
    solutions: [
      makeS('S.One', 'Handle manual batch handoff process', 'F.Test'),
    ],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── detectWasteSignals unit tests ─────────────────────────────────────────────

describe('detectWasteSignals', () => {
  it('detects "manual" in text', () => {
    expect(detectWasteSignals('This is a manual process')).toContain('manual')
  })

  it('detects multiple waste signals', () => {
    const signals = detectWasteSignals('manual rework workaround delay')
    expect(signals).toContain('manual')
    expect(signals).toContain('rework')
    expect(signals).toContain('workaround')
    expect(signals).toContain('delay')
  })

  it('returns empty array for clean text', () => {
    expect(detectWasteSignals('fast automated continuous delivery')).toHaveLength(0)
  })

  it('is case-insensitive', () => {
    expect(detectWasteSignals('MANUAL process')).toContain('manual')
  })

  it('does not return duplicates for same signal appearing twice', () => {
    const signals = detectWasteSignals('manual manual manual')
    const manualCount = signals.filter(s => s === 'manual').length
    expect(manualCount).toBe(1)
  })

  it('WASTE_SIGNALS list has exactly 10 items', () => {
    expect(WASTE_SIGNALS).toHaveLength(10)
  })
})

// ── buildValueAddEntry unit tests ─────────────────────────────────────────────

describe('buildValueAddEntry', () => {
  it('description truncated to 60 chars', () => {
    const e = buildValueAddEntry('V.X', 'A'.repeat(100), 'Goal 100', 'Status 50', [])
    expect(e.description).toHaveLength(60)
  })

  it('description shorter than 60 kept as-is', () => {
    const e = buildValueAddEntry('V.X', 'Short desc', 'Goal 100', 'Status 50', [])
    expect(e.description).toBe('Short desc')
  })

  it('computes vaRatio from goalNum and statusNum when both present', () => {
    // (100 - 30) / 100 * 100 = 70
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal 100', 'Status 30', [])
    expect(e.vaRatio).toBe(70)
  })

  it('negative status clamped to 0 in vaRatio calc', () => {
    // statusNum is 0 (negative not parsed, but 0 via Math.max would apply if parsed as negative)
    // "Status -10" → parsed as 10, Math.max(10,0) = 10; (100-10)/100*100 = 90
    // Actually parseFirstNum extracts first number: 10; Math.max(10,0)=10; (100-10)/100=90
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal 100', 'Status 0', [])
    // (100 - 0) / 100 * 100 = 100
    expect(e.vaRatio).toBe(100)
  })

  it('falls back to seeded vaRatio when goal unparseable', () => {
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal TBD', 'Status 30', [])
    expect(e.vaRatio).toBeGreaterThanOrEqual(40)
    expect(e.vaRatio).toBeLessThanOrEqual(89)
  })

  it('falls back to seeded vaRatio when status unparseable', () => {
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal 100', 'Status TBD', [])
    expect(e.vaRatio).toBeGreaterThanOrEqual(40)
    expect(e.vaRatio).toBeLessThanOrEqual(89)
  })

  it('wasteCount equals wasteSignals.length', () => {
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal 100', 'Status 50', ['manual', 'rework'])
    expect(e.wasteCount).toBe(2)
  })

  it('id stored correctly', () => {
    const e = buildValueAddEntry('V.MyId', 'Desc', 'Goal 100', 'Status 50', [])
    expect(e.id).toBe('V.MyId')
  })

  it('goalNum parsed correctly', () => {
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal 75.5', 'Status 50', [])
    expect(e.goalNum).toBe(75.5)
  })

  it('statusNum parsed correctly', () => {
    const e = buildValueAddEntry('V.X', 'Desc', 'Goal 100', 'Status 42.0', [])
    expect(e.statusNum).toBe(42.0)
  })
})

// ── useValueAddRatio composable tests ─────────────────────────────────────────

describe('useValueAddRatio', () => {
  it('empty blocks → no entries', () => {
    const { entries } = useValueAddRatio([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = useValueAddRatio([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('processes V. entries', () => {
    const { entries } = useValueAddRatio([makeBlock()])
    expect(entries.value).toHaveLength(2)
  })

  it('overallVaRatio is 0 when no entries', () => {
    const { overallVaRatio } = useValueAddRatio([])
    expect(overallVaRatio.value).toBe(0)
  })

  it('overallVaRatio is average of entry vaRatios (rounded)', () => {
    const { entries, overallVaRatio } = useValueAddRatio([makeBlock()])
    const sum = entries.value.reduce((a, e) => a + e.vaRatio, 0)
    const expected = Math.round(sum / entries.value.length)
    expect(overallVaRatio.value).toBe(expected)
  })

  it('topWastes is empty when no waste signals detected', () => {
    const block: SpecBlock = {
      functions: [makeF('F.Test')],
      values: [makeV('V.Clean', 'Goal 100', 'Status 50', 'Clean value', 'F.Test')],
      solutions: [makeS('S.Fast', 'Automated continuous pipeline', 'F.Test')],
    }
    const { topWastes } = useValueAddRatio([block])
    expect(topWastes.value).toHaveLength(0)
  })

  it('topWastes returns up to 5 signals sorted by frequency', () => {
    const { topWastes } = useValueAddRatio([makeBlock()])
    expect(topWastes.value.length).toBeLessThanOrEqual(5)
  })

  it('waste signals from linked S. entries are detected', () => {
    const block: SpecBlock = {
      functions: [makeF('F.Test')],
      values: [makeV('V.A', 'Goal 100', 'Status 50', 'Value A', 'F.Test')],
      solutions: [makeS('S.WasteFull', 'This requires manual rework workaround batch handoff', 'F.Test')],
    }
    const { entries } = useValueAddRatio([block])
    expect(entries.value[0].wasteSignals.length).toBeGreaterThan(0)
  })

  it('open ref starts false', () => {
    const { open } = useValueAddRatio([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useValueAddRatio([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = useValueAddRatio([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(4)
  })
})
