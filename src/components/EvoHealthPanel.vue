<!-- UNIT_TYPE=Panel -->
<!--
/**
 * EvoHealthPanel — Evo Health Tool (EHT) v1.
 *
 * SOURCE: Tom Gilb 2026-06-03 — see header of src/data/evoHealth.ts.
 *
 * Mirrors PHI structure but scoped to Evo Steps + short-term focus.
 *
 * v1 (this commit) ships:
 *   - Scope picker (Next Step / Next 5 / All) — Tom's 3 explicit settings
 *   - Defect list (uses mock detector for now — real detector in v2)
 *   - Severity badges (green/orange/red)
 *   - "Cure" panel preview — read-only list of suggested cures with risk ratings
 *   - Approval UI scaffold (placeholder Approve buttons; v2 wires actual mutation + audit log)
 *   - "Load Example" demo button
 *
 * v2 ships:
 *   - Real deterministic defect detector (replaces buildMockEHSet)
 *   - Cure application (actual edit of step / task / spec)
 *   - Per-cure approval with reviewer identity, email-to-Owner, audit log
 *   - Auto-mode vs Manual-mode toggle
 *   - Approve in groups (Step / Task / other) + Approve All buttons
 *   - Per-version audit-log persistence (cures + approvals stored on the plan)
 *
 * Rules complied with:
 *   - Single-Surface: caller registers `evoHealth` exclusive surface
 *   - ScrollContainer: body wrapped
 *   - CloseDot: header end-of-flex
 *   - Planguage-Glyph-First: emoji in header label, no inline SVG icons
 *   - AI-Max: defect detection is deterministic + Cure proposals can be
 *     Claudian-generated via file-read pattern (no in-app API calls)
 */
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import {
  type EHScope,
  type EHSeverity,
  type EHSet,
  EH_SCOPE_LABELS,
  buildMockEHSet,
  buildEmptySet,
  storageKey,
} from '../data/evoHealth'
import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  steps: EvoStep[]
  planId?: string
  /** Default reviewer name for approvals — pulled from Settings (default 'Tom'). */
  defaultReviewerName?: string
}>()

defineEmits<{ close: [] }>()

// ── Persisted set (localStorage) ─────────────────────────────────────────────

const planIdRef = computed(() => props.planId ?? 'default')

function loadSet(): EHSet {
  try {
    const raw = localStorage.getItem(storageKey(planIdRef.value))
    if (!raw) return buildEmptySet(planIdRef.value)
    const parsed = JSON.parse(raw)
    return parsed as EHSet
  } catch {
    return buildEmptySet(planIdRef.value)
  }
}

function saveSet(s: EHSet): void {
  try {
    localStorage.setItem(storageKey(planIdRef.value), JSON.stringify(s))
  } catch { /* quota */ }
}

const ehSet = ref<EHSet>(loadSet())

watch(ehSet, (s) => saveSet(s), { deep: true })
watch(planIdRef, () => { ehSet.value = loadSet() })

// ── Actions ──────────────────────────────────────────────────────────────────

function setScope(scope: EHScope): void {
  ehSet.value = { ...ehSet.value, scope }
}

function detectMock(): void {
  // v1: mock detector. v2: replace with real deterministic detector.
  ehSet.value = buildMockEHSet(planIdRef.value, props.steps, ehSet.value.scope)
}

function clearAll(): void {
  if (confirm('Clear all detected defects + approval log for this plan?')) {
    ehSet.value = buildEmptySet(planIdRef.value)
  }
}

// Approval scaffold — v1 stores the approval intent; v2 wires email + mutation.
const reviewerName = ref<string>(props.defaultReviewerName ?? 'Tom')
const reviewNoteById = ref<Record<string, string>>({})

function approveCure(cureId: string): void {
  ehSet.value.approvals.push({
    id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cureId,
    approvedBy: reviewerName.value,
    reviewedAt: Date.now(),
    note: reviewNoteById.value[cureId],
    status: 'approved',
  })
  ehSet.value = { ...ehSet.value }
}
function rejectCure(cureId: string): void {
  ehSet.value.approvals.push({
    id: `rej-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cureId,
    approvedBy: reviewerName.value,
    reviewedAt: Date.now(),
    note: reviewNoteById.value[cureId],
    status: 'rejected',
  })
  ehSet.value = { ...ehSet.value }
}

// Bulk approval — Tom's "approve in groups (Step, Task, other), All"
function approveAll(): void {
  if (!confirm(`Approve ALL ${ehSet.value.defects.length} suggested cures as ${reviewerName.value}?`)) return
  for (const d of ehSet.value.defects) {
    if (!d.suggestedCure) continue
    if (ehSet.value.approvals.some(a => a.cureId === d.suggestedCure!.id && a.status === 'approved')) continue
    approveCure(d.suggestedCure.id)
  }
}

// ── Computed displays ────────────────────────────────────────────────────────

function severityChip(sev: EHSeverity): { label: string; classes: string } {
  switch (sev) {
    case 'red':    return { label: 'RED',    classes: 'bg-red-100 text-red-700 border-red-300' }
    case 'orange': return { label: 'ORANGE', classes: 'bg-amber-100 text-amber-700 border-amber-300' }
    case 'green':  return { label: 'GREEN',  classes: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
  }
}

const redCount = computed(() => ehSet.value.defects.filter(d => d.severity === 'red').length)
const orangeCount = computed(() => ehSet.value.defects.filter(d => d.severity === 'orange').length)
const greenCount = computed(() => ehSet.value.defects.filter(d => d.severity === 'green').length)
const totalDefects = computed(() => ehSet.value.defects.length)

function isApproved(cureId: string): boolean {
  return ehSet.value.approvals.some(a => a.cureId === cureId && a.status === 'approved')
}
function isRejected(cureId: string): boolean {
  return ehSet.value.approvals.some(a => a.cureId === cureId && a.status === 'rejected')
}

function fmtDateTime(ms: number): string { return new Date(ms).toLocaleString() }
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eh-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-sky-700 to-cyan-600 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">🩺</span>
          <div class="flex-1 min-w-0">
            <h2 id="eh-title" class="text-base font-bold">Evo Health Tool (EHT)</h2>
            <p class="text-[11px] text-sky-100 mt-0.5">
              Short-term Evo-Step health · {{ totalDefects }} defect{{ totalDefects === 1 ? '' : 's' }}
              <span v-if="redCount > 0" class="ml-1">· <span class="text-red-200 font-bold">{{ redCount }} red</span></span>
              <span v-if="orangeCount > 0" class="ml-1">· <span class="text-amber-200 font-bold">{{ orangeCount }} orange</span></span>
              <span v-if="greenCount > 0" class="ml-1">· <span class="text-emerald-200 font-bold">{{ greenCount }} green</span></span>
              <span class="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/20">v1 scaffold — real detector + Cure in v2</span>
            </p>
          </div>
          <CloseDot variant="on-dark" aria-label="Close Evo Health Tool" @click="$emit('close')" />
        </header>

        <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-5 space-y-5">

          <!-- Scope picker — Tom's 3 explicit settings -->
          <section class="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-sky-700 mb-2">Scope</h3>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="(meta, key) in EH_SCOPE_LABELS"
                :key="key"
                type="button"
                class="rounded-lg border-2 px-3 py-2 text-left transition-colors"
                :class="ehSet.scope === key
                  ? 'border-sky-500 bg-white text-sky-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'"
                :title="meta.description"
                @click="setScope(key as EHScope)"
              >
                <p class="text-sm font-bold">{{ meta.label }}</p>
                <p class="text-[10px] text-slate-500 mt-0.5">{{ meta.description }}</p>
              </button>
            </div>
          </section>

          <!-- Detect / Load / Clear actions -->
          <section class="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold hover:bg-sky-700"
              title="Run the deterministic defect detector against the steps in scope (v1: mock detector — flags steps missing linkedSolutions / linkedValues / with vague descriptions)"
              @click="detectMock"
            >Detect Defects (v1 mock)</button>
            <button
              v-if="totalDefects > 0"
              type="button"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
              title="Approve ALL cures with current reviewer name. v1 stores intent; v2 applies the cures to the plan + emails Owner."
              @click="approveAll"
            >Approve All</button>
            <button
              v-if="totalDefects > 0"
              type="button"
              class="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
              title="Clear defects + approval log for this plan"
              @click="clearAll"
            >Clear All</button>
            <label class="ml-auto text-xs text-slate-600 flex items-center gap-1.5">
              Reviewer:
              <input
                v-model="reviewerName"
                type="text"
                class="rounded border border-slate-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 w-24"
                title="Stamped onto every approval / rejection in the audit log"
              />
            </label>
          </section>

          <!-- Defect list -->
          <section v-if="totalDefects === 0" class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <p class="text-sm text-slate-700">No defects detected yet.  Click <strong>Detect Defects</strong> to run the v1 mock detector against the {{ EH_SCOPE_LABELS[ehSet.scope].label.toLowerCase() }}.</p>
          </section>

          <section v-else class="space-y-2">
            <h3 class="text-xs font-bold uppercase tracking-wide text-slate-700">Detected Defects + Suggested Cures</h3>
            <article
              v-for="d in ehSet.defects"
              :key="d.id"
              class="rounded-xl border-2 bg-white overflow-hidden"
              :class="d.severity === 'red' ? 'border-red-300' : d.severity === 'orange' ? 'border-amber-300' : 'border-emerald-300'"
            >
              <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border" :class="severityChip(d.severity).classes">{{ severityChip(d.severity).label }}</span>
                <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">{{ d.category }}</span>
                <h4 class="text-sm font-bold text-slate-800 flex-1">{{ d.title }}</h4>
                <span v-if="d.stepName" class="text-[10px] font-mono text-slate-500">on: {{ d.stepName }}</span>
              </header>
              <div class="p-3 space-y-2">
                <p class="text-xs text-slate-700">{{ d.description }}</p>

                <!-- Suggested Cure -->
                <div v-if="d.suggestedCure" class="rounded-lg bg-indigo-50 border border-indigo-200 p-2.5 space-y-1.5">
                  <div class="flex items-center gap-2">
                    <span class="text-[9px] font-bold uppercase tracking-wide text-indigo-700">Suggested Cure</span>
                    <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border" :class="severityChip(d.suggestedCure.riskRating).classes">Risk: {{ severityChip(d.suggestedCure.riskRating).label }}</span>
                    <span class="text-[9px] font-mono text-slate-500">{{ d.suggestedCure.kind }}</span>
                  </div>
                  <p class="text-xs font-semibold text-slate-800">{{ d.suggestedCure.title }}</p>
                  <p class="text-[11px] text-slate-700">{{ d.suggestedCure.description }}</p>
                  <p class="text-[11px] text-slate-600 italic"><span class="font-semibold not-italic">Why:</span> {{ d.suggestedCure.reason }}</p>

                  <!-- Approve / Reject (v1: records intent; v2: applies the cure + emails Owner) -->
                  <div v-if="!isApproved(d.suggestedCure.id) && !isRejected(d.suggestedCure.id)" class="pt-1 space-y-1.5">
                    <input
                      v-model="reviewNoteById[d.suggestedCure.id]"
                      type="text"
                      placeholder="Optional review note…"
                      class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                    <div class="flex gap-2">
                      <button type="button" class="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700" :title="`Approve as ${reviewerName}.  v1: recorded in audit log.  v2: applies the cure + emails Owner.`" @click="approveCure(d.suggestedCure!.id)">Approve</button>
                      <button type="button" class="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700" :title="`Reject as ${reviewerName}.  Audit log entry recorded.`" @click="rejectCure(d.suggestedCure!.id)">Reject</button>
                    </div>
                  </div>
                  <p v-else-if="isApproved(d.suggestedCure.id)" class="text-[11px] text-emerald-700 font-semibold pt-1">
                    ✓ Approved by {{ ehSet.approvals.find(a => a.cureId === d.suggestedCure!.id)?.approvedBy }} at {{ fmtDateTime(ehSet.approvals.find(a => a.cureId === d.suggestedCure!.id)?.reviewedAt ?? 0) }}
                  </p>
                  <p v-else class="text-[11px] text-red-700 font-semibold pt-1">
                    ✗ Rejected by {{ ehSet.approvals.find(a => a.cureId === d.suggestedCure!.id)?.approvedBy }} at {{ fmtDateTime(ehSet.approvals.find(a => a.cureId === d.suggestedCure!.id)?.reviewedAt ?? 0) }}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <!-- Approval audit log -->
          <section v-if="ehSet.approvals.length > 0" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 class="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">Approval Audit Log ({{ ehSet.approvals.length }})</h3>
            <ul class="text-[11px] space-y-1">
              <li v-for="a in ehSet.approvals" :key="a.id" class="flex items-center gap-2">
                <span class="font-mono text-slate-500">{{ fmtDateTime(a.reviewedAt) }}</span>
                <span class="font-semibold" :class="a.status === 'approved' ? 'text-emerald-700' : 'text-red-700'">{{ a.status }}</span>
                <span class="text-slate-700">by {{ a.approvedBy }}</span>
                <span class="text-slate-500 truncate">{{ a.note ? `— ${a.note}` : '' }}</span>
              </li>
            </ul>
          </section>

          <p class="text-[10px] text-slate-400 italic text-center">
            v1 scaffold — real defect detector + Cure application + Owner email + per-version persistence ship in v2.  Approve / Reject buttons currently record audit-log intent only; the underlying spec/step is not mutated yet.
          </p>
        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
