<!-- UNIT_TYPE=Panel -->
<!--
/**
 * PlanguageAnalyzerPanel — Unified Planguage Analyzer.
 *
 * Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle, EXPLOIT #5:
 * "ONE panel where all 4 knowledge sources merge against the user's Planguage
 * artefact.  This is the ULTIMATE expression of the conjunction principle."
 *
 * Aggregates findings from the four conjunction layers in one filterable view:
 *   - Plan (deterministic spec analysis)
 *   - Standards (10.Standard/Standard.Kai-Zen/ audit — pulls from StandardsAuditorPanel data)
 *   - Gilb (Gilb-corpus-cited improvements — pulls from EvoStepImprovement data)
 *   - Internet/LLM (deferred to v2 Exploits #3 #4 — placeholder section)
 *
 * Every finding carries a SourceBadge so the user sees at a glance which
 * knowledge layer the assertion came from.  Filter pills at the top let the
 * user collapse to a single layer or view the union.
 *
 * v1 ships read-only aggregation across the existing tools' localStorage.  v2
 * adds: per-finding "Apply to spec" wiring, internet-fetch findings (Exploits
 * #3 #4), and direct PDF/book-reference fetching.
 *
 * Rules: Single-Surface, ScrollContainer, CloseDot, Planguage-Glyph-First,
 * Interaction Disclosure, Banned-Scrum-Vocabulary, AI-Max, Claude-Code-as-AI-Layer.
 */
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import SourceBadge from './SourceBadge.vue'
import { type StandardsAuditSet, storageKey as standardsKey } from '../data/standardsAudit'
import { type ImprovementSet, storageKey as improvementKey } from '../data/evoStepImprovement'
import { type FeedMeSet, storageKey as feedMeKey } from '../data/feedMe'
import type { AISource, SourceProvenance } from '../data/aiSource'
import { AI_SOURCE_META } from '../data/aiSource'
import type { SpecBlock } from '../types/spec'
import { exportArtefact } from '../composables/useExportShared'
import {
  renderPlanguageAnalyzerHtml,
  renderPlanguageAnalyzerPlain,
  type AnalyzerFinding,
} from '../composables/usePlanguageAnalyzerExport'

const props = defineProps<{
  spec: SpecBlock
  planId?: string
  /** Current evo steps (for cross-referencing improvement findings to steps). */
  stepNames?: string[]
  /** Optional plan name forwarded for the export header. */
  planName?: string
  /** Optional plan version label forwarded for the export header. */
  planVersion?: string
}>()

defineEmits<{ close: [] }>()

const planIdRef = computed(() => props.planId ?? 'default')

// ── Unified finding row (cross-tool aggregation) ─────────────────────────────

interface UnifiedFinding {
  /** Stable id (prefixed with origin tool: "std:" / "imp:" / "feed:") */
  id: string
  /** Originating tool name */
  origin: 'standards' | 'improvement' | 'feedMe'
  /** Originating tool display label */
  originLabel: string
  /** Severity / risk colour */
  severity: 'red' | 'orange' | 'green' | 'info'
  /** Target ref (spec entry id, step name, etc.) */
  targetRef: string
  /** Short title */
  title: string
  /** Full description / rationale */
  description: string
  /** Source-layer provenance */
  provenance: SourceProvenance
}

// ── Load source data from localStorage ───────────────────────────────────────

function loadStandards(): StandardsAuditSet | null {
  try {
    const raw = localStorage.getItem(standardsKey(planIdRef.value))
    if (!raw) return null
    return JSON.parse(raw) as StandardsAuditSet
  } catch { return null }
}

function loadFeedMe(): FeedMeSet | null {
  try {
    const raw = localStorage.getItem(feedMeKey(planIdRef.value))
    if (!raw) return null
    return JSON.parse(raw) as FeedMeSet
  } catch { return null }
}

function loadImprovements(stepNames: string[]): ImprovementSet[] {
  const sets: ImprovementSet[] = []
  for (const sn of stepNames) {
    try {
      const raw = localStorage.getItem(improvementKey(planIdRef.value, sn))
      if (!raw) continue
      sets.push(JSON.parse(raw) as ImprovementSet)
    } catch { /* skip corrupted */ }
  }
  return sets
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

const refreshTick = ref(0)
function refresh(): void { refreshTick.value++ }

const findings = computed<UnifiedFinding[]>(() => {
  // Touch refreshTick so this computed re-runs on manual refresh
  void refreshTick.value
  const out: UnifiedFinding[] = []

  // Standards auditor findings
  const std = loadStandards()
  if (std) {
    for (const f of std.findings) {
      out.push({
        id: `std:${f.id}`,
        origin: 'standards',
        originLabel: 'Standards Auditor',
        severity: f.severity,
        targetRef: f.targetRef,
        title: f.title,
        description: `${f.description}  Fix: ${f.suggestedFix}`,
        provenance: f.provenance,
      })
    }
  }

  // Evo Step Improvement ideas (across all loaded steps)
  const imps = loadImprovements(props.stepNames ?? [])
  for (const set of imps) {
    if (set.crazyIdea) {
      out.push({
        id: `imp:${set.stepName}:${set.crazyIdea.id}`,
        origin: 'improvement',
        originLabel: 'Evo Step Improvement (Crazy)',
        severity: 'orange',
        targetRef: set.stepName,
        title: set.crazyIdea.title,
        description: `${set.crazyIdea.description}  Rationale: ${set.crazyIdea.rationale}`,
        provenance: set.crazyIdea.provenance ?? { source: 'template' },
      })
    }
    for (const idea of set.betterIdeas) {
      out.push({
        id: `imp:${set.stepName}:${idea.id}`,
        origin: 'improvement',
        originLabel: `Evo Step Improvement (#${idea.rank})`,
        severity: 'green',
        targetRef: set.stepName,
        title: idea.title,
        description: `${idea.description}  Rationale: ${idea.rationale}`,
        provenance: idea.provenance ?? { source: 'template' },
      })
    }
    for (const idea of set.skunkworksIdeas) {
      out.push({
        id: `imp:${set.stepName}:${idea.id}`,
        origin: 'improvement',
        originLabel: `Skunkworks (#${idea.rank})`,
        severity: 'red',
        targetRef: set.stepName,
        title: idea.title,
        description: `${idea.description}  Rationale: ${idea.rationale}`,
        provenance: idea.provenance ?? { source: 'template' },
      })
    }
  }

  // FEED ME! recommended actions + tough questions
  const feed = loadFeedMe()
  if (feed) {
    for (const a of feed.recommendedActions) {
      out.push({
        id: `feed:act:${a.id}`,
        origin: 'feedMe',
        originLabel: 'FEED ME! Action',
        severity: a.status === 'rejected' ? 'info' : 'orange',
        targetRef: a.type,
        title: a.title,
        description: `${a.description}  Source: ${a.source}.  Reason: ${a.reason}`,
        provenance: a.provenance ?? { source: 'template' },
      })
    }
    if (feed.lastStepInParis) {
      for (const q of feed.lastStepInParis.toughQuestions) {
        out.push({
          id: `feed:tq:${q.id}`,
          origin: 'feedMe',
          originLabel: 'FEED ME! Tough Question',
          severity: 'red',
          targetRef: feed.lastStepInParis.stepName,
          title: q.text,
          description: `AI suggested answer: ${q.suggestedAIAnswer}`,
          provenance: q.answerProvenance ?? { source: 'llm' },
        })
      }
    }
  }

  return out
})

// ── Filtering ────────────────────────────────────────────────────────────────

const activeSourceFilter = ref<AISource | 'all'>('all')

const filteredFindings = computed<UnifiedFinding[]>(() =>
  activeSourceFilter.value === 'all'
    ? findings.value
    : findings.value.filter(f => f.provenance.source === activeSourceFilter.value),
)

// Count by source layer
const countsBySource = computed<Record<AISource | 'all', number>>(() => {
  const counts: Record<string, number> = { all: findings.value.length }
  for (const f of findings.value) {
    counts[f.provenance.source] = (counts[f.provenance.source] ?? 0) + 1
  }
  return counts as Record<AISource | 'all', number>
})

const SOURCE_FILTER_ORDER: Array<AISource | 'all'> = ['all', 'plan', 'gilb', 'standards', 'internet', 'llm', 'template']

function severityClasses(sev: UnifiedFinding['severity']): string {
  switch (sev) {
    case 'red':    return 'border-red-300'
    case 'orange': return 'border-amber-300'
    case 'green':  return 'border-emerald-300'
    case 'info':   return 'border-slate-200'
  }
}
function severityBadge(sev: UnifiedFinding['severity']): { label: string; classes: string } {
  switch (sev) {
    case 'red':    return { label: 'red',    classes: 'bg-red-100 text-red-700 border-red-300' }
    case 'orange': return { label: 'amber',  classes: 'bg-amber-100 text-amber-700 border-amber-300' }
    case 'green':  return { label: 'green',  classes: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
    case 'info':   return { label: 'info',   classes: 'bg-slate-100 text-slate-600 border-slate-300' }
  }
}

// ── Export · Tom Gilb 2026-06-23 autonomous backlog batch ───────────────────
// Export-Button-on-All-Windows SUPREME sweep target. Planguage Analyzer was on
// the pending list; this handler closes that gap. Mailto-No-Self-To SUPREME
// (Tom Gilb 2026-06-16): Tom is the SENDER on a SEM-App-initiated export —
// recipient is empty so Tom chooses on the Mail.app side.
async function exportPlanguageAnalyzer(): Promise<void> {
  const mapped: AnalyzerFinding[] = findings.value.map((f) => ({
    id: f.id,
    origin: f.origin,
    originLabel: f.originLabel,
    severity: f.severity,
    targetRef: f.targetRef,
    title: f.title,
    description: f.description,
    provenance: f.provenance,
  }))
  await exportArtefact({
    htmlText: renderPlanguageAnalyzerHtml({
      planName: props.planName ?? 'Current Spec',
      versionLabel: props.planVersion ?? '',
      findings: mapped,
      countsBySource: countsBySource.value,
    }),
    plainText: renderPlanguageAnalyzerPlain({
      planName: props.planName ?? 'Current Spec',
      versionLabel: props.planVersion ?? '',
      findings: mapped,
      countsBySource: countsBySource.value,
    }),
    subject: `Planguage Analyzer · ${props.planName ?? 'Current Spec'} · ${new Date().toLocaleDateString('en-AU')}`,
    artefactName: 'Planguage Analyzer',
    to: '',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planguage-analyzer-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">🔬</span>
          <div class="flex-1 min-w-0">
            <h2 id="planguage-analyzer-title" class="text-base font-bold">Planguage Analyzer (Unified)</h2>
            <p class="text-[11px] text-fuchsia-100 mt-0.5">
              All knowledge layers in ONE view · {{ findings.length }} finding{{ findings.length === 1 ? '' : 's' }} aggregated
              <span class="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/20">Conjunction-of-Technologies Exploit #5</span>
            </p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold"
            title="Re-load findings from each tool's localStorage"
            @click="refresh"
          >Refresh</button>
          <!-- ⬇ Export · Tom Gilb 2026-06-06 universal Export-on-all-windows rule.
               Mailto-No-Self-To SUPREME — to:'' (Tom is the sender). -->
          <button
            type="button"
            class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                   bg-amber-400/30 hover:bg-amber-400/50 text-white text-xs font-semibold
                   border border-amber-200/50 hover:border-amber-100 transition-colors"
            title="⬇ Export Planguage Analyzer — opens preview window with 100% of the aggregated findings (per-source-layer counts, per-tool groupings, Conjunction-of-Technologies footer, Glossary footnote). Copies colourful HTML to clipboard. Opens Mail (To: empty — you choose recipient)."
            aria-label="Export Planguage Analyzer — preview window + clipboard + Mail"
            @click="exportPlanguageAnalyzer"
          >
            ⬇ Export
          </button>
          <CloseDot variant="on-dark" aria-label="Close Planguage Analyzer" @click="$emit('close')" />
        </header>

        <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-5 space-y-4">

          <!-- Source-layer filter pills -->
          <section class="flex gap-1.5 flex-wrap items-center">
            <span class="text-[10px] font-bold uppercase tracking-wide text-slate-600">Filter by source:</span>
            <button
              v-for="src in SOURCE_FILTER_ORDER"
              :key="src"
              type="button"
              class="px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors"
              :class="activeSourceFilter === src
                ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
              :title="src === 'all' ? 'Show all findings' : AI_SOURCE_META[src as AISource].description"
              @click="activeSourceFilter = src"
            >
              {{ src === 'all' ? 'All' : AI_SOURCE_META[src as AISource].shortLabel }}
              <span class="opacity-70 ml-1">{{ countsBySource[src] ?? 0 }}</span>
            </button>
          </section>

          <!-- Empty state -->
          <div v-if="findings.length === 0" class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-sm text-slate-700">
            <p>No findings yet from any tool.  Run the Standards Auditor, generate Evo Step Improvements, or load a FEED ME! set first — this panel aggregates their output into one filterable view.</p>
          </div>

          <!-- Findings list -->
          <article
            v-for="f in filteredFindings"
            :key="f.id"
            class="rounded-xl border-2 bg-white overflow-hidden"
            :class="severityClasses(f.severity)"
          >
            <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
              <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border" :class="severityBadge(f.severity).classes">{{ severityBadge(f.severity).label }}</span>
              <span class="text-[9px] font-bold uppercase tracking-wide text-slate-500">{{ f.originLabel }}</span>
              <span class="text-[10px] font-mono text-slate-500">{{ f.targetRef }}</span>
              <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ f.title }}</h4>
              <SourceBadge :provenance="f.provenance" size="compact" />
            </header>
            <div class="p-3">
              <p class="text-xs text-slate-700">{{ f.description }}</p>
            </div>
          </article>

          <p v-if="findings.length > 0" class="text-[10px] text-slate-400 italic text-center pt-2">
            v1 aggregates Standards Auditor + Evo Step Improvement + FEED ME!.  v2 adds Internet-fetched + LLM findings (Conjunction Exploits #3 #4) + per-finding "Apply to spec" buttons.
          </p>
        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
