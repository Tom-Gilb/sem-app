<!-- UNIT_TYPE=Panel -->
<!--
/**
 * FeedMePanel — Tom Gilb's "FEED ME!" Evo Feedback + Learning tool.
 * Audrey II nod (Little Shop of Horrors): the plant grows by being fed.
 * This tool grows the Evo plan's quality by being fed FEEDBACK.
 *
 * SOURCE (Tom Gilb 2026-06-03 verbatim) — see header of src/data/feedMe.ts.
 *
 * UX:
 *   - Section navigation tabs:
 *       🌱 Feedback Base — older system context, baselines, constraints
 *       📚 Evo Base — completed step records, accumulated feedback, good Qs
 *       💃 Last Step in Paris — last increment + lagging measures + tough Qs
 *       🛠️ Recommended Actions — pending approvals (audit trail enforced)
 *   - Empty state: Generate via Claudian / Load Example
 *   - Tough question card: AI suggested answer + Accept / Modify / Dismiss
 *   - Action card: Approve / Reject + reviewedBy + reviewNote (audit fields)
 *
 * AUDIT TRAIL is the binding constraint — every action approval stamps
 * reviewedAt + reviewedBy + reviewNote.  Action source + reason are
 * required at the type level (not optional) so they cannot be omitted.
 *
 * Theme: green-700 → emerald-600 header (Audrey II's leaves), red accents
 * on lagging indicators + tough question zones (the plant's mouth).
 *
 * Rules complied with: Single-Surface, ScrollContainer, CloseDot,
 * Planguage-Glyph-First, Interaction Disclosure, Banned-Scrum-Vocabulary.
 */
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import SourceBadge from './SourceBadge.vue'
import { useFeedMe } from '../composables/useFeedMe'
import { buildClaudianPrompt, type ToughQuestion, type RecommendedAction } from '../data/feedMe'
import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  /** Current Evo Steps (drives mock generation + Last Step identification). */
  steps: EvoStep[]
  /** Stable plan id (plan model name). */
  planId?: string
}>()

defineEmits<{
  close: []
}>()

// ── Composable ───────────────────────────────────────────────────────────────
const planIdRef = computed(() => props.planId ?? 'default')
const stepsRef = computed(() => props.steps)
const {
  set, lastError, loadMock, pasteSet, clearAll,
  setToughQuestionStatus, setActionStatus,
  pendingActionsCount, approvedActionsCount, pendingToughQuestionsCount,
} = useFeedMe(planIdRef, stepsRef)

// ── Tab navigation ───────────────────────────────────────────────────────────
type Tab = 'feedback-base' | 'evo-base' | 'last-step-in-paris' | 'actions'
const activeTab = ref<Tab>('feedback-base')

const TABS: Array<{ id: Tab; emoji: string; label: string; tagline: string }> = [
  { id: 'feedback-base',     emoji: '🌱', label: 'Feedback Base',      tagline: 'Older system context, baselines, constraints' },
  { id: 'evo-base',          emoji: '📚', label: 'Evo Base',           tagline: 'Series of Evo steps until now — measures, feedback, observations' },
  { id: 'last-step-in-paris', emoji: '💃', label: 'Last Step in Paris', tagline: 'Latest increment + LAGGING measures + tough questions to DEV' },
  { id: 'actions',           emoji: '🛠️', label: 'Recommended Actions', tagline: 'Approve / reject — audit trail (Source + Reason) enforced' },
]

// ── Claudian prompt copy ─────────────────────────────────────────────────────
const copyFlash = ref(false)
function onGenerateViaClaudian(): void {
  const lastStep = props.steps[props.steps.length - 1] ?? null
  const prompt = buildClaudianPrompt(props.steps, lastStep, set.value?.feedbackBase)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(prompt).then(() => {
      copyFlash.value = true
      setTimeout(() => { copyFlash.value = false }, 2000)
    }).catch(() => { /* ignore */ })
  }
  showPaste.value = true
}

// ── Paste-back area ──────────────────────────────────────────────────────────
const showPaste = ref(false)
const pasteText = ref('')
function onPaste(): void {
  if (pasteSet(pasteText.value)) {
    pasteText.value = ''
    showPaste.value = false
  }
}

// ── Clear with confirm ───────────────────────────────────────────────────────
function onClearConfirm(): void {
  if (confirm('Clear the entire FEED ME! set for this plan?  Cannot be undone.')) {
    clearAll()
  }
}

// ── Tough question actions ───────────────────────────────────────────────────
const editingQId = ref<string>('')
const editingQText = ref<string>('')

function onAcceptQ(q: ToughQuestion): void {
  setToughQuestionStatus(q.id, 'accepted', q.suggestedAIAnswer)
}
function onStartModify(q: ToughQuestion): void {
  editingQId.value = q.id
  editingQText.value = q.devResponse ?? q.suggestedAIAnswer
}
function onSaveModify(q: ToughQuestion): void {
  setToughQuestionStatus(q.id, 'modified', editingQText.value)
  editingQId.value = ''
  editingQText.value = ''
}
function onDismissQ(q: ToughQuestion): void {
  setToughQuestionStatus(q.id, 'dismissed')
}

// ── Action approval lifecycle ────────────────────────────────────────────────
const reviewerName = ref<string>('Tom')   // v2: real user identity
const reviewNoteByActionId = ref<Record<string, string>>({})

function onApproveAction(a: RecommendedAction): void {
  setActionStatus(a.id, 'approved', reviewerName.value, reviewNoteByActionId.value[a.id])
}
function onRejectAction(a: RecommendedAction): void {
  setActionStatus(a.id, 'rejected', reviewerName.value, reviewNoteByActionId.value[a.id])
}
function onResetAction(a: RecommendedAction): void {
  setActionStatus(a.id, 'pending', reviewerName.value)
}

// ── Type badge classes ───────────────────────────────────────────────────────
function actionTypeBadge(t: RecommendedAction['type']): { label: string; classes: string } {
  switch (t) {
    case 'spec-change':     return { label: 'SPEC CHANGE',     classes: 'bg-violet-100 text-violet-700 border-violet-300' }
    case 'evo-task-change': return { label: 'EVO TASK CHANGE', classes: 'bg-sky-100 text-sky-700 border-sky-300' }
    case 'plan-change':     return { label: 'PLAN CHANGE',     classes: 'bg-amber-100 text-amber-700 border-amber-300' }
  }
}
function actionStatusBadge(s: RecommendedAction['status']): { label: string; classes: string } {
  switch (s) {
    case 'pending':  return { label: 'PENDING',  classes: 'bg-slate-100 text-slate-600 border-slate-300' }
    case 'approved': return { label: 'APPROVED', classes: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
    case 'rejected': return { label: 'REJECTED', classes: 'bg-red-100 text-red-700 border-red-300' }
    case 'applied':  return { label: 'APPLIED',  classes: 'bg-indigo-100 text-indigo-700 border-indigo-300' }
  }
}
function qStatusBadge(s: ToughQuestion['status']): { label: string; classes: string } {
  switch (s) {
    case 'pending':   return { label: 'PENDING',   classes: 'bg-slate-100 text-slate-600 border-slate-300' }
    case 'accepted':  return { label: 'ACCEPTED',  classes: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
    case 'modified':  return { label: 'MODIFIED',  classes: 'bg-amber-100 text-amber-700 border-amber-300' }
    case 'dismissed': return { label: 'DISMISSED', classes: 'bg-red-100 text-red-700 border-red-300' }
  }
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString()
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feed-me-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header — Audrey II green leaves -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-green-700 to-emerald-600 text-white">
          <PlEvoStepIcon size="md" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="feed-me-title" class="text-base font-extrabold tracking-wide">
              <span aria-hidden="true" class="mr-1">🪴</span>FEED ME!
            </h2>
            <p class="text-[11px] text-emerald-50 mt-0.5">
              Feedback + Learning · {{ pendingActionsCount }} action{{ pendingActionsCount === 1 ? '' : 's' }} pending
              <span v-if="approvedActionsCount > 0"> · {{ approvedActionsCount }} approved</span>
              <span v-if="pendingToughQuestionsCount > 0"> · {{ pendingToughQuestionsCount }} tough Q{{ pendingToughQuestionsCount === 1 ? '' : 's' }} unanswered</span>
            </p>
          </div>
          <CloseDot @click="$emit('close')" />
        </header>

        <!-- Tab bar -->
        <nav v-if="set" class="flex items-center border-b border-slate-200 bg-slate-50" role="tablist">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="px-4 py-2.5 text-xs font-semibold transition-colors border-b-2"
            :class="activeTab === tab.id
              ? 'text-emerald-700 border-emerald-600 bg-white'
              : 'text-slate-600 border-transparent hover:text-slate-800 hover:bg-white/60'"
            :title="`${tab.label} — ${tab.tagline}`"
            @click="activeTab = tab.id"
          >
            <span aria-hidden="true" class="mr-1">{{ tab.emoji }}</span>{{ tab.label }}
          </button>
        </nav>

        <!-- Body -->
        <ScrollContainer class="flex-1 min-h-0" inner-class="p-5 space-y-4">

          <!-- Empty state — no set yet -->
          <div
            v-if="!set"
            class="text-center py-12 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/50"
          >
            <span class="text-5xl block mb-2" aria-hidden="true">🪴</span>
            <h3 class="text-lg font-bold text-emerald-800 mb-1">FEED ME!</h3>
            <p class="text-sm text-emerald-700 mb-1 italic">(yes, Audrey II from Little Shop of Horrors)</p>
            <p class="text-xs text-slate-600 mb-5 max-w-md mx-auto">
              I grow by being fed feedback.  Give me the older system context, the history of completed Evo steps, the very
              last increment (including lagging indicators), and I will surface tough questions to DEV and recommend actions
              to approve.  Every approved action carries Source + Reason as audit trail.
            </p>
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
                title="Copies a structured FEED ME! prompt for this plan to the clipboard. Paste it into Claudian; paste the JSON result back here."
                @click="onGenerateViaClaudian"
              >{{ copyFlash ? '✓ Prompt copied to clipboard' : 'Generate via Claudian' }}</button>
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
                title="Loads a generic mock FEED ME! set so you can see the layout"
                @click="loadMock"
              >Load Example</button>
            </div>
          </div>

          <!-- ── Tab: FEEDBACK BASE ─────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'feedback-base'">
            <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span aria-hidden="true">🌱</span>Feedback Base
              <span class="text-[11px] font-normal text-slate-500 ml-1">Everything about the older system this Evo plan integrates into</span>
            </h3>

            <section class="rounded-xl border border-slate-200 bg-white p-4">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-2">System Context</h4>
              <p class="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{{ set.feedbackBase.systemContext }}</p>
            </section>

            <section v-if="set.feedbackBase.baselineMetrics.length > 0" class="rounded-xl border border-slate-200 bg-white p-4">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-2">Baseline Metrics (before Evo project)</h4>
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="text-left text-slate-600 border-b border-slate-200">
                    <th class="py-1 pr-3">Value</th>
                    <th class="py-1 pr-3">Baseline</th>
                    <th class="py-1 pr-3">Goal</th>
                    <th class="py-1 pr-3">Notes</th>
                    <th class="py-1">Measured</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in set.feedbackBase.baselineMetrics" :key="m.valueRef" class="border-b border-slate-100">
                    <td class="py-1 pr-3 font-mono font-semibold text-slate-800">{{ m.valueRef }}</td>
                    <td class="py-1 pr-3">{{ m.baselineStatus }}</td>
                    <td class="py-1 pr-3">{{ m.goal }}</td>
                    <td class="py-1 pr-3 text-slate-600">{{ m.notes }}</td>
                    <td class="py-1 text-slate-500">{{ fmtDate(m.measuredAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section v-if="set.feedbackBase.knownConstraints.length > 0" class="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">Known Constraints of the existing system</h4>
              <ul class="text-sm text-slate-800 space-y-1 list-disc list-inside">
                <li v-for="(c, i) in set.feedbackBase.knownConstraints" :key="i">{{ c }}</li>
              </ul>
            </section>

            <section v-if="set.feedbackBase.integrationNotes.length > 0" class="rounded-xl border border-slate-200 bg-white p-4">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-2">Integration Notes</h4>
              <ul class="text-sm text-slate-800 space-y-1 list-disc list-inside">
                <li v-for="(n, i) in set.feedbackBase.integrationNotes" :key="i">{{ n }}</li>
              </ul>
            </section>
          </template>

          <!-- ── Tab: EVO BASE ──────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'evo-base'">
            <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span aria-hidden="true">📚</span>Evo Base
              <span class="text-[11px] font-normal text-slate-500 ml-1">Series of Evo steps done until now</span>
            </h3>

            <section v-if="set.evoBase.completedSteps.length > 0" class="space-y-2">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-slate-600">Completed Step Records</h4>
              <article
                v-for="step in set.evoBase.completedSteps"
                :key="step.stepName"
                class="rounded-xl border border-slate-200 bg-white p-3"
              >
                <header class="flex items-center justify-between mb-2">
                  <h5 class="text-sm font-bold text-slate-800">{{ step.stepName }}</h5>
                  <span class="text-[10px] text-slate-500">completed {{ fmtDate(step.completedAt) }}</span>
                </header>
                <div class="grid grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <p class="font-semibold text-emerald-700 mb-1">V. Status Δ</p>
                    <ul class="space-y-0.5 text-slate-700">
                      <li v-for="(d, v) in step.vStatusDelta" :key="v">
                        <span class="font-mono">{{ v }}</span>: <span :class="d >= 0 ? 'text-emerald-700' : 'text-red-700'" class="font-bold">{{ d >= 0 ? '+' : '' }}{{ d }}</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p class="font-semibold text-indigo-700 mb-1">Stakeholder feedback</p>
                    <ul class="space-y-0.5 text-slate-700 italic list-disc list-inside">
                      <li v-for="(f, i) in step.stakeholderFeedback" :key="i">{{ f }}</li>
                    </ul>
                  </div>
                  <div>
                    <p class="font-semibold text-amber-700 mb-1">Dev observations</p>
                    <ul class="space-y-0.5 text-slate-700 list-disc list-inside">
                      <li v-for="(o, i) in step.devObservations" :key="i">{{ o }}</li>
                    </ul>
                  </div>
                </div>
              </article>
            </section>

            <section v-if="set.evoBase.accumulatedFeedback.length > 0" class="rounded-xl border border-slate-200 bg-white p-4">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-2">Accumulated Feedback (all sources)</h4>
              <ul class="space-y-1.5">
                <li v-for="(f, i) in set.evoBase.accumulatedFeedback" :key="i" class="text-xs flex items-start gap-2">
                  <span class="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">{{ f.source }}</span>
                  <span class="text-slate-800 flex-1">{{ f.text }}</span>
                  <span class="text-[10px] text-slate-400 flex-shrink-0">{{ fmtDate(f.receivedAt) }}</span>
                </li>
              </ul>
            </section>

            <section v-if="set.evoBase.goodQuestionsAsked.length > 0" class="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
              <h4 class="text-[11px] font-bold uppercase tracking-wide text-violet-700 mb-2">Good Questions This Tool Has Asked</h4>
              <p class="text-[11px] text-violet-600 italic mb-2">Institutional memory — questions worth re-asking on every cycle</p>
              <ul class="text-sm text-slate-800 space-y-1 list-disc list-inside">
                <li v-for="(q, i) in set.evoBase.goodQuestionsAsked" :key="i">{{ q }}</li>
              </ul>
            </section>
          </template>

          <!-- ── Tab: LAST STEP IN PARIS ────────────────────────────────────── -->
          <template v-else-if="activeTab === 'last-step-in-paris'">
            <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span aria-hidden="true">💃</span>Last Step in Paris
              <span class="text-[11px] font-normal text-slate-500 ml-1">The very last Evo increment + LAGGING indicators (Tom: "nod to Last Tango")</span>
            </h3>

            <div v-if="!set.lastStepInParis" class="text-center text-slate-500 py-8">
              <p class="text-sm">No completed Evo step yet to analyse.</p>
            </div>

            <template v-else>
              <section class="rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50/50 to-pink-50/30 p-4">
                <header class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-bold text-red-800">{{ set.lastStepInParis.stepName }}</h4>
                  <span class="text-[10px] text-red-600">delivered {{ fmtDate(set.lastStepInParis.deliveredAt) }}</span>
                </header>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-1">Immediate measures</p>
                    <ul class="space-y-1 text-xs">
                      <li v-for="m in set.lastStepInParis.immediateMeasures" :key="m.valueRef + '-im'" class="flex items-center gap-2">
                        <span class="font-mono font-semibold text-slate-800">{{ m.valueRef }}</span>
                        <span class="font-bold text-emerald-700">{{ m.status }}</span>
                        <span class="text-[10px] text-slate-500 truncate">{{ m.measurementMethod }}</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-1">Lagging measures (~1 week later)</p>
                    <ul class="space-y-1 text-xs">
                      <li v-for="m in set.lastStepInParis.laggingMeasures" :key="m.valueRef + '-lag'" class="flex items-center gap-2">
                        <span class="font-mono font-semibold text-slate-800">{{ m.valueRef }}</span>
                        <span class="font-bold text-red-700">{{ m.status }}</span>
                        <span class="text-[10px] text-slate-500">+{{ m.daysAfterDelivery }}d</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <!-- Tough Questions -->
              <section v-if="set.lastStepInParis.toughQuestions.length > 0" class="space-y-3">
                <h4 class="text-[11px] font-bold uppercase tracking-wide text-red-700 flex items-center gap-2">
                  <span aria-hidden="true">🔥</span>Tough Questions to DEV
                  <span class="text-[10px] font-normal normal-case text-slate-500">— with clever AI-suggested answers DEV can accept, modify, or dismiss</span>
                </h4>

                <article
                  v-for="q in set.lastStepInParis.toughQuestions"
                  :key="q.id"
                  class="rounded-xl border-2 border-red-200 bg-white overflow-hidden"
                >
                  <header class="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between gap-2 flex-wrap">
                    <p class="text-sm font-bold text-red-900 flex-1 min-w-0">{{ q.text }}</p>
                    <SourceBadge v-if="q.answerProvenance" :provenance="q.answerProvenance" size="compact" />
                    <span
                      class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0"
                      :class="qStatusBadge(q.status).classes"
                    >{{ qStatusBadge(q.status).label }}</span>
                  </header>
                  <div class="p-3 space-y-2">
                    <p v-if="q.context" class="text-[11px] text-slate-600 italic"><span class="font-semibold not-italic">Context:</span> {{ q.context }}</p>

                    <div class="rounded-lg bg-indigo-50 border border-indigo-200 p-2.5">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-1">AI suggested answer</p>
                      <p class="text-xs text-slate-800 leading-relaxed">{{ q.suggestedAIAnswer }}</p>
                    </div>

                    <div v-if="q.devResponse && q.status !== 'pending'" class="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1">Dev response</p>
                      <p class="text-xs text-slate-800 leading-relaxed">{{ q.devResponse }}</p>
                    </div>

                    <!-- Modify-mode textarea -->
                    <div v-if="editingQId === q.id" class="space-y-2">
                      <textarea
                        v-model="editingQText"
                        rows="3"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="Modify the AI answer with DEV's actual response…"
                        aria-label="Modify AI answer with DEV's response"
                      />
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                          title="Save the modified response — stamps status='modified'"
                          @click="onSaveModify(q)"
                        >Save Modified</button>
                        <button
                          type="button"
                          class="px-3 py-1 rounded bg-white border border-slate-300 text-slate-700 text-xs hover:bg-slate-100"
                          title="Discard modifications"
                          @click="editingQId = ''; editingQText = ''"
                        >Cancel</button>
                      </div>
                    </div>

                    <!-- Action buttons (visible only when pending) -->
                    <div v-else-if="q.status === 'pending'" class="flex gap-2 pt-1">
                      <button
                        type="button"
                        class="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        title="Accept the AI answer as-is. Stamps status='accepted'."
                        @click="onAcceptQ(q)"
                      >Accept AI</button>
                      <button
                        type="button"
                        class="px-3 py-1 rounded bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                        title="Edit the answer to capture DEV's actual response. Stamps status='modified'."
                        @click="onStartModify(q)"
                      >Modify</button>
                      <button
                        type="button"
                        class="px-3 py-1 rounded bg-white border border-slate-300 text-slate-700 text-xs hover:bg-slate-100"
                        title="Dismiss this question as not relevant. Stamps status='dismissed'."
                        @click="onDismissQ(q)"
                      >Dismiss</button>
                    </div>
                  </div>
                </article>
              </section>
            </template>
          </template>

          <!-- ── Tab: RECOMMENDED ACTIONS ───────────────────────────────────── -->
          <template v-else-if="activeTab === 'actions'">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span aria-hidden="true">🛠️</span>Recommended Actions
                <span class="text-[11px] font-normal text-slate-500 ml-1">Audit trail enforced — every action carries Source + Reason</span>
              </h3>
              <label class="text-[11px] text-slate-600 flex items-center gap-1.5">
                Reviewer:
                <input
                  v-model="reviewerName"
                  type="text"
                  class="rounded border border-slate-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 w-24"
                  title="Stamped onto reviewedBy when you approve/reject an action"
                  aria-label="Your name (stamped onto reviews)"
                />
              </label>
            </div>

            <div v-if="set.recommendedActions.length === 0" class="text-center text-slate-500 py-8 text-sm">
              <p>No actions recommended yet.  Generate via Claudian or load an example.</p>
            </div>

            <article
              v-for="a in set.recommendedActions"
              :key="a.id"
              class="rounded-xl border-2 bg-white overflow-hidden"
              :class="a.status === 'approved' ? 'border-emerald-300'
                : a.status === 'rejected' ? 'border-red-300'
                : 'border-slate-200'"
            >
              <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                <span
                  class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                  :class="actionTypeBadge(a.type).classes"
                >{{ actionTypeBadge(a.type).label }}</span>
                <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ a.title }}</h4>
                <SourceBadge v-if="a.provenance" :provenance="a.provenance" size="compact" />
                <span
                  class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                  :class="actionStatusBadge(a.status).classes"
                >{{ actionStatusBadge(a.status).label }}</span>
              </header>
              <div class="p-3 space-y-2">
                <p class="text-xs text-slate-800 leading-relaxed">{{ a.description }}</p>

                <!-- AUDIT TRAIL: source + reason (required) -->
                <div class="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] space-y-1">
                  <p><span class="font-bold text-slate-700">Source:</span> <span class="text-slate-800">{{ a.source }}</span></p>
                  <p><span class="font-bold text-slate-700">Reason:</span> <span class="text-slate-800">{{ a.reason }}</span></p>
                </div>

                <!-- Review note (visible after approve/reject) -->
                <div v-if="a.reviewedAt && a.reviewNote" class="rounded-lg bg-indigo-50 border border-indigo-200 p-2.5 text-[11px]">
                  <p><span class="font-bold text-indigo-700">Review note ({{ a.reviewedBy }} · {{ fmtDateTime(a.reviewedAt) }}):</span> <span class="text-slate-800">{{ a.reviewNote }}</span></p>
                </div>
                <p v-else-if="a.reviewedAt" class="text-[10px] text-slate-500">
                  Reviewed by <span class="font-semibold">{{ a.reviewedBy }}</span> at {{ fmtDateTime(a.reviewedAt) }}
                </p>

                <!-- Pending: action buttons + review-note input -->
                <div v-if="a.status === 'pending'" class="space-y-2 pt-1">
                  <input
                    v-model="reviewNoteByActionId[a.id]"
                    type="text"
                    placeholder="Optional review note (recorded with approval/rejection)…"
                    class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    :aria-label="`Review note for action ${a.title}`"
                  />
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                      :title="`Approve as ${reviewerName}. Stamps reviewedAt + reviewedBy + reviewNote into the audit trail.`"
                      @click="onApproveAction(a)"
                    >Approve</button>
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                      :title="`Reject as ${reviewerName}. Stamps audit trail.`"
                      @click="onRejectAction(a)"
                    >Reject</button>
                  </div>
                </div>

                <!-- Reviewed: undo button -->
                <div v-else class="pt-1">
                  <button
                    type="button"
                    class="px-3 py-1 rounded bg-white border border-slate-300 text-slate-700 text-xs hover:bg-slate-100"
                    title="Reset to pending — clears the review stamp"
                    @click="onResetAction(a)"
                  >Reset to pending</button>
                </div>
              </div>
            </article>
          </template>

          <!-- Paste area — visible after Generate-via-Claudian -->
          <section v-if="set && showPaste" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 class="text-xs font-bold text-slate-700 mb-1">Paste FEED ME! JSON from Claudian</h4>
            <p class="text-[11px] text-slate-500 mb-2">The pasted set REPLACES the current one.  Audit trail on existing approved actions will be lost.</p>
            <textarea
              v-model="pasteText"
              rows="4"
              placeholder='{"feedbackBase": {...}, "evoBase": {...}, "recommendedActions": [...]}'
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-label="Paste JSON from Claudian"
            />
            <div class="flex items-center gap-2 mt-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                title="Validate and replace the current FEED ME! set"
                @click="onPaste"
              >Paste &amp; Save</button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100"
                title="Hide the paste area"
                @click="showPaste = false; pasteText = ''"
              >Cancel</button>
              <p v-if="lastError" class="text-xs text-red-700 ml-2">{{ lastError }}</p>
            </div>
          </section>
        </ScrollContainer>

        <!-- Footer -->
        <footer
          v-if="set"
          class="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs"
        >
          <span class="text-slate-600">
            Generated {{ set.generatedBy }} · {{ fmtDateTime(set.generatedAt) }}
          </span>
          <div class="flex-1" />
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors text-xs font-medium"
            title="Clear the entire FEED ME! set for this plan"
            @click="onClearConfirm"
          >Clear All</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
            title="Copy a fresh FEED ME! prompt and paste the JSON result back to refresh the set"
            @click="onGenerateViaClaudian"
          >{{ copyFlash ? '✓ Copied' : 'Regenerate via Claudian' }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
