// UNIT_TYPE=Composable
// Feature #112 — ROI Calculator
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface RoiEntry {
  id: string
  name: string
  expectedValue: number  // from Goal field or default 10000
  cost: number           // user-entered
  roi: number            // expectedValue / cost (Infinity if cost=0)
  breakeven: string      // cost / (expectedValue/12) months, or 'N/A'
}

export function parseExpectedValue(goal: string): number {
  const match = goal.match(/(\d[\d,.]*)/)
  if (!match) return 10000
  const numStr = match[1].replace(/,/g, '')
  const parsed = parseFloat(numStr)
  return isNaN(parsed) ? 10000 : parsed * 0.6
}

export function computeRoi(expectedValue: number, cost: number): number {
  if (cost === 0) return Infinity
  return expectedValue / cost
}

export function computeBreakeven(expectedValue: number, cost: number): string {
  if (cost === 0) return 'N/A'
  if (expectedValue === 0) return 'N/A'
  const months = cost / (expectedValue / 12)
  return months.toFixed(1) + ' months'
}

export function useRoiCalculator(spec: Ref<SpecBlock | null>) {
  const entries = ref<RoiEntry[]>([])

  function buildEntries(block: SpecBlock): RoiEntry[] {
    return block.values.map(v => {
      const ev = parseExpectedValue(v.goal || '')
      return {
        id: v.id,
        name: v.id,
        expectedValue: ev,
        cost: 0,
        roi: Infinity,
        breakeven: 'N/A',
      }
    })
  }

  // Rebuild when spec changes
  watch(spec, (newSpec) => {
    if (newSpec) {
      if (entries.value.length === 0) {
        entries.value = buildEntries(newSpec)
      } else {
        // Sync: add new entries, preserve costs for existing
        const existingMap = new Map(entries.value.map(e => [e.id, e]))
        entries.value = newSpec.values.map(v => {
          const existing = existingMap.get(v.id)
          if (existing) return existing
          const ev = parseExpectedValue(v.goal || '')
          return {
            id: v.id,
            name: v.id,
            expectedValue: ev,
            cost: 0,
            roi: Infinity,
            breakeven: 'N/A',
          }
        })
      }
    } else {
      entries.value = []
    }
  }, { immediate: true })

  function updateCost(id: string, cost: number): void {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return
    const safeCost = Math.max(0, cost)
    entry.cost = safeCost
    entry.roi = computeRoi(entry.expectedValue, safeCost)
    entry.breakeven = computeBreakeven(entry.expectedValue, safeCost)
  }

  const sortedByRoi = computed<RoiEntry[]>(() => {
    return [...entries.value].sort((a, b) => {
      // Infinity goes last in the sorted descending list
      if (a.roi === Infinity && b.roi === Infinity) return 0
      if (a.roi === Infinity) return 1
      if (b.roi === Infinity) return -1
      return b.roi - a.roi
    })
  })

  function exportMarkdown(): string {
    const header = '| Name | Expected Value ($) | Cost ($) | ROI | Breakeven |'
    const separator = '|---|---|---|---|---|'
    const rows = sortedByRoi.value.map(e => {
      const roiDisplay = e.roi === Infinity ? '∞' : e.roi.toFixed(2)
      return `| ${e.name} | $${e.expectedValue.toLocaleString()} | $${e.cost.toLocaleString()} | ${roiDisplay} | ${e.breakeven} |`
    })
    return [header, separator, ...rows].join('\n')
  }

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(exportMarkdown())
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { entries, updateCost, sortedByRoi, exportMarkdown, copyMarkdown, copied }
}
