// UNIT_TYPE=Composable
// Feature #151 — Spec NPS Predictor
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface NpsEntry {
  vEntryId: string
  vEntryName: string
  promoterPct: number
  passivePct: number
  detractorPct: number
  nps: number
}

export function computeNpsEntry(vEntryId: string, vEntryName: string, goal: string, tolerable: string): NpsEntry {
  const goalNumeric = parseFloat(goal ?? '0')
  const tolerableNumeric = parseFloat(tolerable ?? '0')

  let promoterPct: number
  let passivePct: number
  let detractorPct: number

  if ((isNaN(goalNumeric) || goalNumeric === 0) && (isNaN(tolerableNumeric) || tolerableNumeric === 0)) {
    promoterPct = 50
    passivePct = 30
    detractorPct = 20
  } else {
    const safeGoal = isNaN(goalNumeric) ? 0 : goalNumeric
    const safeTolerable = isNaN(tolerableNumeric) ? 0 : tolerableNumeric
    const gap = safeGoal - safeTolerable

    if (gap > 0) {
      promoterPct = Math.min(90, 40 + gap * 2)
      detractorPct = Math.max(5, 30 - gap)
      passivePct = 100 - promoterPct - detractorPct
    } else {
      promoterPct = Math.max(10, 30 + gap)
      detractorPct = Math.min(70, 40 - gap)
      passivePct = 100 - promoterPct - detractorPct
    }
  }

  const nps = promoterPct - detractorPct

  return {
    vEntryId,
    vEntryName,
    promoterPct,
    passivePct,
    detractorPct,
    nps,
  }
}

export function formatNpsMarkdown(entries: NpsEntry[], aggregateNps: number, npsGrade: string): string {
  const header = '| V. Entry | Promoters | Passives | Detractors | NPS |'
  const separator = '|---|---|---|---|---|'
  const rows = entries.map(
    (e) =>
      `| ${e.vEntryName} | ${e.promoterPct}% | ${e.passivePct}% | ${e.detractorPct}% | ${e.nps} |`,
  )
  const summary = `| **Overall** | — | — | — | **${aggregateNps} (${npsGrade})** |`
  return [header, separator, ...rows, summary].join('\n')
}

export function useNpsPredictor(blocks: SpecBlock[]) {
  const copied: Ref<boolean> = ref(false)

  const entries: ComputedRef<NpsEntry[]> = computed<NpsEntry[]>(() => {
    const result: NpsEntry[] = []
    for (const block of blocks) {
      for (const v of block.values) {
        result.push(computeNpsEntry(v.id, v.id, v.goal ?? '', v.tolerable ?? ''))
      }
    }
    return result
  })

  const aggregateNps: ComputedRef<number> = computed<number>(() => {
    if (!entries.value.length) return 0
    const total = entries.value.reduce((sum, e) => sum + e.nps, 0)
    return Math.round(total / entries.value.length)
  })

  const npsGrade: ComputedRef<string> = computed<string>(() => {
    const nps = aggregateNps.value
    if (nps >= 50) return 'Excellent'
    if (nps >= 20) return 'Good'
    if (nps >= 0) return 'Neutral'
    return 'Poor'
  })

  async function copyMarkdown(): Promise<void> {
    if (!entries.value.length) return
    const text = formatNpsMarkdown(entries.value, aggregateNps.value, npsGrade.value)
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

  return { entries, aggregateNps, npsGrade, copyMarkdown, copied }
}
