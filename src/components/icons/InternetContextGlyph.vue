<!--
  InternetContextGlyph.vue — Internet Context tool glyph

  The Internet Context tool fetches current external data (benchmarks, regulations,
  stakeholder news) FROM the outside world INTO the plan. The glyph shows this as:
    • A large dashed circle (the "outside world" boundary)
    • An inward arrow bringing data through the boundary
    • A central asterisk (the spec / plan — receiving the context)

  This is the "external knowledge flowing inward" concept. Universally readable:
  dashed boundary = outside world, inward arrow = fetching, asterisk = plan.

  DD-015: dashed circle + arrow + asterisk — universal geometric shapes.
  DD-016: Color Artsy Icon. Keyed concept: →[*] (context arriving from outside).

  Colour scheme:
    Blue (#2563eb, dashed)   — the external world boundary
    Cyan (#0ea5e9)           — the incoming data arrow (fetch direction)
    Orange (#ea580c)         — the plan asterisk (destination / spec)

  Spec: InternetContextGlyph 2026-06-07.
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
  <!-- viewBox 0 0 48 48 — dashed world boundary, inward arrow, central asterisk -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Internet Context — external data flowing into the plan"
    role="img"
  >
    <!-- ── Outer world boundary — dashed blue circle ─────────────────── -->
    <circle
      cx="24" cy="24" r="20"
      stroke="#2563eb"
      stroke-width="1.8"
      stroke-dasharray="5 3"
    />

    <!-- ── Inward arrow from top — data arriving from external world ─── -->
    <line x1="24" y1="4" x2="24" y2="14"  stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" />
    <polygon points="24,14 20,8 28,8"      fill="#0ea5e9" />

    <!-- Inward arrow from right (secondary) — multiple sources -->
    <line x1="44" y1="24" x2="34" y2="24" stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
    <polygon points="34,24 39,21 39,27"    fill="#0ea5e9" opacity="0.6" />

    <!-- Inward arrow from bottom-left (tertiary) — further breadth -->
    <line x1="8" y1="40" x2="17" y2="31"  stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" opacity="0.4" />
    <polygon points="17,31 13,36 11,29"    fill="#0ea5e9" opacity="0.4" />

    <!-- ── Central asterisk — the plan receiving the context ─────────── -->
    <line x1="18" y1="24" x2="30" y2="24" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round" />
    <line x1="24" y1="18" x2="24" y2="30" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round" />
    <line x1="20" y1="20" x2="28" y2="28" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round" />
    <line x1="28" y1="20" x2="20" y2="28" stroke="#ea580c" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="24" cy="24" r="2.5" fill="#ea580c" />
  </svg>
</template>
