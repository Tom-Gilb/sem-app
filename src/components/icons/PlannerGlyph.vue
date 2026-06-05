<!--
  PlannerGlyph.vue — Planner glyph: `[?]→[*]`.
  Drawn-≈-Keyed (DD-016): shape matches keyed form; colour enlivens.
  Palette: brackets slate-600 · `?` amber-600 (Evo-Step, exploration) ·
  arrow slate-500 · `*` violet-600 (Value).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Planner — questions transformed into spec',
})
</script>

<template>
  <!-- ── Large: 128×32 ──────────────────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 128 32" width="128" height="32" fill="none"
    stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="10,2 3,2 3,30 10,30" stroke="#475569" />
    <polyline points="30,2 37,2 37,30 30,30" stroke="#475569" />
    <path d="M 15 9 Q 15 4 20 4 Q 25 4 25 9 Q 25 13 20 16 L 20 20" stroke="#d97706" />
    <circle cx="20" cy="26" r="2" fill="#d97706" stroke="none" />
    <line x1="44" y1="16" x2="68" y2="16" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="59,9 68,16 59,23" stroke="#64748b" />
    <polyline points="81,2 74,2 74,30 81,30" stroke="#475569" />
    <polyline points="104,2 111,2 111,30 104,30" stroke="#475569" />
    <line x1="91" y1="6" x2="91" y2="26" stroke="#7c3aed" />
    <line x1="82.34" y1="21" x2="99.66" y2="11" stroke="#7c3aed" />
    <line x1="82.34" y1="11" x2="99.66" y2="21" stroke="#7c3aed" />
  </svg>

  <!-- ── Standard: 92×24 ────────────────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 92 24" width="92" height="24" fill="none"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" stroke="#475569" />
    <polyline points="23,1 28,1 28,23 23,23" stroke="#475569" />
    <path d="M 11 7 Q 11 3 15 3 Q 19 3 19 7 Q 19 10 15 12 L 15 15" stroke="#d97706" />
    <circle cx="15" cy="20" r="1.6" fill="#d97706" stroke="none" />
    <line x1="33" y1="12" x2="50" y2="12" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="44,7 50,12 44,17" stroke="#64748b" />
    <polyline points="60,1 55,1 55,23 60,23" stroke="#475569" />
    <polyline points="75,1 80,1 80,23 75,23" stroke="#475569" />
    <line x1="67" y1="5" x2="67" y2="19" stroke="#7c3aed" />
    <line x1="60.94" y1="15.5" x2="73.06" y2="8.5" stroke="#7c3aed" />
    <line x1="60.94" y1="8.5" x2="73.06" y2="15.5" stroke="#7c3aed" />
  </svg>

  <!-- ── Compact: 76×20 ─────────────────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 76 20" width="76" height="20" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="6,1 2,1 2,19 6,19" stroke="#475569" />
    <polyline points="18,1 22,1 22,19 18,19" stroke="#475569" />
    <path d="M 9 6 Q 9 3 12 3 Q 15 3 15 6 Q 15 9 12 11 L 12 13" stroke="#d97706" />
    <circle cx="12" cy="17" r="1.3" fill="#d97706" stroke="none" />
    <line x1="26" y1="10" x2="40" y2="10" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="35,5 40,10 35,15" stroke="#64748b" />
    <polyline points="48,1 44,1 44,19 48,19" stroke="#475569" />
    <polyline points="61,1 65,1 65,19 61,19" stroke="#475569" />
    <line x1="54" y1="4" x2="54" y2="16" stroke="#7c3aed" />
    <line x1="48.94" y1="13" x2="59.06" y2="7" stroke="#7c3aed" />
    <line x1="48.94" y1="7" x2="59.06" y2="13" stroke="#7c3aed" />
  </svg>
</template>
