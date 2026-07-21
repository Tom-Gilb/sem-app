/**
 * usePlanScopeFramework — Plan-level scope + budget + start-events framework.
 *
 * v503 (2026-07-21) — extracted from ResourcesSharpenPanel.vue after Tom Gilb
 * verbatim: "Their needs to be opportunity to capture these project resources
 * idea at the beginning of the project, and to see their status at any overview
 * of the project, and to see they are not determined yet, and to change them
 * any time (tracking source for them as with all other specs)".
 *
 * Design shape (evolved v500 → v501 → v502 → v503):
 *   DEADLINE      = specific date OR N units from project start
 *   PROJECT START = set of standard events + custom (project starts when ALL fire)
 *   BUDGET        = presence (yes/no/undecided) + one or more of 6 typed amounts
 *   SOURCE        = per-section provenance (planner / ai / contract / imported /
 *                   external / undetermined) with optional citation text
 *
 * Persistence: per-plan localStorage key
 *   `sem-app:plan-scope-framework:v1:<planId>`
 *
 * Reusable: import `usePlanScopeFramework(planIdRef)` from any panel /
 * overview / status strip.  All consumers share the SAME reactive state
 * per planId (module-level cache).
 */

import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'

// ── Public types ────────────────────────────────────────────────────────────

export type HorizonUnit    = 'days' | 'weeks' | 'months' | 'years'
export type DeadlineMode   = 'date' | 'from-start' | null
export type BudgetPresence = 'yes' | 'no' | 'undecided' | null
export type BudgetType     = 'total' | 'annual' | 'suggested' | 'contracted' | 'fixed' | 'paidOut'

/**
 * Source attribution per section — mirrors the Source Attribution SUPREME rule
 * pattern used across specs.  `undetermined` is the honest state for "not yet
 * answered by any source" (r93mmm Infinity-Trap avoidance).
 */
export type SourceKind = 'planner' | 'ai' | 'contract' | 'imported' | 'external' | 'undetermined'

export interface SourceInfo {
  kind: SourceKind
  at:   string | null    // ISO timestamp of last set; null = never set
  note: string           // free-text citation ('Contract §4.2', 'Kickoff meeting', etc.)
}

export const BUDGET_TYPES: Array<{ id: BudgetType; label: string; hint: string }> = [
  { id: 'total',      label: 'Total',       hint: 'Total budget for the whole plan horizon' },
  { id: 'annual',     label: 'Annual',      hint: 'Budget per calendar year' },
  { id: 'suggested',  label: 'Suggested',   hint: 'Ballpark suggestion — not yet contracted' },
  { id: 'contracted', label: 'Contracted',  hint: 'Formally contracted amount' },
  { id: 'fixed',      label: 'Fixed',       hint: 'Fixed ceiling that cannot be exceeded' },
  { id: 'paidOut',    label: 'Paid Out',    hint: 'Actual amount paid out to date' },
]

export const START_EVENT_META: Array<{ id: string; glyph: string; label: string; hint: string }> = [
  { id: 'startPlanningStarted',      glyph: '🗓', label: 'Planning Started',          hint: 'Planning phase has started' },
  { id: 'startContractSigned',       glyph: '📝', label: 'Contract Signed',           hint: 'Client contract formally signed' },
  { id: 'startBudgetApproved',       glyph: '💰', label: 'Budget Approved',           hint: 'Financial authorisation obtained' },
  { id: 'startPlanApproved',         glyph: '✅', label: 'Plan Approved',             hint: 'Plan formally accepted by owner' },
  { id: 'startStaffReady',           glyph: '👥', label: 'Staff Ready',               hint: 'Staff/team allocated and ready to begin' },
  { id: 'startFirstEvoStepsStarted', glyph: '🚀', label: 'First Evo Steps Started',   hint: 'Execution kickoff — Stage 6 → 7 boundary' },
]

export interface PlanScopeFramework {
  // Deadline
  deadlineMode:            DeadlineMode
  deadlineDate:            string | null
  deadlineFromStartValue:  number | null
  deadlineFromStartUnit:   HorizonUnit
  // Project start events (six standard + one custom)
  startPlanningStarted:      boolean
  startContractSigned:       boolean
  startBudgetApproved:       boolean
  startPlanApproved:         boolean
  startStaffReady:           boolean
  startFirstEvoStepsStarted: boolean
  startCustomEventLabel:     string
  startCustomEventChecked:   boolean
  // Budget
  hasBudget:               BudgetPresence
  budgetAmounts:           Partial<Record<BudgetType, number>>
  // v503 — Source attribution per section (Source Attribution SUPREME).
  // `undetermined` on all three at first load; planner marks them as they answer.
  sourceDeadline:          SourceInfo
  sourceStartEvents:       SourceInfo
  sourceBudget:            SourceInfo
}

// ── Defaults + migration ────────────────────────────────────────────────────

export function emptyPlanScopeFramework(): PlanScopeFramework {
  const undet: SourceInfo = { kind: 'undetermined', at: null, note: '' }
  return {
    deadlineMode:              null,
    deadlineDate:              null,
    deadlineFromStartValue:    null,
    deadlineFromStartUnit:     'months',
    startPlanningStarted:      false,
    startContractSigned:       false,
    startBudgetApproved:       false,
    startPlanApproved:         false,
    startStaffReady:           false,
    startFirstEvoStepsStarted: false,
    startCustomEventLabel:     '',
    startCustomEventChecked:   false,
    hasBudget:                 null,
    budgetAmounts:             {},
    sourceDeadline:            { ...undet },
    sourceStartEvents:         { ...undet },
    sourceBudget:              { ...undet },
  }
}

function _parseSource(raw: unknown): SourceInfo {
  const out: SourceInfo = { kind: 'undetermined', at: null, note: '' }
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  if (['planner','ai','contract','imported','external','undetermined'].includes(r.kind as string)) out.kind = r.kind as SourceKind
  if (typeof r.at === 'string') out.at = r.at
  if (typeof r.note === 'string') out.note = r.note
  return out
}

function _loadFromStorage(key: string): PlanScopeFramework {
  const next = emptyPlanScopeFramework()
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return next
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // v501/v502 shape
    if (parsed.deadlineMode === 'date' || parsed.deadlineMode === 'from-start') next.deadlineMode = parsed.deadlineMode
    if (typeof parsed.deadlineDate === 'string') next.deadlineDate = parsed.deadlineDate
    if (typeof parsed.deadlineFromStartValue === 'number') next.deadlineFromStartValue = parsed.deadlineFromStartValue
    if (['days','weeks','months','years'].includes(parsed.deadlineFromStartUnit as string)) next.deadlineFromStartUnit = parsed.deadlineFromStartUnit as HorizonUnit
    next.startPlanningStarted      = !!parsed.startPlanningStarted
    next.startContractSigned       = !!parsed.startContractSigned
    next.startBudgetApproved       = !!parsed.startBudgetApproved
    next.startPlanApproved         = !!parsed.startPlanApproved
    next.startStaffReady           = !!parsed.startStaffReady
    next.startFirstEvoStepsStarted = !!parsed.startFirstEvoStepsStarted
    next.startCustomEventLabel     = typeof parsed.startCustomEventLabel  === 'string' ? parsed.startCustomEventLabel : ''
    next.startCustomEventChecked   = !!parsed.startCustomEventChecked
    if (parsed.hasBudget === 'yes' || parsed.hasBudget === 'no' || parsed.hasBudget === 'undecided') next.hasBudget = parsed.hasBudget
    if (parsed.budgetAmounts && typeof parsed.budgetAmounts === 'object') {
      for (const t of ['total','annual','suggested','contracted','fixed','paidOut'] as BudgetType[]) {
        const v = (parsed.budgetAmounts as Record<string, unknown>)[t]
        if (typeof v === 'number') next.budgetAmounts[t] = v
      }
    }
    // v500 → v501 forward migration (still supported)
    if (typeof parsed.horizonValue === 'number' && next.deadlineMode === null) {
      next.deadlineMode = 'from-start'
      next.deadlineFromStartValue = parsed.horizonValue as number
      if (['days','weeks','months','years'].includes(parsed.horizonUnit as string)) next.deadlineFromStartUnit = parsed.horizonUnit as HorizonUnit
    }
    if (typeof parsed.annualCapitalBudget === 'number' && !next.budgetAmounts.annual) {
      next.budgetAmounts.annual = parsed.annualCapitalBudget as number
      if (next.hasBudget === null) next.hasBudget = 'yes'
    }
    if (typeof parsed.totalCapitalBudget === 'number' && !next.budgetAmounts.total) {
      next.budgetAmounts.total = parsed.totalCapitalBudget as number
      if (next.hasBudget === null) next.hasBudget = 'yes'
    }
    // v503 — source attribution fields (undetermined if missing from older shapes)
    next.sourceDeadline    = _parseSource(parsed.sourceDeadline)
    next.sourceStartEvents = _parseSource(parsed.sourceStartEvents)
    next.sourceBudget      = _parseSource(parsed.sourceBudget)
  } catch { /* corrupt storage — return empty */ }
  return next
}

// ── Module-level cache (shared across consumers per planId) ─────────────────
// Multiple panels can subscribe to the same planId + see the same live state.

const _cache = new Map<string, Ref<PlanScopeFramework>>()

/**
 * v516 (2026-07-21) — Tom Gilb: *"i have a deadline and budget, from earlier,
 * but they do not show up in the top of stage 1"*.
 *
 * Root cause: Stage 1 (SEMEntryForm) and Stage 10 (ResourcesSharpenPanel)
 * derive their planId from different sources.  When the same session moves
 * between surfaces without a consistent plan-name/spec-name state, the two
 * surfaces end up reading from different `sem-app:plan-scope-framework:v1:*`
 * keys — one populated (where the user entered data) and one empty (where the
 * user expects to see it).
 *
 * A framework is "empty" when:
 *   - deadlineMode is null (no deadline expression picked)
 *   - hasBudget is null (no budget answer given — Yes/No/Undecided all count)
 *   - no start-event checkbox is ticked
 *   - all budgetAmounts are missing/zero
 *
 * When the requested planId's framework is empty AND another planId key in
 * localStorage carries a populated framework, adopt the sibling's data under
 * the current planId.  Silent, one-time consolidation.  Idempotent (empty
 * everywhere = no-op).  No-Silent-Data-Loss SUPREME satisfied — the user's
 * data resurfaces, never gets discarded.
 */
function _isFrameworkPopulated(f: PlanScopeFramework): boolean {
  if (f.deadlineMode !== null) return true
  if (f.hasBudget !== null) return true
  if (f.startPlanningStarted || f.startContractSigned || f.startBudgetApproved ||
      f.startPlanApproved || f.startStaffReady || f.startFirstEvoStepsStarted ||
      f.startCustomEventChecked) return true
  for (const t of ['total','annual','suggested','contracted','fixed','paidOut'] as BudgetType[]) {
    const v = f.budgetAmounts[t]
    if (typeof v === 'number' && v > 0) return true
  }
  return false
}

function _findAnyPopulatedFrameworkExcept(currentKey: string): PlanScopeFramework | null {
  const prefix = 'sem-app:plan-scope-framework:v1:'
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(prefix) || k === currentKey) continue
      const candidate = _loadFromStorage(k)
      if (_isFrameworkPopulated(candidate)) return candidate
    }
  } catch { /* silent — localStorage unavailable */ }
  return null
}

function _getState(planId: string): Ref<PlanScopeFramework> {
  let cached = _cache.get(planId)
  if (cached) return cached
  const key = `sem-app:plan-scope-framework:v1:${planId}`
  let initial = _loadFromStorage(key)
  // v516: consolidation on first read.  Silent one-time adoption of any sibling
  // planId's populated framework into the current planId — surfaces the user's
  // data on whichever surface they land on next.
  if (!_isFrameworkPopulated(initial)) {
    const found = _findAnyPopulatedFrameworkExcept(key)
    if (found) {
      initial = found
      try { localStorage.setItem(key, JSON.stringify(initial)) } catch { /* quota */ }
      console.info('[plan-scope-framework] consolidated a sibling planId framework into', planId)
    }
  }
  const state = ref<PlanScopeFramework>(initial)
  watch(state, (v) => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* quota */ }
  }, { deep: true })
  _cache.set(planId, state)
  return state
}

// ── Public composable API ──────────────────────────────────────────────────

export interface UsePlanScopeFramework {
  state:                    Ref<PlanScopeFramework>
  isDeadlineDetermined:     ComputedRef<boolean>
  isStartEventsDetermined:  ComputedRef<boolean>
  isBudgetDetermined:       ComputedRef<boolean>
  isFullyDetermined:        ComputedRef<boolean>
  projectStartEventCount:   ComputedRef<number>
  budgetTypeCount:          ComputedRef<number>
  deadlineHumanReadable:    ComputedRef<string>   // "18 months from project start" | "2027-06-30" | "not yet determined"
  budgetHumanReadable:      ComputedRef<string>   // "Contracted $500,000 + Annual $180,000" | "No budget" | "not yet determined"
  resetAll:                 () => void
  // v514 — envelope round-trip
  getSnapshot:              () => PlanScopeFramework
  hydrateFromSnapshot:      (snap: PlanScopeFramework) => void
}

export function usePlanScopeFramework(planIdRef: Ref<string> | ComputedRef<string>): UsePlanScopeFramework {
  // The state cache is per-planId; when planId changes, swap the ref target.
  const activeState = computed(() => _getState(planIdRef.value))
  // Convenience proxy: mutations go through activeState.value.
  const state = computed<PlanScopeFramework>({
    get: () => activeState.value.value,
    set: (v) => { activeState.value.value = v },
  })

  const isDeadlineDetermined = computed(() => {
    const s = state.value
    if (s.deadlineMode === null) return false
    if (s.deadlineMode === 'date')       return !!s.deadlineDate
    if (s.deadlineMode === 'from-start') return typeof s.deadlineFromStartValue === 'number'
    return false
  })
  const isStartEventsDetermined = computed(() => {
    const s = state.value
    if (s.deadlineMode !== 'from-start') return true  // events only relevant if we have a from-start deadline
    return s.startPlanningStarted || s.startContractSigned || s.startBudgetApproved
      || s.startPlanApproved || s.startStaffReady || s.startFirstEvoStepsStarted
      || (s.startCustomEventChecked && s.startCustomEventLabel.trim().length > 0)
  })
  const isBudgetDetermined = computed(() => {
    const s = state.value
    if (s.hasBudget === null) return false
    if (s.hasBudget === 'no' || s.hasBudget === 'undecided') return true  // an honest "no" is a determination
    return Object.keys(s.budgetAmounts).length > 0
  })
  const isFullyDetermined = computed(() =>
    isDeadlineDetermined.value && isStartEventsDetermined.value && isBudgetDetermined.value
  )

  const projectStartEventCount = computed(() => {
    const s = state.value
    let n = 0
    if (s.startPlanningStarted)       n++
    if (s.startContractSigned)        n++
    if (s.startBudgetApproved)        n++
    if (s.startPlanApproved)          n++
    if (s.startStaffReady)            n++
    if (s.startFirstEvoStepsStarted)  n++
    if (s.startCustomEventChecked && s.startCustomEventLabel.trim()) n++
    return n
  })
  const budgetTypeCount = computed(() => Object.keys(state.value.budgetAmounts).length)

  const deadlineHumanReadable = computed(() => {
    const s = state.value
    if (s.deadlineMode === 'date' && s.deadlineDate) return s.deadlineDate
    if (s.deadlineMode === 'from-start' && typeof s.deadlineFromStartValue === 'number') {
      return `${s.deadlineFromStartValue} ${s.deadlineFromStartUnit} from project start`
    }
    return 'not yet determined'
  })

  const budgetHumanReadable = computed(() => {
    const s = state.value
    if (s.hasBudget === 'no')        return 'No budget'
    if (s.hasBudget === 'undecided') return 'Undecided'
    if (s.hasBudget === null)        return 'not yet determined'
    const parts: string[] = []
    for (const t of BUDGET_TYPES) {
      const amount = s.budgetAmounts[t.id]
      if (typeof amount === 'number') parts.push(`${t.label} $${amount.toLocaleString()}`)
    }
    return parts.length > 0 ? parts.join(' · ') : 'Yes (amounts not yet entered)'
  })

  function resetAll(): void {
    state.value = emptyPlanScopeFramework()
  }

  // v514 — Envelope round-trip.  getSnapshot returns a deep-clone (no Proxy /
  // shared refs); hydrateFromSnapshot merges over defaults for backwards
  // compat + safe restore.
  function getSnapshot(): PlanScopeFramework {
    return JSON.parse(JSON.stringify(state.value))
  }
  function hydrateFromSnapshot(snap: PlanScopeFramework): void {
    if (!snap || typeof snap !== 'object') return
    const base = emptyPlanScopeFramework()
    const clean = JSON.parse(JSON.stringify(snap))
    state.value = {
      ...base,
      ...clean,
      budgetAmounts: { ...base.budgetAmounts, ...(clean.budgetAmounts ?? {}) },
    }
  }

  return {
    state,
    isDeadlineDetermined,
    isStartEventsDetermined,
    isBudgetDetermined,
    isFullyDetermined,
    projectStartEventCount,
    budgetTypeCount,
    deadlineHumanReadable,
    budgetHumanReadable,
    resetAll,
    getSnapshot,
    hydrateFromSnapshot,
  }
}
