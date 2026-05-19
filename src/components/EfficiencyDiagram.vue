<!--
  EfficiencyDiagram.vue — Solution Efficiency Flow diagram

  Three-zone left-to-right bipartite SVG:
    Resources (dark green, left) → Solutions (orange, centre, ranked by V/C) → Values (violet, right)

  The physical layout encodes efficiency: a solution with wide right-side edges (high value impact)
  relative to its left-side edge width (cost) is visually more efficient. The V/C badge confirms it.

  Simplification by design (Tom Gilb 2026-05-17):
    • Top 3 value connections per solution (configurable via TOP_N)
    • Two resource metrics per solution: calendar weeks + capital $k
    • Solutions ranked most-efficient first (highest V/C at top)

  Data from the Impact Estimation / VDT view:
    impactMatrix  — impactMatrix[valueId][solutionId] = impact%
    vcRatios      — vcRatios[solutionId] = V/C ratio (totalImpact / totalCost)
    calendarCosts — calendarCosts[solutionId] = calendar weeks
    capitalCosts  — capitalCosts[solutionId] = capital cost in $k

  Tom Gilb 2026-05-17: "the norm is that a solution affects many values and costs —
  the value table should show this, reflect the vdt — bring in resources into this picture,
  as in the VDT, and show the connection to both values and the costs — top 3 values impacts,
  and top 2 resources."
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { ImpactMatrix } from '../types/impact'

const props = defineProps<{
  spec:          SpecBlock
  impactMatrix:  ImpactMatrix
  vcRatios:      Record<string, number>
  calendarCosts: Record<string, number>
  capitalCosts:  Record<string, number>
}>()

// ── Layout constants (SVG px) ─────────────────────────────────────────────────
const LX = 18    // cost card left edge
const LW = 140   // cost card width
const MX = 222   // solution card left edge
const MW = 210   // solution card width
const RX = 490   // value node left edge
const RW = 168   // value node width

const SVG_W = RX + RW + 18  // 676px total width

const ROW_H  = 90    // height of one solution row (card + padding)
const SOL_H  = 68    // solution card height
const COST_H = 52    // cost card height
const TOP    = 54    // top padding for column header text

const VC_H   = 40    // value node rect height
const VC_R   = 20    // value node corner radius
const V_GAP  = 56    // value node center-to-center spacing

const TOP_N  = 3     // max value edges drawn per solution

// ── Formatting helpers ────────────────────────────────────────────────────────
function trunc(s: string | undefined | null, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
function fmtW(v: number | undefined): string {
  if (v == null || v === 0) return '?'
  return v + 'w'
}
function fmtCap(v: number | undefined): string {
  if (v == null || v === 0) return '?'
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'M'
  return '$' + v + 'k'
}

// ── Data: has any impact data been entered? ────────────────────────────────────
const hasData = computed(() => Object.keys(props.impactMatrix).length > 0)

// ── Data: solutions ranked by V/C descending ──────────────────────────────────
const rankedSols = computed(() =>
  [...props.spec.solutions].sort((a, b) =>
    (props.vcRatios[b.id] ?? 0) - (props.vcRatios[a.id] ?? 0)
  )
)

// ── Data: top-N value edges per solution ──────────────────────────────────────
interface Edge { solId: string; valId: string; pct: number }

const topEdges = computed<Edge[]>(() => {
  const out: Edge[] = []
  rankedSols.value.forEach(sol => {
    props.spec.values
      .map(v => ({ valId: v.id, pct: props.impactMatrix[v.id]?.[sol.id] ?? 0 }))
      .filter(h => h.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, TOP_N)
      .forEach(h => out.push({ solId: sol.id, ...h }))
  })
  return out
})

// Count of additional (hidden) value connections per solution
const solExtraVals = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  rankedSols.value.forEach(sol => {
    const total = props.spec.values.filter(
      v => (props.impactMatrix[v.id]?.[sol.id] ?? 0) > 0
    ).length
    m.set(sol.id, Math.max(0, total - TOP_N))
  })
  return m
})

// ── Data: visible value nodes — appear in ≥1 top edge ────────────────────────
const visVals = computed<string[]>(() => {
  const seen = new Set<string>(topEdges.value.map(e => e.valId))
  const rowOf = new Map(rankedSols.value.map((s, i) => [s.id, i]))
  // Sort values so connecting edges cross as little as possible
  return [...seen].sort((a, b) => {
    const ea = topEdges.value.filter(e => e.valId === a)
    const eb = topEdges.value.filter(e => e.valId === b)
    const avg = (es: Edge[]) =>
      es.reduce((s, e) => s + (rowOf.get(e.solId) ?? 0), 0) / (es.length || 1)
    return avg(ea) - avg(eb)
  })
})

// ── Data: value node Y positions (block centred on solution zone) ─────────────
const vYMap = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  const vals = visVals.value
  if (!vals.length) return m
  const solZoneH  = rankedSols.value.length * ROW_H
  const totalVH   = (vals.length - 1) * V_GAP + VC_H
  const startCY   = TOP + Math.max(0, (solZoneH - totalVH) / 2) + VC_H / 2
  vals.forEach((id, i) => m.set(id, startCY + i * V_GAP))
  return m
})

// ── Data: aggregates ──────────────────────────────────────────────────────────
// Total impact received by each value across all solutions
const vTotalIn = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  props.spec.values.forEach(v => {
    m.set(v.id, rankedSols.value.reduce(
      (s, sol) => s + (props.impactMatrix[v.id]?.[sol.id] ?? 0), 0))
  })
  return m
})

// Total impact delivered by each solution across all values
const sTotalOut = computed<Map<string, number>>(() => {
  const m = new Map<string, number>()
  rankedSols.value.forEach(sol => {
    m.set(sol.id, props.spec.values.reduce(
      (s, v) => s + (props.impactMatrix[v.id]?.[sol.id] ?? 0), 0))
  })
  return m
})

// Solution index for geometry lookups
const solIdxOf = computed<Map<string, number>>(() =>
  new Map(rankedSols.value.map((s, i) => [s.id, i]))
)

// ── Geometry helpers ───────────────────────────────────────────────────────────
function sCardTop(i: number): number { return TOP + i * ROW_H + (ROW_H - SOL_H)  / 2 }
function sMidY(i: number):    number { return sCardTop(i) + SOL_H / 2 }
function cCardTop(i: number): number { return TOP + i * ROW_H + (ROW_H - COST_H) / 2 }
// cMidY === sMidY because both cards are centred within the same ROW_H

// Bezier: solution right edge → value left edge
function solToVal(si: number, vy: number): string {
  const x0 = MX + MW, y0 = sMidY(si)
  const x1 = RX + 2,  y1 = vy
  const cx  = x0 + (x1 - x0) * 0.5
  return `M ${x0} ${y0} C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`
}

// Straight line: cost card right → solution left (same row Y, so it's horizontal)
function costToSol(si: number): string {
  const y = sMidY(si)
  return `M ${LX + LW} ${y} L ${MX} ${y}`
}

// Value edge: thickness 1.5–9px, opacity 0.38–0.90
function eW(pct: number): number  { return 1.5 + (pct / 100) * 7.5 }
function eOp(pct: number): number { return 0.38 + (pct / 100) * 0.52 }

// Cost edge width scales with combined cost vs max cost
const maxCostVal = computed(() => {
  let m = 0
  rankedSols.value.forEach(s => {
    const c = (props.calendarCosts[s.id] ?? 0) + (props.capitalCosts[s.id] ?? 0)
    if (c > m) m = c
  })
  return m || 1
})
function cEW(si: number): number {
  const sol = rankedSols.value[si]
  const c = (props.calendarCosts[sol.id] ?? 0) + (props.capitalCosts[sol.id] ?? 0)
  return 1.5 + (c / maxCostVal.value) * 4.5
}

// V/C colour coding (green ≥ 5, amber 2–5, red < 2)
function vcFg(r: number):     string { return r >= 5 ? '#15803d' : r >= 2 ? '#b45309' : '#b91c1c' }
function vcBg(r: number):     string { return r >= 5 ? '#f0fdf4' : r >= 2 ? '#fffbeb' : '#fef2f2' }
function vcBorder(r: number): string { return r >= 5 ? '#86efac' : r >= 2 ? '#fcd34d' : '#fca5a5' }

// SVG height: whichever is taller — solution rows or value nodes
const svgH = computed(() => {
  const fromSols = TOP + rankedSols.value.length * ROW_H + 28
  const lastId   = visVals.value[visVals.value.length - 1]
  const fromVals = lastId ? (vYMap.value.get(lastId) ?? 0) + VC_H / 2 + 24 : 0
  return Math.max(fromSols, fromVals)
})

// Safe getters (TypeScript non-null assertions not valid in templates)
function getValY(valId: string): number   { return vYMap.value.get(valId) ?? 0 }
function getSolIdx(solId: string): number { return solIdxOf.value.get(solId) ?? 0 }
function vcR(solId: string): number       { return props.vcRatios[solId] ?? 0 }
</script>

<template>
  <div class="select-none">

    <!-- ── Empty state ──────────────────────────────────────────────────────── -->
    <div v-if="!hasData"
      class="flex flex-col items-center justify-center gap-4 py-28 text-center">
      <span class="text-[44px]">⚡</span>
      <p class="text-[15px] font-semibold text-gray-700">No impact data yet</p>
      <p class="text-[13px] text-gray-500 max-w-xs leading-relaxed">
        Complete the <strong>Impact Estimation</strong> step — build the V/C matrix —
        then return here to see the Solution Efficiency flow.
      </p>
    </div>

    <!-- ── Diagram ───────────────────────────────────────────────────────────── -->
    <template v-else>
      <svg
        :width="SVG_W"
        :height="svgH"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        overflow="visible"
      >
        <!-- ── Column headers ──────────────────────────────────────────────── -->
        <text :x="LX + LW/2" y="20" text-anchor="middle"
          font-size="9" font-weight="700" letter-spacing="1" fill="#166534">RESOURCES</text>
        <text :x="LX + LW/2" y="34" text-anchor="middle"
          font-size="7.5" fill="#4ade80" opacity="0.9">→O  cost in</text>

        <text :x="MX + MW/2" y="20" text-anchor="middle"
          font-size="9" font-weight="700" letter-spacing="1" fill="#c2410c">SOLUTIONS</text>
        <text :x="MX + MW/2" y="34" text-anchor="middle"
          font-size="7.5" fill="#fb923c">ranked by V/C (most efficient first)</text>

        <text :x="RX + RW/2" y="20" text-anchor="middle"
          font-size="9" font-weight="700" letter-spacing="1" fill="#6d28d9">VALUES</text>
        <text :x="RX + RW/2" y="34" text-anchor="middle"
          font-size="7.5" fill="#a78bfa">top {{ TOP_N }} per solution shown</text>

        <!-- ── EDGES (drawn first, under node cards) ────────────────────────── -->

        <!-- Resource → Solution  (dark green, dashed = →O resource-in grammar) -->
        <path
          v-for="(sol, i) in rankedSols"
          :key="'ce-' + sol.id"
          :d="costToSol(i)"
          fill="none"
          stroke="#166534"
          :stroke-width="cEW(i)"
          stroke-dasharray="5 3"
          stroke-linecap="round"
          opacity="0.6"
        >
          <title>{{ sol.id }} resource cost: {{ fmtW(props.calendarCosts[sol.id]) }} / {{ fmtCap(props.capitalCosts[sol.id]) }}</title>
        </path>

        <!-- Solution → Value  (violet solid, width = impact %) -->
        <path
          v-for="edge in topEdges"
          :key="edge.solId + '→' + edge.valId"
          :d="solToVal(getSolIdx(edge.solId), getValY(edge.valId))"
          fill="none"
          stroke="#7c3aed"
          :stroke-width="eW(edge.pct)"
          :opacity="eOp(edge.pct)"
          stroke-linecap="round"
        >
          <title>{{ edge.solId }} → {{ edge.valId }}: {{ edge.pct }}% impact</title>
        </path>

        <!-- ── RESOURCE COST CARDS (left zone) ─────────────────────────────── -->
        <g v-for="(sol, i) in rankedSols" :key="'cc-' + sol.id">
          <!-- Card -->
          <rect :x="LX" :y="cCardTop(i)" :width="LW" :height="COST_H" rx="9"
            fill="#f0fdf4" stroke="#4ade80" stroke-width="1.5" />
          <!-- →O glyph (resource enters) -->
          <text :x="LX + LW/2" :y="cCardTop(i) + 14"
            text-anchor="middle" font-size="8" font-weight="700" fill="#166534" letter-spacing="0.5">→O resource</text>
          <!-- Vertical divider between time and capital -->
          <line
            :x1="LX + LW/2" :y1="cCardTop(i) + 18"
            :x2="LX + LW/2" :y2="cCardTop(i) + COST_H - 8"
            stroke="#bbf7d0" stroke-width="1" />
          <!-- Calendar weeks -->
          <text :x="LX + LW/4" :y="cCardTop(i) + 33"
            text-anchor="middle" font-size="13" font-weight="700" fill="#166534">
            {{ fmtW(props.calendarCosts[sol.id]) }}
          </text>
          <text :x="LX + LW/4" :y="cCardTop(i) + COST_H - 7"
            text-anchor="middle" font-size="7" fill="#4ade80">time</text>
          <!-- Capital cost -->
          <text :x="LX + LW*3/4" :y="cCardTop(i) + 33"
            text-anchor="middle" font-size="13" font-weight="700" fill="#166534">
            {{ fmtCap(props.capitalCosts[sol.id]) }}
          </text>
          <text :x="LX + LW*3/4" :y="cCardTop(i) + COST_H - 7"
            text-anchor="middle" font-size="7" fill="#4ade80">capital</text>
        </g>

        <!-- ── SOLUTION CARDS (centre zone) ────────────────────────────────── -->
        <g v-for="(sol, i) in rankedSols" :key="'sc-' + sol.id">
          <!-- Card background (tinted by V/C efficiency) -->
          <rect :x="MX" :y="sCardTop(i)" :width="MW" :height="SOL_H" rx="12"
            :fill="vcBg(vcR(sol.id))"
            :stroke="vcBorder(vcR(sol.id))"
            stroke-width="1.8" />
          <!-- Vertical divider separating efficiency from identity -->
          <line
            :x1="MX + 94" :y1="sCardTop(i) + 8"
            :x2="MX + 94" :y2="sCardTop(i) + SOL_H - 8"
            :stroke="vcBorder(vcR(sol.id))" stroke-width="1" />

          <!-- LEFT HALF: rank badge + V/C ratio ──────────────────────────── -->
          <!-- Rank circle -->
          <circle :cx="MX + 18" :cy="sCardTop(i) + 22" r="13" :fill="vcFg(vcR(sol.id))" />
          <text :x="MX + 18" :y="sCardTop(i) + 27"
            text-anchor="middle" font-size="11" font-weight="800" fill="white">{{ i + 1 }}</text>
          <!-- V/C number (large) -->
          <text :x="MX + 40" :y="sCardTop(i) + 28"
            font-size="21" font-weight="800" :fill="vcFg(vcR(sol.id))">
            {{ vcR(sol.id).toFixed(1) }}
          </text>
          <!-- V/C label -->
          <text :x="MX + 40" :y="sCardTop(i) + 40"
            font-size="7.5" :fill="vcFg(vcR(sol.id))" opacity="0.75">V/C</text>
          <!-- Total impact sum -->
          <text :x="MX + 40" :y="sCardTop(i) + SOL_H - 10"
            font-size="7.5" :fill="vcFg(vcR(sol.id))" opacity="0.65">
            ∑ {{ sTotalOut.get(sol.id) ?? 0 }}% total impact
          </text>

          <!-- RIGHT HALF: solution identity ──────────────────────────────── -->
          <text :x="MX + 100" :y="sCardTop(i) + 18"
            font-size="8.5" font-weight="700" fill="#78350f"
            font-family="ui-monospace, monospace">
            {{ trunc(sol.id, 22) }}
          </text>
          <text :x="MX + 100" :y="sCardTop(i) + 31"
            font-size="8" fill="#92400e" opacity="0.85">
            {{ trunc(sol.description, 26) }}
          </text>
          <!-- "N more values" hint -->
          <text
            v-if="(solExtraVals.get(sol.id) ?? 0) > 0"
            :x="MX + 100" :y="sCardTop(i) + SOL_H - 10"
            font-size="7" fill="#92400e" opacity="0.55">
            + {{ solExtraVals.get(sol.id) }} more values
          </text>
        </g>

        <!-- ── VALUE NODES (right zone) ────────────────────────────────────── -->
        <g v-for="valId in visVals" :key="'vn-' + valId">
          <rect
            :x="RX + 2" :y="getValY(valId) - VC_H/2"
            :width="RW - 4" :height="VC_H" :rx="VC_R"
            fill="#f5f3ff" stroke="#a78bfa" stroke-width="1.5" />
          <!-- Value ID -->
          <text :x="RX + RW/2" :y="getValY(valId) - 3"
            text-anchor="middle" font-size="8.5" font-weight="700" fill="#5b21b6"
            font-family="ui-monospace, monospace">
            {{ trunc(valId, 20) }}
          </text>
          <!-- Total impact received label -->
          <text :x="RX + RW/2" :y="getValY(valId) + 11"
            text-anchor="middle" font-size="7.5" fill="#7c3aed" opacity="0.7">
            ∑ {{ vTotalIn.get(valId) ?? 0 }}% received
          </text>
        </g>
      </svg>

      <!-- ── Legend ────────────────────────────────────────────────────────── -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 px-1 text-[10px] text-gray-500">
        <span class="flex items-center gap-1.5">
          <span class="w-8 border-t-[2.5px] border-violet-500 inline-block"></span>
          Edge width = impact %
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-8 border-t-[2px] border-dashed border-green-800 inline-block"></span>
          Resource cost  →O (dashed)
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-green-700 inline-block shrink-0"></span>
          <span class="ml-1">V/C ≥ 5</span>
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-amber-600 inline-block shrink-0"></span>
          <span class="ml-1">V/C 2–5</span>
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-red-600 inline-block shrink-0"></span>
          <span class="ml-1">V/C &lt; 2</span>
        </span>
        <span class="text-gray-400 italic">Top {{ TOP_N }} value connections per solution</span>
      </div>
    </template>
  </div>
</template>
