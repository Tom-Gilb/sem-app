/**
 * useStageNavigation.ts — pure routing logic for the 11-stage Evo planning bar.
 *
 * ARCHITECTURE NOTE (ratified 2026-06-02):
 * The routing decision that was buried inside App.vue handleStageBarNav is now
 * a pure, deterministic function: resolveStageNavAction(). It has zero side
 * effects — same inputs always produce the same output. This makes every code
 * path unit-testable without mounting the full application.
 *
 * App.vue becomes a thin dispatcher: call resolveStageNavAction(), then execute
 * the returned action by calling the appropriate view-transition function.
 *
 * Why this matters: the stage-navigation bug (Next → closing the editor) was
 * caused by logic buried in an imperative switch statement in a 1400-line
 * component. Untestable code is unverifiable code. This extraction ensures
 * every routing path is covered by tests that run before Tom sees the app.
 *
 * Twin portability: StageNavAction is a discriminated union of semantic names,
 * not framework or UI concepts. Kai's team can read this as a state machine
 * specification and implement it in any language or framework.
 *
 * International scale: The 11 stages and routing table are defined once here,
 * not scattered across components. Adding or renaming a stage requires editing
 * exactly one function.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The main-view transition to execute after a stage pill click.
 *
 * 'editor-stay'  — Spec editor is active at stages 1–4; update the breadcrumb
 *                  only — do NOT close the editor by calling goToStage1() which
 *                  chains to _closeAllOverlays(). This is the exact fix for the
 *                  "Next → closes editor" bug (r18, 2026-06-02).
 * 'to-spec'      — Navigate to the spec-entry view (stakes/values/solutions/sharpen).
 * 'to-impact'    — Navigate to the impacts/resources view.
 * 'to-evo'       — Navigate to evo-steps/evo-simulator view.
 * 'to-tasks'     — Navigate to the plan-tasks view.
 * 'to-export'    — Trigger the export view (stage 11).
 * 'stay'         — No main-view change (stage 9 = Study-Act; toast is sufficient).
 */
export type StageNavAction =
  | 'editor-stay'
  | 'to-spec'
  | 'to-impact'
  | 'to-evo'
  | 'to-tasks'
  | 'to-export'
  | 'stay'

/**
 * Advisory toast kind. Non-blocking — the navigation still proceeds; the user
 * is informed about a prerequisite they have not yet completed. null = no toast.
 */
export type StageToastKind = 'spec-missing' | 'steps-missing' | null

/** Result returned by resolveStageNavAction. */
export interface StageNavResult {
  /** The main-view transition to execute (or skip). */
  action: StageNavAction
  /** Advisory toast to show, or null. */
  toast:  StageToastKind
}

// ── Stage map (single source of truth) ───────────────────────────────────────

/**
 * Canonical 11-stage Evo planning-bar routing table.
 * Any change to stage semantics lives HERE — not scattered across components.
 *
 * Source: Tom Gilb's 9-step Evo cycle (EVO 2024 book, ch. 2 p. 19).
 * Sub-cycle 1 (stages 1–5): Planning — Stakeholders, Values, Solutions,
 *   Decompose/Sharpen, Prioritize/Impacts.
 * Sub-cycle 2 (stages 6–9): Value Delivery — Develop, Deliver, Measure, Learn.
 * Stages 10–11: cross-cutting (Resources, Export).
 */
const STAGE_ACTION_MAP: Record<number, StageNavAction> = {
  1:  'to-spec',    // Stakes (Stakeholders)
  2:  'to-spec',    // Values
  3:  'to-spec',    // Solutions
  4:  'to-spec',    // Sharpen / Decompose
  5:  'to-impact',  // Impacts / Prioritize
  6:  'to-evo',     // Evo Steps / Develop
  7:  'to-impact',  // Evo Impact / Deliver — Tom 2026-06-03: stage 7 IS the Impact
                   // Estimation table (V × S). Was 'to-evo' which left the body empty
                   // because the user navigated to Evo Plan stage without re-loading
                   // the plan into view. Stage 7's label "Evo Impact" means "estimate
                   // the value each Evo Step delivers per unit cost" — that's the IET.
  8:  'to-tasks',   // Plan Tasks / Measure
  9:  'stay',       // Study-Act / Learn (no dedicated main-stage; toast guides)
  10: 'to-impact',  // Resources (V/C cost ratios live in impact view)
  11: 'to-export',  // Export Plan
}

// ── Core pure function ────────────────────────────────────────────────────────

/**
 * Resolves which main-view action and advisory toast to show when the user
 * clicks stage `n` in the Evo planning bar.
 *
 * CONTRACT:
 *   - Pure function — no side effects, no Vue reactivity, no DOM.
 *   - Deterministic — same inputs always produce the same output.
 *   - Exhaustive — every valid stage (1–11) is handled; invalid stages → 'stay'.
 *
 * @param n              Stage number (1–11). Out-of-range values resolve to 'stay'.
 * @param specEditorOpen True when SpecEditorPanel is currently mounted + visible.
 * @param hasCurrentSpec True when a spec entry is selected (currentSpec !== null).
 * @param hasEvoSteps    True when at least one Evo Step is confirmed.
 */
export function resolveStageNavAction(
  n:              number,
  specEditorOpen: boolean,
  hasCurrentSpec: boolean,
  hasEvoSteps:    boolean,
): StageNavResult {
  // ── Advisory toast (non-blocking; checked before routing) ──────────────────
  // Precedence: spec-missing over steps-missing (can't have steps without a spec).
  let toast: StageToastKind = null
  if (n >= 2 && !hasCurrentSpec) {
    toast = 'spec-missing'
  } else if (n >= 7 && !hasEvoSteps) {
    toast = 'steps-missing'
  }

  // ── Editor-stay guard ───────────────────────────────────────────────────────
  // When the spec editor is ACTUALLY RENDERING (both specEditorOpen AND hasCurrentSpec,
  // matching the v-if="specEditorOpen && currentSpec" on SpecEditorPanel) and the user
  // navigates within the spec-entry range (stages 1–4), do NOT close the editor.
  // The breadcrumb update (planningStage.value = n) has already happened in App.vue
  // before this function is called — the editor is already showing the correct view.
  //
  // The bug this prevents: stages 1–4 all mapped to goToStage1() which called
  // _closeAllOverlays() → specEditorOpen = false, collapsing the editor mid-workflow.
  if (specEditorOpen && hasCurrentSpec && n >= 1 && n <= 4) {
    return { action: 'editor-stay', toast }
  }

  // ── Stage-to-action map ─────────────────────────────────────────────────────
  const action = STAGE_ACTION_MAP[n] ?? 'stay'
  return { action, toast }
}

// ── Toast message strings (single source of truth for App.vue) ───────────────

/** Human-readable advisory messages keyed by StageToastKind. */
export const STAGE_TOAST_MESSAGES: Record<NonNullable<StageToastKind>, string> = {
  'spec-missing':
    '💡 Add a spec at Stakes first to get the most from later stages — but you can always explore ahead',
  'steps-missing':
    '💡 Define Evo Steps (stage 6) first to measure value impact — but feel free to look ahead',
}
