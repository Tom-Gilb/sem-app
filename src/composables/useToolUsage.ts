// UNIT_TYPE=Composable
// useToolUsage — light-touch click telemetry for the StageToolsStrip.
//
// Tom Gilb 2026-06-19 verbatim: "Not sure about Planguage Tools, keep for
// now, little harm, interesting if you can track my usage."
//
// What it does:
//   • Records ONE counter increment per tool click, keyed by tool id.
//   • Persists to localStorage so counts survive page reloads + session
//     restores (the planning workflow's natural unit of time).
//   • Surfaces three functions: `recordToolClick(toolId)`,
//     `getUsageReport()`, `clearUsage()`.
//   • Auto-exposes a dev hook on window for ad-hoc inspection during
//     SEM design sessions — `window.semToolUsage()` dumps the report.
//
// What it does NOT do:
//   • No remote telemetry.  Nothing leaves the browser.
//   • No PII capture (the only data is the tool id string + a counter +
//     ISO timestamps — same shape Tom can inspect in DevTools any time).
//   • No A/B framework.  Pure observational counter.  Stays Twin-portable
//     because the storage layer is one localStorage key the Twin can
//     ignore or replace as it likes.
//
// Composes with: Architectural Resilience SUPREME (pure data + tiny
// surface) + Claude-Code-as-AI-Layer SUPREME (no API calls) + Twin
// portability (one storage key, no Vue reactivity beyond a ref).

import { ref } from 'vue'

const STORAGE_KEY = 'sem-tool-usage-v1'

interface UsageRecord {
  count:        number
  firstClickAt: string  // ISO date-time of first observed click
  lastClickAt:  string  // ISO date-time of most recent click
}

type UsageMap = Record<string, UsageRecord>

/** Reactive in-memory copy of the usage map.  Persisted to localStorage
 *  on every mutation.  Hydrated from localStorage on module load. */
const _usage = ref<UsageMap>(_loadFromStorage())

function _loadFromStorage(): UsageMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as UsageMap
  } catch {
    return {}
  }
}

function _saveToStorage(map: UsageMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / disabled — non-fatal */
  }
}

/** Increment the click counter for the given tool id and persist.  Safe to
 *  call from a Vue template `@click`; never throws. */
export function recordToolClick(toolId: string): void {
  if (!toolId) return
  const now = new Date().toISOString()
  const existing = _usage.value[toolId]
  const next: UsageRecord = existing
    ? { count: existing.count + 1, firstClickAt: existing.firstClickAt, lastClickAt: now }
    : { count: 1, firstClickAt: now, lastClickAt: now }
  _usage.value = { ..._usage.value, [toolId]: next }
  _saveToStorage(_usage.value)
}

/** Return a sorted-by-count snapshot of the usage map — most-clicked first.
 *  Useful for ad-hoc inspection of which tools the planner actually uses. */
export function getUsageReport(): Array<{ toolId: string } & UsageRecord> {
  const entries = Object.entries(_usage.value).map(([toolId, rec]) => ({
    toolId,
    ...rec,
  }))
  return entries.sort((a, b) => b.count - a.count)
}

/** Wipe the usage map (both in-memory + localStorage). */
export function clearUsage(): void {
  _usage.value = {}
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
}

/** Convenience: expose a dev hook so Tom can `window.semToolUsage()` in
 *  Safari DevTools to see the report at any time.  Runs once at module
 *  load.  No-op outside the browser. */
if (typeof window !== 'undefined') {
  ;(window as unknown as { semToolUsage?: () => Array<{ toolId: string } & UsageRecord> }).semToolUsage = getUsageReport
}
