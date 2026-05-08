<!-- UNIT_TYPE=Widget -->
<!-- Feature #139 — Spec User Journey Mapper -->
<template>
  <div class="space-y-4">
    <!-- SVG Journey Map -->
    <div class="overflow-x-auto">
      <svg
        :viewBox="`0 0 620 ${svgHeight}`"
        :width="620"
        :height="svgHeight"
        aria-label="User journey map"
        role="img"
      >
        <!-- Arrow marker definition -->
        <defs>
          <marker
            id="journey-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#6b7280" />
          </marker>
          <marker
            id="journey-arrow-down"
            markerWidth="8"
            markerHeight="8"
            refX="3"
            refY="6"
            orient="auto"
          >
            <path d="M0,0 L6,0 L3,8 z" fill="#6b7280" />
          </marker>
        </defs>

        <!-- Steps -->
        <g v-for="(step, idx) in steps" :key="step.id">
          <!-- Step rect -->
          <rect
            :x="colX(idx) - 30"
            :y="rowY(idx) - 30"
            width="60"
            height="60"
            rx="8"
            :fill="step.linked ? '#10b981' : '#3b82f6'"
            :stroke="selectedId === step.id ? '#1e293b' : 'none'"
            stroke-width="2"
            class="cursor-pointer transition-opacity"
            :aria-label="`Journey step: ${step.trigger}`"
            @click="selectStep(step.id)"
          />
          <!-- Step label (8px, truncated to 10 chars) -->
          <text
            :x="colX(idx)"
            :y="rowY(idx) + 3"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="8"
            fill="white"
            class="pointer-events-none select-none"
          >{{ truncate10(step.id) }}</text>

          <!-- Horizontal arrow to next step in same row -->
          <line
            v-if="sameRowNext(idx)"
            :x1="colX(idx) + 30"
            :y1="rowY(idx)"
            :x2="colX(idx + 1) - 30"
            :y2="rowY(idx)"
            stroke="#6b7280"
            stroke-width="1.5"
            marker-end="url(#journey-arrow)"
          />

          <!-- Vertical connector from last step of row to first step of next row -->
          <line
            v-if="isRowEnd(idx) && idx + 1 < steps.length"
            :x1="colX(idx)"
            :y1="rowY(idx) + 30"
            :x2="colX(idx + 1)"
            :y2="rowY(idx + 1) - 30"
            stroke="#6b7280"
            stroke-width="1.5"
            stroke-dasharray="4 2"
            marker-end="url(#journey-arrow-down)"
          />
        </g>
      </svg>
    </div>

    <!-- Selected step detail panel -->
    <div
      v-if="selectedId && selectedStep"
      class="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2"
      aria-label="Selected step details"
    >
      <p class="text-xs font-semibold text-slate-700">{{ selectedStep.id }}</p>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <p class="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Trigger</p>
          <p class="text-xs text-slate-700">{{ selectedStep.trigger }}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Action</p>
          <p class="text-xs text-slate-700">{{ selectedStep.action }}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Outcome</p>
          <p class="text-xs text-slate-700">{{ selectedStep.outcome }}</p>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 text-xs text-slate-600">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded bg-blue-500" aria-hidden="true" />
        Function step
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded bg-emerald-500" aria-hidden="true" />
        Linked to V. goal
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'
import { useUserJourney } from '../composables/useUserJourney'

const props = defineProps<{
  blocks: SpecBlock[]
}>()

const { steps, selectedId, selectStep } = useUserJourney(props.blocks)

const STEPS_PER_ROW = 8
const COL_WIDTH = 70
const ROW_HEIGHT = 90
const OFFSET_X = 40
const OFFSET_Y = 40

function colIndex(idx: number): number {
  return idx % STEPS_PER_ROW
}

function rowIndex(idx: number): number {
  return Math.floor(idx / STEPS_PER_ROW)
}

function colX(idx: number): number {
  return colIndex(idx) * COL_WIDTH + OFFSET_X
}

function rowY(idx: number): number {
  return rowIndex(idx) * ROW_HEIGHT + OFFSET_Y
}

function sameRowNext(idx: number): boolean {
  if (idx + 1 >= steps.value.length) return false
  return rowIndex(idx) === rowIndex(idx + 1)
}

function isRowEnd(idx: number): boolean {
  return (idx + 1) % STEPS_PER_ROW === 0
}

function truncate10(text: string): string {
  return text.length > 10 ? text.slice(0, 10) : text
}

const rowCount = computed(() => {
  const n = steps.value.length
  if (n === 0) return 1
  return Math.ceil(n / STEPS_PER_ROW)
})

const svgHeight = computed(() => rowCount.value * ROW_HEIGHT + OFFSET_Y)

const selectedStep = computed(() =>
  steps.value.find(s => s.id === selectedId.value) ?? null
)
</script>
