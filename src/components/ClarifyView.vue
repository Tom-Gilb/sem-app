<!-- UNIT_TYPE=Widget -->
<!--
/**
 * ClarifyView — shows AI-generated clarifying questions for the user to answer
 * before spec translation. All answers are optional. Shows the original SEM
 * input as a summary card. Emits 'generate' with answers or 'skip' to proceed
 * without answers.
 *
 * Spec: S.EvoStep2.PipelineHandler (precision mode branch)
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref, watch, computed, onUnmounted } from 'vue'

const props = defineProps<{
  payload: { stakes: string; ends: string; means: string }
  questions: string[]
  loading: boolean
  /** True while the spec is being generated after the user submits answers */
  generating?: boolean
}>()

const emit = defineEmits<{
  /** User answered questions — proceed with enriched context */
  generate: [answers: string[]]
  /** Skip questions — proceed with original input only */
  skip: []
  /** Go back to edit the SEM input */
  back: []
}>()

// One answer slot per question, all optional
const answers = ref<string[]>(props.questions.map(() => ''))

// Keep answers array in sync if questions change while loading
watch(
  () => props.questions,
  (qs) => { answers.value = qs.map(() => '') },
)

function handleGenerate(): void {
  emit('generate', [...answers.value])
}

// ── Generating progress timer ─────────────────────────────────────────────────
// Tracks elapsed seconds while the spec is being built from the user's answers.
// Baseline: ~45s (same LLM call as SpecOutput). Bar caps at 88%.
const generatingElapsed = ref(0)
let _generatingTimer: ReturnType<typeof setInterval> | null = null

watch(() => props.generating, (isGenerating) => {
  if (isGenerating) {
    generatingElapsed.value = 0
    _generatingTimer = setInterval(() => { generatingElapsed.value++ }, 1000)
  } else {
    if (_generatingTimer !== null) { clearInterval(_generatingTimer); _generatingTimer = null }
    generatingElapsed.value = 0
  }
})

onUnmounted(() => {
  if (_generatingTimer !== null) clearInterval(_generatingTimer)
})

const generatingEstPct = computed(() =>
  Math.min(88, Math.round((generatingElapsed.value / 45) * 88))
)
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">

    <!-- Back link -->
    <button
      type="button"
      class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline min-h-[44px]"
      @click="emit('back')"
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>
      Edit input
    </button>

    <!-- Original input summary -->
    <div class="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div class="bg-gray-700 px-4 py-2.5">
        <span class="text-xs font-semibold text-gray-200 uppercase tracking-wide">Your input</span>
      </div>
      <dl class="px-4 py-3 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt class="text-xs font-semibold text-gray-500 pt-0.5 uppercase tracking-wide">Stakes</dt>
        <dd class="text-gray-800 leading-relaxed">{{ payload.stakes }}</dd>
        <dt class="text-xs font-semibold text-gray-500 pt-0.5 uppercase tracking-wide">Ends</dt>
        <dd class="text-gray-800 leading-relaxed">{{ payload.ends }}</dd>
        <dt class="text-xs font-semibold text-gray-500 pt-0.5 uppercase tracking-wide">Means</dt>
        <dd class="text-gray-800 leading-relaxed">{{ payload.means }}</dd>
      </dl>
    </div>

    <!-- Questions header -->
    <div class="space-y-1">
      <h1 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <span class="text-2xl" aria-hidden="true">🎯</span>
        Sharpen the spec
      </h1>
      <p class="text-sm text-gray-500">
        Answer any of these to improve precision. All are optional — skip any you're unsure about.
      </p>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      role="status"
      aria-live="polite"
      class="flex items-center gap-3 py-6"
    >
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 inline-block" aria-hidden="true" />
      <span class="text-sm text-gray-500">Generating questions…</span>
    </div>

    <!-- Questions list -->
    <ol
      v-else
      class="space-y-4 list-none m-0 p-0"
      aria-label="Clarifying questions"
    >
      <li
        v-for="(question, idx) in questions"
        :key="idx"
        class="space-y-1.5"
      >
        <label
          :for="`clarify-q-${idx}`"
          class="flex items-start gap-2 text-sm font-medium text-gray-800"
        >
          <span
            class="mt-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold"
            aria-hidden="true"
          >{{ idx + 1 }}</span>
          {{ question }}
        </label>
        <textarea
          :id="`clarify-q-${idx}`"
          v-model="answers[idx]"
          rows="2"
          placeholder="Optional — skip if unsure"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                 placeholder-gray-400 resize-none
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 transition-colors duration-150"
          :aria-label="`Answer to question ${idx + 1}`"
        />
      </li>
    </ol>

    <!-- Generating state — shown while spec is being built from answers -->
    <div
      v-if="generating"
      role="status"
      aria-live="polite"
      class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 space-y-3"
    >
      <div class="flex items-center gap-3">
        <span class="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 inline-block flex-shrink-0" aria-hidden="true" />
        <div class="flex flex-col">
          <span class="text-sm font-medium text-blue-700">Building your spec…</span>
          <span class="text-xs text-blue-500">Integrating your answers into the Planguage specification</span>
        </div>
      </div>
      <div class="space-y-1.5">
        <div class="h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
          <div
            class="h-full rounded-full bg-blue-500 transition-[width] duration-1000 ease-linear"
            :style="{ width: generatingEstPct + '%' }"
            role="progressbar"
            :aria-valuenow="generatingEstPct"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Building spec — approximately ${generatingEstPct}% complete`"
          />
        </div>
        <p class="text-[11px] text-blue-400">~{{ generatingEstPct }}% · {{ generatingElapsed }}s elapsed</p>
      </div>
    </div>

    <!-- Actions -->
    <div v-else class="flex flex-col gap-3 pt-2">
      <button
        type="button"
        :disabled="loading"
        class="w-full min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
               text-white shadow-sm hover:bg-blue-700
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        @click="handleGenerate"
      >
        Generate Spec with these answers →
      </button>
      <button
        type="button"
        :disabled="loading"
        class="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium
               text-gray-600 hover:bg-gray-50
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        @click="emit('skip')"
      >
        Skip &amp; generate without answers →
      </button>
    </div>

  </div>
</template>
