<!-- UNIT_TYPE=Widget -->
<!--
 * ActiveModelChip.vue — persistent "which AI is talking to me" chip.
 *
 * v415 (Tom Gilb 2026-07-01 verbatim "Can you put a word or symbol telling me
 * exactly which agent we are using for running SEM, on the sem surface,
 * especially llama.  Is this something I can adjust in my settings?"):
 * Provides an always-visible identity strip so the planner knows AT-A-GLANCE
 * whether SEM is talking to Claude Sonnet, Claude Opus, or a local Ollama /
 * Llama model.  Critical because model choice dramatically affects output
 * quality (2026-05-30 "11 hours wasted with Haiku" lesson).
 *
 * Two visual states:
 *   - strong  = Anthropic Claude (default, dark-navy chip with 🤖 glyph)
 *   - caution = Local Ollama / Llama (amber chip with 🦙 glyph)
 *
 * HoverHint spells out (a) exactly which model is active, (b) how to switch
 * providers today (edit .env.local + restart Vite), (c) that a runtime
 * Settings toggle is planned for Phase 2.
 *
 * Composes with:
 *   - MOVE Principle SUPREME (visible at-a-glance, no menu-dive)
 *   - DD-009 Zero-Training UI (HoverHint carries the switching instructions)
 *   - Icon-Plus-Text SUPREME (glyph + label)
 *   - Model Selection SUPREME (2026-05-30 Haiku lesson — the planner should
 *     never have to guess which model is answering)
 *   - Claude-Code-as-AI-Layer SUPREME (transparent about the AI provider chain)
 *   - Twin portability — pure Vue SFC; ports verbatim to Kai's Twin
 -->
<script setup lang="ts">
import { useActiveModel } from '../composables/useActiveModel'

const { activeModel } = useActiveModel()
</script>

<template>
  <div
    class="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold ring-1 shadow-sm cursor-help select-none whitespace-nowrap"
    :class="activeModel.theme === 'caution'
      ? 'bg-amber-100 text-amber-900 ring-amber-400'
      : 'bg-slate-800 text-slate-100 ring-slate-500'"
    :title="activeModel.hint"
    :aria-label="`Active AI model: ${activeModel.displayName}. ${activeModel.hint}`"
    role="status"
  >
    <span aria-hidden="true" class="text-[13px] leading-none">{{ activeModel.glyph }}</span>
    <span class="uppercase tracking-wider text-[9px] font-bold opacity-70">Model:</span>
    <span>{{ activeModel.displayName }}</span>
  </div>
</template>
