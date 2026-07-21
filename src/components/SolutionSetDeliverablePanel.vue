<!-- UNIT_TYPE=Panel -->
<!--
 * SolutionSetDeliverablePanel.vue — Stage 5 sub-step 5.5.1 + 5.5.2
 * deliverables (audit-backlog #4).
 *
 * v478 (Tom Gilb 2026-07-04 "continue backlog"): displays the two Exit-
 * Process deliverables Tom's Stage 5 rule names:
 *   5.5.1 — Solution Set with sources + estimated impacts (Tier-1 canonical
 *          Solution parameters per Solution Parameters SUPREME)
 *   5.5.2 — Changes-List to other specs (Stakeholder / Value / Constraint /
 *          Resource / Function ADD/SHARPEN/MODIFY changes implied by the
 *          approved Solution Set)
 *
 * Copy + Email pins per Export-Button-on-All-Windows SUPREME.  Auto-opens
 * Mail with empty To: per Mailto-No-Self-To SUPREME.
 *
 * Composes with:
 *   - rule_stage_5_refine_design.md SUPREME (this panel IS 5.5.1 + 5.5.2)
 *   - Solution Parameters SUPREME (Tier-1 inventory verbatim)
 *   - Export-Button-on-All-Windows SUPREME
 *   - Mailto-No-Self-To SUPREME (empty To:)
 *   - CloseDot SUPREME
 *   - MOVE Principle SUPREME (both deliverables visible in one panel;
 *     no menu-dive)
 *   - DD-009 Zero-Training UI (each row explains itself)
 *   - Icon-Plus-Text SUPREME
 *   - Twin portability
 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import CloseDot from './CloseDot.vue'
import { useSolutionSetDeliverable } from '../composables/useSolutionSetDeliverable'
import { useChangesList, type ChangeSpecCategory } from '../composables/useChangesList'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  open:         boolean
  spec:         SpecBlock | null
  planName:     string
  planVersion:  string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'copy',  text: string): void
  (e: 'email', text: string): void
}>()

const specRef        = computed<SpecBlock | null>(() => props.spec)
const planNameRef    = computed<string>(() => props.planName)
const planVersionRef = computed<string>(() => props.planVersion)

const { deliverable: solutionSet, asPlainText: solutionSetPlain } =
  useSolutionSetDeliverable(specRef, planNameRef as Ref<string>, planVersionRef as Ref<string>)

const { deliverable: changesList, asPlainText: changesListPlain } =
  useChangesList(specRef, planNameRef as Ref<string>, planVersionRef as Ref<string>)

const activeTab = ref<'solution-set' | 'changes-list'>('solution-set')

const activePlainText = computed<string>(() =>
  activeTab.value === 'solution-set' ? solutionSetPlain.value : changesListPlain.value,
)

// Category glyphs — Icon-Plus-Text SUPREME.
const CATEGORY_GLYPH: Record<ChangeSpecCategory, string> = {
  Stakeholder: '👥', Value: '★', Constraint: '⛔', Resource: '⚙', Function: '⚙',
}

const KIND_LABEL: Record<'add' | 'sharpen' | 'modify', string> = {
  add:     'ADD',
  sharpen: 'SHARPEN',
  modify:  'MODIFY',
}

function copyActive(): void { emit('copy', activePlainText.value) }
function emailActive(): void { emit('email', activePlainText.value) }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[610] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solset-title"
    >
      <div class="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" @click="emit('close')" />

      <div class="pointer-events-auto relative w-full max-w-4xl mx-4 max-h-[92vh] flex flex-col rounded-2xl bg-white ring-1 ring-slate-300 shadow-2xl overflow-hidden">
        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-800 via-violet-800 to-indigo-900 text-white shrink-0">
          <span aria-hidden="true" class="text-xl leading-none">📦</span>
          <div class="flex-1 min-w-0">
            <h2 id="solset-title" class="text-sm font-bold tracking-wide">
              Stage 5 · Solution Set + Changes-List (Exit Process 5.5.1 + 5.5.2)
            </h2>
            <p class="text-[10.5px] text-indigo-100/90 mt-0.5 leading-snug">
              Tom Gilb 2026-06-21 verbatim — Solution Set (sources + impacts) · Changes-List to other specs
            </p>
          </div>
          <button
            type="button"
            class="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold ring-1 ring-white/30 transition-colors flex items-center gap-1"
            title="📋 Copy — plain-text serialisation of the active tab (Solution Set OR Changes-List) to clipboard for paste into Mail/Notes/Keynote."
            @click="copyActive"
          >
            <span aria-hidden="true">📋</span> Copy
          </button>
          <button
            type="button"
            class="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold ring-1 ring-white/30 transition-colors flex items-center gap-1"
            title="✉ Email — opens Mail with empty To: (Mailto-No-Self-To SUPREME) and the active tab as the plain-text body.  ⌘V to paste the colourful HTML version."
            @click="emailActive"
          >
            <span aria-hidden="true">✉</span> Email
          </button>
          <CloseDot variant="on-dark" size="lg" title="Close deliverable panel" aria-label="Close deliverable panel" @click="emit('close')" />
        </header>

        <!-- Tab bar -->
        <div class="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border-b border-indigo-200 shrink-0">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors"
            :class="activeTab === 'solution-set'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
              : 'bg-white text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100'"
            title="5.5.1 — Solution Set deliverable: the approved solutions with their sources + estimated main impacts."
            @click="activeTab = 'solution-set'"
          >
            5.5.1 · Solution Set
            <span class="ml-1 text-[10px] font-bold opacity-80 tabular-nums">({{ solutionSet?.totalCount ?? 0 }})</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors"
            :class="activeTab === 'changes-list'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
              : 'bg-white text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100'"
            title="5.5.2 — Changes-List deliverable: implied changes to Stakeholder / Value / Constraint / Resource / Function specs to be consistent with the approved Solution Set."
            @click="activeTab = 'changes-list'"
          >
            5.5.2 · Changes-List
            <span class="ml-1 text-[10px] font-bold opacity-80 tabular-nums">({{ changesList?.totalChanges ?? 0 }})</span>
          </button>
        </div>

        <!-- Body (scroll) -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 text-sm">

          <!-- ═════ 5.5.1 Solution Set ═════ -->
          <div v-if="activeTab === 'solution-set'">
            <div v-if="!solutionSet || solutionSet.totalCount === 0"
                 class="text-center py-10 italic text-slate-500">
              No solutions in the current spec yet. Return to Stage 2 to generate or capture solutions first.
            </div>
            <ul v-else class="space-y-2">
              <li
                v-for="row in solutionSet.rows"
                :key="row.tag"
                class="rounded-lg ring-1 ring-slate-200 bg-white shadow-sm px-3 py-2.5"
              >
                <div class="flex items-baseline gap-2 mb-1">
                  <span class="text-sm font-extrabold text-indigo-900 tabular-nums">{{ row.tag }}:</span>
                  <span class="text-[10px] font-mono uppercase tracking-wider text-slate-500">Type: Solution</span>
                  <span class="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Status: {{ row.status }}
                  </span>
                </div>
                <p class="text-[12.5px] text-slate-800 leading-snug mb-1">
                  <span class="font-semibold">Description:</span> {{ row.description || '(no description)' }}
                </p>
                <div v-if="row.derivedFrom.length" class="text-[11px] text-slate-600 mb-0.5">
                  <span class="font-semibold">Derived From:</span> {{ row.derivedFrom.join(', ') }}
                </div>
                <div v-if="row.function" class="text-[11px] text-slate-600 mb-0.5">
                  <span class="font-semibold">Function:</span> {{ row.function }}
                </div>
                <div class="text-[11px] text-slate-600 mb-0.5 whitespace-pre-wrap">
                  <span class="font-semibold">Main Impacts:</span> {{ row.mainImpacts }}
                </div>
                <div v-if="row.source" class="text-[11px] text-emerald-800 mb-0.5">
                  <span class="font-semibold">Source:</span> {{ row.source }}
                </div>
                <div v-if="row.costEstimate" class="text-[11px] text-amber-800">
                  <span class="font-semibold">Cost:</span> {{ row.costEstimate }}
                </div>
              </li>
            </ul>
          </div>

          <!-- ═════ 5.5.2 Changes-List ═════ -->
          <div v-else>
            <div v-if="!changesList || changesList.totalChanges === 0"
                 class="text-center py-10 italic text-slate-500">
              No changes implied — every referenced Stakeholder / Value / Constraint / Resource / Function already exists and is sharpened enough for the approved Solution Set.
            </div>
            <div v-else>
              <!-- Count summary -->
              <div class="mb-3 flex items-center gap-2 flex-wrap text-[10.5px]">
                <span
                  v-for="cat in (['Stakeholder', 'Value', 'Constraint', 'Resource', 'Function'] as ChangeSpecCategory[])"
                  :key="cat"
                  class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200 font-semibold flex items-center gap-1"
                >
                  <span aria-hidden="true">{{ CATEGORY_GLYPH[cat] }}</span>
                  <span>{{ cat }}: {{ changesList.countsByCategory[cat] }}</span>
                </span>
              </div>
              <ul class="space-y-2">
                <li
                  v-for="(row, i) in changesList.rows"
                  :key="i"
                  class="rounded-lg ring-1 ring-slate-200 bg-white shadow-sm px-3 py-2 flex items-start gap-2.5"
                >
                  <span aria-hidden="true" class="shrink-0 text-lg leading-none mt-0.5">{{ CATEGORY_GLYPH[row.category] }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-1.5 flex-wrap mb-0.5">
                      <span class="text-[11px] font-bold uppercase tracking-wider"
                            :class="row.kind === 'add'     ? 'text-emerald-700'
                                  : row.kind === 'sharpen' ? 'text-amber-700'
                                  : 'text-indigo-700'"
                      >{{ KIND_LABEL[row.kind] }}</span>
                      <span class="text-[10px] font-semibold text-slate-600">{{ row.category }}</span>
                      <span class="text-[11px] font-mono font-bold text-slate-800">{{ row.entryId }}</span>
                      <span class="ml-auto text-[10px] italic text-slate-500">from {{ row.triggeredBy }}</span>
                    </div>
                    <p class="text-[12px] text-slate-700 leading-snug">{{ row.detail }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <footer class="flex items-center justify-between gap-3 px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[10.5px] text-slate-600 shrink-0">
          <span class="italic">
            5.5.3 — Proceed to Stage 6 (Evo Steps) via the Continue pin.  Stages are cyclic — return to Stage 5 anytime.
          </span>
          <button
            type="button"
            class="h-8 px-4 rounded-lg text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 shadow-sm"
            @click="emit('close')"
          >Done</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
