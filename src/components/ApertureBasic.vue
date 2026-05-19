<script setup lang="ts">
// UNIT_TYPE=Vue Component
// ApertureBasic — Ultra Light Phase 3 "Basic Menu" dedicated surface.
//
// Tom 2026-05-14: *"Basic Menu: the essentials — generate, share, save."*
//
// What you see:
//   • Same full-viewport white canvas + aperture well as Aperture.vue.
//   • The same single textarea inside the well (plain "What is important to
//     improve?" prompt — identical to the naked Plan aperture).
//   • Three small pill-action buttons BELOW the well:
//       [Previous Plans]   — navigates to AperturePrevious
//       [Save]             — snapshots the current spec now
//       [Full Menu]        — switches to the full existing app (view='full')
//   • "← Plan" ghost link top-left returns to the naked aperture.
//
// Why the same well as Plan aperture?
//   Basic is the "I understand what to type but want the save/load affordances
//   visible at a glance" mode — it is Plan + discoverable essentials. Keeping
//   the same well means zero learning curve for the gesture that matters most:
//   typing an Ends statement and hitting Enter.
//
// Emits:
//   submit         — the typed text (treated as Ends, same as Aperture)
//   go-previous    — navigate to AperturePrevious
//   save           — save current spec now (App.vue calls savePlanNow)
//   go-full        — navigate to full existing app surface
//   go-plan        — return to naked aperture

import { ref, nextTick, onMounted } from 'vue'

const emit = defineEmits<{
  submit:        [text: string]
  'go-previous': []
  save:          []
  'go-full':     []
  'go-plan':     []
}>()

const text = ref('')
const ta = ref<HTMLTextAreaElement | null>(null)

function send(): void {
  const v = text.value.trim()
  if (!v) return
  emit('submit', v)
}

function onKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    send()
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && !text.value.includes('\n')) {
    e.preventDefault()
    send()
  }
}

onMounted(async () => {
  await nextTick()
  ta.value?.focus()
})
</script>

<template>
  <!--
    Fixed full-viewport white canvas. z-[350] same tier as Aperture.vue.
  -->
  <div
    class="fixed inset-0 z-[350] bg-white flex items-center justify-center select-none"
    aria-label="Basic Menu — essentials"
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

    <!-- Label above well -->
    <div class="absolute" style="top: calc(50% - min(43vw,360px) - 2.5rem)">
      <p class="text-[10px] uppercase tracking-widest text-slate-400 select-none text-center">Basic</p>
    </div>

    <!-- Aperture well wrapper (identical geometry to Aperture.vue) -->
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

      <!-- Iris leaf strokes -->
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

      <!-- Content layer: textarea + whisper -->
      <div class="relative z-10 w-[78%] flex flex-col items-center text-center">
        <textarea
          ref="ta"
          v-model="text"
          rows="3"
          spellcheck="true"
          placeholder="What is important to improve?"
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
        <div class="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">
          speak · type · listen
        </div>
      </div>
    </div>

    <!-- Essential action pills — below the well -->
    <div
      class="absolute bottom-10 flex items-center gap-3 select-none"
      aria-label="Basic actions"
    >
      <button
        type="button"
        class="
          px-4 py-1.5 rounded-full text-xs font-medium
          ring-1 ring-slate-200 hover:ring-slate-400
          text-slate-600 hover:text-slate-900
          bg-white hover:bg-slate-50
          transition
        "
        @click="emit('go-previous')"
        aria-label="Open previous saved plans"
      >
        Previous Plans
      </button>
      <button
        type="button"
        class="
          px-4 py-1.5 rounded-full text-xs font-medium
          ring-1 ring-slate-200 hover:ring-slate-400
          text-slate-600 hover:text-slate-900
          bg-white hover:bg-slate-50
          transition
        "
        @click="emit('save')"
        aria-label="Save current plan now"
      >
        Save now
      </button>
      <button
        type="button"
        class="
          px-4 py-1.5 rounded-full text-xs font-medium
          ring-1 ring-slate-200 hover:ring-slate-400
          text-slate-600 hover:text-slate-900
          bg-white hover:bg-slate-50
          transition
        "
        @click="emit('go-full')"
        aria-label="Switch to Full Menu with all tools"
      >
        Full Menu
      </button>
    </div>
  </div>
</template>
