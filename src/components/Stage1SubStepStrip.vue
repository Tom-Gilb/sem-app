<!-- UNIT_TYPE=Widget -->
<!--
 * Stage1SubStepStrip.vue — five-step sub-stage strip rendered at the top
 * of the Stage 1 (Spec) view.
 *
 * Tom Gilb 2026-06-19 verbatim: "Stage 1:Steps: As you did well at a
 * later stage, lets divide into clear steps call them 1.1 Spec Entry,
 * 1.2 Spec Parsing, Step 1.3 Parse Implied Sharpening, 1.4 Planguage
 * Generation, 1.5 Planguage Edit".
 *
 * IMPORTANT — the sub-step REGISTRY (`STAGE1_SUBSTEPS`, `Stage1SubStepKey`,
 * `Stage1SubStepDef`) lives in `src/data/stage1SubSteps.ts`, NOT inside
 * this SFC's `<script setup>`.  Vue 3 `<script setup>` does NOT allow
 * arbitrary top-level `export const` / `export type` declarations — an
 * attempt to do so crashes the Vite Vue plugin at load time with
 * "Importing a module script failed."  Tom Gilb 2026-06-19 saw this
 * exact error after r41 v202 stuffed the registry in here.  Same lesson
 * banked in `data/planningStages.ts` 2026-06-03.
 *
 * Pattern: mirrors the wider 11-stage planning bar's visual language —
 * uniform pill height, glyph + numbered prefix + spelled-out label,
 * current step amber-highlighted, completed steps green, pending steps
 * dimmed.  Clickable: emits 'go' with the target sub-step key so the
 * parent (App.vue) owns navigation.
 *
 * Composes with: Icon-Plus-Text SUPREME (every pill carries text), DD-009
 * Zero-Training UI (HoverHint spells out what each step is for), MOVE
 * Principle (all 5 steps visible at-a-glance, no menu-dive), Twin
 * portability (pure presentational component).
 -->
<script setup lang="ts">
import { computed } from 'vue'
import { STAGE1_SUBSTEPS, type Stage1SubStepKey, type Stage1SubStepDef } from '../data/stage1SubSteps'
import { useSettings } from '../composables/useSettings'

const props = defineProps<{
  /** The sub-step currently active in Stage 1. */
  current?: Stage1SubStepKey
  /** Sub-steps the planner has already completed in this session (drives
   *  the green "✓ done" badge). */
  done?:    Stage1SubStepKey[]
}>()

// r41 v333 (Tom Gilb 2026-06-24): wire Stage 1 Workflow mode through to the
// visible strip order.  Three modes from settings.stage1WorkflowMode:
//   default-implied-before-generate → 1.1 1.2 1.3 1.4 1.5 (canonical)
//   skip-implied                    → 1.1 1.2     1.4 1.5 (1.3 hidden)
//   implied-after-generate          → 1.1 1.2     1.4 1.3 1.5 (1.3 after 1.4)
// Implements Phase 2 of v325 (Tom verbatim 2026-06-24: "option 1 ... Option 2
// ... Implied Specs Options").
const { settings } = useSettings()

const visibleSubSteps = computed<readonly Stage1SubStepDef[]>(() => {
  const mode = settings.value.stage1WorkflowMode ?? 'default-implied-before-generate'
  if (mode === 'skip-implied') {
    return STAGE1_SUBSTEPS.filter(s => s.key !== '1.3')
  }
  if (mode === 'implied-after-generate') {
    // Reorder: 1.1 1.2 1.4 1.3 1.5
    const map: Record<Stage1SubStepKey, Stage1SubStepDef> = {} as Record<Stage1SubStepKey, Stage1SubStepDef>
    STAGE1_SUBSTEPS.forEach(s => { map[s.key] = s })
    return ['1.1', '1.2', '1.4', '1.3', '1.5'].map(k => map[k as Stage1SubStepKey]).filter(Boolean)
  }
  return STAGE1_SUBSTEPS
})

const emit = defineEmits<{
  (e: 'go', target: Stage1SubStepKey): void
}>()

const currentKey = computed<Stage1SubStepKey>(() => props.current ?? '1.1')
const doneSet    = computed<Set<Stage1SubStepKey>>(() => new Set(props.done ?? []))

function stepClass(key: Stage1SubStepKey): string {
  if (key === currentKey.value) {
    return 'bg-amber-400/95 text-amber-950 ring-2 ring-amber-200 shadow-md'
  }
  if (doneSet.value.has(key)) {
    return 'bg-emerald-500/85 text-emerald-50 hover:bg-emerald-500'
  }
  return 'bg-white/10 text-white/70 hover:bg-white/20 ring-1 ring-white/15'
}

function badge(key: Stage1SubStepKey): string {
  if (key === currentKey.value) return '●'
  if (doneSet.value.has(key))   return '✓'
  return ''
}

// r41 v406 (Tom Gilb 2026-06-28 "GREEN LIGHT FOR ALL AGENTS"): propagate v403
// Done / You Can / Continue SUPREME pattern from Stage 2 to Stage 1.  Sub-steps
// are offerings, never commands.  Everything is optional.  Stages are cyclic.
const doneSteps = computed(() =>
  visibleSubSteps.value.filter(s => doneSet.value.has(s.key))
)
const optionalSteps = computed(() =>
  visibleSubSteps.value.filter(s => !doneSet.value.has(s.key))
)
const doneLine = computed<string>(() => {
  if (doneSteps.value.length === 0) return 'Nothing done yet'
  return doneSteps.value.map(s => `${s.key} ${s.label}`).join(' · ')
})
const continueLine = 'Press the Stage 2 tile above (or any later stage) — skip the options; you can return any time.'
</script>

<template>
  <div
    class="w-full bg-slate-900/45 border-y border-white/10 text-white"
    aria-label="Stage 1 sub-step strip — Capture Spec Input, Parse to S·E·M, Add Implied Optional, Generate Planguage Spec, Edit & Refine"
  >
  <!-- Row 1 — pill strip (existing behaviour) -->
  <div class="w-full flex flex-wrap items-center gap-2 px-3 py-2">
    <!-- Strip header so the cluster has a visible name -->
    <span class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/65 mr-2 whitespace-nowrap">
      Stage 1 Steps
    </span>

    <!-- Sub-step pills — order + visibility depends on settings.stage1WorkflowMode (v333) -->
    <button
      v-for="step in visibleSubSteps"
      :key="step.key"
      type="button"
      :class="[
        'h-10 flex items-center gap-2 px-3 rounded-lg text-[12px] font-semibold transition-all',
        'focus:outline-none focus:ring-2 focus:ring-amber-300',
        stepClass(step.key),
      ]"
      :aria-current="step.key === currentKey ? 'step' : undefined"
      :aria-label="`Sub-step ${step.key} — ${step.label}.  ${step.shortHint}`"
      :title="`Sub-step ${step.key} · ${step.label}\n\n${step.longHint}\n\nClick to jump to this step.`"
      @click="emit('go', step.key)"
    >
      <span class="text-[10px] font-mono leading-none opacity-80">{{ step.key }}</span>
      <span class="leading-none">{{ step.label }}</span>
      <span
        v-if="badge(step.key)"
        class="text-[10px] leading-none ml-0.5"
        aria-hidden="true"
      >{{ badge(step.key) }}</span>
    </button>
  </div>

  <!-- Row 2 — DONE / YOU CAN / CONTINUE (Done/You-Can/Continue SUPREME v403) -->
  <div class="w-full px-3 pb-2 pt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px] leading-snug">
    <span class="font-bold text-emerald-300 whitespace-nowrap">✓ DONE:</span>
    <span class="text-white/80">{{ doneLine }}</span>

    <span class="font-bold text-amber-200 whitespace-nowrap self-start">✨ YOU CAN:</span>
    <div class="text-white/85 space-y-0.5">
      <template v-if="optionalSteps.length > 0">
        <p class="text-[11.5px] italic text-white/65 mb-1">
          Click any pill above to start that option (all optional, any order):
        </p>
        <ul class="space-y-0.5 pl-4 list-disc marker:text-white/40">
          <li v-for="s in optionalSteps" :key="s.key" class="leading-snug">
            <span class="text-white/95">{{ s.key }} {{ s.label }}</span>
            <span class="text-white/70"> — {{ s.shortHint }}</span>
          </li>
        </ul>
      </template>
      <span v-else class="italic text-white/60">
        All done — every sub-step in this stage is complete.
      </span>
    </div>

    <span class="font-bold text-indigo-300 whitespace-nowrap">➜ CONTINUE:</span>
    <span class="text-white/95">{{ continueLine }}</span>
  </div>

  <p class="px-3 pb-2 text-[10.5px] italic text-white/55 leading-tight">
    Everything is optional. Stages are cyclic — return any time.
  </p>
  </div>
</template>
