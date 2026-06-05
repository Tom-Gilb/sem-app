<!--
  PlanGlyph.vue — Plan/Spec glyph: `[*+*+*]`.  Container of multiple spec entries.
  Drawn-≈-Keyed (DD-016): shape matches keyed form; colour enlivens.
  Palette: brackets slate-600 · asterisks colour-encoded by Planguage type
  — Value (violet) / Function (green) / Solution (orange) — to make the
  multi-type semantic visible · `+` slate-500.  Tom 2026-06-04: full names
  spelled out, "V/F/S" abbreviation banned (English-tied, S ambiguous
  between Stakeholder and Solution).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Plan — container of multiple spec entries',
})
</script>

<template>
  <!-- ── Large: 100×32 ──────────────────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 32" width="100" height="32" fill="none"
    stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="10,2 3,2 3,30 10,30" stroke="#475569" />
    <line x1="18" y1="8" x2="18" y2="24" stroke="#7c3aed" />
    <line x1="11.34" y1="20" x2="24.66" y2="12" stroke="#7c3aed" />
    <line x1="11.34" y1="12" x2="24.66" y2="20" stroke="#7c3aed" />
    <line x1="33" y1="11" x2="33" y2="21" stroke="#64748b" />
    <line x1="28" y1="16" x2="38" y2="16" stroke="#64748b" />
    <line x1="48" y1="8" x2="48" y2="24" stroke="#16a34a" />
    <line x1="41.34" y1="20" x2="54.66" y2="12" stroke="#16a34a" />
    <line x1="41.34" y1="12" x2="54.66" y2="20" stroke="#16a34a" />
    <line x1="63" y1="11" x2="63" y2="21" stroke="#64748b" />
    <line x1="58" y1="16" x2="68" y2="16" stroke="#64748b" />
    <line x1="78" y1="8" x2="78" y2="24" stroke="#ea580c" />
    <line x1="71.34" y1="20" x2="84.66" y2="12" stroke="#ea580c" />
    <line x1="71.34" y1="12" x2="84.66" y2="20" stroke="#ea580c" />
    <polyline points="89,2 96,2 96,30 89,30" stroke="#475569" />
  </svg>

  <!-- ── Standard: 72×24 ────────────────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 24" width="72" height="24" fill="none"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" stroke="#475569" />
    <line x1="13" y1="6" x2="13" y2="18" stroke="#7c3aed" />
    <line x1="8" y1="15" x2="18" y2="9" stroke="#7c3aed" />
    <line x1="8" y1="9" x2="18" y2="15" stroke="#7c3aed" />
    <line x1="24" y1="8" x2="24" y2="16" stroke="#64748b" />
    <line x1="20" y1="12" x2="28" y2="12" stroke="#64748b" />
    <line x1="34" y1="6" x2="34" y2="18" stroke="#16a34a" />
    <line x1="29" y1="15" x2="39" y2="9" stroke="#16a34a" />
    <line x1="29" y1="9" x2="39" y2="15" stroke="#16a34a" />
    <line x1="45" y1="8" x2="45" y2="16" stroke="#64748b" />
    <line x1="41" y1="12" x2="49" y2="12" stroke="#64748b" />
    <line x1="55" y1="6" x2="55" y2="18" stroke="#ea580c" />
    <line x1="50" y1="15" x2="60" y2="9" stroke="#ea580c" />
    <line x1="50" y1="9" x2="60" y2="15" stroke="#ea580c" />
    <polyline points="65,1 70,1 70,23 65,23" stroke="#475569" />
  </svg>

  <!-- ── Compact: 56×20 ─────────────────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 56 20" width="56" height="20" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="6,1 2,1 2,19 6,19" stroke="#475569" />
    <line x1="11" y1="5" x2="11" y2="15" stroke="#7c3aed" />
    <line x1="7" y1="13" x2="15" y2="7" stroke="#7c3aed" />
    <line x1="7" y1="7" x2="15" y2="13" stroke="#7c3aed" />
    <line x1="19" y1="6" x2="19" y2="14" stroke="#64748b" />
    <line x1="16" y1="10" x2="22" y2="10" stroke="#64748b" />
    <line x1="26" y1="5" x2="26" y2="15" stroke="#16a34a" />
    <line x1="22" y1="13" x2="30" y2="7" stroke="#16a34a" />
    <line x1="22" y1="7" x2="30" y2="13" stroke="#16a34a" />
    <line x1="34" y1="6" x2="34" y2="14" stroke="#64748b" />
    <line x1="31" y1="10" x2="37" y2="10" stroke="#64748b" />
    <line x1="41" y1="5" x2="41" y2="15" stroke="#ea580c" />
    <line x1="37" y1="13" x2="45" y2="7" stroke="#ea580c" />
    <line x1="37" y1="7" x2="45" y2="13" stroke="#ea580c" />
    <polyline points="50,1 54,1 54,19 50,19" stroke="#475569" />
  </svg>
</template>
