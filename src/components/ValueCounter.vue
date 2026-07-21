<!--
  ValueCounter.vue — 11-stage Planguage planning workflow bar.
  Rebuilt 2026-05-27 from design log r04–r37 + Planguage Spec Type Glyphs PDF v7.
  r07 2026-05-27: Active stage label bar (✦ ACTIVE, floats over glyph) + glyph bob animation.
  r08 2026-05-28: Horizontal scroll fix — native overflow-x-auto replaces ScrollContainer
                  (ScrollContainer only does vertical); scroll-to-active on stage change.
  r09 2026-05-28: Double-click stage tiles → StageInfoPanel (rich history/Planguage/examples).
                  250 ms timer separates single-click (navigate) from double-click (info).
  r10 2026-05-28: Stage tile single-click → drama popup (stage-colored panel, neon glyph, CTA).
                  Arrow/tile hover tooltips now say 'click for INFO' / 'dbl-click for INFO'.
  r11 2026-06-07: Single-click → navigate directly (Tom: "clicking the stager pin should bring
                  me to any stage"). Drama popup removed from single-click path. Double-click
                  retains StageInfoPanel. 250 ms timer preserved to distinguish the two.
                  ⚡ emoji on amber button darkened via filter brightness(0.1).

  11 stages (left to right), each a 120px tall dark pill with:
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
  stageDarkBgColor,
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
//
// Canonical 11-stage list now lives in src/data/planningStages.ts so that
// App.vue's Back/Next pin-pair (and any other stage-aware navigator) can
// import the same data without re-running into the Vue 3 `<script setup>`
// limitation that disallows arbitrary top-level `export` (r14 attempted that
// and crashed the dev server). Tom 2026-06-03 — STAGES lives in one place.
import { PLANNING_STAGES as STAGES } from '../data/planningStages'
// Arrow info data — Tom 2026-06-06: "stage arrow is single click fi hover text".
// Hover now reveals the Planguage section body (a teaching surface, per the
// foundational rule_sem_teaches_incrementally.md), not just "click for INFO".
// Single click still opens the full ArrowInfoPanel with all 3 sections + links.
import { ARROW_INFO_DATA } from '../data/arrowInfoData'

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
  8:  '✅ Spec Tasks',
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
  // No opacity shortcut — opacity:0.65 dragged text to 65% regardless of text color.
  // Tom 2026-06-06: "stage 11 text still bad / no change" even after text-white.
  // pillProgressColor already returns a darker background for 'future' stages (44% sat /
  // 20% lit vs 72% / 50% for current) — that darker shade signals "not yet" without
  // killing text legibility.
  return {
    background: pillProgressColor(pos(s), state),
  }
}

function glowStyle(s: number): Record<string, string> {
  const col = stageProgressColor(pos(s))
  // Active stage: dark disc (bg-slate-900, outside this filter) provides contrast on
  // any pill background. brightness(3.5) here amplifies canonical glyph colors to vivid
  // on the dark disc. Do NOT use brightness(10) → white — white on bright teal is just
  // as invisible as the original dark green.  Tom 2026-06-06: "active stage still invisible."
  if (s === props.currentStage) {
    return {
      filter: `brightness(3.5) drop-shadow(0 0 16px ${col}) drop-shadow(0 0 8px ${col})`,
      transform: 'scale(1.7)',
    }
  }
  // Non-active: scale(1.4) — slightly larger than before (was 1.25).
  // Tom 2026-06-06: "most glyphs can be moved down and enlarged."
  return {
    filter: `brightness(3) drop-shadow(0 0 18px ${col}) drop-shadow(0 0 8px ${col})`,
    transform: 'scale(1.4)',
  }
}

function badgeClass(s: number): string {
  const state = stageStatus(s)
  if (state === 'done')    return 'text-emerald-300'
  // 'current' badge: white text on the `bg-black/60` plate (which the badge
  // span already has).  Was 'text-gray-900' from the pre-plate era — that
  // reasoning ("white on L=50% cyan fails WCAG") no longer applies because
  // the dark plate now provides the contrast.  Tom 2026-06-04: *"this 10
  // is invisible"* — dark text on the dark plate was the bug.
  if (state === 'current') return 'text-white'
  return 'text-slate-300'
}

function labelClass(s: number): string {
  const state = stageStatus(s)
  if (state === 'done')    return 'text-emerald-300'
  // Same contrast fix: dark text on the bright current-stage pill.
  if (state === 'current') return 'text-gray-900 font-extrabold'
  // text-white: future pills have opacity:0.65 on the whole button — even slate-200
  // appears dim. text-white at 65% opacity renders as ~rgb(166,166,166) on dark pill
  // = sufficient contrast. Tom 2026-06-06: "stage 11 text still bad."
  return 'text-white font-semibold'
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

/** Style for the arrow BUTTON — hero-arrow style matching ArrowInfoPanel header.
 *  Gradient bg (from→to stage colors) on a rounded button; white SVG arrow on top.
 *  No negative margins: overlap with adjacent pills caused the right-side arrows to
 *  disappear because the next pill (later in DOM) rendered over the arrow's right
 *  portion via flex stacking — even with z-index:10, pill animation contexts
 *  (transition-all, hover:scale-105) won the compositor layer race.
 *  Color continuity comes from matching the stage progression palette, not overlap.
 *  Tom 2026-06-06: "The arrow in the info is really nice. Lets use it in the main
 *  stages, it can extend from and into the pins." */
function arrowButtonStyle(idx: number): Record<string, string> {
  const { from, to } = arrowProgressColors(idx)
  const state = stageStatus(idx + 1)   // arrow between stage idx+1 and idx+2
  return {
    width: '32px',
    height: '90px',
    flexShrink: '0',
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    borderRadius: '6px',
    opacity: state === 'future' ? '0.88' : '1',
  }
}

// ── Arrow hover-info preview (Tom 2026-06-06) ────────────────────────────────
// Tom verbatim: "stage arrow is single click fi hover text".  The arrow's
// bare "click for INFO" label is replaced by a richer hover card showing
// the Planguage section body for that arrow — a teaching surface per the
// foundational rule_sem_teaches_incrementally.md.  Single click still opens
// the full ArrowInfoPanel (history + Planguage + fun fact + links).

/** Returns the Planguage section body for a given arrow idx (0..9).
 *  Truncated to ≈ 220 chars so the hover card stays compact. */
function arrowPlanguageBody(idx: number): string {
  const arrow = ARROW_INFO_DATA.find(a => a.idx === idx)
  if (!arrow) return ''
  // The Planguage section is the most teaching-relevant for a hover preview
  // (the History and Fun Fact remain available in the full panel on click).
  const planguageSection = arrow.sections.find(s => s.title === 'Planguage')
  if (!planguageSection) return ''
  const body = planguageSection.body.trim().replace(/\s+/g, ' ')
  return body.length > 220 ? body.slice(0, 219) + '…' : body
}

// ── Stage info panel (double-click) ───────────────────────────────────────────
// Single-click = drama popover on the tile; double-click = full StageInfoPanel.
// 250 ms timer: on first click start timer; second click within window = dblclick.

const openStageInfoIdx = ref<number | null>(null)
let _clickTimer: ReturnType<typeof setTimeout> | null = null

function handlePillClick(stage: number): void {
  if (_clickTimer) {
    // Second click within 250 ms → double-click → open full StageInfoPanel
    clearTimeout(_clickTimer)
    _clickTimer = null
    openStageInfoIdx.value = stage
  } else {
    // First click — if no second click arrives within 250 ms, navigate to that stage.
    // Tom 2026-06-07: "clicking the stager pin should bring me to any stage."
    // Single-click = navigate directly. Double-click = full StageInfoPanel.
    // Drama popover removed from single-click path — navigation IS the feedback.
    _clickTimer = setTimeout(() => {
      _clickTimer = null
      navigateToStage(stage)
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

// stageDarkBgColor (L=25%) ensures white text on the header gradient is ≥5.5:1
// contrast. Previously used stageProgressColor (L=65%) which gave ~1.4:1 for cyan.
const popoverHeaderGradient = computed((): string => {
  if (activePopoverStage.value === null) return ''
  const col = stageDarkBgColor(pos(activePopoverStage.value))
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

  // Prefer above the pill; fall back to below if not enough room.
  //
  // CLEARANCE FIX (2026-06-02 r03): when the stage bar is fixed at top-0 (z-[250])
  // and a plan is loaded, the Plan Crest bar sits at top-[124px] (z-[300]) with the
  // breadcrumb strip directly below it (reaching to ~y=215). The popup is at z-[801].
  // If the popup's top falls in this zone, it physically covers the breadcrumb buttons
  // even though it has no backdrop — clicks on the breadcrumb area hit the popup body
  // first (z-[801] > anything in the crest). The _onBodyClick capture handler sees
  // e.target is inside the panel → doesn't close → click is silently absorbed.
  // This makes the "Enter Stakes" breadcrumb button appear dead.
  //
  // Fix: enforce a minimum top (CREST_CLEARANCE) so the popup always clears
  // the plan crest + breadcrumb region. The constant matches STAGE_BAR_H (124)
  // + ~90px for plan crest header + breadcrumb strip = 215px total clearance.
  const CREST_CLEARANCE = 215

  let top = rect.top - popH - 16
  if (top < margin) {
    top = rect.bottom + 16
    // Clamp: don't push off the bottom of the viewport
    top = Math.min(top, vh - popH - margin)
    // Enforce clearance: popup must not overlap plan crest / breadcrumb strip
    top = Math.max(top, CREST_CLEARANCE)
  }

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
    <!-- ◀ Prev stage — left edge pin. Tom 2026-06-06: removed bg-gradient-to-r
         fade which was painting dark navy over the leftmost stage arrow.
         Now a discrete pin button with no background fade: arrows underneath
         render cleanly to the edge. -->
    <button
      v-if="currentStage > 1"
      type="button"
      class="absolute left-0 top-0 bottom-0 z-20 flex items-center px-1
             text-white/70 hover:text-amber-300 transition-colors duration-200
             focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40
             drop-shadow-[0_0_3px_rgba(15,23,42,0.95)]"
      :aria-label="`Previous stage: ${STAGES[currentStage - 2].label}`"
      :title="`◀ Stage ${currentStage - 1} · ${STAGES[currentStage - 2].label} — click or use arrow keys`"
      @click="navigateToStage(currentStage - 1)"
    >
      <span class="text-2xl leading-none font-bold" aria-hidden="true">◀</span>
    </button>

    <!-- Tom 2026-06-01: "just fit it in" — tiles now flex-1 so all 11 stages fill
         the fixed bar width with no horizontal scroll. overflow-x-auto kept only
         as a fallback for very narrow viewports (< ~700px).
         scrollToActive is retained (no-op when bar doesn't scroll). -->
    <div
      ref="scrollWrapRef"
      class="overflow-x-auto w-full"
    >
      <!-- gap-0 + px-1: tiles are flex-1 so gaps would waste space; tiny px-1
           keeps stages off the very edge of the nav chrome. No paddingRight
           needed: the stage bar is fixed left-0 right-0 and nothing overlaps it. -->
      <div
        class="flex items-center gap-0 px-1 pb-1"
      >
      <template v-for="(step, idx) in STAGES" :key="step.stage">

        <!-- ── Stage pill ───────────────────────────────────────────── -->
        <!-- Single-click → navigate to this stage. Double-click → StageInfoPanel full INFO.
             250 ms timer in handlePillClick() separates the two actions. -->
        <button
          :ref="(el) => { if (el) pillRefs[idx] = el as HTMLButtonElement }"
          type="button"
          class="relative flex flex-col items-center justify-center gap-1.5 flex-1 min-w-[128px] focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl
                 transition-all duration-300 hover:scale-105 active:scale-95"
          :data-v411-tile-min-w="'128'"
          :style="{ ...pillStyle(step.stage), height: '120px', borderRadius: '16px' }"
          :aria-label="`Stage ${step.stage}: ${step.label} — click to navigate here · double-click for detailed stage info`"
          :aria-current="step.stage === currentStage ? 'step' : undefined"
          :title="`${step.title} · click to go to Stage ${step.stage} · DOUBLE-CLICK for detailed stage info`"
          @click="handlePillClick(step.stage)"
        >
          <!-- Stage Halo — bright white glowing ring, breathing 2s.
               Tom 2026-06-02: "dark unreadable, unnecessary — halo, color bright, pulsating."
               box-shadow animated entirely in @keyframes stage-halo (no inline style needed). -->
          <div
            v-if="step.stage === currentStage"
            class="stage-halo absolute inset-0 pointer-events-none"
            style="border-radius: 16px;"
            aria-hidden="true"
          />

          <!-- Number badge (top-left) -->
          <span
            class="absolute top-1.5 left-2 text-[14px] font-extrabold leading-none
                   bg-black/60 rounded-md px-1 py-0.5 z-10"
            :class="badgeClass(step.stage)"
            aria-hidden="true"
          >{{ step.stage }}</span>

          <!-- Active beacon — bright white pulsating dot at top-centre of active pill.
               Replaces dark "✦ ACTIVE" text (Tom 2026-06-02: "dark unreadable, unnecessary").
               Offset to top-2 centre, clear of number badge (which is left-2). -->
          <div
            v-if="step.stage === currentStage"
            class="absolute z-20 pointer-events-none inset-x-0 top-2 flex justify-center"
            aria-hidden="true"
          >
            <span class="active-beacon block w-2.5 h-2.5 rounded-full bg-white" />
          </div>

          <!-- Planguage type glyph — centered in pill by justify-center on pill button.
               Active stage uses a TWO-LAYER design to guarantee visibility on any pill color:
               Layer 1 (outer) — bg-slate-900 disc: opaque dark background, NO filter applied,
                 so the disc stays reliably dark regardless of brightness() on Layer 2.
               Layer 2 (inner) — glowStyle filter amplifies glyph SVG colors to vivid/bright
                 on the dark disc; scale(1.7) for active, scale(1.4) for others.
               Root cause fixed: brightness(10) + white shadows made the glyph white, but
               white on bright teal (active pill) has exactly the same low contrast as dark
               green on bright teal. The disc makes the background dark, so brightness
               amplification produces vivid-color-on-dark = maximally readable.
               Tom 2026-06-06: "active stage is still an invisible glyph for me" -->
          <!-- justify-center on pill centers the glyph vertically.
               No translate: Tom 2026-06-06: "i asked glyphs returned to centered position,
               i never asked them lowered." -->
          <div :class="step.stage === currentStage ? 'glyph-bob' : ''">
            <!-- Outer disc: dark backdrop for active stage only (no filter here). -->
            <div
              class="flex items-center justify-center"
              :class="step.stage === currentStage
                ? 'bg-slate-900 rounded-xl p-2 ring-1 ring-white/20'
                : ''"
            >
              <!-- Inner glyph: brightness filter + scale only affect SVG, not the disc bg -->
              <div
                class="flex items-center justify-center"
                :style="glowStyle(step.stage)"
                aria-hidden="true"
              >
                <!-- no-detail-click: tile button owns dblclick (StageInfoPanel via timer).
                     r41 v380 (Tom Gilb 2026-06-25 "constraint hover is still there") —
                     pass per-stage canonical title so PlTypeIcon's inner HoverHint
                     matches the stage's purpose; without this the inner span falls
                     back to CANONICAL_LABELS[plType] (e.g. constraint = "Constraint —
                     hard boundary that must not be violated…") which leaks through
                     when the cursor lands on the icon span instead of the surrounding
                     button area.  Trace-Before-Patch SUPREME: third stage-bar
                     rendering site missed in v379 sweep. -->
                <PlTypeIcon :pl-type="step.plType" size="xl" :no-detail-click="true" :title="step.title" />
              </div>
            </div>
          </div>

          <!-- Stage label -->
          <span
            class="absolute bottom-2 left-0 right-0 text-center text-[11px]
                   font-bold leading-tight tracking-wide whitespace-normal px-1"
            :class="labelClass(step.stage)"
          >{{ step.label }}</span>
        </button>

        <!-- ── Arrow connector ──────────────────────────────────────── -->
        <!-- Hero-arrow style: gradient bg (stage progression colors) + white
             shaft + white concave arrowhead — matching ArrowInfoPanel header.
             Slight negative margins (-4px each side) so gradient visually merges
             into adjacent pills. z-10 ensures it paints over left pill edge.
             Tom 2026-06-06: "The arrow in the info is really nice. Lets use it
             in the main stages, it can extend from and into the pins." -->
        <button
          v-if="idx < STAGES.length - 1"
          type="button"
          class="relative shrink-0 flex items-center justify-center
                 hover:scale-110 active:scale-95 transition-transform
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded
                 group"
          :style="arrowButtonStyle(idx)"
          :aria-label="`${step.label} to ${STAGES[idx + 1].label} transition — click or double-click for INFO`"
          :title="`Stage ${step.stage}→${step.stage + 1}: ${step.label} → ${STAGES[idx + 1].label} · click for INFO · double-click for INFO (lineage · Planguage · fun fact)`"
          @click="openArrow(idx)"
        >
          <!-- White shaft + white concave swept-back arrowhead on gradient bg.
               viewBox matches button dimensions (32×90) — no preserveAspectRatio needed.
               Tom 2026-06-06: "thoe rightmost arows are vaguely visible, what abobut
               a dark outline round the arrows ar right" — root cause: right-side
               arrow gradients (stage 9→10→11) use light teal/cyan colors; white
               shaft+arrowhead loses contrast against light backgrounds. Fix: dark
               drop-shadow filter gives every arrow a ~1.2 px dark halo (rgba navy
               0.95 + 0.7 stacked) on every gradient color. Universal halo applies
               to ALL arrows (consistent style) — works equally well on the indigo
               sweep AND the lighter cyan/teal end. -->
          <svg
            viewBox="0 0 32 90"
            width="32"
            height="90"
            fill="none"
            aria-hidden="true"
            style="filter: drop-shadow(0 0 1.2px rgba(15, 23, 42, 0.95)) drop-shadow(0 0 1.2px rgba(15, 23, 42, 0.7));"
          >
            <!-- Shaft — horizontal, vertically centered -->
            <line
              x1="3" y1="45" x2="18" y2="45"
              stroke="white" stroke-width="3" stroke-linecap="round" stroke-opacity="0.95"
            />
            <!-- Concave swept-back arrowhead — tip at right, base concave-inward -->
            <path
              d="M 16,30 L 29,45 L 16,60 Q 21,45 16,30 Z"
              fill="white" fill-opacity="1"
            />
          </svg>
          <!-- Hover card — Tom 2026-06-06 "stage arrow is single click fi hover
               text".  Replaces the bare label with a rich teaching preview
               showing the canonical Planguage section body for this transition.
               Single click still opens the full ArrowInfoPanel (history +
               Planguage + fun fact + links). -->
          <div
            class="absolute pointer-events-none -top-3 left-1/2 -translate-x-1/2 -translate-y-full
                   w-[300px] max-w-[80vw]
                   bg-[#0f172a]/96 text-white rounded-lg px-3 py-2 shadow-2xl ring-1 ring-white/10
                   opacity-0 group-hover:opacity-100 transition-opacity z-30
                   space-y-1.5"
            role="tooltip"
          >
            <div class="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide">
              <span class="text-amber-300">✦ Stage {{ step.stage }} → {{ step.stage + 1 }}</span>
            </div>
            <div class="text-[11px] font-bold text-white leading-tight">
              {{ step.label }}
              <span class="text-slate-400" aria-hidden="true">→</span>
              {{ STAGES[idx + 1].label }}
            </div>
            <div class="text-[10px] text-violet-300 font-semibold uppercase tracking-wide pt-0.5">
              📐 Planguage
            </div>
            <p class="text-[10px] text-slate-200 leading-snug whitespace-normal">
              {{ arrowPlanguageBody(idx) }}
            </p>
            <p class="text-[9px] text-slate-400 italic pt-0.5 border-t border-white/10">
              Single-click for full INFO · History · Planguage · Fun Fact · links
            </p>
          </div>
        </button>

      </template>
      </div><!-- end min-w-max flex -->
    </div><!-- end overflow-x-auto -->

    <!-- ▶ Next stage — right edge pin. Tom 2026-06-06: "stages arrows are still
         whiting out at right" — root cause: bg-gradient-to-l from-[#0f172a]
         was painting a dark navy fade OVER the right-side arrows (z-20 above
         arrow buttons), making them appear whited-out/ghosted. Fix: removed
         the gradient. Now a discrete pin button with drop-shadow halo so the
         glyph still reads clearly on any underlying color. -->
    <button
      v-if="currentStage < STAGES.length"
      type="button"
      class="absolute right-0 top-0 bottom-0 z-20 flex items-center px-1
             text-white/70 hover:text-amber-300 transition-colors duration-200
             focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40
             drop-shadow-[0_0_3px_rgba(15,23,42,0.95)]"
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
              :title="activePopoverData?.title"
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
/* Stage halo — bright white glowing ring expands/contracts around the active pill.
   Tom 2026-06-02: "halo, color bright, pulsating." box-shadow animated directly;
   inner ring (0 0 0 Npx) is the solid border; outer spread is the soft glow. */
@keyframes stage-halo {
  0%   { box-shadow: 0 0 0 3px rgba(255,255,255,0.90), 0 0 10px 4px rgba(255,255,255,0.35); }
  50%  { box-shadow: 0 0 0 5px rgba(255,255,255,1.00), 0 0 24px 9px rgba(255,255,255,0.65); }
  100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.90), 0 0 10px 4px rgba(255,255,255,0.35); }
}
.stage-halo {
  animation: stage-halo 2s ease-in-out infinite;
}

/* Active beacon — bright white pulsating dot at top of active stage pill.
   Pulses at 1.5s (offset from halo's 2s) for a staggered breathing feel.
   scale 1.0→1.4 + opacity 1.0→0.6 + glow spread 5px→14px. */
@keyframes active-beacon {
  0%   { opacity: 1.0; transform: scale(1.0); box-shadow: 0 0 5px 2px rgba(255,255,255,0.80); }
  50%  { opacity: 0.6; transform: scale(1.4); box-shadow: 0 0 12px 6px rgba(255,255,255,0.50); }
  100% { opacity: 1.0; transform: scale(1.0); box-shadow: 0 0 5px 2px rgba(255,255,255,0.80); }
}
.active-beacon {
  animation: active-beacon 1.5s ease-in-out infinite;
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
