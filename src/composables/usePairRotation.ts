// UNIT_TYPE=Composable
// Feature #160 — Evo Step Pair Rotation Tracker
import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface PairRecord {
  stepA: string
  stepB: string
  stepAName: string
  stepBName: string
  pairCount: number
  lastPairedIdx: number
}

export interface PairRotationStep {
  id: string
  name: string
}

export function usePairRotation(steps: Ref<PairRotationStep[]>) {
  const copied = ref(false)

  /**
   * Build the full pair rotation schedule.
   * For N steps: every (i, j) combination where i < j → one PairRecord.
   * pairCount starts at 1 (everyone gets paired once).
   * lastPairedIdx = i (the lower index, i.e. the step index when the pair first appeared).
   */
  const allPairs: ComputedRef<PairRecord[]> = computed(() => {
    const s = steps.value
    const records: PairRecord[] = []
    for (let i = 0; i < s.length; i++) {
      for (let j = i + 1; j < s.length; j++) {
        records.push({
          stepA: s[i].id,
          stepB: s[j].id,
          stepAName: s[i].name,
          stepBName: s[j].name,
          pairCount: 1,
          lastPairedIdx: i,
        })
      }
    }
    return records
  })

  /**
   * Steps sorted by their minimum lastPairedIdx across all their pairs.
   * Top 2 are marked leastRecentlyPaired: true.
   */
  const pairDebt: ComputedRef<{ stepId: string; stepName: string; leastRecentlyPaired: boolean }[]> = computed(() => {
    const s = steps.value
    if (s.length === 0) return []

    const minIdx: Record<string, number> = {}
    for (const step of s) {
      minIdx[step.id] = Infinity
    }
    for (const pair of allPairs.value) {
      if (pair.lastPairedIdx < minIdx[pair.stepA]) {
        minIdx[pair.stepA] = pair.lastPairedIdx
      }
      if (pair.lastPairedIdx < minIdx[pair.stepB]) {
        minIdx[pair.stepB] = pair.lastPairedIdx
      }
    }

    const sorted = [...s].sort((a, b) => (minIdx[a.id] ?? Infinity) - (minIdx[b.id] ?? Infinity))

    return sorted.map((step, i) => ({
      stepId: step.id,
      stepName: step.name,
      leastRecentlyPaired: i < 2,
    }))
  })

  /**
   * First 3 pairs (or all if fewer than 3).
   */
  const nextRotation: ComputedRef<PairRecord[]> = computed(() =>
    allPairs.value.slice(0, 3),
  )

  /**
   * Copies the full rotation table + pair debt section as Markdown.
   */
  function copyMarkdown(): void {
    const header = `| Step A | Step B | Count |\n|--------|--------|-------|\n`
    const rows = allPairs.value
      .map(p => `| ${p.stepAName} | ${p.stepBName} | ${p.pairCount} |`)
      .join('\n')

    const debtSection = `\n\n## Pair Debt\n\n` +
      pairDebt.value
        .map(d => `- ${d.stepName}${d.leastRecentlyPaired ? ' ⚠ (least recently paired)' : ''}`)
        .join('\n')

    const md = `## Pair Rotation Schedule

${header}${rows}${debtSection}`

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(md).catch(() => {})
    }

    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return {
    allPairs,
    nextRotation,
    pairDebt,
    copyMarkdown,
    copied,
  }
}
