// UNIT_TYPE=Test
// Feature #141 — useDelphiEstimation composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useDelphiEstimation } from '../useDelphiEstimation'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  values?: Array<{ id: string; scale?: string; description?: string; goal?: string }>
}): SpecBlock {
  return {
    functions: [],
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? '',
      scale: v.scale ?? '',
      meter: '',
      status: '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useDelphiEstimation', () => {
  it('entry count equals V. entry count', () => {
    const block = makeBlock({
      values: [
        { id: 'V.Alpha' },
        { id: 'V.Beta' },
        { id: 'V.Gamma' },
      ],
    })
    const { entries } = useDelphiEstimation([block])
    expect(entries.value).toHaveLength(3)
  })

  it('produces zero entries when no V. blocks', () => {
    const block = makeBlock()
    const { entries } = useDelphiEstimation([block])
    expect(entries.value).toHaveLength(0)
  })

  it('all rounds are null initially', () => {
    const block = makeBlock({ values: [{ id: 'V.Speed' }] })
    const { entries } = useDelphiEstimation([block])
    const entry = entries.value[0]
    expect(entry.round1).toBeNull()
    expect(entry.round2).toBeNull()
    expect(entry.round3).toBeNull()
  })

  it('consensus is null initially', () => {
    const block = makeBlock({ values: [{ id: 'V.Accuracy' }] })
    const { entries } = useDelphiEstimation([block])
    expect(entries.value[0].consensus).toBeNull()
  })

  it('entry id matches V. entry id', () => {
    const block = makeBlock({ values: [{ id: 'V.Alpha' }] })
    const { entries } = useDelphiEstimation([block])
    expect(entries.value[0].id).toBe('V.Alpha')
  })

  it('unit defaults to "units" when scale is empty', () => {
    const block = makeBlock({ values: [{ id: 'V.Speed', scale: '' }] })
    const { entries } = useDelphiEstimation([block])
    expect(entries.value[0].unit).toBe('units')
  })

  it('submitRound sets round1 value when currentRound is 1', () => {
    const block = makeBlock({ values: [{ id: 'V.Alpha' }] })
    const { entries, submitRound } = useDelphiEstimation([block])
    submitRound('V.Alpha', 42)
    expect(entries.value[0].round1).toBe(42)
  })

  it('submitRound sets round2 value after advanceRound', () => {
    const block = makeBlock({ values: [{ id: 'V.Beta' }] })
    const { entries, submitRound, advanceRound } = useDelphiEstimation([block])
    submitRound('V.Beta', 10)
    advanceRound()
    submitRound('V.Beta', 20)
    expect(entries.value[0].round2).toBe(20)
  })

  it('submitRound sets round3 and consensus after advancing to round 3', () => {
    const block = makeBlock({ values: [{ id: 'V.Gamma' }] })
    const { entries, submitRound, advanceRound } = useDelphiEstimation([block])
    submitRound('V.Gamma', 10)
    advanceRound()
    submitRound('V.Gamma', 20)
    advanceRound()
    submitRound('V.Gamma', 30)
    expect(entries.value[0].round3).toBe(30)
    expect(entries.value[0].consensus).toBe(30)
  })

  it('consensus equals round3 value when non-null', () => {
    const block = makeBlock({ values: [{ id: 'V.Delta' }] })
    const { entries, submitRound, advanceRound, consensus } = useDelphiEstimation([block])
    submitRound('V.Delta', 5)
    advanceRound()
    submitRound('V.Delta', 15)
    advanceRound()
    submitRound('V.Delta', 25)
    expect(consensus('V.Delta')).toBe(25)
    expect(entries.value[0].consensus).toBe(25)
  })

  it('advanceRound increments currentRound from 1 to 2', () => {
    const block = makeBlock({ values: [{ id: 'V.Nu' }] })
    const { currentRound, advanceRound } = useDelphiEstimation([block])
    expect(currentRound.value).toBe(1)
    advanceRound()
    expect(currentRound.value).toBe(2)
  })

  it('advanceRound increments currentRound from 2 to 3', () => {
    const block = makeBlock({ values: [{ id: 'V.Xi' }] })
    const { currentRound, advanceRound } = useDelphiEstimation([block])
    advanceRound()
    advanceRound()
    expect(currentRound.value).toBe(3)
  })

  it('advanceRound does not go beyond round 3', () => {
    const block = makeBlock({ values: [{ id: 'V.Omega' }] })
    const { currentRound, advanceRound } = useDelphiEstimation([block])
    advanceRound()
    advanceRound()
    advanceRound() // should stay at 3
    expect(currentRound.value).toBe(3)
  })

  it('copyMarkdown contains all 3 round columns', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({ values: [{ id: 'V.Iota' }] })
    const { copyMarkdown } = useDelphiEstimation([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('Round 1')
    expect(written).toContain('Round 2')
    expect(written).toContain('Round 3')
  })

  it('copyMarkdown contains Consensus column', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({ values: [{ id: 'V.Kappa' }] })
    const { copyMarkdown } = useDelphiEstimation([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('Consensus')
  })

  it('copyMarkdown sets copied to true', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({ values: [{ id: 'V.Lambda' }] })
    const { copyMarkdown, copied } = useDelphiEstimation([block])
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })
})
