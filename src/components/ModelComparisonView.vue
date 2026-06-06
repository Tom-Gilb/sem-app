<!-- ModelComparisonView.vue — Full-screen modal for comparing 2+ Plan Models
     Two modes:
       Differences — 8 icon-button criteria: Types | Text | Value Levels | Impact |
                     Sequences | Financials | Duration | Effort
       VDT         — Planguage Value Decision Table: candidate models as columns,
                     a Criteria Model's V entries as rows; manual or AI-scored cells.

     Props: initialModel — pre-load the current plan model on open
     Emits: close -->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13).
import GetGlyph from './icons/GetGlyph.vue'
import {
  useModelComparison,
  addComparisonSlot,
  removeComparisonSlot,
  setComparisonMode,
  selectDiffCriterion,
  setCriteriaModelForVDT,
  updateVDTCell,
  runAutoScore,
  clearComparison,
  createEmptyVDT,
  type DiffCriterion,
  type TextDiffRow,
} from '../composables/useModelComparison'
import {
  importPlanModel,
  loadPlanByTag,
  allPlanTags,
  specVersionsForTag,
} from '../composables/useSpecModel'
import type { SpecModel } from '../composables/useSpecModel'

const props = defineProps<{
  initialModel?: SpecModel
}>()

const emit = defineEmits<{ close: [] }>()

const {
  slots, mode, activeCriteria, criteriaModel, vdtResult, vdtLoading, vdtError,
  DIFF_CRITERIA,
  computeTypesDiff, computeTextDiff, computeValuesDiff, computeImpactDiff,
  computeSequencesDiff, computeFinancialsDiff, computeDurationDiff, computeEffortDiff,
  selectDiffCriterion,
} = useModelComparison()

// Pre-load the current model on open
onMounted(() => {
  if (props.initialModel && !slots.value.some(s => s.planModel.id === props.initialModel!.id)) {
    addComparisonSlot(props.initialModel)
  }
})

// ── Add model panel ───────────────────────────────────────────────────────────

const addPanelOpen   = ref(false)
const addInputMode   = ref<'recall' | 'file'>('recall')
const addTag         = ref('')
const addVer         = ref('')
const addError       = ref('')
const availableTags  = computed(() => allPlanTags())
const addVerOptions  = computed(() => addTag.value ? specVersionsForTag(addTag.value) : [])

function handleAddRecall(): void {
  addError.value = ''
  if (!addTag.value.trim()) { addError.value = 'Enter a plan tag.'; return }
  const found = loadPlanByTag(addTag.value.trim(), addVer.value.trim() || undefined)
  if (!found) { addError.value = `No saved model for tag "${addTag.value}"${addVer.value ? ` v${addVer.value}` : ''}.`; return }
  addComparisonSlot(found)
  addTag.value = ''
  addVer.value = ''
  addPanelOpen.value = false
}

function handleAddFile(event: Event): void {
  addError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const model = importPlanModel(JSON.parse(e.target?.result as string))
      if (!model) { addError.value = 'Not a valid Plan Model .json.'; return }
      addComparisonSlot(model)
      addPanelOpen.value = false
    } catch { addError.value = 'Could not parse file.' }
  }
  reader.readAsText(file)
  input.value = ''
}

// ── VDT cell editing ──────────────────────────────────────────────────────────

interface CellEdit { rowIndex: number; modelIndex: number; score: string; rationale: string }
const editingCell = ref<CellEdit | null>(null)

function startEditCell(ri: number, mi: number): void {
  const row = vdtResult.value?.rows[ri]
  if (!row) return
  const cell = row.scores[mi]
  editingCell.value = { rowIndex: ri, modelIndex: mi, score: String(cell.score), rationale: cell.rationale }
}

function commitCell(): void {
  if (!editingCell.value) return
  const s = parseInt(editingCell.value.score, 10)
  if (!isNaN(s)) updateVDTCell(editingCell.value.rowIndex, editingCell.value.modelIndex, s, editingCell.value.rationale)
  editingCell.value = null
}

// ── Computed diff results ─────────────────────────────────────────────────────

const canCompare   = computed(() => slots.value.length >= 2)
const typesDiff    = computed(() => canCompare.value && activeCriteria.value.includes('types')      ? computeTypesDiff(slots.value) : [])
const textDiff     = computed(() => canCompare.value && activeCriteria.value.includes('text')       ? computeTextDiff(slots.value) : [])
const valuesDiff   = computed(() => canCompare.value && activeCriteria.value.includes('values')     ? computeValuesDiff(slots.value) : [])
const impactDiff   = computed(() => canCompare.value && activeCriteria.value.includes('impact')     ? computeImpactDiff(slots.value) : [])
const sequenceDiff = computed(() => canCompare.value && activeCriteria.value.includes('sequences')  ? computeSequencesDiff(slots.value) : [])
const finDiff      = computed(() => canCompare.value && activeCriteria.value.includes('financials') ? computeFinancialsDiff(slots.value) : [])
const durDiff      = computed(() => canCompare.value && activeCriteria.value.includes('duration')   ? computeDurationDiff(slots.value) : [])
const effDiff      = computed(() => canCompare.value && activeCriteria.value.includes('effort')     ? computeEffortDiff(slots.value) : [])

const candidateSlots = computed(() =>
  criteriaModel.value
    ? slots.value.filter(s => s.planModel.id !== criteriaModel.value!.id)
    : slots.value
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 7) return 'bg-green-100 text-green-800 font-bold'
  if (n >= 4) return 'bg-yellow-100 text-yellow-800 font-medium'
  if (n > 0)  return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-400'
}

function entryBadgeColor(t: 'F' | 'V' | 'S'): string {
  if (t === 'F') return 'bg-blue-100 text-blue-700'
  if (t === 'V') return 'bg-purple-100 text-purple-700'
  return 'bg-emerald-100 text-emerald-700'
}

function handleSetCriteria(m: PlanModel): void {
  setCriteriaModelForVDT(m)
}

function handleAutoScore(): void {
  void runAutoScore()
}

function handleClose(): void {
  // Keep comparison state so it survives modal re-opens
  emit('close')
}

/** Count rows that actually differ, for summary badges */
function diffCount(rows: { hasDiff: boolean }[]): number {
  return rows.filter(r => r.hasDiff).length
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[600] bg-white flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Model Comparison">

      <!-- ── Sticky header ──────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between px-4 py-3 border-b bg-white flex-shrink-0 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="text-2xl" aria-hidden="true">📊</span>
          <h2 class="text-base font-bold text-slate-800">Model Comparison</h2>
          <span v-if="slots.length > 0"
            class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
            {{ slots.length }} model{{ slots.length !== 1 ? 's' : '' }}
          </span>
        </div>
        <CloseDot
        title="Close"
        aria-label="Close comparison"
        @click="handleClose"
      />
      </div>

      <!-- ── Scrollable body ───────────────────────────────────────────────── -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">

        <!-- ── Models section ─────────────────────────────────────────────── -->
        <div class="px-4 py-3 border-b bg-slate-50">
          <div class="flex items-center flex-wrap gap-2 mb-2">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Models</span>

            <!-- Model chips -->
            <div
              v-for="slot in slots"
              :key="slot.planModel.id"
              :title="slot.label"
              class="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border max-w-[18rem]"
              :class="criteriaModel?.id === slot.planModel.id
                ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                : 'bg-white border-slate-200 text-slate-700'"
            >
              <span v-if="criteriaModel?.id === slot.planModel.id" class="flex-shrink-0 text-[10px] text-indigo-600 font-bold uppercase tracking-wide">Criteria</span>
              <span class="truncate">{{ slot.label }}</span>
              <button
                type="button"
                class="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 text-[10px]"
                :aria-label="`Remove ${slot.label}`"
                @click="removeComparisonSlot(slot.planModel.id)"
              >×</button>
            </div>

            <!-- Add model -->
            <button
              type="button"
              class="flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-blue-300
                     text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
              @click="addPanelOpen = !addPanelOpen"
            >
              <span aria-hidden="true">+</span> Add Model
            </button>
          </div>

          <!-- Add model panel -->
          <div v-if="addPanelOpen" class="mt-2 p-3 rounded-xl border border-slate-200 bg-white space-y-3">
            <!-- Mode tabs -->
            <div class="flex gap-1">
              <button
                v-for="tab in ([{ id: 'recall', label: 'From storage', emoji: '🗂️' }, { id: 'file', label: 'Import file', emoji: '' }] as const)"
                :key="tab.id"
                type="button"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-400 inline-flex items-center justify-center gap-1.5"
                :class="addInputMode === tab.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                @click="addInputMode = tab.id"
              >
                <!-- DD-001 — Import is a Get action, rendered as `[*]→*` SVG.
                     The "From storage" tab keeps its 🗂️ emoji (filesystem state, not action). -->
                <GetGlyph v-if="tab.id === 'file'" size="compact" class="h-3 w-auto" aria-hidden="true" />
                <span v-else aria-hidden="true">{{ tab.emoji }}</span>
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <!-- Recall from storage -->
            <div v-if="addInputMode === 'recall'" class="flex gap-2">
              <input
                v-model="addTag"
                list="cmp-tags-list"
                class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Tag (e.g. sem-app-plan)"
              />
              <datalist id="cmp-tags-list">
                <option v-for="t in availableTags" :key="t" :value="t" />
              </datalist>
              <input
                v-model="addVer"
                list="cmp-vers-list"
                class="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="v0.3"
              />
              <datalist id="cmp-vers-list">
                <option v-for="m in addVerOptions" :key="m.version" :value="m.version" />
              </datalist>
              <button
                type="button"
                class="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                @click="handleAddRecall"
              >Add</button>
            </div>

            <!-- Import file -->
            <div v-else>
              <label class="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-300
                            cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-slate-600">
                <GetGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" />
                <span>Choose Spec Model .json</span>
                <input type="file" accept=".json,application/json" class="sr-only" @change="handleAddFile" />
              </label>
            </div>

            <p v-if="addError" class="text-xs text-red-600" role="alert">{{ addError }}</p>
          </div>

          <!-- VDT: criteria model hint -->
          <div v-if="mode === 'vdt' && slots.length >= 2 && !criteriaModel" class="mt-2 text-[11px] text-indigo-600 font-medium">
            💡 In VDT mode, click <strong>Set Criteria</strong> on one of the models to use its Value entries as evaluation rows.
          </div>
          <!-- Set Criteria buttons (VDT mode only) -->
          <div v-if="mode === 'vdt' && slots.length >= 2" class="mt-2 flex flex-wrap gap-1.5">
            <button
              v-for="slot in slots"
              :key="slot.planModel.id + '-criteria'"
              type="button"
              class="px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors
                     focus:outline-none focus:ring-2 focus:ring-indigo-400"
              :class="criteriaModel?.id === slot.planModel.id
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'"
              @click="handleSetCriteria(slot.planModel)"
            >
              {{ criteriaModel?.id === slot.planModel.id ? '✓ Criteria: ' : 'Set Criteria: ' }}{{ slot.label }}
            </button>
          </div>
        </div>

        <!-- ── Mode selector ──────────────────────────────────────────────── -->
        <div class="flex gap-2 px-4 py-3 border-b bg-white">
          <button
            v-for="m in ([{ id: 'differences', icon: '📊', label: 'Differences' }, { id: 'vdt', icon: '🏆', label: 'VDT' }] as const)"
            :key="m.id"
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-400"
            :class="mode === m.id
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'"
            @click="setComparisonMode(m.id)"
          >
            <span aria-hidden="true">{{ m.icon }}</span>{{ m.label }}
          </button>
        </div>

        <!-- ── Differences criteria selector ─────────────────────────────── -->
        <div v-if="mode === 'differences'" class="px-4 py-3 border-b bg-slate-50">
          <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Compare by:
          </p>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Comparison criterion">
            <button
              v-for="c in DIFF_CRITERIA"
              :key="c.key"
              type="button"
              role="radio"
              :aria-checked="activeCriteria[0] === c.key"
              :title="c.description"
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
              :class="activeCriteria[0] === c.key
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'"
              @click="selectDiffCriterion(c.key)"
            >
              <span aria-hidden="true">{{ c.icon }}</span>
              {{ c.label }}
            </button>
          </div>
        </div>

        <!-- ── Need 2+ models prompt ──────────────────────────────────────── -->
        <div v-if="!canCompare" class="px-4 py-12 text-center text-slate-400">
          <p class="text-4xl mb-3" aria-hidden="true">📐</p>
          <p class="text-sm font-medium">Add at least 2 models to start comparing.</p>
          <p class="text-xs mt-1">Use the <strong>+ Add Model</strong> button above.</p>
        </div>

        <!-- ── Differences results ────────────────────────────────────────── -->
        <template v-else-if="mode === 'differences'">

          <!-- Types -->
          <section v-if="activeCriteria.includes('types')" class="px-4 py-5 border-b">
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
              <span aria-hidden="true">📐</span> Types
              <span class="text-[11px] font-normal text-slate-400">Function / Value / Solution entry counts</span>
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-left">
                    <th class="px-3 py-2 text-xs font-semibold text-slate-600 w-36">Entry type</th>
                    <th v-for="slot in slots" :key="slot.planModel.id"
                      class="px-3 py-2 text-xs font-semibold text-slate-600">
                      {{ slot.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in typesDiff" :key="row.type"
                    :class="row.hasDiff ? 'bg-amber-50' : ''">
                    <td class="px-3 py-2 font-medium text-slate-700 border-t border-slate-100">{{ row.type }}</td>
                    <td v-for="(count, i) in row.counts" :key="i"
                      class="px-3 py-2 border-t border-slate-100 font-mono"
                      :class="row.hasDiff ? 'text-amber-800' : 'text-slate-600'">
                      {{ count }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Text -->
          <section v-if="activeCriteria.includes('text')" class="px-4 py-5 border-b">
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1">
              <span aria-hidden="true">📝</span> Text
              <span v-if="diffCount(textDiff) > 0"
                class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {{ diffCount(textDiff) }} differ
              </span>
            </h3>
            <p class="text-[11px] text-slate-400 mb-3">Description differences — highlighted rows have changes</p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-left">
                    <th class="px-3 py-2 font-semibold text-slate-600 w-28 sticky left-0 bg-slate-100">ID</th>
                    <th class="px-2 py-2 font-semibold text-slate-600 w-8">T</th>
                    <th v-for="slot in slots" :key="slot.planModel.id" class="px-3 py-2 font-semibold text-slate-600">
                      {{ slot.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in textDiff" :key="row.id"
                    :class="row.hasDiff ? 'bg-amber-50' : ''">
                    <td class="px-3 py-2 font-mono text-slate-500 border-t border-slate-100 sticky left-0"
                      :class="row.hasDiff ? 'bg-amber-50' : 'bg-white'">{{ row.id }}</td>
                    <td class="px-2 py-2 border-t border-slate-100">
                      <span class="px-1 py-0.5 rounded text-[10px] font-bold" :class="entryBadgeColor(row.entryType)">{{ row.entryType }}</span>
                    </td>
                    <td v-for="(val, i) in row.values" :key="i"
                      class="px-3 py-2 border-t border-slate-100 text-slate-700 max-w-xs truncate"
                      :title="val">
                      <span v-if="val" :class="row.hasDiff ? 'text-amber-900' : ''">{{ val }}</span>
                      <span v-else class="text-slate-300 italic">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Value Levels -->
          <section v-if="activeCriteria.includes('values') && valuesDiff.length > 0" class="px-4 py-5 border-b">
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1">
              <span aria-hidden="true">⬆️</span> Value Levels
              <span class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {{ valuesDiff.length }} field{{ valuesDiff.length !== 1 ? 's' : '' }} differ
              </span>
            </h3>
            <p class="text-[11px] text-slate-400 mb-3">Only differing fields shown (scale / meter / goal / tolerable)</p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-left">
                    <th class="px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-100">Field</th>
                    <th v-for="slot in slots" :key="slot.planModel.id" class="px-3 py-2 font-semibold text-slate-600">
                      {{ slot.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in valuesDiff" :key="row.id" class="bg-amber-50">
                    <td class="px-3 py-2 font-mono text-xs text-slate-600 border-t border-amber-100 sticky left-0 bg-amber-50">{{ row.field }}</td>
                    <td v-for="(val, i) in row.values" :key="i"
                      class="px-3 py-2 border-t border-amber-100 text-amber-900">
                      <span v-if="val">{{ val }}</span>
                      <span v-else class="text-slate-300 italic">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <div v-else-if="activeCriteria.includes('values') && valuesDiff.length === 0" class="px-4 py-3 text-xs text-slate-400 italic border-b">
            ⬆️ Value Levels — no differences found between these models.
          </div>

          <!-- Impact -->
          <section v-if="activeCriteria.includes('impact')" class="px-4 py-5 border-b">
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
              <span aria-hidden="true">💥</span> Impact
              <span v-if="diffCount(impactDiff) > 0"
                class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {{ diffCount(impactDiff) }} differ
              </span>
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-left">
                    <th class="px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-100">Solution ID</th>
                    <th v-for="slot in slots" :key="slot.planModel.id" class="px-3 py-2 font-semibold text-slate-600">{{ slot.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in impactDiff" :key="row.id" :class="row.hasDiff ? 'bg-amber-50' : ''">
                    <td class="px-3 py-2 font-mono text-slate-500 border-t border-slate-100 sticky left-0"
                      :class="row.hasDiff ? 'bg-amber-50' : 'bg-white'">{{ row.id }}</td>
                    <td v-for="(val, i) in row.values" :key="i"
                      class="px-3 py-2 border-t border-slate-100 max-w-xs" :title="val"
                      :class="row.hasDiff ? 'text-amber-900' : 'text-slate-600'">
                      <span v-if="val">{{ val }}</span>
                      <span v-else class="text-slate-300 italic">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Sequences -->
          <section v-if="activeCriteria.includes('sequences')" class="px-4 py-5 border-b">
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
              <span aria-hidden="true">🔢</span> Sequences
              <span v-if="diffCount(sequenceDiff) > 0"
                class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {{ diffCount(sequenceDiff) }} positions differ
              </span>
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-left">
                    <th class="px-3 py-2 font-semibold text-slate-600 w-12">#</th>
                    <th v-for="slot in slots" :key="slot.planModel.id" class="px-3 py-2 font-semibold text-slate-600">{{ slot.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in sequenceDiff" :key="row.position" :class="row.hasDiff ? 'bg-amber-50' : ''">
                    <td class="px-3 py-2 font-mono text-slate-400 border-t border-slate-100">{{ row.position }}</td>
                    <td v-for="(id, i) in row.entryIds" :key="i"
                      class="px-3 py-2 border-t border-slate-100 font-mono"
                      :class="row.hasDiff ? 'text-amber-800 font-semibold' : 'text-slate-600'">
                      {{ id ?? '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Financials / Duration / Effort (shared layout) -->
          <template v-for="fc in ([
            { key: 'financials', icon: '💰', label: 'Financials', rows: finDiff },
            { key: 'duration',   icon: '⏱️', label: 'Duration',   rows: durDiff },
            { key: 'effort',     icon: '💪', label: 'Effort',     rows: effDiff },
          ])" :key="fc.key">
            <section v-if="activeCriteria.includes(fc.key as DiffCriterion)" class="px-4 py-5 border-b">
              <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1">
                <span aria-hidden="true">{{ fc.icon }}</span> {{ fc.label }}
                <span v-if="fc.rows.length === 0" class="text-[11px] font-normal text-slate-400">no matching entries</span>
                <span v-else-if="diffCount(fc.rows) > 0"
                  class="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  {{ diffCount(fc.rows) }} differ
                </span>
              </h3>
              <div v-if="fc.rows.length > 0" class="overflow-x-auto mt-2">
                <table class="w-full text-xs border-collapse">
                  <thead>
                    <tr class="bg-slate-100 text-left">
                      <th class="px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-slate-100">ID</th>
                      <th class="px-2 py-2 font-semibold text-slate-600 w-8">T</th>
                      <th v-for="slot in slots" :key="slot.planModel.id" class="px-3 py-2 font-semibold text-slate-600">{{ slot.label }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in (fc.rows as TextDiffRow[])" :key="row.id" :class="row.hasDiff ? 'bg-amber-50' : ''">
                      <td class="px-3 py-2 font-mono text-slate-500 border-t border-slate-100 sticky left-0"
                        :class="row.hasDiff ? 'bg-amber-50' : 'bg-white'">{{ row.id }}</td>
                      <td class="px-2 py-2 border-t border-slate-100">
                        <span class="px-1 py-0.5 rounded text-[10px] font-bold" :class="entryBadgeColor(row.entryType)">{{ row.entryType }}</span>
                      </td>
                      <td v-for="(val, i) in row.values" :key="i"
                        class="px-3 py-2 border-t border-slate-100 max-w-xs" :title="val"
                        :class="row.hasDiff ? 'text-amber-900' : 'text-slate-600'">
                        <span v-if="val">{{ val }}</span>
                        <span v-else class="text-slate-300 italic">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>

        </template>

        <!-- ── VDT results ─────────────────────────────────────────────────── -->
        <template v-else-if="mode === 'vdt'">

          <!-- No criteria model selected -->
          <div v-if="!criteriaModel" class="px-4 py-10 text-center text-slate-400">
            <p class="text-3xl mb-2" aria-hidden="true">🏆</p>
            <p class="text-sm font-medium">Set a Criteria Model to start the VDT.</p>
            <p class="text-xs mt-1">Click <strong>Set Criteria</strong> on one of the loaded models above.</p>
          </div>

          <!-- No candidates -->
          <div v-else-if="candidateSlots.length === 0" class="px-4 py-10 text-center text-slate-400">
            <p class="text-sm">Add more models — you need at least one candidate beyond the criteria model.</p>
          </div>

          <!-- VDT table -->
          <div v-else class="px-4 py-5">

            <!-- Header info + auto-score -->
            <div class="flex items-start justify-between gap-4 mb-4">
              <div>
                <p class="text-sm font-bold text-slate-700">Value Decision Table</p>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Criteria from <span class="font-semibold text-indigo-600">{{ criteriaModel.name }} v{{ criteriaModel.version }}</span>
                  · {{ vdtResult?.rows.length ?? 0 }} criteria · {{ candidateSlots.length }} candidate{{ candidateSlots.length !== 1 ? 's' : '' }}
                </p>
                <p class="text-[10px] text-slate-400 mt-1">Click any score cell to edit manually. Or use AI Auto-score.</p>
              </div>
              <button
                type="button"
                :disabled="vdtLoading"
                class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg
                       bg-indigo-600 text-white text-xs font-semibold
                       hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                @click="handleAutoScore"
              >
                <span v-if="vdtLoading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                <span v-else aria-hidden="true">🤖</span>
                {{ vdtLoading ? 'Scoring…' : 'AI Auto-score' }}
              </button>
            </div>

            <p v-if="vdtError" class="mb-3 text-xs text-red-600" role="alert">{{ vdtError }}</p>

            <!-- VDT table -->
            <div v-if="vdtResult" class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-sm border-collapse">
                <!-- Header -->
                <thead class="bg-slate-800 text-white">
                  <tr>
                    <th class="px-3 py-3 text-left text-xs font-semibold text-slate-300 w-48">Criterion</th>
                    <th class="px-2 py-3 text-xs font-semibold text-slate-300 w-28 text-left hidden sm:table-cell">Scale / Goal</th>
                    <th
                      v-for="(label, mi) in vdtResult.modelLabels"
                      :key="mi"
                      class="px-3 py-3 text-xs font-semibold text-center"
                      :class="vdtResult.overallWinnerIndex === mi ? 'text-yellow-300' : 'text-slate-200'"
                    >
                      {{ label }}
                      <span v-if="vdtResult.overallWinnerIndex === mi" class="block text-[10px] text-yellow-400">🏆 Winner</span>
                    </th>
                  </tr>
                </thead>
                <!-- Body -->
                <tbody class="bg-white divide-y divide-slate-100">
                  <tr v-for="(row, ri) in vdtResult.rows" :key="row.criterionId">
                    <!-- Criterion -->
                    <td class="px-3 py-3">
                      <div class="font-mono text-[10px] text-slate-400 mb-0.5">{{ row.criterionId }}</div>
                      <div class="text-xs text-slate-700 leading-snug">{{ row.description }}</div>
                    </td>
                    <!-- Scale / Goal -->
                    <td class="px-2 py-3 hidden sm:table-cell">
                      <div class="text-[10px] text-slate-500 leading-tight">{{ row.scale }}</div>
                      <div v-if="row.goal" class="text-[10px] text-green-600 font-medium mt-0.5">Goal: {{ row.goal }}</div>
                    </td>
                    <!-- Score cells -->
                    <td
                      v-for="(cell, mi) in row.scores"
                      :key="mi"
                      class="px-3 py-3 text-center cursor-pointer"
                      :class="cell.isWinner ? 'bg-green-50' : ''"
                      @click="startEditCell(ri, mi)"
                    >
                      <!-- Editing state -->
                      <div v-if="editingCell?.rowIndex === ri && editingCell?.modelIndex === mi"
                        class="flex flex-col gap-1" @click.stop>
                        <input
                          v-model="editingCell.score"
                          type="number"
                          min="0" max="10"
                          class="w-14 mx-auto rounded border border-indigo-300 px-2 py-1 text-sm text-center font-bold
                                 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          autofocus
                          @keydown.enter="commitCell"
                          @keydown.escape="editingCell = null"
                        />
                        <input
                          v-model="editingCell.rationale"
                          class="w-full rounded border border-slate-200 px-2 py-1 text-[10px]
                                 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="Rationale…"
                          @keydown.enter="commitCell"
                          @keydown.escape="editingCell = null"
                          @blur="commitCell"
                        />
                      </div>
                      <!-- Display state -->
                      <div v-else class="flex flex-col items-center gap-0.5">
                        <span
                          class="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                          :class="scoreColor(cell.score)"
                        >
                          {{ cell.score > 0 ? cell.score : '—' }}
                        </span>
                        <span v-if="cell.isWinner" class="text-[10px] text-green-600 font-semibold">✓ best</span>
                        <span v-if="cell.rationale" class="text-[9px] text-slate-400 leading-tight max-w-[80px] text-center truncate"
                          :title="cell.rationale">{{ cell.rationale }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
                <!-- Footer — win counts -->
                <tfoot class="bg-slate-100 border-t-2 border-slate-300">
                  <tr>
                    <td class="px-3 py-2 text-xs font-bold text-slate-600">Row wins</td>
                    <td class="hidden sm:table-cell" />
                    <td
                      v-for="(count, mi) in vdtResult.winCounts"
                      :key="mi"
                      class="px-3 py-2 text-center text-sm font-bold"
                      :class="vdtResult.overallWinnerIndex === mi ? 'text-green-700' : 'text-slate-600'"
                    >
                      {{ count }}
                      <span v-if="vdtResult.overallWinnerIndex === mi" class="ml-0.5">🏆</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- No VDT result yet (criteria model set but table not initialized) -->
            <div v-else class="py-8 text-center text-slate-400 text-sm">
              Loading criteria…
            </div>
          </div>
        </template>

        <!-- Bottom padding -->
        <div class="h-16" />
      </ScrollContainer>
    </div>
  </Teleport>
</template>
