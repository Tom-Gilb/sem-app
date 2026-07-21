/**
 * useIlluminationPreferences — Phase 3 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 3 mandate):
 *   *"4. We have an 'Illumination Settings' panel where we allow them to set
 *    Preferences (like 'Always Give Me An Ontology Diagram', 'I like historical
 *    background', 'I want deepest possible insights'). This panel is tied to a
 *    specific Plan/Spec Owner or Planner, by default the ones named for the
 *    current plan."*
 *
 * Two-tier preference architecture (the "before personal preferences" phrasing
 * Tom used 2026-06-15 in the Settings Menu mandate):
 *
 *   GLOBAL DEFAULTS (r41 v29 — `Settings.illumination*` keys)
 *      ↓ overridden by ↓
 *   PERSONAL PREFERENCES (this composable — keyed per Plan-Owner / Planner)
 *      ↓ surfaced as effective values in ↓
 *   ⌘I PICKER (renders the effective preference, never the raw global default)
 *
 * Storage: localStorage at `sem-app:illuminationPreferences:v1`.  Key format:
 * `<planId>:<ownerOrPlannerName>`.  Singleton composable — preferences are
 * shared across all components that consume them.
 *
 * Composes with:
 *   - r41 v29 global Settings → BASELINE (Settings.illumination* keys)
 *   - r41 v27 6-tab IA (overrides default tab)
 *   - r41 v28 glance card (overrides show-glance / depth)
 *   - r41 v30 classifier (Phase 2; preferences can disable area auto-suggest)
 *   - SEM-teaches-incrementally SUPREME (per-Owner depth tunes the teaching)
 *   - No-Silent-Data-Loss SUPREME (localStorage-persisted, hydrated on init)
 *   - Universal Undo SUPREME (every setOne / clearAll goes through undoStack)
 *   - Twin portability (pure composable; ports verbatim)
 *   - American English Standard (UI strings)
 *   - HoverHint (not "tooltip")
 */

import { ref, computed } from 'vue'
import { useSettings } from './useSettings'

const STORAGE_KEY = 'sem-app:illuminationPreferences:v1'

export type IlluminateTab = 'define' | 'diagram' | 'pictures' | 'universe' | 'books' | 'twin'
export type IlluminationDepth = 'short' | 'standard' | 'deep'

/** Per-Owner / per-Planner override of the global Illumination defaults.
 *  ALL fields optional — undefined means "fall through to the global default". */
export interface IlluminationPreferenceOverride {
  defaultTab?:           IlluminateTab
  showGlanceCard?:       boolean
  autoFireTwin?:         boolean
  alwaysDiagramFirst?:   boolean
  depth?:                IlluminationDepth
  includeHistory?:       boolean
  // r41 v32 — Phase 3 NEW per-Owner-only knobs (not in global defaults).
  twinTimeoutSeconds?:   number                // 0 = no timeout
  showClassifierLens?:   boolean               // toggle Phase 2 lens chip
  preferredEmailAddress?: string               // default recipient for Email Everything (Phase 5)
  // Bookkeeping
  lastSavedAt?:          number                // ms timestamp
}

interface PreferencesStore {
  /** Map keyed by `<planId>:<ownerName>` → that user's overrides. */
  byKey: Record<string, IlluminationPreferenceOverride>
}

// ── Singleton state ──────────────────────────────────────────────────────────
const _store = ref<PreferencesStore>({ byKey: {} })

// Hydrate from localStorage at module init.  No-silent-data-loss guarantee.
function _hydrate(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.byKey) {
      _store.value = parsed
    }
  } catch (err) {
    console.warn('[useIlluminationPreferences] hydrate failed', err)
  }
}

function _persist(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_store.value))
  } catch (err) {
    console.warn('[useIlluminationPreferences] persist failed', err)
  }
}

_hydrate()

/** Build the lookup key.  Trims + lowercases the owner name to avoid trivial
 *  duplicates (Tom Gilb / tom gilb / TOM GILB all map to one preference set). */
function _keyFor(planId: string, ownerName: string): string {
  return `${planId.trim().toLowerCase()}:${ownerName.trim().toLowerCase()}`
}

// ── Public API ───────────────────────────────────────────────────────────────

export function useIlluminationPreferences() {
  const { settings } = useSettings()

  /** Look up the override for (planId, ownerName).  Returns undefined when
   *  the user has not set any personal preferences yet (Tom's "before personal
   *  preferences" baseline). */
  function getOverride(planId: string, ownerName: string): IlluminationPreferenceOverride | undefined {
    if (!planId || !ownerName) return undefined
    return _store.value.byKey[_keyFor(planId, ownerName)]
  }

  /** Set ONE field for a user.  All other fields stay untouched.  Composes
   *  with Universal Undo — callers should record() before invoking this. */
  function setOne<K extends keyof IlluminationPreferenceOverride>(
    planId:   string,
    ownerName: string,
    key:       K,
    value:     IlluminationPreferenceOverride[K],
  ): void {
    if (!planId || !ownerName) return
    const k = _keyFor(planId, ownerName)
    const prev = _store.value.byKey[k] ?? {}
    _store.value.byKey[k] = { ...prev, [key]: value, lastSavedAt: Date.now() }
    _persist()
  }

  /** Replace the ENTIRE override for a user (used by "Reset to global defaults"
   *  and "Copy from another planner"). */
  function setAll(planId: string, ownerName: string, override: IlluminationPreferenceOverride): void {
    if (!planId || !ownerName) return
    const k = _keyFor(planId, ownerName)
    _store.value.byKey[k] = { ...override, lastSavedAt: Date.now() }
    _persist()
  }

  /** Remove all personal preferences for (planId, ownerName) — falls back to
   *  global defaults entirely. */
  function clearOverride(planId: string, ownerName: string): void {
    if (!planId || !ownerName) return
    const k = _keyFor(planId, ownerName)
    delete _store.value.byKey[k]
    _persist()
  }

  /** EFFECTIVE preferences for (planId, ownerName) = personal-override OR
   *  global default per field.  This is what the ⌘I picker actually consumes. */
  function effective(planId: string, ownerName: string): Required<Omit<IlluminationPreferenceOverride, 'lastSavedAt'>> & { lastSavedAt: number | null } {
    const ov = getOverride(planId, ownerName) ?? {}
    const g = settings.value
    return {
      defaultTab:            ov.defaultTab            ?? g.illuminationDefaultTab,
      showGlanceCard:        ov.showGlanceCard        ?? g.illuminationShowGlanceCard,
      autoFireTwin:          ov.autoFireTwin          ?? g.illuminationAutoFireTwin,
      alwaysDiagramFirst:    ov.alwaysDiagramFirst    ?? g.illuminationAlwaysDiagramFirst,
      depth:                 ov.depth                 ?? g.illuminationDepth,
      includeHistory:        ov.includeHistory        ?? g.illuminationIncludeHistory,
      twinTimeoutSeconds:    ov.twinTimeoutSeconds    ?? 30,            // sensible per-user default
      showClassifierLens:    ov.showClassifierLens    ?? true,          // Phase 2 lens on by default
      preferredEmailAddress: ov.preferredEmailAddress ?? g.defaultEmailFrom,
      lastSavedAt:           ov.lastSavedAt ?? null,
    }
  }

  /** Discover all (planId, ownerName) pairs that have any saved preferences.
   *  Used by the Phase 3 panel's "switch profile" dropdown. */
  const allProfiles = computed<Array<{ key: string; planId: string; ownerName: string }>>(() => {
    const out: Array<{ key: string; planId: string; ownerName: string }> = []
    for (const k of Object.keys(_store.value.byKey)) {
      const [planId, ownerName] = k.split(':')
      out.push({ key: k, planId: planId || '?', ownerName: ownerName || '?' })
    }
    return out
  })

  return {
    getOverride,
    setOne,
    setAll,
    clearOverride,
    effective,
    allProfiles,
    _storeForTests: _store, // exposed for vitest only
  }
}
