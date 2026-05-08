// UNIT_TYPE=Composable
// Feature #163 — Evo Step Cognitive Load Tracker
import { ref, computed, type Ref, type ComputedRef } from 'vue'

export type LoadLevel = 'low' | 'medium' | 'high' | 'critical'

export interface CogLoadEntry {
  stepId: string
  stepName: string
  complexityScore: number
  technicalNewness: number
  cognitiveLoad: number
  loadLevel: LoadLevel
}

export interface CogLoadStep {
  id: string
  name: string
  effort?: number
}

const SUGGEST_BANK = [
  'Break into 2 smaller tasks',
  'Add a spike to clarify unknowns first',
  'Pair program to reduce individual load',
  'Defer non-critical sub-tasks to next cycle',
] as const

/** charCode-sum seed for a string */
function charSeed(s: string): number {
  return s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function computeEntry(step: CogLoadStep): CogLoadEntry {
  const seed = charSeed(step.id + step.name)
  const wordCount = step.name.trim().split(/\s+/).length
  const effort = step.effort ?? 4
  const complexityScore = clamp(wordCount * effort, 1, 50)
  const technicalNewness = (seed % 10) + 1  // range 1–10
  const cognitiveLoad = clamp(complexityScore + technicalNewness, 0, 100)

  let loadLevel: LoadLevel
  if (cognitiveLoad <= 20) {
    loadLevel = 'low'
  } else if (cognitiveLoad <= 40) {
    loadLevel = 'medium'
  } else if (cognitiveLoad <= 60) {
    loadLevel = 'high'
  } else {
    loadLevel = 'critical'
  }

  return {
    stepId: step.id,
    stepName: step.name,
    complexityScore,
    technicalNewness,
    cognitiveLoad,
    loadLevel,
  }
}

export function useCognitiveLoad(steps: Ref<CogLoadStep[]>) {
  const copied = ref(false)

  /** All cog-load entries in the same order as steps. */
  const entries: ComputedRef<CogLoadEntry[]> = computed(() =>
    steps.value.map(computeEntry),
  )

  /** Entries sorted by cognitiveLoad descending (highest load first). */
  const sortedEntries: ComputedRef<CogLoadEntry[]> = computed(() =>
    [...entries.value].sort((a, b) => b.cognitiveLoad - a.cognitiveLoad),
  )

  /**
   * Returns a simplification suggestion for a given stepId.
   * Uses seed % 4 to pick from SUGGEST_BANK — deterministic, no Math.random.
   */
  function simplifySuggestion(stepId: string): string {
    const step = steps.value.find(s => s.id === stepId)
    if (!step) return SUGGEST_BANK[0]
    const seed = charSeed(step.id + step.name)
    return SUGGEST_BANK[seed % 4]
  }

  /**
   * Copies the full cog-load table as Markdown pipe table.
   * Columns: Step | Complexity | Newness | Load | Level
   */
  function copyMarkdown(): void {
    const header = '| Step | Complexity | Newness | Load | Level |\n|------|------------|---------|------|-------|\n'
    const rows = entries.value
      .map(e => `| ${e.stepName} | ${e.complexityScore} | ${e.technicalNewness} | ${e.cognitiveLoad} | ${e.loadLevel} |`)
      .join('\n')

    const md = `## Cognitive Load Summary\n\n${header}${rows}`

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(md).catch(() => {})
    }

    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return {
    entries,
    sortedEntries,
    simplifySuggestion,
    copyMarkdown,
    copied,
  }
}
