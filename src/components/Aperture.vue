<script setup lang="ts">
// UNIT_TYPE=Vue Component
// Aperture — Ultra Light Phase 3 "Naked Plan" view.
// Tom calls it "Apperture" (his joke name, double-p intentional).
//
// Tom 2026-05-14: *"white out everything except the input/output —
// ear/eye/mouth — a beautifully crafted aperture, inviting dialogue."*
//
// Tom 2026-05-15 round 1: Done button, voice 'Done', sending pulse.
// Tom 2026-05-15 round 2:
//   (a) Plain Enter always submits (removed `!includes('\n')` guard so voice-
//       dictated multi-line text can be committed with a single Enter press).
//   (b) Auto-height textarea — grows with content, font shrinks for long text,
//       scrolls inside the oval so no character is ever hidden.
//   (c) Routes through SEMEntryForm Parse, not direct generation — emits 'parse'
//       instead of 'submit' so App.vue can pre-fill + trigger the chip review.
//
// Submit triggers (all route through the 'parse' emit):
//   • ↵ Enter           — single-line OR after Shift+Enter newline
//   • ⌘↵ / Ctrl+↵       — always
//   • Click "Done" pill
//   • window CustomEvent 'aperture:submit'  (voice "Done" / "Submit")

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import AmuseMeButton from './AmuseMeButton.vue'

const props = withDefaults(defineProps<{
  /** True while the App is generating — well pulses, done button hides */
  isGenerating?: boolean
}>(), {
  isGenerating: false,
})

const emit = defineEmits<{
  /** Emitted when the user commits — App.vue routes this through SEMEntryForm Parse */
  parse: [text: string]
}>()

const text    = ref('')
const ta      = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)

const hasText = computed(() => text.value.trim().length > 0)
const busy    = computed(() => sending.value || props.isGenerating)

// ── Dynamic font size — shrink so long dictated text stays readable ──────────
const fontClass = computed(() => {
  const n = text.value.length
  if (n <= 80)  return 'text-xl md:text-2xl'
  if (n <= 200) return 'text-lg md:text-xl'
  if (n <= 400) return 'text-base md:text-lg'
  return 'text-sm md:text-base'
})

// ── Auto-height textarea ─────────────────────────────────────────────────────
// Grows from 2 rows to a cap of ~220px (≈ 35 % of the oval at 86 vw).
// After that, the textarea scrolls internally — no character is ever clipped.
const MAX_TA_HEIGHT = 220   // px

function autoResize(): void {
  const el = ta.value
  if (!el) return
  el.style.height = 'auto'
  const target = Math.min(el.scrollHeight, MAX_TA_HEIGHT)
  el.style.height = `${target}px`
}

watch(text, () => nextTick(autoResize))

// ── Submit ───────────────────────────────────────────────────────────────────
function send(): void {
  const v = text.value.trim()
  if (!v || busy.value) return
  sending.value = true
  emit('parse', v)
  // Component unmounts almost immediately (App.vue calls setView('full')).
  // `sending` is a one-tick visual flag so the user sees the pulse registered.
}

function onKey(e: KeyboardEvent): void {
  // ⌘/Ctrl+Enter always sends.
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    send()
    return
  }
  // Plain Enter sends — whether single-line or after voice-dictated newlines.
  // Shift+Enter inserts a newline (for rare intentional line breaks).
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

// ── Voice / external trigger ─────────────────────────────────────────────────
function _onExternalSubmit(): void { send() }

onMounted(async () => {
  await nextTick()
  ta.value?.focus()
  autoResize()
  window.addEventListener('aperture:submit', _onExternalSubmit)
})

onUnmounted(() => {
  window.removeEventListener('aperture:submit', _onExternalSubmit)
})
</script>

<template>
  <!--
    Fixed full-viewport white canvas. z-[350] sits above the persistent app
    chrome (identity bar 100–300) but BELOW major surfaces (380–500).
    The Define-by-Selection layer (700) stays above per the Universal Rule.
  -->
  <div
    class="fixed inset-0 z-[350] bg-white flex items-center justify-center select-none"
    aria-label="Apperture — speak, type, or listen"
  >
    <div class="relative w-[min(86vw,720px)] aspect-[1.35/1] flex items-center justify-center select-text">

      <!-- Outer halo -->
      <div
        class="absolute inset-0 rounded-full pointer-events-none"
        style="background: radial-gradient(closest-side, rgba(15,23,42,0.05), rgba(15,23,42,0) 72%);"
      ></div>

      <!-- The aperture well — pulses indigo when busy -->
      <div
        class="absolute inset-[6%] rounded-full transition-all duration-500"
        :class="busy ? 'animate-pulse' : ''"
        :style="busy
          ? 'background: radial-gradient(closest-side at 50% 44%, #eff6ff, #dbeafe 68%, #bfdbfe 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 0 1px rgba(99,102,241,0.15), 0 30px 60px -30px rgba(15,23,42,0.18);'
          : 'background: radial-gradient(closest-side at 50% 44%, #ffffff, #f8fafc 68%, #e2e8f0 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -40px 80px rgba(15,23,42,0.05), inset 0 0 0 1px rgba(15,23,42,0.06), 0 30px 60px -30px rgba(15,23,42,0.18);'"
      ></div>

      <!-- Iris-leaf strokes — spins slowly when busy -->
      <svg
        class="absolute inset-[6%] pointer-events-none transition-all duration-700"
        :class="busy ? 'animate-spin [animation-duration:8s] opacity-30' : 'opacity-100'"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="rgba(15,23,42,0.045)" stroke-width="0.4" stroke-linecap="round">
          <line x1="50" y1="6"  x2="50" y2="94" />
          <line x1="6"  y1="50" x2="94" y2="50" />
          <line x1="16" y1="16" x2="84" y2="84" />
          <line x1="84" y1="16" x2="16" y2="84" />
        </g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(15,23,42,0.05)" stroke-width="0.3" />
      </svg>

      <!-- Content layer -->
      <div class="relative z-10 w-[78%] flex flex-col items-center text-center gap-0">

        <!-- ── Thinking state ──────────────────────────────────────── -->
        <div v-if="busy" class="w-full flex flex-col items-center gap-2">
          <p class="text-xl text-indigo-500 font-light tracking-wide animate-pulse">
            Thinking…
          </p>
          <p class="text-[11px] uppercase tracking-[0.22em] text-indigo-400/70 mt-1">
            your Apperture is working
          </p>
          <!-- AmuseMeButton: Apperture spec generation takes 20–60s -->
          <AmuseMeButton :is-loading="busy" class="w-full mt-2" />
        </div>

        <!-- ── Normal input state ─────────────────────────────────── -->
        <template v-else>
          <!--
            Textarea: auto-height up to MAX_TA_HEIGHT px, then scrolls.
            Font shrinks dynamically with text length.
            overflow-y-auto is intentional — ScrollContainer not needed
            here because this is a raw <textarea> sizing itself, not a
            layout scroll region.
          -->
          <textarea
            ref="ta"
            v-model="text"
            spellcheck="true"
            placeholder="What is important to improve?"
            class="
              w-full bg-transparent
              text-slate-800 placeholder-slate-400
              text-center
              resize-none focus:outline-none
              leading-relaxed
              caret-slate-500
              overflow-y-auto
              transition-[font-size] duration-200
            "
            :class="fontClass"
            style="min-height: 2.5em;"
            @keydown="onKey"
            @input="autoResize"
          />

          <!-- Hint + controls -->
          <div class="mt-3 flex flex-col items-center gap-1.5">

            <div class="text-[11px] uppercase tracking-[0.22em] text-slate-400">
              speak · type · listen
            </div>

            <!-- Keyboard hint — fades in when text is present -->
            <div
              class="text-[10px] text-slate-400/60 tracking-wide transition-opacity duration-300"
              :class="hasText ? 'opacity-100' : 'opacity-0'"
              aria-hidden="true"
            >
              ↵ Enter · ⌘↵ always works
            </div>

          </div>

          <!-- Done pill — appears when there is text -->
          <button
            v-if="hasText"
            id="apperture-done-btn"
            type="button"
            aria-label="Submit — Done"
            title="Submit (↵ Enter · ⌘↵)"
            class="
              mt-3
              inline-flex items-center gap-1.5
              px-5 py-1.5
              rounded-full
              bg-slate-800 text-white
              text-sm font-medium
              shadow-md
              transition-all duration-150
              hover:bg-indigo-600 hover:shadow-lg hover:scale-105
              focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
              active:scale-100 active:bg-indigo-700
            "
            @click="send"
          >
            <span aria-hidden="true" class="text-xs">↵</span>
            Done
          </button>

          <div v-else class="mt-3 h-[34px]" aria-hidden="true"></div>

          <!-- Apperture name — Tom's joke label -->
          <div class="mt-1 text-[9px] uppercase tracking-[0.35em] text-slate-300 select-none">
            Apperture
          </div>
        </template>

      </div>
    </div>
  </div>
</template>
