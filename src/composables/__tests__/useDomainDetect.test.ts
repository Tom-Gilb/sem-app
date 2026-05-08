// UNIT_TYPE=Composable
// Tests for useDomainDetect — Feature #20 Domain Auto-Detect Badge

import { describe, it, expect } from 'vitest'
import { useDomainDetect } from '../useDomainDetect'
import type { SpecBlock } from '../../types/spec'

function makeSpec(descriptions: string[]): SpecBlock {
  const [fDesc = '', vDesc = '', sDesc = ''] = descriptions
  return {
    functions: fDesc
      ? [{ id: 'F.Test', type: 'Function', level: 'Product', description: fDesc, successCriteria: '', functionOfValue: '' }]
      : [],
    values: vDesc
      ? [{ id: 'V.Test', type: 'Value', level: 'Product', description: vDesc, scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '' }]
      : [],
    solutions: sDesc
      ? [{ id: 'S.Test', type: 'Solution', level: 'Product', description: sDesc, impact: '', function: '' }]
      : [],
  }
}

describe('useDomainDetect', () => {
  const { detectDomain } = useDomainDetect()

  describe('Engineering domain', () => {
    it('detects Engineering from engineering keywords', () => {
      const spec = makeSpec([
        'We need to implement and deploy a new software pipeline',
        'Build the architecture for the API system',
        'The code algorithm will be deployed',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('Engineering')
    })

    it('returns high confidence when ≥3 keyword matches', () => {
      const spec = makeSpec([
        'implement the build and deploy process for the software system API code pipeline algorithm architecture',
      ])
      const { confidence } = detectDomain(spec)
      expect(confidence).toBe('high')
    })
  })

  describe('Product domain', () => {
    it('detects Product from product keywords', () => {
      const spec = makeSpec([
        'Improve user onboarding and customer retention',
        'Feature conversion growth drives product UX improvements',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('Product')
    })

    it('returns high confidence for 3+ product keyword matches', () => {
      const spec = makeSpec([
        'user feature customer onboarding retention conversion growth product UX',
      ])
      const { confidence } = detectDomain(spec)
      expect(confidence).toBe('high')
    })
  })

  describe('Personal domain', () => {
    it('detects Personal from personal keywords', () => {
      const spec = makeSpec([
        'Build a daily habit for health and fitness',
        'Morning routine to learn a new skill',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('Personal')
    })
  })

  describe('Business domain', () => {
    it('detects Business from business keywords', () => {
      const spec = makeSpec([
        'Increase revenue and profit through better sales strategy',
        'Client contract market ROI',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('Business')
    })
  })

  describe('Research domain', () => {
    it('detects Research from research keywords', () => {
      const spec = makeSpec([
        'Run an experiment to test the hypothesis',
        'Survey and data analysis to validate the finding',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('Research')
    })
  })

  describe('General fallback', () => {
    it('returns General when no domain has ≥2 keyword matches', () => {
      const spec = makeSpec([
        'Do the thing and make it work correctly',
        'Improve everything across all areas',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('General')
    })

    it('returns General for an empty spec', () => {
      const spec: SpecBlock = { functions: [], values: [], solutions: [] }
      const { domain } = detectDomain(spec)
      expect(domain).toBe('General')
    })

    it('returns low confidence for General', () => {
      const spec: SpecBlock = { functions: [], values: [], solutions: [] }
      const { confidence } = detectDomain(spec)
      expect(confidence).toBe('low')
    })
  })

  describe('Confidence threshold', () => {
    it('returns low confidence when highest score is 1', () => {
      const spec = makeSpec([
        'There is one software reference only here',
      ])
      // "software" is 1 match — below 2, so General + low confidence
      const { confidence } = detectDomain(spec)
      expect(confidence).toBe('low')
    })

    it('returns low confidence when highest score is exactly 2', () => {
      // Two engineering keywords → wins over General (score ≥2), but confidence is low (< 3)
      const spec = makeSpec([
        'implement and build the thing',
      ])
      const { domain, confidence } = detectDomain(spec)
      expect(domain).toBe('Engineering')
      expect(confidence).toBe('low')
    })

    it('returns high confidence when highest score is ≥3', () => {
      const spec = makeSpec([
        'implement build deploy the system',
      ])
      const { confidence } = detectDomain(spec)
      expect(confidence).toBe('high')
    })
  })

  describe('Tie-breaking', () => {
    it('picks first domain in list order on tie', () => {
      // Engineering keywords and Product keywords both at 2 — Engineering wins (first in list)
      const spec = makeSpec([
        'implement build the user feature',
      ])
      const { domain } = detectDomain(spec)
      expect(domain).toBe('Engineering')
    })
  })
})
