<!--
  ResourceEstimationCard.vue — the three-central-resources estimation view.

  v504 (2026-07-21) — Tom Gilb 2026-07-21 estimation subsystem brief.
  Renders:
    - Three rows (Capital Cost / Calendar Time / Specialist Staff) with:
      · latest estimate value
      · official budget from Plan Scope Framework (or "no budget yet")
      · % differential (± of estimate vs budget)
      · traffic-light status (green / amber / red-flashing) — Tom's brief
        default is red-flash at 20% over budget
    - Threshold settings panel (warn %, overflow %)
    - "+ Add estimation" button per resource — planner enters directly for MVP;
      AI-driven estimation via Claudian is a next-ship item
    - Expandable history per resource — full series with cause + source +
      reasoning per estimation event
    - "Resources Sharpening" jump pin when a resource is in overflow (Tom's
      ESTIMATION 3 brief) — MVP scrolls / notifies; full AI dialogue in v506

  UI rules satisfied:
    Spell-out-Type-Names SUPREME — spelled-out labels everywhere.
    Icon-Plus-Text SUPREME — every affordance has glyph + text.
    DD-009 Zero-Training UI — HoverHints on every field.
    DD-017 Colour-on-Background — green/amber/red on white bg, R-G safe.
    r93mmm Infinity Trap SUPREME — explicit "no budget yet" + "no estimate
      yet" states, never silent-zero.
    Twin portability — pure Vue + Tailwind + composable.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useResourceEstimations,
  RESOURCE_META,
  TRIGGER_CAUSE_META,
  type EstimatableResource,
  type EstimationSeries,
  type TriggerCause,
  type Estimation,
  // v508 — OPEX breakdown row type
  type OpexBreakdownRow,
  // v510 — ESTIMATION 9: Planguage Logic — evidence + equation
  type EvidenceLink,
  type EstimationEquation,
} from '../composables/useResourceEstimations'
import type { Ref, ComputedRef } from 'vue'

const props = defineProps<{
  planIdRef: Ref<string> | ComputedRef<string>
}>()

const emit = defineEmits<{
  /** Fired when Tom clicks the "Sharpen resources" pin on an overflowing row.
   *  Parent decides how to route (Stage 10 Resources Sharpening editor, AI
   *  advice dialogue, etc.). */
  'open-sharpening': [resource: EstimatableResource]
  /** v509 — fired when Tom clicks the "📐 Open Resources Agent" pin in the
   *  card header.  Parent opens the full-screen ResourcesAgent modal. */
  'open-resources-agent': []
}>()

const {
  thresholds, series, addEstimation, removeEstimation,
  // v505 — ESTIMATION 4
  addSecondOpinion, retractSecondOpinion, amendSecondOpinion, overrideEstimation,
  // v508 — ESTIMATION 7 OPEX
  updateOpexBreakdown,
  // v510 — ESTIMATION 9: Planguage Logic — evidence + equation
  addEvidenceLink, removeEvidenceLink, setEstimationEquation,
} = useResourceEstimations(props.planIdRef)

// v510 — Evidence-link editor state per estimation.
const evidenceEditorOpen = ref<Record<string, boolean>>({})
interface EvidenceDraft {
  kind:        EvidenceLink['kind']
  citation:    string
  url:         string
  credibility: number
  note:        string
}
function emptyEvidenceDraft(): EvidenceDraft {
  return { kind: 'contract-clause', citation: '', url: '', credibility: 0.7, note: '' }
}
const evidenceDraft = ref<Record<string, EvidenceDraft>>({})
function openEvidenceEditor(estId: string): void {
  evidenceEditorOpen.value[estId] = true
  if (!evidenceDraft.value[estId]) evidenceDraft.value[estId] = emptyEvidenceDraft()
}
function closeEvidenceEditor(estId: string): void {
  evidenceEditorOpen.value[estId] = false
  evidenceDraft.value[estId] = emptyEvidenceDraft()
}
function submitEvidence(estId: string): void {
  const d = evidenceDraft.value[estId]
  if (!d?.citation.trim()) return
  addEvidenceLink(estId, {
    kind:        d.kind,
    citation:    d.citation.trim(),
    url:         d.url.trim() || undefined,
    credibility: Math.max(0, Math.min(1, Number(d.credibility) || 0)),
    note:        d.note.trim() || undefined,
  })
  closeEvidenceEditor(estId)
}
const EVIDENCE_KIND_LABEL: Record<EvidenceLink['kind'], string> = {
  'contract-clause':      'Contract clause',
  'rfp-clause':           'RFP clause',
  'book-citation':        'Book citation',
  'url':                  'URL',
  'file':                 'File',
  'data-source':          'Data source',
  'expert-opinion':       'Expert opinion',
  'historical-precedent': 'Historical precedent',
  'benchmark':            'Industry benchmark',
}

// v510 — Equation editor state per estimation.  Simple: formula + variables
// text (parsed as key=value pairs) + methodology.  computed = formula
// evaluated with variables (naive JavaScript-safe evaluator — supports
// numeric operators + parentheses only).
const equationEditorOpen = ref<Record<string, boolean>>({})
interface EquationDraft {
  formula:     string
  variables:   string   // multi-line "name=value" per line
  methodology: string
}
function emptyEquationDraft(): EquationDraft {
  return { formula: '', variables: '', methodology: '' }
}
const equationDraft = ref<Record<string, EquationDraft>>({})
function openEquationEditor(est: Estimation): void {
  equationEditorOpen.value[est.id] = true
  if (!equationDraft.value[est.id]) {
    // Seed from existing equation if present
    if (est.equation) {
      equationDraft.value[est.id] = {
        formula: est.equation.formula,
        variables: Object.entries(est.equation.variables).map(([k, v]) => `${k}=${v}`).join('\n'),
        methodology: est.equation.methodology ?? '',
      }
    } else {
      equationDraft.value[est.id] = emptyEquationDraft()
    }
  }
}
function closeEquationEditor(estId: string): void {
  equationEditorOpen.value[estId] = false
}
function parseVariables(raw: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (m) out[m[1]] = Number(m[2])
  }
  return out
}
/** Evaluate a formula safely — allow only numeric operators, parentheses, digits,
 *  decimal points, and variable names. */
function safeEvalEquation(formula: string, variables: Record<string, number>): number | null {
  // Substitute variable names with their values (word-boundary match).
  let expr = formula
  for (const [k, v] of Object.entries(variables)) {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v))
  }
  // Reject anything not a number / operator / parenthesis / whitespace.
  if (/[^0-9+\-*/().\s]/.test(expr)) return null
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${expr})`)()
    return typeof val === 'number' && Number.isFinite(val) ? val : null
  } catch { return null }
}
function submitEquation(est: Estimation): void {
  const d = equationDraft.value[est.id]
  if (!d?.formula.trim()) return
  const vars = parseVariables(d.variables)
  const computed = safeEvalEquation(d.formula.trim(), vars) ?? undefined
  const eq: EstimationEquation = {
    formula:     d.formula.trim(),
    variables:   vars,
    computed,
    methodology: d.methodology.trim() || undefined,
  }
  setEstimationEquation(est.id, eq)
  closeEquationEditor(est.id)
}
function clearEquation(estId: string): void {
  setEstimationEquation(estId, null)
  closeEquationEditor(estId)
}
function credibilityBand(c: number): string {
  if (c >= 0.8) return 'text-emerald-700'
  if (c >= 0.5) return 'text-amber-700'
  return 'text-rose-700'
}

// v508 — OPEX breakdown editor state.  Per-estimation open/closed + draft row.
const breakdownEditorOpen = ref<Record<string, boolean>>({})
const breakdownDraft      = ref<Record<string, OpexBreakdownRow>>({})
function emptyBreakdownRow(): OpexBreakdownRow {
  return { label: '', amount: 0, frequency: 'annual', category: 'other', note: '' }
}
function openBreakdownEditor(estId: string): void {
  breakdownEditorOpen.value[estId] = true
  if (!breakdownDraft.value[estId]) breakdownDraft.value[estId] = emptyBreakdownRow()
}
function closeBreakdownEditor(estId: string): void {
  breakdownEditorOpen.value[estId] = false
  breakdownDraft.value[estId] = emptyBreakdownRow()
}
function addBreakdownRow(est: Estimation): void {
  const d = breakdownDraft.value[est.id]
  if (!d?.label.trim() || !Number.isFinite(Number(d.amount))) return
  const rows = [...(est.opexBreakdown ?? []), {
    label:     d.label.trim(),
    amount:    Number(d.amount),
    frequency: d.frequency ?? 'annual',
    category:  d.category ?? 'other',
    note:      d.note?.trim() || undefined,
  }]
  updateOpexBreakdown(est.id, rows)
  closeBreakdownEditor(est.id)
}
function removeBreakdownRow(est: Estimation, idx: number): void {
  const rows = (est.opexBreakdown ?? []).filter((_, i) => i !== idx)
  updateOpexBreakdown(est.id, rows)
}
function breakdownTotal(rows: OpexBreakdownRow[] | undefined): number {
  return (rows ?? []).reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0)
}
function isOpexResource(r: EstimatableResource): boolean {
  return r === 'annualOverhead' || r === 'technicalDebt'
}

// v505 — per-estimation UI state: which "add second opinion" form is open,
// which override form is open, and the draft state for each.
const secondOpinionFormOpen = ref<Record<string, boolean>>({})
const overrideFormOpen      = ref<Record<string, boolean>>({})
const editingOpinionId      = ref<Record<string, string | null>>({})   // per-estimation edit target

interface SecondOpinionDraft {
  holderName:        string
  holderEmail:       string
  reasons:           string
  alternativeAmount: string
}
function emptySecondOpinionDraft(): SecondOpinionDraft {
  return { holderName: '', holderEmail: '', reasons: '', alternativeAmount: '' }
}
const secondOpinionDraft = ref<Record<string, SecondOpinionDraft>>({})

interface OverrideDraft {
  newAmount:         string
  responsibleSource: string
  reason:            string
  reasoning:         string
}
function emptyOverrideDraft(): OverrideDraft {
  return { newAmount: '', responsibleSource: '', reason: '', reasoning: '' }
}
const overrideDraft = ref<Record<string, OverrideDraft>>({})

function openSecondOpinionForm(estId: string): void {
  secondOpinionFormOpen.value[estId] = true
  if (!secondOpinionDraft.value[estId]) secondOpinionDraft.value[estId] = emptySecondOpinionDraft()
  editingOpinionId.value[estId] = null
}
function closeSecondOpinionForm(estId: string): void {
  secondOpinionFormOpen.value[estId] = false
  editingOpinionId.value[estId] = null
  secondOpinionDraft.value[estId] = emptySecondOpinionDraft()
}
function submitSecondOpinion(estId: string): void {
  const d = secondOpinionDraft.value[estId]
  if (!d?.holderName.trim() || !d?.reasons.trim()) return
  const alt = Number(d.alternativeAmount)
  const editingId = editingOpinionId.value[estId]
  if (editingId) {
    // Amend
    amendSecondOpinion(estId, editingId, {
      holderName:        d.holderName.trim(),
      holderEmail:       d.holderEmail.trim() || undefined,
      reasons:           d.reasons.trim(),
      alternativeAmount: Number.isFinite(alt) && d.alternativeAmount !== '' ? alt : undefined,
    })
  } else {
    addSecondOpinion(estId, {
      holderName:        d.holderName.trim(),
      holderEmail:       d.holderEmail.trim() || undefined,
      reasons:           d.reasons.trim(),
      alternativeAmount: Number.isFinite(alt) && d.alternativeAmount !== '' ? alt : undefined,
    })
  }
  closeSecondOpinionForm(estId)
}
function startAmendOpinion(estId: string, op: { id: string; holderName: string; holderEmail?: string; reasons: string; alternativeAmount?: number }): void {
  secondOpinionFormOpen.value[estId] = true
  editingOpinionId.value[estId] = op.id
  secondOpinionDraft.value[estId] = {
    holderName:        op.holderName,
    holderEmail:       op.holderEmail ?? '',
    reasons:           op.reasons,
    alternativeAmount: op.alternativeAmount != null ? String(op.alternativeAmount) : '',
  }
}
function retractOpinion(estId: string, opinionId: string): void {
  const reason = window.prompt('Reason for retracting this second opinion (optional):') || ''
  retractSecondOpinion(estId, opinionId, reason)
}

function openOverrideForm(estId: string): void {
  overrideFormOpen.value[estId] = true
  if (!overrideDraft.value[estId]) overrideDraft.value[estId] = emptyOverrideDraft()
}
function closeOverrideForm(estId: string): void {
  overrideFormOpen.value[estId] = false
  overrideDraft.value[estId] = emptyOverrideDraft()
}
function submitOverride(estId: string): void {
  const d = overrideDraft.value[estId]
  if (!d) return
  const n = Number(d.newAmount)
  if (!Number.isFinite(n) || n < 0 || !d.responsibleSource.trim() || !d.reason.trim()) return
  overrideEstimation(estId, n, d.responsibleSource.trim(), d.reason.trim(), d.reasoning.trim())
  closeOverrideForm(estId)
}

function findOriginal(originalId: string, allEsts: Estimation[]): Estimation | undefined {
  return allEsts.find(e => e.id === originalId)
}

// Expand/collapse history per row.
const expanded = ref<Record<EstimatableResource, boolean>>({
  capitalCost: false, calendarTime: false, specialistStaff: false,
})
function toggleHistory(r: EstimatableResource): void { expanded.value[r] = !expanded.value[r] }

// "+ Add estimation" inline form state per row (planner MVP).
interface DraftEstimation {
  amount:    string   // string so blank input doesn't coerce to 0
  reasoning: string
}
const draftFor = ref<Record<EstimatableResource, DraftEstimation>>({
  capitalCost:     { amount: '', reasoning: '' },
  calendarTime:    { amount: '', reasoning: '' },
  specialistStaff: { amount: '', reasoning: '' },
})
const draftOpen = ref<Record<EstimatableResource, boolean>>({
  capitalCost: false, calendarTime: false, specialistStaff: false,
})

function submitDraft(r: EstimatableResource): void {
  const d = draftFor.value[r]
  const n = Number(d.amount)
  if (!Number.isFinite(n) || n < 0) return
  addEstimation({
    resource:  r,
    amount:    n,
    // v508 — currency applies to capitalCost + OPEX resources
    currency:  (r === 'capitalCost' || r === 'annualOverhead' || r === 'technicalDebt') ? 'USD' : undefined,
    timeUnit:  r === 'calendarTime' ? 'days' : undefined,
    source:    'planner',
    causes:    ['manual'],
    reasoning: d.reasoning.trim(),
  })
  d.amount = ''; d.reasoning = ''
  draftOpen.value[r] = false
}

const statusClass: Record<EstimationSeries['status'], string> = {
  ok:         'bg-emerald-50 border-emerald-300 text-emerald-800',
  warning:    'bg-amber-50 border-amber-300 text-amber-800',
  overflow:   'bg-rose-50 border-rose-400 text-rose-800 animate-pulse',   // red-flash per Tom's brief
  'no-budget':   'bg-slate-50 border-slate-200 text-slate-600',
  'no-estimate': 'bg-slate-50 border-slate-200 text-slate-500 italic',
}
const statusLabel: Record<EstimationSeries['status'], string> = {
  ok:         'On budget',
  warning:    'Approaching budget',
  overflow:   'OVER BUDGET',
  'no-budget':   'No budget yet',
  'no-estimate': 'No estimate yet',
}
const statusGlyph: Record<EstimationSeries['status'], string> = {
  ok: '🟢', warning: '🟡', overflow: '🔴', 'no-budget': '❔', 'no-estimate': '❔',
}

function formatAmount(r: EstimatableResource, amount: number | null): string {
  if (amount == null) return '—'
  if (r === 'capitalCost')     return `$${amount.toLocaleString()}`
  if (r === 'calendarTime')    return `${amount.toLocaleString()} days`
  if (r === 'specialistStaff') return `${amount.toLocaleString()} FTE`
  // v508 — OPEX (annualOverhead / technicalDebt): currency-denominated
  if (r === 'annualOverhead')  return `$${amount.toLocaleString()}/yr`
  if (r === 'technicalDebt')   return `$${amount.toLocaleString()}`
  return `${amount.toLocaleString()}`
}
// v508 — placeholder helper (was inlined ternaries — now covers 5 resources)
function placeholderFor(r: EstimatableResource): string {
  if (r === 'capitalCost')     return 'USD amount'
  if (r === 'calendarTime')    return 'days'
  if (r === 'specialistStaff') return 'total FTE'
  if (r === 'annualOverhead')  return 'USD per year'
  if (r === 'technicalDebt')   return 'USD carrying cost'
  return 'amount'
}
function unitHintFor(r: EstimatableResource): string {
  if (r === 'capitalCost')     return '$ (USD default)'
  if (r === 'calendarTime')    return 'days'
  if (r === 'specialistStaff') return 'FTE (specialist breakdown v505)'
  if (r === 'annualOverhead')  return '$/yr (breakdown per estimation)'
  if (r === 'technicalDebt')   return '$ carrying cost (breakdown per estimation)'
  return ''
}
function formatDifferential(pct: number | null): string {
  if (pct == null) return '—'
  if (!Number.isFinite(pct)) return '∞% over budget'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}
function formatCauses(causes: TriggerCause[]): string {
  return causes.map(c => TRIGGER_CAUSE_META[c].label).join(' · ')
}

const showThresholdSettings = ref(false)
// v508 — extended to 5 resources.  OPEX (annualOverhead + technicalDebt) join
// the trio per Tom Gilb ESTIMATION 7 2026-07-21.
const resources: EstimatableResource[] = [
  'capitalCost', 'calendarTime', 'specialistStaff',
  'annualOverhead', 'technicalDebt',
]
</script>

<template>
  <div class="rounded-xl border-2 border-blue-300 bg-blue-50/40 p-4 space-y-3">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <span class="text-base" aria-hidden="true">📐</span>
      <div class="flex-1 min-w-0">
        <div class="text-[11px] uppercase font-bold text-blue-800 tracking-wider">Resource Estimations</div>
        <div class="text-[10px] text-blue-900/70">Capital Cost · Calendar Time · Specialist Staff · Annual Overhead · Technical Debt — estimates vs official budgets.  Overflow = red flash at {{ thresholds.overflowPct }}% of budget.</div>
      </div>
      <!-- v509 — Open Resources Agent -->
      <button
        type="button"
        class="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 font-bold transition-colors"
        title="Open the Resources Agent — a specialised full-screen hub for all 5 resources: time-series charts, extrapolation, standards, Contract/RFP references, Sharpening entry-point, settings"
        @click="emit('open-resources-agent')"
      >
        <span aria-hidden="true">📐</span>
        <span>Open Resources Agent</span>
      </button>
      <button
        type="button"
        class="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded text-blue-700 hover:text-blue-900 hover:bg-blue-100 transition-colors"
        title="Show / hide the threshold settings (warn % + overflow %)"
        @click="showThresholdSettings = !showThresholdSettings"
      >
        <span aria-hidden="true">⚙</span>
        <span>{{ showThresholdSettings ? 'Hide' : 'Show' }} thresholds</span>
      </button>
    </div>

    <!-- Threshold settings panel -->
    <div v-if="showThresholdSettings" class="rounded-lg border border-blue-200 bg-white p-3 space-y-2 text-[11px]">
      <div class="text-[10px] uppercase font-bold text-slate-600">Overflow Thresholds</div>
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="font-semibold text-slate-700">Warning at % of budget</span>
          <input
            v-model.number="thresholds.warningPct"
            type="number" min="0" step="5"
            class="w-full rounded-md border-2 border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            title="Estimated value at this percentage of budget triggers amber warning"
            aria-label="Warning threshold percent"
          />
          <span class="text-[9px] italic text-slate-500">Amber flag at N% of budget</span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-semibold text-slate-700">Overflow at % of budget</span>
          <input
            v-model.number="thresholds.overflowPct"
            type="number" min="0" step="5"
            class="w-full rounded-md border-2 border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            title="Estimated value at this percentage of budget triggers red flashing overflow (Tom's brief default: 120 = 20% over)"
            aria-label="Overflow threshold percent"
          />
          <span class="text-[9px] italic text-slate-500">Red flash at N% of budget (default 120 = 20% over)</span>
        </label>
      </div>
    </div>

    <!-- Three resource rows -->
    <div class="space-y-2">
      <div
        v-for="r in resources" :key="r"
        class="rounded-lg border-2 p-3 space-y-2"
        :class="statusClass[series[r].status]"
      >
        <!-- Summary row -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-lg" aria-hidden="true">{{ RESOURCE_META[r].glyph }}</span>
          <span class="font-bold text-[13px]">{{ RESOURCE_META[r].label }}</span>
          <span class="text-[10px] opacity-70">{{ RESOURCE_META[r].hint }}</span>
          <span class="ml-auto flex items-center gap-1 text-[11px] font-bold">
            <span aria-hidden="true">{{ statusGlyph[series[r].status] }}</span>
            <span>{{ statusLabel[series[r].status] }}</span>
          </span>
        </div>

        <!-- Estimate / budget / differential row -->
        <div class="grid grid-cols-3 gap-2 text-[11px]">
          <div class="rounded bg-white/70 border border-current/20 p-2">
            <div class="text-[9px] uppercase font-bold opacity-70">Latest Estimate</div>
            <div class="text-sm font-bold">{{ formatAmount(r, series[r].latestAmount) }}</div>
          </div>
          <div class="rounded bg-white/70 border border-current/20 p-2">
            <div class="text-[9px] uppercase font-bold opacity-70">Official Budget</div>
            <div class="text-sm font-bold">{{ formatAmount(r, series[r].budgetAmount) }}</div>
            <div v-if="series[r].budgetAmount == null" class="text-[9px] italic opacity-70">Set in Plan Scope Framework above</div>
          </div>
          <div class="rounded bg-white/70 border border-current/20 p-2">
            <div class="text-[9px] uppercase font-bold opacity-70">Differential</div>
            <div class="text-sm font-bold">{{ formatDifferential(series[r].differentialPct) }}</div>
            <div class="text-[9px] italic opacity-70">estimate vs budget</div>
          </div>
        </div>

        <!-- Action row -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-white/70 border border-current/30 hover:bg-white"
            :title="`Add a new estimation for ${RESOURCE_META[r].label} (planner input; AI-driven estimation ships next)`"
            @click="draftOpen[r] = !draftOpen[r]"
          >
            <span aria-hidden="true">➕</span>
            <span>{{ draftOpen[r] ? 'Cancel' : 'Add Estimation' }}</span>
          </button>
          <button
            v-if="series[r].history.length > 0"
            type="button"
            class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-white/70 border border-current/30 hover:bg-white"
            :title="`Show / hide the full estimation history for ${RESOURCE_META[r].label} (N events)`"
            @click="toggleHistory(r)"
          >
            <span aria-hidden="true">📜</span>
            <span>{{ expanded[r] ? 'Hide' : 'Show' }} history ({{ series[r].history.length }})</span>
          </button>
          <button
            v-if="series[r].status === 'overflow'"
            type="button"
            class="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700"
            :title="`Sharpen resources — open the AI-advice dialogue to explore remedies for ${RESOURCE_META[r].label} overflow`"
            @click="emit('open-sharpening', r)"
          >
            <span aria-hidden="true">🔪</span>
            <span>Sharpen Resources</span>
          </button>
        </div>

        <!-- Inline "+ Add estimation" form -->
        <div v-if="draftOpen[r]" class="rounded-lg border-2 border-current/30 bg-white p-3 space-y-2">
          <div class="flex items-center gap-2 flex-wrap">
            <label class="flex items-center gap-1 text-[11px]">
              <span class="font-semibold">{{ RESOURCE_META[r].label }} =</span>
              <input
                v-model="draftFor[r].amount"
                type="number" min="0" step="1"
                class="w-32 rounded-md border-2 border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                :placeholder="placeholderFor(r)"
                :aria-label="`${RESOURCE_META[r].label} estimation amount`"
              />
              <span class="text-[10px] text-slate-500">{{ unitHintFor(r) }}</span>
            </label>
          </div>
          <label class="flex flex-col gap-1 text-[11px]">
            <span class="font-semibold">Reasoning (optional)</span>
            <textarea
              v-model="draftFor[r].reasoning"
              rows="2"
              class="w-full rounded-md border-2 border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="Why this amount?  What drove the estimate? (basis, assumptions, comparables, Gilb citations)"
              aria-label="Reasoning text"
            ></textarea>
          </label>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1 rounded bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700"
              :disabled="!draftFor[r].amount"
              :title="`Save this estimation into the ${RESOURCE_META[r].label} series (cause tagged 'Manual', source tagged 'Planner')`"
              @click="submitDraft(r)"
            >✓ Save Estimation</button>
            <span class="text-[9px] text-slate-500 italic">
              Auto-tagged: Source = 👤 Planner · Cause = Manual · Timestamp = now.  Automatic re-estimation triggers on spec changes ship in v505.
            </span>
          </div>
        </div>

        <!-- History expandable — v505: per-event Second Opinions + Override sub-UI -->
        <div v-if="expanded[r]" class="rounded-lg border border-current/20 bg-white p-2 space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="est in [...series[r].history].reverse()" :key="est.id"
            class="text-[10px] border-b-2 border-slate-100 last:border-b-0 pb-2 space-y-1"
          >
            <div class="flex items-start gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-slate-800 text-[11px]">{{ formatAmount(r, est.amount) }}</span>
                  <span
                    v-if="est.overridesId"
                    class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-violet-100 text-violet-800 text-[9px] font-bold uppercase tracking-wider"
                    :title="`This estimation OVERRIDES a prior estimation (id ${est.overridesId}).  Responsible source: ${est.overrideResponsibleSource}.  Reason: ${est.overrideReason}`"
                  >↩ Override</span>
                </div>
                <div class="text-[9px] text-slate-500">{{ est.timestamp.slice(0, 16).replace('T', ' ') }} · Source: {{ est.source }} · Cause: {{ formatCauses(est.causes) }}</div>
                <div v-if="est.reasoning" class="text-[10px] text-slate-700 italic mt-0.5">"{{ est.reasoning }}"</div>

                <!-- v508 — ESTIMATION 7 OPEX: detailed breakdown per estimation.
                     Tom Gilb 2026-07-21: "A detailed breakdown of the Opex
                     should accompany each estimate."  Only shown for
                     annualOverhead / technicalDebt resources. -->
                <div v-if="isOpexResource(r)" class="mt-1.5 pl-2 border-l-2 border-emerald-300">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      OPEX breakdown
                      <span v-if="est.opexBreakdown && est.opexBreakdown.length > 0" class="text-[9px] text-emerald-600 normal-case ml-1">
                        · {{ est.opexBreakdown.length }} line item{{ est.opexBreakdown.length === 1 ? '' : 's' }} · Σ ${{ breakdownTotal(est.opexBreakdown).toLocaleString() }}
                      </span>
                    </span>
                    <button
                      v-if="!breakdownEditorOpen[est.id]"
                      type="button"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-semibold"
                      :title="`Add a line item to the OPEX breakdown for this ${RESOURCE_META[r].label} estimation.  Detailed breakdown makes the total transparent + auditable.`"
                      @click="openBreakdownEditor(est.id)"
                    >+ Line item</button>
                  </div>

                  <!-- Existing breakdown rows -->
                  <div v-if="est.opexBreakdown && est.opexBreakdown.length > 0" class="space-y-0.5">
                    <div
                      v-for="(row, idx) in est.opexBreakdown"
                      :key="idx"
                      class="flex items-center gap-2 text-[10px] text-slate-700"
                    >
                      <span class="font-semibold min-w-0 truncate flex-1" :title="row.note || row.label">{{ row.label }}</span>
                      <span v-if="row.category && row.category !== 'other'" class="text-[9px] text-slate-500 italic">{{ row.category }}</span>
                      <span class="font-mono font-bold text-slate-800">${{ row.amount.toLocaleString() }}</span>
                      <span class="text-[9px] text-slate-500">/{{ row.frequency ?? 'annual' }}</span>
                      <button
                        type="button"
                        class="text-slate-400 hover:text-rose-600 text-[10px]"
                        :title="`Remove this line item`"
                        @click="removeBreakdownRow(est, idx)"
                      >✕</button>
                    </div>
                  </div>
                  <div v-else-if="!breakdownEditorOpen[est.id]" class="text-[10px] text-slate-500 italic">
                    No breakdown line items yet — click "+ Line item" to add transparency to this ${{ RESOURCE_META[r].label }} estimation.
                  </div>

                  <!-- Inline editor -->
                  <div v-if="breakdownEditorOpen[est.id]" class="mt-1.5 rounded border border-emerald-300 bg-emerald-50/60 p-2 space-y-1.5">
                    <div class="grid grid-cols-[1fr_auto_auto] gap-1.5">
                      <input
                        v-model="breakdownDraft[est.id].label"
                        type="text"
                        placeholder="Line-item label (e.g. Cloud hosting, Support engineer 0.2 FTE)"
                        class="px-1.5 py-1 rounded border border-emerald-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        title="Free-text name of the line item"
                      />
                      <input
                        v-model.number="breakdownDraft[est.id].amount"
                        type="number" min="0" step="1"
                        placeholder="amount"
                        class="w-24 px-1.5 py-1 rounded border border-emerald-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        title="Numeric amount for this line item"
                      />
                      <select
                        v-model="breakdownDraft[est.id].frequency"
                        class="px-1.5 py-1 rounded border border-emerald-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        title="Frequency: annual / monthly / quarterly / one-off"
                      >
                        <option value="annual">/annual</option>
                        <option value="monthly">/monthly</option>
                        <option value="quarterly">/quarterly</option>
                        <option value="one-off">one-off</option>
                      </select>
                    </div>
                    <div class="grid grid-cols-[1fr_auto] gap-1.5">
                      <select
                        v-model="breakdownDraft[est.id].category"
                        class="px-1.5 py-1 rounded border border-emerald-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        title="Category — infrastructure / personnel / licence / contract / deferred-refactor / compliance / other"
                      >
                        <option value="infrastructure">infrastructure</option>
                        <option value="personnel">personnel</option>
                        <option value="licence">licence</option>
                        <option value="contract">contract</option>
                        <option value="deferred-refactor">deferred-refactor</option>
                        <option value="compliance">compliance</option>
                        <option value="other">other</option>
                      </select>
                      <input
                        v-model="breakdownDraft[est.id].note"
                        type="text"
                        placeholder="Optional note"
                        class="px-1.5 py-1 rounded border border-emerald-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        title="Optional context / caveat / source URL"
                      />
                    </div>
                    <div class="flex justify-end gap-1.5">
                      <button
                        type="button"
                        class="text-[10px] px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold"
                        :title="`Cancel — discard this line-item draft`"
                        @click="closeBreakdownEditor(est.id)"
                      >Cancel</button>
                      <button
                        type="button"
                        class="text-[10px] px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 font-bold"
                        :title="`Add this line item to the OPEX breakdown`"
                        @click="addBreakdownRow(est)"
                      >+ Add row</button>
                    </div>
                  </div>
                </div>

                <!-- v510 — ESTIMATION 9: Planguage Logic — Equation + Evidence Links.
                     Tom Gilb 2026-07-21 verbatim: "See the new Planguage Logic for
                     Equations re resources (example linked to evidence for an
                     estimate or source of an estimate)".  Every estimation can
                     optionally carry a symbolic equation + structured evidence
                     links.  Composes with Cost Engineering (2023) audit-trail
                     discipline + Planguage Logic §1.3 formula-as-first-class. -->
                <div class="mt-1.5 pl-2 border-l-2 border-blue-300">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                      Equation + Evidence
                      <span v-if="est.equation || (est.evidenceLinks?.length ?? 0) > 0" class="text-[9px] text-blue-600 normal-case ml-1">
                        · {{ est.equation ? '1 equation' : '' }}{{ est.equation && (est.evidenceLinks?.length ?? 0) > 0 ? ' + ' : '' }}{{ (est.evidenceLinks?.length ?? 0) > 0 ? `${est.evidenceLinks!.length} evidence link${est.evidenceLinks!.length === 1 ? '' : 's'}` : '' }}
                      </span>
                    </span>
                    <div class="flex gap-1">
                      <button
                        v-if="!equationEditorOpen[est.id]"
                        type="button"
                        class="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 font-semibold"
                        :title="est.equation ? 'Edit the formula + variables + methodology (Planguage Logic — auditable estimation)' : 'Attach a formula + variables to this estimation (Planguage Logic §1.3 — equations make the reasoning auditable)'"
                        @click="openEquationEditor(est)"
                      >{{ est.equation ? 'Edit Equation' : '＋ Equation' }}</button>
                      <button
                        v-if="!evidenceEditorOpen[est.id]"
                        type="button"
                        class="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 font-semibold"
                        :title="`Add an evidence link — contract clause, RFP, book citation, URL, data source, expert opinion, benchmark (Gilb Cost Engineering 2023 audit-trail discipline)`"
                        @click="openEvidenceEditor(est.id)"
                      >＋ Evidence</button>
                    </div>
                  </div>

                  <!-- Existing equation display -->
                  <div v-if="est.equation" class="text-[10px] bg-blue-50/60 rounded p-1.5 space-y-0.5">
                    <div class="font-mono font-semibold text-blue-900">{{ est.equation.formula }}</div>
                    <div v-if="Object.keys(est.equation.variables).length > 0" class="text-slate-700">
                      <span class="font-semibold">where:</span>
                      <span
                        v-for="(v, k) in est.equation.variables"
                        :key="k"
                        class="font-mono text-[10px] mr-2"
                      >{{ k }}={{ v.toLocaleString() }}</span>
                    </div>
                    <div v-if="est.equation.computed != null" class="text-slate-700">
                      <span class="font-semibold">computes to:</span>
                      <span class="font-mono font-bold ml-1">{{ est.equation.computed.toLocaleString() }}</span>
                      <span
                        v-if="Math.abs((est.equation.computed) - est.amount) > 0.5"
                        class="ml-1 text-amber-700 italic"
                      >(differs from stored amount {{ est.amount.toLocaleString() }} — planner override)</span>
                    </div>
                    <div v-if="est.equation.methodology" class="italic text-slate-600">"{{ est.equation.methodology }}"</div>
                  </div>

                  <!-- Existing evidence links display -->
                  <div v-if="est.evidenceLinks && est.evidenceLinks.length > 0" class="mt-1 space-y-0.5">
                    <div
                      v-for="ev in est.evidenceLinks"
                      :key="ev.id"
                      class="flex items-center gap-1.5 text-[10px]"
                    >
                      <span class="inline-flex items-center rounded px-1 py-0.5 bg-blue-100 text-blue-800 font-semibold uppercase tracking-wider text-[9px]" :title="`Evidence kind: ${EVIDENCE_KIND_LABEL[ev.kind]}`">{{ EVIDENCE_KIND_LABEL[ev.kind] }}</span>
                      <span class="flex-1 min-w-0 truncate" :title="ev.note || ev.citation">{{ ev.citation }}</span>
                      <a v-if="ev.url" :href="ev.url" target="_blank" rel="noopener" class="text-[9px] text-blue-700 underline shrink-0">↗</a>
                      <span :class="['text-[9px] font-bold shrink-0', credibilityBand(ev.credibility)]" :title="`Credibility ${(ev.credibility * 100).toFixed(0)}% (CE-scale: 0.9 strongly supports · 0.5 moderate · 0.3 weak)`">{{ (ev.credibility * 100).toFixed(0) }}%</span>
                      <button type="button" class="text-slate-400 hover:text-rose-600 text-[10px] shrink-0" :title="`Remove this evidence link`" @click="removeEvidenceLink(est.id, ev.id)">✕</button>
                    </div>
                  </div>

                  <!-- Equation inline editor -->
                  <div v-if="equationEditorOpen[est.id]" class="mt-1.5 rounded border border-blue-300 bg-blue-50/60 p-2 space-y-1.5">
                    <input v-model="equationDraft[est.id].formula" type="text"
                           placeholder="Formula (e.g. years * avg_annual_cost + one_off_setup)"
                           class="w-full px-1.5 py-1 rounded border border-blue-300 bg-white text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                           title="Symbolic formula. Numeric operators (+ - * /) and parentheses only. Variable names are word tokens." />
                    <textarea v-model="equationDraft[est.id].variables" rows="3"
                              placeholder="Variables — one per line, e.g.&#10;years=5&#10;avg_annual_cost=48000&#10;one_off_setup=15000"
                              class="w-full px-1.5 py-1 rounded border border-blue-300 bg-white text-[10px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
                    <input v-model="equationDraft[est.id].methodology" type="text"
                           placeholder="Methodology narrative (e.g. Wright's Law learning-curve; Gilb Cost Engineering p.30)"
                           class="w-full px-1.5 py-1 rounded border border-blue-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <div class="flex justify-end gap-1.5">
                      <button v-if="est.equation" type="button"
                              class="text-[10px] px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold"
                              :title="`Remove the equation from this estimation`"
                              @click="clearEquation(est.id)">Clear</button>
                      <button type="button"
                              class="text-[10px] px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold"
                              @click="closeEquationEditor(est.id)">Cancel</button>
                      <button type="button"
                              class="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 font-bold"
                              :title="`Save the equation — auto-computes value from formula + variables; differences from stored amount surface as amber italic`"
                              @click="submitEquation(est)">Save equation</button>
                    </div>
                  </div>

                  <!-- Evidence inline editor -->
                  <div v-if="evidenceEditorOpen[est.id]" class="mt-1.5 rounded border border-blue-300 bg-blue-50/60 p-2 space-y-1.5">
                    <div class="grid grid-cols-[auto_1fr] gap-1.5">
                      <select v-model="evidenceDraft[est.id].kind"
                              class="px-1.5 py-1 rounded border border-blue-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                              title="Evidence kind — contract clause / RFP / book / URL / file / data source / expert opinion / historical precedent / benchmark">
                        <option v-for="(lbl, k) in EVIDENCE_KIND_LABEL" :key="k" :value="k">{{ lbl }}</option>
                      </select>
                      <input v-model="evidenceDraft[est.id].citation" type="text"
                             placeholder="Citation (e.g. Gilb Cost Engineering 2023 p.4, or PACRM §3.2.1)"
                             class="px-1.5 py-1 rounded border border-blue-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                             title="Human-readable citation — book+page, contract clause number, RFP section, expert name" />
                    </div>
                    <input v-model="evidenceDraft[est.id].url" type="url"
                           placeholder="Optional URL"
                           class="w-full px-1.5 py-1 rounded border border-blue-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <div class="grid grid-cols-[auto_1fr] gap-1.5 items-center">
                      <label class="text-[10px] font-semibold text-blue-800" :title="`Credibility on the CE scale: 0.9 strongly supports · 0.5 moderate · 0.3 weak`">
                        Credibility <span class="font-mono">{{ ((evidenceDraft[est.id].credibility ?? 0.7) * 100).toFixed(0) }}%</span>
                      </label>
                      <input v-model.number="evidenceDraft[est.id].credibility" type="range" min="0" max="1" step="0.05"
                             class="w-full" />
                    </div>
                    <input v-model="evidenceDraft[est.id].note" type="text"
                           placeholder="Optional note (context / caveat / applicability)"
                           class="w-full px-1.5 py-1 rounded border border-blue-300 bg-white text-[10px] focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <div class="flex justify-end gap-1.5">
                      <button type="button"
                              class="text-[10px] px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold"
                              @click="closeEvidenceEditor(est.id)">Cancel</button>
                      <button type="button"
                              class="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 font-bold"
                              @click="submitEvidence(est.id)">＋ Add evidence</button>
                    </div>
                  </div>
                </div>

                <!-- v505 — Override metadata display (if this estimation is an override) -->
                <div v-if="est.overridesId" class="mt-1 pl-2 border-l-2 border-violet-300 text-[10px] text-violet-800">
                  <div><span class="font-semibold">Responsible source:</span> {{ est.overrideResponsibleSource }}</div>
                  <div><span class="font-semibold">Reason:</span> {{ est.overrideReason }}</div>
                  <div v-if="findOriginal(est.overridesId, series[r].history)" class="text-[9px] text-violet-700/70 italic">
                    Overrides prior estimation: {{ formatAmount(r, findOriginal(est.overridesId, series[r].history)!.amount) }} ({{ findOriginal(est.overridesId, series[r].history)!.timestamp.slice(0, 16).replace('T', ' ') }})
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 text-slate-400 hover:text-rose-600 text-[10px]"
                :title="`Delete this estimation event from the series (undo not yet wired — use with care)`"
                @click="removeEstimation(est.id)"
              >✕</button>
            </div>

            <!-- v505 — Second Opinions list -->
            <div v-if="est.secondOpinions && est.secondOpinions.length > 0" class="pl-3 space-y-1">
              <div class="text-[9px] uppercase font-bold text-slate-600 tracking-wider">Second Opinions ({{ est.secondOpinions.length }})</div>
              <div
                v-for="op in est.secondOpinions" :key="op.id"
                class="rounded border px-2 py-1 text-[10px]"
                :class="op.retracted ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-blue-200 bg-blue-50/60'"
              >
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span aria-hidden="true">🗣</span>
                  <span class="font-bold" :class="op.retracted ? 'text-slate-600 line-through' : 'text-blue-900'">{{ op.holderName }}</span>
                  <span v-if="op.holderEmail" class="text-[9px] text-slate-500">&lt;{{ op.holderEmail }}&gt;</span>
                  <span v-if="op.alternativeAmount != null" class="text-[10px] font-bold text-blue-800">
                    → suggests {{ formatAmount(r, op.alternativeAmount) }}
                  </span>
                  <span v-if="op.retracted" class="ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold uppercase" :title="op.retractedReason || 'Opinion retracted'">Retracted</span>
                  <span v-if="op.amendedAt" class="text-[9px] text-slate-500 italic" :title="`Last amended ${op.amendedAt.slice(0, 16).replace('T', ' ')}`">(amended)</span>
                  <div class="ml-auto flex items-center gap-1">
                    <button
                      v-if="!op.retracted"
                      type="button"
                      class="text-[9px] text-blue-600 hover:text-blue-900"
                      title="Amend this second opinion — updates in place with an 'amended' timestamp; original text replaced"
                      @click="startAmendOpinion(est.id, op)"
                    >Amend</button>
                    <button
                      v-if="!op.retracted"
                      type="button"
                      class="text-[9px] text-slate-500 hover:text-rose-700"
                      title="Retract this second opinion — stays in the record (flagged, greyed out) to preserve the audit trail"
                      @click="retractOpinion(est.id, op.id)"
                    >⊘ retract</button>
                  </div>
                </div>
                <div :class="op.retracted ? 'text-slate-600' : 'text-slate-800'">"{{ op.reasons }}"</div>
                <div v-if="op.retracted && op.retractedReason" class="text-[9px] italic text-slate-500 mt-0.5">Retract reason: {{ op.retractedReason }}</div>
              </div>
            </div>

            <!-- v505 — Add Second Opinion / Override buttons + forms -->
            <div class="flex items-center gap-2 flex-wrap pl-3 pt-1">
              <button
                type="button"
                class="text-[10px] text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                title="Add a second opinion from another person (name, email, reasons, optional alternative amount).  Any number allowed."
                @click="openSecondOpinionForm(est.id)"
              >🗣 + Second opinion</button>
              <button
                type="button"
                class="text-[10px] text-violet-700 hover:text-violet-900 hover:underline flex items-center gap-1"
                title="Manually override this estimation with a new amount + responsible source + reason.  Creates a NEW estimation entry that supersedes this one; the original stays in the history."
                @click="openOverrideForm(est.id)"
              >↩ + Override</button>
            </div>

            <!-- Add/Amend Second Opinion form -->
            <div
              v-if="secondOpinionFormOpen[est.id]"
              class="rounded-lg border-2 border-blue-300 bg-white p-2 space-y-2 ml-3"
            >
              <div class="text-[10px] font-bold text-blue-800">
                {{ editingOpinionId[est.id] ? 'Amend second opinion' : 'Add second opinion' }}
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-0.5 text-[10px]">
                  <span class="font-semibold">Name *</span>
                  <input
                    v-model="secondOpinionDraft[est.id].holderName" type="text"
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Jane Doe"
                    aria-label="Second opinion holder name"
                  />
                </label>
                <label class="flex flex-col gap-0.5 text-[10px]">
                  <span class="font-semibold">Email</span>
                  <input
                    v-model="secondOpinionDraft[est.id].holderEmail" type="email"
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-blue-500"
                    placeholder="jane@company.com (optional)"
                    aria-label="Second opinion holder email"
                  />
                </label>
              </div>
              <label class="flex flex-col gap-0.5 text-[10px]">
                <span class="font-semibold">Reasons *</span>
                <textarea
                  v-model="secondOpinionDraft[est.id].reasons" rows="2"
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-blue-500"
                  placeholder="Why does this person's estimate differ / concur / need adjusting?"
                  aria-label="Second opinion reasons"
                ></textarea>
              </label>
              <label class="flex flex-col gap-0.5 text-[10px]">
                <span class="font-semibold">Alternative amount (optional)</span>
                <input
                  v-model="secondOpinionDraft[est.id].alternativeAmount" type="number" min="0"
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-blue-500"
                  :placeholder="`e.g. ${r === 'capitalCost' ? '$ amount' : r === 'calendarTime' ? 'days' : 'FTE'}`"
                  aria-label="Alternative amount from this opinion holder"
                />
              </label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1 rounded bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700"
                  :disabled="!secondOpinionDraft[est.id].holderName || !secondOpinionDraft[est.id].reasons"
                  @click="submitSecondOpinion(est.id)"
                >✓ {{ editingOpinionId[est.id] ? 'Save amendment' : 'Add opinion' }}</button>
                <button
                  type="button"
                  class="px-3 py-1 rounded text-[10px] text-slate-500 hover:text-slate-800"
                  @click="closeSecondOpinionForm(est.id)"
                >Cancel</button>
              </div>
            </div>

            <!-- Override form -->
            <div
              v-if="overrideFormOpen[est.id]"
              class="rounded-lg border-2 border-violet-300 bg-white p-2 space-y-2 ml-3"
            >
              <div class="text-[10px] font-bold text-violet-800">Manually override this estimation</div>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-0.5 text-[10px]">
                  <span class="font-semibold">New amount *</span>
                  <input
                    v-model="overrideDraft[est.id].newAmount" type="number" min="0"
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-violet-500"
                    :placeholder="`e.g. ${placeholderFor(r)}`"
                    aria-label="Overriding new amount"
                  />
                </label>
                <label class="flex flex-col gap-0.5 text-[10px]">
                  <span class="font-semibold">Responsible source *</span>
                  <input
                    v-model="overrideDraft[est.id].responsibleSource" type="text"
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-violet-500"
                    placeholder="e.g. Project Sponsor · Cost Estimator · Legal"
                    aria-label="Responsible source for the override"
                  />
                </label>
              </div>
              <label class="flex flex-col gap-0.5 text-[10px]">
                <span class="font-semibold">Reason for override *</span>
                <textarea
                  v-model="overrideDraft[est.id].reason" rows="2"
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-violet-500"
                  placeholder="Why override the prior estimate?  (new information · executive decision · contractual change · updated benchmark)"
                  aria-label="Reason for the override"
                ></textarea>
              </label>
              <label class="flex flex-col gap-0.5 text-[10px]">
                <span class="font-semibold">Additional reasoning (optional)</span>
                <textarea
                  v-model="overrideDraft[est.id].reasoning" rows="1"
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:outline-none focus:border-violet-500"
                  placeholder="Basis · assumptions · comparables · Gilb citations"
                  aria-label="Additional reasoning text"
                ></textarea>
              </label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1 rounded bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700"
                  :disabled="!overrideDraft[est.id].newAmount || !overrideDraft[est.id].responsibleSource || !overrideDraft[est.id].reason"
                  @click="submitOverride(est.id)"
                >↩ Save override</button>
                <button
                  type="button"
                  class="px-3 py-1 rounded text-[10px] text-slate-500 hover:text-slate-800"
                  @click="closeOverrideForm(est.id)"
                >Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer note -->
    <div class="text-[9px] italic text-blue-900/60 pt-1 border-t border-blue-200">
      Estimation subsystem MVP · v504.  Automatic re-estimation on spec changes (new Value / changed Value Level / changed Qualifier / changed stipulated resources / changed Constraint) + AI-driven estimation via Claudian arrive in v505.  Resources Sharpening advice dialogue lands in v506.
    </div>
  </div>
</template>
