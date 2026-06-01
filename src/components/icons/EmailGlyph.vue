<!--
  EmailGlyph.vue — the SEM App's Email glyph: `[*]→@`.
  Tom Gilb 2026-05-29: new Planguage keyed-icon for the "email" action.

  Semantics:
    "Vessel sends its content to an address."
    The `@` is the internet-era universal recipient mark — Ray Tomlinson 1971,
    ARPANET: "user AT host/domain." Present on every keyboard, in every email
    address globally. Not anachronistic — it is the defining typographic mark
    of digital communication. The `→` is the directional transfer, as in all
    other family members. Together: vessel-content leaves toward a named address
    in the network.

  Design decision 2026-06-01 (after discussion):
    Three options considered — `[*]→@` (A), `[*]---→[*]` (B), `[*]---→@` (C).
    Tom chose A. The @ is strong enough on its own; the solid arrow is clean
    and consistent with Save/Get/Edit. The @ uniquely identifies email; no
    dashes needed.

  Distinct from:
    *  → [*]   Save   — push INTO vessel (origin is bare asterisk)
    [*] → *    Get    — pull OUT of vessel (destination is bare asterisk)
    [*] = [*]  Copy   — duplicate to clipboard (both vessels hold the asterisk)
    [*] → @    Email  — send to remote address    ← this

  Renders via `currentColor`. Three sizes match the rest of the family.
  The @ is drawn as: outer ring + inner 3/4 arc (the "a" body) + hook tail
  exiting right, then curving down — recognisable as @ at all three sizes.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Email — send vessel content to address". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Email — send vessel content to address',
})
</script>

<template>
  <!-- ── Large: 100×32, stroke 2.8 ──────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 32"
    width="100"
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
    <line x1="23" y1="6" x2="23" y2="26" />
    <line x1="14.34" y1="21" x2="31.66" y2="11" />
    <line x1="14.34" y1="11" x2="31.66" y2="21" />
    <polyline points="36,2 43,2 43,30 36,30" />
    <!-- Arrow → -->
    <line x1="48" y1="16" x2="66" y2="16" stroke-linecap="butt" />
    <polyline points="58,9 66,16 58,23" />
    <!-- @ symbol: outer ring + inner 3/4 arc + hook tail -->
    <!-- Outer ring, center (80,16), r=12 -->
    <circle cx="80" cy="16" r="12" />
    <!-- Inner arc: center (78,16), r=4.5 — 3/4 circle, gap at top-right -->
    <path d="M78,11.5 A4.5,4.5 0 1,0 82.5,16" stroke-linecap="round" />
    <!-- Hook: inner-right → outer-right → drop -->
    <line x1="82.5" y1="16" x2="92" y2="16" />
    <line x1="92" y1="16" x2="92" y2="24" />
  </svg>

  <!-- ── Standard: 80×24, stroke 2.2 ───────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 80 24"
    width="80"
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
    <line x1="16" y1="5" x2="16" y2="19" />
    <line x1="9.94" y1="15.5" x2="22.06" y2="8.5" />
    <line x1="9.94" y1="8.5" x2="22.06" y2="15.5" />
    <polyline points="25,1 30,1 30,23 25,23" />
    <!-- Arrow → -->
    <line x1="33" y1="12" x2="50" y2="12" stroke-linecap="butt" />
    <polyline points="44,7 50,12 44,17" />
    <!-- @ symbol: outer ring + inner 3/4 arc + hook tail -->
    <!-- Outer ring, center (63,12), r=9 -->
    <circle cx="63" cy="12" r="9" />
    <!-- Inner arc: center (61,12), r=3.5 — 3/4 circle, gap at top-right -->
    <path d="M61,8.5 A3.5,3.5 0 1,0 64.5,12" stroke-linecap="round" />
    <!-- Hook: inner-right → outer-right → drop -->
    <line x1="64.5" y1="12" x2="72" y2="12" />
    <line x1="72" y1="12" x2="72" y2="18" />
  </svg>

  <!-- ── Compact: 67×20, stroke 2.0 ─────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 67 20"
    width="67"
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
    <polyline points="5,1 1,1 1,19 5,19" />
    <line x1="13" y1="4" x2="13" y2="16" />
    <line x1="7.8" y1="13" x2="18.2" y2="7" />
    <line x1="7.8" y1="7" x2="18.2" y2="13" />
    <polyline points="21,1 25,1 25,19 21,19" />
    <!-- Arrow → -->
    <line x1="29" y1="10" x2="42" y2="10" stroke-linecap="butt" />
    <polyline points="37,6 42,10 37,14" />
    <!-- @ symbol: outer ring + inner 3/4 arc + hook tail -->
    <!-- Outer ring, center (53,10), r=7.5 -->
    <circle cx="53" cy="10" r="7.5" />
    <!-- Inner arc: center (51.5,10), r=3 — 3/4 circle, gap at top-right -->
    <path d="M51.5,7 A3,3 0 1,0 54.5,10" stroke-linecap="round" />
    <!-- Hook: inner-right → outer-right → drop -->
    <line x1="54.5" y1="10" x2="61" y2="10" />
    <line x1="61" y1="10" x2="61" y2="15" />
  </svg>
</template>
