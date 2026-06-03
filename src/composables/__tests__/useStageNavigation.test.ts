/**
 * useStageNavigation.test.ts — comprehensive tests for resolveStageNavAction.
 *
 * Rationale (Tom Gilb, 2026-06-02): stage-navigation logic must be tested
 * before Tom sees the app — not discovered through manual QA of a live UI.
 * The "Next → closes editor" bug (r18) went undetected because the branching
 * lived in App.vue with zero test coverage. These tests prevent that class of
 * regression by covering every stage, every guard condition, and every edge case.
 *
 * Coverage targets:
 *   • All 11 valid stages × editor states × spec/step presence = 44 combinations
 *   • The editor-stay guard: stages 1–4 when editor+spec active
 *   • The guard NON-firing: stages 1–4 when editor open but spec is null
 *   • The guard NON-firing: stages 5–11 regardless of editor state
 *   • Advisory toasts: spec-missing and steps-missing conditions
 *   • Toast precedence: spec-missing wins over steps-missing
 *   • Stage 1 never shows a toast (it is the starting point)
 *   • Out-of-range inputs: 0, -1, 12, NaN → 'stay'
 */

import { describe, it, expect } from 'vitest'
import {
  resolveStageNavAction,
  STAGE_TOAST_MESSAGES,
  type StageNavAction,
  type StageToastKind,
} from '../useStageNavigation'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shorthand: call with editor closed (default safe state). */
function nav(
  n: number,
  opts: {
    editorOpen?: boolean
    hasSpec?: boolean
    hasSteps?: boolean
  } = {},
) {
  return resolveStageNavAction(
    n,
    opts.editorOpen ?? false,
    opts.hasSpec    ?? true,   // most tests assume a spec exists
    opts.hasSteps   ?? true,   // most tests assume steps exist
  )
}

// ── Section 1: stage-to-action routing (editor closed, full state) ────────────

describe('resolveStageNavAction — routing (editor closed, has spec, has steps)', () => {
  it('stage 1 (Stakes) → to-spec', () => {
    expect(nav(1).action).toBe('to-spec')
  })
  it('stage 2 (Values) → to-spec', () => {
    expect(nav(2).action).toBe('to-spec')
  })
  it('stage 3 (Solutions) → to-spec', () => {
    expect(nav(3).action).toBe('to-spec')
  })
  it('stage 4 (Sharpen) → to-spec', () => {
    expect(nav(4).action).toBe('to-spec')
  })
  it('stage 5 (Impacts) → to-impact', () => {
    expect(nav(5).action).toBe('to-impact')
  })
  it('stage 6 (Evo Steps) → to-evo', () => {
    expect(nav(6).action).toBe('to-evo')
  })
  it('stage 7 (Evo Impact) → to-impact — Tom 2026-06-03: Evo Impact IS the Impact Estimation Table', () => {
    expect(nav(7).action).toBe('to-impact')
  })
  it('stage 8 (Tasks) → to-tasks', () => {
    expect(nav(8).action).toBe('to-tasks')
  })
  it('stage 9 (Study-Act) → stay', () => {
    expect(nav(9).action).toBe('stay')
  })
  it('stage 10 (Resources) → to-impact', () => {
    expect(nav(10).action).toBe('to-impact')
  })
  it('stage 11 (Export) → to-export', () => {
    expect(nav(11).action).toBe('to-export')
  })
})

// ── Section 2: editor-stay guard (the r18 bug regression) ────────────────────

describe('resolveStageNavAction — editor-stay guard (regression: r18 "Next → closes editor")', () => {
  it('stage 1 with editor open + has spec → editor-stay (NOT to-spec)', () => {
    expect(nav(1, { editorOpen: true, hasSpec: true }).action).toBe('editor-stay')
  })
  it('stage 2 with editor open + has spec → editor-stay', () => {
    expect(nav(2, { editorOpen: true, hasSpec: true }).action).toBe('editor-stay')
  })
  it('stage 3 with editor open + has spec → editor-stay', () => {
    expect(nav(3, { editorOpen: true, hasSpec: true }).action).toBe('editor-stay')
  })
  it('stage 4 with editor open + has spec → editor-stay', () => {
    expect(nav(4, { editorOpen: true, hasSpec: true }).action).toBe('editor-stay')
  })

  // Guard requires BOTH specEditorOpen AND hasCurrentSpec (matches v-if on SpecEditorPanel).
  // If spec is null, the editor panel is NOT rendered even if specEditorOpen=true.
  it('stage 1 with editor open but NO spec → to-spec (guard must not fire)', () => {
    expect(nav(1, { editorOpen: true, hasSpec: false }).action).toBe('to-spec')
  })
  it('stage 2 with editor open but NO spec → to-spec (guard must not fire)', () => {
    expect(nav(2, { editorOpen: true, hasSpec: false }).action).toBe('to-spec')
  })
  it('stage 3 with editor open but NO spec → to-spec (guard must not fire)', () => {
    expect(nav(3, { editorOpen: true, hasSpec: false }).action).toBe('to-spec')
  })
  it('stage 4 with editor open but NO spec → to-spec (guard must not fire)', () => {
    expect(nav(4, { editorOpen: true, hasSpec: false }).action).toBe('to-spec')
  })

  // Guard only covers stages 1–4. Stage 5+ must proceed to their own actions
  // even when the editor is technically open (closing the editor is correct for 5+).
  it('stage 5 with editor open + has spec → to-impact (guard does NOT cover stage 5)', () => {
    expect(nav(5, { editorOpen: true, hasSpec: true }).action).toBe('to-impact')
  })
  it('stage 6 with editor open + has spec → to-evo (guard does NOT cover stage 6)', () => {
    expect(nav(6, { editorOpen: true, hasSpec: true }).action).toBe('to-evo')
  })
  it('stage 11 with editor open + has spec → to-export (guard does NOT cover stage 11)', () => {
    expect(nav(11, { editorOpen: true, hasSpec: true }).action).toBe('to-export')
  })

  // Editor closed: guard should never fire, routing proceeds normally.
  it('stage 1 with editor CLOSED + has spec → to-spec (guard requires editorOpen)', () => {
    expect(nav(1, { editorOpen: false, hasSpec: true }).action).toBe('to-spec')
  })
  it('stage 4 with editor CLOSED + has spec → to-spec (guard requires editorOpen)', () => {
    expect(nav(4, { editorOpen: false, hasSpec: true }).action).toBe('to-spec')
  })
})

// ── Section 3: advisory toasts ────────────────────────────────────────────────

describe('resolveStageNavAction — advisory toasts (non-blocking guidance)', () => {
  // Stage 1 is the entry point — never show a warning there.
  it('stage 1, no spec → null toast (stage 1 is always reachable without a spec)', () => {
    expect(nav(1, { hasSpec: false }).toast).toBeNull()
  })

  it('stage 2, no spec → spec-missing toast', () => {
    expect(nav(2, { hasSpec: false }).toast).toBe('spec-missing')
  })
  it('stage 3, no spec → spec-missing toast', () => {
    expect(nav(3, { hasSpec: false }).toast).toBe('spec-missing')
  })
  it('stage 4, no spec → spec-missing toast', () => {
    expect(nav(4, { hasSpec: false }).toast).toBe('spec-missing')
  })
  it('stage 5, no spec → spec-missing toast', () => {
    expect(nav(5, { hasSpec: false }).toast).toBe('spec-missing')
  })
  it('stage 11, no spec → spec-missing toast', () => {
    expect(nav(11, { hasSpec: false }).toast).toBe('spec-missing')
  })

  // steps-missing fires at stage 7+ when steps are absent.
  it('stage 6, has spec, no steps → null (steps-missing only fires at stage 7+)', () => {
    expect(nav(6, { hasSpec: true, hasSteps: false }).toast).toBeNull()
  })
  it('stage 7, has spec, no steps → steps-missing toast', () => {
    expect(nav(7, { hasSpec: true, hasSteps: false }).toast).toBe('steps-missing')
  })
  it('stage 8, has spec, no steps → steps-missing toast', () => {
    expect(nav(8, { hasSpec: true, hasSteps: false }).toast).toBe('steps-missing')
  })
  it('stage 9, has spec, no steps → steps-missing toast', () => {
    expect(nav(9, { hasSpec: true, hasSteps: false }).toast).toBe('steps-missing')
  })
  it('stage 11, has spec, no steps → steps-missing toast', () => {
    expect(nav(11, { hasSpec: true, hasSteps: false }).toast).toBe('steps-missing')
  })

  // Toast precedence: spec-missing wins over steps-missing.
  it('stage 7, no spec, no steps → spec-missing (not steps-missing)', () => {
    expect(nav(7, { hasSpec: false, hasSteps: false }).toast).toBe('spec-missing')
  })
  it('stage 9, no spec, no steps → spec-missing (not steps-missing)', () => {
    expect(nav(9, { hasSpec: false, hasSteps: false }).toast).toBe('spec-missing')
  })

  // No toast when all prerequisites met.
  it('stage 7, has spec, has steps → null toast', () => {
    expect(nav(7, { hasSpec: true, hasSteps: true }).toast).toBeNull()
  })
  it('stage 11, has spec, has steps → null toast', () => {
    expect(nav(11, { hasSpec: true, hasSteps: true }).toast).toBeNull()
  })
})

// ── Section 4: toast + action together (integration of both outputs) ──────────

describe('resolveStageNavAction — toast + action together', () => {
  it('stage 5, no spec: action=to-impact AND toast=spec-missing', () => {
    const { action, toast } = nav(5, { hasSpec: false })
    expect(action).toBe('to-impact')
    expect(toast).toBe('spec-missing')
  })

  it('stage 8, has spec, no steps: action=to-tasks AND toast=steps-missing', () => {
    const { action, toast } = nav(8, { hasSpec: true, hasSteps: false })
    expect(action).toBe('to-tasks')
    expect(toast).toBe('steps-missing')
  })

  it('stage 2, editor open + has spec: action=editor-stay AND toast=null', () => {
    const { action, toast } = nav(2, { editorOpen: true, hasSpec: true })
    expect(action).toBe('editor-stay')
    expect(toast).toBeNull()
  })

  it('stage 3, editor open, has spec, has steps: action=editor-stay AND toast=null', () => {
    const { action, toast } = nav(3, { editorOpen: true, hasSpec: true, hasSteps: true })
    expect(action).toBe('editor-stay')
    expect(toast).toBeNull()
  })
})

// ── Section 5: out-of-range and edge inputs ───────────────────────────────────

describe('resolveStageNavAction — out-of-range / defensive inputs', () => {
  it('stage 0 → stay (no mapping)', () => {
    expect(nav(0).action).toBe('stay')
  })
  it('stage -1 → stay', () => {
    expect(nav(-1).action).toBe('stay')
  })
  it('stage 12 → stay', () => {
    expect(nav(12).action).toBe('stay')
  })
  it('stage 100 → stay', () => {
    expect(nav(100).action).toBe('stay')
  })
  it('NaN → stay', () => {
    expect(nav(NaN).action).toBe('stay')
  })

  // Out-of-range stages produce no toast.
  it('stage 0, no spec → null toast (never warn about out-of-range)', () => {
    // n=0 is < 2, so spec-missing condition not triggered
    expect(nav(0, { hasSpec: false }).toast).toBeNull()
  })
})

// ── Section 6: STAGE_TOAST_MESSAGES integrity ─────────────────────────────────

describe('STAGE_TOAST_MESSAGES — exported message strings', () => {
  it('spec-missing message is non-empty and contains an actionable hint', () => {
    expect(STAGE_TOAST_MESSAGES['spec-missing'].length).toBeGreaterThan(10)
    expect(STAGE_TOAST_MESSAGES['spec-missing']).toContain('Stakes')
  })

  it('steps-missing message is non-empty and references Evo Steps', () => {
    expect(STAGE_TOAST_MESSAGES['steps-missing'].length).toBeGreaterThan(10)
    expect(STAGE_TOAST_MESSAGES['steps-missing']).toContain('Evo Steps')
  })
})

// ── Section 7: action type completeness ──────────────────────────────────────

describe('resolveStageNavAction — exhaustive action coverage', () => {
  // Ensure every StageNavAction value is reachable (no dead code in the map).
  const allActions: StageNavAction[] = [
    'editor-stay', 'to-spec', 'to-impact', 'to-evo', 'to-tasks', 'to-export', 'stay',
  ]

  it('every StageNavAction variant is reachable via some input combination', () => {
    const reached = new Set<StageNavAction>()

    reached.add(nav(1, { editorOpen: true, hasSpec: true }).action)  // editor-stay
    reached.add(nav(1).action)   // to-spec
    reached.add(nav(5).action)   // to-impact
    reached.add(nav(6).action)   // to-evo
    reached.add(nav(8).action)   // to-tasks
    reached.add(nav(11).action)  // to-export
    reached.add(nav(9).action)   // stay

    for (const a of allActions) {
      expect(reached).toContain(a)
    }
  })

  const allToasts: StageToastKind[] = ['spec-missing', 'steps-missing', null]

  it('every StageToastKind variant is reachable', () => {
    const reached = new Set<StageToastKind>()

    reached.add(nav(2, { hasSpec: false }).toast)         // spec-missing
    reached.add(nav(7, { hasSpec: true, hasSteps: false }).toast) // steps-missing
    reached.add(nav(1, { hasSpec: true, hasSteps: true }).toast)  // null

    for (const t of allToasts) {
      expect(reached).toContain(t)
    }
  })
})
