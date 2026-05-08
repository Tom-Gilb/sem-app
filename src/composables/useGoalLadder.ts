// UNIT_TYPE=Composable
// Feature #104 — Spec "goal ladder" visualiser
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface LadderRung {
  label: string        // "Tolerable", "Goal", "Wish"
  value: string        // the raw value from spec
  numericValue: number // parsed numeric, or 0 if not parseable
  colour: string       // amber / emerald / violet
}

export interface LadderEntry {
  id: string
  rungs: LadderRung[]  // up to 3 rungs (Tolerable, Goal, Wish — omit if empty)
  statusValue: string  // raw status or ""
  maxNumeric: number   // max of all numeric rung values (for height scaling)
}

const NUMERIC_RE = /(-?\d+\.?\d*)/

function parseNumeric(value: string): number {
  // Strip bracketed content (e.g. "[2026, condition]") before extracting first number
  const stripped = value.replace(/\[[^\]]*\]/g, '')
  const match = NUMERIC_RE.exec(stripped)
  return match ? parseFloat(match[1]) : 0
}

export function useGoalLadder(spec: Ref<SpecBlock | null>) {
  const ladderOpen = ref(false)

  const ladderEntries = computed<LadderEntry[]>(() => {
    if (!spec.value) return []

    const entries: LadderEntry[] = []

    for (const v of spec.value.values) {
      const rungs: LadderRung[] = []

      if (v.tolerable && v.tolerable.trim() !== '') {
        rungs.push({
          label: 'Tolerable',
          value: v.tolerable,
          numericValue: parseNumeric(v.tolerable),
          colour: 'amber',
        })
      }

      if (v.goal && v.goal.trim() !== '') {
        rungs.push({
          label: 'Goal',
          value: v.goal,
          numericValue: parseNumeric(v.goal),
          colour: 'emerald',
        })
      }

      if (v.wish && v.wish.trim() !== '') {
        rungs.push({
          label: 'Wish',
          value: v.wish,
          numericValue: parseNumeric(v.wish),
          colour: 'violet',
        })
      }

      const maxNumeric = rungs.length > 0
        ? Math.max(...rungs.map(r => r.numericValue))
        : 0

      entries.push({
        id: v.id,
        rungs,
        statusValue: v.status ?? '',
        maxNumeric,
      })
    }

    return entries
  })

  return { ladderOpen, ladderEntries }
}
