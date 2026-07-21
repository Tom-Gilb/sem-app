// UNIT_TYPE=Composable
// useChangesList.ts — Stage 5 sub-step 5.5.2 (audit-backlog #4).
//
// v478 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #4 Stage 5
// Refine Phase 2).  Tom's verbatim design at memory/rule_stage_5_refine_
// design.md sub-step 5.5.2:
//   "Produce a List of Changes to any other specs consistent with this set
//    of solutions. This includes, sharpening and addition of any Stakeholder
//    specs, Value Spec, Constraints, Resources."
//
// Computes the implied changes to non-Solution specs from the approved
// Solution Set: which Stakeholders / Values / Constraints / Resources need
// ADD / SHARPEN / MODIFY per canonical Planguage discipline.
//
// The change detection is deterministic — walks each approved Solution's
// impact / relatedTo / prerequisites / assumptions and correlates against
// what already exists in the SpecBlock.
//
// Composes with:
//   - rule_stage_5_refine_design.md SUPREME (this composable IS the code
//     enforcement of sub-step 5.5.2)
//   - Solution Parameters SUPREME (Tier-2 Related-To + Tier-3 Prerequisites /
//     Assumptions / Constraints as change-detection inputs)
//   - r93jjj Qualifiers SUPREME (a Constraint that lacks Qualifiers when
//     the Solution needs them → SHARPEN change)
//   - r93mmm Infinity Trap SUPREME (adding a Value without Qualifiers = new
//     Infinity Trap entry; the Changes-List surfaces this)
//   - Universal Undo SUPREME (Changes-List is derived; no direct mutation)
//   - AI-Max SUPREME (Phase 2b: AI-driven change proposal enrichment)
//   - Conjunction-of-Technologies SUPREME (Phase 2b: cite Gilb corpus per
//     change)
//   - Twin portability — pure TS composable; ports verbatim

import { computed, type Ref } from 'vue'
import type { SpecBlock, SEntry } from '../types/spec'

/** Which category of other-spec each change targets. */
export type ChangeSpecCategory = 'Stakeholder' | 'Value' | 'Constraint' | 'Resource' | 'Function'

/** The three change kinds Tom names verbatim in the Stage 5 rule. */
export type ChangeKind = 'add' | 'sharpen' | 'modify'

/** One row of the Changes-List. */
export interface ChangesListRow {
  /** Which non-Solution spec category this change targets. */
  category:  ChangeSpecCategory
  /** ADD (spec doesn't exist yet) · SHARPEN (spec exists but underspecified) · MODIFY (existing spec needs adjustment). */
  kind:      ChangeKind
  /** Existing entry id when SHARPEN / MODIFY; proposed id when ADD. */
  entryId:   string
  /** Plain-English one-line detail (≤ 25 words per Solution Parameter Discipline). */
  detail:    string
  /** The Solution id that triggered this change proposal. */
  triggeredBy: string
}

/** The full Changes-List deliverable — rows + snapshot metadata. */
export interface ChangesListDeliverable {
  generatedAtIso:   string
  planName:         string
  planVersion:      string
  totalChanges:     number
  /** Count by category — used by the deliverable panel for at-a-glance summary. */
  countsByCategory: Record<ChangeSpecCategory, number>
  rows:             ChangesListRow[]
}

/** Build a stable id for a change so v-for :key can dedupe. */
function _changeRowKey(r: ChangesListRow): string {
  return `${r.category}:${r.entryId}:${r.kind}:${r.triggeredBy}`
}

/**
 * The deterministic detector — walks the Solution Set + currentSpec and
 * emits ChangesListRow[] for every implied change.
 */
function _detectChanges(spec: SpecBlock): ChangesListRow[] {
  const rows: ChangesListRow[] = []
  const seen = new Set<string>()

  const existingValueIds        = new Set((spec.values ?? []).map(v => (v.id ?? '').toString()))
  const existingConstraintIds   = new Set((spec.constraints ?? []).map(c => (c.id ?? '').toString()))
  const existingResourceIds     = new Set((spec.resources ?? []).map(r => (r.id ?? '').toString()))
  const existingFunctionIds     = new Set((spec.functions ?? []).map(f => (f.id ?? '').toString()))
  const existingStakeholderNames = new Set(
    (spec.stakeholderEntries ?? []).map(s => (s.name ?? s.id ?? '').toString().toLowerCase()),
  )

  function push(row: ChangesListRow): void {
    const k = _changeRowKey(row)
    if (seen.has(k)) return
    seen.add(k)
    rows.push(row)
  }

  for (const s of spec.solutions ?? []) {
    const sEntry = s as SEntry & Record<string, unknown>
    const solutionId = (sEntry.id ?? '').toString()
    const impactStr = (sEntry.impact ?? '').toString()

    // ─── Values: each V.Id referenced in impact must exist (or ADD it) ─────
    const impactedValueIds = Array.from(new Set(impactStr.match(/V\.[A-Za-z0-9._-]+/g) ?? []))
    for (const vid of impactedValueIds) {
      if (!existingValueIds.has(vid)) {
        push({
          category: 'Value',
          kind:     'add',
          entryId:  vid,
          detail:   `Solution ${solutionId} impacts ${vid} but no Value entry exists — add one with Scale + Meter + Tolerable + Goal + Qualifiers.`,
          triggeredBy: solutionId,
        })
      } else {
        // Existing Value — check if impact quantifies the delivery.  If Solution
        // impact text is < 15 chars it likely lacks quantification → SHARPEN.
        const impactLine = impactStr.split('\n').find(l => l.includes(vid)) ?? ''
        if (impactLine.trim().length < 20) {
          push({
            category: 'Value',
            kind:     'sharpen',
            entryId:  vid,
            detail:   `Solution ${solutionId} → ${vid} impact is unquantified — sharpen to name a % of Goal or ±uncertainty.`,
            triggeredBy: solutionId,
          })
        }
      }
    }

    // ─── Related-To (Tier-2) — Stakeholders / Functions the solution touches ─
    const relatedTo = (sEntry.relatedTo as string[] | string | undefined)
    const relatedList = Array.isArray(relatedTo) ? relatedTo : (typeof relatedTo === 'string' ? relatedTo.split(/[,;]/) : [])
    for (const rawItem of relatedList) {
      const item = rawItem.trim()
      if (!item) continue
      // Function reference?
      if (/^F\./.test(item)) {
        if (!existingFunctionIds.has(item)) {
          push({
            category: 'Function',
            kind:     'add',
            entryId:  item,
            detail:   `Solution ${solutionId} relates to Function ${item} but no Function entry exists — add one.`,
            triggeredBy: solutionId,
          })
        }
        continue
      }
      // Stakeholder reference — heuristic: capitalised noun that isn't a Planguage prefix.
      const lc = item.toLowerCase()
      if (!existingStakeholderNames.has(lc) && /^[A-Z]/.test(item) && item.length > 2 && !/^[FVSCR]\./.test(item)) {
        push({
          category: 'Stakeholder',
          kind:     'add',
          entryId:  item,
          detail:   `Solution ${solutionId} relates to "${item}" but no matching Stakeholder entry — add or sharpen an existing Stakeholder.`,
          triggeredBy: solutionId,
        })
      }
    }

    // ─── Constraints (Tier-3 optional constraints field on the Solution) ────
    const constraintsField = (sEntry.constraints as string | undefined) ?? ''
    const constraintRefs = Array.from(new Set(constraintsField.match(/C\.[A-Za-z0-9._-]+/g) ?? []))
    for (const cid of constraintRefs) {
      if (!existingConstraintIds.has(cid)) {
        push({
          category: 'Constraint',
          kind:     'add',
          entryId:  cid,
          detail:   `Solution ${solutionId} cites Constraint ${cid} but no matching Constraint entry — add one (with Qualifiers per r93jjj).`,
          triggeredBy: solutionId,
        })
      }
    }

    // ─── Resources — costAspects or costEstimate implies a Resource claim ───
    const costField = ((sEntry.cost as string | undefined)
      ?? (sEntry.costAspects as string | undefined)
      ?? '').toString()
    const resourceRefs = Array.from(new Set(costField.match(/R\.[A-Za-z0-9._-]+/g) ?? []))
    for (const rid of resourceRefs) {
      if (!existingResourceIds.has(rid)) {
        push({
          category: 'Resource',
          kind:     'add',
          entryId:  rid,
          detail:   `Solution ${solutionId} claims Resource ${rid} but no matching Resource entry — add one (with Scale + Budget + Qualifiers per r93jjj/r93mmm).`,
          triggeredBy: solutionId,
        })
      }
    }

    // ─── Prerequisites — treat as MODIFY on the referenced entries ──────────
    const prereqs = ((sEntry.prerequisites as string | undefined) ?? '').toString()
    const prereqRefs = Array.from(new Set(prereqs.match(/[FVSCR]\.[A-Za-z0-9._-]+/g) ?? []))
    for (const pref of prereqRefs) {
      const cat: ChangeSpecCategory =
        pref.startsWith('V.') ? 'Value' :
        pref.startsWith('F.') ? 'Function' :
        pref.startsWith('C.') ? 'Constraint' :
        pref.startsWith('R.') ? 'Resource' : 'Function'
      push({
        category: cat,
        kind:     'modify',
        entryId:  pref,
        detail:   `Solution ${solutionId} has ${pref} as a prerequisite — modify ${pref} to declare it satisfies this Solution.`,
        triggeredBy: solutionId,
      })
    }
  }

  return rows
}

/**
 * Compose the Changes-List from a live SpecBlock ref + snapshot metadata.
 * Returns a reactive computed that recomputes as the underlying spec changes.
 */
export function useChangesList(
  spec:        Ref<SpecBlock | null>,
  planName:    Ref<string>,
  planVersion: Ref<string>,
) {
  const deliverable = computed<ChangesListDeliverable | null>(() => {
    const s = spec.value
    if (!s) return null
    const rows = _detectChanges(s)
    const counts: Record<ChangeSpecCategory, number> = {
      Stakeholder: 0, Value: 0, Constraint: 0, Resource: 0, Function: 0,
    }
    for (const r of rows) counts[r.category]++
    return {
      generatedAtIso: new Date().toISOString(),
      planName:       planName.value ?? '',
      planVersion:    planVersion.value ?? '',
      totalChanges:   rows.length,
      countsByCategory: counts,
      rows,
    }
  })

  /** Plain-text serialisation for copy-to-clipboard fallback + email plain body. */
  const asPlainText = computed<string>(() => {
    const d = deliverable.value
    if (!d) return ''
    const lines: string[] = []
    lines.push(`Changes-List — ${d.planName || '(no plan name)'}`)
    lines.push(`Plan version: ${d.planVersion || '(no version)'}`)
    lines.push(`Generated: ${d.generatedAtIso}`)
    lines.push(`Total changes: ${d.totalChanges}`)
    lines.push(`Counts by category: Stakeholder=${d.countsByCategory.Stakeholder}, Value=${d.countsByCategory.Value}, Constraint=${d.countsByCategory.Constraint}, Resource=${d.countsByCategory.Resource}, Function=${d.countsByCategory.Function}`)
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('')
    for (const r of d.rows) {
      const kindLabel = r.kind.toUpperCase()
      lines.push(`${r.category} · ${kindLabel} · ${r.entryId}`)
      lines.push(`  Detail:      ${r.detail}`)
      lines.push(`  Triggered by: ${r.triggeredBy}`)
      lines.push('')
    }
    return lines.join('\n')
  })

  return {
    deliverable,
    asPlainText,
  }
}
