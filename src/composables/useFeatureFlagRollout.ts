// UNIT_TYPE=Composable
// Feature #144 — Spec "feature flag rollout" planner
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface RolloutPhase {
  label: string
  percent: number
  criteria: string
  status: 'pending' | 'active' | 'done'
}

export interface RolloutEntry {
  fEntryId: string
  fEntryName: string
  phases: RolloutPhase[]
  currentPhaseIdx: number
}

const PHASE_DEFS: Array<{ label: string; percent: number }> = [
  { label: 'Canary', percent: 5 },
  { label: 'Beta', percent: 25 },
  { label: 'Full', percent: 100 },
]

/** Extract significant words (3+ chars) from a string */
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 3),
  )
}

/** Count keyword overlap between two strings */
function keywordOverlapScore(a: string, b: string): number {
  const wordsA = significantWords(a)
  const wordsB = significantWords(b)
  let count = 0
  for (const w of wordsA) if (wordsB.has(w)) count++
  return count
}

function buildEntries(blocks: SpecBlock[]): RolloutEntry[] {
  const allValues = blocks.flatMap((b) => b.values)

  return blocks.flatMap((block) =>
    block.functions.map((f) => {
      // Find V. entry with best keyword overlap on F. id vs V. id
      let bestV = allValues[0] ?? null
      let bestScore = -1
      for (const v of allValues) {
        const score = keywordOverlapScore(f.id, v.id)
        if (score > bestScore) {
          bestScore = score
          bestV = v
        }
      }

      const goalText = bestV?.goal?.trim() || 'No blocking issues in monitoring'

      const phases: RolloutPhase[] = PHASE_DEFS.map((def, i) => ({
        label: def.label,
        percent: def.percent,
        criteria: goalText,
        status: (i === 0 ? 'active' : 'pending') as RolloutPhase['status'],
      }))

      return {
        fEntryId: f.id,
        fEntryName: f.id,
        phases,
        currentPhaseIdx: 0,
      }
    }),
  )
}

export function useFeatureFlagRollout(blocks: SpecBlock[]) {
  const rolloutEntries = ref<RolloutEntry[]>(buildEntries(blocks))

  function advancePhase(fEntryId: string): void {
    const entry = rolloutEntries.value.find((e) => e.fEntryId === fEntryId)
    if (!entry) return
    if (entry.currentPhaseIdx >= entry.phases.length - 1) return

    entry.phases[entry.currentPhaseIdx].status = 'done'
    entry.currentPhaseIdx++
    entry.phases[entry.currentPhaseIdx].status = 'active'
  }

  function resetPhase(fEntryId: string): void {
    const entry = rolloutEntries.value.find((e) => e.fEntryId === fEntryId)
    if (!entry) return
    for (const phase of entry.phases) {
      phase.status = 'pending'
    }
    entry.currentPhaseIdx = 0
  }

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const header = '| Flag | Canary | Beta | Full | Current Phase |'
    const sep = '|---|---|---|---|---|'
    const rows = rolloutEntries.value.map((e) => {
      const canary = e.phases[0]
      const beta = e.phases[1]
      const full = e.phases[2]
      const phaseCell = (p: RolloutPhase) => `${p.percent}% — ${p.status}`
      const current = e.phases[e.currentPhaseIdx]?.label ?? '—'
      return `| ${e.fEntryId} | ${phaseCell(canary)} | ${phaseCell(beta)} | ${phaseCell(full)} | ${current} |`
    })
    const text = [header, sep, ...rows].join('\n')
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

  const rolloutComputed = computed(() => rolloutEntries.value)

  return {
    rolloutEntries: rolloutComputed,
    advancePhase,
    resetPhase,
    copyMarkdown,
    copied,
  }
}
