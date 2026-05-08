// UNIT_TYPE=Composable
// Feature #117 — Spec Cost of Quality Estimator
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface CoqEntry {
  id: string
  name: string
  prevention: number
  appraisal: number
  failureCost: number
  total: number
  decision: 'invest-more' | 'good-enough' | 'insufficient-data'
}

export function parseFirstNum(text: string): number {
  const match = text.match(/(\d[\d,.]*)/)
  if (!match) return 0
  const parsed = parseFloat(match[1].replace(/,/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

export function goalGap(goal: string, status: string): number {
  const g = parseFirstNum(goal)
  const s = parseFirstNum(status)
  return Math.abs(g - s)
}

export function computeDecision(
  prevention: number,
  appraisal: number,
  failureCost: number,
): 'invest-more' | 'good-enough' | 'insufficient-data' {
  if (failureCost > (prevention + appraisal) * 2) return 'invest-more'
  if (prevention + appraisal >= failureCost * 0.5) return 'good-enough'
  return 'insufficient-data'
}

export function useCostOfQuality(blocks: Ref<SpecBlock | null>) {
  const entries = ref<CoqEntry[]>([])

  function buildEntry(vId: string, goal: string, status: string): CoqEntry {
    const gap = goalGap(goal, status)
    const failureCost = gap * 100
    const prevention = 0
    const appraisal = 0
    return {
      id: vId,
      name: vId,
      prevention,
      appraisal,
      failureCost,
      total: prevention + appraisal + failureCost,
      decision: computeDecision(prevention, appraisal, failureCost),
    }
  }

  watch(
    blocks,
    (newBlock) => {
      if (!newBlock) {
        entries.value = []
        return
      }
      if (entries.value.length === 0) {
        entries.value = newBlock.values.map(v =>
          buildEntry(v.id, v.goal ?? '', v.status ?? ''),
        )
      } else {
        const existingMap = new Map(entries.value.map(e => [e.id, e]))
        entries.value = newBlock.values.map(v => {
          const existing = existingMap.get(v.id)
          if (existing) return existing
          return buildEntry(v.id, v.goal ?? '', v.status ?? '')
        })
      }
    },
    { immediate: true },
  )

  function updateCost(id: string, field: 'prevention' | 'appraisal', value: number): void {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return
    entry[field] = Math.max(0, value)
    entry.total = entry.prevention + entry.appraisal + entry.failureCost
    entry.decision = computeDecision(entry.prevention, entry.appraisal, entry.failureCost)
  }

  const totalCoQ = computed<number>(() => entries.value.reduce((sum, e) => sum + e.total, 0))

  const dominantDecision = computed<string>(() => {
    const counts: Record<string, number> = {}
    for (const e of entries.value) {
      counts[e.decision] = (counts[e.decision] ?? 0) + 1
    }
    let best = 'insufficient-data'
    let bestCount = 0
    for (const [key, count] of Object.entries(counts)) {
      if (count > bestCount) {
        best = key
        bestCount = count
      }
    }
    return best
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const header = '| Name | Prevention | Appraisal | Failure | Total | Decision |'
    const sep = '|---|---|---|---|---|---|'
    const rows = entries.value.map(
      e =>
        `| ${e.name} | $${e.prevention} | $${e.appraisal} | $${e.failureCost} | $${e.total} | ${e.decision} |`,
    )
    const text = [header, sep, ...rows].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    entries,
    updateCost,
    totalCoQ,
    dominantDecision,
    copyMarkdown,
    copied,
  }
}
