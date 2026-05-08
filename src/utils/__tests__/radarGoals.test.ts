// Tests for radarGoals utility — Feature #55

import { describe, test, expect } from 'vitest'
import { parseGoalNumber, normaliseGoals } from '../radarGoals'

describe('parseGoalNumber', () => {
  test('parses integer percentage', () => {
    expect(parseGoalNumber('95%')).toBe(95)
  })

  test('parses decimal value with unit', () => {
    expect(parseGoalNumber('2.5 hrs')).toBe(2.5)
  })

  test('returns 0 for undefined', () => {
    expect(parseGoalNumber(undefined)).toBe(0)
  })

  test('returns 0 for string with no numbers', () => {
    expect(parseGoalNumber('no numbers')).toBe(0)
  })

  test('returns 0 for empty string', () => {
    expect(parseGoalNumber('')).toBe(0)
  })

  test('parses first number when multiple present', () => {
    expect(parseGoalNumber('50 out of 100')).toBe(50)
  })

  test('parses plain integer string', () => {
    expect(parseGoalNumber('80')).toBe(80)
  })
})

describe('normaliseGoals', () => {
  test('normalises to [1.0, 0.5, 0.75] for 100%, 50%, 75%', () => {
    const result = normaliseGoals(['100%', '50%', '75%'])
    expect(result[0]).toBeCloseTo(1.0)
    expect(result[1]).toBeCloseTo(0.5)
    expect(result[2]).toBeCloseTo(0.75)
  })

  test('returns empty array for empty input', () => {
    expect(normaliseGoals([])).toEqual([])
  })

  test('handles undefined entries — [undefined, "80"] → [0, 1.0]', () => {
    const result = normaliseGoals([undefined, '80'])
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(1.0)
  })

  test('all zeros → all zeros (max floor is 1, so all become 0/1 = 0)', () => {
    const result = normaliseGoals(['0', '0'])
    expect(result).toEqual([0, 0])
  })

  test('single value → [1.0]', () => {
    const result = normaliseGoals(['50%'])
    expect(result[0]).toBeCloseTo(1.0)
  })

  test('handles all-undefined array gracefully', () => {
    const result = normaliseGoals([undefined, undefined])
    expect(result).toEqual([0, 0])
  })
})
