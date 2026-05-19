// UNIT_TYPE=Types
// EvoStepPlan type definitions — Evo Step 6 (S.Evo6.EvoStepPlannerPrompt)
// Defines the structured output contract for the Evo Step Planner LLM endpoint.

/**
 * A single suggested Evo step derived from a SpecBlock by the Evo planner LLM.
 *
 * Conceptual model (Planguage):
 *  - Tasks     = latent value; work units INSIDE this step. Task completion is a
 *                coordination metric only — NOT stakeholder value delivery.
 *  - EvoStep   = intended value delivery unit; the smallest package of change at
 *                which latent task value becomes potentially active. Whether value
 *                was actually delivered is determined in the Study phase (measuring
 *                V. entry Status vs Goal), not by step or task completion alone.
 *  - Solutions = a step contains "a set of design ideas" (Evo-Step *141) — so it
 *                can draw from one OR MORE Solution entries (linkedSolutions plural).
 *
 * Spec: S.Evo6.EvoStepPlannerPrompt
 */
export interface EvoStep {
  /** Short name for the Evo step, e.g. "S.Evo6.EvoStepPlannerBackend" */
  name: string
  /**
   * Plain-language description of the implementation work this step performs.
   * Describes WHAT IS BEING BUILT — not a claim of value delivery.
   * Value delivery is determined after the Study phase by measuring V. entry Status vs Goal.
   */
  description: string
  /** IDs of V. entries this step is designed to move toward Goal, e.g. ["V.EvoStepPlanQuality"] */
  linkedValues: string[]
  /**
   * IDs of the S. entries whose design ideas this step implements.
   * Plural: a step may draw from more than one Solution (Evo-Step *141: "a set of design ideas").
   * Minimum: one entry. Typically one; multiple when the step spans two solutions simultaneously.
   */
  linkedSolutions: string[]
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
 *  - each step has ≥1 linkedValues entry and ≥1 linkedSolutions entry
 *  - steps are ranked: most-valuable first (highest V/C ratio or broadest value coverage)
 *  - effortPercent values are independent estimates (they may not sum to 100)
 */
export interface EvoStepPlan {
  steps: EvoStep[]
}
