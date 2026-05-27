<!--
  PlFunctionIcon.vue — Planguage Function glyph: →O→
  Canonical colour: Green #16a34a ("good to go, capability active" — Kai Gilb)
  Multi-colour glyph (asymmetric — designed for dark backgrounds):
    Orange dashed arrows (left)  = resources / cost entering (consumed)
    Blue oval                    = the function / capability itself
    Cyan solid arrows (right)    = value out (produced, delivered)

  Grammar: →O→  — dash vs solid works in any single colour.
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16.
  Reference: /06 Demo Features/glyph-preview.html (FUNCTION card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!-- xl: 56×56  lg: 44×44  md: 32×32  (viewBox 48×48 square) -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="size === 'xl' ? 56 : size === 'lg' ? 44 : 32"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : 32"
    fill="none"
    aria-label="Function glyph — →O→"
    role="img"
  >
    <!-- Resource arrows IN — orange dashed (consumed) -->
    <line x1="2" y1="19" x2="13" y2="19"
      stroke="#f59e0b" stroke-width="2" stroke-dasharray="3.5 2.5" stroke-linecap="round" />
    <polyline points="10,16 14,19 10,22"
      stroke="#f59e0b" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="2" y1="29" x2="13" y2="29"
      stroke="#f59e0b" stroke-width="2" stroke-dasharray="3.5 2.5" stroke-linecap="round" />
    <polyline points="10,26 14,29 10,32"
      stroke="#f59e0b" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Oval — the function capability — blue -->
    <ellipse cx="24" cy="24" rx="10" ry="9"
      stroke="#2563eb" stroke-width="2.5" />
    <!-- Value arrows OUT — cyan solid (produced) -->
    <line x1="34" y1="19" x2="44" y2="19"
      stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
    <polyline points="41,16 45,19 41,22"
      stroke="#0ea5e9" stroke-width="2.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="34" y1="29" x2="44" y2="29"
      stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
    <polyline points="41,26 45,29 41,32"
      stroke="#0ea5e9" stroke-width="2.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
