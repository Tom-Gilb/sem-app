// UNIT_TYPE=Utility
// Pure colour-coding functions for the Impact Estimation VDT.
//
// Spec: S.ImpactEstimationUI — visual bar charts and traffic-light colour coding.
// These are pure functions with no Vue dependencies so they are independently
// testable and can be imported anywhere in the app.

/**
 * Returns a hex colour string for an impact percentage cell using a traffic-light
 * scheme.
 *
 * Colour spec (task, 2026-05-02):
 *   ≥ 60   → green  #22c55e — strong positive impact
 *   30–59  → amber  #f59e0b — moderate positive impact
 *   1–29   → red    #ef4444 — weak positive impact
 *   0      → gray   #d1d5db — no estimate
 *  < 0     → red    #ef4444 — negative side effect (treated same as weak)
 *
 * @param pct - Impact percentage, typically -100 to 100.
 * @returns Hex colour string for the bar fill and accent.
 */
export function getImpactColour(pct: number): string {
  if (pct >= 60) return '#22c55e'   // green-500
  if (pct >= 30) return '#f59e0b'   // amber-400
  if (pct > 0)   return '#ef4444'   // red-500 (weak positive)
  if (pct === 0) return '#d1d5db'   // gray-300 (no estimate)
  return '#ef4444'                  // red-500 (negative side effect)
}

/**
 * Returns a hex colour string for a V/C (value-to-cost) ratio cell using a
 * traffic-light scheme.
 *
 * Colour spec (task, 2026-05-02):
 *   ≥ 1.5          → green  #22c55e — high efficiency
 *   0.8 to < 1.5   → amber  #f59e0b — moderate efficiency
 *   < 0.8          → red    #ef4444 — low efficiency
 *
 * @param vc - V/C ratio value (value impact sum ÷ resource claim).
 * @returns Hex colour string.
 */
export function getVCColour(vc: number): string {
  if (vc >= 1.5) return '#22c55e'   // green-500
  if (vc >= 0.8) return '#f59e0b'   // amber-400
  return '#ef4444'                  // red-500
}

/**
 * Returns a human-readable interpretation label for an impact percentage.
 *
 * @param pct - Impact percentage.
 * @returns 'strong impact' | 'moderate impact' | 'weak impact' | 'no estimate' | 'negative side effect'
 */
export function interpretImpact(pct: number): string {
  if (pct >= 60) return 'strong impact'
  if (pct >= 30) return 'moderate impact'
  if (pct > 0)   return 'weak impact'
  if (pct === 0) return 'no estimate'
  return 'negative side effect'
}
