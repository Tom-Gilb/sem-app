// UNIT_TYPE=Hook
// usePlanguageTerms — Canonical Planguage Glossary definitions for the
// Tolerable / Goal / Wish family and their STG (Status · Tolerable · Goal)
// ranges. Source of truth: /10.Standard/2.Glossary/PlanguageGlossary/.
//
// Tom Gilb 2026-06-06: "Look in Glossary for the critical concepts.
// Tolarable is minimum 'non failure', Wish is stakeholders dream (independent
// of costs and physics) complete satisfaction (they would not pay for more).
// Goal is the level the project will promise and commit to given all the
// other value and resource factors and all competing stakeholders. This is
// fundamental glossary CE Planguage, and you need to apply these glossary
// definition understanding in all tools, especially Multivision."
//
// Usage:
//   import { PLANGUAGE_TERMS } from '@/composables/usePlanguageTerms'
//   const tol = PLANGUAGE_TERMS.Tolerable
//   tooltip = `${tol.keyedIcon} ${tol.role} — ${tol.shortDef}`
//
// Spec: applies in every SEM App tool that surfaces a scalar attribute level.
// Glossary source: 10.Standard/2.Glossary/PlanguageGlossary/{Tolerable.539,
// Goal.109, Wish.244}.md
//
// Architectural notes:
//   - These constants are FROZEN at build time — they reflect the canonical
//     Planguage definitions as authored by Tom Gilb. Do NOT paraphrase or
//     soften the survival-line / commitment / dream semantics — those are
//     load-bearing.
//   - The "tooltipFull" strings are sized for HTML title= attributes (max
//     ~250 chars displays cleanly in macOS / Windows). Longer prose lives
//     in expandable cards rendered by individual components.

export interface PlanguageTerm {
  /** Canonical name (English). */
  name: string
  /** Glossary concept number (e.g. "*539" for Tolerable). */
  conceptNumber: string
  /** Planguage keyed icon (see Glossary). */
  keyedIcon: string
  /** Concise role label — what it IS in the STG framework. */
  role: string
  /** ≤ 80-char headline definition. */
  shortDef: string
  /** ≤ 250-char tooltip-sized longer definition. */
  tooltipFull: string
  /** Multi-paragraph prose suitable for an expandable card. */
  longDef: string[]
  /** STG range or framework position. */
  stgPosition: string
  /** Commitment category — the load-bearing semantic. */
  commitment: 'no-commitment (project alive)' | 'committed promise' | 'no-commitment (stakeholder dream)'
}

/**
 * Canonical Planguage conditions for a valid Goal *109.
 * From the Glossary: a Goal that fails ANY of these is not a valid commitment.
 *
 * Tom Gilb 2026-06-06: "the Goal (see official definition please, there about
 * 8 conditions for a Goal to be official), this is advanced and very useful
 * and central Planguage theory) becomes a Goal ONLY when the Goal conditions
 * (like feasible, economical, balanced, prioritized) i met."
 *
 * Source: Glossary `Goal.109.md` → "Conditions for a valid Goal level".
 *
 * `autoCheckable` flags whether SEM can heuristically check the condition
 * from spec data alone, vs requiring domain judgement (the latter must
 * surface as a question to the user).
 */
export interface GoalValidityCondition {
  /** Canonical name from the Glossary. */
  name: string
  /** Glossary "what it means" phrase. */
  meaning: string
  /** Whether SEM can heuristically evaluate this from spec data. */
  autoCheckable: boolean
}

export const GOAL_VALIDITY_CONDITIONS: ReadonlyArray<GoalValidityCondition> = Object.freeze([
  {
    name: 'Technically possible',
    meaning: 'The level is achievable within the current state of the art.',
    autoCheckable: false,
  },
  {
    name: 'Economically possible',
    meaning: 'The required resources exist or will exist by the stated time.',
    autoCheckable: false,
  },
  {
    name: 'Cost-consistent',
    meaning: 'Compatible with the project\'s other resource and time requirements.',
    autoCheckable: true,   // OPTIMA-style balance check against Budget / R. entries
  },
  {
    name: 'Effective',
    meaning: 'The effect satisfies the stakeholder need it claims to address.',
    autoCheckable: false,
  },
  {
    name: 'Profitable',
    meaning: 'Value delivered exceeds cost incurred.',
    autoCheckable: true,   // V/C ratio > 1 in the impact table
  },
  {
    name: 'Prioritised',
    meaning: 'Ranked correctly by the chosen rules (effectiveness, profitability, politics).',
    autoCheckable: true,   // Global Priority sets a rank; check it exists
  },
  {
    name: 'Conditions true',
    meaning: 'All […] qualifiers in the Goal statement actually hold at evaluation time.',
    autoCheckable: true,   // Heuristic: presence of bracketed qualifiers
  },
])

export const PLANGUAGE_TERMS: {
  Tolerable: PlanguageTerm
  Goal: PlanguageTerm
  Wish: PlanguageTerm
  Stretch: PlanguageTerm
  Target: PlanguageTerm
  Constraint: PlanguageTerm
  Ambition: PlanguageTerm
  PercentageImpact: PlanguageTerm
} = Object.freeze({
  // ── Tolerable *539 — the project-viability line ──────────────────────────
  Tolerable: Object.freeze({
    name: 'Tolerable',
    conceptNumber: '*539',
    keyedIcon: '>>',
    role: 'Project-viability threshold',
    shortDef: 'Minimum non-failure level. Below it the whole project fails.',
    tooltipFull:
      'TOLERABLE >> · Project-viability threshold. Minimum non-failure level. ' +
      'Below it the WHOLE PROJECT fails — not just this attribute. ' +
      'Tolerable is NOT "good enough"; it is the survival line. ' +
      'Above Tolerable but below Goal = project alive, target not yet reached.',
    longDef: [
      'Tolerable is the single most critical threshold in the STG (Status · Tolerable · Goal) framework.',
      'Below Tolerable, the WHOLE PROJECT fails — not just the attribute value. This is stronger than a defect: it is the project-existence boundary.',
      'Above Tolerable but below Goal = the project is ALIVE but the committed target has not yet been reached.',
      'Tolerable is NOT "good enough" — it is the minimum at which the project survives. Stakeholders at Tolerable performance are explicitly acknowledging that the project is surviving, not succeeding.',
    ],
    stgPosition: 'lower threshold of the Tolerable Range',
    commitment: 'no-commitment (project alive)',
  }),

  // ── Goal *109 — the committed promise (with 7 validity conditions) ──────
  // Tom Gilb 2026-06-06 doctrinal correction: "A Goal cannot be set without
  // respect to all other simultaneous value and resource factors!  This Goal
  // condition should be as automatic evaluated by SEM as possible. It is
  // related to the OPTIMA book balancing."  See GOAL_VALIDITY_CONDITIONS for
  // the canonical 7-condition checklist from Goal.109.md.
  Goal: Object.freeze({
    name: 'Goal',
    conceptNumber: '*109',
    keyedIcon: '>',
    role: 'Committed promise · valid only when 7 conditions hold',
    shortDef: 'The level the project COMMITS to deliver — VALID only after 7 conditions are met.',
    tooltipFull:
      'GOAL > · Committed promise. The level the project commits to deliver, ' +
      'negotiated against ALL other Values, Resources, and competing stakeholders. ' +
      'A Goal becomes OFFICIAL only when 7 validity conditions hold (technically + ' +
      'economically possible, cost-consistent, effective, profitable, prioritised, ' +
      'qualifying conditions true). Until then it is a proposed level, not a Goal.',
    longDef: [
      'Goal is the COMMITTED performance target — the level the project agrees to deliver, against which delivery will be measured.',
      'A Goal carries an implicit commitment to deliver — this is what distinguishes it from Wish or Stretch, which are aspirations without commitment.',
      'A Goal CANNOT be set in isolation. The committed level is the result of a trade-off against ALL other Values, Resources, and competing stakeholders SIMULTANEOUSLY. A proposed level becomes an OFFICIAL Goal only when the 7 Glossary validity conditions all hold: technically possible · economically possible · cost-consistent · effective · profitable · prioritised · qualifying conditions true. SEM should evaluate these conditions as automatically as possible (related to the OPTIMA book balancing methodology).',
      'A reached Goal reasonably satisfies the relevant stakeholders. Beyond Goal = diminishing returns. An attribute in the Success Range (Status ≥ Goal) has declared success and receives no priority for further improvement. This is the economic stop signal.',
    ],
    stgPosition: 'upper threshold of the Tolerable Range; start of Success Range',
    commitment: 'committed promise',
  }),

  // ── Percentage Impact *306 — the IET relative-scale principle ────────────
  // Tom Gilb 2026-06-06 verbatim: "We in IET score Impacts independently of
  // the actual defined scale. The impacts are 0% (does not move the needly
  // from defined benchmark (status or past). 100% meets the stakeholder wish
  // level (on time within budget), or meets a Goal which has been committed
  // earlier). So these are RELATIVE (TO SPECS) IMPACT SCORES. They can be
  // easily (Cent/Fahren) converted to real scale numbers (see IET chapter in
  // CE book). The relative scale, % target achievement, is necessary and
  // useful to permit adding and comparing variables with different scales of
  // measure."
  // Source: Glossary Percentage-Impact.306.md — same canonical normalisation.
  // The commitment field doesn't apply here — Percentage Impact is a SCALE,
  // not a target level — but we keep the field-shape uniform for the type.
  PercentageImpact: Object.freeze({
    name: 'Percentage Impact',
    conceptNumber: '*306',
    keyedIcon: '%.→',
    role: 'IET relative scale · % Target Achievement',
    shortDef: '0% = at Past/benchmark · 100% = target reached (Goal or Wish).',
    tooltipFull:
      'PERCENTAGE IMPACT %.→ · The IET relative scale. 0% = at the Past / ' +
      'benchmark level (no improvement). 100% = the target is reached — ' +
      'either a Goal which has been committed, OR the stakeholder Wish ' +
      'level (on time, within budget). Like Celsius / Fahrenheit, the scale ' +
      'is convertible to real native-unit numbers (CE book IET chapter). ' +
      'The relative scale lets us ADD and COMPARE Values with different ' +
      'native units (%, days, defects, $, FTE…).',
    longDef: [
      'Percentage Impact is the normalised relative-scale form used in every IET (Impact Estimation Table) and VDT (Value Decision Table) computation in Planguage.',
      '0 % = at the chosen benchmark (Past or Status — no improvement from the current level). 100 % = the target is reached — a Goal which has been committed, OR the stakeholder Wish level (on time, within budget).',
      'Why a relative scale at all: different Values have different native units (% of students passing, milliseconds of latency, defects per release, $ of revenue). You cannot ADD or COMPARE them on their native scales. The Percentage Impact gives a common denominator — the same 0–100 scale for every Value entry.',
      'Like Celsius / Fahrenheit, the IET scale is straightforwardly convertible to real native-unit numbers (see the IET chapter in Tom Gilb\'s Competitive Engineering book). The conversion is `native_value = Past + (IET_percent / 100) × (Target − Past)`.',
    ],
    stgPosition: '0–100% from benchmark to target — independent of the Tolerable / Goal / Wish positions on the native scale',
    commitment: 'no-commitment (project alive)',
  }),

  // ── Target *048 — class of Requirements seriously planned to reach ───────
  // Tom Gilb 2026-06-06: "You can MEET a target (wish, goal, stretch)".
  // Targets are the class of Requirements the project SERIOUSLY plans to reach.
  // Contrasts with Constraint (must not violate) and with Wish-as-uncommitted-aspiration.
  // Source: Glossary Target.048.md
  Target: Object.freeze({
    name: 'Target',
    conceptNumber: '*048',
    keyedIcon: '@',
    role: 'Requirement we seriously plan to reach',
    shortDef: 'A Requirement class the project seriously plans to reach. You CAN meet a Target.',
    tooltipFull:
      'TARGET @ · Class of Requirements the organisation SERIOUSLY commits to reach. ' +
      'Resources, effort, accountability allocated. Subclasses: Goal (committed), Stretch ' +
      '(ambitious), Wish (uncommitted dream). You MEET a Target. Contrasts with Constraint ' +
      '(must not violate) and Ambition (vague summary — cannot be met).',
    longDef: [
      'Targets are the class of Requirements that the organisation SERIOUSLY plans to reach. The defining characteristic is the seriousness of the plan: a Target is not a hope or a wish — it implies that resources, effort, and accountability are allocated to reach it.',
      'You CAN MEET a Target. Targets are quantified levels on a defined Scale of Measure — meeting them is a precise, measurable outcome.',
      'Targets contrast with Constraints (which must not be violated) and with Ambitions (informal vague summaries, not quantified). The keyed icon @ marks Target values in Planguage specifications.',
      'Subclasses: Goal (committed Target), Stretch (ambitious Target above Goal), Wish (uncommitted Target — the stakeholder dream). All are Targets in the Planguage sense — they are precise levels you can meet.',
    ],
    stgPosition: 'parent class of Goal, Stretch, Wish',
    commitment: 'committed promise',
  }),

  // ── Constraint *218 — firm boundary that must not be violated ────────────
  // Tom Gilb 2026-06-06: "You can MEET any Constraint (Tolerable)".
  // Tolerable is a Scalar Constraint. Meeting a Constraint = staying on the
  // acceptable side of the boundary. Contrasts with Target (we plan to REACH).
  Constraint: Object.freeze({
    name: 'Constraint',
    conceptNumber: '*218',
    keyedIcon: '!',
    role: 'Firm boundary that must NOT be violated',
    shortDef: 'A firm boundary we must not violate. Tolerable is a Scalar Constraint.',
    tooltipFull:
      'CONSTRAINT ! · A firm boundary that must NOT be violated. Tolerable is a ' +
      'Scalar Constraint — the project-viability threshold. You MEET a Constraint ' +
      'by staying on the acceptable side. Contrasts with Target (we plan to REACH).',
    longDef: [
      'A Constraint is a firm boundary that must NOT be violated. Violating it means the project (or attribute) is unacceptable.',
      'You MEET a Constraint by staying on the acceptable side of the boundary — not by reaching it. Constraints define what is forbidden; Targets define what is sought.',
      'Tolerable is the canonical Scalar Constraint in the STG framework — the project-viability threshold. Below Tolerable the whole project fails.',
      'Constraints contrast with Targets (which we plan to reach) and with Ambitions (vague informal summaries — not enforceable as boundaries).',
    ],
    stgPosition: 'parent class of Tolerable, Fail, Survival',
    commitment: 'committed promise',
  }),

  // ── Ambition *423 — informal vague summary, NOT a precise level ──────────
  // Tom Gilb 2026-06-06 verbatim: "Ambition (like 'much better security') is a
  // rough direction, and a rough range. So you can move in the right direction
  // to the right range. But that is too vague for serious purposes. it is
  // called management BS. That is the MAIN POINT OF Planguage !!!"
  // Source: Glossary Ambition.423.md
  Ambition: Object.freeze({
    name: 'Ambition',
    conceptNumber: '*423',
    keyedIcon: '@.∑',
    role: 'Informal one-sentence summary · NOT a quantified level',
    shortDef: 'A rough direction + rough range. Vague — cannot be "met". Management-BS unless quantified.',
    tooltipFull:
      'AMBITION @.∑ · A vague informal one-sentence summary of a requirement\'s ' +
      'level (e.g. "much better security"). A rough direction + rough range. ' +
      'CANNOT BE MET — it is not precise. The Planguage purpose is to escape ' +
      'this management-BS by converting Ambition into precise Constraints (Tolerable) ' +
      'and Targets (Goal / Stretch / Wish) on a defined Scale of Measure.',
    longDef: [
      'Ambition is the informal first-sentence summary of a requirement — a phrase like "much better security" or "competitively easy to use".',
      'Ambition is VAGUE. It carries a rough direction and a rough range but no precise quantified level. You cannot MEET an Ambition because there is no defined boundary to reach.',
      'This is the management-BS pattern Planguage exists to escape. Vague ambitions presented as if they were targets cannot be measured, cannot be tested, cannot be delivered with confidence — they are language without contract.',
      'The Planguage discipline is to ALWAYS convert Ambition into precise Constraints (Tolerable) and Targets (Goal, Stretch, Wish) on a defined Scale of Measure. The Ambition statement can remain as the first-sentence summary, but the binding spec is the quantified Constraint + Target structure beneath it.',
    ],
    stgPosition: 'pre-quantification informal summary — not on the STG scale at all',
    commitment: 'no-commitment (project alive)',
  }),

  // ── Stretch *404 — ambitious Target above Goal, below Wish ───────────────
  // Tom Gilb 2026-06-06: "You can MEET a target (wish, goal, stretch)".
  Stretch: Object.freeze({
    name: 'Stretch',
    conceptNumber: '*404',
    keyedIcon: '>+',
    role: 'Ambitious Target above Goal',
    shortDef: 'Ambitious aspiration above the committed Goal but below the Wish.',
    tooltipFull:
      'STRETCH >+ · An ambitious Target above the committed Goal but below ' +
      'the Wish. What the team could achieve with exceptional performance — ' +
      'aspirational but realistic. "Outstanding" in Intel\'s 2003 vocabulary.',
    longDef: [
      'Stretch is an ambitious Target level set above the committed Goal but below the Wish.',
      'Where the Goal represents the committed minimum for project success, a Stretch represents what the team could achieve with EXCEPTIONAL performance — aspirational but realistic.',
      'Stretch motivates beyond the baseline. You CAN meet a Stretch (it is a Target, quantified).',
      'Origin: Pete Fuenfhausen, Nokia, Dallas TX, 1999. Adopted with the label "Outstanding" by Intel (2003).',
    ],
    stgPosition: 'between Goal and Wish on the native Scale of Measure',
    commitment: 'no-commitment (stakeholder dream)',
  }),

  // ── Wish *244 — stakeholder-articulated, uncommitted, ANY position ──────
  // Tom Gilb 2026-06-06 doctrinal correction (verbatim): "The wish is
  // systematically rendered as more than the Goal. This is an easy assumption,
  // I have fallen into it myself. ... But in the planguage world, the Wish is
  // the level articulated by the stakeholder, NO MATTER WHAT IT IS, and how
  // optimistic or pessimistic it is. If the stakeholder has not articulated
  // it at all for any reason, THERE IS NO WISH TO RECORD."
  //
  // CONSEQUENCE FOR SEM: do NOT visually place Wish always-beyond-Goal. Wish
  // sits at its real numeric value, which may be less than, equal to, or
  // greater than the Goal — or absent entirely.
  Wish: Object.freeze({
    name: 'Wish',
    conceptNumber: '*244',
    keyedIcon: '>?',
    role: 'Stakeholder-articulated level — uncommitted, ANY position',
    shortDef: 'The level the stakeholder articulated. Can sit ANYWHERE on the scale, or be absent.',
    tooltipFull:
      'WISH >? · The level a stakeholder ARTICULATED — uncommitted. NOT systematically ' +
      'greater than Goal. A Wish can sit anywhere on the scale (above, equal to, or ' +
      'below the Goal — optimistic OR pessimistic). If the stakeholder did not articulate ' +
      'any Wish, there is NO Wish to record. Independent of cost and physics; the project ' +
      'does NOT commit to it.',
    longDef: [
      'A Wish records a stakeholder-articulated target level. The Wish is whatever the stakeholder SAID — optimistic OR pessimistic — not automatically the highest level.',
      '⚠ Common misreading (Tom Gilb 2026-06-06): "the Wish is systematically rendered as more than the Goal" — this is an EASY ASSUMPTION born of human optimism and ignorance of capabilities, but it is NOT Planguage doctrine. In Planguage the Wish is whatever the stakeholder articulated, no matter where on the scale it falls.',
      'If the stakeholder has NOT articulated a Wish for any reason, THERE IS NO WISH TO RECORD. Do not synthesise one. The spec carries Tolerable and Goal regardless; Wish is optional.',
      'The keyed icon >? signals "a perhaps questionable goal" — a stakeholder-valued level worth tracking but NOT yet negotiated into a project commitment. A Wish can be elevated to a Goal once it passes the 7 Goal-validity conditions; a Goal that turns out infeasible may be demoted to a Wish.',
      'Independent of cost and physics: the Wish records the stakeholder desire alone, without the engineering trade-off discipline that turns a proposed level into a committed Goal.',
    ],
    stgPosition: 'wherever the stakeholder articulated it · ANY position on the scale, or absent',
    commitment: 'no-commitment (stakeholder dream)',
  }),
})

/**
 * Convenience hook so components can `const { PLANGUAGE_TERMS } = usePlanguageTerms()`
 * with the same ergonomics as other composables.
 */
export function usePlanguageTerms() {
  return { PLANGUAGE_TERMS }
}
