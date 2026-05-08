// UNIT_TYPE=Test
// Feature #126 — useRegulatoryImpact composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useRegulatoryImpact } from '../useRegulatoryImpact'
import type { SpecBlock } from '../../types/spec'
import type { Regulation } from '../useRegulatoryImpact'

function makeBlock(opts: {
  fDesc?: string
  vId?: string
  vDesc?: string
  sDesc?: string
} = {}): SpecBlock {
  return {
    functions: opts.fDesc
      ? [{
          id: 'F.Test',
          type: 'Function',
          level: 'Product',
          description: opts.fDesc,
          successCriteria: '',
          functionOfValue: '',
        }]
      : [],
    values: opts.vDesc
      ? [{
          id: opts.vId ?? 'V.Test',
          type: 'Value',
          level: 'Product',
          description: opts.vDesc,
          scale: '',
          meter: '',
          status: '',
          tolerable: '',
          goal: '',
          valueOfFunction: '',
        }]
      : [],
    solutions: opts.sDesc
      ? [{
          id: 'S.Test',
          type: 'Solution',
          level: 'Product',
          description: opts.sDesc,
          impact: '',
          function: '',
        }]
      : [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRegulatoryImpact — keyword matching', () => {
  it('detects GDPR from "personal data" keywords', () => {
    const block = makeBlock({ vDesc: 'handles personal data of users' })
    const { impacts } = useRegulatoryImpact([block])
    const gdpr = impacts.value.find(i => i.regulation === 'GDPR')
    expect(gdpr).toBeDefined()
    expect(gdpr?.triggeredBy).toContain('personal')
    expect(gdpr?.triggeredBy).toContain('data')
  })

  it('detects HIPAA from "patient health record" keywords', () => {
    const block = makeBlock({ vDesc: 'stores patient health record for clinical use' })
    const { impacts } = useRegulatoryImpact([block])
    const hipaa = impacts.value.find(i => i.regulation === 'HIPAA')
    expect(hipaa).toBeDefined()
    expect(hipaa?.triggeredBy).toContain('patient')
    expect(hipaa?.triggeredBy).toContain('health')
  })

  it('detects SOX from "financial audit" keywords', () => {
    const block = makeBlock({ vDesc: 'financial audit of internal control systems' })
    const { impacts } = useRegulatoryImpact([block])
    const sox = impacts.value.find(i => i.regulation === 'SOX')
    expect(sox).toBeDefined()
    expect(sox?.triggeredBy).toContain('financial')
    expect(sox?.triggeredBy).toContain('audit')
  })

  it('detects PCI-DSS from "payment card" keywords', () => {
    const block = makeBlock({ vDesc: 'payment card transaction via stripe checkout' })
    const { impacts } = useRegulatoryImpact([block])
    const pci = impacts.value.find(i => i.regulation === 'PCI-DSS')
    expect(pci).toBeDefined()
    expect(pci?.triggeredBy).toContain('payment')
    expect(pci?.triggeredBy).toContain('card')
  })

  it('excludes blocks with no keyword matches', () => {
    const block = makeBlock({ vDesc: 'optimize rendering pipeline with caching' })
    const { impacts } = useRegulatoryImpact([block])
    expect(impacts.value).toHaveLength(0)
  })

  it('scans function descriptions as well as value descriptions', () => {
    const block = makeBlock({ fDesc: 'process personal data from eu users' })
    const { impacts } = useRegulatoryImpact([block])
    const gdpr = impacts.value.find(i => i.regulation === 'GDPR')
    expect(gdpr).toBeDefined()
  })
})

describe('useRegulatoryImpact — impactLevel thresholds', () => {
  it('assigns high impact for ≥3 keyword matches', () => {
    // GDPR keywords: personal, data, privacy, consent, user
    const block = makeBlock({ vDesc: 'personal data privacy consent user management system' })
    const { impacts } = useRegulatoryImpact([block])
    const gdpr = impacts.value.find(i => i.regulation === 'GDPR')
    expect(gdpr?.impactLevel).toBe('high')
  })

  it('assigns medium impact for exactly 2 keyword matches', () => {
    // Only 2 GDPR keywords: eu, european
    const block = makeBlock({ vDesc: 'european eu product management' })
    const { impacts } = useRegulatoryImpact([block])
    const gdpr = impacts.value.find(i => i.regulation === 'GDPR')
    expect(gdpr?.impactLevel).toBe('medium')
  })

  it('assigns low impact for exactly 1 keyword match', () => {
    // Only 1 GDPR keyword: consent
    const block = makeBlock({ vDesc: 'users must provide consent during onboarding flow' })
    const { impacts } = useRegulatoryImpact([block])
    const gdpr = impacts.value.find(i => i.regulation === 'GDPR')
    // "users" + "consent" = 2 → medium; let's use a word without "user"
    const block2 = makeBlock({ vDesc: 'must provide consent to proceed' })
    const { impacts: impacts2 } = useRegulatoryImpact([block2])
    const gdpr2 = impacts2.value.find(i => i.regulation === 'GDPR')
    expect(gdpr2?.impactLevel).toBe('low')
  })
})

describe('useRegulatoryImpact — filter', () => {
  it('filteredImpacts returns all when filter is All', () => {
    const block = makeBlock({ vDesc: 'personal data payment card financial audit patient health' })
    const { filteredImpacts, activeFilter } = useRegulatoryImpact([block])
    expect(activeFilter.value).toBe('All')
    expect(filteredImpacts.value.length).toBeGreaterThan(0)
  })

  it('setFilter narrows filteredImpacts to one regulation', () => {
    const block = makeBlock({ vDesc: 'personal data privacy payment card stripe checkout' })
    const { filteredImpacts, setFilter } = useRegulatoryImpact([block])
    setFilter('GDPR')
    const regs = filteredImpacts.value.map(i => i.regulation)
    expect(regs.every(r => r === 'GDPR')).toBe(true)
  })

  it('setFilter back to All shows all impacts', () => {
    const block = makeBlock({ vDesc: 'personal data privacy payment card stripe checkout' })
    const { filteredImpacts, impacts, setFilter } = useRegulatoryImpact([block])
    setFilter('PCI-DSS')
    setFilter('All')
    expect(filteredImpacts.value.length).toBe(impacts.value.length)
  })
})

describe('useRegulatoryImpact — summary counts', () => {
  it('regulationSummary counts impacts per regulation', () => {
    const b1 = makeBlock({ vDesc: 'personal data privacy consent user' })
    const b2 = makeBlock({ vDesc: 'payment card transaction pci' })
    const { regulationSummary } = useRegulatoryImpact([b1, b2])
    expect(regulationSummary.value.GDPR).toBeGreaterThan(0)
    expect(regulationSummary.value['PCI-DSS']).toBeGreaterThan(0)
    expect(regulationSummary.value.HIPAA).toBe(0)
    expect(regulationSummary.value.SOX).toBe(0)
  })

  it('highCount counts only high-impact entries', () => {
    const block = makeBlock({ vDesc: 'personal data privacy consent user retention delete gdpr' })
    const { highCount } = useRegulatoryImpact([block])
    expect(highCount.value).toBeGreaterThan(0)
  })

  it('highCount is 0 when there are no impacts', () => {
    const block = makeBlock({ vDesc: 'optimize rendering pipeline' })
    const { highCount } = useRegulatoryImpact([block])
    expect(highCount.value).toBe(0)
  })
})

describe('useRegulatoryImpact — copyBrief', () => {
  it('copyBrief writes markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn((t: string) => {
          written.push(t)
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock({ vDesc: 'personal data privacy consent user retention' })
    const { copyBrief } = useRegulatoryImpact([block])
    await copyBrief()
    expect(written[0]).toContain('GDPR')
  })

  it('copyBrief includes regulation note', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn((t: string) => {
          written.push(t)
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock({ vDesc: 'personal data privacy consent user' })
    const { copyBrief } = useRegulatoryImpact([block])
    await copyBrief()
    expect(written[0]).toContain('Article 5')
  })

  it('copied starts false', () => {
    const { copied } = useRegulatoryImpact([])
    expect(copied.value).toBe(false)
  })
})
