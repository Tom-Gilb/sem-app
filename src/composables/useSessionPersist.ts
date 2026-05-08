// UNIT_TYPE=Hook
// useSessionPersist — Session state persistence across page reloads / iOS eviction
//
// Saves the full App.vue working state to localStorage so the user can recover
// from unexpected page kills (iOS Safari zoom eviction, backgrounding, OOM).
//
// Key: sem-session-v1
// Save triggers: debounced watch on all key refs + immediate save on pagehide / visibilitychange
// Restore: App.vue onMounted reads and applies saved state before showing the app view
// Clear: on sign-out or when the user explicitly clicks "Start fresh"

import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { ImpactMatrix } from '../types/impact'
import type { TaskSuggestion } from '../types/task'

const SESSION_KEY = 'sem-session-v1'

export interface SavedSession {
  /** Schema version — increment if shape changes to avoid deserialising stale data. */
  version: 1
  /** ISO timestamp of last save — displayed in the restore toast. */
  savedAt: string
  stage: number
  currentSpec: SpecBlock | null
  markdown: string
  originalInput: { stakes: string; ends: string; means: string } | null
  confirmedSteps: EvoStep[]
  evoPlanConfirmed: boolean
  tasksByStep: Record<string, TaskSuggestion[]>
  capturedImpactMatrix: ImpactMatrix
  capturedVCRatios: Record<string, number>
  capturedCalendarCosts: Record<string, number>
  capturedCapitalCosts: Record<string, number>
}

/**
 * Lightweight session persistence composable.
 *
 * @returns {{ save, load, clear, timeAgo }}
 *   - save(session): writes session to localStorage
 *   - load(): reads and validates session from localStorage; returns null if absent or corrupt
 *   - clear(): removes the saved session key
 *   - timeAgo(isoString): human-readable "X min ago" / "just now" label
 */
export function useSessionPersist() {
  function save(session: SavedSession): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      // Ignore — private browsing or storage quota exceeded
    }
  }

  function load(): SavedSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as SavedSession
      // Minimum validity check — must have a spec with at least functions array
      if (
        !parsed ||
        parsed.version !== 1 ||
        !parsed.currentSpec ||
        !Array.isArray(parsed.currentSpec.functions)
      ) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  function clear(): void {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {}
  }

  /** Returns a short human-readable age string for a saved session timestamp. */
  function timeAgo(isoString: string): string {
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
      if (diff < 60) return 'just now'
      if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
      if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
      return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`
    } catch {
      return ''
    }
  }

  return { save, load, clear, timeAgo }
}
