<!-- UNIT_TYPE=Widget -->
<!-- Feature #50 — Multi-project dashboard slide-in panel -->
<!-- Feature #74 — Spec comparison additions -->
<!-- Feature #93 — Multi-spec trend dashboard -->
<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-[350] bg-black/20"
    aria-hidden="true"
    @click="props.onClose()"
  />

  <!-- Slide-in panel -->
  <RightPanel
    class="w-full max-w-sm bg-white shadow-2xl z-[400] flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label="Spec History"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 border-b border-gray-100 min-h-[56px] gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 truncate">📋 Spec History</h2>
        <span
          v-if="props.entries.length > 0"
          class="inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-700
                 text-[10px] font-bold px-1.5 py-0.5 shrink-0"
          aria-label="Number of specs"
        >
          {{ props.entries.length }}
        </span>
      </div>
      <CloseDot
        title="Close"
        aria-label="Close spec history"
        @click="props.onClose()"
      />
    </div>

    <!-- Body -->
    <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">
      <!-- Empty state -->
      <div
        v-if="props.entries.length === 0"
        class="flex flex-col items-center justify-center h-full gap-3 px-6 text-center"
      >
        <span class="text-4xl" aria-hidden="true">📭</span>
        <p class="text-sm text-slate-500">No specs generated yet</p>
        <p class="text-xs text-slate-400">Generate a spec from the SEM form to see it here.</p>
      </div>

      <!-- Entry list -->
      <ul v-else class="divide-y divide-gray-100">
        <li
          v-for="entry in props.entries"
          :key="entry.id"
          class="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <!-- Left: name + time -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 truncate">{{ entry.name }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ formatTime(entry.createdAt) }}</p>
          </div>

          <!-- Middle: domain badge -->
          <span
            :class="domainBadgeClass(entry.domain)"
            class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
          >
            {{ entry.domain }}
          </span>

          <!-- Right: quality score circle + entry count -->
          <div class="flex flex-col items-center gap-0.5 shrink-0">
            <div
              :class="scoreCircleClass(entry.qualityScore)"
              class="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold"
              :title="`Quality score: ${entry.qualityScore}`"
              :aria-label="`Quality score ${entry.qualityScore}`"
            >
              {{ entry.qualityScore }}
            </div>
            <span class="text-[10px] text-slate-400">{{ entry.entryCount }} entries</span>
          </div>

          <!-- Compare checkbox (Feature #74) -->
          <button
            type="button"
            :class="[
              'shrink-0 flex h-[44px] w-[44px] items-center justify-center rounded transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-indigo-400',
              comparison.selectedIds.value.includes(entry.id)
                ? 'text-indigo-600 ring-2 ring-indigo-400 bg-indigo-50'
                : 'text-slate-300 hover:text-indigo-400',
            ]"
            :aria-label="`${comparison.selectedIds.value.includes(entry.id) ? 'Deselect' : 'Select'} ${entry.name} for comparison`"
            :aria-pressed="comparison.selectedIds.value.includes(entry.id)"
            @click.stop="comparison.toggleSelect(entry.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>

          <!-- Delete button -->
          <button
            type="button"
            class="shrink-0 flex h-8 w-8 items-center justify-center rounded text-slate-300
                   hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            :aria-label="`Remove ${entry.name} from dashboard`"
            @click.stop="props.onRemove(entry.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </ScrollContainer>

    <!-- Feature #93 — Trends section -->
    <div class="border-t border-gray-100 px-4 py-3">
      <!-- Toggle button -->
      <button
        type="button"
        class="h-11 px-3 text-sm bg-emerald-100 hover:bg-emerald-200 rounded
               focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors w-full text-left"
        aria-label="Toggle trends panel"
        @click="trendsOpen = !trendsOpen"
      >
        📈 Trends
      </button>

      <!-- Trends panel -->
      <div v-if="trendsOpen" class="mt-3 space-y-3">
        <!-- Not enough specs -->
        <p v-if="props.entries.length < 2" class="text-xs text-slate-500">
          Need at least 2 specs to show trends
        </p>

        <!-- Series rows -->
        <template v-else>
          <p class="text-xs font-semibold text-slate-600">
            Trends across {{ props.entries.length }} specs
          </p>
          <div
            v-for="s in series"
            :key="s.name"
            class="flex items-center gap-2"
          >
            <!-- Name -->
            <span class="text-sm font-medium text-slate-700 w-28 shrink-0 truncate">{{ s.name }}</span>

            <!-- Sparkline -->
            <svg width="80" height="30" aria-hidden="true" class="shrink-0">
              <rect width="80" height="30" fill="none" stroke="#e2e8f0" stroke-width="0.5" rx="2"/>
              <polyline :points="s.sparklinePath" fill="none" stroke="#6366f1" stroke-width="1.5"/>
            </svg>

            <!-- Trend emoji -->
            <span class="text-base shrink-0" :aria-label="`Trend: ${s.trend}`">{{ s.trend }}</span>

            <!-- Min / Max / Latest -->
            <span class="text-[10px] text-slate-500 truncate">
              min: {{ s.min }} | max: {{ s.max }} | latest: {{ s.latest }} {{ s.unit }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <!-- Feature #74 — Comparison panel -->
    <div
      v-if="props.entries.length > 0"
      class="border-t border-gray-100 px-4 py-3 space-y-3"
    >
      <!-- Compare button / empty hint -->
      <div class="flex items-center justify-between gap-2">
        <span
          v-if="!comparison.canCompare.value"
          class="text-xs text-slate-400"
        >
          Select 2 specs to compare
        </span>
        <button
          v-if="comparison.canCompare.value"
          type="button"
          class="bg-indigo-600 hover:bg-indigo-700 text-white h-11 px-4 text-sm rounded
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          aria-label="Compare selected specs"
          @click="handleCompare"
        >
          ⇄ Compare Selected
        </button>
        <button
          type="button"
          class="text-xs text-red-400 hover:text-red-600 transition-colors min-h-[44px] px-2
                 focus:outline-none focus:ring-2 focus:ring-red-400 rounded ml-auto"
          aria-label="Clear all dashboard entries"
          @click="handleClearAll"
        >
          Clear All
        </button>
      </div>

      <!-- Comparison result panel -->
      <div v-if="comparisonResult" class="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-3">
        <!-- Header -->
        <div class="space-y-1">
          <p class="text-xs font-semibold text-slate-700 truncate">
            Comparing: <span class="text-indigo-700">{{ comparisonNameA }}</span>
            <span class="text-slate-400 mx-1">vs</span>
            <span class="text-indigo-700">{{ comparisonNameB }}</span>
          </p>
          <!-- Summary badges -->
          <div class="flex flex-wrap gap-1.5 text-[10px] font-medium">
            <span class="bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {{ comparisonResult.entriesOnlyInA }} only in A
            </span>
            <span class="bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
              {{ comparisonResult.entriesOnlyInB }} only in B
            </span>
            <span class="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {{ comparisonResult.changedEntries }} changed
            </span>
            <span class="bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">
              {{ comparisonResult.sharedEntries }} shared
            </span>
          </div>
        </div>

        <!-- Identical banner -->
        <div
          v-if="comparisonResult.isIdentical"
          class="bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-xs text-emerald-700 font-medium text-center"
        >
          🎉 Specs are identical
        </div>

        <!-- Diff table (only shown when not identical) -->
        <template v-else>
          <!-- Show all fields toggle -->
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              v-model="showAllFields"
              type="checkbox"
              class="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span class="text-xs text-slate-600">Show all fields</span>
          </label>

          <!-- Scrollable table -->
          <ScrollContainer outer-class="rounded border border-slate-200 bg-white relative" inner-class="text-[11px]" inner-style="max-height: 24rem" :no-pill="true">
            <table class="w-full border-collapse">
              <thead class="sticky top-0 bg-slate-100 z-10">
                <tr>
                  <th class="px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200">ID</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200">Field</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200">Spec A</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200">Spec B</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="diff in filteredDiffs" :key="diff.id + '-' + diff.type">
                  <!-- Only-in-A row -->
                  <tr
                    v-if="diff.onlyInA"
                    class="border-l-4 border-red-400 bg-red-50"
                  >
                    <td class="px-2 py-1.5 font-mono text-slate-700 align-top whitespace-nowrap">{{ diff.id }}</td>
                    <td class="px-2 py-1.5 text-slate-500 align-top">(all fields)</td>
                    <td class="px-2 py-1.5 text-slate-700 align-top">present</td>
                    <td class="px-2 py-1.5 text-slate-400 align-top">—</td>
                  </tr>
                  <!-- Only-in-B row -->
                  <tr
                    v-else-if="diff.onlyInB"
                    class="border-l-4 border-emerald-400 bg-emerald-50"
                  >
                    <td class="px-2 py-1.5 font-mono text-slate-700 align-top whitespace-nowrap">{{ diff.id }}</td>
                    <td class="px-2 py-1.5 text-slate-500 align-top">(all fields)</td>
                    <td class="px-2 py-1.5 text-slate-400 align-top">—</td>
                    <td class="px-2 py-1.5 text-slate-700 align-top">present</td>
                  </tr>
                  <!-- Field-level diff rows -->
                  <template v-else>
                    <tr
                      v-for="(field, fi) in visibleFields(diff)"
                      :key="diff.id + '-' + field.fieldName"
                      :class="[
                        field.changed ? 'border-l-4 border-amber-400 bg-amber-50' : 'border-l-4 border-transparent',
                        fi % 2 === 0 ? '' : 'bg-slate-50',
                      ]"
                    >
                      <td class="px-2 py-1.5 font-mono text-slate-700 align-top whitespace-nowrap">
                        {{ fi === 0 ? diff.id : '' }}
                      </td>
                      <td class="px-2 py-1.5 text-slate-500 align-top">{{ field.fieldName }}</td>
                      <td class="px-2 py-1.5 text-slate-700 align-top break-words max-w-[100px]">{{ field.valueA ?? '—' }}</td>
                      <td class="px-2 py-1.5 text-slate-700 align-top break-words max-w-[100px]">{{ field.valueB ?? '—' }}</td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </ScrollContainer>

          <!-- Copy button -->
          <button
            type="button"
            class="w-full h-11 bg-white border border-slate-200 text-slate-700 text-xs rounded
                   hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Copy comparison table as Markdown"
            @click="handleCopy"
          >
            Copy Comparison Table
          </button>
        </template>
      </div>
    </div>
  </RightPanel>
</template>

<script setup lang="ts">
// Feature #50 — ProjectDashboard component
// Feature #74 — Spec comparison additions
import { ref, computed } from 'vue'
import RightPanel from './RightPanel.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { DashboardEntry } from '../composables/useProjectDashboard'
import type { SpecBlock } from '../types/spec'
import { useSpecComparison } from '../composables/useSpecComparison'
import type { ComparisonResult, EntryDiff } from '../composables/useSpecComparison'
// Feature #93
import { useSpecTrends } from '../composables/useSpecTrends'

const props = defineProps<{
  entries: DashboardEntry[]
  onRestore: (spec: SpecBlock) => void
  onRemove: (id: string) => void
  onClose: () => void
}>()

// Emit clearAll request back through onRemove by clearing via parent
// (clearAll is triggered by a dedicated event instead)
const emit = defineEmits<{
  (e: 'clear-all'): void
}>()

function handleRestore(entry: DashboardEntry): void {
  props.onRestore(entry.spec)
  props.onClose()
}

function handleClearAll(): void {
  emit('clear-all')
}

// Feature #93 — trends state
const entriesRef = computed(() => props.entries)
const { trendsOpen, series } = useSpecTrends(entriesRef)

// Feature #74 — comparison state
const comparison = useSpecComparison()
const comparisonResult = ref<ComparisonResult | null>(null)
const comparisonNameA = ref('')
const comparisonNameB = ref('')
const showAllFields = ref(false)

function handleCompare(): void {
  const [idA, idB] = comparison.selectedIds.value
  const entryA = props.entries.find(e => e.id === idA)
  const entryB = props.entries.find(e => e.id === idB)
  if (!entryA || !entryB) return
  comparisonNameA.value = entryA.name
  comparisonNameB.value = entryB.name
  comparisonResult.value = comparison.compareSpecs(entryA, entryB)
}

function handleCopy(): void {
  if (!comparisonResult.value) return
  comparison.copyComparisonTable(comparisonResult.value, comparisonNameA.value, comparisonNameB.value)
}

const filteredDiffs = computed<EntryDiff[]>(() => {
  if (!comparisonResult.value) return []
  return comparisonResult.value.entryDiffs.filter(d => {
    if (d.onlyInA || d.onlyInB) return true
    if (showAllFields.value) return true
    // Only show entries that have at least one changed field
    return d.fields.some(f => f.changed)
  })
})

function visibleFields(diff: EntryDiff): EntryDiff['fields'] {
  if (showAllFields.value) return diff.fields
  return diff.fields.filter(f => f.changed)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const DOMAIN_BADGE: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-800',
  Product:     'bg-purple-100 text-purple-800',
  Personal:    'bg-green-100 text-green-800',
  Business:    'bg-amber-100 text-amber-800',
  Research:    'bg-cyan-100 text-cyan-800',
  General:     'bg-gray-100 text-gray-700',
}

function domainBadgeClass(domain: string): string {
  return DOMAIN_BADGE[domain] ?? 'bg-gray-100 text-gray-700'
}

function scoreCircleClass(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700'
  if (score >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}
</script>
