<script setup lang="ts">
/**
 * ActiveModeButton — always-visible title-bar Mode pin.
 *
 * Tom Gilb 2026-06-16 verbatim: *"Mode will be clearly displayed 'Mode:.....'
 * and clicking it will allow us to select 1. the settings level subsets of
 * that mode, and going to another mode.  Hovering over the always present
 * MODE button will display the currently selected settings"*.
 *
 * Renders:
 *   - "Mode: <emoji> <name>" pill in the title bar
 *   - Hover HoverHint shows the currently-active rich-config summary
 *   - Click toggles the ActiveModePopover (host renders it)
 *
 * Composes with: MOVE Principle SUPREME (always visible), DD-009 Interaction
 * Disclosure (HoverHint explains state), Tom-is-85 accessibility baseline
 * (large hit target, high contrast).
 */

import { computed } from 'vue'
import { useActiveMode } from '../composables/useActiveMode'
import { useSettings } from '../composables/useSettings'

defineEmits<{
  /** Fires on click — host opens the ActiveModePopover. */
  click: []
}>()

const { activeMeta } = useActiveMode()
const { settings } = useSettings()

/** Compose a one-line summary of the active mode's rich config for the
 *  HoverHint.  Tom Gilb 2026-06-16: "Hovering over the always present MODE
 *  button will display the currently selected settings". */
const hoverHintSummary = computed<string>(() => {
  const m = activeMeta.value.id
  if (m === 'plan') {
    return `Mode: Plan (canonical Stakes-Ends-Means workflow)\n\nApp Mode setting: ${settings.value.mode === 'pro-sem' ? 'Pro SEM (full toolkit)' : 'Ultra Light (minimal)'}\n\nClick to switch mode or adjust settings.`
  }
  if (m === 'model') {
    const c = settings.value.modelMode
    return `Mode: Model — ${activeMeta.value.blurb}\n\n` +
      `• Domain: ${c.domain}\n` +
      `• Presentation: ${c.presentation}\n` +
      `• Standards: ${c.standards.length} built-in + ${c.standardsCustomUrls.filter(u => u.trim()).length} custom URLs${c.searchForAdditionalStandards ? ' + 🔍 search additional' : ''}\n` +
      `• Purpose${c.purposes.length === 1 ? '' : 's'}: ${c.purposes.length > 0 ? c.purposes.join(', ') : '(none — defaults to management-decision-making)'}\n\n` +
      `Click to switch mode or adjust settings.`
  }
  if (m === 'contract') {
    const c = settings.value.contractsMode
    return `Mode: Contract — ${activeMeta.value.blurb}\n\n` +
      `• Sharpening: ${c.applyContractSharpening ? 'ON' : 'off'}\n` +
      `• Standards: ${c.standards.length} built-in + ${c.standardsCustomUrls.filter(u => u.trim()).length} custom URLs\n` +
      `• Presentation: ${c.presentation}\n` +
      `• Purpose${c.purposes.length === 1 ? '' : 's'}: ${c.purposes.length > 0 ? c.purposes.join(', ') : '(none — defaults to strict-analytical)'}\n\n` +
      `Click to switch mode or adjust settings.`
  }
  if (m === 'strategy') {
    const t = settings.value.strategyTerminology
    return `Mode: Strategy — ${activeMeta.value.blurb}\n\n` +
      `• Values → ${t.valueTerm}\n` +
      `• Solutions → ${t.solutionTerm}\n` +
      `• Evo Steps → ${t.evoStepTerm}\n` +
      `• Owner role → ${t.ownerRoleTerm}\n\n` +
      `Click to switch mode or adjust settings.`
  }
  return 'Mode'
})

/** Active-mode accent — distinguishes the button colour by current mode. */
const accentClass = computed<string>(() => {
  switch (activeMeta.value.id) {
    case 'plan':     return 'from-violet-500 to-indigo-500 ring-violet-300'
    case 'model':    return 'from-blue-500 to-cyan-500 ring-blue-300'
    case 'contract': return 'from-teal-600 to-emerald-600 ring-teal-300'
    case 'strategy': return 'from-orange-600 to-rose-600 ring-orange-300'  // r41 v50
    default:         return 'from-slate-500 to-slate-600 ring-slate-300'
  }
})
</script>

<template>
  <button
    type="button"
    class="h-12 px-3 flex items-center gap-2 rounded-xl leading-none font-extrabold
           text-white shadow-xl ring-2 ring-white/70 hover:ring-white
           focus:outline-none focus:ring-4 transition-all shrink-0
           bg-gradient-to-br"
    :class="accentClass"
    :title="hoverHintSummary"
    aria-haspopup="dialog"
    :aria-label="`Mode: ${activeMeta.label}.  Click to switch modes or adjust settings.`"
    data-crest-tip="Mode — click to switch or adjust this mode's settings"
    @click="$emit('click')"
  >
    <span class="text-[10px] font-bold uppercase tracking-wider opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">Mode:</span>
    <span class="text-[22px] leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" aria-hidden="true">{{ activeMeta.emoji }}</span>
    <span class="text-base tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">{{ activeMeta.label }}</span>
  </button>
</template>
