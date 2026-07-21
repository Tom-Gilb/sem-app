// useToast — lightweight module-level singleton toast
// Shared across all components that import it.
// showToast(message) displays a brief floating notification for `ms` milliseconds.
// Each call also plays a soft pling tone and triggers haptic feedback on mobile.
//
// r93x (Tom Gilb 2026-06-11 Universal Undo P2): toasts now optionally carry an action
// button (the "[Undo]" link Tom asked for). When `action` is supplied the toast becomes
// pointer-events-auto and renders the action label as a click target on the right side
// of the pill. Default `action: null` preserves the previous toast UX exactly.

import { ref } from 'vue'

/** Optional action button rendered inside the toast pill (e.g. "[Undo]"). */
export interface ToastAction {
  label:   string
  handler: () => void
}

interface Toast { message: string; id: number; action: ToastAction | null }

/** History entry — preserves message + timestamp + dismissed status for the bell panel. */
export interface ToastHistoryEntry {
  id: number
  message: string
  ts: number          // Date.now() when shown
  durationMs: number  // how long it was displayed (so the bell can show "shown 8s" etc.)
  hadAction: boolean  // was there an [Undo] / clickable action?
}

const _toast = ref<Toast | null>(null)
let _timer: ReturnType<typeof setTimeout> | null = null

/** Ring buffer of the last N toasts — readable from the 🔔 bell in the title bar.
 *  r41 v277 (Tom Gilb 2026-06-22 "AI was slow message disappeared before I could read"
 *  + "a second far too fast disappearing message said something about what was generated")
 *  — every showToast call ALSO pushes into this history so the user can recall any
 *  too-fast message after it dismissed.  Composes with: universal accessibility
 *  (no reader can reliably parse a multi-sentence notification in 2 seconds — the
 *  recall mechanism prevents one-shot information loss for every user),
 *  No-Silent-Data-Loss SUPREME (toasts ARE the data; making them ephemeral was a
 *  silent-loss surface), DD-009 Zero-Training UI (bell + panel are visible at-a-
 *  glance), MOVE Principle (recall option visible always, not hunted-for). */
const TOAST_HISTORY_CAP = 20
const _toastHistory = ref<ToastHistoryEntry[]>([])
const _unreadToastCount = ref(0)

/** Brief 880 Hz sine pling + mobile haptic. Called on every showToast. */
function _playPling(): void {
  // Audio pling
  try {
    const ACtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (ACtx) {
      const ctx = new ACtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.10, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.14)
      ctx.close().catch(() => {})
    }
  } catch {}
  // Haptic feedback on mobile
  try { navigator.vibrate?.(18) } catch {}
}

export function useToast() {
  /**
   * Display a brief floating toast.
   * @param message  Toast text
   * @param ms       Duration in ms (default 1800)
   * @param action   Optional clickable action — e.g. `{ label: '[Undo]', handler: ... }`.
   *                 When present the toast becomes pointer-events-auto and clicking the
   *                 action both fires the handler AND dismisses the toast.
   */
  function showToast(message: string, ms = 1800, action: ToastAction | null = null) {
    if (_timer) clearTimeout(_timer)
    const id = Date.now()
    _toast.value = { message, id, action }
    _playPling()
    _timer = setTimeout(() => { _toast.value = null }, ms)
    // r41 v277 — push into ring history so the 🔔 bell can re-surface it
    _toastHistory.value = [
      { id, message, ts: id, durationMs: ms, hadAction: !!action },
      ..._toastHistory.value,
    ].slice(0, TOAST_HISTORY_CAP)
    _unreadToastCount.value = Math.min(_unreadToastCount.value + 1, TOAST_HISTORY_CAP)
  }

  /** Programmatic dismiss — used when an action handler runs (so the toast disappears). */
  function dismissToast() {
    if (_timer) clearTimeout(_timer)
    _toast.value = null
  }

  /** Mark the bell as "read" — called when the user opens the history panel. */
  function markToastHistoryRead() {
    _unreadToastCount.value = 0
  }

  /** Clear the ring buffer entirely — user action only (e.g. "clear history" button). */
  function clearToastHistory() {
    _toastHistory.value = []
    _unreadToastCount.value = 0
  }

  return {
    toast:                 _toast,
    showToast,
    dismissToast,
    toastHistory:          _toastHistory,
    unreadToastCount:      _unreadToastCount,
    markToastHistoryRead,
    clearToastHistory,
  }
}
