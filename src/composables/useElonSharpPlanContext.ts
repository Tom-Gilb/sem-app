// UNIT_TYPE=Composable
// useElonSharpPlanContext.ts — Plan-derived starter answers for Elon Sharpening questions.
//
// For each Sharpening question, look at actual spec data and produce a context-aware
// suggestion that NAMES specific entries / counts / gaps. These get the 'plan' provenance
// badge (highest provenance per Conjunction-of-Technologies SUPREME rule).

import type { SpecBlock, REntry } from '../types/spec'
import type { SourceProvenance } from '../data/aiSource'

const P = (note: string): SourceProvenance => ({ source: 'plan', note })

export interface PlanDerivedSuggestion {
  questionId: string
  text:        string
  provenance:  SourceProvenance
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/[^0-9.\-eE]/g, ''))
  return isFinite(n) ? n : null
}

// ── Per-question plan-derivation logic ─────────────────────────────────────

/** Pace — pace-current-cadence: detect existing cycle-time V. or absence. */
function derivePaceCurrentCadence(spec: SpecBlock): PlanDerivedSuggestion | null {
  const paceV = (spec.values ?? []).find(v => {
    const tag = `${v.id} ${v.scale ?? ''} ${v.description ?? ''}`.toLowerCase()
    return tag.includes('cycle') || tag.includes('pace') || tag.includes('release') || tag.includes('cadence')
  })
  if (!paceV) {
    return {
      questionId: 'pace-current-cadence',
      text: 'Your Plan has NO Value tracking cycle time / pace of innovation — the FIRST plan-derived signal of the DOMINANT-Requirement violation (Dove p. 8). Recommendation: add a Cycle Time Value with Scale = "days between user-facing releases", Goal = 14 days, Wish = 1 day (continuous).',
      provenance: P('Plan-derived: zero pace/cycle/release Value entries detected'),
    }
  }
  const goalN = parseNum(paceV.goal)
  return {
    questionId: 'pace-current-cadence',
    text: `Your Plan has ${paceV.id} (Scale: ${paceV.scale || '?'}, Goal: ${paceV.goal || '?'}). ${goalN !== null && goalN >= 90 ? 'Goal is quarterly-or-slower — flagged as PACE TOO SLOW. ' : ''}Compare against Tesla benchmark (60 changes/day — Dove p. 6) and dominant-requirement framing.`,
    provenance: P(`Plan-derived: ${paceV.id} tracks pace; Goal ${paceV.goal}`),
  }
}

/** Pace — pace-bottleneck: find a slow Constraint that might be the bottleneck. */
function derivePaceBottleneck(spec: SpecBlock): PlanDerivedSuggestion | null {
  const slowC = (spec.constraints ?? []).find(c => {
    const corpus = `${c.description ?? ''} ${c.rationale ?? ''}`.toLowerCase()
    return ['quarterly', 'monthly', 'manual', 'sign-off', 'approval'].some(k => corpus.includes(k))
  })
  if (!slowC) return null
  return {
    questionId: 'pace-bottleneck',
    text: `Your Plan has ${slowC.id} which mentions quarterly/monthly/manual/sign-off language — likely a pace bottleneck. Apply Musk Steps 1-2 to ${slowC.id}: (1) who specifically asked for this? (2) can we delete it (or replace with an automated equivalent that runs daily, not quarterly)?`,
    provenance: P(`Plan-derived: ${slowC.id} contains slow-cadence keywords`),
  }
}

/** Innovation — innovation-new-capability: list current Functions. */
function deriveInnovationCapability(spec: SpecBlock): PlanDerivedSuggestion | null {
  const fns = spec.functions ?? []
  if (fns.length === 0) return null
  return {
    questionId: 'innovation-new-capability',
    text: `Your Plan currently has ${fns.length} Function entries: ${fns.slice(0, 5).map(f => f.id).join(', ')}${fns.length > 5 ? `… (+${fns.length - 5} more)` : ''}. Which of these would be NEW capabilities the product did NOT have last quarter? Innovation = net-new capability category, not faster/cheaper of existing.`,
    provenance: P(`Plan-derived: ${fns.length} Function entries — distinguish new vs refinement`),
  }
}

/** Incremental — ii-current-rate: count V. entries with measured Status. */
function deriveIncrementalRate(spec: SpecBlock): PlanDerivedSuggestion | null {
  const vWithStatus = (spec.values ?? []).filter(v => v.status && v.status.trim().length > 0)
  if (vWithStatus.length === 0) return null
  return {
    questionId: 'ii-current-rate',
    text: `Your Plan has ${vWithStatus.length} Value entries with measured Status: ${vWithStatus.slice(0, 3).map(v => v.id).join(', ')}. Use these as the impact-tracking baseline. Tesla benchmark: 60 measured changes/day (Dove p. 6). Your improvement rate goal should reference this.`,
    provenance: P(`Plan-derived: ${vWithStatus.length} V. entries with Status — impact-tracking baseline`),
  }
}

/** Pace of Learning — pol-current-loop-time: detect telemetry/feedback language. */
function deriveLearningLoopTime(spec: SpecBlock): PlanDerivedSuggestion | null {
  const learningKws = ['telemetry', 'feedback', 'observation', 'metric', 'analytics']
  let found = 0
  for (const v of spec.values ?? []) {
    const corpus = `${v.description ?? ''} ${v.scale ?? ''} ${v.meter ?? ''}`.toLowerCase()
    if (learningKws.some(k => corpus.includes(k))) found++
  }
  if (found === 0) {
    return {
      questionId: 'pol-current-loop-time',
      text: 'Your Plan has NO V. entries mentioning telemetry / feedback / observation / metric / analytics. Without instrumented learning, observation → spec change cycle is unmeasurable. Add a Learning Cycle Time Value first.',
      provenance: P('Plan-derived: 0 V. entries with telemetry/feedback/observation language'),
    }
  }
  return {
    questionId: 'pol-current-loop-time',
    text: `Your Plan has ${found} V. entries with telemetry/feedback/metric language — partial instrumentation. Next: measure days from signal to spec edit; aim for ≤ 3 days (Dove p. 6-7 DSM instant-loop pattern).`,
    provenance: P(`Plan-derived: ${found} V. entries with feedback-loop language`),
  }
}

/** Safety — safety-irreversibility: scan corpus for safety-critical domain keywords. */
function deriveSafetyDomain(spec: SpecBlock): PlanDerivedSuggestion | null {
  const safetyKws = ['vehicle', 'medical', 'patient', 'human', 'lives', 'financial', 'payment']
  const corpus: string[] = []
  for (const v of spec.values ?? [])      corpus.push(v.description ?? '', v.scale ?? '')
  for (const f of spec.functions ?? [])   corpus.push(f.description ?? '')
  for (const s of spec.solutions ?? [])   corpus.push(s.description ?? '')
  for (const c of spec.constraints ?? []) corpus.push(c.description ?? '')
  const combined = corpus.join(' ').toLowerCase()
  const matches = safetyKws.filter(k => combined.includes(k))
  if (matches.length === 0) return null
  return {
    questionId: 'safety-irreversibility',
    text: `Your Plan touches safety-critical domain keywords: ${matches.join(', ')}. Safety findings escalate to CRITICAL severity per the irreversibility rule. List 3 highest-blast-radius failure modes; name the safeguard for each.`,
    provenance: P(`Plan-derived: safety-critical-domain match (${matches.length} keyword(s))`),
  }
}

/** Destiny Control — dc-critical-suppliers: list R. with supplier language. */
function deriveDestinySuppliers(spec: SpecBlock): PlanDerivedSuggestion | null {
  const externalKws = ['supplier', 'vendor', 'third-party', 'third party', 'external', 'outsourced', 'licensed']
  const externalRs = (spec.resources ?? []).filter(r => {
    const corpus = `${r.description ?? ''} ${(r as REntry).rationale ?? ''}`.toLowerCase()
    return externalKws.some(k => corpus.includes(k))
  })
  if (externalRs.length === 0) return null
  return {
    questionId: 'dc-critical-suppliers',
    text: `Your Plan has ${externalRs.length} external-dependency Resource(s): ${externalRs.slice(0, 3).map(r => r.id).join(', ')}. For each, ask: what is the supplier's release cadence? If slower than your Plan's cadence, the supplier caps your pace. Roadmap in-house OR alternate-source alternatives (Musk's Methods p. 66).`,
    provenance: P(`Plan-derived: ${externalRs.length} R. entries with supplier/vendor/external language`),
  }
}

/** Destiny Control — dc-jurisdiction: detect any jurisdiction keyword. */
function deriveDestinyJurisdiction(spec: SpecBlock): PlanDerivedSuggestion | null {
  const jurisdKws = ['delaware', 'texas', 'california', 'florida', 'ireland', 'eu', 'gdpr', 'singapore', 'incorporated']
  const corpus: string[] = []
  for (const c of spec.constraints ?? []) corpus.push(c.description ?? '', c.rationale ?? '')
  for (const r of spec.resources ?? [])   corpus.push(r.description ?? '', (r as REntry).rationale ?? '')
  const combined = corpus.join(' ').toLowerCase()
  const matches = jurisdKws.filter(k => combined.includes(k))
  if (matches.length === 0) {
    return {
      questionId: 'dc-jurisdiction',
      text: 'Your Plan does NOT name any legal jurisdiction (Delaware / Texas / California / EU / Singapore / etc.) anywhere. Silent single-jurisdiction commitment is a destiny-control risk. Name your primary AND an alternative (Musk\'s Methods p. 66 — SpaceX runs Florida AND Texas).',
      provenance: P('Plan-derived: 0 jurisdiction keywords detected anywhere in spec'),
    }
  }
  return {
    questionId: 'dc-jurisdiction',
    text: `Your Plan names ${matches.length} jurisdiction(s): ${matches.join(', ')}. Verify: is there an explicit ALTERNATIVE jurisdiction named for fallback? Single-jurisdiction commitment is silent destiny-control risk.`,
    provenance: P(`Plan-derived: ${matches.length} jurisdiction keyword(s) found`),
  }
}

/** Reusability — re-shared-components: count S. entries with shared/reuse language. */
function deriveReusabilityShared(spec: SpecBlock): PlanDerivedSuggestion | null {
  const reuseKws = ['reuse', 'shared', 'common', 'platform', 'library']
  const reused = (spec.solutions ?? []).filter(s => {
    const corpus = `${s.description ?? ''}`.toLowerCase()
    return reuseKws.some(k => corpus.includes(k))
  })
  const total = (spec.solutions ?? []).length
  if (total === 0) return null
  const pct = Math.round((reused.length / total) * 100)
  return {
    questionId: 're-shared-components',
    text: `Your Plan has ${reused.length}/${total} Solutions (${pct}%) using shared/common/platform/library language. Tesla brain (p. 98) is reused across cars + Optimus. Target: ≥ 60% shared.`,
    provenance: P(`Plan-derived: ${reused.length}/${total} Solutions tagged as reused`),
  }
}

/** Modularization — mod-interface-stability: detect modular language in S. entries. */
function deriveModularization(spec: SpecBlock): PlanDerivedSuggestion | null {
  const modKws = ['modular', 'module', 'interface', 'plug-and-play']
  const modular = (spec.solutions ?? []).filter(s => {
    const corpus = `${s.description ?? ''}`.toLowerCase()
    return modKws.some(k => corpus.includes(k))
  })
  if (modular.length === 0) {
    return {
      questionId: 'mod-interface-stability',
      text: 'Your Plan does NOT name modular / module / interface / plug-and-play anywhere in Solutions. Dove p. 5: modular architecture is "a dominant mental pattern at Tesla". Without it, parallel evolution is impossible.',
      provenance: P('Plan-derived: 0 Solutions with modular/interface language'),
    }
  }
  return {
    questionId: 'mod-interface-stability',
    text: `Your Plan has ${modular.length} Solutions with modular/interface language: ${modular.slice(0, 3).map(s => s.id).join(', ')}. Are these interfaces VERSIONED (semver) and BACKWARD-COMPATIBLE? Musk\'s Methods p. 27-28 stable-interface principle.`,
    provenance: P(`Plan-derived: ${modular.length} Solutions with modular language`),
  }
}

/** Management Automatedness — ma-automation-fraction: count approval-Constraints. */
function deriveMgmtApprovals(spec: SpecBlock): PlanDerivedSuggestion | null {
  const apprC = (spec.constraints ?? []).filter(c => {
    const corpus = `${c.description ?? ''} ${c.rationale ?? ''}`.toLowerCase()
    return corpus.includes('approval') || corpus.includes('sign-off')
  })
  if (apprC.length === 0) return null
  return {
    questionId: 'ma-automation-fraction',
    text: `Your Plan has ${apprC.length} Constraint(s) referencing approval/sign-off: ${apprC.slice(0, 3).map(c => c.id).join(', ')}. Dove p. 6-7: "why would we ever ask a human to decide this?!" Audit each — is it routine (automate) or genuinely exceptional (route to human)?`,
    provenance: P(`Plan-derived: ${apprC.length} approval-referencing Constraints`),
  }
}

/** Testing Automation — ta-coverage: detect testing language anywhere. */
function deriveTestingAutomation(spec: SpecBlock): PlanDerivedSuggestion | null {
  const testKws = ['automated test', 'ci', 'continuous integration', 'regression', 'self-certify']
  let found = 0
  for (const v of spec.values ?? [])    if (testKws.some(k => (`${v.description ?? ''} ${v.scale ?? ''}`.toLowerCase()).includes(k))) found++
  for (const s of spec.solutions ?? []) if (testKws.some(k => (`${s.description ?? ''}`.toLowerCase()).includes(k))) found++
  if (found === 0) {
    return {
      questionId: 'ta-coverage',
      text: 'Your Plan has NO entries referencing automated test / CI / regression / self-certify. Tesla cars self-certify against NHTSA in-factory (Dove p. 6). Add a Testing Automation Value first.',
      provenance: P('Plan-derived: 0 entries with testing-automation language'),
    }
  }
  return {
    questionId: 'ta-coverage',
    text: `Your Plan has ${found} entr${found === 1 ? 'y' : 'ies'} with testing-automation language. Verify: what is the coverage % and test cycle time? Target: 95% coverage, ≤ 10 min cycle (Musk\'s Methods p. 99-100 — 11 levels of filters).`,
    provenance: P(`Plan-derived: ${found} entries with testing-automation language`),
  }
}

/** Governance — gov-decision-rights: detect unnamed Constraints. */
function deriveGovernanceUnnamed(spec: SpecBlock): PlanDerivedSuggestion | null {
  const unnamed = (spec.constraints ?? []).filter(c => {
    const corpus = `${c.description ?? ''} ${c.rationale ?? ''}`
    return !/source\s*:|named by|requested by|asked by|owner\s*:/i.test(corpus)
  })
  if (unnamed.length === 0) return null
  return {
    questionId: 'gov-decision-rights',
    text: `Your Plan has ${unnamed.length} Constraint(s) without a named asker: ${unnamed.slice(0, 3).map(c => c.id).join(', ')}${unnamed.length > 3 ? `… (+${unnamed.length - 3} more)` : ''}. Musk\'s Methods p. 2 Step 1: name the person (NOT the department). Governance integrity = named owners.`,
    provenance: P(`Plan-derived: ${unnamed.length} C. entries lack Source: tag`),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

const DERIVERS: Array<(spec: SpecBlock) => PlanDerivedSuggestion | null> = [
  derivePaceCurrentCadence,
  derivePaceBottleneck,
  deriveInnovationCapability,
  deriveIncrementalRate,
  deriveLearningLoopTime,
  deriveSafetyDomain,
  deriveDestinySuppliers,
  deriveDestinyJurisdiction,
  deriveReusabilityShared,
  deriveModularization,
  deriveMgmtApprovals,
  deriveTestingAutomation,
  deriveGovernanceUnnamed,
]

/**
 * Run every plan-derivation function against the supplied spec.
 * Returns a Map keyed by questionId → plan-derived suggestion (or absent if null).
 */
export function generatePlanDerivedSuggestions(
  spec: SpecBlock | null,
): Map<string, PlanDerivedSuggestion> {
  const out = new Map<string, PlanDerivedSuggestion>()
  if (!spec) return out
  for (const fn of DERIVERS) {
    const s = fn(spec)
    if (s) out.set(s.questionId, s)
  }
  return out
}
