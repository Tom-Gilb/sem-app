<script setup lang="ts">
import CloseDot from './CloseDot.vue'
import { ref, computed } from 'vue'

const emit = defineEmits<{ close: [] }>()

const TOUR_STEPS = [
  {
    step: 1,
    icon: '✍️',
    region: 'SEM Entry Form',
    title: 'Start with your goal',
    description: 'Type or dictate your project idea — who cares, what outcomes you want, how you\'ll achieve them. Toolbar shortcuts: 🎲 Surprise me (random scenario), 🎯 Start with your goal (guided 4-step wizard), 📋 Templates, 📎 Import from URL or file, 🎤 Voice dictation.',
  },
  {
    step: 2,
    icon: '🤖',
    region: 'Spec Panel',
    title: 'AI generates your Planguage spec',
    description: 'Submit your SEM entry and Claude generates a structured Planguage spec with Function Specs, Value Specs, and Solution Specs. Each Value Spec has Scale, Meter, Goal, Tolerable, and Status fields.',
  },
  {
    step: 3,
    icon: '📋',
    region: 'Evo Plan',
    title: 'Plan your delivery steps',
    description: 'The AI suggests ranked Evo steps based on your spec. Drag to reorder (desktop) or use ↑↓ buttons (mobile). Confirm the plan to unlock task decomposition and the 💰 cost estimator.',
  },
  {
    step: 4,
    icon: '📊',
    region: 'Impact Estimation',
    title: 'Prioritise by value',
    description: 'The Impact Estimation Table (IET) shows each Evo step scored against your Value Specs. V/C ratios (Value per Cost) rank steps by value-per-resource. Use the Confidence and Stakeholder toggles for deeper analysis.',
  },
  {
    step: 5,
    icon: '🛠️',
    region: 'Spec Tools',
    title: 'Enhance and export your spec',
    description: 'The spec panel has 20+ tools: 📋 Changelog, 🌐 Translate, 🍚 RICE scores, 🎯 Confidence sliders, 🔥 Compliance heatmap, 📄 PDF export, 🎓 AI Coach, and more. Use ▶ Present for a full-screen slideshow.',
  },
  {
    step: 6,
    icon: '🏁',
    region: "You're ready!",
    title: 'Demo tip',
    description: 'Use the "▶ See a demo" button on the sign-in page for a 60-second auto-walkthrough. Enable Mock Mode (no API key needed) for instant AI responses. The 📊 Dashboard saves every spec you generate in this session.',
  },
]

const currentStep = ref(0)
const totalSteps = TOUR_STEPS.length

const step = computed(() => TOUR_STEPS[currentStep.value])
const progressPercent = computed(() => ((currentStep.value + 1) / totalSteps) * 100)

function next(): void {
  if (currentStep.value < totalSteps - 1) currentStep.value++
  else finish()
}

function prev(): void {
  if (currentStep.value > 0) currentStep.value--
}

function finish(): void {
  try { sessionStorage.setItem('sem-tour-seen', '1') } catch {}
  emit('close')
}
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
    role="dialog"
    aria-modal="true"
    aria-label="Onboarding tour"
    @click.self="finish"
  >
    <!-- Card -->
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 relative">

      <!-- Progress bar -->
      <div class="absolute top-0 left-0 right-0 h-1 bg-slate-100 rounded-t-2xl overflow-hidden">
        <div
          class="h-full bg-emerald-500 transition-all duration-300 ease-out"
          :style="{ width: `${progressPercent}%` }"
          role="progressbar"
          :aria-valuenow="currentStep + 1"
          :aria-valuemin="1"
          :aria-valuemax="totalSteps"
          :aria-label="`Step ${currentStep + 1} of ${totalSteps}`"
        />
      </div>

      <!-- Close button -->
      <CloseDot
        title="Close"
        aria-label="Close tour"
        @click="finish"
      />

      <!-- Step counter -->
      <p class="text-xs text-slate-400 font-medium mb-4 pt-1">
        Step {{ currentStep + 1 }} of {{ totalSteps }}
      </p>

      <!-- Icon -->
      <div class="text-5xl text-center mb-2" aria-hidden="true">{{ step.icon }}</div>

      <!-- Region badge -->
      <div class="flex justify-center mb-4">
        <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full px-3 py-1">
          📍 {{ step.region }}
        </span>
      </div>

      <!-- Title -->
      <h2 class="text-xl font-bold text-slate-800 text-center">{{ step.title }}</h2>

      <!-- Description -->
      <p class="text-slate-600 leading-relaxed mt-2 text-center">{{ step.description }}</p>

      <!-- Footer -->
      <div class="mt-8 flex items-center justify-between">
        <!-- Left side: Back + Skip -->
        <div class="flex items-center gap-2">
          <button
            v-if="currentStep > 0"
            type="button"
            aria-label="Back"
            class="h-11 px-4 rounded-lg text-sm font-medium text-slate-600
                   hover:bg-slate-100 border border-slate-200
                   focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
            @click="prev"
          >
            ← Back
          </button>
          <button
            type="button"
            aria-label="Skip"
            class="h-11 px-3 text-slate-400 text-sm
                   hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded
                   transition-colors"
            @click="finish"
          >
            Skip
          </button>
        </div>

        <!-- Right side: Next / Finish -->
        <button
          type="button"
          :aria-label="currentStep < totalSteps - 1 ? 'Next' : 'Finish'"
          class="h-11 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white
                 text-sm font-semibold
                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                 transition-colors"
          @click="next"
        >
          {{ currentStep < totalSteps - 1 ? 'Next →' : 'Finish ✓' }}
        </button>
      </div>

    </div>
  </div>
</template>
