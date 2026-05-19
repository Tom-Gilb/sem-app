// UNIT_TYPE=Test
// Tests for useGlobalPriority composable (Feature #201 — Global Priority).
// Covers: per-layer upsert, constraint add/remove, validate (floor / ceiling / order /
// untouchable / free), buildDiff (added / changed / unchanged / set additions),
// applyLayer status transition, layerCounts roll-up, hasAnyApplied, model isolation.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useGlobalPriority,
  extractNumeric,
  buildValueProgress,
  analyseDilemmas,
  seedPlannerConversation,
  type PriorityLayer,
  type Ranking,
  type BudgetState,
} from '../useGlobalPriority'
import type { SpecBlock, VEntry } from '../../types/spec'

/** Build a minimal VEntry stub (only the fields the helpers read). */
function v(id: string, partial: Partial<VEntry> = {}): VEntry {
  return {
    id, type: 'Value', level: 'Stakeholder',
    description: id, scale: '', meter: '',
    status: '', tolerable: '', goal: '', valueOfFunction: '',
    ...partial,
  }
}

function spec(values: VEntry[]): SpecBlock {
  return { functions: [], values, solutions: [] }
}

const MODEL_A = 'gp-test-model-a'
const MODEL_B = 'gp-test-model-b'

/**
 * Wipe localStorage state for the singleton store between tests so each
 * `useGlobalPriority(MODEL_*)` call starts from an empty per-model record set.
 */
function clearAll(): void {
  localStorage.removeItem('sem-global-priority-records')
  // Force the underlying ref to re-read by re-instantiating; but the singleton
  // is module-level, so we directly mutate via upsert/remove APIs after clearing.
  for (const layer of ['stakeholders', 'values-costs-constraints', 'solutions'] as PriorityLayer[]) {
    const a = useGlobalPriority(MODEL_A)
    const b = useGlobalPriority(MODEL_B)
    const ra = a.getLayerRecord(layer)
    const rb = b.getLayerRecord(layer)
    if (ra) a.upsertLayerRecord(layer, { rankings: [], sets: [], constraints: [], status: 'draft', consequenceDiff: [] })
    if (rb) b.upsertLayerRecord(layer, { rankings: [], sets: [], constraints: [], status: 'draft', consequenceDiff: [] })
  }
}

describe('useGlobalPriority', () => {
  beforeEach(() => {
    clearAll()
  })

  // ── upsertLayerRecord ──────────────────────────────────────────────────────

  describe('upsertLayerRecord', () => {
    it('creates a new record on first call for a layer', () => {
      const gp = useGlobalPriority(MODEL_A)
      const rec = gp.upsertLayerRecord('stakeholders', { source: 'Workshop' })
      expect(rec.layer).toBe('stakeholders')
      expect(rec.source).toBe('Workshop')
      expect(rec.status).toBe('draft')
    })

    it('updates the existing record instead of creating a duplicate', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.upsertLayerRecord('stakeholders', { source: 'V1' })
      gp.upsertLayerRecord('stakeholders', { source: 'V2' })
      const all = gp.records.value.filter(r => r.layer === 'stakeholders')
      expect(all).toHaveLength(1)
      expect(all[0].source).toBe('V2')
    })

    it('keeps each layer in its own record', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.upsertLayerRecord('stakeholders', { source: 'A' })
      gp.upsertLayerRecord('solutions', { source: 'B' })
      expect(gp.records.value).toHaveLength(2)
      expect(gp.getLayerRecord('stakeholders')!.source).toBe('A')
      expect(gp.getLayerRecord('solutions')!.source).toBe('B')
    })
  })

  // ── addConstraint / removeConstraint ───────────────────────────────────────

  describe('addConstraint / removeConstraint', () => {
    it('adds a constraint with a generated id', () => {
      const gp = useGlobalPriority(MODEL_A)
      const c = gp.addConstraint('values-costs-constraints', {
        kind: 'ceiling',
        targetIds: ['Values'],
        maxPercent: 60,
        note: 'Avoid value-only optimisation',
      })
      expect(c.id).toBeTruthy()
      expect(gp.getLayerRecord('values-costs-constraints')!.constraints).toHaveLength(1)
    })

    it('removes the named constraint and leaves siblings', () => {
      const gp = useGlobalPriority(MODEL_A)
      const c1 = gp.addConstraint('solutions', { kind: 'free', targetIds: [], note: 'X' })
      const c2 = gp.addConstraint('solutions', { kind: 'free', targetIds: [], note: 'Y' })
      gp.removeConstraint('solutions', c1.id)
      const left = gp.getLayerRecord('solutions')!.constraints
      expect(left).toHaveLength(1)
      expect(left[0].id).toBe(c2.id)
    })
  })

  // ── validate ───────────────────────────────────────────────────────────────

  describe('validate', () => {
    it('returns no violations when no constraints exist', () => {
      const gp = useGlobalPriority(MODEL_A)
      const ranks: Ranking[] = [{ targetId: 'Alice', targetKind: 'stakeholder', rank: 1 }]
      expect(gp.validate('stakeholders', ranks)).toEqual([])
    })

    it('flags a floor violation when weight is below the minimum', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.addConstraint('values-costs-constraints', {
        kind: 'floor', targetIds: ['Values'], minPercent: 30, note: 'Always invest in value',
      })
      const ranks: Ranking[] = [{ targetId: 'Values', targetKind: 'category', rank: 1, weight: 20 }]
      const v = gp.validate('values-costs-constraints', ranks)
      expect(v).toHaveLength(1)
      expect(v[0]).toMatch(/below floor/)
    })

    it('flags a ceiling violation when weight is above the maximum', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.addConstraint('values-costs-constraints', {
        kind: 'ceiling', targetIds: ['Costs'], maxPercent: 40, note: 'Cap costs',
      })
      const ranks: Ranking[] = [{ targetId: 'Costs', targetKind: 'category', rank: 2, weight: 55 }]
      const v = gp.validate('values-costs-constraints', ranks)
      expect(v[0]).toMatch(/exceeds ceiling/)
    })

    it('flags an order violation when A does not rank strictly below B', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.addConstraint('solutions', {
        kind: 'order', targetIds: ['S.Quick', 'S.Strategic'], note: 'Strategic outranks Quick',
      })
      const ranks: Ranking[] = [
        { targetId: 'S.Quick',     targetKind: 'S', rank: 1 },
        { targetId: 'S.Strategic', targetKind: 'S', rank: 2 },
      ]
      const v = gp.validate('solutions', ranks)
      expect(v[0]).toMatch(/must rank strictly BELOW/)
    })

    it('does NOT flag order violation when A is correctly below B', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.addConstraint('solutions', {
        kind: 'order', targetIds: ['S.Quick', 'S.Strategic'], note: '',
      })
      const ranks: Ranking[] = [
        { targetId: 'S.Strategic', targetKind: 'S', rank: 1 },
        { targetId: 'S.Quick',     targetKind: 'S', rank: 2 },
      ]
      expect(gp.validate('solutions', ranks)).toEqual([])
    })

    it('treats untouchable as informational at validate-time (UI enforces)', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.addConstraint('stakeholders', {
        kind: 'untouchable', targetIds: ['CEO'], note: 'Locked',
      })
      const ranks: Ranking[] = [{ targetId: 'CEO', targetKind: 'stakeholder', rank: 5 }]
      // validate() does not flag untouchable — UI lock is what enforces it
      expect(gp.validate('stakeholders', ranks)).toEqual([])
    })

    it('treats free-text constraints as informational (never auto-fails)', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.addConstraint('solutions', {
        kind: 'free', targetIds: [], note: 'Discuss in steering before re-ranking AI work',
      })
      expect(gp.validate('solutions', [])).toEqual([])
    })
  })

  // ── buildDiff ──────────────────────────────────────────────────────────────

  describe('buildDiff', () => {
    it('reports a fresh ranking as before=— after=rank', () => {
      const gp = useGlobalPriority(MODEL_A)
      const diff = gp.buildDiff('stakeholders', [
        { targetId: 'Alice', targetKind: 'stakeholder', rank: 1 },
      ], [])
      expect(diff).toHaveLength(1)
      expect(diff[0]).toMatchObject({ entryId: 'Alice', field: 'rank', before: '—', after: 1 })
    })

    it('reports a rank change between previous applied and new draft', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.applyLayer('stakeholders', [{ targetId: 'Alice', targetKind: 'stakeholder', rank: 3 }], [])
      const diff = gp.buildDiff('stakeholders', [
        { targetId: 'Alice', targetKind: 'stakeholder', rank: 1 },
      ], [])
      expect(diff.find(d => d.entryId === 'Alice' && d.field === 'rank')).toMatchObject({
        before: 3, after: 1,
      })
    })

    it('reports a weight change with % suffix', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.applyLayer('values-costs-constraints', [
        { targetId: 'Values', targetKind: 'category', rank: 1, weight: 33 },
      ], [])
      const diff = gp.buildDiff('values-costs-constraints', [
        { targetId: 'Values', targetKind: 'category', rank: 1, weight: 50 },
      ], [])
      const wd = diff.find(d => d.field === 'weight')!
      expect(wd.before).toBe('33%')
      expect(wd.after).toBe('50%')
    })

    it('emits one row per RankingSet describing its members and shared rank', () => {
      const gp = useGlobalPriority(MODEL_A)
      const diff = gp.buildDiff('solutions', [], [
        { name: 'Frontend bundle', targetIds: ['S.UI', 'S.UX', 'S.A11y'], rank: 2 },
      ])
      expect(diff).toHaveLength(1)
      expect(diff[0].field).toBe('set members')
      expect(String(diff[0].after)).toContain('3 members @ rank 2')
    })
  })

  // ── applyLayer ─────────────────────────────────────────────────────────────

  describe('applyLayer', () => {
    it('flips status to applied and stamps appliedAt', () => {
      const gp = useGlobalPriority(MODEL_A)
      const { record } = gp.applyLayer('solutions', [
        { targetId: 'S.A', targetKind: 'S', rank: 1 },
      ], [])
      expect(record.status).toBe('applied')
      expect(record.appliedAt).toBeTruthy()
    })

    it('persists the consequenceDiff alongside the record', () => {
      const gp = useGlobalPriority(MODEL_A)
      const { record } = gp.applyLayer('solutions', [
        { targetId: 'S.A', targetKind: 'S', rank: 1 },
      ], [])
      expect(record.consequenceDiff).toHaveLength(1)
    })

    it('returns the diff to the caller for UI feedback', () => {
      const gp = useGlobalPriority(MODEL_A)
      const { diff } = gp.applyLayer('solutions', [
        { targetId: 'S.A', targetKind: 'S', rank: 1 },
        { targetId: 'S.B', targetKind: 'S', rank: 2 },
      ], [])
      expect(diff).toHaveLength(2)
    })
  })

  // ── revertLayer ────────────────────────────────────────────────────────────

  describe('revertLayer', () => {
    it('flips status back to reverted and clears appliedAt', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.applyLayer('stakeholders', [{ targetId: 'X', targetKind: 'stakeholder', rank: 1 }], [])
      gp.revertLayer('stakeholders')
      const rec = gp.getLayerRecord('stakeholders')!
      expect(rec.status).toBe('reverted')
      expect(rec.appliedAt).toBeUndefined()
    })

    it('is a no-op when no record exists for the layer', () => {
      const gp = useGlobalPriority(MODEL_A)
      expect(() => gp.revertLayer('solutions')).not.toThrow()
    })
  })

  // ── hasAnyApplied + layerCounts ────────────────────────────────────────────

  describe('hasAnyApplied + layerCounts', () => {
    it('hasAnyApplied is false until at least one layer is applied', () => {
      const gp = useGlobalPriority(MODEL_A)
      gp.upsertLayerRecord('stakeholders', { source: 'draft only' })
      expect(gp.hasAnyApplied.value).toBe(false)
      gp.applyLayer('stakeholders', [{ targetId: 'X', targetKind: 'stakeholder', rank: 1 }], [])
      expect(gp.hasAnyApplied.value).toBe(true)
    })

    it('layerCounts rolls up rankings + constraints + status per layer', () => {
      // Use a distinct model id so prior tests don't pollute the singleton store
      const gp = useGlobalPriority('gp-test-counts-iso')
      gp.applyLayer('solutions', [
        { targetId: 'S.A', targetKind: 'S', rank: 1 },
        { targetId: 'S.B', targetKind: 'S', rank: 2 },
      ], [
        { name: 'Set1', targetIds: ['S.C', 'S.D'], rank: 3 },
      ])
      gp.addConstraint('solutions', { kind: 'free', targetIds: [], note: '' })

      const counts = gp.layerCounts.value
      expect(counts.solutions.ranked).toBe(4) // 2 individuals + 2 set members
      expect(counts.solutions.constraints).toBe(1)
      expect(counts.solutions.status).toBe('applied')
      // Layers with no record present default to 'none'
      expect(counts.stakeholders.status).toBe('none')
    })
  })

  // ── plan model isolation ───────────────────────────────────────────────────

  describe('plan model isolation', () => {
    it('records on MODEL_A do not appear on MODEL_B', () => {
      const a = useGlobalPriority(MODEL_A)
      const b = useGlobalPriority(MODEL_B)
      a.upsertLayerRecord('stakeholders', { source: 'A only' })
      expect(b.getLayerRecord('stakeholders')).toBeNull()
      expect(b.records.value).toHaveLength(0)
    })
  })

  // ── extractNumeric ─────────────────────────────────────────────────────────

  describe('extractNumeric', () => {
    it('returns null for empty / undefined input', () => {
      expect(extractNumeric('')).toBeNull()
      expect(extractNumeric(undefined)).toBeNull()
      expect(extractNumeric(null)).toBeNull()
    })

    it('extracts the first integer or decimal from a Planguage string', () => {
      expect(extractNumeric('Status [2026-Q2] 73 visits/day')).toBe(73)
      expect(extractNumeric('Goal [Launch] 90.5%')).toBe(90.5)
      expect(extractNumeric('Tolerable -10 deg C')).toBe(-10)
    })

    it('returns null when the string holds no number', () => {
      expect(extractNumeric('not measured yet')).toBeNull()
    })
  })

  // ── buildValueProgress ─────────────────────────────────────────────────────

  describe('buildValueProgress', () => {
    it('computes goalAccomplishment = current/goal, clamped to [0,1]', () => {
      const p = buildValueProgress([
        v('V.A', { status: 'Status 50', goal: 'Goal 100' }),
        v('V.B', { status: 'Status 200', goal: 'Goal 100' }), // over-achieved → clamped to 1
      ])
      expect(p[0].goalAccomplishment).toBe(0.5)
      expect(p[1].goalAccomplishment).toBe(1)
    })

    it('returns wishAccomplishment as null when no Wish is set', () => {
      const p = buildValueProgress([v('V.A', { status: 'Status 50', goal: 'Goal 100' })])
      expect(p[0].wishAccomplishment).toBeNull()
    })

    it('computes wishAccomplishment when Wish is present', () => {
      const p = buildValueProgress([
        v('V.A', { status: 'Status 30', goal: 'Goal 100', wish: 'Wish 60' }),
      ])
      expect(p[0].wishAccomplishment).toBe(0.5)
    })

    it('treats missing status as current=0', () => {
      const p = buildValueProgress([v('V.A', { goal: 'Goal 100' })])
      expect(p[0].current).toBe(0)
      expect(p[0].goalAccomplishment).toBe(0)
    })
  })

  // ── analyseDilemmas ────────────────────────────────────────────────────────

  describe('analyseDilemmas', () => {
    const tightBudget: BudgetState = { name: 'Time', initialAmount: 10, remainingAmount: 2, unit: 'wks' } // 20% remaining
    const veryTightBudget: BudgetState = { name: 'Money', initialAmount: 1000, remainingAmount: 100, unit: 'USD' } // 10%
    const looseBudget: BudgetState = { name: 'Time', initialAmount: 10, remainingAmount: 9, unit: 'wks' } // 90%

    it('returns no dilemmas when all values on track and budgets healthy', () => {
      const s = spec([v('V.A', { status: 'Status 95', goal: 'Goal 100' })])
      expect(analyseDilemmas(s, [looseBudget])).toEqual([])
    })

    it('flags value-shortfall when goalAccomplishment < 0.5 AND a budget is tight', () => {
      const s = spec([v('V.A', { status: 'Status 30', goal: 'Goal 100' })])
      const out = analyseDilemmas(s, [tightBudget])
      expect(out.some(d => d.kind === 'value-shortfall' && d.refs.includes('V.A'))).toBe(true)
    })

    it('does NOT flag value-shortfall when budgets are healthy even if value is short', () => {
      const s = spec([v('V.A', { status: 'Status 30', goal: 'Goal 100' })])
      const out = analyseDilemmas(s, [looseBudget])
      expect(out.find(d => d.kind === 'value-shortfall')).toBeUndefined()
    })

    it('flags wish-vs-budget when Wish is set, far from current, and budget is moderately tight', () => {
      const s = spec([v('V.A', { status: 'Status 20', goal: 'Goal 50', wish: 'Wish 100' })])
      const moderate: BudgetState = { name: 'Time', initialAmount: 10, remainingAmount: 4, unit: 'wks' } // 40%
      const out = analyseDilemmas(s, [moderate])
      expect(out.some(d => d.kind === 'wish-vs-budget')).toBe(true)
    })

    it('flags budget-overrun when remaining < 15%', () => {
      const s = spec([v('V.A', { status: 'Status 95', goal: 'Goal 100' })])
      const out = analyseDilemmas(s, [veryTightBudget])
      expect(out.some(d => d.kind === 'budget-overrun' && d.refs.includes('budget:Money'))).toBe(true)
    })

    it('flags rebalance when 2+ values short AND a budget is moderately tight', () => {
      const s = spec([
        v('V.A', { status: 'Status 30', goal: 'Goal 100' }),
        v('V.B', { status: 'Status 25', goal: 'Goal 100' }),
      ])
      const moderate: BudgetState = { name: 'Eng', initialAmount: 10, remainingAmount: 4, unit: 'wks' } // 40%
      const out = analyseDilemmas(s, [moderate])
      expect(out.some(d => d.kind === 'rebalance')).toBe(true)
    })

    it('every dilemma carries options the planner can choose between', () => {
      const s = spec([v('V.A', { status: 'Status 30', goal: 'Goal 100' })])
      const out = analyseDilemmas(s, [tightBudget])
      for (const d of out) {
        expect(d.options.length).toBeGreaterThanOrEqual(2)
        expect(d.title).toBeTruthy()
        expect(d.narrative).toBeTruthy()
      }
    })
  })

  // ── seedPlannerConversation ────────────────────────────────────────────────

  describe('seedPlannerConversation', () => {
    it('returns a no-dilemmas message when nothing is wrong', () => {
      const seed = seedPlannerConversation([], [], [])
      expect(seed).toMatch(/no priority dilemmas/i)
    })

    it('includes value progress lines, budget lines, and dilemma sections', () => {
      const s = spec([v('V.A', { status: 'Status 30', goal: 'Goal 100' })])
      const budgets: BudgetState[] = [{ name: 'Time', initialAmount: 10, remainingAmount: 2, unit: 'wks' }]
      const progress = buildValueProgress(s.values)
      const dilemmas = analyseDilemmas(s, budgets, { progressOverrides: progress })
      const seed = seedPlannerConversation(dilemmas, budgets, progress)
      expect(seed).toMatch(/Value progress/)
      expect(seed).toMatch(/Budgets remaining/)
      expect(seed).toMatch(/Priority dilemmas/)
      expect(seed).toMatch(/V\.A/)
      expect(seed).toMatch(/Time/)
    })

    it('lists every option as a markdown bullet for each dilemma', () => {
      const s = spec([v('V.A', { status: 'Status 30', goal: 'Goal 100' })])
      const budgets: BudgetState[] = [{ name: 'Time', initialAmount: 10, remainingAmount: 2, unit: 'wks' }]
      const progress = buildValueProgress(s.values)
      const dilemmas = analyseDilemmas(s, budgets, { progressOverrides: progress })
      const seed = seedPlannerConversation(dilemmas, budgets, progress)
      // Each dilemma supplies ≥ 2 options → at least that many bullets present
      const bullets = (seed.match(/^- /gm) ?? []).length
      const expected = progress.length + budgets.length + dilemmas.reduce((n, d) => n + d.options.length, 0)
      expect(bullets).toBeGreaterThanOrEqual(expected)
    })
  })
})
