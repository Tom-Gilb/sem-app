<!--
  PlanHealthGlyph.vue — Plan Health Index (PHI) glyph

  The PHI (Planguage Health Index) gives a scored assessment of a plan across
  Quality, Completeness, Consistency and Constraint-compliance dimensions.
  The glyph is a classic semicircle gauge / health meter:
    • Three coloured arc zones (red = poor · amber = acceptable · green = healthy)
    • A needle pointing into the green zone (a "healthy plan" reference state)
    • A pivot dot at the gauge centre

  This is a universally understood "dashboard gauge" metaphor — no letters needed.

  DD-015: arc segments + needle — universal geometric shapes. No English letters.
  DD-016: Color Artsy Icon. Keyed concept: [*]% (a plan measured/scored).

  Colour scheme:
    Red    (#dc2626) — below Tolerable (critical health issue)
    Amber  (#f59e0b) — between Tolerable and Goal (acceptable)
    Emerald (#16a34a) — at or beyond Goal (healthy)
    Slate  (#334155)  — needle (the current reading)

  Arc geometry (viewBox 48×48):
    Centre: (24, 32), radius: 18
    Left extreme:  (6, 32)
    Right extreme: (42, 32)
    Zone boundaries at 120° and 60° from positive-x:
      Left-boundary (120°):  x=24+18*cos(120°)=15, y=32-18*sin(120°)=16.4≈16
      Right-boundary (60°):  x=24+18*cos(60°) =33, y=32-18*sin(60°) =16.4≈16
    Needle in healthy zone at 30° from positive-x:
      x=24+18*cos(30°)=39.6≈40, y=32-18*sin(30°)=23

  Spec: PlanHealthGlyph 2026-06-07.
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
  <!-- viewBox 0 0 48 48 — semicircle health gauge, centre (24,32), radius 18 -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Plan Health gauge — PHI score from poor (red) to healthy (green)"
    role="img"
  >
    <!-- ── Gauge arc — three coloured zones ──────────────────────────── -->
    <!-- Red zone: 180° → 120° (left third — below Tolerable) -->
    <path
      d="M 6,32 A 18,18 0 0 1 15,16"
      stroke="#dc2626"
      stroke-width="6"
      stroke-linecap="round"
    />
    <!-- Amber zone: 120° → 60° (middle third — acceptable) -->
    <path
      d="M 15,16 A 18,18 0 0 1 33,16"
      stroke="#f59e0b"
      stroke-width="6"
      stroke-linecap="round"
    />
    <!-- Green zone: 60° → 0° (right third — healthy) -->
    <path
      d="M 33,16 A 18,18 0 0 1 42,32"
      stroke="#16a34a"
      stroke-width="6"
      stroke-linecap="round"
    />

    <!-- ── Thin inner arc — gauge track reference (very faint) ────────── -->
    <path
      d="M 8,32 A 16,16 0 0 1 40,32"
      stroke="#e2e8f0"
      stroke-width="1"
    />

    <!-- ── Needle — pointing into green zone (healthy plan reference) ─── -->
    <line
      x1="24" y1="32"
      x2="39" y2="23"
      stroke="#334155"
      stroke-width="2.5"
      stroke-linecap="round"
    />

    <!-- ── Pivot dot ─────────────────────────────────────────────────── -->
    <circle cx="24" cy="32" r="3.5" fill="#334155" />
    <circle cx="24" cy="32" r="1.5" fill="white" />
  </svg>
</template>
