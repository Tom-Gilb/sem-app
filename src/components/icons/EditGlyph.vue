<!--
  EditGlyph.vue — the SEM App's Edit glyph: `[*] → [**]`.
  Tom Gilb 2026-05-15: "[*] -> [**]".

  Semantics: the vessel already holds content (the current asterisk). Edit does
  not remove it — it transforms it in place. The destination vessel shows TWO
  asterisks: the original plus the edit mark. The vessel stays full; the
  contents are augmented. Distinct from:
    * → [*]   Save   — push INTO vessel (was outside)
    [*] → *   Get    — pull OUT of vessel (now outside)
    [*] → [ ] Cancel — empty the vessel entirely
    [*] → [**] Edit  — transform / augment what is already inside

  The destination bracket is intentionally wider than the source — it holds
  MORE than it started with. This is the visual tell: editing adds mark.

  Renders via `currentColor` so the parent decides ink colour.
  Three sizes match the rest of the family:
    compact  (~20px tall, 88×20  viewBox, stroke 2.0)
    standard (~24px tall, 108×24 viewBox, stroke 2.2)
    large    (~32px tall, 152×32 viewBox, stroke 2.8)
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to description of the edit semantics. */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Edit — transform vessel contents',
})
</script>

<template>
  <!-- ── Large: 152×32, stroke 2.8 ──────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 152 32"
    width="152"
    height="32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Source vessel [*] -->
    <polyline points="10,2 3,2 3,30 10,30" />
    <line x1="20" y1="6" x2="20" y2="26" />
    <line x1="11.34" y1="21" x2="28.66" y2="11" />
    <line x1="11.34" y1="11" x2="28.66" y2="21" />
    <polyline points="33,2 40,2 40,30 33,30" />
    <!-- Arrow → -->
    <line x1="47" y1="16" x2="69" y2="16" stroke-linecap="butt" />
    <polyline points="60,9 69,16 60,23" />
    <!-- Destination vessel [**] — wider than source -->
    <polyline points="82,2 75,2 75,30 82,30" />
    <!-- First asterisk, centre (93, 16) -->
    <line x1="93" y1="7" x2="93" y2="25" />
    <line x1="84.34" y1="21" x2="101.66" y2="11" />
    <line x1="84.34" y1="11" x2="101.66" y2="21" />
    <!-- Second asterisk, centre (115, 16) -->
    <line x1="115" y1="7" x2="115" y2="25" />
    <line x1="106.34" y1="21" x2="123.66" y2="11" />
    <line x1="106.34" y1="11" x2="123.66" y2="21" />
    <polyline points="131,2 138,2 138,30 131,30" />
  </svg>

  <!-- ── Standard: 108×24, stroke 2.2 ───────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 108 24"
    width="108"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Source vessel [*] -->
    <polyline points="7,1 2,1 2,23 7,23" />
    <line x1="15" y1="5" x2="15" y2="19" />
    <line x1="8.94" y1="15.5" x2="21.06" y2="8.5" />
    <line x1="8.94" y1="8.5" x2="21.06" y2="15.5" />
    <polyline points="23,1 28,1 28,23 23,23" />
    <!-- Arrow → -->
    <line x1="33" y1="12" x2="50" y2="12" stroke-linecap="butt" />
    <polyline points="44,7 50,12 44,17" />
    <!-- Destination vessel [**] -->
    <polyline points="60,1 55,1 55,23 60,23" />
    <!-- First asterisk, centre (69, 12) -->
    <line x1="69" y1="5" x2="69" y2="19" />
    <line x1="63.2" y1="15.5" x2="74.8" y2="8.5" />
    <line x1="63.2" y1="8.5" x2="74.8" y2="15.5" />
    <!-- Second asterisk, centre (83, 12) -->
    <line x1="83" y1="5" x2="83" y2="19" />
    <line x1="77.2" y1="15.5" x2="88.8" y2="8.5" />
    <line x1="77.2" y1="8.5" x2="88.8" y2="15.5" />
    <polyline points="96,1 101,1 101,23 96,23" />
  </svg>

  <!-- ── Compact: 88×20, stroke 2.0 ─────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 88 20"
    width="88"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Source vessel [*] -->
    <polyline points="6,1 2,1 2,19 6,19" />
    <line x1="14" y1="4" x2="14" y2="16" />
    <line x1="8.8" y1="13" x2="19.2" y2="7" />
    <line x1="8.8" y1="7" x2="19.2" y2="13" />
    <polyline points="22,1 26,1 26,19 22,19" />
    <!-- Arrow → -->
    <line x1="30" y1="10" x2="42" y2="10" stroke-linecap="butt" />
    <polyline points="38,6 42,10 38,14" />
    <!-- Destination vessel [**] -->
    <polyline points="51,1 47,1 47,19 51,19" />
    <!-- First asterisk, centre (59, 10) -->
    <line x1="59" y1="4" x2="59" y2="16" />
    <line x1="53.8" y1="13" x2="64.2" y2="7" />
    <line x1="53.8" y1="7" x2="64.2" y2="13" />
    <!-- Second asterisk, centre (70, 10) -->
    <line x1="70" y1="4" x2="70" y2="16" />
    <line x1="64.8" y1="13" x2="75.2" y2="7" />
    <line x1="64.8" y1="7" x2="75.2" y2="13" />
    <polyline points="82,1 86,1 86,19 82,19" />
  </svg>
</template>
