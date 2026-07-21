// UNIT_TYPE=Data
// stage4SubSteps.ts — canonical Stage 4 sub-step registry.
//
// Tom Gilb 2026-06-21 verbatim (full design statement): *"4.1 Planner Looks at
// the Estimates and Evidence, 4.2 Planner Adjusts, individual specs and totally,
// (the entire set of Specs, and their corresponding estimates) 4.3 Planner
// Approves the Estimates (as 'good enough to move on with Planning'). 4.4 Planner
// is Presented with an optional (can ignore and move on) Menu of Tools and Agents
// (Like Penta and Munger) on a Table describing how they might help them analyze
// and improve the spec and the estimates. They should be able to use any number
// of tools any number of times until they choose to 'Move Ahead to Next Stage'.
// They should be able to create new Spec versions, and to revert to previous
// versions, and to Nickname any Versions (as aid to remember purpose of version)
// 4.5 Decision to Move to Next Stage 5 (refining solutions). Retaining the
// possibility of coming back to this stage afterwards."*
//
// Composes with: Stage-Has-A-Purpose SUPREME · Stages-are-Cyclic SUPREME · Stage 1 +
// Stage 2 sub-step patterns · rule_stage_4_impacts_design.md (full design banked
// same day) · Architectural Resilience SUPREME · Twin portability.
//
// IMPORTANT — same Vue 3 `<script setup>` constraint that drove stage1SubSteps.ts +
// stage2SubSteps.ts out of their SFCs: arbitrary top-level `export const`
// declarations crash the Vite Vue plugin.

/** Stable key for each Stage 4 sub-step.  Keep in sync with App.vue's
 *  `stage4SubStep` ref. */
export type Stage4SubStepKey = '4.1' | '4.2' | '4.3' | '4.4' | '4.5'

export interface Stage4SubStepDef {
  key:       Stage4SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

/** The five canonical Stage 4 sub-steps Tom defined 2026-06-21. */
export const STAGE4_SUBSTEPS: readonly Stage4SubStepDef[] = [
  { key: '4.1', label: 'Look at Estimates',
    shortHint: 'Open the Impact Estimation Table and review the existing estimates with their Evidence.',
    longHint:  'Open the IET (Impact Estimation View) and look at every Solution × Value cell with its estimate, Evidence (facts that justify the estimate), Source (URL or searchable source), and Credibility (0.0 to 1.0 per CE book scale).  This step is the orient phase — see what is already estimated before adjusting.' },
  { key: '4.2', label: 'Adjust Estimates',
    shortHint: 'Edit individual cells and the total set; recompute based on changes.',
    longHint:  'Edit individual Solution × Value cells inline AND adjust the entire set of estimates plus the underlying spec entries.  The IET recomputes Value/Cost ratios as you edit.  Where there is no evidence or no estimate, the system auto-creates a conservative assumption (low impact value or high impact resource) with large ± uncertainty.' },
  { key: '4.3', label: 'Approve Estimates',
    shortHint: 'Approve the estimates as "good enough to move on with Planning" — creates an Estimates Version.',
    longHint:  'When the estimates are good enough to proceed, click Approve.  Approval requires identity, date, time, and remarks or caveats.  Approval creates an Estimates Version snapshot for traceability.  "Approval is for the moment, until other data require change" (Tom Gilb 2026-06-21) — composes with Stages-are-Cyclic SUPREME.' },
  { key: '4.4', label: 'Tools and Agents',
    shortHint: 'Optional: apply Tools (Penta) and Agents (Munger) to analyze + improve the spec and estimates.',
    longHint:  'Optional step (can ignore and move on).  Menu of Tools and Agents with a table describing how each helps at this stage.  Apply any number of tools any number of times.  Create new Spec versions, revert to previous versions, Nickname versions (as aid to remember purpose of version).  When done, choose Move Ahead to Next Stage.' },
  { key: '4.5', label: 'Move to Stage 5',
    shortHint: 'Advance to Stage 5 (Refine Constraints).  You can return to Stage 4 anytime.',
    longHint:  'Advance to Stage 5 (Refine).  Per Stages-are-Cyclic SUPREME, the possibility of coming back to Stage 4 is retained — the planner is encouraged to return after later-stage discoveries change the estimate landscape (e.g. Evo execution measures real Values + Costs that contradict the estimates here).' },
] as const
