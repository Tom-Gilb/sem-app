// UNIT_TYPE=Hook
// useEntryProvenance — Phase 1: Sources of Specs — silent per-entry provenance data model.
//
// Every F./V./S. entry accumulates an append-only change timeline in localStorage.
// Phase 1: data accumulates silently with no UI.
// Phase 2: inline surface labels per entry (main source tag).
// Phase 3: detail popover (full timeline, AI-leverage ratio).
//
// Storage key: 'sem-entry-provenance'
// Shape:       Record<planModelId, Record<entryId, EntryProvenance>>
//
// Design rules:
//   - All functions are pure side-effectful helpers; no Vue reactivity inside this file.
//   - planModelId is always passed in; this composable never imports usePlanModel.
//   - wordsBefore / wordsAfter track the description field (primary human-readable text).
//   - humanInputWords approximates the volume of human intent that triggered each change.

import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Who or what caused a change to an entry */
export type ProvenanceActor = 'human' | 'ai' | 'app'

/**
 * How the change came to be.
 *   generate — AI created the entry from the initial SEM triple (translate pipeline).
 *   sharpen  — AI updated the entry during a sharpening round.
 *   edit     — A human manually edited the entry in SpecEditorPanel.
 *   import   — Entry arrived via JSON plan import; may have prior history in another workspace.
 */
export type ProvenanceChangeType = 'generate' | 'sharpen' | 'edit' | 'import'

/** One event in an entry's change timeline */
export interface EntryProvenanceEvent {
  /** ISO timestamp of this event */
  at: string
  actor: ProvenanceActor
  changeType: ProvenanceChangeType
  /**
   * Word count of the entry's description BEFORE this change.
   * 0 for 'generate' and 'import' events (entry did not exist yet).
   */
  wordsBefore: number
  /** Word count of the entry's description AFTER this change */
  wordsAfter: number
  /**
   * Word count of human-authored input that triggered this change.
   *   generate → total words in stakes + ends + means
   *   sharpen  → total words across all Q&A answers in the round
   *   edit     → wordsAfter (the human wrote the new text)
   *   import   → 0
   */
  humanInputWords: number
  /**
   * Optional context label — e.g. sharpen category name or edit-version name.
   * Not surfaced in Phase 1; reserved for Phase 3 detail popover.
   */
  label?: string
}

/** Full provenance record for one spec entry */
export interface EntryProvenance {
  /** The plan model this entry belongs to */
  planModelId: string
  /** Entry ID as it appears in the SpecBlock (e.g. "F.ActivationRate", "V.ChurnScore") */
  entryId: string
  /** ISO timestamp when this entry was first seen (earliest event) */
  firstSeenAt: string
  /** ISO timestamp of the most recent event */
  lastChangedAt: string
  /** Count of events where actor === 'human' */
  humanChanges: number
  /** Count of events where actor === 'ai' */
  aiChanges: number
  /** Count of events where actor === 'app' */
  appChanges: number
  /**
   * Append-only event log, oldest first.
   * Use recordProvenanceEvent() to add entries — never mutate directly.
   */
  events: EntryProvenanceEvent[]
}

/**
 * Summarised label for the dominant source of an entry.
 * Used in Phase 2 inline tags.
 */
export type MainSourceLabel =
  | 'AI draft'      // Only generate/sharpen events, no human edit
  | 'AI sharpened'  // Had at least one sharpen event, no human edit
  | 'Human edited'  // At least one human edit event
  | 'Imported'      // Import-only, no subsequent changes
  | 'Unknown'       // No events recorded yet

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-entry-provenance'

type ProvenanceStore = Record<string, Record<string, EntryProvenance>>

function _load(): ProvenanceStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ProvenanceStore) : {}
  } catch { return {} }
}

function _save(store: ProvenanceStore): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch { /* storage quota */ }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Count the number of words in a text string.
 * Exported so callers can compute humanInputWords before calling hooks.
 */
export function countWords(text: string | undefined | null): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Resolve the description field from any entry in a SpecBlock.
 * All three entry types (F/V/S) carry a `description` field.
 */
function _entryDescription(
  entryId: string,
  spec: SpecBlock,
): string | null {
  const all = [
    ...spec.functions,
    ...spec.values,
    ...spec.solutions,
  ] as Array<FEntry | VEntry | SEntry>
  const found = all.find((e) => e.id === entryId)
  return found ? found.description : null
}

// ── Core write ────────────────────────────────────────────────────────────────

/**
 * Append one provenance event to an entry's timeline.
 * If no record exists for this entry yet, a new one is created.
 * Idempotency: events with identical (at, changeType, actor) ARE recorded —
 * they represent real occurrences in the timeline.
 */
export function recordProvenanceEvent(
  planModelId: string,
  entryId: string,
  event: EntryProvenanceEvent,
): void {
  const store = _load()
  const planStore = store[planModelId] ?? {}
  const existing = planStore[entryId]

  if (!existing) {
    planStore[entryId] = {
      planModelId,
      entryId,
      firstSeenAt:   event.at,
      lastChangedAt: event.at,
      humanChanges:  event.actor === 'human' ? 1 : 0,
      aiChanges:     event.actor === 'ai'    ? 1 : 0,
      appChanges:    event.actor === 'app'   ? 1 : 0,
      events:        [event],
    }
  } else {
    planStore[entryId] = {
      ...existing,
      lastChangedAt: event.at,
      humanChanges:  existing.humanChanges + (event.actor === 'human' ? 1 : 0),
      aiChanges:     existing.aiChanges    + (event.actor === 'ai'    ? 1 : 0),
      appChanges:    existing.appChanges   + (event.actor === 'app'   ? 1 : 0),
      events:        [...existing.events, event],
    }
  }

  store[planModelId] = planStore
  _save(store)
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Return the provenance record for one entry, or null if not yet tracked. */
export function getProvenance(
  planModelId: string,
  entryId: string,
): EntryProvenance | null {
  const store = _load()
  return store[planModelId]?.[entryId] ?? null
}

/** Return all provenance records for a plan, keyed by entryId. */
export function getAllProvenance(
  planModelId: string,
): Record<string, EntryProvenance> {
  const store = _load()
  return store[planModelId] ?? {}
}

// ── Derived label ─────────────────────────────────────────────────────────────

/**
 * Compute the dominant source label for an entry.
 * Logic:
 *   1. No events → Unknown
 *   2. Any human edit → Human edited
 *   3. Any sharpen event → AI sharpened
 *   4. Import only, single event → Imported
 *   5. Otherwise → AI draft
 */
export function computeMainSource(
  provenance: EntryProvenance | null | undefined,
): MainSourceLabel {
  if (!provenance || provenance.events.length === 0) return 'Unknown'
  if (provenance.humanChanges > 0) return 'Human edited'
  const types = new Set(provenance.events.map((e) => e.changeType))
  if (types.has('sharpen')) return 'AI sharpened'
  if (types.size === 1 && types.has('import')) return 'Imported'
  return 'AI draft'
}

// ── Convenience hooks ─────────────────────────────────────────────────────────

/**
 * Initialise provenance for every entry in a SpecBlock in a single call.
 *
 * Used for:
 *   - 'generate' — after translate() returns a new spec (all entries are new, wordsBefore = 0)
 *   - 'import'   — after importPlanModel() loads a plan from JSON (all entries are new to this session)
 *
 * Entries that already have provenance records are NOT skipped — the event is
 * appended. This correctly handles re-imports or regenerations of the same plan.
 */
export function initEntriesFromSpec(
  planModelId: string,
  spec: SpecBlock,
  eventBase: {
    actor: ProvenanceActor
    changeType: ProvenanceChangeType
    humanInputWords: number
    label?: string
  },
): void {
  const at = new Date().toISOString()
  const allEntries = [
    ...spec.functions.map((e) => ({ id: e.id, description: e.description })),
    ...spec.values.map((e)   => ({ id: e.id, description: e.description })),
    ...spec.solutions.map((e) => ({ id: e.id, description: e.description })),
  ]

  for (const entry of allEntries) {
    recordProvenanceEvent(planModelId, entry.id, {
      at,
      actor:           eventBase.actor,
      changeType:      eventBase.changeType,
      wordsBefore:     0,
      wordsAfter:      countWords(entry.description),
      humanInputWords: eventBase.humanInputWords,
      label:           eventBase.label,
    })
  }
}

/**
 * Diff two SpecBlocks and record 'sharpen' provenance events for every entry
 * that was added or modified by the sharpening round.
 *
 * - Entries only in `after` (new) → wordsBefore = 0
 * - Entries in both but with a changed description → wordsBefore from `before`
 * - Unchanged entries → no event recorded (no noise in the timeline)
 *
 * @param planModelId  The active plan model ID
 * @param before       The spec snapshot immediately before the sharpen round
 * @param after        The refined spec returned by the sharpen AI call
 * @param options      Optional humanInputWords (Q&A answer word count) and label (category name)
 */
export function recordSharpenProvenance(
  planModelId: string,
  before: SpecBlock,
  after: SpecBlock,
  options?: { humanInputWords?: number; label?: string },
): void {
  const at = new Date().toISOString()
  const inputWords = options?.humanInputWords ?? 0
  const label = options?.label

  // Build a map of entryId → description from the before spec for fast lookup
  const beforeDescriptions = new Map<string, string>()
  for (const e of [...before.functions, ...before.values, ...before.solutions] as Array<FEntry | VEntry | SEntry>) {
    beforeDescriptions.set(e.id, e.description)
  }

  const afterEntries = [
    ...after.functions.map((e) => ({ id: e.id, description: e.description })),
    ...after.values.map((e)   => ({ id: e.id, description: e.description })),
    ...after.solutions.map((e) => ({ id: e.id, description: e.description })),
  ]

  for (const entry of afterEntries) {
    const descBefore = beforeDescriptions.get(entry.id) ?? null

    if (descBefore === null) {
      // New entry added by this sharpening round
      recordProvenanceEvent(planModelId, entry.id, {
        at,
        actor:           'ai',
        changeType:      'sharpen',
        wordsBefore:     0,
        wordsAfter:      countWords(entry.description),
        humanInputWords: inputWords,
        label,
      })
    } else if (descBefore !== entry.description) {
      // Existing entry whose description was modified
      recordProvenanceEvent(planModelId, entry.id, {
        at,
        actor:           'ai',
        changeType:      'sharpen',
        wordsBefore:     countWords(descBefore),
        wordsAfter:      countWords(entry.description),
        humanInputWords: inputWords,
        label,
      })
    }
    // Unchanged entries: no event — keeps the timeline clean
  }
}

/**
 * Record human 'edit' provenance for a set of manually changed entries.
 *
 * Called from SpecEditorPanel.vue after a successful draft save.
 * Uses the original (pre-edit) spec for wordsBefore and the working spec
 * for wordsAfter. The human is the author of the new text, so
 * humanInputWords = wordsAfter (they typed every word of the new description).
 *
 * @param planModelId  The active plan model ID
 * @param changedIds   Entry IDs that were edited in this session (from getChangedIds())
 * @param workingSpec  The current (post-edit) working spec
 * @param originalSpec The original spec before any edits were made this session
 */
export function recordEditProvenance(
  planModelId: string,
  changedIds: string[],
  workingSpec: SpecBlock,
  originalSpec: SpecBlock,
): void {
  const at = new Date().toISOString()

  for (const id of changedIds) {
    const descBefore = _entryDescription(id, originalSpec) ?? ''
    const descAfter  = _entryDescription(id, workingSpec) ?? ''

    recordProvenanceEvent(planModelId, id, {
      at,
      actor:           'human',
      changeType:      'edit',
      wordsBefore:     countWords(descBefore),
      wordsAfter:      countWords(descAfter),
      // Human authored the new text → humanInputWords = the output words
      humanInputWords: countWords(descAfter),
    })
  }
}
