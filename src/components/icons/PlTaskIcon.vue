<!--
  PlTaskIcon.vue — Planguage Task glyph: →O→*
  Canonical colour: Near-black/slate #374151 ("neutral work, deliberately boring")
  Glyph:
    → (dashed, slate-400)   = effort / resource going INTO the task (consumed by work)
    O (slate-400 circle)    = the task process — work being done
    → (solid, slate-400)    = output produced by the task
    * (slate-500, dimmer)   = SUB-LEVEL marker — output is at sub-system level,
                              NOT at Level of Concern. Contrast: ✳ in Value = Level of Concern.
                              Task * feeds UPWARD into the Evo Step.

  Grammar: →O→*  — same functional family as →O→ (Function) but with sub-level output.
  Deliberately "boring" — no semantic colour load. Neutral slate.
  Ratified v7 (Tom Gilb, 2026-05-16): →O→* replaces older [v] as formal long-form.
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16.
  Reference: /06 Demo Features/glyph-preview.html (TASK card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!--
    xl: 82×56  lg: 64×44  md: 47×32  (viewBox 70×48, wide)
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 70 48"
    :width="size === 'xl' ? 82 : size === 'lg' ? 64 : 47"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : 32"
    fill="none"
    aria-label="Task glyph — →O→* (effort in, process, sub-level output)"
    role="img"
  >
    <!-- Dashed arrow in — slate-400 -->
    <line x1="2" y1="24" x2="15" y2="24"
      stroke="#94a3b8" stroke-width="2" stroke-dasharray="3.5 2.5" stroke-linecap="round" />
    <polyline points="12,20 16,24 12,28"
      stroke="#94a3b8" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Circle O — task process, slate-400 -->
    <circle cx="25" cy="24" r="9"
      stroke="#94a3b8" stroke-width="2.5" />
    <!-- Solid arrow out — slate-400 -->
    <line x1="34" y1="24" x2="49" y2="24"
      stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
    <polyline points="46,20 51,24 46,28"
      stroke="#94a3b8" stroke-width="2.5" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- * sub-level marker — slate-500, slightly dimmer = sub-level hierarchy -->
    <line x1="56.5" y1="24" x2="63.5" y2="24"
      stroke="#64748b" stroke-width="2" stroke-linecap="round" />
    <line x1="57.2" y1="20.9" x2="62.8" y2="27.1"
      stroke="#64748b" stroke-width="2" stroke-linecap="round" />
    <line x1="62.8" y1="20.9" x2="57.2" y2="27.1"
      stroke="#64748b" stroke-width="2" stroke-linecap="round" />
  </svg>
</template>
