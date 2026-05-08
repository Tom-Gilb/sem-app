// UNIT_TYPE=Composable
// Feature #89 — Impact vs Effort bubble chart composable
import { ref, computed, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'

export interface BubblePoint {
  stepId: string
  title: string        // truncated to 20 chars
  x: number            // 0–100 (effort %)
  y: number            // 0–100 (impact %, derived: rank-based)
  radius: number       // SVG radius 8–24
  colour: string       // CSS colour
  selected: boolean
}

const BUBBLE_COLOURS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function useBubbleChart(steps: Ref<EvoStep[]>) {
  const selectedStepId = ref<string | null>(null)

  const bubblePoints = computed<BubblePoint[]>(() => {
    const total = steps.value.length
    if (total === 0) return []

    return steps.value.map((step, i) => {
      // x = effort %: use step.effortPercent, clamped 0–100
      const x = Math.min(100, Math.max(0, step.effortPercent))

      // y = impact: first steps = higher impact, deterministic jitter
      // y = ((total - i) / total) * 80 + (i % 3) * 5  → range 0–85
      const y = Math.min(100, ((total - i) / total) * 80 + (i % 3) * 5)

      // radius: scale effort to 8–24
      const radius = 8 + (step.effortPercent / 100) * 16

      // colour: rotate through palette
      const colour = BUBBLE_COLOURS[i % BUBBLE_COLOURS.length]

      // stepId: use index-based id for consistent identification
      const stepId = `step-${i}`

      // title: truncate to 20 chars
      const title = step.name.length > 20 ? step.name.slice(0, 20) : step.name

      return {
        stepId,
        title,
        x,
        y,
        radius,
        colour,
        selected: stepId === selectedStepId.value,
      }
    })
  })

  function selectStep(id: string | null): void {
    selectedStepId.value = id
  }

  return { bubblePoints, selectedStepId, selectStep }
}
