<!--
  AnalyzeTaskGlyph.vue — Compound keyed glyph: [→O→*]→?

  Pattern: [TYPE_GLYPH]→?    — "analyze entries of this type"
  This instance: [→O→*]→?   — "analyze Task entries"

  Grammar breakdown:
    [ ]   = outer container brackets (slate — neutral entry container)
    →     = dashed in (slate — task inputs)
    O     = circle (slate — task process node)
    →     = solid out (slate — task outputs)
    *     = sub-level asterisk (dim slate — task is sub-spec)
    →     = transformation arrow (cyan — analysis is happening)
    ?     = analytical question / insight (violet — result of analysis)

  Semantic: "Are tasks scoped, traced to Evo Steps, and estimated correctly?"

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  DD-015 compliance: no English letter abbreviations — [→O→*] is universal.
  DD-011 compliance: drawn glyph matches keyed form [→O→*]→? element-by-element.
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
    aria-label="Analyze Task entries — compound glyph [→O→*]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 4,7 L 0,7 L 0,41 L 4,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Dashed in -->
    <line x1="9" y1="24" x2="14" y2="24" stroke="#94a3b8" stroke-width="2" stroke-dasharray="2.5 1.8" stroke-linecap="round" />
    <polyline points="11,21 15,24 11,27" stroke="#94a3b8" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Circle (task process) -->
    <circle cx="22" cy="24" r="6" stroke="#94a3b8" stroke-width="2" />
    <!-- Solid out -->
    <line x1="28" y1="24" x2="38" y2="24" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="35,21 39,24 35,27" stroke="#94a3b8" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Sub-level asterisk (dim slate) -->
    <line x1="42" y1="24" x2="50" y2="24" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" />
    <line x1="43.5" y1="21" x2="48.5" y2="27" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" />
    <line x1="48.5" y1="21" x2="43.5" y2="27" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" />
    <!-- Right bracket -->
    <path d="M 55,7 L 60,7 L 60,41 L 55,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="63" y1="24" x2="74" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="71,21 76,24 71,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="80" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
