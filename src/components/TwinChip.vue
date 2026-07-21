<!--
  TwinChip.vue — TT chip for Tom's Twin Consultant access (Tom Gilb r93ttt 2026-06-12).

  Tom verbatim 2026-06-12 (greenlighting the parallel mechanism): *"OK Go for the
  design for Illum and add the extra TT chip"*. Persistent always-visible chip in
  the SEM App chrome (title-bar / plan-crest) that gives the planner a one-click
  jump into Tom Gilb's Twin Consultant — for the "I want to browse the corpus
  without first selecting text" use case (complements the ⌘I Illuminate path
  shipped in the same turn for the selection-driven path).

  Three behaviours, single chip:
    - Single click  → opens Twin Consultant landing page in a new tab
                       (passwordless, free at-a-click per r93ooo)
    - Double click  → opens a small inline mini-search input (Phase 1 stub:
                       just routes to the Twin Consultant landing page with the
                       term as a hint; Phase 2 will wire to /api/chat live)
    - Hover         → HoverHint explains the Twin Consultant's value
                       proposition + concept URL pattern + funding-loop framing

  Composes with:
    - r93ooo Twin Integration Architecture (CORS-open /api/chat probed)
    - r93ppp Twin-as-Destination commercial framing (funding-loop discipline)
    - MOVE Principle (visible chip, no menu-dive)
    - DD-009 Interaction Disclosure (HoverHint spells out every mode)
    - accessibility_tom.md (≥32×32 hit target, violet ring contrast)
    - r93ttt SelectionDefiner extension (this is the parallel surface;
      ⌘I is the conscious + implicit selection-driven path)
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref } from 'vue'
import { openTwinConsultant, TWIN_LOGIN_URL_EXPORT } from '../composables/useTwinCitation'
// Note: TWIN_LOGIN_URL is exported as part of the composable return; we re-export
// the literal here via a local constant for use in href bindings.
const TWIN_LOGIN_URL = TWIN_LOGIN_URL_EXPORT

const expanded = ref(false)

withDefaults(defineProps<{
  /** Compact (chrome) vs full (panel) presentation */
  variant?: 'chrome' | 'panel'
}>(), { variant: 'chrome' })

function onSingleClick(): void {
  openTwinConsultant()
}

function onDoubleClick(): void {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="relative inline-flex items-center">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg ring-2 transition-all"
      :class="variant === 'chrome'
        ? 'px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-[12px] font-bold ring-violet-700/50 shadow-sm hover:shadow-md'
        : 'px-3 py-2 bg-white text-violet-800 text-[13px] font-bold ring-violet-400 hover:ring-violet-600'"
      :title="`TT — Tom Gilb's Twin Consultant (by Kai Gilb). Click: open the Twin Consultant landing page in a new tab (passwordless, free at-a-click). Double-click: expand quick-search (Phase 1 stub). The Twin is an ontology-backed search engine across all of Tom Gilb's 65+ books with intelligent concept retrieval — book content free + open source; deeper Consultant tier supports continued Claudian development. Per r93ppp Twin-as-Destination discipline.`"
      aria-label="Open Tom's Twin Consultant in a new tab; double-click to expand quick-search"
      @click.exact="onSingleClick"
      @dblclick.stop.prevent="onDoubleClick"
    >
      <span class="font-mono font-extrabold tracking-wider" aria-hidden="true">TT</span>
      <span aria-hidden="true">↗</span>
    </button>

    <!-- Expanded quick-search dropdown (Phase 1 stub) -->
    <div
      v-if="expanded"
      class="absolute top-full right-0 mt-1.5 w-[22rem] rounded-lg bg-white ring-2 ring-violet-400 shadow-xl p-3 z-50"
      @click.stop
    >
      <p class="text-[11px] font-bold uppercase tracking-wider text-violet-800 mb-1.5 flex items-center gap-1.5">
        <span aria-hidden="true">🔮</span>
        <span>Tom Gilb Consultant Twin</span>
        <span class="text-[10px] text-violet-500 italic ml-auto font-normal">by Kai Gilb</span>
      </p>
      <p class="text-[11px] text-slate-700 leading-snug mb-2">
        Ontology-backed search across Tom Gilb's full corpus — concept retrieval,
        canonical Glossary entries, cross-references.
      </p>
      <a
        :href="TWIN_LOGIN_URL"
        target="_blank"
        rel="noopener"
        class="block w-full px-3 py-2 rounded bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-[12px] font-bold text-center transition-all shadow-sm"
        @click="expanded = false"
      >Open Twin Consultant ↗</a>
      <p class="text-[10px] text-slate-500 italic mt-2 text-center">
        Books are free + open source. Consultant tier funds Claudian development.
      </p>
      <p class="text-[10px] text-slate-400 italic mt-1 text-center">
        Tip: select any Planguage term in-app and press <kbd class="font-mono border rounded px-1 bg-slate-100">⌘I</kbd> to Illuminate it with a Twin citation.
      </p>
    </div>
  </div>
</template>
