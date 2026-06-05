<!-- UNIT_TYPE=Widget -->
<!-- Feature #96 — Spec as User Story Map SVG component -->
<template>
  <svg
    viewBox="0 0 600 320"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full"
    role="img"
    aria-label="Spec user story map"
  >
    <!-- Lane rows -->
    <template v-for="(lane, laneIndex) in lanes" :key="lane.stakeholder">
      <!-- Lane background (highlighted when selected) -->
      <rect
        x="0"
        :y="laneIndex * laneHeight"
        width="600"
        :height="laneHeight"
        :fill="lane.stakeholder === selectedLane ? '#eef2ff' : 'transparent'"
      />

      <!-- Horizontal separator line below each lane -->
      <line
        x1="0"
        :y1="(laneIndex + 1) * laneHeight"
        x2="600"
        :y2="(laneIndex + 1) * laneHeight"
        stroke="#e2e8f0"
        stroke-width="1"
      />

      <!-- Lane label (left column, x 0–100) -->
      <!-- Clickable label to select/deselect lane -->
      <g
        class="cursor-pointer"
        role="button"
        :aria-label="`Select lane ${lane.stakeholder}`"
        :aria-pressed="lane.stakeholder === selectedLane"
        @click="$emit('select-lane', lane.stakeholder === selectedLane ? null : lane.stakeholder)"
      >
        <rect
          x="0"
          :y="laneIndex * laneHeight"
          width="100"
          :height="laneHeight"
          fill="transparent"
        />
        <!-- Truncated stakeholder label, centered vertically in lane -->
        <text
          x="50"
          :y="laneIndex * laneHeight + laneHeight / 2"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="11"
          font-weight="600"
          :fill="lane.stakeholder === selectedLane ? '#4f46e5' : '#475569'"
        >{{ lane.stakeholder.slice(0, 10) }}</text>
      </g>

      <!-- Vertical divider between label col and card area -->
      <line
        x1="100"
        :y1="laneIndex * laneHeight"
        x2="100"
        :y2="(laneIndex + 1) * laneHeight"
        stroke="#cbd5e1"
        stroke-width="1"
      />

      <!-- Entry cards (x 100–600, column-based on order position) -->
      <template v-for="(entry, entryIndex) in lane.entries" :key="entry.id">
        <g v-if="entryIndex < maxCardsPerLane">
          <!-- Card rect -->
          <rect
            :x="cardX(entryIndex)"
            :y="laneIndex * laneHeight + cardYOffset"
            :width="cardWidth"
            :height="cardHeight"
            rx="4"
            :fill="lane.stakeholder === selectedLane ? '#e0e7ff' : 'white'"
            stroke="#c7d2fe"
            stroke-width="1"
          />
          <!-- Entry ID (first line, monospace) -->
          <text
            :x="cardX(entryIndex) + cardWidth / 2"
            :y="laneIndex * laneHeight + cardYOffset + 14"
            text-anchor="middle"
            font-size="9"
            font-family="monospace"
            fill="#312e81"
          >{{ entry.id.slice(0, 12) }}</text>
          <!-- Description snippet (second line) -->
          <text
            :x="cardX(entryIndex) + cardWidth / 2"
            :y="laneIndex * laneHeight + cardYOffset + 27"
            text-anchor="middle"
            font-size="8"
            fill="#64748b"
          >{{ (entry.description || '').slice(0, 20) }}</text>
        </g>
      </template>
    </template>

    <!-- Empty state -->
    <text
      v-if="lanes.length === 0"
      x="300"
      y="160"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="13"
      fill="#94a3b8"
    >No Function Specs found</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StoryMapLane } from '../composables/useStoryMap'

const props = defineProps<{
  lanes: StoryMapLane[]
  selectedLane: string | null
}>()

defineEmits<{
  (e: 'select-lane', value: string | null): void
}>()

// Layout constants
const laneHeight = computed(() => {
  if (props.lanes.length === 0) return 320
  return Math.max(60, Math.floor(320 / props.lanes.length))
})
const cardWidth = 80
const cardHeight = 40
const cardYOffset = computed(() => Math.max(10, (laneHeight.value - cardHeight) / 2))
const maxCardsPerLane = 6 // (600-100) / (80+4) ≈ 5.9

function cardX(entryIndex: number): number {
  const gap = 4
  return 104 + entryIndex * (cardWidth + gap)
}
</script>
