// UNIT_TYPE=Test
// Feature #59 — stakeholderExtract utility tests

import { describe, test, expect } from 'vitest'
import { extractStakeholders, impactLevel, STAKEHOLDER_PATTERNS } from '../stakeholderExtract'

const END_USER = STAKEHOLDER_PATTERNS.find(s => s.name === 'End User')!
const ENGINEER  = STAKEHOLDER_PATTERNS.find(s => s.name === 'Engineer')!

describe('extractStakeholders', () => {
  test('detects End User from "improve user experience"', () => {
    const result = extractStakeholders('improve user experience')
    expect(result.map(s => s.name)).toContain('End User')
  })

  test('detects Engineer from "engineering team performance"', () => {
    const result = extractStakeholders('engineering team performance')
    expect(result.map(s => s.name)).toContain('Engineer')
  })

  test('returns empty array when no keywords present', () => {
    expect(extractStakeholders('no keywords here')).toHaveLength(0)
  })

  test('matching is case-insensitive', () => {
    const upper = extractStakeholders('IMPROVE USER EXPERIENCE')
    const lower = extractStakeholders('improve user experience')
    expect(upper.map(s => s.name)).toContain('End User')
    expect(upper.length).toBe(lower.length)
  })
})

describe('impactLevel', () => {
  test('1 keyword hit → level 1', () => {
    expect(impactLevel('improve user experience', END_USER)).toBe(1)
  })

  test('3+ keyword hits → level 3', () => {
    // "user", "customer", "client" are all End User keywords
    expect(impactLevel('user customer client', END_USER)).toBe(3)
  })

  test('no keyword match → level 0', () => {
    expect(impactLevel('engineering team', END_USER)).toBe(0)
  })
})

describe('STAKEHOLDER_PATTERNS', () => {
  test('has at least 6 patterns', () => {
    expect(STAKEHOLDER_PATTERNS.length).toBeGreaterThanOrEqual(6)
  })
})
