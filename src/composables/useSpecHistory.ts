// UNIT_TYPE=Hook
// useSpecHistory — Feature #29: Spec Version History
// Maintains a newest-first list of up to 10 SpecBlock snapshots.
// Persisted to localStorage (key: sem-spec-history-v1) so history survives
// page reloads, iOS Safari eviction, and zoom-triggered restarts.

import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStepPlan } from '../types/evo-plan'

export interface SpecVersion {
  id: string            // crypto.randomUUID() or Date.now().toString()
  spec: SpecBlock
  /** Evo Step Plan active at the time this version was saved (null if plan not yet generated) */
  plan: EvoStepPlan | null
  /** v514 (2026-07-21) — Resources envelope: estimation series, IET snapshots,
   *  Plan Scope Framework, ResourcesAgent settings.  Tom Gilb 2026-07-21:
   *  "can you promise me that all running estimation data is saved and
   *  restored with any version of the spec?" — v514 makes the answer YES.
   *  Optional for backwards-compat with pre-v514 stored SpecVersions;
   *  captureEnvelope() on save + hydrateEnvelope() on restore keep the
   *  resource subsystem in lock-step with the SpecBlock.  Type is `unknown`
   *  here to avoid circular imports; the concrete type is
   *  `ResourcesEnvelope` from `./useResourcesEnvelope`. */
  resourcesEnvelope?: unknown
  timestamp: number     // Date.now()
  label: string         // "Generated" | "Make Ambitious" | "Lean Plan" | "Restored"
  summary: string       // First V. entry description, truncated to 60 chars
  /** Spec model name at the time of snapshot — empty string when no spec model exists yet.
   * Optional for backward compatibility with pre-2026-05-11 localStorage entries. */
  specName?: string
  /** Spec model owner names at the time of snapshot (joined into a single
   *  searchable string). Optional for backward compatibility with
   *  pre-2026-05-12 localStorage entries — older versions get an empty array. */
  specOwners?: string[]
  /** @deprecated Use specName instead (kept for backward-compat reads from old localStorage entries) */
  planName?: string
  /** @deprecated Use specOwners instead (kept for backward-compat reads from old localStorage entries) */
  planOwners?: string[]
}

// Bumped from 10 → 50 (2026-05-12): with grouping by plan name + search,
// many historical snapshots remain useful — older entries stay accessible
// inside their group's "older versions" disclosure.
const MAX_HISTORY = 50
const STORAGE_KEY = 'sem-spec-history-v1'

// ── localStorage helpers ──────────────────────────────────────────────────────

function _loadFromStorage(): SpecVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as SpecVersion[]
  } catch {
    return []
  }
}

/**
 * r41 v108 (Tom Gilb 2026-06-17 verbatim "This plan UK Navy does not save to
 * history, and has not all day") — the previous `catch {}` swallowed EVERY
 * localStorage failure silently.  After a day of generating spec snapshots
 * (each carrying a deep-cloned SpecBlock + EvoStepPlan; for a large plan
 * hundreds of KB), the ~5-10 MB localStorage quota is hit and every save
 * silently fails.  The in-memory `history.value` ref still gets the new
 * entries, but they disappear on page reload — and the user has no idea
 * because the catch was empty.
 *
 * Fix (three layers):
 *  1. LOG every write failure to the console so the user can see in DevTools
 *     when the silent drop happened.
 *  2. RETRY automatically with a shrinking payload: drop the oldest entry,
 *     try again, repeat until either the write succeeds or only one entry
 *     remains.  Tom keeps the most recent N versions instead of losing
 *     EVERYTHING when quota is hit.
 *  3. RETURN a boolean so callers can know whether the save persisted.
 *
 * Composes with: No-Silent-Data-Loss SUPREME (silent quota failure = silent
 * data loss), No-Dodging-Ambiguous-Bugs SUPREME (the empty catch was the
 * dodge), Trace-Before-Patch SUPREME (the failure mode was invisible until
 * tracing the call chain to this empty catch).
 */
function _saveToStorage(versions: SpecVersion[]): boolean {
  // First attempt: full payload.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions))
    return true
  } catch (err) {
    console.warn('[useSpecHistory] localStorage write failed on full payload — auto-trimming oldest entries', err)
  }
  // Quota-trim retry loop: drop the oldest entry, retry, repeat.
  // Keeps shrinking until either the write succeeds OR only 1 entry remains.
  let trimmed = [...versions]
  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, trimmed.length - 1)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      console.warn(`[useSpecHistory] Persisted after trimming to ${trimmed.length} versions (dropped ${versions.length - trimmed.length} oldest)`)
      // Mutate the caller's reference so the in-memory ref matches storage.
      versions.length = trimmed.length
      for (let i = 0; i < trimmed.length; i++) versions[i] = trimmed[i]
      return true
    } catch {
      /* try smaller */
    }
  }
  // Even one entry doesn't fit — localStorage is broken or quota is zero.
  console.error('[useSpecHistory] localStorage write FAILED even at 1 entry — history will not persist this session.')
  return false
}

// ── Singleton state — initialised from localStorage on first import ────────────

/** Shared singleton state — all callers share the same history list. */
const history = ref<SpecVersion[]>(_loadFromStorage())

/**
 * r41 v108 (Tom Gilb 2026-06-17) — hardened against partial / corrupt SpecBlock
 * input.  Previously the bare `spec.functions.length` access would throw a
 * TypeError when ANY of the F/V/S arrays was undefined, propagating out of
 * addVersion + silently failing the save.  Now defaults every array length
 * to 0 and falls back to a generic summary if the spec shape is unexpected.
 */
function buildSummary(spec: SpecBlock): string {
  try {
    const fCount = spec.functions?.length ?? 0
    const vCount = spec.values?.length    ?? 0
    const sCount = spec.solutions?.length ?? 0
    const counts = `${fCount} Function${fCount === 1 ? '' : 's'} · ${vCount} Value${vCount === 1 ? '' : 's'} · ${sCount} Solution${sCount === 1 ? '' : 's'}`
    // Use the first Function description as the topic — it says "what the system does",
    // which is more identifying than a Value description.
    const topic = spec.functions?.[0]?.description ?? spec.values?.[0]?.description ?? ''
    const short = topic.length > 42 ? topic.slice(0, 39) + '…' : topic
    return short ? `${counts} — ${short}` : counts
  } catch (err) {
    console.warn('[useSpecHistory] buildSummary failed; using fallback', err)
    return 'spec snapshot'
  }
}

export function useSpecHistory() {
  /**
   * Save a new version snapshot.
   * @param spec        — the SpecBlock to snapshot (deep-cloned)
   * @param label       — human label for the version
   * @param plan        — the active EvoStepPlan at this moment (null if not yet generated)
   * @param specName    — the active spec model name (empty string if no spec model)
   * @param specOwners  — owner names from the active spec model (empty array if none).
   *                      Stored on the snapshot so the History search can match
   *                      "owner / planner" keywords against the original team for
   *                      historical entries — even after the spec model has changed.
   */
  function addVersion(
    spec: SpecBlock,
    label: string,
    plan: EvoStepPlan | null = null,
    specName: string = '',
    specOwners: string[] = [],
    /** v514 — optional Resources envelope captured at save time.  App.vue
     *  passes this via useResourcesEnvelope().captureEnvelope() so the
     *  resource-subsystem state travels with the SpecVersion. */
    resourcesEnvelope: unknown = null,
  ): void {
    // r41 v460 (Tom Gilb 2026-07-02 pre-demo item 2) — refuse to add
    // an EMPTY snapshot to history.  Root-cause of the multiplying
    // "Indianapolis Contract · Restored" placeholders Tom's diagnostic
    // dump surfaced: when an empty snapshot is Restored, App.vue
    // dutifully calls addVersion with the empty spec, adding ANOTHER
    // empty Restored version — and Restore of THAT adds another.  The
    // chain multiplies zero-entry noise.  Guard: check every collection
    // in the spec; if ALL are empty, refuse the save + log a warning.
    // Composes with No-Silent-Data-Loss SUPREME (we don't silently
    // drop content; we prevent ZERO-content noise from crowding the
    // picker) + Term + Definition + Source SUPREME (an empty snapshot
    // has no Source of content to preserve).
    const specHasContent = (
      (Array.isArray(spec?.functions)    ? spec.functions.length    : 0) +
      (Array.isArray(spec?.values)       ? spec.values.length       : 0) +
      (Array.isArray(spec?.stakeholders) ? spec.stakeholders.length : 0) +
      (Array.isArray(spec?.constraints)  ? spec.constraints.length  : 0) +
      (Array.isArray(spec?.resources)    ? spec.resources.length    : 0)
    ) > 0
    if (!specHasContent) {
      console.warn(
        '[useSpecHistory] addVersion REFUSED: attempted to save an empty spec snapshot.  Would create a zero-content history version.  Ignored.',
        { label, specName, specOwnersCount: specOwners.length },
      )
      return
    }
    // r41 v108 (Tom Gilb 2026-06-17) — wrap the whole body so any unexpected
    // throw (JSON serialization failure on a circular reference, deep-clone
    // failure on a non-cloneable structure, etc.) is LOGGED instead of
    // propagating out and silently killing the caller's success-path code.
    // Composes with No-Silent-Data-Loss SUPREME — the spec data itself is
    // already in currentSpec.value; the history save is best-effort but we
    // need to KNOW when it fails, not have it bubble out invisibly.
    try {
      const version: SpecVersion = {
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Date.now().toString(),
        spec: JSON.parse(JSON.stringify(spec)),
        plan: plan ? JSON.parse(JSON.stringify(plan)) : null,
        // v514 — envelope carried as opaque JSON-safe clone so it survives
        // localStorage round-trip regardless of source composable shape.
        resourcesEnvelope: resourcesEnvelope ? JSON.parse(JSON.stringify(resourcesEnvelope)) : null,
        timestamp: Date.now(),
        label,
        summary: buildSummary(spec),
        specName,
        specOwners: [...specOwners],
      }
      history.value = [version, ...history.value].slice(0, MAX_HISTORY)
      const persisted = _saveToStorage(history.value)
      if (!persisted) {
        console.warn('[useSpecHistory] addVersion: in-memory ref updated but localStorage write failed', { label, specName })
      } else {
        console.info('[useSpecHistory] addVersion success', { label, specName, total: history.value.length })
      }
    } catch (err) {
      console.error('[useSpecHistory] addVersion FAILED', { label, specName, err })
    }
  }

  /** Returns a deep clone of the stored SpecBlock, EvoStepPlan (both may be
   *  null), and — v514 — the Resources envelope (null when the version was
   *  saved before v514 or when the caller passed no envelope). */
  function restoreVersion(id: string): { spec: SpecBlock; plan: EvoStepPlan | null; resourcesEnvelope: unknown } | null {
    const found = history.value.find((v) => v.id === id)
    if (!found) return null
    return {
      spec: JSON.parse(JSON.stringify(found.spec)),
      plan: found.plan ? JSON.parse(JSON.stringify(found.plan)) : null,
      resourcesEnvelope: found.resourcesEnvelope ? JSON.parse(JSON.stringify(found.resourcesEnvelope)) : null,
    }
  }

  /**
   * Retroactively fills the plan into the most recent history entry.
   * Called by useEvoPlan.fetchPlan() the moment a plan is successfully generated,
   * so the history entry always reflects the actual final plan for that spec —
   * not whatever happened to be in _evoPlan.value at addVersion() call time.
   */
  function updateLatestPlan(plan: EvoStepPlan | null): void {
    if (history.value.length === 0) return
    history.value[0] = {
      ...history.value[0],
      plan: plan ? JSON.parse(JSON.stringify(plan)) : null,
    }
    _saveToStorage(history.value)
  }

  function clearHistory(): void {
    history.value = []
    _saveToStorage([])
  }

  // ── Recovery — reinstate lost plans from localStorage backups ─────────────
  //
  // Tom 2026-05-14: "history: can you reinstate any old files, none there now."
  // When the History panel is empty (e.g. after a browser-state reset, a
  // sem-spec-history-v1 wipe, or a sem-plan-models survivor that never got
  // mirrored into history), this scans every localStorage key that could
  // possibly hold a plan or a history backup and reconstitutes SpecVersion
  // entries from anything orphaned.
  //
  // Sources scanned:
  //   • sem-plan-models                          — distinct named plans
  //   • sem-plan-models__backup-*                — explicit safety backups
  //   • sem-spec-history-v1__backup-*            — previous history backups
  //                                                (from the 2026-05-13 snippet
  //                                                or any future safety dump)
  //
  // De-dup key: `${planName}|${firstFunctionDesc}|${firstValueDesc}|${tsBucket}`
  // where tsBucket = floor(timestamp / 60s) so two snapshots within 60 s of
  // each other dedupe (same generation event, not lost data).
  //
  // Writes a fresh sem-spec-history-v1__backup-{stamp} before mutating so the
  // operation is reversible if anything goes wrong.

  interface RecoveryReport {
    /** Number of localStorage keys inspected. */
    scanned: number
    /** Number of new SpecVersion entries added to history. */
    recovered: number
    /** Storage-key names where recovered entries came from. */
    sources: string[]
    /** Key name of the safety backup written before mutation (null if nothing changed). */
    backupKey: string | null
  }

  function _safeParse<T>(raw: string | null): T | null {
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  }

  function _versionFromPlanModel(p: {
    name?: string
    owners?: { name?: string }[]
    updatedAt?: string
    createdAt?: string
    spec?: SpecBlock
  }, fallbackLabel: string = 'Recovered'): SpecVersion | null {
    if (!p?.spec) return null
    const ts = new Date(p.updatedAt || p.createdAt || Date.now()).getTime()
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${ts}-${Math.random().toString(36).slice(2, 8)}`
    return {
      id,
      spec: JSON.parse(JSON.stringify(p.spec)),
      plan: null,
      timestamp: ts,
      label: fallbackLabel,
      summary: buildSummary(p.spec),
      specName: p.name ?? '',
      specOwners: (p.owners ?? []).map(o => o?.name ?? '').filter(Boolean),
    }
  }

  function _dedupKey(v: SpecVersion): string {
    const fn  = v.spec?.functions?.[0]?.description ?? ''
    const val = v.spec?.values?.[0]?.description ?? ''
    const ts  = Math.floor((v.timestamp ?? 0) / 60_000)
    // Support both old (planName) and new (specName) field names
    return `${(v.specName ?? v.planName ?? '').trim()}|${fn}|${val}|${ts}`
  }

  /**
   * Scan every localStorage key that could hold a plan or history backup and
   * reinstate any orphaned plans as SpecVersion entries in `history`.
   *
   * Idempotent — running it twice in a row will report 0 recovered the second
   * time (everything dedupes). Reactive — updates `history.value` in place so
   * the UI re-renders immediately, no reload needed.
   */
  function recoverFromStorage(): RecoveryReport {
    if (typeof localStorage === 'undefined') {
      return { scanned: 0, recovered: 0, sources: [], backupKey: null }
    }

    // Seed dedup set with what's already in history.
    const seen = new Set<string>(history.value.map(_dedupKey))
    const recovered: SpecVersion[] = []
    const sources: string[] = []
    let scanned = 0

    // 1. Live plan-models layer.
    const livePlans = _safeParse<unknown[]>(localStorage.getItem('sem-plan-models'))
    if (Array.isArray(livePlans) && livePlans.length > 0) {
      scanned += 1
      let added = 0
      for (const p of livePlans) {
        const v = _versionFromPlanModel(p as Parameters<typeof _versionFromPlanModel>[0])
        if (!v) continue
        const k = _dedupKey(v)
        if (seen.has(k)) continue
        seen.add(k)
        recovered.push(v)
        added += 1
      }
      if (added > 0) sources.push(`sem-plan-models (${added})`)
    }

    // 2. Every localStorage key that LOOKS like a backup snapshot.
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue

      // Backup of plan-models — same shape as the live key.
      if (key.startsWith('sem-plan-models__backup-')) {
        scanned += 1
        const arr = _safeParse<unknown[]>(localStorage.getItem(key))
        if (!Array.isArray(arr)) continue
        let added = 0
        for (const p of arr) {
          const v = _versionFromPlanModel(p as Parameters<typeof _versionFromPlanModel>[0])
          if (!v) continue
          const k = _dedupKey(v)
          if (seen.has(k)) continue
          seen.add(k)
          recovered.push(v)
          added += 1
        }
        if (added > 0) sources.push(`${key} (${added})`)
        continue
      }

      // Backup of history itself — already in SpecVersion shape.
      if (key.startsWith('sem-spec-history-v1__backup-')) {
        scanned += 1
        const arr = _safeParse<SpecVersion[]>(localStorage.getItem(key))
        if (!Array.isArray(arr)) continue
        let added = 0
        for (const v of arr) {
          if (!v?.spec) continue
          const k = _dedupKey(v)
          if (seen.has(k)) continue
          seen.add(k)
          // Force a fresh id so the recovered row is a new entry, not a
          // shadow of an id that might collide with something else.
          const fresh: SpecVersion = {
            ...v,
            id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${v.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            label: v.label?.includes('Recovered') ? v.label : `${v.label || 'Generated'} · Recovered`,
          }
          recovered.push(fresh)
          added += 1
        }
        if (added > 0) sources.push(`${key} (${added})`)
        continue
      }
    }

    if (recovered.length === 0) {
      return { scanned, recovered: 0, sources, backupKey: null }
    }

    // Safety backup of the current history before we mutate.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupKey = `${STORAGE_KEY}__backup-${stamp}`
    try {
      localStorage.setItem(backupKey, JSON.stringify(history.value))
    } catch {
      // Storage full — proceed without the backup rather than refusing to recover.
    }

    // Merge newest-first, cap at MAX_HISTORY.
    const merged = [...recovered, ...history.value]
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, MAX_HISTORY)
    history.value = merged
    _saveToStorage(history.value)

    return { scanned, recovered: recovered.length, sources, backupKey }
  }

  return { history, addVersion, restoreVersion, updateLatestPlan, clearHistory, recoverFromStorage }
}
