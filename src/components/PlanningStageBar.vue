<script setup lang="ts">
// PlanningStageBar.vue — 11-stage visual workflow tile bar.
//
// r41 v350 (Tom Gilb 2026-06-25 *"the names are not change but al the icons
// have and size"*): icons swapped from custom hand-drawn 40×40 SVGs to the
// canonical `<PlTypeIcon size="xl">` (56×56) per stage's plType, MATCHING
// the main-app ValueCounter stage bar.  Pre-v350 this file rendered its
// own visual idiom (smaller, custom artwork); v350 brings parity with the
// canonical Planguage glyph family Tom uses elsewhere (counter tiles,
// chip-Source highlights, etc.).
import PlTypeIcon from './icons/PlTypeIcon.vue'
import type { PlGlyphType } from './icons/PlTypeIcon.vue'
// r41 v379 (Tom Gilb 2026-06-25 "the old hover text is there together with, if i
// move cursor, the new one") — pull canonical stage HoverHint from PLANNING_STAGES
// and pass per-stage `:title` to <PlTypeIcon>.  Without an explicit title prop,
// PlTypeIcon falls back to its plType canonical label (e.g. constraint =
// "Constraint — hard boundary that must not be violated…"), leaking the OLD
// Stage 5 framing.  Routing via PLANNING_STAGES makes every stage tile's icon
// HoverHint match the stage's actual purpose — eliminates the parallel-
// implementation drift Trace-Before-Patch SUPREME guards against.
import { PLANNING_STAGES } from '../data/planningStages'
// Rebuilt 2026-05-27 from screenshot evidence after git reset --hard wiped the
// original (which was never committed to git between 2026-05-19 and 2026-05-27).
//
// Design reference: screenshot from 2026-05-25 02:25 showing 11 dark tiles
// (Stakes → Solutions → Sharpen → Impacts → Refine → Evo Steps → Evo Impact
//  → Tasks → Study-Act → Plan → Export) with connecting teal arrows.
//
// Architecture principles (Architectural Resilience Rule 2026-05-27):
//   - Stages defined as data (not hardcoded in template), trivially extendable
//   - Active state driven by props, no internal navigation state
//   - Emits 'navigate' so App.vue owns all stage-transition logic
//   - Tile icons are inline SVG; no external asset dependency
//   - Horizontal scroll container wraps tiles for narrow windows

const props = defineProps<{
  /** Current planning stage index (1–11). Drives which tile is highlighted. */
  currentStage: number
  /** True once a spec has been parsed — unlocks non-Stakes tiles. */
  hasSpec: boolean
  /** True once an evo plan exists — unlocks later tiles. */
  hasPlan: boolean
}>()

const emit = defineEmits<{
  /** User clicked a tile — parent should navigate to that app stage. */
  navigate: [appStage: number]
}>()

// ── Stage definitions ─────────────────────────────────────────────────────────
// Each stage maps to an appStage (1–5) so the existing App.vue stage system
// is used as the routing layer. Multiple tiles can share an appStage (they
// represent different conceptual moments within the same technical stage).
// `color` = Tailwind bg token for the icon accent ring (inactive tiles).
// `activeGradient` = gradient classes for the active tile background.

// r41 v298 (Tom Gilb 2026-06-23) — `export const` REMOVED.  `<script setup>`
// cannot contain ES module exports per Vue compiler; this `export const STAGES`
// pre-dated the strict-enforcement Vite version and was silently OK before.
// SpecEditorPanel embed (r41 v298) re-activated this file's compile and the
// error surfaced.  STAGES kept as a local const (renamed via const-only),
// destination-stage label lookup that App.vue previously could have used now
// happens via EDITOR_STAGE_NAMES inside SpecEditorPanel directly.
// r41 v350 — STAGES tile metadata.  Labels + plType now read from canonical
// PLANNING_STAGES (single source of truth, can never drift again).  The local
// metadata retained per tile = appStage routing + gradient colour scheme.
const STAGES: ReadonlyArray<{
  n: number
  label: string
  plType: PlGlyphType
  appStage: number
  activeFrom: string
  activeTo: string
}> = [
  { n: 1,  label: 'Stakes',     plType: 'stakeholder', appStage: 1, activeFrom: 'from-violet-700',  activeTo: 'to-indigo-600' },
  { n: 2,  label: 'Solutions',  plType: 'solution',    appStage: 1, activeFrom: 'from-amber-600',   activeTo: 'to-orange-500' },
  { n: 3,  label: 'Sharpen',    plType: 'function',    appStage: 1, activeFrom: 'from-sky-700',     activeTo: 'to-blue-600' },
  { n: 4,  label: 'Impacts',    plType: 'value',       appStage: 3, activeFrom: 'from-cyan-700',    activeTo: 'to-teal-600' },
  { n: 5,  label: 'Refine Attributes', plType: 'constraint', appStage: 2, activeFrom: 'from-indigo-700', activeTo: 'to-violet-600' },
  { n: 6,  label: 'Evo Steps',  plType: 'evo-step',    appStage: 2, activeFrom: 'from-emerald-700', activeTo: 'to-green-600' },
  { n: 7,  label: 'Evo Impact', plType: 'value',       appStage: 3, activeFrom: 'from-rose-700',    activeTo: 'to-pink-600' },
  { n: 8,  label: 'Tasks',      plType: 'task',        appStage: 4, activeFrom: 'from-pink-700',    activeTo: 'to-rose-600' },
  { n: 9,  label: 'Study-Act',  plType: 'evo-step',    appStage: 2, activeFrom: 'from-amber-700',   activeTo: 'to-yellow-600' },
  { n: 10, label: 'Resources',  plType: 'resource',    appStage: 2, activeFrom: 'from-emerald-600', activeTo: 'to-green-500' },
  { n: 11, label: 'Export',     plType: 'constraint',  appStage: 5, activeFrom: 'from-violet-700',  activeTo: 'to-purple-600' },
] as const

function isActive(s: typeof STAGES[number]): boolean {
  // r17 fix (2026-06-02): compare planning stage index (1–11) not appStage (1–5).
  // Using appStage caused ALL tiles sharing the same appStage to highlight together.
  return s.n === props.currentStage
}

function isReachable(s: typeof STAGES[number]): boolean {
  if (s.appStage === 1) return true
  if (!props.hasSpec) return false
  if (s.appStage > 2 && !props.hasPlan) return false
  return true
}

/**
 * r41 v379 — canonical per-stage HoverHint text routed into the PlTypeIcon
 * `title` prop so the stage's actual purpose (from PLANNING_STAGES) shows on
 * hover, NOT the plType canonical label (which would leak "Constraint — hard
 * boundary…" for stages 5 + 11 even though their stage purpose differs).
 */
function stageIconTitle(n: number): string {
  return PLANNING_STAGES.find(p => p.stage === n)?.title ?? ''
}
</script>

<template>
  <!-- Outer wrapper: full-width, scroll hidden behind fade edges on narrow screens. -->
  <div
    class="w-full bg-slate-900 border-b border-slate-700 px-3 py-2.5 overflow-x-auto
           scrollbar-none"
    role="navigation"
    aria-label="Planning workflow stages"
  >
    <div class="flex items-center gap-0 min-w-max mx-auto">

      <template v-for="(s, idx) in STAGES" :key="s.n">

        <!-- ── Connecting arrow (between tiles) — r41 v377 (Tom Gilb 2026-
             06-26 "the arrow info does not work"): added HoverHint that
             names the transition (Stage N: <label> → Stage N+1: <label>) so
             planner gets a meaningful tooltip instead of silence on hover.
             Arrow stays decorative (aria-hidden) but the wrapping div is
             aria-label'd for SR users. -->
        <div
          v-if="idx > 0"
          class="flex items-center px-1 shrink-0"
          :title="`Stage ${STAGES[idx - 1].n} (${STAGES[idx - 1].label}) → Stage ${s.n} (${s.label}) — click either tile to jump`"
          :aria-label="`Transition from Stage ${STAGES[idx - 1].n} ${STAGES[idx - 1].label} to Stage ${s.n} ${s.label}`"
        >
          <svg
            class="w-4 h-4 transition-colors duration-300"
            :class="isActive(s) ? 'text-teal-300' : 'text-slate-600'"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M3 8h8M8 4l4 4-4 4" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>

        <!-- ── Stage tile ─────────────────────────────────────────────── -->
        <button
          type="button"
          :disabled="!isReachable(s)"
          :aria-label="`Stage ${s.n}: ${s.label}${isActive(s) ? ' (current)' : ''}`"
          :aria-current="isActive(s) ? 'step' : undefined"
          :title="isReachable(s) ? `Go to ${s.label}` : `${s.label} — complete earlier stages first`"
          class="relative flex flex-col items-center justify-between
                 w-[100px] h-[108px] rounded-xl px-1.5 py-2
                 transition-all duration-300 shrink-0
                 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900"
          :class="[
            isActive(s)
              ? `bg-gradient-to-b ${s.activeFrom} ${s.activeTo} shadow-lg shadow-black/40
                 ring-0 focus:ring-white/60 scale-105`
              : isReachable(s)
                ? 'bg-slate-800 hover:bg-slate-700 focus:ring-slate-500 cursor-pointer'
                : 'bg-slate-800/50 cursor-not-allowed opacity-50',
          ]"
          @click="isReachable(s) && emit('navigate', s.n)"
        >
          <!-- Stage number badge (top-left) — Tom 2026-06-04: was illegible
               (text-white/80 on light active gradients washed out, text-
               slate-300 on dark inactive tiles low-contrast).  Now uses
               the universal dark-plate treatment: bg-black/70 + white text
               + tight padding — readable on every active/inactive gradient. -->
          <span
            class="absolute top-1 left-1 text-[11px] font-extrabold leading-none
                   bg-black/70 text-white rounded-md px-1.5 py-1 shadow-sm"
            aria-hidden="true"
          >{{ s.n }}</span>

          <!-- ── Icon (center) ────────────────────────────────────────── -->
          <!-- r41 v350 (Tom Gilb 2026-06-25 *"the names are not change but al
               the icons have and size"*): single canonical `<PlTypeIcon>` at
               xl size, matching the main-app ValueCounter stage bar.  Eleven
               hand-drawn SVGs replaced with one component reference + plType
               per stage from the canonical PLANNING_STAGES mapping.  The
               native Pl*Icon multi-colour scheme renders against the dark
               tile background; ring/shadow treatment delegated to the tile
               container.  `no-detail-click="true"` because the tile itself
               is the navigation click target — opening GlyphDataPanel on
               the same click would compete with the navigate-to-stage emit. -->
          <div class="flex-1 flex items-center justify-center w-full mt-2" aria-hidden="true">
            <PlTypeIcon
              :pl-type="s.plType"
              size="xl"
              :no-detail-click="true"
              :title="stageIconTitle(s.n)"
              :class="isActive(s) ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'opacity-90'"
            />
          </div>

          <!-- Stage label (bottom) — r41 v377 (Tom Gilb 2026-06-26 "the
               stages are squashed"): removed `truncate` so full labels
               render.  `whitespace-normal` + `break-words` allows 2-line
               wrap for the longer ones ("Evo Steps", "Evo Impact", "Study-
               Act") within the bumped 100px tile width.  Tile height also
               bumped 104→108px to comfortably fit two short lines.  Tom
               flagged this multiple times before; v377 banks it
               structurally so any future tile-width change must preserve
               full label visibility. -->
          <span
            class="text-[10px] font-bold leading-tight text-center px-0.5 w-full whitespace-normal break-words"
            :class="isActive(s) ? 'text-white' : 'text-slate-200'"
          >
            <span v-if="isActive(s)" class="opacity-70" aria-hidden="true">▶ </span>{{ s.label }}
          </span>
        </button>

      </template>
    </div>
  </div>
</template>
