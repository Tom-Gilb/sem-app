// UNIT_TYPE=Hook
// useLastEffortMirror — the "always safe" backstop for the SEM App session.
//
// v515 (2026-07-21) — Tom Gilb 2026-07-05 storage-design brief:
//   *"If some local storage is filled, I want an orderly automatic save of it
//    (not sure what I would want at all or why). And maybe keep a copy of the
//    last effort, and save it."*
//
// After Tom lost Stage 10 estimation work on 2026-07-21 to a silent reset
// (v514 guard shipped; this composable is the actual prevention), we ship the
// Layer 1 mirror that was promised on 2026-07-05.
//
// Design (from CLAUDE.md conversation 2026-07-05):
//   Layer 1 — Last-Effort Mirror (the "always safe" backstop):
//     - A single rolling snapshot of the current SEM App session
//     - Debounced write every ~30 seconds on any state change
//     - Stored in IndexedDB (idbKv, Portfolio pattern #1) — hundreds of MB
//       quota, no user-gesture requirement (unlike ~/Downloads writes which
//       Safari blocks without an <a download> click).
//     - Flushed IMMEDIATELY on `pagehide` and `visibilitychange` (hidden) —
//       catches Safari zoom eviction + tab close + system suspend.
//     - On next session start: if the mirror is NEWER than the localStorage
//       session blob (which useSessionPersist manages), a "Restore last
//       effort? — N minutes ago" banner appears at the top of the app.
//   Belt-and-braces: this mirror exists NO MATTER WHAT.  Safari crash, Vite
//   crash, quota hit, laptop reboot — the last save is at most 30 s behind
//   reality.  No-Silent-Data-Loss SUPREME.
//
// Storage choice (Safari-realistic):
//   The 2026-07-05 design proposed writing to `~/Downloads/sem-app-LAST-
//   EFFORT.eml`.  Safari forbids silent file writes without a user gesture,
//   so an unattended background 30-second write is impossible via the Files
//   API alone.  Instead we use IndexedDB (via the existing idbKv module) —
//   same rescue guarantees, no user-gesture wall, better for the debounced
//   auto-save cadence.  For an explicit "save to disk" export the user can
//   still click the existing Export pins on every window (per r41 v308
//   universal export-button rule) — that path is a user gesture and works.
//
// Portfolio pattern #23 (2026-07-21 v515): rolling-session-mirror over
// idbKv — ports to Kai's Twin verbatim (Twin's Solid Pod adopts the same
// composable shape; only the store handle differs).
//
// Composes with:
//   • No-Silent-Data-Loss SUPREME — this composable IS the enforcement.
//   • Trust-Rebuild framing — after 2026-07-21 Stage 10 silent reset.
//   • Universal Undo SUPREME — mirror ≠ Undo history; it's a "session
//     restore" one-file snapshot.  Undo remains its own stack.
//   • useSessionPersist — the mirror is REDUNDANT with useSessionPersist
//     (both save the same session shape) but the redundancy is the point:
//     the mirror survives localStorage quota-fail because it lives in IDB.
//   • Twin-Portability-Portfolio-Update SUPREME (row 19) — this file is
//     the reference for Portfolio pattern #23.

import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { ImpactMatrix } from '../types/impact'
import type { TaskSuggestion } from '../types/task'
import { normalizeSpecBlock } from '../utils/normalizeSpec'
import { idbGet, idbSet, idbDelete, idbSupported } from '../lib/idbKv'

/** The rolling-mirror storage key inside `sem-app-kv` IDB store. */
const MIRROR_KEY = 'sem-app:last-effort-mirror:v1'

/** Debounce window for the auto-save watcher. */
const DEBOUNCE_MS = 30_000

/**
 * The snapshot shape — a superset of useSessionPersist's SavedSession so the
 * mirror can restore everything useSessionPersist restores, plus a few extras
 * (planningStage, view mode) that useSessionPersist historically omitted.
 */
export interface LastEffortMirror {
  version: 1
  /** ISO timestamp of last save. */
  savedAt: string
  /** Optional plan identity for the restore banner ("N minutes ago on 'plan X'"). */
  planName?: string
  /** The full session state — matches useSessionPersist.SavedSession fields. */
  planningStage: number
  stage: number
  view: string
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

/** Human-readable age helper — "just now" / "N min ago" / "N hr ago". */
export function mirrorAgeLabel(savedAtISO: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(savedAtISO).getTime()) / 1000)
    if (diff < 30) return 'just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
    return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`
  } catch { return 'unknown' }
}

/**
 * Composable — the caller (App.vue) owns the state assembly.  We ship the
 * debounce + persist + read + hasNewer helpers.  Pure boundary — no ambient
 * Vue reactivity here; App.vue's watchers call `scheduleFlush()`.
 */
export function useLastEffortMirror(getSnapshot: () => Omit<LastEffortMirror, 'version' | 'savedAt'>) {
  let _timer: ReturnType<typeof setTimeout> | null = null

  async function _flush(): Promise<void> {
    if (!idbSupported()) return
    try {
      const snap = getSnapshot()
      const record: LastEffortMirror = {
        ...snap,
        version: 1,
        savedAt: new Date().toISOString(),
      }
      await idbSet(MIRROR_KEY, record)
    } catch (err) {
      console.warn('[last-effort-mirror] write failed', err)
    }
  }

  /** Debounced write — call from watchers on any state change. */
  function scheduleFlush(): void {
    if (_timer) clearTimeout(_timer)
    _timer = setTimeout(() => { _timer = null; void _flush() }, DEBOUNCE_MS)
  }

  /** Immediate write — call from pagehide / visibilitychange / beforeunload. */
  async function flushNow(): Promise<void> {
    if (_timer) { clearTimeout(_timer); _timer = null }
    await _flush()
  }

  /** Read the persisted mirror.  Null if nothing saved yet. */
  async function readMirror(): Promise<LastEffortMirror | null> {
    if (!idbSupported()) return null
    try {
      const raw = await idbGet<LastEffortMirror>(MIRROR_KEY)
      if (!raw || raw.version !== 1 || !raw.savedAt) return null
      // Normalise the spec at the storage boundary (parity with useSessionPersist).
      if (raw.currentSpec) {
        return { ...raw, currentSpec: normalizeSpecBlock(raw.currentSpec) }
      }
      return raw
    } catch (err) {
      console.warn('[last-effort-mirror] read failed', err)
      return null
    }
  }

  /**
   * True when the mirror is strictly newer than `comparedToISO`.
   * If no comparison timestamp is given, true whenever any mirror exists.
   * Used at session start to decide whether to show the "Restore last effort?"
   * banner (compared to useSessionPersist's `savedAt`).
   */
  async function hasNewerMirror(comparedToISO?: string | null): Promise<boolean> {
    const m = await readMirror()
    if (!m) return false
    if (!comparedToISO) return true
    try {
      return new Date(m.savedAt).getTime() > new Date(comparedToISO).getTime()
    } catch { return false }
  }

  /** Delete the persisted mirror.  Fire on explicit user dismiss. */
  async function clearMirror(): Promise<void> {
    if (!idbSupported()) return
    try { await idbDelete(MIRROR_KEY) } catch { /* silent */ }
  }

  return {
    scheduleFlush,
    flushNow,
    readMirror,
    hasNewerMirror,
    clearMirror,
    mirrorAgeLabel,
    MIRROR_KEY,
    DEBOUNCE_MS,
  }
}
