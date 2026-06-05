<!--
  HistoryGlyph.vue — the SEM App's History glyph: `[*] → [*]`.

  Tom Gilb 2026-06-03: *"can we design a great glyph for history, Planguage
  or other, the clock is just not it.  it is a File [*] -> [*] filed"*

  Semantics: History IS the file-to-file restoration pattern.  Saved snapshot
  (left vessel) → working file (right vessel).  Distinct from GetGlyph
  (`[*] → *`, get-from-vessel-to-bare-asterisk) and SaveGlyph (`* → [*]`,
  save-asterisk-to-vessel).  History keeps the saved snapshot AND yields a
  live working copy — so BOTH sides bracketed.

  Renders via `currentColor`.  Three sizes (compact / standard / large).
  Asset bank lineage: derived from the Save / Get glyphs in the asset bank
  (`SVG FOR SAVE GET ICONS FOR SEM APP.pdf`) — same stroke / vessel / asterisk
  geometry, just with the right-side asterisk also bracketed.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "History — vessel to vessel". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'History — vessel to vessel',
})
</script>

<template>
  <!-- LARGE — 144×32 -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 144 32"
    width="144"
    height="32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Left vessel [*] -->
    <polyline points="10,2 3,2 3,30 10,30" />
    <line x1="23" y1="6" x2="23" y2="26" />
    <line x1="14.34" y1="21" x2="31.66" y2="11" />
    <line x1="14.34" y1="11" x2="31.66" y2="21" />
    <polyline points="36,2 43,2 43,30 36,30" />
    <!-- Arrow -->
    <line x1="57" y1="16" x2="89" y2="16" stroke-linecap="butt" />
    <polyline points="79,9 89,16 79,23" />
    <!-- Right vessel [*] -->
    <polyline points="101,2 94,2 94,30 101,30" />
    <line x1="114" y1="6" x2="114" y2="26" />
    <line x1="105.34" y1="21" x2="122.66" y2="11" />
    <line x1="105.34" y1="11" x2="122.66" y2="21" />
    <polyline points="127,2 134,2 134,30 127,30" />
  </svg>

  <!-- STANDARD — 100×24 -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 24"
    width="100"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Left vessel [*] -->
    <polyline points="7,1 2,1 2,23 7,23" />
    <line x1="16" y1="5" x2="16" y2="19" />
    <line x1="9.94" y1="15.5" x2="22.06" y2="8.5" />
    <line x1="9.94" y1="8.5" x2="22.06" y2="15.5" />
    <polyline points="25,1 30,1 30,23 25,23" />
    <!-- Arrow -->
    <line x1="40" y1="12" x2="62" y2="12" stroke-linecap="butt" />
    <polyline points="55,7 62,12 55,17" />
    <!-- Right vessel [*] -->
    <polyline points="71,1 66,1 66,23 71,23" />
    <line x1="80" y1="5" x2="80" y2="19" />
    <line x1="73.94" y1="15.5" x2="86.06" y2="8.5" />
    <line x1="73.94" y1="8.5" x2="86.06" y2="15.5" />
    <polyline points="89,1 94,1 94,23 89,23" />
  </svg>

  <!-- COMPACT — 84×20 -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 84 20"
    width="84"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Left vessel [*] -->
    <polyline points="5,1 1,1 1,19 5,19" />
    <line x1="13" y1="4" x2="13" y2="16" />
    <line x1="7.8" y1="13" x2="18.2" y2="7" />
    <line x1="7.8" y1="7" x2="18.2" y2="13" />
    <polyline points="21,1 25,1 25,19 21,19" />
    <!-- Arrow -->
    <line x1="34" y1="10" x2="53" y2="10" stroke-linecap="butt" />
    <polyline points="49,6 53,10 49,14" />
    <!-- Right vessel [*] -->
    <polyline points="59,1 55,1 55,19 59,19" />
    <line x1="67" y1="4" x2="67" y2="16" />
    <line x1="61.8" y1="13" x2="72.2" y2="7" />
    <line x1="61.8" y1="7" x2="72.2" y2="13" />
    <polyline points="75,1 79,1 79,19 75,19" />
  </svg>
</template>
