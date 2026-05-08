// UNIT_TYPE=Types
// TaskSuggestion type definition — Evo Step 8 (S.Evo8.TaskSuggestionHandler)
// Represents a single suggested task derived from an Evo step description.

/**
 * A single task suggestion derived from an EvoStep description.
 *
 * Spec: S.Evo8.TaskSuggestionHandler
 */
export interface TaskSuggestion {
  /** Unique identifier for this task within its parent step */
  id: string
  /** Plain-language description of the task */
  description: string
  /** Optional estimated effort in hours (null = not estimated) */
  effortHours: number | null
  /** Optional assignee name or email (null = unassigned) */
  assignee: string | null
  /** Whether the task has been completed */
  completed: boolean
}
