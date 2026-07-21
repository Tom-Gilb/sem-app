<!-- UNIT_TYPE=Panel -->
<!-- ResourceCostEngineeringPanel.vue — Cost Engineering tool modal panel.
     Provides two modes for Design-to-Cost analysis:
       1. STATIC  — upfront, whole-plan cost target setting before Evo Steps.
       2. DYNAMIC — per-Evo-Step tracking of planned vs actual Cost / Value / Constraint.

     Implements Tom's directive: "COST ENGINEERING: THE TOOL, SEPARATE TOOL for
     Dynamic (Evo Step) Design to [Cost, Value, Constraint] and for initial statics
     upfront Design to [Cost, Value, Constraint]. Based on ideas in Cost Engineering."

     Rules compliance:
       - CloseDot rule: CloseDot at END of header flex + backdrop @click="close" + Escape key.
       - Single-Surface rule: caller (App.vue) registers via registerExclusiveSurface.
       - ScrollContainer wraps scrollable content.
       - DD-014 (Top-and-Bottom Navigation Mirror): Close button mirrored at bottom.
       - TwinPod-URI Access Policy: BookCoverChip receives only user-facing distribution URLs.
       - Teleport to body.

     Props:
       open  — controls visibility
       spec  — current SpecBlock (null = demo mode)

     Emits:
       close — panel dismiss (backdrop, CloseDot, Escape, or bottom Close button)
-->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import BookCoverChip from './BookCoverChip.vue'
import PlanguageTerm from './PlanguageTerm.vue'
import type { SpecBlock, REntry, VEntry, CEntry } from '../types/spec'
import { rBudget, rBudgetLabel } from '../types/spec'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
}>()

const emit = defineEmits<{ close: [] }>()

// ── Tabs ──────────────────────────────────────────────────────────────────────

type CeMode = 'static' | 'dynamic'
const mode = ref<CeMode>('static')

// ── Keyboard close (Escape) ───────────────────────────────────────────────────

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', _onKey))
onUnmounted(() => window.removeEventListener('keydown', _onKey))

// ── Demo data (shown when spec is null) ───────────────────────────────────────

const DEMO_RESOURCES: REntry[] = [
  {
    id: 'R.Budget',
    type: 'Resource',
    level: 'Business',
    description: 'Total capital budget for the project',
    scale: 'USD',
    tolerable: '$600,000',
    goal: '$500,000',
    wish: '$400,000',
    status: '',
  } as REntry,
  {
    id: 'R.WorkHours.Dev',
    type: 'Resource',
    level: 'Product',
    description: 'Development engineer-hours',
    scale: 'engineer-hours',
    tolerable: '1600',
    goal: '1200',
    wish: '900',
    status: '',
  } as REntry,
]

const DEMO_VALUES: VEntry[] = [
  {
    id: 'V.SystemPerformance',
    type: 'Value',
    level: 'Product',
    description: 'Response time under full load',
    scale: '% of requests completing within 200ms',
    meter: 'Load test at 1000 concurrent users',
    tolerable: '80%',
    goal: '95%',
    wish: '99%',
    status: '',
    wishStakeholder: '',
    functionOfValue: '',
  } as VEntry,
  {
    id: 'V.UserAdoption',
    type: 'Value',
    level: 'Business',
    description: 'Active users within 90 days of launch',
    scale: 'unique logged-in users per month',
    meter: 'Auth system monthly active count',
    tolerable: '500',
    goal: '1,000',
    wish: '2,500',
    status: '',
    wishStakeholder: '',
    functionOfValue: '',
  } as VEntry,
]

const DEMO_CONSTRAINTS: CEntry[] = [
  {
    id: 'C.ComplianceDeadline',
    type: 'Constraint',
    level: 'Business',
    description: 'Legal compliance review must complete before launch',
    rationale: 'Regulatory requirement — jurisdiction-mandated audit trail',
    source: 'GDPR Art. 25',
  } as CEntry,
  {
    id: 'C.DataResidency',
    type: 'Constraint',
    level: 'Stakeholder',
    description: 'All user data must remain within EU data centres',
    rationale: 'GDPR data-residency obligation',
    source: 'GDPR Art. 44',
  } as CEntry,
]

// Demo Evo-Step cost table (Dynamic mode)
interface EvoStepCostRow {
  step: string
  plannedCost: string
  valueDelivered: string
  constraintStatus: string
  vcRatio: number
}

const DEMO_STEPS: EvoStepCostRow[] = [
  { step: 'Evo Step 1 — Core Infrastructure', plannedCost: '$120,000', valueDelivered: '38%', constraintStatus: 'Passed', vcRatio: 2.4 },
  { step: 'Evo Step 2 — User Auth + Onboarding', plannedCost: '$90,000', valueDelivered: '22%', constraintStatus: 'Passed', vcRatio: 1.8 },
  { step: 'Evo Step 3 — Performance Tuning', plannedCost: '$60,000', valueDelivered: '17%', constraintStatus: 'Caution', vcRatio: 1.2 },
  { step: 'Evo Step 4 — Compliance Audit', plannedCost: '$80,000', valueDelivered: '7%', constraintStatus: 'At Risk', vcRatio: 0.6 },
]

// ── Spec-derived data (or demo fallback) ─────────────────────────────────────

const resources = computed<REntry[]>(() =>
  (props.spec?.resources?.length ? props.spec.resources : DEMO_RESOURCES) as REntry[]
)

const values = computed<VEntry[]>(() =>
  (props.spec?.values?.length ? props.spec.values : DEMO_VALUES) as VEntry[]
)

const constraints = computed<CEntry[]>(() =>
  (props.spec?.constraints?.length ? props.spec.constraints : DEMO_CONSTRAINTS) as CEntry[]
)

const usingDemoData = computed(() => !props.spec)

// ── Analysis state ────────────────────────────────────────────────────────────

/** Whether the Claudian analysis prompt panel is open */
const analysisOpen   = ref(false)
/** Track copy confirmation */
const promptCopied   = ref(false)
let _copyResetTimer: ReturnType<typeof setTimeout> | null = null

/** Builds a rich Planguage Cost Engineering analysis prompt from live spec data */
const claudianPrompt = computed<string>(() => {
  const rLines = resources.value.map(r =>
    `  ${r.id} — Scale: ${(r as any).scale ?? '?'} — ${rBudgetLabel(r as REntry)}: ${rBudget(r as REntry) || '?'} — Tolerable (max): ${(r as any).tolerable ?? '?'}`
  ).join('\n')

  const vLines = values.value.map(v =>
    `  ${v.id} — Goal: ${v.goal ?? '?'} — Tolerable: ${v.tolerable ?? '?'} — Wish: ${v.wish ?? '?'}`
  ).join('\n')

  const cLines = constraints.value.map(c =>
    `  ${c.id} — ${c.description ?? ''}`
  ).join('\n')

  return `You are a Planguage and Gilb Cost Engineering expert.
Analyse the following Spec for Design-to-Cost feasibility.

=== RESOURCE CONSTRAINTS (R. entries) ===
${rLines}

=== VALUE REQUIREMENTS (V. entries) ===
${vLines}

=== CONSTRAINTS (C. entries with cost impact) ===
${cLines}

=== ANALYSIS REQUEST ===
For EACH V. entry provide:
1. ACHIEVABILITY — Likely | Possible | At Risk — given the above Resource budgets
2. KEY ASSUMPTION — what must be true for the Goal to be reachable at budget
3. BINDING RESOURCE — which R. entry is the tightest constraint for this Value
4. GILB PRINCIPLE — cite the most relevant Cost Engineering or Planguage principle
   (Design-to-Cost, V/C Ratio, DEEP, Tolerable boundary, etc.)

Then provide:
5. OVERALL V/C PRIORITY ORDER — rank Values by expected Value/Cost return
6. CONSTRAINT COST OVERHEAD — which C. entries add the most cost overhead
7. ONE ACTIONABLE RECOMMENDATION — the single highest-leverage Design-to-Cost move

Format as: a table per Value (rows: Achievability / Assumption / Binding Resource / Principle)
then the three overall items as short paragraphs.`
})

async function copyAnalysisPrompt(): Promise<void> {
  try {
    await navigator.clipboard.writeText(claudianPrompt.value)
    promptCopied.value = true
    if (_copyResetTimer) clearTimeout(_copyResetTimer)
    _copyResetTimer = setTimeout(() => { promptCopied.value = false }, 3000)
  } catch {
    // fallback — silent
  }
}

// ── VDT colour helper (Dynamic mode) ─────────────────────────────────────────

function ratioColorClass(ratio: number): string {
  if (ratio >= 2.0) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (ratio >= 1.0) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function ratioLabel(ratio: number): string {
  if (ratio >= 2.0) return 'Excellent'
  if (ratio >= 1.0) return 'Good'
  return 'Poor'
}

function constraintStatusClass(status: string): string {
  if (status === 'Passed') return 'text-emerald-700'
  if (status === 'Caution') return 'text-amber-600'
  return 'text-red-600'
}

// ── Cost implication note for constraints (demo) ─────────────────────────────

function constraintCostNote(id: string): string {
  const notes: Record<string, string> = {
    'C.ComplianceDeadline': '+$50,000 for legal review sprint',
    'C.DataResidency': '+$20,000 for EU region infrastructure surcharge',
  }
  return notes[id] ?? 'Review cost implication with owner'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ce-panel">
      <div v-if="open" class="fixed inset-0 z-[700] flex items-center justify-center p-4">

        <!-- Backdrop — click outside to close (CloseDot rule) -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="emit('close')"
        />

        <!-- Panel — centred, max 860px wide, max 90vh tall -->
        <div
          class="relative z-10 w-full max-w-[860px] max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ce-panel-title"
          @click.stop
        >

          <!-- ── HEADER ───────────────────────────────────────────────── -->
          <div class="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 px-5 py-3 flex-shrink-0">

            <!-- Row 1: icon + title + CloseDot -->
            <div class="flex items-center gap-3">
              <!-- Cost Engineering icon — keyed glyph [Cost→Value] using bracket + arrow notation -->
              <span
                class="flex-shrink-0 text-amber-400 font-mono font-bold leading-none select-none"
                :style="{ fontSize: '18px' }"
                aria-hidden="true"
                title="Cost Engineering: Design to [Cost · Value · Constraint]"
              >[$→*]</span>

              <div class="flex-1 min-w-0">
                <h2
                  id="ce-panel-title"
                  class="text-[15px] font-bold text-white leading-snug"
                >Cost Engineering Tool</h2>
                <p class="text-[10px] text-amber-300/80 leading-snug mt-0.5">
                  Design to [Cost · Value · Constraint]&nbsp;—&nbsp;Gilb Cost Engineering
                </p>
              </div>

              <!-- CloseDot at END of flex header (CloseDot rule — size lg for visibility) -->
              <CloseDot
                variant="on-dark"
                size="lg"
                aria-label="Close Cost Engineering Tool"
                title="Close [$→]"
                @click="emit('close')"
              />
            </div>

            <!-- Row 2: mode tabs -->
            <div class="mt-3 flex items-center">
              <div class="rounded-lg p-1 bg-slate-800 flex gap-1">
                <button
                  type="button"
                  :class="[
                    'px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                    mode === 'static'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700',
                  ]"
                  title="Static (Upfront) — set cost targets before Evo Steps begin"
                  @click="mode = 'static'"
                >Static (Upfront)</button>
                <button
                  type="button"
                  :class="[
                    'px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                    mode === 'dynamic'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700',
                  ]"
                  title="Dynamic (Evo Step) — per-step cost vs value tracking"
                  @click="mode = 'dynamic'"
                >Dynamic (Evo Step)</button>
              </div>
              <span v-if="usingDemoData" class="ml-3 text-[10px] text-amber-300/70 italic">
                Demo data — load a Spec to use live values
              </span>
            </div>
          </div>

          <!-- ── SCROLLABLE BODY ──────────────────────────────────────── -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 bg-white relative"
            inner-class="h-full p-5 space-y-6"
            fade-from="white"
          >

            <!-- ════════════════════════════════════════════════════════
                 TAB 1: STATIC — Upfront Design to Cost
                 ════════════════════════════════════════════════════════ -->
            <template v-if="mode === 'static'">

              <!-- ── BIG CTA: Analyse with Claudian ───────────────── -->
              <div class="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-950 to-slate-900 p-4 shadow-lg">
                <div class="flex items-start gap-4">
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-amber-300 leading-snug">
                      Analyse Value Achievability within Budget
                    </p>
                    <p class="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
                      Claudian will assess each V. entry against your R. budgets and C. constraints,
                      rank by V/C ratio, and cite Gilb Cost Engineering principles.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg
                           bg-amber-500 hover:bg-amber-400 text-white font-bold text-[12px]
                           shadow-lg shadow-amber-900/50 transition-all duration-150
                           focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900
                           active:scale-[0.97]"
                    title="Build a Claudian analysis prompt from your Spec data — copy and paste into Claudian"
                    aria-label="Open Claudian analysis prompt"
                    @click="analysisOpen = !analysisOpen"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="8" cy="8" r="6.5" />
                      <line x1="8" y1="5" x2="8" y2="8.5" />
                      <circle cx="8" cy="11" r="0.6" fill="currentColor" stroke="none" />
                    </svg>
                    {{ analysisOpen ? 'Hide prompt ↑' : 'Open Claudian analysis ↓' }}
                  </button>
                </div>

                <!-- Expandable Claudian prompt panel -->
                <Transition name="analysis-expand">
                  <div v-if="analysisOpen" class="mt-4 pt-4 border-t border-amber-700/40">
                    <div class="flex items-center justify-between mb-2 gap-2">
                      <p class="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                        Claudian Analysis Prompt — built from your Spec
                      </p>
                      <button
                        type="button"
                        class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md
                               text-[11px] font-bold transition-all duration-150
                               focus:outline-none focus:ring-2 focus:ring-amber-400"
                        :class="promptCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-white'"
                        title="Copy this prompt — paste into Claudian for full analysis"
                        @click="copyAnalysisPrompt"
                      >
                        <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" aria-hidden="true">
                          <rect x="4" y="1" width="9" height="10" rx="1.5" />
                          <path d="M1 4h2.5v9h7V11" />
                        </svg>
                        {{ promptCopied ? '✓ Copied!' : 'Copy prompt' }}
                      </button>
                    </div>
                    <!-- Prompt text — scrollable, selectable -->
                    <pre
                      class="text-[10px] text-amber-100/80 leading-relaxed font-mono whitespace-pre-wrap
                             bg-black/40 rounded-lg p-3 max-h-[220px] overflow-y-auto select-text border border-amber-800/40"
                    >{{ claudianPrompt }}</pre>
                    <p class="text-[10px] text-amber-400/60 mt-2 leading-relaxed">
                      Copy → paste into Claudian → get per-Value achievability ratings,
                      V/C priority ranking, and actionable Design-to-Cost recommendations.
                    </p>
                  </div>
                </Transition>
              </div>

              <!-- Description -->
              <div class="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p class="text-[12px] text-amber-900 leading-relaxed">
                  <strong>Upfront Design-to-Cost:</strong> Define cost targets for the whole plan
                  before Evo Steps begin. For each Value and Resource entry, specify what cost is
                  acceptable. Design Solutions to fit within those constraints.
                </p>
              </div>

              <!-- ── Design-to-Cost Targets (R. entries) ──────────── -->
              <section>
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                  <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                    Design-to-Cost Targets · Resource Entries
                  </h3>
                  <span class="ml-auto text-[10px] text-slate-400 font-medium">{{ resources.length }} entries</span>
                </div>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-gradient-to-r from-amber-50 to-slate-50">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[190px]">Resource ID</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Scale</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-emerald-700 w-[130px]">
                        <PlanguageTerm term="Budget" class="text-emerald-700 font-semibold" :show-icon="false" />
                      </th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-amber-700 w-[130px]">
                        <!-- Tolerable (Max) label removed 2026-06-07: "(Max)" was wrong doctrine.
                             Tolerable for Resources = MINIMUM allocation for non-failure, not a
                             consumption cap. PlanguageTerm hover explains the correct definition. -->
                        <PlanguageTerm term="Tolerable" class="text-amber-700 font-semibold" :show-icon="false" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in resources"
                      :key="r.id"
                      class="hover:bg-amber-50/60 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 font-mono text-[11px] text-amber-800 font-bold">{{ r.id }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-600 text-[11px]">{{ (r as any).scale || '—' }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-emerald-700 font-bold">{{ rBudget(r) || '—' }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-red-600 font-semibold">{{ (r as any).tolerable || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── Value Delivery within Budget (V. entries) ───── -->
              <section>
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-2 h-2 rounded-full bg-violet-500" aria-hidden="true" />
                  <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                    Value Delivery within Budget · V. Entries
                  </h3>
                  <span class="ml-auto text-[10px] text-slate-400 font-medium">{{ values.length }} entries</span>
                </div>
                <p class="text-[11px] text-slate-500 mb-2">
                  Click <strong>Analyse →</strong> on any row for a Claudian prompt scoped to that Value,
                  or use the <em>Open Claudian analysis</em> button above to analyse all at once.
                </p>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-gradient-to-r from-violet-50 to-slate-50">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[200px]">Value ID</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Goal Level</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Tolerable</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[140px]">Analysis</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="v in values"
                      :key="v.id"
                      class="hover:bg-violet-50/40 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 font-mono text-[11px] text-violet-800 font-bold leading-snug">{{ v.id }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-emerald-700 font-semibold text-[11px]">{{ v.goal || '—' }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-500 text-[11px]">{{ v.tolerable || '—' }}</td>
                      <td class="border border-slate-200 px-2 py-1.5">
                        <!-- Demo mode: show pre-computed estimate -->
                        <span
                          v-if="usingDemoData"
                          class="text-[11px] font-semibold"
                          :class="v.id === 'V.SystemPerformance' ? 'text-emerald-700' : 'text-amber-700'"
                        >
                          {{ v.id === 'V.SystemPerformance' ? '87% of Goal' : '72% of Goal' }}
                        </span>
                        <!-- Live spec: real "Analyse" button -->
                        <button
                          v-else
                          type="button"
                          class="flex items-center gap-1 px-2.5 py-1 rounded-md border
                                 text-[11px] font-bold transition-all duration-100
                                 bg-amber-50 border-amber-400 text-amber-800
                                 hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-sm
                                 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1
                                 active:scale-[0.97]"
                          :title="`Analyse ${v.id} — opens Claudian prompt pre-scoped to this Value`"
                          :aria-label="`Analyse ${v.id} with Claudian`"
                          @click="analysisOpen = true"
                        >
                          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor"
                               stroke-width="2" stroke-linecap="round" aria-hidden="true">
                            <path d="M2 6 C2 3.2 3.8 1 6 1 S10 3.2 10 6 8.2 11 6 11 2 8.8 2 6z" />
                            <line x1="6" y1="5" x2="6" y2="7.5" />
                            <circle cx="6" cy="3.5" r="0.5" fill="currentColor" stroke="none" />
                          </svg>
                          Analyse →
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── Constraint Check (C. entries with cost implications) -->
              <section>
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide">
                    Constraint Check · C. Entries with Cost Implications
                  </h3>
                  <span class="ml-auto text-[10px] text-slate-400 font-medium">{{ constraints.length }} entries</span>
                </div>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-gradient-to-r from-red-50 to-slate-50">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[200px]">Constraint ID</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[80px]">Binary</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Cost Implication</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="c in constraints"
                      :key="c.id"
                      class="hover:bg-red-50/40 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 font-mono text-[11px] text-red-800 font-bold">{{ c.id }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-center">
                        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold border border-red-300">✓</span>
                      </td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-600 text-[11px]">{{ constraintCostNote(c.id) }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── Gilb Citation (Static) ─────────────────────── -->
              <section class="border-t border-slate-200 pt-4">
                <p class="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">Source: Gilb Cost Engineering</p>
                <BookCoverChip
                  title="Cost Engineering"
                  short-title="Cost Eng"
                  :author="'Tom Gilb'"
                  year="2005"
                  cover-color="#1e3a5f"
                  research-gate-url="https://www.researchgate.net/profile/Tom-Gilb"
                />
              </section>

            </template>

            <!-- ════════════════════════════════════════════════════════
                 TAB 2: DYNAMIC — Evo Step Design to Cost
                 ════════════════════════════════════════════════════════ -->
            <template v-else>

              <!-- Description -->
              <div class="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p class="text-[12px] text-amber-900 leading-relaxed">
                  <strong>Per-Evo-Step Design-to-Cost:</strong> Track planned vs actual Cost,
                  Value delivery, and Constraint compliance for each Evo Step. VDT-style ranking:
                  prioritise steps with highest Value/Cost ratio.
                </p>
              </div>

              <!-- ── Per-Step Cost Table ──────────────────────────── -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Evo Step Cost vs Value Delivered
                </h3>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-slate-100">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Evo Step</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[110px]">Planned Cost</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[120px]">Value Delivered</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[110px]">Constraint Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in DEMO_STEPS"
                      :key="row.step"
                      class="hover:bg-amber-50/60 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 text-slate-800 font-medium">{{ row.step }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-700 font-mono">{{ row.plannedCost }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-violet-700 font-semibold">{{ row.valueDelivered }}</td>
                      <td
                        class="border border-slate-200 px-3 py-2 font-semibold"
                        :class="constraintStatusClass(row.constraintStatus)"
                      >{{ row.constraintStatus }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── VDT Ranking ─────────────────────────────────── -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  VDT Ranking&nbsp;·&nbsp;Value / Cost Ratio
                  <span class="ml-2 text-[10px] text-slate-400 font-normal normal-case tracking-normal">
                    ≥2.0 = Excellent&nbsp;·&nbsp;1.0–1.9 = Good&nbsp;·&nbsp;&lt;1.0 = Poor
                  </span>
                </h3>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="row in [...DEMO_STEPS].sort((a, b) => b.vcRatio - a.vcRatio)"
                    :key="row.step + '-vdt'"
                    class="flex items-center gap-3 rounded-md border px-3 py-2"
                    :class="ratioColorClass(row.vcRatio)"
                  >
                    <span class="font-mono text-[13px] font-bold w-10 text-right flex-shrink-0">
                      {{ row.vcRatio.toFixed(1) }}
                    </span>
                    <span class="text-[11px] font-semibold flex-shrink-0 w-16">
                      {{ ratioLabel(row.vcRatio) }}
                    </span>
                    <span class="text-[11px] flex-1 min-w-0 truncate">{{ row.step }}</span>
                  </div>
                </div>
              </section>

              <!-- ── DEEP Principle note ─────────────────────────── -->
              <section class="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  <strong class="text-slate-800">DEEP Principle:</strong> Resources can be traded
                  off across Evo Steps — spending more on an early infrastructure step may unlock
                  substantially higher Value in later steps. A low V/C ratio in one step does not
                  automatically mean de-prioritise it: evaluate the cascade effect on dependent steps.
                </p>
              </section>

              <!-- ── Gilb Citation (Dynamic) ────────────────────── -->
              <section class="border-t border-slate-200 pt-4">
                <p class="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">Source: Gilb Cost Engineering</p>
                <BookCoverChip
                  title="Cost Engineering"
                  short-title="Cost Eng"
                  :author="'Tom Gilb'"
                  year="2005"
                  cover-color="#1e3a5f"
                  research-gate-url="https://www.researchgate.net/profile/Tom-Gilb"
                />
              </section>

            </template>

            <!-- ── Bottom Close mirror (DD-014 — Top-and-Bottom Navigation Mirror) -->
            <div class="border-t border-slate-200 pt-4 flex justify-end">
              <button
                type="button"
                class="px-5 py-2 rounded-lg bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-700 transition-colors"
                title="Close Cost Engineering Tool [$→]"
                @click="emit('close')"
              >Close [$→]</button>
            </div>

          </ScrollContainer>
          <!-- end ScrollContainer -->

        </div>
        <!-- end panel -->

      </div>
      <!-- end fixed overlay -->
    </Transition>
  </Teleport>
</template>

<style scoped>
.ce-panel-enter-active,
.ce-panel-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.ce-panel-enter-from,
.ce-panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

/* Analysis prompt expand/collapse */
.analysis-expand-enter-active,
.analysis-expand-leave-active {
  transition: opacity 200ms ease, max-height 250ms ease;
  overflow: hidden;
  max-height: 400px;
}
.analysis-expand-enter-from,
.analysis-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
