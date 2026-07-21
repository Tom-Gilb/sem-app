// UNIT_TYPE=Composable
// useIncorruptibleSharpPlanContext.ts — Phase 2b: plan-derived starter answers for
// Incorruptible Sharpening questions.
//
// Tom Gilb 2026-06-11 (breakfast): "don't be shy. I want it all" — Phase 2b shipped.
//
// For each Sharpening question, look at the actual spec data and produce a context-aware
// suggestion that NAMES specific entries / counts / gaps. These get the 'plan' provenance
// badge (highest provenance per Conjunction-of-Technologies SUPREME rule) — the user sees
// at a glance which suggestions come from THEIR plan vs from generic templates.
//
// Composes with:
//   - AI-Max (every blank field gets a starter; plan-derived > template > LLM)
//   - Conjunction-of-Technologies (Plan as highest-provenance source layer)
//   - useIncorruptibleSharpSynthesis (synthesised findings inherit the source layer)
//   - useIncorruptibleFindings (deterministic detectors reused here for plan-context)

import type { SpecBlock, VEntry, REntry } from '../types/spec'
import type { SourceProvenance } from '../data/aiSource'

const P = (note: string): SourceProvenance => ({ source: 'plan', note })

/** A plan-derived suggestion for a specific Sharpening question. */
export interface PlanDerivedSuggestion {
  questionId: string
  /** The starter answer text, naming specific spec entries. */
  text:        string
  provenance:  SourceProvenance
}

/** Parse a numeric value level (Goal/Tolerable/Wish). */
function parseNum(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/[^0-9.\-eE]/g, ''))
  return isFinite(n) ? n : null
}

/** Approximate months-from-now for a Goal-When / Wish-When string. */
function whenMonths(s: string | undefined): number | null {
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})/)
  if (iso) {
    const target = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, 1)
    return Math.round((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
  }
  const q = s.match(/^(\d{4})-?Q([1-4])$/i)
  if (q) {
    const target = new Date(parseInt(q[1], 10), (parseInt(q[2], 10) - 1) * 3, 1)
    return Math.round((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44))
  }
  return null
}

// ── Per-question plan-derivation logic ─────────────────────────────────────

/** Quarterly Tyranny — qt-wish-recovery: name a V. with short Goal-When and no Wish. */
function deriveQtWishRecovery(spec: SpecBlock): PlanDerivedSuggestion | null {
  const candidates = (spec.values ?? []).filter(v => {
    const m = whenMonths(v.goalWhen)
    const wm = whenMonths(v.wishWhen)
    return m !== null && m > 0 && m <= 12 && (wm === null || wm < 36)
  })
  if (candidates.length === 0) return null
  const v = candidates[0]
  const goalN = parseNum(v.goal)
  const unsanded = goalN !== null ? `${(goalN * 2).toFixed(0)} or higher` : 'a transformational ambition level'
  return {
    questionId: 'qt-wish-recovery',
    text: `For ${v.id} (Goal ${v.goal || '?'} by ${v.goalWhen || 'unspecified'}): accept the short-horizon Goal IF Wish becomes "${unsanded}" by 2031 — your Plan has this Value flagged by the deterministic engine as missing its long-horizon counterweight.`,
    provenance: P(`Plan-derived: ${v.id} has Goal-When ≤ 12 months with no Wish-When ≥ 36 months`),
  }
}

/** Quarterly Tyranny — qt-meter-multiyear: find V. without multi-year meter aggregation. */
function deriveQtMeterMultiyear(spec: SpecBlock): PlanDerivedSuggestion | null {
  const v = (spec.values ?? []).find(v => {
    const m = (v.meter ?? '').toLowerCase()
    return v.meter && !m.includes('trailing') && !m.includes('multi-year') && !m.includes('cohort') && !m.includes('rolling')
  })
  if (!v) return null
  return {
    questionId: 'qt-meter-multiyear',
    text: `For ${v.id}: extend the current Meter ("${v.meter}") with a trailing-36-month aggregate recorded each quarter but never reset. Quarterly Status reports both this quarter's value AND the 3-year-cumulative for comparison — surfaces trajectory, not just quarterly wobble.`,
    provenance: P(`Plan-derived: ${v.id} has no multi-year aggregation in its Meter`),
  }
}

/** Stakeholder Monoculture — sm-future-user: if no future/community/environment stakeholder. */
function deriveSmFutureUser(spec: SpecBlock): PlanDerivedSuggestion | null {
  const names = [
    ...((spec.stakeholderEntries ?? []).map(s => s.id.toLowerCase())),
    ...((spec.stakes ?? '').toLowerCase().split(',').map(s => s.trim())),
  ].filter(Boolean)
  const keywords = ['future', 'generation', 'community', 'environment', 'employee', 'next decade']
  const hasLongHorizon = keywords.some(k => names.some(n => n.includes(k)))
  if (hasLongHorizon) return null
  const planName = 'this Plan'
  return {
    questionId: 'sm-future-user',
    text: `Your Plan currently has ${names.length} stakeholder(s), all short-horizon. Future Generation User (2036): A 14-year-old in 2036 whose data ${planName} has been collecting for 10 years. They had no voice in 2026 privacy decisions but live with the consequences. Their interest: data minimisation, deletion-on-request, no aggregation that locks them in.`,
    provenance: P(`Plan-derived: ${names.length} stakeholders found, zero long-horizon`),
  }
}

/** Stakeholder Monoculture — sm-inanimate-needs: detect missing regulatory stakeholders. */
function deriveSmInanimateNeeds(spec: SpecBlock): PlanDerivedSuggestion | null {
  const sNames = [
    ...((spec.stakeholderEntries ?? []).map(s => s.id.toLowerCase())),
    ...((spec.stakes ?? '').toLowerCase().split(',').map(s => s.trim())),
  ].filter(Boolean)
  const cText = (spec.constraints ?? []).map(c => (c.description ?? '').toLowerCase()).join(' ')
  const hasGdpr = sNames.some(n => n.includes('gdpr')) || cText.includes('gdpr')
  const hasAiAct = cText.includes('ai act') || cText.includes('ai-act')
  const missing: string[] = []
  if (!hasGdpr) missing.push('GDPR (EU data regulator) — binary rule on personal data transfer outside EEA')
  if (!hasAiAct) missing.push('EU AI Act (2026+) — binary rule on AI-assisted decisions affecting individuals')
  if (missing.length === 0) return null
  return {
    questionId: 'sm-inanimate-needs',
    text: `Your Plan does not currently name these regulatory stakeholders that may apply: ${missing.join('; ')}. Each becomes a C. entry binding the relevant features. Confirm jurisdiction before locking.`,
    provenance: P(`Plan-derived: detected ${missing.length} missing regulatory stakeholder(s)`),
  }
}

/** Mission Drift — md-charter-text: detect if no C. references mission/charter. */
function deriveMdCharterText(spec: SpecBlock): PlanDerivedSuggestion | null {
  const hasMissionC = (spec.constraints ?? []).some(c => {
    const d = (c.description ?? '').toLowerCase()
    return d.includes('mission') || d.includes('charter') || d.includes('purpose')
  })
  if (hasMissionC) return null
  return {
    questionId: 'md-charter-text',
    text: `Your Plan has no Constraint entry referencing "mission", "charter", or "purpose". Honest interim: "No formal charter exists yet. Pre-condition: the founding team writes one before the next review cadence. Until then, the Plan operates under a 'no-irreversible-decisions' interim constraint."`,
    provenance: P('Plan-derived: zero mission-lock C. entries found'),
  }
}

/** Mission Drift — md-violation-test: list potential tests based on existing C. entries. */
function deriveMdViolationTest(spec: SpecBlock): PlanDerivedSuggestion | null {
  const cCount = (spec.constraints ?? []).length
  if (cCount === 0) return null
  const sampleC = (spec.constraints ?? [])[0]
  return {
    questionId: 'md-violation-test',
    text: `Your Plan has ${cCount} Constraint(s). Build the violation test on the most mission-relevant of them. Example with your "${sampleC.id}": any quarterly Goal trade-off that materially weakens "${sampleC.description ?? sampleC.id}" by >10% without an explicit Plan-level approval triggers a Mission Review with all stakeholders present.`,
    provenance: P(`Plan-derived: based on existing Constraint ${sampleC.id}`),
  }
}

/** Founder-Vision Erosion — fv-unsanded-wish: find V. where Wish ≈ Goal. */
function deriveFvUnsandedWish(spec: SpecBlock): PlanDerivedSuggestion | null {
  const target = (spec.values ?? []).find((v: VEntry) => {
    const g = parseNum(v.goal)
    const w = parseNum(v.wish ?? '')
    return g !== null && w !== null && g > 0 && w < g * 1.5
  })
  if (!target) return null
  const goalN = parseNum(target.goal)
  const wishN = parseNum(target.wish ?? '')
  const proposed = goalN !== null ? `${(goalN * 2).toFixed(0)}` : 'a 2-3× ambition'
  return {
    questionId: 'fv-unsanded-wish',
    text: `${target.id} un-sanded: current Wish (${wishN}) is only ${goalN ? ((wishN! / goalN)).toFixed(2) : '?'}× the Goal (${goalN}). The unsanded version: Wish ${proposed} or higher — what was the original ambition before the board, the budget, or the investors sanded it down?`,
    provenance: P(`Plan-derived: ${target.id} has Wish < 1.5× Goal (Wish ≈ Goal pattern)`),
  }
}

/** Founder-Vision Erosion — fv-board-pressure-log: honest "I can't name one but…". */
function deriveFvBoardPressureLog(spec: SpecBlock): PlanDerivedSuggestion | null {
  const sandedCount = (spec.values ?? []).filter(v => {
    const g = parseNum(v.goal)
    const w = parseNum(v.wish ?? '')
    return g !== null && w !== null && w < g * 1.5
  }).length
  if (sandedCount === 0) return null
  return {
    questionId: 'fv-board-pressure-log',
    text: `Your Plan currently shows ${sandedCount} Value(s) with Wish ≈ Goal (already-sanded pattern). No past sanding events were named in the spec history, but the present state suggests sanding has happened or is happening. Pull the founder/charter author into one room and ask which Wishes feel safe vs ambitious.`,
    provenance: P(`Plan-derived: ${sandedCount} already-sanded Value(s) detected`),
  }
}

/** Innovation-Budget Predation — ib-recent-predation: check R. entries for innovation tag. */
function deriveIbRecentPredation(spec: SpecBlock): PlanDerivedSuggestion | null {
  const resources = (spec.resources ?? []) as REntry[]
  const innovTagged = resources.filter(r => {
    const t = `${r.id} ${r.description ?? ''}`.toLowerCase()
    return t.includes('innovation') || t.includes('r&d') || t.includes('research') || t.includes('explore')
  })
  if (innovTagged.length > 0) return null  // already tracked
  if (resources.length === 0) return null
  return {
    questionId: 'ib-recent-predation',
    text: `Your Plan has ${resources.length} Resource(s) but NONE tagged for innovation / R&D / exploration. No predation event can be tracked yet because no R&D Resource exists. Recommendation: add a "Long-Term Innovation Floor" R. entry at ≥10% of total budget, with C. constraint forbidding mid-quarter reallocation.`,
    provenance: P(`Plan-derived: ${resources.length} Resources, 0 innovation-tagged`),
  }
}

/** Innovation-Budget Predation — ib-explore-vs-exploit: compute current split. */
function deriveIbExploreVsExploit(spec: SpecBlock): PlanDerivedSuggestion | null {
  const resources = (spec.resources ?? []) as REntry[]
  if (resources.length === 0) return null
  let total = 0, explore = 0
  for (const r of resources) {
    const n = parseNum(r.budget ?? r.goal ?? '')
    if (n === null) continue
    total += n
    const t = `${r.id} ${r.description ?? ''}`.toLowerCase()
    if (t.includes('innovation') || t.includes('r&d') || t.includes('research') || t.includes('explore')) explore += n
  }
  if (total === 0) return null
  const pct = (explore / total) * 100
  return {
    questionId: 'ib-explore-vs-exploit',
    text: `Currently your Plan's explore allocation is ${pct.toFixed(1)}% of total Resource budget (${explore.toFixed(0)} of ${total.toFixed(0)}). ${pct < 10 ? 'Below Ries\'s empirical 10% floor — at this level R&D is statistical noise.' : pct < 25 ? 'Above floor but below the 25% Discovery-EvoStep pattern.' : 'Above 25% — confirm graduation cycle is defined.'} Recommendation: explicit floor as C. entry, plus a "Discovery EvoStep" structure where Tasks are framed as questions, not deliverables.`,
    provenance: P(`Plan-derived: explore ${pct.toFixed(1)}% computed from Resource budgets`),
  }
}

/** Governance Hole — gh-cadence-evidence: find C. with review/cadence keywords. */
function deriveGhCadenceEvidence(spec: SpecBlock): PlanDerivedSuggestion | null {
  const hasCadence = (spec.constraints ?? []).some(c => {
    const t = `${c.description ?? ''} ${(c as { presenceTest?: string }).presenceTest ?? ''}`.toLowerCase()
    return t.includes('review') || t.includes('cadence') || t.includes('quorum')
  })
  if (hasCadence) return null
  const shCount = (spec.stakeholderEntries ?? []).length
  return {
    questionId: 'gh-cadence-evidence',
    text: `Your Plan has no Constraint entry encoding review cadence. With ${shCount} stakeholder(s) defined, propose: Reviewers = ${shCount > 3 ? 'rotating quorum of 3 from the named stakeholders' : 'all named stakeholders'}. Cadence = quarterly. Evidence = Status updates against every V. + cascade impact analysis since last review. Miss = Plan-level RED status; no major decisions until review completes.`,
    provenance: P(`Plan-derived: 0 cadence-tagged C. entries, ${shCount} stakeholders to draw from`),
  }
}

/** Governance Hole — gh-decision-lock: find Wish-When ≥ 60 months V.s. */
function deriveGhDecisionLock(spec: SpecBlock): PlanDerivedSuggestion | null {
  const longWishV = (spec.values ?? []).filter(v => {
    const m = whenMonths(v.wishWhen)
    return m !== null && m >= 60
  })
  if (longWishV.length === 0) return null
  const names = longWishV.slice(0, 3).map(v => v.id).join(', ')
  return {
    questionId: 'gh-decision-lock',
    text: `Your Plan has ${longWishV.length} Value(s) with Wish-When ≥ 60 months (${names}). Lock these: long-horizon Wishes cannot be reduced without explicit Charter Amendment process (named approver + written rationale + timestamp logged in Plan history). Prevents quiet erosion — exactly the pattern Ries names as the failure mode.`,
    provenance: P(`Plan-derived: ${longWishV.length} long-Wish-When V. entries`),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** All plan-derivation functions, keyed by their target questionId. */
const DERIVERS: Array<(spec: SpecBlock) => PlanDerivedSuggestion | null> = [
  deriveQtWishRecovery,
  deriveQtMeterMultiyear,
  deriveSmFutureUser,
  deriveSmInanimateNeeds,
  deriveMdCharterText,
  deriveMdViolationTest,
  deriveFvUnsandedWish,
  deriveFvBoardPressureLog,
  deriveIbRecentPredation,
  deriveIbExploreVsExploit,
  deriveGhCadenceEvidence,
  deriveGhDecisionLock,
]

/**
 * Run every plan-derivation function against the supplied spec.
 * Returns a Map keyed by questionId → plan-derived suggestion (or absent if the function returned null).
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
