<!-- UNIT_TYPE=Widget -->
<!-- MariaAgentBoard.vue — Board Work Parse agent panel.
     Full-screen panel for the Maria agent. Accepts a pasted board document,
     runs the AI analysis, presents the four-section MariaResult, collects a
     Todd usefulness rating (−100 to +100), and emails the report.

     UI Rules applied:
       - CloseDot at END of header — Universal Close-Button Rule
       - ScrollContainer for all scrollable regions — Universal Scroll Rule
       - z-[493] backdrop / z-[497] card — Major surfaces tier (380–600)
         so SelectionDefiner at z-[10100] stays above this panel
       - All buttons have title= — DD-009 / Interaction Disclosure Rule (Rule 7)
       - No select-none on body content — Define-by-Selection Rule
       - Email via openEml() — Tom Gilb 2026-05-29: "I do not want to paste
         into the email. I want it ready pasted." (useEmlExport.ts pattern)

     Tom Gilb, 2026-05-29:
       "Input: Board documents (Todd uploads). Process: Parse decisions /
        Classify by governance layer / Flag authority clarity gaps / Surface
        decision gaps / Identify governance patterns. Output: Decision inventory
        (tagged by layer) / Authority clarity report / Governance gap list /
        Pattern analysis. Tone: Opportunities for board action, not problems.
        Success metric: Todd rates usefulness −100 to +100. Deliverable: Email
        to Todd + board Friday EOD."
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
import { useMaria } from '../composables/useMaria'
import { openEml } from '../composables/useEmlExport'
import type { MariaResult, MariaDecision, MariaAuthorityEntry, MariaGap, MariaPattern } from '../types/maria'

const emit = defineEmits<{
  close: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const { loading, error, result, analyse, reset } = useMaria()

/** The raw board document text pasted by the user. */
const documentText = ref('')

/** Which result sections are expanded. All open by default. */
const sectionOpen = ref({
  decisions: true,
  authority: true,
  gaps: true,
  patterns: true,
})

/** Todd's usefulness rating: −100 to +100. null = not yet rated. */
const rating = ref<number | null>(null)
const ratingInteracted = ref(false)

/** "To:" addresses for the email report (editable by user). */
const emailTo = ref('')

/** Controls the "report sent" flash state. */
const reportSent = ref(false)
let _sentTimer: ReturnType<typeof setTimeout> | null = null

// ─── Computed helpers ─────────────────────────────────────────────────────────

const hasDocument = computed(() => documentText.value.trim().length > 0)
const hasResult = computed(() => result.value !== null)

const ratingLabel = computed(() => {
  if (rating.value === null) return 'Not yet rated'
  if (rating.value >= 80)  return '🌟 Highly useful'
  if (rating.value >= 50)  return '✅ Very useful'
  if (rating.value >= 20)  return '👍 Useful'
  if (rating.value >= 0)   return '➡️ Neutral'
  if (rating.value >= -30) return '🤔 Marginally useful'
  if (rating.value >= -60) return '⚠️ Questionable value'
  return '❌ Not useful'
})

const ratingColor = computed(() => {
  if (rating.value === null) return 'text-slate-400'
  if (rating.value >= 50)  return 'text-emerald-600'
  if (rating.value >= 0)   return 'text-slate-600'
  if (rating.value >= -50) return 'text-amber-600'
  return 'text-red-600'
})

const layerColor: Record<string, string> = {
  board:      'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  management: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
  operations: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  moderate: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  advisory: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function runAnalysis(): Promise<void> {
  if (!hasDocument.value || loading.value) return
  await analyse(documentText.value)
}

function startOver(): void {
  documentText.value = ''
  rating.value = null
  ratingInteracted.value = false
  emailTo.value = ''
  reportSent.value = false
  if (_sentTimer) { clearTimeout(_sentTimer); _sentTimer = null }
  reset()
}

function onRatingInput(e: Event): void {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  rating.value = val
  ratingInteracted.value = true
}

// ─── Email export ─────────────────────────────────────────────────────────────

/**
 * Build an HTML email report from the MariaResult.
 * Follows the Colorful Exports Rule: inline-styled HTML table, never plain text.
 */
function buildMariaEmailHtml(r: MariaResult): string {
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const layerBadge = (layer: string) => {
    const colors: Record<string, string> = {
      board:      'background:#dcfce7;color:#166534;border:1px solid #bbf7d0',
      management: 'background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe',
      operations: 'background:#e0f2fe;color:#075985;border:1px solid #bae6fd',
    }
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;${colors[layer] ?? ''}">${layer.toUpperCase()}</span>`
  }

  const severityBadge = (sev: string) => {
    const colors: Record<string, string> = {
      critical: 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
      moderate: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
      advisory: 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0',
    }
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;${colors[sev] ?? ''}">${sev.toUpperCase()}</span>`
  }

  const ratingNote = (ratingInteracted.value && rating.value !== null)
    ? `<p style="margin:4px 0 0 0;font-size:12px;color:#475569;">Todd usefulness rating: <strong>${rating.value}/100</strong> — ${ratingLabel.value}</p>`
    : ''

  const sections: string[] = []

  // ── Section 1: Decision Inventory ──
  sections.push(`
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#064e3b;border-left:4px solid #059669;padding-left:10px;">
      🗂 Decision Inventory
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.decisionInventory.length} decisions extracted from the board document.</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f0fdf4;">
          <th style="padding:6px 10px;text-align:left;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;width:36px;">ID</th>
          <th style="padding:6px 10px;text-align:left;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;">Decision</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;width:90px;">Layer</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;width:60px;">Authority Gap</th>
        </tr>
      </thead>
      <tbody>
        ${r.decisionInventory.map((d: MariaDecision, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding:8px 10px;color:#6b7280;font-weight:700;">${esc(d.id)}</td>
          <td style="padding:8px 10px;color:#1e293b;">
            ${esc(d.text)}
            ${d.authorityGapFlagged && d.authorityGapNote ? `<br/><span style="font-size:11px;color:#b45309;font-style:italic;">⚠ ${esc(d.authorityGapNote)}</span>` : ''}
          </td>
          <td style="padding:8px 10px;text-align:center;">${layerBadge(d.layer)}</td>
          <td style="padding:8px 10px;text-align:center;">${d.authorityGapFlagged ? '<span style="color:#dc2626;font-size:14px;">⚑</span>' : '<span style="color:#a3e635;">✓</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `)

  // ── Section 2: Authority Report ──
  if (r.authorityReport.length > 0) {
    sections.push(`
      <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#1e1b4b;border-left:4px solid #6366f1;padding-left:10px;">
        ⚑ Authority Clarity Report
      </h2>
      <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.authorityReport.length} authority clarity gap${r.authorityReport.length !== 1 ? 's' : ''} identified.</p>
      ${r.authorityReport.map((a: MariaAuthorityEntry) => `
      <div style="margin-bottom:12px;border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;">
        <div style="background:#e0e7ff;padding:8px 12px;display:flex;gap:8px;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:#3730a3;">Decisions: ${esc(a.decisionIds.join(', '))}</span>
          <span style="margin-left:auto;">${severityBadge(a.severity)}</span>
        </div>
        <div style="padding:10px 12px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#1e293b;"><strong>Observation:</strong> ${esc(a.issue)}</p>
          <p style="margin:0;font-size:12px;color:#065f46;"><strong>Opportunity:</strong> ${esc(a.opportunity)}</p>
        </div>
      </div>`).join('')}
    `)
  } else {
    sections.push(`
      <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#1e1b4b;border-left:4px solid #6366f1;padding-left:10px;">
        ⚑ Authority Clarity Report
      </h2>
      <p style="margin:0 0 12px 0;font-size:12px;color:#059669;">✓ No authority clarity gaps were identified in this document.</p>
    `)
  }

  // ── Section 3: Governance Gaps ──
  if (r.governanceGaps.length > 0) {
    sections.push(`
      <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#92400e;border-left:4px solid #f59e0b;padding-left:10px;">
        📋 Governance Gaps
      </h2>
      <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.governanceGaps.length} topic${r.governanceGaps.length !== 1 ? 's' : ''} that should have a board decision but do not.</p>
      ${r.governanceGaps.map((g: MariaGap) => `
      <div style="margin-bottom:12px;border:1px solid #fde68a;border-radius:8px;overflow:hidden;">
        <div style="background:#fef3c7;padding:8px 12px;display:flex;gap:8px;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:#92400e;">${esc(g.id)} · ${esc(g.category)}</span>
        </div>
        <div style="padding:10px 12px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#1e293b;"><strong>Significance:</strong> ${esc(g.significance)}</p>
          <p style="margin:0;font-size:12px;color:#065f46;"><strong>Opportunity:</strong> ${esc(g.opportunity)}</p>
        </div>
      </div>`).join('')}
    `)
  } else {
    sections.push(`
      <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#92400e;border-left:4px solid #f59e0b;padding-left:10px;">
        📋 Governance Gaps
      </h2>
      <p style="margin:0 0 12px 0;font-size:12px;color:#059669;">✓ No governance gaps were identified in this document.</p>
    `)
  }

  // ── Section 4: Pattern Analysis ──
  sections.push(`
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;">
      🔮 Governance Pattern Analysis
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.patternAnalysis.length} pattern${r.patternAnalysis.length !== 1 ? 's' : ''} identified across the document.</p>
    ${r.patternAnalysis.map((p: MariaPattern) => {
      const isStrength = p.type === 'strength'
      return `
      <div style="margin-bottom:12px;border:1px solid ${isStrength ? '#a7f3d0' : '#fecaca'};border-radius:8px;overflow:hidden;">
        <div style="background:${isStrength ? '#f0fdf4' : '#fff1f2'};padding:8px 12px;display:flex;gap:8px;align-items:center;">
          <span style="font-size:14px;">${isStrength ? '✅' : '⚠️'}</span>
          <span style="font-size:12px;font-weight:700;color:${isStrength ? '#065f46' : '#9f1239'};">${esc(p.id)} · ${esc(p.label)}</span>
          <span style="margin-left:auto;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;${isStrength ? 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;' : 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;'}">${p.type.toUpperCase()}</span>
        </div>
        <div style="padding:10px 12px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#1e293b;"><strong>Pattern:</strong> ${esc(p.description)}</p>
          <p style="margin:0;font-size:12px;color:#065f46;"><strong>Opportunity:</strong> ${esc(p.opportunity)}</p>
          ${p.evidenceDecisionIds.length ? `<p style="margin:6px 0 0 0;font-size:10px;color:#6b7280;">Evidence: decisions ${p.evidenceDecisionIds.map(esc).join(', ')}</p>` : ''}
        </div>
      </div>`
    }).join('')}
  `)

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#0f172a;max-width:760px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#064e3b,#065f46);border-radius:12px;padding:20px;margin-bottom:24px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;font-weight:800;color:white;">🏛 Maria — Board Work Parse</h1>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">Board Document Analysis · ${esc(date)}</p>
    ${ratingNote}
  </div>

  <p style="margin:0 0 4px 0;font-size:12px;color:#475569;">
    <strong>Document size:</strong> ~${r.sourceWordCount} words ·
    <strong>Decisions extracted:</strong> ${r.decisionInventory.length} ·
    <strong>Authority gaps:</strong> ${r.authorityReport.length} ·
    <strong>Governance gaps:</strong> ${r.governanceGaps.length} ·
    <strong>Patterns identified:</strong> ${r.patternAnalysis.length}
  </p>

  ${sections.join('')}

  <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
      Generated by Maria Agent (SEM App) · ${new Date().toISOString().slice(0, 10)} ·
      Tone: opportunities for board action, not problems ·
      Three-layer governance model: Board · Management · Operations
    </p>
  </div>
</div>`
}

function sendEmailReport(): void {
  if (!result.value) return
  const html = buildMariaEmailHtml(result.value)
  const to = emailTo.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  openEml(html, '🏛 Maria — Board Governance Analysis', { to })
  reportSent.value = true
  if (_sentTimer) clearTimeout(_sentTimer)
  _sentTimer = setTimeout(() => { reportSent.value = false }, 4000)
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[493] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[497] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Maria Agent — Board Work Parse"
    >
      <div
        class="pointer-events-auto w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-800 to-emerald-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🏛</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">Maria — Board Work Parse</h2>
            <p class="text-[11px] text-white/60 leading-tight mt-0.5">
              Decision inventory · Authority clarity · Governance gaps · Pattern analysis
            </p>
          </div>
          <!-- Start over button — only when result is present -->
          <button
            v-if="hasResult"
            type="button"
            class="shrink-0 text-[11px] font-semibold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all"
            title="Start over — clear the current analysis and paste a new board document"
            @click="startOver"
          >
            Start over
          </button>
          <CloseDot
            variant="on-dark"
            aria-label="Close Maria Agent Board"
            title="Close Maria Agent — return to the Agent Menu or main workspace"
            @click="emit('close')"
          />
        </div>

        <!-- Body -->
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="p-5"
        >

          <!-- ─── Input phase ─────────────────────────────────────────────── -->
          <div v-if="!hasResult">

            <!-- Intro blurb -->
            <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
              <h3 class="text-sm font-semibold text-emerald-900 mb-1">What Maria does</h3>
              <p class="text-xs text-emerald-800 leading-relaxed">
                Maria analyses board documents — minutes, resolutions, strategy papers, committee reports —
                and produces a structured governance intelligence report with four sections:
                Decision Inventory, Authority Clarity Report, Governance Gap List, and Pattern Analysis.
                All findings are framed as opportunities for board action, never as problems.
              </p>
            </div>

            <!-- Document input -->
            <div class="mb-4">
              <label class="block text-sm font-semibold text-slate-700 mb-2" for="maria-document-input">
                Paste the board document
              </label>
              <p class="text-xs text-slate-500 mb-3 leading-relaxed">
                Paste any board-level text: minutes, a resolution, a strategy paper, or a committee report.
                Maria reads the full document and extracts every decision, classifies each by governance layer,
                and surfaces authority and governance gaps.
              </p>
              <textarea
                id="maria-document-input"
                v-model="documentText"
                rows="12"
                class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                placeholder="Paste board minutes, resolution, strategy paper, or committee report here…"
                :disabled="loading"
              />
              <p class="text-xs text-slate-400 mt-1.5 text-right">
                {{ documentText.trim().split(/\s+/).filter(Boolean).length }} words
              </p>
            </div>

            <!-- Error message -->
            <div
              v-if="error"
              class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-800 leading-relaxed"
              role="alert"
            >
              <span class="font-semibold">Error:</span> {{ error }}
            </div>

            <!-- Analyse button -->
            <button
              type="button"
              :disabled="!hasDocument || loading"
              class="w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              :class="hasDocument && !loading
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
              title="Analyse board document — Maria will extract all decisions, classify them by governance layer, identify authority gaps, flag governance gaps, and analyse patterns. Takes 10–30 seconds."
              @click="runAnalysis"
            >
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Maria is analysing the document…
              </span>
              <span v-else>
                {{ hasDocument ? '🏛 Analyse Board Document →' : 'Paste a board document above to begin' }}
              </span>
            </button>

          </div>

          <!-- ─── Result phase ────────────────────────────────────────────── -->
          <div v-else-if="result">

            <!-- Summary bar -->
            <div class="grid grid-cols-4 gap-3 mb-5">
              <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                <div class="text-2xl font-black text-emerald-700">{{ result.decisionInventory.length }}</div>
                <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">Decisions</div>
              </div>
              <div class="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-center">
                <div class="text-2xl font-black text-indigo-700">{{ result.authorityReport.length }}</div>
                <div class="text-[10px] text-indigo-600 font-semibold mt-0.5">Authority Gaps</div>
              </div>
              <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                <div class="text-2xl font-black text-amber-700">{{ result.governanceGaps.length }}</div>
                <div class="text-[10px] text-amber-600 font-semibold mt-0.5">Gov. Gaps</div>
              </div>
              <div class="rounded-xl bg-violet-50 border border-violet-200 p-3 text-center">
                <div class="text-2xl font-black text-violet-700">{{ result.patternAnalysis.length }}</div>
                <div class="text-[10px] text-violet-600 font-semibold mt-0.5">Patterns</div>
              </div>
            </div>

            <!-- ── Section 1: Decision Inventory ── -->
            <div class="rounded-xl border border-emerald-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
                title="Decision Inventory — expand or collapse the list of all decisions extracted from the board document, each classified by governance layer (Board / Management / Operations)"
                @click="sectionOpen.decisions = !sectionOpen.decisions"
              >
                <span class="text-sm font-bold text-emerald-800 flex-1">🗂 Decision Inventory</span>
                <span class="text-xs text-emerald-600 font-semibold">{{ result.decisionInventory.length }} decisions</span>
                <span class="text-emerald-500 text-xs ml-1">{{ sectionOpen.decisions ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.decisions" class="divide-y divide-emerald-100">
                <div
                  v-for="d in result.decisionInventory"
                  :key="d.id"
                  class="px-4 py-3 bg-white hover:bg-emerald-50/30 transition-colors"
                >
                  <div class="flex items-start gap-2 mb-1.5">
                    <span class="text-xs font-black text-slate-400 shrink-0 mt-0.5 w-6">{{ d.id }}</span>
                    <p class="text-xs text-slate-800 leading-relaxed flex-1">{{ d.text }}</p>
                    <span
                      class="shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="layerColor[d.layer] ?? 'bg-slate-100 text-slate-600'"
                    >{{ d.layer }}</span>
                  </div>
                  <div v-if="d.authorityGapFlagged" class="ml-8 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-1.5">
                    <p class="text-[10px] text-amber-800 leading-relaxed">
                      <span class="font-bold">⚑ Authority gap:</span> {{ d.authorityGapNote }}
                    </p>
                  </div>
                  <p class="ml-8 text-[10px] text-slate-400 leading-relaxed mt-1">{{ d.layerRationale }}</p>
                </div>
              </div>
            </div>

            <!-- ── Section 2: Authority Report ── -->
            <div class="rounded-xl border border-indigo-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
                title="Authority Clarity Report — expand or collapse the list of authority clarity gaps found in the board document, with severity rating and opportunity for board action"
                @click="sectionOpen.authority = !sectionOpen.authority"
              >
                <span class="text-sm font-bold text-indigo-800 flex-1">⚑ Authority Clarity Report</span>
                <span class="text-xs font-semibold" :class="result.authorityReport.length > 0 ? 'text-indigo-600' : 'text-emerald-600'">
                  {{ result.authorityReport.length > 0 ? `${result.authorityReport.length} gap${result.authorityReport.length !== 1 ? 's' : ''}` : '✓ None found' }}
                </span>
                <span class="text-indigo-400 text-xs ml-1">{{ sectionOpen.authority ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.authority">
                <div v-if="result.authorityReport.length === 0" class="px-4 py-3 text-xs text-emerald-700 bg-white">
                  No authority clarity gaps were identified in this document. ✓
                </div>
                <div
                  v-for="a in result.authorityReport"
                  :key="a.decisionIds.join('-')"
                  class="px-4 py-3 bg-white border-t border-indigo-100"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] text-slate-500">Decisions: <strong class="text-slate-700">{{ a.decisionIds.join(', ') }}</strong></span>
                    <span
                      class="ml-auto text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="severityColor[a.severity] ?? 'bg-slate-100 text-slate-600'"
                    >{{ a.severity }}</span>
                  </div>
                  <p class="text-xs text-slate-700 leading-relaxed mb-1.5"><strong class="text-slate-900">Issue:</strong> {{ a.issue }}</p>
                  <p class="text-xs text-emerald-800 leading-relaxed"><strong>Opportunity:</strong> {{ a.opportunity }}</p>
                </div>
              </div>
            </div>

            <!-- ── Section 3: Governance Gaps ── -->
            <div class="rounded-xl border border-amber-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                title="Governance Gaps — topics that should have a board decision recorded but do not; expand to see each gap and the opportunity for board action"
                @click="sectionOpen.gaps = !sectionOpen.gaps"
              >
                <span class="text-sm font-bold text-amber-800 flex-1">📋 Governance Gaps</span>
                <span class="text-xs font-semibold" :class="result.governanceGaps.length > 0 ? 'text-amber-600' : 'text-emerald-600'">
                  {{ result.governanceGaps.length > 0 ? `${result.governanceGaps.length} gap${result.governanceGaps.length !== 1 ? 's' : ''}` : '✓ None found' }}
                </span>
                <span class="text-amber-400 text-xs ml-1">{{ sectionOpen.gaps ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.gaps">
                <div v-if="result.governanceGaps.length === 0" class="px-4 py-3 text-xs text-emerald-700 bg-white">
                  No governance gaps were identified in this document. ✓
                </div>
                <div
                  v-for="g in result.governanceGaps"
                  :key="g.id"
                  class="px-4 py-3 bg-white border-t border-amber-100"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-black text-slate-400">{{ g.id }}</span>
                    <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{{ g.category }}</span>
                  </div>
                  <p class="text-xs text-slate-700 leading-relaxed mb-1.5"><strong>Significance:</strong> {{ g.significance }}</p>
                  <p class="text-xs text-emerald-800 leading-relaxed"><strong>Opportunity:</strong> {{ g.opportunity }}</p>
                </div>
              </div>
            </div>

            <!-- ── Section 4: Pattern Analysis ── -->
            <div class="rounded-xl border border-violet-200 overflow-hidden mb-5">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors text-left"
                title="Governance Pattern Analysis — recurring themes in how the board operates; expand to see strengths and concerns with opportunities for action"
                @click="sectionOpen.patterns = !sectionOpen.patterns"
              >
                <span class="text-sm font-bold text-violet-800 flex-1">🔮 Governance Patterns</span>
                <span class="text-xs text-violet-600 font-semibold">{{ result.patternAnalysis.length }} patterns</span>
                <span class="text-violet-400 text-xs ml-1">{{ sectionOpen.patterns ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.patterns" class="divide-y divide-violet-100">
                <div
                  v-for="p in result.patternAnalysis"
                  :key="p.id"
                  class="px-4 py-3 bg-white"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-black text-slate-400">{{ p.id }}</span>
                    <span
                      class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="p.type === 'strength' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'"
                    >{{ p.type }}</span>
                    <span class="text-xs font-semibold text-slate-700 flex-1">{{ p.label }}</span>
                  </div>
                  <p class="text-xs text-slate-700 leading-relaxed mb-1.5">{{ p.description }}</p>
                  <p class="text-xs text-emerald-800 leading-relaxed"><strong>Opportunity:</strong> {{ p.opportunity }}</p>
                  <p v-if="p.evidenceDecisionIds.length" class="text-[10px] text-slate-400 mt-1">
                    Evidence: decisions {{ p.evidenceDecisionIds.join(', ') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- ── Todd Rating Widget ── -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
              <h4 class="text-sm font-bold text-slate-700 mb-1">Todd's Usefulness Rating</h4>
              <p class="text-xs text-slate-500 mb-3 leading-relaxed">
                Rate how useful this analysis was for board action planning. −100 = no value at all, +100 = highly valuable.
                Your rating helps improve Maria's next analysis.
              </p>
              <div class="flex items-center gap-3 mb-2">
                <span class="text-xs text-slate-500 w-8 text-right shrink-0">−100</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  :value="rating ?? 0"
                  class="flex-1 accent-emerald-600"
                  title="Todd usefulness rating slider — drag from -100 (no value) to +100 (highly valuable) to rate how useful this Maria analysis was"
                  @input="onRatingInput"
                />
                <span class="text-xs text-slate-500 w-8 shrink-0">+100</span>
              </div>
              <div class="text-center">
                <span
                  class="text-sm font-bold"
                  :class="ratingColor"
                >
                  {{ ratingInteracted ? `${rating! > 0 ? '+' : ''}${rating}` : '—' }} · {{ ratingLabel }}
                </span>
              </div>
            </div>

            <!-- ── Email Report ── -->
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h4 class="text-sm font-bold text-emerald-900 mb-1">📧 Email Report to Board</h4>
              <p class="text-xs text-emerald-700 mb-3 leading-relaxed">
                Send the full Maria governance analysis to Todd and the board.
                Mail.app will open with the complete colored HTML report pre-filled — no pasting required.
              </p>
              <div class="flex gap-2 mb-3">
                <input
                  v-model="emailTo"
                  type="email"
                  multiple
                  class="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="todd@board.org, chair@board.org (comma-separated)"
                  title="Email recipients — enter one or more email addresses separated by commas. Mail.app will open with the full report pre-filled in the body."
                />
              </div>
              <button
                type="button"
                class="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                :class="reportSent
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'"
                title="Email Report — builds a fully formatted HTML governance report and opens it in Mail.app as a pre-filled compose draft. No pasting required. Delivers Decision Inventory, Authority Clarity Report, Governance Gaps, and Pattern Analysis."
                @click="sendEmailReport"
              >
                <EmailGlyph size="compact" class="text-current" aria-hidden="true" />
                <span>{{ reportSent ? '✓ Report opened in Mail' : 'Open Report in Mail →' }}</span>
              </button>
            </div>

          </div>
        </ScrollContainer>

      </div>
    </div>
  </Teleport>
</template>
