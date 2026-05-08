<!-- SelectionDefiner.vue — Global selection → define feature.
     Mount this once at the app level (inside <template v-else-if="view === 'app'">).

     Three surfaces:
       1. Floating "📖 Define" pill — appears above any non-trivial text selection.
          Clicking it triggers an AI definition lookup.
       2. Result panel — slides up from the bottom showing the definition + source.
       3. Keyboard: Cmd+D / Ctrl+D calls defineCurrentSelection().
          Voice "Define" is wired in App.vue dictation commands.

     Props:  spec — the current SpecBlock (passed as context for AI definitions).
     No emits — self-contained via useDefine module-level state. -->

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  useDefine,
  defineTerm,
  defineCurrentSelection,
  closeDefine,
  DEFINE_TYPE_LABELS,
  DEFINE_TYPE_COLOURS,
} from '../composables/useDefine'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock | null
}>()

const { result, loading, error, open, term } = useDefine()

// ── Floating pill state ────────────────────────────────────────────────────

const pillVisible = ref(false)
const pillX       = ref(0)   // CSS left (pixels from viewport left)
const pillY       = ref(0)   // CSS top (pixels from viewport top)
const pillTerm    = ref('')

let _selectionTimer: ReturnType<typeof setTimeout> | null = null

/** Minimum / maximum word count for the pill to appear. */
const MIN_CHARS = 2
const MAX_CHARS = 120

function _updatePill(): void {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    pillVisible.value = false
    return
  }

  const text = sel.toString().trim()
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
    pillVisible.value = false
    return
  }

  // Ignore selections inside input/textarea elements
  if (
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
  ) {
    pillVisible.value = false
    return
  }

  try {
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      pillVisible.value = false
      return
    }

    // Position: centred above the selection, 8px gap
    const PILL_HEIGHT = 36
    const rawTop      = rect.top - PILL_HEIGHT - 8

    pillX.value       = Math.min(
      Math.max(rect.left + rect.width / 2, 60),
      window.innerWidth - 60,
    )
    pillY.value       = rawTop < 4 ? rect.bottom + 8 : rawTop   // flip below if too high
    pillTerm.value    = text
    pillVisible.value = true
  } catch {
    pillVisible.value = false
  }
}

function _onSelectionChange(): void {
  if (_selectionTimer !== null) clearTimeout(_selectionTimer)
  // Debounce 220 ms — avoids flickering during drag-select
  _selectionTimer = setTimeout(_updatePill, 220)
}

function _onMouseup(): void {
  if (_selectionTimer !== null) clearTimeout(_selectionTimer)
  _selectionTimer = setTimeout(_updatePill, 100)
}

function _onKeydown(e: KeyboardEvent): void {
  // Cmd+D / Ctrl+D — define selection
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault()
    defineCurrentSelection(props.spec)
  }
  // Escape — close the result panel
  if (e.key === 'Escape' && open.value) {
    closeDefine()
  }
}

function handlePillClick(): void {
  pillVisible.value = false
  defineTerm(pillTerm.value, props.spec)
}

onMounted(() => {
  document.addEventListener('selectionchange', _onSelectionChange)
  document.addEventListener('mouseup',         _onMouseup)
  window.addEventListener('keydown',           _onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', _onSelectionChange)
  document.removeEventListener('mouseup',         _onMouseup)
  window.removeEventListener('keydown',           _onKeydown)
  if (_selectionTimer !== null) clearTimeout(_selectionTimer)
})

// ── Result panel computed helpers ─────────────────────────────────────────

const typeLabel = computed(() =>
  result.value ? DEFINE_TYPE_LABELS[result.value.type] : '',
)
const typeColour = computed(() =>
  result.value ? DEFINE_TYPE_COLOURS[result.value.type] : 'bg-slate-100 text-slate-600',
)
</script>

<template>
  <!-- ────────────────────────────────────────────────────────────────────────
       1. FLOATING PILL — appears above selected text
       Uses fixed positioning so it follows the viewport regardless of scroll.
       ──────────────────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-90"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <button
        v-if="pillVisible && !open"
        type="button"
        aria-label="Define selected text"
        class="fixed z-[350] flex items-center gap-1.5 px-3 py-1.5 rounded-full
               bg-violet-600 text-white text-xs font-semibold shadow-lg
               hover:bg-violet-700 active:scale-95
               focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
               transition-colors select-none"
        :style="{
          left: `${pillX}px`,
          top: `${pillY}px`,
          transform: 'translateX(-50%)',
        }"
        @mousedown.prevent="handlePillClick"
      >
        <span aria-hidden="true">📖</span>
        Define
      </button>
    </Transition>
  </Teleport>

  <!-- ────────────────────────────────────────────────────────────────────────
       2. RESULT PANEL — slides up from the bottom
       ──────────────────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="open"
        class="fixed bottom-0 left-0 right-0 z-[360] flex justify-center px-4 pb-4 pt-0"
        role="dialog"
        aria-modal="true"
        aria-label="Term definition"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 z-[-1]"
          aria-hidden="true"
          @click="closeDefine"
        />

        <!-- Card -->
        <div
          class="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl
                 border border-violet-200 bg-white"
        >
          <!-- Header -->
          <div class="flex items-start justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base" aria-hidden="true">📖</span>
                <span class="text-sm font-bold text-white tracking-wide">Defining</span>
                <!-- Type badge (shown after result arrives) -->
                <span
                  v-if="result"
                  class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white"
                >
                  {{ typeLabel }}
                </span>
              </div>
              <!-- The term itself -->
              <p class="mt-1 text-base font-semibold text-white leading-tight break-words">
                "{{ term || result?.term }}"
              </p>
            </div>
            <button
              type="button"
              class="flex-shrink-0 ml-3 text-violet-200 hover:text-white text-xl leading-none
                     focus:outline-none focus:ring-2 focus:ring-white rounded"
              aria-label="Close definition"
              @click="closeDefine"
            >
              ×
            </button>
          </div>

          <!-- Body -->
          <div class="px-4 py-4">
            <!-- Loading state -->
            <div v-if="loading" class="flex items-center gap-3" role="status" aria-live="polite">
              <div class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden="true" />
              <span class="text-sm text-slate-500">Looking up definition…</span>
            </div>

            <!-- Error state -->
            <p v-else-if="error" class="text-sm text-red-600" role="alert">{{ error }}</p>

            <!-- Result -->
            <template v-else-if="result">
              <!-- Definition -->
              <p class="text-sm text-slate-800 leading-relaxed">{{ result.definition }}</p>

              <!-- Source attribution -->
              <div class="mt-3 flex items-start gap-2 pt-3 border-t border-slate-100">
                <span class="text-base flex-shrink-0" aria-hidden="true">📚</span>
                <div>
                  <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Source</p>
                  <p class="text-xs text-slate-600 leading-relaxed">{{ result.source }}</p>
                </div>
              </div>

              <!-- Type badge (full width) -->
              <div class="mt-3">
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                  :class="typeColour"
                >
                  {{ typeLabel }}
                </span>
              </div>
            </template>
          </div>

          <!-- Footer hint -->
          <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p class="text-[10px] text-slate-400">
              Select any text and click <strong>📖 Define</strong>, or say <strong>"Define"</strong>, or press <kbd class="font-mono border border-slate-200 rounded px-1 bg-white text-slate-400">⌘D</kbd>
            </p>
            <button
              type="button"
              class="text-[11px] text-violet-600 hover:text-violet-800 font-medium
                     focus:outline-none focus:ring-2 focus:ring-violet-400 rounded px-1"
              @click="closeDefine"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
