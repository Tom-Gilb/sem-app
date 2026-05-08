// UNIT_TYPE=Composable
// Feature #183 — Evo step "cycle time tracker"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface CycleStep {
  stepId: string
  stepTitle: string
  leadTime: number
  activeTime: number
  waitTime: number
  cycleTime: number
  flowEfficiency: number
  isBottleneck: boolean
}

export interface UseCycleTimeReturn {
  open: Ref<boolean>
  cycleSteps: ComputedRef<CycleStep[]>
  avgCycleTime: ComputedRef<number>
  bottleneckCount: ComputedRef<number>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

export function useCycleTime(
  steps: () => Array<{ id: string; title: string }>,
): UseCycleTimeReturn {
  const open = ref(false)
  const copied = ref(false)

  const cycleSteps = computed((): CycleStep[] => {
    const allSteps = steps()
    if (!allSteps.length) return []

    // First pass: compute without isBottleneck (need avgCycleTime)
    const raw = allSteps.map((s) => {
      const leadTime = seed(s.id + 'lead', 8) + 2    // 2–9
      const activeTime = seed(s.id + 'active', 6) + 1 // 1–6
      const waitTime = seed(s.id + 'wait', 5) + 1     // 1–5
      const cycleTime = activeTime + waitTime
      const flowEfficiency = Math.round((activeTime / (activeTime + waitTime)) * 100)
      return { stepId: s.id, stepTitle: s.title, leadTime, activeTime, waitTime, cycleTime, flowEfficiency }
    })

    const avg = raw.length
      ? raw.reduce((sum, r) => sum + r.cycleTime, 0) / raw.length
      : 0

    return raw.map((r) => ({
      ...r,
      isBottleneck: r.flowEfficiency < 35 || r.cycleTime > avg * 1.5,
    }))
  })

  const avgCycleTime = computed((): number => {
    const list = cycleSteps.value
    if (!list.length) return 0
    return list.reduce((sum, s) => sum + s.cycleTime, 0) / list.length
  })

  const bottleneckCount = computed((): number =>
    cycleSteps.value.filter((s) => s.isBottleneck).length,
  )

  async function copyMarkdown(): Promise<void> {
    const list = cycleSteps.value
    const lines: string[] = []
    lines.push('## Cycle Time Tracker')
    lines.push('')
    lines.push('| Step | Lead | Active | Wait | Cycle Time | Flow Eff% | Bottleneck? |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const s of list) {
      lines.push(
        `| ${s.stepTitle} | ${s.leadTime} | ${s.activeTime} | ${s.waitTime} | ${s.cycleTime} | ${s.flowEfficiency}% | ${s.isBottleneck ? 'Yes' : 'No'} |`,
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
    cycleSteps,
    avgCycleTime,
    bottleneckCount,
    copyMarkdown,
    copied,
  }
}
