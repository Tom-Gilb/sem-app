<!--
  PlStakeholderIcon.vue — Planguage Stakeholder glyph: ←¶→
  Canonical colour: Blue #2563eb ("person, authority, trust — and inanimate entities")
  Tri-colour glyph:
    Violet solid ← arrow = VALUE flowing TO the stakeholder (they receive)
    Blue ¶ pilcrow        = IDENTITY — paragraph of documented interests AND
                            a left-facing human profile (bowl=head, stems=body, eye=face)
    Green dashed → arrow  = RESOURCES flowing FROM the stakeholder (they provide)

  Grammar: ←¶→  — bilateral exchange. Solid arrow = value grammar; dashed = resource grammar.
  Not just people: data, laws (GDPR), systems, regulations are all stakeholders.
  Diagnostic arrow (Brown, cited in Tom Gilb Stakeholder Engineering Dec 2024):
    "Follow the resources — every entity that provides resources is a stakeholder."
  Spec: Planguage Spec Type Glyphs v7, 2026-05-16 (ratified "with applause").
  Reference: /06 Demo Features/glyph-preview.html (STAKEHOLDER card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!--
    xl: 84×56  lg: 66×44  md: 48×32  (viewBox 72×48, wider)
    Face looks LEFT toward the arriving value — intentional orientation.
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 48"
    :width="size === 'xl' ? 84 : size === 'lg' ? 66 : 48"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : 32"
    fill="none"
    aria-label="Stakeholder glyph — ←¶→"
    role="img"
  >
    <!-- ← violet solid arrow — value TO the stakeholder -->
    <polyline points="5,21 0,24 5,27"
      fill="none" stroke="#7c3aed" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="0" y1="24" x2="18" y2="24"
      stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" />
    <!-- ¶ pilcrow — blue, identity AND left-facing human profile -->
    <!-- Left stem (body) -->
    <line x1="24" y1="7" x2="24" y2="43"
      stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" />
    <!-- Right stem (body) -->
    <line x1="32" y1="7" x2="32" y2="43"
      stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" />
    <!-- Bowl = HEAD in left-facing profile -->
    <path d="M 24,7 Q 24,1 32,1 Q 42,1 42,13 Q 42,24 32,24 L 24,24"
      fill="none" stroke="#2563eb" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />
    <!-- Eye dot — face looks LEFT toward arriving value -->
    <circle cx="35" cy="9" r="2.5" fill="#2563eb" />
    <!-- → green dashed arrow — resources FROM stakeholder -->
    <line x1="48" y1="24" x2="66" y2="24"
      stroke="#22c55e" stroke-width="2"
      stroke-dasharray="4 2.5" stroke-linecap="round" />
    <polyline points="63,21 68,24 63,27"
      fill="none" stroke="#22c55e" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
