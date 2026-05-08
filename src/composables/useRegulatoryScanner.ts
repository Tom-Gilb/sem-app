// UNIT_TYPE=Composable
// Feature #126 — Regulatory Impact Scanner
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type RegName = 'GDPR' | 'HIPAA' | 'SOX' | 'PCI-DSS' | 'CCPA' | 'ISO27001'

export interface RegHit {
  regulation: RegName
  triggerKeywords: string[]
  impactLevel: 'high' | 'medium' | 'low'
  description: string
}

export interface RegScanResult {
  hits: RegHit[]
  clean: boolean
}

const REG_KEYWORDS: Record<RegName, string[]> = {
  GDPR: ['personal data', 'user data', 'privacy', 'consent', 'gdpr', 'data subject', 'pii'],
  HIPAA: ['health', 'medical', 'patient', 'clinical', 'phi', 'hipaa', 'healthcare'],
  SOX: ['financial', 'audit', 'sox', 'accounting', 'revenue', 'compliance', 'reporting'],
  'PCI-DSS': ['payment', 'credit card', 'card data', 'pci', 'transaction', 'billing'],
  CCPA: ['california', 'consumer', 'ccpa', 'opt-out', 'sale of data'],
  ISO27001: ['security', 'information security', 'iso27001', 'vulnerability', 'access control'],
}

const REG_DESCRIPTIONS: Record<RegName, string> = {
  GDPR: 'Data subjects have rights over their personal data; lawful basis for processing is required.',
  HIPAA: 'Protected health information must be safeguarded with appropriate technical and physical controls.',
  SOX: 'Financial reporting controls and audit trails are required for publicly traded companies.',
  'PCI-DSS': 'Cardholder data must be protected with encryption, access controls, and regular audits.',
  CCPA: 'California consumers have the right to know, delete, and opt-out of the sale of their data.',
  ISO27001: 'An information security management system with documented controls and risk assessments is needed.',
}

function impactLevel(matchCount: number): 'high' | 'medium' | 'low' {
  if (matchCount >= 3) return 'high'
  if (matchCount === 2) return 'medium'
  return 'low'
}

function extractText(blocks: SpecBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    for (const v of block.values) {
      parts.push(v.id, v.id, v.description, v.scale)
    }
    for (const f of block.functions) {
      parts.push(f.id, f.id, f.description)
    }
    for (const s of block.solutions) {
      parts.push(s.id, s.description)
    }
  }
  return parts.join(' ').toLowerCase()
}

function scan(blocks: SpecBlock[]): RegScanResult {
  const text = extractText(blocks)
  const hits: RegHit[] = []

  for (const [reg, keywords] of Object.entries(REG_KEYWORDS) as [RegName, string[]][]) {
    const matched = keywords.filter(kw => text.includes(kw))
    if (matched.length > 0) {
      hits.push({
        regulation: reg,
        triggerKeywords: matched,
        impactLevel: impactLevel(matched.length),
        description: REG_DESCRIPTIONS[reg],
      })
    }
  }

  return { hits, clean: hits.length === 0 }
}

export function useRegulatoryScanner(blocks: SpecBlock[]) {
  const scanning = ref(false)
  const copied = ref(false)
  let scanTimer: ReturnType<typeof setTimeout> | null = null

  const result = computed<RegScanResult>(() => scan(blocks))

  function scan_trigger(): void {
    if (scanning.value) return
    scanning.value = true
    if (scanTimer) clearTimeout(scanTimer)
    scanTimer = setTimeout(() => {
      scanning.value = false
      scanTimer = null
    }, 400)
  }

  async function copyMarkdown(): Promise<void> {
    const { hits } = result.value
    if (hits.length === 0) {
      await navigator.clipboard.writeText('No regulatory triggers detected.')
      return
    }
    const header = '| Regulation | Keywords | Impact | Implication |'
    const sep = '|------------|----------|--------|-------------|'
    const rows = hits.map(
      h => `| ${h.regulation} | ${h.triggerKeywords.join(', ')} | ${h.impactLevel} | ${h.description} |`,
    )
    const text = [header, sep, ...rows].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // no-op
    }
  }

  return {
    result,
    scanning,
    scan: scan_trigger,
    copyMarkdown,
    copied,
  }
}
