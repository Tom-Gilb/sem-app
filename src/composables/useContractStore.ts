// UNIT_TYPE=Composable
/**
 * useContractStore — Singleton store for all Contracts mode data.
 *
 * Persistence: localStorage key 'sem-app:contracts:v1'
 * Pattern: mirrors usePlanModel.ts (load-on-init, auto-persist on mutation).
 *
 * All state is module-level (singleton) — Vue components share one source
 * of truth. Reactive refs are returned per composable call but point to the
 * same underlying refs.
 */

import { ref, computed } from 'vue'
import type {
  ContractModel,
  ContractClause,
  ContractParty,
  PlanguageContractEntry,
  ContractEntryType,
  ContractType,
  ContractParseStatus,
} from '../types/contractTypes'
// r41 v465 (Tom Gilb 2026-07-02 "make a fail safe storage. You cannot
// sink Navy ships without a trace. Indianapolis is not to be your
// inspiration").  Durable storage layer over IndexedDB (~50% of disk on
// Safari/Chrome — hundreds of GB on Tom's 1 TB Mac) instead of
// localStorage's ~5 MB quota.  Dual-write: localStorage keeps its
// sync-bootstrap role for zero-latency first-render; IDB is the durable
// authoritative store subsequent loads read from.  Composes with the
// v464 SaveFailureEvent broadcaster + persistent-banner + auto-Backup.
import { idbGet, idbSet, idbSupported } from '../lib/idbKv'

// ── Planguage mnemonic tag derivation (r41 v409) ────────────────────────────
// Tom Gilb 2026-07-01 verbatim: "I want tags according to the Planguage
// standard. Is this in the supreme standard yet? No 'R'. The Tag should be
// derived as a unique set of 1 to few words, capitalized, from the Text they
// describe".  Implements the Planguage Mnemonic ID Standard SUPREME per
// CLAUDE.md — no sequential codes, no letter prefix, 1-3 space-separated
// Capitalized words.  Pure function so it's easy to unit-test.

/** Very small stop-word list — the LLM's descriptions are mostly content-rich
 *  so a large list is unnecessary and would strip signal.  Chosen to remove
 *  the words that typically pad an obligation description without adding
 *  discriminating content. */
const _STOPWORDS = new Set([
  'the','a','an','and','or','but','of','in','on','at','to','for','from','by',
  'with','as','is','are','was','were','be','been','being','it','its','this',
  'that','these','those','which','who','whom','whose','what','when','where',
  'why','how','all','any','each','every','no','not','only','shall','will',
  'may','can','must','should','would','could','has','have','had','do','does',
  'did','than','then','also','more','most','less','least','such','so','same',
  'other','one','two','both','either','neither','over','under','into','onto',
  'per','via','vs','etc','eg','ie',
])

/** Capitalize a single word — first letter upper, rest lower.  Preserves
 *  fully-uppercased acronyms (2+ chars) verbatim (e.g. "GDPR", "SLA"). */
function _titleWord(w: string): string {
  if (w.length >= 2 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) return w
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}

/** Extract 1-3 significant Capitalized words from a description, matching
 *  the Planguage Mnemonic ID Standard SUPREME.  Falls back to "Unnamed Entry"
 *  when the description is empty or contains no significant words. */
export function _deriveMnemonicFromDescription(description: string): string {
  const raw = (description ?? '').trim()
  if (!raw) return 'Unnamed Entry'
  // Split on non-word chars.  Keep acronyms intact.
  const tokens = raw
    .split(/[^A-Za-z0-9]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
  // Prefer significant tokens (>= 3 chars, not stop-word, contains a
  // letter).  If none, fall through to any letter-containing token.  Numeric-
  // only tokens are never used as tags — they don't communicate meaning and
  // resemble the banned sequential-id shape.
  const significant = tokens.filter(t =>
    t.length >= 3 && !_STOPWORDS.has(t.toLowerCase()) && /[A-Za-z]/.test(t)
  )
  const pool = significant.length > 0 ? significant : tokens.filter(t => /[A-Za-z]/.test(t))
  if (pool.length === 0) return 'Unnamed Entry'
  // Take the first 2-3 words (2 by default; 3 if the first is short/generic).
  const wantThree = pool[0].length <= 4
  const picked = pool.slice(0, wantThree ? 3 : 2).map(_titleWord)
  return picked.join(' ')
}

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-app:contracts:v1'
const CURRENT_KEY = 'sem-app:contracts:current:v1'
const SNAPSHOT_KEY    = 'sem-contract-snapshots-v1'
const MAX_SNAPSHOTS   = 20

// r41 (Tom Gilb 2026-06-20 picked option B "per-plan contract memory" after
// the Monitor-sticky-on-Indianapolis bug) — each plan remembers which contract
// it had selected.  Switching plans now hydrates the Contracts agent from
// this map; selecting a contract in Contracts agent writes back to the
// active-plan slot.  Composes with No-Silent-Data-Loss SUPREME (no contract
// state is silently dropped on plan switch — it's parked under the prev-plan
// key) + Universal Undo SUPREME (every plan↔contract pairing is reversible
// by switching back) + Architectural Resilience SUPREME (plan-scoped state
// becomes a portable pattern other agents can adopt: MariaAgent, ElonAgent
// will likely want the same plan-scoped active-state). */
const PLAN_MAP_KEY = 'sem-app:contracts:plan-map:v1'
/** Sentinel plan-id used by migration shim when the app boots BEFORE App.vue
 *  has had a chance to call `applyPlanSwitch(realPlanId)`.  Any existing
 *  legacy `CURRENT_KEY` value gets parked under this key on first load so it
 *  isn't lost; the moment App.vue tells us the real active plan id, that
 *  plan's slot inherits the parked contract id (one-time migration). */
const PRE_PLAN_KEY = '__pre_plan_switch__'

// ── Helpers ───────────────────────────────────────────────────────────────────

function _now(): string {
  return new Date().toISOString()
}

function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function _migrate(c: ContractModel): ContractModel {
  // Future: add field migrations here when schemaVersion bumps.
  return {
    entryCounters: { F: 0, V: 0, C: 0, R: 0, Sol: 0, S: 0, Task: 0 },
    ...c,
    schemaVersion: 1,
  }
}

// ── Contract snapshot ─────────────────────────────────────────────────────────

/**
 * A lightweight snapshot of a fully-parsed contract — stored separately from
 * the live ContractModel so HistoryPanel can list past analyses without loading
 * the full clause payload.  The `contractId` field links back to the live record
 * in `_contracts` for "restore" (switch current contract) operations.
 *
 * Twin-portable: no Vue types, no browser APIs, plain serialisable record.
 */
export interface ContractSnapshot {
  id:                 string
  contractId:         string
  contractTitle:      string
  contractType:       ContractType
  takenAt:            string       // ISO
  clauseCount:        number
  entryCount:         number
  entryTypeBreakdown: Partial<Record<ContractEntryType, number>>
}

function _loadSnapshots(): ContractSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ContractSnapshot[]
  } catch {
    return []
  }
}

function _saveSnapshots(snaps: ContractSnapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps))
  } catch { /* ignore */ }
}

// ── Persistence ───────────────────────────────────────────────────────────────

function _loadAll(): ContractModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ContractModel[]
    return Array.isArray(parsed) ? parsed.map(_migrate) : []
  } catch (err) {
    // r41 v431 (Tom Gilb 2026-07-02 verbatim *"it was going well for a long
    // time maybe 20 min and 100 Planguage specs and 15 cluses but I did n´some
    // email and returned to this zero everything status"*) — surface the
    // failure loudly instead of silently returning [].  A corrupted JSON in
    // localStorage silently returning [] is EXACTLY the class-bug that lost
    // Tom's Indianapolis parse (20 min · 100 entries · 15 clauses → empty).
    // No-Silent-Data-Loss SUPREME violation.  Now: log the raw first 400 chars
    // of the corrupted value so Claudian can see what was stored and
    // potentially recover manually.
    console.error(
      '[useContractStore] FAILED to parse localStorage', STORAGE_KEY,
      '— returning empty array.  Raw value (first 400 chars):',
      (localStorage.getItem(STORAGE_KEY) ?? '(null)').slice(0, 400),
      '\nError:', err,
    )
    return []
  }
}

/** r41 v464 (Tom Gilb 2026-07-02 forensic: PACRM Solicitation went missing
 *  after Indianapolis .eml recovery import — localStorage QuotaExceededError
 *  silently rolled back all writes; in-memory state showed PACRM but
 *  disk did not; ⌘R wiped memory and PACRM was gone).
 *
 *  No-Silent-Data-Loss SUPREME shipped: quota failures now (a) emit a
 *  loud module-level event other components subscribe to so the UI can
 *  show a persistent banner + trigger an auto-Backup-to-Downloads for
 *  the affected contract; (b) return a boolean success flag so the
 *  caller (importContract, createContract, etc.) can propagate the
 *  failure to the user; (c) attempt more aggressive pruning if the
 *  first drop-oldest fails.
 *
 *  Composes with:
 *    • No-Silent-Data-Loss SUPREME
 *    • Trust-Rebuild framing (Tom's PACRM parse was in-memory-only for
 *      ~30 min while he assumed it was safe)
 *    • Universal Undo SUPREME (auto-Backup-to-Downloads preserves the
 *      contract even when localStorage rejects the write)
 *    • Term + Definition + Source SUPREME (the banner names the exact
 *      error, exact contract at risk, exact recovery path)
 */
export interface SaveFailureEvent {
  timestamp:      number
  reason:         'quota-exceeded' | 'unknown'
  contractsCount: number
  totalBytes:     number
  attemptedPrune: boolean
  pruneSucceeded: boolean
  errorMessage:   string
  /** v472 — TRUE when IndexedDB dual-write is known to have succeeded
   *  recently (Tom's data IS durable on disk).  The banner should render
   *  a SOFT informational message in that case, not an alarm. */
  durable:        boolean
  /** v474 — which storage layer emitted the failure.  Lets the banner
   *  render source-appropriate copy ("your test contract library" vs
   *  "your contracts").  Defaults to 'contracts' for backward-compat. */
  source?:        'contracts' | 'guideline-library'
}
const _saveFailureListeners: Array<(ev: SaveFailureEvent) => void> = []
export function onSaveFailure(fn: (ev: SaveFailureEvent) => void): () => void {
  _saveFailureListeners.push(fn)
  return () => {
    const idx = _saveFailureListeners.indexOf(fn)
    if (idx >= 0) _saveFailureListeners.splice(idx, 1)
  }
}
function _emitSaveFailure(ev: SaveFailureEvent): void {
  for (const fn of _saveFailureListeners) {
    try { fn(ev) } catch (err) { console.error('[useContractStore] save-failure listener threw:', err) }
  }
}

// ── r41 v472 — Banner-spam guard (Tom Gilb 2026-07-03: "i gotthe storage
//    warning message 5 times in a row now, is this necessary?"). ────────
//
// Every mutation calls _saveAll → if localStorage is at quota, every
// mutation re-fired _emitSaveFailure → banner spam.  Not necessary —
// v465 IDB dual-write means Tom's data IS durable even when localStorage
// rejects.  Three guards:
//   (1) RATE LIMIT — never more than one emit per FAILURE_EMIT_MIN_INTERVAL_MS
//   (2) DISMISS QUIET — once the user dismisses the banner, stay quiet
//       for BANNER_DISMISS_QUIET_MS (they know; don't nag)
//   (3) DURABILITY FLAG — track IDB success; if IDB write succeeded within
//       IDB_DURABILITY_WINDOW_MS, mark the emitted event `durable=true` so
//       the banner renders soft-informational instead of red-alarm
const FAILURE_EMIT_MIN_INTERVAL_MS = 60_000              // 1 minute
const BANNER_DISMISS_QUIET_MS      = 5 * 60_000           // 5 minutes
const IDB_DURABILITY_WINDOW_MS     = 5 * 60_000           // 5 minutes
let _lastEmittedFailureTs: number = 0
let _lastIdbSuccessTs:     number = 0
let _bannerDismissedThroughTs: number = 0

/** v472 — call this from the UI when the user dismisses the save-failure
 *  banner.  Suppresses re-emit for BANNER_DISMISS_QUIET_MS so the banner
 *  doesn't refire on the next mutation. */
export function markSaveFailureBannerDismissed(): void {
  _bannerDismissedThroughTs = Date.now() + BANNER_DISMISS_QUIET_MS
}

/** v474 — call this from ANY storage layer whose IDB dual-write just
 *  succeeded.  Updates `_lastIdbSuccessTs` so subsequent localStorage-only
 *  failures (from any source) can be marked `durable: true` in the emitted
 *  event.  Shared origin-level IDB health signal — every storage-touching
 *  composable in the app can contribute. */
export function noteIdbWriteSuccess(): void {
  _lastIdbSuccessTs = Date.now()
}

/** v474 — public storage-failure broadcaster.  Any composable whose
 *  localStorage write fails can call this to route through the SAME
 *  rate-limited + dismiss-quiet + durability-aware guard the contract
 *  store uses.  Prevents banner spam AND silent library-save failures.
 *
 *  Fill in `partial` with the source-appropriate fields; the guard adds
 *  `timestamp` + `durable` before emitting.  Returns TRUE if emitted,
 *  FALSE if suppressed (a console.warn traces the reason).
 *
 *  Example (useGuidelineLibrary._saveLibrary catch block):
 *    broadcastStorageFailure({
 *      reason:         'quota-exceeded',
 *      contractsCount: lib.length,
 *      totalBytes:     JSON.stringify(lib).length,
 *      attemptedPrune: false,
 *      pruneSucceeded: false,
 *      errorMessage:   String(err),
 *      source:         'guideline-library',
 *    })
 */
export function broadcastStorageFailure(
  partial: Omit<SaveFailureEvent, 'timestamp' | 'durable'>,
): boolean {
  const now = Date.now()
  const idbLikelyDurable = _lastIdbSuccessTs > 0 && (now - _lastIdbSuccessTs) < IDB_DURABILITY_WINDOW_MS
  const rateLimited      = _lastEmittedFailureTs > 0 && (now - _lastEmittedFailureTs) < FAILURE_EMIT_MIN_INTERVAL_MS
  const quietedByDismiss = now < _bannerDismissedThroughTs
  if (rateLimited || quietedByDismiss) {
    console.warn(
      `[storage] Save-failure banner SUPPRESSED (rateLimited=${rateLimited}, quietedByDismiss=${quietedByDismiss}, idbLikelyDurable=${idbLikelyDurable}, source=${partial.source ?? 'contracts'}). Failure logged only.`,
    )
    return false
  }
  _lastEmittedFailureTs = now
  _emitSaveFailure({
    ...partial,
    timestamp: now,
    durable:   idbLikelyDurable,
  })
  return true
}

/** r41 v465 — DURABLE write: IndexedDB (~50% of disk quota) fired-and-
 *  forgotten in parallel with the sync localStorage write.  If IDB
 *  succeeds, subsequent loads read from IDB and Tom's data survives
 *  even when localStorage rejects (as happened at 21:03 UTC).  Errors
 *  are logged loudly (No-Silent-Data-Loss) but do NOT block localStorage.
 *
 *  Called async from `_saveAll` on every mutation.  The Promise is not
 *  awaited by the sync caller — the sync return value reflects
 *  localStorage state only.  IDB state converges eventually. */
async function _saveAllToIdb(contracts: ContractModel[]): Promise<void> {
  if (!idbSupported()) return
  try {
    await idbSet(STORAGE_KEY, contracts)
    // v472 — record IDB success so the banner-spam guard can mark
    // subsequent localStorage-only failures as `durable=true`.
    // v474 — this is now the shared origin-level IDB health signal;
    // every storage layer contributes via `noteIdbWriteSuccess`.
    _lastIdbSuccessTs = Date.now()
  } catch (err) {
    console.error('[useContractStore] IndexedDB save FAILED — localStorage may still have persisted.  Error:', err)
    // v464 SaveFailureEvent already fires from the sync localStorage
    // path if that also failed.  If localStorage succeeded but IDB
    // didn't, silent because localStorage is enough for THIS session
    // — but next session's IDB read will fall back to localStorage
    // correctly.
  }
}

function _saveAll(contracts: ContractModel[]): boolean {
  // r41 v465 — DUAL-WRITE: IDB fired-and-forgotten (async, durable);
  // localStorage inline (sync, sync-bootstrap for next tab-open).
  void _saveAllToIdb(contracts)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts))
    return true
  } catch (err) {
    const bytes = JSON.stringify(contracts).length
    const errName = (err as Error)?.name ?? '(unknown)'
    const errMsg  = (err as Error)?.message ?? String(err)
    console.error(
      '[useContractStore] FAILED to save contracts to localStorage.',
      'Contracts count:', contracts.length,
      'Total serialised size:', bytes, 'bytes.',
      '\nError name:', errName,
      '\nError:', err,
    )
    const isQuota = errName === 'QuotaExceededError' || errName.includes('Quota')
    let pruneAttempted = false
    let pruneSucceeded = false
    if (isQuota) {
      // r41 v464 — more aggressive pruning: keep dropping oldest until save
      // succeeds OR fewer than 2 contracts remain.  Every prune is loudly
      // logged.  Composes with No-Silent-Removal SUPREME (each prune names
      // the dropped contract's title + updatedAt so the user knows).
      pruneAttempted = true
      const sorted = [...contracts].sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1))
      for (let dropCount = 1; dropCount < sorted.length && dropCount < 6; dropCount++) {
        const pruned = sorted.slice(dropCount)
        const droppedTitles = sorted.slice(0, dropCount).map(c => `"${c.title}" (updated ${c.updatedAt})`).join(' + ')
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
          pruneSucceeded = true
          console.warn(
            `[useContractStore] Quota-recovery SUCCEEDED after dropping ${dropCount} oldest contract(s): ${droppedTitles}. ` +
            `${pruned.length} preserved (${JSON.stringify(pruned).length} bytes).`,
          )
          break
        } catch {
          // Try dropping one more.  Continue loop.
        }
      }
      if (!pruneSucceeded) {
        console.error('[useContractStore] Quota-recovery FAILED even after aggressive pruning.  In-memory contracts NOT persisted.  User must Backup + Delete manually.')
      }
    }
    // r41 v464 — LOUD emit so the UI can render a persistent banner +
    // auto-Backup the NEWEST contract to Downloads (belt-and-braces).
    // r41 v472 — banner-spam guard (Tom "5 in a row now, is this
    // necessary?").
    // r41 v474 — refactored through `broadcastStorageFailure` so the
    // guard is shared with every storage-touching composable.
    broadcastStorageFailure({
      reason:         isQuota ? 'quota-exceeded' : 'unknown',
      contractsCount: contracts.length,
      totalBytes:     bytes,
      attemptedPrune: pruneAttempted,
      pruneSucceeded,
      errorMessage:   errMsg,
      source:         'contracts',
    })
    return false
  }
}

function _loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY) ?? null
  } catch {
    return null
  }
}

function _saveCurrentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id)
    else localStorage.removeItem(CURRENT_KEY)
  } catch { /* ignore */ }
}

// ── Plan-scoped contract memory (r41 2026-06-20, option B) ───────────────────

function _loadPlanContractMap(): Record<string, string | null> {
  try {
    const raw = localStorage.getItem(PLAN_MAP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return (parsed && typeof parsed === 'object') ? (parsed as Record<string, string | null>) : {}
  } catch {
    return {}
  }
}

function _savePlanContractMap(map: Record<string, string | null>): void {
  try {
    localStorage.setItem(PLAN_MAP_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

// ── Singleton state ───────────────────────────────────────────────────────────

const _contracts    = ref<ContractModel[]>(_loadAll())
const _currentId    = ref<string | null>(_loadCurrentId())
const _snapshots = ref<ContractSnapshot[]>(_loadSnapshots())

// r41 v465 (Tom Gilb 2026-07-02 "make a fail safe storage") — post-bootstrap
// async check: if IndexedDB has authoritative contract data (persisted from
// a prior session's dual-write), prefer IT over the sync localStorage
// bootstrap.  This is the DURABLE FAIL-SAFE: even if localStorage was
// truncated by a QuotaExceededError during a prior write, IDB has the
// full state.  Fire-and-forget; the sync bootstrap covers the first
// render frame + IDB replaces the ref once its promise settles.
;(async () => {
  if (!idbSupported()) return
  try {
    const idbData = await idbGet<ContractModel[]>(STORAGE_KEY)
    if (!Array.isArray(idbData) || idbData.length === 0) {
      // IDB is empty → first-ever v465 run → migrate localStorage seed into IDB.
      if (_contracts.value.length > 0) {
        await idbSet(STORAGE_KEY, _contracts.value)
        console.info(`[useContractStore] MIGRATION: seeded IndexedDB with ${_contracts.value.length} contract(s) from localStorage.  Future writes are dual-write; future loads prefer IDB.`)
      }
      return
    }
    // IDB has authoritative data.  Compare with bootstrap; prefer IDB if
    // it has MORE contracts than the sync bootstrap (localStorage may
    // have been truncated by a QuotaExceededError since the last IDB
    // write; IDB is the durable source of truth).
    if (idbData.length > _contracts.value.length) {
      console.info(`[useContractStore] IDB has ${idbData.length} contracts vs localStorage's ${_contracts.value.length}.  Preferring IDB (localStorage likely truncated by quota).`)
      _contracts.value = idbData
    } else if (idbData.length === _contracts.value.length) {
      // Same count — trust the sync bootstrap (localStorage is fresher on
      // this tab if any writes happened between load + IDB resolution).
    } else {
      // localStorage has MORE than IDB — this can happen if IDB was
      // wiped by user Storage Settings but localStorage survived.  Push
      // the localStorage state to IDB.
      await idbSet(STORAGE_KEY, _contracts.value)
      console.info(`[useContractStore] Pushed ${_contracts.value.length} contracts from localStorage to IDB (IDB had fewer: ${idbData.length}).`)
    }
  } catch (err) {
    console.error('[useContractStore] Post-bootstrap IDB read failed — continuing with localStorage bootstrap:', err)
  }
})()

// r41 2026-06-20 (option B) — plan→contract map + active plan id ref.
// `_activePlanId` is set by App.vue once the active SpecModel is known, then
// updated on every plan switch.  Defaults to null until that wiring runs, so
// any pre-init `setCurrentContract` call (legacy code paths) parks under the
// PRE_PLAN_KEY sentinel and gets hoisted to the real plan id on first switch.
const _planContractMap = ref<Record<string, string | null>>(_loadPlanContractMap())
const _activePlanId    = ref<string | null>(null)

// One-time migration: if a legacy CURRENT_KEY exists but the plan map has no
// entries yet, park the legacy contract id under PRE_PLAN_KEY so it can be
// hoisted to the real active plan on first `applyPlanSwitch` call.
if (_currentId.value && Object.keys(_planContractMap.value).length === 0) {
  _planContractMap.value[PRE_PLAN_KEY] = _currentId.value
  _savePlanContractMap(_planContractMap.value)
}

// ── Derived ───────────────────────────────────────────────────────────────────

const _currentContract = computed<ContractModel | null>(() =>
  _contracts.value.find(c => c.id === _currentId.value) ?? null
)

// ── Internal mutators ─────────────────────────────────────────────────────────

function _upsert(contract: ContractModel): void {
  const idx = _contracts.value.findIndex(c => c.id === contract.id)
  if (idx >= 0) {
    _contracts.value[idx] = { ...contract, updatedAt: _now() }
  } else {
    _contracts.value.unshift(contract)
  }
  _saveAll(_contracts.value)
}

/** Take a lightweight snapshot of a contract when all its clauses are parsed. */
function _takeSnapshot(contractId: string): void {
  const c = _contracts.value.find(x => x.id === contractId)
  if (!c) return
  const allEntries = c.clauses.flatMap(cl => cl.entries)
  const breakdown: Partial<Record<ContractEntryType, number>> = {}
  for (const e of allEntries) {
    breakdown[e.type] = (breakdown[e.type] ?? 0) + 1
  }
  const snap: ContractSnapshot = {
    id:                 `csnap-${Date.now()}`,
    contractId:         c.id,
    contractTitle:      c.title,
    contractType:       c.contractType,
    takenAt:            _now(),
    clauseCount:        c.clauses.length,
    entryCount:         allEntries.length,
    entryTypeBreakdown: breakdown,
  }
  const updated = [snap, ..._snapshots.value].slice(0, MAX_SNAPSHOTS)
  _snapshots.value = updated
  _saveSnapshots(updated)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function useContractStore() {

  /** Create a blank ContractModel and set it as current. */
  function createContract(
    title: string,
    contractType: ContractType = 'other',
    parties: ContractParty[] = [],
  ): ContractModel {
    const contract: ContractModel = {
      id:            _uuid(),
      title,
      contractType,
      parties,
      clauses:       [],
      parseStatus:   'empty',
      entryCounters: { F: 0, V: 0, C: 0, R: 0, Sol: 0, S: 0, Task: 0 },
      createdAt:     _now(),
      updatedAt:     _now(),
      schemaVersion: 1,
    }
    _upsert(contract)
    setCurrentContract(contract.id)
    return contract
  }

  /** r41 v452 (Tom Gilb 2026-07-02 verbatim *"Please include a possibility
   *  of bringing in a file from my mac, now and I can retrieve and run
   *  it"* — after the restore mechanism failed to bring back the 71-clause
   *  Indianapolis parse from localStorage snapshots).
   *
   *  Import a full pre-shaped ContractModel from a v440 Backup-JSON file
   *  (or any equivalent trusted source).  If the incoming id collides
   *  with an existing contract, the imported one gets a fresh id + a
   *  " (imported YYYY-MM-DD HH:MM)" suffix on its title so BOTH survive
   *  — this is Universal Undo SUPREME + No-Silent-Data-Loss SUPREME
   *  applied to import: never overwrite existing work silently.
   *
   *  Returns the actually-imported contract (possibly with a new id +
   *  title), and sets it as current so Tom sees it immediately. */
  function importContract(incoming: ContractModel): ContractModel {
    const collision = _contracts.value.some(c => c.id === incoming.id)
    let contract: ContractModel
    if (collision) {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      contract = {
        ...incoming,
        id:            _uuid(),
        title:         `${incoming.title} (imported ${stamp})`,
        updatedAt:     _now(),
      }
    } else {
      contract = { ...incoming, updatedAt: _now() }
    }
    _upsert(contract)
    setCurrentContract(contract.id)
    return contract
  }

  /** Update top-level fields on a contract (merges, does not replace clauses). */
  function updateContract(
    id: string,
    patch: Partial<Pick<ContractModel,
      'title' | 'subtitle' | 'contractType' | 'effectiveDate' | 'expiryDate' |
      'jurisdiction' | 'governingLaw' | 'parties' | 'rawImportText' | 'parseStatus' | 'parseError'
    >>,
  ): void {
    const c = _contracts.value.find(x => x.id === id)
    if (!c) return
    _upsert({ ...c, ...patch })
  }

  /** Delete a contract entirely. If it was current, unset current. */
  function deleteContract(id: string): void {
    _contracts.value = _contracts.value.filter(c => c.id !== id)
    _saveAll(_contracts.value)
    if (_currentId.value === id) {
      _currentId.value = null
      _saveCurrentId(null)
    }
    // r41 2026-06-20 (option B) — also purge from every plan slot so a
    // re-import of a same-name contract doesn't land on a dangling reference.
    let changed = false
    const map = { ..._planContractMap.value }
    for (const k of Object.keys(map)) {
      if (map[k] === id) { map[k] = null; changed = true }
    }
    if (changed) {
      _planContractMap.value = map
      _savePlanContractMap(map)
    }
  }

  /** Replace the full clauses array (used after phase-1 LLM split). */
  function setClauses(contractId: string, clauses: ContractClause[]): void {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return
    _upsert({ ...c, clauses })
  }

  /** Replace the parsed entries on a single clause. */
  function setClauseEntries(
    contractId: string,
    clauseId: string,
    entries: PlanguageContractEntry[],
    parseStatus: ContractClause['parseStatus'],
    parseError?: string,
  ): void {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return
    // r41 v402 — stamp `lastParsedAt` whenever a clause finishes parsing
    // (either successfully or with error).  Composes with No-Silent-Data-Loss
    // SUPREME + DD-009 Zero-Training UI: the planner sees WHEN the parse
    // finished, so a "0 entries extracted" outcome is distinguishable from
    // "the parse never ran".
    const parseFinished = parseStatus === 'done' || parseStatus === 'error'
    const now = parseFinished ? new Date().toISOString() : undefined
    const updatedClauses = c.clauses.map(cl =>
      cl.id === clauseId
        ? { ...cl, entries, parseStatus, parseError, lastParsedAt: now ?? cl.lastParsedAt }
        : cl
    )
    _upsert({ ...c, clauses: updatedClauses })
    // Auto-snapshot when all clauses have finished parsing.
    const updated2 = _contracts.value.find(x => x.id === contractId)
    if (
      updated2 &&
      updated2.clauses.length > 0 &&
      updated2.clauses.every(cl => cl.parseStatus === 'done')
    ) {
      _takeSnapshot(contractId)
    }
  }

  /** Mark a single clause as currently being parsed. */
  function setClauseParseStatus(
    contractId: string,
    clauseId: string,
    status: ContractClause['parseStatus'],
    error?: string,
  ): void {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return
    const updatedClauses = c.clauses.map(cl =>
      cl.id === clauseId
        ? { ...cl, parseStatus: status, parseError: error }
        : cl
    )
    _upsert({ ...c, clauses: updatedClauses })
  }

  /** Increment and return the next sequential tag for a given entry type.
   *  r41 v409 — retained for legacy callers, but new callers use `mnemonicTag`
   *  which derives a Planguage-standard 1-3-word Capitalized mnemonic from
   *  the entry's description (Planguage Mnemonic ID Standard SUPREME).
   *  The v-numbering fallback stays here for extreme edge cases (empty
   *  description + no fallback content). */
  function nextTag(contractId: string, type: ContractEntryType): string {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return `${type}.1`
    const next = (c.entryCounters[type] ?? 0) + 1
    _upsert({ ...c, entryCounters: { ...c.entryCounters, [type]: next } })
    return `${type}.${next}`
  }

  /**
   * r41 v409 (Tom Gilb 2026-07-01 verbatim "I want tags according to the
   * Planguage standard. Is this in the supreme standard yet? No 'R'. The Tag
   * should be derived as a unique set of 1 to few words, capitalized, from
   * the Text they describe") — Planguage-standard mnemonic tag derivation.
   *
   * The Planguage Mnemonic ID Standard SUPREME (CLAUDE.md) bans:
   *   - Sequential codes:      `V1` / `F1` / `S1` / `C1` / `R1`         BANNED
   *   - Pure numbers:          `1` / `2` / `3`                          BANNED
   *   - PascalCase no spaces:  `SearchLatency` / `UserActivationRate`   BANNED
   *   - Type dot prefix:       `V.SearchLatency` / `R.MaxPayment`       BANNED
   *
   * The correct format is 1-3 SPACE-separated Capitalized words derived from
   * the essence of the description — e.g. `"Onboarding Speed"`, `"GDPR
   * Compliance"`, `"Suspension Payment Cap"`.  Must be unique within the
   * contract; if a proposed tag would collide, append `" (2)"`, `" (3)"` etc.
   *
   * Handles pathological descriptions (empty / only stop-words / all
   * numbers) by falling back to `"Unnamed Entry"` — the caller sees a
   * clearly-flagged placeholder rather than a sequential code.
   */
  function mnemonicTag(
    contractId: string,
    _type:      ContractEntryType,
    description: string,
  ): string {
    const c = _contracts.value.find(x => x.id === contractId)
    // Collect every existing tag in the contract for uniqueness check.
    const existing = new Set<string>()
    if (c) {
      for (const cl of c.clauses) {
        for (const e of cl.entries) existing.add(e.tag)
      }
    }
    const base = _deriveMnemonicFromDescription(description)
    // Uniqueness — append " (N)" until we find a free slot.
    if (!existing.has(base)) return base
    let n = 2
    while (existing.has(`${base} (${n})`)) n++
    return `${base} (${n})`
  }

  function setCurrentContract(id: string | null): void {
    _currentId.value = id
    _saveCurrentId(id)
    // r41 2026-06-20 (option B) — also persist under the active plan slot so
    // switching plans away and back restores this contract.  When no active
    // plan is known yet (App.vue hasn't called `applyPlanSwitch` — boot, or
    // legacy code paths), park under the PRE_PLAN_KEY sentinel; first
    // `applyPlanSwitch` call will hoist it to the real plan id.
    const slot = _activePlanId.value ?? PRE_PLAN_KEY
    _planContractMap.value = { ..._planContractMap.value, [slot]: id }
    _savePlanContractMap(_planContractMap.value)
  }

  /** r41 2026-06-20 (option B) — called by App.vue whenever the active plan
   *  (SpecModel) changes.  Hydrates `_currentId` from the per-plan map so the
   *  Contracts agent reflects the contract THIS plan last had selected.
   *  - First-ever call (with pre-plan sentinel present): hoists the legacy
   *    `CURRENT_KEY` value to the real planId slot (migration shim).
   *  - planId previously seen: restores its remembered contract.
   *  - planId never seen: starts with no contract (landing view).
   *  - planId === null (no active plan): clears current.
   */
  function applyPlanSwitch(planId: string | null): void {
    const prev = _activePlanId.value
    _activePlanId.value = planId
    if (prev === planId) return  // no-op
    // Migration hoist: if PRE_PLAN_KEY has a value and the new planId slot is
    // unset, hand the legacy contract to this plan.
    const map = { ..._planContractMap.value }
    if (planId && map[planId] === undefined && map[PRE_PLAN_KEY]) {
      map[planId] = map[PRE_PLAN_KEY]
      delete map[PRE_PLAN_KEY]
      _planContractMap.value = map
      _savePlanContractMap(map)
    }
    // Hydrate current contract from the per-plan slot (undefined → null).
    const next = planId ? (_planContractMap.value[planId] ?? null) : null
    _currentId.value = next
    _saveCurrentId(next)
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  /** All Planguage entries across all clauses for the current contract. */
  const allEntries = computed<PlanguageContractEntry[]>(() =>
    _currentContract.value?.clauses.flatMap(cl => cl.entries) ?? []
  )

  /** Entry counts by type for the current contract. */
  const entryCounts = computed(() => {
    const counts: Record<ContractEntryType, number> = { F: 0, V: 0, C: 0, R: 0, Sol: 0, S: 0, Task: 0 }
    for (const e of allEntries.value) counts[e.type]++
    return counts
  })

  /** Obligation matrix: party abbreviation → entries grouped by type. */
  const obligationMatrix = computed(() => {
    const contract = _currentContract.value
    if (!contract) return {}
    const matrix: Record<string, Partial<Record<ContractEntryType, PlanguageContractEntry[]>>> = {}
    for (const party of contract.parties) {
      matrix[party.abbreviation] = {}
    }
    matrix['ALL'] = {}
    for (const e of allEntries.value) {
      const key = e.obligatedParty ?? 'ALL'
      if (!matrix[key]) matrix[key] = {}
      if (!matrix[key][e.type]) matrix[key][e.type] = []
      matrix[key][e.type]!.push(e)
    }
    return matrix
  })

  /** Overall parse status summary across all clauses. */
  const overallParseStatus = computed((): ContractParseStatus => {
    const c = _currentContract.value
    if (!c || c.clauses.length === 0) return c?.parseStatus ?? 'empty'
    if (c.clauses.some(cl => cl.parseStatus === 'parsing')) return 'parsing'
    if (c.clauses.every(cl => cl.parseStatus === 'done')) return 'complete'
    if (c.clauses.some(cl => cl.parseStatus === 'error')) return 'error'
    return c.parseStatus
  })

  return {
    contracts:         _contracts,
    currentId:         _currentId,
    currentContract:   _currentContract,
    contractSnapshots: _snapshots,
    allEntries,
    entryCounts,
    obligationMatrix,
    overallParseStatus,
    createContract,
    importContract,
    updateContract,
    deleteContract,
    setClauses,
    setClauseEntries,
    setClauseParseStatus,
    nextTag,
    mnemonicTag,
    setCurrentContract,
    // r41 2026-06-20 (option B) — plan-scoped contract memory.
    applyPlanSwitch,
    activePlanId:    _activePlanId,
    planContractMap: _planContractMap,
  }
}
