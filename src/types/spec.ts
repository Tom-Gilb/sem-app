// UNIT_TYPE=Types
// Full SpecBlock type definitions — Evo Step 3 (S.EvoStep3.SpecBlockInterface)
// All fields are required strings (empty string = missing content, not undefined).
// Optional concepts (relatedSpecs, past history) are deferred to a future Evo step.

/**
 * A single Function (F.) entry in a Planguage spec block.
 *
 * Tom 2026-05-14 (DD-004): A **Function** in Planguage is WHAT a system DOES
 * — a binary capability the system either provides or does not. The test for
 * a function is its **presence or absence**, not its quality or quantity.
 *   "REPURPOSE: NOT AS SUCCESS. AS PRESENCE OR ABSENCE OF THE DEFINED FUNCTION."
 * — Tom Gilb, 2026-05-14 (resolving DD-004 in favour of Option A: repurpose).
 *
 * Quality / quantity / performance / cost attributes attach to a function as
 * **Value entries** (with Scale + Meter + Goal/Wish/Fail/Survival), never as
 * a property of the function itself. Means (S. entries) deliver the function
 * and move its attached Values.
 *
 * Canonical sources: Tom Gilb, *Clear Communication: Logical Language
 * Logistics for Clear Replies and Phrases* (June 2024 — researchgate.net
 * publication 393165120; gilb.com/store/oJCCxtsM); Competitive Engineering
 * Ch. 19 Planguage; Berlin "Ends and Means" 2026-05-21 slide 4 + slide 6.
 */
export interface FEntry {
  /** Unique identifier, e.g. "F.ProvideSEMEntryInterface" */
  id: string
  /** Always "Function" */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /**
   * Bare-noun capability statement — *"the cabin provides recreation"*,
   * *"the cabin provides meals"*, *"the system authenticates users"*. NOT a
   * goal, NOT a quality target, NOT an aspiration. Just the binary
   * capability the system shall provide.
   */
  description: string
  /**
   * **Presence test** — the binary statement that determines whether the
   * defined function is present in the system. PRESENT or ABSENT, YES or NO.
   * Examples: *"Recreational facilities exist on premises"*, *"Cabin offers
   * meals: YES"*, *"User authentication endpoint exists and accepts
   * credentials"*. Quality / quantity / performance / cost MUST NOT appear
   * here — those belong on Value entries via `functionOfValue` linkage.
   */
  presenceTest: string
  /**
   * @deprecated Use `presenceTest`. Kept on the type for backwards-compat
   * during the DD-004 migration: existing saved specs still carry this
   * field; loaders read `presenceTest ?? successCriteria` and writers always
   * emit `presenceTest`. Will be removed in a future schema version once all
   * stored specs have been migrated.
   */
  successCriteria?: string
  /** Wikilink(s) to V. entries this function serves */
  functionOfValue: string
  /**
   * Current system status — is this function actually present in the system now?
   * 'present'  = fully implemented and operational
   * 'absent'   = not yet in the system
   * 'partial'  = partially implemented or degraded
   * ''         = not assessed (default / backwards-compatible)
   * Used in Model mode for system health tracking.
   */
  currentStatus?: 'present' | 'absent' | 'partial' | ''
}

/**
 * A single Ambition Level entry — records where/when a goal level was set.
 * Mode A: app-sourced (auto-populated by Make Ambitious or spec generation).
 * Mode B: manual / stakeholder-sourced (free text + optional URL).
 * Both modes can coexist on a single V. entry as stacked chips.
 */
export interface AmbitionLevelEntry {
  /** "app" = auto-populated by the app; "stakeholder" = manually entered */
  source: 'app' | 'stakeholder'
  /** Mode A label: e.g. "Make Ambitious — Evo Step 3" or "Spec generation — 2026-05-02 14:32" */
  label?: string
  /** Mode B: free-text stakeholder statement */
  text?: string
  /** Mode B: optional URL to source document */
  url?: string
}

/**
 * A single Value (V.) entry in a Planguage spec block.
 */
export interface VEntry {
  /** Unique identifier, e.g. "V.EntryFluency" */
  id: string
  /** Always "Value" */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /** Plain-language description of what is being measured */
  description: string
  /** What is being measured and its unit */
  scale: string
  /** How measurement is performed */
  meter: string
  /** Current measured state: "Status [date, condition] value" */
  status: string
  /** Minimum acceptable level: "Tolerable [date, condition] value" */
  tolerable: string
  /** Target level: "Goal [date, condition] value" */
  goal: string
  /** Wikilink(s) to F. entries whose performance this value measures */
  valueOfFunction: string
  /**
   * Change 2 — Ambition Level: optional list of entries recording where/when goal was set.
   * Mode A entries are app-sourced; Mode B entries are stakeholder-sourced.
   */
  ambitionLevel?: AmbitionLevelEntry[]
  /**
   * Change 3 — Wish: initial stakeholder aspiration before design/resource constraints.
   * Becomes a Goal once feasibility is confirmed.
   */
  wish?: string
  /**
   * Change 3 — Stakeholder who stated the Wish (free text, optional).
   */
  wishStakeholder?: string
  /**
   * Forecast — projected future state of this value (distinct from Goal which is
   * the design target). Used in Model mode to record where the value is expected
   * to be at a future date without committing to a plan to get there.
   * Format mirrors status: "Forecast [date, condition] value"
   */
  forecast?: string
}

/**
 * A single Solution (S.) entry in a Planguage spec block.
 */
export interface SEntry {
  /** Unique identifier, e.g. "S.MarkdownSerialiserSchema" */
  id: string
  /** Always "Solution" */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /** How the solution achieves the function */
  description: string
  /** Estimated impact on linked V. entries, e.g. "V.OutputCompleteness ~80%" */
  impact: string
  /** Wikilink(s) to F. entries this solution implements */
  function: string
}

/**
 * A single Constraint (C.) entry in a Planguage spec block.
 *
 * DD-006 (Tom Gilb, 2026-05-15): Constraints are binary rules — "Must do" or
 * "Must avoid" — that define the boundaries any acceptable plan must stay
 * within. They are NOT scalar targets (those live on Value entries as
 * Tolerable/Goal levels). A constraint is either VIOLATED or NOT VIOLATED.
 *
 * Examples of binary constraints:
 *   "Must comply with GDPR at all times"
 *   "Must never store unencrypted personally identifiable information"
 *   "Must operate within approved budget envelope"
 *
 * When evaluating plan health, every C. entry is checked for violation.
 * A single violated constraint = plan is NOT acceptable regardless of
 * how well the Values are met (SUCCESS requires ALL constraints respected).
 *
 * Canonical source: Tom Gilb, *Competitive Engineering* (Constraint chapter);
 * Template_Write_Constraint.md (standard: Description + Scope + Rationale + Source).
 * Folded into DD-006 SUCCESS definition: "success = ALL Values within ALL Constraints".
 */
export interface CEntry {
  /** Unique identifier, e.g. "C.GDPR" or "C.BudgetCap" */
  id: string
  /** Always "Constraint" */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /**
   * The binary rule itself — must start with "Must" or "Must not".
   * This IS the constraint: the hard boundary that must not be violated.
   * No scalar thresholds here (those belong on VEntry.tolerable).
   * Examples: "Must comply with GDPR", "Must not store PII unencrypted".
   * Canonical source: Template_Write_Constraint.md — Description field.
   */
  description: string
  /**
   * What the constraint binds — the function, value, subsystem, stakeholder
   * group, or operational context to which the rule applies.
   * Example: "The data export endpoint and all associated EU-resident storage systems."
   * Canonical source: Template_Write_Constraint.md — Scope field.
   */
  scope: string
  /**
   * Why this constraint exists — the regulation, principle, or risk that
   * necessitates it. Explains the "because" behind the binary rule.
   * Example: "EU GDPR Article 44 prohibits transfer of personal data outside
   * the EEA without adequate safeguards."
   * Canonical source: Template_Write_Constraint.md — Rationale field.
   */
  rationale: string
  /**
   * Optional citation — the exact rule, law, or agreement that mandates this
   * constraint. Format: SRCATTR_01 or plain text reference.
   * Example: "GDPR Art. 44; ISO 27001 A.13.2.1"
   * Canonical source: Template_Write_Constraint.md — Source field.
   */
  source?: string
}

/**
 * A complete spec block containing all F., V., S., and C. entries.
 * This is the in-memory representation used by the pipeline, serialiser,
 * and all composables.
 *
 * `constraints` is optional for backwards-compatibility with pre-DD-006
 * saved specs — always use `spec.constraints ?? []` when reading.
 */
export interface SpecBlock {
  functions: FEntry[]
  values: VEntry[]
  solutions: SEntry[]
  /** Binary Constraint entries (C.) — introduced DD-006. */
  constraints?: CEntry[]
  /**
   * Original stakes/stakeholders string captured at generation time.
   * Comma-separated list of stakeholder names from the SEMEntryForm parser
   * (e.g. "Patient, Nurse, Hospital Administration").
   * Stored so SDR and other views can display stakeholders even when the LLM
   * omits the `wishStakeholder` field on V. entries.
   * Optional for backwards-compat with specs generated before 2026-05-17.
   */
  stakes?: string
}
