<!--
  PlStakeholderIcon.vue — Planguage Stakeholder glyph: ←§→  (v9, hand-drawn §)

  Canonical colour: Blue #2563eb ("person, authority, trust — and inanimate entities")
  Tri-colour glyph (grammar preserved across the 2026-06-04 § swap):
    Violet solid ← arrow = VALUE flowing TO the stakeholder (they receive)
    Blue §                = IDENTITY — hand-drawn section/paragraph mark that
                            doubles as a left-facing human profile
    Green dashed → arrow  = RESOURCES flowing FROM the stakeholder (they provide)

  History:
    v7 2026-05-16 (ratified "with applause"): central ¶ hand-drawn as a
      stylised left-facing human profile (bowl=head, stems=body, eye=face).
    v8 2026-06-04 (Tom: *"convert all earlier stakeholder glyphs to §"* +
      DD-015 International-Icons rule): central character changed ¶ → §
      but accidentally rendered as SVG <text> (typographic).
    v9 2026-06-04 (Tom: *"arty to me means cool drawings, as opposed to
      typographical common characters"*): § now HAND-DRAWN as a custom
      stylised glyph — two interlocking loops (top loop = head, bottom
      loop = torso, with diagonal connector encoding the figure-8 / S
      shape).  Eye dot at the top-loop centre keeps the human-profile
      reading from v7.  No SVG <text>; pure paths.

  Spec: Planguage Spec Type Glyphs v9, 2026-06-04 (hand-drawn § swap).
  Reference: /06 Demo Features/Glyphs/glyph-preview.html (STAKEHOLDER card).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'lg' })
</script>

<template>
  <!--
    xl: 84×56  lg: 66×44  md: 48×32  sm: 30×20  (viewBox 72×48)
    Hand-drawn § doubles as a person facing LEFT toward arriving value.
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 72 48"
    :width="size === 'xl' ? 84 : size === 'lg' ? 66 : size === 'md' ? 48 : 30"
    :height="size === 'xl' ? 56 : size === 'lg' ? 44 : size === 'md' ? 32 : 20"
    fill="none"
    aria-label="Stakeholder glyph — ←§→ (hand-drawn)"
    role="img"
  >
    <!-- ← violet solid arrow — value TO the stakeholder -->
    <polyline points="5,21 0,24 5,27"
      fill="none" stroke="#7c3aed" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />
    <line x1="0" y1="24" x2="18" y2="24"
      stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" />

    <!-- § hand-drawn as faithful section-mark, blue.  Tom's 25-year-old
         Planguage rule: drawn icon ≈ keyed icon (the visual should look as
         close as possible to what you'd type on a keyboard).  Single
         continuous serpentine path traces the classic § form — top loop
         opens to upper-right, crosses centre, bottom loop opens to lower-
         left, with two diagonal serifs.  Centred at x=33, spans y=8..40
         (32px tall) — similar envelope to the v7 ¶ design. -->
    <g stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <!-- Single continuous § stroke: top-serif → top-loop → centre cross →
           bottom-loop → bottom-serif. -->
      <path d="M 44 11 L 41 14 Q 33 9 25 14 Q 21 21 33 24 Q 45 27 41 34 Q 33 39 25 34 L 22 37" />
    </g>

    <!-- → green dashed arrow — resources FROM stakeholder -->
    <line x1="48" y1="24" x2="66" y2="24"
      stroke="#22c55e" stroke-width="2"
      stroke-dasharray="4 2.5" stroke-linecap="round" />
    <polyline points="63,21 68,24 63,27"
      fill="none" stroke="#22c55e" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
