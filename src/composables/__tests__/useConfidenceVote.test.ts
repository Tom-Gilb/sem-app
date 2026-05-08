// UNIT_TYPE=Test
// Feature #82 — Tests for useConfidenceVote composable

import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useConfidenceVote, ringArc } from '../useConfidenceVote'
import type { EvoStep } from '../../types/evo-plan'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStep(name: string, effortPercent = 20): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues: ['V.TestValue'],
    linkedSolution: 'S.TestSolution',
    effortPercent,
  }
}

const STEP_ALPHA = makeStep('Alpha')
const STEP_BETA = makeStep('Beta', 30)
const STEP_GAMMA = makeStep('Gamma', 50)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useConfidenceVote', () => {
  // 1. voteRecords initialised with mock votes per step on first summary access
  it('voteRecords are initialised for all steps on first summaries access', () => {
    const steps = ref([STEP_ALPHA, STEP_BETA])
    const { summaries } = useConfidenceVote(steps)
    // Trigger summaries
    const s = summaries.value
    expect(s['Alpha']).toBeDefined()
    expect(s['Beta']).toBeDefined()
  })

  // 2. Each step has 3 initial mock votes
  it('each step has exactly 3 initial mock votes before any user vote', () => {
    const steps = ref([STEP_ALPHA, STEP_GAMMA])
    const { voteRecords, summaries } = useConfidenceVote(steps)
    // Trigger summaries to seed records
    summaries.value
    expect(voteRecords.value['Alpha'].votes).toHaveLength(3)
    expect(voteRecords.value['Gamma'].votes).toHaveLength(3)
  })

  // 3. setUserVote adds a user vote for the step
  it('setUserVote records the user vote in summaries.userVote', () => {
    const steps = ref([STEP_ALPHA])
    const { summaries, setUserVote } = useConfidenceVote(steps)
    expect(summaries.value['Alpha'].userVote).toBeNull()
    setUserVote('Alpha', 4)
    expect(summaries.value['Alpha'].userVote).toBe(4)
  })

  // 4. summaries.avg is mean of all votes to 1 decimal place
  it('summaries.avg is the mean of mock + user votes rounded to 1 decimal', () => {
    const steps = ref([makeStep('Exact')])
    const { voteRecords, summaries, setUserVote } = useConfidenceVote(steps)
    // Force known votes: [3, 4, 5] from mock
    summaries.value  // trigger seed
    voteRecords.value['Exact'].votes = [3, 4, 5]
    setUserVote('Exact', 4)  // allVotes = [3, 4, 5, 4]
    const avg = summaries.value['Exact'].avg
    expect(avg).toBe(4.0)  // (3+4+5+4)/4 = 16/4 = 4.0
  })

  // 5. summaries.tally[i] counts votes of star value i+1
  it('tally correctly counts votes per star value', () => {
    const steps = ref([makeStep('Tally')])
    const { voteRecords, summaries, setUserVote } = useConfidenceVote(steps)
    summaries.value
    voteRecords.value['Tally'].votes = [3, 3, 5]
    setUserVote('Tally', 5)  // allVotes = [3, 3, 5, 5]
    const { tally } = summaries.value['Tally']
    expect(tally[0]).toBe(0)  // 1-star: 0
    expect(tally[1]).toBe(0)  // 2-star: 0
    expect(tally[2]).toBe(2)  // 3-star: 2
    expect(tally[3]).toBe(0)  // 4-star: 0
    expect(tally[4]).toBe(2)  // 5-star: 2
  })

  // 6. hasOutlier true when one vote deviates >1.5 from mean
  it('hasOutlier is true when a vote deviates more than 1.5 from the average', () => {
    const steps = ref([makeStep('Outlier')])
    const { voteRecords, summaries } = useConfidenceVote(steps)
    summaries.value
    // votes: [5, 5, 5] → avg = 5.0; then add vote of 1 → avg = 4.0, |1-4|=3 > 1.5
    voteRecords.value['Outlier'].votes = [5, 5, 5, 1]
    expect(summaries.value['Outlier'].hasOutlier).toBe(true)
  })

  // 7. hasOutlier false when all votes are close
  it('hasOutlier is false when all votes are within 1.5 of the average', () => {
    const steps = ref([makeStep('Close')])
    const { voteRecords, summaries } = useConfidenceVote(steps)
    summaries.value
    // votes: [4, 4, 5] → avg = 4.33; max deviation = |4-4.33|=0.33 and |5-4.33|=0.67, both ≤ 1.5
    voteRecords.value['Close'].votes = [4, 4, 5]
    expect(summaries.value['Close'].hasOutlier).toBe(false)
  })

  // 8. summaries.userVote is null before setUserVote is called
  it('summaries.userVote is null before any vote is cast', () => {
    const steps = ref([STEP_BETA])
    const { summaries } = useConfidenceVote(steps)
    expect(summaries.value['Beta'].userVote).toBeNull()
  })

  // 9. summaries.userVote equals the value passed to setUserVote
  it('summaries.userVote reflects the most recent setUserVote call', () => {
    const steps = ref([STEP_BETA])
    const { summaries, setUserVote } = useConfidenceVote(steps)
    setUserVote('Beta', 3)
    expect(summaries.value['Beta'].userVote).toBe(3)
    setUserVote('Beta', 5)
    expect(summaries.value['Beta'].userVote).toBe(5)
  })

  // 10. avg is between 1 and 5 for any valid vote set
  it('avg is always between 1 and 5 inclusive', () => {
    const steps = ref([STEP_ALPHA, STEP_BETA, STEP_GAMMA])
    const { summaries, setUserVote } = useConfidenceVote(steps)
    setUserVote('Alpha', 1)
    setUserVote('Beta', 5)
    setUserVote('Gamma', 3)
    for (const s of Object.values(summaries.value)) {
      expect(s.avg).toBeGreaterThanOrEqual(1)
      expect(s.avg).toBeLessThanOrEqual(5)
    }
  })

  // 11. mock votes are deterministic (same stepId → same seed)
  it('mock votes are deterministic for the same stepId', () => {
    const steps1 = ref([makeStep('Deterministic')])
    const steps2 = ref([makeStep('Deterministic')])
    const { voteRecords: vr1, summaries: s1 } = useConfidenceVote(steps1)
    const { voteRecords: vr2, summaries: s2 } = useConfidenceVote(steps2)
    s1.value; s2.value
    expect(vr1.value['Deterministic'].votes).toEqual(vr2.value['Deterministic'].votes)
  })

  // 12. tally has exactly 5 elements
  it('tally array always has exactly 5 elements', () => {
    const steps = ref([STEP_ALPHA])
    const { summaries } = useConfidenceVote(steps)
    expect(summaries.value['Alpha'].tally).toHaveLength(5)
  })
})

// ── ringArc helper ────────────────────────────────────────────────────────────

describe('ringArc', () => {
  it('returns emerald colour for avg >= 4', () => {
    const { colour } = ringArc(4.5, 32)
    expect(colour).toBe('#10b981')
  })

  it('returns amber colour for avg 3–3.9', () => {
    const { colour } = ringArc(3.5, 32)
    expect(colour).toBe('#f59e0b')
  })

  it('returns red colour for avg < 3', () => {
    const { colour } = ringArc(2.0, 32)
    expect(colour).toBe('#ef4444')
  })

  it('returns empty d string for avg = 1 (zero fraction)', () => {
    const { d } = ringArc(1, 32)
    expect(d).toBe('')
  })

  it('d string contains SVG arc command A for avg > 1', () => {
    const { d } = ringArc(3, 32)
    expect(d).toContain('A')
  })
})
