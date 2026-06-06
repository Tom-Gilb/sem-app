<!--
  ResourceArtsyGlyph.vue — Planguage Resource ARTSY glyph: multiple →O

  Artsy synonym of the keyed Color Keyed Icon PlResourceIcon (→O).
  Per DD-016: same shape, artistic variation welcome.

  KEY DESIGN PRINCIPLE: Resources are ALWAYS multiple — time, money, people,
  equipment, licenses, energy. A single →O arrow understates this truth.
  The artsy variant draws THREE fanning dashed arrows converging into the oval
  to make the multiplicity visually explicit and unmistakable.

  Three arrow family (top / center / bottom — fan convergence):
    Arrow 1 (top, angled):   enters from upper-left → oval top-left entry
    Arrow 2 (center, flat):  enters from left       → oval center-left entry
    Arrow 3 (bottom, angled):enters from lower-left → oval bottom-left entry

  Dashes: 5 2.5 — longer, bolder than keyed icon (3 2.2) = "clearer"
  Stroke: 2.8 — thicker than keyed icon (2.2) = "clearer"

  No output arrow — INTENTIONAL. The Resource icon's focus is on the INPUT (the "tiger in
  the tank"). Outputs/consequences of resources exist (primarily: they determine Value
  delivery levels; one resource change also ripples to other resource needs — more money
  can reduce time needed). But those belong to V. entries and →O→ (full notation).
  The Resource icon deliberately shows only the input side.

  DEEPER THEORY (Tom Gilb, 2026-06-05 — not previously written):
  The resource arrow does not really go into a Function specifically. It goes into the
  whole SYSTEM — which contains Functions, Values, Stakeholders, Constraints, and other
  Resources, all interacting. The O is literally the Function keyed icon, but in the
  →O notation it stands for the system boundary: a productive simplification. Similarly,
  Values do not really flow out of a single Function — they emerge from the whole system.
  The O gives both arrows a readable "black box" without requiring the full system diagram.

  Three arrows (vs. one in the keyed →O) make the MULTIPLICITY explicit: resources are
  always multiple. Still a simplification; closer to reality. Source: Tom Gilb, Multi book.
  O = Function keyed icon (Tom Gilb CE ~2003).
  Canonical dark green #166534 (Kai "green for money"). color prop overrides.

  Spec: ResourceArtsyGlyph 2026-06-05.
  Keyed form: →O (same as PlResourceIcon — this is the ARTSY variant).
  Reference: /Users/Tomgilbs/Documents/MyVault/.claude/glyph-preview.html

  DD-015: no English letters — international arrows + oval.
  DD-016: same shape as keyed form, artistic variation (multiple arrows = richer).
-->
<script setup lang="ts">
import { computed } from 'vue'
// UNIT_TYPE=Widget
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Stroke color. Default: canonical dark green #166534.
   *  Pass 'rgba(255,255,255,0.9)' for dark/colored backgrounds. */
  color?: string
}>(), { size: 'lg', color: '#166534' })

const w = computed(() => props.size === '2xl' ? 72 : props.size === 'xl' ? 42 : props.size === 'lg' ? 33 : props.size === 'md' ? 24 : 15)
const h = computed(() => props.size === '2xl' ? 96 : props.size === 'xl' ? 56 : props.size === 'lg' ? 44 : props.size === 'md' ? 32 : 20)
</script>

<template>
  <!--
    ViewBox 40×48 (slightly wider than PlResourceIcon 36×48 to accommodate
    the top/bottom angled arrows spreading from the left edge).
    xl: 42×56  lg: 33×44  md: 24×32  sm: 15×20
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 48"
    :width="w" :height="h"
    fill="none"
    aria-label="Resource artsy glyph — multiple arrows into oval (resources are always multiple: time, money, people, equipment)"
    role="img"
  >
    <!-- Arrow 1 — TOP, angled: from (2,12) converging toward oval top-left entry (~20,17) -->
    <line x1="2" y1="12" x2="19" y2="17"
      :stroke="color" stroke-width="2.8" stroke-dasharray="5 2.5" stroke-linecap="round" />
    <!-- Arrow 1 arrowhead pointing toward (20,17) -->
    <polyline points="16,14 20,17 16,20"
      :stroke="color" stroke-width="2.8" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />

    <!-- Arrow 2 — CENTER, horizontal: from (2,24) straight into oval center-left (~20,24) -->
    <line x1="2" y1="24" x2="19" y2="24"
      :stroke="color" stroke-width="2.8" stroke-dasharray="5 2.5" stroke-linecap="round" />
    <!-- Arrow 2 arrowhead pointing right -->
    <polyline points="16,21 20,24 16,27"
      :stroke="color" stroke-width="2.8" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />

    <!-- Arrow 3 — BOTTOM, angled: from (2,36) converging toward oval bottom-left entry (~20,31) -->
    <line x1="2" y1="36" x2="19" y2="31"
      :stroke="color" stroke-width="2.8" stroke-dasharray="5 2.5" stroke-linecap="round" />
    <!-- Arrow 3 arrowhead pointing toward (20,31) -->
    <polyline points="16,28 20,31 16,34"
      :stroke="color" stroke-width="2.8" fill="none"
      stroke-linecap="round" stroke-linejoin="round" />

    <!-- Oval — the O is the Planguage keyed icon for FUNCTION (Tom Gilb CE book ~2003).
         In →O (Resource notation), the oval is the Function that consumes this resource.
         No output arrow — INTENTIONAL. The resource is consumed by the Function; nothing flows out. -->
    <ellipse cx="29" cy="24" rx="10" ry="9"
      :stroke="color" stroke-width="2.8" />
    <!-- No output arrow — INTENTIONAL. Resource consumed, not produced. -->
  </svg>
</template>
