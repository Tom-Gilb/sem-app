<!-- UNIT_TYPE=Widget -->
<!--
  PlanguageProgressWindow.vue — Canonical visual receipt for any long-running
  Planguage-entity generation flow (Tom Gilb 2026-06-25 verbatim:
  *"Name = Planguage Progress window"*).

  Surfaces a 2×3 grid of colorful tiles, one per Planguage entry type
  (Stakeholder / Value / Function / Solution / Constraint / Resource).  Each
  tile shows:
    - Canonical Pl*Icon centerpiece (PlValueIcon O--*-->, PlFunctionIcon O,
      PlConstraintIcon [*], PlResourceIcon →O) at xl size, OR for the
      Stakeholder tile, a CUSTOM enlarged ←§→ with dual number slots
      (upper = animate, lower = inanimate per stakeholderType taxonomy)
    - Solution tile uses a RECTANGLE outline (per Tom's Planguage glossary
      directive overriding PlSolutionIcon's [*]→ in this surface only)
    - Live count badge in bottom-right corner
    - HoverHint with concept info on tile hover
    - Thick canonical-color top border stripe
    - Animation: SPINNING tile pulses + amber ring; PENDING tile grayscaled

  Data wiring lives in `usePlanguageProgress(spec, loading, loadingElapsed)`.

  Surfaced today from: SpecOutput.vue Stage 1 spec-generation loading state
  (its v343→v348 inline implementation moved here verbatim).
  Surfaced next from: Stage 2.2 solution auto-generation, Sharpen rounds,
  Maria report generation — all reuse this same window.

  Composes with: DD-011 Planguage-Glyph-First + DD-016 Color Keyed Icons +
  MOVE Principle + Conjunction-of-Technologies SUPREME + Honest Loading
  Hint Copy SUPREME + SEM-teaches-Planguage-incrementally + Twin portability.
-->
<script setup lang="ts">
import { computed, type Ref } from 'vue'
import type { SpecBlock } from '../types/spec'
import {
  usePlanguageProgress,
  BUILD_TYPE_SCHEDULE_FULL,
  BUILD_TYPE_SCHEDULE_SOLUTIONS_ONLY,
  type BuildTypeScheduleRow,
} from '../composables/usePlanguageProgress'
import PlValueIcon       from './icons/PlValueIcon.vue'
import PlFunctionIcon    from './icons/PlFunctionIcon.vue'
import PlConstraintIcon  from './icons/PlConstraintIcon.vue'
import PlResourceIcon    from './icons/PlResourceIcon.vue'

const props = withDefaults(defineProps<{
  /** Current spec — drives the live count per type. */
  spec: SpecBlock | null | undefined
  /** Whether generation is in flight.  When false + count===0, the tile
   *  shows the real "0" (we genuinely have zero of that type); when true +
   *  count===0, the tile shows "…" (number pending). */
  loading: boolean
  /** Seconds elapsed in the current generation.  Drives phase-keyed
   *  status transitions per the BUILD_TYPE_SCHEDULE. */
  loadingElapsed: number
  /** Which schedule to use — 'full' for Stage 1 (all types transition),
   *  'solutions-only' for Stage 2.2 (only the Solution tile spins). */
  schedule?: 'full' | 'solutions-only'
  /** Caption rendered under the tile grid.  Defaults to the Phase 1 limit
   *  disclosure; callers can override with a context-specific message. */
  caption?: string
  /** Optional header text override (defaults to "Translated to Planguage"). */
  headerText?: string
  /** r41 v352 (Tom Gilb 2026-06-25 "the developed Planguage numbers are
   *  still zero"): partial JSON text from translateStream's onChunk
   *  accumulator.  The composable regex-counts entry IDs in this text so
   *  the tiles tick up in real time during generation — not just once
   *  when the final spec lands. */
  streamingText?: string
}>(), {
  schedule:     'full',
  caption:      'Live counts streamed from AI · hover any tile for concept info',
  headerText:   'Translated to Planguage',
  streamingText: '',
})

// Adapter refs for the composable
const _spec    = computed(() => props.spec)
const _loading = computed(() => props.loading)
const _elapsed = computed(() => props.loadingElapsed)
const _stream  = computed(() => props.streamingText ?? '')

const scheduleRows = computed<readonly BuildTypeScheduleRow[]>(() => {
  return props.schedule === 'solutions-only'
    ? BUILD_TYPE_SCHEDULE_SOLUTIONS_ONLY
    : BUILD_TYPE_SCHEDULE_FULL
})

const { rows } = usePlanguageProgress(
  _spec as Ref<SpecBlock | null | undefined>,
  _loading as Ref<boolean>,
  _elapsed as Ref<number>,
  { schedule: scheduleRows.value, streamingText: _stream as Ref<string> },
)

// r41 v355 diagnostic (Tom Gilb 2026-06-25 "STILL ZERO COUNT") — visible
// stream-state debug surface so the planner can see EXACTLY whether
// streaming text is being accumulated, without opening Safari Web Inspector
// (which is unavailable in PWA mode anyway).  Composes with the in-app
// Diagnostics Panel pattern (v335) — diagnostics surfaced in the UI.
const streamDebug = computed(() => {
  const txt = props.streamingText ?? ''
  return {
    len:       txt.length,
    isLoading: props.loading,
    hasType:   /"type"\s*:\s*"(Function|Value|Solution|Constraint|Resource)"/.test(txt),
  }
})
</script>

<template>
  <div class="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-slate-50 via-white to-violet-50 shadow-sm overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-100 via-fuchsia-100 to-amber-100 border-b border-violet-200">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
      <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-violet-900">
        {{ headerText }}
      </p>
    </div>
    <div class="grid grid-cols-2 gap-2 p-2">
      <div
        v-for="row in rows"
        :key="row.key"
        :title="row.hoverHint"
        :class="[
          'relative aspect-square rounded-xl overflow-hidden shadow-md transition-all duration-300 bg-white',
          'flex flex-col items-center justify-between p-2',
          'border-t-4',
          row.colorClasses.borderColor,
          row.status === 'pending'  && 'grayscale opacity-60',
          row.status === 'spinning' && 'animate-pulse ring-2 ring-amber-300 ring-offset-1',
        ]"
      >
        <div class="flex-1 w-full flex items-center justify-center z-10 relative">
          <!-- STAKEHOLDER — custom enlarged ←§→ with dual number slots
               (animate upper, inanimate lower) -->
          <svg
            v-if="row.key === 'stakeholders'"
            viewBox="0 0 144 96"
            class="w-full h-full max-w-[140px]"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- ← violet solid arrow (value TO stakeholder) — longer + bigger (v347) -->
            <polyline points="12,40 0,48 12,56" fill="none" stroke="#7c3aed" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
            <line x1="0" y1="48" x2="42" y2="48" stroke="#7c3aed" stroke-width="5" stroke-linecap="round" />

            <!-- § hand-drawn (PlStakeholderIcon v9 path, scaled 2×) -->
            <g stroke="#2563eb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <path d="M 88 22 L 82 28 Q 66 18 50 28 Q 42 42 66 48 Q 90 54 82 68 Q 66 78 50 68 L 44 74" />
            </g>

            <!-- → green dashed arrow (resources FROM stakeholder) — longer + bigger -->
            <line x1="102" y1="48" x2="132" y2="48" stroke="#22c55e" stroke-width="4.5" stroke-dasharray="7 3.5" stroke-linecap="round" />
            <polyline points="124,40 144,48 124,56" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Upper loop number — animate stakeholders (Direct + Indirect) -->
            <text x="59" y="38" text-anchor="middle"
                  font-family="ui-sans-serif, system-ui, sans-serif"
                  font-size="20" font-weight="900" fill="#1e40af">
              {{ row.displayAnimate }}
            </text>
            <!-- Lower loop number — inanimate stakeholders (Regulatory + System + Inanimate) -->
            <text x="76" y="68" text-anchor="middle"
                  font-family="ui-sans-serif, system-ui, sans-serif"
                  font-size="20" font-weight="900" fill="#1e40af">
              {{ row.displayInanimate }}
            </text>
          </svg>

          <!-- Five other tiles: canonical Pl*Icons + custom Solution rectangle.
               r41 v358 (Tom Gilb 2026-06-25 "make to non S icons as big as S"):
               scaled up from xl (56px) to match the Stakeholder ←§→ tile fill
               (~140px square).  CSS scale on the SVG root via attr passthrough
               (Vue's default inheritAttrs:true flows the `class` to the <svg>). -->
          <template v-else>
            <PlValueIcon       v-if="row.key === 'values'"           size="xl" class="scale-[2.4] transform-gpu" />
            <PlFunctionIcon    v-else-if="row.key === 'functions'"   size="xl" class="scale-[2.4] transform-gpu" />
            <!-- SOLUTION — rectangle outline (Tom's Planguage glossary directive).
                 r41 v359 (Tom Gilb 2026-06-25 "solutions text partly obscured"):
                 v358 made the Solution rect w-full h-full which overlapped the
                 "SOLUTIONS" bottom label.  Reverted to 56×56 base + scale-2.4
                 transform to match the Pl*Icon scaling exactly — same final
                 rendered size as the other icons, leaves the bottom label
                 visible. -->
            <svg
              v-else-if="row.key === 'solutions'"
              viewBox="0 0 100 100"
              class="w-[56px] h-[56px] scale-[2.4] transform-gpu"
              aria-hidden="true"
            >
              <rect x="14" y="22" width="72" height="56" rx="2"
                    fill="none" stroke="#ea580c" stroke-width="4"
                    stroke-linejoin="round" />
            </svg>
            <PlConstraintIcon  v-else-if="row.key === 'constraints'" size="xl" class="scale-[2.4] transform-gpu" />
            <PlResourceIcon    v-else-if="row.key === 'resources'"   size="xl" class="scale-[2.4] transform-gpu" />

            <!-- Count badge — bottom-right corner -->
            <span
              class="absolute bottom-1 right-1 text-2xl font-black tabular-nums leading-none"
              :class="[row.colorClasses.textColor, row.status === 'spinning' ? 'animate-pulse' : '']"
            >{{ row.displayCount }}</span>
          </template>
        </div>

        <!-- Bottom text label in canonical type colour -->
        <p
          class="text-[10px] font-extrabold uppercase tracking-wider z-10 leading-none mb-0.5 mt-0.5 text-center"
          :class="row.colorClasses.textColor"
        >{{ row.label }}</p>
      </div>
    </div>

    <!-- Caption — narrates the current Phase honestly (Phase 1 limit). -->
    <p class="text-[10px] text-slate-500 text-center px-3 pb-1 leading-snug italic">
      {{ caption }}
    </p>
    <!-- r41 v371 — stream-state diagnostic (kept from v355) so any future
         streaming repair can be verified at-a-glance.  `stream: 0 chars ·
         hasType: no` during loading is the EXPECTED state in Safari PWA
         (SDK streaming broken — counts come from time-keyed animation). -->
    <p
      v-if="streamDebug.isLoading"
      class="text-[9px] text-slate-400 text-center px-3 pb-2 leading-tight font-mono"
      title="Diagnostic: stream length (real SSE streaming when available) · hasType (regex anchor matches). In Safari PWA this typically reads `0 chars · no` — counts come from a time-keyed animation pegged to the AI's typical pace."
    >
      stream: {{ streamDebug.len }} chars · hasType: {{ streamDebug.hasType ? 'yes' : 'no' }}
    </p>
  </div>
</template>
