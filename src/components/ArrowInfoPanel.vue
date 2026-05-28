<!--
  ArrowInfoPanel.vue — Modal panel shown when a stage-bar arrow is clicked.
  Displays rich information about a Planguage stage transition:
    - Gradient header with FROM/TO type glyphs and a wide concave arrow
    - Color swatch strip (position in indigo→emerald sweep)
    - Three tinted info cards: History / Planguage / Fun Fact

  CloseDot rule: CloseDot in header (on-dark variant).
  ScrollContainer rule: body content wrapped in ScrollContainer.
  Single-Surface rule: registered via registerExclusiveSurface in App.vue (openArrowIdx watcher).
  Define-by-Selection rule: no select-none on card body content.

  Spec: F.ValueAccumulationCounter (#15) — Design log r29, r33.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed } from 'vue'
import { ARROW_INFO_DATA } from '../data/arrowInfoData'
import PlTypeIcon from './icons/PlTypeIcon.vue'
import type { PlGlyphType } from './icons/PlTypeIcon.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { arrowProgressColors, stageProgressColor, STAGE_COUNT } from '../utils/stageProgressColors'

const props = defineProps<{
  /** Arrow index to show (0–9), or null to hide. */
  arrowIdx: number | null
}>()

const emit = defineEmits<{
  'close': []
  /** User clicked a type glyph in the header — parent may open glyph details. */
  'open-glyph': [type: PlGlyphType]
}>()

const info = computed(() =>
  props.arrowIdx !== null
    ? ARROW_INFO_DATA.find(a => a.idx === props.arrowIdx) ?? null
    : null
)

const isOpen = computed(() => props.arrowIdx !== null && info.value !== null)

/** Gradient colors for the modal header — from the arrow's progress colors. */
const headerGradient = computed(() => {
  if (props.arrowIdx === null) return {}
  const { from, to } = arrowProgressColors(props.arrowIdx)
  return {
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
  }
})

/** Color swatches: one per stage position, highlighting the two adjacent to this arrow. */
const swatches = computed(() => {
  return Array.from({ length: STAGE_COUNT }, (_, i) => ({
    color: stageProgressColor(i),
    isFrom: props.arrowIdx !== null && i === props.arrowIdx,
    isTo:   props.arrowIdx !== null && i === props.arrowIdx + 1,
  }))
})

/** Section background tints (subtle, light). */
const SECTION_TINTS = [
  'bg-amber-50/80 border-amber-200',
  'bg-violet-50/80 border-violet-200',
  'bg-emerald-50/80 border-emerald-200',
]
</script>

<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div
        v-if="isOpen && info"
        class="fixed inset-0 z-[490] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="`Stage transition: ${info.fromLabel} to ${info.toLabel}`"
        @click.self="emit('close')"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="emit('close')"
        />

        <!-- Panel card -->
        <div
          class="relative z-[491] w-full max-w-lg rounded-2xl shadow-2xl
                 bg-white flex flex-col overflow-hidden
                 max-h-[90vh]"
          @click.stop
        >
          <!-- ── Gradient header ─────────────────────────────────────── -->
          <div
            class="shrink-0 px-4 pt-4 pb-3 flex items-center gap-3"
            :style="headerGradient"
          >
            <!-- FROM glyph (clickable for glyph info) -->
            <button
              type="button"
              class="shrink-0 opacity-90 hover:opacity-100 transition-opacity
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
              :title="`${info.fromLabel} (${info.fromType}) — click for glyph info`"
              :aria-label="`${info.fromLabel} glyph — click for info`"
              @click="emit('open-glyph', info!.fromType)"
            >
              <PlTypeIcon :pl-type="info.fromType" size="md" />
            </button>

            <!-- Wide concave arrow (88×44) — white on gradient -->
            <svg
              viewBox="0 0 88 44"
              width="88"
              height="44"
              fill="none"
              class="flex-1 shrink-0"
              aria-hidden="true"
            >
              <!-- Shaft -->
              <line x1="2" y1="22" x2="60" y2="22"
                stroke="white" stroke-width="4" stroke-linecap="round" stroke-opacity="0.85" />
              <!-- Concave swept-back arrowhead: the Q control point pulls the base inward -->
              <path d="M 44,4 L 86,22 L 44,40 Q 58,22 44,4 Z"
                fill="white" fill-opacity="0.9" />
            </svg>

            <!-- TO glyph (clickable) -->
            <button
              type="button"
              class="shrink-0 opacity-90 hover:opacity-100 transition-opacity
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
              :title="`${info.toLabel} (${info.toType}) — click for glyph info`"
              :aria-label="`${info.toLabel} glyph — click for info`"
              @click="emit('open-glyph', info!.toType)"
            >
              <PlTypeIcon :pl-type="info.toType" size="md" />
            </button>

            <!-- Close -->
            <div class="ml-auto shrink-0">
              <CloseDot
                variant="on-dark"
                ariaLabel="Close arrow info panel"
                @click="emit('close')"
              />
            </div>
          </div>

          <!-- Stage labels row -->
          <div
            class="shrink-0 px-5 py-2 flex items-center justify-between text-white/90"
            :style="headerGradient"
          >
            <span class="text-xs font-bold uppercase tracking-widest">
              Stage {{ info.fromStage }} · {{ info.fromLabel }}
            </span>
            <span class="text-xs text-white/60">→</span>
            <span class="text-xs font-bold uppercase tracking-widest">
              Stage {{ info.toStage }} · {{ info.toLabel }}
            </span>
          </div>

          <!-- Color swatch strip -->
          <div class="shrink-0 flex h-2 w-full">
            <div
              v-for="(s, i) in swatches"
              :key="i"
              class="flex-1 transition-all duration-200"
              :style="{ background: s.color, opacity: (s.isFrom || s.isTo) ? '1' : '0.35' }"
            />
          </div>

          <!-- ── Scrollable body ─────────────────────────────────────── -->
          <!-- Nested-flex scroll pattern (DD-009-adjacent, 2026-05-28):
               outer = flex flex-col flex-1 min-h-0 → gives the outer div a concrete
               computed height (bounded by panel's max-h-[90vh] flex column).
               inner = flex-1 min-h-0 → fills that height as a flex child, giving
               overflow-y-auto a constrained container to scroll within.
               h-full does NOT work here: nested flex items don't propagate concrete
               heights to children via h-full unless the item itself sets height: explicitly. -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative flex flex-col"
            inner-class="flex-1 min-h-0 px-4 py-4 space-y-3"
            :no-pill="false"
          >
            <!-- Info sections -->
            <div
              v-for="(section, sIdx) in info.sections"
              :key="section.title"
              class="rounded-xl border p-4 space-y-2"
              :class="SECTION_TINTS[sIdx]"
            >
              <div class="flex items-center gap-2">
                <span class="text-base" aria-hidden="true">{{ section.emoji }}</span>
                <span class="text-sm font-bold text-gray-800">{{ section.title }}</span>
              </div>
              <p class="text-sm text-gray-700 leading-relaxed">{{ section.body }}</p>
              <!-- Link chips -->
              <div class="flex flex-wrap gap-2 pt-1">
                <a
                  v-for="link in section.links"
                  :key="link.url"
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[11px] font-medium
                         text-indigo-700 bg-indigo-50 border border-indigo-200
                         rounded-full px-2.5 py-0.5 hover:bg-indigo-100
                         transition-colors focus:outline-none focus-visible:ring-2
                         focus-visible:ring-indigo-500"
                >
                  <span>↗</span>
                  {{ link.label }}
                </a>
              </div>
            </div>

            <!-- Arrow index badge -->
            <p class="text-center text-[11px] text-gray-400 pt-1">
              Arrow {{ (info.idx + 1) }} of 10 · transition {{ info.fromStage }}→{{ info.toStage }}
            </p>
          </ScrollContainer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
