// UNIT_TYPE=Types
// Penta Model types — Gilb-Shalloway 2022
// Five forces: Scope · Values · Efficiency · Resources · Designs (SVERD — sword).
// Penta is a sharpening framework: use it to balance and sharpen a plan across all five forces.
//
// Canonical source: Tom Gilb & Al Shalloway, "The Penta Model" (2022);
// Simple book Ch.4; Competitive Engineering Design chapter.
//
// Field names align to spec.ts (FEntry, VEntry, SEntry, CEntry, REntry) so
// this type is portable to Kai's Twin without renaming.
//
// Note on the 'scope' sector: Scope = the specified set of functions (what it must DO) +
// constraints (what it must NOT do). Stakeholders are the SOURCES of every Scope entry,
// not a sector in themselves.

/** The five sectors of the Penta Model. */
export type PentaSectorId = 'scope' | 'values' | 'efficiency' | 'resources' | 'design'

/** All five in display order (Scope at top, clockwise). */
export const PENTA_SECTOR_ORDER: PentaSectorId[] = [
  'scope', 'values', 'efficiency', 'resources', 'design',
]

/**
 * A single item within a Penta sector.
 * Typed to match the originating spec entry type for Twin portability.
 */
export interface PentaItem {
  /** Mirrors the originating spec entry id (e.g. "V.EntryFluency"). */
  id:          string
  /** Short label for the pinwheel arc (truncated if needed). */
  label:       string
  /** Full description from the spec entry. */
  description: string
  /** Originating entry type — drives which fields are populated.
   *  'evo-step' and 'task' are used for the Design sector hierarchy rings
   *  (Tom Gilb 2026-06-07: Solutions → Evo Steps → Tasks).
   */
  type:        'function' | 'value' | 'constraint' | 'resource' | 'solution' | 'evo-step' | 'task'
  // ── Ambition Level entries (all entry types — the motivating vision statement) ──
  /**
   * One or more unquantified vision/ambition statements that precede Planguage quantification.
   * Each carries the raw statement + source attribution (person, ref, URL).
   * Tom Gilb 2026-06-09: "If the source is power (boss, minister), then our Planguage
   * clarification has real authority behind it. This is a major Planguage mechanism."
   */
  ambitionLevel?: Array<{
    statement:     string
    sourcePerson?: string
    /** Where/when stated — e.g. "SEM Sharpening 9 July 12:42", "Board meeting 2026-06-08" */
    sourceRef?:    string
    sourceUrl?:    string
  }>
  // ── Value fields (populated when type === 'value') ─────────────────────
  /** Current measured level (parsed numeric from VEntry.status). */
  status?:     number
  /** Minimum non-failure level (parsed numeric from VEntry.tolerable). */
  tolerable?:  number
  /** Committed target level (parsed numeric from VEntry.goal). */
  goal?:       number
  /** Stakeholder dream level — uncommitted aspiration (parsed numeric from VEntry.wish). */
  wish?:       number
  /** Scale / unit description from VEntry.scale. */
  scale?:      string
  /** How the scale is measured — from VEntry.meter. */
  meter?:      string
  // ── Resource fields (populated when type === 'resource') ───────────────
  /** Allocated budget (parsed numeric from REntry.budget ?? REntry.goal). */
  budget?:     number
  /** Amount consumed so far (parsed numeric from REntry.status). */
  consumed?:   number
  /** Scale / unit description from REntry.scale. */
  unit?:       string
  // ── Solution fields (populated when type === 'solution') ─────────────
  /** Estimated impact on V. entries — free text from SEntry.impact, e.g. "V.OutputCompleteness ~80%".
   *  Used in the value-flow panel to show which Values this Solution produces. */
  impact?: string
  // ── Evo Step fields (populated when type === 'evo-step') ──────────────
  /** Solution IDs this Evo Step implements (from EvoStep.linkedSolutions). */
  linkedSolutions?: string[]
  /** Effort share 1–100 (from EvoStep.effortPercent). */
  effortPercent?:   number
  // ── Task fields (populated when type === 'task') ────────────────────
  /** Parent Evo Step name this task belongs to. */
  parentStep?:  string
  /** Hours estimate (from TaskSuggestion.effortHours). */
  effortHours?: number | null
  /** Assignee name (from TaskSuggestion.assignee). */
  assignee?:    string | null
  // ── Shared Planguage parameters (Tom Gilb 2026-06-09 r02+r19 — all entry types) ──
  /** Who is accountable for this entry. From *.specOwner. */
  specOwner?:     string
  /** Named stakeholders for this entry. From *.stakeholders. */
  stakeholders?:  string
  /** Business case for including this entry. From *.justification. */
  justification?: string
  /** Version/date stamp for this entry. From *.version. */
  version?:       string
  /** Known risks or open issues. From *.risks. */
  risks?:         string
  // ── Shared ─────────────────────────────────────────────────────────────
  /** Classification tags from entry level field (e.g. 'Business', 'Product'). */
  tags?:       string[]
  /** Original spec entry reference — the full id for write-back. */
  entryRef?:   string
}

/** One of the five Penta sectors with its items. */
export interface PentaSector {
  id:        PentaSectorId
  label:     string
  /** Background fill colour for the SVG sector arc. */
  color:     string
  /** Text colour for labels within the sector. */
  textColor: string
  items:     PentaItem[]
  /** Unique tag values present across items in this sector. */
  groupTags: string[]
}

/**
 * Efficiency ratio: (average Value achievement) / (average Resource utilisation).
 *
 * Ratio ≥ 1.5 → excellent (more value per resource than consumed)
 * Ratio ≥ 1.0 → good
 * Ratio ≥ 0.6 → acceptable
 * Ratio  < 0.6 → poor
 */
export interface PentaEfficiency {
  /** Average (status / goal) across all V. entries with both values set. 0..1 */
  valueAchievement:     number
  /** Average (consumed / budget) across all R. entries with both values set. 0..1 */
  resourceUtilization:  number
  /** valueAchievement / max(resourceUtilization, 0.01) — also equals Available/Required */
  ratio:                number
  /** SIGNED balance percent: (ratio − 1) × 100, bounded below at −100% (no upper ceiling).
   *  Tom Gilb 2026-06-10: zero means BALANCE (exactly enough resources to reach all Wishes/Goals);
   *  negative means deficit (e.g. −50% = you have half the resources you need);
   *  positive means surplus (e.g. +50% = you have 50% more resources than you need).
   *  r92b: upper +500 clamp REMOVED ("417 is 417, not ~500"). Display sites must handle large
   *  projected values gracefully — the on-glyph V:N% / R:N% overlays already provide the
   *  source numbers, so a huge balancePercent is contextualised by the raw inputs. */
  balancePercent:       number
  /** Grade derived from ratio. */
  grade:                'excellent' | 'good' | 'acceptable' | 'poor'
  /** True when Efficiency cannot honestly be computed (e.g. no Resources planned at all, or no Budgets set).
   *  When true, the percentScore/grade are placeholders — display sites MUST show the reason instead.
   *  Tom Gilb 2026-06-10: "Efficiency cannot be computed. No Resources planned yet." */
  cannotCompute:        boolean
  /** Human-readable explanation displayed when cannotCompute is true. */
  cannotComputeReason?: string
  /** True when Efficiency is computed using DEFAULTED Status values (Resource Status=0 because not yet measured,
   *  or Value Status=0 because not yet delivered). The number is honest as a PROJECTION but should be displayed
   *  with a clear "projected" caveat so users understand it's not actual-measured efficiency.
   *  Tom Gilb 2026-06-10: "I put in money but no recomputation of efficiency" — Budget alone now triggers
   *  projected-mode recompute instead of staying cannot-compute. */
  isProjected:          boolean
  /** Human-readable explanation of the projection caveat (e.g. "Status not yet measured on 2 of 3 Resources"). */
  projectionNote?:      string
}

/** The full Penta Model derived from a SpecBlock. */
export interface PentaModel {
  sectors:   Record<PentaSectorId, PentaSector>
  efficiency: PentaEfficiency
  planName:  string
  specId:    string
}

// ── PentaOptima command types ─────────────────────────────────────────────────

/**
 * The class of transformation a PentaOptima command requests.
 * All names are Planguage-clean (no Scrum vocabulary).
 */
export type PentaOptimaCmdType =
  | 'scale-value'
  | 'scale-resource'
  | 'scale-all-values'
  | 'scale-all-resources'
  | 'identify-leverage'
  | 'custom'

/** A single PentaOptima command — passed to buildOptimaPrompt(). */
export interface PentaOptimaCmd {
  type:        PentaOptimaCmdType
  description: string
  /** Optional structured payload for preset commands. */
  payload?:    Record<string, unknown>
}
