<!-- UNIT_TYPE=Widget -->
<!-- CollaborationCursors — Fixed overlay showing remote user cursor positions -->
<!-- Feature #16: Real-Time Collaboration Cursors -->
<!-- Fixed overlay, pointer-events: none, z-index: 100 -->
<!-- Only renders cursors where Date.now() - lastSeen < 5000 ms -->

<script setup lang="ts">
import { computed } from 'vue'
import type { RemoteCursor } from '../composables/useCollaborationCursors'

const props = defineProps<{
  cursors: RemoteCursor[]
}>()

/** Filter stale cursors — only show those seen within the last 5 s */
const activeCursors = computed(() =>
  props.cursors.filter((c) => Date.now() - c.lastSeen < 5000),
)
</script>

<template>
  <!-- Fixed overlay covering the full viewport; pointer-events disabled so it never
       blocks clicks on the underlying UI. z-100 keeps cursors above all content. -->
  <div
    class="fixed inset-0 z-[100] pointer-events-none overflow-hidden"
    aria-hidden="true"
  >
    <div
      v-for="cursor in activeCursors"
      :key="cursor.userId"
      class="absolute"
      :style="{
        left: `${cursor.xPct}%`,
        top: `${cursor.yPct}%`,
        transition: 'left 50ms linear, top 50ms linear',
      }"
    >
      <!-- Pointer icon — SVG arrow styled with the cursor's colour -->
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        :style="{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }"
        aria-hidden="true"
      >
        <!-- Arrow pointer shape -->
        <path
          d="M3 2L3 15L7.5 11.5L10 17L12 16L9.5 10.5L14.5 10L3 2Z"
          :fill="cursor.color"
          stroke="white"
          stroke-width="1"
        />
      </svg>

      <!-- Display name pill badge below pointer -->
      <span
        class="mt-1 block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm"
        :style="{ backgroundColor: cursor.color }"
      >
        {{ cursor.displayName }}
      </span>
    </div>
  </div>
</template>
