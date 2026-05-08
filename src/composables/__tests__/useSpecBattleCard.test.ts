// UNIT_TYPE=Test
// Feature #99 — useSpecBattleCard composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useSpecBattleCard } from '../useSpecBattleCard'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.ProvideSEMEntry',
    type: 'Function',
    level: 'Product',
    description: 'The system provides an entry interface.',
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
    description: 'Measures entry speed.',
    scale: 'seconds per entry',
    meter: 'Automated timer',
    status: 'Status [now] 60',
    tolerable: 'Tolerable [2026] 45',
    goal: 'Goal [2026] 30 seconds',
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

describe('useSpecBattleCard', () => {
  it('initial: battleOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { battleOpen } = useSpecBattleCard(spec)
    expect(battleOpen.value).toBe(false)
  })

  it('initial: strengths and weaknesses are empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { strengths, weaknesses } = useSpecBattleCard(spec)
    expect(strengths.value).toHaveLength(0)
    expect(weaknesses.value).toHaveLength(0)
  })

  it('analyseSpec with null spec: fallback strength and weakness each have 1 entry', () => {
    const spec = ref<SpecBlock | null>(null)
    const { analyseSpec, strengths, weaknesses } = useSpecBattleCard(spec)
    analyseSpec()
    expect(strengths.value.length).toBeGreaterThanOrEqual(1)
    expect(weaknesses.value.length).toBeGreaterThanOrEqual(1)
  })

  it('analyseSpec with full spec: strengths.length is between 1 and 3', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        functions: [makeF(), makeF({ id: 'F.2' }), makeF({ id: 'F.3' })],
        values: [makeV(), makeV({ id: 'V.2' }), makeV({ id: 'V.3' })],
        solutions: [makeS(), makeS({ id: 'S.2' }), makeS({ id: 'S.3' })],
      }),
    )
    const { analyseSpec, strengths } = useSpecBattleCard(spec)
    analyseSpec()
    expect(strengths.value.length).toBeGreaterThanOrEqual(1)
    expect(strengths.value.length).toBeLessThanOrEqual(3)
  })

  it('analyseSpec with full spec: weaknesses.length is between 1 and 3', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        functions: [makeF(), makeF({ id: 'F.2' }), makeF({ id: 'F.3' })],
        values: [makeV(), makeV({ id: 'V.2' }), makeV({ id: 'V.3' })],
        solutions: [makeS(), makeS({ id: 'S.2' }), makeS({ id: 'S.3' })],
      }),
    )
    const { analyseSpec, weaknesses } = useSpecBattleCard(spec)
    analyseSpec()
    expect(weaknesses.value.length).toBeGreaterThanOrEqual(1)
    expect(weaknesses.value.length).toBeLessThanOrEqual(3)
  })

  it('"Balanced spec" strength fires when F., V., and S. entries are all present', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { analyseSpec, strengths } = useSpecBattleCard(spec)
    analyseSpec()
    const hasBalanced = strengths.value.some(s => s.includes('Balanced spec'))
    expect(hasBalanced).toBe(true)
  })

  it('"No Solution entries" weakness fires when S. count is 0', () => {
    const spec = ref<SpecBlock | null>(makeSpec({ solutions: [] }))
    const { analyseSpec, weaknesses } = useSpecBattleCard(spec)
    analyseSpec()
    const hasNoSolution = weaknesses.value.some(w => w.includes('No Solution entries'))
    expect(hasNoSolution).toBe(true)
  })

  it('copyBattleCard output contains "## Battle Card"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { analyseSpec, copyBattleCard } = useSpecBattleCard(spec)
    analyseSpec()
    await copyBattleCard()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('## Battle Card'))
  })

  it('copyBattleCard output includes "Strengths" and "Weaknesses" sections', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { analyseSpec, copyBattleCard } = useSpecBattleCard(spec)
    analyseSpec()
    await copyBattleCard()
    const text: string = writeText.mock.calls[0][0]
    expect(text).toContain('Strengths')
    expect(text).toContain('Weaknesses')
  })
})
