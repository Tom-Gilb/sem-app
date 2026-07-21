<script setup lang="ts">
/**
 * IlluminatePurposeMenu — Phase 4 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 4 mandate):
 *   *"5. A 'Your Purposes' menu, asks for their reasons for this inquiry
 *    (giving some options and a place to key or say), then based on that,
 *    the Tool guides them through useful material, until their Illumination
 *    is 'Sharp Enough'."*
 *
 * Modal: list of canonical purposes + free-text field for "Other".  Picking
 * a purpose:
 *   (a) records it in the in-memory session log (Phase 5)
 *   (b) sets the picker's active tab to the first tab in the purpose's
 *       recommended sequence
 *   (c) shows a small "next recommended tab" nudge in the picker so the
 *       planner can advance through the guided flow
 *   (d) closes the modal
 *
 * Composes with all the SUPREME rules + the rest of the Illumination AI phases.
 */

import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import CloseDot from './CloseDot.vue'
import { ILLUMINATE_PURPOSES, type IlluminatePurpose } from '../data/illuminatePurposes'

const props = defineProps<{
  open:             boolean
  currentPurposeId: string | null
  currentFreeText:  string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'pick', payload: { purposeId: string; freeText?: string }): void
}>()

const _ticked = ref<string | null>(null)
const _freeText = ref<string>('')

watch(() => props.open, (open) => {
  if (open) {
    _ticked.value   = props.currentPurposeId
    _freeText.value = props.currentFreeText
  }
})

function pick(p: IlluminatePurpose): void {
  _ticked.value = p.id
  if (p.id !== 'other') {
    emit('pick', { purposeId: p.id })
    emit('close')
  }
}

function confirmOther(): void {
  if (!_freeText.value.trim()) return
  emit('pick', { purposeId: 'other', freeText: _freeText.value.trim() })
  emit('close')
}

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) {
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    emit('close')
  }
}
onMounted(() => document.addEventListener('keydown', _onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', _onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[2150] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ill-purpose-title"
    >
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="emit('close')"></div>

      <div
        class="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border-2 border-violet-300"
        @click.stop
      >
        <header class="px-5 py-3 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50 via-amber-50 to-orange-50 flex items-center gap-2 shrink-0">
          <span class="text-2xl">🎯</span>
          <div class="flex-1 min-w-0">
            <h2 id="ill-purpose-title" class="text-base font-extrabold text-slate-800 leading-tight">
              Your Purpose for this Illumination
            </h2>
            <p class="text-[11px] text-slate-600 leading-tight mt-0.5">
              Pick one — the picker will guide you through the best sequence of tabs.  Tom Gilb 2026-06-15: <em>"the Tool guides them through useful material, until their Illumination is 'Sharp Enough'"</em>.
            </p>
          </div>
          <CloseDot size="lg" aria-label="Close Purpose menu" @click="emit('close')" />
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-1">
          <button
            v-for="p in ILLUMINATE_PURPOSES.filter(x => x.id !== 'other')"
            :key="p.id"
            type="button"
            class="w-full text-left flex items-start gap-3 px-3 py-2 rounded-lg border-2 transition-colors"
            :class="_ticked === p.id
              ? 'border-violet-500 bg-violet-50'
              : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 bg-white'"
            :title="p.blurb"
            @click="pick(p)"
          >
            <span class="text-xl shrink-0 mt-0.5">{{ p.emoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-slate-800">{{ p.label }}</div>
              <div class="text-[11px] text-slate-600 mt-0.5">{{ p.blurb }}</div>
              <div class="text-[10px] text-violet-700 mt-1 font-mono">
                Sequence: {{ p.sequence.join(' → ') }}
              </div>
            </div>
          </button>

          <!-- Other / free-text -->
          <div
            class="rounded-lg border-2 transition-colors p-3 mt-2"
            :class="_ticked === 'other' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'"
          >
            <div class="flex items-start gap-3">
              <span class="text-xl shrink-0 mt-0.5">💭</span>
              <div class="flex-1">
                <label class="text-sm font-bold text-slate-800">Other (let me say)</label>
                <p class="text-[11px] text-slate-600 mb-2">Type or paste your own purpose.  The picker defaults to 📖 Define → 📐 Diagram for general grounding.</p>
                <input
                  v-model="_freeText"
                  type="text"
                  class="w-full text-sm px-3 py-2 border-2 border-violet-300 rounded bg-white focus:outline-none focus:border-violet-600"
                  placeholder='e.g. "Preparing a tutorial for new hires"'
                  title="Free-text purpose.  Recorded in the session log and surfaced as a chip in the picker header."
                  @keydown.enter="confirmOther"
                  @focus="_ticked = 'other'"
                />
              </div>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow shrink-0 self-end"
                :disabled="!_freeText.trim()"
                title="Confirm this free-text purpose and start the guided flow."
                @click="confirmOther"
              >Use this</button>
            </div>
          </div>
        </div>

        <footer class="px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2 flex-wrap">
          <span class="text-[10px] text-slate-500 italic flex-1">
            Each purpose maps to a recommended sequence of tabs.  You can deviate at any time — the picker just shows the suggested next tab.
          </span>
          <button
            type="button"
            class="px-3 py-1 rounded-md text-[12px] font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 bg-white"
            title="Close without picking a purpose."
            @click="emit('close')"
          >Cancel</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
