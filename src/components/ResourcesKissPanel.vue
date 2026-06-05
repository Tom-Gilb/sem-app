<!-- ResourcesKissPanel.vue — Stage 10 / Resources KISS panel.
     KISS = Keep Improvement Super Surprising.
     Shows the 5 most cost-effective spec improvements to enable dramatic early
     improvement in Resources, each with a Change Differential Diagram and 4 alternatives.

     Tom Gilb 2026-06-05 verbatim:
       "Tell me the 5 most cost-effective spec improvements I can do now (in any spec type)
        to enable the most dramatic early improvement in resources."
       "Visual presentation of the changes in color would be great, invent a visual
        CHANGE DIFFERENTIAL Diagram... BLOW OUR mind with KISSES."

     Composes WITH:
       • CloseDot rule — on-dark close affordance at top-right.
       • ScrollContainer rule — all overflow-y-auto wrapped.
       • Teleport to body — same pattern as ResourcesSharpenPanel.
       • DD-009 Interaction Disclosure — every interactive element has a title.
       • Claude-Code-as-AI-Layer — all suggestions are static computation, no API calls.
       • Colorful HTML rule — vivid colors per entry type throughout. -->

<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { SpecBlock, REntry } from '../types/spec'
import { useToast } from '../composables/useToast'
import {
  computeKissImprovements,
  type KissImprovement,
  type KissAlternative,
  type ChangeDiff,
  type DiffZone,
  type DiffDirection,
  type KissChangeType,
} from '../composables/useKissAnalysis'

// ─── Props & emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
}>()

const emit = defineEmits<{ close: [] }>()

const { showToast } = useToast()

// ─── State ────────────────────────────────────────────────────────────────────

const focusedResourceIds = ref<string[]>([])
const newResourceInput   = ref('')
const customResources    = ref<string[]>([])
const kissReady          = ref(false)
const improvements       = ref<KissImprovement[]>([])
const expandedAltId      = ref<string | null>(null)
const setupCollapsed     = ref(false)

const specResources = computed<REntry[]>(() => props.spec?.resources ?? [])

// ─── Resource focus toggle ────────────────────────────────────────────────────

function toggleFocusResource(id: string): void {
  if (focusedResourceIds.value.includes(id)) {
    focusedResourceIds.value = focusedResourceIds.value.filter(r => r !== id)
  } else {
    focusedResourceIds.value = [...focusedResourceIds.value, id]
  }
}

function addCustomResource(): void {
  const trimmed = newResourceInput.value.trim()
  if (!trimmed) return
  customResources.value = [...customResources.value, trimmed]
  newResourceInput.value = ''
  showToast(`Resource added: ${trimmed}`)
}

function removeCustomResource(i: number): void {
  customResources.value = customResources.value.filter((_, idx) => idx !== i)
}

// ─── Compute KISS ─────────────────────────────────────────────────────────────

function computeKiss(): void {
  improvements.value = computeKissImprovements(
    props.spec,
    focusedResourceIds.value,
    customResources.value,
  )
  kissReady.value = true
  setupCollapsed.value = true
  showToast('5 KISS improvements computed!')
}

// ─── Alternatives accordion ───────────────────────────────────────────────────

function toggleAlts(improvementId: string): void {
  expandedAltId.value = expandedAltId.value === improvementId ? null : improvementId
}

// ─── Keyboard close ───────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

// Reset state when panel reopens
watch(() => props.open, (open) => {
  if (open) {
    kissReady.value = false
    improvements.value = []
    expandedAltId.value = null
    setupCollapsed.value = false
    focusedResourceIds.value = []
    customResources.value = []
    newResourceInput.value = ''
  }
})

// ─── Visual helpers ───────────────────────────────────────────────────────────

const ZONE_COLORS: Record<DiffZone, string> = {
  violation: '#ef4444',
  tolerable: '#f59e0b',
  goal:      '#34d399',
  wish:      '#2dd4bf',
  new:       '#22d3ee',
  na:        '#475569',
}

const CHANGE_TYPE_LABELS: Record<KissChangeType, string> = {
  'constraint-relax':  'Constraint Relax',
  'solution-add':      'Solution Add',
  'value-goal-relax':  'Goal Relax',
  'resource-realloc':  'Realloc',
  'stakeholder-power': 'Stakeholder',
}

const CHANGE_TYPE_COLORS: Record<KissChangeType, string> = {
  'constraint-relax':  'bg-red-500/20 text-red-300 border border-red-500/40',
  'solution-add':      'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  'value-goal-relax':  'bg-violet-500/20 text-violet-300 border border-violet-500/40',
  'resource-realloc':  'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  'stakeholder-power': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
}

const RANK_BORDER_COLORS: Record<number, string> = {
  1: 'border-amber-400',   // gold
  2: 'border-slate-400',   // silver
  3: 'border-amber-700',   // bronze
  4: 'border-cyan-400',
  5: 'border-violet-400',
}

const RANK_BADGE_COLORS: Record<number, string> = {
  1: 'bg-amber-400 text-amber-950',
  2: 'bg-slate-400 text-slate-950',
  3: 'bg-amber-700 text-amber-100',
  4: 'bg-cyan-400 text-cyan-950',
  5: 'bg-violet-400 text-violet-950',
}

const ALT_RANK_BORDER: Record<number, string> = {
  1: 'border-l-amber-400',
  2: 'border-l-slate-400',
  3: 'border-l-amber-700',
  4: 'border-l-slate-500',
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  value:      'V.',
  resource:   'R.',
  solution:   'S.',
  constraint: 'C.',
}

const ENTRY_TYPE_COLOR: Record<string, string> = {
  value:      'text-violet-300',
  resource:   'text-amber-300',
  solution:   'text-emerald-300',
  constraint: 'text-red-300',
}

function zoneColor(zone: DiffZone): string {
  return ZONE_COLORS[zone]
}

function deltaArrow(dir: DiffDirection, resourceDeltaPct: number): string {
  if (dir === 'up')      return '↑'
  if (dir === 'down')    return resourceDeltaPct < 0 ? '↓' : '↓'
  if (dir === 'new')     return '✦'
  if (dir === 'relaxed') return '◈'
  return '→'
}

function deltaArrowColor(dir: DiffDirection, resourceDeltaPct: number, entryType: string): string {
  if (dir === 'up') return 'text-emerald-400'
  if (dir === 'down') {
    // resource savings (negative) = good = amber; value degraded = red
    if (entryType === 'resource' && resourceDeltaPct < 0) return 'text-amber-400'
    if (entryType === 'value') return 'text-red-400'
    return 'text-amber-400'
  }
  if (dir === 'new')     return 'text-cyan-400'
  if (dir === 'relaxed') return 'text-violet-400'
  return 'text-slate-400'
}

function deltaLabelColor(dir: DiffDirection, resourceDeltaPct: number, entryType: string): string {
  if (dir === 'new')     return 'text-cyan-400 font-bold'
  if (dir === 'relaxed') return 'text-violet-300 font-bold'
  if (dir === 'up')      return 'text-emerald-400 font-bold'
  if (dir === 'down') {
    if (entryType === 'resource' && resourceDeltaPct < 0) return 'text-green-400 font-bold'
    return 'text-red-400 font-bold'
  }
  return 'text-slate-400'
}

function roiColor(roi: number): string {
  if (roi >= 4.0) return 'text-amber-300 font-bold'
  if (roi >= 3.0) return 'text-emerald-300 font-bold'
  if (roi >= 2.0) return 'text-cyan-300 font-bold'
  return 'text-slate-300'
}

function savingColor(pct: number): string {
  if (pct < 0) return 'text-green-400 font-bold'
  if (pct > 0) return 'text-red-400 font-bold'
  return 'text-slate-400'
}

function barWidth(pct: number): string {
  const clamped = Math.min(130, Math.max(0, pct))
  return `${(clamped / 130) * 100}%`
}

function tickLeft(pct: number): string {
  const clamped = Math.min(130, Math.max(0, pct))
  return `${(clamped / 130) * 100}%`
}

function resourceDeltaSign(pct: number): string {
  if (pct < 0) return `−${Math.abs(pct)}%`
  if (pct > 0) return `+${pct}%`
  return '±0%'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="kiss-fade">
      <div v-if="open" class="fixed inset-0 z-[700] flex items-center justify-center" aria-modal="true" role="dialog" aria-label="KISS Analysis Panel">

        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/75 backdrop-blur-sm"
          @click="emit('close')"
          aria-hidden="true"
        />

        <!-- Panel -->
        <div class="relative z-10 flex flex-col w-full max-w-4xl mx-4 rounded-2xl overflow-hidden shadow-2xl shadow-violet-950/50 border border-violet-800/30"
             style="max-height: 92vh;">

          <!-- ─── Header ─────────────────────────────────────────────────── -->
          <header class="bg-gradient-to-r from-violet-950 via-indigo-900 to-slate-950 px-6 py-4 flex items-start justify-between gap-4 shrink-0 border-b border-violet-800/30">
            <div class="flex items-start gap-4">
              <!-- KISS acronym block -->
              <div class="shrink-0 rounded-xl bg-violet-900/60 border border-violet-600/40 px-3 py-2 text-center">
                <div class="text-[10px] font-mono leading-tight space-y-0.5">
                  <div><span class="text-amber-300 font-bold">K</span><span class="text-slate-400"> — Keep</span></div>
                  <div><span class="text-cyan-300 font-bold">I</span><span class="text-slate-400"> — Improvement</span></div>
                  <div><span class="text-emerald-300 font-bold">S</span><span class="text-slate-400"> — Super</span></div>
                  <div><span class="text-violet-300 font-bold">S</span><span class="text-slate-400"> — Surprising</span></div>
                </div>
              </div>
              <!-- Title -->
              <div>
                <h1 class="text-white text-xl font-bold tracking-tight leading-tight">
                  KISS Analysis
                </h1>
                <p class="text-violet-300 text-xs mt-0.5 leading-relaxed">
                  5 most cost-effective spec improvements for dramatic early Resource gains
                </p>
                <p class="text-slate-400 text-[10px] mt-1 italic">
                  Constraint relaxation · Solution adds · Goal renegotiation · Reallocation · Stakeholder power
                </p>
              </div>
            </div>
            <CloseDot
              size="lg"
              variant="on-dark"
              aria-label="Close KISS panel"
              title="Close KISS Analysis [-> Esc"
              @click="emit('close')"
              class="shrink-0 mt-0.5"
            />
          </header>

          <!-- ─── Setup strip (Phase A) ──────────────────────────────────── -->
          <div class="bg-slate-900/80 border-b border-slate-700/50 shrink-0">

            <!-- Collapsed summary row -->
            <div v-if="setupCollapsed" class="px-6 py-2 flex items-center gap-3">
              <span class="text-slate-400 text-xs">Focus:</span>
              <span class="text-slate-300 text-xs">
                {{ focusedResourceIds.length === 0 ? 'All resources' : focusedResourceIds.join(', ') }}
                <template v-if="customResources.length > 0">
                  + {{ customResources.length }} custom
                </template>
              </span>
              <button
                class="ml-auto text-violet-400 text-xs hover:text-violet-300 underline underline-offset-2"
                title="Adjust focus settings and recompute"
                @click="setupCollapsed = false; kissReady = false"
              >
                Adjust &amp; Recompute
              </button>
            </div>

            <!-- Expanded setup form -->
            <div v-else class="px-6 py-4 space-y-4">

              <!-- Focus resources row -->
              <div>
                <p class="text-slate-300 text-xs font-semibold mb-2">
                  Focus resources (tick to filter; unticked = all resources):
                </p>
                <div v-if="specResources.length > 0" class="flex flex-wrap gap-2">
                  <label
                    v-for="r in specResources"
                    :key="r.id"
                    class="flex items-center gap-1.5 cursor-pointer rounded-lg px-3 py-1.5 border text-xs transition-colors"
                    :class="focusedResourceIds.includes(r.id)
                      ? 'bg-violet-800/50 border-violet-500 text-violet-200'
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'"
                    :title="`Toggle focus on ${r.description}`"
                  >
                    <input
                      type="checkbox"
                      class="rounded accent-violet-500"
                      :checked="focusedResourceIds.includes(r.id)"
                      @change="toggleFocusResource(r.id)"
                    />
                    <span class="text-amber-300 font-mono font-semibold">R.</span>
                    {{ r.description.length > 35 ? r.description.slice(0, 34) + '…' : r.description }}
                  </label>
                </div>
                <p v-else class="text-slate-500 text-xs italic">
                  No R. entries in current spec — KISS will analyse all resource types generically.
                </p>
              </div>

              <!-- Custom resources -->
              <div>
                <p class="text-slate-300 text-xs font-semibold mb-2">
                  Add a new resource to optimise for (optional):
                </p>
                <div class="flex items-center gap-2">
                  <input
                    v-model="newResourceInput"
                    type="text"
                    placeholder="e.g. Specialist consultant hours"
                    class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                    @keydown.enter="addCustomResource"
                    title="Type a resource description and press Enter or click Add"
                  />
                  <button
                    class="bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    title="Add this custom resource to KISS analysis"
                    @click="addCustomResource"
                  >
                    + Add
                  </button>
                </div>
                <!-- Custom resource chips -->
                <div v-if="customResources.length > 0" class="flex flex-wrap gap-2 mt-2">
                  <span
                    v-for="(cr, i) in customResources"
                    :key="i"
                    class="flex items-center gap-1 bg-cyan-900/50 border border-cyan-700/50 text-cyan-300 text-[11px] px-2 py-0.5 rounded-full"
                  >
                    {{ cr }}
                    <button
                      class="text-cyan-500 hover:text-red-400 ml-0.5"
                      :title="`Remove custom resource: ${cr}`"
                      @click="removeCustomResource(i)"
                    >
                      ×
                    </button>
                  </span>
                </div>
              </div>

              <!-- Compute button -->
              <div class="flex items-center justify-between pt-1">
                <p class="text-slate-500 text-[11px] italic max-w-md">
                  KISS analyses your spec using Planguage VDT logic to find the 5 highest-ROI changes.
                  All analysis is deterministic — powered by Claudian, not an embedded API.
                </p>
                <button
                  class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all hover:shadow-violet-500/30"
                  title="Compute 5 KISS improvements from this spec and resource focus"
                  @click="computeKiss"
                >
                  ▶ Compute 5 KISS Improvements
                </button>
              </div>
            </div>
          </div>

          <!-- ─── Phase B: Results (scrollable) ──────────────────────────── -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="h-full px-4 py-4 space-y-6"
            fade-from="#0f172a"
            :no-pill="false"
          >

            <!-- Pre-compute teaser -->
            <div v-if="!kissReady" class="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div class="text-6xl">💋</div>
              <h2 class="text-white text-2xl font-bold">Ready for your KISS?</h2>
              <p class="text-slate-400 text-sm max-w-md">
                Configure focus above and click
                <span class="text-violet-300 font-semibold">▶ Compute 5 KISS Improvements</span>
                to reveal the 5 most cost-effective spec improvements for dramatic Resource gains.
              </p>
              <div class="grid grid-cols-2 gap-3 mt-2 max-w-lg text-xs">
                <div class="bg-red-900/30 border border-red-800/50 rounded-lg p-3 text-left">
                  <div class="text-red-300 font-semibold mb-1">◈ Constraint Relax</div>
                  <div class="text-slate-400">Phase regulatory constraints to release immediate resource overhead</div>
                </div>
                <div class="bg-emerald-900/30 border border-emerald-800/50 rounded-lg p-3 text-left">
                  <div class="text-emerald-300 font-semibold mb-1">✦ Solution Add</div>
                  <div class="text-slate-400">Targeted high-ROI solution that maximises value per resource unit</div>
                </div>
                <div class="bg-violet-900/30 border border-violet-800/50 rounded-lg p-3 text-left">
                  <div class="text-violet-300 font-semibold mb-1">↓ Goal Relax</div>
                  <div class="text-slate-400">OPTIMA renegotiation — system already meets relaxed target</div>
                </div>
                <div class="bg-amber-900/30 border border-amber-800/50 rounded-lg p-3 text-left">
                  <div class="text-amber-300 font-semibold mb-1">⇄ Reallocation</div>
                  <div class="text-slate-400">Zero net budget change, better ROI distribution across resources</div>
                </div>
              </div>
            </div>

            <!-- Improvement cards -->
            <template v-else>
              <div
                v-for="imp in improvements"
                :key="imp.id"
                class="rounded-xl bg-slate-900 border-2 overflow-hidden"
                :class="RANK_BORDER_COLORS[imp.rank]"
              >
                <!-- Card header -->
                <div class="px-4 pt-4 pb-3 flex items-start gap-3">
                  <!-- Rank badge -->
                  <div
                    class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shadow-md"
                    :class="RANK_BADGE_COLORS[imp.rank]"
                    :title="`KISS Improvement #${imp.rank} — ranked by ROI`"
                  >
                    {{ imp.rank }}
                  </div>
                  <!-- Title block -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        :class="CHANGE_TYPE_COLORS[imp.changeType]"
                      >
                        {{ CHANGE_TYPE_LABELS[imp.changeType] }}
                      </span>
                      <span class="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-600">
                        ROI <span :class="roiColor(imp.roi)">{{ imp.roi.toFixed(1) }}×</span>
                      </span>
                      <span v-if="imp.resourceSavingPct < 0" class="text-[11px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full border border-green-700/40">
                        Resource {{ resourceDeltaSign(imp.resourceSavingPct) }}
                      </span>
                      <span v-else-if="imp.resourceSavingPct > 0" class="text-[11px] bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-700/40">
                        Resource +{{ imp.resourceSavingPct }}%
                      </span>
                    </div>
                    <h3 class="text-white text-sm font-bold leading-snug">{{ imp.title }}</h3>
                    <p class="text-slate-300/80 text-xs italic mt-0.5 leading-relaxed">{{ imp.headline }}</p>
                  </div>
                </div>

                <!-- ─── Change Differential Diagram ─────────────────────── -->
                <div class="mx-4 mb-3 rounded-lg bg-slate-950 border border-slate-700/60 overflow-hidden">
                  <!-- Diagram header -->
                  <div class="px-3 py-2 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/60">
                    <span class="text-slate-300 text-[11px] font-semibold tracking-wide uppercase">Change Differential Diagram</span>
                    <span class="text-slate-500 text-[10px]">CURRENT STATE → PROPOSED STATE</span>
                  </div>

                  <!-- Diff rows -->
                  <div class="px-3 py-2 space-y-2">
                    <div
                      v-for="diff in imp.diffs"
                      :key="diff.entryId"
                      class="flex items-center gap-2"
                      :class="diff.isPrimary ? 'opacity-100' : 'opacity-70'"
                    >
                      <!-- Entry type badge -->
                      <span
                        class="shrink-0 w-6 text-center text-[11px] font-bold font-mono"
                        :class="ENTRY_TYPE_COLOR[diff.entryType]"
                        :title="`${diff.entryType} entry`"
                      >{{ ENTRY_TYPE_LABEL[diff.entryType] }}</span>

                      <!-- Entry label -->
                      <span
                        class="shrink-0 text-[11px] text-slate-300 min-w-0 truncate"
                        style="width: 120px;"
                        :title="diff.entryLabel"
                        :class="diff.isPrimary ? '' : 'text-slate-500 italic'"
                      >{{ diff.entryLabel }}</span>

                      <!-- Before bar -->
                      <div class="relative rounded-full overflow-hidden bg-slate-800 shrink-0"
                           style="width: 130px; height: 22px;"
                           :title="`Before: ${diff.before.label}`">
                        <!-- Progress fill -->
                        <div
                          v-if="diff.before.zone !== 'na'"
                          class="absolute inset-y-0 left-0 rounded-full"
                          :style="{
                            width: barWidth(diff.before.barPct),
                            background: zoneColor(diff.before.zone),
                            opacity: '0.8',
                          }"
                        />
                        <!-- Tolerable tick -->
                        <div
                          v-if="diff.before.tolerablePct > 0"
                          class="absolute inset-y-0 w-px bg-amber-300/70"
                          :style="{ left: tickLeft(diff.before.tolerablePct) }"
                        />
                        <!-- Goal tick -->
                        <div
                          v-if="diff.before.goalPct > 0"
                          class="absolute inset-y-0 w-0.5 bg-emerald-400/90"
                          :style="{ left: tickLeft(diff.before.goalPct) }"
                        />
                        <!-- Zone label -->
                        <span class="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white/70 mix-blend-screen px-1 truncate">
                          {{ diff.before.label }}
                        </span>
                      </div>

                      <!-- Delta arrow -->
                      <span
                        class="shrink-0 text-base font-bold w-5 text-center"
                        :class="deltaArrowColor(diff.direction, diff.resourceDeltaPct, diff.entryType)"
                        :title="`Change direction: ${diff.direction}`"
                      >{{ deltaArrow(diff.direction, diff.resourceDeltaPct) }}</span>

                      <!-- After bar -->
                      <div class="relative rounded-full overflow-hidden bg-slate-800 shrink-0"
                           style="width: 130px; height: 22px;"
                           :title="`After: ${diff.after.label}`">
                        <div
                          v-if="diff.after.zone !== 'na'"
                          class="absolute inset-y-0 left-0 rounded-full"
                          :style="{
                            width: barWidth(diff.after.barPct),
                            background: zoneColor(diff.after.zone),
                            opacity: diff.after.zone === 'new' ? '0.9' : '0.8',
                          }"
                        />
                        <!-- Tolerable tick -->
                        <div
                          v-if="diff.after.tolerablePct > 0"
                          class="absolute inset-y-0 w-px bg-amber-300/70"
                          :style="{ left: tickLeft(diff.after.tolerablePct) }"
                        />
                        <!-- Goal tick -->
                        <div
                          v-if="diff.after.goalPct > 0"
                          class="absolute inset-y-0 w-0.5 bg-emerald-400/90"
                          :style="{ left: tickLeft(diff.after.goalPct) }"
                        />
                        <span class="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white/70 mix-blend-screen px-1 truncate">
                          {{ diff.after.label }}
                        </span>
                      </div>

                      <!-- Delta label -->
                      <span
                        class="shrink-0 text-[11px] w-20 text-right"
                        :class="deltaLabelColor(diff.direction, diff.resourceDeltaPct, diff.entryType)"
                        :title="`Delta: ${diff.deltaLabel}`"
                      >{{ diff.deltaLabel }}</span>
                    </div>

                    <!-- Bar legend row -->
                    <div class="flex items-center gap-4 pt-1.5 border-t border-slate-700/40">
                      <div class="flex items-center gap-1">
                        <div class="w-3 h-2 rounded-sm" style="background:#ef4444;opacity:0.8"></div>
                        <span class="text-[9px] text-slate-500">Violation</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="w-3 h-2 rounded-sm" style="background:#f59e0b;opacity:0.8"></div>
                        <span class="text-[9px] text-slate-500">Tolerable</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="w-3 h-2 rounded-sm" style="background:#34d399;opacity:0.8"></div>
                        <span class="text-[9px] text-slate-500">Goal</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="w-3 h-2 rounded-sm" style="background:#22d3ee;opacity:0.9"></div>
                        <span class="text-[9px] text-slate-500">New</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="w-px h-3" style="background:#34d399;opacity:0.9"></div>
                        <span class="text-[9px] text-slate-500">Goal marker</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="w-px h-3" style="background:#f59e0b;opacity:0.7"></div>
                        <span class="text-[9px] text-slate-500">Tolerable marker</span>
                      </div>
                    </div>
                  </div>

                  <!-- Net impact footer -->
                  <div class="px-3 py-2 bg-slate-900/60 border-t border-slate-700/50 flex items-center gap-4 flex-wrap">
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-500 text-[11px]">Values → Goal:</span>
                      <span class="text-emerald-400 text-xs font-bold">+{{ imp.valuesLiftedToGoal }}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-500 text-[11px]">Resources:</span>
                      <span class="text-xs font-bold" :class="savingColor(imp.resourceSavingPct)">
                        {{ resourceDeltaSign(imp.resourceSavingPct) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-500 text-[11px]">ROI:</span>
                      <span class="text-xs font-bold" :class="roiColor(imp.roi)">{{ imp.roi.toFixed(1) }}×</span>
                    </div>
                    <div class="flex items-center gap-1.5 ml-auto">
                      <span class="text-violet-400/60 text-[10px] italic">{{ imp.gilbCite }}</span>
                    </div>
                  </div>
                </div>

                <!-- Explanation -->
                <div class="px-4 pb-3">
                  <p class="text-slate-300 text-xs leading-relaxed">{{ imp.explanation }}</p>
                </div>

                <!-- ─── Alternatives accordion ─────────────────────────── -->
                <div class="border-t border-slate-700/50">
                  <button
                    class="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left"
                    :title="`Toggle 4 alternative approaches for improvement #${imp.rank}`"
                    @click="toggleAlts(imp.id)"
                  >
                    <span class="text-slate-400 text-xs font-semibold">
                      {{ expandedAltId === imp.id ? '▲' : '▼' }}
                      4 Alternative Approaches
                    </span>
                    <span class="text-slate-600 text-[11px]">
                      Best alternative: {{ imp.alternatives[0]?.title?.slice(0, 40) }}…
                    </span>
                  </button>

                  <Transition name="alt-expand">
                    <div v-if="expandedAltId === imp.id" class="px-4 pb-4 space-y-2">
                      <div
                        v-for="alt in imp.alternatives"
                        :key="alt.rank"
                        class="rounded-lg bg-slate-800 border-l-4 p-3"
                        :class="ALT_RANK_BORDER[alt.rank]"
                      >
                        <div class="flex items-start justify-between gap-2 mb-1">
                          <div class="flex items-center gap-2">
                            <!-- Alt rank badge -->
                            <span
                              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                              :class="alt.rank === 1 ? 'bg-amber-400 text-amber-950' :
                                      alt.rank === 2 ? 'bg-slate-400 text-slate-950' :
                                      alt.rank === 3 ? 'bg-amber-700 text-amber-100' :
                                                       'bg-slate-600 text-slate-200'"
                            >{{ alt.rank }}</span>
                            <span class="text-white text-xs font-bold leading-snug">{{ alt.title }}</span>
                          </div>
                          <!-- Stats -->
                          <div class="flex items-center gap-2 shrink-0">
                            <span
                              class="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                              :class="alt.resourceDeltaPct < 0 ? 'bg-green-900/40 text-green-400' :
                                      alt.resourceDeltaPct > 0 ? 'bg-red-900/40 text-red-400' :
                                                                   'bg-slate-700 text-slate-400'"
                            >{{ resourceDeltaSign(alt.resourceDeltaPct) }}</span>
                            <span v-if="alt.valueDeltaCount > 0" class="text-[11px] bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                              +{{ alt.valueDeltaCount }}V↑
                            </span>
                          </div>
                        </div>
                        <p class="text-slate-300 text-[11px] leading-relaxed mb-1.5">{{ alt.description }}</p>
                        <div class="flex flex-wrap gap-2">
                          <span v-if="alt.tradeoff" class="text-[10px] bg-amber-900/30 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full">
                            ⚠ {{ alt.tradeoff }}
                          </span>
                          <span v-if="alt.approvalNeeded" class="text-[10px] bg-red-900/30 text-red-300 border border-red-700/40 px-2 py-0.5 rounded-full">
                            [!] {{ alt.approvalNeeded }}
                          </span>
                          <span v-if="alt.gilbCite" class="text-[10px] text-violet-400/70 italic">
                            {{ alt.gilbCite }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Bottom nav mirror (DD-014) -->
              <div class="border-t border-slate-700/40 pt-4 mt-2 flex justify-end">
                <button
                  class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                  title="Close KISS Analysis panel [-> Esc"
                  @click="emit('close')"
                >
                  Done / Close
                </button>
              </div>
            </template>

          </ScrollContainer>

          <!-- ─── Footer ─────────────────────────────────────────────────── -->
          <footer class="bg-slate-950 border-t border-slate-700/50 px-6 py-3 flex items-center justify-between shrink-0">
            <p class="text-slate-500 text-[10px] italic">
              Gilb — Competitive Engineering + EVO 2024 + Stakeholder Engineering · Claude-Code-as-AI-Layer
            </p>
            <button
              class="text-slate-400 hover:text-white text-xs font-semibold transition-colors"
              title="Close KISS Analysis panel [-> Esc"
              @click="emit('close')"
            >
              Close [->
            </button>
          </footer>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.kiss-fade-enter-active,
.kiss-fade-leave-active {
  transition: opacity 200ms ease;
}
.kiss-fade-enter-from,
.kiss-fade-leave-to {
  opacity: 0;
}

.alt-expand-enter-active,
.alt-expand-leave-active {
  transition: max-height 250ms ease, opacity 200ms ease;
  overflow: hidden;
  max-height: 800px;
}
.alt-expand-enter-from,
.alt-expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
