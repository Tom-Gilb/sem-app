<!--
  ModelLibraryPanel.vue — Domain Model Library panel.

  Full-screen panel (z-[600]) presenting 18 built-in Planguage domain models
  across 6 categories (Organizational, Project, Product, National, International,
  Software) plus user-uploaded models.

  Two internal views:
    Grid view  — category-filtered card grid; browse and select models.
    Detail view — entry browser for a selected model; copy Planguage; back to grid.

  UI Rules satisfied:
    ScrollContainer rule — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule — close button uses CloseDot (on-dark, end of header).
    Single-Surface rule — caller registers 'modelLibrary' with registerExclusiveSurface.
    Define-by-Selection rule — no select-none on body content.
    DD-009 Zero-Training UI — all interactive elements have :title.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useModelLibrary, formatModelAsPlanguage, CATEGORIES_META } from '../composables/useModelLibrary'
import type { ModelCategory, ModelLibraryEntry } from '../composables/useModelLibrary'
import { useDocumentImport } from '../composables/useDocumentImport'

const emit = defineEmits<{ close: [] }>()

// ── Composables ───────────────────────────────────────────────────────────────

const library = useModelLibrary()
const { importFromFile, importLoading: fileExtracting } = useDocumentImport()

// ── Navigation state ──────────────────────────────────────────────────────────

const selectedCat     = ref<ModelCategory>('organizational')
const selectedModelId = ref<string | null>(null)
const fileInputRef    = ref<HTMLInputElement | null>(null)
const copiedId        = ref<string | null>(null)

// ── Derived data ──────────────────────────────────────────────────────────────

const selectedModel = computed<ModelLibraryEntry | null>(() =>
  selectedModelId.value
    ? library.allEntries.value.find(e => e.id === selectedModelId.value) ?? null
    : null,
)

const filteredModels = computed<ModelLibraryEntry[]>(() =>
  library.allEntries.value.filter(e => e.category === selectedCat.value),
)

function getCatMeta(cat: ModelCategory) {
  return CATEGORIES_META.find(c => c.id === cat)!
}

// ── Actions ───────────────────────────────────────────────────────────────────

function viewModel(id: string): void {
  selectedModelId.value = id
}

function backToGrid(): void {
  selectedModelId.value = null
}

async function copyPlanguage(entry: ModelLibraryEntry): Promise<void> {
  const text = formatModelAsPlanguage(entry)
  await navigator.clipboard.writeText(text).catch(() => { /* clipboard not available */ })
  copiedId.value = entry.id
  setTimeout(() => { copiedId.value = null }, 2500)
}

function triggerUpload(): void {
  fileInputRef.value?.click()
}

async function handleFileUpload(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await importFromFile(file)
  if (!text) return
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  library.addUserEntry(title, selectedCat.value, text)
}

// ── Entry count helpers ───────────────────────────────────────────────────────

type EntryType = 'F' | 'V' | 'C' | 'R' | 'S'

function countByType(entry: ModelLibraryEntry, type: EntryType): number {
  return entry.entries.filter(e => e.type === type).length
}

// ── Tailwind class maps (static strings — no JIT runtime concatenation) ───────

const CAT_HEADER_CLASS: Record<ModelCategory, string> = {
  organizational: 'bg-gradient-to-r from-slate-700 to-slate-600',
  project:        'bg-gradient-to-r from-amber-700 to-amber-600',
  product:        'bg-gradient-to-r from-orange-700 to-orange-600',
  national:       'bg-gradient-to-r from-blue-700 to-blue-600',
  international:  'bg-gradient-to-r from-indigo-700 to-indigo-600',
  software:       'bg-gradient-to-r from-violet-700 to-violet-600',
}

const CAT_BUTTON_CLASS: Record<ModelCategory, string> = {
  organizational: 'bg-slate-700 hover:bg-slate-800 text-white',
  project:        'bg-amber-600 hover:bg-amber-700 text-white',
  product:        'bg-orange-600 hover:bg-orange-700 text-white',
  national:       'bg-blue-600 hover:bg-blue-700 text-white',
  international:  'bg-indigo-600 hover:bg-indigo-700 text-white',
  software:       'bg-violet-600 hover:bg-violet-700 text-white',
}

const CAT_SIDEBAR_ACTIVE_CLASS: Record<ModelCategory, string> = {
  organizational: 'bg-slate-100 text-slate-800 font-semibold',
  project:        'bg-amber-50 text-amber-800 font-semibold',
  product:        'bg-orange-50 text-orange-800 font-semibold',
  national:       'bg-blue-50 text-blue-800 font-semibold',
  international:  'bg-indigo-50 text-indigo-800 font-semibold',
  software:       'bg-violet-50 text-violet-800 font-semibold',
}

const CAT_BADGE_CLASS: Record<ModelCategory, string> = {
  organizational: 'bg-slate-200 text-slate-700',
  project:        'bg-amber-100 text-amber-700',
  product:        'bg-orange-100 text-orange-700',
  national:       'bg-blue-100 text-blue-700',
  international:  'bg-indigo-100 text-indigo-700',
  software:       'bg-violet-100 text-violet-700',
}

const TYPE_BADGE_CLASS: Record<EntryType, string> = {
  F: 'bg-orange-100 text-orange-700',
  V: 'bg-blue-100 text-blue-700',
  C: 'bg-red-100 text-red-700',
  R: 'bg-emerald-100 text-emerald-700',
  S: 'bg-violet-100 text-violet-700',
}

const ENTRY_TYPES: EntryType[] = ['F', 'V', 'C', 'R', 'S']
</script>

<template>
  <!-- Full-screen panel — z-[600] sits above all major surfaces -->
  <div
    class="fixed inset-0 z-[600] bg-slate-50 flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label="Domain Model Library"
  >

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
      <span class="text-2xl" aria-hidden="true">🗂️</span>
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-bold text-white leading-tight tracking-tight">Domain Models</h2>
        <p class="text-[11px] text-white/60 leading-tight mt-0.5">Planguage model library — 6 domains</p>
      </div>
      <CloseDot
        variant="on-dark"
        aria-label="Close Domain Model Library"
        title="Close — return to the main planning workspace"
        @click="emit('close')"
      />
    </div>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="flex-1 flex overflow-hidden">

      <!-- Sidebar -->
      <div class="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <!-- Category buttons -->
        <div class="flex-1 overflow-y-auto py-2">
          <button
            v-for="cat in CATEGORIES_META"
            :key="cat.id"
            type="button"
            :class="[
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors duration-150',
              selectedCat === cat.id
                ? CAT_SIDEBAR_ACTIVE_CLASS[cat.id as ModelCategory]
                : 'text-slate-600 hover:bg-slate-50',
            ]"
            :title="`Browse ${cat.label} models`"
            @click="selectedCat = cat.id as ModelCategory; selectedModelId = null"
          >
            <span class="text-base shrink-0" aria-hidden="true">{{ cat.emoji }}</span>
            <span class="flex-1 min-w-0 truncate">{{ cat.label }}</span>
            <span
              :class="[
                'shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                selectedCat === cat.id
                  ? CAT_BADGE_CLASS[cat.id as ModelCategory]
                  : 'bg-slate-100 text-slate-500',
              ]"
            >
              {{ library.allEntries.value.filter(e => e.category === cat.id).length }}
            </span>
          </button>
        </div>

        <!-- Divider -->
        <div class="h-px bg-slate-200 mx-3" />

        <!-- Upload button -->
        <div class="p-3">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            :title="`Upload a model file to the ${getCatMeta(selectedCat).label} category — supports PDF, Word, and plain text`"
            :disabled="fileExtracting"
            @click="triggerUpload"
          >
            <span aria-hidden="true">{{ fileExtracting ? '⏳' : '+' }}</span>
            <span>{{ fileExtracting ? 'Importing…' : 'Add Model' }}</span>
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            class="hidden"
            :aria-label="`Upload model file to ${getCatMeta(selectedCat).label} category`"
            @change="handleFileUpload"
          />
        </div>
      </div>

      <!-- ── Main area ─────────────────────────────────────────────────────── -->
      <div class="flex-1 min-w-0 flex flex-col">

        <!-- GRID VIEW — no model selected -->
        <template v-if="!selectedModelId">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5"
          >
            <!-- Empty state -->
            <div
              v-if="filteredModels.length === 0"
              class="flex flex-col items-center justify-center py-16 text-slate-400"
            >
              <span class="text-4xl mb-3" aria-hidden="true">{{ getCatMeta(selectedCat).emoji }}</span>
              <p class="text-sm font-medium">No models in {{ getCatMeta(selectedCat).label }} yet</p>
              <p class="text-xs mt-1">Use "Add Model" to upload one</p>
            </div>

            <!-- Card grid -->
            <div
              v-else
              class="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div
                v-for="model in filteredModels"
                :key="model.id"
                class="flex flex-col rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <!-- Card header — category gradient -->
                <div
                  :class="['px-4 py-3 flex items-center gap-2', CAT_HEADER_CLASS[model.category]]"
                >
                  <span class="text-lg shrink-0" aria-hidden="true">{{ getCatMeta(model.category).emoji }}</span>
                  <span class="text-sm font-bold text-white truncate flex-1 min-w-0">{{ model.title }}</span>
                  <span
                    v-if="model.source === 'user'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-white/20 text-white/80 rounded px-1.5 py-0.5"
                  >
                    Yours
                  </span>
                </div>

                <!-- Card body -->
                <div class="flex-1 flex flex-col p-4 gap-3">
                  <!-- Description -->
                  <p class="text-xs text-slate-600 leading-relaxed">{{ model.description }}</p>

                  <!-- Entry type counts (built-in only) -->
                  <div v-if="model.source === 'built-in'" class="flex flex-wrap gap-1">
                    <template v-for="t in ENTRY_TYPES" :key="t">
                      <span
                        v-if="countByType(model, t) > 0"
                        :class="['text-[10px] font-bold px-1.5 py-0.5 rounded', TYPE_BADGE_CLASS[t]]"
                        :title="`${countByType(model, t)} ${t}. ${t === 'F' ? 'Function' : t === 'V' ? 'Value' : t === 'C' ? 'Constraint' : t === 'R' ? 'Resource' : 'Solution'} entries`"
                      >
                        {{ t }}.×{{ countByType(model, t) }}
                      </span>
                    </template>
                  </div>
                  <div v-else class="flex items-center gap-1">
                    <span class="text-[10px] text-slate-400 italic">User-uploaded text model</span>
                  </div>

                  <!-- Stakeholder chips (built-in only, max 3 + overflow) -->
                  <div v-if="model.stakeholders.length > 0" class="flex flex-wrap gap-1">
                    <span
                      v-for="(s, i) in model.stakeholders.slice(0, 3)"
                      :key="i"
                      class="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
                    >
                      {{ s }}
                    </span>
                    <span
                      v-if="model.stakeholders.length > 3"
                      class="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5"
                      :title="model.stakeholders.slice(3).join(', ')"
                    >
                      +{{ model.stakeholders.length - 3 }} more
                    </span>
                  </div>
                </div>

                <!-- Card footer -->
                <div class="px-4 pb-4 flex gap-2 items-center">
                  <button
                    type="button"
                    :class="['flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-150', CAT_BUTTON_CLASS[model.category]]"
                    :title="`View ${model.title} — browse Planguage entries and copy`"
                    @click="viewModel(model.id)"
                  >
                    View →
                  </button>
                  <button
                    v-if="model.source === 'user'"
                    type="button"
                    class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors duration-150 text-xs font-bold"
                    title="Delete this model — cannot be undone"
                    @click="library.removeUserEntry(model.id)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </ScrollContainer>
        </template>

        <!-- DETAIL VIEW — model selected -->
        <template v-else-if="selectedModel">
          <!-- Detail header -->
          <div class="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-200 shrink-0">
            <button
              type="button"
              class="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors duration-150 px-2 py-1 rounded hover:bg-slate-100"
              title="Back to model grid — return to category browser"
              @click="backToGrid"
            >
              ← Back
            </button>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-bold text-slate-800 truncate block">{{ selectedModel.title }}</span>
              <span class="text-[10px] text-slate-400">{{ getCatMeta(selectedModel.category).emoji }} {{ getCatMeta(selectedModel.category).label }}</span>
            </div>
            <button
              type="button"
              :class="[
                'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                copiedId === selectedModel.id
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ]"
              title="Copy Planguage — copy this model's full Planguage text to clipboard"
              @click="copyPlanguage(selectedModel)"
            >
              <span aria-hidden="true">{{ copiedId === selectedModel.id ? '✓' : '📋' }}</span>
              <span>{{ copiedId === selectedModel.id ? 'Copied!' : 'Copy Planguage' }}</span>
            </button>
          </div>

          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5 flex flex-col gap-4"
          >
            <!-- Description -->
            <p class="text-sm text-slate-600 leading-relaxed">{{ selectedModel.description }}</p>

            <!-- Stakeholders section (built-in only) -->
            <div v-if="selectedModel.stakeholders.length > 0" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Stakeholders</h3>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(s, i) in selectedModel.stakeholders"
                  :key="i"
                  class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 font-medium"
                >
                  {{ s }}
                </span>
              </div>
            </div>

            <!-- User model: raw text view -->
            <div v-if="selectedModel.source === 'user' && selectedModel.userText" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Model Text</h3>
              <pre class="text-xs text-slate-700 bg-white rounded-xl ring-1 ring-slate-200 p-4 whitespace-pre-wrap leading-relaxed font-mono">{{ selectedModel.userText }}</pre>
            </div>

            <!-- Built-in entries by type -->
            <div v-if="selectedModel.source === 'built-in' && selectedModel.entries.length > 0" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Planguage Entries</h3>
              <div class="flex flex-col gap-2">
                <div
                  v-for="(entry, i) in selectedModel.entries"
                  :key="i"
                  class="flex flex-col gap-0.5 rounded-lg bg-white ring-1 ring-slate-200 px-4 py-3"
                >
                  <div class="flex items-start gap-2">
                    <span
                      :class="['shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5', TYPE_BADGE_CLASS[entry.type]]"
                      :title="`${entry.type}. entry — ${entry.type === 'F' ? 'Function: binary capability present or absent' : entry.type === 'V' ? 'Value: measurable quality attribute' : entry.type === 'C' ? 'Constraint: hard boundary that must not be breached' : entry.type === 'R' ? 'Resource: budget or resource boundary' : 'Solution: design choice or means'}`"
                    >
                      {{ entry.type }}.
                    </span>
                    <span class="text-xs text-slate-800 font-medium leading-relaxed">{{ entry.description }}</span>
                  </div>
                  <p v-if="entry.details" class="text-[11px] text-slate-500 leading-relaxed pl-8">{{ entry.details }}</p>
                </div>
              </div>
            </div>
          </ScrollContainer>
        </template>

      </div>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <div class="shrink-0 bg-slate-50 border-t border-slate-200 py-2 text-center">
      <p class="text-[10px] text-slate-400 leading-tight">
        Domain models in Planguage — browse, tune, and load into SEM for analysis
      </p>
    </div>

  </div>
</template>
