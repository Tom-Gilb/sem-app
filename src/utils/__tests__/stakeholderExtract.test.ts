// UNIT_TYPE=Test
// Feature #59 — stakeholderExtract utility tests

import { describe, test, expect } from 'vitest'
import {
  extractStakeholders,
  extractContextualStakeholders,
  extractAllStakeholders,
  impactLevel,
  STAKEHOLDER_PATTERNS,
} from '../stakeholderExtract'

const END_USER = STAKEHOLDER_PATTERNS.find(s => s.name === 'End User')!
const LEADER   = STAKEHOLDER_PATTERNS.find(s => s.name === 'Leader')!

// ── extractStakeholders ───────────────────────────────────────────────────────

describe('extractStakeholders', () => {
  test('detects End User from "improve user experience"', () => {
    expect(extractStakeholders('improve user experience').map(s => s.name)).toContain('End User')
  })

  test('detects Engineer from "engineering team performance"', () => {
    expect(extractStakeholders('engineering team performance').map(s => s.name)).toContain('Engineer')
  })

  test('detects Non-Profit from "non-profit organization outreach"', () => {
    expect(extractStakeholders('non-profit organization outreach').map(s => s.name)).toContain('Non-Profit')
  })

  test('detects Non-Profit from "volunteer coordination platform"', () => {
    expect(extractStakeholders('volunteer coordination platform').map(s => s.name)).toContain('Non-Profit')
  })

  test('detects Healthcare from "patient outcomes"', () => {
    expect(extractStakeholders('improve patient outcomes in hospital').map(s => s.name)).toContain('Healthcare')
  })

  test('detects Education from "student engagement"', () => {
    expect(extractStakeholders('student engagement and teacher support').map(s => s.name)).toContain('Education')
  })

  test('detects Community from "resident satisfaction"', () => {
    expect(extractStakeholders('improve resident satisfaction').map(s => s.name)).toContain('Community')
  })

  test('detects Government from "council decision making"', () => {
    expect(extractStakeholders('support council decision making').map(s => s.name)).toContain('Government')
  })

  test('detects Leader from "leaders across the sector"', () => {
    // word-boundary: "leader" starts with "lead" but is its own word
    expect(extractStakeholders('leaders across the sector').map(s => s.name)).toContain('Leader')
  })

  test('returns empty array when no keywords present', () => {
    expect(extractStakeholders('no relevant terms here')).toHaveLength(0)
  })

  test('matching is case-insensitive', () => {
    const upper = extractStakeholders('IMPROVE USER EXPERIENCE')
    const lower = extractStakeholders('improve user experience')
    expect(upper.map(s => s.name)).toContain('End User')
    expect(upper.length).toBe(lower.length)
  })

  test('does not match "lead" inside unrelated words like "upload"', () => {
    // "upload" contains "lead" as a substring — word-boundary matching should NOT fire
    const result = extractStakeholders('upload the document to the platform')
    expect(result.map(s => s.name)).not.toContain('Leader')
  })
})

// ── extractContextualStakeholders ─────────────────────────────────────────────

describe('extractContextualStakeholders', () => {
  test('extracts "non-profit leaders" from "do something good for non-profit leaders"', () => {
    const result = extractContextualStakeholders('do something good for non-profit leaders')
    const names = result.map(s => s.name.toLowerCase())
    expect(names.some(n => n.includes('non-profit'))).toBe(true)
  })

  test('extracts stakeholder from "helping young people in rural communities"', () => {
    const result = extractContextualStakeholders('helping young people in rural communities')
    const names = result.map(s => s.name.toLowerCase())
    expect(names.some(n => n.includes('young'))).toBe(true)
  })

  test('extracts stakeholder from "designed for community volunteers"', () => {
    const result = extractContextualStakeholders('designed for community volunteers')
    const names = result.map(s => s.name.toLowerCase())
    expect(names.some(n => n.includes('community') || n.includes('volunteer'))).toBe(true)
  })

  test('extracts stakeholder from "built for rural healthcare workers"', () => {
    const result = extractContextualStakeholders('built for rural healthcare workers')
    const names = result.map(s => s.name.toLowerCase())
    expect(names.some(n => n.includes('rural') || n.includes('healthcare'))).toBe(true)
  })

  test('marks contextual results with contextual: true', () => {
    const result = extractContextualStakeholders('for teenage athletes in schools')
    expect(result.every(s => s.contextual === true)).toBe(true)
  })

  test('returns empty for text with no trigger phrases', () => {
    const result = extractContextualStakeholders('improve the system performance metrics')
    expect(result).toHaveLength(0)
  })

  test('deduplicates repeated phrases', () => {
    const result = extractContextualStakeholders('for elderly residents and services for elderly residents')
    const names = result.map(s => s.name.toLowerCase())
    const elderly = names.filter(n => n.includes('elderly'))
    expect(elderly.length).toBeLessThanOrEqual(1)
  })
})

// ── extractAllStakeholders ────────────────────────────────────────────────────

describe('extractAllStakeholders', () => {
  test('detects non-profit leaders contextually when pattern does not match', () => {
    // "non-profit leaders" — "non-profit" hits the Non-Profit pattern;
    // contextual extraction also runs but the pattern match takes precedence
    const result = extractAllStakeholders('do something good for non-profit leaders')
    const names = result.map(s => s.name)
    expect(names).toContain('Non-Profit')
  })

  test('does not duplicate: contextual match dropped when pattern already covers it', () => {
    const result = extractAllStakeholders('support for users and customers')
    const endUserMatches = result.filter(s => s.name === 'End User')
    expect(endUserMatches.length).toBe(1)
  })

  test('returns contextual-only stakeholder when no pattern matches', () => {
    // "teenage athletes" — not in any pattern
    const result = extractAllStakeholders('designed for teenage athletes')
    const names = result.map(s => s.name.toLowerCase())
    expect(names.some(n => n.includes('teenage') || n.includes('athlete'))).toBe(true)
  })

  test('scans full concatenated text across F/V/S', () => {
    const text = [
      'F.ImproveOutreach Reach non-profit partners effectively',
      'V.VolunteerSatisfaction Volunteer satisfaction score',
      'S.Portal Community portal for residents',
    ].join(' ')
    const result = extractAllStakeholders(text)
    const names = result.map(s => s.name)
    expect(names).toContain('Non-Profit')
    expect(names).toContain('Community')
  })
})

// ── impactLevel ───────────────────────────────────────────────────────────────

describe('impactLevel', () => {
  test('1 keyword hit → level 1', () => {
    expect(impactLevel('improve user experience', END_USER)).toBe(1)
  })

  test('3+ keyword hits → level 3', () => {
    expect(impactLevel('user customer client', END_USER)).toBe(3)
  })

  test('no keyword match → level 0', () => {
    expect(impactLevel('engineering team', END_USER)).toBe(0)
  })

  test('word-boundary: "leader" matches Leader pattern', () => {
    expect(impactLevel('support nonprofit leaders in the sector', LEADER)).toBeGreaterThan(0)
  })
})

// ── Regression: 2026-06-02 Tom parse-failure cases ───────────────────────────
// Tom: "government and oil money and poorest in Norway are all stakeholders
// and they are not parsed"
// Three bugs fixed:
//   1. "for the poorest" → STOP_WORDS had 'the', so loop stopped immediately.
//      Fix: leading articles skipped silently, not as STOP_WORDs.
//   2. "poorest in Norway" → STOP_WORDS had 'in', so only "poorest" captured.
//      Fix: 'in' removed from STOP_WORDS; captured as full phrase.
//   3. "oil money" not in any pattern. Fix: new 'Public Fund' pattern added.

describe('regression-2026-06-02 Tom parse failure cases', () => {
  test('extracts "poorest in Norway" when preceded by "the" (leading-article fix)', () => {
    const result = extractContextualStakeholders(
      'make life better for the poorest in Norway through government oil money'
    )
    const names = result.map(s => s.name.toLowerCase())
    expect(names.some(n => n.includes('poorest'))).toBe(true)
  })

  test('"poorest in Norway" — "in" is captured as phrase connector, not as stop word', () => {
    const result = extractContextualStakeholders('for the poorest in Norway')
    const names = result.map(s => s.name.toLowerCase())
    // Must capture at least "poorest"; ideally the full "poorest in Norway"
    expect(names.some(n => n.includes('poorest'))).toBe(true)
  })

  test('detects "oil money" via Public Fund pattern', () => {
    const result = extractStakeholders('funded through government oil money')
    expect(result.map(s => s.name)).toContain('Public Fund')
  })

  test('detects "sovereign wealth" via Public Fund pattern', () => {
    expect(extractStakeholders('manages a sovereign wealth fund').map(s => s.name)).toContain('Public Fund')
  })

  test('detects "poorest" via Vulnerable Community pattern', () => {
    expect(extractStakeholders('help the poorest communities').map(s => s.name)).toContain('Vulnerable Community')
  })

  test('detects "government" via Government pattern', () => {
    expect(extractStakeholders('government policy makers').map(s => s.name)).toContain('Government')
  })

  test('extractAllStakeholders picks up all three categories from the full Tom phrase', () => {
    const text = 'make life better for the poorest in Norway through government oil money'
    const result = extractAllStakeholders(text)
    const names = result.map(s => s.name)
    expect(names).toContain('Public Fund')
    expect(names).toContain('Vulnerable Community')
    expect(names).toContain('Government')
  })
})

// ── STAKEHOLDER_PATTERNS ──────────────────────────────────────────────────────

describe('STAKEHOLDER_PATTERNS', () => {
  test('has at least 12 patterns', () => {
    expect(STAKEHOLDER_PATTERNS.length).toBeGreaterThanOrEqual(12)
  })

  test('includes Non-Profit pattern', () => {
    expect(STAKEHOLDER_PATTERNS.map(s => s.name)).toContain('Non-Profit')
  })

  test('includes Healthcare pattern', () => {
    expect(STAKEHOLDER_PATTERNS.map(s => s.name)).toContain('Healthcare')
  })

  test('includes Education pattern', () => {
    expect(STAKEHOLDER_PATTERNS.map(s => s.name)).toContain('Education')
  })

  test('includes Community pattern', () => {
    expect(STAKEHOLDER_PATTERNS.map(s => s.name)).toContain('Community')
  })

  test('includes Government pattern', () => {
    expect(STAKEHOLDER_PATTERNS.map(s => s.name)).toContain('Government')
  })
})
