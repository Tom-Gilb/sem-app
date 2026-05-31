// UNIT_TYPE=Lib
// maria/mariaResultStore.ts — module-level singleton for MariaResult state + persisted history.
//
// Written to by MariaAgentBoard.vue via pushMariaResult() after each successful analysis.
// Read by MariaBoardHub.vue (lastMariaResult) and HistoryPanel.vue (mariaHistory).
//
// Architecture: module-level refs (not composable-scoped) so all component
// instances share the same pointer regardless of mount/unmount cycles.
//
// Portability: no Vue component types, no browser-specific APIs beyond ref().
// The only dependency is types/maria.ts which is also framework-free.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { MariaResult } from '../../types/maria'

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * A single persisted Maria board analysis record.
 * Stores the full result alongside a short title and summary counts so the
 * HistoryPanel can render a list without parsing the full result object.
 */
export interface MariaHistoryRecord {
  /** Unique id — `"maria-" + Date.now()`. */
  id:                string
  /**
   * Short label for the analysis — first non-empty line of the source document
   * (≤80 chars) or "Board Analysis" when no text is available.
   */
  title:             string
  /** ISO 8601 timestamp — same as `result.generatedAt`. */
  takenAt:           string
  decisionCount:     number
  authorityGapCount: number
  governanceGapCount: number
  patternCount:      number
  /** Full structured result — the payload for "Load" in HistoryPanel. */
  result:            MariaResult
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HISTORY_KEY  = 'sem-maria-results-v1'
const MAX_HISTORY  = 10

// ── Persistence helpers ───────────────────────────────────────────────────────

function _loadHistory(): MariaHistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MariaHistoryRecord[]
  } catch {
    return []
  }
}

function _saveHistory(records: MariaHistoryRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records))
  } catch { /* localStorage full or unavailable — fail silently */ }
}

// ── Singleton state ───────────────────────────────────────────────────────────

/**
 * The most recent successful MariaResult.
 * null until the first successful analysis in this browser session OR until
 * the history is loaded and the most recent record is restored.
 */
export const lastMariaResult: Ref<MariaResult | null> = ref(null)

/**
 * Persisted history of the last MAX_HISTORY successful board analyses.
 * Loaded from localStorage on module init; updated by pushMariaResult().
 */
export const mariaHistory: Ref<MariaHistoryRecord[]> = ref(_loadHistory())

// Restore lastMariaResult from the most recent persisted record on init.
if (mariaHistory.value.length > 0) {
  lastMariaResult.value = mariaHistory.value[0].result
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a new Maria result in persisted history AND update lastMariaResult.
 *
 * Call this instead of assigning to `lastMariaResult.value` directly.
 * MariaAgentBoard.vue passes `documentText.value.slice(0, 80)` as the title.
 *
 * @param result  The completed MariaResult from analyse()
 * @param title   Optional — first line of the source document, ≤80 chars
 */
export function pushMariaResult(result: MariaResult, title?: string): void {
  lastMariaResult.value = result

  const record: MariaHistoryRecord = {
    id:                 `maria-${Date.now()}`,
    title:              (title?.trim() || 'Board Analysis').slice(0, 80),
    takenAt:            result.generatedAt,
    decisionCount:      result.decisionInventory.length,
    authorityGapCount:  result.authorityReport.length,
    governanceGapCount: result.governanceGaps.length,
    patternCount:       result.patternAnalysis.length,
    result,
  }

  const updated = [record, ...mariaHistory.value].slice(0, MAX_HISTORY)
  mariaHistory.value = updated
  _saveHistory(updated)
}
