// UNIT_TYPE=Utility
// Producer-side source-attribution stamp helper — Tom Gilb 2026-06-20 sweep.
//
// THE PROBLEM (banked diagnosis in pending-requests.md):
// `useColorfulSpecHtml.ts sourcesSummaryRow` AND `SpecOutput.vue` per-field
// `← {{ v.fieldSources[k].source }}` chips are correctly wired, but render
// EMPTY because producers (parsers, importers, AI generators, seed builders,
// editor add-* paths) never attach `source` / `fieldSources` to the entries
// they create.  Renderer-side patches are dead ends — the data is missing at
// the source.
//
// THE FIX:
// Every producer calls `stampEntry(entry, { generator, planName })` BEFORE
// returning the entry to the SpecBlock / contract.  The stamp shape is:
//
//   source       : "<Generator Name> · <Plan/Contract Name> · <YYYY-MM-DD>"
//   sourceType   : 'human' | 'ai' | 'system'
//   fieldSources : { <field>: { source, sourceType, timestamp, tool } } for
//                  every meaningful rendered field of the entry type.
//
// THE RENDERER CONTRACT (verified in useColorfulSpecHtml.ts r41 v110):
// - If `entry.source` is set → renderer shows ONE "Source: ..." chip.
// - If every fieldSources[k].source is identical to entry.source → renderer
//   dedups them out (the sameAsTop check).
// - If fieldSources contain a MIX of provenance → renderer shows per-field
//   chips with pretty labels (Title Case from camelCase).
// - `ambitionLevel[].sourcePerson` is rendered as a separate "Ambition: ..."
//   chip when present (only on VEntry).
//
// THE TYPE CONTRACT:
// - FEntry / VEntry / SEntry / REntry / CEntry / StakeholderEntry now all
//   declare optional `source` / `sourceType` / `fieldSources` fields in
//   `src/types/spec.ts` (2026-06-20 amendment).
// - PlanguageContractEntry mirrors the shape in `src/types/contractTypes.ts`.
// - The helper is generic over the entry type so producers can call it
//   without knowing the concrete shape — the stamp only ADDS fields.
//
// Composes with: Conjunction-of-Technologies SUPREME (source-layer badges
// per finding), No-Silent-Data-Loss SUPREME (silent provenance loss IS
// silent data loss), Both-Surfaces rule (display + export must agree),
// Twin portability (Kai's Twin inherits provenance discipline).

import type { FieldSource } from '../types/spec'

/**
 * Map of entry `type` → ordered list of fields that should carry per-field
 * provenance.  These are the fields the renderer surfaces and the planner
 * cares about — Tag / id are deterministic and not stamped; specOwner /
 * stakeholders / risks / etc. are stamped only when set by the producer.
 */
export const STAMPABLE_FIELDS_BY_TYPE: Record<string, readonly string[]> = {
  Function:    ['presenceTest', 'functionOfValue'],
  Value:       ['scale', 'meter', 'status', 'tolerable', 'goal', 'wish', 'valueOfFunction'],
  Solution:    ['impact', 'function', 'impactsValues', 'impactsCosts'],
  Constraint:  ['scope', 'rationale'],
  Resource:    ['scale', 'meter', 'status', 'tolerable', 'budget', 'ideal'],
  Stakeholder: ['definition', 'needs'],
  // Contract-mode entry types — match PlanguageContractEntry.type values.
  F:           ['presenceTest'],
  V:           ['scale', 'meter', 'goal', 'tolerable', 'wish'],
  C:           ['constraintText'],
  R:           ['scale', 'meter', 'goal', 'tolerable'],
  S:           ['obligatedParty', 'deadline'],
  Task:        ['deadline'],
}

export interface StampOpts {
  /** Generator / producer name — e.g. "SEM Spec Parser", "Penta", "EVO Planner",
   *  "Sample Hotel Plan", "Manual Add", "Maria Agent", "Incorruptible Fix". */
  generator: string
  /** Plan / contract title for context.  Optional but recommended — when
   *  present, the stamp reads "<Generator> · <Plan> · <Date>". */
  planName?: string
  /** 'ai' for LLM output, 'human' for manual edits, 'system' for deterministic
   *  pipelines (importers, parsers without LLM, seed builders). */
  sourceType?: 'human' | 'ai' | 'system'
  /** Specific tool name shown in parentheses next to the source in the
   *  renderer.  Defaults to `generator`. */
  tool?: string
  /** Override stamp fields (rare — by default looked up from entry.type). */
  fields?: readonly string[]
  /** Override the "today" date for deterministic tests.  ISO YYYY-MM-DD. */
  today?: string
  /** Override the ISO timestamp written into each FieldSource. */
  timestamp?: string
  /**
   * r41 v413 (Tom Gilb 2026-07-01) — Source Attribution SUPREME
   * (see memory `rule_source_attribution_for_every_spec_element.md`).
   * Canonical SEM stage / agent / tool where the value was produced.
   * Draws from the canonical stage-id list in the SUPREME rule.
   */
  stage?: string
  /**
   * r41 v413 — the SPECIFIC keywords / phrase / prompt fragment that
   * TRIGGERED this stamp.  For raw-text-sourced values, verbatim source
   * phrase.  For SEM-app-sourced values, the AI suggestion / button label /
   * prompt fragment.
   */
  triggerText?: string
  /**
   * r41 v413 — for raw-text-sourced entries, the citation into the raw
   * text (e.g. clause number, paragraph reference).  Empty for
   * SEM-app-sourced entries.
   */
  paragraphRef?: string
}

/** Build the human-readable Source string used as `entry.source` and
 *  as each `fieldSources[k].source`.
 *
 *  r41 v413 (Tom Gilb 2026-07-01 Source Attribution SUPREME) — the string
 *  now includes TIME as well as date so the planner can audit "when
 *  exactly" the stamp landed.  Format: `<Generator> · <Plan> · <YYYY-MM-DD HH:MM>`.
 */
export function buildSourceText(opts: { generator: string; planName?: string; today?: string; withTime?: boolean }): string {
  const now = new Date()
  const iso = opts.today ?? now.toISOString().slice(0, 10)
  const withTime = opts.withTime !== false
  const hhmm = withTime
    ? ` ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    : ''
  const stamp = `${iso}${hhmm}`
  const parts = [opts.generator.trim(), opts.planName?.trim(), stamp].filter(Boolean) as string[]
  return parts.join(' · ')
}

/**
 * Stamp an entry with entry-level + per-field source attribution.
 * Returns a NEW object (does not mutate input).  Existing fieldSources are
 * preserved; new ones are added only for fields the entry actually has a
 * non-empty value for (avoid stamping empty placeholders).
 *
 * Type-safe over any object with an optional `type` discriminator — works
 * for VEntry / FEntry / SEntry / CEntry / REntry / StakeholderEntry and
 * PlanguageContractEntry without per-type overloads.
 */
export function stampEntry<T extends {
  type?: string
  source?: string
  sourceType?: 'human' | 'ai' | 'system'
  fieldSources?: Record<string, FieldSource>
}>(entry: T, opts: StampOpts): T {
  const sourceText = buildSourceText(opts)
  const sourceType: 'human' | 'ai' | 'system' = opts.sourceType ?? 'ai'
  const timestamp = opts.timestamp ?? new Date().toISOString()
  const tool = opts.tool ?? opts.generator

  const fields: readonly string[] =
    opts.fields ?? STAMPABLE_FIELDS_BY_TYPE[entry.type ?? ''] ?? ['description']

  const e = entry as Record<string, unknown>
  const prev = (entry.fieldSources ?? {}) as Record<string, FieldSource>
  const fieldSources: Record<string, FieldSource> = { ...prev }
  for (const f of fields) {
    const v = e[f]
    const hasValue = typeof v === 'string'
      ? v.trim().length > 0
      : Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null
    if (!hasValue) continue
    if (fieldSources[f]) continue // honour any Source already attached
    // r41 v413 — propagate stage / triggerText / paragraphRef into every
    // FieldSource so the audit trail is complete per Source Attribution
    // SUPREME.  Empty strings dropped to keep the record clean.
    const fs: FieldSource = { source: sourceText, sourceType, timestamp, tool }
    if (opts.stage?.trim())        fs.stage = opts.stage.trim()
    if (opts.triggerText?.trim())  fs.triggerText = opts.triggerText.trim()
    if (opts.paragraphRef?.trim()) fs.paragraphRef = opts.paragraphRef.trim()
    fieldSources[f] = fs
  }

  return {
    ...entry,
    source: entry.source && entry.source.trim() ? entry.source : sourceText,
    sourceType: entry.sourceType ?? sourceType,
    fieldSources,
  }
}

/**
 * Convenience: stamp an array of entries with the same provenance.
 */
export function stampEntries<T extends Parameters<typeof stampEntry>[0]>(
  entries: T[],
  opts: StampOpts,
): T[] {
  return entries.map(e => stampEntry(e, opts) as T)
}

/**
 * Convenience: build a SINGLE FieldSource record (for use when a producer
 * is stamping ONE field, e.g. after a per-field AI rewrite in Penta or
 * Spec Editor).
 */
export function buildFieldSource(opts: StampOpts): FieldSource {
  // r41 v413 — propagate stage / triggerText / paragraphRef per Source
  // Attribution SUPREME.
  const fs: FieldSource = {
    source: buildSourceText(opts),
    sourceType: opts.sourceType ?? 'ai',
    timestamp: opts.timestamp ?? new Date().toISOString(),
    tool: opts.tool ?? opts.generator,
  }
  if (opts.stage?.trim())        fs.stage = opts.stage.trim()
  if (opts.triggerText?.trim())  fs.triggerText = opts.triggerText.trim()
  if (opts.paragraphRef?.trim()) fs.paragraphRef = opts.paragraphRef.trim()
  return fs
}
