// UNIT_TYPE=Hook
// useTaskSuggestions — derives task suggestions from an EvoStep description
// Full implementation — Evo Step 8 (S.Evo8.TaskSuggestionHandler)
// Spec: S.Evo8.TaskDecompositionUI / F.SupportTaskDecomposition

import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'

// Imperative verb prefixes that signal an actionable task sentence.
// Kept as a constant so the extraction rule is easy to audit and extend.
const IMPERATIVE_VERBS = [
  'implement',
  'create',
  'add',
  'build',
  'configure',
  'write',
  'define',
  'set up',
  'verify',
  'test',
  'deploy',
  'expose',
  'extend',
  'update',
  'integrate',
  'generate',
  'validate',
  'migrate',
  'provision',
  'design',
]

// Regex that matches a sentence boundary: period, exclamation, or question mark
// followed by optional whitespace then an uppercase letter or end-of-string.
const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+(?=[A-Z])/

/**
 * Extracts up to `limit` candidate task descriptions from a text by splitting on
 * sentence boundaries, then filtering to sentences that begin with an imperative
 * verb phrase. Returns matched sentences trimmed of surrounding whitespace.
 *
 * @param text - The source text to extract tasks from
 * @param limit - Maximum number of candidates to return (default 5)
 * @returns Array of candidate task description strings (may be empty)
 */
function extractImperativeSentences(text: string, limit = 5): string[] {
  if (!text.trim()) return []

  // Split on sentence boundaries to get individual sentences
  const sentences = text
    .split(SENTENCE_BOUNDARY_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const candidates: string[] = []

  for (const sentence of sentences) {
    if (candidates.length >= limit) break

    // Check if the sentence starts with one of the imperative verbs (case-insensitive)
    const lower = sentence.toLowerCase()
    const startsWithVerb = IMPERATIVE_VERBS.some((verb) => lower.startsWith(verb))

    if (startsWithVerb) {
      // Strip trailing punctuation for clean task descriptions
      candidates.push(sentence.replace(/[.!?]+$/, '').trim())
    }
  }

  return candidates
}

/**
 * Builds a stable, deterministic task ID for a given step name and task index.
 * Format: task-<slugified-step-name>-<index>
 */
function buildTaskId(stepName: string, index: number): string {
  const slug = stepName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `task-${slug}-${index}`
}

/**
 * Composable that derives task suggestions from an EvoStep's description using
 * rule-based extraction. No LLM call is made — token cost is kept low per spec.
 *
 * Extraction rules (in priority order):
 *  1. Split description on sentence boundaries.
 *  2. Keep sentences whose first word is an imperative verb (see IMPERATIVE_VERBS).
 *  3. Return up to 5 candidates.
 *  4. If fewer than 2 candidates are found, fall back to splitting the description
 *     into 2 equal halves as generic task suggestions.
 *  5. If the description is empty, return 2 generic placeholder tasks.
 *
 * Both mock mode (VITE_MOCK_MODE=true) and real mode use the same rule-based logic —
 * no LLM call is made in either mode. This keeps token cost near zero per spec.
 *
 * @returns {{ suggestTasks }}
 *   - suggestTasks(step): derives TaskSuggestion[] from step.description.
 *     Always returns ≥2 tasks.
 *
 * Preconditions: none — the function handles empty and short descriptions gracefully.
 * Errors: never throws; falls back to generic placeholders on any edge case.
 *
 * @example
 * const { suggestTasks } = useTaskSuggestions()
 * const tasks = suggestTasks(evoStep)
 * // tasks is always TaskSuggestion[] with length ≥ 2
 */
export function useTaskSuggestions() {
  /**
   * Derives ≥2 TaskSuggestion objects from an EvoStep's description.
   *
   * @param step - The EvoStep to derive tasks from
   * @returns TaskSuggestion[] with length ≥ 2
   */
  function suggestTasks(step: EvoStep): TaskSuggestion[] {
    const description = step.description ?? ''

    // --- Attempt rule-based extraction ---
    const extracted = extractImperativeSentences(description)

    let taskDescriptions: string[]

    if (extracted.length >= 2) {
      // Rule extraction succeeded — use extracted candidates
      taskDescriptions = extracted
    } else if (description.trim().length === 0) {
      // Empty description — fall back to generic placeholders
      taskDescriptions = [
        'Define the requirements for this step',
        'Implement and verify this step',
      ]
    } else if (extracted.length === 1) {
      // Exactly one imperative sentence — use it as task 1; derive task 2 from
      // the remainder of the description (if any), else synthesise a verify step.
      const sentence = extracted[0]
      const remainder = description
        .slice(description.toLowerCase().indexOf(sentence.toLowerCase()) + sentence.length)
        .replace(/^[.!?,;\s]+/, '')
        .trim()
        .replace(/[.!?]+$/, '')
        .trim()
      taskDescriptions = [
        sentence,
        remainder.length > 8 ? remainder : `Verify and test: ${sentence.slice(0, 60)}`,
      ]
    } else {
      // No imperative sentences found — try splitting on clause connectors
      // (" and ", "; ") before falling back to a word-boundary mid-split.
      // This avoids the previous bug of cutting words at a raw character index.
      const trim = description.trim().replace(/[.!?]+$/, '').trim()

      // Try clause-level split on " and " or "; "
      const clauseSplit = trim.split(/\s+and\s+|;\s*/i).map(s => s.trim()).filter(Boolean)
      if (clauseSplit.length >= 2) {
        taskDescriptions = [clauseSplit[0], clauseSplit.slice(1).join(' and ')]
      } else {
        // Word-boundary mid-split — never cut inside a word
        const mid = Math.ceil(trim.length / 2)
        const spaceAfter  = trim.indexOf(' ', mid)
        const spaceBefore = trim.lastIndexOf(' ', mid)
        const splitAt = spaceAfter === -1 && spaceBefore === -1 ? mid
          : spaceAfter  === -1 ? spaceBefore
          : spaceBefore === -1 ? spaceAfter
          : (spaceAfter - mid) <= (mid - spaceBefore) ? spaceAfter : spaceBefore
        taskDescriptions = [
          trim.slice(0, splitAt).trim().replace(/[.!?]+$/, '').trim() || 'Plan this step',
          trim.slice(splitAt).trim().replace(/[.!?]+$/, '').trim()    || 'Complete this step',
        ]
      }
    }

    // --- Build TaskSuggestion objects ---
    return taskDescriptions.map((desc, i): TaskSuggestion => ({
      id: buildTaskId(step.name, i),
      description: desc,
      effortHours: null,
      assignee: null,
      completed: false,
    }))
  }

  return { suggestTasks }
}
