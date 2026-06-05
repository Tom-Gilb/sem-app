<!--
  SpecStoryArtsyGlyph.vue — Color Artsy Icon synonym for SpecStoryGlyph (`[*] ← §`).
  Open book with violet star → dashed storyline arrow ← § stakeholder figure.
  "The story this spec tells, sourced from this stakeholder."
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), { size: 'standard', ariaLabel: 'Spec Story — spec sourced from stakeholder (artsy synonym)' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 76 28"
    :width="size === 'large' ? 114 : size === 'standard' ? 76 : 57"
    :height="size === 'large' ? 42 : size === 'standard' ? 28 : 21"
    fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <!-- Open book left page -->
    <path d="M 4 6 L 16 4 L 16 24 L 4 22 Z" stroke="#475569" fill="#f8fafc" />
    <!-- Open book right page -->
    <path d="M 28 6 L 16 4 L 16 24 L 28 22 Z" stroke="#475569" fill="#f8fafc" />
    <!-- Violet asterisk on the page -->
    <line x1="10" y1="11" x2="10" y2="17" stroke="#7c3aed" />
    <line x1="7" y1="15" x2="13" y2="13" stroke="#7c3aed" />
    <line x1="7" y1="13" x2="13" y2="15" stroke="#7c3aed" />
    <!-- Dashed storyline arrow -->
    <path d="M 32 14 Q 44 6 56 14" stroke="#64748b" stroke-dasharray="3 2" />
    <polyline points="36,11 32,14 36,17" stroke="#64748b" />
    <!-- § stakeholder figure (hand-drawn serpentine) -->
    <path d="M 70 8 L 68 10 Q 64 7 60 10 Q 58 13 64 14 Q 70 15 68 18 Q 64 20 60 18 L 58 20"
          stroke="#2563eb" stroke-width="2" />
  </svg>
</template>
