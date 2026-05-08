<!-- UNIT_TYPE=Widget -->
<!-- Feature #46 — Spec "Heat Lane" full-screen swimlane diagram -->
<template>
  <div
    class="fixed inset-0 z-[500] bg-white overflow-auto"
    role="dialog"
    aria-modal="true"
    aria-label="Heat Lane swimlane diagram"
  >
    <!-- Header bar -->
    <div class="no-print sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2 shadow-sm">
      <h2 class="text-sm font-semibold text-slate-700">🏊 Heat Lane View</h2>
      <div class="flex items-center gap-2">
        <button
          type="button"
          aria-label="Print"
          class="h-11 px-4 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-slate-700 transition-colors"
          @click="handlePrint"
        >
          🖨 Print
        </button>
        <button
          type="button"
          aria-label="Close"
          class="h-11 w-11 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-slate-600 transition-colors text-lg font-medium"
          @click="props.onClose()"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Swimlane table -->
    <div class="p-4 overflow-x-auto">
      <table class="w-full border-collapse" style="min-width: 600px;">
        <!-- Column headers -->
        <thead>
          <tr>
            <!-- Lane label header cell -->
            <th
              class="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2 bg-slate-50 border border-slate-200"
              style="min-width: 120px;"
            >
              Lane
            </th>
            <!-- Step / stage column headers -->
            <th
              v-for="col in columns"
              :key="col.index"
              class="text-center text-xs font-semibold text-slate-600 px-3 py-2 bg-slate-50 border border-slate-200"
              style="min-width: 180px;"
            >
              <div>{{ col.name }}</div>
              <div v-if="col.description" class="text-[10px] font-normal text-slate-400 mt-0.5 max-w-[180px] mx-auto truncate">
                {{ col.description }}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Lane: Functions -->
          <tr>
            <td
              class="align-top px-3 py-3 bg-blue-50 border border-slate-200 font-semibold text-xs text-blue-700"
              style="min-width: 120px;"
            >
              🔧 Functions
            </td>
            <td
              v-for="col in columns"
              :key="col.index"
              class="align-top px-2 py-2 border border-slate-200 bg-white"
              style="vertical-align: top;"
            >
              <div class="space-y-2">
                <div
                  v-for="entry in functionColumns[col.index] ?? []"
                  :key="entry.id"
                  class="rounded-lg border-l-4 border-blue-400 bg-blue-50 px-3 py-2"
                >
                  <p class="text-[10px] font-mono font-bold text-blue-600 mb-0.5">{{ entry.id }}</p>
                  <p class="text-xs text-slate-700 leading-snug">{{ truncate(entry.description) }}</p>
                </div>
                <div v-if="(functionColumns[col.index] ?? []).length === 0" class="text-[10px] text-slate-300 italic px-1">—</div>
              </div>
            </td>
          </tr>

          <!-- Lane: Values -->
          <tr>
            <td
              class="align-top px-3 py-3 bg-emerald-50 border border-slate-200 font-semibold text-xs text-emerald-700"
              style="min-width: 120px;"
            >
              📊 Values
            </td>
            <td
              v-for="col in columns"
              :key="col.index"
              class="align-top px-2 py-2 border border-slate-200 bg-white"
              style="vertical-align: top;"
            >
              <div class="space-y-2">
                <div
                  v-for="entry in valueColumns[col.index] ?? []"
                  :key="entry.id"
                  class="rounded-lg border-l-4 border-emerald-400 bg-emerald-50 px-3 py-2"
                >
                  <p class="text-[10px] font-mono font-bold text-emerald-600 mb-0.5">{{ entry.id }}</p>
                  <p class="text-xs text-slate-700 leading-snug">{{ truncate(entry.description) }}</p>
                </div>
                <div v-if="(valueColumns[col.index] ?? []).length === 0" class="text-[10px] text-slate-300 italic px-1">—</div>
              </div>
            </td>
          </tr>

          <!-- Lane: Solutions -->
          <tr>
            <td
              class="align-top px-3 py-3 bg-violet-50 border border-slate-200 font-semibold text-xs text-violet-700"
              style="min-width: 120px;"
            >
              🔩 Solutions
            </td>
            <td
              v-for="col in columns"
              :key="col.index"
              class="align-top px-2 py-2 border border-slate-200 bg-white"
              style="vertical-align: top;"
            >
              <div class="space-y-2">
                <div
                  v-for="entry in solutionColumns[col.index] ?? []"
                  :key="entry.id"
                  class="rounded-lg border-l-4 border-violet-400 bg-violet-50 px-3 py-2"
                >
                  <p class="text-[10px] font-mono font-bold text-violet-600 mb-0.5">{{ entry.id }}</p>
                  <p class="text-xs text-slate-700 leading-snug">{{ truncate(entry.description) }}</p>
                </div>
                <div v-if="(solutionColumns[col.index] ?? []).length === 0" class="text-[10px] text-slate-300 italic px-1">—</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
// Feature #46 — SpecHeatLane component
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import { distributeEntries } from '../utils/heatLane'

const props = defineProps<{
  spec: SpecBlock | null
  confirmedSteps: EvoStep[]
  onClose: () => void
}>()

interface ColumnDef {
  index: number
  name: string
  description?: string
}

/** Build column definitions from confirmed steps or fallback dummy stages */
const columns = computed<ColumnDef[]>(() => {
  if (props.confirmedSteps.length > 0) {
    return props.confirmedSteps.map((step, i) => ({
      index: i,
      name: step.name,
      description: step.description,
    }))
  }
  // Fallback: 3 dummy stages
  return [
    { index: 0, name: 'Stage 1' },
    { index: 1, name: 'Stage 2' },
    { index: 2, name: 'Stage 3' },
  ]
})

const numColumns = computed(() => columns.value.length)

/** Distributed function entries per column */
const functionColumns = computed(() => {
  if (!props.spec) return []
  return distributeEntries(props.spec.functions, numColumns.value)
})

/** Distributed value entries per column */
const valueColumns = computed(() => {
  if (!props.spec) return []
  return distributeEntries(props.spec.values, numColumns.value)
})

/** Distributed solution entries per column */
const solutionColumns = computed(() => {
  if (!props.spec) return []
  return distributeEntries(props.spec.solutions, numColumns.value)
})

/** Truncate description to 80 characters */
function truncate(text: string, max = 80): string {
  if (!text) return ''
  return text.length <= max ? text : text.slice(0, max) + '…'
}

function handlePrint(): void {
  window.print()
}
</script>

<style scoped>
@media print {
  .no-print {
    display: none;
  }
}
</style>
