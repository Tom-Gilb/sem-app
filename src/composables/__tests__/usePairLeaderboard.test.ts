// UNIT_TYPE=Test
// Feature #176 — Tests for usePairLeaderboard composable

import { describe, it, expect, vi } from 'vitest'
import { usePairLeaderboard } from '../usePairLeaderboard'

// Seed helper mirrored from composable for test assertions
function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

const STEPS_4 = [
  { id: 'step-0', title: 'Discovery' },
  { id: 'step-1', title: 'Implementation' },
  { id: 'step-2', title: 'Delivery' },
  { id: 'step-3', title: 'Testing' },
]

const STEPS_WITH_EFFORT = [
  { id: 'step-0', title: 'Alpha', effort: 6 },
  { id: 'step-1', title: 'Beta', effort: 2 },
  { id: 'step-2', title: 'Gamma', effort: 4 },
]

const STEPS_7 = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
  { id: 'd', title: 'D' },
  { id: 'e', title: 'E' },
  { id: 'f', title: 'F' },
  { id: 'g', title: 'G' },
]

describe('usePairLeaderboard', () => {
  // 1 — open defaults to false
  it('open starts false', () => {
    const { open } = usePairLeaderboard(() => STEPS_4)
    expect(open.value).toBe(false)
  })

  // 2 — entries sorted by productivity descending
  it('entries are sorted by productivity descending', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    const productivities = entries.value.map((e) => e.productivity)
    for (let i = 0; i < productivities.length - 1; i++) {
      expect(productivities[i]).toBeGreaterThanOrEqual(productivities[i + 1])
    }
  })

  // 3 — rank 1 has badge 🥇
  it('rank 1 has badge 🥇', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    const rank1 = entries.value.find((e) => e.rank === 1)
    expect(rank1?.badge).toBe('🥇')
  })

  // 4 — rank 2 has badge 🥈
  it('rank 2 has badge 🥈', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    const rank2 = entries.value.find((e) => e.rank === 2)
    expect(rank2?.badge).toBe('🥈')
  })

  // 5 — rank 3 has badge 🥉
  it('rank 3 has badge 🥉', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    const rank3 = entries.value.find((e) => e.rank === 3)
    expect(rank3?.badge).toBe('🥉')
  })

  // 6 — rank 4+ has empty badge
  it('rank 4+ has empty badge string', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    const rank4plus = entries.value.filter((e) => e.rank >= 4)
    for (const e of rank4plus) {
      expect(e.badge).toBe('')
    }
  })

  // 7 — tier: rank 1–3 = 'top'
  it('tier is "top" for rank 1–3', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    const topEntries = entries.value.filter((e) => e.rank <= 3)
    for (const e of topEntries) {
      expect(e.tier).toBe('top')
    }
  })

  // 8 — tier: rank 4–6 = 'mid'
  it('tier is "mid" for rank 4–6', () => {
    const { entries } = usePairLeaderboard(() => STEPS_7)
    const midEntries = entries.value.filter((e) => e.rank >= 4 && e.rank <= 6)
    for (const e of midEntries) {
      expect(e.tier).toBe('mid')
    }
  })

  // 9 — tier: rank 7+ = 'low'
  it('tier is "low" for rank 7+', () => {
    const { entries } = usePairLeaderboard(() => STEPS_7)
    const lowEntries = entries.value.filter((e) => e.rank >= 7)
    for (const e of lowEntries) {
      expect(e.tier).toBe('low')
    }
  })

  // 10 — productivity = effort / complexity (rounded)
  it('productivity equals Math.round(effort / complexity * 10) / 10', () => {
    const { entries } = usePairLeaderboard(() => STEPS_WITH_EFFORT)
    for (const e of entries.value) {
      const expected = Math.round((e.effort / e.complexity) * 10) / 10
      expect(e.productivity).toBe(expected)
    }
  })

  // 11 — topEntry is the rank-1 entry
  it('topEntry is the entry with rank 1', () => {
    const { entries, topEntry } = usePairLeaderboard(() => STEPS_4)
    const rank1 = entries.value.find((e) => e.rank === 1)
    expect(topEntry.value).toEqual(rank1)
  })

  // 12 — empty steps → empty entries
  it('empty steps: entries is empty', () => {
    const { entries } = usePairLeaderboard(() => [])
    expect(entries.value).toHaveLength(0)
  })

  // 13 — empty steps → null topEntry
  it('empty steps: topEntry is null', () => {
    const { topEntry } = usePairLeaderboard(() => [])
    expect(topEntry.value).toBeNull()
  })

  // 14 — effort seeded 1–8 when not provided
  it('effort is seeded to 1–8 when not provided', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    for (const e of entries.value) {
      expect(e.effort).toBeGreaterThanOrEqual(1)
      expect(e.effort).toBeLessThanOrEqual(8)
    }
  })

  // 15 — complexity seeded 1–5
  it('complexity is seeded to 1–5', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    for (const e of entries.value) {
      expect(e.complexity).toBeGreaterThanOrEqual(1)
      expect(e.complexity).toBeLessThanOrEqual(5)
    }
  })

  // 16 — seeding is deterministic
  it('seeding is deterministic: same steps always produce the same entries', () => {
    const { entries: entries1 } = usePairLeaderboard(() => STEPS_4)
    const { entries: entries2 } = usePairLeaderboard(() => STEPS_4)
    expect(entries1.value).toEqual(entries2.value)
  })

  // 17 — copyMarkdown contains "Leaderboard"
  it('copyMarkdown writes markdown containing "Leaderboard"', async () => {
    let clipboardContent = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text
        },
      },
    })
    const { copyMarkdown } = usePairLeaderboard(() => STEPS_4)
    await copyMarkdown()
    expect(clipboardContent).toContain('Leaderboard')
    vi.unstubAllGlobals()
  })

  // 18 — copied starts false
  it('copied starts false', () => {
    const { copied } = usePairLeaderboard(() => STEPS_4)
    expect(copied.value).toBe(false)
  })

  // 19 — effort uses provided value when > 0
  it('effort uses provided value when effort > 0', () => {
    const { entries } = usePairLeaderboard(() => STEPS_WITH_EFFORT)
    // After sorting, find each by stepId
    const alpha = entries.value.find((e) => e.stepId === 'step-0')
    const beta = entries.value.find((e) => e.stepId === 'step-1')
    const gamma = entries.value.find((e) => e.stepId === 'step-2')
    expect(alpha?.effort).toBe(6)
    expect(beta?.effort).toBe(2)
    expect(gamma?.effort).toBe(4)
  })

  // 20 — complexity seeded value matches formula
  it('complexity matches seed(stepId + "complexity", 5) + 1', () => {
    const { entries } = usePairLeaderboard(() => STEPS_4)
    for (const e of entries.value) {
      const expected = seed(e.stepId + 'complexity', 5) + 1
      expect(e.complexity).toBe(expected)
    }
  })
})
