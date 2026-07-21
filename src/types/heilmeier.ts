// UNIT_TYPE=Types
// heilmeier.ts — types for the Heilmeier Agent (DARPA's 9-Question Catechism:
// what-trying-to-do / how-done-today / what-is-new / who-cares / risks /
// cost / how-long / midterm-exams / who-is-left-out).
//
// Tom Gilb, 2026-06-22 verbatim:
//   "Hellmeier Agent: Make a new agent based on the new Asset Folder Hellmeier"
//
// Source PDFs (in /5 - Project/SEM App/assets/Heilmeier Catechism/):
//   1. GILB PLANGUAGE AND HELLMEIER COMPARISON.pdf — Tom's Heilmeier→Planguage map
//   2. extending hellmeier.pdf — IEEE 2025 paper extending the Catechism with
//      "Who is left out?" (Butler / Hugenberg / Jain / Kapadia / Kohno /
//      Redmiles / Roesner / Sim / Traynor / Barakat, IEEE Security & Privacy
//      May/June 2025).
//   3. 2013-08-08-heilmeier.pdf — Cornell handout (canonical 8 questions).
//   4. 10_DARPA-Enabling_Technical_Innovation.pdf — DARPA history context.
//
// Conjunction-of-Technologies SUPREME compliance — sources cited per finding:
//   1. The Heilmeier Catechism (DARPA, 1965-1977 program-evaluation framework)
//   2. IEEE 2025 extension "Who Is Left Out?" — Butler/Kohno et al.
//   3. Tom Gilb's Planguage corpus (mapped per the comparison PDF)
//   4. The current Plan (deterministic) — what triggered each finding
//
// Every finding carries a sourceLayer badge.
//
// ARCHITECTURAL ALIGNMENT: this types file mirrors `src/types/munger.ts` precisely
// (same Finding/Report/Fix shape) so the Accept-Fix pipeline, source-stamping,
// Universal Undo, and panel render machinery JUST WORK without per-agent code paths.

/** The 9 Heilmeier categories — DARPA's original 8 + IEEE 2025 "Who is left out?"
 *  extension. Order = canonical Catechism order; the IEEE 2025 question goes
 *  LAST as the explicit extension. */
export type HeilmeierCategory =
  | 'what-trying-to-do'      // Q1 — "What are you trying to do? Articulate using NO jargon."
  | 'how-done-today'         // Q2 — "How is it done today, and what are the limits?"
  | 'what-is-new'            // Q3 — "What is new in your approach, and why will it succeed?"
  | 'who-cares'              // Q4 — "Who cares? If successful, what difference will it make?"
  | 'risks'                  // Q5 — "What are the risks?"
  | 'cost'                   // Q6 — "How much will it cost?"
  | 'how-long'               // Q7 — "How long will it take?"
  | 'midterm-exams'          // Q8 — "What are the mid-term and final exams to check success?"
  | 'who-is-left-out'        // Q9 (IEEE 2025 extension) — "Who is left out?"

/** Per-finding severity. Critical = blocker; moderate = should fix; suggestion = nice-to-have.
 *  Notes:
 *    - 'what-trying-to-do' findings escalate to 'critical' when the plan has no
 *      Value entries with Goal (the plan literally has no measurable objective).
 *    - 'who-is-left-out' findings escalate to 'critical' when stakeholder count
 *      is ≤ 2 (likely incomplete stakeholder map). */
export type HeilmeierSeverity = 'critical' | 'moderate' | 'suggestion'

/** Source-layer badge per the Conjunction-of-Technologies rule. Highest provenance first. */
export type HeilmeierSourceLayer =
  | 'derived-from-plan'              // Deterministic from spec data — highest confidence
  | 'cited-heilmeier-darpa'          // The DARPA Catechism (Cornell handout + 2013-08-08-heilmeier.pdf)
  | 'cited-heilmeier-extended'       // IEEE 2025 "Who Is Left Out?" extension paper
  | 'cited-gilb'                     // Tom Gilb's Planguage corpus (incl Glossary, books, comparison PDF)
  | 'llm-training'                   // General knowledge of the Heilmeier Catechism
  | 'generic-template'               // Fallback heuristic — lowest provenance

/** Shape of a single suggested Planguage edit attached to a finding. */
export interface HeilmeierFix {
  /** What KIND of edit the user would apply. Used for routing the Apply button. */
  type:
    | 'add-objective-value'                 // V. entry: a clear quantified objective (Q1)
    | 'simplify-jargon-description'         // V./F./S. entry edit: strip jargon, plain English (Q1)
    | 'add-baseline-status'                 // V. entry: current/Past baseline (Q2)
    | 'add-novelty-solution'                // S. entry: what is genuinely new (Q3)
    | 'add-stakeholder-impact-value'        // V. entry: quantified impact for named stakeholder (Q4)
    | 'add-risk-management-constraint'      // C. entry: a named risk + mitigation (Q5)
    | 'add-cost-resource'                   // R. entry: budget / cost ceiling (Q6)
    | 'add-time-resource'                   // R. entry: deadline / time horizon (Q7)
    | 'add-midterm-exam-constraint'         // C. entry: measurable checkpoint / Evo step exit (Q8)
    | 'add-left-out-stakeholder'            // Stakeholder entry: indirect / marginalized group (Q9)
    | 'add-constraint'                      // Fallback Plan-level Constraint
  /** The proposed edit expressed as Planguage text. Shown to user for review. */
  asPlanguage: string
  /** Target entry id (V/F/S/C/R) the fix would attach to, or 'plan-level' for plan-wide. */
  targetItemId: string
  /** Human-readable rationale shown in the Accept/Modify/Dismiss card. */
  rationale: string
}

/** A single Heilmeier finding — one Catechism question failed, with cited source + suggested fix. */
export interface HeilmeierFinding {
  /** Deterministic id — stable across re-runs of the same logical inputs. */
  id: string
  category: HeilmeierCategory
  severity: HeilmeierSeverity
  sourceLayer: HeilmeierSourceLayer
  /** DARPA / Cornell handout citation (e.g. "Heilmeier Catechism Q4 — DARPA 1965"). */
  heilmeierCitation: string | null
  /** IEEE 2025 extension citation (only set for who-is-left-out). */
  extendedCitation: string | null
  /** Optional Gilb cross-reference (book + chapter / standard file). */
  gilbCitation: string | null
  /** Optional public-URL anchor for verification. */
  verifyUrl: string | null
  /** Which entry triggered this finding ('V.OnboardingSpeed', 'plan-level', etc.). */
  triggeredBy: string
  /** The Heilmeier question being failed — short label. */
  principleViolated: string
  /** One-sentence explanation in plain English. */
  explanation: string
  /** Suggested Planguage fix the user can Accept / Modify / Dismiss. */
  suggestedFix: HeilmeierFix
  /** One-sentence consequence framing — "what happens if you don't fix this". */
  longTermConsequence: string
  /** Computed at generation time so the UI can sort newest-first if needed. */
  generatedAtIso: string
}

/** Output of a single Heilmeier run on a Plan — grouped + summarised for the UI. */
export interface HeilmeierReport {
  generatedAtIso: string
  planTitle: string
  totalFindings: number
  byCategory: Record<HeilmeierCategory, HeilmeierFinding[]>
  bySeverity: Record<HeilmeierSeverity, number>
  /** Aggregate "Clarity Score" 0-100 — higher = more clearly-articulated per the Catechism.
   *  Critical findings weight 3× moderate; moderate weight 2× suggestion; suggestions 1×. */
  clarityScore: number
  /** One-line headline summary the user reads first. */
  headline: string
}

/** Banned-jargon words the Q1 detector scans for (DARPA's "absolutely no jargon" rule).
 *  Heilmeier was famous for cutting program managers off the moment they used buzzwords. */
export const HEILMEIER_BANNED_JARGON: ReadonlySet<string> = new Set([
  'leverage', 'synergize', 'synergy', 'synergies',
  'disruptive', 'disruption', 'paradigm',
  'ecosystem', 'holistic', 'next-generation', 'next generation',
  'cutting-edge', 'cutting edge', 'state-of-the-art', 'best-of-breed',
  'turnkey', 'mission-critical', 'value-add', 'core competency',
  'low-hanging fruit', 'move the needle', 'circle back',
  'innovative', 'transformative', 'revolutionary',
])

/** Category metadata for UI rendering — label, color, Heilmeier principle one-liner.
 *
 *  Color palette (R/G-colorblind-safe; indigo/blue family for DARPA defense heritage):
 *    what-trying-to-do=indigo · how-done-today=blue · what-is-new=violet
 *    who-cares=cyan · risks=amber · cost=emerald · how-long=teal
 *    midterm-exams=slate · who-is-left-out=rose (IEEE extension stands out) */
export const HEILMEIER_CATEGORY_META: Record<
  HeilmeierCategory,
  { label: string; subtitle: string; color: string; heilmeierPrinciple: string }
> = {
  'what-trying-to-do': {
    label: 'What are you trying to do?',
    subtitle: 'Articulate using absolutely no jargon — Heilmeier Q1',
    color: 'indigo',
    heilmeierPrinciple:
      'Heilmeier Catechism Q1 (DARPA, 1965-1977). Heilmeier — DARPA Director ' +
      '1975-1977 — was famous for cutting program managers off the moment they used ' +
      'a buzzword. The objective MUST be stated in plain English a smart non-expert ' +
      'can grasp in one sentence. Planguage map (per Tom\'s comparison PDF): ' +
      'Objectives / Goal specification — quantified Value entries with named Scale.',
  },
  'how-done-today': {
    label: 'How is it done today?',
    subtitle: 'What are the limits of current practice? — Heilmeier Q2',
    color: 'blue',
    heilmeierPrinciple:
      'Heilmeier Catechism Q2. Every DARPA proposal must name the CURRENT baseline ' +
      'and its limits — otherwise improvement is unmeasurable. Planguage map: ' +
      'Past / Status values on every Value entry; benchmark named in Scale or Meter.',
  },
  'what-is-new': {
    label: 'What is new in your approach?',
    subtitle: 'Why do you think it will be successful? — Heilmeier Q3',
    color: 'violet',
    heilmeierPrinciple:
      'Heilmeier Catechism Q3. Without explicit novelty, the proposal is duplicating ' +
      'existing work — DARPA funds NEW research, not incremental polish. Planguage map: ' +
      'Solution entries with documented Innovation / Design Ideas + evidence.',
  },
  'who-cares': {
    label: 'Who cares?',
    subtitle: 'If successful, what difference will it make? — Heilmeier Q4',
    color: 'cyan',
    heilmeierPrinciple:
      'Heilmeier Catechism Q4. Plans without named stakeholders + quantified impacts ' +
      'have no constituency — they fail political and budget review. Planguage map: ' +
      'Stakeholder entries + quantified Value entries (Scale + Goal) per stakeholder.',
  },
  'risks': {
    label: 'What are the risks?',
    subtitle: 'Named risks with mitigation paths — Heilmeier Q5',
    color: 'amber',
    heilmeierPrinciple:
      'Heilmeier Catechism Q5. A proposal that lists no risks is either dishonest or ' +
      'naive — both disqualifying at DARPA review. Planguage map: V.risks field per ' +
      'Value entry; negative Constraints naming what the plan must AVOID.',
  },
  'cost': {
    label: 'How much will it cost?',
    subtitle: 'Budget ceiling and unit cost — Heilmeier Q6',
    color: 'emerald',
    heilmeierPrinciple:
      'Heilmeier Catechism Q6. Every proposal must have a named cost envelope — ' +
      'otherwise it cannot be evaluated against alternatives. Planguage map: ' +
      'Resource entries with monetary Budget / Tolerable fields.',
  },
  'how-long': {
    label: 'How long will it take?',
    subtitle: 'Timeline with named milestones — Heilmeier Q7',
    color: 'teal',
    heilmeierPrinciple:
      'Heilmeier Catechism Q7. A proposal with no time horizon is unschedulable; a ' +
      'proposal with only one (final) milestone is unmonitorable. Planguage map: ' +
      'Resource entries with deadline / Evo step durations + per-step time qualifiers.',
  },
  'midterm-exams': {
    label: 'What are the midterm and final exams?',
    subtitle: 'Measurable checkpoints to verify progress — Heilmeier Q8',
    color: 'slate',
    heilmeierPrinciple:
      'Heilmeier Catechism Q8. Without midterm exams, the program is committed for its ' +
      'full duration with no kill-switch — DARPA\'s explicit safeguard against runaway ' +
      'programs. Planguage map: Evo delivery steps with measurable Tolerable / Goal ' +
      'checkpoints per Value; named exit-criteria Constraints.',
  },
  'who-is-left-out': {
    label: 'Who is left out?',
    subtitle: 'Stakeholder gap analysis — IEEE 2025 extension',
    color: 'rose',
    heilmeierPrinciple:
      'Extension to the Catechism — IEEE Security & Privacy May/June 2025, by ' +
      'Butler / Hugenberg / Jain / Kapadia / Kohno / Redmiles / Roesner / Sim / ' +
      'Traynor / Barakat. The original 8 questions assume a known set of beneficiaries; ' +
      'Q9 asks who the program EXCLUDES — indirect users, affected communities, ' +
      'marginalized groups whose interests are not voiced by direct stakeholders. ' +
      'Planguage map: Stakeholder taxonomy (Direct / Indirect / Regulatory / System / ' +
      'Inanimate) — every plan must enumerate Indirect stakeholders explicitly.',
  },
}

/** Severity metadata for UI rendering (mirrors MUNGER_SEVERITY_META verbatim). */
export const HEILMEIER_SEVERITY_META: Record<
  HeilmeierSeverity,
  { label: string; bg: string; text: string; ring: string; sortOrder: number }
> = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-red-600',
    text: 'text-white',
    ring: 'ring-red-900',
    sortOrder: 0,
  },
  moderate: {
    label: 'MODERATE',
    bg: 'bg-amber-500',
    text: 'text-white',
    ring: 'ring-amber-700',
    sortOrder: 1,
  },
  suggestion: {
    label: 'SUGGESTION',
    bg: 'bg-blue-500',
    text: 'text-white',
    ring: 'ring-blue-700',
    sortOrder: 2,
  },
}

/** Source-layer metadata for UI rendering. */
export const HEILMEIER_SOURCE_META: Record<
  HeilmeierSourceLayer,
  { label: string; bg: string; text: string }
> = {
  'derived-from-plan':              { label: 'Derived from plan',              bg: 'bg-emerald-100', text: 'text-emerald-900' },
  'cited-heilmeier-darpa':          { label: 'Cited · Heilmeier (DARPA)',      bg: 'bg-indigo-100',  text: 'text-indigo-900' },
  'cited-heilmeier-extended':       { label: 'Cited · IEEE 2025 Extension',    bg: 'bg-rose-100',    text: 'text-rose-900' },
  'cited-gilb':                     { label: 'Cited · Gilb',                   bg: 'bg-violet-100',  text: 'text-violet-900' },
  'llm-training':                   { label: 'LLM training',                   bg: 'bg-slate-100',   text: 'text-slate-700' },
  'generic-template':               { label: 'Template fallback',              bg: 'bg-slate-100',   text: 'text-slate-500' },
}
