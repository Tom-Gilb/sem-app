<!--
  PlValueIcon.vue — Planguage Value glyph: O--*-->
  Canonical colour: Violet #7c3aed ("royal, worth, benefit" — Kai Gilb)
  Multi-colour glyph (designed for dark backgrounds):
    Blue circle  = source Function (the function that IS measured)
    Cyan line    = scale axis (the measurement dimension)
    Cyan asterisk = data point (any useful set of data, Planguage *)
    Cyan arrow   = delivery direction (value flows outward)

  Grammar: 0--*--> (source Function · scale axis · data · delivery arrow)
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16, Tom+Kai Gilb+Claudian.
  Reference: /06 Demo Features/glyph-preview.html (VALUE card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!-- xl: 56×56  lg: 44×44  md: 32×32  (viewBox 48×48 square) -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="48"
    height="48"
    :width="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    fill="none"
    aria-label="Value glyph — O--*-->"
    role="img"
  >
    <!-- Source Function circle — blue: it IS a Function -->
    <circle cx="6" cy="24" r="5" stroke="#2563eb" stroke-width="2" />
    <!-- Scale axis -->
    <line x1="11" y1="24" x2="34" y2="24"
      stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
    <!-- Asterisk diagonals — data in any useful form -->
    <line x1="26" y1="16" x2="18" y2="32"
      stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <line x1="18" y1="16" x2="26" y2="32"
      stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <!-- Data-instance dot -->
    <circle cx="22" cy="24" r="3" fill="#0ea5e9" />
    <!-- Arrowhead — value delivery direction -->
    <polyline points="30,18 37,24 30,30"
      stroke="#0ea5e9" stroke-width="2.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
