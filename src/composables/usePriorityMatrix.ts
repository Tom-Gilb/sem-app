// UNIT_TYPE=Composable
// Feature #186 — Spec "user story priority matrix"
// Seeds urgency and impact for V. entries, places them in 2×2 quadrants.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type MatrixQuadrant = 'Do Now' | 'Plan' | 'Maybe' | 'Drop'

export interface MatrixEntry {
  id: string
  description: string  // truncated 50 chars
  urgency: number      // 1–5
  impact: number       // 1–5
  quadrant: MatrixQuadrant
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function getQuadrant(urgency: number, impact: number): MatrixQuadrant {
  if (urgency > 2 && impact > 2) return 'Do Now'
  if (urgency <= 2 && impact > 2) return 'Plan'
  if (urgency > 2 && impact <= 2) return 'Maybe'
  return 'Drop'
}

export function buildMatrixEntry(id: string, description: string): MatrixEntry {
  const urgency = seed(id + 'urg', 5) + 1
  const impact = seed(id + 'imp', 5) + 1
  return {
    id,
    description: description.slice(0, 50),
    urgency,
    impact,
    quadrant: getQuadrant(urgency, impact),
  }
}

export function usePriorityMatrix(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)
  const selectedQuadrant = ref<MatrixQuadrant | 'All'>('All')

  const entries = computed((): MatrixEntry[] => {
    if (blocks.length === 0) return []
    const values = blocks.flatMap(b => b.values)
    return values.map(v => buildMatrixEntry(v.id, v.description))
  })

  const filteredEntries = computed((): MatrixEntry[] => {
    if (selectedQuadrant.value === 'All') return entries.value
    return entries.value.filter(e => e.quadrant === selectedQuadrant.value)
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Urgency | Impact | Quadrant |',
      '|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(`| ${e.id} | ${e.urgency} | ${e.impact} | ${e.quadrant} |`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, selectedQuadrant, filteredEntries, copyMarkdown, copied }
}
