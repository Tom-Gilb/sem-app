<!-- UNIT_TYPE=Component
  RoleHealthDashboard.vue — Phase 2 of Roles redesign
  (Tom Gilb 2026-06-23 "then of course on with phase 2 and on").

  Three sections:
    1. Per-Stakeholder Health table (score + RAG + counts + top issues)
    2. RACI Matrix table (Roles × Processes; cells show R/A/C/I letters)
    3. PHI defect contribution (explanatory card; full integration deferred
       to Phase 2.1 — usePHI surface didn't exist as a single registry at
       v312 build time; we expose the report instead via the composable).

  Architecture mirrors RoleAgentPanel.vue:
    • Teleport modal with TOP-aligned outer container
      (items-start ... pt-3 sm:pt-6 — v311 lesson: never items-center,
      it creates a white bar sliver above the panel header).
    • Backdrop click + Escape + CloseDot (SUPREME CloseDot rule).
    • Export pin → useAgentReportExport → to: '' (Mailto-No-Self-To SUPREME).
    • ScrollContainer wrapping body (ScrollContainer SUPREME rule).
    • Indigo→cyan→indigo gradient header (Stakeholder lineage + Role variant).

  Composing rules:
    • Stakeholder Engineering (Gilb 2025), Solution Parameters SUPREME (v270)
    • Universal Undo (no mutation here), No-Silent-Removal, Spell-out-Type-Names
    • Banned word `toast` → notification, DD-009 Zero-Training UI
    • DD-017 R-G colorblind-safe (uses indigo/amber/rose; RAG labels are TEXT
      not colour alone — every cell carries the letter R/A/G/the word/etc.)
    • MOVE Principle, Twin portability
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import {
  runRoleHealthAnalysis, type StakeholderHealth,
} from '../composables/useRoleHealthScore'
import { buildRaciMatrix, type RaciCell, type RaciLetter } from '../composables/useRaciMatrix'
import {
  exportAgentReport, type AgentExportCategoryGroup,
} from '../composables/useAgentReportExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock | null
  evoSteps: EvoStep[]
  planTitle: string
}>()

const emit = defineEmits<{ close: [] }>()

// ── Reports — re-computed when spec / steps / title change ──────────────────
const healthReport = computed(() =>
  runRoleHealthAnalysis(props.spec, props.planTitle || '(Untitled Plan)')
)
const raciMatrix = computed(() =>
  buildRaciMatrix(props.spec, props.evoSteps ?? [], props.planTitle || '(Untitled Plan)')
)

// ── Plan-aggregate RAG colour band (visual) ─────────────────────────────────
const planRagClasses = computed(() => {
  const r = healthReport.value.planRag
  if (r === 'green') return { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-300' }
  if (r === 'amber') return { bg: 'bg-amber-100',   text: 'text-amber-900',   ring: 'ring-amber-300' }
  return                       { bg: 'bg-rose-100',    text: 'text-rose-900',    ring: 'ring-rose-300' }
})

function ragRowClasses(rag: 'red' | 'amber' | 'green'): string {
  if (rag === 'green') return 'bg-emerald-50 ring-1 ring-emerald-200'
  if (rag === 'amber') return 'bg-amber-50   ring-1 ring-amber-200'
  return                       'bg-rose-50    ring-1 ring-rose-200'
}

function ragLabel(rag: 'red' | 'amber' | 'green'): string {
  if (rag === 'green') return 'GREEN'
  if (rag === 'amber') return 'AMBER'
  return                       'RED'
}

function ragLabelClasses(rag: 'red' | 'amber' | 'green'): string {
  if (rag === 'green') return 'bg-emerald-600 text-white'
  if (rag === 'amber') return 'bg-amber-600   text-white'
  return                       'bg-rose-600    text-white'
}

// ── Pivot RACI matrix into Process×Stakeholder table for rendering ──────────
interface MatrixRow {
  processId: string
  processName: string
  cellsByStakeholder: Record<string, RaciLetter[]>
}
const matrixView = computed<{
  processes: MatrixRow[]
  stakeholderIds: string[]
  stakeholderNames: Record<string, string>
}>(() => {
  const m = raciMatrix.value
  const processMap = new Map<string, MatrixRow>()
  const stakeholderSet = new Set<string>()
  const nameMap: Record<string, string> = {}
  for (const c of m.cells) {
    stakeholderSet.add(c.stakeholderId)
    nameMap[c.stakeholderId] = c.stakeholderName
    if (!processMap.has(c.processId)) {
      processMap.set(c.processId, {
        processId: c.processId,
        processName: c.processName,
        cellsByStakeholder: {},
      })
    }
    processMap.get(c.processId)!.cellsByStakeholder[c.stakeholderId] = c.letters
  }
  // Ensure Processes referenced by issues but with no cells still appear.
  for (const issue of m.issues) {
    if (!processMap.has(issue.processId)) {
      processMap.set(issue.processId, {
        processId: issue.processId,
        processName: issue.processName,
        cellsByStakeholder: {},
      })
    }
  }
  return {
    processes:        [...processMap.values()],
    stakeholderIds:   [...stakeholderSet],
    stakeholderNames: nameMap,
  }
})

// ── Issue lookups for highlighting Process rows ─────────────────────────────
function issuesForProcess(processId: string): string[] {
  return raciMatrix.value.issues
    .filter(i => i.processId === processId)
    .map(i => {
      if (i.issue === 'no-responsible')       return 'No Responsible'
      if (i.issue === 'no-accountable')       return 'No Accountable'
      return                                         'Multiple Accountable'
    })
}

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

// Reactive re-runs are computed; nothing further to wire on watch.
watch(() => [props.spec, props.evoSteps, props.planTitle], () => { /* computed reacts */ }, { deep: true })

// ── Export handler — Export-Button-on-All-Windows SUPREME ───────────────────
// Mailto-No-Self-To SUPREME: to: '' is passed by useAgentReportExport via
// useAgentReportExport.ts line 226 (`to: ''` constant in exportAgentReport).
async function exportRoleHealthDashboard(): Promise<void> {
  const h = healthReport.value
  const m = raciMatrix.value

  // Section 1 — Per-Stakeholder Health
  const healthFindings = h.perStakeholder.map((row: StakeholderHealth) => ({
    id:                 `health-${row.stakeholderId}`,
    categoryLabel:      'Per-Stakeholder Health',
    principleViolated:  `${row.stakeholderName} — Health ${row.score}/100 (${ragLabel(row.rag)})`,
    explanation:        row.topIssues.length > 0
                          ? `Top issues: ${row.topIssues.join(' · ')}`
                          : 'No findings — this Stakeholder passes every Role check.',
    severityLabel:      row.rag === 'red' ? 'CRITICAL' : (row.rag === 'amber' ? 'MODERATE' : 'OK'),
    severityBgHex:      row.rag === 'red' ? '#dc2626' : (row.rag === 'amber' ? '#f59e0b' : '#10b981'),
    sourceLayerLabel:   'Derived from plan',
    sourceLayerBgHex:   '#d1fae5',
    triggeredBy:        row.stakeholderId + (row.isPlaceholder ? ' [placeholder]' : ''),
    fixPlanguage:       row.position ? `Position: ${row.position}` : '(no Position set)',
    fixRationale:       `Critical ${row.findingCounts.critical} · Moderate ${row.findingCounts.moderate} · Suggestion ${row.findingCounts.suggestion}`,
    longTermConsequence: row.score < 65
      ? 'Stakeholders below 65/100 carry too many unresolved Role findings — accountability gaps compound silently.'
      : (row.score < 85
          ? 'Stakeholder is at risk — minor Role gaps still pending.'
          : 'Stakeholder is on-track; revisit after every spec change to catch regressions.'),
    citations: [
      'Gilb — Stakeholder Engineering (2025)',
      'Tom Gilb 10-point Roles framework (2026-06-23)',
    ],
  }))

  // Section 2 — RACI Matrix issues (only emit cells that carry an issue, plus a summary)
  const raciFindings = m.issues.map(issue => ({
    id: `raci-${issue.issue}-${issue.processId}`,
    categoryLabel: 'RACI Matrix',
    principleViolated: issue.issue === 'no-responsible'
      ? `${issue.processName} — no Stakeholder is Responsible`
      : (issue.issue === 'no-accountable'
          ? `${issue.processName} — no Stakeholder is Accountable`
          : `${issue.processName} — multiple Accountable Stakeholders`),
    explanation: issue.issue === 'multiple-accountable'
      ? 'Every Process needs exactly ONE Accountable Stakeholder. Multiple A roles dilute ownership — Tom\'s rule, Musk\'s responsibility principle.'
      : 'Every Process needs at least one R and exactly one A. Missing letters → silent ownership gap.',
    severityLabel: 'CRITICAL',
    severityBgHex: '#dc2626',
    sourceLayerLabel: 'Derived from plan',
    sourceLayerBgHex: '#d1fae5',
    triggeredBy: issue.processId,
    fixPlanguage: issue.issue === 'no-responsible'
      ? `Solution.implementationResponsible: [Stakeholder.<name>] for Solutions linked to ${issue.processName}.`
      : (issue.issue === 'no-accountable'
          ? `Solution.specOwner: [Stakeholder.<name>] for the first Solution linked to ${issue.processName}.`
          : `Reduce specOwner / authority to ONE Stakeholder for ${issue.processName}.`),
    fixRationale: 'Solution Parameters SUPREME (v270) — specOwner + implementationResponsible drive the matrix.',
    longTermConsequence: 'Processes with RACI gaps slip silently; nobody recognises the gap until delivery is overdue.',
    citations: ['Solution Parameters SUPREME (Tom Gilb 2026-06-21 v270)'],
  }))

  const groups: AgentExportCategoryGroup[] = []
  if (healthFindings.length > 0) {
    groups.push({
      categoryLabel: 'Per-Stakeholder Health',
      categorySubtitle: 'Score 0-100 per Stakeholder · RAG band · top issues',
      findings: healthFindings,
    })
  }
  if (raciFindings.length > 0) {
    groups.push({
      categoryLabel: 'RACI Matrix issues',
      categorySubtitle: `Processes: ${m.processCount} · Stakeholders in matrix: ${m.stakeholderCount}`,
      findings: raciFindings,
    })
  }

  await exportAgentReport({
    agentName:        '🎭 Role Health Dashboard',
    agentSubtitle:    'Per-Stakeholder Health + RACI Matrix + PHI roll-up',
    agentHeaderBgHex: '#0e7490', // cyan-700
    planTitle:        props.planTitle,
    scoreValue:       h.planScore,
    scoreLabel:       'Plan Health',
    totalFindings:    healthFindings.length + raciFindings.length,
    severityTally: [
      { label: 'Red Stakeholders',    count: h.perStakeholder.filter(s => s.rag === 'red').length,   bgHex: '#dc2626' },
      { label: 'Amber Stakeholders',  count: h.perStakeholder.filter(s => s.rag === 'amber').length, bgHex: '#f59e0b' },
      { label: 'Green Stakeholders',  count: h.perStakeholder.filter(s => s.rag === 'green').length, bgHex: '#10b981' },
      { label: 'RACI Issues',         count: m.issues.length,                                        bgHex: '#dc2626' },
      { label: 'Placeholders',        count: h.placeholderCount,                                     bgHex: '#f59e0b' },
    ],
    headline:         h.headline,
    groups,
    sourcesFooterHtml:
      '<b>Sources:</b> Gilb Stakeholder Engineering (2025) + Musk Responsibility Principle + ' +
      'Tom Gilb 10-point Roles framework (2026-06-23) + ' +
      'Solution Parameters SUPREME (v270). Role IS Stakeholder (Tom #8/9).',
    subject:          `Role Health Dashboard · ${props.planTitle || '(Untitled Plan)'}`,
    artefactName:     'Role Health Dashboard',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[491] flex items-start justify-center pt-3 sm:pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Role Health Dashboard"
    >
      <!-- Backdrop click-to-close (SUPREME CloseDot rule) -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel surface -->
      <div
        class="relative w-[min(96vw,1280px)] h-[min(92vh,920px)] rounded-2xl bg-white shadow-2xl
               ring-2 ring-cyan-200/60 flex flex-col overflow-hidden"
      >
        <!-- Header band -->
        <div
          class="bg-gradient-to-r from-indigo-700 via-cyan-700 to-indigo-700 text-white px-6 py-4
                 flex items-center gap-4 shadow-lg"
        >
          <div class="h-14 w-14 rounded-full ring-2 ring-cyan-200 bg-white/15 flex items-center justify-center text-3xl shrink-0">🎭</div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">Role Health Dashboard</h1>
            <p class="text-xs text-cyan-100/90 leading-snug">
              Per-Stakeholder Health · RACI Matrix · PHI roll-up for {{ planTitle || '(Untitled Plan)' }}
            </p>
          </div>
          <!-- Plan Health Score -->
          <div
            :class="[planRagClasses.bg, planRagClasses.text, planRagClasses.ring]"
            class="rounded-2xl ring-2 px-4 py-2 text-center shrink-0"
            :title="'Plan Health Score = weighted mean of per-Stakeholder Health (0-100), minus 5 per placeholder Stakeholder. Higher = more Roles fully named with responsibilities, contact, time-span, RAG defaults, and spec-binding.'"
          >
            <div class="text-2xl font-extrabold leading-none">{{ healthReport.planScore }}</div>
            <div class="text-[10px] font-bold uppercase tracking-wider">Plan Health</div>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white text-cyan-900 text-xs font-bold shadow ring-1 ring-cyan-200 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0"
            title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
            @click="exportRoleHealthDashboard"
          >📤 Export</button>
          <!-- v530 — Unrelated-Actions-Get-Visual-Space SUPREME (Tom Gilb 2026-07-22) -->
          <div class="w-px h-6 bg-slate-300 mx-2" aria-hidden="true" />
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Summary band -->
        <div class="bg-cyan-50 border-b border-cyan-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <p class="flex-1 min-w-0 text-sm font-semibold text-cyan-950">{{ healthReport.headline }}</p>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white">
              {{ healthReport.perStakeholder.filter(s => s.rag === 'green').length }} GREEN
            </span>
            <span class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-amber-600 text-white">
              {{ healthReport.perStakeholder.filter(s => s.rag === 'amber').length }} AMBER
            </span>
            <span class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-rose-600 text-white">
              {{ healthReport.perStakeholder.filter(s => s.rag === 'red').length }} RED
            </span>
            <span
              v-if="healthReport.placeholderCount > 0"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 ring-1 ring-amber-300"
            >{{ healthReport.placeholderCount }} placeholder{{ healthReport.placeholderCount === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <!-- Body (scrollable) -->
        <ScrollContainer class="flex-1 min-h-0" outer-class="bg-slate-50">
          <div class="px-6 py-5 space-y-6">

            <!-- ── Section 1: Per-Stakeholder Health table ──────────────── -->
            <section class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">Per-Stakeholder Health</h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  Score 0-100 · RAG · finding counts · top issues (weakest first)
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ healthReport.perStakeholder.length }} Stakeholder{{ healthReport.perStakeholder.length === 1 ? '' : 's' }}
                </span>
              </div>

              <div v-if="healthReport.perStakeholder.length === 0" class="px-6 py-8 text-center text-slate-500 text-sm">
                No Stakeholders in this Plan yet. Health can be measured once Stakeholders are added.
              </div>

              <ul v-else class="divide-y divide-slate-200">
                <li
                  v-for="row in healthReport.perStakeholder"
                  :key="row.stakeholderId"
                  :class="ragRowClasses(row.rag)"
                  class="px-4 py-3 flex items-center gap-3 flex-wrap"
                >
                  <span
                    :class="ragLabelClasses(row.rag)"
                    class="px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0"
                  >{{ ragLabel(row.rag) }}</span>
                  <span class="text-base font-extrabold text-slate-900 shrink-0 tabular-nums">{{ row.score }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-900 truncate">
                      {{ row.stakeholderName }}
                      <span v-if="row.position" class="text-xs font-medium text-slate-600">· {{ row.position }}</span>
                      <span
                        v-if="row.isPlaceholder"
                        class="ml-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 ring-1 ring-amber-300 px-1.5 py-0.5 rounded"
                      >placeholder</span>
                    </p>
                    <p v-if="row.topIssues.length > 0" class="text-[11px] text-slate-600 truncate leading-snug">
                      Top: {{ row.topIssues.join(' · ') }}
                    </p>
                    <p v-else class="text-[11px] italic text-emerald-700 leading-snug">
                      No findings — this Stakeholder passes every Role check.
                    </p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                    <span
                      v-if="row.findingCounts.critical > 0"
                      class="bg-rose-600 text-white px-1.5 py-0.5 rounded"
                      title="Critical findings against this Stakeholder"
                    >{{ row.findingCounts.critical }}C</span>
                    <span
                      v-if="row.findingCounts.moderate > 0"
                      class="bg-amber-500 text-white px-1.5 py-0.5 rounded"
                      title="Moderate findings against this Stakeholder"
                    >{{ row.findingCounts.moderate }}M</span>
                    <span
                      v-if="row.findingCounts.suggestion > 0"
                      class="bg-blue-500 text-white px-1.5 py-0.5 rounded"
                      title="Suggestion findings against this Stakeholder"
                    >{{ row.findingCounts.suggestion }}S</span>
                  </div>
                </li>
              </ul>
            </section>

            <!-- ── Section 2: RACI Matrix ───────────────────────────────── -->
            <section class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">RACI Matrix</h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  Roles × Processes · R=Responsible · A=Accountable · C=Consulted · I=Informed
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ raciMatrix.processCount }} Process{{ raciMatrix.processCount === 1 ? '' : 'es' }} ·
                  {{ raciMatrix.stakeholderCount }} Role{{ raciMatrix.stakeholderCount === 1 ? '' : 's' }}
                </span>
              </div>

              <div v-if="matrixView.processes.length === 0" class="px-6 py-8 text-center text-slate-500 text-sm">
                No Evo Steps confirmed yet. Confirm Stage 6 Evo Steps to populate the RACI Matrix.
              </div>

              <div v-else class="overflow-x-auto">
                <table class="min-w-full text-[12px]">
                  <thead>
                    <tr class="bg-slate-100 border-b border-slate-300">
                      <th class="px-3 py-2 text-left font-extrabold text-slate-800 sticky left-0 bg-slate-100 z-10">Process</th>
                      <th
                        v-for="sId in matrixView.stakeholderIds"
                        :key="sId"
                        class="px-2 py-2 text-center font-bold text-slate-700"
                        :title="matrixView.stakeholderNames[sId] || sId"
                      >{{ matrixView.stakeholderNames[sId] || sId }}</th>
                      <th class="px-3 py-2 text-left font-bold text-rose-700">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in matrixView.processes"
                      :key="row.processId"
                      :class="issuesForProcess(row.processId).length > 0 ? 'bg-rose-50' : ''"
                      class="border-b border-slate-100"
                    >
                      <td class="px-3 py-2 font-semibold text-slate-800 sticky left-0 bg-inherit z-[1]">
                        {{ row.processName }}
                      </td>
                      <td
                        v-for="sId in matrixView.stakeholderIds"
                        :key="sId"
                        class="px-2 py-2 text-center font-mono font-bold tabular-nums text-slate-900"
                      >{{ (row.cellsByStakeholder[sId] || []).join('') || '·' }}</td>
                      <td class="px-3 py-2 text-[11px] text-rose-700 font-semibold">
                        {{ issuesForProcess(row.processId).join(' · ') }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <!-- ── Section 3: PHI defect contribution (explanatory card) ── -->
            <section class="rounded-xl bg-indigo-50 ring-1 ring-indigo-200 px-4 py-3">
              <h2 class="text-sm font-extrabold text-indigo-900 mb-1">PHI defect contribution</h2>
              <p class="text-[12px] text-indigo-950 leading-relaxed">
                Role Health rolls into the overall Plan Health Indicator as a new defect class
                <span class="font-mono font-bold">role-health-below-target</span>:
                fires when the Plan RAG is RED, when any Stakeholder scores below 65, or when
                placeholders remain unresolved. Phase 2.1 commits to wiring this defect into the
                <span class="italic">usePHI</span> registry once the registry shape is finalised.
                Until then, the live report is exposed via the
                <span class="font-mono font-bold">useRoleHealthScore</span> composable for any
                consumer that wants to read it.
              </p>
              <ul class="mt-2 text-[11px] text-indigo-900 list-disc list-inside leading-snug space-y-0.5">
                <li>Plan RAG: <span class="font-bold uppercase">{{ healthReport.planRag }}</span> ({{ healthReport.planScore }}/100)</li>
                <li>Stakeholders below 65: {{ healthReport.perStakeholder.filter(s => s.score < 65).length }}</li>
                <li>Placeholders: {{ healthReport.placeholderCount }}</li>
                <li>RACI issues: {{ raciMatrix.issues.length }}</li>
              </ul>
            </section>
          </div>
        </ScrollContainer>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
          <p class="text-[11px] text-slate-500 leading-snug flex-1">
            Source: <span class="font-semibold">Gilb Stakeholder Engineering (2025)</span> +
            <span class="font-semibold">Musk Responsibility Principle</span> +
            <span class="font-semibold">Tom Gilb 10-point Roles framework (2026-06-23)</span> +
            <span class="font-semibold">Solution Parameters SUPREME (v270)</span>.
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 text-xs font-semibold"
            title="Close the Role Health Dashboard"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
