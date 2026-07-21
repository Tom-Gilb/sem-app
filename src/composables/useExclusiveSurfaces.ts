/**
 * useExclusiveSurfaces.ts — single-active-surface enforcement.
 *
 * Universal Single-Surface Rule (per vault CLAUDE.md):
 *   At any moment, AT MOST ONE major full-screen surface (modal, drawer,
 *   panel, dialog) is open. When the user invokes another action that
 *   opens a different surface, the previously-open surface closes
 *   automatically and the new one replaces it gracefully.
 *
 *   Exception: if multi-surface concurrency is ever genuinely needed for
 *   a feature (e.g. side-by-side comparison), pass `{ exclusive: false }`
 *   so the surface registers but never auto-closes / never gets auto-closed.
 *
 * Usage from App.vue (or wherever the open ref lives):
 *
 *   import { registerExclusiveSurface } from './composables/useExclusiveSurfaces'
 *
 *   const evoSimulatorOpen = ref(false)
 *   registerExclusiveSurface('evoSimulator', evoSimulatorOpen)
 *
 * From this point on, whenever evoSimulatorOpen flips to true, every other
 * exclusive surface that was open gets its ref set to false. Closing happens
 * BEFORE the new surface mounts — modal-on-modal flicker is avoided.
 *
 * Internal toggles (menus, popovers, inline disclosures) should NOT be
 * registered — they are not full-window surfaces.
 */
import { watch, type Ref, type WatchStopHandle } from 'vue'

interface RegisteredSurface {
  id: string
  openRef: Ref<boolean>
  exclusive: boolean
  /** r41 v51 — store the watch stop handle so HMR re-registration can
   *  tear down the prior watcher.  Without this, stale watchers from
   *  before each Vite HMR accumulate and each one fires on open → close
   *  every other surface, causing apparent "auto-close after 10 s"
   *  behaviour during active hot-editing (Tom Gilb 2026-06-16 bug
   *  report: "multiforks showed for 10 seconds and disappeared on
   *  its own"). */
  stopWatch?: WatchStopHandle
}

const surfaces = new Map<string, RegisteredSurface>()

/**
 * Register a surface so it participates in single-active-surface enforcement.
 *
 * @param id        Stable identifier (e.g. 'evoSimulator', 'planTargets').
 * @param openRef   The boolean ref that controls v-if / v-show for the surface.
 * @param options.exclusive  Default true. Pass false for surfaces that
 *                           genuinely need to coexist with others.
 */
export function registerExclusiveSurface(
  id: string,
  openRef: Ref<boolean>,
  options: { exclusive?: boolean } = {},
): void {
  const exclusive = options.exclusive !== false

  // r41 v51 — Tear down the prior watcher when re-registering (HMR-safe).
  // Without this every Vite hot-module-reload spawned a new watch on the
  // same ref while the previous watch kept running.  After several edits
  // an open surface's "ON" transition would be observed by 5+ stale
  // watchers, each closing every other surface — including the surface
  // the user had just opened a few seconds earlier.
  const prior = surfaces.get(id)
  if (prior?.stopWatch) {
    try { prior.stopWatch() } catch { /* ignore */ }
  }

  const stopWatch = watch(openRef, (isOpen) => {
    if (!isOpen) return
    if (!exclusive) return
    // Close every OTHER exclusive surface that was previously open.
    for (const [otherId, other] of surfaces) {
      if (otherId === id) continue
      if (!other.exclusive) continue
      if (other.openRef.value) other.openRef.value = false
    }
  })

  const entry: RegisteredSurface = { id, openRef, exclusive, stopWatch }
  surfaces.set(id, entry)
}

/**
 * Close whichever exclusive surface is currently open.
 *
 * Called by App.vue's global Esc handler so that pressing Escape dismisses
 * ANY registered panel — no per-panel special-casing required.
 *
 * Returns true if a surface was closed, false if nothing was open.
 * The caller can use the return value to decide whether to run a fallback
 * action (e.g. the Tier-2 panic-reset in App.vue).
 */
export function closeActiveSurface(): boolean {
  for (const [, s] of surfaces) {
    if (s.exclusive && s.openRef.value) {
      s.openRef.value = false
      return true
    }
  }
  return false
}

/**
 * Test-only helper — returns the id of whichever exclusive surface is
 * currently open, or null. Useful for assertions in unit tests.
 */
export function _activeExclusiveSurface(): string | null {
  for (const [id, s] of surfaces) {
    if (s.exclusive && s.openRef.value) return id
  }
  return null
}

/**
 * Test-only helper — clears the registry. Used by Vitest setup.
 */
export function _resetSurfaces(): void {
  surfaces.clear()
}
