<script setup lang="ts">
/**
 * ModeSwitchGovernanceDialog — Tom Gilb 2026-06-16 verbatim:
 *
 *   "when changing mode, there must be a governance of auto save of the
 *    version, in the right history (Model, Plan etc), and a choice of
 *    1. Fresh Start, 2. Reuse this current model in the new Mode."
 *
 * Surfaces AFTER the user picks a target mode in ActiveModePopover but BEFORE
 * the switch lands.  Composes No-Silent-Data-Loss SUPREME (auto-save is
 * automatic + named; the user can't lose work by switching modes).
 */

import { computed, onMounted, onBeforeUnmount } from 'vue'
import CloseDot from './CloseDot.vue'
import { useActiveMode, type ModeSwitchChoice, ACTIVE_MODE_META } from '../composables/useActiveMode'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  /** Fires on Cancel (or backdrop / Escape). */
  cancel: []
  /** Fires when user picks a governance option.  Host applies the side
   *  effects (auto-save current artifact, copy-into-new-mode if 'reuse',
   *  then call activeMode.resolveSwitch). */
  resolve: [choice: ModeSwitchChoice]
}>()

const { pendingSwitch } = useActiveMode()

const fromMeta = computed(() => pendingSwitch.value ? ACTIVE_MODE_META[pendingSwitch.value.fromMode] : null)
const toMeta   = computed(() => pendingSwitch.value ? ACTIVE_MODE_META[pendingSwitch.value.toMode]   : null)

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) emit('cancel')
}
onMounted(() => document.addEventListener('keydown', _onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', _onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && fromMeta && toMeta"
      class="fixed inset-0 z-[2200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-switch-title"
    >
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="emit('cancel')"></div>

      <div
        class="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border-2 border-amber-300 flex flex-col overflow-hidden"
        @click.stop
      >
        <!-- Header -->
        <header class="px-5 py-3 border-b-2 border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 flex items-center gap-2 shrink-0">
          <span class="text-2xl">⚖</span>
          <div class="flex-1 min-w-0">
            <h2 id="mode-switch-title" class="text-base font-extrabold text-slate-800 leading-tight">
              Mode change governance
            </h2>
            <p class="text-[11px] text-slate-700 leading-tight mt-0.5">
              Switching <strong>{{ fromMeta.emoji }} {{ fromMeta.label }}</strong> → <strong>{{ toMeta.emoji }} {{ toMeta.label }}</strong>
            </p>
          </div>
          <CloseDot size="lg" aria-label="Cancel mode change" @click="emit('cancel')" />
        </header>

        <!-- Body -->
        <div class="px-5 py-4 space-y-4">

          <p class="text-[12px] text-slate-700 leading-snug">
            Your current work will be <strong>auto-saved to {{ fromMeta.historyName }}</strong> before the switch.  You won't lose anything.  Now pick what happens next:
          </p>

          <!-- Fresh Start -->
          <button
            type="button"
            class="w-full text-left rounded-xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 p-4 flex items-start gap-3 transition-colors"
            title="Save current work to Past Versions, then start fresh in the new mode with a blank workspace."
            @click="emit('resolve', 'fresh')"
          >
            <span class="text-2xl shrink-0">🆕</span>
            <div class="flex-1">
              <p class="text-sm font-extrabold text-rose-900 mb-1">Fresh Start in {{ toMeta.label }} Mode</p>
              <p class="text-[11px] text-rose-800 leading-snug">Save current work to <strong>{{ fromMeta.historyName }}</strong>, then enter <strong>{{ toMeta.label }} Mode</strong> with a blank workspace.  The new mode's defaults apply.</p>
            </div>
          </button>

          <!-- Reuse -->
          <button
            type="button"
            class="w-full text-left rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 p-4 flex items-start gap-3 transition-colors"
            title="Save current work to Past Versions, then carry the current artifact into the new mode as a starting point."
            @click="emit('resolve', 'reuse')"
          >
            <span class="text-2xl shrink-0">♻️</span>
            <div class="flex-1">
              <p class="text-sm font-extrabold text-emerald-900 mb-1">Reuse current artifact in {{ toMeta.label }} Mode</p>
              <p class="text-[11px] text-emerald-800 leading-snug">Save current work to <strong>{{ fromMeta.historyName }}</strong>, then carry the current artifact across as the starting point in <strong>{{ toMeta.label }} Mode</strong>.  Useful when you want to repurpose the same content under a different mode's standards / presentation / purpose.</p>
            </div>
          </button>

          <!-- Cancel -->
          <button
            type="button"
            class="w-full px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 bg-white"
            title="Stay in the current mode — no changes."
            @click="emit('cancel')"
          >Cancel — stay in {{ fromMeta.label }} Mode</button>

        </div>
      </div>
    </div>
  </Teleport>
</template>
