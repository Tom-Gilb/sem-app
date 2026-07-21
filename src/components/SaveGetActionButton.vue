<!--
  SaveGetActionButton.vue — Split-button affordance for any Save (`*→[*]`) or
  Get (`[*]→*`) action across the app.

  Tom 2026-05-14 standing instruction fired: "do this for the save/get buttons
  now." Mirrors `PriorityActionButton.vue` structurally — the glyph half opens
  the "About the Save Glyph" essay modal (SaveGlyphHistoryPanel), and the
  action half triggers the actual Save / Get / Export / Restore / Import.
  Hover the glyph for the faint `?` hint.

  HTML-correct: two real sibling `<button>` elements inside a `<span>` wrapper.
  Distinguished glyph pill (slate-themed, separate from the action half) per
  the same 2026-05-14 styling upgrade applied to `PriorityActionButton`.

  Chrome (background, text, rounded, height, text size, glyph size) is fully
  delegated to the caller via props so each call-site keeps its own visual
  identity on its host surface.
-->
<script setup lang="ts">
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'

withDefaults(defineProps<{
  /** Which glyph + HoverHint to show. `save` = `*→[*]`, `get` = `[*]→*`. */
  kind: 'save' | 'get'
  /** Right-half label. e.g. "Save now" / "Save Edit Version" / "Get a Plan" / "Restore". */
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
  /** Colour of the on-hover `?` overlay badge background. */
  hintBgClass?: string
  /** Text colour of the on-hover `?` overlay. */
  hintTextClass?: string
}>(), {
  chromeClass: 'bg-white/15 text-white',
  roundedClass: 'rounded-full',
  heightClass: 'h-7',
  textSizeClass: 'text-xs',
  glyphSizeClass: 'h-4',
  hintBgClass: 'bg-amber-500',
  hintTextClass: 'text-white',
})

const emit = defineEmits<{
  /** User clicked the action half (right). Triggers the Save/Get action. */
  action: []
  /** User clicked the glyph half (left). Opens "About the Save Glyph" essay. */
  info: []
}>()
</script>

<template>
  <span
    class="inline-flex items-stretch overflow-hidden transition-colors font-semibold align-middle"
    :class="[chromeClass, roundedClass, heightClass]"
  >
    <!-- ── Glyph half — opens "About the Save Glyph" essay modal ───────────── -->
    <!-- Distinguished glyph pill (2026-05-14 styling): nested slate pill with
         own bg + ring + rounded-full so it visually reads as a separate
         "info chip" rather than blending into the action half. -->
    <button
      type="button"
      class="group/info relative inline-flex items-center justify-center
             my-0.5 ml-0.5 px-2 rounded-full
             bg-slate-200/90 ring-1 ring-slate-400/80 text-slate-900
             hover:bg-slate-100 hover:ring-slate-500
             focus:outline-none focus:ring-2 focus:ring-slate-300
             transition-all shadow-sm"
      :title="kind === 'save'
        ? 'About the Save Glyph — what *→[*] means'
        : 'About the Get Glyph — what [*]→* means'"
      :aria-label="kind === 'save' ? 'About the Save Glyph' : 'About the Get Glyph'"
      @click.stop="emit('info')"
    >
      <component
        :is="kind === 'save' ? SaveGlyph : GetGlyph"
        size="compact"
        :class="['w-auto', glyphSizeClass]"
        aria-label=""
      />
      <!-- Hover-only `?` overlay so resting state stays clutter-free. -->
      <span
        class="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center
               h-3 w-3 rounded-full text-[8px] font-bold leading-none shadow
               opacity-0 group-hover/info:opacity-100 transition-opacity"
        :class="[hintBgClass, hintTextClass]"
        aria-hidden="true"
      >?</span>
    </button>

    <!-- Breathing-space gap between the distinguished glyph pill and action. -->
    <span class="w-1" aria-hidden="true"></span>

    <!-- ── Action half — the actual Save / Get / Export / Restore / Import ─── -->
    <button
      type="button"
      class="inline-flex items-center px-2 hover:bg-white/15
             focus:outline-none focus:ring-1 focus:ring-inset focus:ring-white/60
             transition-colors"
      :class="textSizeClass"
      :title="actionTitle"
      :aria-label="actionAriaLabel"
      @click.stop="emit('action')"
    >{{ label }}</button>
  </span>
</template>
