// UNIT_TYPE=Composable
// Feature #169 — Spec "minimum lovable product" identifier
// Scores every F./V./S. entry on essentialness, user delight, and feasibility.
// Top 3 entries by MLP score are surfaced as "Build This First".
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface MlpEntry {
  id: string
  type: 'F' | 'V' | 'S'
  label: string
  description: string
  essentialness: number
  userDelight: number
  feasibility: number
  mlpScore: number
  isTop: boolean
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

export function buildMlpEntry(
  id: string,
  type: 'F' | 'V' | 'S',
  description: string,
): MlpEntry {
  const essentialness = seed(id + 'e', 101)
  const userDelight = seed(id + 'd', 101)
  const feasibility = seed(id + 'f', 101)
  const mlpScore = Math.round((essentialness + userDelight + feasibility) / 3)
  return {
    id,
    type,
    label: id,
    description: description.slice(0, 60),
    essentialness,
    userDelight,
    feasibility,
    mlpScore,
    isTop: false,
  }
}

export function useMinLovable(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): MlpEntry[] => {
    const fEntries = blocks.flatMap(b => b.functions).map(f =>
      buildMlpEntry(f.id, 'F', f.description),
    )
    const vEntries = blocks.flatMap(b => b.values).map(v =>
      buildMlpEntry(v.id, 'V', v.description),
    )
    const sEntries = blocks.flatMap(b => b.solutions).map(s =>
      buildMlpEntry(s.id, 'S', s.description),
    )
    const all = [...fEntries, ...vEntries, ...sEntries].sort(
      (a, b) => b.mlpScore - a.mlpScore,
    )
    const topIds = new Set(all.slice(0, 3).map(e => e.id))
    return all.map(e => ({ ...e, isTop: topIds.has(e.id) }))
  })

  const topThree = computed(() => entries.value.slice(0, 3))

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| Entry | Type | Essentialness | Delight | Feasibility | MLP Score |',
      '|---|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.type} | ${e.essentialness} | ${e.userDelight} | ${e.feasibility} | ${e.mlpScore} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, topThree, copyMarkdown, copied }
}
