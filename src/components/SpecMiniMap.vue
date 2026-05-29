<!--
  SpecMiniMap.vue — miniature real-time spec navigator for Spec Direct Relations.

  Tom 2026-05-16: "I want the miniature real time of the larger value flow diagram
  as way back [from SDR — there is no path back to the diagram otherwise]."

  Tom 2026-05-16 redesign note: "sorry that dark glass mini panel was unintelligible
  with my human eyes, I also suspect we could make it larger (the larger the more
  intelligible, the more impressive)."

  v2 (2026-05-16): switched from dark-glass to light white card. Wider (360px), larger
  dots (13px), more generous row height (32px). Coloured connection lines replace the
  unreadable white-on-dark dashes. The "← back" button is now prominent and readable.

  Shows all F / V / S entries as coloured dots arranged in type lanes, mirroring the
  column structure of ValueFlowDiagram. The current SDR entry pulses with a dark ring.
  Related entries (incoming + outgoing) are full-brightness; everything else is dimmed.
  Thin connection lines run from the current dot to each related dot.

  Clicking any dot → pivot SDR to that entry.
  "← back" button → close SDR entirely, returning the user to ValueFlowDiagram.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep }   from '../types/evo-plan'
import { SPEC_COLOURS }   from '../constants/specTypeColors'
import type { SpecTypeColourSet } from '../constants/specTypeColors'
import { useTaskSuggestions } from '../composables/useTaskSuggestions'

const props = defineProps<{
  spec:       SpecBlock
  evoSteps:   EvoStep[]
  currentId:  string
  currentTab: 'functions' | 'values' | 'solutions'
  /** flat list of IDs directly connected to the current SDR entry (incoming + outgoing) */
  relatedIds: string[]
}>()

const emit = defineEmits<{
  /** User clicked ← back — close SDR, return to VFD */
  close: []
  /** User clicked a dot — pivot SDR to this entry */
  pivot: [id: string, tab: 'functions' | 'values' | 'solutions']
  /** User clicked an E dot — close SDR, go back to the Evo Plan / VFD (stage 2) */
  'go-evo':   [stepName: string]
  /** User clicked a T dot — close SDR, navigate to Task Decomposition (stage 4) */
  'go-tasks': []
}>()

const { suggestTasks } = useTaskSuggestions()

/** Flat list of all task IDs synthesised rule-based from the current evo steps.
 *  Uses the same suggestTasks() deterministic algorithm as TaskList.vue —
 *  no LLM call, always ≥2 tasks per evo step. Computed reactively on evoSteps. */
const allTaskIds = computed<string[]>(() =>
  props.evoSteps.flatMap(s => suggestTasks(s).map(t => t.id))
)

// ── Layout constants ─────────────────────────────────────────────────────────────
const MM_W   = 360   // total minimap width (px) — v2: increased from 244 for legibility
const PAD_L  = 14   // left padding
const LBL_W  = 24   // width reserved for type label
const PAD_R  = 12   // right padding
const DOT_D  = 13   // dot diameter (v2: increased from 8)
const DOT_R  = 6    // dot radius  (v2: increased from 4)
const PAD_T  = 20   // top padding to first dot centre (v2: increased from 14)
const ROW_H  = 28   // row-to-row distance (slightly tighter to fit 5 lanes)

const DOTS_AREA_W = MM_W - PAD_L - LBL_W - PAD_R  // 310 px

/** Lane descriptor. tab drives SDR pivot; action drives cross-stage navigation. */
interface MiniLane {
  key:    string
  /** SDR pivot tab — null = not pivotable within SDR. */
  tab:    'functions' | 'values' | 'solutions' | null
  /** Cross-stage nav action — null = truly inert (hover tooltip only). */
  action: 'go-evo' | 'go-tasks' | null
  label:  string
  c:      SpecTypeColourSet
}

// Tom 2026-05-17: "mini diagram has only 3 of all the types of specs. Might as well include all."
// Added Constraints (C, red), Evo Steps (E, amber). Non-navigable (no SDR pivot to them).
// Tom 2026-05-17: "T for Tasks missing — you keep avoiding them" — added T lane (slate).
// Tom 2026-05-17: "neither evo nor task buttons respond" — E → go-evo, T → go-tasks.
const LANES: MiniLane[] = [
  { key: 'functions',   tab: 'functions',  action: null,        label: 'F', c: SPEC_COLOURS.function    },
  { key: 'values',      tab: 'values',     action: null,        label: 'V', c: SPEC_COLOURS.value       },
  { key: 'solutions',   tab: 'solutions',  action: null,        label: 'S', c: SPEC_COLOURS.solution    },
  { key: 'constraints', tab: null,         action: null,        label: 'C', c: SPEC_COLOURS.constraint  }, // truly inert
  { key: 'evo-steps',   tab: null,         action: 'go-evo',   label: 'E', c: SPEC_COLOURS['evo-step'] },
  { key: 'tasks',       tab: null,         action: 'go-tasks', label: 'T', c: SPEC_COLOURS.task        },
]

// ── Helpers ───────────────────────────────────────────────────────────────────────

function laneIds(key: string): string[] {
  if (key === 'functions')   return props.spec.functions.map(f => f.id)
  if (key === 'values')      return props.spec.values.map(v => v.id)
  if (key === 'solutions')   return props.spec.solutions.map(s => s.id)
  if (key === 'constraints') return (props.spec.constraints ?? []).map(c => c.id)
  if (key === 'evo-steps')   return props.evoSteps.map(s => s.name)
  if (key === 'tasks')       return allTaskIds.value
  return []
}

/** Dot centre-to-centre gap for a given lane — scales down for dense specs */
function gapFor(key: string): number {
  const n = laneIds(key).length
  if (n === 0) return 16
  const natural = Math.floor(DOTS_AREA_W / n)
  return Math.max(natural, DOT_D + 2)   // dots may touch but never overlap
}

/** x centre of dot[dotIdx] in lane[key] */
function cx(key: string, dotIdx: number): number {
  return PAD_L + LBL_W + dotIdx * gapFor(key) + DOT_R
}

/** y centre of lane[laneIdx] */
function cy(laneIdx: number): number {
  return PAD_T + laneIdx * ROW_H
}

/** Find lane index by tab (for the current navigable entry). */
function laneByTab(tab: string): number {
  return LANES.findIndex(l => l.tab === tab)
}

/** Find lane index by key (for connection line geometry). */
function laneIdxOf(key: string): number {
  return LANES.findIndex(l => l.key === key)
}

/** Resolve which lane KEY contains a given spec ID — used for connection lines.
 *  Checks all 6 lane types, including constraints, evo-step names, and task IDs. */
function laneKeyOf(id: string): string | null {
  if (props.spec.functions.some(f => f.id === id))           return 'functions'
  if (props.spec.values.some(v => v.id === id))              return 'values'
  if (props.spec.solutions.some(s => s.id === id))           return 'solutions'
  if ((props.spec.constraints ?? []).some(c => c.id === id)) return 'constraints'
  if (props.evoSteps.some(s => s.name === id))               return 'evo-steps'
  if (allTaskIds.value.includes(id))                         return 'tasks'
  return null
}

// ── Computed geometry ─────────────────────────────────────────────────────────────

const svgH = computed(() => PAD_T + (LANES.length - 1) * ROW_H + DOT_R + 12)

const relatedSet = computed(() => new Set(props.relatedIds))

const curLi   = computed(() => laneByTab(props.currentTab))
const curKey  = computed(() => LANES[curLi.value]?.key ?? 'values')
const curIdx  = computed(() => laneIds(curKey.value).indexOf(props.currentId))
const curCx   = computed(() => cx(curKey.value, curIdx.value))
const curCy   = computed(() => cy(curLi.value))

/** The current lane's accent colour for connection lines and the back button */
const curColor = computed(() => LANES[curLi.value]?.c.base ?? '#7c3aed')

/** Connection lines from current dot to each related dot (all 5 lane types). */
const connLines = computed(() => {
  return props.relatedIds
    .map(id => {
      const key = laneKeyOf(id)
      if (!key) return null
      const li  = laneIdxOf(key)
      const di  = laneIds(key).indexOf(id)
      if (di < 0 || li < 0) return null
      return { id, x2: cx(key, di), y2: cy(li) }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
})

// ── Events ────────────────────────────────────────────────────────────────────────

/** Handles dot clicks. F/V/S → pivot within SDR. E → go-evo. T → go-tasks. C → inert. */
function onDotClick(id: string, lane: MiniLane): void {
  if (lane.tab) {
    // Navigable spec lane — pivot within SDR
    if (id === props.currentId && lane.tab === props.currentTab) return
    emit('pivot', id, lane.tab)
  } else if (lane.action === 'go-evo') {
    emit('go-evo', id)   // id = evo step name
  } else if (lane.action === 'go-tasks') {
    emit('go-tasks')
  }
  // lane.action === null (Constraints) → do nothing
}
</script>

<template>
  <div class="sdr-mm" role="navigation" aria-label="Spec mini-map — navigate or return to Value Flow Diagram">

    <!-- Header — title only. Back button moved to full-width bar at bottom (Tom 2026-05-17:
         "it escaped my attention completely" — the old 11px right-aligned button was too small.
         Principle: Large enough and placed well enough to not be missed.) -->
    <div class="sdr-mm-hdr">
      <span class="sdr-mm-title">◈ VALUE FLOW</span>
    </div>

    <!-- Dot lanes + SVG connection overlay -->
    <div class="sdr-mm-body" :style="`height: ${svgH}px; width: ${MM_W}px`">

      <!-- Connection lines (behind dots) -->
      <svg
        class="sdr-mm-svg"
        :width="MM_W" :height="svgH"
        aria-hidden="true"
      >
        <line
          v-for="conn in connLines" :key="conn.id"
          :x1="curCx" :y1="curCy"
          :x2="conn.x2" :y2="conn.y2"
          :stroke="curColor"
          stroke-opacity="0.70"
          stroke-width="1.8"
          stroke-dasharray="4 2"
        />
      </svg>

      <!-- Lanes -->
      <template v-for="(lane, li) in LANES" :key="lane.key">

        <!-- Type label -->
        <span
          class="sdr-mm-lbl"
          :style="`top: ${cy(li) - 7}px; left: ${PAD_L}px; color: ${lane.c.base}`"
        >{{ lane.label }}</span>

        <!-- Entry dots:
             F/V/S → pivot within SDR (pointer, keyboard)
             E     → go-evo (pointer, keyboard, lightly dimmed — cross-stage nav)
             T     → go-tasks (pointer, keyboard, lightly dimmed — cross-stage nav)
             C     → truly inert (default cursor, 0.45 opacity, aria-hidden) -->
        <div
          v-for="(id, di) in laneIds(lane.key)"
          :key="id"
          class="sdr-mm-dot"
          :class="{
            'sdr-mm-dot--current': id === currentId && lane.tab === currentTab,
            'sdr-mm-dot--related': relatedSet.has(id) && !(id === currentId && lane.tab === currentTab),
            'sdr-mm-dot--dim':     !relatedSet.has(id) && !(id === currentId && lane.tab === currentTab),
          }"
          :style="`
            width:      ${DOT_D}px;
            height:     ${DOT_D}px;
            background: ${lane.c.base};
            top:        ${cy(li) - DOT_R}px;
            left:       ${cx(lane.key, di) - DOT_R}px;
            cursor:     ${(lane.tab || lane.action) ? 'pointer' : 'default'};
            ${(!lane.tab && !lane.action) ? 'opacity: 0.45;' : lane.action ? 'opacity: 0.75;' : ''}
          `"
          :title="lane.action === 'go-evo'
            ? `${id} — click to open in Evo Plan`
            : lane.action === 'go-tasks'
              ? `${id} — click to open in Task Decomposition`
              : id"
          v-bind="(lane.tab || lane.action)
            ? { role: 'button', tabindex: '0' }
            : { 'aria-hidden': 'true' }"
          @click.stop="(lane.tab || lane.action) ? onDotClick(id, lane) : undefined"
          @keydown.enter.stop="(lane.tab || lane.action) ? onDotClick(id, lane) : undefined"
        />

      </template>
    </div>

    <!-- Entry count footer — all 6 types (Tom 2026-05-17: added T for Tasks) -->
    <div class="sdr-mm-foot">
      <span :style="`color: ${SPEC_COLOURS.function.base}`">{{ spec.functions.length }}F</span>
      <span :style="`color: ${SPEC_COLOURS.value.base}`">{{ spec.values.length }}V</span>
      <span :style="`color: ${SPEC_COLOURS.solution.base}`">{{ spec.solutions.length }}S</span>
      <span :style="`color: ${SPEC_COLOURS.constraint.base}`">{{ (spec.constraints ?? []).length }}C</span>
      <span :style="`color: ${SPEC_COLOURS['evo-step'].base}`">{{ evoSteps.length }}E</span>
      <span :style="`color: ${SPEC_COLOURS.task.base}`">{{ allTaskIds.length }}T</span>
      <span class="sdr-mm-foot-sep">·</span>
      <span class="sdr-mm-foot-id">{{ currentId }}</span>
    </div>

    <!-- ── Back to Value Flow — full-width CTA bar (Tom 2026-05-17: "Large enough and
         placed well enough to not be missed. Clarity in Icons. Clarity in Text.") ──
         Picture + Text: VFD sparkline (recognisable diagram thumbnail) + clear label. -->
    <button
      type="button"
      class="sdr-mm-back"
      aria-label="Back to Value Flow Diagram"
      @click="emit('close')"
    >
      <!-- VFD sparkline — 6 colour-coded column bars mirroring the real diagram columns -->
      <svg width="54" height="22" viewBox="0 0 54 22" aria-hidden="true" class="sdr-mm-back-svg">
        <rect x="0"  y="0" width="6" height="22" rx="1.5" fill="#374151"/>
        <rect x="9"  y="0" width="6" height="22" rx="1.5" fill="#ca8a04"/>
        <rect x="18" y="0" width="6" height="22" rx="1.5" fill="#ea580c"/>
        <rect x="27" y="0" width="6" height="22" rx="1.5" fill="#7c3aed"/>
        <rect x="36" y="0" width="6" height="22" rx="1.5" fill="#16a34a"/>
        <rect x="45" y="0" width="6" height="22" rx="1.5" fill="#2563eb"/>
        <line x1="7"  y1="11" x2="8"  y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="16" y1="11" x2="17" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="25" y1="11" x2="26" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="34" y1="11" x2="35" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <line x1="43" y1="11" x2="44" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
        <circle cx="3"  cy="7"  r="1.5" fill="white" opacity="0.7"/>
        <circle cx="3"  cy="15" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="12" cy="9"  r="1.5" fill="white" opacity="0.7"/>
        <circle cx="12" cy="15" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="21" cy="7"  r="1.5" fill="white" opacity="0.7"/>
        <circle cx="21" cy="15" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="30" cy="9"  r="1.5" fill="white" opacity="0.7"/>
        <circle cx="30" cy="15" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="39" cy="7"  r="1.5" fill="white" opacity="0.7"/>
        <circle cx="39" cy="15" r="1.5" fill="white" opacity="0.7"/>
        <circle cx="48" cy="9"  r="1.5" fill="white" opacity="0.7"/>
        <circle cx="48" cy="15" r="1.5" fill="white" opacity="0.7"/>
      </svg>
      <!-- Arrow + label (Clarity in Text principle) -->
      <span class="sdr-mm-back-arrow">←</span>
      <span class="sdr-mm-back-label">Back to Value Flow</span>
    </button>

  </div>
</template>

<style scoped>
/* ── Container ────────────────────────────────────────────────────────────────── */
.sdr-mm {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
  user-select: none;
}

/* ── Header ───────────────────────────────────────────────────────────────────── */
.sdr-mm-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 7px;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}
.sdr-mm-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #94a3b8;
}
/* ── Back to Value Flow — full-width CTA bar ─────────────────────────────────
   Tom 2026-05-17: "it escaped my attention completely" (old: 11px right-aligned).
   Fix: full-width, 44px min-height, prominent indigo background, 14px bold text.
   Principle: Large enough and placed well enough to not be missed. */
.sdr-mm-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 10px 16px;
  background: #eef2ff;          /* indigo-50 — distinctly tinted CTA area */
  border: none;
  border-top: 1.5px solid #c7d2fe; /* indigo-200 */
  border-radius: 0 0 14px 14px;    /* matches card bottom radius */
  cursor: pointer;
  transition: background 0.12s;
}
.sdr-mm-back:hover {
  background: #e0e7ff;          /* indigo-100 — deepens on hover */
}
.sdr-mm-back-svg {
  flex-shrink: 0;
  display: block;
  border-radius: 3px;
  overflow: visible;
}
.sdr-mm-back-arrow {
  font-size: 20px;
  font-weight: 900;
  color: #4338ca;               /* indigo-700 */
  line-height: 1;
}
.sdr-mm-back-label {
  font-size: 13px;
  font-weight: 700;
  color: #4338ca;               /* indigo-700 */
  letter-spacing: 0.01em;
}

/* ── Body ─────────────────────────────────────────────────────────────────────── */
.sdr-mm-body {
  position: relative;
  overflow: hidden;
  padding: 0 0 2px;
}
.sdr-mm-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sdr-mm-lbl {
  position: absolute;
  font-size: 9.5px;
  font-weight: 800;
  font-family: ui-monospace, 'SF Mono', monospace;
  letter-spacing: 0.05em;
  line-height: 1;
  pointer-events: none;
}

/* ── Dots ─────────────────────────────────────────────────────────────────────── */
.sdr-mm-dot {
  position: absolute;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.12s, opacity 0.12s, box-shadow 0.12s;
  z-index: 1;
}
.sdr-mm-dot:hover {
  transform: scale(1.55);
  z-index: 4;
  opacity: 1 !important;
}

/* Current: pulsing dark ring — clearly visible on light background */
.sdr-mm-dot--current {
  box-shadow: 0 0 0 2.5px #1e293b, 0 0 0 4.5px rgba(30, 41, 59, 0.14);
  z-index: 3;
  animation: sdr-mm-pulse 1.6s ease-in-out infinite;
}
@keyframes sdr-mm-pulse {
  0%, 100% {
    box-shadow: 0 0 0 2.5px #1e293b, 0 0 0 4px   rgba(30, 41, 59, 0.12);
  }
  50% {
    box-shadow: 0 0 0 2.5px #1e293b, 0 0 0 6.5px rgba(30, 41, 59, 0.22);
  }
}

/* Related (connected) entries: full brightness */
.sdr-mm-dot--related {
  opacity: 1;
  z-index: 2;
  box-shadow: 0 0 0 1px rgba(30, 41, 59, 0.08);
}

/* Everything else: dimmed but still legible on white */
.sdr-mm-dot--dim {
  opacity: 0.28;
}

/* ── Footer ───────────────────────────────────────────────────────────────────── */
.sdr-mm-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px 7px;
  border-top: 1px solid #f1f5f9;
  font-size: 9.5px;
  color: #94a3b8;
  font-family: ui-monospace, 'SF Mono', monospace;
  overflow: hidden;
}
.sdr-mm-foot-id {
  color: #475569;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 2px;
}
.sdr-mm-foot-sep { opacity: 0.4; }
</style>
