/**
 * useActiveMode — Top-level app mode (Plan · Model · Contract).
 *
 * Tom Gilb 2026-06-16 verbatim: *"Mode will be clearly displayed 'Mode:.....'
 * and clicking it will allow us to select 1. the settings level subsets of
 * that mode, and going to another mode.  Hovering over the always present
 * MODE button will display the currently selected settings (while one click
 * will bring us to the change settings, and an opportunity to change mode.
 * When changing mode, there must be a governance of auto save of the version,
 * in the right history (Model, Plan etc), and a choice of 1. Fresh Start,
 * 2. Reuse this current model in the new Mode."*
 *
 * Three top-level modes shape the entire app surface:
 *   - 'plan'     — default Stakes-Ends-Means planning (the canonical SEM
 *                  workflow).  Auto-saves land in Plan History.
 *   - 'model'    — working with reusable Spec Models (templates that compose
 *                  into many plans).  Auto-saves land in Model History.
 *   - 'contract' — working with imported Contracts.  Auto-saves land in
 *                  Contract History (the per-contract entries).
 *
 * Mode is a SINGLETON — only one active at a time.  Persisted via
 * localStorage so reloads preserve the user's working context.
 *
 * Composes with:
 *   - r41 v47 Contracts Mode 4-axis rich config (active when activeMode === 'contract')
 *   - r41 v48 Model Mode 4-axis rich config (active when activeMode === 'model')
 *   - Settings.mode (Ultra Light / Pro SEM) — orthogonal feature-density toggle
 *   - Universal Undo SUPREME (mode switches are reversible)
 *   - No-Silent-Data-Loss SUPREME (auto-save before switch is mandatory)
 *   - MOVE Principle (Mode button always visible; click + hover both work)
 */

import { ref, computed } from 'vue'

const STORAGE_KEY = 'sem-app:activeMode:v1'

export type ActiveMode = 'plan' | 'model' | 'contract' | 'strategy'

export interface ActiveModeMeta {
  id:        ActiveMode
  label:     string                    // human label (used in "Mode: Plan")
  emoji:     string
  blurb:     string                    // one-line description
  /** Settings panel section id to jump to when the user clicks
   *  "Adjust settings for this mode →".  Plan mode jumps to general 'mode'. */
  settingsSectionId: string
  /** Which history surface auto-receives the save when leaving this mode. */
  historyName:       string
}

export const ACTIVE_MODE_META: Record<ActiveMode, ActiveModeMeta> = {
  plan: {
    id: 'plan',
    label: 'Plan',
    emoji: '📐',
    blurb: 'Stakes → Ends → Means → Planguage spec → Evo Steps.  The canonical SEM workflow.',
    settingsSectionId: 'mode',
    historyName: 'Plan History',
  },
  model: {
    id: 'model',
    label: 'Model',
    emoji: '🏛',
    blurb: 'Reusable Spec Models — templates that compose into many plans.  Domain · Presentation · Standards · Purpose.',
    settingsSectionId: 'modelMode',
    historyName: 'Model History',
  },
  contract: {
    id: 'contract',
    label: 'Contract',
    emoji: '📋',
    blurb: 'Import + analyse contracts.  4-axis: Sharpening · Standards · Presentation · Purpose.',
    settingsSectionId: 'contractsMode',
    historyName: 'Contract History',
  },
  // r41 v50 (Tom Gilb 2026-06-16 "strategy mode needs to be a part of the set
  // of modes, not a separate function") — Strategy Mode promoted from a
  // boolean Settings toggle to a top-level Mode.  When activeMode ===
  // 'strategy', the existing `Settings.strategyMode` boolean is auto-set true
  // by a watcher in App.vue so the terminology overrides (Values → Strategic
  // Objectives etc.) take effect across the existing UI surfaces — no need to
  // re-plumb every consumer.
  strategy: {
    id: 'strategy',
    label: 'Strategy',
    emoji: '♟',
    blurb: 'SEM for organizational strategy planning + execution.  Terminology overrides: Values → Strategic Objectives, Solutions → Strategies, Evo Steps → Strategic Value Delivery Increments.',
    settingsSectionId: 'strategy',
    historyName: 'Strategy History',
  },
}

// ── Singleton state ─────────────────────────────────────────────────────────

function _hydrate(): ActiveMode {
  if (typeof localStorage === 'undefined') return 'plan'
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ActiveMode | null
    if (saved === 'plan' || saved === 'model' || saved === 'contract' || saved === 'strategy') return saved
  } catch { /* fall through to default */ }
  return 'plan'
}

const _activeMode = ref<ActiveMode>(_hydrate())

function _persist(): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, _activeMode.value) } catch { /* ignore */ }
}

// ── Mode-switch governance state ────────────────────────────────────────────
//
// When the user clicks a different mode in the Mode menu, we do NOT switch
// immediately.  Instead we surface a governance dialog with two choices:
//   1. Fresh Start — abandon current artifact in the outgoing mode (auto-
//      saved to its history first, then the workspace clears for the new mode)
//   2. Reuse — carry the current artifact across to the new mode (typically
//      copies the Spec / Plan / Contract into the new mode's workspace as a
//      starting point)
// The dialog is hosted by App.vue; this composable just exposes the pending
// state + handlers.

export type ModeSwitchChoice = 'fresh' | 'reuse'

interface PendingSwitch {
  fromMode: ActiveMode
  toMode:   ActiveMode
}

const _pendingSwitch = ref<PendingSwitch | null>(null)

// ── Public API ──────────────────────────────────────────────────────────────

export function useActiveMode() {

  const activeMode = computed(() => _activeMode.value)
  const activeMeta = computed(() => ACTIVE_MODE_META[_activeMode.value])
  const allModes   = computed(() => Object.values(ACTIVE_MODE_META))
  const pendingSwitch = computed(() => _pendingSwitch.value)

  /** Request a mode switch.  Surfaces a pending-switch state; the host app
   *  must resolve it via `resolveSwitch(choice)` once the user picks a
   *  governance choice in the dialog. */
  function requestSwitch(toMode: ActiveMode): void {
    if (toMode === _activeMode.value) return
    _pendingSwitch.value = { fromMode: _activeMode.value, toMode }
  }

  /** Resolve a pending switch.  Caller is responsible for the auto-save
   *  + reuse-or-clear side-effects in App.vue before calling this. */
  function resolveSwitch(_choice: ModeSwitchChoice): void {
    const pending = _pendingSwitch.value
    if (!pending) return
    _activeMode.value = pending.toMode
    _persist()
    _pendingSwitch.value = null
  }

  /** Cancel a pending switch without changing mode. */
  function cancelSwitch(): void {
    _pendingSwitch.value = null
  }

  /** Direct setter used by tests + recovery paths.  Skips governance. */
  function _setForce(mode: ActiveMode): void {
    _activeMode.value = mode
    _persist()
    _pendingSwitch.value = null
  }

  return {
    activeMode,
    activeMeta,
    allModes,
    pendingSwitch,
    requestSwitch,
    resolveSwitch,
    cancelSwitch,
    _setForce,
    ACTIVE_MODE_META,
  }
}
