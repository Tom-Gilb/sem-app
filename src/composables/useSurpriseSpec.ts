// UNIT_TYPE=Composable
// Feature #37 — "Surprise Me" Random Spec
// Composable wrapper around the curated seed list in src/data/surpriseSeeds.ts.
// Re-exports SURPRISE_SEEDS for backwards-compat, and adds a getRandomSeed() helper
// that avoids returning the same seed twice in a row.

export type { SurpriseSeed } from '../data/surpriseSeeds'
export { SURPRISE_SEEDS } from '../data/surpriseSeeds'

import { SURPRISE_SEEDS } from '../data/surpriseSeeds'
import type { SurpriseSeed } from '../data/surpriseSeeds'

export function useSurpriseSpec() {
  /**
   * Returns a random seed, optionally excluding one index to avoid immediate repeats.
   */
  function getRandomSeed(excludeIndex?: number): { seed: SurpriseSeed; index: number } {
    const candidates = SURPRISE_SEEDS
      .map((seed, i) => ({ seed, i }))
      .filter(({ i }) => i !== excludeIndex)

    const picked = candidates[Math.floor(Math.random() * candidates.length)]
    return { seed: picked.seed, index: picked.i }
  }

  return { getRandomSeed, seeds: SURPRISE_SEEDS }
}
