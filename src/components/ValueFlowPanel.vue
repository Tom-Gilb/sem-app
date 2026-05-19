<!--
  ValueFlowPanel.vue — full-screen modal shell for the 6-column causal Value Flow diagram.

  Tom Gilb 2026-05-15: "Value Flow: Thinner allows. The Flow is from Tasks,
  to Evo steps, to Solutions to the Value, to the Function, to the Stakeholders."

  Tom Gilb 2026-05-18: "drop the small screen. Only full screen, and enlarge the
  diagram to fit the screen."
  → Modal now fills the entire viewport (fixed inset-0). No centering wrapper,
    no padding, no rounded corners, no resize handle. The body passes
    fit-container=true to ValueFlowDiagram so the SVG scales proportionally to
    fill the available space after the header and headline banner.

  The diagram content lives in ValueFlowDiagram.vue (shared with VisualisePanelModal).
  This component wraps it in a Teleport + backdrop + full-screen card.

  Universal rules honoured:
    • CloseDot at END of header on dark gradient
    • overflow-hidden body (SVG fits — no scroll needed in full-screen mode)
    • Backdrop + Teleport-to-body for the modal pattern
    • Registered as an exclusive surface from App.vue (z-[486/487])
-->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'
import CloseDot from './CloseDot.vue'
import ValueFlowDiagram from './ValueFlowDiagram.vue'

const props = defineProps<{
  spec:          SpecBlock
  evoSteps:      EvoStep[]
  tasksByStep:   Record<string, TaskSuggestion[]>
  /** Forwarded to ValueFlowDiagram — used for Solution→Value edge derivation. */
  impactMatrix?: ImpactMatrix
}>()

const emit = defineEmits<{
  close: []
  /** Propagated from ValueFlowDiagram — open spec editor for this entry. */
  'open-editor': [{ tab: 'functions' | 'values' | 'solutions'; entryId: string }]
  /** Propagated from ValueFlowDiagram — open Spec Direct Relations for this entry. */
  'node-relations-click': [{ tab: 'functions' | 'values' | 'solutions' | 'evo-steps'; entryId: string }]
  /** Propagated from ValueFlowDiagram — user clicked a Task node; navigate to Task Decomposition. */
  'go-to-tasks': []
}>()

// ── Esc key support ───────────────────────────────────────────────────────────
// The modal card is a <div role="dialog">, not a native <dialog> — browsers do
// not fire Esc automatically. A document-level listener is the most reliable
// cross-browser approach (tabindex+focus works but adds a visible focus ring on
// the full-screen card which is visually noisy).
const _onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); emit('close') } }
onMounted  (() => document.addEventListener('keydown', _onKey, { capture: true }))
onUnmounted(() => document.removeEventListener('keydown', _onKey, { capture: true }))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[486] bg-black/40"
      aria-hidden="true"
      @click="$emit('close')"
    />

    <!--
      Full-screen card — fills the entire viewport.
      No centering wrapper, no padding, no rounded corners, no resize handle.
      Tom 2026-05-18: "Only full screen, and enlarge the diagram to fit the screen."
    -->
    <div
      class="fixed inset-0 z-[487] flex flex-col bg-white pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Value Flow diagram"
    >
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div
        class="flex items-center gap-3 px-5 py-3.5 shrink-0
               bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white"
      >
        <span
          class="text-[15px] font-mono text-indigo-300 select-none shrink-0"
          aria-hidden="true"
        >⟶</span>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-semibold leading-tight truncate">Value Flow</p>
          <!-- Primary value shown here in full-screen since the pulsing headline
               box is hidden in fitContainer mode to give SVG the full vertical space. -->
          <p
            v-if="props.spec.values[0]?.description"
            class="text-[11px] text-red-300 font-semibold leading-tight truncate"
            :title="props.spec.values[0].description"
          >
            ★ {{ props.spec.values[0].description }}
          </p>
          <p v-else class="text-[10px] text-white/55 leading-tight truncate">
            Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders
          </p>
        </div>
        <CloseDot
          variant="on-dark"
          aria-label="Close Value Flow"
          @click="$emit('close')"
        />
      </div>

      <!--
        Body — fills all remaining height after the header.
        overflow-hidden: the SVG scales to fit (fitContainer=true), no scrollbars.
        p-4: breathing room around the diagram on all sides.
      -->
      <div class="flex-1 min-h-0 bg-slate-50 overflow-hidden p-4">
        <ValueFlowDiagram
          :spec="props.spec"
          :evo-steps="props.evoSteps"
          :tasks-by-step="props.tasksByStep"
          :impact-matrix="props.impactMatrix"
          :fit-container="true"
          @node-click="emit('open-editor', $event)"
          @node-relations-click="emit('node-relations-click', $event)"
          @go-to-tasks="emit('go-to-tasks')"
        />
      </div>
    </div>
  </Teleport>
</template>
