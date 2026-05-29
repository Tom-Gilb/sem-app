// UNIT_TYPE=Type
// board.ts — BoardMember profile type + ActivityEntry for Board Activity Log
//
// Pure data shape. No Vue, no framework dependencies.
// Used by: src/data/boardMembers.ts (data), src/lib/maria/boardMatcher.ts (logic),
//          src/composables/useBoardMembers.ts, src/composables/useBoardActivityLog.ts,
//          MariaAgentBoard.vue (display), MariaBoardHub.vue (hub + settings + log).
//
// Twin-portable: fields map cleanly to a REST schema, Solid Pod RDF record, or
// a database row. Do NOT add Vue-specific types (Ref, ComputedRef, etc.) here.

export interface BoardMember {
  /** Unique stable identifier — use a lowercase-hyphen slug (e.g. 'chair', 'treasurer'). */
  id: string

  /** Full display name as it should appear on cards and email reports. */
  name: string

  /** Board role / title (e.g. 'Board Chair', 'Treasurer', 'Secretary'). */
  role: string

  /** Direct phone number (any format Tom prefers). */
  phone?: string

  /** Email address for pre-populated board follow-up emails. */
  email?: string

  /** Mailing or home address. */
  address?: string

  /**
   * Domains or topics this member is genuinely passionate about.
   * Used for keyword-match auto-suggest. Keep terms short so they match
   * naturally against governance gap and decision text.
   * Examples: 'finance', 'education policy', 'community relations', 'legal'
   */
  specialInterests: string[]

  /**
   * Skills and professional capabilities this member brings to the board.
   * Weighted higher (+3 vs +2) in the auto-suggest scorer.
   * Examples: 'legal review', 'financial analysis', 'grant writing', 'mediation'
   */
  specialAbilities: string[]

  /**
   * Types of tasks this member reliably steps up to own.
   * Examples: 'subcommittee chair', 'parent outreach', 'budget review', 'minutes'
   */
  volunteersFor: string[]

  /**
   * Types of tasks this member tends to avoid or push back on.
   * Applied as a negative weight (−2) in the auto-suggest scorer so the system
   * avoids recommending them for tasks they will not engage with enthusiastically.
   * Examples: 'fundraising calls', 'administrative follow-up', 'event logistics'
   */
  dislikesTasks: string[]

  /**
   * Free-text notes on scheduling or availability constraints.
   * Examples: 'Not available July–August', 'Evenings only', 'Prefers email contact'
   */
  availability?: string

  /** Any other context useful for assignment decisions. */
  notes?: string
}

// ── Board Activity Log ─────────────────────────────────────────────────────────

/** Lifecycle status of a board action item. */
export type ActivityStatus = 'open' | 'in-progress' | 'done'

/** Where the entry originated. */
export type ActivitySource = 'maria' | 'manual'

/**
 * The type of board action item.
 * 'governance-gap'  — imported from a MariaGap (missing decision on a key topic)
 * 'authority-gap'   — imported from a MariaAuthorityEntry (unclear decision ownership)
 * 'pattern-action'  — imported from a MariaPattern of type 'concern'
 * 'manual'          — user-created note or action item
 */
export type ActivityType =
  | 'governance-gap'
  | 'authority-gap'
  | 'pattern-action'
  | 'manual'

/**
 * A single board action item in the activity log.
 * Imported automatically from Maria analysis output, or created manually.
 * Twin-portable: maps to a REST endpoint, a Solid Pod resource, or a DB row.
 */
export interface ActivityEntry {
  /** UUID stable identifier. */
  id: string

  /** One-sentence summary — auto-populated from gap/authority/pattern on Maria import. */
  title: string

  /** Full detail text — auto-populated from significance+opportunity on import. */
  detail: string

  type: ActivityType
  status: ActivityStatus

  /** BoardMember.id values of assigned members. Empty = unassigned. */
  assignedMemberIds: string[]

  /** ISO date string e.g. "2026-06-15". Optional. */
  dueDate?: string

  /** ISO datetime of creation e.g. "2026-05-30T10:00:00.000Z". */
  createdAt: string

  /** ISO datetime of last edit. Set on every updateEntry() call. */
  updatedAt: string

  /**
   * Source traceability — which MariaResult + which item generated this entry.
   * null for manual entries.
   */
  source: {
    /** MariaResult.generatedAt — uniquely identifies the analysis run. */
    mariaGeneratedAt: string
    /** The source item's id within that run (gap.id / p.id / decisionIds.join('-')). */
    itemId: string
    itemType: ActivityType
  } | null
}
