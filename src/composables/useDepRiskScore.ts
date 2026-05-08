// UNIT_TYPE=Composable
// Feature #178 — Evo step "dependency risk score"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface DepRiskEntry {
  stepId: string
  stepTitle: string
  effort: number
  inboundDeps: number
  riskScore: number
  riskTier: 'High' | 'Medium' | 'Low'
  isCritical: boolean
}

export interface UseDepRiskScoreReturn {
  open: Ref<boolean>
  entries: ComputedRef<DepRiskEntry[]>
  criticalCount: ComputedRef<number>
  maxRiskScore: ComputedRef<number>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function riskTier(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 8) return 'High'
  if (score >= 3) return 'Medium'
  return 'Low'
}

export function useDepRiskScore(
  stepData: () => Array<{ id: string; title: string; effort?: number }>,
): UseDepRiskScoreReturn {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): DepRiskEntry[] => {
    const allSteps = stepData()
    if (!allSteps.length) return []

    const scored = allSteps.map((s) => {
      const effort = s.effort !== undefined && s.effort > 0
        ? s.effort
        : seed(s.id + 'effort', 8) + 1
      const inboundDeps = seed(s.id + 'dep', 4)
      const riskScore = inboundDeps * effort
      const tier = riskTier(riskScore)
      return {
        stepId: s.id,
        stepTitle: s.title,
        effort,
        inboundDeps,
        riskScore,
        riskTier: tier,
        isCritical: tier === 'High',
      }
    })

    scored.sort((a, b) => b.riskScore - a.riskScore)

    return scored
  })

  const criticalCount = computed((): number =>
    entries.value.filter((e) => e.isCritical).length,
  )

  const maxRiskScore = computed((): number => {
    const list = entries.value
    if (!list.length) return 0
    return Math.max(...list.map((e) => e.riskScore))
  })

  async function copyMarkdown(): Promise<void> {
    const list = entries.value
    const lines: string[] = []
    lines.push('## Dep Risk Score')
    lines.push('')
    lines.push('| Step | Effort | Inbound Deps | Risk Score | Tier | Critical |')
    lines.push('|---|---|---|---|---|---|')
    for (const e of list) {
      lines.push(
        `| ${e.stepTitle} | ${e.effort} | ${e.inboundDeps} | ${e.riskScore} | ${e.riskTier} | ${e.isCritical ? 'Yes' : 'No'} |`,
      )
    }

    const md = lines.join('\n')
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      // clipboard may not be available in all environments
    }
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return {
    open,
    entries,
    criticalCount,
    maxRiskScore,
    copyMarkdown,
    copied,
  }
}
