<!-- ActionTileThumb.vue — thumbnail dispatcher for ActionsHubPanel tiles.
     Thumbnail Reality Rule: every tile mini is T1 LIVE (real data), T2 GLYPH
     (Planguage glyph), or T3 REAL (plan data). Never hand-drawn cartoons.

     Thumb types:
       semMeta       T2 GLYPH+LIVE — days-alive counter + component/composable/glossary scoreboard
       saveGlyph     T2 GLYPH — SaveGlyph SVG
       priorityGlyph T2 GLYPH — PriorityTripleGlyph SVG
       editGlyph     T2 GLYPH — EditGlyph SVG
       emoji         fallback — large emoji from parent tile config -->

<script setup lang="ts">
import SaveGlyph          from './icons/SaveGlyph.vue'
import EditGlyph          from './icons/EditGlyph.vue'
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'
import { useSemMetadata } from '../composables/useSemMetadata'

export type ThumbType =
  | 'semMeta'
  | 'saveGlyph'
  | 'priorityGlyph'
  | 'editGlyph'
  | 'emoji'

const props = defineProps<{
  /** Determines which thumbnail branch renders */
  thumb:  ThumbType
  /** Fallback emoji shown for 'emoji' type or unknown types */
  emoji?: string
}>()

// Module-level singleton — same instance across all tiles
const _meta = useSemMetadata()
</script>

<template>
  <!-- ── semMeta: days-alive headline + scoreboard row ─────────────────────── -->
  <div
    v-if="thumb === 'semMeta'"
    class="w-full h-full flex flex-col items-center justify-center gap-0.5 select-none"
  >
    <span class="text-[22px] font-extrabold tabular-nums text-fuchsia-700 leading-none">
      {{ _meta.daysSinceStart.value }}
    </span>
    <span class="text-[7px] font-bold text-fuchsia-500 uppercase tracking-wide leading-none">days alive</span>
    <div class="mt-1 flex items-center gap-1 text-[7px] text-slate-500 font-medium leading-none">
      <span>🧩{{ _meta.componentCount }}</span>
      <span class="text-slate-300">·</span>
      <span>🔧{{ _meta.composableCount }}</span>
      <span class="text-slate-300">·</span>
      <span>📖{{ _meta.glossaryCount }}</span>
    </div>
  </div>

  <!-- ── saveGlyph: SaveGlyph SVG centered ─────────────────────────────────── -->
  <div
    v-else-if="thumb === 'saveGlyph'"
    class="w-full h-full flex items-center justify-center"
  >
    <SaveGlyph size="compact" class="h-9 w-auto text-emerald-600" aria-hidden="true" />
  </div>

  <!-- ── priorityGlyph: PriorityTripleGlyph SVG centered ───────────────────── -->
  <div
    v-else-if="thumb === 'priorityGlyph'"
    class="w-full h-full flex items-center justify-center"
  >
    <PriorityTripleGlyph size="compact" class="h-9 w-auto text-amber-600" aria-hidden="true" />
  </div>

  <!-- ── editGlyph: EditGlyph SVG centered ─────────────────────────────────── -->
  <div
    v-else-if="thumb === 'editGlyph'"
    class="w-full h-full flex items-center justify-center"
  >
    <EditGlyph size="compact" class="h-9 w-auto text-slate-700" aria-hidden="true" />
  </div>

  <!-- ── emoji fallback: large emoji ───────────────────────────────────────── -->
  <div
    v-else
    class="w-full h-full flex items-center justify-center text-3xl select-none"
    aria-hidden="true"
  >
    {{ emoji ?? '📌' }}
  </div>
</template>
