// UNIT_TYPE=Composable
// useStageGates — declarative readiness gates for the 11-stage SEM cycle.
//
// Tom Gilb 2026-06-18 verbatim: "I am tired of several times a week having
// to push an example through the stages that skip ahead and do not function.
// Is it not possible you can develop a stages test to check if it moves as
// intended for the simplest of trial cases."
//
// This module solves the "stage advanced silently with empty data" bug class
// by codifying each stage's postcondition — the spec-shape predicate that
// MUST be true for the stage to be considered "done".  Two consumers:
//
//   (1) `stages-walkthrough.test.ts` — vitest CI test that walks a known
//       fixture through all 11 stages and asserts each gate.  If a stage
//       silently produces nothing, the test fails with a clear message
//       naming the broken stage — instead of letting the bug ship to Tom.
//
//   (2) Future runtime use in `App.vue` — `assertStageReady(n, spec)` can
//       be called before any "advance to stage N+1" transition to surface
//       a user-visible "Stage N cannot exit — <reason>" warning.  No more
//       silent skip-ahead.
//
// Each gate is a pure function `(spec) => string | null`:
//   • Returns `null` → the stage's data is present and the next stage can
//     be entered.
//   • Returns a string → the stage is NOT ready; the string is a
//     human-readable reason the test (or the UI warning) will surface.
//
// Adding a new stage condition is one line in `STAGE_GATES`.  No imports
// from Vue, App, or any DOM library — this stays a pure-data module so
// the Twin can port it verbatim.

import type { SpecBlock } from '../types/spec'

/** A gate predicate: returns null if the postcondition is met, else a reason. */
export type GatePredicate = (spec: SpecBlock | null) => string | null

export interface StageGate {
  stage:         number
  label:         string
  /** Optional precondition — "what must be true to ENTER this stage". */
  precondition?: GatePredicate
  /** Postcondition — "what must be true to EXIT this stage / enter next". */
  postcondition: GatePredicate
}

// ── Helper predicates ────────────────────────────────────────────────────────

const _hasSpec = (spec: SpecBlock | null): string | null =>
  spec ? null : 'spec is null (Stage 1 did not produce a SpecBlock)'

const _hasAnyEntry = (spec: SpecBlock | null): string | null => {
  if (!spec) return 'no spec yet'
  const total =
    (spec.functions?.length ?? 0) +
    (spec.values?.length ?? 0) +
    (spec.solutions?.length ?? 0) +
    (spec.constraints?.length ?? 0) +
    (spec.resources?.length ?? 0)
  return total > 0
    ? null
    : 'spec is empty (zero Functions, Values, Solutions, Constraints, and Resources)'
}

const _hasFunctions = (spec: SpecBlock | null): string | null =>
  (spec?.functions?.length ?? 0) > 0
    ? null
    : 'no Functions in the spec — Stage 3 (Sharpen) has nothing to sharpen'

const _hasValues = (spec: SpecBlock | null): string | null =>
  (spec?.values?.length ?? 0) > 0
    ? null
    : 'no Values in the spec — Stage 4 (Impacts) cannot prioritise without quantified Values'

const _hasSolutions = (spec: SpecBlock | null): string | null =>
  (spec?.solutions?.length ?? 0) > 0
    ? null
    : 'no Solutions in the spec — Stage 2 (Solutions) has no candidate designs to display'

const _hasConstraints = (spec: SpecBlock | null): string | null =>
  ((spec?.constraints?.length ?? 0) > 0)
    ? null
    : 'no Constraints in the spec — Stage 5 (Refine) has no hard boundaries to refine'

const _hasResources = (spec: SpecBlock | null): string | null =>
  ((spec?.resources?.length ?? 0) > 0)
    ? null
    : 'no Resources in the spec — Stage 10 (Resources) has no budget allocations to estimate'

// ── The 11 stage gates ──────────────────────────────────────────────────────

export const STAGE_GATES: StageGate[] = [
  {
    stage: 1, label: 'Stakes',
    // Stage 1 exit gate: a SpecBlock exists with at least one entry of any kind.
    // The parse must have produced SOMETHING (not just null, not an empty shell).
    postcondition: _hasAnyEntry,
  },
  {
    stage: 2, label: 'Solutions',
    // Stage 2 exit gate: the spec carries at least one Solution.  An empty
    // Solutions stage is a strong signal that Stage 1 / 2 silently skipped.
    precondition:  _hasSpec,
    postcondition: _hasSolutions,
  },
  {
    stage: 3, label: 'Sharpen',
    // Stage 3 sharpens Functions.  Sharpen with zero Functions is a no-op.
    precondition:  _hasSpec,
    postcondition: _hasFunctions,
  },
  {
    stage: 4, label: 'Impacts',
    // Stage 4 quantifies Values.  Without Values, prioritisation is impossible.
    precondition:  _hasSpec,
    postcondition: _hasValues,
  },
  {
    stage: 5, label: 'Refine Attributes',
    // r41 v379 (Tom Gilb 2026-06-25 "Refine Attributes" generalization) —
    // Stage 5 re-designs across four attribute lenses (resources / value /
    // risks / constraints + qualifiers), not constraints alone.  Postcondition
    // still requires _hasConstraints because the constraint-relaxation lens
    // (5.4) cannot operate against an empty constraint set; the gate label
    // updated to reflect the broader stage scope.
    precondition:  _hasSpec,
    postcondition: _hasConstraints,
  },
  {
    stage: 6, label: 'Evo Steps',
    // Stage 6 derives Evo Steps from Solutions + Values.  Without both,
    // step generation is impossible.  We assert the inputs are present;
    // the step list itself is a runtime artefact outside the SpecBlock.
    precondition:  (spec) => _hasSolutions(spec) ?? _hasValues(spec),
    postcondition: _hasSolutions,
  },
  {
    stage: 7, label: 'Evo Impact',
    precondition:  _hasValues,
    postcondition: _hasValues,
  },
  {
    stage: 8, label: 'Tasks',
    precondition:  _hasSolutions,
    postcondition: _hasSolutions,
  },
  {
    stage: 9, label: 'Study-Act',
    precondition:  _hasValues,
    postcondition: _hasValues,
  },
  {
    stage: 10, label: 'Resources',
    // Stage 10 expects Resource entries.  Tom can defer R. entries; if the
    // spec has zero R. entries the stage cannot estimate budgets.
    precondition:  _hasSpec,
    postcondition: _hasResources,
  },
  {
    stage: 11, label: 'Export',
    // Stage 11 exports the spec.  Re-uses the Stage 1 "any entry" gate so
    // an empty spec cannot be silently exported.
    precondition:  _hasAnyEntry,
    postcondition: _hasAnyEntry,
  },
]

// ── Public API ──────────────────────────────────────────────────────────────

/** Returns null if the named stage's postcondition is met against `spec`; else
 *  a human-readable reason the stage is NOT ready to exit. */
export function checkStageExit(stage: number, spec: SpecBlock | null): string | null {
  const gate = STAGE_GATES.find(g => g.stage === stage)
  if (!gate) return `Unknown stage ${stage}`
  return gate.postcondition(spec)
}

/** Returns null if the named stage's precondition is met against `spec`; else
 *  a human-readable reason the stage is NOT ready to enter. */
export function checkStageEntry(stage: number, spec: SpecBlock | null): string | null {
  const gate = STAGE_GATES.find(g => g.stage === stage)
  if (!gate || !gate.precondition) return null
  return gate.precondition(spec)
}

/** Throws if the stage is not ready to exit.  Use in tests or in runtime
 *  guards where silent advance is a defect. */
export function assertStageReady(stage: number, spec: SpecBlock | null): void {
  const reason = checkStageExit(stage, spec)
  if (reason) {
    throw new Error(`Stage ${stage} (${STAGE_GATES.find(g => g.stage === stage)?.label ?? '?'}) not ready: ${reason}`)
  }
}
