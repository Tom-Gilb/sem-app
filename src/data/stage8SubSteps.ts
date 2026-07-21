// UNIT_TYPE=Data
// stage8SubSteps.ts — canonical Stage 8 (Tasks) sub-step registry.

export type Stage8SubStepKey = '8.1' | '8.2' | '8.3' | '8.4'

export interface Stage8SubStepDef {
  key:       Stage8SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

export const STAGE8_SUBSTEPS: readonly Stage8SubStepDef[] = [
  { key: '8.1', label: 'Decompose to Tasks',
    shortHint: 'Break each Evo Step into concrete engineering Tasks.',
    longHint:  'Per Planguage methodology, every Evo Step is implemented through one or more Tasks — concrete engineering activities that produce deliverable results.  AI-assisted decomposition per AI-Max SUPREME; planner reviews + accepts.' },
  { key: '8.2', label: 'Estimate Task Effort',
    shortHint: 'Per-Task effort estimate in hours / days (NOT story points — banned scrum vocab).',
    longHint:  'Per-Task effort estimate in real time units (hours / days).  Story points are BANNED per Banned-Scrum-Vocabulary SUPREME.  Use Conjunction-of-Technologies (Claudian + historical project data) for reality-grounded estimates.' },
  { key: '8.3', label: 'Assign + Sequence',
    shortHint: 'Assign Tasks to people/teams; sequence them within the Evo Step cycle.',
    longHint:  'Assign each Task to the Implementation Responsible (per Solution Parameters SUPREME Tier-2).  Sequence Tasks within the Evo Step cycle so dependencies are respected.' },
  { key: '8.4', label: 'Continue to Stage 9',
    shortHint: 'Advance to Stage 9 (Study-Act).  Cyclic — return anytime as Tasks execute.',
    longHint:  'Advance to Stage 9 Study-Act where actual Task results are measured against the Value Targets they aim to satisfy.  Per Stages-are-Cyclic SUPREME, return to Stage 8 anytime to re-decompose or re-assign as execution reveals new realities.' },
] as const
