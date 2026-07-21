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
  /** ≤ 250-char HoverHint-sized longer definition. */
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
      '⚠ WISH-FIRST PRINCIPLE (Tom Gilb 2026-06-09): Before Solutions are identified and funded, stakeholders can ONLY honestly express a Wish — the uncommitted dream level. Setting a Goal prematurely (before delivery capability is confirmed) creates false stakeholder expectations and is a Planguage error. Use Wish as the planning target until MultiVision IET confirms ≥100% delivery capability across all funded Solutions. Only THEN does the negotiated level become a committed Goal. Tom Gilb verbatim: "Long story short, use only wish until we can see 100% capability of delivering it, and we have a tool for that (MultiVision)." There are places in SEM which give explicit warning the Wish is NOT a committed requirement — they reinforce this principle.',
      'CONTRAST WITH OTHER PLANNING METHODS (Tom Gilb 2026-06-09): Other methods adopt a simplistic "customer is always right" mentality — the customer desire automatically becomes a committed requirement. Planguage has common sense logic: a customer Wish to "reach the moon and back in 5 seconds" is faithfully recorded as a Wish, NOT committed as a Goal. Planguage is the first planning method to systematically separate desire (Wish) from commitment (Goal) at the specification level. Goal = a level that has survived a reality check: technically possible, economically possible, cost-consistent, effective, profitable, prioritised, qualifying conditions true — AND MultiVision IET confirms ≥100% delivery. Before that check, honest planners use Wish.',
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
      'Ambition is the informal first-sentence summary of a requirement — a phrase like "much better security" or "competitively easy to use." It is the ENTRY POINT to specification: the human vision before it becomes an engineering contract.',
      'Ambition is VAGUE. It carries a rough direction and a rough range but no precise quantified level. You cannot MEET an Ambition because there is no defined boundary to reach.',
      'This is the management-BS and politician-BS pattern Planguage exists to convert — not dismiss. Vague ambitions are the natural way humans state desires; the Planguage discipline converts them into precise, testable, tradeable spec entries.',
      'The SOURCE of an Ambition is essential to capture: person name/role, reference context (speech title, meeting, date/time — e.g. "SEM Sharpening 9 July 12:42"), and URL if available. When the source is powerful (CEO, minister, regulator), the Planguage clarification beneath it carries LEGAL and POLITICAL authority — it is the precise translation of a power-backed directive, not speculation.',
      'Tom Gilb verbatim (2026-06-09): "This is a major Planguage mechanism, not mere BS statement. When the source is power (boss, minister), then our Planguage clarification has real authority behind it."',
      'The Planguage discipline: ALWAYS convert Ambition into precise Constraints (Tolerable) and Targets (Goal, Stretch, Wish) on a defined Scale of Measure. The Ambition statement remains as the spec\'s first-sentence summary (the "why"), and the quantified structure beneath it is the binding contract.',
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
      'CONVERSION: A Wish can be converted to a Goal of the SAME or a DIFFERENT magnitude. Tom Gilb 2026-06-07: "A wish can be converted to a Goal of same or different (more or less) magnitude." The conversion is not one-directional — the negotiated Goal level may be higher OR lower than the original Wish, depending on what passes the 7 Goal-validity conditions given available resources and competing stakeholders.',
      'LIVING SPEC: New Wishes can emerge AFTER a Goal is committed. Tom Gilb 2026-06-07: "New Wishes can occur after a Goal is committed." A committed Goal does not freeze the spec — stakeholders may articulate new aspirations as conditions change, new information arrives, or as post-delivery insights surface. These new Wishes become candidates for future Evo Step Goals.',
      'CORRECT EARLY-STAGE PLANNING TARGET (Tom Gilb 2026-06-09): At early planning stages — before Solutions are identified and financed — Wish is the CORRECT planning target, not Goal. Stakeholders can only honestly express what they desire (Wish), not make a delivery commitment (Goal). Using Goal prematurely creates unrealistic expectations. Once MultiVision IET shows ≥100% delivery capability across all funded Solutions, the Wish can be promoted to a committed Goal. Tom Gilb verbatim: "There are places in SEM which give explicit warning the Wish is NOT a committed requirement." ⚠ Wish >? is the planning target; Goal > is the delivery promise — these are distinct stages, not interchangeable.',
      'COMMON SENSE REALITY CHECK — WHAT DISTINGUISHES PLANGUAGE FROM OTHER METHODS (Tom Gilb 2026-06-09): Other planning methods adopt a simplistic "customer is always right" mentality — whatever the customer states becomes a committed requirement. Planguage is more advanced: the Wish records the customer desire HONESTLY, but it does NOT automatically become a committed Goal. Example: a customer who wishes to "reach the moon and back in 5 seconds" — that is faithfully recorded as a Wish. But we would be foolish to declare it a committed Goal requirement to be delivered in finite time. Reality-checking the Wish against physics, economics, and the 7 Goal validity conditions is not scepticism of the customer — it is COMMON SENSE LOGIC, and the core Planguage discipline that separates serious planning engineering from wishful commitments. This is advanced planning practice that other methods have not figured out yet.',
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

// ── Penta Panel parameter definitions (Tom Gilb 2026-06-09) ──────────────────
//
// Tom verbatim: "hovering over any Planguage parameter gives access to concept
// definitions: a short one in the hover, and a longer (illumination) one when
// clicked (the Parameter Name)"
//
// These cover all parameter labels used in the Penta detail editor panels for
// all 5 entry types (Value / Function / Solution / Constraint / Resource) plus
// Tom's new canonical parameters (Spec Owner, Stakeholders, Justification,
// Version, Risks) ratified as official Planguage Template extensions 2026-06-09.
//
// Key = exactly the label text shown in the panel (must match the paramKey prop
// passed to PlanguageParamLabel.vue so lookup works without transformation).
// Source: CE book (Competitive Engineering, Tom Gilb); 10.Standard/Standard.Kai-Zen/
// Template_Write_*.md; Tom Gilb verbal 2026-06-09.

export interface PentaParamDef {
  /** Display label — same as the lookup key. */
  label: string
  /** Planguage keyed icon if applicable. */
  keyedIcon?: string
  /** Glossary concept number (e.g. '109' for Goal). */
  conceptNumber?: string
  /** ≤ 80-char headline — shown as browser title= HoverHint on hover. */
  shortDef: string
  /** ≤ 250-char HoverHint — shown in native title= for longer hover readout. */
  tooltipFull: string
  /** Multi-paragraph prose for the click-to-expand illumination card. */
  longDef: string[]
  /** Citation — book / template / verbal / date. */
  canonicalSource: string
}

export const PENTA_PANEL_PARAMS: Readonly<Record<string, PentaParamDef>> = Object.freeze({

  // ── Ambition Level — the raw unquantified vision statement (primary input) ──────
  // Tom Gilb 2026-06-09: "This is a major Planguage mechanism, not mere BS statement."

  'Ambition Level': Object.freeze<PentaParamDef>({
    label: 'Ambition Level',
    keyedIcon: '@.∑',
    shortDef: 'Sentence-length vision statement — the unquantified ambition before Planguage clarification.',
    tooltipFull:
      'AMBITION LEVEL @.∑ · The unquantified vision or mission statement that PRECEDES ' +
      'the Planguage quantification (Scale / Tolerable / Goal / Wish). Natural language — ' +
      'management directive, politician speech, user story. NOT yet a scale or target. ' +
      'Source is ESSENTIAL: person + reference + URL. Power-backed source = real authority.',
    longDef: [
      'The Ambition Level is a sentence-length statement of vision or ambition — how good we want to be in the future. It is typically unquantified. It may be a User Story, a management directive, a politician\'s budget speech, or a CEO keynote line. Examples: "We want world-class customer satisfaction", "No patient waits more than 4 hours", "Zero serious safety incidents this year."',
      'It IS Management-BS and Politician-BS in its raw form — not yet actionable because it has no defined scale, no meter, no boundary condition. This is not a criticism — it is the natural way humans state ambitions. Planguage exists to CONVERT this ambition into precise, testable, tradeable spec entries (Scale / Tolerable / Goal / Wish).',
      'The SOURCE is essential to capture: who said it, in what context, on what date, and ideally at what URL. Example source references: "SEM Sharpening 9 July 12:42", "Board meeting 2026-06-08", "CEO Budget address Feb 2026 — https://...", "EU Health Minister statement 2025-11-01".',
      'If the source is a person with authority (boss, minister, regulator, board), the Planguage clarification beneath it carries REAL authority — it is the precise translation of a power-backed directive, not speculation. This gives the spec legal and political weight when commitments are contested.',
      'Tom Gilb verbatim (2026-06-09): "This is a major Planguage mechanism, not mere BS statement. When the source is power (boss, minister), then our Planguage clarification has real authority behind it." The Ambition Level is the entry point to the specification — the human desire before it becomes an engineering contract.',
    ],
    canonicalSource: 'Planguage Glossary Ambition *423 · CE book · All Tom Gilb books · Tom Gilb 2026-06-09',
  }),

  // ── Tag (Planguage ID) — mnemonic unique identifier + Planguage Pointer taxonomy ─
  // Tom Gilb 2026-06-09 verbatim on format: "The tag is a set of mnemonic Words,
  // space between and at least first letter of each word capitalized. Numbers and
  // special characters are allowed. It must be unique among all tags."
  // Tom Gilb 2026-04-25 canonical text: "A Planguage pointer is a stable symbolic
  // reference to a potentially evolving definition." [CG, *698]

  Tag: Object.freeze<PentaParamDef>({
    label: 'Tag',
    keyedIcon: 'Tag *146',
    shortDef: '1–3 mnemonic words. FIRST aspect of any requirement. Stable reference to an evolving definition.',
    tooltipFull:
      'TAG *146 · The FIRST named aspect of every Planguage requirement — before Scale, Meter, or targets (ASPECTS book §2.1.1.0). ' +
      'A stable symbolic reference to a potentially evolving definition [CG *698]. ' +
      '1–3 mnemonic words, Title Case with spaces, globally unique. ' +
      'Hierarchical via dot notation: "System.ResponseTime", "Labor.Productivity.Limit". ' +
      'BANNED: V1, F1, PascalCase. CORRECT: "Search Latency", "GDPR Compliance", "OPP Integration".',
    longDef: [
      'FIRST ASPECT — THE IDENTIFIER: Tag is the first of the four minimum aspects that make any specification useful as a requirement. ASPECTS book §2.1.1.0 (Tom Gilb 2026): "A basic objective or requirement has an ID Tag… The next most fundamental things we would want to know are a target level (like a Wish, Goal, Tolerable), and some way to measure its level in a real system (a Meter)." The four minimum aspects: Tag (ID) · Scale · Meter · Target level. No Tag = no traceable requirement.',

      'PLANGUAGE POINTER [CG *698] — Tom Gilb 2026-04-25: "A Planguage pointer is a stable symbolic reference to a potentially evolving definition." ASPECTS book §1.2 (Tom Gilb 2026): "Planguage assigns stable mnemonic identity Tags to every concept, and every specification; so that when the detail is updated, the Tag remains a stable factor, enabling traceability over time and change. No silly bullet points on a slide, as is too common." The Tag stays CONSTANT while the definition it points to can evolve. This stability-under-change is the core engineering value of the concept.',

      'FOUR TYPES OF PLANGUAGE REFERENCE (Tom Gilb 2026-04-25): (1) Tags — character strings naming a parameter or specification, e.g. \'Net Security\'. (2) Sources — references to the origin of a specification, e.g. ← Ben Franklin. (3) External Identifiers — URI/URL references (a URL locates a web resource; a URI also covers mailto:, urn:isbn: etc.). (4) Defined Terms — entries from a Planguage glossary or project terminology, e.g. \'Scale\'. These reference types are SCALE-FREE — they apply at any level of complexity, from a single entry to an enterprise spec system.',

      'TAG FORMAT RULES: (1) 1 to 3 words — concise and memorable. (2) Normal English words with spaces: "Search Latency" NOT "SearchLatency"; "Cost Save" NOT "CostSave"; "Safety Aggregate" NOT "SafeAgg". (3) Numbers and acronyms allowed: "P95 Latency", "GDPR Compliance", "OPP Integration". (4) Title Case preferred. (5) Globally unique within the spec. TEMPLATE EXAMPLES from DEEP book §9.2.1 (CE/DEEP p.201): blank template → "Tag: System.ResponseTime"; CE design spec §9.2.3 (p.203): "Tag: OPP Integration." (real product spec). ASPECTS real-world value Tags (p.17): Accuracy · Speed · Cost Save · Scalability · Security · Integration · Adoption · Revenue · Satisfaction · Innovation — each is 1–2 words, instantly meaningful over coffee. Note: the ASPECTS nurse-table used compressed AI notation (SafeAgg, WorkBal, PsychWell etc.) — the human-preferred forms are: Safety Aggregate · Work Balance · Psychological Wellbeing.',

      'HIERARCHICAL TAGS (A.B.C dot notation): Tag hierarchies are specified by "." between references and can include Planguage Aspects and Parameters. DEEP §9.3.1 (p.209): "This.Hierarchy.Of.Tags" shown as keyed notation; CE template (p.202): "Is Part Of: <hierarchy of tags (For example, A.B.C) is preferable>". ASPECTS real constraint Tags (p.27): Labor.Productivity.Limit · Regulatory.Delay.Constraint · Environmental.Compliance.Limit · Inheritance.Law.Pressure — each tells you category.concept.type at a glance. The dot separator signals parent–child relationship and enables traceability from business level down to engineering level.',

      'BANNED FORMATS (hard ban): V1, V2, F1, F2 — sequential type-codes are unintelligible; nobody can discuss "V3" in a meeting. PascalCase (UserActivationRate) — wrong, use "User Activation Rate". Type-dot prefix (V.SearchLatency) — wrong, the entry type is stored separately from the Tag. MNEMONIC PRINCIPLE: if you cannot discuss the entry by its Tag over coffee with a colleague, it is the wrong Tag. Tom Gilb 2026-06-09: "Nobody can discuss, refer to, or remember specs with V1 F1 etc. Great Mnemonic Unique Tags are the job — derived from the essence of the definition."',
    ],
    canonicalSource:
      'Tom Gilb 2026-04-25 [CG *698] · Tom Gilb 2026-06-09 · ' +
      'ASPECTS book §1.2 + §2.1.1.0 + §2.3.0.3 (Tom Gilb 2026, https://tinyurl.com/ASPECTSpdfFree) · ' +
      'DEEP Think §9.2.1–9.2.4 + §9.3.1 (Tom Gilb 2026, https://tinyurl.com/DEEPThinkBookPdfFree) · ' +
      'Planguage Glossary Tag *146 · CE book p.422 Template',
  }),

  // ── Common Planguage parameters ─────────────────────────────────────────────

  Description: Object.freeze<PentaParamDef>({
    label: 'Description',
    keyedIcon: '@.∑',
    shortDef: 'Ambition Level — one-sentence intent statement for this spec entry.',
    // r41 2026-06-20 (Tom Gilb verbatim correction of the earlier wrong
    // formulation) — Description definition refined per
    // rule_value_definition_identity.md SUPREME: the canonical precise-
    // specification form is Scale + at-least-one-future-state (Tolerable
    // / Goal / Wish / Stretch).  Meter is desirable, not initially
    // required, and does not determine the spec object's characteristics.
    tooltipFull:
      'DESCRIPTION · The Ambition Level of this entry — what quality, capability, or boundary is targeted. ' +
      'Should be a clear single-sentence intent statement. ' +
      'Not yet a precise quantified level (that requires a Scale plus at least one future state — Tolerable / Goal / Wish / Stretch — and a Meter is desirable). ' +
      'The Planguage principle: every description is a starting point for quantification.',
    longDef: [
      'The Description captures the INTENT of this entry — the quality attribute, function, constraint, or resource being specified. It should be a clear, single-sentence Ambition Level statement that anyone can read and understand without additional context.',
      'In Planguage terms, Description corresponds to the Ambition (informal summary) layer. It gives the "what" before we quantify the "how much." It is a precursor to precise specification — which requires a Scale plus at least one future state (Tolerable, Goal, Wish, or Stretch). A Meter is desirable but not initially required.',
      'A good description is short, role-specific, and names the quality being measured. Example for a Value: "Response speed for end-user queries" rather than "The system should be fast." Example for a Function: "Export spec as Planguage-formatted PDF." Example for a Constraint: "All user data stored within EU jurisdiction."',
      'Tom Gilb: "Every Ambition should eventually be quantified. The description is where we start that journey — it names the thing we care about."',
    ],
    canonicalSource: 'CE book · Planguage Glossary Ambition *423 · Template_Write_Values.md',
  }),

  Scale: Object.freeze<PentaParamDef>({
    label: 'Scale',
    keyedIcon: '[scale]',
    shortDef: 'Unit of measurement — the axis on which this Value is measured.',
    tooltipFull:
      'SCALE · The unit of measure for this Value attribute. ' +
      'Must be unambiguous: a stakeholder reading the Scale should know exactly what numbers represent good vs. bad performance. ' +
      'Examples: "% of users completing onboarding in one session", "ms P95 query latency", "critical defects per 1000 lines." ' +
      'A missing or vague Scale makes Goal and Tolerable unmeasurable — they become management BS.',
    longDef: [
      'Scale is the unit of measurement for this Value entry — the numeric axis on which Status, Tolerable, and Goal all live. Without a clear Scale, none of those levels have meaning.',
      'A good Scale is: (1) unambiguous — any two engineers measuring independently get the same number; (2) appropriate — measures the aspect that the stakeholder actually cares about; (3) accessible — data can realistically be collected without heroic effort.',
      'Examples by attribute type: Response speed → "ms P95 query latency (measured under 100 concurrent users)". Security → "% of penetration-test attack vectors successfully blocked". User satisfaction → "NPS score (0–100) from monthly in-app survey". Reliability → "% uptime over 30-day rolling window".',
      'Tom Gilb: "If you cannot define the Scale, you cannot set a Goal. If you cannot set a Goal, you have not specified a requirement — you have written a wish." The Scale is the foundation of quantified Planguage spec.',
    ],
    canonicalSource: 'CE book · Template_Write_Values.md · Planguage Glossary Scale *501',
  }),

  Meter: Object.freeze<PentaParamDef>({
    label: 'Meter',
    keyedIcon: '[meter]',
    shortDef: 'How to measure — the measurement procedure, tool, or data source.',
    tooltipFull:
      'METER · The measurement procedure: how we will collect the numbers for this Value\'s Scale. ' +
      'Names the tool, method, data source, frequency, and sample. ' +
      'Without a Meter, the Scale is theoretical — the measurement cannot be independently reproduced. ' +
      'Example: "Automated query-timer in production APM system, sampled every 5 minutes, P95 computed hourly."',
    longDef: [
      'Meter answers "HOW will we measure this?" It specifies the measurement instrument, procedure, data source, sampling frequency, and any required conditions for measurement.',
      'A complete Meter has: (1) TOOL/SOURCE — what system, survey, or instrument produces the numbers; (2) PROCEDURE — how to operate it or collect samples; (3) FREQUENCY — how often measurement occurs; (4) SAMPLE — what subset or population is being measured.',
      'Example for Response Speed: "Automated P95 latency computed from production APM traces (Datadog) for all /api/search requests, sampled continuously, reported hourly." This Meter makes the Scale reproducible by any engineer independently.',
      'Without a Meter, the Scale is a hypothesis. Two engineers measuring independently may get different numbers because the procedure is undefined. Planguage requires a Meter for every Value where Status matters — which is every Value that has a Goal and will be measured at delivery.',
    ],
    canonicalSource: 'CE book · Template_Write_Values.md · Planguage Glossary Meter *283',
  }),

  Status: Object.freeze<PentaParamDef>({
    label: 'Status',
    keyedIcon: '[now]',
    conceptNumber: 'S (in STG)',
    shortDef: 'Current measured performance on the Scale — where we are NOW.',
    tooltipFull:
      'STATUS [now] · The currently measured value on this attribute\'s Scale. ' +
      '"Where are we NOW?" — measured at the last Evo Step delivery or baseline. ' +
      'Status below Tolerable = project at risk. Status ≥ Goal = success declared for this attribute. ' +
      'Status between Tolerable and Goal = project alive, target not yet reached. ' +
      'IMPORTANT: Status is a MEASURED FACT — not a forecast or a target.',
    longDef: [
      'Status is the current measured performance on this Value\'s Scale — "where are we now?" It is a FACT, not a target. It should come from the Meter: an actual measurement taken using the defined procedure.',
      'Status sits on the STG (Status · Tolerable · Goal) axis. Three interpretive ranges: Status < Tolerable → project is at risk on this attribute (survival line crossed). Tolerable ≤ Status < Goal → project alive but target not yet reached. Status ≥ Goal → success declared for this attribute.',
      'In the Evo cycle, Status is updated at every Measure step (step 8 of the 9 Evo steps). Each Evo Step delivery should move Status toward Goal. The rate of Status change over Evo Steps tells you if you are on track.',
      'Tom Gilb 2026-06-09: "Status is a historic fact — it reflects the system\'s actual measured performance at the most recent measurement event, not what we hope to achieve." Do not fill Status with a projection or target — use the Goal for that.',
    ],
    canonicalSource: 'CE book · Planguage Glossary Status *S · Evo 2024 ch.2 (Measure step)',
  }),

  Level: Object.freeze<PentaParamDef>({
    label: 'Level',
    keyedIcon: '>n',
    shortDef: 'Priority / importance level — where this entry ranks in the spec.',
    tooltipFull:
      'LEVEL >n · Priority or importance ranking for this spec entry. ' +
      'Used to declare relative importance among entries of the same type. ' +
      'Planguage primary prioritisation: reach Value Wishes within all Constraints. ' +
      'Level informs which entries get Resources first. Higher-priority entries take precedence when budgets are constrained.',
    longDef: [
      'Level records the priority or importance ranking of this spec entry relative to other entries of the same type. It informs resource allocation: when budgets are constrained, higher-priority entries get investment first.',
      'In Planguage, the primary prioritisation rule is: reach Value Wishes within all Constraints. A numeric Level is one input into this prioritisation — it helps planners allocate Evo Steps and Solutions to the highest-value entries.',
      'Common values: "1" or "Critical" for must-deliver-first entries. "2" or "High" for strong business value. "3" or "Medium" for desirable but not critical. "4" or "Low" for nice-to-have. Or use a percentage representing the relative weight of this entry in the overall value target.',
      'Level is especially important when the total cost of reaching all Goals exceeds the available Budget. In that case, the planner must triage — and Level is the explicit record of that triage decision.',
    ],
    canonicalSource: 'CE book · Template_Write_Values.md · Planguage Glossary Level *236',
  }),

  // ── Function-specific parameters ────────────────────────────────────────────

  'Presence Test': Object.freeze<PentaParamDef>({
    label: 'Presence Test',
    keyedIcon: '[F.present?]',
    shortDef: 'Binary test: is this Function present YES or NO in the delivered system?',
    tooltipFull:
      'PRESENCE TEST · A Function is BINARY — present or absent. ' +
      'The Presence Test is a specific, executable test that returns a YES/NO answer: ' +
      '"Is this Function present in the current system?" ' +
      'It is NOT a quality measure (qualities attach to Values). ' +
      'A good Presence Test can be performed independently by any tester with no ambiguity in the result.',
    longDef: [
      'A Function in Planguage is binary: the system either CAN perform the function or it CANNOT. There is no "50% functional" — only present or absent. The Presence Test makes this binary nature explicit and testable.',
      'The Presence Test should be specific enough that any tester, working independently, would reach the same YES/NO conclusion. It names the test scenario, the actors involved, and the observable outcome that constitutes "present."',
      'Example for "Export Your Full Spec as PDF": Presence Test = "Given a loaded spec with at least one Value entry, clicking Export → PDF produces a downloadable PDF file containing the full spec content." — YES: feature present. NO if: nothing downloads, file is empty, or spec content is missing.',
      'Quality attributes (speed, accuracy, security level) attach to VALUE entries, NOT to the function itself. If you find yourself adding a quality qualifier to a Function description ("the system shall QUICKLY export PDFs"), that qualifier belongs in a separate Value entry with a proper Scale and Meter.',
    ],
    canonicalSource: 'CE book · Template_Write_Function.md · DD-004 (Function is binary)',
  }),

  // ── Solution-specific parameters ─────────────────────────────────────────────

  Function: Object.freeze<PentaParamDef>({
    label: 'Function',
    keyedIcon: 'S→F',
    shortDef: 'Which Function entry does this Solution support or implement?',
    tooltipFull:
      'FUNCTION (of Solution) · Links this Solution back to the Function entry it implements or supports. ' +
      'Ensures every Solution traces to a real functional requirement in the spec. ' +
      'A Solution without a Function link is a design decision with no declared purpose — it is untraced and may be waste. ' +
      'Use the Function entry ID or mnemonic label.',
    longDef: [
      'Every Solution (S. entry) should trace back to the Function(s) it implements. This traceability is central to the Penta Model: the Design sector exists to serve the Scope sector. Solutions without Function links are "free-floating" design decisions — potentially gold-plating or scope creep.',
      'In Planguage, a Solution is a concrete design choice that enables one or more Functions to be delivered within the available Resources, while meeting the Value targets. The link to a Function makes that causal chain explicit.',
      'Example: Solution "GraphQL API gateway" → Function "Provide real-time spec queries for external integrations." If the Function entry is removed from scope, any Solutions that only serve it become candidates for removal too — this cascading traceability prevents orphaned design decisions.',
      'Use the Function entry\'s mnemonic ID (e.g. "Search Capability") or the dotted ID (e.g. "F.SearchCapability"). Multiple Functions can be listed if this Solution serves several.',
    ],
    canonicalSource: 'CE book · Template_Write_Solution.md · Penta Model Design sector',
  }),

  'Impacts Values': Object.freeze<PentaParamDef>({
    label: 'Impacts Values',
    keyedIcon: 'S→V',
    shortDef: 'Which Value entries does this Solution improve, and by how much?',
    tooltipFull:
      'IMPACTS VALUES (Solution → Values) · The IET-style impact estimate for this Solution: ' +
      'which Value entries does it affect, and by what approximate percentage. ' +
      'Format: "Search Latency ~60%, User Satisfaction ~40%". ' +
      'Basis for the IET (Impact Estimation Table) and V/C ratio priority ranking. ' +
      'Tom Gilb 2026-06-09: new canonical Planguage Solution parameter (was combined "Impact").',
    longDef: [
      'Impacts Values records the estimated contribution of this Solution to specific Value entries. It is the input to the IET (Impact Estimation Table) — the Planguage tool for comparing solutions by value-per-cost ratio.',
      'Format: list each affected Value entry by its mnemonic ID followed by an approximate impact percentage. The percentage means: "if this Solution is fully implemented, it would move the Status of that Value by approximately N% of the distance from current Status to its Goal." Example: "Search Latency ~60%, User Satisfaction ~25%."',
      'These estimates are educated guesses at the planning stage — they are RELATIVE (IET Percentage Impact scale from 0%=no movement to 100%=Goal reached). They should be updated as Status is measured after each Evo Step.',
      'Tom Gilb 2026-06-09: This field was created by splitting the former combined "Impact" field into Impacts Values (value effects) and Impacts Costs (resource consumption). This split supports the dual-axis IET analysis: V/C ratio = Impacts Values total / Impacts Costs total.',
    ],
    canonicalSource: 'CE book ch. IET · Tom Gilb 2026-06-09 (new canonical parameter) · Template_Write_Solution.md',
  }),

  'Impacts Costs': Object.freeze<PentaParamDef>({
    label: 'Impacts Costs',
    keyedIcon: 'S→R',
    shortDef: 'Resource cost estimate for this Solution — which Resources it consumes and how much.',
    tooltipFull:
      'IMPACTS COSTS (Solution → Resources) · The estimated resource consumption of this Solution: ' +
      'which Resource entries it depletes and by how much. ' +
      'Format: "CapEx Budget ~20%, Development Time ~8 weeks". ' +
      'Basis for the IET denominator: Solutions ranked by V/C ratio (Value impact / Resource cost). ' +
      'Tom Gilb 2026-06-09: new canonical Planguage Solution parameter (was combined "Impact").',
    longDef: [
      'Impacts Costs records the estimated resource consumption of this Solution. It is the denominator in the IET V/C ratio — every solution has both a value contribution (Impacts Values) and a cost (Impacts Costs). High V/C ratio Solutions should be funded first.',
      'Format: list each Resource entry the Solution consumes, with approximate consumption amounts. Example: "CapEx Budget ~€25,000, Engineering Time ~4 person-weeks, Infrastructure Budget ~€500/month."',
      'Like Impacts Values, these are estimates. The purpose is comparative planning — understanding the relative cost of each Solution so the planner can sequence Evo Steps to maximise value per unit of Resource consumed.',
      'Tom Gilb 2026-06-09: This field was created by splitting the former combined "Impact" field into Impacts Values (value effects) and Impacts Costs (resource effects). The split aligns with the IET methodology: the IET table columns are Solutions, and each cell shows Value impact % or Resource cost % — the combined "Impact" field was too vague to drive quantitative prioritization.',
    ],
    canonicalSource: 'CE book ch. IET · Tom Gilb 2026-06-09 (new canonical parameter) · Template_Write_Solution.md',
  }),

  // ── Constraint-specific parameters ──────────────────────────────────────────

  Scope: Object.freeze<PentaParamDef>({
    label: 'Scope',
    keyedIcon: '[C.scope]',
    shortDef: 'What is constrained — the boundary or subject this Constraint applies to.',
    tooltipFull:
      'SCOPE (of Constraint) · What exactly is being constrained. ' +
      'Names the system component, stakeholder set, process, data type, or geographic region ' +
      'to which this binary boundary applies. ' +
      'Without explicit Scope, a Constraint may be interpreted too broadly (blocking legitimate work) ' +
      'or too narrowly (leaving compliance gaps).',
    longDef: [
      'Scope defines the DOMAIN of applicability for this Constraint. Without explicit Scope, a Constraint creates ambiguity: "No unencrypted data" — does this apply to internal developer logs? Archived backup files? Temporary caches? Explicit Scope removes these interpretive gaps.',
      'Good Scope answers: what SYSTEM, what DATA TYPE, what ENVIRONMENT, what USER CLASS, and what GEOGRAPHY does this Constraint bind. Example for a GDPR constraint: Scope = "All personal data (PII) for EU resident users, stored in or processed by the production system — including temporary processing buffers and backups."',
      'Scope also defines what is EXCLUDED — explicitly stating that something is outside scope is as important as stating what is in scope. "All user data" is different from "All personally-identifiable user data" and the distinction has real compliance consequences.',
      'In the Penta Model, Constraints live in the SCOPE sector alongside Functions. Both define what the system does and must not do. A Constraint\'s Scope answers "must not do WHAT, to WHOM, in WHAT context?"',
    ],
    canonicalSource: 'CE book · Template_Write_Constraint.md · Planguage Glossary Scope *499',
  }),

  Rationale: Object.freeze<PentaParamDef>({
    label: 'Rationale',
    keyedIcon: '[why?]',
    shortDef: 'Why this entry is in the spec — business, legal, or technical justification.',
    tooltipFull:
      'RATIONALE · Why this entry exists in the spec — the business, legal, technical, or political reason. ' +
      'For Constraints: naming the source (regulation, risk event, stakeholder requirement) prevents "stale" Constraints from surviving long after their rationale dissolves. ' +
      'For other types: the "why now" business case. ' +
      'Rationale makes spec changes defensible and traceable.',
    longDef: [
      'Rationale records why this entry was added to the spec. It is the "because" clause: "We added this Constraint BECAUSE we must comply with GDPR Article 5(1)(b)." Without Rationale, spec entries can become orphaned — everyone assumes someone else knows why it is there.',
      'For Constraints, Rationale is especially important. Constraints can survive their original reason: a regulation is repealed, a risk is resolved, a stakeholder changes position. The Rationale field enables the Spec Owner to review constraints periodically and ask "is this still needed?"',
      'For Value entries, Rationale captures the business case: "We need this because our NPS is currently 32 and competitors average 55 — closing this gap is tied to Q3 retention targets." This business context helps prioritize when budgets are constrained.',
      'Rationale should cite authoritative sources: regulation number, meeting decision reference, stakeholder quote, competitor benchmark. Vague rationale ("it was always like this") should be replaced with concrete justification or the entry reconsidered.',
    ],
    canonicalSource: 'CE book · Template_Write_Constraint.md · Planguage governance principles',
  }),

  Source: Object.freeze<PentaParamDef>({
    label: 'Source',
    keyedIcon: '[§→]',
    shortDef: 'Who imposed or authored this entry — the stakeholder source.',
    tooltipFull:
      'SOURCE [§→] · The stakeholder who imposed, requested, or authored this entry. ' +
      'For Constraints: the regulatory body, governing authority, or business owner. ' +
      'For Values: the stakeholder whose requirement drove the quality target. ' +
      'Source is required for traceability: when a constraint is challenged or a value target is revised, we need to know who to consult.',
    longDef: [
      'Source identifies the origin stakeholder for this spec entry — the [§→] in Planguage notation (stakeholder as SOURCE). Every spec entry was put there for someone\'s reason. Identifying that someone enables traceability and change control.',
      'For Constraint entries: Source is typically a regulatory body (GDPR Data Protection Authority, HIPAA, ISO 27001 certification body), a governance committee, a business owner, or a legal team. When the Source stakeholder changes position or scope, the Constraint may need review.',
      'For Value entries: Source is the stakeholder whose requirement established this quality target. If "Search Latency ≤ 500ms P95" was required by the Engineering Operations team, knowing that enables targeted conversations when the target is challenged or needs revision.',
      'Source and Spec Owner are different: Source is who CREATED the requirement; Spec Owner is who is RESPONSIBLE for monitoring compliance. A GDPR Constraint might have Source = "EU Data Protection Board" and Spec Owner = "Chief Privacy Officer."',
    ],
    canonicalSource: 'CE book · Template_Write_Constraint.md · useStakeholderDerivation.ts',
  }),

  // ── Resource-specific parameters ─────────────────────────────────────────────

  Budget: Object.freeze<PentaParamDef>({
    label: 'Budget',
    keyedIcon: '>',
    shortDef: 'Official allocated resource amount — the committed resource envelope.',
    tooltipFull:
      'BUDGET > · Official stipulation of allocated resource. ' +
      'Tom Gilb 2026-06-07: "A Budget is an Official stipulation of a financial allocation for a purpose." ' +
      'NOT how much we plan to spend — how much has been OFFICIALLY ALLOCATED. ' +
      'Specialised terms: Deadline (time), Headcount (people). ' +
      'Budget should be ≥ Tolerable floor or the project is under-resourced at inception.',
    longDef: [
      'Budget is the OFFICIALLY ALLOCATED resource amount — the commitment from a budget authority that this much of this resource is available for this project or workstream. It is "what it is" — not a target for how much to spend.',
      'Tom Gilb 2026-06-07 verbatim: "A Budget is an Official stipulation of a financial allocation for a purpose. It is what it is." Budget history matters: previous Budget versions may be recorded if the allocation has changed over time.',
      'Specialised vocabulary: Deadline = time resource budget (a specific calendar date). Headcount = people resource budget (number of FTE available). Budget is the generic term for all other resources (money, compute, licences, infrastructure).',
      'Budget versus Tolerable: Budget ≥ Tolerable means the project is adequately funded at the survival floor. If Budget < Tolerable, the project is under-resourced at inception — the formally allocated amount is below the minimum for non-failure. This is a red flag that must be resolved before planning proceeds.',
    ],
    canonicalSource: 'CE book · RESOURCE_ALLOCATION_TERMS.Budget · Tom Gilb 2026-06-07',
  }),

  Consumed: Object.freeze<PentaParamDef>({
    label: 'Consumed',
    keyedIcon: '[used]',
    shortDef: 'Actual resource usage to date — historical fact, not a target.',
    tooltipFull:
      'CONSUMED [used] · The amount of this resource actually used to date. ' +
      'Tom Gilb 2026-06-07: "CONSUMPTION ITSELF IS A DIFFERENT MATTER ' +
      '(IT WILL HAPPEN LATER, BUT IT IS NOT A PLAN TO CONSUME, JUST A HISTORIC FACT)." ' +
      'Consumed is like Status for Values — it records where we are on the Resource axis. ' +
      'Consumed / Budget = utilisation ratio (used in Efficiency calculation).',
    longDef: [
      'Consumed records the actual amount of this resource that has been used to date. It is a HISTORICAL FACT — not a target, not a forecast. Like Status for Value entries, Consumed sits on the Resource allocation axis and tells us "how much of this resource has been spent?"',
      'Tom Gilb 2026-06-07 verbatim: "CONSUMPTION ITSELF IS A DIFFERENT MATTER — IT WILL HAPPEN LATER, BUT IT IS NOT A PLAN TO CONSUME, JUST A HISTORIC FACT." Budget says what is available; Consumed says what has been used. The difference is remaining capacity.',
      'Consumed / Budget = the utilisation ratio. This is the DENOMINATOR in the Penta Efficiency score: Efficiency = (average Value achievement) / (average Resource utilisation). High utilisation with low value achievement = poor efficiency.',
      'Consumed should be updated at every Evo Step measure event alongside Status. Together, Status (value) and Consumed (cost) enable the IET V/C ratio to be updated with real data rather than estimates.',
    ],
    canonicalSource: 'CE book · Tom Gilb 2026-06-07 (doctrinal clarification) · usePenta.ts efficiency calculation',
  }),

  // ── Tom\'s new canonical Planguage parameters (2026-06-09) ───────────────────
  // Tom Gilb verbatim: "I changed the Planguage Template for the basic representation
  // of all specs. I did a little innovation here (Owner => Spec Owner, but I am in
  // charge of the definition of Planguage)."
  // Source: Tom Gilb verbal 2026-06-09, now canonical Planguage.

  Stakeholders: Object.freeze<PentaParamDef>({
    label: 'Stakeholders',
    keyedIcon: '§',
    shortDef: 'Who required this entry (Sources) AND who is affected by it (Impacted).',
    tooltipFull:
      'STAKEHOLDERS § · Two roles: [§→] Sources — who required or drove this entry; ' +
      '[§←] Impacted — who is affected by its delivery or non-delivery. ' +
      'Tom Gilb 2026-06-09 canonical parameter. ' +
      'Comma-separated names matching spec.stakes for automatic link derivation. ' +
      'Explicit names here override the implied derivation in the Stakeholder Relationships panel.',
    longDef: [
      'Every spec entry has a stakeholder relationship in TWO directions: [§→] Sources are the stakeholders who REQUIRED or DROVE this entry — their needs, constraints, or decisions are the reason it exists in the spec. [§←] Impacted are the stakeholders who will be AFFECTED by this entry\'s delivery or non-delivery.',
      'Tom Gilb 2026-06-09: "Stakeholders are a canonical Planguage parameter for every entry type. Every spec entry was put there for someone\'s reason (Sources) and will affect someone (Impacted). Making both explicit prevents orphaned entries and makes impact assessment tractable."',
      'Format: comma-separated names from the plan\'s stakeholder list. Example: "Patient, Nurse, Admin" for a medical records Value entry. Names here are used by the Stakeholder Relationships panel (the § derivation engine) — explicit names take precedence over implied derivation.',
      'Note on inanimate stakeholders (Tom Gilb 2026-05-15): "all data is a stakeholder, it has needs like GDPR." Regulatory bodies, systems, data sets — all can be named as stakeholders. A GDPR Constraint has Sources = "EU Data Protection Board" and Impacted = "EU resident users, Data systems."',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (new canonical Planguage parameter) · useStakeholderDerivation.ts',
  }),

  'Spec Owner': Object.freeze<PentaParamDef>({
    label: 'Spec Owner',
    keyedIcon: '[*]!',
    shortDef: 'Single person accountable for monitoring this spec entry — renamed from Owner.',
    tooltipFull:
      'SPEC OWNER [*]! · The single person accountable for monitoring and managing this spec entry over time. ' +
      'Tom Gilb 2026-06-09: renamed from "Owner" to "Spec Owner" as a canonical Planguage Template innovation. ' +
      'Spec Owner is NOT necessarily the stakeholder who requested the entry (that is Source). ' +
      'The Spec Owner is responsible for: keeping the entry current, measuring Status, and escalating issues.',
    longDef: [
      'Spec Owner is the single person accountable for this spec entry\'s lifecycle: updating it when conditions change, ensuring Status is measured, escalating when Status falls below Tolerable, and proposing revisions when the entry is no longer valid.',
      'Tom Gilb 2026-06-09: "I changed Owner to Spec Owner as a canonical Planguage Template innovation. I am the author of Planguage so this is now the official term." The change clarifies that this role is specifically about the SPEC entry, not general project ownership.',
      'Spec Owner versus Source: Source is who DROVE the entry (e.g. "GDPR Authority"). Spec Owner is who MANAGES the entry (e.g. "Chief Privacy Officer"). In small teams these may be the same person; in large organizations they are often different roles.',
      'A spec entry without a Spec Owner is an orphan — no one is watching whether its Status is slipping below Tolerable, or whether the entry itself is still valid. Tom Gilb: "Every spec entry should have a Spec Owner. Ownership without assignment is wishful thinking."',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (canonical Planguage Template innovation — Owner → Spec Owner)',
  }),

  Justification: Object.freeze<PentaParamDef>({
    label: 'Justification',
    keyedIcon: '[why✓]',
    shortDef: 'Business / technical case for including this entry in the spec.',
    tooltipFull:
      'JUSTIFICATION [why✓] · The business or technical case for WHY this entry belongs in the spec. ' +
      'Tom Gilb 2026-06-09 canonical parameter. ' +
      'Answers: "If we removed this entry, what specific business, user, or technical need would go unmet?" ' +
      'Justification enables periodic spec audits — entries whose Justification no longer holds are candidates for removal.',
    longDef: [
      'Justification captures the business, technical, or strategic case for including this entry in the spec. It answers: "If we removed this entry entirely, what specific harm or unmet need would result?" If no good answer exists, the entry is a candidate for removal.',
      'Tom Gilb 2026-06-09: "Justification is a canonical Planguage parameter for all entry types. Every entry in the spec should be there for a reason that can be stated clearly. Entries without justification accumulate as waste."',
      'Good Justification references measurable business outcomes: "Removing this Function would prevent revenue from the B2B API integration use case, which represents 15% of projected Q3 ARR." Or: "This Constraint prevents GDPR fines up to €20M or 4% of global annual turnover." Vague justification like "stakeholders want it" is insufficient.',
      'Justification enables spec governance: at each Evo Step review, entries can be audited against their Justification. Has the business condition that justified this entry changed? Has the technical risk it mitigated been resolved? If so, the entry should be revised or removed.',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (new canonical Planguage parameter) · CE book governance principles',
  }),

  'Version / Date': Object.freeze<PentaParamDef>({
    label: 'Version / Date',
    keyedIcon: '[v.n · YYYY-MM-DD]',
    shortDef: 'Version identifier and date/time this spec entry was created or last revised.',
    tooltipFull:
      'VERSION / DATE · Revision history for this individual spec entry. ' +
      'Tom Gilb 2026-06-09 canonical parameter. ' +
      'Format: "v1.0 · 2026-06-09" or "v2.1 · 2026-06-15 HH:MM". ' +
      'Supports governance and change traceability — knowing when a Goal was changed ' +
      'is as important as knowing what it was changed to.',
    longDef: [
      'Version / Date records when this spec entry was created and/or last revised. Like software versioning, this enables change traceability: you can see that the Goal was raised from 95% to 99% on a specific date and compare that against the Evo Step timeline.',
      'Tom Gilb 2026-06-09: "Every spec unit should have its own version and date. This is a canonical Planguage Template innovation — the version and date are properties of the individual spec entry, not just the whole document."',
      'Recommended format: "v1.0 · 2026-06-09" for initial creation, "v2.1 · 2026-06-15 14:30 CET" for revisions with significant stakeholder impact. Free text is acceptable — the important thing is that the information is recorded consistently.',
      'Version history enables governance questions: "When was this Goal set? Who approved the revision? What was the Goal before the Evo Step 3 delivery?" Without Version / Date, the spec history is reconstructed from git blame or meeting notes — fragile and often lost.',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (new canonical Planguage parameter) · PentaGovernancePanel',
  }),

  'Risks / Issues': Object.freeze<PentaParamDef>({
    label: 'Risks / Issues',
    keyedIcon: '[!risk]',
    shortDef: 'Known risks, open issues, or uncertainties related to this spec entry.',
    tooltipFull:
      'RISKS / ISSUES [!risk] · Known risks, open questions, measurement uncertainties, ' +
      'dependency risks, or issues related to this spec entry. ' +
      'Tom Gilb 2026-06-09 canonical parameter. ' +
      'Format: free text — use "?" for unknown items, "⚠" for active risks. ' +
      'Serves the Relationship Clarity principle: every spec element\'s risks should be modelled explicitly.',
    longDef: [
      'Risks / Issues records known risks, open questions, measurement uncertainties, and dependency hazards related to this specific spec entry. It is the entry-level risk log — complementing the plan-level risk register.',
      'Tom Gilb 2026-06-09: "Risks are a canonical Planguage parameter for all entry types. The Relationship Clarity principle requires that every spec element\'s relationships — including its risks — be explicitly modelled and visualised where possible."',
      'Categories of Risks/Issues: (1) Measurement risk — "The Meter is not yet operational; Status is estimated." (2) Feasibility risk — "Goal may require 3rd-party API whose SLA is unconfirmed." (3) Dependency risk — "This Constraint depends on a legal opinion expected Q4 2026." (4) Scope ambiguity — "It is unclear whether \'internal users\' includes contractors."',
      'Risks / Issues is NOT a substitute for a proper risk register. It is a quick indicator on the entry itself that flags active concerns to any reader. Critical risks that affect multiple entries should be escalated to the plan-level risk log and tracked separately.',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (new canonical Planguage parameter) · CE book risk principles · principle_relationship_clarity.md',
  }),

  // ── Qualifier Conditions — Tom Gilb 2026-06-09 ───────────────────────────────
  // Planguage basis: Qualifier *124 (Time *153 / Place *107 / Event *062).
  // SEM App expands to 5 types: When / Where / What / How / Why.
  // Placed AFTER Scale in the spec (or inline as shorthand).
  // If absent, the Scale applies universally to all contexts.

  Conditions: Object.freeze<PentaParamDef>({
    label: 'Conditions',
    keyedIcon: '[When, Where, What, How, Why]',
    shortDef: 'Qualifier block — the circumstances under which this Scale applies.',
    tooltipFull:
      'CONDITIONS *124 — Qualifier block. Lists the specific circumstances (When / Where / What / How / Why) ' +
      'under which this Scale specification applies. If blank, the scale is UNIVERSAL — applies to all contexts. ' +
      'Tom Gilb 2026-06-09: "The when: answer can easily drive solution costs up by 10X."',
    longDef: [
      'Conditions (Planguage: Qualifier *124) define the scope of applicability for a Scale specification. When conditions are present, the spec is ONLY valid under those exact circumstances. When absent, the spec applies universally.',
      'The formal Planguage qualifier uses AND logic — ALL listed conditions must be simultaneously true for the spec to apply. A latency Goal of "50ms [When: peak hours, Where: EU region]" is ONLY a commitment for EU peak-hour traffic.',
      'CRITICAL COST SIGNAL (Tom Gilb, 2026-06-09): A tight "When:" condition (e.g. "during peak load") can drive solution infrastructure costs up by 10× compared to a spec that only applies to average-load conditions. Claudian factors Conditions into cost estimates.',
      'Five condition types in SEM: When (temporal), Where (location/context), What (subject scope), How (method/process), Why (purpose/intent). Each is optional. Use the minimum necessary to be unambiguous.',
    ],
    canonicalSource: 'Planguage Glossary Qualifier *124 · Time *153 · Place *107 · Event *062 · Tom Gilb 2026-06-09',
  }),

  When: Object.freeze<PentaParamDef>({
    label: 'When',
    keyedIcon: 'When:',
    shortDef: 'Temporal condition — time, date, phase, or operational window when this spec applies.',
    tooltipFull:
      'WHEN — Time condition (Planguage: Time *153). Specifies the clock-time, date, phase, or operational period ' +
      'during which this scale specification applies. Examples: "peak hours 08:00–18:00 UTC", ' +
      '"Q2 2026", "after MVP launch", "during monthly close process". ' +
      'A peak-hours constraint can increase solution costs by 10×.',
    longDef: [
      'When specifies the temporal scope of the specification. It maps to Planguage Time (*153): clock-time ranges, calendar dates, project phases, seasonal periods, or operational windows.',
      'Examples: "When: business hours 08:00–18:00 UTC Mon–Fri" · "When: monthly reconciliation window" · "When: after EU AI Act enforcement (2027-08-02)".',
      'COST IMPLICATION: A "When: peak load" condition on a latency or throughput spec means infrastructure must sustain the target under worst-case load — not average. This typically multiplies capacity and solution costs by 5–10×.',
      'If this field is blank, the spec applies at ALL times.',
    ],
    canonicalSource: 'Planguage Glossary Time *153 · CE book Scale Qualifiers · Tom Gilb 2026-06-09',
  }),

  Where: Object.freeze<PentaParamDef>({
    label: 'Where',
    keyedIcon: 'Where:',
    shortDef: 'Location/context condition — geography, user type, system component, or role.',
    tooltipFull:
      'WHERE — Place condition (Planguage: Place *107). Specifies the deployment environment, geographic region, ' +
      'user role, or system component where this spec applies. Examples: "EU datacenters", "mobile clients only", ' +
      '"admin users", "authentication service". If blank, spec applies everywhere.',
    longDef: [
      'Where specifies the spatial or contextual scope of the specification. It maps to Planguage Place (*107): geographic regions, deployment environments, user roles, system components, or organisational units.',
      'Examples: "Where: EU datacenters only (GDPR jurisdiction)" · "Where: mobile clients on 4G/5G" · "Where: authenticated users with active subscription" · "Where: production environment (not staging)".',
      'Where conditions are especially important for regulatory compliance (GDPR applies only to EU residents), performance specs (mobile latency vs desktop), and security specs (applies to external traffic only).',
      'If this field is blank, the spec applies in ALL locations and contexts.',
    ],
    canonicalSource: 'Planguage Glossary Place *107 · CE book Scale Qualifiers · Tom Gilb 2026-06-09',
  }),

  What: Object.freeze<PentaParamDef>({
    label: 'What',
    keyedIcon: 'What:',
    shortDef: 'Subject/scope condition — which entities, data types, or operations this spec covers.',
    tooltipFull:
      'WHAT — Subject scope condition (SEM extension). Specifies which entities, data types, records, or ' +
      'operations this scale specification covers. Examples: "all EU-resident user records", ' +
      '"payment transactions over €100", "read operations only". If blank, spec applies to ALL subjects.',
    longDef: [
      'What narrows the subject scope of the specification — which specific objects, transactions, records, or operations the scale applies to.',
      'Examples: "What: authenticated API requests (not health-check endpoints)" · "What: payment transactions ≥ €100" · "What: EU-resident personally identifiable data" · "What: read operations (writes have a separate spec)".',
      'Without a What condition, the scale is assumed to apply to ALL subjects within the given When/Where context.',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (SEM extension of Qualifier *124) · CE book Scale Qualifiers',
  }),

  How: Object.freeze<PentaParamDef>({
    label: 'How',
    keyedIcon: 'How:',
    shortDef: 'Method/process condition — the operational mode or access path this spec covers.',
    tooltipFull:
      'HOW — Method/process condition (SEM extension). Specifies the operational mode, access method, or process ' +
      'path under which this scale applies. Examples: "via REST API (not batch jobs)", ' +
      '"interactive sessions only", "synchronous calls". If blank, spec applies to ALL methods.',
    longDef: [
      'How narrows the operational method or process path — the specific way a function or value is exercised when this spec applies.',
      'Examples: "How: via REST API synchronous calls (not batch processing)" · "How: interactive real-time sessions (not background imports)" · "How: direct database queries (not via cache layer)".',
      'How conditions matter when the same logical operation has very different performance characteristics depending on the path taken (e.g., sync vs async, cached vs uncached, API vs batch).',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (SEM extension of Qualifier *124) · CE book Scale Qualifiers',
  }),

  Why: Object.freeze<PentaParamDef>({
    label: 'Why',
    keyedIcon: 'Why:',
    shortDef: 'Purpose/intent condition — the use-case or objective for which this spec applies.',
    tooltipFull:
      'WHY — Purpose/intent condition (SEM extension). Specifies the use-case, business objective, or intent ' +
      'for which this scale applies. Examples: "for compliance reporting workflows", ' +
      '"for real-time customer-facing transactions". If blank, spec applies for ALL purposes.',
    longDef: [
      'Why narrows the purpose or intent — the business objective or use-case for which the scale target must be met.',
      'Examples: "Why: for regulatory compliance reporting (not internal analytics)" · "Why: for customer-facing real-time transactions (not back-office batch)" · "Why: for the onboarding flow (not post-login features)".',
      'Why conditions are useful when the same system attribute has different targets for different business purposes — e.g., a latency spec that is strict for customer-facing flows but lenient for internal admin tools.',
    ],
    canonicalSource: 'Tom Gilb 2026-06-09 (SEM extension of Qualifier *124) · CE book Scale Qualifiers',
  }),

  // ── STG family — cross-referenced from PLANGUAGE_TERMS for PlanguageParamLabel lookup ─
  // These duplicate the key content of PLANGUAGE_TERMS so that PlanguageParamLabel
  // can serve a single PENTA_PANEL_PARAMS dict for ALL panel parameters without
  // requiring a separate lookup path. Keep aligned with PLANGUAGE_TERMS.

  Tolerable: Object.freeze<PentaParamDef>({
    label: 'Tolerable',
    keyedIcon: '>>',
    conceptNumber: '539',
    shortDef: 'Project-viability threshold. Below it the WHOLE PROJECT fails.',
    tooltipFull:
      'TOLERABLE >> *539 · Minimum non-failure level. Below it the WHOLE PROJECT fails — ' +
      'not just this attribute. Tolerable is NOT "good enough"; it is the survival line. ' +
      'Above Tolerable but below Goal = project alive, committed target not yet reached.',
    longDef: [
      'Tolerable is the single most critical threshold in the STG (Status · Tolerable · Goal) framework. Below Tolerable, the WHOLE PROJECT fails — not just the attribute value. This is stronger than a defect: it is the project-existence boundary.',
      'Above Tolerable but below Goal = the project is ALIVE but the committed target has not yet been reached. Tolerable is NOT "good enough" — it is the minimum at which the project survives.',
      'Stakeholders at Tolerable performance are explicitly acknowledging that the project is surviving, not succeeding. The distance between Tolerable and Goal is the "survival zone" — still acceptable but not committed.',
    ],
    canonicalSource: 'Planguage Glossary Tolerable *539 · CE book · PLANGUAGE_TERMS.Tolerable',
  }),

  Goal: Object.freeze<PentaParamDef>({
    label: 'Goal',
    keyedIcon: '>',
    conceptNumber: '109',
    shortDef: 'Committed promise — VALID only after 7 conditions hold.',
    tooltipFull:
      'GOAL > *109 · The level the project COMMITS to deliver, negotiated against ALL other Values, ' +
      'Resources, and competing stakeholders. Becomes an official Goal ONLY when 7 validity conditions ' +
      'hold: technically possible · economically possible · cost-consistent · effective · profitable · ' +
      'prioritised · qualifying conditions true. Until then it is a proposed level.',
    longDef: [
      'Goal is the COMMITTED performance target — the level the project agrees to deliver, against which delivery will be measured. A Goal carries an implicit commitment.',
      'A Goal CANNOT be set in isolation. The committed level is the result of a trade-off against ALL other Values, Resources, and competing stakeholders SIMULTANEOUSLY. A proposed level becomes an OFFICIAL Goal only when all 7 Glossary validity conditions hold: technically possible · economically possible · cost-consistent · effective · profitable · prioritised · qualifying conditions true.',
      'A reached Goal reasonably satisfies the relevant stakeholders. Status ≥ Goal = success declared for this attribute — it receives no priority for further improvement. This is the economic stop signal.',
      'SEM Goal Validity Check (GOAL_VALIDITY_CONDITIONS in usePlanguageTerms.ts) automates the assessable conditions. Tom Gilb 2026-06-06: "This Goal condition should be as automatic as possible. It is related to the OPTIMA book balancing."',
      '⚠ WISH-FIRST PRINCIPLE (Tom Gilb 2026-06-09): Before Solutions are identified and funded, stakeholders can ONLY honestly express a Wish — the uncommitted dream level. Setting a Goal prematurely creates false stakeholder expectations. Use Wish as the planning target until MultiVision IET confirms ≥100% delivery capability. Only then does the negotiated level become a committed Goal. Tom Gilb verbatim: "Long story short, use only wish until we can see 100% capability of delivering it, and we have a tool for that (MultiVision)."',
      'CONTRAST WITH "CUSTOMER IS ALWAYS RIGHT" (Tom Gilb 2026-06-09): Other methods treat the customer desire as a committed requirement automatically. Planguage has common sense logic: a Wish to reach the moon in 5 seconds is recorded as a Wish — never committed as a Goal. Goal = desire that has survived a full reality check (7 validity conditions + MultiVision IET ≥100% delivery confirmation). This is advanced planning practice that other methods have not figured out yet.',
    ],
    canonicalSource: 'Planguage Glossary Goal *109 · CE book · GOAL_VALIDITY_CONDITIONS · PLANGUAGE_TERMS.Goal · Tom Gilb 2026-06-09',
  }),

  Wish: Object.freeze<PentaParamDef>({
    label: 'Wish',
    keyedIcon: '>?',
    conceptNumber: '244',
    shortDef: 'Stakeholder-articulated level — uncommitted, ANY position on scale.',
    tooltipFull:
      'WISH >? *244 · The level a stakeholder ARTICULATED — uncommitted. NOT systematically greater than Goal. ' +
      'A Wish can sit anywhere on the scale (above, equal to, or below Goal — optimistic OR pessimistic). ' +
      'If the stakeholder did not articulate any Wish, there is NO Wish to record. ' +
      'Independent of cost and physics; the project does NOT commit to it.',
    longDef: [
      '⚠ Common misreading: "Wish is always above Goal." This is WRONG. In Planguage, the Wish is whatever the stakeholder articulated — optimistic OR pessimistic — regardless of where that sits on the scale.',
      'A Wish records a stakeholder-articulated target level. If the stakeholder has NOT articulated a Wish, THERE IS NO WISH TO RECORD. Do not synthesise one.',
      'Tom Gilb 2026-06-07: "A Wish can be converted to a Goal of same or different (more or less) magnitude." And: "New Wishes can occur after a Goal is committed." The spec is living — new Wishes emerge as conditions change.',
      'The keyed icon >? signals "a perhaps questionable goal" — a stakeholder-valued level worth tracking but NOT yet negotiated into a project commitment.',
      'EARLY-STAGE PLANNING TARGET (Tom Gilb 2026-06-09): Before Solutions are found and funded, Wish is the CORRECT planning target — NOT Goal. Wish makes honest what is desired without falsely committing. ⚠ The Wish is NOT a committed requirement — this warning must always be visible wherever Wish appears. Once MultiVision IET confirms ≥100% delivery capability, the Wish can be promoted to a committed Goal.',
      'COMMON SENSE REALITY CHECK (Tom Gilb 2026-06-09): Other planning methods adopt a simplistic "customer is always right" mentality. Planguage is more advanced — the Wish records the customer desire honestly, but it does NOT automatically become a committed Goal. If a customer wishes to reach the moon and back in 5 seconds, that is faithfully recorded as a Wish. We would be foolish to declare it a committed Goal. Reality-checking the Wish against the 7 Goal validity conditions is common sense logic — the core Planguage discipline that separates serious planning engineering from wishful commitments.',
    ],
    canonicalSource: 'Planguage Glossary Wish *244 · CE book · PLANGUAGE_TERMS.Wish · Tom Gilb 2026-06-09',
  }),

  // ── Source — field-level source attribution (Tom Gilb 2026-06-09 Spec Sources design) ──
  // "Source: will always be specified explicitly or implied from editing or AI change activity."
  // Each field in a Planguage spec entry carries its own Source record: who/what last set it
  // and when. The [←] keyed icon signals: source flows INTO the spec from outside.

  Source: Object.freeze<PentaParamDef>({
    label: 'Source',
    keyedIcon: '[←]',
    shortDef: 'Who or what specified this element — person, team, or AI tool name.',
    tooltipFull:
      'SOURCE [←] · The origin of each field value in this spec entry. ' +
      'Who or what last set this specific field? ' +
      'Human examples: "Tom Gilb", "Jane Smith", "Board". ' +
      'AI examples: "Optima", "Penta", "SEM Stage 3", "EVO Planner". ' +
      'Planguage rule: "Source: will always be specified explicitly or implied from editing or AI change activity." ' +
      'The [←] keyed icon: source flows INTO the spec from outside.',
    longDef: [
      'SOURCE IS FUNDAMENTAL TO SPEC CREDIBILITY. Every field value in a Planguage spec entry has a responsible origin: someone or something set that value — and accountability requires we know who or what. Without source attribution, you cannot answer: "Who decided this Goal?" "Was this Meter set by a domain expert or an AI guess?" "Has anyone with authority actually committed to this Tolerable?"',
      'HOW SOURCE ATTRIBUTION WORKS: When a human edits a field and clicks Apply Changes, the source is stamped automatically using the plan owner name from Settings. When an AI tool (Optima, Penta, SEM Stage 3, EVO Planner) generates a value, the source is stamped with the exact tool name. The default source is the person or device entering the data. For a group of fields changed in one action (e.g., Apply Changes, AI generation), all changed fields receive the same source/timestamp in one stamp.',
      'THE SOURCE KNOWLEDGE PHI CHECK: The Plan Health Index includes a "Source Knowledge nn%" indicator — the percentage of significant spec fields (Scale, Meter, Goal, Tolerable, Status for Values; Scale, Meter, Budget for Resources; description for Functions/Solutions/Constraints) that have explicit source attribution. A high Source Knowledge score means the spec is traceable and auditable. A low score means fields exist whose origin is unknown — a credibility risk.',
      'DISPLAY PATTERN: Source info is normally shrouded (not cluttering the display). A small [←] pin at the end/right of each field label always indicates "source attribution state" — violet when a source is recorded, amber when no source exists yet. Hover the pin to see source name, type, and timestamp. Click the pin to expand the full source card inline.',
      'Tom Gilb 2026-06-09 verbatim: "Source: will always be specified explicitly or implied from editing or AI change activity." The [←] arrow symbol encodes this directionally: information from outside (the person, the AI, the system) flows inward into the spec — leaving a traceable record of that inward flow.',
    ],
    canonicalSource: 'Tom Gilb Spec Sources design 2026-06-09 · CE *Source · Planguage Glossary Source',
  }),
})

// ── Resource allocation level definitions (Tom Gilb 2026-06-07) ──────────────
//
// Tom verbatim:
//   "IT IS THE MINIMUM RESOURCE ALLOCATED OR AVAILABLE FOR CONSUMPTION, THAT
//    WILL NOT CAUSE A STATE OR DEGREE OF FAILURE TO THE SYSTEM."
//   "CONSUMPTION ITSELF IS A DIFFERENT MATTER (IT WILL HAPPEN LATER, BUT IT IS
//    NOT A PLAN TO CONSUME, JUST A HISTORIC FACT)."
//   "A Budget is an Official stipulation of a financial allocation for a purpose."
//   "A wish level is a stakeholder desire for resources, sometimes in advance of
//    knowing the official allocated budget. They can be on either side of an
//    official budget number."
//
// These are SEPARATE from the STG (Status · Tolerable · Goal) family for Values.
// Resources use an ALLOCATION axis.  Consumption (Status / Now) is historical.
//
// Axis semantics for Resources (forward polarity when Budget ≥ Tolerable):
//   LEFT = insufficient allocation (failure risk)
//   RIGHT = adequate-to-generous allocation (success zone)
//   Order left→right: Tolerable (floor) → Budget (official) → Wish/Ideal (aspirational)
//
// Canonical source: Tom Gilb 2026-06-07 doctrinal clarification.
// Glossary entry proposal filed: Proposed-Updates-to-Kais-Standards.md 2026-06-07.

export const RESOURCE_ALLOCATION_TERMS = Object.freeze({

  // ── Tolerable for Resources *539 — minimum allocation for non-failure ───────
  TolerableResource: Object.freeze({
    name: 'Tolerable (Resource)',
    conceptNumber: '*539',
    keyedIcon: '>>',
    role: 'Minimum allocation for non-failure',
    shortDef:
      'Minimum resource allocation that will not cause system failure. ' +
      'Below this, the project cannot deliver its committed targets.',
    tooltipFull:
      'RESOURCE TOLERABLE >> · Minimum allocation for non-failure. ' +
      'The least amount of this resource that must be allocated or available ' +
      'for the system to deliver its committed Functions and Value targets. ' +
      'NOT a consumption ceiling — consumption is a separate historical fact. ' +
      'If allocation falls below this floor, the project fails on this resource.',
    longDef: [
      'For Resources, Tolerable is the MINIMUM allocation that must be available — NOT a maximum consumption cap.',
      'Tom Gilb 2026-06-07 verbatim: "IT IS THE MINIMUM RESOURCE ALLOCATED OR AVAILABLE FOR CONSUMPTION, THAT WILL NOT CAUSE A STATE OR DEGREE OF FAILURE TO THE SYSTEM."',
      'Consumption (Status / Now) is a separate historical fact that happens later. Tolerable is about ALLOCATION — what must be made available, not how much will be spent.',
      'Below Tolerable allocation, the system cannot deliver its committed Functions and Value targets. This is the resource survival floor — the same concept as the Value Tolerable but applied to the allocation axis rather than the performance axis.',
      'Budget ≥ Tolerable → adequately funded (forward polarity: Tolerable left, Budget right). Budget < Tolerable → under-resourced (failure state — the allocated amount is below the survival floor).',
    ],
    stgPosition: 'left-most allocation floor — minimum for non-failure',
    commitment: 'no-commitment (project alive)' as const,
  }),

  // ── Budget — official resource allocation ───────────────────────────────────
  // Tom Gilb 2026-06-07: "A Budget is an Official stipulation of a financial
  // allocation for a purpose." Not a performance target — an administrative
  // commitment. Generic term; specialised: Deadline (time), Headcount (people).
  Budget: Object.freeze({
    name: 'Budget',
    conceptNumber: 'R-Budget',
    keyedIcon: '>',
    role: 'Official resource allocation — the committed resource envelope',
    shortDef:
      'Officially allocated resource amount. Generic term for all resource limits. ' +
      'Specialised: Deadline (time), Headcount (people).',
    tooltipFull:
      'RESOURCE BUDGET · Official stipulation of financial/resource allocation. ' +
      'Tom Gilb 2026-06-07: "A Budget is an Official stipulation of a financial ' +
      'allocation for a purpose. It is what it is." NOT a performance target — ' +
      'an administrative commitment. Specialised terms: Deadline (time), Headcount (people).',
    longDef: [
      'Budget is the officially allocated amount of a resource. It is WHAT IS AVAILABLE for the project to use — not a target for how much to spend.',
      'Tom Gilb 2026-06-07 verbatim: "A Budget is an Official stipulation of a financial allocation for a purpose. It is what it is."',
      'Specialised vocabulary for resource kinds: Deadline for calendar-time resources; Headcount for people resources; Budget as the generic term for all others (money, compute, licences, etc.).',
      'A Budget should sit at or above the Tolerable floor. If Budget < Tolerable, the project is under-resourced — the officially allocated amount is insufficient to avoid failure.',
      'Budget history matters: Tom Gilb 2026-06-07: "A Budget might have past versions which could be recorded (a version history of official budgets)." The budgetHistory field captures this.',
    ],
    stgPosition: 'official allocation level — should be ≥ Tolerable floor',
    commitment: 'committed promise' as const,
  }),

  // ── Wish for Resources *244 — stakeholder-desired allocation ────────────────
  // Tom Gilb 2026-06-07: "A wish level is a stakeholder desire or resources,
  // sometimes in advance of knowing the official allocated budget. There can
  // be a set of Wishes through time, even from different stakeholders. They
  // can be on either side of an official budget number, when it arrives. If
  // no stakeholder expresses a Wish, then none need be specified."
  ResourceWish: Object.freeze({
    name: 'Wish (Resource)',
    conceptNumber: '*244',
    keyedIcon: '>?',
    role: 'Stakeholder-desired allocation — uncommitted, either side of Budget',
    shortDef:
      'Stakeholder-desired resource amount. Uncommitted. Can be above or below the Budget. ' +
      'Optional — if no stakeholder has articulated a Wish, there is none to record.',
    tooltipFull:
      'RESOURCE WISH >? · Stakeholder-desired allocation — uncommitted. ' +
      'Tom Gilb 2026-06-07: "can be on either side of an official budget number, ' +
      'when it arrives. If no stakeholder expresses a Wish, then none need be specified." ' +
      'Wish above Budget = stakeholder perceives under-resourcing. ' +
      'Wish below Budget = stakeholder sees potential over-allocation.',
    longDef: [
      'For Resources, Wish is whatever allocation amount a stakeholder has articulated as desired — optimistic OR pessimistic, above OR below the official Budget.',
      'Tom Gilb 2026-06-07 verbatim: "There can be a set of Wishes through time, even from different stakeholders. They can be on either side of an official budget number, when it arrives."',
      'Wish above Budget: the stakeholder believes more is needed. This is a signal to check whether Ideal > Budget (under-resourcing confirmed) or whether the Wish is optimistic over-estimation.',
      'Wish below Budget: the stakeholder believes less would suffice. This could signal over-allocation — worth checking against the Ideal level.',
      'Tom Gilb 2026-06-07: "If no stakeholder expresses a Wish, then none need be specified." Unlike Tolerable and Budget which are mandatory for a complete Resource spec, Wish is truly optional.',
    ],
    stgPosition: 'wherever the stakeholder articulated it — either side of Budget, or absent',
    commitment: 'no-commitment (stakeholder dream)' as const,
  }),

  // ── Ideal for Resources — derived allocation for full target achievement ─────
  // Tom Gilb 2026-06-07 (new concept, not yet in CE Glossary):
  // "The resource [that] would ideally allocate in order to reach all current
  // value Targets (wishes and goals), given the identified solutions."
  // "Need to create new Glossary entry for 'Ideal (for Resources)'"
  ResourceIdeal: Object.freeze({
    name: 'Ideal (Resource)',
    conceptNumber: 'R-Ideal',     // pending Glossary ratification by Kai Gilb
    keyedIcon: '>*',
    role: 'Derived: allocation needed to reach ALL Value Targets given Solutions',
    shortDef:
      'The allocation that would reach ALL current Value Targets (Wishes + Goals) ' +
      'given the identified Solutions. Derived by analysis — not entered directly.',
    tooltipFull:
      'RESOURCE IDEAL >* · Derived allocation for full target achievement. ' +
      'Tom Gilb 2026-06-07: "The resource that would ideally allocate in order ' +
      'to reach all current value Targets (wishes and goals), given the identified ' +
      'solutions." Ideal > Budget → under-resourced. Ideal ≤ Budget → sufficient.',
    longDef: [
      'Ideal is a DERIVED quantity — what amount of resource would be required to reach ALL current Value Targets (Wishes and Goals) given the currently identified Solutions.',
      'Tom Gilb 2026-06-07 verbatim: "The resource [that] would ideally allocate in order to reach all current value Targets (wishes and goals), given the identified solutions."',
      'When Ideal > Budget → under-resourced: the current allocation is insufficient to reach all targets. Signal: either increase Budget, reduce target set, or identify more efficient Solutions.',
      'When Ideal ≤ Budget → sufficient: the current allocation covers the full target set. Gap = Budget − Ideal = resource headroom / slack.',
      'Ideal is NOT a stakeholder aspiration (that is Wish). Ideal is computed from the plan\'s Value+Solution set by analytical methods (Claudian / OPTIMA). A new Glossary entry "Ideal (for Resources)" has been proposed to Kai Gilb (2026-06-07).',
    ],
    stgPosition: 'derived level — not user-entered; signals adequacy of Budget vs full-target cost',
    commitment: 'no-commitment (project alive)' as const,
  }),
})
