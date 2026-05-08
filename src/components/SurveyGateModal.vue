<script setup lang="ts">
// SurveyGateModal.vue — post-generation and post-planning confidence survey overlay
// Spec: 2S.V.PlannerConfidence / 2S.V.PlannerPlanningTrust / 3P.V.PrioritisationAccuracy
// Appears as a slide-up card anchored to the bottom-right corner.
// Responds to 1–5 ratings; each click calls emit('rate', n) and closes itself.

defineProps<{
  visible: boolean
  question: string
}>()

const emit = defineEmits<{
  rate: [rating: 1 | 2 | 3 | 4 | 5]
  dismiss: []
}>()

const RATINGS = [1, 2, 3, 4, 5] as const
</script>

<template>
  <Transition name="survey-slide">
    <div
      v-if="visible"
      class="fixed bottom-4 right-4 z-[300] w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Quick feedback — rate 1 to 5"
    >
      <!-- Question + close button -->
      <div class="mb-3 flex items-start gap-2">
        <p class="flex-1 text-sm font-medium leading-snug text-gray-800">{{ question }}</p>
        <button
          type="button"
          class="flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded
                 text-gray-400 hover:text-gray-600
                 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Dismiss survey"
          @click="emit('dismiss')"
        >
          ×
        </button>
      </div>

      <!-- 1–5 rating buttons -->
      <div
        class="flex items-center gap-1"
        role="group"
        aria-label="Rating: 1 = not at all, 5 = absolutely"
      >
        <button
          v-for="n in RATINGS"
          :key="n"
          type="button"
          class="min-h-[44px] flex-1 rounded-lg border border-gray-200 bg-gray-50
                 text-sm font-semibold text-gray-700 transition-colors duration-150
                 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700
                 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          :aria-label="`Rate ${n} out of 5`"
          @click="emit('rate', n)"
        >
          {{ n }}
        </button>
      </div>

      <!-- Scale labels -->
      <p class="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>Not at all</span>
        <span>Absolutely</span>
      </p>
    </div>
  </Transition>
</template>

<style scoped>
.survey-slide-enter-active,
.survey-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.survey-slide-enter-from,
.survey-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
