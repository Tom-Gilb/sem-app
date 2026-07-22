<!-- UNIT_TYPE=Component
  MungerPanel.vue — Charlie Munger Agent analysis output.

  Tom Gilb 2026-06-20 verbatim:
    "Munger Agent: using CHARLIE MUNGERS RULES in assets, make an analytical agent
     with all the ideas like sharpening, in agents Elon, Incorruptible, Maria"

  Architecture: mirrors ElonPanel.vue / IncorruptiblePanel.vue:
    • Teleport-to-body full-viewport modal at z-[490]
    • Header band (amber gradient — Munger accent)
    • Summary card (Rationality Score + headline + severity tally)
    • Findings list grouped by category (12 Munger categories)
    • Per-finding Accept-Fix / Dismiss buttons
    • CloseDot at top-right per CloseDot SUPREME rule
    • Backdrop click-to-close + Escape via registerExclusiveSurface

  Phase 2 (deferred):
    • Sharpening Q&A interview (MungerSharpeningPanel)
    • Email export with colorful HTML
    • Demo registry entry
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { MungerFinding, MungerCategory } from '../types/munger'
import {
  MUNGER_CATEGORY_META, MUNGER_SEVERITY_META, MUNGER_SOURCE_META,
} from '../types/munger'
import {
  runMungerAnalysis, applyMungerFix, useMungerFindings,
} from '../composables/useMungerFindings'
import { exportAgentReport, type AgentExportCategoryGroup } from '../composables/useAgentReportExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock | null
  planTitle: string
}>()

const emit = defineEmits<{
  close: []
  'accept-fix': [finding: MungerFinding]
  /** r41 v404 (Tom Gilb 2026-06-28 verbatim "A clear messge: YOU HAVE ACCEPTS
   *  11 FIXES. CLICK HERE TO CONFIRM AND TO SEE THE CONSEQUENCES IN YOUR PLAN
   *  NOW"): emitted when the planner clicks the prominent "see consequences"
   *  button after accepting one or more fixes.  App.vue closes the Munger
   *  panel + opens the Spec Editor so the planner sees the updated spec. */
  'confirm-and-view': [acceptedCount: number]
}>()

const { report, visibleFindings, dismissedIds, setReport, dismissFinding, undismissFinding } = useMungerFindings()

// Re-run analysis whenever spec or planTitle changes (including on open).
function rerun(): void {
  setReport(runMungerAnalysis(props.spec, props.planTitle || '(Untitled Plan)'))
}
onMounted(rerun)
watch(() => [props.spec, props.planTitle], rerun, { deep: true })

// ── Category groupings for the UI ───────────────────────────────────────────
const groupedFindings = computed(() => {
  const r = report.value
  if (!r) return [] as Array<{ category: MungerCategory; findings: MungerFinding[] }>
  return (Object.keys(r.byCategory) as MungerCategory[])
    .map(c => ({ category: c, findings: r.byCategory[c].filter(f => !dismissedIds.value.has(f.id)) }))
    .filter(g => g.findings.length > 0)
})

// ── Accept-Fix handler ──────────────────────────────────────────────────────
// r41 v404 (Tom Gilb 2026-06-28 "YOU HAVE ACCEPTS 11 FIXES.  CLICK HERE TO
// CONFIRM AND TO SEE THE CONSEQUENCES IN YOUR PLAN NOW"): track accepted-fix
// count locally so we can render the prominent "see consequences" banner +
// CTA above the footer when the planner has applied 1+ fixes.  Accept and
// Dismiss both call dismissFinding (which only HIDES the finding from this
// session's view) but ONLY Accept fires emit('accept-fix') which App.vue
// applies to the spec.  acceptedCount tracks ONLY accepts so the banner
// reads truthfully (not "you dismissed N findings").
const acceptedCount = ref<number>(0)

function onAccept(finding: MungerFinding): void {
  emit('accept-fix', finding)
  dismissFinding(finding.id)
  acceptedCount.value++
}

function onDismiss(finding: MungerFinding): void {
  dismissFinding(finding.id)
}

/** r41 v404 — Click handler for the prominent "see consequences" CTA.
 *  Emits 'confirm-and-view' with the accepted count so App.vue can close
 *  the Munger panel + open the Spec Editor to show the updated spec. */
function onConfirmAndView(): void {
  emit('confirm-and-view', acceptedCount.value)
}

// ── Escape-key + body-overflow lock ────────────────────────────────────────
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
    .map(s => ({ key: s, label: MUNGER_SEVERITY_META[s].label, count: r.bySeverity[s], bg: MUNGER_SEVERITY_META[s].bg }))
})

// ── Score colour band (visual) ──────────────────────────────────────────────
const scoreColor = computed(() => {
  const s = report.value?.rationalityScore ?? 0
  if (s >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-300' }
  if (s >= 60) return { bg: 'bg-amber-100',  text: 'text-amber-900',  ring: 'ring-amber-300' }
  return { bg: 'bg-red-100', text: 'text-red-900', ring: 'ring-red-300' }
})

const hasDismissed = computed(() => dismissedIds.value.size > 0)

// ── Export — Export-Button-on-All-Windows SUPREME (Tom 2026-06-23) ──────────
// Mailto-No-Self-To SUPREME: to: '' is passed via exportAgentReport().
async function exportMungerReport(): Promise<void> {
  const r = report.value
  if (!r) return
  const groups: AgentExportCategoryGroup[] = groupedFindings.value.map(g => ({
    categoryLabel: MUNGER_CATEGORY_META[g.category].label,
    categorySubtitle: MUNGER_CATEGORY_META[g.category].subtitle,
    findings: g.findings.map(f => ({
      id: f.id,
      categoryLabel: MUNGER_CATEGORY_META[g.category].label,
      principleViolated: f.principleViolated,
      explanation: f.explanation,
      severityLabel: MUNGER_SEVERITY_META[f.severity].label,
      severityBgHex: f.severity === 'critical' ? '#dc2626' : (f.severity === 'moderate' ? '#f59e0b' : '#3b82f6'),
      sourceLayerLabel: MUNGER_SOURCE_META[f.sourceLayer].label,
      sourceLayerBgHex: '#fef3c7',
      triggeredBy: f.triggeredBy,
      fixPlanguage: f.suggestedFix.asPlanguage,
      fixRationale: f.suggestedFix.rationale,
      longTermConsequence: f.longTermConsequence,
      citations: [f.mungerCitation, f.almanackCitation, f.gilbCitation].filter((c): c is string => !!c),
    })),
  }))
  await exportAgentReport({
    agentName: '🧠 Munger Agent',
    agentSubtitle: "Charlie Munger's 12 Prompts · Analytical Rigor",
    agentHeaderBgHex: '#92400e', // amber-800
    planTitle: props.planTitle,
    scoreValue: r.rationalityScore,
    scoreLabel: 'Rationality',
    totalFindings: r.totalFindings,
    severityTally: [
      { label: 'CRITICAL',   count: r.bySeverity.critical,   bgHex: '#dc2626' },
      { label: 'MODERATE',   count: r.bySeverity.moderate,   bgHex: '#f59e0b' },
      { label: 'SUGGESTION', count: r.bySeverity.suggestion, bgHex: '#3b82f6' },
    ],
    headline: r.headline,
    groups,
    sourcesFooterHtml:
      '<b>Sources:</b> CHARLIE MUNGERS RULES.pdf · ' +
      'Composes with Poor Charlie\'s Almanack + Gilb Planguage discipline.',
    subject: `Munger Agent report · ${props.planTitle || '(Untitled Plan)'}`,
    artefactName: 'Munger report',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[490] flex items-start justify-center pt-3 sm:pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Munger Analytical Agent — analysis output"
    >
      <!-- Backdrop click-to-close — CloseDot SUPREME rule -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel surface -->
      <div
        class="relative w-[min(96vw,1180px)] h-[min(92vh,920px)] rounded-2xl bg-white shadow-2xl
               ring-2 ring-amber-200/60 flex flex-col overflow-hidden"
      >
        <!-- Header band — amber gradient, Munger portrait, title, score -->
        <div class="bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 text-white px-6 py-4
                    flex items-center gap-4 shadow-lg">
          <img
            src="../assets/agents/charlie-munger.png"
            alt="Charlie Munger"
            class="h-14 w-14 rounded-full ring-2 ring-amber-200 object-cover shrink-0"
          />
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">🧠 Munger Agent</h1>
            <p class="text-xs text-amber-100/90 leading-snug">
              Charlie Munger's 12 Prompts · Analytical Rigor for {{ planTitle || '(Untitled Plan)' }}
            </p>
          </div>
          <!-- Rationality Score -->
          <div
            v-if="report"
            :class="[scoreColor.bg, scoreColor.text, scoreColor.ring]"
            class="rounded-2xl ring-2 px-4 py-2 text-center shrink-0"
            :title="`Rationality Score = 100 − (severity-weighted deductions). Higher is more analytically rigorous per Munger.`"
          >
            <div class="text-2xl font-extrabold leading-none">{{ report.rationalityScore }}</div>
            <div class="text-[10px] font-bold uppercase tracking-wider">Rationality</div>
          </div>
          <!-- r41 v413 (Tom Gilb 2026-06-28 verbatim "applies to all sharpening")
               — Apply-equivalent ("✓ See consequences") MIRROR in the top
               header band, gated to `acceptedCount > 0`.  Same lesson as v412:
               the primary commit-and-move-on action must be visible in the
               same viewport region the planner is looking at when they finish
               accepting fixes.  The bottom emerald confirmation block (v404)
               stays — this top mirror is the offering for the planner who is
               at the top of the findings list when they hit "Accept Fix" on
               their final one.  Composes with DD-014 Top-and-Bottom Navigation
               Mirror SUPREME (action layer) + MOVE Principle + Done/You-Can/
               Continue SUPREME + Tom-Repeats-Himself SUPREME (v412 named the
               failure mode; v413 sweeps it to every sharpening surface). -->
          <button
            v-if="acceptedCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 shrink-0"
            :title="`${acceptedCount} fix${acceptedCount === 1 ? '' : 'es'} accepted · click to close the Munger panel and view the consequences in your specs.  Source: Munger attached to each mutated field.`"
            :aria-label="`See ${acceptedCount} accepted fix${acceptedCount === 1 ? '' : 'es'} in your specs`"
            @click="onConfirmAndView"
          >
            ✓ See {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }} in specs →
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white text-amber-900 text-xs font-bold shadow ring-1 ring-amber-200 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0"
            title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
            @click="exportMungerReport"
          >📤 Export</button>
          <!-- v530 — Unrelated-Actions-Get-Visual-Space SUPREME (Tom Gilb 2026-07-22) -->
          <div class="w-px h-6 bg-slate-300 mx-2" aria-hidden="true" />
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Summary band — headline + severity tally -->
        <div v-if="report" class="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <p class="flex-1 min-w-0 text-sm font-semibold text-amber-950">{{ report.headline }}</p>
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
              class="px-2 py-1 rounded-md text-[10px] font-semibold text-amber-700 bg-white ring-1 ring-amber-300 hover:bg-amber-100"
              title="Show dismissed findings again"
              @click="dismissedIds = new Set()"
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
              <p class="text-2xl mb-1">🧠 ✅</p>
              <p class="text-base font-bold text-emerald-900 mb-1">Analytical rigor solid</p>
              <p class="text-xs text-emerald-700 max-w-md mx-auto">
                The plan passes all 12 Munger checks at this moment.  Run again after any
                spec change to keep the analysis current.
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
                  {{ MUNGER_CATEGORY_META[group.category].label }}
                </h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  {{ MUNGER_CATEGORY_META[group.category].subtitle }}
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ group.findings.length }}
                </span>
              </div>

              <!-- Per-finding card -->
              <ul class="divide-y divide-slate-200">
                <li v-for="f in group.findings" :key="f.id" class="px-4 py-4 flex flex-col gap-2">
                  <div class="flex items-start gap-3 flex-wrap">
                    <span
                      :class="[MUNGER_SEVERITY_META[f.severity].bg, MUNGER_SEVERITY_META[f.severity].text]"
                      class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider shrink-0"
                    >{{ MUNGER_SEVERITY_META[f.severity].label }}</span>
                    <span
                      :class="[MUNGER_SOURCE_META[f.sourceLayer].bg, MUNGER_SOURCE_META[f.sourceLayer].text]"
                      class="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0"
                    >{{ MUNGER_SOURCE_META[f.sourceLayer].label }}</span>
                    <span class="text-[11px] text-slate-500 leading-snug shrink-0">→ {{ f.triggeredBy }}</span>
                  </div>

                  <p class="text-sm font-bold text-slate-900">{{ f.principleViolated }}</p>
                  <p class="text-[13px] text-slate-700 leading-relaxed">{{ f.explanation }}</p>

                  <!-- Suggested Planguage edit -->
                  <div class="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 mt-1">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                      Proposed Planguage edit
                    </p>
                    <pre class="text-[11px] font-mono text-amber-950 leading-snug whitespace-pre-wrap">{{ f.suggestedFix.asPlanguage }}</pre>
                    <p class="text-[11px] text-amber-800 italic mt-1.5">{{ f.suggestedFix.rationale }}</p>
                  </div>

                  <!-- Long-term consequence -->
                  <p class="text-[11px] italic text-slate-500">{{ f.longTermConsequence }}</p>

                  <!-- Citations -->
                  <div class="flex flex-wrap gap-1.5">
                    <span v-if="f.mungerCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono">
                      {{ f.mungerCitation }}
                    </span>
                    <span v-if="f.almanackCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-orange-100 text-orange-900 font-mono">
                      {{ f.almanackCitation }}
                    </span>
                    <span v-if="f.gilbCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-900 font-mono">
                      {{ f.gilbCitation }}
                    </span>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      title="Apply this fix to the spec — adds a new Constraint / Value / Stakeholder per the suggestion. Undo available."
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

        <!-- r41 v404 (Tom Gilb 2026-06-28 verbatim "A clear messge: YOU HAVE
             ACCEPTS 11 FIXES. CLICK HERE TO CONFIRM AND TO SEE THE
             CONSEQUENCES IN YOUR PLAN NOW") — Confirmation block.  Appears
             ABOVE the footer when the planner has accepted ≥ 1 fix.  Prominent
             emerald banner with bold count + big CTA button so the planner
             never has to figure out what to click next.  Composes with
             Done/You-Can/Continue SUPREME (banked v403) — the CONTINUE here
             is "see the consequences" not just "close".  Composes with
             MOVE Principle SUPREME (visible at-a-glance, never menu-dived). -->
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
            :title="`Close the Munger panel and open the Spec Editor so you can see the ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'} in your specs.`"
            @click="onConfirmAndView"
          >✓ See the consequences in my specs now →</button>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
          <p class="text-[11px] text-slate-500 leading-snug flex-1">
            Source: <span class="font-semibold">CHARLIE MUNGERS RULES.pdf</span> ·
            Composes with Poor Charlie's Almanack + Gilb Planguage discipline.
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            title="Re-run all 12 Munger checks on the current spec"
            @click="rerun"
          >🔄 Re-run analysis</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold"
            :title="acceptedCount > 0 ? 'Close without viewing the consequences — your accepted fixes ARE applied; you can see them later via the Spec Editor.' : 'Close the Munger Agent panel'"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
