<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Feature #71: Spec Presentation Mode
 * Full-screen slideshow: one Planguage entry per slide, large readable card,
 * arrow-key + click navigation, slide counter, Escape to close.
 *
 * Slide order: all F. entries, then all V. entries, then all S. entries.
 * Spec: S.Evo71.SpecPresentationMode
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

// ---------------------------------------------------------------------------
// Props / Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  spec: SpecBlock | null
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()

// ---------------------------------------------------------------------------
// Slide model
// ---------------------------------------------------------------------------

type SlideType = 'F' | 'V' | 'S'

interface Slide {
  entry: FEntry | VEntry | SEntry
  type: SlideType
  index: number   // 0-based index within this run
  total: number   // total slide count
}

const slides = computed<Slide[]>(() => {
  if (!props.spec) return []
  const { functions, values, solutions } = props.spec
  const all: Array<{ entry: FEntry | VEntry | SEntry; type: SlideType }> = [
    ...functions.map((e) => ({ entry: e as FEntry, type: 'F' as SlideType })),
    ...values.map((e) => ({ entry: e as VEntry, type: 'V' as SlideType })),
    ...solutions.map((e) => ({ entry: e as SEntry, type: 'S' as SlideType })),
  ]
  const total = all.length
  return all.map((item, index) => ({ ...item, index, total }))
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const currentIndex = ref(0)
const currentSlide = computed<Slide | null>(() => slides.value[currentIndex.value] ?? null)

function prev(): void {
  if (currentIndex.value > 0) currentIndex.value--
}

function next(): void {
  if (currentIndex.value < slides.value.length - 1) currentIndex.value++
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

function handleKey(e: KeyboardEvent): void {
  if (!props.open) return
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  currentIndex.value = 0
  document.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKey)
})

// ---------------------------------------------------------------------------
// Entry type helpers
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<SlideType, string> = { F: '🔧', V: '📊', S: '🔩' }
const TYPE_LABEL: Record<SlideType, string> = { F: 'Function', V: 'Value', S: 'Solution' }
const TYPE_BADGE: Record<SlideType, string> = {
  F: 'bg-indigo-100 text-indigo-700',
  V: 'bg-emerald-100 text-emerald-700',
  S: 'bg-violet-100 text-violet-700',
}
const TYPE_DOT: Record<SlideType, string> = {
  F: 'bg-indigo-400',
  V: 'bg-emerald-400',
  S: 'bg-violet-400',
}

function asVEntry(entry: FEntry | VEntry | SEntry): VEntry {
  return entry as VEntry
}

function isVEntry(type: SlideType): boolean {
  return type === 'V'
}

// ---------------------------------------------------------------------------
// Progress dots: show up to 12 dots; beyond that show text
// ---------------------------------------------------------------------------

const MAX_DOTS = 12

const showDots = computed(() => slides.value.length <= MAX_DOTS)
</script>

<template>
  <!-- Only render when open AND there are slides -->
  <div
    v-if="open && slides.length > 0"
    class="fixed inset-0 bg-gray-950 z-50 flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label="Spec Presentation Mode"
  >
    <!-- ── Header bar ─────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
      <span class="text-sm font-medium text-gray-400 tabular-nums">
        {{ currentIndex + 1 }} / {{ slides.length }}
      </span>
      <span class="text-sm font-semibold text-gray-300 tracking-wide uppercase text-xs">
        Spec Presentation
      </span>
      <button
        type="button"
        class="h-11 w-11 flex items-center justify-center rounded-full text-gray-400
               hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2
               focus:ring-gray-500 transition-colors duration-150 text-xl font-bold"
        aria-label="Close presentation"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <!-- ── Main card area ─────────────────────────────────────────────── -->
    <div class="flex-1 flex items-center justify-center overflow-y-auto py-8">
      <div
        v-if="currentSlide"
        class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-8 p-10"
      >
        <!-- Type badge -->
        <div class="flex items-center gap-3 mb-6">
          <span
            :class="['inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold', TYPE_BADGE[currentSlide.type]]"
          >
            <span aria-hidden="true">{{ TYPE_ICON[currentSlide.type] }}</span>
            {{ TYPE_LABEL[currentSlide.type] }}
          </span>
        </div>

        <!-- ID -->
        <p class="text-2xl font-mono font-semibold text-gray-900 break-all">
          {{ currentSlide.entry.id }}
        </p>

        <!-- Description -->
        <p class="text-lg leading-relaxed mt-4 text-gray-700">
          {{ currentSlide.entry.description }}
        </p>

        <!-- V. entry detail grid: Scale / Meter / Goal / Tolerable -->
        <template v-if="isVEntry(currentSlide.type)">
          <div class="mt-8 grid grid-cols-1 gap-3">
            <template v-for="row in [
              { label: 'Scale',     value: asVEntry(currentSlide.entry).scale },
              { label: 'Meter',     value: asVEntry(currentSlide.entry).meter },
              { label: 'Wish',      value: asVEntry(currentSlide.entry).goal },
              { label: 'Tolerable', value: asVEntry(currentSlide.entry).tolerable },
            ]" :key="row.label">
              <div
                v-if="row.value"
                class="flex gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
              >
                <span class="w-20 shrink-0 font-medium text-gray-500">{{ row.label }}</span>
                <span class="text-gray-800 break-words min-w-0">{{ row.value }}</span>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Footer nav bar ────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-8 py-4 border-t border-gray-800 shrink-0">
      <!-- Prev button -->
      <button
        type="button"
        :disabled="currentIndex === 0"
        class="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold
               transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-gray-500
               disabled:opacity-30 disabled:cursor-not-allowed
               bg-gray-800 text-white hover:bg-gray-700 disabled:hover:bg-gray-800"
        aria-label="Previous slide"
        @click="prev"
      >
        ←
      </button>

      <!-- Progress indicator -->
      <div class="flex items-center gap-2" aria-hidden="true">
        <!-- Dot mode: up to 12 slides -->
        <template v-if="showDots">
          <button
            v-for="(slide, i) in slides"
            :key="i"
            type="button"
            :class="[
              'rounded-full transition-all duration-150 focus:outline-none',
              i === currentIndex
                ? `h-3 w-3 ${TYPE_DOT[slide.type]}`
                : 'h-2 w-2 bg-gray-600 hover:bg-gray-400',
            ]"
            :aria-label="`Go to slide ${i + 1}`"
            @click="currentIndex = i"
          />
        </template>
        <!-- Text mode: >12 slides -->
        <span v-else class="text-sm text-gray-400 tabular-nums font-medium">
          {{ currentIndex + 1 }} / {{ slides.length }}
        </span>
      </div>

      <!-- Next button -->
      <button
        type="button"
        :disabled="currentIndex >= slides.length - 1"
        class="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold
               transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-gray-500
               disabled:opacity-30 disabled:cursor-not-allowed
               bg-gray-800 text-white hover:bg-gray-700 disabled:hover:bg-gray-800"
        aria-label="Next slide"
        @click="next"
      >
        →
      </button>
    </div>
  </div>

  <!-- Shown when open but spec has no entries -->
  <div
    v-else-if="open && slides.length === 0"
    class="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center gap-4"
    role="dialog"
    aria-modal="true"
    aria-label="Spec Presentation Mode"
  >
    <p class="text-gray-400 text-lg">No spec loaded</p>
    <button
      type="button"
      class="h-11 px-6 rounded-full bg-gray-800 text-white hover:bg-gray-700 text-sm font-medium
             focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150"
      @click="emit('close')"
    >
      Close
    </button>
  </div>
</template>
