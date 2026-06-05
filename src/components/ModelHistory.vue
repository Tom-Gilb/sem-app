<!--
  ModelHistory.vue — Full-screen panel listing all saved PlanModel records.
  Shows both Plan-mode and Model-mode records, newest-first.
  Pattern mirrors SpecHistory: LATEST card on top + collapsible older entries
  + AND-token search.

  z-tiers:
    Backdrop: z-[492] (below ArrowInfoPanel z-[490] — no: above it)
    Panel:    z-[493]
  Using 492/493 so it sits above SystemModelDashboard (488/489) and
  ArrowInfoPanel (490/491) but below SelectionDefiner (10100).

  Single-Surface rule: caller must register 'model-history' with
  registerExclusiveSurface in App.vue.

  Spec: System Model Mode feature (2026-05-19 r07).
  P7 (2026-05-27): Forensic reconstruction — was lost in git reset --hard.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSpecModel, type PlanModel } from '../composables/useSpecModel'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const emit = defineEmits<{
  /** Close the panel. */
  close: []
  /**
   * User clicked ⬆ Load on a PlanModel entry.
   * Parent should call activatePlanModel(model) and set it as the active plan.
   */
  'load-model': [model: PlanModel]
  /**
   * User clicked 👁 View on a model-mode record.
   * Parent should open SystemModelDashboard with this model loaded.
   */
  'open-model-dashboard': [model: PlanModel]
}>()

// ── Data ──────────────────────────────────────────────────────────────────────

const { allModels } = useSpecModel()

// ── Search ────────────────────────────────────────────────────────────────────

const searchQuery = ref('')
const searchRef   = ref<HTMLInputElement | null>(null)

const _tokens = computed(() =>
  searchQuery.value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
)

function _matches(m: PlanModel): boolean {
  if (_tokens.value.length === 0) return true
  const haystack = [
    m.name,
    m.version,
    m.workingMode ?? 'plan',
    m.specSource,
    ...(m.owners ?? []).map((o) => o.name),
    ...(m.planners ?? []).map((p) => p.name),
  ]
    .join(' ')
    .toLowerCase()
  return _tokens.value.every((t) => haystack.includes(t))
}

const filteredModels = computed(() => allModels.value.filter(_matches))

const latestModel  = computed(() => filteredModels.value[0] ?? null)
const olderModels  = computed(() => filteredModels.value.slice(1))
const olderVisible = ref(false)

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s  = Math.round(ms / 1000)
  if (s < 60)        return 'just now'
  const m  = Math.round(s / 60)
  if (m < 60)        return `${m}m ago`
  const h  = Math.round(m / 60)
  if (h < 24)        return `${h}h ago`
  const d  = Math.round(h / 24)
  if (d < 7)         return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function entryCount(m: PlanModel): string {
  const s = m.spec
  if (!s) return '—'
  const f = (s.functions  ?? []).length
  const v = (s.values     ?? []).length
  const c = (s.constraints ?? []).length
  const sol = (s.solutions ?? []).length
  return `${f}F · ${v}V · ${sol}S · ${c}C`
}

function ownerLabel(m: PlanModel): string {
  const owners   = (m.owners   ?? []).map((o) => o.name).filter(Boolean)
  const planners = (m.planners ?? []).map((p) => p.name).filter(Boolean)
  const parts: string[] = []
  if (owners.length)   parts.push(`by ${owners.join(', ')}`)
  if (planners.length) parts.push(`planned by ${planners.join(', ')}`)
  return parts.join(' · ')
}

function isModel(m: PlanModel): boolean {
  return m.workingMode === 'model'
}

function modeLabel(m: PlanModel): string {
  return isModel(m) ? '🏗️ Model' : '📋 Plan'
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function _onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', _onKeydown, { capture: true })
  // Auto-focus search input.
  setTimeout(() => searchRef.value?.focus(), 60)
})
onUnmounted(() => {
  document.removeEventListener('keydown', _onKeydown, { capture: true })
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[492] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[493] flex items-start justify-center overflow-y-auto py-8 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Model History — all saved plans and system models"
    >
      <div class="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/20">

        <!-- ── Header ──────────────────────────────────────────────────── -->
        <div class="flex items-center justify-between gap-3 px-5 py-3
                    bg-gradient-to-r from-indigo-900 to-violet-800">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-xl shrink-0" aria-hidden="true">🗂️</span>
            <div class="min-w-0">
              <h2 class="text-white font-bold text-base leading-tight">Model History</h2>
              <p class="text-white/60 text-[11px] leading-none mt-0.5">
                {{ allModels.length }} saved {{ allModels.length === 1 ? 'record' : 'records' }} —
                plans and system models
              </p>
            </div>
          </div>
          <CloseDot variant="on-dark" aria-label="Close Model History" @click="emit('close')" />
        </div>

        <!-- ── Search ──────────────────────────────────────────────────── -->
        <div class="px-5 py-3 bg-indigo-950 border-b border-indigo-900/60">
          <input
            ref="searchRef"
            v-model="searchQuery"
            type="search"
            placeholder="Search plans and models… (AND tokens)"
            class="w-full rounded-lg px-3 py-2 text-sm bg-white/10 text-white
                   placeholder-white/40 border border-white/15
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Search Model History"
          />
        </div>

        <!-- ── Body ────────────────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="bg-slate-50"
          inner-class="p-5 space-y-3"
          :style="{ maxHeight: '70vh' }"
        >

          <!-- Empty state -->
          <div
            v-if="filteredModels.length === 0"
            class="py-12 text-center"
          >
            <span class="text-4xl" aria-hidden="true">📭</span>
            <p class="text-sm text-slate-500 mt-3 font-medium">
              {{ searchQuery ? 'No records match your search' : 'No plans or models saved yet' }}
            </p>
          </div>

          <template v-else>

            <!-- ── LATEST card ────────────────────────────────────────── -->
            <div
              v-if="latestModel"
              class="rounded-xl overflow-hidden ring-1 ring-black/10 shadow-sm"
            >
              <!-- Mode band -->
              <div
                class="flex items-center justify-between gap-2 px-4 py-2"
                :class="isModel(latestModel)
                  ? 'bg-gradient-to-r from-indigo-700 to-violet-600'
                  : 'bg-gradient-to-r from-slate-700 to-slate-600'"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-white/90 tracking-wide">LATEST</span>
                  <span class="text-[10px] text-white/60">·</span>
                  <span class="text-[10px] font-semibold text-white/80">{{ modeLabel(latestModel) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-white/50">v{{ latestModel.version }}</span>
                  <span class="text-[10px] text-white/50">·</span>
                  <span class="text-[10px] text-white/50">{{ relativeTime(latestModel.updatedAt) }}</span>
                </div>
              </div>

              <!-- Card body -->
              <div class="bg-white px-4 py-3 space-y-2">
                <p class="text-[14px] font-extrabold text-slate-900 leading-tight truncate">
                  {{ latestModel.name }}
                </p>
                <p v-if="ownerLabel(latestModel)" class="text-[11px] font-semibold text-indigo-700 truncate">
                  {{ ownerLabel(latestModel) }}
                </p>
                <p class="text-[11px] text-slate-400 font-mono">{{ entryCount(latestModel) }}</p>
                <div class="flex items-center gap-2 pt-1">
                  <button
                    v-if="isModel(latestModel)"
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-indigo-100 text-indigo-700 hover:bg-indigo-200
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                    :title="`Open System Model Dashboard for ${latestModel.name}`"
                    @click="emit('open-model-dashboard', latestModel)"
                  >👁 View Model</button>
                  <button
                    type="button"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-slate-800 text-white hover:bg-slate-700
                           focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                    :title="`Load ${latestModel.name} as the active plan`"
                    @click="emit('load-model', latestModel)"
                  >⬆ Load</button>
                </div>
              </div>
            </div>

            <!-- ── Older entries ──────────────────────────────────────── -->
            <div v-if="olderModels.length > 0">
              <button
                type="button"
                class="w-full flex items-center justify-between px-4 py-2.5 rounded-xl
                       bg-white ring-1 ring-black/8 text-sm font-semibold text-slate-600
                       hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400
                       transition-colors"
                @click="olderVisible = !olderVisible"
              >
                <span>{{ olderVisible ? '▾' : '▸' }} Show {{ olderModels.length }} older
                  {{ olderModels.length === 1 ? 'record' : 'records' }}</span>
                <span class="text-xs text-slate-400 font-normal">click to {{ olderVisible ? 'collapse' : 'expand' }}</span>
              </button>

              <div v-if="olderVisible" class="mt-2 space-y-2">
                <div
                  v-for="m in olderModels"
                  :key="m.id"
                  class="rounded-xl overflow-hidden ring-1 ring-black/8"
                >
                  <!-- Mode band (compact) -->
                  <div
                    class="flex items-center justify-between gap-2 px-3 py-1.5"
                    :class="isModel(m)
                      ? 'bg-indigo-600'
                      : 'bg-slate-500'"
                  >
                    <span class="text-[10px] font-bold text-white/90 tracking-wide">
                      {{ modeLabel(m) }}
                    </span>
                    <span class="text-[10px] text-white/55">
                      v{{ m.version }} · {{ relativeTime(m.updatedAt) }}
                    </span>
                  </div>

                  <!-- Card body -->
                  <div class="bg-white px-3 py-2.5 flex items-center gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-[12px] font-bold text-slate-800 truncate">{{ m.name }}</p>
                      <p v-if="ownerLabel(m)" class="text-[10px] font-semibold text-indigo-600 truncate">
                        {{ ownerLabel(m) }}
                      </p>
                      <p class="text-[10px] text-slate-400 font-mono mt-0.5">{{ entryCount(m) }}</p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        v-if="isModel(m)"
                        type="button"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-semibold
                               bg-indigo-100 text-indigo-700 hover:bg-indigo-200
                               focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                        :title="`View model: ${m.name}`"
                        @click="emit('open-model-dashboard', m)"
                      >👁</button>
                      <button
                        type="button"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-semibold
                               bg-slate-700 text-white hover:bg-slate-600
                               focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                        :title="`Load ${m.name}`"
                        @click="emit('load-model', m)"
                      >⬆</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </template>
        </ScrollContainer>

      </div>
    </div>
  </Teleport>
</template>
