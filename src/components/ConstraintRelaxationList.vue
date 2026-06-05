<!-- UNIT_TYPE=Widget -->
<!--
/**
 * ConstraintRelaxationList — renders the constraint-relaxation array on an
 * improvement idea (especially Skunkworks ideas).
 *
 * Tom Gilb 2026-06-03: *"Focus on Radical shift in tradeoffs (more risk,
 * more resources, relax known constraints)"*.  Constraint relaxations are
 * the Skunkworks signature — every Skunkworks idea should make its
 * constraint trades explicit so the user can evaluate whether the
 * relaxation is acceptable.
 *
 * Visual: amber-tinted block with a chain-broken icon affordance.  Each
 * relaxation shows the constraint reference (often a C. entry id),
 * what the relaxation is, and the justification for taking it on.
 *
 * Pure prop in, no state, no events.  Twin-portable.
 */
-->
<script setup lang="ts">
import type { ConstraintRelaxation } from '../data/evoStepImprovement'

defineProps<{
  relaxations: ConstraintRelaxation[]
}>()
</script>

<template>
  <div class="my-2 rounded-lg border border-amber-300 bg-amber-50/70 overflow-hidden text-[11px]">
    <header class="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
      <span aria-hidden="true">⛓‍💥</span>
      <span>Relaxes constraint{{ relaxations.length === 1 ? '' : 's' }}</span>
    </header>
    <ul class="divide-y divide-amber-200">
      <li
        v-for="(rx, i) in relaxations"
        :key="i"
        class="px-2.5 py-1.5"
      >
        <p class="font-bold text-amber-900 text-[11px] font-mono">{{ rx.constraintRef }}</p>
        <p class="text-slate-800 mt-0.5">{{ rx.relaxation }}</p>
        <p class="text-slate-600 italic mt-0.5"><span class="font-semibold not-italic">Justification:</span> {{ rx.justification }}</p>
      </li>
    </ul>
  </div>
</template>
