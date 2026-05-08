// UNIT_TYPE=Types
// EvoStepPlan type definitions — Evo Step 6 (S.Evo6.EvoStepPlannerPrompt)
// Defines the structured output contract for the Evo Step Planner LLM endpoint.

/**
 * A single suggested Evo step derived from a SpecBlock by the Evo planner LLM.
 *
 * Spec: S.Evo6.EvoStepPlannerPrompt
 */
export interface EvoStep {
  /** Short name for the Evo step, e.g. "S.Evo6.EvoStepPlannerBackend" */
  name: string
  /** Plain-language description of what this step delivers */
  description: string
  /** IDs of V. entries this step contributes to, e.g. ["V.EvoStepPlanQuality"] */
  linkedValues: string[]
  /** ID of the S. entry this step implements, e.g. "S.EvoStepPlannerModule" */
  linkedSolution: string
  /** Estimated share of total project effort as an integer 1–100 */
  effortPercent: number
}

/**
 * The complete output of the Evo Step Planner — a ranked list of suggested
 * Evo steps derived from a SpecBlock (F./V./S. JSON input).
 *
 * Spec: S.Evo6.EvoStepPlannerPrompt
 *
 * Output contract:
 *  - steps array has ≥1 entry
 *  - each step has ≥1 linkedValues entry and a non-empty linkedSolution
 *  - steps are ranked: most-valuable first (highest V/C ratio or broadest value coverage)
 *  - effortPercent values are independent estimates (they may not sum to 100)
 */
export interface EvoStepPlan {
  steps: EvoStep[]
}
