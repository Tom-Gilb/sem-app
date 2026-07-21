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
import { reactive, ref, nextTick, watch, onMounted } from 'vue'
import { useTaskSuggestions } from '../composables/useTaskSuggestions'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion, HoursEstimate } from '../types/task'
import type { AISource } from '../data/aiSource'
import { AI_SOURCE_META as _AI_SOURCE_META } from '../data/aiSource'
// Re-export marker to keep import linked for future per-field source-badge use.
void _AI_SOURCE_META
import type { SpecBlock } from '../types/spec'
import ConceptHint from './ConceptHint.vue'
import { CONCEPT_HINTS } from '../data/conceptHints'

// ── Props ─────────────────────────────────────────────────────────────────────

/** Array of Evo steps to render task sections for */
const props = defineProps<{
  /** The Evo steps to decompose into tasks */
  steps: EvoStep[]
  /** Optional spec context for the Define look-up button in the concept hint */
  spec?: SpecBlock | null
}>()

const emit = defineEmits<{
  /**
   * Fired whenever tasksByStep changes — App.vue listens and updates its own
   * tasksByStep ref so ValueFlowDiagram receives live task data.
   * Bug fix 2026-05-16: TaskList had no emits; App.vue's tasksByStep stayed {}.
   */
  'update:tasksByStep': [Record<string, TaskSuggestion[]>]
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const { suggestTasks } = useTaskSuggestions()

// ── State ─────────────────────────────────────────────────────────────────────

// Map from step name → TaskSuggestion[].
// Populated lazily when a section is first expanded.
const tasksByStep = reactive<Record<string, TaskSuggestion[]>>({})

// Propagate tasksByStep to App.vue whenever it changes so VFD receives live data.
watch(tasksByStep, (val) => emit('update:tasksByStep', { ...val }), { deep: true })

// Auto-suggest tasks for ALL steps on mount — no expand-to-load required.
// Tom 2026-05-17: "Tasks to show up, for the third time."
// Root cause: previously tasks were lazy (only loaded when a section was manually
// expanded). VFD showed "No tasks yet" until the user opened TaskList AND expanded
// each step. suggestTasks() is synchronous rule-based extraction — cheap, no LLM.
//
// v499 (2026-07-21) — Tom Gilb "in the tasks stage at least the tasks should all
// be open and visible".  Two-part fix: (a) each <details> renders with `open`
// attribute so the tasks show without user interaction; (b) openSteps[step.name]
// pre-set to true so the pill shows "close" not "tasks" — matching the actual
// expanded state.  Task suggestions were ALREADY pre-populated (v352 above);
// this ship completes the intent by also opening the disclosure widgets.
onMounted(() => {
  props.steps.forEach(step => {
    if (!initialised[step.name]) {
      initialised[step.name] = true
      tasksByStep[step.name] = suggestTasks(step)
    }
    openSteps[step.name] = true   // v499 — open every section by default
  })
})

// Track which sections have been initialised (suggestions loaded) to avoid
// re-running suggestion logic on every toggle.
const initialised = reactive<Record<string, boolean>>({})

// Track open/closed state per step — drives the dramatic expand button styling.
const openSteps = reactive<Record<string, boolean>>({})

// Track which description cells are currently being edited (by task id).
const editingDescriptions = reactive<Record<string, boolean>>({})

// Track which task's action menu is currently open (null = none).
// Tom 2026-05-15: "pressing it should not delete but lead to a menu for
// editing and possible delete."
const activeMenuTaskId = ref<string | null>(null)

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
  openSteps[step.name] = details.open

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
    hoursEstimate: { low: null, high: null, central: null, provenance: { source: 'template' } },
    specialistType: null,
    assignee: null,
    completed: false,
    // Enrichment fields left undefined — UI shows them only when user opens "✨ Enrich".
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

/** Begins inline editing of a task description. */
function startEditDescription(taskId: string): void {
  editingDescriptions[taskId] = true
}

/** Same as startEditDescription but guards against firing when the user just
 *  finished a text-drag selection (for the 📖 Define pill).
 *  Used on the inline task-text button; NOT on the explicit "Edit description"
 *  menu item (where the user's intent is unambiguously to edit).
 */
function startEditDescriptionFromClick(taskId: string): void {
  if (window.getSelection()?.toString().trim()) return
  editingDescriptions[taskId] = true
}

/** Commits the edited description (ends edit mode on blur or Enter) */
function commitDescription(taskId: string): void {
  editingDescriptions[taskId] = false
}

/** Toggles the action menu for a specific task. Only one menu open at a time. */
function toggleTaskMenu(taskId: string): void {
  activeMenuTaskId.value = activeMenuTaskId.value === taskId ? null : taskId
}

/** Closes any open task action menu. */
function closeTaskMenu(): void {
  activeMenuTaskId.value = null
}

/**
 * Capture-phase handler on the section root — closes the open task menu
 * when the user clicks anywhere that is not inside a [data-task-menu] element.
 */
function handleSectionClick(event: Event): void {
  if (!(event.target as Element).closest?.('[data-task-menu]')) {
    activeMenuTaskId.value = null
  }
}

/** Updates the effort hours value on a task (converts string input to number | null) */
function setEffortHours(task: TaskSuggestion, value: string): void {
  const parsed = parseFloat(value)
  // Only store finite positive values; treat empty string or NaN as null
  task.effortHours = value.trim() === '' || isNaN(parsed) ? null : Math.max(0, parsed)
  // Mirror into hoursEstimate.central so the range UI stays in sync.
  _ensureHoursEstimate(task)
  task.hoursEstimate!.central = task.effortHours
}

// ── Tom 2026-06-03 enrichment helpers ────────────────────────────────────────
// Hours range + provenance, specialist type, and the 7 "more interesting"
// enrichment fields (simplification, location, tools, legal, org, standards,
// problems-to-avoid).  All optional; row visually expands on click of the
// "✨ Enrich" pill so legacy tasks stay compact.

/**
 * Tracks which task rows have the enrichment-detail panel expanded.
 * Keyed by task.id.  Per-session, not persisted (mirrors editingDescriptions).
 */
const enrichingTasks = reactive<Record<string, boolean>>({})

/** Available source layers for the hours-estimate provenance dropdown. */
const HOURS_SOURCE_OPTIONS: readonly AISource[] = ['template', 'llm', 'plan', 'gilb', 'standards', 'internet'] as const
/** Display labels for the source dropdown — SWAG-honest. */
const HOURS_SOURCE_LABEL: Record<AISource, string> = {
  template: 'SWAG (best guess)',
  llm: 'AI suggestion',
  plan: 'Derived from plan',
  gilb: 'Cited from Gilb',
  standards: 'From 10.Standard/',
  internet: 'Internet benchmark',
}

function _ensureHoursEstimate(task: TaskSuggestion): void {
  if (!task.hoursEstimate) {
    task.hoursEstimate = {
      low: task.effortHours,
      high: task.effortHours,
      central: task.effortHours,
      provenance: { source: 'template' },
    }
  }
  if (!task.hoursEstimate.provenance) {
    task.hoursEstimate.provenance = { source: 'template' }
  }
}

/** Coerce a user-typed numeric string to a non-negative number or null. */
function _parseHours(value: string): number | null {
  const parsed = parseFloat(value)
  if (value.trim() === '' || isNaN(parsed)) return null
  return Math.max(0, parsed)
}

function setHoursLow(task: TaskSuggestion, value: string): void {
  _ensureHoursEstimate(task)
  task.hoursEstimate!.low = _parseHours(value)
  // Auto-update central as midpoint when both bounds are set.
  const lo = task.hoursEstimate!.low, hi = task.hoursEstimate!.high
  if (lo !== null && hi !== null) {
    task.hoursEstimate!.central = (lo + hi) / 2
    task.effortHours = task.hoursEstimate!.central
  }
}
function setHoursHigh(task: TaskSuggestion, value: string): void {
  _ensureHoursEstimate(task)
  task.hoursEstimate!.high = _parseHours(value)
  const lo = task.hoursEstimate!.low, hi = task.hoursEstimate!.high
  if (lo !== null && hi !== null) {
    task.hoursEstimate!.central = (lo + hi) / 2
    task.effortHours = task.hoursEstimate!.central
  }
}
function setHoursSource(task: TaskSuggestion, source: AISource): void {
  _ensureHoursEstimate(task)
  task.hoursEstimate!.provenance = { source }
}

/** Display string for the hours-estimate badge (e.g. "4–8 h", "6 h", "–"). */
function hoursDisplay(task: TaskSuggestion): string {
  const est = task.hoursEstimate
  if (est && est.low !== null && est.high !== null && est.low !== est.high) {
    return `${est.low}–${est.high} h`
  }
  if (est?.central !== null && est?.central !== undefined) return `${est.central} h`
  if (task.effortHours !== null) return `${task.effortHours} h`
  return '–'
}

function toggleEnrich(taskId: string): void {
  enrichingTasks[taskId] = !enrichingTasks[taskId]
}
</script>

<template>
  <section class="w-full max-w-2xl mx-auto px-4 py-6" aria-label="Task decomposition" @click.capture="handleSectionClick">
    <!-- Specialist-type suggestion list — shared by every task row's Type input.
         Tom 2026-06-03 explicit examples + common engineering roles. -->
    <datalist id="specialist-type-suggestions">
      <option value="Contract Specialist" />
      <option value="Systems Architect" />
      <option value="Software Engineer" />
      <option value="Naval Engineer" />
      <option value="Mechanical Engineer" />
      <option value="Test Engineer" />
      <option value="Project Manager" />
      <option value="UX Designer" />
      <option value="Data Analyst" />
      <option value="Security Specialist" />
      <option value="Compliance Officer" />
      <option value="Procurement" />
      <option value="Legal Counsel" />
    </datalist>
    <ConceptHint
      v-bind="CONCEPT_HINTS.task"
      :spec="props.spec ?? null"
      class="mb-5 rounded-lg"
    />
    <div v-if="!steps || steps.length === 0" class="py-8 text-center text-gray-400 text-sm">
      No Evo steps yet — generate an Evo Plan first.
    </div>

    <!-- One collapsible section per step —
         v499 (2026-07-21) — `open` attribute default per Tom Gilb "in the tasks
         stage at least the tasks should all be open and visible".  Users can
         still collapse individual sections by clicking the summary; the CLOSE
         pill toggles them back.  Suggestions are pre-populated on mount
         (v352), so open-by-default has zero extra cost. -->
    <details
      v-for="step in steps"
      :key="step.name"
      open
      class="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm"
      @toggle="onToggle($event, step)"
    >
      <!-- Section heading — summary acts as the toggle trigger -->
      <!-- select-none removed from summary (2026-05-17 Define-by-Selection fix) —
           step name text MUST be selectable for the 📖 Define pill.
           select-none moved to the icon-only toggle span below. -->
      <summary
        class="flex items-center justify-between cursor-pointer px-4 py-3 min-h-[44px] rounded-lg list-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        :aria-label="`Toggle tasks for step: ${step.name}`"
      >
        <h3 class="text-sm font-semibold text-gray-900 flex-1 mr-2">{{ step.name }}</h3>
        <!-- Dramatic expand pill — open = indigo filled, closed = slate outlined.
             select-none here only — prevents accidental text-select on the icon. -->
        <span
          aria-hidden="true"
          class="select-none flex flex-col items-center justify-center gap-0.5 shrink-0 rounded-xl
                 min-w-[52px] min-h-[52px] border-2 font-bold transition-all duration-150"
          :class="openSteps[step.name]
            ? 'scale-110 shadow-lg bg-indigo-600 border-indigo-500 text-white'
            : 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200 hover:border-slate-400'"
        >
          <span class="text-xl leading-none">{{ openSteps[step.name] ? '📌' : '📋' }}</span>
          <span class="text-[9px] uppercase tracking-wider leading-none">
            {{ openSteps[step.name] ? 'close' : 'tasks' }}
          </span>
        </span>
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
              <!-- select-text: overrides browser's default user-select:none on <button>
                   so task description text can be selected for the 📖 Define pill.
                   startEditDescription() guards against firing when text was selected. -->
              <button
                v-else
                type="button"
                class="w-full text-left text-sm text-gray-800 hover:text-blue-700 focus:outline-none focus:underline min-h-[24px] leading-relaxed select-text"
                :class="{ 'line-through text-gray-400': task.completed }"
                :aria-label="`Edit description for task ${index + 1}: ${task.description || 'untitled task'}`"
                @click="startEditDescriptionFromClick(task.id)"
              >
                {{ task.description || 'Click to add description' }}
              </button>

              <!-- Hours range + provenance + specialist + assignee row.
                   Tom 2026-06-03 *"make an hours estimate range or ±, add SWAG
                   or Based on (AI source)"* + *"add a type of specialist to
                   the task, separate field Assigned To: [name]"*. -->
              <div class="flex flex-wrap items-center gap-2 mt-1">
                <!-- Hours: low–high range -->
                <div class="flex items-center gap-1">
                  <label :for="`hlow-${task.id}`" class="text-xs text-gray-500 shrink-0">Hours:</label>
                  <input
                    :id="`hlow-${task.id}`"
                    type="number" min="0" step="0.5"
                    class="w-14 rounded border border-gray-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :value="task.hoursEstimate?.low ?? task.effortHours ?? ''"
                    :aria-label="`Hours low estimate for task ${index + 1}`"
                    placeholder="low"
                    title="Lower bound (hours)"
                    @input="setHoursLow(task, ($event.target as HTMLInputElement).value)"
                  />
                  <span class="text-xs text-gray-400">–</span>
                  <input
                    type="number" min="0" step="0.5"
                    class="w-14 rounded border border-gray-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :value="task.hoursEstimate?.high ?? task.effortHours ?? ''"
                    :aria-label="`Hours high estimate for task ${index + 1}`"
                    placeholder="high"
                    title="Upper bound (hours).  If equal to low, treated as a single-point estimate."
                    @input="setHoursHigh(task, ($event.target as HTMLInputElement).value)"
                  />
                </div>

                <!-- Hours-estimate source / provenance -->
                <div class="flex items-center gap-1">
                  <label :for="`hsrc-${task.id}`" class="sr-only">Hours estimate source</label>
                  <select
                    :id="`hsrc-${task.id}`"
                    class="rounded border border-gray-300 px-1 py-0.5 text-[11px] bg-amber-50 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    :value="task.hoursEstimate?.provenance?.source ?? 'template'"
                    :title="'Where this estimate came from — SWAG / AI / measured / cited.  Tom 2026-06-03 honesty rule.'"
                    @change="setHoursSource(task, ($event.target as HTMLSelectElement).value as AISource)"
                  >
                    <option v-for="src in HOURS_SOURCE_OPTIONS" :key="src" :value="src">
                      {{ HOURS_SOURCE_LABEL[src] }}
                    </option>
                  </select>
                </div>

                <!-- Specialist type — distinct from named assignee.
                     Tom 2026-06-03: "Ideally: Contract Specialist or Systems Architect" -->
                <div class="flex items-center gap-1 min-w-0">
                  <label :for="`spec-${task.id}`" class="text-xs text-gray-500 shrink-0">Type:</label>
                  <input
                    :id="`spec-${task.id}`"
                    v-model="task.specialistType"
                    type="text" list="specialist-type-suggestions"
                    class="w-32 rounded border border-indigo-200 bg-indigo-50/60 px-1 py-0.5 text-xs text-indigo-900 placeholder-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Contract Specialist"
                    :aria-label="`Specialist type for task ${index + 1}`"
                    title="Role / specialism needed for this task (Contract Specialist, Systems Architect, etc).  Distinct from the named Assignee."
                  />
                </div>

                <!-- Assignee — named person -->
                <div class="flex items-center gap-1 flex-1 min-w-0">
                  <label :for="`assignee-${task.id}`" class="text-xs text-gray-500 shrink-0">Assigned to:</label>
                  <input
                    :id="`assignee-${task.id}`"
                    v-model="task.assignee"
                    type="text"
                    class="flex-1 min-w-0 rounded border border-gray-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :aria-label="`Assignee name for task ${index + 1}`"
                    placeholder="Unassigned"
                  />
                </div>

                <!-- Enrich pill — opens the 7-field planning-context panel.
                     Tom 2026-06-03 *"what can we do to make task planning more
                     interesting and exciting"* — Simplification / Location /
                     Tools / Legal / Org Policy / Standards / Problems to Avoid. -->
                <button
                  type="button"
                  class="text-[11px] px-2 py-0.5 rounded-full border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  :aria-expanded="enrichingTasks[task.id] === true"
                  :title="enrichingTasks[task.id]
                    ? 'Close enrichment fields (Simplification / Location / Tools / Legal / Policy / Standards / Problems)'
                    : 'Add planning context: Simplification opportunities, Location, Suggested Tools, Legal Constraints, Org Policy, Applicable Standards, Problems to Avoid'"
                  @click="toggleEnrich(task.id)"
                >
                  {{ enrichingTasks[task.id] ? '▼ Close enrich' : '✨ Enrich' }}
                </button>
              </div>

              <!-- Enrichment panel — 7 optional fields, all free-text.
                   Tom 2026-06-03 — designed to make task planning richer than
                   just "checkbox + hours + assignee".  Each field has a clear
                   placeholder so the user (or future Claudian suggestion pass)
                   knows what to put there.  Conjunction-of-Technologies note:
                   v2 should add a "🪄 AI Suggest" pill per field that copies a
                   Claudian prompt with full plan + task context. -->
              <div
                v-if="enrichingTasks[task.id]"
                class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-purple-200 bg-purple-50/30 p-3"
              >
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-purple-800">💡 Simplification</span>
                  <input
                    v-model="task.simplification" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. reuse existing X, skip if Y is already done"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-purple-800">📍 Location</span>
                  <input
                    v-model="task.location" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="main office / subsidiary / Zoom / near users / not critical"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-purple-800">🛠 Suggested Tools</span>
                  <input
                    v-model="task.suggestedTools" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="AI suggestions, templates, old patterns, tools…"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-purple-800">⚖ Legal Constraints</span>
                  <input
                    v-model="task.legalConstraints" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="GDPR, contracts, regulations applicable here"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-purple-800">🏢 Org Policy</span>
                  <input
                    v-model="task.orgPolicy" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="company policy, procurement rules, approval chain"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-purple-800">📐 Applicable Standards</span>
                  <input
                    v-model="task.applicableStandards" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="ISO, IEEE, 10.Standard/Template_Write_*, company standards"
                  />
                </label>
                <label class="flex flex-col gap-0.5 sm:col-span-2">
                  <span class="text-[11px] font-semibold text-purple-800">🚧 Problems to Avoid</span>
                  <input
                    v-model="task.problemsToAvoid" type="text"
                    class="rounded border border-purple-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="historical pitfalls, lessons learned, things that went wrong last time"
                  />
                </label>
              </div>
            </div>

            <!-- Task action menu — replaces the former direct-delete ✕ button.
                 Tom 2026-05-15: "pressing it should not delete but lead to a
                 menu for editing and possible delete."
                 Tom 2026-05-15 (v2): "[*]->? — abbreviated '?'"
                 Tom 2026-05-15 (v3): "that thing circle in lower right of each
                 rectangle did not work — supposed to be a ?, maybe on a white
                 little rectangle background"
                 self-end → sits at the BOTTOM-RIGHT of the task row.
                 Touch target is 44×44; visual is a small white rectangle badge. -->
            <div class="relative shrink-0 self-end" data-task-menu>
              <!-- Transparent 44×44 touch target; small white rectangle badge inside -->
              <button
                type="button"
                class="flex items-center justify-center min-w-[44px] min-h-[44px]
                       bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400 rounded"
                :aria-label="`Actions for task ${index + 1}: ${task.description || 'untitled task'}`"
                :aria-expanded="activeMenuTaskId === task.id"
                aria-haspopup="menu"
                @click.stop="toggleTaskMenu(task.id)"
              >
                <!-- Small white rectangle — the visible [*]->? badge -->
                <span
                  aria-hidden="true"
                  class="flex items-center justify-center px-2.5 py-1 bg-white border border-gray-300
                         rounded text-sm font-bold text-gray-600 shadow-sm leading-none
                         hover:border-indigo-400 hover:text-indigo-700 transition-colors"
                >?</span>
              </button>

              <!-- Dropdown menu — appears below the trigger, aligned to the right -->
              <div
                v-if="activeMenuTaskId === task.id"
                role="menu"
                class="absolute right-0 top-full mt-1 z-10 min-w-[148px] rounded-xl border border-gray-200
                       bg-white shadow-lg overflow-hidden"
                data-task-menu
              >
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700
                         hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  @click.stop="closeTaskMenu(); startEditDescription(task.id)"
                >
                  <span aria-hidden="true">✎</span> Edit description
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-600
                         hover:bg-red-50 transition-colors border-t border-gray-100"
                  @click.stop="closeTaskMenu(); removeTask(step.name, index)"
                >
                  <span aria-hidden="true">🗑</span> Delete task
                </button>
              </div>
            </div>
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
