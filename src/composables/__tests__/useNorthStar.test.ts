// UNIT_TYPE=Test
// Feature #84 — useNorthStar composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useNorthStar } from '../useNorthStar'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

function makeVEntry(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'A test value entry',
    scale: 'score out of 100',
    meter: 'Automated test',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeSpec(values: VEntry[], overrides: Partial<SpecBlock> = {}): SpecBlock {
  const f: FEntry = {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function',
    successCriteria: '',
    functionOfValue: '',
  }
  const s: SEntry = {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution',
    impact: '',
    function: '',
  }
  return { functions: [f], values, solutions: [s], ...overrides }
}

describe('useNorthStar', () => {
  it('initial state: pinnedId is null', () => {
    const spec = ref<SpecBlock | null>(null)
    const { pinnedId } = useNorthStar(spec)
    expect(pinnedId.value).toBeNull()
  })

  it('initial state: relevanceMap is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { relevanceMap } = useNorthStar(spec)
    expect(relevanceMap.value).toEqual({})
  })

  it('pinEntry sets pinnedId', () => {
    const spec = ref<SpecBlock | null>(makeSpec([makeVEntry({ id: 'V.A' })]))
    const { pinnedId, pinEntry } = useNorthStar(spec)
    pinEntry('V.A')
    expect(pinnedId.value).toBe('V.A')
  })

  it('pinEntry toggles back to null when already pinned id is passed', () => {
    const spec = ref<SpecBlock | null>(makeSpec([makeVEntry({ id: 'V.A' })]))
    const { pinnedId, pinEntry } = useNorthStar(spec)
    pinEntry('V.A')
    expect(pinnedId.value).toBe('V.A')
    pinEntry('V.A')
    expect(pinnedId.value).toBeNull()
  })

  it('relevanceMap returns 100 for pinned entry itself', () => {
    const v = makeVEntry({ id: 'V.Alpha', description: 'latency reduction performance metric', scale: 'milliseconds per request' })
    const spec = ref<SpecBlock | null>(makeSpec([v]))
    const { relevanceMap, pinEntry } = useNorthStar(spec)
    pinEntry('V.Alpha')
    expect(relevanceMap.value['V.Alpha']).toBe(100)
  })

  it('relevanceMap returns 0 for entry with no shared words', () => {
    const pinned = makeVEntry({ id: 'V.Alpha', description: 'latency performance metric', scale: 'milliseconds request' })
    const other = makeVEntry({ id: 'V.Beta', description: 'xyz completely unrelated', scale: 'cats dogs birds' })
    const spec = ref<SpecBlock | null>(makeSpec([pinned, other]))
    const { relevanceMap, pinEntry } = useNorthStar(spec)
    pinEntry('V.Alpha')
    expect(relevanceMap.value['V.Beta']).toBe(0)
  })

  it('relevanceMap returns >0 for entry with shared keywords', () => {
    const pinned = makeVEntry({ id: 'V.Alpha', description: 'latency performance metric threshold', scale: 'milliseconds request queue' })
    const other = makeVEntry({ id: 'V.Beta', description: 'latency performance monitoring baseline', scale: 'milliseconds network' })
    const spec = ref<SpecBlock | null>(makeSpec([pinned, other]))
    const { relevanceMap, pinEntry } = useNorthStar(spec)
    pinEntry('V.Alpha')
    expect(relevanceMap.value['V.Beta']).toBeGreaterThan(0)
  })

  it('pinnedEntry returns the correct block when pinned', () => {
    const v = makeVEntry({ id: 'V.Alpha', description: 'alpha value' })
    const spec = ref<SpecBlock | null>(makeSpec([v]))
    const { pinnedEntry, pinEntry } = useNorthStar(spec)
    pinEntry('V.Alpha')
    expect(pinnedEntry.value).not.toBeNull()
    expect(pinnedEntry.value?.id).toBe('V.Alpha')
  })

  it('pinnedEntry returns null when pinnedId is null', () => {
    const v = makeVEntry({ id: 'V.Alpha' })
    const spec = ref<SpecBlock | null>(makeSpec([v]))
    const { pinnedEntry } = useNorthStar(spec)
    expect(pinnedEntry.value).toBeNull()
  })

  it('relevanceMap is empty when spec is null', () => {
    const spec = ref<SpecBlock | null>(null)
    const { relevanceMap, pinEntry } = useNorthStar(spec)
    // Set a pinnedId but no spec
    pinEntry('V.Alpha')
    expect(relevanceMap.value).toEqual({})
  })
})
