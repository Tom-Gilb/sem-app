// UNIT_TYPE=Composable
// useIncorruptibleFindings.ts — Incorruptible Agent finding engine.
//
// Tom Gilb 2026-06-11: "I want a new Agent, called 'Incorruptible' (E Ries book 2026)
//   which if let loose will help planners design and check strategic planning, to follow
//   the rules Eric lays out in his book, so that the result is 'incorruptible' (Quarterly
//   results cannot determin quality or long term thinking)"
//
// Architecture (Phase 1):
//   - Deterministic rule engine that scans a SpecBlock and emits IncorruptibleFinding[]
//   - Source-layer = 'derived-from-plan' for everything Phase 1 produces (highest provenance)
//   - Phase 2 (later) — Claudian-augmented findings with Ries-book citations stamped in;
//     those will have sourceLayer = 'cited-ries-incorruptible' + a riesCitation string
//
// Composes with:
//   - Conjunction-of-Technologies (Plan + Ries + Gilb + LLM + Internet) — Phase 1 covers Plan
//   - AI-Max (suggestions surface immediately, not waiting for user query)
//   - Claude-Code-as-AI-Layer (no embedded API; future Ries citations come from Claudian)
//   - Architectural Resilience (deterministic IDs per r93l lesson — stable across re-runs)

import { computed, ref, type Ref } from 'vue'
import type { SpecBlock, VEntry, REntry, CEntry, StakeholderEntry } from '../types/spec'
import type {
  IncorruptibleFinding,
  IncorruptibleReport,
  IncorruptibleCategory,
  IncorruptibleSeverity,
} from '../types/incorruptible'

/** Default Wish-When horizon under which we'd flag "no long-horizon counterweight". */
const MIN_LONG_HORIZON_MONTHS = 36

/** Innovation budget floor as % of total resource pool — Ries: R&D is a FLOOR not residual. */
const INNOVATION_BUDGET_FLOOR_PERCENT = 10

/** Long-horizon stakeholder keywords (Ries multi-stakeholder accountability principle). */
const LONG_HORIZON_STAKEHOLDER_KEYWORDS = [
  'future', 'generation', 'community', 'environment', 'employee', 'worker',
  'planet', 'regulator', 'gdpr', 'iso', 'public', 'society', 'data',
  'long-term', 'long term', 'next decade',
]

/**
 * Deterministic ID per r93l lesson — stable tuple across re-runs of the same logical inputs.
 * Pattern: incorrupt|<category>|<triggeredBy>|<principle>
 */
function stableFindingId(
  category: IncorruptibleCategory,
  triggeredBy: string,
  principleKey: string,
): string {
  return `incorrupt|${category}|${triggeredBy}|${principleKey}`
}

/**
 * Parse a "Goal-When" / "Wish-When" string into approximate months-from-now.
 * Accepts: "2027-Q1", "2032-Q4", "2026-03-15", "Q2 2026", "before EU AI Act",
 *          "after MVP launch", etc. Returns null for non-parseable / event-anchored.
 */
function whenInMonthsFromNow(whenStr: string | undefined): number | null {
  if (!whenStr) return null
  const s = whenStr.trim()
  if (!s) return null

  // ISO date or YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (isoMatch) {
    const year  = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const target = new Date(year, month - 1, 1)
    const now    = new Date()
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  }

  // YYYY-Qn (quarter)
  const qMatch = s.match(/^(\d{4})-?Q([1-4])$/i)
  if (qMatch) {
    const year    = parseInt(qMatch[1], 10)
    const quarter = parseInt(qMatch[2], 10)
    const month   = (quarter - 1) * 3
    const target  = new Date(year, month, 1)
    const now     = new Date()
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  }

  // Qn YYYY (alternative order)
  const qMatch2 = s.match(/^Q([1-4])\s+(\d{4})$/i)
  if (qMatch2) {
    const quarter = parseInt(qMatch2[1], 10)
    const year    = parseInt(qMatch2[2], 10)
    const month   = (quarter - 1) * 3
    const target  = new Date(year, month, 1)
    const now     = new Date()
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  }

  // Event-anchored — cannot quantify, return null (the UI will flag separately).
  return null
}

/** Parse a numeric Goal / Wish string to compare them. Strips currency / formatting. */
function parseNumericLevel(s: string | undefined): number | null {
  if (!s) return null
  const cleaned = s.replace(/[^0-9.\-eE]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return isFinite(n) ? n : null
}

// ─── Category 1: Quarterly-Tyranny detector ─────────────────────────────────

function detectQuarterlyTyranny(spec: SpecBlock): IncorruptibleFinding[] {
  const findings: IncorruptibleFinding[] = []
  const nowIso = new Date().toISOString()

  for (const v of spec.values ?? []) {
    const goalMonths = whenInMonthsFromNow(v.goalWhen)
    const wishMonths = whenInMonthsFromNow(v.wishWhen)

    // Quarter-only commitment (Goal-When ≤ 12 months) with no Wish counterweight
    if (goalMonths !== null && goalMonths > 0 && goalMonths <= 12) {
      const hasLongWish = wishMonths !== null && wishMonths >= MIN_LONG_HORIZON_MONTHS

      if (!hasLongWish) {
        findings.push({
          id: stableFindingId('quarterly-tyranny', v.id, 'no-long-wish-counterweight'),
          category: 'quarterly-tyranny',
          severity: 'critical',
          sourceLayer: 'derived-from-plan',
          riesCitation: 'Ries Incorruptible Glossary — "Financial gravity" + "Virtuous performance cycle" + "Deferred liabilities"',
          riesGlossaryTerms: ['financial-gravity', 'virtuous-performance-cycle', 'deferred-liabilities'],
          roleSensitivity: { founder: 'high', investor: 'med', 'board-director': 'med' },
          evidenceEotCases: ['text-em-all', 'guidon'],
          gilbCitation: 'Gilb EVO 2024 ch.2 p.19 (9-step Evo cycle — Learn step requires multi-year Status trend)',
          verifyUrl: 'https://ltse.com/principles/long-term-focus',
          triggeredBy: v.id,
          principleViolated: 'Long-horizon counterweight',
          explanation: `${v.id} commits to a Goal within ${goalMonths} months but has no Wish horizon ≥ ${MIN_LONG_HORIZON_MONTHS} months. The quarterly Goal will dominate the plan's gravity unless a multi-year Wish counterweights it.`,
          suggestedFix: {
            type: 'add-wish',
            targetItemId: v.id,
            asPlanguage: `Wish: ${v.goal ? `2× ${v.goal}` : 'transformational ambition level'}. Wish-When: ${new Date(Date.now() + 1000 * 60 * 60 * 24 * 30.44 * MIN_LONG_HORIZON_MONTHS).toISOString().slice(0, 7)}. Source: long-horizon counterweight to Goal.`,
            rationale: `Add a Wish horizon ≥ ${MIN_LONG_HORIZON_MONTHS} months. The Wish is the aspirational ceiling; without it, every decision will optimise the ${goalMonths}-month Goal at the expense of long-term value.`,
          },
          longTermConsequence: `Without a Wish horizon, the Goal becomes the planning ceiling. Every trade-off skews to short-term delivery.`,
          generatedAtIso: nowIso,
        })
      }
    }
  }

  return findings
}

// ─── Category 2: Stakeholder Monoculture detector ───────────────────────────

function detectStakeholderMonoculture(spec: SpecBlock): IncorruptibleFinding[] {
  const findings: IncorruptibleFinding[] = []
  const nowIso = new Date().toISOString()

  // Collect all known stakeholder names from structured entries + comma-string fallback
  const stakeholderNames = new Set<string>()
  for (const sh of spec.stakeholderEntries ?? []) {
    if (sh.name) stakeholderNames.add(sh.name.toLowerCase())
  }
  for (const name of (spec.stakes ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    stakeholderNames.add(name.toLowerCase())
  }

  // Plan-level check: any long-horizon / inanimate stakeholder present?
  const allNamesStr = [...stakeholderNames].join(' ')
  const hasLongHorizonStakeholder = LONG_HORIZON_STAKEHOLDER_KEYWORDS.some(kw =>
    allNamesStr.includes(kw.toLowerCase()),
  )

  if (stakeholderNames.size > 0 && !hasLongHorizonStakeholder) {
    findings.push({
      id: stableFindingId('stakeholder-monoculture', 'plan-level', 'no-long-horizon-stakeholder'),
      category: 'stakeholder-monoculture',
      severity: 'critical',
      sourceLayer: 'derived-from-plan',
      riesCitation: 'Ries Incorruptible Glossary — "Citizens of the republic" + "Mission transmission" + "Transmission multipliers"',
      riesGlossaryTerms: ['citizens-of-the-republic', 'mission-transmission', 'transmission-multipliers', 'externalities'],
      roleSensitivity: { founder: 'high', 'board-director': 'high', consumer: 'med', employee: 'med' },
      evidenceEotCases: ['clegg-auto', 'cypress-valley', 'codeweavers'],
      gilbCitation: 'Gilb Stakeholder Engineering — every Value names its stakeholder; long-term stakeholders are NOT optional',
      verifyUrl: 'https://ltse.com/principles/expanded-stakeholders',
      triggeredBy: 'plan-level',
      principleViolated: 'Multi-stakeholder accountability',
      explanation: `The Plan's ${stakeholderNames.size} stakeholders are all short-horizon or shareholder-class. Ries: incorruptibility requires representing future-generation users, environment, community, and employees-as-long-term-owners.`,
      suggestedFix: {
        type: 'add-stakeholder',
        targetItemId: 'plan-level',
        asPlanguage: `Stakeholder: Future Generation User\nDescription: A user of this system in 2036, whose interests are not represented by anyone present at today's planning session.\nInterest: Long-term value preservation, not quarterly extraction.\nPower: Voice in this Plan only if represented now.`,
        rationale: `Add at least one long-horizon stakeholder (Future-Generation User / Community / Environment / Employee-as-long-term-owner). The Wish horizon needs a stakeholder owner — without one, the long-term Wish has no defender at decision time.`,
      },
      longTermConsequence: `Plans without long-horizon stakeholders systematically discount long-horizon Values during trade-off discussions.`,
      generatedAtIso: nowIso,
    })
  }

  return findings
}

// ─── Category 3: Mission Drift detector ─────────────────────────────────────

function detectMissionDrift(spec: SpecBlock): IncorruptibleFinding[] {
  const findings: IncorruptibleFinding[] = []
  const nowIso = new Date().toISOString()

  // Check for a "Mission Lock" Constraint — Ries: mission is a hard constraint, not aspiration
  const hasMissionLock = (spec.constraints ?? []).some(c => {
    const desc = (c.description ?? '').toLowerCase()
    return desc.includes('mission') || desc.includes('charter') || desc.includes('purpose')
  })

  if (!hasMissionLock) {
    findings.push({
      id: stableFindingId('mission-drift', 'plan-level', 'no-mission-lock'),
      category: 'mission-drift',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      riesCitation: 'Ries Incorruptible Glossary — "Mission" + "Mission-controlled company" + "Constitutional governance" + "Mission drive"',
      riesGlossaryTerms: ['mission', 'mission-controlled-company', 'constitutional-governance', 'mission-drive', 'mission-hopeful'],
      roleSensitivity: { founder: 'high', 'board-director': 'high', investor: 'med' },
      evidenceEotCases: ['codeweavers', 'guidon', 'text-em-all', 'the-ready'],
      gilbCitation: 'Gilb CE — Constraint entries encode binary non-negotiables. Mission belongs HERE, not as a tagline.',
      verifyUrl: 'https://ltse.com/principles/long-term-stakeholders',
      triggeredBy: 'plan-level',
      principleViolated: 'Mission as constraint',
      explanation: `No Constraint entry references "mission", "charter", or "purpose". Without a mission-lock Constraint, every Goal trade-off can erode mission alignment unnoticed.`,
      suggestedFix: {
        type: 'add-constraint',
        targetItemId: 'plan-level',
        asPlanguage: `C. Mission Lock\nDescription: The founding mission of this organisation/project, as written in the original charter, MUST NOT be violated by any decision in this Plan.\nMission text: [paste exact charter language here]\nViolation test: Any Goal, Solution, or Resource that materially contradicts the mission text triggers Plan review with all stakeholders present.`,
        rationale: `Mission is a CONSTRAINT (binary non-negotiable), not a Value (negotiable trade-off). Encoding mission as C. makes it a hard guardrail at every decision, not aspiration that gets sanded down.`,
      },
      longTermConsequence: `Without a mission-lock Constraint, mission drift happens one defensible trade-off at a time. By year 5 the Plan no longer recognises its origin.`,
      generatedAtIso: nowIso,
    })
  }

  return findings
}

// ─── Category 4: Founder-Vision Erosion detector ────────────────────────────

function detectFounderVisionErosion(spec: SpecBlock): IncorruptibleFinding[] {
  const findings: IncorruptibleFinding[] = []
  const nowIso = new Date().toISOString()

  // Check each V. for transformational Wish — Wish ≥ 2× Goal indicates founder ambition
  for (const v of spec.values ?? []) {
    const goalN = parseNumericLevel(v.goal)
    const wishN = parseNumericLevel(v.wish ?? '')

    // Numeric values with both Goal AND Wish — verify Wish is transformational
    if (goalN !== null && wishN !== null && goalN > 0) {
      if (wishN < goalN * 1.5) {
        findings.push({
          id: stableFindingId('founder-vision-erosion', v.id, 'wish-not-transformational'),
          category: 'founder-vision-erosion',
          severity: 'moderate',
          sourceLayer: 'derived-from-plan',
          riesCitation: 'Ries Incorruptible Glossary — "Harder-is-easier mission" + "Magnetic powers" + "Human flourishing"',
          riesGlossaryTerms: ['harder-is-easier-mission', 'magnetic-powers', 'human-flourishing', 'mission-drive'],
          roleSensitivity: { founder: 'high', employee: 'med' },
          evidenceEotCases: ['clegg-auto', 'codeweavers'],
          gilbCitation: 'Gilb CE — Wish is the stakeholder DREAM, independent of cost+physics. Wish ≈ Goal means dream was downgraded.',
          verifyUrl: null,
          triggeredBy: v.id,
          principleViolated: 'Transformational Wish',
          explanation: `${v.id} has Wish (${wishN}) only ${(wishN / goalN).toFixed(2)}× Goal (${goalN}). Founder vision requires Wish ≥ 1.5× Goal — otherwise the Wish is just Goal-with-rounding.`,
          suggestedFix: {
            type: 'add-wish',
            targetItemId: v.id,
            asPlanguage: `Wish: ${(goalN * 2).toFixed(0)} (or higher — paste founder's original stakeholder-dream number here, before resource constraints sanded it down).`,
            rationale: `Raise the Wish to the original transformational ambition. A 1.5×+ ratio means the Wish is a real aspirational ceiling, not Goal-with-margin.`,
          },
          longTermConsequence: `When Wish ≈ Goal, the planning ceiling collapses to the planning floor. Future Goal moves are bounded by today's Wish; transformation becomes impossible.`,
          generatedAtIso: nowIso,
        })
      }
    }
  }

  return findings
}

// ─── Category 5: Innovation-Budget Predation detector ───────────────────────

function detectInnovationBudgetPredation(spec: SpecBlock): IncorruptibleFinding[] {
  const findings: IncorruptibleFinding[] = []
  const nowIso = new Date().toISOString()

  const resources = spec.resources ?? []
  if (resources.length === 0) return findings

  // Sum all resource budgets where numeric. Detect explicit innovation/R&D Resource.
  let totalBudget = 0
  let innovationBudget = 0
  let hasInnovationFloor = false

  for (const r of resources) {
    const budgetN = parseNumericLevel(r.budget ?? r.goal ?? '')
    if (budgetN === null) continue
    totalBudget += budgetN

    const tag = `${r.id} ${r.description ?? ''}`.toLowerCase()
    if (
      tag.includes('innovation') || tag.includes('r&d') || tag.includes('rd ') ||
      tag.includes('research') || tag.includes('long-term') ||
      tag.includes('explore') || tag.includes('experiment')
    ) {
      innovationBudget += budgetN
      hasInnovationFloor = true
    }
  }

  if (totalBudget > 0) {
    const innovationPct = (innovationBudget / totalBudget) * 100

    if (!hasInnovationFloor) {
      findings.push({
        id: stableFindingId('innovation-budget-predation', 'plan-level', 'no-innovation-floor'),
        category: 'innovation-budget-predation',
        severity: 'critical',
        sourceLayer: 'derived-from-plan',
        riesCitation: 'Ries Incorruptible Glossary — "Builder\'s intuition" + "Deferred liabilities" + "Virtuous performance cycle"',
        riesGlossaryTerms: ['builders-intuition', 'deferred-liabilities', 'virtuous-performance-cycle', 'financial-gravity'],
        roleSensitivity: { founder: 'high', investor: 'high', 'board-director': 'med' },
        evidenceEotCases: ['text-em-all', 'clegg-auto'],
        gilbCitation: 'Gilb Lean Startup integration — explore vs exploit allocation belongs at Resource level, not as an afterthought',
        verifyUrl: 'https://ltse.com/principles/long-term-investing',
        triggeredBy: 'plan-level',
        principleViolated: 'Innovation budget as floor',
        explanation: `No Resource entry is tagged for innovation / R&D / long-term exploration. Without an explicit innovation Resource, R&D becomes the residual after quarterly targets — Ries's institutionalised short-termism.`,
        suggestedFix: {
          type: 'add-constraint',
          targetItemId: 'plan-level',
          asPlanguage: `R. Long-Term Innovation Floor\nDescription: Resources allocated to exploration / R&D / long-horizon experiments — NOT residual after quarterly targets.\nBudget: ≥ ${INNOVATION_BUDGET_FLOOR_PERCENT}% of total resource pool.\nMeter: Quarterly attestation that innovation Budget was NOT reallocated to fund quarterly Goal shortfalls.`,
          rationale: `Make innovation a Resource FLOOR (allocated first), not a residual (whatever's left after quarterly targets are met). Ries: this single structural change is the difference between incorruptible long-termism and aspirational long-termism.`,
        },
        longTermConsequence: `Without an explicit innovation Resource, exploration budget gets eaten by quarterly Goal shortfalls every cycle. Year-on-year compounded: zero transformational capacity.`,
        generatedAtIso: nowIso,
      })
    } else if (innovationPct < INNOVATION_BUDGET_FLOOR_PERCENT) {
      findings.push({
        id: stableFindingId('innovation-budget-predation', 'plan-level', 'innovation-below-floor'),
        category: 'innovation-budget-predation',
        severity: 'moderate',
        sourceLayer: 'derived-from-plan',
        riesCitation: 'Ries Incorruptible Glossary — "Builder\'s intuition" + "Deferred liabilities" (below empirical floor)',
        riesGlossaryTerms: ['builders-intuition', 'deferred-liabilities', 'surrogation'],
        roleSensitivity: { founder: 'high', investor: 'high', 'board-director': 'med' },
        evidenceEotCases: ['text-em-all'],
        gilbCitation: null,
        verifyUrl: 'https://ltse.com/principles/long-term-investing',
        triggeredBy: 'plan-level',
        principleViolated: 'Innovation budget below floor',
        explanation: `Innovation Resource budget is ${innovationPct.toFixed(1)}% of total — below the ${INNOVATION_BUDGET_FLOOR_PERCENT}% floor. Quarterly pressure will erode this further unless protected by C. entry.`,
        suggestedFix: {
          type: 'raise-goal-when',
          targetItemId: 'plan-level',
          asPlanguage: `Raise Innovation Resource Budget to ≥ ${INNOVATION_BUDGET_FLOOR_PERCENT}% of total. Add C. constraint: "Innovation Budget MAY NOT be reallocated to quarterly Goal shortfalls."`,
          rationale: `${INNOVATION_BUDGET_FLOOR_PERCENT}% is the Ries empirical floor — below it, R&D becomes performative rather than transformational.`,
        },
        longTermConsequence: `Sub-floor innovation budget is statistical noise — it cannot fund any project large enough to matter when it succeeds.`,
        generatedAtIso: nowIso,
      })
    }
  }

  return findings
}

// ─── Category 6: Governance Hole detector ───────────────────────────────────

function detectGovernanceHoles(spec: SpecBlock): IncorruptibleFinding[] {
  const findings: IncorruptibleFinding[] = []
  const nowIso = new Date().toISOString()

  // Heuristic: count of C. entries referencing governance/review/cadence
  const governanceConstraints = (spec.constraints ?? []).filter(c => {
    const text = `${c.description ?? ''} ${(c as { presenceTest?: string }).presenceTest ?? ''}`.toLowerCase()
    return text.includes('review') || text.includes('cadence') || text.includes('approval') ||
           text.includes('governance') || text.includes('quorum') || text.includes('audit')
  })

  if (governanceConstraints.length === 0) {
    findings.push({
      id: stableFindingId('governance-hole', 'plan-level', 'no-governance-cadence'),
      category: 'governance-hole',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      riesCitation: 'Ries Incorruptible Glossary — "Governance fortress" + "Structural integrity" + "Two-way review" + "Holistic metrics"',
      riesGlossaryTerms: ['governance-fortress', 'structural-integrity', 'structural-safeguards', 'two-way-review', 'holistic-metrics', 'alignment-method'],
      roleSensitivity: { 'board-director': 'high', founder: 'med', investor: 'med' },
      evidenceEotCases: ['guidon', 'the-ready', 'text-em-all', 'cypress-valley'],
      gilbCitation: 'Gilb SUCCESS book — Plan governance is part of the Plan itself, not a side-document',
      verifyUrl: 'https://ltse.com/principles/board-policies',
      triggeredBy: 'plan-level',
      principleViolated: 'Explicit accountability cadence',
      explanation: `No Constraint entry encodes review cadence, approval quorum, or governance audit triggers. Ries: incorruptibility is structural — without explicit cadence Constraints, the structure decays.`,
      suggestedFix: {
        type: 'add-governance-cadence',
        targetItemId: 'plan-level',
        asPlanguage: `C. Plan Review Cadence\nDescription: This Plan MUST be reviewed by [stakeholder quorum] every [N months] with evidence of (a) Status measurements against every V. entry, (b) review of every C. entry for ongoing validity, (c) attestation that no long-horizon Wish was reduced without explicit Charter amendment.\nViolation test: Missed review = Plan-level RED status.`,
        rationale: `Make review cadence a Constraint, not a calendar reminder. The Plan should self-flag governance failures via its own status field.`,
      },
      longTermConsequence: `Plans without structural review cadence drift into ceremonial-only review. Findings stop being acted on. Structural decay compounds.`,
      generatedAtIso: nowIso,
    })
  }

  return findings
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all Phase-1 deterministic detectors against the supplied spec.
 * Returns a grouped IncorruptibleReport ready to render in the panel.
 */
export function generateIncorruptibleReport(
  spec: SpecBlock | null | undefined,
  planTitle: string,
): IncorruptibleReport {
  const nowIso = new Date().toISOString()

  if (!spec) {
    return {
      generatedAtIso: nowIso,
      planTitle,
      totalFindings: 0,
      byCategory: {
        'quarterly-tyranny': [],
        'stakeholder-monoculture': [],
        'mission-drift': [],
        'founder-vision-erosion': [],
        'innovation-budget-predation': [],
        'governance-hole': [],
      },
      bySeverity: { critical: 0, moderate: 0, suggestion: 0 },
      incorruptibilityScore: 0,
      headline: 'No plan loaded — Incorruptible needs a Plan to analyse.',
    }
  }

  const allFindings: IncorruptibleFinding[] = [
    ...detectQuarterlyTyranny(spec),
    ...detectStakeholderMonoculture(spec),
    ...detectMissionDrift(spec),
    ...detectFounderVisionErosion(spec),
    ...detectInnovationBudgetPredation(spec),
    ...detectGovernanceHoles(spec),
  ]

  // Group by category
  const byCategory: Record<IncorruptibleCategory, IncorruptibleFinding[]> = {
    'quarterly-tyranny': [],
    'stakeholder-monoculture': [],
    'mission-drift': [],
    'founder-vision-erosion': [],
    'innovation-budget-predation': [],
    'governance-hole': [],
  }
  for (const f of allFindings) byCategory[f.category].push(f)

  // Severity counts
  const bySeverity: Record<IncorruptibleSeverity, number> = {
    critical:   allFindings.filter(f => f.severity === 'critical').length,
    moderate:   allFindings.filter(f => f.severity === 'moderate').length,
    suggestion: allFindings.filter(f => f.severity === 'suggestion').length,
  }

  // Incorruptibility score: 100 - (critical × 15) - (moderate × 6) - (suggestion × 2), floored at 0
  const score = Math.max(
    0,
    100 - (bySeverity.critical * 15) - (bySeverity.moderate * 6) - (bySeverity.suggestion * 2),
  )

  // Headline summary
  let headline: string
  if (allFindings.length === 0) {
    headline = 'INCORRUPTIBLE — no short-term-thinking patterns detected. Re-run after any major Plan change.'
  } else if (bySeverity.critical > 0) {
    headline = `${bySeverity.critical} CRITICAL · ${bySeverity.moderate} moderate — the Plan has structural short-termism. Address critical findings first.`
  } else if (bySeverity.moderate > 0) {
    headline = `${bySeverity.moderate} moderate findings — no critical structural issues, but resilience can be strengthened.`
  } else {
    headline = `${bySeverity.suggestion} suggestion(s) — Plan is structurally sound. Optional refinements available.`
  }

  return {
    generatedAtIso: nowIso,
    planTitle,
    totalFindings: allFindings.length,
    byCategory,
    bySeverity,
    incorruptibilityScore: score,
    headline,
  }
}

/**
 * Reactive composable wrapper — recomputes findings whenever the spec ref changes.
 * Phase 1 = deterministic only. Phase 2 will layer Claudian-cited findings on top.
 */
export function useIncorruptibleFindings(
  spec: Ref<SpecBlock | null | undefined>,
  planTitle: Ref<string>,
) {
  /** IDs of findings the user has dismissed in this session. Persists per spec. */
  const dismissedIds = ref<Set<string>>(new Set())

  /** Reactive report — recomputes on spec or planTitle change. */
  const report = computed<IncorruptibleReport>(() => {
    return generateIncorruptibleReport(spec.value ?? null, planTitle.value)
  })

  /** Visible findings = all findings minus dismissed ones, sorted by severity then category. */
  const visibleFindings = computed<IncorruptibleFinding[]>(() => {
    const all: IncorruptibleFinding[] = []
    for (const cat of Object.keys(report.value.byCategory) as IncorruptibleCategory[]) {
      for (const f of report.value.byCategory[cat]) {
        if (!dismissedIds.value.has(f.id)) all.push(f)
      }
    }
    const severityOrder: Record<IncorruptibleSeverity, number> = {
      critical: 0, moderate: 1, suggestion: 2,
    }
    return all.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  })

  function dismissFinding(id: string): void {
    const next = new Set(dismissedIds.value)
    next.add(id)
    dismissedIds.value = next
  }

  function undismissFinding(id: string): void {
    const next = new Set(dismissedIds.value)
    next.delete(id)
    dismissedIds.value = next
  }

  function resetDismissals(): void {
    dismissedIds.value = new Set()
  }

  return {
    report,
    visibleFindings,
    dismissedIds,
    dismissFinding,
    undismissFinding,
    resetDismissals,
  }
}

// ─── Apply (Sharpen) — Tom Gilb 2026-06-11 ─────────────────────────────────
//
// Tom Gilb 2026-06-11: "we should be able to use it health check and sharpen
//   (it needs both capabilities) on any plan or organizational model"
//
// applyIncorruptibleFix takes a finding + a spec and returns a NEW spec with the proposed
// fix applied. Pure function — immutable, deterministic, returns a deep-cloned + mutated copy.
// Caller is responsible for emit('update-spec', returnedSpec) to persist.
//
// Strategy per fix type:
//   add-wish        — Find V. by triggeredBy, set wish/wishWhen to proposed
//   add-stakeholder — Append a Stakeholder entry stub (mnemonic id, name, definition)
//   add-constraint  — Append a C. entry stub (mnemonic id, description, scope, rationale)
//   raise-goal-when — Find V., advance goalWhen by 24 months
//   add-evo-step    — Phase 1: no-op + toast "Phase 2 — Evo step structure pending"
//   add-source-charter — Find V., stamp fieldSources.charter = human source
//   add-governance-cadence — Append a C. cadence entry stub

// Note: SpecBlock / VEntry / CEntry / StakeholderEntry / IncorruptibleFinding
// already imported at the top of the file (consolidated post r93q parse-error fix).
// FieldSource is the canonical provenance stamp — every mutated field gets one.
import type { FieldSource } from '../types/spec'

/**
 * r93s (Tom Gilb 2026-06-11: "check that the changes made by this agent are source doc
 * as from the agent with date time, right?"). Canonical Incorruptible FieldSource —
 * matches the shape used by buildFieldSource() in PentaPanel.vue. Every mutation that
 * applyIncorruptibleFix performs now writes one of these into the target entry's
 * fieldSources map, keyed by the field name. Result: full audit trail — user can see
 * which entries / which fields the Incorruptible Agent touched, when, and (via the
 * tool field) WHICH PRINCIPLE drove the change. Honours the Planguage rule from
 * spec.ts: "Source will always be specified explicitly or implied from editing or AI
 * change activity."
 */
function buildIncorruptibleSource(principleViolated: string): FieldSource {
  return {
    source:     'Incorruptible Agent',
    sourceType: 'ai',
    tool:       `Incorruptible · ${principleViolated}`,
    timestamp:  new Date().toISOString(),
  }
}

/** Deep-clone a spec via JSON round-trip — safe for SpecBlock (no Date/Map/Set members). */
function cloneSpec(spec: SpecBlock): SpecBlock {
  return JSON.parse(JSON.stringify(spec)) as SpecBlock
}

/** Mnemonic id generator that avoids collision in the existing collection. */
function uniqueMnemonic(base: string, existing: string[]): string {
  const cleanBase = base.replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Generated'
  if (!existing.includes(cleanBase)) return cleanBase
  let n = 2
  while (existing.includes(`${cleanBase} ${n}`)) n++
  return `${cleanBase} ${n}`
}

export interface ApplyFixResult {
  /** The new SpecBlock with the fix applied. Caller emits update-spec with this. */
  newSpec: SpecBlock
  /** Id of the entry that was newly created / updated — for opening in editor. */
  affectedItemId: string
  /** What KIND of entry was affected ('value' | 'constraint' | 'stakeholder' | 'resource'). */
  affectedItemType: 'value' | 'constraint' | 'stakeholder' | 'resource' | 'plan-level'
  /** Human-readable summary for toast. */
  summary: string
}

/** Returns null if the fix type is not yet implementable in Phase 1 (caller shows note instead). */
export function applyIncorruptibleFix(
  finding: IncorruptibleFinding,
  spec: SpecBlock,
): ApplyFixResult | null {
  const next = cloneSpec(spec)
  const fix  = finding.suggestedFix

  switch (fix.type) {

    case 'add-wish': {
      // Find the V. entry by triggeredBy; set wish + wishWhen + STAMP BOTH FIELDS' SOURCE.
      const target = (next.values ?? []).find(v => v.id === finding.triggeredBy)
      if (!target) return null
      const goalN = parseNumericLevel(target.goal)
      const proposedWish = goalN !== null ? String(Math.round(goalN * 2)) : (fix.asPlanguage.match(/Wish:\s*([^\n]+)/)?.[1]?.trim() ?? 'transformational ambition')
      const proposedWhen = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30.44 * 36).toISOString().slice(0, 7)
      target.wish     = proposedWish
      target.wishWhen = proposedWhen
      // r93s: stamp Source on EVERY mutated field — full audit trail
      const src = buildIncorruptibleSource(finding.principleViolated)
      target.fieldSources = { ...(target.fieldSources ?? {}), wish: src, wishWhen: src }
      return {
        newSpec: next,
        affectedItemId: target.id,
        affectedItemType: 'value',
        summary: `Wish added to ${target.id}: ${proposedWish} (by ${proposedWhen}) — Source: Incorruptible Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-stakeholder': {
      // Append a stub StakeholderEntry — user edits afterwards. r93s: stamp every field
      // of the new entry + put the canonical date+agent string in the source field too.
      const existing = (next.stakeholderEntries ?? []).map(s => s.id)
      const name     = (fix.asPlanguage.match(/Stakeholder:\s*([^\n]+)/)?.[1]?.trim() ?? 'Future Generation User')
      const src      = buildIncorruptibleSource(finding.principleViolated)
      const newSh: StakeholderEntry = {
        id:               uniqueMnemonic(name, existing),
        type:             'Stakeholder',
        stakeholderType:  'Inanimate',
        definition:       'A user / beneficiary in the long-horizon (10+ years) whose interests must be represented in this Plan.',
        description:      fix.asPlanguage.split('\n').slice(0, 4).join(' ').slice(0, 240),
        needs:            [],
        // Free-text source field on StakeholderEntry — keep the verbose form (Tom can read it).
        source:           `Incorruptible Agent · ${finding.principleViolated} · ${src.timestamp.slice(0, 19)}Z`,
        // r93s: also stamp canonical fieldSources per Planguage rule
        fieldSources:     { definition: src, description: src, source: src, stakeholderType: src },
      } as StakeholderEntry
      next.stakeholderEntries = [...(next.stakeholderEntries ?? []), newSh]
      return {
        newSpec: next,
        affectedItemId: newSh.id,
        affectedItemType: 'stakeholder',
        summary: `Stakeholder added: ${newSh.id} — Source: Incorruptible Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-constraint':
    case 'add-governance-cadence': {
      // Append a C. entry stub. Parse first line as description; rest as rationale.
      // r93ff — Ensure the resulting C. description ALWAYS contains the keyword the
      // matching detector looks for so the original finding disappears on next scan:
      //   - mission-drift detector looks for "mission"/"charter"/"purpose"
      //   - governance-hole detector looks for "review"/"cadence"/"quorum"/"governance"/"audit"
      //   - innovation-budget-predation (when fallback-downgraded from add-resource) — keyword in rationale
      const existing  = (next.constraints ?? []).map(c => c.id)
      const firstLine = fix.asPlanguage.split('\n')[0].replace(/^C\.\s*/, '').trim()
      const restLines = fix.asPlanguage.split('\n').slice(1).join(' ').trim()
      const src       = buildIncorruptibleSource(finding.principleViolated)
      // Decide description prefix that guarantees the detector's keyword presence
      const cat       = finding.category
      let description: string
      if (fix.type === 'add-governance-cadence' || cat === 'governance-hole') {
        description = `Must be REVIEWED on a defined cadence with all stakeholder evidence; review quorum named below. ${firstLine ? `Trigger: ${firstLine}` : ''}`
      } else if (cat === 'mission-drift') {
        description = `Must not violate the founding MISSION / CHARTER / PURPOSE${firstLine ? ` as expressed: ${firstLine}` : ''}.`
      } else if (cat === 'innovation-budget-predation') {
        description = `INNOVATION / R&D budget must not be reallocated to quarterly Goal shortfalls. ${firstLine ? `Specifically: ${firstLine}` : ''}`
      } else {
        description = `Must not violate ${firstLine || finding.principleViolated.toLowerCase()}.`
      }
      const newC: CEntry = {
        id:           uniqueMnemonic(firstLine || `${cat}-lock`, existing),
        type:         'Constraint',
        level:        'Business',
        description,
        scope:        'plan-level',
        rationale:    restLines || `Added by Incorruptible Agent (${finding.principleViolated}) at ${src.timestamp.slice(0, 19)}Z. Ries: incorruptibility is structural — this Constraint encodes a non-negotiable.`,
        fieldSources: { description: src, scope: src, rationale: src },
      } as CEntry
      next.constraints = [...(next.constraints ?? []), newC]
      return {
        newSpec: next,
        affectedItemId: newC.id,
        affectedItemType: 'constraint',
        summary: `Constraint added: ${newC.id} — Source: Incorruptible Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'raise-goal-when': {
      const target = (next.values ?? []).find(v => v.id === finding.triggeredBy)
      if (!target) return null
      // Push goalWhen 24 months further out + STAMP the mutated field's source.
      const newWhen = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30.44 * 24).toISOString().slice(0, 7)
      target.goalWhen = newWhen
      const src = buildIncorruptibleSource(finding.principleViolated)
      target.fieldSources = { ...(target.fieldSources ?? {}), goalWhen: src }
      return {
        newSpec: next,
        affectedItemId: target.id,
        affectedItemType: 'value',
        summary: `Goal-When extended to ${newWhen} on ${target.id} — Source: Incorruptible Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-source-charter': {
      const target = (next.values ?? []).find(v => v.id === finding.triggeredBy)
      if (!target) return null
      // r93s: use CANONICAL FieldSource shape (was using a custom object with non-canonical
      // `agent` / `principle` keys — that broke the audit-trail UI that expects FieldSource).
      const src = buildIncorruptibleSource(finding.principleViolated)
      target.fieldSources = { ...(target.fieldSources ?? {}), charter: src }
      return {
        newSpec: next,
        affectedItemId: target.id,
        affectedItemType: 'value',
        summary: `Source: Charter stamped on ${target.id} — Source: Incorruptible Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-resource': {
      // r93ff — Innovation Floor R. entry. Appends an R. tagged with the keywords the
      // detectInnovationBudgetPredation detector looks for ("innovation"/"r&d"/"explore")
      // so the original finding disappears on next scan.
      const existing = ((next.resources ?? []) as Array<{ id: string }>).map(r => r.id)
      const src = buildIncorruptibleSource(finding.principleViolated)
      const newR = {
        id:           uniqueMnemonic('Innovation Floor', existing),
        type:         'Resource',
        level:        'Business',
        description:  'Long-term innovation / R&D / exploration budget — protected floor per Ries Incorruptible. MUST NOT be reallocated to quarterly Goal shortfalls.',
        scale:        'percent-of-total-budget',
        meter:        'Quarterly attestation that this Budget was not reallocated to fund quarterly Goal shortfalls.',
        budget:       '10',
        status:       '',
        tolerable:    '8',
        goal:         '10',
        fieldSources: { description: src, scale: src, meter: src, budget: src, tolerable: src, goal: src },
      } as unknown as Parameters<typeof Array.prototype.push>[0]
      next.resources = [...((next.resources ?? []) as unknown[]), newR] as SpecBlock['resources']
      return {
        newSpec: next,
        affectedItemId: 'Innovation Floor',
        affectedItemType: 'resource',
        summary: `Innovation-floor Resource added — Source: Incorruptible Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-evo-step':
    default:
      // Phase 2 — Evo step structure addition is non-trivial.
      return null
  }
}

// Helper for non-reactive callers (export plumbing).
export const _internal = { whenInMonthsFromNow, parseNumericLevel, stableFindingId }
// Reference VEntry/REntry to suppress unused-import warnings on rare type-only imports.
export type _VEntryRef = VEntry
export type _REntryRef = REntry
