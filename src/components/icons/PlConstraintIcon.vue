<!--
  PlConstraintIcon.vue — Planguage Constraint glyph: [→O→]
  Canonical colour: Red #dc2626 ("danger, hard limit, must not exceed")
  Multi-colour glyph:
    Orange bold brackets [ ]     = hard outer bound (orange = limit/cost colour)
    Orange dashed arrows inside  = resource arrows (same "bound" family)
    Blue oval                    = function being constrained
    Cyan solid arrows inside     = value arrows (constrained but still delivered)

  Grammar: [→O→]  — bracket weight (bold) signals containment.
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16.
  Reference: /06 Demo Features/glyph-preview.html (CONSTRAINT card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!-- xl: 56×56  lg: 44×44  md: 32×32  sm: 20×20  (viewBox 48×48) -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="48"
    height="48"
    :width="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    fill="none"
    aria-label="Constraint glyph — [→O→]"
    role="img"
  >
    <!-- Bold left bracket — orange (limit/cost colour) -->
    <path d="M 14,7 L 8,7 L 8,41 L 14,41"
      stroke="#f59e0b" stroke-width="3.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Bold right bracket — orange -->
    <path d="M 34,7 L 40,7 L 40,41 L 34,41"
      stroke="#f59e0b" stroke-width="3.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Resource arrows IN — orange dashed -->
    <line x1="14" y1="18" x2="17" y2="18"
      stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2 1.5" stroke-linecap="round" />
    <polyline points="15,15 19,18 15,21"
      stroke="#f59e0b" stroke-width="1.8" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="14" y1="30" x2="17" y2="30"
      stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2 1.5" stroke-linecap="round" />
    <polyline points="15,27 19,30 15,33"
      stroke="#f59e0b" stroke-width="1.8" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Function oval — blue -->
    <ellipse cx="24" cy="24" rx="5" ry="7"
      stroke="#2563eb" stroke-width="2" />
    <!-- Value arrows OUT — cyan solid -->
    <line x1="29" y1="18" x2="32" y2="18"
      stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <polyline points="30,15 34,18 30,21"
      stroke="#0ea5e9" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="29" y1="30" x2="32" y2="30"
      stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" />
    <polyline points="30,27 34,30 30,33"
      stroke="#0ea5e9" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
