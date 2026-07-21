<!--
  ClaudianStarGlyph.vue — Deep AI category icon (Tom Gilb 2026-06-17 verbatim
  "Deep AI: The AI symbol (Star use the Claudian one)").

  The 4-pointed sparkle star is the canonical "AI" mark used by modern AI
  products (Anthropic's Claude logomark family lives in this style space).
  Two crossed elongated 4-pointed stars in a fuchsia-to-amber radial form
  signal "AI sparkle = something the AI conjures from your input".

  No personification (Agents Are Tools v157 — tools are abstract instruments,
  not characters).  No English letters (DD-015 International Icons rule).
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
}>(), { size: 'standard' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size === 'large' ? 32 : size === 'compact' ? 16 : 24"
    :height="size === 'large' ? 32 : size === 'compact' ? 16 : 24"
    fill="none"
    role="img"
    aria-label="Deep AI — sparkle star"
  >
    <defs>
      <linearGradient id="claudianStarGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d946ef"/>
        <stop offset="0.5" stop-color="#f472b6"/>
        <stop offset="1" stop-color="#fbbf24"/>
      </linearGradient>
    </defs>
    <!-- Main 4-pointed star: elongated vertical + horizontal points -->
    <path
      d="M 12 1 L 13.5 10 L 23 12 L 13.5 14 L 12 23 L 10.5 14 L 1 12 L 10.5 10 Z"
      fill="url(#claudianStarGrad)"
      stroke="#fff"
      stroke-width="0.4"
      stroke-linejoin="round"
    />
    <!-- Smaller diagonal accent star — overlapping for sparkle depth -->
    <path
      d="M 18 4 L 18.6 7.4 L 22 8 L 18.6 8.6 L 18 12 L 17.4 8.6 L 14 8 L 17.4 7.4 Z"
      fill="#fff"
      opacity="0.85"
    />
  </svg>
</template>
