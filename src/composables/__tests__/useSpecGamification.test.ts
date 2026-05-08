// UNIT_TYPE=Test
// Feature #107 — useSpecGamification composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSpecGamification, MAX_XP } from '../useSpecGamification'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function description',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'Test value description',
    scale: 'percent',
    meter: 'Automated timer',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80%',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution description',
    impact: '',
    function: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [makeF()],
    values: [makeV()],
    solutions: [makeS()],
    ...overrides,
  }
}

describe('useSpecGamification', () => {
  it('xp is 0 for null spec', () => {
    const spec = ref<SpecBlock | null>(null)
    const { xp } = useSpecGamification(spec)
    expect(xp.value).toBe(0)
  })

  it('xp > 0 for spec with V. entries with filled fields', () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { xp } = useSpecGamification(spec)
    expect(xp.value).toBeGreaterThan(0)
  })

  it('xp is capped at 100', () => {
    // Create spec with many V entries to overflow 100
    const values: VEntry[] = Array.from({ length: 10 }, (_, i) =>
      makeV({
        id: `V.Entry${i}`,
        scale: 'percent',
        meter: 'Automated',
        goal: 'Goal 80%',
        tolerable: 'Tolerable 60',
        status: 'Status 50',
        description: 'Full description',
        wish: 'Wish 95',
      })
    )
    const spec = ref<SpecBlock | null>(makeSpec({ values }))
    const { xp } = useSpecGamification(spec)
    expect(xp.value).toBe(MAX_XP)
  })

  it('level is Novice when xp < 50', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({
        scale: '',
        meter: '',
        goal: '',
        tolerable: '',
        status: '',
        description: 'Only description',
        wish: '',
      })],
      functions: [],
      solutions: [],
    }))
    const { level } = useSpecGamification(spec)
    expect(level.value.name).toBe('Novice')
  })

  it('level is Practitioner when xp = 50', () => {
    // scale(10) + meter(10) + goal(15) + tolerable(10) + description(5) = 50
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [makeV({
        scale: 'percent',
        meter: 'Automated',
        goal: 'Goal 80%',
        tolerable: 'Tolerable 60',
        status: '',
        description: 'Description here',
        wish: '',
      })],
      functions: [],
      solutions: [],
    }))
    const { xp, level } = useSpecGamification(spec)
    expect(xp.value).toBeGreaterThanOrEqual(50)
    expect(level.value.name).toBe('Practitioner')
  })

  it('level is Expert when xp >= 80', () => {
    // scale(10)+meter(10)+goal(15)+tolerable(10)+status(10)+description(5)+wish(5) = 65
    // Add F entry (5) + S entry (5) = 75, then add another V entry fully filled to exceed 80
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [
        makeV({ id: 'V.A', scale: 'p', meter: 'm', goal: '80', tolerable: '60', status: '50', description: 'd', wish: 'w' }),
        makeV({ id: 'V.B', scale: 'p', meter: 'm', goal: '80', tolerable: '60', status: '50', description: 'd', wish: 'w' }),
      ],
      functions: [makeF({ description: 'func desc' })],
      solutions: [makeS({ description: 'sol desc' })],
    }))
    const { xp, level } = useSpecGamification(spec)
    expect(xp.value).toBeGreaterThanOrEqual(80)
    expect(level.value.name).toBe('Expert')
  })

  it('xpBarWidth is "0%" for null spec', () => {
    const spec = ref<SpecBlock | null>(null)
    const { xpBarWidth } = useSpecGamification(spec)
    expect(xpBarWidth.value).toBe('0%')
  })

  it('xpBarWidth is "100%" when xp >= 100', () => {
    const values: VEntry[] = Array.from({ length: 10 }, (_, i) =>
      makeV({
        id: `V.Entry${i}`,
        scale: 'percent',
        meter: 'Automated',
        goal: 'Goal 80%',
        tolerable: 'Tolerable 60',
        status: 'Status 50',
        description: 'Full description',
        wish: 'Wish 95',
      })
    )
    const spec = ref<SpecBlock | null>(makeSpec({ values }))
    const { xpBarWidth } = useSpecGamification(spec)
    expect(xpBarWidth.value).toBe('100%')
  })
})
