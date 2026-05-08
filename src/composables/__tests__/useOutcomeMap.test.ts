// UNIT_TYPE=Test
// Feature #181 — Tests for useOutcomeMap composable

import { describe, it, expect } from 'vitest'
import { useOutcomeMap, buildOutcomeEntry } from '../useOutcomeMap'
import type { SpecBlock } from '../../types/spec'

function makeBlock(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.ProvideSEMEntry',
        type: 'Function',
        level: 'Product',
        description: 'Provide a SEM entry interface',
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
        valueOfFunction: 'F.ProvideSEMEntry',
      },
      {
        id: 'V.UserSatisfaction',
        type: 'Value',
        level: 'Stakeholder',
        description: 'Overall satisfaction of users with the product',
        scale: 'NPS score 0–10',
        meter: 'Quarterly NPS survey',
        status: 'Status [2025-01-01] 6',
        tolerable: 'Tolerable [2025-01-01] 7',
        goal: 'Goal [2025-01-01] 9',
        valueOfFunction: 'F.ProvideSEMEntry',
      },
    ],
    solutions: [],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── buildOutcomeEntry unit tests ────────────────────────────────────────────

describe('buildOutcomeEntry', () => {
  it('returns an OutcomeEntry with correct id', () => {
    const e = buildOutcomeEntry('V.EntryFluency', 'Description', 'Goal 20 sec')
    expect(e.id).toBe('V.EntryFluency')
  })

  it('truncates description to 60 chars', () => {
    const longDesc = 'B'.repeat(100)
    const e = buildOutcomeEntry('V.X', longDesc, 'Goal')
    expect(e.description).toHaveLength(60)
  })

  it('short description kept unchanged', () => {
    const e = buildOutcomeEntry('V.X', 'Short description', 'Goal')
    expect(e.description).toBe('Short description')
  })

  it('goal is stored as-is', () => {
    const e = buildOutcomeEntry('V.X', 'Desc', 'Goal [2025] 20 seconds')
    expect(e.goal).toBe('Goal [2025] 20 seconds')
  })

  it('category is one of Functional|Emotional|Social', () => {
    const e = buildOutcomeEntry('V.EntryFluency', 'Desc', 'Goal')
    expect(['Functional', 'Emotional', 'Social']).toContain(e.category)
  })

  it('importance is between 1 and 5 inclusive', () => {
    const e = buildOutcomeEntry('V.EntryFluency', 'Desc', 'Goal')
    expect(e.importance).toBeGreaterThanOrEqual(1)
    expect(e.importance).toBeLessThanOrEqual(5)
  })

  it('validity is one of Validated|Assumed|Unknown', () => {
    const e = buildOutcomeEntry('V.EntryFluency', 'Desc', 'Goal')
    expect(['Validated', 'Assumed', 'Unknown']).toContain(e.validity)
  })

  it('assumptions is a tuple of exactly 2 strings', () => {
    const e = buildOutcomeEntry('V.EntryFluency', 'Desc', 'Goal')
    expect(e.assumptions).toHaveLength(2)
    expect(typeof e.assumptions[0]).toBe('string')
    expect(typeof e.assumptions[1]).toBe('string')
  })

  it('two assumptions are different', () => {
    const e = buildOutcomeEntry('V.EntryFluency', 'Desc', 'Goal')
    expect(e.assumptions[0]).not.toBe(e.assumptions[1])
  })

  it('assumptions come from the known pool', () => {
    const pool = [
      'Users will find this intuitive',
      'Stakeholders will approve this approach',
      'The technical infrastructure supports this',
      'The team has capacity to deliver',
      'This will improve measurable outcomes',
      'External factors remain stable',
      'Data will be available for measurement',
      'Adoption will follow expected patterns',
    ]
    const e = buildOutcomeEntry('V.EntryFluency', 'Desc', 'Goal')
    expect(pool).toContain(e.assumptions[0])
    expect(pool).toContain(e.assumptions[1])
  })

  it('is deterministic (same id gives same results)', () => {
    const e1 = buildOutcomeEntry('V.Stable', 'Desc A', 'Goal A')
    const e2 = buildOutcomeEntry('V.Stable', 'Desc B', 'Goal B')
    expect(e1.category).toBe(e2.category)
    expect(e1.importance).toBe(e2.importance)
    expect(e1.validity).toBe(e2.validity)
    expect(e1.assumptions[0]).toBe(e2.assumptions[0])
    expect(e1.assumptions[1]).toBe(e2.assumptions[1])
  })
})

// ── useOutcomeMap composable tests ──────────────────────────────────────────

describe('useOutcomeMap', () => {
  it('returns empty entries for empty blocks array', () => {
    const { entries } = useOutcomeMap([])
    expect(entries.value).toHaveLength(0)
  })

  it('returns empty entries for block with no values', () => {
    const { entries } = useOutcomeMap([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('produces one entry per V. entry', () => {
    const { entries } = useOutcomeMap([makeBlock()])
    expect(entries.value).toHaveLength(2)
  })

  it('open ref starts false', () => {
    const { open } = useOutcomeMap([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useOutcomeMap([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('selectedCategory starts as All', () => {
    const { selectedCategory } = useOutcomeMap([makeBlock()])
    expect(selectedCategory.value).toBe('All')
  })

  it('filteredEntries returns all when selectedCategory is All', () => {
    const { entries, filteredEntries } = useOutcomeMap([makeBlock()])
    expect(filteredEntries.value).toHaveLength(entries.value.length)
  })

  it('filteredEntries filters by selectedCategory', () => {
    const { entries, filteredEntries, selectedCategory } = useOutcomeMap([makeBlock()])
    const firstCategory = entries.value[0].category
    selectedCategory.value = firstCategory
    const filtered = filteredEntries.value
    expect(filtered.every(e => e.category === firstCategory)).toBe(true)
  })

  it('filteredEntries is empty when selectedCategory matches no entries', () => {
    const block: SpecBlock = {
      functions: [],
      values: [
        {
          id: 'V.OnlyFunctional',
          type: 'Value',
          level: 'Product',
          description: 'Only one value entry',
          scale: 'count',
          meter: 'count',
          status: 'Status 0',
          tolerable: 'Tolerable 1',
          goal: 'Goal 5',
          valueOfFunction: '',
        },
      ],
      solutions: [],
    }
    const { entries, filteredEntries, selectedCategory } = useOutcomeMap([block])
    const entryCategory = entries.value[0].category
    const otherCategories = (['Functional', 'Emotional', 'Social'] as const).filter(c => c !== entryCategory)
    selectedCategory.value = otherCategories[0]
    expect(filteredEntries.value).toHaveLength(0)
  })

  it('flattens entries from multiple blocks', () => {
    const { entries } = useOutcomeMap([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(4)
  })

  it('entry ids match source V. entry ids', () => {
    const { entries } = useOutcomeMap([makeBlock()])
    const ids = entries.value.map(e => e.id)
    expect(ids).toContain('V.EntryFluency')
    expect(ids).toContain('V.UserSatisfaction')
  })
})
