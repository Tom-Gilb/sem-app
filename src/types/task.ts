// UNIT_TYPE=Types
// TaskSuggestion type definition — Evo Step 8 (S.Evo8.TaskSuggestionHandler)
// Represents a single suggested task derived from an Evo step description.
//
// Tom Gilb 2026-06-03 enrichment — Tom wanted task planning to be "more
// interesting and exciting" (his words).  Added: estimate range (low/high +
// ± confidence), AI/SWAG source provenance, specialist type (distinct from
// assignee name), location, suggested tools, applicable standards, legal
// constraints, organisational policy considerations, problems to avoid,
// simplification opportunities (e.g. "reuse X").  Every new field is
// optional — existing tasks load unchanged.

import type { SourceProvenance } from '../data/aiSource'

/**
 * Hours estimate honesty layer — Tom 2026-06-03 *"make an hours estimate
 * range or ±, add SWAG or Based on (AI source)"*.
 *
 * `low` and `high` together encode a range (e.g. 4..8 = "4 to 8 hours").
 * `central` is the single-number convenience (legacy compatibility with
 * `effortHours`).  `provenance.source` tells the user where the estimate
 * came from — never silently SWAG-pretending-to-be-rigour.
 */
export interface HoursEstimate {
  /** Lower bound of the range (hours). */
  low: number | null
  /** Upper bound of the range (hours). */
  high: number | null
  /** Single-point estimate convenience (often midpoint of low/high). */
  central: number | null
  /** Where this estimate came from — SWAG / AI / measured / cited. */
  provenance?: SourceProvenance
  /** Optional one-line note ("based on r24 actual logs", "Auth0 SLA p.12"). */
  note?: string
}

/**
 * A single task suggestion derived from an EvoStep description.
 *
 * Spec: S.Evo8.TaskSuggestionHandler
 */
export interface TaskSuggestion {
  /** Unique identifier for this task within its parent step */
  id: string
  /** Plain-language description of the task */
  description: string
  /**
   * Legacy single-number hours estimate (null = not estimated).
   * Retained for backwards compatibility — new UI writes both this AND
   * `hoursEstimate` so existing persistence + read paths keep working.
   */
  effortHours: number | null
  /**
   * Rich hours estimate — range + provenance.  Optional; if absent, the UI
   * falls back to `effortHours` as a single-point estimate with no source.
   */
  hoursEstimate?: HoursEstimate
  /**
   * Specialist type / role needed for the task (e.g. "Contract Specialist",
   * "Systems Architect", "Naval Engineer").  Distinct from `assignee` (which
   * names a specific person).  Tom 2026-06-03: *"add (separate field)
   * Assigned To: [name]"*.
   */
  specialistType?: string | null
  /** Optional assignee name or email (null = unassigned) */
  assignee: string | null
  /** Whether the task has been completed */
  completed: boolean

  // ── "Make task planning more interesting" enrichment ──────────────────────
  // Tom 2026-06-03 — seven additive fields, each optional, each visible only
  // when populated (zero noise on legacy tasks).

  /** Simplification opportunities — e.g. "reuse existing hull-test rig". */
  simplification?: string | null
  /**
   * Location — where the work happens.  Free text + free shape: a specific
   * site ("HQ Boston"), a subsidiary, "Zoom", "near users", "not critical".
   */
  location?: string | null
  /** Suggested tools / templates / patterns — AI suggestions or human picks. */
  suggestedTools?: string | null
  /** Legal constraints that apply to this task (regulations, contracts). */
  legalConstraints?: string | null
  /** Organisational policy considerations (corporate policy, procurement). */
  orgPolicy?: string | null
  /** Standards that apply (ISO, IEEE, 10.Standard/, company standards). */
  applicableStandards?: string | null
  /** Known problems to avoid (lessons learned, historical pitfalls). */
  problemsToAvoid?: string | null
}
