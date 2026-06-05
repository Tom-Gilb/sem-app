<!-- UNIT_TYPE=Panel -->
<!--
/**
 * PlanHealthTargetPanel — Plan Health TARGET window (Tom 2026-06-03, decision B).
 *
 * Sibling of PlanHealthStatusPanel (current measured PHI) and
 * PlanHealthAdminPanel (weights / notification policy / audit log).
 *
 * THIS panel answers: "Where are we AIMING — and how big is the gap?"
 *
 * SOURCE: Tom Gilb 2026-05-27 ratified 2026-06-03: *"the missing words Target
 * and Administration are vital."*  Administration shipped at #202.b in 2026-05.
 * Status shipped at #202.c in 2026-05.  TARGET ships today — Tom chose
 * option B (keep Status + add Target tile, since Planguage Status / Target /
 * Administration are three genuinely distinct concepts that each deserve
 * their own at-a-glance tile).
 *
 * Content:
 *   - Headline: current PHI vs the threshold target — colour-coded gap
 *   - Per-V.entry target table — Status | Tolerable | Goal | Wish | Gap chip
 *   - Aggregate stats: N at Goal · N below Tolerable · N missing target fields
 *   - Cross-links to Admin (threshold setting) + Status (current values)
 *
 * Rules complied with:
 *   - Single-Surface: caller registers `planHealthTarget` exclusive surface
 *   - ScrollContainer: body wrapped
 *   - CloseDot: header end-of-flex
 *   - Planguage-Glyph-First: emoji in header label, no inline SVG icons in buttons
 *   - Interaction Disclosure: every clickable has :title
 *   - AI-Max: this panel is deterministic (reads spec + admin spec) — no AI calls
 *
 * v1 ships display + cross-link navigation.  Editing the V.entry targets
 * happens in the Spec Editor (PlanTargetsPanel exists for that purpose).
 * Threshold editing happens in the Administration panel.  This panel is
 * the READ-ONLY target dashboard — same role Status plays for measurement.
 */
-->
<script setup lang="ts">
import { computed } from 'vue'
import {
  useSpecHealth,
  type IndexBreakdown,
  type SpecHealthContext,
  type PlanHealthContext,
} from '../composables/useSpecHealth'
import type { SpecBlock, VEntry } from '../types/spec'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'

const props = defineProps<{
  planModelId: string
  spec: SpecBlock
  specOwnerCount: number
  hasSpecOwner: boolean
  hasPlanOwner?: boolean  // @deprecated: use hasSpecOwner
  /** Spec display name — header */
  planName?: string
}>()

const emit = defineEmits<{
  close: []
  /** User clicked the "Administer threshold" affordance — parent opens Admin panel. */
  'open-admin': []
  /** User clicked the "View current Status" affordance — parent opens Status panel. */
  'open-status': []
  /** User clicked a V.entry row — parent opens the Spec Editor focused on that V. */
  'open-value-edit': [valueId: string]
}>()

const ph = useSpecHealth(props.planModelId)

const ctx = computed<SpecHealthContext>(() => ({
  spec: props.spec,
  specOwnerCount: props.specOwnerCount,
  hasSpecOwner: props.hasSpecOwner ?? props.hasPlanOwner ?? false,
}))

const breakdown = computed<IndexBreakdown>(() => ph.computeBreakdown(ctx.value))

/** PHI threshold the Admin spec defines (default 50) — the line below which
 *  the Plan Health Badge starts vibrating to signal trouble. */
const threshold = computed<number>(() => ph.custom.value.threshold)

/** Gap: current PHI minus threshold.  Positive = healthy (above target),
 *  zero = on target, negative = below target (alert). */
const phiGap = computed<number>(() => breakdown.value.index - threshold.value)

/** Status colour for the headline gap — same scale as the Status panel badge. */
const gapColour = computed<{ tint: string; text: string; label: string }>(() => {
  const g = phiGap.value
  if (g >= 20) return { tint: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', label: 'Well above target' }
  if (g >= 0) return  { tint: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600', label: 'At or above target' }
  if (g >= -20) return { tint: 'bg-amber-50 border-amber-300', text: 'text-amber-700', label: 'Approaching target (below)' }
  return { tint: 'bg-red-50 border-red-300', text: 'text-red-700', label: 'Below target — alert' }
})

// ── Per-V.entry target table ─────────────────────────────────────────────────
//
// For each V. in the spec, classify against its own thresholds:
//   missing = no Goal field
//   below-tolerable = current Status quantitatively below Tolerable
//   below-goal      = above Tolerable but below Goal
//   at-goal         = at or above Goal
//   at-wish         = at or above Wish (stretch)

type TargetState = 'missing' | 'below-tolerable' | 'below-goal' | 'at-goal' | 'at-wish'

interface VEntryTargetRow {
  v: VEntry
  state: TargetState
  /** Display label for the state. */
  stateLabel: string
  /** Tailwind classes for the state chip. */
  stateClasses: string
}

/** Parse a numeric leading value out of a Planguage field, e.g. "85%" → 85.
 *  Returns null when the field is empty or non-numeric (Planguage fields are
 *  free-text, so not every Goal/Tolerable/Status will parse). */
function _num(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

const targetRows = computed<VEntryTargetRow[]>(() =>
  props.spec.values.map(v => {
    const cur = _num(v.status)
    const tol = _num(v.tolerable)
    const goal = _num(v.goal)
    const wish = _num(v.wish)

    let state: TargetState = 'missing'
    let stateLabel = 'no Goal'
    let stateClasses = 'bg-slate-100 text-slate-500 border-slate-300'

    if (!v.goal?.trim()) {
      state = 'missing'
      stateLabel = '⚠ no Goal'
      stateClasses = 'bg-slate-100 text-slate-500 border-slate-300'
    } else if (cur == null || goal == null) {
      // Non-numeric — can't quantitatively compare; mark as ambiguous
      state = 'below-goal'
      stateLabel = '? non-numeric'
      stateClasses = 'bg-slate-100 text-slate-600 border-slate-300'
    } else if (wish != null && cur >= wish) {
      state = 'at-wish'
      stateLabel = '⭐ at Wish'
      stateClasses = 'bg-violet-100 text-violet-700 border-violet-300'
    } else if (cur >= goal) {
      state = 'at-goal'
      stateLabel = '✓ at Goal'
      stateClasses = 'bg-emerald-100 text-emerald-700 border-emerald-300'
    } else if (tol != null && cur < tol) {
      state = 'below-tolerable'
      stateLabel = '✗ below Tolerable'
      stateClasses = 'bg-red-100 text-red-700 border-red-300'
    } else {
      state = 'below-goal'
      stateLabel = '↗ below Goal'
      stateClasses = 'bg-amber-100 text-amber-700 border-amber-300'
    }

    return { v, state, stateLabel, stateClasses }
  }),
)

// ── Aggregate stats ──────────────────────────────────────────────────────────
const totalValues = computed<number>(() => targetRows.value.length)
const atGoalCount = computed<number>(() => targetRows.value.filter(r => r.state === 'at-goal' || r.state === 'at-wish').length)
const belowTolerableCount = computed<number>(() => targetRows.value.filter(r => r.state === 'below-tolerable').length)
const missingTargetCount = computed<number>(() => targetRows.value.filter(r => r.state === 'missing').length)
const atWishCount = computed<number>(() => targetRows.value.filter(r => r.state === 'at-wish').length)
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phi-target-title"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header — gradient to differentiate from Status (indigo→violet) and Admin (slate gradient).
             Target panel uses emerald→teal so the three siblings are visually distinct. -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">🎯</span>
          <div class="flex-1 min-w-0">
            <h2 id="phi-target-title" class="text-base font-bold">
              Spec Health Target
              <span v-if="planName" class="text-[11px] font-normal text-emerald-100 ml-1">· {{ planName }}</span>
            </h2>
            <p class="text-[11px] text-emerald-100 mt-0.5">
              Where you're aiming · gap to threshold · V.-by-V. target progress
            </p>
          </div>
          <CloseDot variant="on-dark" aria-label="Close Spec Health Target" @click="emit('close')" />
        </header>

        <!-- Body -->
        <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-5 space-y-5">

          <!-- Headline gap card -->
          <section
            class="rounded-2xl border-2 p-4"
            :class="gapColour.tint"
          >
            <p class="text-[10px] font-bold uppercase tracking-wider mb-1" :class="gapColour.text">
              Spec Health Index vs Threshold
            </p>
            <div class="flex items-baseline gap-3 flex-wrap">
              <span class="text-3xl font-extrabold text-slate-900">{{ breakdown.index }}%</span>
              <span class="text-sm text-slate-500">current</span>
              <span class="text-slate-400 text-sm">vs</span>
              <span class="text-2xl font-bold text-slate-700">{{ threshold }}%</span>
              <span class="text-sm text-slate-500">target threshold</span>
              <div class="ml-auto">
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border" :class="[gapColour.tint, gapColour.text]">
                  {{ phiGap >= 0 ? '+' : '' }}{{ phiGap }} · {{ gapColour.label }}
                </span>
              </div>
            </div>
            <p class="text-[11px] text-slate-600 mt-2">
              Threshold is the line below which the Spec Health Badge starts vibrating.  Edit in
              <button type="button" class="text-emerald-700 underline hover:text-emerald-900 font-semibold" title="Open Spec Health Administration to change the threshold" @click="emit('open-admin')">⚙️ Spec Health Administration</button>.
              Current PHI lives in
              <button type="button" class="text-emerald-700 underline hover:text-emerald-900 font-semibold" title="Open Spec Health Status to see the live PHI + history graph" @click="emit('open-status')">📊 Spec Health Status</button>.
            </p>
          </section>

          <!-- Aggregate stats -->
          <section class="grid grid-cols-4 gap-3">
            <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
              <p class="text-2xl font-extrabold text-emerald-700">{{ atGoalCount }}<span class="text-sm text-emerald-500">/{{ totalValues }}</span></p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mt-0.5">at Goal</p>
            </div>
            <div class="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-center">
              <p class="text-2xl font-extrabold text-violet-700">{{ atWishCount }}<span class="text-sm text-violet-500">/{{ totalValues }}</span></p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-violet-700 mt-0.5">at Wish (stretch)</p>
            </div>
            <div class="rounded-xl border border-red-200 bg-red-50/60 p-3 text-center">
              <p class="text-2xl font-extrabold text-red-700">{{ belowTolerableCount }}<span class="text-sm text-red-500">/{{ totalValues }}</span></p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-red-700 mt-0.5">below Tolerable</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
              <p class="text-2xl font-extrabold text-slate-700">{{ missingTargetCount }}<span class="text-sm text-slate-500">/{{ totalValues }}</span></p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-slate-700 mt-0.5">missing Goal</p>
            </div>
          </section>

          <!-- Per-V.entry target table -->
          <section v-if="targetRows.length > 0" class="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wide text-slate-700">Per-Value Target Progress</h3>
              <p class="text-[10px] text-slate-500">Click any row to edit the Goal / Tolerable / Wish in the Spec Editor</p>
            </header>
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wide">
                  <th class="text-left px-3 py-1.5">Value</th>
                  <th class="text-left px-2 py-1.5">Current</th>
                  <th class="text-left px-2 py-1.5">Tolerable</th>
                  <th class="text-left px-2 py-1.5">Goal</th>
                  <th class="text-left px-2 py-1.5">Wish</th>
                  <th class="text-right px-3 py-1.5">State</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in targetRows"
                  :key="row.v.id"
                  class="border-t border-slate-100 hover:bg-emerald-50/30 transition-colors cursor-pointer"
                  :title="`Edit ${row.v.id} target fields in the Spec Editor`"
                  @click="emit('open-value-edit', row.v.id)"
                >
                  <td class="px-3 py-2 font-mono text-emerald-700 font-bold truncate max-w-[180px]" :title="row.v.description">{{ row.v.id }}</td>
                  <td class="px-2 py-2 text-slate-700">{{ row.v.status || '—' }}</td>
                  <td class="px-2 py-2 text-slate-600">{{ row.v.tolerable || '—' }}</td>
                  <td class="px-2 py-2 text-slate-700 font-semibold">{{ row.v.goal || '—' }}</td>
                  <td class="px-2 py-2 text-violet-700 italic">{{ row.v.wish || '—' }}</td>
                  <td class="px-3 py-2 text-right">
                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border" :class="row.stateClasses">{{ row.stateLabel }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- Empty-state -->
          <div v-else class="text-center text-slate-500 py-12">
            <p class="text-sm">No Values in this spec yet — add Value Specs via the Spec Editor.</p>
          </div>

          <!-- Methodology footer -->
          <p class="text-[10px] text-slate-400 italic text-center pt-2">
            Planguage: <span class="font-semibold">Tolerable</span> = minimum acceptable · <span class="font-semibold">Goal</span> = target / acceptable success · <span class="font-semibold">Wish</span> = aspirational stretch.  All three are first-class Value Spec fields.
          </p>
        </ScrollContainer>

      </div>
    </div>
  </Teleport>
</template>
