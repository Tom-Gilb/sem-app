// UNIT_TYPE=Composable
// Feature #184 — Spec "specification drift detector"
// Identifies V. entries where goal is missing or goal <= tolerable (numeric comparison).
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type DriftSeverity = 'Critical' | 'Warning' | 'OK'

export interface DriftEntry {
  id: string
  description: string  // truncated 60 chars
  goal: string
  tolerable: string
  goalNum: number | null
  tolerableNum: number | null
  hasDrift: boolean
  driftType: string
  severity: DriftSeverity
}

function parseNum(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

const SEVERITY_ORDER: Record<DriftSeverity, number> = { Critical: 0, Warning: 1, OK: 2 }

export function buildDriftEntry(
  id: string,
  description: string,
  goal: string,
  tolerable: string,
): DriftEntry {
  const goalNum = parseNum(goal)
  const tolerableNum = parseNum(tolerable)

  let hasDrift: boolean
  let driftType: string
  let severity: DriftSeverity

  if (!goal || goal.trim() === '') {
    hasDrift = true
    driftType = 'No goal defined'
    severity = 'Critical'
  } else if (goalNum !== null && tolerableNum !== null && goalNum <= tolerableNum) {
    hasDrift = true
    driftType = 'Goal ≤ Tolerable (should be higher)'
    severity = 'Warning'
  } else {
    hasDrift = false
    driftType = 'No drift detected'
    severity = 'OK'
  }

  return {
    id,
    description: description.slice(0, 60),
    goal,
    tolerable,
    goalNum,
    tolerableNum,
    hasDrift,
    driftType,
    severity,
  }
}

export function useSpecDrift(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): DriftEntry[] => {
    if (blocks.length === 0) return []
    const values = blocks.flatMap(b => b.values)
    const built = values.map(v => buildDriftEntry(v.id, v.description, v.goal, v.tolerable))
    return [...built].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  })

  const driftCount = computed((): number => entries.value.filter(e => e.hasDrift).length)

  const driftScore = computed((): number =>
    Math.round(driftCount.value / Math.max(entries.value.length, 1) * 100),
  )

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Goal | Tolerable | Drift Type | Severity |',
      '|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(`| ${e.id} | ${e.goal} | ${e.tolerable} | ${e.driftType} | ${e.severity} |`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, driftCount, driftScore, copyMarkdown, copied }
}
