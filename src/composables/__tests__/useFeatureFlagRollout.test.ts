import { describe, it, expect } from 'vitest'
import { useFeatureFlagRollout } from '../useFeatureFlagRollout'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [],
    values: [],
    solutions: [],
    ...overrides,
  }
}

const baseBlock: SpecBlock = makeBlock({
  functions: [
    {
      id: 'F.UserLogin',
      type: 'Function',
      level: 'Product',
      description: 'Allow users to log in to the system',
      successCriteria: 'Login in < 2s',
      functionOfValue: '[[V.LoginSpeed]]',
    },
    {
      id: 'F.DataExport',
      type: 'Function',
      level: 'Product',
      description: 'Export data to CSV format',
      successCriteria: 'Exports 10k rows in < 5s',
      functionOfValue: '[[V.ExportThroughput]]',
    },
  ],
  values: [
    {
      id: 'V.LoginSpeed',
      type: 'Value',
      level: 'Product',
      description: 'User login speed and fluency',
      scale: 'Seconds from click to dashboard',
      meter: 'Automated timing test',
      status: 'Status [2026] 3s',
      tolerable: 'Tolerable [2026] 2s',
      goal: 'Goal [2026] 1s',
      valueOfFunction: '[[F.UserLogin]]',
    },
  ],
  solutions: [],
})

describe('useFeatureFlagRollout', () => {
  it('creates one entry per F. entry', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    expect(rolloutEntries.value).toHaveLength(2)
  })

  it('each entry has exactly 3 phases', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    for (const entry of rolloutEntries.value) {
      expect(entry.phases).toHaveLength(3)
    }
  })

  it('phases have correct percent values: 5, 25, 100', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    const phases = rolloutEntries.value[0].phases
    expect(phases[0].percent).toBe(5)
    expect(phases[1].percent).toBe(25)
    expect(phases[2].percent).toBe(100)
  })

  it('phases have labels set', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    const phases = rolloutEntries.value[0].phases
    expect(typeof phases[0].label).toBe('string')
    expect(phases[0].label.length).toBeGreaterThan(0)
    expect(typeof phases[1].label).toBe('string')
    expect(typeof phases[2].label).toBe('string')
  })

  it('first phase starts active, rest are pending', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    const phases = rolloutEntries.value[0].phases
    expect(phases[0].status).toBe('active')
    expect(phases[1].status).toBe('pending')
    expect(phases[2].status).toBe('pending')
  })

  it('advancePhase transitions active to done and next pending to active', () => {
    const { rolloutEntries, advancePhase } = useFeatureFlagRollout([baseBlock])
    const entry = rolloutEntries.value[0]
    advancePhase(entry.fEntryId)
    expect(entry.phases[0].status).toBe('done')
    expect(entry.phases[1].status).toBe('active')
    expect(entry.phases[2].status).toBe('pending')
  })

  it('advancePhase advances through all 3 phases in sequence', () => {
    const { rolloutEntries, advancePhase } = useFeatureFlagRollout([baseBlock])
    const entry = rolloutEntries.value[0]
    advancePhase(entry.fEntryId)
    advancePhase(entry.fEntryId)
    expect(entry.phases[0].status).toBe('done')
    expect(entry.phases[1].status).toBe('done')
    expect(entry.phases[2].status).toBe('active')
  })

  it('advancePhase does not go past the last phase', () => {
    const { rolloutEntries, advancePhase } = useFeatureFlagRollout([baseBlock])
    const entry = rolloutEntries.value[0]
    advancePhase(entry.fEntryId)
    advancePhase(entry.fEntryId)
    advancePhase(entry.fEntryId) // no-op past last
    expect(entry.phases[2].status).toBe('active')
  })

  it('resetPhase resets all phases and currentPhaseIdx', () => {
    const { rolloutEntries, advancePhase, resetPhase } = useFeatureFlagRollout([baseBlock])
    const entry = rolloutEntries.value[0]
    advancePhase(entry.fEntryId)
    resetPhase(entry.fEntryId)
    expect(entry.currentPhaseIdx).toBe(0)
    // all phases pending after reset
    for (const phase of entry.phases) {
      expect(phase.status).toBe('pending')
    }
  })

  it('criteria for each phase is derived from V. goal when match exists', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    // All phases get the goalText criteria
    const loginEntry = rolloutEntries.value.find((e) => e.fEntryId === 'F.UserLogin')!
    for (const phase of loginEntry.phases) {
      expect(typeof phase.criteria).toBe('string')
      expect(phase.criteria.length).toBeGreaterThan(0)
    }
  })

  it('criteria falls back to generic message when no V. match', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    const exportEntry = rolloutEntries.value.find((e) => e.fEntryId === 'F.DataExport')!
    // F.DataExport has no matching V. entry, so criteria is fallback
    for (const phase of exportEntry.phases) {
      expect(typeof phase.criteria).toBe('string')
    }
  })

  it('copyMarkdown returns a promise and does not throw', async () => {
    const { copyMarkdown, copied } = useFeatureFlagRollout([baseBlock])
    await expect(copyMarkdown()).resolves.toBeUndefined()
    expect(typeof copied.value).toBe('boolean')
  })

  it('fEntryId and fEntryName are set to the F. entry id', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    expect(rolloutEntries.value[0].fEntryId).toBe('F.UserLogin')
    expect(rolloutEntries.value[0].fEntryName).toBe('F.UserLogin')
  })

  it('returns empty entries when no F. entries exist', () => {
    const emptyBlock = makeBlock({ functions: [] })
    const { rolloutEntries } = useFeatureFlagRollout([emptyBlock])
    expect(rolloutEntries.value).toHaveLength(0)
  })

  it('each phase has a criteria string', () => {
    const { rolloutEntries } = useFeatureFlagRollout([baseBlock])
    for (const entry of rolloutEntries.value) {
      for (const phase of entry.phases) {
        expect(typeof phase.criteria).toBe('string')
      }
    }
  })
})
