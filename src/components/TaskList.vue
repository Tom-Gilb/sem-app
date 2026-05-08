<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders a collapsible task checklist for each Evo step in the confirmed plan.
 *
 * Features:
 *  - One collapsible section per Evo step using <details>/<summary> for accessibility
 *  - Tasks pre-populated from useTaskSuggestions when a section is first expanded
 *  - Task row: checkbox (completed toggle), inline editable description, effort hours
 *    input (optional number), assignee input (optional text)
 *  - Add Task button per section; Remove Task button per row (44×44px)
 *  - Mobile-first Tailwind layout: full-width at 375px base; all interactive elements ≥44×44px
 *  - ARIA: aria-label on all icon buttons; section collapse/expand uses native details/summary
 *
 * Spec: S.Evo8.TaskDecompositionComponent
 * @see /Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/01Planning/02Plan-SEMApp.md
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { reactive, nextTick } from 'vue'
import { useTaskSuggestions } from '../composables/useTaskSuggestions'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'

// ── Props ─────────────────────────────────────────────────────────────────────

/** Array of Evo steps to render task sections for */
const props = defineProps<{
  /** The Evo steps to decompose into tasks */
  steps: EvoStep[]
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const { suggestTasks } = useTaskSuggestions()

// ── State ─────────────────────────────────────────────────────────────────────

// Map from step name → TaskSuggestion[].
// Populated lazily when a section is first expanded.
const tasksByStep = reactive<Record<string, TaskSuggestion[]>>({})

// Track which sections have been initialised (suggestions loaded) to avoid
// re-running suggestion logic on every toggle.
const initialised = reactive<Record<string, boolean>>({})

// Track which description cells are currently being edited (by task id).
const editingDescriptions = reactive<Record<string, boolean>>({})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a unique task id for a new blank task added by the user.
 * Uses a timestamp + random suffix to avoid collisions.
 */
function newTaskId(stepName: string): string {
  const slug = stepName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `task-${slug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

// ── Section expand / collapse ─────────────────────────────────────────────────

/**
 * Called by the native toggle event on a <details> element.
 * When a section is first opened, pre-populates tasks from useTaskSuggestions.
 */
function onToggle(event: Event, step: EvoStep): void {
  const details = event.target as HTMLDetailsElement
  if (!details.open) return

  // Only run suggestion logic once per step
  if (initialised[step.name]) return
  initialised[step.name] = true
  tasksByStep[step.name] = suggestTasks(step)
}

// ── Task mutation ─────────────────────────────────────────────────────────────

/** Adds a blank task row and immediately opens + focuses its description field. */
function addTask(stepName: string): void {
  if (!tasksByStep[stepName]) {
    tasksByStep[stepName] = []
  }
  const id = newTaskId(stepName)
  tasksByStep[stepName].push({
    id,
    description: '',
    effortHours: null,
    assignee: null,
    completed: false,
  })
  // Open edit mode immediately so the field renders, then focus it.
  // The global useDictation focusin listener will detect the focus and
  // activate voice text mode automatically if command mode is on.
  editingDescriptions[id] = true
  nextTick(() => {
    const el = document.getElementById(`desc-${id}`) as HTMLInputElement | null
    el?.focus()
  })
}

/** Removes the task at the given index from the step's list */
function removeTask(stepName: string, index: number): void {
  tasksByStep[stepName]?.splice(index, 1)
}

/** Toggles the completed state for a task */
function toggleCompleted(task: TaskSuggestion): void {
  task.completed = !task.completed
}

/** Begins inline editing of a task description */
function startEditDescription(taskId: string): void {
  editingDescriptions[taskId] = true
}

/** Commits the edited description (ends edit mode on blur or Enter) */
function commitDescription(taskId: string): void {
  editingDescriptions[taskId] = false
}

/** Updates the effort hours value on a task (converts string input to number | null) */
function setEffortHours(task: TaskSuggestion, value: string): void {
  const parsed = parseFloat(value)
  // Only store finite positive values; treat empty string or NaN as null
  task.effortHours = value.trim() === '' || isNaN(parsed) ? null : Math.max(0, parsed)
}
</script>

<template>
  <section class="w-full max-w-2xl mx-auto px-4 py-6" aria-label="Task decomposition">
    <div v-if="!steps || steps.length === 0" class="py-8 text-center text-gray-400 text-sm">
      No Evo steps available. Confirm a plan first.
    </div>

    <!-- One collapsible section per step -->
    <details
      v-for="step in steps"
      :key="step.name"
      class="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm"
      @toggle="onToggle($event, step)"
    >
      <!-- Section heading — summary acts as the toggle trigger -->
      <summary
        class="flex items-center justify-between cursor-pointer px-4 py-3 min-h-[44px] rounded-lg select-none list-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        :aria-label="`Toggle tasks for step: ${step.name}`"
      >
        <h3 class="text-sm font-semibold text-gray-900 flex-1 mr-2">{{ step.name }}</h3>
        <span class="text-gray-400 text-xs shrink-0" aria-hidden="true">▾</span>
      </summary>

      <!-- Task list body (only rendered when section is open) -->
      <div class="px-4 pb-4">
        <!-- Task rows -->
        <ul
          v-if="tasksByStep[step.name] && tasksByStep[step.name].length > 0"
          class="space-y-2 mt-3"
          aria-label="`Tasks for ${step.name}`"
        >
          <li
            v-for="(task, index) in tasksByStep[step.name]"
            :key="task.id"
            class="flex items-start gap-2"
          >
            <!-- Completed checkbox — 44×44px touch target via padding -->
            <label
              class="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer shrink-0"
              :aria-label="`Mark task as ${task.completed ? 'incomplete' : 'complete'}: ${task.description || 'untitled task'}`"
            >
              <input
                type="checkbox"
                class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                :checked="task.completed"
                @change="toggleCompleted(task)"
              />
            </label>

            <!-- Task content -->
            <div class="flex-1 min-w-0 py-2">
              <!-- Description — click to edit inline -->
              <div v-if="editingDescriptions[task.id]">
                <label :for="`desc-${task.id}`" class="sr-only">Task description</label>
                <input
                  :id="`desc-${task.id}`"
                  v-model="task.description"
                  type="text"
                  class="w-full rounded border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  :aria-label="`Edit description for task ${index + 1}`"
                  placeholder="Say it or type…"
                  @blur="commitDescription(task.id)"
                  @keydown.enter.prevent="commitDescription(task.id)"
                />
              </div>
              <button
                v-else
                type="button"
                class="w-full text-left text-sm text-gray-800 hover:text-blue-700 focus:outline-none focus:underline min-h-[24px] leading-relaxed"
                :class="{ 'line-through text-gray-400': task.completed }"
                :aria-label="`Edit description for task ${index + 1}: ${task.description || 'untitled task'}`"
                @click="startEditDescription(task.id)"
              >
                {{ task.description || 'Click to add description' }}
              </button>

              <!-- Effort hours + Assignee row -->
              <div class="flex flex-wrap gap-2 mt-1">
                <!-- Effort hours input -->
                <div class="flex items-center gap-1">
                  <label
                    :for="`effort-${task.id}`"
                    class="text-xs text-gray-500 shrink-0"
                  >Hours:</label>
                  <input
                    :id="`effort-${task.id}`"
                    type="number"
                    min="0"
                    step="0.5"
                    class="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :value="task.effortHours ?? ''"
                    :aria-label="`Effort hours for task ${index + 1}`"
                    placeholder="–"
                    @input="setEffortHours(task, ($event.target as HTMLInputElement).value)"
                  />
                </div>

                <!-- Assignee input -->
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <label
                    :for="`assignee-${task.id}`"
                    class="text-xs text-gray-500 shrink-0"
                  >Assignee:</label>
                  <input
                    :id="`assignee-${task.id}`"
                    v-model="task.assignee"
                    type="text"
                    class="flex-1 min-w-0 rounded border border-gray-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :aria-label="`Assignee for task ${index + 1}`"
                    placeholder="Unassigned"
                  />
                </div>
              </div>
            </div>

            <!-- Remove Task button — 44×44px -->
            <button
              type="button"
              class="flex items-center justify-center min-w-[44px] min-h-[44px] rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 shrink-0 self-start"
              :aria-label="`Remove task ${index + 1}: ${task.description || 'untitled task'}`"
              @click="removeTask(step.name, index)"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        </ul>

        <!-- Empty state when section has no tasks yet -->
        <p
          v-else-if="tasksByStep[step.name] && tasksByStep[step.name].length === 0"
          class="mt-3 text-sm text-gray-400"
        >
          No tasks. Add one below.
        </p>

        <!-- Add Task button -->
        <button
          type="button"
          class="mt-3 flex items-center justify-center min-h-[44px] w-full rounded-lg border border-dashed border-blue-300 text-blue-600 text-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Add Task"
          @click="addTask(step.name)"
        >
          <span aria-hidden="true">+</span> Add Task
        </button>
      </div>
    </details>
  </section>
</template>
