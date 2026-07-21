// UNIT_TYPE=Data
//
// sharpenJustification.ts — Solution Justification: the "why did we suggest this?"
// layer for every sharpening suggestion in the SEM App.
//
// SOURCE: Tom Gilb 2026-06-08 verbatim:
//   "I would like to try to add (and if it works to spread to all other
//    sharpening) the idea I'll call Solution Justification: attached to each
//    new or modified solution. This is similar in principle to my IET Evidence
//    and Source, and ± uncertainty (CE).
//    For every individual new or updated solution, value, stakeholder or
//    constraint: the following Justifications will be offered:
//      1. Analysis: what in the current specs caused us to make this change?
//      2. What in our knowledge base caused us to offer this change
//         (URL, Searchable names to cases, papers)?
//      3. On a scale of 0 to 10 how credible is it that this change is
//         an improvement"
//
// Analogy in Gilb's published standards:
//   - IET Evidence field (CE) — what evidence supports this requirement?
//   - IET Source field (CE) — who/what is the authority?
//   - ± Uncertainty (CE) — how confident are we in the measurement?
//   Together these three fields give EVERY suggestion an audit trail.
//
// DESIGN:
//   - Pure TypeScript — no Vue coupling. Twin-portable.
//   - SuggestionJustification is a parallel array alongside suggestedAnswers[]
//     in each sharpening question (same index).
//   - When per-suggestion data is absent, callers fall back to:
//       analysis    → q.rationale
//       knowledgeBase → theme.gilbSource
//       credibility → 7  (well-grounded default — most Gilb-cited suggestions are)
//   - CredibilityZone maps the 0-10 integer to a 4-level semantic band.
//
// USAGE:
//   - Imported by solutionSharpInterview.ts (SuggestionJustification in question data)
//   - Imported by SolutionSharpenPanel.vue (rendering helpers)
//   - Will be imported by EvoSharpInterview, ResourcesSharpenPanel etc. when
//     the justification pattern spreads (Tom's stated intention).

/** One justification record attached to a single sharpening suggestion. */
export interface SuggestionJustification {
  /**
   * ANALYSIS — what in the current spec situation triggered this suggestion.
   * Answers: "Why is this suggestion relevant right now?"
   * Maps to: IET Evidence field in CE.
   */
  analysis: string

  /**
   * KNOWLEDGE BASE — Gilb citation + external paper / URL / case reference.
   * Multiple sources separated by ' · '.
   * Answers: "What body of knowledge backs this claim?"
   * Maps to: IET Source field in CE.
   */
  knowledgeBase: string

  /**
   * CREDIBILITY — 0–10 confidence that this suggestion improves the spec.
   *   10 = empirically proven, directly measured
   *    9 = very strong principle, near-universal in literature
   *    8 = strong principle, Gilb-cited, widely agreed
   *    7 = well-grounded heuristic, context-dependent (default for good suggestions)
   *    5 = situational — works in some contexts, not others
   *    3 = speculative — plausible but weak evidence
   *    0 = brainstorm only — offered to provoke thinking, not as advice
   * Maps to: ±Uncertainty in CE.
   */
  credibility: number
}

// ── Credibility zone ───────────────────────────────────────────────────────────
// Collapses the 0-10 integer into a 4-level semantic band for UI rendering.

export type CredibilityZone = 'high' | 'good' | 'moderate' | 'speculative'

/** Map a 0-10 credibility score to a semantic zone. */
export function credibilityZone(score: number): CredibilityZone {
  if (score >= 9) return 'high'
  if (score >= 7) return 'good'
  if (score >= 5) return 'moderate'
  return 'speculative'
}

/** Tailwind dot background class per zone (DD-017: readable on white). */
export const CREDIBILITY_DOT_CLASS: Record<CredibilityZone, string> = {
  high:       'bg-emerald-500',
  good:       'bg-cyan-500',
  moderate:   'bg-amber-400',
  speculative: 'bg-red-400',
}

/** Tailwind text/border/bg chip classes per zone (used for score label). */
export const CREDIBILITY_LABEL_CLASS: Record<CredibilityZone, string> = {
  high:       'text-emerald-700 border-emerald-300 bg-emerald-50',
  good:       'text-cyan-700 border-cyan-300 bg-cyan-50',
  moderate:   'text-amber-700 border-amber-300 bg-amber-50',
  speculative: 'text-red-700 border-red-300 bg-red-50',
}

/** Human-readable label per zone. */
export const CREDIBILITY_ZONE_LABEL: Record<CredibilityZone, string> = {
  high:       'High confidence',
  good:       'Well-grounded',
  moderate:   'Situational',
  speculative: 'Speculative',
}

/**
 * The default credibility applied when a suggestion has no explicit
 * SuggestionJustification — Gilb-cited suggestions generally meet this bar.
 */
export const DEFAULT_CREDIBILITY = 7
