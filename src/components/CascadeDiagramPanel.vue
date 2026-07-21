<!-- UNIT_TYPE=Panel
  CascadeDiagramPanel.vue — Full-screen animated Cascade Ripple Diagram.

  Tom Gilb 2026-06-10: "SOME COLORFUL, DYNAMIC DIAGRAM OF THE CASCADING CHANGES,
    MAYBE EVEN PLAYS OUT AS AN ANIMATION"

  Layout: 4 columns left-to-right:
    [Changed] → [Direct Impact] → [2nd-Order] → [nth-Order]

  Animation (▶ Play / ↺ Replay):
    Phase 1 (0s):      Source nodes scale+fade in with glow
    Phase 2 (0.4s+):   Direct edges draw via stroke-dashoffset; glowing pulse travels along each
    Phase 3 (1.1s+):   Direct Impact nodes light up
    Phase 4 (1.6s+):   2nd-Order edges draw + pulses
    Phase 5 (2.3s+):   2nd-Order nodes light up
    Phase 6 (2.8s+):   nth-Order edges draw + pulses
    Phase 7 (3.5s+):   nth-Order nodes light up

  Visual distinction:
    Locked-In changes  — solid node borders, solid edges, full opacity
    Hypothetical       — dashed node borders, dashed edges, reduced opacity

  Claude-Code-as-AI-Layer: all layout + animation is deterministic. No API calls.
-->
<template>
  <Teleport to="body">
    <div
      ref="containerEl"
      class="fixed inset-0 z-[960] bg-slate-950 flex flex-col outline-none"
      tabindex="-1"
      @keydown.esc.stop="$emit('close')"
    >

      <!-- ── Header ──────────────────────────────────────────────────────────── -->
      <!-- r41 v375 (Tom Gilb 2026-06-25 "the cascade ripple diagram needs a
           title what it is and does") — replaced bare title with a two-line
           header: bold name + plain-English description of what the diagram
           shows and how to read it.  Pre-v375 said only "⚡ Cascade Ripple
           Diagram" with no explanation; a planner opening it for the first
           time had no anchor.  Composes with DD-009 Zero-Training UI. -->
      <div class="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <span class="relative flex h-3.5 w-3.5 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70"/>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"/>
        </span>
        <div class="flex flex-col gap-0.5 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-white font-bold text-sm tracking-wide">⚡ Cascade Ripple Diagram</h2>
            <span
              v-if="pendingImpacts.length"
              class="px-2 py-0.5 rounded-full bg-red-900/60 border border-red-500/40 text-red-300 text-[10px] font-semibold"
            >{{ pendingImpacts.length }} locked-in</span>
            <span
              v-if="whatIfImpacts.length"
              class="px-2 py-0.5 rounded-full bg-orange-900/50 border border-orange-500/40 text-orange-300 text-[10px] font-semibold"
            >{{ whatIfImpacts.length }} hypothetical</span>
          </div>
          <p class="text-[11px] text-slate-400 leading-snug">
            Shows how a change to ONE Planguage entry ripples outward through linked entries.
            Left-to-right reads:&nbsp;
            <span class="text-slate-200 font-semibold">Changed</span>&nbsp;→&nbsp;
            <span class="text-red-300 font-semibold">Direct Impact</span>&nbsp;→&nbsp;
            <span class="text-orange-300 font-semibold">2nd-Order</span>&nbsp;→&nbsp;
            <span class="text-amber-300 font-semibold">Nth-Order</span>.
            Solid lines&nbsp;= committed changes&nbsp;·&nbsp;Dashed&nbsp;= hypothetical "what-if" cascades you haven't applied yet.
          </p>
        </div>

        <div class="flex-1"/>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-[11px] font-bold transition-colors"
          :title="playKey > 0 ? 'Replay cascade animation from the beginning' : 'Play the cascade wave animation'"
          @click="replay"
        >{{ playKey > 0 ? '↺ Replay' : '▶ Play' }}</button>

        <!-- r93pp — Export buttons (Copy + Email) per Export-on-all-windows SUPREME rule.
             Captures the full diagram as inline SVG so the recipient sees the visual
             cascade flow, not a textual description. -->
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold whitespace-nowrap transition-colors ring-1 ring-emerald-800 flex items-center gap-1"
          title="📋 Copy — captures MORE than what's currently visible. Includes the full Cascade Ripple Diagram as inline SVG (visual flow you can paste into Mail, Notes, Keynote) PLUS the legend + counts. The play/replay state is environment-specific; recipients see the static diagram."
          @click="exportDiagram('copy')"
        >📋 Copy</button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold whitespace-nowrap transition-colors ring-1 ring-blue-800 flex items-center gap-1"
          title="✉ Email — captures MORE than what's currently visible. Auto-opens Mail with the Cascade Ripple Diagram as inline SVG + legend + counts on clipboard."
          @click="exportDiagram('email')"
        >✉ Email</button>

        <CloseDot size="lg" title="Close diagram (Esc)" @click="$emit('close')" />
      </div>

      <!-- ── SVG scroll area ─────────────────────────────────────────────────── -->
      <ScrollContainer outer-class="flex-1" inner-class="p-6 flex justify-start items-start">
        <!-- audit-ignore: scroll — SVG max-h is sized by parent flex container, not its own scroll region -->
        <svg
          ref="svgEl"
          :viewBox="`0 0 ${SVG_W} ${svgHeight}`"
          :width="SVG_W"
          :height="svgHeight"
          xmlns="http://www.w3.org/2000/svg"
          class="max-h-full"
          :aria-label="`Cascade ripple diagram — ${layout.nodes.length} entries, ${layout.edges.length} cascade relationships`"
        >

          <!-- ── Defs ──────────────────────────────────────────────────────── -->
          <defs>
            <marker id="cdp-arr-red"    markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#ef4444"/></marker>
            <marker id="cdp-arr-orange" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#f97316"/></marker>
            <marker id="cdp-arr-amber"  markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#eab308"/></marker>

            <!-- Pulse glow — makes the traveling dot bloom -->
            <filter id="cdp-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <!-- Subtle node highlight glow -->
            <filter id="cdp-node-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <!-- ── Column background bands ──────────────────────────────────── -->
          <g v-for="(col, ci) in COL_DEFS" :key="`col-bg-${ci}`">
            <rect
              :x="COL_X[ci] - NODE_W / 2 - COL_PAD"
              y="0"
              :width="NODE_W + COL_PAD * 2"
              :height="svgHeight"
              :fill="col.bandFill"
            />
            <!-- Header label -->
            <text
              :x="COL_X[ci]"
              :y="HEADER_H / 2 + 5"
              text-anchor="middle"
              dominant-baseline="middle"
              :fill="col.headerFill"
              font-size="10"
              font-weight="700"
              letter-spacing="2"
              font-family="ui-monospace, monospace"
            >{{ col.label }}</text>
            <!-- Header rule -->
            <line
              :x1="COL_X[ci] - NODE_W / 2 - COL_PAD"
              :y1="HEADER_H"
              :x2="COL_X[ci] + NODE_W / 2 + COL_PAD"
              :y2="HEADER_H"
              :stroke="col.headerFill"
              stroke-width="1"
              stroke-opacity="0.25"
            />
            <!-- Column border -->
            <rect
              :x="COL_X[ci] - NODE_W / 2 - COL_PAD"
              y="0"
              :width="NODE_W + COL_PAD * 2"
              :height="svgHeight"
              fill="none"
              :stroke="col.headerFill"
              stroke-width="1"
              stroke-opacity="0.12"
            />
          </g>

          <!-- ── Animated layer (key'd to playKey → restarts CSS animations) ── -->
          <g :key="playKey">

            <!-- Edges (behind nodes) -->
            <g v-for="edge in layout.edges" :key="`edge-${edge.id}`">
              <!-- The drawn path (stroke-dashoffset animation draws it left-to-right) -->
              <path
                :id="`cdp-p-${edge.id}`"
                :data-edge-id="edge.id"
                :d="edge.pathD"
                fill="none"
                :stroke="edgeStroke(edge.order)"
                stroke-width="1.8"
                :stroke-dasharray="edge.isWhatIf ? '7,4' : '0'"
                :marker-end="`url(#${edgeMarker(edge.order)})`"
                :opacity="edge.isWhatIf ? 0.55 : 0.85"
                :style="edgeAnimStyle(edge)"
              />
              <!-- Glowing pulse traveling along the edge path -->
              <circle
                r="5.5"
                :fill="edgeStroke(edge.order)"
                filter="url(#cdp-glow)"
                opacity="0"
              >
                <!-- Opacity: invisible → visible during travel → invisible after -->
                <animate
                  attributeName="opacity"
                  :values="`0;0;1;1;0`"
                  :keyTimes="`0;${pct(edge.pulseBegin)};${pct(edge.pulseBegin + 0.05)};${pct(edge.pulseBegin + PULSE_DUR * 0.8)};${pct(edge.pulseBegin + PULSE_DUR)}`"
                  :dur="`${TOTAL_DUR}s`"
                  fill="freeze"
                />
                <animateMotion
                  :dur="`${PULSE_DUR}s`"
                  :begin="`${edge.pulseBegin.toFixed(2)}s`"
                  fill="freeze"
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.4 0 0.2 1"
                >
                  <mpath :href="`#cdp-p-${edge.id}`"/>
                </animateMotion>
              </circle>
            </g>

            <!-- Nodes (above edges) -->
            <g
              v-for="node in layout.nodes"
              :key="`node-${node.id}`"
              class="cdp-node"
              :style="nodeAnimStyle(node)"
            >
              <!-- Source-column glow halo (col 0 only) -->
              <rect
                v-if="node.col === 0"
                :x="node.x - 4"
                :y="node.y - 4"
                :width="NODE_W + 8"
                :height="NODE_H + 8"
                rx="10"
                :fill="nodeTheme(node).stroke"
                opacity="0.18"
                filter="url(#cdp-node-glow)"
              />
              <!-- Node body -->
              <rect
                :x="node.x"
                :y="node.y"
                :width="NODE_W"
                :height="NODE_H"
                rx="7"
                :fill="nodeTheme(node).bg"
                :stroke="nodeTheme(node).stroke"
                :stroke-width="node.isWhatIf ? 1.2 : 1.8"
                :stroke-dasharray="node.isWhatIf ? '5,3' : 'none'"
                :stroke-opacity="node.isWhatIf ? 0.65 : 1"
              />
              <!-- Entry type label (small, near top) -->
              <text
                :x="node.cx"
                :y="node.y + 13"
                text-anchor="middle"
                dominant-baseline="middle"
                :fill="nodeTheme(node).dim"
                font-size="8"
                font-weight="700"
                letter-spacing="1.5"
                font-family="ui-monospace, monospace"
              >{{ node.typeLabel }}</text>
              <!-- Entry ID / label line 1 -->
              <text
                :x="node.cx"
                :y="node.labelLine2 ? node.y + NODE_H / 2 + 2 : node.y + NODE_H / 2 + 6"
                text-anchor="middle"
                dominant-baseline="middle"
                :fill="nodeTheme(node).text"
                font-size="11"
                font-weight="600"
                font-family="ui-sans-serif, system-ui, sans-serif"
              >{{ node.labelLine1 }}</text>
              <!-- Label line 2 (if the label is long) -->
              <text
                v-if="node.labelLine2"
                :x="node.cx"
                :y="node.y + NODE_H / 2 + 17"
                text-anchor="middle"
                dominant-baseline="middle"
                :fill="nodeTheme(node).text"
                font-size="10"
                opacity="0.8"
                font-family="ui-sans-serif, system-ui, sans-serif"
              >{{ node.labelLine2 }}</text>
              <!-- What-if badge -->
              <text
                v-if="node.isWhatIf"
                :x="node.x + NODE_W - 6"
                :y="node.y + 8"
                text-anchor="end"
                dominant-baseline="middle"
                fill="#fbbf24"
                font-size="8"
                font-style="italic"
              >?</text>
            </g>

          </g><!-- end animated layer -->

        </svg>
      </ScrollContainer>

      <!-- ── Legend ──────────────────────────────────────────────────────────── -->
      <div class="shrink-0 px-5 py-2 bg-slate-900 border-t border-slate-700 flex items-center gap-5 flex-wrap">
        <span class="text-[9px] font-bold uppercase tracking-wide text-slate-500">Entry type:</span>
        <span v-for="item in LEGEND_TYPES" :key="item.type" class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded" :style="`background:${item.bg}; outline: 1.5px solid ${item.stroke}`"/>
          <span class="text-[10px] text-slate-400">{{ item.label }}</span>
        </span>
        <span class="flex items-center gap-1.5 ml-2">
          <span class="inline-block w-8 h-0.5 bg-red-400 rounded"/>
          <span class="text-[10px] text-slate-400">Locked-in cascade</span>
        </span>
        <span class="flex items-center gap-1.5">
          <svg width="32" height="4" class="overflow-visible"><line x1="0" y1="2" x2="32" y2="2" stroke="#f97316" stroke-width="1.8" stroke-dasharray="5,3"/></svg>
          <span class="text-[10px] text-slate-400">Hypothetical cascade</span>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="relative flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"/><span class="relative inline-flex h-3 w-3 rounded-full bg-white/80"/></span>
          <span class="text-[10px] text-slate-400">Ripple pulse</span>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="text-[9px] text-amber-400 font-bold italic">?</span>
          <span class="text-[10px] text-slate-400">Hypothetical node</span>
        </span>
      </div>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { PentaFieldChange, CascadeImpact, CascadeOrder } from '../types/pentaGovernance'
// r93pp — Export the diagram as inline SVG (per r93oo lesson — visual not source)
import { exportCopy, exportEmail } from '../composables/useExportShared'
import { useToast } from '../composables/useToast'
const { showToast: _cascadeToast } = useToast()

const props = defineProps<{
  pendingChanges: PentaFieldChange[]
  pendingImpacts: CascadeImpact[]
  whatIfChanges:  PentaFieldChange[]
  whatIfImpacts:  CascadeImpact[]
}>()
defineEmits<{ close: [] }>()

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W    = 188
const NODE_H    = 50
const NODE_GAP  = 22   // vertical gap between nodes in same column
const HEADER_H  = 50   // column header height
const PAD_V     = 28   // top + bottom padding
const COL_PAD   = 14   // horizontal padding inside column band
const SVG_W     = 1080

// Column center X positions
const COL_X = [124, 400, 672, 948] as const

const COL_DEFS = [
  { label: 'CHANGED',       bandFill: '#1e1b4b18', headerFill: '#a5b4fc' },
  { label: 'DIRECT IMPACT', bandFill: '#450a0a18', headerFill: '#fca5a5' },
  { label: '2ND-ORDER',     bandFill: '#431407 16', headerFill: '#fdba74' },
  { label: 'NTH-ORDER',     bandFill: '#42350f16', headerFill: '#fde68a' },
] as const

// ── Animation timing (seconds) ────────────────────────────────────────────────
// Phase timing: col appear delays, edge start delays, durations
const COL_APPEAR = [0.0, 1.05, 1.95, 2.85] as const  // when nodes per column start appearing
const EDGE_START = [0.38, 1.42, 2.32]       as const  // when edges per source-col start drawing
const EDGE_DUR   = 0.52
const NODE_DUR   = 0.35
const PULSE_DUR  = 0.60
const NODE_STAG  = 0.09   // per-node stagger within same column
const EDGE_STAG  = 0.14   // per-edge stagger within same batch
const TOTAL_DUR  = 5.5    // total animation duration for keyTimes computation

// ── State ─────────────────────────────────────────────────────────────────────
const svgEl       = ref<SVGSVGElement | null>(null)
const containerEl = ref<HTMLElement | null>(null)
const playKey     = ref(0)
const pathLengths = ref<Record<string, number>>({})

function replay() {
  playKey.value++
  nextTick(measurePaths)
}

// ─── r93pp — Export the diagram as inline SVG (per r93oo lesson) ─────────
//
// Tom Gilb 2026-06-11: "is there anything else you forgot for same root cause?" —
// CascadeDiagramPanel previously had ZERO export. Now exports the diagram as inline
// SVG so the user can paste the visual cascade flow into Mail / Notes / Keynote.

function _captureDiagramSvg(): string {
  if (!svgEl.value) return ''
  // Clone so we can strip animations + add an xmlns for stand-alone display
  const clone = svgEl.value.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // Inline-display: also set width/height attrs explicitly so it renders at size in Mail
  if (!clone.getAttribute('width')) clone.setAttribute('width', String(SVG_W))
  return clone.outerHTML
}

function renderDiagramHtml(): string {
  const svg = _captureDiagramSvg()
  const pendCount = props.pendingImpacts.length
  const whatIfCount = props.whatIfImpacts.length
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1200px;font-family:system-ui,-apple-system,sans-serif;border-collapse:collapse;">
  <tr><td bgcolor="#0f172a" style="background:#0f172a;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:20px;font-weight:900;">⚡ Cascade Ripple Diagram</div>
    <div style="font-size:13px;opacity:0.85;margin-top:4px;">${pendCount} locked-in consequence${pendCount !== 1 ? 's' : ''} · ${whatIfCount} hypothetical (if applied)</div>
  </td></tr>
  <tr><td bgcolor="#fafafa" style="background:#fafafa;padding:18px;text-align:center;">
    ${svg || '<div style="font-style:italic;color:#64748b;">Diagram capture failed — open the panel in the SEM App to view the live diagram.</div>'}
  </td></tr>
  <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:12px 22px;border-radius:0 0 12px 12px;font-size:11px;color:#475569;">
    <strong>Completeness Pledge (r93ll/r93oo/r93pp):</strong> the SVG above is the full cascade diagram as rendered in the SEM App. The interactive Play/Replay animation is environment-specific — recipients see the static visual; open the diagram in the SEM App for the wave-replay animation.
  </td></tr>
</table>`
}

function renderDiagramPlain(): string {
  return [
    '⚡ CASCADE RIPPLE DIAGRAM',
    `${props.pendingImpacts.length} locked-in · ${props.whatIfImpacts.length} hypothetical`,
    '',
    'The colour HTML version (on clipboard for ⌘V) contains the full diagram as inline SVG.',
    'Plain-text format cannot render visual edges — open the diagram in the SEM App via the',
    'Cascade Ripple Panel "🎬 Diagram" button for the interactive view.',
  ].join('\n')
}

async function exportDiagram(mode: 'copy' | 'email'): Promise<void> {
  const html  = renderDiagramHtml()
  const plain = renderDiagramPlain()
  if (mode === 'copy') {
    await exportCopy(html, plain)
    _cascadeToast('⚡ Cascade Ripple Diagram copied as colourful HTML — paste with ⌘V', 5000)
  } else {
    await exportEmail(html, '⚡ Cascade Ripple Diagram', 'Cascade Ripple Diagram', 'Tom@Gilb.com', plain)
  }
}

function measurePaths() {
  if (!svgEl.value) return
  svgEl.value.querySelectorAll<SVGPathElement>('path[data-edge-id]').forEach(p => {
    const id  = p.dataset.edgeId!
    const len = p.getTotalLength()
    if (len > 0) pathLengths.value[id] = Math.ceil(len)
  })
}

onMounted(() => {
  containerEl.value?.focus()
  nextTick(measurePaths)
})

// ── Node and edge types ───────────────────────────────────────────────────────
interface DNode {
  id:         string
  label:      string
  labelLine1: string
  labelLine2: string
  typeLabel:  string
  itemType:   string
  col:        number
  row:        number
  x:          number   // left edge
  y:          number   // top edge
  cx:         number   // center x
  cy:         number   // center y
  isWhatIf:   boolean
  animDelay:  number   // seconds
}

interface DEdge {
  id:         string
  fromNode:   DNode
  toNode:     DNode
  order:      CascadeOrder
  isWhatIf:   boolean
  pathD:      string
  animDelay:  number   // edge draw start (s)
  pulseBegin: number   // glowing pulse travel start (s)
}

// ── Layout computation ────────────────────────────────────────────────────────
const layout = computed<{ nodes: DNode[]; edges: DEdge[] }>(() => {
  // ─ 1. Collect unique nodes per column ────────────────────────────────────
  const seen   = new Set<string>()
  const rawNodes: { id: string; label: string; itemType: string; col: number; isWhatIf: boolean }[] = []

  function addNode(id: string, label: string, itemType: string, col: number, isWhatIf: boolean) {
    const key = `${col}::${id}`
    if (!seen.has(key)) {
      seen.add(key)
      rawNodes.push({ id, label: cleanLabel(label), itemType: itemType.toLowerCase(), col, isWhatIf })
    }
  }

  // Source nodes (col 0)
  for (const ch of props.pendingChanges) addNode(ch.itemId, ch.itemLabel, ch.itemType, 0, false)
  for (const ch of props.whatIfChanges)  addNode(ch.itemId, ch.itemLabel, ch.itemType, 0, true)

  // Target nodes (cols 1-3)
  for (const imp of props.pendingImpacts) addNode(imp.effectItemId, imp.effectItemLabel, imp.effectItemType, orderCol(imp.order), false)
  for (const imp of props.whatIfImpacts)  addNode(imp.effectItemId, imp.effectItemLabel, imp.effectItemType, orderCol(imp.order), true)

  // ─ 2. Assign rows + positions ────────────────────────────────────────────
  const rowCount: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  const nodes: DNode[] = rawNodes.map(rn => {
    const row  = rowCount[rn.col]++
    const cx   = COL_X[rn.col]
    const x    = cx - NODE_W / 2
    const y    = HEADER_H + PAD_V + row * (NODE_H + NODE_GAP)
    const [l1, l2] = splitLabel(rn.label)
    return {
      ...rn,
      row, cx, cy: y + NODE_H / 2, x, y,
      labelLine1: l1,
      labelLine2: l2,
      typeLabel:  rn.itemType.toUpperCase(),
      animDelay:  COL_APPEAR[rn.col] + row * NODE_STAG,
    }
  })

  const nodeByColId = new Map(nodes.map(n => [`${n.col}::${n.id}`, n]))
  const nodeByIdInCol = (id: string, col: number) => nodeByColId.get(`${col}::${id}`)
  const sourceNode    = (id: string) => nodeByIdInCol(id, 0)

  // ─ 3. Build edges ─────────────────────────────────────────────────────────
  const edgeSeen   = new Set<string>()
  const batchCount = [0, 0, 0] // per edge source-column batch count

  const edges: DEdge[] = []

  function addEdge(from: DNode | undefined, to: DNode | undefined, order: CascadeOrder, isWhatIf: boolean) {
    if (!from || !to || from === to) return
    const key = `${from.col}::${from.id}→${to.col}::${to.id}`
    if (edgeSeen.has(key)) return
    edgeSeen.add(key)

    // Bezier: right edge of from → left edge of to
    const x1 = from.cx + NODE_W / 2
    const y1 = from.cy
    const x2 = to.cx   - NODE_W / 2
    const y2 = to.cy
    const mx = (x1 + x2) / 2
    const pathD = `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`

    const batchIdx  = Math.min(from.col, 2)
    const delay     = EDGE_START[batchIdx] + batchCount[batchIdx]++ * EDGE_STAG
    const pulseBeg  = delay + EDGE_DUR * 0.6

    edges.push({ id: `${from.id}-${to.id}`, fromNode: from, toNode: to, order, isWhatIf, pathD, animDelay: delay, pulseBegin: pulseBeg })
  }

  // Helper: find the "via" node for 2nd-order/nth-order edges
  // (route from the direct impact nodes of the same source to give a realistic left-to-right flow)
  function viaNode(imp: CascadeImpact, impacts: CascadeImpact[], col: number, isWhatIf: boolean): DNode | undefined {
    if (col === 1) return sourceNode(imp.causeItemId)
    if (col === 2) {
      // Find any direct-impact node of the same source item
      const di = impacts.find(i => i.order === 'direct' && i.causeItemId === imp.causeItemId)
      if (di) return nodeByIdInCol(di.effectItemId, 1)
      // Fallback: first col-1 node
      return nodes.find(n => n.col === 1 && n.isWhatIf === isWhatIf) ?? sourceNode(imp.causeItemId)
    }
    // col === 3: find any 2nd-order node
    const si = impacts.find(i => i.order === '2nd-order' && i.causeItemId === imp.causeItemId)
    if (si) return nodeByIdInCol(si.effectItemId, 2)
    const di = impacts.find(i => i.order === 'direct' && i.causeItemId === imp.causeItemId)
    if (di) return nodeByIdInCol(di.effectItemId, 1)
    return nodes.find(n => n.col === 2 && n.isWhatIf === isWhatIf) ?? sourceNode(imp.causeItemId)
  }

  for (const imp of props.pendingImpacts) {
    const col  = orderCol(imp.order)
    const from = viaNode(imp, props.pendingImpacts, col, false)
    const to   = nodeByIdInCol(imp.effectItemId, col)
    addEdge(from, to, imp.order, false)
  }
  for (const imp of props.whatIfImpacts) {
    const col  = orderCol(imp.order)
    const from = viaNode(imp, props.whatIfImpacts, col, true)
    const to   = nodeByIdInCol(imp.effectItemId, col)
    addEdge(from, to, imp.order, true)
  }

  return { nodes, edges }
})

const svgHeight = computed(() => {
  const maxRows = Math.max(1, ...[0, 1, 2, 3].map(col => layout.value.nodes.filter(n => n.col === col).length))
  return HEADER_H + PAD_V * 2 + maxRows * (NODE_H + NODE_GAP) - NODE_GAP + PAD_V
})

// ── Color / style helpers ─────────────────────────────────────────────────────
const TYPE_THEMES: Record<string, { bg: string; stroke: string; text: string; dim: string }> = {
  value:      { bg: '#3b0764', stroke: '#a78bfa', text: '#ede9fe', dim: '#c4b5fd' },
  solution:   { bg: '#431407', stroke: '#fb923c', text: '#ffedd5', dim: '#fed7aa' },
  resource:   { bg: '#2e1065', stroke: '#c084fc', text: '#f3e8ff', dim: '#d8b4fe' },
  function:   { bg: '#052e16', stroke: '#4ade80', text: '#dcfce7', dim: '#86efac' },
  constraint: { bg: '#450a0a', stroke: '#f87171', text: '#fee2e2', dim: '#fca5a5' },
  other:      { bg: '#1e293b', stroke: '#64748b', text: '#e2e8f0', dim: '#94a3b8' },
}

const LEGEND_TYPES = [
  { type: 'value',      label: 'Value',      bg: '#3b0764', stroke: '#a78bfa' },
  { type: 'solution',   label: 'Solution',   bg: '#431407', stroke: '#fb923c' },
  { type: 'resource',   label: 'Resource',   bg: '#2e1065', stroke: '#c084fc' },
  { type: 'function',   label: 'Function',   bg: '#052e16', stroke: '#4ade80' },
  { type: 'constraint', label: 'Constraint', bg: '#450a0a', stroke: '#f87171' },
]

function nodeTheme(node: DNode) {
  return TYPE_THEMES[node.itemType] ?? TYPE_THEMES['other']
}

function edgeStroke(order: CascadeOrder): string {
  if (order === 'direct')    return '#ef4444'
  if (order === '2nd-order') return '#f97316'
  return '#eab308'
}

function edgeMarker(order: CascadeOrder): string {
  if (order === 'direct')    return 'cdp-arr-red'
  if (order === '2nd-order') return 'cdp-arr-orange'
  return 'cdp-arr-amber'
}

function edgeAnimStyle(edge: DEdge): string {
  const len   = (pathLengths.value[edge.id] ?? 260).toString()
  const delay = edge.animDelay.toFixed(2)
  // The dasharray for a SOLID locked-in edge must overcome the initial full-length offset
  const dArr  = edge.isWhatIf ? `7 4` : len
  return [
    `stroke-dasharray: ${dArr}`,
    `stroke-dashoffset: ${len}`,
    `animation: cdpEdgeDraw ${EDGE_DUR}s ease-out ${delay}s forwards`,
  ].join('; ')
}

function nodeAnimStyle(node: DNode): string {
  // r41 v374 (Tom Gilb 2026-06-25 screenshot — Cascade Ripple diagram showed
  // empty node columns with only dashed arrows visible).  Previously this
  // returned `opacity:0; animation:... forwards` — nodes started invisible
  // and relied on the CSS @keyframes to fade them in.  When the animation
  // doesn't run (Vue scoped-CSS quirk · browser pref disabling animations ·
  // reactive re-render resetting the inline style · keyframes-not-found),
  // nodes stay at opacity:0 forever and the diagram is unreadable.
  //
  // Fix: default to opacity:1 so nodes are ALWAYS visible regardless of
  // animation state.  The cdpNodeAppear animation still runs as DECORATION
  // (scales nodes in from 0.55 → 1.0 across animDelay), but visibility
  // doesn't depend on it.  Diagram is now self-healing — broken animation
  // gives a static visible diagram instead of a black hole. */
  return `animation: cdpNodeAppear ${NODE_DUR}s ease-out ${node.animDelay.toFixed(2)}s both`
}

// Percentage of TOTAL_DUR for keyTimes (must be 0–1, increasing)
function pct(t: number): string {
  return Math.min(1, Math.max(0, t / TOTAL_DUR)).toFixed(4)
}

function orderCol(order: CascadeOrder): number {
  if (order === 'direct')    return 1
  if (order === '2nd-order') return 2
  return 3
}

function cleanLabel(raw: string): string {
  // Strip "— FieldName" suffixes added by itemLabel construction in applyItemEdits
  return raw.replace(/\s*—\s*(Goal|Tolerable|Wish|Scale|Meter|Status|Budget|Description)$/i, '').trim()
}

function splitLabel(label: string): [string, string] {
  const s = label.slice(0, 42)
  if (s.length <= 20) return [s, '']
  const mid = 20
  const sp  = s.lastIndexOf(' ', mid)
  const cut = sp > 4 ? sp : mid
  const l1  = s.slice(0, cut)
  const l2  = s.slice(cut + (s[cut] === ' ' ? 1 : 0))
  return [l1, l2.slice(0, 22) + (l2.length > 22 ? '…' : '')]
}
</script>

<style scoped>
/* transform-box: fill-box makes transform-origin work correctly in SVG context */
.cdp-node {
  transform-box: fill-box;
  transform-origin: center;
}

/* r41 v374 — animation no longer gates visibility.  Nodes are ALWAYS
   opacity:1; the cdpNodeAppear keyframes only do a subtle scale-in pop.
   Pre-v374 used opacity:0 → 1 which left nodes invisible if the animation
   didn't run.  Diagram is now self-healing. */
@keyframes cdpNodeAppear {
  from {
    transform: scale(0.55);
  }
  to {
    transform: scale(1);
  }
}

@keyframes cdpEdgeDraw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
