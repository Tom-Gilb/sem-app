<!-- UNIT_TYPE=Widget -->
<!--
 * Stage4SubStepStrip.vue — five-step sub-stage strip rendered at the top
 * of the Stage 4 (Impacts) view.
 *
 * Tom Gilb 2026-06-21 verbatim (full design statement at memory/rule_stage_4_
 * impacts_design.md): the purpose of Stage 4 is to help the planner reach
 * REASONABLE BALANCE with the plan — *"we seem to have enough solutions to
 * reach Target levels of all our Values (only actual Evo delivery can prove
 * this is true or not)"*.  The 5 sub-steps (4.1 Look · 4.2 Adjust · 4.3
 * Approve · 4.4 Tools and Agents · 4.5 Move) decompose the work.
 *
 * Mirrors Stage1SubStepStrip + Stage2SubStepStrip patterns verbatim.
 *
 * IMPORTANT — sub-step REGISTRY (`STAGE4_SUBSTEPS`, `Stage4SubStepKey`,
 * `Stage4SubStepDef`) lives in `src/data/stage4SubSteps.ts` per Vue 3
 * `<script setup>` constraint.
 *
 * Composes with: Stage-Has-A-Purpose SUPREME · Stages-are-Cyclic SUPREME ·
 * Stage 1 + Stage 2 sub-step patterns · Icon-Plus-Text SUPREME · DD-009 Zero-
 * Training UI · MOVE Principle · Twin portability.
 -->
<script setup lang="ts">
import { computed } from 'vue'
import { STAGE4_SUBSTEPS, type Stage4SubStepKey } from '../data/stage4SubSteps'

const props = defineProps<{
  /** The sub-step currently active in Stage 4. */
  current?: Stage4SubStepKey
  /** Sub-steps the planner has already completed in this session. */
  done?:    Stage4SubStepKey[]
}>()

const emit = defineEmits<{
  (e: 'go', target: Stage4SubStepKey): void
  (e: 'continue'): void
}>()

const currentKey = computed<Stage4SubStepKey>(() => props.current ?? '4.1')
const doneSet    = computed<Set<Stage4SubStepKey>>(() => new Set(props.done ?? []))

function stepClass(key: Stage4SubStepKey): string {
  if (key === currentKey.value) {
    return 'bg-amber-400/95 text-amber-950 ring-2 ring-amber-200 shadow-md'
  }
  if (doneSet.value.has(key)) {
    return 'bg-emerald-500/85 text-emerald-50 hover:bg-emerald-500'
  }
  return 'bg-white/10 text-white/70 hover:bg-white/20 ring-1 ring-white/15'
}

function badge(key: Stage4SubStepKey): string {
  if (key === currentKey.value) return '●'
  if (doneSet.value.has(key))   return '✓'
  return ''
}

// r41 v406 — Done/You-Can/Continue SUPREME v403 propagation
const doneSteps = computed(() => STAGE4_SUBSTEPS.filter(s => doneSet.value.has(s.key)))
const optionalSteps = computed(() => STAGE4_SUBSTEPS.filter(s => !doneSet.value.has(s.key)))
const doneLine = computed<string>(() => {
  if (doneSteps.value.length === 0) return 'Nothing done yet'
  return doneSteps.value.map(s => `${s.key} ${s.label}`).join(' · ')
})
const continueLine = 'Press the Stage 5 tile above (or any later stage) — skip the options; you can return any time.'
</script>

<template>
  <div
    class="w-full bg-slate-900/45 border-y border-white/10 text-white"
    aria-label="Stage 4 sub-step strip — Look, Adjust, Approve, Tools and Agents, Move"
  >
  <div class="w-full flex flex-wrap items-center gap-2 px-3 py-2">
    <span class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/65 mr-2 whitespace-nowrap">
      Stage 4 Steps
    </span>

    <button
      v-for="step in STAGE4_SUBSTEPS"
      :key="step.key"
      type="button"
      :class="['shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/40', stepClass(step.key)]"
      :title="`${step.key} — ${step.label}.  ${step.longHint}`"
      :aria-label="`Go to sub-step ${step.key} — ${step.label}`"
      :aria-current="step.key === currentKey ? 'step' : undefined"
      @click="emit('go', step.key)"
    >
      <span class="shrink-0 font-mono font-bold tabular-nums">{{ step.key }}</span>
      <span class="whitespace-nowrap">{{ step.label }}</span>
      <span v-if="badge(step.key)" class="shrink-0 text-[10px] font-bold leading-none ml-0.5">{{ badge(step.key) }}</span>
    </button>

    <span class="shrink-0 text-[9px] italic text-white/55 ml-2 max-w-[300px] leading-tight" title="Tom Gilb 2026-06-21 — Reasonable balance means we seem to have enough solutions to reach Target levels of all our Values (only actual Evo delivery can prove this is true or not).">
      <span class="not-italic font-semibold text-white/70">Reasonable balance</span> = enough solutions for all Value Targets. Stages cyclic — return anytime.
    </span>
  </div>

  <!-- Row 2 — DONE / YOU CAN / CONTINUE (Done/You-Can/Continue SUPREME v403) -->
  <div class="w-full px-3 pb-2 pt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px] leading-snug">
    <span class="font-bold text-emerald-300 whitespace-nowrap">✓ DONE:</span>
    <span class="text-white/80">{{ doneLine }}</span>
    <span class="font-bold text-amber-200 whitespace-nowrap self-start">✨ YOU CAN:</span>
    <div class="text-white/85 space-y-0.5">
      <template v-if="optionalSteps.length > 0">
        <p class="text-[11.5px] italic text-white/65 mb-1">Click any pill above to start that option (all optional, any order):</p>
        <ul class="space-y-0.5 pl-4 list-disc marker:text-white/40">
          <li v-for="s in optionalSteps" :key="s.key" class="leading-snug">
            <span class="text-white/95">{{ s.key }} {{ s.label }}</span>
            <span class="text-white/70"> — {{ s.shortHint }}</span>
          </li>
        </ul>
      </template>
      <span v-else class="italic text-white/60">All done — every sub-step in this stage is complete.</span>
    </div>
    <span class="font-bold text-indigo-300 whitespace-nowrap">➜ CONTINUE:</span>
    <span class="text-white/95">{{ continueLine }}</span>
  </div>
  <p class="px-3 pb-2 text-[10.5px] italic text-white/55 leading-tight">Everything is optional. Stages are cyclic — return any time.</p>
  </div>
</template>
