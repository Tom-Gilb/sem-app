// UNIT_TYPE=Composable
// Feature #41 — Spec Readability Score
// Scores a SpecBlock using a simplified Flesch Reading Ease approximation.

import type { SpecBlock } from '../types/spec'

export interface ReadabilityResult {
  score: number          // 0–100 (higher = easier to read)
  grade: string          // "Very Easy" | "Easy" | "Moderate" | "Hard" | "Very Hard"
  avgSentenceLength: number
  avgWordLength: number
  perEntryScores: Array<{ entryId: string; score: number }>
}

export function useReadability() {
  /**
   * Scores a single text string using a simplified Flesch Reading Ease formula.
   * Returns a value clamped to 0–100 (higher = easier).
   */
  function scoreText(text: string): number {
    if (!text || !text.trim()) return 50 // neutral for empty text

    const words = text.split(/\s+/).filter(Boolean)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

    if (words.length === 0) return 50
    if (sentences.length === 0) return 50

    const syllables = words
      .map(w => Math.max(1, w.replace(/[^aeiouAEIOU]/g, '').length))
      .reduce((sum, n) => sum + n, 0)

    const wordsPerSentence = words.length / sentences.length
    const syllablesPerWord = syllables / words.length

    const raw = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord

    return Math.min(100, Math.max(0, raw))
  }

  /**
   * Scores each description field across all F./V./S. entries.
   * Returns an overall average score, a grade, and per-entry scores.
   */
  function scoreSpec(spec: SpecBlock): ReadabilityResult {
    const perEntryScores: Array<{ entryId: string; score: number }> = []

    // Score each entry using its description field
    for (const f of spec.functions) {
      perEntryScores.push({ entryId: f.id, score: scoreText(f.description) })
    }
    for (const v of spec.values) {
      perEntryScores.push({ entryId: v.id, score: scoreText(v.description) })
    }
    for (const s of spec.solutions) {
      perEntryScores.push({ entryId: s.id, score: scoreText(s.description) })
    }

    // Overall score = average of per-entry scores
    const overallScore =
      perEntryScores.length > 0
        ? perEntryScores.reduce((sum, e) => sum + e.score, 0) / perEntryScores.length
        : 50

    const score = Math.round(Math.min(100, Math.max(0, overallScore)))

    // Grade thresholds
    let grade: string
    if (score >= 80)      grade = 'Very Easy'
    else if (score >= 60) grade = 'Easy'
    else if (score >= 40) grade = 'Moderate'
    else if (score >= 20) grade = 'Hard'
    else                  grade = 'Very Hard'

    // Aggregate stats across all description texts
    const allTexts = [
      ...spec.functions.map(f => f.description),
      ...spec.values.map(v => v.description),
      ...spec.solutions.map(s => s.description),
    ].filter(t => t.trim().length > 0)

    let totalWords = 0
    let totalSentences = 0
    let totalCharInWords = 0

    for (const text of allTexts) {
      const words = text.split(/\s+/).filter(Boolean)
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
      totalWords += words.length
      totalSentences += sentences.length
      totalCharInWords += words.reduce((s, w) => s + w.length, 0)
    }

    const avgSentenceLength =
      totalSentences > 0 ? Math.round((totalWords / totalSentences) * 10) / 10 : 0
    const avgWordLength =
      totalWords > 0 ? Math.round((totalCharInWords / totalWords) * 10) / 10 : 0

    return { score, grade, avgSentenceLength, avgWordLength, perEntryScores }
  }

  return { scoreText, scoreSpec }
}
