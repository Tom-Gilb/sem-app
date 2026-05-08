<!-- UNIT_TYPE=Widget -->
<!-- Feature #123 — Spec Value Stream Map -->
<!-- Hand-rolled SVG value stream: Functions → Values → Solutions with bottleneck detection -->
<template>
  <div class="w-full overflow-x-auto">
    <!-- SVG diagram -->
    <svg
      viewBox="0 0 620 380"
      width="620"
      height="380"
      aria-label="Value stream map"
      class="block"
    >
      <!-- Defs: arrowhead marker -->
      <defs>
        <marker
          id="vsm-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
      </defs>

      <!-- Row swimlane labels -->
      <!-- Functions row label -->
      <text
        x="10"
        y="55"
        font-size="12"
        font-style="italic"
        fill="#475569"
        aria-hidden="true"
      >🔧 Functions</text>
      <!-- Values row label -->
      <text
        x="10"
        y="175"
        font-size="12"
        font-style="italic"
        fill="#475569"
        aria-hidden="true"
      >📊 Values</text>
      <!-- Solutions row label -->
      <text
        x="10"
        y="295"
        font-size="12"
        font-style="italic"
        fill="#475569"
        aria-hidden="true"
      >🔩 Solutions</text>

      <!-- Horizontal swimlane dividers -->
      <line x1="0" y1="110" x2="620" y2="110" stroke="#e2e8f0" stroke-width="1" />
      <line x1="0" y1="240" x2="620" y2="240" stroke="#e2e8f0" stroke-width="1" />

      <!-- Edges -->
      <g aria-hidden="true">
        <line
          v-for="(edge, i) in edges"
          :key="`edge-${i}`"
          :x1="nodeById(edge.from)?.x ?? 0"
          :y1="edgeY1(edge.from)"
          :x2="nodeById(edge.to)?.x ?? 0"
          :y2="edgeY2(edge.to)"
          stroke="#94a3b8"
          stroke-width="1.5"
          marker-end="url(#vsm-arrow)"
        />
      </g>

      <!-- Nodes -->
      <g v-for="node in nodes" :key="node.id">
        <rect
          :x="node.x - 45"
          :y="node.y - 18"
          width="90"
          height="36"
          rx="6"
          ry="6"
          :fill="nodeFill(node.type)"
          :stroke="node.isBottleneck ? '#dc2626' : 'none'"
          :stroke-width="node.isBottleneck ? 2 : 0"
        />
        <text
          :x="node.x"
          :y="node.y + 5"
          text-anchor="middle"
          font-size="10"
          fill="white"
          font-weight="600"
        >{{ node.label }}</text>
      </g>
    </svg>

    <!-- Bottleneck callout -->
    <p
      v-if="bottleneckCount > 0"
      class="mt-2 text-sm font-medium text-amber-700"
      role="alert"
    >
      ⚠️ {{ bottleneckCount }} bottleneck node(s) detected
    </p>

    <!-- Legend -->
    <div class="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-4 h-3 rounded" style="background:#3b82f6" aria-hidden="true" />
        Functions
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-4 h-3 rounded" style="background:#059669" aria-hidden="true" />
        Values
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-4 h-3 rounded" style="background:#a855f7" aria-hidden="true" />
        Solutions
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-4 h-3 rounded border-2 border-red-600" style="background:#a855f7" aria-hidden="true" />
        Bottleneck
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useValueStream } from '../composables/useValueStream'
import type { StreamNode } from '../composables/useValueStream'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  blocks: SpecBlock[]
}>()

const { nodes, edges, bottleneckCount } = useValueStream(computed(() => props.blocks).value)

const nodeMap = computed(() => {
  const m = new Map<string, StreamNode>()
  for (const n of nodes.value) m.set(n.id, n)
  return m
})

function nodeById(id: string): StreamNode | undefined {
  return nodeMap.value.get(id)
}

function edgeY1(fromId: string): number {
  const n = nodeById(fromId)
  if (!n) return 0
  // bottom of the node rectangle
  return n.y + 18
}

function edgeY2(toId: string): number {
  const n = nodeById(toId)
  if (!n) return 0
  // top of the node rectangle
  return n.y - 18
}

function nodeFill(type: StreamNode['type']): string {
  if (type === 'function') return '#3b82f6'   // blue-500
  if (type === 'value') return '#059669'       // emerald-600
  return '#a855f7'                             // purple-500
}
</script>
