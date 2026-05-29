// UNIT_TYPE=Type
// board.ts — BoardMember profile type
//
// Pure data shape. No Vue, no framework dependencies.
// Used by: src/data/boardMembers.ts (data), src/lib/maria/boardMatcher.ts (logic),
//          MariaAgentBoard.vue (display).
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
