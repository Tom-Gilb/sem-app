<!--
  EvoCritiquerPanel.vue — AI-powered Evo methodology health check and critique.

  Full-screen violet panel at z-[600]. Reads the current SEM plan from usePlanModel.
  Three tabs: Health Check (10 dimensions), Step Critique (9 Evo steps), Value Delivery
  (deep dive on steps 6–9).

  Canonical Evo cycle (Tom Gilb, EVO 2024 book, Chapter 2, p.19):
    Planning Cycle (1–5): Stakeholders, Values, Solutions, Decompose, Prioritize
    Value Delivery Cycle (6–9): Develop, Deliver, Measure, Learn

  UI Rules satisfied:
    ScrollContainer rule  — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule         — CloseDot variant="on-dark" at END of header.
    Single-Surface rule   — caller registers 'evoCritiquer'.
    Define-by-Selection   — no select-none on body content.
    DD-009 Zero-Training  — all buttons have title= attribute.
    z-[600]               — below z-[700] SelectionDefiner.
    Static Tailwind only  — no runtime class concatenation.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, watch, onUnmounted } from 'vue'
import { useAmuseLifecycle } from '../composables/useAmuseLifecycle'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  useEvoCritiquer,
  HEALTH_DIMENSION_DEFS,
  scoreToGrade,
} from '../composables/useEvoCritiquer'
import type { HealthDimension, EvoStepCritique, HealthFinding, ImprovementTask } from '../composables/useEvoCritiquer'
import { usePlanModel, activatePlanModel, type PlanModel } from '../composables/usePlanModel'

const emit = defineEmits<{
  close: []
  'open-agents': []
  /** Request the parent to open the full plan history browser (ModelHistory). */
  'open-history': []
}>()

// ── Composables ───────────────────────────────────────────────────────────────

const { critiqueResult, critiqueLoading, critiqueError, runEvoCritique } = useEvoCritiquer()
const { currentModel: planModel, allModels } = usePlanModel()

// ── Plan picker (shown when no plan is loaded) ────────────────────────────────
// Uses reactive allModels (not static listRecentPlans) so plans added after
// mount are immediately visible. AND-token search across name + tag + owners + planners.

const planSearchQ = ref('')

const _planTokens = computed(() =>
  planSearchQ.value.toLowerCase().split(/\s+/).filter(Boolean)
)

const filteredRecent = computed((): PlanModel[] => {
  const tokens = _planTokens.value
  return allModels.value.filter(m => {
    if (tokens.length === 0) return true
    const hay = [
      m.name,
      m.tag,
      m.version,
      m.specSource ?? '',
      ...(m.owners   ?? []).map(o => o.name),
      ...(m.planners ?? []).map(p => p.name),
    ].join(' ').toLowerCase()
    return tokens.every(t => hay.includes(t))
  })
})

function loadRecent(model: PlanModel): void {
  activatePlanModel(model)
  planSearchQ.value = ''
}

// ── Tab state ─────────────────────────────────────────────────────────────────

type Tab = 'health' | 'steps' | 'value-delivery'
const activeTab = ref<Tab>('health')

// ── Collapsible sections ──────────────────────────────────────────────────────

const openDimensions = ref<Set<string>>(new Set())
const openSteps      = ref<Set<number>>(new Set())

function toggleDimension(id: string): void {
  if (openDimensions.value.has(id)) {
    openDimensions.value.delete(id)
  } else {
    openDimensions.value.add(id)
  }
  // Force Vue to detect the Set change
  openDimensions.value = new Set(openDimensions.value)
}

function toggleStep(idx: number): void {
  if (openSteps.value.has(idx)) {
    openSteps.value.delete(idx)
  } else {
    openSteps.value.add(idx)
  }
  openSteps.value = new Set(openSteps.value)
}

// ── Abort controller ──────────────────────────────────────────────────────────

let abortCtl: AbortController | null = null

async function runAnalysis(): Promise<void> {
  if (!planModel.value) return
  abortCtl?.abort()
  abortCtl = new AbortController()
  await runEvoCritique(planModel.value.spec, planModel.value, abortCtl.signal)
}

// ── Loading animation: elapsed secs, simulated %, wisdom carousel ─────────────
// Mirrors the pattern in MariaAgentBoard: elapsed + simulated progress tick
// every 250 ms; wisdom cards rotate every 8 s. Stopped on unmount or when
// critiqueLoading becomes false.

const EVO_WISDOM = [
  {
    emoji: '🔄',
    title: 'Evo Is Cyclic, Not Linear',
    text: 'The 9 Evo steps form two interlocking sub-cycles: Planning (1–5) and Value Delivery (6–9). You can re-enter any step at any time — that IS Evo.',
    ref: 'Tom Gilb, EVO 2024 Ch.2 p.19',
  },
  {
    emoji: '📐',
    title: 'Values Before Solutions',
    text: 'Never specify a solution before you have quantified the values it must deliver. Solutions are hypotheses; Values are the acceptance test.',
    ref: 'Competitive Engineering, Gilb 2005',
  },
  {
    emoji: '📏',
    title: 'The Scale Principle',
    text: 'If you can\'t measure it, you can\'t manage it. Every Value needs a Scale (what to measure) and a Meter (how to measure it) before you set goals.',
    ref: 'Planguage Glossary — Scale, Meter',
  },
  {
    emoji: '⚡',
    title: 'Evo Steps Deliver Real Value',
    text: 'Each Evo Step must move a measurable stakeholder value. Steps that produce only deliverables — but no measured value change — are not Evo Steps.',
    ref: 'Tom Gilb, EVO 2024 Ch.3',
  },
  {
    emoji: '🎯',
    title: 'Tolerable vs Goal',
    text: 'The gap between Tolerable and Goal is your "value improvement space." Tolerable = minimally acceptable. Goal = stakeholder delight. The gap drives prioritisation.',
    ref: 'Competitive Engineering, Gilb 2005',
  },
  {
    emoji: '👥',
    title: 'Stakeholders Include the Inanimate',
    text: 'Data, systems, laws, and regulations are stakeholders too. GDPR is a stakeholder. A database has needs. Their requirements are always Constraints — binary compliance.',
    ref: 'Tom Gilb, 2026-05-15',
  },
  {
    emoji: '🏆',
    title: 'Success = All Values Within All Constraints',
    text: 'Partial delivery is not success. Every named Value must reach at least Tolerable level, and every Constraint respected, before an Evo Step qualifies as successful.',
    ref: 'Tom Gilb, SUCCESS book',
  },
  {
    emoji: '📊',
    title: 'Measure to Learn, Not to Report',
    text: 'Step 8 (Measure) and Step 9 (Learn) are distinct. Measure = collect data. Learn = update the plan. You cannot Learn from data you have not Measured.',
    ref: 'Deming letter to Tom Gilb, 18 May 1991',
  },
  {
    emoji: '🔍',
    title: 'The Full 9-Step Cycle',
    text: '"My Evo cycle has nine. AI means we no longer have to pander to the masses and their need for simplification. For the first time in history we can afford to DO IT RIGHT."',
    ref: 'Tom Gilb, 2026-05-23',
  },
] as const

const elapsed           = ref(0)
const simulatedProgress = ref(0)
const activeWisdomIdx   = ref(0)

// Post-loading amuse lifecycle for Tab 1 wisdom carousel
const {
  amuseActive:    evoAmuseActive,
  amuseFinishing: evoAmuseFinishing,
  amuseCountdown: evoAmuseCountdown,
  extendAmuse:    evoExtendAmuse,
} = useAmuseLifecycle(critiqueLoading)

let _elapsedTimer: ReturnType<typeof setInterval> | null = null
let _wisdomTimer:  ReturnType<typeof setInterval> | null = null
let _animStart = 0

function _startLoadingAnimation(): void {
  _animStart = Date.now()
  elapsed.value = 0
  simulatedProgress.value = 0
  if (_elapsedTimer) { clearInterval(_elapsedTimer); _elapsedTimer = null }
  if (_wisdomTimer)  { clearInterval(_wisdomTimer);  _wisdomTimer  = null }

  _elapsedTimer = setInterval(() => {
    const secs = Math.round((Date.now() - _animStart) / 1000)
    elapsed.value = secs
    // Asymptotic toward 95%: reaches ~50% at ~30s, ~80% at ~55s, ~95% at ~100s.
    simulatedProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 45)) * 100))
  }, 250)

  _wisdomTimer = setInterval(() => {
    activeWisdomIdx.value = (activeWisdomIdx.value + 1) % EVO_WISDOM.length
  }, 8_000)
}

function _stopLoadingAnimation(): void {
  if (_elapsedTimer) { clearInterval(_elapsedTimer); _elapsedTimer = null }
  if (_wisdomTimer)  { clearInterval(_wisdomTimer);  _wisdomTimer  = null }
  simulatedProgress.value = 100
}

// Watch critiqueLoading: start animation when loading begins, stop when done.
watch(critiqueLoading, (nowLoading) => {
  if (nowLoading) {
    activeWisdomIdx.value = 0
    _startLoadingAnimation()
  } else {
    _stopLoadingAnimation()
  }
})

onUnmounted(() => {
  _stopLoadingAnimation()
})

// ── Score colour helpers (static class maps) ──────────────────────────────────

const SCORE_BAR_CLASS: Record<string, string> = {
  blue:    'bg-blue-500',
  blueMed: 'bg-blue-400',
  amber:   'bg-amber-400',
  orange:  'bg-orange-500',
}

function scoreBarColor(score: number): string {
  if (score >= 75) return SCORE_BAR_CLASS.blue
  if (score >= 60) return SCORE_BAR_CLASS.blueMed
  if (score >= 40) return SCORE_BAR_CLASS.amber
  return SCORE_BAR_CLASS.orange
}

const SCORE_CIRCLE_CLASS: Record<string, string> = {
  blue:    'text-blue-600',
  blueMed: 'text-blue-500',
  amber:   'text-amber-500',
  orange:  'text-orange-600',
}

function scoreCircleColor(score: number): string {
  if (score >= 75) return SCORE_CIRCLE_CLASS.blue
  if (score >= 60) return SCORE_CIRCLE_CLASS.blueMed
  if (score >= 40) return SCORE_CIRCLE_CLASS.amber
  return SCORE_CIRCLE_CLASS.orange
}

// ── Grade badge classes (static) ──────────────────────────────────────────────

const GRADE_CLASS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-sky-100 text-sky-800',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-rose-100 text-rose-700',
}

// ── Severity dot classes (static) ─────────────────────────────────────────────

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'bg-rose-500',
  major:    'bg-orange-400',
  minor:    'bg-amber-400',
  positive: 'bg-blue-500',
}

// ── Priority pill classes (static) ────────────────────────────────────────────

const PRIORITY_CLASS: Record<string, string> = {
  now:   'bg-orange-100 text-orange-700',
  soon:  'bg-amber-100 text-amber-700',
  later: 'bg-slate-100 text-slate-600',
}

// ── Evo step badge colour (planning vs value-delivery) ────────────────────────

const STEP_PHASE_CLASS: Record<string, string> = {
  planning:        'bg-indigo-100 text-indigo-700',
  'value-delivery':'bg-violet-100 text-violet-700',
}

// ── Value delivery step labels ────────────────────────────────────────────────

const VD_STEP_LABELS: Record<number, string> = {
  6: 'Develop',
  7: 'Deliver',
  8: 'Measure',
  9: 'Learn',
}

function vdLabel(evoStep: number): string {
  return VD_STEP_LABELS[evoStep] ?? `Step ${evoStep}`
}

// ── Summary stats ─────────────────────────────────────────────────────────────

const totalTasks = computed<number>(() => {
  if (!critiqueResult.value) return 0
  return critiqueResult.value.dimensions.reduce((sum, d) => sum + d.tasks.length, 0)
})

const criticalCount = computed<number>(() => {
  if (!critiqueResult.value) return 0
  return critiqueResult.value.dimensions
    .flatMap(d => d.findings)
    .filter(f => f.severity === 'critical').length
})

const refCount = computed<number>(() => {
  if (!critiqueResult.value) return 0
  return critiqueResult.value.dimensions.reduce((sum, d) => sum + d.references.length, 0)
})

// ── Value delivery steps (6–9) from stepCritiques ────────────────────────────

const vdStepCritiques = computed<EvoStepCritique[]>(() => {
  if (!critiqueResult.value) return []
  return critiqueResult.value.stepCritiques.filter(s => s.stepIndex >= 6)
})
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
    <div
      class="fixed inset-0 z-[600] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Evo Critiquer — Evo health check and value delivery review"
    >
      <!-- VIOLET HEADER -->
      <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-violet-800 to-violet-700 shrink-0 select-none">
        <span class="text-xl" aria-hidden="true">🔬</span>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-white leading-tight tracking-tight">Evo Critiquer</h2>
          <p class="text-[11px] text-white/60 leading-tight mt-0.5">
            Evo Health Check &amp; Value Delivery Review
            <span v-if="planModel" class="ml-2 bg-white/15 px-1.5 py-0.5 rounded text-[10px] text-white/80">
              {{ planModel.name }}
            </span>
          </p>
        </div>

        <!-- Run Analysis button -->
        <button
          type="button"
          :disabled="critiqueLoading || !planModel"
          :class="[
            'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
            critiqueLoading
              ? 'bg-violet-600/60 text-white/60 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-500 text-white',
          ]"
          title="Run AI analysis — reviews plan against all 9 Evo cycle steps. Takes ~30 seconds."
          @click="runAnalysis"
        >
          <svg
            v-if="critiqueLoading"
            class="animate-spin h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{{ critiqueLoading ? 'Analyzing…' : '▶ Run Analysis' }}</span>
        </button>

        <button
          type="button"
          class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                 bg-white/15 hover:bg-white/30 text-white text-xs font-semibold
                 border border-white/20 hover:border-white/50 transition-colors"
          title="Open Agent Menu — switch to another agent without returning to main screen"
          aria-label="Open Agent Menu"
          @click="emit('open-agents')"
        >
          <span aria-hidden="true">🦾</span> Agents
        </button>
        <CloseDot
          variant="on-dark"
          aria-label="Close Evo Critiquer — return to main workspace"
          title="Close Evo Critiquer — return to main planning workspace"
          @click="emit('close')"
        />
      </div>

      <!-- TAB BAR -->
      <div class="flex shrink-0 border-b border-violet-100 bg-violet-50 select-none">
        <button
          type="button"
          :class="[
            'px-5 py-3 text-sm font-semibold transition-colors border-b-2',
            activeTab === 'health'
              ? 'border-violet-600 text-violet-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-violet-600 hover:bg-white/60',
          ]"
          title="Health Check — scores for all 10 Evo health dimensions"
          @click="activeTab = 'health'"
        >
          Health Check
        </button>
        <button
          type="button"
          :class="[
            'px-5 py-3 text-sm font-semibold transition-colors border-b-2',
            activeTab === 'steps'
              ? 'border-violet-600 text-violet-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-violet-600 hover:bg-white/60',
          ]"
          title="Step Critique — detailed review of each of the 9 Evo steps"
          @click="activeTab = 'steps'"
        >
          Step Critique
        </button>
        <button
          type="button"
          :class="[
            'px-5 py-3 text-sm font-semibold transition-colors border-b-2',
            activeTab === 'value-delivery'
              ? 'border-violet-600 text-violet-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-violet-600 hover:bg-white/60',
          ]"
          title="Value Delivery Focus — deep dive on Evo steps 6–9 (Develop, Deliver, Measure, Learn)"
          @click="activeTab = 'value-delivery'"
        >
          Value Delivery
        </button>
      </div>

      <!-- BODY -->
      <div class="flex-1 min-h-0 bg-white">

        <!-- ── TAB 1: HEALTH CHECK ── -->
        <template v-if="activeTab === 'health'">
          <!-- No result yet -->
          <div
            v-if="!critiqueResult && !critiqueLoading"
            class="h-full flex items-center justify-center text-center px-8"
          >
            <div>
              <div class="text-5xl mb-4" aria-hidden="true">🔬</div>
              <h3 class="text-lg font-semibold text-slate-700 mb-2">No Analysis Yet</h3>
              <p class="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
                Run an analysis to review your plan against all 9 steps of the Evo cycle.
                The AI will score 10 health dimensions, critique each planning step, and
                give a deep dive on the Value Delivery cycle.
              </p>
              <!-- No plan loaded — show reactive plan picker -->
              <div v-if="!planModel" class="w-full max-w-md mx-auto mt-2">
                <!-- Header row: label + Full History button -->
                <div class="flex items-center justify-between mb-2">
                  <p class="text-xs font-semibold text-amber-700">
                    No active plan loaded — choose a plan:
                  </p>
                  <button
                    type="button"
                    class="text-[10px] font-semibold text-violet-600 hover:text-violet-800 underline-offset-2 hover:underline transition-colors"
                    title="Open full plan history browser — search, filter, and load any saved plan"
                    @click="emit('open-history')"
                  >🗂️ Full History</button>
                </div>
                <!-- Search -->
                <input
                  v-model="planSearchQ"
                  type="search"
                  placeholder="Search by name, tag, or owner…"
                  class="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-slate-400 mb-2"
                  title="Search all saved plans by name, tag, or owner — click a plan to load it"
                />
                <!-- Empty state -->
                <div
                  v-if="allModels.length === 0"
                  class="text-xs text-slate-400 text-center py-3"
                >
                  No saved plans yet — parse and save a plan in the main workspace first.
                </div>
                <div
                  v-else-if="filteredRecent.length === 0"
                  class="text-xs text-slate-400 text-center py-3"
                >
                  No plans match <em>{{ planSearchQ }}</em> — try a different keyword.
                </div>
                <!-- Plan list — ScrollContainer (ScrollContainer rule) -->
                <ScrollContainer
                  v-else
                  outer-class="relative"
                  inner-class="flex flex-col gap-1.5"
                  :style="{ maxHeight: '11rem' }"
                  :no-pill="true"
                >
                  <button
                    v-for="plan in filteredRecent"
                    :key="plan.id"
                    type="button"
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-50 hover:bg-violet-50 border border-amber-100 hover:border-violet-200 text-left transition-colors"
                    :title="`Load plan: ${plan.name} v${plan.version} — updated ${plan.updatedAt.slice(0, 10)} — single-click to make this the active plan`"
                    @click="loadRecent(plan)"
                  >
                    <span class="text-base shrink-0" aria-hidden="true">{{ plan.workingMode === 'model' ? '🏗️' : '📋' }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold text-slate-800 truncate">{{ plan.name }}</p>
                      <p class="text-[10px] text-slate-400 truncate">
                        v{{ plan.version }} · {{ plan.updatedAt.slice(0, 10) }}
                        <template v-if="(plan.owners ?? []).length > 0">
                          · {{ plan.owners![0].name }}
                        </template>
                      </p>
                    </div>
                    <span class="text-[10px] text-violet-600 font-semibold shrink-0">Load →</span>
                  </button>
                </ScrollContainer>
              </div>
              <button
                type="button"
                :disabled="!planModel"
                class="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold transition-colors"
                title="Run AI Evo analysis — reviews plan against all 9 Evo cycle steps"
                @click="runAnalysis"
              >
                ▶ Run Analysis
              </button>
            </div>
          </div>

          <!-- Loading — bar + % + secs + rotating Evo wisdom cards (amuse)       -->
          <!-- Amuse block persists 10 s after loading via evoAmuseActive.         -->
          <div
            v-else-if="critiqueLoading || evoAmuseActive"
            class="h-full flex flex-col items-center justify-center px-8 py-6 gap-6"
          >
            <!-- Spinner + status: only during active loading -->
            <template v-if="critiqueLoading">
              <div class="flex flex-col items-center gap-3">
                <svg class="animate-spin h-10 w-10 text-violet-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div class="text-center">
                  <p class="text-sm font-semibold text-violet-700">Analyzing plan against the 9-step Evo cycle…</p>
                  <p class="text-xs text-slate-400 mt-0.5">{{ elapsed }}s elapsed · this may take 30–60 seconds</p>
                </div>
              </div>

              <div class="w-full max-w-xs">
                <div class="flex justify-between text-[10px] font-medium text-slate-400 mb-1.5">
                  <span>Progress</span>
                  <span>{{ simulatedProgress }}%</span>
                </div>
                <div class="h-2 bg-violet-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-violet-500 rounded-full transition-all duration-500"
                    :style="{ width: simulatedProgress + '%' }"
                  />
                </div>
              </div>
            </template>

            <!-- Wisdom carousel — persists through loading + 10 s finishing + extended -->
            <div class="w-full max-w-xs bg-violet-50 border border-violet-100 rounded-2xl p-4 shadow-sm">
              <div class="flex items-start gap-3">
                <span class="text-3xl leading-none shrink-0 drop-shadow-sm" aria-hidden="true">{{ EVO_WISDOM[activeWisdomIdx].emoji }}</span>
                <div class="min-w-0">
                  <p class="text-[10px] font-extrabold text-violet-600 uppercase tracking-[0.14em] mb-1 leading-none">{{ EVO_WISDOM[activeWisdomIdx].title }}</p>
                  <p class="text-[12px] text-slate-600 leading-relaxed">{{ EVO_WISDOM[activeWisdomIdx].text }}</p>
                  <p class="text-[10px] text-slate-400 mt-2 italic">— {{ EVO_WISDOM[activeWisdomIdx].ref }}</p>
                </div>
              </div>
              <!-- Dot navigation -->
              <div class="flex justify-center gap-1.5 mt-3" role="tablist" aria-label="Evo wisdom cards">
                <button
                  v-for="(_, i) in EVO_WISDOM"
                  :key="i"
                  type="button"
                  role="tab"
                  :aria-selected="i === activeWisdomIdx"
                  :class="['h-1.5 rounded-full transition-all duration-300 focus:outline-none',
                            i === activeWisdomIdx ? 'w-4 bg-violet-500' : 'w-1.5 bg-violet-200 hover:bg-violet-300']"
                  :title="`Evo insight ${i + 1} of ${EVO_WISDOM.length} — click to read`"
                  @click="activeWisdomIdx = i"
                />
              </div>

              <!-- Post-loading Continue offer -->
              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="opacity-0 translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-150 ease-in"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="evoAmuseFinishing"
                  class="mt-3 pt-3 border-t border-violet-200/60 flex flex-col items-center gap-1.5"
                >
                  <button
                    type="button"
                    class="animate-pulse rounded-full bg-violet-600/90 hover:bg-violet-700 px-5 py-1.5
                           text-xs font-bold text-white shadow-md
                           focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1"
                    title="Continue reading — click to keep the wisdom card visible; it will disappear on its own if you don't click"
                    @click="evoExtendAmuse"
                  >
                    ✨ Click to Continue Amuse Me
                  </button>
                  <p class="text-[10px] text-slate-400 tabular-nums">
                    Disappearing in {{ evoAmuseCountdown }}s if you don't click
                  </p>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Error -->
          <div
            v-else-if="critiqueError && !critiqueResult"
            class="h-full flex items-center justify-center text-center px-8"
          >
            <div>
              <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
              <h4 class="text-sm font-semibold text-orange-600 mb-1">Analysis Failed</h4>
              <p class="text-xs text-slate-500 max-w-sm mb-4">{{ critiqueError }}</p>
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
                title="Retry Evo analysis"
                @click="runAnalysis"
              >
                Retry
              </button>
            </div>
          </div>

          <!-- Results -->
          <ScrollContainer
            v-else-if="critiqueResult"
            outer-class="h-full relative"
            inner-class="px-6 py-5"
          >
            <!-- Overall summary bar -->
            <div class="flex items-start gap-5 p-4 rounded-2xl bg-violet-50 border border-violet-100 mb-6">
              <!-- Score circle -->
              <div class="shrink-0 flex flex-col items-center">
                <div
                  :class="[
                    'w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center',
                    critiqueResult.overallScore >= 75 ? 'border-blue-400 bg-blue-50' :
                    critiqueResult.overallScore >= 60 ? 'border-blue-300 bg-blue-50' :
                    critiqueResult.overallScore >= 40 ? 'border-amber-400 bg-amber-50' :
                    'border-orange-400 bg-orange-50',
                  ]"
                >
                  <span
                    :class="[
                      'text-2xl font-black leading-none',
                      scoreCircleColor(critiqueResult.overallScore),
                    ]"
                  >
                    {{ critiqueResult.overallGrade }}
                  </span>
                  <span
                    :class="[
                      'text-[10px] font-semibold leading-none',
                      scoreCircleColor(critiqueResult.overallScore),
                    ]"
                  >
                    {{ critiqueResult.overallScore }}
                  </span>
                </div>
                <p class="text-[10px] text-slate-400 mt-1 text-center">Overall</p>
              </div>
              <!-- Executive summary -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-700 mb-1">
                  {{ critiqueResult.planTitle }} — Evo Health Report
                </p>
                <p class="text-sm text-slate-600 leading-relaxed">{{ critiqueResult.executiveSummary }}</p>
                <div class="flex items-center gap-3 mt-2 flex-wrap">
                  <span class="text-xs text-slate-400">
                    {{ totalTasks }} tasks ·
                    {{ criticalCount }} critical findings ·
                    {{ refCount }} references
                  </span>
                  <span class="text-xs text-slate-400">
                    Analyzed {{ new Date(critiqueResult.runAt).toLocaleString() }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Dimension rows -->
            <div class="space-y-3">
              <div
                v-for="dim in critiqueResult.dimensions"
                :key="dim.id"
                class="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <!-- Dimension header (clickable to expand) -->
                <button
                  type="button"
                  class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  :title="`${openDimensions.has(dim.id) ? 'Collapse' : 'Expand'} ${dim.label} — ${dim.findings.length} findings, ${dim.tasks.length} tasks`"
                  @click="toggleDimension(dim.id)"
                >
                  <!-- Evo step badges -->
                  <div class="flex items-center gap-1 shrink-0">
                    <span
                      v-for="s in dim.evoSteps"
                      :key="s"
                      class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700"
                    >
                      Evo {{ s }}
                    </span>
                  </div>
                  <!-- Label + summary -->
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-semibold text-slate-800">{{ dim.label }}</span>
                    <p class="text-xs text-slate-500 leading-tight mt-0.5 truncate">{{ dim.summary }}</p>
                  </div>
                  <!-- Score bar -->
                  <div class="w-28 shrink-0">
                    <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        :class="['h-2 rounded-full transition-all duration-300', scoreBarColor(dim.score)]"
                        :style="{ width: `${dim.score}%` }"
                      />
                    </div>
                    <p class="text-[10px] text-slate-400 text-right mt-0.5">{{ dim.score }}/100</p>
                  </div>
                  <!-- Grade badge -->
                  <span :class="['shrink-0 text-sm font-black px-2 py-0.5 rounded', GRADE_CLASS[dim.grade] ?? 'bg-slate-100 text-slate-600']">
                    {{ dim.grade }}
                  </span>
                  <!-- Chevron -->
                  <span class="shrink-0 text-slate-300 text-xs">
                    {{ openDimensions.has(dim.id) ? '▲' : '▼' }}
                  </span>
                </button>

                <!-- Collapsible findings & tasks -->
                <div v-if="openDimensions.has(dim.id)" class="border-t border-slate-100 px-4 py-3 space-y-3">
                  <!-- Full summary -->
                  <p class="text-xs text-slate-600 leading-relaxed">{{ dim.summary }}</p>

                  <!-- Findings -->
                  <div v-if="dim.findings.length > 0">
                    <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Findings</p>
                    <ul class="space-y-1">
                      <li
                        v-for="(finding, fi) in dim.findings"
                        :key="fi"
                        class="flex items-start gap-2 text-xs text-slate-600"
                      >
                        <span
                          :class="['mt-1 w-2 h-2 rounded-full shrink-0', SEVERITY_CLASS[finding.severity] ?? 'bg-slate-300']"
                          :title="`Severity: ${finding.severity}`"
                        />
                        <span>
                          <span v-if="finding.entryRef" class="font-mono text-[10px] bg-slate-100 px-1 rounded mr-1">{{ finding.entryRef }}</span>
                          {{ finding.text }}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <!-- Tasks -->
                  <div v-if="dim.tasks.length > 0">
                    <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Improvement Tasks</p>
                    <ul class="space-y-1.5">
                      <li
                        v-for="(task, ti) in dim.tasks"
                        :key="ti"
                        class="flex items-start gap-2 text-xs"
                      >
                        <span :class="['shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold', PRIORITY_CLASS[task.priority] ?? 'bg-slate-100 text-slate-500']">
                          {{ task.priority }}
                        </span>
                        <span class="text-[10px] font-bold bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded shrink-0">Evo {{ task.evoStep }}</span>
                        <span class="text-slate-600 leading-tight">{{ task.task }}</span>
                      </li>
                    </ul>
                  </div>

                  <!-- References -->
                  <div v-if="dim.references.length > 0">
                    <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">References</p>
                    <ul class="space-y-1">
                      <li
                        v-for="(ref, ri) in dim.references"
                        :key="ri"
                        class="text-xs"
                      >
                        <a
                          :href="ref.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-violet-600 hover:underline"
                          :title="`Open reference: ${ref.title}`"
                        >
                          {{ ref.title }}
                        </a>
                        <span v-if="ref.quote" class="text-slate-400 italic ml-1">"{{ ref.quote }}"</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </ScrollContainer>
        </template>

        <!-- ── TAB 2: STEP CRITIQUE ── -->
        <template v-else-if="activeTab === 'steps'">
          <div
            v-if="!critiqueResult && !critiqueLoading"
            class="h-full flex items-center justify-center text-center px-8"
          >
            <div>
              <p class="text-sm text-slate-500 mb-4">Run the analysis first to see step-by-step critique.</p>
              <button
                type="button"
                :disabled="!planModel"
                class="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold transition-colors"
                title="Run AI Evo analysis"
                @click="runAnalysis"
              >
                ▶ Run Analysis
              </button>
            </div>
          </div>

          <!-- Loading (Rule 8: shares timer state from Tab 1's full loading block) -->
          <div
            v-else-if="critiqueLoading"
            class="h-full flex items-center justify-center px-8"
          >
            <div class="max-w-md w-full text-center">
              <svg class="animate-spin h-8 w-8 text-violet-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-xs text-slate-400 mb-3">{{ elapsed }}s elapsed — analysis in progress</p>
              <div
                class="w-full bg-violet-100 rounded-full h-1.5 mb-4"
                role="progressbar"
                :aria-valuenow="simulatedProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                  :style="{ width: simulatedProgress + '%' }"
                />
              </div>
              <div class="rounded-xl bg-violet-50 border border-violet-200 p-4 text-left">
                <div class="flex items-start gap-2">
                  <span class="text-xl shrink-0 mt-0.5" aria-hidden="true">{{ EVO_WISDOM[activeWisdomIdx].emoji }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-violet-800 mb-1">{{ EVO_WISDOM[activeWisdomIdx].title }}</p>
                    <p class="text-[11px] text-slate-600 leading-relaxed">{{ EVO_WISDOM[activeWisdomIdx].text }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ScrollContainer
            v-else-if="critiqueResult"
            outer-class="h-full relative"
            inner-class="px-6 py-5 space-y-3"
          >
            <!-- Planning cycle label -->
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Planning Cycle (Steps 1–5)</p>

            <div
              v-for="step in critiqueResult.stepCritiques.slice(0, 5)"
              :key="step.stepIndex"
              class="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <button
                type="button"
                class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                :title="`${openSteps.has(step.stepIndex) ? 'Collapse' : 'Expand'} Step ${step.stepIndex}: ${step.stepName}`"
                @click="toggleStep(step.stepIndex)"
              >
                <span class="shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">
                  {{ step.stepIndex }}
                </span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold text-slate-800">{{ step.stepName }}</span>
                  <p class="text-xs text-slate-500 leading-tight mt-0.5 truncate">{{ step.summary }}</p>
                </div>
                <!-- Score circle (small) -->
                <div
                  :class="[
                    'shrink-0 w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center',
                    step.overallScore >= 75 ? 'border-blue-400 bg-blue-50' :
                    step.overallScore >= 60 ? 'border-blue-300 bg-blue-50' :
                    step.overallScore >= 40 ? 'border-amber-400 bg-amber-50' :
                    'border-orange-400 bg-orange-50',
                  ]"
                >
                  <span :class="['text-sm font-black leading-none', scoreCircleColor(step.overallScore)]">
                    {{ scoreToGrade(step.overallScore) }}
                  </span>
                </div>
                <span class="shrink-0 text-slate-300 text-xs">{{ openSteps.has(step.stepIndex) ? '▲' : '▼' }}</span>
              </button>

              <div v-if="openSteps.has(step.stepIndex)" class="border-t border-slate-100 px-4 py-3 space-y-3">
                <p class="text-xs text-slate-600">{{ step.summary }}</p>
                <div v-if="step.findings.length > 0">
                  <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Findings</p>
                  <ul class="space-y-1">
                    <li
                      v-for="(finding, fi) in step.findings"
                      :key="fi"
                      class="flex items-start gap-2 text-xs text-slate-600"
                    >
                      <span :class="['mt-1 w-2 h-2 rounded-full shrink-0', SEVERITY_CLASS[finding.severity] ?? 'bg-slate-300']" />
                      <span>
                        <span v-if="finding.entryRef" class="font-mono text-[10px] bg-slate-100 px-1 rounded mr-1">{{ finding.entryRef }}</span>
                        {{ finding.text }}
                      </span>
                    </li>
                  </ul>
                </div>
                <div v-if="step.tasks.length > 0">
                  <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tasks</p>
                  <ul class="space-y-1.5">
                    <li
                      v-for="(task, ti) in step.tasks"
                      :key="ti"
                      class="flex items-start gap-2 text-xs"
                    >
                      <span :class="['shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold', PRIORITY_CLASS[task.priority] ?? 'bg-slate-100 text-slate-500']">
                        {{ task.priority }}
                      </span>
                      <span class="text-slate-600 leading-tight">{{ task.task }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Value delivery cycle label -->
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-1">Value Delivery Cycle (Steps 6–9)</p>

            <div
              v-for="step in critiqueResult.stepCritiques.slice(5)"
              :key="step.stepIndex"
              class="rounded-xl border-2 border-violet-200 bg-white overflow-hidden"
            >
              <button
                type="button"
                class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors"
                :title="`${openSteps.has(step.stepIndex) ? 'Collapse' : 'Expand'} Step ${step.stepIndex}: ${step.stepName} (Value Delivery cycle)`"
                @click="toggleStep(step.stepIndex)"
              >
                <span class="shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-black flex items-center justify-center">
                  {{ step.stepIndex }}
                </span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold text-slate-800">{{ step.stepName }}</span>
                  <p class="text-xs text-slate-500 leading-tight mt-0.5 truncate">{{ step.summary }}</p>
                </div>
                <div
                  :class="[
                    'shrink-0 w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center',
                    step.overallScore >= 75 ? 'border-blue-400 bg-blue-50' :
                    step.overallScore >= 60 ? 'border-blue-300 bg-blue-50' :
                    step.overallScore >= 40 ? 'border-amber-400 bg-amber-50' :
                    'border-orange-400 bg-orange-50',
                  ]"
                >
                  <span :class="['text-sm font-black leading-none', scoreCircleColor(step.overallScore)]">
                    {{ scoreToGrade(step.overallScore) }}
                  </span>
                </div>
                <span class="shrink-0 text-slate-300 text-xs">{{ openSteps.has(step.stepIndex) ? '▲' : '▼' }}</span>
              </button>

              <div v-if="openSteps.has(step.stepIndex)" class="border-t border-violet-100 px-4 py-3 space-y-3 bg-violet-50/30">
                <p class="text-xs text-slate-600">{{ step.summary }}</p>
                <div v-if="step.findings.length > 0">
                  <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Findings</p>
                  <ul class="space-y-1">
                    <li
                      v-for="(finding, fi) in step.findings"
                      :key="fi"
                      class="flex items-start gap-2 text-xs text-slate-600"
                    >
                      <span :class="['mt-1 w-2 h-2 rounded-full shrink-0', SEVERITY_CLASS[finding.severity] ?? 'bg-slate-300']" />
                      <span>{{ finding.text }}</span>
                    </li>
                  </ul>
                </div>
                <div v-if="step.tasks.length > 0">
                  <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tasks</p>
                  <ul class="space-y-1.5">
                    <li
                      v-for="(task, ti) in step.tasks"
                      :key="ti"
                      class="flex items-start gap-2 text-xs"
                    >
                      <span :class="['shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold', PRIORITY_CLASS[task.priority] ?? 'bg-slate-100 text-slate-500']">
                        {{ task.priority }}
                      </span>
                      <span class="text-slate-600 leading-tight">{{ task.task }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </ScrollContainer>
        </template>

        <!-- ── TAB 3: VALUE DELIVERY FOCUS ── -->
        <template v-else-if="activeTab === 'value-delivery'">
          <div
            v-if="!critiqueResult && !critiqueLoading"
            class="h-full flex items-center justify-center text-center px-8"
          >
            <div>
              <p class="text-sm text-slate-500 mb-4">Run the analysis first to see the Value Delivery Focus.</p>
              <button
                type="button"
                :disabled="!planModel"
                class="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold transition-colors"
                title="Run AI Evo analysis"
                @click="runAnalysis"
              >
                ▶ Run Analysis
              </button>
            </div>
          </div>

          <!-- Loading (Rule 8: shares timer state from Tab 1's full loading block) -->
          <div
            v-else-if="critiqueLoading"
            class="h-full flex items-center justify-center px-8"
          >
            <div class="max-w-md w-full text-center">
              <svg class="animate-spin h-8 w-8 text-violet-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-xs text-slate-400 mb-3">{{ elapsed }}s elapsed — analysis in progress</p>
              <div
                class="w-full bg-violet-100 rounded-full h-1.5 mb-4"
                role="progressbar"
                :aria-valuenow="simulatedProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                  :style="{ width: simulatedProgress + '%' }"
                />
              </div>
              <div class="rounded-xl bg-violet-50 border border-violet-200 p-4 text-left">
                <div class="flex items-start gap-2">
                  <span class="text-xl shrink-0 mt-0.5" aria-hidden="true">{{ EVO_WISDOM[activeWisdomIdx].emoji }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-violet-800 mb-1">{{ EVO_WISDOM[activeWisdomIdx].title }}</p>
                    <p class="text-[11px] text-slate-600 leading-relaxed">{{ EVO_WISDOM[activeWisdomIdx].text }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ScrollContainer
            v-else-if="critiqueResult"
            outer-class="h-full relative"
            inner-class="px-6 py-5 space-y-5"
          >
            <!-- 4 step score circles -->
            <div>
              <h4 class="text-sm font-bold text-slate-700 mb-3">Value Delivery Cycle — Steps 6–9</h4>
              <div class="grid grid-cols-4 gap-3">
                <div
                  v-for="step in vdStepCritiques"
                  :key="step.stepIndex"
                  class="flex flex-col items-center gap-2 p-3 rounded-xl bg-violet-50 border border-violet-100"
                >
                  <div
                    :class="[
                      'w-14 h-14 rounded-full border-4 flex flex-col items-center justify-center',
                      step.overallScore >= 75 ? 'border-blue-400 bg-blue-50' :
                      step.overallScore >= 60 ? 'border-blue-300 bg-blue-50' :
                      step.overallScore >= 40 ? 'border-amber-400 bg-amber-50' :
                      'border-orange-400 bg-orange-50',
                    ]"
                  >
                    <span :class="['text-lg font-black leading-none', scoreCircleColor(step.overallScore)]">
                      {{ scoreToGrade(step.overallScore) }}
                    </span>
                    <span :class="['text-[10px] font-semibold', scoreCircleColor(step.overallScore)]">
                      {{ step.overallScore }}
                    </span>
                  </div>
                  <p class="text-xs font-bold text-violet-700 text-center">{{ step.stepName }}</p>
                  <p class="text-[9px] text-slate-400 text-center">Step {{ step.stepIndex }}</p>
                </div>
              </div>
            </div>

            <!-- Top Risk card -->
            <div class="p-4 rounded-xl bg-orange-50 border border-orange-200">
              <p class="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">Top Risk</p>
              <p class="text-sm text-orange-800 leading-relaxed">{{ critiqueResult.valueDeliveryFocus.topRisk }}</p>
            </div>

            <!-- What Good Looks Like card -->
            <div class="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p class="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">What Good Looks Like</p>
              <p class="text-sm text-blue-800 leading-relaxed">{{ critiqueResult.valueDeliveryFocus.goodLooks }}</p>
            </div>

            <!-- Practical tasks sorted by priority -->
            <div>
              <h4 class="text-sm font-bold text-slate-700 mb-3">Practical Tasks — Do This Week</h4>
              <ul
                v-if="critiqueResult.valueDeliveryFocus.practicalTasks.length > 0"
                class="space-y-2"
              >
                <li
                  v-for="(task, ti) in critiqueResult.valueDeliveryFocus.practicalTasks"
                  :key="ti"
                  class="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <span :class="['shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold', PRIORITY_CLASS[task.priority] ?? 'bg-slate-100 text-slate-500']">
                    {{ task.priority }}
                  </span>
                  <span class="shrink-0 text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                    {{ vdLabel(task.evoStep) }}
                  </span>
                  <span class="text-xs text-slate-700 leading-snug">{{ task.task }}</span>
                </li>
              </ul>
              <p v-else class="text-xs text-slate-400 italic">No tasks generated — re-run analysis.</p>
            </div>
          </ScrollContainer>
        </template>

      </div>
    </div>
  </Teleport>
</template>
