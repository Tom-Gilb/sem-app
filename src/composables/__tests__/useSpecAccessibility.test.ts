// UNIT_TYPE=Test
// Feature #38 — Tests for useSpecAccessibility composable

import { describe, it, expect } from 'vitest'
import { useSpecAccessibility } from '../useSpecAccessibility'
import type { SpecBlock } from '../../types/spec'

const { checkSpec } = useSpecAccessibility()

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePerfectSpec(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.TestFunc',
        type: 'Function',
        level: 'Product',
        description: 'The system calculates invoice totals automatically on submission.',
        successCriteria: 'All invoices calculated correctly within 2 seconds in 100% of cases.',
        functionOfValue: 'V.Accuracy',
      },
    ],
    values: [
      {
        id: 'V.Accuracy',
        type: 'Value',
        level: 'Product',
        description: 'Accuracy of invoice calculations measured as a percentage.',
        scale: 'Percentage of invoices calculated correctly (0–100%)',
        meter: 'Automated test suite against 1000 sample invoices.',
        status: '75%',
        tolerable: '85%',
        goal: '99%',
        valueOfFunction: 'F.TestFunc',
      },
    ],
    solutions: [
      {
        id: 'S.InvoiceEngine',
        type: 'Solution',
        level: 'Product',
        description: 'The invoice engine computes totals using validated tax rules.',
        impact: 'V.Accuracy ~99%',
        function: 'F.TestFunc',
      },
    ],
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSpecAccessibility', () => {

  it('returns empty array for a perfect spec (no issues)', () => {
    const issues = checkSpec(makePerfectSpec())
    expect(issues).toEqual([])
  })

  it('detects passive voice in description (ERROR)', () => {
    const spec = makePerfectSpec()
    spec.functions[0].description = 'The invoice total is calculated by the engine.'
    const issues = checkSpec(spec)
    const passive = issues.filter(i => i.severity === 'error' && i.message === 'Passive voice weakens measurability')
    expect(passive.length).toBeGreaterThan(0)
    expect(passive[0].entryId).toBe('F.TestFunc')
    expect(passive[0].field).toBe('description')
  })

  it('detects vague goal "good" without a number (ERROR)', () => {
    const spec = makePerfectSpec()
    spec.values[0].goal = 'good quality'
    const issues = checkSpec(spec)
    const vague = issues.filter(i => i.severity === 'error' && i.message === 'Goal is not quantified')
    expect(vague.length).toBeGreaterThan(0)
    expect(vague[0].entryId).toBe('V.Accuracy')
    expect(vague[0].field).toBe('goal')
  })

  it('does NOT flag vague term in goal when a number is present', () => {
    const spec = makePerfectSpec()
    spec.values[0].goal = 'high quality — 98%'
    const issues = checkSpec(spec)
    const vague = issues.filter(i => i.severity === 'error' && i.message === 'Goal is not quantified')
    expect(vague.length).toBe(0)
  })

  it('detects scale with no measurable unit (ERROR)', () => {
    const spec = makePerfectSpec()
    spec.values[0].scale = 'Invoice quality level'
    const issues = checkSpec(spec)
    const noUnit = issues.filter(i => i.severity === 'error' && i.message === 'Scale has no measurable unit')
    expect(noUnit.length).toBeGreaterThan(0)
    expect(noUnit[0].entryId).toBe('V.Accuracy')
  })

  it('does NOT flag scale that contains a unit (%)', () => {
    const spec = makePerfectSpec()
    spec.values[0].scale = 'Percentage correct (0–100%)'
    const issues = checkSpec(spec)
    const noUnit = issues.filter(i => i.message === 'Scale has no measurable unit')
    expect(noUnit.length).toBe(0)
  })

  it('detects jargon term "synergy" (WARNING)', () => {
    const spec = makePerfectSpec()
    spec.solutions[0].description = 'The synergy between modules enables fast computation.'
    const issues = checkSpec(spec)
    const jargon = issues.filter(i => i.severity === 'warning' && i.message === 'Jargon term detected')
    expect(jargon.length).toBeGreaterThan(0)
    expect(jargon[0].entryId).toBe('S.InvoiceEngine')
  })

  it('detects description longer than 200 chars (WARNING)', () => {
    const spec = makePerfectSpec()
    spec.functions[0].description = 'A'.repeat(201)
    const issues = checkSpec(spec)
    const longDesc = issues.filter(i => i.severity === 'warning' && i.message.startsWith('Description is very long'))
    expect(longDesc.length).toBeGreaterThan(0)
    expect(longDesc[0].entryId).toBe('F.TestFunc')
    expect(longDesc[0].message).toContain('201')
  })

  it('detects missing successCriteria (WARNING)', () => {
    const spec = makePerfectSpec()
    spec.functions[0].successCriteria = ''
    const issues = checkSpec(spec)
    const missing = issues.filter(i => i.severity === 'warning' && i.message === 'Function is missing success criteria')
    expect(missing.length).toBeGreaterThan(0)
    expect(missing[0].entryId).toBe('F.TestFunc')
  })

  it('detects successCriteria shorter than 10 chars (WARNING)', () => {
    const spec = makePerfectSpec()
    spec.functions[0].successCriteria = 'Pass'
    const issues = checkSpec(spec)
    const missing = issues.filter(i => i.severity === 'warning' && i.message === 'Function is missing success criteria')
    expect(missing.length).toBeGreaterThan(0)
  })

  it('detects short scale < 15 chars (INFO)', () => {
    const spec = makePerfectSpec()
    spec.values[0].scale = '% correct'
    const issues = checkSpec(spec)
    const short = issues.filter(i => i.severity === 'info' && i.message === 'Scale may be too brief to be unambiguous')
    expect(short.length).toBeGreaterThan(0)
    expect(short[0].entryId).toBe('V.Accuracy')
  })

  it('suggestion text is populated for all severities', () => {
    const spec = makePerfectSpec()
    spec.functions[0].successCriteria = ''
    spec.values[0].goal = 'good'
    spec.values[0].scale = '% ok'
    const issues = checkSpec(spec)
    for (const issue of issues) {
      expect(issue.suggestion.length).toBeGreaterThan(0)
    }
  })

})
