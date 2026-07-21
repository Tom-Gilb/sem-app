<!-- UNIT_TYPE=Surface
  ElonSharpeningPanel.vue — Question/answer Sharpening tool for the Elon Agent.

  Tom Gilb 2026-06-12 verbatim:
    "OK Major new Agent: 'Elon': will be based on my Musks Methods book... The pattern is
     Incorruptible (based on Ries). Just make it, you have the MM book."

  Architecture:
    - Nine categories matching the Elon finding categories — Pace of Innovation (DOMINANT)
      first, then the 5-step Musk algorithm, then vertical integration + Idiot Index.
    - Per category: 2 pointed questions, each with 3 AI-suggested starter answers + provenance badges
    - User answers + selections → synthesise ElonFinding[] via useElonSharpSynthesis
    - Synthesised findings emit via 'synthesise-findings' event — host (App.vue) applies them
      via applyElonFix → source stamping + accept state + Universal Undo all just work

  UI Rules applied:
    - CloseDot at END of header (rightmost) — Universal Close-Button Rule
    - Raw overflow-y-auto on body — narrow exception per centered Teleport card pattern
    - z-[490] panel / z-[485] backdrop — Major surfaces tier
    - All buttons have title= — DD-009 Interaction Disclosure (HoverHints)
    - American English; spell out type names; no "tooltip" — banned word
    - R/G-colorblind-safe palette; cyan accent for pace-of-innovation DOMINANT axis
-->

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import CloseDot from './CloseDot.vue'
import type { SpecBlock } from '../types/spec'
import {
  ELON_SHARP_CATEGORIES,
  totalElonSharpQuestions,
  type ElonSharpCategory,
} from '../data/elonSharpInterview'
import {
  synthesiseElonFindings,
  type AnsweredQuestion,
} from '../composables/useElonSharpSynthesis'
import {
  copyUniversalSharp,
  emailUniversalSharp,
  type UniversalSharpExportInput,
} from '../composables/useUniversalSharpExport'
import { generatePlanDerivedSuggestions } from '../composables/useElonSharpPlanContext'
import type { ElonFinding, ElonCategory } from '../types/elon'
// Elon categories r2 — 11 categories per Tom Gilb 2026-06-13 verbatim list
// (pace-of-innovation DOMINANT + 10 others)

const props = withDefaults(defineProps<{
  spec: SpecBlock | null
  planTitle: string
  isModel?: boolean
}>(), {
  isModel: false,
})

const emit = defineEmits<{
  close: []
  'synthesise-findings': [findings: ElonFinding[]]
}>()

// Plan-derived suggestions per question (highest provenance)
const planDerivedSuggestions = computed(() => generatePlanDerivedSuggestions(props.spec ?? null))

// localStorage persistence of answers
const STORAGE_KEY_PREFIX = 'elonSharp:answers:'
function storageKey(): string {
  return `${STORAGE_KEY_PREFIX}${props.planTitle || 'untitled'}`
}

interface QAState {
  answer: string
  selectedSuggestionIndexes: number[]
  planDerivedSelected?: boolean
}

const answers = ref<Map<string, QAState>>(new Map())

onMounted(() => {
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw) {
      const data = JSON.parse(raw) as Array<[string, QAState]>
      if (Array.isArray(data)) answers.value = new Map(data)
    }
  } catch { /* localStorage may not be available — silent degrade */ }
})

watch(answers, (next) => {
  try {
    localStorage.setItem(storageKey(), JSON.stringify([...next.entries()]))
  } catch { /* silent degrade */ }
}, { deep: true })

function clearAllAnswers(): void {
  if (!confirm('Clear all your Elon Sharpening answers for this plan? This cannot be undone.')) return
  answers.value = new Map()
  try { localStorage.removeItem(storageKey()) } catch { /* */ }
}

function qaKey(catId: string, qId: string): string {
  return `${catId}|${qId}`
}

function getQA(catId: string, qId: string): QAState {
  const key = qaKey(catId, qId)
  return answers.value.get(key) ?? { answer: '', selectedSuggestionIndexes: [] }
}

function setAnswer(catId: string, qId: string, text: string): void {
  const key  = qaKey(catId, qId)
  const next = new Map(answers.value)
  const cur  = next.get(key) ?? { answer: '', selectedSuggestionIndexes: [] }
  next.set(key, { ...cur, answer: text })
  answers.value = next
}

function toggleSuggestion(catId: string, qId: string, idx: number): void {
  const key  = qaKey(catId, qId)
  const next = new Map(answers.value)
  const cur  = next.get(key) ?? { answer: '', selectedSuggestionIndexes: [] }
  const set  = new Set(cur.selectedSuggestionIndexes)
  if (set.has(idx)) set.delete(idx)
  else              set.add(idx)
  next.set(key, { ...cur, selectedSuggestionIndexes: [...set].sort((a, b) => a - b) })
  answers.value = next
}

function isSelected(catId: string, qId: string, idx: number): boolean {
  return getQA(catId, qId).selectedSuggestionIndexes.includes(idx)
}

function togglePlanDerived(catId: string, qId: string): void {
  const key  = qaKey(catId, qId)
  const next = new Map(answers.value)
  const cur  = next.get(key) ?? { answer: '', selectedSuggestionIndexes: [] }
  next.set(key, { ...cur, planDerivedSelected: !cur.planDerivedSelected })
  answers.value = next
}

function isPlanDerivedSelected(catId: string, qId: string): boolean {
  return !!getQA(catId, qId).planDerivedSelected
}

const activeCategoryId = ref<ElonSharpCategory['id']>(ELON_SHARP_CATEGORIES[0].id)
const activeCategory   = computed<ElonSharpCategory>(
  () => ELON_SHARP_CATEGORIES.find(c => c.id === activeCategoryId.value) ?? ELON_SHARP_CATEGORIES[0],
)

function categoryProgress(cat: ElonSharpCategory): { answered: number; total: number } {
  let answered = 0
  for (const q of cat.questions) {
    const qa = getQA(cat.id, q.id)
    if (qa.answer.trim().length > 0 || qa.selectedSuggestionIndexes.length > 0 || qa.planDerivedSelected) answered++
  }
  return { answered, total: cat.questions.length }
}

const totalAnswered = computed<number>(() => {
  let n = 0
  for (const cat of ELON_SHARP_CATEGORIES) {
    n += categoryProgress(cat).answered
  }
  return n
})

const totalQuestions = totalElonSharpQuestions()

function buildAnsweredList(): AnsweredQuestion[] {
  const out: AnsweredQuestion[] = []
  for (const cat of ELON_SHARP_CATEGORIES) {
    for (const q of cat.questions) {
      const qa = getQA(cat.id, q.id)
      const hasInput = qa.answer.trim().length > 0 || qa.selectedSuggestionIndexes.length > 0 || qa.planDerivedSelected
      if (!hasInput) continue
      const planDerived = qa.planDerivedSelected ? planDerivedSuggestions.value.get(q.id) : null
      const fullAnswer = [
        planDerived ? `[Plan-derived] ${planDerived.text}` : '',
        qa.answer,
      ].filter(Boolean).join('\n\n')
      out.push({
        categoryId:                cat.id as ElonCategory,
        questionId:                q.id,
        category:                  cat,
        answer:                    fullAnswer,
        selectedSuggestionIndexes: qa.selectedSuggestionIndexes,
      })
    }
  }
  return out
}

function synthesiseAndApply(): void {
  const answered  = buildAnsweredList()
  const findings  = synthesiseElonFindings(answered, props.spec ?? null)
  if (findings.length === 0) return
  emit('synthesise-findings', findings)
}

function synthesiseAndApplyOne(catId: string, qId: string): void {
  const cat = ELON_SHARP_CATEGORIES.find(c => c.id === catId)
  if (!cat) return
  const qa = getQA(catId, qId)
  const hasInput = qa.answer.trim().length > 0 || qa.selectedSuggestionIndexes.length > 0 || qa.planDerivedSelected
  if (!hasInput) return
  const planDerived = qa.planDerivedSelected ? planDerivedSuggestions.value.get(qId) : null
  const fullAnswer = [
    planDerived ? `[Plan-derived] ${planDerived.text}` : '',
    qa.answer,
  ].filter(Boolean).join('\n\n')
  const single: AnsweredQuestion[] = [{
    categoryId:                catId as ElonCategory,
    questionId:                qId,
    category:                  cat,
    answer:                    fullAnswer,
    selectedSuggestionIndexes: qa.selectedSuggestionIndexes,
  }]
  const findings = synthesiseElonFindings(single, props.spec ?? null)
  if (findings.length === 0) return
  emit('synthesise-findings', findings)
}

function questionHasInput(catId: string, qId: string): boolean {
  const qa = getQA(catId, qId)
  return qa.answer.trim().length > 0 || qa.selectedSuggestionIndexes.length > 0 || !!qa.planDerivedSelected
}

const canSynthesise = computed(() => totalAnswered.value > 0)

// r41 v283 (Tom Gilb 2026-06-22 "All sharpening answers must be exportable")
function _buildExportInput(): UniversalSharpExportInput {
  return {
    panelName: 'Elon Sharpening',
    planName:  props.planTitle || 'Untitled Plan',
    subtitle:  'Q&A across Musk-method categories — Five-Step Engineering / First Principles / Velocity of Learning.',
    sections:  ELON_SHARP_CATEGORIES.map(cat => ({
      headline: cat.label,
      subtitle: cat.description,
      color:    /amber/.test(cat.accent)  ? '#d97706'
              : /violet/.test(cat.accent) ? '#7c3aed'
              : /rose/.test(cat.accent)   ? '#e11d48'
              : /emerald/.test(cat.accent)? '#059669'
              : /sky/.test(cat.accent)    ? '#0284c7'
              : /indigo/.test(cat.accent) ? '#4f46e5'
              : '#475569',
      items: cat.questions.map(q => {
        const qa = getQA(cat.id, q.id)
        const ticked = new Set(qa.selectedSuggestionIndexes ?? [])
        const suggestions = q.suggestedAnswers.map((text, idx) => ({
          text,
          ticked: ticked.has(idx),
          source: q.suggestedAnswerProvenances?.[idx]?.note,
        }))
        const planSuggestion = planDerivedSuggestions.value.get(`${cat.id}|${q.id}`)
        if (planSuggestion) {
          suggestions.push({ text: planSuggestion, ticked: !!qa.planDerivedSelected, source: 'Plan-derived' })
        }
        return { question: q.text, typed: qa.answer ?? '', suggestions, rationale: q.rationale }
      }),
    })),
  }
}
async function copyAllAnswers(): Promise<void>  { await copyUniversalSharp(_buildExportInput())  }
async function emailAllAnswers(): Promise<void> { await emailUniversalSharp(_buildExportInput()) }

function provenanceBadge(source: string): { label: string; cls: string } {
  switch (source) {
    case 'plan':      return { label: 'Plan',     cls: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300' }
    case 'gilb':      return { label: 'Gilb/Musk', cls: 'bg-cyan-100 text-cyan-900 ring-1 ring-cyan-300' }
    case 'standards': return { label: 'Standard', cls: 'bg-violet-100 text-violet-900 ring-1 ring-violet-300' }
    case 'internet':  return { label: 'Internet', cls: 'bg-blue-100 text-blue-900 ring-1 ring-blue-300' }
    case 'llm':       return { label: 'LLM',      cls: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300' }
    case 'template':
    default:          return { label: 'Template', cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300' }
  }
}

void props.spec
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[485] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <div
      class="fixed inset-0 z-[490] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Elon Sharpening — question-and-answer-driven Musk's-Methods refinement"
    >
      <div
        class="pointer-events-auto w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-900 via-cyan-900 to-slate-900 shrink-0">
          <span class="text-3xl" aria-hidden="true">🔪</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-bold text-white leading-tight tracking-tight">
              Elon Sharpening
              <span class="text-[11px] font-normal text-cyan-200 uppercase tracking-wider ml-2">
                Musk's Methods · Pace · Q&amp;A
              </span>
            </h2>
            <p class="text-[13px] text-white/80 leading-snug mt-1 italic">
              Probe context the deterministic engine can't infer. Selected answers synthesise into Plan edits.
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-white/15 text-white text-[12px] font-bold">
            {{ totalAnswered }} / {{ totalQuestions }} answered
          </span>
          <button
            v-if="totalAnswered > 0"
            type="button"
            class="px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-slate-500"
            title="Clear all your Elon Sharpening answers for this plan. Answers persist to localStorage across sessions; this wipes them. Confirmation required."
            @click="clearAllAnswers"
          >🗑 Clear</button>
          <!-- r41 v283 — Copy + Email -->
          <button type="button" class="px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-indigo-400" title="📋 Copy all Sharpening Q&A as colourful HTML" @click="copyAllAnswers">📋 Copy</button>
          <button type="button" class="px-2.5 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-indigo-500" title="📧 Email all Sharpening Q&A — opens Mail.app pre-filled" @click="emailAllAnswers">📧 Email</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded text-[12px] font-bold whitespace-nowrap transition-colors ring-1 flex items-center gap-1"
            :class="canSynthesise
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-emerald-800'
              : 'bg-slate-600 text-slate-300 ring-slate-700 cursor-not-allowed'"
            :disabled="!canSynthesise"
            :title="canSynthesise
              ? `Synthesise ${totalAnswered} answered question(s) into Elon findings, then apply via the standard Accept-Fix pipeline (Source-stamping + Undo all preserved)`
              : 'Answer at least one question (free-text OR ticked suggestion) before synthesising'"
            @click="synthesiseAndApply"
          >
            ✓ Synthesise &amp; Apply ({{ totalAnswered }})
          </button>
          <CloseDot
            variant="on-dark"
            size="lg"
            aria-label="Close Elon Sharpening"
            title="Close Elon Sharpening — your answers persist for this session"
            @click="emit('close')"
          />
        </div>

        <div
          v-if="isModel"
          class="px-5 py-2 bg-amber-50 border-b border-amber-200 shrink-0 flex items-center gap-2 text-[12px] text-amber-900"
        >
          <span class="text-base">🗂️</span>
          <span><b>Model Mode:</b> sharpening <i>{{ planTitle }}</i> — Synthesise &amp; Apply runs as PREVIEW (no changes to your Plan).</span>
        </div>

        <!-- Two-pane body -->
        <div class="flex-1 min-h-0 flex">

          <!-- LEFT: category sidebar -->
          <nav
            class="w-64 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto"
            aria-label="Elon Sharpening categories"
          >
            <ul class="py-2">
              <li
                v-for="cat in ELON_SHARP_CATEGORIES"
                :key="cat.id"
              >
                <button
                  type="button"
                  class="w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slate-100"
                  :class="activeCategoryId === cat.id ? 'bg-white border-r-4 border-cyan-600' : ''"
                  :title="`Open ${cat.label} questions — ${categoryProgress(cat).answered}/${categoryProgress(cat).total} answered`"
                  @click="activeCategoryId = cat.id"
                >
                  <span
                    class="w-2.5 h-full min-h-[40px] rounded-full shrink-0 mt-0.5"
                    :class="cat.accent"
                    aria-hidden="true"
                  ></span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-[13px] font-bold text-slate-800 leading-tight">{{ cat.label }}</span>
                    <span class="block text-[11px] text-slate-600 leading-snug mt-0.5">{{ cat.description }}</span>
                    <span class="block text-[11px] font-mono mt-1"
                      :class="categoryProgress(cat).answered > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400'"
                    >{{ categoryProgress(cat).answered }} / {{ categoryProgress(cat).total }} answered</span>
                  </span>
                </button>
              </li>
            </ul>
          </nav>

          <!-- RIGHT: question pane -->
          <section class="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6" :aria-label="`${activeCategory.label} questions`">
            <header>
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="inline-block w-3 h-3 rounded-full"
                  :class="activeCategory.accent"
                  aria-hidden="true"
                ></span>
                <h3 class="text-[16px] font-bold text-slate-800 uppercase tracking-wide">{{ activeCategory.label }}</h3>
              </div>
              <p class="text-[13px] text-slate-600">{{ activeCategory.description }}</p>
            </header>

            <article
              v-for="q in activeCategory.questions"
              :key="q.id"
              class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
            >
              <div>
                <h4 class="text-[14px] font-semibold text-slate-900 leading-snug">{{ q.text }}</h4>
                <p v-if="q.rationale" class="text-[12px] text-slate-500 italic leading-snug mt-1">{{ q.rationale }}</p>
              </div>

              <div class="space-y-2">
                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  ✨ AI-suggested starter answers <span class="text-slate-400 normal-case font-normal italic">(tick to include)</span>
                </div>
                <ul class="space-y-2">
                  <li v-if="planDerivedSuggestions.get(q.id)">
                    <label
                      class="flex items-start gap-2.5 p-2.5 rounded-lg border-2 cursor-pointer transition-colors"
                      :class="isPlanDerivedSelected(activeCategory.id, q.id)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70'"
                    >
                      <input
                        type="checkbox"
                        class="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                        :checked="isPlanDerivedSelected(activeCategory.id, q.id)"
                        @change="togglePlanDerived(activeCategory.id, q.id)"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-[13px] text-slate-800 leading-snug">{{ planDerivedSuggestions.get(q.id)?.text }}</p>
                        <span
                          class="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 ring-1 ring-emerald-400"
                          :title="planDerivedSuggestions.get(q.id)?.provenance.note ?? 'Derived from your current Plan data'"
                        >
                          🌟 Plan-derived
                          <span class="font-normal opacity-80">· {{ planDerivedSuggestions.get(q.id)?.provenance.note }}</span>
                        </span>
                      </div>
                    </label>
                  </li>
                </ul>
                <ul class="space-y-2">
                  <li
                    v-for="(suggestion, idx) in q.suggestedAnswers"
                    :key="idx"
                  >
                    <label
                      class="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors"
                      :class="isSelected(activeCategory.id, q.id, idx)
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'"
                    >
                      <input
                        type="checkbox"
                        class="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                        :checked="isSelected(activeCategory.id, q.id, idx)"
                        @change="toggleSuggestion(activeCategory.id, q.id, idx)"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-[13px] text-slate-800 leading-snug">{{ suggestion }}</p>
                        <span
                          v-if="q.suggestedAnswerProvenances[idx]"
                          class="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          :class="provenanceBadge(q.suggestedAnswerProvenances[idx].source).cls"
                          :title="q.suggestedAnswerProvenances[idx].note || provenanceBadge(q.suggestedAnswerProvenances[idx].source).label"
                        >
                          {{ provenanceBadge(q.suggestedAnswerProvenances[idx].source).label }}
                          <span v-if="q.suggestedAnswerProvenances[idx].note" class="font-normal opacity-80">· {{ q.suggestedAnswerProvenances[idx].note }}</span>
                        </span>
                      </div>
                    </label>
                  </li>
                </ul>
              </div>

              <div>
                <div class="text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1">
                  ✍ Your answer <span class="text-slate-400 normal-case font-normal italic">(optional — adds to ticked suggestions)</span>
                </div>
                <textarea
                  :value="getQA(activeCategory.id, q.id).answer"
                  :placeholder="q.placeholder || 'Your answer (combines with any ticked suggestions above)…'"
                  class="w-full min-h-[80px] text-[13px] border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none transition-all"
                  :title="`Free-text answer to: ${q.text}`"
                  @input="setAnswer(activeCategory.id, q.id, ($event.target as HTMLTextAreaElement).value)"
                ></textarea>
              </div>

              <div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded text-[12px] font-bold transition-colors ring-1 flex items-center gap-1"
                  :class="questionHasInput(activeCategory.id, q.id)
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-emerald-800'
                    : 'bg-slate-200 text-slate-400 ring-slate-300 cursor-not-allowed'"
                  :disabled="!questionHasInput(activeCategory.id, q.id)"
                  :title="questionHasInput(activeCategory.id, q.id)
                    ? `Apply ONLY this question's answer to the Plan now — source-stamped + Undo available. Other unanswered or unticked questions are NOT touched.`
                    : 'Tick a suggestion or type a free-text answer first'"
                  @click="synthesiseAndApplyOne(activeCategory.id, q.id)"
                >
                  ✓ Apply This Answer
                </button>
              </div>
            </article>

            <!-- Bottom mirror of header "Synthesise & Apply" button per DD-014 -->
            <div
              class="rounded-xl border-t-4 border-emerald-300 bg-emerald-50 p-4 mt-8 flex items-center gap-3 flex-wrap"
            >
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-bold text-emerald-900 uppercase tracking-wide">
                  ✓ End of {{ activeCategory.label }}
                </p>
                <p class="text-[12px] text-emerald-800 mt-0.5">
                  {{ totalAnswered }} / {{ totalQuestions }} questions answered across all categories.
                  Apply ALL answered questions now, or use the per-question "Apply This Answer" buttons above for finer control.
                </p>
              </div>
              <button
                type="button"
                class="px-4 py-2 rounded text-[13px] font-bold transition-colors ring-1 flex items-center gap-1.5 whitespace-nowrap"
                :class="canSynthesise
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-emerald-800'
                  : 'bg-slate-200 text-slate-400 ring-slate-300 cursor-not-allowed'"
                :disabled="!canSynthesise"
                :title="canSynthesise
                  ? `Synthesise ALL ${totalAnswered} answered question(s) across all categories into Plan edits — same action as the top button. DD-014 bottom mirror.`
                  : 'Answer at least one question first'"
                @click="synthesiseAndApply"
              >
                ✓ Synthesise &amp; Apply All ({{ totalAnswered }})
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
