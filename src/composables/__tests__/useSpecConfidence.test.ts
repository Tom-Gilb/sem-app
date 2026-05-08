// UNIT_TYPE=Test
// Feature #78 — useSpecConfidence composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSpecConfidence } from '../useSpecConfidence'
import type { SpecBlock, VEntry } from '../../types/spec'

function makeVEntry(id: string, scale = 'score out of 100'): VEntry {
  return {
    id,
    type: 'Value',
    level: 'Product',
    description: `Description for ${id}`,
    scale,
    meter: 'Automated tracking',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: '',
  }
}

function makeSpec(...ids: string[]): SpecBlock {
  return {
    functions: [],
    values: ids.map(id => makeVEntry(id)),
    solutions: [],
  }
}

describe('useSpecConfidence', () => {
  it('initial state: confidenceOpen false, confidenceScores empty when spec is null', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { confidenceOpen, confidenceScores } = useSpecConfidence(specRef)
    expect(confidenceOpen.value).toBe(false)
    expect(Object.keys(confidenceScores.value)).toHaveLength(0)
  })

  it('initialises V. entry IDs to 75 when spec is set', () => {
    const spec = makeSpec('V.Alpha', 'V.Beta')
    const specRef = ref<SpecBlock | null>(spec)
    const { confidenceScores } = useSpecConfidence(specRef)
    expect(confidenceScores.value['V.Alpha']).toBe(75)
    expect(confidenceScores.value['V.Beta']).toBe(75)
  })

  it('setConfidence updates the value for a given ID', () => {
    const spec = makeSpec('V.Alpha')
    const specRef = ref<SpecBlock | null>(spec)
    const { confidenceScores, setConfidence } = useSpecConfidence(specRef)
    setConfidence('V.Alpha', 90)
    expect(confidenceScores.value['V.Alpha']).toBe(90)
  })

  it('setConfidence clamps to 0 at minimum', () => {
    const spec = makeSpec('V.Alpha')
    const specRef = ref<SpecBlock | null>(spec)
    const { confidenceScores, setConfidence } = useSpecConfidence(specRef)
    setConfidence('V.Alpha', -10)
    expect(confidenceScores.value['V.Alpha']).toBe(0)
  })

  it('setConfidence clamps to 100 at maximum', () => {
    const spec = makeSpec('V.Alpha')
    const specRef = ref<SpecBlock | null>(spec)
    const { confidenceScores, setConfidence } = useSpecConfidence(specRef)
    setConfidence('V.Alpha', 150)
    expect(confidenceScores.value['V.Alpha']).toBe(100)
  })

  it('avgConfidence computes mean correctly', () => {
    const spec = makeSpec('V.A', 'V.B')
    const specRef = ref<SpecBlock | null>(spec)
    const { avgConfidence, setConfidence } = useSpecConfidence(specRef)
    setConfidence('V.A', 80)
    setConfidence('V.B', 60)
    expect(avgConfidence.value).toBe(70)
  })

  it('lowConfidenceEntries returns IDs with score ≤60', () => {
    const spec = makeSpec('V.A', 'V.B', 'V.C')
    const specRef = ref<SpecBlock | null>(spec)
    const { lowConfidenceEntries, setConfidence } = useSpecConfidence(specRef)
    setConfidence('V.A', 60) // ≤60 → included
    setConfidence('V.B', 45) // ≤60 → included
    setConfidence('V.C', 75) // >60 → excluded
    expect(lowConfidenceEntries.value).toContain('V.A')
    expect(lowConfidenceEntries.value).toContain('V.B')
    expect(lowConfidenceEntries.value).not.toContain('V.C')
  })

  it('lowConfidenceEntries excludes IDs with score 61+', () => {
    const spec = makeSpec('V.A')
    const specRef = ref<SpecBlock | null>(spec)
    const { lowConfidenceEntries, setConfidence } = useSpecConfidence(specRef)
    setConfidence('V.A', 61)
    expect(lowConfidenceEntries.value).not.toContain('V.A')
  })

  it('copyConfidenceSummary markdown has "## Confidence Summary"', async () => {
    const spec = makeSpec('V.Alpha')
    const specRef = ref<SpecBlock | null>(spec)
    const { copyConfidenceSummary } = useSpecConfidence(specRef)

    let written = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => { written = text; return Promise.resolve() } },
      configurable: true,
    })

    copyConfidenceSummary()
    await Promise.resolve()
    expect(written).toContain('## Confidence Summary')
  })

  it('spec change adds new V. entry IDs without losing existing ones', async () => {
    const spec1 = makeSpec('V.A')
    const specRef = ref<SpecBlock | null>(spec1)
    const { confidenceScores, setConfidence } = useSpecConfidence(specRef)

    // Set a custom value for V.A
    setConfidence('V.A', 85)
    expect(confidenceScores.value['V.A']).toBe(85)

    // Change spec to include a new entry
    const spec2 = makeSpec('V.A', 'V.B')
    specRef.value = spec2

    // Allow watchers to fire
    await Promise.resolve()

    // V.A should keep its custom value
    expect(confidenceScores.value['V.A']).toBe(85)
    // V.B should be initialised to 75
    expect(confidenceScores.value['V.B']).toBe(75)
  })
})
