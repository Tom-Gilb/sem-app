// UNIT_TYPE=Composable
// Feature #146 — Spec "chaos engineering" scenarios
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ChaosCase {
  title: string
  injection: string
  impact: string
  severity: 'high' | 'medium' | 'low'
}

export interface ChaosScenario {
  sEntryId: string
  sEntryName: string
  scenarios: ChaosCase[]
}

const TITLE_BANK: readonly string[] = [
  'Latency spike',
  'Dependency timeout',
  'Data corruption',
  'Resource exhaustion',
  'Network partition',
  'Auth service failure',
  'Cache miss storm',
  'Queue backlog',
]

/** Compute charCode sum of a string (deterministic seed) */
function charCodeSum(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i)
  return sum
}

function buildCases(sId: string, sDescription: string): ChaosCase[] {
  const seed = charCodeSum(sId)
  const bankLen = TITLE_BANK.length // 8

  const title1 = TITLE_BANK[seed % bankLen]
  const title2 = TITLE_BANK[(seed + 4) % bankLen]

  const impact = (sDescription.slice(0, 30) || sId.slice(0, 30)) + ' degraded'

  const severity: ChaosCase['severity'] =
    seed % 3 === 0 ? 'high' : seed % 3 === 1 ? 'medium' : 'low'

  const delay = (seed % 10) + 1 // 1..10
  const errorRate = ((seed % 50) + 5) // 5..54 %

  const injection1 = `Inject ${delay}s delay`
  const injection2 = `Inject ${errorRate}% error rate`

  return [
    { title: title1, injection: injection1, impact, severity },
    { title: title2, injection: injection2, impact, severity },
  ]
}

function buildScenarios(blocks: SpecBlock[]): ChaosScenario[] {
  return blocks.flatMap(block =>
    block.solutions.map(s => ({
      sEntryId: s.id,
      sEntryName: s.id,
      scenarios: buildCases(s.id, s.description),
    })),
  )
}

export function useChaosEngineering(blocks: SpecBlock[]) {
  const chaosScenarios = computed<ChaosScenario[]>(() => buildScenarios(blocks))

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = []
    for (const scenario of chaosScenarios.value) {
      lines.push(`## Chaos Scenarios — ${scenario.sEntryId}`)
      lines.push('')
      lines.push('| # | Title | Injection | Impact | Severity |')
      lines.push('|---|-------|-----------|--------|----------|')
      scenario.scenarios.forEach((c, i) => {
        lines.push(`| ${i + 1} | ${c.title} | ${c.injection} | ${c.impact} | ${c.severity} |`)
      })
      lines.push('')
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
    chaosScenarios,
    copyMarkdown,
    copied,
  }
}
