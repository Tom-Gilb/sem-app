<!--
  GetGlyph.vue — the SEM App's Get glyph: `[*] → *`.
  Inverse of SaveGlyph. Decision DD-001 (2026-05-13). SVG paths verbatim from
  `SVG FOR SAVE GET ICONS FOR SEM APP.pdf` in the asset bank.

  Renders via `currentColor`. Three sizes (compact / standard / large).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Get — vessel into asterisk". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Get — vessel into asterisk',
})
</script>

<template>
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 32"
    width="120"
    height="32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <polyline points="10,2 3,2 3,30 10,30" />
    <line x1="23" y1="6" x2="23" y2="26" />
    <line x1="14.34" y1="21" x2="31.66" y2="11" />
    <line x1="14.34" y1="11" x2="31.66" y2="21" />
    <polyline points="36,2 43,2 43,30 36,30" />
    <line x1="57" y1="16" x2="89" y2="16" stroke-linecap="butt" />
    <polyline points="79,9 89,16 79,23" />
    <line x1="108" y1="6" x2="108" y2="26" />
    <line x1="99.34" y1="21" x2="116.66" y2="11" />
    <line x1="99.34" y1="11" x2="116.66" y2="21" />
  </svg>

  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 84 24"
    width="84"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" />
    <line x1="16" y1="5" x2="16" y2="19" />
    <line x1="9.94" y1="15.5" x2="22.06" y2="8.5" />
    <line x1="9.94" y1="8.5" x2="22.06" y2="15.5" />
    <polyline points="25,1 30,1 30,23 25,23" />
    <line x1="40" y1="12" x2="62" y2="12" stroke-linecap="butt" />
    <polyline points="55,7 62,12 55,17" />
    <line x1="76" y1="5" x2="76" y2="19" />
    <line x1="69.94" y1="15.5" x2="82.06" y2="8.5" />
    <line x1="69.94" y1="8.5" x2="82.06" y2="15.5" />
  </svg>

  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 20"
    width="72"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <polyline points="5,1 1,1 1,19 5,19" />
    <line x1="13" y1="4" x2="13" y2="16" />
    <line x1="7.8" y1="13" x2="18.2" y2="7" />
    <line x1="7.8" y1="7" x2="18.2" y2="13" />
    <polyline points="21,1 25,1 25,19 21,19" />
    <line x1="34" y1="10" x2="53" y2="10" stroke-linecap="butt" />
    <polyline points="49,6 53,10 49,14" />
    <line x1="64" y1="4" x2="64" y2="16" />
    <line x1="58.8" y1="13" x2="69.2" y2="7" />
    <line x1="58.8" y1="7" x2="69.2" y2="13" />
  </svg>
</template>
