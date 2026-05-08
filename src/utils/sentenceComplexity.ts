// UNIT_TYPE=Utility
// Feature #65 — Sentence complexity scoring

/**
 * Scores sentence complexity on 0-100 scale.
 * Higher = more complex (harder to read).
 * Based on: word count per sentence, avg word length, subordinate clause count.
 */
export function scoreSentenceComplexity(text: string): number {
  if (!text || text.trim().length === 0) return 0

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  if (sentences.length === 0) return 0

  const avgWordsPerSentence = sentences.reduce((sum, s) => {
    return sum + s.trim().split(/\s+/).length
  }, 0) / sentences.length

  const words = text.split(/\s+/).filter(w => w.length > 0)
  const avgWordLength = words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0) / Math.max(words.length, 1)

  // Subordinate clause indicators
  const clauseWords = (text.match(/\b(which|where|when|that|because|although|however|therefore|furthermore|nevertheless)\b/gi) ?? []).length

  const score = Math.min(100,
    (avgWordsPerSentence / 30) * 40 +    // sentence length contributes 40%
    (avgWordLength / 10) * 30 +           // word length contributes 30%
    (clauseWords / 5) * 30                // clause complexity contributes 30%
  )

  return Math.round(score)
}

/**
 * Returns Tailwind colour class for a complexity score.
 */
export function complexityColour(score: number): string {
  if (score < 30) return '#10b981'  // emerald — simple
  if (score < 60) return '#f59e0b'  // amber — moderate
  return '#ef4444'                   // red — complex
}

/**
 * Returns a width percentage string for the complexity bar.
 */
export function complexityBarWidth(score: number): string {
  return `${Math.max(4, score)}%`
}

/**
 * Counts total words in a SpecBlock.
 */
export function countSpecWords(spec: {
  functions: Array<{ description: string }>
  values: Array<{ description: string }>
  solutions: Array<{ description: string }>
}): number {
  const allText = [
    ...spec.functions.map(f => f.description),
    ...spec.values.map(v => v.description),
    ...spec.solutions.map(s => s.description),
  ].join(' ')
  return allText.split(/\s+/).filter(w => w.trim().length > 0).length
}
