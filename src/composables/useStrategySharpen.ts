/**
 * useStrategySharpen.ts
 *
 * Deterministic in-app Strategy Sharpening engine.
 * Analyses the live spec against 10 Gilb-grounded dimensions — no external
 * calls, no clipboard, no paste-back.  Results compute instantly from spec data.
 *
 * Tom Gilb 2026-06-09: "we need a great demo of strategy sharpening"
 */

import { ref, computed } from 'vue'
import type { SpecBlock, SEntry, VEntry } from '../types/spec'
import type { SharpenRound } from './useSharpen'
import {
  STRATEGY_SHARPEN_DIMENSIONS,
  type StrategyAnalysisResult,
  type StrategyFinding,
  type StrategyImprovement,
} from '../data/strategySharpenDimensions'

// ── Module-level reactive state ───────────────────────────────────────────────

const _result      = ref<StrategyAnalysisResult | null>(null)
const _approvedIds = ref(new Set<string>())

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Concatenate all impact text fields for a solution. */
function impactText(s: SEntry): string {
  return [s.impactsValues ?? '', s.impact ?? ''].filter(Boolean).join(' ')
}

/** True when text contains a numeric measure (%, units, ms, etc.). */
function hasNumericImpact(text: string): boolean {
  return /[+\-~≈]?\d+(\.\d+)?%/.test(text) ||
    /[+\-~≈]?\d+(\.\d+)?\s*(ms|seconds?|minutes?|hours?|days?|x|×|units?|pts?|points?)/i.test(text)
}

const VAGUE_WORDS_RE =
  /\b(improves?|enhance[sd]?|helps?|boosts?|increases?|decreases?|reduces?|optimizes?|maximizes?|minimizes?|significant\w*|major|minor|overall|better|faster|slower|more\s+efficient|various|several)\b/i

function isVagueImpact(text: string): boolean {
  return VAGUE_WORDS_RE.test(text) && !hasNumericImpact(text)
}

/**
 * Find which VEntries are referenced in a solution's impact text.
 * Matches by bare ID (strips type prefix) and by first meaningful keyword.
 */
function linkedValues(s: SEntry, values: VEntry[]): VEntry[] {
  const t = impactText(s).toLowerCase()
  if (!t.trim()) return []
  return values.filter(v => {
    const bareId = v.id.replace(/^[A-Za-z]+\./g, '').toLowerCase()
    if (t.includes(bareId)) return true
    const words = v.description.toLowerCase().split(/\W+/).filter(w => w.length > 4)
    if (words.length >= 2 && t.includes(words[0]) && t.includes(words[1])) return true
    if (words.length >= 1 && words[0].length >= 7 && t.includes(words[0])) return true
    return false
  })
}

/** 0–100 specificity score for a solution description. */
function specificityScore(desc: string): number {
  if (!desc || desc.trim().length < 10) return 5
  const words = desc.trim().split(/\s+/)
  if (words.length < 4) return 15
  const vagueCount = (desc.match(VAGUE_WORDS_RE) || []).length
  const hasImpl = /\b(using|via|by|with|through|implements?|adds?|creates?|builds?|deploys?|configures?|enables?|extends?|replaces?|integrates?|introduces?|establishes?)\b/i.test(desc)
  let score = Math.min(60, words.length * 2.5)
  if (hasImpl) score += 20
  score -= vagueCount * 10
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── 10 Dimension Analyzers ────────────────────────────────────────────────────

function dim1ValueTraceability(spec: SpecBlock): StrategyFinding {
  const sols = spec.solutions ?? []
  const vals = spec.values ?? []
  if (sols.length === 0) {
    return {
      dimensionId: 'value-traceability', score: 20, severity: 'critical',
      findings: ['No Solution entries in spec — value traceability cannot be assessed.'],
      suggestions: [{
        id: 'vt-no-solutions',
        description: 'Add Solution entries (S.) and link each to at least one Value via impactsValues.',
        gilbReason: 'CE ch.14 p.402: "Every design decision must be traceable to a value requirement."'
      }],
    }
  }
  const orphans = sols.filter(s => !impactText(s).trim())
  const linked  = sols.length - orphans.length
  const score   = Math.round((linked / sols.length) * 100)
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (orphans.length === 0) {
    findings.push(`All ${sols.length} Solution(s) have impact text — value traceability is present.`)
  } else {
    findings.push(`${orphans.length} Solution(s) have no impact text and cannot be traced to any Value: ${orphans.map(s => s.id).join(', ')}`)
    orphans.slice(0, 3).forEach(s => {
      const candidate = vals[0]
      suggestions.push({
        id: `vt-link-${s.id}`,
        description: `Add impactsValues to "${s.id}" — e.g. "${candidate ? candidate.id : 'Value.Name'} ~+20% (estimate)"`,
        targetEntryId: s.id,
        newFieldValues: { impactsValues: `${candidate?.id ?? 'Value.Name'} ~+20% (estimated)` },
        gilbReason: 'CE ch.14: without a Value link, a Solution cannot be prioritised, measured, or justified — it is resource expenditure with no accountability.',
      })
    })
  }
  if (orphans.length > 0 && linked > 0) {
    findings.push(`${linked} of ${sols.length} Solutions have Value linkage; ${orphans.length} are orphaned.`)
  }
  return { dimensionId: 'value-traceability', score, severity, findings, suggestions }
}

function dim2ImpactQuantification(spec: SpecBlock): StrategyFinding {
  const sols = spec.solutions ?? []
  if (sols.length === 0) {
    return {
      dimensionId: 'impact-quantification', score: 20, severity: 'critical',
      findings: ['No Solution entries — no impacts to quantify.'], suggestions: [],
    }
  }
  const withImpact = sols.filter(s => impactText(s).trim())
  if (withImpact.length === 0) {
    return {
      dimensionId: 'impact-quantification', score: 15, severity: 'critical',
      findings: ['No Solutions have any impact text — the Impact Estimation Table (IET) cannot run.'],
      suggestions: [{
        id: 'iq-no-impact',
        description: 'Add numeric impact estimates (e.g. "V.Latency ~-40%") to all Solutions.',
        gilbReason: 'CE ch.15 IET: quantified impact is the precondition for rational prioritisation.',
      }],
    }
  }
  const numeric = withImpact.filter(s => hasNumericImpact(impactText(s)))
  const vague   = withImpact.filter(s => isVagueImpact(impactText(s)))
  const score   = Math.round((numeric.length / withImpact.length) * 100)
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (numeric.length === withImpact.length) {
    findings.push(`All ${numeric.length} Solutions with impact text use numeric estimates — IET-ready.`)
  } else {
    findings.push(`${numeric.length} of ${withImpact.length} Solutions with impact text have numeric estimates.`)
  }
  if (vague.length > 0) {
    findings.push(`${vague.length} Solution(s) use vague language without numbers: ${vague.map(s => s.id).join(', ')}`)
    vague.slice(0, 3).forEach(s => {
      suggestions.push({
        id: `iq-quantify-${s.id}`,
        description: `Replace vague impact language in "${s.id}" with a numeric % change — e.g. "Value.Name ~+15% (estimated from comparable implementations)"`,
        targetEntryId: s.id,
        newFieldValues: { impactsValues: '(replace with) Value.Name ~+NN% (basis: ...)' },
        gilbReason: 'Priority Engineering §4: "Quantified impact is the precondition for rational prioritisation." Without a number, IET/MultiVision cannot rank Solutions.',
      })
    })
  }
  return { dimensionId: 'impact-quantification', score, severity, findings, suggestions }
}

function dim3ConstraintCompliance(spec: SpecBlock): StrategyFinding {
  const constraints = spec.constraints ?? []
  const sols        = spec.solutions   ?? []
  if (constraints.length === 0) {
    return {
      dimensionId: 'constraint-compliance', score: 55, severity: 'moderate',
      findings: [
        'No Constraint entries found — constraints may be missing from the spec.',
        'Without explicit Constraints, Solutions cannot be audited for compliance.',
      ],
      suggestions: [{
        id: 'cc-add-constraints',
        description: 'Add Constraint entries (C.) documenting binary rules: GDPR, budget caps, technology restrictions, regulatory requirements.',
        gilbReason: 'CE ch.6 p.137: "Constraints are non-negotiable limits. Solutions that violate them are not solutions."',
      }],
    }
  }
  const unaddressed = constraints.filter(c => {
    const cKey = c.id.replace(/^[Cc]\./, '').toLowerCase()
    const cDesc = c.description.toLowerCase().slice(0, 25)
    return !sols.some(s => {
      const t = (s.description + ' ' + impactText(s)).toLowerCase()
      return t.includes(cKey) || t.includes(cDesc)
    })
  })
  const covered = constraints.length - unaddressed.length
  const score   = Math.round((covered / constraints.length) * 70 + 30)
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (unaddressed.length === 0) {
    findings.push(`All ${constraints.length} Constraint(s) appear to be acknowledged by at least one Solution.`)
  } else {
    findings.push(`${unaddressed.length} Constraint(s) are not explicitly referenced by any Solution: ${unaddressed.map(c => c.id).join(', ')}`)
    unaddressed.slice(0, 2).forEach(c => {
      suggestions.push({
        id: `cc-address-${c.id}`,
        description: `Annotate the Solution(s) responsible for compliance with "${c.id}" — or add a dedicated compliance Solution if none addresses it.`,
        gilbReason: 'CE ch.6: constraint compliance must be explicit and verifiable. A solution that violates a constraint is not a solution.',
      })
    })
  }
  findings.push(`${constraints.length} Constraint(s) defined, ${covered} covered by Solutions.`)
  return { dimensionId: 'constraint-compliance', score, severity, findings, suggestions }
}

function dim4GoalCoverage(spec: SpecBlock): StrategyFinding {
  const vals = spec.values    ?? []
  const sols = spec.solutions ?? []
  if (vals.length === 0) {
    return {
      dimensionId: 'goal-coverage', score: 10, severity: 'critical',
      findings: ['No Value entries — Goal coverage cannot be assessed.'], suggestions: [],
    }
  }
  const withGoal = vals.filter(v => v.goal?.trim())
  if (withGoal.length === 0) {
    return {
      dimensionId: 'goal-coverage', score: 45, severity: 'moderate',
      findings: [`${vals.length} Value(s) defined but none have a Goal set.`, 'Set Goals to enable coverage analysis and IET.'],
      suggestions: [],
    }
  }
  const uncovered = withGoal.filter(v => !sols.some(s => linkedValues(s, [v]).length > 0))
  const covered   = withGoal.length - uncovered.length
  const score     = Math.round((covered / withGoal.length) * 100)
  const severity  = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (uncovered.length === 0) {
    findings.push(`All ${withGoal.length} Value Goal(s) have at least one Solution providing coverage.`)
  } else {
    findings.push(`${uncovered.length} Value Goal(s) have no Solution targeting them — these Goals are currently unreachable: ${uncovered.map(v => v.id).join(', ')}`)
    uncovered.slice(0, 3).forEach(v => {
      suggestions.push({
        id: `gc-cover-${v.id}`,
        description: `Add a Solution whose impactsValues references "${v.id}" — Goal "${v.goal}" is unreachable with current Solutions.`,
        gilbReason: 'CE ch.15 p.421: "The IET must show that combined solution impact reaches Value Goals." An uncovered Goal is a plan gap, not a plan.',
      })
    })
  }
  if (covered > 0 && covered < withGoal.length) {
    findings.push(`${covered} of ${withGoal.length} Value Goals have Solution coverage.`)
  }
  return { dimensionId: 'goal-coverage', score, severity, findings, suggestions }
}

function dim5ResourceFeasibility(spec: SpecBlock): StrategyFinding {
  const sols = spec.solutions ?? []
  const res  = spec.resources ?? []
  if (sols.length === 0) {
    return {
      dimensionId: 'resource-feasibility', score: 40, severity: 'moderate',
      findings: ['No Solution entries — feasibility cannot be assessed.'], suggestions: [],
    }
  }
  const withCost    = sols.filter(s => s.impactsCosts?.trim())
  const withoutCost = sols.filter(s => !s.impactsCosts?.trim())
  let score = 50
  if (res.length > 0 && withCost.length > 0) {
    score = Math.round((withCost.length / sols.length) * 80 + 20)
  } else if (res.length === 0 && withCost.length > 0) {
    score = 60
  } else if (res.length === 0) {
    score = 45
  } else {
    score = Math.round((withCost.length / sols.length) * 80)
  }
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (res.length === 0) {
    findings.push('No Resource entries (R.) defined — budget, timeline, and headcount are unspecified.')
    suggestions.push({
      id: 'rf-add-resources',
      description: 'Add Resource entries (R.) for key budgets: development time, calendar deadline, capital budget.',
      gilbReason: 'CE ch.16: resource constraints must be explicit before Solutions can be feasibility-checked. An over-committed plan fails before it starts.',
    })
  } else {
    findings.push(`${res.length} Resource entry(ies) defined.`)
  }
  if (withCost.length === 0) {
    findings.push(`No Solutions have a cost estimate (impactsCosts is empty on all ${sols.length} Solutions) — V/C ratio computation is impossible.`)
    sols.slice(0, 2).forEach(s => {
      suggestions.push({
        id: `rf-cost-${s.id}`,
        description: `Add impactsCosts to "${s.id}" — estimate resource consumption, e.g. "R.DevBudget ~-15%, R.Timeline ~+2 weeks"`,
        targetEntryId: s.id,
        newFieldValues: { impactsCosts: 'R.Budget ~-NN% (estimate)' },
        gilbReason: 'Value Improvement §5: "Efficiency = Value achieved per unit resource consumed." Without cost, no prioritisation is possible.',
      })
    })
  } else if (withoutCost.length > 0) {
    findings.push(`${withCost.length} of ${sols.length} Solutions have cost estimates; ${withoutCost.length} do not.`)
    withoutCost.slice(0, 2).forEach(s => {
      suggestions.push({
        id: `rf-cost-${s.id}`,
        description: `Add impactsCosts to "${s.id}" to complete V/C ratio data.`,
        targetEntryId: s.id,
        newFieldValues: { impactsCosts: 'R.Budget ~-NN% (estimate)' },
        gilbReason: 'CE ch.16: resource impact must be estimated to evaluate feasibility and ROI.',
      })
    })
  } else {
    findings.push(`All ${sols.length} Solutions have cost estimates — V/C ratio computation is possible.`)
  }
  return { dimensionId: 'resource-feasibility', score: Math.min(100, score), severity, findings, suggestions }
}

function dim6SolutionSpecificity(spec: SpecBlock): StrategyFinding {
  const sols = spec.solutions ?? []
  if (sols.length === 0) {
    return {
      dimensionId: 'solution-specificity', score: 20, severity: 'critical',
      findings: ['No Solution entries.'], suggestions: [],
    }
  }
  const scored  = sols.map(s => ({ s, sc: specificityScore(s.description) }))
  const avg     = Math.round(scored.reduce((t, x) => t + x.sc, 0) / scored.length)
  const vague   = scored.filter(x => x.sc < 40)
  const good    = scored.filter(x => x.sc >= 65)
  const severity = avg < 40 ? 'critical' : avg < 70 ? 'moderate' : avg < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (good.length === sols.length) {
    findings.push(`All ${sols.length} Solutions have specific, actionable descriptions (avg score: ${avg}/100).`)
  } else {
    findings.push(`${good.length} of ${sols.length} Solutions have sufficiently specific descriptions (avg specificity: ${avg}/100).`)
  }
  if (vague.length > 0) {
    findings.push(`${vague.length} Solution(s) have vague or minimal descriptions: ${vague.map(x => x.s.id).join(', ')}`)
    vague.slice(0, 3).forEach(({ s }) => {
      suggestions.push({
        id: `ss-specify-${s.id}`,
        description: `Expand "${s.id}" description to include the mechanism — HOW it works, not just WHAT it does. A new engineer must be able to start without further clarification.`,
        targetEntryId: s.id,
        gilbReason: 'CE Template_Write_Solution: "Description must specify the mechanism, not just the intent." ASPECTS §3: specificity principle.',
      })
    })
  }
  const noFunction = sols.filter(s => !s.function?.trim())
  if (noFunction.length > 0) {
    findings.push(`${noFunction.length} Solution(s) have no linked Function entry — the system capability they deliver is undocumented.`)
    noFunction.slice(0, 2).forEach(s => {
      suggestions.push({
        id: `ss-function-${s.id}`,
        description: `Set the function field of "${s.id}" to the F. entry it implements.`,
        targetEntryId: s.id,
        gilbReason: 'Planguage: a Solution is the means that provides a Function. Without a function link the design hierarchy is broken.',
      })
    })
  }
  return { dimensionId: 'solution-specificity', score: avg, severity, findings, suggestions }
}

function dim7RedundancyDetection(spec: SpecBlock): StrategyFinding {
  const sols = spec.solutions ?? []
  const vals = spec.values    ?? []
  if (sols.length < 2) {
    return {
      dimensionId: 'redundancy-detection', score: 92,
      findings: ['Fewer than 2 Solutions — no redundancy possible.'], suggestions: [],
    }
  }
  type Pair = { a: SEntry; b: SEntry; reason: string }
  const pairs: Pair[] = []
  for (let i = 0; i < sols.length; i++) {
    for (let j = i + 1; j < sols.length; j++) {
      const a = sols[i], b = sols[j]
      const aVals = linkedValues(a, vals)
      const bVals = linkedValues(b, vals)
      const vOverlap = aVals.filter(v => bVals.some(w => w.id === v.id))
      const aWords = new Set(a.description.toLowerCase().split(/\W+/).filter(w => w.length > 4))
      const bWords = new Set(b.description.toLowerCase().split(/\W+/).filter(w => w.length > 4))
      const wOverlap = [...aWords].filter(w => bWords.has(w))
      if (vOverlap.length >= 2 && wOverlap.length >= 3) {
        pairs.push({ a, b, reason: `Both target Values ${vOverlap.map(v => v.id).join(', ')} with similar approach (overlapping terms: ${wOverlap.slice(0, 3).join(', ')})` })
      } else if (vOverlap.length >= 3) {
        pairs.push({ a, b, reason: `Both target ${vOverlap.length} of the same Values: ${vOverlap.map(v => v.id).join(', ')}` })
      }
    }
  }
  const unique = pairs.filter((p, i) => pairs.findIndex(q => q.a.id === p.a.id && q.b.id === p.b.id) === i)
  const score   = Math.max(40, 100 - unique.length * 20)
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (unique.length === 0) {
    findings.push(`No redundant Solution pairs detected across ${sols.length} Solutions.`)
  } else {
    findings.push(`${unique.length} potentially redundant Solution pair(s) found.`)
    unique.slice(0, 3).forEach(p => {
      findings.push(`"${p.a.id}" and "${p.b.id}": ${p.reason}`)
      suggestions.push({
        id: `rd-review-${p.a.id}-${p.b.id}`,
        description: `Review "${p.a.id}" and "${p.b.id}" for consolidation — significant overlap detected. Merge into one stronger Solution, or differentiate their scope explicitly.`,
        gilbReason: 'CE KISS ch.12: "Never implement two solutions to the same problem unless you have evidence both are necessary." EVO 2024 §2.',
      })
    })
  }
  return { dimensionId: 'redundancy-detection', score, severity, findings, suggestions }
}

function dim8DependencyOrdering(spec: SpecBlock): StrategyFinding {
  const sols = spec.solutions ?? []
  if (sols.length < 2) {
    return {
      dimensionId: 'dependency-ordering', score: 88,
      findings: ['Fewer than 2 Solutions — no dependency ordering applicable.'], suggestions: [],
    }
  }
  const DEP_RE = /\b(depends?\s+on|requires?|needs?|after\s+|following|assumes?|builds?\s+on|once|pre-?requisite|enabled\s+by|based\s+on)\b/i
  const flagged: Array<{ s: SEntry; reason: string }> = []
  sols.forEach(s => {
    const desc = s.description.toLowerCase()
    if (DEP_RE.test(desc)) {
      flagged.push({ s, reason: 'Contains dependency language — ordering constraint should be documented explicitly.' })
    }
    sols.filter(o => o.id !== s.id).forEach(other => {
      if (desc.includes(other.id.toLowerCase())) {
        flagged.push({ s, reason: `References "${other.id}" — if this is a dependency, the delivery order must be defined.` })
      }
    })
  })
  const unique = flagged.filter((x, i) => flagged.findIndex(y => y.s.id === x.s.id) === i)
  const score   = Math.max(50, 100 - unique.length * 15)
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (unique.length === 0) {
    findings.push(`No implicit dependency language detected — Solutions appear independently deliverable.`)
    findings.push(`Note: dependencies may still exist but not be expressed in descriptions — verify manually.`)
  } else {
    findings.push(`${unique.length} Solution(s) contain dependency or ordering language.`)
    unique.slice(0, 3).forEach(({ s, reason }) => {
      findings.push(`"${s.id}": ${reason}`)
      suggestions.push({
        id: `do-document-${s.id}`,
        description: `Explicitly document the dependency constraint in "${s.id}" — name the prerequisite Solution and the delivery ordering rule.`,
        targetEntryId: s.id,
        gilbReason: 'EVO 2024 ch.2 Steps 4–5: "Decompose before Prioritise. Dependencies define the partial order." Delivering a dependent Solution before its dependency creates waste.',
      })
    })
  }
  return { dimensionId: 'dependency-ordering', score, severity, findings, suggestions }
}

function dim9PastSharpeningPatterns(spec: SpecBlock, rounds: SharpenRound[]): StrategyFinding {
  if (!rounds || rounds.length === 0) {
    return {
      dimensionId: 'past-sharpening-patterns', score: 50, severity: 'advisory',
      findings: [
        'No past sharpening rounds recorded — this is the first analysis.',
        'After completing sharpening cycles, this dimension reveals structural recurring weaknesses.',
      ],
      suggestions: [{
        id: 'psp-first-run',
        description: 'Complete at least one Solution Sharpening cycle to generate pattern data for this dimension.',
        gilbReason: 'EVO 2024 Step 9 (Learn): "The Learn step updates the plan based on measured results and identified patterns."',
      }],
    }
  }
  const allChanges = rounds.flatMap(r => r.changes ?? [])
  const sChanges   = allChanges.filter(c => c.entryType === 'S')
  const fieldFreq: Record<string, number> = {}
  sChanges.forEach(c => {
    c.changedFields?.forEach(f => { fieldFreq[f] = (fieldFreq[f] ?? 0) + 1 })
  })
  const entryFreq: Record<string, number> = {}
  sChanges.forEach(c => { entryFreq[c.id] = (entryFreq[c.id] ?? 0) + 1 })
  const recurringEntries = Object.entries(entryFreq).filter(([, n]) => n >= 2)
  const topFields = Object.entries(fieldFreq).sort(([, a], [, b]) => b - a).slice(0, 3)
  const score = Math.min(90, Math.max(30, 55 + rounds.length * 8 - recurringEntries.length * 12))
  const severity = score < 40 ? 'critical' : score < 70 ? 'moderate' : 'advisory'
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  findings.push(`${rounds.length} sharpening round(s) recorded — ${sChanges.length} Solution entry changes total.`)
  if (topFields.length > 0) {
    findings.push(`Most frequently modified fields: ${topFields.map(([f, n]) => `${f} (${n}×)`).join(', ')} — these fields are structurally weak.`)
  }
  if (recurringEntries.length > 0) {
    findings.push(`Solutions sharpened in multiple rounds (structural weakness signals): ${recurringEntries.map(([id, n]) => `${id} (${n}×)`).join(', ')}`)
    recurringEntries.slice(0, 2).forEach(([id]) => {
      suggestions.push({
        id: `psp-structural-${id}`,
        description: `"${id}" has been sharpened ${entryFreq[id]}× — investigate whether it needs fundamental redesign rather than incremental refinement.`,
        targetEntryId: id,
        gilbReason: 'EVO 2024 Step 9: a pattern across multiple sharpenings reveals a structural problem that one-off fixes cannot cure. Understanding the pattern enables a systemic solution.',
      })
    })
  }
  if (recurringEntries.length === 0 && sChanges.length > 0) {
    findings.push('No Solution appears in more than one round — no structural recurring weakness pattern detected.')
  }
  return {
    dimensionId: 'past-sharpening-patterns',
    score: Math.max(0, Math.min(100, score)),
    severity,
    findings,
    suggestions,
  }
}

function dim10StrategyCompleteness(spec: SpecBlock): StrategyFinding {
  const vals = spec.values    ?? []
  const sols = spec.solutions ?? []
  if (vals.length === 0) {
    return {
      dimensionId: 'strategy-completeness', score: 10, severity: 'critical',
      findings: ['No Value entries — completeness cannot be assessed.'], suggestions: [],
    }
  }
  const unaddressed = vals.filter(v => !sols.some(s => linkedValues(s, [v]).length > 0))
  const addressed   = vals.length - unaddressed.length
  const score       = Math.round((addressed / vals.length) * 100)
  const severity    = score < 40 ? 'critical' : score < 70 ? 'moderate' : score < 90 ? 'advisory' : undefined
  const findings: string[] = []
  const suggestions: StrategyImprovement[] = []
  if (unaddressed.length === 0) {
    findings.push(`All ${vals.length} Value entries have at least one Solution providing coverage — strategy is complete.`)
  } else {
    findings.push(`${unaddressed.length} Value(s) have no Solution targeting them: ${unaddressed.map(v => v.id).join(', ')}`)
    unaddressed.slice(0, 3).forEach(v => {
      suggestions.push({
        id: `sc-cover-${v.id}`,
        description: `Add a Solution whose impactsValues references "${v.id}" — this stakeholder need is currently ignored by every design decision in the plan.`,
        gilbReason: 'CE ch.15: "Every Value must have at least one Solution with confirmed positive impact." An unaddressed Value is a stakeholder need the plan explicitly ignores.',
      })
    })
  }
  if (addressed > 0 && addressed < vals.length) {
    findings.push(`${addressed} of ${vals.length} Values have Solution coverage.`)
  }
  return { dimensionId: 'strategy-completeness', score, severity, findings, suggestions }
}

// ── Main Analysis Entry Point ─────────────────────────────────────────────────

/**
 * Analyse the spec against all 10 dimensions and return a full result.
 * Pure function — no side effects.
 */
export function analyzeSpec(spec: SpecBlock, rounds: SharpenRound[]): StrategyAnalysisResult {
  const dims: StrategyFinding[] = [
    dim1ValueTraceability(spec),
    dim2ImpactQuantification(spec),
    dim3ConstraintCompliance(spec),
    dim4GoalCoverage(spec),
    dim5ResourceFeasibility(spec),
    dim6SolutionSpecificity(spec),
    dim7RedundancyDetection(spec),
    dim8DependencyOrdering(spec),
    dim9PastSharpeningPatterns(spec, rounds),
    dim10StrategyCompleteness(spec),
  ]

  // Weighted average — goal-coverage (dim4) and value-traceability (dim1) weight double
  const weights     = [2, 1, 1, 2, 1, 1, 1, 1, 1, 1]
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const overallScore = Math.round(
    dims.reduce((sum, d, i) => sum + d.score * weights[i], 0) / totalWeight
  )

  // Top 3 priorities: lowest-scoring dimensions with at least one suggestion
  const topPriority = [...dims]
    .filter(d => (d.suggestions?.length ?? 0) > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(d => {
      const def = STRATEGY_SHARPEN_DIMENSIONS.find(x => x.id === d.dimensionId)
      const sug = d.suggestions?.[0]
      return sug
        ? `${def?.label ?? d.dimensionId}: ${sug.description}`
        : `Improve ${def?.label ?? d.dimensionId} (score: ${d.score}/100)`
    })

  return { generatedAt: new Date().toISOString(), overallScore, dimensions: dims, topPriority }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useStrategySharpen() {
  const dimensionScore = computed(() => {
    if (!_result.value) return {} as Record<string, number>
    return Object.fromEntries(_result.value.dimensions.map(d => [d.dimensionId, d.score]))
  })

  const dimensionFinding = computed(() => {
    if (!_result.value) return {} as Record<string, StrategyFinding>
    return Object.fromEntries(_result.value.dimensions.map(d => [d.dimensionId, d]))
  })

  function runAnalysis(spec: SpecBlock, rounds: SharpenRound[]) {
    _result.value      = analyzeSpec(spec, rounds)
    _approvedIds.value = new Set()
  }

  function toggleApproval(id: string) {
    const next = new Set(_approvedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    _approvedIds.value = next
  }

  function approveAll() {
    const ids: string[] = []
    if (_result.value) {
      for (const dim of _result.value.dimensions) {
        for (const sug of dim.suggestions ?? []) ids.push(sug.id)
      }
    }
    _approvedIds.value = new Set(ids)
  }

  function getApprovedImprovements(): StrategyImprovement[] {
    if (!_result.value) return []
    return _result.value.dimensions.flatMap(d =>
      (d.suggestions ?? []).filter(s => _approvedIds.value.has(s.id))
    )
  }

  function clearResult() {
    _result.value      = null
    _approvedIds.value = new Set()
  }

  return {
    result:         _result,
    approvedIds:    _approvedIds,
    dimensionScore,
    dimensionFinding,
    runAnalysis,
    toggleApproval,
    approveAll,
    getApprovedImprovements,
    clearResult,
  }
}
