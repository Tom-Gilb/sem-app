<!--
  ValueAspectsKeyedGlyph.vue — Planguage Value Aspects Color KEYED Icon.
  Tom Gilb proposed the −E keyed form 2026-06-12 ("that was not a keyed icon, so we need
  to design that — maybe −E nice and simple").

  Keyed form (literal stroke pattern, language-neutral per DD-015):

      −    |───
           |
           |───
           |
           |───

  Reading: a horizontal dash on the left (the parent Value entering the structure) followed
  by a comb-like geometric form — one vertical spine with THREE horizontal branches. The
  comb is a UNIVERSAL geometric structure (forks, rakes, rivers branching to tributaries,
  trees) — not a Latin letter, just a geometric shape that happens to resemble one. The
  shape directly encodes the semantic: one source ⇒ three (n) Aspects.

  Color Keyed Icon family per DD-016 — literal keyed strokes, hand-stroke quality + colour:
    - Dash:      blue (parent Value source colour, matching PlValueIcon)
    - Spine + 3 branches: violet (Aspects-family colour)

  Companion: ValueAspectsGlyph.vue — the Color Artsy Icon family sibling (multi-axis fan
  with asterisks, arrows, brace). Both ship together per DD-016 two-family rule; use the
  Keyed form where simplicity / small size matters, the Artsy form where space + decoration
  benefit the surface.

  Composes with: DD-011 Planguage-Glyph-First, DD-015 International-Icons (universal
  geometric shapes only — horizontal line, vertical line, branches), DD-016 Color Glyph
  two-family rule, Planguage Mnemonic ID Standard SUPREME rule.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional theme — 'on-dark' for white-on-violet button backgrounds. */
  theme?: 'standard' | 'on-dark'
}>(), { size: 'lg', theme: 'standard' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="size === 'xl' ? 64 : size === 'lg' ? 48 : size === 'md' ? 36 : 24"
    :height="size === 'xl' ? 64 : size === 'lg' ? 48 : size === 'md' ? 36 : 24"
    fill="none"
    role="img"
    aria-label="Value Aspects keyed glyph — dash plus three-branch comb (one source, multiple Aspects)"
  >
    <!-- ── Left dash ── parent Value entering the structure -->
    <line x1="3" y1="24" x2="14" y2="24"
      :stroke="theme === 'on-dark' ? '#93c5fd' : '#1d4ed8'"
      stroke-width="4.5" stroke-linecap="round" />

    <!-- ── Vertical spine ── the parent's elaboration backbone -->
    <line x1="19" y1="6" x2="19" y2="42"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#6d28d9'"
      stroke-width="4.5" stroke-linecap="round" />

    <!-- ── Three horizontal branches ── each is one Aspect -->
    <line x1="19" y1="10" x2="44" y2="10"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#6d28d9'"
      stroke-width="4.5" stroke-linecap="round" />
    <line x1="19" y1="24" x2="44" y2="24"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#6d28d9'"
      stroke-width="4.5" stroke-linecap="round" />
    <line x1="19" y1="38" x2="44" y2="38"
      :stroke="theme === 'on-dark' ? '#c4b5fd' : '#6d28d9'"
      stroke-width="4.5" stroke-linecap="round" />
  </svg>
</template>
