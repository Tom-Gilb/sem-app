// UNIT_TYPE=Composable
// Feature #84 — Spec "north star" metric pin
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export function useNorthStar(spec: Ref<SpecBlock | null>) {
  const pinnedId = ref<string | null>(null)

  function pinEntry(id: string): void {
    if (pinnedId.value === id) {
      pinnedId.value = null
    } else {
      pinnedId.value = id
    }
  }

  /** Extract a bag of words (4+ chars) from a string */
  function wordBag(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length >= 4)
  }

  /** Count shared words between two bags */
  function sharedCount(a: string[], b: string[]): number {
    const setB = new Set(b)
    return a.filter(w => setB.has(w)).length
  }

  const relevanceMap = computed<Record<string, number>>(() => {
    if (!pinnedId.value || !spec.value) return {}
    const pinned = spec.value.values.find(v => v.id === pinnedId.value)
    if (!pinned) return {}

    const pinnedBag = wordBag(`${pinned.description} ${pinned.scale}`)
    const pinnedBagSize = pinnedBag.length || 1

    const result: Record<string, number> = {}

    for (const v of spec.value.values) {
      if (v.id === pinnedId.value) {
        result[v.id] = 100
        continue
      }
      const vBag = wordBag(`${v.description} ${v.scale}`)
      const shared = sharedCount(pinnedBag, vBag)
      const vBagSize = vBag.length || 1
      const maxSize = Math.max(pinnedBagSize, vBagSize)
      const ratio = shared / maxSize
      result[v.id] = Math.round(ratio * 100)
    }

    return result
  })

  const pinnedEntry = computed(() =>
    spec.value?.values.find(v => v.id === pinnedId.value) ?? null
  )

  return { pinnedId, pinnedEntry, relevanceMap, pinEntry }
}
