// usePriorityRecord.ts — Feature #199: Priority Decision Recording
// Stores per-entry priority decisions with suggest-menu fields, notification config,
// and preliminary impact notes. Persisted in localStorage per planModelId.

import { ref, computed } from 'vue'

// ── Data model ────────────────────────────────────────────────────────────────

export interface PriorityRecord {
  id: string
  /** The F./V./S. entry ID this priority decision belongs to */
  entryId: string
  /** Type of the spec entry */
  entryType: 'F' | 'V' | 'S'

  // ── Suggest-menu + free-text fields ──────────────────────────────────────
  /** Why this entry was prioritised — what drove the decision */
  source: string
  /** Who has the authority to make this priority call */
  authority: string
  /** What purposes or goals this prioritisation serves */
  purposes: string
  /** Conditions or cases that can override this priority */
  exceptions: string

  // ── Notification ─────────────────────────────────────────────────────────
  /** When true, Spec Owners are notified (default true) */
  notifyOwners: boolean
  /** Additional stakeholder names to notify beyond spec owners */
  notifyExtra: string[]
  /** "Not this time" — suppresses notification for this record */
  notifySkip: boolean

  // ── Preliminary impact notes ─────────────────────────────────────────────
  impactTiming: string
  impactCosts: string
  impactValues: string
  impactSolutions: string

  createdAt: string   // ISO timestamp
  updatedAt: string
}

// ── Suggestion lists ──────────────────────────────────────────────────────────

export const PRIORITY_SUGGESTIONS: Record<string, string[]> = {
  source: [
    'Market research finding',
    'Stakeholder directive',
    'Regulatory requirement',
    'Customer feedback',
    'Competitive pressure',
    'Internal strategy shift',
    'Technical constraint',
    'Budget review outcome',
    'Risk assessment result',
    'Executive mandate',
  ],
  authority: [
    'Product Owner',
    'CEO / Executive Team',
    'CTO',
    'Board decision',
    'Steering committee',
    'Compliance team',
    'Customer contract',
    'External regulator',
    'Project Sponsor',
    'Spec Owner',
  ],
  purposes: [
    'Maximise value delivery',
    'Reduce project risk',
    'Comply with regulation',
    'Meet customer deadline',
    'Align with strategic plan',
    'Reduce cost or effort',
    'Improve quality metrics',
    'Enable dependent features',
    'Increase stakeholder confidence',
    'Capture time-sensitive opportunity',
  ],
  exceptions: [
    'None identified',
    'Emergency situations only',
    'Regulatory override permitted',
    'Requires Board approval to override',
    'Customer contract allows override',
    'Subject to quarterly review',
  ],
}

// ── Singleton storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-priority-records'

/** Map: planModelId → PriorityRecord[] */
const _store = ref<Record<string, PriorityRecord[]>>(
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

// ── External hooks for plan import / export ──────────────────────────────────
// These bypass the per-plan composable so usePlanModel can transfer the
// entire priority-record collection for one plan in a single shot. Updating
// `_store.value` (not just localStorage) ensures every active subscriber of
// `usePriorityRecord(planId)` sees the new data reactively — no page reload
// needed after import. Internal use only; exposed via underscore prefix.

/** Read all priority records for one plan (used by `exportPlanModel`). */
export function _getRecordsForPlan(planModelId: string): PriorityRecord[] {
  return _store.value[planModelId] ?? []
}

/**
 * Replace all priority records for one plan in one shot (used by
 * `importPlanModel`). Persists to localStorage AND updates the reactive
 * store so live subscribers re-render immediately.
 */
export function _setRecordsForPlan(planModelId: string, records: PriorityRecord[]): void {
  _store.value = { ..._store.value, [planModelId]: records }
  _persist()
}

// ── Composable ────────────────────────────────────────────────────────────────

export function usePriorityRecord(planModelId: string) {

  /** All records for this plan model */
  const records = computed<PriorityRecord[]>(
    () => _store.value[planModelId] ?? [],
  )

  /** Get the record for a specific entry (latest by updatedAt if multiple) */
  function getRecord(entryId: string): PriorityRecord | null {
    const matches = records.value.filter(r => r.entryId === entryId)
    if (!matches.length) return null
    return matches.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
  }

  /** Create or update the priority record for an entry */
  function upsertRecord(entryId: string, entryType: 'F' | 'V' | 'S', patch: Partial<Omit<PriorityRecord, 'id' | 'entryId' | 'entryType' | 'createdAt' | 'updatedAt'>>): PriorityRecord {
    const now = new Date().toISOString()
    const existing = getRecord(entryId)

    if (existing) {
      const updated: PriorityRecord = { ...existing, ...patch, updatedAt: now }
      _store.value = {
        ..._store.value,
        [planModelId]: records.value.map(r => r.id === existing.id ? updated : r),
      }
      _persist()
      return updated
    }

    const fresh: PriorityRecord = {
      id: _uid(),
      entryId,
      entryType,
      source: '',
      authority: '',
      purposes: '',
      exceptions: '',
      notifyOwners: true,
      notifyExtra: [],
      notifySkip: false,
      impactTiming: '',
      impactCosts: '',
      impactValues: '',
      impactSolutions: '',
      ...patch,
      createdAt: now,
      updatedAt: now,
    }
    _store.value = {
      ..._store.value,
      [planModelId]: [...records.value, fresh],
    }
    _persist()
    return fresh
  }

  /** Remove a record by id */
  function removeRecord(id: string): void {
    _store.value = {
      ..._store.value,
      [planModelId]: records.value.filter(r => r.id !== id),
    }
    _persist()
  }

  /** True if this entry has any saved priority record */
  function hasRecord(entryId: string): boolean {
    return records.value.some(r => r.entryId === entryId)
  }

  return {
    records,
    getRecord,
    upsertRecord,
    removeRecord,
    hasRecord,
  }
}
