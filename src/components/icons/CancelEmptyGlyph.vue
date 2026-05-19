<!--
  CancelEmptyGlyph.vue — the SEM App's Cancel / Empty-the-vessel glyph: `[*]→[ ]`.

  Composed by Tom 2026-05-14 in response to the Fresh Start menu design ask:
  *"RE OPTION 2. No floppy icon use new save icon, Cancel symbol suggestion
  [*] -> [ ]"* — i.e. the Cancel/rollback action for "Cancel Recent Changes"
  gets its own keyed icon. The new glyph slots into the existing Bliss-Gilb
  keyed-icon family:

    *→[*]   Save     — push the wildcard INTO the vessel
    [*]→*   Get      — pull a copy OUT of the vessel back to live
    [*]→[ ] Cancel   — take the wildcard OUT, vessel ends empty
    [A>B>C] Priority — ordered ranking within a bounded envelope

  The empty destination brackets `[ ]` are load-bearing: the vessel is
  visually emptied, which is the exact semantic of "Cancel Recent Changes"
  — discard, leave empty, no replacement.

  Renders via `currentColor` so the parent decides ink colour.
  Three sizes match `SaveGlyph` / `GetGlyph` conventions:
    - compact  (~20px tall, 72×20 viewBox)
    - standard (~24px tall, 84×24 viewBox)
    - large    (~32px tall, 120×32 viewBox)

  Stroke weights and bracket geometry are copied verbatim from `SaveGlyph`
  so the family stays visually consistent — the only difference is that the
  destination vessel has no interior asterisk.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Cancel — empty the vessel". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Cancel — empty the vessel',
})
</script>

<template>
  <!-- Large: 120×32 viewBox, stroke 2.8 — mirrors SaveGlyph large layout. -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Source vessel `[*]` -->
    <polyline points="10,2 3,2 3,30 10,30" />
    <line x1="20" y1="6" x2="20" y2="26" />
    <line x1="11.34" y1="21" x2="28.66" y2="11" />
    <line x1="11.34" y1="11" x2="28.66" y2="21" />
    <polyline points="33,2 40,2 40,30 33,30" />
    <!-- Arrow -->
    <line x1="47" y1="16" x2="79" y2="16" stroke-linecap="butt" />
    <polyline points="69,9 79,16 69,23" />
    <!-- Destination vessel `[ ]` (empty — load-bearing) -->
    <polyline points="92,2 85,2 85,30 92,30" />
    <polyline points="110,2 117,2 117,30 110,30" />
  </svg>

  <!-- Standard: 84×24, stroke 2.2. -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 84 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Source vessel `[*]` -->
    <polyline points="7,1 2,1 2,23 7,23" />
    <line x1="15" y1="5" x2="15" y2="19" />
    <line x1="8.94" y1="15.5" x2="21.06" y2="8.5" />
    <line x1="8.94" y1="8.5" x2="21.06" y2="15.5" />
    <polyline points="23,1 28,1 28,23 23,23" />
    <!-- Arrow -->
    <line x1="33" y1="12" x2="55" y2="12" stroke-linecap="butt" />
    <polyline points="48,7 55,12 48,17" />
    <!-- Destination vessel `[ ]` (empty) -->
    <polyline points="65,1 60,1 60,23 65,23" />
    <polyline points="78,1 83,1 83,23 78,23" />
  </svg>

  <!-- Compact: 72×20, stroke 2. -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Source vessel `[*]` -->
    <polyline points="6,1 2,1 2,19 6,19" />
    <line x1="14" y1="4" x2="14" y2="16" />
    <line x1="8.8" y1="13" x2="19.2" y2="7" />
    <line x1="8.8" y1="7" x2="19.2" y2="13" />
    <polyline points="22,1 26,1 26,19 22,19" />
    <!-- Arrow -->
    <line x1="30" y1="10" x2="42" y2="10" stroke-linecap="butt" />
    <polyline points="38,6 42,10 38,14" />
    <!-- Destination vessel `[ ]` (empty) -->
    <polyline points="51,1 47,1 47,19 51,19" />
    <polyline points="67,1 71,1 71,19 67,19" />
  </svg>
</template>
