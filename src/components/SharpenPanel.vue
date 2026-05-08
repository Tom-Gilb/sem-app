<!-- SharpenPanel.vue — Sharpening Cycles UI
     Shows after spec generation (inline, Stage 1) or from the nav bar (modal).

     Props:  spec     — the current SpecBlock to sharpen
             modal    — when true, renders as a Teleport overlay (nav-triggered use)
     Emits:  sharpened(SpecBlock)  — a round completed; parent should update currentSpec
             done                  — user clicked "Sharp Enough" / "Done"; parent may proceed

     KEY DESIGN RULE: the "Sharp Enough" / "Done" close button is ALWAYS visible and
     ALWAYS clickable, regardless of the current phase. Phase only affects what appears
     in the body panel below the header. This prevents the button from disappearing mid-round. -->

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  useSharpen,
  type SharpenCategory,
} from '../composables/useSharpen'
import SharpenDiffList from './SharpenDiffList.vue'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock
  /** When true: renders as a fixed full-screen overlay via Teleport */
  modal?: boolean
}>()

const emit = defineEmits<{
  sharpened: [spec: SpecBlock]
  done: []
}>()

const {
  phase,
  currentCategory,
  currentQuestions,
  rounds,
  loading,
  error,
  SHARPEN_CATEGORIES,
  startSharpen,
  submitSharpenAnswers,
  cancelSharpen,
} = useSharpen()

// Local answer state — reset when a new category starts
const answers = ref<string[]>([])

// Local toggle for the "Show changes" collapsible section
const changesOpen = ref(false)

// ── Loading progress timer ────────────────────────────────────────────────
// Tracks elapsed seconds and estimated completion % for the two LLM phases.
// 'questions' typically resolves in ~8s; 'refining' in ~25s.
// Progress is time-based (capped at 88%) — there is no real server signal.
const loadingStartTime = ref<number | null>(null)
const elapsedSeconds   = ref(0)
let _timerHandle: ReturnType<typeof setInterval> | null = null

watch(loading, (isLoading) => {
  if (isLoading) {
    loadingStartTime.value = Date.now()
    elapsedSeconds.value   = 0
    _timerHandle = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - (loadingStartTime.value ?? Date.now())) / 1000)
    }, 1000)
  } else {
    if (_timerHandle !== null) { clearInterval(_timerHandle); _timerHandle = null }
    loadingStartTime.value = null
    elapsedSeconds.value   = 0
  }
})

onUnmounted(() => {
  if (_timerHandle !== null) clearInterval(_timerHandle)
})

const estimatedPct = computed<number>(() => {
  const s = elapsedSeconds.value
  if (phase.value === 'questions') return Math.min(88, Math.round((s / 8)  * 88))
  if (phase.value === 'refining')  return Math.min(88, Math.round((s / 25) * 88))
  return 0
})

async function handleCategoryClick(cat: SharpenCategory): Promise<void> {
  answers.value = []
  changesOpen.value = false
  await startSharpen(props.spec, cat)
}

async function handleSubmit(): Promise<void> {
  const refined = await submitSharpenAnswers(props.spec, answers.value)
  if (refined) emit('sharpened', refined)
}

function handleDone(): void {
  cancelSharpen()
  emit('done')
}

function isRoundDone(key: string): boolean {
  return rounds.value.some((r) => r.category.key === key)
}

/** Total entries changed across all rounds (for the "Show changes" button label). */
function totalChanges(): number {
  return rounds.value.reduce((sum, r) => sum + r.changes.length, 0)
}
</script>

<template>
  <!-- ════════════════════════════════════════════════
       INLINE MODE (stage 1 — between spec and Plan)
       ════════════════════════════════════════════════ -->
  <div
    v-if="!modal"
    class="w-full max-w-xl mt-6 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm"
  >
    <!-- Header bar — "Sharp Enough" is ALWAYS present here, never gated on phase -->
    <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xl flex-shrink-0" aria-hidden="true">🔪</span>
        <div class="min-w-0">
          <span class="text-sm font-bold text-white tracking-widest uppercase">Sharpening Cycles</span>
          <span v-if="rounds.length > 0" class="ml-2 text-xs text-amber-100">
            {{ rounds.length }} round{{ rounds.length !== 1 ? 's' : '' }} complete
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Cancel current round — only shown when a round is in flight -->
        <button
          v-if="phase !== 'idle'"
          type="button"
          class="text-amber-100 hover:text-white text-xs underline
                 focus:outline-none focus:ring-2 focus:ring-white rounded px-1"
          aria-label="Cancel this sharpening round"
          @click.stop="cancelSharpen"
        >
          Cancel round
        </button>
        <!-- Sharp Enough — ALWAYS present, never hidden by phase -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 bg-white text-amber-700 text-xs font-semibold
                 hover:bg-amber-50 active:bg-amber-100
                 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-amber-500
                 transition-colors"
          aria-label="Sharp Enough — proceed to planning"
          @click.stop="handleDone"
        >
          ✅ Sharp Enough
        </button>
      </div>
    </div>

    <!-- Body: category picker (idle) -->
    <div v-if="phase === 'idle'" class="px-4 py-4">
      <p class="text-xs font-medium text-amber-800 mb-3">
        <template v-if="rounds.length === 0">
          Choose a dimension to sharpen your spec — or click ✅ Sharp Enough to proceed:
        </template>
        <template v-else>
          Sharp so far! Sharpen another dimension, or click ✅ Sharp Enough to proceed:
        </template>
      </p>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Sharpening dimensions">
        <button
          v-for="cat in SHARPEN_CATEGORIES"
          :key="cat.key"
          type="button"
          :aria-label="`Sharpen ${cat.label}${isRoundDone(cat.key) ? ' (already done)' : ''}`"
          :title="cat.hint"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium
                 transition-all duration-150
                 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
          :class="isRoundDone(cat.key)
            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400 hover:shadow-sm'"
          @click="handleCategoryClick(cat)"
        >
          <span class="text-base leading-none" aria-hidden="true">{{ cat.emoji }}</span>
          {{ cat.label }}
          <span v-if="isRoundDone(cat.key)" class="text-xs text-green-600 font-bold" aria-hidden="true">✓</span>
        </button>
      </div>

      <!-- Completed rounds summary + Show changes -->
      <div v-if="rounds.length > 0" class="mt-4 space-y-3">
        <div>
          <p class="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Sharpened so far</p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="r in rounds"
              :key="r.category.key"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium"
            >
              {{ r.category.emoji }} {{ r.category.label }}
            </span>
          </div>
        </div>

        <!-- Show changes toggle -->
        <button
          v-if="totalChanges() > 0"
          type="button"
          class="flex items-center gap-1.5 text-[11px] font-medium text-amber-700
                 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-1"
          :aria-expanded="changesOpen"
          aria-controls="sharpen-changes-inline"
          @click="changesOpen = !changesOpen"
        >
          <span aria-hidden="true">{{ changesOpen ? '▾' : '▸' }}</span>
          📋 {{ changesOpen ? 'Hide' : 'Show' }} sharpening changes
          <span class="text-amber-500">({{ totalChanges() }} entries)</span>
        </button>

        <!-- Changes panel (collapsible) -->
        <div
          v-if="changesOpen"
          id="sharpen-changes-inline"
          class="rounded-xl border border-amber-200 bg-white divide-y divide-amber-100"
        >
          <SharpenDiffList :rounds="rounds" />
        </div>
      </div>
    </div>

    <!-- Body: generating questions -->
    <div v-else-if="phase === 'questions'" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
      <div class="flex items-center gap-3">
        <div class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
        <span class="text-sm text-amber-700">Generating <strong>{{ currentCategory?.label }}</strong> questions…</span>
      </div>
      <div class="space-y-1.5">
        <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
          <div
            class="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
            :style="{ width: estimatedPct + '%' }"
            role="progressbar"
            :aria-valuenow="estimatedPct"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Generating questions — approximately ${estimatedPct}% complete`"
          />
        </div>
        <p class="text-[11px] text-amber-500">~{{ estimatedPct }}% · {{ elapsedSeconds }}s elapsed</p>
      </div>
    </div>

    <!-- Body: Q&A (answering) -->
    <div v-else-if="phase === 'answering'" class="px-4 py-4">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-2xl leading-none" aria-hidden="true">{{ currentCategory?.emoji }}</span>
        <div>
          <p class="text-sm font-bold text-amber-800">{{ currentCategory?.label }} Questions</p>
          <p class="text-[11px] text-amber-600">Click a suggestion or type your own — skip anything not yet decided</p>
        </div>
      </div>
      <div class="space-y-5">
        <div v-for="(q, i) in currentQuestions" :key="i" class="space-y-2">
          <label :for="`sharpen-q-${i}`" class="block text-sm font-medium text-gray-800 leading-snug">
            <span class="text-amber-500 font-bold mr-1">{{ i + 1 }}.</span>{{ q.text }}
          </label>
          <!-- Suggestion chips -->
          <div v-if="q.suggestions.length > 0" class="flex flex-wrap gap-1.5">
            <button
              v-for="sug in q.suggestions"
              :key="sug"
              type="button"
              class="px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700
                     text-[11px] font-medium hover:bg-amber-200 hover:border-amber-400
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              :aria-label="`Use suggestion: ${sug}`"
              @click="answers[i] = sug"
            >
              {{ sug }}
            </button>
          </div>
          <textarea
            :id="`sharpen-q-${i}`"
            v-model="answers[i]"
            rows="2"
            class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2
                   text-sm text-gray-800 placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
                   resize-none transition-colors"
            placeholder="Your answer (or click a suggestion above, or leave blank to skip)…"
          />
        </div>
      </div>
      <p v-if="error" class="mt-3 text-xs text-red-600" role="alert">{{ error }}</p>
      <button
        type="button"
        :disabled="loading"
        class="mt-5 w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg
               bg-amber-500 text-white text-sm font-semibold
               hover:bg-amber-600 active:bg-amber-700
               disabled:opacity-60 disabled:cursor-not-allowed
               focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
               transition-colors duration-150"
        aria-label="Apply sharpening to spec"
        @click="handleSubmit"
      >
        <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        {{ loading ? 'Sharpening…' : '🔪 Apply Sharpening' }}
      </button>
    </div>

    <!-- Body: refining (loading) -->
    <div v-else-if="phase === 'refining'" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
      <div class="flex items-center gap-3">
        <div class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
        <span class="text-sm text-amber-700">Sharpening with <strong>{{ currentCategory?.label }}</strong> insights…</span>
      </div>
      <div class="space-y-1.5">
        <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
          <div
            class="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
            :style="{ width: estimatedPct + '%' }"
            role="progressbar"
            :aria-valuenow="estimatedPct"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Applying sharpening — approximately ${estimatedPct}% complete`"
          />
        </div>
        <p class="text-[11px] text-amber-500">~{{ estimatedPct }}% · {{ elapsedSeconds }}s elapsed</p>
      </div>
    </div>
  </div>

  <!-- ════════════════════════════════════════════════
       MODAL MODE (nav-triggered — Teleport to body)
       ════════════════════════════════════════════════ -->
  <Teleport v-if="modal" to="body">
    <!-- Outer container: positions the card; does NOT intercept clicks itself -->
    <div
      class="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sharpening Cycles"
    >
      <!-- Backdrop as a separate sibling element — more reliable than @click.self -->
      <div
        class="absolute inset-0 bg-black/40"
        aria-hidden="true"
        @click="handleDone"
      />

      <!-- Card — sits above the backdrop -->
      <div class="relative w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-2xl">

        <!-- Modal header — BOTH "Done sharpening" and × are ALWAYS present, never gated on phase -->
        <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xl flex-shrink-0" aria-hidden="true">🔪</span>
            <span class="text-sm font-bold text-white tracking-widest uppercase">Sharpening Cycles</span>
            <span v-if="rounds.length > 0" class="text-xs text-amber-100">
              · {{ rounds.length }} round{{ rounds.length !== 1 ? 's' : '' }}
            </span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Cancel current round — only shown when a round is in flight -->
            <button
              v-if="phase !== 'idle'"
              type="button"
              class="text-amber-100 hover:text-white text-xs underline
                     focus:outline-none focus:ring-2 focus:ring-white rounded px-1"
              aria-label="Cancel this sharpening round"
              @click.stop="cancelSharpen"
            >
              Cancel round
            </button>
            <!-- Done sharpening — ALWAYS present -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-amber-700
                     text-xs font-semibold hover:bg-amber-50 active:bg-amber-100
                     focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-amber-500
                     transition-colors"
              aria-label="Done sharpening — close panel"
              @click.stop="handleDone"
            >
              ✅ Done sharpening
            </button>
            <!-- × escape hatch — ALWAYS present -->
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-full
                     text-white/70 hover:text-white hover:bg-white/20
                     focus:outline-none focus:ring-2 focus:ring-white transition-colors text-lg leading-none"
              aria-label="Close sharpening panel"
              @click.stop="handleDone"
            >
              ×
            </button>
          </div>
        </div>

        <!-- Modal body: category picker (idle) -->
        <div v-if="phase === 'idle'" class="px-4 py-4 max-h-[70vh] overflow-y-auto">
          <p class="text-xs font-medium text-amber-800 mb-3">
            <template v-if="rounds.length === 0">Choose a dimension to sharpen your spec:</template>
            <template v-else>Sharpen another dimension, or click Done:</template>
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="cat in SHARPEN_CATEGORIES"
              :key="cat.key"
              type="button"
              :title="cat.hint"
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium
                     transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-400"
              :class="isRoundDone(cat.key)
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400'"
              @click="handleCategoryClick(cat)"
            >
              <span aria-hidden="true">{{ cat.emoji }}</span>
              {{ cat.label }}
              <span v-if="isRoundDone(cat.key)" class="text-xs text-green-600 font-bold">✓</span>
            </button>
          </div>

          <!-- Completed rounds summary -->
          <div v-if="rounds.length > 0" class="mt-4 space-y-3">
            <div>
              <p class="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Sharpened so far</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="r in rounds"
                  :key="r.category.key"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium"
                >
                  {{ r.category.emoji }} {{ r.category.label }}
                </span>
              </div>
            </div>

            <!-- Show changes toggle -->
            <button
              v-if="totalChanges() > 0"
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-medium text-amber-700
                     hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-1"
              :aria-expanded="changesOpen"
              aria-controls="sharpen-changes-modal"
              @click="changesOpen = !changesOpen"
            >
              <span aria-hidden="true">{{ changesOpen ? '▾' : '▸' }}</span>
              📋 {{ changesOpen ? 'Hide' : 'Show' }} sharpening changes
              <span class="text-amber-500">({{ totalChanges() }} entries)</span>
            </button>

            <!-- Changes panel -->
            <div
              v-if="changesOpen"
              id="sharpen-changes-modal"
              class="rounded-xl border border-amber-200 bg-white divide-y divide-amber-100"
            >
              <SharpenDiffList :rounds="rounds" />
            </div>
          </div>
        </div>

        <!-- Modal body: generating questions -->
        <div v-else-if="phase === 'questions'" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
          <div class="flex items-center gap-3">
            <div class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
            <span class="text-sm text-amber-700">Generating <strong>{{ currentCategory?.label }}</strong> questions…</span>
          </div>
          <div class="space-y-1.5">
            <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
              <div
                class="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
                :style="{ width: estimatedPct + '%' }"
                role="progressbar"
                :aria-valuenow="estimatedPct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`Generating questions — approximately ${estimatedPct}% complete`"
              />
            </div>
            <p class="text-[11px] text-amber-500">~{{ estimatedPct }}% · {{ elapsedSeconds }}s elapsed</p>
          </div>
        </div>

        <!-- Modal body: Q&A -->
        <div v-else-if="phase === 'answering'" class="px-4 py-4 max-h-[70vh] overflow-y-auto">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-2xl" aria-hidden="true">{{ currentCategory?.emoji }}</span>
            <div>
              <p class="text-sm font-bold text-amber-800">{{ currentCategory?.label }} Questions</p>
              <p class="text-[11px] text-amber-600">Click a suggestion or type your own — skip anything not yet decided</p>
            </div>
          </div>
          <div class="space-y-5">
            <div v-for="(q, i) in currentQuestions" :key="i" class="space-y-2">
              <label :for="`sharpen-modal-q-${i}`" class="block text-sm font-medium text-gray-800">
                <span class="text-amber-500 font-bold mr-1">{{ i + 1 }}.</span>{{ q.text }}
              </label>
              <!-- Suggestion chips -->
              <div v-if="q.suggestions.length > 0" class="flex flex-wrap gap-1.5">
                <button
                  v-for="sug in q.suggestions"
                  :key="sug"
                  type="button"
                  class="px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700
                         text-[11px] font-medium hover:bg-amber-200 hover:border-amber-400
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                  :aria-label="`Use suggestion: ${sug}`"
                  @click="answers[i] = sug"
                >
                  {{ sug }}
                </button>
              </div>
              <textarea
                :id="`sharpen-modal-q-${i}`"
                v-model="answers[i]"
                rows="2"
                class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="Your answer (or click a suggestion above, or leave blank to skip)…"
              />
            </div>
          </div>
          <p v-if="error" class="mt-3 text-xs text-red-600" role="alert">{{ error }}</p>
          <button
            type="button"
            :disabled="loading"
            class="mt-5 w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg
                   bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600
                   disabled:opacity-60 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
            @click="handleSubmit"
          >
            <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            {{ loading ? 'Sharpening…' : '🔪 Apply Sharpening' }}
          </button>
        </div>

        <!-- Modal body: refining -->
        <div v-else-if="phase === 'refining'" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
          <div class="flex items-center gap-3">
            <div class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
            <span class="text-sm text-amber-700">Sharpening with <strong>{{ currentCategory?.label }}</strong> insights…</span>
          </div>
          <div class="space-y-1.5">
            <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
              <div
                class="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-linear"
                :style="{ width: estimatedPct + '%' }"
                role="progressbar"
                :aria-valuenow="estimatedPct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`Applying sharpening — approximately ${estimatedPct}% complete`"
              />
            </div>
            <p class="text-[11px] text-amber-500">~{{ estimatedPct }}% · {{ elapsedSeconds }}s elapsed</p>
          </div>
        </div>

      </div><!-- end card -->
    </div><!-- end outer container -->
  </Teleport>
</template>
