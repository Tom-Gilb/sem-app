<!--
  AnalyzerGlyph.vue — Planguage Analyser: 4 knowledge sources converging

  The Planguage Analyser is the Conjunction-of-Technologies tool — it applies
  ALL FOUR knowledge sources to the spec simultaneously:
    1. Plan data (current spec)         — Orange
    2. Gilb corpus (books + standards)  — Blue
    3. LLM training data                — Violet
    4. Internet (current data)          — Emerald

  The glyph shows four colored arrows converging into a central white circle
  (the analysis result / synthesis). Each arrow arrives from a compass direction.

  DD-015: arrows + circle — universal geometric symbols, zero English letters.
  DD-016: Color Artsy Icon — four canonical Planguage colours, one per source.
         Keyed concept: [→○←] (multiple streams converging to synthesis).

  Colour mapping (per Conjunction-of-Technologies SUPREME rule):
    Orange (#ea580c)  ← left  — plan data (the structured Planguage spec itself)
    Blue   (#2563eb)  ↓ top   — Gilb corpus (books, standards, templates)
    Violet (#7c3aed)  → right — LLM training (general knowledge)
    Emerald (#16a34a) ↑ bottom — internet (current external data)

  Spec: AnalyzerGlyph 2026-06-07.
-->
<script setup lang="ts">
import { computed } from 'vue'
// UNIT_TYPE=Widget
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'md' })

const px = computed(() =>
  props.size === 'xl' ? 56 : props.size === 'lg' ? 44 : props.size === 'md' ? 32 : 20,
)
</script>

<template>
  <!-- viewBox 0 0 48 48 — 4 arrows (N/S/E/W) converging on center circle -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Planguage Analyser — four knowledge sources converging to synthesis"
    role="img"
  >
    <!-- ── Orange arrow from left → (Plan data) ────────────────────────── -->
    <line x1="3" y1="24" x2="16" y2="24"  stroke="#ea580c" stroke-width="2.8" stroke-linecap="round" />
    <polygon points="16,24 10,19.5 10,28.5" fill="#ea580c" />

    <!-- ── Blue arrow from top ↓ (Gilb corpus) ────────────────────────── -->
    <line x1="24" y1="3" x2="24" y2="16"  stroke="#2563eb" stroke-width="2.8" stroke-linecap="round" />
    <polygon points="24,16 19.5,10 28.5,10" fill="#2563eb" />

    <!-- ── Violet arrow from right ← (LLM training) ───────────────────── -->
    <line x1="45" y1="24" x2="32" y2="24" stroke="#7c3aed" stroke-width="2.8" stroke-linecap="round" />
    <polygon points="32,24 38,19.5 38,28.5" fill="#7c3aed" />

    <!-- ── Emerald arrow from bottom ↑ (Internet) ─────────────────────── -->
    <line x1="24" y1="45" x2="24" y2="32" stroke="#16a34a" stroke-width="2.8" stroke-linecap="round" />
    <polygon points="24,32 19.5,38 28.5,38" fill="#16a34a" />

    <!-- ── Centre synthesis circle ─────────────────────────────────────── -->
    <!-- White fill so the arrow heads appear behind it, not on top -->
    <circle cx="24" cy="24" r="7"   fill="white" stroke="#334155" stroke-width="2" />
    <!-- Inner dot — synthesis point -->
    <circle cx="24" cy="24" r="2.5" fill="#334155" />
  </svg>
</template>
