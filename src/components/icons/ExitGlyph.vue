<!--
  ExitGlyph.vue — the SEM App's Exit / Close glyph: `[->`.

  Notation reading:
    `[`   — left bracket: the surface, panel, or space you are INSIDE.
             Single bracket, not closed — the right side is the opening.
    `->`  — arrow pointing outward through the opening: you are exiting.

  Semantic: "I am leaving this container." Pure exit direction.
  Distinct from Get `[*]→*` (extracting content FROM a closed vessel) and
  Cancel `[*]→[ ]` (emptying a vessel in place). Exit says: the bracket IS
  the door; the arrow goes THROUGH it.

  Historical origin: Charles K. Bliss (1897-1985) invented Blissymbolics
  (Semantography) as a universal pictographic writing system. `[->` IS the
  internationally established Bliss symbol for exit — recognised worldwide.
  The ISO 7010 E001 "running man through door" exit sign used in airports
  encodes the same concept. Tom Gilb 2026-06-02:
  "This is a direct well known (airports etc) Blissymbolic for 'exit' I want
  to use this as my glyph for 'close'." The `[` is the surface you are inside;
  `->` is the exit direction. This is the international standard — we align with it.

  Family position:
    Save     `*→[*]`   — push content into a vessel
    Get      `[*]→*`   — pull content out of a vessel
    Copy     `[*]=[*]` — duplicate a vessel's contents
    Email    `[*]→@`   — transmit to an address
    Edit     `[*]→[**]`— transform vessel contents
    Cancel   `[*]→[ ]` — empty the vessel
    Priority `[A>B>C]` — order within a bounded envelope
    Open     `->]`     — enter / launch / open a surface
    EXIT     `[->`     — leave the current surface (Bliss international standard)

  Renders via `currentColor`. Three sizes:
    compact  — 44×20 viewBox (~20px rendered height, used inside CloseDot)
    standard — 56×24 viewBox (~24px rendered height, standalone buttons)
    large    — 76×32 viewBox (~32px rendered height, hero close affordances)

  DD-011 / DD-012 compliance: this IS a Planguage glyph. No import from any
  stock icon library. Stroke-only, currentColor, family-consistent geometry.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Exit — leave this surface". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Exit — leave this surface',
})
</script>

<template>
  <!-- ─── LARGE: 76×32, stroke 2.8 ─────────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 76 32"
    width="76"
    height="32"
    fill="none"
    stroke="currentColor"
    stroke-width="2.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- `[` — open left bracket (the surface you are inside; opening faces right) -->
    <polyline points="13,2 4,2 4,30 13,30" />
    <!-- `->` — exit arrow through the opening -->
    <line x1="20" y1="16" x2="62" y2="16" stroke-linecap="butt" />
    <polyline points="52,9 62,16 52,23" />
  </svg>

  <!-- ─── STANDARD: 56×24, stroke 2.2 ──────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 56 24"
    width="56"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- `[` — open left bracket -->
    <polyline points="9,1 2,1 2,23 9,23" />
    <!-- `->` — exit arrow -->
    <line x1="15" y1="12" x2="48" y2="12" stroke-linecap="butt" />
    <polyline points="40,7 48,12 40,17" />
  </svg>

  <!-- ─── COMPACT: 44×20, stroke 2.0 ───────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 44 20"
    width="44"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- `[` — open left bracket -->
    <polyline points="7,1 2,1 2,19 7,19" />
    <!-- `->` — exit arrow -->
    <line x1="12" y1="10" x2="38" y2="10" stroke-linecap="butt" />
    <polyline points="31,6 38,10 31,14" />
  </svg>
</template>
