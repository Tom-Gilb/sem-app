// UNIT_TYPE=Composable
// useBoardActivityLog.ts — board action-item log with Maria import.
//
// Architecture: module-level singleton ref. Entries are persisted to
// localStorage. The list starts empty on first use — entries are added either
// by importing a MariaResult or by adding manual items.
//
// Entry ordering: newest first (unshift on add).
//
// Portability: no Vue component types; all data types are in types/board.ts and
// types/maria.ts, both framework-free.

import { ref, computed, readonly } from 'vue'
import type { ActivityEntry, ActivityStatus, ActivityType } from '../types/board'
import type { MariaResult } from '../types/maria'

// ── Storage helpers ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-board-activity-log-v1'

function _generateId(): string {
  try { return crypto.randomUUID() } catch { return `act-${Date.now()}` }
}

function _now(): string {
  return new Date().toISOString()
}

function _loadFromStorage(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActivityEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function _saveToStorage(entries: ActivityEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage full or unavailable — degrade gracefully
  }
}

// ── Module-level singleton ─────────────────────────────────────────────────────

const _entries = ref<ActivityEntry[]>(_loadFromStorage())

// ── Public composable ──────────────────────────────────────────────────────────

export function useBoardActivityLog() {
  /**
   * Import governance gaps, authority gaps, and pattern-action concerns from a
   * MariaResult. Idempotent — skips any item already imported from the same
   * analysis run (matched by mariaGeneratedAt + itemId).
   * Returns the count of newly created entries.
   */
  function importFromMaria(result: MariaResult): number {
    let count = 0

    function _alreadyImported(mariaGeneratedAt: string, itemId: string): boolean {
      return _entries.value.some(
        e => e.source?.mariaGeneratedAt === mariaGeneratedAt && e.source?.itemId === itemId,
      )
    }

    function _createEntry(
      title: string,
      detail: string,
      type: ActivityType,
      itemId: string,
    ): ActivityEntry {
      count++
      return {
        id:               _generateId(),
        title:            title.slice(0, 120),
        detail:           detail.trim(),
        type,
        status:           'open',
        assignedMemberIds: [],
        createdAt:        _now(),
        updatedAt:        _now(),
        source: {
          mariaGeneratedAt: result.generatedAt,
          itemId,
          itemType: type,
        },
      }
    }

    const newEntries: ActivityEntry[] = []

    // Governance gaps — topics where a board decision is missing
    for (const g of result.governanceGaps) {
      if (_alreadyImported(result.generatedAt, g.id)) continue
      newEntries.push(_createEntry(
        g.category,
        [g.significance, g.opportunity].filter(Boolean).join('\n\n'),
        'governance-gap',
        g.id,
      ))
    }

    // Authority gaps — decisions where ownership is unclear
    for (const a of result.authorityReport) {
      const itemId = a.decisionIds.join('-')
      if (_alreadyImported(result.generatedAt, itemId)) continue
      newEntries.push(_createEntry(
        a.issue.slice(0, 100),
        [a.issue, 'Opportunity: ' + a.opportunity].filter(Boolean).join('\n\n'),
        'authority-gap',
        itemId,
      ))
    }

    // Pattern concerns only — strengths need no action
    for (const p of result.patternAnalysis) {
      if (p.type === 'strength') continue
      if (_alreadyImported(result.generatedAt, p.id)) continue
      newEntries.push(_createEntry(
        p.label,
        [p.description, 'Opportunity: ' + p.opportunity].filter(Boolean).join('\n\n'),
        'pattern-action',
        p.id,
      ))
    }

    if (newEntries.length > 0) {
      // Newest first — prepend to existing list
      _entries.value = [...newEntries, ..._entries.value]
      _saveToStorage(_entries.value)
    }

    return count
  }

  /**
   * Add a blank manual entry. Returns the new entry's id.
   */
  function addManual(): string {
    const id = _generateId()
    const entry: ActivityEntry = {
      id,
      title:             '',
      detail:            '',
      type:              'manual',
      status:            'open',
      assignedMemberIds: [],
      createdAt:         _now(),
      updatedAt:         _now(),
      source:            null,
    }
    _entries.value = [entry, ..._entries.value]
    _saveToStorage(_entries.value)
    return id
  }

  /**
   * Partially update an entry by id. Always sets updatedAt to now.
   * Uses array replacement (no direct mutation) for Vue reactivity.
   */
  function updateEntry(
    id: string,
    patch: Partial<Omit<ActivityEntry, 'id' | 'createdAt' | 'source'>>,
  ): void {
    _entries.value = _entries.value.map(e =>
      e.id === id ? { ...e, ...patch, updatedAt: _now() } : e,
    )
    _saveToStorage(_entries.value)
  }

  /** Remove an entry by id. No-op if not found. */
  function removeEntry(id: string): void {
    _entries.value = _entries.value.filter(e => e.id !== id)
    _saveToStorage(_entries.value)
  }

  /** Clear all entries. Requires explicit call — use only after confirmation. */
  function clearAll(): void {
    _entries.value = []
    _saveToStorage(_entries.value)
  }

  return {
    /** All entries, newest first. */
    entries: readonly(_entries),
    /** Total entry count. */
    totalCount: computed(() => _entries.value.length),
    /** Count of entries with status 'open'. */
    openCount:  computed(() => _entries.value.filter(e => e.status === 'open').length),
    /** Count of entries with status 'in-progress'. */
    inProgressCount: computed(() => _entries.value.filter(e => e.status === 'in-progress').length),
    importFromMaria,
    addManual,
    updateEntry,
    removeEntry,
    clearAll,
  }
}
