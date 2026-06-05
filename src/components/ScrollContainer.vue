<!-- UNIT_TYPE=Widget -->
<!-- Scroll-more indicator wrapper.
     Wraps any bounded scroll area with a bottom fade + bouncing "↓ scroll" badge
     that disappears once the user has scrolled to the end.

     Usage:
       <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-4 py-4">
         …content…
       </ScrollContainer>

     outerClass  — classes on the positioning wrapper (flex-1, min-h-0, max-h-*, etc.)
     innerClass  — classes on the scrollable div (padding, h-full, space-y-*, divide-*, etc.)
     innerStyle  — inline style string for the scrollable div (e.g. max-height with CSS min())
     fadeFrom    — CSS colour for the bottom fade gradient (e.g. 'white', '#fffbeb')
-->
<template>
  <!-- The outer div must be a CSS positioning context (position ≠ static) so the absolute indicator overlay
       lands at the correct spot. Callers using "flex-1 min-h-0" pass "relative" in outer-class.
       Callers with "absolute"/"fixed" are already positioning contexts — no extra class needed. -->
  <div v-bind="attrs" :class="outerClass" :style="outerStyle || undefined">
    <div
      ref="scrollEl"
      class="overflow-y-auto"
      :class="innerClass"
      :style="innerStyle || undefined"
      @scroll.passive="check"
    >
      <slot />
    </div>

    <!-- TOP indicator — shows when scrolled down (content exists above) -->
    <Transition name="si">
      <div
        v-if="hasLess"
        class="absolute top-0 left-0 right-0 h-14 pointer-events-none z-10"
        aria-hidden="true"
      >
        <div
          class="absolute inset-0"
          :style="`background: linear-gradient(to bottom, ${fadeFrom} 30%, transparent 100%)`"
        />
        <div v-if="!noPill" class="absolute top-2 left-0 right-0 flex justify-center">
          <div
            class="flex items-center gap-1 rounded-full bg-gray-800 text-white text-[10px] font-semibold px-2.5 py-1 shadow-lg animate-bounce"
          >
            <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M14.78 11.78a.75.75 0 0 1-1.06 0L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06z"
                clip-rule="evenodd" />
            </svg>
            <span>scroll</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- BOTTOM indicator — shows when more content exists below -->
    <Transition name="si">
      <div
        v-if="hasMore"
        class="absolute bottom-0 left-0 right-0 h-14 pointer-events-none z-10"
        aria-hidden="true"
      >
        <!-- Gradient fade — solid at bottom 30%, fades to transparent -->
        <div
          class="absolute inset-0"
          :style="`background: linear-gradient(to top, ${fadeFrom} 30%, transparent 100%)`"
        />
        <!-- Visible scroll badge: dark pill with chevron + "scroll" label.
             Suppressed when noPill is true (gradient fade still shows).
             Shows ↕ when in the middle (hasLess AND hasMore), ↓ when at the top (only hasMore). -->
        <div v-if="!noPill" class="absolute bottom-2 left-0 right-0 flex justify-center">
          <div
            class="flex items-center gap-1 rounded-full bg-gray-800 text-white text-[10px] font-semibold px-2.5 py-1 shadow-lg animate-bounce"
          >
            <!-- Up-down arrows when in the middle (content both above and below) -->
            <svg v-if="hasLess" class="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M10 3a.75.75 0 0 1 .53.22l3.5 3.5a.75.75 0 0 1-1.06 1.06L10 4.81 7.03 7.78a.75.75 0 0 1-1.06-1.06l3.5-3.5A.75.75 0 0 1 10 3zm-3.47 9.22a.75.75 0 0 1 1.06 0L10 15.19l2.97-2.97a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 0-1.06z"
                clip-rule="evenodd" />
            </svg>
            <!-- Down arrow only when at the top (only hasMore) -->
            <svg v-else class="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
                clip-rule="evenodd" />
            </svg>
            <span>scroll</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, useAttrs } from 'vue'
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()

const props = withDefaults(defineProps<{
  /** Classes for the outer positioning wrapper (flex-1, min-h-0, max-h-*, etc.) */
  outerClass?: string
  /** Inline style string for the outer wrapper (e.g. max-height with a CSS min() function) */
  outerStyle?: string
  /** Classes for the scrollable inner div (h-full, padding, space-y, divide-y, etc.) */
  innerClass?: string
  /** Inline style string for the scrollable inner div (e.g. max-height with CSS min()) */
  innerStyle?: string
  /** CSS colour for the bottom fade gradient (e.g. 'white', '#fffbeb', 'rgb(255,255,255)') */
  fadeFrom?: string
  /** When true, shows only the gradient fade — no dark pill badge. Use inside panels
   *  where interactive content near the bottom must stay fully visible (e.g. modals,
   *  drawers with button rows at the bottom). */
  noPill?: boolean
}>(), {
  outerClass: '',
  outerStyle: '',
  innerClass: '',
  innerStyle: '',
  fadeFrom: 'white',
  noPill: false,
})

const scrollEl = ref<HTMLElement | null>(null)
const hasMore   = ref(false)
const hasLess   = ref(false)

function check() {
  const el = scrollEl.value
  if (!el) return
  // 4px tolerance avoids lingering indicator on sub-pixel rounding
  hasMore.value = el.scrollHeight - el.scrollTop - el.clientHeight > 4
  hasLess.value = el.scrollTop > 4
}

let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null

onMounted(async () => {
  // nextTick ensures the browser has resolved flex/h-full layout before we measure
  await nextTick()
  check()
  if (scrollEl.value) {
    // ResizeObserver: fires when the scroll element itself changes size (max-h cases)
    ro = new ResizeObserver(check)
    ro.observe(scrollEl.value)
    // MutationObserver: fires when slot content is added/removed (h-full cases where
    // the scroll element's own size never changes but its content grows)
    mo = new MutationObserver(check)
    mo.observe(scrollEl.value, { childList: true, subtree: true, characterData: true })
  }
})

onUnmounted(() => {
  ro?.disconnect()
  mo?.disconnect()
})

/** Expose the native inner HTMLElement so callers can programmatically scrollTo() it */
defineExpose({
  get el(): HTMLElement | null { return scrollEl.value ?? null }
})
</script>

<style scoped>
.si-enter-active,
.si-leave-active { transition: opacity 150ms ease; }
.si-enter-from,
.si-leave-to     { opacity: 0; }
</style>
