/**
 * useFeatureSuggestions — Feature Organisation Design (spec §2)
 *
 * Reads the live spec and surfaces up to 2 contextual button suggestions.
 * Rules match the spec in SEM-Features.md § Contextual Suggestion Strip.
 */
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface FeatureSuggestion {
  /** Display label matching the button text */
  label: string
  /** Feature number string — used to trigger the action */
  buttonKey: string
  /** One-line reason shown in the strip */
  reason: string
  emoji: string
}

export function useFeatureSuggestions(
  spec: () => SpecBlock | null,
  qualityScore: () => number | null,
) {
  const suggestions = computed<FeatureSuggestion[]>(() => {
    const s = spec()
    if (!s) return []

    const results: FeatureSuggestion[] = []
    const vs = s.values ?? []
    const fs = s.functions ?? []
    const ss = s.solutions ?? []

    // Rule 1: V. entries have numeric Goals → Goal Ladder
    const hasNumericGoals = vs.some(v => v.goal && /\d/.test(v.goal))
    if (hasNumericGoals) {
      results.push({
        label: 'Goal Ladder',
        buttonKey: '104',
        reason: 'Value entries have numeric goals — visualise the progression',
        emoji: '🪜',
      })
    }

    // Rule 2: S. entries outnumber V. entries → Resilience Checker
    if (ss.length > vs.length && results.length < 2) {
      results.push({
        label: 'Resilience Checker',
        buttonKey: '103',
        reason: `${ss.length} solutions vs ${vs.length} values — check for over-engineering`,
        emoji: '🛡️',
      })
    }

    // Rule 3: No Meter fields on any V. entry → Accessibility Check
    const noMeter = vs.length > 0 && vs.every(v => !v.meter)
    if (noMeter && results.length < 2) {
      results.push({
        label: 'Accessibility Check',
        buttonKey: '38',
        reason: 'No Meter fields — spec may be unverifiable',
        emoji: '♿',
      })
    }

    // Rule 4: All numeric Goals ≤ 110% of Tolerable → Make Ambitious
    const numericPairs = vs.filter(v => {
      const g = parseFloat(v.goal ?? '')
      const t = parseFloat(v.tolerable ?? '')
      return !isNaN(g) && !isNaN(t)
    })
    const allSafe =
      numericPairs.length > 0 &&
      numericPairs.every(v => {
        const g = parseFloat(v.goal!)
        const t = parseFloat(v.tolerable!)
        return g <= t * 1.1
      })
    if (allSafe && results.length < 2) {
      results.push({
        label: 'Make Ambitious',
        buttonKey: '19',
        reason: 'Goals are barely above Tolerable — push them higher',
        emoji: '🚀',
      })
    }

    // Rule 5: Many F. entries, few S. entries → Innovation Score
    if (fs.length > 3 && ss.length <= 1 && results.length < 2) {
      results.push({
        label: 'Innovation Score',
        buttonKey: '129',
        reason: `${fs.length} functions but only ${ss.length} solutions — spot the gap`,
        emoji: '💡',
      })
    }

    // Rule 6: Low quality score → Auto-Improve
    const score = qualityScore()
    if (score !== null && score < 60 && results.length < 2) {
      results.push({
        label: 'Auto-Improve',
        buttonKey: '88',
        reason: `Quality score ${score}/100 — auto-improve can raise it quickly`,
        emoji: '✨',
      })
    }

    return results.slice(0, 2)
  })

  return { suggestions }
}
