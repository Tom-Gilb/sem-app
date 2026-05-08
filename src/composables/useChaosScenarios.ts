// UNIT_TYPE=Composable
// Feature #146 — Spec "chaos engineering" scenarios
import { computed, ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export type ChaosSeverity = 'high' | 'medium' | 'low'

export interface ChaosScenario {
  title: string
  failureMode: string
  impact: string
  severity: ChaosSeverity
  mitigation: string
}

export interface ChaosEntry {
  blockId: string
  blockName: string
  scenarios: ChaosScenario[]
}

const FAILURE_TEMPLATES = [
  (name: string) => `Complete unavailability of ${name}`,
  (name: string) => `Degraded performance / high latency in ${name}`,
  (name: string) => `Incorrect output / data corruption in ${name}`,
  (name: string) => `Partial failure in ${name} affecting N% of requests`,
]

const IMPACT_TEMPLATES = [
  'Downstream dependent services receive errors; user-facing failures within seconds',
  'SLA breach — response time exceeds Tolerable threshold',
  'Data inconsistency propagates across dependent V. entries',
  'Partial user cohort experiences failure; difficult to detect without alerting',
]

const MITIGATION_TEMPLATES = [
  'Implement circuit breaker + retry with exponential backoff',
  'Add health check endpoint; configure auto-scaling with min instances = 2',
  'Enable write-ahead logging or idempotency keys for all mutations',
  'Deploy canary alongside stable version; monitor error rate differential',
]

/** Compute a numeric seed from a string using char codes */
function charCodeSeed(text: string): number {
  let seed = 0
  for (let i = 0; i < text.length; i++) {
    seed += text.charCodeAt(i)
  }
  return seed
}

function severityFromSeed(seed: number): ChaosSeverity {
  const mod = seed % 3
  if (mod === 0) return 'high'
  if (mod === 1) return 'medium'
  return 'low'
}

export function useChaosScenarios(blocks: SpecBlock[]) {
  const entries = computed<ChaosEntry[]>(() => {
    const allSolutions = blocks.flatMap(b => b.solutions)

    return allSolutions.map(s => {
      const seed = charCodeSeed(s.id)
      const severity = severityFromSeed(seed)

      const scenarios: ChaosScenario[] = [0, 1].map(scenarioIndex => {
        const failureTemplate = FAILURE_TEMPLATES[seed % 4]
        const impact = IMPACT_TEMPLATES[(seed + scenarioIndex) % 4]
        const mitigation = MITIGATION_TEMPLATES[(seed + scenarioIndex + 1) % 4]

        return {
          title: `Scenario ${scenarioIndex + 1}: ${failureTemplate(s.id).toLowerCase()}`,
          failureMode: `What if ${s.id} fails?`,
          impact,
          severity,
          mitigation,
        }
      })

      return {
        blockId: s.id,
        blockName: s.id,
        scenarios,
      }
    })
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = ['# Chaos Engineering Scenarios', '']

    for (const entry of entries.value) {
      lines.push(`## ${entry.blockName}`)
      lines.push('')
      for (const scenario of entry.scenarios) {
        lines.push(`### ${scenario.title}`)
        lines.push(`**Failure Mode:** ${scenario.failureMode}`)
        lines.push(`**Severity:** ${scenario.severity}`)
        lines.push(`**Impact:** ${scenario.impact}`)
        lines.push(`**Mitigation:** ${scenario.mitigation}`)
        lines.push('')
      }
    }

    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    entries,
    copyMarkdown,
    copied,
  }
}
