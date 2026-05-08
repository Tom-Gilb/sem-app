// UNIT_TYPE=Hook
// useExpectedValue — EV Mode calculator for the IET (Feature #98)
// Spec: S.Evo98.ExpectedValueCalculator
// Computes probability-weighted impact scores across all Evo step candidates.

import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { ImpactMatrix } from '../types/impact'

/**
 * Composable that manages the EV Mode toggle and probability-weighted impact scores.
 *
 * @param vEntryIds - Reactive list of V. entry IDs from the spec
 * @param impactMatrix - Reactive V×S impact matrix [vEntryId][stepId] = impact score 0–100
 *
 * @returns {{
 *   evModeOpen: Ref<boolean>,
 *   probabilities: Ref<Record<string, number>>,
 *   expectedValues: ComputedRef<Record<string, number>>,
 *   aggregateEV: ComputedRef<number>,
 *   topVEntry: ComputedRef<string | null>,
 *   setProbability: (vEntryId: string, value: number) => void
 * }}
 *
 * Preconditions: vEntryIds should be unique IDs; impactMatrix cells are 0–100.
 * Defaults: probability initialises to 70 for each V. entry.
 */
export function useExpectedValue(
  vEntryIds: Ref<string[]>,
  impactMatrix: Ref<ImpactMatrix>,
) {
  /** Whether EV Mode panel is open */
  const evModeOpen = ref(false)

  /** Probability (0–100) keyed by vEntryId — default 70 */
  const probabilities = ref<Record<string, number>>({})

  // Initialise new IDs to 70 whenever the list changes
  watch(
    vEntryIds,
    (ids) => {
      ids.forEach((id) => {
        if (!(id in probabilities.value)) {
          probabilities.value[id] = 70
        }
      })
    },
    { immediate: true },
  )

  /**
   * Sets the probability for a V. entry, clamping to 0–100.
   *
   * @param vEntryId - The V. entry whose probability to update
   * @param value - New probability (0–100)
   */
  function setProbability(vEntryId: string, value: number): void {
    probabilities.value[vEntryId] = Math.min(100, Math.max(0, value))
  }

  /**
   * expectedValues: for each V. entry, sum of (impactScore × probability/100) across all Evo steps.
   * Uses the full set of step columns present in the matrix row.
   */
  const expectedValues = computed<Record<string, number>>(() => {
    const result: Record<string, number> = {}
    for (const vId of vEntryIds.value) {
      const prob = (probabilities.value[vId] ?? 70) / 100
      const stepScores = impactMatrix.value[vId] ?? {}
      result[vId] = Object.values(stepScores).reduce((sum, s) => sum + s * prob, 0)
    }
    return result
  })

  /** aggregateEV: total EV summed across all V. entries */
  const aggregateEV = computed<number>(() =>
    Object.values(expectedValues.value).reduce((a, b) => a + b, 0),
  )

  /**
   * topVEntry: the V. entry ID with the highest EV.
   * Returns null when vEntryIds is empty.
   */
  const topVEntry = computed<string | null>(() => {
    const entries = Object.entries(expectedValues.value)
    if (entries.length === 0) return null
    return entries.reduce<[string, number]>(
      (best, [id, ev]) => (ev > best[1] ? [id, ev] : best),
      ['', -Infinity],
    )[0]
  })

  return {
    evModeOpen,
    probabilities,
    expectedValues,
    aggregateEV,
    topVEntry,
    setProbability,
  }
}
