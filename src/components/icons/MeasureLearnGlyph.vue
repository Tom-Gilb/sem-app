<!--
  MeasureLearnGlyph.vue — Study-Act tool icon (Tom Gilb 2026-06-17 verbatim
  "Study-Act, No Evo cycle section Measure -> Learn").

  Just the Measure → Learn sub-cycle of the Evo cycle (the bottom-half
  feedback loop).  TWO labeled nodes connected by an arrow:
   - Measure (📊 gauge) — observe the delivered Evo Step's actual impact
   - Learn (💡 bulb) — adjust the plan based on what the measurement taught

  Per Tom's direction this is NOT the full 9-step Evo cycle — just the
  Measure → Learn segment that defines Study-Act.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
}>(), { size: 'standard' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 24"
    :width="size === 'large' ? 36 : size === 'compact' ? 18 : 28"
    :height="size === 'large' ? 32 : size === 'compact' ? 16 : 24"
    fill="none"
    role="img"
    aria-label="Study-Act — Measure → Learn sub-cycle"
  >
    <!-- Measure node (left) — gauge -->
    <g>
      <circle cx="7" cy="12" r="5.5" fill="#0f172a" stroke="#22d3ee" stroke-width="1.4"/>
      <!-- Gauge arc -->
      <path d="M 3 12 A 4 4 0 0 1 11 12" fill="none" stroke="#22d3ee" stroke-width="1"/>
      <!-- Gauge needle -->
      <line x1="7" y1="12" x2="9" y2="9" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/>
      <!-- Gauge tick marks -->
      <line x1="3.5" y1="12" x2="4.4" y2="12"  stroke="#94a3b8" stroke-width="0.7"/>
      <line x1="7" y1="8.5" x2="7"  y2="9.4"   stroke="#94a3b8" stroke-width="0.7"/>
      <line x1="9.6" y1="12" x2="10.5" y2="12" stroke="#94a3b8" stroke-width="0.7"/>
    </g>

    <!-- Arrow Measure → Learn -->
    <g stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round" fill="none">
      <line x1="13" y1="12" x2="18" y2="12"/>
      <polyline points="16.5,10.5 18,12 16.5,13.5"/>
    </g>

    <!-- Learn node (right) — light bulb -->
    <g>
      <circle cx="22" cy="11" r="4.5" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.2"/>
      <!-- Bulb filament — small zigzag -->
      <polyline points="20.5,11 21.2,10 22,11 22.8,10 23.5,11" stroke="#f59e0b" stroke-width="0.9" fill="none" stroke-linecap="round"/>
      <!-- Bulb base -->
      <rect x="20.5" y="15" width="3" height="2.2" fill="#94a3b8" stroke="#475569" stroke-width="0.5"/>
      <!-- Bulb rays -->
      <g stroke="#fbbf24" stroke-width="0.8" stroke-linecap="round">
        <line x1="22" y1="4.6" x2="22" y2="5.7"/>
        <line x1="17.5" y1="8.5" x2="18.4" y2="8.9"/>
        <line x1="26.5" y1="8.5" x2="25.6" y2="8.9"/>
      </g>
    </g>
  </svg>
</template>
