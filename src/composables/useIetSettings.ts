// UNIT_TYPE=Composable
// useIetSettings.ts — IET (Impact Estimation Table) local settings, Stage 4
// Phase 2 (audit-backlog #3).
//
// v477 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #3 Stage 4
// Impacts Phase 2).  Tom's verbatim design at memory/rule_stage_4_impacts_
// design.md: *"An IET Settings Panel, here locally, can set degree of
// conservative or risky estimates."*
//
// The IET Settings surface (a small drawer/pane opened from the IET header)
// carries three interrelated dials:
//
//   1. conservatism (0-100) — how far to lean when auto-generating conservative
//      assumptions.  0 = risk-neutral (best-guess median); 100 = maximally
//      conservative (very low value impact, very high resource cost, huge
//      ±uncertainty).  Default 60 — leans conservative per Tom's rule
//      *"a low impact value or high impact resource"*.
//
//   2. credibilityThreshold (0.0-1.0) — cells with credibility BELOW this
//      threshold get flagged in the IET as "needs evidence".  Default 0.4
//      (CE-scale: one weak source or worse triggers the flag).
//
//   3. autoAssumeStrength (0.0-1.0) — how heavily to apply the conservatism
//      dial when auto-generating.  1.0 = full effect; 0.0 = disabled (never
//      auto-generate, planner must fill every cell manually).  Default 1.0.
//
// Composes with:
//   - Stage 4 Impacts Phase 2 design (memory/rule_stage_4_impacts_design.md)
//   - Universal Undo SUPREME (settings changes are Undo-able via localStorage
//     write-back; a future ship can add explicit undo integration)
//   - No-Silent-Data-Loss SUPREME (settings persist across sessions)
//   - Twin portability — pure TS composable + localStorage; ports verbatim

import { computed, ref, watch } from 'vue'

/** The IET settings shape persisted to localStorage. */
export interface IetSettings {
  /** 0-100.  0 = neutral, 100 = maximally conservative. */
  conservatism: number
  /** 0.0-1.0 CE-scale threshold below which a cell is flagged for evidence. */
  credibilityThreshold: number
  /** 0.0-1.0 factor applied when auto-generating conservative assumptions. */
  autoAssumeStrength: number
}

const STORAGE_KEY = 'sem-app-iet-settings'

/** Default settings — leans conservative per Tom's verbatim design. */
const DEFAULT_SETTINGS: IetSettings = Object.freeze({
  conservatism:         60,
  credibilityThreshold: 0.4,
  autoAssumeStrength:   1.0,
})

/** Load persisted settings, tolerating any localStorage / JSON error. */
function loadSettings(): IetSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<IetSettings>
    return {
      conservatism:         _clampNumber(parsed.conservatism,         DEFAULT_SETTINGS.conservatism,         0, 100),
      credibilityThreshold: _clampNumber(parsed.credibilityThreshold, DEFAULT_SETTINGS.credibilityThreshold, 0, 1),
      autoAssumeStrength:   _clampNumber(parsed.autoAssumeStrength,   DEFAULT_SETTINGS.autoAssumeStrength,   0, 1),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function _clampNumber(v: unknown, fallback: number, lo: number, hi: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(lo, Math.min(hi, v))
}

// Singleton reactive state — one IET settings block per app instance.
const _settings = ref<IetSettings>(loadSettings())

// Auto-persist on any change.
watch(_settings, (s) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore — private mode / disabled storage
  }
}, { deep: true })

/**
 * Human-readable label for the conservatism slider (e.g. "Balanced",
 * "Conservative", "Maximally conservative").
 */
export function conservatismLabel(c: number): string {
  if (c <= 20) return 'Risky (best guess)'
  if (c <= 40) return 'Slightly conservative'
  if (c <= 60) return 'Balanced'
  if (c <= 80) return 'Conservative'
  return 'Maximally conservative'
}

/**
 * Human-readable label for the credibility-threshold slider.  Uses the CE-book
 * scale bands (0.0 pure guess ↔ 1.0 measured).
 */
export function credibilityThresholdLabel(t: number): string {
  if (t <= 0.2) return 'Flag only unsupported guesses'
  if (t <= 0.4) return 'Flag anecdotal / single-source'
  if (t <= 0.6) return 'Flag weak-source estimates'
  if (t <= 0.8) return 'Flag anything below published-study grade'
  return 'Flag anything below direct measurement'
}

/**
 * Composable — returns the IET settings ref + label helpers + reset action.
 * Multiple call sites share the same singleton so the IET view + Settings
 * panel stay in sync automatically.
 */
export function useIetSettings() {
  return {
    /** Reactive full settings object. */
    settings: _settings,
    /** Convenience computeds for template terseness. */
    conservatism:         computed(() => _settings.value.conservatism),
    credibilityThreshold: computed(() => _settings.value.credibilityThreshold),
    autoAssumeStrength:   computed(() => _settings.value.autoAssumeStrength),
    /** Live-updated slider labels. */
    conservatismLabelText:         computed(() => conservatismLabel(_settings.value.conservatism)),
    credibilityThresholdLabelText: computed(() => credibilityThresholdLabel(_settings.value.credibilityThreshold)),
    /** Reset to shipped defaults. */
    resetToDefaults(): void {
      _settings.value = { ...DEFAULT_SETTINGS }
    },
  }
}

/** Non-reactive accessor for use outside components (e.g. in other composables). */
export function getIetSettings(): IetSettings {
  return { ..._settings.value }
}
