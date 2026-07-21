<script setup lang="ts">
/**
 * ActiveModePopover — opens on ActiveModeButton click.
 *
 * Tom Gilb 2026-06-16 verbatim: *"clicking it will allow us to select 1. the
 * settings level subsets of that mode, and going to another mode"*.
 *
 * Two sections:
 *   1. ACTIVE mode card — shows current config summary + "Adjust settings →"
 *      button that opens Settings panel on the relevant section.
 *   2. OTHER modes list — click to request a mode switch (triggers the
 *      governance dialog hosted by App.vue).
 */

import { computed, onMounted, onBeforeUnmount } from 'vue'
import CloseDot from './CloseDot.vue'
import { useActiveMode, type ActiveMode } from '../composables/useActiveMode'
import { useSettings } from '../composables/useSettings'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  /** Fires when user clicks "Adjust settings for this mode →".  Payload is
   *  the settings section to jump to. */
  'open-settings': [sectionId: string]
  /** Fires when user clicks a different mode card.  Payload is the target
   *  mode.  App.vue surfaces the governance dialog. */
  'request-switch': [mode: ActiveMode]
}>()

const { activeMeta, allModes } = useActiveMode()
const { settings } = useSettings()

const otherModes = computed(() => allModes.value.filter(m => m.id !== activeMeta.value.id))

function configSummary(modeId: ActiveMode): string[] {
  if (modeId === 'plan') {
    return [
      `App-level mode: ${settings.value.mode === 'pro-sem' ? 'Pro SEM (full toolkit)' : 'Ultra Light (minimal)'}`,
    ]
  }
  if (modeId === 'model') {
    const c = settings.value.modelMode
    return [
      `Domain: ${c.domain}`,
      `Presentation: ${c.presentation}`,
      `Standards: ${c.standards.join(', ') || '(none)'}${c.standardsCustomUrls.filter(u => u.trim()).length > 0 ? ` + ${c.standardsCustomUrls.filter(u => u.trim()).length} custom URLs` : ''}${c.searchForAdditionalStandards ? ' · 🔍 search additional' : ''}`,
      `Purpose${c.purposes.length === 1 ? '' : 's'}: ${c.purposes.length > 0 ? c.purposes.join(', ') : '(none — defaults to management-decision-making)'}`,
    ]
  }
  if (modeId === 'contract') {
    const c = settings.value.contractsMode
    return [
      `Sharpening: ${c.applyContractSharpening ? 'ON' : 'off'}`,
      `Standards: ${c.standards.join(', ') || '(none)'}${c.standardsCustomUrls.filter(u => u.trim()).length > 0 ? ` + ${c.standardsCustomUrls.filter(u => u.trim()).length} custom URLs` : ''}`,
      `Presentation: ${c.presentation}`,
      `Purpose${c.purposes.length === 1 ? '' : 's'}: ${c.purposes.length > 0 ? c.purposes.join(', ') : '(none — defaults to strict-analytical)'}`,
    ]
  }
  if (modeId === 'strategy') {
    const t = settings.value.strategyTerminology
    return [
      `Values → ${t.valueTerm}`,
      `Solutions → ${t.solutionTerm}`,
      `Evo Steps → ${t.evoStepTerm}`,
      `Owner role → ${t.ownerRoleTerm}`,
    ]
  }
  return []
}

function modeAccentClass(modeId: ActiveMode): string {
  switch (modeId) {
    case 'plan':     return 'border-violet-300 bg-violet-50/40'
    case 'model':    return 'border-blue-300 bg-blue-50/40'
    case 'contract': return 'border-teal-300 bg-teal-50/40'
    case 'strategy': return 'border-orange-300 bg-orange-50/40'  // r41 v50
  }
}

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => document.addEventListener('keydown', _onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', _onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[1900] flex items-start justify-center pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-mode-popover-title"
    >
      <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" @click="emit('close')"></div>

      <div
        class="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border-2 border-slate-200 flex flex-col overflow-hidden"
        @click.stop
      >
        <!-- Header -->
        <header class="px-5 py-3 border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-violet-50 flex items-center gap-2 shrink-0">
          <span class="text-2xl">{{ activeMeta.emoji }}</span>
          <div class="flex-1 min-w-0">
            <h2 id="active-mode-popover-title" class="text-base font-extrabold text-slate-800 leading-tight">
              Mode · {{ activeMeta.label }}
            </h2>
            <p class="text-[11px] text-slate-600 leading-tight mt-0.5">{{ activeMeta.blurb }}</p>
          </div>
          <CloseDot size="lg" aria-label="Close Mode menu" @click="emit('close')" />
        </header>

        <!-- Body -->
        <div class="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          <!-- ACTIVE mode card -->
          <section :class="['rounded-xl border-2 p-4', modeAccentClass(activeMeta.id)]">
            <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-800">Active settings</h3>
              <span class="text-[10px] text-slate-600 italic">applied to every LLM call in this mode</span>
            </div>
            <ul class="text-[12px] text-slate-700 space-y-1 mb-3">
              <li v-for="(line, i) in configSummary(activeMeta.id)" :key="i" class="flex items-start gap-1.5">
                <span class="text-slate-400 mt-0.5">•</span>
                <span>{{ line }}</span>
              </li>
            </ul>
            <button
              type="button"
              class="w-full px-3 py-2 rounded-lg text-sm font-bold bg-white text-violet-700 hover:bg-violet-50 border-2 border-violet-300 shadow-sm flex items-center justify-center gap-1.5 transition-colors"
              :title="`Open Settings on the ${activeMeta.label} Mode section to adjust the 4-axis config (or whichever controls apply).  All current settings persist.`"
              @click="emit('open-settings', activeMeta.settingsSectionId)"
            >
              <span>⚙</span>
              <span>Adjust settings for {{ activeMeta.label }} Mode →</span>
            </button>
          </section>

          <!-- OTHER modes -->
          <section>
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2">Switch to another mode</h3>
            <p class="text-[11px] text-slate-600 mb-3">Tom Gilb 2026-06-16: <em>"when changing mode, there must be a governance of auto save of the version, in the right history (Model, Plan etc), and a choice of 1. Fresh Start, 2. Reuse this current model in the new Mode."</em>  Picking a mode below opens a governance dialog where you pick Fresh Start vs Reuse.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="m in otherModes"
                :key="m.id"
                type="button"
                class="text-left rounded-xl border-2 p-3 hover:shadow-md transition-all flex flex-col gap-1"
                :class="modeAccentClass(m.id)"
                :title="`Switch to ${m.label} Mode.  Auto-save the current work to ${activeMeta.historyName} first, then choose Fresh Start vs Reuse.`"
                @click="emit('request-switch', m.id)"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xl">{{ m.emoji }}</span>
                  <span class="text-sm font-extrabold text-slate-800">{{ m.label }}</span>
                </div>
                <p class="text-[11px] text-slate-700 leading-snug">{{ m.blurb }}</p>
                <span class="text-[10px] text-slate-500 italic mt-1">→ auto-saves land in {{ m.historyName }}</span>
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  </Teleport>
</template>
