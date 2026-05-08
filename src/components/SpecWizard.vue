<!-- SpecWizard.vue — Feature #53: Progressive spec wizard
     A 4-step guided wizard: Stakes → Ends → Means → One-liner
     Spec: F.ProgressiveSpecWizard -->

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  onSubmit: (stakes: string, ends: string, means: string, oneLiner: string) => void
  onClose: () => void
}>()

// ── Step state ──────────────────────────────────────────────────────────────
const currentStep = ref(1)
const stakes = ref('')
const ends = ref('')
const means = ref('')
const oneLiner = ref('')

// Note: auto-focus via watch(currentStep) + nextTick was removed because
// <Transition mode="out-in"> means nextTick fires while the *leaving* step's
// DOM is still present — so querySelector finds the wrong (departing) textarea.
// On mobile it also opens the virtual keyboard and hides the footer buttons.
// The v-model + computed fix is sufficient; the user taps the textarea to type.

// ── Step configuration ──────────────────────────────────────────────────────
interface StepConfig {
  title: string
  hint: string
  example: string
}

const STEPS: StepConfig[] = [
  {
    title: "What's at stake?",
    hint: 'Describe who cares and why it matters — the people or business at risk.',
    example: "Customer churn is at 15%/month — the business cannot survive beyond 6 months at this rate.",
  },
  {
    title: 'What outcomes do you want?',
    hint: 'Describe the measurable results you want to achieve, with numbers if possible.',
    example: "Reduce churn to <5%/month within 3 months, measured by monthly cohort retention.",
  },
  {
    title: 'How will you achieve them?',
    hint: 'Describe the approach, solution, or strategy you will use.',
    example: "Deploy an in-app onboarding checklist with progress tracking and a 7-day email nudge sequence.",
  },
  {
    title: 'Summarise in one sentence',
    hint: 'Write a single sentence that captures the full picture: who, what, and how.',
    example: "Improve user onboarding to cut churn from 15% to 5%/month within 3 months.",
  },
]

// ── Step value — computed with getter/setter so v-model works cleanly ────────
// Replaces the plain currentValue() + handleInput() pattern which had a
// reactivity edge case: under Vue's microtask batching + Transition remounting,
// the `:value` binding could lose sync with the underlying ref.  A computed
// with an explicit setter is the canonical Vue 3 solution.
const stepValue = computed<string>({
  get() {
    if (currentStep.value === 1) return stakes.value
    if (currentStep.value === 2) return ends.value
    if (currentStep.value === 3) return means.value
    return oneLiner.value
  },
  set(val: string) {
    if (currentStep.value === 1) stakes.value = val
    else if (currentStep.value === 2) ends.value = val
    else if (currentStep.value === 3) means.value = val
    else oneLiner.value = val
  },
})

// ── Navigation ───────────────────────────────────────────────────────────────
function goBack(): void {
  if (currentStep.value > 1) currentStep.value--
}

function goNext(): void {
  if (currentStep.value < 4) {
    currentStep.value++
  } else {
    props.onSubmit(stakes.value, ends.value, means.value, oneLiner.value)
    props.onClose()
  }
}

function insertExample(): void {
  stepValue.value = STEPS[currentStep.value - 1].example
}
</script>

<template>
  <!-- Full-screen modal overlay -->
  <div
    class="fixed inset-0 z-[600] bg-white flex flex-col"
    role="dialog"
    aria-modal="true"
    :aria-label="`Guided spec wizard — step ${currentStep} of 4`"
  >
    <!-- ── Progress bar ─────────────────────────────────────────────────── -->
    <div
      class="flex gap-1 px-4 pt-4"
      role="progressbar"
      :aria-valuenow="currentStep"
      aria-valuemin="1"
      aria-valuemax="4"
      aria-label="Wizard progress"
    >
      <div
        v-for="n in 4"
        :key="n"
        class="h-1.5 flex-1 rounded-full transition-colors duration-300"
        :class="n <= currentStep ? 'bg-emerald-500' : 'bg-gray-200'"
        data-testid="progress-segment"
      />
    </div>

    <!-- ── Header row ───────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-4 pt-3 pb-1">
      <span class="text-xs text-gray-400 font-medium" data-testid="step-indicator">
        Step {{ currentStep }} of 4
      </span>
      <!-- Close button -->
      <button
        type="button"
        class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg
               text-gray-400 hover:text-gray-700 hover:bg-gray-100
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-gray-500 transition-colors"
        aria-label="Close wizard"
        @click="props.onClose()"
      >
        ×
      </button>
    </div>

    <!-- ── Step content (animated) ─────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <Transition name="fade" mode="out-in">
        <div :key="currentStep" class="space-y-5 pt-2">

          <!-- Step title -->
          <h2 class="text-2xl font-bold text-slate-800" data-testid="step-title">
            {{ STEPS[currentStep - 1].title }}
          </h2>

          <!-- Hint text -->
          <p class="text-sm italic text-slate-400" data-testid="step-hint">
            {{ STEPS[currentStep - 1].hint }}
          </p>

          <!-- Textarea input -->
          <textarea
            v-model="stepValue"
            :aria-label="STEPS[currentStep - 1].title"
            placeholder="Enter your answer here…"
            class="w-full min-h-[120px] rounded-xl border border-gray-200 bg-gray-50
                   px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                   transition-colors duration-150"
            data-testid="step-textarea"
          />

          <!-- Example text (click to insert) -->
          <p class="text-xs text-amber-600">
            e.g.
            <button
              type="button"
              class="underline underline-offset-2 hover:text-amber-800 focus-visible:outline
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-amber-500 transition-colors text-left"
              :aria-label="`Insert example for step ${currentStep}`"
              data-testid="example-button"
              @click="insertExample"
            >{{ STEPS[currentStep - 1].example }}</button>
          </p>

        </div>
      </Transition>
    </div>

    <!-- ── Navigation footer ────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-3 px-4 py-4 border-t border-gray-100">

      <!-- Back button -->
      <button
        type="button"
        class="min-h-[44px] px-5 text-sm font-medium rounded-lg border border-gray-200
               text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-gray-500 transition-colors"
        :disabled="currentStep === 1"
        data-testid="back-button"
        @click="goBack"
      >
        ← Back
      </button>

      <!-- Next / Submit button -->
      <button
        type="button"
        class="min-h-[44px] px-6 text-sm font-semibold rounded-lg bg-emerald-600 text-white
               hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2
               focus-visible:outline-offset-2 focus-visible:outline-emerald-600
               transition-colors"
        data-testid="next-button"
        @click="goNext"
      >
        <span v-if="currentStep < 4">Next →</span>
        <span v-else>✨ Generate Spec</span>
      </button>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
