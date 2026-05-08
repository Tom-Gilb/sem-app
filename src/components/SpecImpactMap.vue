<script setup lang="ts">
// Feature #109 — Impact Map mind-map component
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'
import { useImpactMap } from '../composables/useImpactMap'

const props = defineProps<{
  blocks: SpecBlock[]
}>()

const { nodes, edges, highlighted, highlightSubtree, clearHighlight } = useImpactMap(props.blocks)

const nodeMap = computed(() => {
  const m: Record<string, { x: number; y: number }> = {}
  nodes.value.forEach(n => { m[n.id] = { x: n.x, y: n.y } })
  return m
})

function getBezierPath(fromId: string, toId: string): string {
  const from = nodeMap.value[fromId]
  const to = nodeMap.value[toId]
  if (!from || !to) return ''
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`
}

function nodeColour(type: 'domain' | 'function' | 'value'): string {
  if (type === 'domain') return '#4f46e5'     // indigo-600
  if (type === 'function') return '#3b82f6'   // blue-500
  return '#10b981'                             // emerald-500
}

function nodeRadius(type: 'domain' | 'function' | 'value'): number {
  if (type === 'domain') return 28
  if (type === 'function') return 22
  return 18
}

function handleNodeClick(nodeId: string): void {
  if (highlighted.value === nodeId) {
    clearHighlight()
  } else {
    highlightSubtree(nodeId)
  }
}

function nodeOpacity(isHighlighted: boolean): number {
  return highlighted.value === '' || isHighlighted ? 1 : 0.35
}
</script>

<template>
  <div class="space-y-3">
    <!-- SVG mind-map -->
    <div class="overflow-x-auto">
      <svg
        viewBox="0 0 620 420"
        width="620"
        height="420"
        role="img"
        aria-label="Impact map mind-map"
        class="rounded-lg border border-slate-200 bg-slate-50"
      >
        <!-- Edges first (behind nodes) -->
        <g aria-hidden="true">
          <path
            v-for="(edge, i) in edges"
            :key="`edge-${i}`"
            :d="getBezierPath(edge.from, edge.to)"
            fill="none"
            stroke="#cbd5e1"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </g>

        <!-- Nodes -->
        <g
          v-for="node in nodes"
          :key="node.id"
          :aria-label="`${node.type}: ${node.label}`"
          style="cursor: pointer"
          @click="handleNodeClick(node.id)"
        >
          <!-- Highlight ring -->
          <circle
            v-if="node.highlighted && highlighted !== ''"
            :cx="node.x"
            :cy="node.y"
            :r="nodeRadius(node.type) + 5"
            fill="none"
            :stroke="nodeColour(node.type)"
            stroke-width="2.5"
            stroke-dasharray="4 2"
            :opacity="nodeOpacity(node.highlighted)"
          />

          <!-- Node circle -->
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="nodeRadius(node.type)"
            :fill="nodeColour(node.type)"
            :opacity="nodeOpacity(node.highlighted)"
          />

          <!-- Node label -->
          <text
            :x="node.x"
            :y="node.y + nodeRadius(node.type) + 14"
            text-anchor="middle"
            font-size="10"
            fill="#334155"
            :opacity="nodeOpacity(node.highlighted)"
          >{{ node.label }}</text>

          <!-- Domain label inside circle -->
          <text
            v-if="node.type === 'domain'"
            :x="node.x"
            :y="node.y + 4"
            text-anchor="middle"
            font-size="10"
            fill="white"
            font-weight="600"
            :opacity="nodeOpacity(node.highlighted)"
          >Core</text>
        </g>
      </svg>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 text-xs text-slate-600">
      <span class="font-medium text-slate-500">Legend:</span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-full bg-indigo-600" />
        Domain
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-full bg-blue-500" />
        Function
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-full bg-emerald-500" />
        Value
      </span>
      <span class="text-slate-400 italic">Click a node to highlight its subtree</span>
    </div>
  </div>
</template>
