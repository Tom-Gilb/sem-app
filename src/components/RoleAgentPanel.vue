<!-- UNIT_TYPE=Component
  RoleAgentPanel.vue — Role Agent analysis output (Tom Gilb 2026-06-23 MAJOR
  REDESIGN: "PLEASE DO A MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY").

  Architecture: mirrors HeilmeierPanel.vue (Teleport modal, header band,
  summary card, findings list, Accept-Fix routing, CloseDot, backdrop click,
  Escape). Role IS Stakeholder (Tom #8/9) — fixes mutate the existing
  StakeholderEntry record using the role fields banked in spec.ts v305.

  Palette: indigo (Stakeholder lineage) → cyan (Role variant) to distinguish
  from Heilmeier (indigo → blue). Composes with DD-017 R-G colorblind-safe
  (indigo/cyan/amber/emerald/rose; no green-on-red).

  Phase 2+ deferred (banked as separate Tom turns):
    • Health Score (Tom #11/12)
    • Role Diagram (Tom #10 — like Value Flow + Near Neighbors)
    • Default-routing automation
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { RoleFinding, RoleCategory } from '../types/role'
import {
  ROLE_CATEGORY_META, ROLE_SEVERITY_META, ROLE_SOURCE_META,
} from '../types/role'
import {
  runRoleAnalysis, useRoleFindings,
} from '../composables/useRoleFindings'
import { exportAgentReport, type AgentExportCategoryGroup } from '../composables/useAgentReportExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock | null
  planTitle: string
}>()

const emit = defineEmits<{
  close: []
  'accept-fix': [finding: RoleFinding]
  /** r41 v405 — Confirmation CTA (Munger v404 pattern propagated per Tom 2026-06-28). */
  'confirm-and-view': [acceptedCount: number]
}>()

const { report, dismissedIds, setReport, dismissFinding } = useRoleFindings()

// Re-run analysis whenever spec or planTitle changes (including on open).
function rerun(): void {
  setReport(runRoleAnalysis(props.spec, props.planTitle || '(Untitled Plan)'))
}
onMounted(rerun)
watch(() => [props.spec, props.planTitle], rerun, { deep: true })

// ── Category groupings for the UI ───────────────────────────────────────────
const groupedFindings = computed(() => {
  const r = report.value
  if (!r) return [] as Array<{ category: RoleCategory; findings: RoleFinding[] }>
  return (Object.keys(r.byCategory) as RoleCategory[])
    .map(c => ({ category: c, findings: r.byCategory[c].filter(f => !dismissedIds.value.has(f.id)) }))
    .filter(g => g.findings.length > 0)
})

// ── Accept-Fix handler ──────────────────────────────────────────────────────
// r41 v405 — track accepted-fix count + Confirm-and-view CTA (Munger v404 pattern).
const acceptedCount = ref<number>(0)
function onAccept(finding: RoleFinding): void {
  emit('accept-fix', finding)
  dismissFinding(finding.id)
  acceptedCount.value++
}

function onDismiss(finding: RoleFinding): void {
  dismissFinding(finding.id)
}

function onConfirmAndView(): void {
  emit('confirm-and-view', acceptedCount.value)
}

// ── Escape-key + body-overflow lock ────────────────────────────────────────
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

// ── Severity-tally pills for the header ─────────────────────────────────────
const severityPills = computed(() => {
  const r = report.value
  if (!r) return []
  return (['critical', 'moderate', 'suggestion'] as const)
    .filter(s => r.bySeverity[s] > 0)
    .map(s => ({ key: s, label: ROLE_SEVERITY_META[s].label, count: r.bySeverity[s], bg: ROLE_SEVERITY_META[s].bg }))
})

// ── Score colour band (visual) ──────────────────────────────────────────────
const scoreColor = computed(() => {
  const s = report.value?.complianceScore ?? 0
  if (s >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-300' }
  if (s >= 60) return { bg: 'bg-amber-100',  text: 'text-amber-900',  ring: 'ring-amber-300' }
  return { bg: 'bg-red-100', text: 'text-red-900', ring: 'ring-red-300' }
})

const hasDismissed = computed(() => dismissedIds.value.size > 0)

// ── Export — Export-Button-on-All-Windows SUPREME (Tom 2026-06-23) ──────────
// Mailto-No-Self-To SUPREME: to: '' is passed via exportAgentReport().
async function exportRoleAgentReport(): Promise<void> {
  const r = report.value
  if (!r) return
  const groups: AgentExportCategoryGroup[] = groupedFindings.value.map(g => ({
    categoryLabel: ROLE_CATEGORY_META[g.category].label,
    categorySubtitle: ROLE_CATEGORY_META[g.category].subtitle,
    findings: g.findings.map(f => ({
      id: f.id,
      categoryLabel: ROLE_CATEGORY_META[g.category].label,
      principleViolated: f.principleViolated,
      explanation: f.explanation,
      severityLabel: ROLE_SEVERITY_META[f.severity].label,
      severityBgHex: f.severity === 'critical' ? '#dc2626' : (f.severity === 'moderate' ? '#f59e0b' : '#3b82f6'),
      sourceLayerLabel: ROLE_SOURCE_META[f.sourceLayer].label,
      sourceLayerBgHex: '#cffafe',
      triggeredBy: f.triggeredBy,
      fixPlanguage: f.suggestedFix.asPlanguage,
      fixRationale: f.suggestedFix.rationale,
      longTermConsequence: f.longTermConsequence,
      citations: [f.gilbCitation, f.muskCitation, f.monicaCitation].filter((c): c is string => !!c),
    })),
  }))
  await exportAgentReport({
    agentName: '🎭 Role Agent',
    agentSubtitle: 'Roles + Responsibilities · Stakeholder + Role Compliance',
    agentHeaderBgHex: '#0e7490', // cyan-700
    planTitle: props.planTitle,
    scoreValue: r.complianceScore,
    scoreLabel: 'Compliance',
    totalFindings: r.totalFindings,
    severityTally: [
      { label: 'CRITICAL',   count: r.bySeverity.critical,   bgHex: '#dc2626' },
      { label: 'MODERATE',   count: r.bySeverity.moderate,   bgHex: '#f59e0b' },
      { label: 'SUGGESTION', count: r.bySeverity.suggestion, bgHex: '#3b82f6' },
    ],
    headline: r.headline,
    groups,
    sourcesFooterHtml:
      '<b>Sources:</b> Gilb Stakeholder Engineering (2025) + Musk Responsibility Principle + ' +
      'Tom Gilb 10-point Roles framework (2026-06-23). Role IS Stakeholder (Tom #8/9).',
    subject: `Role Agent report · ${props.planTitle || '(Untitled Plan)'}`,
    artefactName: 'Role Agent report',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[490] flex items-start justify-center pt-3 sm:pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Role Agent — analysis output"
    >
      <!-- Backdrop click-to-close — CloseDot SUPREME rule -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel surface -->
      <div
        class="relative w-[min(96vw,1180px)] h-[min(92vh,920px)] rounded-2xl bg-white shadow-2xl
               ring-2 ring-cyan-200/60 flex flex-col overflow-hidden"
      >
        <!-- Header band — indigo→cyan gradient (Stakeholder lineage + Role variant) -->
        <div class="bg-gradient-to-r from-indigo-700 via-cyan-700 to-indigo-700 text-white px-6 py-4
                    flex items-center gap-4 shadow-lg">
          <div class="h-14 w-14 rounded-full ring-2 ring-cyan-200 bg-white/15 flex items-center justify-center text-3xl shrink-0">🎭</div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">Role Agent</h1>
            <p class="text-xs text-cyan-100/90 leading-snug">
              Roles + Responsibilities · Stakeholder + Role Compliance for {{ planTitle || '(Untitled Plan)' }}
            </p>
          </div>
          <!-- Compliance Score -->
          <div
            v-if="report"
            :class="[scoreColor.bg, scoreColor.text, scoreColor.ring]"
            class="rounded-2xl ring-2 px-4 py-2 text-center shrink-0"
            :title="`Role Compliance Score = 100 − (severity-weighted deductions across 13 Role-Agent categories). Higher means the plan names more Roles + Responsibilities specifically.`"
          >
            <div class="text-2xl font-extrabold leading-none">{{ report.complianceScore }}</div>
            <div class="text-[10px] font-bold uppercase tracking-wider">Compliance</div>
          </div>
          <!-- r41 v413 — top-banner mirror of the "✓ See consequences" CTA. -->
          <button
            v-if="acceptedCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 shrink-0"
            :title="`${acceptedCount} fix${acceptedCount === 1 ? '' : 'es'} accepted · click to close the Role panel and view the consequences in your specs.  Source: Role Agent attached to each mutated field.`"
            :aria-label="`See ${acceptedCount} accepted fix${acceptedCount === 1 ? '' : 'es'} in your specs`"
            @click="onConfirmAndView"
          >
            ✓ See {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }} in specs →
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white text-cyan-900 text-xs font-bold shadow ring-1 ring-cyan-200 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0"
            title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
            @click="exportRoleAgentReport"
          >📤 Export</button>
          <!-- v530 — Unrelated-Actions-Get-Visual-Space SUPREME (Tom Gilb 2026-07-22) -->
          <div class="w-px h-6 bg-slate-300 mx-2" aria-hidden="true" />
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Summary band — headline + severity tally -->
        <div v-if="report" class="bg-cyan-50 border-b border-cyan-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <p class="flex-1 min-w-0 text-sm font-semibold text-cyan-950">{{ report.headline }}</p>
          <div class="flex items-center gap-1.5 shrink-0">
            <span
              v-for="p in severityPills"
              :key="p.key"
              :class="[p.bg, 'text-white']"
              class="px-2 py-1 rounded-md text-[10px] font-extrabold tracking-wide"
            >{{ p.count }} {{ p.label }}</span>
            <button
              v-if="hasDismissed"
              type="button"
              class="px-2 py-1 rounded-md text-[10px] font-semibold text-cyan-700 bg-white ring-1 ring-cyan-300 hover:bg-cyan-100"
              title="Show dismissed findings again — restores every finding you have dismissed this session."
              @click="dismissedIds = new Set()"
            >Undismiss all ({{ dismissedIds.size }})</button>
          </div>
        </div>

        <!-- Findings list (scrollable) -->
        <ScrollContainer class="flex-1 min-h-0" outer-class="bg-slate-50">
          <div class="px-6 py-5 space-y-6">
            <!-- Empty state — no findings -->
            <div
              v-if="report && report.totalFindings === 0"
              class="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-5 py-8 text-center"
            >
              <p class="text-2xl mb-1">🎭 ✅</p>
              <p class="text-base font-bold text-emerald-900 mb-1">Roles + Responsibilities complete</p>
              <p class="text-xs text-emerald-700 max-w-md mx-auto">
                The plan names every required Role and Responsibility at this moment.
                Re-run after any spec change to keep the analysis current.
              </p>
            </div>

            <!-- Per-category groups -->
            <div
              v-for="group in groupedFindings"
              :key="group.category"
              class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden"
            >
              <!-- Category header -->
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">
                  {{ ROLE_CATEGORY_META[group.category].label }}
                </h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  {{ ROLE_CATEGORY_META[group.category].subtitle }}
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ group.findings.length }}
                </span>
              </div>

              <!-- Per-finding card -->
              <ul class="divide-y divide-slate-200">
                <li v-for="f in group.findings" :key="f.id" class="px-4 py-4 flex flex-col gap-2">
                  <div class="flex items-start gap-3 flex-wrap">
                    <span
                      :class="[ROLE_SEVERITY_META[f.severity].bg, ROLE_SEVERITY_META[f.severity].text]"
                      class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider shrink-0"
                    >{{ ROLE_SEVERITY_META[f.severity].label }}</span>
                    <span
                      :class="[ROLE_SOURCE_META[f.sourceLayer].bg, ROLE_SOURCE_META[f.sourceLayer].text]"
                      class="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0"
                    >{{ ROLE_SOURCE_META[f.sourceLayer].label }}</span>
                    <span class="text-[11px] text-slate-500 leading-snug shrink-0">→ {{ f.triggeredBy }}</span>
                  </div>

                  <p class="text-sm font-bold text-slate-900">{{ f.principleViolated }}</p>
                  <p class="text-[13px] text-slate-700 leading-relaxed">{{ f.explanation }}</p>

                  <!-- Suggested Planguage edit -->
                  <div class="rounded-lg bg-cyan-50 ring-1 ring-cyan-200 px-3 py-2 mt-1">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-1">
                      Proposed Planguage edit
                    </p>
                    <pre class="text-[11px] font-mono text-cyan-950 leading-snug whitespace-pre-wrap">{{ f.suggestedFix.asPlanguage }}</pre>
                    <p class="text-[11px] text-cyan-800 italic mt-1.5">{{ f.suggestedFix.rationale }}</p>
                  </div>

                  <!-- Long-term consequence -->
                  <p class="text-[11px] italic text-slate-500">{{ f.longTermConsequence }}</p>

                  <!-- Citations -->
                  <div class="flex flex-wrap gap-1.5">
                    <span v-if="f.gilbCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono">
                      {{ f.gilbCitation }}
                    </span>
                    <span v-if="f.muskCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono">
                      {{ f.muskCitation }}
                    </span>
                    <span v-if="f.monicaCitation"
                          class="text-[10px] px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 font-mono">
                      {{ f.monicaCitation }}
                    </span>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      title="Apply this fix to the spec — adds or annotates a Stakeholder record using the Role fields. Undo available via the global Undo pin or Cmd-Z."
                      @click="onAccept(f)"
                    >Accept Fix</button>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      title="Dismiss this finding for the rest of this session — does not modify the spec. Undismiss via the header pin."
                      @click="onDismiss(f)"
                    >Dismiss</button>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </ScrollContainer>

        <!-- r41 v405 — Confirmation block (Munger v404 pattern propagated per Tom 2026-06-28). -->
        <div
          v-if="acceptedCount > 0"
          class="shrink-0 border-t-2 border-emerald-500 bg-emerald-50 px-6 py-4 flex items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" class="text-2xl shrink-0">✓</span>
          <p class="flex-1 text-sm font-semibold text-emerald-900 leading-snug">
            You have accepted {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }}.<br/>
            <span class="text-[12px] font-normal text-emerald-800">The fixes are applied to your specs — click below to see the consequences.</span>
          </p>
          <button
            type="button"
            class="shrink-0 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-md
                   ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
            :title="`Close the Role panel and open the Spec Editor so you can see the ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'} in your specs.`"
            @click="onConfirmAndView"
          >✓ See the consequences in my specs now →</button>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
          <p class="text-[11px] text-slate-500 leading-snug flex-1">
            Source: <span class="font-semibold">Gilb Stakeholder Engineering</span> +
            <span class="font-semibold">Musk Responsibility Principle</span> +
            <span class="font-semibold">Tom Gilb 10-point Roles framework (2026-06-23)</span>.
            Role IS Stakeholder (Tom #8/9).
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            title="Re-run all 13 Role-Agent checks on the current spec"
            @click="rerun"
          >Re-run analysis</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 text-xs font-semibold"
            title="Close the Role Agent panel"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
