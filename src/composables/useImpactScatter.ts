// UNIT_TYPE=Composable
// Feature #154 — Impact vs Complexity scatter plot
// SVG scatter: x=word-count complexity, y=charCode-seeded RICE-style impact
// 4 labelled quadrants: Quick Win / Major Project / Fill-in / Thankless
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ScatterPoint {
  id: string
  label: string       // truncated id/description for display
  x: number           // complexity (0–100)
  y: number           // impact (0–100)
  type: string        // "Function" | "Value" | "Solution"
  quadrant: 'quick-win' | 'major-project' | 'fill-in' | 'thankless'
  selected: boolean
}

function seed(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function blockToPoints(block: SpecBlock, selectedId: string | null): ScatterPoint[] {
  const points: ScatterPoint[] = []

  for (const f of block.functions) {
    const id = f.id
    const desc = f.description ?? ''
    const s = seed(id)
    const raw = wordCount(desc)
    const x = Math.min(100, Math.round((raw / 25) * 100))
    const y = (s * 37 + s % 13) % 100
    let quadrant: ScatterPoint['quadrant']
    if (x < 50 && y >= 50) quadrant = 'quick-win'
    else if (x >= 50 && y >= 50) quadrant = 'major-project'
    else if (x < 50 && y < 50) quadrant = 'fill-in'
    else quadrant = 'thankless'
    points.push({ id, label: id.slice(0, 14), x, y, type: 'Function', quadrant, selected: id === selectedId })
  }

  for (const v of block.values) {
    const id = v.id
    const desc = v.description ?? ''
    const s = seed(id)
    const raw = wordCount(desc)
    const x = Math.min(100, Math.round((raw / 25) * 100))
    const y = (s * 37 + s % 13) % 100
    let quadrant: ScatterPoint['quadrant']
    if (x < 50 && y >= 50) quadrant = 'quick-win'
    else if (x >= 50 && y >= 50) quadrant = 'major-project'
    else if (x < 50 && y < 50) quadrant = 'fill-in'
    else quadrant = 'thankless'
    points.push({ id, label: id.slice(0, 14), x, y, type: 'Value', quadrant, selected: id === selectedId })
  }

  for (const sol of block.solutions) {
    const id = sol.id
    const desc = sol.description ?? ''
    const s = seed(id)
    const raw = wordCount(desc)
    const x = Math.min(100, Math.round((raw / 25) * 100))
    const y = (s * 37 + s % 13) % 100
    let quadrant: ScatterPoint['quadrant']
    if (x < 50 && y >= 50) quadrant = 'quick-win'
    else if (x >= 50 && y >= 50) quadrant = 'major-project'
    else if (x < 50 && y < 50) quadrant = 'fill-in'
    else quadrant = 'thankless'
    points.push({ id, label: id.slice(0, 14), x, y, type: 'Solution', quadrant, selected: id === selectedId })
  }

  return points
}

export function useImpactScatter(blocks: SpecBlock[]) {
  const open = ref(false)
  const selectedId = ref<string | null>(null)

  const points = computed((): ScatterPoint[] => {
    const result: ScatterPoint[] = []
    for (const block of blocks) {
      result.push(...blockToPoints(block, selectedId.value))
    }
    return result
  })

  function selectPoint(id: string) {
    selectedId.value = selectedId.value === id ? null : id
  }

  const selectedPoint = computed(() => points.value.find(p => p.selected) ?? null)

  function copyMarkdown(): string {
    const lines = ['# Impact vs Complexity\n']
    lines.push('| Entry | Complexity | Impact | Quadrant |')
    lines.push('|---|---|---|---|')
    for (const p of points.value) {
      lines.push(`| ${p.id} | ${p.x} | ${p.y} | ${p.quadrant} |`)
    }
    return lines.join('\n')
  }

  return { open, points, selectedId, selectedPoint, selectPoint, copyMarkdown }
}
