<!-- UNIT_TYPE=Widget -->
<!-- AgentMenuPanel.vue — Agent selection grid for the SEM App Agent Menu.
     A full-screen modal (z-[490]) presenting agent tiles. Each tile opens a
     dedicated agent panel. Maria Agent (Board Work Parse) is the first agent.

     UI Rules applied:
       - CloseDot at END of header (rightmost) — Universal Close-Button Rule
       - ScrollContainer wrapping the agent grid — Universal Scroll Rule
       - z-[485] backdrop / z-[490] card — within Major surfaces tier (380–600)
         so SelectionDefiner at z-[10100] stays visible above this panel
       - All buttons have title= — DD-009 / Interaction Disclosure Rule (Rule 7)
       - No select-none on body content — Define-by-Selection Rule

     Emits:
       close           — user dismissed the menu without selecting an agent
       select-agent    — user chose an agent; payload is the agent id string

     Tom Gilb, 2026-05-29: "Part of Planning mode, basically an agent who can
     be explicitly called (agent menu)."
-->

<script setup lang="ts">
import CloseDot from './CloseDot.vue'

// r41 v133 — single source of truth for agent identity + rich HoverHint
// background (Tom Gilb 2026-06-17 verbatim "the hover for icon info is a
// universal rule everywhere, including here, which is part of everywhere").
// AgentsStrip and AgentMenuPanel now both consume from `useAgentRegistry`
// so the agent's IMAGE + ACCENT + RICH HOVERHINT STORY stays consistent
// across surfaces.  Previous IDENTITY_IMAGE Record (v129) is superseded.
import { AGENT_REGISTRY, getAgentIdentity, type AgentRegistryId, type AgentIdentity } from '../composables/useAgentRegistry'

/** Map agent.id → identity image URL — sourced from AGENT_REGISTRY. */
const IDENTITY_IMAGE: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([id, ident]) => [id, ident.image])
)

/** Lookup the rich HoverHint story for an agent.id (falls back to subtitle). */
function agentHoverHint(agentId: string, fallback: string): string {
  const ident = getAgentIdentity(agentId)
  return ident ? ident.richTitle : fallback
}
// ScrollContainer import removed r93ii — see explanation at the body div below.
// (The header comment line referencing "ScrollContainer wrapping the agent grid" is kept
// as historical record; the actual import + usage are gone.)

const emit = defineEmits<{
  close: []
  'select-agent': [agentId: string]
}>()

// ─── Agent definitions ────────────────────────────────────────────────────────
// Each agent has a stable id, display metadata, and a color scheme.
// Adding a new agent: append an entry here — AgentMenuPanel renders the grid
// generically. The host (App.vue) maps agentId to the correct agent panel.

// r41 v137 — AGENTS array derived from the shared AGENT_REGISTRY per Tom
// Gilb 2026-06-17 verbatim "delete old agent svg" → full single-source
// hoist of every per-agent literal (id + status + emoji + label + subtitle
// + image + accent + tile blurb + gradient + button class + rich HoverHint).
// Adding agent #14 = one entry in useAgentRegistry.ts.
//
// AgentDef interface kept as a re-export so any callers using the old name
// still typecheck (status flag drives the live/coming-soon UI state).
type AgentDef = { id: AgentRegistryId } & AgentIdentity & { blurb: string }

const AGENTS: AgentDef[] = (Object.entries(AGENT_REGISTRY) as [AgentRegistryId, AgentIdentity][])
  .map(([id, identity]) => ({
    id,
    ...identity,
    /** Back-compat alias — old callers reading `agent.blurb` get the tileBlurb. */
    blurb: identity.tileBlurb,
  }))


function selectAgent(agent: AgentDef): void {
  if (agent.status !== 'live') return
  emit('select-agent', agent.id)
  emit('close')
}
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[485] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[490] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Menu — choose a planning agent"
    >
      <div
        class="pointer-events-auto w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🦾</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">Agent Menu</h2>
            <p class="text-[11px] text-white/60 leading-tight mt-0.5">Explicitly-called planning agents</p>
          </div>
          <CloseDot
            size="lg"
            variant="on-dark"
            aria-label="Close Agent Menu"
            title="Close Agent Menu — return to the main planning workspace"
            @click="emit('close')"
          />
        </div>

        <!-- Agent grid body — r93ii (Tom Gilb 2026-06-11 "agent menu does not scroll").
             Replaced `<ScrollContainer>` with raw `overflow-y-auto` per the same r93r exception
             documented in `sem-app-ui-rules.md`. Same root cause: ScrollContainer's auto-h-full
             injection does not engage inside the centered-card + Teleport + multiple shrink-0
             siblings pattern. Direct overflow-y-auto on a flex-1 + min-h-0 child of a flex-col
             parent is the canonical Tailwind scroll pattern and works deterministically. -->
        <div class="flex-1 min-h-0 overflow-y-auto p-5 relative">
          <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="agent in AGENTS"
              :key="agent.id"
              :class="[
                'group relative flex flex-col rounded-xl overflow-hidden ring-1 transition-all duration-200',
                agent.status === 'live'
                  ? 'ring-slate-200 bg-white shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                  : 'ring-slate-100 bg-slate-50 opacity-60 cursor-not-allowed',
              ]"
              :aria-label="(agent.status === 'live' ? `Launch ${getAgentIdentity(agent.id)?.label ?? agent.label} agent — ${getAgentIdentity(agent.id)?.subtitle ?? agent.subtitle}` : `${getAgentIdentity(agent.id)?.label ?? agent.label} — coming soon`)"
              :title="agentHoverHint(agent.id, agent.blurb)"
              @click="selectAgent(agent)"
            >
              <!-- r41 v135 — header band gradient sourced from shared registry
                   per Tom Gilb 2026-06-17 "yes" to full single-source-of-truth
                   hoist.  Falls back to rose default for any unregistered agent. -->
              <div
                :class="[
                  'px-4 py-3 flex items-center gap-3',
                  getAgentIdentity(agent.id)?.headerGradient ?? 'bg-gradient-to-r from-rose-700 to-rose-600',
                ]"
              >
                <!-- r41 v129 — Identity image FIRST (Tom Gilb 2026-06-17
                     verbatim "of course change the agent icon corresponsingly
                     in agents"). When IDENTITY_IMAGE[id] is defined, render
                     the same identity image used by the AgentsStrip Level 3
                     pin — visual consistency between catalog and quick-launch.
                     Sized 72×72 to match the previous rich-SVG thumbnail
                     footprint. Falls through to the per-id rich SVG block
                     when no identity image is mapped (forward-compat for
                     future agents). -->
                <div
                  v-if="IDENTITY_IMAGE[agent.id]"
                  class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0 flex items-center justify-center"
                  style="width:72px;height:72px;"
                >
                  <img
                    :src="IDENTITY_IMAGE[agent.id]"
                    :alt="`${agent.label} identity icon`"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <!-- Fallback for any future coming-soon agents -->
                <div v-else class="rounded-md overflow-hidden bg-white/80 shadow-sm ring-1 ring-white/30 shrink-0 flex items-center justify-center" style="width:72px;height:53px;">
                  <span class="text-2xl opacity-40" aria-hidden="true">{{ agent.emoji }}</span>
                </div>

                <!-- Agent name + subtitle.  r41 v136 — emoji decoration
                     dropped (identity image is already the at-a-glance
                     identifier right beside the name). -->
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-bold text-white truncate leading-tight block">{{ getAgentIdentity(agent.id)?.label ?? agent.label }}</span>
                  <p class="text-[10px] text-white/70 leading-tight mt-0.5 truncate">{{ getAgentIdentity(agent.id)?.subtitle ?? agent.subtitle }}</p>
                </div>

                <!-- Coming-soon badge -->
                <span
                  v-if="agent.status === 'coming-soon'"
                  class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-white/20 text-white/80 rounded px-1.5 py-0.5"
                >
                  Soon
                </span>
              </div>

              <!-- Tile body — blurb + launch button -->
              <!-- min-h-0: prevents flex children from overflowing a constrained row.
                   overflow-hidden: defensive clip so blurb never bleeds past card edge. -->
              <div class="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
                <!-- r41 v134 — tile blurb from shared registry per Tom Gilb 2026-06-17
                     ("yes" to hoist blurbs into registry).  Falls back to agent.blurb
                     for any future agent not yet registered. -->
                <p class="text-xs text-slate-600 leading-relaxed line-clamp-3 min-h-0">{{ getAgentIdentity(agent.id)?.tileBlurb ?? agent.blurb }}</p>

                <!-- shrink-0: button container must never compress — guarantees it is
                     always fully visible and never overlaps the blurb text above. -->
                <div class="mt-auto shrink-0">
                  <button
                    v-if="agent.status === 'live'"
                    type="button"
                    :class="[
                      'w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-150',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                      getAgentIdentity(agent.id)?.launchBtnClass ?? 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
                    ]"
                    :title="`Launch ${getAgentIdentity(agent.id)?.label ?? agent.label} — ${getAgentIdentity(agent.id)?.tileBlurb ?? agent.blurb}`"
                    @click.stop="selectAgent(agent)"
                  >
                    Launch {{ getAgentIdentity(agent.id)?.label ?? agent.label }} →
                  </button>

                  <div
                    v-else
                    class="text-[10px] text-slate-400 text-center py-1"
                  >
                    Coming in a future release
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- Footer note -->
        <div class="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p class="text-[10px] text-slate-400 text-center leading-relaxed">
            Agents are explicitly-called — they run only when you choose. Each agent delivers a structured report and an email to named stakeholders.
          </p>
        </div>

      </div>
    </div>
  </Teleport>
</template>
