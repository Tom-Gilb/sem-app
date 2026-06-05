// UNIT_TYPE=Composable
// useSpecKeyMigration.ts — Phase 1 of the Plan→Spec rename refactor.
//
// Tom Gilb, 2026-06-04: *"Full Plan, go ahead"* + *"confirm Phase 1"*.
//
// PURPOSE
// -------
// The SEM App persists state to localStorage under keys prefixed with
// `sem-plan-*` and `sem-current-plan-model`.  Tom ratified `Spec` as the
// generic term for Plan / Model / Contract / Meeting Minutes (2026-06-04:
// *"I confirm spec"*), so those keys need to migrate to `sem-spec-*`.
//
// A blunt rename would silently lose every existing user's data — exactly
// the failure mode the Architectural-Resilience SUPREME rule + the
// May-19/May-26 disaster recovery guard against.
//
// This composable is the SAFE foundation for the rename:
//   • READS try the new key first, then fall back to the old key
//   • WRITES (when callers opt in) go to BOTH keys during transition,
//     then to the new key once the transition flag flips
//   • The OLD key is NEVER deleted by this shim — Phase 5 will do that
//     after a 60-day soak + Tom's explicit OK
//
// CALLERS that adopt this shim continue to work whether the user has
// fresh data (only new keys), legacy data (only old keys), or a mix
// (mid-transition, both populated).  No data loss, no surprise resets.
//
// PHASE PROGRESSION
// -----------------
//   Phase 1 (this file)  → shim shipped; callers can opt in.  No call sites
//                          changed yet — the shim is dormant until called.
//   Phase 2              → component renames (PlanHealthBadge → SpecHealthBadge …)
//   Phase 3              → variable renames in App.vue (planModel → spec …)
//   Phase 4              → UI label renames (Plan Owners → Spec Owners …)
//   Phase 5              → flip the write path to NEW-only keys; OLD keys
//                          remain on disk until Tom approves deletion.
//
// KEY MAPPING (the 4 plan-prefixed keys in the codebase as of 2026-06-04)
// -----------------------------------------------------------------------
//   sem-current-plan-model   →  sem-current-spec
//   sem-plan-health-custom   →  sem-spec-health-custom
//   sem-plan-models          →  sem-specs
//   sem-plan-targets         →  sem-spec-targets
//
// SAFETY PROPERTIES (verified by the regression tests)
// ----------------------------------------------------
//   1. readMigrated() returns the NEW value if present.
//   2. readMigrated() falls back to the OLD value if NEW is missing.
//   3. readMigrated() returns null if NEITHER key has data.
//   4. writeBoth() writes the SAME value to both keys (dual-write window).
//   5. The shim NEVER calls removeItem() on the OLD key — that's Phase 5.
//   6. SSR-safe — guarded against `localStorage` being undefined.
//   7. Quota / serialise errors are caught and reported via the optional
//      onError callback rather than crashing the host component.

/** The 4 plan-prefixed keys mapped to their post-rename spec-prefixed names. */
export const SPEC_KEY_MAP: Record<string, string> = {
  'sem-current-plan-model': 'sem-current-spec',
  'sem-plan-health-custom': 'sem-spec-health-custom',
  'sem-plan-models':        'sem-specs',
  'sem-plan-targets':       'sem-spec-targets',
} as const

/**
 * Resolve the OLD (plan-prefixed) key for a given NEW (spec-prefixed) key.
 * Returns null if the new key is not part of the rename map (i.e. it was
 * already spec-named or is unrelated to the Plan→Spec refactor).
 */
export function oldKeyFor(newKey: string): string | null {
  for (const [oldK, newK] of Object.entries(SPEC_KEY_MAP)) {
    if (newK === newKey) return oldK
  }
  return null
}

/**
 * Resolve the NEW (spec-prefixed) key for a given OLD (plan-prefixed) key.
 * Returns the same key unchanged if there is no rename target.
 */
export function newKeyFor(oldKey: string): string {
  return SPEC_KEY_MAP[oldKey] ?? oldKey
}

interface MigrationOptions {
  /** Called when a localStorage read/write throws (quota, JSON parse, etc.). */
  onError?: (err: unknown, key: string) => void
}

/**
 * SSR-safe localStorage accessor.  Returns null in environments where
 * localStorage is unavailable (server-side render, locked-down browsers).
 */
function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * Read a value that may live under either the NEW spec-key or the legacy
 * plan-key.  Prefers NEW; falls back to OLD; returns null if neither exists.
 *
 * @param newKey   The post-rename spec-prefixed key (e.g. 'sem-current-spec').
 * @param options  Optional error hook.
 */
export function readMigrated(newKey: string, options: MigrationOptions = {}): string | null {
  const storage = safeStorage()
  if (!storage) return null
  try {
    const fresh = storage.getItem(newKey)
    if (fresh !== null) return fresh
    const legacyKey = oldKeyFor(newKey)
    if (!legacyKey) return null
    return storage.getItem(legacyKey)
  } catch (err) {
    options.onError?.(err, newKey)
    return null
  }
}

/**
 * Write a value to BOTH the NEW spec-key AND the legacy plan-key (if a
 * mapping exists).  This is the safe dual-write window: any code path that
 * has been ported to the new key keeps the old key fresh too, so an
 * un-ported reader still sees current data.
 *
 * @param newKey   The post-rename spec-prefixed key.
 * @param value    The string value (callers JSON-stringify if needed).
 * @param options  Optional error hook.
 */
export function writeBoth(newKey: string, value: string, options: MigrationOptions = {}): void {
  const storage = safeStorage()
  if (!storage) return
  try {
    storage.setItem(newKey, value)
    const legacyKey = oldKeyFor(newKey)
    if (legacyKey) storage.setItem(legacyKey, value)
  } catch (err) {
    options.onError?.(err, newKey)
  }
}

/**
 * One-shot copy of every legacy plan-prefixed key into its spec-prefixed
 * equivalent, IF the new key is empty.  Idempotent — safe to call on every
 * app startup.  Never deletes the legacy key (Phase 5's job, with Tom OK).
 *
 * Returns the list of keys that were actually copied this run, for telemetry.
 */
export function backfillSpecKeysFromPlanKeys(options: MigrationOptions = {}): string[] {
  const storage = safeStorage()
  if (!storage) return []
  const copied: string[] = []
  for (const [oldK, newK] of Object.entries(SPEC_KEY_MAP)) {
    try {
      const existsNew = storage.getItem(newK)
      if (existsNew !== null) continue           // new key already populated — leave alone
      const legacyValue = storage.getItem(oldK)
      if (legacyValue === null) continue          // nothing to copy
      storage.setItem(newK, legacyValue)
      copied.push(newK)
    } catch (err) {
      options.onError?.(err, newK)
    }
  }
  return copied
}

/**
 * Composable wrapper — call from a component's setup() to enable migrated
 * reads/writes for the lifetime of the app.  Returns the same primitives
 * exposed as standalone functions above, plus a one-shot backfill that
 * runs once per session.  The composable form lets Vue components import a
 * single named symbol rather than three.
 */
export function useSpecKeyMigration(options: MigrationOptions = {}) {
  return {
    read:     (newKey: string) => readMigrated(newKey, options),
    write:    (newKey: string, value: string) => writeBoth(newKey, value, options),
    backfill: () => backfillSpecKeysFromPlanKeys(options),
    keyMap:   SPEC_KEY_MAP,
    oldKeyFor,
    newKeyFor,
  }
}
