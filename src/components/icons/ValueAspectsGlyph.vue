<!--
  ValueAspectsGlyph.vue — Planguage Value Aspects glyph (Color Artsy Icon family).
  Designed by Tom Gilb 11 June 2026 · upgraded r93yy 2026-06-12.

  Grammar (extends PlValueIcon's O--*--> single-axis glyph):
    O ⇒ *-->     ← Top    aspect
    O ⇒ *-->     ← Centre aspect (the canonical axis)
    O ⇒ *-->     ← Bottom aspect
                      ⌬   ← violet cluster brace = "set of aspects"

  r93yy upgrade per Tom Gilb 2026-06-12 ("make it more bold, large, color"):
    - Stroke widths increased ~50% (2.2 → 3.2 main, 1.6 → 2.4 asterisks)
    - Source circle now FILLED gradient (blue) — reads as solid object not outline
    - Asterisk dots enlarged + filled — data points read at small sizes
    - Per-axis arrowheads bolder + slightly larger
    - Cluster brace at right now violet-saturated + thicker stroke
    - viewBox enlarged 64×48 → 80×56 so the design has room to breathe at any rendered size

  Companion: ValueAspectsKeyedGlyph.vue — the Color Keyed Icon family sibling using the
  −E keyed form Tom proposed 2026-06-12. Both glyphs share grammar (one source ⇒ multi-axis)
  and ship together per DD-016 two-family rule.

  Composes with: DD-011 Planguage-Glyph-First, DD-015 International-Icons (universal shapes
  only — circle, line, asterisk, arrow, brace), DD-016 Color Glyph two-family rule.

  Reference: PlValueIcon.vue for the single-axis canonical Value glyph.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional theme override — 'light' for white-on-dark contexts (default cyan/blue on white). */
  theme?: 'standard' | 'on-dark'
}>(), { size: 'lg', theme: 'standard' })
</script>

<template>
  <!-- r93yy: viewBox enlarged 64×48 → 80×56, rendered sizes ~25% larger across the board -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 80 56"
    :width="size === 'xl' ? 96 : size === 'lg' ? 72 : size === 'md' ? 52 : 32"
    :height="size === 'xl' ? 68 : size === 'lg' ? 52 : size === 'md' ? 38 : 24"
    fill="none"
    role="img"
    aria-label="Value Aspects glyph — one source Function, multiple scale aspects"
  >
    <!-- Source-Function gradient definition so the circle reads as a solid object -->
    <defs>
      <radialGradient :id="`vaSource-${theme}`" cx="50%" cy="50%" r="55%">
        <stop offset="0%"  :stop-color="theme === 'on-dark' ? '#93c5fd' : '#3b82f6'" />
        <stop offset="100%" :stop-color="theme === 'on-dark' ? '#1d4ed8' : '#1e3a8a'" />
      </radialGradient>
    </defs>

    <!-- Source Function — filled gradient circle at the left, representing the parent Value -->
    <circle
      cx="11" cy="28" r="8"
      :fill="`url(#vaSource-${theme})`"
      :stroke="theme === 'on-dark' ? '#dbeafe' : '#1e3a8a'"
      stroke-width="2.2"
    />

    <!-- ── TOP aspect axis: source → upper-right ─────────────────────── -->
    <line x1="19" y1="24" x2="58" y2="10"
      :stroke="theme === 'on-dark' ? '#22d3ee' : '#0891b2'"
      stroke-width="3.4" stroke-linecap="round" />
    <line x1="44" y1="10" x2="34" y2="22"
      :stroke="theme === 'on-dark' ? '#67e8f9' : '#06b6d4'"
      stroke-width="2.6" stroke-linecap="round" />
    <line x1="34" y1="10" x2="44" y2="22"
      :stroke="theme === 'on-dark' ? '#67e8f9' : '#06b6d4'"
      stroke-width="2.6" stroke-linecap="round" />
    <circle cx="39" cy="16" r="2.6"
      :fill="theme === 'on-dark' ? '#22d3ee' : '#0891b2'" />
    <polyline points="54,4 62,10 56,17"
      :stroke="theme === 'on-dark' ? '#22d3ee' : '#0891b2'"
      stroke-width="3.4" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />

    <!-- ── CENTRE aspect axis: source → straight right (canonical PlValue) ── -->
    <line x1="19" y1="28" x2="58" y2="28"
      :stroke="theme === 'on-dark' ? '#a78bfa' : '#7c3aed'"
      stroke-width="3.6" stroke-linecap="round" />
    <line x1="44" y1="20" x2="34" y2="36"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#8b5cf6'"
      stroke-width="2.8" stroke-linecap="round" />
    <line x1="34" y1="20" x2="44" y2="36"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#8b5cf6'"
      stroke-width="2.8" stroke-linecap="round" />
    <circle cx="39" cy="28" r="3.2"
      :fill="theme === 'on-dark' ? '#a78bfa' : '#7c3aed'" />
    <polyline points="54,20 62,28 54,36"
      :stroke="theme === 'on-dark' ? '#a78bfa' : '#7c3aed'"
      stroke-width="3.6" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />

    <!-- ── BOTTOM aspect axis: source → lower-right ────────────────── -->
    <line x1="19" y1="32" x2="58" y2="46"
      :stroke="theme === 'on-dark' ? '#fb7185' : '#e11d48'"
      stroke-width="3.4" stroke-linecap="round" />
    <line x1="44" y1="46" x2="34" y2="34"
      :stroke="theme === 'on-dark' ? '#fda4af' : '#f43f5e'"
      stroke-width="2.6" stroke-linecap="round" />
    <line x1="34" y1="46" x2="44" y2="34"
      :stroke="theme === 'on-dark' ? '#fda4af' : '#f43f5e'"
      stroke-width="2.6" stroke-linecap="round" />
    <circle cx="39" cy="40" r="2.6"
      :fill="theme === 'on-dark' ? '#fb7185' : '#e11d48'" />
    <polyline points="54,39 62,46 56,52"
      :stroke="theme === 'on-dark' ? '#fb7185' : '#e11d48'"
      stroke-width="3.4" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />

    <!-- ── Cluster brace at the right ⌬ — signals "set of aspects" universally.
         Now thicker + violet-saturated to anchor the set boundary clearly. ── -->
    <path
      d="M 68 6 Q 75 6 75 14 L 75 25 Q 75 28 77 28 Q 75 28 75 31 L 75 42 Q 75 50 68 50"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#6d28d9'"
      stroke-width="3.0" fill="none"
      stroke-linecap="round" stroke-linejoin="round"
    />
  </svg>
</template>
