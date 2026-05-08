// UNIT_TYPE=Composable
// Feature #139 — Spec "user journey mapper"
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface JourneyStep {
  id: string
  trigger: string    // 'When [F. entry name without leading verb]' or derived
  action: string     // F. entry description first sentence, or F. entry name
  outcome: string    // linked V. entry name or 'Improved outcome'
  fEntryId: string
  highlighted: boolean
  /** @deprecated use outcome directly */
  linked: boolean
}

/** Extract all 4+ char words from a string, lowercased */
function extractWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? []
  return new Set(words)
}

/** Count shared 4+ char words between two strings */
function sharedWordCount(a: string, b: string): number {
  const wordsA = extractWords(a)
  const wordsB = extractWords(b)
  let count = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) count++
  }
  return count
}

/** Build trigger: 'When ' + name stripped of leading verb */
function buildTrigger(fId: string): string {
  // Strip type prefix like "F." or "F.ProvideSEM" → "ProvideSEM"
  const name = fId.replace(/^[A-Za-z]\.\s*/i, '')
  const stripped = name.replace(/^(Create|Build|Implement|Design|Add|Provide|Enable|Allow|Support)\s*/i, '').trim()
  return 'When ' + (stripped || name)
}

/** Extract first sentence from description */
function firstSentence(text: string): string {
  if (!text?.trim()) return ''
  const parts = text.split('.')
  return parts[0].trim()
}

export function useUserJourney(blocks: SpecBlock[]) {
  const selectedId = ref<string | null>(null)

  const steps = computed<JourneyStep[]>(() => {
    const allFunctions = blocks.flatMap(b => b.functions)
    const allValues = blocks.flatMap(b => b.values)

    return allFunctions.map((f, idx) => {
      const fName = f.id ?? `F${idx}`
      const fDesc = f.description?.trim() ?? ''

      // Build search corpus for this F. entry
      const fCorpus = `${f.id} ${f.description} ${f.functionOfValue}`

      // Find best-matching V. entry by shared 4+ char word count
      let bestMatch = null
      let bestScore = 0
      for (const v of allValues) {
        const vCorpus = `${v.id} ${v.description} ${v.scale} ${v.valueOfFunction}`
        const score = sharedWordCount(fCorpus, vCorpus)
        if (score > bestScore) {
          bestScore = score
          bestMatch = v
        }
      }

      const linked = bestMatch !== null && bestScore > 0
      const outcome = linked && bestMatch
        ? bestMatch.id
        : 'Improved outcome'

      const action = firstSentence(fDesc) || fName

      const stepId = f.id || `step-${idx}`

      return {
        id: stepId,
        fEntryId: stepId,
        trigger: buildTrigger(fName),
        action,
        outcome,
        linked,
        highlighted: selectedId.value === null || selectedId.value === stepId,
      }
    })
  })

  function selectStep(id: string): void {
    selectedId.value = selectedId.value === id ? null : id
  }

  // Alias for selectStep
  function select(id: string): void {
    selectStep(id)
  }

  function isHighlighted(id: string): boolean {
    return selectedId.value === null || selectedId.value === id
  }

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = []
    lines.push('| Trigger | Action | Outcome |')
    lines.push('| --- | --- | --- |')
    for (const step of steps.value) {
      lines.push(`| ${step.trigger} | ${step.action} | ${step.outcome} |`)
    }
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    steps,
    selectedId,
    selectStep,
    select,
    isHighlighted,
    copyMarkdown,
    copied,
  }
}
