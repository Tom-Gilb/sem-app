<!-- UNIT_TYPE=Panel -->
<!--
 * StrategyAgentPanel.vue — Strategy Agent Tool: Strategy Sharpening
 * Deterministic 10-dimension analysis engine — no external calls, instant results.
 *
 * Tom Gilb 2026-06-09: "do the best you can with sharpening without claude,
 * we need a great demo of strategy sharpening to get that far."
 *
 * Analysis auto-runs the moment the panel opens.
 * Re-analyze button re-runs on demand (e.g. after editing the spec).
 *
 * Top 10 strategy sharpening dimensions grounded in Gilb Planguage:
 *   1. Value Traceability (2×)     6. Solution Specificity
 *   2. Impact Quantification       7. Redundancy Detection
 *   3. Constraint Compliance       8. Dependency Ordering
 *   4. Goal Coverage (2×)          9. Past Sharpening Patterns
 *   5. Resource Feasibility        10. Strategy Completeness
 *
 * Accessible from: Solutions Stage (planningStage 5) AND Sharpening Stage (planningStage 3).
 *
 * Rules: CloseDot, backdrop, ScrollContainer, MOVE, DD-011 (Planguage glyphs only),
 *        DD-014 (bottom nav mirror), DD-015 (international icons),
 *        DD-017 (white background for colored text), No-Silent-Data-Loss.
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { SpecBlock } from '../types/spec'
import type { SharpenRound } from '../composables/useSharpen'
import { STRATEGY_SHARPEN_DIMENSIONS, suggestStrategyAnswer } from '../data/strategySharpenDimensions'
import { useStrategySharpen } from '../composables/useStrategySharpen'
// r41 v92 (Tom Gilb 2026-06-16 "go phase 2") — the identity band + history
// picker baked in r41 v91 is now extracted to the shared <PlanIdentityBand />
// component so Incorruptible / Elon / Maria / Evo Critiquer / Sharpen can
// reuse the same widget. ──────────────────────────────────────────────────
import PlanIdentityBand from './PlanIdentityBand.vue'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
  sharpenRounds?: SharpenRound[]
  /** Project / plan name — surfaced in the header so the planner knows which
   *  plan Strategy Sharpening is operating on. (r41 v91 — Tom Gilb 2026-06-16) */
  planName?: string
  /** Plan version label (e.g. "v0.1") — surfaced in the header. */
  planVersion?: string
  /** Owner name(s) — surfaced in the header for accountability. */
  planOwner?: string
  /** ISO timestamp the current spec was generated — surfaced as "Spec: 16 Jun · 19:34". */
  generatedAt?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply-improvements', improvements: import('../data/strategySharpenDimensions').StrategyImprovement[]): void
  /** Bubble a history-snapshot selection up to the parent so it can swap the
   *  active spec to the chosen snapshot. (r41 v91) */
  (e: 'select-history', versionId: string): void
}>()

// r41 v92 — identity band + history picker is now <PlanIdentityBand />.
// All formatting helpers + history fetching live in that component.

function onSelectHistory(versionId: string) {
  emit('select-history', versionId)
}

// ── Composable ────────────────────────────────────────────────────────────────

const {
  result, approvedIds,
  dimensionFinding,
  runAnalysis,
  toggleApproval, approveAll,
  getApprovedImprovements, clearResult,
} = useStrategySharpen()

// ── Local State ───────────────────────────────────────────────────────────────

const expandedDimensions = ref(new Set<string>())
const appliedCount       = ref(0)

// ── Q&A answers per dimension per question — r41 v90 (Tom Gilb 2026-06-16
//    verbatim "strategy agent is not asking proper sharpening questions,
//    please make it like other sharpening").  Strategy Agent previously
//    rendered Guided Questions as a static read-only list.  v90 makes them
//    interactive — a textarea below each question captures the planner's
//    answer, persisted to localStorage keyed by spec.functions[0].id (a
//    rough spec-identity hash) so answers survive panel close + reopen.
//    Answers are stored as Record<dimensionId, string[]> with one string
//    per question index. ────────────────────────────────────────────
const strategyAnswers = ref<Record<string, string[]>>({})

const _answersStorageKey = computed(() => {
  // Use spec content hash for stability across panel open/close
  const spec = props.spec
  if (!spec) return ''
  const sig = spec.functions.map(f => f.id).join('|') + '~' + spec.values.map(v => v.id).join('|')
  return 'sem-strategy-answers-' + sig.slice(0, 64)
})

function loadAnswers() {
  if (typeof window === 'undefined') return
  try {
    const k = _answersStorageKey.value
    if (!k) return
    const raw = localStorage.getItem(k)
    strategyAnswers.value = raw ? JSON.parse(raw) : {}
  } catch {
    strategyAnswers.value = {}
  }
}

function saveAnswers() {
  if (typeof window === 'undefined') return
  try {
    const k = _answersStorageKey.value
    if (!k) return
    localStorage.setItem(k, JSON.stringify(strategyAnswers.value))
  } catch {
    /* localStorage may be full or blocked — fail silently */
  }
}

/** Get the answer string for a (dimensionId, questionIndex) pair. */
function getAnswer(dimensionId: string, qIdx: number): string {
  return strategyAnswers.value[dimensionId]?.[qIdx] ?? ''
}

/** Set the answer string for a (dimensionId, questionIndex) pair + persist. */
function setAnswer(dimensionId: string, qIdx: number, value: string) {
  if (!strategyAnswers.value[dimensionId]) {
    strategyAnswers.value[dimensionId] = []
  }
  strategyAnswers.value[dimensionId][qIdx] = value
  saveAnswers()
}

/** Total non-empty answers across all dimensions — used for save indicator. */
const answeredCount = computed(() => {
  let n = 0
  for (const arr of Object.values(strategyAnswers.value)) {
    for (const a of arr) {
      if (a && a.trim()) n++
    }
  }
  return n
})

/** Per-dimension answered count. */
function dimensionAnsweredCount(dimensionId: string): number {
  const arr = strategyAnswers.value[dimensionId] ?? []
  return arr.filter(a => a && a.trim()).length
}

// ── r41 v361 (Tom Gilb 2026-06-25 "in this sharpening no suggested answers
//    are generated. THIS IS THE STANDARD FOR ALL SHARPENING, AI GENERATED
//    QUESTIONS") — AI-Max Principle SUPREME compliance.  Every Guided
//    Question textarea now carries a spec-derived suggested answer above it.
//    Source layer: Plan-derived (deterministic from currentSpec; highest
//    provenance per Conjunction-of-Technologies SUPREME).  Planner can [Use
//    this suggestion] to copy it into the textarea, then edit freely. ───
function suggestedAnswerFor(dimensionId: string, qIdx: number): string {
  return suggestStrategyAnswer(dimensionId, qIdx, props.spec)
}

/** Copy a suggested answer into the textarea (replaces current value). */
function insertSuggestion(dimensionId: string, qIdx: number) {
  const suggestion = suggestedAnswerFor(dimensionId, qIdx)
  setAnswer(dimensionId, qIdx, suggestion)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(severity: string | undefined): string {
  if (severity === 'critical') return 'text-red-700 bg-red-50 border-red-300'
  if (severity === 'moderate') return 'text-amber-700 bg-amber-50 border-amber-300'
  return 'text-emerald-700 bg-emerald-50 border-emerald-300'
}

function severityLabel(severity: string | undefined): string {
  if (severity === 'critical') return 'Critical'
  if (severity === 'moderate') return 'Moderate'
  return 'Good'
}

function scoreBar(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-500'
}

const overallColor = computed(() => {
  if (!result.value) return 'text-slate-400'
  const s = result.value.overallScore
  if (s >= 80) return 'text-emerald-700'
  if (s >= 50) return 'text-amber-700'
  return 'text-red-700'
})

// ── Counts ────────────────────────────────────────────────────────────────────

const solutionCount    = computed(() => props.spec?.solutions?.length ?? 0)
const valueCount       = computed(() => props.spec?.values?.length ?? 0)
const roundCount       = computed(() => props.sharpenRounds?.length ?? 0)
const approvedCount    = computed(() => approvedIds.value.size)
const totalSuggestions = computed(() => {
  if (!result.value) return 0
  return result.value.dimensions.reduce((n, d) => n + (d.suggestions?.length ?? 0), 0)
})

// ── Analysis ──────────────────────────────────────────────────────────────────

/** Auto-expand critical + moderate dimensions after analysis runs. */
function autoExpand() {
  if (!result.value) return
  expandedDimensions.value = new Set(
    result.value.dimensions
      .filter(d => d.severity === 'critical' || d.severity === 'moderate')
      .map(d => d.dimensionId)
  )
}

function handleReanalyze() {
  if (!props.spec) return
  clearResult()
  expandedDimensions.value = new Set()
  appliedCount.value = 0
  runAnalysis(props.spec, props.sharpenRounds ?? [])
  autoExpand()
}

// Auto-run when panel opens
watch(() => props.open, (val) => {
  if (val && props.spec) {
    appliedCount.value = 0
    expandedDimensions.value = new Set()
    loadAnswers()                            // r41 v90 — restore prior Q&A
    runAnalysis(props.spec, props.sharpenRounds ?? [])
    autoExpand()
  } else if (!val) {
    appliedCount.value = 0
  }
})

// ── Dimension cards ───────────────────────────────────────────────────────────

function toggleDimension(id: string) {
  const next = new Set(expandedDimensions.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedDimensions.value = next
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function handleApply() {
  const improvements = getApprovedImprovements()
  appliedCount.value = improvements.length
  emit('apply-improvements', improvements)
}

// ── Close / Keyboard ──────────────────────────────────────────────────────────

function handleClose() {
  emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (props.open && e.key === 'Escape') handleClose()
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/40 z-[590]"
        title="Click to close Strategy Sharpening"
        @click="handleClose"
      />

      <!-- Panel -->
      <div
        class="fixed inset-0 z-[595] flex flex-col bg-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Strategy Agent — Strategy Sharpening"
        aria-modal="true"
      >
        <!-- ── Header — r41 v91 (Tom Gilb 2026-06-16 verbatim "The strategy
             agent did not address the current project. It needs to have a
             clear title, Project and Owner, and a possibility of selecting
             another history plan ro contract etc - A date time of the
             current spec should be there, yes version").
             Two-row header now: Row 1 = title + Re-analyze + Close;
             Row 2 = Plan name | Owner | Version | Spec date | History picker.
             All five Tom-requested fields surfaced in one band so the
             planner immediately knows WHAT spec Strategy Sharpening is
             operating on. ─────────────────────────────────────────────── -->
        <div class="shrink-0 bg-orange-600 text-white shadow-md">
          <!-- Row 1 — tool title + Re-analyze + Close -->
          <div class="flex items-center gap-3 px-5 py-2.5">
            <!-- [→*] = Solution keyed glyph (DD-011 / DD-015) -->
            <span class="text-lg font-mono font-bold tracking-tight select-none">[→*]</span>
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-bold leading-tight">Strategy Agent — Strategy Sharpening</span>
              <span class="text-[10px] text-orange-100 leading-tight">
                10 dimensions · {{ solutionCount }} solutions · {{ valueCount }} values · {{ roundCount }} past round(s)
              </span>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <button
                v-if="spec"
                type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors border border-white/30"
                title="Re-run the 10-dimension strategy analysis on the current spec"
                @click="handleReanalyze"
              >
                <span class="font-mono leading-none">↺</span>
                <span>Re-analyze</span>
              </button>
              <CloseDot size="lg" variant="on-dark" aria-label="Close Strategy Sharpening" @click="handleClose" />
            </div>
          </div>
          <!-- Row 2 — Plan identity band (r41 v92: extracted to shared component) -->
          <PlanIdentityBand
            :plan-name="planName"
            :plan-owner="planOwner"
            :plan-version="planVersion"
            :generated-at="generatedAt"
            :theme="{ bg: 'bg-orange-700', borderTop: 'border-orange-500', label: 'text-orange-100', pickerBorder: 'border-orange-300' }"
            @select-history="onSelectHistory"
          />
        </div>

        <!-- ── Body ───────────────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="flex-1 min-h-0"
          inner-class="p-5 space-y-4 max-w-4xl mx-auto w-full"
          fade-from="white"
        >

          <!-- No spec guard -->
          <div v-if="!spec" class="flex flex-col items-center justify-center py-16 text-center gap-3">
            <span class="text-4xl font-mono text-orange-300 select-none">[→*]</span>
            <p class="text-slate-600 text-sm">Generate a spec first — Strategy Sharpening needs Solution and Value entries to analyze.</p>
          </div>

          <template v-else>

            <!-- ── Stats bar ───────────────────────────────────────────── -->
            <div class="flex flex-wrap gap-3">
              <div class="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                <span class="text-xs font-bold text-orange-700">{{ solutionCount }}</span>
                <span class="text-xs text-orange-600">solutions</span>
              </div>
              <div class="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5">
                <span class="text-xs font-bold text-violet-700">{{ valueCount }}</span>
                <span class="text-xs text-violet-600">values</span>
              </div>
              <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span class="text-xs font-bold text-slate-700">{{ roundCount }}</span>
                <span class="text-xs text-slate-500">past sharpen round(s)</span>
              </div>
              <div
                v-if="result"
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 border"
                :class="result.overallScore >= 80 ? 'bg-emerald-50 border-emerald-200' : result.overallScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'"
              >
                <span class="text-xs font-bold" :class="overallColor">{{ result.overallScore }}/100</span>
                <span class="text-xs text-slate-500">overall strategy score</span>
              </div>
              <!-- r41 v90 — global Q&A answered count -->
              <div
                v-if="answeredCount > 0"
                class="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5"
                title="Total answers typed across all 10 dimensions — saved locally"
              >
                <span class="text-xs font-bold text-emerald-700">✓ {{ answeredCount }}</span>
                <span class="text-xs text-emerald-600">Question{{ answeredCount === 1 ? '' : 's' }} Answered</span>
              </div>
            </div>

            <!-- ── Top Priority (post-analysis) ───────────────────────── -->
            <div v-if="result && result.topPriority?.length" class="rounded-xl border-2 border-orange-400 bg-orange-50 p-4 space-y-2">
              <p class="text-sm font-bold text-orange-800">⚡ Top Priority Actions</p>
              <ol class="space-y-1 list-decimal list-inside">
                <li v-for="(action, i) in result.topPriority" :key="i" class="text-sm text-orange-900">
                  {{ action }}
                </li>
              </ol>
            </div>

            <!-- ── 10 Dimension Cards ──────────────────────────────────── -->
            <div class="space-y-2">
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">
                10 Strategy Sharpening Dimensions
                <span v-if="result" class="font-normal normal-case ml-2 text-slate-400">
                  — click a dimension to see findings and suggestions
                </span>
              </p>

              <div
                v-for="dim in STRATEGY_SHARPEN_DIMENSIONS"
                :key="dim.id"
                class="rounded-xl border bg-white overflow-hidden"
                :class="result && dimensionFinding[dim.id] ? (
                  dimensionFinding[dim.id].severity === 'critical' ? 'border-red-300' :
                  dimensionFinding[dim.id].severity === 'moderate' ? 'border-amber-300' : 'border-emerald-300'
                ) : 'border-slate-200'"
              >
                <!-- Dimension header row -->
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  :title="`${dim.label} — ${dim.summary} · Click to expand findings and suggestions`"
                  @click="toggleDimension(dim.id)"
                >
                  <!-- Score bar (if result available) -->
                  <div v-if="result && dimensionFinding[dim.id]" class="flex flex-col items-center gap-0.5 shrink-0 w-10">
                    <span
                      class="text-sm font-bold tabular-nums"
                      :class="dimensionFinding[dim.id].score >= 80 ? 'text-emerald-700' : dimensionFinding[dim.id].score >= 50 ? 'text-amber-700' : 'text-red-700'"
                    >
                      {{ dimensionFinding[dim.id].score }}
                    </span>
                    <div class="w-8 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="scoreBar(dimensionFinding[dim.id].score)"
                        :style="{ width: dimensionFinding[dim.id].score + '%' }"
                      />
                    </div>
                  </div>
                  <!-- Dim number badge (no result yet) -->
                  <div
                    v-else
                    class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0"
                  >
                    {{ STRATEGY_SHARPEN_DIMENSIONS.indexOf(dim) + 1 }}
                  </div>

                  <!-- Label + summary -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-slate-800">{{ dim.label }}</span>
                      <span
                        v-if="result && dimensionFinding[dim.id]?.severity"
                        class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                        :class="severityColor(dimensionFinding[dim.id].severity)"
                      >
                        {{ severityLabel(dimensionFinding[dim.id].severity) }}
                      </span>
                      <span v-if="result && dimensionFinding[dim.id]" class="text-[10px] text-slate-400">
                        {{ dimensionFinding[dim.id].suggestions?.length ?? 0 }} suggestion(s)
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">{{ dim.summary }}</p>
                  </div>

                  <span class="text-slate-400 text-xs shrink-0">{{ expandedDimensions.has(dim.id) ? '▲' : '▼' }}</span>
                </button>

                <!-- Expanded content -->
                <div v-if="expandedDimensions.has(dim.id)" class="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50">

                  <!-- Analysis results -->
                  <template v-if="result && dimensionFinding[dim.id]">
                    <!-- Findings -->
                    <div v-if="dimensionFinding[dim.id].findings?.length" class="space-y-1">
                      <p class="text-xs font-bold text-slate-600 uppercase tracking-wide">Findings</p>
                      <ul class="space-y-1">
                        <li
                          v-for="(finding, fi) in dimensionFinding[dim.id].findings"
                          :key="fi"
                          class="text-sm text-slate-700 flex gap-2"
                        >
                          <span class="text-slate-400 shrink-0">·</span>
                          <span>{{ finding }}</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Suggestions with approval checkboxes -->
                    <div v-if="dimensionFinding[dim.id].suggestions?.length" class="space-y-2">
                      <p class="text-xs font-bold text-slate-600 uppercase tracking-wide">Suggested Improvements</p>
                      <div
                        v-for="sug in dimensionFinding[dim.id].suggestions"
                        :key="sug.id"
                        class="rounded-lg border p-3 bg-white space-y-1.5"
                        :class="approvedIds.has(sug.id) ? 'border-orange-400 bg-orange-50' : 'border-slate-200'"
                      >
                        <div class="flex items-start gap-2">
                          <input
                            type="checkbox"
                            class="mt-0.5 h-4 w-4 rounded accent-orange-500 shrink-0 cursor-pointer"
                            :checked="approvedIds.has(sug.id)"
                            :title="approvedIds.has(sug.id) ? 'Unapprove this improvement' : 'Approve this improvement for applying to the spec'"
                            @change="toggleApproval(sug.id)"
                          />
                          <div class="flex-1 min-w-0 space-y-1">
                            <p class="text-sm text-slate-800">{{ sug.description }}</p>
                            <div v-if="sug.targetEntryId" class="text-[11px] text-slate-500 font-mono">
                              Target: {{ sug.targetEntryId }}
                            </div>
                            <div v-if="sug.newFieldValues" class="bg-slate-100 rounded px-2 py-1 space-y-0.5">
                              <div
                                v-for="(val, field) in sug.newFieldValues"
                                :key="field"
                                class="text-[11px] font-mono text-slate-700"
                              >
                                <span class="text-slate-400">{{ field }}:</span> {{ val }}
                              </div>
                            </div>
                            <p class="text-[10px] text-violet-600 italic">{{ sug.gilbReason }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- Dimension definition (always shown when expanded) -->
                  <div class="space-y-3 border-t border-slate-200 pt-3">
                    <div>
                      <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Why It Matters</p>
                      <p class="text-xs text-slate-600 leading-relaxed">{{ dim.whyItMatters }}</p>
                    </div>
                    <div>
                      <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Gilb Source</p>
                      <p class="text-[11px] text-violet-700 italic">{{ dim.gilbCite }}</p>
                    </div>
                    <!-- r41 v90 (Tom Gilb 2026-06-16 verbatim "strategy agent
                         is not asking proper sharpening questions, please
                         make it like other sharpening") — Guided Questions
                         upgraded from static read-only list to interactive
                         Q&A.  Each question now has its own textarea below it
                         (matching SharpenPanel's pattern at line 1212-1221).
                         Answers persist to localStorage per spec via
                         strategyAnswers + saveAnswers().  No "Submit" button
                         per dimension — auto-save on input — Universal Undo
                         + No-Silent-Data-Loss compliance.  Composes with the
                         Conjunction-of-Technologies SUPREME rule: planner-
                         typed answers will (Phase 2) feed into Claudian
                         critique of the deterministic suggestions, closing
                         the loop. -->
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Guided Questions — Your Answers
                        </p>
                        <span
                          v-if="dimensionAnsweredCount(dim.id) > 0"
                          class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-px"
                        >✓ {{ dimensionAnsweredCount(dim.id) }} answered</span>
                      </div>
                      <div class="space-y-3">
                        <div v-for="(q, qi) in dim.questions" :key="qi" class="space-y-1.5">
                          <label
                            :for="`strat-q-${dim.id}-${qi}`"
                            class="block text-sm text-slate-700 leading-snug"
                          >
                            <span class="text-orange-500 font-bold mr-1">{{ qi + 1 }}.</span>{{ q }}
                          </label>

                          <!-- r41 v361 (Tom Gilb 2026-06-25 "AI GENERATED
                               QUESTIONS" — AI-Max Principle SUPREME) —
                               spec-derived suggested answer surfaced ABOVE
                               every textarea.  Source-layer label per
                               Conjunction-of-Technologies SUPREME:
                               "Derived from plan" = highest provenance,
                               deterministic from currentSpec, no LLM call. -->
                          <div
                            v-if="props.spec"
                            class="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-900 leading-relaxed"
                          >
                            <div class="flex items-start gap-2 mb-1">
                              <span class="shrink-0 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-white border border-emerald-300 rounded px-1.5 py-px">
                                ✨ AI-Suggested · Derived from plan
                              </span>
                              <button
                                type="button"
                                class="ml-auto shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] font-semibold transition-colors text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100"
                                :title="`Insert this suggestion into the answer textarea — you can edit it freely afterward`"
                                @click="insertSuggestion(dim.id, qi)"
                              >
                                Use this answer ↓
                              </button>
                            </div>
                            <p class="whitespace-pre-wrap font-mono text-[10.5px]">{{ suggestedAnswerFor(dim.id, qi) }}</p>
                          </div>

                          <textarea
                            :id="`strat-q-${dim.id}-${qi}`"
                            :value="getAnswer(dim.id, qi)"
                            rows="2"
                            class="w-full rounded-lg border border-orange-200 bg-white px-3 py-2
                                   text-sm text-slate-800 placeholder:text-slate-400
                                   focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent
                                   resize-none transition-colors"
                            placeholder="Type your answer here — or click 'Use this answer ↓' above"
                            @input="setAnswer(dim.id, qi, ($event.target as HTMLTextAreaElement).value)"
                          />
                        </div>
                      </div>
                      <p v-if="dimensionAnsweredCount(dim.id) > 0" class="text-[10px] text-slate-400 mt-1.5 italic">
                        Auto-saved · survives close + reopen of this panel
                      </p>
                    </div>
                    <div>
                      <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Examples</p>
                      <ul class="space-y-1">
                        <li
                          v-for="(ex, ei) in dim.examples"
                          :key="ei"
                          class="text-[11px] font-mono text-slate-600 bg-white rounded px-2 py-0.5 border border-slate-200"
                        >
                          {{ ex }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Apply bar ────────────────────────────────────────────── -->
            <div v-if="result" class="rounded-xl border border-orange-300 bg-orange-50 p-4 space-y-3">
              <div class="flex items-center gap-3 flex-wrap">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-orange-800">
                    {{ approvedCount }} improvement(s) approved
                    <span class="font-normal text-orange-600">of {{ totalSuggestions }} total suggestions</span>
                  </p>
                  <p class="text-xs text-orange-600">Tick improvements above to approve, then click Apply.</p>
                </div>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors"
                  title="Approve all suggestions across all 10 dimensions"
                  @click="approveAll"
                >
                  Approve All
                </button>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  :class="approvedCount > 0 ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
                  :disabled="approvedCount === 0"
                  title="Apply approved improvements to the spec"
                  @click="handleApply"
                >
                  Apply {{ approvedCount > 0 ? `${approvedCount} Approved` : '' }} Improvement(s)
                </button>
              </div>
              <p v-if="appliedCount > 0" class="text-xs text-emerald-700 font-semibold">
                ✓ {{ appliedCount }} improvement(s) applied to spec.
              </p>
            </div>

            <!-- ── Bottom nav mirror (DD-014) ─────────────────────────── -->
            <div class="border-t border-slate-200 pt-4 flex justify-between items-center">
              <span v-if="result" class="text-[10px] text-slate-400">
                Analyzed {{ result.dimensions.length }} dimensions · {{ totalSuggestions }} total suggestion(s)
              </span>
              <button
                type="button"
                class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded border border-slate-200 hover:border-slate-400 ml-auto"
                title="Close Strategy Sharpening and return to the plan"
                @click="handleClose"
              >
                ← Close Strategy Sharpening
              </button>
            </div>

          </template>
        </ScrollContainer>
      </div>
    </template>
  </Teleport>
</template>
