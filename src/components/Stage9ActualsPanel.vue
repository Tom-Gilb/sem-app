<!-- UNIT_TYPE=Widget
     Stage9ActualsPanel.vue — Stage 9 Study-Act actuals-capture focused modal.

     Tom Gilb 2026-06-22 verbatim: "we need a clear skip over this step is
     there are no evo results yet. and if there are we need a clear input
     capture into Values and resources to manually enter results or lack of
     them. Please build a suggestion".

     Mounts when the Stage 9 triage banner state-2 ("Evo step delivered but
     no actuals captured") action pin fires.  Provides a focused modal with
     ONE job:
       1. Show every V. entry (Value) with its Goal level + an `actual`
          number input + a (computed) Variance percentage.  Optional
          "Not measured this cycle" radio with a reason text field.
       2. Show every R. entry (Resource) with budgeted vs spent.
       3. Apply Actuals — writes back to spec.values[*].status and
          spec.resources[*].status with a provenance stamp
          "Source: Study-Act actuals · YYYY-MM-DD · Evo Step «name»".

     Composes WITH:
       • Universal Undo SUPREME — host (App.vue) wraps the apply event in
         undoHistory.record() BEFORE mutation.
       • No-Silent-Data-Loss SUPREME — Apply event carries the full updated
         SpecBlock; Cancel discards without saving (explicit).
       • Stage-Has-A-Purpose SUPREME — Stage 9 purpose is *measure actuals,
         compare to estimates, decide next cycle*.
       • ScrollContainer rule — body wrapped.
       • CloseDot rule — top-right close + backdrop click + Escape via host.
       • DD-009 Zero-Training UI — every pin has a `title=` HoverHint.
       • DD-017 R-G colorblind-safe — emerald/violet/amber families on white.
       • Spell-out-Type-Names SUPREME — "Value" / "Resource" / "Variance"
         spelled out in UI text.
       • Banned word `toast` → `notification` — UI text uses "notification". -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { SpecBlock, VEntry, REntry, EvoStep } from '../types/spec'
import {
  useResourceEstimations,
  RESOURCE_META,
  type Currency,
  type TimeUnit,
} from '../composables/useResourceEstimations'

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
  /** Confirmed Evo Steps from App.vue — used to label the "current cycle" provenance stamp. */
  confirmedSteps?: EvoStep[]
  /** Plan id (used for the useResourceEstimations composable — v506 IBM Cleanroom auto-trigger). */
  planId?: string
}>()

const emit = defineEmits<{
  close: []
  apply: [updatedSpec: SpecBlock]
  /** v506 — ESTIMATION 5: emitted when the Evo-step actuals push new estimations. */
  'estimations-updated': [count: number]
}>()

// v506 — ESTIMATION 5: Evo step completion actuals auto-trigger re-estimation.
// Tom Gilb 2026-07-21: "an important trigger for reestimation of future
// resources … evo step measures reported costs and calendar time … practice
// of IBM cleanroom (Mills) as reporten in my PoSEM 1988 book".
const planIdRef = computed(() => props.planId ?? props.spec?.name ?? 'default')
const { estimateFromEvoStepActuals } = useResourceEstimations(planIdRef)

// Reported-actuals refs for the 5 central resources.  These are separate from
// the per-R.-entry `spent` inputs above: those write status text to spec R.
// entries; these push new Estimation events into the resource-estimation
// series so future-resource projections re-calibrate.
const reportedCapital = ref<string>('')
const reportedCapitalCurrency = ref<Currency>('USD')
const reportedTime = ref<string>('')
const reportedTimeUnit = ref<TimeUnit>('weeks')
const reportedHuman = ref<string>('')
// v508 — OPEX reported actuals
const reportedAnnualOverhead = ref<string>('')
const reportedAnnualOverheadCurrency = ref<Currency>('USD')
const reportedTechnicalDebt = ref<string>('')
const reportedTechnicalDebtCurrency = ref<Currency>('USD')
const reportedNote = ref<string>('')

const CURRENCY_OPTIONS: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NOK', 'SEK', 'DKK']
const TIME_UNIT_OPTIONS: TimeUnit[] = ['days', 'weeks', 'months', 'years']

// ── Per-Value actuals state (keyed by V.id) ─────────────────────────────────
interface ValueActualInput {
  actual: string          // free text — planner types a number
  notMeasured: boolean
  reason: string
}
interface ResourceActualInput {
  spent: string
  notMeasured: boolean
  reason: string
}

const valueInputs = ref<Record<string, ValueActualInput>>({})
const resourceInputs = ref<Record<string, ResourceActualInput>>({})

function getV(id: string): ValueActualInput {
  if (!valueInputs.value[id]) {
    valueInputs.value[id] = { actual: '', notMeasured: false, reason: '' }
  }
  return valueInputs.value[id]
}
function getR(id: string): ResourceActualInput {
  if (!resourceInputs.value[id]) {
    resourceInputs.value[id] = { spent: '', notMeasured: false, reason: '' }
  }
  return resourceInputs.value[id]
}

// ── Lists ───────────────────────────────────────────────────────────────────
const valueEntries = computed<VEntry[]>(() => props.spec?.values ?? [])
const resourceEntries = computed<REntry[]>(() => props.spec?.resources ?? [])

// ── Variance computation (loose — strip non-numeric chars) ──────────────────
function parseLoose(raw: string): number | null {
  if (!raw) return null
  const m = String(raw).match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}
function varianceLabel(goalRaw: string, actualRaw: string): string {
  const g = parseLoose(goalRaw)
  const a = parseLoose(actualRaw)
  if (g == null || a == null || g === 0) return '—'
  const pct = ((a - g) / g) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}
function varianceTone(goalRaw: string, actualRaw: string): string {
  const g = parseLoose(goalRaw)
  const a = parseLoose(actualRaw)
  if (g == null || a == null || g === 0) return 'text-slate-500'
  const pct = ((a - g) / g) * 100
  if (Math.abs(pct) < 5) return 'text-emerald-700'
  if (Math.abs(pct) < 20) return 'text-amber-700'
  return 'text-rose-700'
}

// ── Provenance stamp ────────────────────────────────────────────────────────
const currentEvoStepName = computed(() => {
  const list = props.confirmedSteps ?? []
  if (list.length === 0) return 'unspecified Evo Step'
  return list[list.length - 1]?.name ?? `Evo Step ${list.length}`
})
function provenanceStamp(): string {
  const d = new Date().toISOString().slice(0, 10)
  return `Source: Study-Act actuals · ${d} · ${currentEvoStepName.value}`
}

// ── Apply / Cancel handlers ─────────────────────────────────────────────────
function onApply(): void {
  if (!props.spec) return
  // Deep clone to avoid mutating the prop directly.
  const updated: SpecBlock = JSON.parse(JSON.stringify(props.spec))
  const stamp = provenanceStamp()

  let valuesUpdated = 0
  let resourcesUpdated = 0

  for (const v of updated.values ?? []) {
    const input = valueInputs.value[v.id]
    if (!input) continue
    if (input.notMeasured && input.reason.trim()) {
      v.status = `Not measured this cycle — ${input.reason.trim()}  [${stamp}]`
      valuesUpdated++
    } else if (input.actual.trim()) {
      v.status = `${input.actual.trim()}  [${stamp}]`
      valuesUpdated++
    }
  }

  for (const r of updated.resources ?? []) {
    const input = resourceInputs.value[r.id]
    if (!input) continue
    if (input.notMeasured && input.reason.trim()) {
      r.status = `Not measured this cycle — ${input.reason.trim()}  [${stamp}]`
      resourcesUpdated++
    } else if (input.spent.trim()) {
      r.status = `${input.spent.trim()}  [${stamp}]`
      resourcesUpdated++
    }
  }

  // v506 — ESTIMATION 5: fire auto-re-estimation from the reported central-
  // resource actuals BEFORE the emit so the estimation subsystem (which
  // persists to its own localStorage keyspace) picks up the new events.
  // v508 — extended to include OPEX (Annual Overhead + Technical Debt).
  const parsedCapital  = parseLoose(reportedCapital.value)
  const parsedTime     = parseLoose(reportedTime.value)
  const parsedHuman    = parseLoose(reportedHuman.value)
  const parsedOverhead = parseLoose(reportedAnnualOverhead.value)
  const parsedDebt     = parseLoose(reportedTechnicalDebt.value)
  const newEstimations = estimateFromEvoStepActuals(currentEvoStepName.value, {
    reportedCapital:         parsedCapital ?? undefined,
    reportedCapitalCurrency: reportedCapitalCurrency.value,
    reportedTime:            parsedTime ?? undefined,
    reportedTimeUnit:        reportedTimeUnit.value,
    reportedHuman:           parsedHuman ?? undefined,
    // v508 — OPEX
    reportedAnnualOverhead:         parsedOverhead ?? undefined,
    reportedAnnualOverheadCurrency: reportedAnnualOverheadCurrency.value,
    reportedTechnicalDebt:          parsedDebt ?? undefined,
    reportedTechnicalDebtCurrency:  reportedTechnicalDebtCurrency.value,
    note:                    reportedNote.value.trim() || undefined,
  })
  if (newEstimations.length > 0) {
    emit('estimations-updated', newEstimations.length)
  }

  // No-Silent-Data-Loss: emit apply if anything was captured (spec status OR
  // resource-estimation events).
  if (valuesUpdated === 0 && resourcesUpdated === 0 && newEstimations.length === 0) {
    emit('close')
    return
  }
  emit('apply', updated)
}

function onCancel(): void {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="stage9-actuals">
      <div v-if="open" class="fixed inset-0 z-[700]">
        <!-- Backdrop: click to close (CloseDot rule). -->
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="onCancel" />

        <!-- Panel -->
        <section
          class="absolute inset-4 md:inset-10 lg:inset-16 rounded-2xl bg-white shadow-2xl
                 ring-1 ring-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Stage 9 · Study-Act · Capture Actuals"
        >
          <!-- Header -->
          <header class="flex items-start justify-between px-6 py-4
                         bg-gradient-to-br from-violet-50 to-indigo-50 border-b border-violet-200">
            <div class="flex items-center gap-4">
              <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-2 select-none
                          bg-gradient-to-r from-violet-500 to-indigo-500
                          shadow-lg ring-2 ring-violet-300/40">
                <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                      aria-hidden="true">9</span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-violet-100">Stage Now</span>
                  <span class="text-base font-extrabold text-white">Study-Act</span>
                </span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-violet-900">Capture Actuals</h2>
                <p class="text-[12px] text-violet-700/80">
                  {{ valueEntries.length }} Value{{ valueEntries.length === 1 ? '' : 's' }} ·
                  {{ resourceEntries.length }} Resource{{ resourceEntries.length === 1 ? '' : 's' }} ·
                  Cycle: <span class="font-semibold">{{ currentEvoStepName }}</span>
                </p>
              </div>
            </div>
            <CloseDot size="lg" aria-label="Close · discard input" @click="onCancel" />
          </header>

          <!-- Body -->
          <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-6 py-5 space-y-6">

            <!-- Purpose banner -->
            <div class="rounded-xl border-2 border-violet-300 bg-violet-50/60 p-4">
              <p class="text-[13px] text-violet-900 leading-relaxed">
                <strong>Purpose:</strong> measure what the just-delivered Evo Step actually produced
                — compare against the Goal you committed to — decide what changes next cycle.
                Empty rows are fine; partial measurement is a real and useful answer.
              </p>
            </div>

            <!-- Values section -->
            <div v-if="valueEntries.length === 0"
                 class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600 italic">
              No Value entries in this Spec — nothing to capture.
            </div>
            <section v-else>
              <h3 class="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 mb-2">
                Value actuals
              </h3>
              <div class="space-y-3">
                <div
                  v-for="v in valueEntries"
                  :key="v.id"
                  class="rounded-xl border border-violet-200 bg-white p-4"
                >
                  <div class="flex items-start gap-2 mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-violet-600 mt-0.5">Value</span>
                    <span class="flex-1 text-[13px] font-bold text-slate-900">{{ v.id }}</span>
                  </div>
                  <p class="text-[11px] text-slate-600 mb-2">{{ v.description }}</p>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                    <div>
                      <div class="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Goal (committed)</div>
                      <div class="px-2 py-1.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                        {{ v.goal || '—' }}
                      </div>
                    </div>
                    <div>
                      <label :for="`v-actual-${v.id}`" class="text-[10px] font-semibold uppercase text-slate-500 mb-0.5 block">
                        Actual (this cycle)
                      </label>
                      <input
                        :id="`v-actual-${v.id}`"
                        v-model="getV(v.id).actual"
                        type="text"
                        placeholder="e.g. 87%, 4.2s, 1200/day"
                        :disabled="getV(v.id).notMeasured"
                        class="w-full px-2 py-1.5 rounded border border-violet-300 bg-white font-mono text-[11px]
                               focus:outline-none focus:ring-2 focus:ring-violet-400
                               disabled:bg-slate-100 disabled:text-slate-400"
                        :title="`Type the actual measured Value for ${v.id} this Evo cycle. Leave empty if not measured.`"
                      />
                    </div>
                    <div>
                      <div class="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Variance vs Goal</div>
                      <div :class="['px-2 py-1.5 rounded bg-slate-100 font-mono text-[11px] font-bold', varianceTone(v.goal, getV(v.id).actual)]">
                        {{ varianceLabel(v.goal, getV(v.id).actual) }}
                      </div>
                    </div>
                  </div>
                  <div class="mt-2 flex items-center gap-3 text-[11px]">
                    <label class="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                      <input
                        v-model="getV(v.id).notMeasured"
                        type="checkbox"
                        class="rounded border-violet-300 text-violet-600 focus:ring-violet-400"
                        :title="`Mark this Value as 'not measured this cycle' — captures the absence as a real observation`"
                      />
                      <span>Not measured this cycle</span>
                    </label>
                    <input
                      v-if="getV(v.id).notMeasured"
                      v-model="getV(v.id).reason"
                      type="text"
                      placeholder="Reason — e.g. instrument offline, scope deferred"
                      class="flex-1 px-2 py-1 rounded border border-amber-300 bg-amber-50 text-[11px]
                             focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>
            </section>

            <!-- Resources section -->
            <section v-if="resourceEntries.length > 0">
              <h3 class="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 mb-2">
                Resource actuals
              </h3>
              <div class="space-y-3">
                <div
                  v-for="r in resourceEntries"
                  :key="r.id"
                  class="rounded-xl border border-emerald-200 bg-white p-4"
                >
                  <div class="flex items-start gap-2 mb-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mt-0.5">Resource</span>
                    <span class="flex-1 text-[13px] font-bold text-slate-900">{{ r.id }}</span>
                  </div>
                  <p class="text-[11px] text-slate-600 mb-2">{{ r.description }}</p>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                    <div>
                      <div class="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Tolerable / Budget</div>
                      <div class="px-2 py-1.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                        {{ r.tolerable || '—' }}
                      </div>
                    </div>
                    <div>
                      <label :for="`r-spent-${r.id}`" class="text-[10px] font-semibold uppercase text-slate-500 mb-0.5 block">
                        Spent (this cycle)
                      </label>
                      <input
                        :id="`r-spent-${r.id}`"
                        v-model="getR(r.id).spent"
                        type="text"
                        placeholder="e.g. 38h, $1200, 4 specialists"
                        :disabled="getR(r.id).notMeasured"
                        class="w-full px-2 py-1.5 rounded border border-emerald-300 bg-white font-mono text-[11px]
                               focus:outline-none focus:ring-2 focus:ring-emerald-400
                               disabled:bg-slate-100 disabled:text-slate-400"
                        :title="`Type the actual Resource spent for ${r.id} this Evo cycle.`"
                      />
                    </div>
                    <div>
                      <div class="text-[10px] font-semibold uppercase text-slate-500 mb-0.5">Variance vs Tolerable</div>
                      <div :class="['px-2 py-1.5 rounded bg-slate-100 font-mono text-[11px] font-bold', varianceTone(r.tolerable, getR(r.id).spent)]">
                        {{ varianceLabel(r.tolerable, getR(r.id).spent) }}
                      </div>
                    </div>
                  </div>
                  <div class="mt-2 flex items-center gap-3 text-[11px]">
                    <label class="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
                      <input
                        v-model="getR(r.id).notMeasured"
                        type="checkbox"
                        class="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-400"
                      />
                      <span>Not measured this cycle</span>
                    </label>
                    <input
                      v-if="getR(r.id).notMeasured"
                      v-model="getR(r.id).reason"
                      type="text"
                      placeholder="Reason — e.g. tracking system down"
                      class="flex-1 px-2 py-1 rounded border border-amber-300 bg-amber-50 text-[11px]
                             focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>
            </section>

            <!-- v506 — ESTIMATION 5: Central Resources Reported for this Evo Step.
                 Feeds the resource-estimation auto-trigger (IBM Cleanroom /
                 PoSEM 1988 §17 / Mills).  Distinct from the per-R.-entry
                 spent above: those write Value.status/Resource.status; this
                 pushes new Estimation events so future-resource projections
                 re-calibrate on every completed Evo cycle. -->
            <section>
              <h3 class="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700 mb-1">
                Central Resources Reported (this Evo Step)
              </h3>
              <p class="text-[11px] text-indigo-700/80 italic mb-3">
                Capital · Calendar Time · Specialist Staff — completed-step actuals feed the
                resource-estimation series (IBM Cleanroom incremental-measurement practice; PoSEM 1988).
                Fill only what you measured; empty rows do nothing.
              </p>
              <div class="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <!-- Capital -->
                <div class="grid grid-cols-[130px_1fr_auto] gap-3 items-end">
                  <div>
                    <div class="text-[10px] font-semibold uppercase text-indigo-700 mb-0.5">
                      {{ RESOURCE_META.capitalCost.label }}
                    </div>
                    <div class="text-[10px] text-slate-500">{{ RESOURCE_META.capitalCost.hint }}</div>
                  </div>
                  <input
                    v-model="reportedCapital"
                    type="text"
                    placeholder="e.g. 42000"
                    class="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white font-mono text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Reported Capital actually spent completing this Evo Step. Numeric value; currency picker at right."
                  />
                  <select
                    v-model="reportedCapitalCurrency"
                    class="px-2 py-1.5 rounded border border-indigo-300 bg-white text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Currency for the reported Capital amount"
                  >
                    <option v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <!-- Calendar Time -->
                <div class="grid grid-cols-[130px_1fr_auto] gap-3 items-end">
                  <div>
                    <div class="text-[10px] font-semibold uppercase text-indigo-700 mb-0.5">
                      {{ RESOURCE_META.calendarTime.label }}
                    </div>
                    <div class="text-[10px] text-slate-500">{{ RESOURCE_META.calendarTime.hint }}</div>
                  </div>
                  <input
                    v-model="reportedTime"
                    type="text"
                    placeholder="e.g. 6"
                    class="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white font-mono text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Reported Calendar Time this Evo Step took (elapsed wall-clock time). Numeric value; unit picker at right."
                  />
                  <select
                    v-model="reportedTimeUnit"
                    class="px-2 py-1.5 rounded border border-indigo-300 bg-white text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Time unit for the reported Calendar Time"
                  >
                    <option v-for="u in TIME_UNIT_OPTIONS" :key="u" :value="u">{{ u }}</option>
                  </select>
                </div>
                <!-- Specialist Staff -->
                <div class="grid grid-cols-[130px_1fr_auto] gap-3 items-end">
                  <div>
                    <div class="text-[10px] font-semibold uppercase text-indigo-700 mb-0.5">
                      {{ RESOURCE_META.specialistStaff.label }}
                    </div>
                    <div class="text-[10px] text-slate-500">Full-Time Equivalents</div>
                  </div>
                  <input
                    v-model="reportedHuman"
                    type="text"
                    placeholder="e.g. 3.5"
                    class="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white font-mono text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Reported Full-Time-Equivalent specialist staff assigned to this Evo Step."
                  />
                  <span class="text-[11px] text-slate-500 px-2">FTE</span>
                </div>
                <!-- v508 — Annual Overhead (OPEX) -->
                <div class="grid grid-cols-[130px_1fr_auto] gap-3 items-end">
                  <div>
                    <div class="text-[10px] font-semibold uppercase text-indigo-700 mb-0.5">
                      {{ RESOURCE_META.annualOverhead.label }}
                    </div>
                    <div class="text-[10px] text-slate-500">{{ RESOURCE_META.annualOverhead.hint }}</div>
                  </div>
                  <input
                    v-model="reportedAnnualOverhead"
                    type="text"
                    placeholder="e.g. 48000"
                    class="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white font-mono text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Reported Annual Overhead for the System of Concern (hosting + licences + support + admin). Detailed breakdown lives in Stage 10 Resources → Estimations per-entry."
                  />
                  <select
                    v-model="reportedAnnualOverheadCurrency"
                    class="px-2 py-1.5 rounded border border-indigo-300 bg-white text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Currency for the reported Annual Overhead"
                  >
                    <option v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <!-- v508 — Technical Debt (OPEX) -->
                <div class="grid grid-cols-[130px_1fr_auto] gap-3 items-end">
                  <div>
                    <div class="text-[10px] font-semibold uppercase text-indigo-700 mb-0.5">
                      {{ RESOURCE_META.technicalDebt.label }}
                    </div>
                    <div class="text-[10px] text-slate-500">{{ RESOURCE_META.technicalDebt.hint }}</div>
                  </div>
                  <input
                    v-model="reportedTechnicalDebt"
                    type="text"
                    placeholder="e.g. 15000"
                    class="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white font-mono text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Reported Technical Debt carrying cost (deferred refactor / architectural compromise). Detailed breakdown lives in Stage 10 Resources → Estimations per-entry."
                  />
                  <select
                    v-model="reportedTechnicalDebtCurrency"
                    class="px-2 py-1.5 rounded border border-indigo-300 bg-white text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Currency for the reported Technical Debt"
                  >
                    <option v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <!-- Note -->
                <div>
                  <div class="text-[10px] font-semibold uppercase text-indigo-700 mb-0.5">
                    Planner Note (optional)
                  </div>
                  <input
                    v-model="reportedNote"
                    type="text"
                    placeholder="e.g. 2 unexpected UX rework rounds; scope creep on report exports"
                    class="w-full px-2 py-1.5 rounded border border-indigo-300 bg-white text-[11px]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="Optional context added to the new Estimation entries' reasoning field."
                  />
                </div>
                <p class="text-[10px] text-indigo-800/70 italic pt-1">
                  On Apply, each populated field pushes a new Estimation event
                  <span class="font-semibold">(source: planner · cause: Evo Step Completion Actuals)</span>
                  visible in Stage 10 Resources → Estimations history.
                </p>
              </div>
            </section>
          </ScrollContainer>

          <!-- Footer action row (DD-014 Top-and-Bottom Nav Mirror) -->
          <footer class="flex items-center justify-between gap-3 px-6 py-4 border-t border-violet-200 bg-violet-50/50">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-700
                     bg-white border border-slate-300 hover:bg-slate-50
                     focus:outline-none focus:ring-2 focus:ring-slate-400"
              title="Discard input · close without saving (CloseDot, Escape, or backdrop also close)"
              @click="onCancel"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-5 py-2 rounded-lg text-[13px] font-bold text-white
                     bg-gradient-to-r from-emerald-500 to-teal-500
                     hover:from-emerald-600 hover:to-teal-600
                     shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
              title="Apply Actuals · writes captured measurements to Value.status and Resource.status with a Study-Act provenance stamp · reversible via global Undo (⌘Z)"
              @click="onApply"
            >
              📥 Apply Actuals
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.stage9-actuals-enter-active,
.stage9-actuals-leave-active {
  transition: opacity 180ms ease;
}
.stage9-actuals-enter-from,
.stage9-actuals-leave-to {
  opacity: 0;
}
</style>
