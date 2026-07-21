// UNIT_TYPE=Composable
// useDismissalLog.ts — Universal Dismissal Audit Trail singleton store.
//
// Tom Gilb verbatim 2026-06-14:
//   "If a fix is dismissed (and this is for incorruptable and all similar with
//    dismissing a suggestion). We need to ask 1. why?, 2. On whose authority
//    (default, Owner), and then to Log, in the plan documentation, all
//    dismissals (to learn, man and machine)"
//
// One singleton store across all agents. localStorage-persisted (survives
// reload). Composes with Universal Undo via its own internal undo stack
// (dismissals don't mutate the spec; they live in a parallel audit log).
//
// API:
//   const { recordDismissal, undoLastDismissal,
//           dismissalsForAgent, wasFindingDismissed, restoreDismissed } = useDismissalLog()
//
// Composes with:
//   - Universal Undo SUPREME (internal undo stack; restoreDismissed un-dismisses)
//   - No-Silent-Data-Loss SUPREME (localStorage persistence; survives reload)
//   - Conjunction-of-Technologies SUPREME (dismissal corpus = (a) Plan-derived
//     ground truth for future AI prompts to read)
//   - Twin portability (port directly to Kai's industrial Twin)

import { ref, computed } from 'vue'
import type { DismissalRecord } from '../types/dismissal'

const STORAGE_KEY = 'sem-app:dismissalLog:v1'

/** localStorage hydration — defensive against corrupt/missing data. */
function _hydrate(): DismissalRecord[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    // Light shape validation — drop anything that doesn't look like a DismissalRecord
    return (data as DismissalRecord[]).filter(d =>
      d && typeof d.id === 'string' && typeof d.agentId === 'string'
      && typeof d.findingId === 'string' && typeof d.whyReason === 'string'
      && typeof d.authority === 'string' && typeof d.dismissedAtIso === 'string'
    )
  } catch {
    return []
  }
}

function _persist(records: DismissalRecord[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch (err) {
    console.warn('[useDismissalLog] localStorage write failed:', err)
  }
}

// Singleton state — module-level so every consumer shares the same store.
const _records = ref<DismissalRecord[]>(_hydrate())

// Internal undo stack — separate from useUndoHistory because dismissals don't
// mutate the spec. Holds the LAST dismissal record so undoLastDismissal() can
// remove it.  Phase 2: expand to a multi-deep stack if Tom wants ⌘Z chains.
const _undoStack = ref<DismissalRecord[]>([])

export function useDismissalLog() {

  /** All dismissals, newest first. */
  const allDismissals = computed<DismissalRecord[]>(() =>
    [..._records.value].sort((a, b) => b.dismissedAtIso.localeCompare(a.dismissedAtIso)),
  )

  /** Record a new dismissal — appends to log, persists, pushes onto undo stack. */
  function recordDismissal(record: DismissalRecord): void {
    _records.value = [..._records.value, record]
    _undoStack.value = [..._undoStack.value, record]
    _persist(_records.value)
  }

  /** Undo the most recent dismissal — removes from log + un-dismisses.
   *  Returns the removed record so the caller can update its visible-findings set. */
  function undoLastDismissal(): DismissalRecord | null {
    if (_undoStack.value.length === 0) return null
    const last = _undoStack.value[_undoStack.value.length - 1]
    _undoStack.value = _undoStack.value.slice(0, -1)
    _records.value = _records.value.filter(r => r.id !== last.id)
    _persist(_records.value)
    return last
  }

  /** Restore a SPECIFIC dismissed finding (the per-row Restore button).
   *  Returns the removed record. */
  function restoreDismissed(dismissalId: string): DismissalRecord | null {
    const target = _records.value.find(r => r.id === dismissalId)
    if (!target) return null
    _records.value = _records.value.filter(r => r.id !== dismissalId)
    _undoStack.value = _undoStack.value.filter(r => r.id !== dismissalId)
    _persist(_records.value)
    return target
  }

  /** All dismissals for a given agent on a given plan, newest first. */
  function dismissalsForAgent(agentId: string, planId: string): DismissalRecord[] {
    return _records.value
      .filter(r => r.agentId === agentId && r.planId === planId)
      .sort((a, b) => b.dismissedAtIso.localeCompare(a.dismissedAtIso))
  }

  /** All dismissals for a given plan across all agents, newest first. */
  function dismissalsForPlan(planId: string): DismissalRecord[] {
    return _records.value
      .filter(r => r.planId === planId)
      .sort((a, b) => b.dismissedAtIso.localeCompare(a.dismissedAtIso))
  }

  /** Has this exact finding (by agent + findingId + plan) been dismissed?
   *  Returns the dismissal record if yes, null if no.
   *  The learning loop calls this to suppress repeat-bother. */
  function wasFindingDismissed(agentId: string, findingId: string, planId: string): DismissalRecord | null {
    return _records.value.find(r =>
      r.agentId === agentId && r.findingId === findingId && r.planId === planId,
    ) ?? null
  }

  /** Reactive Set of dismissed finding-ids for a given agent + plan — handy
   *  for `v-for` filters in component templates without re-computing in each. */
  function dismissedIdSetFor(agentId: string, planId: string) {
    return computed<Set<string>>(() => {
      const out = new Set<string>()
      for (const r of _records.value) {
        if (r.agentId === agentId && r.planId === planId) out.add(r.findingId)
      }
      return out
    })
  }

  /** Clear ALL dismissals — debug / reset. NOT user-facing. */
  function _resetAll(): void {
    _records.value = []
    _undoStack.value = []
    _persist(_records.value)
  }

  return {
    allDismissals,
    recordDismissal,
    undoLastDismissal,
    restoreDismissed,
    dismissalsForAgent,
    dismissalsForPlan,
    wasFindingDismissed,
    dismissedIdSetFor,
    _resetAll,
  }
}
