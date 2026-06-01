<!--
  EmailGlyph.vue — the SEM App's Email glyph: `[*] ---→ @`.
  Design discussion 2026-06-01. Final form: synthesis of two competing proposals.

  Notation: [*] ---→ @

  Semantics:
    Source vessel [*]: content to be sent (the specified thing).
    Dashed arrow ---→: non-instantaneous digital transmission across a network
      — multiple hops, not local, not instant. The dashes encode "longer travel,"
      Tom Gilb's framing: "the arrow symbolizing longer travel of a digital copy."
    @ destination: the canonical internet-era address mark (Ray Tomlinson 1971,
      ARPANET — chosen precisely because it means "user AT host/domain").
      NOT anachronistic: @ is the defining typographic mark of the digital age,
      on every keyboard, in every email address, universally readable across all
      languages and cultures. Carries semantic precision the vessel family alone
      cannot: the destination is an ADDRESS, not a container.

  Why @ beats [*] as the destination:
    The vessel-to-vessel form [*]---→[*] reads as "content moved to another
    container" — ambiguous (could be export, share, sync, duplicate-to-remote).
    The @ makes it EMAIL specifically and unambiguously. DD-003 principle:
    clarity of communication outranks classification tidiness. A borrowed symbol
    that communicates more precisely than a native one is correct Planguage.

  Why the dashes beat a solid arrow:
    Email is asynchronous, multi-hop, not instantaneous. The dashes encode that
    travel-across-network semantic. Copy [*]=[*] is instant and local (equals
    sign, no movement). The dashes are the visual tell: "not copy — sent."

  Full family reference:
    [*] = [*]     Copy    — duplicate; both vessels keep content (equals = same)
    [*] ---→ @    Email   — sent across network to an address             ← this
    *  →  [*]     Save    — push bare content into vessel (local)
    [*] →  *      Get     — pull content out of vessel
    [*] → [**]    Edit    — augment vessel contents in place
    [*] →  [ ]    Cancel  — empty the vessel entirely

  Renders via `currentColor`. Three sizes match the rest of the family.

  SVG construction:
    - stroke-dasharray on the ARROW LINE only (SVG does not inherit it, so
      the arrowhead <polyline> and the @ symbol remain solid — correct)
    - stroke-linecap="butt" on the dashed line for clean dash termination
    - Left-vessel bracket coordinates identical to CopyGlyph for visual alignment
    - @ drawn as: outer ring + inner 3/4-arc (gap top-right) + hook tail
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to semantics description. */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Email — vessel content transmitted across network to address',
})
</script>

<template>
  <!-- ── Large: 96×32, stroke 2.8 ───────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 96 32"
    width="96"
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
    <!-- Dashed arrow ---→ (dashes = network hops / longer digital travel) -->
    <line x1="48" y1="16" x2="61" y2="16"
          stroke-dasharray="5 3" stroke-linecap="butt" />
    <polyline points="53,9 61,16 53,23" />
    <!-- @ address mark: outer ring, inner 3/4-arc, hook tail -->
    <!-- Outer ring: center (79,16) r=11 -->
    <circle cx="79" cy="16" r="11" />
    <!-- Inner 3/4-arc: center (77,16) r=4 — gap opens at top-right for hook -->
    <path d="M77,12 A4,4 0 1,0 81,16" stroke-linecap="round" />
    <!-- Hook: inner-right → outer ring → drop -->
    <line x1="81" y1="16" x2="90" y2="16" />
    <line x1="90" y1="16" x2="90" y2="23" />
  </svg>

  <!-- ── Standard: 76×24, stroke 2.2 ───────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 76 24"
    width="76"
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
    <!-- Dashed arrow ---→ -->
    <line x1="34" y1="12" x2="47" y2="12"
          stroke-dasharray="3.5 2.5" stroke-linecap="butt" />
    <polyline points="41,7 47,12 41,17" />
    <!-- @ address mark: outer ring center (62,12) r=9 -->
    <circle cx="62" cy="12" r="9" />
    <!-- Inner 3/4-arc: center (60,12) r=3.5 -->
    <path d="M60,8.5 A3.5,3.5 0 1,0 63.5,12" stroke-linecap="round" />
    <!-- Hook -->
    <line x1="63.5" y1="12" x2="71" y2="12" />
    <line x1="71" y1="12" x2="71" y2="17" />
  </svg>

  <!-- ── Compact: 65×20, stroke 2.0 ─────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 65 20"
    width="65"
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
    <!-- Dashed arrow ---→ -->
    <line x1="29" y1="10" x2="40" y2="10"
          stroke-dasharray="3 2" stroke-linecap="butt" />
    <polyline points="36,6 40,10 36,14" />
    <!-- @ address mark: outer ring center (53,10) r=7.5 -->
    <circle cx="53" cy="10" r="7.5" />
    <!-- Inner 3/4-arc: center (51.5,10) r=3 -->
    <path d="M51.5,7 A3,3 0 1,0 54.5,10" stroke-linecap="round" />
    <!-- Hook -->
    <line x1="54.5" y1="10" x2="60.5" y2="10" />
    <line x1="60.5" y1="10" x2="60.5" y2="14.5" />
  </svg>
</template>
