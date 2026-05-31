<!--
  ModelLibraryPanel.vue — Domain Model Library panel.

  Full-screen panel (z-[600]) presenting:
    - 18 built-in Planguage domain models across 6 example sub-categories
    - User-defined top-level categories (My Models, Our Models, custom)
    - "Bring in Models" flow: paste text → AI converts to Planguage entries
    - Sharpen section: apply AI improvement commands to user model entries

  Three internal modes:
    grid       — category-filtered card grid; browse and select models.
    bring-in   — form to paste text and import a new model (AI-powered).
    detail     — entry browser for a selected model; copy Planguage; sharpen.

  UI Rules satisfied:
    ScrollContainer rule — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule — close button uses CloseDot (on-dark, end of header).
    Single-Surface rule — caller registers 'modelLibrary' with registerExclusiveSurface.
    Define-by-Selection rule — no select-none on body content.
    DD-009 Zero-Training UI — all interactive elements have :title.
    Interaction Disclosure rule — multi-mode elements disclose all modes in title.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, nextTick } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  useModelLibrary,
  formatModelAsPlanguage,
  CATEGORIES_META,
} from '../composables/useModelLibrary'
import type {
  ModelCategory,
  ModelLibraryEntry,
  ModelCategoryDef,
} from '../composables/useModelLibrary'
import { useDocumentImport } from '../composables/useDocumentImport'

const emit = defineEmits<{ close: [] }>()

// ── Composables ───────────────────────────────────────────────────────────────

const library = useModelLibrary()
const { importFromFile, importLoading: fileExtracting } = useDocumentImport()

// ── Panel mode ────────────────────────────────────────────────────────────────

type PanelMode = 'grid' | 'bring-in' | 'detail'
const mode = ref<PanelMode>('grid')

// ── Sidebar state ─────────────────────────────────────────────────────────────

/** Selected top-level categoryId (null = 'examples' collapsed state using selectedSubCat). */
const selectedCategoryId  = ref<string>('examples')
/** Selected sub-category within 'examples'. */
const selectedSubCat      = ref<ModelCategory>('organizational')
/** Whether the 'examples' row is expanded to show sub-category items. */
const examplesExpanded    = ref(true)

/** Currently selected model id (for detail mode). */
const selectedModelId     = ref<string | null>(null)

/** Category currently being renamed (id). */
const renamingCategoryId  = ref<string | null>(null)
const renameInputValue    = ref('')
const renameInputRef      = ref<HTMLInputElement | null>(null)

// ── Bring-in form state ───────────────────────────────────────────────────────

const bringInTitle    = ref('')
const bringInCatId    = ref('my-models')
const bringInText     = ref('')
const fileInputRef    = ref<HTMLInputElement | null>(null)

// ── Detail / sharpen state ────────────────────────────────────────────────────

const copiedId         = ref<string | null>(null)
const sharpenCommand   = ref('')
const sharpenLoading   = ref(false)
const sharpenSuccess   = ref(false)
const sharpenError     = ref<string | null>(null)

// Abort controller for AI calls
let _abortController: AbortController | null = null

// ── Derived data ──────────────────────────────────────────────────────────────

const selectedModel = computed<ModelLibraryEntry | null>(() =>
  selectedModelId.value
    ? library.allEntries.value.find(e => e.id === selectedModelId.value) ?? null
    : null,
)

/** Models shown in the grid depending on selected category/sub-cat. */
const filteredModels = computed<ModelLibraryEntry[]>(() => {
  if (selectedCategoryId.value === 'examples') {
    return library.allEntries.value.filter(
      e => e.categoryId === 'examples' && e.exampleSubCategory === selectedSubCat.value,
    )
  }
  return library.allEntries.value.filter(e => e.categoryId === selectedCategoryId.value)
})

/** Count of models for a top-level category. */
function catCount(catId: string): number {
  if (catId === 'examples') {
    return library.allEntries.value.filter(e => e.categoryId === 'examples').length
  }
  return library.allEntries.value.filter(e => e.categoryId === catId).length
}

/** Count of models for an examples sub-category. */
function subCatCount(subCat: ModelCategory): number {
  return library.allEntries.value.filter(
    e => e.categoryId === 'examples' && e.exampleSubCategory === subCat,
  ).length
}

function getCatMeta(cat: ModelCategory) {
  return CATEGORIES_META.find(c => c.id === cat)!
}

/** Non-examples categories available in the Bring-in form dropdown. */
const bringInCategoryOptions = computed<ModelCategoryDef[]>(() =>
  library.categoryDefs.value.filter(c => c.id !== 'examples'),
)

// ── Sidebar actions ───────────────────────────────────────────────────────────

function selectTopLevelCat(catId: string): void {
  selectedCategoryId.value = catId
  mode.value = 'grid'
  selectedModelId.value = null
  cancelRename()
}

function selectSubCat(subCat: ModelCategory): void {
  selectedCategoryId.value = 'examples'
  selectedSubCat.value = subCat
  mode.value = 'grid'
  selectedModelId.value = null
  cancelRename()
}

function toggleExamples(): void {
  examplesExpanded.value = !examplesExpanded.value
}

function startRename(cat: ModelCategoryDef): void {
  if (!cat.isRenameable) return
  renamingCategoryId.value = cat.id
  renameInputValue.value = cat.label
  nextTick(() => renameInputRef.value?.focus())
}

function saveRename(): void {
  if (!renamingCategoryId.value) return
  library.renameCategory(renamingCategoryId.value, renameInputValue.value)
  cancelRename()
}

function cancelRename(): void {
  renamingCategoryId.value = null
  renameInputValue.value = ''
}

function handleRenameKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter')  { e.preventDefault(); saveRename() }
  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
}

function addNewCategory(): void {
  const def = library.addCategory('New Category')
  // Immediately select and put into rename mode
  selectedCategoryId.value = def.id
  mode.value = 'grid'
  selectedModelId.value = null
  nextTick(() => startRename(def))
}

function deleteCategory(cat: ModelCategoryDef): void {
  const count = catCount(cat.id)
  if (count > 0) {
    const ok = confirm(`Delete "${cat.label}" with ${count} model${count === 1 ? '' : 's'}? Models will be lost.`)
    if (!ok) return
    // Remove entries in this category
    library.allEntries.value
      .filter(e => e.categoryId === cat.id && e.source === 'user')
      .forEach(e => library.removeUserEntry(e.id))
  }
  library.removeCategory(cat.id)
  if (selectedCategoryId.value === cat.id) {
    selectedCategoryId.value = 'examples'
    selectedSubCat.value = 'organizational'
  }
}

// ── Grid actions ──────────────────────────────────────────────────────────────

function viewModel(id: string): void {
  selectedModelId.value = id
  mode.value = 'detail'
  sharpenCommand.value = ''
  sharpenSuccess.value = false
  sharpenError.value = null
}

function backToGrid(): void {
  selectedModelId.value = null
  mode.value = 'grid'
  _abortController?.abort()
}

async function copyPlanguage(entry: ModelLibraryEntry): Promise<void> {
  const text = formatModelAsPlanguage(entry)
  await navigator.clipboard.writeText(text).catch(() => { /* clipboard not available */ })
  copiedId.value = entry.id
  setTimeout(() => { copiedId.value = null }, 2500)
}

function openBringIn(): void {
  bringInTitle.value = ''
  bringInText.value  = ''
  // Default to first non-examples cat
  bringInCatId.value = bringInCategoryOptions.value[0]?.id ?? 'my-models'
  mode.value = 'bring-in'
  selectedModelId.value = null
}

// ── Bring-in actions ──────────────────────────────────────────────────────────

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
  bringInText.value  = text
  if (!bringInTitle.value) {
    bringInTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }
}

async function submitBringIn(): Promise<void> {
  if (!bringInText.value.trim()) return
  const entry = library.addUserEntry(
    bringInTitle.value,
    bringInCatId.value,
    bringInText.value,
  )
  // Switch to the category that was selected
  selectedCategoryId.value = bringInCatId.value
  mode.value = 'grid'
  // Kick off analysis in background
  _abortController = new AbortController()
  await library.analyseModelText(entry.id, _abortController.signal)
}

function triggerAnalyse(modelId: string): void {
  _abortController = new AbortController()
  library.analyseModelText(modelId, _abortController.signal)
}

// ── Sharpen actions ───────────────────────────────────────────────────────────

const SHARPEN_PILLS = ['Simplify', 'Add Values', 'Tighten Constraints', 'Make More Specific']

function fillSharpenPill(pill: string): void {
  sharpenCommand.value = pill
}

async function runSharpen(): Promise<void> {
  if (!selectedModel.value || !sharpenCommand.value.trim()) return
  sharpenLoading.value = true
  sharpenSuccess.value = false
  sharpenError.value   = null
  _abortController = new AbortController()
  try {
    await library.sharpenModel(selectedModel.value.id, sharpenCommand.value, _abortController.signal)
    sharpenSuccess.value = true
    setTimeout(() => { sharpenSuccess.value = false }, 3000)
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'AbortError') {
      sharpenError.value = err instanceof Error ? err.message : 'Sharpen failed'
    }
  } finally {
    sharpenLoading.value = false
  }
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
    aria-label="Model Library"
  >

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
      <span class="text-2xl" aria-hidden="true">🗂️</span>
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-bold text-white leading-tight tracking-tight">Model Library</h2>
        <p class="text-[11px] text-white/60 leading-tight mt-0.5">Planguage domain models — Examples, My Models, Our Models, and custom categories</p>
      </div>
      <CloseDot
        variant="on-dark"
        aria-label="Close Model Library"
        title="Close — return to the main planning workspace"
        @click="emit('close')"
      />
    </div>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="flex-1 flex overflow-hidden">

      <!-- ── LEFT SIDEBAR ───────────────────────────────────────────────── -->
      <div class="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">

        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="py-2"
        >

          <!-- ── Examples of Models (collapsible) ────────────────────────── -->
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            title="Examples of Models — click to expand or collapse the 6 built-in sub-categories"
            @click="toggleExamples"
          >
            <span class="text-base shrink-0" aria-hidden="true">📚</span>
            <span class="flex-1 min-w-0 truncate">Examples of Models</span>
            <span
              :class="['shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center bg-slate-100 text-slate-500']"
            >{{ catCount('examples') }}</span>
            <span class="shrink-0 text-slate-400 text-[10px]" aria-hidden="true">{{ examplesExpanded ? '▾' : '▸' }}</span>
          </button>

          <!-- Sub-category rows -->
          <template v-if="examplesExpanded">
            <button
              v-for="subCat in CATEGORIES_META"
              :key="subCat.id"
              type="button"
              :class="[
                'w-full flex items-center gap-2 pl-7 pr-3 py-2 text-left text-xs transition-colors duration-150',
                selectedCategoryId === 'examples' && selectedSubCat === subCat.id
                  ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50',
              ]"
              :title="`Browse ${subCat.label} example models`"
              @click="selectSubCat(subCat.id as ModelCategory)"
            >
              <span class="text-sm shrink-0" aria-hidden="true">{{ subCat.emoji }}</span>
              <span class="flex-1 min-w-0 truncate">{{ subCat.label }}</span>
              <span class="shrink-0 text-[10px] text-slate-400">{{ subCatCount(subCat.id as ModelCategory) }}</span>
            </button>
          </template>

          <!-- Divider -->
          <div class="h-px bg-slate-100 mx-3 my-1" />

          <!-- ── My Models ─────────────────────────────────────────────── -->
          <div
            v-for="cat in library.categoryDefs.value.filter(c => c.id !== 'examples')"
            :key="cat.id"
            :class="[
              'flex items-center gap-1 px-2 py-1 transition-colors duration-150',
              selectedCategoryId === cat.id
                ? 'border-l-2 border-blue-500 bg-blue-50'
                : '',
            ]"
          >
            <!-- Category row button -->
            <button
              type="button"
              :class="[
                'flex-1 flex items-center gap-2 px-1 py-1.5 text-left text-xs transition-colors duration-150 rounded min-w-0',
                selectedCategoryId === cat.id
                  ? 'text-blue-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-800',
              ]"
              :title="`Browse ${cat.label} — click to view models in this category`"
              @click="selectTopLevelCat(cat.id)"
            >
              <span class="text-sm shrink-0" aria-hidden="true">{{ cat.emoji }}</span>
              <!-- Rename input or label -->
              <template v-if="renamingCategoryId === cat.id">
                <input
                  ref="renameInputRef"
                  v-model="renameInputValue"
                  type="text"
                  class="flex-1 min-w-0 text-xs bg-white border border-blue-400 rounded px-1 py-0.5 outline-none"
                  :aria-label="`Rename category — currently '${cat.label}'`"
                  title="Rename this category — press Enter to save, Escape to cancel"
                  @keydown="handleRenameKeydown"
                  @blur="saveRename"
                  @click.stop
                />
              </template>
              <template v-else>
                <span class="flex-1 min-w-0 truncate">{{ cat.label }}</span>
                <span class="shrink-0 text-[10px] text-slate-400">{{ catCount(cat.id) }}</span>
              </template>
            </button>

            <!-- Rename button -->
            <button
              v-if="cat.isRenameable && renamingCategoryId !== cat.id"
              type="button"
              class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 text-[10px]"
              :title="`Rename '${cat.label}' — click to edit the category name`"
              @click.stop="startRename(cat)"
            >
              ✏️
            </button>

            <!-- Delete button (only user-created — not 'my-models'/'our-models') -->
            <button
              v-if="cat.id !== 'my-models' && cat.id !== 'our-models' && !cat.isBuiltin"
              type="button"
              class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 text-[10px]"
              :title="`Delete '${cat.label}' category — removes the category and all models in it`"
              @click.stop="deleteCategory(cat)"
            >
              ✕
            </button>
          </div>

          <!-- Divider -->
          <div class="h-px bg-slate-100 mx-3 my-1" />

          <!-- + New Category -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 mx-3 py-2 text-xs text-slate-500 border-2 border-dashed border-slate-200 rounded-lg hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            style="width: calc(100% - 24px);"
            title="Add a new custom category — click to create and name it"
            @click="addNewCategory"
          >
            <span aria-hidden="true">+</span>
            <span>New Category</span>
          </button>

        </ScrollContainer>

        <!-- Divider -->
        <div class="h-px bg-slate-200 mx-3" />

        <!-- + Bring in Models — always at very bottom of sidebar -->
        <div class="p-3">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors duration-150"
            title="Bring in Models — paste any text and AI converts it to Planguage entries"
            @click="openBringIn"
          >
            <span aria-hidden="true">+</span>
            <span>Bring in Models</span>
          </button>
        </div>

      </div>

      <!-- ── MAIN CONTENT AREA ───────────────────────────────────────────── -->
      <div class="flex-1 min-w-0 flex flex-col">

        <!-- MODE A: Grid -->
        <template v-if="mode === 'grid'">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5"
          >
            <!-- Empty state -->
            <div
              v-if="filteredModels.length === 0"
              class="flex flex-col items-center justify-center py-16 text-slate-400"
            >
              <span class="text-4xl mb-3" aria-hidden="true">📭</span>
              <p class="text-sm font-medium">No models yet</p>
              <p class="text-xs mt-1 mb-4">Use "Bring in Models" to add one</p>
              <button
                type="button"
                class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-4 py-2 transition-colors duration-150"
                title="Bring in Models — paste any text and AI converts it to Planguage entries"
                @click="openBringIn"
              >
                <span aria-hidden="true">+</span>
                <span>Bring in Models</span>
              </button>
            </div>

            <!-- Card grid -->
            <div
              v-else
              class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <div
                v-for="model in filteredModels"
                :key="model.id"
                class="flex flex-col rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <!-- Card header -->
                <div
                  :class="[
                    'px-4 py-3 flex items-center gap-2',
                    model.categoryId === 'examples' && model.exampleSubCategory
                      ? CAT_HEADER_CLASS[model.exampleSubCategory]
                      : 'bg-gradient-to-r from-blue-700 to-blue-600',
                  ]"
                >
                  <span
                    v-if="model.categoryId === 'examples' && model.exampleSubCategory"
                    class="text-lg shrink-0"
                    aria-hidden="true"
                  >{{ getCatMeta(model.exampleSubCategory).emoji }}</span>
                  <span v-else class="text-lg shrink-0" aria-hidden="true">📄</span>
                  <span class="text-sm font-bold text-white truncate flex-1 min-w-0">{{ model.title }}</span>

                  <!-- Category badge -->
                  <span
                    v-if="model.categoryId === 'examples'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-teal-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >Example</span>
                  <span
                    v-else-if="model.categoryId === 'my-models'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-blue-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >Mine</span>
                  <span
                    v-else-if="model.categoryId === 'our-models'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-purple-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >Ours</span>
                  <span
                    v-else
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-violet-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >{{ library.categoryDefs.value.find(c => c.id === model.categoryId)?.label ?? 'Custom' }}</span>
                </div>

                <!-- Analysis status indicator (user models only) -->
                <div
                  v-if="model.source === 'user' && model.analysisStatus === 'analysing'"
                  class="flex items-center gap-1.5 px-4 py-1.5 bg-amber-50 border-b border-amber-100"
                >
                  <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                  <span class="text-[10px] text-amber-700 font-medium">Analysing…</span>
                </div>
                <div
                  v-else-if="model.source === 'user' && model.analysisStatus === 'error'"
                  class="flex items-center gap-1.5 px-4 py-1.5 bg-red-50 border-b border-red-100"
                >
                  <span class="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  <span class="text-[10px] text-red-700 font-medium">Analysis failed</span>
                </div>

                <!-- Card body -->
                <div class="flex-1 flex flex-col p-4 gap-3">
                  <p class="text-xs text-slate-600 leading-relaxed">{{ model.description }}</p>

                  <!-- Entry type counts -->
                  <div v-if="model.entries.length > 0" class="flex flex-wrap gap-1">
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
                  <div v-else-if="model.source === 'user'" class="flex items-center gap-1">
                    <span class="text-[10px] text-slate-400 italic">
                      {{
                        model.analysisStatus === 'analysing'
                          ? 'Analysing text into Planguage…'
                          : model.analysisStatus === 'done'
                          ? 'Ready'
                          : 'Text model — not yet analysed'
                      }}
                    </span>
                  </div>

                  <!-- Stakeholder chips (max 3 + overflow) -->
                  <div v-if="model.stakeholders.length > 0" class="flex flex-wrap gap-1">
                    <span
                      v-for="(s, i) in model.stakeholders.slice(0, 3)"
                      :key="i"
                      class="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
                    >{{ s }}</span>
                    <span
                      v-if="model.stakeholders.length > 3"
                      class="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5"
                      :title="model.stakeholders.slice(3).join(', ')"
                    >+{{ model.stakeholders.length - 3 }} more</span>
                  </div>
                </div>

                <!-- Card footer -->
                <div class="px-4 pb-4 flex gap-2 items-center">
                  <button
                    type="button"
                    :class="[
                      'flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-150',
                      model.categoryId === 'examples' && model.exampleSubCategory
                        ? CAT_BUTTON_CLASS[model.exampleSubCategory]
                        : 'bg-blue-600 hover:bg-blue-700',
                    ]"
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

        <!-- MODE B: Bring in Models form -->
        <template v-else-if="mode === 'bring-in'">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-6 max-w-2xl mx-auto w-full"
          >
            <!-- Back link -->
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors duration-150 px-2 py-1 rounded hover:bg-slate-100 mb-6"
              title="Back to Model Library grid — discard this form"
              @click="mode = 'grid'"
            >
              ← Back to Library
            </button>

            <h3 class="text-base font-bold text-slate-800 mb-5">Bring in a Model</h3>

            <!-- Title -->
            <div class="flex flex-col gap-1.5 mb-4">
              <label class="text-xs font-semibold text-slate-600" for="bring-in-title">
                Title <span class="font-normal text-slate-400">(optional — AI will suggest from text)</span>
              </label>
              <input
                id="bring-in-title"
                v-model="bringInTitle"
                type="text"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="e.g. Customer Portal Strategy"
                title="Title for this model — leave blank for AI to suggest one from your text"
              />
            </div>

            <!-- Category dropdown -->
            <div class="flex flex-col gap-1.5 mb-4">
              <label class="text-xs font-semibold text-slate-600" for="bring-in-cat">
                Add to category
              </label>
              <select
                id="bring-in-cat"
                v-model="bringInCatId"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                title="Choose which category this model will appear in"
              >
                <option
                  v-for="cat in bringInCategoryOptions"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.emoji }} {{ cat.label }}
                </option>
              </select>
            </div>

            <!-- Model text -->
            <div class="flex flex-col gap-1.5 mb-4">
              <label class="text-xs font-semibold text-slate-600" for="bring-in-text">
                Model text
              </label>
              <p class="text-[11px] text-slate-400 -mt-1">
                Paste any text — strategy doc, spec, plan, rough notes — AI converts it to Planguage F./V./C./R./S. entries.
              </p>
              <textarea
                id="bring-in-text"
                v-model="bringInText"
                rows="10"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono resize-y"
                placeholder="Paste your text here…"
                title="Paste any text — AI will convert it to structured Planguage entries"
              />
            </div>

            <!-- OR import from file -->
            <div class="flex items-center gap-3 mb-6">
              <div class="flex-1 h-px bg-slate-200" />
              <span class="text-xs text-slate-400">OR</span>
              <div class="flex-1 h-px bg-slate-200" />
            </div>
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-3 py-3 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150 mb-6"
              :disabled="fileExtracting"
              title="Import from file — supports .txt, .md, and PDF files"
              @click="triggerUpload"
            >
              <span aria-hidden="true">{{ fileExtracting ? '⏳' : '📎' }}</span>
              <span>{{ fileExtracting ? 'Importing…' : 'Import from file (.txt, .md, .pdf)' }}</span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              class="hidden"
              aria-label="Upload model file to import as text"
              @change="handleFileUpload"
            />

            <!-- Submit -->
            <button
              type="button"
              :disabled="!bringInText.trim()"
              :class="[
                'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-150',
                bringInText.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
              ]"
              title="Analyse and Import — AI converts your text to Planguage entries and saves the model"
              @click="submitBringIn"
            >
              <span aria-hidden="true">▶</span>
              <span>Analyse &amp; Import</span>
            </button>
          </ScrollContainer>
        </template>

        <!-- MODE C: Detail view -->
        <template v-else-if="mode === 'detail' && selectedModel">
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
              <span
                v-if="selectedModel.categoryId === 'examples' && selectedModel.exampleSubCategory"
                class="text-[10px] text-slate-400"
              >{{ getCatMeta(selectedModel.exampleSubCategory).emoji }} {{ getCatMeta(selectedModel.exampleSubCategory).label }}</span>
              <span v-else class="text-[10px] text-slate-400">
                {{ library.categoryDefs.value.find(c => c.id === selectedModel.categoryId)?.emoji }}
                {{ library.categoryDefs.value.find(c => c.id === selectedModel.categoryId)?.label }}
              </span>
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

            <!-- Stakeholders -->
            <div v-if="selectedModel.stakeholders.length > 0" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Stakeholders</h3>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(s, i) in selectedModel.stakeholders"
                  :key="i"
                  class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 font-medium"
                >{{ s }}</span>
              </div>
            </div>

            <!-- User model: analysing state -->
            <div
              v-if="selectedModel.source === 'user' && selectedModel.analysisStatus === 'analysing'"
              class="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-xl ring-1 ring-amber-200"
            >
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true" />
              <span class="text-sm text-amber-800 font-medium">Analysing your text into Planguage…</span>
            </div>

            <!-- User model: idle or error — show raw text + analyse button -->
            <div
              v-else-if="selectedModel.source === 'user' && (selectedModel.analysisStatus === 'idle' || selectedModel.analysisStatus === 'error') && selectedModel.userText"
              class="flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Model Text</h3>
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-150 px-2 py-1 rounded hover:bg-blue-50"
                  title="Analyse Now — run AI to convert this text to structured Planguage entries"
                  @click="triggerAnalyse(selectedModel.id)"
                >
                  <span aria-hidden="true">🔄</span>
                  <span>Analyse Now</span>
                </button>
              </div>
              <p
                v-if="selectedModel.analysisStatus === 'error'"
                class="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"
              >
                Analysis failed: {{ selectedModel.analysisError ?? 'Unknown error' }}
              </p>
              <pre class="text-xs text-slate-700 bg-white rounded-xl ring-1 ring-slate-200 p-4 whitespace-pre-wrap leading-relaxed font-mono">{{ selectedModel.userText }}</pre>
            </div>

            <!-- Planguage entries (built-in or successfully analysed user models) -->
            <div v-if="selectedModel.entries.length > 0" class="flex flex-col gap-2">
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
                    >{{ entry.type }}.</span>
                    <span class="text-xs text-slate-800 font-medium leading-relaxed">{{ entry.description }}</span>
                  </div>
                  <p v-if="entry.details" class="text-[11px] text-slate-500 leading-relaxed pl-8">{{ entry.details }}</p>
                </div>
              </div>
            </div>

            <!-- ── Sharpen section (user models only) ───────────────────── -->
            <div
              v-if="selectedModel.source === 'user'"
              class="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2"
            >
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Sharpen this model</h3>

              <!-- Quick pills -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="pill in SHARPEN_PILLS"
                  :key="pill"
                  type="button"
                  :class="[
                    'text-xs rounded-full px-3 py-1.5 font-medium transition-colors duration-150 border',
                    sharpenCommand === pill
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600',
                  ]"
                  :title="`${pill} — click to fill the command box, then press Sharpen to apply`"
                  @click="fillSharpenPill(pill)"
                >
                  {{ pill }}
                </button>
              </div>

              <!-- Custom command row -->
              <div class="flex gap-2">
                <input
                  v-model="sharpenCommand"
                  type="text"
                  class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Or type a custom improvement command…"
                  title="Improvement command — describe how to improve this model, then click Sharpen"
                  @keydown.enter="runSharpen"
                />
                <button
                  type="button"
                  :disabled="sharpenLoading || !sharpenCommand.trim()"
                  :class="[
                    'shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150',
                    sharpenLoading || !sharpenCommand.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white',
                  ]"
                  title="Sharpen — apply the improvement command to this model's Planguage entries using AI"
                  @click="runSharpen"
                >
                  <span aria-hidden="true">{{ sharpenLoading ? '⏳' : '▶' }}</span>
                  <span>{{ sharpenLoading ? 'Improving…' : 'Sharpen' }}</span>
                </button>
              </div>

              <!-- Sharpen status -->
              <p
                v-if="sharpenSuccess"
                class="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2"
              >
                Model sharpened ✓
              </p>
              <p
                v-else-if="sharpenError"
                class="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2"
              >
                {{ sharpenError }}
              </p>
            </div>

          </ScrollContainer>
        </template>

      </div>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <div class="shrink-0 bg-slate-50 border-t border-slate-200 py-2 text-center">
      <p class="text-[10px] text-slate-400 leading-tight">
        Domain models in Planguage — browse, bring in, sharpen, and load into SEM for analysis
      </p>
    </div>

  </div>
</template>
