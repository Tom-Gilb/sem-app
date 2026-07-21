// UNIT_TYPE=Types
// undo.ts — Universal Undo System type definitions (Tom Gilb SUPREME rule 2026-06-11).
//
// Tom Gilb 2026-06-11 verbatim:
//   "Undo is like a strong rule for me: changes should not be irreversible, in the short
//    term, there can be many reasons why we realize we regret, and we must be helped to do
//    it, always."
//
// One central system. Every spec-mutating tool calls useUndoHistory().record() before
// writing currentSpec. Global ⌘Z + visible Undo button restore the prevSpec.

import type { SpecBlock } from './spec'

/** A single undo-able action — captured at action-time, restorable at undo-time. */
export interface UndoEntry {
  /** Deterministic per action (r93l lesson — stable IDs for v-for keys + cross-session refs). */
  id: string
  /** Human-readable action label shown in HoverHint + History view.
   *  Examples: "Penta Apply Edits · V.UserActivation", "Incorruptible Accept Fix · Quarterly Tyranny" */
  label: string
  /** Which tool / surface fired the action — for filtering + diagnostics.
   *  Examples: "PentaPanel" | "Incorruptible" | "MultiVision IET" | "SpecImporter" | ... */
  source: string
  /** ISO 8601 — when the action was recorded. */
  timestamp: string
  /** Deep-cloned snapshot of the spec BEFORE the action. Restored on undo(). */
  prevSpec: SpecBlock
  /** Deep-cloned snapshot of the spec AFTER the action. Restored on redo(). */
  nextSpec: SpecBlock
  /** Optional list of field paths that were mutated — for fine-grained UI display.
   *  Examples: ["V.UserActivation.goal", "V.UserActivation.goalWhen"] */
  affectedFields?: string[]
  /** Optional principle / reason — used by Incorruptible Agent to track WHY a change happened. */
  principle?: string
}

/** Max retained entries in the undo stack (Phase 1 in-memory). Trims oldest when exceeded.
 *  At ~5 KB per deep-cloned typical spec, 50 entries = ~250 KB — trivial browser memory. */
export const UNDO_MAX_DEPTH = 50
