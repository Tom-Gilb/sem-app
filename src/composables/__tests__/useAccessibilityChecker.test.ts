// UNIT_TYPE=Test
// Feature #38 — Tests for useAccessibilityChecker composable

import { describe, it, expect } from 'vitest'
import { useAccessibilityChecker } from '../useAccessibilityChecker'
import type { SpecBlock } from '../../types/spec'

const { check, summarise } = useAccessibilityChecker()

function makeFullSpec(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.Launch',
        type: 'Function',
        level: 'Product',
        description: 'Deliver an onboarding flow that guides new users through account setup in under 3 minutes',
        successCriteria: 'First-time users complete account setup with an error rate below 2%',
        functionOfValue: 'V.OnboardingTime',
      },
    ],
    values: [
      {
        id: 'V.OnboardingTime',
        type: 'Value',
        level: 'Product',
        description: 'Time taken by new users to complete account setup measured in minutes',
        scale: 'Minutes from registration to first action, measured per user session',
        meter: 'Automated session timing via analytics SDK',
        status: '8 minutes average',
        tolerable: '5 minutes',
        goal: '2.5 minutes',
        valueOfFunction: 'F.Launch',
      },
    ],
    solutions: [
      {
        id: 'S.OnboardingWizard',
        type: 'Solution',
        level: 'Product',
        description: 'Step-by-step onboarding wizard with progress indicator and contextual tooltips',
        impact: 'V.OnboardingTime ~75%',
        function: 'F.Launch',
      },
    ],
  }
}

describe('useAccessibilityChecker — check()', () => {

  it('clean spec returns no findings', () => {
    const findings = check(makeFullSpec())
    expect(findings).toHaveLength(0)
  })

  it('missing V. scale produces a missing finding', () => {
    const spec = makeFullSpec()
    spec.values[0].scale = ''
    const findings = check(spec)
    expect(findings.some((f) => f.entryId === 'V.OnboardingTime' && f.field === 'Scale' && f.kind === 'missing')).toBe(true)
  })

  it('missing V. meter produces a missing finding', () => {
    const spec = makeFullSpec()
    spec.values[0].meter = ''
    const findings = check(spec)
    expect(findings.some((f) => f.entryId === 'V.OnboardingTime' && f.field === 'Meter' && f.kind === 'missing')).toBe(true)
  })

  it('missing V. goal produces a missing finding', () => {
    const spec = makeFullSpec()
    spec.values[0].goal = ''
    const findings = check(spec)
    expect(findings.some((f) => f.entryId === 'V.OnboardingTime' && f.field === 'Goal' && f.kind === 'missing')).toBe(true)
  })

  it('missing V. tolerable produces a missing finding', () => {
    const spec = makeFullSpec()
    spec.values[0].tolerable = ''
    const findings = check(spec)
    expect(findings.some((f) => f.entryId === 'V.OnboardingTime' && f.field === 'Tolerable' && f.kind === 'missing')).toBe(true)
  })

  it('missing F. success criteria produces a missing finding', () => {
    const spec = makeFullSpec()
    spec.functions[0].successCriteria = ''
    const findings = check(spec)
    expect(findings.some((f) => f.entryId === 'F.Launch' && f.kind === 'missing')).toBe(true)
  })

  it('missing S. impact produces a missing finding', () => {
    const spec = makeFullSpec()
    spec.solutions[0].impact = ''
    const findings = check(spec)
    expect(findings.some((f) => f.entryId === 'S.OnboardingWizard' && f.field === 'Impact' && f.kind === 'missing')).toBe(true)
  })

  it('jargon word "synergy" in F. description produces a jargon finding', () => {
    const spec = makeFullSpec()
    spec.functions[0].description = 'Create synergy across all departments to improve planning outcomes'
    const findings = check(spec)
    expect(findings.some((f) => f.kind === 'jargon' && f.match.toLowerCase().includes('synergy'))).toBe(true)
  })

  it('jargon word "seamless" in S. description produces a jargon finding', () => {
    const spec = makeFullSpec()
    spec.solutions[0].description = 'Deliver a seamless integration that connects all systems automatically and robustly'
    const findings = check(spec)
    expect(findings.some((f) => f.kind === 'jargon' && f.entryId === 'S.OnboardingWizard')).toBe(true)
  })

  it('vague word "several" in V. scale produces a vague finding', () => {
    const spec = makeFullSpec()
    spec.values[0].scale = 'Number of several improvements detected across sessions'
    const findings = check(spec)
    expect(findings.some((f) => f.kind === 'vague' && f.entryId === 'V.OnboardingTime')).toBe(true)
  })

  it('duplicate findings are de-duplicated', () => {
    const spec = makeFullSpec()
    // Put the same jargon word in multiple fields
    spec.functions[0].description = 'Leverage synergy to leverage growth with leverage'
    const findings = check(spec)
    const leverageCount = findings.filter(
      (f) => f.entryId === 'F.Launch' && f.match.toLowerCase().startsWith('leverag'),
    ).length
    // Should only appear once per entry even if matched multiple times in text
    expect(leverageCount).toBe(1)
  })

  it('empty spec returns no findings', () => {
    const findings = check({ functions: [], values: [], solutions: [] })
    expect(findings).toHaveLength(0)
  })

  it('findings have required fields: entryId, entryType, field, match, suggestion, kind', () => {
    const spec = makeFullSpec()
    spec.values[0].scale = ''
    const findings = check(spec)
    for (const f of findings) {
      expect(f.entryId).toBeTruthy()
      expect(['F.', 'V.', 'S.']).toContain(f.entryType)
      expect(f.field).toBeTruthy()
      expect(f.match).toBeTruthy()
      expect(f.suggestion).toBeTruthy()
      expect(['jargon', 'vague', 'missing']).toContain(f.kind)
    }
  })
})

describe('useAccessibilityChecker — summarise()', () => {
  it('empty findings → all counts 0', () => {
    const summary = summarise([])
    expect(summary.total).toBe(0)
    expect(summary.jargon).toBe(0)
    expect(summary.vague).toBe(0)
    expect(summary.missing).toBe(0)
  })

  it('counts by kind correctly', () => {
    const spec = makeFullSpec()
    spec.values[0].scale = ''           // 1 missing
    spec.functions[0].description = 'Create synergy across teams'  // 1 jargon
    spec.solutions[0].description = 'Deliver several improvements seamlessly'  // vague + jargon
    const findings = check(spec)
    const summary = summarise(findings)
    expect(summary.total).toBe(findings.length)
    expect(summary.missing).toBeGreaterThanOrEqual(1)
    expect(summary.jargon + summary.vague + summary.missing).toBe(summary.total)
  })
})
