<!--
  SaveGlyph.vue — the SEM App's Save glyph: `* → [*]`.
  Decision DD-001 (2026-05-13). SVG paths are verbatim from
  `SVG FOR SAVE GET ICONS FOR SEM APP.pdf` in the asset bank, transcribed
  unchanged so every stroke matches the approved master.

  Renders via `currentColor` so the parent decides ink colour.
  Three sizes:
    - compact  ( ~20px tall, 72×20 viewBox )
    - standard ( ~24px tall, 84×24 viewBox )
    - large    ( ~32px tall, 120×32 viewBox )

  The glyph is naturally wide (~3.6:1) because it carries the full action,
  not a state. Width/height defaults follow the size; consumers may override
  via Tailwind classes on the parent or with the `class` attribute.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Save — asterisk into vessel". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Save — asterisk into vessel',
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
    <line x1="12" y1="6" x2="12" y2="26" />
    <line x1="3.34" y1="21" x2="20.66" y2="11" />
    <line x1="3.34" y1="11" x2="20.66" y2="21" />
    <line x1="31" y1="16" x2="63" y2="16" stroke-linecap="butt" />
    <polyline points="53,9 63,16 53,23" />
    <polyline points="84,2 77,2 77,30 84,30" />
    <line x1="97" y1="6" x2="97" y2="26" />
    <line x1="88.34" y1="21" x2="105.66" y2="11" />
    <line x1="88.34" y1="11" x2="105.66" y2="21" />
    <polyline points="110,2 117,2 117,30 110,30" />
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
    <line x1="9" y1="5" x2="9" y2="19" />
    <line x1="2.94" y1="15.5" x2="15.06" y2="8.5" />
    <line x1="2.94" y1="8.5" x2="15.06" y2="15.5" />
    <line x1="23" y1="12" x2="45" y2="12" stroke-linecap="butt" />
    <polyline points="38,7 45,12 38,17" />
    <polyline points="60,1 55,1 55,23 60,23" />
    <line x1="69" y1="5" x2="69" y2="19" />
    <line x1="62.94" y1="15.5" x2="75.06" y2="8.5" />
    <line x1="62.94" y1="8.5" x2="75.06" y2="15.5" />
    <polyline points="78,1 83,1 83,23 78,23" />
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
    <line x1="8" y1="4" x2="8" y2="16" />
    <line x1="2.8" y1="13" x2="13.2" y2="7" />
    <line x1="2.8" y1="7" x2="13.2" y2="13" />
    <line x1="19" y1="10" x2="38" y2="10" stroke-linecap="butt" />
    <polyline points="34,6 38,10 34,14" />
    <polyline points="51,1 47,1 47,19 51,19" />
    <line x1="59" y1="4" x2="59" y2="16" />
    <line x1="53.8" y1="13" x2="64.2" y2="7" />
    <line x1="53.8" y1="7" x2="64.2" y2="13" />
    <polyline points="67,1 71,1 71,19 67,19" />
  </svg>
</template>
