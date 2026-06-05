// UNIT_TYPE=Hook
//
// useSettings.ts — Reactive settings singleton, localStorage-backed.
//
// Module-level ref so every consumer sees the same settings — flipping a
// setting in the panel updates every component that reads it (when those
// components are wired in subsequent iterations).
//
// Auto-persists on any change via deep watcher.
//
// Defensive: corrupted JSON → returns defaults rather than crashing.

import { ref, watch, readonly } from 'vue'
import {
  type Settings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from '../data/settings'

// ── Module-level singleton ───────────────────────────────────────────────────

function readStored(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS }
    // Backfill missing fields from defaults so the schema can grow safely
    return { ...DEFAULT_SETTINGS, ...(parsed as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeStored(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Quota / private mode — in-memory holds.
  }
}

const _settings = ref<Settings>(readStored())

// Auto-persist on any change
watch(_settings, (s) => writeStored(s), { deep: true })

// ── Public API ───────────────────────────────────────────────────────────────

export function useSettings() {
  /** Sets one setting by key.  Type-safe via Settings[K]. */
  function setOne<K extends keyof Settings>(key: K, value: Settings[K]): void {
    _settings.value = { ..._settings.value, [key]: value }
  }

  /** Resets ALL settings to defaults (with confirm at the call site). */
  function resetAll(): void {
    _settings.value = { ...DEFAULT_SETTINGS }
  }

  /** Exports the current settings as a JSON string (for backup / share). */
  function exportJson(): string {
    return JSON.stringify(_settings.value, null, 2)
  }

  /** Imports settings from a JSON string.  Returns true on success, false on parse error. */
  function importJson(jsonText: string): boolean {
    try {
      const parsed = JSON.parse(jsonText.trim())
      if (typeof parsed !== 'object' || parsed === null) return false
      // Backfill missing fields from defaults
      _settings.value = { ...DEFAULT_SETTINGS, ...(parsed as Partial<Settings>) }
      return true
    } catch {
      return false
    }
  }

  return {
    /** Read-only reactive Settings — mutating requires setOne. */
    settings: readonly(_settings),
    setOne,
    resetAll,
    exportJson,
    importJson,
  }
}
