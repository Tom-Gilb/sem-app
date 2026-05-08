// UNIT_TYPE=Test
// Feature #100 — useMarketSize composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMarketSize } from '../useMarketSize'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.BuildSystem',
    type: 'Function',
    level: 'Product',
    description: 'The engineering system builds and deploys software.',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.BuildSpeed',
    type: 'Value',
    level: 'Product',
    description: 'Measures build speed for engineering pipeline.',
    scale: 'seconds per build',
    meter: 'CI timer',
    status: 'Status [now] 120',
    tolerable: 'Tolerable [2026] 90',
    goal: 'Goal [2026] 60',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.BuildCache',
    type: 'Solution',
    level: 'Product',
    description: 'A build cache reduces compilation time.',
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

describe('useMarketSize', () => {
  it('initial: marketOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { marketOpen } = useMarketSize(spec)
    expect(marketOpen.value).toBe(false)
  })

  it('initial: estimate is null', () => {
    const spec = ref<SpecBlock | null>(null)
    const { estimate } = useMarketSize(spec)
    expect(estimate.value).toBeNull()
  })

  it('estimateMarket with valid spec populates estimate', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { estimateMarket, estimate } = useMarketSize(spec)
    estimateMarket()
    expect(estimate.value).not.toBeNull()
  })

  it('estimate.tam > estimate.sam > estimate.som', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { estimateMarket, estimate } = useMarketSize(spec)
    estimateMarket()
    expect(estimate.value!.tam).toBeGreaterThan(estimate.value!.sam)
    expect(estimate.value!.sam).toBeGreaterThan(estimate.value!.som)
  })

  it('domain "engineering" uses engineering multiplier (tam = 5000 base)', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        functions: [makeF({ description: 'build deploy architecture software pipeline' })],
        values: [makeV()],
        solutions: [makeS()],
      }),
    )
    const { estimateMarket, estimate } = useMarketSize(spec)
    estimateMarket()
    // With 3 total blocks, scale = 1 + 3/20 = 1.15, TAM = round(5000 * 1.15) = 5750
    // Must be in the engineering range (>= 5000 * 1 and <= 5000 * 2)
    expect(estimate.value!.tam).toBeGreaterThanOrEqual(5000)
    expect(estimate.value!.tam).toBeLessThanOrEqual(10000)
  })

  it('entry count scaling: spec with 20+ blocks has higher TAM than empty spec', () => {
    const bigSpec = ref<SpecBlock | null>(
      makeSpec({
        functions: Array.from({ length: 10 }, (_, i) => makeF({ id: `F.${i}`, description: 'build deploy architecture software system' })),
        values: Array.from({ length: 10 }, (_, i) => makeV({ id: `V.${i}` })),
        solutions: Array.from({ length: 5 }, (_, i) => makeS({ id: `S.${i}` })),
      }),
    )
    const smallSpec = ref<SpecBlock | null>(
      makeSpec({
        functions: [makeF({ description: 'build deploy architecture software system' })],
        values: [],
        solutions: [],
      }),
    )
    const big = useMarketSize(bigSpec)
    const small = useMarketSize(smallSpec)
    big.estimateMarket()
    small.estimateMarket()
    expect(big.estimate.value!.tam).toBeGreaterThan(small.estimate.value!.tam)
  })

  it('copyMarketSummary markdown contains "## Market Size"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { estimateMarket, copyMarketSummary } = useMarketSize(spec)
    estimateMarket()
    await copyMarketSummary()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('## Market Size'))
  })

  it('copyMarketSummary includes "TAM" and "SAM"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { estimateMarket, copyMarketSummary } = useMarketSize(spec)
    estimateMarket()
    await copyMarketSummary()
    const text: string = writeText.mock.calls[0][0]
    expect(text).toContain('TAM')
    expect(text).toContain('SAM')
  })

  it('rationale is a non-empty string', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { estimateMarket, estimate } = useMarketSize(spec)
    estimateMarket()
    expect(typeof estimate.value!.rationale).toBe('string')
    expect(estimate.value!.rationale.length).toBeGreaterThan(0)
  })
})
