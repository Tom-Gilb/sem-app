<!-- UNIT_TYPE=Widget -->
<!--
/**
 * EvoToolsButton — top-banner trigger pin for the Evo Tools panel.
 *
 * Tom Gilb 2026-06-03: *"OK Evo Tools: I want to put down a marker, get
 * started on a set of special Evo Tools (sort of like actions, but very
 * specialised on Evo... please help me assemble the team behind a Evo
 * Tools Button"*
 *
 * Placement: top plan banner, alongside Actions / Agents pins
 * (Control-Pins-at-Top rule). Always visible — Evo tools are useful from
 * any planning stage (e.g., peek at the Evo Simulator from Stage 1 to
 * preview the cycle shape before generating a plan).
 *
 * Visual: gradient violet → indigo (matches the EvoToolsPanel header) +
 * <PlEvoStepIcon> glyph (Planguage-Glyph-First rule, DD-011). Shows a
 * small badge with the count of 'ready' tools so users see at a glance
 * how many tools are clickable today (vs. the roadmap-only count).
 *
 * No emoji icons. No generic icon library (DD-012 — banned).
 *
 * Interaction Disclosure: :title spells out the action.
 */
-->
<script setup lang="ts">
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import { readyToolCount } from '../data/evoTools'

defineEmits<{
  open: []
}>()

const readyCount = readyToolCount()
</script>

<template>
  <button
    type="button"
    class="group inline-flex items-center gap-2 rounded-2xl px-3 py-2 select-none
           bg-gradient-to-r from-violet-600 to-indigo-600 text-white
           border-2 border-violet-700
           hover:from-violet-700 hover:to-indigo-700 hover:shadow-lg
           focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-1
           transition-all duration-150 active:scale-95 shadow-md"
    title="Evo Tools — visualise, estimate, critique, and analyse your Evo plan. Click to open the catalogue."
    aria-label="Open Evo Tools catalogue"
    @click="$emit('open')"
  >
    <PlEvoStepIcon size="sm" :no-detail-click="true" />
    <span class="flex flex-col items-start leading-tight">
      <span class="text-[9px] font-semibold uppercase tracking-wider text-violet-200">Evo</span>
      <span class="text-sm font-bold text-white">Tools</span>
    </span>
    <!-- Count badge — bumped to bg-black/70 + text-[11px] + px-2 py-1.5 for
         legibility on the violet button (Tom 2026-06-04: "this number needs
         similar legibility" as the stage-action badge that got the dark plate). -->
    <span
      class="text-[11px] font-extrabold leading-none bg-black/70 text-white rounded-md px-2 py-1.5 ml-1"
      aria-label="Number of ready tools"
    >{{ readyCount }}</span>
  </button>
</template>
