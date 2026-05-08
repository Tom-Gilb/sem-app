// UNIT_TYPE=Test
// Tests for useEnergyTracker composable (Feature #97)

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sessionStorage for all tests
const mockStorage: Record<string, string> = {}
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) }),
}

vi.stubGlobal('sessionStorage', sessionStorageMock)

beforeEach(() => {
  // Clear mock storage and reset mocks before each test
  Object.keys(mockStorage).forEach(k => delete mockStorage[k])
  vi.clearAllMocks()
  // Also reset module registry so each test gets a fresh composable state
  vi.resetModules()
})

describe('useEnergyTracker', () => {
  it('initial state: records is empty (no storage data)', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { records } = useEnergyTracker()
    expect(records.value).toHaveLength(0)
  })

  it('recordEnergy adds a record to the list', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { records, recordEnergy } = useEnergyTracker()
    recordEnergy('🔥')
    expect(records.value).toHaveLength(1)
    expect(records.value[0].level).toBe('🔥')
  })

  it('records are capped at 5 — oldest is dropped when 6 are added', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { records, recordEnergy } = useEnergyTracker()
    recordEnergy('😴')
    recordEnergy('😴')
    recordEnergy('😴')
    recordEnergy('😴')
    recordEnergy('😴')
    recordEnergy('🔥') // 6th entry should push out the oldest
    expect(records.value).toHaveLength(5)
  })

  it('latestRecord returns the most recently added record', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { recordEnergy, latestRecord } = useEnergyTracker()
    recordEnergy('😴')
    recordEnergy('🔥')
    expect(latestRecord.value?.level).toBe('🔥')
  })

  it('latestRecord is null when no records exist', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { latestRecord } = useEnergyTracker()
    expect(latestRecord.value).toBeNull()
  })

  it('aggregateSummary.dominant is "🔥" when 2× 🔥 and 1× 😐', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { recordEnergy, aggregateSummary } = useEnergyTracker()
    recordEnergy('🔥')
    recordEnergy('🔥')
    recordEnergy('😐')
    expect(aggregateSummary.value.dominant).toBe('🔥')
  })

  it('aggregateSummary counts each level correctly', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { recordEnergy, aggregateSummary } = useEnergyTracker()
    recordEnergy('😴')
    recordEnergy('😐')
    recordEnergy('😐')
    recordEnergy('🔥')
    expect(aggregateSummary.value['😴']).toBe(1)
    expect(aggregateSummary.value['😐']).toBe(2)
    expect(aggregateSummary.value['🔥']).toBe(1)
  })

  it('setSpecKey updates currentSpecKey', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { currentSpecKey, setSpecKey } = useEnergyTracker()
    setSpecKey('5-software')
    expect(currentSpecKey.value).toBe('5-software')
  })

  it('sessionStorage.setItem is called when recording energy', async () => {
    const { useEnergyTracker } = await import('../useEnergyTracker')
    const { recordEnergy } = useEnergyTracker()
    recordEnergy('😐')
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'sem-energy-records',
      expect.any(String),
    )
  })
})
