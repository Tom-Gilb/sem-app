<!-- UNIT_TYPE=Widget -->
<!--
/**
 * PlanguageToolsButton — top-banner trigger pin for the Planguage Tools panel.
 *
 * Tom Gilb 2026-06-07: "It belongs to the more general class of Planguage Tools
 * (see Design Chapter in CE book). Sharpening is in that category because it
 * generates Designs."
 *
 * Planguage Tools are PRE-Evo-Step-derivation: they operate on the Planguage spec
 * itself (Functions, Values, Solutions, Constraints, Resources). Evo Tools take
 * over after derivation. This button is the peer of EvoToolsButton, sitting
 * alongside it in the pin cluster.
 *
 * Visual: orange→amber gradient (Solution canonical colour = orange, fitting
 * for design tools) + PlSolutionIcon glyph (Planguage-Glyph-First, DD-011).
 * Shows ready-tool count badge.
 *
 * Rules complied with:
 *   - Control-Pins-at-Top — lives in the right pin cluster
 *   - Planguage-Glyph-First (DD-011) — PlSolutionIcon, no inline SVG
 *   - No-Generic-Icon-Libraries (DD-012)
 *   - Interaction Disclosure — :title spells out the action
 *   - Banned-Scrum-Vocabulary — no sprint/backlog/story
 */
-->
<script setup lang="ts">
import PlSolutionIcon from './icons/PlSolutionIcon.vue'
import { readyPlanguageToolCount } from '../data/planguageTools'

defineEmits<{
  open: []
}>()

const readyCount = readyPlanguageToolCount()
</script>

<template>
  <button
    type="button"
    class="group inline-flex items-center gap-2 rounded-2xl px-3 py-2 select-none
           bg-gradient-to-r from-orange-500 to-amber-500 text-white
           border-2 border-orange-600
           hover:from-orange-600 hover:to-amber-600 hover:shadow-lg
           focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-1
           transition-all duration-150 active:scale-95 shadow-md"
    title="Spec Tools — design, sharpen, analyse and edit your Planguage spec before deriving Evo Steps. CE Design chapter. Click to open the catalogue."
    aria-label="Open Spec Tools catalogue"
    @click="(_e) => { console.info('[PlanguageToolsButton] click → emit open'); $emit('open') }"
  >
    <PlSolutionIcon class="w-5 h-5 text-white" :no-detail-click="true" />
    <span class="flex flex-col items-start leading-tight">
      <span class="text-[9px] font-semibold uppercase tracking-wider text-orange-100">Spec</span>
      <span class="text-sm font-bold text-white">Tools</span>
    </span>
    <span
      class="text-[11px] font-extrabold leading-none bg-black/70 text-white rounded-md px-2 py-1.5 ml-1"
      aria-label="Number of ready Planguage tools"
    >{{ readyCount }}</span>
  </button>
</template>
