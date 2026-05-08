<!-- LoadingProgress.vue — Reusable elapsed-timer + estimated progress bar.
     Drop this next to any AI call that takes >5 s so the user always sees:
       • a labelled spinner
       • a growing bar (capped at 88% until resolved)
       • "~N% · Ns elapsed"
       • an optional slow-network hint after baseline/2 seconds

     Props:
       loading   — drives the timer; pass the composable's loading ref
       label     — e.g. "Parsing as Planguage…"
       baseline  — expected seconds to completion (calibrates % estimate)
       hint      — sentence shown after baseline/2 s, e.g. "can take up to 60s on slow networks"
       color     — bar + text accent: indigo | amber | slate | emerald (default: indigo) -->

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    loading: boolean
    label?: string
    baseline?: number
    hint?: string
    color?: 'indigo' | 'amber' | 'slate' | 'emerald'
  }>(),
  {
    label: 'Working…',
    baseline: 30,
    color: 'indigo',
  },
)

const elapsed = ref(0)
let _timer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.loading,
  (isLoading) => {
    if (isLoading) {
      elapsed.value = 0
      _timer = setInterval(() => { elapsed.value++ }, 1000)
    } else {
      if (_timer !== null) { clearInterval(_timer); _timer = null }
      elapsed.value = 0
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (_timer !== null) clearInterval(_timer)
})

/** Estimated completion — grows linearly, capped at 88% until the call returns. */
const pct = computed(() => Math.min(88, Math.round((elapsed.value / props.baseline) * 88)))

/** Show slow-network hint once half the baseline time has elapsed. */
const showHint = computed(() => !!props.hint && elapsed.value >= Math.floor(props.baseline / 2))

const barClass = computed(() => ({
  'bg-indigo-500': props.color === 'indigo',
  'bg-amber-500':  props.color === 'amber',
  'bg-slate-600':  props.color === 'slate',
  'bg-emerald-500':props.color === 'emerald',
}))

const textClass = computed(() => ({
  'text-indigo-700': props.color === 'indigo',
  'text-amber-700':  props.color === 'amber',
  'text-slate-600':  props.color === 'slate',
  'text-emerald-700':props.color === 'emerald',
}))

const trackClass = computed(() => ({
  'bg-indigo-100': props.color === 'indigo',
  'bg-amber-100':  props.color === 'amber',
  'bg-slate-100':  props.color === 'slate',
  'bg-emerald-100':props.color === 'emerald',
}))
</script>

<template>
  <div
    v-if="loading"
    class="space-y-1.5"
    role="status"
    aria-live="polite"
  >
    <!-- Label + spinner -->
    <div class="flex items-center gap-2" :class="textClass">
      <span
        class="inline-block h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        aria-hidden="true"
      />
      <span class="text-sm font-medium">{{ label }}</span>
    </div>

    <!-- Progress track -->
    <div class="h-2 w-full rounded-full overflow-hidden" :class="trackClass">
      <div
        class="h-full rounded-full transition-[width] duration-1000 ease-linear"
        :class="barClass"
        :style="{ width: pct + '%' }"
        role="progressbar"
        :aria-valuenow="pct"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${label} — approximately ${pct}% complete`"
      />
    </div>

    <!-- Stats row -->
    <p class="text-[11px]" :class="textClass" style="opacity: 0.7">
      ~{{ pct }}% · {{ elapsed }}s elapsed
      <span v-if="showHint"> — {{ hint }}</span>
    </p>
  </div>
</template>
