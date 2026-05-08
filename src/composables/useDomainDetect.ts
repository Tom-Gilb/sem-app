// UNIT_TYPE=Composable
// useDomainDetect — detects the planning domain from a SpecBlock
// Feature #20 — Domain Auto-Detect Badge

import type { SpecBlock } from '../types/spec'

type Domain = 'Engineering' | 'Product' | 'Personal' | 'Business' | 'Research' | 'General'
type Confidence = 'low' | 'high'

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  Engineering: ['implement', 'build', 'deploy', 'architecture', 'system', 'api', 'code', 'software', 'pipeline', 'algorithm'],
  Product: ['user', 'feature', 'customer', 'onboarding', 'retention', 'conversion', 'growth', 'product', 'ux'],
  Personal: ['habit', 'health', 'learn', 'goal', 'skill', 'fitness', 'daily', 'routine', 'morning', 'career'],
  Business: ['revenue', 'profit', 'cost', 'market', 'sales', 'strategy', 'stakeholder', 'roi', 'client', 'contract'],
  Research: ['study', 'measure', 'data', 'analysis', 'hypothesis', 'experiment', 'finding', 'survey'],
  General: [],
}

// Domain order for tie-breaking (first in list wins)
const DOMAIN_ORDER: Domain[] = ['Engineering', 'Product', 'Personal', 'Business', 'Research', 'General']

export function useDomainDetect() {
  function detectDomain(spec: SpecBlock): { domain: Domain; confidence: Confidence } {
    // Collect all description text from F., V., S. entries
    const allText = [
      ...spec.functions.map(f => f.description),
      ...spec.values.map(v => v.description),
      ...spec.solutions.map(s => s.description),
    ]
      .join(' ')
      .toLowerCase()

    const scores: Record<Domain, number> = {
      Engineering: 0,
      Product: 0,
      Personal: 0,
      Business: 0,
      Research: 0,
      General: 0,
    }

    for (const domain of DOMAIN_ORDER) {
      if (domain === 'General') continue
      for (const keyword of DOMAIN_KEYWORDS[domain]) {
        // Count all occurrences of the keyword (word-boundary match)
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        const matches = allText.match(regex)
        if (matches) {
          scores[domain] += matches.length
        }
      }
    }

    // Find the winning domain (highest score, first in list on tie)
    let winningDomain: Domain = 'General'
    let highScore = 0

    for (const domain of DOMAIN_ORDER) {
      if (domain === 'General') continue
      if (scores[domain] > highScore) {
        highScore = scores[domain]
        winningDomain = domain
      }
    }

    // Default to General if no domain scored ≥2 matches
    if (highScore < 2) {
      winningDomain = 'General'
    }

    const confidence: Confidence = highScore >= 3 ? 'high' : 'low'

    return { domain: winningDomain, confidence }
  }

  return { detectDomain }
}
