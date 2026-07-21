<!-- UNIT_TYPE=Component
  FeynmanPanel.vue — Richard P. Feynman Agent analysis output.

  Tom Gilb 2026-06-26 verbatim:
    "now I want a Feynman Agent. See folder in assets and seach internet.
     How would Richard evaluate a plan?"
    + "i dont really want to stter, i want solid architecture, and well
       architected changes, just do it"

  Architecture (mirrors MungerPanel.vue / IncorruptiblePanel.vue):
    • Teleport-to-body full-viewport modal at z-[490]
    • Header band (violet/indigo gradient — Feynman blackboard aesthetic)
    • Summary card (Honesty Score + headline + severity tally)
    • Findings list grouped by category (6 Feynman categories)
    • Per-finding Accept-Fix / Dismiss buttons
    • CloseDot at top-right per CloseDot SUPREME rule
    • Backdrop click-to-close + Escape via keydown handler
    • Export pin per Export-Button-on-All-Windows SUPREME (Mailto-No-Self-To)
    • Top-aligned with items-start + pt-3 sm:pt-6 per v311 white-bar lesson

  Phase 2 (deferred):
    • FeynmanSharpeningPanel — 10-prompt interactive interview from Tom-PDF
    • Full Apply-Fix routing for complex types (add-evo-step, request-engineer-estimate)
    • Feynman portrait asset

  Composes with:
    • Spell-out-Type-Names SUPREME (Function / Value / Solution / Constraint — full words)
    • Mailto-No-Self-To SUPREME (export uses to: '')
    • Universal Undo SUPREME (Accept Fix wires through useUndoHistory in App.vue caller)
    • No-Silent-Removal SUPREME (this pin + panel become a permanent surface once shipped)
    • CloseDot SUPREME (size="lg" on this drawer-equivalent surface)
    • Icon-Plus-Text SUPREME (header has BOTH ⚛ glyph AND "Feynman Agent" text)
    • DD-015 International Icons (⚛ is a UNICODE atom symbol, not English-letter)
    • DD-017 Colour-on-Background (violet/indigo passes R-G colourblind contrast)
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SpecBlock } from '../types/spec'
import {
  type FeynmanFinding,
  type FeynmanCategory,
  FEYNMAN_CATEGORY_META,
  FEYNMAN_SEVERITY_META,
  FEYNMAN_SOURCE_META,
  honestyScoreLabel,
} from '../types/feynman'
import {
  runFeynmanAnalysis,
  useFeynmanFindings,
} from '../composables/useFeynmanFindings'
import { exportAgentReport, type AgentExportCategoryGroup } from '../composables/useAgentReportExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock | null
  planTitle: string
}>()

const emit = defineEmits<{
  close: []
  'accept-fix': [finding: FeynmanFinding]
  /** r41 v405 (Tom Gilb 2026-06-28 "OF COURSE THE MUNGER LOGIC APPLIES TO
   *  ALL SUCH CHANGES IN ALL AGENTS"): emitted when planner clicks the
   *  prominent "see consequences in my specs" button after accepting ≥ 1
   *  fix.  App.vue closes the panel + opens the Spec Editor. */
  'confirm-and-view': [acceptedCount: number]
}>()

const {
  report,
  dismissedIds,
  setReport,
  dismissFinding,
  clearDismissed,
} = useFeynmanFindings()

// Re-run analysis whenever spec or planTitle changes (including on open).
function rerun(): void {
  setReport(runFeynmanAnalysis(props.spec ?? { values: [], functions: [], solutions: [], constraints: [], stakeholders: [] } as unknown as SpecBlock, props.planTitle || '(Untitled Plan)'))
}
onMounted(rerun)
watch(() => [props.spec, props.planTitle], rerun, { deep: true })

// ── Category groupings for the UI ───────────────────────────────────────────
const groupedFindings = computed(() => {
  const r = report.value
  if (!r) return [] as Array<{ category: FeynmanCategory; findings: FeynmanFinding[] }>
  return (Object.keys(r.byCategory) as FeynmanCategory[])
    .map(c => ({ category: c, findings: r.byCategory[c].filter(f => !dismissedIds.value.has(f.id)) }))
    .filter(g => g.findings.length > 0)
})

// ── Accept-Fix handler ──────────────────────────────────────────────────────
// r41 v405 (Tom Gilb 2026-06-28 "OF COURSE THE MUNGER LOGIC APPLIES TO ALL
// SUCH CHANGES IN ALL AGENTS") — track accepted-fix count + emit confirm-and-
// view CTA.  Mirrors MungerPanel v404 pattern exactly.
const acceptedCount = ref<number>(0)
function onAccept(finding: FeynmanFinding): void {
  emit('accept-fix', finding)
  dismissFinding(finding.id)
  acceptedCount.value++
}
function onConfirmAndView(): void {
  emit('confirm-and-view', acceptedCount.value)
}

function onDismiss(finding: FeynmanFinding): void {
  dismissFinding(finding.id)
}

// ── Escape-key + body-overflow lock ─────────────────────────────────────────
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})

// ── Severity-tally pills for the header ─────────────────────────────────────
const severityPills = computed(() => {
  const r = report.value
  if (!r) return []
  return (['critical', 'moderate', 'suggestion'] as const)
    .filter(s => r.bySeverity[s] > 0)
    .map(s => ({ key: s, label: FEYNMAN_SEVERITY_META[s].label, count: r.bySeverity[s], bg: FEYNMAN_SEVERITY_META[s].bg }))
})

// ── Score colour band (visual) ──────────────────────────────────────────────
const scoreColor = computed(() => {
  const s = report.value?.honestyScore ?? 0
  if (s >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-300' }
  if (s >= 60) return { bg: 'bg-amber-100',   text: 'text-amber-900',   ring: 'ring-amber-300'   }
  return                { bg: 'bg-red-100',   text: 'text-red-900',     ring: 'ring-red-300'     }
})

const scoreWordLabel = computed(() => honestyScoreLabel(report.value?.honestyScore ?? 100))

const hasDismissed = computed(() => dismissedIds.value.size > 0)

// ── Export — Export-Button-on-All-Windows SUPREME + Mailto-No-Self-To ──────
async function exportFeynmanReport(): Promise<void> {
  const r = report.value
  if (!r) return
  const groups: AgentExportCategoryGroup[] = groupedFindings.value.map(g => ({
    categoryLabel: FEYNMAN_CATEGORY_META[g.category].label,
    categorySubtitle: FEYNMAN_CATEGORY_META[g.category].subtitle,
    findings: g.findings.map(f => ({
      id: f.id,
      categoryLabel: FEYNMAN_CATEGORY_META[g.category].label,
      principleViolated: f.principleViolated,
      explanation: f.explanation,
      severityLabel: FEYNMAN_SEVERITY_META[f.severity].label,
      severityBgHex: f.severity === 'critical' ? '#dc2626' : (f.severity === 'moderate' ? '#f59e0b' : '#3b82f6'),
      sourceLayerLabel: FEYNMAN_SOURCE_META[f.sourceLayer].label,
      sourceLayerBgHex: '#ede9fe', // violet-100
      triggeredBy: f.triggeredBy,
      fixPlanguage: f.suggestedFix.asPlanguage,
      fixRationale: f.suggestedFix.rationale,
      longTermConsequence: f.longTermConsequence,
      citations: [f.feynmanCitation, f.gilbCitation, f.verifyUrl].filter((c): c is string => !!c),
    })),
  }))
  await exportAgentReport({
    agentName: '⚛ Feynman Agent',
    agentSubtitle: "Feynman's plan-evaluation lenses · Honesty over Optimism",
    agentHeaderBgHex: '#4338ca', // indigo-700
    planTitle: props.planTitle,
    scoreValue: r.honestyScore,
    scoreLabel: `Honesty (${scoreWordLabel.value})`,
    totalFindings: r.totalFindings,
    severityTally: [
      { label: 'CRITICAL',   count: r.bySeverity.critical,   bgHex: '#dc2626' },
      { label: 'MODERATE',   count: r.bySeverity.moderate,   bgHex: '#f59e0b' },
      { label: 'SUGGESTION', count: r.bySeverity.suggestion, bgHex: '#3b82f6' },
    ],
    headline: r.headline,
    groups,
    sourcesFooterHtml:
      '<b>Sources:</b> Tom-dropped PDF (10 Claude prompts inspired by Feynman, Louis Gleeson @aigleeson 2026-06-26) · ' +
      'Feynman 1974 Caltech commencement <i>Cargo Cult Science</i> ' +
      '(<a href="https://calteches.library.caltech.edu/51/2/CargoCult.htm" style="color:#4338ca">calteches.library.caltech.edu</a>) · ' +
      'Feynman 1986 Rogers Commission <i>Appendix F · Personal Observations on the Reliability of the Shuttle</i> ' +
      '(<a href="https://www.refsmmat.com/files/reflections.pdf" style="color:#4338ca">full 10-page Appendix F text</a> · also relevant: ' +
      '<a href="https://calteches.library.caltech.edu/3570/1/Feynman.pdf" style="color:#4338ca">Feynman E&S 1987 retrospective</a>) · ' +
      "Feynman blackboard at his death (Caltech February 1988): <i>“What I cannot create, I do not understand.”</i><br/>" +
      '<b>For a successful technology, reality must take precedence over public relations, for Nature cannot be fooled.</b> — Feynman, Challenger Appendix F.',
    subject: `Feynman Agent report · ${props.planTitle || '(Untitled Plan)'}`,
    artefactName: 'Feynman report',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[490] flex items-start justify-center pt-3 sm:pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Feynman Agent — analysis output"
    >
      <!-- Backdrop click-to-close — CloseDot SUPREME -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel surface -->
      <div
        class="relative w-[min(96vw,1180px)] h-[min(92vh,920px)] rounded-2xl bg-white shadow-2xl
               ring-2 ring-indigo-200/60 flex flex-col overflow-hidden"
      >
        <!-- Header band — indigo/violet gradient (chalk-on-blackboard aesthetic) -->
        <div class="bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-700 text-white px-6 py-4
                    flex items-center gap-4 shadow-lg">
          <!-- Universal atom glyph + text per Icon-Plus-Text SUPREME + DD-015 -->
          <div
            class="h-14 w-14 rounded-full ring-2 ring-violet-200 bg-indigo-900/60 flex items-center justify-center text-3xl shrink-0"
            aria-hidden="true"
            title="Feynman Agent — refuses to fool you"
          >⚛</div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">⚛ Feynman Agent</h1>
            <p class="text-xs text-violet-100/90 leading-snug">
              Six lenses · Honesty over Optimism · Plan: {{ planTitle || '(Untitled Plan)' }}
            </p>
          </div>
          <!-- Honesty Score badge -->
          <div
            v-if="report"
            :class="[scoreColor.bg, scoreColor.text, scoreColor.ring]"
            class="rounded-2xl ring-2 px-4 py-2 text-center shrink-0"
            :title="`Honesty Score = 100 − severity-weighted deductions. Higher is more Feynman-honest. ${scoreWordLabel}.`"
          >
            <div class="text-2xl font-extrabold leading-none">{{ report.honestyScore }}</div>
            <div class="text-[10px] font-bold uppercase tracking-wider">Honesty · {{ scoreWordLabel }}</div>
          </div>
          <!-- r41 v413 — top-banner mirror of the "✓ See consequences" CTA. -->
          <button
            v-if="acceptedCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 shrink-0"
            :title="`${acceptedCount} fix${acceptedCount === 1 ? '' : 'es'} accepted · click to close the Feynman panel and view the consequences in your specs.  Source: Feynman attached to each mutated field.`"
            :aria-label="`See ${acceptedCount} accepted fix${acceptedCount === 1 ? '' : 'es'} in your specs`"
            @click="onConfirmAndView"
          >
            ✓ See {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }} in specs →
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white text-indigo-900 text-xs font-bold shadow ring-1 ring-indigo-200 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
            title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
            @click="exportFeynmanReport"
          >📤 Export</button>
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Summary band — headline + severity tally -->
        <div v-if="report" class="bg-indigo-50 border-b border-indigo-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <p class="flex-1 min-w-0 text-sm font-semibold text-indigo-950">{{ report.headline }}</p>
          <div class="flex items-center gap-1.5 shrink-0">
            <span
              v-for="p in severityPills"
              :key="p.key"
              :class="[p.bg, 'text-white']"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold tracking-wide"
            >{{ p.count }} {{ p.label }}</span>
            <button
              v-if="hasDismissed"
              type="button"
              class="px-2 py-1 rounded-md text-[10px] font-semibold text-indigo-700 bg-white ring-1 ring-indigo-300 hover:bg-indigo-100"
              title="Show dismissed findings again"
              @click="clearDismissed()"
            >Undismiss all ({{ dismissedIds.size }})</button>
          </div>
        </div>

        <!-- Findings list (scrollable) -->
        <ScrollContainer class="flex-1 min-h-0" outer-class="bg-slate-50">
          <div class="px-6 py-5 space-y-6">
            <!-- Empty state — no findings -->
            <div
              v-if="report && report.totalFindings === 0"
              class="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-5 py-8 text-center"
            >
              <p class="text-2xl mb-1">⚛ ✅</p>
              <p class="text-base font-bold text-emerald-900 mb-1">Plan looks Feynman-honest</p>
              <p class="text-xs text-emerald-700 max-w-md mx-auto leading-relaxed">
                None of the six Feynman lenses fire on this plan right now.  Feynman would still
                ask harder questions in the Sharpening interview (Phase 2).
                Run again after any spec change to keep the analysis current.
              </p>
              <p class="text-[11px] italic text-emerald-700/80 mt-3">
                <span class="opacity-60">— Feynman, Caltech 1974:</span>
                "The first principle is that you must not fool yourself — and you are the easiest person to fool."
              </p>
            </div>

            <!-- Per-category groups -->
            <div
              v-for="group in groupedFindings"
              :key="group.category"
              class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden"
            >
              <!-- Category header -->
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">
                  {{ FEYNMAN_CATEGORY_META[group.category].label }}
                </h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  {{ FEYNMAN_CATEGORY_META[group.category].subtitle }}
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ group.findings.length }}
                </span>
              </div>

              <!-- Category principle banner — the Feynman lens itself -->
              <div class="bg-indigo-50/60 border-b border-indigo-100 px-4 py-2 text-[11px] italic text-indigo-900 leading-snug">
                <span class="font-bold not-italic uppercase tracking-wider text-[10px] text-indigo-700 mr-1.5">Lens:</span>
                {{ FEYNMAN_CATEGORY_META[group.category].feynmanPrinciple }}
              </div>

              <!-- Per-finding cards -->
              <ul class="divide-y divide-slate-200">
                <li v-for="f in group.findings" :key="f.id" class="px-4 py-4 flex flex-col gap-2">
                  <div class="flex items-start gap-3 flex-wrap">
                    <span
                      :class="[FEYNMAN_SEVERITY_META[f.severity].bg, FEYNMAN_SEVERITY_META[f.severity].text]"
                      class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider shrink-0"
                    >{{ FEYNMAN_SEVERITY_META[f.severity].label }}</span>
                    <span
                      :class="[FEYNMAN_SOURCE_META[f.sourceLayer].bg, FEYNMAN_SOURCE_META[f.sourceLayer].text]"
                      class="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0"
                    >{{ FEYNMAN_SOURCE_META[f.sourceLayer].label }}</span>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 bg-violet-100 text-violet-900"
                      :title="`Feynman move underneath this finding`"
                    >Lens · {{ f.feynmanLens }}</span>
                    <span class="text-[11px] text-slate-500 leading-snug shrink-0">→ {{ f.triggeredBy }}</span>
                  </div>

                  <p class="text-sm font-bold text-slate-900">{{ f.principleViolated }}</p>
                  <p class="text-[13px] text-slate-700 leading-relaxed">{{ f.explanation }}</p>

                  <!-- Suggested Planguage edit -->
                  <div class="rounded-lg bg-indigo-50 ring-1 ring-indigo-200 px-3 py-2 mt-1">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1">
                      Proposed Planguage edit
                    </p>
                    <pre class="text-[11px] font-mono text-indigo-950 leading-snug whitespace-pre-wrap">{{ f.suggestedFix.asPlanguage }}</pre>
                    <p class="text-[11px] text-indigo-800 italic mt-1.5">{{ f.suggestedFix.rationale }}</p>
                  </div>

                  <!-- Long-term consequence -->
                  <p class="text-[11px] italic text-slate-500">{{ f.longTermConsequence }}</p>

                  <!-- Citations -->
                  <div class="flex flex-wrap gap-1.5">
                    <a
                      v-if="f.verifyUrl"
                      :href="f.verifyUrl"
                      target="_blank"
                      rel="noopener"
                      class="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-semibold hover:bg-indigo-200"
                      title="Open the cited Feynman source in a new tab to verify"
                    >🔗 Verify source</a>
                    <span v-if="f.feynmanCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-900 font-mono">
                      Feynman · {{ f.feynmanCitation.slice(0, 80) }}{{ f.feynmanCitation.length > 80 ? '…' : '' }}
                    </span>
                    <span v-if="f.gilbCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono">
                      Gilb · {{ f.gilbCitation }}
                    </span>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                      :title="`Apply this fix to the spec.  Undo available via the global Undo button.`"
                      @click="onAccept(f)"
                    >✓ Accept Fix</button>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      title="Dismiss this finding for the rest of this session"
                      @click="onDismiss(f)"
                    >✕ Dismiss</button>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </ScrollContainer>

        <!-- r41 v405 — Confirmation block (Munger pattern v404 propagated per Tom
             Gilb 2026-06-28 "OF COURSE THE MUNGER LOGIC APPLIES TO ALL SUCH
             CHANGES IN ALL AGENTS").  Appears when planner has accepted ≥ 1 fix. -->
        <div
          v-if="acceptedCount > 0"
          class="shrink-0 border-t-2 border-emerald-500 bg-emerald-50 px-6 py-4 flex items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" class="text-2xl shrink-0">✓</span>
          <p class="flex-1 text-sm font-semibold text-emerald-900 leading-snug">
            You have accepted {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }}.<br/>
            <span class="text-[12px] font-normal text-emerald-800">The fixes are applied to your specs — click below to see the consequences.</span>
          </p>
          <button
            type="button"
            class="shrink-0 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-md
                   ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
            :title="`Close the Feynman panel and open the Spec Editor so you can see the ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'} in your specs.`"
            @click="onConfirmAndView"
          >✓ See the consequences in my specs now →</button>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
          <p class="text-[11px] text-slate-500 leading-snug flex-1">
            Sources:
            <a href="https://calteches.library.caltech.edu/51/2/CargoCult.htm" target="_blank" rel="noopener" class="text-indigo-700 hover:underline font-semibold">Cargo Cult Science</a>
            ·
            <a href="https://www.refsmmat.com/files/reflections.pdf" target="_blank" rel="noopener" class="text-indigo-700 hover:underline font-semibold">Challenger Appendix F</a>
            ·
            <span class="font-semibold">Tom-dropped PDF (10 Feynman prompts, @aigleeson 2026-06-26)</span>
            · Composes with Gilb Planguage discipline.
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            title="Re-run all Feynman detectors on the current spec"
            @click="rerun"
          >🔄 Re-run analysis</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xs font-semibold"
            title="Close the Feynman Agent panel"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
