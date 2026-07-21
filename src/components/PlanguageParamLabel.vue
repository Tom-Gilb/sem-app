<!-- UNIT_TYPE=Widget -->
<!--
  PlanguageParamLabel — smart parameter label with Planguage definition on hover + click.

  Tom Gilb 2026-06-09: "hovering over any Planguage parameter gives access to concept
  definitions: a short one in the hover, and a longer (illumination) one when clicked
  (the Parameter Name)"

  Usage in PentaPanel.vue (replaces plain <label> elements):
    <PlanguageParamLabel param-key="Scale" />
    <PlanguageParamLabel param-key="Tolerable" />
    <PlanguageParamLabel param-key="Spec Owner" />

  Behaviour:
    - Hover over the label text → browser native title= HoverHint shows shortDef (~1 second)
    - Click label text or the [?] button → inline illumination card toggles open / closed
    - Illumination card shows: name · keyed icon · concept# · longDef paragraphs · source

  Rules:
    - DD-017: illumination card uses white/blue-50 background (never dark) — colourblind safe
    - Interaction Disclosure (DD-009): title= present on both label and [?] button
    - MOVE principle: the [?] affordance is visible without needing to know about it
    - ScrollContainer rule does NOT apply (this is a small inline card, not a bounded scroll area)
-->
<template>
  <!-- Outer wrapper — takes up the same space as a <label class="block"> -->
  <div :class="['block', wrapperClass]">

    <!-- Label row: text + [?] toggle -->
    <div class="flex items-center gap-1 min-w-0">
      <span
        class="text-xs font-semibold text-slate-600 leading-snug"
        :title="def ? def.tooltipFull : paramKey"
      >{{ def?.label ?? paramKey }}</span>

      <!-- [?] button — only rendered when a definition exists -->
      <button
        v-if="def"
        type="button"
        :class="[
          'inline-flex items-center justify-center text-[9px] font-mono font-bold leading-none',
          'px-0.5 rounded transition-colors select-none',
          open
            ? 'text-blue-700 bg-blue-100'
            : 'text-blue-400 hover:text-blue-700 hover:bg-blue-50',
        ]"
        :title="`Planguage definition of '${def.label}' — click to expand illumination`"
        @click.stop="open = !open"
      >
        [?]
      </button>
    </div>

    <!-- Illumination card — slide-in/out when open -->
    <Transition name="illum">
      <div
        v-if="open && def"
        class="mt-1.5 mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-slate-700 space-y-1.5"
      >
        <!-- Header row: name · icon · concept# · close -->
        <div class="flex items-start gap-2 flex-wrap">
          <span class="font-bold text-blue-800">{{ def.label }}</span>
          <code v-if="def.keyedIcon" class="font-mono text-[11px] text-blue-600 bg-white px-1 rounded border border-blue-200">{{ def.keyedIcon }}</code>
          <span v-if="def.conceptNumber" class="text-[10px] text-slate-400 font-mono">*{{ def.conceptNumber }}</span>
          <!-- CloseDot rule (CLAUDE.md) — never ✕ / × / SVG cross — always CloseDot -->
          <CloseDot
            class="ml-auto shrink-0"
            size="md"
            aria-label="Close definition"
            @click.stop="open = false"
          />
        </div>

        <!-- Definition paragraphs -->
        <p
          v-for="(para, i) in def.longDef"
          :key="i"
          class="leading-relaxed text-slate-600"
        >{{ para }}</p>

        <!-- Source citation -->
        <p class="text-[10px] text-slate-400 italic border-t border-blue-100 pt-1">
          Source: {{ def.canonicalSource }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PENTA_PANEL_PARAMS } from '../composables/usePlanguageTerms'
import CloseDot from './CloseDot.vue'

const props = withDefaults(defineProps<{
  /**
   * The lookup key — must exactly match a key in PENTA_PANEL_PARAMS.
   * Also used as the fallback display text when no definition exists.
   * Examples: "Scale", "Tolerable", "Spec Owner", "Presence Test"
   */
  paramKey: string
  /**
   * Additional classes applied to the outer wrapper div.
   * Use to pass mb-* or other spacing classes that were previously on <label>.
   * Default: 'mb-1'
   */
  wrapperClass?: string
}>(), {
  wrapperClass: 'mb-1',
})

const open = ref(false)
const def  = computed(() => PENTA_PANEL_PARAMS[props.paramKey] ?? null)
</script>

<style scoped>
/* Illumination card slide-in / slide-out */
.illum-enter-active {
  transition: opacity 160ms ease, transform 160ms ease;
}
.illum-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.illum-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.illum-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
