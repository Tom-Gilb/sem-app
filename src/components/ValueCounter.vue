<!--
  ValueCounter.vue — 11-stage Planguage planning workflow bar.
  Rebuilt 2026-05-27 from design log r04–r37 + Planguage Spec Type Glyphs PDF v7.
  r07 2026-05-27: Active stage label bar (✦ ACTIVE, floats over glyph) + glyph bob animation.
  r08 2026-05-28: Horizontal scroll fix — native overflow-x-auto replaces ScrollContainer
                  (ScrollContainer only does vertical); scroll-to-active on stage change.
  r09 2026-05-28: Double-click stage tiles → StageInfoPanel (rich history/Planguage/examples).
                  250 ms timer separates single-click (navigate) from double-click (info).

  11 stages (left to right), each a 96×96px dark pill with:
    - Stage number badge (top-left, black/60 bg)
    - Official Planguage type glyph (PlTypeIcon) with neon stage-color glow
    - Stage label below
    - Single-click: navigate to that stage
    - Double-click: open StageInfoPanel with full Planguage description + examples
  Connected by 10 concave swept-back arrows, each:
    - Stroke width 3→9px (increasing momentum)
    - Color from the indigo→emerald sweep at the arrow's position
    - Single-click: open ArrowInfoPanel (History / Planguage / Fun Fact)

  Architecture principles (Architectural Resilience Rule, 2026-05-27):
    - Stages defined as data (STAGES const), not hardcoded in template
    - All colour math centralised in stageProgressColors.ts
    - PlTypeIcon is pure render — no click handling inside it
    - Arrow clicks handled by ValueCounter, not by icon components
    - Never locked: DD-007 — stages are cyclic workspace views, not sequential gates
    - Horizontal scroll: native overflow-x-auto on the inner flex div; auto-centers active stage

  Spec: F.ValueAccumulationCounter (#15).
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import PlTypeIcon from './icons/PlTypeIcon.vue'
import type { PlGlyphType } from './icons/PlTypeIcon.vue'
import ArrowInfoPanel from './ArrowInfoPanel.vue'
import StageInfoPanel from './StageInfoPanel.vue'
// ScrollContainer removed 2026-05-28: it wraps overflow-y-auto only; the stage bar
// needs horizontal scroll. Native overflow-x-auto + scrollWrapRef used instead.
import {
  pillProgressColor,
  stageProgressColor,
  arrowProgressColors,
  arrowShaftWidth,
} from '../utils/stageProgressColors'
import { useArrowInfoPanel } from '../composables/useArrowInfoPanel'

// ── Props / emits ──────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Active planning stage (1–11). Parent owns this value. */
  currentStage?: number
}>(), {
  currentStage: 1,
})

const emit = defineEmits<{
  /** User clicked a stage pill — parent should navigate to this stage. */
  'go-to-stage': [stage: number]
  /**
   * User clicked a FROM/TO glyph button in ArrowInfoPanel.
   * Bubbled to App.vue to open GlyphDataPanel (P2, 2026-05-27).
   */
  'open-glyph': [plType: PlGlyphType]
}>()

// ── Stage definitions ──────────────────────────────────────────────────────────

const STAGES: Array<{
  stage: number
  label: string
  plType: PlGlyphType
  title: string
}> = [
  { stage: 1,  label: 'Stakes',     plType: 'stakeholder', title: 'Stage 1 · Stakes — Who and what needs results. Identify all stakeholders: people, systems, laws, data. Inanimate stakeholders (GDPR, databases) are equally valid. Their needs define success.' },
  { stage: 2,  label: 'Solutions',  plType: 'solution',    title: 'Stage 2 · Solutions — How we will deliver value. Define candidate designs, strategies, and means that address stakeholder needs. Solutions are evaluated against Values and Constraints.' },
  { stage: 3,  label: 'Sharpen',    plType: 'function',    title: 'Stage 3 · Sharpen — What the system does. Clarify functions — binary capabilities that are either present or absent. Sharpen each to a precise presence test with no thresholds inside.' },
  { stage: 4,  label: 'Impacts',    plType: 'value',       title: 'Stage 4 · Impacts — How well we must perform. Define and quantify values with Scale, Meter, Tolerable, and Goal levels. Each value drives prioritisation by Value divided by Cost.' },
  { stage: 5,  label: 'Refine',     plType: 'constraint',  title: 'Stage 5 · Refine — Hard boundaries that must not be violated. Constraints are binary requirements: regulatory, budget, resource, or logical limits. Solutions must respect every constraint.' },
  { stage: 6,  label: 'Evo Steps',  plType: 'evo-step',    title: 'Stage 6 · Evo Steps — Incremental delivery cycles. Each Evo Step delivers measurable stakeholder value. Steps within a stage are sequentially independent — VDT picks freely.' },
  { stage: 7,  label: 'Evo Impact', plType: 'value',       title: 'Stage 7 · Evo Impact — Measure the impact of each Evo Step against Values. Which steps deliver the highest Value divided by Cost? This is the Planguage VDT prioritisation engine.' },
  { stage: 8,  label: 'Tasks',      plType: 'task',        title: 'Stage 8 · Tasks — Concrete work items for each Evo Step. Tasks are the engineering activities that implement solutions and produce deliverable results for stakeholders.' },
  { stage: 9,  label: 'Study-Act',  plType: 'evo-step',    title: 'Stage 9 · Study-Act — Learn from delivery. Measure actual results against Value goals, update the plan. This is the Deming PDSA Study and Act steps applied to Planguage Evo.' },
  { stage: 10, label: 'Plan',       plType: 'resource',    title: 'Stage 10 · Plan — Assign resources and schedule Evo Steps. Define who does what, with what budget, and in what sequence across the delivery lifecycle.' },
  { stage: 11, label: 'Export',     plType: 'constraint',  title: 'Stage 11 · Export — Share and publish the plan. Export the full Planguage specification as a formatted document, coloured HTML table, or JSON for Tom\'s Twin and downstream tools.' },
]

// ── Stage state helpers ────────────────────────────────────────────────────────

function stageStatus(s: number): 'done' | 'current' | 'future' {
  if (props.currentStage > s) return 'done'
  if (props.currentStage === s) return 'current'
  return 'future'
}

/** Position index (0–10) for colour math. */
function pos(s: number): number {
  return s - 1
}

function pillStyle(s: number): Record<string, string> {
  const state = stageStatus(s)
  return {
    background: pillProgressColor(pos(s), state),
    opacity:    state === 'future' ? '0.65' : '1',
  }
}

function glowStyle(s: number): Record<string, string> {
  const col = stageProgressColor(pos(s))
  return { filter: `drop-shadow(0 0 9px ${col})` }
}

function badgeClass(s: number): string {
  const state = stageStatus(s)
  if (state === 'done')    return 'text-emerald-300'
  if (state === 'current') return 'text-indigo-200'
  return 'text-slate-300'
}

function labelClass(s: number): string {
  const state = stageStatus(s)
  if (state === 'done')    return 'text-emerald-300'
  if (state === 'current') return 'text-white'
  return 'text-slate-400'
}

// ── Navigation ─────────────────────────────────────────────────────────────────

function navigateToStage(stage: number): void {
  emit('go-to-stage', stage)
}

// ── Arrow info panel ───────────────────────────────────────────────────────────

const { openArrowIdx, openArrow, closeArrow } = useArrowInfoPanel()

// Arrow colors computed for each of the 10 connectors
const arrowData = computed(() =>
  Array.from({ length: 10 }, (_, idx) => {
    const { from, to } = arrowProgressColors(idx)
    const w = arrowShaftWidth(idx)
    return { idx, from, to, w }
  })
)

function arrowStyle(idx: number): Record<string, string> {
  const { from } = arrowProgressColors(idx)
  const state = stageStatus(idx + 1)  // arrow between stage idx+1 and idx+2
  return {
    filter: `drop-shadow(0 0 4px ${from})`,
    opacity: state === 'future' ? '0.88' : '1',
  }
}

// ── Stage info panel (double-click) ───────────────────────────────────────────
// Single-click = navigate; double-click = rich info panel for that stage.
// 250 ms timer: on first click start timer; second click within window = dblclick.

const openStageInfoIdx = ref<number | null>(null)
let _clickTimer: ReturnType<typeof setTimeout> | null = null

function handlePillClick(stage: number): void {
  if (_clickTimer) {
    // Second click arrived within 250 ms → treat as double-click → open info
    clearTimeout(_clickTimer)
    _clickTimer = null
    openStageInfoIdx.value = stage
  } else {
    // First click — wait to see if a second arrives
    _clickTimer = setTimeout(() => {
      _clickTimer = null
      navigateToStage(stage)  // single-click: navigate
    }, 250)
  }
}

function closeStageInfo(): void {
  openStageInfoIdx.value = null
}

// ── Scroll-to-active ──────────────────────────────────────────────────────────
// When currentStage changes, scroll the active pill into the center of the bar.
// Uses a plain ref on the overflow-x-auto wrapper (not ScrollContainer, which
// is vertical-only). Called on mount so the initial active tile is centered.

const scrollWrapRef = ref<HTMLDivElement | null>(null)
const pillRefs      = ref<HTMLButtonElement[]>([])

function scrollToActive(): void {
  nextTick(() => {
    const wrapper = scrollWrapRef.value
    if (!wrapper) return
    const idx  = STAGES.findIndex(s => s.stage === props.currentStage)
    const pill = pillRefs.value[idx]
    if (!pill) return
    // Center the pill within the scroll container
    const target = pill.offsetLeft - wrapper.clientWidth / 2 + pill.offsetWidth / 2
    wrapper.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  })
}

watch(() => props.currentStage, scrollToActive)
onMounted(scrollToActive)
</script>

<template>
  <!-- Full-width dark strip — parent handles breakout wrapper for px constraints. -->
  <!-- Design log r08 2026-05-27: `relative` added for absolute-positioned prev/next
       navigation buttons. Tom: "I cannot see how to progress from this stage.
       General rule: we can always go back and forth and clear buttons will enable it." -->
  <nav
    class="relative w-full bg-[#0f172a] py-3"
    aria-label="Planning stages"
    role="navigation"
  >
    <!-- ◀ Prev stage — left edge overlay, gradient fade into dark bar -->
    <button
      v-if="currentStage > 1"
      type="button"
      class="absolute left-0 top-0 bottom-0 z-20 flex items-center px-3
             bg-gradient-to-r from-[#0f172a] via-[#0f172a]/80 to-transparent
             text-white/70 hover:text-amber-300 transition-colors duration-200
             focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      :aria-label="`Previous stage: ${STAGES[currentStage - 2].label}`"
      :title="`◀ Stage ${currentStage - 1} · ${STAGES[currentStage - 2].label} — click or use arrow keys`"
      @click="navigateToStage(currentStage - 1)"
    >
      <span class="text-2xl leading-none font-bold" aria-hidden="true">◀</span>
    </button>

    <!-- Native overflow-x-auto: ScrollContainer only handles vertical scroll.
         scrollWrapRef + pillRefs allow scrollToActive to center the active tile.
         pr-20 ensures the last tile isn't hidden behind the ▶ Next button. -->
    <div
      ref="scrollWrapRef"
      class="overflow-x-auto scrollbar-none w-full"
      style="scroll-behavior: auto;"
    >
      <div class="flex items-end gap-3 px-16 pb-1 min-w-max">
      <template v-for="(step, idx) in STAGES" :key="step.stage">

        <!-- ── Stage pill ───────────────────────────────────────────── -->
        <!-- Single-click → navigate; Double-click → StageInfoPanel info.
             250 ms timer in handlePillClick() separates the two actions. -->
        <button
          :ref="(el) => { if (el) pillRefs[idx] = el as HTMLButtonElement }"
          type="button"
          class="relative flex flex-col items-center gap-1.5 shrink-0 focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl
                 transition-all duration-300 hover:scale-105 active:scale-95"
          :style="{ ...pillStyle(step.stage), width: '96px', height: '96px', borderRadius: '16px' }"
          :aria-label="`Stage ${step.stage}: ${step.label} — click to navigate, double-click for details`"
          :aria-current="step.stage === currentStage ? 'step' : undefined"
          :title="step.title + ' · Double-click for full Planguage description and examples.'"
          @click="handlePillClick(step.stage)"
        >
          <!-- Stage Halo — pulsating white ring on active stage (3s breathing animation) -->
          <div
            v-if="step.stage === currentStage"
            class="stage-halo absolute inset-0 pointer-events-none"
            style="border-radius: 16px; box-shadow: 0 0 0 3px rgba(255,255,255,0.85);"
            aria-hidden="true"
          />

          <!-- Number badge (top-left) -->
          <span
            class="absolute top-1.5 left-2 text-[13px] font-extrabold leading-none
                   bg-black/60 rounded-md px-1 py-0.5 z-10"
            :class="badgeClass(step.stage)"
            aria-hidden="true"
          >{{ step.stage }}</span>

          <!-- Active stage label bar — floats over the glyph with slow animation.
               Design log r07 · Tom Gilb 2026-05-27: "text in a bar on the step glyph…
               slow movement of it and maybe some sort of halo around it."
               z-20 ensures it renders above the halo ring (z-10). -->
          <div
            v-if="step.stage === currentStage"
            class="active-label-bar absolute z-20 pointer-events-none"
            style="top: 36px; left: 50%;"
            aria-hidden="true"
          >
            <span
              class="text-[8px] font-extrabold uppercase tracking-[0.12em] text-white
                     bg-white/25 rounded-full px-2 py-0.5 whitespace-nowrap
                     ring-1 ring-white/50"
            >✦ ACTIVE</span>
          </div>

          <!-- Planguage type glyph — bob wrapper active only, translated r18 -->
          <div :class="step.stage === currentStage ? 'glyph-bob' : ''">
            <div
              class="flex items-center justify-center translate-x-1 translate-y-2"
              :style="glowStyle(step.stage)"
              aria-hidden="true"
            >
              <PlTypeIcon :pl-type="step.plType" size="xl" />
            </div>
          </div>

          <!-- Stage label -->
          <span
            class="absolute bottom-1.5 left-0 right-0 text-center text-[10px]
                   font-bold leading-tight tracking-wide whitespace-normal px-1"
            :class="labelClass(step.stage)"
          >{{ step.label }}</span>
        </button>

        <!-- ── Arrow connector ──────────────────────────────────────── -->
        <button
          v-if="idx < STAGES.length - 1"
          type="button"
          class="relative shrink-0 flex items-center justify-center
                 hover:scale-110 active:scale-95 transition-transform
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded
                 group"
          style="width:64px; height:52px;"
          :aria-label="`${step.label} to ${STAGES[idx + 1].label} transition — click for Planguage history and details`"
          :title="`Stage ${step.stage}→${step.stage + 1}: ${step.label} flows into ${STAGES[idx + 1].label}. Each planning stage deepens your specification. Click for historical context, Planguage meaning, and a fun fact about this transition.`"
          @click="openArrow(idx)"
        >
          <svg
            viewBox="0 0 64 52"
            width="64"
            height="52"
            fill="none"
            :style="arrowStyle(idx)"
            aria-hidden="true"
          >
            <!-- Shaft — longer for bigger canvas -->
            <line
              x1="2" y1="26" x2="42" y2="26"
              :stroke="arrowData[idx].from"
              :stroke-width="arrowData[idx].w"
              stroke-linecap="round"
            />
            <!-- Concave swept-back arrowhead -->
            <path
              d="M 34,6 L 62,26 L 34,46 Q 50,26 34,6 Z"
              :fill="arrowData[idx].to"
            />
          </svg>
          <!-- Hover tooltip — stage transition label -->
          <span
            class="absolute pointer-events-none -top-8 left-1/2 -translate-x-1/2
                   bg-[#0f172a]/95 text-white text-[10px] font-medium
                   rounded-md px-2 py-1 shadow-lg whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >✦ {{ step.label }} → {{ STAGES[idx + 1].label }}</span>
        </button>

      </template>
      </div><!-- end min-w-max flex -->
    </div><!-- end overflow-x-auto -->

    <!-- ▶ Next stage — right edge overlay, gradient fade into dark bar -->
    <button
      v-if="currentStage < STAGES.length"
      type="button"
      class="absolute right-0 top-0 bottom-0 z-20 flex items-center px-3
             bg-gradient-to-l from-[#0f172a] via-[#0f172a]/80 to-transparent
             text-white/70 hover:text-amber-300 transition-colors duration-200
             focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      :aria-label="`Next stage: ${STAGES[currentStage].label}`"
      :title="`▶ Stage ${currentStage + 1} · ${STAGES[currentStage].label} — click to advance`"
      @click="navigateToStage(currentStage + 1)"
    >
      <span class="text-2xl leading-none font-bold" aria-hidden="true">▶</span>
    </button>
  </nav>

  <!-- Arrow info panel (Teleported to body) -->
  <ArrowInfoPanel
    :arrow-idx="openArrowIdx"
    @close="closeArrow()"
    @open-glyph="(type) => emit('open-glyph', type)"
  />

  <!-- Stage info panel — opens on double-click of any stage tile (Teleported to body) -->
  <StageInfoPanel
    :stage-idx="openStageInfoIdx"
    @close="closeStageInfo()"
    @open-glyph="(type) => emit('open-glyph', type)"
  />
</template>

<style scoped>
/* Stage Halo — pulsating white ring on current active stage pill.
   Tom Gilb 2026-05-24: "slow relaxing pulsating halo."
   Design log r06 · Visual Treatments table (SEMappHandbook p.33).
   scale 1.00 → 1.12 → 1.00, opacity 0.70 → 0.15 → 0.70, 3s ease-in-out. */
@keyframes stage-halo {
  0%   { transform: scale(1.00); opacity: 0.70; }
  50%  { transform: scale(1.12); opacity: 0.15; }
  100% { transform: scale(1.00); opacity: 0.70; }
}
.stage-halo {
  animation: stage-halo 3s ease-in-out infinite;
}

/* Active label bar — slow float over the glyph (Design log r07).
   Tom Gilb 2026-05-27: "text in a bar on the step glyph … slow movement."
   translateX(-50%) centres the pill horizontally; translateY bobs ±5px over 3s.
   Phase offset from stage-halo (2.5s) to avoid synchronised motion. */
@keyframes active-bar-float {
  0%   { transform: translateX(-50%) translateY(0px); }
  50%  { transform: translateX(-50%) translateY(-5px); }
  100% { transform: translateX(-50%) translateY(0px); }
}
.active-label-bar {
  animation: active-bar-float 3s ease-in-out infinite;
}

/* Glyph bob — gentle vertical bob on active stage glyph (Design log r07).
   2.5s cycle, slight phase offset from label bar, ±3px travel.
   Wraps the translate-x-1 translate-y-2 inner div so class transforms are unaffected. */
@keyframes glyph-bob {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-3px); }
  100% { transform: translateY(0px); }
}
.glyph-bob {
  animation: glyph-bob 2.5s ease-in-out infinite;
}
</style>
