<!-- FocusModeBackdrop.vue — full-viewport blur overlay for focus mode.
     z-[880]: above all normal UI, below the focused panel (z-[920]).

     Behaviour:
       • Fades in/out when focus mode activates/deactivates
       • Click-to-exit anywhere on the dim layer
       • Escape key exits from anywhere on the page
       • Countdown chip appears in the final 10 seconds:
           – SVG ring drains as time runs out (indigo → amber → red)
           – "Pin to stay" button pauses the timer indefinitely -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useFocusMode } from '../composables/useFocusMode'

const { active, secsLeft, showCountdown, pinned, exit, togglePin } = useFocusMode()

// ── Escape key ────────────────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && active.value) exit()
}
onMounted(()  => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// ── SVG countdown ring ────────────────────────────────────────────────────────
// Circle r=45 → circumference = 2π×45 ≈ 283px
// stroke-dasharray drains from 283 (full) to 0 over 10 seconds.

const CIRC = 283

const ringDash = computed(() => `${(secsLeft.value / 10) * CIRC} ${CIRC}`)

const ringColor = computed(() => {
  if (secsLeft.value <= 3) return '#ef4444'  // red-500
  if (secsLeft.value <= 6) return '#f59e0b'  // amber-400
  return '#6366f1'                            // indigo-500
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop fade -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="active"
        class="fixed inset-0 z-[880] bg-black/55 backdrop-blur-[5px]"
        aria-hidden="true"
        @click="exit"
      >
        <!-- Countdown chip — bottom-centre, visible only in final 10 seconds -->
        <Transition
          enter-active-class="transition-all duration-250 ease-out"
          enter-from-class="opacity-0 scale-90 translate-y-2"
          leave-active-class="transition-all duration-150 ease-in"
          leave-to-class="opacity-0 scale-90 translate-y-2"
        >
          <div
            v-if="showCountdown"
            class="absolute bottom-8 left-1/2 -translate-x-1/2
                   flex items-center gap-3
                   bg-gray-900/90 backdrop-blur-sm
                   rounded-2xl px-5 py-3 shadow-2xl
                   pointer-events-auto select-none"
            @click.stop
          >
            <!-- Draining SVG ring (rotated so arc starts at top) -->
            <svg
              width="36" height="36" viewBox="0 0 100 100"
              class="-rotate-90 flex-shrink-0"
              aria-hidden="true"
            >
              <!-- Track -->
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                stroke-width="9"
              />
              <!-- Draining arc -->
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                :stroke="ringColor"
                stroke-width="9"
                stroke-linecap="round"
                :stroke-dasharray="ringDash"
                style="transition: stroke-dasharray 0.85s linear, stroke 0.4s ease"
              />
            </svg>

            <!-- Label + pin toggle -->
            <div class="flex items-center gap-2 text-white text-sm font-medium leading-none whitespace-nowrap">
              <span>Closing in <strong>{{ secsLeft }}s</strong></span>
              <span class="opacity-30">·</span>
              <button
                type="button"
                class="text-indigo-300 hover:text-white transition-colors underline underline-offset-2 text-sm font-medium"
                :title="pinned ? 'Unpin — resume countdown' : 'Pin — pause timer indefinitely'"
                @click.stop="togglePin"
              >
                {{ pinned ? 'Unpin' : '📌 Pin to stay' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
