<!--
  SaveGlyphHistoryPanel.vue — modal that opens when the user clicks the SEM
  App's Save / Get glyph (`*→[*]` / `[*]→*`).

  Per DD-001 (2026-05-13). The point is: the glyph is unfamiliar by design —
  it rejects the floppy-disc hand-me-down — so anyone who clicks it should be
  able to read the why on the spot and then Copy or Email the full reasoning
  to a colleague who asks the same question.

  Content source: src/composables/useSaveGlyphHistory.ts (which mirrors
  /Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/03Execution/Save-Glyph-History.md
  verbatim).

  Universal rules honoured:
    • CloseDot (never × / ✕) at the END of the header on dark gradient
    • ScrollContainer wraps the body region
    • Backdrop + Teleport-to-body for the modal pattern
    • Registered as an exclusive surface from App.vue
-->
<script setup lang="ts">
import { ref } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'
import {
  SAVE_GLYPH_TITLE,
  SAVE_GLYPH_SUBTITLE,
  SAVE_GLYPH_SECTIONS,
  getSaveGlyphHistoryText,
  buildSaveGlyphMailto,
} from '../composables/useSaveGlyphHistory'

defineEmits<{ close: []; 'open-symbol-family': [] }>()

// Transient ✓ flash on Copy success.
const _copied = ref(false)
const _copyError = ref('')

async function copyAll(): Promise<void> {
  _copyError.value = ''
  try {
    await navigator.clipboard.writeText(getSaveGlyphHistoryText())
    _copied.value = true
    setTimeout(() => { _copied.value = false }, 2200)
  } catch (err) {
    _copyError.value = err instanceof Error ? err.message : 'Clipboard unavailable'
  }
}

function emailAll(): void {
  // Hand the prebuilt mailto: URL to the OS default mail client.
  window.location.href = buildSaveGlyphMailto()
}

/**
 * Render a paragraph string that may contain backtick-delimited inline code
 * spans (e.g. "`* → [*]`" or "`*.txt`"). We split on backticks and emit each
 * even segment as plain text and each odd segment as <code>. Cheap, robust,
 * no v-html. If the user types an unbalanced backtick we just render the
 * stray characters verbatim, which is fine.
 */
function splitCodeSpans(text: string): Array<{ kind: 'text' | 'code'; v: string }> {
  const parts = text.split('`')
  return parts.map((v, i) => ({ kind: i % 2 === 0 ? 'text' : 'code', v }))
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[480] bg-black/40"
      aria-hidden="true"
      @click="$emit('close')"
    />

    <!-- Modal card — centred, fixed max-h so the body scrolls. -->
    <div
      class="fixed inset-0 z-[481] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      :aria-label="SAVE_GLYPH_TITLE"
    >
      <div
        class="pointer-events-auto w-full max-w-2xl max-h-[90vh] flex flex-col
               overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
      >
        <!-- ── Header (dark gradient, glyph + title + CloseDot) ───────────── -->
        <div
          class="flex items-center gap-3 px-5 py-3.5 shrink-0
                 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white"
        >
          <!-- The two glyphs side-by-side — the page's own subject. -->
          <span class="flex items-center gap-2 text-white" aria-hidden="true">
            <SaveGlyph size="standard" class="h-5 w-auto" />
            <span class="text-white/30 text-[10px] font-mono tracking-tight">·</span>
            <GetGlyph size="standard" class="h-5 w-auto" />
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold leading-tight truncate">About the Save glyph</p>
            <p class="text-[10px] text-white/55 leading-tight truncate">
              Why the SEM App uses <span class="font-mono">*→[*]</span> instead of a floppy disc.
            </p>
          </div>
          <CloseDot
            variant="on-dark"
            aria-label="Close Save Glyph history"
            @click="$emit('close')"
          />
        </div>

        <!-- ── Body (scrollable) ──────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative bg-slate-50"
          inner-class="h-full px-6 py-6 space-y-6"
        >
          <!-- Title block -->
          <header class="text-center">
            <p class="text-[20px] font-bold text-slate-900 leading-snug">
              The SEM App Save glyph
            </p>
            <p class="mt-1 text-[14px] font-mono text-slate-700">
              <span class="text-emerald-700">*→[*]</span>
              <span class="text-slate-400 mx-2">·</span>
              <span class="text-indigo-700">[*]→*</span>
            </p>
            <p class="mt-2 text-[12px] text-slate-500 italic max-w-md mx-auto leading-relaxed">
              {{ SAVE_GLYPH_SUBTITLE }}
            </p>
          </header>

          <!-- One card per HistorySection -->
          <section
            v-for="(sec, idx) in SAVE_GLYPH_SECTIONS"
            :key="idx"
            class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm"
          >
            <h3 class="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-2">
              {{ sec.heading }}
            </h3>
            <div class="space-y-3">
              <p
                v-for="(para, pIdx) in sec.paragraphs"
                :key="pIdx"
                class="text-[13px] text-slate-700 leading-relaxed"
              >
                <template v-for="(seg, sIdx) in splitCodeSpans(para)" :key="sIdx">
                  <code
                    v-if="seg.kind === 'code'"
                    class="font-mono text-[12.5px] rounded bg-slate-100 text-slate-800 px-1 py-0.5"
                  >{{ seg.v }}</code>
                  <template v-else>{{ seg.v }}</template>
                </template>
              </p>
            </div>
          </section>

          <!-- Footer attribution line, mirrored inside the doc -->
          <p class="text-center text-[11px] text-slate-400 italic pt-2 pb-1">
            Tom Gilb · 2026-05-13 · SEM App
          </p>
        </ScrollContainer>

        <!-- ── Footer actions: Copy + Email + Symbol Family ────────────────── -->
        <div
          class="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-slate-200
                 bg-white"
        >
          <!-- Symbol Family link — Tom 2026-05-15: "Family button at bottom of all individual glyphs" -->
          <button
            type="button"
            class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-semibold
                   text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-slate-300"
            title="See all five glyphs in the Gilb Symbol Family"
            @click="$emit('open-symbol-family')"
          >All five glyphs →</button>

          <span class="flex-1" />

          <!-- Copy -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                   text-[12px] font-semibold transition-colors
                   focus:outline-none focus:ring-2 focus:ring-slate-400"
            :class="_copied
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            @click="copyAll"
          >
            <span>{{ _copied ? '✓ Copied' : '📋 Copy' }}</span>
          </button>

          <!-- Email -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                   text-[12px] font-semibold transition-colors
                   bg-indigo-600 text-white hover:bg-indigo-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            @click="emailAll"
          >
            <span>✉ Email</span>
          </button>
        </div>

        <!-- Clipboard error (rare) -->
        <p
          v-if="_copyError"
          class="px-5 pb-2 text-[11px] text-red-500 italic"
        >⚠ {{ _copyError }}</p>
      </div>
    </div>
  </Teleport>
</template>
