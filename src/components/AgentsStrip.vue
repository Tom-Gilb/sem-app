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
import { AGENT_REGISTRY, type AgentRegistryId, type AgentRequirement } from '../composables/useAgentRegistry'

const props = defineProps<{
  hasSpec: boolean
  /** r41 v154 — live spec-presence map; same gating logic as Stage Tools
   *  per Tom Gilb 2026-06-17 "Same with Agents (Grey, feedback if invalid)". */
  specPresence?: Partial<Record<AgentRequirement, boolean>>
}>()

/** r41 v154 — Friendly user-facing message when an agent prerequisite is
 *  unmet.  Mirrors the StageToolsStrip REQUIREMENT_REASON map. */
const REQUIREMENT_REASON: Record<AgentRequirement, string> = {
  spec:            'no Planguage entries yet — load a spec via Get A Plan or Templates first',
  stakeholders:    'no Stakeholders yet — add at least one Stakeholder at Stage 1 Stakes',
  values:          'no Values yet — generate Values at Stage 1-2 (Stakes / Solutions)',
  functions:       'no Functions yet — generate Functions at Stage 1-2',
  solutions:       'no Solutions yet — generate Solutions at Stage 2',
  impactEstimates: 'no Impact Estimates yet — fill the Impact Estimation Table at Stage 4',
  evoSteps:        'no Evo Steps yet — generate Evo Steps at Stage 6 (Evo Plan)',
  tasks:           'no Tasks yet — break Evo Steps into Tasks at Stage 8',
  resources:       'no Resources yet — add Resource entries or generate at Stage 10',
}

/** Check agent availability against the live spec-presence map. */
function checkAgentAvailability(id: AgentRegistryId): { ok: true } | { ok: false; reason: string } {
  const reqs = AGENT_REGISTRY[id].requires ?? []
  if (reqs.length === 0) return { ok: true }
  const presence = props.specPresence ?? {}
  for (const req of reqs) {
    if (!presence[req]) return { ok: false, reason: REQUIREMENT_REASON[req] }
  }
  return { ok: true }
}

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
  'open-munger':                []
  'open-munger-sharpen':        []
  'open-heilmeier':             []
  'open-feynman':               []
  'open-roles':                 []
  'open-auto-dbo':              []
  /** r41 v154 — fired when planner clicks a disabled agent.  Same shape as
   *  StageToolsStrip's tool-invalid emit; App.vue surfaces the same toast. */
  'tool-invalid': [payload: { label: string; reason: string }]
  /** r41 v231 — agent pin click routes through AgentModePicker so the planner
   *  picks Principles / Analysis / Improvement / Sharpening / Create Optional
   *  Version.  Fired in place of direct open-* emits for the multi-mode agents
   *  (incorruptible / elon / munger). */
  'open-mode-picker': [agentId: AgentRegistryId]
}>()

type Emits =
  | 'open-maria' | 'open-contracts' | 'open-models' | 'open-stakeholder-mapper'
  | 'open-evo-critiquer' | 'open-spec-importer' | 'open-decisions'
  | 'open-strategy' | 'open-incorruptible' | 'open-incorruptible-sharpen'
  | 'open-elon' | 'open-elon-sharpen' | 'open-munger' | 'open-munger-sharpen'
  | 'open-heilmeier' | 'open-feynman' | 'open-roles' | 'open-auto-dbo'

interface AgentPin {
  /** Identity image — sourced from the shared AGENT_REGISTRY. */
  image: string
  label: string
  event: Emits
  accent: string
  title: string
  /** r41 v154 — registry id retained on the pin so click handler can
   *  consult AGENT_REGISTRY[id].requires for availability gating. */
  id: AgentRegistryId
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
  'munger':                'open-munger',
  'munger-sharpen':        'open-munger-sharpen',
  'heilmeier':             'open-heilmeier',
  'feynman':               'open-feynman',
  'roles':                 'open-roles',
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
  'elon',
  'munger',
  'heilmeier',
  'feynman',
  'roles',
  'autoDbo',
  // r41 v231 (Tom Gilb 2026-06-20 verbatim "I think we need only one agent,
  // not 2 as you have constructed, in th mene, but we can choose various
  // agent modes") — `incorruptible-sharpen` / `elon-sharpen` / `munger-sharpen`
  // DROPPED from the pinned list.  Each main agent pin (incorruptible /
  // elon / munger) now opens AgentModePicker, where Sharpening Q&A is one
  // of 5 modes the planner can pick.  Registry entries kept so existing
  // panel open paths still resolve through select-agent emits.
]

/** r41 v133 — AGENT_PINS derived from the shared registry; single
 *  source of truth with AgentMenuPanel.  Adding agent #14 = one entry
 *  in useAgentRegistry.ts + PIN_EVENT mapping + PIN_ORDER position. */
const AGENT_PINS: AgentPin[] = PIN_ORDER.map((id) => ({
  id,
  image:  AGENT_REGISTRY[id].image,
  label:  AGENT_REGISTRY[id].shortLabel,
  event:  PIN_EVENT[id],
  accent: AGENT_REGISTRY[id].accent,
  title:  AGENT_REGISTRY[id].richTitle,
}))

/** r41 v367 (Tom Gilb 2026-06-25 "i tried munger and it would not go there"
 *  — demo eve · ~25 min before demo) — MODE_PICKER_AGENTS set EMPTIED so
 *  every agent pin opens its panel DIRECTLY in one click.  The v231 mode-
 *  picker layer (Principles / Analysis / Improvement / Sharpening / Create
 *  Optional Version) was a 2-step indirection that, even when wired
 *  correctly, doubled the clicks and added a surface that could fail to
 *  appear (z-index / Single-Surface registration / state-sync gap).  For
 *  the demo: every pin = one-click open.  AgentModePicker component file
 *  retained; can be re-enabled post-demo by re-populating this Set. */
const MODE_PICKER_AGENTS: ReadonlySet<AgentRegistryId> = new Set([])

/** Click handler — routes to normal emit OR tool-invalid emit when pin is greyed. */
function handlePinClick(pin: AgentPin): void {
  const avail = checkAgentAvailability(pin.id)
  if (avail.ok) {
    if (MODE_PICKER_AGENTS.has(pin.id)) {
      emit('open-mode-picker', pin.id)
    } else {
      emit(pin.event)
    }
  } else {
    emit('tool-invalid', { label: pin.label, reason: avail.reason })
  }
}

/** r41 v155 — Category-based ring + glyph (Tom Gilb 2026-06-17 "Agents are
 *  tools").  Drives the visual category accent on each pin so the planner
 *  sees consistent tool-category identity across BOTH Stage Tools and
 *  Agents.  Falls back to the per-agent ACCENT_RING when no category set. */
const CATEGORY_GLYPH: Record<string, string> = {
  visualize: '👁',
  analyze:   '🔬',
  edit:      '✏',
  deepAi:    '🪄',
  import:    '📥',
  export:    '📤',
}
const CATEGORY_RING: Record<string, string> = {
  visualize: 'ring-indigo-300/60 focus:ring-indigo-300',
  analyze:   'ring-emerald-300/60 focus:ring-emerald-300',
  edit:      'ring-amber-300/60 focus:ring-amber-300',
  deepAi:    'ring-fuchsia-300/80 focus:ring-fuchsia-300',
  import:    'ring-violet-300/60 focus:ring-violet-300',
  export:    'ring-rose-300/60 focus:ring-rose-300',
}

/** Category label (full word) for HoverHint and aria-label. */
const CATEGORY_LABEL: Record<string, string> = {
  visualize: 'Visualize Only',
  analyze:   'Analyze Only',
  edit:      'Edit Only',
  deepAi:    'Deep AI Analysis & Specification',
  import:    'Import',
  export:    'Export',
}

/** Lookup the category for an agent (defaults to undefined). */
function pinCategory(id: AgentRegistryId): string | undefined {
  return AGENT_REGISTRY[id].category
}

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
    <!-- r41 v150 — "Emerging Category" + "Level 3 ·" framing dropped per
         Tom Gilb 2026-06-17.  The amber gradient + glow + "✨" prefix
         visually marks this as elevated; the words become noise. -->
    <div class="shrink-0 flex flex-col justify-end mr-1 self-end">
      <span class="text-[12px] font-extrabold text-amber-100 uppercase tracking-wider leading-none whitespace-nowrap drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] flex items-center gap-1">
        <span aria-hidden="true">✨</span>
        Agents
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
        class="relative h-14 min-w-[72px] flex flex-col items-center justify-start gap-1 px-2 pt-1 pb-0.5 rounded-lg
               bg-slate-900/40 hover:bg-slate-800/60 ring-1
               focus:outline-none focus:ring-2 transition-all"
        :class="[
          pinCategory(pin.id) && CATEGORY_RING[pinCategory(pin.id)!] ? CATEGORY_RING[pinCategory(pin.id)!] : ACCENT_RING[pin.accent],
          checkAgentAvailability(pin.id).ok ? '' : 'opacity-40 saturate-50 cursor-not-allowed hover:opacity-50',
        ]"
        :aria-label="checkAgentAvailability(pin.id).ok
          ? `Open ${pin.label} agent`
          : `Invalid: ${pin.label} cannot be used yet — click for explanation`"
        :title="checkAgentAvailability(pin.id).ok
          ? pin.title
          : `⚠ INVALID AGENT — ${pin.label} cannot be used yet.\n\nReason: ${(checkAgentAvailability(pin.id) as {reason:string}).reason}\n\nClick anyway to see the reaction message.`"
        @click="handlePinClick(pin)"
      >
        <!-- r41 v155 — category badge at top-right; signals the agent's
             tool-category (Analyze / Deep AI / etc.) per Tom Gilb 2026-06-17
             "Agents are tools".  Aligned with StageToolsStrip category glyphs. -->
        <span
          v-if="pinCategory(pin.id)"
          class="absolute top-0.5 right-0.5 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-slate-950/70 ring-1 ring-white/30 text-[8px] leading-none"
          aria-hidden="true"
          :title="`Category: ${CATEGORY_LABEL[pinCategory(pin.id)!]}`"
        >
          {{ CATEGORY_GLYPH[pinCategory(pin.id)!] }}
        </span>
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
