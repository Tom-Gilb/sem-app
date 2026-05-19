<!-- RightPanel.vue — shared positioning shell for all right-side drawers.
     Bakes in: fixed top-0 right-0 bottom-20
     The 80px gap at the bottom keeps the Detail button (right-6 bottom-6) always visible.

     Usage: pass width, z-index, bg, shadow, ARIA attrs, and role as normal class/attrs.
     When panelId is supplied, this panel participates in focus mode:
       • Normal: fixed right-side drawer (caller's class applied)
       • Focused: centered floating panel above the blur backdrop (z-[920])
         Caller's layout classes are replaced by focus-mode geometry.

     Adding a new right-side panel? Use <RightPanel class="z-[X] w-[Y] ...">
     For focus mode: also pass panelId="unique-id" and wire enter()/exit() from useFocusMode. -->
<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useFocusMode } from '../composables/useFocusMode'

// Opt out of automatic attr inheritance — we handle it manually so we can
// suppress the caller's layout classes when focus mode is active.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** Opt-in to focus mode by supplying a unique panel ID. */
  panelId?: string
}>()

const attrs = useAttrs()
const { isFocusedPanel, onActivity } = useFocusMode()

const isFocused = computed(() => !!props.panelId && isFocusedPanel(props.panelId))

// When focused: drop the caller's layout class (width, z-index, position overrides)
// but keep all semantic attrs (role, aria-*, data-*) so accessibility is preserved.
const passthroughAttrs = computed(() => {
  if (!isFocused.value) return attrs
  const { class: _class, ...rest } = attrs as Record<string, unknown>
  return rest
})

// Reset inactivity timer on any pointer or key interaction inside the panel.
function handleActivity(): void {
  if (isFocused.value) onActivity()
}
</script>

<template>
  <div
    v-bind="passthroughAttrs"
    :class="isFocused
      ? [
          'fixed top-1/2 left-1/2',
          '-translate-x-1/2 -translate-y-1/2',
          'w-[min(860px,92vw)] max-h-[85vh]',
          'z-[920]',
          'flex flex-col overflow-hidden',
          'rounded-2xl',
          'shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_40px_100px_rgba(0,0,0,0.65),0_0_60px_rgba(99,102,241,0.10)]',
          'ring-1 ring-indigo-400/20',
          'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        ]
      : [
          'fixed top-0 right-0 bottom-20',
          'transition-all duration-300',
        ]"
    @pointerdown="handleActivity"
    @keydown.capture="handleActivity"
  >
    <slot />
  </div>
</template>
