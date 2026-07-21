// UNIT_TYPE=Data
// planningStages.ts — canonical 11-stage SEM planning cycle.
//
// Single source of truth used by:
//   • ValueCounter.vue (renders the stage pill bar at top of every view)
//   • App.vue (Back / Next pin-pair in the breadcrumb row + tip caption)
//
// Why a separate file instead of `export const STAGES` from ValueCounter.vue
// directly: Vue 3 `<script setup>` does NOT allow arbitrary top-level
// `export` declarations — only the bindings it auto-exposes to the template.
// An earlier attempt (r14, 2026-06-03) crashed the Vite Vue plugin with a
// "Importing a module script failed" error. Putting the data in a plain .ts
// module sidesteps the limitation and is also more discoverable.
//
// Future stage-aware navigators / breadcrumbs / agents must import from here
// so a single change to a label, glyph, or stage description propagates to
// every surface that uses the stage list.

import type { PlGlyphType } from '../components/icons/PlTypeIcon.vue'

export interface PlanningStageDef {
  /** Stage number 1–11 — order matches the canonical Evo planning cycle. */
  stage: number
  /** Short label used in the stage pill bar + Back/Next pins. */
  label: string
  /** Planguage type glyph rendered in the stage pill + Back/Next pins. */
  plType: PlGlyphType
  /** Full HoverHint description explaining what this stage is for. */
  title: string
}

export const PLANNING_STAGES: PlanningStageDef[] = [
  { stage: 1,  label: 'Stakes',     plType: 'stakeholder', title: 'Stage 1 · Stakes — Who and what needs results. Identify all stakeholders: people, systems, laws, data. Inanimate stakeholders (GDPR, databases) are equally valid. Their needs define success.' },
  { stage: 2,  label: 'Solutions',  plType: 'solution',    title: 'Stage 2 · Solutions — How we will deliver value. Define candidate designs, strategies, and means that address stakeholder needs. Solutions are evaluated against Values and Constraints.' },
  { stage: 3,  label: 'Sharpen',    plType: 'function',    title: 'Stage 3 · Sharpen — What the system does. Clarify functions — binary capabilities that are either present or absent. Sharpen each to a precise presence test with no thresholds inside.' },
  { stage: 4,  label: 'Impacts',    plType: 'value',       title: 'Stage 4 · Impacts — How well we must perform. Define and quantify values with Scale, Meter, Tolerable, and Goal levels. Each value drives prioritisation by Value divided by Cost.' },
  { stage: 5,  label: 'Refine Attributes', plType: 'constraint', title: 'Stage 5 · Refine Attributes — Re-design (change · delete · add) across four attribute lenses: reduce Resources, gain more Value at the same cost, reduce Risks, relax Constraints + Qualifiers. Exits with a Planner-approved Solution Set. Tom Gilb 2026-06-25.' },
  { stage: 6,  label: 'Evo Steps',  plType: 'evo-step',    title: 'Stage 6 · Evo Steps — Incremental delivery cycles. Each Evo Step delivers measurable stakeholder value. Steps within a stage are sequentially independent — VDT picks freely.' },
  { stage: 7,  label: 'Evo Impact', plType: 'value',       title: 'Stage 7 · Evo Impact — Measure the impact of each Evo Step against Values. Which steps deliver the highest Value divided by Cost? This is the Planguage VDT prioritisation engine.' },
  { stage: 8,  label: 'Tasks',      plType: 'task',        title: 'Stage 8 · Tasks — Concrete work items for each Evo Step. Tasks are the engineering activities that implement solutions and produce deliverable results for stakeholders.' },
  { stage: 9,  label: 'Study-Act',  plType: 'evo-step',    title: 'Stage 9 · Study-Act — Learn from delivery. Measure actual results against Value goals, update the plan. This is the Deming PDSA Study and Act steps applied to Planguage Evo.' },
  { stage: 10, label: 'Resources',  plType: 'resource',    title: 'Stage 10 · Resources — Estimate and allocate resource budgets (R. entries). Review Value/Cost ratios per Evo Step, assign capital and calendar budgets, and confirm all Constraints are respected before Export.' },
  { stage: 11, label: 'Export',     plType: 'constraint',  title: 'Stage 11 · Export — Share and publish the plan. Export the full Planguage specification as a formatted document, coloured HTML table, or JSON for Tom\'s Twin and downstream tools.' },
]
