<!--
  SharpenKnifeGlyph.vue — Planguage Sharpening tool glyph

  The 🔪 knife is the canonically ratified sharpening symbol for the SEM App.
  Tom Gilb ratified the knife as culturally universal (every culture uses knives)
  and as the perfect visual metaphor for "making a spec more precise, more sharp."

  DD-015: no English letters — shape uses blade geometry + universal spark symbols.
  DD-016: Color Artsy Icon — artistic SVG, not a literal keyed-character icon.
         Keyed reference concept: *→[**] (a design idea becoming sharper/more refined).

  Colour scheme:
    Amber (#fbbf24) blade body  — warmth of the sharpening process
    Dark brown (#7c2d12) handle — grounded, practical
    Red/orange sparks            — the spark of precision being achieved

  Spec: SharpenKnifeGlyph 2026-06-07.
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
  <!-- viewBox 0 0 48 48 — knife diagonal, handle SW, tip NE -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Sharpening knife — the universal symbol of making something more precise"
    role="img"
  >
    <!-- Handle — dark walnut-brown, rounded rect, bottom-left -->
    <rect x="2" y="34" width="14" height="10" rx="3.5" fill="#7c2d12" />
    <!-- Handle grip lines (wood grain suggestion) -->
    <line x1="6"  y1="35" x2="6"  y2="43" stroke="#92400e" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
    <line x1="10" y1="35" x2="10" y2="43" stroke="#92400e" stroke-width="1" stroke-linecap="round" opacity="0.7"/>

    <!-- Guard (crosspiece at blade-handle junction) -->
    <rect x="13" y="30" width="4" height="16" rx="2" fill="#b45309" />

    <!-- Blade body — amber, wide at guard, tapering to a sharp point top-right -->
    <path
      d="M 15,30 L 16,24 L 44,10 L 44,14 L 18,36 Z"
      fill="#fbbf24"
      stroke="#d97706"
      stroke-width="0.8"
      stroke-linejoin="round"
    />
    <!-- Blade spine (top edge) — slightly darker amber for depth -->
    <line x1="16" y1="24" x2="44" y2="10"
      stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" />
    <!-- Blade edge shine (cutting edge) — pale highlight -->
    <line x1="16" y1="30" x2="44" y2="14"
      stroke="#fef3c7" stroke-width="1" stroke-linecap="round" opacity="0.8" />

    <!-- Sparks at the tip — precision being achieved -->
    <circle cx="45" cy="8"  r="1.8" fill="#dc2626" />
    <circle cx="42" cy="5"  r="1.2" fill="#fb923c" />
    <circle cx="46" cy="5"  r="0.9" fill="#fbbf24" />
  </svg>
</template>
