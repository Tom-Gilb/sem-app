// UNIT_TYPE=Hook
//
// useStrategyMode.ts — Strategy Mode terminology overrides for all SEM App surfaces.
//
// Tom Gilb 2026-06-09 verbatim:
//   "Purpose: to tune SEM to the needs and culture of organizational strategic
//    planning... There will be a 'Strategy Management' option in SEM settings.
//    Terminology: Values = Strategic Objectives, Solutions = Strategies,
//    Evo Steps = Strategic Value Delivery Increments,
//    Evo Feedback Measures = Strategic Results.
//    Owner = Strategy Responsible, Planner = Strategy Planner,
//    Scribe = Results Responsible."
//
// Architecture:
//   - Pure composable — no side effects, no Vue coupling beyond computed()
//   - Twin-portable: display labels change, underlying Planguage data model NEVER changes
//   - ALL surfaces call termFor(standardTerm) — single source of truth for overrides
//   - Primary Gilb texts: Strategy-Ring, Value Improvement
//
// Usage:
//   import { useStrategyMode } from '../composables/useStrategyMode'
//   const { isStrategyMode, termFor } = useStrategyMode()
//
//   // In template:
//   {{ termFor('Values') }}  →  "Strategic Objectives" (strategy mode ON)
//   {{ termFor('Values') }}  →  "Values"               (strategy mode OFF)

import { computed } from 'vue'
import { useSettings } from './useSettings'

export function useStrategyMode() {
  const { settings, setOne } = useSettings()

  /** True when Strategy Management mode is enabled in Settings. */
  const isStrategyMode = computed<boolean>(() => settings.value.strategyMode)

  const terminology = computed(() => settings.value.strategyTerminology)

  /**
   * Maps a standard Planguage display term to its Strategy-Mode equivalent.
   *
   * When strategy mode is OFF: returns `standard` unchanged (pass-through).
   * When strategy mode is ON: returns the configured terminology override.
   *
   * Matching uses EXACT string matching (case-sensitive) on the canonical
   * Planguage term as it appears in display contexts.  Callers must pass
   * the exact canonical form (e.g. 'Values' not 'values').
   *
   * Standard terms mapped and their defaults when strategy mode is ON:
   *
   *   Planguage term   →   Strategy term (default)
   *   ──────────────────────────────────────────────────────────────────
   *   'Value'          →   'Strategic Objective'
   *   'Values'         →   'Strategic Objectives'
   *   'Design'         →   'Strategies'   ← the Design sector = Solutions in the pinwheel
   *   'Solution'       →   'Strategy'
   *   'Solutions'      →   'Strategies'
   *   'Evo Step'       →   'Strategic Value Delivery Increment'
   *   'Evo Steps'      →   'Strategic Value Delivery Increments'
   *   'Evo Feedback Measure'  →  'Strategic Results'
   *   'Evo Feedback Measures' →  'Strategic Results'
   *   'Owner'          →   'Strategy Responsible'
   *   'Planner'        →   'Strategy Planner'
   *   'Scribe'         →   'Results Responsible'
   *
   * All other terms pass through unchanged — the function is safe to call on
   * any string (returns it untouched when no mapping exists).
   */
  function termFor(standard: string): string {
    if (!isStrategyMode.value) return standard
    const t = terminology.value
    switch (standard) {
      case 'Value':                  return t.valueTerm
      case 'Values':                 return t.valuesTermPlural
      case 'Design':                 return t.solutionsTermPlural   // Design sector = Solutions
      case 'Solution':               return t.solutionTerm
      case 'Solutions':              return t.solutionsTermPlural
      case 'Evo Step':               return t.evoStepTerm
      case 'Evo Steps':              return t.evoStepsTermPlural
      case 'Evo Feedback Measure':   return t.evoFeedbackTerm
      case 'Evo Feedback Measures':  return t.evoFeedbackTerm
      case 'Owner':                  return t.ownerRoleTerm
      case 'Planner':                return t.plannerRoleTerm
      case 'Scribe':                 return t.scribeRoleTerm
      default:                       return standard
    }
  }

  /**
   * Turn Strategy Mode on or off.
   * Exposed so any surface can provide an inline "Turn off" button without
   * forcing the user back to Settings.
   * Tom Gilb 2026-06-09: "a close button next to it to turn it off there!"
   */
  function setStrategyMode(on: boolean): void {
    setOne('strategyMode', on)
  }

  return {
    isStrategyMode,
    termFor,
    setStrategyMode,
  }
}
