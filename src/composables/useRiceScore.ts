// UNIT_TYPE=Composable
// Feature #72 — RICE score prioritiser
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface RiceEntry {
  id: string
  scale: string
  reach: number
  impact: number
  confidence: number
  effort: number
  score: number
}

function computeScore(entry: RiceEntry): number {
  return Math.round((entry.reach * entry.impact * (entry.confidence / 100)) / entry.effort)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function useRiceScore(spec: Ref<SpecBlock | null>) {
  const riceOpen = ref(false)
  const riceEntries = ref<RiceEntry[]>([])

  function computeRiceScores(): void {
    const currentSpec = spec.value
    if (!currentSpec) {
      riceEntries.value = []
      return
    }

    const entries: RiceEntry[] = currentSpec.values.map((v): RiceEntry => {
      const entry: RiceEntry = {
        id: v.id,
        scale: v.scale.slice(0, 60),
        reach: 1000,
        impact: 2,
        confidence: 80,
        effort: 4,
        score: 0,
      }
      entry.score = computeScore(entry)
      return entry
    })

    entries.sort((a, b) => b.score - a.score)
    riceEntries.value = entries
  }

  function updateField(
    id: string,
    field: 'reach' | 'impact' | 'confidence' | 'effort',
    value: number,
  ): void {
    const entry = riceEntries.value.find(e => e.id === id)
    if (!entry) return

    if (field === 'reach') {
      entry.reach = Math.max(1, value)
    } else if (field === 'impact') {
      entry.impact = clamp(value, 1, 4)
    } else if (field === 'confidence') {
      entry.confidence = clamp(value, 0, 100)
    } else if (field === 'effort') {
      entry.effort = Math.max(0.5, value)
    }

    entry.score = computeScore(entry)

    riceEntries.value = [...riceEntries.value].sort((a, b) => b.score - a.score)
  }

  function copyRiceTable(): void {
    const header = '| ID | Scale | Reach | Impact | Confidence% | Effort | RICE Score |'
    const separator = '|---|---|---|---|---|---|---|'
    const rows = riceEntries.value.map(e =>
      `| ${e.id} | ${e.scale} | ${e.reach} | ${e.impact} | ${e.confidence} | ${e.effort} | ${e.score} |`,
    )
    const text = [header, separator, ...rows].join('\n')
    try {
      navigator.clipboard.writeText(text)
    } catch {
      // clipboard not available
    }
  }

  return { riceOpen, riceEntries, computeRiceScores, updateField, copyRiceTable }
}
