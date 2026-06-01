<!--
  PlEvoStepIcon.vue — Planguage Evo Step glyph: < ->+->
  Canonical colour: Dark amber #ca8a04 (white text, WCAG AA ~4.3:1)
  Glyph:
    < (amber chevron)          = PAST — steps already delivered; the anchor you build from
    dashed gap (faint amber)   = planning process + tasks BEFORE value lands
                                 (the space IS the Planguage process work zone)
    ● (bright yellow dot) →    = VALUE DELIVERED (first increment; value flows right)
    +  (amber)                 = ACCUMULATION — evo steps add, they don't replace
    ● (bright yellow dot) →    = VALUE DELIVERED again (next increment)

  Grammar: < ->+->
  Accumulation is the key: each evo step ADDS value without replacing prior delivery.
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16, Tom Gilb.
  Reference: /06 Demo Features/glyph-preview.html (EVO STEP card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!--
    xl: 84×56  lg: 66×44  md: 48×32  (viewBox 72×48, wider)
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 48"
    width="72"
    height="48"
    :width="size === 'xl' ? 84 : size === 'lg' ? 66 : size === 'md' ? 48 : 30"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    fill="none"
    aria-label="Evo Step glyph — < ->+-> (past, gap, value, accumulation, value)"
    role="img"
  >
    <!-- < Past marker — amber -->
    <polyline points="14,16 5,24 14,32"
      stroke="#ca8a04" stroke-width="3.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Gap — dashed, faint amber (the planning/task zone) -->
    <line x1="16" y1="24" x2="24" y2="24"
      stroke="#ca8a04" stroke-width="2"
      stroke-dasharray="2.5 2.5" stroke-linecap="round" opacity="0.4" />
    <!-- First value dot: bright yellow (value accent) -->
    <circle cx="29" cy="24" r="4.5" fill="#facc15" />
    <!-- First value arrow — amber -->
    <line x1="34" y1="24" x2="40" y2="24"
      stroke="#ca8a04" stroke-width="3" stroke-linecap="round" />
    <polyline points="37,19.5 43,24 37,28.5"
      stroke="#ca8a04" stroke-width="3" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- + accumulation — amber -->
    <line x1="47" y1="24" x2="53" y2="24"
      stroke="#ca8a04" stroke-width="2.5" stroke-linecap="round" />
    <line x1="50" y1="21" x2="50" y2="27"
      stroke="#ca8a04" stroke-width="2.5" stroke-linecap="round" />
    <!-- Second value dot: bright yellow -->
    <circle cx="58" cy="24" r="4.5" fill="#facc15" />
    <!-- Second value arrow — amber -->
    <line x1="63" y1="24" x2="68" y2="24"
      stroke="#ca8a04" stroke-width="3" stroke-linecap="round" />
    <polyline points="66,19.5 72,24 66,28.5"
      stroke="#ca8a04" stroke-width="3" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
