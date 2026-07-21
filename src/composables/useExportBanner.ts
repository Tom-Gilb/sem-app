// UNIT_TYPE=Hook
// useExportBanner — module-level singleton for the universal ⌘V email banner.
//
// Tom Gilb 2026-06-06: "this design applies for all export in sem."
//
// Any component or composable that fires an email export calls
// showExportEmailBanner(label) to show the full-width fixed banner in App.vue.
// App.vue renders the banner once via <ExportEmailBanner /> or inline template.
// No prop-drilling, no event bus — module singleton pattern (same as useDefine.ts).

import { ref, readonly } from 'vue'

// ── Module-level state ────────────────────────────────────────────────────────

const _visible = ref(false)
const _label   = ref('colourful HTML')
let   _timer: ReturnType<typeof setTimeout> | null = null

const AUTO_DISMISS_MS = 25_000   // 25 s — Mail compose window typically stays open

// ── Public actions ────────────────────────────────────────────────────────────

/**
 * Show the ⌘V instruction banner at the top of the SEM App.
 * @param label  What is on the clipboard, e.g. "Stage 7 Evo Impact HTML".
 *               Shown in the banner: "Mail is opening — press ⌘V to paste {label}".
 */
export function showExportEmailBanner(label = 'colourful HTML'): void {
  _label.value = label
  if (_timer !== null) clearTimeout(_timer)
  _visible.value = true
  _timer = setTimeout(() => {
    _visible.value = false
    _timer = null
  }, AUTO_DISMISS_MS)
}

/** Dismiss the banner immediately (user clicked ✕, or action completed). */
export function hideExportEmailBanner(): void {
  if (_timer !== null) { clearTimeout(_timer); _timer = null }
  _visible.value = false
}

// ── HMR dispose ──────────────────────────────────────────────────────────────
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (_timer !== null) clearTimeout(_timer)
    _visible.value = false
  })
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useExportBanner() {
  return {
    /** Whether the banner is currently visible. Rendered once in App.vue. */
    bannerVisible: readonly(_visible),
    /** The label shown in the banner body, set by showExportEmailBanner(). */
    bannerLabel:   readonly(_label),
    showExportEmailBanner,
    hideExportEmailBanner,
  }
}
