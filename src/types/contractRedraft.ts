// UNIT_TYPE=Types
/**
 * contractRedraft.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Type definitions for the Contract Redraft feature (r41 v437+).
 *
 * Tom Gilb 2026-07-02 verbatim: *"An option to get the entire document
 * redrafted. We need to design this carefully to delight the navy brass and
 * their legal contract people."*
 *
 * Architecture goal: transform a signed or draft contract into an auditable
 * Planguage-precision artefact with a Contract Health Index, defect list,
 * correction traceability, and remaining-defect responsibility assignment.
 * Composes with:
 *   • Planguage Parameter Discipline SUPREME
 *   • Essential Contract Standard SUPREME (r41 v411)
 *   • MANDATORY STAKEHOLDER EXTRACTION SUPREME (r41 v427)
 *   • Spell-out-Type-Names SUPREME (no abbreviations in any label)
 *   • Solution Parameters SUPREME (26-parameter inventory for corrections)
 *   • No-Silent-Data-Loss SUPREME (safety locks + persistent settings)
 *   • Claude-Code-as-AI-Layer SUPREME (routes through claudeCodeAdapter)
 *
 * Twin-portable: no Vue reactivity, no browser APIs; pure plain-object types.
 */

// ── Standards + Policies ─────────────────────────────────────────────────────

/**
 * Standards that a contract can be redrafted against.  Each standard IS an
 * external, publicly-cited authority (as opposed to Policy which is
 * organisational).  Selection is multi-check; every selected standard's
 * rules feed the redraft prompt AND get cited in Appendix A5.
 */
export type StandardId =
  // Universal drafting-style
  | 'kenneth-adams-mscd'          // Kenneth Adams · A Manual of Style for Contract Drafting (industry gold-standard)
  | 'gilb-planguage'              // Tom Gilb · Planguage discipline
  | 'plain-writing-act-2010'      // US federal plain-language mandate
  // US federal contracting
  | 'far-part-52'                 // Federal Acquisition Regulation clauses
  | 'dfars-part-252'              // Defense FAR Supplement (DoD-specific)
  | 'mil-std-961e'                // DoD standard practice for defense specifications
  | 'mil-hdbk-245d'               // Statement of Work guidance
  // International construction
  | 'fidic-yellow'                // Design + build
  | 'fidic-red'                   // Construction
  | 'fidic-silver'                // EPC / turnkey
  // Professional bodies
  | 'aia-a201'                    // AIA General Conditions
  | 'unidroit-principles'         // UNIDROIT International Commercial Contracts
  | 'incoterms-2020'              // ICC International trade terms
  // Custom (user-added URL)
  | 'custom-url'

/** Human-facing label + short description for each Standard.  Used by
 *  the settings UI + Appendix A5 citations. */
export interface StandardDescriptor {
  id:            StandardId
  label:         string          // "Kenneth Adams · MSCD"
  shortLabel:    string          // "MSCD" for tight table cells
  category:      'style' | 'us-federal' | 'us-dod' | 'us-navy' | 'international' | 'professional' | 'custom'
  authorityUrl?: string          // Where a reviewer verifies the standard
  defaultOn:     boolean         // Ship default for a fresh contract
}

/**
 * Policies are ORGANISATIONAL rules — softer than external Standards.  Each
 * policy is a Planguage-precision assertion applied during redraft.  Policies
 * default to "essential contract standard" set (r41 v411 Tests 1-3).
 */
export type PolicyId =
  // Essential Contract Standard (r41 v411)
  | 'essential-presence-test'       // Every Function has a testable Presence Test
  | 'essential-scale-plus-target'   // Every Value has Scale + (Goal or Tolerable)
  | 'essential-stakeholder-named'   // Every party is a named Stakeholder (r41 v427)
  // Additional discipline
  | 'define-every-capitalised-term' // Every capitalised term defined in Appendix A1
  | 'cross-ref-via-mnemonic'        // Cross-references use Mnemonic Tag not number
  | 'no-unbounded-scope'            // Every measurable has Qualifiers (Infinity Trap)
  // Optional (default OFF)
  | 'symmetry-of-obligation'        // Every obligation on A has consideration from B
  | 'no-subjective-adjectives'      // Ban "reasonable/prompt/suitable/satisfactory"
  | 'custom-policy'                 // User-authored via Guidelines Library

export interface PolicyDescriptor {
  id:         PolicyId
  label:      string
  shortLabel: string
  defaultOn:  boolean
  /** Which SUPREME rule underlies this policy (for HoverHint audit trail). */
  underlyingRule?: string
}

// ── Structure choice ─────────────────────────────────────────────────────────

/**
 * Two redraft structures:
 *  - `current-redlined`: mirror original clause order + content; insert
 *    corrections inline as redlines (strikethrough old, insert new).
 *  - `planguage-restructured`: body mirrors original sequence, but every
 *    clause is numbered AND tagged with a Mnemonic Tag; capitalised terms
 *    rendered in Planguage Mnemonic style; appendices A1-A6 appended.
 */
export type StructureOption =
  | 'current-redlined'
  | 'planguage-restructured'

// ── Safety Locks ──────────────────────────────────────────────────────────────

/**
 * Redraft-forbidden zones.  Every lock generates a hard constraint in the
 * Sonnet prompt; violations trigger a reject in the pipeline.  Locks default
 * to ON — Navy legal + program-manager reassurance.
 */
export type SafetyLockId =
  | 'money-amounts'          // $ values, currency strings
  | 'dates-and-deadlines'    // ISO dates, "within 30 days", "by 1 July 1931"
  | 'quantities-and-specs'   // "10,000 tons", "32.5 knots", "12-inch guns"
  | 'named-parties'          // Party names (spelling normalisation OK)
  | 'signature-block'        // Signature lines untouched
  | 'governing-law'          // Jurisdiction + law
  | 'termination-triggers'   // Termination conditions (precision OK, substance not)
  | 'section-titles'         // Original section titles preserved (opt-in to rename for Planguage structure)

export interface SafetyLockDescriptor {
  id:        SafetyLockId
  label:     string
  hoverHint: string
  defaultOn: boolean
}

// ── Autonomy Level ───────────────────────────────────────────────────────────

export type AutonomyLevel =
  | 'advisory'         // Flag defects + suggest corrections; no rewrite
  | 'suggested'        // Rewrites proposed inline; user accepts/rejects per correction
  | 'full-redraft'     // Apply all suggested corrections + generate full A1-A6 appendix

// ── Contract Health Index (CHI) ──────────────────────────────────────────────

/**
 * The single-number quality metric for a contract.  Composed of six weighted
 * dimensions.  Total range 0-100.  Colour bands: 90+ green, 70-89 amber,
 * <70 red.  Analog of Plan Health Indicator (PHI) in the SEM Plan side.
 */
export interface ContractHealthIndex {
  score:      number                        // 0-100, renormalized over measurable dimensions
  colourBand: 'green' | 'amber' | 'red'
  breakdown:  ContractHealthDimension[]
  /** Sum of `maxScore` across dimensions that HAD something to measure
   *  (denominator > 0).  When `availableMax < 100`, `score` is renormalized
   *  to /100 over just those dimensions — so a contract with 0 Function
   *  entries no longer silently gets full Precision credit.  r41 v439 fix. */
  availableMax:      number
  /** Sum of `maxScore` across dimensions marked `measurable=false`
   *  (N/A because the denominator was 0).  UI surfaces this next to the
   *  headline so the planner sees WHY CHI is measured over less than 100. */
  skippedMax:        number
  /** Prior CHI score if this is a re-redraft.  UI shows delta. */
  parentScore?:      number
  parentContractId?: string
  computedAt:  string                        // ISO datetime
  /** Version of the CHI algorithm (bumps invalidate historical comparability). */
  algorithmVersion: 1
}

/** r41 v459 (Tom Gilb 2026-07-02 verbatim *"scores look too simple"*) —
 *  drill-down entry snapshot embedded in each dimension so the
 *  Contract Health Score dashboard can expand a row and show WHICH
 *  entries are pulling the score down, without needing to cross-look-up
 *  the source contract at render time.  Composes with the audience-
 *  declaration rule (a Vice Admiral clicks a bar → sees specific
 *  actionable items, not just an aggregate number). */
export interface ContractHealthOffendingEntry {
  id:           string
  tag:          string
  party?:       string
  description:  string      // first ~120 chars — enough for at-a-glance recognition
  reason?:      string      // dimension-specific why this entry offends ("blank Presence Test", "Scale is 'TBD'", ...)
}

export interface ContractHealthDimension {
  id:          ContractHealthDimensionId
  label:       string
  score:       number                        // 0..maxScore
  maxScore:    number
  detail:      string                        // "26 of 30 Function entries have testable Presence Test"
  /** True when this dimension had a non-zero denominator (something to
   *  measure).  When false, `score` is 0 and this dimension is EXCLUDED
   *  from CHI aggregation (renormalized), NOT silently awarded full
   *  credit.  The UI renders non-measurable dimensions as "— / N · Not
   *  measurable" instead of a full green bar.  r41 v439 fix — see
   *  r93mmm Infinity Trap: unmeasurable is never "perfect". */
  measurable:  boolean
  /** Optional counter-example entries that pulled the score down.
   *  Legacy field — v459 introduces the richer `offendingEntries`. */
  offendingEntryIds?: string[]
  /** r41 v459 — up to 5 offending entry snapshots for the drill-down. */
  offendingEntries?: ContractHealthOffendingEntry[]
  /** r41 v459 — one-sentence recommendation naming the specific action
   *  a Contract officer can take to raise this dimension's score.  Only
   *  populated when the dimension is Measurable AND the score is below
   *  maxScore (a perfect score needs no recommendation). */
  recommendation?: string
}

export type ContractHealthDimensionId =
  | 'precision'                 // Function entries with testable Presence Tests
  | 'measurement'               // Value entries with Scale + Goal|Tolerable
  | 'stakeholder-coverage'      // Distinct stakeholder categories present
  | 'bounded-scope'             // Values with Qualifiers (Anti-Infinity-Trap)
  | 'standards-conformance'     // 100 - (violations / total × 100)
  | 'structural-completeness'   // Appendices A1-A6 populated

// ── Correction (Appendix A5) ─────────────────────────────────────────────────

/**
 * One correction applied during redraft.  Every correction is auditable:
 * the reviewer can trace what changed, why, and against which authority.
 */
export interface RedraftCorrection {
  id:                   string
  /** Clause the correction lives in (mnemonic tag preferred). */
  clauseTag:            string
  /** Original spec text, verbatim (character-for-character). */
  before:               string
  /** Redraft spec text. */
  after:                string
  /** Plain-English reason for the correction, ≤ 40 words. */
  reason:               string
  /** Which Standard or Policy authorises this correction. */
  citedStandards:       StandardId[]
  citedPolicies:        PolicyId[]
  /** Optional additional correction candidates the reviewer can pick from. */
  alternativeOptions?:  string[]
  /** Which defect classification (from ambiguity + standards-violation taxonomy). */
  defectClass:          RedraftDefectClass
  /** Auto-generated correction confidence — high/medium/low per Sonnet's
   *  own assessment of how precise the rewrite is. */
  confidence:           'high' | 'medium' | 'low'
}

export type RedraftDefectClass =
  | 'ambiguous-scope'
  | 'undefined-term'
  | 'missing-presence-test'
  | 'missing-scale'
  | 'missing-target-or-tolerable'
  | 'missing-stakeholder'
  | 'unbounded-scope'
  | 'stylistic-non-compliance'
  | 'cross-reference-broken'
  | 'subjective-adjective'
  | 'redundant-language'

// ── Remaining Defect (Appendix A6) ───────────────────────────────────────────

/**
 * Defects the redraft could NOT resolve automatically (e.g. missing TBD
 * specs, ambiguities that require human decision).  Every remaining defect
 * carries responsibility assignment so it doesn't sit in the report as
 * unactionable observation.
 */
export interface RedraftRemainingDefect {
  id:                   string
  clauseTag:            string
  /** The actual spec statement as it currently reads. */
  specStatement:        string
  /** Which Rule/Policy is violated. */
  ruleViolated:         string
  citedStandards:       StandardId[]
  citedPolicies:        PolicyId[]
  /** Seriousness — S1 (critical, blocks execution) to S5 (cosmetic). */
  seriousness:          1 | 2 | 3 | 4 | 5
  /** Named role responsible for FIXING (not a person — a role: "Drafting
   *  Attorney", "Program Manager", "Subject Matter Expert", "Contracting
   *  Officer", "Contractor's Technical Rep", etc.). */
  roleToFix:            string
  /** Named role responsible for APPROVING the fix (typically senior:
   *  "Reviewing Partner", "Head of Contracts", "Contracting Officer's
   *  Superior", "Program Executive Officer"). */
  roleToApprove:        string
  /** Sonnet's best guess at the probable root cause (drafting oversight,
   *  copy-paste from prior contract, unresolved negotiation trade-off, etc.). */
  probableRootCause:    string
  /** Free-text notes from the redraft agent. */
  notes?:               string
}

// ── Appendices ───────────────────────────────────────────────────────────────

export interface RedraftGlossaryEntry {
  term:               string
  definition:         string
  /** Where the term is defined — clause tag, standard citation, or "auto-derived". */
  source:             string
  /** Which body clauses use this term. */
  citedIn:            string[]
}

export interface RedraftPolicyReference {
  policyId:            PolicyId
  policyLabel:         string
  version:             string
  effectiveDate?:      string   // ISO
  /** Body clauses that cite this policy. */
  citedIn:             string[]
}

export interface RedraftRelatedDocument {
  title:               string
  documentType:        'schedule' | 'exhibit' | 'sow' | 'did' | 'cdrl' | 'appendix' | 'standard' | 'policy' | 'statute' | 'public-law' | 'other' | 'graphmetrix-node'
  /** Body clauses that reference this document. */
  referencedIn:        string[]
  /** Optional external URL — MUST be Reachable-Now per the Term +
   *  Definition + Source SUPREME rule (2026-07-02 v460).  If the URL is
   *  not verifiable, leave absent and use `note` instead. */
  externalUrl?:        string
  /** r41 v460 — plain-English sentence naming WHY this is cited and
   *  WHERE a reader would find it.  Used when externalUrl is absent
   *  because the Source is verifiable but not URL-addressable (a book,
   *  a physical file, a statute citation). */
  note?:               string
  /** DEPRECATED r41 v460 — Graphmetrix is not yet deployed; do not
   *  populate these fields until GMX resolution is proved end-to-end
   *  (Term + Definition + Source SUPREME rule: Sources must be
   *  Reachable-Now).  Retained on the type for import-compat with older
   *  Backup files; the renderer + prompt no longer emit or consume. */
  graphmetrixUri?:     string
  graphmetrixNodeType?: string
}

// ── Redraft Result ───────────────────────────────────────────────────────────

/**
 * The complete redraft artefact.  Structured for both Word/PDF export and
 * an in-app RedraftPanel with side-by-side + tabbed appendix views.
 */
export interface ContractRedraftResult {
  id:                   string
  contractId:           string
  contractTitle:        string
  generatedAt:          string        // ISO
  settings:             ContractRedraftSettings
  structure:            StructureOption
  /** Redrafted body — HTML with redline markup for `current-redlined` mode,
   *  or a Planguage-structured tree for `planguage-restructured` mode. */
  bodyHtml:             string
  /** Plain-text fallback of the body. */
  bodyPlainText:        string
  /** A1 — capitalised terms + definitions + sources. */
  glossary:             RedraftGlossaryEntry[]
  /** A2 — policies referenced. */
  policyReferences:     RedraftPolicyReference[]
  /** A3 — related documents. */
  relatedDocuments:     RedraftRelatedDocument[]
  /** A4 — Contract Health Index. */
  contractHealthIndex:  ContractHealthIndex
  /** A5 — corrections applied. */
  corrections:          RedraftCorrection[]
  /** A6 — remaining defects. */
  remainingDefects:     RedraftRemainingDefect[]
  /** Optional narrative summary written by the redraft agent. */
  executiveSummary?:    string
  /** Redraft-time cost / model info for audit. */
  audit: {
    agent:            'contract-redraft'
    modelUsed:        string        // e.g. 'claude-opus-4-7' or 'claude-sonnet-4-6'
    durationSeconds:  number
    autonomyLevel:    AutonomyLevel
    /** Every safety-lock that was engaged (informational; never off in practice). */
    safetyLocksEngaged: SafetyLockId[]
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * User-editable settings that drive every redraft.  Persisted to
 * localStorage per Universal Undo SUPREME (reversible on next redraft).
 * Defaults chosen for Navy / DoD contracting; opt-out via UI.
 */
export interface ContractRedraftSettings {
  standards:      StandardId[]
  customStandardsUrls: string[]         // Extends `custom-url` slot
  policies:       PolicyId[]
  customPolicies: string[]              // Free-text one-liners
  structure:      StructureOption
  safetyLocks:    SafetyLockId[]
  autonomy:       AutonomyLevel
  /** CHI dimension weights — expert users can rebalance the score. */
  chiWeights: Record<ContractHealthDimensionId, number>
  /** When the user first accepted the defaults (used to detect stale
   *  settings after a SUPREME rule change). */
  createdAt:      string
  updatedAt:      string
  schemaVersion:  1
}

/** Ship-safe defaults.  Chosen for Navy / DoD contract work. */
export const DEFAULT_REDRAFT_SETTINGS: ContractRedraftSettings = {
  standards: [
    'kenneth-adams-mscd',
    'gilb-planguage',
    'plain-writing-act-2010',
  ],
  customStandardsUrls: [],
  policies: [
    'essential-presence-test',
    'essential-scale-plus-target',
    'essential-stakeholder-named',
    'define-every-capitalised-term',
    'cross-ref-via-mnemonic',
    'no-unbounded-scope',
  ],
  customPolicies: [],
  structure: 'current-redlined',
  safetyLocks: [
    'money-amounts',
    'dates-and-deadlines',
    'quantities-and-specs',
    'named-parties',
    'signature-block',
    'governing-law',
    'termination-triggers',
    'section-titles',
  ],
  autonomy: 'suggested',
  chiWeights: {
    'precision':                25,
    'measurement':              25,
    'stakeholder-coverage':     15,
    'bounded-scope':            15,
    'standards-conformance':    10,
    'structural-completeness':  10,
  },
  createdAt:     new Date().toISOString(),
  updatedAt:     new Date().toISOString(),
  schemaVersion: 1,
}

// ── Registries — human-facing labels + descriptions ──────────────────────────

/**
 * All Standards registered with the redraft engine.  Extend this list to add
 * new standards; nothing else needs updating (settings UI, prompt, and A5
 * citation all read from here).
 */
export const REDRAFT_STANDARDS: StandardDescriptor[] = [
  { id: 'kenneth-adams-mscd',       label: 'Kenneth Adams · A Manual of Style for Contract Drafting',   shortLabel: 'MSCD',            category: 'style',         authorityUrl: 'https://www.adamsdrafting.com', defaultOn: true  },
  { id: 'gilb-planguage',           label: 'Tom Gilb · Planguage discipline',                            shortLabel: 'Planguage',       category: 'style',         authorityUrl: 'https://www.gilb.com',           defaultOn: true  },
  { id: 'plain-writing-act-2010',   label: 'US Plain Writing Act 2010',                                  shortLabel: 'Plain Writing',   category: 'us-federal',    authorityUrl: 'https://plainlanguage.gov',      defaultOn: true  },
  { id: 'far-part-52',              label: 'FAR Part 52 — Federal Acquisition Regulation clauses',       shortLabel: 'FAR 52',          category: 'us-federal',    defaultOn: false },
  { id: 'dfars-part-252',           label: 'DFARS Part 252 — Defense FAR Supplement clauses',            shortLabel: 'DFARS 252',       category: 'us-dod',        defaultOn: false },
  { id: 'mil-std-961e',             label: 'MIL-STD-961E — DoD Standard Practice for Defense Specifications', shortLabel: 'MIL-STD-961E', category: 'us-dod',    defaultOn: false },
  { id: 'mil-hdbk-245d',            label: 'MIL-HDBK-245D — Statement of Work Guidance',                  shortLabel: 'MIL-HDBK-245D',  category: 'us-dod',        defaultOn: false },
  // ── US Navy — added r41 v471 for Vice Admiral Mark demo (Tom Gilb 2026-07-03 "no navy standards"). ──
  { id: 'nmcars',                   label: 'NMCARS — Navy Marine Corps Acquisition Regulation Supplement', shortLabel: 'NMCARS',          category: 'us-navy',       authorityUrl: 'https://www.secnav.navy.mil/rda/DASN%20AP/Pages/NMCARS.aspx', defaultOn: false },
  { id: 'secnavinst-5000-2',        label: 'SECNAVINST 5000.2 — Navy System Acquisition Policy',           shortLabel: 'SECNAVINST 5000.2', category: 'us-navy',     authorityUrl: 'https://www.secnav.navy.mil/doni/',                            defaultOn: false },
  { id: 'navsea-standard-items',    label: 'NAVSEA Standard Items — Ship-Repair Contract Standard Items',  shortLabel: 'NAVSEA SI',       category: 'us-navy',       authorityUrl: 'https://www.navsea.navy.mil',                                  defaultOn: false },
  { id: 'navsup-p485',              label: 'NAVSUP P-485 — Naval Supply Procedures',                       shortLabel: 'NAVSUP P-485',    category: 'us-navy',       authorityUrl: 'https://www.navsup.navy.mil',                                  defaultOn: false },
  { id: 'fidic-yellow',             label: 'FIDIC Yellow Book — Design + Build',                          shortLabel: 'FIDIC Yellow',   category: 'international', defaultOn: false },
  { id: 'fidic-red',                label: 'FIDIC Red Book — Construction',                               shortLabel: 'FIDIC Red',      category: 'international', defaultOn: false },
  { id: 'fidic-silver',             label: 'FIDIC Silver Book — EPC / Turnkey',                           shortLabel: 'FIDIC Silver',   category: 'international', defaultOn: false },
  { id: 'aia-a201',                 label: 'AIA A201 — General Conditions of the Contract for Construction', shortLabel: 'AIA A201',    category: 'professional',  defaultOn: false },
  { id: 'unidroit-principles',      label: 'UNIDROIT Principles of International Commercial Contracts',   shortLabel: 'UNIDROIT',       category: 'professional',  defaultOn: false },
  { id: 'incoterms-2020',           label: 'ICC Incoterms 2020',                                          shortLabel: 'Incoterms 2020', category: 'international', defaultOn: false },
  { id: 'custom-url',               label: 'Custom URL(s) — user-supplied standards',                     shortLabel: 'Custom',         category: 'custom',        defaultOn: false },
]

export const REDRAFT_POLICIES: PolicyDescriptor[] = [
  { id: 'essential-presence-test',       label: 'Every Function has a testable Presence Test',                     shortLabel: 'Presence Test',     defaultOn: true,  underlyingRule: 'Essential Contract Standard SUPREME (r41 v411 Test 1)' },
  { id: 'essential-scale-plus-target',   label: 'Every Value has Scale + (Goal or Tolerable)',                     shortLabel: 'Scale + Target',    defaultOn: true,  underlyingRule: 'Essential Contract Standard SUPREME (r41 v411 Test 3)' },
  { id: 'essential-stakeholder-named',   label: 'Every party is a named Stakeholder',                              shortLabel: 'Stakeholders Named', defaultOn: true,  underlyingRule: 'MANDATORY STAKEHOLDER EXTRACTION SUPREME (r41 v427)' },
  { id: 'define-every-capitalised-term', label: 'Every capitalised term is defined in Appendix A1 Glossary',       shortLabel: 'Define Terms',      defaultOn: true },
  { id: 'cross-ref-via-mnemonic',        label: 'Cross-references use Mnemonic Tag (not article number alone)',    shortLabel: 'Mnemonic Cross-refs', defaultOn: true,  underlyingRule: 'Planguage Mnemonic ID Standard SUPREME' },
  { id: 'no-unbounded-scope',            label: 'No unbounded scope — every measurable has Qualifiers',            shortLabel: 'Bounded Scope',     defaultOn: true,  underlyingRule: 'Infinity Trap SUPREME (r93mmm)' },
  { id: 'symmetry-of-obligation',        label: 'Every obligation on Party A has matching consideration from B',   shortLabel: 'Symmetry',          defaultOn: false },
  { id: 'no-subjective-adjectives',      label: 'Flag "reasonable / prompt / suitable / satisfactory"',            shortLabel: 'No Subjectives',    defaultOn: false },
  { id: 'custom-policy',                 label: 'Custom policies (from Guidelines Library)',                       shortLabel: 'Custom',            defaultOn: false },
]

export const REDRAFT_SAFETY_LOCKS: SafetyLockDescriptor[] = [
  { id: 'money-amounts',        label: 'Money amounts',       hoverHint: 'Never modify $ values or currency (e.g. "$275,000", "£50,000").', defaultOn: true },
  { id: 'dates-and-deadlines',  label: 'Dates and deadlines', hoverHint: 'Never modify ISO dates or relative deadlines (e.g. "15 August 1929", "within 30 days").', defaultOn: true },
  { id: 'quantities-and-specs', label: 'Quantities and technical specs', hoverHint: 'Never modify quantities or numeric specs (e.g. "10,000 tons", "32.5 knots", "12-inch guns").', defaultOn: true },
  { id: 'named-parties',        label: 'Named parties',       hoverHint: 'Never modify party identity; spelling normalisation is OK.', defaultOn: true },
  { id: 'signature-block',      label: 'Signature block',     hoverHint: 'Signature lines and witness clauses left untouched.', defaultOn: true },
  { id: 'governing-law',        label: 'Governing law',       hoverHint: 'Jurisdiction + governing-law clauses left untouched.', defaultOn: true },
  { id: 'termination-triggers', label: 'Termination triggers', hoverHint: 'Termination conditions: precision improvements OK, substantive changes forbidden.', defaultOn: true },
  { id: 'section-titles',       label: 'Section titles',      hoverHint: 'Original section titles preserved; opt-in to rename for Planguage-structure mode.', defaultOn: true },
]
