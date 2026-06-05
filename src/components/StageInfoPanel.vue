<!--
  StageInfoPanel.vue — Modal panel shown when a stage bar tile is double-clicked.
  Displays rich information about a single Planguage planning stage:
    - Gradient header using the stage's progress color (stageProgressColor)
    - Stage number badge, PlTypeIcon glyph, and tagline
    - Three tinted info cards: History / Planguage / SEM Examples

  CloseDot rule: CloseDot in header (on-dark variant), at END of flex header row.
  ScrollContainer rule: body content wrapped in ScrollContainer.
  Single-Surface rule: MUST be registered via registerExclusiveSurface in App.vue
    (add a watcher on the openStageIdx prop, mirroring the openArrowIdx pattern).
  Define-by-Selection rule: no select-none on card body content; z-index ≤ 600.

  z-index: 490 for backdrop, 491 for card — same as ArrowInfoPanel.

  Emits:
    close        — user dismissed the panel
    open-glyph   — user clicked the PlTypeIcon; parent may open GlyphDataPanel

  Spec: StageInfoPanel — Design log SEM-Design-History.md
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed } from 'vue'
import { STAGE_INFO_DATA } from '../data/stageInfoData'
import PlTypeIcon from './icons/PlTypeIcon.vue'
import type { PlGlyphType } from './icons/PlTypeIcon.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { stageDarkBgColor } from '../utils/stageProgressColors'

const props = defineProps<{
  /**
   * Stage number to show (1–11), or null to hide.
   * Matches StageInfo.stage in stageInfoData.ts.
   */
  stageIdx: number | null
}>()

const emit = defineEmits<{
  'close': []
  /** User clicked the PlTypeIcon glyph — parent may open GlyphDataPanel. */
  'open-glyph': [type: PlGlyphType]
}>()

const info = computed(() =>
  props.stageIdx !== null
    ? STAGE_INFO_DATA.find(s => s.stage === props.stageIdx) ?? null
    : null
)

const isOpen = computed(() => props.stageIdx !== null && info.value !== null)

/**
 * Gradient for the modal header.
 *
 * CONTRAST FIX (Tom 2026-06-03 screenshot: header text unreadable):
 *   Was stageProgressColor (L=65%) — too light for white text — contrast
 *   ~1.9:1 against white for cyan-band stages (FAIL WCAG AA).  Replaced with
 *   stageDarkBgColor (L=25%) which the codebase already provides specifically
 *   for "coloured overlay with white copy" (per its docstring: contrast
 *   ≥5.5:1 across all 11 hues, ≥7.9:1 at the worst-case cyan band).
 *   StageInfoPanel was the only consumer that had not adopted it yet.
 */
const headerGradient = computed(() => {
  if (props.stageIdx === null) return {}
  // stageDarkBgColor takes 0-based position; stageIdx is 1-based
  const baseColor = stageDarkBgColor(props.stageIdx - 1)
  // A slightly darker shade for the diagonal gradient end
  const darkerColor = stageDarkBgColor(Math.min(props.stageIdx, 10))
  return {
    background: `linear-gradient(135deg, ${baseColor} 0%, ${darkerColor} 100%)`,
  }
})

/** Section background tints (subtle, light) — matching ArrowInfoPanel palette. */
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
        :aria-label="`Stage ${info.stage}: ${info.label} — ${info.tagline}`"
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
            <!-- PlTypeIcon glyph (clickable to emit open-glyph).
                 DD-013 (Tom 2026-06-03 screenshot: "the hovering on this step
                 and others did NOT give 'double click for info' as all should
                 have").  The wrapping button's title intercepts the PlTypeIcon's
                 automatic DD-013 tooltip; restore the "double-click for detailed
                 icon info" suffix explicitly here so the rule is honoured.
                 Single-click opens GlyphDataPanel (via emit), so single-click
                 IS the "for info" gesture here — double-click works too via the
                 inner PlTypeIcon's own handler. -->
            <button
              type="button"
              class="shrink-0 opacity-90 hover:opacity-100 transition-opacity
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
              :title="`${info.label} (${info.plType}) — click or double-click for detailed icon info`"
              :aria-label="`${info.label} glyph — click for detailed icon info`"
              @click="emit('open-glyph', info!.plType)"
            >
              <PlTypeIcon :pl-type="info.plType" size="md" />
            </button>

            <!-- Wide arrow SVG — stage-progress direction indicator -->
            <svg
              viewBox="0 0 88 44"
              width="88"
              height="44"
              fill="none"
              class="flex-1 shrink-0"
              aria-hidden="true"
            >
              <!-- Shaft -->
              <line
                x1="2" y1="22" x2="60" y2="22"
                stroke="white" stroke-width="4" stroke-linecap="round" stroke-opacity="0.85"
              />
              <!-- Concave swept-back arrowhead — same as ArrowInfoPanel -->
              <path
                d="M 44,4 L 86,22 L 44,40 Q 58,22 44,4 Z"
                fill="white" fill-opacity="0.9"
              />
            </svg>

            <!-- Stage number badge -->
            <div
              class="shrink-0 flex items-center justify-center
                     w-9 h-9 rounded-full bg-white/20 border border-white/40
                     text-white font-bold text-base select-none"
              aria-hidden="true"
            >
              {{ info.stage }}
            </div>

            <!-- Stage label (truncated on small screens) -->
            <span class="shrink-0 text-white font-bold text-sm truncate max-w-[80px]">
              {{ info.label }}
            </span>

            <!-- CloseDot — end of header row (CloseDot rule) -->
            <div class="ml-auto shrink-0">
              <CloseDot
                variant="on-dark"
                ariaLabel="Close stage info panel"
                @click="emit('close')"
              />
            </div>
          </div>

          <!-- Stage identifier + tagline row -->
          <div
            class="shrink-0 px-5 py-2 flex items-baseline gap-2 text-white/90"
            :style="headerGradient"
          >
            <span class="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
              Stage {{ info.stage }} · {{ info.label }}
            </span>
            <span class="text-white/50 text-xs">—</span>
            <span class="text-xs text-white/80 italic truncate">
              {{ info.tagline }}
            </span>
          </div>

          <!-- ── Scrollable body ─────────────────────────────────────── -->
          <!-- max-height on inner-style — the ONLY reliable scroll pattern when the panel
               card uses max-h-[90vh] (not an explicit height).
               h-full and flex-1 min-h-0 both require an explicitly-specified parent height
               (flex algorithm gives a computed height, but CSS % resolution requires
               an explicit one). max-height on the scrollable div is self-contained:
               inner grows to content, caps at calc(90vh − fixed), scrolls.
               160px = generous estimate of header (≈72px) + tagline (≈34px)
               + 2× outer panel padding (p-4). Safe buffer absorbs any line-wrap growth. -->
          <ScrollContainer
            outer-class="relative overflow-hidden"
            inner-class="px-4 py-4 space-y-3"
            inner-style="max-height: calc(90vh - 160px);"
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

            <!-- Stage position badge -->
            <p class="text-center text-[11px] text-gray-400 pt-1">
              Stage {{ info.stage }} of 11 · {{ info.plType }}
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
