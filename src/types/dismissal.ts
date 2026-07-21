// UNIT_TYPE=Types
// dismissal.ts — types for the Universal Dismissal Audit Trail.
//
// Tom Gilb verbatim 2026-06-14:
//   "If a fix is dismissed (and this is for incorruptable and all similar with
//    dismissing a suggestion). We need to ask 1. why?, 2. On whose authority
//    (default, Owner), and then to Log, in the plan documentation, all
//    dismissals (to learn, man and machine)"
//
// Composes with:
//   - Universal Undo SUPREME (every dismissal is reversible)
//   - No-Silent-Data-Loss SUPREME (dismissal log persisted to localStorage,
//     never lost)
//   - Conjunction-of-Technologies SUPREME (dismissal corpus is the (a) Plan
//     layer for future AI suggestion-grounding)
//   - SEM teaches sound planning engineering INCREMENTALLY (the modal teaches
//     "every No has a Why and an Authority")
//   - Twin portability (this type ports verbatim to Kai's industrial Twin)
//   - Kai-Zen patent base (structured-decision discipline)

/** Who is making the dismissal call. */
export type DismissalAuthority =
  | 'owner'        // default — the Plan Owner
  | 'planner'      // a named Planner
  | 'scribe'       // a named Scribe
  | 'stakeholder'  // a named stakeholder rep (requires authorityName)
  | 'other'        // free-text identification (requires authorityName)

export const DISMISSAL_AUTHORITY_META: Record<
  DismissalAuthority,
  { label: string; description: string }
> = {
  owner:       { label: 'Owner (default)', description: 'The Plan Owner — accountable party.' },
  planner:     { label: 'Planner',         description: 'A named Planner on this plan.' },
  scribe:      { label: 'Scribe',          description: 'A named Scribe on this plan.' },
  stakeholder: { label: 'Stakeholder',     description: 'A named stakeholder representative.' },
  other:       { label: 'Other',           description: 'A different named party (free-text identification).' },
}

/** AI-suggested quick-pick reasons — click a chip to autofill the Why textarea.
 *  Tom's "to learn, man and machine" framing — these standardise common rejection
 *  language so the dismissal corpus is searchable + learnable. */
export const QUICK_PICK_REASONS: readonly string[] = Object.freeze([
  'Not applicable to this plan\'s scope',
  'Already addressed elsewhere in the plan',
  'Conflicts with another higher-priority commitment',
  'Re-evaluate after a specific milestone',
  'Owner override — strategic judgment',
  'Stakeholder pushback received',
  'Out of scope for the current Evo step',
  'Resource constraint — no budget right now',
  'Already a known limitation; trade-off accepted',
  'Insufficient evidence to act on',
])

/** A single dismissal record — permanent, queryable, plan-attached. */
export interface DismissalRecord {
  /** Deterministic id — `<planId>:<agentId>:<findingId>:<isoMs>` */
  id: string

  /** Which Agent surfaced the dismissed finding. */
  agentId: 'elon' | 'incorruptible' | 'sharpen' | 'evo-critiquer' | 'strategy' | 'plan-importer' | 'maria' | string

  /** The Agent's internal category for the finding (e.g. 'pace-of-innovation', 'quarterly-tyranny'). */
  agentCategory: string

  /** Original finding id — used to suppress repeat-bother. */
  findingId: string

  /** One-line summary of what the finding said (for log display + search). */
  findingSummary: string

  /** One-line summary of the proposed Planguage fix. */
  suggestedFixSummary: string

  /** ISO timestamp. */
  dismissedAtIso: string

  /** User's verbatim explanation (required). */
  whyReason: string

  /** Who said no. */
  authority: DismissalAuthority

  /** Free-text name when authority is 'stakeholder' or 'other'. */
  authorityName?: string

  /** Which plan this was on (Plan title, or spec id when available). */
  planId: string

  /** Plan content hash at dismissal time — used by the learning loop to detect
   *  "the plan has changed since this was dismissed; re-surface for re-evaluation".
   *  Phase 2 — leave null for MVP exact-id matching. */
  planContentHash?: string | null
}

/** Surface a one-line, human-readable label for an authority + name combo. */
export function dismissalAuthorityLabel(record: DismissalRecord): string {
  const base = DISMISSAL_AUTHORITY_META[record.authority]?.label ?? record.authority
  if ((record.authority === 'stakeholder' || record.authority === 'other') && record.authorityName) {
    return `${base} — ${record.authorityName}`
  }
  return base
}

/** Generate a deterministic id for a new DismissalRecord. */
export function makeDismissalId(planId: string, agentId: string, findingId: string, isoMs: number): string {
  return `${planId}::${agentId}::${findingId}::${isoMs}`
}
