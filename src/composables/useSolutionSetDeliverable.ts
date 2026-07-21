// UNIT_TYPE=Composable
// useSolutionSetDeliverable.ts — Stage 5 sub-step 5.5.1 (audit-backlog #4).
//
// v478 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #4 Stage 5
// Refine Phase 2).  Tom's verbatim design at memory/rule_stage_5_refine_
// design.md sub-step 5.5.1:
//   "Produce a set of solutions with their sources, and their estimated
//    impacts."
//
// Builds the exportable Solution Set from the currentSpec's approved
// solutions.  Each entry carries the Tier-1 canonical Solution parameters
// banked v236: Tag / Type / Status / Description / Derived From / Function
// / Main Impacts — the seven ship-blocker parameters.
//
// Composes with:
//   - rule_stage_5_refine_design.md SUPREME (this composable IS the code
//     enforcement of sub-step 5.5.1)
//   - Solution Parameters SUPREME (Tier-1 REQUIRED inventory: Tag / Type /
//     Status / Description / Derived From / Function / Main Impacts)
//   - r93jjj Qualifiers SUPREME (Qualifiers carried when present per
//     Solution)
//   - Stages-are-Cyclic SUPREME (this is a SNAPSHOT deliverable; Solution
//     Set Version approved via Stage 5.5 sub-step; returning to Stage 5
//     produces a new deliverable at next approval)
//   - Universal Undo SUPREME (deliverable is derived from currentSpec —
//     no direct mutation; Undo of currentSpec mutations reflects here)
//   - Conjunction-of-Technologies SUPREME (Phase 2b: AI enrichment)
//   - Twin portability — pure TS composable; ports verbatim

import { computed, type Ref } from 'vue'
import type { SpecBlock, SEntry } from '../types/spec'

/**
 * One row of the Solution Set deliverable.  Canonical Tier-1 shape.
 */
export interface SolutionSetRow {
  /** Tag (mnemonic id) — required. */
  tag:              string
  /** Type — always 'Solution' at this deliverable level. */
  type:             'Solution'
  /** Status — Draft / Ratified / Rejected / Superseded / Cancelled per canonical Planguage. */
  status:           string
  /** Short one-line description — required. */
  description:      string
  /** Derived-From — the Value entry ids this solution ships to deliver. */
  derivedFrom:      string[]
  /** Function tag/id if the solution IS-A function realisation, else empty. */
  function:         string
  /** Main Impacts — pipe-separated string of "V.Id → <impact>" pairs from Solution.impact. */
  mainImpacts:      string
  /** Optional canonical Source (Reachable-Now URL / book+page / in-app-derived). */
  source?:          string
  /** Optional cost/effort estimate if the Solution declared one. */
  costEstimate?:    string
}

/**
 * The full deliverable — Solution rows + snapshot metadata.
 */
export interface SolutionSetDeliverable {
  /** ISO timestamp when the deliverable was computed. */
  generatedAtIso:   string
  /** Plan / spec name for context. */
  planName:         string
  /** Version string from the SpecModel at snapshot time. */
  planVersion:      string
  /** Total count of solutions in the deliverable. */
  totalCount:       number
  /** Rows in canonical order (matches SpecBlock.solutions ordering). */
  rows:             SolutionSetRow[]
}

/** Turn one SEntry into a Tier-1 deliverable row. */
function _rowFromSEntry(s: SEntry): SolutionSetRow {
  // Derived-From — read from the canonical solution.impact string (SEM stores
  // impact as free-form multi-line "V.Id: <text>" pairs; extract V.Ids).
  const impactStr = (s.impact ?? '').toString()
  const derivedFromIds = Array.from(
    new Set(
      impactStr.match(/V\.[A-Za-z0-9._-]+/g) ?? [],
    ),
  )
  return {
    tag:            (s.id ?? '').toString(),
    type:           'Solution',
    status:         (s.status ?? 'Draft').toString(),
    description:    (s.description ?? '').toString(),
    derivedFrom:    derivedFromIds,
    function:       ((s as unknown as { function?: string }).function ?? '').toString(),
    mainImpacts:    impactStr.trim() || '(no Main Impacts declared)',
    source:         (s.source ?? undefined),
    costEstimate:   ((s as unknown as { cost?: string }).cost ?? undefined),
  }
}

/**
 * Compose the deliverable from a live SpecBlock ref + planName / planVersion.
 * Returns a reactive computed that recomputes whenever the underlying spec
 * changes — a Solution Set Version snapshot at approval time can be produced
 * by cloning `.value` at that moment.
 */
export function useSolutionSetDeliverable(
  spec:        Ref<SpecBlock | null>,
  planName:    Ref<string>,
  planVersion: Ref<string>,
) {
  const deliverable = computed<SolutionSetDeliverable | null>(() => {
    const s = spec.value
    if (!s) return null
    const rows = (s.solutions ?? []).map(_rowFromSEntry)
    return {
      generatedAtIso: new Date().toISOString(),
      planName:       planName.value ?? '',
      planVersion:    planVersion.value ?? '',
      totalCount:     rows.length,
      rows,
    }
  })

  /**
   * Plain-text serialisation for copy-to-clipboard fallback + email plain body.
   * Follows Planguage book layout (Tag uppermost with colon + parameter cascade
   * below) per r93fff Spec-Tag-Uppermost-with-Colon SUPREME.
   */
  const asPlainText = computed<string>(() => {
    const d = deliverable.value
    if (!d) return ''
    const lines: string[] = []
    lines.push(`Solution Set — ${d.planName || '(no plan name)'}`)
    lines.push(`Plan version: ${d.planVersion || '(no version)'}`)
    lines.push(`Generated: ${d.generatedAtIso}`)
    lines.push(`Total solutions: ${d.totalCount}`)
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('')
    for (const r of d.rows) {
      lines.push(`${r.tag}:`)
      lines.push(`  Type:         ${r.type}`)
      lines.push(`  Status:       ${r.status}`)
      lines.push(`  Description:  ${r.description || '(no description)'}`)
      if (r.derivedFrom.length > 0) lines.push(`  Derived From: ${r.derivedFrom.join(', ')}`)
      if (r.function)               lines.push(`  Function:     ${r.function}`)
      lines.push(`  Main Impacts: ${r.mainImpacts}`)
      if (r.source)                 lines.push(`  Source:       ${r.source}`)
      if (r.costEstimate)           lines.push(`  Cost:         ${r.costEstimate}`)
      lines.push('')
    }
    return lines.join('\n')
  })

  return {
    deliverable,
    asPlainText,
  }
}
