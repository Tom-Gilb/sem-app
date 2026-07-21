<!--
  DecisionMapperPanel.vue — AI-powered structured decision analysis using Planguage.

  Full-screen rose panel at z-[600]. User describes a decision and its options.
  AI builds a decision matrix (options × Planguage criteria), models each option
  as F./V./C. entries, recommends the best, and can compare options against an
  external plan. Redo the analysis at any time with new instructions.

  Four tabs: Matrix | Planguage Model | Per-Option | Compare

  UI Rules satisfied:
    ScrollContainer rule  — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule         — CloseDot variant="on-dark" at END of header.
    Single-Surface rule   — caller registers 'decisionMapper'.
    Define-by-Selection   — no select-none on body content.
    DD-009 Zero-Training  — all buttons have title= attribute.
    z-[600]               — within Major surfaces tier.
    Static Tailwind only  — no runtime class concatenation.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, watch, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import PlanIdentityBand from './PlanIdentityBand.vue'  // r41 v96 (Tom Gilb 2026-06-16 "do that" — Phase 3 sweep)
import {
  useDecisionMapper,
} from '../composables/useDecisionMapper'
import type { DecisionOption, DecisionCriterion, PlanguagizedEntry } from '../composables/useDecisionMapper'
import { useAmuseLifecycle } from '../composables/useAmuseLifecycle'
import { exportArtefact } from '../composables/useExportShared'
import {
  renderDecisionMapperHtml,
  renderDecisionMapperPlain,
  type DecisionExportState,
} from '../composables/useDecisionMapperExport'

const props = defineProps<{
  /** r41 v96 — identity band fields (Phase 3 sweep). */
  planName?: string
  planOwner?: string
  planVersion?: string
  generatedAt?: string
}>()

const emit = defineEmits<{
  close: []
  /** User clicked the Agents button — App.vue should close this panel and open AgentMenuPanel. */
  'open-agents': []
  /** r41 v96 — bubble history selection. */
  'select-history': [versionId: string]
}>()

void props

// ── Composable ────────────────────────────────────────────────────────────────

const {
  decisions,
  selectedDecisionId,
  selectedDecision,
  analyseDecision,
  redoDecision,
  compareWithPlan,
  removeDecision,
  selectDecision,
  loadSampleBuildVsBuy,
  loadSampleDeployment,
} = useDecisionMapper()

// ── Tab state ─────────────────────────────────────────────────────────────────

type Tab = 'matrix' | 'planguage' | 'per-option' | 'compare'
const activeTab = ref<Tab>('matrix')

// ── Input state ───────────────────────────────────────────────────────────────

const inputQuestion = ref('')
const inputContext = ref('')
const showInputForm = ref(false)
const redoInstruction = ref('')
const comparisonText = ref('')

// ── Abort ─────────────────────────────────────────────────────────────────────

let _abortCtl: AbortController | null = null

async function triggerAnalyse(): Promise<void> {
  const q = inputQuestion.value.trim()
  const c = inputContext.value.trim()
  if (!q) return
  _abortCtl?.abort()
  _abortCtl = new AbortController()
  inputQuestion.value = ''
  inputContext.value = ''
  showInputForm.value = false
  await analyseDecision(q, c, _abortCtl.signal)
}

async function triggerRedo(): Promise<void> {
  const d = selectedDecision.value
  if (!d) return
  const inst = redoInstruction.value.trim()
  if (!inst) return
  _abortCtl?.abort()
  _abortCtl = new AbortController()
  const instCopy = inst
  redoInstruction.value = ''
  await redoDecision(d.id, instCopy, _abortCtl.signal)
}

async function triggerCompare(): Promise<void> {
  const d = selectedDecision.value
  if (!d) return
  const txt = comparisonText.value.trim()
  if (!txt) return
  _abortCtl?.abort()
  _abortCtl = new AbortController()
  await compareWithPlan(d.id, txt, _abortCtl.signal)
}

// ── Score cell colour helpers (static class maps) ─────────────────────────────

const SCORE_CELL_CLASS: Record<string, string> = {
  blue:    'bg-blue-500',
  blueMed: 'bg-blue-400',
  amber:   'bg-amber-400',
  orange:  'bg-orange-400',
}

function scoreCellBg(score: number): string {
  if (score >= 75) return SCORE_CELL_CLASS.blue
  if (score >= 60) return SCORE_CELL_CLASS.blueMed
  if (score >= 40) return SCORE_CELL_CLASS.amber
  return SCORE_CELL_CLASS.orange
}

// ── Weighted value score for an option ───────────────────────────────────────

function weightedScore(option: DecisionOption, valueCriteria: DecisionCriterion[]): number {
  if (valueCriteria.length === 0) return option.valueScore
  let weighted = 0
  let totalWeight = 0
  for (const criterion of valueCriteria) {
    const score = option.scores[criterion.id] ?? 50
    const effectiveScore = criterion.direction === 'lower-better' ? 100 - score : score
    weighted += effectiveScore * criterion.weight
    totalWeight += criterion.weight
  }
  return totalWeight > 0 ? Math.round(weighted / totalWeight) : option.valueScore
}

// ── Computed splits ───────────────────────────────────────────────────────────

const valueCriteria = computed<DecisionCriterion[]>(() =>
  (selectedDecision.value?.criteria ?? []).filter(c => c.type === 'value'),
)
const constraintCriteria = computed<DecisionCriterion[]>(() =>
  (selectedDecision.value?.criteria ?? []).filter(c => c.type === 'constraint'),
)

// ── Entry type badge ──────────────────────────────────────────────────────────

const ENTRY_TYPE_CLASSES: Record<string, string> = {
  F: 'bg-orange-500 text-white',
  V: 'bg-blue-500 text-white',
  C: 'bg-fuchsia-600 text-white',
  R: 'bg-sky-600 text-white',
  S: 'bg-violet-500 text-white',
}
const ENTRY_CARD_CLASSES: Record<string, string> = {
  F: 'bg-orange-50 border-orange-100',
  V: 'bg-blue-50 border-blue-100',
  C: 'bg-fuchsia-50 border-fuchsia-100',
  R: 'bg-sky-50 border-sky-100',
  S: 'bg-violet-50 border-violet-100',
}
function entryTypeBadge(type: string): string {
  return ENTRY_TYPE_CLASSES[type] ?? 'bg-slate-400 text-white'
}
function entryCardBg(type: string): string {
  return ENTRY_CARD_CLASSES[type] ?? 'bg-slate-50 border-slate-200'
}

// ── Score circle ──────────────────────────────────────────────────────────────

const CIRCLE_BORDER: Record<string, string> = {
  blue:    'border-blue-400 bg-blue-50',
  blueMed: 'border-blue-400 bg-blue-50',
  amber:   'border-amber-400 bg-amber-50',
  orange:  'border-orange-400 bg-orange-50',
}
const CIRCLE_TEXT: Record<string, string> = {
  blue:    'text-blue-700',
  blueMed: 'text-blue-700',
  amber:   'text-amber-600',
  orange:  'text-orange-600',
}
function circleKey(score: number): string {
  if (score >= 75) return 'blue'
  if (score >= 60) return 'blueMed'
  if (score >= 40) return 'amber'
  return 'orange'
}
function circleBorder(score: number): string {
  return CIRCLE_BORDER[circleKey(score)] ?? CIRCLE_BORDER.orange
}
function circleText(score: number): string {
  return CIRCLE_TEXT[circleKey(score)] ?? CIRCLE_TEXT.orange
}

// ── Tab bar active/inactive classes ──────────────────────────────────────────

function tabClass(tab: Tab): string {
  return activeTab.value === tab
    ? 'border-rose-600 text-rose-700 bg-white border-b-2'
    : 'border-transparent text-slate-500 hover:text-rose-600 hover:bg-white/60 border-b-2'
}

// ── Rule 8: Loading-state (4-element: spinner + elapsed + progress + amuse) ──

const DECISION_WISDOM = [
  {
    emoji: '⚖️',
    title: 'Values Before Verdicts',
    text: 'Planguage separates what you want (Values, Constraints) from which option delivers it. Defining criteria before scoring options eliminates confirmation bias in decision-making.',
    ref: 'Competitive Engineering, Gilb 2005 — Chapter 7',
  },
  {
    emoji: '🎯',
    title: 'Weighted Criteria Capture Trade-offs',
    text: 'No option is perfect across all criteria. A weighted score surfaces the option that best satisfies your priorities — not just the one that excels on a single dimension.',
    ref: 'Value Delivery Thinking, Gilb 2018',
  },
  {
    emoji: '📐',
    title: 'Constraints Are Binary, Values Are Scalar',
    text: 'In Planguage, a Constraint is either met or violated — there is no partial credit. A Value has a scale and a goal. The best decision meets ALL constraints, then maximises value.',
    ref: 'Tom Gilb, Planguage Standard — Constraint entry rules',
  },
  {
    emoji: '🔄',
    title: 'Decisions Are Revisable',
    text: 'A good decision process is one you can redo. As context changes — new options emerge, constraints shift, stakeholders are identified — re-running the matrix with fresh criteria is not indecision; it is learning.',
    ref: 'EVO 2024, Gilb — Step 9: Learn',
  },
  {
    emoji: '🧩',
    title: 'Options Are Partial Planguage Models',
    text: 'Each decision option is modelled as a mini Planguage spec: F. (what it does), V. (what value it delivers), C. (what constraints it respects). Comparing options this way makes trade-offs explicit and auditable.',
    ref: 'gilb.com/tomtwin — Decision entry type specification',
  },
  {
    emoji: '📊',
    title: 'Feasibility Is a Separate Dimension',
    text: 'An option with the highest value score may be infeasible to implement. The decision matrix tracks feasibility independently so you can weigh "ideal" vs "achievable" consciously — not accidentally.',
    ref: 'Competitive Engineering, Gilb 2005 — S. entry: Solution feasibility',
  },
  {
    emoji: '👥',
    title: 'Stakeholders Own the Criteria Weights',
    text: 'Criteria weights are not technical judgements — they represent stakeholder priorities. Who cares about speed vs cost vs quality? Explicitly assigning weights forces alignment conversations that "gut feel" decisions skip.',
    ref: 'Stakeholder Engineering, Gilb 2004',
  },
  {
    emoji: '📋',
    title: 'Write Decisions Down, In Planguage',
    text: 'A decision not written in a structured form is a guess. Writing the question, options, criteria, and recommendation creates an audit trail that lets future teams understand WHY a choice was made — not just what was chosen.',
    ref: 'gilb.com — "Write It In Planguage" talk, 2023',
  },
] as const

const dmElapsed           = ref(0)
const dmSimulatedProgress = ref(0)
const dmActiveWisdomIdx   = ref(0)

let _dmElapsedTimer: ReturnType<typeof setInterval> | null = null
let _dmWisdomTimer:  ReturnType<typeof setInterval> | null = null
let _dmAnimStart = 0

function _startDecisionLoadingAnim(): void {
  _dmAnimStart = Date.now()
  dmElapsed.value = 0; dmSimulatedProgress.value = 0
  if (_dmElapsedTimer) { clearInterval(_dmElapsedTimer); _dmElapsedTimer = null }
  if (_dmWisdomTimer)  { clearInterval(_dmWisdomTimer);  _dmWisdomTimer  = null }
  _dmElapsedTimer = setInterval(() => {
    const secs = Math.round((Date.now() - _dmAnimStart) / 1000)
    dmElapsed.value = secs
    dmSimulatedProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 45)) * 100))
  }, 250)
  _dmWisdomTimer = setInterval(() => {
    dmActiveWisdomIdx.value = (dmActiveWisdomIdx.value + 1) % DECISION_WISDOM.length
  }, 10_000)  // Tom 2026-06-09: 10s card advance
}

function _stopDecisionLoadingAnim(): void {
  if (_dmElapsedTimer) { clearInterval(_dmElapsedTimer); _dmElapsedTimer = null }
  if (_dmWisdomTimer)  { clearInterval(_dmWisdomTimer);  _dmWisdomTimer  = null }
  dmSimulatedProgress.value = 100
}

watch(
  () => selectedDecision.value?.analysisStatus === 'analysing',
  (nowAnalysing) => {
    if (nowAnalysing) { dmActiveWisdomIdx.value = 0; _startDecisionLoadingAnim() }
    else              { _stopDecisionLoadingAnim() }
  },
)

onUnmounted(() => _stopDecisionLoadingAnim())

// ── Export · Full Model (Tom Gilb 2026-06-06 universal Export-on-all-windows rule) ──
async function exportDecisionMapper(): Promise<void> {
  const d = selectedDecision.value
  if (!d) return
  const state: DecisionExportState = {
    planName:            d.title || 'Decision Analysis',
    versionLabel:        new Date(d.createdAt).toLocaleDateString('en-AU'),
    question:            d.question,
    context:             d.context,
    recommendation:      d.recommendation,
    recommendedOptionId: d.recommendedOptionId,
    criteria:            d.criteria.map(c => ({
      id: c.id,
      label: c.label,
      type: c.type,
      weight: c.weight,
      description: c.description,
      scale: c.scale,
      direction: c.direction,
    })),
    options:             d.options.map(o => ({
      id: o.id,
      label: o.label,
      description: o.description,
      scores: { ...o.scores },
      constraintsMet: { ...o.constraintsMet },
      planguageEntries: o.planguageEntries.map(e => ({
        id: e.id, type: e.type, tag: e.tag,
        description: e.description, details: e.details, confidence: e.confidence,
      })),
      pros: [...o.pros],
      cons: [...o.cons],
      feasibilityScore: o.feasibilityScore,
      valueScore: o.valueScore,
      recommendation: o.recommendation,
    })),
    planguageModel:      d.planguageModel.map(e => ({
      id: e.id, type: e.type, tag: e.tag,
      description: e.description, details: e.details, confidence: e.confidence,
    })),
    comparisonText:      d.comparisonText,
    comparisonAnalysis:  d.comparisonAnalysis,
  }
  // Mailto-No-Self-To SUPREME (Tom Gilb 2026-06-16): Tom is the SENDER when he
  // clicks Export — recipient is someone else he chooses. To: must be EMPTY.
  await exportArtefact({
    htmlText:     renderDecisionMapperHtml(state),
    plainText:    renderDecisionMapperPlain(state),
    subject:      `Decisions Agent · ${d.title || 'Decision Analysis'} · ${new Date().toLocaleDateString('en-AU')}`,
    artefactName: 'Decisions Agent',
    to: '',
  })
}

// ── Continue Amuse Me (useAmuseLifecycle) ──────────────────────────────────
// Keeps the wisdom carousel visible for 10 s after analysis completes, with
// a blinking "Continue" button so the user can extend it indefinitely.
const _dmIsAnalysing = computed(() => selectedDecision.value?.analysisStatus === 'analysing')
const {
  amuseActive:    dmAmuseActive,
  amuseFinishing: dmAmuseFinishing,
  amuseCountdown: dmAmuseCountdown,
  extendAmuse:    dmExtendAmuse,
} = useAmuseLifecycle(_dmIsAnalysing)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[598] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <!-- translateZ(0) forces GPU compositing so this layer correctly sits above
         the Plan Crest shimmer animation in Safari (same fix as ContractHub). -->
    <div
      class="fixed inset-0 z-[600] flex flex-col"
      style="transform: translateZ(0);"
      role="dialog"
      aria-modal="true"
      aria-label="Decisions Agent — Planguage decision analysis and matrix"
    >

      <!-- ROSE HEADER -->
      <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-rose-700 to-rose-600 shrink-0 select-none">
        <span class="text-xl" aria-hidden="true">🎯</span>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-white leading-tight tracking-tight">Decisions Agent</h2>
          <p class="text-[11px] text-white/60 leading-tight mt-0.5">Planguage Decision Analysis &amp; Matrix</p>
        </div>

        <!-- Decision selector (if multiple) -->
        <select
          v-if="decisions.length > 1"
          :value="selectedDecisionId ?? ''"
          class="shrink-0 bg-rose-800/50 text-white text-xs rounded-lg px-2 py-1.5 border border-white/20 focus:outline-none focus:ring-1 focus:ring-white/40 max-w-[200px] truncate"
          title="Switch between decision analyses"
          @change="(e) => selectDecision((e.target as HTMLSelectElement).value || null)"
        >
          <option
            v-for="d in decisions"
            :key="d.id"
            :value="d.id"
          >
            {{ d.title }}
          </option>
        </select>

        <!-- New analysis button -->
        <button
          v-if="decisions.length > 0"
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
          title="Analyse a new decision — describe the question and context, AI builds the matrix"
          @click="showInputForm = !showInputForm"
        >
          + New
        </button>

        <!-- 🦾 Agents navigation — lets the user jump to any other agent without
             going back to the main screen first. Tom 2026-05-31: "has no agents button". -->
        <button
          type="button"
          class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                 bg-white/15 hover:bg-white/30 text-white text-xs font-semibold
                 border border-white/20 hover:border-white/50 transition-colors"
          title="Open Agent Menu — switch to another agent (Maria, Contracts, Models, Stakeholders, Evo, Decisions, Plan Agent)"
          aria-label="Open Agent Menu"
          @click="emit('open-agents')"
        >
          <span aria-hidden="true">🦾</span> Agents
        </button>

        <!-- ⬇ Export · Tom Gilb 2026-06-06 universal Export-on-all-windows rule.
             Mailto-No-Self-To SUPREME — to:'' (Tom is the sender). -->
        <button
          v-if="selectedDecision"
          type="button"
          class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                 bg-amber-400/30 hover:bg-amber-400/50 text-white text-xs font-semibold
                 border border-amber-200/50 hover:border-amber-100 transition-colors"
          title="⬇ Export Decision Analysis — opens preview window with 100% of the analysis (decision matrix, per-option Planguage models, AI recommendation, Glossary footnote). Copies colourful HTML to clipboard. Opens Mail (To: empty — you choose recipient)."
          aria-label="Export Decision Analysis — preview window + clipboard + Mail"
          @click="exportDecisionMapper"
        >
          ⬇ Export
        </button>

        <CloseDot
          variant="on-dark"
          aria-label="Close Decisions Agent — return to main workspace"
          title="Close Decisions Agent — return to the main planning workspace"
          @click="emit('close')"
        />
      </div>

      <!-- Plan identity band (r41 v96 — Phase 3 sweep) — rose-toned for Decisions. -->
      <PlanIdentityBand
        :plan-name="props.planName"
        :plan-owner="props.planOwner"
        :plan-version="props.planVersion"
        :generated-at="props.generatedAt"
        :theme="{ bg: 'bg-rose-700', borderTop: 'border-rose-500', label: 'text-rose-100', pickerBorder: 'border-rose-300' }"
        @select-history="(id: string) => emit('select-history', id)"
      />

      <!-- NEW DECISION FORM (slide-in) -->
      <div
        v-if="showInputForm"
        class="shrink-0 border-b border-rose-100 bg-rose-50 px-6 py-4"
      >
        <p class="text-xs font-semibold text-rose-700 mb-2">New decision analysis</p>
        <input
          v-model="inputQuestion"
          type="text"
          class="w-full text-sm border border-rose-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white placeholder-slate-400 mb-2"
          placeholder="What decision do you need to make?"
          title="Enter the decision question — e.g. 'Should we build or buy our core platform?'"
        />
        <textarea
          v-model="inputContext"
          rows="2"
          class="w-full text-xs border border-rose-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white placeholder-slate-400 mb-2"
          placeholder="Background, constraints, and context…"
          title="Enter context to help the AI build a relevant decision model"
        />
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            :disabled="!inputQuestion.trim()"
            title="Analyse this decision — AI builds options, criteria matrix, and recommendation (takes ~30s)"
            @click="triggerAnalyse"
          >
            🎯 Analyse Decision
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs transition-colors"
            title="Close without analysing"
            @click="showInputForm = false"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div class="flex-1 min-h-0 bg-white flex flex-col">

        <!-- ── MODE A: EMPTY — no decisions yet ── -->
        <template v-if="decisions.length === 0">
          <div class="flex-1 flex items-center justify-center px-8">
            <div class="max-w-lg w-full text-center">
              <div class="text-4xl mb-4" aria-hidden="true">🎯</div>
              <h3 class="text-lg font-semibold text-slate-700 mb-2">Analyse Any Decision</h3>
              <p class="text-sm text-slate-500 leading-relaxed mb-6">
                Describe a decision and AI builds a scored matrix — options × Planguage criteria.
                Each option is modelled as F./V./C. entries. A recommendation is made and you can
                compare against any external plan.
              </p>

              <div class="text-left mb-6">
                <input
                  v-model="inputQuestion"
                  type="text"
                  class="w-full text-sm border border-rose-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white placeholder-slate-400 mb-3"
                  placeholder="What decision do you need to make?"
                  title="Enter the decision question to analyse"
                />
                <textarea
                  v-model="inputContext"
                  rows="3"
                  class="w-full text-xs border border-rose-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white placeholder-slate-400 mb-3"
                  placeholder="Background, constraints, and context…"
                  title="Enter background context to guide the AI analysis"
                />
                <button
                  type="button"
                  class="w-full px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  :disabled="!inputQuestion.trim()"
                  title="Analyse this decision — AI builds a Planguage decision matrix with options, criteria, and recommendation"
                  @click="triggerAnalyse"
                >
                  🎯 Analyse Decision
                </button>
              </div>

              <!-- Sample buttons -->
              <div class="flex items-center gap-3 justify-center">
                <p class="text-xs text-slate-400">Or try a sample:</p>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold transition-colors"
                  title="Load the Build vs Buy vs Hybrid decision sample — pre-analysed with 3 options and 5 criteria"
                  @click="loadSampleBuildVsBuy"
                >
                  Build vs Buy Sample
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold transition-colors"
                  title="Load the SaaS vs Self-Hosted deployment decision sample — pre-analysed"
                  @click="loadSampleDeployment"
                >
                  Deployment Decision Sample
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ── Analysing state (Rule 8: spinner + elapsed + progress + wisdom) ── -->
        <!-- dmAmuseActive keeps this block mounted for 10 s post-analysis (Continue Amuse Me) -->
        <template v-else-if="(selectedDecision && selectedDecision.analysisStatus === 'analysing') || dmAmuseActive">
          <div class="flex-1 flex items-center justify-center px-8">
            <div class="max-w-md w-full text-center">
              <!-- Spinner + elapsed + progress: only while actually analysing -->
              <template v-if="selectedDecision && selectedDecision.analysisStatus === 'analysing'">
                <!-- 1. Spinner -->
                <svg class="animate-spin h-10 w-10 text-rose-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <!-- Heading + elapsed -->
                <p class="text-sm font-semibold text-rose-700 mb-0.5">Building decision matrix…</p>
                <p class="text-xs text-slate-400 mb-4">{{ dmElapsed }}s elapsed — AI is creating options, criteria, and weighted scores</p>
                <!-- 2. Progress bar -->
                <div
                  class="w-full bg-rose-100 rounded-full h-2 mb-6"
                  role="progressbar"
                  :aria-valuenow="dmSimulatedProgress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    class="bg-rose-500 h-2 rounded-full transition-all duration-300"
                    :style="{ width: dmSimulatedProgress + '%' }"
                  />
                </div>
              </template>
              <!-- 3. Wisdom card (always visible while block is mounted) -->
              <div class="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-left shadow-sm min-h-[140px]">
                <div class="flex items-start gap-3">
                  <span class="text-2xl shrink-0 mt-0.5" aria-hidden="true">{{ DECISION_WISDOM[dmActiveWisdomIdx].emoji }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-rose-800 mb-1.5">{{ DECISION_WISDOM[dmActiveWisdomIdx].title }}</p>
                    <p class="text-xs text-slate-600 leading-relaxed">{{ DECISION_WISDOM[dmActiveWisdomIdx].text }}</p>
                    <p class="text-[10px] text-rose-400 mt-2 italic">{{ DECISION_WISDOM[dmActiveWisdomIdx].ref }}</p>
                  </div>
                </div>
                <!-- Continue Amuse Me: blinking button + countdown shown after analysis ends -->
                <div v-if="dmAmuseFinishing" class="mt-3 pt-3 border-t border-rose-200/60 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    class="animate-pulse rounded-full bg-rose-600/90 hover:bg-rose-700 px-5 py-1.5 text-xs font-bold text-white shadow-md transition-colors"
                    title="Continue reading — click to keep the wisdom card visible; it will disappear on its own if you don't click"
                    @click="dmExtendAmuse"
                  >
                    ✨ Click to Continue Amuse Me
                  </button>
                  <p class="text-[10px] text-slate-400 tabular-nums">
                    Disappearing in {{ dmAmuseCountdown }}s if you don't click
                  </p>
                </div>
              </div>
              <!-- 4. Dot navigation -->
              <div class="flex items-center justify-center gap-1.5 mt-3" role="tablist" aria-label="Decision wisdom cards">
                <button
                  v-for="(_, i) in DECISION_WISDOM"
                  :key="i"
                  type="button"
                  :class="[
                    'h-1.5 rounded-full transition-all duration-200',
                    i === dmActiveWisdomIdx ? 'bg-rose-500 w-3' : 'bg-rose-200 hover:bg-rose-300 w-1.5',
                  ]"
                  :aria-label="`Go to wisdom card ${i + 1} of ${DECISION_WISDOM.length}`"
                  :aria-selected="i === dmActiveWisdomIdx"
                  role="tab"
                  @click="dmActiveWisdomIdx = i"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- ── Error state ── -->
        <template v-else-if="selectedDecision && selectedDecision.analysisStatus === 'error'">
          <div class="flex-1 flex items-center justify-center text-center px-8">
            <div>
              <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
              <h4 class="text-sm font-semibold text-orange-600 mb-1">Analysis Failed</h4>
              <p class="text-xs text-slate-500 max-w-sm mb-4">{{ selectedDecision.analysisError }}</p>
              <button
                type="button"
                class="mr-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
                title="Remove this failed analysis"
                @click="selectedDecision && removeDecision(selectedDecision.id)"
              >
                Remove
              </button>
            </div>
          </div>
        </template>

        <!-- ── MODE B: Decision loaded ── -->
        <template v-else-if="selectedDecision && selectedDecision.analysisStatus === 'done'">

          <!-- Tab bar -->
          <div class="shrink-0 flex border-b border-rose-100 bg-rose-50 select-none">
            <button
              type="button"
              :class="['px-5 py-3 text-sm font-semibold transition-colors', tabClass('matrix')]"
              title="Matrix tab — decision matrix showing all options × criteria scores"
              @click="activeTab = 'matrix'"
            >
              Matrix
            </button>
            <button
              type="button"
              :class="['px-5 py-3 text-sm font-semibold transition-colors', tabClass('planguage')]"
              title="Planguage Model tab — Function / Value / Constraint Specs representing the decision space"
              @click="activeTab = 'planguage'"
            >
              Planguage Model
            </button>
            <button
              type="button"
              :class="['px-5 py-3 text-sm font-semibold transition-colors', tabClass('per-option')]"
              title="Per-Option tab — detailed pros, cons, and Planguage entries for each option"
              @click="activeTab = 'per-option'"
            >
              Per-Option
            </button>
            <button
              type="button"
              :class="['px-5 py-3 text-sm font-semibold transition-colors', tabClass('compare')]"
              title="Compare tab — compare how each option affects an external plan"
              @click="activeTab = 'compare'"
            >
              Compare
            </button>
          </div>

          <div class="flex-1 min-h-0">

            <!-- ── TAB 1: MATRIX ── -->
            <template v-if="activeTab === 'matrix'">
              <ScrollContainer outer-class="h-full relative" inner-class="px-6 py-5 space-y-5">

                <!-- Decision question -->
                <div class="p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <p class="text-xs font-bold text-rose-600 uppercase tracking-wide mb-1 select-none">Decision Question</p>
                  <p class="text-sm font-semibold text-slate-800 leading-relaxed">{{ selectedDecision.question }}</p>
                  <p v-if="selectedDecision.context" class="text-xs text-slate-500 mt-1 leading-relaxed">{{ selectedDecision.context }}</p>
                </div>

                <!-- Criteria legend -->
                <div>
                  <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 select-none">Criteria</p>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-for="criterion in selectedDecision.criteria"
                      :key="criterion.id"
                      class="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px]"
                      :class="criterion.type === 'constraint' ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' : 'bg-blue-50 border-blue-200 text-blue-700'"
                      :title="`${criterion.label}: ${criterion.description}${criterion.scale ? ' — Scale: ' + criterion.scale : ''}`"
                    >
                      <span class="font-bold">{{ criterion.type === 'constraint' ? 'C' : 'V' }}</span>
                      <span>{{ criterion.label }}</span>
                      <span v-if="criterion.type === 'value'" class="font-semibold text-blue-500">{{ Math.round(criterion.weight * 100) }}%</span>
                    </div>
                  </div>
                </div>

                <!-- Decision matrix table -->
                <div class="overflow-x-auto rounded-xl border border-slate-200">
                  <table class="w-full text-xs border-collapse">
                    <thead>
                      <tr class="bg-rose-50">
                        <th class="text-left px-3 py-2 font-bold text-rose-700 border-b border-slate-200 min-w-[120px]">Option</th>
                        <th
                          v-for="criterion in valueCriteria"
                          :key="criterion.id"
                          class="text-center px-2 py-2 font-bold text-blue-700 border-b border-slate-200 min-w-[70px]"
                          :title="`${criterion.label} — ${criterion.description}${criterion.scale ? ', Scale: ' + criterion.scale : ''}, ${criterion.direction}`"
                        >
                          {{ criterion.label }}
                        </th>
                        <th
                          v-for="criterion in constraintCriteria"
                          :key="criterion.id"
                          class="text-center px-2 py-2 font-bold text-fuchsia-700 border-b border-slate-200 min-w-[60px]"
                          :title="`${criterion.label} — constraint: ${criterion.description}`"
                        >
                          {{ criterion.label }}
                        </th>
                        <th class="text-center px-2 py-2 font-bold text-slate-600 border-b border-slate-200 min-w-[70px]">Value Score</th>
                        <th class="text-center px-2 py-2 font-bold text-slate-600 border-b border-slate-200 min-w-[60px]">Feasibility</th>
                        <th class="text-center px-2 py-2 border-b border-slate-200 min-w-[30px]" aria-label="Recommended indicator"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(option, oi) in selectedDecision.options"
                        :key="option.id"
                        :class="[
                          'border-b border-slate-100 transition-colors',
                          option.id === selectedDecision.recommendedOptionId ? 'bg-rose-50/50' : oi % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                        ]"
                      >
                        <!-- Option label -->
                        <td class="px-3 py-2 font-semibold text-slate-800">{{ option.label }}</td>

                        <!-- Value criteria scores -->
                        <td
                          v-for="criterion in valueCriteria"
                          :key="criterion.id"
                          class="px-2 py-2 text-center"
                        >
                          <div class="flex flex-col items-center gap-0.5">
                            <span
                              :class="['px-2 py-0.5 rounded text-white text-[10px] font-bold min-w-[32px] text-center', scoreCellBg(option.scores[criterion.id] ?? 50)]"
                              :title="`${criterion.label}: ${option.scores[criterion.id] ?? 50}/100`"
                            >
                              {{ option.scores[criterion.id] ?? 50 }}
                            </span>
                          </div>
                        </td>

                        <!-- Constraint criteria -->
                        <td
                          v-for="criterion in constraintCriteria"
                          :key="criterion.id"
                          class="px-2 py-2 text-center"
                        >
                          <span
                            :class="[
                              'text-sm font-bold',
                              option.constraintsMet[criterion.id] !== false ? 'text-blue-600' : 'text-orange-500',
                            ]"
                            :title="`${criterion.label}: ${option.constraintsMet[criterion.id] !== false ? 'met' : 'NOT met'}`"
                          >
                            {{ option.constraintsMet[criterion.id] !== false ? '✓' : '✗' }}
                          </span>
                        </td>

                        <!-- Weighted value score -->
                        <td class="px-2 py-2 text-center">
                          <span
                            :class="[
                              'font-black text-sm',
                              option.id === selectedDecision.recommendedOptionId ? 'text-rose-700' : 'text-slate-700',
                            ]"
                          >
                            {{ weightedScore(option, valueCriteria) }}
                          </span>
                        </td>

                        <!-- Feasibility -->
                        <td class="px-2 py-2 text-center">
                          <span :class="['text-xs font-semibold', circleText(option.feasibilityScore)]">
                            {{ option.feasibilityScore }}
                          </span>
                        </td>

                        <!-- Recommendation star -->
                        <td class="px-2 py-2 text-center">
                          <span
                            v-if="option.id === selectedDecision.recommendedOptionId"
                            class="text-rose-600 font-bold"
                            title="Recommended option"
                          >⭐</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Recommendation card -->
                <div class="p-4 rounded-xl bg-rose-50 border-2 border-rose-200">
                  <p class="text-xs font-bold text-rose-600 uppercase tracking-wide mb-2 select-none">AI Recommendation</p>
                  <p class="text-sm text-rose-900 leading-relaxed">{{ selectedDecision.recommendation }}</p>
                </div>

                <!-- Redo Analysis section -->
                <div class="border-t border-slate-200 pt-4">
                  <p class="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 select-none">Redo Analysis</p>
                  <div
                    v-if="selectedDecision.redoStatus === 'redoing'"
                    class="flex items-center gap-2 mb-2"
                  >
                    <svg class="animate-spin h-3 w-3 text-rose-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p class="text-xs text-rose-600">Re-analysing decision…</p>
                  </div>
                  <textarea
                    v-model="redoInstruction"
                    rows="2"
                    class="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder-slate-400 mb-2"
                    placeholder="Add a new option... weight innovation higher... add a cost constraint..."
                    title="Describe how to update the analysis — AI will apply your instruction and rebuild the matrix"
                    :disabled="selectedDecision.redoStatus === 'redoing'"
                  />
                  <button
                    type="button"
                    class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    :disabled="!redoInstruction.trim() || selectedDecision.redoStatus === 'redoing'"
                    title="Re-run the analysis with your new instructions — AI updates the matrix and recommendation"
                    @click="triggerRedo"
                  >
                    🔄 Redo Analysis
                  </button>
                </div>

                <!-- Sample shortcut at bottom -->
                <div class="border-t border-slate-200 pt-4">
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-2 select-none">Load a sample decision</p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-xs px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold transition-colors"
                      title="Load Build vs Buy vs Hybrid decision sample"
                      @click="loadSampleBuildVsBuy"
                    >
                      Build vs Buy
                    </button>
                    <button
                      type="button"
                      class="text-xs px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold transition-colors"
                      title="Load SaaS vs Self-Hosted deployment decision sample"
                      @click="loadSampleDeployment"
                    >
                      Deployment Decision
                    </button>
                  </div>
                </div>

              </ScrollContainer>
            </template>

            <!-- ── TAB 2: PLANGUAGE MODEL ── -->
            <template v-else-if="activeTab === 'planguage'">
              <ScrollContainer outer-class="h-full relative" inner-class="px-6 py-5 space-y-4">
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                  This is the Planguage model of the DECISION SPACE — the values and constraints that apply regardless of which option is chosen. Individual option-specific entries appear in the Per-Option tab.
                </div>

                <div class="space-y-2">
                  <div
                    v-for="entry in selectedDecision.planguageModel"
                    :key="entry.id"
                    :class="['rounded-xl border p-3', entryCardBg(entry.type)]"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <span :class="['text-[10px] font-black px-1.5 py-0.5 rounded', entryTypeBadge(entry.type)]">{{ entry.tag }}</span>
                      <p class="text-xs font-semibold text-slate-800 flex-1 min-w-0">{{ entry.description }}</p>
                    </div>
                    <p v-if="entry.details" class="text-[11px] text-slate-500 leading-relaxed">{{ entry.details }}</p>
                  </div>

                  <div v-if="selectedDecision.planguageModel.length === 0" class="text-center py-8 text-slate-400 text-xs">
                    No decision-space Planguage entries generated
                  </div>
                </div>

                <!-- Copy button -->
                <div>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold transition-colors"
                    title="Copy all Planguage entries to clipboard as formatted text"
                    @click="() => {
                      const text = selectedDecision?.planguageModel
                        .map((e: PlanguagizedEntry) => `${e.tag}: ${e.description}${e.details ? '\n  ' + e.details : ''}`)
                        .join('\n') ?? ''
                      navigator.clipboard.writeText(text)
                    }"
                  >
                    📋 Copy Planguage
                  </button>
                </div>
              </ScrollContainer>
            </template>

            <!-- ── TAB 3: PER-OPTION ── -->
            <template v-else-if="activeTab === 'per-option'">
              <ScrollContainer outer-class="h-full relative" inner-class="px-6 py-5 space-y-5">
                <div
                  v-for="option in selectedDecision.options"
                  :key="option.id"
                  class="rounded-xl border border-slate-200 overflow-hidden bg-white"
                >
                  <!-- Option header -->
                  <div
                    :class="[
                      'px-4 py-3 flex items-center gap-3',
                      option.id === selectedDecision.recommendedOptionId ? 'bg-rose-50 border-b border-rose-200' : 'bg-slate-50 border-b border-slate-200',
                    ]"
                  >
                    <p class="text-sm font-bold text-slate-800 flex-1">{{ option.label }}</p>
                    <span
                      v-if="option.id === selectedDecision.recommendedOptionId"
                      class="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded"
                    >
                      ⭐ Recommended
                    </span>
                    <!-- Score circles -->
                    <div class="flex items-center gap-2">
                      <div class="flex flex-col items-center">
                        <div :class="['w-9 h-9 rounded-full border-2 flex items-center justify-center', circleBorder(option.valueScore)]">
                          <span :class="['text-xs font-black', circleText(option.valueScore)]">{{ option.valueScore }}</span>
                        </div>
                        <p class="text-[8px] text-slate-400 mt-0.5 select-none">Value</p>
                      </div>
                      <div class="flex flex-col items-center">
                        <div :class="['w-9 h-9 rounded-full border-2 flex items-center justify-center', circleBorder(option.feasibilityScore)]">
                          <span :class="['text-xs font-black', circleText(option.feasibilityScore)]">{{ option.feasibilityScore }}</span>
                        </div>
                        <p class="text-[8px] text-slate-400 mt-0.5 select-none">Feasibility</p>
                      </div>
                    </div>
                  </div>

                  <!-- Option body -->
                  <div class="px-4 py-3 space-y-3">
                    <p class="text-xs text-slate-600 leading-relaxed">{{ option.description }}</p>
                    <p class="text-xs text-slate-500 italic">{{ option.recommendation }}</p>

                    <!-- Pros + Cons -->
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <p class="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-1 select-none">Pros</p>
                        <ul class="space-y-1">
                          <li
                            v-for="(pro, pi) in option.pros"
                            :key="pi"
                            class="text-[11px] text-slate-600 flex items-start gap-1.5"
                          >
                            <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            {{ pro }}
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p class="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1 select-none">Cons</p>
                        <ul class="space-y-1">
                          <li
                            v-for="(con, ci) in option.cons"
                            :key="ci"
                            class="text-[11px] text-slate-600 flex items-start gap-1.5"
                          >
                            <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                            {{ con }}
                          </li>
                        </ul>
                      </div>
                    </div>

                    <!-- Planguage entries for this option -->
                    <div v-if="option.planguageEntries.length > 0">
                      <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 select-none">Planguage Entries (this option)</p>
                      <div class="space-y-1.5">
                        <div
                          v-for="entry in option.planguageEntries"
                          :key="entry.id"
                          :class="['rounded-lg border p-2', entryCardBg(entry.type)]"
                        >
                          <div class="flex items-center gap-1.5">
                            <span :class="['text-[9px] font-black px-1 py-0.5 rounded', entryTypeBadge(entry.type)]">{{ entry.tag }}</span>
                            <p class="text-[11px] font-semibold text-slate-700 flex-1 min-w-0">{{ entry.description }}</p>
                          </div>
                          <p v-if="entry.details" class="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{{ entry.details }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollContainer>
            </template>

            <!-- ── TAB 4: COMPARE ── -->
            <template v-else-if="activeTab === 'compare'">
              <ScrollContainer outer-class="h-full relative" inner-class="px-6 py-5 space-y-4">
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                  Compare how each decision option would affect an existing plan. Paste the plan text below and AI will analyse how each option advances or hinders the plan's F./V./C. goals.
                </div>

                <!-- Upload zone -->
                <div v-if="!selectedDecision.comparisonAnalysis">
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5">External Plan Text</label>
                  <textarea
                    v-model="comparisonText"
                    rows="6"
                    class="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder-slate-400 mb-3"
                    placeholder="Paste an external plan, strategy document, or Planguage spec here…"
                    title="Paste external plan text to compare against the decision options"
                  />
                  <button
                    type="button"
                    class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    :disabled="!comparisonText.trim()"
                    title="Compare how each option affects the external plan — AI analyses alignment with Function / Value / Constraint Specs"
                    @click="triggerCompare"
                  >
                    Compare →
                  </button>
                </div>

                <!-- Comparison results -->
                <div v-if="selectedDecision.comparisonAnalysis">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-xs font-bold text-slate-700 uppercase tracking-wide select-none">Comparison Analysis</p>
                    <button
                      type="button"
                      class="text-[10px] text-rose-600 hover:text-rose-800 font-semibold"
                      title="Clear comparison and load a new plan for comparison"
                      @click="comparisonText = ''; selectedDecision && (selectedDecision.comparisonAnalysis = undefined)"
                    >
                      Clear & reload
                    </button>
                  </div>
                  <div class="prose prose-sm max-w-none">
                    <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{{ selectedDecision.comparisonAnalysis }}</p>
                  </div>
                </div>

                <!-- Compare with another sample plan shortcut -->
                <div class="border-t border-slate-200 pt-3">
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1.5 select-none">Or compare against a sample plan</p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-xs px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold transition-colors"
                      title="Use the Hotel CO₂ plan as the comparison target"
                      @click="comparisonText = 'The Grand Alpine Hotel aims to reduce carbon emissions by 50% by 2030 while maintaining 5-star guest experience ratings above 4.8/5. We must comply with EU Green Deal regulations. Budget for green initiatives: €2M over 3 years.'"
                    >
                      Hotel CO₂ Plan
                    </button>
                    <button
                      type="button"
                      class="text-xs px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold transition-colors"
                      title="Use the Habit Tracker brief as the comparison target"
                      @click="comparisonText = 'We are building a mobile app to help users build better daily habits. Key features: habit tracking, reminders, streaks, social sharing. Must work offline. Target: 100K users year 1.'"
                    >
                      Habit Tracker Plan
                    </button>
                  </div>
                </div>
              </ScrollContainer>
            </template>

          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>
