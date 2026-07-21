// UNIT_TYPE=Data
// stage2SubSteps.ts — canonical Stage 2 sub-step registry.
//
// Tom Gilb 2026-06-21 verbatim (full design statement): *"I think we need to
// organize Stage 2 like the others in phases. 2.1 Read in The Planguage
// Specifications, 2.2 Generate Better or additional, or delete, solutions to
// match the Value Targets primarily, within resources and other constraints,
// 2.3 Give Planner opportunity to Sharpen, the entire set of spects, 2.4 Give
// the planner the opportunity to Apply Tools (Like Penta, Multivision, Value
// Flow) and Agents (Like Munger). After zero or more cycles of Tools or
// Agents, allow the option of MOving to the next stage (we can come back here,
// and we can refine with tools and agents at later stages). The purpose of
// coming back here would be to try to get a more refined set of solutions,
// after having done changes later."*
//
// Composes with: Stage-Has-A-Purpose SUPREME (Stage 2 = generate more/better
// Solutions for Values within Resources and Constraints) · Stage 1 sub-step
// pattern (mirrors that visual + navigation language) · Architectural
// Resilience SUPREME (plain data, no Vue reactivity) · Twin portability (port
// verbatim to Kai's app).
//
// IMPORTANT — same Vue 3 `<script setup>` constraint that drove stage1SubSteps.ts
// out of Stage1SubStepStrip.vue: arbitrary top-level `export const` /
// `export type` declarations crash the Vite Vue plugin.  Hence this plain .ts
// data module.

/** Stable key for each Stage 2 sub-step.  Keep in sync with App.vue's
 *  `stage2SubStep` ref.
 *
 *  r41 v404 (Tom Gilb 2026-06-28 verbatim "agents were not a group in the
 *  menu, and pointing to the many buttons above is clumsy. So make sure
 *  agents is a group in the menu"): the old combined "2.4 Tools and Agents"
 *  was split into 2.4 Tools (Penta, Multivision, Value Flow) and 2.5 Agents
 *  (Munger, Heilmeier, Feynman, Elon, Incorruptible, Roles, Auto-DBO) so
 *  the sub-step strip shows Agents as a distinct group + the planner sees
 *  it as a first-class option in YOU CAN. */
export type Stage2SubStepKey = '2.1' | '2.2' | '2.3' | '2.4' | '2.5'

export interface Stage2SubStepDef {
  key:       Stage2SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

/** The five canonical Stage 2 sub-steps.  Tom Gilb 2026-06-21 originally
 *  defined four (2.1-2.4 with combined "Tools and Agents"); v404 split 2.4
 *  per Tom 2026-06-28. */
export const STAGE2_SUBSTEPS: readonly Stage2SubStepDef[] = [
  { key: '2.1', label: 'Read In Specs',
    shortHint: 'Review the existing Planguage Specifications.',
    longHint:  'Bring the current Planguage spec into focus: Values, Functions, Solutions, Constraints, Resources, Stakeholders.  This step is the orient phase — see what is already in the plan before generating or changing Solutions.  The full spec is accessible via the Spec Editor (Solutions tab).' },
  { key: '2.2', label: 'Generate Solutions',
    shortHint: 'Generate better / additional / delete Solutions to match Value Targets.',
    longHint:  'The primary work of Stage 2.  Generate new Solutions, refine existing ones, or delete inadequate ones — driven by the Value Targets (Wish / Goal / Tolerable) and bounded by Resources and Constraints.  Composes with Conjunction-of-Technologies (Claudian + Gilb corpus + Internet) and Solution Parameters SUPREME (the 26-parameter canonical inventory).' },
  { key: '2.3', label: 'Sharpen Spec',
    shortHint: 'Sharpen the entire set of specs (Values, Functions, Solutions, Constraints, Resources).',
    longHint:  'Open the Sharpen modal scoped to the full spec — improve Tags, tighten Descriptions to the parameter-discipline ≤25-word ceiling, fill in missing Tolerable/Goal/Wish levels, add Qualifier Conditions, link Solutions to Values per Tier-1 of the canonical Solution inventory.' },
  { key: '2.4', label: 'Tools',
    shortHint: 'Apply visualisation Tools (Penta, Multivision, Value Flow) to explore the spec.',
    longHint:  'Apply visualisation Tools (Penta, Multivision, Value Flow) to explore the spec from different angles.  Zero or more cycles — the planner decides when enough.  Tools render the spec; they do not critique it.  For analytical critique, see 2.5 Agents.' },
  { key: '2.5', label: 'Agents',
    shortHint: 'Apply analytical Agents (Munger, Heilmeier, Feynman, Elon, Incorruptible, Roles, Auto-DBO) to critique the spec.',
    longHint:  'Apply analytical Agents (Munger, Heilmeier, Feynman, Elon, Incorruptible, Roles, Auto-DBO) to critique the spec from many disciplinary angles.  Each Agent applies a different lens — Munger for analytical rigor (12 prompts), Heilmeier for DARPA Catechism (9 questions), Feynman for honesty (6 lenses), Elon for first-principles, Incorruptible for long-term integrity, Roles for stakeholder coverage, Auto-DBO for design-by-objectives.  Zero or more cycles.  After this, the option to MOVE to Stage 3 (Sharpen) appears.  Returning to Stage 2 later is encouraged — after Evo / Impact / Resources work uncovers new constraints, refine the Solutions here for a better fit.' },
] as const
