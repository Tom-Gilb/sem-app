<!--
  PlanArtsyGlyph.vue — Color Artsy Icon synonym for PlanGlyph (`[*+*+*]`).
  Three intertwined ribbons in Value (violet) / Function (green) / Solution
  (orange) colours converging on a central unification dot.  "Spec types
  unified into one plan."  Tom 2026-06-04: spell out the full names — "V/F/S"
  abbreviation is BANNED (English-tied, and S was ambiguous between
  Stakeholder and Solution).
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), { size: 'standard', ariaLabel: 'Plan — Value / Function / Solution ribbons unified (artsy synonym)'})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 28"
    :width="size === 'large' ? 108 : size === 'standard' ? 72 : 54"
    :height="size === 'large' ? 42 : size === 'standard' ? 28 : 21"
    fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <!-- Violet ribbon (Value) -->
    <path d="M 8 4 Q 28 12 8 24" stroke="#7c3aed" />
    <!-- Green ribbon (Function) -->
    <path d="M 36 4 Q 16 14 36 24" stroke="#16a34a" />
    <!-- Orange ribbon (Solution) -->
    <path d="M 64 4 Q 44 12 64 24" stroke="#ea580c" />
    <!-- Centre unification -->
    <circle cx="36" cy="14" r="3" fill="#fff" stroke="#475569" stroke-width="1.5" />
  </svg>
</template>
