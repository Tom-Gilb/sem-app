// UNIT_TYPE=Test
// Feature #46 — distributeEntries utility tests

import { describe, it, expect } from 'vitest'
import { distributeEntries } from '../heatLane'

describe('distributeEntries', () => {
  it('3 entries → 3 columns = [[e0],[e1],[e2]]', () => {
    const entries = ['e0', 'e1', 'e2']
    const result = distributeEntries(entries, 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(['e0'])
    expect(result[1]).toEqual(['e1'])
    expect(result[2]).toEqual(['e2'])
  })

  it('5 entries → 3 columns = [[e0,e3],[e1,e4],[e2]]', () => {
    const entries = ['e0', 'e1', 'e2', 'e3', 'e4']
    const result = distributeEntries(entries, 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(['e0', 'e3'])
    expect(result[1]).toEqual(['e1', 'e4'])
    expect(result[2]).toEqual(['e2'])
  })

  it('0 entries → all columns empty', () => {
    const result = distributeEntries([], 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual([])
    expect(result[1]).toEqual([])
    expect(result[2]).toEqual([])
  })

  it('0 entries 0 columns → empty array', () => {
    const result = distributeEntries([], 0)
    expect(result).toHaveLength(0)
  })

  it('1 entry → 1 column = [[e0]]', () => {
    const result = distributeEntries(['e0'], 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(['e0'])
  })

  it('works with objects', () => {
    const entries = [{ id: 'F.1' }, { id: 'F.2' }, { id: 'F.3' }, { id: 'F.4' }]
    const result = distributeEntries(entries, 2)
    expect(result[0]).toEqual([{ id: 'F.1' }, { id: 'F.3' }])
    expect(result[1]).toEqual([{ id: 'F.2' }, { id: 'F.4' }])
  })
})
