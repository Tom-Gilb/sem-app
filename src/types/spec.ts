// UNIT_TYPE=Types
// Full SpecBlock type definitions — Evo Step 3 (S.EvoStep3.SpecBlockInterface)
// All fields are required strings (empty string = missing content, not undefined).
// Optional concepts (relatedSpecs, past history) are deferred to a future Evo step.

/**
 * A single Function (F.) entry in a Planguage spec block.
 */
export interface FEntry {
  /** Unique identifier, e.g. "F.ProvideSEMEntryInterface" */
  id: string
  /** Always "Function" */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /** Plain-language description of what the system does */
  description: string
  /** Measurable acceptance criteria for this function */
  successCriteria: string
  /** Wikilink(s) to V. entries this function serves */
  functionOfValue: string
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
 * A complete spec block containing all F., V., and S. entries generated from
 * a single SEM triple. This is the in-memory representation used by both the
 * pipeline handler (response validation) and the serialiser composable.
 */
export interface SpecBlock {
  functions: FEntry[]
  values: VEntry[]
  solutions: SEntry[]
}
