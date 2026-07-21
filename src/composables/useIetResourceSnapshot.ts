/**
 * useIetResourceSnapshot — v507 (2026-07-21) — ESTIMATION 6.
 *
 * Tom Gilb 2026-07-21 verbatim:
 *   "ESTIMATION 6: IET/VDT The 3 (Capital, Time, Human Resource) will (most
 *   recent state based on any change in the VDT/IET be recorded and updated
 *   along with the IET data.  In addition the stipulated levels of the same
 *   3 resource can be kept in the same IET"
 *
 * Purpose: bind the 3 central resource estimations (from useResourceEstimations)
 * + the 3 stipulated resource budgets (from usePlanScopeFramework) to the IET
 * (Impact Estimation Table) / VDT (Value Delivery Table) as first-class
 * viewable + snapshotted data.  Every time the IET/VDT changes, a snapshot is
 * recorded so the audit trail carries the exact resource state at each IET
 * revision.
 *
 * Composes with:
 *  • v504 useResourceEstimations (source of the estimated series)
 *  • v503 usePlanScopeFramework  (source of the stipulated budgets)
 *  • v506 estimateFromEvoStepActuals (the Cleanroom auto-trigger that feeds
 *    the estimated series — every completed Evo Step re-calibrates the IET's
 *    resource snapshot on next render)
 *  • Twin portability — pure composable + module-level Map cache pattern,
 *    ports verbatim to Kai's Twin industrial planning app.
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  useResourceEstimations,
  type EstimatableResource,
  type Estimation,
} from './useResourceEstimations'
import { usePlanScopeFramework } from './usePlanScopeFramework'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CentralResourceValue {
  amount: number | null
  unit:   string            // "USD" / "weeks" / "FTE" / etc.
  label:  string            // human-readable one-line description
}

export interface IetResourceSnapshot {
  /** Timestamp of the snapshot (ISO). */
  timestamp: string
  /** Free-text reason (e.g. "IET cell updated", "Cost row edited"). */
  reason: string
  /** Estimated amounts at the moment of snapshot. */
  estimated: {
    capitalCost:     CentralResourceValue
    calendarTime:    CentralResourceValue
    specialistStaff: CentralResourceValue
    // v508 — ESTIMATION 7 OPEX
    annualOverhead:  CentralResourceValue
    technicalDebt:   CentralResourceValue
  }
  /** Stipulated (budgeted / official) amounts at the moment of snapshot. */
  stipulated: {
    capitalCost:     CentralResourceValue
    calendarTime:    CentralResourceValue
    specialistStaff: CentralResourceValue
    // v508 — ESTIMATION 7 OPEX
    annualOverhead:  CentralResourceValue
    technicalDebt:   CentralResourceValue
  }
}

// ── Module-level cache (Portfolio Pattern — shared reactive state per plan) ──

const _storeCache = new Map<string, Ref<IetResourceSnapshot[]>>()

function _storageKey(planId: string): string {
  return `iet-resource-snapshots:${planId}`
}

function _loadHistory(planId: string): IetResourceSnapshot[] {
  try {
    const raw = localStorage.getItem(_storageKey(planId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is IetResourceSnapshot => {
      return s && typeof s === 'object' && typeof s.timestamp === 'string'
        && s.estimated && s.stipulated
    })
  } catch {
    return []
  }
}

function _getHistory(planId: string): Ref<IetResourceSnapshot[]> {
  if (!_storeCache.has(planId)) {
    const r = ref<IetResourceSnapshot[]>(_loadHistory(planId))
    // Auto-persist on any mutation.
    watch(r, (val) => {
      try {
        // Cap the history at 200 to prevent unbounded growth.
        const capped = val.slice(-200)
        localStorage.setItem(_storageKey(planId), JSON.stringify(capped))
      } catch { /* quota — silent per v487 pattern */ }
    }, { deep: true })
    _storeCache.set(planId, r)
  }
  return _storeCache.get(planId)!
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get the most-recent Estimation for a given resource (latest by array order,
 *  since the series is append-only + timestamp-ordered).  Returns null if none. */
function latestForResource(list: Estimation[], resource: EstimatableResource): Estimation | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].resource === resource) return list[i]
  }
  return null
}

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString()} ${currency}`
}
function fmtTime(amount: number, unit: string): string {
  return `${amount.toLocaleString()} ${unit}`
}
function fmtFTE(amount: number): string {
  return `${amount.toLocaleString()} FTE`
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface UseIetResourceSnapshot {
  /** Most-recent Estimated snapshot (live — recomputes on any estimation change). */
  estimatedSnapshot: ComputedRef<IetResourceSnapshot['estimated']>
  /** Stipulated snapshot from Plan Scope Framework (live). */
  stipulatedSnapshot: ComputedRef<IetResourceSnapshot['stipulated']>
  /** History of recorded snapshots (append-only, persisted to localStorage). */
  history: Ref<IetResourceSnapshot[]>
  /** Record a new snapshot capturing the current estimated + stipulated state.
   *  Called by IET/VDT view on every cell / cost mutation. */
  recordSnapshot: (reason: string) => IetResourceSnapshot
  /** Clear the history (destructive — for test cleanup / user reset). */
  clearHistory: () => void
  // v514 — envelope round-trip
  getSnapshot: () => { history: IetResourceSnapshot[] }
  hydrateFromSnapshot: (snap: { history: IetResourceSnapshot[] }) => void
}

export function useIetResourceSnapshot(
  planIdRef: Ref<string> | ComputedRef<string>,
): UseIetResourceSnapshot {
  const estim = useResourceEstimations(planIdRef)
  const scope = usePlanScopeFramework(planIdRef)
  const history = computed(() => _getHistory(planIdRef.value).value)

  const estimatedSnapshot = computed<IetResourceSnapshot['estimated']>(() => {
    const list = estim.estimations.value
    const cap  = latestForResource(list, 'capitalCost')
    const time = latestForResource(list, 'calendarTime')
    const staf = latestForResource(list, 'specialistStaff')
    // v508 — OPEX
    const overhead = latestForResource(list, 'annualOverhead')
    const debt     = latestForResource(list, 'technicalDebt')
    return {
      capitalCost: cap
        ? { amount: cap.amount, unit: cap.currency ?? 'USD',
            label: `Estimated Capital: ${fmtCurrency(cap.amount, cap.currency ?? 'USD')}` }
        : { amount: null, unit: 'USD', label: 'Estimated Capital: — (no estimation yet)' },
      calendarTime: time
        ? { amount: time.amount, unit: time.timeUnit ?? 'weeks',
            label: `Estimated Calendar Time: ${fmtTime(time.amount, time.timeUnit ?? 'weeks')}` }
        : { amount: null, unit: 'weeks', label: 'Estimated Calendar Time: — (no estimation yet)' },
      specialistStaff: staf
        ? { amount: staf.amount, unit: 'FTE',
            label: `Estimated Specialist Staff: ${fmtFTE(staf.amount)}` }
        : { amount: null, unit: 'FTE', label: 'Estimated Specialist Staff: — (no estimation yet)' },
      annualOverhead: overhead
        ? { amount: overhead.amount, unit: overhead.currency ?? 'USD',
            label: `Estimated Annual Overhead: ${fmtCurrency(overhead.amount, overhead.currency ?? 'USD')}/yr` }
        : { amount: null, unit: 'USD', label: 'Estimated Annual Overhead: — (no estimation yet)' },
      technicalDebt: debt
        ? { amount: debt.amount, unit: debt.currency ?? 'USD',
            label: `Estimated Technical Debt: ${fmtCurrency(debt.amount, debt.currency ?? 'USD')}` }
        : { amount: null, unit: 'USD', label: 'Estimated Technical Debt: — (no estimation yet)' },
    }
  })

  const stipulatedSnapshot = computed<IetResourceSnapshot['stipulated']>(() => {
    const s = scope.state.value
    const bud = s.budgetAmounts
    const stipCap = bud.total ?? bud.fixed ?? bud.contracted ?? bud.annual ?? null
    return {
      capitalCost: {
        amount: stipCap,
        unit: 'USD',
        label: stipCap != null
          ? `Stipulated Capital Budget: ${fmtCurrency(stipCap, 'USD')}`
          : 'Stipulated Capital Budget: — (not yet determined — see Plan Scope Framework)',
      },
      calendarTime: (() => {
        // Deadline as calendar time.  If deadlineMode is 'date' or 'from-start' we surface the value.
        if (s.deadlineMode === 'from-start' && typeof s.deadlineFromStartValue === 'number') {
          return {
            amount: s.deadlineFromStartValue,
            unit:   s.deadlineFromStartUnit ?? 'months',
            label:  `Stipulated Calendar Time (from start): ${fmtTime(s.deadlineFromStartValue, s.deadlineFromStartUnit ?? 'months')}`,
          }
        }
        if (s.deadlineMode === 'date' && s.deadlineDate) {
          return {
            amount: null,
            unit:   'date',
            label:  `Stipulated Deadline Date: ${s.deadlineDate}`,
          }
        }
        return {
          amount: null,
          unit:   'weeks',
          label:  'Stipulated Calendar Time: — (not yet determined — see Plan Scope Framework)',
        }
      })(),
      specialistStaff: {
        // Plan Scope Framework doesn't yet carry FTE stipulation as a first-
        // class field — surface as pending so the planner knows to add it.
        amount: null,
        unit:   'FTE',
        label:  'Stipulated Specialist Staff: — (add to Plan Scope Framework — future extension)',
      },
      // v508 — annual overhead stipulated: use PSF.budgetAmounts.annual
      annualOverhead: (() => {
        const stipAnnual = bud.annual ?? null
        return {
          amount: stipAnnual,
          unit:   'USD',
          label:  stipAnnual != null
            ? `Stipulated Annual Overhead: ${fmtCurrency(stipAnnual, 'USD')}/yr (from Plan Scope Framework annual budget)`
            : 'Stipulated Annual Overhead: — (not yet determined — add annual budget in Plan Scope Framework)',
        }
      })(),
      // v508 — technical debt stipulated: no PSF field yet (future extension)
      technicalDebt: {
        amount: null,
        unit:   'USD',
        label:  'Stipulated Technical Debt ceiling: — (add to Plan Scope Framework — future extension)',
      },
    }
  })

  function recordSnapshot(reason: string): IetResourceSnapshot {
    const snapshot: IetResourceSnapshot = {
      timestamp: new Date().toISOString(),
      reason:    reason.trim() || 'IET/VDT change',
      estimated: JSON.parse(JSON.stringify(estimatedSnapshot.value)),
      stipulated: JSON.parse(JSON.stringify(stipulatedSnapshot.value)),
    }
    const hist = _getHistory(planIdRef.value)
    hist.value = [...hist.value, snapshot]
    return snapshot
  }

  function clearHistory(): void {
    const hist = _getHistory(planIdRef.value)
    hist.value = []
  }

  // v514 — Envelope round-trip.
  function getSnapshot(): { history: IetResourceSnapshot[] } {
    return { history: JSON.parse(JSON.stringify(_getHistory(planIdRef.value).value)) }
  }
  function hydrateFromSnapshot(snap: { history: IetResourceSnapshot[] }): void {
    if (!snap || !Array.isArray(snap.history)) return
    const hist = _getHistory(planIdRef.value)
    hist.value = JSON.parse(JSON.stringify(snap.history))
  }

  return {
    estimatedSnapshot,
    stipulatedSnapshot,
    history,
    recordSnapshot,
    clearHistory,
    getSnapshot,
    hydrateFromSnapshot,
  }
}
