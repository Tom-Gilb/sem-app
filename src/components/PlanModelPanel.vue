<!-- UNIT_TYPE=Widget -->
<!--
/**
 * PlanModelPanel — slide-in drawer listing all saved Planning Models.
 *
 * Features:
 *   • Browse all saved models newest-first
 *   • Inline rename (any model, not just the active one)
 *   • Load (restore spec + activate model)
 *   • Delete with 3-second tap-to-confirm guard
 *   • Import from .json file
 *   • Active model is visually highlighted
 *
 * Emits:
 *   close          — user dismissed the panel
 *   load(model)    — user chose a model to restore
 */
-->
<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import {
  usePlanModel,
  renamePlanModel,
  deletePlanModel,
  importPlanModel,
  exportPlanModel,
  exportAllPlanModelsBackup,
  importPlanModelsBackup,
  type PlanModel,
} from '../composables/usePlanModel'

const emit = defineEmits<{
  close: []
  load: [model: PlanModel]
}>()

const { currentModel, allModels } = usePlanModel()

// ── Inline rename ─────────────────────────────────────────────────────────────

const editingId   = ref<string | null>(null)
const editingName = ref('')

function startRename(model: PlanModel): void {
  editingId.value   = model.id
  editingName.value = model.name
}

function commitRename(id: string): void {
  const v = editingName.value.trim()
  if (v) renamePlanModel(id, v)
  editingId.value = null
}

function cancelRename(): void {
  editingId.value = null
}

// ── Delete with 3-second confirm guard ───────────────────────────────────────

const pendingDeleteId = ref<string | null>(null)
let _deleteTimer: ReturnType<typeof setTimeout> | null = null

function requestDelete(id: string): void {
  if (pendingDeleteId.value === id) {
    if (_deleteTimer !== null) { clearTimeout(_deleteTimer); _deleteTimer = null }
    deletePlanModel(id)
    pendingDeleteId.value = null
  } else {
    if (_deleteTimer !== null) clearTimeout(_deleteTimer)
    pendingDeleteId.value = id
    _deleteTimer = setTimeout(() => {
      pendingDeleteId.value = null
      _deleteTimer = null
    }, 3000)
  }
}

onUnmounted(() => {
  if (_deleteTimer !== null) clearTimeout(_deleteTimer)
})

// ── Import from .json ────────────────────────────────────────────────────────

const fileError = ref('')

function handleFileImport(event: Event): void {
  fileError.value = ''
  const input = event.target as HTMLInputElement
  const file  = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data  = JSON.parse(e.target?.result as string)
      const model = importPlanModel(data)
      if (!model) { fileError.value = 'Not a valid Plan Model .json.'; return }
      // Imported — now shown in the list. User can Load it explicitly.
    } catch {
      fileError.value = 'Could not parse the file.'
    }
  }
  reader.readAsText(file)
  input.value = ''
}

// ── Security Backup ───────────────────────────────────────────────────────────

const backupRestoreMessage = ref('')
const backupRestoreError   = ref('')

function handleBackupRestore(event: Event): void {
  backupRestoreMessage.value = ''
  backupRestoreError.value   = ''
  const input = event.target as HTMLInputElement
  const file  = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data  = JSON.parse(e.target?.result as string)
      const count = importPlanModelsBackup(data)
      if (count === 0) {
        backupRestoreError.value = 'No new models found in this backup (all may already exist).'
      } else {
        backupRestoreMessage.value = `✓ ${count} model${count !== 1 ? 's' : ''} restored.`
      }
    } catch {
      backupRestoreError.value = 'Could not read the backup file.'
    }
  }
  reader.readAsText(file)
  input.value = ''
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[480] bg-black/30"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Drawer -->
    <div
      class="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-[490] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Planning Models"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 border-b border-gray-100 min-h-[56px] flex-shrink-0">
        <div>
          <h2 class="text-sm font-semibold text-gray-900">Planning Models</h2>
          <p class="text-[11px] text-gray-400">{{ allModels.length }} saved</p>
        </div>
        <button
          type="button"
          class="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400
                 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          aria-label="Close planning models panel"
          @click="emit('close')"
        >×</button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto">

        <!-- Empty state -->
        <div
          v-if="allModels.length === 0"
          class="flex flex-col items-center justify-center h-full gap-3 px-6 text-center"
        >
          <span class="text-3xl" aria-hidden="true">📋</span>
          <p class="text-sm font-medium text-gray-600">No saved models yet</p>
          <p class="text-xs text-gray-400">Generate a spec and it will appear here as a named Planning Model.</p>
        </div>

        <!-- Models list -->
        <ul v-else class="divide-y divide-gray-100 list-none m-0 p-0">
          <li
            v-for="model in allModels"
            :key="model.id"
            :class="[
              'px-4 py-3 space-y-1.5 transition-colors',
              currentModel?.id === model.id
                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                : 'hover:bg-gray-50 border-l-4 border-l-transparent'
            ]"
          >
            <!-- Name row -->
            <div class="flex items-center gap-2 min-w-0">
              <!-- Inline rename input -->
              <template v-if="editingId === model.id">
                <input
                  v-model="editingName"
                  class="flex-1 min-w-0 text-sm font-semibold rounded border border-blue-300 px-2 py-0.5
                         focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  autofocus
                  @keydown.enter="commitRename(model.id)"
                  @keydown.escape="cancelRename"
                  @blur="commitRename(model.id)"
                />
              </template>
              <template v-else>
                <span class="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">
                  {{ model.name }}
                </span>
              </template>

              <!-- Version badge -->
              <span class="flex-shrink-0 px-1.5 py-0.5 rounded bg-slate-700 text-white text-[10px] font-mono font-bold">
                v{{ model.version }}
              </span>

              <!-- Active badge -->
              <span
                v-if="currentModel?.id === model.id"
                class="flex-shrink-0 px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px] font-bold"
              >active</span>
            </div>

            <!-- Meta row -->
            <div class="flex items-center gap-2 text-[11px] text-gray-400">
              <span>{{ formatDate(model.updatedAt) }}</span>
              <span v-if="model.sharpenRounds > 0" class="flex items-center gap-0.5">
                <span aria-hidden="true">🔪</span>
                {{ model.sharpenRounds }} round{{ model.sharpenRounds !== 1 ? 's' : '' }}
              </span>
              <span class="font-mono">#{{ model.tag }}</span>
            </div>

            <!-- Actions row -->
            <div class="flex items-center gap-1.5 pt-0.5">
              <!-- Load -->
              <button
                type="button"
                class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-md
                       bg-indigo-600 text-white text-xs font-semibold
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                @click="emit('load', model)"
              >
                📂 Load
              </button>

              <!-- Export -->
              <button
                v-if="currentModel?.id === model.id"
                type="button"
                class="flex items-center justify-center min-h-[36px] px-2.5 rounded-md border border-gray-200 bg-white
                       text-gray-500 text-xs hover:bg-gray-50
                       focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                title="Export as .json"
                @click="exportPlanModel"
              >
                💾
              </button>

              <!-- Rename -->
              <button
                type="button"
                class="flex items-center justify-center min-h-[36px] px-2.5 rounded-md border border-gray-200 bg-white
                       text-gray-500 text-xs hover:bg-gray-50
                       focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                :class="editingId === model.id ? 'ring-2 ring-blue-400 border-blue-300' : ''"
                title="Rename"
                @click="editingId === model.id ? cancelRename() : startRename(model)"
              >
                ✏️
              </button>

              <!-- Delete -->
              <button
                type="button"
                :class="[
                  'flex items-center justify-center min-h-[36px] px-2.5 rounded-md border text-xs transition-all',
                  pendingDeleteId === model.id
                    ? 'bg-red-600 border-red-700 text-white animate-pulse'
                    : 'border-gray-200 bg-white text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
                ]"
                :title="pendingDeleteId === model.id ? 'Tap again to confirm delete' : 'Delete'"
                :aria-label="pendingDeleteId === model.id ? 'Confirm delete' : 'Delete model'"
                @click="requestDelete(model.id)"
              >
                {{ pendingDeleteId === model.id ? '⚠︎?' : '×' }}
              </button>
            </div>
          </li>
        </ul>

        <!-- Import single model section -->
        <div class="px-4 py-4 border-t border-gray-100">
          <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Import from file</p>
          <label
            class="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-gray-200
                   cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs text-gray-500"
          >
            <span aria-hidden="true">📁</span>
            <span>Choose a Plan Model .json</span>
            <input
              type="file"
              accept=".json,application/json"
              class="sr-only"
              @change="handleFileImport"
            />
          </label>
          <p v-if="fileError" class="mt-1.5 text-xs text-red-600" role="alert">{{ fileError }}</p>
        </div>

        <!-- Security Backup section -->
        <div class="px-4 py-4 border-t-2 border-indigo-100 bg-indigo-50/40">
          <div class="flex items-center gap-1.5 mb-1">
            <span aria-hidden="true" class="text-base">🛡️</span>
            <p class="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Security Backup</p>
          </div>
          <p class="text-[11px] text-indigo-500 mb-3 leading-relaxed">
            Exports <strong>all {{ allModels.length }} model{{ allModels.length !== 1 ? 's' : '' }}</strong>
            in one file. Store in iCloud Drive, your Obsidian vault, or email it to yourself.
            Independent of your account — safe from any login or data loss.
          </p>

          <!-- Export all -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 min-h-[40px] rounded-lg
                   bg-indigo-600 text-white text-xs font-semibold
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400
                   transition-colors mb-2"
            :disabled="allModels.length === 0"
            :class="allModels.length === 0 ? 'opacity-40 cursor-not-allowed' : ''"
            aria-label="Export full backup of all models"
            @click="exportAllPlanModelsBackup()"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            Export Full Backup (.json)
          </button>

          <!-- Restore from backup -->
          <label
            class="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-indigo-200
                   cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-xs text-indigo-600"
          >
            <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
            <span>Restore from backup file…</span>
            <input
              type="file"
              accept=".json,application/json"
              class="sr-only"
              @change="handleBackupRestore"
            />
          </label>
          <p v-if="backupRestoreMessage" class="mt-1.5 text-xs text-green-700 font-medium" role="status">
            {{ backupRestoreMessage }}
          </p>
          <p v-if="backupRestoreError" class="mt-1.5 text-xs text-red-600" role="alert">
            {{ backupRestoreError }}
          </p>
        </div>

      </div>
    </div>
  </Teleport>
</template>
