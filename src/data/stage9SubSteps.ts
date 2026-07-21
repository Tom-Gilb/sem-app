// UNIT_TYPE=Data
// stage9SubSteps.ts — canonical Stage 9 (Study-Act) sub-step registry.
//
// Stage 9 is the CYCLIC RE-ENTRY stage per Tom Gilb 2026-06-21 Stages-are-Cyclic
// SUPREME: *"the seemingly final Export of the specs is simply an entry into the
// Evo process, of doing Tasks and Evo steps, and updating the real Values and
// costs.  And then modifying the specs."*

export type Stage9SubStepKey = '9.1' | '9.2' | '9.3' | '9.4' | '9.5'

export interface Stage9SubStepDef {
  key:       Stage9SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

export const STAGE9_SUBSTEPS: readonly Stage9SubStepDef[] = [
  { key: '9.1', label: 'Measure Actuals',
    shortHint: 'Record real Value and Cost measurements from the latest Evo Step delivery.',
    longHint:  'Capture the ACTUAL Value impact + Cost consumption from the most recent Evo Step delivery.  Per CE Status parameter — Status is the last-known measured baseline.  This data feeds the Velocity of Learning (Tom Gilb 2026-06-21 quote-worthy: "the purpose is not to achieve initial Value requirements but to learn quickly and often").' },
  { key: '9.2', label: 'Compare to Estimates',
    shortHint: 'Diff actuals against the Stage 4 Estimates (Estimates Version).',
    longHint:  'Compare the measured Actuals against the Estimates Version approved at Stage 4.5.  Where they diverge, the divergence IS the learning — it should drive Stage 4 re-estimation + Stage 5 re-design.' },
  { key: '9.3', label: 'Update Real Values + Costs',
    shortHint: 'Modify the spec at any level per the actual measurements.',
    longHint:  'Per Tom Gilb 2026-06-21 verbatim: "modifying the specs, at any level of architecture or detailed parameters and specs."  Update Value Status fields, Resource budget consumption, Solution mainImpacts — whatever the actuals reveal.  Every modification goes through Universal Undo SUPREME.' },
  { key: '9.4', label: 'Decide Next Cycle',
    shortHint: 'Plan the next Evo Step or pivot/expand the spec based on learnings.',
    longHint:  'Three branches per Stages-are-Cyclic SUPREME: (a) Continue Evo execution — next Evo Step proceeds; (b) Return to Stage 4 — actuals invalidate estimates, re-estimate; (c) Return to Stage 5 — re-design solutions in light of learnings.  Never a dead-end; always cyclic.' },
  { key: '9.5', label: 'Continue / Return',
    shortHint: 'Move to Stage 10 (Resources allocation) OR return to any earlier stage.',
    longHint:  'Advance to Stage 10 (Resources allocation review) when the next Evo Step is ready to be resourced.  OR return to Stage 4 / 5 / 6 / 8 as the learnings dictate.  Per Stages-are-Cyclic SUPREME: "Even the seemingly final Export of the specs is simply an entry into the Evo process" (Tom Gilb, 21 June 2026).' },
] as const
