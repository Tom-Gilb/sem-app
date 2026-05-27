<!-- GlobalSearch.vue — ⌘F Find palette
     Redesigned 2026-05-27: vibrant gradient header, CloseDot close button,
     colour-coded context pills, quick-picks on empty state.
     Always-on fuzzy search across every feature, button and panel in the app.
     Tolerates spelling variations; keyboard navigable; one click opens the target.

     Props:  entries  — SearchEntry[] built in App.vue with closures over reactive state
     Usage:  <GlobalSearch :entries="searchEntries" /> -->

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useGlobalSearch, fuzzySearch, type SearchEntry } from '../composables/useGlobalSearch'

const props = defineProps<{ entries: SearchEntry[] }>()

const { isOpen, close } = useGlobalSearch()

// ── Local state ───────────────────────────────────────────────────────────────

const query        = ref('')
const selectedIdx  = ref(0)
const inputRef     = ref<HTMLInputElement | null>(null)

// ── Derived ───────────────────────────────────────────────────────────────────

const results = computed(() => fuzzySearch(query.value, props.entries))

// Reset highlight when result set changes
watch(results, () => { selectedIdx.value = 0 })

// Focus input and clear query whenever palette opens
watch(isOpen, async (val) => {
  if (val) {
    query.value       = ''
    selectedIdx.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

// ── Quick picks — shown when query is empty ───────────────────────────────────
// Surface the most commonly used actions so users get value immediately.

const QUICK_PICKS = [
  { label: 'Edit Plan',   icon: '✎', context: 'editor'  },
  { label: 'Value Flow',  icon: '🌊', context: 'visualise' },
  { label: 'Priorities',  icon: '🎯', context: 'priority' },
  { label: 'History',     icon: '🕐', context: 'history'  },
  { label: 'Evo Simulate',icon: '▶', context: 'evo'     },
]

// ── Context pill colours ──────────────────────────────────────────────────────

const CONTEXT_COLORS: Record<string, string> = {
  editor:    'bg-violet-100 text-violet-700',
  visualise: 'bg-cyan-100 text-cyan-700',
  priority:  'bg-amber-100 text-amber-700',
  history:   'bg-slate-100 text-slate-600',
  evo:       'bg-green-100 text-green-700',
  planning:  'bg-indigo-100 text-indigo-700',
  export:    'bg-orange-100 text-orange-700',
  tasks:     'bg-rose-100 text-rose-700',
  settings:  'bg-gray-100 text-gray-600',
}

function contextColor(context: string): string {
  const key = context.toLowerCase()
  for (const [k, v] of Object.entries(CONTEXT_COLORS)) {
    if (key.includes(k)) return v
  }
  return 'bg-indigo-100 text-indigo-600'
}

// ── Actions ───────────────────────────────────────────────────────────────────

function confirm(entry: SearchEntry) {
  if (entry.disabled) return
  entry.action()
  close()
}

function confirmSelected() {
  const r = results.value[selectedIdx.value]
  if (r) confirm(r.entry)
}

function tryQuickPick(label: string) {
  query.value = label
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      close()
      break
    case 'ArrowDown':
      e.preventDefault()
      selectedIdx.value = Math.min(selectedIdx.value + 1, results.value.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIdx.value = Math.max(selectedIdx.value - 1, 0)
      break
    case 'Enter':
      e.preventDefault()
      confirmSelected()
      break
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="gs-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9800] flex items-start justify-center"
        style="padding-top: 10vh"
        aria-modal="true"
        role="dialog"
        aria-label="Find features"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="close"
        />

        <!-- Palette card -->
        <div class="relative w-full max-w-xl mx-4 rounded-2xl shadow-2xl overflow-hidden gs-card">

          <!-- ── Gradient header with search input ──────────────────────────── -->
          <div class="bg-gradient-to-r from-violet-700 via-indigo-600 to-violet-600 px-4 py-3.5">
            <div class="flex items-center gap-3">
              <!-- Magnifier -->
              <svg
                class="h-5 w-5 text-white/70 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clip-rule="evenodd"
                />
              </svg>

              <input
                ref="inputRef"
                v-model="query"
                type="text"
                class="flex-1 text-[15px] font-medium text-white placeholder-white/50
                       focus:outline-none bg-transparent"
                placeholder="Find features, panels, actions…"
                autocomplete="off"
                spellcheck="false"
                aria-label="Find"
                aria-autocomplete="list"
                aria-controls="gs-results"
                @keydown="onKeydown"
              />

              <CloseDot
                variant="on-dark"
                title="Close (Esc)"
                aria-label="Close Find"
                @click="close"
              />
            </div>

            <!-- Quick picks — shown when query is empty -->
            <div v-if="!query.trim()" class="flex items-center gap-2 mt-2.5 flex-wrap">
              <span class="text-[10px] text-white/50 font-semibold uppercase tracking-wider mr-1">Quick:</span>
              <button
                v-for="qp in QUICK_PICKS"
                :key="qp.label"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                       bg-white/15 text-white hover:bg-white/30 transition-colors"
                @click="tryQuickPick(qp.label)"
              >
                <span aria-hidden="true">{{ qp.icon }}</span>
                {{ qp.label }}
              </button>
            </div>
          </div>

          <!-- ── Results list ─────────────────────────────────────────────── -->
          <div class="bg-white">
            <ScrollContainer id="gs-results" outer-class="relative" inner-style="max-height: 50vh" :no-pill="true" role="listbox">

              <!-- Empty query — hint -->
              <div
                v-if="!query.trim()"
                class="px-5 py-8 text-center"
              >
                <p class="text-2xl mb-2" aria-hidden="true">🔍</p>
                <p class="text-sm font-semibold text-slate-500">Search everything in the plan</p>
                <p class="text-xs text-slate-400 mt-1">Features · Buttons · Panels · Actions · Typos welcome</p>
              </div>

              <!-- No match -->
              <div
                v-else-if="results.length === 0"
                class="px-5 py-8 text-center"
              >
                <p class="text-2xl mb-2" aria-hidden="true">🤷</p>
                <p class="text-sm font-semibold text-slate-600">Nothing found for "{{ query }}"</p>
                <p class="text-xs text-slate-400 mt-1">Try a different word or a synonym</p>
              </div>

              <!-- Results -->
              <template v-else>
                <button
                  v-for="(result, i) in results"
                  :key="result.entry.id"
                  type="button"
                  role="option"
                  :aria-selected="i === selectedIdx"
                  :disabled="result.entry.disabled"
                  class="w-full flex items-center gap-3 px-4 py-3 text-left
                         transition-colors duration-75 select-none focus:outline-none"
                  :class="[
                    i === selectedIdx
                      ? 'bg-violet-50 border-l-4 border-violet-500'
                      : 'hover:bg-slate-50 border-l-4 border-transparent',
                    result.entry.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer',
                    i > 0 ? 'border-t border-slate-50' : '',
                  ]"
                  @click="confirm(result.entry)"
                  @mousemove="selectedIdx = i"
                >
                  <!-- Icon -->
                  <span
                    class="text-xl leading-none flex-shrink-0 w-7 text-center"
                    aria-hidden="true"
                  >{{ result.entry.icon }}</span>

                  <!-- Name + description -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800 truncate leading-tight">
                      {{ result.entry.name }}
                    </p>
                    <p class="text-xs text-slate-400 truncate mt-0.5 leading-tight">
                      {{ result.entry.description }}
                    </p>
                  </div>

                  <!-- Context pill — colour-coded by category -->
                  <span
                    class="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    :class="contextColor(result.entry.context)"
                  >{{ result.entry.context }}</span>

                  <!-- Arrow on selected -->
                  <svg
                    v-if="i === selectedIdx && !result.entry.disabled"
                    class="flex-shrink-0 h-3.5 w-3.5 text-violet-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </template>
            </ScrollContainer>
          </div>

          <!-- ── Footer ──────────────────────────────────────────────────── -->
          <div
            class="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-slate-50
                   text-[11px] text-slate-400"
          >
            <span class="flex items-center gap-1">
              <kbd class="px-1 rounded bg-violet-100 text-violet-600 font-mono text-[10px]">↑</kbd>
              <kbd class="px-1 rounded bg-violet-100 text-violet-600 font-mono text-[10px]">↓</kbd>
              navigate
            </span>
            <span>
              <kbd class="px-1 rounded bg-violet-100 text-violet-600 font-mono text-[10px]">↵</kbd>
              open
            </span>
            <span class="ml-auto flex items-center gap-1">
              <kbd class="px-1 rounded bg-violet-100 text-violet-600 font-mono text-[10px]">⌘F</kbd>
              anywhere
            </span>
          </div>

        </div><!-- /palette card -->
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gs-fade-enter-active { transition: opacity 140ms ease; }
.gs-fade-leave-active { transition: opacity 100ms ease; }
.gs-fade-enter-from,
.gs-fade-leave-to    { opacity: 0; }

.gs-fade-enter-active .gs-card { transition: transform 140ms ease, opacity 140ms ease; }
.gs-fade-leave-active .gs-card { transition: transform 100ms ease, opacity 100ms ease; }
.gs-fade-enter-from .gs-card  { transform: translateY(-8px) scale(0.97); opacity: 0; }
.gs-fade-leave-to   .gs-card  { transform: translateY(-4px); opacity: 0; }
</style>
