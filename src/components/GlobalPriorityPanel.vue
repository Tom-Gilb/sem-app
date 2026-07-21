<!-- UNIT_TYPE=Widget -->
<!-- GlobalPriorityPanel.vue — Feature #201: Global Priority
     Higher-level prioritisation panel. Three sequential layers (Stakeholders,
     Values·Costs·Constraints, Solutions) plus a Review stage that shows the
     consequence diff (mirroring the SharpenPanel pattern).

     Activated from the Detail menu's Plan group ("⚖️ Global Priority").
     Registered with `registerExclusiveSurface('globalPriority', open)` so it
     auto-closes any other open full-screen surface.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  useGlobalPriority,
  GLOBAL_PRIORITY_SUGGESTIONS,
  LAYER_LABEL,
  LAYER_ICON,
  LAYER_HINT,
  CONSTRAINT_LABEL,
  analyseDilemmas,
  buildValueProgress,
  seedPlannerConversation,
  type PriorityLayer,
  type Ranking,
  type RankingSet,
  type ConstraintKind,
  type PrioritisationConstraint,
  type ConsequenceDiffEntry,
  type BudgetState,
  type Dilemma,
} from '../composables/useGlobalPriority'
import type { SpecBlock } from '../types/spec'
import type { SpecOwner } from '../composables/useSpecModel'
import RightPanel from './RightPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'

// ── Props / emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  planModelId: string
  spec: SpecBlock
  specOwners: SpecOwner[]
}>()

const emit = defineEmits<{
  close: []
  /** Fired when the user clicks the `?` info affordance on the Priority glyph
   *  in the header. The parent (App.vue) opens the PriorityInfoPanel modal. */
  'open-priority-info': []
}>()

const {
  getLayerRecord,
  upsertLayerRecord,
  addConstraint,
  removeConstraint,
  validate,
  applyLayer,
  layerCounts,
} = useGlobalPriority(props.planModelId)

// ── Stage state ───────────────────────────────────────────────────────────────

// Tab labels are deliberately short — at the panel's clamp(560,42vw,720) width,
// five tabs at full labels ("Values · Costs · Constraints", "Replan after Evo")
// overflowed the right edge, hiding "Review & Apply" and "Replan after Evo" on
// many viewports. Each tab carries a full-text HoverHint; the active tab also
// shows the long form in the body's layer-hint strip.
const STAGES: Array<{ key: PriorityLayer | 'review' | 'replan'; label: string; longLabel: string; icon: string }> = [
  { key: 'stakeholders',             label: 'Stakeholders',         longLabel: LAYER_LABEL['stakeholders'],             icon: LAYER_ICON['stakeholders'] },
  { key: 'values-costs-constraints', label: 'Values · Costs · Constraints', longLabel: LAYER_LABEL['values-costs-constraints'], icon: LAYER_ICON['values-costs-constraints'] },
  { key: 'solutions',                label: 'Solutions',             longLabel: LAYER_LABEL['solutions'],                icon: LAYER_ICON['solutions'] },
  { key: 'review',                   label: 'Review',                longLabel: 'Review & Apply',                        icon: '✅' },
  { key: 'replan',                   label: 'Replan',                longLabel: 'Replan after Evo',                      icon: '🔄' },
]
const activeStage = ref<PriorityLayer | 'review' | 'replan'>('stakeholders')

// ── Replan-after-Evo stage state (Planguage-fidelity priority) ───────────────
//
// Per Tom's design note: primary Planguage prioritisation is reaching Value
// Wishes within ALL constraints (binary + scalar Budgets + remaining resources
// from initial budgets). After Evo step feedback we surface real dilemmas and
// seed a planner conversation. Budgets are user-edited inline for the MVP;
// later they'll be sourced from the EvoPlan resource log.

const BUDGET_STORAGE_KEY = 'sem-global-priority-budgets'

function loadBudgets(): BudgetState[] {
  try {
    const raw = localStorage.getItem(`${BUDGET_STORAGE_KEY}:${props.planModelId}`)
    return raw ? JSON.parse(raw) : defaultBudgets()
  } catch { return defaultBudgets() }
}
function defaultBudgets(): BudgetState[] {
  return [
    { name: 'Calendar weeks', initialAmount: 12,    remainingAmount: 12,    unit: 'weeks' },
    { name: 'Engineer-weeks', initialAmount: 24,    remainingAmount: 24,    unit: 'eng-wks' },
    { name: 'Money',          initialAmount: 50000, remainingAmount: 50000, unit: 'USD' },
  ]
}
const budgets = ref<BudgetState[]>(loadBudgets())
function persistBudgets(): void {
  try { localStorage.setItem(`${BUDGET_STORAGE_KEY}:${props.planModelId}`, JSON.stringify(budgets.value)) } catch {}
}
watch(budgets, persistBudgets, { deep: true })

const valueProgress = computed(() => buildValueProgress(props.spec.values))

// ── User-driven value-progress overrides (Tom 2026-05-13, "Kai's idea" — sliders
//    on existing values and budgets as one more way to adjust priorities). The
//    user can drag a 0–100% slider beside each Value to override the auto-computed
//    `goalAccomplishment`; the dilemma analyser then re-runs against the
//    overridden progress, surfacing different priority dilemmas live. Persisted
//    per plan-model in localStorage so the sliders survive panel close + reopen.
const VALUE_OVERRIDE_KEY = 'sem-global-priority-value-overrides'
function loadValueOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${VALUE_OVERRIDE_KEY}:${props.planModelId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
const valueOverrides = ref<Record<string, number>>(loadValueOverrides())
function persistValueOverrides(): void {
  try { localStorage.setItem(`${VALUE_OVERRIDE_KEY}:${props.planModelId}`, JSON.stringify(valueOverrides.value)) } catch {}
}
watch(valueOverrides, persistValueOverrides, { deep: true })

/** Effective progress = auto-computed progress with any user slider override applied. */
const valueProgressEffective = computed(() =>
  valueProgress.value.map((p) =>
    valueOverrides.value[p.valueId] !== undefined
      ? { ...p, goalAccomplishment: valueOverrides.value[p.valueId] }
      : p,
  ),
)
function resetValueOverride(valueId: string): void {
  const next = { ...valueOverrides.value }
  delete next[valueId]
  valueOverrides.value = next
}

const dilemmas      = computed<Dilemma[]>(() => analyseDilemmas(props.spec, budgets.value, { progressOverrides: valueProgressEffective.value }))
const conversationSeed = computed(() => seedPlannerConversation(dilemmas.value, budgets.value, valueProgressEffective.value))

const seedCopied = ref(false)
async function copyConversationSeed(): Promise<void> {
  try {
    await navigator.clipboard.writeText(conversationSeed.value)
    seedCopied.value = true
    setTimeout(() => { seedCopied.value = false }, 1500)
  } catch { /* clipboard blocked — UI already shows the seed inline */ }
}

/** True only on the 3 ranking layers — used to gate the rank-list / constraint editor / metadata blocks */
const isLayerStage = computed(() => activeStage.value !== 'review' && activeStage.value !== 'replan')

const DILEMMA_TONE: Record<Dilemma['kind'], { ring: string; chip: string; label: string }> = {
  'value-shortfall':     { ring: 'border-rose-200    bg-rose-50/40',    chip: 'bg-rose-100    text-rose-700',    label: 'Value shortfall'   },
  'wish-vs-budget':      { ring: 'border-amber-200   bg-amber-50/40',   chip: 'bg-amber-100   text-amber-700',   label: 'Wish vs budget'    },
  'budget-overrun':      { ring: 'border-orange-200  bg-orange-50/40',  chip: 'bg-orange-100  text-orange-700',  label: 'Budget overrun'    },
  'rebalance':           { ring: 'border-violet-200  bg-violet-50/40',  chip: 'bg-violet-100  text-violet-700',  label: 'Rebalance'         },
  'untouchable-blocked': { ring: 'border-slate-300   bg-slate-50',      chip: 'bg-slate-200   text-slate-700',   label: 'Untouchable block' },
}

// ── Build the candidate target lists per layer from props.spec ────────────────

const stakeholderCandidates = computed<string[]>(() => {
  // Spec owners + any wishStakeholder mentions across V. entries
  const set = new Set<string>()
  for (const o of props.specOwners) if (o.name) set.add(o.name)
  for (const v of props.spec.values) if (v.wishStakeholder) set.add(v.wishStakeholder)
  return Array.from(set).sort()
})

const valuesCostsConstraintsCandidates = computed<Array<{ id: string; label: string; kind: 'V' | 'cost' | 'constraint' | 'category' }>>(() => {
  // The 3 meta-categories first, then each V. entry
  const out: Array<{ id: string; label: string; kind: 'V' | 'cost' | 'constraint' | 'category' }> = [
    { id: 'category:Values',      label: '💎 Values (category weight)',      kind: 'category' },
    { id: 'category:Costs',       label: '💰 Costs (category weight)',       kind: 'category' },
    { id: 'category:Constraints', label: '🚧 Constraints (category weight)', kind: 'category' },
  ]
  for (const v of props.spec.values) out.push({ id: v.id, label: v.id, kind: 'V' })
  return out
})

const solutionCandidates = computed<Array<{ id: string; label: string }>>(() =>
  props.spec.solutions.map(s => ({ id: s.id, label: s.id })),
)

// ── Working drafts per layer (loaded from persisted record on stage change) ──

interface LayerDraft {
  rankings: Ranking[]
  sets: RankingSet[]
  source: string
  authority: string
  purposes: string
}

function _initDraft(layer: PriorityLayer): LayerDraft {
  const rec = getLayerRecord(layer)
  if (rec) return { rankings: [...rec.rankings], sets: [...rec.sets], source: rec.source, authority: rec.authority, purposes: rec.purposes }

  // Seed with candidates ranked 1..N at equal weight
  let seedRankings: Ranking[] = []
  if (layer === 'stakeholders') {
    seedRankings = stakeholderCandidates.value.map((name, i) => ({
      targetId: name, targetKind: 'stakeholder', rank: i + 1, weight: undefined,
    }))
  } else if (layer === 'values-costs-constraints') {
    const cats = valuesCostsConstraintsCandidates.value
    const catWeight = Math.floor(100 / 3)
    seedRankings = cats.map((c, i) => ({
      targetId: c.id,
      targetKind: c.kind === 'category' ? 'category' : 'V',
      rank: i + 1,
      weight: c.kind === 'category' ? catWeight : undefined,
    }))
  } else if (layer === 'solutions') {
    seedRankings = solutionCandidates.value.map((s, i) => ({
      targetId: s.id, targetKind: 'S', rank: i + 1, weight: undefined,
    }))
  }
  return { rankings: seedRankings, sets: [], source: '', authority: '', purposes: '' }
}

const draftStakeholders = ref<LayerDraft>(_initDraft('stakeholders'))
const draftVCC          = ref<LayerDraft>(_initDraft('values-costs-constraints'))
const draftSolutions    = ref<LayerDraft>(_initDraft('solutions'))

// Tom 2026-05-13: "the 2 values on the plan did not show up in the priorities."
// Root cause: drafts were seeded ONCE on panel mount from the spec snapshot at
// that moment. If the user later added Values / Solutions / Stakeholders to the
// spec (or the panel was opened with a freshly-loaded plan), the new entries
// never made it into the V·C·C / Solutions / Stakeholders draft. Persisted
// records also stayed frozen with their original rankings.
//
// Fix: watch the candidate computeds and merge any newly-appearing target into
// the corresponding draft at the bottom of the list, preserving existing
// rank/weight overrides. Removed entries are dropped. This runs every time the
// spec, specOwners prop, or candidate set changes — keeping the panel in sync
// without clobbering user-made rank choices.
function _mergeCandidatesIntoDraft(
  draft: LayerDraft,
  candidateIds: string[],
  buildSeed: (id: string, rank: number) => Ranking,
): void {
  // 1. Drop rankings whose target no longer exists in the spec
  draft.rankings = draft.rankings.filter(r => candidateIds.includes(r.targetId))
  // 2. Append any newly-introduced target at the end with a sensible default
  const existingIds = new Set(draft.rankings.map(r => r.targetId))
  let nextRank = draft.rankings.length
  for (const id of candidateIds) {
    if (existingIds.has(id)) continue
    nextRank += 1
    draft.rankings.push(buildSeed(id, nextRank))
  }
}

watch(stakeholderCandidates, (cands) => {
  _mergeCandidatesIntoDraft(draftStakeholders.value, cands, (id, rank) => ({
    targetId: id, targetKind: 'stakeholder', rank, weight: undefined,
  }))
}, { deep: true })

watch(valuesCostsConstraintsCandidates, (cands) => {
  const ids = cands.map(c => c.id)
  const byId = new Map(cands.map(c => [c.id, c]))
  _mergeCandidatesIntoDraft(draftVCC.value, ids, (id, rank) => {
    const c = byId.get(id)
    const isCategory = c?.kind === 'category'
    return {
      targetId: id,
      targetKind: isCategory ? 'category' : 'V',
      rank,
      weight: isCategory ? Math.floor(100 / 3) : undefined,
    }
  })
}, { deep: true })

watch(solutionCandidates, (cands) => {
  _mergeCandidatesIntoDraft(draftSolutions.value, cands.map(s => s.id), (id, rank) => ({
    targetId: id, targetKind: 'S', rank, weight: undefined,
  }))
}, { deep: true })

const currentDraft = computed<LayerDraft | null>(() => {
  if (activeStage.value === 'stakeholders') return draftStakeholders.value
  if (activeStage.value === 'values-costs-constraints') return draftVCC.value
  if (activeStage.value === 'solutions') return draftSolutions.value
  return null
})
const currentLayer = computed<PriorityLayer | null>(() =>
  activeStage.value === 'review' ? null : activeStage.value as PriorityLayer,
)

// ── Drag-to-reorder ──────────────────────────────────────────────────────────

const dragIndex = ref<number | null>(null)

function onDragStart(i: number): void { dragIndex.value = i }
function onDragOver(e: DragEvent): void { e.preventDefault() }
function onDrop(targetIdx: number): void {
  if (dragIndex.value == null || !currentDraft.value) return
  const from = dragIndex.value
  if (from === targetIdx) { dragIndex.value = null; return }
  const list = currentDraft.value.rankings
  const moved = list.splice(from, 1)[0]
  list.splice(targetIdx, 0, moved)
  // Renumber 1..N
  list.forEach((r, i) => { r.rank = i + 1 })
  dragIndex.value = null
}

function bumpUp(i: number): void {
  if (!currentDraft.value || i === 0) return
  const list = currentDraft.value.rankings
  ;[list[i - 1], list[i]] = [list[i], list[i - 1]]
  list.forEach((r, idx) => { r.rank = idx + 1 })
}
function bumpDown(i: number): void {
  if (!currentDraft.value) return
  const list = currentDraft.value.rankings
  if (i >= list.length - 1) return
  ;[list[i + 1], list[i]] = [list[i], list[i + 1]]
  list.forEach((r, idx) => { r.rank = idx + 1 })
}

// ── Constraint editor ────────────────────────────────────────────────────────

const showConstraintForm = ref(false)
const newConstraint = ref<{ kind: ConstraintKind; targetA: string; targetB: string; minPercent: number | null; maxPercent: number | null; note: string }>({
  kind: 'ceiling',
  targetA: '',
  targetB: '',
  minPercent: null,
  maxPercent: null,
  note: '',
})

function _resetConstraintForm(): void {
  newConstraint.value = { kind: 'ceiling', targetA: '', targetB: '', minPercent: null, maxPercent: null, note: '' }
}

function commitConstraint(): void {
  if (!currentLayer.value) return
  const c = newConstraint.value
  if (!c.targetA) return
  const targetIds = c.kind === 'order' && c.targetB ? [c.targetA, c.targetB] : [c.targetA]
  addConstraint(currentLayer.value, {
    kind: c.kind,
    targetIds,
    minPercent: c.minPercent ?? undefined,
    maxPercent: c.maxPercent ?? undefined,
    note: c.note,
  })
  _resetConstraintForm()
  showConstraintForm.value = false
}

const layerConstraints = computed<PrioritisationConstraint[]>(() => {
  if (!currentLayer.value) return []
  return getLayerRecord(currentLayer.value)?.constraints ?? []
})

// ── Validation (live as user edits) ──────────────────────────────────────────

const violations = computed<string[]>(() => {
  if (!currentLayer.value || !currentDraft.value) return []
  return validate(currentLayer.value, currentDraft.value.rankings)
})

// ── Save metadata + apply ────────────────────────────────────────────────────

function saveMetadata(): void {
  if (!currentLayer.value || !currentDraft.value) return
  upsertLayerRecord(currentLayer.value, {
    rankings: currentDraft.value.rankings,
    sets: currentDraft.value.sets,
    source: currentDraft.value.source,
    authority: currentDraft.value.authority,
    purposes: currentDraft.value.purposes,
  })
}

// Auto-save metadata on change with simple debounce
let _saveTimer: number | null = null
watch(
  () => [draftStakeholders.value, draftVCC.value, draftSolutions.value],
  () => {
    if (_saveTimer != null) window.clearTimeout(_saveTimer)
    _saveTimer = window.setTimeout(saveMetadata, 600)
  },
  { deep: true },
)

const lastApplyDiff = ref<ConsequenceDiffEntry[]>([])
const applyShownLayer = ref<PriorityLayer | null>(null)
const showDiffDetails = ref(false)

function applyAllLayers(): void {
  let lastDiff: ConsequenceDiffEntry[] = []
  let lastLayer: PriorityLayer | null = null
  for (const layer of ['stakeholders', 'values-costs-constraints', 'solutions'] as PriorityLayer[]) {
    const d = layer === 'stakeholders' ? draftStakeholders.value
            : layer === 'values-costs-constraints' ? draftVCC.value
            : draftSolutions.value
    const { diff } = applyLayer(layer, d.rankings, d.sets)
    lastDiff = [...lastDiff, ...diff]
    lastLayer = layer
  }
  lastApplyDiff.value = lastDiff
  applyShownLayer.value = lastLayer
}

const diffCounts = computed(() => {
  const c = { F: 0, V: 0, S: 0, stakeholder: 0 }
  for (const d of lastApplyDiff.value) c[d.entryKind]++
  return c
})
</script>

<template>
  <RightPanel
    class="z-[493] w-[clamp(620px,46vw,820px)] bg-white border-l border-gray-200 shadow-2xl flex flex-col"
    role="dialog"
    :aria-label="`Global Priority — ${activeStage}`"
  >
    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <!-- DD-002 (2026-05-13): the `[A>B>C]` Priority glyph is paired with a small
         `?` info affordance. Clicking it opens the "About the Priority Glyph"
         essay (PriorityInfoPanel) — the four-section explainer covering
         interpretation, invention, the Planguage theory of priority, and sources.
         The `?` button is a micro-pill that reads as a question against the
         glyph, deliberately small so it never competes with the glyph itself. -->
    <div class="px-5 py-3.5 flex items-center gap-3 shrink-0
                bg-gradient-to-r from-amber-500 to-orange-500 text-white">
      <button
        type="button"
        class="group relative inline-flex items-center shrink-0
               rounded-lg hover:bg-white/10 transition-colors px-1.5 py-0.5
               focus:outline-none focus:ring-2 focus:ring-white/40"
        aria-label="About the Priority Glyph — what [A>B>C] means"
        title="About the Priority Glyph (click for the essay)"
        @click="emit('open-priority-info')"
      >
        <PriorityTripleGlyph size="large" class="h-7 w-auto shrink-0 text-white" aria-label="" />
        <!-- DD-002 follow-up (2026-05-14): bumped from h-4 w-4 / bg-white/25 to
             h-5 w-5 / solid white pill with amber-700 glyph + white ring, because
             the prior treatment was too subtle on the amber/orange header. Tom
             reported he could not find it. New treatment reads unambiguously as
             a clickable info-badge while still staying smaller than the glyph. -->
        <span
          class="ml-1.5 inline-flex items-center justify-center
                 h-5 w-5 rounded-full bg-white group-hover:bg-amber-50
                 ring-1 ring-white/70 group-hover:ring-white shadow-sm
                 text-[11px] font-bold text-amber-700 group-hover:text-amber-800
                 leading-none transition-colors"
          aria-hidden="true"
        >?</span>
      </button>
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold tracking-wide">Global Priority</h2>
        <p class="text-[11px] text-white/80 mt-0.5">Set priority across stakeholders, values, costs, constraints and solutions — with limits.</p>
      </div>
      <CloseDot
        variant="on-dark"
        aria-label="Close Global Priority"
        @click="emit('close')"
      />
    </div>

    <!-- ── Stage tabs ───────────────────────────────────────────────────────── -->
    <!-- overflow-x-auto is a hard fallback for any viewport where the 5 tabs
         still don't fit (smaller-than-720px). Each tab has its long label as a
         HoverHint — and the active tab's long label also shows in the hint
         strip just below. -->
    <div
      class="flex border-b border-slate-200 bg-slate-50 shrink-0 px-2 pt-2 gap-1 overflow-x-auto"
      role="tablist"
      aria-label="Priority layer"
    >
      <button
        v-for="s in STAGES"
        :key="s.key"
        type="button"
        role="tab"
        :title="s.longLabel"
        :aria-selected="activeStage === s.key"
        :class="[
          'flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0',
          activeStage === s.key
            ? 'bg-white text-orange-700 border-orange-500'
            : 'text-slate-500 hover:text-slate-700 border-transparent hover:bg-white/60',
        ]"
        @click="activeStage = s.key"
      >
        <span aria-hidden="true">{{ s.icon }}</span>
        <span>{{ s.label }}</span>
        <span
          v-if="s.key !== 'review' && s.key !== 'replan'"
          class="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full
                 text-[9px] font-bold"
          :class="layerCounts[s.key as PriorityLayer].status === 'applied'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-200 text-slate-600'"
        >{{ layerCounts[s.key as PriorityLayer].ranked }}</span>
        <span
          v-else-if="s.key === 'replan' && dilemmas.length"
          class="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full
                 text-[9px] font-bold bg-rose-100 text-rose-700"
          :title="`${dilemmas.length} unresolved dilemma${dilemmas.length === 1 ? '' : 's'}`"
        >{{ dilemmas.length }}</span>
      </button>
    </div>

    <!-- ── Body ─────────────────────────────────────────────────────────────── -->
    <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-5 py-4 space-y-4">

      <!-- ── Layer hint ── -->
      <p
        v-if="isLayerStage"
        class="text-[11px] text-slate-500 italic px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
      >{{ LAYER_HINT[activeStage as PriorityLayer] }}</p>

      <!-- ── RANKING LIST (Stakeholders / V·C·C / Solutions) ── -->
      <div v-if="isLayerStage && currentDraft" class="space-y-1.5">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Drag or use ↑↓ to rank · highest first</p>
        <div
          v-for="(r, i) in currentDraft.rankings"
          :key="r.targetId"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200
                 hover:border-orange-300 hover:shadow-sm transition-all cursor-move group"
          draggable="true"
          @dragstart="onDragStart(i)"
          @dragover="onDragOver"
          @drop="onDrop(i)"
        >
          <span class="text-slate-300 text-base group-hover:text-slate-500 transition-colors" aria-hidden="true">⋮⋮</span>
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold shrink-0">{{ r.rank }}</span>
          <span class="text-sm text-slate-800 flex-1 truncate" :title="r.targetId">{{ r.targetId.replace(/^category:/, '') }}</span>
          <input
            v-if="r.weight != null"
            v-model.number="r.weight"
            type="number"
            min="0"
            max="100"
            class="w-14 h-7 px-1.5 rounded border border-slate-200 text-[11px] text-right
                   focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
            :aria-label="`Weight % for ${r.targetId}`"
          />
          <span v-if="r.weight != null" class="text-[10px] text-slate-400">%</span>
          <button
            type="button"
            class="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            :aria-label="`Move ${r.targetId} up`"
            :disabled="i === 0"
            @click="bumpUp(i)"
          >↑</button>
          <button
            type="button"
            class="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            :aria-label="`Move ${r.targetId} down`"
            :disabled="i === currentDraft.rankings.length - 1"
            @click="bumpDown(i)"
          >↓</button>
        </div>

        <p v-if="!currentDraft.rankings.length" class="text-[12px] text-slate-400 italic px-3 py-4 text-center">
          No targets available yet. Add stakeholders, values, or solutions in the relevant editors first.
        </p>
      </div>

      <!-- ── Live violation banner ── -->
      <div
        v-if="isLayerStage && violations.length"
        class="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 space-y-1"
        role="alert"
      >
        <p class="text-[11px] font-bold text-rose-700">⚠ Constraint violations</p>
        <ul class="text-[11px] text-rose-700 list-disc pl-5 space-y-0.5">
          <li v-for="(v, i) in violations" :key="i">{{ v }}</li>
        </ul>
      </div>

      <!-- ── Prioritisation Constraints editor ── -->
      <div v-if="isLayerStage" class="rounded-lg border border-slate-200 p-3 space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prioritisation Constraints — limits on how far this can go</p>
          <button
            type="button"
            class="text-[11px] font-semibold text-orange-600 hover:text-orange-700"
            @click="showConstraintForm = !showConstraintForm"
          >{{ showConstraintForm ? '× Cancel' : '+ Add constraint' }}</button>
        </div>

        <ul v-if="layerConstraints.length" class="space-y-1.5">
          <li
            v-for="c in layerConstraints"
            :key="c.id"
            class="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-100"
          >
            <span class="text-[10px] font-bold text-amber-800 uppercase tracking-wide shrink-0">{{ c.kind }}</span>
            <span class="text-[12px] text-slate-800 flex-1">
              {{ c.targetIds.join(' → ') }}
              <template v-if="c.minPercent != null"> · floor {{ c.minPercent }}%</template>
              <template v-if="c.maxPercent != null"> · ceiling {{ c.maxPercent }}%</template>
              <span v-if="c.note" class="text-slate-500 italic"> — {{ c.note }}</span>
            </span>
            <button
              type="button"
              class="text-rose-400 hover:text-rose-600 text-sm shrink-0"
              :aria-label="`Remove constraint ${c.id}`"
              @click="currentLayer && removeConstraint(currentLayer, c.id)"
            >✕</button>
          </li>
        </ul>
        <p v-else class="text-[11px] text-slate-400 italic">No constraints — this prioritisation can go anywhere.</p>

        <!-- Add-constraint form -->
        <div v-if="showConstraintForm" class="mt-2 space-y-2 rounded-md bg-white border border-slate-200 p-2.5">
          <div class="flex gap-2">
            <select
              v-model="newConstraint.kind"
              class="flex-1 h-8 px-2 rounded border border-slate-200 text-[11px]
                     focus:outline-none focus:border-orange-400"
              aria-label="Constraint kind"
            >
              <option v-for="(label, k) in CONSTRAINT_LABEL" :key="k" :value="k">{{ label }}</option>
            </select>
          </div>
          <div class="flex gap-2">
            <select
              v-model="newConstraint.targetA"
              class="flex-1 h-8 px-2 rounded border border-slate-200 text-[11px]
                     focus:outline-none focus:border-orange-400"
              aria-label="Target"
            >
              <option value="">— pick target —</option>
              <option v-for="r in currentDraft?.rankings ?? []" :key="r.targetId" :value="r.targetId">{{ r.targetId }}</option>
            </select>
            <select
              v-if="newConstraint.kind === 'order'"
              v-model="newConstraint.targetB"
              class="flex-1 h-8 px-2 rounded border border-slate-200 text-[11px]
                     focus:outline-none focus:border-orange-400"
              aria-label="Reference target (must rank above)"
            >
              <option value="">— ref target —</option>
              <option v-for="r in currentDraft?.rankings ?? []" :key="r.targetId" :value="r.targetId">{{ r.targetId }}</option>
            </select>
          </div>
          <div v-if="newConstraint.kind === 'floor' || newConstraint.kind === 'ceiling'" class="flex gap-2 items-center">
            <label class="text-[11px] text-slate-600">{{ newConstraint.kind === 'floor' ? 'Min %' : 'Max %' }}</label>
            <input
              v-if="newConstraint.kind === 'floor'"
              v-model.number="newConstraint.minPercent"
              type="number" min="0" max="100"
              class="w-16 h-8 px-2 rounded border border-slate-200 text-[11px]
                     focus:outline-none focus:border-orange-400"
              aria-label="Floor %"
            />
            <input
              v-if="newConstraint.kind === 'ceiling'"
              v-model.number="newConstraint.maxPercent"
              type="number" min="0" max="100"
              class="w-16 h-8 px-2 rounded border border-slate-200 text-[11px]
                     focus:outline-none focus:border-orange-400"
              aria-label="Ceiling %"
            />
          </div>
          <input
            v-model="newConstraint.note"
            type="text"
            placeholder="Why this limit? (rationale shown to reviewers)"
            class="w-full h-8 px-2 rounded border border-slate-200 text-[11px]
                   focus:outline-none focus:border-orange-400"
            aria-label="Constraint rationale"
          />
          <button
            type="button"
            class="w-full h-8 rounded bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors"
            @click="commitConstraint"
          >Add constraint</button>
        </div>
      </div>

      <!-- ── Metadata (source / authority / purposes) ── -->
      <div v-if="isLayerStage && currentDraft" class="rounded-lg border border-slate-200 p-3 space-y-2.5">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Source · Authority · Purpose</p>
        <div>
          <label class="text-[11px] font-semibold text-slate-600">Source — what drove this prioritisation</label>
          <textarea
            v-model="currentDraft.source"
            rows="2"
            class="mt-1 w-full px-2 py-1.5 rounded border border-slate-200 text-[12px] resize-none
                   focus:outline-none focus:border-orange-400"
            placeholder="e.g. Q2 strategy review concluded …"
          />
          <div class="flex flex-wrap gap-1 mt-1">
            <button
              v-for="s in GLOBAL_PRIORITY_SUGGESTIONS.source"
              :key="s"
              type="button"
              class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 transition-colors"
              @click="currentDraft.source = currentDraft.source ? `${currentDraft.source}; ${s}` : s"
            >+ {{ s }}</button>
          </div>
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-600">Authority — who can approve this</label>
          <textarea
            v-model="currentDraft.authority"
            rows="2"
            class="mt-1 w-full px-2 py-1.5 rounded border border-slate-200 text-[12px] resize-none
                   focus:outline-none focus:border-orange-400"
          />
          <div class="flex flex-wrap gap-1 mt-1">
            <button
              v-for="s in GLOBAL_PRIORITY_SUGGESTIONS.authority"
              :key="s"
              type="button"
              class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 transition-colors"
              @click="currentDraft.authority = currentDraft.authority ? `${currentDraft.authority}; ${s}` : s"
            >+ {{ s }}</button>
          </div>
        </div>
        <div>
          <label class="text-[11px] font-semibold text-slate-600">Purposes — what this priority is meant to achieve</label>
          <textarea
            v-model="currentDraft.purposes"
            rows="2"
            class="mt-1 w-full px-2 py-1.5 rounded border border-slate-200 text-[12px] resize-none
                   focus:outline-none focus:border-orange-400"
          />
          <div class="flex flex-wrap gap-1 mt-1">
            <button
              v-for="s in GLOBAL_PRIORITY_SUGGESTIONS.purposes"
              :key="s"
              type="button"
              class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-orange-100 hover:text-orange-700 text-slate-600 transition-colors"
              @click="currentDraft.purposes = currentDraft.purposes ? `${currentDraft.purposes}; ${s}` : s"
            >+ {{ s }}</button>
          </div>
        </div>
      </div>

      <!-- ── Review & Apply stage ── -->
      <div v-if="activeStage === 'review'" class="space-y-3">
        <div class="rounded-lg border border-slate-200 p-3 space-y-2">
          <p class="text-[12px] font-bold text-slate-700">Per-layer summary</p>
          <ul class="text-[12px] text-slate-700 space-y-1">
            <li v-for="layer in (['stakeholders','values-costs-constraints','solutions'] as PriorityLayer[])" :key="layer" class="flex items-center gap-2">
              <span aria-hidden="true">{{ LAYER_ICON[layer] }}</span>
              <span class="font-semibold">{{ LAYER_LABEL[layer] }}</span>
              <span class="text-slate-500">— {{ layerCounts[layer].ranked }} ranked, {{ layerCounts[layer].constraints }} constraints</span>
              <span
                class="ml-auto text-[10px] font-bold uppercase tracking-wide"
                :class="layerCounts[layer].status === 'applied' ? 'text-emerald-600' : 'text-slate-400'"
              >{{ layerCounts[layer].status }}</span>
            </li>
          </ul>
        </div>

        <button
          type="button"
          class="w-full h-10 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600
                 text-white text-sm font-bold shadow-lg shadow-orange-500/30 transition-all
                 focus:outline-none focus:ring-2 focus:ring-orange-300"
          @click="applyAllLayers"
        ><span class="inline-flex items-center justify-center gap-2"><PriorityTripleGlyph size="standard" class="h-5 w-auto" aria-label="" /> Apply Global Priority across all layers</span></button>

        <!-- Consequence diff (mirrors SharpenPanel pattern) -->
        <!--
          Tom: "Show Planner Consequences: interesting feature, but Icon is
          not clear or large enough, and a Text up front with it is needed —
          'Consequence'." So the strip now leads with a large 📋 icon + the
          word CONSEQUENCE in a colored chip, not just a tiny ✓.
        -->
        <div v-if="lastApplyDiff.length" class="rounded-lg border-2 border-emerald-300 bg-emerald-50/70 p-3 space-y-2 shadow-sm">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl leading-none" aria-hidden="true">📋</span>
            <span class="text-[10px] font-extrabold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
              Consequence
            </span>
            <p class="text-[12px] font-bold text-emerald-800 flex-1">
              Global Priority applied — here's what changed
            </p>
          </div>
          <div class="flex gap-3 text-[11px] pl-9">
            <span><span class="font-bold text-blue-700">{{ diffCounts.stakeholder }}</span> stakeholders</span>
            <span><span class="font-bold text-indigo-700">{{ diffCounts.V }}</span> values</span>
            <span><span class="font-bold text-violet-700">{{ diffCounts.S }}</span> solutions</span>
            <span><span class="font-bold text-slate-700">{{ diffCounts.F }}</span> other</span>
          </div>
          <button
            type="button"
            class="w-full h-8 rounded bg-white border border-emerald-300 text-emerald-700 text-[11px] font-semibold
                   hover:bg-emerald-100 transition-colors"
            @click="showDiffDetails = !showDiffDetails"
          >{{ showDiffDetails ? 'Hide' : 'See' }} what changed ({{ lastApplyDiff.length }} items)</button>
          <ScrollContainer
            v-if="showDiffDetails"
            outer-class="relative"
            inner-class="text-[11px] text-slate-700 space-y-1"
            inner-style="max-height: 16rem"
            :no-pill="true"
          >
            <ul class="space-y-1">
              <li
                v-for="(d, i) in lastApplyDiff"
                :key="i"
                class="flex gap-2 px-2 py-1 rounded bg-white border border-slate-100"
              >
                <span class="font-mono text-[10px] text-slate-400 shrink-0">{{ d.entryKind }}</span>
                <span class="font-semibold flex-1 truncate" :title="d.entryId">{{ d.entryId }}</span>
                <span class="text-slate-500 shrink-0">{{ d.field }}:</span>
                <span class="text-slate-400 shrink-0">{{ d.before }}</span>
                <span class="text-emerald-600 font-bold shrink-0">→ {{ d.after }}</span>
              </li>
            </ul>
          </ScrollContainer>
        </div>
      </div>

      <!-- ── 🔄 Replan after Evo (Planguage-fidelity priority) ── -->
      <!--
        After every Evo step, refresh the picture: how much value did we
        accomplish vs Goal/Wish, and how much budget remains? Surface real
        priority dilemmas as cards, then seed a planner conversation so the
        planner resolves them before the next step. (Per Tom's design note:
        "primary prioritization in Planguage is reaching Value Wishes with
        all constraints, including all Budgets and remaining resources".)
      -->
      <div v-if="activeStage === 'replan'" class="space-y-4">
        <p class="text-[11px] text-slate-500 italic px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
          Refresh the plan after Evo step feedback. Edit budgets to match what's remaining; the dilemma cards update live.
          When ready, copy the planner conversation seed to discuss real priority trade-offs.
        </p>

        <!-- Budgets editor -->
        <div class="rounded-lg border border-slate-200 p-3 space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-[12px] font-bold text-slate-700">💰 Budgets — initial vs remaining</p>
            <button
              type="button"
              class="text-[10px] text-orange-600 hover:underline"
              @click="budgets.push({ name: 'New resource', initialAmount: 100, remainingAmount: 100, unit: 'units' })"
            >+ Add resource</button>
          </div>
          <!-- Tom 2026-05-13 ("Kai's idea"): each budget row now exposes a SLIDER
               for `remainingAmount` from 0 → initialAmount, sitting alongside the
               existing numeric field. Dragging the slider triggers the dilemma
               analyser live (the slider's v-model points at the same reactive
               ref the number field uses), so the user can sweep "what if we had
               only X engineer-weeks left?" without typing. The numeric input is
               retained for precise entry; slider is the fast-exploration tool. -->
          <div class="space-y-2.5">
            <div
              v-for="(b, i) in budgets"
              :key="i"
              class="rounded-md border border-slate-100 bg-slate-50/50 p-2 space-y-1.5"
            >
              <!-- Row 1 — name + initial/remaining numeric + unit + remove -->
              <div class="grid grid-cols-12 gap-1.5 items-center text-[11px]">
                <input
                  v-model="b.name"
                  type="text"
                  class="col-span-3 h-7 px-2 rounded border border-slate-200 focus:border-orange-400 focus:outline-none"
                  placeholder="Resource"
                />
                <input
                  v-model.number="b.initialAmount"
                  type="number"
                  min="0"
                  class="col-span-2 h-7 px-1.5 rounded border border-slate-200 text-right focus:border-orange-400 focus:outline-none"
                  title="Initial budget"
                />
                <span class="col-span-1 text-center text-slate-400">/</span>
                <input
                  v-model.number="b.remainingAmount"
                  type="number"
                  min="0"
                  class="col-span-2 h-7 px-1.5 rounded border border-slate-200 text-right focus:border-orange-400 focus:outline-none"
                  :class="b.initialAmount > 0 && b.remainingAmount / b.initialAmount < 0.25 ? 'bg-rose-50 text-rose-700 font-semibold' : ''"
                  title="Remaining"
                />
                <input
                  v-model="b.unit"
                  type="text"
                  class="col-span-3 h-7 px-2 rounded border border-slate-200 focus:border-orange-400 focus:outline-none"
                  placeholder="unit"
                />
                <button
                  type="button"
                  class="col-span-1 text-rose-400 hover:text-rose-600 text-sm"
                  aria-label="Remove resource"
                  @click="budgets.splice(i, 1)"
                >×</button>
              </div>
              <!-- Row 2 — slider 0 → initialAmount, live linked to remainingAmount -->
              <div class="flex items-center gap-2">
                <span class="text-[9px] uppercase tracking-wider font-bold text-orange-700/70 w-14 shrink-0">Slider</span>
                <input
                  v-model.number="b.remainingAmount"
                  type="range"
                  min="0"
                  :max="b.initialAmount > 0 ? b.initialAmount : 100"
                  step="1"
                  class="flex-1 accent-orange-500 cursor-pointer"
                  :aria-label="`${b.name} remaining — slide from 0 to ${b.initialAmount} ${b.unit}`"
                />
                <span
                  class="text-[10px] font-mono tabular-nums w-20 text-right shrink-0"
                  :class="b.initialAmount > 0 && b.remainingAmount / b.initialAmount < 0.25 ? 'text-rose-600 font-semibold' : 'text-slate-500'"
                >
                  {{ b.remainingAmount }}/{{ b.initialAmount }} {{ b.unit }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Value progress snapshot. Tom 2026-05-13 ("Kai's idea"): each Value
             gets a SLIDER beside its auto-computed bar so the user can drag a
             different goal-accomplishment percentage and watch the priority
             dilemmas re-compute live. Sliders override the auto-extracted V.
             status value without modifying the spec. A 🔄 affordance appears
             when the slider is overriding; clicking it clears the override and
             snaps back to the spec-derived value. -->
        <div v-if="valueProgressEffective.length" class="rounded-lg border border-slate-200 p-3 space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-[12px] font-bold text-slate-700">📊 Value accomplishment (vs Goal / Wish) — drag to explore</p>
            <button
              v-if="Object.keys(valueOverrides).length > 0"
              type="button"
              class="text-[10px] text-orange-600 hover:underline"
              @click="valueOverrides = {}"
              title="Clear all slider overrides — revert every Value to its spec-derived progress"
            >Reset all sliders</button>
          </div>
          <ScrollContainer
            outer-class="relative"
            inner-class="space-y-2"
            inner-style="max-height: 18rem"
            :no-pill="true"
          >
            <div
              v-for="p in valueProgressEffective"
              :key="p.valueId"
              class="text-[11px] space-y-1 rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1.5"
            >
              <!-- Header row: id + auto-vs-override marker + percentage -->
              <div class="flex items-center gap-2">
                <span class="font-semibold text-slate-700 truncate flex-1" :title="p.description">{{ p.valueId }}</span>
                <button
                  v-if="valueOverrides[p.valueId] !== undefined"
                  type="button"
                  class="text-[10px] text-orange-600 hover:text-orange-700 hover:underline shrink-0"
                  title="Clear override — snap back to spec value"
                  @click="resetValueOverride(p.valueId)"
                >🔄 reset</button>
                <span
                  class="text-[10px] tabular-nums w-12 text-right shrink-0"
                  :class="valueOverrides[p.valueId] !== undefined ? 'text-orange-600 font-semibold' : 'text-slate-500'"
                >
                  {{ Math.round(p.goalAccomplishment * 100) }}%
                </span>
                <span v-if="p.wish != null" class="text-[10px] text-slate-400 w-16 text-right shrink-0" :title="`Wish ${p.wish}`">
                  Wish {{ Math.round((p.wishAccomplishment ?? 0) * 100) }}%
                </span>
              </div>
              <!-- Slider — 0..1 with 0.01 step; v-model writes into valueOverrides -->
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                  <div
                    class="h-full transition-all"
                    :class="p.goalAccomplishment >= 0.8 ? 'bg-emerald-500' : p.goalAccomplishment >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'"
                    :style="{ width: `${Math.round(p.goalAccomplishment * 100)}%` }"
                  ></div>
                </div>
                <input
                  :value="p.goalAccomplishment"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  class="flex-1 accent-orange-500 cursor-pointer"
                  :aria-label="`${p.valueId} goal accomplishment — slide 0% to 100%`"
                  @input="(e) => { valueOverrides = { ...valueOverrides, [p.valueId]: Number((e.target as HTMLInputElement).value) } }"
                />
              </div>
            </div>
          </ScrollContainer>
        </div>

        <!-- Dilemma cards -->
        <div class="space-y-2">
          <p class="text-[12px] font-bold text-slate-700">
            🎭 Priority dilemmas — {{ dilemmas.length || 'none detected yet' }}
          </p>
          <div
            v-for="d in dilemmas"
            :key="d.id"
            class="rounded-lg border p-3 space-y-1.5"
            :class="DILEMMA_TONE[d.kind].ring"
          >
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" :class="DILEMMA_TONE[d.kind].chip">
                {{ DILEMMA_TONE[d.kind].label }}
              </span>
              <span class="text-[12px] font-semibold text-slate-800 flex-1">{{ d.title }}</span>
            </div>
            <p class="text-[11px] text-slate-600">{{ d.narrative }}</p>
            <div class="text-[11px] text-slate-700">
              <p class="font-semibold mb-0.5">Options:</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li v-for="(opt, oi) in d.options" :key="oi">{{ opt }}</li>
              </ul>
            </div>
          </div>
          <p v-if="!dilemmas.length" class="text-[11px] text-slate-400 italic px-2">
            Update budgets above (or sharpen V. <span class="font-mono">status</span> values in the spec) to surface real priority dilemmas.
          </p>
        </div>

        <!-- Conversation seed -->
        <div class="rounded-lg border border-orange-200 bg-orange-50/30 p-3 space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-[12px] font-bold text-orange-800">🗣 Planner conversation seed</p>
            <button
              type="button"
              class="text-[11px] px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors"
              @click="copyConversationSeed"
            >{{ seedCopied ? '✓ Copied' : '📋 Copy markdown' }}</button>
          </div>
          <p class="text-[10px] text-slate-500 italic">
            Paste into Spec Coach, your team's chat, or any LLM to talk the planner through the trade-offs.
            Decisions made in the conversation can be recorded back as Global Priority records.
          </p>
          <ScrollContainer
            outer-class="relative"
            inner-class="text-[10px] font-mono text-slate-700 whitespace-pre-wrap p-2 bg-white border border-slate-200 rounded"
            inner-style="max-height: 14rem"
            :no-pill="true"
          >
            {{ conversationSeed }}
          </ScrollContainer>
        </div>
      </div>
    </ScrollContainer>

    <!-- ── Footer hint ────────────────────────────────────────────────────── -->
    <div class="px-5 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
      <p class="text-[10px] text-slate-400 italic">
        Auto-saved per layer. Changes to the underlying spec are applied only when you press <span class="font-semibold">Apply</span> on the Review stage.
      </p>
    </div>
  </RightPanel>
</template>
