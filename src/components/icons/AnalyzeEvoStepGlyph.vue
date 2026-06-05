<!--
  AnalyzeEvoStepGlyph.vue — Compound keyed glyph: [<→+→]→?

  Pattern: [TYPE_GLYPH]→?     — "analyze entries of this type"
  This instance: [<→+→]→?    — "analyze Evo Step entries"

  Grammar breakdown:
    [ ]   = outer container brackets (slate — neutral entry container)
    <     = chevron (amber — past anchor / Evo baseline)
    →     = value delivery arrow (amber)
    +     = accumulation plus (amber — value accumulates across steps)
    →     = second delivery arrow (amber)
    →     = transformation arrow (cyan — analysis is happening)
    ?     = analytical question / insight (violet — result of analysis)

  Yellow dots represent value delivery targets (bright yellow for visibility).

  Semantic: "Is this Evo Step delivering its Value Goal within Resource budget?"

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  DD-015 compliance: no English letter abbreviations — [<→+→] is universal.
  DD-011 compliance: drawn glyph matches keyed form [<→+→]→? element-by-element.
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
    aria-label="Analyze Evo Step entries — compound glyph [<→+→]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 4,7 L 0,7 L 0,41 L 4,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Chevron < (past anchor) -->
    <polyline points="15,17 9,24 15,31" stroke="#ca8a04" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Planning gap (dashed faint) -->
    <line x1="17" y1="24" x2="21" y2="24" stroke="#ca8a04" stroke-width="1.5" stroke-dasharray="2 1.5" stroke-linecap="round" opacity="0.45" />
    <!-- Value dot 1 (bright yellow) -->
    <circle cx="25" cy="24" r="3.5" fill="#facc15" />
    <!-- Arrow (value delivery) -->
    <line x1="29" y1="24" x2="37" y2="24" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" />
    <polyline points="34,21 38,24 34,27" stroke="#ca8a04" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Plus (accumulation) -->
    <line x1="40" y1="24" x2="46" y2="24" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" />
    <line x1="43" y1="21" x2="43" y2="27" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" />
    <!-- Value dot 2 -->
    <circle cx="51" cy="24" r="3.5" fill="#facc15" />
    <!-- Right bracket -->
    <path d="M 57,7 L 62,7 L 62,41 L 57,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="65" y1="24" x2="76" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="73,21 78,24 73,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="82" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
