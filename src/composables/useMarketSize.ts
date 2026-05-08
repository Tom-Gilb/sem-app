// UNIT_TYPE=Composable
// useMarketSize — Spec "market size" estimator
// Feature #100 — Market Size

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

interface MarketSizeEstimate {
  tam: number       // Total Addressable Market ($M)
  sam: number       // Serviceable Addressable Market ($M)
  som: number       // Serviceable Obtainable Market ($M)
  tamLabel: string  // "Global practitioners..."
  samLabel: string  // "Target segment..."
  somLabel: string  // "Achievable in 12 months..."
  rationale: string // brief explanation
}

// Keyword → market multiplier
const DOMAIN_MULTIPLIERS: Record<string, { tam: number; sam: number; som: number }> = {
  engineering: { tam: 5000, sam: 500, som: 25 },
  product:     { tam: 8000, sam: 800, som: 40 },
  business:    { tam: 12000, sam: 1200, som: 60 },
  research:    { tam: 2000, sam: 200, som: 10 },
  personal:    { tam: 500,  sam: 50,  som: 2.5 },
  general:     { tam: 3000, sam: 300, som: 15 },
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  engineering: ['implement', 'build', 'deploy', 'architecture', 'system', 'api', 'code', 'software', 'pipeline', 'algorithm'],
  product:     ['user', 'feature', 'customer', 'onboarding', 'retention', 'conversion', 'growth', 'product', 'ux'],
  business:    ['revenue', 'profit', 'cost', 'market', 'sales', 'strategy', 'stakeholder', 'roi', 'client', 'contract'],
  research:    ['study', 'measure', 'data', 'analysis', 'hypothesis', 'experiment', 'finding', 'survey'],
  personal:    ['habit', 'health', 'learn', 'goal', 'skill', 'fitness', 'daily', 'routine', 'morning', 'career'],
}

function detectDomain(spec: SpecBlock): string {
  const allText = [
    ...spec.functions.map(f => f.description),
    ...spec.values.map(v => v.description),
    ...spec.solutions.map(s => s.description),
  ]
    .join(' ')
    .toLowerCase()

  const scores: Record<string, number> = {}
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    scores[domain] = 0
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = allText.match(regex)
      if (matches) scores[domain] += matches.length
    }
  }

  let best = 'general'
  let bestScore = 1 // require at least 2 hits

  for (const [domain, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      best = domain
    }
  }

  return best
}

export function useMarketSize(spec: Ref<SpecBlock | null>) {
  const marketOpen = ref(false)
  const estimate = ref<MarketSizeEstimate | null>(null)

  function estimateMarket(): void {
    if (!spec.value) {
      estimate.value = null
      return
    }

    const domain = detectDomain(spec.value)
    const multipliers = DOMAIN_MULTIPLIERS[domain] ?? DOMAIN_MULTIPLIERS['general']

    const totalBlocks =
      spec.value.functions.length +
      spec.value.values.length +
      spec.value.solutions.length

    // Entry-count scaling: × (1 + totalBlocks / 20), capped at 2
    const scale = Math.min(2, 1 + totalBlocks / 20)

    const tam = Math.round(multipliers.tam * scale)
    const sam = Math.round(multipliers.sam * scale)
    const som = Math.round(multipliers.som * scale * 10) / 10

    estimate.value = {
      tam,
      sam,
      som,
      tamLabel: `Global practitioners in the ${domain} domain`,
      samLabel: `Target segment reachable with this product`,
      somLabel: `Achievable in 12 months with current positioning`,
      rationale: `Domain detected as "${domain}" with ${totalBlocks} spec entries. TAM/SAM/SOM scaled by ${scale.toFixed(2)}× for entry depth.`,
    }
  }

  async function copyMarketSummary(): Promise<void> {
    if (!estimate.value) return
    const { tam, sam, som, rationale } = estimate.value
    const text = [
      '## Market Size Estimate',
      `TAM: $${tam}M | SAM: $${sam}M | SOM: $${som}M`,
      '',
      `Rationale: ${rationale}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard not available in test / SSR environment
    }
  }

  return { marketOpen, estimate, estimateMarket, copyMarketSummary }
}
