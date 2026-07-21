// UNIT_TYPE=Data
// stage5SubSteps.ts — canonical Stage 5 sub-step registry.
//
// Tom Gilb 2026-06-21 verbatim (full Stage 5 design at memory/rule_stage_5_
// refine_design.md): *"'Re-design' is any change to existing designs, deleting
// current designs, adding new design solutions. At each Step Sub-Phase, the
// Planner will be presented with a toolbox of appropriate tools for each Sub-
// Phase. Hopefully with short advice to guide the choice."* + the 5 sub-phases
// (resources / value / risks / constraint-relaxation / approve).
//
// Composes with: Stage-Has-A-Purpose SUPREME · Stages-are-Cyclic SUPREME ·
// Stage 4 Reasonable Balance SUPREME · Stage 1 + 2 + 4 sub-step patterns ·
// Solution Parameters SUPREME (Tier-1 inventory in 5.5.1 deliverable) ·
// r93jjj Qualifiers SUPREME (5.4 relaxation) · Twin portability.
//
// IMPORTANT — same Vue 3 `<script setup>` constraint: registry lives in plain
// .ts to avoid the Vite Vue plugin crash on top-level `export const`.

/** Stable key for each Stage 5 sub-step.  Keep in sync with App.vue's
 *  `stage5SubStep` ref. */
export type Stage5SubStepKey = '5.1' | '5.2' | '5.3' | '5.4' | '5.5'

export interface Stage5SubStepDef {
  key:       Stage5SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

/** The five canonical Stage 5 sub-steps Tom defined 2026-06-21. */
export const STAGE5_SUBSTEPS: readonly Stage5SubStepDef[] = [
  { key: '5.1', label: 'Reduce Resources',
    shortHint: 'Explore potential resource reductions by re-design.',
    longHint:  'Re-design existing Solutions to consume fewer Resources (cost / time / staff / vendor) for the same or better Value impact.  Re-design = change existing, delete current, add new (Tom Gilb 2026-06-21).  Composes with Solution Parameters SUPREME Tier-2 `costAspects` + `longTermCosts`.' },
  { key: '5.2', label: 'More Value, Same Cost',
    shortHint: 'Re-designs to give more value, and in more value requirements, for about same costs.',
    longHint:  'Find re-designs that deliver MORE Value (higher Impact scores against more Value entries) at approximately the same Resource cost.  This is the Value/Cost ratio improvement lens — composes with Stage 4 Impact Estimation Table.' },
  { key: '5.3', label: 'Reduce Risks',
    shortHint: 'Explore re-designs to reduce risks (failure modes, uncertainty, exposure).',
    longHint:  'Re-design to lower failure-mode exposure.  Composes with Solution Parameters SUPREME Tier-2 `risks` + `sideEffects` fields — every Solution carries declared risks; this sub-step iterates to reduce them.' },
  { key: '5.4', label: 'Relax Constraints',
    shortHint: 'Explore temporary or permanent relaxation of Constraints and Conditions (when/where/who).',
    longHint:  'Explore relaxation, temporary or permanent, of Constraints and Qualifier Conditions (when, where, who, etc.) to give improved overall solution efficiency, or specific solution efficiency.  Composes with r93jjj Qualifiers SUPREME + r93mmm Infinity Trap SUPREME (relaxation must still bound scope to avoid infinite-cost commitments).' },
  { key: '5.5', label: 'Approve Solution Set',
    shortHint: 'Exit Process: approve one set of solutions as the current Planner-approved set; creates Solution Set Version.',
    longHint:  'The Stage 5 exit gate.  THREE internal deliverables: (5.5.1) Solution Set with sources + estimated impacts.  (5.5.2) Changes-List of all other-spec changes implied by this Solution Set — sharpening + additions to Stakeholder / Value / Constraints / Resources.  (5.5.3) Accept-Proceed-to-Stage-6, without revoking the right to return to Stage 5 later.  Approval is PLANNER-level (not Owner-level) per Tom Gilb 2026-06-21 "(by Planner, not necessarily other instances like Owner)".' },
] as const
