<!--
  PlannerArtsyGlyph.vue — Color Artsy Icon synonym for PlannerGlyph (`[?]→[*]`).
  Lightbulb with `?`-curl filament → curved pen-arrow → 6-point insight burst.
  "Hypothesis becomes insight via planning."
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), { size: 'standard', ariaLabel: 'Planner — questions become insight (artsy synonym)' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 92 28"
    :width="size === 'large' ? 138 : size === 'standard' ? 92 : 69"
    :height="size === 'large' ? 42 : size === 'standard' ? 28 : 21"
    fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <!-- Lightbulb (?) -->
    <path d="M 16 4 Q 6 4 6 14 Q 6 19 11 22 L 21 22 Q 26 19 26 14 Q 26 4 16 4 Z" stroke="#d97706" fill="#fef3c7" />
    <path d="M 13 10 Q 13 8 16 8 Q 19 8 19 11 Q 19 14 16 15" stroke="#d97706" stroke-width="1.6" />
    <circle cx="16" cy="18" r="1.2" fill="#d97706" stroke="none" />
    <line x1="11" y1="24" x2="21" y2="24" stroke="#d97706" />
    <!-- Sweeping pen-arrow -->
    <path d="M 32 14 Q 44 6 56 14" stroke="#64748b" />
    <polyline points="52,9 56,14 51,16" stroke="#64748b" />
    <!-- Insight starburst -->
    <line x1="73" y1="6" x2="73" y2="22" stroke="#7c3aed" />
    <line x1="65" y1="20" x2="81" y2="8" stroke="#7c3aed" />
    <line x1="65" y1="8" x2="81" y2="20" stroke="#7c3aed" />
    <line x1="65" y1="14" x2="81" y2="14" stroke="#7c3aed" />
    <circle cx="73" cy="14" r="2.5" fill="#7c3aed" stroke="none" />
  </svg>
</template>
