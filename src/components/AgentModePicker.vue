<!-- UNIT_TYPE=Component
  AgentModePicker.vue — single-pin-per-agent mode dispatcher.

  Tom Gilb 2026-06-20 verbatim: "I think we need only one agent, not 2 as you
  have constructed, in th mene, but we can choose various agent modes, such
  as Sharpening Mode, or Agent Principles Mode. and maybe others (Like:
  Analysis Only, Improvement Mode, Create Optional Version Mode)".

  Architecture: ONE pin per agent in the AgentsStrip; clicking it opens
  this picker; the picker lists modes for that agent and emits `select-mode`
  with the chosen mode key.  App.vue dispatches the existing per-mode
  handler (Panel for analysis/improvement, SharpeningPanel for sharpening,
  toast for not-yet-built modes).

  Modes shipped (Phase 1):
    1. Agent Principles  — read-only info: the agent's principles + sources.
    2. Analysis          — run the deterministic rule engine; review findings.
    3. Improvement       — same as Analysis but emphasizes Accept-Fix actions.
    4. Sharpening Q&A    — guided Q&A interview (Elon/Incorruptible only —
                          Munger shows a Phase 2 toast).
    5. Create Optional   — clone the spec, apply fixes to the clone, compare
       Version           — versions (Phase 2 — toast for now).

  Composes with: MOVE Principle (modes visible at-a-glance per agent),
  CloseDot SUPREME, DD-009 Zero-Training UI (each mode HoverHint spells out
  the effect), Icon-Plus-Text SUPREME, accessibility_tom.md (large tiles,
  Escape to close).
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { AgentRegistryId } from '../composables/useAgentRegistry'
import { AGENT_REGISTRY } from '../composables/useAgentRegistry'
import CloseDot from './CloseDot.vue'

type AgentModeKey =
  | 'principles'           // read the agent's principles + sources
  | 'analysis'             // analysis-only, no fixes applied
  | 'improvement'          // analysis + Accept-Fix actions
  | 'sharpening'           // guided Q&A interview
  | 'create-optional'      // clone spec, work speculatively

const props = defineProps<{
  /** Registry id of the agent the planner clicked.  Picker reads
   *  AGENT_REGISTRY[agentId] for the header (image / label / subtitle). */
  agentId: AgentRegistryId
}>()

const emit = defineEmits<{
  close: []
  'select-mode': [mode: AgentModeKey]
}>()

const identity = computed(() => AGENT_REGISTRY[props.agentId] ?? null)

/** Per-agent supported modes.  Most agents support 1-4; Phase-2 modes
 *  return a "coming soon" toast in App.vue.  All modes ALWAYS appear in
 *  the picker so the planner sees the complete pattern across every agent
 *  (DD-009 Zero-Training UI — same mental model everywhere). */
const SUPPORT_MAP: Record<AgentRegistryId, AgentModeKey[]> = {
  'maria':                 ['principles', 'analysis', 'improvement'],
  'contracts':             ['principles', 'analysis', 'improvement'],
  'models':                ['principles', 'analysis', 'create-optional'],
  'stakeholder-mapper':    ['principles', 'analysis', 'improvement', 'create-optional'],
  'evo-step-critique':     ['principles', 'analysis', 'sharpening', 'improvement'],
  'plan-importer':         ['principles', 'analysis'],
  'decisions':             ['principles', 'analysis', 'improvement'],
  'strategy-agent':        ['principles', 'analysis', 'sharpening', 'improvement'],
  'incorruptible':         ['principles', 'analysis', 'sharpening', 'improvement'],
  'incorruptible-sharpen': ['principles', 'analysis', 'sharpening', 'improvement'],
  'elon':                  ['principles', 'analysis', 'sharpening', 'improvement'],
  'elon-sharpen':          ['principles', 'analysis', 'sharpening', 'improvement'],
  'munger':                ['principles', 'analysis', 'sharpening', 'improvement'],
  'munger-sharpen':        ['principles', 'analysis', 'sharpening', 'improvement'],
  'autoDbo':               ['principles', 'analysis', 'create-optional'],
}

const modes = computed<AgentModeKey[]>(() => SUPPORT_MAP[props.agentId] ?? ['principles', 'analysis'])

interface ModeMeta {
  key: AgentModeKey
  label: string
  glyph: string
  blurb: string
  hint: string
  accent: string
}

const MODE_META: Record<AgentModeKey, ModeMeta> = {
  'principles': {
    key: 'principles', glyph: '📖', label: 'Agent Principles',
    blurb: 'Read the agent\'s principles, sources, and the story behind it.',
    hint: 'Opens the agent\'s principles card: who it cites (Munger / Musk / Ries / Maria Montessori / etc.), the sources, and the verifiable references.  No action on the spec — pure context.',
    accent: 'slate',
  },
  'analysis': {
    key: 'analysis', glyph: '🔍', label: 'Analysis',
    blurb: 'Run the agent\'s deterministic rule engine over your spec; review findings without applying fixes.',
    hint: 'The agent scans the current spec and lists every finding by severity and category.  You can Dismiss findings, view citations, see the Rationality / Velocity / Health Score — but the spec is not modified.  Safe for exploration.',
    accent: 'amber',
  },
  'improvement': {
    key: 'improvement', glyph: '🛠', label: 'Improvement',
    blurb: 'Analysis + Accept-Fix: apply the agent\'s suggested Planguage edits directly to the spec.',
    hint: 'Same as Analysis, but each finding has an Accept-Fix button that applies the suggested edit (new Constraint, new Value, source-stamped Stakeholder etc.) to your active spec.  Universal Undo wired automatically.',
    accent: 'emerald',
  },
  'sharpening': {
    key: 'sharpening', glyph: '🔪', label: 'Sharpening Q&A',
    blurb: 'Guided question-and-answer interview — the agent asks, you answer, the spec sharpens.',
    hint: 'Q&A flow tailored to the agent\'s framework.  Each question carries 3 AI-suggested starter answers with provenance (Plan / Cited / Template).  Your answers route through the Accept-Fix pipeline so the spec evolves as the interview progresses.',
    accent: 'violet',
  },
  'create-optional': {
    key: 'create-optional', glyph: '🌱', label: 'Create Optional Version',
    blurb: 'Clone the spec into an alternative version; apply the agent\'s fixes to the clone; compare versions before promoting.',
    hint: 'Branch-and-explore mode.  The agent\'s edits land on a sibling spec snapshot — your master is unchanged.  Compare via IET / MultiVision / DBO once both versions have evolved.  Promote the winner when ready.',
    accent: 'cyan',
  },
}

// ── Tile colour palette ────────────────────────────────────────────────────
const TILE_COLOURS: Record<string, { bg: string; ring: string; text: string; glyph: string; hover: string }> = {
  slate:   { bg: 'bg-slate-50',   ring: 'ring-slate-300',   text: 'text-slate-900',   glyph: 'text-slate-700',   hover: 'hover:bg-slate-100' },
  amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-300',   text: 'text-amber-950',   glyph: 'text-amber-700',   hover: 'hover:bg-amber-100' },
  emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-300', text: 'text-emerald-950', glyph: 'text-emerald-700', hover: 'hover:bg-emerald-100' },
  violet:  { bg: 'bg-violet-50',  ring: 'ring-violet-300',  text: 'text-violet-950',  glyph: 'text-violet-700',  hover: 'hover:bg-violet-100' },
  cyan:    { bg: 'bg-cyan-50',    ring: 'ring-cyan-300',    text: 'text-cyan-950',    glyph: 'text-cyan-700',    hover: 'hover:bg-cyan-100' },
}

function pick(mode: AgentModeKey): void {
  emit('select-mode', mode)
}

// ── Escape + body-lock ────────────────────────────────────────────────────
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[480] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      :aria-label="`${identity?.label ?? 'Agent'} — pick a mode`"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel -->
      <div class="relative w-[min(94vw,860px)] max-h-[88vh] rounded-2xl bg-white shadow-2xl ring-2 ring-slate-200 flex flex-col overflow-hidden">
        <!-- Header -->
        <div
          v-if="identity"
          :class="identity.headerGradient"
          class="text-white px-6 py-4 flex items-center gap-4 shadow-md"
        >
          <img
            :src="identity.image"
            :alt="identity.label"
            class="h-14 w-14 rounded-full ring-2 ring-white/70 object-cover shrink-0"
          />
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">{{ identity.label }}</h1>
            <p class="text-xs text-white/85 leading-snug">{{ identity.subtitle }}</p>
          </div>
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Sub-header — picker intro -->
        <div class="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <p class="text-sm font-semibold text-slate-800">
            Pick a mode
          </p>
          <p class="text-xs text-slate-500 leading-snug">
            Every agent supports several modes.  Choose how you want {{ identity?.label ?? 'this agent' }} to engage with your spec right now — read its principles, run an analysis, accept improvements, or branch a sibling version.
          </p>
        </div>

        <!-- Mode tile grid -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              v-for="key in modes"
              :key="key"
              type="button"
              :class="[
                TILE_COLOURS[MODE_META[key].accent].bg,
                TILE_COLOURS[MODE_META[key].accent].ring,
                TILE_COLOURS[MODE_META[key].accent].hover,
                'ring-2 rounded-xl px-4 py-4 text-left flex items-start gap-3 transition-colors duration-150 focus:outline-none focus-visible:ring-4',
              ]"
              :title="MODE_META[key].hint"
              :aria-label="`${MODE_META[key].label} — ${MODE_META[key].blurb}`"
              @click="pick(key)"
            >
              <span :class="['text-3xl shrink-0 leading-none', TILE_COLOURS[MODE_META[key].accent].glyph]" aria-hidden="true">{{ MODE_META[key].glyph }}</span>
              <span class="flex-1 min-w-0">
                <span :class="['block text-base font-extrabold leading-tight', TILE_COLOURS[MODE_META[key].accent].text]">{{ MODE_META[key].label }}</span>
                <span class="block text-[12px] text-slate-700 leading-snug mt-1">{{ MODE_META[key].blurb }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <span class="text-[11px] text-slate-500 leading-snug flex-1">
            Tip — every agent has the same mode pattern (Principles · Analysis · Improvement · Sharpening Q&A · Create Optional Version).  Some modes are pending build and will show a "coming soon" message.
          </span>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
