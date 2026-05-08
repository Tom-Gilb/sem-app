// UNIT_TYPE=Composable
// Feature #126 — Regulatory Impact Scanner
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export type Regulation = 'GDPR' | 'HIPAA' | 'SOX' | 'PCI-DSS'

export interface RegImpact {
  regulation: Regulation
  blockId: string
  blockName: string
  triggeredBy: string[]
  impactLevel: 'high' | 'medium' | 'low'
  note: string
}

const KEYWORD_BANKS: Record<Regulation, string[]> = {
  GDPR: ['personal', 'data', 'privacy', 'consent', 'user', 'retention', 'delete', 'gdpr', 'eu', 'european', 'subject', 'processing'],
  HIPAA: ['health', 'medical', 'patient', 'phi', 'hipaa', 'clinical', 'diagnosis', 'treatment', 'record', 'healthcare', 'hospital'],
  SOX: ['financial', 'audit', 'report', 'control', 'sox', 'compliance', 'accounting', 'disclosure', 'executive', 'internal', 'fraud'],
  'PCI-DSS': ['payment', 'card', 'credit', 'pci', 'transaction', 'billing', 'merchant', 'stripe', 'checkout', 'cvv', 'tokenization'],
}

const REGULATION_NOTES: Record<Regulation, string> = {
  GDPR: 'Data protection requirements may apply — review Article 5 principles',
  HIPAA: 'PHI handling rules may apply — review safeguard requirements',
  SOX: 'Financial reporting controls may apply — review Section 302/404',
  'PCI-DSS': 'Payment data security requirements may apply — review PCI DSS v4.0',
}

function getBlockText(block: SpecBlock): string {
  const parts: string[] = []
  for (const f of block.functions) {
    parts.push(f.id, f.description)
  }
  for (const v of block.values) {
    parts.push(v.id, v.description)
  }
  for (const s of block.solutions) {
    parts.push(s.id, s.description)
  }
  return parts.join(' ').toLowerCase()
}

function getBlockId(block: SpecBlock): string {
  return block.values[0]?.id ?? block.functions[0]?.id ?? block.solutions[0]?.id ?? 'unknown'
}

function getBlockName(block: SpecBlock): string {
  return block.values[0]?.id ?? block.functions[0]?.id ?? block.solutions[0]?.id ?? 'Unknown'
}

function impactLevel(matchCount: number): 'high' | 'medium' | 'low' {
  if (matchCount >= 3) return 'high'
  if (matchCount === 2) return 'medium'
  return 'low'
}

function scanBlock(block: SpecBlock, regulation: Regulation): RegImpact | null {
  const text = getBlockText(block)
  const keywords = KEYWORD_BANKS[regulation]
  const triggered = keywords.filter(kw => text.includes(kw))
  if (triggered.length === 0) return null
  return {
    regulation,
    blockId: getBlockId(block),
    blockName: getBlockName(block),
    triggeredBy: triggered,
    impactLevel: impactLevel(triggered.length),
    note: REGULATION_NOTES[regulation],
  }
}

const ALL_REGULATIONS: Regulation[] = ['GDPR', 'HIPAA', 'SOX', 'PCI-DSS']

export function useRegulatoryImpact(blocks: SpecBlock[]) {
  const copied: Ref<boolean> = ref(false)
  const activeFilter: Ref<Regulation | 'All'> = ref('All')

  const impacts = computed<RegImpact[]>(() => {
    const results: RegImpact[] = []
    for (const block of blocks) {
      for (const reg of ALL_REGULATIONS) {
        const impact = scanBlock(block, reg)
        if (impact) results.push(impact)
      }
    }
    return results
  })

  const filteredImpacts = computed<RegImpact[]>(() => {
    if (activeFilter.value === 'All') return impacts.value
    return impacts.value.filter(i => i.regulation === activeFilter.value)
  })

  const highCount = computed<number>(() =>
    impacts.value.filter(i => i.impactLevel === 'high').length
  )

  const regulationSummary = computed<Record<Regulation, number>>(() => {
    const counts: Record<Regulation, number> = { GDPR: 0, HIPAA: 0, SOX: 0, 'PCI-DSS': 0 }
    for (const impact of impacts.value) {
      counts[impact.regulation]++
    }
    return counts
  })

  function setFilter(r: Regulation | 'All'): void {
    activeFilter.value = r
  }

  async function copyBrief(): Promise<void> {
    const sections: string[] = ['# Regulatory Impact Brief\n']
    for (const reg of ALL_REGULATIONS) {
      const regImpacts = impacts.value.filter(i => i.regulation === reg)
      if (regImpacts.length === 0) continue
      sections.push(`## ${reg}`)
      sections.push(`_${REGULATION_NOTES[reg]}_\n`)
      for (const impact of regImpacts) {
        sections.push(
          `- **${impact.blockName}** — ${impact.impactLevel.toUpperCase()} | Keywords: ${impact.triggeredBy.join(', ')}`
        )
      }
      sections.push('')
    }
    const text = sections.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    impacts,
    activeFilter,
    setFilter,
    filteredImpacts,
    highCount,
    regulationSummary,
    copyBrief,
    copied,
  }
}
