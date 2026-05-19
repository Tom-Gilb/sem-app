<!--
  PriorityTripleGlyph.vue — the SEM App's Priority keyed icon: `[A>B>C]`.
  Decision DD-002 (2026-05-13). SVG geometry is the approved master P5b
  (`5 - Project/SEM App/assets/PRIORITY ICON INVENTION/variants-2026-05-13/
   P5b-CanonicalTriple-HeavyBrackets.svg`), with weighted brackets
  (heavier stroke + taller cap-line) signalling that the brackets do more
  semantic work than the interior comparators-and-letters.

  Semantics: the brackets carry a bounded-system-validity envelope. The
  ordering `A > B > C` is only true inside the brackets — under the stated
  assumptions, constraints, authority and scope. Outside the brackets the
  ordering does NOT necessarily hold. The triple is canonical (three is the
  smallest set that demonstrates transitivity, and matches Planguage's
  other ternaries: Priority Signal categories and Priority Level zones);
  the compact pairwise `[A>B]` form is the typographic fallback used only
  where the triple cannot fit, and lives in PriorityPairGlyph.vue.

  Per Tom's 2026-05-13 scope-down ruling ("it is a button not a whole
  language set"), this component ships the `>` family only. Equality
  `[A=B=C]` and inverse-ordering `[A<B<C]` design-space variants exist as
  vault assets but are NOT shipped here.

  The `>` comparator is rendered without a shaft — just the angle, not an
  arrow. This visually distinguishes the priority *comparator* (static
  relation) from the Save/Get *arrow* `*→[*]` / `[*]→*` (action/flow).

  Renders via `currentColor` so the parent decides ink colour.
  Three sizes:
    - compact  ( ~20px tall, 100×24 viewBox, stroke 3.0 / brackets 3.5 )
    - standard ( ~24px tall, 144×34 viewBox, stroke 4.2 / brackets 4.9 )
    - large    ( ~32px tall, 200×48 viewBox, stroke 6.0 / brackets 7.0 )
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to a description of the bounded-system semantics. */
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Priority: A outranks B outranks C, within the bounded system',
})
</script>

<template>
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 48"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- [ bracket, weighted (load-bearing bound) -->
    <g stroke-width="7">
      <polyline points="28,7 18,7 18,41 28,41" />
    </g>
    <!-- interior at stroke-width 6 -->
    <g stroke-width="6">
      <!-- A -->
      <line x1="36" y1="38" x2="46" y2="10" />
      <line x1="46" y1="10" x2="56" y2="38" />
      <line x1="40" y1="27" x2="52" y2="27" stroke-width="5" />
      <!-- > comparator (no shaft — static, not action) -->
      <polyline points="66,10 82,24 66,38" />
      <!-- B -->
      <line x1="92" y1="10" x2="92" y2="38" />
      <path d="M 92 10 C 112 10, 112 24, 92 24" />
      <path d="M 92 24 C 114 24, 114 38, 92 38" />
      <!-- > comparator -->
      <polyline points="120,10 136,24 120,38" />
      <!-- C -->
      <path d="M 164 14 C 140 14, 140 38, 164 34" />
    </g>
    <!-- ] bracket, mirror, weighted -->
    <g stroke-width="7">
      <polyline points="172,7 182,7 182,41 172,41" />
    </g>
  </svg>

  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 144 34"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <g stroke-width="4.9">
      <polyline points="20,5 13,5 13,29 20,29" />
    </g>
    <g stroke-width="4.2">
      <line x1="26" y1="27" x2="33" y2="7" />
      <line x1="33" y1="7" x2="40" y2="27" />
      <line x1="29" y1="19" x2="37" y2="19" stroke-width="3.5" />
      <polyline points="47,7 59,17 47,27" />
      <line x1="66" y1="7" x2="66" y2="27" />
      <path d="M 66 7 C 80 7, 80 17, 66 17" />
      <path d="M 66 17 C 81 17, 81 27, 66 27" />
      <polyline points="86,7 98,17 86,27" />
      <path d="M 118 9.8 C 101 9.8, 101 24.2, 118 23.8" />
    </g>
    <g stroke-width="4.9">
      <polyline points="124,5 131,5 131,29 124,29" />
    </g>
  </svg>

  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel"
  >
    <g stroke-width="3.5">
      <polyline points="14,3.5 9,3.5 9,20.5 14,20.5" />
    </g>
    <g stroke-width="3">
      <line x1="18" y1="19" x2="23" y2="5" />
      <line x1="23" y1="5" x2="28" y2="19" />
      <line x1="20" y1="13.5" x2="26" y2="13.5" stroke-width="2.5" />
      <polyline points="33,5 41,12 33,19" />
      <line x1="46" y1="5" x2="46" y2="19" />
      <path d="M 46 5 C 56 5, 56 12, 46 12" />
      <path d="M 46 12 C 57 12, 57 19, 46 19" />
      <polyline points="60,5 68,12 60,19" />
      <path d="M 82 7 C 70 7, 70 17, 82 16.5" />
    </g>
    <g stroke-width="3.5">
      <polyline points="86,3.5 91,3.5 91,20.5 86,20.5" />
    </g>
  </svg>
</template>
