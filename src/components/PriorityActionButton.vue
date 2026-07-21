<!--
  PriorityActionButton.vue — Split-button affordance for any "[A>B>C] <verb> Priority"
  control across the app.

  Tom 2026-05-14: "try Option C (low clutter); luxury not critical; if successful
  apply the pattern to other buttons" — the glyph half opens the "About the Priority
  Glyph" info modal; the action half triggers the priority action. Hovering the
  glyph half fades in a tiny `?` overlay so the info-affordance is *discoverable*
  on hover but invisible at rest — zero added visual clutter in the resting state.

  HTML-correct: two real sibling <button> elements wrapped in a <span> container.
  No nested interactives. Both halves keyboard-focusable independently. Click on
  the divider does nothing (it has no handler).

  Chrome (background, ring, rounded, height, text size, glyph size) is fully
  delegated to the parent via props so each call-site keeps its existing visual
  identity on its own dark/coloured surface.
-->
<script setup lang="ts">
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'

withDefaults(defineProps<{
  /** Right-half label. "Edit Priority" / "Set Priority" / "Apply Priority" / etc. */
  label: string
  /** HoverHint on the action half (right). */
  actionTitle?: string
  /** aria-label on the action half (right). */
  actionAriaLabel?: string
  /** Chrome for the outer container — bg, text, border. Caller owns surface fit. */
  chromeClass?: string
  /** Border radius for the outer container. */
  roundedClass?: string
  /** Height class for the outer container (h-6 / h-7 / h-9 etc). */
  heightClass?: string
  /** Tailwind text-size class for the action label. */
  textSizeClass?: string
  /** Tailwind height class for the inline glyph (h-3.5 / h-4 / h-5 etc). */
  glyphSizeClass?: string
  /** Colour of the on-hover `?` overlay badge. Defaults to amber-500. */
  hintBgClass?: string
  /** Text colour of the on-hover `?` overlay. Defaults to white. */
  hintTextClass?: string
  /** Hover-darken treatment per half — pass 'light' for light backgrounds. */
  hoverShade?: 'auto' | 'light' | 'dark'
}>(), {
  chromeClass: 'bg-white/15 text-white',
  roundedClass: 'rounded-full',
  heightClass: 'h-6',
  textSizeClass: 'text-[10px]',
  glyphSizeClass: 'h-3.5',
  hintBgClass: 'bg-slate-900',
  hintTextClass: 'text-white',
  hoverShade: 'auto',
})

const emit = defineEmits<{
  /** User clicked the action half (right). */
  action: []
  /** User clicked the glyph half (left). Should open the About modal. */
  info: []
}>()

// 'auto' picks white/10 darken which reads on both dark and light surfaces;
// 'light' uses black/10 for explicit light backgrounds.
function halfHover(hoverShade: 'auto' | 'light' | 'dark') {
  if (hoverShade === 'light') return 'hover:bg-black/5'
  return 'hover:bg-white/15'
}
</script>

<template>
  <span
    class="inline-flex items-stretch overflow-hidden transition-colors font-semibold align-middle"
    :class="[chromeClass, roundedClass, heightClass]"
  >
    <!-- ── Glyph half — opens "About the Priority Glyph" info modal ─────────── -->
    <!-- 2026-05-14 distinguished-glyph upgrade: Tom asked the glyph button to
         look more distinguished — "an oval or rounded rectangle and different
         colors." Implementation: the glyph half is now a NESTED amber pill
         inset inside the outer container, with its own bg + ring + rounded-full
         so it visually reads as a separate "info chip" — clearly its own
         button rather than blending into the action half. -->
    <button
      type="button"
      class="group/info relative inline-flex items-center justify-center
             my-0.5 ml-0.5 px-2 rounded-full
             bg-amber-200/80 ring-1 ring-amber-400/80 text-amber-950
             hover:bg-amber-200 hover:ring-amber-500
             focus:outline-none focus:ring-2 focus:ring-amber-300
             transition-all shadow-sm"
      title="About the Priority Glyph — what [A>B>C] means"
      aria-label="About the Priority Glyph"
      @click.stop="emit('info')"
    >
      <PriorityTripleGlyph
        size="compact"
        :class="['w-auto', glyphSizeClass]"
        aria-label=""
      />
      <!-- Hover-only `?` overlay so resting state stays clutter-free; small
           dot pinned to the glyph's top-right corner. -->
      <span
        class="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center
               h-3 w-3 rounded-full text-[8px] font-bold leading-none shadow
               opacity-0 group-hover/info:opacity-100 transition-opacity"
        :class="[hintBgClass, hintTextClass]"
        aria-hidden="true"
      >?</span>
    </button>

    <!-- Small breathing-space gap between the distinguished glyph pill and the
         action half. No divider — the pill itself is the visual separator. -->
    <span class="w-1" aria-hidden="true"></span>

    <!-- ── Action half — the actual priority action ─────────────────────────── -->
    <button
      type="button"
      class="inline-flex items-center px-2
             focus:outline-none focus:ring-1 focus:ring-inset focus:ring-white/60
             transition-colors"
      :class="[halfHover(hoverShade), textSizeClass]"
      :title="actionTitle"
      :aria-label="actionAriaLabel"
      @click.stop="emit('action')"
    >{{ label }}</button>
  </span>
</template>
