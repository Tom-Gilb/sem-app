// UNIT_TYPE=Composable
// useRoleHealthScore.ts — Per-Stakeholder + plan-aggregate Role Health Score
// (Tom Gilb 2026-06-23 — Phase 2 of Roles redesign:
//   "then of course on with phase 2 and on").
//
// PHASE 2 SCOPE
// Per-Stakeholder Health Score 0-100 + RAG band (red/amber/green) + a plan-
// aggregate score weighted by per-Stakeholder severity sums and penalised
// per placeholder Role.  Re-uses Phase 1's runRoleAnalysis() so the 16
// detector categories are the single source of truth for findings; this
// composable GROUPS findings PER STAKEHOLDER instead of per category.
//
// SCORING ALGORITHM (mirrors useRoleFindings._complianceScore shape)
// • Per-Stakeholder:
//     deduction = Σ(severity-weight × 3)
//                 where weights are critical:3, moderate:2, suggestion:1
//     MAX_PER_STAKEHOLDER = 16 categories × critical-tier × full weight
//                         = 16 × 3 × 3 = 144
//     score = max(0, min(100, 100 − round(deduction / MAX × 100)))
// • RAG:
//     green  if score ≥ 85
//     amber  if score ≥ 65
//     red    otherwise
// • Plan-aggregate:
//     planScore = weighted mean of per-Stakeholder scores
//                 (each Stakeholder weighted equally so individuals are
//                 not silently averaged-down by team counts)
//                 minus 5 points per placeholder Stakeholder
//                 clamped to [0, 100]
//
// COMPOSES WITH
// • Stakeholder Engineering (Gilb 2025) — Role IS Stakeholder; Health is
//   a property of every Stakeholder, not a separate ledger
// • Conjunction-of-Technologies SUPREME — per-Stakeholder findings carry
//   the same provenance the Phase 1 detectors stamped
// • Universal Undo — pure read-side composable, no mutation, no Undo
// • AI-Max — Health Score surfaces at every Stakeholder card
// • Twin portability — pure function over SpecBlock + plan title
// • Solution Parameters SUPREME (v270) — Health Score is metadata about
//   the Stakeholder record, not a parameter

import { runRoleAnalysis } from './useRoleFindings'
import type { SpecBlock } from '../types/spec'
import type { RoleFinding, RoleSeverity } from '../types/role'

// ── Public types ───────────────────────────────────────────────────────────

export interface StakeholderHealth {
  /** Mnemonic tag of the Stakeholder/Role this row represents. */
  stakeholderId: string
  /** Display name — personName if set, else id. */
  stakeholderName: string
  /** Position if set ('' otherwise) — surfaced in the row for quick scan. */
  position: string
  /** True if the Stakeholder is flagged isPlaceholder (Musk #14 trigger). */
  isPlaceholder: boolean
  /** Per-Stakeholder Health Score 0-100. */
  score: number
  /** RAG band derived from score (universal accessibility — colour-blind safe
   *  triad of indigo/amber/rose surfaced as text labels, not colour alone). */
  rag: 'red' | 'amber' | 'green'
  /** Finding counts grouped by severity for this Stakeholder. */
  findingCounts: { critical: number; moderate: number; suggestion: number }
  /** Up to 3 most-severe principleViolated strings for at-a-glance triage. */
  topIssues: string[]
  /** Total findings for this Stakeholder across all 16 categories. */
  totalFindings: number
}

export interface RoleHealthReport {
  /** ISO timestamp of generation. */
  generatedAtIso: string
  planTitle: string
  /** One row per Stakeholder/Role in the spec — sorted weakest first. */
  perStakeholder: StakeholderHealth[]
  /** Plan-aggregate score 0-100. */
  planScore: number
  /** Plan-aggregate RAG band. */
  planRag: 'red' | 'amber' | 'green'
  /** Total Stakeholders in the spec. */
  totalStakeholders: number
  /** Number of Stakeholders flagged isPlaceholder=true. */
  placeholderCount: number
  /** Total findings across all Stakeholders + plan-level. */
  totalFindings: number
  /** Plain-language one-line headline for the dashboard banner. */
  headline: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_PER_STAKEHOLDER = 16 * 3 * 3  // 16 categories × critical-tier × weight 3 = 144
const PLACEHOLDER_PENALTY = 5            // points deducted from planScore per placeholder
const SEVERITY_WEIGHT: Record<RoleSeverity, number> = {
  critical: 3, moderate: 2, suggestion: 1,
}
const SEVERITY_RANK: Record<RoleSeverity, number> = {
  critical: 0, moderate: 1, suggestion: 2,
}

function _ragOf(score: number): 'red' | 'amber' | 'green' {
  if (score >= 85) return 'green'
  if (score >= 65) return 'amber'
  return 'red'
}

function _now(): string {
  return new Date().toISOString()
}

// ── Public API ─────────────────────────────────────────────────────────────

export function runRoleHealthAnalysis(
  spec: SpecBlock | null,
  planTitle: string,
): RoleHealthReport {
  const safeSpec: SpecBlock = spec ?? {
    functions: [], values: [], solutions: [], constraints: [], resources: [],
  }
  const stakeholders = safeSpec.stakeholderEntries ?? []

  // Run Phase 1's full 16-detector analysis once; we re-group below.
  const report = runRoleAnalysis(safeSpec, planTitle)

  // Collect every finding into a flat array for grouping (drop the per-category
  // bucketing — we group by triggeredBy instead).
  const allFindings: RoleFinding[] = []
  for (const arr of Object.values(report.byCategory)) {
    for (const f of arr) allFindings.push(f)
  }

  // Group findings per Stakeholder id.
  const byStakeholder = new Map<string, RoleFinding[]>()
  for (const s of stakeholders) byStakeholder.set(s.id, [])
  // Plan-level findings live in a synthetic bucket — count toward plan-aggregate
  // but not toward any one Stakeholder's score (they describe whole-plan gaps).
  const planLevelFindings: RoleFinding[] = []
  for (const f of allFindings) {
    if (f.triggeredBy === 'plan-level') {
      planLevelFindings.push(f)
      continue
    }
    if (byStakeholder.has(f.triggeredBy)) {
      // Direct hit — triggeredBy is a Stakeholder id.
      byStakeholder.get(f.triggeredBy)!.push(f)
      continue
    }
    // Some detectors fire on Value/Function/etc. items.  Skip — those are not
    // about a specific Stakeholder.  They still factor into planScore via
    // planLevelFindings list (counted in totalFindings) but not into per-row
    // health (they describe missing Stakeholders, not weak ones).
    planLevelFindings.push(f)
  }

  // Per-Stakeholder scoring.
  const perStakeholder: StakeholderHealth[] = stakeholders.map(s => {
    const findings = byStakeholder.get(s.id) ?? []
    let deduction = 0
    const counts = { critical: 0, moderate: 0, suggestion: 0 }
    for (const f of findings) {
      deduction += SEVERITY_WEIGHT[f.severity] * 3
      counts[f.severity]++
    }
    const score = Math.max(0, Math.min(100,
      100 - Math.round((deduction / MAX_PER_STAKEHOLDER) * 100)
    ))
    // Top 3 issues — sort by severity rank ascending (critical first).
    const topIssues = findings
      .slice()
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
      .slice(0, 3)
      .map(f => f.principleViolated)
    return {
      stakeholderId:   s.id,
      stakeholderName: (s.personName && s.personName.trim().length > 0)
        ? s.personName
        : s.id,
      position:        s.position ?? '',
      isPlaceholder:   s.isPlaceholder === true,
      score,
      rag:             _ragOf(score),
      findingCounts:   counts,
      topIssues,
      totalFindings:   findings.length,
    }
  })

  // Sort weakest-first so the dashboard surfaces problems at the top.
  perStakeholder.sort((a, b) => a.score - b.score)

  // Plan-aggregate.
  const totalStakeholders = stakeholders.length
  const placeholderCount = stakeholders.filter(s => s.isPlaceholder === true).length
  let planScore: number
  if (totalStakeholders === 0) {
    // No Stakeholders at all is itself the worst case.
    planScore = 0
  } else {
    const mean = perStakeholder.reduce((a, h) => a + h.score, 0) / perStakeholder.length
    planScore = Math.max(0, Math.min(100, Math.round(mean - placeholderCount * PLACEHOLDER_PENALTY)))
  }
  const planRag = _ragOf(planScore)

  // Headline.
  const totalFindings = allFindings.length
  let headline: string
  if (totalStakeholders === 0) {
    headline = `🎭 Role Health · ${planTitle} — 0 Stakeholders. Add Stakeholders before Health can be measured.`
  } else if (totalFindings === 0) {
    headline = `🎭 Role Health · ${planTitle} — ${planScore}/100 (${planRag.toUpperCase()}). All ${totalStakeholders} Stakeholders pass every Role check.`
  } else {
    const ragLabel = planRag === 'green' ? 'on-track' : (planRag === 'amber' ? 'at-risk' : 'in-trouble')
    headline = `🎭 Role Health · ${planTitle} — ${planScore}/100 (${ragLabel}). ${totalStakeholders} Stakeholders, ${placeholderCount} placeholder${placeholderCount === 1 ? '' : 's'}, ${totalFindings} finding${totalFindings === 1 ? '' : 's'}.`
  }

  return {
    generatedAtIso: _now(),
    planTitle,
    perStakeholder,
    planScore,
    planRag,
    totalStakeholders,
    placeholderCount,
    totalFindings,
    headline,
  }
}
