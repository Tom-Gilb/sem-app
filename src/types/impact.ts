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

// ─── v477 (Tom Gilb 2026-06-21 Stage 4 Impacts Phase 2 — audit-backlog #3) ─────
// r41 v477 (Tom Gilb 2026-07-04 "continue backlog") — Phase 2 data-shape for
// Stage 4 Impacts.  Tom's verbatim design (memory/rule_stage_4_impacts_design.md):
//   "We need to produce the justification for the estimates. That means
//    Evidence (facts that justify the estimate), Source (URL, or searchable
//    source), and a generated Credibility (0.0 to 1.0) rating (see CE book for
//    meaning of this scale). … Where there is no evidence and or no estimate,
//    we need to auto create a conservative assumption (a low impact value or
//    high impact resource) with large ± uncertainty (with documentation for
//    source of estimate even if not evidence)."

/**
 * Per-cell justification for one impact estimate (one solution × one value cell).
 *
 * The ImpactMatrix stays a plain `Record<string, Record<string, number>>` of
 * impact percentages (no schema break); this parallel structure carries the
 * Evidence + Source + Credibility metadata per cell.  Keyed by the same
 * (valueId, solutionId) pair so lookups compose 1-to-1 with the impact matrix.
 *
 * Credibility scale (CE book — Competitive Engineering, Gilb 2005):
 *   0.0 = pure guess / no evidence at all
 *   0.2 = single anecdote or unattributed opinion
 *   0.4 = one weak source (blog post, forum comment)
 *   0.5 = single strong source or a couple of weak sources
 *   0.6 = two or more strong sources, independent
 *   0.8 = published study or vendor benchmark, verifiable
 *   1.0 = direct measurement from THIS system's own operational data
 */
export interface ImpactJustification {
  /** Facts that justify the estimate.  Plain-language, short — the "why".  */
  evidence?: string
  /** URL, book+chapter, or searchable-source citation.  Reachable-Now per SUPREME. */
  source?: string
  /** 0.0-1.0 CE-scale credibility. */
  credibility?: number
  /** ± uncertainty on the estimate itself (percentage-points, e.g. 15 = "±15%"). */
  uncertaintyPercent?: number
  /**
   * True when this cell was auto-populated as a conservative assumption
   * (no evidence + no prior estimate).  Distinguishes real estimates from
   * placeholders so the IET can visually highlight cells that need attention.
   */
  conservativeAssumption?: boolean
  /** Who / what authored this justification. */
  authoredBy?: string
  /** ISO-8601 timestamp. */
  authoredAt?: string
}

/**
 * Parallel matrix — same key shape as ImpactMatrix, but values are
 * ImpactJustification objects instead of raw percentages.
 *
 * impactJustifications[valueId][solutionId] = ImpactJustification
 */
export type ImpactJustificationMatrix =
  Record<string, Record<string, ImpactJustification>>

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
