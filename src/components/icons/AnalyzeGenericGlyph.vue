<!--
  AnalyzeGenericGlyph.vue — Compound keyed glyph: [*]→?

  Pattern: [TYPE_GLYPH]→?  — "analyze entries of this type"
  This instance: [*]→?     — "analyze any spec entry (generic)"

  Grammar breakdown:
    [ ]   = outer container brackets (slate — neutral entry container)
    *     = generic asterisk (violet — any spec entry type)
    →     = transformation arrow (cyan — analysis is happening)
    ?     = analytical question / insight (violet — result of analysis)

  Semantic: "Query and analyze any spec entry — goals, status, and gaps."

  Color behaviour:
    - Outer brackets render in `color` prop (default slate #64748b for light bg;
      pass 'rgba(255,255,255,0.8)' for dark/colored backgrounds).
    - Inner asterisk renders in `accentColor` prop (default violet #7c3aed).
      Special case: scheme='dark' overrides asterisk to rgba(255,255,255,0.9)
      because violet is less visible on dark backgrounds.
    - Arrow and ? use `accentColor` prop (default cyan/violet; white for dark bg).
    - Convenience: set `scheme="dark"` to auto-set all for dark backgrounds.

  Sizes:
    sm:  100×48  (viewBox native — small inline use)
    md:  150×72  (medium — badge, chip)
    lg:  200×96  (large — pin header)

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  Reference: /Users/Tomgilbs/Documents/MyVault/.claude/glyph-preview.html

  DD-015 compliance: no English letter abbreviations — [*] is universal.
  DD-011 compliance: drawn glyph matches keyed form [*]→? element-by-element.
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

/** Resolve effective colors: scheme='dark' shortcuts all to white family. */
const bracketColor = computed(() =>
  props.color ?? (props.scheme === 'dark' ? 'rgba(255,255,255,0.8)' : '#64748b'))

/** Inner asterisk: special case — violet is less visible on dark bg, use white. */
const asteriskColor = computed(() => {
  if (props.scheme === 'dark') return 'rgba(255,255,255,0.9)'
  return props.accentColor ?? '#7c3aed'
})

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
    aria-label="Analyze any spec entry — compound glyph [*]→?"
    role="img"
  >
    <!-- Outer container brackets -->
    <path d="M 8,7 L 3,7 L 3,41 L 8,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Generic asterisk * (violet — any spec entry) -->
    <line x1="25" y1="24" x2="39" y2="24" :stroke="asteriskColor" stroke-width="2" stroke-linecap="round" />
    <line x1="27" y1="18" x2="37" y2="30" :stroke="asteriskColor" stroke-width="2" stroke-linecap="round" />
    <line x1="37" y1="18" x2="27" y2="30" :stroke="asteriskColor" stroke-width="2" stroke-linecap="round" />
    <circle cx="32" cy="24" r="2.5" :fill="asteriskColor" />
    <!-- Right bracket -->
    <path d="M 46,7 L 51,7 L 51,41 L 46,41" :stroke="bracketColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Transformation arrow (analysis happening) -->
    <line x1="54" y1="24" x2="65" y2="24" :stroke="arrowColor" stroke-width="2.2" stroke-linecap="round" />
    <polyline points="62,21 67,24 62,27" :stroke="arrowColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Analytical question mark (result = insight) -->
    <text x="71" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" :fill="qColor">?</text>
  </svg>
</template>
