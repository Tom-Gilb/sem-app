// UNIT_TYPE=Hook
// useSpecRenderModel — Phase A skeleton (r41 v186, Tom Gilb 2026-06-19).
//
// Tom Gilb 2026-06-17 verbatim: "cant u just copy whats on the screen?
// having 2 versions seems to invite differences, and there will be changes
// in future".
//
// Background: SpecOutput.vue's Vue template and useColorfulSpecHtml.ts's
// email renderer are PARALLEL IMPLEMENTATIONS of the same Planguage
// rendering logic.  Every time a field is added / relabelled / hidden, the
// two implementations drift and Tom hits a "the email is missing the
// Description field" or "the email has different Source colours from the
// screen" bug.  Six rounds of patches against the same root cause across
// v85 / v98 / v102 / v103 / v104 / v105 / v106 / v107 / v108.
//
// FIX (Phase A — this file): one pure-data composable that builds a typed
// SpecRenderModel from a SpecBlock.  ONE place that decides:
//   - which fields render
//   - in what order
//   - with what labels
//   - with what colour stripe
//   - with what `kind` (tag / description / parameter / qualifier / detail)
//   - with their FieldSource provenance
//
// Phase B (next): useColorfulSpecHtml.ts refactored to iterate this model —
//                 per-entry renderers become tiny (walk fields, emit
//                 subFieldRow or entryHeadRow per kind).  All Mail/Keynote
//                 quirks (table-based, inline styles, descender-clip soft-
//                 wrap, bgcolor= attributes) stay localised in the renderer.
//
// Phase C (after B): SpecOutput.vue's per-entry card templates refactored
//                    to iterate the SAME model (`v-for` over `entry.fields`,
//                    dispatching by `kind` to existing Vue+Tailwind
//                    sub-templates).
//
// Net result after all three phases: ONE source of truth for the render
// model.  Adding a new field once and it appears in both the screen card
// and the email export with identical labels, colours, and source stamps.
//
// This file is PURE DATA — no Vue reactivity, no DOM, no inline styles.
// Twin-portable: ports verbatim to Kai's industrial Twin.

import type { SpecBlock, FEntry, VEntry, SEntry, FieldSource } from '../types/spec'

// ─── Render-model types ─────────────────────────────────────────────────────

/** Canonical Planguage entry-type sections that the renderer walks. */
export type SectionType =
  | 'functions'
  | 'values'
  | 'solutions'
  | 'constraints'
  | 'resources'
  | 'stakeholders'

/** Canonical Planguage colour stripes (the 8 colours, used identically by
 *  both the screen and the email renderer).  Hex codes intentionally lifted
 *  from the existing useColorfulSpecHtml.ts so the v186 refactor is a
 *  drop-in. */
export type PlanguageColor =
  | 'violet'    // Value
  | 'green'    // Function
  | 'orange'   // Solution
  | 'red'      // Constraint
  | 'blue'     // Stakeholder
  | 'darkGreen' // Resource
  | 'amber'    // accent
  | 'slate'    // neutral

/** Each field carries a `kind` so the renderers dispatch to the right
 *  sub-template.  This is the seam that lets Vue and HTML share a model
 *  while keeping their target-specific markup distinct. */
export type FieldKind =
  | 'tag'         // entry headline (e.g. `Umbrella.Spec:`)
  | 'description' // short identifying sentence
  | 'param'       // Planguage parameter (Scale, Meter, Tolerable, Goal, Wish, etc.)
  | 'qualifier'   // bracketed [when, where, who] conditions on a scalar level
  | 'detail'      // supplementary info (rationale, notes, source URL)

export interface RenderField {
  /** Stable key — combine with entry.id for v-for :key. */
  key: string
  /** Display label (e.g. "Scale", "Goal", "Definition"). */
  label: string
  /** The value as rendered (already coerced to string). */
  value: string
  /** Field-source provenance for the chip displayed next to the value. */
  source?: FieldSource
  /** Canonical Planguage colour stripe for this row. */
  color: PlanguageColor
  /** Dispatch key — see FieldKind. */
  kind: FieldKind
}

export interface RenderEntry {
  /** Original entry id (FEntry.id / VEntry.id / SEntry.id). */
  id: string
  /** Section the entry lives in. */
  sectionType: SectionType
  /** Section colour (same as fields' default unless overridden). */
  color: PlanguageColor
  /** Ordered field rows. */
  fields: RenderField[]
}

export interface RenderSection {
  /** Section identifier. */
  type: SectionType
  /** Section colour stripe. */
  color: PlanguageColor
  /** Human-readable section heading (e.g. "Function Entries", "Value Entries"). */
  label: string
  /** Ordered entries. */
  entries: RenderEntry[]
}

export interface SpecRenderModel {
  sections: RenderSection[]
}

// ─── Per-section colour map ─────────────────────────────────────────────────

const SECTION_COLOR: Record<SectionType, PlanguageColor> = {
  functions:    'green',
  values:       'violet',
  solutions:    'orange',
  constraints:  'red',
  resources:    'darkGreen',
  stakeholders: 'blue',
}

const SECTION_LABEL: Record<SectionType, string> = {
  functions:    'Function Entries',
  values:       'Value Entries',
  solutions:    'Solution Entries',
  constraints:  'Constraint Entries',
  resources:    'Resource Entries',
  stakeholders: 'Stakeholder Entries',
}

// ─── Field builders per entry type ──────────────────────────────────────────
//
// Each builder is a pure function: entry → RenderField[].  The order in
// which fields appear in the returned array IS the order they render on
// screen AND in the email.  Add / re-order / rename here ONCE and both
// surfaces follow.

function _buildFunctionFields(entry: FEntry): RenderField[] {
  const fields: RenderField[] = []
  if (entry.id) {
    fields.push({ key: 'tag', label: 'Tag', value: entry.id, color: 'green', kind: 'tag' })
  }
  if (entry.description) {
    fields.push({ key: 'desc', label: 'Definition', value: entry.description, color: 'green', kind: 'description' })
  }
  if (entry.successCriteria) {
    fields.push({ key: 'presenceTest', label: 'Presence Test', value: entry.successCriteria, color: 'green', kind: 'param' })
  }
  if (entry.functionOfValue) {
    fields.push({ key: 'functionOfValue', label: 'Function of Value', value: entry.functionOfValue, color: 'amber', kind: 'detail' })
  }
  return fields
}

function _buildValueFields(entry: VEntry): RenderField[] {
  const fields: RenderField[] = []
  if (entry.id) {
    fields.push({ key: 'tag', label: 'Tag', value: entry.id, color: 'violet', kind: 'tag' })
  }
  if (entry.description) {
    fields.push({ key: 'desc', label: 'Ambition Level', value: entry.description, color: 'violet', kind: 'description' })
  }
  if (entry.scale) {
    fields.push({ key: 'scale', label: 'Scale', value: entry.scale, color: 'violet', kind: 'param' })
  }
  if (entry.meter) {
    fields.push({ key: 'meter', label: 'Meter', value: entry.meter, color: 'violet', kind: 'param' })
  }
  if (entry.tolerable) {
    fields.push({ key: 'tolerable', label: 'Tolerable', value: entry.tolerable, color: 'amber', kind: 'param' })
  }
  if (entry.goal) {
    fields.push({ key: 'goal', label: 'Goal', value: entry.goal, color: 'green', kind: 'param' })
  }
  if (entry.valueOfFunction) {
    fields.push({ key: 'valueOfFunction', label: 'Value of Function', value: entry.valueOfFunction, color: 'amber', kind: 'detail' })
  }
  return fields
}

function _buildSolutionFields(entry: SEntry): RenderField[] {
  const fields: RenderField[] = []
  if (entry.id) {
    fields.push({ key: 'tag', label: 'Tag', value: entry.id, color: 'orange', kind: 'tag' })
  }
  if (entry.description) {
    fields.push({ key: 'desc', label: 'Definition', value: entry.description, color: 'orange', kind: 'description' })
  }
  if (entry.impact) {
    fields.push({ key: 'impact', label: 'Impact', value: entry.impact, color: 'orange', kind: 'param' })
  }
  if (entry.function) {
    fields.push({ key: 'function', label: 'Function', value: entry.function, color: 'amber', kind: 'detail' })
  }
  return fields
}

// ─── Public builder ─────────────────────────────────────────────────────────

/** Build the render model from a SpecBlock.  Pure function — no side
 *  effects, no Vue reactivity dependency.  Both the SpecOutput.vue card
 *  template (Phase C) and useColorfulSpecHtml.ts renderer (Phase B) will
 *  iterate this same model. */
export function buildSpecRenderModel(spec: SpecBlock): SpecRenderModel {
  const sections: RenderSection[] = []

  if (spec.functions?.length) {
    sections.push({
      type:    'functions',
      color:   SECTION_COLOR.functions,
      label:   SECTION_LABEL.functions,
      entries: spec.functions.map(f => ({
        id:          f.id,
        sectionType: 'functions',
        color:       SECTION_COLOR.functions,
        fields:      _buildFunctionFields(f),
      })),
    })
  }

  if (spec.values?.length) {
    sections.push({
      type:    'values',
      color:   SECTION_COLOR.values,
      label:   SECTION_LABEL.values,
      entries: spec.values.map(v => ({
        id:          v.id,
        sectionType: 'values',
        color:       SECTION_COLOR.values,
        fields:      _buildValueFields(v),
      })),
    })
  }

  if (spec.solutions?.length) {
    sections.push({
      type:    'solutions',
      color:   SECTION_COLOR.solutions,
      label:   SECTION_LABEL.solutions,
      entries: spec.solutions.map(s => ({
        id:          s.id,
        sectionType: 'solutions',
        color:       SECTION_COLOR.solutions,
        fields:      _buildSolutionFields(s),
      })),
    })
  }

  // Constraints, Resources, Stakeholders — extension points for Phase A.1
  // (next pass; the current SpecBlock.functions/values/solutions covers the
  // three sections that have parallel-implementation drift; the other three
  // section types are added when their renderer surfaces consolidate).

  return { sections }
}

// ─── Convenience accessors for renderers ────────────────────────────────────

/** Find the section for a given type — handy in Vue templates so they can
 *  pluck a single section without iterating. */
export function sectionOf(model: SpecRenderModel, type: SectionType): RenderSection | undefined {
  return model.sections.find(s => s.type === type)
}

/** Count entries across all sections. */
export function entryCount(model: SpecRenderModel): number {
  return model.sections.reduce((sum, s) => sum + s.entries.length, 0)
}
