// UNIT_TYPE=Composable
// Feature #154 — Spec "impact vs complexity" scatter plot
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ScatterPoint {
  id: string
  name: string
  type: 'Function' | 'Value' | 'Solution'
  complexity: number
  impact: number
  selected: boolean
}

export function charCodeSeed(id: string): number {
  let s = 0
  for (let i = 0; i < id.length; i++) {
    s += id.charCodeAt(i)
  }
  return s
}

export function computeComplexity(description: string): number {
  const words = description.trim().split(/\s+/).filter((w) => w.length > 0)
  return Math.max(1, words.length)
}

export function computeImpact(id: string): number {
  return (charCodeSeed(id) % 100) + 1
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export type Quadrant = 'quick-win' | 'major-project' | 'fill-in' | 'thankless'

export function buildScatterPoints(blocks: SpecBlock[]): ScatterPoint[] {
  const result: ScatterPoint[] = []
  for (const block of blocks) {
    for (const f of block.functions) {
      result.push({
        id: f.id,
        name: f.id,
        type: 'Function',
        complexity: computeComplexity(f.description),
        impact: computeImpact(f.id),
        selected: false,
      })
    }
    for (const v of block.values) {
      result.push({
        id: v.id,
        name: v.id,
        type: 'Value',
        complexity: computeComplexity(v.description),
        impact: computeImpact(v.id),
        selected: false,
      })
    }
    for (const s of block.solutions) {
      result.push({
        id: s.id,
        name: s.id,
        type: 'Solution',
        complexity: computeComplexity(s.description),
        impact: computeImpact(s.id),
        selected: false,
      })
    }
  }
  return result
}

export function formatScatterMarkdown(points: ScatterPoint[], quadrantOf: (p: ScatterPoint) => Quadrant): string {
  const header = '| Name | Type | Complexity | Impact | Quadrant |'
  const separator = '|---|---|---|---|---|'
  const rows = points.map(
    (p) => `| ${p.name} | ${p.type} | ${p.complexity} | ${p.impact} | ${quadrantOf(p)} |`,
  )
  return [header, separator, ...rows].join('\n')
}

export function useImpactComplexity(blocks: SpecBlock[]) {
  const selectedId: Ref<string | null> = ref(null)
  const copied: Ref<boolean> = ref(false)

  const points: ComputedRef<ScatterPoint[]> = computed<ScatterPoint[]>(() => {
    return buildScatterPoints(blocks).map((p) => ({
      ...p,
      selected: p.id === selectedId.value,
    }))
  })

  const complexityMedian: ComputedRef<number> = computed<number>(() => {
    return computeMedian(points.value.map((p) => p.complexity))
  })

  const impactMedian: ComputedRef<number> = computed<number>(() => {
    return computeMedian(points.value.map((p) => p.impact))
  })

  function quadrantOf(point: ScatterPoint): Quadrant {
    const highImpact = point.impact >= impactMedian.value
    const highComplexity = point.complexity >= complexityMedian.value
    if (highImpact && !highComplexity) return 'quick-win'
    if (highImpact && highComplexity) return 'major-project'
    if (!highImpact && !highComplexity) return 'fill-in'
    return 'thankless'
  }

  function selectPoint(id: string): void {
    selectedId.value = id
  }

  async function copyMarkdown(): Promise<void> {
    if (!points.value.length) return
    const text = formatScatterMarkdown(points.value, quadrantOf)
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { points, selectedId, selectPoint, quadrantOf, copyMarkdown, copied }
}
