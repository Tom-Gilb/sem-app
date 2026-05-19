<script setup lang="ts">
// UNIT_TYPE=Vue Component
// ApertureStart — Ultra Light Phase 3 "Start Menu" dedicated surface.
//
// Tom 2026-05-14: *"Start Menu: fresh-plan entry with guided prompts."*
//
// What you see:
//   • Same full-viewport white canvas as Aperture.vue.
//   • A 3-step progressive wizard that walks the user through the SEM triple:
//       Step 1 — Stakes  ("Who benefits and why does it matter?")
//       Step 2 — Ends    ("What would success look like?")
//       Step 3 — Means   ("What are your ideas or solutions?")
//   • A faint step indicator (1 · 2 · 3) above the aperture well.
//   • Each step shows ONE question inside the same aperture-well motif.
//   • Forward/Back pill buttons — unobtrusive, below the well.
//   • Final step: "Generate →" fires the submit emit.
//   • "← Plan" ghost link top-left returns to the naked Plan aperture.
//
// Emits:
//   submit    — { stakes, ends, means } when all 3 steps are complete
//   go-plan   — user wants to return to the naked aperture

import { ref, computed, nextTick, onMounted } from 'vue'

const emit = defineEmits<{
  submit:  [payload: { stakes: string; ends: string; means: string }]
  'go-plan': []
}>()

const step  = ref(1)   // 1 | 2 | 3

const stakes = ref('')
const ends   = ref('')
const means  = ref('')

const ta = ref<HTMLTextAreaElement | null>(null)

const steps = [
  {
    n: 1,
    label: 'Stakes',
    question: 'Who benefits and why does it matter?',
    placeholder: 'e.g. Patients who wait too long for a diagnosis…',
    model: stakes,
  },
  {
    n: 2,
    label: 'Ends',
    question: 'What would success look like?',
    placeholder: 'e.g. Diagnosis time halved, satisfaction above 90%…',
    model: ends,
  },
  {
    n: 3,
    label: 'Means',
    question: 'What are your ideas or solutions?',
    placeholder: 'e.g. Triage app, dedicated fast-track clinic…',
    model: means,
  },
] as const

const current = computed(() => steps[step.value - 1])
const isFirst  = computed(() => step.value === 1)
const isLast   = computed(() => step.value === 3)

async function focusTextarea(): Promise<void> {
  await nextTick()
  ta.value?.focus()
}

function advance(): void {
  if (step.value < 3) {
    step.value++
    focusTextarea()
  } else {
    // All 3 steps done — fire submit
    emit('submit', {
      stakes: stakes.value.trim(),
      ends:   ends.value.trim(),
      means:  means.value.trim(),
    })
  }
}

function back(): void {
  if (step.value > 1) {
    step.value--
    focusTextarea()
  }
}

function onKey(e: KeyboardEvent): void {
  // ⌘/Ctrl-Enter always advances (or submits on last step)
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    advance()
    return
  }
  // Plain Enter on single-line text advances too
  const model = current.value.model
  if (e.key === 'Enter' && !e.shiftKey && !model.value.includes('\n')) {
    e.preventDefault()
    advance()
  }
}

onMounted(() => { focusTextarea() })
</script>

<template>
  <!--
    Fixed full-viewport white canvas. z-[350] sits above the persistent app
    chrome (100–300) and below major surfaces (380–500). Same tier as Aperture.vue.
  -->
  <div
    class="fixed inset-0 z-[350] bg-white flex items-center justify-center"
    aria-label="Start Menu — guided plan entry"
  >
    <!-- ← Plan ghost link top-left -->
    <button
      type="button"
      class="absolute top-4 left-4 text-xs text-slate-400 hover:text-slate-700 transition"
      @click="emit('go-plan')"
      aria-label="Return to Plan aperture"
    >
      ← Plan
    </button>

    <!-- Step indicator -->
    <div class="absolute top-8 flex items-center gap-3 select-none" aria-hidden="true">
      <template v-for="s in steps" :key="s.n">
        <span
          class="text-xs font-medium tabular-nums transition-colors"
          :class="[
            step === s.n
              ? 'text-slate-700'
              : step > s.n
                ? 'text-slate-300'
                : 'text-slate-300',
          ]"
        >
          <span
            :class="[
              step === s.n
                ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-white text-[10px]'
                : step > s.n
                  ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px]'
                  : 'inline-flex items-center justify-center w-5 h-5 rounded-full ring-1 ring-slate-200 text-slate-400 text-[10px]',
            ]"
          >{{ step > s.n ? '✓' : s.n }}</span>
          <span class="ml-1">{{ s.label }}</span>
        </span>
        <span v-if="s.n < 3" class="text-slate-200 select-none">—</span>
      </template>
    </div>

    <!-- Aperture well wrapper -->
    <div class="relative w-[min(86vw,720px)] aspect-[1.35/1] flex items-center justify-center select-text">

      <!-- Outer halo -->
      <div
        class="absolute inset-0 rounded-full pointer-events-none"
        style="background: radial-gradient(closest-side, rgba(15,23,42,0.05), rgba(15,23,42,0) 72%);"
      ></div>

      <!-- The aperture well -->
      <div
        class="absolute inset-[6%] rounded-full"
        style="
          background: radial-gradient(closest-side at 50% 44%, #ffffff, #f8fafc 68%, #e2e8f0 100%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            inset 0 -40px 80px rgba(15,23,42,0.05),
            inset 0 0 0 1px rgba(15,23,42,0.06),
            0 30px 60px -30px rgba(15,23,42,0.18);
        "
      ></div>

      <!-- Iris leaf strokes (identical to Aperture.vue) -->
      <svg
        class="absolute inset-[6%] pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="rgba(15,23,42,0.045)" stroke-width="0.4" stroke-linecap="round">
          <line x1="50" y1="6"  x2="50" y2="94" />
          <line x1="6"  y1="50" x2="94" y2="50" />
          <line x1="16" y1="16" x2="84" y2="84" />
          <line x1="84" y1="16" x2="16" y2="84" />
        </g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(15,23,42,0.05)" stroke-width="0.3" />
      </svg>

      <!-- Content layer: question label + textarea -->
      <div class="relative z-10 w-[78%] flex flex-col items-center text-center gap-2">
        <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400 select-none">
          {{ current.question }}
        </div>
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0 -translate-y-1"
          mode="out-in"
        >
          <textarea
            :key="step"
            ref="ta"
            v-model="current.model.value"
            rows="3"
            spellcheck="true"
            :placeholder="current.placeholder"
            class="
              w-full bg-transparent
              text-slate-800 placeholder-slate-400
              text-lg md:text-xl text-center
              resize-none focus:outline-none
              leading-relaxed
              caret-slate-500
            "
            @keydown="onKey"
          />
        </Transition>
      </div>
    </div>

    <!-- Navigation pills — below the well -->
    <div class="absolute bottom-10 flex items-center gap-4 select-none">
      <button
        v-if="!isFirst"
        type="button"
        class="text-sm text-slate-400 hover:text-slate-700 transition px-3 py-1.5"
        @click="back"
        aria-label="Previous step"
      >
        ← Back
      </button>
      <button
        type="button"
        class="
          px-5 py-2 rounded-full text-sm font-medium
          bg-slate-800 hover:bg-slate-900
          text-white shadow-sm transition
        "
        @click="advance"
        :aria-label="isLast ? 'Generate plan' : 'Next step'"
      >
        {{ isLast ? 'Generate →' : 'Next →' }}
      </button>
    </div>
  </div>
</template>
