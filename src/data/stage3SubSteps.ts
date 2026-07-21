// UNIT_TYPE=Data
// stage3SubSteps.ts — canonical Stage 3 (Sharpen) sub-step registry.
//
// Stage 3 = Sharpen per data/planningStages.ts.  Tom Gilb 2026-06-21 (the
// recurring theme through r41 v243-v253): each stage has sub-phases visible
// at-a-glance per Stage-Has-A-Purpose SUPREME + MOVE Principle.  Stage 3
// sharpens the entire spec — every entry type, every parameter that hasn't
// been refined yet, with AI-assisted suggestions per Conjunction-of-Technologies.
//
// Mirrors the same pattern as Stage 1/2/4/5 sub-step registries.

export type Stage3SubStepKey = '3.1' | '3.2' | '3.3' | '3.4' | '3.5'

export interface Stage3SubStepDef {
  key:       Stage3SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

export const STAGE3_SUBSTEPS: readonly Stage3SubStepDef[] = [
  { key: '3.1', label: 'Inventory Gaps',
    shortHint: 'Plan Health audit — surface which entries need sharpening.',
    longHint:  'Run the Plan Health Indicator audit to surface every defect across F./V./S./C./R./Stakeholder entries.  Lists what needs Mnemonic Tags, what has paragraph-form descriptions (Parameter Discipline SUPREME), missing Tolerable/Goal/Wish, missing Qualifiers (Infinity Trap SUPREME), missing Sources, missing Tier-1 Solution parameters, etc.' },
  { key: '3.2', label: 'Sharpen Entries',
    shortHint: 'AI-assisted sharpening interview per entry type and category.',
    longHint:  'Open the Sharpen modal — picks a category (Value precision / Function presence-test / Solution Tier-1 fields / Constraint binary-rule / Resource budgeting / Stakeholder distinguishing-definition) and runs the interview flow.  Composes with AI-Max SUPREME + Conjunction-of-Technologies SUPREME (Claudian + Gilb-corpus + Internet for evidence).' },
  { key: '3.3', label: 'Add Qualifiers',
    shortHint: 'Bind scalar levels with when/where/who Conditions — escape the Infinity Trap.',
    longHint:  'Per r93jjj Qualifiers SUPREME + r93mmm Infinity Trap SUPREME: every scalar level (Tolerable / Goal / Wish / Survival / Stretch) lacking Qualifiers commits to infinite future time + infinite places + infinite scenarios = infinite costs.  This sub-step bounds them.  Three canonical classes: time / place / event.' },
  { key: '3.4', label: 'Review + Apply',
    shortHint: 'Review sharpening proposals; accept / reject / refine.',
    longHint:  'After AI proposals land, the planner reviews each one.  Per Universal Undo SUPREME every accept is reversible.  Per AI-Max SUPREME every rejection should still capture WHY for future-Claudian learning.' },
  { key: '3.5', label: 'Continue to Stage 4',
    shortHint: 'Advance to Stage 4 (Impacts).  Stages are cyclic — return anytime.',
    longHint:  'Advance to Stage 4 (Impacts) where the planner reaches Reasonable Balance via Evidence-backed Estimates.  Per Stages-are-Cyclic SUPREME, the right to return to Stage 3 is preserved — sharpening is never "done", it cycles with later-stage discoveries.' },
] as const
