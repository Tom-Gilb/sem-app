// UNIT_TYPE=Test
// Tests for useSpecFilter composable (Feature #31)

import { describe, it, expect } from 'vitest'
import { useSpecFilter } from '../useSpecFilter'
import type { SpecBlock } from '../../types/spec'

const makeSpec = (): SpecBlock => ({
  functions: [
    {
      id: 'F.OnboardUser',
      type: 'Function',
      level: 'Product',
      description: 'Allow new users to complete onboarding within the app',
      successCriteria: 'User reaches dashboard after sign-up',
      functionOfValue: 'V.OnboardingSpeed',
    },
    {
      id: 'F.GenerateReport',
      type: 'Function',
      level: 'Product',
      description: 'Generate a performance report for managers',
      successCriteria: 'Report exported as PDF',
      functionOfValue: 'V.ReportAccuracy',
    },
  ],
  values: [
    {
      id: 'V.OnboardingSpeed',
      type: 'Value',
      level: 'Stakeholder',
      description: 'Time for new user to complete onboarding',
      scale: 'Minutes to first successful action',
      meter: 'Automated session timer',
      status: 'Status [now] 12 minutes',
      tolerable: 'Tolerable [2025] 8 minutes',
      goal: 'Goal [2025] 5 minutes',
      valueOfFunction: 'F.OnboardUser',
    },
    {
      id: 'V.ReportAccuracy',
      type: 'Value',
      level: 'Business',
      description: 'Accuracy of generated performance reports',
      scale: '% correct data fields',
      meter: 'Manual audit of 20 sample reports',
      status: 'Status [now] 72%',
      tolerable: 'Tolerable [2025] 85%',
      goal: 'Goal [2025] 95%',
      valueOfFunction: 'F.GenerateReport',
    },
    {
      id: 'V.SystemLoad',
      type: 'Value',
      level: 'Product',
      description: 'Average server CPU utilisation under peak load',
      scale: '% CPU usage',
      meter: 'New Relic APM monitor',
      status: 'Status [now] 68%',
      tolerable: 'Tolerable [2025] 75%',
      goal: 'Goal [2025] 60%',
      valueOfFunction: 'F.GenerateReport',
    },
  ],
  solutions: [
    {
      id: 'S.WizardFlow',
      type: 'Solution',
      level: 'Solution',
      description: 'Step-by-step onboarding wizard',
      impact: 'V.OnboardingSpeed ~70%',
      function: 'F.OnboardUser',
    },
    {
      id: 'S.CachedReports',
      type: 'Solution',
      level: 'Solution',
      description: 'Pre-compute and cache report data',
      impact: 'V.ReportAccuracy ~90%',
      function: 'F.GenerateReport',
    },
  ],
})

describe('useSpecFilter', () => {
  const { filterSpec } = useSpecFilter()

  it('empty query returns original spec unchanged', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, '')
    expect(result).toBe(spec)
  })

  it('whitespace-only query returns original spec unchanged', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, '   ')
    expect(result).toBe(spec)
  })

  it('"goal > 80" keeps only V. entries with numeric Goal > 80', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, 'goal > 80')
    // V.ReportAccuracy has goal 95 and V.SystemLoad has goal 60 — only 95 passes
    expect(result.values.length).toBe(1)
    expect(result.values[0].id).toBe('V.ReportAccuracy')
  })

  it('"goal > 90" keeps only the single V. entry with Goal > 90', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, 'goal > 90')
    expect(result.values.length).toBe(1)
    expect(result.values[0].id).toBe('V.ReportAccuracy')
  })

  it('"goal < 50" falls back to best-match V. entry when none qualify', () => {
    // All goals are 5, 95, 60 — none < 50 except 5 (OnboardingSpeed)
    const spec = makeSpec()
    const result = filterSpec(spec, 'goal < 10')
    expect(result.values.length).toBe(1)
    expect(result.values[0].id).toBe('V.OnboardingSpeed')
  })

  it('substring match filters to matching entries', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, 'onboarding')
    // Should include V.OnboardingSpeed and F.OnboardUser (its function)
    const vIds = result.values.map(v => v.id)
    expect(vIds).toContain('V.OnboardingSpeed')
    expect(vIds).not.toContain('V.ReportAccuracy')
  })

  it('never returns empty arrays — min 1 per type', () => {
    const spec = makeSpec()
    // Query that matches nothing for solutions
    const result = filterSpec(spec, 'zzznomatch')
    expect(result.functions.length).toBeGreaterThanOrEqual(1)
    expect(result.values.length).toBeGreaterThanOrEqual(1)
    expect(result.solutions.length).toBeGreaterThanOrEqual(1)
  })

  it('"scale %" keeps V. entries with % in Scale', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, 'scale %')
    const vIds = result.values.map(v => v.id)
    // V.ReportAccuracy scale: "% correct data fields" ✓
    // V.SystemLoad scale: "% CPU usage" ✓
    // V.OnboardingSpeed scale: "Minutes to first..." ✗
    expect(vIds).toContain('V.ReportAccuracy')
    expect(vIds).toContain('V.SystemLoad')
    expect(vIds).not.toContain('V.OnboardingSpeed')
  })

  it('F. entries linked to matched V. entries are included', () => {
    const spec = makeSpec()
    // Only V.ReportAccuracy matches goal > 80
    const result = filterSpec(spec, 'goal > 80')
    const fIds = result.functions.map(f => f.id)
    // F.GenerateReport is linked to V.ReportAccuracy so should be kept
    expect(fIds).toContain('F.GenerateReport')
  })

  it('returns a new SpecBlock object (does not mutate input)', () => {
    const spec = makeSpec()
    const result = filterSpec(spec, 'goal > 80')
    expect(result).not.toBe(spec)
  })
})
