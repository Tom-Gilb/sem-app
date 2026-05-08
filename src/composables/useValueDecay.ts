// UNIT_TYPE=Composable
// Feature #161 — Spec "value decay" estimator
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface DecayEntry {
  vEntryId: string
  vEntryName: string
  decayRatePerWeek: number
  weeksUntilZero: number
  urgencyScore: number
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
}

export function charCodeSeed(text: string): number {
  let s = 0
  for (let i = 0; i < text.length; i++) {
    s += text.charCodeAt(i)
  }
  return s
}

export function buildDecayEntry(vId: string, vName: string): DecayEntry {
  const seed = charCodeSeed(vId)
  const decayRatePerWeek = 1 + (seed % 10)
  const weeksUntilZero = Math.floor(100 / decayRatePerWeek)
  const urgencyScore = Math.min(100, Math.max(0, 100 - weeksUntilZero))
  let urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
  if (urgencyScore >= 70) {
    urgencyLevel = 'critical'
  } else if (urgencyScore >= 50) {
    urgencyLevel = 'high'
  } else if (urgencyScore >= 30) {
    urgencyLevel = 'medium'
  } else {
    urgencyLevel = 'low'
  }

  return {
    vEntryId: vId,
    vEntryName: vName,
    decayRatePerWeek,
    weeksUntilZero,
    urgencyScore,
    urgencyLevel,
  }
}

export function formatDecayMarkdown(entries: DecayEntry[]): string {
  const header = '| V. Entry | Decay %/wk | Weeks Until Zero | Urgency |'
  const divider = '| --- | --- | --- | --- |'
  const rows = entries.map(
    (e) =>
      `| ${e.vEntryName} | ${e.decayRatePerWeek}% | ${e.weeksUntilZero} | ${e.urgencyLevel} |`,
  )
  return [header, divider, ...rows].join('\n')
}

export function useValueDecay(blocks: SpecBlock[]) {
  const copied: Ref<boolean> = ref(false)

  const entries: ComputedRef<DecayEntry[]> = computed<DecayEntry[]>(() => {
    const result: DecayEntry[] = []
    for (const block of blocks) {
      for (const v of block.values) {
        result.push(buildDecayEntry(v.id, v.id))
      }
    }
    return result
  })

  const sortedByUrgency: ComputedRef<DecayEntry[]> = computed<DecayEntry[]>(() =>
    [...entries.value].sort((a, b) => b.urgencyScore - a.urgencyScore),
  )

  async function copyMarkdown(): Promise<void> {
    if (!entries.value.length) return
    const text = formatDecayMarkdown(sortedByUrgency.value)
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

  return { entries, sortedByUrgency, copyMarkdown, copied }
}
