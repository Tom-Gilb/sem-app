<!--
  CopyGlyph.vue — the SEM App's Copy glyph: `[*]=[*]`.
  Tom Gilb 2026-05-29: Planguage keyed-icon family member for copy/clipboard.

  Semantics:
    The two vessels hold identical asterisks connected by the equals mark.
    `=` means "same content in both" — the left vessel's content is mirrored
    into the right (clipboard). Unlike Get `[*]→*` (pull OUT) or Save `*→[*]`
    (push IN), the = sign shows duplication-in-place: both vessels keep their
    content after the operation. This is the visual tell for copy vs. move.

  Distinct from:
    *  → [*]   Save   — push INTO vessel (source empties)
    [*] → *    Get    — pull OUT of vessel (vessel empties)
    [*] → [ ]  Cancel — empty the vessel entirely
    [*] → [**] Edit   — augment vessel contents
    [*] = [*]  Copy   — duplicate: both vessels hold the same asterisk  ← this

  Renders via `currentColor` so the parent decides ink colour (e.g. teal for
  copy actions, matching the teal-to-emerald palette used for clipboard ops).
  Three sizes match the rest of the family.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Copy — duplicate vessel contents". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Copy — duplicate vessel contents',
})
</script>

<template>
  <!-- ── Large: 116×32, stroke 2.8 ──────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 116 32"
    width="116"
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
    <!-- Equals sign = -->
    <line x1="50" y1="10" x2="66" y2="10" />
    <line x1="50" y1="22" x2="66" y2="22" />
    <!-- Right vessel [*] -->
    <polyline points="80,2 73,2 73,30 80,30" />
    <line x1="93" y1="6" x2="93" y2="26" />
    <line x1="84.34" y1="21" x2="101.66" y2="11" />
    <line x1="84.34" y1="11" x2="101.66" y2="21" />
    <polyline points="106,2 113,2 113,30 106,30" />
  </svg>

  <!-- ── Standard: 84×24, stroke 2.2 ───────────────────────────────────── -->
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
    <!-- Left vessel [*] -->
    <polyline points="7,1 2,1 2,23 7,23" />
    <line x1="16" y1="5" x2="16" y2="19" />
    <line x1="9.94" y1="15.5" x2="22.06" y2="8.5" />
    <line x1="9.94" y1="8.5" x2="22.06" y2="15.5" />
    <polyline points="25,1 30,1 30,23 25,23" />
    <!-- Equals sign = -->
    <line x1="35" y1="8" x2="49" y2="8" />
    <line x1="35" y1="16" x2="49" y2="16" />
    <!-- Right vessel [*] -->
    <polyline points="59,1 54,1 54,23 59,23" />
    <line x1="68" y1="5" x2="68" y2="19" />
    <line x1="61.94" y1="15.5" x2="74.06" y2="8.5" />
    <line x1="61.94" y1="8.5" x2="74.06" y2="15.5" />
    <polyline points="77,1 82,1 82,23 77,23" />
  </svg>

  <!-- ── Compact: 72×20, stroke 2.0 ─────────────────────────────────────── -->
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
    <!-- Left vessel [*] -->
    <polyline points="5,1 1,1 1,19 5,19" />
    <line x1="13" y1="4" x2="13" y2="16" />
    <line x1="7.8" y1="13" x2="18.2" y2="7" />
    <line x1="7.8" y1="7" x2="18.2" y2="13" />
    <polyline points="21,1 25,1 25,19 21,19" />
    <!-- Equals sign = -->
    <line x1="29" y1="7" x2="41" y2="7" />
    <line x1="29" y1="13" x2="41" y2="13" />
    <!-- Right vessel [*] -->
    <polyline points="50,1 46,1 46,19 50,19" />
    <line x1="58" y1="4" x2="58" y2="16" />
    <line x1="52.8" y1="13" x2="63.2" y2="7" />
    <line x1="52.8" y1="7" x2="63.2" y2="13" />
    <polyline points="66,1 70,1 70,19 66,19" />
  </svg>
</template>
