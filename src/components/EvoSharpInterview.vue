<!-- UNIT_TYPE=Panel -->
<!--
/**
 * EvoSharpInterview — the "Sharpen Next Step" modal.
 *
 * Tom Gilb 2026-06-03 (verbatim):
 *   *"Evo Tool: 'Next Value Step Focus' (or something like that)...
 *     Sub-Tool 'Evo Sharp Interview' (Like the sharpening questions and
 *     answers) but very focussed on Evo Value Delivery,
 *     Evo Sharp Categories suggestion (add more): Task Definition,
 *     Solution Element Selection, Value Delivery Focus, Solution Redesign,
 *     Experience Capture, Feedback Learning, Resources Management,
 *     Risk Management."*
 *
 * UX:
 *   - Step picker (dropdown) selects WHICH Evo Step to sharpen
 *   - Sidebar lists all categories with answered/total counts
 *   - Main pane shows the active category's questions as textareas
 *   - Footer: progress bar, Export (markdown), Start Fresh
 *   - All answers persist to localStorage via useEvoSharpAnswers
 *
 * Categories shipped: Tom's 8 + 4 PROPOSED (Stakeholder Visibility,
 * Acceptance/Done, Cycle Fit, Decomposition). PROPOSED categories show
 * a small "PROPOSED" badge so Tom can decide which to keep.
 *
 * Rules complied with:
 *   - Single-Surface — caller (App.vue) registers `evoSharpOpen` exclusive
 *   - ScrollContainer — main question pane + sidebar both wrapped
 *   - CloseDot — header uses <CloseDot> at end (right) of flex header
 *   - Planguage-Glyph-First — header uses <PlEvoStepIcon>
 *   - Interaction Disclosure — every button has :title
 *   - Banned-Scrum-Vocabulary — all labels use Planguage / Evo vocabulary
 *
 * Twin portability: pure data input (`steps: EvoStep[]`), pure event output
 * (close, export). No global state coupling.
 */
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import { EVO_SHARP_CATEGORIES, totalQuestionCount, type SharpCategory } from '../data/evoSharpInterview'
import { useEvoSharpAnswers } from '../composables/useEvoSharpAnswers'
import SourceBadge from './SourceBadge.vue'
import type { SourceProvenance } from '../data/aiSource'
import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  /** All Evo Steps from useEvoPlan — populates the step picker. */
  steps: EvoStep[]
  /** Stable plan identifier (e.g., plan model name) for localStorage scoping. */
  planId?: string
}>()

defineEmits<{
  close: []
}>()

// ── Step selection ───────────────────────────────────────────────────────────
// Default to the FIRST step on open. User can change via dropdown.
const selectedStepName = ref<string>(props.steps[0]?.name ?? '')

// When steps change (e.g., regeneration), reset to first if current selection
// is no longer valid. Preserves selection when steps just got edited/renamed.
watch(
  () => props.steps,
  (newSteps) => {
    if (!newSteps.some(s => s.name === selectedStepName.value)) {
      selectedStepName.value = newSteps[0]?.name ?? ''
    }
  },
)

const selectedStep = computed<EvoStep | undefined>(() =>
  props.steps.find(s => s.name === selectedStepName.value),
)

// ── Answer persistence (2nd edition — Tom 2026-06-03 suggestions+modes) ─────
const planIdRef = computed(() => props.planId ?? 'default')
const stepNameRef = computed(() => selectedStepName.value)
const {
  getAnswer,
  setTypedAnswer,
  toggleTicked,
  setMode,
  isTicked,
  getEffectiveAnswer,
  clear,
  answeredCount,
  answeredInCategory,
} = useEvoSharpAnswers(planIdRef, stepNameRef)

// Selection mode picker metadata — drives the pill row under each question
const SELECTION_MODES: Array<{ id: 'mixed' | 'all' | 'typed-only' | 'ticked-only'; label: string; title: string }> = [
  { id: 'mixed',       label: 'Mixed (default)', title: 'Typed answer + only TICKED suggestions.  This is the default — Tom 2026-06-03.' },
  { id: 'all',         label: 'All',              title: 'Typed answer + ALL 3 suggestions (ignores ticked state).' },
  { id: 'typed-only',  label: 'My answer only',   title: 'Just the typed answer; suggestions excluded regardless of ticks.' },
  { id: 'ticked-only', label: 'Ticked only',      title: 'Just the ticked suggestions; typed answer excluded.' },
]

// ── Category navigation ──────────────────────────────────────────────────────
const activeCategoryId = ref<string>(EVO_SHARP_CATEGORIES[0]?.id ?? '')

const activeCategory = computed<SharpCategory | undefined>(() =>
  EVO_SHARP_CATEGORIES.find(c => c.id === activeCategoryId.value),
)

// ── Progress ─────────────────────────────────────────────────────────────────
const totalQuestions = totalQuestionCount()
const _allCategoriesForCount = EVO_SHARP_CATEGORIES
const progressPercent = computed<number>(() =>
  totalQuestions === 0 ? 0 : Math.round((answeredCount(_allCategoriesForCount) / totalQuestions) * 100),
)
const totalAnsweredCount = computed<number>(() => answeredCount(_allCategoriesForCount))

// ── Export (markdown) — now uses the EFFECTIVE answer (Tom 2026-06-03) ──────
const showExport = ref(false)
const exportedText = ref<string>('')

function buildExport(): string {
  if (!selectedStep.value) return '(no step selected)'
  const step = selectedStep.value
  const lines: string[] = [
    `# Sharpen Next Step — ${step.name}`,
    '',
    `**Description:** ${step.description}`,
    `**Effort %:** ${step.effortPercent}`,
    `**Linked Values:** ${step.linkedValues.join(', ') || '(none)'}`,
    `**Linked Solutions:** ${step.linkedSolutions.join(', ') || '(none)'}`,
    '',
    '---',
    '',
  ]
  for (const cat of EVO_SHARP_CATEGORIES) {
    const answersHere = cat.questions
      .map(q => ({ q, eff: getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? []) }))
      .filter(x => x.eff.trim().length > 0)
    if (answersHere.length === 0) continue
    lines.push(`## ${cat.label}${cat.proposed ? ' (PROPOSED category)' : ''}`)
    lines.push('')
    for (const { q, eff } of answersHere) {
      lines.push(`**${q.text}**`)
      const a = getAnswer(cat.id, q.id)
      lines.push(`_(${a.mode} mode — typed: ${a.typed.trim().length > 0 ? 'yes' : 'no'} · ticked: ${a.ticked.length} of ${(q.suggestedAnswers ?? []).length})_`)
      lines.push('')
      lines.push(eff)
      lines.push('')
    }
  }
  return lines.join('\n')
}

function onExport(): void {
  exportedText.value = buildExport()
  showExport.value = true
  // Copy to clipboard for convenience
  if (navigator.clipboard) {
    navigator.clipboard.writeText(exportedText.value).catch(() => { /* ignore */ })
  }
}

function onClearConfirm(): void {
  if (confirm(`Clear ALL answers for "${selectedStepName.value}"? This cannot be undone.`)) {
    clear()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evo-sharp-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
          <PlEvoStepIcon size="md" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="evo-sharp-title" class="text-base font-bold">Sharpen Next Step</h2>
            <p class="text-[11px] text-amber-50 mt-0.5">
              Evo Sharp Interview · {{ totalAnsweredCount }} of {{ totalQuestions }} questions answered ({{ progressPercent }}%) · Default mode: <span class="font-bold">Mixed</span> (Planner answer + ticked suggestions)
            </p>
          </div>

          <!-- Step picker -->
          <label class="flex items-center gap-2 text-xs text-amber-50">
            <span class="font-semibold">Step:</span>
            <select
              v-model="selectedStepName"
              class="text-sm text-slate-900 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 max-w-[260px]"
              :title="`Pick which Evo Step to sharpen. Answers persist per step.`"
              aria-label="Select Evo Step to sharpen"
            >
              <option v-for="step in steps" :key="step.name" :value="step.name">
                {{ step.name }}
              </option>
            </select>
          </label>

          <CloseDot @click="$emit('close')" />
        </header>

        <!-- Progress bar -->
        <div class="h-1.5 bg-slate-100">
          <div
            class="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-300"
            :style="{ width: progressPercent + '%' }"
            role="progressbar"
            :aria-valuenow="progressPercent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Interview progress ${progressPercent}%`"
          />
        </div>

        <!-- Body — sidebar + main pane -->
        <div class="flex-1 flex min-h-0">

          <!-- Sidebar — category list -->
          <ScrollContainer class="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50" inner-class="p-2 space-y-0.5">
            <button
              v-for="cat in EVO_SHARP_CATEGORIES"
              :key="cat.id"
              type="button"
              class="w-full text-left rounded-lg px-3 py-2 transition-colors group"
              :class="cat.id === activeCategoryId
                ? 'bg-white shadow-sm ring-1 ring-amber-200'
                : 'hover:bg-white/70'"
              :title="`${cat.label} — ${cat.description}. ${answeredInCategory(cat.id, cat.questions)} of ${cat.questions.length} answered.`"
              @click="activeCategoryId = cat.id"
            >
              <div class="flex items-center gap-2 mb-0.5">
                <div class="w-1 h-3.5 rounded-full" :class="cat.accent" aria-hidden="true" />
                <span class="text-[12px] font-semibold text-slate-800 leading-tight flex-1">{{ cat.label }}</span>
                <span
                  class="text-[9px] font-mono px-1 py-px rounded"
                  :class="answeredInCategory(cat.id, cat.questions) === cat.questions.length
                    ? 'bg-emerald-100 text-emerald-700'
                    : answeredInCategory(cat.id, cat.questions) > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-400'"
                  :aria-label="`${answeredInCategory(cat.id, cat.questions)} of ${cat.questions.length} answered`"
                >{{ answeredInCategory(cat.id, cat.questions) }}/{{ cat.questions.length }}</span>
              </div>
              <p class="text-[10px] text-slate-500 leading-snug ml-3">{{ cat.description }}</p>
              <span
                v-if="cat.proposed"
                class="inline-block text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 mt-1 ml-3 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                title="This category was proposed by Claudian 2026-06-03. Keep, edit, or remove via src/data/evoSharpInterview.ts."
              >Proposed</span>
            </button>
          </ScrollContainer>

          <!-- Main pane — questions for active category -->
          <ScrollContainer class="flex-1 min-h-0" inner-class="p-6 space-y-5">
            <div v-if="!selectedStep" class="text-center text-slate-500 py-12">
              <p>No Evo Step selected — pick one from the dropdown above, or generate an Evo plan first.</p>
            </div>

            <template v-else-if="activeCategory">
              <!-- Category header -->
              <div class="border-b border-slate-200 pb-3">
                <div class="flex items-center gap-2 mb-1">
                  <div class="w-1.5 h-5 rounded-full" :class="activeCategory.accent" aria-hidden="true" />
                  <h3 class="text-base font-bold text-slate-800">{{ activeCategory.label }}</h3>
                  <span
                    v-if="activeCategory.proposed"
                    class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                  >Proposed</span>
                </div>
                <p class="text-xs text-slate-600">{{ activeCategory.description }}</p>
                <p class="text-[11px] text-slate-500 mt-1">
                  Sharpening: <span class="font-mono text-slate-700">{{ selectedStep.name }}</span>
                </p>
              </div>

              <!-- Questions (2026-06-03 Tom: typed Planner answer + 3 tickable
                   suggested answers + 4 selection modes + effective preview).
                   Default mode = 'mixed' (typed + ticked suggestions). -->
              <div
                v-for="q in activeCategory.questions"
                :key="q.id"
                class="space-y-2 pb-4 border-b border-slate-100 last:border-b-0"
              >
                <!-- Question + rationale -->
                <label class="block">
                  <span class="text-sm font-semibold text-slate-800">{{ q.text }}</span>
                  <span v-if="q.rationale" class="block text-[11px] text-slate-500 italic mt-0.5">
                    Why this matters: {{ q.rationale }}
                  </span>
                </label>

                <!-- Planner's typed answer -->
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-0.5">Planner's answer (yours)</p>
                  <textarea
                    :value="getAnswer(activeCategory.id, q.id).typed"
                    :placeholder="q.placeholder ?? 'Your answer…'"
                    rows="2"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800
                           placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                           transition-colors resize-y"
                    :aria-label="`Your answer to: ${q.text}`"
                    @input="(e) => setTypedAnswer(activeCategory!.id, q.id, (e.target as HTMLTextAreaElement).value)"
                  />
                </div>

                <!-- 3 AI-suggested answers (only if suggestedAnswers present).
                     SOURCE BADGE per suggestion (Tom 2026-06-03 Conjunction-of-
                     Technologies principle): each suggestion declares its source
                     layer (plan / gilb / standards / internet / llm / template).
                     v1 most are 'template' (static fallback); v2 plan-aware
                     derivation + Claudian retrofit will produce richer sources. -->
                <div v-if="q.suggestedAnswers && q.suggestedAnswers.length > 0" class="space-y-1.5">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-0.5">Suggested answers — tick any to approve (hover badge for source)</p>
                  <label
                    v-for="(sugg, idx) in q.suggestedAnswers"
                    :key="idx"
                    class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                    :class="isTicked(activeCategory.id, q.id, idx) ? 'border-indigo-300 bg-indigo-50/60' : ''"
                    :title="`Suggestion ${idx + 1} of ${q.suggestedAnswers.length} — click to ${isTicked(activeCategory.id, q.id, idx) ? 'remove from' : 'add to'} effective answer (Mixed mode only)`"
                  >
                    <input
                      type="checkbox"
                      :checked="isTicked(activeCategory.id, q.id, idx)"
                      class="mt-0.5 flex-shrink-0 accent-indigo-600 cursor-pointer"
                      :aria-label="`Tick suggestion ${idx + 1} for question: ${q.text}`"
                      @change="toggleTicked(activeCategory!.id, q.id, idx)"
                    />
                    <span class="text-xs text-slate-700 leading-snug flex-1">
                      <span class="text-[9px] font-mono font-bold text-indigo-500 mr-1">#{{ idx + 1 }}</span>{{ sugg }}
                    </span>
                    <!-- Per-suggestion source badge — falls back to 'template' when no provenance recorded -->
                    <SourceBadge
                      class="flex-shrink-0 mt-0.5"
                      :provenance="(q.suggestedAnswerProvenances?.[idx] as SourceProvenance | undefined) ?? { source: 'template' }"
                      size="compact"
                    />
                  </label>
                </div>

                <!-- Selection mode picker -->
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1">Use:</span>
                  <button
                    v-for="m in SELECTION_MODES"
                    :key="m.id"
                    type="button"
                    class="text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors"
                    :class="getAnswer(activeCategory.id, q.id).mode === m.id
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'"
                    :title="m.title"
                    @click="setMode(activeCategory!.id, q.id, m.id)"
                  >{{ m.label }}</button>
                </div>

                <!-- Effective answer preview -->
                <div
                  class="rounded-lg bg-emerald-50/60 border border-emerald-200 px-2.5 py-1.5"
                >
                  <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">
                    Effective answer (what will export)
                  </p>
                  <p
                    v-if="getEffectiveAnswer(activeCategory.id, q.id, q.suggestedAnswers ?? []).trim().length > 0"
                    class="text-[11px] text-slate-800 whitespace-pre-wrap leading-snug"
                  >{{ getEffectiveAnswer(activeCategory.id, q.id, q.suggestedAnswers ?? []) }}</p>
                  <p v-else class="text-[11px] text-slate-400 italic">
                    (empty — type an answer or tick a suggestion to populate)
                  </p>
                </div>
              </div>
            </template>
          </ScrollContainer>
        </div>

        <!-- Footer -->
        <footer class="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs">
          <span class="text-slate-600">
            <span class="font-bold">{{ totalAnsweredCount }}</span> / {{ totalQuestions }} answered (effective)
          </span>
          <div class="flex-1" />
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
            title="Clear ALL answers for this step (cannot be undone)"
            @click="onClearConfirm"
          >Start Fresh</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-colors text-xs font-bold"
            title="Build a markdown summary of all answers for this step + copy to clipboard"
            @click="onExport"
          >Export Markdown</button>
        </footer>

        <!-- Export preview (inline overlay; rough v1 — full HTML table export in v2) -->
        <div
          v-if="showExport"
          class="absolute inset-x-0 bottom-0 max-h-[50%] bg-white border-t-2 border-amber-400 shadow-2xl flex flex-col"
        >
          <header class="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200">
            <h3 class="text-sm font-bold text-amber-800">Markdown export (copied to clipboard)</h3>
            <div class="flex-1" />
            <CloseDot @click="showExport = false" />
          </header>
          <ScrollContainer class="flex-1 min-h-0" inner-class="p-3">
            <pre class="text-[11px] font-mono text-slate-700 whitespace-pre-wrap">{{ exportedText }}</pre>
          </ScrollContainer>
        </div>

      </div>
    </div>
  </Teleport>
</template>
