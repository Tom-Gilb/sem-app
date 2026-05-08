// UNIT_TYPE=Composable
// Feature #150 — Evo Step Burn-Down Estimator
import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface BurnPoint {
  day: number
  remaining: number
  ideal: number
}

export interface BurnDownStep {
  id: string
  name: string
  effort?: number
}

const DEFAULT_EFFORT = 4

// ── Weekend-skipping date helper ─────────────────────────────────────────────

/**
 * From a start Date, add `days` calendar days, then advance to Monday if the
 * result lands on Saturday (advance 2) or Sunday (advance 1).
 */
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + days)
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() + 2) // Sat → Mon
  if (dow === 0) d.setDate(d.getDate() + 1) // Sun → Mon
  return d
}

// ── Today constant (pinned for determinism) ──────────────────────────────────

const TODAY = new Date('2026-05-02')

// ── Composable ────────────────────────────────────────────────────────────────

export function useBurnDown(steps: Ref<BurnDownStep[]>) {
  const burnDownOpen = ref(false)
  const copied = ref(false)

  /** Sum of all step efforts (default 4 per step if missing). */
  const totalEffort: ComputedRef<number> = computed(() =>
    steps.value.reduce((sum, s) => sum + (s.effort ?? DEFAULT_EFFORT), 0),
  )

  /**
   * N+1 data points (0 through N steps).
   * - ideal[i] = totalEffort × (1 − i/N)
   * - remaining[0] = totalEffort
   * - remaining[i] = totalEffort − sum of effort for steps 0..i-1
   */
  const burnPoints: ComputedRef<BurnPoint[]> = computed(() => {
    const n = steps.value.length
    const total = totalEffort.value
    if (n === 0) {
      return [{ day: 0, remaining: 0, ideal: 0 }]
    }
    return Array.from({ length: n + 1 }, (_, i) => {
      const ideal = total * (1 - i / n)
      const consumed = steps.value
        .slice(0, i)
        .reduce((sum, s) => sum + (s.effort ?? DEFAULT_EFFORT), 0)
      const remaining = total - consumed
      return { day: i, remaining, ideal }
    })
  })

  /**
   * From today, add totalEffort days, skipping weekends.
   * Returns ISO date string (YYYY-MM-DD).
   */
  const completionDate: ComputedRef<string> = computed(() => {
    const result = addBusinessDays(TODAY, totalEffort.value)
    return result.toISOString().slice(0, 10)
  })

  /**
   * True if remaining effort at the last burn point is ≤ 0.
   * Always true since we consume all effort across steps.
   */
  const isOnTrack: ComputedRef<boolean> = computed(() => {
    const pts = burnPoints.value
    return pts.length > 0 && pts[pts.length - 1].remaining <= 0
  })

  // ── SVG coordinate helpers (used by the component template) ──────────────

  const SVG_W = 480
  const SVG_H = 200
  const PAD_LEFT = 48
  const PAD_RIGHT = 16
  const PAD_TOP = 16
  const PAD_BOTTOM = 48
  const CHART_W = SVG_W - PAD_LEFT - PAD_RIGHT
  const CHART_H = SVG_H - PAD_TOP - PAD_BOTTOM

  /** Pixel x for a given day index. */
  function xFor(dayIndex: number): number {
    const n = steps.value.length
    if (n === 0) return PAD_LEFT
    return PAD_LEFT + (dayIndex / n) * CHART_W
  }

  /** Pixel y for a given remaining value (0 = bottom, totalEffort = top). */
  function yFor(value: number): number {
    const total = totalEffort.value || 1
    return PAD_TOP + CHART_H * (1 - value / total)
  }

  /** SVG polyline points for the ideal line. */
  const idealPolylinePoints: ComputedRef<string> = computed(() =>
    burnPoints.value.map(p => `${xFor(p.day)},${yFor(p.ideal)}`).join(' '),
  )

  /** SVG polyline points for the actual burn-down line. */
  const actualPolylinePoints: ComputedRef<string> = computed(() =>
    burnPoints.value.map(p => `${xFor(p.day)},${yFor(p.remaining)}`).join(' '),
  )

  /** X position of the today (x=0) vertical line. */
  const todayX: ComputedRef<number> = computed(() => xFor(0))

  /** 3 Y-axis tick values: 0, half, full effort. */
  const yTicks: ComputedRef<{ value: number; y: number; label: string }[]> = computed(() => {
    const total = totalEffort.value
    return [0, Math.round(total / 2), total].map(v => ({
      value: v,
      y: yFor(v),
      label: String(v),
    }))
  })

  /** X-axis step name labels. */
  const xLabels: ComputedRef<{ x: number; label: string; index: number }[]> = computed(() =>
    burnPoints.value.map((p, i) => ({
      x: xFor(p.day),
      label: i === 0 ? 'Start' : (steps.value[i - 1]?.name ?? `Step ${i}`),
      index: i,
    })),
  )

  // ── Markdown copy ─────────────────────────────────────────────────────────

  function copyMarkdown(): void {
    const header = '| Step | Effort | Remaining | Ideal |'
    const divider = '|------|--------|-----------|-------|'
    const rows = burnPoints.value.map((p, i) => {
      const stepName = i === 0 ? 'Start' : (steps.value[i - 1]?.name ?? `Step ${i}`)
      const effort = i === 0 ? 0 : (steps.value[i - 1]?.effort ?? DEFAULT_EFFORT)
      return `| ${stepName} | ${effort} | ${p.remaining} | ${p.ideal.toFixed(1)} |`
    })
    const md = [header, divider, ...rows].join('\n')
    navigator.clipboard?.writeText(md).catch(() => {})
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return {
    burnDownOpen,
    totalEffort,
    burnPoints,
    completionDate,
    isOnTrack,
    idealPolylinePoints,
    actualPolylinePoints,
    todayX,
    yTicks,
    xLabels,
    SVG_W,
    SVG_H,
    PAD_LEFT,
    PAD_RIGHT,
    PAD_TOP,
    PAD_BOTTOM,
    copyMarkdown,
    copied,
  }
}
