// UNIT_TYPE=Composable
// Feature #39 — Side-by-side IET vs Actuals
// Stores actual impact values alongside AI estimates per solution × value pair.
// Persists in localStorage so entries survive page refresh.
// No live API required — mock mode works automatically.

import { ref, computed } from 'vue'

const STORAGE_KEY = 'sem-actuals-log'

/** A single logged actual impact entry */
export interface ActualEntry {
  /** ISO date string of when the actual was logged, e.g. "2026-05-02" */
  date: string
  /** Solution ID, e.g. "S.MarketingAutomation" */
  solutionId: string
  /** Value ID, e.g. "V.ConversionRate" */
  valueId: string
  /** AI estimate (0–100) captured at logging time */
  aiEstimate: number
  /** User-entered actual impact (0–100) */
  actual: number
  /** Optional free-text note */
  note: string
}

/** Full actuals log — keyed by "solutionId|valueId" for quick lookup */
export type ActualsLog = Record<string, ActualEntry[]>

function loadFromStorage(): ActualsLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActualsLog) : {}
  } catch {
    return {}
  }
}

function saveToStorage(log: ActualsLog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch {
    // storage unavailable in test/SSR context — no-op
  }
}

export function useActualsLog() {
  const log = ref<ActualsLog>(loadFromStorage())

  /**
   * Log a new actual for a given solution × value cell.
   * Multiple actuals can be logged over time (history preserved).
   */
  function logActual(
    solutionId: string,
    valueId: string,
    aiEstimate: number,
    actual: number,
    note = '',
  ): void {
    const key = `${solutionId}|${valueId}`
    const entry: ActualEntry = {
      date: new Date().toISOString().slice(0, 10),
      solutionId,
      valueId,
      aiEstimate,
      actual,
      note,
    }
    if (!log.value[key]) {
      log.value[key] = []
    }
    log.value[key].push(entry)
    saveToStorage(log.value)
  }

  /** Get all entries for a solution × value pair (most recent last) */
  function getEntries(solutionId: string, valueId: string): ActualEntry[] {
    return log.value[`${solutionId}|${valueId}`] ?? []
  }

  /** Get the most recent actual for a pair (undefined if none) */
  function getLatest(solutionId: string, valueId: string): ActualEntry | undefined {
    const entries = getEntries(solutionId, valueId)
    return entries.length > 0 ? entries[entries.length - 1] : undefined
  }

  /** Calibration error: actual – aiEstimate for the latest entry, or null */
  function calibrationDelta(solutionId: string, valueId: string): number | null {
    const entry = getLatest(solutionId, valueId)
    return entry != null ? entry.actual - entry.aiEstimate : null
  }

  /**
   * Overall calibration summary across all logged pairs.
   * Returns mean absolute error (MAE) and directional bias (mean delta).
   */
  const calibrationSummary = computed(() => {
    const entries: ActualEntry[] = Object.values(log.value).flat()
    if (entries.length === 0) return null

    const deltas = entries.map((e) => e.actual - e.aiEstimate)
    const mae = deltas.reduce((sum, d) => sum + Math.abs(d), 0) / deltas.length
    const bias = deltas.reduce((sum, d) => sum + d, 0) / deltas.length

    return {
      count: entries.length,
      mae: Math.round(mae * 10) / 10,
      bias: Math.round(bias * 10) / 10,
    }
  })

  /** Clear all actuals (use in tests or user reset) */
  function clearAll(): void {
    log.value = {}
    saveToStorage(log.value)
  }

  return {
    log,
    logActual,
    getEntries,
    getLatest,
    calibrationDelta,
    calibrationSummary,
    clearAll,
  }
}
