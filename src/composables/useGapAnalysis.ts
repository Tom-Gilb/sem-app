// UNIT_TYPE=Composable
// Feature #192 — Spec "impact-gap analyser"
// Analyses the gap between goal and status values for V. entries.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface GapEntry {
  id: string
  description: string   // truncated 60 chars
  goal: string
  status: string
  goalNum: number | null
  statusNum: number | null
  gapAbs: number | null    // goalNum - statusNum (null if either unparseable)
  gapPct: number | null    // Math.round(gapAbs / Math.abs(goalNum) * 100) if goalNum !== 0, else null
  isLargeGap: boolean      // gapPct !== null && gapPct > 50
}

function parseFirstNum(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

export function buildGapEntry(
  id: string,
  description: string,
  goal: string,
  status: string,
): GapEntry {
  const goalNum = parseFirstNum(goal)
  const statusNum = parseFirstNum(status)

  let gapAbs: number | null = null
  let gapPct: number | null = null

  if (goalNum !== null && statusNum !== null) {
    gapAbs = goalNum - statusNum
    if (goalNum !== 0) {
      gapPct = Math.round(gapAbs / Math.abs(goalNum) * 100)
    }
  }

  const isLargeGap = gapPct !== null && gapPct > 50

  return {
    id,
    description: description.slice(0, 60),
    goal,
    status,
    goalNum,
    statusNum,
    gapAbs,
    gapPct,
    isLargeGap,
  }
}

export function useGapAnalysis(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): GapEntry[] => {
    if (blocks.length === 0) return []
    const values = blocks.flatMap(b => b.values)
    const built = values.map(v => buildGapEntry(v.id, v.description, v.goal, v.status))
    return [...built].sort((a, b) => {
      if (a.gapPct === null && b.gapPct === null) return 0
      if (a.gapPct === null) return 1
      if (b.gapPct === null) return -1
      return b.gapPct - a.gapPct
    })
  })

  const largeGapCount = computed((): number =>
    entries.value.filter(e => e.isLargeGap).length,
  )

  const avgGapPct = computed((): number => {
    const withPct = entries.value.filter(e => e.gapPct !== null)
    if (withPct.length === 0) return 0
    const sum = withPct.reduce((a, e) => a + (e.gapPct as number), 0)
    return Math.round(sum / withPct.length)
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Goal | Status | Gap (abs) | Gap % |',
      '|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.goal} | ${e.status} | ${e.gapAbs ?? 'N/A'} | ${e.gapPct ?? 'N/A'} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, largeGapCount, avgGapPct, copyMarkdown, copied }
}
