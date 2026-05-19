// useInputSafetyNet — universal draft-loss recovery for the SEM App.
//
// Origin: Tom 2026-05-14 — Claudian's chat input wiped his Anthropic offer
// twice in one session with no ⌘Z recovery. Tom: "inadequate design." This
// composable is the SEM App's answer — we never punish a user the same way.
//
// Contract (Tom 2026-05-14, ratified by Q7 + the build greenlight):
//   - If a user types or speaks a non-trivial string (≥5 words) and it
//     "disappears" (inadvertent erase / paste-over / refresh), they can
//     restore it via three paths:
//       1. Click "Restore" on the Oops toast
//       2. Press ⌘Z (or Ctrl+Z) while the toast is visible
//       3. Say "Yes" (handled by voice listener — wired separately)
//   - The user-facing copy: "Oops — looks like you may have lost what you
//     wrote. To restore, click Restore or press ⌘Z."
//
// VI grounding: [SE] / [VI] Ch.5 (Stakeholder Analysis) — the keyed user
// input IS the stakeholder's expressed value. Losing it is losing
// requirements provenance. We must preserve it word-for-word.
//
// Mechanism:
//   - Per-field ring buffer of stable snapshots (max 5 per field).
//   - Snapshot taken when text ≥5 words AND has been stable ≥1.5 s.
//   - Drop detected when current word count < 50% of latest snapshot AND
//     the snapshot is recent (< 5 minutes old).
//   - Once an Oops is offered for a field, we lock out further offers for
//     that field until the user restores or dismisses.
//   - All snapshots persist to localStorage so a browser refresh doesn't
//     lose them (Q6 persistence honesty).
//
// Style: matches useToast.ts — module-level singleton, exported via a
// `useInputSafetyNet()` hook.

import { ref, watch, computed, type Ref } from 'vue'

// ───── Types ────────────────────────────────────────────────────────────────

export interface SafetyNetSnapshot {
  fieldId: string
  text: string
  words: number
  capturedAt: number   // epoch ms
}

interface OopsOffer {
  fieldId: string
  snapshot: SafetyNetSnapshot
  /** When this offer was raised — used to expire stale offers. */
  raisedAt: number
}

// ───── Tunables ─────────────────────────────────────────────────────────────

/** Minimum words before we consider any input "non-trivial" worth saving. */
const MIN_WORDS = 5
/** Idle time before a draft becomes a stable snapshot. */
const STABLE_IDLE_MS = 1500
/** Drop threshold: words < 50% of latest snapshot triggers Oops. */
const DROP_RATIO = 0.5
/**
 * How long we keep snapshots in localStorage and in memory.
 * 24 hours — long enough to survive app crashes, browser crashes, and a good
 * night's sleep. Previously was 5 minutes, which meant any draft older than
 * 5 min was silently discarded with no recovery path (Tom 2026-05-19 "we got
 * no backup of our latest try, after things froze").
 */
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000   // 24 hours
/**
 * Oops toast is only shown for RECENT drops (within the last 5 minutes).
 * Distinct from SNAPSHOT_MAX_AGE_MS: a crash 2 hours ago should offer
 * recovery, but the mid-session "you just deleted your text" toast only
 * makes sense while the loss is fresh.
 */
const OOPS_MAX_AGE_MS = 5 * 60 * 1000
/** Max snapshots per field. */
const MAX_SNAPSHOTS_PER_FIELD = 5
/** localStorage key. */
const STORAGE_KEY = 'sem-app:input-safety-net:v1'

// ───── Module-level singleton state ─────────────────────────────────────────

/** All snapshots, keyed by fieldId. */
const _snapshots = ref<Map<string, SafetyNetSnapshot[]>>(new Map())
/** Per-field lockout — once Oops shown, suppress until resolved. */
const _lockedFields = new Set<string>()
/** Currently-offered Oops (only one at a time, app-wide). */
const _oopsOffer = ref<OopsOffer | null>(null)
/** Per-field restore callbacks supplied by call sites. */
const _restorers = new Map<string, (text: string) => void>()
/**
 * Per-field immediate-flush callbacks — called on pagehide / visibilitychange
 * to persist any pending debounced snapshots before the page is unloaded.
 * Without this, text typed just before a tab close or app freeze is not
 * saved to localStorage (the 1.5 s idle timer never fires).
 * Tom 2026-05-19: "we got no backup of our latest try, after things froze."
 */
const _pendingFlushers = new Map<string, () => void>()

// ───── Helpers ──────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function _persist(): void {
  try {
    const flat: SafetyNetSnapshot[] = []
    for (const [, arr] of _snapshots.value) flat.push(...arr)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flat))
  } catch {
    // localStorage may be unavailable (private mode, quota). Non-fatal.
  }
}

function _hydrate(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const flat = JSON.parse(raw) as SafetyNetSnapshot[]
    if (!Array.isArray(flat)) return
    const map = new Map<string, SafetyNetSnapshot[]>()
    for (const snap of flat) {
      if (!snap || typeof snap.text !== 'string') continue
      // Drop anything older than max-age on hydrate — stale safety nets
      // are noise, not signal.
      if (Date.now() - snap.capturedAt > SNAPSHOT_MAX_AGE_MS) continue
      const arr = map.get(snap.fieldId) ?? []
      arr.push(snap)
      map.set(snap.fieldId, arr)
    }
    _snapshots.value = map
  } catch {
    // bad JSON or storage failure — safe to ignore.
  }
}

let _hydrated = false
function _ensureHydrated(): void {
  if (_hydrated) return
  _hydrated = true
  _hydrate()
}

function _pushSnapshot(fieldId: string, text: string): void {
  const words = countWords(text)
  if (words < MIN_WORDS) return
  const snap: SafetyNetSnapshot = {
    fieldId,
    text,
    words,
    capturedAt: Date.now(),
  }
  const map = new Map(_snapshots.value)
  const arr = map.get(fieldId)?.slice() ?? []
  // De-dupe: skip if latest snapshot has identical text.
  if (arr.length > 0 && arr[arr.length - 1].text === text) return
  arr.push(snap)
  while (arr.length > MAX_SNAPSHOTS_PER_FIELD) arr.shift()
  map.set(fieldId, arr)
  _snapshots.value = map
  _persist()
}

function _latestSnapshot(fieldId: string): SafetyNetSnapshot | null {
  const arr = _snapshots.value.get(fieldId)
  if (!arr || arr.length === 0) return null
  return arr[arr.length - 1]
}

function _maybeOfferOops(fieldId: string, currentText: string): void {
  if (_lockedFields.has(fieldId)) return
  if (_isIntentionallyCleared(fieldId)) return
  if (_oopsOffer.value) return // one offer at a time, app-wide.
  const latest = _latestSnapshot(fieldId)
  if (!latest) return
  // Use the shorter OOPS_MAX_AGE_MS here: the "you just lost your text" toast
  // is only useful within a few minutes of the drop. Crash recovery uses a
  // separate path (watchField initial check) with the longer SNAPSHOT_MAX_AGE_MS.
  if (Date.now() - latest.capturedAt > OOPS_MAX_AGE_MS) return
  const currentWords = countWords(currentText)
  if (latest.words < MIN_WORDS) return
  if (currentWords >= latest.words * DROP_RATIO) return
  // Drop detected. Raise the offer.
  _oopsOffer.value = {
    fieldId,
    snapshot: latest,
    raisedAt: Date.now(),
  }
  _lockedFields.add(fieldId)
}

/**
 * Per-field timestamp of an explicit "this clear was intentional" signal.
 * The watch ignores drop events for this field for `INTENTIONAL_GRACE_MS`
 * after the signal so that submit/send/reset code paths don't raise false
 * Oops offers.
 */
const _intentionalClearAt = new Map<string, number>()
const INTENTIONAL_GRACE_MS = 600

function _isIntentionallyCleared(fieldId: string): boolean {
  const t = _intentionalClearAt.get(fieldId)
  if (!t) return false
  return Date.now() - t < INTENTIONAL_GRACE_MS
}

// ───── Public API ──────────────────────────────────────────────────────────

/**
 * Register a reactive text field for safety-net protection.
 *
 * @param fieldId Stable identifier for the field (e.g. 'sem-home-input').
 * @param textRef Reactive ref to the field's text.
 * @param applyRestore Callback that replaces the field's text on restore.
 *                     Receives the snapshot text. Usually `(t) => textRef.value = t`.
 * @returns Stop function (call to deregister and clear pending timers).
 */
export function watchField(
  fieldId: string,
  textRef: Ref<string>,
  applyRestore: (text: string) => void,
): () => void {
  _ensureHydrated()
  _restorers.set(fieldId, applyRestore)

  let idleTimer: ReturnType<typeof setTimeout> | null = null

  // Immediate flush — called on pagehide/visibilitychange to persist any
  // pending debounced snapshot before the page is torn down.
  const flushNow = () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    const current = textRef.value
    if (typeof current === 'string') _pushSnapshot(fieldId, current)
  }
  _pendingFlushers.set(fieldId, flushNow)

  const stopWatcher = watch(textRef, (next, prev) => {
    // Cancel any pending stable-snapshot timer.
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }

    // 1) Drop detection — check immediately on shrink events.
    if (typeof prev === 'string' && typeof next === 'string') {
      const prevWords = countWords(prev)
      const nextWords = countWords(next)
      if (nextWords < prevWords) {
        _maybeOfferOops(fieldId, next)
      }
    }

    // 2) Schedule a stable snapshot after STABLE_IDLE_MS of no further change.
    if (typeof next === 'string' && countWords(next) >= MIN_WORDS) {
      idleTimer = setTimeout(() => {
        _pushSnapshot(fieldId, next)
        // Clearing lockout when user has rebuilt a fresh stable draft —
        // they're past the previous Oops moment.
        _lockedFields.delete(fieldId)
      }, STABLE_IDLE_MS)
    }
  })

  // ── Initial crash-recovery check ──────────────────────────────────────────
  // If the field starts EMPTY but there is a recent safety-net snapshot (from
  // a previous session that froze or crashed before the user could save), offer
  // the Oops recovery UI so the user can restore the lost draft.
  //
  // This is the scenario where SNAPSHOT_MAX_AGE_MS = 24h matters: a draft
  // from 2 hours ago is still recoverable, but OOPS_MAX_AGE_MS (5 min) would
  // have suppressed it. We bypass the age check here and offer directly.
  //
  // Guard: do NOT offer if there is already an oops pending (another field
  // already triggered one), or if the field was intentionally cleared.
  setTimeout(() => {
    if (_oopsOffer.value) return
    if (_isIntentionallyCleared(fieldId)) return
    const current = textRef.value
    if (current.trim()) return  // field has content — no recovery needed
    const latest = _latestSnapshot(fieldId)
    if (!latest) return
    if (latest.words < MIN_WORDS) return
    // Offer directly (bypasses OOPS_MAX_AGE_MS — the draft is fresh enough for
    // the 24-hour window but may be older than the 5-minute Oops window).
    _oopsOffer.value = {
      fieldId,
      snapshot: latest,
      raisedAt: Date.now(),
    }
  }, 0)   // defer one microtask tick so watcher hydration completes first

  return () => {
    if (idleTimer) clearTimeout(idleTimer)
    _pendingFlushers.delete(fieldId)
    stopWatcher()
    _restorers.delete(fieldId)
  }
}

/** Resolve the currently-offered Oops by restoring the snapshot text. */
function restoreOops(): void {
  const offer = _oopsOffer.value
  if (!offer) return
  const restorer = _restorers.get(offer.fieldId)
  if (restorer) restorer(offer.snapshot.text)
  _oopsOffer.value = null
  // Lockout is intentionally kept until the user generates a new stable
  // snapshot — prevents toast spam if they delete again immediately.
}

/** Dismiss the offer without restoring (user genuinely meant to clear). */
function dismissOops(): void {
  _oopsOffer.value = null
  // Same lockout policy as restoreOops — released on next stable snapshot.
}

/**
 * Mark a field as having JUST been cleared intentionally by code (submit /
 * send / reset). Suppresses Oops offers for that field for a short grace
 * window — long enough to cover the v-model reactive propagation but not so
 * long that real user drops within the same field are missed.
 *
 * Call this at the call site BEFORE you set the field to '' (or to an empty
 * array). Example:
 *
 *   safetyNet.markIntentionalClear('spec-coach-input')
 *   inputText.value = ''
 */
function markIntentionalClear(fieldId: string): void {
  _intentionalClearAt.set(fieldId, Date.now())
}

/**
 * Like markIntentionalClear but for an entire array of indexed fields (e.g.
 * `'sharpen-answer-0'`, `'sharpen-answer-1'`, …). Marks every fieldId whose
 * stored snapshots have the given prefix.
 */
function markIntentionalClearForPrefix(prefix: string): void {
  const now = Date.now()
  for (const fieldId of _snapshots.value.keys()) {
    if (fieldId.startsWith(prefix)) _intentionalClearAt.set(fieldId, now)
  }
}

/**
 * Wipe the snapshot ring for a specific field (e.g. when an edit buffer
 * switches to a different target and the snapshots for the previous target
 * are no longer relevant). Stronger than markIntentionalClear — full reset.
 */
function clearField(fieldId: string): void {
  const map = new Map(_snapshots.value)
  if (map.delete(fieldId)) {
    _snapshots.value = map
    _persist()
  }
  _lockedFields.delete(fieldId)
  _intentionalClearAt.delete(fieldId)
}

/**
 * Register a reactive ARRAY of strings (each index is a separate field).
 * Each non-empty string position gets its own ring buffer keyed
 * `${fieldIdPrefix}-${i}`. Useful for question-set inputs like SharpenPanel
 * `answers: string[]`.
 *
 * @returns Stop function that deregisters all per-index watchers.
 */
export function watchArrayField(
  fieldIdPrefix: string,
  arrayRef: Ref<string[]>,
): () => void {
  _ensureHydrated()
  const stops = new Map<number, () => void>()

  const stopArrayWatcher = watch(arrayRef, (next) => {
    // (Re)bind a per-index watcher for every present index.
    const seen = new Set<number>()
    for (let i = 0; i < next.length; i++) {
      seen.add(i)
      if (stops.has(i)) continue
      const fieldId = `${fieldIdPrefix}-${i}`
      // Real-Ref projection of arrayRef[i] — a WritableComputedRef is what
      // Vue's `watch` needs to track changes correctly (a plain object with
      // a `value` getter is NOT enough).
      const proj = computed<string>({
        get: () => arrayRef.value[i] ?? '',
        set: (v: string) => {
          const arr = arrayRef.value.slice()
          arr[i] = v
          arrayRef.value = arr
        },
      })
      const stop = watchField(fieldId, proj, (text) => { proj.value = text })
      stops.set(i, stop)
    }
    // Tear down any per-index watcher whose index no longer exists (array shrunk).
    for (const [i, stop] of stops) {
      if (!seen.has(i)) {
        stop()
        stops.delete(i)
        clearField(`${fieldIdPrefix}-${i}`)
      }
    }
  }, { immediate: true, deep: false })

  return () => {
    stopArrayWatcher()
    for (const stop of stops.values()) stop()
    stops.clear()
  }
}

/**
 * Hook accessor — returns the singleton refs + actions.
 * Style mirrors useToast(): every consumer gets the SAME state.
 */
export function useInputSafetyNet() {
  _ensureHydrated()
  return {
    snapshots: _snapshots,
    oopsOffer: _oopsOffer,
    watchField,
    watchArrayField,
    markIntentionalClear,
    markIntentionalClearForPrefix,
    clearField,
    restoreOops,
    dismissOops,
  }
}

// ───── Pagehide / crash-safe flush ──────────────────────────────────────────
// Immediately persist ALL pending field snapshots before the page is unloaded.
// Without this, text typed just before a tab close, browser crash, or OS-level
// freeze is never saved to localStorage (the 1.5 s idle debounce never fires).
// Tom 2026-05-19: "we got no backup of our latest try, after things froze."

if (typeof window !== 'undefined') {
  const _flushAll = () => {
    for (const flush of _pendingFlushers.values()) flush()
  }
  window.addEventListener('pagehide', _flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _flushAll()
  })
}

/**
 * Returns the text of the most recent safety-net snapshot for a field, or
 * null if none exists. The snapshot can be up to SNAPSHOT_MAX_AGE_MS (24h)
 * old — suitable for crash recovery. Use this to offer draft restoration after
 * a page reload when the textarea is empty.
 */
export function getLatestDraft(fieldId: string): string | null {
  _ensureHydrated()
  const snap = _latestSnapshot(fieldId)
  if (!snap) return null
  if (Date.now() - snap.capturedAt > SNAPSHOT_MAX_AGE_MS) return null
  return snap.text
}

// ───── Window-level Cmd/Ctrl+Z bridge ──────────────────────────────────────
// While an Oops offer is visible, the next ⌘Z anywhere in the app restores it.
// This is the "Cmd+Z recovery" half of Tom's design quote.

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!_oopsOffer.value) return
    const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
    if (!isUndo) return
    e.preventDefault()
    e.stopPropagation()
    restoreOops()
  }, { capture: true })

  // Voice bridge: a voice handler can dispatch this event when the user says
  // "yes" while the toast is visible. Wired separately in the voice system.
  window.addEventListener('safety-net:yes', () => {
    if (_oopsOffer.value) restoreOops()
  })
  // Programmatic dismiss bridge (e.g. voice "no" / "dismiss").
  window.addEventListener('safety-net:no', () => {
    if (_oopsOffer.value) dismissOops()
  })
}
