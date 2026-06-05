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
    id: 'models',
    emoji: '🗂️',
    label: 'Models',
    subtitle: 'Plan Model Library',
    blurb: 'Browse 18 built-in domain models across 6 categories — Organizational, Project, Product, National, International, and Software. View Planguage F./V./C./R. entries, copy any model, and add your own.',
    color: 'blue',
    status: 'live',
  },
  {
    id: 'stakeholder-mapper',
    emoji: '👥',
    label: 'Stakeholder Mapper',
    subtitle: 'AI-Drafted Attribute Profiles',
    blurb: 'Name any stakeholder — person, organisation, government, or inanimate entity — and AI immediately drafts all 10 attribute levels (Power, Interest, Influence, Support…) with a source URL and fact for each. Updates automatically when you refine the stakeholder context.',
    color: 'indigo',
    status: 'live',
  },
  {
    id: 'evo-step-critique',
    emoji: '🔬',
    label: 'Evo Critiquer',
    subtitle: 'Evo Health Check & Value Delivery',
    blurb: 'AI reviews your plan against all 9 steps of the Evo cycle. Scores 10 health dimensions (Stakeholder Coverage, Values Completeness, Priority Alignment…), critiques each planning step, and gives a deep-dive on the Value Delivery cycle (Develop → Deliver → Measure → Learn) with practical tasks.',
    color: 'violet',
    status: 'live',
  },
  {
    id: 'plan-importer',
    emoji: '📄',
    label: 'Spec Agent',
    subtitle: 'Universal Planguage Converter',
    blurb: 'Paste any text — business brief, roadmap, strategy doc, rough notes — and AI converts it to full Planguage F./V./C./R./S. entries. Then analyses problems and inconsistencies, suggests improvements, and applies them on your command ("simplify", "innovate", "make measurable"). Full version history with before/after comparison.',
    color: 'orange',
    status: 'live',
  },
  {
    id: 'decisions',
    emoji: '🎯',
    label: 'Decisions',
    subtitle: 'Planguage Decision Analysis',
    blurb: 'Describe any decision and its options. AI builds a scored decision matrix (options × Planguage criteria), models each option as F./V./C. entries, recommends the best path with rationale, and compares options against any other plan you load separately. Redo the analysis with new instructions at any time.',
    color: 'rose',
    status: 'live',
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
                  agent.id === 'models'              ? 'bg-gradient-to-r from-blue-700 to-blue-600' :
                  agent.id === 'stakeholder-mapper'  ? 'bg-gradient-to-r from-indigo-700 to-indigo-600' :
                  agent.id === 'evo-step-critique'   ? 'bg-gradient-to-r from-violet-700 to-violet-600' :
                  agent.id === 'plan-importer'       ? 'bg-gradient-to-r from-orange-700 to-orange-600' :
                  'bg-gradient-to-r from-rose-700 to-rose-600',
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

                <!-- Models: plan model library mini-list thumbnail — multi-category design (Examples/My Models/Our Models + user cats) -->
                <div v-else-if="agent.id === 'models'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 72 53" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <!-- Blue header -->
                    <rect width="72" height="11" fill="#1d4ed8"/>
                    <text x="4" y="8" font-size="5.5" fill="white" font-family="system-ui,sans-serif" font-weight="600">Plan Models</text>
                    <!-- Active model row (blue accent) -->
                    <rect x="0" y="11" width="72" height="11" fill="#eff6ff"/>
                    <rect x="2" y="13" width="3" height="7" rx="1" fill="#3b82f6"/>
                    <text x="7" y="17.5" font-size="4" fill="#1d4ed8" font-family="system-ui,sans-serif" font-weight="700">★</text>
                    <rect x="13" y="14" width="28" height="2" rx="1" fill="#3b82f6"/>
                    <rect x="13" y="18" width="16" height="1.5" rx="0.75" fill="#93c5fd"/>
                    <text x="54" y="18.5" font-size="4" fill="#1d4ed8" font-family="system-ui,sans-serif" font-weight="700">Active</text>
                    <!-- Model row 2 -->
                    <rect x="0" y="22" width="72" height="10" fill="#fafafa"/>
                    <rect x="2" y="24" width="3" height="6" rx="1" fill="#cbd5e1"/>
                    <rect x="7" y="25" width="2" height="2" rx="1" fill="#94a3b8"/>
                    <rect x="11" y="24.5" width="26" height="2" rx="1" fill="#94a3b8"/>
                    <rect x="11" y="28" width="18" height="1.5" rx="0.75" fill="#cbd5e1"/>
                    <!-- Model row 3 -->
                    <rect x="0" y="32" width="72" height="10" fill="#f8fafc"/>
                    <rect x="2" y="34" width="3" height="6" rx="1" fill="#e2e8f0"/>
                    <rect x="7" y="35" width="2" height="2" rx="1" fill="#94a3b8"/>
                    <rect x="11" y="34.5" width="22" height="2" rx="1" fill="#cbd5e1"/>
                    <rect x="11" y="38" width="14" height="1.5" rx="0.75" fill="#e2e8f0"/>
                    <!-- Dividers -->
                    <line x1="0" y1="22" x2="72" y2="22" stroke="#e2e8f0" stroke-width="0.5"/>
                    <line x1="0" y1="32" x2="72" y2="32" stroke="#e2e8f0" stroke-width="0.5"/>
                    <line x1="0" y1="42" x2="72" y2="42" stroke="#e2e8f0" stroke-width="0.5"/>
                    <!-- Footer -->
                    <rect x="0" y="42" width="72" height="11" fill="#f1f5f9"/>
                    <text x="4" y="49" font-size="3" fill="#64748b" font-family="system-ui,sans-serif">Browse · Load · Rename · Backup</text>
                  </svg>
                </div>

                <!-- Stakeholder Mapper: mini attribute matrix thumbnail -->
                <div v-else-if="agent.id === 'stakeholder-mapper'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 100 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect width="100" height="72" rx="5" fill="#312e81"/>
                    <rect width="100" height="16" rx="5" fill="#4338ca"/>
                    <text x="5" y="11" fill="white" font-size="7" font-weight="bold" font-family="system-ui,sans-serif">👥 Stakeholder Mapper</text>
                    <text x="4" y="26" fill="#a5b4fc" font-size="5" font-family="system-ui,sans-serif">Power</text>
                    <circle cx="42" cy="23" r="3" fill="#6366f1"/><circle cx="50" cy="23" r="3" fill="#6366f1"/>
                    <circle cx="58" cy="23" r="3" fill="#6366f1"/><circle cx="66" cy="23" r="3" fill="#6366f1"/>
                    <circle cx="74" cy="23" r="3" fill="#312e81"/>
                    <text x="78" y="26" fill="#818cf8" font-size="5" font-family="system-ui,sans-serif">4/5</text>
                    <text x="4" y="36" fill="#a5b4fc" font-size="5" font-family="system-ui,sans-serif">Interest</text>
                    <circle cx="42" cy="33" r="3" fill="#6366f1"/><circle cx="50" cy="33" r="3" fill="#6366f1"/>
                    <circle cx="58" cy="33" r="3" fill="#6366f1"/><circle cx="66" cy="33" r="3" fill="#312e81"/>
                    <circle cx="74" cy="33" r="3" fill="#312e81"/>
                    <text x="78" y="36" fill="#818cf8" font-size="5" font-family="system-ui,sans-serif">3/5</text>
                    <text x="4" y="46" fill="#a5b4fc" font-size="5" font-family="system-ui,sans-serif">Support</text>
                    <circle cx="42" cy="43" r="3" fill="#6366f1"/><circle cx="50" cy="43" r="3" fill="#6366f1"/>
                    <circle cx="58" cy="43" r="3" fill="#6366f1"/><circle cx="66" cy="43" r="3" fill="#6366f1"/>
                    <circle cx="74" cy="43" r="3" fill="#6366f1"/>
                    <text x="78" y="46" fill="#10b981" font-size="5" font-family="system-ui,sans-serif">5/5</text>
                    <rect x="4" y="52" width="92" height="8" rx="2" fill="#1e1b4b"/>
                    <text x="6" y="58" fill="#6366f1" font-size="4" font-family="system-ui,sans-serif">📎 wikipedia.org · "$2T market cap 2024"</text>
                    <rect x="80" y="60" width="16" height="7" rx="2" fill="#1d4ed8"/>
                    <text x="82" y="65.5" fill="white" font-size="4" font-family="system-ui,sans-serif">High</text>
                  </svg>
                </div>

                <!-- Evo Critiquer: mini health check report thumbnail -->
                <div v-else-if="agent.id === 'evo-step-critique'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 100 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect width="100" height="72" rx="5" fill="#2e1065"/>
                    <rect width="100" height="16" rx="5" fill="#7c3aed"/>
                    <text x="5" y="11" fill="white" font-size="7" font-weight="bold" font-family="system-ui,sans-serif">🔬 Evo Critiquer</text>
                    <circle cx="15" cy="35" r="10" fill="#1e1b4b" stroke="#7c3aed" stroke-width="2"/>
                    <text x="15" y="38" fill="#a78bfa" font-size="8" font-weight="bold" text-anchor="middle" font-family="system-ui,sans-serif">B</text>
                    <text x="30" y="25" fill="#c4b5fd" font-size="5" font-family="system-ui,sans-serif">Stakeholder</text>
                    <rect x="30" y="27" width="55" height="4" rx="2" fill="#1e1b4b"/>
                    <rect x="30" y="27" width="38" height="4" rx="2" fill="#10b981"/>
                    <text x="88" y="31" fill="#6ee7b7" font-size="4" font-family="system-ui,sans-serif">72</text>
                    <text x="30" y="37" fill="#c4b5fd" font-size="5" font-family="system-ui,sans-serif">Values</text>
                    <rect x="30" y="39" width="55" height="4" rx="2" fill="#1e1b4b"/>
                    <rect x="30" y="39" width="28" height="4" rx="2" fill="#f59e0b"/>
                    <text x="88" y="43" fill="#fcd34d" font-size="4" font-family="system-ui,sans-serif">51</text>
                    <text x="30" y="49" fill="#c4b5fd" font-size="5" font-family="system-ui,sans-serif">Value Delivery</text>
                    <rect x="30" y="51" width="55" height="4" rx="2" fill="#1e1b4b"/>
                    <rect x="30" y="51" width="44" height="4" rx="2" fill="#6366f1"/>
                    <text x="88" y="55" fill="#818cf8" font-size="4" font-family="system-ui,sans-serif">80</text>
                    <rect x="4" y="63" width="92" height="7" rx="2" fill="#3b0764"/>
                    <text x="6" y="68" fill="#a78bfa" font-size="4" font-family="system-ui,sans-serif">▶ 8 tasks · 3 critical · 2 references</text>
                  </svg>
                </div>

                <!-- plan-importer: text input → arrow → F./V./C. entries thumbnail -->
                <div v-else-if="agent.id === 'plan-importer'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 72 53" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect width="72" height="12" fill="#c2410c"/>
                    <text x="4" y="9" font-size="5.5" fill="white" font-family="system-ui,sans-serif" font-weight="600">📄 Spec Agent</text>
                    <!-- Input text block left -->
                    <rect x="2" y="14" width="24" height="33" rx="2" fill="#fff7ed" stroke="#fed7aa" stroke-width="0.5"/>
                    <rect x="4" y="17" width="18" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="4" y="20.5" width="14" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="4" y="24" width="16" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="4" y="27.5" width="11" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="4" y="31" width="15" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <text x="6" y="44" font-size="4" fill="#f97316" font-family="system-ui,sans-serif">Any text</text>
                    <!-- Arrow -->
                    <text x="28" y="32" font-size="9" fill="#f97316" font-family="system-ui,sans-serif">→</text>
                    <!-- Planguage entries right -->
                    <rect x="40" y="14" width="30" height="7" rx="1.5" fill="#fff7ed" stroke="#fed7aa" stroke-width="0.5"/>
                    <rect x="42" y="16.5" width="6" height="4" rx="1" fill="#f97316"/>
                    <text x="43" y="19.5" font-size="3.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">F.1</text>
                    <rect x="50" y="17.5" width="16" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="40" y="23" width="30" height="7" rx="1.5" fill="#eff6ff" stroke="#bfdbfe" stroke-width="0.5"/>
                    <rect x="42" y="25.5" width="6" height="4" rx="1" fill="#3b82f6"/>
                    <text x="43" y="28.5" font-size="3.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">V.1</text>
                    <rect x="50" y="26.5" width="16" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="40" y="32" width="30" height="7" rx="1.5" fill="#fef2f2" stroke="#fecaca" stroke-width="0.5"/>
                    <rect x="42" y="34.5" width="6" height="4" rx="1" fill="#ef4444"/>
                    <text x="43" y="37.5" font-size="3.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">C.1</text>
                    <rect x="50" y="35.5" width="14" height="1.5" rx="0.5" fill="#9ca3af"/>
                    <rect x="40" y="41" width="30" height="7" rx="1.5" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="0.5"/>
                    <rect x="42" y="43.5" width="6" height="4" rx="1" fill="#10b981"/>
                    <text x="43" y="46.5" font-size="3.5" fill="white" font-family="system-ui,sans-serif" font-weight="700">R.1</text>
                    <rect x="50" y="44.5" width="12" height="1.5" rx="0.5" fill="#9ca3af"/>
                  </svg>
                </div>

                <!-- decisions: mini decision matrix thumbnail -->
                <div v-else-if="agent.id === 'decisions'" class="rounded-md overflow-hidden bg-white/90 shadow-sm ring-1 ring-white/40 shrink-0">
                  <svg width="72" height="53" viewBox="0 0 72 53" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect width="72" height="12" fill="#be123c"/>
                    <text x="4" y="9" font-size="5.5" fill="white" font-family="system-ui,sans-serif" font-weight="600">🎯 Decisions</text>
                    <!-- Matrix header row -->
                    <rect x="0" y="12" width="72" height="8" fill="#fff1f2"/>
                    <text x="20" y="18" font-size="4" fill="#9f1239" font-family="system-ui,sans-serif" font-weight="600">Cost</text>
                    <text x="34" y="18" font-size="4" fill="#9f1239" font-family="system-ui,sans-serif" font-weight="600">Speed</text>
                    <text x="50" y="18" font-size="4" fill="#9f1239" font-family="system-ui,sans-serif" font-weight="600">Fit</text>
                    <text x="61" y="18" font-size="4" fill="#9f1239" font-family="system-ui,sans-serif" font-weight="600">Score</text>
                    <!-- Row 1: Build -->
                    <rect x="0" y="20" width="72" height="9" fill="white"/>
                    <text x="2" y="26" font-size="4" fill="#374151" font-family="system-ui,sans-serif">Build</text>
                    <rect x="18" y="22" width="12" height="5" rx="1" fill="#10b981"/>
                    <text x="20" y="26" font-size="3.5" fill="white" font-family="system-ui,sans-serif">85</text>
                    <rect x="32" y="22" width="12" height="5" rx="1" fill="#f59e0b"/>
                    <text x="34" y="26" font-size="3.5" fill="white" font-family="system-ui,sans-serif">52</text>
                    <rect x="48" y="22" width="12" height="5" rx="1" fill="#10b981"/>
                    <text x="50" y="26" font-size="3.5" fill="white" font-family="system-ui,sans-serif">90</text>
                    <text x="62" y="26" font-size="4" fill="#374151" font-family="system-ui,sans-serif" font-weight="600">76</text>
                    <!-- Row 2: Buy ⭐ -->
                    <rect x="0" y="29" width="72" height="9" fill="#fff1f2"/>
                    <text x="2" y="35" font-size="4" fill="#374151" font-family="system-ui,sans-serif">Buy ⭐</text>
                    <rect x="18" y="31" width="12" height="5" rx="1" fill="#ef4444"/>
                    <text x="20" y="35" font-size="3.5" fill="white" font-family="system-ui,sans-serif">35</text>
                    <rect x="32" y="31" width="12" height="5" rx="1" fill="#10b981"/>
                    <text x="34" y="35" font-size="3.5" fill="white" font-family="system-ui,sans-serif">91</text>
                    <rect x="48" y="31" width="12" height="5" rx="1" fill="#f59e0b"/>
                    <text x="50" y="35" font-size="3.5" fill="white" font-family="system-ui,sans-serif">68</text>
                    <text x="61" y="35" font-size="4" fill="#be123c" font-family="system-ui,sans-serif" font-weight="700">82</text>
                    <!-- Row 3: Hybrid -->
                    <rect x="0" y="38" width="72" height="9" fill="white"/>
                    <text x="2" y="44" font-size="4" fill="#374151" font-family="system-ui,sans-serif">Hybrid</text>
                    <rect x="18" y="40" width="12" height="5" rx="1" fill="#f59e0b"/>
                    <text x="20" y="44" font-size="3.5" fill="white" font-family="system-ui,sans-serif">61</text>
                    <rect x="32" y="40" width="12" height="5" rx="1" fill="#f59e0b"/>
                    <text x="34" y="44" font-size="3.5" fill="white" font-family="system-ui,sans-serif">58</text>
                    <rect x="48" y="40" width="12" height="5" rx="1" fill="#10b981"/>
                    <text x="50" y="44" font-size="3.5" fill="white" font-family="system-ui,sans-serif">79</text>
                    <text x="62" y="44" font-size="4" fill="#374151" font-family="system-ui,sans-serif" font-weight="600">67</text>
                    <!-- Footer -->
                    <rect x="0" y="47" width="72" height="6" fill="#fff1f2"/>
                    <text x="4" y="52" font-size="3.5" fill="#9f1239" font-family="system-ui,sans-serif">Recommendation: Buy → fastest value delivery</text>
                  </svg>
                </div>

                <!-- Fallback for any future coming-soon agents -->
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
              <!-- min-h-0: prevents flex children from overflowing a constrained row.
                   overflow-hidden: defensive clip so blurb never bleeds past card edge. -->
              <div class="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
                <p class="text-xs text-slate-600 leading-relaxed line-clamp-3 min-h-0">{{ agent.blurb }}</p>

                <!-- shrink-0: button container must never compress — guarantees it is
                     always fully visible and never overlaps the blurb text above. -->
                <div class="mt-auto shrink-0">
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
                          : agent.id === 'models'
                            ? 'bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600'
                            : agent.id === 'evo-step-critique'
                              ? 'bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600'
                              : agent.id === 'plan-importer'
                                ? 'bg-orange-600 hover:bg-orange-700 focus-visible:outline-orange-600'
                                : agent.id === 'decisions'
                                  ? 'bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600'
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
