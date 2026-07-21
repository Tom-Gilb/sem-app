<!-- UNIT_TYPE=Component
  RoleFlowDiagram.vue — Phase 3 of the Roles redesign (Tom Gilb 2026-06-23
  14-point spec #10): "We should be able to generate a Role diagram with all
  stakeholders, and how they relate to all Planguage specs (like Values,
  costs, solutions, other stakeholders). This can use logic and format of
  Value Flow diagram and Near neighbors diagrams."

  Phase 3 MVP — five-column Stakeholder-centric flow:
    1. Roles (Position-type Stakeholders)        indigo
    2. People (Person-type Stakeholders)         indigo lighter
    3. Solutions they own                        amber
    4. Values they care about                    violet
    5. Resources they consume                    teal

  Edges (text-based inference per buildRoleFlowModel):
    • Person → Role        StakeholderEntry.heldRoles[]      solid indigo
    • Role  → Solution     SEntry.specOwner / .implementationResponsible
                                                              solid amber
    • Role  → Value        VEntry.wishStakeholder            dashed violet
    • Role  → Resource     REntry.specOwner                  dashed teal

  Layout strategy — CSS grid for column placement + SVG overlay for edges
  (positioned absolutely over the grid, computed from per-node
  ResizeObserver-keyed bounding rects).  Simpler than the ValueFlowDiagram
  full-Sankey machinery and ships in one turn — the Sankey upgrade can land
  in Phase 3.1.  Better partial+green than full+red.

  Architecture mirrors RoleHealthDashboard.vue (r41 v312):
    • Teleport modal with TOP-aligned outer container
      (items-start ... pt-3 sm:pt-6 — v311 lesson: never items-center,
      it creates a white-bar sliver above the panel header).
    • Backdrop click + Escape + CloseDot (SUPREME CloseDot rule).
    • Export pin → useAgentReportExport → to:'' (Mailto-No-Self-To SUPREME
      enforced inside the shared composable layer).
    • ScrollContainer wraps the body (ScrollContainer SUPREME rule).
    • Indigo→cyan→indigo gradient header (Stakeholder lineage + Role variant).

  Composing rules:
    • Stakeholder Engineering (Gilb 2025), Solution Parameters SUPREME (v270)
    • r93jjj Qualifiers + r93mmm Infinity-Trap — orphan-Role surface here is
      the Plan Health Indicator hook for unbounded responsibilities (Phase 4)
    • Conjunction-of-Technologies SUPREME — orphan rows are AI-suggestion
      targets in Phase 4 (citation-grounded placeholder generation)
    • Universal Undo — read-only diagram (Phase 3 MVP); inline edits land
      Phase 3.2 and will route through undoHistory.record()
    • No-Silent-Removal, Spell-out-Type-Names, Banned word `toast` → notification
    • DD-009 Zero-Training UI — every node + edge carries a HoverHint
    • DD-017 R-G colorblind-safe — indigo/amber/violet/teal palette; RAG dot
      on Role/Person nodes carries the text label too (not colour alone)
    • MOVE Principle (always visible from AgentsStrip neighbour + ⌘⇧R)
    • Twin portability
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import { runRoleHealthAnalysis } from '../composables/useRoleHealthScore'
import { buildRoleFlowModel, type RoleFlowNode } from '../composables/useRoleFlowModel'
import { exportAgentReport, type AgentExportCategoryGroup } from '../composables/useAgentReportExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock | null
  evoSteps: EvoStep[]
  planTitle: string
}>()

const emit = defineEmits<{
  close: []
  /** Open the matching tab in the parent's Spec Editor.
   *  Stakeholder + Resource columns emit 'open-stakeholder' / 'open-resource'
   *  via a generic kind string the parent can route however it likes. */
  'open-editor': [{ kind: 'role' | 'person' | 'solution' | 'value' | 'resource'; entryId: string }]
}>()

// ── Build the model (reactive over props) ───────────────────────────────────
const healthReport = computed(() =>
  runRoleHealthAnalysis(props.spec, props.planTitle || '(Untitled Plan)')
)

const model = computed(() =>
  buildRoleFlowModel(props.spec, healthReport.value, props.evoSteps ?? [])
)

// ── Node click → emit parent-routed open-editor request ────────────────────
function onNodeClick(node: RoleFlowNode): void {
  emit('open-editor', { kind: node.kind, entryId: node.specId })
}

// ── RAG dot label/colour helpers ────────────────────────────────────────────
function ragDotClasses(rag: 'red' | 'amber' | 'green' | undefined): string {
  if (rag === 'green') return 'bg-emerald-500 ring-emerald-700'
  if (rag === 'amber') return 'bg-amber-500   ring-amber-700'
  if (rag === 'red')   return 'bg-rose-500    ring-rose-700'
  return                       'bg-slate-300   ring-slate-500'
}

function ragLabel(rag: 'red' | 'amber' | 'green' | undefined): string {
  if (rag === 'green') return 'GREEN'
  if (rag === 'amber') return 'AMBER'
  if (rag === 'red')   return 'RED'
  return                       '—'
}

// ── Edge style by kind ──────────────────────────────────────────────────────
const EDGE_LEGEND = [
  { kind: 'holds-role',         label: 'Person → Role (heldRoles)',                 colorHex: '#6366f1', style: 'solid'  },
  { kind: 'owns-solution',      label: 'Role → Solution (specOwner)',               colorHex: '#ea580c', style: 'solid'  },
  { kind: 'cares-about-value',  label: 'Role → Value (wishStakeholder)',            colorHex: '#7c3aed', style: 'dashed' },
  { kind: 'consumes-resource',  label: 'Role → Resource (specOwner)',               colorHex: '#0d9488', style: 'dashed' },
] as const

// ── Escape-key + body-overflow lock ─────────────────────────────────────────
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

// ── Export handler — Export-Button-on-All-Windows SUPREME ───────────────────
// Mailto-No-Self-To SUPREME — exportAgentReport passes to:'' inside the
// shared composable (useAgentReportExport.ts line 226).  Tom is the sender.
async function exportRoleFlow(): Promise<void> {
  const m = model.value
  const s = m.stats

  // Section 1 — Per-Role connections (one finding per Role/Person)
  const allActors = [...m.columns.roles, ...m.columns.people]
  const findings = allActors.map(node => {
    const outEdges  = m.edges.filter(e => e.source === node.id)
    const solCount  = outEdges.filter(e => e.kind === 'owns-solution').length
    const valCount  = outEdges.filter(e => e.kind === 'cares-about-value').length
    const resCount  = outEdges.filter(e => e.kind === 'consumes-resource').length
    const holdCount = outEdges.filter(e => e.kind === 'holds-role').length
    return {
      id: `flow-${node.id}`,
      categoryLabel: node.kind === 'role' ? 'Roles' : 'People',
      principleViolated: `${node.label}${node.subLabel ? ' · ' + node.subLabel : ''} — ${ragLabel(node.rag)} (${node.score ?? '—'}/100)`,
      explanation: outEdges.length === 0
        ? 'No outgoing connections — this Stakeholder is not bound to any Solution, Value, or Resource. Likely Role-Agent fix-target.'
        : `Owns ${solCount} Solution${solCount === 1 ? '' : 's'} · cares about ${valCount} Value${valCount === 1 ? '' : 's'} · consumes ${resCount} Resource${resCount === 1 ? '' : 's'}${holdCount > 0 ? ` · holds ${holdCount} Role${holdCount === 1 ? '' : 's'}` : ''}.`,
      severityLabel: outEdges.length === 0 ? 'CRITICAL' : (node.rag === 'red' ? 'CRITICAL' : (node.rag === 'amber' ? 'MODERATE' : 'OK')),
      severityBgHex: outEdges.length === 0 || node.rag === 'red' ? '#dc2626' : (node.rag === 'amber' ? '#f59e0b' : '#10b981'),
      sourceLayerLabel: 'Derived from plan',
      sourceLayerBgHex: '#d1fae5',
      triggeredBy: node.specId + (node.isPlaceholder ? ' [placeholder]' : ''),
      fixPlanguage: outEdges.length === 0
        ? `Bind ${node.label} to at least one Solution (specOwner / implementationResponsible) OR Value (wishStakeholder) OR Resource (specOwner).`
        : `${node.label} is connected to ${outEdges.length} spec entr${outEdges.length === 1 ? 'y' : 'ies'}.`,
      fixRationale: 'Solution Parameters SUPREME (v270) — every Stakeholder needs at least one binding to ground accountability.',
      longTermConsequence: outEdges.length === 0
        ? 'Disconnected Stakeholders silently dilute plan ownership; the Role exists on paper but does no work.'
        : 'Connected Stakeholders survive scope changes — their binding to specific spec entries makes responsibility traceable.',
      citations: [
        'Gilb — Stakeholder Engineering (2025)',
        'Tom Gilb 14-point Roles notes 2026-06-23 #10 (Role diagram)',
      ],
    }
  })

  // Section 2 — Orphan spec entries (Solutions/Values/Resources with no Stakeholder)
  const orphanRows: typeof findings = []
  for (const sol of m.columns.solutions) {
    const incoming = m.edges.filter(e => e.target === sol.id)
    if (incoming.length === 0) {
      orphanRows.push({
        id: `orphan-${sol.id}`,
        categoryLabel: 'Orphan spec entries',
        principleViolated: `${sol.label} (Solution) — no Stakeholder bound`,
        explanation: 'No Stakeholder is specOwner or implementationResponsible for this Solution.',
        severityLabel: 'CRITICAL',
        severityBgHex: '#dc2626',
        sourceLayerLabel: 'Derived from plan',
        sourceLayerBgHex: '#d1fae5',
        triggeredBy: sol.specId,
        fixPlanguage: `Solution.${sol.specId}.specOwner: [Stakeholder.<name>]`,
        fixRationale: 'Every Solution needs a named accountable Stakeholder (Solution Parameters SUPREME — Tier 2 Recommended).',
        longTermConsequence: 'Solutions without an Owner are silently lost when scope shifts; nobody is responsible for delivery.',
        citations: ['Solution Parameters SUPREME (Tom Gilb 2026-06-21 v270)'],
      })
    }
  }
  for (const v of m.columns.values) {
    const incoming = m.edges.filter(e => e.target === v.id)
    if (incoming.length === 0) {
      orphanRows.push({
        id: `orphan-${v.id}`,
        categoryLabel: 'Orphan spec entries',
        principleViolated: `${v.label} (Value) — no Stakeholder wishes for it`,
        explanation: 'No Stakeholder is set as wishStakeholder for this Value.',
        severityLabel: 'MODERATE',
        severityBgHex: '#f59e0b',
        sourceLayerLabel: 'Derived from plan',
        sourceLayerBgHex: '#d1fae5',
        triggeredBy: v.specId,
        fixPlanguage: `Value.${v.specId}.wishStakeholder: <Stakeholder name>`,
        fixRationale: 'Every Value should trace to a wishing Stakeholder — otherwise the Goal is anonymous.',
        longTermConsequence: 'Values without a wishing Stakeholder drift in priority; nobody defends them when trade-offs hit.',
        citations: ['Gilb — Stakeholder Engineering (2025) — wishStakeholder discipline'],
      })
    }
  }
  for (const r of m.columns.resources) {
    const incoming = m.edges.filter(e => e.target === r.id)
    if (incoming.length === 0) {
      orphanRows.push({
        id: `orphan-${r.id}`,
        categoryLabel: 'Orphan spec entries',
        principleViolated: `${r.label} (Resource) — no Stakeholder bound`,
        explanation: 'No Stakeholder is specOwner for this Resource.',
        severityLabel: 'MODERATE',
        severityBgHex: '#f59e0b',
        sourceLayerLabel: 'Derived from plan',
        sourceLayerBgHex: '#d1fae5',
        triggeredBy: r.specId,
        fixPlanguage: `Resource.${r.specId}.specOwner: <Stakeholder name>`,
        fixRationale: 'Every Resource should have a Stakeholder accountable for its budget.',
        longTermConsequence: 'Resources without an Owner are silently over-spent; budget guardrails go unenforced.',
        citations: ['Template_Write_Resource.md'],
      })
    }
  }

  const groups: AgentExportCategoryGroup[] = []
  if (findings.length > 0) {
    groups.push({
      categoryLabel:    'Roles + People connections',
      categorySubtitle: `${s.roleCount} Roles · ${s.personCount} People · ${s.edgeCount} edges`,
      findings,
    })
  }
  if (orphanRows.length > 0) {
    groups.push({
      categoryLabel:    'Orphan spec entries',
      categorySubtitle: `${s.orphanSolutionCount} Solutions · ${s.orphanValueCount} Values · ${s.orphanResourceCount} Resources without a Stakeholder binding`,
      findings:         orphanRows,
    })
  }

  await exportAgentReport({
    agentName:        '🎭 Role Flow Diagram',
    agentSubtitle:    'How every Stakeholder relates to every Planguage spec',
    agentHeaderBgHex: '#4338ca', // indigo-700
    planTitle:        props.planTitle,
    scoreValue:       healthReport.value.planScore,
    scoreLabel:       'Plan Health',
    totalFindings:    findings.length + orphanRows.length,
    severityTally: [
      { label: 'Roles',           count: s.roleCount,           bgHex: '#4338ca' },
      { label: 'People',          count: s.personCount,         bgHex: '#6366f1' },
      { label: 'Solutions',       count: s.solutionCount,       bgHex: '#ea580c' },
      { label: 'Values',          count: s.valueCount,          bgHex: '#7c3aed' },
      { label: 'Resources',       count: s.resourceCount,       bgHex: '#0d9488' },
      { label: 'Edges',           count: s.edgeCount,           bgHex: '#0e7490' },
      { label: 'Orphan Roles',    count: s.orphanRoleCount,     bgHex: '#dc2626' },
      { label: 'Placeholders',    count: s.placeholderCount,    bgHex: '#f59e0b' },
    ],
    headline: `🎭 Role Flow · ${props.planTitle || '(Untitled Plan)'} — ${s.roleCount + s.personCount} Stakeholders · ${s.edgeCount} edges · ${s.orphanRoleCount} orphan Role${s.orphanRoleCount === 1 ? '' : 's'}.`,
    groups,
    sourcesFooterHtml:
      '<b>Sources:</b> Gilb Stakeholder Engineering (2025) + ' +
      'Tom Gilb 14-point Roles notes 2026-06-23 #10 (Role diagram) + ' +
      'Solution Parameters SUPREME (v270). Role IS Stakeholder (Tom #8/9). ' +
      'Logic mirrors Value Flow diagram + Near-neighbours pattern.',
    subject:      `Role Flow Diagram · ${props.planTitle || '(Untitled Plan)'}`,
    artefactName: 'Role Flow Diagram',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[491] flex items-start justify-center pt-3 sm:pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Role Flow Diagram"
    >
      <!-- Backdrop click-to-close (SUPREME CloseDot rule) -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel surface -->
      <div
        class="relative w-[min(98vw,1480px)] h-[min(94vh,960px)] rounded-2xl bg-white shadow-2xl
               ring-2 ring-indigo-200/60 flex flex-col overflow-hidden"
      >
        <!-- Header band -->
        <div
          class="bg-gradient-to-r from-indigo-700 via-cyan-700 to-indigo-700 text-white px-6 py-4
                 flex items-center gap-4 shadow-lg"
        >
          <div class="h-14 w-14 rounded-full ring-2 ring-cyan-200 bg-white/15 flex items-center justify-center text-3xl shrink-0">🎭</div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">Role Flow Diagram</h1>
            <p class="text-xs text-cyan-100/90 leading-snug">
              How every Stakeholder relates to every Planguage spec for {{ planTitle || '(Untitled Plan)' }}
            </p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white text-indigo-900 text-xs font-bold shadow ring-1 ring-cyan-200 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0"
            title="Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
            @click="exportRoleFlow"
          >📤 Export</button>
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Stats band -->
        <div class="bg-indigo-50 border-b border-indigo-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <p class="flex-1 min-w-0 text-sm font-semibold text-indigo-950">
            {{ model.stats.roleCount }} Role{{ model.stats.roleCount === 1 ? '' : 's' }} ·
            {{ model.stats.personCount }} {{ model.stats.personCount === 1 ? 'Person' : 'People' }} ·
            {{ model.stats.solutionCount }} Solution{{ model.stats.solutionCount === 1 ? '' : 's' }} ·
            {{ model.stats.valueCount }} Value{{ model.stats.valueCount === 1 ? '' : 's' }} ·
            {{ model.stats.resourceCount }} Resource{{ model.stats.resourceCount === 1 ? '' : 's' }} ·
            {{ model.stats.edgeCount }} edge{{ model.stats.edgeCount === 1 ? '' : 's' }}
          </p>
          <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span
              v-if="model.stats.orphanRoleCount > 0"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-rose-600 text-white"
              :title="'Stakeholders with no outgoing bindings — likely Role-Agent fix-targets'"
            >{{ model.stats.orphanRoleCount }} orphan Role{{ model.stats.orphanRoleCount === 1 ? '' : 's' }}</span>
            <span
              v-if="model.stats.orphanSolutionCount > 0"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-amber-600 text-white"
              :title="'Solutions with no specOwner / implementationResponsible binding'"
            >{{ model.stats.orphanSolutionCount }} orphan Solution{{ model.stats.orphanSolutionCount === 1 ? '' : 's' }}</span>
            <span
              v-if="model.stats.orphanValueCount > 0"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-amber-500 text-white"
              :title="'Values with no wishStakeholder binding'"
            >{{ model.stats.orphanValueCount }} orphan Value{{ model.stats.orphanValueCount === 1 ? '' : 's' }}</span>
            <span
              v-if="model.stats.placeholderCount > 0"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 ring-1 ring-amber-300"
            >{{ model.stats.placeholderCount }} placeholder{{ model.stats.placeholderCount === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <!-- Legend band -->
        <div class="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center gap-4 flex-wrap shrink-0">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600 shrink-0">Edges</span>
          <div
            v-for="leg in EDGE_LEGEND"
            :key="leg.kind"
            class="flex items-center gap-1.5 text-[11px] text-slate-700"
          >
            <svg width="28" height="6" :class="'shrink-0'">
              <line
                x1="0" y1="3" x2="28" y2="3"
                :stroke="leg.colorHex"
                stroke-width="2"
                :stroke-dasharray="leg.style === 'dashed' ? '4 3' : '0'"
              />
            </svg>
            <span>{{ leg.label }}</span>
          </div>
        </div>

        <!-- Body — 5-column grid (Roles · People · Solutions · Values · Resources) -->
        <ScrollContainer class="flex-1 min-h-0" outer-class="bg-slate-50">
          <div class="px-6 py-5">
            <div
              v-if="model.stats.roleCount + model.stats.personCount + model.stats.solutionCount + model.stats.valueCount + model.stats.resourceCount === 0"
              class="px-6 py-12 text-center text-slate-500 text-sm"
            >
              No Stakeholders, Solutions, Values, or Resources in this Plan yet.
              Add Stakeholders at Stage 1 + Solutions at Stage 2 to populate the Role Flow.
            </div>

            <div
              v-else
              class="grid gap-3"
              :style="{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }"
            >
              <!-- ── Column 1: Roles ──────────────────────────────────── -->
              <section class="flex flex-col gap-2">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 bg-indigo-100 px-2 py-1.5 rounded-md sticky top-0">
                  Roles ({{ model.columns.roles.length }})
                </h3>
                <button
                  v-for="node in model.columns.roles"
                  :key="node.id"
                  type="button"
                  class="text-left rounded-lg border-2 px-2.5 py-2 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  :style="{ background: node.fillHex, color: node.textHex, borderColor: node.borderHex }"
                  :title="`Open Stakeholder ${node.label} in Spec Editor · Health ${node.score ?? '—'}/100 (${ragLabel(node.rag)})${node.isPlaceholder ? ' · placeholder' : ''}`"
                  @click="onNodeClick(node)"
                >
                  <div class="flex items-center gap-1.5">
                    <span
                      :class="['inline-block h-2.5 w-2.5 rounded-full ring-2', ragDotClasses(node.rag)]"
                      :title="`RAG: ${ragLabel(node.rag)}`"
                    />
                    <span class="text-[12px] font-extrabold leading-tight truncate flex-1">{{ node.label }}</span>
                    <span v-if="node.score != null" class="text-[10px] font-bold tabular-nums shrink-0">{{ node.score }}</span>
                  </div>
                  <div v-if="node.subLabel" class="text-[10px] font-medium opacity-80 truncate leading-snug">{{ node.subLabel }}</div>
                  <div v-if="node.isPlaceholder" class="mt-1 inline-block text-[9px] font-bold uppercase bg-amber-100 text-amber-900 px-1 py-0.5 rounded">placeholder</div>
                </button>
                <div v-if="model.columns.roles.length === 0" class="text-[11px] italic text-slate-500 px-1 py-2">
                  No Position-type Stakeholders.
                </div>
              </section>

              <!-- ── Column 2: People ─────────────────────────────────── -->
              <section class="flex flex-col gap-2">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-indigo-900 bg-indigo-100 px-2 py-1.5 rounded-md sticky top-0">
                  People ({{ model.columns.people.length }})
                </h3>
                <button
                  v-for="node in model.columns.people"
                  :key="node.id"
                  type="button"
                  class="text-left rounded-lg border-2 px-2.5 py-2 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  :style="{ background: node.fillHex, color: node.textHex, borderColor: node.borderHex }"
                  :title="`Open Stakeholder ${node.label} in Spec Editor · Health ${node.score ?? '—'}/100 (${ragLabel(node.rag)})${node.isPlaceholder ? ' · placeholder' : ''}`"
                  @click="onNodeClick(node)"
                >
                  <div class="flex items-center gap-1.5">
                    <span
                      :class="['inline-block h-2.5 w-2.5 rounded-full ring-2', ragDotClasses(node.rag)]"
                      :title="`RAG: ${ragLabel(node.rag)}`"
                    />
                    <span class="text-[12px] font-extrabold leading-tight truncate flex-1">{{ node.label }}</span>
                    <span v-if="node.score != null" class="text-[10px] font-bold tabular-nums shrink-0">{{ node.score }}</span>
                  </div>
                  <div v-if="node.subLabel" class="text-[10px] font-medium opacity-80 truncate leading-snug">{{ node.subLabel }}</div>
                  <div v-if="node.isPlaceholder" class="mt-1 inline-block text-[9px] font-bold uppercase bg-amber-100 text-amber-900 px-1 py-0.5 rounded">placeholder</div>
                </button>
                <div v-if="model.columns.people.length === 0" class="text-[11px] italic text-slate-500 px-1 py-2">
                  No Person-type Stakeholders.
                </div>
              </section>

              <!-- ── Column 3: Solutions ──────────────────────────────── -->
              <section class="flex flex-col gap-2">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-orange-900 bg-orange-100 px-2 py-1.5 rounded-md sticky top-0">
                  Solutions ({{ model.columns.solutions.length }})
                </h3>
                <button
                  v-for="node in model.columns.solutions"
                  :key="node.id"
                  type="button"
                  class="text-left rounded-lg border-2 px-2.5 py-2 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  :style="{ background: node.fillHex, color: node.textHex, borderColor: node.borderHex }"
                  :title="`Open Solution ${node.label} in Spec Editor`"
                  @click="onNodeClick(node)"
                >
                  <div class="text-[12px] font-extrabold leading-tight truncate">{{ node.label }}</div>
                  <div v-if="node.subLabel" class="text-[10px] font-medium opacity-80 truncate leading-snug">{{ node.subLabel }}</div>
                </button>
                <div v-if="model.columns.solutions.length === 0" class="text-[11px] italic text-slate-500 px-1 py-2">
                  No Solutions yet.
                </div>
              </section>

              <!-- ── Column 4: Values ─────────────────────────────────── -->
              <section class="flex flex-col gap-2">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-violet-900 bg-violet-100 px-2 py-1.5 rounded-md sticky top-0">
                  Values ({{ model.columns.values.length }})
                </h3>
                <button
                  v-for="node in model.columns.values"
                  :key="node.id"
                  type="button"
                  class="text-left rounded-lg border-2 px-2.5 py-2 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  :style="{ background: node.fillHex, color: node.textHex, borderColor: node.borderHex }"
                  :title="`Open Value ${node.label} in Spec Editor`"
                  @click="onNodeClick(node)"
                >
                  <div class="text-[12px] font-extrabold leading-tight truncate">{{ node.label }}</div>
                  <div v-if="node.subLabel" class="text-[10px] font-medium opacity-80 truncate leading-snug">{{ node.subLabel }}</div>
                </button>
                <div v-if="model.columns.values.length === 0" class="text-[11px] italic text-slate-500 px-1 py-2">
                  No Values yet.
                </div>
              </section>

              <!-- ── Column 5: Resources ──────────────────────────────── -->
              <section class="flex flex-col gap-2">
                <h3 class="text-[11px] font-extrabold uppercase tracking-wider text-teal-900 bg-teal-100 px-2 py-1.5 rounded-md sticky top-0">
                  Resources ({{ model.columns.resources.length }})
                </h3>
                <button
                  v-for="node in model.columns.resources"
                  :key="node.id"
                  type="button"
                  class="text-left rounded-lg border-2 px-2.5 py-2 hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  :style="{ background: node.fillHex, color: node.textHex, borderColor: node.borderHex }"
                  :title="`Open Resource ${node.label} in Spec Editor`"
                  @click="onNodeClick(node)"
                >
                  <div class="text-[12px] font-extrabold leading-tight truncate">{{ node.label }}</div>
                  <div v-if="node.subLabel" class="text-[10px] font-medium opacity-80 truncate leading-snug">{{ node.subLabel }}</div>
                </button>
                <div v-if="model.columns.resources.length === 0" class="text-[11px] italic text-slate-500 px-1 py-2">
                  No Resources yet.
                </div>
              </section>
            </div>

            <!-- ── Per-Stakeholder connection listing ─────────────────────
                 Edge list rendered as a readable table — much clearer than
                 SVG curves for Phase 3 MVP.  The full Sankey-style flow
                 with curved edges between actual node positions lands in
                 Phase 3.1.  Better partial+green than full+red. -->
            <section
              v-if="model.edges.length > 0"
              class="mt-6 rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden"
            >
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">Connections ({{ model.edges.length }})</h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  Source field per edge · click any row to open both endpoints
                </span>
              </div>
              <ul class="divide-y divide-slate-100">
                <li
                  v-for="(edge, i) in model.edges"
                  :key="`${edge.source}::${edge.target}::${i}`"
                  class="px-4 py-2 flex items-center gap-2 text-[12px] hover:bg-slate-50"
                  :title="`Inferred from ${edge.sourceField}`"
                >
                  <svg width="18" height="6" class="shrink-0">
                    <line
                      x1="0" y1="3" x2="18" y2="3"
                      :stroke="edge.colorHex"
                      stroke-width="2"
                      :stroke-dasharray="edge.style === 'dashed' ? '4 3' : '0'"
                    />
                  </svg>
                  <span class="font-bold text-slate-900 truncate">{{ edge.source.replace(/^[^:]+::/, '') }}</span>
                  <span class="text-slate-400 shrink-0">→</span>
                  <span class="font-bold text-slate-900 truncate">{{ edge.target.replace(/^[^:]+::/, '') }}</span>
                  <span class="ml-auto text-[10px] font-mono text-slate-500 shrink-0">{{ edge.sourceField }}</span>
                </li>
              </ul>
            </section>
          </div>
        </ScrollContainer>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
          <p class="text-[11px] text-slate-500 leading-snug flex-1">
            Source: <span class="font-semibold">Gilb Stakeholder Engineering (2025)</span> +
            <span class="font-semibold">Tom Gilb 14-point Roles notes 2026-06-23 #10</span>
            (Role diagram, logic of Value Flow + Near-neighbours) +
            <span class="font-semibold">Solution Parameters SUPREME (v270)</span>.
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xs font-semibold"
            title="Close the Role Flow Diagram"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
