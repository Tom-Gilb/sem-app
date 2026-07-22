<!-- UNIT_TYPE=Widget
     ResourcesAgent.vue — v509 ESTIMATION 8 — a specialized agent for the
     5-resource subsystem (Capital / Calendar / Staff / Annual Overhead /
     Technical Debt).

     Tom Gilb 2026-07-21 verbatim: "Estimation 8: Aside from spreading and
     collecting this resource data many places, I think we need a specialized
     Agent called 'Resources' where we can see all of the current data, and
     even dig into the time stamped series of any one resource, and have
     Sharpening sessions to deal with any resource situation based on the
     current set of data.  It would also be the place for resource settings
     (currency, frequency, data elements to capture, standards to apply (like
     the Navy Finance Standard REM already has in the Contracts), and
     References to any specific resource items in a RFP or Contract, and more
     things I cant think of yet (suggest some good ones!) including drawing
     graphs of changes and extrapolating init future"

     MVP sections (Phase 1 v509):
       1. Header (agent brand + close)
       2. Overview grid — all 5 resources with status + latest + stipulated
          + differential%, plus "Sharpen this resource" pin per row
       3. Time-series sparkline per resource (SVG polyline of amount vs
          estimation index) + linear extrapolation forward N periods
       4. Standards registry (multi-select; per-resource applicability)
       5. Contract/RFP References per resource (add + list + remove)
       6. Global settings (default currency + default frequency +
          extrapolation periods + notes)
       7. Snapshot history caption (from useIetResourceSnapshot)

     Deferred (v510+):
       • AI Sharpening dialogue (button emits 'open-sharpening' — parent handles)
       • Currency conversion multi-currency roll-up
       • Monte Carlo confidence bands on extrapolation
       • Timeline view (all resource events on horizontal axis)
       • Print-ready quarterly-review report
       • Second-opinion inbox (all outstanding opinions cross-resource)
       • What-if planner (adjust Solutions and see downstream resource impact)

     Composes with SUPREME rules:
       • ScrollContainer (body wrapped)
       • CloseDot (top-right + backdrop click + Escape via host)
       • DD-009 Zero-Training UI (title HoverHints everywhere)
       • DD-017 R-G colorblind-safe (indigo/emerald/amber/rose families on white)
       • Icon-Plus-Text (all glyphs paired with plain-English labels)
       • Spell-out-Type-Names (Capital Cost / Calendar Time / etc — no F/V/S)
       • MOVE (all 7 sections visible in one long scroll — no menu-dive)
       • No-Silent-Data-Loss (settings auto-persist per plan via composable)
       • Universal Undo (composable routes mutations for future Undo wiring)
       • Twin portability (Kai's Twin inherits the composable + panel pattern) -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  useResourcesAgent,
  RESOURCE_STANDARDS,
  type ResourceStandard,
} from '../composables/useResourcesAgent'
import {
  useResourceEstimations,
  RESOURCE_META,
  CENTRAL_RESOURCES,
  EXTENDED_RESOURCES,
  ALL_RESOURCES,
  type EstimatableResource,
  type Estimation,
  type EstimationSeries,
} from '../composables/useResourceEstimations'
import { useIetResourceSnapshot } from '../composables/useIetResourceSnapshot'
import ResourcesSharpeningDialog from './ResourcesSharpeningDialog.vue'   // v513
import { exportAgentReport, type AgentExportCategoryGroup } from '../composables/useAgentReportExport'  // v529
import type { Ref, ComputedRef } from 'vue'

const props = defineProps<{
  open: boolean
  planIdRef: Ref<string> | ComputedRef<string>
}>()

const emit = defineEmits<{
  close: []
  /** Fires when planner clicks "Sharpen this resource" per-row pin — parent
   *  routes to the AI-advice dialogue (v510+). */
  'open-sharpening': [resource: EstimatableResource]
}>()

const agent = useResourcesAgent(props.planIdRef)
// v512 — aggregation helpers exposed as computed for reactive updates
const timelineEvents = computed(() => agent.getAllTimelineEvents())
const outstandingOpinions = computed(() => agent.getOutstandingSecondOpinions())
const complianceMatrix = computed(() => agent.getComplianceMatrix())
const allEvidenceLinks = computed(() => agent.getAllEvidenceLinks())
const { series, anyOverflow, anyWarning, estimations, bulkImportEstimations } = useResourceEstimations(props.planIdRef)
const { estimatedSnapshot, stipulatedSnapshot, history: snapshotHistory } = useIetResourceSnapshot(props.planIdRef)

// ── Overview helpers ─────────────────────────────────────────────────────────

// v511 — order = central first, then extended (planner opts-in per plan)
const orderedResources: EstimatableResource[] = ALL_RESOURCES

const activeResources = computed<EstimatableResource[]>(() =>
  orderedResources.filter(r => agent.settings.value.activeResources[r])
)

const statusClass: Record<EstimationSeries['status'], string> = {
  ok:            'bg-emerald-100 text-emerald-800 border-emerald-300',
  warning:       'bg-amber-100 text-amber-800 border-amber-300',
  overflow:      'bg-rose-100 text-rose-800 border-rose-300 animate-pulse',
  'no-budget':   'bg-slate-100 text-slate-600 border-slate-300',
  'no-estimate': 'bg-slate-100 text-slate-500 border-slate-300',
}
const statusLabel: Record<EstimationSeries['status'], string> = {
  ok: 'On track', warning: 'Warning', overflow: 'OVERFLOW', 'no-budget': 'No budget', 'no-estimate': 'No estimate',
}
const statusGlyph: Record<EstimationSeries['status'], string> = {
  ok: '🟢', warning: '🟡', overflow: '🔴', 'no-budget': '❔', 'no-estimate': '❔',
}
function formatAmount(r: EstimatableResource, n: number | null): string {
  if (n == null) return '—'
  if (r === 'capitalCost')     return `$${n.toLocaleString()}`
  if (r === 'calendarTime')    return `${n.toLocaleString()} days`
  if (r === 'specialistStaff') return `${n.toLocaleString()} FTE`
  if (r === 'annualOverhead')  return `$${n.toLocaleString()}/yr`
  if (r === 'technicalDebt')   return `$${n.toLocaleString()}`
  return `${n.toLocaleString()}`
}
function formatDifferential(pct: number | null): string {
  if (pct == null) return '—'
  if (!Number.isFinite(pct)) return '∞% over'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

// ── Export — v529 (Tom Gilb 2026-07-22) ─────────────────────────────────────
// Export-Button-on-All-Windows SUPREME: every substantial window emits a
// colourful HTML export via the shared useAgentReportExport composable.
// Mailto-No-Self-To SUPREME: to:'' is passed inside exportAgentReport().
// Categorises the export by resource (Capital / Calendar / Staff / OPEX /
// Tech Debt), each carrying a "finding" per estimation snapshot with
// principle=resource-name, explanation=formatted amount+differential+status,
// citations=[settings.currency, standardsForResource(r)…].
async function exportResourcesReport(): Promise<void> {
  const findingsByResource: AgentExportCategoryGroup[] = activeResources.value.map((r) => {
    const s = series.value[r]
    const meta = RESOURCE_META[r]
    const est = s.latestAmount != null ? formatAmount(r, s.latestAmount) : '—'
    const budget = s.budgetAmount != null ? formatAmount(r, s.budgetAmount) : '—'
    const diff = formatDifferential(s.differentialPct)
    const status = statusLabel[s.status]
    const stds = agent.standardsForResource(r).map(id => {
      const std = RESOURCE_STANDARDS.find(x => x.id === id)
      return std ? `${std.label} (${std.category})` : id
    })
    const refs = agent.settings.value.contractReferences
      .filter((cr) => cr.resource === r)
      .map((cr) => `${cr.citation}${cr.url ? ` — ${cr.url}` : ''}`)
    return {
      categoryLabel: `${meta.glyph} ${meta.label}`,
      categorySubtitle: meta.hint,
      findings: [
        {
          id: `resource-${r}`,
          categoryLabel: meta.label,
          principleViolated: `Latest estimation`,
          explanation: `Estimated: ${est} · Stipulated (budget): ${budget} · Differential: ${diff} · Status: ${status}${s.history.length > 0 ? ` · History: ${s.history.length} estimation${s.history.length === 1 ? '' : 's'}` : ''}`,
          severityLabel: status,
          severityBgHex: s.status === 'overflow' ? '#dc2626' : s.status === 'warning' ? '#f59e0b' : s.status === 'ok' ? '#059669' : '#64748b',
          sourceLayerLabel: s.history[s.history.length - 1]?.source ?? 'undetermined',
          sourceLayerBgHex: '#e0e7ff',
          triggeredBy: s.history[s.history.length - 1]?.causes?.join(' · ') ?? '',
          fixPlanguage: refs.length > 0 ? `RFP/Contract references: ${refs.join(' · ')}` : '',
          fixRationale: s.history[s.history.length - 1]?.reasoning ?? '',
          longTermConsequence: '',
          citations: stds,
        },
      ],
    }
  })
  await exportAgentReport({
    agentName: '📐 Resources Agent',
    agentSubtitle: 'Central Resource Estimation Hub · 5 resources · standards · references',
    agentHeaderBgHex: '#312e81',  // indigo-900
    planTitle: '',
    scoreValue: activeResources.value.length,
    scoreLabel: `of 5 resources active · ${anyOverflow.value ? '🔴 overflow' : anyWarning.value ? '🟡 warning' : '🟢 on track'}`,
    totalFindings: activeResources.value.length,
    severityTally: [
      { label: 'ON TRACK', count: activeResources.value.filter(r => series.value[r].status === 'ok').length,       bgHex: '#059669' },
      { label: 'WARNING',  count: activeResources.value.filter(r => series.value[r].status === 'warning').length,  bgHex: '#f59e0b' },
      { label: 'OVERFLOW', count: activeResources.value.filter(r => series.value[r].status === 'overflow').length, bgHex: '#dc2626' },
      { label: 'NO EST',   count: activeResources.value.filter(r => series.value[r].status === 'no-estimate').length, bgHex: '#64748b' },
      { label: 'NO BGT',   count: activeResources.value.filter(r => series.value[r].status === 'no-budget').length,   bgHex: '#94a3b8' },
    ],
    headline: `Resources snapshot at ${new Date().toLocaleString()} — currency ${agent.settings.value.currency} · frequency ${agent.settings.value.updateFrequency}`,
    groups: findingsByResource,
    sourcesFooterHtml: `<p style="margin:8px 0;color:#334155;font-size:11px">Standards active: ${agent.activeStandards().map(id => RESOURCE_STANDARDS.find(x => x.id === id)?.label ?? id).join(' · ') || '(none)'}</p><p style="margin:8px 0;color:#334155;font-size:11px">Source: SEM App · ESTIMATION 1–9 (v504–v510) · Twin portability compliant.</p>`,
  })
}

// ── Sparkline ────────────────────────────────────────────────────────────────
//
// Simple SVG polyline of amount vs series index.  Overlays fitted regression
// line + extrapolated dashed segment forward N periods.  Height 60px, width
// scales with parent.

interface SparklineData {
  historyPoints:     { x: number; y: number }[]
  fittedPoints:      { x: number; y: number }[]
  extrapPoints:      { x: number; y: number }[]
  yMin: number
  yMax: number
  totalPoints: number   // history + extrapolated
}

function sparklineFor(r: EstimatableResource): SparklineData | null {
  const s = series.value[r]
  const hist = s.history
  if (hist.length === 0) return null
  const extra = agent.extrapolationFor(r)
  const rawH  = hist.map((e: Estimation, i: number) => ({ x: i, y: e.amount }))
  const fitPts = extra ? extra.fittedLine.map(p => ({ x: p.t, y: p.y })) : []
  const extPts = extra ? extra.extrapolatedPoints.map(p => ({ x: p.t, y: p.y })) : []
  const allY = [
    ...rawH.map(p => p.y),
    ...fitPts.map(p => p.y),
    ...extPts.map(p => p.y),
  ]
  const yMin = Math.min(...allY, 0)
  const yMax = Math.max(...allY, 1)
  const totalPoints = Math.max(rawH.length, (extPts.length ? extPts[extPts.length - 1].x + 1 : rawH.length))
  return { historyPoints: rawH, fittedPoints: fitPts, extrapPoints: extPts, yMin, yMax, totalPoints }
}

/** Scale a data point to SVG coordinates (0-based, viewBox 0 0 W H). */
function toSvg(pt: { x: number; y: number }, data: SparklineData, W: number, H: number): { x: number; y: number } {
  const paddedTop = 4
  const paddedBottom = H - 4
  const yRange = Math.max(1, data.yMax - data.yMin)
  const y = paddedBottom - ((pt.y - data.yMin) / yRange) * (paddedBottom - paddedTop)
  const xRange = Math.max(1, data.totalPoints - 1)
  const x = 4 + (pt.x / xRange) * (W - 8)
  return { x, y }
}
function polylineFor(data: SparklineData, points: { x: number; y: number }[], W: number, H: number): string {
  return points.map(p => {
    const { x, y } = toSvg(p, data, W, H)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

// ── Contract reference form state ────────────────────────────────────────────

const refFormOpen = ref<Record<EstimatableResource, boolean>>({
  capitalCost: false, calendarTime: false, specialistStaff: false,
  annualOverhead: false, technicalDebt: false,
})
const refDraft = ref<Record<EstimatableResource, { citation: string; url: string; note: string }>>({
  capitalCost:     { citation: '', url: '', note: '' },
  calendarTime:    { citation: '', url: '', note: '' },
  specialistStaff: { citation: '', url: '', note: '' },
  annualOverhead:  { citation: '', url: '', note: '' },
  technicalDebt:   { citation: '', url: '', note: '' },
})

function submitRef(r: EstimatableResource): void {
  const d = refDraft.value[r]
  if (!d.citation.trim()) return
  agent.addContractReference(r, d.citation, d.url, d.note)
  refDraft.value[r] = { citation: '', url: '', note: '' }
  refFormOpen.value[r] = false
}

function referencesFor(r: EstimatableResource) {
  return agent.settings.value.contractReferences.filter(x => x.resource === r)
}

// ── Standards grouping ──────────────────────────────────────────────────────

const standardsByCategory = computed(() => {
  const groups: Record<string, ResourceStandard[]> = {}
  for (const s of RESOURCE_STANDARDS) {
    if (!groups[s.category]) groups[s.category] = []
    groups[s.category].push(s)
  }
  return groups
})
const CATEGORY_LABEL: Record<ResourceStandard['category'], string> = {
  'financial-reporting': 'Financial Reporting',
  'us-navy':             'US Navy',
  'us-federal':          'US Federal',
  'us-dod':              'US DoD',
  'international':       'International',
  'professional':        'Professional',
  'project-management':  'Project Management',
  'custom':              'Custom',
}
function isStandardActive(id: string): boolean {
  return agent.settings.value.activeStandardIds.includes(id)
}

// ── Currency + frequency options ────────────────────────────────────────────

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NOK', 'SEK', 'DKK'] as const
const FREQ_OPTIONS = ['annual', 'monthly', 'quarterly', 'one-off'] as const

// v512 — Timeline event kind colouring
const TIMELINE_EVENT_COLOR: Record<string, string> = {
  'estimation':     '#4338ca',   // indigo
  'override':       '#7c3aed',   // violet
  'second-opinion': '#d97706',   // amber
  'evidence':       '#0891b2',   // cyan
}
const TIMELINE_EVENT_LABEL: Record<string, string> = {
  'estimation':     'Estimation',
  'override':       'Override',
  'second-opinion': 'Second opinion',
  'evidence':       'Evidence added',
}

// v512 — Compliance-cell colour classes (DD-017 R-G colorblind safe)
const COMPLIANCE_BAND_CLASS: Record<string, string> = {
  'ok':      'bg-emerald-100 text-emerald-800',
  'partial': 'bg-amber-100 text-amber-800',
  'weak':    'bg-rose-100 text-rose-800',
  'none':    'bg-slate-100 text-slate-500',
}
const COMPLIANCE_BAND_LABEL: Record<string, string> = {
  'ok':      'OK',
  'partial': 'Partial',
  'weak':    'Weak',
  'none':    'No data',
}

// v512 — Quarterly-review export: builds colourful HTML + plainText, copies to
// clipboard as multipart, opens Mail with the LOUD ⌘V cue per SEM Email Body
// Standard.  Composes with Colorful-HTML-Spec-Email + One-Table-for-Cohesion
// (r93aaa — quarterly review is ONE cohesive artifact, single outer table).
async function exportQuarterlyReport(): Promise<void> {
  try {
    const { html, plainText, title } = agent.buildQuarterlyReport()
    // Clipboard: HTML + plain
    const htmlBlob = new Blob([html], { type: 'text/html' })
    const plainBlob = new Blob([plainText], { type: 'text/plain' })
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob })])
    } catch { /* clipboard unavailable — mailto still fires */ }
    // Mailto — Mailto-No-Self-To SUPREME: leave To: empty (Tom is sender)
    const date = new Date().toISOString().slice(0, 10)
    const body = `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION\nExported: ${date}\n────────────────────────────────────────────────────────\n\n[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]`
    const url = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
    window.location.href = url
  } catch (err) {
    console.error('[ResourcesAgent] quarterly export failed', err)
  }
}
// v512 — Open the source-estimation of a timeline event (jump-back affordance)
function openEstimationInStrip(estimationId: string): void {
  // Emit up so the parent can scroll/reveal — for now fire a debug console.
  // Future v513+ wiring: expand the Overview card for this resource + scroll.
  console.info('[ResourcesAgent] jump to estimation', estimationId)
}

// ── v513 — AI Sharpening Dialogue ──────────────────────────────────────
// Per Claude-Code-as-AI-Layer SUPREME: clipboard-IO, never API call.
const sharpeningOpen = ref(false)
const sharpeningResource = ref<EstimatableResource | null>(null)
function openSharpeningFor(r: EstimatableResource): void {
  sharpeningResource.value = r
  sharpeningOpen.value = true
}
function closeSharpening(): void {
  sharpeningOpen.value = false
  // Keep sharpeningResource set for the exit animation — cleared on next open
}

// ── v513 — What-if Scenario ────────────────────────────────────────────
// Display-only projection: planner sets per-resource multipliers, sees
// projected Overview status without touching raw stored data.
interface WhatIfScenario {
  name: string
  multipliers: Partial<Record<EstimatableResource, number>>   // e.g. { capitalCost: 1.2, calendarTime: 0.9 }
}
const whatIfEnabled = ref(false)
const whatIfName = ref('Scenario A')
const whatIfMultipliers = ref<Partial<Record<EstimatableResource, number>>>({})
function initWhatIf(): void {
  // Default all active resources to 1.0 (no change)
  const m: Partial<Record<EstimatableResource, number>> = {}
  for (const r of activeResources.value) m[r] = 1.0
  whatIfMultipliers.value = m
}
function whatIfProjectedAmount(r: EstimatableResource): number | null {
  const raw = series.value[r].latestAmount
  if (raw == null) return null
  const mult = whatIfMultipliers.value[r] ?? 1.0
  return raw * mult
}
function whatIfProjectedDifferentialPct(r: EstimatableResource): number | null {
  const proj = whatIfProjectedAmount(r)
  const bud = series.value[r].budgetAmount
  if (proj == null || bud == null || bud === 0) return null
  return ((proj - bud) / bud) * 100
}
function whatIfProjectedStatus(r: EstimatableResource): 'ok' | 'warning' | 'overflow' | 'no-budget' | 'no-estimate' {
  const proj = whatIfProjectedAmount(r)
  const bud = series.value[r].budgetAmount
  if (proj == null) return 'no-estimate'
  if (bud == null) return 'no-budget'
  if (bud === 0) return proj > 0 ? 'overflow' : 'ok'
  const pct = (proj / bud) * 100
  if (pct >= 120) return 'overflow'
  if (pct >= 100) return 'warning'
  return 'ok'
}

// ── v513 — Auto-import (CSV / TSV / JSON) ──────────────────────────────
const importRawText = ref('')
const importParsedDrafts = ref<ReturnType<typeof agent.parseImportText>>([])
const importPreviewOpen = ref(false)
const importStatus = ref<{ ok: boolean; msg: string } | null>(null)
function parseImportPreview(): void {
  importStatus.value = null
  importParsedDrafts.value = agent.parseImportText(importRawText.value, 'imported')
  importPreviewOpen.value = importParsedDrafts.value.length > 0
}
function applyImport(): void {
  const valid = importParsedDrafts.value.filter(d => !d.warning)
  if (valid.length === 0) {
    importStatus.value = { ok: false, msg: 'No valid rows to import (all rows have warnings).' }
    return
  }
  const created = bulkImportEstimations(valid.map(d => ({
    resource:  d.resource,
    amount:    d.amount,
    currency:  d.currency,
    timeUnit:  d.timeUnit,
    reasoning: d.reasoning || `Imported from external system on ${new Date().toISOString().slice(0, 10)}`,
    source:    d.source,
    causes:    ['manual'],
  })))
  importStatus.value = { ok: true, msg: `✅ Imported ${created.length} estimation${created.length === 1 ? '' : 's'} — see Overview + Time-series above.` }
  importRawText.value = ''
  importParsedDrafts.value = []
  importPreviewOpen.value = false
}
async function loadImportSample(): Promise<void> {
  importRawText.value = [
    'resource,amount,currency,reasoning,source',
    'capitalCost,42000,USD,"Jira epic budget for Q3 hardening",imported',
    'calendarTime,6,,"Sprint estimate from Jira",imported',
    'annualOverhead,48000,USD,"AWS + Datadog + on-call rotation",imported',
  ].join('\n')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="resources-agent">
      <div v-if="open" class="fixed inset-0 z-[720]">
        <!-- Backdrop (CloseDot rule: click-outside dismisses) -->
        <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" @click="emit('close')" />

        <!-- Panel -->
        <section
          class="absolute inset-4 md:inset-10 lg:inset-14 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Resources Agent — the specialised agent for resource estimation, extrapolation, standards + contract references"
        >
          <!-- Header -->
          <header class="flex items-start justify-between px-6 py-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-emerald-50 border-b border-blue-200">
            <div class="flex items-center gap-4">
              <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg ring-2 ring-blue-300/40 select-none">
                <span class="text-lg leading-none" aria-hidden="true">📐</span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-blue-100">Agent</span>
                  <span class="text-base font-extrabold text-white">Resources</span>
                </span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-blue-900">Resource Estimation Hub</h2>
                <p class="text-[12px] text-blue-700/80">
                  {{ activeResources.length }} of 5 central resources active ·
                  <span v-if="anyOverflow" class="font-bold text-rose-700">🔴 overflow present</span>
                  <span v-else-if="anyWarning" class="font-bold text-amber-700">🟡 warning present</span>
                  <span v-else class="font-bold text-emerald-700">🟢 all within thresholds</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- v529 (Tom Gilb 2026-07-22) — Export pin per Export-Button-on-
                   All-Windows SUPREME rule.  Copies colourful HTML to clipboard
                   + auto-opens Mail with to:'' (Mailto-No-Self-To SUPREME). -->
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-white text-indigo-900 text-xs font-bold shadow ring-1 ring-indigo-200 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
                title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action).  Snapshot of every active resource with current estimation + budget + differential + status + reasoning + standards + references."
                @click="exportResourcesReport"
              >📤 Export</button>
              <!-- v530 (Tom Gilb 2026-07-22) — Unrelated-Actions-Get-Visual-Space
                   SUPREME.  Export and CloseDot are semantically unrelated:
                   Export publishes the report; CloseDot dismisses the panel.
                   Prior placement had them ~gap-2 apart which could read as
                   "related close-out actions".  Vertical divider + wider gap
                   makes the semantic separation visible. -->
              <div class="w-px h-6 bg-slate-300 mx-2" aria-hidden="true" />
              <CloseDot size="lg" aria-label="Close Resources Agent" @click="emit('close')" />
            </div>
          </header>

          <!-- Body -->
          <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-6 py-5 space-y-6">

            <!-- 1. Purpose banner -->
            <div class="rounded-xl border-2 border-blue-300 bg-blue-50/60 p-4">
              <p class="text-[13px] text-blue-900 leading-relaxed">
                <strong>Purpose:</strong> single place to see all 5 central resource series,
                dig into any resource's time-stamped history, extrapolate future values,
                manage standards + Contract/RFP references, and launch a Sharpening session
                when a resource is out of bounds. Everything else in the app writes into
                this hub — you drive it from here.
              </p>
            </div>

            <!-- 2. Overview grid -->
            <section aria-labelledby="overview-h">
              <h3 id="overview-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700 mb-2">
                Overview — all 5 resources
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div
                  v-for="r in activeResources"
                  :key="r"
                  class="rounded-xl border-2 border-slate-200 bg-white p-3 space-y-2 hover:border-blue-400 transition-colors"
                >
                  <div class="flex items-center gap-1.5">
                    <span class="text-base" aria-hidden="true">{{ RESOURCE_META[r].glyph }}</span>
                    <span class="font-bold text-[12px] text-slate-800">{{ RESOURCE_META[r].label }}</span>
                  </div>
                  <div class="text-[10px] text-slate-500">{{ RESOURCE_META[r].hint }}</div>
                  <div :class="['inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider', statusClass[series[r].status]]" :title="`Status: ${statusLabel[series[r].status]}`">
                    <span aria-hidden="true">{{ statusGlyph[series[r].status] }}</span>
                    {{ statusLabel[series[r].status] }}
                  </div>
                  <div class="text-[11px] space-y-0.5">
                    <div><span class="font-semibold text-slate-700">Estimated:</span> <span class="font-mono">{{ formatAmount(r, series[r].latestAmount) }}</span></div>
                    <div><span class="font-semibold text-slate-700">Stipulated:</span> <span class="font-mono">{{ formatAmount(r, series[r].budgetAmount) }}</span></div>
                    <div v-if="series[r].differentialPct != null" :class="['font-bold', series[r].differentialPct! > 0 ? 'text-rose-700' : 'text-emerald-700']">
                      Δ {{ formatDifferential(series[r].differentialPct) }} vs budget
                    </div>
                  </div>
                  <button
                    type="button"
                    class="w-full mt-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold flex items-center justify-center gap-1.5"
                    :title="`Open AI Sharpening dialogue for ${RESOURCE_META[r].label} — builds a full-context prompt for your local Claudian session (Claude-Code-as-AI-Layer SUPREME), paste-back JSON renders as recommendations`"
                    @click="openSharpeningFor(r)"
                  >
                    🔍 Sharpen with AI
                  </button>
                </div>
              </div>
            </section>

            <!-- 3. Time-series charts per resource -->
            <section aria-labelledby="charts-h">
              <h3 id="charts-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700 mb-2">
                Time-series + extrapolation
                <span class="text-[10px] text-indigo-500 normal-case ml-2">(latest {{ agent.settings.value.extrapolatePeriods }} periods extrapolated · linear regression)</span>
              </h3>
              <div class="space-y-3">
                <div
                  v-for="r in activeResources"
                  :key="r"
                  class="rounded-xl border border-indigo-200 bg-white p-3"
                >
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-2">
                      <span aria-hidden="true">{{ RESOURCE_META[r].glyph }}</span>
                      <span class="font-bold text-[12px] text-indigo-900">{{ RESOURCE_META[r].label }}</span>
                      <span class="text-[10px] text-slate-500">· {{ series[r].history.length }} estimation event{{ series[r].history.length === 1 ? '' : 's' }}</span>
                    </div>
                    <div v-if="agent.extrapolationFor(r)" class="text-[10px] text-slate-600 font-mono">
                      trend {{ (agent.extrapolationFor(r)!.trendPerPeriod).toFixed(1) }}/period · R²={{ (agent.extrapolationFor(r)!.r2).toFixed(2) }}
                    </div>
                  </div>
                  <template v-if="sparklineFor(r)">
                    <svg
                      :viewBox="`0 0 400 60`"
                      preserveAspectRatio="none"
                      class="w-full h-14 bg-slate-50 rounded"
                      role="img"
                      :aria-label="`Time-series of ${RESOURCE_META[r].label} — historical values + fitted trend line + extrapolated projection`"
                    >
                      <!-- fitted regression line (subtle) -->
                      <polyline
                        v-if="sparklineFor(r)!.fittedPoints.length > 1"
                        :points="polylineFor(sparklineFor(r)!, sparklineFor(r)!.fittedPoints, 400, 60)"
                        stroke="#94a3b8"
                        stroke-width="1"
                        stroke-dasharray="2 2"
                        fill="none"
                      />
                      <!-- historical series (bold) -->
                      <polyline
                        :points="polylineFor(sparklineFor(r)!, sparklineFor(r)!.historyPoints, 400, 60)"
                        stroke="#4338ca"
                        stroke-width="2"
                        fill="none"
                      />
                      <!-- extrapolated forward (dashed emerald) -->
                      <polyline
                        v-if="sparklineFor(r)!.extrapPoints.length > 0 && sparklineFor(r)!.historyPoints.length > 0"
                        :points="polylineFor(sparklineFor(r)!, [sparklineFor(r)!.historyPoints[sparklineFor(r)!.historyPoints.length - 1], ...sparklineFor(r)!.extrapPoints], 400, 60)"
                        stroke="#10b981"
                        stroke-width="2"
                        stroke-dasharray="4 3"
                        fill="none"
                      />
                      <!-- data point circles for history -->
                      <circle
                        v-for="(p, idx) in sparklineFor(r)!.historyPoints"
                        :key="'h' + idx"
                        :cx="toSvg(p, sparklineFor(r)!, 400, 60).x"
                        :cy="toSvg(p, sparklineFor(r)!, 400, 60).y"
                        r="2"
                        fill="#4338ca"
                      />
                      <!-- extrapolation projected marker -->
                      <circle
                        v-for="(p, idx) in sparklineFor(r)!.extrapPoints"
                        :key="'e' + idx"
                        :cx="toSvg(p, sparklineFor(r)!, 400, 60).x"
                        :cy="toSvg(p, sparklineFor(r)!, 400, 60).y"
                        r="2"
                        fill="#10b981"
                      />
                    </svg>
                    <div class="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>oldest {{ formatAmount(r, sparklineFor(r)!.historyPoints[0].y) }}</span>
                      <span>latest {{ formatAmount(r, sparklineFor(r)!.historyPoints[sparklineFor(r)!.historyPoints.length - 1].y) }}</span>
                      <span v-if="sparklineFor(r)!.extrapPoints.length > 0" class="text-emerald-700 font-semibold">
                        +{{ agent.settings.value.extrapolatePeriods }} → {{ formatAmount(r, sparklineFor(r)!.extrapPoints[sparklineFor(r)!.extrapPoints.length - 1].y) }}
                      </span>
                    </div>
                  </template>
                  <div v-else class="text-[10px] text-slate-500 italic">
                    No estimation events yet for {{ RESOURCE_META[r].label }} — add one in Stage 10 Resources to see the trend.
                  </div>
                </div>
              </div>
            </section>

            <!-- 4. Contract / RFP References per resource -->
            <section aria-labelledby="refs-h">
              <h3 id="refs-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 mb-2">
                Contract / RFP References per resource
              </h3>
              <div class="space-y-3">
                <div
                  v-for="r in activeResources"
                  :key="r"
                  class="rounded-xl border border-emerald-200 bg-white p-3 space-y-1.5"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span aria-hidden="true">{{ RESOURCE_META[r].glyph }}</span>
                      <span class="font-bold text-[12px] text-emerald-900">{{ RESOURCE_META[r].label }}</span>
                      <span class="text-[10px] text-slate-500">· {{ referencesFor(r).length }} reference{{ referencesFor(r).length === 1 ? '' : 's' }}</span>
                    </div>
                    <button
                      v-if="!refFormOpen[r]"
                      type="button"
                      class="text-[10px] px-2 py-1 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-semibold"
                      :title="`Add a Contract or RFP citation for ${RESOURCE_META[r].label} (e.g. clause number, section reference)`"
                      @click="refFormOpen[r] = true"
                    >+ Reference</button>
                  </div>
                  <div v-if="referencesFor(r).length > 0" class="space-y-1">
                    <div
                      v-for="ref in referencesFor(r)"
                      :key="ref.id"
                      class="flex items-center gap-2 text-[11px] text-slate-700 bg-emerald-50/60 rounded px-2 py-1"
                    >
                      <span class="font-semibold flex-1 min-w-0 truncate" :title="ref.note || ref.citation">{{ ref.citation }}</span>
                      <a v-if="ref.url" :href="ref.url" target="_blank" rel="noopener" class="text-[10px] text-blue-700 underline">↗ URL</a>
                      <button type="button" class="text-slate-400 hover:text-rose-600 text-[10px]" :title="`Remove this reference`" @click="agent.removeContractReference(ref.id)">✕</button>
                    </div>
                  </div>
                  <div v-if="refFormOpen[r]" class="rounded border border-emerald-300 bg-emerald-50/40 p-2 space-y-1.5">
                    <input v-model="refDraft[r].citation" type="text"
                           placeholder="Citation (e.g. PACRM Solicitation §3.2.1, Indianapolis Contract Article 8, Cl 2)"
                           class="w-full px-2 py-1 rounded border border-emerald-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                           :title="`Free-text citation naming the exact place in the Contract / RFP that constrains ${RESOURCE_META[r].label}`" />
                    <input v-model="refDraft[r].url" type="url"
                           placeholder="Optional URL (link to the clause / regulation / acquisition portal)"
                           class="w-full px-2 py-1 rounded border border-emerald-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                           title="Optional canonical URL for the citation" />
                    <input v-model="refDraft[r].note" type="text"
                           placeholder="Optional note (context / caveat / applicability window)"
                           class="w-full px-2 py-1 rounded border border-emerald-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <div class="flex justify-end gap-1.5">
                      <button type="button"
                              class="text-[10px] px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold"
                              @click="refFormOpen[r] = false"
                              title="Cancel — discard this reference draft">Cancel</button>
                      <button type="button"
                              class="text-[10px] px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 font-bold"
                              @click="submitRef(r)"
                              :title="`Save this reference to ${RESOURCE_META[r].label}`">+ Add reference</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- 5. Standards registry -->
            <section aria-labelledby="stds-h">
              <h3 id="stds-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 mb-2">
                Standards to apply
                <span class="text-[10px] text-violet-500 normal-case ml-2">({{ agent.activeStandards.value.length }} active · toggle to include in AI Sharpening + audit trail)</span>
              </h3>
              <div class="space-y-2">
                <div v-for="(items, cat) in standardsByCategory" :key="cat" class="rounded-xl border border-violet-200 bg-white p-3">
                  <div class="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-1.5">{{ CATEGORY_LABEL[cat as ResourceStandard['category']] }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="std in items"
                      :key="std.id"
                      type="button"
                      :class="[
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-colors',
                        isStandardActive(std.id)
                          ? 'bg-violet-100 border-violet-400 text-violet-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                      ]"
                      :title="`${std.label}${std.appliesTo ? ' · applies to: ' + std.appliesTo.map(r => RESOURCE_META[r].label).join(', ') : ' · applies to all 5 resources'}${std.authorityUrl ? ' · Source: ' + std.authorityUrl : ''}`"
                      @click="agent.toggleStandard(std.id)"
                    >
                      <span aria-hidden="true">{{ isStandardActive(std.id) ? '☑' : '☐' }}</span>
                      {{ std.shortLabel }}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- 6. Global settings -->
            <section aria-labelledby="settings-h">
              <h3 id="settings-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 mb-2">
                Global settings
              </h3>
              <div class="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <label class="flex flex-col gap-1 text-[11px]">
                  <span class="font-semibold">Default currency</span>
                  <select v-model="agent.settings.value.defaultCurrency"
                          class="px-2 py-1.5 rounded border border-slate-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                          title="Default currency for new Capital / Annual Overhead / Technical Debt estimations">
                    <option v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">{{ c }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-[11px]">
                  <span class="font-semibold">Default OPEX frequency</span>
                  <select v-model="agent.settings.value.defaultFrequency"
                          class="px-2 py-1.5 rounded border border-slate-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                          title="Default frequency for new OPEX breakdown line items">
                    <option v-for="f in FREQ_OPTIONS" :key="f" :value="f">{{ f }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-[11px]">
                  <span class="font-semibold">Extrapolation periods forward</span>
                  <input type="number" min="1" max="12" step="1" v-model.number="agent.settings.value.extrapolatePeriods"
                         class="px-2 py-1.5 rounded border border-slate-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                         title="How many estimation periods to project forward in the time-series charts" />
                </label>
                <!-- v511 — Display currency + Extrapolation method selectors -->
                <label class="flex flex-col gap-1 text-[11px]">
                  <span class="font-semibold">Display currency (v511)</span>
                  <select v-model="agent.settings.value.displayCurrency"
                          class="px-2 py-1.5 rounded border border-slate-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                          title="Currency all monetary amounts are converted to on display (original stored currency preserved).  Rates from a static approximation table — override with live rates when precision matters.">
                    <option v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">{{ c }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-[11px]">
                  <span class="font-semibold">Extrapolation method (v511)</span>
                  <select v-model="agent.settings.value.extrapolationMethod"
                          class="px-2 py-1.5 rounded border border-slate-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                          title="Linear regression = simple slope.  Wright's Law = learning-curve pattern (y = a·n⁻ᵇ) per Gilb Cost Engineering; falls back to linear when data has zeros/negatives or <2 points.">
                    <option value="linear-regression">Linear regression</option>
                    <option value="wrights-law">Wright's Law (learning curve)</option>
                  </select>
                </label>

                <div class="md:col-span-3">
                  <div class="text-[11px] font-semibold mb-1">Active resources (uncheck to hide — data preserved).  Central 5 always relevant; Extended 5 per Gilb Cost Engineering p.4 (opt-in).</div>
                  <div class="text-[10px] uppercase font-bold text-blue-700 tracking-wider mb-1">Central</div>
                  <div class="flex flex-wrap gap-2 mb-2">
                    <label v-for="r in CENTRAL_RESOURCES" :key="r"
                           class="inline-flex items-center gap-1.5 text-[11px] cursor-pointer"
                           :title="`Toggle ${RESOURCE_META[r].label} visibility (data preserved).  ${RESOURCE_META[r].hint}`">
                      <input type="checkbox" :checked="agent.settings.value.activeResources[r]" @change="agent.toggleResourceActive(r)"
                             class="rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                      <span>{{ RESOURCE_META[r].glyph }} {{ RESOURCE_META[r].label }}</span>
                    </label>
                  </div>
                  <div class="text-[10px] uppercase font-bold text-emerald-700 tracking-wider mb-1">Extended (v511 · Gilb Cost Engineering p.4)</div>
                  <div class="flex flex-wrap gap-2">
                    <label v-for="r in EXTENDED_RESOURCES" :key="r"
                           class="inline-flex items-center gap-1.5 text-[11px] cursor-pointer"
                           :title="`Toggle ${RESOURCE_META[r].label} tracking.  ${RESOURCE_META[r].hint}.  Grounded in Cost Engineering (2023) p.4 broader-resource-types framing.`">
                      <input type="checkbox" :checked="agent.settings.value.activeResources[r]" @change="agent.toggleResourceActive(r)"
                             class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                      <span>{{ RESOURCE_META[r].glyph }} {{ RESOURCE_META[r].label }}</span>
                    </label>
                  </div>
                </div>

                <!-- v511 — De-biasing pass configuration -->
                <div class="md:col-span-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <div class="text-[11px] font-bold text-amber-900">
                      🎯 De-biasing pass (v511 · Bent Flyvbjerg Iron Law antidote)
                    </div>
                    <label class="inline-flex items-center gap-1.5 text-[10px] cursor-pointer"
                           :title="`Enable de-biasing uplift on displayed amounts.  Underlying stored amounts unchanged.  Adjusts for optimism bias (planners underestimate) + strategic misrepresentation (advocates minimise cost to win approval).  Antidote per Bent Flyvbjerg 'Iron Law of Megaprojects': realistic planning + de-biasing of all cost, schedule, and benefit estimates.`">
                      <input type="checkbox" v-model="agent.settings.value.debiasing.enabled"
                             class="rounded border-amber-400 text-amber-600 focus:ring-amber-400" />
                      <span class="font-semibold text-amber-900">Enabled</span>
                    </label>
                  </div>
                  <div class="text-[10px] italic text-amber-800/80">
                    Applied uplift = optimism + strategic-misrepresentation (multiplicative).  When enabled, all extrapolations for the checked resources display at (1 + uplift) × raw value.
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="flex flex-col gap-0.5 text-[10px]">
                      <span class="font-semibold text-amber-900">Optimism bias uplift <span class="font-mono">{{ agent.settings.value.debiasing.optimismUpliftPct }}%</span></span>
                      <input type="range" min="0" max="100" step="1" v-model.number="agent.settings.value.debiasing.optimismUpliftPct"
                             :disabled="!agent.settings.value.debiasing.enabled" class="w-full" />
                    </label>
                    <label class="flex flex-col gap-0.5 text-[10px]">
                      <span class="font-semibold text-amber-900">Strategic misrep. uplift <span class="font-mono">{{ agent.settings.value.debiasing.strategicMisrepPct }}%</span></span>
                      <input type="range" min="0" max="100" step="1" v-model.number="agent.settings.value.debiasing.strategicMisrepPct"
                             :disabled="!agent.settings.value.debiasing.enabled" class="w-full" />
                    </label>
                  </div>
                  <div class="text-[10px] text-amber-900">
                    Apply to resources:
                    <label v-for="r in orderedResources.filter(r => agent.settings.value.activeResources[r])" :key="r"
                           class="inline-flex items-center gap-1 mx-1.5 cursor-pointer"
                           :title="`Include ${RESOURCE_META[r].label} in the de-biasing uplift`">
                      <input type="checkbox"
                             :checked="agent.settings.value.debiasing.applyToResources.includes(r)"
                             @change="() => {
                               const arr = agent.settings.value.debiasing.applyToResources
                               agent.settings.value.debiasing.applyToResources = arr.includes(r) ? arr.filter(x => x !== r) : [...arr, r]
                             }"
                             :disabled="!agent.settings.value.debiasing.enabled"
                             class="rounded border-amber-300 text-amber-600 focus:ring-amber-400" />
                      <span>{{ RESOURCE_META[r].glyph }} {{ RESOURCE_META[r].label }}</span>
                    </label>
                  </div>
                  <div v-if="agent.settings.value.debiasing.enabled" class="text-[10px] font-mono font-bold text-rose-700">
                    Effective uplift: ×{{ (1 + (agent.settings.value.debiasing.optimismUpliftPct + agent.settings.value.debiasing.strategicMisrepPct) / 100).toFixed(2) }}
                  </div>
                </div>
                <label class="flex flex-col gap-1 text-[11px] md:col-span-3">
                  <span class="font-semibold">Notes / methodology</span>
                  <textarea v-model="agent.settings.value.notes" rows="2"
                            placeholder="e.g. 'Using PoSEM 1988 §17 Cleanroom cadence; monthly re-estimation triggered by every completed Evo Step; capital + annual overhead reviewed at each Owner review'"
                            class="px-2 py-1.5 rounded border border-slate-300 bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title="Free-text notes about your resource-estimation methodology; carried into exports + AI Sharpening context"></textarea>
                </label>
              </div>
            </section>

            <!-- 7. Snapshot history caption (from useIetResourceSnapshot) -->
            <section v-if="snapshotHistory.length > 0" class="text-[11px] text-slate-600 italic">
              {{ snapshotHistory.length }} IET snapshot{{ snapshotHistory.length === 1 ? '' : 's' }} recorded ·
              latest {{ snapshotHistory[snapshotHistory.length - 1].timestamp.slice(0, 19).replace('T', ' ') }} ·
              reason: "{{ snapshotHistory[snapshotHistory.length - 1].reason }}"
            </section>

            <!-- v512 Section 9 — Timeline view (all events across all resources on one horizontal axis) -->
            <section aria-labelledby="timeline-h">
              <div class="flex items-center justify-between mb-2">
                <h3 id="timeline-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700">
                  Timeline · all resource events
                  <span class="text-[10px] text-cyan-500 normal-case ml-2">({{ timelineEvents.length }} event{{ timelineEvents.length === 1 ? '' : 's' }})</span>
                </h3>
              </div>
              <div v-if="timelineEvents.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500 italic">
                No events yet.  Add estimations in Stage 10 Resources or the Overview cards above; every estimation, override, second opinion, and evidence link appears here.
              </div>
              <div v-else class="rounded-xl border border-cyan-200 bg-white p-3 space-y-2">
                <!-- Horizontal axis SVG -->
                <svg viewBox="0 0 800 60" preserveAspectRatio="none" class="w-full h-16 bg-slate-50 rounded" role="img" aria-label="Timeline of every resource event across the plan">
                  <!-- axis line -->
                  <line x1="0" y1="30" x2="800" y2="30" stroke="#94a3b8" stroke-width="1" />
                  <!-- event dots -->
                  <template v-for="(ev, idx) in timelineEvents" :key="idx">
                    <circle
                      :cx="4 + (idx / Math.max(1, timelineEvents.length - 1)) * 792"
                      :cy="30"
                      r="4"
                      :fill="TIMELINE_EVENT_COLOR[ev.kind]"
                      :aria-label="ev.label"
                    >
                      <title>{{ ev.timestamp.slice(0, 19).replace('T', ' ') }} — {{ ev.label }}</title>
                    </circle>
                  </template>
                </svg>
                <!-- Legend + oldest/latest labels -->
                <div class="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
                  <div class="flex flex-wrap gap-2">
                    <span v-for="(color, kind) in TIMELINE_EVENT_COLOR" :key="kind" class="inline-flex items-center gap-1">
                      <span class="inline-block w-2 h-2 rounded-full" :style="`background:${color}`" aria-hidden="true"></span>
                      {{ TIMELINE_EVENT_LABEL[kind] }}
                    </span>
                  </div>
                  <div class="text-slate-500">
                    oldest {{ timelineEvents[0].timestamp.slice(0, 10) }} · latest {{ timelineEvents[timelineEvents.length - 1].timestamp.slice(0, 10) }}
                  </div>
                </div>
                <!-- Recent-events list (last 8, newest first) -->
                <div class="max-h-40 overflow-y-auto space-y-0.5 border-t border-slate-100 pt-2">
                  <div
                    v-for="(ev, idx) in [...timelineEvents].reverse().slice(0, 8)"
                    :key="'te' + idx"
                    class="flex items-center gap-2 text-[10px] text-slate-700 hover:bg-slate-50 rounded px-1 py-0.5"
                  >
                    <span class="inline-block w-2 h-2 rounded-full shrink-0" :style="`background:${TIMELINE_EVENT_COLOR[ev.kind]}`" :title="TIMELINE_EVENT_LABEL[ev.kind]" aria-hidden="true"></span>
                    <span class="font-mono text-slate-500 shrink-0">{{ ev.timestamp.slice(11, 19) }}</span>
                    <span class="text-slate-400 shrink-0">{{ ev.timestamp.slice(0, 10) }}</span>
                    <span class="flex-1 min-w-0 truncate" :title="ev.label">{{ ev.label }}</span>
                  </div>
                </div>
              </div>
            </section>

            <!-- v512 Section 10 — Second-opinion inbox (outstanding, cross-resource) -->
            <section aria-labelledby="inbox-h">
              <h3 id="inbox-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-2">
                Second-opinion inbox
                <span class="text-[10px] text-amber-500 normal-case ml-2">({{ outstandingOpinions.length }} outstanding · retracted opinions filtered out)</span>
              </h3>
              <div v-if="outstandingOpinions.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500 italic">
                No outstanding second opinions.  Add opinions in Stage 10 Resources → Estimation history → "+ Second Opinion" per estimation.
              </div>
              <div v-else class="rounded-xl border border-amber-200 bg-white p-3 space-y-2 max-h-60 overflow-y-auto">
                <div
                  v-for="o in outstandingOpinions"
                  :key="o.opinion.id"
                  class="rounded-lg border border-amber-200 bg-amber-50/50 p-2 space-y-1"
                >
                  <div class="flex items-start justify-between gap-2 text-[11px]">
                    <div class="flex-1 min-w-0">
                      <span class="font-bold text-amber-900">{{ o.opinion.holderName }}</span>
                      <span v-if="o.opinion.holderEmail" class="text-slate-500"> · <a :href="`mailto:${o.opinion.holderEmail}`" class="underline hover:text-amber-700">{{ o.opinion.holderEmail }}</a></span>
                      <span class="text-slate-500"> · on {{ RESOURCE_META[o.estimation.resource].glyph }} {{ RESOURCE_META[o.estimation.resource].label }}</span>
                    </div>
                    <span class="text-[9px] font-mono text-slate-400 shrink-0">{{ o.opinion.timestamp.slice(0, 10) }}</span>
                  </div>
                  <div class="text-[11px] text-slate-700 italic">"{{ o.opinion.reasons }}"</div>
                  <div v-if="o.opinion.alternativeAmount != null" class="text-[10px] text-amber-800">
                    Suggests alternative amount: <span class="font-mono font-bold">{{ o.opinion.alternativeAmount.toLocaleString() }}</span>
                    <span v-if="o.estimation.amount"> (vs stored {{ o.estimation.amount.toLocaleString() }} — Δ {{ (((o.opinion.alternativeAmount - o.estimation.amount) / o.estimation.amount) * 100).toFixed(1) }}%)</span>
                  </div>
                </div>
              </div>
            </section>

            <!-- v512 Section 11 — Compliance scorecard (resources × active-standards matrix) -->
            <section aria-labelledby="compliance-h">
              <h3 id="compliance-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 mb-2">
                Compliance scorecard
                <span class="text-[10px] text-violet-500 normal-case ml-2">(evidence coverage × credibility per resource × active-standard cell — Gilb Cost Engineering audit-trail discipline)</span>
              </h3>
              <div v-if="complianceMatrix.standards.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500 italic">
                No active standards.  Toggle any Standard on above to see compliance scoring per resource.
              </div>
              <div v-else class="rounded-xl border border-violet-200 bg-white p-2 overflow-x-auto">
                <table class="min-w-full text-[10px]">
                  <thead>
                    <tr class="border-b border-violet-200">
                      <th class="text-left px-2 py-1 font-bold text-violet-900 whitespace-nowrap">Resource</th>
                      <th v-for="std in complianceMatrix.standards" :key="std.id" class="px-1.5 py-1 font-bold text-violet-900 text-center whitespace-nowrap" :title="`${std.label}${std.appliesTo ? ' · applies to: ' + std.appliesTo.map(r => RESOURCE_META[r].label).join(', ') : ' · applies to all resources'}`">
                        {{ std.shortLabel }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in complianceMatrix.resources" :key="r" class="border-b border-slate-100">
                      <td class="px-2 py-1 text-left font-semibold text-slate-800 whitespace-nowrap">
                        {{ RESOURCE_META[r].glyph }} {{ RESOURCE_META[r].label }}
                      </td>
                      <td
                        v-for="std in complianceMatrix.standards"
                        :key="std.id"
                        :class="['text-center px-1.5 py-1 font-mono font-bold', COMPLIANCE_BAND_CLASS[complianceMatrix.cells[r][std.id].band]]"
                        :title="`${RESOURCE_META[r].label} × ${std.shortLabel} — ${complianceMatrix.cells[r][std.id].estimationsWithEvidence}/${complianceMatrix.cells[r][std.id].totalEstimations} estimations carry evidence · avg credibility ${(complianceMatrix.cells[r][std.id].avgCredibility * 100).toFixed(0)}% · score ${complianceMatrix.cells[r][std.id].score}% · ${COMPLIANCE_BAND_LABEL[complianceMatrix.cells[r][std.id].band]}`"
                      >{{ complianceMatrix.cells[r][std.id].band === 'none' ? '—' : complianceMatrix.cells[r][std.id].score + '%' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="text-[9px] text-slate-500 italic mt-1 px-1">
                  Score = coverage (estimations-with-evidence / total) × average evidence credibility × 100.
                  Bands: <span class="text-emerald-700 font-semibold">OK ≥70</span> · <span class="text-amber-700 font-semibold">Partial ≥40</span> · <span class="text-rose-700 font-semibold">Weak &lt;40</span> · <span class="text-slate-500">— no estimations</span>.
                </div>
              </div>
            </section>

            <!-- v512 Section 12 — Aggregate Evidence + Sources cross-estimation view -->
            <section aria-labelledby="evidence-h">
              <h3 id="evidence-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700 mb-2">
                Aggregate Evidence + Sources
                <span class="text-[10px] text-blue-500 normal-case ml-2">({{ allEvidenceLinks.length }} evidence link{{ allEvidenceLinks.length === 1 ? '' : 's' }} across all estimations · newest first · Planguage Logic audit trail)</span>
              </h3>
              <div v-if="allEvidenceLinks.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500 italic">
                No evidence links captured.  Add evidence in Stage 10 Resources → any estimation → "+ Evidence" (Contract clause, Book citation, URL, Benchmark, Expert opinion, etc.).
              </div>
              <div v-else class="rounded-xl border border-blue-200 bg-white p-3 max-h-64 overflow-y-auto">
                <table class="min-w-full text-[10px]">
                  <thead class="sticky top-0 bg-white border-b border-blue-100">
                    <tr>
                      <th class="text-left px-2 py-1 font-bold text-blue-900">Resource</th>
                      <th class="text-left px-2 py-1 font-bold text-blue-900">Kind</th>
                      <th class="text-left px-2 py-1 font-bold text-blue-900">Citation</th>
                      <th class="text-center px-2 py-1 font-bold text-blue-900">Cred.</th>
                      <th class="text-right px-2 py-1 font-bold text-blue-900">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="ae in allEvidenceLinks" :key="ae.evidence.id" class="border-b border-slate-100 hover:bg-blue-50/50">
                      <td class="px-2 py-1 text-slate-700 whitespace-nowrap">{{ RESOURCE_META[ae.resource].glyph }} {{ RESOURCE_META[ae.resource].label }}</td>
                      <td class="px-2 py-1"><span class="inline-block rounded px-1 py-0.5 bg-blue-100 text-blue-800 font-semibold text-[9px] uppercase tracking-wider">{{ ae.evidence.kind }}</span></td>
                      <td class="px-2 py-1 text-slate-700">
                        <a v-if="ae.evidence.url" :href="ae.evidence.url" target="_blank" rel="noopener" class="text-blue-700 hover:underline">{{ ae.evidence.citation }} ↗</a>
                        <span v-else>{{ ae.evidence.citation }}</span>
                      </td>
                      <td :class="['px-2 py-1 text-center font-mono font-bold', ae.evidence.credibility >= 0.8 ? 'text-emerald-700' : ae.evidence.credibility >= 0.5 ? 'text-amber-700' : 'text-rose-700']">{{ (ae.evidence.credibility * 100).toFixed(0) }}%</td>
                      <td class="px-2 py-1 text-right text-slate-500 font-mono">{{ ae.evidence.addedAt.slice(0, 10) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <!-- v512 Section 13 — Print-ready Quarterly Review export -->
            <section aria-labelledby="export-h">
              <h3 id="export-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 mb-2">
                Quarterly Review Export
              </h3>
              <div class="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-4">
                <p class="text-[12px] text-emerald-900 mb-3">
                  Build a colourful HTML Quarterly Review of the whole resource landscape — Overview per resource, active Standards, outstanding Second Opinions, Evidence trail, methodology notes.  Copies to clipboard as multipart (HTML + plain), then opens Mail with the SEM Email Body Standard LOUD ⌘V cue.
                </p>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md"
                  title="Build the Quarterly Review · copies colourful HTML + plain to clipboard · opens Mail (To: empty per Mailto-No-Self-To — Tom is the sender) with LOUD ⌘V cue in the body per SEM Email Body Standard"
                  @click="exportQuarterlyReport"
                >
                  📄 Build + Send Quarterly Review
                </button>
                <div class="text-[10px] text-emerald-800/70 italic mt-2">
                  Grounded in Gilb Cost Engineering (2023) + Planguage Logic (2026) · one-outer-table format per r93aaa · inline styles only (Mail-safe).
                </div>
              </div>
            </section>

            <!-- v513 Section 14 — What-if scenario planner (display-only projection over current data) -->
            <section aria-labelledby="whatif-h">
              <div class="flex items-center justify-between mb-2">
                <h3 id="whatif-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-700">
                  What-if planner
                  <span class="text-[10px] text-fuchsia-500 normal-case ml-2">(display-only projection · raw stored data unchanged)</span>
                </h3>
                <label class="inline-flex items-center gap-1.5 text-[11px] cursor-pointer"
                       title="Enable scenario multipliers.  When on, Overview + Time-series display the projected values; when off, no change.  Never mutates stored data.">
                  <input type="checkbox" v-model="whatIfEnabled" @change="whatIfEnabled && Object.keys(whatIfMultipliers).length === 0 && initWhatIf()"
                         class="rounded border-fuchsia-300 text-fuchsia-600 focus:ring-fuchsia-400" />
                  <span class="font-semibold text-fuchsia-900">Enabled</span>
                </label>
              </div>

              <div v-if="!whatIfEnabled" class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-500 italic">
                Enable to model resource scenarios (e.g. "What if we cut Capital by 20%?" or "What if Calendar Time stretches 30%?"). Adjust per-resource multipliers, see projected status + differential live. Raw stored estimations never change.
              </div>
              <div v-else class="rounded-xl border-2 border-fuchsia-300 bg-fuchsia-50/50 p-4 space-y-3">
                <input v-model="whatIfName" type="text" placeholder="Scenario name (e.g. Aggressive cost-cut, Doubled scope, Delayed launch)"
                       class="w-full px-2 py-1.5 rounded border border-fuchsia-300 bg-white text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-fuchsia-400" />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div v-for="r in activeResources" :key="r"
                       class="rounded-lg border border-fuchsia-200 bg-white p-2 space-y-1.5">
                    <div class="flex items-center gap-1.5 text-[11px]">
                      <span aria-hidden="true">{{ RESOURCE_META[r].glyph }}</span>
                      <span class="font-bold text-slate-800">{{ RESOURCE_META[r].label }}</span>
                      <span class="ml-auto text-[10px] font-mono text-fuchsia-700">×{{ (whatIfMultipliers[r] ?? 1.0).toFixed(2) }}</span>
                    </div>
                    <input type="range" min="0.1" max="3.0" step="0.05" :value="whatIfMultipliers[r] ?? 1.0"
                           @input="e => whatIfMultipliers[r] = Number((e.target as HTMLInputElement).value)"
                           class="w-full" :aria-label="`${RESOURCE_META[r].label} scenario multiplier`" />
                    <div class="grid grid-cols-3 gap-1 text-[10px]">
                      <div><span class="text-slate-500">Raw:</span> <span class="font-mono">{{ series[r].latestAmount != null ? series[r].latestAmount!.toLocaleString() : '—' }}</span></div>
                      <div><span class="text-slate-500">Projected:</span> <span class="font-mono font-bold text-fuchsia-800">{{ whatIfProjectedAmount(r) != null ? whatIfProjectedAmount(r)!.toLocaleString() : '—' }}</span></div>
                      <div>
                        <span class="text-slate-500">Δ vs budget:</span>
                        <span :class="['font-mono font-bold', whatIfProjectedDifferentialPct(r) != null && whatIfProjectedDifferentialPct(r)! > 0 ? 'text-rose-700' : 'text-emerald-700']">
                          {{ whatIfProjectedDifferentialPct(r) != null ? (whatIfProjectedDifferentialPct(r)! > 0 ? '+' : '') + whatIfProjectedDifferentialPct(r)!.toFixed(1) + '%' : '—' }}
                        </span>
                      </div>
                    </div>
                    <div class="text-[10px]">
                      <span class="text-slate-500">Projected status:</span>
                      <span :class="['inline-block ml-1 rounded-full px-2 py-0.5 font-bold uppercase text-[9px] tracking-wider', statusClass[whatIfProjectedStatus(r)]]">
                        {{ statusGlyph[whatIfProjectedStatus(r)] }} {{ statusLabel[whatIfProjectedStatus(r)] }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="text-[10px] text-fuchsia-800 italic">
                  Scenario "{{ whatIfName }}" — projections apply only to this Agent view + Overview differentials.  To persist, add a manual estimation in Stage 10 Resources with source='planner' and the projected amount as the value.
                </div>
              </div>
            </section>

            <!-- v513 Section 15 — Auto-import from external systems (Jira / CSV / JSON) -->
            <section aria-labelledby="import-h">
              <div class="flex items-center justify-between mb-2">
                <h3 id="import-h" class="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">
                  Auto-import from external systems
                  <span class="text-[10px] text-teal-500 normal-case ml-2">(CSV / TSV / JSON · reviewed before commit)</span>
                </h3>
                <button v-if="!importRawText" type="button" class="text-[10px] px-2 py-1 rounded bg-teal-100 text-teal-800 hover:bg-teal-200 font-semibold"
                        title="Paste a small example CSV so you can see the expected shape"
                        @click="loadImportSample">Load sample CSV</button>
              </div>
              <div class="rounded-xl border-2 border-teal-300 bg-teal-50/40 p-4 space-y-2">
                <textarea v-model="importRawText" rows="5"
                          placeholder="Paste CSV / TSV / JSON here.&#10;CSV shape: resource,amount,currency,reasoning,source&#10;JSON shape: [{resource, amount, currency?, reasoning?, source?}, ...]&#10;Recognised resources: capitalCost · calendarTime · specialistStaff · annualOverhead · technicalDebt · spaceCost · reputationCost · knowledgeBase · opportunityCost · cognitiveLoad"
                          class="w-full px-2 py-1.5 rounded border border-teal-300 bg-white font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-teal-400"
                          title="Paste rows from Jira / QuickBooks / Excel / an accounting export.  CSV needs a header row with at least 'resource' and 'amount' columns."></textarea>
                <div class="flex items-center gap-2">
                  <button type="button" class="text-[11px] px-3 py-1.5 rounded bg-teal-500 text-white hover:bg-teal-600 font-bold"
                          :disabled="!importRawText.trim()"
                          @click="parseImportPreview"
                          title="Parse the pasted text into a preview.  Rows with warnings can be excluded before applying.">📥 Parse + Preview</button>
                  <button v-if="importPreviewOpen && importParsedDrafts.length > 0" type="button"
                          class="text-[11px] px-3 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 font-bold"
                          :title="`Apply ${importParsedDrafts.filter(d => !d.warning).length} valid row(s) as new estimations (source='imported' unless overridden)`"
                          @click="applyImport">✅ Apply {{ importParsedDrafts.filter(d => !d.warning).length }} valid row{{ importParsedDrafts.filter(d => !d.warning).length === 1 ? '' : 's' }}</button>
                </div>
                <div v-if="importStatus" :class="['text-[11px] rounded p-2', importStatus.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800']">{{ importStatus.msg }}</div>
                <div v-if="importPreviewOpen && importParsedDrafts.length > 0" class="rounded border border-teal-200 bg-white p-2 max-h-48 overflow-y-auto">
                  <table class="w-full text-[10px]">
                    <thead class="sticky top-0 bg-white border-b border-teal-100">
                      <tr>
                        <th class="text-left px-1 py-1 font-bold text-teal-900">#</th>
                        <th class="text-left px-1 py-1 font-bold text-teal-900">Resource</th>
                        <th class="text-right px-1 py-1 font-bold text-teal-900">Amount</th>
                        <th class="text-left px-1 py-1 font-bold text-teal-900">Reasoning</th>
                        <th class="text-left px-1 py-1 font-bold text-teal-900">Source</th>
                        <th class="text-left px-1 py-1 font-bold text-teal-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="d in importParsedDrafts" :key="d.rowIndex" :class="[d.warning ? 'bg-rose-50' : 'hover:bg-teal-50/50']">
                        <td class="px-1 py-1 text-slate-500">{{ d.rowIndex }}</td>
                        <td class="px-1 py-1"><span v-if="!d.warning">{{ RESOURCE_META[d.resource].glyph }} {{ RESOURCE_META[d.resource].label }}</span><span v-else class="text-rose-700">—</span></td>
                        <td class="px-1 py-1 text-right font-mono">{{ d.warning ? '—' : d.amount.toLocaleString() }}</td>
                        <td class="px-1 py-1 text-slate-700 truncate max-w-[200px]" :title="d.reasoning">{{ d.reasoning }}</td>
                        <td class="px-1 py-1 text-slate-500">{{ d.source }}</td>
                        <td class="px-1 py-1"><span v-if="d.warning" class="text-rose-700 font-semibold" :title="d.warning">⚠ {{ d.warning }}</span><span v-else class="text-emerald-700">✓ ready</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="text-[10px] text-teal-800/70 italic">
                  All imported rows carry source='imported' + causes=['manual'] and land in the Estimations history like any other event — Timeline + Compliance + Overview all update automatically.
                </div>
              </div>
            </section>

            <!-- 8a. Gilb Cost Engineering — extensions to consider (v510 ESTIMATION 9 grounding) -->
            <div class="rounded-xl border-2 border-blue-300 bg-blue-50/40 p-3 text-[11px] text-blue-900 space-y-1">
              <div class="font-bold text-blue-900 text-[12px] mb-1.5">
                📚 From Gilb Cost Engineering (2023) + Planguage Logic (July 2026)
              </div>
              <div class="text-[10px] italic text-blue-800/80 mb-1">
                "Cost: any type of resource needed to create, develop, maintain or retire.  Includes financial, time, space, reputation, human talent, knowledge bases." — Gilb Cost Engineering p.4
              </div>
              <div>• <strong>Broader cost types</strong> to consider adding as resources: <em>space</em> · <em>reputation</em> · <em>knowledge-base</em> · <em>opportunity cost</em> · <em>attention / cognitive load</em></div>
              <div>• <strong>Wright's Law</strong> — cost declines predictably with cumulative production (learning-curve extrapolation, not just linear regression)</div>
              <div>• <strong>DtC / DDtC</strong> — Design-to-Cost (fix cost, adjust design) vs Dynamic-Design-to-Cost (Cleanroom / Evo cadence)</div>
              <div>• <strong>Bent Flyvbjerg — Iron Law of Megaprojects</strong> — "Over time, over budget, under benefits, over and over again."  Antidotes: (a) realistic planning + de-biasing (b) high-quality delivery teams (c) governance with incentives</div>
              <div>• <strong>De-biasing pass</strong> — surface + adjust for strategic misrepresentation (political) + optimism bias (psychological) in every estimate</div>
              <div>• <strong>VIET</strong> (Value Impact Estimation Table, Brodie PhD 2015) — separate value + cost impact matrices</div>
              <div>• <strong>Planguage Logic — equations linked to evidence</strong> — every estimate carries the formula that produced it + evidence links per variable (SHIPPED v510 in ResourceEstimationCard per-estimation "Equation + Evidence" section)</div>
            </div>

            <!-- 8b. Future extensions callout -->
            <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-[10px] text-slate-600 space-y-0.5">
              <div class="font-bold text-slate-700 text-[11px] mb-1">🚀 Coming beyond v513</div>
              <div>• Monte Carlo confidence bands on extrapolation (uncertainty visible)</div>
              <div>• Risk-weighted extrapolation (favour recent-actuals over early estimates)</div>
              <div>• Per-resource extrapolation-method override (Wright's Law for hardware, Linear for services)</div>
              <div>• Direct API adapters for Jira / QuickBooks / Xero / Asana (paste-CSV works today for all of them)</div>
              <div class="text-[9px] text-emerald-700 italic mt-1">
                ✓ Shipped v511: Broader cost types · Currency conversion · Wright's Law · De-biasing pass
              </div>
              <div class="text-[9px] text-emerald-700 italic">
                ✓ Shipped v512: Timeline · Second-opinion inbox · Compliance scorecard · Aggregate Evidence · Quarterly Review Export
              </div>
              <div class="text-[9px] text-emerald-700 italic">
                ✓ Shipped v513: AI Sharpening (Claudian clipboard-IO) · What-if planner · Auto-import from external systems
              </div>
            </div>

          </ScrollContainer>

          <!-- Footer (top-and-bottom nav mirror) -->
          <footer class="flex items-center justify-end gap-3 px-6 py-3 border-t border-blue-200 bg-blue-50/50">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              title="Close Resources Agent (settings + references auto-persisted; nothing lost)"
              @click="emit('close')"
            >Close</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>

  <!-- v513 — AI Sharpening dialogue mounted at panel level so it composes
       independently (its own Teleport + backdrop + registerExclusiveSurface-
       style z-order z-[730] above the Agent's z-[720]). -->
  <ResourcesSharpeningDialog
    :open="sharpeningOpen"
    :resource="sharpeningResource"
    :plan-id-ref="planIdRef"
    @close="closeSharpening"
  />
</template>

<style scoped>
.resources-agent-enter-active,
.resources-agent-leave-active { transition: opacity 180ms ease; }
.resources-agent-enter-from,
.resources-agent-leave-to { opacity: 0; }
</style>
