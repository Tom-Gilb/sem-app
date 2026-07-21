// useUltraLight — feature flag + canonical Fork vocabulary for the
// Ultra Light architecture (RATIFIED 2026-05-14, see vault doc
// `Ultra-Light-Architecture.md`).
//
// Evo Step 1 (2026-05-14): visual-only Fork Bar on the home page behind a
// `?ultraLight=1` URL flag. No state machine, no wiring — Tom ratifies the
// vocabulary in situ before any commitment to existing chrome.
//
// To enable while running the dev server: append `?ultraLight=1` to the URL
// (any truthy value works). To disable: remove the param or set to 0.
// localStorage `sem-app:ultraLight:v1` mirrors the param so it survives
// refresh once enabled.

import { ref } from 'vue'

const STORAGE_KEY = 'sem-app:ultraLight:v1'

// ───── Flag (singleton) ────────────────────────────────────────────────────

function _readInitialFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    const param = url.searchParams.get('ultraLight')
    if (param !== null) {
      const enabled = param !== '0' && param.toLowerCase() !== 'false' && param !== ''
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
      return enabled
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === '1'
  } catch {
    return false
  }
}

const _enabled = ref<boolean>(_readInitialFlag())

function setEnabled(next: boolean): void {
  _enabled.value = next
  try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
}

// ───── Canonical Fork vocabulary ───────────────────────────────────────────
//
// The 8 verbs Tom ratified in Q-block of `Ultra-Light-Architecture.md`.
// Verb-only labels (no decorative glyphs) per design-taste rule "plain
// English verb labels." Each Fork has a single optional accent glyph that
// composes with the keyed-icon family already in the app.
//
// `Why?` is intentionally hidden — surfaces via ⌥-click on Go Ahead (Q4
// ratification: "folds behind ⌥-click, keep it simple"). It is not in this
// list because it's not a visible Fork.

export type ForkId =
  | 'goAhead'
  | 'refine'
  | 'improve'
  | 'keepItSimple'
  | 'goBack'
  | 'showMeMore'
  | 'saveThis'
  | 'startFresh'

export interface ForkSpec {
  id: ForkId
  /** Plain-English label shown on the pill. */
  label: string
  /** Optional single-glyph accent — never a decorative emoji. */
  accent?: string
  /** One-sentence purpose — used as the aria-label short description. */
  blurb: string
  /**
   * Rich multi-sentence description shown in the custom hover HoverHint panel.
   * Grounded in CE/Planguage language so every fork feels purposeful.
   */
  tooltip: string
  /** Visual tone — emerald = primary forward action; slate = neutral; amber = caution; rose = destructive. */
  tone: 'primary' | 'neutral' | 'caution' | 'destructive'
  /**
   * If true, clicking opens an inline action menu (managed by SEMEntryForm).
   * If false/absent, clicking is a direct action with no menu.
   */
  hasMenu?: boolean
}

export const FORKS: readonly ForkSpec[] = Object.freeze([
  {
    id: 'goAhead',
    label: 'Go Ahead',
    blurb: 'Take what you have and do the next thing.',
    tooltip:
      'The primary forward action. In the input stage, it parses your raw text into structured ' +
      'stakeholder, value, and strategy chips. In the review stage, it generates your full ' +
      'Planguage specification. When in doubt — press this.',
    tone: 'primary',
    // Direct action — no menu.
  },
  {
    id: 'refine',
    label: 'Refine',
    blurb: 'Tighten what you have — clarify wording, add detail, tune priorities.',
    tooltip:
      'Tighten what you have before committing. Options let you return to the text for ' +
      'rephrasing, surface missing Planguage fields, or make your Values measurable with ' +
      'explicit thresholds — a CE requirement for any quantified plan.',
    tone: 'neutral',
    hasMenu: true,
  },
  {
    id: 'improve',
    label: 'Improve',
    blurb: 'Push for a better version — sharpen, generate more, raise the bar.',
    tooltip:
      'Push the plan further. Options include generating the full spec immediately, surfacing ' +
      'additional strategies that match your goals, or running a Planguage completeness check ' +
      'against CE criteria — useful when the first pass feels thin.',
    tone: 'neutral',
    hasMenu: true,
  },
  {
    id: 'keepItSimple',
    label: 'Keep It Simple',
    blurb: 'Cut clutter — fewer fields, fewer options, just the essentials.',
    tooltip:
      'Engineering simplicity into your plan using Tom Gilb\'s SIMPLE methods (2022). ' +
      'Lord Kelvin\'s Principle: quantify every Value — "simple" must have a number ' +
      '("setup in ≤ 10 min", not "faster"). Scope Sacrifice (Penta Tradeoffs): consciously ' +
      'drop the lowest-impact chips so the remaining ones get better. The Main Simple Idea: ' +
      'one page, top-ten quantified stakeholder values. Know Evil: define the Tolerable Level ' +
      'for your most critical Value before generating — failure is missing it by even one unit.',
    tone: 'neutral',
    hasMenu: true,
  },
  {
    id: 'goBack',
    label: 'Go Back',
    blurb: 'Return to the previous step or view.',
    tooltip:
      'Return to the previous step. From the review stage, returns to the text input while ' +
      'preserving your raw text. From the input stage, surfaces the Aperture Plan view if ' +
      'available — otherwise this is already the beginning.',
    tone: 'neutral',
    // Direct action — no menu.
  },
  {
    id: 'showMeMore',
    label: 'Show Me More',
    blurb: 'Expose more detail, more options, or related views.',
    tooltip:
      'Expose more depth, options, or related views. Browse curated example plans for ' +
      'inspiration, generate the full spec immediately, or let the app propose additional ' +
      'entries you haven\'t considered yet.',
    tone: 'neutral',
    hasMenu: true,
  },
  {
    id: 'saveThis',
    label: 'Save This',
    accent: '*→[*]',
    blurb: 'Snapshot the current state and continue working.',
    tooltip:
      'Snapshot the current state to localStorage so you can safely explore other paths. ' +
      'A lightweight safety net before any major change — recover the draft at any time ' +
      'with the draft-restore feature.',
    tone: 'neutral',
    // Direct action — no menu.
  },
  {
    id: 'startFresh',
    label: 'Start Fresh',
    accent: '[*]→[ ]',
    blurb: 'Open the Fresh Start menu — graduated reset options.',
    tooltip:
      'Open the graduated reset menu. Choose exactly how much to clear — from a light reset ' +
      '(keep your text, clear the chips) to a complete blank slate. Safer than a single ' +
      'destructive "clear all" button.',
    tone: 'caution',
    hasMenu: true,
  },
] as const) as readonly ForkSpec[]

// ───── Hook accessor ──────────────────────────────────────────────────────

export function useUltraLight() {
  return {
    enabled: _enabled,
    setEnabled,
    forks: FORKS,
  }
}
