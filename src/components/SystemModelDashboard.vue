<!-- UNIT_TYPE=Widget -->
<!-- SystemModelDashboard — full-screen System Model panel for Planguage system models.
     Shows the full system picture: Functions (presence), Values (health),
     Constraints, and a Gap Analysis identifying values below Goal.

     Mode: displayed when the active PlanModel has workingMode === 'model'.

     Emits 'derive-plan' with selected under-performing Value IDs so App.vue
     can switch to Plan mode and focus those values.
     Emits 'switch-to-plan' to switch the active model's workingMode back to 'plan'.
     Emits 'close' when the panel should be dismissed.

     Universal rules honoured:
       - CloseDot at END of header on dark gradient (variant="on-dark")
       - ScrollContainer wrapping the scrollable body
       - Teleport to body + backdrop (full-screen exclusive surface)
       - Registered as exclusive surface in App.vue (z-[488/489])
       - Define-by-Selection: no select-none on body content, z <= 600 -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SpecBlock, FEntry, VEntry } from '../types/spec'
import type { PlanModel } from '../composables/useSpecModel'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock
  model: PlanModel
}>()

const emit = defineEmits<{
  'derive-plan': [valueIds: string[]]
  'switch-to-plan': []
  'close': []
}>()

// ── Value health classification ──────────────────────────────────────────────

type ValueHealth = 'at-goal' | 'below-goal' | 'no-data'

function classifyValue(v: VEntry): ValueHealth {
  const statusNum = _extractNumber(v.status)
  const goalNum   = _extractNumber(v.goal)
  if (statusNum === null || goalNum === null) return 'no-data'
  // Higher-is-better assumption (works for most values: speed, coverage, satisfaction)
  return statusNum >= goalNum ? 'at-goal' : 'below-goal'
}

function _extractNumber(s: string): number | null {
  if (!s) return null
  const m = s.match(/[\d]+(?:[.,]\d+)?/)
  if (!m) return null
  return parseFloat(m[0].replace(',', '.'))
}

const valueHealthMap = computed(() => {
  const map = new Map<string, ValueHealth>()
  for (const v of props.spec.values) {
    map.set(v.id, classifyValue(v))
  }
  return map
})

// ── Gap analysis ─────────────────────────────────────────────────────────────

const belowGoalValues = computed(() =>
  props.spec.values.filter(v => valueHealthMap.value.get(v.id) === 'below-goal')
)

const atGoalValues = computed(() =>
  props.spec.values.filter(v => valueHealthMap.value.get(v.id) === 'at-goal')
)

// ── Function presence ─────────────────────────────────────────────────────────

function presenceIcon(f: FEntry): string {
  const s = f.currentStatus ?? ''
  if (s === 'present') return '✅'
  if (s === 'absent')  return '❌'
  if (s === 'partial') return '🟡'
  return '⬜'
}

function presenceBadge(f: FEntry): { text: string; cls: string } {
  const s = f.currentStatus ?? ''
  if (s === 'present') return { text: 'Present', cls: 'bg-emerald-100 text-emerald-700' }
  if (s === 'absent')  return { text: 'Absent',  cls: 'bg-red-100 text-red-700' }
  if (s === 'partial') return { text: 'Partial', cls: 'bg-amber-100 text-amber-700' }
  return { text: 'Not assessed', cls: 'bg-slate-100 text-slate-500' }
}

// ── Value health badge ────────────────────────────────────────────────────────

function healthBadge(v: VEntry): { icon: string; cls: string; label: string } {
  const h = valueHealthMap.value.get(v.id) ?? 'no-data'
  if (h === 'at-goal')    return { icon: '✅', cls: 'bg-emerald-100 text-emerald-700', label: 'At Goal' }
  if (h === 'below-goal') return { icon: '🔴', cls: 'bg-red-100 text-red-700',         label: 'Below Goal' }
  return                         { icon: '⬜', cls: 'bg-slate-100 text-slate-500',      label: 'No data' }
}

// ── Derive Plan ───────────────────────────────────────────────────────────────

const selectedGapIds = ref<Set<string>>(new Set())

function toggleGapSelect(id: string): void {
  const next = new Set(selectedGapIds.value)
  if (next.has(id)) next.delete(id)
  else              next.add(id)
  selectedGapIds.value = next
}

function derivePlan(): void {
  const ids = selectedGapIds.value.size > 0
    ? [...selectedGapIds.value]
    : belowGoalValues.value.map(v => v.id)
  emit('derive-plan', ids)
}

// ── System health summary ─────────────────────────────────────────────────────

const healthScore = computed(() => {
  const total = props.spec.values.length
  if (total === 0) return null
  const atGoal = atGoalValues.value.length
  return Math.round((atGoal / total) * 100)
})

const functionsPresent = computed(() =>
  props.spec.functions.filter(f => f.currentStatus === 'present').length
)

const constraintCount = computed(() =>
  (props.spec.constraints ?? []).length
)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[488] bg-black/40"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Full-screen card -->
    <div
      class="fixed inset-0 z-[489] flex flex-col bg-slate-50 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="System Model Dashboard"
    >
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div
        class="flex items-center gap-3 px-5 py-3.5 shrink-0
               bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-800 text-white"
      >
        <span class="text-xl shrink-0" aria-hidden="true">🏗️</span>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-widest text-indigo-200 leading-tight">System Model</p>
          <p class="text-[14px] font-bold leading-tight truncate">{{ model.name }}</p>
        </div>
        <!-- Health score chip -->
        <div v-if="healthScore !== null" class="flex-shrink-0 text-right mr-2">
          <div class="text-2xl font-black leading-none">{{ healthScore }}%</div>
          <div class="text-[10px] text-indigo-200">Values at Goal</div>
        </div>
        <CloseDot
          variant="on-dark"
          aria-label="Close System Model Dashboard"
          @click="emit('close')"
        />
      </div>

      <!-- ── Scrollable body ────────────────────────────────────────────── -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">
        <div class="flex flex-col gap-6 px-4 py-6 max-w-4xl mx-auto">

          <!-- ── System Identity Header card ───────────────────────────── -->
          <div class="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white shadow-lg">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p v-if="model.systemDescription" class="mt-1 text-sm text-indigo-200 leading-relaxed">
                  {{ model.systemDescription }}
                </p>
                <p v-else class="mt-1 text-sm text-indigo-300 italic">No system description set.</p>
              </div>
              <div class="flex-shrink-0 text-right">
                <div class="text-3xl font-black">
                  {{ healthScore !== null ? `${healthScore}%` : '—' }}
                </div>
                <div class="text-xs text-indigo-200">Values at Goal</div>
              </div>
            </div>

            <!-- Summary chips -->
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="px-2.5 py-1 rounded-full bg-white/20 text-xs font-medium">
                {{ spec.functions.length }} Function{{ spec.functions.length === 1 ? '' : 's' }}
                · {{ functionsPresent }} present
              </span>
              <span class="px-2.5 py-1 rounded-full bg-white/20 text-xs font-medium">
                {{ spec.values.length }} Value{{ spec.values.length === 1 ? '' : 's' }}
              </span>
              <span v-if="constraintCount > 0" class="px-2.5 py-1 rounded-full bg-white/20 text-xs font-medium">
                {{ constraintCount }} Constraint{{ constraintCount === 1 ? '' : 's' }}
              </span>
              <span v-if="belowGoalValues.length > 0" class="px-2.5 py-1 rounded-full bg-red-400/40 text-xs font-medium">
                {{ belowGoalValues.length }} gap{{ belowGoalValues.length === 1 ? '' : 's' }} below Goal
              </span>
              <span class="px-2.5 py-1 rounded-full bg-white/15 text-xs font-medium">
                v{{ model.version }}
              </span>
            </div>
          </div>

          <!-- ── Gap Analysis (most important — shown first when gaps exist) ── -->
          <section v-if="belowGoalValues.length > 0">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <span aria-hidden="true">🔴</span>
                Gap Analysis — Values Below Goal
              </h2>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold
                       hover:bg-indigo-700 active:scale-95 transition-colors focus:outline-none
                       focus:ring-2 focus:ring-indigo-400"
                @click="derivePlan"
              >
                {{ selectedGapIds.size > 0 ? `Derive Plan from ${selectedGapIds.size} selected` : 'Derive Plan from all gaps' }}
              </button>
            </div>

            <div class="space-y-2">
              <div
                v-for="v in belowGoalValues"
                :key="v.id"
                class="rounded-xl border-2 transition-colors cursor-pointer select-none"
                :class="selectedGapIds.has(v.id)
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-red-200 bg-red-50 hover:border-red-300'"
                @click="toggleGapSelect(v.id)"
              >
                <div class="px-4 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-slate-800 leading-snug">{{ v.description }}</p>
                      <p class="text-xs text-slate-500 mt-0.5">Scale: {{ v.scale || '—' }}</p>
                    </div>
                    <div class="flex-shrink-0 flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        :checked="selectedGapIds.has(v.id)"
                        class="rounded accent-indigo-600"
                        tabindex="-1"
                        @click.stop="toggleGapSelect(v.id)"
                      />
                    </div>
                  </div>
                  <div class="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div class="bg-white rounded-lg px-2 py-1.5">
                      <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Current</div>
                      <div class="text-slate-700 font-medium mt-0.5 truncate">{{ v.status || '—' }}</div>
                    </div>
                    <div class="bg-white rounded-lg px-2 py-1.5">
                      <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Goal</div>
                      <div class="text-indigo-700 font-medium mt-0.5 truncate">{{ v.goal || '—' }}</div>
                    </div>
                    <div class="bg-white rounded-lg px-2 py-1.5">
                      <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Forecast</div>
                      <div class="text-violet-700 font-medium mt-0.5 truncate">{{ v.forecast || '—' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Functions — Presence Grid ─────────────────────────────── -->
          <section v-if="spec.functions.length > 0">
            <h2 class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span aria-hidden="true">⚙️</span>
              Functions
            </h2>
            <div class="space-y-2">
              <div
                v-for="f in spec.functions"
                :key="f.id"
                class="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-start gap-3"
              >
                <span class="text-lg flex-shrink-0 mt-0.5" aria-hidden="true">{{ presenceIcon(f) }}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-semibold text-slate-800 leading-snug">{{ f.description }}</p>
                    <span
                      class="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      :class="presenceBadge(f).cls"
                    >{{ presenceBadge(f).text }}</span>
                  </div>
                  <p v-if="f.presenceTest" class="text-xs text-slate-500 mt-1">Test: {{ f.presenceTest }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Values — Health Dashboard ─────────────────────────────── -->
          <section v-if="spec.values.length > 0">
            <h2 class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span aria-hidden="true">📊</span>
              Values
            </h2>
            <div class="space-y-2">
              <div
                v-for="v in spec.values"
                :key="v.id"
                class="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-base" aria-hidden="true">{{ healthBadge(v).icon }}</span>
                      <p class="text-sm font-semibold text-slate-800 leading-snug">{{ v.description }}</p>
                      <span
                        class="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        :class="healthBadge(v).cls"
                      >{{ healthBadge(v).label }}</span>
                    </div>
                    <p v-if="v.scale" class="text-xs text-slate-500 mt-0.5">{{ v.scale }}</p>
                  </div>
                </div>
                <!-- Current / Tolerable / Goal / Forecast strip -->
                <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div class="bg-slate-50 rounded-lg px-2 py-1.5">
                    <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Current</div>
                    <div class="text-slate-700 font-medium mt-0.5">{{ v.status || '—' }}</div>
                  </div>
                  <div class="bg-amber-50 rounded-lg px-2 py-1.5">
                    <div class="text-[10px] text-amber-500 font-semibold uppercase tracking-wide">Tolerable</div>
                    <div class="text-amber-800 font-medium mt-0.5">{{ v.tolerable || '—' }}</div>
                  </div>
                  <div class="bg-indigo-50 rounded-lg px-2 py-1.5">
                    <div class="text-[10px] text-indigo-500 font-semibold uppercase tracking-wide">Goal</div>
                    <div class="text-indigo-700 font-medium mt-0.5">{{ v.goal || '—' }}</div>
                  </div>
                  <div class="bg-violet-50 rounded-lg px-2 py-1.5">
                    <div class="text-[10px] text-violet-500 font-semibold uppercase tracking-wide">Forecast</div>
                    <div class="text-violet-700 font-medium mt-0.5">{{ v.forecast || '—' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ── Constraints ────────────────────────────────────────────── -->
          <section v-if="(spec.constraints ?? []).length > 0">
            <h2 class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span aria-hidden="true">🛑</span>
              Constraints
            </h2>
            <div class="space-y-2">
              <div
                v-for="c in spec.constraints"
                :key="c.id"
                class="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3"
              >
                <p class="text-sm font-semibold text-orange-900">{{ c.description }}</p>
                <p v-if="c.scope" class="text-xs text-orange-700 mt-1">Scope: {{ c.scope }}</p>
                <p v-if="c.rationale" class="text-xs text-slate-500 mt-0.5">{{ c.rationale }}</p>
              </div>
            </div>
          </section>

          <!-- ── Solutions (architecture) ───────────────────────────────── -->
          <section v-if="spec.solutions.length > 0">
            <h2 class="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <span aria-hidden="true">🔧</span>
              Solutions (Architecture)
            </h2>
            <div class="space-y-2">
              <div
                v-for="s in spec.solutions"
                :key="s.id"
                class="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <p class="text-sm font-semibold text-slate-800">{{ s.description }}</p>
                <p v-if="s.impact" class="text-xs text-violet-700 mt-1">Impact: {{ s.impact }}</p>
              </div>
            </div>
          </section>

          <!-- ── No gaps → all good ─────────────────────────────────────── -->
          <div
            v-if="belowGoalValues.length === 0 && spec.values.length > 0"
            class="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center"
          >
            <div class="text-2xl mb-2" aria-hidden="true">🎯</div>
            <p class="text-sm font-semibold text-emerald-800">All measured Values are at or above Goal</p>
            <p class="text-xs text-emerald-600 mt-1">No planning gaps detected in current measurements.</p>
          </div>

          <!-- ── Switch to Plan mode CTA ───────────────────────────────── -->
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-700">Switch to Plan Mode</p>
              <p class="text-xs text-slate-500 mt-0.5">Start a directed improvement plan using this model as the starting point.</p>
            </div>
            <button
              type="button"
              class="flex-shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold
                     hover:bg-indigo-700 active:scale-95 transition-colors focus:outline-none
                     focus:ring-2 focus:ring-indigo-400"
              @click="emit('switch-to-plan')"
            >
              Switch to Plan →
            </button>
          </div>

        </div>
      </ScrollContainer>
    </div>
  </Teleport>
</template>
