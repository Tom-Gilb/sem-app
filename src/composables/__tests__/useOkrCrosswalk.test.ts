// UNIT_TYPE=Test
// Feature #102 — useOkrCrosswalk composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useOkrCrosswalk } from '../useOkrCrosswalk'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.ProvideSEMEntry',
    type: 'Function',
    level: 'Product',
    description: 'The system provides a structured entry interface.',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.EntryFluency',
    type: 'Value',
    level: 'Product',
    description: 'Measures user entry speed.',
    scale: 'seconds per entry',
    meter: 'Automated timer',
    status: 'Status [now] 60',
    tolerable: 'Tolerable [2026] 45',
    goal: 'Goal [2026] 30',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.MarkdownSerialiser',
    type: 'Solution',
    level: 'Product',
    description: 'A markdown serialiser outputs structured text.',
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

describe('useOkrCrosswalk', () => {
  it('initial: okrOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { okrOpen } = useOkrCrosswalk(spec)
    expect(okrOpen.value).toBe(false)
  })

  it('initial: objectives is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { objectives } = useOkrCrosswalk(spec)
    expect(objectives.value).toHaveLength(0)
  })

  it('buildOkrCrosswalk with null spec: at least 1 fallback objective', () => {
    const spec = ref<SpecBlock | null>(null)
    const { buildOkrCrosswalk, objectives } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    expect(objectives.value.length).toBeGreaterThanOrEqual(1)
  })

  it('buildOkrCrosswalk with F. entries: objectives.length equals F. entry count', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        functions: [makeF(), makeF({ id: 'F.2' }), makeF({ id: 'F.3' })],
      }),
    )
    const { buildOkrCrosswalk, objectives } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    expect(objectives.value.length).toBe(3)
  })

  it('each objective has a keyResults array', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { buildOkrCrosswalk, objectives } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    for (const obj of objectives.value) {
      expect(Array.isArray(obj.keyResults)).toBe(true)
    }
  })

  it('keyResult.keyResult starts with "KR"', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { buildOkrCrosswalk, objectives } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    const allKRs = objectives.value.flatMap(o => o.keyResults)
    expect(allKRs.length).toBeGreaterThan(0)
    for (const kr of allKRs) {
      expect(kr.keyResult).toMatch(/^KR\d/)
    }
  })

  it('keyResult.target is non-empty', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { buildOkrCrosswalk, objectives } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    const allKRs = objectives.value.flatMap(o => o.keyResults)
    for (const kr of allKRs) {
      expect(kr.target.length).toBeGreaterThan(0)
    }
  })

  it('copyOkrTable markdown contains "## OKR Crosswalk"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { buildOkrCrosswalk, copyOkrTable } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    await copyOkrTable()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('## OKR Crosswalk'))
  })

  it('copyOkrTable markdown contains "Current:" and "Target:"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { buildOkrCrosswalk, copyOkrTable } = useOkrCrosswalk(spec)
    buildOkrCrosswalk()
    await copyOkrTable()
    const text: string = writeText.mock.calls[0][0]
    expect(text).toContain('Current:')
    expect(text).toContain('Target:')
  })
})
