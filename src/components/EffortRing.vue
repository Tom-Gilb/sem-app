<!-- UNIT_TYPE=Widget -->
<!--
/**
 * EffortRing — Feature #36: Evo Step Effort Breakdown Doughnut
 *
 * Renders a pure SVG doughnut (ring) chart showing this step's share of total
 * project effort vs. the remainder.
 *
 * Spec: S.Evo36.EffortRingComponent
 */
-->
<script setup lang="ts">
import { computed } from 'vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    /** This step's effort as % of total project (0–100) */
    effortPercent: number
    /** SVG diameter in px */
    size?: number
  }>(),
  { size: 32 },
)

// ── Derived geometry ──────────────────────────────────────────────────────────

const strokeWidth = computed(() => props.size * 0.22)
const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const r = computed(() => props.size / 2 - strokeWidth.value / 2)
const circumference = computed(() => 2 * Math.PI * r.value)

/**
 * stroke-dasharray: [arc length for this step, gap (rest)]
 * stroke-dashoffset: starts at top via transform="rotate(-90 cx cy)"
 */
const dashArray = computed(() => {
  const filled = (props.effortPercent / 100) * circumference.value
  const remaining = circumference.value - filled
  return `${filled} ${remaining}`
})

const fontSize = computed(() => props.size * 0.22)
</script>

<template>
  <svg
    :viewBox="`0 0 ${size} ${size}`"
    :width="size"
    :height="size"
    aria-hidden="true"
  >
    <!-- Background (remaining) ring -->
    <circle
      :cx="cx"
      :cy="cy"
      :r="r"
      fill="none"
      stroke="#e5e7eb"
      :stroke-width="strokeWidth"
    />

    <!-- Foreground (this step) arc — indigo-500 -->
    <circle
      :cx="cx"
      :cy="cy"
      :r="r"
      fill="none"
      stroke="#6366f1"
      :stroke-width="strokeWidth"
      :stroke-dasharray="dashArray"
      stroke-linecap="round"
      :transform="`rotate(-90 ${cx} ${cy})`"
    />

    <!-- Centre label -->
    <text
      :x="cx"
      :y="cy"
      text-anchor="middle"
      dominant-baseline="middle"
      :font-size="fontSize"
      fill="#374151"
      font-weight="600"
    >{{ effortPercent }}%</text>
  </svg>
</template>
