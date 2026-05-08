// UNIT_TYPE=Test
// Feature #60 — useSpecGapAnalyser composable tests

import { describe, it, expect } from 'vitest'
import { useSpecGapAnalyser } from '../useSpecGapAnalyser'
import type { SpecBlock } from '../../types/spec'

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

const productSpecWithAdoption: SpecBlock = {
  functions: [
    {
      id: 'F.Onboard',
      type: 'Function',
      level: 'Product',
      description: 'Provide user onboarding flow for product feature activation',
      successCriteria: 'Users complete flow',
      functionOfValue: 'V.AdoptionRate',
    },
  ],
  values: [
    {
      id: 'V.AdoptionRate',
      type: 'Value',
      level: 'Product',
      description: 'Monthly active user adoption rate',
      scale: '% of target users actively using the feature per month',
      meter: 'Analytics dashboard',
      status: '20%',
      tolerable: '40%',
      goal: '70%',
      valueOfFunction: 'F.Onboard',
    },
    {
      id: 'V.UserRetention',
      type: 'Value',
      level: 'Product',
      description: 'User retention rate after first use',
      scale: '% of users still active after 30 days return visit',
      meter: 'Analytics',
      status: '50%',
      tolerable: '60%',
      goal: '75%',
      valueOfFunction: 'F.Onboard',
    },
    {
      id: 'V.ResponseTime',
      type: 'Value',
      level: 'Product',
      description: 'Page load response time in ms',
      scale: 'ms at 95th percentile',
      meter: 'Synthetic monitoring',
      status: '800ms',
      tolerable: '500ms',
      goal: '200ms',
      valueOfFunction: 'F.Onboard',
    },
  ],
  solutions: [],
}

const engineeringSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Deploy',
      type: 'Function',
      level: 'Solution',
      description: 'Deploy API to production server with database uptime guarantee',
      successCriteria: 'API is reachable',
      functionOfValue: 'V.Avail',
    },
  ],
  values: [
    {
      id: 'V.Avail',
      type: 'Value',
      level: 'Solution',
      description: 'API uptime and availability SLA',
      scale: '% uptime over 30 days',
      meter: 'Uptime monitor',
      status: '99.0%',
      tolerable: '99.5%',
      goal: '99.9%',
      valueOfFunction: 'F.Deploy',
    },
  ],
  solutions: [],
}

describe('useSpecGapAnalyser', () => {
  describe('initial state', () => {
    it('gaps starts empty', () => {
      const { gaps } = useSpecGapAnalyser()
      expect(gaps.value).toEqual([])
    })

    it('detectedDomain starts as empty string', () => {
      const { detectedDomain } = useSpecGapAnalyser()
      expect(detectedDomain.value).toBe('')
    })

    it('selectedTemplate starts as Auto', () => {
      const { selectedTemplate } = useSpecGapAnalyser()
      expect(selectedTemplate.value).toBe('Auto')
    })
  })

  describe('analyseGaps', () => {
    it('empty spec produces gaps > 0', () => {
      const { gaps, analyseGaps } = useSpecGapAnalyser()
      analyseGaps(emptySpec)
      expect(gaps.value.length).toBeGreaterThan(0)
    })

    it('detectedDomain is set after analysis', () => {
      const { detectedDomain, analyseGaps } = useSpecGapAnalyser()
      analyseGaps(emptySpec)
      expect(detectedDomain.value).not.toBe('')
    })

    it('each gap has required fields', () => {
      const { gaps, analyseGaps } = useSpecGapAnalyser()
      analyseGaps(emptySpec)
      for (const gap of gaps.value) {
        expect(gap).toHaveProperty('id')
        expect(gap).toHaveProperty('category')
        expect(gap).toHaveProperty('description')
        expect(gap).toHaveProperty('template')
        expect(gap).toHaveProperty('severity')
        expect(gap).toHaveProperty('exampleEntry')
      }
    })

    it('severity is one of critical, recommended, optional', () => {
      const { gaps, analyseGaps } = useSpecGapAnalyser()
      analyseGaps(emptySpec)
      for (const gap of gaps.value) {
        expect(['critical', 'recommended', 'optional']).toContain(gap.severity)
      }
    })

    it('spec with adoption keywords does not flag g-product-1', () => {
      const { gaps, analyseGaps } = useSpecGapAnalyser()
      // Force Product template to match g-product-1
      analyseGaps(productSpecWithAdoption)
      const adoptionGap = gaps.value.find(g => g.id === 'g-product-1')
      expect(adoptionGap).toBeUndefined()
    })

    it('spec with retention keywords does not flag g-product-2', () => {
      const { gaps, analyseGaps } = useSpecGapAnalyser()
      analyseGaps(productSpecWithAdoption)
      const retentionGap = gaps.value.find(g => g.id === 'g-product-2')
      expect(retentionGap).toBeUndefined()
    })

    it('spec with latency/ms keywords does not flag g-product-3', () => {
      const { gaps, analyseGaps } = useSpecGapAnalyser()
      analyseGaps(productSpecWithAdoption)
      const perfGap = gaps.value.find(g => g.id === 'g-product-3')
      expect(perfGap).toBeUndefined()
    })
  })

  describe('selectedTemplate override', () => {
    it('selectedTemplate = Engineering → uses Engineering gaps', () => {
      const { gaps, detectedDomain, selectedTemplate, analyseGaps } = useSpecGapAnalyser()
      selectedTemplate.value = 'Engineering'
      // Use a spec that would otherwise auto-detect as Product
      analyseGaps(productSpecWithAdoption)
      expect(detectedDomain.value).toBe('Engineering')
      // Engineering gaps should be present (g-eng-* ids)
      const hasEngGap = gaps.value.some(g => g.id.startsWith('g-eng-'))
      expect(hasEngGap).toBe(true)
    })

    it('engineering spec with uptime keywords does not flag g-eng-1', () => {
      const { gaps, selectedTemplate, analyseGaps } = useSpecGapAnalyser()
      selectedTemplate.value = 'Engineering'
      analyseGaps(engineeringSpec)
      const availGap = gaps.value.find(g => g.id === 'g-eng-1')
      expect(availGap).toBeUndefined()
    })

    it('selectedTemplate = Auto detects domain from spec content', () => {
      const { detectedDomain, selectedTemplate, analyseGaps } = useSpecGapAnalyser()
      selectedTemplate.value = 'Auto'
      analyseGaps(engineeringSpec)
      expect(detectedDomain.value).toBe('Engineering')
    })

    it('selectedTemplate = General → uses General gaps', () => {
      const { gaps, selectedTemplate, analyseGaps } = useSpecGapAnalyser()
      selectedTemplate.value = 'General'
      analyseGaps(emptySpec)
      const hasGenGap = gaps.value.some(g => g.id.startsWith('g-gen-'))
      expect(hasGenGap).toBe(true)
    })
  })
})
