// UNIT_TYPE=Composable
// Feature #93 — Multi-spec trend dashboard
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { DashboardEntry } from './useProjectDashboard'
import { sparklinePoints, trendDirection } from '../utils/sparkline'

export interface TrendSeries {
  name: string           // "Quality Score", "Word Count", "RICE Avg"
  values: number[]       // one value per entry in DashboardEntry order
  unit: string           // "%", "words", "pts"
  min: number
  max: number
  latest: number         // last value
  trend: '📈' | '📉' | '→'
  sparklinePath: string  // SVG polyline points string
}

/** Count words in a string. */
function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Derive quality score 0–100 from a DashboardEntry (uses stored qualityScore). */
function deriveQualityScore(entry: DashboardEntry): number {
  return entry.qualityScore
}

/** Derive word count: sum of all description fields across all blocks. */
function deriveWordCount(entry: DashboardEntry): number {
  const spec = entry.spec
  let total = 0
  for (const f of spec.functions) {
    total += wordCount(f.description)
    total += wordCount(f.presenceTest || f.successCriteria || '')
  }
  for (const v of spec.values) {
    total += wordCount(v.description)
    total += wordCount(v.scale)
    total += wordCount(v.meter)
  }
  for (const s of spec.solutions) {
    total += wordCount(s.description)
    total += wordCount(s.impact)
  }
  return total
}

/**
 * Derive proxy value score: (V. count * 200) + (F. count * 50).
 * This gives a meaningful variation across specs rather than a constant RICE formula.
 */
function deriveRiceProxy(entry: DashboardEntry): number {
  return entry.spec.values.length * 200 + entry.spec.functions.length * 50
}

function emojiTrend(values: number[]): '📈' | '📉' | '→' {
  const dir = trendDirection(values)
  if (dir === 'up') return '📈'
  if (dir === 'down') return '📉'
  return '→'
}

function buildSeries(
  name: string,
  unit: string,
  values: number[],
): TrendSeries {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const latest = values[values.length - 1]
  return {
    name,
    values,
    unit,
    min,
    max,
    latest,
    trend: emojiTrend(values),
    sparklinePath: sparklinePoints(values, 80, 30),
  }
}

export function useSpecTrends(entries: Ref<DashboardEntry[]>) {
  const trendsOpen = ref(false)

  const series = computed<TrendSeries[]>(() => {
    if (entries.value.length < 2) return []

    // Entries are stored newest-first (unshift in useProjectDashboard),
    // so reverse for chronological order in the trend chart.
    const ordered = [...entries.value].reverse()

    const qualityValues = ordered.map(deriveQualityScore)
    const wordValues = ordered.map(deriveWordCount)
    const riceValues = ordered.map(deriveRiceProxy)

    return [
      buildSeries('Quality Score', '%', qualityValues),
      buildSeries('Word Count', 'words', wordValues),
      buildSeries('RICE Avg', 'pts', riceValues),
    ]
  })

  return { trendsOpen, series }
}
