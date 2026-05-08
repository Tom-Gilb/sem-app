// UNIT_TYPE=Hook
// useSpecHistory — Feature #29: Spec Version History
// Maintains a newest-first list of up to 10 SpecBlock snapshots.
// Persisted to localStorage (key: sem-spec-history-v1) so history survives
// page reloads, iOS Safari eviction, and zoom-triggered restarts.

import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface SpecVersion {
  id: string          // crypto.randomUUID() or Date.now().toString()
  spec: SpecBlock
  timestamp: number   // Date.now()
  label: string       // "Generated" | "Make Ambitious" | "Lean Plan" | "Restored"
  summary: string     // First V. entry description, truncated to 60 chars
}

const MAX_HISTORY = 10
const STORAGE_KEY = 'sem-spec-history-v1'

// ── localStorage helpers ──────────────────────────────────────────────────────

function _loadFromStorage(): SpecVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SpecVersion[]
  } catch {
    return []
  }
}

function _saveToStorage(versions: SpecVersion[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions))
  } catch {
    // localStorage may be full or unavailable (private browsing edge cases)
  }
}

// ── Singleton state — initialised from localStorage on first import ────────────

/** Shared singleton state — all callers share the same history list. */
const history = ref<SpecVersion[]>(_loadFromStorage())

function buildSummary(spec: SpecBlock): string {
  const counts = `${spec.functions.length}F · ${spec.values.length}V · ${spec.solutions.length}S`
  // Use the first Function description as the topic — it says "what the system does",
  // which is more identifying than a Value description.
  const topic = spec.functions[0]?.description ?? spec.values[0]?.description ?? ''
  const short = topic.length > 42 ? topic.slice(0, 39) + '…' : topic
  return short ? `${counts} — ${short}` : counts
}

export function useSpecHistory() {
  function addVersion(spec: SpecBlock, label: string): void {
    const version: SpecVersion = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(),
      spec: JSON.parse(JSON.stringify(spec)), // deep clone
      timestamp: Date.now(),
      label,
      summary: buildSummary(spec),
    }
    history.value = [version, ...history.value].slice(0, MAX_HISTORY)
    _saveToStorage(history.value)
  }

  function restoreVersion(id: string): SpecBlock | null {
    const found = history.value.find((v) => v.id === id)
    return found ? JSON.parse(JSON.stringify(found.spec)) : null
  }

  function clearHistory(): void {
    history.value = []
    _saveToStorage([])
  }

  return { history, addVersion, restoreVersion, clearHistory }
}
