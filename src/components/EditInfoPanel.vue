<!--
  EditInfoPanel.vue — modal that opens when the user clicks the `?`
  affordance attached to the Edit keyed icon `[*]→[**]`, or via the
  ⌘F palette "About the Edit Glyph", or via the Detail-menu About row.

  Content source: src/composables/useAboutEditGlyph.ts

  Universal rules honoured:
    • CloseDot at END of header on dark gradient
    • ScrollContainer wraps the body region
    • Backdrop + Teleport-to-body for the modal pattern
    • Registered as an exclusive surface from App.vue

  z-tiers: backdrop z-[482], card z-[483] — same tier as PriorityInfoPanel.
  Header gradient: slate — from-slate-700 via-slate-800 to-gray-900.
-->
<script setup lang="ts">
import { ref } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EditGlyph from './icons/EditGlyph.vue'
import {
  EDIT_GLYPH_TITLE,
  EDIT_GLYPH_SUBTITLE,
  EDIT_GLYPH_SECTIONS,
  getAboutEditGlyphText,
  buildAboutEditGlyphMailto,
} from '../composables/useAboutEditGlyph'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

// Transient ✓ flash on Copy success.
const _copied = ref(false)
const _copyError = ref('')

async function copyAll(): Promise<void> {
  _copyError.value = ''
  try {
    await navigator.clipboard.writeText(getAboutEditGlyphText())
    _copied.value = true
    setTimeout(() => { _copied.value = false }, 2200)
  } catch (err) {
    _copyError.value = err instanceof Error ? err.message : 'Clipboard unavailable'
  }
}

function emailAll(): void {
  window.location.href = buildAboutEditGlyphMailto()
}

/**
 * Render a paragraph that may contain backtick-delimited inline code spans.
 * Mirrors splitCodeSpans in PriorityInfoPanel. No v-html.
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
      class="fixed inset-0 z-[482] bg-black/40"
      aria-hidden="true"
      @click="$emit('close')"
    />

    <!-- Modal card — centred, fixed max-h so the body scrolls. -->
    <div
      class="fixed inset-0 z-[483] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      :aria-label="EDIT_GLYPH_TITLE"
    >
      <div
        class="pointer-events-auto w-full max-w-2xl max-h-[90vh]
               overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
      >
        <!-- ── Header (dark slate gradient, glyph + title + Copy + CloseDot) ── -->
        <div
          class="flex items-center gap-3 px-5 py-3.5 shrink-0
                 bg-gradient-to-r from-slate-700 via-slate-800 to-gray-900 text-white"
        >
          <span class="flex items-center text-white" aria-hidden="true">
            <EditGlyph size="standard" class="h-6 w-auto text-white" />
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold leading-tight truncate">About the Edit Glyph</p>
            <p class="text-[10px] text-white/55 leading-tight truncate">
              Why the SEM App uses <span class="font-mono">[*]→[**]</span> as the keyed icon for editing.
            </p>
          </div>
          <!-- Header Copy — icon-only, always visible regardless of scroll state. -->
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                   text-[11px] font-semibold transition-colors
                   focus:outline-none focus:ring-2 focus:ring-white/60"
            :class="_copied
              ? 'bg-emerald-400/30 text-white'
              : 'bg-white/15 text-white hover:bg-white/25'"
            :title="_copied ? 'Copied to clipboard' : 'Copy full essay to clipboard'"
            :aria-label="_copied ? 'Copied' : 'Copy full essay'"
            @click="copyAll"
          >
            <span>{{ _copied ? '✓' : '📋' }}</span>
            <span class="hidden sm:inline">{{ _copied ? 'Copied' : 'Copy' }}</span>
          </button>
          <CloseDot
            variant="on-dark"
            aria-label="Close About the Edit Glyph"
            @click="$emit('close')"
          />
        </div>

        <!-- ── Body (scrollable) ──────────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="relative bg-slate-50"
          inner-class="px-6 py-6 space-y-6"
          inner-style="max-height: calc(90vh - 130px)"
          fade-from="rgb(248, 250, 252)"
        >
          <!-- Title block -->
          <header class="text-center">
            <p class="text-[20px] font-bold text-slate-900 leading-snug">
              The SEM App Edit Glyph
            </p>
            <p class="mt-1 text-[20px] font-mono text-slate-700 tracking-wide">[*] → [**]</p>
            <p class="mt-2 text-[12px] text-slate-500 italic max-w-md mx-auto leading-relaxed">
              {{ EDIT_GLYPH_SUBTITLE }}
            </p>
          </header>

          <!-- One card per EditAboutSection -->
          <section
            v-for="(sec, idx) in EDIT_GLYPH_SECTIONS"
            :key="idx"
            class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm"
          >
            <h3 class="text-[11px] font-bold uppercase tracking-widest text-slate-600 mb-2">
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
              <ul
                v-if="sec.bullets && sec.bullets.length"
                class="mt-1 space-y-1.5 text-[13px] text-slate-700 leading-relaxed"
              >
                <li
                  v-for="(b, bIdx) in sec.bullets"
                  :key="bIdx"
                  class="pl-3 border-l-2 border-slate-300"
                >
                  <span v-if="b.term" class="font-semibold text-slate-800">{{ b.term }}</span>
                  <span v-if="b.term"> — </span>
                  <template v-for="(seg, sIdx) in splitCodeSpans(b.text)" :key="sIdx">
                    <code
                      v-if="seg.kind === 'code'"
                      class="font-mono text-[12.5px] rounded bg-slate-100 text-slate-800 px-1 py-0.5"
                    >{{ seg.v }}</code>
                    <template v-else>{{ seg.v }}</template>
                  </template>
                </li>
              </ul>
            </div>
          </section>

          <!-- Footer attribution line -->
          <p class="text-center text-[11px] text-slate-400 italic pt-2 pb-1">
            © Tom Gilb · 2026 · SEM App · Planguage keyed-icon family
          </p>
        </ScrollContainer>

        <!-- ── Footer actions: Copy + Email ──────────────────────────────────── -->
        <div
          class="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-slate-200
                 bg-white"
        >
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
                   bg-slate-600 text-white hover:bg-slate-700
                   focus:outline-none focus:ring-2 focus:ring-slate-400"
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
