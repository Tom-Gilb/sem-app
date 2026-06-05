<!--
  AnalyzeResourceGlyph.vue — Compound keyed glyph: [→O]→?

  Pattern: [TYPE_GLYPH]→?  — "analyze entries of this type"
  This instance: [→O]→?   — "analyze Resource entries"

  Grammar breakdown:
    [ ]   = outer container brackets (slate — neutral entry container)
    →O    = Resource type icon (dashed arrows in + oval = resource consumed)
    →     = transformation arrow (cyan — analysis is happening)
    ?     = analytical question / insight (violet — result of analysis)

  Semantic: "Query and analyze what this Resource entry costs,
             whether it is justified, and how it compares to Goal."

  Color behaviour:
    - Outer brackets render in `color` prop (default slate #64748b for light bg;
      pass 'rgba(255,255,255,0.8)' for dark/colored backgrounds like Pin 2 blue).
    - Resource mini icon renders in `resourceColor` prop
      (default canonical dark green #166534; white for dark backgrounds).
    - Arrow and ? use `accentColor` prop (default cyan/violet; white for dark bg).
    - Convenience: set `scheme="dark"` to auto-set all three for dark backgrounds.

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header — matches Stage 10 Pin 2 display size)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  Reference: /Users/Tomgilbs/Documents/MyVault/.claude/glyph-preview.html
  Installed: Stage 10 Resources Pin 2 header (App.vue ~line 6814).

  DD-015 compliance: no English letter abbreviations — [→O] replaces [R.].
  DD-011 compliance: drawn glyph matches keyed form [→O]→? element-by-element.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  /** Scheme override — 'dark' sets white strokes suitable for colored/dark backgrounds. */
  scheme?: 'light' | 'dark'
  /** Outer bracket color.  Default: slate #64748b (light bg) or white (dark bg). */
  color?: string
  /** Resource mini icon stroke color.  Default: canonical dark green #166534 (Kai "green for money"). */
  resourceColor?: string
  /** Transformation arrow + ? color.  Default: cyan/violet (light bg) or white (dark bg). */
  accentColor?: string
}>(), { size: 'lg', scheme: 'light' })

/** Resolve effective colors: scheme='dark' shortcuts all three to white family. */
const bracketColor  = computed(() =>
  props.color        ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.8)' : '#64748b'))
const resColor      = computed(() =>
  props.resourceColor ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.9)' : '#166534'))
const arrowColor    = computed(() =>
  props.accentColor  ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.95)' : '#0ea5e9'))
const qColor        = computed(() =>
  props.accentColor  ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.97)' : '#7c3aed'))

const w = computed(() => props.size === 'lg' ? 200 : props.size === 'md' ? 150 : 100)
const h = computed(() => props.size === 'lg' ? 96  : props.size === 'md' ? 72  : 48)
</script>

<template>
  <svg
    viewBox="0 0 100 48"
    :width="w" :height="h"
    fill="none"
    aria-label="Analyze Resource entries — compound glyph [→O]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 8,7 L 3,7 L 3,41 L 8,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Mini →O Resource glyph -->
    <line x1="10" y1="17" x2="25" y2="17" :stroke="resColor" stroke-width="2" stroke-dasharray="3 2" stroke-linecap="round" />
    <polyline points="22,14 26,17 22,20" :stroke="resColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="10" y1="31" x2="25" y2="31" :stroke="resColor" stroke-width="2" stroke-dasharray="3 2" stroke-linecap="round" />
    <polyline points="22,28 26,31 22,34" :stroke="resColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <ellipse cx="40" cy="24" rx="12" ry="9" :stroke="resColor" stroke-width="2.2" />
    <!-- Right bracket -->
    <path d="M 57,7 L 62,7 L 62,41 L 57,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="65" y1="24" x2="76" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="73,21 78,24 73,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="82" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
