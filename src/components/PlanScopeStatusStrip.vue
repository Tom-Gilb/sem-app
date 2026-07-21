<!--
  PlanScopeStatusStrip.vue — compact cross-stage overview of the Plan Scope
  Framework (deadline + project start events + budget).

  v503 (2026-07-21) — Tom Gilb 2026-07-21 verbatim: "Their needs to be
  opportunity to capture these project resources idea at the beginning of the
  project, and to see their status at any overview of the project, and to see
  they are not determined yet, and to change them any time".

  Mounts anywhere that needs to show the framework state at-a-glance:
    - Stage 1 (Stakes) area — planner sees + captures at project start
    - Plan Crest / Spec Identity band — visible on every stage
    - Overview dashboards / SpecOutput header

  Design:
    Three colour-coded pill rows, one per section:
      Deadline      — indigo   (or amber "not yet determined")
      Project Start — indigo   (or amber "not yet determined")
      Budget        — indigo   (or amber "not yet determined")
    Each pill shows the current human-readable value + a small "Edit" button
    that emits `open-editor` (parent decides how to open the full editor —
    jump to Stage 10 Resources Sharpening, or open an inline modal).

    v511b (2026-07-21) — pencil emoji ✎ removed per DD-011/DD-012 SUPREME
    (banned office-artefact glyph); replaced with plain "Edit" text label.
    Also v511b: emit is now wired end-to-end (was previously a console.info stub).

  UI rules satisfied:
    Spell-out-Type-Names SUPREME — all labels + type names spelled out.
    Icon-Plus-Text SUPREME — every affordance has glyph + text.
    DD-009 Zero-Training UI — HoverHints on every field.
    DD-017 Colour-on-Background — indigo/amber on white, R-G colorblind safe.
    Twin portability — pure Vue + Tailwind; consumes shared composable.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { usePlanScopeFramework } from '../composables/usePlanScopeFramework'
import type { Ref, ComputedRef } from 'vue'

const props = defineProps<{
  planIdRef: Ref<string> | ComputedRef<string>
  /** Compact mode = single row of pills; full = multi-row card with labels. */
  compact?: boolean
}>()

const emit = defineEmits<{
  /** Fired when the user clicks any Edit affordance.  Parent opens the full editor. */
  'open-editor': [section: 'deadline' | 'startEvents' | 'budget']
}>()

const {
  state,
  isDeadlineDetermined,
  isStartEventsDetermined,
  isBudgetDetermined,
  isFullyDetermined,
  projectStartEventCount,
  deadlineHumanReadable,
  budgetHumanReadable,
} = usePlanScopeFramework(props.planIdRef)

const startEventsSummary = computed<string>(() => {
  if (state.value.deadlineMode !== 'from-start') return 'n/a (specific date)'
  const n = projectStartEventCount.value
  if (n === 0) return 'not yet determined'
  return `${n} event${n === 1 ? '' : 's'} — project starts when ALL fire`
})

const sourceLabel = (kind: string): string => {
  switch (kind) {
    case 'planner':      return '👤 Planner'
    case 'ai':           return '🤖 AI'
    case 'contract':     return '📝 Contract'
    case 'imported':     return '📥 Imported'
    case 'external':     return '🌐 External'
    default:             return '❔ Undetermined'
  }
}
</script>

<template>
  <!-- Full card mode -->
  <div
    v-if="!compact"
    class="rounded-xl border-2 shadow-sm bg-white p-3 space-y-2"
    :class="isFullyDetermined ? 'border-indigo-300' : 'border-amber-300'"
    role="region"
    aria-label="Plan Scope Framework — top-level bounds for every Evo Step and Task"
  >
    <div class="flex items-center gap-2">
      <span class="text-base" aria-hidden="true">🎯</span>
      <span class="text-[11px] uppercase font-bold tracking-wider text-slate-800">Plan Scope Framework</span>
      <span
        v-if="!isFullyDetermined"
        class="ml-auto text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 rounded px-1.5 py-0.5"
        title="Some framework sections are not yet determined — edit any pill to fill in"
      >Partial</span>
      <span
        v-else
        class="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5"
        title="All framework sections have been answered (Yes / No / Undecided all count as answers)"
      >Complete</span>
    </div>
    <!-- Three pill rows -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
      <!-- Deadline -->
      <div
        class="rounded-lg border p-2"
        :class="isDeadlineDetermined ? 'border-indigo-200 bg-indigo-50/60' : 'border-amber-200 bg-amber-50/60'"
      >
        <div class="flex items-center gap-1.5">
          <span aria-hidden="true">🗓</span>
          <span class="font-bold text-slate-800">Deadline</span>
          <button
            type="button" class="ml-auto text-[10px] text-slate-500 hover:text-indigo-700"
            title="Open the full framework editor for the deadline section"
            @click="emit('open-editor', 'deadline')"
          >Edit</button>
        </div>
        <div
          class="mt-1 text-[11px] leading-snug"
          :class="isDeadlineDetermined ? 'text-slate-800' : 'italic text-amber-800'"
        >{{ deadlineHumanReadable }}</div>
        <div class="mt-1 text-[9px] uppercase tracking-wider text-slate-500">Source: {{ sourceLabel(state.sourceDeadline.kind) }}</div>
      </div>
      <!-- Project Start Events -->
      <div
        class="rounded-lg border p-2"
        :class="isStartEventsDetermined ? 'border-indigo-200 bg-indigo-50/60' : 'border-amber-200 bg-amber-50/60'"
      >
        <div class="flex items-center gap-1.5">
          <span aria-hidden="true">🚦</span>
          <span class="font-bold text-slate-800">Project Start</span>
          <button
            type="button" class="ml-auto text-[10px] text-slate-500 hover:text-indigo-700"
            title="Open the full framework editor for the project-start events section"
            @click="emit('open-editor', 'startEvents')"
          >Edit</button>
        </div>
        <div
          class="mt-1 text-[11px] leading-snug"
          :class="isStartEventsDetermined ? 'text-slate-800' : 'italic text-amber-800'"
        >{{ startEventsSummary }}</div>
        <div class="mt-1 text-[9px] uppercase tracking-wider text-slate-500">Source: {{ sourceLabel(state.sourceStartEvents.kind) }}</div>
      </div>
      <!-- Budget -->
      <div
        class="rounded-lg border p-2"
        :class="isBudgetDetermined ? 'border-indigo-200 bg-indigo-50/60' : 'border-amber-200 bg-amber-50/60'"
      >
        <div class="flex items-center gap-1.5">
          <span aria-hidden="true">💰</span>
          <span class="font-bold text-slate-800">Budget</span>
          <button
            type="button" class="ml-auto text-[10px] text-slate-500 hover:text-indigo-700"
            title="Open the full framework editor for the budget section"
            @click="emit('open-editor', 'budget')"
          >Edit</button>
        </div>
        <div
          class="mt-1 text-[11px] leading-snug"
          :class="isBudgetDetermined ? 'text-slate-800' : 'italic text-amber-800'"
        >{{ budgetHumanReadable }}</div>
        <div class="mt-1 text-[9px] uppercase tracking-wider text-slate-500">Source: {{ sourceLabel(state.sourceBudget.kind) }}</div>
      </div>
    </div>
  </div>

  <!-- Compact mode — single row of small pills, one line -->
  <div
    v-else
    class="flex flex-wrap items-center gap-2 text-[11px]"
    role="region"
    aria-label="Plan Scope Framework — compact overview"
  >
    <span class="text-[10px] uppercase font-bold tracking-wider text-slate-600">🎯 Scope</span>
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold border transition-colors"
      :class="isDeadlineDetermined ? 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'"
      :title="`Deadline: ${deadlineHumanReadable} — click to edit`"
      @click="emit('open-editor', 'deadline')"
    >🗓 {{ deadlineHumanReadable }}</button>
    <button
      v-if="state.deadlineMode === 'from-start'"
      type="button"
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold border transition-colors"
      :class="isStartEventsDetermined ? 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'"
      :title="`Project start: ${startEventsSummary} — click to edit`"
      @click="emit('open-editor', 'startEvents')"
    >🚦 {{ startEventsSummary }}</button>
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold border transition-colors"
      :class="isBudgetDetermined ? 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'"
      :title="`Budget: ${budgetHumanReadable} — click to edit`"
      @click="emit('open-editor', 'budget')"
    >💰 {{ budgetHumanReadable }}</button>
  </div>
</template>
