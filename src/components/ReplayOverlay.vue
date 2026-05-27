<script setup lang="ts">
// ReplayOverlay.vue — full-screen overlay for animated value delivery replay
// Spec: Feature #40 — Animated Value Delivery Replay

import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  steps: EvoStep[]
  replayStep: number
  replayValue: number
  isReplaying: boolean
}>()

const emit = defineEmits<{
  (e: 'stop'): void
}>()

function stopReplay(): void {
  emit('stop')
}
</script>

<template>
  <div
    v-if="isReplaying"
    class="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center pointer-events-none"
    role="dialog"
    aria-modal="true"
    aria-label="Evo Step Sequence Animation"
  >
    <!-- Centre card -->
    <div class="pointer-events-auto bg-white rounded-2xl shadow-2xl p-8 w-[480px] max-w-[90vw]">
      <!-- Title -->
      <h2 class="text-lg font-bold text-gray-900 mb-4">Evo Step Sequence Animation</h2>

      <!-- Value counter -->
      <p class="text-5xl font-bold text-emerald-600 mb-3 tabular-nums">
        {{ replayValue.toFixed(0) }}% value delivered
      </p>

      <!-- Progress bar -->
      <div class="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-6">
        <div
          class="h-full bg-emerald-500 rounded-full transition-all duration-300"
          :style="{ width: `${replayValue}%` }"
        />
      </div>

      <!-- Step list -->
      <ul class="space-y-1 mb-6">
        <li
          v-for="(step, index) in steps"
          :key="step.name"
          :class="[
            'flex items-center gap-3 px-3 py-2 rounded-lg',
            index === replayStep ? 'bg-emerald-50' : ''
          ]"
        >
          <!-- Status icon -->
          <span class="shrink-0 w-5 text-center">
            <span v-if="index < replayStep">✅</span>
            <span
              v-else-if="index === replayStep"
              class="inline-block animate-spin"
              aria-label="In progress"
            >▶</span>
            <span v-else>⏳</span>
          </span>
          <!-- Step name -->
          <span class="text-sm text-gray-800 truncate">{{ step.name }}</span>
        </li>
      </ul>

      <!-- Completion banner -->
      <div
        v-if="replayStep === steps.length"
        class="mb-4 rounded-lg bg-emerald-100 px-4 py-3 text-center text-sm font-medium text-emerald-700"
        role="status"
        aria-live="polite"
      >
        🎉 All value delivered!
      </div>

      <!-- Stop button -->
      <button
        type="button"
        class="min-h-[44px] px-6 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300
               focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors duration-150"
        @click="stopReplay"
      >
        ■ Stop
      </button>
    </div>
  </div>
</template>
