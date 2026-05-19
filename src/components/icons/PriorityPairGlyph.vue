<!--
  PriorityPairGlyph.vue — the compact pairwise fallback for the Priority
  keyed icon: `[A>B]`. Decision DD-002 (2026-05-13). Used ONLY where the
  triple form `[A>B>C]` (PriorityTripleGlyph.vue) genuinely cannot fit.
  Semantically the triple is canonical; this pair is a typographic
  abbreviation, like SaveGlyph's compact size relative to its standard.

  Geometry is the approved master P3 (`5 - Project/SEM App/assets/
  PRIORITY ICON INVENTION/variants-2026-05-13/P3-BracketedKeyed.svg`).

  Per Tom's 2026-05-13 scope-down ruling, `>` family only. The brackets
  carry the same bounded-system-validity envelope as in the triple form.

  Renders via `currentColor`. Three sizes match PriorityTripleGlyph's API.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Priority: A outranks B, within the bounded system',
})
</script>

<template>
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 168 48"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <g stroke-width="7">
      <polyline points="22,7 12,7 12,41 22,41" />
    </g>
    <g stroke-width="6">
      <line x1="36" y1="38" x2="48" y2="10" />
      <line x1="48" y1="10" x2="60" y2="38" />
      <line x1="41" y1="27" x2="55" y2="27" stroke-width="5" />
      <polyline points="72,10 96,24 72,38" />
      <line x1="108" y1="10" x2="108" y2="38" />
      <path d="M 108 10 C 132 10, 132 24, 108 24" />
      <path d="M 108 24 C 134 24, 134 38, 108 38" />
    </g>
    <g stroke-width="7">
      <polyline points="146,7 156,7 156,41 146,41" />
    </g>
  </svg>

  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 34"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <g stroke-width="4.9">
      <polyline points="16,5 9,5 9,29 16,29" />
    </g>
    <g stroke-width="4.2">
      <line x1="26" y1="27" x2="34" y2="7" />
      <line x1="34" y1="7" x2="42" y2="27" />
      <line x1="29" y1="19" x2="39" y2="19" stroke-width="3.5" />
      <polyline points="51,7 68,17 51,27" />
      <line x1="77" y1="7" x2="77" y2="27" />
      <path d="M 77 7 C 94 7, 94 17, 77 17" />
      <path d="M 77 17 C 95 17, 95 27, 77 27" />
    </g>
    <g stroke-width="4.9">
      <polyline points="104,5 111,5 111,29 104,29" />
    </g>
  </svg>

  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 84 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <g stroke-width="3.5">
      <polyline points="11,3.5 6,3.5 6,20.5 11,20.5" />
    </g>
    <g stroke-width="3">
      <line x1="18" y1="19" x2="24" y2="5" />
      <line x1="24" y1="5" x2="30" y2="19" />
      <line x1="20" y1="13.5" x2="28" y2="13.5" stroke-width="2.5" />
      <polyline points="36,5 48,12 36,19" />
      <line x1="54" y1="5" x2="54" y2="19" />
      <path d="M 54 5 C 66 5, 66 12, 54 12" />
      <path d="M 54 12 C 67 12, 67 19, 54 19" />
    </g>
    <g stroke-width="3.5">
      <polyline points="73,3.5 78,3.5 78,20.5 73,20.5" />
    </g>
  </svg>
</template>
