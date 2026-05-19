<script setup lang="ts">
// ValueCounter.vue — Workflow progress indicator
// Shows the 5 planning stages as a step trail so users always know where they are.
// Replaces the abstract "Value delivered: X%" bar with named, labelled steps.
// Spec: F.ValueAccumulationCounter (#15)

import { computed } from 'vue'
import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  confirmedSteps: EvoStep[]
  currentStage: number
  prioritisedExported?: boolean
  /** True once a spec has been generated — used to show the bar at stage 1 so
   *  the user can see the full workflow before they've confirmed any evo steps. */
  hasSpec?: boolean
}>()

const STAGES = [
  { label: 'Spec',   stage: 1 },
  { label: 'Plan',   stage: 2 },
  { label: 'Impact', stage: 3 },  // Stage 3 = Impact Estimation (estimate first, then plan tasks)
  { label: 'Tasks',  stage: 4 },  // Stage 4 = Task Decomposition (decompose prioritised steps)
  { label: 'Export', stage: 5 },
] as const

/** Show as soon as a spec exists (stage 1+) or when planning has progressed to stage 2+.
 *  This keeps the progress trail visible even after a session key bump drops the user
 *  back to stage 1 — they can still see where they are and what comes next. */
const shouldShow = computed(
  () => props.currentStage >= 2 || (props.hasSpec ?? false),
)

function status(stepStage: number): 'done' | 'current' | 'future' {
  if (props.prioritisedExported) return 'done'
  if (props.currentStage > stepStage) return 'done'
  if (props.currentStage === stepStage) return 'current'
  return 'future'
}

function connectorDone(stepIndex: number): boolean {
  // Connector between steps is green when the step to its RIGHT is done or current
  return status(STAGES[stepIndex].stage) !== 'future'
}
</script>

<template>
  <div
    v-if="shouldShow"
    class="w-full max-w-2xl mx-auto px-4 mb-3"
    role="status"
    aria-label="Planning progress"
  >
    <div class="flex items-center">
      <template v-for="(step, idx) in STAGES" :key="step.stage">

        <!-- Connector line (all except first) -->
        <div
          v-if="idx > 0"
          class="flex-1 h-px mx-1.5 transition-colors duration-500"
          :class="connectorDone(idx) ? 'bg-emerald-400' : 'bg-gray-200'"
          aria-hidden="true"
        />

        <!-- Step: dot + label -->
        <div class="flex flex-col items-center gap-1 flex-shrink-0">
          <!-- Dot -->
          <div
            class="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300"
            :class="{
              'bg-emerald-500':                         status(step.stage) === 'done',
              'bg-indigo-500 ring-2 ring-indigo-200':   status(step.stage) === 'current',
              'bg-gray-200':                            status(step.stage) === 'future',
            }"
            :aria-label="`${step.label}: ${status(step.stage)}`"
          >
            <!-- Checkmark for done -->
            <svg
              v-if="status(step.stage) === 'done'"
              class="w-2.5 h-2.5 text-white"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Pulse dot for current -->
            <div
              v-else-if="status(step.stage) === 'current'"
              class="w-1.5 h-1.5 rounded-full bg-white"
              aria-hidden="true"
            />
          </div>
          <!-- Label -->
          <span
            class="text-[9px] font-semibold leading-none tracking-wide"
            :class="{
              'text-emerald-600': status(step.stage) === 'done',
              'text-indigo-600':  status(step.stage) === 'current',
              'text-gray-400':    status(step.stage) === 'future',
            }"
          >{{ step.label }}</span>
        </div>

      </template>
    </div>
  </div>
</template>
