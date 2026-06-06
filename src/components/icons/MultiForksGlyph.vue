<!--
  MultiForksGlyph.vue — Canonical SEM App glyph for the MultiForks tool.

  Tom Gilb 2026-06-06: "great multifork icons, lets adopt it officially in the
  app and in icons".

  Concept (verbatim from the original MultiForks brief): "Resources → System ←
  Values".  The glyph encodes that pattern as a 3-arrow fork pointing INTO a
  central oval (Resources side) AND a 3-arrow fork pointing OUT of the same
  oval (Values side).  No English letters anywhere (DD-015 International-Icons
  rule).

  Composes with:
    • DD-011 / Planguage-Glyph-First rule — official member of the icon family
    • DD-015 International-Icons rule — bracket/arrow/oval primitives only,
      zero English letters
    • DD-016 Color-Glyph two-family rule — this is the COLOR ARTSY ICON form
      (the keyed reference is "[*]→○←[*]"); a sibling Color Keyed Icon could
      ship later if needed
    • No-Generic-Icon-Libraries — built specifically for this tool, not from
      a stock icon library

  Props:
    size     — sm (20) / md (32) / lg (44) / xl (56) / 2xl (72).  Default md.
    color    — single overall colour (default uses the canonical palette).
  Slots: none.

  Twin portability: pure inline SVG, no Vue reactivity, no DOM dependency.
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Glyph footprint size. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Optional single-colour override for both forks AND the oval stroke.
   *  When unset, uses the canonical Planguage palette: orange Resources,
   *  slate System oval, violet Values. */
  color?: string
}>(), {
  size: 'md',
})

const px = computed(() => {
  const map: Record<NonNullable<typeof props.size>, number> = {
    sm: 20, md: 32, lg: 44, xl: 56, '2xl': 72,
  }
  return map[props.size]
})

const resourceColor = computed(() => props.color ?? '#c2410c') // canonical Resource orange
const valueColor    = computed(() => props.color ?? '#7c3aed') // canonical Value violet
const ovalColor     = computed(() => props.color ?? '#475569') // canonical System slate
</script>

<template>
  <svg
    :width="px" :height="px" viewBox="0 0 64 64" fill="none"
    role="img" aria-label="MultiForks · Resources fork into System; Values fork out of System"
    style="display:inline-block; vertical-align: middle;"
  >
    <title>MultiForks · Resources → System ← Values</title>

    <!-- ── LEFT side: three Resource arrows fanning into the oval ─────────── -->
    <!-- Top resource arrow -->
    <line x1="2" y1="14" x2="22" y2="26" :stroke="resourceColor" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="22,26 17,21 17,28" :fill="resourceColor" />
    <!-- Middle resource arrow (straight) -->
    <line x1="2" y1="32" x2="22" y2="32" :stroke="resourceColor" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="22,32 17,28 17,36" :fill="resourceColor" />
    <!-- Bottom resource arrow -->
    <line x1="2" y1="50" x2="22" y2="38" :stroke="resourceColor" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="22,38 17,36 17,43" :fill="resourceColor" />

    <!-- ── CENTRE: System oval ─────────────────────────────────────────────── -->
    <ellipse
      cx="32" cy="32" rx="11" ry="9"
      fill="#ffffff"
      :stroke="ovalColor"
      stroke-width="2.5"
    />
    <!-- Inner dot — signals "the system is here, the receiver-of-resources,
         the producer-of-values".  Slate so it works on any background. -->
    <circle cx="32" cy="32" r="2.2" :fill="ovalColor" />

    <!-- ── RIGHT side: three Value arrows fanning out of the oval ─────────── -->
    <!-- Top value arrow -->
    <line x1="43" y1="26" x2="62" y2="14" :stroke="valueColor" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="62,14 56,15 60,20" :fill="valueColor" />
    <!-- Middle value arrow (straight) -->
    <line x1="43" y1="32" x2="62" y2="32" :stroke="valueColor" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="62,32 56,28 56,36" :fill="valueColor" />
    <!-- Bottom value arrow -->
    <line x1="43" y1="38" x2="62" y2="50" :stroke="valueColor" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="62,50 56,49 60,44" :fill="valueColor" />
  </svg>
</template>
