<!-- UNIT_TYPE=Widget -->
<!-- Feature #115 — Spec as TOGAF Architecture View -->
<!-- Pure SVG swimlane diagram: Business / Application / Data / Technology -->
<template>
  <div>
    <!-- SVG Diagram -->
    <svg
      viewBox="0 0 640 360"
      width="640"
      height="360"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="TOGAF Architecture View"
      role="img"
    >
      <template v-for="(layer, li) in layers" :key="layer.name">
        <!-- Lane bounding rect -->
        <rect
          x="0"
          :y="li * 90"
          width="640"
          height="90"
          :fill="laneFill(layer.name)"
          :stroke="highlightedLayer === layer.name ? '#f59e0b' : 'transparent'"
          :stroke-width="highlightedLayer === layer.name ? 2 : 0"
          :opacity="highlightedLayer && highlightedLayer !== layer.name ? 0.4 : 1"
        />

        <!-- Lane label column (120px) -->
        <rect
          x="0"
          :y="li * 90"
          width="120"
          height="90"
          :fill="labelFill(layer.name)"
          style="cursor: pointer"
          @click="setHighlight(layer.name)"
        />
        <text
          x="60"
          :y="li * 90 + 45"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="13"
          font-weight="600"
          :fill="labelTextFill(layer.name)"
          style="cursor: pointer; user-select: none"
          @click="setHighlight(layer.name)"
        >{{ layer.name }}</text>

        <!-- Entry cards — show max 3 when overflow, to leave the 4th slot for the badge -->
        <template
          v-for="(entry, ei) in layer.entries.slice(0, layer.entries.length > 4 ? 3 : 4)"
          :key="entry.id"
        >
          <rect
            :x="130 + ei * 124"
            :y="li * 90 + 14"
            width="110"
            height="44"
            rx="6"
            :fill="entryFill(entry)"
            opacity="0.9"
          />
          <text
            :x="130 + ei * 124 + 55"
            :y="li * 90 + 14 + 22"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="10"
            fill="white"
            font-weight="500"
          >{{ truncate(entry.id, 14) }}</text>
        </template>

        <!-- Overflow badge — occupies the 4th card slot, never overlaps cards -->
        <template v-if="layer.entries.length > 4">
          <rect
            :x="130 + 3 * 124"
            :y="li * 90 + 14"
            width="110"
            height="44"
            rx="6"
            fill="#f1f5f9"
            stroke="#cbd5e1"
            stroke-width="1"
          />
          <text
            :x="130 + 3 * 124 + 55"
            :y="li * 90 + 14 + 22"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="11"
            fill="#64748b"
            font-weight="600"
          >+{{ layer.entries.length - 3 }} more</text>
        </template>
      </template>
    </svg>

    <!-- Legend chips -->
    <div class="flex flex-wrap gap-3 mt-3">
      <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-blue-500 text-white">F. Function</span>
      <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-600 text-white">V. Value</span>
      <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-purple-500 text-white">S. Solution</span>
      <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-amber-400 text-white">Highlighted</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'
import { useTogafView } from '../composables/useTogafView'

const props = defineProps<{
  blocks: SpecBlock[]
}>()

const { layers, highlightedLayer, setHighlight } = useTogafView(props.blocks)

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function entryFill(entry: FEntry | VEntry | SEntry): string {
  if (entry.type === 'Function') return '#3b82f6' // blue-500
  if (entry.type === 'Value') return '#059669'     // emerald-600
  return '#8b5cf6'                                  // purple-500
}

function laneFill(name: string): string {
  switch (name) {
    case 'Business': return '#eff6ff'     // blue-50
    case 'Application': return '#f0fdf4'  // green-50
    case 'Data': return '#fefce8'         // yellow-50
    case 'Technology': return '#faf5ff'   // purple-50
    default: return '#f8fafc'
  }
}

function labelFill(name: string): string {
  switch (name) {
    case 'Business': return '#dbeafe'     // blue-100
    case 'Application': return '#dcfce7'  // green-100
    case 'Data': return '#fef9c3'         // yellow-100
    case 'Technology': return '#f3e8ff'   // purple-100
    default: return '#f1f5f9'
  }
}

function labelTextFill(name: string): string {
  switch (name) {
    case 'Business': return '#1e40af'     // blue-800
    case 'Application': return '#166534'  // green-800
    case 'Data': return '#854d0e'         // yellow-800
    case 'Technology': return '#6b21a8'   // purple-800
    default: return '#334155'
  }
}
</script>
