// UNIT_TYPE=Hook
//
// useEvoSharpAnswers.ts — Persistence layer for the Sharpen Next Step
// (Evo Sharp Interview) tool.
//
// 2026-06-03 SECOND EDITION (Tom: *"suggest 3 useful suggested answers, to
// tick if approved, any combination… Default, Use ticked and any Planner
// answer, and state that they will be used by default"*).
//
// Each question now carries:
//   - typed   : the Planner's free-text answer (string)
//   - ticked  : indices of approved AI suggestions (number[])
//   - mode    : selection mode that combines them — 'mixed' (default) |
//               'all' | 'typed-only' | 'ticked-only'
//
// Backward-compatible migration: old v1 storage was a flat string per question.
// On read, any string value is wrapped as { typed: value, ticked: [], mode: 'mixed' }.
// Storage key remains evoSharp:v1:* (no key bump needed because the migration
// is non-destructive).
//
// v2: localStorage only.  Future: persist to plan model (so answers travel).

import { ref, watch, computed, type Ref } from 'vue'

/** Selection mode — which sources contribute to the effective answer.
 *  - 'mixed'       : typed answer + only ticked suggestions (DEFAULT)
 *  - 'all'         : typed answer + ALL suggestions (ignores ticked state)
 *  - 'typed-only'  : just the typed answer
 *  - 'ticked-only' : just the ticked suggestions (typed answer excluded) */
export type SelectionMode = 'mixed' | 'all' | 'typed-only' | 'ticked-only'

export const DEFAULT_SELECTION_MODE: SelectionMode = 'mixed'

/** Per-question answer record.  All fields have safe defaults. */
export interface QuestionAnswer {
  /** The Planner's typed answer. */
  typed: string
  /** Indices of ticked AI-suggested answers (0..N-1 where N = suggestions.length). */
  ticked: number[]
  /** Selection mode — drives effective-answer combination. */
  mode: SelectionMode
  /** Planguage Parameter "Justification" — planner's [!] Because: why they wrote this answer. */
  because?: string
  /** Planguage Parameter "Justification" — planner's ["] Sources: what they referenced. */
  sources?: string
  /** Per-suggestion planner justification (sparse, keyed by suggestion index). Because. */
  suggBecause?: Record<number, string>
  /** Per-suggestion planner justification (sparse, keyed by suggestion index). Sources. */
  suggSources?: Record<number, string>
}

/** A storage value can be either a v1 plain string (legacy) or v2 QuestionAnswer.
 *  The migration normalises on read. */
type StoredQuestionValue = string | QuestionAnswer

/** Top-level storage shape: { [categoryId]: { [questionId]: storedValue } }
 *  Mixed v1 (string) and v2 (object) values both supported. */
export type SharpAnswers = Record<string, Record<string, StoredQuestionValue>>

/** Empty answer factory. */
function emptyAnswer(): QuestionAnswer {
  return { typed: '', ticked: [], mode: DEFAULT_SELECTION_MODE }
}

/** Normalises a stored value (legacy string OR new object) to QuestionAnswer. */
function normaliseStored(v: StoredQuestionValue | undefined): QuestionAnswer {
  if (v === undefined) return emptyAnswer()
  if (typeof v === 'string') {
    // v1 → v2 migration: wrap string as typed answer with defaults.
    return { typed: v, ticked: [], mode: DEFAULT_SELECTION_MODE }
  }
  // v2 object — defensive: backfill any missing fields.
  return {
    typed: typeof v.typed === 'string' ? v.typed : '',
    ticked: Array.isArray(v.ticked) ? v.ticked.filter(n => typeof n === 'number') : [],
    mode: ['mixed', 'all', 'typed-only', 'ticked-only'].includes(v.mode as string)
      ? (v.mode as SelectionMode)
      : DEFAULT_SELECTION_MODE,
    because: typeof v.because === 'string' ? v.because : undefined,
    sources: typeof v.sources === 'string' ? v.sources : undefined,
    suggBecause: (typeof v.suggBecause === 'object' && v.suggBecause !== null) ? v.suggBecause as Record<number, string> : undefined,
    suggSources: (typeof v.suggSources === 'object' && v.suggSources !== null) ? v.suggSources as Record<number, string> : undefined,
  }
}

function storageKey(planId: string, stepName: string): string {
  const safePlan = planId.trim() || 'default'
  const safeStep = stepName.trim() || 'default-step'
  return `evoSharp:v1:${safePlan}:${safeStep}`
}

function readAnswers(planId: string, stepName: string): SharpAnswers {
  try {
    const raw = localStorage.getItem(storageKey(planId, stepName))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as SharpAnswers
  } catch {
    return {}
  }
}

function writeAnswers(planId: string, stepName: string, answers: SharpAnswers): void {
  try {
    localStorage.setItem(storageKey(planId, stepName), JSON.stringify(answers))
  } catch {
    // Quota / private mode — in-memory still holds.
  }
}

/**
 * Computes the effective answer text per the selection mode + ticked suggestions.
 *
 * Effective answer is what export / count / preview all consume.  It is NOT
 * persisted — it is derived fresh from (typed, ticked, mode, suggestions).
 *
 *   mixed       → typed + ticked suggestions (joined by blank line)
 *   all         → typed + all suggestions (ignores ticked state)
 *   typed-only  → just typed
 *   ticked-only → just ticked suggestions (no typed)
 *
 * Returns '' when nothing is effectively answered (e.g., typed-only with empty typed).
 */
export function computeEffectiveAnswer(
  answer: QuestionAnswer,
  suggestions: string[],
): string {
  const typed = answer.typed.trim()
  const tickedTexts = answer.ticked
    .filter(i => i >= 0 && i < suggestions.length)
    .map(i => suggestions[i])
  switch (answer.mode) {
    case 'all':
      return [typed, ...suggestions].filter(s => s.trim().length > 0).join('\n\n')
    case 'typed-only':
      return typed
    case 'ticked-only':
      return tickedTexts.join('\n\n')
    case 'mixed':
    default:
      return [typed, ...tickedTexts].filter(s => s.trim().length > 0).join('\n\n')
  }
}

/**
 * Composable that exposes reactive answers + lifecycle helpers for one
 * (plan, step) tuple.  Auto-persists on any change.
 */
export function useEvoSharpAnswers(planId: Ref<string>, stepName: Ref<string>) {
  const answers = ref<SharpAnswers>(readAnswers(planId.value, stepName.value))

  watch(
    () => [planId.value, stepName.value] as const,
    ([newPlan, newStep]) => {
      answers.value = readAnswers(newPlan, newStep)
    },
  )

  watch(
    answers,
    (val) => {
      writeAnswers(planId.value, stepName.value, val)
    },
    { deep: true },
  )

  /** Returns the full QuestionAnswer record (with defaults filled in). */
  function getAnswer(categoryId: string, questionId: string): QuestionAnswer {
    return normaliseStored(answers.value[categoryId]?.[questionId])
  }

  /** Ensures the (category, question) slot exists, then mutates via callback. */
  function _mutate(categoryId: string, questionId: string, fn: (a: QuestionAnswer) => void): void {
    if (!answers.value[categoryId]) answers.value[categoryId] = {}
    const current = normaliseStored(answers.value[categoryId][questionId])
    fn(current)
    answers.value[categoryId][questionId] = current
  }

  /** Sets just the typed (Planner) answer. */
  function setTypedAnswer(categoryId: string, questionId: string, text: string): void {
    _mutate(categoryId, questionId, a => { a.typed = text })
  }

  /** Toggles a suggestion's ticked state. */
  function toggleTicked(categoryId: string, questionId: string, idx: number): void {
    _mutate(categoryId, questionId, a => {
      const i = a.ticked.indexOf(idx)
      if (i >= 0) a.ticked.splice(i, 1)
      else a.ticked.push(idx)
    })
  }

  /** Sets a suggestion's ticked state directly (true = include, false = exclude). */
  function setTicked(categoryId: string, questionId: string, idx: number, isTicked: boolean): void {
    _mutate(categoryId, questionId, a => {
      const i = a.ticked.indexOf(idx)
      if (isTicked && i < 0) a.ticked.push(idx)
      else if (!isTicked && i >= 0) a.ticked.splice(i, 1)
    })
  }

  /** Sets the selection mode for one question. */
  function setMode(categoryId: string, questionId: string, mode: SelectionMode): void {
    _mutate(categoryId, questionId, a => { a.mode = mode })
  }

  function setPlannerBecause(categoryId: string, questionId: string, val: string): void {
    _mutate(categoryId, questionId, a => { a.because = val })
  }
  function setPlannerSources(categoryId: string, questionId: string, val: string): void {
    _mutate(categoryId, questionId, a => { a.sources = val })
  }
  function setSuggBecause(categoryId: string, questionId: string, idx: number, val: string): void {
    _mutate(categoryId, questionId, a => { if (!a.suggBecause) a.suggBecause = {}; a.suggBecause[idx] = val })
  }
  function setSuggSources(categoryId: string, questionId: string, idx: number, val: string): void {
    _mutate(categoryId, questionId, a => { if (!a.suggSources) a.suggSources = {}; a.suggSources[idx] = val })
  }

  /** Returns whether a suggestion is ticked. */
  function isTicked(categoryId: string, questionId: string, idx: number): boolean {
    return getAnswer(categoryId, questionId).ticked.includes(idx)
  }

  /** Clears all answers for the current (plan, step). */
  function clear(): void {
    answers.value = {}
  }

  /** Computes the effective answer for one question, given its suggestions list. */
  function getEffectiveAnswer(categoryId: string, questionId: string, suggestions: string[]): string {
    return computeEffectiveAnswer(getAnswer(categoryId, questionId), suggestions)
  }

  /** Counts questions whose EFFECTIVE answer is non-empty.  Needs the
   *  category catalogue passed in so the suggestion list is known. */
  function answeredCount(
    catalogue: Array<{ id: string; questions: Array<{ id: string; suggestedAnswers?: string[] }> }>,
  ): number {
    let count = 0
    for (const cat of catalogue) {
      for (const q of cat.questions) {
        const eff = getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? [])
        if (eff.trim().length > 0) count++
      }
    }
    return count
  }

  /** Counts effectively-answered questions within ONE category. */
  function answeredInCategory(
    categoryId: string,
    questions: Array<{ id: string; suggestedAnswers?: string[] }>,
  ): number {
    let count = 0
    for (const q of questions) {
      const eff = getEffectiveAnswer(categoryId, q.id, q.suggestedAnswers ?? [])
      if (eff.trim().length > 0) count++
    }
    return count
  }

  return {
    answers,
    getAnswer,
    setTypedAnswer,
    toggleTicked,
    setTicked,
    setMode,
    setPlannerBecause,
    setPlannerSources,
    setSuggBecause,
    setSuggSources,
    isTicked,
    getEffectiveAnswer,
    clear,
    answeredCount,
    answeredInCategory,
  }
}
