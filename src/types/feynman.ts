// UNIT_TYPE=Types
// feynman.ts — types for the Feynman Agent.
//
// Tom Gilb, 2026-06-26 verbatim:
//   "now I want a Feynman Agent. See folder in assets and seach internet.
//    How would Richard evaluate a plan?"
//   + "i dont really want to stter, i want solid architecture, and well
//      architected changes, just do it"
//
// Sources Conjunction (per Conjunction-of-Technologies SUPREME rule):
//   1. Tom-dropped PDF — 10 Claude prompts inspired by Feynman's explanation
//      style (Louis Gleeson @aigleeson, 2026-06-26)
//   2. Feynman — Cargo Cult Science (Caltech 1974 commencement)
//      → https://calteches.library.caltech.edu/51/2/CargoCult.htm
//   3. Feynman — Personal Observations on the Reliability of the Shuttle
//      (Rogers Commission Appendix F, 1986)
//      → https://calteches.library.caltech.edu/3570/1/Feynman.pdf
//   4. Feynman blackboard quote at his death (Caltech, February 1988):
//      "What I cannot create, I do not understand."
//   5. Gilb — Planguage standards (Solution Parameters · Qualifiers ·
//      Infinity Trap · Parameter Discipline)
//   6. The current Plan (deterministic)                — what triggered each finding
//
// Every finding carries a sourceLayer badge per the Conjunction rule.
// Full source mining in `/Users/Tomgilbs/Documents/MyVault/.claude/feynman-rules/`.

/** The six diagnostic categories — each maps to a Feynman principle. */
export type FeynmanCategory =
  | 'cargo-cult'              // Form populated without substance — the spec looks right but the planes don't land
  | 'estimate-gap'            // Bottom-up engineer estimate ≠ top-down manager estimate (Challenger Appendix F)
  | 'cannot-create'           // Solution has no buildable-this-week artifact ("What I cannot create, I do not understand")
  | 'jargon-curtain'          // Spec hides behind abstractions — fails the 10-Year-Old Test
  | 'unexamined-assumption'   // Hidden assumption / Infinity Trap qualifier hole — "what am I treating as obvious?"
  | 'notebook-confession'     // No acknowledged uncertainty — plan claims false completeness

/** Per-finding severity. Critical = blocker; moderate = should fix; suggestion = nice-to-have. */
export type FeynmanSeverity = 'critical' | 'moderate' | 'suggestion'

/**
 * Source-layer badge per the Conjunction-of-Technologies rule.
 * Highest provenance first.
 */
export type FeynmanSourceLayer =
  | 'derived-from-plan'        // Deterministic from spec data — highest confidence
  | 'cited-feynman-prompts'    // Tom's dropped PDF (Louis Gleeson @aigleeson 2026-06-26)
  | 'cited-cargo-cult'         // Feynman 1974 Caltech commencement
  | 'cited-challenger-app-f'   // Feynman 1986 Rogers Commission Appendix F
  | 'cited-feynman-blackboard' // "What I cannot create, I do not understand" (Caltech 1988)
  | 'cited-gilb'               // Cross-reference to Gilb Planguage standards / books
  | 'llm-training'             // General knowledge from LLM training
  | 'generic-template'         // Fallback heuristic — lowest provenance

/** Shape of a single suggested Planguage edit attached to a finding. */
export interface FeynmanFix {
  /** What KIND of edit the user would apply. Used for routing the Apply button. */
  type:
    | 'add-past-baseline'        // Stamp a Past level on a Value with only Goal — clears cargo-cult / wish-equals-goal
    | 'add-presence-test'        // Add a presenceTest to a Function — clears cargo-cult / cannot-create
    | 'add-where-qualifier'      // Add a where-Qualifier to a Value — clears unexamined-assumption
    | 'add-who-qualifier'        // Add a who-Qualifier to a Value — clears unexamined-assumption
    | 'add-when-qualifier'       // Add a when-Qualifier to a Value — clears unexamined-assumption
    | 'add-rationale'            // Add rationale to a Constraint — clears unexamined-assumption
    | 'add-risks'                // Add Risks parameter to a Solution — clears cargo-cult / notebook-confession
    | 'add-implementation-responsible' // Add Implementation Responsible — clears estimate-gap precondition
    | 'add-evo-step'             // Carve a 1-week first build — clears cannot-create
    | 'shorten-description'      // Trim Description to ≤25 words — clears jargon-curtain
    | 'strip-jargon'             // Replace buzzwords with concrete language — clears jargon-curtain
    | 'add-physical-image'       // Add a Scale referent — concrete picture — clears jargon-curtain
    | 'request-engineer-estimate' // Trigger Implementation Responsible to give a separate estimate — clears estimate-gap
    | 'add-confession'           // Add an explicit "What I am unsure about" note to the plan — clears notebook-confession
  /** The proposed edit expressed as Planguage text. Shown to user for review. */
  asPlanguage: string
  /** Target entry id (V/F/S/C/R) the fix would attach to, or 'plan-level' for plan-wide. */
  targetItemId: string
  /** Human-readable rationale shown in the Accept/Modify/Dismiss card. */
  rationale: string
}

/** A single Feynman finding — one violation, with cited source + suggested fix. */
export interface FeynmanFinding {
  /** Deterministic id — stable across re-runs of the same logical inputs. */
  id: string
  category: FeynmanCategory
  severity: FeynmanSeverity
  sourceLayer: FeynmanSourceLayer
  /**
   * Feynman citation — book + page + section, or URL to the verifiable source.
   * Filled when sourceLayer is `cited-cargo-cult` / `cited-challenger-app-f` /
   * `cited-feynman-blackboard` / `cited-feynman-prompts`.
   */
  feynmanCitation: string | null
  /** Optional Gilb cross-reference (book + chapter / standard file). */
  gilbCitation: string | null
  /** Optional public-URL anchor for verification (Caltech archives). */
  verifyUrl: string | null
  /** Which entry triggered this finding ('V.Latency', 'plan-level', etc.). */
  triggeredBy: string
  /** The Feynman principle being violated — short label. */
  principleViolated: string
  /** One-sentence explanation in plain English. */
  explanation: string
  /**
   * The Feynman move underneath this finding — one of:
   *   "10-Year-Old Test" · "Why Chain" · "Hidden Assumption Hunt" · etc.
   * Shown to user as the "lens" badge so they can learn the Feynman vocabulary.
   */
  feynmanLens: string
  /** Suggested Planguage fix the user can Accept / Modify / Dismiss. */
  suggestedFix: FeynmanFix
  /** One-sentence consequence framing — "what happens if you don't fix this". */
  longTermConsequence: string
  /** Computed at generation time so the UI can sort newest-first if needed. */
  generatedAtIso: string
}

/** Output of a single Feynman run on a Plan — grouped + summarised for the UI. */
export interface FeynmanReport {
  generatedAtIso: string
  planTitle: string
  totalFindings: number
  byCategory: Record<FeynmanCategory, FeynmanFinding[]>
  bySeverity: Record<FeynmanSeverity, number>
  /**
   * Aggregate "Honesty Score" 0-100 — higher = more Feynman-honest.
   * 100 = no findings; declines per finding by severity weight.
   *   critical:   −12
   *   moderate:    −6
   *   suggestion:  −2
   * Floor at 0.  Score interpretation surfaced as a one-word label
   * (PRISTINE / SOLID / TENTATIVE / FRAGILE / CARGO-CULT) in the header.
   */
  honestyScore: number
  /** One-line headline summary the user reads first. */
  headline: string
}

/** Category metadata for UI rendering — label, color, Feynman principle one-liner. */
export const FEYNMAN_CATEGORY_META: Record<
  FeynmanCategory,
  { label: string; subtitle: string; color: string; feynmanPrinciple: string; lens: string }
> = {
  'cargo-cult': {
    label: 'Cargo Cult',
    subtitle: 'The form is perfect — no plane lands',
    color: 'red',
    feynmanPrinciple:
      'Feynman 1974: "They follow all the apparent precepts and forms of scientific investigation, but they are missing something essential, because the planes don\'t land."',
    lens: 'Cargo Cult Test',
  },
  'estimate-gap': {
    label: 'Estimate Gap',
    subtitle: 'Planner number ≠ implementer number — the gap IS the bug',
    color: 'orange',
    feynmanPrinciple:
      'Feynman Challenger Appendix F: engineers estimated 1-in-100, management estimated 1-in-100,000. "For a successful technology, reality must take precedence over public relations, for Nature cannot be fooled."',
    lens: 'Bottom-Up vs Top-Down',
  },
  'cannot-create': {
    label: 'Cannot Create',
    subtitle: 'Solution has no buildable-this-week artifact — wish dressed as plan',
    color: 'amber',
    feynmanPrinciple:
      'Feynman\'s blackboard at his death (Caltech 1988): "What I cannot create, I do not understand."',
    lens: 'Build-It-This-Week',
  },
  'jargon-curtain': {
    label: 'Jargon Curtain',
    subtitle: 'Abstract corporate-speak hiding meaning — fails the 10-Year-Old Test',
    color: 'violet',
    feynmanPrinciple:
      'Tom-dropped Feynman PDF: "If you can\'t make it simple, you don\'t understand it well enough yet." The forced simplicity exposes exactly where the explanation is hiding behind big words.',
    lens: '10-Year-Old Test',
  },
  'unexamined-assumption': {
    label: 'Unexamined Assumption',
    subtitle: 'Plan rests on a belief treated as obvious that actually isn\'t',
    color: 'indigo',
    feynmanPrinciple:
      'Feynman\'s gift was spotting the unexamined belief sitting underneath everyone\'s reasoning. Every Qualifier hole in a Value spec is an unexamined assumption surfaced.',
    lens: 'Hidden Assumption Hunt',
  },
  'notebook-confession': {
    label: 'Notebook Confession Missing',
    subtitle: 'No acknowledged uncertainty — plan claims false completeness',
    color: 'slate',
    feynmanPrinciple:
      'Feynman kept a list titled "Things I Don\'t Know." The honest edge of a plan is where the most interesting thinking lives. A plan with no confessed uncertainty has not earned its confidence.',
    lens: 'Notebook Confession',
  },
}

/** Severity metadata for UI rendering — mirrors Incorruptible pattern. */
export const FEYNMAN_SEVERITY_META: Record<
  FeynmanSeverity,
  { label: string; bg: string; text: string; ring: string; sortOrder: number; weight: number }
> = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-red-600',
    text: 'text-white',
    ring: 'ring-red-900',
    sortOrder: 0,
    weight: 12,
  },
  moderate: {
    label: 'MODERATE',
    bg: 'bg-amber-500',
    text: 'text-white',
    ring: 'ring-amber-700',
    sortOrder: 1,
    weight: 6,
  },
  suggestion: {
    label: 'SUGGESTION',
    bg: 'bg-blue-500',
    text: 'text-white',
    ring: 'ring-blue-700',
    sortOrder: 2,
    weight: 2,
  },
}

/** Source-layer metadata for UI rendering. */
export const FEYNMAN_SOURCE_META: Record<
  FeynmanSourceLayer,
  { label: string; bg: string; text: string }
> = {
  'derived-from-plan':         { label: 'Derived from plan',              bg: 'bg-emerald-100', text: 'text-emerald-900' },
  'cited-feynman-prompts':     { label: 'Cited · Feynman 10 Prompts',     bg: 'bg-indigo-100',  text: 'text-indigo-900' },
  'cited-cargo-cult':          { label: 'Cited · Cargo Cult (Caltech 1974)', bg: 'bg-violet-100',  text: 'text-violet-900' },
  'cited-challenger-app-f':    { label: 'Cited · Challenger App F',       bg: 'bg-orange-100',  text: 'text-orange-900' },
  'cited-feynman-blackboard':  { label: 'Cited · Feynman Blackboard',     bg: 'bg-rose-100',    text: 'text-rose-900' },
  'cited-gilb':                { label: 'Cited · Gilb',                   bg: 'bg-amber-100',   text: 'text-amber-900' },
  'llm-training':              { label: 'LLM training',                   bg: 'bg-slate-100',   text: 'text-slate-700' },
  'generic-template':          { label: 'Template fallback',              bg: 'bg-slate-100',   text: 'text-slate-500' },
}

/** Honesty Score → label (used in panel header and exports). */
export function honestyScoreLabel(score: number): string {
  if (score >= 90) return 'PRISTINE'
  if (score >= 75) return 'SOLID'
  if (score >= 55) return 'TENTATIVE'
  if (score >= 30) return 'FRAGILE'
  return 'CARGO-CULT'
}

/** Banned buzzwords that fire the jargon-curtain category. Audit kept SHORT. */
export const FEYNMAN_BUZZWORDS = [
  'synergize',
  'synergy',
  'leverage',
  'leveraging',
  'optimize',
  'optimization',
  'holistic',
  'paradigm',
  'transform',
  'transformation',
  'reimagine',
  'reimagining',
  'world-class',
  'best-in-class',
  'cutting-edge',
  'next-generation',
  'state-of-the-art',
  'robust',
  'scalable',
  'frictionless',
  'seamless',
  'turnkey',
  'value-add',
] as const

/** Word count helper used by description-too-long detector. */
export function feynmanWordCount(s: string | undefined | null): number {
  if (!s) return 0
  return s.trim().split(/\s+/).filter(Boolean).length
}
