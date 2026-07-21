<!-- UNIT_TYPE=Component -->
<!--
 * RedraftResultPanel.vue — Contract Redraft result display + export.
 *
 * r41 v438 (Ship 2 of Contract Redraft) — displays the assembled
 * `ContractRedraftResult`: executive summary, Contract Health Index
 * dashboard, corrections table (A5), remaining defects table (A6),
 * glossary (A1), related documents (A3), redrafted body preview.
 *
 * Composes with:
 *   • ScrollContainer SUPREME
 *   • CloseDot SUPREME (lg variant + backdrop + Escape)
 *   • MOVE Principle SUPREME (tabs visible at-a-glance)
 *   • Icon-Plus-Text SUPREME
 *   • Spell-out-Type-Names SUPREME (no abbreviations)
 *   • Colorful Exports Rule (Copy + Email paths use exportEmail)
 -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ContractRedraftResult } from '../types/contractRedraft'
import { REDRAFT_STANDARDS, REDRAFT_POLICIES } from '../types/contractRedraft'
import CloseDot from './CloseDot.vue'
import { exportEmail } from '../composables/useExportShared'

const props = defineProps<{
  open:   boolean
  result: ContractRedraftResult | null
  /** r41 v450 (Tom Gilb 2026-07-02 verbatim *"are giving me the Monitor
   *  analysis, and I chose Indianapolis, my latest work (by far)"*) —
   *  the currently-selected contract in the parent.  When it does NOT
   *  match `result.contractId`, we render a stale-result banner at the
   *  top of the panel offering to run a fresh redraft. */
  currentContractId?:    string
  currentContractTitle?: string
  currentClauseCount?:   number
}>()

const emit = defineEmits<{
  (e: 'close'):            void
  /** Tom clicked "Run new redraft on <current contract>" in the stale-
   *  result banner.  Parent opens the Contract Redraft Settings dialog
   *  scoped to the current contract. */
  (e: 'run-fresh-redraft'): void
}>()

/** True when the panel's `result` is for a DIFFERENT contract than the
 *  one currently selected in the ContractHub sidebar.  Composes with
 *  No-Silent-Data-Loss SUPREME (Tom must never be silently shown a
 *  stale artefact under a fresh-looking window). */
const isStaleForCurrentSelection = computed(() => {
  if (!props.result || !props.currentContractId) return false
  return props.result.contractId !== props.currentContractId
})

type TabId = 'summary' | 'body' | 'corrections' | 'remaining' | 'glossary' | 'related' | 'appendices'

// r41 v459 (Tom Gilb 2026-07-02 verbatim *"scores look too simple"*) —
// click-to-expand drill-down per Contract-Health-Score dimension.
// Composes with DD-009 Zero-Training UI (click reveals depth) + MOVE
// Principle (depth available at-a-glance, not menu-buried) + audience-
// declaration (Vice Admiral sees specific actionable items, not just
// aggregate numbers).  Session-scope only (no persistence) — the panel
// mounts fresh on each Redraft Result view.
const expandedDimensionId = ref<string | null>(null)
function toggleDimension(id: string): void {
  expandedDimensionId.value = expandedDimensionId.value === id ? null : id
}

// "What to fix first" — sort measurable dimensions by their remaining
// score-gap * inverse-of-earned-fraction so the dimension with the
// biggest room-to-improve surfaces first.  Only include dimensions with
// a recommendation.  Cap at 3 to keep the summary panel compact.
const topRecommendations = computed(() => {
  const dims = chi.value?.breakdown ?? []
  return dims
    .filter(d => d.measurable && d.recommendation && d.score < d.maxScore)
    .sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score))
    .slice(0, 3)
})

// r41 v456 (Tom Gilb 2026-07-02 verbatim *"when I came back the display
// reverted back, reported earlier today"*) — activeTab is now persisted
// to localStorage so closing + reopening the panel (or ⌘R) restores the
// last-viewed Report instead of always snapping back to Report 1.
// Composes with No-Silent-Data-Loss SUPREME (Tom's context = viewed Report
// = data he was actively reading; losing it silently on reopen is silent
// loss) + MOVE Principle (fewer clicks to get back to what he was doing).
const ACTIVE_TAB_KEY = 'sem-app:redraft-result:active-tab:v1'
const VALID_TABS: TabId[] = ['summary', 'body', 'corrections', 'remaining', 'glossary', 'related', 'appendices']
function _loadActiveTab(): TabId {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_TAB_KEY) : null
    if (raw && (VALID_TABS as string[]).includes(raw)) return raw as TabId
  } catch { /* ignore — fall through to default */ }
  return 'summary'
}
const activeTab = ref<TabId>(_loadActiveTab())
watch(activeTab, (v) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_TAB_KEY, v)
  } catch { /* ignore — non-blocking */ }
})

const chi = computed(() => props.result?.contractHealthIndex)

const standardLabel = (id: string) => REDRAFT_STANDARDS.find(s => s.id === id)?.shortLabel ?? id
const policyLabel   = (id: string) => REDRAFT_POLICIES.find(p => p.id === id)?.shortLabel   ?? id

function chiBandColour(band: 'green' | 'amber' | 'red'): string {
  if (band === 'green') return 'text-emerald-700 bg-emerald-50 ring-emerald-200'
  if (band === 'amber') return 'text-amber-700 bg-amber-50 ring-amber-200'
  return 'text-red-700 bg-red-50 ring-red-200'
}

function seriousnessLabel(s: number): string {
  return `S${s}` + (s === 1 ? ' · CRITICAL' : s === 2 ? ' · MAJOR' : s === 3 ? ' · MODERATE' : s === 4 ? ' · MINOR' : ' · COSMETIC')
}

function seriousnessColour(s: number): string {
  if (s <= 1) return 'text-red-700 bg-red-50 ring-red-200'
  if (s <= 2) return 'text-orange-700 bg-orange-50 ring-orange-200'
  if (s <= 3) return 'text-amber-700 bg-amber-50 ring-amber-200'
  if (s <= 4) return 'text-slate-700 bg-slate-100 ring-slate-200'
  return 'text-slate-500 bg-slate-50 ring-slate-100'
}

// ── Export: Copy + Email — per-part + whole-group ────────────────────────────
//
// r41 v447 (Tom Gilb 2026-07-02 verbatim *"I hope and expect that every prt
// has export and all of it as a group does too"*).  Every tab of this panel
// (Summary+CHI · Corrections · Remaining Defects · Redrafted Body · Glossary
// · Related Documents · Policies + Audit) gets its OWN Copy + Email pair,
// AND the group-level Copy + Email in the header ships the whole model.
// Composes with:
//   • Export button on all windows rule SUPREME (2026-06-06)
//   • Colorful HTML Spec Email Rule SUPREME (2026-06-04)
//   • r93aaa "One-table-for-cohesion" (2026-06-12) — per-part exports are
//     cohesive info-notes; ONE outer <table>, zero nested tables so the
//     paste hangs together across Keynote / Mail / Notes.
//   • SEM Email Body Standard (loud ⌘V cue + stamp + separator + edit line)
//   • Mailto-No-Self-To SUPREME (Tom is sender → To: empty)
//   • DD-014 Top-and-Bottom Navigation Mirror — long tab bodies also mirror
//     the per-part pins at the bottom so the pins are reachable after scroll.

type PartId = 'summary' | 'corrections' | 'remaining' | 'body' | 'glossary' | 'related' | 'appendices'

/** r41 v450 (Tom Gilb 2026-07-02 verbatim *"please name them above"*) —
 *  every part now carries a stable Report number (1-7 in canonical order
 *  matching the tab bar).  Surfaced in: tab labels, per-part strip label,
 *  per-part HTML + plain-text exports.  Zero-training-UI: the number
 *  disambiguates when Tom refers to "Report 1" or "Report 4" in chat. */
const PART_META: Record<PartId, { report: number; label: string; appendix: string; colour: string }> = {
  summary:     { report: 1, label: 'Executive Summary + Contract Health Score', appendix: 'A4', colour: '#0f766e' },
  corrections: { report: 2, label: 'Corrections Applied',                       appendix: 'A5', colour: '#0f766e' },
  remaining:   { report: 3, label: 'Remaining Defects',                         appendix: 'A6', colour: '#b91c1c' },
  body:        { report: 4, label: 'Redrafted Body',                            appendix: '—',  colour: '#0f766e' },
  glossary:    { report: 5, label: 'Terminology Glossary',                      appendix: 'A1', colour: '#7c3aed' },
  related:     { report: 6, label: 'Related Documents',                         appendix: 'A3', colour: '#4f46e5' },
  appendices:  { report: 7, label: 'Policies + Audit Trail',                    appendix: 'A2', colour: '#0891b2' },
}

/** Helper: canonical part label including the Report number. */
function _partHeadline(id: PartId): string {
  const m = PART_META[id]
  return m.appendix === '—'
    ? `Report ${m.report} · ${m.label}`
    : `Report ${m.report} · Appendix ${m.appendix} · ${m.label}`
}

const copiedFlash  = ref(false)
const emailedFlash = ref(false)
const partCopiedFlash  = ref<Record<PartId, boolean>>({ summary: false, corrections: false, remaining: false, body: false, glossary: false, related: false, appendices: false })
const partEmailedFlash = ref<Record<PartId, boolean>>({ summary: false, corrections: false, remaining: false, body: false, glossary: false, related: false, appendices: false })

const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** r41 v449 (Tom Gilb 2026-07-02 verbatim *"we need 2 stamps: Revised
 *  Contract Generated DDMM tt, Revised Contract Health Analysis
 *  Generated: DD MM tt"*).  Format: "02 Jul 2026 17:10" — human-friendly
 *  day-month-year-time, matches Tom's DDMM shorthand while keeping year
 *  for archival contracts.  Falls back to the raw ISO string when the
 *  input is unparseable so we never silently drop a stamp. */
function _stamp(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const yr  = d.getFullYear()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr} ${hh}:${mm}`
}

// ── Per-section HTML builders (each returns ONE outer <table>) ───────────────

function _chiHtml(): string {
  const r = props.result; if (!r) return ''
  const chi = r.contractHealthIndex
  const chiHeadline = chi.skippedMax > 0
    ? `Appendix A4 · Contract Health Score — ${chi.score} / 100 (${chi.colourBand.toUpperCase()}) — measured over ${chi.availableMax}/100 available points · ${chi.skippedMax} N/A`
    : `Appendix A4 · Contract Health Score — ${chi.score} / 100 (${chi.colourBand.toUpperCase()})`
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead><tr style="background:#0f766e;color:white"><th colspan="3" style="padding:10px;text-align:left;font-size:13px">${esc(chiHeadline)}</th></tr></thead>
  <tbody>
${chi.breakdown.map(d => {
  const scoreCell = d.measurable ? `${d.score} / ${d.maxScore}` : `— / ${d.maxScore} · N/A`
  const rowStyle = d.measurable ? '' : 'background:#f8fafc'
  return `    <tr style="border-top:1px solid #e2e8f0;${rowStyle}"><td style="padding:8px 10px;font-size:11px;font-weight:600">${esc(d.label)}</td><td style="padding:8px 10px;font-size:11px;color:#64748b">${esc(d.detail)}</td><td style="padding:8px 10px;font-size:11px;font-weight:700;text-align:right;color:${d.measurable ? '#0f172a' : '#94a3b8'}">${scoreCell}</td></tr>`
}).join('\n')}
  </tbody>
</table>`
}

function _correctionsHtml(): string {
  const r = props.result; if (!r) return ''
  if (r.corrections.length === 0) return '<p style="color:#64748b;font-size:11px;font-style:italic">No corrections applied.</p>'
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead><tr style="background:#0f766e;color:white"><th colspan="5" style="padding:10px;text-align:left;font-size:13px">Appendix A5 · Corrections Applied (${r.corrections.length})</th></tr>
  <tr style="background:#f0fdfa"><th style="padding:8px;font-size:10px;text-align:left">Clause</th><th style="padding:8px;font-size:10px;text-align:left">Before</th><th style="padding:8px;font-size:10px;text-align:left">After</th><th style="padding:8px;font-size:10px;text-align:left">Reason</th><th style="padding:8px;font-size:10px;text-align:left">Cited</th></tr></thead>
  <tbody>
${r.corrections.map(c => `    <tr style="border-top:1px solid #e2e8f0;vertical-align:top"><td style="padding:8px;font-size:11px;font-weight:600">${esc(c.clauseTag)}</td><td style="padding:8px;font-size:10px;color:#7f1d1d;background:#fef2f2;text-decoration:line-through">${esc(c.before)}</td><td style="padding:8px;font-size:10px;color:#065f46;background:#ecfdf5">${esc(c.after)}</td><td style="padding:8px;font-size:10px;color:#334155">${esc(c.reason)}</td><td style="padding:8px;font-size:10px;color:#475569">${(c.citedStandards ?? []).map(id => esc(standardLabel(id))).join(', ')}${c.citedPolicies?.length ? ' · ' + c.citedPolicies.map(id => esc(policyLabel(id))).join(', ') : ''}</td></tr>`).join('\n')}
  </tbody>
</table>`
}

function _remainingHtml(): string {
  const r = props.result; if (!r) return ''
  if (r.remainingDefects.length === 0) return '<p style="color:#64748b;font-size:11px;font-style:italic">No remaining defects — all identified issues were addressed.</p>'
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead><tr style="background:#b91c1c;color:white"><th colspan="7" style="padding:10px;text-align:left;font-size:13px">Appendix A6 · Remaining Defects (${r.remainingDefects.length})</th></tr>
  <tr style="background:#fef2f2"><th style="padding:8px;font-size:10px;text-align:left">Clause</th><th style="padding:8px;font-size:10px;text-align:left">Sev</th><th style="padding:8px;font-size:10px;text-align:left">Spec</th><th style="padding:8px;font-size:10px;text-align:left">Rule</th><th style="padding:8px;font-size:10px;text-align:left">Role to Fix</th><th style="padding:8px;font-size:10px;text-align:left">Role to Approve</th><th style="padding:8px;font-size:10px;text-align:left">Root Cause</th></tr></thead>
  <tbody>
${r.remainingDefects.map(d => `    <tr style="border-top:1px solid #e2e8f0;vertical-align:top"><td style="padding:8px;font-size:11px;font-weight:600">${esc(d.clauseTag)}</td><td style="padding:8px;font-size:10px;font-weight:700;color:${d.seriousness<=2?'#dc2626':d.seriousness<=3?'#b45309':'#64748b'}">${seriousnessLabel(d.seriousness)}</td><td style="padding:8px;font-size:10px;color:#334155">${esc(d.specStatement)}</td><td style="padding:8px;font-size:10px;color:#7f1d1d">${esc(d.ruleViolated)}</td><td style="padding:8px;font-size:10px;color:#0f766e;font-weight:600">${esc(d.roleToFix)}</td><td style="padding:8px;font-size:10px;color:#7c3aed;font-weight:600">${esc(d.roleToApprove)}</td><td style="padding:8px;font-size:10px;color:#475569">${esc(d.probableRootCause)}</td></tr>`).join('\n')}
  </tbody>
</table>`
}

function _glossaryHtml(): string {
  const r = props.result; if (!r) return ''
  if (r.glossary.length === 0) return '<p style="color:#64748b;font-size:11px;font-style:italic">No glossary entries.</p>'
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead>
    <tr style="background:#7c3aed;color:white"><th colspan="3" style="padding:10px;text-align:left;font-size:13px">Appendix A1 · Terminology Glossary (${r.glossary.length})</th></tr>
    <!-- r41 v461 (Tom Gilb 2026-07-02 clarification: "we need heading for these things") — explicit Term | Definition | Source column headings, per the Term + Definition + Source SUPREME rule (v460). -->
    <tr style="background:#faf5ff;color:#6b21a8;font-weight:700"><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Term</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em">Definition</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em">Source</th></tr>
  </thead>
  <tbody>
${r.glossary.map(g => `    <tr style="border-top:1px solid #e2e8f0;vertical-align:top"><td style="padding:8px;font-size:11px;font-weight:700;color:#7c3aed;white-space:nowrap">${esc(g.term)}</td><td style="padding:8px;font-size:11px;color:#334155">${esc(g.definition)}</td><td style="padding:8px;font-size:10px;color:#64748b;font-style:italic">${esc(g.source)}</td></tr>`).join('\n')}
  </tbody>
</table>`
}

function _relatedHtml(): string {
  const r = props.result; if (!r) return ''
  if (r.relatedDocuments.length === 0) return '<p style="color:#64748b;font-size:11px;font-style:italic">No related documents referenced.</p>'
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead>
    <tr style="background:#4f46e5;color:white"><th colspan="3" style="padding:10px;text-align:left;font-size:13px">Appendix A3 · Related Documents (${r.relatedDocuments.length})</th></tr>
    <!-- r41 v461 — explicit Title | Type | Source column headings per Term + Definition + Source SUPREME (v460). -->
    <tr style="background:#eef2ff;color:#3730a3;font-weight:700"><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Title</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Type</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em">Source</th></tr>
  </thead>
  <tbody>
${r.relatedDocuments.map(d => `    <tr style="border-top:1px solid #e2e8f0;vertical-align:top"><td style="padding:8px;font-size:11px;font-weight:600">${esc(d.title)}</td><td style="padding:8px;font-size:10px;color:#64748b;font-style:italic">${esc(d.documentType)}</td><td style="padding:8px;font-size:10px;color:#4f46e5">${d.externalUrl ? '<a href="' + esc(d.externalUrl) + '" style="color:#4f46e5;text-decoration:underline">' + esc(d.externalUrl) + '</a>' : (d.note ? esc(d.note) : '<span style="color:#94a3b8;font-style:italic">no reachable URL — verify with contract file</span>')}</td></tr>`).join('\n')}
  </tbody>
</table>`
}

function _summaryHtml(): string {
  const r = props.result; if (!r) return ''
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead><tr style="background:#0f766e;color:white"><th style="padding:10px;text-align:left;font-size:13px">Executive Summary</th></tr></thead>
  <tbody>
    <tr><td style="padding:12px;font-size:12px;color:#334155;line-height:1.6">${esc(r.executiveSummary ?? '')}</td></tr>
  </tbody>
</table>`
}

function _bodyHtml(): string {
  const r = props.result; if (!r) return ''
  // r.bodyHtml is already the pre-assembled redrafted body from the
  // orchestrator (per-clause).  Wrap it in a titled outer table so the
  // per-part export is a cohesive info-note.
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead><tr style="background:#0f766e;color:white"><th style="padding:10px;text-align:left;font-size:13px">Redrafted Body</th></tr></thead>
  <tbody>
    <tr><td style="padding:14px;font-size:12px;color:#334155;line-height:1.6">${r.bodyHtml}</td></tr>
  </tbody>
</table>`
}

function _appendicesHtml(): string {
  const r = props.result; if (!r) return ''
  const policyRows = r.policyReferences.length === 0
    ? `    <tr><td colspan="3" style="padding:10px;font-size:11px;color:#64748b;font-style:italic">No policies referenced.</td></tr>`
    : r.policyReferences.map(p => `    <tr style="border-top:1px solid #e2e8f0"><td style="padding:8px 10px;font-size:11px;font-weight:600;color:#334155">${esc(p.policyLabel)}</td><td style="padding:8px 10px;font-size:11px;color:#64748b">v${esc(p.version)}</td><td style="padding:8px 10px;font-size:11px;color:#64748b">effective ${esc(p.effectiveDate)}</td></tr>`).join('\n')
  const auditRows = [
    ['Agent',                r.audit.agent],
    ['Model',                r.audit.modelUsed],
    ['Duration',             `${r.audit.durationSeconds}s`],
    ['Autonomy',             r.audit.autonomyLevel],
    ['Structure',            r.structure],
    ['Safety Locks Engaged', String(r.audit.safetyLocksEngaged.length)],
  ].map(([k, v]) => `    <tr style="border-top:1px solid #e2e8f0"><td style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;width:180px">${esc(k)}</td><td style="padding:8px 10px;font-size:11px;color:#334155">${esc(v)}</td></tr>`).join('\n')
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead>
    <tr style="background:#0891b2;color:white"><th colspan="3" style="padding:10px;text-align:left;font-size:13px">Appendix A2 · Policies Referenced (${r.policyReferences.length})</th></tr>
  </thead>
  <tbody>
${policyRows}
    <tr><td colspan="3" style="padding:0;border-top:1px solid #e2e8f0"></td></tr>
    <tr><td colspan="3" style="padding:10px;background:#164e63;color:white;font-size:13px;font-weight:700">Audit Trail</td></tr>
${auditRows}
  </tbody>
</table>`
}

// ── Per-section plain-text builders ──────────────────────────────────────────

function _chiPlain(): string {
  const r = props.result; if (!r) return ''
  const chi = r.contractHealthIndex
  const head = chi.skippedMax > 0
    ? `CONTRACT HEALTH INDEX: ${chi.score} / 100 (${chi.colourBand.toUpperCase()}) — measured over ${chi.availableMax}/100 available points; ${chi.skippedMax} N/A`
    : `CONTRACT HEALTH INDEX: ${chi.score} / 100 (${chi.colourBand.toUpperCase()})`
  const rows = chi.breakdown.map(d => `  · ${d.label}: ${d.measurable ? `${d.score} / ${d.maxScore}` : `— / ${d.maxScore} · N/A`} — ${d.detail}`)
  return [head, ...rows].join('\n')
}

function _correctionsPlain(): string {
  const r = props.result; if (!r) return ''
  if (r.corrections.length === 0) return 'CORRECTIONS APPLIED: none.'
  const lines: string[] = [`CORRECTIONS APPLIED (${r.corrections.length}):`]
  for (const c of r.corrections) {
    lines.push(`  · [${c.clauseTag}] ${c.reason}`)
    lines.push(`      Before: ${c.before}`)
    lines.push(`      After:  ${c.after}`)
    lines.push(`      Cited:  ${(c.citedStandards ?? []).join(', ')}${c.citedPolicies?.length ? ' · ' + c.citedPolicies.join(', ') : ''}`)
  }
  return lines.join('\n')
}

function _remainingPlain(): string {
  const r = props.result; if (!r) return ''
  if (r.remainingDefects.length === 0) return 'REMAINING DEFECTS: none — all identified issues were addressed.'
  const lines: string[] = [`REMAINING DEFECTS (${r.remainingDefects.length}):`]
  for (const d of r.remainingDefects) {
    lines.push(`  · [${d.clauseTag}] S${d.seriousness}: ${d.ruleViolated}`)
    lines.push(`      Spec:          ${d.specStatement}`)
    lines.push(`      Role to Fix:   ${d.roleToFix}`)
    lines.push(`      Role to OK:    ${d.roleToApprove}`)
    lines.push(`      Root cause:    ${d.probableRootCause}`)
  }
  return lines.join('\n')
}

function _glossaryPlain(): string {
  const r = props.result; if (!r) return ''
  if (r.glossary.length === 0) return 'GLOSSARY: none.'
  const lines: string[] = [`GLOSSARY (${r.glossary.length}):`]
  for (const g of r.glossary) lines.push(`  · ${g.term} — ${g.definition} (${g.source})`)
  return lines.join('\n')
}

function _relatedPlain(): string {
  const r = props.result; if (!r) return ''
  if (r.relatedDocuments.length === 0) return 'RELATED DOCUMENTS: none.'
  const lines: string[] = [`RELATED DOCUMENTS (${r.relatedDocuments.length}):`]
  for (const d of r.relatedDocuments) lines.push(`  · ${d.title} (${d.documentType})${d.externalUrl ? ` — ${d.externalUrl}` : (d.note ? ` — ${d.note}` : ' — no reachable URL — verify with contract file')}`)
  return lines.join('\n')
}

function _summaryPlain(): string {
  const r = props.result; if (!r) return ''
  return `EXECUTIVE SUMMARY:\n${r.executiveSummary ?? ''}`
}

function _bodyPlain(): string {
  const r = props.result; if (!r) return ''
  return `REDRAFTED BODY:\n${r.bodyPlainText}`
}

function _appendicesPlain(): string {
  const r = props.result; if (!r) return ''
  const lines: string[] = []
  lines.push(`POLICIES REFERENCED (${r.policyReferences.length}):`)
  if (r.policyReferences.length === 0) lines.push('  · (none)')
  for (const p of r.policyReferences) lines.push(`  · ${p.policyLabel} · v${p.version} · effective ${p.effectiveDate}`)
  lines.push('')
  lines.push('AUDIT TRAIL:')
  lines.push(`  · Agent:                ${r.audit.agent}`)
  lines.push(`  · Model:                ${r.audit.modelUsed}`)
  lines.push(`  · Duration:             ${r.audit.durationSeconds}s`)
  lines.push(`  · Autonomy:             ${r.audit.autonomyLevel}`)
  lines.push(`  · Structure:            ${r.structure}`)
  lines.push(`  · Safety Locks Engaged: ${r.audit.safetyLocksEngaged.length}`)
  return lines.join('\n')
}

// ── Per-part wrapping: contract-identity header + one outer table ────────────

function _partIdentityHeader(): string {
  const r = props.result; if (!r) return ''
  const bodyStamp = _stamp(r.generatedAt)
  const chiStamp  = _stamp(r.contractHealthIndex?.computedAt ?? r.generatedAt)
  return `<h1 style="color:#0f766e;font-size:20px;margin:0 0 6px 0">${esc(r.contractTitle)} — Contract Redraft</h1>
<p style="color:#334155;font-size:11px;margin:0 0 2px 0"><strong>Revised Contract Generated:</strong> ${esc(bodyStamp)}</p>
<p style="color:#334155;font-size:11px;margin:0 0 2px 0"><strong>Revised Contract Health Analysis Generated:</strong> ${esc(chiStamp)}</p>
<p style="color:#64748b;font-size:11px;margin:0 0 16px 0">${esc(r.audit.modelUsed)} · Autonomy: ${esc(r.audit.autonomyLevel)}</p>`
}

function buildPartHtml(id: PartId): string {
  const r = props.result; if (!r) return ''
  const meta = PART_META[id]
  const inner = id === 'summary'     ? _summaryHtml()     + _chiHtml()
              : id === 'corrections' ? _correctionsHtml()
              : id === 'remaining'   ? _remainingHtml()
              : id === 'body'        ? _bodyHtml()
              : id === 'glossary'    ? _glossaryHtml()
              : id === 'related'     ? _relatedHtml()
              : /* appendices */       _appendicesHtml()
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r.contractTitle)} — Report ${meta.report} · ${esc(meta.label)}</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;color:#0f172a">
${_partIdentityHeader()}
<h2 style="color:${meta.colour};font-size:16px;margin:0 0 12px 0">${esc(_partHeadline(id))}</h2>
${inner}
<p style="margin:20px 0 0 0;font-size:10px;color:#94a3b8">Part export · ${esc(_partHeadline(id))} · SEM App Contract Redraft agent.</p>
</body></html>`
}

function buildPartPlain(id: PartId): string {
  const r = props.result; if (!r) return ''
  const meta = PART_META[id]
  const inner = id === 'summary'     ? _summaryPlain()     + '\n\n' + _chiPlain()
              : id === 'corrections' ? _correctionsPlain()
              : id === 'remaining'   ? _remainingPlain()
              : id === 'body'        ? _bodyPlain()
              : id === 'glossary'    ? _glossaryPlain()
              : id === 'related'     ? _relatedPlain()
              : /* appendices */       _appendicesPlain()
  const lines: string[] = []
  lines.push(`${r.contractTitle} — ${_partHeadline(id)}`)
  lines.push(`Revised Contract Generated:                 ${_stamp(r.generatedAt)}`)
  lines.push(`Revised Contract Health Analysis Generated: ${_stamp(r.contractHealthIndex?.computedAt ?? r.generatedAt)}`)
  lines.push(`Model: ${r.audit.modelUsed} · Autonomy: ${r.audit.autonomyLevel}`)
  lines.push('')
  lines.push(inner)
  return lines.join('\n')
}

// ── Whole-group export (existing behaviour — refactored to reuse builders) ───

function buildResultHtml(): string {
  const r = props.result; if (!r) return ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r.contractTitle)} — Contract Redraft</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;color:#0f172a">
<h1 style="color:#0f766e;font-size:22px;margin:0 0 6px 0">${esc(r.contractTitle)} — Contract Redraft</h1>
<p style="color:#334155;font-size:11px;margin:0 0 2px 0"><strong>Revised Contract Generated:</strong> ${esc(_stamp(r.generatedAt))}</p>
<p style="color:#334155;font-size:11px;margin:0 0 2px 0"><strong>Revised Contract Health Analysis Generated:</strong> ${esc(_stamp(r.contractHealthIndex?.computedAt ?? r.generatedAt))}</p>
<p style="color:#64748b;font-size:11px;margin:0 0 20px 0">${esc(r.audit.modelUsed)} · Autonomy: ${esc(r.audit.autonomyLevel)}</p>
<div style="background:white;padding:14px;border-radius:8px;border-left:4px solid #0f766e;margin-bottom:20px">
  <h2 style="margin:0 0 8px 0;font-size:14px;color:#0f766e">Executive Summary</h2>
  <p style="margin:0;font-size:12px;color:#334155;line-height:1.6">${esc(r.executiveSummary ?? '')}</p>
</div>
${_chiHtml()}
${_correctionsHtml()}
${_remainingHtml()}
${_glossaryHtml()}
${_relatedHtml()}
${_appendicesHtml()}
<h2 style="margin:24px 0 12px 0;font-size:14px;color:#0f766e">Redrafted Body</h2>
${r.bodyHtml}
<p style="margin:24px 0 0 0;font-size:10px;color:#94a3b8">Generated by the SEM App Contract Redraft agent · ${esc(r.audit.durationSeconds.toString())}s · Safety locks engaged: ${r.audit.safetyLocksEngaged.length}</p>
</body></html>`
}

function buildResultPlainText(): string {
  const r = props.result; if (!r) return ''
  const parts: string[] = []
  parts.push(`${r.contractTitle} — Contract Redraft`)
  parts.push(`Revised Contract Generated:                 ${_stamp(r.generatedAt)}`)
  parts.push(`Revised Contract Health Analysis Generated: ${_stamp(r.contractHealthIndex?.computedAt ?? r.generatedAt)}`)
  parts.push(`Model: ${r.audit.modelUsed} · Autonomy: ${r.audit.autonomyLevel} · Duration: ${r.audit.durationSeconds}s`)
  parts.push('')
  parts.push(_summaryPlain())
  parts.push('')
  parts.push(_chiPlain())
  parts.push('')
  parts.push(_correctionsPlain())
  parts.push('')
  parts.push(_remainingPlain())
  parts.push('')
  parts.push(_glossaryPlain())
  parts.push('')
  parts.push(_relatedPlain())
  parts.push('')
  parts.push(_appendicesPlain())
  parts.push('')
  parts.push(_bodyPlain())
  return parts.join('\n')
}

// ── Copy / Email dispatchers ─────────────────────────────────────────────────

async function _copyToClipboard(html: string, plain: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' })
  const blobPlain = new Blob([plain], { type: 'text/plain' })
  if (typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': blobPlain })])
  } else {
    await navigator.clipboard.writeText(plain)
  }
}

async function copyResult(): Promise<void> {
  try {
    await _copyToClipboard(buildResultHtml(), buildResultPlainText())
    copiedFlash.value = true
    setTimeout(() => { copiedFlash.value = false }, 2500)
  } catch (err) {
    console.error('[RedraftResultPanel] Copy failed:', err)
  }
}

async function emailResult(): Promise<void> {
  const r = props.result
  if (!r) return
  const subject = `${r.contractTitle} — Contract Redraft (Contract Health Score ${r.contractHealthIndex.score}/100)`
  try {
    await exportEmail(buildResultHtml(), subject, 'Contract Redraft', '', buildResultPlainText())
    emailedFlash.value = true
    setTimeout(() => { emailedFlash.value = false }, 2500)
  } catch (err) {
    console.error('[RedraftResultPanel] Email failed:', err)
  }
}

async function copyPart(id: PartId): Promise<void> {
  try {
    await _copyToClipboard(buildPartHtml(id), buildPartPlain(id))
    partCopiedFlash.value = { ...partCopiedFlash.value, [id]: true }
    setTimeout(() => { partCopiedFlash.value = { ...partCopiedFlash.value, [id]: false } }, 2500)
  } catch (err) {
    console.error('[RedraftResultPanel] copyPart failed:', id, err)
  }
}

async function emailPart(id: PartId): Promise<void> {
  const r = props.result; if (!r) return
  const meta = PART_META[id]
  const subject = `${r.contractTitle} — Report ${meta.report} · ${meta.label}`
  try {
    // Mailto-No-Self-To SUPREME — Tom is sender; recipient empty.
    await exportEmail(buildPartHtml(id), subject, meta.label, '', buildPartPlain(id))
    partEmailedFlash.value = { ...partEmailedFlash.value, [id]: true }
    setTimeout(() => { partEmailedFlash.value = { ...partEmailedFlash.value, [id]: false } }, 2500)
  } catch (err) {
    console.error('[RedraftResultPanel] emailPart failed:', id, err)
  }
}

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && props.open) emit('close')
}
if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown)

// ── r41 v450 — backdrop-close hardening ──────────────────────────────────────
//
// Tom Gilb 2026-07-02 verbatim *"as I scrolled towards end of report 1 it
// 2x went back to the overview"*.  Diagnosed cause: the pre-v450 backdrop
// was `<div class="fixed inset-0 bg-black/50" @click="emit('close')" />`
// covering the entire viewport BEHIND the white `m-6` content div.  The
// 24px margin strip around the content is BACKDROP — clicks there fire
// close.  Scrollbar-drag momentum, cursor drift toward the right edge,
// or trackpad two-finger click landing in that strip = false close.  Two
// occurrences in one session confirms.
//
// Fix: require the pointer to go DOWN and UP on the SAME backdrop, and
// neither be a drag from inside the content.  If mousedown landed on
// the content and mouseup landed on the backdrop (drag-select case), do
// NOT close.  CloseDot + Escape remain the primary close affordances
// per CloseDot SUPREME.
const backdropArmed = ref(false)
function onBackdropPointerDown(_ev: PointerEvent): void {
  backdropArmed.value = true
}
function onBackdropPointerUp(_ev: PointerEvent): void {
  if (backdropArmed.value) emit('close')
  backdropArmed.value = false
}
function onContentPointerDown(_ev: PointerEvent): void {
  // Any pointerdown that starts inside the white content disarms the
  // backdrop — protects against drag-from-content-to-backdrop closes.
  backdropArmed.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && result"
      class="fixed inset-0 z-[615] flex items-stretch"
      role="dialog"
      aria-modal="true"
      aria-label="Contract Redraft Result"
    >
      <!-- Backdrop — r41 v450 hardening: require pointerdown+pointerup
           BOTH to land on the backdrop (not a drag from inside content).
           Cures the false-close that happened when Tom scrolled and the
           cursor drifted into the 24px margin strip. -->
      <div
        class="fixed inset-0 bg-black/50"
        @pointerdown="onBackdropPointerDown"
        @pointerup="onBackdropPointerUp"
      />
      <div
        class="relative m-6 flex-1 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        @pointerdown="onContentPointerDown"
      >
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-700 via-indigo-600 to-teal-600 text-white">
          <div class="shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-mono font-bold">⟲</div>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold truncate">{{ result.contractTitle }} — Contract Redraft</h2>
            <!-- r41 v449 (Tom Gilb 2026-07-02 verbatim *"we need 2 stamps:
                 Revised Contract Generated DDMM tt, Revised Contract
                 Health Analysis Generated: DD MM tt"*) — two conceptually
                 distinct events: (a) redraft body assembly, (b) CHI
                 computation.  Data model already carries both as separate
                 ISO strings (`result.generatedAt` + `chi.computedAt`);
                 v449 surfaces both with named labels. -->
            <p class="text-[11px] text-white/90 leading-tight"><span class="text-white/60">Revised Contract Generated:</span> {{ _stamp(result.generatedAt) }}</p>
            <p class="text-[11px] text-white/90 leading-tight"><span class="text-white/60">Revised Contract Health Analysis Generated:</span> {{ _stamp(result.contractHealthIndex?.computedAt ?? result.generatedAt) }}</p>
            <p class="text-[11px] text-white/60 leading-tight mt-0.5">{{ result.audit.modelUsed }} · Autonomy: {{ result.audit.autonomyLevel }} · {{ result.audit.durationSeconds }}s</p>
          </div>
          <!-- Contract Health Score badge — r41 v458 (Tom Gilb 2026-07-02
               verbatim caption *"Contract Health Score"* pointing at the
               "CHI 80 / 100" badge).  "CHI" was a developer/methodology
               abbreviation; audience is Navy officer / contracts pro who
               reads "Contract Health Score" at a glance.  Same rule shape
               as v455 JSON + v456 Planguage-jargon sweeps.  Badge grows
               ~110px wider; header uses flex-1 min-w-0 on the title area
               so truncation absorbs the growth. -->
          <div
            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full ring-2 font-bold text-xs"
            :class="chiBandColour(result.contractHealthIndex.colourBand)"
            title="Contract Health Score — an overall 0-100 score covering Precision, Measurement, Stakeholder Coverage, Bounded Scope, Standards Conformance, and Structural Completeness.  See Report 1 for the breakdown."
          >
            <span>Contract Health Score</span>
            <span class="tabular-nums">{{ result.contractHealthIndex.score }} / 100</span>
          </div>
          <!-- r41 v473 — "Try again with different standards" — always-visible
               iterate pin.  Tom Gilb 2026-07-03 verbatim: *"It needs to go
               back to the Contracts main site for possible repeat maybe with
               new standards"*.  Fires the same @run-fresh-redraft event
               that the stale-result CTA already uses — closes this result +
               reopens the Redraft Settings dialog scoped to the current
               contract.  One click to iterate.  Composes with MOVE Principle
               SUPREME (visible-not-hidden), Icon-Plus-Text SUPREME (🔁 +
               plain-English label), Universal Undo SUPREME (this result is
               saved to history first via v459 saveResult; re-running a fresh
               redraft never destroys the prior one). -->
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold ring-1 ring-amber-300/50"
            title="Try again with different standards — closes this result window and opens Contract Redraft Settings scoped to the current contract, so you can pick different standards / policies / safety locks and generate a fresh redraft.  This result stays in your history; nothing is lost."
            @click="emit('run-fresh-redraft')"
          >
            <span aria-hidden="true">🔁</span>
            <span>Try again with different standards</span>
          </button>
          <!-- Actions — r41 v451 (Tom Gilb 2026-07-02 verbatim *"it isnot
               clear to me how to export the entire set of documents"*).
               Renamed from just "Copy" / "Email" to "Copy WHOLE SET" /
               "Email WHOLE SET" so scope is unmistakable at a glance —
               these ship ALL 7 Reports as ONE document; the per-part
               strips inside each tab ship just that tab. -->
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold"
            :title="copiedFlash ? '✓ Copied — the WHOLE SET (all 7 Reports as ONE document) on the clipboard as colourful HTML + plain text.' : 'Copy the WHOLE SET — Executive Summary + Contract Health Score + all 6 Appendices + Redrafted Body as ONE colourful HTML document (all 7 Reports).'"
            @click="copyResult"
          >
            <span aria-hidden="true">[⋮]=[⋮]</span>
            <span>{{ copiedFlash ? 'Whole Set Copied ✓' : 'Copy WHOLE SET' }}</span>
          </button>
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold"
            :title="emailedFlash ? '✓ Mail opening — press ⌘V in the body to paste the colourful WHOLE SET (all 7 Reports).' : 'Email the WHOLE SET — all 7 Reports as ONE document.  Opens Mail with subject + LOUD ⌘V paste cue; colourful HTML on the clipboard for one-keystroke paste.'"
            @click="emailResult"
          >
            <span aria-hidden="true">[⋮]---→[⋮]</span>
            <span>{{ emailedFlash ? 'Whole Set Sent ✓' : 'Email WHOLE SET' }}</span>
          </button>
          <CloseDot
            variant="on-dark"
            size="lg"
            title="Close Contract Redraft Result"
            ariaLabel="Close redraft"
            @click="emit('close')"
          />
        </div>

        <!-- r41 v451 (Tom Gilb 2026-07-02 verbatim *"it isnot clear to me
             how to export the entire set of documents"*) — dedicated
             whole-set export strip.  The header pins do the same job
             but were too easily confused with the identical-looking
             per-part pins inside each tab.  This strip is unmissable:
             (a) indigo-teal gradient matches the header colour so it
             signals "top-level operation"; (b) explicit uppercase label
             "EXPORT THE WHOLE SET — ALL 7 REPORTS AS ONE DOCUMENT" ends
             any ambiguity; (c) sits BETWEEN the header and the tab bar
             so any tab a user opens starts by seeing it.  Composes with:
             MOVE Principle SUPREME (visible at-a-glance) + Export-button-
             on-all-windows rule SUPREME (whole-set surface is the group-
             level export required by the rule) + Icon-Plus-Text SUPREME
             (glyph + explicit UPPERCASE text label) + DD-009 Zero-Training
             UI (label says exactly what it does) + accessibility_tom.md
             (larger + more prominent than per-part pins so it reads from
             farther away for every user).  Does NOT remove the header
             pins (No-Silent-Removal SUPREME); this is ADDITIVE — both
             affordances continue to work. -->
        <div class="shrink-0 mx-4 mt-3 mb-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-100 via-indigo-50 to-teal-50 border border-indigo-200 flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold text-indigo-900 uppercase tracking-wide">Export the WHOLE SET — all 7 Reports as ONE document</p>
            <p class="text-[10px] text-indigo-700 mt-0.5">Ships Executive Summary + Contract Health Score + Appendices A1-A6 + Redrafted Body in one colourful HTML paste.  Use the per-part strips inside each tab to export just one Report.</p>
          </div>
          <div class="shrink-0 flex items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold border border-indigo-700 shadow-sm"
              :title="copiedFlash ? '✓ Copied — the WHOLE SET (all 7 Reports as ONE document) on the clipboard as colourful HTML + plain text.' : 'Copy the WHOLE SET — Executive Summary + Contract Health Score + all 6 Appendices + Redrafted Body as ONE colourful HTML document (all 7 Reports).'"
              @click="copyResult"
            >
              <span aria-hidden="true">[⋮]=[⋮]</span>
              <span>{{ copiedFlash ? 'Whole Set Copied ✓' : 'Copy WHOLE SET' }}</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-bold border border-teal-700 shadow-sm"
              :title="emailedFlash ? '✓ Mail opening — press ⌘V in the body to paste the colourful WHOLE SET (all 7 Reports).' : 'Email the WHOLE SET — all 7 Reports as ONE document.  Opens Mail with subject + LOUD ⌘V paste cue; colourful HTML on the clipboard for one-keystroke paste.'"
              @click="emailResult"
            >
              <span aria-hidden="true">[⋮]---→[⋮]</span>
              <span>{{ emailedFlash ? 'Whole Set Sent ✓' : 'Email WHOLE SET' }}</span>
            </button>
          </div>
        </div>

        <!-- Tab bar -->
        <!-- r41 v450 (Tom Gilb 2026-07-02 verbatim *"please name them
             above"*) — tab labels now carry the Report number so Tom can
             say "Report 4" and both of us know that means Redrafted
             Body.  Composes with Spell-out-Type-Names SUPREME (no
             abbreviations) + DD-009 Zero-Training UI (labels teach the
             number-to-content mapping at-a-glance). -->
        <div class="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-slate-200 bg-slate-50">
          <button
            v-for="tab in [
              { id: 'summary'    as const, label: 'Report 1 · Summary + Health Score' },
              { id: 'corrections' as const, label: `Report 2 · Corrections (${result.corrections.length})` },
              { id: 'remaining'   as const, label: `Report 3 · Remaining Defects (${result.remainingDefects.length})` },
              { id: 'body'        as const, label: 'Report 4 · Redrafted Body' },
              { id: 'glossary'    as const, label: `Report 5 · Glossary (${result.glossary.length})` },
              { id: 'related'     as const, label: `Report 6 · Related Documents (${result.relatedDocuments.length})` },
              { id: 'appendices'  as const, label: 'Report 7 · Policies + Audit' },
            ]"
            :key="tab.id"
            type="button"
            class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            :class="activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>

        <!-- r41 v450 (Tom Gilb 2026-07-02 verbatim *"are giving me the
             Monitor analysis, and I chose Indianapolis, my latest work
             (by far)"*) — stale-result banner.  When the current
             selection in ContractHub is a DIFFERENT contract from the
             one this result belongs to, surface an unmissable indigo
             banner naming both + offering the "Run new redraft" action.
             Composes with No-Silent-Data-Loss SUPREME (Tom is never
             silently shown a stale artefact) + Trust-Rebuild framing
             (explicit context beats mysterious mismatch) + MOVE Principle
             (action right next to the diagnosis). -->
        <div
          v-if="isStaleForCurrentSelection"
          class="shrink-0 mx-4 mt-3 mb-1 px-4 py-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[12px] flex items-start gap-3"
          role="alert"
        >
          <span aria-hidden="true" class="text-lg leading-none mt-0.5">⚠</span>
          <div class="flex-1 leading-snug">
            <p class="font-bold text-[13px] mb-0.5">You are viewing an older redraft — not your current selection.</p>
            <p>
              This window is showing the <strong>{{ result.contractTitle }}</strong> redraft
              (Revised Contract Generated {{ _stamp(result.generatedAt) }}).
              Your currently-selected contract is <strong>{{ currentContractTitle }}</strong><span v-if="currentClauseCount"> ({{ currentClauseCount }} clauses)</span>.
              Redrafts are per-contract — running a new one on your current selection will produce a fresh report.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold self-center"
            title="Close this stale result and open the Contract Redraft Settings dialog to run a fresh redraft on your currently-selected contract."
            @click="emit('run-fresh-redraft')"
          >
            <span>Run new redraft on {{ currentContractTitle }}</span>
          </button>
        </div>

        <!-- Body — raw overflow-y-auto per the ScrollContainer SUPREME
             edge-case fallback (centered-card + Teleport + shrink-0 header
             + shrink-0 tabs + shrink-0 footer).  r41 v439. -->
        <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5">

          <!-- Per-part export pin strip (TOP).  Composes with:
               • Export button on all windows rule SUPREME
               • Icon-Plus-Text SUPREME (glyph + word)
               • MOVE Principle SUPREME (pins visible at-a-glance)
               • Mailto-No-Self-To SUPREME (emailPart passes '' as To:)
               • r41 v447 (Tom "every prt has export"). -->
          <div class="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Export this part — {{ _partHeadline(activeTab) }}
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold border border-slate-200"
                :title="partCopiedFlash[activeTab] ? `✓ Copied — ${PART_META[activeTab].label} on the clipboard as colourful HTML + plain text.` : `Copy just this part (${PART_META[activeTab].label}) as colourful HTML + plain text.`"
                @click="copyPart(activeTab)"
              >
                <span aria-hidden="true">[⋮]=[⋮]</span>
                <span>{{ partCopiedFlash[activeTab] ? 'Copied ✓' : 'Copy' }}</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold border border-slate-200"
                :title="partEmailedFlash[activeTab] ? `✓ Mail opening — press ⌘V to paste the colourful ${PART_META[activeTab].label}.` : `Email just this part (${PART_META[activeTab].label}) — opens Mail with subject + LOUD ⌘V paste cue; you choose the recipient.`"
                @click="emailPart(activeTab)"
              >
                <span aria-hidden="true">[⋮]---→[⋮]</span>
                <span>{{ partEmailedFlash[activeTab] ? 'Sent ✓' : 'Email' }}</span>
              </button>
            </div>
          </div>

          <!-- SUMMARY + CHI -->
          <div v-if="activeTab === 'summary'">
            <div class="bg-teal-50 border-l-4 border-teal-600 rounded-lg p-4 mb-6">
              <h3 class="text-sm font-bold text-teal-800 mb-2">Executive Summary</h3>
              <p class="text-sm text-slate-700 leading-relaxed">{{ result.executiveSummary }}</p>
            </div>
            <h3 class="text-sm font-bold text-slate-800 mb-1">Contract Health Score — {{ chi?.score }} / 100</h3>
            <!-- r41 v439 — surface renormalization: when some dimensions
                 were N/A, the score is measured over fewer than 100 points.
                 Composes with r93mmm Infinity-Trap SUPREME: unmeasurable
                 is never silently promoted to "perfect". -->
            <p v-if="(chi?.skippedMax ?? 0) > 0" class="text-[11px] text-amber-700 mb-3">
              Measured over {{ chi?.availableMax }} / 100 available points · {{ chi?.skippedMax }} points N/A (no entries to measure).
            </p>
            <div v-else class="mb-3"></div>
            <!-- r41 v459 (Tom Gilb 2026-07-02 verbatim *"scores look too
                 simple"*) — click-to-expand drill-down per dimension.
                 Each row is a <button> for keyboard-nav + hover-affordance;
                 clicking reveals the offending entries + recommendation.
                 Composes with MOVE Principle (depth on-demand at-a-glance)
                 + DD-009 Zero-Training UI (chevron + "Click to see..." hint)
                 + Audience-Declaration (a Vice Admiral clicks a bar to see
                 SPECIFIC entries pulling the score down, not just an
                 aggregate number). -->
            <div class="space-y-1">
              <div v-for="dim in chi?.breakdown ?? []" :key="dim.id">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left transition-colors"
                  :class="expandedDimensionId === dim.id ? 'bg-slate-100' : 'hover:bg-slate-50'"
                  :title="expandedDimensionId === dim.id ? 'Click to collapse this dimension.' : 'Click to see the specific entries pulling this dimension down + a plain-English recommendation for what to fix.'"
                  :aria-expanded="expandedDimensionId === dim.id"
                  @click="toggleDimension(dim.id)"
                >
                  <span class="w-4 shrink-0 text-slate-400 text-[10px]" aria-hidden="true">{{ expandedDimensionId === dim.id ? '▼' : '▸' }}</span>
                  <div class="w-40 shrink-0 text-xs font-semibold text-slate-700">{{ dim.label }}</div>
                  <div
                    class="flex-1 relative h-6 rounded overflow-hidden"
                    :class="dim.measurable ? 'bg-slate-100' : 'bg-white border border-dashed border-slate-300'"
                  >
                    <div
                      v-if="dim.measurable"
                      class="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500 to-emerald-500"
                      :style="{ width: dim.maxScore > 0 ? (dim.score / dim.maxScore * 100) + '%' : '0%' }"
                    />
                  </div>
                  <div class="w-20 shrink-0 text-right text-xs font-bold tabular-nums"
                       :class="dim.measurable ? 'text-slate-800' : 'text-slate-400'">
                    <template v-if="dim.measurable">{{ dim.score }} / {{ dim.maxScore }}</template>
                    <template v-else>— / {{ dim.maxScore }}</template>
                  </div>
                  <div class="flex-1 text-[10px] text-slate-500 truncate">
                    {{ dim.detail }}<span v-if="!dim.measurable" class="text-amber-700 font-semibold"> · Not measurable</span>
                  </div>
                </button>

                <!-- Drill-down: recommendation + up to 5 offending entries. -->
                <div
                  v-if="expandedDimensionId === dim.id"
                  class="ml-8 mb-3 mt-1 px-4 py-3 rounded-lg bg-white border border-slate-200 shadow-sm"
                >
                  <div v-if="dim.recommendation" class="mb-3 pb-3 border-b border-slate-100">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-1">What to fix</p>
                    <p class="text-[12px] text-slate-800 leading-relaxed">{{ dim.recommendation }}</p>
                  </div>
                  <div v-if="dim.offendingEntries && dim.offendingEntries.length > 0">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                      Specific entries pulling this dimension down (top {{ dim.offendingEntries.length }}{{ (dim.offendingEntryIds?.length ?? 0) > dim.offendingEntries.length ? ` of ${dim.offendingEntryIds?.length ?? '?'}` : '' }})
                    </p>
                    <ul class="space-y-1.5">
                      <li v-for="off in dim.offendingEntries" :key="off.id" class="flex items-start gap-2 text-[11px]">
                        <span class="shrink-0 inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold whitespace-nowrap">{{ off.tag }}</span>
                        <span v-if="off.party" class="shrink-0 inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold text-[10px] whitespace-nowrap">{{ off.party }}</span>
                        <div class="flex-1 min-w-0">
                          <p class="text-slate-700 leading-snug">{{ off.description }}<span v-if="off.description.length >= 120">…</span></p>
                          <p v-if="off.reason" class="text-[10px] text-amber-700 mt-0.5 font-semibold">↳ {{ off.reason }}</p>
                        </div>
                      </li>
                    </ul>
                    <p v-if="dim.id === 'standards-conformance' || dim.id === 'measurement' || dim.id === 'precision' || dim.id === 'bounded-scope'"
                       class="mt-2 text-[10px] text-slate-500 italic">
                      See <button type="button" class="underline text-indigo-700 font-semibold" @click.stop="activeTab = 'remaining'">Report 3 · Remaining Defects</button> for the full list with roles-to-fix + roles-to-approve.
                    </p>
                  </div>
                  <div v-else-if="!dim.recommendation && dim.measurable && dim.score === dim.maxScore" class="text-[11px] text-emerald-700 font-semibold">
                    ✓ Perfect score on this dimension — no entries pulling it down.
                  </div>
                </div>
              </div>
            </div>

            <!-- "What to fix first" — top 3 dimensions ranked by remaining
                 score-gap.  Composes with MOVE (summary of action items
                 at the bottom, matching the top-3-recommendation pattern
                 common in analytical dashboards) + audience-declaration
                 (specific fix-first ordering for a Contracts professional). -->
            <div v-if="topRecommendations.length > 0" class="mt-6 pt-4 border-t border-slate-200">
              <h4 class="text-xs font-bold text-slate-800 mb-2">What to fix first — top {{ topRecommendations.length }} highest-impact {{ topRecommendations.length === 1 ? 'action' : 'actions' }}</h4>
              <ol class="space-y-2 text-[11px]">
                <li v-for="(rec, i) in topRecommendations" :key="rec.id" class="flex items-start gap-2">
                  <span class="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">{{ i + 1 }}</span>
                  <div class="flex-1">
                    <p class="font-bold text-slate-800">{{ rec.label }} <span class="text-slate-500 font-normal">— {{ rec.score }} / {{ rec.maxScore }} · gap {{ rec.maxScore - rec.score }} points</span></p>
                    <p class="text-slate-700 mt-0.5 leading-relaxed">{{ rec.recommendation }}</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <!-- CORRECTIONS -->
          <div v-else-if="activeTab === 'corrections'">
            <p v-if="result.corrections.length === 0" class="text-sm text-slate-500 italic">No corrections applied — either the contract was already precision-compliant, or the redraft ran in Advisory mode.</p>
            <table v-else class="w-full text-xs border-collapse">
              <thead>
                <tr class="bg-teal-100 text-teal-900">
                  <th class="text-left px-3 py-2 font-semibold">Clause</th>
                  <th class="text-left px-3 py-2 font-semibold">Before</th>
                  <th class="text-left px-3 py-2 font-semibold">After</th>
                  <th class="text-left px-3 py-2 font-semibold">Reason</th>
                  <th class="text-left px-3 py-2 font-semibold">Cited</th>
                  <th class="text-left px-3 py-2 font-semibold">Conf</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in result.corrections" :key="c.id" class="border-t border-slate-200 align-top">
                  <td class="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{{ c.clauseTag }}</td>
                  <td class="px-3 py-2 text-red-800 bg-red-50 line-through">{{ c.before }}</td>
                  <td class="px-3 py-2 text-emerald-800 bg-emerald-50">{{ c.after }}</td>
                  <td class="px-3 py-2 text-slate-700">{{ c.reason }}</td>
                  <td class="px-3 py-2 text-slate-600">
                    <div class="flex flex-wrap gap-1">
                      <span v-for="s in c.citedStandards" :key="s" class="inline-block px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-semibold">{{ standardLabel(s) }}</span>
                      <span v-for="p in c.citedPolicies" :key="p" class="inline-block px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-semibold">{{ policyLabel(p) }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                      :class="c.confidence === 'high' ? 'bg-emerald-100 text-emerald-800' : c.confidence === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'">{{ c.confidence }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- REMAINING DEFECTS -->
          <div v-else-if="activeTab === 'remaining'">
            <p v-if="result.remainingDefects.length === 0" class="text-sm text-emerald-700 font-semibold">✓ No remaining defects — all identified issues addressed by the redraft.</p>
            <table v-else class="w-full text-xs border-collapse">
              <thead>
                <tr class="bg-red-100 text-red-900">
                  <th class="text-left px-3 py-2 font-semibold">Clause</th>
                  <th class="text-left px-3 py-2 font-semibold">Sev</th>
                  <th class="text-left px-3 py-2 font-semibold">Spec Statement</th>
                  <th class="text-left px-3 py-2 font-semibold">Rule Violated</th>
                  <th class="text-left px-3 py-2 font-semibold">Role to Fix</th>
                  <th class="text-left px-3 py-2 font-semibold">Role to Approve</th>
                  <th class="text-left px-3 py-2 font-semibold">Root Cause</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in result.remainingDefects" :key="d.id" class="border-t border-slate-200 align-top">
                  <td class="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{{ d.clauseTag }}</td>
                  <td class="px-3 py-2">
                    <span class="inline-block px-1.5 py-0.5 rounded ring-1 text-[10px] font-bold whitespace-nowrap" :class="seriousnessColour(d.seriousness)">{{ seriousnessLabel(d.seriousness) }}</span>
                  </td>
                  <td class="px-3 py-2 text-slate-700">{{ d.specStatement }}</td>
                  <td class="px-3 py-2 text-red-800">{{ d.ruleViolated }}</td>
                  <td class="px-3 py-2 text-teal-800 font-semibold">{{ d.roleToFix }}</td>
                  <td class="px-3 py-2 text-violet-800 font-semibold">{{ d.roleToApprove }}</td>
                  <td class="px-3 py-2 text-slate-600 italic">{{ d.probableRootCause }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- REDRAFTED BODY -->
          <div v-else-if="activeTab === 'body'">
            <div v-html="result.bodyHtml" />
          </div>

          <!-- GLOSSARY -->
          <div v-else-if="activeTab === 'glossary'">
            <p v-if="result.glossary.length === 0" class="text-sm text-slate-500 italic">No glossary entries.</p>
            <table v-else class="w-full text-xs border-collapse">
              <thead>
                <tr class="bg-violet-100 text-violet-900">
                  <th class="text-left px-3 py-2 font-semibold">Term</th>
                  <th class="text-left px-3 py-2 font-semibold">Definition</th>
                  <th class="text-left px-3 py-2 font-semibold">Source</th>
                  <th class="text-left px-3 py-2 font-semibold">Cited In</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in result.glossary" :key="g.term" class="border-t border-slate-200 align-top">
                  <td class="px-3 py-2 font-bold text-violet-800 whitespace-nowrap">{{ g.term }}</td>
                  <td class="px-3 py-2 text-slate-700">{{ g.definition }}</td>
                  <td class="px-3 py-2 text-slate-500 italic">{{ g.source }}</td>
                  <td class="px-3 py-2 text-slate-600">{{ g.citedIn.join(', ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- RELATED DOCUMENTS -->
          <div v-else-if="activeTab === 'related'">
            <p v-if="result.relatedDocuments.length === 0" class="text-sm text-slate-500 italic">No related documents referenced.</p>
            <table v-else class="w-full text-xs border-collapse">
              <thead>
                <tr class="bg-indigo-100 text-indigo-900">
                  <th class="text-left px-3 py-2 font-semibold">Title</th>
                  <th class="text-left px-3 py-2 font-semibold">Type</th>
                  <th class="text-left px-3 py-2 font-semibold">Referenced In</th>
                  <th class="text-left px-3 py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in result.relatedDocuments" :key="d.title" class="border-t border-slate-200 align-top">
                  <td class="px-3 py-2 font-semibold text-slate-800">{{ d.title }}</td>
                  <td class="px-3 py-2">
                    <!-- r41 v460 — no more "⟲ Graphmetrix" branding since
                         Graphmetrix is not yet deployed; falls through to
                         plain documentType label. -->
                    <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {{ d.documentType }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-slate-600">{{ d.referencedIn.join(', ') }}</td>
                  <td class="px-3 py-2">
                    <!-- r41 v460 (Term + Definition + Source SUPREME) —
                         only render Sources that are Reachable-Now.
                         graphmetrix:// URIs suppressed until GMX is proved
                         reachable end-to-end. -->
                    <a v-if="d.externalUrl" :href="d.externalUrl" target="_blank" class="text-indigo-600 underline text-[11px]">{{ d.externalUrl }}</a>
                    <span v-else-if="d.note" class="text-[11px] text-slate-600">{{ d.note }}</span>
                    <span v-else class="text-[11px] text-slate-400 italic">no reachable URL — verify with contract file</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- APPENDICES / AUDIT -->
          <div v-else-if="activeTab === 'appendices'">
            <h3 class="text-sm font-bold text-slate-800 mb-3">Appendix A2 · Policies Referenced</h3>
            <ul class="space-y-1 mb-6">
              <li v-for="p in result.policyReferences" :key="p.policyId" class="text-xs text-slate-700">
                <span class="font-semibold">{{ p.policyLabel }}</span>
                <span class="text-slate-500 ml-2">v{{ p.version }} · effective {{ p.effectiveDate }}</span>
              </li>
            </ul>
            <h3 class="text-sm font-bold text-slate-800 mb-3">Audit Trail</h3>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <dt class="text-slate-500 font-semibold">Agent</dt><dd class="text-slate-800">{{ result.audit.agent }}</dd>
              <dt class="text-slate-500 font-semibold">Model</dt><dd class="text-slate-800">{{ result.audit.modelUsed }}</dd>
              <dt class="text-slate-500 font-semibold">Duration</dt><dd class="text-slate-800">{{ result.audit.durationSeconds }}s</dd>
              <dt class="text-slate-500 font-semibold">Autonomy</dt><dd class="text-slate-800">{{ result.audit.autonomyLevel }}</dd>
              <dt class="text-slate-500 font-semibold">Structure</dt><dd class="text-slate-800">{{ result.structure }}</dd>
              <dt class="text-slate-500 font-semibold">Safety Locks Engaged</dt><dd class="text-slate-800">{{ result.audit.safetyLocksEngaged.length }}</dd>
            </dl>
          </div>

          <!-- Per-part export pin strip (BOTTOM MIRROR — DD-014).  After a
               long tab body (Corrections × 67, Remaining × 55, Body ×
               entire redraft), the user is at the bottom — mirror the
               pins here so they don't have to scroll back up. -->
          <div class="flex items-center justify-between gap-3 mt-8 pt-4 border-t border-slate-200">
            <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Export this part — {{ _partHeadline(activeTab) }}
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold border border-slate-200"
                :title="partCopiedFlash[activeTab] ? `✓ Copied — ${PART_META[activeTab].label} on the clipboard as colourful HTML + plain text.` : `Copy just this part (${PART_META[activeTab].label}) as colourful HTML + plain text.`"
                @click="copyPart(activeTab)"
              >
                <span aria-hidden="true">[⋮]=[⋮]</span>
                <span>{{ partCopiedFlash[activeTab] ? 'Copied ✓' : 'Copy' }}</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold border border-slate-200"
                :title="partEmailedFlash[activeTab] ? `✓ Mail opening — press ⌘V to paste the colourful ${PART_META[activeTab].label}.` : `Email just this part (${PART_META[activeTab].label}) — opens Mail with subject + LOUD ⌘V paste cue; you choose the recipient.`"
                @click="emailPart(activeTab)"
              >
                <span aria-hidden="true">[⋮]---→[⋮]</span>
                <span>{{ partEmailedFlash[activeTab] ? 'Sent ✓' : 'Email' }}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>
