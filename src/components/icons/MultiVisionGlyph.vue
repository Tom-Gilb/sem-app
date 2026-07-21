<!--
  MultiVisionGlyph.vue — Multi-Vision tool glyph

  Multi-Vision shows a matrix of Values (rows) × Solutions (columns)
  with color-coded impact cells — the canonical "which solution best
  moves which Values?" display.  This glyph IS that display in miniature:

    • Violet left column  — Value entries (V. entries)
    • Orange top row      — Solution candidates (S. entries)
    • Body cells          — impact levels:
        Green  (#16a34a) = HIGH impact (reaches Goal or Wish)
        Amber  (#fbbf24) = MEDIUM impact (reaches Tolerable)
        Pale   (#f0fdf4) = LOW / negligible impact

  No English letters.  All semantic information is conveyed through
  Planguage canonical colours — international (DD-015).
  Grid metaphor is universally understood.  DD-016 Color Artsy Icon.

  Spec: MultiVisionGlyph 2026-06-07.
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
  <!--
    viewBox 0 0 48 48 — 4×4 grid (1 header row/col + 3×3 data cells)

    Column layout (x): corner 1–13 | S1 14–24 | S2 25–35 | S3 36–47
    Row layout    (y): corner 1–13 | V1 14–24 | V2 25–35 | V3 36–47
    White grid lines overlay cell boundaries at x=13.5/24.5/35.5 and y=13.5/24.5/35.5
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Multi-Vision matrix — Values (rows) versus Solutions (columns), color-coded impact"
    role="img"
  >
    <!-- ── Outer border ──────────────────────────────────────────────── -->
    <rect x="0.5" y="0.5" width="47" height="47" rx="2.5"
          fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>

    <!-- ── Top-left corner cell (neutral) ───────────────────────────── -->
    <rect x="1" y="1" width="13" height="13" fill="#e2e8f0"/>

    <!-- ── Solution header row (orange — canonical Solution colour) ─── -->
    <rect x="14" y="1"  width="11" height="13" fill="#fb923c"/>
    <rect x="25" y="1"  width="11" height="13" fill="#f97316"/>
    <rect x="36" y="1"  width="11" height="13" fill="#ea580c"/>

    <!-- ── Value label column (violet — canonical Value colour) ─────── -->
    <rect x="1" y="14" width="13" height="11" fill="#a78bfa"/>
    <rect x="1" y="25" width="13" height="11" fill="#8b5cf6"/>
    <rect x="1" y="36" width="13" height="11" fill="#7c3aed"/>

    <!-- ── Body cells — 3×3 impact matrix ───────────────────────────── -->
    <!-- Row V1 -->
    <rect x="14" y="14" width="11" height="11" fill="#16a34a"/>   <!-- V1·S1 HIGH  -->
    <rect x="25" y="14" width="11" height="11" fill="#fbbf24"/>   <!-- V1·S2 MED   -->
    <rect x="36" y="14" width="11" height="11" fill="#f0fdf4"/>   <!-- V1·S3 LOW   -->
    <!-- Row V2 -->
    <rect x="14" y="25" width="11" height="11" fill="#fbbf24"/>   <!-- V2·S1 MED   -->
    <rect x="25" y="25" width="11" height="11" fill="#16a34a"/>   <!-- V2·S2 HIGH  -->
    <rect x="36" y="25" width="11" height="11" fill="#16a34a"/>   <!-- V2·S3 HIGH  -->
    <!-- Row V3 -->
    <rect x="14" y="36" width="11" height="11" fill="#f0fdf4"/>   <!-- V3·S1 LOW   -->
    <rect x="25" y="36" width="11" height="11" fill="#fbbf24"/>   <!-- V3·S2 MED   -->
    <rect x="36" y="36" width="11" height="11" fill="#16a34a"/>   <!-- V3·S3 HIGH  -->

    <!-- ── White grid lines — cell separators ───────────────────────── -->
    <!-- Vertical dividers -->
    <line x1="13.5" y1="1" x2="13.5" y2="47" stroke="white" stroke-width="1.2"/>
    <line x1="24.5" y1="1" x2="24.5" y2="47" stroke="white" stroke-width="1.2"/>
    <line x1="35.5" y1="1" x2="35.5" y2="47" stroke="white" stroke-width="1.2"/>
    <!-- Horizontal dividers -->
    <line x1="1" y1="13.5" x2="47" y2="13.5" stroke="white" stroke-width="1.2"/>
    <line x1="1" y1="24.5" x2="47" y2="24.5" stroke="white" stroke-width="1.2"/>
    <line x1="1" y1="35.5" x2="47" y2="35.5" stroke="white" stroke-width="1.2"/>
  </svg>
</template>
