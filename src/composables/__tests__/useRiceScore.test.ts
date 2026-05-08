// UNIT_TYPE=Test
// Feature #72 — useRiceScore composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useRiceScore } from '../useRiceScore'
import type { SpecBlock } from '../../types/spec'

const makeSpec = (valueIds: string[]): SpecBlock => ({
  functions: [],
  values: valueIds.map(id => ({
    id,
    type: 'Value',
    level: 'Product',
    description: `Description for ${id}`,
    scale: `Scale for ${id} — measuring the important metric here`,
    meter: 'Automated tracking',
    status: '0',
    tolerable: '1',
    goal: '2',
    valueOfFunction: '',
  })),
  solutions: [],
})

const emptySpec: SpecBlock = { functions: [], values: [], solutions: [] }

describe('useRiceScore', () => {
  it('initial state: riceOpen false, riceEntries empty', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { riceOpen, riceEntries } = useRiceScore(specRef)
    expect(riceOpen.value).toBe(false)
    expect(riceEntries.value).toEqual([])
  })

  it('computeRiceScores with empty spec produces empty entries', () => {
    const specRef = ref<SpecBlock | null>(emptySpec)
    const { riceEntries, computeRiceScores } = useRiceScore(specRef)
    computeRiceScores()
    expect(riceEntries.value).toEqual([])
  })

  it('computeRiceScores with V. entries populates riceEntries', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A', 'V.B', 'V.C']))
    const { riceEntries, computeRiceScores } = useRiceScore(specRef)
    computeRiceScores()
    expect(riceEntries.value.length).toBe(3)
  })

  it('default RICE score is (1000 × 2 × 0.8) / 4 = 400', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A']))
    const { riceEntries, computeRiceScores } = useRiceScore(specRef)
    computeRiceScores()
    expect(riceEntries.value[0].score).toBe(400)
  })

  it('updateField reach changes score', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A']))
    const { riceEntries, computeRiceScores, updateField } = useRiceScore(specRef)
    computeRiceScores()
    updateField('V.A', 'reach', 2000)
    const entry = riceEntries.value.find(e => e.id === 'V.A')!
    expect(entry.reach).toBe(2000)
    // (2000 × 2 × 0.8) / 4 = 800
    expect(entry.score).toBe(800)
  })

  it('updateField clamps confidence to 0–100', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A']))
    const { riceEntries, computeRiceScores, updateField } = useRiceScore(specRef)
    computeRiceScores()
    updateField('V.A', 'confidence', 150)
    expect(riceEntries.value.find(e => e.id === 'V.A')!.confidence).toBe(100)
    updateField('V.A', 'confidence', -10)
    expect(riceEntries.value.find(e => e.id === 'V.A')!.confidence).toBe(0)
  })

  it('updateField clamps effort min 0.5', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A']))
    const { riceEntries, computeRiceScores, updateField } = useRiceScore(specRef)
    computeRiceScores()
    updateField('V.A', 'effort', 0)
    expect(riceEntries.value.find(e => e.id === 'V.A')!.effort).toBe(0.5)
  })

  it('entries sorted by score desc after update', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A', 'V.B']))
    const { riceEntries, computeRiceScores, updateField } = useRiceScore(specRef)
    computeRiceScores()
    // Give V.B a much higher reach so it scores higher
    updateField('V.B', 'reach', 9999)
    expect(riceEntries.value[0].id).toBe('V.B')
    expect(riceEntries.value[1].id).toBe('V.A')
  })

  it('copyRiceTable markdown has pipe table format', async () => {
    const writes: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: (t: string) => { writes.push(t); return Promise.resolve() } } },
      configurable: true,
    })
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A']))
    const { computeRiceScores, copyRiceTable } = useRiceScore(specRef)
    computeRiceScores()
    copyRiceTable()
    expect(writes[0]).toContain('| ID |')
    expect(writes[0]).toContain('| RICE Score |')
  })

  it('copyRiceTable includes all entry IDs', async () => {
    const writes: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: (t: string) => { writes.push(t); return Promise.resolve() } } },
      configurable: true,
    })
    const specRef = ref<SpecBlock | null>(makeSpec(['V.Alpha', 'V.Beta', 'V.Gamma']))
    const { computeRiceScores, copyRiceTable } = useRiceScore(specRef)
    computeRiceScores()
    copyRiceTable()
    expect(writes[0]).toContain('V.Alpha')
    expect(writes[0]).toContain('V.Beta')
    expect(writes[0]).toContain('V.Gamma')
  })

  it('each rice entry has all required fields', () => {
    const specRef = ref<SpecBlock | null>(makeSpec(['V.A']))
    const { riceEntries, computeRiceScores } = useRiceScore(specRef)
    computeRiceScores()
    const entry = riceEntries.value[0]
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('scale')
    expect(entry).toHaveProperty('reach')
    expect(entry).toHaveProperty('impact')
    expect(entry).toHaveProperty('confidence')
    expect(entry).toHaveProperty('effort')
    expect(entry).toHaveProperty('score')
  })

  it('scale field is truncated to 60 chars', () => {
    const longScale = 'A'.repeat(100)
    const spec: SpecBlock = {
      functions: [],
      values: [{
        id: 'V.Long',
        type: 'Value',
        level: 'Product',
        description: 'test',
        scale: longScale,
        meter: '',
        status: '',
        tolerable: '',
        goal: '',
        valueOfFunction: '',
      }],
      solutions: [],
    }
    const specRef = ref<SpecBlock | null>(spec)
    const { riceEntries, computeRiceScores } = useRiceScore(specRef)
    computeRiceScores()
    expect(riceEntries.value[0].scale.length).toBe(60)
  })
})
