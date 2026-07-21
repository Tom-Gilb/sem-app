// UNIT_TYPE=Composable
// useUndoHistory.ts — Universal Undo System (SUPREME rule per Tom Gilb 2026-06-11).
//
// Tom Gilb 2026-06-11 verbatim:
//   "Undo is like a strong rule for me: changes should not be irreversible, in the short
//    term, there can be many reasons why we realize we regret, and we must be helped to do
//    it, always."
//
// Singleton pattern (module-level state) — every caller that does `useUndoHistory()` gets
// refs that wrap the SAME stack. This is the central system every mutation site is required
// to route through (see CLAUDE.md Universal Undo Rule).
//
// Usage:
//   const undo = useUndoHistory()
//   // Before mutating currentSpec:
//   undo.record({
//     label: 'Penta Apply Edits',
//     source: 'PentaPanel',
//     prevSpec: structuredClone(currentSpec.value),
//     nextSpec: newSpec,
//   })
//   currentSpec.value = newSpec
//
// Phase 1 (this file): in-memory only, cleared on plan switch via clear().
// Phase 2 (later): localStorage persistence + per-plan scoping.

import { ref, computed } from 'vue'
import type { UndoEntry } from '../types/undo'
import { UNDO_MAX_DEPTH } from '../types/undo'

// ── Module-level singleton state ────────────────────────────────────────────

/** localStorage key for persisted undo state. r93cc Phase 3: survives page reload. */
const STORAGE_KEY = 'undoHistory:v1'

/** Load persisted state on module init. Silent-degrade if localStorage unavailable. */
function _hydrateFromStorage(): { undo: UndoEntry[]; redo: UndoEntry[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { undo: [], redo: [] }
    const data = JSON.parse(raw) as { undo?: UndoEntry[]; redo?: UndoEntry[] }
    return {
      undo: Array.isArray(data.undo) ? data.undo.slice(-UNDO_MAX_DEPTH) : [],
      redo: Array.isArray(data.redo) ? data.redo.slice(-UNDO_MAX_DEPTH) : [],
    }
  } catch { return { undo: [], redo: [] } }
}

const _hydrated = _hydrateFromStorage()

/** LIFO stack — most recent action at end (last). Hydrated from localStorage on module init. */
const _undoStack = ref<UndoEntry[]>(_hydrated.undo)

/** Redo stack — populated by undo(), cleared by any new record(). Hydrated from localStorage. */
const _redoStack = ref<UndoEntry[]>(_hydrated.redo)

/** Persist current state to localStorage. Called after every mutation. */
function _persistToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      undo: _undoStack.value,
      redo: _redoStack.value,
    }))
  } catch { /* silent degrade — quota / private mode */ }
}

// ── Callbacks the host provides at mount time ───────────────────────────────
//
// Why a callback rather than direct ref-write: useUndoHistory is composable-level;
// `currentSpec` lives in App.vue. We don't want to import App's refs here (cyclic).
// The host wires `restoreSpec(spec)` once at App startup; undo() / redo() call it.

let _restoreSpecCallback: ((spec: import('../types/spec').SpecBlock) => void) | null = null

/** App.vue calls this ONCE at startup to wire the spec-restore mechanism. */
export function registerUndoSpecRestorer(
  fn: (spec: import('../types/spec').SpecBlock) => void,
): void {
  _restoreSpecCallback = fn
}

// ── Helper: deterministic id ─────────────────────────────────────────────────

let _idCounter = 0
function nextEntryId(source: string): string {
  _idCounter += 1
  return `undo|${source}|${Date.now()}|${_idCounter}`
}

// ── The composable ───────────────────────────────────────────────────────────

export function useUndoHistory() {

  /**
   * Record a new action. Call BEFORE mutating currentSpec. Clears the redo stack
   * (new action invalidates any redo branch).
   */
  function record(entry: Omit<UndoEntry, 'id' | 'timestamp'>): UndoEntry {
    const fullEntry: UndoEntry = {
      ...entry,
      id:        nextEntryId(entry.source),
      timestamp: new Date().toISOString(),
    }
    // Push + trim oldest if at capacity
    const next = [..._undoStack.value, fullEntry]
    if (next.length > UNDO_MAX_DEPTH) {
      next.shift()  // drop oldest
    }
    _undoStack.value = next
    // Any new recorded action invalidates the redo branch
    if (_redoStack.value.length > 0) _redoStack.value = []
    _persistToStorage()
    return fullEntry
  }

  /**
   * Undo the most recent action — pop top of undo, restore prevSpec via the registered
   * callback, push the popped entry onto the redo stack so ⌘⇧Z can replay it.
   * Returns the undone entry, or null if nothing to undo.
   */
  function undo(): UndoEntry | null {
    if (_undoStack.value.length === 0) return null
    const next      = [..._undoStack.value]
    const entry     = next.pop()!
    _undoStack.value = next
    _redoStack.value = [..._redoStack.value, entry]
    if (_restoreSpecCallback) {
      _restoreSpecCallback(entry.prevSpec)
    } else {
      // eslint-disable-next-line no-console
      console.warn('[useUndoHistory] undo() called but no spec-restorer registered — App.vue must call registerUndoSpecRestorer() at startup')
    }
    _persistToStorage()
    return entry
  }

  /**
   * Redo the most recent undone action — pop top of redo, restore nextSpec, push back
   * onto the undo stack. Returns the redone entry, or null if nothing to redo.
   */
  function redo(): UndoEntry | null {
    if (_redoStack.value.length === 0) return null
    const next       = [..._redoStack.value]
    const entry      = next.pop()!
    _redoStack.value = next
    _undoStack.value = [..._undoStack.value, entry]
    if (_restoreSpecCallback) {
      _restoreSpecCallback(entry.nextSpec)
    }
    _persistToStorage()
    return entry
  }

  /** Wipe both stacks. Called on plan switch (the open of a different plan or model). */
  function clear(): void {
    _undoStack.value = []
    _redoStack.value = []
    _persistToStorage()
  }

  /** Look up a recorded entry by id — used by per-tool Undo affordances that target
   *  a specific past action (e.g. Incorruptible's per-finding Undo Fix). */
  function getEntry(id: string): UndoEntry | null {
    return _undoStack.value.find(e => e.id === id) ?? _redoStack.value.find(e => e.id === id) ?? null
  }

  const canUndo   = computed(() => _undoStack.value.length > 0)
  const canRedo   = computed(() => _redoStack.value.length > 0)
  const lastEntry = computed<UndoEntry | null>(() =>
    _undoStack.value.length > 0 ? _undoStack.value[_undoStack.value.length - 1] : null,
  )
  const stack     = computed<UndoEntry[]>(() => [..._undoStack.value])
  const redoStack = computed<UndoEntry[]>(() => [..._redoStack.value])

  return {
    record,
    undo,
    redo,
    clear,
    getEntry,
    canUndo,
    canRedo,
    lastEntry,
    stack,
    redoStack,
  }
}
