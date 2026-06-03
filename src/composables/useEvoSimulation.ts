// UNIT_TYPE=Hook
// useEvoSimulation — drives the Evo Simulator animation.
// Spec: 4Sol.S.EvoSimulator / 3P.F.ProvideEvoVisualization
//
// Takes a confirmed EvoStepPlan and optional V/C ratios (from ImpactEstimationModule).
// Computes per-step layout (startWeek, endWeek, colour rank) and drives a frame-by-frame
// animation where currentWeek advances over simulated calendar time.
//
// Step layout is proportional to effortPercent; total calendar span derives from the
// user's chosen Evo cycle length (Tom 2026-06-03 — was hard-coded to 26 weeks which
// mismatched a Week cycle + 2 steps showing "Jan…Jul" timeline; the actual plan duration
// should be ≈ 2 weeks). totalWeeks = (numSteps × cycleHours) / 40.
//
// Colour rank derives from vcRatios if available (top/mid/bottom thirds), otherwise equal.
// Cumulative value chart accumulates each step's ratio contribution as it completes.

import { ref, computed } from 'vue'
import type { EvoStep } from '../types/evo-plan'

export type SpeedMultiplier = 1 | 2 | 4

/** Colour bucket for a step bar, driven by V/C rank. */
export type StepColour = 'violet' | 'indigo' | 'slate'

export type EvoCycleLength = 'day' | 'week' | 'month' | 'quarter'

/** Hours per Evo step for each canonical cycle length. Keep in sync with
 *  the same map in useEvoPlannerAPI.ts. */
export const CYCLE_HOURS_BY_LENGTH: Record<EvoCycleLength, number> = {
  day:     8,
  week:    40,
  month:   160,
  quarter: 480,
}

/** Per-step layout and colour — computed once from input, not reactive. */
export interface StepLayout {
  step: EvoStep
  startWeek: number   // 0-based week when step begins
  endWeek: number     // 0-based week when step ends
  colour: StepColour  // rank-derived bar colour
  valueContrib: number // V/C contribution for cumulative chart (≥ 0)
}

/**
 * Builds the StepLayout[] from steps + optional vcRatios.
 *
 * Colour assignment: sort steps by linkedSolution's V/C ratio (descending).
 * Top third → violet, mid third → indigo, bottom/no-data → slate.
 * If vcRatios is empty, all steps are indigo (uniform).
 */
function buildLayouts(steps: EvoStep[], vcRatios: Record<string, number>, totalWeeks: number): StepLayout[] {
  if (steps.length === 0) return []

  const totalEffort = steps.reduce((s, st) => s + Math.max(st.effortPercent, 1), 0)
  const hasRatios   = Object.keys(vcRatios).length > 0

  // Assign colour rank by sorting steps on their best (max) linked solution ratio
  const stepRatio = (st: EvoStep) =>
    Math.max(0, ...(st.linkedSolutions ?? []).map(id => vcRatios[id] ?? 0))
  const ranked = [...steps].sort((a, b) => stepRatio(b) - stepRatio(a))
  const topThird = Math.ceil(ranked.length / 3)
  const midThird = topThird + Math.ceil(ranked.length / 3)

  const colourMap = new Map<string, StepColour>()
  ranked.forEach((st, i) => {
    if (!hasRatios) {
      colourMap.set(st.name, 'indigo')
    } else if (i < topThird) {
      colourMap.set(st.name, 'violet')
    } else if (i < midThird) {
      colourMap.set(st.name, 'indigo')
    } else {
      colourMap.set(st.name, 'slate')
    }
  })

  let cursor = 0
  return steps.map((st) => {
    const frac  = Math.max(st.effortPercent, 1) / totalEffort
    const start = cursor
    const end   = Math.min(cursor + frac * totalWeeks, totalWeeks)
    cursor = end
    const ratio = Math.max(1, ...(st.linkedSolutions ?? []).map(id => vcRatios[id] ?? 1))
    return {
      step:         st,
      startWeek:    start,
      endWeek:      end,
      colour:       colourMap.get(st.name) ?? 'indigo',
      valueContrib: Math.max(ratio, 0),
    }
  })
}

/**
 * Composable that drives Evo Simulator animation state.
 *
 * @param steps     - Confirmed EvoStep list (from useEvoPlan / confirmedSteps in App.vue)
 * @param vcRatios  - Optional V/C ratios keyed by linkedSolution ID (from ImpactEstimationView)
 *
 * @returns {{
 *   layouts: StepLayout[],
 *   currentWeek: Ref<number>,
 *   isPlaying: Ref<boolean>,
 *   isComplete: ComputedRef<boolean>,
 *   speed: Ref<SpeedMultiplier>,
 *   stepFill: (index: number) => number,
 *   cumulativeValuePath: ComputedRef<string>,
 *   maxCumulativeValue: number,
 *   play(): void,
 *   pause(): void,
 *   reset(): void,
 *   dispose(): void,
 * }}
 *
 * Preconditions: steps must be non-empty; effortPercent values must be ≥ 1.
 * No Anthropic calls — purely frontend animation over confirmed plan state.
 */
export function useEvoSimulation(
  steps:       EvoStep[],
  vcRatios:    Record<string, number> = {},
  cycleLength: EvoCycleLength = 'week',
) {
  // Total simulated calendar weeks derives from the user's chosen cycle
  // length (Tom 2026-06-03 — was hard-coded 26). 2 steps × Week (40h) = 2
  // weeks, 4 steps × Month (160h) = 16 weeks ≈ 4 months. Minimum 1 week so
  // the chart never collapses to zero width for an empty / 1-step plan.
  const cycleHours = CYCLE_HOURS_BY_LENGTH[cycleLength]
  const totalWeeks = Math.max(1, (steps.length * cycleHours) / 40)

  const layouts    = buildLayouts(steps, vcRatios, totalWeeks)
  const currentWeek = ref(0)
  const isPlaying   = ref(false)
  const speed       = ref<SpeedMultiplier>(1)

  const isComplete = computed(() => currentWeek.value >= totalWeeks)

  /**
   * Returns the fill fraction [0, 1] for a step at the current simulation week.
   * 0 = not started, 1 = fully delivered.
   */
  function stepFill(index: number): number {
    const layout = layouts[index]
    if (!layout) return 0
    const { startWeek, endWeek } = layout
    const span = endWeek - startWeek
    if (span <= 0) return 1
    return Math.min(Math.max((currentWeek.value - startWeek) / span, 0), 1)
  }

  // Pre-compute max cumulative value for chart scaling
  const maxCumulativeValue = layouts.reduce((s, l) => s + l.valueContrib, 0) || 1

  /**
   * Builds an SVG path string for the cumulative value area chart.
   * Chart space: width=100 (%), height=100 (%).
   * Origin: bottom-left (SVG coordinates: y=100 = bottom).
   *
   * Plots completed step contributions up to currentWeek.
   */
  const cumulativeValuePath = computed((): string => {
    if (layouts.length === 0) return ''

    // Build waypoints: each step adds its contribution when fully delivered
    const points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }]
    let cumulative = 0
    for (const layout of layouts) {
      if (currentWeek.value >= layout.endWeek) {
        // Step fully delivered — add contribution at its end week
        cumulative += layout.valueContrib
        const x = (layout.endWeek / totalWeeks) * 100
        const y = (cumulative / maxCumulativeValue) * 100
        points.push({ x, y })
      } else if (currentWeek.value > layout.startWeek) {
        // Step partially delivered — interpolate partial contribution
        const frac = (currentWeek.value - layout.startWeek) / (layout.endWeek - layout.startWeek)
        const partialContrib = layout.valueContrib * frac
        const x = (currentWeek.value / totalWeeks) * 100
        const y = ((cumulative + partialContrib) / maxCumulativeValue) * 100
        points.push({ x, y })
        break // only up to current week
      }
    }

    if (points.length < 2) return ''

    // SVG area path: bottom-left → points (y flipped: 0=bottom, 100=top) → bottom-right → close
    const topLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${(100 - p.y).toFixed(1)}`).join(' ')
    const lastX   = points[points.length - 1].x.toFixed(1)
    return `${topLine} L ${lastX},100 L 0,100 Z`
  })

  // ── Animation driver ────────────────────────────────────────────────────────

  let _rafId: number | null = null
  let _lastTimestamp: number | null = null

  /** Weeks advanced per second at 1× speed.
   *  Tuned so the whole animation completes in ~13 seconds wall-clock at
   *  1× regardless of the chosen cycle span — was hard-coded to 2 weeks/sec
   *  when totalWeeks was always 26. Tom 2026-06-03: dynamic cycle scaling.
   */
  const WEEKS_PER_SECOND = totalWeeks / 13

  function _tick(timestamp: number): void {
    if (_lastTimestamp === null) {
      _lastTimestamp = timestamp
    }
    const elapsed = (timestamp - _lastTimestamp) / 1000   // seconds
    _lastTimestamp = timestamp

    currentWeek.value = Math.min(
      currentWeek.value + elapsed * WEEKS_PER_SECOND * speed.value,
      totalWeeks,
    )

    if (currentWeek.value < totalWeeks) {
      _rafId = requestAnimationFrame(_tick)
    } else {
      isPlaying.value = false
      _rafId = null
    }
  }

  function play(): void {
    if (isComplete.value) reset()
    if (isPlaying.value) return
    isPlaying.value = true
    _lastTimestamp = null
    _rafId = requestAnimationFrame(_tick)
  }

  function pause(): void {
    isPlaying.value = false
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId)
      _rafId = null
    }
    _lastTimestamp = null
  }

  function reset(): void {
    pause()
    currentWeek.value = 0
  }

  /** Cancel any pending animation frame — call from onUnmounted. */
  function dispose(): void {
    pause()
  }

  return {
    layouts,
    currentWeek,
    isPlaying,
    isComplete,
    speed,
    stepFill,
    cumulativeValuePath,
    maxCumulativeValue,
    /** Total simulated weeks for THIS plan — derives from cycleLength × steps.
     *  Used by EvoSimulatorView for axis labels and the "across N weeks" caption. */
    totalWeeks,
    /** Echoed back so consumers can label units appropriately
     *  (e.g. "26 weeks" vs "2 weeks" vs "9 months"). */
    cycleLength,
    play,
    pause,
    reset,
    dispose,
  }
}
