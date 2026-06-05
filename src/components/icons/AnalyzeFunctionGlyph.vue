<!--
  AnalyzeFunctionGlyph.vue — Compound keyed glyph: [→O→]→?

  Pattern: [TYPE_GLYPH]→?  — "analyze entries of this type"
  This instance: [→O→]→?   — "analyze Function entries"

  Grammar breakdown:
    [ ]    = outer container brackets (slate — neutral entry container)
    →O→    = Function type icon (orange dashed in, blue oval, cyan solid out)
    →      = transformation arrow (cyan — analysis is happening)
    ?      = analytical question / insight (violet — result of analysis)

  Semantic: "Is this function present, delivering value, and resourced correctly?"

  Install note: Stage 2/3 spec analysis actions.

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  DD-015 compliance: no English letter abbreviations — [→O→] is universal.
  DD-011 compliance: drawn glyph matches keyed form [→O→]→? element-by-element.
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
    aria-label="Analyze Function entries — compound glyph [→O→]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 4,7 L 0,7 L 0,41 L 4,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Mini →O→ Function glyph: orange dashed in, blue oval, cyan solid out -->
    <line x1="9" y1="17" x2="16" y2="17" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2.5 2" stroke-linecap="round" />
    <polyline points="13,14 17,17 13,20" stroke="#f59e0b" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="9" y1="31" x2="16" y2="31" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2.5 2" stroke-linecap="round" />
    <polyline points="13,28 17,31 13,34" stroke="#f59e0b" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <ellipse cx="27" cy="24" rx="8" ry="7" stroke="#2563eb" stroke-width="2" />
    <line x1="36" y1="17" x2="50" y2="17" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <polyline points="47,14 51,17 47,20" stroke="#0ea5e9" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <line x1="36" y1="31" x2="50" y2="31" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <polyline points="47,28 51,31 47,34" stroke="#0ea5e9" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Right bracket -->
    <path d="M 57,7 L 62,7 L 62,41 L 57,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="65" y1="24" x2="76" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="73,21 78,24 73,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="82" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
