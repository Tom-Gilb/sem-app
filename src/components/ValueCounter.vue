<script setup lang="ts">
// ValueCounter.vue — animated value-delivered percentage strip
// Spec: F.ValueAccumulationCounter (#15)

import { computed, ref, watch } from 'vue'
import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  confirmedSteps: EvoStep[]
  currentStage: number
  prioritisedExported?: boolean
}>()

/** Target percentage based on current stage and export state */
const targetPercent = computed<number>(() => {
  if (props.prioritisedExported) return 100
  const clamped = Math.max(1, Math.min(5, props.currentStage))
  return Math.min(100, (clamped - 1) * 20)
})

/** Whether to render the counter at all */
const shouldShow = computed<boolean>(
  () => props.currentStage >= 2 && props.confirmedSteps.length > 0,
)

// Animated display value (counts up via requestAnimationFrame)
const displayPercent = ref(targetPercent.value)

let _rafId: number | null = null

watch(
  targetPercent,
  (to, from) => {
    const start = from ?? 0
    const end = to
    const duration = 300
    const startTime = performance.now()

    if (_rafId !== null) cancelAnimationFrame(_rafId)

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      displayPercent.value = Math.round(start + (end - start) * progress)
      if (progress < 1) {
        _rafId = requestAnimationFrame(step)
      } else {
        _rafId = null
      }
    }

    _rafId = requestAnimationFrame(step)
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="shouldShow"
    class="w-full max-w-2xl mx-auto px-4 mb-3"
    role="status"
    aria-live="polite"
    :aria-label="`Value delivered: ${displayPercent}%`"
  >
    <p class="text-xs text-gray-500 font-medium mb-1">
      Value delivered: {{ displayPercent }}%
    </p>
    <div class="h-1.5 rounded-full bg-gray-200 overflow-hidden">
      <div
        class="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
        :style="{ width: `${targetPercent}%` }"
      />
    </div>
  </div>
</template>
