/**
 * useActivityScroll.ts — Universal "current activity must be visible" rule.
 *
 * RULE (Tom 2026-05-14):
 *   "The activity, generating spec, hides below window. We should always
 *    move window to show current activity (universal rule)."
 *
 * Mechanism. Every place in the app that has a long-running reactive
 * activity flag (sdkLoading, clarifyLoading, isStreaming, sharpenLoading,
 * etc.) registers that flag together with the element where the activity
 * VISUALLY appears. The moment the flag flips false → true, this composable
 * smoothly scrolls that element into the viewport so the user always sees
 * the spinner / streaming output the instant it starts.
 *
 * Usage from App.vue:
 *
 *   import { registerActivityScroll } from './composables/useActivityScroll'
 *
 *   const specOutputEl = ref<HTMLElement | null>(null)
 *   registerActivityScroll('spec-gen', sdkLoading, () => specOutputEl.value)
 *   registerActivityScroll('spec-error', sdkError, () => specOutputEl.value, {
 *     activeWhen: (v) => Boolean(v),  // sdkError is a string, not boolean
 *   })
 *
 * Internal-panel activities (e.g. SpecCoach streaming inside its own
 * Teleported panel) DO NOT need to register here — they handle their own
 * intra-panel scroll-to-bottom. This composable is for activities whose
 * VISIBLE SURFACE could be pushed below the fold by surrounding chrome.
 */
import { nextTick, watch, type Ref } from 'vue'

export interface ActivityScrollOptions {
  /** How long after activation to wait before scrolling (ms). Default 50 — enough for v-if to render the new content. */
  delay?: number
  /** ScrollIntoView block alignment. Default 'start' — top of activity at top of viewport. */
  block?: ScrollLogicalPosition
  /** Custom truthy-check. Default `Boolean(v)` — works for booleans and strings. */
  activeWhen?: (v: unknown) => boolean
  /**
   * If true, scroll on EVERY change, not just false→true edge. Useful when
   * the same flag flips between values during one logical activity (rare).
   * Default false.
   */
  everyChange?: boolean
}

interface RegisteredActivity {
  id: string
  /** Last seen "active" state — used to detect false→true edge. */
  wasActive: boolean
}

const activities = new Map<string, RegisteredActivity>()

/**
 * Register an activity. The composable watches `activeRef`; when it flips
 * to active, it smoothly scrolls the element returned by `getTargetEl()`
 * into view.
 *
 * @param id           Stable identifier (used for re-registration / HMR safety).
 * @param activeRef    The reactive flag (`Ref<boolean>` or `Ref<string>`).
 * @param getTargetEl  Getter — returns the element to scroll into view, or null.
 * @param options      Tuning (delay, block, custom truthy-check).
 */
export function registerActivityScroll(
  id: string,
  activeRef: Ref<unknown>,
  getTargetEl: () => HTMLElement | null | undefined,
  options: ActivityScrollOptions = {},
): void {
  const delay = options.delay ?? 50
  const block = options.block ?? 'start'
  const activeWhen = options.activeWhen ?? ((v: unknown) => Boolean(v))
  const everyChange = options.everyChange ?? false

  // Re-registration replaces the previous entry (HMR-safe).
  const initialActive = activeWhen(activeRef.value)
  activities.set(id, { id, wasActive: initialActive })

  watch(activeRef, (v) => {
    const isActive = activeWhen(v)
    const entry = activities.get(id)
    if (!entry) return
    const shouldScroll = everyChange ? isActive : (isActive && !entry.wasActive)
    entry.wasActive = isActive
    if (!shouldScroll) return

    // nextTick + small delay so the v-if'd activity surface has rendered
    // before we measure its position. Without this, scrollIntoView either
    // no-ops (element not yet in DOM) or lands on a 0-height placeholder.
    nextTick(() => {
      setTimeout(() => {
        const el = getTargetEl()
        if (!el) return
        try {
          el.scrollIntoView({ behavior: 'smooth', block })
        } catch {
          // Older browsers — fall back to instant scroll.
          el.scrollIntoView()
        }
      }, delay)
    })
  })
}

/**
 * Imperative helper — scroll any element into view using the same
 * "activity visible" geometry. Useful from event handlers that don't have
 * a reactive flag to watch.
 */
export function scrollActivityIntoView(
  el: HTMLElement | null | undefined,
  options: Pick<ActivityScrollOptions, 'block' | 'delay'> = {},
): void {
  if (!el) return
  const block = options.block ?? 'start'
  const delay = options.delay ?? 0
  const fire = (): void => {
    try {
      el.scrollIntoView({ behavior: 'smooth', block })
    } catch {
      el.scrollIntoView()
    }
  }
  if (delay > 0) setTimeout(fire, delay)
  else fire()
}

/** Test-only — clears the registry. */
export function _resetActivityScroll(): void {
  activities.clear()
}

/** Test-only — list registered ids. */
export function _registeredActivityIds(): string[] {
  return Array.from(activities.keys())
}
