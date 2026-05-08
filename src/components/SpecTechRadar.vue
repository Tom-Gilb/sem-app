<!-- UNIT_TYPE=Widget -->
<!-- Feature #134 — Spec Tech Radar Visualiser -->
<template>
  <div class="space-y-3">
    <!-- SVG Radar -->
    <svg
      viewBox="0 0 440 440"
      width="440"
      height="440"
      aria-label="Tech Radar diagram"
      class="mx-auto block"
    >
      <!-- Concentric ring circles -->
      <!-- Hold ring (outermost) -->
      <circle
        cx="220" cy="220" r="190"
        fill="none"
        stroke="#f87171"
        stroke-width="1.5"
        opacity="0.4"
      />
      <!-- Assess ring -->
      <circle
        cx="220" cy="220" r="145"
        fill="none"
        stroke="#f59e0b"
        stroke-width="1.5"
        opacity="0.4"
      />
      <!-- Trial ring -->
      <circle
        cx="220" cy="220" r="100"
        fill="none"
        stroke="#3b82f6"
        stroke-width="1.5"
        opacity="0.4"
      />
      <!-- Adopt ring (innermost) -->
      <circle
        cx="220" cy="220" r="55"
        fill="none"
        stroke="#10b981"
        stroke-width="1.5"
        opacity="0.4"
      />

      <!-- Ring labels -->
      <text x="220" :y="220 - 55 - 5" text-anchor="middle" font-size="10" font-style="italic" fill="#10b981" opacity="0.8">Adopt</text>
      <text x="220" :y="220 - 100 - 5" text-anchor="middle" font-size="10" font-style="italic" fill="#3b82f6" opacity="0.8">Trial</text>
      <text x="220" :y="220 - 145 - 5" text-anchor="middle" font-size="10" font-style="italic" fill="#f59e0b" opacity="0.8">Assess</text>
      <text x="220" :y="220 - 190 - 5" text-anchor="middle" font-size="10" font-style="italic" fill="#f87171" opacity="0.8">Hold</text>

      <!-- Entry dots and labels -->
      <g v-for="entry in entries" :key="entry.id">
        <!-- Dot -->
        <circle
          :cx="entry.x"
          :cy="entry.y"
          r="6"
          :fill="ringColour(entry.ring)"
        />
        <!-- Label above dot -->
        <text
          :x="entry.x"
          :y="entry.y - 10"
          text-anchor="middle"
          font-size="8"
          :fill="ringColour(entry.ring)"
        >{{ entry.label }}</text>
      </g>

      <!-- Empty state message -->
      <text
        v-if="entries.length === 0"
        x="220" y="220"
        text-anchor="middle"
        font-size="12"
        fill="#94a3b8"
      >No S. entries in spec</text>
    </svg>

    <!-- Legend -->
    <div class="flex flex-wrap justify-center gap-4 mt-2">
      <div
        v-for="ring in rings"
        :key="ring"
        class="flex items-center gap-1.5 text-xs text-slate-700"
      >
        <span
          class="inline-block w-3 h-3 rounded-full"
          :style="{ backgroundColor: ringColour(ring) }"
          aria-hidden="true"
        />
        <span>{{ ring }}</span>
        <span class="font-semibold">({{ ringCounts[ring] }})</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTechRadar, RING_COLOURS } from '../composables/useTechRadar'
import type { RadarRing } from '../composables/useTechRadar'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  blocks: SpecBlock[]
}>()

const rings: RadarRing[] = ['Adopt', 'Trial', 'Assess', 'Hold']

const { entries, ringCounts } = useTechRadar(props.blocks)

function ringColour(ring: RadarRing): string {
  return RING_COLOURS[ring]
}

// Ring count summary for parent to display (also available via ringCounts)
const ringSummary = computed(() =>
  rings.map(r => `${r}: ${ringCounts.value[r]}`).join(' · ')
)

defineExpose({ ringSummary })
</script>
