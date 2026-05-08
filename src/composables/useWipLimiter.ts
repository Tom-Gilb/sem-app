// UNIT_TYPE=Composable
// Feature #128 — Evo step WIP limit enforcer
import { ref, computed } from 'vue'
import type { Ref } from 'vue'

export interface WipStatus {
  activeCount: number        // steps with status 'in-progress' or 'active' or no status (assume active)
  wipLimit: number           // default 3
  overLimit: boolean         // activeCount > wipLimit
  pauseSuggestions: string[] // step names to pause (lowest WSJF score first, up to overLimit - wipLimit)
}

export function useWipLimiter(
  evoSteps: Ref<{ id: string; name: string; description?: string; wsjf?: number }[]>
) {
  const wipLimit = ref(3)

  const status = computed<WipStatus>(() => {
    const steps = evoSteps.value
    const activeCount = steps.length

    const overLimit = activeCount > wipLimit.value
    let pauseSuggestions: string[] = []

    if (overLimit) {
      const excessCount = activeCount - wipLimit.value
      // Sort by lowest wsjf first; use index descending as proxy when wsjf is undefined
      const sorted = [...steps]
        .map((s, i) => ({ ...s, _index: i }))
        .sort((a, b) => {
          const aWsjf = a.wsjf ?? -(a._index)
          const bWsjf = b.wsjf ?? -(b._index)
          return aWsjf - bWsjf
        })
      pauseSuggestions = sorted.slice(0, excessCount).map(s => s.name)
    }

    return {
      activeCount,
      wipLimit: wipLimit.value,
      overLimit,
      pauseSuggestions,
    }
  })

  function increaseLimit(): void {
    wipLimit.value = Math.min(8, wipLimit.value + 1)
  }

  function decreaseLimit(): void {
    wipLimit.value = Math.max(1, wipLimit.value - 1)
  }

  const copied = ref(false)

  function copyMarkdown(): void {
    const s = status.value
    const lines = [`WIP Status: ${s.activeCount} active / ${s.wipLimit} limit`]
    if (s.pauseSuggestions.length > 0) {
      lines.push('Suggested pauses:')
      for (const name of s.pauseSuggestions) {
        lines.push(`- ${name}`)
      }
    }
    const text = lines.join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }

    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return { status, wipLimit, increaseLimit, decreaseLimit, copyMarkdown, copied }
}
