// useGlobalPriority.ts — Feature #201: Global Priority
//
// Higher-level prioritisation that operates on GROUPS of spec components,
// not just individual entries. Three sequential layers:
//
//   1. Stakeholders relative to each other
//   2. Values vs Costs vs Constraints relative to each other
//   3. Solutions relative to each other
//
// Each layer captures the same metadata as the per-entry PriorityRecord
// (source, authority, purposes), PLUS a new concept — Prioritisation
// Constraints — which limit how far the prioritisation can go (e.g.
// "no Value can exceed 40% weight", "Solution X must rank below Y",
// "Stakeholder Z is untouchable").
//
// After "Apply", a Sharpening-style consequence diff records every entry
// whose rank/weight changed, so the user gets concrete feedback on impact.

import { ref, computed } from 'vue'
import type { SpecBlock, VEntry } from '../types/spec'

// ── Layers ────────────────────────────────────────────────────────────────────

export type PriorityLayer =
  | 'stakeholders'
  | 'values-costs-constraints'
  | 'solutions'

export const LAYER_LABEL: Record<PriorityLayer, string> = {
  'stakeholders': 'Stakeholders',
  'values-costs-constraints': 'Values · Costs · Constraints',
  'solutions': 'Solutions',
}

export const LAYER_ICON: Record<PriorityLayer, string> = {
  'stakeholders': '👥',
  'values-costs-constraints': '💎',
  'solutions': '🛠',
}

export const LAYER_HINT: Record<PriorityLayer, string> = {
  'stakeholders': 'Rank the people whose needs the plan serves. Their order shapes everything below.',
  'values-costs-constraints': 'Trade off Values, Costs, and Constraints against each other. Set per-category weights and per-entry ranks.',
  'solutions': 'Rank Solutions. Group related ones into Sets that share a rank.',
}

// ── Ranking + sets ────────────────────────────────────────────────────────────

export type TargetKind =
  | 'stakeholder'
  | 'V'
  | 'S'
  | 'cost'
  | 'constraint'
  | 'category' // 'Values' / 'Costs' / 'Constraints' as meta-categories on layer 2

export interface Ranking {
  /** stakeholder name, V.id, S.id, or category label */
  targetId: string
  targetKind: TargetKind
  /** 1 = highest. Ties allowed. */
  rank: number
  /** 0..100 — used by layer 2 for category weights and optionally per-entry */
  weight?: number
}

export interface RankingSet {
  name: string
  /** All targetIds in this set share `rank` */
  targetIds: string[]
  rank: number
}

// ── Prioritisation Constraints (the new idea) ────────────────────────────────

export type ConstraintKind =
  | 'floor'        // weight(targetId) ≥ minPercent
  | 'ceiling'      // weight(targetId) ≤ maxPercent
  | 'order'        // targetIds[0] must rank STRICTLY BELOW targetIds[1]
  | 'untouchable'  // targetIds may NOT be re-ranked from their current position
  | 'free'         // free-text declarative limit (LLM-readable, not enforced numerically)

export const CONSTRAINT_LABEL: Record<ConstraintKind, string> = {
  floor: 'Floor (weight ≥ N%)',
  ceiling: 'Ceiling (weight ≤ N%)',
  order: 'Order (A must rank below B)',
  untouchable: 'Untouchable (locked)',
  free: 'Free-text limit',
}

export interface PrioritisationConstraint {
  id: string
  kind: ConstraintKind
  targetIds: string[]
  minPercent?: number
  maxPercent?: number
  /** Human-readable rationale shown in tooltips + audit + LLM prompts */
  note: string
}

// ── Consequence diff (for "what changed", mirrors SharpenPanel pattern) ──────

export interface ConsequenceDiffEntry {
  entryId: string
  entryKind: 'F' | 'V' | 'S' | 'stakeholder'
  field: string
  before: string | number
  after: string | number
}

// ── Per-layer record ─────────────────────────────────────────────────────────

export interface GlobalPriorityRecord {
  id: string
  planModelId: string
  layer: PriorityLayer

  rankings: Ranking[]
  sets: RankingSet[]
  constraints: PrioritisationConstraint[]

  // Same metadata triple as the per-entry PriorityRecord
  source: string
  authority: string
  purposes: string

  // Audit / notification
  notifyOwners: boolean
  notifyExtra: string[]
  notifySkip: boolean

  // Apply / revert lifecycle
  status: 'draft' | 'applied' | 'reverted'
  appliedAt?: string

  // Snapshot of changes when last applied
  consequenceDiff: ConsequenceDiffEntry[]

  createdAt: string
  updatedAt: string
}

// ── Replan-from-Evo-Feedback (Planguage-fidelity priority) ───────────────────
//
// Per Tom: "the primary prioritization in Planguage is reaching Value Wishes
// with all constraints (binary and scalar, including all Budgets, and all
// remaining resources from initial budgets)."  After each Evo step we want to:
//
//   1. Refresh value-accomplishment % per V. (current vs goal vs wish)
//   2. Refresh remaining-budget % per resource (time / people / money / …)
//   3. Surface real priority dilemmas (shortfall vs depleted budget,
//      wish-blocked-by-budget, late-stakeholder-uncovered, …)
//   4. Seed a planner conversation so the planner can resolve them.
//
// This is rule-based MVP — no AI call, no auto-decisions; the analysis runs on
// whatever data the panel hands in (spec + actuals + budget snapshots) and
// returns Dilemma cards plus a markdown prompt the planner can paste into any
// LLM surface (or the Spec Coach).

/** A budget envelope: time, people, money, or any custom resource. */
export interface BudgetState {
  /** "Calendar weeks", "Engineer-weeks", "USD", "Story-points", … */
  name: string
  /** What we started the increment with */
  initialAmount: number
  /** What's left right now (after Evo step feedback) */
  remainingAmount: number
  unit: string
}

/** Snapshot of how a single Value is doing right now vs goal/wish. */
export interface ValueProgress {
  valueId: string
  description: string
  /** Latest measured value (numeric extract from VEntry.status, or supplied) */
  current: number
  /** Tolerable threshold (numeric extract from VEntry.tolerable) */
  tolerable: number | null
  /** Goal threshold (numeric extract from VEntry.goal) */
  goal: number | null
  /** Wish threshold (numeric extract from VEntry.wish), if any */
  wish: number | null
  /** 0–1 scale: how close current is to goal (clamped) */
  goalAccomplishment: number
  /** 0–1 scale: how close current is to wish (clamped, null if no wish) */
  wishAccomplishment: number | null
}

export type DilemmaKind =
  | 'value-shortfall'    // Value is below goal AND budget is depleted
  | 'budget-overrun'     // Budget remaining < expected for stage
  | 'wish-vs-budget'     // Wish out of reach without breaking a budget
  | 'rebalance'          // Two values competing for the same scarce resource
  | 'untouchable-blocked' // An untouchable constraint conflicts with feedback

export interface Dilemma {
  id: string
  kind: DilemmaKind
  title: string
  /** Human-readable narrative — used in cards AND in the conversation seed */
  narrative: string
  /** Concrete options the planner could choose between */
  options: string[]
  /** IDs of affected V./S./budgets — for hover-highlighting in the panel */
  refs: string[]
}

// ── Suggestion lists (extend the per-entry suggestions) ──────────────────────

export const GLOBAL_PRIORITY_SUGGESTIONS: Record<string, string[]> = {
  source: [
    'Annual strategy review',
    'Stakeholder workshop output',
    'Board mandate',
    'Quarterly OKR alignment',
    'Risk register update',
    'Customer-segment shift',
    'Funding round constraints',
    'Competitor move',
    'Regulatory change',
    'Post-mortem learning',
  ],
  authority: [
    'CEO',
    'Board of Directors',
    'Steering committee',
    'Product leadership team',
    'Programme sponsor',
    'Customer Advisory Board',
    'Regulatory body',
    'Spec Owners (collective)',
    'Architecture Review Board',
    'Cross-functional council',
  ],
  purposes: [
    'Refocus on strategic value',
    'De-risk the plan',
    'Accelerate time-to-value',
    'Rebalance after a market shift',
    'Honour a regulatory commitment',
    'Reduce cognitive load on the team',
    'Sequence delivery for funding milestones',
    'Resolve cross-stakeholder conflict',
    'Simplify the solution set',
    'Reflect new risk appetite',
  ],
}

// ── Singleton storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-global-priority-records'

const _store = ref<Record<string, GlobalPriorityRecord[]>>(
  (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
    catch { return {} }
  })(),
)

function _persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_store.value))
}

function _uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useGlobalPriority(planModelId: string) {

  const records = computed<GlobalPriorityRecord[]>(
    () => _store.value[planModelId] ?? [],
  )

  /** Latest record for a given layer (or null) */
  function getLayerRecord(layer: PriorityLayer): GlobalPriorityRecord | null {
    const matches = records.value.filter(r => r.layer === layer)
    if (!matches.length) return null
    return matches.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
  }

  function _empty(layer: PriorityLayer): GlobalPriorityRecord {
    const now = new Date().toISOString()
    return {
      id: _uid(),
      planModelId,
      layer,
      rankings: [],
      sets: [],
      constraints: [],
      source: '',
      authority: '',
      purposes: '',
      notifyOwners: true,
      notifyExtra: [],
      notifySkip: false,
      status: 'draft',
      consequenceDiff: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  /** Create or update the record for a layer (single record per layer) */
  function upsertLayerRecord(
    layer: PriorityLayer,
    patch: Partial<Omit<GlobalPriorityRecord, 'id' | 'planModelId' | 'layer' | 'createdAt' | 'updatedAt'>>,
  ): GlobalPriorityRecord {
    const now = new Date().toISOString()
    const existing = getLayerRecord(layer)

    if (existing) {
      const updated: GlobalPriorityRecord = { ...existing, ...patch, updatedAt: now }
      _store.value = {
        ..._store.value,
        [planModelId]: records.value.map(r => r.id === existing.id ? updated : r),
      }
      _persist()
      return updated
    }

    const fresh: GlobalPriorityRecord = { ..._empty(layer), ...patch, updatedAt: now, layer }
    _store.value = {
      ..._store.value,
      [planModelId]: [...records.value, fresh],
    }
    _persist()
    return fresh
  }

  /** Add a constraint to a layer's record */
  function addConstraint(layer: PriorityLayer, constraint: Omit<PrioritisationConstraint, 'id'>): PrioritisationConstraint {
    const fresh: PrioritisationConstraint = { id: _uid(), ...constraint }
    const rec = getLayerRecord(layer) ?? _empty(layer)
    upsertLayerRecord(layer, { constraints: [...rec.constraints, fresh] })
    return fresh
  }

  function removeConstraint(layer: PriorityLayer, constraintId: string): void {
    const rec = getLayerRecord(layer)
    if (!rec) return
    upsertLayerRecord(layer, { constraints: rec.constraints.filter(c => c.id !== constraintId) })
  }

  /**
   * Validate a list of rankings against constraints. Returns an array of
   * human-readable violation messages (empty = valid). Used by the UI to
   * disable Apply + show inline warnings.
   */
  function validate(layer: PriorityLayer, rankings: Ranking[]): string[] {
    const rec = getLayerRecord(layer)
    if (!rec) return []
    const out: string[] = []
    for (const c of rec.constraints) {
      if (c.kind === 'floor' && c.minPercent != null) {
        for (const tid of c.targetIds) {
          const r = rankings.find(x => x.targetId === tid)
          if (r && (r.weight ?? 0) < c.minPercent) {
            out.push(`${tid}: weight ${r.weight ?? 0}% is below floor of ${c.minPercent}% (${c.note || 'no rationale'})`)
          }
        }
      } else if (c.kind === 'ceiling' && c.maxPercent != null) {
        for (const tid of c.targetIds) {
          const r = rankings.find(x => x.targetId === tid)
          if (r && (r.weight ?? 0) > c.maxPercent) {
            out.push(`${tid}: weight ${r.weight ?? 0}% exceeds ceiling of ${c.maxPercent}% (${c.note || 'no rationale'})`)
          }
        }
      } else if (c.kind === 'order' && c.targetIds.length === 2) {
        const [a, b] = c.targetIds
        const ra = rankings.find(x => x.targetId === a)
        const rb = rankings.find(x => x.targetId === b)
        if (ra && rb && ra.rank <= rb.rank) {
          out.push(`${a} must rank strictly BELOW ${b} — currently ranks ${ra.rank} vs ${rb.rank} (${c.note || 'no rationale'})`)
        }
      }
      // 'untouchable' is enforced at edit-time by the UI (locks the row).
      // 'free' is informational, never auto-fails.
    }
    return out
  }

  /**
   * Build a consequence diff by comparing previous rankings (the last applied
   * snapshot) with the new draft rankings. Generic across layers.
   */
  function buildDiff(
    layer: PriorityLayer,
    newRankings: Ranking[],
    newSets: RankingSet[],
  ): ConsequenceDiffEntry[] {
    const prev = getLayerRecord(layer)
    const prevRankings = prev?.rankings ?? []
    const out: ConsequenceDiffEntry[] = []

    const kindFor = (r: Ranking): ConsequenceDiffEntry['entryKind'] => {
      if (r.targetKind === 'V') return 'V'
      if (r.targetKind === 'S') return 'S'
      if (r.targetKind === 'stakeholder') return 'stakeholder'
      return 'F' // covers 'cost' / 'constraint' / 'category' under a generic bucket
    }

    for (const nr of newRankings) {
      const pr = prevRankings.find(x => x.targetId === nr.targetId)
      if (!pr) {
        out.push({ entryId: nr.targetId, entryKind: kindFor(nr), field: 'rank', before: '—', after: nr.rank })
        if (nr.weight != null) out.push({ entryId: nr.targetId, entryKind: kindFor(nr), field: 'weight', before: '—', after: `${nr.weight}%` })
        continue
      }
      if (pr.rank !== nr.rank) {
        out.push({ entryId: nr.targetId, entryKind: kindFor(nr), field: 'rank', before: pr.rank, after: nr.rank })
      }
      if ((pr.weight ?? null) !== (nr.weight ?? null)) {
        out.push({
          entryId: nr.targetId, entryKind: kindFor(nr), field: 'weight',
          before: pr.weight == null ? '—' : `${pr.weight}%`,
          after: nr.weight == null ? '—' : `${nr.weight}%`,
        })
      }
    }
    // Set additions are reported as a single line per set
    for (const ns of newSets) {
      out.push({
        entryId: `set:${ns.name}`,
        entryKind: 'F',
        field: 'set members',
        before: '—',
        after: `${ns.targetIds.length} members @ rank ${ns.rank}`,
      })
    }
    return out
  }

  /**
   * Apply the current draft for a layer: persists the diff, sets status to
   * 'applied', stamps appliedAt. Returns the diff for UI feedback.
   */
  function applyLayer(
    layer: PriorityLayer,
    rankings: Ranking[],
    sets: RankingSet[],
  ): { diff: ConsequenceDiffEntry[]; record: GlobalPriorityRecord } {
    const diff = buildDiff(layer, rankings, sets)
    const record = upsertLayerRecord(layer, {
      rankings,
      sets,
      consequenceDiff: diff,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    })
    return { diff, record }
  }

  /** Roll back to status='reverted' (keeps history) */
  function revertLayer(layer: PriorityLayer): void {
    const rec = getLayerRecord(layer)
    if (!rec) return
    upsertLayerRecord(layer, { status: 'reverted', appliedAt: undefined })
  }

  /** True if any layer has an applied record — for the Detail menu badge */
  const hasAnyApplied = computed<boolean>(() =>
    records.value.some(r => r.status === 'applied'),
  )

  /** Roll-up counts per layer for the panel summary */
  const layerCounts = computed<Record<PriorityLayer, { ranked: number; constraints: number; status: GlobalPriorityRecord['status'] | 'none' }>>(() => {
    const empty = { ranked: 0, constraints: 0, status: 'none' as const }
    const out = {
      stakeholders: { ...empty },
      'values-costs-constraints': { ...empty },
      solutions: { ...empty },
    } as Record<PriorityLayer, { ranked: number; constraints: number; status: GlobalPriorityRecord['status'] | 'none' }>
    for (const r of records.value) {
      out[r.layer] = {
        ranked: r.rankings.length + r.sets.reduce((n, s) => n + s.targetIds.length, 0),
        constraints: r.constraints.length,
        status: r.status,
      }
    }
    return out
  })

  return {
    records,
    getLayerRecord,
    upsertLayerRecord,
    addConstraint,
    removeConstraint,
    validate,
    buildDiff,
    applyLayer,
    revertLayer,
    hasAnyApplied,
    layerCounts,
  }
}

// ── Pure helpers for Replan-from-Evo-Feedback (exported for testability) ─────

/**
 * Extract the first numeric token from a Planguage scale value such as
 * "Status [2026-Q2] 73 visits/day" or "Goal [Launch] 90".  Returns null when
 * the string holds no number — the dilemma analyser treats null as "unknown"
 * and degrades gracefully (does not assert a shortfall against unknown data).
 */
export function extractNumeric(s: string | undefined | null): number | null {
  if (!s) return null
  // Planguage qualifiers live inside [brackets] — dates, conditions, etc.
  // Strip them so "Status [2026-Q2] 73 visits/day" yields 73, not 2026.
  const stripped = s.replace(/\[[^\]]*\]/g, ' ')
  const m = stripped.match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

/** Build a per-Value progress snapshot from a spec — uses VEntry.status / .goal / .wish */
export function buildValueProgress(values: VEntry[]): ValueProgress[] {
  return values.map(v => {
    const current   = extractNumeric(v.status) ?? 0
    const tolerable = extractNumeric(v.tolerable)
    const goal      = extractNumeric(v.goal)
    const wish      = extractNumeric(v.wish ?? '')
    const goalAcc   = goal != null && goal !== 0 ? clamp01(current / goal) : 0
    const wishAcc   = wish != null && wish !== 0 ? clamp01(current / wish) : null
    return {
      valueId: v.id,
      description: v.description ?? v.id,
      current,
      tolerable,
      goal,
      wish,
      goalAccomplishment: goalAcc,
      wishAccomplishment: wishAcc,
    }
  })
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/**
 * Analyse the current state of the plan against budgets to surface concrete
 * priority dilemmas the planner needs to resolve.  Rule-based, no AI calls.
 *
 * Heuristics (intentionally conservative — we'd rather under-flag than spam):
 *  - value-shortfall   → goalAccomplishment < 0.5 AND ANY budget remaining < 25%
 *  - wish-vs-budget    → wish present, wishAccomplishment < 0.6, ANY budget < 35%
 *  - budget-overrun    → ANY budget remaining < 15% (regardless of value progress)
 *  - rebalance         → 2+ values both < 0.6 goalAccomplishment AND budgets < 50%
 */
export function analyseDilemmas(
  spec: SpecBlock,
  budgets: BudgetState[],
  opts: { progressOverrides?: ValueProgress[] } = {},
): Dilemma[] {
  const progress = opts.progressOverrides ?? buildValueProgress(spec.values)
  const dilemmas: Dilemma[] = []
  const tightBudgets = budgets.filter(b => b.initialAmount > 0 && (b.remainingAmount / b.initialAmount) < 0.25)
  const veryTight    = budgets.filter(b => b.initialAmount > 0 && (b.remainingAmount / b.initialAmount) < 0.15)
  const moderateTight = budgets.filter(b => b.initialAmount > 0 && (b.remainingAmount / b.initialAmount) < 0.5)

  // 1. value-shortfall
  for (const p of progress) {
    if (p.goal != null && p.goalAccomplishment < 0.5 && tightBudgets.length) {
      dilemmas.push({
        id: `shortfall-${p.valueId}`,
        kind: 'value-shortfall',
        title: `${p.valueId} is short of Goal with budget tight`,
        narrative: `${p.description}: current ${p.current} vs Goal ${p.goal} (${Math.round(p.goalAccomplishment * 100)}% of goal). Budgets running low: ${tightBudgets.map(b => `${b.name} ${Math.round((b.remainingAmount / b.initialAmount) * 100)}%`).join(', ')}.`,
        options: [
          `Lower Goal toward Tolerable for ${p.valueId} this increment`,
          `Re-allocate from a less-critical Value's solution`,
          `Defer to next increment and accept the shortfall`,
        ],
        refs: [p.valueId, ...tightBudgets.map(b => `budget:${b.name}`)],
      })
    }
  }

  // 2. wish-vs-budget
  for (const p of progress) {
    if (p.wish != null && (p.wishAccomplishment ?? 0) < 0.6 && moderateTight.length) {
      dilemmas.push({
        id: `wish-${p.valueId}`,
        kind: 'wish-vs-budget',
        title: `Wish for ${p.valueId} drifting out of reach`,
        narrative: `Stakeholder Wish was ${p.wish}; current ${p.current} = ${Math.round((p.wishAccomplishment ?? 0) * 100)}% of Wish. With ${moderateTight.map(b => b.name).join(' / ')} below 50%, hitting Wish likely needs trade-offs.`,
        options: [
          `Confirm Goal stays as-is and treat Wish as aspirational only`,
          `Find a cheaper solution path that still moves toward Wish`,
          `Negotiate with the Wish stakeholder on a revised aspiration`,
        ],
        refs: [p.valueId, ...moderateTight.map(b => `budget:${b.name}`)],
      })
    }
  }

  // 3. budget-overrun
  for (const b of veryTight) {
    dilemmas.push({
      id: `budget-${b.name}`,
      kind: 'budget-overrun',
      title: `${b.name} budget below 15%`,
      narrative: `${b.name} started at ${b.initialAmount} ${b.unit}, only ${b.remainingAmount} ${b.unit} (${Math.round((b.remainingAmount / b.initialAmount) * 100)}%) left. Any further commitment without re-prioritisation will overrun.`,
      options: [
        `Freeze new ${b.name} commitments until next increment`,
        `Request a budget top-up from sponsor`,
        `Drop the lowest-priority solution to free ${b.name}`,
      ],
      refs: [`budget:${b.name}`],
    })
  }

  // 4. rebalance — multiple values short with shared scarcity
  const shortValues = progress.filter(p => p.goal != null && p.goalAccomplishment < 0.6)
  if (shortValues.length >= 2 && moderateTight.length) {
    dilemmas.push({
      id: 'rebalance-multi',
      kind: 'rebalance',
      title: `${shortValues.length} Values competing for the same scarce resources`,
      narrative: `${shortValues.map(p => p.valueId).join(', ')} are all under 60% of Goal while ${moderateTight.map(b => b.name).join(' / ')} are tight. The current relative priority no longer matches what the budget can fund.`,
      options: [
        `Re-rank these Values now (open the V·C·C layer)`,
        `Sequence them — fund top-priority first, defer the rest`,
        `Apply a Ceiling constraint on the lowest-priority Value's budget share`,
      ],
      refs: shortValues.map(p => p.valueId),
    })
  }

  return dilemmas
}

/**
 * Build a markdown prompt the planner can paste into Spec Coach / any LLM to
 * resolve the dilemmas conversationally.  Includes the spec context, current
 * progress, budget state, and the dilemma options as a decision menu.
 */
export function seedPlannerConversation(
  dilemmas: Dilemma[],
  budgets: BudgetState[],
  progress: ValueProgress[],
): string {
  if (!dilemmas.length) {
    return 'After this Evo step, no priority dilemmas detected. Plan can continue as-is — re-check after the next step.'
  }
  const lines: string[] = []
  lines.push('# Replan Conversation — after Evo step feedback')
  lines.push('')
  lines.push('## Where the plan stands')
  lines.push('')
  lines.push('### Value progress (current vs Goal vs Wish)')
  for (const p of progress) {
    const goalStr = p.goal != null ? `${Math.round(p.goalAccomplishment * 100)}% of Goal (${p.current}/${p.goal})` : '— no Goal set'
    const wishStr = p.wish != null ? `, ${Math.round((p.wishAccomplishment ?? 0) * 100)}% of Wish (${p.wish})` : ''
    lines.push(`- **${p.valueId}** — ${goalStr}${wishStr}`)
  }
  lines.push('')
  lines.push('### Budgets remaining')
  for (const b of budgets) {
    const pct = b.initialAmount > 0 ? Math.round((b.remainingAmount / b.initialAmount) * 100) : 0
    lines.push(`- **${b.name}** — ${b.remainingAmount}/${b.initialAmount} ${b.unit} (${pct}%)`)
  }
  lines.push('')
  lines.push(`## Priority dilemmas to resolve (${dilemmas.length})`)
  lines.push('')
  for (const d of dilemmas) {
    lines.push(`### ${d.title}`)
    lines.push('')
    lines.push(d.narrative)
    lines.push('')
    lines.push('**Options:**')
    for (const opt of d.options) lines.push(`- ${opt}`)
    lines.push('')
  }
  lines.push('## Your turn, planner')
  lines.push('')
  lines.push('For each dilemma, pick one option (or propose a new one) and explain the source / authority / purpose. We will record the decision as a Global Priority record so the next replan starts from solid ground.')
  return lines.join('\n')
}
