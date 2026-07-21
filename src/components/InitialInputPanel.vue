<!-- UNIT_TYPE=Panel -->
<!--
 * InitialInputPanel.vue — read-only viewer for the raw text the planner
 * pasted / fetched / uploaded BEFORE any parse or AI transform ran.
 *
 * Tom Gilb 2026-06-19 verbatim: "INITIAL SPECS: I went back I I could
 * not find the initial input, often displayed before, where is it, do I
 * start again by putting it in? A thought it could be saved immediately
 * as initial input for both recovery, and for later analysis and
 * comparison (with what has transpired), Do that."
 *
 * What this panel shows:
 *   • The captured raw text (read-only, scrollable, word-wrapped).
 *   • Capture metadata: mode (Text / URL / File), source (URL or file
 *     name when relevant), timestamp.
 *   • Two actions: Copy (clipboard) + Close.
 *
 * What this panel does NOT do (deferred):
 *   • Re-parse — the planner can copy the text and paste it back into
 *     the Get-A-Spec Text tab; a dedicated "Re-parse with this input"
 *     button is a follow-up rev.
 *   • Compare-with-current-spec — a future rev wires a side-by-side
 *     diff between the captured input and the current spec entries.
 *
 * Composes with: ScrollContainer Rule, CloseDot Rule, Single-Surface
 * Rule (registered in App.vue), Icon-Plus-Text SUPREME, DD-009 Zero-
 * Training UI, Twin portability (pure presentational + emit-only).
 -->
<script setup lang="ts">
import { computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import type { InitialInputSnapshot } from '../composables/useInitialInput'

const props = defineProps<{
  open:     boolean
  snapshot: InitialInputSnapshot | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const modeLabel = computed<string>(() => {
  switch (props.snapshot?.mode) {
    case 'text': return 'Pasted text'
    case 'url':  return 'Fetched URL'
    case 'file': return 'Uploaded file'
    default:     return 'Unknown'
  }
})

const formattedDate = computed<string>(() => {
  if (!props.snapshot?.capturedAt) return ''
  try {
    const d = new Date(props.snapshot.capturedAt)
    return d.toLocaleString()
  } catch { return props.snapshot.capturedAt }
})

async function copyText(): Promise<void> {
  if (!props.snapshot?.text) return
  try {
    await navigator.clipboard.writeText(props.snapshot.text)
  } catch { /* permission denied — non-fatal */ }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initial-input-title"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
          <span aria-hidden="true" class="text-xl leading-none">📄</span>
          <div class="flex-1 min-w-0">
            <h2 id="initial-input-title" class="text-base font-bold leading-tight">
              Initial Input
            </h2>
            <p class="text-[11px] text-white/85 mt-0.5">
              The raw text you pasted, fetched, or uploaded — captured at parse time for recovery, analysis, and comparison.
            </p>
          </div>
          <CloseDot size="lg" aria-label="Close Initial Input" @close="emit('close')" />
        </header>

        <!-- Empty state -->
        <div v-if="!snapshot" class="p-12 text-center text-slate-400">
          <p class="text-sm">No initial input was captured for this spec.</p>
          <p class="text-xs mt-2">Parse a fresh input via <strong>Get A Spec → Text / URL / File</strong> and it will be captured here automatically.</p>
        </div>

        <!-- Metadata + body -->
        <template v-else>
          <div class="px-5 py-2 text-xs text-slate-600 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span><strong>Mode:</strong> {{ modeLabel }}</span>
            <span v-if="snapshot.source"><strong>Source:</strong> {{ snapshot.source }}</span>
            <span><strong>Captured:</strong> {{ formattedDate }}</span>
            <span><strong>Size:</strong> {{ snapshot.text.length.toLocaleString() }} chars</span>
          </div>

          <ScrollContainer class="flex-1 min-h-0" inner-class="p-5">
            <pre
              class="text-sm text-slate-800 whitespace-pre-wrap break-words font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-4"
              aria-label="Captured initial input text — read only"
            >{{ snapshot.text }}</pre>
          </ScrollContainer>
        </template>

        <!-- Footer -->
        <footer class="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
          <p class="text-[10px] text-slate-400 italic">
            Stored locally per spec — survives reloads.  To re-parse, copy the text and paste it back into Get A Spec → Text.
          </p>
          <button
            type="button"
            class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :disabled="!snapshot?.text"
            title="Copy the captured text to the clipboard."
            @click="copyText"
          >📋 Copy to clipboard</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
