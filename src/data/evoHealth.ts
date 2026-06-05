// UNIT_TYPE=Data
//
// evoHealth.ts — Evo Health Tool (EHT) types + defaults.
//
// SOURCE (Tom Gilb 2026-06-03 verbatim):
//   *"EHT: What could we do for an Evo-Step Health Tool: same structure as PHI
//     but especially focussed on Evo steps and the Short Term: Settings options
//     1. Next Evo Step, 2. Next 5 Evo steps, 3 All Planned evo steps.
//     In addition add: Cure Evo Health: automatic or manual elimination of
//     outstanding EH Defects (at the cost of risk of bad decisions, vs cost of
//     no decisions). This produces an optional list of all auto ai changes,
//     reason for change, and a risk rating (green, orange, red). Then an option
//     to approve each one, in groups (Step, Task, other), All, with Identity
//     of approver, and email to Owner., as well as a log of all such approvals
//     and changes in the Plan as stored in that version."*
//
// Architecture parallels Plan Health (PHI):
//   - Status panel  : current EHI + defect list + history (analogue of PlanHealthStatusPanel)
//   - Target panel  : threshold + per-step health gap (analogue of PlanHealthTargetPanel)
//   - Admin panel   : defect category weights + scope + cure rules (analogue of PlanHealthAdminPanel)
//   - Cure flow     : NEW — auto/manual defect elimination with approval + audit trail
//
// v1 ships data layer + scope setting + placeholder panel registered as a tile.
// Defect detection logic + Cure flow ship in v2 (incremental rollout, same
// pattern as PHI which shipped Status → Admin → Target over weeks).

import type { EvoStep } from '../types/evo-plan'

// ── Scope (Tom's 3 explicit settings) ────────────────────────────────────────

export type EHScope = 'next-step' | 'next-5-steps' | 'all-steps'

export const EH_SCOPE_LABELS: Record<EHScope, { label: string; description: string }> = {
  'next-step':    { label: 'Next Evo Step',      description: 'Just the upcoming step — short-term focus' },
  'next-5-steps': { label: 'Next 5 Evo Steps',   description: 'Short-to-medium horizon' },
  'all-steps':    { label: 'All Planned Steps',  description: 'Whole-plan health audit' },
}

export const DEFAULT_SCOPE: EHScope = 'next-step'

// ── EH Defect types ─────────────────────────────────────────────────────────

/** Severity of a detected defect — drives Cure risk rating + display colour. */
export type EHSeverity = 'green' | 'orange' | 'red'

/** Category that groups related defects.  Used by the Cure flow's "approve in
 *  groups (Step, Task, other)" option. */
export type EHDefectCategory = 'step' | 'task' | 'spec-link' | 'measure' | 'risk' | 'other'

export interface EHDefect {
  /** Stable id (for keys + audit log) */
  id: string
  /** Which Evo Step the defect is on (null = plan-level defect) */
  stepName: string | null
  /** Category — drives the "approve in groups" affordance */
  category: EHDefectCategory
  /** Severity — drives display colour + Cure risk rating */
  severity: EHSeverity
  /** Short human-readable defect title */
  title: string
  /** Full description — why it's a defect */
  description: string
  /** Suggested cure — the AI/deterministic fix proposal */
  suggestedCure?: EHCure
}

// ── Cure (the proposed fix) ─────────────────────────────────────────────────

/** What kind of change the cure proposes — drives the "approve in groups" sort. */
export type EHCureKind = 'edit-step' | 'edit-task' | 'edit-spec' | 'add-measure' | 'add-mitigation' | 'other'

export interface EHCure {
  id: string
  /** Type of change being proposed. */
  kind: EHCureKind
  /** Target identifier (step name / task id / spec entry id). */
  targetRef: string
  /** Short title for the proposed change. */
  title: string
  /** Full description — what the cure does. */
  description: string
  /** Why this cure (the reason — required for the audit trail). */
  reason: string
  /** Risk rating of applying the cure — green/orange/red triangle. */
  riskRating: EHSeverity
}

// ── Approval (audit trail) ──────────────────────────────────────────────────

/** Lifecycle of a Cure approval. */
export type EHApprovalStatus = 'pending' | 'approved' | 'rejected' | 'applied'

export interface EHApproval {
  /** Stable id */
  id: string
  /** The cure being approved */
  cureId: string
  /** Approver identity (name; future: real user) */
  approvedBy: string
  /** When approved/rejected */
  reviewedAt: number
  /** Optional rationale / note from the approver */
  note?: string
  /** Status */
  status: EHApprovalStatus
  /** When the cure was actually applied to the plan (after approval, v2) */
  appliedAt?: number
  /** Email-to-owner timestamp (after approval, v2) */
  emailedAt?: number
}

// ── The full EH set ──────────────────────────────────────────────────────────

export interface EHSet {
  planId: string
  generatedAt: number
  scope: EHScope
  /** All detected defects in scope */
  defects: EHDefect[]
  /** All approvals (audit log — accumulates across cures) */
  approvals: EHApproval[]
  /** Threshold — EHI below which the badge alerts.  Default 50 (matches PHI default). */
  threshold: number
}

// ── localStorage key ─────────────────────────────────────────────────────────

export function storageKey(planId: string): string {
  return `evoHealth:v1:${(planId || 'default').trim()}`
}

// ── Default empty set ────────────────────────────────────────────────────────

export function buildEmptySet(planId: string): EHSet {
  return {
    planId,
    generatedAt: Date.now(),
    scope: DEFAULT_SCOPE,
    defects: [],
    approvals: [],
    threshold: 50,
  }
}

// ── Mock seed (for demo before the v2 defect detector ships) ────────────────

export function buildMockEHSet(planId: string, steps: EvoStep[], scope: EHScope = DEFAULT_SCOPE): EHSet {
  const scopedSteps = scope === 'next-step'    ? steps.slice(0, 1)
                    : scope === 'next-5-steps' ? steps.slice(0, 5)
                    :                            steps
  const defects: EHDefect[] = []
  scopedSteps.forEach((s, i) => {
    if (s.linkedSolutions.length === 0) {
      defects.push({
        id: `def-step-${i}-no-sol`,
        stepName: s.name,
        category: 'step',
        severity: 'red',
        title: 'Step has no linked Solution',
        description: 'This Evo Step has no Solution Spec attached — it cannot deliver value without a means.',
        suggestedCure: {
          id: `cure-step-${i}-no-sol`,
          kind: 'edit-step',
          targetRef: s.name,
          title: 'Link the closest matching Solution Spec',
          description: 'Auto-link this step to the most plausible existing Solution based on description similarity.',
          reason: 'Every Evo Step must link to ≥1 Solution Spec (Planguage Evo-Step *141).',
          riskRating: 'orange',
        },
      })
    }
    if (s.linkedValues.length === 0) {
      defects.push({
        id: `def-step-${i}-no-val`,
        stepName: s.name,
        category: 'step',
        severity: 'orange',
        title: 'Step has no linked Value',
        description: 'This step is a "work step", not a "value step" — no V. target measurable on delivery.',
        suggestedCure: {
          id: `cure-step-${i}-no-val`,
          kind: 'edit-step',
          targetRef: s.name,
          title: 'Suggest linkedValues from spec',
          description: 'Propose 1–2 Value Specs whose Status this step could plausibly move.',
          reason: 'Steps without linkedValues cannot be measured in the Study-Act phase.',
          riskRating: 'green',
        },
      })
    }
    if (s.description.length < 30) {
      defects.push({
        id: `def-step-${i}-vague-desc`,
        stepName: s.name,
        category: 'step',
        severity: 'orange',
        title: 'Step description is vague (<30 chars)',
        description: `"${s.description}" is too short to be actionable.`,
        suggestedCure: {
          id: `cure-step-${i}-desc`,
          kind: 'edit-step',
          targetRef: s.name,
          title: 'Expand description with concrete mechanism',
          description: 'AI suggests a longer description naming the mechanism + the V. movement expected.',
          reason: 'Vague descriptions produce vague tasks and unmeasurable outcomes.',
          riskRating: 'green',
        },
      })
    }
  })
  return {
    planId,
    generatedAt: Date.now(),
    scope,
    defects,
    approvals: [],
    threshold: 50,
  }
}
