// UNIT_TYPE=Data
// stage6SubSteps.ts — canonical Stage 6 (Evo Steps) sub-step registry.

export type Stage6SubStepKey = '6.1' | '6.2' | '6.3' | '6.4' | '6.5'

export interface Stage6SubStepDef {
  key:       Stage6SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

export const STAGE6_SUBSTEPS: readonly Stage6SubStepDef[] = [
  { key: '6.1', label: 'Generate Evo Steps',
    shortHint: 'Click → Claudian AUTO-GENERATES Evo Steps from your Solutions; result appears below + page scrolls to it.',
    longHint:  'Click this sub-step → Claudian (the EvoPlanner) automatically derives Evo Steps from the current Solution Set.  No separate panel to find — clicking 6.1 IS the generation invocation.  Each step packages one or more Solutions into a small, sequentially-independent delivery cycle that can be measured against Value Targets per Stage 9 Study-Act.  Page scrolls to the result; completion announces via toast.' },
  { key: '6.2', label: 'Prioritise',
    shortHint: 'Rank Evo Steps by Value/Cost ratio — VDT prioritisation.',
    longHint:  'Per Planguage VDT (Value Decision Table) methodology, rank Evo Steps by Value impact divided by Resource cost.  Highest V/C ratio steps deliver first.  Composes with Stage 4 Impact Estimation Table.' },
  { key: '6.3', label: 'Sharpen Steps',
    shortHint: 'Refine each step: cycle length, prerequisites, success criteria.',
    longHint:  'Per-step sharpening: cycle length (Day / Week / Month / Quarter — Tom Gilb canonical cadences), prerequisites (other steps that must complete first), success criteria (how do we know this step delivered Value).  Composes with Solution Parameters SUPREME Tier-3 prerequisites field.' },
  { key: '6.4', label: 'Tools and Agents',
    shortHint: 'Optional palette of Tools (Penta, Value Flow) and Agents (Munger, Maria) for Evo planning.',
    longHint:  'Same per-sub-phase toolbox pattern as Stage 4.4 — filtered Tools + Agents appropriate to Evo Step planning.  Use any number of times, any number of cycles.' },
  { key: '6.5', label: 'Confirm Evo Plan',
    shortHint: 'Approve the Evo Plan — creates an Evo Plan Version; advance to Stage 7 (Evo Impact).',
    longHint:  'Approve the Evo Plan as the current Planner-confirmed plan (per the Planner-vs-Owner authority distinction banked v253).  Creates an Evo Plan Version snapshot.  Advance to Stage 7 Evo Impact where actual delivery measurements feed the Study-Act loop.  Per Stages-are-Cyclic SUPREME: return to Stage 6 anytime to re-plan as deliveries reveal new realities.' },
] as const
