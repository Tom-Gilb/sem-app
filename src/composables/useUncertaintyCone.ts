// UNIT_TYPE=Composable
// Feature #168 — Evo Step Uncertainty Cone Chart
// SVG uncertainty cone widening across steps; confidence % narrows as steps complete
import { ref, computed } from 'vue'

export interface ConePoint {
  stepIndex: number
  stepTitle: string
  upperBound: number    // % above midline
  lowerBound: number    // % below midline
  confidence: number    // 100 = certain, lower = more uncertainty
  completed: boolean
}

export function useUncertaintyCone(stepData: () => Array<{ id: string; title: string; completed?: boolean }>) {
  const open = ref(false)

  const points = computed((): ConePoint[] => {
    const allSteps = stepData()
    if (!allSteps.length) return []
    const total = allSteps.length

    return allSteps.map((s, i) => {
      // Uncertainty grows from completed steps outward, shrinks as more complete
      const completedSoFar = allSteps.slice(0, i + 1).filter(x => x.completed).length
      const progressRatio = completedSoFar / Math.max(total, 1)
      // Base uncertainty narrows as we learn more; also narrows after step is completed
      const positionRatio = i / Math.max(total - 1, 1)
      const baseUncertainty = (1 - progressRatio) * 40  // 0–40%
      const cone = s.completed ? baseUncertainty * 0.3 : baseUncertainty * (0.3 + positionRatio * 0.7)
      const confidence = Math.round(100 - cone * 2)

      return {
        stepIndex: i,
        stepTitle: s.title.slice(0, 12),
        upperBound: Math.round(cone),
        lowerBound: Math.round(cone),
        confidence,
        completed: s.completed ?? false,
      }
    })
  })

  const overallConfidence = computed((): number => {
    if (!points.value.length) return 100
    return Math.round(points.value.reduce((a, p) => a + p.confidence, 0) / points.value.length)
  })

  function copyMarkdown(): string {
    const lines = ['# Uncertainty Cone\n']
    lines.push(`Overall confidence: ${overallConfidence.value}%\n`)
    lines.push('| Step | Upper | Lower | Confidence |')
    lines.push('|---|---|---|---|')
    for (const p of points.value) {
      lines.push(`| ${p.stepTitle} | +${p.upperBound}% | -${p.lowerBound}% | ${p.confidence}% |`)
    }
    return lines.join('\n')
  }

  return { open, points, overallConfidence, copyMarkdown }
}
