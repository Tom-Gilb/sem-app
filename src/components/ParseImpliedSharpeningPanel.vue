<!-- UNIT_TYPE=Panel -->
<!--
 * ParseImpliedSharpeningPanel.vue — Stage 1 sub-step 1.3.
 *
 * Tom Gilb 2026-06-19: "1.3 Parse Implied Sharpening".  After the parser
 * (local tag-detect OR AI extraction) has produced a draft spec, the
 * planner reviews each implied entry, accepts/rejects/refines, and asks
 * any targeted follow-up question that should run before 1.4 Planguage
 * Generation locks the entries in.
 *
 * First swing scope:
 *   • One modal with a backdrop (No-Silent-Removal rule: backdrop click
 *     dismisses).
 *   • CloseDot at the END of the header (CloseDot rule).
 *   • Entries grouped by Planguage type (Functions / Values / Solutions /
 *     Constraints / Resources) — only the groups present in the current
 *     spec render.
 *   • Each entry row: id chip + description + Accept (default) / Reject
 *     buttons.  Reject is a soft hide for this rev; a follow-up rev wires
 *     it through to a real spec mutation through useUndoHistory.
 *   • A "Follow-up question for Claudian" textarea at the bottom — the
 *     planner can write a refinement instruction; the panel toasts an
 *     acknowledgement and lands the text in a ref the parent can read
 *     later (a follow-up rev runs the actual Claudian round-trip).
 *
 * Composes with Universal Undo SUPREME (any accept/reject that mutates
 * the spec must go through useUndoHistory), No-Silent-Data-Loss SUPREME
 * (reject is a soft hide for now, not a destructive remove), CloseDot
 * Rule, ScrollContainer Rule, Single-Surface Rule, Icon-Plus-Text Rule,
 * Spell-out-Type-Names Rule, DD-009 Zero-Training UI, Twin portability.
 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import type { SpecBlock } from '../types/spec'
import {
  copyUniversalSharp,
  emailUniversalSharp,
  type UniversalSharpExportInput,
} from '../composables/useUniversalSharpExport'

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'reject-entry', id: string): void
  (e: 'refine-with-context', text: string): void
}>()

// Soft-hide locally rejected entry ids for this rev — the parent decides
// whether to actually remove them on a later rev.
const rejectedIds = ref<Set<string>>(new Set())
const followupText = ref<string>('')

function isAccepted(id: string): boolean {
  return !rejectedIds.value.has(id)
}

function toggleReject(id: string): void {
  const next = new Set(rejectedIds.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  rejectedIds.value = next
  emit('reject-entry', id)
}

function submitFollowup(): void {
  const t = followupText.value.trim()
  if (!t) return
  emit('refine-with-context', t)
  followupText.value = ''
}

interface RenderableSection {
  type:    'Function' | 'Value' | 'Solution' | 'Constraint' | 'Resource'
  color:   string
  entries: Array<{ id: string; description: string }>
}

const sections = computed<RenderableSection[]>(() => {
  const s = props.spec
  if (!s) return []
  const all: RenderableSection[] = [
    { type: 'Function',
      color: '#15803d',
      entries: (s.functions ?? []).map(f => ({ id: f.id, description: f.description ?? '' })) },
    { type: 'Value',
      color: '#6d28d9',
      entries: (s.values ?? []).map(v => ({ id: v.id, description: v.description ?? '' })) },
    { type: 'Solution',
      color: '#c2410c',
      entries: (s.solutions ?? []).map(so => ({ id: so.id, description: so.description ?? '' })) },
    { type: 'Constraint',
      color: '#b91c1c',
      entries: (s.constraints ?? []).map(c => ({ id: c.id, description: c.description ?? '' })) },
    { type: 'Resource',
      color: '#1d4ed8',
      entries: (s.resources ?? []).map(r => ({ id: r.id, description: r.description ?? '' })) },
  ]
  return all.filter(sec => sec.entries.length > 0)
})

const totalEntries = computed<number>(() =>
  sections.value.reduce((sum, sec) => sum + sec.entries.length, 0),
)

const acceptedCount = computed<number>(() =>
  sections.value.reduce(
    (sum, sec) => sum + sec.entries.filter(e => isAccepted(e.id)).length,
    0,
  ),
)

// r41 v283 (Tom Gilb 2026-06-22 "All sharpening answers must be exportable")
function _buildExportInput(): UniversalSharpExportInput {
  const followupSection = followupText.value.trim()
    ? [{
        headline: 'Follow-up Question for Claudian',
        color:    '#0ea5e9',
        items:    [{ question: 'Planner refinement note', answer: followupText.value.trim() }],
      }]
    : []
  return {
    panelName: 'Parse Implied Sharpening',
    planName:  (props.spec as unknown as { plan?: { name?: string } })?.plan?.name || 'Untitled Plan',
    subtitle:  'Review of implied entries from initial parse — accept/reject decisions + follow-up refinement note.',
    sections:  [
      ...sections.value.map(sec => ({
        headline: `${sec.type}s — ${sec.entries.length} ${sec.entries.length === 1 ? 'entry' : 'entries'}`,
        color:    sec.color,
        items:    sec.entries.map(e => ({
          question: e.id,
          answer:   `${isAccepted(e.id) ? '✓ ACCEPTED' : '✗ REJECTED'} — ${e.description}`,
        })),
      })),
      ...followupSection,
    ],
  }
}
async function copyAllAnswers(): Promise<void>  { await copyUniversalSharp(_buildExportInput())  }
async function emailAllAnswers(): Promise<void> { await emailUniversalSharp(_buildExportInput()) }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parse-implied-sharpening-title"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 via-violet-600 to-orange-500 text-white">
          <span aria-hidden="true" class="text-xl leading-none">🔍</span>
          <div class="flex-1 min-w-0">
            <h2 id="parse-implied-sharpening-title" class="text-base font-bold leading-tight">
              Stage 1.3 — Parse Implied Sharpening
            </h2>
            <p class="text-[11px] text-white/85 mt-0.5">
              Review every entry the parser inferred from your input.  Accept what's right; reject what isn't; ask Claudian a follow-up to refine.
            </p>
          </div>
          <!-- r41 v283 — Copy + Email -->
          <button type="button" class="px-2.5 py-1.5 rounded bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-white/40" title="📋 Copy all implied-entries decisions + follow-up note as colourful HTML" @click="copyAllAnswers">📋 Copy</button>
          <button type="button" class="px-2.5 py-1.5 rounded bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-white/40" title="📧 Email all implied-entries decisions — opens Mail.app pre-filled" @click="emailAllAnswers">📧 Email</button>
          <CloseDot size="lg" aria-label="Close Parse Implied Sharpening" @close="emit('close')" />
        </header>

        <!-- Status row -->
        <div class="px-5 py-2 text-xs text-slate-600 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <span><strong>{{ totalEntries }}</strong> {{ totalEntries === 1 ? 'entry' : 'entries' }} inferred</span>
          <span class="text-slate-300">·</span>
          <span class="text-emerald-700"><strong>{{ acceptedCount }}</strong> accepted</span>
          <span class="text-slate-300">·</span>
          <span class="text-rose-700"><strong>{{ totalEntries - acceptedCount }}</strong> rejected</span>
        </div>

        <!-- Body — entries grouped by type -->
        <ScrollContainer class="flex-1 min-h-0" inner-class="p-5 space-y-5">

          <!-- Empty state -->
          <div v-if="totalEntries === 0" class="text-center py-12 text-slate-400">
            <p class="text-sm">No entries to review yet.  Run Stage 1.2 (Spec Parsing) first.</p>
          </div>

          <!-- One block per Planguage type that has entries -->
          <section
            v-for="sec in sections"
            :key="sec.type"
            :aria-labelledby="`sharp-section-${sec.type}`"
          >
            <div class="flex items-center gap-2 mb-2">
              <span
                class="inline-block w-2 h-5 rounded"
                :style="{ backgroundColor: sec.color }"
                aria-hidden="true"
              />
              <h3
                :id="`sharp-section-${sec.type}`"
                class="text-sm font-bold text-slate-800"
              >{{ sec.type }}{{ sec.entries.length === 1 ? '' : 's' }} <span class="text-slate-400 font-normal">({{ sec.entries.length }})</span></h3>
            </div>

            <ul class="space-y-2">
              <li
                v-for="entry in sec.entries"
                :key="entry.id"
                class="rounded-lg border bg-white px-3 py-2 transition-colors"
                :class="isAccepted(entry.id)
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-rose-200 bg-rose-50/40 opacity-70'"
              >
                <div class="flex items-start gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="font-mono text-[11px] font-semibold text-slate-500 truncate">{{ entry.id }}</p>
                    <p
                      class="text-sm text-slate-700 leading-snug mt-0.5"
                      :class="isAccepted(entry.id) ? '' : 'line-through text-slate-400'"
                    >{{ entry.description || '(no description)' }}</p>
                  </div>
                  <div class="shrink-0 flex items-center gap-1.5">
                    <button
                      v-if="isAccepted(entry.id)"
                      type="button"
                      class="text-[11px] px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
                      title="Mark this entry as inferred-incorrectly.  Accept can be toggled back at any time."
                      @click="toggleReject(entry.id)"
                    >✕ Reject</button>
                    <button
                      v-else
                      type="button"
                      class="text-[11px] px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Restore this entry — bring it back into the accepted set."
                      @click="toggleReject(entry.id)"
                    >↩ Restore</button>
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <!-- Refine with additional context — direct re-extraction via Anthropic
               (Option A, the path Tom approved 2026-06-19).  No Claudian round-trip. -->
          <section v-if="totalEntries > 0" class="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
            <h3 class="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
              <span aria-hidden="true">💬</span>
              Refine with additional context
            </h3>
            <p class="text-[11px] text-indigo-700/80 leading-snug">
              Anything missing or wrong?  Type a hint — the extractor will re-run with your refinement folded into the input.
            </p>
            <textarea
              v-model="followupText"
              rows="2"
              class="w-full rounded-lg border border-indigo-200 bg-white text-sm text-slate-800 px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 resize-none"
              placeholder="e.g. ‘the Tolerable for Search Latency should be 5 seconds, not 3’"
              aria-label="Refinement hint for the next extraction pass"
              @keydown.enter.ctrl="submitFollowup"
              @keydown.enter.meta="submitFollowup"
            />
            <div class="flex justify-end">
              <button
                type="button"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                :disabled="!followupText.trim()"
                title="Re-run the parser with the hint included as additional context.  Cmd-Enter to submit."
                @click="submitFollowup"
              >Re-extract with this hint</button>
            </div>
          </section>
        </ScrollContainer>

        <!-- Footer — confirm + close -->
        <footer class="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
          <p class="text-[10px] text-slate-400 italic">
            Stage 1.3 — Parse Implied Sharpening · proceed to 1.4 Planguage Generation when ready.
          </p>
          <button
            type="button"
            class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            title="Close the panel and continue to Stage 1.4."
            @click="emit('close')"
          >Done · go to 1.4</button>
        </footer>

      </div>
    </div>
  </Teleport>
</template>
