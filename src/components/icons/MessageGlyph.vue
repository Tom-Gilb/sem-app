<!--
  MessageGlyph.vue — the SEM App's Message glyph: `[*]→~`.
  Tom Gilb Planguage keyed-icon for the "send as message / SMS / iMessage" action.

  Semantics:
    "Vessel sends its content through an informal/instant channel."
    The `~` (tilde) is the universal math/logic symbol for "approximately" and
    informally a wave — it encodes the informal, quick, conversational nature of
    messaging (SMS / iMessage / chat) as distinct from formal email (`@`).
    The `→` is the directional transfer, consistent with all other family members.
    Together: vessel-content leaves toward a quick informal channel.

  DD-015 (International Icons) compliant: `~` is a universal symbol on every
  keyboard in every locale, with no English-language encoding. Not a letter,
  not a flag, not a culturally-specific mark.

  Distinct from:
    *  → [*]   Save    — push INTO vessel (origin is bare asterisk)
    [*] → *    Get     — pull OUT of vessel (destination is bare asterisk)
    [*] = [*]  Copy    — duplicate to clipboard (both vessels hold asterisk)
    [*] → @    Email   — send to remote named address (mail protocol)
    [*] → ~    Message — send through informal/instant channel  ← this

  Renders via `currentColor`. Three sizes match the rest of the family.
  The `~` is drawn as a two-peak S-curve tilde wave (bezier path).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to "Message — send vessel content via instant channel". */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Message — send vessel content via instant channel',
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
    <line x1="48" y1="16" x2="63" y2="16" stroke-linecap="butt" />
    <polyline points="57,10 63,16 57,22" />
    <!-- ~ tilde wave: two-peak S-curve, midline=16 -->
    <path d="M 68,22 C 72,8 76,8 80,16 C 84,24 88,24 92,10" />
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
    <line x1="33" y1="12" x2="48" y2="12" stroke-linecap="butt" />
    <polyline points="42,7 48,12 42,17" />
    <!-- ~ tilde wave: two-peak S-curve, midline=12 -->
    <path d="M 53,17 C 56,6 59,6 62,12 C 65,18 68,18 71,7" />
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
    <line x1="28" y1="10" x2="40" y2="10" stroke-linecap="butt" />
    <polyline points="35,6 40,10 35,14" />
    <!-- ~ tilde wave: two-peak S-curve, midline=10 -->
    <path d="M 44,14 C 47,5 50,5 53,10 C 56,15 59,15 62,6" />
  </svg>
</template>
