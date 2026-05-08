// UNIT_TYPE=Composable
// Feature #105 — Spec "benchmark comparison"
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface BenchmarkEntry {
  id: string
  scale: string
  goal: string
  goalNumeric: number | null
  benchmark: string          // user-entered (default "")
  benchmarkNumeric: number | null  // parsed from benchmark input
  gap: number | null               // goalNumeric - benchmarkNumeric (null if either not parseable)
  gapLabel: string                 // "+N (ahead)" or "-N (behind)" or "Equal"
  gapPositive: boolean             // goal > benchmark = true
}

const NUMERIC_RE = /(-?\d+\.?\d*)/

function parseNumericOrNull(value: string): number | null {
  if (!value || value.trim() === '') return null
  // Strip bracketed content (e.g. "[2026, condition]") before extracting first number
  const stripped = value.replace(/\[[^\]]*\]/g, '')
  const match = NUMERIC_RE.exec(stripped)
  return match ? parseFloat(match[1]) : null
}

export function useSpecBenchmark(spec: Ref<SpecBlock | null>) {
  const benchmarkOpen = ref(false)
  const benchmarks = ref<Record<string, string>>({})

  watch(spec, (newSpec) => {
    if (!newSpec) return
    for (const v of newSpec.values) {
      if (!(v.id in benchmarks.value)) {
        benchmarks.value[v.id] = ''
      }
    }
  }, { immediate: true })

  const comparisonRows = computed<BenchmarkEntry[]>(() => {
    if (!spec.value) return []

    return spec.value.values.map((v) => {
      const goalNumeric = parseNumericOrNull(v.goal)
      const benchmarkStr = benchmarks.value[v.id] ?? ''
      const benchmarkNumeric = parseNumericOrNull(benchmarkStr)

      let gap: number | null = null
      let gapLabel = ''
      let gapPositive = false

      if (goalNumeric !== null && benchmarkNumeric !== null) {
        gap = goalNumeric - benchmarkNumeric
        if (gap > 0) {
          gapLabel = `+${gap} (ahead)`
          gapPositive = true
        } else if (gap < 0) {
          gapLabel = `${gap} (behind)`
          gapPositive = false
        } else {
          gapLabel = 'Equal'
          gapPositive = false
        }
      }

      return {
        id: v.id,
        scale: v.scale,
        goal: v.goal,
        goalNumeric,
        benchmark: benchmarkStr,
        benchmarkNumeric,
        gap,
        gapLabel,
        gapPositive,
      }
    })
  })

  function setBenchmark(id: string, value: string): void {
    benchmarks.value[id] = value
  }

  function copyComparison(): void {
    const header = '| ID | Goal | Benchmark | Gap |'
    const separator = '|---|---|---|---|'
    const rows = comparisonRows.value
      .map(r => `| ${r.id} | ${r.goal} | ${r.benchmark} | ${r.gapLabel} |`)
      .join('\n')
    const md = `${header}\n${separator}\n${rows}`
    navigator.clipboard.writeText(md).catch(() => {/* no-op */})
  }

  return { benchmarkOpen, benchmarks, comparisonRows, setBenchmark, copyComparison }
}
