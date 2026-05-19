<!--
  ComparatorGlyph.vue — bare priority comparator glyphs `>`, `<`, `=` in
  the SEM App's Bold-Stroke aesthetic. Decision DD-002 (2026-05-13),
  question #4: Tom said YES to redrawing all three bare comparators so
  the family (bare + composed bracketed) reads as one typographic system.

  The bare `>` is rendered without a shaft — comparator, not arrow. This
  visually distinguishes priority comparators (static relations) from
  Save/Get arrows (action/flow).

  Used inline anywhere the bare comparator appears in app text or glossary
  prose, in lieu of ASCII `>` / `<` / `=` characters that would otherwise
  look like punctuation rather than members of the keyed-icon family.

  Geometry: matches the comparator inside PriorityTripleGlyph at each size.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  /** Which relation: greater-than (`>`), less-than (`<`), or equals (`=`). */
  relation?: 'gt' | 'lt' | 'eq'
  size?: 'compact' | 'standard' | 'large'
  /** Optional aria-label. Defaults to a description of the relation. */
  ariaLabel?: string
}>(), {
  relation: 'gt',
  size: 'standard',
  ariaLabel: '',
})
</script>

<template>
  <!-- gt: chevron pointing right, apex at right -->
  <svg
    v-if="relation === 'gt'"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="size === 'large' ? '0 0 48 48' : size === 'standard' ? '0 0 36 34' : '0 0 24 24'"
    fill="none"
    stroke="currentColor"
    :stroke-width="size === 'large' ? 6 : size === 'standard' ? 4.2 : 3"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel || 'higher priority than'"
  >
    <polyline v-if="size === 'large'" points="16,10 32,24 16,38" />
    <polyline v-else-if="size === 'standard'" points="12,7 24,17 12,27" />
    <polyline v-else points="8,5 16,12 8,19" />
  </svg>

  <!-- lt: chevron pointing left, apex at left -->
  <svg
    v-else-if="relation === 'lt'"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="size === 'large' ? '0 0 48 48' : size === 'standard' ? '0 0 36 34' : '0 0 24 24'"
    fill="none"
    stroke="currentColor"
    :stroke-width="size === 'large' ? 6 : size === 'standard' ? 4.2 : 3"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel || 'lower priority than'"
  >
    <polyline v-if="size === 'large'" points="32,10 16,24 32,38" />
    <polyline v-else-if="size === 'standard'" points="24,7 12,17 24,27" />
    <polyline v-else points="16,5 8,12 16,19" />
  </svg>

  <!-- eq: two parallel horizontals -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="size === 'large' ? '0 0 48 48' : size === 'standard' ? '0 0 36 34' : '0 0 24 24'"
    fill="none"
    stroke="currentColor"
    :stroke-width="size === 'large' ? 6 : size === 'standard' ? 4.2 : 3"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="ariaLabel || 'equal priority to'"
  >
    <template v-if="size === 'large'">
      <line x1="12" y1="18" x2="36" y2="18" />
      <line x1="12" y1="30" x2="36" y2="30" />
    </template>
    <template v-else-if="size === 'standard'">
      <line x1="9" y1="13" x2="27" y2="13" />
      <line x1="9" y1="21" x2="27" y2="21" />
    </template>
    <template v-else>
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="15" x2="18" y2="15" />
    </template>
  </svg>
</template>
