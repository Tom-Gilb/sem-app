// UNIT_TYPE=Composable
// useMungerFindings.ts — Munger Agent finding engine (Charlie Munger's 12 Prompts).
//
// Tom Gilb 2026-06-20 verbatim:
//   "Munger Agent: using CHARLIE MUNGERS RULES in assets, make an analytical agent
//    with all the ideas like sharpening, in agents Elon, Incorruptible, Maria"
//
// Source PDF: `5 - Project/SEM App/assets/Munger Agent/CHARLIE MUNGERS RULES.pdf`
//
// Architecture mirrors useElonFindings.ts:
//   - Deterministic rule engine scans a SpecBlock and emits MungerFinding[]
//   - 12 detectors — one per Munger prompt
//   - Source-layer 'derived-from-plan' on every detector; citations stamped per Munger PDF
//   - Stable IDs across re-runs (id = `munger-${category}-${triggerId}`)
//
// Composes with:
//   - Conjunction-of-Technologies (Plan + Munger PDF + Poor Charlie's Almanack + Gilb + LLM)
//   - AI-Max (suggestions surface immediately)
//   - Claude-Code-as-AI-Layer (no embedded API)
//   - Architectural Resilience (deterministic IDs)
//   - Universal Undo (Accept-Fix routes through useUndoHistory)
//   - Source-stamp sweep (every fix-applied entry carries provenance)

import { computed, ref, type Ref } from 'vue'
import type { SpecBlock, VEntry, FEntry, SEntry, CEntry, REntry, FieldSource } from '../types/spec'
import type {
  MungerFinding,
  MungerReport,
  MungerCategory,
  MungerSeverity,
  MungerSourceLayer,
  MungerFix,
} from '../types/munger'
import { MUNGER_CATEGORY_META } from '../types/munger'

// ── Module-level state ──────────────────────────────────────────────────────
const _currentReport = ref<MungerReport | null>(null)
const _dismissedIds  = ref<Set<string>>(new Set())

// ── Helpers ─────────────────────────────────────────────────────────────────

function _emptyByCategory(): Record<MungerCategory, MungerFinding[]> {
  return {
    'inversion':            [],
    'second-order':         [],
    'circle-of-competence': [],
    'bias-audit':           [],
    'lollapalooza':         [],
    'opportunity-cost':     [],
    'fat-pitch':            [],
    'incentive-map':        [],
    'simplicity-filter':    [],
    'destroy-own-idea':     [],
    'long-game':            [],
    'deathbed':             [],
  }
}

function _now(): string {
  return new Date().toISOString()
}

function _stableId(category: MungerCategory, triggerId: string): string {
  return `munger-${category}-${triggerId.replace(/[^A-Za-z0-9-]/g, '_')}`
}

function _buildMungerSource(category: MungerCategory): FieldSource {
  return {
    source:     'Munger Agent',
    sourceType: 'ai',
    tool:       `Munger · ${MUNGER_CATEGORY_META[category].label}`,
    timestamp:  _now(),
  }
}

// ── Detectors ───────────────────────────────────────────────────────────────
// Each detector returns 0..N findings. Detectors run on a SpecBlock + plan title.

interface DetectorContext {
  spec: SpecBlock
  planTitle: string
}

/** Inversion — Plan must name at least one explicit failure mode (C. entry "Must not …"
 *  or an enumerated risk on a V. entry). If none → finding. */
function detectInversion(ctx: DetectorContext): MungerFinding[] {
  const constraints = ctx.spec.constraints ?? []
  const negativeConstraints = constraints.filter(c =>
    /must not|never|avoid|prevent|prohibit/i.test(c.description ?? ''))
  const valuesWithRisks = (ctx.spec.values ?? []).filter(v =>
    !!v.risks && v.risks.trim().length > 0)
  if (negativeConstraints.length > 0 || valuesWithRisks.length > 0) return []

  return [{
    id: _stableId('inversion', 'plan-level'),
    category: 'inversion',
    severity: 'critical',
    sourceLayer: 'derived-from-plan',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 1 — Inversion',
    almanackCitation: 'Poor Charlie\'s Almanack — "Invert, always invert" (Jacobi)',
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Inversion — no failure modes named',
    explanation:
      'The plan lists no "Must not …" Constraints and no V.risks fields. Munger\'s most ' +
      'famous rule: invert. Before asking how to succeed, list every way you could fail — ' +
      'then design to avoid each one.',
    suggestedFix: {
      type: 'add-failure-mode-constraint',
      asPlanguage:
        'C.Inversion: Must not [list each named failure mode for this plan]. ' +
        'Source: Munger Inversion Prompt — generated 2026-06-20 by Munger Agent.',
      targetItemId: 'plan-level',
      rationale:
        'Adding an explicit failure-mode Constraint forces the planner to enumerate ' +
        'what to AVOID. Munger: most problems are best understood backwards.',
    },
    longTermConsequence:
      'Plans without inverted failure-mode thinking discover their failure modes through ' +
      'expensive lived experience instead of cheap upfront analysis.',
    generatedAtIso: _now(),
  }]
}

/** Second-Order Thinking — every V. entry should have BOTH a primary scale AND at least one
 *  derived/dependent metric (rationale or impactsValues link) that captures effects of effects. */
function detectSecondOrder(ctx: DetectorContext): MungerFinding[] {
  const findings: MungerFinding[] = []
  for (const v of ctx.spec.values ?? []) {
    const hasRationale = !!v.justification && v.justification.trim().length > 0
    // r41 v230 — defensive: tolerate non-string valueOfFunction shapes from
    // historical stored specs.  String type expected; anything else degrades
    // to "not linked" without throwing.
    const hasLinkedFn = typeof v.valueOfFunction === 'string' && v.valueOfFunction.trim().length > 0
    if (hasRationale && hasLinkedFn) continue
    findings.push({
      id: _stableId('second-order', v.id),
      category: 'second-order',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      mungerCitation: 'CHARLIE MUNGERS RULES Prompt 2 — Second-Order Thinking',
      almanackCitation: null,
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: v.id,
      principleViolated: 'Second-Order Thinking — no downstream consequence named',
      explanation:
        `${v.id} measures a first-order metric but does not name the second-order effects ` +
        '(rationale + linked Function). Munger thought 3 steps ahead; a Value without a ' +
        'rationale is a 1-step metric blind to its own consequences.',
      suggestedFix: {
        type: 'add-second-order-value',
        asPlanguage:
          `${v.id}.Rationale: [why this Value matters — what downstream effects flow from ` +
          'meeting/missing the Goal]. Source: Munger Second-Order Prompt.',
        targetItemId: v.id,
        rationale:
          'Naming the second-order rationale converts a 1-step metric into a ' +
          '3-step instrument. Munger: effects of the effects are where the real value lives.',
      },
      longTermConsequence:
        'A spec measured only on first-order outcomes silently optimizes against its own ' +
        'higher-order goals (e.g. hitting a quarterly Goal while destroying reputation).',
      generatedAtIso: _now(),
    })
  }
  return findings.slice(0, 5) // cap to avoid drowning the user
}

/** Circle of Competence — the plan should have at least one Constraint naming what it does NOT
 *  cover (scope exclusion). If none → finding. */
function detectCircleOfCompetence(ctx: DetectorContext): MungerFinding[] {
  const constraints = ctx.spec.constraints ?? []
  const scopeExclusions = constraints.filter(c =>
    /out of scope|not in scope|excluded|will not|does not cover/i.test(
      (c.description ?? '') + ' ' + (c.scope ?? '') + ' ' + (c.rationale ?? '')))
  if (scopeExclusions.length > 0) return []

  return [{
    id: _stableId('circle-of-competence', 'plan-level'),
    category: 'circle-of-competence',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 3 — Circle of Competence',
    almanackCitation: 'Poor Charlie\'s Almanack — "Know the edge of your competence"',
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Circle of Competence — scope edge not named',
    explanation:
      'No Constraint declares what this plan DOES NOT cover. Munger: the size of your circle ' +
      'doesn\'t matter — knowing its EDGE does. Plans without explicit scope-exclusions silently ' +
      'leak attention, budget, and stakeholder expectation into uncovered areas.',
    suggestedFix: {
      type: 'add-competence-edge-constraint',
      asPlanguage:
        'C.CircleOfCompetence: Must not extend scope to [name the adjacent areas this plan ' +
        'will NOT attempt]. Source: Munger Circle-of-Competence Prompt.',
      targetItemId: 'plan-level',
      rationale:
        'A named scope-exclusion Constraint converts implicit silence into explicit boundary — ' +
        'stakeholders cannot assume coverage of areas you have deliberately excluded.',
    },
    longTermConsequence:
      'Scope leaks compound. Every unnamed extension becomes an implicit promise the plan ' +
      'cannot honour, eroding trust over time.',
    generatedAtIso: _now(),
  }]
}

/** Bias Audit — Plan should name at least one cognitive-bias Constraint
 *  (confirmation bias / incentive bias / social proof / scarcity / commitment etc.). */
function detectBiasAudit(ctx: DetectorContext): MungerFinding[] {
  const constraints = ctx.spec.constraints ?? []
  const biasMentions = constraints.filter(c =>
    /bias|cognitive|confirmation|incentive bias|social proof|scarcity|commitment|anchoring|loss aversion|availability|sunk cost/i
      .test((c.description ?? '') + ' ' + (c.rationale ?? '')))
  if (biasMentions.length > 0) return []

  return [{
    id: _stableId('bias-audit', 'plan-level'),
    category: 'bias-audit',
    severity: 'moderate',
    sourceLayer: 'cited-munger-psych-misjudgment',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 4 — Bias Audit',
    almanackCitation: 'Poor Charlie\'s Almanack ch.11 — "The Psychology of Human Misjudgment" (25 biases)',
    gilbCitation: null,
    verifyUrl: 'https://en.wikipedia.org/wiki/The_Psychology_of_Human_Misjudgment',
    triggeredBy: 'plan-level',
    principleViolated: 'Bias Audit — no named cognitive-bias check',
    explanation:
      'No Constraint names a cognitive bias the plan must guard against. Munger catalogued 25 ' +
      'biases that destroy decision-making (his 1995 Harvard speech). A plan with no bias-audit ' +
      'check is silently shaped by whichever bias the author has most strongly.',
    suggestedFix: {
      type: 'add-bias-audit-constraint',
      asPlanguage:
        'C.BiasAudit: Plan decisions must be reviewed against the following named cognitive ' +
        'biases: [confirmation bias, incentive bias, social proof, commitment escalation, ' +
        'availability heuristic]. Review cadence: [every Evo Step / quarterly]. ' +
        'Source: Munger 25-Biases speech.',
      targetItemId: 'plan-level',
      rationale:
        'Naming the biases makes them auditable. Munger studied biases obsessively SO HE COULD ' +
        'CATCH HIMSELF using them.',
    },
    longTermConsequence:
      'Un-audited biases compound. Each unchecked decision feeds the next, and by the time ' +
      'the pattern is visible the plan has drifted far from its starting thesis.',
    generatedAtIso: _now(),
  }]
}

/** Lollapalooza — Plan should have at least one Value naming compound-force effects
 *  (multiple drivers that align to produce extreme outcomes — good or bad). */
function detectLollapalooza(ctx: DetectorContext): MungerFinding[] {
  const values = ctx.spec.values ?? []
  const compoundMentions = values.filter(v =>
    /compound|combine|cascade|amplif|reinforce|positive feedback|network effect/i.test(
      (v.description ?? '') + ' ' + (v.justification ?? '') + ' ' + (v.risks ?? '')))
  if (compoundMentions.length > 0) return []
  if (values.length < 3) return [] // Too small a plan to expect compound analysis

  return [{
    id: _stableId('lollapalooza', 'plan-level'),
    category: 'lollapalooza',
    severity: 'suggestion',
    sourceLayer: 'derived-from-plan',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 5 — Lollapalooza',
    almanackCitation: 'Poor Charlie\'s Almanack — Munger\'s coinage for multi-force compounding',
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Lollapalooza — no compound-force analysis',
    explanation:
      'No Value mentions compound effects, cascades, or reinforcing dynamics. Munger\'s ' +
      'Lollapalooza concept: when multiple positive forces align they produce outsized ' +
      'success; when multiple negative forces align they produce catastrophic failure. ' +
      'A plan that doesn\'t name its compounding dynamics underestimates BOTH extremes.',
    suggestedFix: {
      type: 'add-lollapalooza-value',
      asPlanguage:
        'V.LollapaloozaUpside: [Scale of how compound positive forces could amplify success] · ' +
        'Source: Munger Lollapalooza Prompt.\n' +
        'V.LollapaloozaDownside: [Scale of how compound negative forces could cascade failure] · ' +
        'Source: Munger Lollapalooza Prompt.',
      targetItemId: 'plan-level',
      rationale:
        'Lollapalooza thinking surfaces the extreme tails. Plans that only model average ' +
        'outcomes miss both the upside and downside that compound forces produce.',
    },
    longTermConsequence:
      'Compound effects are invisible until they happen. The catastrophic-failure case is ' +
      'almost never one force — it is several forces aligning in the same direction.',
    generatedAtIso: _now(),
  }]
}

/** Opportunity Cost — Plan should name at least one alternative use of its key resource. */
function detectOpportunityCost(ctx: DetectorContext): MungerFinding[] {
  const resources = ctx.spec.resources ?? []
  if (resources.length === 0) {
    return [{
      id: _stableId('opportunity-cost', 'plan-level'),
      category: 'opportunity-cost',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      mungerCitation: 'CHARLIE MUNGERS RULES Prompt 6 — Opportunity Cost',
      almanackCitation: null,
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'Opportunity Cost — no Resource entries, no compared-to-what baseline',
      explanation:
        'Plan has no Resource (R.) entries. Munger: every yes is a no to something else. ' +
        'Without R. entries naming the budget/time/capacity being committed, there is no ' +
        '"compared to what?" baseline against which to evaluate the plan.',
      suggestedFix: {
        type: 'add-opportunity-cost-constraint',
        asPlanguage:
          'R.PrimaryResource: [name the dominant resource — money/time/people] · ' +
          'Budget: [value] · Source: Munger Opportunity-Cost Prompt.\n' +
          'C.OpportunityCost: This plan is preferred over [alternative use of the same ' +
          'resource]. Rationale: [why].',
        targetItemId: 'plan-level',
        rationale:
          'Adding a Resource + a named alternative converts implicit "doing nothing" baseline ' +
          'into explicit "doing X instead" comparison.',
      },
      longTermConsequence:
        'Plans without an alternative-use comparison silently over-commit because the ' +
        'implicit baseline is "doing nothing", not "doing the next-best thing".',
      generatedAtIso: _now(),
    }]
  }
  // Resources exist — check if any have justification (alternative use named)
  const withRationale = resources.filter(r =>
    !!r.justification && r.justification.trim().length > 20)
  if (withRationale.length > 0) return []
  return [{
    id: _stableId('opportunity-cost', 'no-rationale'),
    category: 'opportunity-cost',
    severity: 'suggestion',
    sourceLayer: 'derived-from-plan',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 6 — Opportunity Cost',
    almanackCitation: null,
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Opportunity Cost — Resources lack alternative-use rationale',
    explanation:
      'Resource entries exist but none carry a Rationale naming the alternative use. ' +
      'Munger: always ask "compared to what?"',
    suggestedFix: {
      type: 'add-opportunity-cost-constraint',
      asPlanguage:
        'Add Rationale on each Resource: "Allocated to this plan instead of [alternative]. ' +
        'Reason this plan wins the comparison: [why]." Source: Munger Opportunity-Cost Prompt.',
      targetItemId: resources[0].id,
      rationale:
        'A Resource without a comparative Rationale is a blank check. Named alternatives ' +
        'force explicit trade-off thinking.',
    },
    longTermConsequence:
      'Un-compared resource commitments accumulate into a budget that nobody can justify ' +
      'against the alternatives at review time.',
    generatedAtIso: _now(),
  }]
}

/** Fat Pitch — Plans with too many parallel Solutions dilute attention. */
function detectFatPitch(ctx: DetectorContext): MungerFinding[] {
  const solutions = ctx.spec.solutions ?? []
  if (solutions.length < 6) return []
  return [{
    id: _stableId('fat-pitch', 'too-many-solutions'),
    category: 'fat-pitch',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 7 — Fat Pitch',
    almanackCitation: 'Poor Charlie\'s Almanack — Munger\'s wait-for-the-fat-pitch principle',
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Fat Pitch — too many parallel Solutions',
    explanation:
      `Plan has ${solutions.length} Solutions. Munger\'s fat-pitch rule: wait for the perfect ` +
      'opportunity, then swing hard. Too many parallel commitments dilute attention; one clean ' +
      'over-the-fence pitch beats ten weak base hits.',
    suggestedFix: {
      type: 'add-fat-pitch-filter',
      asPlanguage:
        'C.FatPitchFilter: Solutions must pass this filter before commitment: ' +
        '[1] high-confidence win, [2] strong alignment with one named Goal, ' +
        '[3] no competing Solution already committed for the same Goal. ' +
        'Source: Munger Fat-Pitch Prompt.',
      targetItemId: 'plan-level',
      rationale:
        'Adding a fat-pitch filter Constraint disciplines the Solution commit decision — ' +
        'only Solutions that clearly pass enter the plan.',
    },
    longTermConsequence:
      'Plans that commit to too many parallel Solutions split attention; none gets the ' +
      'concentrated effort that produces an over-the-fence result.',
    generatedAtIso: _now(),
  }]
}

/** Incentive Map — every Stakeholder should name its actual incentive (not just its role). */
function detectIncentiveMap(ctx: DetectorContext): MungerFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const withoutIncentive = stakeholders.filter(s => {
    const txt = (s.definition ?? '') + ' ' + (s.description ?? '')
    return !/incentive|driver|motivat|reward|gain|loss/i.test(txt)
  })
  if (stakeholders.length === 0 || withoutIncentive.length === 0) return []
  return [{
    id: _stableId('incentive-map', 'stakeholders'),
    category: 'incentive-map',
    severity: 'moderate',
    sourceLayer: 'cited-munger-prompts',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 8 — Incentive Map',
    almanackCitation: 'Poor Charlie\'s Almanack — "Show me the incentive, I\'ll show you the outcome"',
    gilbCitation: 'Gilb — Stakeholder Engineering (incentive as required Stakeholder parameter)',
    verifyUrl: null,
    triggeredBy: stakeholders[0].id,
    principleViolated: 'Incentive Map — stakeholders lack actual-incentive description',
    explanation:
      `${withoutIncentive.length} of ${stakeholders.length} Stakeholders do not name their ` +
      'actual incentive. Munger\'s most-repeated lesson: show me the incentive and I\'ll ' +
      'show you the outcome. Stakeholders silently shape plans via their incentives — ' +
      'unmapped incentives reshape the plan invisibly.',
    suggestedFix: {
      type: 'add-incentive-source',
      asPlanguage:
        'Add to each Stakeholder Description: "Actual incentive: [what they GAIN if plan ' +
        'succeeds / LOSE if it fails — distinct from stated role]." ' +
        'Source: Munger Incentive-Map Prompt.',
      targetItemId: stakeholders[0].id,
      rationale:
        'Naming actual incentives makes invisible influence visible. The plan can then ' +
        'design around incentive misalignments instead of getting reshaped by them.',
    },
    longTermConsequence:
      'Unmapped incentives reshape plans during execution — by the time the reshape is ' +
      'visible the plan is far from its original thesis.',
    generatedAtIso: _now(),
  }]
}

/** Simplicity Filter — any V./F./S. with > 3 sentences in description fails the 12-year-old test. */
function detectSimplicityFilter(ctx: DetectorContext): MungerFinding[] {
  const findings: MungerFinding[] = []
  const collect = (items: Array<{ id: string; description?: string }>) => {
    for (const item of items) {
      const desc = item.description ?? ''
      const sentenceCount = desc.split(/[.!?]+/).filter(s => s.trim().length > 4).length
      if (sentenceCount <= 3) continue
      findings.push({
        id: _stableId('simplicity-filter', item.id),
        category: 'simplicity-filter',
        severity: 'suggestion',
        sourceLayer: 'derived-from-plan',
        mungerCitation: 'CHARLIE MUNGERS RULES Prompt 9 — Simplicity Filter',
        almanackCitation: null,
        gilbCitation: 'Gilb — Planguage Parameter Discipline SUPREME (≤ 20-word description)',
        verifyUrl: null,
        triggeredBy: item.id,
        principleViolated: 'Simplicity Filter — description exceeds 3 sentences',
        explanation:
          `${item.id} description has ~${sentenceCount} sentences. Munger: if you can\'t ` +
          'explain it in 3 sentences a smart 12-year-old could understand, you don\'t ' +
          'understand it. Composes with Gilb Planguage Parameter Discipline (≤ 20 words).',
        suggestedFix: {
          type: 'simplify-description',
          asPlanguage:
            `${item.id} — rewrite description in ≤ 3 sentences a smart 12-year-old could ` +
            'understand. Move rationale/scale/meter to their dedicated parameter fields.',
          targetItemId: item.id,
          rationale:
            'Munger passed on hundreds of deals because he couldn\'t reduce them to a simple ' +
            'thesis. Same here — a description that doesn\'t fit in 3 sentences hides scope creep.',
        },
        longTermConsequence:
          'Complex descriptions carry hidden complexity that surfaces as scope creep, ' +
          'miscommunication, or unbuildable solutions.',
        generatedAtIso: _now(),
      })
    }
  }
  collect(ctx.spec.values ?? [])
  collect(ctx.spec.functions ?? [])
  collect(ctx.spec.solutions ?? [])
  return findings.slice(0, 5)
}

/** Destroy Your Own Idea — Plan should have at least one Constraint naming a "kill switch":
 *  a testable condition that would invalidate the plan. */
function detectDestroyOwnIdea(ctx: DetectorContext): MungerFinding[] {
  const constraints = ctx.spec.constraints ?? []
  const killSwitches = constraints.filter(c =>
    /fail if|kill if|abandon|invalidat|disprove|stop if|exit if/i.test(
      (c.description ?? '') + ' ' + (c.rationale ?? '')))
  if (killSwitches.length > 0) return []
  return [{
    id: _stableId('destroy-own-idea', 'plan-level'),
    category: 'destroy-own-idea',
    severity: 'critical',
    sourceLayer: 'cited-munger-prompts',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 10 — Destroy Your Own Idea',
    almanackCitation: 'Poor Charlie\'s Almanack — Munger\'s pre-commitment destruction-test',
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Destroy Your Own Idea — no kill-switch Constraint',
    explanation:
      'No Constraint names a testable condition that would INVALIDATE the plan. Munger ' +
      'tried to destroy every idea before committing — he looked for the ONE fatal flaw. ' +
      'A plan that hasn\'t survived a deliberate destruction attempt is untested.',
    suggestedFix: {
      type: 'add-destroy-test-constraint',
      asPlanguage:
        'C.KillSwitch: This plan must be abandoned if any of the following proves true: ' +
        '[1] [named falsifying condition], [2] [named falsifying condition], [3] [named ' +
        'falsifying condition]. Review cadence: [Evo Step exit]. Source: Munger ' +
        'Destroy-Your-Own-Idea Prompt.',
      targetItemId: 'plan-level',
      rationale:
        'A kill-switch Constraint forces upfront identification of falsifying conditions — ' +
        'the plan is testable AGAINST ITSELF, not just measurable.',
    },
    longTermConsequence:
      'Plans without kill switches escalate commitment past the point where the original ' +
      'thesis was even valid — Munger called this commitment bias × sunk cost × ego.',
    generatedAtIso: _now(),
  }]
}

/** Long Game — every V. entry should have a Wish OR Goal with a long-horizon When qualifier. */
function detectLongGame(ctx: DetectorContext): MungerFinding[] {
  const values = ctx.spec.values ?? []
  const longHorizonValues = values.filter(v => {
    const text = (v.goalWhen ?? '') + ' ' + (v.wishWhen ?? '') + ' ' + (v.stretchWhen ?? '')
    return /20\d\d|10[\s-]+year|20[\s-]+year|30[\s-]+year|decade|long.term/i.test(text)
  })
  if (longHorizonValues.length > 0 || values.length === 0) return []
  return [{
    id: _stableId('long-game', 'plan-level'),
    category: 'long-game',
    severity: 'moderate',
    sourceLayer: 'cited-munger-prompts',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 11 — Long Game',
    almanackCitation: 'Poor Charlie\'s Almanack — "Don\'t interrupt compounding unnecessarily"',
    gilbCitation: 'Compose with Incorruptible Agent — Quarterly-Tyranny pattern',
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Long Game — no long-horizon Wish/Goal qualifier',
    explanation:
      'No Value entry has a Wish/Goal qualified by a long-horizon (10/20/30 year) timeframe. ' +
      'Munger made most of his fortune AFTER age 65. Plans that optimize only short horizons ' +
      'silently destroy the long-arc value compounding would have produced.',
    suggestedFix: {
      type: 'add-long-game-wish',
      asPlanguage:
        'Add long-horizon Wish to each scalar Value: ' +
        'Wish [When = 2036]: [value] — what the spec would look like in 10 years at compound rate. ' +
        'Source: Munger Long-Game Prompt.',
      targetItemId: values[0].id,
      rationale:
        'A long-horizon Wish creates a North Star that disciplines short-term decisions ' +
        'against long-term compounding.',
    },
    longTermConsequence:
      'Plans without long-horizon targets get pulled into short-term optimization by ' +
      'whatever quarterly pressure exists at the time — Munger called this corrosion.',
    generatedAtIso: _now(),
  }]
}

/** Deathbed — Plans should have at least one Stakeholder framed as a long-arc legacy beneficiary. */
function detectDeathbed(ctx: DetectorContext): MungerFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const legacyFramed = stakeholders.filter(s => {
    const txt = (s.definition ?? '') + ' ' + (s.description ?? '')
    return /legacy|long.term|generation|posterity|future|grandchild|10[\s-]+year|20[\s-]+year/i.test(txt)
  })
  if (legacyFramed.length > 0) return []
  if (stakeholders.length === 0) return []
  return [{
    id: _stableId('deathbed', 'plan-level'),
    category: 'deathbed',
    severity: 'suggestion',
    sourceLayer: 'cited-munger-prompts',
    mungerCitation: 'CHARLIE MUNGERS RULES Prompt 12 — Deathbed Filter',
    almanackCitation: null,
    gilbCitation: null,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'Deathbed Filter — no long-arc legacy stakeholder',
    explanation:
      'No Stakeholder is framed as a long-arc legacy beneficiary. Munger\'s deathbed filter: ' +
      'imagine yourself at 90 looking back — would you regret doing this OR regret NOT doing ' +
      'it? Plans with only short-horizon stakeholders silently optimize against the long arc.',
    suggestedFix: {
      type: 'add-deathbed-rationale',
      asPlanguage:
        'Add a long-arc Stakeholder: Stakeholder [name a long-arc beneficiary — ' +
        'next-generation users, posterity, the planner\'s 90-year-old self]. ' +
        'Source: Munger Deathbed Prompt.',
      targetItemId: 'plan-level',
      rationale:
        'A named long-arc Stakeholder forces every decision to be tested against the ' +
        'regret-of-inaction framing — not just the regret-of-action one.',
    },
    longTermConsequence:
      'Plans that ignore the deathbed filter become small safe bets that compound into ' +
      'a small life — Munger\'s warning to every reader of Poor Charlie\'s Almanack.',
    generatedAtIso: _now(),
  }]
}

// ── Rationality Score ──────────────────────────────────────────────────────

function _rationalityScore(byCategory: Record<MungerCategory, MungerFinding[]>): number {
  const SEVERITY_WEIGHT: Record<MungerSeverity, number> = {
    critical: 3, moderate: 2, suggestion: 1,
  }
  let totalDeduction = 0
  for (const findings of Object.values(byCategory)) {
    for (const f of findings) totalDeduction += SEVERITY_WEIGHT[f.severity] * 3
  }
  const MAX_POSSIBLE = 12 * 3 * 3 // 12 categories × critical-tier × full weight = 108
  const score = Math.max(0, Math.min(100, 100 - Math.round((totalDeduction / MAX_POSSIBLE) * 100)))
  return score
}

function _headline(report: Omit<MungerReport, 'headline'>): string {
  const counts = report.bySeverity
  if (report.totalFindings === 0) {
    return `🧠 Munger Agent · ${report.planTitle} — analytical rigor solid (${report.rationalityScore}/100). No defects.`
  }
  const parts: string[] = []
  if (counts.critical > 0)   parts.push(`${counts.critical} CRITICAL`)
  if (counts.moderate > 0)   parts.push(`${counts.moderate} moderate`)
  if (counts.suggestion > 0) parts.push(`${counts.suggestion} suggestion`)
  return `🧠 Munger Agent · ${report.planTitle} — ${parts.join(' · ')} · Rationality ${report.rationalityScore}/100`
}

// ── Public API ─────────────────────────────────────────────────────────────

export function runMungerAnalysis(spec: SpecBlock | null, planTitle: string): MungerReport {
  const safeSpec: SpecBlock = spec ?? { functions: [], values: [], solutions: [], constraints: [], resources: [] }
  const ctx: DetectorContext = { spec: safeSpec, planTitle }
  const byCategory = _emptyByCategory()
  byCategory['inversion']            = detectInversion(ctx)
  byCategory['second-order']         = detectSecondOrder(ctx)
  byCategory['circle-of-competence'] = detectCircleOfCompetence(ctx)
  byCategory['bias-audit']           = detectBiasAudit(ctx)
  byCategory['lollapalooza']         = detectLollapalooza(ctx)
  byCategory['opportunity-cost']     = detectOpportunityCost(ctx)
  byCategory['fat-pitch']            = detectFatPitch(ctx)
  byCategory['incentive-map']        = detectIncentiveMap(ctx)
  byCategory['simplicity-filter']    = detectSimplicityFilter(ctx)
  byCategory['destroy-own-idea']     = detectDestroyOwnIdea(ctx)
  byCategory['long-game']            = detectLongGame(ctx)
  byCategory['deathbed']             = detectDeathbed(ctx)

  let total = 0
  const bySeverity: Record<MungerSeverity, number> = { critical: 0, moderate: 0, suggestion: 0 }
  for (const findings of Object.values(byCategory)) {
    for (const f of findings) {
      total++
      bySeverity[f.severity]++
    }
  }
  const rationalityScore = _rationalityScore(byCategory)
  const partial: Omit<MungerReport, 'headline'> = {
    generatedAtIso: _now(),
    planTitle,
    totalFindings: total,
    byCategory,
    bySeverity,
    rationalityScore,
  }
  return { ...partial, headline: _headline(partial) }
}

// ── Reactive composable ────────────────────────────────────────────────────

export function useMungerFindings(): {
  report: Ref<MungerReport | null>
  visibleFindings: ReturnType<typeof computed>
  dismissedIds: Ref<Set<string>>
  setReport: (r: MungerReport | null) => void
  dismissFinding: (id: string) => void
  undismissFinding: (id: string) => void
  applyMungerFix: (finding: MungerFinding, spec: SpecBlock) => ApplyFixResult | null
} {
  const visibleFindings = computed<MungerFinding[]>(() => {
    if (!_currentReport.value) return []
    const all: MungerFinding[] = []
    for (const arr of Object.values(_currentReport.value.byCategory)) {
      for (const f of arr) {
        if (!_dismissedIds.value.has(f.id)) all.push(f)
      }
    }
    // Sort by severity (critical first), then category order
    return all.sort((a, b) => {
      const sevOrder = { critical: 0, moderate: 1, suggestion: 2 }
      return sevOrder[a.severity] - sevOrder[b.severity]
    })
  })

  return {
    report: _currentReport,
    visibleFindings,
    dismissedIds: _dismissedIds,
    setReport(r) { _currentReport.value = r },
    dismissFinding(id) { _dismissedIds.value = new Set(_dismissedIds.value).add(id) },
    undismissFinding(id) {
      const next = new Set(_dismissedIds.value)
      next.delete(id)
      _dismissedIds.value = next
    },
    applyMungerFix(finding, spec) {
      return applyMungerFix(finding, spec)
    },
  }
}

// ── Apply-Fix routes ───────────────────────────────────────────────────────

export interface ApplyFixResult {
  newSpec: SpecBlock
  affectedItemId: string
  affectedItemType: 'value' | 'constraint' | 'stakeholder' | 'resource' | 'solution' | 'function' | 'plan-level'
  summary: string
}

function _cloneSpec(spec: SpecBlock): SpecBlock {
  return JSON.parse(JSON.stringify(spec)) as SpecBlock
}

function _uniqueMnemonic(base: string, existing: string[]): string {
  let candidate = base
  let n = 2
  while (existing.includes(candidate)) {
    candidate = `${base} ${n}`
    n++
  }
  return candidate
}

/** Apply a Munger fix to the given spec, returning a new spec. */
export function applyMungerFix(finding: MungerFinding, spec: SpecBlock): ApplyFixResult | null {
  const next = _cloneSpec(spec)
  const fix = finding.suggestedFix
  const src = _buildMungerSource(finding.category)

  // The majority of Munger fixes produce a new Constraint entry naming an analytical rule.
  if (fix.type === 'add-failure-mode-constraint'
   || fix.type === 'add-competence-edge-constraint'
   || fix.type === 'add-bias-audit-constraint'
   || fix.type === 'add-opportunity-cost-constraint'
   || fix.type === 'add-fat-pitch-filter'
   || fix.type === 'add-destroy-test-constraint'
   || fix.type === 'add-constraint') {
    const existingIds = (next.constraints ?? []).map(c => c.id)
    const idBase = ({
      'add-failure-mode-constraint':     'Failure Modes',
      'add-competence-edge-constraint':  'Scope Edge',
      'add-bias-audit-constraint':       'Bias Audit',
      'add-opportunity-cost-constraint': 'Opportunity Cost',
      'add-fat-pitch-filter':            'Fat Pitch Filter',
      'add-destroy-test-constraint':     'Kill Switch',
      'add-constraint':                  finding.principleViolated.split('—')[0].trim() || 'Munger Constraint',
    } as Record<typeof fix.type, string>)[fix.type]
    const newC: CEntry = {
      id:           _uniqueMnemonic(idBase, existingIds),
      type:         'Constraint',
      level:        'Business',
      description:  finding.principleViolated.split('—')[1]?.trim() || finding.principleViolated,
      scope:        'plan-level',
      rationale:    finding.explanation,
      source:       `Munger Agent · ${MUNGER_CATEGORY_META[finding.category].label} · ${src.timestamp.slice(0, 10)}`,
      sourceType:   'ai',
      fieldSources: { description: src, scope: src, rationale: src },
    } as CEntry
    next.constraints = [...(next.constraints ?? []), newC]
    return {
      newSpec: next,
      affectedItemId: newC.id,
      affectedItemType: 'constraint',
      summary: `${idBase} Constraint added — Munger ${MUNGER_CATEGORY_META[finding.category].label}`,
    }
  }

  if (fix.type === 'add-second-order-value'
   || fix.type === 'add-lollapalooza-value'
   || fix.type === 'add-long-game-wish') {
    // Add a new V. entry OR enrich the triggered one. For MVP, append a new V. entry.
    const existingIds = (next.values ?? []).map(v => v.id)
    const idBase = ({
      'add-second-order-value': 'Second-Order Effects',
      'add-lollapalooza-value': 'Compound Forces',
      'add-long-game-wish':     'Long-Horizon Goal',
    } as Record<typeof fix.type, string>)[fix.type]
    const newV: VEntry = {
      id:              _uniqueMnemonic(idBase, existingIds),
      type:            'Value',
      level:           'Business',
      description:     finding.principleViolated,
      scale:           '[Scale of the effect being measured]',
      meter:           '[How / how-often measured]',
      status:          '',
      tolerable:       '',
      goal:            '',
      valueOfFunction: '',
      source:          `Munger Agent · ${MUNGER_CATEGORY_META[finding.category].label} · ${src.timestamp.slice(0, 10)}`,
      sourceType:      'ai',
      fieldSources:    { description: src, scale: src, meter: src },
    } as VEntry
    next.values = [...(next.values ?? []), newV]
    return {
      newSpec: next,
      affectedItemId: newV.id,
      affectedItemType: 'value',
      summary: `${idBase} Value added — Munger ${MUNGER_CATEGORY_META[finding.category].label}`,
    }
  }

  if (fix.type === 'add-incentive-source' || fix.type === 'add-deathbed-rationale') {
    // Annotate the triggered stakeholder OR add a new one.
    const existing = (next.stakeholderEntries ?? []).map(s => s.id)
    const idBase = fix.type === 'add-incentive-source' ? 'Incentive Map' : 'Long-Arc Beneficiary'
    const newS = {
      id:              _uniqueMnemonic(idBase, existing),
      type:            'Stakeholder',
      stakeholderType: 'Indirect' as const,
      definition:      finding.principleViolated,
      description:     finding.explanation.slice(0, 240),
      source:          `Munger Agent · ${MUNGER_CATEGORY_META[finding.category].label} · ${src.timestamp.slice(0, 10)}`,
      sourceType:      'ai' as const,
      fieldSources:    { definition: src, description: src },
    }
    next.stakeholderEntries = [...(next.stakeholderEntries ?? []), newS]
    return {
      newSpec: next,
      affectedItemId: newS.id,
      affectedItemType: 'stakeholder',
      summary: `${idBase} Stakeholder added — Munger ${MUNGER_CATEGORY_META[finding.category].label}`,
    }
  }

  if (fix.type === 'simplify-description') {
    // Annotate the triggered entry's description with a TODO marker.
    const v = (next.values ?? []).find(x => x.id === finding.triggeredBy)
    if (v) {
      v.description = `[TODO Munger Simplicity ≤ 3 sentences] ${v.description}`
      v.fieldSources = { ...(v.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: v.id, affectedItemType: 'value',
        summary: `Simplicity TODO added to ${v.id}`,
      }
    }
    const f = (next.functions ?? []).find(x => x.id === finding.triggeredBy)
    if (f) {
      f.description = `[TODO Munger Simplicity ≤ 3 sentences] ${f.description}`
      f.fieldSources = { ...(f.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: f.id, affectedItemType: 'function',
        summary: `Simplicity TODO added to ${f.id}`,
      }
    }
    const s = (next.solutions ?? []).find(x => x.id === finding.triggeredBy)
    if (s) {
      s.description = `[TODO Munger Simplicity ≤ 3 sentences] ${s.description}`
      s.fieldSources = { ...(s.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: s.id, affectedItemType: 'solution',
        summary: `Simplicity TODO added to ${s.id}`,
      }
    }
  }

  return null
}
