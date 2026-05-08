// UNIT_TYPE=Types
// ImpactMatrix and VCRatio type definitions — Evo Step 9 (S.Evo9.AIImpactSuggestionHandler)
// Spec: S.Evo9.ImpactEstimationVDTUI

/**
 * A 2D matrix of impact percentages keyed by valueId then solutionId.
 * Each cell is an integer 0–100 representing how much the solution
 * impacts the value.
 *
 * impactMatrix[valueId][solutionId] = impactPercent (0–100)
 */
export type ImpactMatrix = Record<string, Record<string, number>>

/**
 * V/C ratio for a single solution.
 *
 * - valueImpactSum: sum of all impact% cells across all values for this solution
 * - resourceClaim: the resource claim percentage for this solution (default 20)
 * - ratio: valueImpactSum / resourceClaim; Infinity when resourceClaim === 0
 */
export interface VCRatio {
  solutionId: string
  valueImpactSum: number
  resourceClaim: number
  ratio: number
}
