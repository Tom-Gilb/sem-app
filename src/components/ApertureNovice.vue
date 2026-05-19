<script setup lang="ts">
// UNIT_TYPE=Vue Component
// ApertureNovice — Ultra Light Phase 3 "Novice Menu" dedicated surface.
//
// Tom 2026-05-14: *"Novice Menu: friendly tour, examples, no jargon."*
//
// What you see:
//   • Same full-viewport white canvas as Aperture.vue.
//   • A short title ("Try a real example.") and soft subtitle.
//   • Three hardcoded example plan seeds — each a real-world situation that
//     shows how SEM thinking applies without using Planguage jargon.
//   • Each card: domain tag · plain-English problem question · "Try this →" button.
//   • Clicking "Try this →" fires the 'try-example' emit with the question
//     text pre-loaded as the Ends field — App.vue routes it into handleSubmit.
//   • "← Plan" ghost link top-left returns to the naked aperture.
//   • "Want to build your own? Start here →" link below cards → go-start.
//
// Emits:
//   try-example  — the example text string (treated as an Ends prompt)
//   go-start     — navigate to ApertureStart for a guided blank entry

const emit = defineEmits<{
  'try-example': [text: string]
  'go-start': []
  'go-plan': []
}>()

interface Example {
  tag:   string   // short domain label (no Planguage jargon)
  title: string   // punchy headline
  text:  string   // the actual prompt text sent to handleSubmit
}

const EXAMPLES: Example[] = [
  {
    tag:   'Healthcare',
    title: 'Cut patient wait times',
    text:  'Patients wait too long and sometimes leave without a proper diagnosis. How do we improve care quality and cut wait times in half?',
  },
  {
    tag:   'Software team',
    title: 'Ship twice as fast',
    text:  'Our dev team ships features too slowly and engineers feel burnt out. How do we double throughput without burning people out?',
  },
  {
    tag:   'Remote work',
    title: 'Align across time zones',
    text:  'Our distributed team struggles to coordinate across time zones. How do we improve alignment and reduce wasted meeting hours?',
  },
]

function tryExample(example: Example): void {
  emit('try-example', example.text)
}
</script>

<template>
  <!--
    Fixed full-viewport white canvas. z-[350] same tier as Aperture.vue.
    Centered column, simple — no Planguage vocabulary visible.
  -->
  <div
    class="fixed inset-0 z-[350] bg-white flex flex-col items-center justify-center px-6"
    aria-label="Novice Menu — example plans"
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

    <!-- Header -->
    <div class="text-center mb-10 select-none">
      <p class="text-2xl font-light text-slate-700 tracking-tight">Try a real example.</p>
      <p class="mt-2 text-sm text-slate-400">Pick one and we'll build a plan together.</p>
    </div>

    <!-- Example cards -->
    <div class="w-full max-w-lg flex flex-col gap-4">
      <button
        v-for="ex in EXAMPLES"
        :key="ex.tag"
        type="button"
        class="
          text-left w-full px-5 py-4 rounded-2xl
          ring-1 ring-slate-200 hover:ring-slate-400
          bg-white hover:bg-slate-50
          shadow-sm hover:shadow-md
          transition-all group
        "
        @click="tryExample(ex)"
        :aria-label="`Try example: ${ex.title}`"
      >
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-widest text-slate-400 font-medium">{{ ex.tag }}</span>
          <span
            class="text-xs text-slate-400 group-hover:text-slate-700 transition opacity-0 group-hover:opacity-100"
            aria-hidden="true"
          >Try this →</span>
        </div>
        <p class="mt-1.5 text-base font-medium text-slate-800 leading-snug">{{ ex.title }}</p>
        <p class="mt-1 text-sm text-slate-500 leading-relaxed">{{ ex.text }}</p>
      </button>
    </div>

    <!-- Footer link to ApertureStart -->
    <button
      type="button"
      class="mt-10 text-sm text-slate-400 hover:text-slate-700 transition select-none"
      @click="emit('go-start')"
      aria-label="Go to Start Menu to build your own plan"
    >
      Want to build your own? <span class="underline underline-offset-2">Start here →</span>
    </button>
  </div>
</template>
