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
import { usePlanImporter } from '../composables/usePlanImporter'
import { useModelLibrary } from '../composables/useModelLibrary'
import { useContractStore } from '../composables/useContractStore'
import { mariaHistory, lastMariaResult } from '../lib/maria/mariaResultStore'
import type { ImportedPlan, PlanVersion } from '../composables/usePlanImporter'
import type { MariaHistoryRecord } from '../lib/maria/mariaResultStore'
import type { MariaResult } from '../types/maria'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const emit = defineEmits<{
  close:             []
  'load-plan':       [planId: string, versionId: string]
  'restore-model':   [modelId: string, versionId: string]
  'load-contract':   [contractId: string]
  'load-maria':      [result: MariaResult]
}>()

// ── Data sources ──────────────────────────────────────────────────────────────

const { plans, selectPlan, setCurrentVersion } = usePlanImporter()
const { allEntries: allModels, restoreModelVersion } = useModelLibrary()
const { contracts, setCurrentContract } = useContractStore()

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
             w-[min(640px,94vw)] max-h-[85vh] z-[511]
             bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace History"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 min-h-[52px] border-b border-gray-100 flex-shrink-0 bg-gray-50">
        <h2 class="text-sm font-semibold text-gray-900">🕐 Workspace History</h2>
        <CloseDot aria-label="Close History panel" @click="emit('close')" />
      </div>

      <!-- Tab bar -->
      <div class="flex border-b border-gray-100 flex-shrink-0">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          :title="`${tab.label} history — single-click to view`"
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
          <p v-if="plans.length === 0" class="text-sm text-gray-400 text-center py-6">
            No plans yet — use the Plan Importer to create one.
          </p>
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="rounded-xl border border-gray-200 overflow-hidden"
          >
            <!-- Plan row -->
            <button
              type="button"
              :title="`${plan.title} — single-click to expand/collapse version history`"
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
              :title="`${model.title} — single-click to expand/collapse version history`"
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
