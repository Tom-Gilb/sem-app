<script setup lang="ts">
/**
 * IlluminationGlyph — canonical icon for the ⌘I Illumination · Information ·
 * Illustrations finder (Tom Gilb 2026-06-13).
 *
 * Tom verbatim: "Make cmd I pin larger, colored w great Icon".
 *
 * Composition:
 *   - DD-011 Planguage-Glyph-First — drawn as a Color Artsy Icon (DD-016
 *     two-family rule, artistic-license variant).  Hand-drawn stroke quality.
 *   - DD-015 International Icons — zero English letters.  Vocabulary: lightbulb
 *     shape (universal "idea"), three coloured filament dots (mathematical
 *     numerals 3 / universal-cardinality), three radiating rays (universal
 *     "light emission").  Translates cleanly across all languages.
 *   - DD-016 Color Artsy Icon — practical not artsy in the colour/imagery
 *     sense; flourishes restricted to hand-stroke + the three coloured
 *     filament dots which encode the TRIPLE I:
 *       · VIOLET dot (#7c3aed) = Illumination (Planguage Glossary)
 *       · ORANGE dot (#ea580c) = Illustrations (TwinPod figures)
 *       · EMERALD dot (#059669) = Information (chapter excerpts)
 *     Same three colours as the picker's column accents → visual coherence.
 *   - DD-017 Colour-on-Background Contrast — bulb interior renders amber-50
 *     so violet/orange/emerald dots stay readable; outer strokes use
 *     currentColor so the glyph reads on any parent background.
 *   - American English Standard — "Color" in identifiers, "ColorArtsyIcon" not "ColourArtsyIcon".
 *
 * Sizes follow the canonical Glyph-family ladder (sm / md / lg / xl / 2xl).
 */

withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'standard'
}>(), { size: 'md' })
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    class="shrink-0"
    :class="{
      'h-3.5 w-3.5':   size === 'sm',
      'h-4   w-4':     size === 'md' || size === 'standard',
      'h-5   w-5':     size === 'lg',
      'h-6   w-6':     size === 'xl',
      'h-8   w-8':     size === '2xl',
      'h-10  w-10':    size === '3xl',
    }"
    aria-hidden="true"
  >
    <!-- r10 2026-06-13 Tom: "bigger and more color" — beefier strokes + saturated yellow bulb + larger filament dots. -->
    <!-- Three radiating rays at the top — Illumination signal -->
    <path d="M16 1.5 L16 6"     stroke="currentColor" stroke-width="2.8" stroke-linecap="round" />
    <path d="M6.5 3.5 L9.5 7.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" />
    <path d="M25.5 3.5 L22.5 7.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" />
    <!-- Two outer rays for extra brightness -->
    <path d="M2 9 L5.5 10.5"     stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" />
    <path d="M30 9 L26.5 10.5"   stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" />

    <!-- Bulb — saturated amber interior with radial gradient feel, thicker outline -->
    <path
      d="M9 16 a7 7 0 1 1 14 0 c0 2.5 -1.3 4.2 -2.5 5.2 v2.3 h-9 v-2.3 c-1.2 -1 -2.5 -2.7 -2.5 -5.2 z"
      fill="#fde047"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linejoin="round"
    />
    <!-- Inner highlight crescent for shine -->
    <path
      d="M10.5 14.5 a5 5 0 0 1 5 -4.5"
      stroke="#fffbeb"
      stroke-width="1.6"
      stroke-linecap="round"
      fill="none"
      opacity="0.85"
    />

    <!-- Three filament dots — TRIPLE I encoded as canonical column colours, larger + stroked white halo -->
    <circle cx="13" cy="16" r="2"   fill="#7c3aed" stroke="#fff" stroke-width="0.6" /><!-- VIOLET — Illumination -->
    <circle cx="16" cy="16" r="2"   fill="#ea580c" stroke="#fff" stroke-width="0.6" /><!-- ORANGE — Illustrations -->
    <circle cx="19" cy="16" r="2"   fill="#059669" stroke="#fff" stroke-width="0.6" /><!-- EMERALD — Information -->

    <!-- Bulb base (screw thread) — thicker -->
    <line x1="12" y1="24.5" x2="20" y2="24.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="12.5" y1="27"  x2="19.5" y2="27"  stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="13.5" y1="29.5" x2="18.5" y2="29.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
</template>
