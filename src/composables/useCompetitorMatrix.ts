// UNIT_TYPE=Composable
// Feature #131 — Spec Competitor Matrix
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface Competitor {
  name: string
  features: Record<string, boolean>
  differentiator: string | null
}

export interface CompetitorMatrix {
  featureIds: string[]
  featureNames: string[]
  competitors: Competitor[]
  ourDifferentiators: string[]
}

const DOMAIN_COMPETITORS: Record<string, string[]> = {
  tech: ['Jira', 'Linear', 'Notion'],
  health: ['Epic', 'Cerner', 'Athenahealth'],
  finance: ['Stripe', 'Plaid', 'Brex'],
  default: ['Alpha Solutions', 'Beta Platform', 'Gamma Suite'],
}

const TECH_KW = ['software', 'api', 'code', 'deploy', 'build', 'system', 'pipeline', 'algorithm', 'implement', 'architecture']
const HEALTH_KW = ['health', 'patient', 'clinical', 'medical', 'ehr', 'hospital', 'care', 'diagnosis', 'treatment', 'pharma']
const FINANCE_KW = ['finance', 'payment', 'revenue', 'invoice', 'billing', 'bank', 'transaction', 'money', 'credit', 'ledger']

function detectDomain(blocks: SpecBlock[]): string {
  const allText = blocks
    .flatMap(b => [
      ...b.functions.map(f => f.description),
      ...b.values.map(v => v.description),
      ...b.solutions.map(s => s.description),
    ])
    .join(' ')
    .toLowerCase()

  let techScore = 0
  let healthScore = 0
  let financeScore = 0

  for (const kw of TECH_KW) if (allText.includes(kw)) techScore++
  for (const kw of HEALTH_KW) if (allText.includes(kw)) healthScore++
  for (const kw of FINANCE_KW) if (allText.includes(kw)) financeScore++

  if (healthScore >= techScore && healthScore >= financeScore && healthScore > 0) return 'health'
  if (financeScore >= techScore && financeScore > 0) return 'finance'
  if (techScore > 0) return 'tech'
  return 'default'
}

export function useCompetitorMatrix(blocks: SpecBlock[]) {
  const matrix = computed<CompetitorMatrix>(() => {
    const domain = detectDomain(blocks)
    const compNames = DOMAIN_COMPETITORS[domain] ?? DOMAIN_COMPETITORS['default']

    const featureIds: string[] = []
    const featureNames: string[] = []

    for (const block of blocks) {
      for (const f of block.functions) {
        if (!featureIds.includes(f.id)) {
          featureIds.push(f.id)
          featureNames.push(f.id)
        }
      }
    }

    const competitors: Competitor[] = compNames.map(name => {
      const features: Record<string, boolean> = {}
      for (const fid of featureIds) {
        const seed = name.charCodeAt(0) + fid.charCodeAt(0)
        features[fid] = (seed % 3) !== 0
      }
      return { name, features, differentiator: null }
    })

    // ourDifferentiators: featureIds where ALL competitors have feature = false
    const ourDifferentiators = featureIds.filter(fid =>
      competitors.every(c => !c.features[fid]),
    )

    // Set differentiator text for each competitor
    for (const comp of competitors) {
      const diffIds = featureIds.filter(fid => !comp.features[fid] && ourDifferentiators.includes(fid))
      if (diffIds.length > 0) {
        comp.differentiator = `We outperform on: ${diffIds.slice(0, 2).join(', ')}`
      }
    }

    return { featureIds, featureNames, competitors, ourDifferentiators }
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const m = matrix.value
    const header = `| Feature | Us | ${m.competitors.map(c => c.name).join(' | ')} |`
    const sep = `|---|---|${m.competitors.map(() => '---').join('|')}|`
    const rows = m.featureIds.map((fid, idx) => {
      const fname = m.featureNames[idx]
      const compCells = m.competitors.map(c => (c.features[fid] ? '✅' : '❌')).join(' | ')
      const diff = m.ourDifferentiators.includes(fid) ? ' ⭐' : ''
      return `| ${fname}${diff} | ✅ | ${compCells} |`
    })
    const text = [header, sep, ...rows].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    matrix,
    copyMarkdown,
    copied,
  }
}
