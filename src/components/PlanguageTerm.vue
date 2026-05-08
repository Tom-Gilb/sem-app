<!-- UNIT_TYPE=Widget -->
<!-- PlanguageTerm — wraps a Planguage field label with a hover/focus tooltip -->
<!-- Feature #11 — "Explain This" Hover Tooltips -->
<template>
  <span class="planguage-term-wrapper relative inline-block">
    <span
      :id="labelId"
      :aria-describedby="tooltipId"
      tabindex="0"
      class="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2"
      :class="props.class"
      @mouseenter="show = true"
      @mouseleave="show = false"
      @focus="show = true"
      @blur="show = false"
    >{{ term }}</span>
    <span
      v-if="show"
      :id="tooltipId"
      role="tooltip"
      class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2
             max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg whitespace-normal"
    >
      {{ tooltipText }}
      <!-- Downward-pointing arrow using CSS border trick -->
      <span
        class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"
        aria-hidden="true"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  /** The Planguage term to display (e.g. "Scale", "Meter", "Function") */
  term: string
  /** Additional classes forwarded to the visible label span */
  class?: string
}>()

const TERM_DEFINITIONS: Record<string, string> = {
  Scale: 'The measurable dimension being tracked (e.g., %, count, seconds)',
  Meter: 'How and when Scale will be measured',
  Goal: 'The ideal target value — the best realistic outcome',
  Tolerable: 'The minimum acceptable value — below this is a failure',
  Status: 'Current measured value (baseline before work starts)',
  Function: 'What the system does — an action or capability',
  Value: 'Why the Function matters — the measurable benefit it delivers',
  Solution: 'How the Function is implemented — the technical approach',
}

const tooltipText = computed(() => TERM_DEFINITIONS[props.term] ?? '')

const show = ref(false)

// Unique IDs for aria wiring
const uid = Math.random().toString(36).slice(2, 8)
const labelId = `planguage-label-${uid}`
const tooltipId = `planguage-tooltip-${uid}`
</script>
