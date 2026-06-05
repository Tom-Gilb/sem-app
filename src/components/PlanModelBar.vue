<!-- PlanModelBar.vue — Plan Model identity strip
     Shows the current Plan Model name + version above the Evo Plan view.
     Supports inline name/version editing, export to .json, and loading a
     saved model by tag + version or by importing a .json file.

     Emits:
       load(PlanModel) — user recalled a model; parent should restore the spec. -->

<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13) — Save and Get glyphs replace 💾 / 📂 / 📥 everywhere.
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'
// 2026-05-14 — Tom's standing instruction: apply the same hover-`?` split-button
// pattern (proven on Priority) to Save/Get buttons so users can click the glyph
// half to read the "About the Save Glyph" essay (SaveGlyphHistoryPanel).
import SaveGetActionButton from './SaveGetActionButton.vue'
import {
  useSpecModel,
  exportPlanModel,
  setSpecName,
  setSpecVersion,
  importPlanModel,
  type SpecModel,
  type PlanModel,
} from '../composables/useSpecModel'

const emit = defineEmits<{
  load: [model: SpecModel]
  compare: []
  save: []
  /**
   * User clicked one of the people chips (🔑 Owner / 💡 Planner / ⌨️ Scribe).
   * Parent should open the PlanOwnerPanel and pre-select the matching tab.
   * Replaces the legacy inline owner editor that used to live inside this bar.
   */
  'open-people': [tab: 'owners' | 'planners' | 'scribes']
  /**
   * User clicked the glyph half of any Save/Get split-button in this bar.
   * Parent should open the SaveGlyphHistoryPanel essay modal.
   */
  'open-save-glyph-history': []
}>()

const { currentModel, allModels } = useSpecModel()

// ── Inline name editing ───────────────────────────────────────────────────────

const editingName    = ref(false)
const nameInput      = ref('')
const nameInputEl    = ref<HTMLInputElement | null>(null)

function startEditName(): void {
  nameInput.value    = currentModel.value?.name ?? ''
  editingName.value  = true
  // autofocus alone is unreliable on dynamically-inserted Vue elements —
  // use explicit nextTick focus so the input has DOM presence before the
  // user's first keypress arrives (prevents the letter landing on a stale
  // focus target such as the adjacent Export button).
  nextTick(() => {
    nameInputEl.value?.focus()
    nameInputEl.value?.select()
  })
}

function commitName(): void {
  const v = nameInput.value.trim()
  if (v) setSpecName(v)
  editingName.value = false
}

function cancelEditName(): void {
  editingName.value = false
}

// ── Inline version editing ────────────────────────────────────────────────────

const editingVersion = ref(false)
const versionInput = ref('')

function startEditVersion(): void {
  versionInput.value = currentModel.value?.version ?? ''
  editingVersion.value = true
}

function commitVersion(): void {
  const v = versionInput.value.trim()
  if (v) setSpecVersion(v)
  editingVersion.value = false
}

function cancelEditVersion(): void {
  editingVersion.value = false
}

// ── Save status ───────────────────────────────────────────────────────────────

/** Live "now" ref — refreshed every 30 s so elapsed time stays current. */
const now = ref(Date.now())
const _nowTimer = setInterval(() => { now.value = Date.now() }, 30_000)
onUnmounted(() => clearInterval(_nowTimer))

/**
 * e.g. "4:32 PM" — the last time this model was saved.
 * Uses a manual formatter instead of toLocaleTimeString() to avoid locale-dependent
 * output such as "4:32 PM (AEST)" which crowds the bar and obscures buttons.
 */
const savedAtLabel = computed((): string => {
  const ts = currentModel.value?.updatedAt
  if (!ts) return ''
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
})

/** Minutes elapsed since last save (0 when just saved). */
const elapsedMinutes = computed((): number => {
  const ts = currentModel.value?.updatedAt
  if (!ts) return 0
  return Math.floor((now.value - new Date(ts).getTime()) / 60_000)
})

// ── Owner pin (read-only contact card) ───────────────────────────────────────
// 2026-05-12 Tom: the old in-bar inline owner editor (ownerPanelOpen,
// startEditOwner, commitOwner, cancelOwner + six per-field refs) was deleted.
// All owner / planner / scribe editing now happens in the single canonical
// `PlanOwnerPanel` (3-tab Plan Responsibilities). The 📌 pin is retained as a
// read-only quick-view of owner contact data; its "Edit" / "add them now"
// affordances emit `open-people` so the user always lands in the proper panel.

const ownerPinOpen = ref(false)

function toggleOwnerPin(): void {
  ownerPinOpen.value  = !ownerPinOpen.value
  loadPanelOpen.value = false
}

// ── Load panel ────────────────────────────────────────────────────────────────

const loadPanelOpen = ref(false)

// Live search filter — matches name, tag slug, or version
const modelSearch = ref('')

const filteredModels = computed((): PlanModel[] => {
  const q = modelSearch.value.toLowerCase().trim()
  const models = allModels.value as PlanModel[]
  if (!q) return models
  return models.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.tag.toLowerCase().includes(q) ||
      m.version.toLowerCase().includes(q),
  )
})

function selectModel(model: PlanModel): void {
  loadPanelOpen.value = false
  modelSearch.value   = ''
  emit('load', model)
}

// Import from .json file
const fileError = ref('')

function handleFileImport(event: Event): void {
  fileError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      const model = importPlanModel(data)
      if (!model) {
        fileError.value = 'File is not a valid Plan Model (.json).'
        return
      }
      loadPanelOpen.value = false
      emit('load', model)
    } catch {
      fileError.value = 'Could not parse the file. Make sure it is a valid Plan Model .json.'
    }
  }
  reader.readAsText(file)
  // Reset so the same file can be re-imported if needed
  input.value = ''
}
</script>

<template>
  <!-- Empty fallback — shown when no plan model is active yet.
       Keeps the bar slot visible so the layout never collapses. -->
  <div
    v-if="!currentModel"
    class="w-full max-w-2xl mx-auto mb-4"
  >
    <div class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400">
      <span class="text-sm leading-none" aria-hidden="true">📋</span>
      <span class="text-sm italic">No plan model active</span>
    </div>
  </div>

  <div
    v-if="currentModel"
    class="w-full max-w-2xl mx-auto mb-4"
  >
    <!-- Model identity bar -->
    <div class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white">
      <!-- Plan icon — replaces the cryptic "PLAN MODEL" all-caps label -->
      <span
        class="flex-shrink-0 text-slate-400 text-sm leading-none"
        title="Plan Model — name, version and save status for this planning session"
        aria-label="Plan Model"
      >📋</span>

      <!-- Name (editable) — click name or pencil to rename -->
      <div class="flex-1 min-w-0 flex items-center gap-1">
        <template v-if="editingName">
          <input
            ref="nameInputEl"
            v-model="nameInput"
            class="flex-1 min-w-0 bg-slate-700 text-white text-sm font-semibold rounded px-2 py-0.5
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
            @keydown.enter="commitName"
            @keydown.escape="cancelEditName"
            @blur="commitName"
          />
        </template>
        <template v-else>
          <button
            type="button"
            class="text-sm font-semibold text-white truncate hover:text-blue-300
                   focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1 -ml-1"
            aria-label="Click to rename model"
            @click="startEditName"
          >
            {{ currentModel.name }}
          </button>
          <!-- Always-visible pencil so rename is discoverable -->
          <button
            type="button"
            class="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded
                   text-slate-400 hover:text-white hover:bg-slate-600
                   focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
            aria-label="Rename model"
            title="Rename"
            @click="startEditName"
          >
            <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </template>
      </div>

      <!-- Version badge (editable) -->
      <div class="flex-shrink-0">
        <template v-if="editingVersion">
          <input
            v-model="versionInput"
            class="w-16 bg-slate-700 text-white text-xs font-mono rounded px-2 py-0.5
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
            autofocus
            @keydown.enter="commitVersion"
            @keydown.escape="cancelEditVersion"
            @blur="commitVersion"
          />
        </template>
        <template v-else>
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-mono font-bold
                   hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Click to set version manually"
            aria-label="Set version manually"
            @click="startEditVersion"
          >
            v{{ currentModel.version }}
            <!-- Pencil — signals this is editable, same as the name pencil -->
            <svg class="h-2.5 w-2.5 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </template>
      </div>

      <!-- Rounds badge (if any) -->
      <span
        v-if="currentModel.sharpenRounds > 0"
        class="flex-shrink-0 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold"
        :title="`${currentModel.sharpenRounds} sharpening round${currentModel.sharpenRounds !== 1 ? 's' : ''} applied`"
      >
        🔪 {{ currentModel.sharpenRounds }}
      </span>

      <!-- People chips group — all three (🔑 Owner / 💡 Planner / ⌨️ Scribe)
           are ALWAYS rendered as actual clickable buttons. Each emits
           'open-people' with the matching tab name so the parent can open the
           full Plan Responsibilities panel pre-selected on that tab.

           Tom 2026-05-12: "clicking on owner on black ident bar does not give
           the window with all 3 options, and it does not display all 3 scribe
           owner planner". Diagnosis: the chips were wired correctly, but the
           empty-state styling (`bg-white/8 text-slate-400`) on slate-800 was
           so low-contrast that an unset Owner chip read as static text and
           Tom couldn't see/click it. Fix: keep the named state crisp, but
           the empty state now uses a dashed indigo border + indigo text + a
           "+ Add" affordance suffix so the chip is unambiguously a button. -->

      <!-- Owner chip (🔑) -->
      <button
        type="button"
        class="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
               transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        :class="currentModel.owners?.[0]?.name
          ? 'bg-white/15 text-white hover:bg-white/25'
          : 'border border-dashed border-indigo-400/70 text-indigo-200 hover:bg-white/15 hover:text-white hover:border-white/70'"
        :title="currentModel.owners?.[0]?.name
          ? `Owner: ${currentModel.owners[0].name} — click to open Spec Responsibilities`
          : 'No Owner set — click to add'"
        aria-label="Spec Owners"
        data-testid="planmodelbar-owner-chip"
        @click="emit('open-people', 'owners')"
      >
        <span aria-hidden="true">🔑</span>
        <span>{{ currentModel.owners?.[0]?.name || 'Owner' }}</span>
        <span
          v-if="!currentModel.owners?.[0]?.name"
          class="text-[10px] font-bold text-indigo-300"
          aria-hidden="true"
        >+</span>
        <span v-if="currentModel.owners?.length > 1" class="text-white/60 text-[10px]">+{{ currentModel.owners.length - 1 }}</span>
      </button>

      <!-- Planner chip (💡) -->
      <button
        type="button"
        class="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
               transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        :class="currentModel.planners?.[0]?.name
          ? 'bg-white/15 text-white hover:bg-white/25'
          : 'border border-dashed border-indigo-400/70 text-indigo-200 hover:bg-white/15 hover:text-white hover:border-white/70'"
        :title="currentModel.planners?.[0]?.name
          ? `Planner: ${currentModel.planners[0].name} — click to open Spec Responsibilities`
          : 'No Planner set — click to add'"
        aria-label="Spec Planners"
        data-testid="planmodelbar-planner-chip"
        @click="emit('open-people', 'planners')"
      >
        <span aria-hidden="true">💡</span>
        <span>{{ currentModel.planners?.[0]?.name || 'Planner' }}</span>
        <span
          v-if="!currentModel.planners?.[0]?.name"
          class="text-[10px] font-bold text-indigo-300"
          aria-hidden="true"
        >+</span>
        <span v-if="currentModel.planners?.length > 1" class="text-white/60 text-[10px]">+{{ currentModel.planners.length - 1 }}</span>
      </button>

      <!-- Scribe chip (⌨️) -->
      <button
        type="button"
        class="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
               transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        :class="currentModel.scribes?.[0]?.name
          ? 'bg-white/15 text-white hover:bg-white/25'
          : 'border border-dashed border-indigo-400/70 text-indigo-200 hover:bg-white/15 hover:text-white hover:border-white/70'"
        :title="currentModel.scribes?.[0]?.isDefault
          ? `Scribe (default — ${currentModel.scribes[0].name || 'tap to set your name'}) — click to open Spec Responsibilities`
          : currentModel.scribes?.[0]?.name
            ? `Scribe: ${currentModel.scribes[0].name} — click to open Spec Responsibilities`
            : 'No Scribe set — click to add'"
        aria-label="Spec Scribes"
        data-testid="planmodelbar-scribe-chip"
        @click="emit('open-people', 'scribes')"
      >
        <span aria-hidden="true">⌨️</span>
        <span>{{ currentModel.scribes?.[0]?.name || 'Scribe' }}</span>
        <span
          v-if="!currentModel.scribes?.[0]?.name"
          class="text-[10px] font-bold text-indigo-300"
          aria-hidden="true"
        >+</span>
        <span
          v-if="currentModel.scribes?.[0]?.isDefault"
          class="text-white/40 text-[9px] leading-none"
        >(default)</span>
        <span v-if="currentModel.scribes?.length > 1" class="text-white/60 text-[10px]">+{{ currentModel.scribes.length - 1 }}</span>
      </button>

      <!-- Owner pin — quick read-only contact card (📌); kept for historical parity -->
      <button
        type="button"
        class="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded
               transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        :class="ownerPinOpen ? 'text-amber-300 bg-white/15' : 'text-slate-500 hover:text-amber-300 hover:bg-white/10'"
        title="Owner Data — view contact details"
        aria-label="View owner data"
        @click="toggleOwnerPin"
      >
        <span class="text-xs leading-none" aria-hidden="true">📌</span>
      </button>

      <!-- Action buttons — icon + short label to keep bar compact -->
      <div class="flex items-center gap-1 flex-shrink-0 ml-auto">
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                 text-slate-300 hover:text-white hover:bg-slate-700
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
          title="Export plan model as .json — `*→[*]` save to file"
          aria-label="Export plan model as .json"
          @click="exportPlanModel"
        >
          <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
        </button>
        <!-- 2026-05-14: split-button — glyph half opens "About the Get Glyph"
             essay (SaveGlyphHistoryPanel), action half opens the Plans panel. -->
        <SaveGetActionButton
          kind="get"
          label="Plans"
          action-title="Replace with another plan — `[*]→*` get from vessel"
          action-aria-label="Open Plans panel"
          :chrome-class="loadPanelOpen
            ? 'bg-slate-700 text-white'
            : 'bg-transparent text-slate-300 hover:text-white'"
          rounded-class="rounded"
          height-class="h-6"
          text-size-class="text-[11px]"
          glyph-size-class="h-3"
          @info="emit('open-save-glyph-history')"
          @action="loadPanelOpen = !loadPanelOpen; ownerPinOpen = false"
        />
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                 text-slate-300 hover:text-white hover:bg-slate-700
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
          title="Compare this model with others"
          @click="emit('compare')"
        >
          📊
        </button>
      </div>
    </div>

    <!-- Save status row -->
    <div class="flex items-center gap-2 px-4 py-1.5 text-[11px] text-slate-400">
      <span v-if="savedAtLabel">Saved {{ savedAtLabel }}</span>
      <span v-if="elapsedMinutes >= 2" class="text-amber-500 font-medium">
        · {{ elapsedMinutes }} min of activity not yet saved
      </span>
      <!-- 2026-05-14: split-button — glyph half opens "About the Save Glyph"
           essay; action half triggers the actual Save now. -->
      <SaveGetActionButton
        v-if="elapsedMinutes >= 2"
        kind="save"
        label="Save now"
        action-title="Save current spec state now — `*→[*]` place into vessel"
        action-aria-label="Save now"
        chrome-class="ml-auto bg-amber-500 text-white"
        rounded-class="rounded"
        height-class="h-6"
        text-size-class="text-[11px]"
        glyph-size-class="h-3"
        hint-bg-class="bg-amber-700"
        hint-text-class="text-white"
        @info="emit('open-save-glyph-history')"
        @action="emit('save')"
      />
    </div>

    <!-- Owner pin card — read-only contact view -->
    <div
      v-if="ownerPinOpen"
      class="mt-1 rounded-xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2.5 bg-amber-100 border-b border-amber-200">
        <div class="flex items-center gap-2">
          <span class="text-sm" aria-hidden="true">📌</span>
          <span class="text-xs font-bold text-amber-800 uppercase tracking-wide">Owner Data</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="text-[11px] font-semibold text-amber-600 hover:text-amber-900 underline
                   focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
            title="Open Plan Responsibilities to edit"
            @click="ownerPinOpen = false; emit('open-people', 'owners')"
          >
            Edit
          </button>
          <CloseDot
        title="Close this window"
        aria-label="Close Owner Data"
        @click="ownerPinOpen = false"
      />
        </div>
      </div>

      <!-- Fields — shows all owners (first owner in full, rest as compact rows) -->
      <div class="px-4 py-3 space-y-2">
        <template v-if="currentModel.owners?.length">
          <div v-for="(o, i) in currentModel.owners" :key="o.id" :class="i > 0 ? 'border-t border-gray-100 pt-2' : ''">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span class="text-sm font-semibold text-slate-800">{{ o.name }}</span>
              <span v-if="o.responsibility" class="text-[11px] text-amber-700 font-medium">{{ o.responsibility }}</span>
            </div>
            <div v-if="o.organization" class="flex items-baseline gap-2 mt-0.5">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-[4.5rem] flex-shrink-0">Org</span>
              <span class="text-xs text-slate-700">{{ o.organization }}</span>
            </div>
            <div v-if="o.email" class="flex items-baseline gap-2">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-[4.5rem] flex-shrink-0">Email</span>
              <a :href="`mailto:${o.email}`" class="text-xs text-blue-600 hover:underline break-all">{{ o.email }}</a>
            </div>
            <div v-if="o.phone" class="flex items-baseline gap-2">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-[4.5rem] flex-shrink-0">Phone</span>
              <a :href="`tel:${o.phone}`" class="text-xs text-blue-600 hover:underline">{{ o.phone }}</a>
            </div>
          </div>
        </template>

        <!-- Empty state -->
        <p v-else class="text-xs text-slate-400 italic">
          No owner details yet —
          <button
            type="button"
            class="text-blue-500 hover:underline focus:outline-none"
            @click="ownerPinOpen = false; emit('open-people', 'owners')"
          >add them now</button>.
        </p>
      </div>
    </div>

    <!-- Legacy inline owner editor REMOVED 2026-05-12. All owner / planner /
         scribe editing now lives in the single canonical `PlanOwnerPanel`
         (3-tab Plan Responsibilities). The 📌 pin above remains as a
         read-only contact-card quick-view of the first owner. -->

    <!-- Load panel (collapsible) -->
    <div
      v-if="loadPanelOpen"
      class="mt-1 rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden"
    >
      <!-- Header with explicit close button -->
      <div class="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-200">
        <div class="flex items-center gap-2 text-slate-700">
          <GetGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
          <span class="text-xs font-bold text-slate-600 uppercase tracking-wide">Plans</span>
        </div>
        <CloseDot
        title="Close this window"
        aria-label="Close Plans panel"
        @click="loadPanelOpen = false"
      />
      </div>

      <div class="px-4 py-4 space-y-5">
      <!-- ── Import from file ── -->
      <div>
        <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Import from file</p>
        <label
          class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-300
                 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-600"
        >
          <GetGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" />
          <span>Choose a Plan Model .json file</span>
          <input
            type="file"
            accept=".json,application/json"
            class="sr-only"
            @change="handleFileImport"
          />
        </label>
        <p v-if="fileError" class="mt-1.5 text-xs text-red-600" role="alert">{{ fileError }}</p>
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3">
        <div class="flex-1 border-t border-slate-200" />
        <span class="text-[11px] text-slate-400 font-medium">Or select from this list of previous plans, below</span>
        <div class="flex-1 border-t border-slate-200" />
      </div>

      <!-- ── Saved model picker ── -->
      <div class="space-y-2">
        <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Saved Models</p>

        <!-- No models saved yet -->
        <p
          v-if="allModels.length === 0"
          class="text-xs text-slate-400 text-center py-4"
        >No saved models yet</p>

        <template v-else>
          <!-- Search / filter input -->
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"
                  aria-hidden="true">🔍</span>
            <input
              v-model="modelSearch"
              type="search"
              class="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="Search by name, version…"
              aria-label="Search saved models"
            />
          </div>

          <!-- Filtered list -->
          <ScrollContainer
            outer-class="rounded-lg border border-slate-200 relative"
            inner-class="divide-y divide-slate-100"
            inner-style="max-height: 220px"
            :no-pill="true"
            role="listbox"
            aria-label="Saved models"
          >
            <!-- No results -->
            <p
              v-if="filteredModels.length === 0"
              class="px-3 py-4 text-xs text-slate-400 text-center"
            >No models match "{{ modelSearch }}"</p>

            <!-- Model rows -->
            <button
              v-for="model in filteredModels"
              :key="model.id"
              type="button"
              role="option"
              :aria-selected="currentModel?.id === model.id"
              class="w-full text-left flex items-center gap-3 px-3 py-2.5
                     hover:bg-blue-50 focus:outline-none focus:bg-blue-50
                     transition-colors"
              :class="currentModel?.id === model.id ? 'bg-blue-50' : ''"
              @click="selectModel(model)"
            >
              <!-- Active indicator dot -->
              <span
                class="flex-shrink-0 h-2 w-2 rounded-full"
                :class="currentModel?.id === model.id ? 'bg-blue-500' : 'bg-slate-200'"
                aria-hidden="true"
              />

              <!-- Name + meta -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-sm font-medium text-slate-800 truncate">{{ model.name }}</span>
                  <span class="flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded
                               bg-slate-700 text-white">v{{ model.version }}</span>
                  <span v-if="currentModel?.id === model.id"
                        class="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded
                               bg-blue-500 text-white">active</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  {{ new Date(model.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                  <template v-if="model.sharpenRounds > 0"> · 🔪 {{ model.sharpenRounds }}</template>
                </p>
              </div>

              <!-- Load chevron -->
              <span class="flex-shrink-0 text-slate-400 text-sm" aria-hidden="true">›</span>
            </button>
          </ScrollContainer>
        </template>
      </div>
      </div><!-- /inner padded area -->
    </div>
  </div>
</template>
