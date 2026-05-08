// UNIT_TYPE=Composable
// Feature #165 — Evo Step Flow Efficiency Meter
// Per step: time-in-progress vs idle time estimate; flow efficiency %; bottleneck detection
import { ref, computed } from 'vue'

export interface FlowStep {
  stepId: string
  stepTitle: string
  effort: number           // active work hours
  idleTime: number         // waiting/blocked hours (seeded)
  flowEfficiency: number   // activeTime / (activeTime + idleTime) × 100, rounded
  isBottleneck: boolean    // flowEfficiency < 40%
}

export function useFlowEfficiency(stepTitles: () => Array<{ id: string; title: string; effort?: number }>) {
  const open = ref(false)
  const copied = ref(false)

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  const flowSteps = computed((): FlowStep[] => {
    return stepTitles().map((s, i) => {
      const sv = seed(s.id + s.title)
      const effort = s.effort ?? (4 + (i % 4) * 2)
      // Idle time: seeded 1–8h (low = efficient, high = blocked)
      const idleTime = 1 + (sv % 8)
      const total = effort + idleTime
      const flowEfficiency = Math.round((effort / total) * 100)
      return {
        stepId: s.id,
        stepTitle: s.title.slice(0, 20),
        effort,
        idleTime,
        flowEfficiency,
        isBottleneck: flowEfficiency < 40,
      }
    })
  })

  const avgFlowEfficiency = computed((): number => {
    if (!flowSteps.value.length) return 0
    return Math.round(flowSteps.value.reduce((a, s) => a + s.flowEfficiency, 0) / flowSteps.value.length)
  })

  const bottleneckCount = computed((): number =>
    flowSteps.value.filter(s => s.isBottleneck).length
  )

  async function copyMarkdown() {
    const lines = ['# Flow Efficiency\n']
    lines.push(`Average: ${avgFlowEfficiency.value}% | Bottlenecks: ${bottleneckCount.value}\n`)
    lines.push('| Step | Active (h) | Idle (h) | Efficiency |')
    lines.push('|---|---|---|---|')
    for (const s of flowSteps.value) {
      const flag = s.isBottleneck ? ' ⚠️' : ''
      lines.push(`| ${s.stepTitle}${flag} | ${s.effort} | ${s.idleTime} | ${s.flowEfficiency}% |`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, flowSteps, avgFlowEfficiency, bottleneckCount, copied, copyMarkdown }
}
