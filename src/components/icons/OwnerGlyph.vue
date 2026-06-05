<!--
  OwnerGlyph.vue — the SEM App's Owner glyph: `[*]!`.
  Drawn-≈-Keyed (DD-016): SHAPE matches the keyed `[*]!` element-by-element;
  colour enlivens (Tom 2026-06-04: *"I am not against color... it is still
  the same shape people learn, do not go black and white"*).
  Palette: brackets slate-600, asterisk violet-600 (Value), exclamation
  red-600 (Constraint = authority).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Owner — authoritative spec',
})
</script>

<template>
  <!-- ── Large: 88×32, stroke 2.8 ───────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 88 32" width="88" height="32" fill="none"
    stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="10,2 3,2 3,30 10,30" stroke="#475569" />
    <polyline points="33,2 40,2 40,30 33,30" stroke="#475569" />
    <line x1="20" y1="6" x2="20" y2="26" stroke="#7c3aed" />
    <line x1="11.34" y1="21" x2="28.66" y2="11" stroke="#7c3aed" />
    <line x1="11.34" y1="11" x2="28.66" y2="21" stroke="#7c3aed" />
    <line x1="58" y1="6" x2="58" y2="20" stroke="#dc2626" />
    <circle cx="58" cy="26" r="2" fill="#dc2626" stroke="none" />
  </svg>

  <!-- ── Standard: 64×24, stroke 2.2 ────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 24" width="64" height="24" fill="none"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" stroke="#475569" />
    <polyline points="23,1 28,1 28,23 23,23" stroke="#475569" />
    <line x1="15" y1="5" x2="15" y2="19" stroke="#7c3aed" />
    <line x1="8.94" y1="15.5" x2="21.06" y2="8.5" stroke="#7c3aed" />
    <line x1="8.94" y1="8.5" x2="21.06" y2="15.5" stroke="#7c3aed" />
    <line x1="42" y1="4" x2="42" y2="15" stroke="#dc2626" />
    <circle cx="42" cy="20" r="1.6" fill="#dc2626" stroke="none" />
  </svg>

  <!-- ── Compact: 50×20, stroke 1.8 ─────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 50 20" width="50" height="20" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="6,1 2,1 2,19 6,19" stroke="#475569" />
    <polyline points="20,1 24,1 24,19 20,19" stroke="#475569" />
    <line x1="13" y1="4" x2="13" y2="16" stroke="#7c3aed" />
    <line x1="7.94" y1="13" x2="18.06" y2="7" stroke="#7c3aed" />
    <line x1="7.94" y1="7" x2="18.06" y2="13" stroke="#7c3aed" />
    <line x1="34" y1="3" x2="34" y2="13" stroke="#dc2626" />
    <circle cx="34" cy="17" r="1.3" fill="#dc2626" stroke="none" />
  </svg>
</template>
