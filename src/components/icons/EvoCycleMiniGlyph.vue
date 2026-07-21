<!--
  EvoCycleMiniGlyph.vue — Evo Plan / Evo Sharpening / Evo Tools mini icon
  (Tom Gilb 2026-06-17 "mini Evo cycle").

  Compact circular cycle with 9 markers (the 9 steps of the Evo cycle since
  1960) + a directional arrow + a violet ring.  Same shape language as the
  Agent registry's evo-health.svg but reduced to the cycle's essential form
  (no heart + ? overlay — those are the Critiquer/Sharpening-specific
  additions).  Renders crisply at 16-32 px.

  Composes with: DD-014 Thumbnail Reality + DD-012 No-Generic-Icon-Libraries
  + Tool Icon = Miniature of Display SUPREME.
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
    aria-label="Evo cycle — 9-step iterative delivery"
  >
    <!-- Cycle ring (violet — canonical Evo Step palette) -->
    <circle cx="12" cy="12" r="9" fill="none" stroke="#a78bfa" stroke-width="1.6"/>

    <!-- 9 step markers around the ring at evenly-spaced angles (-90° start) -->
    <g fill="#fbbf24">
      <circle cx="12"   cy="3"    r="1.2"/>
      <circle cx="17.8" cy="5.1"  r="1.2"/>
      <circle cx="20.7" cy="10.6" r="1.2"/>
      <circle cx="19.7" cy="16.8" r="1.2"/>
      <circle cx="15.1" cy="20.6" r="1.2"/>
      <circle cx="8.9"  cy="20.6" r="1.2"/>
      <circle cx="4.3"  cy="16.8" r="1.2"/>
      <circle cx="3.3"  cy="10.6" r="1.2"/>
      <circle cx="6.2"  cy="5.1"  r="1.2"/>
    </g>

    <!-- Direction arrow at top (clockwise) -->
    <polygon points="14.5,3.6 12,1.4 9.5,3.6 11,4.1 11,6 13,6 13,4.1" fill="#a78bfa"/>
  </svg>
</template>
