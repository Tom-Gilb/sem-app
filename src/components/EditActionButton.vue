<!--
  EditActionButton.vue — Split-button affordance for any "[*]→[**] <verb> Edit"
  control across the app.

  Modelled on PriorityActionButton.vue. The glyph half opens the "About the Edit
  Glyph" info modal; the action half triggers the edit action. Hovering the glyph
  half fades in a tiny `?` overlay so the info-affordance is discoverable on
  hover but invisible at rest.

  Glyph pill: slate — bg-slate-200/90 ring-1 ring-slate-400/80 text-slate-900
  Hint `?` badge: bg-amber-500 text-white

  HTML-correct: two real sibling <button> elements wrapped in a <span> container.
  No nested interactives. Both halves keyboard-focusable independently.
-->
<script setup lang="ts">
import EditGlyph from './icons/EditGlyph.vue'

withDefaults(defineProps<{
  /** Right-half label. "Edit Plan" / "Edit Spec" / etc. */
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
  /** Hover-darken treatment per half — pass 'light' for light backgrounds. */
  hoverShade?: 'auto' | 'light' | 'dark'
}>(), {
  chromeClass: 'bg-white/15 text-white',
  roundedClass: 'rounded-full',
  heightClass: 'h-6',
  textSizeClass: 'text-[10px]',
  glyphSizeClass: 'h-3.5',
  hoverShade: 'auto',
})

const emit = defineEmits<{
  /** User clicked the action half (right). */
  action: []
  /** User clicked the glyph half (left). Should open the About modal. */
  info: []
}>()

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
    <!-- ── Glyph half — opens "About the Edit Glyph" info modal ──────────────── -->
    <button
      type="button"
      class="group/info relative inline-flex items-center justify-center
             my-0.5 ml-0.5 px-2 rounded-full
             bg-slate-200/90 ring-1 ring-slate-400/80 text-slate-900
             hover:bg-slate-100 hover:ring-slate-500
             focus:outline-none focus:ring-2 focus:ring-slate-300
             transition-all shadow-sm"
      title="About the Edit Glyph — what [*]→[**] means"
      aria-label="About the Edit Glyph"
      @click.stop="emit('info')"
    >
      <EditGlyph
        size="compact"
        :class="['w-auto', glyphSizeClass]"
        aria-label=""
      />
      <!-- Hover-only `?` overlay — zero clutter at rest; dot pinned top-right. -->
      <span
        class="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center
               h-3 w-3 rounded-full text-[8px] font-bold leading-none shadow
               opacity-0 group-hover/info:opacity-100 transition-opacity
               bg-amber-500 text-white"
        aria-hidden="true"
      >?</span>
    </button>

    <!-- Gap between glyph pill and action half. -->
    <span class="w-1" aria-hidden="true"></span>

    <!-- ── Action half — the actual edit action ───────────────────────────────── -->
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
