<!-- UNIT_TYPE=Widget
  PageScrollPin.vue — viewport-level "scroll pin" with % shown + up/down arrows.

  Tom Gilb 2026-06-06: "the resources stage window, and all other stage windows
  that scroll need the scroll pin with % and arrows".

  Why this exists: most full-screen panels in the SEM App wrap their bodies in
  <ScrollContainer> which already shows a "% shown" pill + scroll-direction
  arrows + right-edge progress thumb.  Stage views, however, are NOT wrapped —
  they scroll with the browser window (document scroll), so they don't pick up
  ScrollContainer's pill.  This widget watches `window.scrollY` and mirrors
  the ScrollContainer pill at the bottom-centre of the viewport so EVERY
  scrollable surface gets the same indicator.

  Behaviour:
    • Auto-hides when document is not scrollable.
    • Shows "% shown" (the same calculation ScrollContainer uses:
      `clientHeight / scrollHeight`).
    • Up arrow (chevron) is rendered when not at the top (clicking it scrolls
      to the top); down arrow when not at the bottom (clicking scrolls to
      bottom).  ↕ in the middle.
    • Pure document-scroll listener — no per-stage wiring needed.  Drop the
      component once at App root and every stage view inherits.

  Composition:
    • Mirrors the visual language of ScrollContainer (same dark pill + 10 px
      font + animate-bounce).
    • Fixed position at bottom-centre, z-[60] so it sits below modal backdrops
      (z-[400+]) but above ordinary page content.  Hidden via v-if when a
      modal / drawer / panel is open (parent passes the `suppress` prop).
    • Pointer-events: enabled (the arrows are clickable for fast jump).
-->
<template>
  <Transition name="psp-fade">
    <div
      v-if="visible"
      class="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] select-none"
      role="status"
      aria-live="polite"
      :aria-label="`Page scroll position: ${pctShown}% visible`"
    >
      <div
        class="flex items-center gap-1 rounded-full bg-gray-800 text-white text-[10px] font-semibold px-2.5 py-1 shadow-lg animate-bounce"
      >
        <!-- Up arrow (jump to top) — visible whenever there's content above -->
        <button
          v-if="hasLess"
          type="button"
          class="flex items-center justify-center h-3 w-3 rounded hover:bg-white/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
          title="Jump to top of page"
          aria-label="Jump to top of page"
          @click="scrollToTop"
        >
          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd"
              d="M14.78 11.78a.75.75 0 0 1-1.06 0L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06z"
              clip-rule="evenodd" />
          </svg>
        </button>
        <span class="px-1" :title="`${pctShown}% of page height visible · scrolled ${pctScrolled}% through`">
          {{ pctShown }}% shown
        </span>
        <!-- Down arrow (jump to bottom) — visible whenever there's content below -->
        <button
          v-if="hasMore"
          type="button"
          class="flex items-center justify-center h-3 w-3 rounded hover:bg-white/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
          title="Jump to bottom of page"
          aria-label="Jump to bottom of page"
          @click="scrollToBottom"
        >
          <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
              clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  /** When true, the pin is hidden — pass this when a modal/drawer/full-screen panel is open. */
  suppress?: boolean
  /** Minimum scroll-overflow in px before the pin appears.  Default 32 (avoids flicker). */
  threshold?: number
}>(), {
  suppress: false,
  threshold: 32,
})

const scrollY      = ref(0)
const clientHeight = ref(0)
const scrollHeight = ref(0)

function measure(): void {
  // Use documentElement: the root <html> reports the page-level scroll metrics.
  const doc = document.documentElement
  scrollY.value      = window.scrollY || doc.scrollTop || 0
  clientHeight.value = doc.clientHeight || window.innerHeight || 0
  scrollHeight.value = doc.scrollHeight || 0
}

const isScrollable = computed(() => scrollHeight.value - clientHeight.value > props.threshold)
const hasLess      = computed(() => scrollY.value > 4)
const hasMore      = computed(() => (scrollHeight.value - clientHeight.value - scrollY.value) > 4)
const visible      = computed(() => !props.suppress && isScrollable.value)

const pctShown = computed(() => {
  if (scrollHeight.value === 0) return 100
  return Math.min(100, Math.max(0, Math.round((clientHeight.value / scrollHeight.value) * 100)))
})
const pctScrolled = computed(() => {
  const maxScroll = scrollHeight.value - clientHeight.value
  if (maxScroll <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((scrollY.value / maxScroll) * 100)))
})

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function scrollToBottom(): void {
  window.scrollTo({ top: scrollHeight.value, behavior: 'smooth' })
}

let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null

function onScrollOrResize(): void { measure() }

onMounted(() => {
  measure()
  window.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  // Track document size changes (new content rendered, panels expanded, etc.)
  ro = new ResizeObserver(measure)
  ro.observe(document.documentElement)
  mo = new MutationObserver(measure)
  mo.observe(document.body, { childList: true, subtree: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollOrResize)
  window.removeEventListener('resize', onScrollOrResize)
  ro?.disconnect()
  mo?.disconnect()
})
</script>

<style scoped>
.psp-fade-enter-active,
.psp-fade-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.psp-fade-enter-from,
.psp-fade-leave-to     { opacity: 0; transform: translate(-50%, 8px); }
</style>
