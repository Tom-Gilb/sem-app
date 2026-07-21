<!--
  ConflictGlyph.vue — Conflict Detector glyph

  Conflict detection in Planguage specs: two Values (or stakeholders, or constraints)
  pulling in OPPOSITE directions, with a tension point between them.

  The glyph shows two bold arrows facing each other — violet (left stakeholder/value)
  and red (opposing force) — with an amber lightning zigzag at the collision centre.
  No English letters (DD-015). Shape = arrows + zigzag — universally understood.

  DD-015: directional arrows + zigzag spark — universal geometric symbols.
  DD-016: Color Artsy Icon. Keyed concept: [*]←→[*] (opposing forces).

  Colour scheme:
    Violet (#7c3aed) — left value / stakeholder
    Red    (#dc2626) — opposing force / tension
    Amber  (#f59e0b) — the conflict spark / tension point between them

  Spec: ConflictGlyph 2026-06-07.
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
  <!-- viewBox 0 0 48 48 — two opposing arrows with amber spark at centre -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Conflict detector — two opposing forces colliding"
    role="img"
  >
    <!-- ── Violet arrow (left → centre): first stakeholder / value ──── -->
    <line x1="2" y1="24" x2="18" y2="24" stroke="#7c3aed" stroke-width="3.2" stroke-linecap="round" />
    <polygon points="18,24 11,19 11,29" fill="#7c3aed" />

    <!-- ── Red arrow (right → centre): opposing force ──────────────── -->
    <line x1="46" y1="24" x2="30" y2="24" stroke="#dc2626" stroke-width="3.2" stroke-linecap="round" />
    <polygon points="30,24 37,19 37,29" fill="#dc2626" />

    <!-- ── Amber lightning zigzag at collision point ─────────────────
         Three-segment zigzag: sharp turns communicate "spark / tension".
         Deliberately thin so it reads as energy, not a solid object.    -->
    <polyline
      points="20,15 24,22 21,24 25,33"
      stroke="#f59e0b"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Second small bolt for visual energy / emphasis -->
    <polyline
      points="24,17 27,22 25,25 28,31"
      stroke="#fbbf24"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.8"
    />
  </svg>
</template>
