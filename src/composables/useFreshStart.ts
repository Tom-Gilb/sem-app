// UNIT_TYPE=Hook
// useFreshStart — helpers for the FreshStartMenu (formerly "Start Over").
//
// 2026-05-14. Tom: *"define start over (looks like a total reset and delete,
// maybe offer some options 1. Blank Canvas, 2. Save This and stop, 3. Cancel
// All Changes [regarding Type of Change], from [Time, like Last hour, this
// session, very beginning] (help me design this)."* — followed by ratification
// renaming "Start Over" → "Fresh Start".
//
// This composable provides:
//   (1) `sessionStartedAt`   — module-level "this session" anchor (ms epoch).
//                              Set at first import (i.e. when the app boots).
//   (2) `countChangesSince(ts, history)` — how many history entries are
//                              newer than `ts`. Used for the "(N changes)"
//                              hint next to each time-bound radio button.
//   (3) `findNearestSnapshotAtOrBefore(ts, history)` — returns the most
//                              recent history entry with timestamp ≤ ts.
//                              The rollback target. Returns null if no
//                              snapshot exists at or before that bound.
//   (4) `formatChangeCount(n)` — pluralisation helper for "1 change" /
//                              "N changes" labels.
//
// All actions on the live spec (clear, restore, snapshot) are owned by
// App.vue; this composable is pure read/compute. App.vue handles the
// emit-handlers (`fresh-canvas`, `save-and-stop`, `rollback`,
// `close-stuck-ui`) inline using its existing functions (`startFresh`,
// `addVersion`, `onHistoryRestore`, `panicReset`).

import type { SpecVersion } from './useSpecHistory'

/**
 * Module-level "this session" anchor. Captured the moment this file is first
 * imported by the running app — which happens at boot via the StartOverMenu /
 * App.vue dependency graph. Stays constant for the lifetime of the tab.
 *
 * Anything in `useSpecHistory.history` whose `timestamp > sessionStartedAt`
 * was created during this browser session.
 */
export const sessionStartedAt: number = Date.now()

/**
 * Count history entries created strictly AFTER `sinceTs`.
 *
 * Used to populate the small grey "(N changes)" hints next to each
 * time-bound radio in the Cancel-Recent-Changes sub-card. Helps the user
 * see the size of the action they're about to take.
 */
export function countChangesSince(
  sinceTs: number,
  history: ReadonlyArray<SpecVersion>,
): number {
  if (sinceTs <= 0) return history.length
  let n = 0
  for (const v of history) {
    if (v.timestamp > sinceTs) n++
  }
  return n
}

/**
 * Find the most recent history snapshot at or before `ts`. Returns null if
 * no snapshot exists at or before that moment.
 *
 * Rollback target rule: choose the LATEST snapshot whose timestamp ≤ ts.
 * That way "Roll back to last hour" maps to "the most recent snapshot from
 * before the last-hour bound began" — i.e. the spec state at the start of
 * that window.
 *
 * Why ≤ (not <): a snapshot exactly at the boundary is correctly counted
 * as "before or at" the boundary, so it qualifies as a rollback target.
 */
export function findNearestSnapshotAtOrBefore(
  ts: number,
  history: ReadonlyArray<SpecVersion>,
): SpecVersion | null {
  let best: SpecVersion | null = null
  for (const v of history) {
    if (v.timestamp <= ts) {
      if (!best || v.timestamp > best.timestamp) {
        best = v
      }
    }
  }
  return best
}

/** "1 change" / "0 changes" / "N changes". */
export function formatChangeCount(n: number): string {
  return n === 1 ? '1 change' : `${n} changes`
}

/**
 * Format a timestamp as "14 May 09:42" — used in the auto-snapshot label
 * "Pre-rollback at 14 May 09:42" so the user can identify and restore the
 * backup copy later from Spec History.
 */
export function formatBackupTimestamp(ts: number): string {
  const d = new Date(ts)
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${day} ${month} ${h}:${m}`
}
