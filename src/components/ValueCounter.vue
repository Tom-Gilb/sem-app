<!--
  ValueCounter.vue — 11-stage Planguage planning workflow bar.
  Rebuilt 2026-05-27 from design log r04–r37 + Planguage Spec Type Glyphs PDF v7.

  11 stages (left to right), each a 96×96px dark pill with:
    - Stage number badge (top-left, black/60 bg)
    - Official Planguage type glyph (PlTypeIcon) with neon stage-color glow
    - Stage label below
  Connected by 10 concave swept-back arrows, each:
    - Stroke width 3→9px (increasing momentum)
    - Color from the indigo→emerald sweep at the arrow's position
    - Clickable to open ArrowInfoPanel

  Stage definitions:
    1. Stakes    (stakeholder ←¶→)
    2. Solutions (solution [*]→)
    3. Sharpen   (function →O→)
    4. Impacts   (value O--*-->)
    5. Refine    (constraint [→O→])
    6. Evo Steps (evo-step < ->+->)
    7. Evo Impact(value O--*-->)
    8. Tasks     (task →O→*)
    9. Study-Act (evo-step < ->+->)
   10. Plan      (resource →O)
   11. Export    (constraint [→O→])

  Architecture principles (Architectural Resilience Rule, 2026-05-27):
    - Stages defined as data (STAGES const), not hardcoded in template
    - All colour math centralised in stageProgressColors.ts
    - PlTypeIcon is pure render — no click handling inside it
    - Arrow clicks handled by ValueCounter, not by icon components
    - Never locked: DD-007 — stages are cyclic workspace views, not sequential gates
    - ScrollContainer wraps the overflow — no raw overflow-x-auto here

  Spec: F.ValueAccumulationCounter (#15).
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed } from 'vue'
import PlTypeIcon from './icons/PlTypeIcon.vue'
import type { PlGlyphType } from './icons/PlTypeIcon.vue'
import ArrowInfoPanel from './ArrowInfoPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  pillProgressColor,
  stageProgressColor,
  arrowProgressColors,
  arrowShaftWidth,
} from '../utils/stageProgressColors'
import { useArrowInfoPanel } from '../composables/useArrowInfoPanel'

// ── Props / emits ──────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Active planning stage (1–11). Parent owns this value. */
  currentStage?: number
}>(), {
  currentStage: 1,
})

const emit = defineEmits<{
  /** User clicked a stage pill — parent should navigate to this stage. */
  'go-to-stage': [stage: number]
}>()

// ── Stage definitions ──────────────────────────────────────────────────────────

const STAGES: Array<{
  stage: number
  label: string
  plType: PlGlyphType
}> = [
  { stage: 1,  label: 'Stakes',     plType: 'stakeholder' },
  { stage: 2,  label: 'Solutions',  plType: 'solution'    },
  { stage: 3,  label: 'Sharpen',    plType: 'function'    },
  { stage: 4,  label: 'Impacts',    plType: 'value'       },
  { stage: 5,  label: 'Refine',     plType: 'constraint'  },
  { stage: 6,  label: 'Evo Steps',  plType: 'evo-step'    },
  { stage: 7,  label: 'Evo Impact', plType: 'value'       },
  { stage: 8,  label: 'Tasks',      plType: 'task'        },
  { stage: 9,  label: 'Study-Act',  plType: 'evo-step'    },
  { stage: 10, label: 'Plan',       plType: 'resource'    },
  { stage: 11, label: 'Export',     plType: 'constraint'  },
]

// ── Stage state helpers ────────────────────────────────────────────────────────

function stageStatus(s: number): 'done' | 'current' | 'future' {
  if (props.currentStage > s) return 'done'
  if (props.currentStage === s) return 'current'
  return 'future'
}

/** Position index (0–10) for colour math. */
function pos(s: number): number {
  return s - 1
}

function pillStyle(s: number): Record<string, string> {
  const state = stageStatus(s)
  return {
    background: pillProgressColor(pos(s), state),
    opacity:    state === 'future' ? '0.65' : '1',
  }
}

function glowStyle(s: number): Record<string, string> {
  const col = stageProgressColor(pos(s))
  return { filter: `drop-shadow(0 0 9px ${col})` }
}

function badgeClass(s: number): string {
  const state = stageStatus(s)
  if (state === 'done')    return 'text-emerald-300'
  if (state === 'current') return 'text-indigo-200'
  return 'text-slate-300'
}

function labelClass(s: number): string {
  const state = stageStatus(s)
  if (state === 'done')    return 'text-emerald-300'
  if (state === 'current') return 'text-white'
  return 'text-slate-400'
}

// ── Navigation ─────────────────────────────────────────────────────────────────

function navigateToStage(stage: number): void {
  emit('go-to-stage', stage)
}

// ── Arrow info panel ───────────────────────────────────────────────────────────

const { openArrowIdx, openArrow, closeArrow } = useArrowInfoPanel()

// Arrow colors computed for each of the 10 connectors
const arrowData = computed(() =>
  Array.from({ length: 10 }, (_, idx) => {
    const { from, to } = arrowProgressColors(idx)
    const w = arrowShaftWidth(idx)
    return { idx, from, to, w }
  })
)

function arrowStyle(idx: number): Record<string, string> {
  const { from } = arrowProgressColors(idx)
  const state = stageStatus(idx + 1)  // arrow between stage idx+1 and idx+2
  return {
    filter: `drop-shadow(0 0 4px ${from})`,
    opacity: state === 'future' ? '0.88' : '1',
  }
}
</script>

<template>
  <!-- Full-width dark strip — parent handles breakout wrapper for px constraints. -->
  <nav
    class="w-full bg-[#0f172a] py-3"
    aria-label="Planning stages"
    role="navigation"
  >
    <ScrollContainer
      outer-class="relative w-full"
      inner-class="flex items-end gap-2 px-6 pb-1 min-w-max mx-auto"
      :no-pill="true"
    >
      <template v-for="(step, idx) in STAGES" :key="step.stage">

        <!-- ── Stage pill ───────────────────────────────────────────── -->
        <button
          type="button"
          class="relative flex flex-col items-center gap-1.5 shrink-0 focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl
                 transition-all duration-300 hover:scale-105 active:scale-95"
          :style="{ ...pillStyle(step.stage), width: '96px', height: '96px', borderRadius: '16px' }"
          :aria-label="`Navigate to stage ${step.stage}: ${step.label} (${stageStatus(step.stage)})`"
          :aria-current="step.stage === currentStage ? 'step' : undefined"
          @click="navigateToStage(step.stage)"
        >
          <!-- Number badge (top-left) -->
          <span
            class="absolute top-1.5 left-2 text-[13px] font-extrabold leading-none
                   bg-black/60 rounded-md px-1 py-0.5 z-10"
            :class="badgeClass(step.stage)"
            aria-hidden="true"
          >{{ step.stage }}</span>

          <!-- Planguage type glyph — translated right+down per design log r18 -->
          <div
            class="flex items-center justify-center translate-x-1 translate-y-2"
            :style="glowStyle(step.stage)"
            aria-hidden="true"
          >
            <PlTypeIcon :pl-type="step.plType" size="xl" />
          </div>

          <!-- Stage label -->
          <span
            class="absolute bottom-1.5 left-0 right-0 text-center text-[10px]
                   font-bold leading-tight tracking-wide whitespace-normal px-1"
            :class="labelClass(step.stage)"
          >{{ step.label }}</span>
        </button>

        <!-- ── Arrow connector ──────────────────────────────────────── -->
        <button
          v-if="idx < STAGES.length - 1"
          type="button"
          class="shrink-0 flex items-center justify-center
                 hover:scale-110 active:scale-95 transition-transform
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded
                 group"
          style="width:40px; height:44px;"
          :aria-label="`${step.label} to ${STAGES[idx + 1].label} transition — click for details`"
          @click="openArrow(idx)"
        >
          <svg
            viewBox="0 0 40 44"
            width="40"
            height="44"
            fill="none"
            :style="arrowStyle(idx)"
            aria-hidden="true"
          >
            <!-- Shaft -->
            <line
              x1="2" y1="22" x2="24" y2="22"
              :stroke="arrowData[idx].from"
              :stroke-width="arrowData[idx].w"
              stroke-linecap="round"
            />
            <!-- Concave swept-back arrowhead -->
            <path
              d="M 18,4 L 38,22 L 18,40 Q 28,22 18,4 Z"
              :fill="arrowData[idx].to"
            />
          </svg>
          <!-- Hover tooltip -->
          <span
            class="absolute pointer-events-none -top-7 left-1/2 -translate-x-1/2
                   bg-white/90 text-gray-800 text-[10px] font-medium
                   rounded px-1.5 py-0.5 shadow whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >✦ Arrow Info</span>
        </button>

      </template>
    </ScrollContainer>
  </nav>

  <!-- Arrow info panel (Teleported to body) -->
  <ArrowInfoPanel
    :arrow-idx="openArrowIdx"
    @close="closeArrow()"
    @open-glyph="(_type) => { /* future: open glyph detail panel */ }"
  />
</template>
