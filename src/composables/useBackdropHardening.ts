// UNIT_TYPE=Composable
// r41 v467 (Tom Gilb 2026-07-02 verbatim *"I was looking at the guidelines
// list and it suddenly jumped back to contracts main window"*) — SECOND
// occurrence of the same "modal jumps back" bug Tom flagged earlier in
// the session.  v450 patched RedraftResultPanel specifically; this ship
// SWEEPS the class: shared composable applied to every modal + panel
// with a bg-black backdrop.
//
// The failure mode named:
//   Backdrops are full-viewport <div fixed inset-0 bg-black/N @click="close"/>.
//   The content sits on top (z-index).  BUT any cursor drift into the
//   margin around the content (scrollbar drag, two-finger trackpad
//   click, momentum-scroll, drag-select ending on backdrop) fires a
//   click that closes the modal.  Silent-context-loss for the user.
//
// The fix:
//   pointerdown+pointerup-BOTH-on-backdrop pattern.  Only INTENTIONAL
//   press+release both on the backdrop closes.  Drag from content →
//   backdrop won't close.  Momentum scroll won't close.  Scrollbar drag
//   won't close.
//
// Composes with:
//   • Tom-Repeats-Himself SUPREME — this is the second flag; v450 fixed
//     one panel not the class.  The composable IS the class-fix.
//   • No-Silent-Data-Loss SUPREME — user's read-context (scroll position,
//     selected content, expanded rows) is preserved.
//   • CloseDot SUPREME — Escape key + CloseDot pin remain primary close
//     affordances.  Backdrop-click is the third, now hardened.
//   • Twin portability — Kai's industrial Twin inherits verbatim; every
//     modal port picks up the same hardening.

import { ref } from 'vue'

export interface BackdropHardening {
  /** Attach to backdrop element as @pointerdown handler. */
  onBackdropPointerDown: (ev: PointerEvent) => void
  /** Attach to backdrop element as @pointerup handler.
   *  If both events landed on the backdrop, fires the close callback. */
  onBackdropPointerUp:   (ev: PointerEvent) => void
  /** Attach to the modal content wrapper as @pointerdown handler.
   *  Disarms the backdrop if the pointer STARTED inside the content —
   *  protects against drag-from-content-to-backdrop closes. */
  onContentPointerDown:  (ev: PointerEvent) => void
}

/** Returns three handlers that harden any modal backdrop against
 *  accidental closes.  Pass the panel's `emit('close')` callback. */
export function useBackdropHardening(onClose: () => void): BackdropHardening {
  const armed = ref(false)
  return {
    onBackdropPointerDown(_ev) {
      armed.value = true
    },
    onBackdropPointerUp(_ev) {
      if (armed.value) onClose()
      armed.value = false
    },
    onContentPointerDown(_ev) {
      // Any pointerdown that starts inside the white content disarms
      // the backdrop — protects against drag-from-content-to-backdrop
      // closes (e.g. scrollbar drag ending in the margin).
      armed.value = false
    },
  }
}
