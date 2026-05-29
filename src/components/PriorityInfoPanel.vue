<!--
  PriorityInfoPanel.vue — modal that opens when the user clicks the `?`
  affordance attached to the Priority keyed icon `[A>B>C]`, or via the
  ⌘F palette "About the Priority Glyph", or via the Detail-menu About row.

  Per DD-002 (2026-05-13). Tom's spec: a window with four sections —
    1. Interpretation of the icon
    2. Invention of the icon (© Tom Gilb 2026)
    3. The Planguage Theory of Priority in a nutshell:
       3a. multiple levels of priority (Survival/Fail/Goal/Stretch/Wish)
       3b. multiple attributes of priority (Power/Wealth/Law/Attractiveness,
           pending the fuller Priority Engineering book taxonomy)
       3c. alignment with values × costs, within constraints
       3d. dynamic / computable (IET / VDT — priority shifts as inputs shift)
    4. Sources & further reading

  Content source: src/composables/useAboutPriorityGlyph.ts (which mirrors
  /Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/03Execution/Priority-Icon-About.md
  verbatim).

  Universal rules honoured:
    • CloseDot at END of header on dark gradient
    • ScrollContainer wraps the body region
    • Backdrop + Teleport-to-body for the modal pattern
    • Registered as an exclusive surface from App.vue
-->
<script setup lang="ts">
import { ref } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'
import {
  PRIORITY_GLYPH_TITLE,
  PRIORITY_GLYPH_SUBTITLE,
  PRIORITY_GLYPH_SECTIONS,
  getAboutPriorityGlyphText,
  openPriorityGlyphEmail,
} from '../composables/useAboutPriorityGlyph'

defineEmits<{ close: []; 'open-symbol-family': [] }>()

// Transient ✓ flash on Copy success.
const _copied = ref(false)
const _copyError = ref('')

async function copyAll(): Promise<void> {
  _copyError.value = ''
  try {
    await navigator.clipboard.writeText(getAboutPriorityGlyphText())
    _copied.value = true
    setTimeout(() => { _copied.value = false }, 2200)
  } catch (err) {
    _copyError.value = err instanceof Error ? err.message : 'Clipboard unavailable'
  }
}

function emailAll(): void {
  openPriorityGlyphEmail()
}

/**
 * Render a paragraph that may contain backtick-delimited inline code spans.
 * Mirrors splitCodeSpans in SaveGlyphHistoryPanel. No v-html.
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
      :aria-label="PRIORITY_GLYPH_TITLE"
    >
      <!-- 2026-05-14: was flex-col with flex-1 body. Switched to plain block
           layout so the body's explicit max-height drives scroll directly,
           independent of flex height-resolution edge cases. The card still
           caps at max-h-[90vh] and clips with overflow-hidden. -->
      <div
        class="pointer-events-auto w-full max-w-2xl max-h-[90vh]
               overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
      >
        <!-- ── Header (dark gradient, glyph + title + Copy + CloseDot) ───── -->
        <!-- 2026-05-14 fix: Tom reported "about window did not scroll, and we
             need a copy button on it" — the existing Copy in the footer was
             being pushed off-screen by the unbounded body. Added a small icon-
             only Copy here in the header so the affordance is ALWAYS visible
             even if the footer ever gets clipped again. -->
        <div
          class="flex items-center gap-3 px-5 py-3.5 shrink-0
                 bg-gradient-to-r from-amber-700 via-amber-800 to-orange-800 text-white"
        >
          <span class="flex items-center text-white" aria-hidden="true">
            <PriorityTripleGlyph size="standard" class="h-6 w-auto" />
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold leading-tight truncate">About the Priority Glyph</p>
            <p class="text-[10px] text-white/55 leading-tight truncate">
              Why the SEM App uses <span class="font-mono">[A&gt;B&gt;C]</span> as the keyed icon for priority.
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
            aria-label="Close About the Priority Glyph"
            @click="$emit('close')"
          />
        </div>

        <!-- ── Body (scrollable) ──────────────────────────────────────────── -->
        <!-- 2026-05-14 scroll fix: switched from flex-1 min-h-0 + h-full to an
             explicit max-height via inner-style. The flex resolution dance was
             reportedly not engaging scroll in some configurations; explicit
             max-height calc bypasses the issue. fadeFrom switched from default
             white to slate-50 to match the body bg so the gradient hint reads. -->
        <ScrollContainer
          outer-class="relative bg-slate-50"
          inner-class="px-6 py-6 space-y-6"
          inner-style="max-height: calc(90vh - 130px)"
          fade-from="rgb(248, 250, 252)"
        >
          <!-- Title block -->
          <header class="text-center">
            <p class="text-[20px] font-bold text-slate-900 leading-snug">
              The SEM App Priority Glyph
            </p>
            <p class="mt-1 text-[20px] font-mono text-amber-700 tracking-wide">[A&gt;B&gt;C]</p>
            <p class="mt-2 text-[12px] text-slate-500 italic max-w-md mx-auto leading-relaxed">
              {{ PRIORITY_GLYPH_SUBTITLE }}
            </p>
          </header>

          <!-- One card per PriorityAboutSection -->
          <section
            v-for="(sec, idx) in PRIORITY_GLYPH_SECTIONS"
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
              <ul
                v-if="sec.bullets && sec.bullets.length"
                class="mt-1 space-y-1.5 text-[13px] text-slate-700 leading-relaxed"
              >
                <li
                  v-for="(b, bIdx) in sec.bullets"
                  :key="bIdx"
                  class="pl-3 border-l-2 border-amber-200"
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

          <!-- Footer attribution line, mirrored inside the doc -->
          <p class="text-center text-[11px] text-slate-400 italic pt-2 pb-1">
            © Tom Gilb · 2026-05-13 · SEM App · Planguage keyed-icon family
          </p>
        </ScrollContainer>

        <!-- ── Footer actions: Symbol Family + Copy + Email ────────────────── -->
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
                   bg-amber-600 text-white hover:bg-amber-700
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
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
