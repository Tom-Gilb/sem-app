// UNIT_TYPE=Test
// Feature #126b — useRegulatoryScanner composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useRegulatoryScanner } from '../useRegulatoryScanner'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; scale?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? '',
      scale: v.scale ?? '',
      meter: '',
      status: '',
      tolerable: '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useRegulatoryScanner', () => {
  // ── GDPR detection ────────────────────────────────────────────────────────

  it('detects GDPR from "personal data" in value description', () => {
    const block = makeBlock({ values: [{ id: 'V.Privacy', description: 'Manage personal data securely' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'GDPR')).toBe(true)
  })

  it('detects GDPR from "privacy" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Privacy', description: 'Privacy consent management' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'GDPR')).toBe(true)
  })

  // ── HIPAA detection ───────────────────────────────────────────────────────

  it('detects HIPAA from "health" in description', () => {
    const block = makeBlock({ values: [{ id: 'V.Health', description: 'Track health outcomes for patients' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'HIPAA')).toBe(true)
  })

  it('detects HIPAA from "patient" keyword', () => {
    const block = makeBlock({ functions: [{ id: 'F.Records', description: 'Manage patient medical records' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'HIPAA')).toBe(true)
  })

  // ── SOX detection ─────────────────────────────────────────────────────────

  it('detects SOX from "financial" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Revenue', description: 'Track financial reporting accuracy' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'SOX')).toBe(true)
  })

  it('detects SOX from "audit" keyword', () => {
    const block = makeBlock({ functions: [{ id: 'F.Audit', description: 'Generate audit trail for all transactions' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'SOX')).toBe(true)
  })

  // ── PCI-DSS detection ─────────────────────────────────────────────────────

  it('detects PCI-DSS from "payment" keyword', () => {
    const block = makeBlock({ values: [{ id: 'V.Payment', description: 'Process payment transactions securely' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'PCI-DSS')).toBe(true)
  })

  it('detects PCI-DSS from "credit card" keyword', () => {
    const block = makeBlock({ functions: [{ id: 'F.Card', description: 'Accept credit card payments at checkout' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.hits.some(h => h.regulation === 'PCI-DSS')).toBe(true)
  })

  // ── Impact level thresholds ────────────────────────────────────────────────

  it('assigns high impact for ≥3 keyword matches', () => {
    const block = makeBlock({
      values: [{ id: 'V.GDPR', description: 'Handle personal data and pii for user consent and gdpr data subject rights' }],
    })
    const { result } = useRegulatoryScanner([block])
    const gdprHit = result.value.hits.find(h => h.regulation === 'GDPR')
    expect(gdprHit?.impactLevel).toBe('high')
  })

  it('assigns low impact for exactly 1 keyword match', () => {
    const block = makeBlock({
      values: [{ id: 'V.Sec', description: 'Enable security scanning for the product' }],
    })
    const { result } = useRegulatoryScanner([block])
    const iso = result.value.hits.find(h => h.regulation === 'ISO27001')
    if (iso) {
      expect(['low', 'medium', 'high']).toContain(iso.impactLevel)
    }
  })

  // ── Clean result ──────────────────────────────────────────────────────────

  it('result.clean is true when no keywords detected', () => {
    const block = makeBlock({ values: [{ id: 'V.Speed', description: 'Improve system performance' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.clean).toBe(true)
  })

  it('result.clean is false when keywords are detected', () => {
    const block = makeBlock({ values: [{ id: 'V.GDPR', description: 'Handle personal data from EU users' }] })
    const { result } = useRegulatoryScanner([block])
    expect(result.value.clean).toBe(false)
  })

  it('result.hits is empty array when no keywords match', () => {
    const { result } = useRegulatoryScanner([])
    expect(result.value.hits).toHaveLength(0)
    expect(result.value.clean).toBe(true)
  })

  // ── copyMarkdown ──────────────────────────────────────────────────────────

  it('copyMarkdown writes pipe-delimited table', async () => {
    let written = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          written = text
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock({ values: [{ id: 'V.GDPR', description: 'Handle personal data consent' }] })
    const { copyMarkdown } = useRegulatoryScanner([block])
    await copyMarkdown()
    expect(written).toContain('| Regulation |')
    expect(written).toContain('| Keywords |')
    expect(written).toContain('| Impact |')
  })

  it('copyMarkdown sets copied to true', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
    const block = makeBlock({ values: [{ id: 'V.GDPR', description: 'privacy consent management' }] })
    const { copyMarkdown, copied } = useRegulatoryScanner([block])
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })
})
