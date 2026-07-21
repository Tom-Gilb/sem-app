// UNIT_TYPE=Types
// Penta Governance — Version control, approval workflow, and cascade-impact tracking
// for Penta Model (SVERD) field edits.
//
// Tom Gilb requirement (2026-06-08):
//   "We have to go through the same governance here as for all changes, Save the Version,
//    Get Approval, Decide to Update the Master, Or Not, but save the Version (with New name
//    and comments or explanation). We also need to deal with Cascading Changes..."
//
// Claude-Code-as-AI-Layer: cascade detection is DETERMINISTIC (no API calls).
// AI-assisted cascade analysis is Phase 2 (clipboard prompt + paste-back pattern).

export interface PentaFieldChange {
  /** Unique id for this change record */
  id: string
  /** Spec entry id (e.g. "V.1") */
  itemId: string
  itemType: 'value' | 'resource' | 'solution' | 'function' | 'constraint' | 'other'
  /** Human-readable label, e.g. "Customer Satisfaction — Goal" */
  itemLabel: string
  /** Which field changed: "goal" | "tolerable" | "status" | "budget" | etc. */
  field: string
  /** Stringified previous value */
  before: string
  /** Stringified new value */
  after: string
  /** ISO timestamp */
  changedAt: string
}

/** Cascade effect order — how many "hops" from the original change */
export type CascadeOrder = 'direct' | '2nd-order' | 'nth-order'

export type CascadeItemStatus =
  | 'unanalyzed'
  | 'no-impact'
  | 'change-required'
  | 'change-applied'
  | 'declared-not-calculated'

export interface CascadeImpact {
  id: string
  order: CascadeOrder
  /** Entry that changed (the cause) */
  causeItemId: string
  causeField: string
  /** r41 v234 (Tom Gilb 2026-06-20 verbatim "the Tags of the Planguage specs
   *  seem missin right side?  New Bug") — human-readable Tag for the cause
   *  side, parallel to effectItemLabel.  Source: entry.description (used by
   *  mnemonicLabel as the fallback when the raw id is V1/F1-style).
   *  Optional for back-compat with persisted CascadeImpacts that pre-date
   *  this field — the renderer falls back to mnemonicLabel(causeItemId)
   *  when absent. */
  causeItemLabel?: string
  /** Entry potentially affected */
  effectItemId: string
  effectItemType: string
  effectItemLabel: string
  /** "delivers" | "costs" | "constrains" | "may require redesign" | "constrained-by" | "may-constrain-delivery" */
  relationship: string
  /** Human-readable explanation of the potential impact */
  impactDescription: string
  status: CascadeItemStatus
  notes?: string
}

export type CascadeStatus = 'not-analyzed' | 'declared-not-calculated' | 'partial' | 'complete'

export interface PentaVersion {
  id: string
  /** User-given name for this version */
  label: string
  /** User's rationale / explanation */
  notes: string
  /** ISO timestamp */
  savedAt: string
  /** Field changes captured at save time */
  changes: PentaFieldChange[]
  cascadeStatus: CascadeStatus
  cascadeImpacts: CascadeImpact[]
  /** Full SpecBlock snapshot at version save time (typed as object to avoid circular imports) */
  specSnapshot: object
  status: 'draft' | 'approved' | 'integrated' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  integratedAt?: string
}
