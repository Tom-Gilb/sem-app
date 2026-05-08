// UNIT_TYPE=Composable
// Feature #42 — Goal Sensitivity Slider
// Applies a numeric multiplier to V. entry Goal and Tolerable fields.

import { ref } from 'vue'
import type { SpecBlock, VEntry } from '../types/spec'

export function useGoalSensitivity() {
  const multiplier = ref(1.0)   // 0.5 = half Goal, 1.0 = original, 1.5 = 150%

  /**
   * Scales the first number found in a field string by m.
   * Rounds to 1 decimal place if the result is fractional.
   * Preserves units and surrounding text.
   * If no number is found, returns the string unchanged.
   */
  function scaleFieldValue(value: string, m: number): string {
    const match = value.match(/\d+\.?\d*/)
    if (!match) return value

    const original = parseFloat(match[0])
    const scaled = original * m
    // Use integer if it rounds cleanly, otherwise 1 decimal place
    const formatted = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1)

    return value.replace(match[0], formatted)
  }

  /**
   * Returns a new SpecBlock where every V. entry's Goal and Tolerable fields
   * have their numeric portions scaled by m. All other fields are unchanged.
   */
  function applyMultiplier(spec: SpecBlock, m: number): SpecBlock {
    return {
      functions: spec.functions,
      solutions: spec.solutions,
      values: spec.values.map((v): VEntry => ({
        ...v,
        goal: scaleFieldValue(v.goal, m),
        tolerable: scaleFieldValue(v.tolerable, m),
      })),
    }
  }

  return { multiplier, applyMultiplier }
}
