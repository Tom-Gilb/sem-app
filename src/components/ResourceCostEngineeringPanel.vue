<!-- UNIT_TYPE=Panel -->
<!-- ResourceCostEngineeringPanel.vue — Cost Engineering tool modal panel.
     Provides two modes for Design-to-Cost analysis:
       1. STATIC  — upfront, whole-plan cost target setting before Evo Steps.
       2. DYNAMIC — per-Evo-Step tracking of planned vs actual Cost / Value / Constraint.

     Implements Tom's directive: "COST ENGINEERING: THE TOOL, SEPARATE TOOL for
     Dynamic (Evo Step) Design to [Cost, Value, Constraint] and for initial statics
     upfront Design to [Cost, Value, Constraint]. Based on ideas in Cost Engineering."

     Rules compliance:
       - CloseDot rule: CloseDot at END of header flex + backdrop @click="close" + Escape key.
       - Single-Surface rule: caller (App.vue) registers via registerExclusiveSurface.
       - ScrollContainer wraps scrollable content.
       - DD-014 (Top-and-Bottom Navigation Mirror): Close button mirrored at bottom.
       - TwinPod-URI Access Policy: BookCoverChip receives only user-facing distribution URLs.
       - Teleport to body.

     Props:
       open  — controls visibility
       spec  — current SpecBlock (null = demo mode)

     Emits:
       close — panel dismiss (backdrop, CloseDot, Escape, or bottom Close button)
-->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import BookCoverChip from './BookCoverChip.vue'
import type { SpecBlock, REntry, VEntry, CEntry } from '../types/spec'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
}>()

const emit = defineEmits<{ close: [] }>()

// ── Tabs ──────────────────────────────────────────────────────────────────────

type CeMode = 'static' | 'dynamic'
const mode = ref<CeMode>('static')

// ── Keyboard close (Escape) ───────────────────────────────────────────────────

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', _onKey))
onUnmounted(() => window.removeEventListener('keydown', _onKey))

// ── Demo data (shown when spec is null) ───────────────────────────────────────

const DEMO_RESOURCES: REntry[] = [
  {
    id: 'R.Budget',
    type: 'Resource',
    level: 'Business',
    description: 'Total capital budget for the project',
    scale: 'USD',
    tolerable: '$600,000',
    goal: '$500,000',
    wish: '$400,000',
    status: '',
  } as REntry,
  {
    id: 'R.WorkHours.Dev',
    type: 'Resource',
    level: 'Product',
    description: 'Development engineer-hours',
    scale: 'engineer-hours',
    tolerable: '1600',
    goal: '1200',
    wish: '900',
    status: '',
  } as REntry,
]

const DEMO_VALUES: VEntry[] = [
  {
    id: 'V.SystemPerformance',
    type: 'Value',
    level: 'Product',
    description: 'Response time under full load',
    scale: '% of requests completing within 200ms',
    meter: 'Load test at 1000 concurrent users',
    tolerable: '80%',
    goal: '95%',
    wish: '99%',
    status: '',
    wishStakeholder: '',
    functionOfValue: '',
  } as VEntry,
  {
    id: 'V.UserAdoption',
    type: 'Value',
    level: 'Business',
    description: 'Active users within 90 days of launch',
    scale: 'unique logged-in users per month',
    meter: 'Auth system monthly active count',
    tolerable: '500',
    goal: '1,000',
    wish: '2,500',
    status: '',
    wishStakeholder: '',
    functionOfValue: '',
  } as VEntry,
]

const DEMO_CONSTRAINTS: CEntry[] = [
  {
    id: 'C.ComplianceDeadline',
    type: 'Constraint',
    level: 'Business',
    description: 'Legal compliance review must complete before launch',
    rationale: 'Regulatory requirement — jurisdiction-mandated audit trail',
    source: 'GDPR Art. 25',
  } as CEntry,
  {
    id: 'C.DataResidency',
    type: 'Constraint',
    level: 'Stakeholder',
    description: 'All user data must remain within EU data centres',
    rationale: 'GDPR data-residency obligation',
    source: 'GDPR Art. 44',
  } as CEntry,
]

// Demo Evo-Step cost table (Dynamic mode)
interface EvoStepCostRow {
  step: string
  plannedCost: string
  valueDelivered: string
  constraintStatus: string
  vcRatio: number
}

const DEMO_STEPS: EvoStepCostRow[] = [
  { step: 'Evo Step 1 — Core Infrastructure', plannedCost: '$120,000', valueDelivered: '38%', constraintStatus: 'Passed', vcRatio: 2.4 },
  { step: 'Evo Step 2 — User Auth + Onboarding', plannedCost: '$90,000', valueDelivered: '22%', constraintStatus: 'Passed', vcRatio: 1.8 },
  { step: 'Evo Step 3 — Performance Tuning', plannedCost: '$60,000', valueDelivered: '17%', constraintStatus: 'Caution', vcRatio: 1.2 },
  { step: 'Evo Step 4 — Compliance Audit', plannedCost: '$80,000', valueDelivered: '7%', constraintStatus: 'At Risk', vcRatio: 0.6 },
]

// ── Spec-derived data (or demo fallback) ─────────────────────────────────────

const resources = computed<REntry[]>(() =>
  (props.spec?.resources?.length ? props.spec.resources : DEMO_RESOURCES) as REntry[]
)

const values = computed<VEntry[]>(() =>
  (props.spec?.values?.length ? props.spec.values : DEMO_VALUES) as VEntry[]
)

const constraints = computed<CEntry[]>(() =>
  (props.spec?.constraints?.length ? props.spec.constraints : DEMO_CONSTRAINTS) as CEntry[]
)

const usingDemoData = computed(() => !props.spec)

// ── VDT colour helper (Dynamic mode) ─────────────────────────────────────────

function ratioColorClass(ratio: number): string {
  if (ratio >= 2.0) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (ratio >= 1.0) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function ratioLabel(ratio: number): string {
  if (ratio >= 2.0) return 'Excellent'
  if (ratio >= 1.0) return 'Good'
  return 'Poor'
}

function constraintStatusClass(status: string): string {
  if (status === 'Passed') return 'text-emerald-700'
  if (status === 'Caution') return 'text-amber-600'
  return 'text-red-600'
}

// ── Cost implication note for constraints (demo) ─────────────────────────────

function constraintCostNote(id: string): string {
  const notes: Record<string, string> = {
    'C.ComplianceDeadline': '+$50,000 for legal review sprint',
    'C.DataResidency': '+$20,000 for EU region infrastructure surcharge',
  }
  return notes[id] ?? 'Review cost implication with owner'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ce-panel">
      <div v-if="open" class="fixed inset-0 z-[700] flex items-center justify-center p-4">

        <!-- Backdrop — click outside to close (CloseDot rule) -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="emit('close')"
        />

        <!-- Panel — centred, max 860px wide, max 90vh tall -->
        <div
          class="relative z-10 w-full max-w-[860px] max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ce-panel-title"
          @click.stop
        >

          <!-- ── HEADER ───────────────────────────────────────────────── -->
          <div class="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 px-5 py-3 flex-shrink-0">

            <!-- Row 1: icon + title + CloseDot -->
            <div class="flex items-center gap-3">
              <!-- Cost Engineering icon — keyed glyph [Cost→Value] using bracket + arrow notation -->
              <span
                class="flex-shrink-0 text-amber-400 font-mono font-bold leading-none select-none"
                :style="{ fontSize: '18px' }"
                aria-hidden="true"
                title="Cost Engineering: Design to [Cost · Value · Constraint]"
              >[$→*]</span>

              <div class="flex-1 min-w-0">
                <h2
                  id="ce-panel-title"
                  class="text-[15px] font-bold text-white leading-snug"
                >Cost Engineering Tool</h2>
                <p class="text-[10px] text-amber-300/80 leading-snug mt-0.5">
                  Design to [Cost · Value · Constraint]&nbsp;—&nbsp;Gilb Cost Engineering
                </p>
              </div>

              <!-- CloseDot at END of flex header (CloseDot rule — size lg for visibility) -->
              <CloseDot
                variant="on-dark"
                size="lg"
                aria-label="Close Cost Engineering Tool"
                title="Close [$→]"
                @click="emit('close')"
              />
            </div>

            <!-- Row 2: mode tabs -->
            <div class="mt-3 flex items-center">
              <div class="rounded-lg p-1 bg-slate-800 flex gap-1">
                <button
                  type="button"
                  :class="[
                    'px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                    mode === 'static'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700',
                  ]"
                  title="Static (Upfront) — set cost targets before Evo Steps begin"
                  @click="mode = 'static'"
                >Static (Upfront)</button>
                <button
                  type="button"
                  :class="[
                    'px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                    mode === 'dynamic'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700',
                  ]"
                  title="Dynamic (Evo Step) — per-step cost vs value tracking"
                  @click="mode = 'dynamic'"
                >Dynamic (Evo Step)</button>
              </div>
              <span v-if="usingDemoData" class="ml-3 text-[10px] text-amber-300/70 italic">
                Demo data — load a Spec to use live values
              </span>
            </div>
          </div>

          <!-- ── SCROLLABLE BODY ──────────────────────────────────────── -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 bg-white relative"
            inner-class="p-5 space-y-5"
            fade-from="white"
            no-pill
          >

            <!-- ════════════════════════════════════════════════════════
                 TAB 1: STATIC — Upfront Design to Cost
                 ════════════════════════════════════════════════════════ -->
            <template v-if="mode === 'static'">

              <!-- Description -->
              <div class="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p class="text-[12px] text-amber-900 leading-relaxed">
                  <strong>Upfront Design-to-Cost:</strong> Define cost targets for the whole plan
                  before Evo Steps begin. For each Value and Resource entry, specify what cost is
                  acceptable. Design Solutions to fit within those constraints.
                </p>
              </div>

              <!-- ── Design-to-Cost Targets (R. entries) ──────────── -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Design-to-Cost Targets&nbsp;·&nbsp;R. Resource Entries
                </h3>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-slate-100">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[200px]">Resource ID</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Scale</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Current Goal</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Tolerable (Max)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in resources"
                      :key="r.id"
                      class="hover:bg-amber-50/60 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 font-mono text-[11px] text-amber-800 font-semibold">{{ r.id }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-700">{{ (r as any).scale || '—' }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-emerald-700 font-semibold">{{ (r as any).goal || '—' }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-red-600">{{ (r as any).tolerable || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── Value Delivery within Budget (V. entries) ───── -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Value Delivery within Budget&nbsp;·&nbsp;V. Entries
                </h3>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-slate-100">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[220px]">Value ID</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Goal Level</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Est. Achievable Within Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="v in values"
                      :key="v.id"
                      class="hover:bg-amber-50/60 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 font-mono text-[11px] text-violet-800 font-semibold">{{ v.id }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-700">{{ v.goal || '—' }}</td>
                      <!-- Demo: show approximate achievability; real data would come from analysis -->
                      <td class="border border-slate-200 px-3 py-2">
                        <span class="text-amber-700 font-semibold">
                          {{ usingDemoData ? (v.id === 'V.SystemPerformance' ? '87% of Goal' : '72% of Goal') : 'Run analysis →' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── Constraint Check (C. entries with cost implications) -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Constraint Check&nbsp;·&nbsp;C. Entries with Cost Implications
                </h3>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-slate-100">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[200px]">Constraint ID</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Binary</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Cost Implication</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="c in constraints"
                      :key="c.id"
                      class="hover:bg-red-50/40 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 font-mono text-[11px] text-red-800 font-semibold">{{ c.id }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-red-600 font-semibold">YES / NO</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-600 italic">{{ constraintCostNote(c.id) }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── Gilb Citation (Static) ─────────────────────── -->
              <section class="border-t border-slate-200 pt-4">
                <p class="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">Source: Gilb Cost Engineering</p>
                <BookCoverChip
                  title="Cost Engineering"
                  short-title="Cost Eng"
                  :author="'Tom Gilb'"
                  year="2005"
                  cover-color="#1e3a5f"
                  research-gate-url="https://www.researchgate.net/profile/Tom-Gilb"
                />
              </section>

            </template>

            <!-- ════════════════════════════════════════════════════════
                 TAB 2: DYNAMIC — Evo Step Design to Cost
                 ════════════════════════════════════════════════════════ -->
            <template v-else>

              <!-- Description -->
              <div class="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p class="text-[12px] text-amber-900 leading-relaxed">
                  <strong>Per-Evo-Step Design-to-Cost:</strong> Track planned vs actual Cost,
                  Value delivery, and Constraint compliance for each Evo Step. VDT-style ranking:
                  prioritise steps with highest Value/Cost ratio.
                </p>
              </div>

              <!-- ── Per-Step Cost Table ──────────────────────────── -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Evo Step Cost vs Value Delivered
                </h3>
                <table class="w-full border-collapse text-[12px]">
                  <thead>
                    <tr class="bg-slate-100">
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600">Evo Step</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[110px]">Planned Cost</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[120px]">Value Delivered</th>
                      <th class="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-[110px]">Constraint Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in DEMO_STEPS"
                      :key="row.step"
                      class="hover:bg-amber-50/60 transition-colors"
                    >
                      <td class="border border-slate-200 px-3 py-2 text-slate-800 font-medium">{{ row.step }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-slate-700 font-mono">{{ row.plannedCost }}</td>
                      <td class="border border-slate-200 px-3 py-2 text-violet-700 font-semibold">{{ row.valueDelivered }}</td>
                      <td
                        class="border border-slate-200 px-3 py-2 font-semibold"
                        :class="constraintStatusClass(row.constraintStatus)"
                      >{{ row.constraintStatus }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <!-- ── VDT Ranking ─────────────────────────────────── -->
              <section>
                <h3 class="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                  VDT Ranking&nbsp;·&nbsp;Value / Cost Ratio
                  <span class="ml-2 text-[10px] text-slate-400 font-normal normal-case tracking-normal">
                    ≥2.0 = Excellent&nbsp;·&nbsp;1.0–1.9 = Good&nbsp;·&nbsp;&lt;1.0 = Poor
                  </span>
                </h3>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="row in [...DEMO_STEPS].sort((a, b) => b.vcRatio - a.vcRatio)"
                    :key="row.step + '-vdt'"
                    class="flex items-center gap-3 rounded-md border px-3 py-2"
                    :class="ratioColorClass(row.vcRatio)"
                  >
                    <span class="font-mono text-[13px] font-bold w-10 text-right flex-shrink-0">
                      {{ row.vcRatio.toFixed(1) }}
                    </span>
                    <span class="text-[11px] font-semibold flex-shrink-0 w-16">
                      {{ ratioLabel(row.vcRatio) }}
                    </span>
                    <span class="text-[11px] flex-1 min-w-0 truncate">{{ row.step }}</span>
                  </div>
                </div>
              </section>

              <!-- ── DEEP Principle note ─────────────────────────── -->
              <section class="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p class="text-[11px] text-slate-600 leading-relaxed">
                  <strong class="text-slate-800">DEEP Principle:</strong> Resources can be traded
                  off across Evo Steps — spending more on an early infrastructure step may unlock
                  substantially higher Value in later steps. A low V/C ratio in one step does not
                  automatically mean de-prioritise it: evaluate the cascade effect on dependent steps.
                </p>
              </section>

              <!-- ── Gilb Citation (Dynamic) ────────────────────── -->
              <section class="border-t border-slate-200 pt-4">
                <p class="text-[10px] text-slate-400 mb-2 font-semibold uppercase tracking-wide">Source: Gilb Cost Engineering</p>
                <BookCoverChip
                  title="Cost Engineering"
                  short-title="Cost Eng"
                  :author="'Tom Gilb'"
                  year="2005"
                  cover-color="#1e3a5f"
                  research-gate-url="https://www.researchgate.net/profile/Tom-Gilb"
                />
              </section>

            </template>

            <!-- ── Bottom Close mirror (DD-014 — Top-and-Bottom Navigation Mirror) -->
            <div class="border-t border-slate-200 pt-4 flex justify-end">
              <button
                type="button"
                class="px-5 py-2 rounded-lg bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-700 transition-colors"
                title="Close Cost Engineering Tool [$→]"
                @click="emit('close')"
              >Close [$→]</button>
            </div>

          </ScrollContainer>
          <!-- end ScrollContainer -->

        </div>
        <!-- end panel -->

      </div>
      <!-- end fixed overlay -->
    </Transition>
  </Teleport>
</template>

<style scoped>
.ce-panel-enter-active,
.ce-panel-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.ce-panel-enter-from,
.ce-panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
</style>
