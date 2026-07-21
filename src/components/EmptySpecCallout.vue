<!-- UNIT_TYPE=Widget -->
<!--
 * EmptySpecCallout.vue — top-of-stage banner that surfaces a CLEAR
 * "your spec is empty, go to Stage 1.2 to parse" message on every
 * Stage 2-11 view when currentSpec is null or has zero real entries.
 *
 * Tom Gilb 2026-06-19 verbatim: "am I being premature?  I keep on seeing
 * v0.1 and nothing in the spec library at all for Indianapolis".
 *
 * Diagnosis: Tom had named his spec ("Indianapolis Contract" with owner
 * J Bullock) but never successfully parsed any content into it — every
 * stage past Stage 1 was therefore showing the empty-state tiles AND
 * he had no visible diagnostic explaining why.  The stage-gate toast
 * I wired into handleStageBarNav only fires AT the moment of advance;
 * a resumed session never sees it.  This callout fixes that: it sits
 * at the TOP of every non-Stage-1 view whenever the spec is empty, and
 * does not auto-dismiss — the planner cannot miss it.
 *
 * Behaviour: emits 'go-to-spec-parsing' on the primary action button so
 * the parent (App.vue) can route the planner back to Stage 1 with the
 * 1.2 sub-step pre-selected.
 *
 * Composes with: MOVE Principle (the next correct action is visible
 * without scrolling) + DD-009 Zero-Training UI (every multi-mode
 * affordance lists what it does in plain English) + No-Silent-Data-Loss
 * (instead of letting the planner sit in a downstream stage that LOOKS
 * broken, surface the missing precondition explicitly) + Icon-Plus-Text
 * SUPREME (every button has glyph + text) + Twin portability.
 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  /** The current spec (may be null when nothing has been parsed yet). */
  spec:  SpecBlock | null
  /** The planning-bar stage number (1-11).  The callout is hidden on
   *  Stage 1 — that view IS the place to fix the empty-spec state, so
   *  redundant guidance there would just be noise. */
  stage: number
}>()

const emit = defineEmits<{
  (e: 'go-to-spec-parsing'): void
}>()

const realEntryCount = computed<number>(() => {
  const s = props.spec
  if (!s) return 0
  return (s.functions?.length ?? 0) +
         (s.values?.length ?? 0) +
         (s.solutions?.length ?? 0) +
         (s.constraints?.length ?? 0) +
         (s.resources?.length ?? 0)
})

const hasOnlyFallback = computed<boolean>(() => {
  // The local-parser fallback creates a single V.ImportedText entry — a
  // technically non-empty spec that nonetheless has nothing useful in any
  // downstream stage.  Surface the callout for this case too.
  const s = props.spec
  if (!s) return false
  const total = realEntryCount.value
  if (total !== 1) return false
  return (s.values?.length === 1) && (s.values[0].id === 'V.ImportedText')
})

const shouldShow = computed<boolean>(() => {
  if (props.stage <= 1) return false
  return realEntryCount.value === 0 || hasOnlyFallback.value
})

const headlineReason = computed<string>(() => {
  if (props.spec === null)        return 'Your spec is empty — nothing has been parsed yet.'
  if (realEntryCount.value === 0) return 'Your spec has no Functions, Values, Solutions, Constraints, or Resources.'
  if (hasOnlyFallback.value)      return 'Your spec contains only the raw imported text — no structured entries have been extracted yet.'
  return ''
})
</script>

<template>
  <div
    v-if="shouldShow"
    class="w-full max-w-4xl mx-auto my-4 rounded-2xl border-2 border-rose-300 bg-rose-50 shadow-md overflow-hidden"
    role="alert"
    aria-live="polite"
    :aria-label="`Spec is empty at stage ${stage} — go back to Stage 1 to parse content`"
  >
    <div class="flex items-start gap-4 px-5 py-4">
      <span class="shrink-0 text-3xl leading-none" aria-hidden="true">⚠</span>
      <div class="flex-1 min-w-0 space-y-2">
        <h3 class="text-base font-bold text-rose-800">
          Stage {{ stage }} cannot display anything — your spec is empty.
        </h3>
        <p class="text-sm text-rose-700 leading-snug">
          {{ headlineReason }}
        </p>
        <ul class="text-[12px] text-rose-700/85 leading-snug list-disc pl-5 space-y-0.5">
          <li><strong>Stage {{ stage }}</strong> reads its data from the spec.  With zero entries there is nothing to render.</li>
          <li>Click the button to return to <strong>Stage 1</strong>; the panel will land on the correct sub-step automatically (1.1 Spec Entry if your previous input was a file you need to re-select; 1.2 Spec Parsing if your previous text or URL can be auto-restored).</li>
          <li>The parser auto-fetches a pasted URL, then extracts Functions, Values, Solutions, Constraints, and Resources via Claude.</li>
        </ul>
        <div class="pt-1">
          <!-- r41 v213 (Tom Gilb 2026-06-19 "it says falsely 1.2") — button
               label was hard-coded to "1.2 Spec Parsing" but App.vue's handler
               routes to 1.1 (Spec Entry) when the previous input was a file
               that can't be re-attached automatically.  The mismatch made the
               button lie.  Label now reads "Return to Stage 1" without
               promising a specific sub-step; the HoverHint spells out the
               smart routing rule so a curious planner can see WHY the
               destination depends on context. -->
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold
                   hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 transition-colors shadow-sm"
            title="Return to Stage 1.  Sub-step is chosen automatically: 1.1 Spec Entry if you need to re-select a file or have no previous input; 1.2 Spec Parsing if your previous text or URL can be auto-restored to the input field."
            @click="emit('go-to-spec-parsing')"
          >
            <span aria-hidden="true">←</span>
            <span>Return to Stage 1</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
