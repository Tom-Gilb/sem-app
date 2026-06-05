<!-- UNIT_TYPE=Widget -->
<!-- Feature #80 — V. entry dependency graph — pure SVG, no external lib -->
<script setup lang="ts">
import type { DepGraph } from '../composables/useDepGraph'

const props = defineProps<{
  graph: DepGraph
  selectedId: string | null
}>()

const emit = defineEmits<{
  selectNode: [id: string | null]
}>()

const VIEW_W = 500
const VIEW_H = 320

// Convert 0–100% position to SVG coords
function toSvgX(pct: number): number {
  return (pct / 100) * (VIEW_W - 60) + 30
}
function toSvgY(pct: number): number {
  return (pct / 100) * (VIEW_H - 60) + 30
}

// Bezier control points for curved edges
function edgePath(fromId: string, toId: string): string {
  const from = props.graph.nodes.find(n => n.id === fromId)
  const to = props.graph.nodes.find(n => n.id === toId)
  if (!from || !to) return ''
  const x1 = toSvgX(from.x)
  const y1 = toSvgY(from.y)
  const x2 = toSvgX(to.x)
  const y2 = toSvgY(to.y)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2 - 20
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

function isSelectedEdge(edge: { from: string; to: string }): boolean {
  return props.selectedId === edge.from || props.selectedId === edge.to
}

function nodeStrokeColor(id: string): string {
  return props.selectedId === id ? '#4f46e5' : '#a5b4fc' // indigo-600 vs indigo-300
}

function nodeFillColor(id: string): string {
  return props.selectedId === id ? '#e0e7ff' : '#ffffff' // indigo-100 vs white
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
    class="w-full border rounded bg-slate-50"
    aria-label="Value Spec dependency graph"
    role="img"
  >
    <!-- Edges (drawn first, behind nodes) -->
    <g aria-hidden="true">
      <path
        v-for="(edge, i) in graph.edges"
        :key="`edge-${i}`"
        :d="edgePath(edge.from, edge.to)"
        fill="none"
        :stroke="isSelectedEdge(edge) ? '#fbbf24' : '#cbd5e1'"
        :stroke-width="isSelectedEdge(edge) ? 2 : 1"
        stroke-linecap="round"
      />
    </g>

    <!-- Nodes -->
    <g
      v-for="node in graph.nodes"
      :key="node.id"
      :transform="`translate(${toSvgX(node.x)}, ${toSvgY(node.y)})`"
      style="cursor: pointer"
      :aria-label="`Node ${node.id}`"
      @click="emit('selectNode', node.id === selectedId ? null : node.id)"
    >
      <!-- Circle -->
      <circle
        r="22"
        :fill="nodeFillColor(node.id)"
        :stroke="nodeStrokeColor(node.id)"
        stroke-width="1.5"
      />
      <!-- ID label inside circle (tiny) -->
      <text
        text-anchor="middle"
        dominant-baseline="central"
        font-size="7"
        font-family="monospace"
        fill="#312e81"
        class="select-none"
      >
        {{ node.id.slice(0, 10) }}
      </text>
      <!-- Scale label below circle -->
      <text
        text-anchor="middle"
        y="30"
        font-size="8"
        font-family="sans-serif"
        fill="#475569"
        class="select-none"
      >
        {{ node.label.slice(0, 22) }}
      </text>
    </g>

    <!-- Empty state -->
    <text
      v-if="graph.nodes.length === 0"
      x="250"
      y="160"
      text-anchor="middle"
      font-size="13"
      fill="#94a3b8"
    >
      No V. entries to display
    </text>
  </svg>
</template>
