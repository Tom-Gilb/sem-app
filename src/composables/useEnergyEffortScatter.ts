// UNIT_TYPE=Composable
// Feature #185 — Evo step "energy-effort scatter"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export type Quadrant = 'Focus' | 'Grind' | 'Coast' | 'Waste'

export interface ScatterPoint {
  stepId: string
  stepTitle: string
  energy: number    // 1–4
  effort: number    // 2–10
  quadrant: Quadrant
}

export interface UseEnergyEffortScatterReturn {
  open: Ref<boolean>
  points: ComputedRef<ScatterPoint[]>
  dominantQuadrant: ComputedRef<Quadrant | null>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function resolveQuadrant(energy: number, effort: number): Quadrant {
  if (energy > 2 && effort > 5) return 'Grind'
  if (energy > 2 && effort <= 5) return 'Focus'
  if (energy <= 2 && effort > 5) return 'Waste'
  return 'Coast'
}

export function useEnergyEffortScatter(
  steps: () => Array<{ id: string; title: string; effort?: number }>,
): UseEnergyEffortScatterReturn {
  const open = ref(false)
  const copied = ref(false)

  const points = computed((): ScatterPoint[] => {
    const allSteps = steps()
    if (!allSteps.length) return []

    return allSteps.map((s) => {
      const energy = seed(s.id + 'en', 4) + 1  // 1–4
      const effort =
        s.effort !== undefined && s.effort > 0
          ? s.effort
          : seed(s.id + 'ef', 9) + 2  // 2–10
      const quadrant = resolveQuadrant(energy, effort)
      return { stepId: s.id, stepTitle: s.title, energy, effort, quadrant }
    })
  })

  const dominantQuadrant = computed((): Quadrant | null => {
    const list = points.value
    if (!list.length) return null

    const counts: Record<Quadrant, number> = { Focus: 0, Grind: 0, Coast: 0, Waste: 0 }
    for (const p of list) counts[p.quadrant]++

    let maxCount = 0
    let dominant: Quadrant | null = null
    for (const [q, count] of Object.entries(counts) as [Quadrant, number][]) {
      if (count > maxCount) {
        maxCount = count
        dominant = q
      }
    }
    return dominant
  })

  async function copyMarkdown(): Promise<void> {
    const list = points.value
    const lines: string[] = []
    lines.push('## Energy-Effort Scatter')
    lines.push('')
    lines.push('| Step | Energy | Effort | Quadrant |')
    lines.push('|---|---|---|---|')
    for (const p of list) {
      lines.push(`| ${p.stepTitle} | ${p.energy} | ${p.effort} | ${p.quadrant} |`)
    }

    const md = lines.join('\n')
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      // clipboard may not be available in all environments
    }
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return {
    open,
    points,
    dominantQuadrant,
    copyMarkdown,
    copied,
  }
}
