<!--
  ScribeGlyph.vue — Scribe glyph: `[ ]→[*]`.
  Drawn-≈-Keyed (DD-016): shape matches keyed form; colour enlivens.
  Palette: empty-vessel brackets slate-400 (lighter) · arrow slate-500 ·
  filled brackets slate-600 · `*` violet-600 (Value).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Scribe — empty vessel written into filled spec',
})
</script>

<template>
  <!-- ── Large: 124×32 ──────────────────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 124 32" width="124" height="32" fill="none"
    stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="10,2 3,2 3,30 10,30" stroke="#94a3b8" />
    <polyline points="28,2 35,2 35,30 28,30" stroke="#94a3b8" />
    <line x1="42" y1="16" x2="66" y2="16" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="57,9 66,16 57,23" stroke="#64748b" />
    <polyline points="79,2 72,2 72,30 79,30" stroke="#475569" />
    <polyline points="102,2 109,2 109,30 102,30" stroke="#475569" />
    <line x1="89" y1="6" x2="89" y2="26" stroke="#7c3aed" />
    <line x1="80.34" y1="21" x2="97.66" y2="11" stroke="#7c3aed" />
    <line x1="80.34" y1="11" x2="97.66" y2="21" stroke="#7c3aed" />
  </svg>

  <!-- ── Standard: 88×24 ────────────────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 88 24" width="88" height="24" fill="none"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" stroke="#94a3b8" />
    <polyline points="20,1 25,1 25,23 20,23" stroke="#94a3b8" />
    <line x1="30" y1="12" x2="48" y2="12" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="42,7 48,12 42,17" stroke="#64748b" />
    <polyline points="58,1 53,1 53,23 58,23" stroke="#475569" />
    <polyline points="73,1 78,1 78,23 73,23" stroke="#475569" />
    <line x1="65" y1="5" x2="65" y2="19" stroke="#7c3aed" />
    <line x1="58.94" y1="15.5" x2="71.06" y2="8.5" stroke="#7c3aed" />
    <line x1="58.94" y1="8.5" x2="71.06" y2="15.5" stroke="#7c3aed" />
  </svg>

  <!-- ── Compact: 72×20 ─────────────────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 20" width="72" height="20" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="6,1 2,1 2,19 6,19" stroke="#94a3b8" />
    <polyline points="16,1 20,1 20,19 16,19" stroke="#94a3b8" />
    <line x1="24" y1="10" x2="38" y2="10" stroke="#64748b" stroke-linecap="butt" />
    <polyline points="33,5 38,10 33,15" stroke="#64748b" />
    <polyline points="46,1 42,1 42,19 46,19" stroke="#475569" />
    <polyline points="59,1 63,1 63,19 59,19" stroke="#475569" />
    <line x1="52" y1="4" x2="52" y2="16" stroke="#7c3aed" />
    <line x1="46.94" y1="13" x2="57.06" y2="7" stroke="#7c3aed" />
    <line x1="46.94" y1="7" x2="57.06" y2="13" stroke="#7c3aed" />
  </svg>
</template>
