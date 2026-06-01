<!--
  PlSolutionIcon.vue — Planguage Solution glyph: [*]→
  Canonical colour: Orange #ea580c ("creative design means, warm and distinct")
  Multi-colour glyph:
    Orange brackets [ ]   = acceptable constraints (medium weight — context, not primary)
    Purple asterisk *     = the design idea / candidate solution data
    Cyan arrow →          = leads toward value delivery

  Grammar: [*]→  — medium-weight bracket (vs bold for Constraint) signals "context."
  Full reading: [*]→→O→  (a constrained idea that leads to functional value delivery).
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16.
  Reference: /06 Demo Features/glyph-preview.html (SOLUTION card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!-- xl: 56×56  lg: 44×44  md: 32×32  (viewBox 48×48) -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="48"
    height="48"
    :width="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    fill="none"
    aria-label="Solution glyph — [*]→"
    role="img"
  >
    <!-- Left bracket — orange, medium weight (2px, not bold 3.5px) -->
    <path d="M 9,8 L 4,8 L 4,40 L 9,40"
      stroke="#f59e0b" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Asterisk — purple (creative design idea) -->
    <!-- Horizontal spoke -->
    <line x1="10" y1="24" x2="24" y2="24"
      stroke="#9333ea" stroke-width="2" stroke-linecap="round" />
    <!-- 60° diagonal -->
    <line x1="20.5" y1="18" x2="13.5" y2="30"
      stroke="#9333ea" stroke-width="2" stroke-linecap="round" />
    <!-- 120° diagonal -->
    <line x1="13.5" y1="18" x2="20.5" y2="30"
      stroke="#9333ea" stroke-width="2" stroke-linecap="round" />
    <!-- Centre data-point dot -->
    <circle cx="17" cy="24" r="2.5" fill="#9333ea" />
    <!-- Right bracket — orange, medium weight -->
    <path d="M 25,8 L 30,8 L 30,40 L 25,40"
      stroke="#f59e0b" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Arrow toward value delivery — cyan -->
    <line x1="32" y1="24" x2="40" y2="24"
      stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
    <polyline points="37,19 43,24 37,29"
      stroke="#0ea5e9" stroke-width="2.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
