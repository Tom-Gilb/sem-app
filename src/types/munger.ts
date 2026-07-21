// UNIT_TYPE=Types
// munger.ts — types for the Munger Agent (Charlie Munger's 12 Prompts of analytical
// rigor: Inversion / Second-Order / Circle-of-Competence / Bias-Audit / Lollapalooza /
// Opportunity-Cost / Fat-Pitch / Incentive-Map / Simplicity-Filter / Destroy-Own-Idea /
// Long-Game / Deathbed).
//
// Tom Gilb, 2026-06-20 verbatim:
//   "Munger Agent: using CHARLIE MUNGERS RULES in assets, make an analytical agent
//    with all the ideas like sharpening, in agents Elon, Incorruptible, Maria"
//
// Source PDF: `5 - Project/SEM App/assets/Munger Agent/CHARLIE MUNGERS RULES.pdf`
// 12 prompts compiled from Munger's published rules, extracted 2026-06-20.
//
// Conjunction-of-Technologies SUPREME compliance — sources cited per finding:
//   1. The CHARLIE MUNGERS RULES PDF (12 explicit prompts)
//   2. Charlie Munger, *Poor Charlie's Almanack* (1995-2005, multiple editions)
//   3. Munger's 1995 Harvard speech "The Psychology of Human Misjudgment" (25 biases)
//   4. Tom Gilb's books — cross-references (Planguage, EVO, Resilience, SUCCESS)
//   5. The current Plan (deterministic) — what triggered each finding
//
// Every finding carries a sourceLayer badge.
//
// ARCHITECTURAL ALIGNMENT: this types file mirrors `src/types/elon.ts` precisely
// (same Finding/Report/Fix shape) so the Accept-Fix pipeline, source-stamping,
// Universal Undo, and panel render machinery JUST WORK without per-agent code paths.

/** The 12 Munger analytical categories — Tom-confirmed source: CHARLIE MUNGERS RULES PDF.
 *  Order = Munger's original prompt order (Inversion first because that's Munger's most
 *  famous rule and his "abominable no-man" identity hinges on it). */
export type MungerCategory =
  | 'inversion'             // Prompt 1 — "what guarantees I fail?" (then avoid those)
  | 'second-order'          // Prompt 2 — effects of the effects; think 3 steps ahead
  | 'circle-of-competence'  // Prompt 3 — knowing the EDGE of your knowledge
  | 'bias-audit'            // Prompt 4 — 25 cognitive biases catalog
  | 'lollapalooza'          // Prompt 5 — multiple forces compounding (extreme outcomes)
  | 'opportunity-cost'      // Prompt 6 — every yes is a no to something else; "compared to what?"
  | 'fat-pitch'             // Prompt 7 — wait for the perfect opportunity; most aren't worth taking
  | 'incentive-map'         // Prompt 8 — "show me the incentive, I'll show you the outcome"
  | 'simplicity-filter'     // Prompt 9 — explain in 3 sentences to a smart 12-year-old
  | 'destroy-own-idea'      // Prompt 10 — find the ONE fatal flaw before committing
  | 'long-game'             // Prompt 11 — 10/20/30 year timeframes; don't interrupt compounding
  | 'deathbed'              // Prompt 12 — 90 yrs looking back; regret of action vs inaction

/** Per-finding severity. Critical = blocker; moderate = should fix; suggestion = nice-to-have.
 *  Notes:
 *    - 'destroy-own-idea' findings NEVER carry severity 'suggestion' — minimum 'moderate'
 *      (Munger's rule: a fatal flaw IS critical, not optional).
 *    - 'inversion' findings escalate to 'critical' when the failure mode named is
 *      irreversible (lost money, lost stakeholder trust, lost market window). */
export type MungerSeverity = 'critical' | 'moderate' | 'suggestion'

/** Source-layer badge per the Conjunction-of-Technologies rule. Highest provenance first. */
export type MungerSourceLayer =
  | 'derived-from-plan'              // Deterministic from spec data — highest confidence
  | 'cited-munger-prompts'           // The CHARLIE MUNGERS RULES PDF — verbatim Munger prompts
  | 'cited-poor-charlies-almanack'   // Poor Charlie's Almanack (Munger's book)
  | 'cited-munger-psych-misjudgment' // 1995 Harvard speech "Psychology of Human Misjudgment"
  | 'cited-gilb'                     // Cross-reference to Gilb Standards / books
  | 'llm-training'                   // General knowledge of Munger's publicly-stated methods
  | 'generic-template'               // Fallback heuristic — lowest provenance

/** Shape of a single suggested Planguage edit attached to a finding. */
export interface MungerFix {
  /** What KIND of edit the user would apply. Used for routing the Apply button. */
  type:
    | 'add-failure-mode-constraint'    // C. entry: a failure mode the plan must AVOID (Inversion)
    | 'add-second-order-value'         // V. entry: a 2nd/3rd-order metric the plan must measure
    | 'add-competence-edge-constraint' // C. entry: explicit boundary of what the plan does NOT cover
    | 'add-bias-audit-constraint'      // C. entry: a named cognitive bias the plan must check for
    | 'add-lollapalooza-value'         // V. entry: compound-force metric (positive OR negative)
    | 'add-opportunity-cost-constraint'// C. entry: alternative use of resource named explicitly
    | 'add-fat-pitch-filter'           // C. entry: "we will only commit when X / Y / Z conditions met"
    | 'add-incentive-source'           // S. entry stakeholder rationale: name the actual incentive
    | 'simplify-description'           // V./F./S. entry edit: reduce description to ≤ 3 sentences
    | 'add-destroy-test-constraint'    // C. entry: "this plan fails if Z proves true" (testable kill switch)
    | 'add-long-game-wish'             // V. entry: 10/20/30-year Wish horizon on a scalar Value
    | 'add-deathbed-rationale'         // S. entry rationale: long-arc regret framing
    | 'add-constraint'                 // Fallback Plan-level Constraint
  /** The proposed edit expressed as Planguage text. Shown to user for review. */
  asPlanguage: string
  /** Target entry id (V/F/S/C/R) the fix would attach to, or 'plan-level' for plan-wide. */
  targetItemId: string
  /** Human-readable rationale shown in the Accept/Modify/Dismiss card. */
  rationale: string
}

/** A single Munger finding — one analytical defect, with cited source + suggested fix. */
export interface MungerFinding {
  /** Deterministic id — stable across re-runs of the same logical inputs. */
  id: string
  category: MungerCategory
  severity: MungerSeverity
  sourceLayer: MungerSourceLayer
  /** Munger prompt-PDF citation (e.g. "Prompt 4 — Bias Audit"). */
  mungerCitation: string | null
  /** Poor Charlie's Almanack citation (e.g. "Poor Charlie's Almanack ch.11 — 25 biases"). */
  almanackCitation: string | null
  /** Optional Gilb cross-reference (book + chapter / standard file). */
  gilbCitation: string | null
  /** Optional public-URL anchor for verification. */
  verifyUrl: string | null
  /** Which entry triggered this finding ('V.SearchLatency', 'plan-level', etc.). */
  triggeredBy: string
  /** The Munger principle being violated — short label. */
  principleViolated: string
  /** One-sentence explanation in plain English. */
  explanation: string
  /** Suggested Planguage fix the user can Accept / Modify / Dismiss. */
  suggestedFix: MungerFix
  /** One-sentence consequence framing — "what happens if you don't fix this". */
  longTermConsequence: string
  /** Computed at generation time so the UI can sort newest-first if needed. */
  generatedAtIso: string
}

/** Output of a single Munger run on a Plan — grouped + summarised for the UI. */
export interface MungerReport {
  generatedAtIso: string
  planTitle: string
  totalFindings: number
  byCategory: Record<MungerCategory, MungerFinding[]>
  bySeverity: Record<MungerSeverity, number>
  /** Aggregate "Rationality Score" 0-100 — higher = more analytically rigorous per Munger.
   *  Critical findings weight 3× moderate; moderate weight 2× suggestion; suggestions 1×. */
  rationalityScore: number
  /** One-line headline summary the user reads first. */
  headline: string
}

/** Category metadata for UI rendering — label, color, Munger principle one-liner.
 *
 *  Color palette (R/G-colorblind-safe; visually distinguishable):
 *    inversion=red · second-order=violet · competence=blue · bias-audit=amber
 *    lollapalooza=orange · opportunity-cost=emerald · fat-pitch=cyan
 *    incentive-map=rose · simplicity=teal · destroy=indigo · long-game=slate · deathbed=amber */
export const MUNGER_CATEGORY_META: Record<
  MungerCategory,
  { label: string; subtitle: string; color: string; mungerPrinciple: string }
> = {
  'inversion': {
    label: 'Inversion',
    subtitle: 'Don\'t ask "how do I succeed?" Ask "what guarantees I fail?" Then avoid those.',
    color: 'red',
    mungerPrinciple:
      'Munger\'s most famous rule (CHARLIE MUNGERS RULES Prompt 1): always invert. ' +
      '"Invert, always invert" — attributed to Jacobi, repeated by Munger across Berkshire ' +
      'shareholder Q&As for decades. Poor Charlie\'s Almanack: most problems are best ' +
      'understood backwards. List every way a plan can fail before listing how it can succeed.',
  },
  'second-order': {
    label: 'Second-Order Thinking',
    subtitle: 'Effects of the effects — think 3 steps ahead, not 1',
    color: 'violet',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 2: Most people think 1 step ahead; Munger thought 3. ' +
      'First-order: "this decision makes me money." Second-order: "but what does it do to ' +
      'my reputation?" Third-order: "and what does that do to my next 10 deals?" Plans ' +
      'measured only on 1st-order metrics are blind to the consequences of those metrics.',
  },
  'circle-of-competence': {
    label: 'Circle of Competence',
    subtitle: 'The size of your circle doesn\'t matter. Knowing its EDGE does.',
    color: 'blue',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 3: Munger never invested in anything he didn\'t deeply ' +
      'understand. The EDGE of the circle is what matters — knowing what you do NOT know. ' +
      'Plans that don\'t explicitly name what they are NOT trying to do leak scope, leak ' +
      'budget, and leak the planner\'s attention into domains where the planner has no edge.',
  },
  'bias-audit': {
    label: 'Bias Audit',
    subtitle: '25 cognitive biases that destroy decision-making — check each one',
    color: 'amber',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 4 + Munger\'s 1995 Harvard speech "The Psychology of ' +
      'Human Misjudgment" (Poor Charlie\'s Almanack ch.11). 25 biases catalogued: ' +
      'confirmation bias, incentive bias, social proof, scarcity, commitment bias, ' +
      'availability heuristic, anchoring, loss aversion, and 17 more. A plan with no ' +
      'bias-audit Constraint is silently shaped by whichever bias the author has most.',
  },
  'lollapalooza': {
    label: 'Lollapalooza Forces',
    subtitle: 'Multiple forces compounding in the same direction → extreme outcomes',
    color: 'orange',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 5: Munger\'s term for multi-force compounding — when ' +
      'several biases / incentives / pressures align, outcomes are MUCH larger than the ' +
      'sum of parts (good or bad). Plans that ignore compound effects underestimate both ' +
      'upside (positive lollapalooza) and downside (catastrophic failure cascades).',
  },
  'opportunity-cost': {
    label: 'Opportunity Cost',
    subtitle: 'Every yes is a no to something else. Always ask: compared to what?',
    color: 'emerald',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 6: Munger never evaluated anything in isolation. ' +
      'Every commitment of time/money/attention is a forfeit of the next-best alternative ' +
      'use of that resource. Plans without a named alternative-use comparison silently ' +
      'over-commit because the implicit baseline is "doing nothing", not "doing X instead".',
  },
  'fat-pitch': {
    label: 'Fat Pitch Filter',
    subtitle: 'Wait for the perfect opportunity. Most aren\'t worth taking.',
    color: 'cyan',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 7: Munger believed in DOING NOTHING until the ' +
      'perfect opportunity appeared — then swinging hard. Plans that commit to too many ' +
      'parallel initiatives dilute the planner\'s attention; one over-the-fence pitch ' +
      'cleanly hit beats 10 weak base hits.',
  },
  'incentive-map': {
    label: 'Incentive Map',
    subtitle: '"Show me the incentive and I\'ll show you the outcome"',
    color: 'rose',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 8 + Munger\'s most-repeated public lesson. Every ' +
      'stakeholder, every supplier, every reviewer has an ACTUAL incentive that may ' +
      'differ from their STATED incentive. Plans that don\'t map the actual incentives ' +
      'of every party silently get reshaped by them. Compose with Gilb Stakeholder ' +
      'Engineering — every Stakeholder entry should name the actual driving incentive.',
  },
  'simplicity-filter': {
    label: 'Simplicity Filter',
    subtitle: 'If you can\'t explain it in 3 sentences to a smart 12-year-old, you don\'t understand it',
    color: 'teal',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 9: Munger hated complexity. He passed on hundreds ' +
      'of deals because he couldn\'t reduce them to a simple thesis. Plans whose ' +
      'descriptions cannot be reduced to ≤ 3 sentences carry hidden complexity that ' +
      'will surface as scope creep, miscommunication, or unbuildable solutions.',
  },
  'destroy-own-idea': {
    label: 'Destroy Your Own Idea',
    subtitle: 'Find the ONE fatal flaw that kills the whole thing — before committing',
    color: 'indigo',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 10: Before Munger committed to anything, he tried ' +
      'to destroy it himself. He played the role of the smartest, most skeptical critic ' +
      'alive — and looked for the one argument that completely undermines the thesis. ' +
      'Plans that haven\'t survived a deliberate destruction attempt are untested.',
  },
  'long-game': {
    label: 'Long Game',
    subtitle: 'Look 10, 20, 30 years ahead. Don\'t interrupt compounding unnecessarily.',
    color: 'slate',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 11: Munger made most of his fortune AFTER age 65. ' +
      'The secret to wealth: don\'t interrupt compounding without reason. Plans that ' +
      'optimize only short-term metrics (next quarter, next year) silently destroy the ' +
      'long-arc value that compounding would have produced. Compose with Incorruptible ' +
      'Agent — quarterly-tyranny is the same pattern at a different name.',
  },
  'deathbed': {
    label: 'Deathbed Filter',
    subtitle: 'At 90 years old looking back — would I regret doing this? Or NOT doing it?',
    color: 'amber',
    mungerPrinciple:
      'CHARLIE MUNGERS RULES Prompt 12: Munger\'s final filter for any major decision. ' +
      'Imagine yourself at 90 looking back. The regret of action vs the regret of ' +
      'inaction — most people overweight regret of action and underweight regret of ' +
      'inaction. Plans that fail the deathbed test are usually safe bets that compound ' +
      'into a small life. Plans that pass it are usually big bets that compound into ' +
      'a meaningful one.',
  },
}

/** Severity metadata for UI rendering. */
export const MUNGER_SEVERITY_META: Record<
  MungerSeverity,
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
export const MUNGER_SOURCE_META: Record<
  MungerSourceLayer,
  { label: string; bg: string; text: string }
> = {
  'derived-from-plan':              { label: 'Derived from plan',           bg: 'bg-emerald-100', text: 'text-emerald-900' },
  'cited-munger-prompts':           { label: 'Cited · Munger Prompts',      bg: 'bg-amber-100',   text: 'text-amber-900' },
  'cited-poor-charlies-almanack':   { label: 'Cited · Poor Charlie\'s Almanack', bg: 'bg-orange-100',  text: 'text-orange-900' },
  'cited-munger-psych-misjudgment': { label: 'Cited · Psychology of Misjudgment', bg: 'bg-rose-100', text: 'text-rose-900' },
  'cited-gilb':                     { label: 'Cited · Gilb',                bg: 'bg-violet-100',  text: 'text-violet-900' },
  'llm-training':                   { label: 'LLM training',                bg: 'bg-slate-100',   text: 'text-slate-700' },
  'generic-template':               { label: 'Template fallback',           bg: 'bg-slate-100',   text: 'text-slate-500' },
}
