// UNIT_TYPE=Types
// Full SpecBlock type definitions — Evo Step 3 (S.EvoStep3.SpecBlockInterface)
// All fields are required strings (empty string = missing content, not undefined).
// Optional concepts (relatedSpecs, past history) are deferred to a future Evo step.

/**
 * Per-field source attribution — Spec Sources design (Tom Gilb 2026-06-09).
 * Tracks who/what last set a specific field value and when.
 * Enables responsibility, traceability, health check, credibility, and security.
 * "Source: will always be specified explicitly or implied from editing or AI change activity."
 */
export interface FieldSource {
  /** Person name, team, or AI tool name that set this field value last.
   *  Human examples: "Tom Gilb", "Jane Smith", "Board"
   *  AI examples: "Optima", "Penta", "SEM Stage 3", "EVO Planner", "Suggested Additions"
   */
  source: string
  /** How this value was set */
  sourceType: 'human' | 'ai' | 'system'
  /** ISO 8601 timestamp — when this field was last changed */
  timestamp: string
  /** For AI-generated values: the specific SEM tool that generated it */
  tool?: string
  /** r41 v394 (Tom Gilb 2026-06-27): when an AI-surfaced suggestion was
   *  ACCEPTED by a human (e.g. clicking + on a chip in the Suggested
   *  Additions panel), this records the actor who made the choice.
   *  Resolution order: Planner name → Scribe name → default device user.
   *  Used by the Conjunction-of-Technologies Source-layer audit trail to
   *  distinguish "AI suggested AND human accepted" from "AI generated
   *  silently" — both have sourceType: 'ai' but the former carries the
   *  human accountability via this field.
   */
  acceptedBy?: string
  /**
   * r41 v413 (Tom Gilb 2026-07-01) — Source Attribution SUPREME
   * (`~/.claude/…/memory/rule_source_attribution_for_every_spec_element.md`)
   *
   * Canonical SEM stage / agent / tool where the value was produced.
   * Draws from the canonical stage-id list in the SUPREME rule.  Examples:
   *   "contract-parse-phase-2-extract"
   *   "plan-stage-1-input"
   *   "plan-stage-3-sharpen"
   *   "manual-accept-ai-suggestion"
   *   "maria-report"
   */
  stage?: string
  /**
   * r41 v413 — the SPECIFIC keywords / phrase / prompt fragment that
   * TRIGGERED this stamp.  For Class-A (raw-text sourced) — the verbatim
   * source phrase the AI or parser latched onto (e.g. `"as far as
   * practicable"` for an ambiguity flag; `"170 feet length"` for a Scale
   * extraction).  For Class-B (SEM-app sourced) — the AI suggestion
   * string (for accepted suggestions), or the button label pressed (for
   * manual adds), or the prompt fragment (for AI-only synthesis).
   */
  triggerText?: string
  /**
   * r41 v413 — for Class-A (raw-text sourced) entries, the citation into
   * the raw text that lets the planner navigate back to the source.
   * Examples:
   *   "§7 clause (a)"
   *   "para 3, sentence 2"
   *   "Article IV, first paragraph"
   *   "line 42"
   *   Contract clause number ("§12" / "3.2")
   * Empty / omitted for Class-B (SEM-app sourced) entries.
   */
  paragraphRef?: string
}

/**
 * Planguage Qualifier Conditions — canonical 3 classes (Tom Gilb r93ooo + r93rrr).
 *
 * Qualifiers define the CONDITIONS under which a Scale specification applies.
 * Formal Planguage basis: Qualifier (*124) — a set of Qualifier Conditions (*666)
 * that must all be simultaneously true (AND logic, definitional) for the spec
 * to apply. If no conditions are specified, the scale silently applies to
 * INFINITE contexts (the Infinity Trap — r93mmm SUPREME).
 *
 * **CANONICAL 3-CLASS TAXONOMY (per Tom Gilb's Twin Glossary, banked r93ooo):**
 *   - **Time  (*153)** — "when": dates, deadlines, relative times, weekdays, hours
 *   - **Place (*107)** — "where": geography, user type/role, system component, market segment
 *   - **Event (*062)** — "if": occurrences, scenarios, system states ("Peace", "If Approved")
 *
 * Twin-verified canonical example:
 *   `Fail [Europe, Year = After Ten Years, Peace]: 60% ±20%` — Place + Time + Event.
 *
 * **CRITICAL COST SIGNAL (Tom Gilb, 2026-06-09):**
 *   *"The when: answer can easily drive solution costs up by 10X."*
 *   When conditions present → Claudian MUST factor into cost estimates.
 *
 * **r93rrr migration**: SEM App previously extended canonical 3 → 5 named types
 * (when/where/what/how/why). That extension is now RETRACTED per the Twin Glossary
 * *124 definition. The legacy 5 fields are kept as backward-compat READ aliases
 * (mapped: when→time, where→place, what→event, how→event-secondary, why→rationale).
 * New writes go to the canonical 3 fields. The Phase 2 Qualifiers Panel (r93kkk
 * Two-Trigger UX) ports to a richer `QualifierSet[]` model; this `PentaConditions`
 * is the Phase 1 inline-per-entry shape.
 *
 * Cite: https://www.gilb.com/tomtwin/concept/Qualifier.124 (Twin Consultant, by Kai Gilb).
 */
export interface PentaConditions {
  // ── Canonical 3 classes (per Glossary *124 + *666 + *153/*107/*062) ──
  /** Time (*153) — when: dates, deadlines, weekdays, hours, operational windows */
  time?:  string
  /** Place (*107) — where: geography, user type/role, system component, market segment */
  place?: string
  /** Event (*062) — if: occurrences, scenarios, system states, "Peace", "If Approved" */
  event?: string
  // ── Legacy Phase-1 aliases (read on import; new writes prefer canonical above) ──
  /** @deprecated Read alias for `time`. Phase-1 backward-compat per r93rrr. */
  when?:  string
  /** @deprecated Read alias for `place`. Phase-1 backward-compat per r93rrr. */
  where?: string
  /** @deprecated Read alias for `event`. Phase-1 backward-compat per r93rrr. */
  what?:  string
  /** @deprecated Read fallback for `event` (secondary). Phase-1 backward-compat. */
  how?:   string
  /** @deprecated NOT a Qualifier per Glossary *124 — promote to a separate `rationale` field on the entry. Read alias retained for migration only. */
  why?:   string
}

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
  /** Stakeholders relevant to this Function entry — comma-separated names */
  stakeholders?: string
  /** Who owns/is responsible for this spec entry — free text */
  specOwner?: string
  /** Why this entry is in the spec — the business justification */
  justification?: string
  /** Version / date-time stamp of this spec entry. Free text: "v1.2 · 2026-06-09" */
  version?: string
  /** Known risks or issues associated with this entry */
  risks?: string
  /**
   * Mnemonic tags of the main Resource/cost entries associated with this function.
   * E.g. ["Dev Budget", "Server Cost"] — cross-references R. entries by their id.
   * Tom Gilb 2026-06-09: compact Planguage card — "Function Costs:" field.
   */
  costs?: string[]
  /**
   * IDs of child functions that are sub-capabilities of this function.
   * E.g. ["Booking Form", "Calendar Display", "Conflict Detect"].
   * Tom Gilb 2026-06-09: compact Planguage card — "Sub-functions:" field.
   */
  subFunctions?: string[]
  /**
   * ID of the parent function that this function belongs to as a sub-function.
   * E.g. "Cabin Management". Leave empty if this is a top-level function.
   * Tom Gilb 2026-06-09: compact Planguage card — "Mother Function:" field.
   */
  motherFunction?: string
  /** Per-field source attribution. Keys are field names ('description', 'presenceTest', etc.).
   *  Stamped automatically by applyItemEdits() on every save, and by AI generation.
   *  Tom Gilb 2026-06-09: "Source attribution is fundamental to spec credibility and trust."
   */
  fieldSources?: Record<string, FieldSource>
  /** Entry-level provenance string — "<Generator> · <Plan> · <YYYY-MM-DD>". Stamped by
   *  every producer (parser, importer, AI generator, seed builder, manual add).
   *  Renderer (`useColorfulSpecHtml.ts sourcesSummaryRow`) reads this for the
   *  `Source:` chip beside the entry headline.  Producer-side stamping rule
   *  (2026-06-20 sweep): no entry ships without `source`. */
  source?: string
  /** Provenance type for the entry-level `source` field. */
  sourceType?: 'human' | 'ai' | 'system'
}

/**
 * A single Ambition Level entry — the unquantified natural-language vision or mission
 * statement that PRECEDES and motivates the Planguage quantification (Scale / Tolerable /
 * Goal / Wish).
 *
 * Tom Gilb 2026-06-09 verbatim:
 * "The ambition level is a sentence-length statement of vision or ambition — how good
 *  we want to be in the future. It is usually unquantified. It may be a User Story
 *  format, Management BS, Politician BS found in speeches and slides. If it has a
 *  source (person, url, title, date) it is essential to capture that (including
 *  'SEM Sharpening 9 July 12:42'). Especially if the source is power (boss, minister),
 *  then our Planguage clarification has real authority behind it. This is a major
 *  Planguage mechanism, not mere BS statement."
 *
 * Source: Planguage Glossary Ambition *423 · CE book · All Tom Gilb books
 */
export interface AmbitionLevelEntry {
  /** The vision/ambition statement itself — natural language, typically unquantified */
  statement: string
  /** Who stated it: person name, role, or title (e.g. "CEO", "Minister Smith", "Tom Gilb") */
  sourcePerson?: string
  /**
   * Reference context: where/when the statement was made.
   * Examples: "Board meeting 2026-06-08", "SEM Sharpening 9 July 12:42",
   * "Budget speech Feb 2026", "User interview session 3"
   */
  sourceRef?: string
  /** URL to the source document, speech, slide deck, or recording */
  sourceUrl?: string
}

/**
 * A Planguage Stakeholder entry (§).
 * Tom Gilb 2026-06-09: compact Planguage card — Tag · Type · Definition · Description
 * (max 3 lines) · Needs (mnemonic IDs) · Source · Maintenance Contact.
 *
 * Reference: Stakeholder Engineering book (Tom Gilb).
 *
 * Compact card design (contrast with the prose-wall anti-pattern the UI used before):
 *   § [Tag]  [Type chip]                ← source
 *   Def: "one-sentence formal definition"
 *   max 2–3 lines context
 *   Needs: [Value Tag]  [Constraint Tag]  [Resource Tag]
 *   Contact: Name · Position · email · url
 */
export interface StakeholderEntry {
  /** Mnemonic tag — 1–3 words (Planguage Mnemonic ID Standard). */
  id: string
  /** Always "Stakeholder" */
  type: string
  /**
   * Stakeholder classification per Planguage.
   * Direct = primary beneficiary or user (receives the output value).
   * Indirect = affected party but not the primary recipient.
   * Regulatory = law, standard body, or compliance requirement.
   * System = another system or software that depends on this plan.
   * Inanimate = data, assets, or legal instruments with defined needs.
   */
  stakeholderType?: 'Direct' | 'Indirect' | 'Regulatory' | 'System' | 'Inanimate'
  /** One sentence: formal definition of who/what this stakeholder IS. */
  definition?: string
  /** Max 2–3 sentences: context, relationship to the plan, and key concern. */
  description?: string
  /**
   * Mnemonic IDs of Values (V.), Constraints (C.), and/or Resources (R.)
   * that this stakeholder needs to be satisfied.
   * Example: ["Conflict Rate", "Schedule Speed", "GDPR Compliance"]
   */
  needs?: string[]
  /** Where/how this stakeholder was identified — person, document, method, or event. */
  source?: string
  /** Maintenance contact — who to consult when this stakeholder entry needs updating. */
  maintContact?: {
    name?:     string
    position?: string
    email?:    string
    url?:      string
  }
  /** Per-field source attribution. Keys are field names ('definition', 'needs', etc.). */
  fieldSources?: Record<string, FieldSource>
  /** Provenance type for the entry-level `source` field. */
  sourceType?: 'human' | 'ai' | 'system'

  // ── r41 v305 — Role extension (Tom Gilb 2026-06-23 verbatim "PLEASE DO A
  //   MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY"). Role IS Stakeholder
  //   (Tom #8/9 — Role is a Stakeholder by definition; Roles are a subset of
  //   all Stakeholder logic and rules). These fields enrich a Stakeholder
  //   record into a Role record. ALL OPTIONAL — additive, no breaking changes.

  /** Identity — Position (e.g. "CTO") if the Stakeholder represents a role-by-function. */
  position?: string
  /** Identity — concrete person/entity name if known (else placeholder per Musk principle). */
  personName?: string
  /** Contact + identity fields. All optional. */
  contact?: {
    email?:        string
    phone?:        string
    location?:     string
    orgDivision?:  string
    supplierName?: string
    employeeId?:   string
  }
  /** Role time-span — ISO 8601 dates (YYYY-MM-DD). Optional. */
  dateBegin?: string
  dateEnd?:   string
  /** Default responsibilities — what this Role owns by default (one short phrase each). */
  defaultResponsibilities?: string[]
  /** Authority scope — what decisions this Role is empowered to make. ≤25-word ceiling. */
  authorityScope?: string
  /** Entry conditions — what qualifies someone to hold this Role. ≤25 words. */
  roleEntryConditions?: string
  /** Exit conditions — what triggers role termination or handover. ≤25 words. */
  roleExitConditions?: string
  /** RAG defaults — thresholds this Role applies to work it oversees. */
  ragDefaults?: { red?: string; amber?: string; green?: string }
  /** Many-to-many: tags of OTHER Stakeholders this one ACTS AS.
   *  Person Stakeholders link to Position Stakeholder tags here (Tom #4). */
  heldRoles?: string[]
  /** Placeholder flag — true if this Role has no specific named individual yet
   *  (Musk principle Tom #14: flag every placeholder so a real name can be assigned). */
  isPlaceholder?: boolean
}

// ─── r93jjj + r93kkk + r93lll Qualifiers data model ────────────────────────
// Tom Gilb 2026-06-12 verbatim SUPREME-tier rules — see CLAUDE.md for full
// architecture.  Realised in code 2026-06-27 (r41 v373) via Stage 3.3 Add
// Qualifiers process.  Canonical references:
//   - r93jjj "Conditions (Qualifiers) are FIRST-CLASS for every scalar spec"
//   - r93kkk "Multi-Set Conditions + CRITICAL flag + Two-Trigger UX"
//   - r93lll "ASPECTS book is the authoritative source" (Apr 2026)
//   - r93mmm "INFINITY TRAP Rule" — every scalar level without qualifiers
//     silently commits to infinite cost; this data model is the cure.

/** Three canonical condition classes per ASPECTS book (Apr 2026) + CE Ch.5
 *  Glossary entries *124 Qualifier + *666 Qualifier Condition + *668
 *  Generic Qualifier.  Synonyms: 'Condition', 'Context', 'Scale Qualifier'. */
export type QualifierDimension = 'time' | 'place' | 'event'

/** *666 Qualifier Condition — ONE named element within the bracket.
 *  E.g. `{ tag: 'Germany', classification: 'place', value: 'Germany' }` OR
 *  `{ tag: 'Q1.2026', classification: 'time', value: 'January-March 2026' }`. */
export interface PlanguageQualifier {
  /** 1-3 word Mnemonic Tag per Planguage Mnemonic ID Standard (r93hhh/iii). */
  tag: string
  /** Canonical classification per r93lll ASPECTS book. */
  classification: QualifierDimension
  /** The condition body (concrete value). */
  value: string
  /** Optional rationale for this qualifier. */
  rationale?: string
}

/** *124 Qualifier — bundle of conditions + corresponding scalar levels.
 *  A scalar spec (V., R., F. with measurable presence) can carry one or
 *  many of these.  AND-logic across conditions (per ASPECTS book + CE
 *  Glossary: *"In a qualifier [A, B, C], all three conditions must be true
 *  simultaneously."*).  r93kkk adds the CRITICAL flag for life-safety
 *  scenarios + extends the level inventory to the full 11 per ASPECTS book. */
export interface ConditionSet {
  /** Deterministic mnemonic id. */
  id: string
  /** 1-3 word Mnemonic tag naming this set (e.g. "EU.Premium.Q1"). */
  tag: string
  /** Life-and-death importance flag (r93kkk).  Example: [Cyberattack.Active]. */
  critical: boolean
  /** Ordered list of qualifiers — AND-logic combined. */
  qualifiers: PlanguageQualifier[]
  // ── Measurement levels (observed reality) ──
  past?:      string
  status?:    string
  trend?:     string
  // ── Commitment floor levels (must-have, ordered low → high) ──
  survival?:  string
  fail?:      string
  tolerable?: string
  // ── Commitment target levels (planned-to-reach) ──
  goal?:      string
  stretch?:   string
  // ── Aspirational levels (uncommitted) ──
  wish?:      string
  monster?:   string  // ASPECTS p.1343 — definition pending; reserved
  trigger?:   string  // ASPECTS p.1343 — definition pending; reserved
  // ── Metadata ──
  rationale?: string
  /** AI-source provenance (per Conjunction-of-Technologies SUPREME). */
  source?: 'derived-from-plan' | 'cited-from-gilb' | 'llm' | 'internet' | 'template' | 'user'
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
   * [When] Scale Parameter annotation (Tom Gilb, 2026-06-06 — SEA book, Scale Parameters chapter).
   * Benchmarks cannot "hang in unknown past" — every Status/Tolerable/Goal/Wish level
   * needs a date or event qualifier.  Free text accepted: "2027-Q1", "before EU AI Act
   * enforcement", "after MVP launch", "Q2 2026", "2026-03-15".
   * These mirror the SEA book's WWWWH Scale Parameter convention: [When] = time dimension.
   */
  statusWhen?: string
  tolerableWhen?: string
  goalWhen?: string
  wishWhen?: string
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
   * r41 v373 (Tom Gilb 2026-06-27 *"the add qualifiers stage does not offer
   * any process for doing that"*): canonical r93jjj+kkk+lll Qualifiers data
   * model.  Each Value entry can carry ONE or MANY ConditionSets — each set
   * bundles a list of Qualifiers (AND-logic, classification: time/place/event)
   * with corresponding scalar levels.  Empty/undefined means the Value still
   * sits in the Infinity Trap (r93mmm) and Stage 3.3 will fire to populate.
   * Legacy `statusWhen` / `tolerableWhen` / etc. fields preserved per
   * No-Silent-Removal SUPREME — readers prefer conditionSets when present.
   */
  conditionSets?: ConditionSet[]
  /**
   * Past — historical Status measurement, recorded before the current Status.
   * Shows the trajectory of improvement / degradation over time.
   * Tom Gilb: "Old Status is converted to Past before new Status is written."
   * Format: "[prior date, condition] prior value"
   * Source: Template_Write_Values.md FORMAT_17; Planguage Glossary Past *P02.
   */
  past?: string
  /** [When] qualifier for the Past level — when this historical measurement was taken. */
  pastWhen?: string
  /**
   * Stretch — the most ambitious target, beyond Goal.
   * A highly aspirational but seriously-intended committed level representing
   * exceptional success if achieved. In the commitment ladder:
   *   Status < Tolerable < Wish < Goal < Stretch
   * Tom Gilb 2026-06-09: explicit field for the full commitment ladder.
   * Source: Planguage commitment-level vocabulary; EVO 2024.
   */
  stretch?: string
  /** [When] qualifier for the Stretch level. */
  stretchWhen?: string
  /**
   * Forecast — projected future state of this value (distinct from Goal which is
   * the design target). Used in Model mode to record where the value is expected
   * to be at a future date without committing to a plan to get there.
   * Format mirrors status: "Forecast [date, condition] value"
   */
  forecast?: string
  /** Stakeholders relevant to this Value entry — comma-separated names */
  stakeholders?: string
  /** Who owns/is responsible for this spec entry — free text */
  specOwner?: string
  /** Why this entry is in the spec — the business justification */
  justification?: string
  /** Version / date-time stamp of this spec entry. Free text: "v1.2 · 2026-06-09" */
  version?: string
  /** Known risks or issues associated with this entry */
  risks?: string
  /**
   * Qualifier Conditions — the circumstances under which this Value's Scale applies.
   * If absent, the scale is universal (applies to all contexts).
   * See PentaConditions interface above for full documentation.
   * Tom Gilb 2026-06-09: primary use is Values (secondary: Resources).
   * COST SIGNAL: When conditions significantly constrain the value target,
   * solution costs may be 10× higher than unconstrained estimates.
   */
  conditions?: PentaConditions
  /** Per-field source attribution. Keys are field names ('scale', 'meter', 'goal', etc.).
   *  Stamped automatically by applyItemEdits() on every save, and by AI generation.
   *  Tom Gilb 2026-06-09: "Source attribution is fundamental to spec credibility and trust."
   */
  fieldSources?: Record<string, FieldSource>
  /** Entry-level provenance string — "<Generator> · <Plan> · <YYYY-MM-DD>". Stamped by
   *  every producer. Producer-side stamping rule (2026-06-20 sweep): no entry
   *  ships without `source`. */
  source?: string
  /** Provenance type for the entry-level `source` field. */
  sourceType?: 'human' | 'ai' | 'system'
}

/**
 * A single Solution (S.) entry in a Planguage spec block.
 *
 * ━━ SUPREME — Solution Parameters pinned 26-parameter canonical inventory ━━
 * Tom Gilb 2026-06-21 verbatim: *"Solution Parameters: I have brought this up before. … In all
 * specs, including solutions the Planguage statements are about a sentence for each parameter.
 * There are many possible parameters. Each parameter is defined in Planguage Glossary. … It is
 * time to pin this down. Examples: Derived From: [Values], Related To [Stakeholders], Spec Owner,
 * Implementation Responsible, Main Impacts, Risks, Side Effects, Cost Aspects, Related Values,
 * Alternative Solutions, Rejected Solutions, URLs Case Studies, Long Term Costs. Note many of
 * these are new compared to older templates, but they are useful now so build them into the SEM
 * Solution Template."*  Tom approval 2026-06-21: *"1. list is good enough"*.
 *
 * Three tiers (per memory/rule_solution_parameters.md):
 *   Tier 1 — REQUIRED at planning (Sharpen/PHI ship-blocker):
 *     id · type · level · status · description · derivedFrom · function · mainImpacts
 *   Tier 2 — RECOMMENDED at planning (Sharpen warning):
 *     relatedTo (synonym for stakeholders) · specOwner · implementationResponsible · risks ·
 *     sideEffects · costAspects (cf. impactsCosts) · longTermCosts · qualifiers
 *   Tier 3 — OPTIONAL (silent unless populated):
 *     alternativeSolutions · rejectedSolutions · urlsCaseStudies · prerequisites · assumptions ·
 *     constraints · structural · source · authority · priority · note
 *
 * ONE SENTENCE PER PARAMETER (≤25-word hard ceiling per Planguage Parameter Discipline SUPREME).
 * Long-form prose in any parameter field is BANNED. Description is the entity's distinguishing
 * identifier sentence — NOT the place to dump everything.
 *
 * Grounding: CE Ch.7 (Design Specification), ASPECTS § 6.2 (Design/Strategy/Architecture
 * Aspects), ASPECTS § 3.10 (18-parameter Strategy table), Glossary *047/*586/*830, vault
 * Template_Write_Solution.md.
 *
 * Migration: All new fields are OPTIONAL — existing SolutionEntries (Description/Impact/Function
 * only) continue to load and render. No silent data loss. Sharpen/PHI flags Tier-1 gaps as
 * defects rather than rejecting old saves.
 * ━━ END SUPREME ━━
 */
export interface SEntry {
  // ── Tier 1 — REQUIRED at planning ──
  /** Unique identifier, e.g. "S.MarkdownSerialiserSchema" — 1–3-word mnemonic (CE Ch.7 / Glossary *146). */
  id: string
  /** Always "Solution" (or sub-type: "Architecture" | "Algorithm" | "Process" | "Policy" | "Tool"). */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /** STATUS_LIFECYCLE_01: "NotProduction" (default) | "InProduction" (after working-as-intended gate). */
  status?: string
  /** ONE sentence (≤25 words) naming what the design idea IS — distinguishes from sibling solutions (Glossary *047). */
  description: string
  /** Wikilink array of Value entries this Solution intends to satisfy: "[[V.Tag1]], [[V.Tag2]]" (Tom 2026-06-21). */
  derivedFrom?: string
  /** Wikilink(s) to F. entries this solution creates or modifies */
  function: string
  /** Estimated % impact per Derived-From Value, e.g. "[[V.Latency]] +30%, [[V.Cost]] −15%" (ASPECTS § 6.2 Impact / CE Ch.9 IET). */
  mainImpacts?: string

  // ── Tier 2 — RECOMMENDED at planning ──
  /** Wikilink array of Stakeholders affected by or required for this Solution (Tom 2026-06-21). Synonym for `stakeholders` going forward. */
  relatedTo?: string
  /** Single named person/team accountable for BUILDING the Solution (ASPECTS § 3.10 "Main Leader Responsible"). */
  implementationResponsible?: string
  /** ONE sentence — unintended impacts on Values NOT in Derived From — positive synergies AND negative externalities (ASPECTS § 6.2 Impact). */
  sideEffects?: string
  /** Capital + operating + opportunity costs categorised: "CapEX €450k; Opex €120k/yr; Staff 4 FTE" (ASPECTS § 3.10 / CE Ch.6). */
  costAspects?: string
  /** Annual run-rate + maintenance + replacement horizon beyond initial deployment (ASPECTS § 3.10 "Annual Opex"). */
  longTermCosts?: string
  /** Planguage Qualifiers bounding scope: "[when=Q1.2026, where=EU.Region, who=Premium.Users]" (r93jjj SUPREME — Infinity-Trap protection). */
  qualifiers?: string

  // ── Tier 3 — OPTIONAL (populate when relevant) ──
  /** Wikilink array of sibling candidates CONSIDERED for the same Derived-From Values (Tom 2026-06-21). */
  alternativeSolutions?: string
  /** Wikilink array of sibling candidates EXAMINED and REJECTED, with one-line reason each: "[[S.Rej1]] (cost too high)" (Tom 2026-06-21). */
  rejectedSolutions?: string
  /** External refs: standards, case-study URLs, ADRs, papers — one short link per line (ASPECTS § 3.10 "URL for Strategy Detail"). */
  urlsCaseStudies?: string
  /** Wikilink array of other Solutions / Resources / Functions that MUST exist before this one (ASPECTS § 3.10). */
  prerequisites?: string
  /** ONE sentence — premises this Solution relies on that are NOT independently guaranteed (ASPECTS § 3.10 / CE Glossary). */
  assumptions?: string
  /** ONE sentence — limits/conditions THIS Solution itself must obey (regulatory, technical, schedule) (ASPECTS § 6.2 Constraint). */
  constraints?: string
  /** ONE sentence — internal construction / architecture style (microservices, monolith, batch, event-driven) (ASPECTS § 6.2 Structural). */
  structural?: string
  /** Decision-maker who APPROVED this Solution for the spec (ASPECTS § 6.2 Authority). */
  authority?: string
  /** Importance ranking for sequencing implementation: "Critical" | "High" | "Medium" | "Low" (ASPECTS § 6.2 Priority). */
  priority?: string
  /** ONE sentence each — caveats, observations, links to design history (ASPECTS § 6.2 Note). */
  note?: string

  // ── Legacy fields (kept for backward compatibility — NEVER removed per No-Silent-Removal SUPREME) ──
  /** LEGACY (kept for backward compatibility). Use `mainImpacts` going forward.
   *  Estimated impact on linked V. entries, e.g. "V.OutputCompleteness ~80%" */
  impact: string
  /** LEGACY (kept for backward compatibility). Use `mainImpacts` going forward.
   *  Impacts on Value entries (split from `impact`): e.g. "Search Latency ~+15%" */
  impactsValues?: string
  /** LEGACY (kept for backward compatibility). Use `costAspects` going forward.
   *  Impacts on cost / Resource entries: e.g. "R.Budget ~-8%, R.Timeline ~+3 days" */
  impactsCosts?: string
  /** LEGACY (kept for backward compatibility). Use `relatedTo` going forward.
   *  Stakeholders relevant to this Solution entry — comma-separated names */
  stakeholders?: string
  /** Who owns/is responsible for this spec entry — free text (canonical SpecOwner field, name preserved). */
  specOwner?: string
  /** Why this entry is in the spec — the business justification */
  justification?: string
  /** Version / date-time stamp of this spec entry. Free text: "v1.2 · 2026-06-09" */
  version?: string
  /** Known risks or issues associated with this entry — Tier 2 canonical (name preserved). */
  risks?: string
  /** Per-field source attribution. Keys are field names ('description', 'impact', etc.).
   *  Stamped automatically by applyItemEdits() on every save, and by AI generation.
   *  Tom Gilb 2026-06-09: "Source attribution is fundamental to spec credibility and trust."
   */
  fieldSources?: Record<string, FieldSource>
  /** Entry-level provenance string — "<Generator> · <Plan> · <YYYY-MM-DD>". Stamped by
   *  every producer. Producer-side stamping rule (2026-06-20 sweep): no entry
   *  ships without `source`. Tier 3 canonical Source parameter (name preserved). */
  source?: string
  /** Provenance type for the entry-level `source` field. */
  sourceType?: 'human' | 'ai' | 'system'
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
  /** Stakeholders relevant to this Constraint entry — comma-separated names */
  stakeholders?: string
  /** Who owns/is responsible for this spec entry — free text */
  specOwner?: string
  /** Why this entry is in the spec — the business justification */
  justification?: string
  /** Version / date-time stamp of this spec entry. Free text: "v1.2 · 2026-06-09" */
  version?: string
  /** Known risks or issues associated with this entry */
  risks?: string
  /** Per-field source attribution. Keys are field names ('description', 'scope', 'rationale', etc.).
   *  Stamped automatically by applyItemEdits() on every save, and by AI generation.
   *  Tom Gilb 2026-06-09: "Source attribution is fundamental to spec credibility and trust."
   */
  fieldSources?: Record<string, FieldSource>
  /** Provenance type for the entry-level `source` field. */
  sourceType?: 'human' | 'ai' | 'system'
}

/**
 * A single Resource (R.) entry in a Planguage spec block.
 *
 * Resources are the budgets and consumables a plan must respect — calendar
 * time, work hours, capital, scarce specialists, technical debt, etc.
 *
 * Phase 1 of the Resources stage beef-up (Tom Gilb, 2026-06-04):
 * canonical Planguage R. entry shape, modelled on V./F./S./C. siblings.
 *
 * Canonical source: `10.Standard/Standard.Kai-Zen/Template_Write_Resource.md`
 * + Gilb, Competitive Engineering (2005), Resource specification chapter.
 *
 * Examples:
 *   R.CalendarBudget : Scale = days from project start; Tolerable = 180; Goal = 120
 *   R.WorkHours.Backend : Scale = engineer-hours; Tolerable = 1200; Goal = 800
 *   R.Specialist.NavalArchitect : Scale = qualified architects available;
 *                                  Tolerable = 1; Goal = 2 (no-SPOF)
 */
export interface REntry {
  /** Unique identifier, e.g. "R.CalendarBudget", "R.WorkHours.Backend" */
  id: string
  /** Always "Resource" */
  type: string
  /** One of: Business, Stakeholder, Product, Solution, Evo, To-Do */
  level: string
  /** Plain-language description of the resource being budgeted */
  description: string
  /**
   * What is being measured and its unit.  Recommended: include Scale
   * Qualifiers [Who, Where, What, How] per CE Scale Qualifier chapter.
   * Example: "engineer-hours/year [Role = Chief Engineer, Where = port maintenance]".
   */
  scale: string
  /** How measurement is performed — Meter design discipline. */
  meter: string
  /** Current measured / projected state: "Status [date, condition] value" */
  status: string
  /** Tolerable consumption limit: "Tolerable [date, condition] value" */
  tolerable: string
  /**
   * Budget — the official allocated resource limit.
   *
   * Tom Gilb 2026-06-07: "A Budget is an Official stipulation of a financial
   * allocation for a purpose." Resources are constrained by Budget, not
   * "Goaled". Supersedes the old `goal` field for Resource entries.
   *
   * Backwards-compat read pattern: `r.budget ?? r.goal ?? ''`
   * Writers should emit `budget` for new specs.
   *
   * Specialised vocabulary (once `resourceKind` is set):
   *   - 'deadline'  → label as "Deadline" (calendar time resources)
   *   - 'headcount' → label as "Headcount" (people resources)
   *   - 'budget'    → label as "Budget" (money / generic)
   */
  budget?: string
  /**
   * r41 v373 (Tom Gilb 2026-06-27): canonical r93jjj+kkk+lll Qualifiers data
   * model for Resource entries — same shape + semantics as VEntry.conditionSets.
   * Resources are scalar by nature (engineer-hours, budget €, calendar days),
   * so every scalar level (Tolerable / Budget / Goal / Wish / etc.) benefits
   * from explicit Qualifiers escaping the Infinity Trap (r93mmm).
   */
  conditionSets?: ConditionSet[]
  /**
   * @deprecated Use `budget` instead.
   * Kept for backwards-compatibility with pre-2026-06-07 saved specs that
   * were generated using the old field name. Readers use `budget ?? goal`.
   * Will be removed in a future schema version once all stored specs have
   * been migrated via `useSpecMigration`.
   */
  goal: string
  /**
   * Ideal — the resource amount that would ideally be allocated to reach all
   * current Value Targets (Wishes and Goals), given the identified Solutions.
   *
   * Tom Gilb 2026-06-07: "The resource [that] would ideally allocate in order
   * to reach all current value Targets (wishes and goals), given the identified
   * solutions." Derived quantity — not a stakeholder aspiration (that is Wish)
   * and not an official allocation (that is Budget). Typically computed by
   * Claudian from the Value set + Solution set; not user-entered directly.
   *
   * When Ideal > Budget  → under-resourced (red signal).
   * When Ideal ≤ Budget  → budget is sufficient to reach Targets.
   *
   * Format mirrors status: "Ideal [date, condition] value"
   * Glossary proposal filed in Proposed-Updates-to-Kais-Standards.md
   * 2026-06-07: "Ideal (for Resources)".
   */
  ideal?: string
  /**
   * Resource kind — selects the specialised vocabulary for the Budget marker.
   *   'budget'    → "Budget"    (default, generic — money and any other resource)
   *   'deadline'  → "Deadline"  (calendar time resources)
   *   'headcount' → "Headcount" (people resources)
   *
   * Tom Gilb 2026-06-07: "Deadline is a good scalar parameter for Time
   * resources, and Headcount might be good for some cultures for people."
   * Omit or leave undefined to use "Budget" as the default label.
   */
  resourceKind?: 'budget' | 'deadline' | 'headcount'
  /**
   * Budget history — version history of official Budget allocations.
   * Entries are strings in the same format as `budget`, ordered oldest-first.
   * Tom Gilb 2026-06-07: "A Budget might have past versions which could be
   * recorded (a version history of official budgets)."
   * Format: ["Budget [2026-01-01] 500000", "Budget [2026-03-01] 450000"]
   */
  budgetHistory?: string[]
  /**
   * Wish — stakeholder aspiration for resource consumption before the official
   * Budget is set (or alongside it). Can be on either side of the Budget
   * number. Multiple stakeholders can hold different Wishes at different times.
   *
   * Tom Gilb 2026-06-07: "A wish level is a stakeholder desire or resources,
   * sometimes in advance of knowing the official allocated budget. There can
   * be a set of Wishes through time, even from different stakeholders. They
   * can be on either side of an official budget number, when it arrives. If
   * no stakeholder expresses a Wish, then none need be specified."
   *
   * Optional — if no stakeholder has expressed a Wish, leave undefined.
   */
  wish?: string
  /** Stakeholder who stated the Wish (free text, optional). */
  wishStakeholder?: string
  /**
   * Forecast — projected future state separate from Goal.  Used in Model
   * mode to record where the resource is expected to be at a future date
   * without committing to a plan to get there.  Format mirrors status.
   */
  forecast?: string
  /**
   * [When] Scale Parameter annotation — mirrors VEntry.*When fields.
   * Resource Benchmarks also cannot "hang in unknown past": when was this
   * Status measured? when does the Tolerable budget cap apply?
   * Free text: "2027-Q1", "end of Evo Step 3", "2026-06-30".
   */
  statusWhen?: string
  tolerableWhen?: string
  /** @deprecated Use `budgetWhen`. Kept for backwards-compat with pre-2026-06-07 specs. */
  goalWhen?: string
  /** [When] qualifier for the Budget level. */
  budgetWhen?: string
  wishWhen?: string
  /** [When] qualifier for the Ideal level. */
  idealWhen?: string
  /** Wikilink(s) to V. entries this resource enables. */
  resourceForValue?: string
  /** Wikilink(s) to S. entries that consume this resource. */
  consumedBy?: string
  /**
   * Current operational status — distinct from `status` (measurement).
   * 'available' = resource currently available
   * 'depleted'  = budget consumed, none remaining
   * 'partial'   = partially consumed
   * ''          = not assessed (default)
   */
  currentStatus?: 'available' | 'depleted' | 'partial' | ''
  /** Stakeholders relevant to this Resource entry — comma-separated names */
  stakeholders?: string
  /** Who owns/is responsible for this spec entry — free text */
  specOwner?: string
  /** Why this entry is in the spec — the business justification */
  justification?: string
  /** Version / date-time stamp of this spec entry. Free text: "v1.2 · 2026-06-09" */
  version?: string
  /** Known risks or issues associated with this entry */
  risks?: string
  /**
   * Qualifier Conditions — the circumstances under which this Resource's Scale applies.
   * Secondary use (primary is Values). If absent, the scale is universal.
   * See PentaConditions interface above for full documentation.
   */
  conditions?: PentaConditions
  /** Per-field source attribution. Keys are field names ('scale', 'meter', 'budget', etc.).
   *  Stamped automatically by applyItemEdits() on every save, and by AI generation.
   *  Tom Gilb 2026-06-09: "Source attribution is fundamental to spec credibility and trust."
   */
  fieldSources?: Record<string, FieldSource>
  /** Entry-level provenance string — "<Generator> · <Plan> · <YYYY-MM-DD>". Stamped by
   *  every producer. Producer-side stamping rule (2026-06-20 sweep). */
  source?: string
  /** Provenance type for the entry-level `source` field. */
  sourceType?: 'human' | 'ai' | 'system'
}

/**
 * A complete spec block containing all F., V., S., C., and R. entries.
 * This is the in-memory representation used by the pipeline, serialiser,
 * and all composables.
 *
 * `constraints` is optional for backwards-compatibility with pre-DD-006
 * saved specs — always use `spec.constraints ?? []` when reading.
 *
 * `resources` is optional for backwards-compatibility with pre-r77
 * saved specs (Tom Gilb 2026-06-04 — Phase 1 of Resources beef-up).
 * Always use `spec.resources ?? []` when reading.  Older specs in
 * localStorage will load without this field; every consumer must
 * tolerate undefined.
 */
export interface SpecBlock {
  functions: FEntry[]
  values: VEntry[]
  solutions: SEntry[]
  /** Binary Constraint entries (C.) — introduced DD-006. */
  constraints?: CEntry[]
  /** Resource entries (R.) — introduced Phase 1 of Resources beef-up r77. */
  resources?: REntry[]
  /**
   * Original stakes/stakeholders string captured at generation time.
   * Comma-separated list of stakeholder names from the SEMEntryForm parser
   * (e.g. "Patient, Nurse, Hospital Administration").
   * Stored so SDR and other views can display stakeholders even when the LLM
   * omits the `wishStakeholder` field on V. entries.
   * Optional for backwards-compat with specs generated before 2026-05-17.
   */
  stakes?: string
  /**
   * Structured Planguage stakeholder entries — one per distinct stakeholder.
   * Generated alongside V./F./S./C./R. entries by the LLM from 2026-06-09 onward.
   * Older specs fall back to the `specStakeholderCards` derived view (from V.wishStakeholder).
   * Use `spec.stakeholderEntries ?? []` — never assume presence.
   */
  stakeholderEntries?: StakeholderEntry[]
}

// ── Backwards-compat helpers ─────────────────────────────────────────────────

/**
 * Read the Budget level from an REntry with backwards-compat.
 *
 * Pre-2026-06-07 specs store the resource commitment level in `goal`.
 * Post-2026-06-07 specs use `budget`. This accessor handles both:
 *   - New specs: returns `r.budget`
 *   - Old specs: falls back to `r.goal`
 *   - Neither: returns `''`
 *
 * Tom Gilb 2026-06-07: "A Budget is an Official stipulation of a financial
 * allocation for a purpose." Resources are constrained by Budget, never Goaled.
 */
export function rBudget(r: REntry): string {
  return r.budget ?? r.goal ?? ''
}

/**
 * Return the canonical user-facing label for the Budget marker of an REntry.
 * Selects specialised vocabulary based on resourceKind:
 *   'deadline'  → "Deadline"  (time resources)
 *   'headcount' → "Headcount" (people resources)
 *   undefined / 'budget' → "Budget" (default, generic)
 *
 * Tom Gilb 2026-06-07 doctrine: use "Deadline" for calendar time, "Headcount"
 * for people. "Budget" is the generic term for all other resource limits.
 */
export function rBudgetLabel(r: REntry): string {
  if (r.resourceKind === 'deadline')  return 'Deadline'
  if (r.resourceKind === 'headcount') return 'Headcount'
  return 'Budget'
}
