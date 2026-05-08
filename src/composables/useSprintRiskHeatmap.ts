// UNIT_TYPE=Composable
// Feature #188 — Evo step "sprint risk heatmap"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export type RiskTier = 'High' | 'Medium' | 'Low'

export interface HeatmapStep {
  stepId: string
  stepTitle: string
  complexity: number    // 1–5
  depRisk: number       // 1–5
  pairCoverage: number  // 1–5 (inverted: high pair coverage = low risk)
  overallRisk: number   // Math.round((complexity + depRisk + pairCoverage) / 3)
  riskTier: RiskTier
}

export interface UseSprintRiskHeatmapReturn {
  open: Ref<boolean>
  heatSteps: ComputedRef<HeatmapStep[]>
  highRiskCount: ComputedRef<number>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function resolveTier(overallRisk: number): RiskTier {
  if (overallRisk >= 4) return 'High'
  if (overallRisk >= 3) return 'Medium'
  return 'Low'
}

export function useSprintRiskHeatmap(
  steps: () => Array<{ id: string; title: string }>,
): UseSprintRiskHeatmapReturn {
  const open = ref(false)
  const copied = ref(false)

  const heatSteps = computed((): HeatmapStep[] => {
    const allSteps = steps()
    if (!allSteps.length) return []

    return allSteps.map((s) => {
      const complexity = seed(s.id + 'cplx', 5) + 1          // 1–5
      const depRisk = seed(s.id + 'deprisk', 5) + 1          // 1–5
      const pairCoverage = 5 - seed(s.id + 'pair', 5)        // 1–5 (inverted)
      const overallRisk = Math.round((complexity + depRisk + pairCoverage) / 3)
      const riskTier = resolveTier(overallRisk)
      return { stepId: s.id, stepTitle: s.title, complexity, depRisk, pairCoverage, overallRisk, riskTier }
    })
  })

  const highRiskCount = computed((): number =>
    heatSteps.value.filter((s) => s.riskTier === 'High').length,
  )

  async function copyMarkdown(): Promise<void> {
    const list = heatSteps.value
    const lines: string[] = []
    lines.push('## Sprint Risk Heatmap')
    lines.push('')
    lines.push('| Step | Complexity | Dep Risk | Pair Coverage | Overall Risk | Tier |')
    lines.push('|---|---|---|---|---|---|')
    for (const s of list) {
      lines.push(
        `| ${s.stepTitle} | ${s.complexity} | ${s.depRisk} | ${s.pairCoverage} | ${s.overallRisk} | ${s.riskTier} |`,
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
    heatSteps,
    highRiskCount,
    copyMarkdown,
    copied,
  }
}
