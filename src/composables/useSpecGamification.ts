// UNIT_TYPE=Composable
// Feature #107 — "Spec health" gamification
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

// Points per filled field (V. entries only, since they have the most fields):
const FIELD_POINTS: Record<string, number> = {
  scale:       10,
  meter:       10,
  goal:        15,
  tolerable:   10,
  status:      10,
  description: 5,
  wish:        5,   // bonus
}

interface Level {
  name: string
  minXp: number
  colour: string
  badge: string
}

const LEVELS: Level[] = [
  { name: 'Novice',       minXp: 0,  colour: 'slate',   badge: '🌱' },
  { name: 'Practitioner', minXp: 50, colour: 'amber',   badge: '🔧' },
  { name: 'Expert',       minXp: 80, colour: 'emerald', badge: '⭐' },
]

export const MAX_XP = 100

export function useSpecGamification(spec: Ref<SpecBlock | null>) {
  const xp = computed<number>(() => {
    if (!spec.value) return 0

    let total = 0

    // V. entries
    for (const v of spec.value.values) {
      const fields: Record<string, string | undefined> = {
        scale:       v.scale,
        meter:       v.meter,
        goal:        v.goal,
        tolerable:   v.tolerable,
        status:      v.status,
        description: v.description,
        wish:        v.wish,
      }
      for (const [key, value] of Object.entries(fields)) {
        if (value && value.trim() !== '') {
          total += FIELD_POINTS[key] ?? 0
        }
      }
    }

    // F. entries: 5 pts for having description
    for (const f of spec.value.functions) {
      if (f.description && f.description.trim() !== '') {
        total += 5
      }
    }

    // S. entries: 5 pts for having description
    for (const s of spec.value.solutions) {
      if (s.description && s.description.trim() !== '') {
        total += 5
      }
    }

    return Math.min(total, MAX_XP)
  })

  const level = computed<Level>(() => {
    const sorted = [...LEVELS].reverse() // highest first
    return sorted.find(l => xp.value >= l.minXp) ?? LEVELS[0]
  })

  const maxXp = MAX_XP

  const xpBarWidth = computed<string>(() => `${Math.min(xp.value, maxXp)}%`)

  return { xp, level, xpBarWidth, maxXp }
}
