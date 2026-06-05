<!--
  OpenGlyph.vue — the SEM App's Open / Enter / Launch glyph: `->]`.

  Notation reading:
    `->`  — arrow pointing rightward (approach / entry direction)
    `]`   — right bracket: the surface, panel, or space you are ENTERING.
             Single bracket, open on the LEFT — the left opening IS the entry point.

  Semantic: "I am moving into this container." Pure entry direction.
  The precise OPPOSITE of ExitGlyph `[->` (Bliss international exit standard).

  `[->` = Exit (Bliss established symbol): you are INSIDE `[`, exiting rightward.
  `->]` = Open: you approach from OUTSIDE, entering through the left opening of `]`.
  The bracket position encodes the user's spatial relationship to the surface.

  Distinction from family members:
    Exit    `[->`    — YOU leave a surface (single left bracket, arrow exits right)
    Open    `->]`    — YOU enter / launch a surface (arrow points right, single right bracket)
    Get     `[*]→*`  — CONTENT is pulled OUT of a closed vessel (data movement, not navigation)
    Save    `*→[*]`  — CONTENT is pushed INTO a closed vessel (data movement, not navigation)

  The critical difference between Open and Get:
    Get = data extraction. The asterisk (content) moves; the vessel stays.
    Open = navigation. You move; the surface opens to receive you.
    "Open History Panel" → OpenGlyph. "Load a saved plan version" → GetGlyph.

  Historical origin: The "enter / come in" concept in Blissymbolics encodes
  movement into an enclosed space — the semantic inverse of Bliss exit.
  ISO directional entry signs (arrow pointing through an open doorway) encode
  the same concept. Tom Gilb 2026-06-02: "The opposite to close is open, as
  open a file or agent, by clicking a pin. The Planguage symbol, based on
  Semantography, Bliss, is ->]."

  Family position:
    Save     `*→[*]`   — push content into a vessel
    Get      `[*]→*`   — pull content out of a vessel
    Copy     `[*]=[*]` — duplicate a vessel's contents
    Email    `[*]→@`   — transmit to an address
    Edit     `[*]→[**]`— transform vessel contents
    Cancel   `[*]→[ ]` — empty the vessel
    Priority `[A>B>C]` — order within a bounded envelope
    Exit     `[->`     — leave the current surface
    OPEN     `->]`     — enter / launch / open a surface

  Color association (when used on coloured backgrounds):
    Emerald #059669 — universal "go / proceed / enter" signal.
    Opposite of ExitGlyph's red — green = proceed, red = stop.
    Distinct from Function green (#16a34a, lighter) and Resource dark-green (#166534).

  Renders via `currentColor`. Three sizes:
    compact  — 44×20 viewBox (~20px rendered height, use in small pin buttons)
    standard — 56×24 viewBox (~24px rendered height, default action buttons)
    large    — 76×32 viewBox (~32px rendered height, hero open affordances)

  DD-011 / DD-012 compliance: this IS a Planguage glyph. No import from any
  stock icon library. Stroke-only, currentColor, family-consistent geometry.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Open — enter this surface". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Open — enter this surface',
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
    <!-- `->` — entry arrow approaching the bracket -->
    <line x1="4" y1="16" x2="58" y2="16" stroke-linecap="butt" />
    <polyline points="48,9 58,16 48,23" />
    <!-- `]` — open right bracket (the surface being entered; opening faces left) -->
    <polyline points="63,2 72,2 72,30 63,30" />
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
    <!-- `->` — entry arrow approaching the bracket -->
    <line x1="2" y1="12" x2="42" y2="12" stroke-linecap="butt" />
    <polyline points="34,7 42,12 34,17" />
    <!-- `]` — open right bracket -->
    <polyline points="47,1 54,1 54,23 47,23" />
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
    <!-- `->` — entry arrow approaching the bracket -->
    <line x1="2" y1="10" x2="32" y2="10" stroke-linecap="butt" />
    <polyline points="25,6 32,10 25,14" />
    <!-- `]` — open right bracket -->
    <polyline points="37,1 42,1 42,19 37,19" />
  </svg>
</template>
