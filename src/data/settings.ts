// UNIT_TYPE=Data
//
// settings.ts — SEM App user-settings schema + defaults + storage key.
//
// SOURCE (Tom Gilb 2026-06-03 verbatim):
//   *"I long ago requested and never saw a SEM settings Panel. Can you draft
//     one and put all the useful ideas in you can think about, and ten let me
//     list some: Setting: Ultra Light, or Pro SEM, Default Pro Sem.
//     Settings: collect maximum feedback data from use of this app, Do not
//     collect any feedback data"*
//
//   *"This is a universal design from me and for SEM: Maximize AI assistance
//     everywhere... WE want impressive help, not simplified ai access."*
//
// Architecture:
//   - Pure-data schema (twin-portable, no Vue coupling)
//   - All settings have safe defaults; missing fields backfilled on read
//   - localStorage persistence (single JSON blob keyed by SETTINGS_STORAGE_KEY)
//   - useSettings.ts composable reads/writes; SettingsPanel.vue renders
//   - Components opt-in to consume settings as they are wired (incremental rollout)
//
// v1 ships: the schema + the panel UI + persistence.  Consumption by other
// components is incremental — each setting becomes "live" as the relevant
// component is updated to read it.  This avoids a massive risky cross-file
// change in one commit.

// ── Setting value types ──────────────────────────────────────────────────────

/** Tom's flagship mode: Ultra Light (minimal UI, fewer options) vs Pro SEM
 *  (full toolkit, every panel + every Evo Tool + every audit trail).
 *  Default Pro SEM per Tom's 2026-06-03 directive. */
export type AppMode = 'ultra-light' | 'pro-sem'

/** AI Max principle level.  Default Maximum.  Off and Standard are for users
 *  who explicitly want to dial AI down (rare; included for completeness). */
export type AIAssistanceLevel = 'off' | 'standard' | 'maximum'

/** Telemetry: how much usage data to collect for product improvement.
 *  Tom's two named options: max collect / none.  Standard is the middle ground. */
export type TelemetryLevel = 'none' | 'standard' | 'maximum'

/** Default Evo cycle length applied to new plans.  Overridable per-plan
 *  via EvoCycleLengthPicker. */
export type DefaultCycleLength = 'day' | 'week' | 'month' | 'quarter'

/** Default selection mode for Sharp Interview answers (per question).
 *  Matches the SelectionMode in useEvoSharpAnswers but exported here as the
 *  default-per-new-question. */
export type DefaultSharpSelectionMode = 'mixed' | 'all' | 'typed-only' | 'ticked-only'

/** Theme — light / dark / auto-follow-system. */
export type Theme = 'light' | 'dark' | 'auto'

/** Visual density — for tables / lists / panels. */
export type Density = 'compact' | 'comfortable' | 'spacious'

/** Animation level — full / reduced (respects prefers-reduced-motion) / none. */
export type AnimationLevel = 'full' | 'reduced' | 'none'

/** Export format default. */
export type ExportFormat = 'html' | 'markdown' | 'json' | 'tsv'

// ── Strategy Mode terminology overrides ─────────────────────────────────────

/**
 * Strategy Mode display-term overrides.
 * Tom Gilb 2026-06-09: "Purpose: to tune SEM to the needs and culture of
 * organizational strategic planning."
 *
 * Display-only — the underlying Planguage data model never changes (Twin-portable).
 * Primary Gilb texts: Strategy-Ring, Value Improvement.
 */
// ── Model Mode types (Tom Gilb 2026-06-16 — RICH 4-AXIS DESIGN) ──────────────
//
// Tom Gilb 2026-06-16 verbatim: *"MODEL MODE SETTINGS, (IN MAIN SETTINGS)
// SUGGESTIONS. 1. Model Domain: Organization, Product, Building, Abstract
// (language, process, method, policy, contract, Plan). 2. Model Presentation:
// Planguage, Diagram, 3d, Colorful, Black/White, Slide Deck Presentation,
// Paper, Booklet. 3. Model Analytics: Conformance to Standards (Planguage,
// Elon, Incorruptible, URLs of Any Standards, (search for additional
// standards)), 4. Model Purpose: (complex system maintenance, academic
// research and presentation, management decision-making, managing supply
// chain and suppliers, ADD MORE)"*

/** AXIS 1 — Model Domain.  What SUBJECT the model describes. */
export type ModelDomain =
  | 'organization'
  | 'product'
  | 'building'
  | 'abstract-language'
  | 'abstract-process'
  | 'abstract-method'
  | 'abstract-policy'
  | 'abstract-contract'
  | 'abstract-plan'

/** AXIS 2 — Model Presentation.  HOW the model is rendered + exported. */
export type ModelPresentation =
  | 'planguage'
  | 'diagram'
  | '3d'
  | 'colorful'
  | 'black-white'
  | 'slide-deck'
  | 'paper'
  | 'booklet'

/** AXIS 3 — Model Standards.  Conformance frameworks the model is checked against. */
export type ModelStandardId =
  | 'planguage'
  | 'elon'
  | 'incorruptible'

/** AXIS 4 — Model Purpose.  WHY the model exists.  Multi-pick. */
export type ModelPurpose =
  | 'complex-system-maintenance'
  | 'academic-research-presentation'
  | 'management-decision-making'
  | 'supply-chain-management'
  | 'organizational-design'
  | 'product-development'
  | 'risk-assessment'
  | 'compliance-audit'
  | 'training-education'
  | 'innovation-roadmap'

export interface ModelModeConfig {
  /** 1. Subject domain — single pick. */
  domain: ModelDomain
  /** 2. Presentation format — single pick. */
  presentation: ModelPresentation
  /** 3a. Built-in standards multi-select. */
  standards: ModelStandardId[]
  /** 3b. Custom standard URLs the user pastes. */
  standardsCustomUrls: string[]
  /** 3c. When true, AI actively searches the internet for additional relevant
   *  standards beyond those explicitly listed.  Composes the Conjunction-of-
   *  Technologies SUPREME rule (Plan + Gilb corpus + LLM + Internet). */
  searchForAdditionalStandards: boolean
  /** 4. Purpose multi-pick — composes any combination. */
  purposes: ModelPurpose[]
}

// ── Contracts Mode types (Tom Gilb 2026-06-16) ───────────────────────────────

/** Audience profile — shapes the LLM's tone, vocabulary depth, citation style. */
export type ContractsPresentation = 'legal-experts' | 'managers' | 'technical-experts'

/** What the analysis should DO with the contract.  Multi-pick — any combination
 *  composes (e.g. "Strictly Analytical" + "Give log of all changes" = analysis
 *  plus a structured diff log). */
export type ContractsPurpose =
  | 'rewrite'              // Re-write the contract in the chosen presentation
  | 'change-log'           // Emit a structured log of every change the AI made
  | 'strict-analytical'    // Analyze only — surface issues, do not modify
  | 'creative-suggestions' // Propose changes, appendices, other documents, negotiating tactics

/** Built-in standards catalogue (multi-select).  Custom URLs are kept in a
 *  parallel array — the parser sends BOTH lists to the LLM as ground-truth
 *  references the contract should conform to. */
export type ContractsStandardId =
  | 'gilb-planguage'   // Tom Gilb's Planguage methodology (default on)
  | 'plain-english'    // Plain English contract style — no archaic clauses
  | 'iso-9001'         // Quality Management Systems
  | 'iso-27001'        // Information Security
  | 'gdpr'             // EU General Data Protection Regulation
  | 'sox'              // Sarbanes-Oxley (US accounting controls)
  | 'incoterms-2020'   // International commercial trade terms (ICC)
  | 'unidroit'         // UNIDROIT Principles of International Commercial Contracts
  | 'common-law'       // Common-law jurisdictional framing
  | 'civil-law'        // Civil-law jurisdictional framing
  | 'hipaa'            // US Health Insurance Portability + Accountability Act

export interface ContractsModeConfig {
  /** 1. Apply Contract Sharpening — when true, every parsed clause runs
   *  through the same Planguage Sharpening pipeline used for specs (Tolerable
   *  / Goal / Wish + Scale + Meter inference, ambiguity flagging). */
  applyContractSharpening: boolean

  /** 2a. Built-in standards multi-select. */
  standards: ContractsStandardId[]

  /** 2b. Custom URLs (one or several) the user pastes — references / external
   *  standards / company policies / authority documents.  Sent as additional
   *  ground-truth context to the LLM alongside the built-in standards. */
  standardsCustomUrls: string[]

  /** 3. Presentation — single audience choice. */
  presentation: ContractsPresentation

  /** 4. Purpose — multi-pick.  Any combination composes. */
  purposes: ContractsPurpose[]
}

export interface StrategyTerminology {
  /** "Value" singular  → e.g. "Strategic Objective" */
  valueTerm: string
  /** "Values" plural   → e.g. "Strategic Objectives" */
  valuesTermPlural: string
  /** "Solution" singular → e.g. "Strategy" */
  solutionTerm: string
  /** "Solutions" / Design-sector plural → e.g. "Strategies" */
  solutionsTermPlural: string
  /** "Evo Step" singular → e.g. "Strategic Value Delivery Increment" */
  evoStepTerm: string
  /** "Evo Steps" plural → e.g. "Strategic Value Delivery Increments" */
  evoStepsTermPlural: string
  /** Evo Feedback Measures singular → e.g. "Strategic Results" */
  evoFeedbackTerm: string
  /** Owner role label  → e.g. "Strategy Responsible" */
  ownerRoleTerm: string
  /** Planner role label → e.g. "Strategy Planner" */
  plannerRoleTerm: string
  /** Scribe role label  → e.g. "Results Responsible" (new Steward type per Tom 2026-06-09) */
  scribeRoleTerm: string
}

// ── The whole settings schema ────────────────────────────────────────────────

/** Spec export format — Tom Gilb 2026-06-16 verbatim: *"You could offer a
 *  choice of formats: Default: exactly as in the display, 2 A Condensed
 *  Summary (without supporting details like sources and justifications),
 *  3. A Table format with each spec on a line.  If no choice is made the
 *  default is 1, as in display."*  Mirrors SpecExportMode in
 *  useColorfulSpecHtml.ts. */
export type SpecExportFormat = 'full' | 'condensed' | 'table'

/** Stage 1 workflow mode — Tom Gilb 2026-06-24 verbatim: *"in Settings, for
 *  Stage 1 (we need settings for each stage) option 'Go from Source Input,
 *  directly to Generation of Planguage Specs', (This skips the Implied Specs
 *  stage). Option 2 'After Generation of Planguage Specs, run an 'Implied
 *  Specs Options' (Stage 1.3, I think) and generate additional Planguage
 *  specs as a possible result."*
 *
 *  Three workflow choices for Stage 1 sub-step ordering:
 *
 *  'default-implied-before-generate'
 *    Canonical (current default).  1.1 Capture → 1.2 Parse → 1.3 Add Implied
 *    Optional → 1.4 Generate Planguage Spec → 1.5 Edit & Refine.
 *    Implied entries are reviewed BEFORE the full Planguage generation.
 *
 *  'skip-implied'
 *    Skip 1.3 entirely.  1.1 → 1.2 → 1.4 → 1.5.
 *    Fastest path — no implied-entry review.  Tom verbatim: "Go from Source
 *    Input, directly to Generation of Planguage Specs".
 *
 *  'implied-after-generate'
 *    Move 1.3 to AFTER 1.4.  1.1 → 1.2 → 1.4 → 1.3 → 1.5.
 *    AI generates the Planguage Spec first; THEN the Implied Specs Options
 *    panel proposes ADDITIONAL implied entries on top of the generated spec.
 *    Tom verbatim: "After Generation of Planguage Specs, run an 'Implied Specs
 *    Options' and generate additional Planguage specs as a possible result".
 *
 *  Phase 1 (r41 v325): Settings UI ships.  Setting is persisted in
 *  localStorage but DOES NOT YET WIRE through to the actual sub-step routing
 *  in App.vue / Stage1SubStepStrip.  Phase 2 (post-demo): the routing layer
 *  reads this setting and reorders the flow accordingly.  Banked in
 *  pending-requests.md. */
export type Stage1WorkflowMode =
  | 'default-implied-before-generate'
  | 'skip-implied'
  | 'implied-after-generate'

export interface Settings {
  // ── Mode (Tom's first explicit setting) ────────────────────────────────────
  /** Ultra Light or Pro SEM.  Default Pro SEM. */
  mode: AppMode

  // ── Spec Export Format (Tom Gilb 2026-06-16) ───────────────────────────────
  /** Format used by Save Plan / Email Plan / Copy Spec / OPTIMA exports.
   *  Default 'full' — exactly as displayed in the SEM App, with all sources +
   *  rationale + justifications.  'condensed' drops the detail fields.
   *  'table' emits one row per entry like the Object Templates reference. */
  specExportFormat: SpecExportFormat

  // ── Stage 1 Workflow (Tom Gilb 2026-06-24) ─────────────────────────────────
  /** How Stage 1 routes sub-steps 1.3 (Add Implied Optional) relative to
   *  1.4 (Generate Planguage Spec).  See Stage1WorkflowMode union for the
   *  three options.  Default 'default-implied-before-generate' (canonical). */
  stage1WorkflowMode: Stage1WorkflowMode

  // ── AI Max (universal SUPREME principle) ───────────────────────────────────
  /** Offline / Local-Only mode — Tom 2026-06-03: *"I would like to be about to
   *  run my app successfully even when you claudian lock me out. Is there a way
   *  to anable that, maybe with less ai, maybe in settings"*.
   *  When true: ALL AI / Claudian / external-API calls disabled.  Components
   *  fall back to deterministic logic, manual entry, and previously-cached data.
   *  Settings UI flips aiAssistanceLevel to 'off' automatically when this is true. */
  offlineMode: boolean
  /** AI assistance level — Off / Standard / Maximum.  Default Maximum.
   *  Forced to 'off' when offlineMode is true. */
  aiAssistanceLevel: AIAssistanceLevel
  /** Show AI rationale text inline below every AI-derived suggestion. */
  showAIRationales: boolean
  /** When opening Sharp Interview, auto-derive plan-aware suggestions (v2). */
  autoDerivePlanAwareSuggestions: boolean
  /** Number of AI suggestions per Sharp Interview question (3 default; 2 / 3 / 5 / 10). */
  sharpSuggestionCount: 2 | 3 | 5 | 10
  /** Default selection mode for new Sharp Interview questions. */
  defaultSharpSelectionMode: DefaultSharpSelectionMode

  // ── Telemetry (Tom's second explicit setting) ──────────────────────────────
  /** None / Standard / Maximum.  Default None — privacy by default. */
  telemetryLevel: TelemetryLevel
  /** Allow anonymous error reports (separate from telemetry). */
  allowErrorReports: boolean
  /** Share session recordings for debugging (very intrusive — opt-in only). */
  allowSessionRecordings: boolean

  // ── Sharpening Processes (Tom 2026-06-03: "Sharpening Processes (SEM and
  //    EVO separately).  Options 1. Collect Project Data on all Answers,
  //    2. Apply Feedback data to next sharpening (to make it smarter and
  //    more tailored to the Plan and Planner preferences)").
  //
  //    Two contexts (SEM Sharpening = the spec-sharpening stage; Evo
  //    Sharpening = the Sharpen Next Step interview), each with two booleans. */
  /** SEM Sharpening: collect project data on all answers (for later analysis). */
  semSharpeningCollectData: boolean
  /** SEM Sharpening: apply collected feedback to make future sharpening smarter. */
  semSharpeningApplyFeedback: boolean
  /** Evo Sharpening (Sharpen Next Step): collect project data on all answers. */
  evoSharpeningCollectData: boolean
  /** Evo Sharpening (Sharpen Next Step): apply collected feedback to tailor next sharpening. */
  evoSharpeningApplyFeedback: boolean

  // ── Evo defaults ───────────────────────────────────────────────────────────
  /** Default cycle length for new plans. */
  defaultCycleLength: DefaultCycleLength
  /** Default reviewer name stamped on FEED ME! action approvals. */
  defaultReviewerName: string
  /** Default lagging-measurement window in days (after step delivery). */
  defaultLaggingWindowDays: number
  /** Auto-add Sharpen Next Step questions to new steps as they are generated. */
  autoOpenSharpOnNewStep: boolean
  /** Default risk tolerance for Skunkworks ideas (low / medium / high). */
  defaultRiskTolerance: 'low' | 'medium' | 'high'

  // ── Visualization ──────────────────────────────────────────────────────────
  theme: Theme
  density: Density
  animationLevel: AnimationLevel
  /** Font scale — 90 / 100 / 110 / 125 (percent). */
  fontScalePercent: 90 | 100 | 110 | 125
  /** Colour-blindness filter — for users with deuteranopia / protanopia / tritanopia. */
  colorBlindMode: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'

  // ── Workflow ───────────────────────────────────────────────────────────────
  /** Auto-save frequency in seconds.  0 = manual save only. */
  autoSaveIntervalSeconds: number
  /** Confirm before destructive operations (Start Fresh, Clear All, etc.). */
  confirmBeforeDestructive: boolean
  /** Show toast notifications. */
  showToasts: boolean
  /** Remind me to capture lagging measures (cron-style nudge per FEED ME!). */
  enableLaggingMeasureReminders: boolean

  // ── Export ─────────────────────────────────────────────────────────────────
  defaultExportFormat: ExportFormat
  /** Always include audit trail (Source + Reason) in exports. */
  includeAuditTrailInExports: boolean
  /** Default email sender address (overrides per-export). */
  defaultEmailFrom: string

  // ── Collaboration ──────────────────────────────────────────────────────────
  /** Default plan owner name for new plans. */
  defaultPlanOwner: string
  /** Share plan with Twin (Kai's industrial app) — auto / manual / off. */
  twinShareMode: 'auto' | 'manual' | 'off'

  // ── Diagnostics (Tom power-user mode) ──────────────────────────────────────
  /** Show developer hints in tooltips (e.g., "this calls useEvoPlan composable"). */
  showDevHints: boolean
  /** Log AI-suggestion resolution failures to console (helps debug LLM drift). */
  logAIResolutionFailures: boolean

  // ── Model Mode (Tom Gilb 2026-06-16 — RICH 4-AXIS DESIGN) ──────────────────
  //
  // Tom Gilb 2026-06-16 verbatim (revised from r41 v46 simpler browse/curate
  // axis): full spec at the top of this file under `ModelModeConfig`.
  //
  // Four orthogonal axes — Domain · Presentation · Standards · Purpose.
  modelMode: ModelModeConfig

  // ── Contracts Mode (Tom Gilb 2026-06-16 — RICH 4-AXIS DESIGN) ──────────────
  //
  // Tom Gilb 2026-06-16 verbatim (revised from r41 v46 simpler lenient/strict
  // axis): *"Settings, Contract MOde: 1. Apply Contract Sharpening, 2. Apply
  // Standards (list) and Can insert a URL, or several, 3. Presentation: Legal
  // Experts, Managers, Technical Experts. 4. Purpose: Re-write the Contract,
  // Give log of all changes, Strictly Analytical, Creative Suggestions (to
  // contract, to other documents, appendicies, other actions, negotiating
  // tactics. OK MAKE A GREAT DESIGN IN SETTINGS AND CARRY IT OUT IN THE
  // CONTRACT LOGIC."*
  //
  // Four orthogonal axes — every contract parse call composes them all.
  contractsMode: ContractsModeConfig

  // ── Illumination AI (Tom Gilb 2026-06-15) ──────────────────────────────────
  //
  // Tom 2026-06-15 verbatim: *"To Settings Menu (Illumination defaults for all
  // users, before personal preferences)"*.
  //
  // These are the GLOBAL / BASELINE defaults applied to the ⌘I picker for all
  // users.  Personal per-Owner / per-Planner preferences (Phase 3 vision —
  // `useIlluminationPreferences.ts`) will OVERRIDE these when a Plan Owner or
  // Planner has saved their own settings.  This is the "before personal
  // preferences" layer Tom explicitly called out.
  //
  // Composes with: SEM-teaches-incrementally (defaults shape the teaching
  // surface for first-time users), AI-Max (every default leans toward showing
  // more, not less), No-Silent-Data-Loss (defaults persist via
  // `useSettings`), Twin portability (every setting ports verbatim).
  /** Which tab opens by default in the ⌘I picker.  Default 'define' so the
   *  glance card shows the short definition first per the r41 v28 design.
   *  Personal preferences (Phase 3) can override per Owner / Planner. */
  illuminationDefaultTab: 'define' | 'diagram' | 'pictures' | 'universe' | 'books' | 'twin'
  /** Show the GLANCE card (short def + "want to know more?" + "sharp enough")
   *  on the Define tab before the full content reveals.  Default true.
   *  Tom Gilb 2026-06-15: *"we give one thing initially"*. */
  illuminationShowGlanceCard: boolean
  /** Auto-fire Twin Consultant search 800 ms after the user pauses typing.
   *  Default true.  Phase 2: per-purpose may toggle this. */
  illuminationAutoFireTwin: boolean
  /** Always show ontology diagram first when the concept has one (regardless
   *  of last-used tab).  Tom Gilb 2026-06-15 example preference verbatim:
   *  *"Always Give Me An Ontology Diagram"*.  Default false (respect last-used
   *  tab).  Personal preferences (Phase 3) commonly flip this true. */
  illuminationAlwaysDiagramFirst: boolean
  /** Default illumination depth — 'short' = glance only / 'standard' = glance
   *  + primary entry / 'deep' = pre-expand everything + Twin always-on.  Tom
   *  Gilb 2026-06-15 example preference verbatim: *"I want deepest possible
   *  insights"* maps to 'deep'.  Default 'standard'. */
  illuminationDepth: 'short' | 'standard' | 'deep'
  /** Include historical background (Tom Gilb's verbatim example preference:
   *  *"I like historical background"*).  When true, AI prompts asked of the
   *  Twin include "include relevant historical context".  Default false. */
  illuminationIncludeHistory: boolean

  // ── Strategy Mode (Tom Gilb 2026-06-09) ────────────────────────────────────
  /**
   * Enable Strategy Management mode — SEM Official Tag: 'Strategy'.
   * Long Name: "SEM Design for Organizational Strategy Planning and Execution".
   * Designer: Tom Gilb. Initiation: 9 June 2026.
   *
   * When ON: display labels switch to strategic-planning vocabulary (e.g.
   * Values → Strategic Objectives, Solutions → Strategies).
   * The UNDERLYING Planguage data model is UNCHANGED — Twin-portable.
   * Primary Gilb texts: Strategy-Ring, Value Improvement.
   */
  strategyMode: boolean
  /** Terminology overrides applied to all UI surfaces when strategyMode is true. */
  strategyTerminology: StrategyTerminology
}

// ── Defaults ─────────────────────────────────────────────────────────────────
// Per Tom 2026-06-03: Default Pro SEM, Maximum AI, telemetry None (privacy
// default), Week cycle length (most common in software teams), Mixed Sharp
// mode (matches the per-question default), Auto theme (respects system).

export const DEFAULT_SETTINGS: Settings = {
  // Mode
  mode: 'pro-sem',

  // Spec Export Format — Tom Gilb 2026-06-16 default = full (exactly as in display)
  specExportFormat: 'full',

  // Stage 1 Workflow — Tom Gilb 2026-06-24.  Default canonical: 1.3 runs
  // BEFORE 1.4 (Implied review precedes Generation).  Options to skip 1.3
  // entirely OR move it to after 1.4 ship in r41 v325.
  stage1WorkflowMode: 'default-implied-before-generate',

  // AI Max
  offlineMode: false,
  aiAssistanceLevel: 'maximum',
  showAIRationales: true,
  autoDerivePlanAwareSuggestions: true,
  sharpSuggestionCount: 3,
  defaultSharpSelectionMode: 'mixed',

  // Telemetry
  telemetryLevel: 'none',
  allowErrorReports: false,
  allowSessionRecordings: false,

  // Sharpening Processes (Tom 2026-06-03) — defaults ON for both collect +
  // apply, per the AI-Max principle (default to maximum helpfulness; user
  // can opt-out).  These compose with the global aiAssistanceLevel.
  semSharpeningCollectData: true,
  semSharpeningApplyFeedback: true,
  evoSharpeningCollectData: true,
  evoSharpeningApplyFeedback: true,

  // Evo defaults
  defaultCycleLength: 'week',
  defaultReviewerName: 'Tom',
  defaultLaggingWindowDays: 7,
  autoOpenSharpOnNewStep: false,
  defaultRiskTolerance: 'medium',

  // Visualization
  theme: 'auto',
  density: 'comfortable',
  animationLevel: 'full',
  fontScalePercent: 100,
  colorBlindMode: 'none',

  // Workflow
  autoSaveIntervalSeconds: 5,
  confirmBeforeDestructive: true,
  showToasts: true,
  enableLaggingMeasureReminders: true,

  // Export
  defaultExportFormat: 'html',
  includeAuditTrailInExports: true,
  defaultEmailFrom: 'Tom@Gilb.com',

  // Collaboration
  defaultPlanOwner: 'Tom Gilb',
  twinShareMode: 'manual',

  // Diagnostics
  showDevHints: false,
  logAIResolutionFailures: true,

  // Model Mode (Tom Gilb 2026-06-16 — rich 4-axis design).  Defaults: Product
  // domain (most common) · Planguage presentation (this app's native) ·
  // Planguage standard on · search-additional ON (Conjunction-of-Technologies) ·
  // Management Decision-Making purpose (broadest applicability).
  modelMode: {
    domain: 'product',
    presentation: 'planguage',
    standards: ['planguage'],
    standardsCustomUrls: [],
    searchForAdditionalStandards: true,
    purposes: ['management-decision-making'],
  },

  // Contracts Mode (Tom Gilb 2026-06-16 — rich 4-axis design).
  // Defaults: Sharpening ON · Planguage + Plain English standards · Managers
  // presentation (broadest audience) · Strictly Analytical purpose (safe — no
  // AI modifications without user opting into rewrite/creative).
  contractsMode: {
    applyContractSharpening: true,
    standards: ['gilb-planguage', 'plain-english'],
    standardsCustomUrls: [],
    presentation: 'managers',
    purposes: ['strict-analytical'],
  },

  // Illumination AI defaults (Tom Gilb 2026-06-15) — baseline for ALL users,
  // overridden by personal preferences in Phase 3.
  illuminationDefaultTab:           'define',
  illuminationShowGlanceCard:       true,
  illuminationAutoFireTwin:         true,
  illuminationAlwaysDiagramFirst:   false,
  illuminationDepth:                'standard',
  illuminationIncludeHistory:       false,

  // Strategy Mode (off by default — organizations opt in)
  strategyMode: false,
  strategyTerminology: {
    valueTerm:         'Strategic Objective',
    valuesTermPlural:  'Strategic Objectives',
    solutionTerm:      'Strategy',
    solutionsTermPlural: 'Strategies',
    evoStepTerm:       'Strategic Value Delivery Increment',
    evoStepsTermPlural: 'Strategic Value Delivery Increments',
    evoFeedbackTerm:   'Strategic Results',
    ownerRoleTerm:     'Strategy Responsible',
    plannerRoleTerm:   'Strategy Planner',
    scribeRoleTerm:    'Results Responsible',
  },
}

// ── Storage key ──────────────────────────────────────────────────────────────

export const SETTINGS_STORAGE_KEY = 'semSettings:v1'

// ── Section metadata for the panel UI ────────────────────────────────────────

export interface SettingsSection {
  id: string
  label: string
  description: string
  /** Tailwind accent class for the section header strip. */
  accent: string
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'mode',         label: 'Mode',                description: 'Ultra Light vs Pro SEM — controls how much of the toolkit is exposed', accent: 'from-violet-500 to-indigo-500' },
  { id: 'stage1',       label: 'Stage 1 Workflow',    description: 'How Stage 1 routes Implied Specs (1.3) relative to Planguage Generation (1.4) — Tom 2026-06-24', accent: 'from-indigo-500 to-blue-500' },
  { id: 'modelMode',    label: 'Model Mode',          description: 'Browse / Curate / Locked — how the Spec Model Library behaves', accent: 'from-blue-500 to-cyan-500' },
  { id: 'contractsMode',label: 'Contracts Mode',      description: 'Lenient / Strict / Manual — how the Contracts Hub parses imported contracts', accent: 'from-teal-500 to-emerald-500' },
  { id: 'ai',           label: 'AI Assistance',       description: 'AI-Max principle (Tom 2026-06-03) — impressive help across every input surface', accent: 'from-fuchsia-500 to-purple-500' },
  { id: 'illumination', label: 'Illumination AI',     description: 'Defaults for the ⌘I picker.  Applied to ALL users before any personal Owner/Planner preferences.', accent: 'from-amber-500 to-orange-500' },
  { id: 'sharpening',   label: 'Sharpening Processes', description: 'SEM and Evo sharpening: collect project data + apply feedback to next sharpening', accent: 'from-amber-500 to-rose-500' },
  { id: 'telemetry',    label: 'Privacy & Telemetry', description: 'What usage data the app collects.  Default: none.', accent: 'from-slate-500 to-slate-700' },
  { id: 'evo',          label: 'Evo Defaults',        description: 'Defaults applied to new plans, steps, reviews, and measurements', accent: 'from-amber-500 to-orange-500' },
  { id: 'visual',       label: 'Visualization',       description: 'Theme, density, font scale, accessibility', accent: 'from-emerald-500 to-teal-500' },
  { id: 'workflow',     label: 'Workflow',            description: 'Auto-save, confirmations, toasts, reminders', accent: 'from-sky-500 to-blue-500' },
  { id: 'export',       label: 'Export',              description: 'Default format, audit-trail inclusion, email sender', accent: 'from-pink-500 to-rose-500' },
  { id: 'collab',       label: 'Collaboration',       description: 'Plan ownership defaults + Twin sharing', accent: 'from-cyan-500 to-blue-500' },
  { id: 'diagnostics',  label: 'Diagnostics',         description: 'Developer hints, debug logging.  Tom power-user mode.', accent: 'from-slate-500 to-zinc-700' },
  { id: 'strategy',     label: 'Strategy Mode',       description: 'SEM for org strategy planning — terminology overrides, Strategy-Ring + Value Improvement', accent: 'from-blue-600 to-indigo-700' },
]
