// UNIT_TYPE=Data
//
// evoStepFeedback.ts — Evo Step Data Collection (Stage 9: Study-Act).
//
// Tom Gilb 2026-06-03 (verbatim): *"EVO STEP DATA COLLECTION: Stage 9 study,
// act. There is nothing there, so lets put something in place. A Frame for
// Evo Step Data Collection. 1. No step taken. No Feedback. Skip This Stage
// Now. 2. A set of all Value and Resource Estimates for an Specified Evo Step
// (Tag), together with manual input of Measures (Using the Meter, or a
// deviation to be specified, like fewer samples), which can be specified.
// Each Measure will be able to add a ± range, and a Feedback Note about it,
// Then (1) tick, any set, for each measure Realistic-ness (Wild Guess,
// Actual Counting, Intuitive Observation, Proper Use of Specified Meter,
// High Credibility, Automated Measure), then (2) Leading Indicator, Lagging
// Indicator., (3) Responsible Measure Analyst, (4) any remarks on the
// measure, (5) Problems with the Measure (6) advice on future measures of
// this. We can skip anything, we will make use of what we have, we can come
// back later and edit this data collection. All changes will be versioned,
// and dated, and times."*
//
// Honors the Planguage Evo cycle steps 8 (Measure) + 9 (Learn) per
// canonical_evo_cycle.md: Measure = collect Value/Resource Status data;
// Learn = interpret and update the spec.  This file owns the Measure half.
//
// Persistence: localStorage key `evoStepFeedback:v1:<planId>`.
// Versioning: every Save snapshots the current `measures` array into
// `versions[]` with timestamp — never destructive, always append.
//
// Tom Gilb 2026-06-03 (Phase-2+3 extension): *"Stage 9 'Study Act' needs to
// be clearly divided into 3 Phases: 1 Data Collection, 2 Analysis (what
// does the data mean in relation to earlier estimates, and long term target
// and resources?), 3 Actions (proposed + approved). Apply AI insights, use
// the Planguage plan in total and the Evo step. Ask penetrating questions,
// suggest wise answers (sharpening style). Allow people their own input
// suggestions, but offer a critique and alternative suggestions, as in
// sharpening."*  Implemented via the AnalysisFinding + ActionItem types
// below + a Claudian prompt for each phase honoring Conjunction-of-
// Technologies (Planguage spec + Evo Step + measures + Gilb citations).

import type { SourceProvenance } from './aiSource'

/**
 * Realism tags — Tom's verbatim 6-set, multi-select.  A measure CAN be both
 * "Intuitive Observation" AND "High Credibility" (a senior engineer's eyeball
 * read) — these are not mutually exclusive.
 */
export type MeasureRealism =
  | 'wild-guess'
  | 'actual-counting'
  | 'intuitive-observation'
  | 'proper-meter'
  | 'high-credibility'
  | 'automated'

export const MEASURE_REALISM_LABEL: Record<MeasureRealism, string> = {
  'wild-guess':            'Wild Guess',
  'actual-counting':       'Actual Counting',
  'intuitive-observation': 'Intuitive Observation',
  'proper-meter':          'Proper Use of Specified Meter',
  'high-credibility':      'High Credibility',
  'automated':             'Automated Measure',
}

/** Leading / Lagging classifier — Tom's verbatim binary choice. */
export type IndicatorType = 'leading' | 'lagging' | 'unspecified'

export const INDICATOR_LABEL: Record<IndicatorType, string> = {
  'leading':     'Leading Indicator',
  'lagging':     'Lagging Indicator',
  'unspecified': '(not yet classified)',
}

/**
 * Whether the V/R target was measured against its declared Meter, or with
 * a stated deviation (e.g. "fewer samples", "proxy meter", "manual count
 * instead of telemetry").  Honesty trumps tidiness.
 */
export interface MeterUsage {
  /** True if the measure used the V/R entry's declared Meter as-is. */
  usedDeclaredMeter: boolean
  /** Free-text deviation note (only when usedDeclaredMeter = false). */
  deviationNote?: string
}

/**
 * One Measure record — captures the actual reading for ONE V or R estimate
 * of ONE Evo Step.  All non-id fields are optional so users can skip what
 * they don't have.
 */
export interface MeasureRecord {
  /** Stable id. */
  id: string
  /** Ref to the source V or R entry (V.id or R.id from the SpecBlock). */
  targetRef: string
  /** 'value' (V entry) or 'resource' (R entry). */
  targetType: 'value' | 'resource'
  /** Human-readable description (copied from the source entry for display). */
  targetDescription: string
  /** Pre-Evo-Step estimate (from the V/R entry's Goal / declared budget). */
  estimateText?: string

  // ── The actual Measure (Tom's spec) ─────────────────────────────────────
  /** Did we use the declared Meter, or a deviation? */
  meter?: MeterUsage
  /** The reading itself — string because Planguage Scales vary (%, sec, $). */
  measuredValue?: string
  /** ± range — lower and upper bounds around `measuredValue`. */
  rangeLow?: string
  rangeHigh?: string
  /** One-paragraph feedback about THIS measure. */
  feedbackNote?: string

  // ── The 6 Tom-spec qualifiers ───────────────────────────────────────────
  /** (1) Realism — multi-select tags. */
  realism: MeasureRealism[]
  /** (2) Leading vs Lagging classification. */
  indicator: IndicatorType
  /** (3) Responsible Measure Analyst (name / role / email). */
  analyst?: string
  /** (4) Remarks on the measure. */
  remarks?: string
  /** (5) Problems with the measure. */
  problems?: string
  /** (6) Advice on future measures of this V/R. */
  futureAdvice?: string

  // ── Per-measure versioning — Tom 2026-06-03 *"Each measure can be saved,
  // edited immediately, and all measures can be saved as a group"*.
  /** Last per-measure save (epoch ms).  Drives the "Saved at HH:MM" pill. */
  savedAt?: number
  /** Per-measure version history (append-only, deep snapshots). */
  versions?: MeasureVersion[]
}

/**
 * One versioned snapshot of a SINGLE MeasureRecord — created when the user
 * clicks the per-measure 💾 Save button.  Distinct from `FeedbackVersion`
 * which snapshots the WHOLE step's measures-array as a group.
 */
export interface MeasureVersion {
  id: string
  at: number
  label?: string
  /** Deep snapshot of the measure (excluding nested versions to avoid cycles). */
  snapshot: Omit<MeasureRecord, 'versions'>
}

/**
 * One versioned snapshot of the `measures` array for an Evo Step.  Every
 * Save creates one.  Snapshots are append-only — past versions stay forever.
 */
export interface FeedbackVersion {
  /** Snapshot id. */
  id: string
  /** Epoch ms — date AND time, per Tom's verbatim requirement. */
  at: number
  /** Optional human label ("after Sea Trials r3", "post-mortem v2"). */
  label?: string
  /** Optional Author note. */
  by?: string
  /** Deep snapshot of measures at the moment of save. */
  measures: MeasureRecord[]
  /** Skip-state snapshot (so a stage that was skipped then re-opened is replayable). */
  skipped: boolean
  skipReason?: string
}

/**
 * One Evo Step's worth of Study-Act data.
 */
export interface EvoStepFeedback {
  /** Stable id. */
  id: string
  /** The Evo Step tag / name (matches `EvoStep.name`). */
  evoStepTag: string
  /** Stage state: 'skipped' if user explicitly chose Skip; 'collected' otherwise. */
  state: 'skipped' | 'collected'
  /** When state = 'skipped', the user-supplied reason. */
  skipReason?: string
  /** The live working set of measures (latest, editable). */
  measures: MeasureRecord[]
  /** Append-only version history (every Save = one snapshot). */
  versions: FeedbackVersion[]
  /** Phase 2 — Analysis findings (sharpening-style Q&A). */
  analysis?: AnalysisSet
  /** Phase 3 — Proposed + Approved actions. */
  actions?: ActionSet
  /** Creation timestamp. */
  createdAt: number
  /** Last-modified timestamp. */
  updatedAt: number
}

// ─── Phase 2 — Analysis (Tom 2026-06-03) ────────────────────────────────────
// "What does the data MEAN in relation to earlier estimates, and long-term
//  target and resources?"  Implemented as a sharpening-style Q&A bank: each
//  finding has a penetrating question + 3-4 wise pre-seeded answers + user
//  override + optional Claudian critique array.

/** One analysis finding — sharpening-style. */
export interface AnalysisFinding {
  id: string
  /** Stable question key (e.g. 'variance-vs-goal', 'budget-impact'). */
  questionKey: string
  /** The penetrating question itself, displayed to the user. */
  question: string
  /** 3-5 pre-seeded "wise answer" suggestions (sharpening style). */
  suggestedAnswers: string[]
  /** Per-suggestion provenance (Plan / Gilb / LLM / Template / Internet). */
  suggestedAnswerProvenances?: SourceProvenance[]
  /** Multi-select indices into suggestedAnswers (user's accepted suggestions). */
  acceptedSuggestionIdx: number[]
  /** User's own typed answer (free text, optional — they may not type anything). */
  userAnswer?: string
  /**
   * Claudian critique of the user's answer + alternative suggestions.
   * Populated by paste-back from a Claudian-generated JSON.  Each entry is a
   * sharpening-style alternative the user can accept or ignore.
   */
  critiques?: Array<{
    critique: string
    alternative?: string
    provenance: SourceProvenance
  }>
}

export interface AnalysisSet {
  /** All findings the user has interacted with for this Evo Step. */
  findings: AnalysisFinding[]
  /** Last-saved timestamp (epoch ms). */
  updatedAt: number
}

// ─── Phase 3 — Actions (Tom 2026-06-03) ─────────────────────────────────────
// "What are some proposed actions, and what are some approved actions."
// Same sharpening pattern: penetrating questions + suggested actions +
// user-typed actions + Claudian critique of those.

export type ActionStatus = 'proposed' | 'approved' | 'rejected' | 'done'
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  rejected: 'Rejected',
  done: 'Done',
}

export interface ActionItem {
  id: string
  /** Plain-language action ("Tighten V.SpeedUnderSail Goal from 6 to 7 knots"). */
  description: string
  /** Lifecycle status. */
  status: ActionStatus
  /** Optional rationale / why-this-matters paragraph. */
  rationale?: string
  /** Optional owner (name / role). */
  owner?: string
  /** Optional due date (ISO yyyy-mm-dd). */
  dueDate?: string
  /** Optional link back to the AnalysisFinding that motivated it. */
  fromFindingId?: string
  /** Where the action came from (Plan derivation / Gilb / LLM / user / etc.). */
  provenance?: SourceProvenance
  /** Epoch ms of creation. */
  createdAt: number
  /** Epoch ms of last status change. */
  updatedAt: number
}

export interface ActionSet {
  items: ActionItem[]
  updatedAt: number
}

// ────────────────────────────────────────────────────────────────────────────

export interface EvoStepFeedbackSet {
  planId: string
  /** One entry per Evo Step that has been touched. */
  items: EvoStepFeedback[]
  /** Set-wide updatedAt for change-detection. */
  updatedAt: number
}

export function storageKey(planId: string): string {
  return `evoStepFeedback:v1:${(planId || 'default').trim()}`
}

// ── Factory helpers ─────────────────────────────────────────────────────────

let _idCounter = 0
function _nextId(prefix: string): string {
  _idCounter++
  return `${prefix}-${Date.now().toString(36)}-${_idCounter}`
}

/** Build a fresh EvoStepFeedback for a given step tag (no measures yet). */
export function createFeedback(evoStepTag: string): EvoStepFeedback {
  const now = Date.now()
  return {
    id: _nextId('feedback'),
    evoStepTag,
    state: 'collected',
    measures: [],
    versions: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** Build a fresh MeasureRecord for a given V or R target. */
export function createMeasure(
  targetRef: string,
  targetType: 'value' | 'resource',
  targetDescription: string,
  estimateText?: string,
): MeasureRecord {
  return {
    id: _nextId('measure'),
    targetRef,
    targetType,
    targetDescription,
    estimateText,
    realism: [],
    indicator: 'unspecified',
    meter: { usedDeclaredMeter: true },
  }
}

/**
 * Snapshot a single MeasureRecord — for the per-measure 💾 Save button.
 * Strips the nested `versions` array from the snapshot to avoid recursive
 * growth (the version history is metadata, not part of the measure data).
 */
export function snapshotMeasure(m: MeasureRecord, label?: string): MeasureVersion {
  const { versions: _omit, ...rest } = m
  void _omit
  return {
    id: _nextId('mv'),
    at: Date.now(),
    label,
    snapshot: JSON.parse(JSON.stringify(rest)) as Omit<MeasureRecord, 'versions'>,
  }
}

/** Snapshot the current feedback into a new version. */
export function snapshotVersion(fb: EvoStepFeedback, label?: string, by?: string): FeedbackVersion {
  return {
    id: _nextId('ver'),
    at: Date.now(),
    label,
    by,
    measures: JSON.parse(JSON.stringify(fb.measures)) as MeasureRecord[],
    skipped: fb.state === 'skipped',
    skipReason: fb.skipReason,
  }
}

// ── Persistence ─────────────────────────────────────────────────────────────

export function loadSet(planId: string): EvoStepFeedbackSet {
  try {
    const raw = localStorage.getItem(storageKey(planId))
    if (!raw) return { planId, items: [], updatedAt: 0 }
    const parsed = JSON.parse(raw) as EvoStepFeedbackSet
    if (!parsed || !Array.isArray(parsed.items)) return { planId, items: [], updatedAt: 0 }
    return parsed
  } catch {
    return { planId, items: [], updatedAt: 0 }
  }
}

export function saveSet(set: EvoStepFeedbackSet): void {
  try {
    set.updatedAt = Date.now()
    localStorage.setItem(storageKey(set.planId), JSON.stringify(set))
  } catch {
    // localStorage may be unavailable — non-fatal.
  }
}

// ─── Phase 2 — Analysis: deterministic question bank + seeders ──────────────

/**
 * Seed the 6 penetrating analysis questions for a freshly-collected Evo Step.
 * Each question is sharpening-style with 3-4 wise pre-seeded answers derived
 * deterministically from the measures + spec.  Inspired by the Sharp Interview
 * pattern (evoSharpInterview.ts) — same UX, applied to Study-Act analysis.
 *
 * The seed answers carry `provenance.source = 'plan'` when derived from
 * measure/spec data, `'template'` when generic.  Conjunction-of-Technologies
 * honoured: spec data feeds the suggestions.
 */
export function seedAnalysisFindings(fb: EvoStepFeedback): AnalysisFinding[] {
  const measures = fb.measures
  const measuredOnes = measures.filter(m => m.measuredValue && m.measuredValue.trim().length > 0)
  const skippedOnes = measures.filter(m => !m.measuredValue || m.measuredValue.trim().length === 0)
  const wildGuesses = measures.filter(m => m.realism.includes('wild-guess')).length
  const automated = measures.filter(m => m.realism.includes('automated')).length

  return [
    {
      id: _nextId('af'),
      questionKey: 'variance-vs-estimate',
      question: 'How does the measured value compare to the pre-step estimate / Goal for each Value? Where did we beat, miss, or land on target?',
      suggestedAnswers: [
        measuredOnes.length > 0
          ? `${measuredOnes.length} of ${measures.length} measures returned a value. Compare each measuredValue to estimateText — flag any miss > 25% as significant.`
          : 'No measures returned a value yet — variance analysis is not possible until data is collected.',
        'Pattern: misses cluster on the same Function / Solution. Investigate whether the Solution is fundamentally weaker than estimated.',
        'Pattern: beats cluster on Values stakeholders care less about. Re-prioritise the Wishes upward for the next Evo Step.',
        skippedOnes.length > 0
          ? `${skippedOnes.length} Values have NO measurement — that itself is a finding. Either the measure is too hard, or the Value is not actually being delivered.`
          : 'Every Value has a measurement — solid coverage.',
      ],
      suggestedAnswerProvenances: [
        { source: 'plan' },
        { source: 'gilb', gilbCitation: { book: 'Competitive Engineering', ref: 'ch.5 Stakeholder Analysis' } },
        { source: 'gilb', gilbCitation: { book: 'Value Improvement', ref: 'Wish-vs-Goal recalibration' } },
        { source: 'plan' },
      ],
      acceptedSuggestionIdx: [],
    },
    {
      id: _nextId('af'),
      questionKey: 'long-term-target-impact',
      question: 'What does this Evo Step\'s result tell us about reaching the long-term Goal / Wish? Are we on trajectory, behind, or ahead?',
      suggestedAnswers: [
        'If the slope from Status → measuredValue extrapolates to hitting Goal by deadline → on trajectory.',
        'If the slope is flatter than required → behind. Either accelerate (larger Evo Steps) or revise the Goal / Wish honestly.',
        'If the measured value already exceeds Goal → ahead. Consider raising the Wish (Tom: "raise the bar when reality permits").',
        'Watch for the leading-vs-lagging mismatch: a leading indicator can look great while the lagging indicator that stakeholders actually feel still lags.',
      ],
      suggestedAnswerProvenances: [
        { source: 'gilb', gilbCitation: { book: 'EVO 2024', ref: 'ch.2 p.19 (the 9-step cycle, Measure → Learn)' } },
        { source: 'gilb', gilbCitation: { book: 'Competitive Engineering', ref: 'Evo trajectory analysis' } },
        { source: 'llm' },
        { source: 'plan' },
      ],
      acceptedSuggestionIdx: [],
    },
    {
      id: _nextId('af'),
      questionKey: 'resource-budget-impact',
      question: 'What does this Evo Step\'s actual cost / time / effort tell us about the remaining Resource budgets? Are we still within all Constraints?',
      suggestedAnswers: [
        'Compute actual_effortHours / planned_effortHours per Task → if > 1.2 systematically, the budget needs revision OR the Solutions need simplification.',
        'Per Planguage primary prioritisation: reaching Value Wishes within ALL Constraints. If a Budget Constraint is now breached, the plan must change — not just the estimates.',
        'If we\'re ahead on budget, do NOT spend the slack: bank it for the inevitable late-cycle overrun (Gilb: "budgets are floors when good news arrives, ceilings when bad").',
      ],
      suggestedAnswerProvenances: [
        { source: 'plan' },
        { source: 'gilb', gilbCitation: { book: 'rule_planguage_primary_prioritization.md', ref: 'Tom 2026-05-26 SUPREME' } },
        { source: 'gilb', gilbCitation: { book: 'Stakeholder Engineering', ref: 'Budget contingency principle' } },
      ],
      acceptedSuggestionIdx: [],
    },
    {
      id: _nextId('af'),
      questionKey: 'data-quality',
      question: 'How much do we TRUST this data? What does the Realism distribution tell us about credibility?',
      suggestedAnswers: [
        wildGuesses > 0
          ? `${wildGuesses} measure(s) are tagged "Wild Guess" — treat their numbers as anecdotal. Conclusions must not lean on them.`
          : 'No Wild-Guess tags — credibility baseline is good.',
        automated > 0
          ? `${automated} measure(s) are Automated — these are the high-confidence anchor points. Build conclusions around them.`
          : 'No Automated measures yet — every reading is human-mediated. Future Evo Steps should invest in automation.',
        'If a key Value depends entirely on Intuitive Observation, the conclusion is provisional. State that explicitly in the Action proposals.',
      ],
      suggestedAnswerProvenances: [
        { source: 'plan' },
        { source: 'plan' },
        { source: 'gilb', gilbCitation: { book: 'Software Metrics 1976/1988', ref: 'Measurement honesty principle' } },
      ],
      acceptedSuggestionIdx: [],
    },
    {
      id: _nextId('af'),
      questionKey: 'surprises',
      question: 'What surprised us? Where did reality diverge from our model in unexpected ways?',
      suggestedAnswers: [
        'Inspect the Feedback Notes per measure — surprises are usually written there in plain English before being quantified.',
        'A surprise on a leading indicator is more useful than one on a lagging indicator (more time to act).',
        'Surprises often reveal a missing Stakeholder or a missing Constraint. If the data violates a rule we didn\'t write, add a C. spec.',
      ],
      suggestedAnswerProvenances: [
        { source: 'plan' },
        { source: 'gilb', gilbCitation: { book: 'EVO 2024', ref: 'Learn step — surprise as signal' } },
        { source: 'gilb', gilbCitation: { book: 'Stakeholder Engineering', ref: 'Hidden-stakeholder discovery' } },
      ],
      acceptedSuggestionIdx: [],
    },
    {
      id: _nextId('af'),
      questionKey: 'risk-signals',
      question: 'What risks are now visible that were not visible before this Evo Step?',
      suggestedAnswers: [
        'Map each measure that missed by > 25% to a risk: is the Solution wrong? Is the Goal unrealistic? Is the Resource budget too tight?',
        'A measure with "Problems with the measure" filled in is a meta-risk: the next Evo Step can\'t trust this number until the meter improves.',
        'Trajectory risk: even if every measure passed, if the slope to Goal is too shallow, the plan is at risk regardless of any single step.',
      ],
      suggestedAnswerProvenances: [
        { source: 'plan' },
        { source: 'plan' },
        { source: 'gilb', gilbCitation: { book: 'RISK book (Gilb)', ref: 'Trajectory risk principle' } },
      ],
      acceptedSuggestionIdx: [],
    },
  ]
}

/** Ensure the analysis set exists (lazy-init with seed). */
export function ensureAnalysis(fb: EvoStepFeedback): AnalysisSet {
  if (!fb.analysis) {
    fb.analysis = { findings: seedAnalysisFindings(fb), updatedAt: Date.now() }
  }
  return fb.analysis
}

// ─── Phase 3 — Actions: seeders + helpers ──────────────────────────────────

/**
 * Seed 4-6 proposed actions based on the current measures + analysis.
 * Deterministic: derives from plan + measure data, no Claudian needed.
 * User can edit, approve, reject, or add their own.
 */
export function seedActions(fb: EvoStepFeedback): ActionItem[] {
  const now = Date.now()
  const items: ActionItem[] = []
  const missedMeasures = fb.measures.filter(m => {
    if (!m.measuredValue || !m.estimateText) return false
    // Best-effort numeric variance check.
    const a = parseFloat(m.measuredValue), b = parseFloat(m.estimateText)
    if (isNaN(a) || isNaN(b) || b === 0) return false
    return Math.abs(a - b) / Math.abs(b) > 0.25
  })

  if (missedMeasures.length > 0) {
    items.push({
      id: _nextId('act'),
      description: `Investigate root cause of variance on ${missedMeasures.length} measure(s) that missed estimate by >25%`,
      status: 'proposed',
      rationale: `Targets: ${missedMeasures.map(m => m.targetRef).join(', ')}. Per Planguage: a >25% miss is a Solution or estimate problem, not a data problem.`,
      provenance: { source: 'plan' },
      createdAt: now, updatedAt: now,
    })
  }
  items.push({
    id: _nextId('act'),
    description: 'Update each V. entry Status field with the new measuredValue + dated comment',
    status: 'proposed',
    rationale: 'Closes the Measure → Learn loop. Without this, future Evo Steps re-estimate from stale Status.',
    provenance: { source: 'gilb', gilbCitation: { book: 'EVO 2024', ref: 'ch.2 p.19 — Status update after Measure' } },
    createdAt: now, updatedAt: now,
  })
  items.push({
    id: _nextId('act'),
    description: 'Review the next Evo Step\'s scope in light of these results — keep, shrink, or pivot',
    status: 'proposed',
    rationale: 'Evo cycle = Plan → Do → Study → Act. The next Plan must absorb what Study revealed.',
    provenance: { source: 'gilb', gilbCitation: { book: 'EVO 2024', ref: 'Cycle continuation principle' } },
    createdAt: now, updatedAt: now,
  })
  const lowCredibility = fb.measures.filter(m =>
    m.realism.includes('wild-guess') || m.realism.includes('intuitive-observation')).length
  if (lowCredibility > 0) {
    items.push({
      id: _nextId('act'),
      description: `Improve the meters for ${lowCredibility} low-credibility measure(s) before the next cycle`,
      status: 'proposed',
      rationale: 'Per Software Metrics: a measurement system that can\'t be defended is not a measurement system.',
      provenance: { source: 'gilb', gilbCitation: { book: 'Software Metrics 1976/1988', ref: 'Meter validity principle' } },
      createdAt: now, updatedAt: now,
    })
  }
  items.push({
    id: _nextId('act'),
    description: 'File at least one Wish-tightening or Goal-recalibration proposal back into the Planguage spec',
    status: 'proposed',
    rationale: 'Tom: "Study-Act is wasted if it doesn\'t change the spec." Spec is the long-term memory.',
    provenance: { source: 'gilb', gilbCitation: { book: 'Stakeholder Engineering', ref: 'Spec-update discipline' } },
    createdAt: now, updatedAt: now,
  })

  return items
}

export function ensureActions(fb: EvoStepFeedback): ActionSet {
  if (!fb.actions) {
    fb.actions = { items: seedActions(fb), updatedAt: Date.now() }
  }
  return fb.actions
}

/** Build a fresh, empty (proposed) action. */
export function createAction(description: string, opts?: { rationale?: string; owner?: string; dueDate?: string; fromFindingId?: string }): ActionItem {
  const now = Date.now()
  return {
    id: _nextId('act'),
    description,
    status: 'proposed',
    rationale: opts?.rationale,
    owner: opts?.owner,
    dueDate: opts?.dueDate,
    fromFindingId: opts?.fromFindingId,
    provenance: { source: 'template' },
    createdAt: now, updatedAt: now,
  }
}

// ─── Claudian prompts (Conjunction-of-Technologies) ─────────────────────────

/**
 * Phase 2 — Analysis critique prompt.  Asks Claudian to penetrate the user's
 * analysis with full Planguage spec + the Evo Step + the measures in context.
 * Honors Conjunction-of-Technologies: spec passed as JSON, citations requested
 * per finding, source-layer enum in output.
 */
export function buildAnalysisClaudianPrompt(
  fb: EvoStepFeedback,
  planSummary: string,
  evoStepDescription: string,
): string {
  return [
    'You are the Study-Act Analysis Critic (Tom Gilb 2026-06-03 Conjunction-of-Technologies).',
    '',
    'TASK: For each AnalysisFinding the user has touched, critique their answer and propose',
    'wiser alternatives.  Every critique MUST cite either (a) the Planguage spec data, (b) a',
    'specific Gilb book / chapter, (c) a 10.Standard/ rule, (d) an internet source, or (e) be',
    'honestly tagged as LLM training.',
    '',
    'EVO STEP: ' + (evoStepDescription || fb.evoStepTag),
    '',
    'PLAN SUMMARY (Planguage spec extract):',
    planSummary,
    '',
    'COLLECTED MEASURES (the raw Study data):',
    JSON.stringify(fb.measures, null, 2),
    '',
    'USER ANALYSIS (sharpening Q&A so far):',
    JSON.stringify(fb.analysis?.findings ?? [], null, 2),
    '',
    'INSTRUCTIONS:',
    '  1. For each finding with a non-empty userAnswer OR acceptedSuggestionIdx, produce',
    '     1-3 critiques.  Each critique is (a) what is weak / missing in the user\'s answer',
    '     and (b) an alternative phrasing.',
    '  2. EVERY critique MUST have provenance.  Prefer Gilb citations when applicable.',
    '  3. Do not invent citations.  Use only real Gilb references Tom can verify.',
    '',
    'OUTPUT — return ONLY this JSON, no prose, no markdown fences:',
    '',
    JSON.stringify({
      findingId: 'af-XXX',
      critiques: [
        {
          critique: '...',
          alternative: '...',
          provenance: {
            source: 'gilb',
            gilbCitation: { book: 'EVO 2024', ref: 'ch.2 p.19', quote: 'optional short quote' },
          },
        },
      ],
    }, null, 2),
    '',
    '... and one such object per finding you critiqued.  Wrap in an array.',
  ].join('\n')
}

/**
 * Phase 3 — Actions suggestion prompt.  Asks Claudian to propose 4-8 wise
 * actions given the full plan + Evo Step + measures + the user's analysis.
 */
export function buildActionsClaudianPrompt(
  fb: EvoStepFeedback,
  planSummary: string,
  evoStepDescription: string,
): string {
  return [
    'You are the Study-Act Actions Proposer (Tom Gilb 2026-06-03 Conjunction-of-Technologies).',
    '',
    'TASK: Propose 4-8 concrete actions the team should take based on what was Measured and',
    'what the user Analysed.  Each action MUST cite either Gilb / Standards / Plan-derivation',
    '/ Internet / LLM-training.  Sharpening style: penetrating, specific, actionable.',
    '',
    'EVO STEP: ' + (evoStepDescription || fb.evoStepTag),
    '',
    'PLAN SUMMARY (Planguage spec extract):',
    planSummary,
    '',
    'MEASURES:',
    JSON.stringify(fb.measures, null, 2),
    '',
    'USER ANALYSIS:',
    JSON.stringify(fb.analysis?.findings ?? [], null, 2),
    '',
    'EXISTING ACTIONS (do not duplicate):',
    JSON.stringify(fb.actions?.items ?? [], null, 2),
    '',
    'OUTPUT — return ONLY this JSON array, no prose, no markdown fences:',
    '',
    JSON.stringify([{
      description: 'Tighten V.X Goal from A to B based on Evo Step result',
      rationale: 'Why this matters (1-2 sentences)',
      provenance: {
        source: 'gilb',
        gilbCitation: { book: 'Value Improvement', ref: 'Goal recalibration after measurement' },
      },
    }], null, 2),
  ].join('\n')
}

/** Format an epoch ms as "2026-06-03 22:47" — Tom: "dated, and times." */
export function formatTimestamp(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
