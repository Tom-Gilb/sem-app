<!--
  GuidelineLibraryPanel.vue — Phase 3.5A (Tom Gilb 2026-06-20 verbatim
  greenlight on (c)/(b)/(b) — global library, version-pinning, structured
  whereChecked).

  Composes with: CloseDot rule SUPREME · Single-Surface rule (callers
  register) · Universal Undo SUPREME (edits bump version) · Sources-of-
  Specs SUPREME · Planguage Mnemonic ID Standard SUPREME · No-Silent-
  Data-Loss SUPREME · MOVE Principle · Icon-Plus-Text SUPREME ·
  accessibility_tom.md.

  Phase 3.5A scope: VIEWING + activating pins + viewing rules + reject/
  reactivate.  Full Add/Edit Rule CRUD forms banked for Phase 3.5B
  (the data layer in useGuidelineLibrary.ts already supports them).
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useGuidelineLibrary } from '../composables/useGuidelineLibrary'
import { useBackdropHardening } from '../composables/useBackdropHardening'
import type { Guideline, GuidelineRule, RuleSeverity } from '../types/guidelines'

const props = defineProps<{
  open:       boolean
  contractId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

// r41 v467 — backdrop hardening.  Second occurrence of Tom's "modal
// jumps back" flag (first was v450 on RedraftResultPanel).  Same class
// of bug; shared composable now.
const { onBackdropPointerDown, onBackdropPointerUp, onContentPointerDown } = useBackdropHardening(() => emit('close'))

const lib = useGuidelineLibrary()

const currentGuidelines = computed<Guideline[]>(() => {
  if (!props.contractId) return []
  const set = lib.activeSetFor(props.contractId)
  if (!set) return []
  return set.pins
    .map(p => lib.library.value.find(g => g.id === p.guidelineId))
    .filter((g): g is Guideline => !!g)
})

const semRecommended = computed<Guideline[]>(() =>
  lib.library.value.filter(g => g.category === 'sem-curated' || g.category === 'planguage-canonical')
)

// r41 v463 (Tom Gilb 2026-07-02 "make a NAVY Guidelines section for SEM")
// — domain-specific section for US Navy / DoD / Federal Acquisition
// Regulation guideline sets.  Currently 6 focused sets under this
// category (WAWF + Payment, CDRL + DID, KO + COR Authority, FAR + DFARS
// Citations, Funds + LOA, Cybersecurity + CUI).  Pattern extensible to
// other domain sections as the SEM App grows (Aerospace, Medical Device,
// EU Procurement, etc.) — each domain a category with focused sets.
const navyGuidelines = computed<Guideline[]>(() =>
  lib.library.value.filter(g => g.category === 'us-navy'),
)

const savedGuidelines = computed<Guideline[]>(() =>
  lib.library.value.filter(g => g.category === 'planner-personal' || g.category === 'imported')
)

function isPinned(guidelineId: string): boolean {
  if (!props.contractId) return false
  const set = lib.activeSetFor(props.contractId)
  return !!set?.pins.some(p => p.guidelineId === guidelineId)
}

function togglePin(g: Guideline): void {
  if (!props.contractId) return
  if (isPinned(g.id)) lib.unpinGuideline(props.contractId, g.id)
  else                 lib.pinGuideline(props.contractId, g.id, g.version)
}

const expanded = ref<Set<string>>(new Set())
function toggleExpanded(gId: string): void {
  const s = new Set(expanded.value)
  if (s.has(gId)) s.delete(gId)
  else            s.add(gId)
  expanded.value = s
}

function severityClass(sev: RuleSeverity): string {
  switch (sev) {
    case 'critical': return 'bg-red-100 text-red-800 ring-red-200'
    case 'high':     return 'bg-amber-100 text-amber-800 ring-amber-200'
    case 'medium':   return 'bg-yellow-50 text-yellow-800 ring-yellow-200'
    case 'low':      return 'bg-slate-100 text-slate-700 ring-slate-200'
    case 'info':     return 'bg-blue-50 text-blue-700 ring-blue-200'
  }
}

function activeRules(g: Guideline): GuidelineRule[] {
  return g.rules.filter(r => r.status === 'active')
}
function rejectedRules(g: Guideline): GuidelineRule[] {
  return g.rules.filter(r => r.status === 'rejected')
}

function onRejectRule(g: Guideline, r: GuidelineRule): void {
  lib.rejectRule(g.id, r.id)
}
function onReactivateRule(g: Guideline, r: GuidelineRule): void {
  lib.reactivateRule(g.id, r.id)
}

const editingRuleId = ref<string | null>(null)
function onEditRule(_g: Guideline, r: GuidelineRule): void {
  editingRuleId.value = r.id
}
function closeEditDialog(): void {
  editingRuleId.value = null
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10) } catch { return iso }
}

// r41 2026-06-20 (Tom Gilb verbatim "Of course we need to be able to export
// guidelines…") — JSON export buttons.  Per-Guideline + library-wide.
function onExportGuideline(g: Guideline): void {
  const payload = lib.exportGuidelineJson(g.id)
  if (payload) lib.downloadJson(payload)
}
function onExportLibrary(): void {
  lib.downloadJson(lib.exportLibraryJson())
}
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <!-- r41 v400 (Tom Gilb 2026-07-01) — bumped z-[480]/[481] → z-[701]/[702]
           so this drawer sits ABOVE the ContractHub z-[600] full-screen surface
           it launches from.  Same class-bug as the reparse picker fixed in
           this pass; see ContractHub.vue r41 v400 comment for the audit. -->
      <div
        class="fixed inset-0 z-[701] bg-black/45"
        aria-hidden="true"
        @pointerdown="onBackdropPointerDown"
        @pointerup="onBackdropPointerUp"
      />

      <div
        class="fixed inset-y-0 right-0 z-[702] w-[min(820px,100vw)] bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Guidelines Library"
        @pointerdown="onContentPointerDown"
      >
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-rose-900 via-rose-800 to-fuchsia-900 text-white">
          <span class="text-base font-bold" aria-hidden="true">📚</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-extrabold tracking-wide leading-tight">Guidelines Library</p>
            <p class="text-[11px] text-white/70 leading-tight">Global SEM App library · per-contract pin + version-pin · planner-editable Rules</p>
          </div>
          <!-- r41 2026-06-20 — library-wide Export (JSON).  Tom Gilb verbatim
               "Of course we need to be able to export guidelines…" -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/15 text-white hover:bg-white/25 ring-1 ring-white/30 transition-colors"
            title="📥 Export ENTIRE library as JSON — includes all Guidelines + all Rules (active, rejected, edited) + per-contract pin map.  Lossless, round-trippable.  Use for backup, cross-device sync, or sharing your curated set."
            @click="onExportLibrary"
          >
            <span aria-hidden="true">📥</span>
            <span>Export library</span>
          </button>
          <CloseDot
            size="lg"
            variant="on-dark"
            aria-label="Close Guidelines Library"
            @click="emit('close')"
          />
        </div>

        <!-- Body -->
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative bg-slate-50"
          inner-class="px-5 py-5 space-y-6"
          inner-style="max-height: 100vh;"
          :no-pill="false"
        >
          <!-- Section 1 · Current Contract Guidelines -->
          <section>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-base" aria-hidden="true">🎯</span>
              <h2 class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-rose-800">Current Contract Guidelines</h2>
              <span class="text-[11px] text-slate-500 tabular-nums">{{ currentGuidelines.length }} pinned</span>
            </div>
            <p v-if="!props.contractId" class="text-[12px] text-slate-500 italic">
              No contract selected — open a contract first to manage its pinned Guidelines.
            </p>
            <p v-else-if="currentGuidelines.length === 0" class="text-[12px] text-slate-500 italic bg-white border border-dashed border-slate-300 rounded-xl p-4">
              No Guidelines pinned to this contract yet. Pin one or more from <strong>SEM Recommended</strong> or <strong>Saved Guidelines</strong> below — they'll drive the rewrites + standards checks the next time you parse.
            </p>
            <ul v-else class="space-y-2">
              <li
                v-for="g in currentGuidelines"
                :key="g.id"
                class="bg-white border-2 border-rose-300 rounded-xl shadow-sm p-4 space-y-2"
              >
                <!-- Header row -->
                <div class="flex items-start gap-2 flex-wrap">
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-slate-800">
                      <span class="font-mono text-rose-700">{{ g.tag }}.v{{ g.version }}</span>
                      <span class="text-slate-500 font-normal ml-2">{{ g.title || '' }}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 italic mt-0.5">{{ fmtDate(g.date) }} · {{ g.source }}</p>
                    <p class="text-[12px] text-slate-700 mt-1 leading-relaxed">{{ g.description }}</p>
                  </div>
                  <div class="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      class="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors"
                      :title="`📥 Export ${g.tag}.v${g.version} as JSON — includes all Rules, lossless`"
                      @click="onExportGuideline(g)"
                    >📥 Export</button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                      :title="`Unpin ${g.tag}.v${g.version} from this contract`"
                      @click="togglePin(g)"
                    >📌 Unpin</button>
                  </div>
                </div>
                <!-- Rules expansion -->
                <button
                  type="button"
                  class="text-[11px] font-semibold text-rose-700 hover:text-rose-900 transition-colors"
                  @click="toggleExpanded(g.id)"
                >{{ expanded.has(g.id) ? '▾' : '▸' }} {{ activeRules(g).length }} active Rule{{ activeRules(g).length === 1 ? '' : 's' }}<span v-if="rejectedRules(g).length"> · {{ rejectedRules(g).length }} rejected</span></button>
                <ul v-if="expanded.has(g.id)" class="space-y-1.5 mt-1">
                  <li
                    v-for="r in g.rules"
                    :key="r.id"
                    class="border rounded-lg p-3 space-y-1"
                    :class="r.status === 'rejected'
                      ? 'bg-slate-50 border-slate-200 opacity-70'
                      : r.status === 'edited'
                        ? 'bg-amber-50 border-amber-200 opacity-70'
                        : 'bg-white border-rose-100'"
                  >
                    <div class="flex items-start gap-2 flex-wrap">
                      <span class="font-mono text-[11px] font-bold text-rose-700">{{ g.tag }}.{{ r.tag }}.v{{ r.version }}</span>
                      <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ring-1" :class="severityClass(r.severity)">{{ r.severity }}</span>
                      <span v-if="r.status === 'rejected'" class="text-[10px] font-bold text-slate-500 uppercase">rejected</span>
                      <span v-if="r.status === 'edited'"   class="text-[10px] font-bold text-amber-700 uppercase">superseded</span>
                      <span class="ml-auto text-[10px] text-slate-400">{{ fmtDate(r.date) }}</span>
                    </div>
                    <p class="text-[12px] font-semibold text-slate-800">{{ r.title || r.tag }}</p>
                    <p class="text-[11px] text-slate-600 leading-snug"><strong class="text-slate-700">Justification:</strong> {{ r.justification }}</p>
                    <p class="text-[10px] text-slate-500"><strong>Source:</strong> {{ r.source }}</p>
                    <details class="text-[11px] text-slate-600">
                      <summary class="cursor-pointer text-[10px] text-slate-500 uppercase tracking-wider hover:text-slate-700">Where checked · Exceptions · How to correct</summary>
                      <div class="space-y-1.5 mt-2 pl-2 border-l-2 border-slate-200">
                        <p><strong class="text-slate-700">Where checked:</strong>
                          <span v-if="r.whereChecked.entryTypes.length">types [{{ r.whereChecked.entryTypes.join(', ') }}]</span>
                          <span v-if="r.whereChecked.clauseKinds.length"> · clauses [{{ r.whereChecked.clauseKinds.join(', ') }}]</span>
                          <span v-if="r.whereChecked.phases.length"> · phases [{{ r.whereChecked.phases.join(', ') }}]</span>
                        </p>
                        <p v-if="r.whereChecked.additionalCriteria">
                          <strong class="text-slate-700">Additional criteria:</strong> {{ r.whereChecked.additionalCriteria }}
                        </p>
                        <p v-if="r.exceptions.length">
                          <strong class="text-slate-700">Exceptions:</strong> {{ r.exceptions.join(' · ') }}
                        </p>
                        <p v-if="r.howToCorrect.auto"><strong class="text-emerald-700">Auto-fix:</strong> {{ r.howToCorrect.auto }}</p>
                        <p><strong class="text-blue-700">Manual fix:</strong> {{ r.howToCorrect.manual }}</p>
                      </div>
                    </details>
                    <div class="flex gap-1.5 pt-1">
                      <button
                        v-if="r.status === 'active'"
                        type="button"
                        class="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50"
                        :title="`Reject ${r.tag} — kept in library (No-Silent-Data-Loss) but skipped at check time`"
                        @click="onRejectRule(g, r)"
                      >✕ Reject</button>
                      <button
                        v-if="r.status === 'rejected'"
                        type="button"
                        class="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-500"
                        :title="`Reactivate ${r.tag}`"
                        @click="onReactivateRule(g, r)"
                      >↺ Reactivate</button>
                      <button
                        v-if="r.status === 'active'"
                        type="button"
                        class="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-amber-300 text-amber-700 hover:bg-amber-50"
                        :title="`Edit ${r.tag} — forks a new version (Universal Undo: original preserved with status=edited)`"
                        @click="onEditRule(g, r)"
                      >✏️ Edit</button>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <!-- Section 2 · SEM Recommended Library -->
          <section>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-base" aria-hidden="true">📚</span>
              <h2 class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">SEM Recommended Library</h2>
              <span class="text-[11px] text-slate-500 tabular-nums">{{ semRecommended.length }} available</span>
            </div>
            <p class="text-[11px] text-slate-500 italic mb-2">
              Curated from Tom Gilb's books, Plain English standards, ISO 9001 + others.  Pin any to your contract.
            </p>
            <ul class="space-y-2">
              <li
                v-for="g in semRecommended"
                :key="g.id"
                class="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-2"
                :class="isPinned(g.id) ? 'opacity-60' : ''"
              >
                <div class="flex items-start gap-2 flex-wrap">
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-slate-800">
                      <span class="font-mono text-emerald-700">{{ g.tag }}.v{{ g.version }}</span>
                      <span class="text-slate-500 font-normal ml-2">{{ g.title || '' }}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 italic mt-0.5">{{ fmtDate(g.date) }} · {{ g.source }}</p>
                    <p class="text-[12px] text-slate-700 mt-1 leading-relaxed">{{ g.description }}</p>
                  </div>
                  <div class="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      class="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                      :title="`📥 Export ${g.tag}.v${g.version} as JSON — includes all Rules, lossless`"
                      @click="onExportGuideline(g)"
                    >📥 Export</button>
                    <button
                      v-if="props.contractId"
                      type="button"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                      :class="isPinned(g.id)
                        ? 'bg-slate-200 text-slate-500 cursor-default'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'"
                      :title="isPinned(g.id) ? 'Already pinned to this contract' : `Pin ${g.tag}.v${g.version} to this contract`"
                      @click="togglePin(g)"
                    >{{ isPinned(g.id) ? '✓ Pinned' : '📌 Pin' }}</button>
                  </div>
                </div>
                <button
                  type="button"
                  class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                  @click="toggleExpanded(g.id)"
                >{{ expanded.has(g.id) ? '▾' : '▸' }} {{ activeRules(g).length }} active Rule{{ activeRules(g).length === 1 ? '' : 's' }}</button>
                <ul v-if="expanded.has(g.id)" class="space-y-1.5 mt-1">
                  <li
                    v-for="r in g.rules"
                    :key="r.id"
                    class="border rounded-lg p-3 space-y-1"
                    :class="r.status === 'rejected' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-emerald-100'"
                  >
                    <div class="flex items-start gap-2 flex-wrap">
                      <span class="font-mono text-[11px] font-bold text-emerald-700">{{ g.tag }}.{{ r.tag }}.v{{ r.version }}</span>
                      <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ring-1" :class="severityClass(r.severity)">{{ r.severity }}</span>
                      <span v-if="r.status === 'rejected'" class="text-[10px] font-bold text-slate-500 uppercase">rejected</span>
                    </div>
                    <p class="text-[12px] font-semibold text-slate-800">{{ r.title || r.tag }}</p>
                    <p class="text-[11px] text-slate-600 leading-snug">{{ r.justification }}</p>
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <!-- Section 3 · Navy Guidelines (r41 v463 Tom Gilb 2026-07-02
               "maybe you can make a NAVY Guidelines section for SEM") —
               domain-specific section for US Navy / DoD / Federal
               Acquisition Regulation guideline sets.  6 focused sets
               under category 'us-navy' (WAWF+Payment · CDRL+DID · KO+COR
               Authority · FAR+DFARS Citations · Funds+LOA · Cybersecurity+CUI).
               Every rule's Source is a Reachable-Now public FAR / DFARS
               / MIL-STD / DoD-FMR URL per Term + Definition + Source
               SUPREME (v460).  Audience: Navy contracting officer / KO /
               COR / Vice Admiral.  Pattern extensible: other domain
               categories can follow (Aerospace, Medical, EU Procurement).  -->
          <section v-if="navyGuidelines.length > 0" aria-label="Navy Guidelines section">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-base" aria-hidden="true">⚓</span>
              <h2 class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-blue-800">Navy Guidelines</h2>
              <span class="text-[11px] text-slate-500 tabular-nums">{{ navyGuidelines.length }} available</span>
            </div>
            <p class="text-[11px] text-slate-500 italic mb-2">
              US Navy / DoD / Federal Acquisition Regulation discipline.  Every rule cites a Reachable-Now public FAR / DFARS / MIL-STD / DoD-FMR URL a Contracting Officer, KO, or COR can click + verify.  Pin any set to your contract.
            </p>
            <ul class="space-y-2">
              <li
                v-for="g in navyGuidelines"
                :key="g.id"
                class="bg-white border border-blue-200 rounded-xl shadow-sm p-4 space-y-2"
                :class="isPinned(g.id) ? 'opacity-60' : ''"
              >
                <div class="flex items-start gap-2 flex-wrap">
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-bold text-slate-800">
                      <span class="font-mono text-blue-700">{{ g.tag }}.v{{ g.version }}</span>
                      <span class="text-slate-500 font-normal ml-2">{{ g.title || '' }}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 italic mt-0.5">{{ fmtDate(g.date) }} · {{ g.source }}</p>
                    <p class="text-[12px] text-slate-700 mt-1 leading-relaxed">{{ g.description }}</p>
                  </div>
                  <div class="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      class="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                      :title="`📥 Export ${g.tag}.v${g.version} as a Backup file — includes all Rules + citations, lossless.`"
                      @click="onExportGuideline(g)"
                    >📥 Export</button>
                    <button
                      v-if="props.contractId"
                      type="button"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors"
                      :class="isPinned(g.id)
                        ? 'bg-slate-200 text-slate-500 cursor-default'
                        : 'bg-blue-600 text-white hover:bg-blue-500'"
                      :title="isPinned(g.id) ? 'Already pinned to this contract' : `Pin ${g.tag}.v${g.version} to this contract — its Rules will drive the next redraft + standards check.`"
                      @click="togglePin(g)"
                    >{{ isPinned(g.id) ? '✓ Pinned' : '📌 Pin' }}</button>
                  </div>
                </div>
                <button
                  type="button"
                  class="text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                  @click="toggleExpanded(g.id)"
                >{{ expanded.has(g.id) ? '▾' : '▸' }} {{ activeRules(g).length }} active Rule{{ activeRules(g).length === 1 ? '' : 's' }}</button>
                <ul v-if="expanded.has(g.id)" class="space-y-1.5 mt-1">
                  <li
                    v-for="r in g.rules"
                    :key="r.id"
                    class="border rounded-lg p-3 space-y-1"
                    :class="r.status === 'rejected' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-blue-100'"
                  >
                    <div class="flex items-start gap-2 flex-wrap">
                      <span class="font-mono text-[11px] font-bold text-blue-700">{{ g.tag }}.{{ r.tag }}.v{{ r.version }}</span>
                      <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ring-1" :class="severityClass(r.severity)">{{ r.severity }}</span>
                      <span v-if="r.status === 'rejected'" class="text-[10px] font-bold text-slate-500 uppercase">rejected</span>
                    </div>
                    <p class="text-[12px] font-semibold text-slate-800">{{ r.title || r.tag }}</p>
                    <p class="text-[11px] text-slate-600 leading-snug"><strong class="text-slate-700">Justification:</strong> {{ r.justification }}</p>
                    <p class="text-[10px] text-slate-500"><strong>Source:</strong> {{ r.source }}</p>
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <!-- Section 4 · Saved Guidelines -->
          <section>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-base" aria-hidden="true">🗂</span>
              <h2 class="text-[13px] font-extrabold uppercase tracking-[0.14em] text-slate-700">Saved Guidelines</h2>
              <span class="text-[11px] text-slate-500 tabular-nums">{{ savedGuidelines.length }} saved</span>
            </div>
            <p v-if="savedGuidelines.length === 0" class="text-[12px] text-slate-500 italic bg-white border border-dashed border-slate-300 rounded-xl p-4">
              No saved Guidelines yet. Phase 3.5B will let you fork from SEM Recommended or import from external standards.
            </p>
          </section>

          <p class="text-center text-[10px] text-slate-400 italic max-w-xl mx-auto leading-relaxed pt-4 border-t border-slate-200">
            Phase 3.5A — viewing, pinning, rejecting/reactivating Rules. Phase 3.5B will add full Rule CRUD forms (Edit / Add / Fork), AI-suggested mnemonic tags, structured whereChecked tickboxes, and AI-prompt wiring so the rewrites engine actually uses the active rule set.
          </p>
        </ScrollContainer>

        <!-- Edit form placeholder modal -->
        <div
          v-if="editingRuleId"
          class="absolute inset-0 z-[10] flex items-center justify-center bg-black/40"
          @click.self="closeEditDialog"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-5 space-y-3">
            <div class="flex items-center gap-2">
              <span aria-hidden="true">✏️</span>
              <p class="text-sm font-bold text-slate-800 flex-1">Edit Rule (Phase 3.5B)</p>
              <CloseDot
                size="md"
                variant="on-light"
                aria-label="Close edit dialog"
                @click="closeEditDialog"
              />
            </div>
            <p class="text-[12px] text-slate-600 leading-relaxed">
              Full Rule editing form lands in <strong>Phase 3.5B</strong> — it'll let you edit tag, justification, source, exceptions, how-to-correct, severity, and the structured whereChecked tickboxes. Edits fork a new version (original preserved with status=<code class="bg-slate-100 px-1 rounded">edited</code>) per Universal Undo SUPREME.
            </p>
            <p class="text-[11px] text-slate-500 italic">
              The data layer (<code class="bg-slate-100 px-1 rounded">useGuidelineLibrary.editRule()</code>) is already wired and ready. Only the form UI is pending.
            </p>
            <div class="flex justify-end pt-2">
              <button
                type="button"
                class="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                @click="closeEditDialog"
              >Close</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>
