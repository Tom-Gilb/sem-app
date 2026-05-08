// UNIT_TYPE=Test
// Feature #54 — Tests for useTimeCapsule composable

import { describe, it, expect } from 'vitest'
import { useTimeCapsule } from '../useTimeCapsule'
import type { SpecBlock } from '../../types/spec'

const mockSpec: SpecBlock = {
  functions: [
    {
      id: 'F.ProvideDashboard',
      type: 'Function',
      level: 'Product',
      description: 'Provide a real-time analytics dashboard',
      successCriteria: 'Dashboard loads in under 2s',
      functionOfValue: 'V.DashboardSpeed',
    },
  ],
  values: [
    {
      id: 'V.DashboardSpeed',
      type: 'Value',
      level: 'Product',
      description: 'Time for dashboard to fully render',
      scale: 'seconds',
      meter: 'Lighthouse CI',
      status: '4s',
      tolerable: '3s',
      goal: '1.5s',
      valueOfFunction: 'F.ProvideDashboard',
    },
    {
      id: 'V.UserSatisfaction',
      type: 'Value',
      level: 'Stakeholder',
      description: 'User satisfaction with the product',
      scale: 'NPS score 0–10',
      meter: 'Quarterly survey',
      status: '6',
      tolerable: '7',
      goal: '9',
      valueOfFunction: 'F.ProvideDashboard',
    },
  ],
  solutions: [
    {
      id: 'S.CacheLayer',
      type: 'Solution',
      level: 'Product',
      description: 'CDN cache layer for static assets',
      impact: 'V.DashboardSpeed ~2s',
      function: 'F.ProvideDashboard',
    },
  ],
}

const specWithNoValues: SpecBlock = {
  functions: [
    {
      id: 'F.Login',
      type: 'Function',
      level: 'Product',
      description: 'Allow users to log in',
      successCriteria: 'Login completes in < 3s',
      functionOfValue: '',
    },
  ],
  values: [],
  solutions: [],
}

describe('useTimeCapsule', () => {
  it('report starts null', () => {
    const { report } = useTimeCapsule()
    expect(report.value).toBeNull()
  })

  it('generateReport makes report non-null', () => {
    const { report, generateReport } = useTimeCapsule()
    generateReport(mockSpec)
    expect(report.value).not.toBeNull()
  })

  it('report.items.length equals mockSpec.values.length', () => {
    const { report, generateReport } = useTimeCapsule()
    generateReport(mockSpec)
    expect(report.value!.items).toHaveLength(mockSpec.values.length)
  })

  it('each item has entryId, question, currentGoal, currentStatus', () => {
    const { report, generateReport } = useTimeCapsule()
    generateReport(mockSpec)
    for (const item of report.value!.items) {
      expect(item).toHaveProperty('entryId')
      expect(item).toHaveProperty('question')
      expect(item).toHaveProperty('currentGoal')
      expect(item).toHaveProperty('currentStatus')
      expect(typeof item.entryId).toBe('string')
      expect(typeof item.question).toBe('string')
      expect(typeof item.currentGoal).toBe('string')
      expect(typeof item.currentStatus).toBe('string')
    }
  })

  it('report.markdown includes V. entry IDs', () => {
    const { report, generateReport } = useTimeCapsule()
    generateReport(mockSpec)
    expect(report.value!.markdown).toContain('V.DashboardSpeed')
    expect(report.value!.markdown).toContain('V.UserSatisfaction')
  })

  it('changing horizonDays and calling generateReport changes reviewDate', () => {
    const { report, horizonDays, generateReport } = useTimeCapsule()

    horizonDays.value = 30
    generateReport(mockSpec)
    const date30 = new Date(report.value!.reviewDate)

    horizonDays.value = 90
    generateReport(mockSpec)
    const date90 = new Date(report.value!.reviewDate)

    expect(date90.getTime()).toBeGreaterThan(date30.getTime())
  })

  it('generateReport with no V. entries produces items.length === 0, markdown still has health section', () => {
    const { report, generateReport } = useTimeCapsule()
    generateReport(specWithNoValues)
    expect(report.value!.items).toHaveLength(0)
    expect(report.value!.markdown).toContain('Spec Health')
  })

  it('capsuleCopied starts false', () => {
    const { capsuleCopied } = useTimeCapsule()
    expect(capsuleCopied.value).toBe(false)
  })

  it('horizonDays defaults to 30', () => {
    const { horizonDays } = useTimeCapsule()
    expect(horizonDays.value).toBe(30)
  })
})
