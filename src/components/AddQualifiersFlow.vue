<!-- UNIT_TYPE=Modal -->
<!--
  AddQualifiersFlow.vue — Stage 3.3 Add Qualifiers process surface.
  Tom Gilb 2026-06-27 verbatim: *"the add qualifiers stage does not offer
  any process for doing that. I suggest 2 rounds. 1. A default set of
  qualifiers for everything (when, who, where etc). Then the opportunity to
  modify some of thise, then a third round for additional Levels (for any
  Tolerable and Any Target) to add different conditions and levels."*

  Round-1 (mechanical defaults + AI refines in background) and Round-2
  (per-entry edit) shipped this turn.  Round-3 (multi-set additional Levels
  per r93kkk) banked for next session.

  Composes with: r93jjj First-Class Qualifiers + r93kkk Multi-Set CRITICAL
  Two-Trigger + r93lll ASPECTS book + r93mmm Infinity-Trap Rule (this cures
  it) + AI-Max + Universal Undo + Honest-Loading-Hint-Copy + MOVE +
  CloseDot + Single-Surface + Twin portability.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SpecBlock, ConditionSet, PlanguageQualifier, QualifierDimension } from '../types/spec'
import { useAddQualifiers, listScalarEntries } from '../composables/useAddQualifiers'
import CloseDot from './CloseDot.vue'

const props = defineProps<{
  /** Modal visibility — bound by parent. */
  open: boolean
  /** Current spec — drives the entry list + powers the AI prompt. */
  spec: SpecBlock | null | undefined
}>()

const emit = defineEmits<{
  /** Planner applied the qualifiers: parent merges into spec.values/resources
   *  via Universal Undo + saves snapshot. */
  apply: [defaults: Map<string, ConditionSet>]
  /** Modal closed without applying. */
  close: []
}>()

const _specRef = computed(() => props.spec)
const qualifiers = useAddQualifiers(_specRef as Parameters<typeof useAddQualifiers>[0])

const round = ref<1 | 2>(1)
const expandedEntryId = ref<string | null>(null)

/** Auto-start Round 1 the moment the modal opens. */
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    qualifiers.reset()
    round.value = 1
    await qualifiers.startRound1()
  }
}, { immediate: true })

const scalarEntries = computed(() => listScalarEntries(props.spec))

function toggleExpanded(id: string): void {
  expandedEntryId.value = expandedEntryId.value === id ? null : id
}

function getSetFor(entryId: string): ConditionSet | undefined {
  return qualifiers.defaults.value.get(entryId)
}

function getSourceFor(entryId: string): 'mechanical' | 'ai' | undefined {
  return qualifiers.defaultSource.value.get(entryId)
}

function updateQualifier(entryId: string, idx: number, patch: Partial<PlanguageQualifier>): void {
  const set = getSetFor(entryId)
  if (!set) return
  const newQs = set.qualifiers.map((q, i) => i === idx ? { ...q, ...patch } : q)
  qualifiers.updateSet(entryId, { ...set, qualifiers: newQs })
}

function toggleCritical(entryId: string): void {
  const set = getSetFor(entryId)
  if (!set) return
  qualifiers.updateSet(entryId, { ...set, critical: !set.critical })
}

function onApply(): void {
  emit('apply', qualifiers.defaults.value)
}

function onClose(): void {
  qualifiers.cancelAI()
  emit('close')
}

const refinedPercent = computed<number>(() => {
  const total = qualifiers.totalCount.value
  if (total === 0) return 0
  return Math.round((qualifiers.refinedCount.value / total) * 100)
})

const CLASSIFICATION_LABELS: Record<QualifierDimension, string> = {
  time:  '⏱ Time',
  place: '📍 Place',
  event: '⚡ Event',
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[700] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-qualifiers-heading"
      @click.self="onClose"
    >
      <div class="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-violet-300">
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-violet-100 via-fuchsia-100 to-amber-100 border-b border-violet-200">
          <div class="flex-1 min-w-0">
            <h2 id="add-qualifiers-heading" class="text-lg font-extrabold text-violet-900 leading-tight">
              Stage 3.3 — Add Qualifiers
            </h2>
            <p class="text-[11px] text-violet-700 mt-0.5">
              Cure for the <strong>Infinity Trap</strong> (r93mmm): every scalar level needs <strong>when / where / event</strong> bounds, or it silently commits to infinite cost.
            </p>
          </div>
          <div class="shrink-0 flex items-center gap-2">
            <span
              class="text-[11px] font-bold px-2 py-1 rounded-full"
              :class="round === 1
                ? 'bg-violet-600 text-white'
                : 'bg-slate-200 text-slate-700'"
            >Round 1 · Defaults</span>
            <span class="text-slate-400 text-xs">→</span>
            <span
              class="text-[11px] font-bold px-2 py-1 rounded-full"
              :class="round === 2
                ? 'bg-violet-600 text-white'
                : 'bg-slate-200 text-slate-700'"
            >Round 2 · Modify</span>
            <span class="text-slate-400 text-xs">→</span>
            <span
              class="text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 italic"
              title="Round 3 — multi-set additional Levels per r93kkk — pending next session"
            >Round 3 · banked</span>
          </div>
          <CloseDot variant="on-light" size="lg" aria-label="Close Add Qualifiers" @click="onClose" />
        </div>

        <!-- AI refinement banner -->
        <div
          v-if="qualifiers.isAIRefining.value"
          class="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-3 text-[12px]"
        >
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" aria-hidden="true" />
          <p class="flex-1 text-amber-900">
            <strong>Mechanical defaults shown · AI analysis in progress…</strong>
            Refining each entry's qualifiers from your plan context.  Edits land in place; no need to wait.
          </p>
          <p class="text-amber-700 tabular-nums shrink-0">
            {{ qualifiers.refinedCount.value }} / {{ qualifiers.totalCount.value }} refined · {{ qualifiers.aiElapsed.value }}s
          </p>
          <button
            class="shrink-0 px-2 py-1 rounded text-[11px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900"
            @click="qualifiers.cancelAI()"
          >Cancel AI</button>
        </div>
        <div
          v-else-if="!qualifiers.isAIRefining.value && qualifiers.refinedCount.value > 0"
          class="shrink-0 px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-[12px] text-emerald-900"
        >
          ✓ AI-refined defaults applied to <strong>{{ qualifiers.refinedCount.value }} of {{ qualifiers.totalCount.value }}</strong> entries ({{ refinedPercent }}%) · review + edit below, then <strong>Apply</strong>.
        </div>
        <div
          v-if="qualifiers.aiError.value"
          class="shrink-0 px-5 py-2 bg-rose-50 border-b border-rose-200 text-[12px] text-rose-900"
        >
          ⚠ {{ qualifiers.aiError.value }}
        </div>

        <!-- Entry list (scrollable) -->
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
          <p v-if="scalarEntries.length === 0" class="text-slate-500 italic text-sm py-8 text-center">
            No Values or Resources yet — go to Stage 1 to generate them, then return.
          </p>
          <div
            v-for="entry in scalarEntries"
            :key="entry.id"
            class="rounded-lg border bg-white shadow-sm overflow-hidden"
            :class="getSourceFor(entry.id) === 'ai'
              ? 'border-emerald-300'
              : 'border-slate-200'"
          >
            <!-- Entry header -->
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
              @click="toggleExpanded(entry.id)"
            >
              <span
                class="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-extrabold uppercase tracking-wider"
                :class="entry.kind === 'value'
                  ? 'bg-violet-100 text-violet-800'
                  : 'bg-emerald-100 text-emerald-800'"
              >
                {{ entry.kind === 'value' ? 'V' : 'R' }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-slate-800 truncate">{{ entry.id }}</p>
                <p class="text-[11px] text-slate-500 truncate">{{ entry.label }}</p>
              </div>
              <!-- Qualifier triplet preview -->
              <div class="hidden sm:flex shrink-0 items-center gap-1.5 text-[10px]">
                <template v-for="q in (getSetFor(entry.id)?.qualifiers ?? [])" :key="q.tag">
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded font-semibold"
                    :class="q.classification === 'time'
                      ? 'bg-blue-100 text-blue-800'
                      : q.classification === 'place'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'"
                    :title="`${q.classification}: ${q.value}`"
                  >{{ q.tag }}</span>
                </template>
              </div>
              <!-- Source badge -->
              <span
                v-if="getSourceFor(entry.id) === 'ai'"
                class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800"
                title="AI-refined from your plan context"
              >AI</span>
              <span
                v-else-if="getSourceFor(entry.id) === 'mechanical'"
                class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                title="Mechanical default — AI refinement still pending OR not running"
              >default</span>
              <!-- CRITICAL flag -->
              <span
                v-if="getSetFor(entry.id)?.critical"
                class="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-600 text-white"
                title="CRITICAL — life-safety / mission-critical scenario (r93kkk)"
              >CRITICAL</span>
              <span class="shrink-0 text-slate-400 text-sm">
                {{ expandedEntryId === entry.id ? '▴' : '▾' }}
              </span>
            </button>

            <!-- Expanded edit form -->
            <div v-if="expandedEntryId === entry.id && getSetFor(entry.id)" class="px-4 pb-4 pt-2 border-t border-slate-200 bg-slate-50 space-y-3">
              <!-- Set-level controls -->
              <div class="flex items-center gap-2 flex-wrap">
                <label class="text-[11px] font-bold text-slate-600 uppercase tracking-wider shrink-0">Set tag</label>
                <input
                  type="text"
                  :value="getSetFor(entry.id)?.tag"
                  class="flex-1 min-w-[200px] rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="1-3 word mnemonic, e.g. EU.Premium.Q1"
                  @input="(e) => {
                    const set = getSetFor(entry.id)
                    if (set) qualifiers.updateSet(entry.id, { ...set, tag: (e.target as HTMLInputElement).value })
                  }"
                />
                <label class="flex items-center gap-1.5 text-[12px] text-slate-700 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="getSetFor(entry.id)?.critical ?? false"
                    @change="toggleCritical(entry.id)"
                  />
                  <span class="font-bold">CRITICAL</span>
                  <span class="text-slate-400 italic">(life-safety / mission-critical)</span>
                </label>
              </div>

              <!-- Per-qualifier rows -->
              <div class="space-y-2">
                <div
                  v-for="(q, idx) in (getSetFor(entry.id)?.qualifiers ?? [])"
                  :key="idx"
                  class="flex items-center gap-2 flex-wrap"
                >
                  <span
                    class="shrink-0 inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                    :class="q.classification === 'time'
                      ? 'bg-blue-100 text-blue-800'
                      : q.classification === 'place'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'"
                  >{{ CLASSIFICATION_LABELS[q.classification] }}</span>
                  <input
                    type="text"
                    :value="q.tag"
                    placeholder="Mnemonic tag"
                    class="w-[180px] rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    @input="(e) => updateQualifier(entry.id, idx, { tag: (e.target as HTMLInputElement).value })"
                  />
                  <input
                    type="text"
                    :value="q.value"
                    placeholder="Concrete value (e.g. January-March 2026)"
                    class="flex-1 min-w-[240px] rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    @input="(e) => updateQualifier(entry.id, idx, { value: (e.target as HTMLInputElement).value })"
                  />
                </div>
              </div>

              <p v-if="getSetFor(entry.id)?.rationale" class="text-[11px] text-slate-600 italic mt-2">
                <strong>Rationale:</strong> {{ getSetFor(entry.id)?.rationale }}
              </p>
            </div>
          </div>
        </div>

        <!-- Footer: Apply / Close + Round 3 hint -->
        <div class="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
          <p class="flex-1 text-[11px] text-slate-600 italic leading-snug">
            <strong>Round 3 pending:</strong> for any V/R with Tolerable / Goal / Wish, you'll be able to add a 2nd / 3rd / Nth ConditionSet with different qualifier triplets + different level values (r93kkk multi-set).  Banked for next session.
          </p>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors"
            @click="onClose"
          >Cancel</button>
          <button
            type="button"
            class="px-5 py-2 rounded-lg text-sm font-extrabold text-white bg-violet-600 hover:bg-violet-700 shadow transition-colors"
            :disabled="qualifiers.totalCount.value === 0"
            @click="onApply"
          >
            Apply Qualifiers to {{ qualifiers.totalCount.value }} entr{{ qualifiers.totalCount.value === 1 ? 'y' : 'ies' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
