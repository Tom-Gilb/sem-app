<!-- EvoSimulatorView.vue — Animated Evo step delivery timeline with cumulative value chart.
     Spec: 4Sol.S.EvoSimulator / 3P.F.ProvideEvoVisualization
     Evo Step 11.

     Takes the confirmed evo step list and optional V/C ratios.
     Renders each step as a horizontal bar that fills left-to-right as the simulation plays.
     A cumulative value area chart animates below the timeline.

     Props:
       steps     — EvoStep[] — confirmed plan steps (empty → disabled state)
       vcRatios  — Record<string, number> — V/C ratios by linkedSolution (optional)

     Emits:
       close     — user closed the modal -->

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useEvoSimulation } from '../composables/useEvoSimulation'
import type { EvoStep } from '../types/evo-plan'

const props = withDefaults(defineProps<{
  steps:    EvoStep[]
  vcRatios: Record<string, number>
}>(), {
  vcRatios: () => ({}),
})

const emit = defineEmits<{ close: [] }>()

const {
  layouts,
  currentWeek,
  isPlaying,
  isComplete,
  speed,
  stepFill,
  cumulativeValuePath,
  play,
  pause,
  reset,
  dispose,
} = useEvoSimulation(props.steps, props.vcRatios)

// ── Tooltip ────────────────────────────────────────────────────────────────────

const hoveredIndex = ref<number | null>(null)

// ── Step-position colour graduation: red → amber → green ─────────────────────
// Step 0 = warm red; last step = bright green; middle = amber.
// Metaphor: "getting better all the time" — the plan improves as it progresses.

/**
 * Returns an rgb() colour string interpolated along red → amber → green
 * based on this step's position in the full sequence.
 * @param index   0-based step index
 * @param total   total number of steps
 */
function stepBarColor(index: number, total: number): string {
  if (total <= 1) return '#22c55e'
  const t = index / (total - 1)   // 0.0 (first) → 1.0 (last)
  // Palette: red #ef4444 → amber #f59e0b → green #22c55e
  if (t <= 0.5) {
    const n = t * 2
    const r = Math.round(239 + (245 - 239) * n)
    const g = Math.round(68  + (158 -  68) * n)
    const b = Math.round(68  + (11  -  68) * n)
    return `rgb(${r},${g},${b})`
  } else {
    const n = (t - 0.5) * 2
    const r = Math.round(245 + (34  - 245) * n)
    const g = Math.round(158 + (197 - 158) * n)
    const b = Math.round(11  + (94  -  11) * n)
    return `rgb(${r},${g},${b})`
  }
}

/** Badge bg/text tones matching each step's progression colour. */
function stepBadgeStyle(index: number, total: number): { background: string; color: string } {
  const t = total <= 1 ? 1 : index / (total - 1)
  if (t < 0.33)  return { background: '#fee2e2', color: '#b91c1c' }   // red tint
  if (t < 0.66)  return { background: '#fef3c7', color: '#92400e' }   // amber tint
  return             { background: '#dcfce7', color: '#15803d' }       // green tint
}

const CHART_FILL = '#7c3aed'   // violet-700 — SVG fill colour

// ── Mock mode: auto-play if steps are empty (no confirmed plan) ─────────────

const isMockMode  = import.meta.env.VITE_MOCK_MODE === 'true'
const hasSteps    = layouts.length > 0

// ── Keyboard: Escape closes ─────────────────────────────────────────────────

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', _onKey)
  // In mock mode with no real steps, auto-start so there's something to see
  if (isMockMode && !hasSteps) return
  // Otherwise let user press play
})

onUnmounted(() => {
  window.removeEventListener('keydown', _onKey)
  dispose()
})

// ── Helper: week → month label ──────────────────────────────────────────────
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function weekToMonth(week: number): string {
  const monthIdx = Math.floor(week / 4.333) % 12
  return MONTH_LABELS[monthIdx] ?? ''
}

// Axis ticks every 4 weeks (≈ monthly)
const axisTicks = [0, 4, 8, 13, 17, 22, 26]
</script>

<template>
  <!-- Backdrop + modal -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[450] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Evo Simulator — animated delivery timeline"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        @click="emit('close')"
      />

      <!-- Panel -->
      <div
        class="relative w-full sm:max-w-3xl max-h-[95dvh]
               bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl
               border border-violet-200 flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-700 to-indigo-600 flex-shrink-0 rounded-t-2xl sm:rounded-t-2xl">
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span aria-hidden="true">▶</span> Evo Simulator
            </h2>
            <p class="text-xs text-violet-200 mt-0.5">Watch how value accumulates across your delivery steps</p>
          </div>
          <CloseDot
        variant="on-dark"
        title="Close"
        aria-label="Close Evo Simulator"
        @click="emit('close')"
      />
        </div>

        <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">
        <!-- No plan state -->
        <div v-if="!hasSteps" class="px-5 py-12 flex flex-col items-center gap-3 text-center">
          <span class="text-4xl" aria-hidden="true">📋</span>
          <p class="text-sm font-semibold text-slate-700">No confirmed plan yet</p>
          <p class="text-xs text-slate-400">Complete Stage 2 (Confirm Plan) to generate a simulation.</p>
        </div>

        <template v-else>
          <!-- Timeline section -->
          <div class="px-5 pt-5 pb-3">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Delivery Timeline · 26 weeks</p>

            <!-- Step bars -->
            <div class="space-y-2" role="list" aria-label="Evo step delivery bars">
              <div
                v-for="(layout, i) in layouts"
                :key="layout.step.name"
                role="listitem"
                class="relative"
                @mouseenter="hoveredIndex = i"
                @mouseleave="hoveredIndex = null"
                @focusin="hoveredIndex = i"
                @focusout="hoveredIndex = null"
              >
                <!-- Step label row -->
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0"
                    :style="stepBadgeStyle(i, layouts.length)"
                  >{{ i + 1 }}</span>
                  <span class="text-[11px] font-medium text-slate-700 truncate">{{ layout.step.description }}</span>
                  <span class="text-[9px] text-slate-400 ml-auto flex-shrink-0">{{ layout.step.effortPercent }}%</span>
                </div>

                <!-- Bar track -->
                <div
                  class="h-5 rounded-full bg-slate-100 relative overflow-hidden"
                  :style="{
                    marginLeft: `${(layout.startWeek / 26) * 100}%`,
                    width: `${((layout.endWeek - layout.startWeek) / 26) * 100}%`,
                  }"
                  :aria-valuenow="Math.round(stepFill(i) * 100)"
                  role="progressbar"
                  :aria-label="`Step ${i + 1}: ${Math.round(stepFill(i) * 100)}% delivered`"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    class="absolute inset-y-0 left-0 rounded-full transition-none"
                    :style="{ width: `${stepFill(i) * 100}%`, backgroundColor: stepBarColor(i, layouts.length) }"
                  />
                  <!-- Delivery complete checkmark -->
                  <span
                    v-if="stepFill(i) >= 1"
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 text-white text-[10px] font-bold"
                    aria-hidden="true"
                  >✓</span>
                </div>

                <!-- Tooltip -->
                <Transition
                  enter-active-class="transition-all duration-150"
                  enter-from-class="opacity-0 translate-y-1"
                  enter-to-class="opacity-100 translate-y-0"
                  leave-active-class="transition-all duration-100"
                  leave-from-class="opacity-100 translate-y-0"
                  leave-to-class="opacity-0 translate-y-1"
                >
                  <div
                    v-if="hoveredIndex === i"
                    class="absolute left-0 top-full mt-1 z-10 bg-slate-800 text-white text-[10px] rounded-lg px-3 py-2 shadow-lg max-w-[280px]"
                    role="tooltip"
                  >
                    <p class="font-semibold">{{ layout.step.name }}</p>
                    <p class="text-slate-300 mt-0.5">Values: {{ layout.step.linkedValues.join(', ') || '—' }}</p>
                    <p class="text-slate-300">Effort: {{ layout.step.effortPercent }}%</p>
                    <p v-if="layout.step.linkedSolutions?.some(id => vcRatios[id])" class="text-violet-300">
                      V/C: {{ Math.max(...(layout.step.linkedSolutions ?? []).map(id => vcRatios[id] ?? 0)).toFixed(2) }}
                    </p>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Week axis -->
            <div class="relative mt-2 h-5">
              <div
                v-for="tick in axisTicks"
                :key="tick"
                class="absolute flex flex-col items-center"
                :style="{ left: `${(tick / 26) * 100}%`, transform: 'translateX(-50%)' }"
              >
                <div class="w-px h-1.5 bg-slate-300" />
                <span class="text-[9px] text-slate-400 mt-0.5">{{ weekToMonth(tick) }}</span>
              </div>
            </div>
          </div>

          <!-- Cumulative value chart -->
          <div class="px-5 pb-3">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cumulative Value Delivered</p>
            <svg
              class="w-full"
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              aria-label="Cumulative value area chart"
              role="img"
              style="height: 80px;"
            >
              <!-- Grid lines -->
              <line x1="0" y1="10" x2="100" y2="10" stroke="#e2e8f0" stroke-width="0.5" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#e2e8f0" stroke-width="0.5" />

              <!-- Area chart — viewBox y is 0(top)→40(bottom); value grows upward -->
              <!-- Scale internal y to 40-unit height: full = y=0, zero = y=40 -->
              <path
                v-if="cumulativeValuePath"
                :d="cumulativeValuePath.replace(/100\.0/g, '40').replace(/(\d+\.\d),(\d+\.\d)/g, (_, x, y) => `${x},${(parseFloat(y) * 40 / 100).toFixed(1)}`)"
                :fill="CHART_FILL"
                fill-opacity="0.15"
                stroke="#7c3aed"
                stroke-width="0.8"
                stroke-linejoin="round"
              />
            </svg>
          </div>

          <!-- Simulation complete overlay message -->
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
          >
            <div
              v-if="isComplete"
              class="mx-5 mb-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center justify-between"
              role="status"
              aria-live="polite"
            >
              <div>
                <p class="text-sm font-bold text-violet-800">🎉 Plan complete!</p>
                <p class="text-xs text-violet-600 mt-0.5">All {{ layouts.length }} steps delivered across 26 simulated weeks.</p>
              </div>
              <button
                type="button"
                class="ml-4 text-2xl focus:outline-none focus:ring-2 focus:ring-violet-400 rounded"
                aria-label="Wow — this is great!"
                title="Wow!"
                @click="() => { /* wow event placeholder — Supabase integration in next increment */ }"
              >👏</button>
            </div>
          </Transition>

          <!-- Controls -->
          <div class="px-5 pb-5 flex items-center gap-3 flex-wrap border-t border-slate-100 pt-3">
            <!-- Play / Pause -->
            <button
              v-if="!isPlaying"
              type="button"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold
                     hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
              :aria-label="isComplete ? 'Replay simulation' : 'Play simulation'"
              @click="play"
            >
              <span aria-hidden="true">{{ isComplete ? '↺' : '▶' }}</span>
              {{ isComplete ? 'Replay' : 'Play' }}
            </button>
            <button
              v-else
              type="button"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 text-white text-sm font-semibold
                     hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
              aria-label="Pause simulation"
              @click="pause"
            >
              <span aria-hidden="true">⏸</span> Pause
            </button>

            <!-- Reset -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm
                     hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
              aria-label="Reset simulation to beginning"
              @click="reset"
            >
              <span aria-hidden="true">↺</span> Reset
            </button>

            <!-- Speed selector -->
            <div class="ml-auto flex items-center gap-1" role="group" aria-label="Playback speed">
              <span class="text-[11px] text-slate-400 mr-1">Speed:</span>
              <button
                v-for="s in [1, 2, 4] as const"
                :key="s"
                type="button"
                :aria-pressed="speed === s"
                :aria-label="`${s}× speed`"
                class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400"
                :class="speed === s
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
                @click="speed = s"
              >{{ s }}×</button>
            </div>
          </div>

          <!-- Legend -->
          <div class="px-5 pb-4 flex items-center gap-4 flex-wrap">
            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Progress:</span>
            <span class="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span class="inline-block w-3 h-3 rounded-sm" style="background:#ef4444" aria-hidden="true" />Earlier steps
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span class="inline-block w-3 h-3 rounded-sm" style="background:#f59e0b" aria-hidden="true" />Mid-plan
            </span>
            <span class="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span class="inline-block w-3 h-3 rounded-sm" style="background:#22c55e" aria-hidden="true" />Later steps
            </span>
          </div>
        </template>
        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
