// UNIT_TYPE=Test
// Feature #86 — Tests for useWsjfScorer composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useWsjfScorer } from '../useWsjfScorer'
import type { EvoStep } from '../../types/evo-plan'

// ── Helper ───────────────────────────────────────────────────────────────────

function makeStep(name: string, effortPercent: number): EvoStep {
  return {
    name,
    description: '',
    linkedValues: [],
    linkedSolution: '',
    effortPercent,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWsjfScorer', () => {
  it('initial: wsjfOpen is false', () => {
    const steps = ref<EvoStep[]>([])
    const { wsjfOpen } = useWsjfScorer(steps)
    expect(wsjfOpen.value).toBe(false)
  })

  it('empty steps: wsjfEntries is empty', () => {
    const steps = ref<EvoStep[]>([])
    const { wsjfEntries } = useWsjfScorer(steps)
    expect(wsjfEntries.value).toHaveLength(0)
  })

  it('single step: produces 1 entry with rank 1', () => {
    const steps = ref([makeStep('Setup', 25)])
    const { wsjfEntries } = useWsjfScorer(steps)
    expect(wsjfEntries.value).toHaveLength(1)
    expect(wsjfEntries.value[0].rank).toBe(1)
  })

  it('default CoD is 5 for all steps on initialisation', () => {
    const steps = ref([makeStep('Alpha', 20), makeStep('Beta', 30)])
    const { wsjfEntries } = useWsjfScorer(steps)
    for (const entry of wsjfEntries.value) {
      expect(entry.codInput).toBe(5)
    }
  })

  it('setCod changes the CoD value for a given step', () => {
    const steps = ref([makeStep('Alpha', 20)])
    const { wsjfEntries, setCod } = useWsjfScorer(steps)
    const id = wsjfEntries.value[0].stepId
    setCod(id, 8)
    expect(wsjfEntries.value[0].codInput).toBe(8)
  })

  it('setCod clamps to minimum 1 when given 0', () => {
    const steps = ref([makeStep('Alpha', 20)])
    const { wsjfEntries, setCod } = useWsjfScorer(steps)
    const id = wsjfEntries.value[0].stepId
    setCod(id, 0)
    expect(wsjfEntries.value[0].codInput).toBe(1)
  })

  it('setCod clamps to maximum 10 when given 15', () => {
    const steps = ref([makeStep('Alpha', 20)])
    const { wsjfEntries, setCod } = useWsjfScorer(steps)
    const id = wsjfEntries.value[0].stepId
    setCod(id, 15)
    expect(wsjfEntries.value[0].codInput).toBe(10)
  })

  it('WSJF arithmetic: wsjf = cod / jobDuration rounded to 1 decimal', () => {
    // effortPercent=25 → effortHours = 25/100*160 = 40 → jobDuration = max(40/40, 0.5) = 1.0
    // CoD default = 5 → wsjf = 5 / 1.0 = 5.0
    const steps = ref([makeStep('Alpha', 25)])
    const { wsjfEntries } = useWsjfScorer(steps)
    const entry = wsjfEntries.value[0]
    expect(entry.jobDuration).toBe(1.0)
    expect(entry.wsjf).toBe(5.0)
  })

  it('wsjfEntries sorted descending by WSJF score', () => {
    // Step A: effort 50% → effortHours=80 → jobDuration=2.0, CoD=5 → wsjf=2.5
    // Step B: effort 25% → effortHours=40 → jobDuration=1.0, CoD=5 → wsjf=5.0
    // So B should rank first (higher WSJF)
    const steps = ref([makeStep('LongStep', 50), makeStep('ShortStep', 25)])
    const { wsjfEntries } = useWsjfScorer(steps)
    const wsjfValues = wsjfEntries.value.map(e => e.wsjf)
    expect(wsjfValues[0]).toBeGreaterThanOrEqual(wsjfValues[1])
  })

  it('rank[0] is 1 and rank[1] is 2 for two steps', () => {
    const steps = ref([makeStep('Alpha', 20), makeStep('Beta', 30)])
    const { wsjfEntries } = useWsjfScorer(steps)
    const ranks = wsjfEntries.value.map(e => e.rank)
    expect(ranks).toContain(1)
    expect(ranks).toContain(2)
    // rank 1 has the higher WSJF
    const rankOne = wsjfEntries.value.find(e => e.rank === 1)!
    const rankTwo = wsjfEntries.value.find(e => e.rank === 2)!
    expect(rankOne.wsjf).toBeGreaterThanOrEqual(rankTwo.wsjf)
  })

  it('higher CoD → higher WSJF with same duration', () => {
    // Both steps same effort (25% → duration 1.0), but different CoD
    const steps = ref([makeStep('LowCod', 25), makeStep('HighCod', 25)])
    const { wsjfEntries, setCod } = useWsjfScorer(steps)
    // step-0 → LowCod, step-1 → HighCod (order after sort may differ — use setCod)
    setCod('step-0', 3)
    setCod('step-1', 9)
    const lowEntry = wsjfEntries.value.find(e => e.stepId === 'step-0')!
    const highEntry = wsjfEntries.value.find(e => e.stepId === 'step-1')!
    expect(highEntry.wsjf).toBeGreaterThan(lowEntry.wsjf)
  })

  it('shorter duration → higher WSJF with same CoD', () => {
    // step-0: effort 50% → duration 2.0, step-1: effort 25% → duration 1.0
    // Same CoD (default 5) → step-1 has higher WSJF
    const steps = ref([makeStep('LongStep', 50), makeStep('ShortStep', 25)])
    const { wsjfEntries } = useWsjfScorer(steps)
    const longEntry = wsjfEntries.value.find(e => e.title === 'LongStep')!
    const shortEntry = wsjfEntries.value.find(e => e.title === 'ShortStep')!
    expect(shortEntry.wsjf).toBeGreaterThan(longEntry.wsjf)
  })

  it('copyWsjfTable markdown output contains "| Rank |"', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    const steps = ref([makeStep('Alpha', 25)])
    const { copyWsjfTable } = useWsjfScorer(steps)
    copyWsjfTable()

    expect(writeTextMock).toHaveBeenCalledOnce()
    const output: string = writeTextMock.mock.calls[0][0]
    expect(output).toContain('| Rank |')
  })

  it('jobDuration minimum is 0.5 for zero-effort step', () => {
    // effortPercent=0 triggers fallback: effortHours = (0+1)*8 = 8
    // jobDuration = max(8/40, 0.5) = max(0.2, 0.5) = 0.5
    const steps = ref([makeStep('ZeroEffort', 0)])
    const { wsjfEntries } = useWsjfScorer(steps)
    expect(wsjfEntries.value[0].jobDuration).toBe(0.5)
  })
})
