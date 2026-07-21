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
  <!-- r41 2026-06-20 (Tom Gilb verbatim "scroll button is still far to
       right, need to be next to right of text") — pin now anchors to the
       RIGHT EDGE OF CONTENT, not the right edge of the viewport.  On a
       2048 px viewport with max-w-7xl (1280 px) content centred, there
       was ~384 px of empty whitespace between the content's right edge
       and the previous `right-3` viewport-edge position.  Fix: wrap the
       pill in a fixed-band centred container at `max-w-7xl` width with
       `flex justify-end`, so the pill aligns with the content column.
       Falls back gracefully on narrower viewports (no whitespace to
       cross — pill just sits at the right edge as before).  Composes
       with: Desktop-First Responsive Design rule (max-w-7xl matches the
       content; iPhone unaffected since it's never wider than 7xl). -->
  <Transition name="psp-fade">
    <div
      v-if="visible"
      class="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
      role="status"
      aria-live="polite"
      :aria-label="`Page scroll bar: ${pctShown}% of page visible, scrolled ${pctScrolled}% through`"
    >
      <!-- r41 v224 (Tom Gilb verbatim "as I mentioned 5 times the last 2 hours,
           that scroll is at extreme right and hiding upo, and there is no
           Scroll bar below etc") — PageScrollPin redesigned as an actual
           BOTTOM SCROLL BAR, not a corner pill:
           • BOTTOM-CENTER position (translate-x-1/2) so it's read as a
             scroll-bar affordance, not a corner badge.
           • BOTH ⬆ and ⬇ buttons always rendered (disabled when at the
             extreme) so Tom never wonders if the affordance is there.
           • Bigger hit targets (h-10 w-12) per accessibility_tom.md (Tom 85).
           • animate-bounce dropped — the bounce read as a transient toast.
             A scroll bar should be a stable, predictable surface.
           • Label kept compact in the centre so the arrows dominate visually.
           Composes with: MOVE Principle (always visible from first paint),
           DD-009 Zero-Training UI (HoverHint spells out behaviour),
           accessibility_tom.md (big buttons, no auto-hide, no animation
           competing with the workflow), Icon-Plus-Text SUPREME (glyph +
           verbal label "Top" / "Bottom" optional via HoverHint, glyph is
           large universal ⬆/⬇ per DD-015). -->
      <!-- r41 v226 (Tom Gilb verbatim "i did mention this overlap earlier.
           Can you do anything to avoid blocking buttons and their text?") —
           v224 redesign DID position the pin bottom-center as Tom asked,
           but the opaque slate-900 background blocked content underneath
           (footer + mid-page buttons at viewport y=824).  Three changes
           to address blocking WITHOUT regressing the v224 "no scroll bar
           below" complaint:
             1) Background TRANSLUCENT (bg-slate-900/75 + backdrop-blur-sm)
                so content shows through.
             2) Pin smaller (h-9 buttons, tighter padding) so the BLOCKED
                AREA is minimised — same affordances, less real estate.
             3) On hover, pin background fades further (bg-slate-900/40)
                so deliberate inspection of content underneath is one
                quick mouseover away. -->
      <!-- r41 v260 (Tom Gilb 2026-06-21 verbatim "the scroll and button overlap, old bug")
           — RECURRING issue (v224 / v226 / now v260).  Previous fixes (translucent bg +
           tighter padding) reduced visual blocking but the inner pill still CAPTURES
           CLICKS via pointer-events-auto, so any content button under the pin's footprint
           is unclickable.  v260 fix: on group-hover, drop pointer-events to NONE on the
           inner pill — clicks pass through to content underneath.  Pin still clickable
           when NOT hovered (the user reaches for it deliberately).  Hover also bumps
           opacity to 0.25 so the user can SEE what they're about to click underneath.
           Composes with: MOVE Principle (still visible at-a-glance pre-hover), DD-009,
           accessibility_tom.md, Tom-Repeats-Himself SUPREME (third turn on this overlap). -->
      <div class="pointer-events-auto select-none group">
        <div
          class="flex items-center gap-0.5 rounded-2xl bg-slate-900/75 group-hover:bg-slate-900/15
                 group-hover:pointer-events-none
                 backdrop-blur-sm text-white shadow-2xl ring-2 ring-amber-400/70
                 px-1 py-1 transition-all duration-150"
        >
          <!-- ⬆ Top button — ALWAYS rendered, disabled when already at top -->
          <button
            type="button"
            class="h-9 w-10 flex items-center justify-center rounded-xl bg-white/10
                   hover:bg-white/25 active:bg-white/30
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
                   disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10
                   transition-colors"
            :disabled="!hasLess"
            :title="hasLess ? '⬆ Top — scroll to the top of the page' : '⬆ Already at the top of the page'"
            :aria-label="hasLess ? 'Jump to top of page' : 'Already at top of page'"
            @click="scrollToTop"
          >
            <span class="text-lg leading-none" aria-hidden="true">⬆</span>
          </button>

          <!-- Centre label — scroll position + length -->
          <span
            class="px-1.5 text-[10px] font-semibold whitespace-nowrap leading-tight"
            :title="`${pctShown}% of the page height is in the viewport · scrolled ${pctScrolled}% through`"
          >
            {{ pctShown }}% of page
          </span>

          <!-- ⬇ Bottom button — ALWAYS rendered, disabled when already at bottom -->
          <button
            type="button"
            class="h-9 w-10 flex items-center justify-center rounded-xl bg-white/10
                   hover:bg-white/25 active:bg-white/30
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
                   disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10
                   transition-colors"
            :disabled="!hasMore"
            :title="hasMore ? '⬇ Bottom — scroll to the end of the page' : '⬇ Already at the bottom of the page'"
            :aria-label="hasMore ? 'Jump to bottom of page' : 'Already at bottom of page'"
            @click="scrollToBottom"
          >
            <span class="text-lg leading-none" aria-hidden="true">⬇</span>
          </button>
        </div>
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
