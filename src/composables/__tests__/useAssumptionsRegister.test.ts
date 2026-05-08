// UNIT_TYPE=Test
// Feature #87 — useAssumptionsRegister composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useAssumptionsRegister } from '../useAssumptionsRegister'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

function makeVEntry(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'A test value entry',
    scale: 'score out of 100',
    meter: 'Automated test',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  const f: FEntry = {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function',
    successCriteria: '',
    functionOfValue: '',
  }
  const s: SEntry = {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution',
    impact: '',
    function: '',
  }
  return { functions: [f], values: [makeVEntry()], solutions: [s], ...overrides }
}

describe('useAssumptionsRegister', () => {
  it('initial state: assumptions is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { assumptions } = useAssumptionsRegister(spec)
    expect(assumptions.value).toHaveLength(0)
  })

  it('initial state: assumptionsOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { assumptionsOpen } = useAssumptionsRegister(spec)
    expect(assumptionsOpen.value).toBe(false)
  })

  it('extractAssumptions with null spec returns at least 1 synthetic assumption', () => {
    const spec = ref<SpecBlock | null>(null)
    const { assumptions, extractAssumptions } = useAssumptionsRegister(spec)
    extractAssumptions()
    expect(assumptions.value.length).toBeGreaterThanOrEqual(1)
    expect(assumptions.value[0].source).toBe('general')
  })

  it('extractAssumptions with description containing "assuming" detects that entry', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeVEntry({
        id: 'V.Alpha',
        description: 'This metric is valid assuming users are logged in consistently',
      })],
    }))
    const { assumptions, extractAssumptions } = useAssumptionsRegister(spec)
    extractAssumptions()
    const found = assumptions.value.find(a => a.source === 'V.Alpha')
    expect(found).toBeDefined()
  })

  it('IDs are sequential: A1, A2, A3', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [
        makeVEntry({ id: 'V.A', description: 'This assumes external service is available' }),
        makeVEntry({ id: 'V.B', description: 'Once the process is approved by the team' }),
        makeVEntry({ id: 'V.C', description: 'Will be delivered after integration completes' }),
      ],
    }))
    const { assumptions, extractAssumptions } = useAssumptionsRegister(spec)
    extractAssumptions()
    const ids = assumptions.value.map(a => a.id)
    for (let i = 0; i < ids.length; i++) {
      expect(ids[i]).toBe(`A${i + 1}`)
    }
  })

  it('risk field is one of H, M, L', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeVEntry({ description: 'Will be done assuming the team approves it' })],
    }))
    const { assumptions, extractAssumptions } = useAssumptionsRegister(spec)
    extractAssumptions()
    for (const a of assumptions.value) {
      expect(['H', 'M', 'L']).toContain(a.risk)
    }
  })

  it('validation is a non-empty string', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeVEntry({ description: 'Assumes external api is responsive' })],
    }))
    const { assumptions, extractAssumptions } = useAssumptionsRegister(spec)
    extractAssumptions()
    for (const a of assumptions.value) {
      expect(typeof a.validation).toBe('string')
      expect(a.validation.length).toBeGreaterThan(0)
    }
  })

  it('copyRegister markdown has pipe table with | ID |', () => {
    let clipboardText = ''
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
      clipboardText = text
    })
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeVEntry({ description: 'This assumes users are active' })],
    }))
    const { extractAssumptions, copyRegister } = useAssumptionsRegister(spec)
    extractAssumptions()
    copyRegister()
    expect(clipboardText).toContain('| ID |')
  })

  it('copyRegister includes all assumption IDs', () => {
    let clipboardText = ''
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
      clipboardText = text
    })
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [
        makeVEntry({ id: 'V.A', description: 'Assuming the service is available' }),
        makeVEntry({ id: 'V.B', description: 'Will be ready once infrastructure is deployed' }),
      ],
    }))
    const { assumptions, extractAssumptions, copyRegister } = useAssumptionsRegister(spec)
    extractAssumptions()
    copyRegister()
    for (const a of assumptions.value) {
      expect(clipboardText).toContain(a.id)
    }
  })
})
