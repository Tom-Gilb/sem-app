// UNIT_TYPE=Composable
// Feature #130 — Evo step energy forecast
import { ref, computed } from 'vue'
import type { Ref } from 'vue'

const STORAGE_KEY = 'sem-energy-records'

export type EnergyLevel = 'high' | 'mid' | 'low'

export interface ForecastPoint {
  stepIndex: number
  stepName: string
  forecastLevel: EnergyLevel
  svgY: number // normalized: high=20, mid=60, low=100
}

/** Default cycle pattern when no session data is available */
const DEFAULT_PATTERN: EnergyLevel[] = ['high', 'high', 'mid', 'mid', 'low']

/** Maps emoji levels from useEnergyTracker to EnergyLevel */
function emojiToLevel(emoji: string): EnergyLevel {
  if (emoji === '🔥') return 'high'
  if (emoji === '😐') return 'mid'
  return 'low'
}

/** Drops one energy tier */
function dropLevel(level: EnergyLevel): EnergyLevel {
  if (level === 'high') return 'mid'
  if (level === 'mid') return 'low'
  return 'low'
}

/** Drops two energy tiers */
function dropTwoLevels(level: EnergyLevel): EnergyLevel {
  if (level === 'high') return 'low'
  return 'low'
}

function svgYFromLevel(level: EnergyLevel): number {
  if (level === 'high') return 20
  if (level === 'mid') return 60
  return 100
}

export function useEnergyForecast(steps: { name: string }[]) {
  const forecastPoints = computed<ForecastPoint[]>(() => {
    if (steps.length === 0) return []

    // Read sessionStorage for energy tracker data
    let baseline: EnergyLevel = 'high'
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const records: { level: string }[] = JSON.parse(raw)
        const recent = records.slice(0, 3)
        if (recent.length > 0) {
          const counts: Record<EnergyLevel, number> = { high: 0, mid: 0, low: 0 }
          for (const r of recent) {
            const mapped = emojiToLevel(r.level)
            counts[mapped] = (counts[mapped] ?? 0) + 1
          }
          // Dominant: high ties broken in favour of high, then mid over low
          let dominant: EnergyLevel = 'low'
          if (counts.mid > counts.low) dominant = 'mid'
          if (counts.high >= counts.mid && counts.high > counts.low) dominant = 'high'
          if (counts.high > counts.mid) dominant = 'high'
          baseline = dominant
        }
      }
    } catch {
      // fall through to default pattern
    }

    const hasStorageData = (() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return false
        const records: unknown[] = JSON.parse(raw)
        return Array.isArray(records) && records.length > 0
      } catch {
        return false
      }
    })()

    let fatigue = 0

    return steps.map((step, i) => {
      let forecastLevel: EnergyLevel

      if (!hasStorageData) {
        // Use default cycle pattern
        forecastLevel = DEFAULT_PATTERN[i % DEFAULT_PATTERN.length]
      } else {
        // Apply fatigue model from baseline
        if (fatigue >= 4) {
          forecastLevel = dropTwoLevels(baseline)
        } else if (fatigue >= 2) {
          forecastLevel = dropLevel(baseline)
        } else {
          forecastLevel = baseline
        }

        // Increment fatigue for next step (only after first step)
        if (i > 0) {
          fatigue += 1
        } else {
          fatigue = 1
        }

        // Fatigue resets after step at index divisible by 3
        if (i % 3 === 0 && i > 0) {
          fatigue = 0
        }
      }

      return {
        stepIndex: i,
        stepName: step.name,
        forecastLevel,
        svgY: svgYFromLevel(forecastLevel),
      }
    })
  })

  const warningStepIndices = computed<number[]>(() =>
    forecastPoints.value
      .filter((pt) => pt.forecastLevel === 'low')
      .map((pt) => pt.stepIndex),
  )

  const hasWarning = computed<boolean>(() => warningStepIndices.value.length > 0)

  const svgPolylinePoints = computed<string>(() => {
    const pts = forecastPoints.value
    if (pts.length === 0) return ''
    if (pts.length === 1) return '30,60'
    const spacing = 460 / (pts.length - 1)
    return pts.map((pt) => `${30 + pt.stepIndex * spacing},${pt.svgY}`).join(' ')
  })

  return {
    forecastPoints,
    warningStepIndices,
    hasWarning,
    svgPolylinePoints,
  }
}

// ── Feature #130 spec-compliant composable ─────────────────────────────────────
// Uses emoji EnergyLevel, numericValue, decay model, SVG helpers, copyMarkdown

/** Emoji-based energy level type (spec-compliant) */
export type EnergyEmoji = '😴' | '😐' | '🔥'

export interface EnergyForecastPoint {
  stepIndex: number
  stepName: string
  forecastLevel: EnergyEmoji
  numericValue: number // 😴=1, 😐=2, 🔥=3
}

function numericFromEmoji(emoji: EnergyEmoji): number {
  if (emoji === '🔥') return 3
  if (emoji === '😐') return 2
  return 1
}

function emojiFromNumeric(value: number): EnergyEmoji {
  if (value >= 2.5) return '🔥'
  if (value >= 1.5) return '😐'
  return '😴'
}

export function useEnergyForecastSpec(
  steps: Ref<{ id: string; name: string }[]>
) {
  /** y-coordinate for each EnergyEmoji in the SVG */
  function yForLevel(level: EnergyEmoji): number {
    if (level === '🔥') return 16
    if (level === '😐') return 40
    return 64
  }

  const svgHeight = 80

  const svgWidth = computed<number>(() =>
    Math.max(200, steps.value.length * 60 + 20),
  )

  const forecastPoints = computed<EnergyForecastPoint[]>(() => {
    const stepsArr = steps.value
    if (stepsArr.length === 0) return []

    // Load records from sessionStorage
    let recentNumeric: number[] = []
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const records: { level: string }[] = JSON.parse(raw)
        if (Array.isArray(records) && records.length > 0) {
          const last3 = records.slice(0, 3)
          recentNumeric = last3.map((r) => {
            if (r.level === '🔥') return 3
            if (r.level === '😐') return 2
            return 1
          })
        }
      }
    } catch { /* no-op */ }

    if (recentNumeric.length === 0) {
      // No records: forecast all as 😐 (neutral)
      return stepsArr.map((step, i) => ({
        stepIndex: i,
        stepName: step.name,
        forecastLevel: '😐' as EnergyEmoji,
        numericValue: 2,
      }))
    }

    // Compute recent trend average
    const trendAvg = recentNumeric.reduce((s, v) => s + v, 0) / recentNumeric.length

    // Apply decay: each future step reduces by 0.1 (min 1.0)
    return stepsArr.map((step, i) => {
      const rawValue = Math.max(1.0, trendAvg - i * 0.1)
      const forecastLevel = emojiFromNumeric(rawValue)
      return {
        stepIndex: i,
        stepName: step.name,
        forecastLevel,
        numericValue: rawValue,
      }
    })
  })

  const warnSteps = computed<EnergyForecastPoint[]>(() =>
    forecastPoints.value.filter((pt) => pt.numericValue <= 1.2),
  )

  const hasWarning = computed<boolean>(() => warnSteps.value.length > 0)

  const svgPoints = computed<string>(() => {
    const pts = forecastPoints.value
    if (pts.length === 0) return ''
    return pts
      .map((pt, i) => `${i * 60 + 30},${yForLevel(pt.forecastLevel)}`)
      .join(' ')
  })

  const copied = ref(false)

  function copyMarkdown(): void {
    const header = '## Energy Forecast\n| Step | Forecast |\n|---|---|'
    const rows = forecastPoints.value
      .map((pt) => `| ${pt.stepName} | ${pt.forecastLevel} |`)
      .join('\n')
    const text = `${header}\n${rows}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => { /* silent */ })
    }
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return {
    forecastPoints,
    warnSteps,
    hasWarning,
    svgPoints,
    svgWidth,
    svgHeight,
    yForLevel,
    copyMarkdown,
    copied,
  }
}
