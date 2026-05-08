// UNIT_TYPE=Test
// Feature #104 — useGoalLadder composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useGoalLadder } from '../useGoalLadder'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'Test value',
    scale: 'percent',
    meter: 'Automated',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80%',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution',
    impact: '',
    function: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [makeF()],
    values: [makeV()],
    solutions: [makeS()],
    ...overrides,
  }
}

describe('useGoalLadder', () => {
  it('ladderOpen is initially false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { ladderOpen } = useGoalLadder(spec)
    expect(ladderOpen.value).toBe(false)
  })

  it('ladderEntries is empty for null spec', () => {
    const spec = ref<SpecBlock | null>(null)
    const { ladderEntries } = useGoalLadder(spec)
    expect(ladderEntries.value).toHaveLength(0)
  })

  it('V. entry with goal "80%" produces 1 LadderEntry', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Fluency', goal: 'Goal [2026] 80%', tolerable: '', wish: '' })],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    expect(ladderEntries.value).toHaveLength(1)
    expect(ladderEntries.value[0].id).toBe('V.Fluency')
  })

  it('LadderRung.numericValue is parsed correctly from "80%"', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Fluency', goal: 'Goal [2026] 80%', tolerable: '', wish: '' })],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    const goalRung = ladderEntries.value[0].rungs.find(r => r.label === 'Goal')
    expect(goalRung).toBeDefined()
    expect(goalRung!.numericValue).toBe(80)
  })

  it('LadderRung for Goal has colour "emerald"', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ id: 'V.Test', goal: 'Goal [2026] 80%', tolerable: '', wish: '' })],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    const goalRung = ladderEntries.value[0].rungs.find(r => r.label === 'Goal')
    expect(goalRung!.colour).toBe('emerald')
  })

  it('Entry with empty tolerable: only non-empty rungs included', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ tolerable: '', goal: 'Goal [2026] 80%', wish: '' })],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    const rungs = ladderEntries.value[0].rungs
    expect(rungs.every(r => r.label !== 'Tolerable')).toBe(true)
    expect(rungs.some(r => r.label === 'Goal')).toBe(true)
  })

  it('maxNumeric is max across all rungs', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({
        tolerable: 'Tolerable [2026] 60',
        goal: 'Goal [2026] 80',
        wish: 'Wish 95',
      })],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    expect(ladderEntries.value[0].maxNumeric).toBe(95)
  })

  it('Multiple V. entries produce multiple LadderEntry objects', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [
        makeV({ id: 'V.Alpha', goal: 'Goal 80%' }),
        makeV({ id: 'V.Beta', goal: 'Goal 90%' }),
        makeV({ id: 'V.Gamma', goal: 'Goal 70%' }),
      ],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    expect(ladderEntries.value).toHaveLength(3)
    expect(ladderEntries.value.map(e => e.id)).toEqual(['V.Alpha', 'V.Beta', 'V.Gamma'])
  })

  it('LadderRung for Tolerable has colour "amber"', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({ tolerable: 'Tolerable [2026] 60', goal: '', wish: '' })],
    }))
    const { ladderEntries } = useGoalLadder(spec)
    const rung = ladderEntries.value[0].rungs.find(r => r.label === 'Tolerable')
    expect(rung!.colour).toBe('amber')
  })
})
