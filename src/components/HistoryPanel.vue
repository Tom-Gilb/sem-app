<!-- UNIT_TYPE=Panel -->
<!-- HistoryPanel.vue — Unified 4-tab history panel for Plans, Models, Contracts, and Maria analyses.
     Opened from the command menu or agent menu ("History" entry).

     UI Rules:
       - CloseDot at END of header flex row.
       - ScrollContainer for all scrollable regions.
       - Teleported to <body>; z-[510] backdrop / z-[511] card (below plan history z-[10200]).
       - All buttons have title= (DD-009).
       - No select-none on body content (Define-by-Selection Rule).
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useSpecImporter } from '../composables/useSpecImporter'
import { useModelLibrary } from '../composables/useModelLibrary'
import { useContractStore } from '../composables/useContractStore'
import { useSpecHistory, type SpecVersion } from '../composables/useSpecHistory'
import { mariaHistory, lastMariaResult } from '../lib/maria/mariaResultStore'
import type { ImportedPlan, PlanVersion } from '../composables/useSpecImporter'
import type { MariaHistoryRecord } from '../lib/maria/mariaResultStore'
import type { MariaResult } from '../types/maria'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const emit = defineEmits<{
  close:             []
  'load-plan':       [planId: string, versionId: string]
  /** Load a full SpecBlock snapshot from the spec version history (sem-spec-history-v1). */
  'load-spec-version': [version: SpecVersion]
  'restore-model':   [modelId: string, versionId: string]
  'load-contract':   [contractId: string]
  'load-maria':      [result: MariaResult]
}>()

// ── Data sources ──────────────────────────────────────────────────────────────

const { plans, selectPlan, setCurrentVersion } = useSpecImporter()
const { allEntries: allModels, restoreModelVersion } = useModelLibrary()
const { contracts, setCurrentContract } = useContractStore()
const { history: specVersionHistory } = useSpecHistory()

// r41 v109 (Tom Gilb 2026-06-17 verbatim "maybe it saves, but i cannot see
// it") — diagnostic banner so the planner can SEE the actual storage state
// at the top of every History panel open.  Surfaces the in-memory ref count
// AND the localStorage bytes-used so a "where did UK Navy go?" moment is
// no longer a silent guess.  Composes with Trace-Before-Patch SUPREME
// (don't ask "why missing" without showing data); No-Silent-Data-Loss
// SUPREME (the storage state was invisible — now it's not).
const STORAGE_KEY = 'sem-spec-history-v1'
function _storageStatus(): { entries: number; bytes: number; ok: boolean; err?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '[]'
    const parsed = JSON.parse(raw)
    return {
      entries: Array.isArray(parsed) ? parsed.length : 0,
      bytes:   raw.length,
      ok:      true,
    }
  } catch (err) {
    return { entries: 0, bytes: 0, ok: false, err: String(err).slice(0, 100) }
  }
}
const storageStatus = computed(() => _storageStatus())
const storageDiverges = computed(() =>
  specVersionHistory.value.length !== storageStatus.value.entries
)

// ── Spec version history (sem-spec-history-v1) ────────────────────────────────

/** r41 v83 (Tom Gilb 2026-06-16 verbatim "the uk navy plan was not restorable
 *  or even finadable in restore and history really back cockup") — was
 *  hiding all snapshots beyond #12 behind a "Show all" toggle so Tom's UK
 *  Navy plan (probably ranked >12 in the chronological list) was invisible
 *  until the toggle was clicked.  Now: show all by default + filter by
 *  free-text query so the user can type "navy" or "uk" or owner name and
 *  find their plan directly. */
const SPEC_VERSIONS_SHOW = 999  // effectively unlimited
const showAllSpecVersions = ref(true)
const historyQuery = ref('')

const specVersionsToShow = computed<SpecVersion[]>(() => {
  const q = historyQuery.value.trim().toLowerCase()
  if (!q) {
    return showAllSpecVersions.value
      ? specVersionHistory.value
      : specVersionHistory.value.slice(0, SPEC_VERSIONS_SHOW)
  }
  // Filter by spec name, label, summary, plan name in label, owner-names blob, plan-people blob.
  return specVersionHistory.value.filter(v => {
    const blob = [
      v.specName,
      v.label,
      v.summary,
      Array.isArray(v.specOwners) ? v.specOwners.join(' ') : '',
    ].join(' ').toLowerCase()
    return blob.includes(q)
  })
})

// Diagnostic — log what's in localStorage when the panel mounts so Tom can
// verify in DevTools that the UK Navy plan IS persisted.
console.info('[HistoryPanel] mounted · specVersionHistory entries:', specVersionHistory.value.length, '· spec models in localStorage:', (() => {
  try { return JSON.parse(localStorage.getItem('sem-specs') ?? localStorage.getItem('sem-plan-models') ?? '[]').length } catch { return -1 }
})())

function loadSpecVersion(version: SpecVersion): void {
  emit('load-spec-version', version)
  emit('close')
}

// ── Tab state ─────────────────────────────────────────────────────────────────

type Tab = 'plans' | 'models' | 'contracts' | 'maria'
const activeTab = ref<Tab>('plans')

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'plans',     label: 'Plans',     emoji: '📋' },
  { id: 'models',    label: 'Models',    emoji: '🗂️' },
  { id: 'contracts', label: 'Contracts', emoji: '📜' },
  { id: 'maria',     label: 'Maria',     emoji: '🏛' },
]

// ── Plan drill-down ───────────────────────────────────────────────────────────

const expandedPlanId = ref<string | null>(null)

function togglePlanVersions(planId: string): void {
  expandedPlanId.value = expandedPlanId.value === planId ? null : planId
}

function loadPlanVersion(plan: ImportedPlan, version: PlanVersion): void {
  // Set the plan + version in the singleton store first, then emit so App.vue
  // can open the Plan Agent panel without needing to know the version id.
  setCurrentVersion(plan.id, version.id)
  emit('load-plan', plan.id, version.id)
}

// ── Model drill-down ──────────────────────────────────────────────────────────

const expandedModelId = ref<string | null>(null)

function toggleModelVersions(modelId: string): void {
  expandedModelId.value = expandedModelId.value === modelId ? null : modelId
}

function handleRestoreModelVersion(modelId: string, versionId: string): void {
  restoreModelVersion(modelId, versionId)
  emit('restore-model', modelId, versionId)
}

// ── Contract helpers ──────────────────────────────────────────────────────────

function handleLoadContract(contractId: string): void {
  setCurrentContract(contractId)
  emit('load-contract', contractId)
}

// ── Maria helpers ─────────────────────────────────────────────────────────────

function handleLoadMaria(record: MariaHistoryRecord): void {
  // Restore the result into the singleton store so MariaAgentBoard reads it on
  // mount (its onMounted checks lastMariaResult and restores it automatically).
  lastMariaResult.value = record.result
  emit('load-maria', record.result)
}

// ── Computed counts for tab badges ────────────────────────────────────────────

const userModelsWithVersions = computed(() =>
  allModels.value.filter(m => m.source === 'user' && (m.versions?.length ?? 0) > 0)
)

const allUserModels = computed(() =>
  allModels.value.filter(m => m.source === 'user')
)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[510] bg-black/40 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
             w-[min(640px,94vw)] h-[85vh] max-h-[85vh] z-[511]
             bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Past Versions"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 min-h-[52px] border-b border-gray-100 flex-shrink-0 bg-gray-50">
        <h2 class="text-sm font-semibold text-gray-900">🕐 Workspace Past Versions</h2>
        <CloseDot aria-label="Close Past Versions panel" @click="emit('close')" />
      </div>

      <!-- Tab bar -->
      <div class="flex border-b border-gray-100 flex-shrink-0">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          :title="` Past Versions — single-click to view`"
          :class="[
            'flex-1 py-2.5 text-xs font-semibold transition-colors',
            activeTab === tab.id
              ? 'text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/60'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.emoji }} {{ tab.label }}
        </button>
      </div>

      <!-- Body -->
      <ScrollContainer
        outer-class="flex-1 min-h-0 relative"
        inner-class="h-full p-4 space-y-2"
        :no-pill="true"
      >

        <!-- ── PLANS TAB ──────────────────────────────────────────────── -->
        <template v-if="activeTab === 'plans'">

          <!-- Storage diagnostic banner (r41 v109) — shows in-memory + on-disk
               counts so a "where did UK Navy go?" moment has a visible answer. -->
          <div
            class="mb-3 px-3 py-2 rounded-lg text-[11px] border"
            :class="storageDiverges
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-600'"
            :title="storageDiverges
              ? `${specVersionHistory.length} entries in memory but only ${storageStatus.entries} persisted to localStorage — a write failure may have happened. Generate again to re-save (r41 v108 auto-trim makes this safe).`
              : `${specVersionHistory.length} entries in memory · ${(storageStatus.bytes / 1024).toFixed(1)} KB used in localStorage · storage OK`"
          >
            <span class="font-bold">Storage:</span>
            <span class="ml-1">{{ specVersionHistory.length }} in memory</span>
            <span class="mx-1">·</span>
            <span>{{ storageStatus.entries }} on disk</span>
            <span class="mx-1">·</span>
            <span>{{ (storageStatus.bytes / 1024).toFixed(1) }} KB used</span>
            <span v-if="storageDiverges" class="ml-2 font-bold">
              ⚠ {{ specVersionHistory.length - storageStatus.entries }} entries not yet persisted — re-generate to re-save
            </span>
            <span v-else-if="!storageStatus.ok" class="ml-2 font-bold text-red-700">
              ⚠ localStorage error: {{ storageStatus.err }}
            </span>
          </div>

          <!-- ── Session Specs (useSpecHistory) ─────────────────────── -->
          <div v-if="specVersionHistory.length > 0" class="mb-4">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-2 px-1">
              Session Specs · {{ specVersionHistory.length }} saved snapshot{{ specVersionHistory.length !== 1 ? 's' : '' }}
              <span v-if="historyQuery" class="ml-1 text-gray-500 font-normal">· {{ specVersionsToShow.length }} matching "{{ historyQuery }}"</span>
            </p>
            <!-- r41 v83 (Tom Gilb 2026-06-16 "the uk navy plan was not
                 restorable or even finadable in restore and history really
                 back cockup") — search box.  Filter by Plan/Spec name,
                 label, summary text, or owner name.  No need to remember
                 the exact name; partial substring is enough. -->
            <input
              v-model="historyQuery"
              type="search"
              placeholder="🔍 Filter snapshots — type Plan name (e.g. 'navy'), label, or owner…"
              class="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 placeholder:text-gray-400"
              aria-label="Search session specs by plan name, label, or owner"
            />
            <p v-if="historyQuery && specVersionsToShow.length === 0" class="text-xs text-amber-700 italic px-1 py-2">
              No snapshots matching "{{ historyQuery }}".  Try a shorter substring, or clear the filter.
            </p>
            <div class="space-y-1.5">
              <div
                v-for="version in specVersionsToShow"
                :key="version.id"
                class="flex items-center justify-between px-4 py-2.5 rounded-xl border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-gray-900 truncate">
                    {{ version.specName || version.planName || 'Unnamed Spec' }}
                    <span class="ml-1.5 font-normal text-gray-500">· {{ version.label }}</span>
                  </p>
                  <p class="text-[10px] text-gray-400 mt-0.5 truncate">
                    {{ version.summary }}
                    · {{ new Date(version.timestamp).toLocaleDateString() }}
                    {{ new Date(version.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                  </p>
                </div>
                <button
                  type="button"
                  :title="`Load '${version.specName || version.planName || 'this spec'}' (${version.label}, ${new Date(version.timestamp).toLocaleDateString()}) — single-click to restore this spec as the current working spec`"
                  class="ml-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
                  @click="loadSpecVersion(version)"
                >Load</button>
              </div>
            </div>
            <!-- Show all toggle -->
            <button
              v-if="!showAllSpecVersions && specVersionHistory.length > SPEC_VERSIONS_SHOW"
              type="button"
              class="mt-2 w-full text-center text-xs text-indigo-500 hover:text-indigo-700 py-1.5"
              :title="`Show all  spec snapshots`"
              @click="showAllSpecVersions = true"
            >Show all {{ specVersionHistory.length }} snapshots ▼</button>
            <button
              v-else-if="showAllSpecVersions && specVersionHistory.length > SPEC_VERSIONS_SHOW"
              type="button"
              class="mt-2 w-full text-center text-xs text-indigo-400 hover:text-indigo-600 py-1.5"
              :title="`Collapse to ${SPEC_VERSIONS_SHOW} most recent snapshots`"
              @click="showAllSpecVersions = false"
            >Show less ▲</button>
          </div>

          <!-- ── Imported Plans (useSpecImporter) ──────────────────── -->
          <div v-if="plans.length > 0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-violet-500 mb-2 px-1">
              Imported Plans · {{ plans.length }} plan{{ plans.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <!-- r41 v109 — diagnostic empty state.  Distinguishes "no specs ever
               generated" from "specs were generated this session but didn't
               persist" (the post-quota-trim case).  Tom Gilb 2026-06-17:
               "maybe it saves, but i cannot see it". -->
          <div v-if="specVersionHistory.length === 0 && plans.length === 0" class="text-center py-6 space-y-2">
            <p class="text-sm text-gray-500">No specs in this session.</p>
            <p v-if="storageStatus.entries > 0" class="text-xs text-amber-700">
              ⚠ {{ storageStatus.entries }} {{ storageStatus.entries === 1 ? 'snapshot' : 'snapshots' }} exist in localStorage ({{ (storageStatus.bytes / 1024).toFixed(1) }} KB) but failed to hydrate this session — try a hard refresh (⌘⇧R).
            </p>
            <p v-else class="text-xs text-gray-400">
              Use the Spec Importer or generate a spec to create one.<br/>
              (r41 v108: write failures now auto-trim oldest + log to DevTools.)
            </p>
          </div>
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="rounded-xl border border-gray-200 overflow-hidden"
          >
            <!-- Plan row -->
            <button
              type="button"
              :title="`${plan.title} — single-click to expand/collapse Past Versions`"
              class="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-indigo-50/40 transition-colors text-left"
              @click="togglePlanVersions(plan.id)"
            >
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ plan.title }}</p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ plan.versions.length }} version{{ plan.versions.length !== 1 ? 's' : '' }}
                  · created {{ new Date(plan.createdAt).toLocaleDateString() }}
                </p>
              </div>
              <span class="text-gray-400 text-xs ml-2">{{ expandedPlanId === plan.id ? '▲' : '▼' }}</span>
            </button>

            <!-- Versions list -->
            <div v-if="expandedPlanId === plan.id" class="border-t border-gray-100">
              <div
                v-for="version in [...plan.versions].reverse()"
                :key="version.id"
                class="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <p class="text-xs font-medium text-gray-800">
                    v{{ version.versionNumber }} — {{ version.label }}
                  </p>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ version.entries.length }} entries · score {{ version.overallScore }}/100
                    · {{ new Date(version.createdAt).toLocaleDateString() }}
                  </p>
                </div>
                <button
                  type="button"
                  :title="`Load version ${version.versionNumber} of '${plan.title}' — single-click to restore this plan version as the active plan`"
                  class="ml-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
                  :class="plan.currentVersionId === version.id ? 'opacity-50 cursor-default' : ''"
                  :disabled="plan.currentVersionId === version.id"
                  @click.stop="loadPlanVersion(plan, version)"
                >{{ plan.currentVersionId === version.id ? 'Current' : 'Load' }}</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ── MODELS TAB ─────────────────────────────────────────────── -->
        <template v-if="activeTab === 'models'">
          <p v-if="allUserModels.length === 0" class="text-sm text-gray-400 text-center py-6">
            No user models yet — bring in a model via the Model Library.
          </p>
          <p v-else-if="userModelsWithVersions.length === 0" class="text-sm text-gray-400 text-center py-6">
            {{ allUserModels.length }} model{{ allUserModels.length !== 1 ? 's' : '' }} found
            — no saved versions yet. Versions are created when you improve or edit a model.
          </p>
          <div
            v-for="model in allUserModels"
            :key="model.id"
            class="rounded-xl border border-gray-200 overflow-hidden"
          >
            <!-- Model row -->
            <button
              type="button"
              :title="`${model.title} — single-click to expand/collapse Past Versions`"
              class="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-sky-50/40 transition-colors text-left"
              :disabled="!(model.versions?.length)"
              @click="model.versions?.length ? toggleModelVersions(model.id) : undefined"
            >
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ model.title }}</p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ model.entries.length }} entries · {{ model.stakeholders.length }} stakeholders
                  <template v-if="model.versions?.length">· {{ model.versions.length }} version{{ model.versions.length !== 1 ? 's' : '' }}</template>
                  <template v-else> · no versions yet</template>
                </p>
              </div>
              <span v-if="model.versions?.length" class="text-gray-400 text-xs ml-2">
                {{ expandedModelId === model.id ? '▲' : '▼' }}
              </span>
            </button>

            <!-- Versions list -->
            <div v-if="expandedModelId === model.id && model.versions?.length" class="border-t border-gray-100">
              <div
                v-for="version in [...(model.versions ?? [])].reverse()"
                :key="version.id"
                class="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <p class="text-xs font-medium text-gray-800">v{{ version.versionNumber }} — {{ version.name }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ version.entries.length }} entries · {{ version.stakeholders.length }} stakeholders
                    · {{ new Date(version.createdAt).toLocaleDateString() }}
                  </p>
                </div>
                <button
                  type="button"
                  :title="`Restore version ${version.versionNumber} of '${model.title}' — single-click to restore these entries and stakeholders as the current model state`"
                  class="ml-3 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
                  @click.stop="handleRestoreModelVersion(model.id, version.id)"
                >Restore</button>
              </div>
            </div>
          </div>
        </template>

        <!-- ── CONTRACTS TAB ──────────────────────────────────────────── -->
        <template v-if="activeTab === 'contracts'">
          <p v-if="contracts.length === 0" class="text-sm text-gray-400 text-center py-6">
            No contracts yet — analyse a contract via the Contracts panel.
          </p>
          <div
            v-for="contract in contracts"
            :key="contract.id"
            class="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50/30 transition-colors"
          >
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ contract.title }}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ contract.contractType }} · {{ contract.clauses.length }} clause{{ contract.clauses.length !== 1 ? 's' : '' }}
                · {{ contract.clauses.flatMap(cl => cl.entries).length }} entries
                · {{ new Date(contract.createdAt).toLocaleDateString() }}
              </p>
            </div>
            <button
              type="button"
              :title="`Load '${contract.title}' — single-click to make this the active contract in the Contracts panel`"
              class="ml-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
              @click="handleLoadContract(contract.id)"
            >Load</button>
          </div>
        </template>

        <!-- ── MARIA TAB ──────────────────────────────────────────────── -->
        <template v-if="activeTab === 'maria'">
          <p v-if="mariaHistory.length === 0" class="text-sm text-gray-400 text-center py-6">
            No board analyses yet — run Maria on a board document to see history here.
          </p>
          <div
            v-for="record in mariaHistory"
            :key="record.id"
            class="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-teal-50/30 transition-colors"
          >
            <div>
              <p class="text-sm font-semibold text-gray-900 truncate max-w-[380px]">{{ record.title }}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ new Date(record.takenAt).toLocaleDateString() }}
                · {{ record.decisionCount }} decisions
                · {{ record.authorityGapCount }} authority gap{{ record.authorityGapCount !== 1 ? 's' : '' }}
                · {{ record.governanceGapCount }} governance gap{{ record.governanceGapCount !== 1 ? 's' : '' }}
                · {{ record.patternCount }} pattern{{ record.patternCount !== 1 ? 's' : '' }}
              </p>
            </div>
            <button
              type="button"
              :title="`Load this board analysis — single-click to restore '${record.title}' as the active Maria result in the Maria Agent panel`"
              class="ml-3 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
              @click="handleLoadMaria(record)"
            >Load</button>
          </div>
        </template>

      </ScrollContainer>
    </div>
  </Teleport>
</template>
