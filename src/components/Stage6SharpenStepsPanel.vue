<!-- UNIT_TYPE=Panel -->
<!--
 * Stage6SharpenStepsPanel.vue — Stage 6 sub-step 6.3 "Sharpen Steps"
 *
 * Tom Gilb 2026-06-23 (autonomous backlog batch).  Source of truth in
 * /Users/Tomgilbs/Developer/sem-app/src/data/stage6SubSteps.ts:
 *   "Refine each step: cycle length, prerequisites, success criteria.
 *    Tom Gilb canonical cadences (Day / Week / Month / Quarter)."
 *
 * Per-step sharpening surface — one card per Evo Step, three fields:
 *   1. Cycle Length — canonical cadences: Day / Week / Sprint / Month / Quarter
 *   2. Prerequisites — multi-select over the other Evo Step names
 *   3. Success Criteria — free-text textarea (how do we know this step delivered Value)
 *
 * Apply emits 'apply' with the new EvoStep[]; App.vue reassigns confirmedSteps
 * with undoHistory.record() BEFORE mutation.  Auto-save on close NOT wired here
 * (changes are explicit-Apply only — Sharpen is a deliberate editing surface).
 *
 * Composes with: rule_stage_6_evo_steps_design.md (Phase 1 build) ·
 * Stage-Has-A-Purpose SUPREME · Solution Parameters SUPREME Tier-3 prerequisites ·
 * MOVE Principle · DD-009 Zero-Training UI · DD-014 Top-and-Bottom Navigation
 * Mirror · DD-017 R-G colorblind-safe · Universal Undo · CloseDot rule ·
 * ScrollContainer rule · Banned word `toast` → `notification` ·
 * Spell-out-Type-Names · No-Silent-Data-Loss SUPREME.
 -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { EvoStep } from '../types/evo-plan'

type CycleLength = 'Day' | 'Week' | 'Sprint' | 'Month' | 'Quarter'
const CYCLE_OPTIONS: readonly CycleLength[] = ['Day', 'Week', 'Sprint', 'Month', 'Quarter'] as const

const props = defineProps<{
  steps:     readonly EvoStep[]
  specName?: string | null
}>()

const emit = defineEmits<{
  (e: 'apply', updated: EvoStep[]): void
  (e: 'close'): void
}>()

interface EditRow {
  step:            EvoStep
  cycleLength:     CycleLength
  prerequisites:   string[]
  successCriteria: string
}

const rows = ref<EditRow[]>(props.steps.map((step) => ({
  step,
  cycleLength:     (step.cycleLength as CycleLength | undefined) ?? 'Week',
  prerequisites:   [...(step.prerequisites ?? [])],
  successCriteria: step.successCriteria ?? '',
})))

const stepNames = computed<string[]>(() => props.steps.map((s) => s.name))

function togglePrereq(rowIdx: number, name: string): void {
  const row = rows.value[rowIdx]
  if (!row) return
  const set = new Set(row.prerequisites)
  if (set.has(name)) set.delete(name)
  else                set.add(name)
  row.prerequisites = Array.from(set)
}

function handleApply(): void {
  const updated: EvoStep[] = rows.value.map((r) => ({
    ...r.step,
    cycleLength:     r.cycleLength,
    prerequisites:   r.prerequisites.length ? r.prerequisites : undefined,
    successCriteria: r.successCriteria.trim() || undefined,
  }))
  emit('apply', updated)
}

function handleClose(): void {
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { handleClose() }
}

onMounted(() => { window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey) })
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[640] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Stage 6.3 — Sharpen Evo Steps"
      @click.self="handleClose"
    >
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 overflow-hidden flex flex-col" style="max-height: 88vh">
        <!-- Header — r41 v413 (Tom Gilb 2026-06-28 "applies to all sharpening"):
             Apply Sharpening MIRROR in the header (matches the footer button at
             line ~219).  Long-form sharpen panel ⇒ bottom button can be off-
             screen ⇒ planner only sees CloseDot at top ⇒ ambiguity with accept.
             Composes with DD-014 Top-and-Bottom Navigation Mirror SUPREME +
             v412 lesson + MOVE Principle. -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
          <span aria-hidden="true" class="text-base">🔍</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold tracking-wide">6.3 Sharpen Steps · Refine each Evo Step</h2>
            <p v-if="specName" class="text-[10px] text-indigo-100 truncate">Spec: {{ specName }} · {{ rows.length }} Evo Step{{ rows.length === 1 ? '' : 's' }}</p>
          </div>
          <button
            type="button"
            :disabled="rows.length === 0"
            class="px-3 py-1.5 rounded-lg bg-amber-900 text-amber-50 text-xs font-bold ring-2 ring-amber-200 shadow-md hover:bg-amber-950 active:bg-black disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 shrink-0"
            title="🔪 Apply Sharpening — commit all sharpened Evo Step edits (reversible via Universal Undo ⌘Z).  CloseDot below = cancel without applying."
            aria-label="Apply Sharpening — commit edits"
            @click="handleApply"
          >🔪 Apply Sharpening</button>
          <CloseDot variant="on-dark" size="lg" title="Close · Cancel without applying — your sharpening edits are NOT committed unless you click Apply Sharpening" aria-label="Close panel without applying" @click="handleClose" />
        </header>

        <!-- Body — one card per Evo Step -->
        <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-5 py-4">
          <p v-if="rows.length === 0" class="text-center text-sm text-slate-500 py-6 italic">
            No Evo Steps to sharpen yet.  Return to Stage 6.1 and generate Evo Steps first.
          </p>

          <div v-else class="space-y-4">
            <article
              v-for="(row, idx) in rows"
              :key="row.step.name + ':' + idx"
              class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-3"
            >
              <!-- Step name (read-only) -->
              <header class="flex items-baseline gap-2">
                <span class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Evo Step</span>
                <h3 class="text-sm font-bold text-slate-800 truncate flex-1">{{ row.step.name }}</h3>
              </header>

              <!-- Cycle length -->
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Cycle Length
                  <span class="text-[10px] text-slate-400 normal-case font-normal italic">— Tom Gilb canonical cadences</span>
                </label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="opt in CYCLE_OPTIONS"
                    :key="opt"
                    type="button"
                    class="h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors"
                    :class="row.cycleLength === opt
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-300 hover:border-indigo-400'"
                    :title="`Set cycle length to ${opt}`"
                    @click="row.cycleLength = opt"
                  >{{ opt }}</button>
                </div>
              </div>

              <!-- Prerequisites -->
              <div v-if="stepNames.length > 1">
                <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Prerequisites
                  <span class="text-[10px] text-slate-400 normal-case font-normal italic">— Evo Steps that must complete first</span>
                </label>
                <div class="flex flex-wrap gap-1.5">
                  <template v-for="name in stepNames" :key="name">
                    <button
                      v-if="name !== row.step.name"
                      type="button"
                      class="h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors max-w-[220px] truncate"
                      :class="row.prerequisites.includes(name)
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-300 hover:border-amber-400'"
                      :title="row.prerequisites.includes(name) ? `Click to remove ${name} as a prerequisite` : `Click to add ${name} as a prerequisite`"
                      @click="togglePrereq(idx, name)"
                    >{{ name }}</button>
                  </template>
                </div>
              </div>

              <!-- Success criteria -->
              <div>
                <label
                  :for="'sharpen-success-' + idx"
                  class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Success Criteria
                  <span class="text-[10px] text-slate-400 normal-case font-normal italic">— how do we know this step delivered Value?</span>
                </label>
                <textarea
                  :id="'sharpen-success-' + idx"
                  v-model="row.successCriteria"
                  rows="2"
                  class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 text-[12px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  placeholder="E.g. 'Measured V.OnboardingSpeed moves from 12 min → 8 min in production cohort during the cycle.'"
                  title="Plain-language criterion the next Study-Act cycle (Stage 9) measures.  Compose with Planguage V. entry Status vs Goal."
                ></textarea>
              </div>
            </article>
          </div>

          <p v-if="rows.length > 0" class="text-[10px] text-slate-500 italic mt-4 leading-relaxed">
            Sharpened fields persist on the EvoStep model and are reversible via Universal Undo (⌘Z).
            Apply once when all steps look right — sharpening is deliberate, not auto-saved.
          </p>
        </ScrollContainer>

        <!-- Footer (BOTTOM mirror per DD-014) -->
        <footer class="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            class="h-9 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            title="Cancel without applying sharpening edits"
            @click="handleClose"
          >Cancel</button>
          <button
            type="button"
            :disabled="rows.length === 0"
            :class="[
              'h-9 px-4 rounded-lg text-xs font-bold transition-colors',
              rows.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
            ]"
            title="Apply all sharpening edits to the confirmed Evo Steps (reversible via Universal Undo ⌘Z)"
            @click="handleApply"
          >✅ Apply Sharpening</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
