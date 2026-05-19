<!-- UNIT_TYPE=Surface -->
<!-- InputSafetyNetToast — the visible half of the SEM Input Safety Net.
     Origin: Tom 2026-05-14 — Claudian's chat input wiped his Anthropic offer
     twice in one session with no ⌘Z recovery. Tom: "inadequate design."

     Behaviour:
       • Listens to the singleton `oopsOffer` from useInputSafetyNet().
       • When an offer is raised (the user just lost ≥50% of a ≥5-word draft),
         the toast slides up from the bottom-centre of the viewport.
       • Three recovery paths, all wired to the same restore action:
           1. Click "Restore" button on the toast
           2. Press ⌘Z (or Ctrl+Z) anywhere in the app — handled globally
              by the composable
           3. Say "Yes" — voice handler dispatches `safety-net:yes`
              CustomEvent on window
       • Dismiss with the CloseDot or the "I meant to clear" button.
       • Stays visible until the user resolves it (no auto-dismiss). Losing
         a draft is high-importance; we don't sneak the recovery offer past
         them on a 2-second timer.
     z-tier: 900 (critical announcement — sits above all major surfaces
     500 and the SelectionDefiner 700, but below the SOS recovery layer
     10000). -->

<script setup lang="ts">
import { computed } from 'vue'
import CloseDot from './CloseDot.vue'
import { useInputSafetyNet } from '../composables/useInputSafetyNet'

const { oopsOffer, restoreOops, dismissOops } = useInputSafetyNet()

/** Truncated single-line preview of the recoverable text. */
const preview = computed<string>(() => {
  const t = oopsOffer.value?.snapshot.text ?? ''
  const oneLine = t.replace(/\s+/g, ' ').trim()
  return oneLine.length > 96 ? oneLine.slice(0, 93) + '…' : oneLine
})

const wordCount = computed<number>(() => oopsOffer.value?.snapshot.words ?? 0)

/** Format "captured 12 s ago" / "captured 2 min ago" etc. */
const capturedAgo = computed<string>(() => {
  const t = oopsOffer.value?.snapshot.capturedAt
  if (!t) return ''
  const secs = Math.max(1, Math.round((Date.now() - t) / 1000))
  if (secs < 60) return `${secs} s ago`
  const mins = Math.round(secs / 60)
  return `${mins} min ago`
})
</script>

<template>
  <Transition name="safety-net">
    <div
      v-if="oopsOffer"
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="safety-net-title"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900]
             w-[min(28rem,calc(100vw-2rem))]
             rounded-2xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10
             overflow-hidden"
    >
      <!-- Header strip -->
      <div class="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-2">
        <span class="text-lg leading-none" aria-hidden="true">🛟</span>
        <span id="safety-net-title" class="flex-1 text-sm font-semibold">
          Oops — looks like you may have lost what you wrote
        </span>
        <CloseDot
          variant="on-dark"
          aria-label="Close safety net offer"
          title="Dismiss without restoring"
          @click="dismissOops"
        />
      </div>

      <!-- Body -->
      <div class="px-4 py-3 space-y-3">
        <p class="text-xs text-slate-300">
          We saved a copy of what you wrote
          <span class="text-slate-100 font-medium">{{ capturedAgo }}</span>
          ({{ wordCount }} words). You can put it back.
        </p>

        <!-- Preview card -->
        <blockquote
          class="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-xs italic text-slate-200"
        >“{{ preview }}”</blockquote>

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-1">
          <button
            type="button"
            class="flex-1 min-h-[40px] rounded-lg bg-emerald-500 hover:bg-emerald-400
                   px-3 py-2 text-sm font-semibold text-slate-900
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-emerald-300 transition-colors"
            @click="restoreOops"
          >
            ↩ Restore
          </button>
          <button
            type="button"
            class="min-h-[40px] rounded-lg bg-slate-700 hover:bg-slate-600
                   px-3 py-2 text-xs font-medium text-slate-100
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-slate-300 transition-colors"
            @click="dismissOops"
          >
            I meant to clear
          </button>
        </div>

        <!-- Hint row -->
        <p class="text-[11px] text-slate-400 leading-relaxed">
          Tip: press
          <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">⌘Z</kbd>
          or say
          <span class="italic">“Yes”</span>
          to restore.
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.safety-net-enter-active {
  animation: safety-net-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.safety-net-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.safety-net-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
@keyframes safety-net-in {
  0%   { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.96); }
  60%  { opacity: 1; transform: translateX(-50%) translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);    }
}
</style>
