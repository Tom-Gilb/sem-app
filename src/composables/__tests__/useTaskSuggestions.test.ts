// Spec: V.EvoStep8.TaskSuggestions — app pre-suggests ≥2 tasks for each Evo step
// Tests for useTaskSuggestions composable (S.Evo8.TaskSuggestionHandler)

import { describe, test, expect } from 'vitest'
import { useTaskSuggestions } from '../useTaskSuggestions'
import type { EvoStep } from '../../types/evo-plan'

/** Helper to build a minimal EvoStep with the given description */
function makeStep(description: string, name = 'S.TestStep'): EvoStep {
  return {
    name,
    description,
    linkedValues: ['V.Test'],
    linkedSolution: 'S.Test',
    effortPercent: 10,
  }
}

describe('useTaskSuggestions', () => {
  describe('suggestTasks', () => {
    // ── Imperative verb extraction ──────────────────────────────────────────

    test('step with multiple imperative verb sentences → extracts correct task count', () => {
      // Spec: V.EvoStep8.TaskSuggestions — ≥2 tasks extracted per step
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep(
        'Implement the API handler. Create the database schema. Add unit tests. Configure the deployment pipeline. Verify the integration works end-to-end.',
      )
      const tasks = suggestTasks(step)
      // 5 imperative sentences → should extract all 5 (≤5 limit)
      expect(tasks.length).toBe(5)
    })

    test('task descriptions match the imperative sentences in the input', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('Build the composable. Write unit tests for all edge cases.')
      const tasks = suggestTasks(step)
      expect(tasks.length).toBeGreaterThanOrEqual(2)
      expect(tasks[0].description).toBe('Build the composable')
      expect(tasks[1].description).toBe('Write unit tests for all edge cases')
    })

    test('extracts up to 5 tasks even when description has more than 5 imperative sentences', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep(
        'Implement A. Create B. Add C. Build D. Configure E. Write F. Deploy G.',
      )
      const tasks = suggestTasks(step)
      expect(tasks.length).toBeLessThanOrEqual(5)
    })

    test('extraction is case-insensitive for imperative verbs', () => {
      const { suggestTasks } = useTaskSuggestions()
      // "Implement" with capital I should still match
      const step = makeStep('Implement the handler. Create the schema.')
      const tasks = suggestTasks(step)
      expect(tasks.length).toBeGreaterThanOrEqual(2)
    })

    // ── Fallback: fewer than 2 imperative sentences ─────────────────────────

    test('step with short description that has no imperative verbs → fallback produces exactly 2 tasks', () => {
      // Spec: V.EvoStep8.TaskSuggestions — fallback to 2-half split when extraction < 2
      const { suggestTasks } = useTaskSuggestions()
      // "This is a non-imperative description." has no imperative verb start
      const step = makeStep('This is a non-imperative description for the step.')
      const tasks = suggestTasks(step)
      expect(tasks.length).toBe(2)
    })

    test('fallback split produces 2 non-empty task descriptions', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('The system handles incoming data and processes it for output.')
      const tasks = suggestTasks(step)
      expect(tasks.length).toBe(2)
      expect(tasks[0].description.length).toBeGreaterThan(0)
      expect(tasks[1].description.length).toBeGreaterThan(0)
    })

    // ── Fallback: empty description ─────────────────────────────────────────

    test('empty description → returns exactly 2 generic placeholder tasks', () => {
      // Spec: V.EvoStep8.TaskSuggestions — empty description produces 2 generic placeholders
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('')
      const tasks = suggestTasks(step)
      expect(tasks.length).toBe(2)
    })

    test('whitespace-only description → returns exactly 2 generic placeholder tasks', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('   ')
      const tasks = suggestTasks(step)
      expect(tasks.length).toBe(2)
    })

    test('placeholder task descriptions are non-empty strings', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('')
      const tasks = suggestTasks(step)
      for (const task of tasks) {
        expect(typeof task.description).toBe('string')
        expect(task.description.trim().length).toBeGreaterThan(0)
      }
    })

    // ── TaskSuggestion shape ────────────────────────────────────────────────

    test('all returned tasks have the correct TaskSuggestion shape', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('Implement the service. Add error handling.')
      const tasks = suggestTasks(step)
      for (const task of tasks) {
        expect(typeof task.id).toBe('string')
        expect(task.id.length).toBeGreaterThan(0)
        expect(typeof task.description).toBe('string')
        expect(task.effortHours).toBeNull()
        expect(task.assignee).toBeNull()
        expect(task.completed).toBe(false)
      }
    })

    test('task IDs are unique within a single step', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('Implement A. Create B. Add C.')
      const tasks = suggestTasks(step)
      const ids = tasks.map((t) => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    test('task IDs reflect the step name slug', () => {
      const { suggestTasks } = useTaskSuggestions()
      const step = makeStep('Implement A. Create B.', 'S.Evo8.MyStep')
      const tasks = suggestTasks(step)
      expect(tasks[0].id).toContain('s-evo8-mystep')
    })

    // ── Minimum 2 tasks always guaranteed ──────────────────────────────────

    test('always returns ≥2 tasks regardless of description content', () => {
      // Spec: V.EvoStep8.TaskSuggestions — ≥2 tasks pre-suggested for every step
      const { suggestTasks } = useTaskSuggestions()
      const cases = [
        '',
        '   ',
        'Short.',
        'No verbs here at all.',
        'Implement one thing.',
        'Implement first. Create second.',
        'Implement A. Build B. Add C. Configure D. Test E.',
      ]
      for (const desc of cases) {
        const tasks = suggestTasks(makeStep(desc))
        expect(tasks.length).toBeGreaterThanOrEqual(2)
      }
    })

    // ── 5 distinct Evo steps exit gate (V.EvoStep8.TaskSuggestions) ────────
    // Exit gate: "App pre-suggests ≥2 tasks for each of 5 test Evo steps"
    // This test directly verifies the structural gate using 5 representative steps.

    test('V.EvoStep8.TaskSuggestions — 5 distinct Evo steps each yield ≥2 task suggestions', () => {
      // Spec: V.EvoStep8.TaskSuggestions — structural PASS via unit tests
      const { suggestTasks } = useTaskSuggestions()

      const fiveTestSteps: EvoStep[] = [
        makeStep(
          'Implement the server-side API handler. Create the database schema for task storage.',
          'S.Evo8.StepOne',
        ),
        makeStep(
          'Build the Vue 3 composable for task management. Add reactive state and action functions.',
          'S.Evo8.StepTwo',
        ),
        makeStep(
          'Configure the Tailwind mobile-first layout. Verify all touch targets meet 44px requirement.',
          'S.Evo8.StepThree',
        ),
        makeStep(
          // Short description with no imperative verbs → triggers fallback (still ≥2)
          'The task list renders in a collapsible section for each Evo step in the plan.',
          'S.Evo8.StepFour',
        ),
        makeStep(
          'Write unit tests for all edge cases. Deploy the updated component to staging.',
          'S.Evo8.StepFive',
        ),
      ]

      for (const step of fiveTestSteps) {
        const tasks = suggestTasks(step)
        expect(tasks.length).toBeGreaterThanOrEqual(2)
        // Each returned task must have the required shape
        for (const task of tasks) {
          expect(typeof task.id).toBe('string')
          expect(task.id.length).toBeGreaterThan(0)
          expect(typeof task.description).toBe('string')
          expect(task.description.trim().length).toBeGreaterThan(0)
          expect(task.completed).toBe(false)
          expect(task.effortHours).toBeNull()
          expect(task.assignee).toBeNull()
        }
      }
    })
  })
})
