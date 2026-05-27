<!--
  GlyphDataPanel.vue — Full reference panel for any Planguage glyph type.
  Opens when a PlTypeIcon is double-clicked (interactive mode) or when the
  user clicks a glyph FROM button in ArrowInfoPanel.

  Shows per glyph:
    • Big animated glyph + neon halo
    • Canonical name, abbreviation letter, Planguage notation
    • Extended definition (CE-aligned)
    • Ontology relationships — what this type connects to and how
    • Planguage syntax example (real entry)
    • Citations: CE page + 10.Standard/ link + Glossary URL

  z-tiers: backdrop z-[494], panel z-[495].
  Above ModelHistory (492/493) and ArrowInfoPanel (490/491).

  Single-Surface rule: caller must register 'glyphDataPanel' with
  registerExclusiveSurface in App.vue (not yet done — panel operates
  standalone until App.vue wiring is added).

  Architecture: all glyph reference data is co-located in this component
  (not a separate data file) so the panel is self-describing and portable
  to the Twin. PlTypeIcon is used for the live glyph render (no duplication).

  Spec: SEMappHandbook p.25 — "All-Glyphs-Have-Hover" + glyph reference cards.
  P2 (2026-05-27): Forensic reconstruction — was lost in git reset --hard.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed, onMounted, onUnmounted } from 'vue'
import PlTypeIcon, { type PlGlyphType } from './icons/PlTypeIcon.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Which glyph type to display reference data for. */
  plType: PlGlyphType
}>()

const emit = defineEmits<{
  close: []
  /** User clicked a related-type chip — navigate to that glyph's panel. */
  'show-glyph': [plType: PlGlyphType]
}>()

// ── Reference data ─────────────────────────────────────────────────────────────
// Each entry is the canonical Planguage definition, notation, example, and
// citation for one of the 8 entry types. Aligned with:
//   • Tom Gilb, Competitive Engineering (2005)
//   • 10.Standard/ Kai-Zen templates (Template_Write_*.md)
//   • Tom Gilb 2026-05-15 standing rule: inanimate stakeholders included
//   • DD-004: Function is binary (presence/absence only)

interface GlyphEntry {
  /** Full canonical name (e.g. "Value Requirement") */
  fullName: string
  /** Single-letter abbreviation used in Planguage specs */
  abbrev: string
  /** Official Planguage notation glyph — as it appears in diagrams */
  notation: string
  /** Brief notation description */
  notationHint: string
  /** Extended definition: 3–5 sentences, CE-aligned */
  definition: string
  /** Hex color for this type's badge (matches PlTypeIcon palette) */
  hex: string
  /** Tailwind bg/text classes for the mode badge */
  badgeClass: string
  /** Relationships from this type to others */
  relations: Array<{
    label: string
    type: PlGlyphType
    direction: '→' | '←' | '↔'
  }>
  /** A short real-world Planguage syntax example */
  example: string
  /** Primary citation */
  citation: string
  /** URL for more detail */
  url: string
}

const GLYPH_DATA: Record<PlGlyphType, GlyphEntry> = {
  value: {
    fullName: 'Value Requirement',
    abbrev: 'V.',
    notation: 'O--*-->',
    notationHint: 'circle (scale) → asterisk (goal) → arrow (improvement direction)',
    definition: `A Value is a quantified performance objective — a quality or characteristic that must reach a measurable level to satisfy a stakeholder. Values are defined by four key fields: Scale (what is measured), Meter (how it is measured), Tolerable (minimum acceptable level), and Goal (optimum target). The ratio of Value improvement to Cost is the fundamental Planguage prioritisation engine: solutions that deliver the most Value per unit Cost are scheduled first. Values are never binary — if it is binary, it is a Constraint or Function. Every Value must have a Scale and at least one numeric threshold (Tolerable or Goal) to be actionable.`,
    hex: '#7c3aed',
    badgeClass: 'bg-violet-100 text-violet-700',
    relations: [
      { label: 'measured for', type: 'stakeholder', direction: '←' },
      { label: 'achieved by', type: 'function',    direction: '←' },
      { label: 'delivered by', type: 'evo-step',   direction: '←' },
      { label: 'bounded by',   type: 'constraint', direction: '↔' },
    ],
    example: `V. Response Time:
  Scale: Seconds from user action to system response
  Meter: 95th-percentile measurement, production load
  Tolerable: < 5 s
  Goal: < 1 s
  Record: [2026-05-01] Current: 3.2 s`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 5 "Values and Scales", p.47',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  function: {
    fullName: 'Function Requirement',
    abbrev: 'F.',
    notation: '→O→',
    notationHint: 'input arrow → process circle → output arrow (capability flow)',
    definition: `A Function is a binary system capability — it is either PRESENT or ABSENT. There are no thresholds, no quality levels, no "partially present" functions. The quality and quantity of a function's output always attaches as a Value entry, not inside the function definition. This distinction is DD-004: "Function is binary." A well-formed function has a PresenceTest: a sentence that can be answered YES or NO to determine if the function is present. Functions are the structural skeleton of the system — they define WHAT the system does, not HOW WELL it does it.`,
    hex: '#16a34a',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    relations: [
      { label: 'qualified by',   type: 'value',       direction: '→' },
      { label: 'required by',    type: 'stakeholder', direction: '←' },
      { label: 'implemented by', type: 'solution',    direction: '←' },
      { label: 'bounded by',     type: 'constraint',  direction: '←' },
    ],
    example: `F. User Authentication:
  Description: The system authenticates users by credential.
  PresenceTest: Can a registered user log in with a valid username + password?
  Status: Present`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 3 "Functions", p.29 + DD-004 (2026-05-14)',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  constraint: {
    fullName: 'Constraint',
    abbrev: 'C.',
    notation: '[→O→]',
    notationHint: 'square brackets = hard boundary around the process (binary or scalar limit)',
    definition: `A Constraint is a requirement that must not be violated — a hard boundary on the solution space. Constraints include binary compliance rules (GDPR, ISO standards, legal requirements) and scalar budget limits (time, money, headcount). A solution that violates any constraint is invalid regardless of its Value delivery. All regulatory and legal requirements are Constraints. Budget entries are Constraints. The primary prioritisation in Planguage is maximising Value within all Constraints (DD-006). Constraints are distinct from Values: a Value has a Goal to optimise towards; a Constraint has a hard boundary that must not be crossed.`,
    hex: '#dc2626',
    badgeClass: 'bg-red-100 text-red-700',
    relations: [
      { label: 'bounds',         type: 'solution',    direction: '→' },
      { label: 'bounds',         type: 'value',       direction: '→' },
      { label: 'imposed by',     type: 'stakeholder', direction: '←' },
      { label: 'respected by',   type: 'evo-step',    direction: '←' },
    ],
    example: `C. GDPR Compliance:
  Description: All personal data processing must comply with EU GDPR.
  PresenceTest: Does data processing meet all GDPR Article 5 principles?
  Status: Must be Present

C. Budget:
  Scale: Total development expenditure in EUR
  Tolerable: ≤ 500 000
  Record: [2026-05-01] Current: 120 000`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 7 "Constraints", p.67',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  solution: {
    fullName: 'Solution',
    abbrev: 'S.',
    notation: '[*]→',
    notationHint: 'bracketed asterisk = design option flowing to outcomes',
    definition: `A Solution is a candidate design, strategy, or delivery approach that may implement Functions and achieve Values. Many solutions may address one stakeholder need; VDT (Value Delivery per unit Cost) determines which to schedule. Solutions are evaluated against Values (how much will this improve each Value?) and must respect all Constraints. A solution that maximally improves the highest-priority Values at the lowest Cost is the optimal choice. Solutions are hypotheses until tested against actual Value measurements in an Evo Step. The Planguage "Means" in the S·E·M parsing maps to Solutions.`,
    hex: '#ea580c',
    badgeClass: 'bg-orange-100 text-orange-700',
    relations: [
      { label: 'implements',   type: 'function',    direction: '→' },
      { label: 'improves',     type: 'value',       direction: '→' },
      { label: 'must respect', type: 'constraint',  direction: '→' },
      { label: 'serves',       type: 'stakeholder', direction: '→' },
    ],
    example: `S. Progressive Web App (PWA):
  Description: Deliver the application as a PWA for offline access and
  push notifications without requiring a native app install.
  Impact: V.Response Time Goal: 0.5 s (50% improvement)
          V.UserSatisfaction Goal: +18 points`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 6 "Solutions and Means", p.55',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  stakeholder: {
    fullName: 'Stakeholder',
    abbrev: 'Stakeholder:',
    notation: '←¶→',
    notationHint: 'pilcrow (person/entity) with bidirectional influence arrows',
    definition: `A Stakeholder is any entity — person, organisation, system, or inanimate object — with needs that the plan must address. Inanimate stakeholders are equally valid: data has needs (GDPR compliance), regulations have requirements (they are legal stakeholders), databases have integrity requirements (Tom Gilb 2026-05-15). Stakeholders define WHOSE Values, Functions, and Constraints matter. When a stakeholder's needs are not reflected in the spec, they are invisible in the plan — a source of later failure. Every Value and Constraint should trace to at least one stakeholder need. In Planguage, stakeholders include customers, operators, maintainers, regulators, and all data/system entities.`,
    hex: '#2563eb',
    badgeClass: 'bg-blue-100 text-blue-700',
    relations: [
      { label: 'has needs → ', type: 'value',       direction: '→' },
      { label: 'requires',     type: 'function',    direction: '→' },
      { label: 'imposes',      type: 'constraint',  direction: '→' },
      { label: 'benefits from',type: 'evo-step',    direction: '←' },
    ],
    example: `Stakeholder: Passenger
  Alias: end-user, traveller
  Needs: V.Journey Time, V.Reliability, F.RealTimeTracking
  Role: Primary value recipient; satisfaction is the primary success metric

Stakeholder: GDPR Regulation (inanimate)
  Needs: C.DataMinimisation, C.BreachNotification
  Role: Compliance requirement; all personal data processing must satisfy`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 2 "Stakeholders", p.17 · Tom Gilb 2026-05-15 verbatim: "all data is a stakeholder"',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  'evo-step': {
    fullName: 'Evo Step',
    abbrev: 'Evo Step',
    notation: '< ->+->',
    notationHint: 'back-arrow (learn) → forward-plus (deploy) → forward-arrow (measure)',
    definition: `An Evo Step is one incremental delivery cycle within the Evo 9-step cycle (Tom Gilb EVO 2024, Ch.2, p.19). Each Evo Step delivers measurable stakeholder value by implementing specific Solutions and measuring their actual impact on Values. Evo Steps are never sequential gates — they are independent, self-contained delivery cycles that can be navigated in any order (DD-007). The Planning Cycle (Steps 1–5) produces the Evo Steps; the Value Delivery Cycle (Steps 6–9: Develop → Deliver → Measure → Learn) executes them. Measure = collect V. entry Status data; Learn = interpret data and update the spec. Both are distinct events (Deming PDSA letter to Tom Gilb, 18 May 1991).`,
    hex: '#ca8a04',
    badgeClass: 'bg-amber-100 text-amber-700',
    relations: [
      { label: 'delivers',      type: 'value',       direction: '→' },
      { label: 'implements',    type: 'solution',    direction: '→' },
      { label: 'respects',      type: 'constraint',  direction: '→' },
      { label: 'composed of',   type: 'task',        direction: '→' },
      { label: 'serves',        type: 'stakeholder', direction: '→' },
    ],
    example: `Evo Step 1: Baseline Authentication
  Goal: Implement F.UserAuthentication and measure V.LoginSuccessRate
  Solutions: S.OAuthIntegration
  Deliver by: 2026-06-15
  Measure: V.LoginSuccessRate Current vs Goal

Evo Step 2: Response Time Optimisation
  Goal: Close the gap on V.ResponseTime from 3.2 s → 1 s Goal
  Solutions: S.CDNDeployment, S.DatabaseIndexing`,
    citation: 'Tom Gilb, EVO (2024) — Chapter 2 "The 9-Step Evo Cycle", p.19 · Tom Gilb 2026-05-23 verbatim: "My Evo cycle has 9-nine."',
    url: 'https://www.gilb.com/store/p71/',
  },

  task: {
    fullName: 'Task',
    abbrev: 'Task:',
    notation: '→O→*',
    notationHint: 'input → process circle → output arrow + asterisk (produces a deliverable)',
    definition: `A Task is a concrete work item that implements a Solution or delivers part of an Evo Step. Tasks are the engineering activities — coding, testing, deploying, documenting — that produce measurable results for stakeholders. Each Task consumes Resources (time, money, people) and contributes to the completion of an Evo Step. Tasks are the leaf nodes of the planning hierarchy: Stakeholders → Values → Solutions → Evo Steps → Tasks → Resources. A task that cannot be described in one clear sentence is probably too coarse and should be decomposed.`,
    hex: '#374151',
    badgeClass: 'bg-slate-100 text-slate-700',
    relations: [
      { label: 'implements',   type: 'evo-step',    direction: '→' },
      { label: 'consumes',     type: 'resource',    direction: '→' },
      { label: 'delivers',     type: 'solution',    direction: '→' },
    ],
    example: `Task: Implement JWT Authentication Middleware
  Description: Create Express.js middleware that validates JWT tokens on
  all protected API routes.
  Evo Step: Step 1 — Baseline Authentication
  Estimate: 2 person-days
  Owner: Backend team`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 9 "Tasks and Work Breakdown", p.89',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  resource: {
    fullName: 'Resource',
    abbrev: 'Resource:',
    notation: '→O',
    notationHint: 'input arrow → oval (resource pool) — consumed, no output arrow',
    definition: `A Resource is a budget, capacity, or material allocated to the plan. Resources include time (person-hours, calendar duration), money (financial budget), people (team capacity, named roles), and tooling (licences, infrastructure). Resources are consumed by Tasks and constrained by Budgets (which are Constraints). The Resource dimension of planning ensures that Value delivery is grounded in realistic capacity — no solution can be prioritised that exceeds available Resources. In Planguage, Resources are tracked with initial allocation and remaining-after-depletion status, which feeds the primary prioritisation calculation.`,
    hex: '#166534',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    relations: [
      { label: 'consumed by',   type: 'task',        direction: '←' },
      { label: 'allocated to',  type: 'evo-step',    direction: '←' },
      { label: 'bounded by',    type: 'constraint',  direction: '←' },
    ],
    example: `Resource: Development Team
  Scale: Person-days available in Q2 2026
  Initial: 120 person-days
  Remaining: 87 person-days
  Allocated: Evo Step 1: 15 pd · Evo Step 2: 18 pd`,
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 10 "Resources and Budgets", p.101',
    url: 'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },
}

// ── Computed ──────────────────────────────────────────────────────────────────

const data = computed(() => GLYPH_DATA[props.plType])

// ── Keyboard ──────────────────────────────────────────────────────────────────

function _onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', _onKeydown, { capture: true })
})
onUnmounted(() => {
  document.removeEventListener('keydown', _onKeydown, { capture: true })
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[494] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[495] flex items-start justify-center overflow-y-auto py-10 px-4"
      role="dialog"
      aria-modal="true"
      :aria-label="`${data.fullName} — Planguage glyph reference`"
    >
      <div class="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/20">

        <!-- ── Header: big glyph + type identity ──────────────────────── -->
        <div
          class="relative px-6 py-5 flex items-center gap-5"
          :style="{ background: `linear-gradient(135deg, ${data.hex}22 0%, #0f172a 100%)`,
                    borderBottom: `2px solid ${data.hex}44` }"
        >
          <!-- Neon-glow glyph (xl) -->
          <div
            class="shrink-0 p-3 rounded-xl bg-black/30"
            :style="{ filter: `drop-shadow(0 0 14px ${data.hex})` }"
            aria-hidden="true"
          >
            <PlTypeIcon :pl-type="plType" size="xl" />
          </div>

          <div class="flex-1 min-w-0">
            <!-- Abbreviation + notation -->
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold font-mono"
                :class="data.badgeClass"
              >{{ data.abbrev }}</span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono
                       bg-white/10 text-white/80 tracking-widest"
                :title="data.notationHint"
              >{{ data.notation }}</span>
            </div>

            <!-- Full name -->
            <h2 class="text-xl font-extrabold text-white leading-tight">{{ data.fullName }}</h2>
            <p class="text-xs text-white/50 mt-0.5 italic leading-tight">{{ data.notationHint }}</p>
          </div>

          <!-- Close button -->
          <div class="absolute top-3 right-4">
            <CloseDot variant="on-dark" aria-label="Close glyph reference panel" @click="emit('close')" />
          </div>
        </div>

        <!-- ── Body ────────────────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="bg-slate-50"
          inner-class="p-5 space-y-5"
          :style="{ maxHeight: '72vh' }"
        >

          <!-- Definition -->
          <section aria-labelledby="glyph-def-heading">
            <h3 id="glyph-def-heading"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Definition
            </h3>
            <p class="text-sm text-slate-700 leading-relaxed">{{ data.definition }}</p>
          </section>

          <!-- Ontology Relationships -->
          <section aria-labelledby="glyph-rel-heading">
            <h3 id="glyph-rel-heading"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Ontology — connects to
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="rel in data.relations"
                :key="rel.type"
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                       bg-white ring-1 ring-black/10 shadow-sm
                       hover:ring-indigo-400 hover:shadow-md transition-all
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                :title="`${data.fullName} ${rel.direction} ${rel.label} → ${GLYPH_DATA[rel.type].fullName} — click to view`"
                @click="emit('show-glyph', rel.type)"
              >
                <span class="text-[10px] font-mono text-slate-400 select-none">{{ rel.direction }}</span>
                <PlTypeIcon :pl-type="rel.type" size="md" />
                <div>
                  <span class="text-[10px] text-slate-400 leading-none block">{{ rel.label }}</span>
                  <span class="text-xs font-semibold text-slate-700 leading-tight">{{ GLYPH_DATA[rel.type].fullName }}</span>
                </div>
              </button>
            </div>
          </section>

          <!-- Planguage Example -->
          <section aria-labelledby="glyph-ex-heading">
            <h3 id="glyph-ex-heading"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Example
            </h3>
            <pre
              class="text-[11px] font-mono text-slate-700 bg-white rounded-xl px-4 py-3
                     ring-1 ring-black/8 overflow-x-auto whitespace-pre-wrap leading-relaxed"
            >{{ data.example }}</pre>
          </section>

          <!-- Citation + Link -->
          <section aria-labelledby="glyph-cit-heading">
            <h3 id="glyph-cit-heading"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Source
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed">{{ data.citation }}</p>
            <a
              :href="data.url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600
                     hover:text-indigo-800 hover:underline focus:outline-none focus-visible:ring-2
                     focus-visible:ring-indigo-400 rounded"
            >
              <span aria-hidden="true">🔗</span> More at gilb.com
              <span class="text-[10px] text-slate-400 font-normal" aria-label="opens in new tab">(↗)</span>
            </a>
          </section>

        </ScrollContainer>

      </div>
    </div>
  </Teleport>
</template>
