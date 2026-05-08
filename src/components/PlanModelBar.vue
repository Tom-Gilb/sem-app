<!-- PlanModelBar.vue — Plan Model identity strip
     Shows the current Plan Model name + version above the Evo Plan view.
     Supports inline name/version editing, export to .json, and loading a
     saved model by tag + version or by importing a .json file.

     Emits:
       load(PlanModel) — user recalled a model; parent should restore the spec. -->

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import {
  usePlanModel,
  exportPlanModel,
  setPlanName,
  setPlanVersion,
  loadPlanByTag,
  loadPlanByDate,
  importPlanModel,
  allPlanTags,
  planVersionsForTag,
  type PlanModel,
} from '../composables/usePlanModel'

const emit = defineEmits<{
  load: [model: PlanModel]
  compare: []
  save: []
}>()

const { currentModel } = usePlanModel()

// ── Inline name editing ───────────────────────────────────────────────────────

const editingName = ref(false)
const nameInput = ref('')

function startEditName(): void {
  nameInput.value = currentModel.value?.name ?? ''
  editingName.value = true
}

function commitName(): void {
  const v = nameInput.value.trim()
  if (v) setPlanName(v)
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
  if (v) setPlanVersion(v)
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

// ── Load panel ────────────────────────────────────────────────────────────────

const loadPanelOpen = ref(false)

// Recall by tag + version or date
const recallTag = ref('')
const recallVersion = ref('')
const recallDate = ref('')
const recallError = ref('')
const recallMode = ref<'version' | 'date'>('version')

const availableTags = computed(() => allPlanTags())
const versionsForTag = computed(() =>
  recallTag.value ? planVersionsForTag(recallTag.value) : [],
)

function handleRecall(): void {
  recallError.value = ''
  if (!recallTag.value.trim()) {
    recallError.value = 'Enter a plan tag to recall.'
    return
  }
  let found: PlanModel | null = null
  if (recallMode.value === 'version') {
    found = loadPlanByTag(recallTag.value.trim(), recallVersion.value.trim() || undefined)
  } else {
    if (!recallDate.value) {
      recallError.value = 'Select a date to recall by.'
      return
    }
    found = loadPlanByDate(recallTag.value.trim(), recallDate.value)
  }
  if (!found) {
    recallError.value = `No saved model found for tag "${recallTag.value}"${recallMode.value === 'version' && recallVersion.value ? ` v${recallVersion.value}` : ''}.`
    return
  }
  loadPanelOpen.value = false
  emit('load', found)
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
            v-model="nameInput"
            class="flex-1 min-w-0 bg-slate-700 text-white text-sm font-semibold rounded px-2 py-0.5
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
            autofocus
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

      <!-- Tag display -->
      <span class="flex-shrink-0 text-[10px] text-slate-400 font-mono hidden sm:block">
        #{{ currentModel.tag }}
      </span>

      <!-- Action buttons -->
      <div class="flex items-center gap-1 flex-shrink-0 ml-auto">
        <!-- Export -->
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                 text-slate-300 hover:text-white hover:bg-slate-700
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
          title="Export plan model as .json"
          @click="exportPlanModel"
        >
          💾 Export
        </button>
        <!-- Load -->
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                 text-slate-300 hover:text-white hover:bg-slate-700
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
          :class="loadPanelOpen ? 'bg-slate-700 text-white' : ''"
          title="Load a saved plan model"
          @click="loadPanelOpen = !loadPanelOpen"
        >
          📂 Load
        </button>
        <!-- Compare -->
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                 text-slate-300 hover:text-white hover:bg-slate-700
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
          title="Compare this model with others"
          @click="emit('compare')"
        >
          📊 Compare
        </button>
      </div>
    </div>

    <!-- Save status row -->
    <div class="flex items-center gap-2 px-4 py-1.5 text-[11px] text-slate-400">
      <span v-if="savedAtLabel">Saved {{ savedAtLabel }}</span>
      <span v-if="elapsedMinutes >= 2" class="text-amber-500 font-medium">
        · {{ elapsedMinutes }} min of activity not yet saved
      </span>
      <button
        v-if="elapsedMinutes >= 2"
        type="button"
        class="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-white text-[11px] font-semibold
               hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
        title="Save current spec state now"
        @click="emit('save')"
      >
        💾 Save now
      </button>
    </div>

    <!-- Load panel (collapsible) -->
    <div
      v-if="loadPanelOpen"
      class="mt-1 px-4 py-4 rounded-xl border border-slate-200 bg-white shadow-md space-y-5"
    >
      <!-- ── Import from file ── -->
      <div>
        <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Import from file</p>
        <label
          class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-300
                 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-600"
        >
          <span aria-hidden="true">📁</span>
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
        <span class="text-[11px] text-slate-400 font-medium">or recall by tag</span>
        <div class="flex-1 border-t border-slate-200" />
      </div>

      <!-- ── Recall by tag + version / date ── -->
      <div class="space-y-3">
        <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Recall saved model</p>

        <!-- Tag field -->
        <div>
          <label class="block text-xs text-slate-500 mb-1" for="recall-tag">Plan Tag</label>
          <input
            id="recall-tag"
            v-model="recallTag"
            list="plan-tags-list"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="e.g. sem-app-plan"
          />
          <datalist id="plan-tags-list">
            <option v-for="t in availableTags" :key="t" :value="t" />
          </datalist>
        </div>

        <!-- Mode toggle -->
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
            :class="recallMode === 'version'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="recallMode = 'version'"
          >
            By version
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
            :class="recallMode === 'date'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="recallMode = 'date'"
          >
            By date
          </button>
        </div>

        <!-- Version field -->
        <div v-if="recallMode === 'version'">
          <label class="block text-xs text-slate-500 mb-1" for="recall-version">
            Version <span class="text-slate-400">(leave blank for latest)</span>
          </label>
          <input
            id="recall-version"
            v-model="recallVersion"
            list="plan-versions-list"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="e.g. 0.3"
          />
          <datalist id="plan-versions-list">
            <option v-for="m in versionsForTag" :key="m.version" :value="m.version" />
          </datalist>
        </div>

        <!-- Date field -->
        <div v-else>
          <label class="block text-xs text-slate-500 mb-1" for="recall-date">Date saved</label>
          <input
            id="recall-date"
            v-model="recallDate"
            type="date"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        <p v-if="recallError" class="text-xs text-red-600" role="alert">{{ recallError }}</p>

        <button
          type="button"
          class="w-full flex items-center justify-center min-h-[44px] rounded-lg
                 bg-blue-600 text-white text-sm font-semibold
                 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
                 transition-colors"
          @click="handleRecall"
        >
          Load Plan Model
        </button>
      </div>
    </div>
  </div>
</template>
