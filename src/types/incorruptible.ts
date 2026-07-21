// UNIT_TYPE=Types
// incorruptible.ts — types for the Incorruptible Agent (Eric Ries 2026 book).
//
// Tom Gilb, 2026-06-11 verbatim:
//   "I want a new Agent, called 'Incorruptible' (E Ries book 2026) which if let loose will
//    help planners design and check strategic planning, to follow the rules Eric lays out
//    in his book, so that the result is 'incorruptible' (Quarterly results cannot determin
//    quality or long term thinking)"
//
// Sources Conjunction (per Conjunction-of-Technologies SUPREME rule):
//   1. Eric Ries — Incorruptible (2026)                — primary principle source
//   2. Ries — Long-Term Stock Exchange (LTSE) governance — verifiable supplement (ltse.com)
//   3. Gilb — Stakeholder Engineering (CE / SEA)       — Planguage compositional layer
//   4. Gilb — EVO 2024 ch.2                            — long-horizon Evo cycles
//   5. The current Plan (deterministic)                — what triggered each finding
//
// Every finding carries a sourceLayer badge per the Conjunction rule.

/** The six diagnostic categories — each maps to a Ries principle. */
export type IncorruptibleCategory =
  | 'quarterly-tyranny'        // Short-term metrics without long-horizon counterweights
  | 'stakeholder-monoculture'  // Shareholder primacy / missing long-term stakeholders
  | 'mission-drift'            // Values don't trace to mission / constraints contradict it
  | 'founder-vision-erosion'   // No transformational Wish; goals match competitors only
  | 'innovation-budget-predation' // R&D budget treated as residual
  | 'governance-hole'          // No explicit decision locks / accountability cadence

/** Per-finding severity. Critical = blocker; moderate = should fix; suggestion = nice-to-have. */
export type IncorruptibleSeverity = 'critical' | 'moderate' | 'suggestion'

/**
 * Source-layer badge per the Conjunction-of-Technologies rule.
 * Highest provenance first.
 */
export type IncorruptibleSourceLayer =
  | 'derived-from-plan'        // Deterministic from spec data — highest confidence
  | 'cited-ries-incorruptible' // Specific quote/principle from the 2026 book
  | 'cited-ltse-governance'    // Published LTSE governance pattern (ltse.com)
  | 'cited-gilb'               // Cross-reference to Gilb Standards / books
  | 'llm-training'             // General knowledge from LLM training
  | 'generic-template'         // Fallback heuristic — lowest provenance

/** Shape of a single suggested Planguage edit attached to a finding. */
export interface IncorruptibleFix {
  /** What KIND of edit the user would apply. Used for routing the Apply button. */
  type:
    | 'add-wish'               // Add a Wish > Goal × 2 with Wish-When ≥ 36 months
    | 'add-stakeholder'        // Add a long-horizon or inanimate stakeholder
    | 'add-constraint'         // Add a C. entry locking some non-negotiable
    | 'raise-goal-when'        // Push Goal-When out further
    | 'add-evo-step'           // Add an Evo Step explicitly for "explore" not "exploit"
    | 'add-source-charter'     // Stamp a V. entry with Source: Charter / Mission
    | 'add-governance-cadence' // Add explicit review cadence to a Resource or Plan-level field
    | 'add-resource'           // r93ff — Add an R. entry tagged "innovation" / "R&D" — clears innovation-budget-predation
  /** The proposed edit expressed as Planguage text. Shown to user for review. */
  asPlanguage: string
  /** Target entry id (V/F/S/C/R) the fix would attach to, or 'plan-level' for plan-wide. */
  targetItemId: string
  /** Human-readable rationale shown in the Accept/Modify/Dismiss card. */
  rationale: string
}

/** A single Incorruptible finding — one violation, with cited source + suggested fix. */
export interface IncorruptibleFinding {
  /** Deterministic id — r93l lesson: stable across re-runs of the same logical inputs. */
  id: string
  category: IncorruptibleCategory
  severity: IncorruptibleSeverity
  sourceLayer: IncorruptibleSourceLayer
  /** Ries chapter / page reference — verified later from Tom's Kindle if sourceLayer = cited-ries. */
  riesCitation: string | null
  /**
   * r41 v414 (Tom Gilb 2026-07-01 "I added incorruptible glossary to assets …
   * please integrate them into the incorruptible agent"): canonical Ries
   * Glossary term slugs this finding invokes.  Every finding shipped by the
   * deterministic engine MUST populate this array from `riesGlossary.ts`.
   * The panel renders these as chips → tapping a chip surfaces the verbatim
   * Ries definition.  This is how the agent stops paraphrasing and starts
   * citing verbatim.  Empty array is allowed as a fallback for legacy findings
   * during migration, but every NEW finding must set it.
   */
  riesGlossaryTerms: readonly string[]
  /**
   * r41 v414 — Optional map of role-sensitivity levels.  When present, the
   * panel highlights findings whose sensitivity matches the currently-picked
   * planner role (from `riesReadersGuides.ts`).  Absent = universal.
   */
  roleSensitivity?: {
    founder?:       'high' | 'med'
    investor?:      'high' | 'med'
    employee?:      'high' | 'med'
    consumer?:      'high' | 'med'
    'board-director'?: 'high' | 'med'
  }
  /**
   * r41 v414 — EOT case-study slugs (from `riesEotCaseStudies.ts`) that
   * exemplify a real-world implementation of the principle this finding
   * invokes.  Panel renders as a "Real-world example →" chip that links to
   * commontrust.com.  Empty array is allowed.
   */
  evidenceEotCases: readonly string[]
  /** Optional Gilb cross-reference (book + chapter / standard file). */
  gilbCitation: string | null
  /** Optional public-URL anchor for verification (LTSE.com pages, etc.). */
  verifyUrl: string | null
  /** Which entry triggered this finding ('V.QuarterlyRevenue', 'plan-level', etc.). */
  triggeredBy: string
  /** The Ries principle being violated — short label. */
  principleViolated: string
  /** One-sentence explanation in plain English. */
  explanation: string
  /** Suggested Planguage fix the user can Accept / Modify / Dismiss. */
  suggestedFix: IncorruptibleFix
  /** One-sentence long-term consequence framing — "what happens if you don't fix this". */
  longTermConsequence: string
  /** Computed at generation time so the UI can sort newest-first if needed. */
  generatedAtIso: string
}

/** Output of a single Incorruptible run on a Plan — grouped + summarised for the UI. */
export interface IncorruptibleReport {
  generatedAtIso: string
  planTitle: string
  totalFindings: number
  byCategory: Record<IncorruptibleCategory, IncorruptibleFinding[]>
  bySeverity: Record<IncorruptibleSeverity, number>
  /** Aggregate "incorruptibility score" 0-100 — higher = more resilient to short-termism. */
  incorruptibilityScore: number
  /** One-line headline summary the user reads first. */
  headline: string
}

/** Category metadata for UI rendering — label, color, Ries principle one-liner. */
export const INCORRUPTIBLE_CATEGORY_META: Record<
  IncorruptibleCategory,
  { label: string; subtitle: string; color: string; riesPrinciple: string }
> = {
  'quarterly-tyranny': {
    label: 'Quarterly Tyranny',
    subtitle: 'Short-term metrics without long-horizon counterweights',
    color: 'red',
    riesPrinciple:
      'Ries: short-term metrics cannot be the only metrics — every quarterly Goal needs a multi-year Wish counterweight.',
  },
  'stakeholder-monoculture': {
    label: 'Stakeholder Monoculture',
    subtitle: 'Shareholder primacy / missing long-term + inanimate stakeholders',
    color: 'amber',
    riesPrinciple:
      'Ries (via LTSE charter): incorruptibility requires multi-stakeholder accountability — not just shareholders + customers.',
  },
  'mission-drift': {
    label: 'Mission Drift',
    subtitle: 'Values don\'t trace to mission / constraints contradict it',
    color: 'violet',
    riesPrinciple:
      'Ries: the founding mission is a CONSTRAINT, not aspiration. Values that don\'t trace to mission erode it.',
  },
  'founder-vision-erosion': {
    label: 'Founder-Vision Erosion',
    subtitle: 'No transformational Wish; Goals just match competitors',
    color: 'indigo',
    riesPrinciple:
      'Ries (extending Paul Graham\'s "founder mode" 2024): the original transformational Wish gets sanded down by incrementalism unless explicitly protected.',
  },
  'innovation-budget-predation': {
    label: 'Innovation Budget Predation',
    subtitle: 'R&D budget treated as residual after quarterly targets',
    color: 'orange',
    riesPrinciple:
      'Ries: R&D budget treated as a residual after quarterly targets = institutionalised short-termism. Floor first, residual last.',
  },
  'governance-hole': {
    label: 'Governance Hole',
    subtitle: 'No explicit decision locks / accountability cadence',
    color: 'slate',
    riesPrinciple:
      'Ries: incorruptibility is structural. Without explicit decision locks and accountability cadences, structure decays.',
  },
}

/** Severity metadata for UI rendering. */
export const INCORRUPTIBLE_SEVERITY_META: Record<
  IncorruptibleSeverity,
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
export const INCORRUPTIBLE_SOURCE_META: Record<
  IncorruptibleSourceLayer,
  { label: string; bg: string; text: string }
> = {
  'derived-from-plan':         { label: 'Derived from plan',      bg: 'bg-emerald-100', text: 'text-emerald-900' },
  'cited-ries-incorruptible':  { label: 'Cited · Ries Incorruptible', bg: 'bg-indigo-100',  text: 'text-indigo-900' },
  'cited-ltse-governance':     { label: 'Cited · LTSE',           bg: 'bg-violet-100',  text: 'text-violet-900' },
  'cited-gilb':                { label: 'Cited · Gilb',           bg: 'bg-rose-100',    text: 'text-rose-900' },
  'llm-training':              { label: 'LLM training',           bg: 'bg-slate-100',   text: 'text-slate-700' },
  'generic-template':          { label: 'Template fallback',      bg: 'bg-slate-100',   text: 'text-slate-500' },
}
