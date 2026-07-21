/**
 * strategySharpenDimensions.ts
 *
 * The 10 canonical Strategy Sharpening dimensions for the Strategy Agent Tool.
 * Grounded in Gilb's Planguage methodology: CE, VIET, Priority Engineering,
 * EVO 2024, Value Improvement, ASPECTS, DEEP Think.
 *
 * Each dimension defines a sharpening axis for Solution (S.) entries.
 * The tool works independently of Strategy Mode (by design — Tom 2026-06-09).
 *
 * Claude-Code-as-AI-Layer: The composable builds a prompt; Tom pastes it
 * into Claudian and pastes the JSON result back. No runtime API calls.
 */

export interface StrategyDimension {
  id: string
  label: string
  summary: string
  questions: string[]
  examples: string[]
  gilbCite: string
  whyItMatters: string
  standardRef?: string
}

export interface StrategyFinding {
  dimensionId: string
  score: number               // 0–100: how sharp this dimension is
  severity: 'critical' | 'moderate' | 'advisory'
  findings: string[]          // Specific issues found in the spec
  suggestions: StrategyImprovement[]
}

export interface StrategyImprovement {
  id: string                  // Stable key e.g. "link-s1-to-v2"
  description: string         // What to change
  targetEntryId?: string      // Which S. entry to improve (if specific)
  newFieldValues?: Record<string, string>  // Proposed field updates
  gilbReason: string          // Planguage justification
}

export interface StrategyAnalysisResult {
  generatedAt: string
  overallScore: number        // 0–100 weighted average
  dimensions: StrategyFinding[]
  topPriority: string[]       // Top 3 actionable improvements (plain text)
  claudianNotes?: string      // Free-text observations from Claudian
}

// ── The 10 Canonical Strategy Sharpening Dimensions ─────────────────────────

export const STRATEGY_SHARPEN_DIMENSIONS: StrategyDimension[] = [
  {
    id: 'value-traceability',
    label: 'Value Traceability',
    summary: 'Every Solution must link to ≥1 Value entry — orphan solutions waste resources.',
    questions: [
      'Which solutions have no linked Values (impact field blank or "TBD")?',
      'Which solutions link to Values by name but without a numeric estimate?',
      'Are any solutions justified only by linking to the lowest-priority Values?',
    ],
    examples: [
      'S."Cache Layer" → impact: "V.Search Latency ~40%, V.User Throughput ~15%" ✓',
      'S."Cache Layer" → impact: "helps performance" ✗ — no Value ID, no estimate',
      'S."Cache Layer" → impact: (blank) ✗ — orphan, unjustifiable',
    ],
    gilbCite: 'CE (Gilb 2005) ch.14 p.402 — "Every design decision must be traceable to a value requirement." VIET (Gilb 1988) §3.',
    whyItMatters: 'An orphan solution cannot be prioritised, measured, or justified. It is resource expenditure with no accountability to stakeholder results.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Solution.md',
  },
  {
    id: 'impact-quantification',
    label: 'Impact Quantification',
    summary: 'Solutions need numeric impact estimates on Values — IET quality depends on numbers.',
    questions: [
      'Which solutions state impact as a percentage change on a named V. entry?',
      'Which solutions use vague words ("improves", "enhances", "helps") without numbers?',
      'Are impact estimates supported by any evidence or assumption?',
    ],
    examples: [
      'S."Redis Cache" → impactsValues: "V.Search Latency P95 ~-45% (measured in staging)" ✓',
      'S."Redis Cache" → impactsValues: "will improve search speed significantly" ✗',
      'S."Redis Cache" → impactsValues: (blank) ✗ — IET cannot run',
    ],
    gilbCite: 'CE (Gilb 2005) ch.15 — Impact Estimation Table. Priority Engineering (Gilb 2009) §4: "Quantified impact is the precondition for rational prioritisation."',
    whyItMatters: 'Without numeric impact estimates, IET/MultiVision cannot rank solutions. The plan devolves to opinion-based prioritisation.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Solution.md',
  },
  {
    id: 'constraint-compliance',
    label: 'Constraint Compliance',
    summary: 'Solutions must not violate any Constraint entry — binary constraints are hard edges.',
    questions: [
      'Does each solution explicitly acknowledge constraints it must respect?',
      'Are there solutions that implicitly violate a listed constraint (e.g. a technical approach banned by a security constraint)?',
      'Are any constraints currently unaddressed by any solution?',
    ],
    examples: [
      'C."GDPR Data Residency" limits S."Cloud Analytics" → S. must add "within EU data centres only" ✓',
      'S."Third-Party Analytics" ignores C."No PII export" ✗ — compliance violation',
      'C."Budget ≤ £200k" with no solution carrying an effort estimate ✗ — budget untracked',
    ],
    gilbCite: 'CE (Gilb 2005) ch.6 p.137 — "Constraints are non-negotiable limits. Solutions that violate them are not solutions." Competitive Engineering Constraints Spec.',
    whyItMatters: 'A solution that violates a constraint is a project risk, not a plan asset. Constraint compliance must be verified before solutions are committed.',
  },
  {
    id: 'goal-coverage',
    label: 'Goal Coverage',
    summary: 'Combined solution impact must plausibly reach each Value Goal — not just improve it.',
    questions: [
      'For each Value with a Goal, do the linked solutions estimate enough combined impact to reach it?',
      'Are there Values where the summed solution impact falls short of Goal (coverage gap)?',
      'Are there Values with Wish-level Goal that have no solution targeting them at all?',
    ],
    examples: [
      'V."Search Latency" Goal=95ms, Status=180ms. S.Cache → -45%, S.Index Rebuild → -20%. Combined ~-65% ≈ 63ms ✓',
      'V."Uptime" Goal=99.9%, Status=97%. No solutions mention uptime → goal unreachable ✗',
      'V."NPS Score" Goal=70, Status=42. S.Onboarding only → +12 → 54, still below goal ✗',
    ],
    gilbCite: 'CE (Gilb 2005) ch.15 p.421 — "The IET must show that combined solution impact reaches Value Goals." Priority Engineering (Gilb 2009).',
    whyItMatters: 'If solutions cannot collectively reach Value Goals, the plan is a wishful intention, not an engineering commitment. Goal Coverage is the central test of a viable strategy.',
    standardRef: '10.Standard/Standard.Kai-Zen/Proc_v_p_o_SpecifyValue.md',
  },
  {
    id: 'resource-feasibility',
    label: 'Resource Feasibility',
    summary: 'Solution effort/cost estimates must fit within Resource Budgets.',
    questions: [
      'Which solutions have no cost or effort estimate?',
      'Do the combined estimated costs of all solutions exceed any Resource Budget?',
      'Are there solutions with known high cost but low Value impact (negative ROI)?',
    ],
    examples: [
      'S."Full Rewrite" → impactsCosts: "R.Dev Budget ~-80%", impactsValues: "V.Perf ~+15%" → poor ROI ✗',
      'S."Config Tuning" → impactsCosts: "R.Dev Budget ~-2%", impactsValues: "V.Perf ~+8%" → strong ROI ✓',
      'R."Dev Budget" Goal=£100k; ΣS.impactsCosts = £145k → over-committed ✗',
    ],
    gilbCite: 'CE (Gilb 2005) ch.16 — Resource Constraints. Value Improvement (Gilb 2023) §5: "Efficiency = Value achieved per unit resource consumed."',
    whyItMatters: 'An over-committed plan is a failed plan before it starts. Resource Feasibility is the gateway check before any Evo Step is scheduled.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Resource.md',
  },
  {
    id: 'solution-specificity',
    label: 'Solution Specificity',
    summary: 'Solutions must be specific enough to be implementable — vague solutions block execution.',
    questions: [
      'Which solutions are described at a strategic level only ("improve X") with no implementation detail?',
      'Which solutions are missing the "Function" field (which F. entry does this solution provide)?',
      'Could a new engineer read this solution description and know where to start?',
    ],
    examples: [
      'S."Improve Performance" → description: "Make the app faster" ✗ — not implementable',
      'S."Redis Cache Layer" → function: "F.Search Results Delivery", description: "Add Redis 7 in-front of Postgres text search, TTL=5min, eviction=LRU" ✓',
      'S."Better UX" with no linked functions, no implementation notes ✗',
    ],
    gilbCite: 'CE (Gilb 2005) Template_Write_Solution: "Description must specify the mechanism, not just the intent." ASPECTS (Gilb) §3 — specificity principle.',
    whyItMatters: 'A solution is only actionable if a team can implement it without further clarification. Vague solutions accumulate as backlog items that never ship.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Solution.md',
  },
  {
    id: 'redundancy-detection',
    label: 'Redundancy Detection',
    summary: 'Overlapping solutions targeting the same Values waste resources and create conflict.',
    questions: [
      'Are there ≥2 solutions that both target the same Value with similar approaches?',
      'Could any two solutions be merged into one more powerful solution?',
      'Are there solutions that contradict each other in their approach to the same problem?',
    ],
    examples: [
      'S."Redis Cache" AND S."Memcached Layer" both targeting V.Search Latency → consolidate ✗',
      'S."Microservices Split" AND S."Monolith Optimisation" — mutually exclusive approaches ✗',
      'S."Onboarding Checklist" AND S."Interactive Tour" both targeting V.User Activation → merge or differentiate ✗',
    ],
    gilbCite: 'CE (Gilb 2005) KISS Principle (ch.12): "Never implement two solutions to the same problem unless you have evidence both are necessary." EVO 2024 (Gilb) §2.',
    whyItMatters: 'Redundant solutions double resource consumption without proportionally increasing Value. They also introduce integration conflicts and maintenance overhead.',
  },
  {
    id: 'dependency-ordering',
    label: 'Dependency Ordering',
    summary: 'Solutions with implicit dependencies must be ordered — out-of-order delivery creates waste.',
    questions: [
      'Are there solutions that require another solution to be in place before they can work?',
      'Is the dependency chain documented (e.g. S."API Layer" must precede S."Mobile Client")?',
      'Are any foundational (infrastructure) solutions scheduled later than the solutions that depend on them?',
    ],
    examples: [
      'S."Mobile Client" depends on S."REST API Gateway" — if API is not scheduled first, Mobile Client work cannot complete ✗',
      'S."ML Recommendations" depends on S."Data Pipeline" — data must flow before models can train ✗',
      'S."Caching Layer" depends on S."Database Migration" — correct if database migration precedes ✓',
    ],
    gilbCite: 'EVO 2024 (Gilb) ch.2 Steps 4–5: "Decompose before Prioritise. Dependencies define the partial order." CE (Gilb 2005) ch.17 — Evo Step sequencing.',
    whyItMatters: 'Delivering a dependent solution before its dependency wastes delivery effort and may require rework. Dependency ordering is the minimal critical path analysis every plan needs.',
  },
  {
    id: 'past-sharpening-patterns',
    label: 'Past Sharpening Patterns',
    summary: 'Recurring issues across past sharpenings reveal structural weaknesses — not just one-time gaps.',
    questions: [
      'What fields were most frequently modified across past sharpening rounds?',
      'Are the same solution entries being sharpened repeatedly (chronic weakness)?',
      'Did past sharpenings add new solutions, or mostly refine existing ones?',
    ],
    examples: [
      '"Impact" field modified 4× across 3 rounds → impact quantification is a recurring weakness',
      'S."Onboarding Flow" sharpened in every round → fundamentally underspecified solution',
      'All past rounds added new solutions but never removed → possible solution bloat accumulating',
    ],
    gilbCite: 'EVO 2024 (Gilb) Step 9 (Learn): "The learn step updates the plan based on measured results and identified patterns." Stakeholder Engineering (Gilb 2023).',
    whyItMatters: 'A pattern across multiple sharpenings reveals a structural problem that one-off fixes cannot cure. Understanding the pattern enables a systemic solution.',
  },
  {
    id: 'strategy-completeness',
    label: 'Strategy Completeness',
    summary: 'Every Value cluster must have at least one solution providing positive impact — no Value left behind.',
    questions: [
      'Are there Value entries that no solution links to at all (unaddressed Values)?',
      'Are there Value categories (user-experience, performance, compliance) with only one thin solution?',
      'Are there Values in the Wish range where zero solutions are aimed at reaching that level?',
    ],
    examples: [
      'V."Staff Wellbeing" with Goal=8/10, Status=5/10 — no solution targets it → unaddressed ✗',
      'V."Security Compliance" linked only to S."Password Policy" — single point of failure ✗',
      'V."Revenue Growth" with Wish=150% — no solution aims above Goal level (100%) ✗',
    ],
    gilbCite: 'CE (Gilb 2005) ch.15: "Every Value must have at least one Solution with confirmed positive impact." Value Improvement (Gilb 2023) §2.',
    whyItMatters: 'An unaddressed Value is a stakeholder need that the plan explicitly ignores. Strategy Completeness confirms the plan has a credible path to every stated stakeholder outcome.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Values.md',
  },
]

// ── AI-Max Suggested Answers (r41 v361, Tom Gilb 2026-06-25) ─────────────────
//
// Tom Gilb verbatim: *"in this sharpening no suggested answers are generated.
// THIS IS THE STANDARD FOR ALL SHARPENING, AI GENERATED QUESTIONS"*.
//
// Per the AI-Max Principle SUPREME ("Never present a blank field if a starting
// point can be derived"), every Guided Question textarea must surface a spec-
// derived starting point.  Source layer per Conjunction-of-Technologies
// SUPREME: these suggestions are DETERMINISTIC, derived from currentSpec
// (highest provenance) — no LLM call needed, instant render, no API cost.
//
// Each suggestion is a STARTER the planner refines.  Empty textarea → use the
// suggestion as initial value; planner edits or replaces freely.

interface MinimalSpec {
  functions?:         Array<{ id: string; description?: string; functionOfValue?: string }>
  values?:            Array<{ id: string; description?: string; scale?: string; goal?: string; status?: string; wish?: string; tolerable?: string; wishStakeholder?: string; valueOfFunction?: string }>
  solutions?:         Array<{ id: string; description?: string; impact?: string; function?: string; valueOfFunction?: string; cost?: string; effort?: string }>
  constraints?:       Array<{ id: string; description?: string; scope?: string }>
  resources?:         Array<{ id: string; description?: string; budget?: string; goal?: string; tolerable?: string }>
  stakeholderEntries?: Array<{ name: string; stakeholderType?: string }>
}

/** Mention an entry by its mnemonic id, falling back to a placeholder if absent. */
function _idList(items: Array<{ id?: string }> | undefined, max = 6): string {
  if (!items || items.length === 0) return '(none)'
  const ids = items.map(i => i.id ?? '?').filter(Boolean)
  if (ids.length === 0) return '(none)'
  if (ids.length <= max) return ids.join(', ')
  return ids.slice(0, max).join(', ') + ` … (+${ids.length - max} more)`
}

/** Detect whether a string field looks numeric or vague. */
function _looksNumeric(s: string | undefined): boolean {
  if (!s) return false
  return /\d/.test(s) && /(%|ms|s\b|hr|h\b|min|k\b|m\b|gb|mb|≤|≥|<|>|=)/i.test(s)
}

/** Generate a deterministic suggested answer for (dimensionId, questionIndex)
 *  from spec data.  Returns a STARTER the planner can edit. */
export function suggestStrategyAnswer(
  dimensionId: string,
  qIdx: number,
  spec: MinimalSpec | null | undefined,
): string {
  if (!spec) return '(no spec loaded yet — generate a Planguage spec in Stage 1, then return here for suggestions)'

  const fns  = spec.functions  ?? []
  const vals = spec.values     ?? []
  const sols = spec.solutions  ?? []
  const cs   = spec.constraints ?? []
  const rs   = spec.resources  ?? []

  // Pre-compute frequently-needed subsets
  const solsNoImpact = sols.filter(s => !s.impact || !s.impact.trim() || /^tbd$/i.test(s.impact))
  const solsVagueImpact = sols.filter(s => s.impact && s.impact.trim() && !_looksNumeric(s.impact))
  const solsNumericImpact = sols.filter(s => _looksNumeric(s.impact))
  const solsNoCost = sols.filter(s => (!s.cost || !s.cost.trim()) && (!s.effort || !s.effort.trim()))
  const solsNoFunction = sols.filter(s => !s.function || !s.function.trim())
  const valsWithGoal = vals.filter(v => v.goal && v.goal.trim())
  const valsWithWish = vals.filter(v => v.wish && v.wish.trim())
  const valsUnaddressed = vals.filter(v => !sols.some(s =>
    (s.impact ?? '').toLowerCase().includes(v.id.toLowerCase()) ||
    (s.valueOfFunction ?? '').toLowerCase().includes(v.id.toLowerCase())
  ))

  const key = `${dimensionId}:${qIdx}`

  switch (key) {
    // value-traceability
    case 'value-traceability:0':
      return solsNoImpact.length > 0
        ? `${solsNoImpact.length} of ${sols.length} Solutions have blank or TBD impact: ${_idList(solsNoImpact)}. These are orphan Solutions — they cannot be prioritised or measured. Recommend: link each to ≥1 Value entry with a numeric estimate.`
        : `All ${sols.length} Solutions carry an impact field. Next check: are the linked Value IDs real (not just prose)?`
    case 'value-traceability:1':
      return solsVagueImpact.length > 0
        ? `${solsVagueImpact.length} Solutions link to Values by name but without a numeric estimate: ${_idList(solsVagueImpact)}. Recommend: replace prose impact with "V.<id> ~±N%" form so IET can run.`
        : `No vague-name-only links detected. ${solsNumericImpact.length} Solutions carry quantitative impact.`
    case 'value-traceability:2':
      return `Reviewing ${sols.length} Solutions for justification-by-low-priority pattern. Of ${vals.length} Values, ${valsWithGoal.length} carry explicit Goals. Recommend: cross-check each Solution's linked Values against the Goal-vs-Wish hierarchy — Solutions justified only by Wish-level (uncommitted) Values are weak.`

    // impact-quantification
    case 'impact-quantification:0':
      return solsNumericImpact.length > 0
        ? `${solsNumericImpact.length} of ${sols.length} Solutions carry quantified impact: ${_idList(solsNumericImpact)}. Format examples present in the data: ${solsNumericImpact.slice(0,3).map(s => `${s.id} → "${(s.impact ?? '').slice(0,60)}"`).join('; ') || '(format pending)'}.`
        : `No Solutions carry numeric impact yet. Recommend: for each Solution, populate impact as "V.<id> ~±N%" (e.g. "V.Search Latency ~-45%").`
    case 'impact-quantification:1':
      return solsVagueImpact.length > 0
        ? `${solsVagueImpact.length} Solutions use vague impact words without numbers: ${_idList(solsVagueImpact)}. Recommend: replace "improves", "enhances", "helps" with measured percentage or absolute deltas.`
        : `No vague impact descriptions detected.`
    case 'impact-quantification:2':
      return `Impact-evidence audit: of ${solsNumericImpact.length} Solutions with numeric impact, sample three for evidence — "${solsNumericImpact.slice(0,3).map(s => s.id).join(', ') || '(none)'}". Recommend: cite source (measured / estimated / vendor-claim / industry-benchmark) for each estimate.`

    // constraint-compliance
    case 'constraint-compliance:0':
      return cs.length === 0
        ? 'No Constraint entries in the spec yet. Recommend: add C. entries for any hard limits (regulatory, budget, technical) before continuing strategy sharpening.'
        : `${cs.length} Constraints in the spec: ${_idList(cs)}. Recommend: for each Solution, verify which Constraints it must respect and document the acknowledgement.`
    case 'constraint-compliance:1':
      return cs.length === 0
        ? 'No Constraints to check against.'
        : `Cross-check ${sols.length} Solutions against ${cs.length} Constraints (${_idList(cs)}). Look for implicit violations — e.g. a cloud-deployment Solution against a data-residency Constraint.`
    case 'constraint-compliance:2':
      return cs.length === 0
        ? 'No Constraints in the spec.'
        : `Of ${cs.length} Constraints, identify which are explicitly addressed by ≥1 Solution. Untargeted Constraints become silent project risks.`

    // goal-coverage
    case 'goal-coverage:0':
      return valsWithGoal.length === 0
        ? 'No Values have explicit Goals yet. Recommend: add Goal levels to V. entries before checking coverage.'
        : valsWithGoal.slice(0, 5).map(v => {
            const linked = sols.filter(s => (s.impact ?? '').toLowerCase().includes(v.id.toLowerCase()))
            return `• ${v.id} — Goal: ${v.goal}${v.status ? `, Status: ${v.status}` : ''} — ${linked.length} Solution${linked.length === 1 ? '' : 's'} linked${linked.length > 0 ? ` (${linked.map(s => s.id).join(', ')})` : ''}`
          }).join('\n') + (valsWithGoal.length > 5 ? `\n… (+${valsWithGoal.length - 5} more)` : '') + '\n\nCoverage assessment: [your analysis]'
    case 'goal-coverage:1':
      return valsUnaddressed.length > 0
        ? `Coverage GAP detected — ${valsUnaddressed.length} Value${valsUnaddressed.length === 1 ? '' : 's'} have NO Solution linkage: ${_idList(valsUnaddressed)}. These Goals are unreachable as currently planned.`
        : `Every Value has at least one Solution link. Next: check whether the summed impact actually reaches each Goal.`
    case 'goal-coverage:2':
      return valsWithWish.length > 0
        ? `${valsWithWish.length} Values carry a Wish level: ${_idList(valsWithWish)}. Wish targets are aspirational — verify whether any Solution explicitly aims above the Goal toward the Wish.`
        : 'No Wish levels set. Recommend: add Wish to V. entries to mark stakeholder aspirations beyond the negotiated Goal.'

    // resource-feasibility
    case 'resource-feasibility:0':
      return solsNoCost.length > 0
        ? `${solsNoCost.length} of ${sols.length} Solutions have no cost/effort estimate: ${_idList(solsNoCost)}. Recommend: add an effort or cost field to each so Resource Feasibility can be assessed.`
        : `All ${sols.length} Solutions carry cost or effort estimates.`
    case 'resource-feasibility:1':
      return rs.length === 0
        ? 'No Resource entries in the spec. Recommend: add R. entries (Dev Budget, Hours, Hardware) with budgets so total consumption can be checked.'
        : `${rs.length} Resources to budget against: ${_idList(rs)}. Recommend: sum each Solution's cost against the matching Resource's budget; flag over-commitment.`
    case 'resource-feasibility:2':
      return solsNumericImpact.length > 0
        ? `ROI audit candidates — Solutions with both numeric impact AND cost data: ${_idList(sols.filter(s => _looksNumeric(s.impact) && (s.cost || s.effort)), 5)}. Recommend: rank by Δ-impact ÷ Δ-cost; flag negative or marginal ROI.`
        : 'Insufficient quantified impact data to assess ROI. Quantify impacts first (see Impact Quantification dimension).'

    // solution-specificity
    case 'solution-specificity:0':
      return sols.length > 0
        ? `Strategic-only descriptions to audit — ${sols.length} Solution${sols.length === 1 ? '' : 's'}: ${sols.slice(0, 5).map(s => `${s.id}: "${(s.description ?? '').slice(0,60)}"`).join('; ')}. Recommend: any description shorter than 1 sentence of mechanism is strategic-only.`
        : 'No Solutions in the spec yet.'
    case 'solution-specificity:1':
      return solsNoFunction.length > 0
        ? `${solsNoFunction.length} Solutions missing Function link: ${_idList(solsNoFunction)}. Recommend: link each Solution to the F. entry it provides; orphan-from-Function Solutions are hard to verify.`
        : `All Solutions carry a Function field.`
    case 'solution-specificity:2':
      return `Readability audit — pick 2-3 Solutions at random (${_idList(sols, 3)}) and ask: "Could a new engineer start work from this description without further clarification?" If no, the Solution needs sharpening.`

    // redundancy-detection
    case 'redundancy-detection:0':
      return `Scanning ${sols.length} Solutions for value-target overlap. Pairs with the same impact target are redundancy candidates. Manual pass recommended over the impact field of each Solution.`
    case 'redundancy-detection:1':
      return sols.length >= 2
        ? `${sols.length} Solutions present. Look for Solutions whose impact, function, or description heavily overlap — these are merge candidates.`
        : 'Too few Solutions to detect redundancy yet.'
    case 'redundancy-detection:2':
      return 'Contradiction check: scan Solution pairs for opposite approaches (e.g. centralise vs decentralise on the same Function). Mutually-exclusive Solutions need a decision, not parallel delivery.'

    // dependency-ordering
    case 'dependency-ordering:0':
      return sols.length > 0
        ? `Scan ${sols.length} Solutions for "depends on", "requires", "after" language: ${_idList(sols)}. Any S. that names another S. or F. as a prerequisite is a dependency edge.`
        : 'No Solutions to analyse for dependencies.'
    case 'dependency-ordering:1':
      return 'Recommend: maintain an explicit dependency graph (one row per dependency: source → target). Implicit dependencies discovered late cause Evo Step rework.'
    case 'dependency-ordering:2':
      return sols.length > 0
        ? `Of ${sols.length} Solutions, classify each as foundational (must precede others) or dependent (must follow). Foundation-after-dependent is the highest-cost ordering error.`
        : 'No Solutions to classify.'

    // past-sharpening-patterns
    case 'past-sharpening-patterns:0':
      return 'Recommend: review the Sharpen History panel — count modifications per field across all rounds. The top-3 most-modified fields reveal where the spec discipline is weakest.'
    case 'past-sharpening-patterns:1':
      return sols.length > 0
        ? `Solutions to check for chronic sharpening: ${_idList(sols)}. Any Solution appearing in ≥3 sharpen rounds is structurally underspecified.`
        : 'No Solutions in the spec.'
    case 'past-sharpening-patterns:2':
      return 'Recommend: tally (new Solutions added) vs (existing Solutions refined) per round. Add-only patterns suggest scope creep; refine-only patterns suggest the initial set was adequate.'

    // strategy-completeness
    case 'strategy-completeness:0':
      return valsUnaddressed.length > 0
        ? `Unaddressed Values: ${_idList(valsUnaddressed)}. These ${valsUnaddressed.length} Value${valsUnaddressed.length === 1 ? '' : 's'} have no Solution providing positive impact — the strategy is incomplete.`
        : `Every Value has at least one Solution link. Strategy is COMPLETE at the linkage level (impact magnitude is a separate check — see Goal Coverage).`
    case 'strategy-completeness:1':
      return vals.length > 0
        ? `${vals.length} Values total. Group by domain (UX / performance / compliance / business): ${_idList(vals)}. Any category with only ONE Solution is a single-point-of-failure for that category.`
        : 'No Values in the spec yet.'
    case 'strategy-completeness:2':
      return valsWithWish.length > 0
        ? `Values with Wish levels: ${_idList(valsWithWish)}. For each, check whether any Solution explicitly aims above the Goal level toward the Wish. Wish without Solution = aspiration without commitment.`
        : 'No Wish levels declared. The plan operates at Goal level only.'

    default:
      return '(no template for this dimension/question pair — provide a free-text answer)'
  }
}

// ── Claudian Prompt ──────────────────────────────────────────────────────────

export const STRATEGY_ANALYSIS_PROMPT = `# Strategy Sharpening Analysis — Claudian Task

You are acting as a Planguage Strategy Auditor. You will analyse the spec below
across the 10 canonical Strategy Sharpening dimensions and return a structured JSON result.

## Your Task

Read the SPEC_JSON carefully. For each of the 10 dimensions below, produce:
- A score 0–100 (100 = fully sharp, 0 = critical gap)
- A severity: "critical" (score<40) | "moderate" (40–69) | "advisory" (70–89) | (omit if ≥90)
- An array of specific findings (reference actual entry IDs from the spec)
- An array of specific, actionable improvement suggestions with Planguage syntax examples
- A gilbReason justifying each suggestion from Gilb's methodology

## The 10 Dimensions

1. value-traceability — Every S. entry must link to ≥1 V. entry with an impact estimate
2. impact-quantification — Impact estimates must be numeric (% or unit change), not vague words
3. constraint-compliance — Solutions must not violate C. entries; constraints must be addressed
4. goal-coverage — Combined solution impact must plausibly reach each V. Goal
5. resource-feasibility — Solution costs must fit R. Budgets; flag negative ROI solutions
6. solution-specificity — Solutions must be specific enough to implement without clarification
7. redundancy-detection — Flag overlapping solutions targeting same Values with same approach
8. dependency-ordering — Identify implicit dependencies between solutions that impose ordering
9. past-sharpening-patterns — Analyse PAST_SHARPEN_ROUNDS for recurring weaknesses and patterns
10. strategy-completeness — Every V. entry must have ≥1 S. entry providing positive impact

## Output Rules

- Output ONLY valid JSON (no markdown fences, no commentary outside the JSON)
- Use actual entry IDs from the spec (not placeholders)
- Keep findings concise: 1 sentence per finding
- Keep suggestions actionable: what field to change + what value to set
- overallScore = weighted average (goal-coverage and value-traceability weight double)
- topPriority: the 3 most impactful improvements across ALL dimensions (plain English)

## Output Schema

{
  "generatedAt": "ISO timestamp",
  "overallScore": 0-100,
  "dimensions": [
    {
      "dimensionId": "value-traceability",
      "score": 0-100,
      "severity": "critical|moderate|advisory",
      "findings": ["S.EntryX has no impact field", ...],
      "suggestions": [
        {
          "id": "link-s-entry-x-to-v-entry-y",
          "description": "Add impact estimate linking S.EntryX to V.EntryY",
          "targetEntryId": "S.EntryX",
          "newFieldValues": { "impactsValues": "V.EntryY ~+25% (estimated from historical data)" },
          "gilbReason": "CE ch.14: every solution must be traceable to a value requirement"
        }
      ]
    }
  ],
  "topPriority": ["Fix impact quantification on 3 solutions", ...],
  "claudianNotes": "Optional free-text observations"
}

---

PAST_SHARPEN_ROUNDS:
{{PAST_SHARPEN_ROUNDS}}

---

SPEC_JSON:
{{SPEC_JSON}}
`
