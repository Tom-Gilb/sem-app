// UNIT_TYPE=Composable
// useApertureMode — Ultra Light Phase 3 "Naked Plan" view.
//
// Tom 2026-05-14: *"I want to white out everything except the input/output —
// ear/eye/mouth — a beautifully crafted aperture, inviting dialogue. Utter
// beauty and simplicity. There needs to be one button to get any more
// clutter… the initial default is 'Plan', and we can go back to it too.
// This master Menu button is called 'Menu'."*
//
// Behaviour
//   - Gated by `?aperture=1` (URL flag, mirrored to localStorage so it
//     persists). `?aperture=0` removes it. Reversible.
//   - When `enabled === true`, the App renders an Aperture overlay AND a
//     single floating "Menu" pin. The Aperture covers the underlying app
//     ONLY while `view === 'plan'` — picking any other menu item drops the
//     aperture so the user lands in the corresponding existing surface.
//   - Default `view` is `'plan'` — the naked aperture. Choosing the "Plan"
//     menu item from anywhere returns to it (= the "go back" path Tom
//     described).
//
// View modes (6 ratified by Tom 2026-05-14):
//   plan      — the naked aperture (DEFAULT)
//   start     — Start Menu (fresh-plan entry, guided prompts)
//   novice    — Novice Menu (friendly tour, examples, no jargon)
//   basic     — Basic Menu (essentials: generate, share, save)
//   full      — Full Menu (everything we have today)
//   previous  — Previous Plan Menu (re-open saved plans)
//
// Wiring policy
//   For Evo Step 1 only `plan` (aperture) and `full` (existing app) actually
//   route somewhere distinct. The four others render the existing app
//   *temporarily* — each will be sharpened in its own Evo step (Start,
//   Novice, Basic, Previous). The user sees the chosen label in the menu
//   highlight so they know the click registered.

import { ref, watch } from 'vue'

const STORAGE_KEY     = 'sem-app:aperture:enabled:v1'
const OPT_OUT_KEY     = 'sem-app:aperture:opt-out:v1'
const VIEW_KEY        = 'sem-app:aperture:view:v1'
const ULTRA_LIGHT_KEY = 'sem-app:ultraLight:v1'   // matches useUltraLight.ts

export type ApertureView = 'plan' | 'start' | 'novice' | 'basic' | 'full' | 'previous'

export interface ApertureMenuItem {
  id: ApertureView
  label: string
  blurb: string
  /** Tailwind tone hint for the menu pip — keeps glyph-size parity (no hierarchy by size). */
  tone: 'plan' | 'neutral' | 'forward'
}

/**
 * The 6 menu items, in the user-facing display order. "Plan" is listed first
 * because it is BOTH the default AND the "go back" choice — putting it at the
 * top reflects its primacy.
 */
export const MENU_ITEMS: readonly ApertureMenuItem[] = [
  { id: 'plan',     label: 'Plan',          blurb: 'The naked aperture — speak, type, listen.',         tone: 'plan'    },
  { id: 'start',    label: 'Start Menu',    blurb: 'Begin a fresh plan with guided prompts.',           tone: 'forward' },
  { id: 'novice',   label: 'Novice Menu',   blurb: 'Friendly tour, examples, no jargon.',               tone: 'forward' },
  { id: 'basic',    label: 'Basic Menu',    blurb: 'The essentials — generate, share, save.',           tone: 'neutral' },
  { id: 'full',     label: 'Full Menu',     blurb: 'Every tool — Spec Editor, Plan Targets, Heat Lane.', tone: 'neutral' },
  { id: 'previous', label: 'Previous Plan', blurb: 'Re-open one of your saved plans.',                  tone: 'neutral' },
] as const

function _readEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    const param = url.searchParams.get('aperture')

    // Explicit URL overrides (write-through to localStorage so they stick):
    //   ?aperture=1 → force ON, clear any prior opt-out.
    //   ?aperture=0 → force OFF (opt-out), even if ULTRA is on.
    if (param === '1' || param === 'true') {
      localStorage.setItem(STORAGE_KEY, '1')
      localStorage.removeItem(OPT_OUT_KEY)
      return true
    }
    if (param === '0' || param === 'false') {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(OPT_OUT_KEY, '1')
      return false
    }

    // No URL override — apply Tom's "naked Plan is the default" rule
    // (2026-05-14): when ULTRA mode is on, the aperture IS the home page
    // unless the user has explicitly opted out via ?aperture=0.
    const ultraOn  = localStorage.getItem(ULTRA_LIGHT_KEY) === '1'
    const optedOut = localStorage.getItem(OPT_OUT_KEY)     === '1'
    if (ultraOn && !optedOut) return true

    // Fallback: explicit per-aperture flag (legacy path, kept reversible
    // so the previous behaviour still works for users not on ULTRA).
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function _readView(): ApertureView {
  // The Plan aperture (the circle) is ALWAYS the home screen on page load.
  // All other views are transient navigation states:
  //   'full'     — pass-through to the underlying app; obviously transient.
  //   'start'    — 3-step wizard; transient (mid-flow state that's meaningless
  //                without user intent; landing here on reload looks broken).
  //   'novice'   — examples gallery; transient.
  //   'basic'    — same as Plan but with save/share pills; transient.
  //   'previous' — saved-plan picker; transient.
  // Rule: never restore any view other than 'plan'.  If the user was in the
  // Start wizard and reloads, they land back on the clean aperture circle —
  // not mid-wizard with empty fields.  Tom 2026-05-18: "the aperture does not
  // appear" caused by 'start' being sticky from a previous session.
  return 'plan'
}

// ── Singleton state — all callers share one truth source ─────────────────────

const _enabled = ref<boolean>(_readEnabled())
const _view    = ref<ApertureView>(_readView())

watch(_view, (v) => {
  try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ }
})

export function useApertureMode() {
  function setEnabled(next: boolean): void {
    _enabled.value = next
    try {
      if (next) localStorage.setItem(STORAGE_KEY, '1')
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }
  function setView(v: ApertureView): void {
    _view.value = v
  }
  /** "Back to Plan" — the universal escape hatch Tom asked for. */
  function backToPlan(): void {
    _view.value = 'plan'
  }
  return { enabled: _enabled, view: _view, setEnabled, setView, backToPlan, MENU_ITEMS }
}
