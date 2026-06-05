<!--
  AnalyzeValueGlyph.vue — Compound keyed glyph: [O--*→]→?

  Pattern: [TYPE_GLYPH]→?   — "analyze entries of this type"
  This instance: [O--*→]→?  — "analyze Value entries"

  Grammar breakdown:
    [ ]    = outer container brackets (slate — neutral entry container)
    O--*→  = Value type icon (blue circle/origin, cyan scale axis + dot + arrow)
    →      = transformation arrow (cyan — analysis is happening)
    ?      = analytical question / insight (violet — result of analysis)

  Semantic: "Are Goals being reached? What is Status vs Tolerable?"

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  DD-015 compliance: no English letter abbreviations — [O--*→] is universal.
  DD-011 compliance: drawn glyph matches keyed form [O--*→]→? element-by-element.
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
  /** Transformation arrow + ? color.  Default: cyan/violet (light bg) or white (dark bg). */
  accentColor?: string
}>(), { size: 'lg', scheme: 'light' })

const bracketColor = computed(() =>
  props.color ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.8)' : '#64748b'))
const arrowColor = computed(() =>
  props.accentColor ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.95)' : '#0ea5e9'))
const qColor = computed(() =>
  props.accentColor ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.97)' : '#7c3aed'))

const w = computed(() => props.size === 'lg' ? 200 : props.size === 'md' ? 150 : 100)
const h = computed(() => props.size === 'lg' ? 96  : props.size === 'md' ? 72  : 48)
</script>

<template>
  <svg
    viewBox="0 0 100 48"
    :width="w" :height="h"
    fill="none"
    aria-label="Analyze Value entries — compound glyph [O--*→]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 8,7 L 3,7 L 3,41 L 8,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Mini O--*→ Value glyph: blue circle, cyan axis/dot/arrow -->
    <circle cx="14" cy="24" r="4" stroke="#2563eb" stroke-width="2" />
    <line x1="18" y1="24" x2="48" y2="24" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="33" cy="24" r="2.5" fill="#0ea5e9" />
    <polyline points="45,21 50,24 45,27" stroke="#0ea5e9" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Right bracket -->
    <path d="M 55,7 L 60,7 L 60,41 L 55,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="63" y1="24" x2="74" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="71,21 76,24 71,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="80" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
