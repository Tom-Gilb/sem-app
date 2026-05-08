// UNIT_TYPE=Test
// Feature #37 — Tests for useSurpriseSpec composable

import { describe, it, expect } from 'vitest'
import { useSurpriseSpec, SURPRISE_SEEDS } from '../useSurpriseSpec'
// Note: useSurpriseSpec re-exports SURPRISE_SEEDS from src/data/surpriseSeeds.ts

describe('SURPRISE_SEEDS', () => {
  it('has at least 10 seeds', () => {
    expect(SURPRISE_SEEDS.length).toBeGreaterThanOrEqual(10)
  })

  it('every seed has non-empty stakes, ends, means', () => {
    for (const seed of SURPRISE_SEEDS) {
      expect(seed.stakes.trim()).toBeTruthy()
      expect(seed.ends.trim()).toBeTruthy()
      expect(seed.means.trim()).toBeTruthy()
    }
  })

  it('every seed ends field contains a quantified target (has a number)', () => {
    for (const seed of SURPRISE_SEEDS) {
      // Each "ends" should contain at least one number or percentage
      expect(seed.ends).toMatch(/\d/)
    }
  })
})

describe('useSurpriseSpec — getRandomSeed()', () => {
  const { getRandomSeed } = useSurpriseSpec()

  it('returns a seed and an index', () => {
    const { seed, index } = getRandomSeed()
    expect(seed).toBeDefined()
    expect(typeof index).toBe('number')
  })

  it('returned seed has non-empty stakes/ends/means', () => {
    const { seed } = getRandomSeed()
    expect(seed.stakes.trim()).toBeTruthy()
    expect(seed.ends.trim()).toBeTruthy()
    expect(seed.means.trim()).toBeTruthy()
  })

  it('when excludeIndex is provided, that seed is never returned', () => {
    // Run 50 times to be probabilistically confident
    for (let i = 0; i < 50; i++) {
      const { index } = getRandomSeed(0)
      expect(index).not.toBe(0)
    }
  })

  it('returns a seed from the seeds list', () => {
    const { seed } = getRandomSeed()
    expect(SURPRISE_SEEDS).toContainEqual(seed)
  })

  it('index is within bounds [0, seeds.length)', () => {
    const { index } = getRandomSeed()
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(SURPRISE_SEEDS.length)
  })

  it('does not always return the same seed (randomness check over 20 calls)', () => {
    const indices = new Set<number>()
    for (let i = 0; i < 20; i++) {
      indices.add(getRandomSeed().index)
    }
    // With 12 seeds and 20 calls, we expect at least 3 distinct indices
    expect(indices.size).toBeGreaterThan(2)
  })
})
