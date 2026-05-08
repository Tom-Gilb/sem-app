// UNIT_TYPE=Hook
// useBullock — Bullock: Audit trail of all changes since a named baseline version.
//
// Computes a field-level audit table between a chosen baseline SpecVersion and the
// current spec. Each changed field is attributed to either a sharpening category
// (matched against useSharpen's SharpenRound data) or a manual/transform operation
// (Make Ambitious, Lean Plan, Imported, etc.).
//
// Pure utility — no singleton state. Call buildBullockRows() from any component.

import { useSpecDiff } from './useSpecDiff'
import type { SpecVersion } from './useSpecHistory'
import type { SharpenRound } from './useSharpen'
import type { SpecBlock } from '../types/spec'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BullockChangeType = 'sharpen' | 'manual' | 'added' | 'removed'

export interface BullockRow {
  seq:          number
  changeType:   BullockChangeType
  /** Category name (sharpen) or version label (manual), e.g. "Finance" | "Make Ambitious" */
  source:       string
  sourceEmoji:  string
  entryId:      string
  entryType:    'F' | 'V' | 'S'
  /** Field key, e.g. "goal", "description" */
  field:        string
  before:       string
  after:        string
}

// ── Field label map ───────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  description:     'Description',
  successCriteria: 'Success criteria',
  scale:           'Scale',
  meter:           'Meter',
  tolerable:       'Tolerable',
  goal:            'Goal',
  status:          'Status',
  impact:          'Impact',
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Build the flat list of BullockRow objects from:
 *   - baseline  — the SpecVersion snapshot to diff from
 *   - current   — the live SpecBlock (post-sharpening / post-transforms)
 *   - rounds    — all SharpenRound records completed since the baseline
 *
 * Attribution logic:
 *   1. Build an `entryId::field` → SharpenRound map from all completed rounds.
 *      (If a field was touched by multiple rounds, the last round wins.)
 *   2. For each field-level change from diffSpecs(baseline, current):
 *      - oldValue === '(new entry)'  → added by sharpen round (if found) or by transform
 *      - newValue === '(removed)'    → removed (transform or sharpen deletion)
 *      - round found in map          → attributed to that sharpen category
 *      - otherwise                   → attributed to manual/transform
 */
export function buildBullockRows(
  baseline:  SpecVersion,
  current:   SpecBlock,
  rounds:    SharpenRound[],
): BullockRow[] {
  const { diffSpecs } = useSpecDiff()
  const changes = diffSpecs(baseline.spec, current)
  if (changes.length === 0) return []

  // Build attribution map: `entryId::field` → last SharpenRound that touched it
  const sharpenMap = new Map<string, SharpenRound>()
  for (const round of rounds) {
    for (const c of round.changes) {
      const fields = c.status === 'added' ? Object.keys(c.after) : c.changedFields
      for (const f of fields) {
        sharpenMap.set(`${c.id}::${f}`, round)
      }
    }
  }

  const rows: BullockRow[] = []

  for (const fc of changes) {
    const key   = `${fc.entryId}::${fc.field}`
    const round = sharpenMap.get(key)
    const isRemoved = fc.newValue === '(removed)'
    const isAdded   = fc.oldValue === '(new entry)'

    let changeType: BullockChangeType = 'manual'
    let source      = 'Manual edit'
    let sourceEmoji = '✏️'

    if (isRemoved) {
      changeType  = 'removed'
      source      = 'Removed'
      sourceEmoji = '🗑️'
    } else if (round) {
      changeType  = isAdded ? 'added' : 'sharpen'
      source      = round.category.label
      sourceEmoji = round.category.emoji
    } else if (isAdded) {
      changeType  = 'added'
      source      = 'Added'
      sourceEmoji = '➕'
    }

    rows.push({
      seq:         rows.length + 1,
      changeType,
      source,
      sourceEmoji,
      entryId:     fc.entryId,
      entryType:   fc.entryType,
      field:       fc.field,
      before:      fc.oldValue,
      after:       fc.newValue,
    })
  }

  return rows
}

// ── Markdown export ───────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/\|/g, '\\|')
}

/**
 * Serialise the audit rows as a Markdown table suitable for pasting into a
 * design doc, PR description, review ticket, or Obsidian note.
 */
export function bullockToMarkdown(
  rows:     BullockRow[],
  baseline: SpecVersion,
): string {
  const date = new Date(baseline.timestamp).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const sharpenN = rows.filter(r => r.changeType === 'sharpen').length
  const manualN  = rows.filter(r => r.changeType === 'manual').length
  const addedN   = rows.filter(r => r.changeType === 'added').length
  const removedN = rows.filter(r => r.changeType === 'removed').length

  const header = [
    `## Bullock Audit Trail`,
    ``,
    `**Baseline:** ${baseline.label} — ${date}`,
    `**Total changes:** ${rows.length}` +
      (sharpenN ? `  ·  ${sharpenN} sharpened` : '') +
      (manualN  ? `  ·  ${manualN} manual`     : '') +
      (addedN   ? `  ·  ${addedN} added`        : '') +
      (removedN ? `  ·  ${removedN} removed`    : ''),
    ``,
  ]

  const tableHeader = [
    `| # | Type | Source | Entry | Field | Before | After |`,
    `|---|------|--------|-------|-------|--------|-------|`,
  ]

  const tableRows = rows.map(r =>
    `| ${r.seq} | ${r.sourceEmoji} ${r.changeType} | ${esc(r.source)} | ${esc(r.entryId)} | ${esc(fieldLabel(r.field))} | ${esc(r.before)} | ${esc(r.after)} |`
  )

  return [...header, ...tableHeader, ...tableRows].join('\n')
}
