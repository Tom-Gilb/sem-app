<!--
  PlResourceIcon.vue — Planguage Resource glyph: →O
  Canonical colour: Dark Green #166534 ("green for money" — Kai Gilb)
  Glyph — the LEFT HALF of the Function glyph →O→:
    → (dashed, dark green)  = resource / cost entering the system
    O (dark green oval)     = the system boundary (entry point)
    NO output arrow         = resource is consumed, not delivered as value

  Grammar: →O  — half of →O→.
  The missing right arrow is INTENTIONAL and MEANINGFUL: this entry records
  what was spent, not what was produced. Distinct from Function #16a34a by luminance.
  Kai: "green for money." Dark vs bright green = money vs capability.
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16 (Kai spotted the →O half-grammar).
  Reference: /06 Demo Features/glyph-preview.html (RESOURCE card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!--
    xl: 42×56  lg: 33×44  md: 24×32  (viewBox 36×48, narrower)
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 36 48"
    width="36"
    height="48"
    :width="size === 'xl' ? 42 : size === 'lg' ? 33 : size === 'md' ? 24 : 15"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    fill="none"
    aria-label="Resource glyph — →O (cost enters, nothing comes out)"
    role="img"
  >
    <!-- Resource arrows IN — dark green dashed (Kai: "green for money") -->
    <line x1="1" y1="18" x2="10" y2="18"
      stroke="#166534" stroke-width="2" stroke-dasharray="3 2.2" stroke-linecap="round" />
    <polyline points="8,15 12,18 8,21"
      stroke="#166534" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="1" y1="30" x2="10" y2="30"
      stroke="#166534" stroke-width="2" stroke-dasharray="3 2.2" stroke-linecap="round" />
    <polyline points="8,27 12,30 8,33"
      stroke="#166534" stroke-width="2" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Oval — system boundary, dark green -->
    <ellipse cx="23" cy="24" rx="10" ry="9"
      stroke="#166534" stroke-width="2.5" />
    <!-- No output arrow — INTENTIONAL. Resource is consumed, not produced. -->
  </svg>
</template>
