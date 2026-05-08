// UNIT_TYPE=Composable
// Feature #193 — Evo step "velocity predictor"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface VelocityPoint {
  stepId: string
  stepTitle: string
  stepIndex: number    // 0-based
  effort: number       // from step.effort if > 0, else seed(stepId+'vel', 8) + 2 → 2–9
  isCompleted: boolean // seed(stepId+'done', 2) === 1 (or step.completed if provided)
  velocity: number     // effort (used as velocity unit)
  forecast: number | null  // null for completed steps; linear trend projection for future steps
  lowerBound: number | null   // forecast - 1.5
  upperBound: number | null   // forecast + 1.5
}

export type VelocityTrend = 'increasing' | 'stable' | 'decreasing'

export interface UseVelocityPredictorReturn {
  open: Ref<boolean>
  points: ComputedRef<VelocityPoint[]>
  avgVelocity: ComputedRef<number>
  trend: ComputedRef<VelocityTrend>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

/** Least-squares linear regression: returns { a, b } for y = a + b*x */
function leastSquares(points: Array<{ x: number; y: number }>): { a: number; b: number } {
  const n = points.length
  if (n === 0) return { a: 0, b: 0 }
  if (n === 1) return { a: points[0].y, b: 0 }
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { a: sumY / n, b: 0 }
  const b = (n * sumXY - sumX * sumY) / denom
  const a = (sumY - b * sumX) / n
  return { a, b }
}

export function useVelocityPredictor(
  steps: () => Array<{ id: string; title: string; effort?: number; completed?: boolean }>,
): UseVelocityPredictorReturn {
  const open = ref(false)
  const copied = ref(false)

  const points = computed((): VelocityPoint[] => {
    const allSteps = steps()
    if (!allSteps.length) return []

    // First pass: determine effort, completion, and velocity for each step
    const basePoints = allSteps.map((s, i) => {
      const effort = s.effort != null && s.effort > 0
        ? s.effort
        : seed(s.id + 'vel', 8) + 2                          // 2–9
      const isCompleted = s.completed !== undefined
        ? s.completed
        : seed(s.id + 'done', 2) === 1
      const velocity = effort
      return { stepId: s.id, stepTitle: s.title, stepIndex: i, effort, isCompleted, velocity }
    })

    // Collect completed points for regression
    const completedPts = basePoints
      .filter((p) => p.isCompleted)
      .map((p) => ({ x: p.stepIndex, y: p.velocity }))

    // Compute regression coefficients for forecasting future steps
    let regrCoeffs: { a: number; b: number } | null = null
    let fallbackAvg = 0
    if (completedPts.length >= 2) {
      regrCoeffs = leastSquares(completedPts)
    } else if (completedPts.length === 1) {
      fallbackAvg = completedPts[0].y
    }

    return basePoints.map((p) => {
      if (p.isCompleted) {
        return { ...p, forecast: null, lowerBound: null, upperBound: null }
      }
      // Future step: compute forecast
      let forecastRaw: number
      if (regrCoeffs) {
        forecastRaw = Math.max(1, Math.round(regrCoeffs.a + regrCoeffs.b * p.stepIndex))
      } else if (completedPts.length === 1) {
        forecastRaw = Math.max(1, Math.round(fallbackAvg))
      } else {
        // No completed steps: use own velocity as forecast
        forecastRaw = Math.max(1, p.velocity)
      }
      const forecast = forecastRaw
      const lowerBound = forecast - 1.5
      const upperBound = forecast + 1.5
      return { ...p, forecast, lowerBound, upperBound }
    })
  })

  const avgVelocity = computed((): number => {
    const completed = points.value.filter((p) => p.isCompleted)
    if (!completed.length) return 0
    const sum = completed.reduce((s, p) => s + p.velocity, 0)
    return sum / completed.length
  })

  const trend = computed((): VelocityTrend => {
    const completed = points.value.filter((p) => p.isCompleted)
    if (completed.length < 2) return 'stable'
    const half = Math.floor(completed.length / 2)
    const firstHalf = completed.slice(0, half)
    const lastHalf = completed.slice(completed.length - half)
    const firstAvg = firstHalf.reduce((s, p) => s + p.velocity, 0) / firstHalf.length
    const lastAvg = lastHalf.reduce((s, p) => s + p.velocity, 0) / lastHalf.length
    if (lastAvg > firstAvg * 1.1) return 'increasing'
    if (lastAvg < firstAvg * 0.9) return 'decreasing'
    return 'stable'
  })

  async function copyMarkdown(): Promise<void> {
    const list = points.value
    const lines: string[] = []
    lines.push('## Velocity Forecast')
    lines.push('')
    lines.push('| Step | Completed | Velocity | Forecast | Lower | Upper |')
    lines.push('|---|---|---|---|---|---|')
    for (const p of list) {
      lines.push(
        `| ${p.stepTitle} | ${p.isCompleted ? '✅' : '⬜'} | ${p.velocity} | ${p.forecast ?? '—'} | ${p.lowerBound != null ? p.lowerBound : '—'} | ${p.upperBound != null ? p.upperBound : '—'} |`,
      )
    }
    lines.push('')
    lines.push(`Avg Velocity: ${avgVelocity.value.toFixed(1)} — Trend: ${trend.value}`)

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
    points,
    avgVelocity,
    trend,
    copyMarkdown,
    copied,
  }
}
