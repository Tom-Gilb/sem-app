// UNIT_TYPE=Composable
// Feature #190 — Evo step "bug prediction"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export type BugTier = 'Low' | 'Medium' | 'High' | 'Critical'

export interface BugPrediction {
  stepId: string
  stepTitle: string
  complexity: number    // seed(stepId + 'cplx', 5) + 1 → 1–5
  effort: number        // from step.effort if > 0, else seed(stepId + 'ef', 9) + 1 → 1–9
  predictedBugs: number // Math.round(complexity * effort / 5)
  tier: BugTier         // predictedBugs ≥ 6 → 'Critical'; ≥ 4 → 'High'; ≥ 2 → 'Medium'; else 'Low'
  bugEmoji: string      // Low='🟢', Medium='🟡', High='🟠', Critical='🔴'
}

export interface UseBugPredictionReturn {
  open: Ref<boolean>
  predictions: ComputedRef<BugPrediction[]>
  totalPredicted: ComputedRef<number>
  criticalCount: ComputedRef<number>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function resolveTier(predictedBugs: number): BugTier {
  if (predictedBugs >= 6) return 'Critical'
  if (predictedBugs >= 4) return 'High'
  if (predictedBugs >= 2) return 'Medium'
  return 'Low'
}

function resolveBugEmoji(tier: BugTier): string {
  if (tier === 'Low') return '🟢'
  if (tier === 'Medium') return '🟡'
  if (tier === 'High') return '🟠'
  return '🔴'
}

export function useBugPrediction(
  steps: () => Array<{ id: string; title: string; effort?: number }>,
): UseBugPredictionReturn {
  const open = ref(false)
  const copied = ref(false)

  const predictions = computed((): BugPrediction[] => {
    const allSteps = steps()
    if (!allSteps.length) return []

    return allSteps.map((s) => {
      const complexity = seed(s.id + 'cplx', 5) + 1                          // 1–5
      const effort = s.effort != null && s.effort > 0
        ? s.effort
        : seed(s.id + 'ef', 9) + 1                                            // 1–9
      const predictedBugs = Math.round((complexity * effort) / 5)
      const tier = resolveTier(predictedBugs)
      const bugEmoji = resolveBugEmoji(tier)
      return { stepId: s.id, stepTitle: s.title, complexity, effort, predictedBugs, tier, bugEmoji }
    })
  })

  const totalPredicted = computed((): number =>
    predictions.value.reduce((sum, p) => sum + p.predictedBugs, 0),
  )

  const criticalCount = computed((): number =>
    predictions.value.filter((p) => p.tier === 'Critical').length,
  )

  async function copyMarkdown(): Promise<void> {
    const list = predictions.value
    const lines: string[] = []
    lines.push('## Bug Prediction')
    lines.push('')
    lines.push('| Step | Complexity | Effort | Predicted Bugs | Tier |')
    lines.push('|---|---|---|---|---|')
    for (const p of list) {
      lines.push(
        `| ${p.stepTitle} | ${p.complexity} | ${p.effort} | ${p.predictedBugs} | ${p.bugEmoji} ${p.tier} |`,
      )
    }
    lines.push('')
    lines.push(`🐛 ${totalPredicted.value} bugs predicted — ${criticalCount.value} critical`)

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
    predictions,
    totalPredicted,
    criticalCount,
    copyMarkdown,
    copied,
  }
}
