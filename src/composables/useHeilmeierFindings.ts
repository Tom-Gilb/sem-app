// UNIT_TYPE=Composable
// useHeilmeierFindings.ts — Heilmeier Agent finding engine (DARPA's 9-Question
// Catechism: original 8 + IEEE 2025 "Who is left out?" extension).
//
// Tom Gilb 2026-06-22 verbatim:
//   "Hellmeier Agent: Make a new agent based on the new Asset Folder Hellmeier"
//
// Source materials (in /5 - Project/SEM App/assets/Heilmeier Catechism/):
//   - GILB PLANGUAGE AND HELLMEIER COMPARISON.pdf — Tom's Heilmeier→Planguage map
//   - extending hellmeier.pdf — IEEE 2025 paper (Butler/Kohno et al.)
//   - 2013-08-08-heilmeier.pdf — Cornell handout
//   - 10_DARPA-Enabling_Technical_Innovation.pdf — DARPA history
//
// Architecture mirrors useMungerFindings.ts:
//   - Deterministic rule engine scans a SpecBlock and emits HeilmeierFinding[]
//   - 9 detectors — one per Catechism question
//   - Source-layer 'derived-from-plan' on every detector; citations stamped
//   - Stable IDs across re-runs (id = `heilmeier-${category}-${triggerId}`)
//
// Composes with:
//   - Conjunction-of-Technologies (Plan + Heilmeier + IEEE 2025 + Gilb + LLM)
//   - AI-Max (suggestions surface immediately)
//   - Claude-Code-as-AI-Layer (no embedded API)
//   - Architectural Resilience (deterministic IDs)
//   - Universal Undo (Accept-Fix routes through useUndoHistory)
//   - Source-stamp sweep (every fix-applied entry carries provenance)

import { computed, ref, type Ref } from 'vue'
import type { SpecBlock, VEntry, SEntry, CEntry, REntry, FieldSource } from '../types/spec'
import type {
  HeilmeierFinding,
  HeilmeierReport,
  HeilmeierCategory,
  HeilmeierSeverity,
  HeilmeierFix,
} from '../types/heilmeier'
import { HEILMEIER_CATEGORY_META, HEILMEIER_BANNED_JARGON } from '../types/heilmeier'

// ── Module-level state ──────────────────────────────────────────────────────
const _currentReport = ref<HeilmeierReport | null>(null)
const _dismissedIds  = ref<Set<string>>(new Set())

// ── Citations (shared constants) ────────────────────────────────────────────
const DARPA_BASE = 'https://en.wikipedia.org/wiki/George_H._Heilmeier#Heilmeier\'s_Catechism'

const IEEE_2025_CITATION =
  'IEEE Security & Privacy May/June 2025 — Butler, Hugenberg, Jain, Kapadia, ' +
  'Kohno, Redmiles, Roesner, Sim, Traynor, Barakat — "Extending the Heilmeier ' +
  'Catechism: Who Is Left Out?"'

// ── Helpers ─────────────────────────────────────────────────────────────────

function _emptyByCategory(): Record<HeilmeierCategory, HeilmeierFinding[]> {
  return {
    'what-trying-to-do': [],
    'how-done-today':    [],
    'what-is-new':       [],
    'who-cares':         [],
    'risks':             [],
    'cost':              [],
    'how-long':          [],
    'midterm-exams':     [],
    'who-is-left-out':   [],
  }
}

function _now(): string {
  return new Date().toISOString()
}

function _stableId(category: HeilmeierCategory, triggerId: string): string {
  return `heilmeier-${category}-${triggerId.replace(/[^A-Za-z0-9-]/g, '_')}`
}

function _buildHeilmeierSource(category: HeilmeierCategory): FieldSource {
  return {
    source:     'Heilmeier Agent',
    sourceType: 'ai',
    tool:       `Heilmeier · ${HEILMEIER_CATEGORY_META[category].label}`,
    timestamp:  _now(),
  }
}

function _findJargon(text: string): string[] {
  const lower = (text ?? '').toLowerCase()
  const hits: string[] = []
  for (const word of HEILMEIER_BANNED_JARGON) {
    // word boundary for multi-word and single-word terms
    const re = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
    if (re.test(lower)) hits.push(word)
  }
  return hits
}

// ── Detectors ───────────────────────────────────────────────────────────────

interface DetectorContext {
  spec: SpecBlock
  planTitle: string
}

/** Q1 — What are you trying to do? (jargon-free, quantified objective).
 *  Critical if no V. entry has a Goal. Suggestion per V./F./S. with jargon hits. */
function detectWhatTryingToDo(ctx: DetectorContext): HeilmeierFinding[] {
  const findings: HeilmeierFinding[] = []
  const values = ctx.spec.values ?? []
  const withGoal = values.filter(v => !!v.goal && v.goal.trim().length > 0)
  if (values.length === 0 || withGoal.length === 0) {
    findings.push({
      id: _stableId('what-trying-to-do', 'plan-level'),
      category: 'what-trying-to-do',
      severity: 'critical',
      sourceLayer: 'derived-from-plan',
      heilmeierCitation: 'Heilmeier Catechism Q1 — DARPA 1965 / Cornell handout',
      extendedCitation: null,
      gilbCitation: 'Gilb — Planguage Glossary: Goal (*047), Scale (*586)',
      verifyUrl: DARPA_BASE,
      triggeredBy: 'plan-level',
      principleViolated: 'Heilmeier Q1 — no quantified objective named',
      explanation:
        'The plan has no Value entry with a Goal. Heilmeier Q1 demands a concrete, ' +
        'measurable objective stated in plain English. Without a Goal, the plan has ' +
        'nothing to be evaluated against.',
      suggestedFix: {
        type: 'add-objective-value',
        asPlanguage:
          'V.PrimaryObjective: [the one quantified thing this plan must deliver] · ' +
          'Scale: [unit of measurement] · Goal: [target value] · ' +
          'Source: Heilmeier Q1 — generated 2026-06-22 by Heilmeier Agent.',
        targetItemId: 'plan-level',
        rationale:
          'A single quantified objective converts "we want to improve X" into ' +
          '"X will reach value Y on Scale Z" — auditable, comparable, fundable.',
      },
      longTermConsequence:
        'Plans without quantified objectives drift — every reviewer redefines success ' +
        'differently and the plan ships without anyone agreeing it has succeeded.',
      generatedAtIso: _now(),
    })
  }
  // Jargon scan — collect up to 3 jargon-laden descriptions
  const allItems: Array<{ id: string; description?: string }> = [
    ...values,
    ...(ctx.spec.functions ?? []),
    ...(ctx.spec.solutions ?? []),
  ]
  let jargonCount = 0
  for (const item of allItems) {
    if (jargonCount >= 3) break
    const hits = _findJargon(item.description ?? '')
    if (hits.length < 2) continue
    jargonCount++
    findings.push({
      id: _stableId('what-trying-to-do', `jargon-${item.id}`),
      category: 'what-trying-to-do',
      severity: 'suggestion',
      sourceLayer: 'cited-heilmeier-darpa',
      heilmeierCitation: 'Heilmeier Catechism Q1 — "absolutely no jargon"',
      extendedCitation: null,
      gilbCitation: 'Gilb — Planguage Parameter Discipline (plain English)',
      verifyUrl: DARPA_BASE,
      triggeredBy: item.id,
      principleViolated: 'Heilmeier Q1 — jargon in description',
      explanation:
        `${item.id} description contains jargon: ${hits.slice(0, 3).join(', ')}. ` +
        'Heilmeier was famous for cutting program managers off the moment they used ' +
        'a buzzword. Plain English forces clarity; jargon hides confusion.',
      suggestedFix: {
        type: 'simplify-jargon-description',
        asPlanguage:
          `${item.id} — rewrite description in plain English. Replace ` +
          `[${hits.slice(0, 3).join(', ')}] with the concrete thing those words hide.`,
        targetItemId: item.id,
        rationale:
          'Buzzwords are placeholders for thinking that has not yet happened. ' +
          'Replacing them forces the planner to state the actual mechanism.',
      },
      longTermConsequence:
        'Jargon-laden descriptions get reinterpreted by every reader differently — ' +
        'by month 6 the plan and the planner mean different things by the same word.',
      generatedAtIso: _now(),
    })
  }
  return findings
}

/** Q2 — How is it done today? (baseline + current-practice limits).
 *  Moderate if no V. entry has a status (Past/baseline) value. */
function detectHowDoneToday(ctx: DetectorContext): HeilmeierFinding[] {
  const values = ctx.spec.values ?? []
  if (values.length === 0) return []
  const withBaseline = values.filter(v => !!v.status && v.status.trim().length > 0)
  if (withBaseline.length > 0) return []
  return [{
    id: _stableId('how-done-today', 'plan-level'),
    category: 'how-done-today',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    heilmeierCitation: 'Heilmeier Catechism Q2 — Cornell handout',
    extendedCitation: null,
    gilbCitation: 'Gilb — Planguage Glossary: Past, Status, Scale Qualifiers',
    verifyUrl: DARPA_BASE,
    triggeredBy: values[0].id,
    principleViolated: 'Heilmeier Q2 — no current-practice baseline named',
    explanation:
      'No Value entry has a Status (baseline) value naming the CURRENT level on its ' +
      'Scale. Heilmeier Q2 demands a stated baseline plus the limits of current ' +
      'practice — without it improvement cannot be quantified.',
    suggestedFix: {
      type: 'add-baseline-status',
      asPlanguage:
        `${values[0].id}.Status [today, current-system]: [measured value today] · ` +
        'Source: Heilmeier Q2 — baseline of current practice.',
      targetItemId: values[0].id,
      rationale:
        'A named Status value gives reviewers a clear "before" against which "after" ' +
        'can be measured. Without it, every improvement claim is unverifiable.',
    },
    longTermConsequence:
      'Plans without a baseline cannot prove improvement. The "we made things better" ' +
      'claim degrades into hand-waving by post-mortem time.',
    generatedAtIso: _now(),
  }]
}

/** Q3 — What is new in your approach? */
function detectWhatIsNew(ctx: DetectorContext): HeilmeierFinding[] {
  const solutions = ctx.spec.solutions ?? []
  if (solutions.length === 0) {
    return [{
      id: _stableId('what-is-new', 'plan-level'),
      category: 'what-is-new',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      heilmeierCitation: 'Heilmeier Catechism Q3 — Cornell handout',
      extendedCitation: null,
      gilbCitation: 'Gilb — Solution Parameters SUPREME (26-parameter inventory)',
      verifyUrl: DARPA_BASE,
      triggeredBy: 'plan-level',
      principleViolated: 'Heilmeier Q3 — no Solution entries name novelty',
      explanation:
        'The plan has no Solution (S.) entries. Heilmeier Q3 demands an explicit ' +
        'statement of what is NEW in the approach and why it will succeed — without ' +
        'that, the plan is duplicating existing work.',
      suggestedFix: {
        type: 'add-novelty-solution',
        asPlanguage:
          'S.NovelApproach: [the genuinely new mechanism this plan brings] · ' +
          'Description: [why this differs from existing practice + why it will succeed] · ' +
          'Source: Heilmeier Q3.',
        targetItemId: 'plan-level',
        rationale:
          'Naming the novel mechanism forces the planner to justify why this plan ' +
          'deserves resources over the do-nothing alternative.',
      },
      longTermConsequence:
        'Plans that don\'t name their novelty get evaluated as "yet another X" and lose ' +
        'budget to alternatives that articulate their edge.',
      generatedAtIso: _now(),
    }]
  }
  // Solutions exist but none has a substantive description — suggestion
  const withDescription = solutions.filter(s =>
    !!s.description && s.description.trim().length > 30)
  if (withDescription.length === 0) {
    return [{
      id: _stableId('what-is-new', 'thin-solutions'),
      category: 'what-is-new',
      severity: 'suggestion',
      sourceLayer: 'derived-from-plan',
      heilmeierCitation: 'Heilmeier Catechism Q3 — Cornell handout',
      extendedCitation: null,
      gilbCitation: 'Gilb — Solution Parameters SUPREME',
      verifyUrl: DARPA_BASE,
      triggeredBy: solutions[0].id,
      principleViolated: 'Heilmeier Q3 — Solution entries lack novelty description',
      explanation:
        'Solution entries exist but none has a substantive description naming WHY ' +
        'the approach is new and WHY it will succeed.',
      suggestedFix: {
        type: 'add-novelty-solution',
        asPlanguage:
          `${solutions[0].id}.Description: [why this is new + evidence it will succeed]. ` +
          'Source: Heilmeier Q3.',
        targetItemId: solutions[0].id,
        rationale: 'A thin Solution description lets reviewers fill the gap with skepticism.',
      },
      longTermConsequence:
        'Thin Solutions get cut from budgets — every reviewer assumes the worst when ' +
        'the planner has not articulated the best.',
      generatedAtIso: _now(),
    }]
  }
  return []
}

/** Q4 — Who cares? If successful, what difference will it make? */
function detectWhoCares(ctx: DetectorContext): HeilmeierFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  if (stakeholders.length === 0) {
    return [{
      id: _stableId('who-cares', 'plan-level'),
      category: 'who-cares',
      severity: 'critical',
      sourceLayer: 'derived-from-plan',
      heilmeierCitation: 'Heilmeier Catechism Q4 — Cornell handout',
      extendedCitation: null,
      gilbCitation: 'Gilb — Stakeholder Engineering Ch.3 (Stakeholder taxonomy)',
      verifyUrl: DARPA_BASE,
      triggeredBy: 'plan-level',
      principleViolated: 'Heilmeier Q4 — no stakeholders named',
      explanation:
        'The plan has zero Stakeholder entries. Heilmeier Q4 demands explicit ' +
        'beneficiaries — without named stakeholders, the plan has no constituency.',
      suggestedFix: {
        type: 'add-stakeholder-impact-value',
        asPlanguage:
          'Stakeholder.PrimaryBeneficiary: [who benefits if this plan succeeds] · ' +
          'Type: Direct · Description: [what specific difference it makes for them]. ' +
          'Source: Heilmeier Q4.',
        targetItemId: 'plan-level',
        rationale:
          'A named stakeholder converts "this is important" into "this is important ' +
          'TO X for reason Y" — auditable, defensible at review.',
      },
      longTermConsequence:
        'Stakeholder-less plans fail political review — no constituency advocates for ' +
        'them when budgets get cut.',
      generatedAtIso: _now(),
    }]
  }
  // Stakeholders exist — but no Value entry has a quantified Goal for them?
  const values = ctx.spec.values ?? []
  const quantifiedValues = values.filter(v =>
    !!v.goal && v.goal.trim().length > 0)
  if (quantifiedValues.length === 0) {
    return [{
      id: _stableId('who-cares', 'no-quantified-impact'),
      category: 'who-cares',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      heilmeierCitation: 'Heilmeier Catechism Q4 — Cornell handout',
      extendedCitation: null,
      gilbCitation: 'Gilb — Planguage Goal (*047) + Scale (*586)',
      verifyUrl: DARPA_BASE,
      triggeredBy: 'plan-level',
      principleViolated: 'Heilmeier Q4 — stakeholders named but impacts unquantified',
      explanation:
        `${stakeholders.length} stakeholders are named but no Value entry has a ` +
        'quantified Goal. Heilmeier Q4 asks what DIFFERENCE the plan makes — that ' +
        'difference must be measurable.',
      suggestedFix: {
        type: 'add-stakeholder-impact-value',
        asPlanguage:
          'V.StakeholderImpact: [the quantified benefit for the named stakeholder] · ' +
          'Scale: [unit] · Goal: [target value] · ' +
          'Source: Heilmeier Q4.',
        targetItemId: 'plan-level',
        rationale:
          'A quantified Goal converts "stakeholder cares" into "stakeholder will see ' +
          'value Y on Scale Z" — provable success criteria.',
      },
      longTermConsequence:
        'Unquantified stakeholder impact becomes a debate about feelings at post-mortem.',
      generatedAtIso: _now(),
    }]
  }
  return []
}

/** Q5 — What are the risks? */
function detectRisks(ctx: DetectorContext): HeilmeierFinding[] {
  const values = ctx.spec.values ?? []
  const withRisks = values.filter(v => !!v.risks && v.risks.trim().length > 0)
  const constraints = ctx.spec.constraints ?? []
  const negativeC = constraints.filter(c =>
    /risk|must not|never|avoid|prevent|mitigate/i.test(
      (c.description ?? '') + ' ' + (c.rationale ?? '')))
  if (withRisks.length > 0 || negativeC.length > 0) return []
  return [{
    id: _stableId('risks', 'plan-level'),
    category: 'risks',
    severity: 'critical',
    sourceLayer: 'cited-heilmeier-darpa',
    heilmeierCitation: 'Heilmeier Catechism Q5 — Cornell handout',
    extendedCitation: null,
    gilbCitation: 'Gilb — Risk Analysis (Solution Parameter: Risks, Side Effects)',
    verifyUrl: DARPA_BASE,
    triggeredBy: 'plan-level',
    principleViolated: 'Heilmeier Q5 — no risks named',
    explanation:
      'The plan names no risks (no V.risks fields, no risk-mitigation Constraints). ' +
      'Heilmeier Q5 demands explicit risks — a proposal with no risks is either ' +
      'dishonest or naive, both disqualifying at DARPA review.',
    suggestedFix: {
      type: 'add-risk-management-constraint',
      asPlanguage:
        'C.RiskRegister: Plan must track and mitigate the following risks: ' +
        '[1] [named risk + mitigation], [2] [named risk + mitigation]. ' +
        'Review cadence: [every Evo Step]. Source: Heilmeier Q5.',
      targetItemId: 'plan-level',
      rationale:
        'A named-risks Constraint forces upfront identification + mitigation plans, ' +
        'and creates a review cadence so the plan stays honest about risks.',
    },
    longTermConsequence:
      'Unnamed risks materialise mid-execution as surprises. Each surprise costs more ' +
      'than the upfront analysis would have.',
    generatedAtIso: _now(),
  }]
}

/** Q6 — How much will it cost? */
function detectCost(ctx: DetectorContext): HeilmeierFinding[] {
  const resources = ctx.spec.resources ?? []
  const monetaryR = resources.filter(r => {
    const text = (r.description ?? '') + ' ' + (r.scale ?? '') + ' ' +
                 (r.budget ?? '') + ' ' + (r.tolerable ?? '')
    return /\$|€|£|cost|budget|money|dollar|euro|pound|usd|eur|gbp/i.test(text)
  })
  const hasBudget = resources.some(r =>
    (!!r.budget && r.budget.trim().length > 0) ||
    (!!r.tolerable && r.tolerable.trim().length > 0))
  if (monetaryR.length > 0 && hasBudget) return []
  return [{
    id: _stableId('cost', 'plan-level'),
    category: 'cost',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    heilmeierCitation: 'Heilmeier Catechism Q6 — Cornell handout',
    extendedCitation: null,
    gilbCitation: 'Gilb — Resource entries (R.) with Budget parameter (2026-06-07)',
    verifyUrl: DARPA_BASE,
    triggeredBy: 'plan-level',
    principleViolated: 'Heilmeier Q6 — no cost / budget Resource entry',
    explanation:
      'The plan has no Resource entry with a monetary budget or cost ceiling. ' +
      'Heilmeier Q6 demands a named cost envelope — without it the plan cannot be ' +
      'evaluated against alternatives or fit into a portfolio.',
    suggestedFix: {
      type: 'add-cost-resource',
      asPlanguage:
        'R.Cost: total cost of plan in [currency] · ' +
        'Scale: [$, €, £] per [phase / lifetime] · ' +
        'Budget [project-lifetime]: [allocated amount] · ' +
        'Tolerable [project-lifetime]: [maximum tolerable spend] · ' +
        'Source: Heilmeier Q6.',
      targetItemId: 'plan-level',
      rationale:
        'A monetary Resource with Budget + Tolerable creates a defended envelope ' +
        'that reviewers can compare against alternatives.',
    },
    longTermConsequence:
      'Plans without cost ceilings overrun silently — by the time the overrun is ' +
      'visible the alternative-uses-of-money window has closed.',
    generatedAtIso: _now(),
  }]
}

/** Q7 — How long will it take? */
function detectHowLong(ctx: DetectorContext): HeilmeierFinding[] {
  const resources = ctx.spec.resources ?? []
  const timeR = resources.filter(r => {
    const text = (r.description ?? '') + ' ' + (r.scale ?? '')
    return /time|day|week|month|year|quarter|deadline|sprint|hour|calendar/i.test(text)
  })
  if (timeR.length > 0) return []
  // Also accept Values with goalWhen / wishWhen / stretchWhen qualifiers
  const values = ctx.spec.values ?? []
  const whenQualified = values.some(v => {
    const text = (v.goalWhen ?? '') + ' ' + (v.wishWhen ?? '') + ' ' + (v.stretchWhen ?? '')
    return text.trim().length > 0
  })
  if (whenQualified) return []
  return [{
    id: _stableId('how-long', 'plan-level'),
    category: 'how-long',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    heilmeierCitation: 'Heilmeier Catechism Q7 — Cornell handout',
    extendedCitation: null,
    gilbCitation: 'Gilb — Planguage Qualifier *124 (Time class)',
    verifyUrl: DARPA_BASE,
    triggeredBy: 'plan-level',
    principleViolated: 'Heilmeier Q7 — no time horizon named',
    explanation:
      'The plan has no time-bound Resource entry and no Value entry with a When ' +
      'qualifier. Heilmeier Q7 demands a named timeline — without it the plan is ' +
      'unschedulable and unmonitorable.',
    suggestedFix: {
      type: 'add-time-resource',
      asPlanguage:
        'R.Timeline: time horizon for the plan · ' +
        'Scale: weeks from plan-start · ' +
        'Tolerable [final-delivery]: [max weeks] · ' +
        'Source: Heilmeier Q7.',
      targetItemId: 'plan-level',
      rationale:
        'A time-Resource with milestones lets reviewers monitor progress against a ' +
        'committed schedule instead of accepting "soon" as an answer.',
    },
    longTermConsequence:
      'Plans without time horizons drift indefinitely. Without a committed deadline, ' +
      'every milestone slips by definition.',
    generatedAtIso: _now(),
  }]
}

/** Q8 — Midterm and final exams (measurable checkpoints). */
function detectMidtermExams(ctx: DetectorContext): HeilmeierFinding[] {
  const values = ctx.spec.values ?? []
  // Heuristic: at least one V. has a Tolerable AND a Goal (intermediate + final exam)
  const hasIntermediateAndFinal = values.some(v =>
    !!v.tolerable && v.tolerable.trim().length > 0 &&
    !!v.goal && v.goal.trim().length > 0)
  // Or at least one S. entry has effortPercent set (implies Evo step structure)
  const solutions = ctx.spec.solutions ?? []
  const hasEvoStructure = solutions.some(s =>
    typeof s.effortPercent === 'number' && s.effortPercent > 0)
  if (hasIntermediateAndFinal || hasEvoStructure) return []
  return [{
    id: _stableId('midterm-exams', 'plan-level'),
    category: 'midterm-exams',
    severity: 'critical',
    sourceLayer: 'cited-heilmeier-darpa',
    heilmeierCitation: 'Heilmeier Catechism Q8 — Cornell handout',
    extendedCitation: null,
    gilbCitation: 'Gilb — Evo delivery steps; Tolerable + Goal as exam levels',
    verifyUrl: DARPA_BASE,
    triggeredBy: 'plan-level',
    principleViolated: 'Heilmeier Q8 — no measurable midterm / final exams',
    explanation:
      'No Value entry has BOTH a Tolerable AND a Goal (intermediate + final exam), ' +
      'and no Solution has Evo step structure. Heilmeier Q8 demands measurable ' +
      'checkpoints to verify progress — without them the program runs to completion ' +
      'with no kill-switch.',
    suggestedFix: {
      type: 'add-midterm-exam-constraint',
      asPlanguage:
        'C.MidtermExam: Plan must produce measurable midterm results at [date or ' +
        'Evo step boundary]. Exam criterion: [named Value reaches Tolerable level]. ' +
        'Final exam: [same Value reaches Goal level]. Failure → plan re-evaluation. ' +
        'Source: Heilmeier Q8.',
      targetItemId: 'plan-level',
      rationale:
        'Named exams convert "trust us, we\'re working on it" into testable progress ' +
        'reports at fixed dates — DARPA\'s explicit safeguard against runaway programs.',
    },
    longTermConsequence:
      'Without midterm exams, programs commit for their full duration regardless of ' +
      'whether the work is on track. The kill-switch arrives only at final delivery.',
    generatedAtIso: _now(),
  }]
}

/** Q9 — Who is left out? (IEEE 2025 extension — Butler/Kohno et al.) */
function detectWhoIsLeftOut(ctx: DetectorContext): HeilmeierFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: HeilmeierFinding[] = []

  // Critical if stakeholder count ≤ 2 (likely incomplete)
  if (stakeholders.length > 0 && stakeholders.length <= 2) {
    findings.push({
      id: _stableId('who-is-left-out', 'too-few-stakeholders'),
      category: 'who-is-left-out',
      severity: 'critical',
      sourceLayer: 'cited-heilmeier-extended',
      heilmeierCitation: 'Heilmeier Catechism — IEEE 2025 extension Q9',
      extendedCitation: IEEE_2025_CITATION,
      gilbCitation: 'Gilb — Stakeholder Engineering Ch.3 (Stakeholder taxonomy: ' +
                    'Direct / Indirect / Regulatory / System / Inanimate)',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'Heilmeier Q9 — stakeholder map is suspiciously thin',
      explanation:
        `Only ${stakeholders.length} stakeholder${stakeholders.length === 1 ? '' : 's'} ` +
        'named. The IEEE 2025 extension to the Catechism asks "who is left out?" — ' +
        'a thin stakeholder map almost always hides indirect users, affected communities, ' +
        'and marginalized groups whose interests are not voiced by the direct stakeholders.',
      suggestedFix: {
        type: 'add-left-out-stakeholder',
        asPlanguage:
          'Stakeholder.IndirectGroup1: [a group affected by the plan but not voiced ' +
          'by direct stakeholders] · Type: Indirect · ' +
          'Description: [how the plan affects them + how their interests will be ' +
          'represented in the design]. Source: IEEE 2025 Heilmeier Q9 extension.',
        targetItemId: 'plan-level',
        rationale:
          'Named indirect stakeholders force the planner to consider non-customer ' +
          'impacts. Plans that miss this question ship harm to invisible groups.',
      },
      longTermConsequence:
        'Plans that leave groups out create silent harm. By the time the affected ' +
        'group surfaces, the design is committed and the cost of correction is large.',
      generatedAtIso: _now(),
    })
  }

  // Suggestion if no Indirect-type stakeholders
  if (stakeholders.length >= 3) {
    const indirect = stakeholders.filter(s =>
      s.stakeholderType === 'Indirect' || s.stakeholderType === 'Regulatory')
    if (indirect.length === 0) {
      findings.push({
        id: _stableId('who-is-left-out', 'no-indirect-types'),
        category: 'who-is-left-out',
        severity: 'suggestion',
        sourceLayer: 'cited-heilmeier-extended',
        heilmeierCitation: 'Heilmeier Catechism — IEEE 2025 extension Q9',
        extendedCitation: IEEE_2025_CITATION,
        gilbCitation: 'Gilb — Stakeholder taxonomy (Indirect, Regulatory types)',
        verifyUrl: null,
        triggeredBy: stakeholders[0].id,
        principleViolated: 'Heilmeier Q9 — all stakeholders are Direct type',
        explanation:
          `All ${stakeholders.length} stakeholders are Direct type. The IEEE 2025 ` +
          '"Who is left out?" extension warns that indirect stakeholders (affected ' +
          'communities, regulators, environment) carry interests not voiced by direct ' +
          'users. A Direct-only stakeholder map silently optimises against those interests.',
        suggestedFix: {
          type: 'add-left-out-stakeholder',
          asPlanguage:
            'Stakeholder.IndirectGroup: [named indirect group — affected community, ' +
            'regulator, environment, future users] · Type: Indirect · ' +
            'Description: [their interests + how the design must consider them]. ' +
            'Source: IEEE 2025 Heilmeier Q9 extension.',
          targetItemId: stakeholders[0].id,
          rationale:
            'Naming at least one Indirect stakeholder ensures the design surfaces ' +
            'non-customer impacts during planning, not after launch.',
        },
        longTermConsequence:
          'Direct-only stakeholder maps silently optimise against indirect interests ' +
          '(regulators, communities, future users) — those interests reassert themselves ' +
          'later via lawsuits, regulations, or market backlash.',
        generatedAtIso: _now(),
      })
    }
  }

  return findings
}

// ── Clarity Score ──────────────────────────────────────────────────────────

function _clarityScore(byCategory: Record<HeilmeierCategory, HeilmeierFinding[]>): number {
  const SEVERITY_WEIGHT: Record<HeilmeierSeverity, number> = {
    critical: 3, moderate: 2, suggestion: 1,
  }
  let totalDeduction = 0
  for (const findings of Object.values(byCategory)) {
    for (const f of findings) totalDeduction += SEVERITY_WEIGHT[f.severity] * 3
  }
  const MAX_POSSIBLE = 9 * 3 * 3 // 9 categories × critical-tier × full weight = 81
  const score = Math.max(0, Math.min(100, 100 - Math.round((totalDeduction / MAX_POSSIBLE) * 100)))
  return score
}

function _headline(report: Omit<HeilmeierReport, 'headline'>): string {
  const counts = report.bySeverity
  if (report.totalFindings === 0) {
    return `🎯 Heilmeier Agent · ${report.planTitle} — Catechism passed (${report.clarityScore}/100). No defects.`
  }
  const parts: string[] = []
  if (counts.critical > 0)   parts.push(`${counts.critical} CRITICAL`)
  if (counts.moderate > 0)   parts.push(`${counts.moderate} moderate`)
  if (counts.suggestion > 0) parts.push(`${counts.suggestion} suggestion`)
  return `🎯 Heilmeier Agent · ${report.planTitle} — ${parts.join(' · ')} · Clarity ${report.clarityScore}/100`
}

// ── Public API ─────────────────────────────────────────────────────────────

export function runHeilmeierAnalysis(spec: SpecBlock | null, planTitle: string): HeilmeierReport {
  const safeSpec: SpecBlock = spec ?? { functions: [], values: [], solutions: [], constraints: [], resources: [] }
  const ctx: DetectorContext = { spec: safeSpec, planTitle }
  const byCategory = _emptyByCategory()
  byCategory['what-trying-to-do'] = detectWhatTryingToDo(ctx)
  byCategory['how-done-today']    = detectHowDoneToday(ctx)
  byCategory['what-is-new']       = detectWhatIsNew(ctx)
  byCategory['who-cares']         = detectWhoCares(ctx)
  byCategory['risks']             = detectRisks(ctx)
  byCategory['cost']              = detectCost(ctx)
  byCategory['how-long']          = detectHowLong(ctx)
  byCategory['midterm-exams']     = detectMidtermExams(ctx)
  byCategory['who-is-left-out']   = detectWhoIsLeftOut(ctx)

  let total = 0
  const bySeverity: Record<HeilmeierSeverity, number> = { critical: 0, moderate: 0, suggestion: 0 }
  for (const findings of Object.values(byCategory)) {
    for (const f of findings) {
      total++
      bySeverity[f.severity]++
    }
  }
  const clarityScore = _clarityScore(byCategory)
  const partial: Omit<HeilmeierReport, 'headline'> = {
    generatedAtIso: _now(),
    planTitle,
    totalFindings: total,
    byCategory,
    bySeverity,
    clarityScore,
  }
  return { ...partial, headline: _headline(partial) }
}

// ── Reactive composable ────────────────────────────────────────────────────

export function useHeilmeierFindings(): {
  report: Ref<HeilmeierReport | null>
  visibleFindings: ReturnType<typeof computed>
  dismissedIds: Ref<Set<string>>
  setReport: (r: HeilmeierReport | null) => void
  dismissFinding: (id: string) => void
  undismissFinding: (id: string) => void
  applyHeilmeierFix: (finding: HeilmeierFinding, spec: SpecBlock) => ApplyFixResult | null
} {
  const visibleFindings = computed<HeilmeierFinding[]>(() => {
    if (!_currentReport.value) return []
    const all: HeilmeierFinding[] = []
    for (const arr of Object.values(_currentReport.value.byCategory)) {
      for (const f of arr) {
        if (!_dismissedIds.value.has(f.id)) all.push(f)
      }
    }
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
    applyHeilmeierFix(finding, spec) {
      return applyHeilmeierFix(finding, spec)
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

/** Apply a Heilmeier fix to the given spec, returning a new spec. */
export function applyHeilmeierFix(finding: HeilmeierFinding, spec: SpecBlock): ApplyFixResult | null {
  const next = _cloneSpec(spec)
  const fix = finding.suggestedFix
  const src = _buildHeilmeierSource(finding.category)
  const stamp = `Heilmeier Agent · ${HEILMEIER_CATEGORY_META[finding.category].label} · ${src.timestamp.slice(0, 10)}`

  // Value-entry adds (Q1 objective, Q4 stakeholder impact, baseline already separate)
  if (fix.type === 'add-objective-value'
   || fix.type === 'add-stakeholder-impact-value') {
    const existingIds = (next.values ?? []).map(v => v.id)
    const idBase = fix.type === 'add-objective-value'
      ? 'Primary Objective'
      : 'Stakeholder Impact'
    const newV: VEntry = {
      id:              _uniqueMnemonic(idBase, existingIds),
      type:            'Value',
      level:           'Business',
      description:     finding.principleViolated,
      scale:           '[unit of measurement]',
      meter:           '[how / how-often measured]',
      status:          '',
      tolerable:       '',
      goal:            '',
      valueOfFunction: '',
      source:          stamp,
      sourceType:      'ai',
      fieldSources:    { description: src, scale: src, meter: src },
    } as VEntry
    next.values = [...(next.values ?? []), newV]
    return {
      newSpec: next, affectedItemId: newV.id, affectedItemType: 'value',
      summary: `${idBase} Value added — Heilmeier ${HEILMEIER_CATEGORY_META[finding.category].label}`,
    }
  }

  // Baseline status — annotate triggered V. entry
  if (fix.type === 'add-baseline-status') {
    const v = (next.values ?? []).find(x => x.id === finding.triggeredBy)
    if (v) {
      v.status = v.status && v.status.trim().length > 0
        ? v.status
        : '[TODO Heilmeier Q2 — current baseline value]'
      v.fieldSources = { ...(v.fieldSources ?? {}), status: src }
      return {
        newSpec: next, affectedItemId: v.id, affectedItemType: 'value',
        summary: `Baseline Status TODO added to ${v.id} — Heilmeier Q2`,
      }
    }
  }

  // Novelty solution — add new S. entry or annotate existing
  if (fix.type === 'add-novelty-solution') {
    if ((next.solutions ?? []).length === 0 || finding.triggeredBy === 'plan-level') {
      const existingIds = (next.solutions ?? []).map(s => s.id)
      const newS: SEntry = {
        id:           _uniqueMnemonic('Novel Approach', existingIds),
        type:         'Solution',
        level:        'Business',
        description:  finding.principleViolated,
        impact:       '[expected impact on the primary objective]',
        source:       stamp,
        sourceType:   'ai',
        fieldSources: { description: src, impact: src },
      } as SEntry
      next.solutions = [...(next.solutions ?? []), newS]
      return {
        newSpec: next, affectedItemId: newS.id, affectedItemType: 'solution',
        summary: `Novel Approach Solution added — Heilmeier Q3`,
      }
    }
    const s = (next.solutions ?? []).find(x => x.id === finding.triggeredBy)
    if (s) {
      s.description = s.description && s.description.trim().length > 30
        ? s.description
        : `[TODO Heilmeier Q3 — why is this new + evidence it will succeed] ${s.description ?? ''}`
      s.fieldSources = { ...(s.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: s.id, affectedItemType: 'solution',
        summary: `Novelty TODO added to ${s.id} — Heilmeier Q3`,
      }
    }
  }

  // Constraint adds (risks, midterm exams, generic)
  if (fix.type === 'add-risk-management-constraint'
   || fix.type === 'add-midterm-exam-constraint'
   || fix.type === 'add-constraint') {
    const existingIds = (next.constraints ?? []).map(c => c.id)
    const idBase = ({
      'add-risk-management-constraint': 'Risk Register',
      'add-midterm-exam-constraint':    'Midterm Exam',
      'add-constraint':                 finding.principleViolated.split('—')[0].trim() || 'Heilmeier Constraint',
    } as Record<typeof fix.type, string>)[fix.type]
    const newC: CEntry = {
      id:           _uniqueMnemonic(idBase, existingIds),
      type:         'Constraint',
      level:        'Business',
      description:  finding.principleViolated.split('—')[1]?.trim() || finding.principleViolated,
      scope:        'plan-level',
      rationale:    finding.explanation,
      source:       stamp,
      sourceType:   'ai',
      fieldSources: { description: src, scope: src, rationale: src },
    } as CEntry
    next.constraints = [...(next.constraints ?? []), newC]
    return {
      newSpec: next, affectedItemId: newC.id, affectedItemType: 'constraint',
      summary: `${idBase} Constraint added — Heilmeier ${HEILMEIER_CATEGORY_META[finding.category].label}`,
    }
  }

  // Resource adds (cost Q6, time Q7)
  if (fix.type === 'add-cost-resource' || fix.type === 'add-time-resource') {
    const existingIds = (next.resources ?? []).map(r => r.id)
    const idBase = fix.type === 'add-cost-resource' ? 'Cost' : 'Timeline'
    const scale = fix.type === 'add-cost-resource'
      ? '[currency] per [phase / lifetime]'
      : 'weeks from plan-start'
    const newR: REntry = {
      id:           _uniqueMnemonic(idBase, existingIds),
      type:         'Resource',
      level:        'Business',
      description:  finding.principleViolated,
      scale,
      meter:        '[how measured]',
      status:       '',
      tolerable:    '[max tolerable]',
      budget:       fix.type === 'add-cost-resource' ? '[allocated amount]' : '[target weeks]',
      source:       stamp,
      sourceType:   'ai',
      fieldSources: { description: src, scale: src, meter: src },
    } as REntry
    next.resources = [...(next.resources ?? []), newR]
    return {
      newSpec: next, affectedItemId: newR.id, affectedItemType: 'resource',
      summary: `${idBase} Resource added — Heilmeier ${HEILMEIER_CATEGORY_META[finding.category].label}`,
    }
  }

  // Left-out stakeholder
  if (fix.type === 'add-left-out-stakeholder') {
    const existingIds = (next.stakeholderEntries ?? []).map(s => s.id)
    const newS = {
      id:              _uniqueMnemonic('Indirect Stakeholder', existingIds),
      type:            'Stakeholder',
      stakeholderType: 'Indirect' as const,
      definition:      finding.principleViolated,
      description:     finding.explanation.slice(0, 240),
      source:          stamp,
      sourceType:      'ai' as const,
      fieldSources:    { definition: src, description: src },
    }
    next.stakeholderEntries = [...(next.stakeholderEntries ?? []), newS]
    return {
      newSpec: next, affectedItemId: newS.id, affectedItemType: 'stakeholder',
      summary: `Indirect Stakeholder added — Heilmeier Q9 (IEEE 2025 extension)`,
    }
  }

  // Jargon simplification
  if (fix.type === 'simplify-jargon-description') {
    const v = (next.values ?? []).find(x => x.id === finding.triggeredBy)
    if (v) {
      v.description = `[TODO Heilmeier Q1 — replace jargon with plain English] ${v.description}`
      v.fieldSources = { ...(v.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: v.id, affectedItemType: 'value',
        summary: `Jargon TODO added to ${v.id} — Heilmeier Q1`,
      }
    }
    const f = (next.functions ?? []).find(x => x.id === finding.triggeredBy)
    if (f) {
      f.description = `[TODO Heilmeier Q1 — replace jargon with plain English] ${f.description}`
      f.fieldSources = { ...(f.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: f.id, affectedItemType: 'function',
        summary: `Jargon TODO added to ${f.id} — Heilmeier Q1`,
      }
    }
    const s = (next.solutions ?? []).find(x => x.id === finding.triggeredBy)
    if (s) {
      s.description = `[TODO Heilmeier Q1 — replace jargon with plain English] ${s.description}`
      s.fieldSources = { ...(s.fieldSources ?? {}), description: src }
      return {
        newSpec: next, affectedItemId: s.id, affectedItemType: 'solution',
        summary: `Jargon TODO added to ${s.id} — Heilmeier Q1`,
      }
    }
  }

  return null
}
