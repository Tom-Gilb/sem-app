<!--
  SpecStoryGlyph.vue — Spec-Story glyph: `[*] ← §`.
  Drawn-≈-Keyed (DD-016): shape matches keyed form; colour enlivens.
  Palette: brackets slate-600 · `*` violet-600 (Value) · arrow slate-500 ·
  `§` blue-600 (Stakeholder, hand-drawn serpentine path).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Spec Story — this spec, sourced from stakeholder',
})
</script>

<template>
  <!-- ── Large: 104×32 ──────────────────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 104 32" width="104" height="32" fill="none"
    stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="10,2 3,2 3,30 10,30" stroke="#475569" />
    <polyline points="33,2 40,2 40,30 33,30" stroke="#475569" />
    <line x1="20" y1="6" x2="20" y2="26" stroke="#7c3aed" />
    <line x1="11.34" y1="21" x2="28.66" y2="11" stroke="#7c3aed" />
    <line x1="11.34" y1="11" x2="28.66" y2="21" stroke="#7c3aed" />
    <line x1="48" y1="16" x2="72" y2="16" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="57,9 48,16 57,23" stroke="#64748b" />
    <path d="M 96 5 L 93 8 Q 87 4 81 8 Q 78 13 87 16 Q 96 19 93 24 Q 87 28 81 24 L 78 27"
      stroke="#2563eb" />
  </svg>

  <!-- ── Standard: 76×24 ────────────────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 76 24" width="76" height="24" fill="none"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" stroke="#475569" />
    <polyline points="23,1 28,1 28,23 23,23" stroke="#475569" />
    <line x1="15" y1="5" x2="15" y2="19" stroke="#7c3aed" />
    <line x1="8.94" y1="15.5" x2="21.06" y2="8.5" stroke="#7c3aed" />
    <line x1="8.94" y1="8.5" x2="21.06" y2="15.5" stroke="#7c3aed" />
    <line x1="34" y1="12" x2="52" y2="12" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="40,7 34,12 40,17" stroke="#64748b" />
    <path d="M 70 4 L 68 6 Q 64 3 60 6 Q 58 10 64 12 Q 70 14 68 18 Q 64 21 60 18 L 58 20"
      stroke="#2563eb" />
  </svg>

  <!-- ── Compact: 60×20 ─────────────────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 20" width="60" height="20" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="6,1 2,1 2,19 6,19" stroke="#475569" />
    <polyline points="20,1 24,1 24,19 20,19" stroke="#475569" />
    <line x1="13" y1="4" x2="13" y2="16" stroke="#7c3aed" />
    <line x1="7.94" y1="13" x2="18.06" y2="7" stroke="#7c3aed" />
    <line x1="7.94" y1="7" x2="18.06" y2="13" stroke="#7c3aed" />
    <line x1="28" y1="10" x2="42" y2="10" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="33,5 28,10 33,15" stroke="#64748b" />
    <path d="M 56 3 L 54 5 Q 51 2 48 5 Q 46 8 51 10 Q 56 12 54 15 Q 51 17 48 15 L 46 17"
      stroke="#2563eb" />
  </svg>
</template>
