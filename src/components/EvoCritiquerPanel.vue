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
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  useEvoCritiquer,
  HEALTH_DIMENSION_DEFS,
  scoreToGrade,
} from '../composables/useEvoCritiquer'
import type { HealthDimension, EvoStepCritique, HealthFinding, ImprovementTask } from '../composables/useEvoCritiquer'
import { usePlanModel } from '../composables/usePlanModel'

const emit = defineEmits<{ close: [] }>()

// ── Composables ───────────────────────────────────────────────────────────────

const { critiqueResult, critiqueLoading, critiqueError, runEvoCritique } = useEvoCritiquer()
const { currentModel: planModel } = usePlanModel()

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

        <CloseDot
          variant="on-dark"
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
              <p v-if="!planModel" class="text-xs text-amber-600 mb-4">
                No active plan loaded — open a plan in the main workspace first.
              </p>
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

          <!-- Loading -->
          <div
            v-else-if="critiqueLoading"
            class="h-full flex items-center justify-center text-center px-8"
          >
            <div>
              <svg class="animate-spin h-10 w-10 text-violet-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-sm font-medium text-violet-600">Analyzing plan against the 9-step Evo cycle…</p>
              <p class="text-xs text-slate-400 mt-1">This may take 30–60 seconds</p>
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

          <div
            v-else-if="critiqueLoading"
            class="h-full flex items-center justify-center"
          >
            <svg class="animate-spin h-8 w-8 text-violet-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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

          <div
            v-else-if="critiqueLoading"
            class="h-full flex items-center justify-center"
          >
            <svg class="animate-spin h-8 w-8 text-violet-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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
