<!-- UNIT_TYPE=Panel -->
<!--
 * IetSettingsPanel.vue — Stage 4 Impacts local Settings drawer (Phase 2).
 *
 * v477 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #3 Stage 4
 * Impacts Phase 2).  Tom's verbatim design at memory/rule_stage_4_impacts_
 * design.md: *"An IET Settings Panel, here locally, can set degree of
 * conservative or risky estimates."*
 *
 * Presents three interrelated dials from useIetSettings:
 *   - conservatism (0-100) — the leaning applied to auto-generated
 *     assumptions.  Slider with live human-readable label.
 *   - credibilityThreshold (0.0-1.0 CE-book scale) — threshold below which
 *     cells get flagged as "needs evidence".  Slider with live label.
 *   - autoAssumeStrength (0-100%) — how heavily to apply the conservatism
 *     dial when auto-generating.  Slider (persisted as 0.0-1.0 factor).
 *
 * Plus context strip explaining the CE-book Credibility scale bands and a
 * reset-to-defaults pin.
 *
 * Composes with:
 *   - rule_stage_4_impacts_design.md SUPREME (this panel IS the enforcement
 *     of Tom's IET Settings Panel design brief)
 *   - CloseDot SUPREME (drawer has close affordance)
 *   - MOVE Principle SUPREME (sliders visible at-a-glance, no menu-dive)
 *   - DD-009 Zero-Training UI (each slider carries plain-English HoverHint
 *     + live label naming what the current value means)
 *   - Icon-Plus-Text SUPREME (each dial has glyph + plain-English label)
 *   - No-Silent-Data-Loss SUPREME (settings auto-persist via useIetSettings
 *     watch handler)
 *   - Twin portability — pure Vue SFC + composable; ports verbatim
 -->
<script setup lang="ts">
import { computed } from 'vue'
import CloseDot from './CloseDot.vue'
import { useIetSettings } from '../composables/useIetSettings'

defineProps<{
  /** Controls drawer visibility via v-if in the parent. */
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  settings,
  conservatismLabelText,
  credibilityThresholdLabelText,
  resetToDefaults,
} = useIetSettings()

// Slider mirror for autoAssumeStrength — displayed as 0-100 (%) but stored 0-1.
const autoAssumePercent = computed<number>({
  get: () => Math.round(settings.value.autoAssumeStrength * 100),
  set: (v: number) => { settings.value.autoAssumeStrength = Math.max(0, Math.min(100, v)) / 100 },
})

// Slider mirror for credibilityThreshold — displayed 0-100 (%) but stored 0-1.
const credibilityPercent = computed<number>({
  get: () => Math.round(settings.value.credibilityThreshold * 100),
  set: (v: number) => { settings.value.credibilityThreshold = Math.max(0, Math.min(100, v)) / 100 },
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[610] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iet-settings-title"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel card -->
      <div
        class="pointer-events-auto relative w-full max-w-lg mx-4 rounded-2xl bg-white ring-1 ring-slate-300 shadow-2xl overflow-hidden"
      >
        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-cyan-800 via-teal-800 to-cyan-900 text-white">
          <span aria-hidden="true" class="text-xl leading-none">⚙</span>
          <div class="flex-1 min-w-0">
            <h2 id="iet-settings-title" class="text-sm font-bold tracking-wide">
              Stage 4 · IET Settings
            </h2>
            <p class="text-[10.5px] text-cyan-100/90 mt-0.5 leading-snug">
              Local settings for Impact Estimation — Conservative vs Risky · CE-book Credibility scale
            </p>
          </div>
          <CloseDot variant="on-dark" size="lg" title="Close IET Settings" aria-label="Close IET Settings" @click="emit('close')" />
        </header>

        <!-- Body -->
        <div class="px-5 py-4 space-y-5 text-sm text-slate-800">

          <!-- Conservatism slider -->
          <div>
            <label for="iet-conservatism" class="block">
              <span class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <span aria-hidden="true">📉</span> Conservatism
                </span>
                <span class="text-[11px] font-semibold text-cyan-800 tabular-nums">
                  {{ settings.conservatism }}/100 · {{ conservatismLabelText }}
                </span>
              </span>
              <input
                id="iet-conservatism"
                v-model.number="settings.conservatism"
                type="range"
                min="0"
                max="100"
                step="5"
                class="w-full accent-cyan-700"
                title="How far to lean when auto-generating conservative assumptions.  0 = risk-neutral (best-guess median).  100 = maximally conservative (low value impact, high resource cost, huge ± uncertainty)."
              />
              <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Risky (best guess)</span>
                <span>Balanced</span>
                <span>Maximally conservative</span>
              </div>
            </label>
          </div>

          <!-- Credibility threshold slider -->
          <div>
            <label for="iet-credibility" class="block">
              <span class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <span aria-hidden="true">🔍</span> Credibility Threshold
                </span>
                <span class="text-[11px] font-semibold text-cyan-800 tabular-nums">
                  {{ credibilityPercent }}/100 · {{ credibilityThresholdLabelText }}
                </span>
              </span>
              <input
                id="iet-credibility"
                v-model.number="credibilityPercent"
                type="range"
                min="0"
                max="100"
                step="5"
                class="w-full accent-cyan-700"
                title="CE-book Credibility scale threshold.  Cells with credibility below this get flagged as 'needs evidence'.  0 = flag only pure guesses.  100 = flag anything below direct measurement."
              />
              <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Guess only</span>
                <span>Anecdotal</span>
                <span>Weak source</span>
                <span>Study grade</span>
                <span>Measured</span>
              </div>
            </label>
          </div>

          <!-- Auto-assume strength slider -->
          <div>
            <label for="iet-autoassume" class="block">
              <span class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <span aria-hidden="true">🤖</span> Auto-Assumption Strength
                </span>
                <span class="text-[11px] font-semibold text-cyan-800 tabular-nums">
                  {{ autoAssumePercent }}%
                </span>
              </span>
              <input
                id="iet-autoassume"
                v-model.number="autoAssumePercent"
                type="range"
                min="0"
                max="100"
                step="5"
                class="w-full accent-cyan-700"
                title="How heavily to apply the conservatism dial when auto-generating assumptions.  100% = full effect; 0% = disabled (planner must fill every cell manually)."
              />
              <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Off</span>
                <span>Half strength</span>
                <span>Full effect</span>
              </div>
            </label>
          </div>

          <!-- CE-book Credibility scale reference -->
          <details class="rounded-lg bg-cyan-50 ring-1 ring-cyan-200 px-3 py-2">
            <summary class="text-[11px] font-bold text-cyan-900 cursor-pointer select-none">
              📖 CE-book Credibility scale (Gilb 2005) — Reference
            </summary>
            <ul class="mt-2 text-[11px] text-slate-700 space-y-1 leading-snug">
              <li><span class="tabular-nums font-semibold">0.0</span> — pure guess / no evidence at all</li>
              <li><span class="tabular-nums font-semibold">0.2</span> — single anecdote or unattributed opinion</li>
              <li><span class="tabular-nums font-semibold">0.4</span> — one weak source (blog post, forum comment)</li>
              <li><span class="tabular-nums font-semibold">0.5</span> — single strong source or a couple of weak sources</li>
              <li><span class="tabular-nums font-semibold">0.6</span> — two or more strong sources, independent</li>
              <li><span class="tabular-nums font-semibold">0.8</span> — published study or vendor benchmark, verifiable</li>
              <li><span class="tabular-nums font-semibold">1.0</span> — direct measurement from THIS system's own data</li>
            </ul>
          </details>
        </div>

        <!-- Footer -->
        <footer class="flex items-center justify-between gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            class="h-8 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            title="Reset all three IET settings to their shipped defaults (Conservatism 60/100, Credibility Threshold 40%, Auto-Assumption Strength 100%)."
            @click="resetToDefaults"
          >⟲ Reset to defaults</button>
          <button
            type="button"
            class="h-8 px-4 rounded-lg text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 shadow-sm"
            title="Close — settings are already saved automatically as you slide.  No apply-button needed (No-Silent-Data-Loss SUPREME)."
            @click="emit('close')"
          >Done</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
