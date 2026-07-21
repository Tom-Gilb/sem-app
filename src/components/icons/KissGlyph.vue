<!--
  KissGlyph.vue — KISS: Keep Improvement Super Surprising

  Concept: a central asterisk (the plan/spec — something improvable) with four
  outward arrows in different colors, each representing an unexpected direction
  of improvement. The glyph communicates "improvement radiating in all directions,
  each surprising."

  DD-015: no English letters — asterisk (universal Planguage data symbol) +
          directional arrows (universally understood). Zero Latin abbreviations.
  DD-016: Color Artsy Icon — colorful, energetic, multi-directional.
         Keyed reference concept: [*]→→→ (a spec with many improvement paths).

  Colour scheme:
    Orange (#ea580c)  — central asterisk = the spec being improved
    Violet (#7c3aed)  — upward arrow = quality improvement
    Cyan   (#0ea5e9)  — rightward arrow = efficiency improvement
    Emerald (#16a34a) — downward arrow = grounding, cost reduction
    Amber  (#ca8a04)  — leftward arrow = revisiting assumptions

  Spec: KissGlyph 2026-06-07.
-->
<script setup lang="ts">
import { computed } from 'vue'
// UNIT_TYPE=Widget
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'md' })

const px = computed(() =>
  props.size === 'xl' ? 56 : props.size === 'lg' ? 44 : props.size === 'md' ? 32 : 20,
)
</script>

<template>
  <!-- viewBox 0 0 48 48 — central asterisk, 4 directional arrows -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="KISS glyph — improvement radiating in surprising directions"
    role="img"
  >
    <!-- Central asterisk — orange (the spec/plan being improved) -->
    <!-- Vertical spoke -->
    <line x1="24" y1="14" x2="24" y2="34"
      stroke="#ea580c" stroke-width="2.8" stroke-linecap="round" />
    <!-- Diagonal spoke 1 -->
    <line x1="15" y1="19" x2="33" y2="29"
      stroke="#ea580c" stroke-width="2.8" stroke-linecap="round" />
    <!-- Diagonal spoke 2 -->
    <line x1="33" y1="19" x2="15" y2="29"
      stroke="#ea580c" stroke-width="2.8" stroke-linecap="round" />
    <!-- Centre dot — data point -->
    <circle cx="24" cy="24" r="3.5" fill="#ea580c" />

    <!-- Outward arrow — North (violet) — quality/aspiration direction -->
    <line x1="24" y1="10" x2="24" y2="5"  stroke="#7c3aed" stroke-width="2" stroke-linecap="round" />
    <polyline points="21,8 24,4 27,8"      stroke="#7c3aed" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Outward arrow — East (cyan) — efficiency direction -->
    <line x1="38" y1="24" x2="43" y2="24" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <polyline points="40,21 44,24 40,27"   stroke="#0ea5e9" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Outward arrow — South (emerald) — cost/grounding direction -->
    <line x1="24" y1="38" x2="24" y2="43" stroke="#16a34a" stroke-width="2" stroke-linecap="round" />
    <polyline points="21,40 24,44 27,40"   stroke="#16a34a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Outward arrow — West (amber) — revisiting assumptions direction -->
    <line x1="10" y1="24" x2="5"  y2="24" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" />
    <polyline points="8,21 4,24 8,27"      stroke="#ca8a04" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
