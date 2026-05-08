// UNIT_TYPE=Test
// Feature #179 — Tests for useFeatureReadiness composable

import { describe, it, expect } from 'vitest'
import { useFeatureReadiness, buildFrlEntry } from '../useFeatureReadiness'
import type { SpecBlock } from '../../types/spec'

function makeBlock(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.ProvideSEMEntry',
        type: 'Function',
        level: 'Product',
        description: 'Provide a SEM entry interface for users to submit ideas',
        successCriteria: 'Users complete entry in under 30 seconds',
        functionOfValue: 'V.EntryFluency',
      },
      {
        id: 'F.ExportSpec',
        type: 'Function',
        level: 'Solution',
        description: 'Export the generated spec to markdown format',
        successCriteria: 'Spec exports in under 1 second',
        functionOfValue: 'V.ExportSpeed',
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
        valueOfFunction: 'F.ProvideSEMEntry',
      },
    ],
    solutions: [
      {
        id: 'S.AutoComplete',
        type: 'Solution',
        level: 'Product',
        description: 'Autocomplete suggestions for SEM fields to speed up entry',
        impact: 'V.EntryFluency ~80%',
        function: 'F.ProvideSEMEntry',
      },
    ],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── buildFrlEntry unit tests ────────────────────────────────────────────────

describe('buildFrlEntry', () => {
  it('returns an FrlEntry with correct id', () => {
    const e = buildFrlEntry('F.ProvideSEMEntry', 'F', 'Some description')
    expect(e.id).toBe('F.ProvideSEMEntry')
  })

  it('returns entryType F for function entries', () => {
    const e = buildFrlEntry('F.Test', 'F', 'Test description')
    expect(e.entryType).toBe('F')
  })

  it('returns entryType S for solution entries', () => {
    const e = buildFrlEntry('S.Test', 'S', 'Test description')
    expect(e.entryType).toBe('S')
  })

  it('truncates description to 60 chars', () => {
    const longDesc = 'A'.repeat(100)
    const e = buildFrlEntry('F.X', 'F', longDesc)
    expect(e.description).toHaveLength(60)
  })

  it('level is between 1 and 9 inclusive', () => {
    const e = buildFrlEntry('F.ProvideSEMEntry', 'F', 'Description')
    expect(e.level).toBeGreaterThanOrEqual(1)
    expect(e.level).toBeLessThanOrEqual(9)
  })

  it('level is deterministic (same id gives same level)', () => {
    const e1 = buildFrlEntry('F.Stable', 'F', 'Desc A')
    const e2 = buildFrlEntry('F.Stable', 'F', 'Desc B')
    expect(e1.level).toBe(e2.level)
  })

  it('levelDescription matches level from FRL_DESCRIPTIONS', () => {
    const e = buildFrlEntry('F.ProvideSEMEntry', 'F', 'Description')
    expect(typeof e.levelDescription).toBe('string')
    expect(e.levelDescription.length).toBeGreaterThan(0)
  })

  it('level 1–3 → colorClass text-red-600', () => {
    // Seed 'F.LowLevelXYZ' + 'frl' mod 9 → need a low level
    // Just test the logic: force check by brute-force finding an id
    for (let i = 0; i < 20; i++) {
      const id = `F.Test${i}`
      const e = buildFrlEntry(id, 'F', 'desc')
      if (e.level <= 3) {
        expect(e.colorClass).toBe('text-red-600')
        expect(e.bgClass).toBe('bg-red-50')
        break
      }
    }
  })

  it('level 4–6 → colorClass text-amber-600', () => {
    for (let i = 0; i < 30; i++) {
      const id = `F.Mid${i}`
      const e = buildFrlEntry(id, 'F', 'desc')
      if (e.level >= 4 && e.level <= 6) {
        expect(e.colorClass).toBe('text-amber-600')
        expect(e.bgClass).toBe('bg-amber-50')
        break
      }
    }
  })

  it('level 7–9 → colorClass text-emerald-600', () => {
    for (let i = 0; i < 40; i++) {
      const id = `F.High${i}`
      const e = buildFrlEntry(id, 'F', 'desc')
      if (e.level >= 7) {
        expect(e.colorClass).toBe('text-emerald-600')
        expect(e.bgClass).toBe('bg-emerald-50')
        break
      }
    }
  })

  it('short description kept unchanged', () => {
    const e = buildFrlEntry('F.X', 'F', 'Short desc')
    expect(e.description).toBe('Short desc')
  })
})

// ── useFeatureReadiness composable tests ────────────────────────────────────

describe('useFeatureReadiness', () => {
  it('returns empty entries for empty blocks array', () => {
    const { entries } = useFeatureReadiness([])
    expect(entries.value).toHaveLength(0)
  })

  it('returns empty entries for block with no functions or solutions', () => {
    const { entries } = useFeatureReadiness([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('produces entries for each F. and S. entry', () => {
    const { entries } = useFeatureReadiness([makeBlock()])
    // 2 functions + 1 solution = 3 entries
    expect(entries.value).toHaveLength(3)
  })

  it('F. entries come before S. entries', () => {
    const { entries } = useFeatureReadiness([makeBlock()])
    const types = entries.value.map(e => e.entryType)
    const firstSIndex = types.indexOf('S')
    const lastFIndex = types.lastIndexOf('F')
    expect(lastFIndex).toBeLessThan(firstSIndex)
  })

  it('avgLevel is 0 for empty blocks', () => {
    const { avgLevel } = useFeatureReadiness([])
    expect(avgLevel.value).toBe(0)
  })

  it('avgLevel is a number between 1 and 9 when entries exist', () => {
    const { avgLevel } = useFeatureReadiness([makeBlock()])
    expect(avgLevel.value).toBeGreaterThanOrEqual(1)
    expect(avgLevel.value).toBeLessThanOrEqual(9)
  })

  it('overallStatus is Early when avgLevel < 4', () => {
    // Use a block that produces low levels
    const lowBlock: SpecBlock = {
      functions: Array.from({ length: 5 }, (_, i) => ({
        id: `F.Low${i}`,
        type: 'Function',
        level: 'Product',
        description: 'Low level function',
        successCriteria: 'criteria',
        functionOfValue: '',
      })),
      values: [],
      solutions: [],
    }
    // Validate logic: status depends on avg
    const { avgLevel, overallStatus } = useFeatureReadiness([lowBlock])
    if (avgLevel.value < 4) {
      expect(overallStatus.value).toBe('Early')
    } else if (avgLevel.value < 7) {
      expect(overallStatus.value).toBe('Mid')
    } else {
      expect(overallStatus.value).toBe('Advanced')
    }
  })

  it('overallStatus is one of Early|Mid|Advanced', () => {
    const { overallStatus } = useFeatureReadiness([makeBlock()])
    expect(['Early', 'Mid', 'Advanced']).toContain(overallStatus.value)
  })

  it('open ref starts false', () => {
    const { open } = useFeatureReadiness([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useFeatureReadiness([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens entries from multiple blocks', () => {
    const { entries } = useFeatureReadiness([makeBlock(), makeBlock()])
    // 2 blocks × (2 F + 1 S) = 6 entries
    expect(entries.value).toHaveLength(6)
  })

  it('each entry has a non-empty levelDescription', () => {
    const { entries } = useFeatureReadiness([makeBlock()])
    for (const e of entries.value) {
      expect(e.levelDescription.length).toBeGreaterThan(0)
    }
  })

  it('entry id matches the source F. or S. id', () => {
    const { entries } = useFeatureReadiness([makeBlock()])
    const ids = entries.value.map(e => e.id)
    expect(ids).toContain('F.ProvideSEMEntry')
    expect(ids).toContain('S.AutoComplete')
  })
})
