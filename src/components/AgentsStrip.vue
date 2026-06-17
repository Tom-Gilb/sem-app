<!--
  AgentsStrip.vue — r41 v126 (Tom Gilb 2026-06-17 verbatim "damn the text
  disappeared. avoid emoj glyphs, seek more relevant and exiting glyphs.
  agent: Use Picture of space x rockets captured for example, Maria, a head
  shot of Maria Montessori. Incorruptible, Shot of eric book cover").

  LEVEL 3 · AGENTS — own top-level component, autonomy-axis Level 3.

  ★ IMAGE-BASED PINS — every agent has a vivid, distinctive visual:
   - Real photos for the 3 Tom named (Maria Montessori headshot · SpaceX
     Falcon 9 launch · Eric Ries portrait)
   - Vivid emoji-shape placeholders for the other 10 (each one chosen for
     distinct conceptual resonance, not generic; will upgrade to real
     imagery as Tom names sources in future sessions)

  ★ TEXT FIXED — labels are now white-on-pin with text-[11px] font-extrabold
   guaranteed-contrast (the previous text-amber-950 on amber-500 was the
   "damn the text disappeared" regression).

  ★ TALLER PINS — h-14 (was h-10) to host real image at 32×32 + clearly
   readable label below.  Per Icon-Plus-Text SUPREME, every pin still has
   both glyph + plain-English text.

  Composes with: MOVE Principle (every agent visible), Icon-Plus-Text
  SUPREME (image + label), DD-009 Zero-Training UI (HoverHint names role +
  sources), DD-012 No-Generic-Icon-Libraries (real photos encode SEM-
  specific meaning), Twin portability.
-->
<script setup lang="ts">
// r41 v133 — consume the shared AGENT_REGISTRY for image + accent + rich
//   HoverHint per Tom Gilb 2026-06-17 verbatim "the hover for icon info is
//   a universal rule everywhere".  Single source of truth shared with
//   AgentMenuPanel — same identity in both surfaces.
import { AGENT_REGISTRY, type AgentRegistryId } from '../composables/useAgentRegistry'

defineProps<{
  hasSpec: boolean
}>()

const emit = defineEmits<{
  'open-maria':                 []
  'open-contracts':             []
  'open-models':                []
  'open-stakeholder-mapper':    []
  'open-evo-critiquer':         []
  'open-spec-importer':         []
  'open-decisions':             []
  'open-strategy':              []
  'open-incorruptible':         []
  'open-incorruptible-sharpen': []
  'open-elon':                  []
  'open-elon-sharpen':          []
  'open-auto-dbo':              []
}>()

type Emits =
  | 'open-maria' | 'open-contracts' | 'open-models' | 'open-stakeholder-mapper'
  | 'open-evo-critiquer' | 'open-spec-importer' | 'open-decisions'
  | 'open-strategy' | 'open-incorruptible' | 'open-incorruptible-sharpen'
  | 'open-elon' | 'open-elon-sharpen' | 'open-auto-dbo'

interface AgentPin {
  /** Identity image — sourced from the shared AGENT_REGISTRY. */
  image: string
  label: string
  event: Emits
  accent: string
  title: string
}

/** Pin event mapping — registry id → AgentsStrip emit name. */
const PIN_EVENT: Record<AgentRegistryId, Emits> = {
  'maria':                 'open-maria',
  'contracts':             'open-contracts',
  'models':                'open-models',
  'stakeholder-mapper':    'open-stakeholder-mapper',
  'evo-step-critique':     'open-evo-critiquer',
  'plan-importer':         'open-spec-importer',
  'decisions':             'open-decisions',
  'strategy-agent':        'open-strategy',
  'incorruptible':         'open-incorruptible',
  'incorruptible-sharpen': 'open-incorruptible-sharpen',
  'elon':                  'open-elon',
  'elon-sharpen':          'open-elon-sharpen',
  'autoDbo':               'open-auto-dbo',
}

/** Display order — top-N agents most-used first (Tom can re-order anytime). */
const PIN_ORDER: AgentRegistryId[] = [
  'maria',
  'contracts',
  'models',
  'stakeholder-mapper',
  'evo-step-critique',
  'plan-importer',
  'decisions',
  'strategy-agent',
  'incorruptible',
  'incorruptible-sharpen',
  'elon',
  'elon-sharpen',
  'autoDbo',
]

/** r41 v133 — AGENT_PINS derived from the shared registry; single
 *  source of truth with AgentMenuPanel.  Adding agent #14 = one entry
 *  in useAgentRegistry.ts + PIN_EVENT mapping + PIN_ORDER position. */
const AGENT_PINS: AgentPin[] = PIN_ORDER.map((id) => ({
  image:  AGENT_REGISTRY[id].image,
  label:  AGENT_REGISTRY[id].shortLabel,
  event:  PIN_EVENT[id],
  accent: AGENT_REGISTRY[id].accent,
  title:  AGENT_REGISTRY[id].richTitle,
}))

/** Tailwind ring + focus palette per accent — keeps class names static so JIT sees them. */
const ACCENT_RING: Record<string, string> = {
  emerald: 'ring-emerald-300/60 focus:ring-emerald-300',
  teal:    'ring-teal-300/60    focus:ring-teal-300',
  blue:    'ring-blue-300/60    focus:ring-blue-300',
  indigo:  'ring-indigo-300/60  focus:ring-indigo-300',
  violet:  'ring-violet-300/60  focus:ring-violet-300',
  orange:  'ring-orange-300/60  focus:ring-orange-300',
  rose:    'ring-rose-300/60    focus:ring-rose-300',
  amber:   'ring-amber-300/60   focus:ring-amber-300',
  cyan:    'ring-cyan-300/60    focus:ring-cyan-300',
  slate:   'ring-slate-300/60   focus:ring-slate-300',
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-2 px-3 py-2 bg-gradient-to-br from-slate-800/70 via-emerald-950/40 to-slate-800/70 border-y border-amber-300/30 text-white"
    aria-label="Level 3 — Agents (emerging category of autonomous AI collaborators)"
  >
    <!-- Group title — elevated styling per the "emerging category" framing -->
    <div class="shrink-0 flex flex-col gap-0.5 mr-1 self-end">
      <span class="text-[9px] font-bold text-amber-200/90 uppercase tracking-widest leading-none flex items-center gap-1">
        <span aria-hidden="true">✨</span>
        Emerging Category
      </span>
      <span class="text-[12px] font-extrabold text-amber-100 uppercase tracking-wider leading-none whitespace-nowrap drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
        Level 3 · Agents
      </span>
    </div>

    <!-- Agent pins — h-14 to host real image (32×32) + clearly readable label.
         Container is flex-wrap so all 13 lay out cleanly on any width. -->
    <div
      class="shrink-0 flex flex-wrap items-center gap-1.5 rounded-2xl bg-gradient-to-br from-emerald-900/70 to-amber-900/50 ring-1 ring-amber-300/40 px-2 py-1.5 self-end shadow-[0_0_14px_rgba(251,191,36,0.2)] max-w-full"
    >
      <button
        v-for="pin in AGENT_PINS"
        :key="pin.event"
        type="button"
        class="h-14 w-[72px] flex flex-col items-center justify-start gap-1 px-1 pt-1 pb-0.5 rounded-lg
               bg-slate-900/40 hover:bg-slate-800/60 ring-1 ring-1
               focus:outline-none focus:ring-2 transition-all overflow-hidden"
        :class="ACCENT_RING[pin.accent]"
        :aria-label="`Open ${pin.label} agent`"
        :title="pin.title"
        @click="emit(pin.event)"
      >
        <!-- Visual: identity image from the shared AGENT_REGISTRY. -->
        <span class="h-8 w-8 flex items-center justify-center rounded-md overflow-hidden bg-white/10" aria-hidden="true">
          <img
            :src="pin.image"
            :alt="`${pin.label} portrait`"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
        <!-- Label — white on dark, GUARANTEED contrast (fixes "text disappeared") -->
        <span class="text-[10px] font-extrabold leading-none tracking-tight text-white whitespace-nowrap">{{ pin.label }}</span>
      </button>
    </div>
  </div>
</template>
