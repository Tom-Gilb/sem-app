<!-- GlobalSearch.vue — ⌘F Find palette (formerly ⌘K command palette).
     Renamed 2026-05-12 per Tom: shortcut switched ⌘K → ⌘F (more universal
     muscle memory; deliberately overrides browser-native Find-in-page),
     UI label switched "Search" → "Find" (shorter, more result-oriented).
     ⌘K still triggers the palette as a silent alias.
     Always-on fuzzy search across every feature, button and panel in the app.
     Tolerates spelling variations; keyboard navigable; one click opens the target.

     Props:  entries  — SearchEntry[] built in App.vue with closures over reactive state
     Usage:  <GlobalSearch :entries="searchEntries" /> inside a Teleport-free parent;
             the component teleports itself to <body>. -->

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
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
        style="padding-top: 14vh"
        aria-modal="true"
        role="dialog"
        aria-label="Search features"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="close"
        />

        <!-- Palette card -->
        <div class="relative w-full max-w-xl mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden gs-card">

          <!-- ── Search input row ────────────────────────────────────────── -->
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
            <!-- Magnifier -->
            <svg
              class="h-5 w-5 text-gray-400 flex-shrink-0"
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
              class="flex-1 text-[15px] text-gray-800 placeholder-gray-400
                     focus:outline-none bg-transparent"
              placeholder="Search features, buttons, panels…"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search"
              aria-autocomplete="list"
              aria-controls="gs-results"
              @keydown="onKeydown"
            />

            <!-- Esc hint -->
            <kbd
              class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded
                     text-[11px] font-mono bg-gray-100 text-gray-400 border border-gray-200
                     leading-none"
            >Esc</kbd>
          </div>

          <!-- ── Results list ─────────────────────────────────────────────── -->
          <ScrollContainer id="gs-results" outer-class="relative" inner-style="max-height: 54vh" :no-pill="true" role="listbox">

            <!-- Empty query — hint -->
            <div
              v-if="!query.trim()"
              class="px-5 py-10 text-center"
            >
              <p class="text-sm text-gray-400">Type anything — features, buttons, panel names…</p>
              <p class="text-xs text-gray-300 mt-1">Typos welcome · ⌘F to close</p>
            </div>

            <!-- No match -->
            <div
              v-else-if="results.length === 0"
              class="px-5 py-10 text-center"
            >
              <p class="text-sm font-medium text-gray-500">No results for "{{ query }}"</p>
              <p class="text-xs text-gray-400 mt-1.5">Try a different word or a synonym</p>
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
                       transition-colors duration-75 select-none
                       focus:outline-none"
                :class="[
                  i === selectedIdx
                    ? 'bg-indigo-50'
                    : 'hover:bg-gray-50',
                  result.entry.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer',
                  i > 0 ? 'border-t border-gray-50' : '',
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
                  <p class="text-sm font-semibold text-gray-800 truncate leading-tight">
                    {{ result.entry.name }}
                  </p>
                  <p class="text-xs text-gray-400 truncate mt-0.5 leading-tight">
                    {{ result.entry.description }}
                  </p>
                </div>

                <!-- Context pill -->
                <span
                  class="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full
                         bg-gray-100 text-gray-500 whitespace-nowrap"
                >{{ result.entry.context }}</span>

                <!-- Arrow — shows on selected row -->
                <svg
                  v-if="i === selectedIdx && !result.entry.disabled"
                  class="flex-shrink-0 h-3.5 w-3.5 text-indigo-400"
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

          <!-- ── Footer ──────────────────────────────────────────────────── -->
          <div
            class="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50
                   text-[11px] text-gray-400"
          >
            <span class="flex items-center gap-1">
              <kbd class="px-1 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">↑</kbd>
              <kbd class="px-1 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">↓</kbd>
              navigate
            </span>
            <span>
              <kbd class="px-1 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">↵</kbd>
              open
            </span>
            <span>
              <kbd class="px-1 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">Esc</kbd>
              close
            </span>
            <span class="ml-auto flex items-center gap-1">
              <kbd class="px-1 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">⌘F</kbd>
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
.gs-fade-enter-from .gs-card  { transform: translateY(-6px) scale(0.985); opacity: 0; }
.gs-fade-leave-to   .gs-card  { transform: translateY(-3px); opacity: 0; }
</style>
