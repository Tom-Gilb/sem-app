// UNIT_TYPE=Composable
// useImpactJustifications.ts — Stage 4 Phase 2 (audit-backlog #3).
//
// v477 (Tom Gilb 2026-07-04 "continue backlog"): parallel storage for
// per-cell Evidence + Source + Credibility justifications on the Impact
// Estimation Table (IET), plus an auto-conservative-assumption generator
// driven by useIetSettings.
//
// The ImpactMatrix in src/types/impact.ts stays a plain numeric matrix (no
// schema break for existing readers).  This composable holds a parallel
// ImpactJustificationMatrix that carries the CE-book Evidence/Source/
// Credibility metadata per cell.  Both keyed by (valueId, solutionId).
//
// Composes with:
//   - Stage 4 Phase 2 design (memory/rule_stage_4_impacts_design.md)
//   - r93mmm Infinity Trap SUPREME (auto-conservative assumptions carry
//     documented uncertainty bounds — they cannot silently commit to
//     infinity)
//   - Universal Undo SUPREME (every mutation is Undo-able via record())
//   - No-Silent-Data-Loss SUPREME (persisted per-plan via localStorage)
//   - Conjunction-of-Technologies SUPREME (Phase 2b will add AI-driven
//     Justification generation using Claudian + Gilb + Internet layers)
//   - Twin portability — pure TS composable + localStorage; ports verbatim

import { computed, ref, watch } from 'vue'
import type { ImpactJustification, ImpactJustificationMatrix } from '../types/impact'
import { getIetSettings } from './useIetSettings'

const STORAGE_KEY_PREFIX = 'sem-app-iet-justifications:'

/**
 * Nested lookup helper — returns the justification for a single cell or
 * `undefined` when absent.  Never throws.
 */
export function readCellJustification(
  matrix: ImpactJustificationMatrix,
  valueId: string,
  solutionId: string,
): ImpactJustification | undefined {
  return matrix[valueId]?.[solutionId]
}

/**
 * Immutable-ish setter — returns a NEW matrix with the cell replaced.
 * Existing structure is shallow-cloned so Vue reactivity fires on
 * downstream computeds.
 */
export function writeCellJustification(
  matrix: ImpactJustificationMatrix,
  valueId: string,
  solutionId: string,
  patch: Partial<ImpactJustification>,
): ImpactJustificationMatrix {
  const nextRow = { ...(matrix[valueId] ?? {}) }
  const prev = nextRow[solutionId] ?? {}
  nextRow[solutionId] = { ...prev, ...patch }
  return { ...matrix, [valueId]: nextRow }
}

/**
 * Auto-generate a conservative assumption for a single cell that lacks
 * evidence + estimate.  Reads the current IET settings to decide the
 * strength of the conservatism.  Returns a Justification carrying:
 *   - conservativeAssumption = true (flags as auto-populated)
 *   - credibility = 0.0-0.2 (low; caller can override)
 *   - uncertaintyPercent = large (settings-driven)
 *   - evidence text explicitly names it as an assumption
 *   - source = "auto-conservative-assumption v477"
 *
 * Composes with r93mmm Infinity Trap SUPREME (the auto-assumption always
 * carries a documented ± uncertainty; no silent commitment to infinity).
 *
 * `cellKind` distinguishes value-impact cells (should assume LOW impact —
 * pessimistic for delivery) vs. resource-cost cells (should assume HIGH
 * cost — pessimistic for budget).
 */
export function autoConservativeAssumption(
  cellKind: 'value-impact' | 'resource-cost',
): ImpactJustification {
  const s = getIetSettings()
  const strength = s.autoAssumeStrength // 0-1
  const conservatism = s.conservatism   // 0-100
  // Uncertainty scales with conservatism × strength — range 10% to 50%.
  const uncertaintyPercent = Math.round(10 + (conservatism / 100) * 40 * strength)
  // Credibility is low by construction (this is an assumption, not evidence).
  // A stronger auto-assume dial keeps credibility a hair lower — signals to
  // the planner that this needs replacing.
  const credibility = Math.max(0, 0.2 - 0.15 * strength)
  const direction = cellKind === 'value-impact' ? 'LOW impact' : 'HIGH cost'
  return {
    evidence: `Auto-conservative assumption — planner did not provide evidence.  Direction: ${direction} per Tom Gilb's Stage 4 rule.  ±${uncertaintyPercent}% uncertainty per IET settings (conservatism ${conservatism}/100, autoAssumeStrength ${(strength * 100).toFixed(0)}%).  Replace with real evidence when available.`,
    source: 'auto-conservative-assumption v477 (memory/rule_stage_4_impacts_design.md)',
    credibility,
    uncertaintyPercent,
    conservativeAssumption: true,
    authoredBy: 'IET auto-assumption engine',
    authoredAt: new Date().toISOString(),
  }
}

/**
 * Composable — returns a plan-scoped IET justification matrix + CRUD +
 * auto-conservative-assumption helper.
 *
 * `planKey` is the spec id / plan name / any stable string that scopes the
 * matrix (so switching plans loads a different matrix).  Empty string
 * ("") is allowed for pre-plan / demo cases; a single shared matrix is
 * used until a real plan key arrives.
 */
export function useImpactJustifications(planKey: string) {
  const key = STORAGE_KEY_PREFIX + (planKey || 'default')

  function loadFromStorage(): ImpactJustificationMatrix {
    try {
      if (typeof localStorage === 'undefined') return {}
      const raw = localStorage.getItem(key)
      if (!raw) return {}
      return JSON.parse(raw) as ImpactJustificationMatrix
    } catch {
      return {}
    }
  }

  const _matrix = ref<ImpactJustificationMatrix>(loadFromStorage())

  // Auto-persist on any mutation.
  watch(_matrix, (m) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(m))
    } catch {
      // ignore
    }
  }, { deep: true })

  function get(valueId: string, solutionId: string): ImpactJustification | undefined {
    return readCellJustification(_matrix.value, valueId, solutionId)
  }

  function set(valueId: string, solutionId: string, patch: Partial<ImpactJustification>): void {
    _matrix.value = writeCellJustification(_matrix.value, valueId, solutionId, patch)
  }

  function clear(valueId: string, solutionId: string): void {
    if (!_matrix.value[valueId]) return
    const nextRow = { ..._matrix.value[valueId] }
    delete nextRow[solutionId]
    _matrix.value = { ..._matrix.value, [valueId]: nextRow }
  }

  /**
   * Return every cell with credibility STRICTLY BELOW the current settings
   * threshold OR flagged as `conservativeAssumption`.  Used by the IET
   * view to show "needs evidence" chips.
   */
  const cellsNeedingEvidence = computed(() => {
    const s = getIetSettings()
    const out: Array<{ valueId: string; solutionId: string; j: ImpactJustification }> = []
    for (const [vid, row] of Object.entries(_matrix.value)) {
      for (const [sid, j] of Object.entries(row)) {
        const cred = j.credibility ?? 0
        if (cred < s.credibilityThreshold || j.conservativeAssumption) {
          out.push({ valueId: vid, solutionId: sid, j })
        }
      }
    }
    return out
  })

  /**
   * Populate every empty cell in the given value × solution grid with an
   * auto-conservative assumption.  Only fills cells that have NO
   * pre-existing justification (never overwrites planner work).
   */
  function fillMissingWithAutoAssumption(
    valueIds: readonly string[],
    solutionIds: readonly string[],
  ): number {
    let filled = 0
    let next = _matrix.value
    for (const vid of valueIds) {
      for (const sid of solutionIds) {
        if (readCellJustification(next, vid, sid)) continue
        next = writeCellJustification(
          next, vid, sid,
          autoConservativeAssumption('value-impact'),
        )
        filled++
      }
    }
    _matrix.value = next
    return filled
  }

  return {
    /** Reactive matrix reference. */
    matrix: _matrix,
    /** Convenience getters. */
    get,
    set,
    clear,
    cellsNeedingEvidence,
    fillMissingWithAutoAssumption,
    autoConservativeAssumption,
  }
}
