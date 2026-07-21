// UNIT_TYPE=Composable
// useInitialInput — persistent capture of the planner's RAW initial input.
//
// Tom Gilb 2026-06-19 verbatim: "INITIAL SPECS: I went back I I could
// not find the initial input, often displayed before, where is it, do I
// start again by putting it in? A thought it could be saved immediately
// as initial input for both recovery, and for later analysis and
// comparison (with what has transpired), Do that."
//
// Three uses for the captured initial input:
//   (1) Recovery — if a parse / sharpen / generation pass loses
//       structure the planner wanted, the raw source text is still here
//       to re-parse OR copy-paste back into the Text tab.
//   (2) Analysis — the prose the AI extractor saw can be compared with
//       what it produced; cases of "the spec doesn't reflect what I
//       gave it" become diagnosable.
//   (3) Comparison — at a later session the planner can compare the
//       initial intent against what the plan has BECOME after sharpening,
//       Evo Steps, Resource allocation, etc.
//
// Storage model:
//   • ONE localStorage key per spec id: `sem-initial-input-<specId>`.
//   • Storing per-spec (rather than a single global key) means each
//     plan/contract carries its own provenance; switching specs in the
//     spec-model panel never overwrites another spec's initial input.
//   • Snapshot shape: { text, mode, source, capturedAt }.
//     - `text`        — the raw input bytes the planner pasted / fetched
//       / read from a file (capped at 200_000 chars).
//     - `mode`        — 'text' | 'url' | 'file'.  Which Read In tab
//       produced this capture.
//     - `source`      — for URL/file modes, the URL string or file name.
//       Lets the planner trace WHERE the input came from later.
//     - `capturedAt`  — ISO timestamp of the capture moment.
//
// Public API:
//   • `saveInitialInput(specId, snapshot)` — persist a snapshot, fired
//     by GetAPlanPanel.handleReadInParse on every successful parse run.
//     Idempotent within a session — if a planner re-parses they get the
//     latest snapshot (older versions land in the typing journal +
//     Past Versions cluster — this composable keeps the LATEST).
//   • `getInitialInput(specId)` — load the snapshot for a spec id, or
//     null if none captured.
//   • `clearInitialInput(specId)` — wipe one spec's initial input
//     (called when the spec itself is deleted).
//   • `hasInitialInput(specId)` — quick boolean check for UI gating.
//
// Composes with: No-Silent-Data-Loss SUPREME (input is captured before
// any AI transform that could swallow it) + Architectural Resilience
// SUPREME (per-spec storage isolation) + Claude-Code-as-AI-Layer SUPREME
// (zero network calls; pure browser-local) + Twin portability (one key
// shape per spec; Kai's Twin can read/write the same key).

const PREFIX = 'sem-initial-input-'
const MAX_TEXT_CHARS = 200_000  // ~200 KB ceiling, way past any pasted page

export type InitialInputMode = 'text' | 'url' | 'file'

export interface InitialInputSnapshot {
  text:        string
  mode:        InitialInputMode
  source?:     string          // URL or file name for non-text modes
  capturedAt:  string          // ISO timestamp
}

function _key(specId: string): string {
  return `${PREFIX}${specId}`
}

function _storageAvailable(): boolean {
  return typeof localStorage !== 'undefined'
}

/** Persist the planner's raw initial input for a given spec id.  Safe to
 *  call on every parse run; latest snapshot wins.  Silently caps the
 *  text length at `MAX_TEXT_CHARS` so the storage write never blows the
 *  quota (head-truncated with a marker). */
export function saveInitialInput(specId: string, snapshot: Omit<InitialInputSnapshot, 'capturedAt'>): void {
  if (!_storageAvailable() || !specId) return
  const text = (snapshot.text ?? '').length > MAX_TEXT_CHARS
    ? snapshot.text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated for storage]'
    : (snapshot.text ?? '')
  const record: InitialInputSnapshot = {
    text,
    mode:       snapshot.mode,
    source:     snapshot.source,
    capturedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(_key(specId), JSON.stringify(record))
  } catch {
    /* quota / disabled — non-fatal */
  }
}

/** Load the most recent initial input snapshot for a spec id, or null. */
export function getInitialInput(specId: string): InitialInputSnapshot | null {
  if (!_storageAvailable() || !specId) return null
  try {
    const raw = localStorage.getItem(_key(specId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Partial<InitialInputSnapshot>
    if (typeof obj.text !== 'string') return null
    if (obj.mode !== 'text' && obj.mode !== 'url' && obj.mode !== 'file') return null
    return {
      text:       obj.text,
      mode:       obj.mode,
      source:     typeof obj.source === 'string' ? obj.source : undefined,
      capturedAt: typeof obj.capturedAt === 'string' ? obj.capturedAt : '',
    }
  } catch {
    return null
  }
}

/** True if there is any captured initial input for this spec id. */
export function hasInitialInput(specId: string): boolean {
  return getInitialInput(specId) !== null
}

/** Wipe the initial input for one spec.  Called when the spec is deleted
 *  so abandoned snapshots don't leak. */
export function clearInitialInput(specId: string): void {
  if (!_storageAvailable() || !specId) return
  try {
    localStorage.removeItem(_key(specId))
  } catch {
    /* ignore */
  }
}

// ── Pending-snapshot bridge ─────────────────────────────────────────────────
//
// The GetAPlanPanel captures the raw input BEFORE the parent (App.vue)
// has assigned a spec-model id to the parsed result.  Save the snapshot
// to a single PENDING key first; the parent's import handler then
// transfers it to the proper per-spec key once it knows the id.  This
// keeps `useInitialInput` ignorant of any UI layer; only two functions
// need to know about the pending bridge.

const PENDING_KEY = 'sem-initial-input-pending'

/** Stage a snapshot for the NEXT spec model that gets created.  Called
 *  from GetAPlanPanel right after a successful parse, before the spec
 *  is auto-applied. */
export function stagePendingInitialInput(snapshot: Omit<InitialInputSnapshot, 'capturedAt'>): void {
  if (!_storageAvailable()) return
  const text = (snapshot.text ?? '').length > MAX_TEXT_CHARS
    ? snapshot.text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated for storage]'
    : (snapshot.text ?? '')
  const record: InitialInputSnapshot = {
    text,
    mode:       snapshot.mode,
    source:     snapshot.source,
    capturedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(record))
  } catch {
    /* quota / disabled */
  }
}

/** Move the staged pending snapshot to the per-spec key for `specId`.
 *  Called from App.vue's import handler once the new spec model has an
 *  id.  Idempotent: if nothing is staged the function is a no-op.
 *  Returns true when a transfer happened. */
export function commitPendingInitialInput(specId: string): boolean {
  if (!_storageAvailable() || !specId) return false
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return false
    localStorage.setItem(_key(specId), raw)
    localStorage.removeItem(PENDING_KEY)
    return true
  } catch {
    return false
  }
}
