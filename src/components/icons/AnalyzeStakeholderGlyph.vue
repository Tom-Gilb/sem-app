<!--
  AnalyzeStakeholderGlyph.vue — Compound keyed glyph: [←§→]→?

  Pattern: [TYPE_GLYPH]→?    — "analyze entries of this type"
  This instance: [←§→]→?    — "analyze Stakeholder entries"

  Grammar breakdown:
    [ ]   = outer container brackets (slate — neutral entry container)
    ←     = violet arrow IN (value flows TO stakeholder)
    §     = Stakeholder symbol (blue — hand-drawn double-loop)
    →     = green dashed arrow OUT (resources FROM stakeholder)
    →     = transformation arrow (cyan — analysis is happening)
    ?     = analytical question / insight (violet — result of analysis)

  Semantic: "Are all stakeholder flows correct? Who is missing?"

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  DD-015 compliance: no English letter abbreviations — [←§→] is universal.
  DD-011 compliance: drawn glyph matches keyed form [←§→]→? element-by-element.
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
    aria-label="Analyze Stakeholder entries — compound glyph [←§→]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 4,7 L 0,7 L 0,41 L 4,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Violet arrow IN (value TO stakeholder, arrowhead on left) -->
    <polyline points="12,21 8,24 12,27" stroke="#7c3aed" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="8" y1="24" x2="22" y2="24" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" />
    <!-- Mini § hand-drawn (blue) — compact double-loop -->
    <path d="M 35,15 Q 31,12 28,16 Q 26,20 31,22 Q 36,24 34,28 Q 31,32 27,28" stroke="#2563eb" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Green dashed arrow OUT (resources FROM stakeholder) -->
    <line x1="40" y1="24" x2="52" y2="24" stroke="#22c55e" stroke-width="1.8" stroke-dasharray="3 2" stroke-linecap="round" />
    <polyline points="49,21 53,24 49,27" stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Right bracket -->
    <path d="M 57,7 L 62,7 L 62,41 L 57,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="65" y1="24" x2="76" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="73,21 78,24 73,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="82" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
