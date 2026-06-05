<!--
  OptimaGlyph.vue — Planguage OPTIMA balance glyph

  Directly inspired by the OPTIMA book cover (Tom Gilb 2024):
  "A system of values and resources (dots) in reasonable balance"
  — Horizontal threshold lines (Stretch blue / Goal olive / Tolerable brown)
  — Green dots above Goal (values meeting target)
  — Yellow circle + red downward triangle (current state approaching Tolerable)

  Keyed form: no simple keyed form — this is a DIAGRAMMATIC glyph representing
  the Optima balance concept. International: dots + lines + universal colors.

  Semantic: "Multiple values measured against thresholds — optimize the balance
             so all reach Goal within resource constraints."

  DD-015: dots, lines, colors, universal symbols — no English letter abbreviations.
  DD-016: artistic glyph (not a keyed-character icon) — Tom-ratified diagrammatic family.

  Spec: OptimaGlyph 2026-06-05, inspired by Optima book cover.
  Reference: /Users/Tomgilbs/Documents/MyVault/.claude/glyph-preview.html
-->
<script setup lang="ts">
import { computed } from 'vue'
// UNIT_TYPE=Widget
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })

const dim = computed(() =>
  props.size === 'xl' ? 56 : props.size === 'lg' ? 44 : props.size === 'md' ? 32 : 20
)
</script>

<template>
  <!-- xl: 56×56  lg: 44×44  md: 32×32  sm: 20×20  (viewBox 48×48 square) -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="dim"
    :height="dim"
    fill="none"
    aria-label="Optima balance glyph — dots, threshold lines, yellow warning circle, red violation triangle"
    role="img"
  >
    <!-- Stretch line — blue (top target, aspirational) -->
    <line x1="4" y1="9" x2="44" y2="9" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="4 2" stroke-linecap="round" />
    <!-- Goal line — olive/amber (primary target) -->
    <line x1="4" y1="21" x2="44" y2="21" stroke="#ca8a04" stroke-width="2.2" stroke-linecap="round" />
    <!-- Tolerable line — dark brown (hard floor — DO NOT CROSS) -->
    <line x1="4" y1="34" x2="44" y2="34" stroke="#a16207" stroke-width="2.8" stroke-linecap="round" />

    <!-- Green dots above Goal (values meeting target — good!) -->
    <circle cx="9"  cy="14" r="3.5" fill="#16a34a" />
    <circle cx="18" cy="11" r="3.5" fill="#16a34a" />
    <circle cx="27" cy="15" r="3.5" fill="#16a34a" />

    <!-- Yellow warning circle — current value approaching Tolerable (book cover's key symbol) -->
    <circle cx="38" cy="27" r="5.5" fill="#facc15" />

    <!-- Red downward triangle — violation risk / below Tolerable (book cover's warning symbol) -->
    <polygon points="38,33 34,41 42,41" fill="#dc2626" />
  </svg>
</template>
