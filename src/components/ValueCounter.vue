<!--
  ValueCounter.vue — 11-stage Planguage planning workflow bar.
  Rebuilt 2026-05-27 from design log r04–r37 + Planguage Spec Type Glyphs PDF v7.
  r07 2026-05-27: Active stage label bar (✦ ACTIVE, floats over glyph) + glyph bob animation.
  r08 2026-05-28: Horizontal scroll fix — native overflow-x-auto replaces ScrollContainer
                  (ScrollContainer only does vertical); scroll-to-active on stage change.
  r09 2026-05-28: Double-click stage tiles → StageInfoPanel (rich history/Planguage/examples).
                  250 ms timer separates single-click (drama popup) from double-click (info).
  r10 2026-05-28: Stage tile single-click → drama popup (stage-colored panel, neon glyph, CTA).
                  Arrow/tile hover tooltips now say 'click for INFO' / 'dbl-click for INFO'.
                  ⚡ emoji on amber button darkened via filter brightness(0.1).

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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import PlTypeIcon from './icons/PlTypeIcon.vue'
import type { PlGlyphType } from './icons/PlTypeIcon.vue'
import ArrowInfoPanel from './ArrowInfoPanel.vue'
import StageInfoPanel from './StageInfoPanel.vue'
import CloseDot from './CloseDot.vue'
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
  /**
   * Extra right padding (px) to prevent stage tiles being obscured by
   * fixed control-pin buttons at top-right. Pass ~440 when the full
   * SOS+Mic+Speaker+Actions cluster is visible; 0 when those buttons
   * live in the Plan Crest bar instead.
   * Twin-portable: pure CSS — no framework dependency.
   */
  extraRightPad?: number
}>(), {
  currentStage:  1,
  extraRightPad: 0,
})

const emit = defineEmits<{
  /** User clicked a stage pill — parent should navigate to this stage. */
  'go-to-stage': [stage: number]
  /**
   * User clicked a FROM/TO glyph button in ArrowInfoPanel.
   * Bubbled to App.vue to open GlyphDataPanel (P2, 2026-05-27).
   */
  'open-glyph': [plType: PlGlyphType]
  /**
   * User clicked the primary CTA in the drama popup for a stage.
   * App.vue handles the stage-specific action (navigate + trigger).
   */
  'stage-action': [stage: number]
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
  { stage: 10, label: 'Resources',  plType: 'resource',    title: 'Stage 10 · Resources — Estimate and allocate resource budgets (R. entries). Review Value/Cost ratios per Evo Step, assign capital and calendar budgets, and confirm all Constraints are respected before Export.' },
  { stage: 11, label: 'Export',     plType: 'constraint',  title: 'Stage 11 · Export — Share and publish the plan. Export the full Planguage specification as a formatted document, coloured HTML table, or JSON for Tom\'s Twin and downstream tools.' },
]

// ── Stage drama-popup CTA labels ──────────────────────────────────────────────
// Labels only — handlers live in App.vue (emits 'stage-action': [stage: number]).
// Must stay in sync with planningStageAction computed in App.vue.

const STAGE_CTAS: Record<number, string> = {
  1:  '✏️ Enter Stakes',
  2:  '0→* Edit Values',
  3:  '[*] Edit Solutions',
  4:  '✨ Sharpen Spec',
  5:  '📊 Estimate Impacts',
  6:  '⚡ Generate Evo Steps',
  7:  '📈 Evo Simulator',
  8:  '✅ Plan Tasks',
  9:  '📋 Study Results',
  10: '📦 Resources',
  11: '📤 Export Plan',
}

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
// Single-click = drama popover on the tile; double-click = full StageInfoPanel.
// 250 ms timer: on first click start timer; second click within window = dblclick.

const openStageInfoIdx = ref<number | null>(null)
let _clickTimer: ReturnType<typeof setTimeout> | null = null

function handlePillClick(stage: number): void {
  if (_clickTimer) {
    // Second click within 250 ms → double-click → open full info panel
    clearTimeout(_clickTimer)
    _clickTimer = null
    closeDramaPopover()
    openStageInfoIdx.value = stage
  } else {
    // First click — wait to see if a second arrives
    _clickTimer = setTimeout(() => {
      _clickTimer = null
      // Single-click: open drama popover on the tile (not navigate directly)
      const idx = STAGES.findIndex(s => s.stage === stage)
      const pill = pillRefs.value[idx]
      popoverAnchorRect.value = pill ? pill.getBoundingClientRect() : null
      activePopoverStage.value = stage
    }, 250)
  }
}

function closeStageInfo(): void {
  openStageInfoIdx.value = null
}

// ── Drama popover (single-click on stage tile) ────────────────────────────────
// A dramatic, stage-colored animated popover Teleport'd to body so it renders
// above the overflow-x-auto container without clipping.
// Architecture: pure data-driven; positioning via getBoundingClientRect at click
// time (captured into popoverAnchorRect). Twin-portable: no DOM assumptions.

const activePopoverStage  = ref<number | null>(null)
const popoverAnchorRect   = ref<DOMRect | null>(null)

function closeDramaPopover(): void {
  activePopoverStage.value = null
  popoverAnchorRect.value  = null
}

const activePopoverData = computed(() =>
  activePopoverStage.value !== null
    ? (STAGES.find(s => s.stage === activePopoverStage.value) ?? null)
    : null
)

const popoverHeaderGradient = computed((): string => {
  if (activePopoverStage.value === null) return ''
  const col = stageProgressColor(pos(activePopoverStage.value))
  return `linear-gradient(135deg, ${col}cc 0%, ${col} 60%, ${col}dd 100%)`
})

const popoverGlowStyle = computed((): Record<string, string> => {
  if (activePopoverStage.value === null) return {}
  const col = stageProgressColor(pos(activePopoverStage.value))
  return { filter: `drop-shadow(0 0 20px ${col}) drop-shadow(0 0 40px ${col}66)` }
})

const popoverStyle = computed((): Record<string, string> => {
  const rect = popoverAnchorRect.value
  if (!rect) return { display: 'none' }
  const popW   = 308
  const popH   = 400      // approximate — actual height is content-driven
  const margin = 12
  const vw     = typeof window !== 'undefined' ? window.innerWidth  : 1440
  const vh     = typeof window !== 'undefined' ? window.innerHeight : 900

  let left = rect.left + rect.width / 2 - popW / 2
  left = Math.max(margin, Math.min(left, vw - popW - margin))

  // Prefer above the pill; fall back to below if not enough room
  let top = rect.top - popH - 16
  if (top < margin) top = Math.min(rect.bottom + 16, vh - popH - margin)

  return {
    left:  `${Math.round(left)}px`,
    top:   `${Math.round(top)}px`,
    width: `${popW}px`,
  }
})

function onStageCta(): void {
  if (activePopoverStage.value === null) return
  emit('stage-action', activePopoverStage.value)
  closeDramaPopover()
}

function onNavigateThenClose(): void {
  if (activePopoverStage.value === null) return
  navigateToStage(activePopoverStage.value)
  closeDramaPopover()
}

function onOpenFullInfo(): void {
  if (activePopoverStage.value === null) return
  openStageInfoIdx.value = activePopoverStage.value
  closeDramaPopover()
}

// Escape key closes the drama popup
// stopPropagation prevents App.vue's global Escape handler from also firing.
function _onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && activePopoverStage.value !== null) {
    e.stopPropagation()
    closeDramaPopover()
  }
}

// ── Click-outside handler for drama popover ────────────────────────────────
// Fires in CAPTURE phase so it runs before the clicked element's own handler.
// If the click is inside the panel → do nothing (buttons fire normally).
// If the click is outside → close the popup; the clicked element also fires.
// This replaces the full-screen backdrop, which was blocking all other UI
// (SOS, Enter Stakes, Actions menu, etc.) during the drama popup.
// Tom 2026-05-29: "the sos button was blurred in background and useless."
const popoverPanelRef = ref<HTMLElement | null>(null)

function _onBodyClick(e: MouseEvent): void {
  if (activePopoverStage.value === null) return
  const panel = popoverPanelRef.value
  if (panel && panel.contains(e.target as Node)) return
  closeDramaPopover()
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
    // Stage 1: always snap to the very start so tile 1's left edge is fully visible.
    // Centering would place stage 1 at ~0 minus half-container which clips the tile
    // behind the ◀ fade overlay. All other stages center normally.
    if (props.currentStage === 1) {
      wrapper.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    // Center the pill within the scroll container
    const target = pill.offsetLeft - wrapper.clientWidth / 2 + pill.offsetWidth / 2
    wrapper.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  })
}

watch(() => props.currentStage, scrollToActive)
onMounted(() => {
  scrollToActive()
  window.addEventListener('keydown', _onKeyDown)
  document.addEventListener('click', _onBodyClick, true)  // capture phase
})
onUnmounted(() => {
  window.removeEventListener('keydown', _onKeyDown)
  document.removeEventListener('click', _onBodyClick, true)
  if (_clickTimer) clearTimeout(_clickTimer)
})
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
      <!-- pl-3: minimal left indent so stage 1 is fully visible at scroll=0.
           paddingRight: 5rem base (▶ Next button) + extraRightPad px to clear
           the fixed SOS/Mic/Speaker/Actions cluster when it is visible.
           Tom 2026-05-29: "old bug: stage 1 is still hidden off to left."
           Tom 2026-05-31: "buttons overlap stage steps" — fixed via extraRightPad. -->
      <div
        class="flex items-end gap-3 pl-3 pb-1 min-w-max"
        :style="{ paddingRight: `calc(5rem + ${props.extraRightPad}px)` }"
      >
      <template v-for="(step, idx) in STAGES" :key="step.stage">

        <!-- ── Stage pill ───────────────────────────────────────────── -->
        <!-- Single-click → drama popover (overview + CTA); Double-click → StageInfoPanel full INFO.
             250 ms timer in handlePillClick() separates the two actions. -->
        <button
          :ref="(el) => { if (el) pillRefs[idx] = el as HTMLButtonElement }"
          type="button"
          class="relative flex flex-col items-center gap-1.5 shrink-0 focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl
                 transition-all duration-300 hover:scale-105 active:scale-95"
          :style="{ ...pillStyle(step.stage), width: '96px', height: '96px', borderRadius: '16px' }"
          :aria-label="`Stage ${step.stage}: ${step.label} — click for overview · double-click for full INFO`"
          :aria-current="step.stage === currentStage ? 'step' : undefined"
          :title="`${step.title} · click for overview · dbl-click for INFO`"
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
            class="active-label-bar absolute z-20 pointer-events-none inset-x-0 top-[30px] flex justify-center"
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
          :aria-label="`${step.label} to ${STAGES[idx + 1].label} transition — click for INFO`"
          :title="`Stage ${step.stage}→${step.stage + 1}: ${step.label} → ${STAGES[idx + 1].label} · click for INFO (history · Planguage · fun fact)`"
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
          >✦ {{ step.label }} → {{ STAGES[idx + 1].label }} · click for INFO</span>
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

  <!-- ── Drama popover — single-click on stage tile ─────────────────────────
       Teleported to body: avoids overflow-x-auto clipping.
       NO backdrop: click-outside handled by _onBodyClick (capture phase).
       Removing the full-screen backdrop lets all other UI remain interactive
       (SOS, Enter Stakes, Actions menu, etc.) when the popup is open.
       Tom 2026-05-29: backdrop at z-[800] was blocking every button in the app.
       Single-Surface rule: small positional popover — registerExclusiveSurface
       not required. Escape + click-outside close it. -->
  <Teleport to="body">
    <!-- Drama popover panel — no backdrop; _onBodyClick closes on outside click -->
    <Transition name="drama-pop">
      <div
        v-if="activePopoverStage !== null && popoverAnchorRect"
        ref="popoverPanelRef"
        class="fixed z-[801] rounded-2xl overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.7)]"
        :style="popoverStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="`Stage ${activePopoverStage} — ${activePopoverData?.label}`"
      >
        <!-- ── Header: stage gradient, big number, CloseDot ── -->
        <div
          class="flex items-center justify-between px-4 pt-4 pb-3"
          :style="{ background: popoverHeaderGradient }"
        >
          <!-- Big ghost number + stage name -->
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="text-[52px] font-black leading-none select-none shrink-0"
              style="opacity: 0.22; color: #fff; line-height: 1;"
              aria-hidden="true"
            >{{ activePopoverStage }}</span>
            <div class="min-w-0">
              <div class="text-[10px] font-bold text-white/60 uppercase tracking-[0.14em] leading-none mb-1">
                Stage {{ activePopoverStage }} of 11
              </div>
              <div class="text-[18px] font-extrabold text-white leading-tight truncate">
                {{ activePopoverData?.label }}
              </div>
            </div>
          </div>
          <!-- CloseDot rule: at end (right) of parent flex header -->
          <CloseDot @click="closeDramaPopover()" />
        </div>

        <!-- ── Body: glyph + description ── -->
        <div class="bg-[#0d1526] px-5 py-5 flex flex-col items-center gap-4">
          <!-- PlTypeIcon with dramatic neon glow -->
          <div :style="popoverGlowStyle" class="py-1 transition-all duration-300">
            <PlTypeIcon
              :pl-type="activePopoverData?.plType ?? 'function'"
              size="2xl"
            />
          </div>
          <!-- Stage description text from STAGES[].title -->
          <p class="text-[12.5px] text-slate-300 text-center leading-relaxed max-w-[264px]">
            {{ activePopoverData?.title }}
          </p>
        </div>

        <!-- ── Footer: action buttons ── -->
        <div class="bg-[#08101e] px-4 pt-3 pb-4 flex flex-col gap-2">
          <!-- Primary CTA — stage-colored gradient, big -->
          <button
            type="button"
            class="w-full py-3 rounded-xl text-[13px] font-extrabold text-white
                   tracking-wide shadow-lg transition-all duration-200
                   hover:brightness-110 hover:scale-[1.02] active:scale-95
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            :style="{ background: popoverHeaderGradient }"
            @click="onStageCta()"
          >
            {{ STAGE_CTAS[activePopoverStage ?? 0] ?? '⚡ Go to Stage' }}
          </button>
          <!-- Secondary row: navigate + full info -->
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 py-2 rounded-xl text-[11px] font-bold text-slate-300
                     bg-white/[0.07] hover:bg-white/[0.14] hover:text-white
                     transition-all duration-200 active:scale-95
                     focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              @click="onNavigateThenClose()"
            >
              ▶ Go to Stage
            </button>
            <button
              type="button"
              class="flex-1 py-2 rounded-xl text-[11px] font-bold text-slate-300
                     bg-white/[0.07] hover:bg-white/[0.14] hover:text-white
                     transition-all duration-200 active:scale-95
                     focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              @click="onOpenFullInfo()"
            >
              Full Info →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

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

/* ── Drama popover entrance / exit ────────────────────────────────────────────
   Springy scale-up from 82% with a slight upward drift (translateY 8px→0).
   Exit: fast shrink + fade, moves up slightly (feels like it "snaps back").
   cubic-bezier(0.175, 0.885, 0.32, 1.275) = back-out easing (subtle overshoot). */
.drama-pop-enter-active {
  transition: opacity 0.22s ease, transform 0.26s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.drama-pop-leave-active {
  transition: opacity 0.14s ease-in, transform 0.14s ease-in;
}
.drama-pop-enter-from {
  opacity: 0;
  transform: scale(0.82) translateY(10px);
}
.drama-pop-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-6px);
}
</style>
