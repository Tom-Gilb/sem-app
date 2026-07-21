<!--
  PlanguageDiagram.vue — reusable Planguage visualisation surface.

  v485 (2026-07-20) — extracted from ModelLibraryPanel.vue.  Tom Gilb 2026-07-20
  verbatim "extract" after asking why Value Flow code wasn't reused across the
  app.  This component owns the SVG rendering + drill-down card + click
  handling.  The parent owns its OWN scroll wrapper + header + Copy/Mail/CloseDot
  chrome so the diagram embeds cleanly in any container.

  Ports verbatim to Kai's Twin (Twin Portability Portfolio candidate #18):
  pure Vue + Tailwind + the shared `useValueFlowLayout` composable.  No DOM
  APIs beyond `scrollIntoView` (drill-down auto-scroll).

  Props:
    model  VizModel   — normalised Planguage data (see useValueFlowLayout).
    mode   VizMode    — 'sankey-focus' | 'strongly-related' (add more as they ship).

  Emits:
    node-select   Fires when a bar is clicked, with the underlying VizNode.
                  Parents can wire this to "highlight in Spec Editor" etc.

  UI Rules satisfied:
    Icon-Plus-Text SUPREME — Close pin has ✕ + "Close" text; type badge shows
                              spelled-out type name.
    Spell-out-Type-Names SUPREME — badge uses PLANGUAGE_TYPE_LABEL, never
                                    single-letter abbrs in user-visible text.
    DD-009 Zero-Training UI — SVG <title> HoverHint on every clickable node.
    DD-013 double-click discovery — cursor:pointer + <title> disclose drill.
    DD-017 Colour-on-Background — canonical Planguage colours on white bg,
                                   thicker border on the clicked bar for R-G
                                   colorblind-safe visual feedback.
    MOVE Principle SUPREME — drill-down card appears inline, auto-scrolls
                              into view on click; no menu-dive.
    Twin portability — pure Vue + Tailwind + composable.
-->
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  computeLayout,
  computeDrillDown,
  PLANGUAGE_FILL,
  PLANGUAGE_STROKE,
  PLANGUAGE_BADGE,
  PLANGUAGE_TYPE_LABEL,
  ISOMETRIC_BUILDING_HEIGHT,
} from '../composables/useValueFlowLayout'
import type { VizModel, VizMode, VizNode, VizDrillDown } from '../composables/useValueFlowLayout'

const props = defineProps<{
  model: VizModel
  mode:  VizMode
}>()

const emit = defineEmits<{
  'node-select': [node: VizNode]
}>()

// ── Layout ──────────────────────────────────────────────────────────────────

const layout = computed(() => computeLayout(props.model, props.mode))

// ── Drill-down state ────────────────────────────────────────────────────────

const selectedNode     = ref<VizDrillDown | null>(null)
const selectedNodeId   = ref<string | null>(null)   // for click-highlight
const drilldownCardRef = ref<HTMLElement | null>(null)

function onNodeClick(node: VizNode): void {
  selectedNodeId.value = node.id
  selectedNode.value   = computeDrillDown(props.model, node)
  emit('node-select', node)
  // Scroll the drill-down card into view — the click feels responsive even on
  // tall diagrams where the card lives below the fold.
  void nextTick().then(() => {
    drilldownCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function closeDrilldown(): void {
  selectedNode.value   = null
  selectedNodeId.value = null
}

// ── SVG geometry — mode determines viewBox + column header positions ───────

const svgViewBox = computed(() => {
  if (props.mode === 'strongly-related')  return '0 0 860 400'
  if (props.mode === 'sunburst')          return '0 0 900 900'   // square for radial
  if (props.mode === 'constellation')     return '0 0 900 600'   // wide for clusters
  if (props.mode === 'focus-ring')        return '0 0 900 900'   // square for radial focus
  if (props.mode === 'layered-accordion') return '0 0 900 600'   // tall for 5 stripes
  if (props.mode === 'time-ribbon')       return '0 0 900 500'   // wide for lanes
  // sankey-focus + isometric-city + focus-context share the same viewBox
  return '0 0 900 520'
})

const columnHeaders = computed(() => {
  if (props.mode === 'strongly-related') {
    // v494 — anchor='start' so labels don't clip on the left edge (Tom Gilb
    // 2026-07-21 "left text overlapped" — labels at x=10 with anchor=middle
    // had their left half rendered off-canvas, showing "HOLDERS" instead of
    // "STAKEHOLDERS".  Row-label modes use anchor='start'; column-label
    // modes use anchor='middle'.
    return [
      { x: 10, y: 16,  label: 'STAKEHOLDERS',            anchor: 'start' as const },
      { x: 10, y: 116, label: 'FUNCTIONS',               anchor: 'start' as const },
      { x: 10, y: 236, label: 'VALUES',                  anchor: 'start' as const },
      { x: 10, y: 336, label: 'CONSTRAINTS + RESOURCES', anchor: 'start' as const },
    ]
  }
  if (props.mode === 'sunburst') {
    // Centre label: model title truncated
    const title = props.model?.title ?? 'MODEL'
    return [
      { x: 450, y: 445, label: title.length > 30 ? title.slice(0, 27) + '…' : title },
      { x: 450, y: 465, label: 'MODEL' },
    ]
  }
  if (props.mode === 'constellation') {
    return [
      { x: 180, y: 30,  label: 'STAKEHOLDERS' },
      { x: 720, y: 30,  label: 'VALUES' },
      { x: 450, y: 210, label: 'FUNCTIONS' },
      { x: 180, y: 580, label: 'CONSTRAINTS' },
      { x: 720, y: 580, label: 'RESOURCES' },
    ]
  }
  if (props.mode === 'layered-accordion') {
    // Left-margin type labels, one per stripe.  Y matches stripe centres (BAND_TOP_PAD + i * (BAND_HEIGHT + BAND_GAP) + BAND_HEIGHT/2).
    return [
      { x: 90, y: 90,  label: 'STAKEHOLDERS' },
      { x: 90, y: 200, label: 'FUNCTIONS' },
      { x: 90, y: 310, label: 'VALUES' },
      { x: 90, y: 420, label: 'CONSTRAINTS' },
      { x: 90, y: 530, label: 'RESOURCES' },
    ]
  }
  if (props.mode === 'focus-ring') {
    // Ring labels around the outermost radius
    return [
      { x: 450, y: 20,  label: 'CONTEXT (Constraints + Resources)' },
      { x: 450, y: 480, label: 'FOCUS' },
    ]
  }
  if (props.mode === 'time-ribbon') {
    return [
      { x: 80, y: 92,  label: 'STAKEHOLDERS' },
      { x: 80, y: 184, label: 'FUNCTIONS' },
      { x: 80, y: 276, label: 'VALUES' },
      { x: 80, y: 368, label: 'CONSTRAINTS' },
      { x: 80, y: 460, label: 'RESOURCES' },
    ]
  }
  return [
    { x: 100, y: 20, label: 'STAKEHOLDERS' },
    { x: 390, y: 20, label: 'FUNCTIONS' },
    { x: 680, y: 20, label: 'VALUES' },
  ]
})

/** Some modes render nodes as circles (sunburst, constellation) instead of rects. */
const nodeShape = computed<'rect' | 'circle'>(() =>
  props.mode === 'sunburst' || props.mode === 'constellation' ? 'circle' : 'rect'
)

/** Constellation renders on a dark background for star-map drama. */
const surfaceBg = computed(() =>
  props.mode === 'constellation' ? '#0f172a' : '#ffffff'
)

/**
 * v493 — Lane background stripes for lane-based modes (time-ribbon,
 * layered-accordion).  Same geometry as `renderLayoutToSvgString` so in-app
 * + email render IDENTICALLY.  Empty array in modes without lanes.
 */
const laneStripes = computed(() => {
  if (props.mode === 'time-ribbon') {
    return [   // TOP_PAD=50, LANE_H=80, LANE_GAP=12
      { y: 50,  h: 80, fill: '#f8fafc' }, { y: 142, h: 80, fill: '#ffffff' }, { y: 234, h: 80, fill: '#f8fafc' },
      { y: 326, h: 80, fill: '#ffffff' }, { y: 418, h: 80, fill: '#f8fafc' },
    ]
  }
  if (props.mode === 'layered-accordion') {
    return [   // BAND_TOP_PAD=40, BAND_HEIGHT=90, BAND_GAP=20
      { y: 40,  h: 90, fill: '#f8fafc' }, { y: 150, h: 90, fill: '#ffffff' }, { y: 260, h: 90, fill: '#f8fafc' },
      { y: 370, h: 90, fill: '#ffffff' }, { y: 480, h: 90, fill: '#f8fafc' },
    ]
  }
  return [] as Array<{ y: number; h: number; fill: string }>
})

/**
 * v495 — Ring guide circles for focus-ring + sunburst.  Concentric guide
 * circles centred at (450, 450) so the ring STRUCTURE is visible.  Tom Gilb
 * 2026-07-21 "the focus ring circle lines are invisible" — layout placed
 * nodes on rings but no visual cue showed the ring geometry.
 */
const ringGuides = computed(() => {
  if (props.mode === 'focus-ring') return [170, 300, 420]      // Ring 1 · 2 · 3
  if (props.mode === 'sunburst')   return [90, 190, 290, 390]  // Sunburst 4 rings
  return [] as number[]
})

/**
 * v490 — focus-context mode: when a node is selected, dim every OTHER node
 * to 20% opacity so the focus + its connected neighbours stand out.
 * Returns the opacity to apply per node.  In non-focus-context modes
 * returns 1 always (no dimming).
 */
function nodeOpacity(node: VizNode): number {
  if (props.mode !== 'focus-context') return 1
  if (!selectedNodeId.value) return 1
  if (node.id === selectedNodeId.value) return 1
  // Related = arrow between focus and this node
  const focusId = selectedNodeId.value
  const related = layout.value.arrows.some(a =>
    (a.fromId === focusId && a.toId === node.id) ||
    (a.toId === focusId && a.fromId === node.id)
  )
  return related ? 0.85 : 0.22
}
/** Arrow opacity for focus-context: fade arrows unrelated to the focused node. */
function arrowOpacity(arrow: VizArrow): number {
  if (props.mode !== 'focus-context') return 0.7
  if (!selectedNodeId.value) return 0.7
  const touches = arrow.fromId === selectedNodeId.value || arrow.toId === selectedNodeId.value
  return touches ? 0.9 : 0.15
}

// ── Isometric City (v486): CSS 3D transform state ──────────────────────────
// Drag horizontally on the wrapper to rotate the "city" around Y-axis (0..70°
// range keeps the perspective usable — beyond 70° the buildings edge-on).
// Fixed rotateX(28deg) gives the isometric look; user only controls rotateY.
const isometricRotY = ref(-15)   // start slightly angled for depth cue
const isometricRotX = 28          // fixed tilt for isometric feel
const isDragging    = ref(false)
let dragStartX = 0
let dragStartRotY = 0

function onIsoDragStart(e: PointerEvent): void {
  if (props.mode !== 'isometric-city') return
  isDragging.value = true
  dragStartX       = e.clientX
  dragStartRotY    = isometricRotY.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onIsoDragMove(e: PointerEvent): void {
  if (!isDragging.value) return
  const dx = e.clientX - dragStartX
  // 400 px drag = 60° rotation (comfortable sensitivity).  Clamp to [-70, 70].
  const next = Math.max(-70, Math.min(70, dragStartRotY + (dx / 400) * 60))
  isometricRotY.value = next
}
function onIsoDragEnd(e: PointerEvent): void {
  isDragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}
function resetIsoRotation(): void { isometricRotY.value = -15 }

const isometricTransform = computed(() =>
  props.mode === 'isometric-city'
    ? `perspective(1400px) rotateX(${isometricRotX}deg) rotateY(${isometricRotY.value}deg)`
    : 'none'
)

// Note: ISOMETRIC_BUILDING_HEIGHT is imported for potential future runtime use
// (currently the shadow strength is compiled into the filter defs statically).
// Suppress unused-import warning at build time by referencing the constant:
void ISOMETRIC_BUILDING_HEIGHT

// ── Helpers ─────────────────────────────────────────────────────────────────

function findNode(id: string): VizNode | undefined {
  return layout.value.nodes.find(n => n.id === id)
}

function arrowMarker(color: string): string {
  if (color === '#2563eb') return 'url(#pldArrowBlue)'
  if (color === '#f97316') return 'url(#pldArrowOrange)'
  return 'url(#pldArrowGray)'
}

/** Truncate a label to fit the node width; full text lives in the drill-down. */
function truncLabel(s: string, max = 28): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/**
 * v496 — Type-badge pill width per Spell-out-Type-Names SUPREME.  Sized to fit
 * the full type name at font-size 8, with a couple of pixels of padding.
 */
function typeBadgeWidth(t: VizNode['type']): number {
  const label = PLANGUAGE_TYPE_LABEL[t]
  // Approx SVG glyph width at font-size 8 bold ≈ 5.2 px per char + 8 px padding.
  return Math.ceil(label.length * 5.2 + 8)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Legend -->
    <div class="flex flex-wrap gap-3 text-[10px] font-semibold">
      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-slate-400 opacity-60" /> Stakeholders</span>
      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-orange-500" /> Functions</span>
      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-blue-500" /> Values</span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-3 h-3 rounded bg-fuchsia-500" /> Constraints /
        <span class="inline-block w-3 h-3 rounded bg-sky-500 ml-1" /> Resources
      </span>
      <span class="flex items-center gap-1.5"><span class="inline-block w-5 h-0.5 bg-blue-600" /> delivers value</span>
      <span class="flex items-center gap-1.5"><span class="inline-block w-5 h-0.5 bg-slate-400 border-dashed" /> contributes to</span>
    </div>

    <!-- v486 Isometric City — rotation slider + reset (only in isometric-city mode) -->
    <div
      v-if="mode === 'isometric-city'"
      class="flex items-center gap-3 px-2 py-1 rounded-lg bg-slate-100 ring-1 ring-slate-200"
    >
      <span class="text-[10px] font-semibold text-slate-600 shrink-0">🔄 Rotate:</span>
      <input
        v-model.number="isometricRotY"
        type="range"
        min="-70"
        max="70"
        step="1"
        class="flex-1 accent-blue-600 cursor-pointer"
        title="Rotate the isometric city around its vertical axis · Drag the slider OR drag the diagram itself · Range: -70° to +70°"
        aria-label="Rotate isometric city (degrees around Y-axis, -70 to +70)"
      />
      <span class="text-[10px] font-mono text-slate-500 tabular-nums w-12 text-right shrink-0">{{ Math.round(isometricRotY) }}°</span>
      <button
        type="button"
        class="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
        title="Reset rotation to default angle (-15°)"
        @click="resetIsoRotation"
      >
        <span aria-hidden="true">↺</span>
        <span>Reset</span>
      </button>
    </div>

    <!-- Diagram surface —
         v486 Isometric City: outer div gets `perspective + rotateX + rotateY`
         via inline transform; drag handlers on the wrapper update rotateY.
         In non-isometric modes the transform is 'none' — the wrapper is a
         no-op passthrough.  `preserve-3d` on the transform-style is required
         so the SVG child inherits the perspective correctly. -->
    <div
      class="rounded-xl ring-1 ring-slate-200 overflow-hidden"
      :class="mode === 'isometric-city' ? 'select-none' : ''"
      :style="mode === 'isometric-city'
        ? {
            background: surfaceBg,
            transform: isometricTransform,
            transformStyle: 'preserve-3d',
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            cursor: isDragging ? 'grabbing' : 'grab',
          }
        : { background: surfaceBg }"
      @pointerdown="onIsoDragStart"
      @pointermove="onIsoDragMove"
      @pointerup="onIsoDragEnd"
      @pointercancel="onIsoDragEnd"
    >
      <svg
        :viewBox="svgViewBox"
        class="w-full"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        :aria-label="`${
          mode === 'sankey-focus'    ? 'Value Flow'
          : mode === 'isometric-city'    ? 'Isometric City'
          : mode === 'sunburst'           ? 'Radial Sunburst'
          : mode === 'constellation'      ? 'Constellation Map'
          : mode === 'focus-context'      ? 'Focus + Context'
          : mode === 'layered-accordion'  ? 'Layered Accordion'
          : mode === 'focus-ring'         ? 'Focus Ring'
          : mode === 'time-ribbon'        ? 'Time Ribbon'
          : 'Strongly Related'
        } diagram for ${model.title}`"
      >
        <defs>
          <marker id="pldArrowBlue"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#2563eb" /></marker>
          <marker id="pldArrowGray"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#94a3b8" /></marker>
          <marker id="pldArrowOrange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#f97316" /></marker>
          <!-- v486 — building drop-shadows for isometric-city depth cue.
               One filter per canonical Planguage type, dy value chosen per type
               height (stakeholder tallest = 14, function = 8, value = 12, etc.). -->
          <filter id="pldShadowStakeholder" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="6" dy="14" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.35" /></filter>
          <filter id="pldShadowF"           x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="4" dy="8"  stdDeviation="1.5" flood-color="#7c2d12" flood-opacity="0.35" /></filter>
          <filter id="pldShadowV"           x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="4" dy="12" stdDeviation="2" flood-color="#1e3a8a" flood-opacity="0.35" /></filter>
          <filter id="pldShadowC"           x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="3" dy="5"  stdDeviation="1" flood-color="#701a75" flood-opacity="0.35" /></filter>
          <filter id="pldShadowR"           x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="3" dy="6"  stdDeviation="1.5" flood-color="#075985" flood-opacity="0.35" /></filter>
          <filter id="pldShadowS"           x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="4" dy="10" stdDeviation="1.5" flood-color="#14532d" flood-opacity="0.35" /></filter>
          <!-- v489 — constellation "star glow": soft coloured blur behind each node.  One filter per type. -->
          <filter id="pldGlowStar" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- v493 — Lane background stripes (time-ribbon + layered-accordion only).
             Renders BEFORE column headers so entries + labels overlay cleanly.
             Same geometry as renderLayoutToSvgString so in-app + export match. -->
        <rect
          v-for="(stripe, i) in laneStripes" :key="`lane-${i}`"
          x="0" :y="stripe.y" width="900" :height="stripe.h" :fill="stripe.fill"
        />

        <!-- v495 — Ring guide circles (focus-ring + sunburst).  Dashed slate
             rings at each ring radius so the ring STRUCTURE is visible. -->
        <circle
          v-for="r in ringGuides" :key="`ring-${r}`"
          cx="450" cy="450" :r="r" fill="none" stroke="#cbd5e1"
          stroke-width="1" stroke-dasharray="4 4" opacity="0.7"
        />

        <!-- Column / row headers.  v494 — text-anchor per-header ('start' for
             row labels that sit in a left margin; 'middle' for column labels
             centred above a column).  Fixes left-edge clipping Tom hit on
             strongly-related mode where "STAKEHOLDERS" at x=10 with anchor=
             middle showed as "HOLDERS" (left half off-canvas). -->
        <text
          v-for="h in columnHeaders" :key="h.label"
          :x="h.x" :y="h.y" :text-anchor="('anchor' in h ? h.anchor : 'middle')"
          :font-size="mode === 'sunburst' && h.label !== 'MODEL' ? '13' : '11'"
          :fill="mode === 'constellation' ? '#cbd5e1' : (mode === 'sunburst' && h.label !== 'MODEL' ? '#0f172a' : '#64748b')"
          :font-weight="mode === 'sunburst' && h.label !== 'MODEL' ? '800' : '600'"
        >{{ h.label }}</text>

        <!-- Arrows (behind nodes) -->
        <template v-for="(arrow, i) in layout.arrows" :key="`a-${i}-${arrow.fromId}-${arrow.toId}`">
          <template v-if="findNode(arrow.fromId) && findNode(arrow.toId)">
            <line
              :x1="findNode(arrow.fromId)!.x + findNode(arrow.fromId)!.w"
              :y1="findNode(arrow.fromId)!.y + findNode(arrow.fromId)!.h / 2"
              :x2="findNode(arrow.toId)!.x"
              :y2="findNode(arrow.toId)!.y + findNode(arrow.toId)!.h / 2"
              :stroke="arrow.color"
              :stroke-width="arrow.strokeWidth"
              :stroke-dasharray="arrow.dashed ? '4 3' : 'none'"
              :marker-end="arrowMarker(arrow.color)"
              :opacity="arrowOpacity(arrow)"
            />
          </template>
        </template>

        <!-- Nodes — v489: mode-branched shape rendering.  Rects for
             sankey/isometric/related; circles (with optional star-glow) for
             sunburst/constellation.  Click drill-down + selected-highlight
             work identically across shapes. -->
        <template v-for="node in layout.nodes" :key="node.id">
          <g
            style="cursor: pointer"
            pointer-events="all"
            :opacity="nodeOpacity(node)"
            :style="{ transition: 'opacity 0.25s ease-out' }"
            @click="onNodeClick(node)"
          >
            <title>{{ node.label }} — click to see full detail</title>

            <!-- RECT shape (sankey-focus / strongly-related / isometric-city) -->
            <template v-if="nodeShape === 'rect'">
              <rect
                :x="node.x" :y="node.y" :width="node.w" :height="node.h" rx="6"
                :fill="PLANGUAGE_FILL[node.type]"
                :stroke="PLANGUAGE_STROKE[node.type]"
                :stroke-width="selectedNodeId === node.id ? 3.5 : 1.5"
                :filter="mode === 'isometric-city'
                  ? (node.type === 'stakeholder' ? 'url(#pldShadowStakeholder)'
                     : node.type === 'F' ? 'url(#pldShadowF)'
                     : node.type === 'V' ? 'url(#pldShadowV)'
                     : node.type === 'C' ? 'url(#pldShadowC)'
                     : node.type === 'R' ? 'url(#pldShadowR)'
                     : 'url(#pldShadowS)')
                  : undefined"
              />
              <!-- v496 (2026-07-21) — Type badge shows the SPELLED-OUT NAME per
                   Spell-out-Type-Names SUPREME rule (Tom Gilb "SPELL OUT THE TYPE").
                   Badge is a small pill in the top-left of the rect, canonical
                   Planguage colour, full type name ("Function" / "Value" /
                   "Constraint" / "Resource" / "Solution").  Main label centred
                   below the badge to preserve breathing room. -->
              <template v-if="node.type !== 'stakeholder'">
                <rect
                  :x="node.x + 4" :y="node.y + 3" :width="typeBadgeWidth(node.type)" height="12" rx="3"
                  :fill="PLANGUAGE_BADGE[node.type as 'F' | 'V' | 'C' | 'R' | 'S']"
                />
                <text
                  :x="node.x + 4 + typeBadgeWidth(node.type) / 2" :y="node.y + 12"
                  text-anchor="middle" font-size="8" fill="white" font-weight="700"
                >{{ PLANGUAGE_TYPE_LABEL[node.type] }}</text>
              </template>
              <text
                :x="node.type !== 'stakeholder' ? node.x + 6 : node.x + 8"
                :y="node.y + node.h - 8"
                font-size="10"
                :fill="node.type === 'stakeholder' ? '#475569' : '#1e293b'"
                font-weight="500"
              >
                <tspan>{{ truncLabel(node.label) }}</tspan>
              </text>
            </template>

            <!-- CIRCLE shape (sunburst / constellation).  Constellation adds
                 star-glow filter for dramatic look on dark bg.  Label sits
                 below the circle. -->
            <template v-else>
              <circle
                :cx="node.x + node.w / 2"
                :cy="node.y + node.h / 2"
                :r="mode === 'constellation' ? 8 : 10"
                :fill="PLANGUAGE_FILL[node.type]"
                :stroke="PLANGUAGE_STROKE[node.type]"
                :stroke-width="selectedNodeId === node.id ? 3.5 : 1.5"
                :filter="mode === 'constellation' ? 'url(#pldGlowStar)' : undefined"
              />
              <text
                :x="node.x + node.w / 2"
                :y="node.y + node.h / 2 + (mode === 'constellation' ? 22 : 26)"
                text-anchor="middle" font-size="9"
                :fill="mode === 'constellation' ? '#e2e8f0' : '#1e293b'"
                font-weight="500"
              >
                <tspan>{{ truncLabel(node.label, 18) }}</tspan>
              </text>
              <!-- v496 — Spell-out-Type-Names SUPREME: replaced single-letter
                   marker with full type name below the circle. -->
              <text
                v-if="node.type !== 'stakeholder'"
                :x="node.x + node.w / 2"
                :y="node.y + node.h / 2 - 14"
                font-size="8" font-weight="800" text-anchor="middle"
                :fill="mode === 'constellation' ? '#e2e8f0' : PLANGUAGE_STROKE[node.type]"
              >{{ PLANGUAGE_TYPE_LABEL[node.type] }}</text>
            </template>
          </g>
        </template>

        <!-- Empty state -->
        <text
          v-if="layout.nodes.length === 0"
          x="450" y="260" text-anchor="middle" font-size="13" fill="#94a3b8"
        >No entries to visualize</text>
      </svg>
    </div>

    <!-- Drill-down card -->
    <div
      v-if="selectedNode"
      ref="drilldownCardRef"
      class="rounded-xl ring-2 ring-blue-400 bg-white shadow-md p-4 flex flex-col gap-2 scroll-mt-4"
      :aria-label="`Detail for ${selectedNode.label}`"
    >
      <div class="flex items-center gap-2">
        <span
          class="shrink-0 inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold text-white"
          :class="[
            selectedNode.type === 'F' ? 'bg-orange-500'
            : selectedNode.type === 'V' ? 'bg-blue-500'
            : selectedNode.type === 'C' ? 'bg-fuchsia-500'
            : selectedNode.type === 'R' ? 'bg-sky-500'
            : selectedNode.type === 'S' ? 'bg-green-500'
            : 'bg-slate-500',
          ]"
        >{{ PLANGUAGE_TYPE_LABEL[selectedNode.type] }}</span>
        <span class="flex-1 min-w-0 text-sm font-semibold text-slate-800 break-words">{{ selectedNode.label }}</span>
        <button
          type="button"
          class="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors duration-150"
          title="Close this detail card — click any other bar to see its detail"
          @click="closeDrilldown"
        >
          <span aria-hidden="true">✕</span>
          <span>Close</span>
        </button>
      </div>
      <p class="text-xs text-slate-700 leading-relaxed break-words whitespace-pre-wrap">{{ selectedNode.details }}</p>
    </div>
  </div>
</template>
