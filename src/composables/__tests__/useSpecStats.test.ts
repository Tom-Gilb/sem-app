import { describe, it, expect } from 'vitest'
import { useSpecStats } from '../useSpecStats'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeF(id: string, overrides: Partial<FEntry> = {}): FEntry {
  return {
    id,
    type: 'Function',
    level: 'Product',
    description: 'A function description',
    successCriteria: 'Some criteria',
    functionOfValue: 'V.SomeValue',
    ...overrides,
  }
}

function makeV(id: string, overrides: Partial<VEntry> = {}): VEntry {
  return {
    id,
    type: 'Value',
    level: 'Product',
    description: 'A value description',
    scale: '0–100',
    meter: 'Survey',
    status: 'Status [2026] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: 'F.Some',
    ...overrides,
  }
}

function makeS(id: string, overrides: Partial<SEntry> = {}): SEntry {
  return {
    id,
    type: 'Solution',
    level: 'Product',
    description: 'A solution description',
    impact: 'V.SomeValue ~20%',
    function: 'F.SomeFunction',
    ...overrides,
  }
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

// A fully filled spec (all required fields non-empty)
const fullSpec: SpecBlock = {
  functions: [makeF('F.Alpha'), makeF('F.Beta')],
  values: [makeV('V.Perf')],
  solutions: [makeS('S.One')],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSpecStats — computeStats', () => {
  const { computeStats } = useSpecStats()

  it('totalEntries counts F + V + S correctly', () => {
    const spec: SpecBlock = {
      functions: [makeF('F.A'), makeF('F.B')],
      values: [makeV('V.X')],
      solutions: [makeS('S.Z'), makeS('S.Y')],
    }
    const stats = computeStats(spec)
    expect(stats.totalEntries).toBe(5)
  })

  it('totalEntries is 0 for an empty spec', () => {
    expect(computeStats(emptySpec).totalEntries).toBe(0)
  })

  it('completenessPercent is 100 for a fully filled spec', () => {
    const stats = computeStats(fullSpec)
    expect(stats.completenessPercent).toBe(100)
  })

  it('completenessPercent is 100 for empty spec (no expected fields)', () => {
    expect(computeStats(emptySpec).completenessPercent).toBe(100)
  })

  it('completenessPercent < 100 when fields are empty', () => {
    const spec: SpecBlock = {
      functions: [makeF('F.A', { description: '', successCriteria: '' })],
      values: [],
      solutions: [],
    }
    // F has 3 required fields; 2 empty → 1/3 filled → ~33%
    const stats = computeStats(spec)
    expect(stats.completenessPercent).toBeLessThan(100)
    expect(stats.completenessPercent).toBe(33)
  })

  it('missingFieldCount matches manually counted empty fields', () => {
    const spec: SpecBlock = {
      functions: [makeF('F.X', { description: '', successCriteria: '' })], // 2 missing
      values: [makeV('V.Y', { scale: '', meter: '' })], // 2 missing
      solutions: [makeS('S.Z', { impact: '' })], // 1 missing
    }
    const stats = computeStats(spec)
    expect(stats.missingFieldCount).toBe(5)
  })

  it('missingFieldCount is 0 for a fully filled spec', () => {
    expect(computeStats(fullSpec).missingFieldCount).toBe(0)
  })

  it('avgDescriptionLength correct for known inputs', () => {
    // F.A description = "hello" (5 chars), S.B description = "hi" (2 chars)
    // avg = Math.round((5 + 2) / 2) = 4 (actually 3.5 rounds to 4)
    const spec: SpecBlock = {
      functions: [makeF('F.A', { description: 'hello' })],
      values: [],
      solutions: [makeS('S.B', { description: 'hi' })],
    }
    const stats = computeStats(spec)
    // (5 + 2) / 2 = 3.5, Math.round(3.5) = 4
    expect(stats.avgDescriptionLength).toBe(4)
  })

  it('avgDescriptionLength is 0 for an empty spec', () => {
    expect(computeStats(emptySpec).avgDescriptionLength).toBe(0)
  })

  it('longestEntry returns correct entryId', () => {
    const spec: SpecBlock = {
      functions: [
        makeF('F.Short', { description: 'AB' }),
        makeF('F.Long', { description: 'ABCDEFGHIJ' }),
      ],
      values: [],
      solutions: [],
    }
    const stats = computeStats(spec)
    expect(stats.longestEntry).toBe('F.Long')
  })

  it('shortestEntry returns correct entryId', () => {
    const spec: SpecBlock = {
      functions: [],
      values: [
        makeV('V.Mini', { description: 'x' }),
        makeV('V.Large', { description: 'x'.repeat(50) }),
      ],
      solutions: [],
    }
    const stats = computeStats(spec)
    expect(stats.shortestEntry).toBe('V.Mini')
  })

  it('longestEntry and shortestEntry are empty strings when spec is empty', () => {
    const stats = computeStats(emptySpec)
    expect(stats.longestEntry).toBe('')
    expect(stats.shortestEntry).toBe('')
  })
})
