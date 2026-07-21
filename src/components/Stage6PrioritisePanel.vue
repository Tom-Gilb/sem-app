<!-- UNIT_TYPE=Panel -->
<!--
 * Stage6PrioritisePanel.vue — Stage 6 sub-step 6.2 "Prioritise"
 *
 * Tom Gilb 2026-06-23 (autonomous backlog batch).  Source of truth in
 * /Users/Tomgilbs/Developer/sem-app/src/data/stage6SubSteps.ts:
 *   "Rank Evo Steps by Value/Cost ratio — VDT prioritisation."
 *
 * Per Planguage VDT (Value Decision Table) methodology: highest Value/Cost
 * ratio steps deliver first.  This panel surfaces the aggregate Value
 * (sum of impactPercent × Value-priority across linkedValues + linkedSolutions)
 * and aggregate Cost (sum of calendar + capital across step) per Evo Step,
 * computes the V/C ratio, and offers three reorder paths:
 *   1. Sort by V/C ratio descending (the default Planguage recommendation)
 *   2. Sort by Cost ascending (cheapest-first when value data is thin)
 *   3. Manual up/down reorder per row (escape hatch + colorblind-safe)
 *
 * Apply emits 'apply' with the new step order; App.vue reassigns
 * confirmedSteps.value (with undoHistory.record() BEFORE mutation).
 *
 * Composes with: rule_stage_6_evo_steps_design.md (Phase 1 build) ·
 * Stage-Has-A-Purpose SUPREME · MOVE Principle · DD-009 Zero-Training UI ·
 * DD-014 Top-and-Bottom Navigation Mirror (Apply at bottom + CloseDot top) ·
 * DD-017 R-G colorblind-safe (no green-only / red-only signaling) ·
 * No-Silent-Data-Loss (no mutation until Apply) · Universal Undo · CloseDot rule ·
 * ScrollContainer rule · Banned word `toast` → `notification` · Spell-out-Type-Names.
 -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { EvoStep } from '../types/evo-plan'

interface PrioritiseRow {
  step:       EvoStep
  valueScore: number
  costScore:  number
  ratio:      number    // value / cost — 0 if cost is 0
}

const props = defineProps<{
  steps:           readonly EvoStep[]
  /** Per-step aggregated calendar costs (optional; falls back to 0). */
  calendarCosts?:  Record<string, number>
  /** Per-step aggregated capital costs (optional; falls back to 0). */
  capitalCosts?:   Record<string, number>
  /** Per-step aggregate Value-impact score (optional; falls back to
   *  effortPercent as a thin proxy when nothing else is available). */
  valueImpactByStep?: Record<string, number>
  /** Spec name shown in the header for context. */
  specName?:       string | null
}>()

const emit = defineEmits<{
  (e: 'apply',  newOrder: EvoStep[]): void
  (e: 'close'): void
}>()

// Working copy — the canonical "manual" order. Resetting "Reset to manual" returns here.
const workingOrder = ref<EvoStep[]>([...props.steps])
const initialOrder = props.steps.slice()  // captured for "Reset to manual order"

const rows = computed<PrioritiseRow[]>(() => workingOrder.value.map((step) => {
  const cal  = (props.calendarCosts?.[step.name] ?? 0)
  const cap  = (props.capitalCosts?.[step.name]  ?? 0)
  const cost = cal + cap
  // Value score: prefer explicit valueImpactByStep map; else use effortPercent as
  // an honest proxy ("how much work this step represents → rough value floor").
  const val  = props.valueImpactByStep?.[step.name] ?? step.effortPercent ?? 0
  const ratio = cost > 0 ? val / cost : (val > 0 ? Infinity : 0)
  return { step, valueScore: val, costScore: cost, ratio }
}))

function sortByRatioDesc(): void {
  const sorted = [...workingOrder.value].sort((a, b) => {
    const ra = (() => {
      const cal = (props.calendarCosts?.[a.name] ?? 0) + (props.capitalCosts?.[a.name] ?? 0)
      const va  = props.valueImpactByStep?.[a.name] ?? a.effortPercent ?? 0
      return cal > 0 ? va / cal : (va > 0 ? Number.POSITIVE_INFINITY : 0)
    })()
    const rb = (() => {
      const cal = (props.calendarCosts?.[b.name] ?? 0) + (props.capitalCosts?.[b.name] ?? 0)
      const vb  = props.valueImpactByStep?.[b.name] ?? b.effortPercent ?? 0
      return cal > 0 ? vb / cal : (vb > 0 ? Number.POSITIVE_INFINITY : 0)
    })()
    return rb - ra
  })
  workingOrder.value = sorted
}

function sortByCostAsc(): void {
  const sorted = [...workingOrder.value].sort((a, b) => {
    const ca = (props.calendarCosts?.[a.name] ?? 0) + (props.capitalCosts?.[a.name] ?? 0)
    const cb = (props.calendarCosts?.[b.name] ?? 0) + (props.capitalCosts?.[b.name] ?? 0)
    return ca - cb
  })
  workingOrder.value = sorted
}

function resetManual(): void {
  workingOrder.value = [...initialOrder]
}

function moveUp(idx: number): void {
  if (idx <= 0) return
  const next = [...workingOrder.value]
  const tmp  = next[idx - 1]
  next[idx - 1] = next[idx]
  next[idx]     = tmp
  workingOrder.value = next
}

function moveDown(idx: number): void {
  if (idx >= workingOrder.value.length - 1) return
  const next = [...workingOrder.value]
  const tmp  = next[idx + 1]
  next[idx + 1] = next[idx]
  next[idx]     = tmp
  workingOrder.value = next
}

function fmtRatio(r: number): string {
  if (!isFinite(r)) return r > 0 ? '∞' : '0'
  if (r === 0) return '0'
  if (r >= 10) return r.toFixed(0)
  return r.toFixed(2)
}

function fmtCost(c: number): string {
  if (c <= 0) return '—'
  if (c >= 1000) return `${(c / 1000).toFixed(1)}k`
  return c.toFixed(0)
}

function handleApply(): void {
  emit('apply', [...workingOrder.value])
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
      aria-label="Stage 6.2 — Prioritise Evo Steps"
      @click.self="handleClose"
    >
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 overflow-hidden flex flex-col" style="max-height: 88vh">
        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
          <span aria-hidden="true" class="text-base">📊</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold tracking-wide">6.2 Prioritise · Rank Evo Steps by Value / Cost ratio</h2>
            <p v-if="specName" class="text-[10px] text-indigo-100 truncate">Spec: {{ specName }} · {{ workingOrder.length }} Evo Step{{ workingOrder.length === 1 ? '' : 's' }}</p>
          </div>
          <CloseDot variant="on-dark" size="lg" title="Close · Cancel without saving" aria-label="Close panel" @click="handleClose" />
        </header>

        <!-- Sort controls (TOP — DD-014 mirror) -->
        <div class="flex flex-wrap items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            class="h-8 px-3 rounded-lg text-[11px] font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            title="Sort steps by Value / Cost ratio descending — the Planguage VDT default.  Highest-ratio steps deliver first."
            @click="sortByRatioDesc"
          >Sort by V / C ↓</button>
          <button
            type="button"
            class="h-8 px-3 rounded-lg text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            title="Sort steps by total Cost ascending — cheapest-first ordering when Value data is thin."
            @click="sortByCostAsc"
          >Sort by Cost ↑</button>
          <button
            type="button"
            class="h-8 px-3 rounded-lg text-[11px] font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            title="Reset to the original manual order (the order Evo Steps were generated / confirmed in)."
            @click="resetManual"
          >Reset to manual order</button>
          <div class="flex-1" />
          <span class="text-[10px] text-slate-500 italic">Drag with ↑ / ↓ buttons per row</span>
        </div>

        <!-- Body — ranked list -->
        <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-5 py-3">
          <p v-if="rows.length === 0" class="text-center text-sm text-slate-500 py-6 italic">
            No Evo Steps to prioritise yet.  Return to Stage 6.1 and generate Evo Steps first.
          </p>

          <ul v-else class="space-y-2">
            <li
              v-for="(row, idx) in rows"
              :key="row.step.name + ':' + idx"
              class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-300 transition-colors"
            >
              <!-- Rank -->
              <span class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center" :title="`Rank #${idx + 1}`">
                #{{ idx + 1 }}
              </span>

              <!-- Step name + linked Solutions count -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-800 truncate">{{ row.step.name }}</p>
                <p class="text-[10px] text-slate-500 truncate">
                  {{ row.step.linkedSolutions?.length ?? 0 }} Solution{{ (row.step.linkedSolutions?.length ?? 0) === 1 ? '' : 's' }} ·
                  {{ row.step.linkedValues?.length ?? 0 }} Value{{ (row.step.linkedValues?.length ?? 0) === 1 ? '' : 's' }} ·
                  {{ row.step.effortPercent }}% effort
                </p>
              </div>

              <!-- Value / Cost / Ratio -->
              <div class="flex-shrink-0 flex items-center gap-3 text-[11px] font-mono">
                <div class="flex flex-col items-end">
                  <span class="text-[9px] uppercase tracking-wider text-slate-500">Value</span>
                  <span class="text-violet-700 font-bold">{{ row.valueScore.toFixed(0) }}</span>
                </div>
                <div class="flex flex-col items-end">
                  <span class="text-[9px] uppercase tracking-wider text-slate-500">Cost</span>
                  <span class="text-amber-700 font-bold">{{ fmtCost(row.costScore) }}</span>
                </div>
                <div class="flex flex-col items-end">
                  <span class="text-[9px] uppercase tracking-wider text-slate-500">V / C</span>
                  <span class="text-indigo-700 font-extrabold text-sm">{{ fmtRatio(row.ratio) }}</span>
                </div>
              </div>

              <!-- Reorder buttons -->
              <div class="flex-shrink-0 flex flex-col gap-0.5">
                <button
                  type="button"
                  :disabled="idx === 0"
                  class="w-7 h-6 rounded-md text-xs font-bold flex items-center justify-center transition-colors"
                  :class="idx === 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-200 text-slate-700 hover:bg-indigo-200'"
                  title="Move this step up by one rank"
                  aria-label="Move up"
                  @click="moveUp(idx)"
                >↑</button>
                <button
                  type="button"
                  :disabled="idx === rows.length - 1"
                  class="w-7 h-6 rounded-md text-xs font-bold flex items-center justify-center transition-colors"
                  :class="idx === rows.length - 1 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-200 text-slate-700 hover:bg-indigo-200'"
                  title="Move this step down by one rank"
                  aria-label="Move down"
                  @click="moveDown(idx)"
                >↓</button>
              </div>
            </li>
          </ul>

          <p class="text-[10px] text-slate-500 italic mt-4 leading-relaxed">
            VDT methodology — Planguage Value Decision Table.  Cost is calendar + capital (Stage 4
            estimates).  Value is impact-percent across linked Solutions × Values.  When data is
            thin, effortPercent is used as a Value proxy (an honest Cost-of-Work signal).
            Apply finalises the order on the canonical confirmedSteps array via Universal Undo.
          </p>
        </ScrollContainer>

        <!-- Footer actions (BOTTOM — DD-014 mirror) -->
        <footer class="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            class="h-9 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            title="Cancel without applying any reorder"
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
            title="Apply the new priority order to the confirmed Evo Steps (reversible via Universal Undo ⌘Z)"
            @click="handleApply"
          >✅ Apply Priority Order</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
