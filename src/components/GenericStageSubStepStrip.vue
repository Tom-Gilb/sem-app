<!-- UNIT_TYPE=Widget -->
<!--
 * GenericStageSubStepStrip.vue — reusable sub-step strip parameterised by
 * registry.  Avoids duplicating Stage 1/2/4/5 strip components for stages
 * 3/6/8/9 (and any future stage).
 *
 * Tom Gilb 2026-06-21 mandate "plough through and do as much as possible …
 * reduce work needed to improve" — this generic component IS the work-
 * reduction: one component renders any stage's sub-step strip given its
 * registry, instead of 11 near-identical SFCs.
 *
 * Per Architectural Resilience SUPREME — single bug surface, port-once-to-Twin.
 -->
<script setup lang="ts" generic="K extends string">
import { computed } from 'vue'

interface SubStepDef<KK extends string> {
  key:       KK
  label:     string
  shortHint: string
  longHint:  string
}

const props = defineProps<{
  /** Stage number (3, 6, 8, 9, ...) for the strip header label + aria. */
  stageNum: number
  /** The sub-step registry array — shape `{key, label, shortHint, longHint}[]`. */
  steps:    readonly SubStepDef<K>[]
  /** Optional one-line tagline rendered to the right of the pills. */
  tagline?: string
  /** Optional tooltip for the tagline (typically a Tom verbatim quote). */
  taglineTitle?: string
  /** Currently-active sub-step key. */
  current?: K
  /** Already-completed sub-step keys. */
  done?:    K[]
}>()

const emit = defineEmits<{
  (e: 'go', target: K): void
}>()

const currentKey = computed<K | null>(() => props.current ?? props.steps[0]?.key ?? null)
const doneSet    = computed<Set<K>>(() => new Set(props.done ?? []))

// r41 v280 (Tom Gilb 2026-06-22 "we also need some persistent information about
// the sub-step we are in, the next sub-step and our ability to move on" +
// "a flashing button should signal the probably first step") — see
// Stage2SubStepStrip.vue r41 v280 comment for the full rationale.  Same pattern
// applied to the Generic strip used by stages 3 / 6 / 8 / 9.
const firstUndone = computed<K | null>(() => {
  for (const step of props.steps) {
    if (!doneSet.value.has(step.key)) return step.key
  }
  return null
})
const nextLabel = computed<string>(() => {
  if (firstUndone.value === null) return `Continue to Stage ${(props.stageNum ?? 0) + 1}`
  const step = props.steps.find(s => s.key === firstUndone.value)
  return step ? `${step.key} — ${step.label}` : 'next sub-step'
})

function stepClass(key: K): string {
  const isFirstUndone = key === firstUndone.value
  const pulseClass = isFirstUndone ? 'animate-pulse ring-2 ring-amber-300/80 shadow-amber-200/40 shadow-lg' : ''
  if (key === currentKey.value) {
    return `bg-amber-400/95 text-amber-950 ring-2 ring-amber-200 shadow-md ${pulseClass}`
  }
  if (doneSet.value.has(key)) {
    return 'bg-emerald-500/85 text-emerald-50 hover:bg-emerald-500'
  }
  return `bg-white/10 text-white/70 hover:bg-white/20 ring-1 ring-white/15 ${pulseClass}`
}

function badge(key: K): string {
  if (key === currentKey.value) return '●'
  if (doneSet.value.has(key))   return '✓'
  return ''
}

// r41 v406 — Done/You-Can/Continue SUPREME v403 propagation to the generic
// strip used by Stages 3 / 6 / 8 / 9 + any future stage.  Same pattern as
// Stage 2 reference implementation.
const doneSteps = computed(() => props.steps.filter(s => doneSet.value.has(s.key)))
const optionalSteps = computed(() => props.steps.filter(s => !doneSet.value.has(s.key)))
const doneLine = computed<string>(() => {
  if (doneSteps.value.length === 0) return 'Nothing done yet'
  return doneSteps.value.map(s => `${s.key} ${s.label}`).join(' · ')
})
const continueLine = computed<string>(() =>
  `Press the Stage ${(props.stageNum ?? 0) + 1} tile above (or any later stage) — skip the options; you can return any time.`
)
</script>

<template>
  <div
    class="w-full bg-slate-900/45 border-y border-white/10 text-white"
    :aria-label="`Stage ${stageNum} sub-step strip`"
  >
  <div class="w-full flex flex-wrap items-center gap-2 px-3 py-2">
    <span class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/65 mr-2 whitespace-nowrap">
      Stage {{ stageNum }} Steps
    </span>

    <button
      v-for="step in steps"
      :key="step.key"
      type="button"
      :class="['shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/40', stepClass(step.key)]"
      :title="`${step.key} — ${step.label}.  ${step.longHint}`"
      :aria-label="`Go to sub-step ${step.key} — ${step.label}`"
      :aria-current="step.key === currentKey ? 'step' : undefined"
      @click="emit('go', step.key)"
    >
      <span class="shrink-0 font-mono font-bold tabular-nums">{{ step.key }}</span>
      <span class="whitespace-nowrap">{{ step.label }}</span>
      <span v-if="badge(step.key)" class="shrink-0 text-[10px] font-bold leading-none ml-0.5">{{ badge(step.key) }}</span>
    </button>

    <!-- r41 v280 — persistent "Next:" chip naming the next probable action -->
    <span
      class="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-white/15 text-amber-100 ring-1 ring-amber-300/40 ml-2"
      :title="firstUndone === null ? `All Stage ${stageNum} sub-steps complete — ready to move on` : `Probable next action: ${nextLabel}.  Click the pulsing pill above to start it.`"
    >
      <span class="text-white/70 uppercase tracking-wider text-[9px]">Next:</span>
      <span>{{ nextLabel }}</span>
    </span>

    <span
      v-if="tagline"
      class="shrink-0 text-[9px] italic text-white/55 ml-2 max-w-[340px] leading-tight"
      :title="taglineTitle ?? tagline"
      v-html="tagline"
    />
  </div>

  <!-- Row 2 — DONE / YOU CAN / CONTINUE (Done/You-Can/Continue SUPREME v403) -->
  <div class="w-full px-3 pb-2 pt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px] leading-snug">
    <span class="font-bold text-emerald-300 whitespace-nowrap">✓ DONE:</span>
    <span class="text-white/80">{{ doneLine }}</span>
    <span class="font-bold text-amber-200 whitespace-nowrap self-start">✨ YOU CAN:</span>
    <div class="text-white/85 space-y-0.5">
      <template v-if="optionalSteps.length > 0">
        <p class="text-[11.5px] italic text-white/65 mb-1">Click any pill above to start that option (all optional, any order):</p>
        <ul class="space-y-0.5 pl-4 list-disc marker:text-white/40">
          <li v-for="s in optionalSteps" :key="s.key" class="leading-snug">
            <span class="text-white/95">{{ s.key }} {{ s.label }}</span>
            <span class="text-white/70"> — {{ s.shortHint }}</span>
          </li>
        </ul>
      </template>
      <span v-else class="italic text-white/60">All done — every sub-step in this stage is complete.</span>
    </div>
    <span class="font-bold text-indigo-300 whitespace-nowrap">➜ CONTINUE:</span>
    <span class="text-white/95">{{ continueLine }}</span>
  </div>
  <p class="px-3 pb-2 text-[10.5px] italic text-white/55 leading-tight">Everything is optional. Stages are cyclic — return any time.</p>
  </div>
</template>
