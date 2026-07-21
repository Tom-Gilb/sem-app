/**
 * Regression tests — Penta Efficiency cannot-compute guard.
 *
 * Tom Gilb 2026-06-10 (verbatim): "efficiency cannot be 100% when no resources,
 *   a message 'Efficiency cannot be computed. No Resources planned yet.'"
 *
 * BUG (before this fix in usePenta.ts computeEfficiency):
 *   When spec had no Resources, `resourceUtilization` defaulted to 0.5 (the "unknown" fallback).
 *   Combined with `Math.max(resourceUtilization, 0.01)` divide-by-zero guard, this produced
 *   a synthetic efficiency score of 50–100% depending on `valueAchievement`.
 *   The pinwheel centre, header badge, and edit-preview ALL showed misleading high percentages
 *   when there was literally nothing to be efficient about.
 *
 * FIX: explicit `cannotCompute: boolean` + `cannotComputeReason` on PentaEfficiency.
 *   - resourceItems.length === 0       → cannotCompute = true, reason = "No Resources planned yet."
 *   - resourceItems.length > 0 but no Consumed/Budget data → cannotCompute = true, "no Resource Status data"
 *
 * WHAT EACH TEST GUARDS:
 *   1. Empty resources → cannotCompute true with Tom's verbatim message
 *   2. Resources exist but no Consumed/Budget → cannotCompute true with different reason
 *   3. Resources WITH valid Consumed+Budget → cannotCompute false, normal computation runs
 *   4. percentScore is NOT a fake 50-100% in the cannot-compute cases (was the original bug)
 */

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePenta } from '../usePenta'
import type { SpecBlock } from '../../types/spec'

function buildSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    id:        'test-spec',
    name:      'Test Plan',
    summary:   '',
    functions: [],
    values:    [],
    solutions: [],
    constraints: [],
    resources: [],
    stakeholders: [],
    ...overrides,
  } as SpecBlock
}

describe('Penta Efficiency — cannot-compute guard (Tom Gilb 2026-06-10)', () => {

  it('1. Empty resources → cannotCompute true with Tom\'s verbatim message', () => {
    const spec = ref<SpecBlock | null>(buildSpec({
      values: [
        { id: 'V.SearchLatency', description: 'low latency', goal: '100', status: '90' } as never,
      ],
      resources: [],
    }))
    const { pentaModel } = usePenta(spec)
    const eff = pentaModel.value!.efficiency
    expect(eff.cannotCompute).toBe(true)
    expect(eff.cannotComputeReason).toBe('Efficiency cannot be computed. No Resources planned yet.')
  })

  it('2. Resources exist but no Budget on any → cannotCompute true (different reason)', () => {
    // r78: only requires Budget now (not Status). Budget missing on ALL → still cannot-compute.
    const spec = ref<SpecBlock | null>(buildSpec({
      values: [
        { id: 'V.Throughput', description: 'high tps', goal: '1000', status: '900' } as never,
      ],
      resources: [
        { id: 'R.Cloud', description: 'cloud spend' } as never, // no budget
        { id: 'R.Team',  description: 'team capacity' } as never, // ditto
      ],
    }))
    const { pentaModel } = usePenta(spec)
    const eff = pentaModel.value!.efficiency
    expect(eff.cannotCompute).toBe(true)
    expect(eff.cannotComputeReason).toContain('no Budget data')
    expect(eff.cannotComputeReason).toContain('2 Resources planned')
  })

  it('2b. Resources with Budget but NO Status → isProjected true, computes as projection (Tom 2026-06-10 r78)', () => {
    // The bug Tom reported: "I put in money but no recomputation of efficiency".
    // Previously this returned cannotCompute=true. Now: computes with Status defaulted to 0,
    // flagged isProjected=true so UI can show "projected — Status pending" caveat.
    const spec = ref<SpecBlock | null>(buildSpec({
      values: [
        { id: 'V.Throughput', description: 'high tps', goal: '1000', status: '900' } as never,
      ],
      resources: [
        { id: 'R.Cloud', description: 'cloud', budget: '50000' } as never, // budget set, no status
      ],
    }))
    const { pentaModel } = usePenta(spec)
    const eff = pentaModel.value!.efficiency
    expect(eff.cannotCompute).toBe(false)         // efficiency NOW computes
    expect(eff.isProjected).toBe(true)            // but flagged as projected
    expect(eff.projectionNote).toContain('Resource Status pending on 1 of 1')
    // r92b: upper clamp REMOVED ("417 is 417, not ~500"). Now shows actual computed value.
    // val=0.9, res=0 → consumed defaults to 0 → resUtil=0 → clamped to 0.01 → ratio=90 → +8900%
    expect(eff.balancePercent).toBe(8900)
  })

  it('3. Resources WITH valid Consumed+Budget → cannotCompute false, normal computation runs', () => {
    const spec = ref<SpecBlock | null>(buildSpec({
      values: [
        { id: 'V.Quality', description: 'quality', goal: '100', status: '90' } as never,
      ],
      resources: [
        { id: 'R.Budget', description: 'cash', budget: '1000', status: '500' } as never,
      ],
    }))
    const { pentaModel } = usePenta(spec)
    const eff = pentaModel.value!.efficiency
    expect(eff.cannotCompute).toBe(false)
    expect(eff.balancePercent).toBeGreaterThan(0)
    // r83 new signed semantic (Tom 2026-06-10): 0.9 val achievement / 0.5 res utilisation = ratio 1.8
    //   → balancePercent = (1.8 - 1) × 100 = +80 — "you have 80% more resources than you need"
    expect(eff.balancePercent).toBeCloseTo(80, 0)
  })

  it('4. THE BUG REGRESSION — empty resources MUST NOT produce a fake positive score', () => {
    // Before the fix: resourceUtilization defaulted to 0.5, producing a fake positive efficiency.
    // After: balancePercent stays at 0 (placeholder) and cannotCompute=true tells display to ignore it.
    const spec = ref<SpecBlock | null>(buildSpec({
      values: [
        // Status meets Goal exactly → valueAchievement = 1.0
        { id: 'V.Win', description: 'won', goal: '100', status: '100' } as never,
      ],
      resources: [],
    }))
    const { pentaModel } = usePenta(spec)
    const eff = pentaModel.value!.efficiency
    // r83: placeholder is 0, not a fake positive
    expect(eff.balancePercent).toBe(0)
    expect(eff.cannotCompute).toBe(true)
  })

  it('5. Reason field is undefined when cannotCompute is false (no stale message leaking through)', () => {
    const spec = ref<SpecBlock | null>(buildSpec({
      values:    [{ id: 'V.X', description: 'x', goal: '10', status: '8' } as never],
      resources: [{ id: 'R.X', description: 'x', budget: '100', status: '50' } as never],
    }))
    const { pentaModel } = usePenta(spec)
    const eff = pentaModel.value!.efficiency
    expect(eff.cannotCompute).toBe(false)
    expect(eff.cannotComputeReason).toBeUndefined()
  })

})
