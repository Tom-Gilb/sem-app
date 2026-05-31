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
import ScrollContainer from './ScrollContainer.vue'

const emit = defineEmits<{
  close: []
  'select-agent': [agentId: string]
}>()

// ─── Agent definitions ────────────────────────────────────────────────────────
// Each agent has a stable id, display metadata, and a color scheme.
// Adding a new agent: append an entry here — AgentMenuPanel renders the grid
// generically. The host (App.vue) maps agentId to the correct agent panel.

interface AgentDef {
  id: string
  emoji: string
  label: string
  subtitle: string
  blurb: string
  /** Tailwind color token used for header gradient and button: 'emerald' | 'indigo' | ... */
  color: string
  /** Whether this agent is available now or coming soon (coming-soon tiles are non-clickable). */
  status: 'live' | 'coming-soon'
}

const AGENTS: AgentDef[] = [
  {
    id: 'maria',
    emoji: '🏛',
    label: 'Maria',
    subtitle: 'Board Work Parse',
    blurb: 'Analyses board documents — minutes, resolutions, strategy papers — and produces a decision inventory, authority clarity report, governance gap list, and pattern analysis. Delivers by email to the board.',
    color: 'emerald',
    status: 'live',
  },
  {
    id: 'contracts',
    emoji: '📋',
    label: 'Contracts',
    subtitle: 'Planguage Contract Analysis',
    blurb: 'Import any contract — SLA, NDA, service agreement, employment — and convert it to clear, measurable Planguage. Splits into clauses, extracts F./V./C./R./S./Task entries, flags vague language, and builds a party obligation matrix.',
    color: 'teal',
    status: 'live',
  },
  {
    id: 'stakeholder-mapper',
    emoji: '👥',
    label: 'Stakeholder Mapper',
    subtitle: 'Coming Soon',
    blurb: 'Automatically identifies all stakeholders in a document and maps their concerns to Planguage Value and Constraint entries.',
    color: 'indigo',
    status: 'coming-soon',
  },
  {
    id: 'evo-step-critique',
    emoji: '🔬',
    label: 'Evo Critiquer',
    subtitle: 'Coming Soon',
    blurb: 'Reviews an Evo step plan and flags value delivery gaps, missing measurement criteria, and ordering improvements.',
    color: 'violet',
    status: 'coming-soon',
  },
]

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
        class="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🤖</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">Agent Menu</h2>
            <p class="text-[11px] text-white/60 leading-tight mt-0.5">Explicitly-called planning agents</p>
          </div>
          <CloseDot
            variant="on-dark"
            aria-label="Close Agent Menu"
            title="Close Agent Menu — return to the main planning workspace"
            @click="emit('close')"
          />
        </div>

        <!-- Agent grid body -->
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="p-5"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="agent in AGENTS"
              :key="agent.id"
              :class="[
                'group relative flex flex-col rounded-xl overflow-hidden ring-1 transition-all duration-200',
                agent.status === 'live'
                  ? 'ring-slate-200 bg-white shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                  : 'ring-slate-100 bg-slate-50 opacity-60 cursor-not-allowed',
              ]"
              :aria-label="agent.status === 'live' ? `Launch ${agent.label} agent — ${agent.subtitle}` : `${agent.label} — coming soon`"
              @click="selectAgent(agent)"
            >
              <!-- Tile header — colored band with thumbnail -->
              <!-- UPDATE THIS THUMBNAIL if the Maria panel layout changes substantially. -->
              <div
                :class="[
                  'px-4 py-3 flex items-center gap-3',
                  agent.id === 'maria'              ? 'bg-gradient-to-r from-emerald-700 to-emerald-600' :
                  agent.id === 'contracts'           ? 'bg-gradient-to-r from-teal-700 to-teal-600' :
                  agent.id === 'stakeholder-mapper'  ? 'bg-gradient-to-r from-indigo-700 to-indigo-600' :
                  'bg-gradient-to-r from-violet-700 to-violet-600',
                ]"
              >
                <!-- Maria: governance-layer mini-table thumbnail -->
                <div v-if="agent.id === 'maria'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 72 53" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect width="72" height="12" fill="#059669"/>
                    <text x="4" y="9" font-size="5.5" fill="white" font-family="system-ui,sans-serif" font-weight="600">Board Document Analysis</text>
                    <rect x="0" y="13" width="72" height="12" fill="#f0fdf4"/>
                    <rect x="2" y="15.5" width="14" height="7" rx="1.5" fill="#10b981"/>
                    <text x="4" y="21" font-size="4.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">BOARD</text>
                    <rect x="18" y="16" width="28" height="2" rx="1" fill="#6b7280"/>
                    <rect x="18" y="20" width="18" height="2" rx="1" fill="#6b7280"/>
                    <rect x="0" y="25" width="72" height="12" fill="#fafafa"/>
                    <rect x="2" y="27.5" width="20" height="7" rx="1.5" fill="#6366f1"/>
                    <text x="4" y="33" font-size="4.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">MGMT</text>
                    <rect x="24" y="28" width="22" height="2" rx="1" fill="#6b7280"/>
                    <rect x="24" y="32" width="16" height="2" rx="1" fill="#6b7280"/>
                    <rect x="0" y="37" width="72" height="12" fill="#f0fdf4"/>
                    <rect x="2" y="39.5" width="20" height="7" rx="1.5" fill="#0ea5e9"/>
                    <text x="4" y="45" font-size="4.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">OPS</text>
                    <rect x="24" y="40" width="24" height="2" rx="1" fill="#6b7280"/>
                    <rect x="24" y="44" width="14" height="2" rx="1" fill="#6b7280"/>
                    <line x1="0" y1="25" x2="72" y2="25" stroke="#e5e7eb" stroke-width="0.5"/>
                    <line x1="0" y1="37" x2="72" y2="37" stroke="#e5e7eb" stroke-width="0.5"/>
                    <line x1="0" y1="49" x2="72" y2="49" stroke="#e5e7eb" stroke-width="0.5"/>
                    <rect x="0" y="49" width="72" height="4" fill="#f8fafc"/>
                    <text x="4" y="52.5" font-size="3" fill="#9ca3af" font-family="system-ui,sans-serif">Decision Inventory · Authority Report · Gaps · Patterns</text>
                  </svg>
                </div>

                <!-- Contracts: clause-entry mini-table thumbnail (F./V./C./R. type badges) -->
                <div v-else-if="agent.id === 'contracts'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 72 53" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <!-- Teal header -->
                    <rect width="72" height="11" fill="#0f766e"/>
                    <text x="4" y="8" font-size="5.5" fill="white" font-family="system-ui,sans-serif" font-weight="600">Contract Analysis</text>
                    <!-- F. row -->
                    <rect x="0" y="11" width="72" height="10" fill="#fff7ed"/>
                    <rect x="2" y="13" width="9" height="6" rx="1.5" fill="#ea580c"/>
                    <text x="3.5" y="17.5" font-size="5" fill="white" font-family="system-ui,sans-serif" font-weight="700">F.1</text>
                    <rect x="13" y="14" width="30" height="2" rx="1" fill="#9ca3af"/>
                    <rect x="13" y="18" width="20" height="2" rx="1" fill="#9ca3af"/>
                    <!-- V. row -->
                    <rect x="0" y="21" width="72" height="10" fill="#eff6ff"/>
                    <rect x="2" y="23" width="9" height="6" rx="1.5" fill="#2563eb"/>
                    <text x="3.5" y="27.5" font-size="5" fill="white" font-family="system-ui,sans-serif" font-weight="700">V.2</text>
                    <rect x="13" y="24" width="26" height="2" rx="1" fill="#9ca3af"/>
                    <rect x="13" y="28" width="18" height="2" rx="1" fill="#9ca3af"/>
                    <!-- C. row -->
                    <rect x="0" y="31" width="72" height="10" fill="#fef2f2"/>
                    <rect x="2" y="33" width="9" height="6" rx="1.5" fill="#dc2626"/>
                    <text x="3.5" y="37.5" font-size="5" fill="white" font-family="system-ui,sans-serif" font-weight="700">C.3</text>
                    <rect x="13" y="34" width="28" height="2" rx="1" fill="#9ca3af"/>
                    <rect x="13" y="38" width="16" height="2" rx="1" fill="#9ca3af"/>
                    <!-- R. row -->
                    <rect x="0" y="41" width="72" height="8" fill="#ecfdf5"/>
                    <rect x="2" y="42.5" width="9" height="5" rx="1.5" fill="#059669"/>
                    <text x="3.5" y="46.5" font-size="5" fill="white" font-family="system-ui,sans-serif" font-weight="700">R.4</text>
                    <rect x="13" y="43.5" width="22" height="2" rx="1" fill="#9ca3af"/>
                    <!-- Footer -->
                    <rect x="0" y="49" width="72" height="4" fill="#f0fdfa"/>
                    <text x="4" y="52.5" font-size="3" fill="#9ca3af" font-family="system-ui,sans-serif">Clauses · Entries · Matrix · Export</text>
                  </svg>
                </div>

                <!-- Coming-soon agents: generic placeholder thumbnail -->
                <div v-else class="rounded-md overflow-hidden bg-white/80 shadow-sm ring-1 ring-white/30 shrink-0 flex items-center justify-center" style="width:72px;height:53px;">
                  <span class="text-2xl opacity-40" aria-hidden="true">{{ agent.emoji }}</span>
                </div>

                <!-- Agent name + subtitle -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-lg leading-none" aria-hidden="true">{{ agent.emoji }}</span>
                    <span class="text-sm font-bold text-white truncate leading-tight">{{ agent.label }}</span>
                  </div>
                  <p class="text-[10px] text-white/70 leading-tight mt-0.5 truncate">{{ agent.subtitle }}</p>
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
              <div class="flex-1 flex flex-col gap-3 p-4">
                <p class="text-xs text-slate-600 leading-relaxed">{{ agent.blurb }}</p>

                <div class="mt-auto">
                  <button
                    v-if="agent.status === 'live'"
                    type="button"
                    :class="[
                      'w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-150',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                      agent.id === 'maria'
                        ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600'
                        : agent.id === 'contracts'
                          ? 'bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600'
                          : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
                    ]"
                    :title="`Launch ${agent.label} — ${agent.blurb}`"
                    @click.stop="selectAgent(agent)"
                  >
                    Launch {{ agent.label }} →
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
        </ScrollContainer>

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
