<!-- UNIT_TYPE=Widget -->
<!-- ForkBar — the Ultra Light "forks in the road" verb bar.
     Evo Step 1 (2026-05-14): visual only. Clicks raise a toast naming the
     Fork so Tom can confirm the click target. No state transitions yet —
     wiring lands in Evo Step 2+.

     Evo Step 5 (2026-05-17): rich hover tooltips + ▾ menu chevron.
     Custom HoverHint panel replaces the browser-native `title` attribute.
     hasMenu forks show a ▾ chevron; clicking them emits `fork` as usual,
     and SEMEntryForm opens the inline action menu below the bar.

     Renders the 8 canonical Fork verbs from `useUltraLight()` as equal-sized
     pills on a tinted shelf. No glyph-size hierarchy (design-taste rule:
     "glyph size is a legibility device NEVER a hierarchy device"). Primary
     tone (emerald) marks the forward action; neutral pills are slate;
     caution is amber. Per "keep it simple" rule, no decorative emoji,
     verbs only with the keyed-icon accents for Save and Start Fresh.

     Mount behind `useUltraLight().enabled` so the bar is invisible in the
     normal app and only appears when `?ultraLight=1` is on. -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUltraLight, type ForkId, type ForkSpec } from '../composables/useUltraLight'

const props = defineProps<{
  /**
   * The ForkId whose inline action menu is currently open in the parent.
   * When set, the hover HoverHint for that fork is suppressed so the rendered
   * menu (a sibling element, below ForkBar in the DOM) is not visually
   * covered by the HoverHint (z-[340] would sit on top of the menu's auto
   * z-index). Pass `null` or omit when no menu is open.
   */
  activeMenuForkId?: ForkId | null
}>()

const { forks } = useUltraLight()

const emit = defineEmits<{
  fork: [id: ForkId]
}>()

const hoveredId = ref<ForkId | null>(null)
const hoveredSpec = computed(() => forks.find(f => f.id === hoveredId.value) ?? null)

function onForkClick(spec: ForkSpec): void {
  emit('fork', spec.id)
}

function toneClass(spec: ForkSpec): string {
  switch (spec.tone) {
    case 'primary':
      return 'bg-emerald-500 hover:bg-emerald-400 text-white ring-1 ring-emerald-300/40'
    case 'caution':
      return 'bg-amber-100 hover:bg-amber-200 text-amber-900 ring-1 ring-amber-300'
    case 'destructive':
      return 'bg-rose-100 hover:bg-rose-200 text-rose-900 ring-1 ring-rose-300'
    case 'neutral':
    default:
      return 'bg-slate-100 hover:bg-slate-200 text-slate-800 ring-1 ring-slate-300'
  }
}
</script>

<template>
  <!-- Outer container is `relative` so the HoverHint panel anchors to it. -->
  <div class="relative">
    <div
      role="toolbar"
      aria-label="Forks in the road — Ultra Light verb bar"
      class="rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-3 py-3
             flex flex-wrap items-center gap-2"
    >
      <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
        Forks
      </span>
      <button
        v-for="spec in forks"
        :key="spec.id"
        type="button"
        :aria-label="`Fork: ${spec.label} — ${spec.blurb}${spec.hasMenu ? ' (opens menu)' : ''}`"
        :aria-haspopup="spec.hasMenu ? 'menu' : undefined"
        class="inline-flex items-center gap-1.5 min-h-[36px] rounded-full px-3.5 py-1.5
               text-sm font-medium transition-colors duration-150
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-indigo-500"
        :class="toneClass(spec)"
        @mouseenter="hoveredId = spec.id"
        @mouseleave="hoveredId = null"
        @focus="hoveredId = spec.id"
        @blur="hoveredId = null"
        @click="onForkClick(spec)"
      >
        <span v-if="spec.accent" class="font-mono text-[11px] opacity-80" aria-hidden="true">{{ spec.accent }}</span>
        <span>{{ spec.label }}</span>
        <!-- Menu indicator: ▾ chevron on forks that open an action menu -->
        <span
          v-if="spec.hasMenu"
          class="text-[10px] opacity-60 leading-none"
          aria-hidden="true"
        >▾</span>
      </button>
    </div>

    <!-- Custom hover HoverHint — anchors to the bottom-left of the ForkBar.
         Width is capped at 20rem so it stays comfortably on screen.
         pointer-events-none so it never intercepts hover leaving the pill.
         SUPPRESSED when this fork's inline action menu is open (activeMenuForkId):
         the menu sibling sits at z-auto while the HoverHint is z-[340], so the
         HoverHint would visually cover the menu, hiding its options from the user
         even though clicks would pass through (pointer-events-none). -->
    <div
      v-if="hoveredSpec && hoveredSpec.id !== props.activeMenuForkId"
      role="tooltip"
      class="absolute top-full left-0 mt-2 z-[340] w-[22rem] max-w-[calc(100vw-2rem)]
             rounded-xl bg-slate-900 text-white shadow-2xl
             pointer-events-none select-none overflow-hidden"
      :id="`fork-tooltip-${hoveredSpec.id}`"
    >
      <!-- HoverHint header -->
      <div class="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5 border-b border-white/10">
        <span class="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {{ hoveredSpec.label }}
        </span>
        <span
          v-if="hoveredSpec.hasMenu"
          class="ml-auto text-[10px] font-semibold text-violet-400 uppercase tracking-wide"
        >
          options ▾
        </span>
        <span
          v-else
          class="ml-auto text-[10px] font-semibold text-emerald-400 uppercase tracking-wide"
        >
          direct action
        </span>
      </div>
      <!-- HoverHint body -->
      <p class="px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-200">
        {{ hoveredSpec.tooltip }}
      </p>
    </div>
  </div>
</template>
