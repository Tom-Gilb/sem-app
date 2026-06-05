<!--
  StakeholderGlyph.vue — the SEM App's Stakeholder glyph: `§` (hand-drawn).

  Tom Gilb, 2026-06-04 (verbatim): *"§ symbol for stakeholder, because it is
  easy on my keyboard, a single character, § stands for legal paragraph
  (inanimate stakeholder) and it actually resembles a person visually. It
  also contains an S !!!"*

  Drawn-icon discipline (Tom's 25-year-old Planguage rule): the drawn icon
  is as similar as possible to the keyed icon — § rendered as a hand-drawn
  serpentine SVG path that closely follows the typographic § form (two
  stacked loops + two diagonal serifs), NOT as SVG `<text>` (typographic)
  and NOT as a radical art departure.

  Composes with DD-004 inanimate-stakeholders rule (§ = legal paragraph =
  GDPR-style stakeholders), DD-015 International-Icons rule (no English
  letters; § is a typographic symbol that translates universally), and the
  "cool drawings" directive (Tom 2026-06-04).

  Single continuous path: top-serif → top-loop → centre-cross → bottom-loop
  → bottom-serif.

  Three sizes:
    compact  (20×20 viewBox, stroke 1.6)
    standard (24×24 viewBox, stroke 2.0)
    large    (32×32 viewBox, stroke 2.6)
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'Stakeholder — §',
})
</script>

<template>
  <!-- ── Large: 32×32 ───────────────────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32" width="32" height="32" fill="none"
    role="img" :aria-label="ariaLabel"
  >
    <!-- § centred at (16, 16), spans y=4..28. -->
    <path d="M 25 6 L 22 9 Q 16 4 10 9 Q 6 16 16 16 Q 26 16 22 23 Q 16 28 10 23 L 7 26"
      stroke="#2563eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </svg>

  <!-- ── Standard: 24×24 ────────────────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24" width="24" height="24" fill="none"
    role="img" :aria-label="ariaLabel"
  >
    <!-- § centred at (12, 12), spans y=3..21. -->
    <path d="M 19 4 L 17 6 Q 12 3 7 6 Q 5 12 12 12 Q 19 12 17 17 Q 12 21 7 17 L 5 19"
      stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </svg>

  <!-- ── Compact: 20×20 ─────────────────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20" width="20" height="20" fill="none"
    role="img" :aria-label="ariaLabel"
  >
    <!-- § centred at (10, 10), spans y=2..18. -->
    <path d="M 16 3 L 14 5 Q 10 2 6 5 Q 4 10 10 10 Q 16 10 14 14 Q 10 17 6 14 L 4 16"
      stroke="#2563eb" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </svg>
</template>
