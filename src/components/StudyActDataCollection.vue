<!-- UNIT_TYPE=Panel -->
<!--
/**
 * StudyActDataCollection — Stage 9 (Study-Act) main view.
 *
 * Tom Gilb 2026-06-03 verbatim (full quote in evoStepFeedback.ts header):
 * frame for Evo Step Data Collection.  Per Evo Step (by tag): either skip
 * (state 1) or collect (state 2).  Per V/R estimate: Meter + deviation,
 * Measure value + ± range, Feedback Note, 6-tag Realism multi-select,
 * Leading/Lagging classifier, Responsible Analyst, Remarks, Problems,
 * Future Advice.  All optional — user can skip anything, come back later.
 * Every Save snapshots into versions[] with date+time.
 *
 * Honors canonical_evo_cycle.md: this is the Measure half of Evo step 8
 * (Measure) + 9 (Learn).  Owns the *data collection* — the interpretation
 * (Learn) is a future panel.
 *
 * v1 ships V-entry measures; R-entry (Resources / Budgets) wiring is
 * data-layer-ready (`targetType: 'value' | 'resource'`) but UI-wise we only
 * surface V entries today.  Comment marks the v2 path.
 */
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import {
  type EvoStepFeedback,
  type EvoStepFeedbackSet,
  type MeasureRecord,
  type MeasureRealism,
  type IndicatorType,
  MEASURE_REALISM_LABEL,
  INDICATOR_LABEL,
  type AnalysisFinding,
  type ActionItem,
  type ActionStatus,
  ACTION_STATUS_LABEL,
  loadSet,
  saveSet,
  createFeedback,
  createMeasure,
  createAction,
  snapshotVersion,
  snapshotMeasure,
  ensureAnalysis,
  ensureActions,
  buildAnalysisClaudianPrompt,
  buildActionsClaudianPrompt,
  formatTimestamp,
} from '../data/evoStepFeedback'
import SourceBadge from './SourceBadge.vue'
import CloseDot from './CloseDot.vue'
import { openEml } from '../composables/useEmlExport'

const props = defineProps<{
  spec: SpecBlock
  steps: EvoStep[]
  planId?: string
}>()

/**
 * Close emit — Tom 2026-06-04 *"the longstanding standard for all windows,
 * a close button"*.  Parent (App.vue) navigates away from stage 9 on close.
 */
const emit = defineEmits<{ close: [] }>()

const planIdRef = computed(() => props.planId ?? 'default')

// ── Persisted set ───────────────────────────────────────────────────────────

const set = ref<EvoStepFeedbackSet>({ planId: planIdRef.value, items: [], updatedAt: 0 })

onMounted(() => {
  set.value = loadSet(planIdRef.value)
})

watch(planIdRef, (id) => {
  set.value = loadSet(id)
})

// ── Step picker ─────────────────────────────────────────────────────────────

const selectedStepTag = ref<string>('')

const stepTags = computed(() => props.steps.map(s => s.name))

// Auto-select first step if none yet chosen.
watch(stepTags, (tags) => {
  if (!selectedStepTag.value && tags.length > 0) selectedStepTag.value = tags[0]
}, { immediate: true })

/** The feedback record for the currently-selected step (auto-create on first edit). */
const currentFeedback = computed<EvoStepFeedback | null>(() => {
  if (!selectedStepTag.value) return null
  return set.value.items.find(i => i.evoStepTag === selectedStepTag.value) ?? null
})

/** Ensure a feedback record exists for the selected step (creates if missing). */
function _ensureFeedback(): EvoStepFeedback {
  let fb = set.value.items.find(i => i.evoStepTag === selectedStepTag.value)
  if (!fb) {
    fb = createFeedback(selectedStepTag.value)
    set.value.items.push(fb)
  }
  return fb
}

// ── Skip path (Tom verbatim option 1) ───────────────────────────────────────

const skipReasonDraft = ref<string>('')

function skipStage(): void {
  const fb = _ensureFeedback()
  fb.state = 'skipped'
  fb.skipReason = skipReasonDraft.value.trim() || 'No step taken. No feedback. Skipped.'
  fb.updatedAt = Date.now()
  fb.versions.push(snapshotVersion(fb, 'Skip'))
  saveSet(set.value)
  skipReasonDraft.value = ''
}

function unskipStage(): void {
  const fb = _ensureFeedback()
  fb.state = 'collected'
  fb.skipReason = undefined
  fb.updatedAt = Date.now()
  saveSet(set.value)
}

// ── Collection path (Tom verbatim option 2) ─────────────────────────────────

/**
 * Seed measures from the live spec — one per V entry (R-entry wiring is a v2 path).
 * Idempotent: only adds rows for V entries that don't already have a measure.
 */
function seedMeasuresFromSpec(): void {
  const fb = _ensureFeedback()
  const existing = new Set(fb.measures.map(m => m.targetRef))
  for (const v of props.spec.values ?? []) {
    if (existing.has(v.id)) continue
    fb.measures.push(createMeasure(
      v.id,
      'value',
      v.description || v.id,
      v.goal || v.wish || v.tolerable || '',
    ))
  }
  fb.updatedAt = Date.now()
  saveSet(set.value)
}

function addBlankMeasure(): void {
  const fb = _ensureFeedback()
  fb.measures.push(createMeasure('(unspecified)', 'value', '', ''))
  fb.updatedAt = Date.now()
  saveSet(set.value)
}

function removeMeasure(id: string): void {
  if (!currentFeedback.value) return
  const idx = currentFeedback.value.measures.findIndex(m => m.id === id)
  if (idx >= 0) {
    currentFeedback.value.measures.splice(idx, 1)
    currentFeedback.value.updatedAt = Date.now()
    saveSet(set.value)
  }
}

function toggleRealism(m: MeasureRecord, tag: MeasureRealism): void {
  const i = m.realism.indexOf(tag)
  if (i >= 0) m.realism.splice(i, 1)
  else m.realism.push(tag)
  if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
  saveSet(set.value)
}

function setIndicator(m: MeasureRecord, value: IndicatorType): void {
  m.indicator = value
  if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
  saveSet(set.value)
}

/**
 * Per-measure save — Tom 2026-06-03 *"Each measure can be saved, edited
 * immediately, and all measures can be saved as a group"*.  Snapshots THIS
 * measure into its own `versions[]` and stamps `savedAt`.  Distinct from
 * the group save below which snapshots the WHOLE measures-array.
 */
function saveMeasure(m: MeasureRecord, label?: string): void {
  if (!m.versions) m.versions = []
  m.versions.push(snapshotMeasure(m, label))
  m.savedAt = Date.now()
  if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
  saveSet(set.value)
}

function setMeterUsage(m: MeasureRecord, usedDeclared: boolean): void {
  if (!m.meter) m.meter = { usedDeclaredMeter: usedDeclared }
  else m.meter.usedDeclaredMeter = usedDeclared
  if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
  saveSet(set.value)
}

/**
 * Auto-save on any v-model edit (text inputs, textareas).  Save ONLY — never
 * mutate the watched object from inside the callback, or it re-triggers the
 * deep watcher (Date.now() differs each tick) and Vue throws "Maximum
 * recursive updates exceeded" → component re-mounts → activePhase resets.
 * Tom 2026-06-04 bug report: clicking a Phase-2 checkbox jumped to Phase 1.
 * Root cause: the previous version of this watcher set updatedAt here,
 * causing the recursion.  Explicit handlers (toggleAnalysisSuggestion,
 * setIndicator, saveMeasure, etc.) already set updatedAt themselves.
 */
let _watcherSaving = false
watch(currentFeedback, () => {
  if (_watcherSaving) return
  _watcherSaving = true
  try { saveSet(set.value) } finally { _watcherSaving = false }
}, { deep: true })

// ── Versioning (Tom verbatim: "dated, and times") ───────────────────────────

const versionLabelDraft = ref<string>('')
/**
 * After-save confirmation — Tom 2026-06-03 *"the group measure name
 * disappeared after I saved the group"*.  Previously we auto-cleared the
 * label input on save which felt like a bug.  Now we KEEP the label in the
 * input (so the user can re-save quickly with the same/edited label) AND
 * surface a "✅ Saved as: <label> at HH:MM" confirmation pill above the
 * input so the user gets immediate visual feedback.
 */
const lastSavedGroupLabel = ref<string | null>(null)
const lastSavedGroupAt = ref<number | null>(null)

function saveVersion(): void {
  if (!currentFeedback.value) return
  const label = versionLabelDraft.value.trim() || undefined
  currentFeedback.value.versions.push(
    snapshotVersion(currentFeedback.value, label),
  )
  saveSet(set.value)
  // Keep the input value (do NOT clear) — Tom 2026-06-03 bug report.
  lastSavedGroupLabel.value = label ?? '(no label)'
  lastSavedGroupAt.value = Date.now()
}

// ── Phase tabs (Tom 2026-06-03 Study-Act 3-phase split) ────────────────────

type Phase = 'collect' | 'analyse' | 'act'
const activePhase = ref<Phase>('collect')

const PHASE_ORDER: Phase[] = ['collect', 'analyse', 'act']

const PHASE_META: Record<Phase, {
  num: number
  short: string
  long: string
  icon: string
  tone: string
  toneActive: string
  caption: string
  scrollTop: () => void
}> = {
  collect:  { num: 1, short: 'Data Collection', long: 'Phase 1 · Data Collection · Measure', icon: '📋', tone: 'border-amber-300 text-amber-800 bg-amber-50',     toneActive: 'border-amber-600 bg-amber-500 text-white',     caption: 'Capture the actual measures for each Value / Resource.', scrollTop: _scrollToTop },
  analyse:  { num: 2, short: 'Analysis',        long: 'Phase 2 · Analysis · Study',          icon: '🧠', tone: 'border-purple-300 text-purple-800 bg-purple-50', toneActive: 'border-purple-600 bg-purple-500 text-white', caption: 'What does the data mean vs estimates, long-term targets, and resources?', scrollTop: _scrollToTop },
  act:      { num: 3, short: 'Actions',         long: 'Phase 3 · Actions · Act',             icon: '🪄', tone: 'border-emerald-300 text-emerald-800 bg-emerald-50', toneActive: 'border-emerald-600 bg-emerald-500 text-white', caption: 'Propose actions, approve the ones you will commit to.', scrollTop: _scrollToTop },
}

function _scrollToTop(): void {
  // Defer one tick so the phase content has mounted before we scroll.
  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
}

function gotoPhase(p: Phase): void {
  activePhase.value = p
  _scrollToTop()
}
function nextPhase(): void {
  const idx = PHASE_ORDER.indexOf(activePhase.value)
  if (idx >= 0 && idx < PHASE_ORDER.length - 1) gotoPhase(PHASE_ORDER[idx + 1])
}
function prevPhase(): void {
  const idx = PHASE_ORDER.indexOf(activePhase.value)
  if (idx > 0) gotoPhase(PHASE_ORDER[idx - 1])
}
const hasNextPhase = computed(() => PHASE_ORDER.indexOf(activePhase.value) < PHASE_ORDER.length - 1)
const hasPrevPhase = computed(() => PHASE_ORDER.indexOf(activePhase.value) > 0)
const nextPhaseRef  = computed<Phase | null>(() => {
  const idx = PHASE_ORDER.indexOf(activePhase.value)
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null
})
const prevPhaseRef  = computed<Phase | null>(() => {
  const idx = PHASE_ORDER.indexOf(activePhase.value)
  return idx > 0 ? PHASE_ORDER[idx - 1] : null
})

// ── Phase 2 — Analysis state & helpers ─────────────────────────────────────

/**
 * Lazy-initialised analysis findings for the current step.  Computed read,
 * but read MUTATES via ensureAnalysis if not yet present — this seeds the
 * 6 penetrating questions on first visit (sharpening-style, Tom 2026-06-03).
 */
const analysisFindings = computed<AnalysisFinding[]>(() => {
  if (!currentFeedback.value) return []
  const set = ensureAnalysis(currentFeedback.value)
  return set.findings
})

function toggleAnalysisSuggestion(finding: AnalysisFinding, idx: number): void {
  const i = finding.acceptedSuggestionIdx.indexOf(idx)
  if (i >= 0) finding.acceptedSuggestionIdx.splice(i, 1)
  else finding.acceptedSuggestionIdx.push(idx)
  if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
  saveSet(set.value)
}

// Claudian critique paste-back for Phase 2 analysis.
const analysisPasteback = ref<string>('')
const analysisPastebackError = ref<string>('')

function copyAnalysisPrompt(): void {
  if (!currentFeedback.value) return
  const stepDesc = props.steps.find(s => s.name === selectedStepTag.value)?.description ?? ''
  const planSummary = JSON.stringify({
    functions: props.spec.functions?.map(f => ({ id: f.id, description: f.description })),
    values:    props.spec.values?.map(v => ({ id: v.id, description: v.description, scale: v.scale, goal: v.goal, wish: v.wish, tolerable: v.tolerable })),
    solutions: props.spec.solutions?.map(s => ({ id: s.id, description: s.description })),
    constraints: props.spec.constraints?.map(c => ({ id: c.id, description: c.description })),
  }, null, 2)
  const prompt = buildAnalysisClaudianPrompt(currentFeedback.value, planSummary, stepDesc)
  void navigator.clipboard?.writeText(prompt)
}

function applyAnalysisPasteback(): void {
  analysisPastebackError.value = ''
  if (!analysisPasteback.value.trim()) return
  try {
    const parsed = JSON.parse(analysisPasteback.value) as Array<{
      findingId: string
      critiques: AnalysisFinding['critiques']
    }>
    if (!Array.isArray(parsed)) throw new Error('Expected an array of critiques.')
    for (const entry of parsed) {
      const finding = analysisFindings.value.find(f => f.id === entry.findingId)
      if (!finding) continue
      finding.critiques = entry.critiques ?? []
    }
    if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
    saveSet(set.value)
    analysisPasteback.value = ''
  } catch (err) {
    analysisPastebackError.value = err instanceof Error ? err.message : String(err)
  }
}

// ── Phase 3 — Actions state & helpers ──────────────────────────────────────

const actionItems = computed<ActionItem[]>(() => {
  if (!currentFeedback.value) return []
  const set = ensureActions(currentFeedback.value)
  return set.items
})

const newActionDraft = ref<string>('')

function addUserAction(): void {
  if (!currentFeedback.value || !newActionDraft.value.trim()) return
  const set = ensureActions(currentFeedback.value)
  set.items.push(createAction(newActionDraft.value.trim()))
  newActionDraft.value = ''
  currentFeedback.value.updatedAt = Date.now()
  saveSet(setRef())
}

function setActionStatus(a: ActionItem, status: ActionStatus): void {
  a.status = status
  a.updatedAt = Date.now()
  if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
  saveSet(setRef())
}

function removeAction(id: string): void {
  if (!currentFeedback.value?.actions) return
  const idx = currentFeedback.value.actions.items.findIndex(a => a.id === id)
  if (idx >= 0) {
    currentFeedback.value.actions.items.splice(idx, 1)
    currentFeedback.value.updatedAt = Date.now()
    saveSet(setRef())
  }
}

/** Tiny indirection — returns the persistence-root ref's value. */
function setRef() { return set.value }

const actionsPasteback = ref<string>('')
const actionsPastebackError = ref<string>('')

function copyActionsPrompt(): void {
  if (!currentFeedback.value) return
  const stepDesc = props.steps.find(s => s.name === selectedStepTag.value)?.description ?? ''
  const planSummary = JSON.stringify({
    functions: props.spec.functions?.map(f => ({ id: f.id, description: f.description })),
    values:    props.spec.values?.map(v => ({ id: v.id, description: v.description, scale: v.scale, goal: v.goal, wish: v.wish, tolerable: v.tolerable })),
    solutions: props.spec.solutions?.map(s => ({ id: s.id, description: s.description })),
    constraints: props.spec.constraints?.map(c => ({ id: c.id, description: c.description })),
  }, null, 2)
  const prompt = buildActionsClaudianPrompt(currentFeedback.value, planSummary, stepDesc)
  void navigator.clipboard?.writeText(prompt)
}

function applyActionsPasteback(): void {
  actionsPastebackError.value = ''
  if (!actionsPasteback.value.trim()) return
  try {
    const parsed = JSON.parse(actionsPasteback.value) as Array<{
      description: string
      rationale?: string
      provenance?: ActionItem['provenance']
    }>
    if (!Array.isArray(parsed)) throw new Error('Expected an array of actions.')
    const set = ensureActions(currentFeedback.value!)
    const now = Date.now()
    for (const a of parsed) {
      if (!a.description) continue
      set.items.push({
        id: `act-${now}-${Math.random().toString(36).slice(2, 7)}`,
        description: a.description,
        status: 'proposed',
        rationale: a.rationale,
        provenance: a.provenance ?? { source: 'llm' },
        createdAt: now,
        updatedAt: now,
      })
    }
    if (currentFeedback.value) currentFeedback.value.updatedAt = Date.now()
    saveSet(setRef())
    actionsPasteback.value = ''
  } catch (err) {
    actionsPastebackError.value = err instanceof Error ? err.message : String(err)
  }
}

const ACTION_STATUSES: ActionStatus[] = ['proposed', 'approved', 'rejected', 'done']
const ACTION_STATUS_TONE: Record<ActionStatus, string> = {
  proposed: 'bg-amber-100 text-amber-800 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 border-rose-300',
  done:     'bg-slate-200 text-slate-700 border-slate-300',
}

// Quiet unused-import warning for ACTION_STATUS_LABEL — used in template only.
void ACTION_STATUS_LABEL

// ── Copy + Email exports per phase ─────────────────────────────────────────
// Tom 2026-06-04 *"as this is a long list with many possible people
// discussing it, copy and email are necessary (all 3 phases of 9)"*.
// Honors the Colorful Exports rule (Tom 2026-05-26): every export is a
// coloured HTML table with inline styles (sanitisers strip external <style>).
// Plain-text fallback computed by stripping tags for clients that paste text.

function _esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;')
}

function _exportTitle(phaseLabel: string): string {
  const step = selectedStepTag.value || '(no step)'
  return `Study-Act · ${phaseLabel} · ${step}`
}

/** Phase 1 export: measures table. */
function _buildCollectHtml(): string {
  const fb = currentFeedback.value
  const title = _exportTitle('Data Collection')
  const headers = ['Target','Estimate','Measured','Range','Meter','Realism','Indicator','Analyst','Feedback','Problems','Future advice']
  const rows = (fb?.measures ?? []).map(m => [
    `${m.targetType.toUpperCase()} · ${m.targetRef} · ${m.targetDescription}`,
    m.estimateText ?? '',
    m.measuredValue ?? '',
    (m.rangeLow || m.rangeHigh) ? `${m.rangeLow ?? '?'} – ${m.rangeHigh ?? '?'}` : '',
    m.meter?.usedDeclaredMeter ? 'Declared meter' : `Deviation: ${m.meter?.deviationNote ?? ''}`,
    m.realism.join(', '),
    m.indicator,
    m.analyst ?? '',
    m.feedbackNote ?? '',
    m.problems ?? '',
    m.futureAdvice ?? '',
  ])
  return _renderHtmlTable(title, headers, rows, '#f59e0b' /* amber */)
}

/** Phase 2 export: analysis Q&A + critiques. */
function _buildAnalyseHtml(): string {
  const title = _exportTitle('Analysis')
  const headers = ['Question','Accepted suggestions','Your answer','Claudian critiques']
  const rows = analysisFindings.value.map(f => [
    f.question,
    f.acceptedSuggestionIdx.map(i => `• ${f.suggestedAnswers[i] ?? ''}`).join('<br>'),
    f.userAnswer ?? '',
    (f.critiques ?? []).map(c => `• <i>${_esc(c.critique)}</i>` + (c.alternative ? `<br>&nbsp;&nbsp;→ ${_esc(c.alternative)}` : '')).join('<br>'),
  ])
  return _renderHtmlTable(title, headers, rows, '#a855f7' /* purple */, /*preEscapedColIdx*/ [1, 3])
}

/** Phase 3 export: actions list. */
function _buildActHtml(): string {
  const title = _exportTitle('Actions')
  const headers = ['Status','Action','Rationale','Owner','Due','Source']
  const rows = actionItems.value.map(a => [
    a.status.toUpperCase(),
    a.description,
    a.rationale ?? '',
    a.owner ?? '',
    a.dueDate ?? '',
    a.provenance?.source ?? '',
  ])
  return _renderHtmlTable(title, headers, rows, '#10b981' /* emerald */)
}

function _renderHtmlTable(
  title: string,
  headers: string[],
  rows: string[][],
  accent: string,
  preEscapedColIdx: number[] = [],
): string {
  const headerHtml = headers.map(h =>
    `<th style="background:${accent};color:#fff;padding:6px 10px;text-align:left;font-family:system-ui,sans-serif;font-size:12px;border:1px solid #ddd;">${_esc(h)}</th>`
  ).join('')
  const rowHtml = rows.map((r, ri) => {
    const bg = ri % 2 === 0 ? '#fff' : '#fafafa'
    return '<tr>' + r.map((cell, ci) => {
      const safe = preEscapedColIdx.includes(ci) ? cell : _esc(cell)
      return `<td style="background:${bg};padding:6px 10px;font-family:system-ui,sans-serif;font-size:12px;border:1px solid #ddd;vertical-align:top;">${safe}</td>`
    }).join('') + '</tr>'
  }).join('')
  return [
    `<div style="font-family:system-ui,sans-serif;">`,
    `<h2 style="color:${accent};font-size:16px;margin:0 0 8px 0;">${_esc(title)}</h2>`,
    `<table style="border-collapse:collapse;border:1px solid #ddd;">`,
    `<thead><tr>${headerHtml}</tr></thead>`,
    `<tbody>${rowHtml}</tbody>`,
    `</table>`,
    `<p style="font-size:10px;color:#666;margin-top:6px;">Generated ${formatTimestamp(Date.now())} · SEM App · Stage 9 Study-Act</p>`,
    `</div>`,
  ].join('')
}

function _htmlToText(html: string): string {
  return html.replace(/<br>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/th>|<\/td>/gi, '\t').replace(/<[^>]+>/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

const copiedPhase = ref<Phase | null>(null)

async function copyPhase(phase: Phase): Promise<void> {
  const html =
    phase === 'collect' ? _buildCollectHtml() :
    phase === 'analyse' ? _buildAnalyseHtml() :
                          _buildActHtml()
  const text = _htmlToText(html)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } catch {
    await navigator.clipboard.writeText(text)
  }
  copiedPhase.value = phase
  setTimeout(() => { if (copiedPhase.value === phase) copiedPhase.value = null }, 2000)
}

function emailPhase(phase: Phase): void {
  const html =
    phase === 'collect' ? _buildCollectHtml() :
    phase === 'analyse' ? _buildAnalyseHtml() :
                          _buildActHtml()
  const subject = _exportTitle(PHASE_META[phase].long)
  openEml(html, subject, { plainBody: _htmlToText(html) })
}

// ── UI labels ───────────────────────────────────────────────────────────────

const REALISM_TAGS: MeasureRealism[] = [
  'wild-guess', 'actual-counting', 'intuitive-observation', 'proper-meter', 'high-credibility', 'automated',
]
const INDICATOR_OPTIONS: IndicatorType[] = ['leading', 'lagging', 'unspecified']
</script>

<template>
  <section
    class="w-full max-w-3xl mx-auto px-4 py-6"
    aria-label="Evo Step Data Collection — Study-Act stage"
  >
    <!-- Header — CloseDot at end of flex header per universal SUPREME standard.
         Tom 2026-06-04 *"the longstanding standard for all windows, a close button"*.
         The close emit lets App.vue decide where to navigate (Tasks 8 by default). -->
    <div class="mb-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white shadow-lg flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-bold leading-tight">📋 Evo Step Study-Act</h2>
        <p class="text-xs mt-1 opacity-90">
          Stage 9 · per Tom Gilb's canonical 9-step Evo cycle (Measure + Learn).
          Capture the actual values delivered by an Evo Step, analyse them, decide actions.
        </p>
      </div>
      <CloseDot
        size="lg" variant="on-dark"
        title="Close Study-Act and return to Tasks"
        aria-label="Close Study-Act"
        @click="emit('close')"
      />
    </div>

    <!-- Step picker -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <label for="study-act-step-pick" class="text-xs font-semibold text-slate-600">Evo Step:</label>
      <select
        id="study-act-step-pick"
        v-model="selectedStepTag"
        class="rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        title="Pick the Evo Step you are measuring.  Each step gets its own data-collection record + version history."
      >
        <option v-for="tag in stepTags" :key="tag" :value="tag">{{ tag }}</option>
        <option v-if="stepTags.length === 0" value="" disabled>No Evo Steps yet — generate a plan first</option>
      </select>
      <span
        v-if="currentFeedback"
        class="text-[11px] px-2 py-0.5 rounded-full border"
        :class="currentFeedback.state === 'skipped'
          ? 'border-slate-400 bg-slate-100 text-slate-600'
          : 'border-emerald-300 bg-emerald-50 text-emerald-700'"
      >
        {{ currentFeedback.state === 'skipped' ? 'Skipped' : `${currentFeedback.measures.length} measure(s)` }}
      </span>
    </div>

    <!-- Empty / no-step state -->
    <div
      v-if="!selectedStepTag"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800"
    >
      No Evo Step selected.  Generate an Evo plan first, then return here to capture results.
    </div>

    <template v-else>
      <!-- Tom 2026-06-04 phase-progression bar — much more prominent than the
           original small tab strip.  Three big tiles linked by → arrows.
           Active tile is filled + scaled-up; inactive tiles are outlined but
           still clearly clickable.  Each tile shows phase number + icon +
           short name; the caption row below describes the active phase. -->
      <div class="mb-4">
        <div role="tablist" aria-label="Study-Act phases"
             class="flex items-stretch justify-between gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <template v-for="(p, i) in PHASE_ORDER" :key="p">
            <button type="button" role="tab" :aria-selected="activePhase === p"
              class="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 min-h-[64px] rounded-lg border-2 transition-all"
              :class="activePhase === p
                ? PHASE_META[p].toneActive + ' shadow-md scale-[1.02] cursor-default'
                : PHASE_META[p].tone + ' hover:shadow-sm hover:scale-[1.01]'"
              :title="`Go to ${PHASE_META[p].long} — ${PHASE_META[p].caption}`"
              @click="gotoPhase(p)">
              <span class="text-base leading-none" aria-hidden="true">{{ PHASE_META[p].icon }}</span>
              <span class="text-[10px] uppercase tracking-wider font-bold opacity-90">
                Phase {{ PHASE_META[p].num }}
              </span>
              <span class="text-xs font-semibold leading-tight text-center">
                {{ PHASE_META[p].short }}
              </span>
            </button>
            <div v-if="i < PHASE_ORDER.length - 1"
                 class="flex items-center justify-center text-slate-300 text-xl font-bold select-none"
                 aria-hidden="true">→</div>
          </template>
        </div>
        <p class="mt-2 text-xs text-slate-600">
          <span class="font-semibold">{{ PHASE_META[activePhase].long }}:</span>
          <span class="italic"> {{ PHASE_META[activePhase].caption }}</span>
        </p>
      </div>

      <!-- Per-phase Copy + Email — Tom 2026-06-04 *"as this is a long list with
           many possible people discussing it, copy and email are necessary
           (all 3 phases of 9)"*.  Control pins at TOP per the universal rule.
           Honors Colorful Exports SUPREME rule (Tom 2026-05-26): exports are
           coloured HTML tables with inline styles, not plain text. -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold text-slate-600">
          Share this phase:
        </span>
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-sm"
          :title="`Copy the current ${PHASE_META[activePhase].short} table to clipboard as a coloured HTML table — paste into email / Keynote / Numbers / Slack.`"
          @click="copyPhase(activePhase)">
          <span aria-hidden="true">📋</span> Copy {{ PHASE_META[activePhase].short }}
        </button>
        <button type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-xs font-medium text-indigo-700 shadow-sm"
          :title="`Open Mail.app pre-filled with this ${PHASE_META[activePhase].short} table — for distribution to the team.`"
          @click="emailPhase(activePhase)">
          <span aria-hidden="true">✉️</span> Email {{ PHASE_META[activePhase].short }}
        </button>
        <span v-if="copiedPhase === activePhase"
              class="text-[11px] text-emerald-700 font-semibold">
          ✓ Copied as colored HTML table
        </span>
      </div>

      <!-- ── Skip path (Phase 1 only — Skip controls scope of the data layer) ── -->
      <template v-if="activePhase === 'collect'">
      <div v-if="currentFeedback?.state !== 'skipped'" class="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex-1 min-w-[200px]">
            <p class="text-sm font-semibold text-slate-800">
              Option 1 · No step taken. No feedback. Skip this stage now.
            </p>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Honest skip is fine.  You can come back later and switch to data collection.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="skipReasonDraft"
              type="text" placeholder="Optional reason (e.g. step deferred)"
              class="w-56 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold shadow"
              title="Mark this Evo Step's Study-Act as skipped.  Snapshot saved to version history with timestamp."
              @click="skipStage"
            >
              Skip this stage
            </button>
          </div>
        </div>
      </div>

      <div v-else class="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3">
        <p class="text-sm font-semibold text-slate-800">⏭ This Evo Step's Study-Act was skipped.</p>
        <p v-if="currentFeedback.skipReason" class="text-xs text-slate-600 mt-1 italic">
          “{{ currentFeedback.skipReason }}”
        </p>
        <button
          type="button"
          class="mt-2 px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700"
          @click="unskipStage"
        >
          Resume data collection
        </button>
      </div>

      <!-- ── Collection path (Option 2) ───────────────────────────────────── -->
      <template v-if="currentFeedback?.state !== 'skipped'">
        <div class="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow"
            title="Auto-create a measure row for every Value entry in the current spec.  Idempotent — already-seeded rows are not duplicated.  Resource entries are a v2 wiring path."
            @click="seedMeasuresFromSpec"
          >
            ✨ Seed measures from spec (Value entries)
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-xs font-semibold text-amber-700"
            title="Add a blank measure row you can fill in manually."
            @click="addBlankMeasure"
          >
            + Add blank measure
          </button>
        </div>

        <p
          v-if="!currentFeedback || currentFeedback.measures.length === 0"
          class="text-xs text-slate-500 italic mb-4"
        >
          No measures yet for this Evo Step.  Click "Seed measures from spec" to auto-populate from Value entries,
          or add blank rows manually.  Everything is optional — skip what you don't have.
        </p>

        <!-- Measure cards — flow in the natural page scroll.  Tom 2026-06-03
             reported: inner ScrollContainer with max-h-[60vh] caused the
             group-save bar below to visually overlap a truncated card.  The
             stage view already lives inside the App's main scroll surface,
             so an inner fixed-height scroll is wrong here. -->
        <div>
          <div v-if="currentFeedback" class="space-y-4">
            <div
              v-for="m in currentFeedback.measures"
              :key="m.id"
              class="rounded-xl border border-amber-200 bg-white shadow-sm p-4"
            >
              <!-- Target row -->
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="flex-1 min-w-0">
                  <div class="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
                    {{ m.targetType === 'value' ? 'Value (V)' : 'Resource (R)' }} · {{ m.targetRef }}
                  </div>
                  <input
                    v-model="m.targetDescription"
                    type="text"
                    class="w-full mt-0.5 rounded border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Description of what is being measured"
                  />
                  <input
                    v-model="m.estimateText"
                    type="text"
                    class="w-full mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 italic focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Pre-step estimate / Goal (for comparison)"
                  />
                </div>
                <button
                  type="button"
                  class="shrink-0 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                  title="Remove this measure row"
                  @click="removeMeasure(m.id)"
                >Remove</button>
              </div>

              <!-- Meter usage -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <p class="text-[11px] font-semibold text-slate-700 mb-1">Meter used</p>
                  <label class="flex items-center gap-2 text-xs text-slate-700">
                    <input type="radio" :name="`meter-${m.id}`" :checked="m.meter?.usedDeclaredMeter === true" @change="setMeterUsage(m, true)" />
                    Used declared Meter as-is
                  </label>
                  <label class="flex items-center gap-2 text-xs text-slate-700 mt-1">
                    <input type="radio" :name="`meter-${m.id}`" :checked="m.meter?.usedDeclaredMeter === false" @change="setMeterUsage(m, false)" />
                    Used a deviation
                  </label>
                  <input
                    v-if="m.meter && m.meter.usedDeclaredMeter === false"
                    v-model="m.meter.deviationNote"
                    type="text"
                    class="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. fewer samples, proxy meter, manual count"
                  />
                </div>

                <!-- Measured value + ± range -->
                <div>
                  <p class="text-[11px] font-semibold text-slate-700 mb-1">Measured value · ± range</p>
                  <input
                    v-model="m.measuredValue"
                    type="text"
                    class="w-full rounded border border-amber-300 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. 87%, 4.2 s, $1,200"
                  />
                  <div class="flex items-center gap-1 mt-1">
                    <input
                      v-model="m.rangeLow"
                      type="text"
                      class="w-1/2 rounded border border-slate-300 px-2 py-0.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="low"
                    />
                    <span class="text-slate-400 text-xs">to</span>
                    <input
                      v-model="m.rangeHigh"
                      type="text"
                      class="w-1/2 rounded border border-slate-300 px-2 py-0.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="high"
                    />
                  </div>
                </div>
              </div>

              <!-- Feedback note -->
              <div class="mb-3">
                <label class="text-[11px] font-semibold text-slate-700">Feedback note about this measure</label>
                <textarea
                  v-model="m.feedbackNote"
                  rows="2"
                  class="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="What you observed, surprises, anomalies, context the number alone won't convey…"
                />
              </div>

              <!-- (1) Realism — multi-select -->
              <div class="mb-3">
                <p class="text-[11px] font-semibold text-slate-700 mb-1">
                  ① Realism (tick any that apply)
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="tag in REALISM_TAGS"
                    :key="tag"
                    type="button"
                    class="text-[11px] px-2 py-0.5 rounded-full border transition-colors"
                    :class="m.realism.includes(tag)
                      ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-amber-50 hover:border-amber-300'"
                    :title="`Toggle: ${MEASURE_REALISM_LABEL[tag]}`"
                    @click="toggleRealism(m, tag)"
                  >
                    {{ MEASURE_REALISM_LABEL[tag] }}
                  </button>
                </div>
              </div>

              <!-- (2) Leading / Lagging -->
              <div class="mb-3">
                <p class="text-[11px] font-semibold text-slate-700 mb-1">② Indicator type</p>
                <div class="flex flex-wrap gap-3">
                  <label
                    v-for="opt in INDICATOR_OPTIONS"
                    :key="opt"
                    class="flex items-center gap-1.5 text-xs text-slate-700"
                  >
                    <input
                      type="radio"
                      :name="`indicator-${m.id}`"
                      :checked="m.indicator === opt"
                      @change="setIndicator(m, opt)"
                    />
                    {{ INDICATOR_LABEL[opt] }}
                  </label>
                </div>
              </div>

              <!-- (3) Analyst, (4) Remarks, (5) Problems, (6) Future advice -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-slate-700">③ Responsible Measure Analyst</span>
                  <input
                    v-model="m.analyst" type="text"
                    class="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Name / role / email"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-slate-700">④ Remarks</span>
                  <input
                    v-model="m.remarks" type="text"
                    class="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="General comments, context"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-slate-700">⑤ Problems with the measure</span>
                  <input
                    v-model="m.problems" type="text"
                    class="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Instrument bias, sample size, timing, access issues…"
                  />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold text-slate-700">⑥ Advice on future measures</span>
                  <input
                    v-model="m.futureAdvice" type="text"
                    class="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="What to do differently next time, better meters, frequency…"
                  />
                </label>
              </div>

              <!-- Per-measure save footer — Tom 2026-06-03 *"each measure can
                   be saved, edited immediately"*.  Stamps `savedAt` + appends
                   a per-measure version snapshot.  Distinct from the bottom
                   group-save bar which snapshots all measures together. -->
              <div class="mt-3 pt-3 border-t border-amber-100 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                  title="Save THIS measure only.  Appends a snapshot to this measure's own version history.  Independent of the group Save Version below."
                  @click="saveMeasure(m)"
                >
                  💾 Save this measure
                </button>
                <span v-if="m.savedAt" class="text-[11px] text-emerald-700 font-medium">
                  Saved {{ formatTimestamp(m.savedAt) }}
                  <span v-if="m.versions && m.versions.length > 0" class="text-emerald-600 ml-1">
                    · {{ m.versions.length }} version{{ m.versions.length === 1 ? '' : 's' }}
                  </span>
                </span>
                <span v-else class="text-[11px] text-slate-400 italic">
                  Not yet saved as its own version (edits auto-persist either way).
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Group save bar — Tom 2026-06-03 *"all measures can be saved as a
             group"*.  Distinct from per-measure 💾 inside each card above.
             Stronger visual separation (8 units margin, indigo theme, explicit
             heading) so users don't confuse it with the next measure card. -->
        <div class="mt-8 rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4">
          <h3 class="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-2">
            <span aria-hidden="true">📦</span>
            Save ALL measures as a group version
          </h3>
          <p class="text-[11px] text-indigo-700 mb-3">
            Snapshots every measure on this Evo Step into one named version.  Use this for
            milestone markers ("after Sea Trials r3", "post-mortem v2").  Independent of
            the per-measure 💾 inside each card.
          </p>
          <!-- After-save confirmation pill — Tom 2026-06-03 *"the group
               measure name disappeared after I saved the group"*.  Label is
               no longer auto-cleared; this banner confirms the save instead. -->
          <div
            v-if="lastSavedGroupAt"
            class="mb-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center gap-2"
          >
            <span>✅</span>
            <span>
              Saved as <span class="font-semibold">“{{ lastSavedGroupLabel }}”</span>
              at <span class="font-mono">{{ formatTimestamp(lastSavedGroupAt) }}</span>.
              Label kept below — edit it for the next save, or click again to re-snapshot with the same label.
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="versionLabelDraft"
              type="text"
              class="flex-1 min-w-[200px] rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional label for the group snapshot"
            />
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow"
              title="Append a snapshot of ALL measures on this Evo Step to the group version history.  Snapshots are append-only — older versions stay forever.  The label stays in the input after save so you can re-use or edit it."
              :disabled="!currentFeedback"
              @click="saveVersion"
            >
              📦 Save group version
            </button>
          </div>
        </div>

        <!-- Group version history -->
        <div v-if="currentFeedback && currentFeedback.versions.length > 0" class="mt-4">
          <h3 class="text-xs font-semibold text-slate-700 mb-2">Group past versions ({{ currentFeedback.versions.length }})</h3>
          <ul class="space-y-1 text-xs">
            <li
              v-for="v in [...currentFeedback.versions].reverse()"
              :key="v.id"
              class="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1"
            >
              <span class="font-mono text-slate-600">{{ formatTimestamp(v.at) }}</span>
              <span v-if="v.label" class="text-slate-800 font-medium">· {{ v.label }}</span>
              <span class="ml-auto text-[10px] text-slate-500">
                {{ v.skipped ? 'skipped' : `${v.measures.length} measure(s)` }}
              </span>
            </li>
          </ul>
        </div>
      </template>

      <!-- Phase-1 → Phase-2 walk-forward nav.  Tom 2026-06-04 *"it is not
           clear how I move to study and act stages"*.  Big, obvious button. -->
      <div class="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button v-if="hasNextPhase && nextPhaseRef" type="button"
          class="flex items-center gap-3 px-5 py-3 rounded-xl min-h-[52px] shadow-md text-white font-bold text-sm transition-all hover:shadow-lg active:scale-[0.98]"
          :class="PHASE_META[nextPhaseRef].toneActive.replace('border-', 'shadow-').replace('bg-', 'bg-').replace('text-white', '') + ' bg-purple-600 hover:bg-purple-700'"
          :title="`Continue to ${PHASE_META[nextPhaseRef].long} — ${PHASE_META[nextPhaseRef].caption}`"
          @click="nextPhase">
          <div class="text-right">
            <div class="text-[10px] font-normal opacity-80 uppercase tracking-wide">Next phase</div>
            <div class="leading-tight">{{ PHASE_META[nextPhaseRef].icon }} {{ PHASE_META[nextPhaseRef].short }} →</div>
          </div>
        </button>
      </div>
      </template> <!-- end activePhase === 'collect' -->

      <!-- ════════════════════════════════════════════════════════════════════
           PHASE 2 — ANALYSIS  (Tom 2026-06-03)
           "What does the data MEAN in relation to earlier estimates, and
            long-term target and resources?"  Sharpening-style: penetrating
            question + 3-4 wise pre-seeded answers (multi-select pills) +
            user's own answer + Claudian critique paste-back.
           ════════════════════════════════════════════════════════════════════ -->
      <template v-if="activePhase === 'analyse'">
        <div v-if="currentFeedback?.state === 'skipped'"
             class="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This Evo Step is marked skipped — analysis is not applicable.
          Return to <span class="font-semibold">1 · Data Collection</span> to unskip if you want to analyse.
        </div>

        <template v-else>
          <!-- Claudian critique panel — Conjunction-of-Technologies pattern. -->
          <div class="mb-4 rounded-xl border-2 border-purple-300 bg-purple-50 p-4">
            <h3 class="text-sm font-bold text-purple-900 mb-1 flex items-center gap-2">
              <span>🧠</span> Get a Claudian critique on your analysis
            </h3>
            <p class="text-[11px] text-purple-700 mb-2">
              Copies a prompt with the full Planguage spec + this Evo Step + your measures + your
              answers below.  Claudian will critique each answer + propose alternatives, each with a
              Gilb / Standards / Plan / Internet citation (Conjunction-of-Technologies rule).
            </p>
            <details class="mb-2 text-[11px]">
              <summary class="cursor-pointer text-purple-900 font-semibold hover:underline">
                💡 No API tokens needed — see the 5 free options
              </summary>
              <ol class="list-decimal pl-5 mt-1 space-y-0.5 text-purple-800">
                <li><b>Use only the seeded answers below</b> — zero AI, zero cost.  The 6 questions each have 3-4 Gilb-cited wise answers ready to tick.</li>
                <li><b>Paste the copied prompt into Claude.ai free tier</b> — no setup, no key.  Paste the JSON it returns into the box below.</li>
                <li><b>Paste into ChatGPT / Gemini / Copilot free</b> — model-agnostic prompt works anywhere.</li>
                <li><b>Use your local Claude Code</b> — the canonical Claude-Code-as-AI-Layer pattern.  Costs your existing subscription, not the SEM App.</li>
                <li><b>Skip the critique entirely</b> — type your own answers; the panel is optional.</li>
              </ol>
            </details>
            <div class="flex flex-wrap gap-2 mb-2">
              <button type="button"
                class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow"
                title="Copy a Claudian critique prompt to clipboard — paste into Claudian, then paste the JSON response back into the box below."
                @click="copyAnalysisPrompt">
                📋 Copy Claudian critique prompt
              </button>
            </div>
            <textarea v-model="analysisPasteback" rows="3"
              class="w-full rounded border border-purple-300 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder='Paste Claudian JSON here, then click Apply…'></textarea>
            <div class="mt-2 flex items-center gap-2">
              <button type="button"
                class="px-3 py-1 rounded bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold"
                @click="applyAnalysisPasteback">Apply critiques</button>
              <span v-if="analysisPastebackError" class="text-[11px] text-rose-700">
                {{ analysisPastebackError }}
              </span>
            </div>
          </div>

          <!-- Penetrating-question cards -->
          <div class="space-y-4">
            <div v-for="f in analysisFindings" :key="f.id"
                 class="rounded-xl border border-purple-200 bg-white shadow-sm p-4">
              <p class="text-sm font-semibold text-purple-900 mb-2">❓ {{ f.question }}</p>

              <!-- Wise pre-seeded answer pills -->
              <p class="text-[11px] text-slate-500 mb-1">Wise pre-seeded answers — tick any you accept:</p>
              <div class="space-y-1.5 mb-3">
                <div v-for="(ans, idx) in f.suggestedAnswers" :key="idx"
                     class="flex items-start gap-2">
                  <input type="checkbox" class="mt-1 h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    :checked="f.acceptedSuggestionIdx.includes(idx)"
                    :aria-label="`Accept suggestion ${idx + 1}`"
                    @change="toggleAnalysisSuggestion(f, idx)" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-slate-800 leading-snug">{{ ans }}</p>
                    <div class="mt-0.5">
                      <SourceBadge :provenance="f.suggestedAnswerProvenances?.[idx] ?? { source: 'template' }" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- User's own answer -->
              <label class="block">
                <span class="text-[11px] font-semibold text-slate-700">Your own answer (optional):</span>
                <textarea v-model="f.userAnswer" rows="2"
                  class="w-full mt-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Add nuance, name names, cite numbers — anything the suggestions missed…"></textarea>
              </label>

              <!-- Claudian critiques (populated by paste-back) -->
              <div v-if="f.critiques && f.critiques.length > 0" class="mt-3 space-y-2">
                <p class="text-[11px] font-semibold text-purple-700">🧠 Claudian critique:</p>
                <div v-for="(c, ci) in f.critiques" :key="ci"
                     class="rounded border border-purple-200 bg-purple-50 px-2 py-1.5">
                  <p class="text-xs text-slate-800"><span class="font-semibold">Critique:</span> {{ c.critique }}</p>
                  <p v-if="c.alternative" class="text-xs text-slate-700 mt-1">
                    <span class="font-semibold">Alternative:</span> {{ c.alternative }}
                  </p>
                  <div class="mt-1"><SourceBadge :provenance="c.provenance" /></div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Phase-2 prev/next walk-nav. -->
        <div class="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <button v-if="hasPrevPhase && prevPhaseRef" type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px] border-2 text-xs font-semibold shadow-sm hover:shadow transition-all"
            :class="PHASE_META[prevPhaseRef].tone"
            :title="`Back to ${PHASE_META[prevPhaseRef].long}`"
            @click="prevPhase">
            ← <span class="opacity-75">Previous phase:</span>
            <span>{{ PHASE_META[prevPhaseRef].icon }} {{ PHASE_META[prevPhaseRef].short }}</span>
          </button>
          <span v-else></span>
          <button v-if="hasNextPhase && nextPhaseRef" type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-xl min-h-[52px] shadow-md text-white font-bold text-sm transition-all hover:shadow-lg active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700"
            :title="`Continue to ${PHASE_META[nextPhaseRef].long} — ${PHASE_META[nextPhaseRef].caption}`"
            @click="nextPhase">
            <div class="text-right">
              <div class="text-[10px] font-normal opacity-80 uppercase tracking-wide">Next phase</div>
              <div class="leading-tight">{{ PHASE_META[nextPhaseRef].icon }} {{ PHASE_META[nextPhaseRef].short }} →</div>
            </div>
          </button>
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════════════
           PHASE 3 — ACTIONS  (Tom 2026-06-03)
           "Proposed actions + approved actions."  Sharpening style: pre-
           seeded deterministic proposals + Claudian additions + user-typed
           additions, each with an approve/reject lifecycle.
           ════════════════════════════════════════════════════════════════════ -->
      <template v-if="activePhase === 'act'">
        <div v-if="currentFeedback?.state === 'skipped'"
             class="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This Evo Step is marked skipped — no actions to propose yet.
        </div>

        <template v-else>
          <!-- Claudian action-proposer panel -->
          <div class="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <h3 class="text-sm font-bold text-emerald-900 mb-1 flex items-center gap-2">
              <span>🪄</span> Get Claudian to propose more actions
            </h3>
            <p class="text-[11px] text-emerald-700 mb-2">
              Copies a prompt with the full plan + Evo Step + measures + your Analysis answers.
              Claudian returns 4-8 concrete actions with Gilb-cited rationales.  You then approve /
              reject / edit each — sharpening-style.
            </p>
            <details class="mb-2 text-[11px]">
              <summary class="cursor-pointer text-emerald-900 font-semibold hover:underline">
                💡 No API tokens needed — see the 5 free options
              </summary>
              <ol class="list-decimal pl-5 mt-1 space-y-0.5 text-emerald-800">
                <li><b>Use only the seeded actions above</b> — 5 deterministic proposed actions with Gilb citations are already there.  Approve, reject, edit, done.</li>
                <li><b>Paste the prompt into Claude.ai free tier</b> — no setup, no key.</li>
                <li><b>Paste into ChatGPT / Gemini / Copilot free</b> — model-agnostic.</li>
                <li><b>Use your local Claude Code</b> — Claude-Code-as-AI-Layer pattern; costs your existing subscription.</li>
                <li><b>Skip Claudian entirely</b> — type your own actions in the "+ Add" row above; lifecycle still works.</li>
              </ol>
            </details>
            <div class="flex flex-wrap gap-2 mb-2">
              <button type="button"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow"
                @click="copyActionsPrompt">
                📋 Copy Claudian actions prompt
              </button>
            </div>
            <textarea v-model="actionsPasteback" rows="3"
              class="w-full rounded border border-emerald-300 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder='Paste Claudian JSON array here, then click Apply…'></textarea>
            <div class="mt-2 flex items-center gap-2">
              <button type="button"
                class="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                @click="applyActionsPasteback">Apply actions</button>
              <span v-if="actionsPastebackError" class="text-[11px] text-rose-700">
                {{ actionsPastebackError }}
              </span>
            </div>
          </div>

          <!-- User-add row -->
          <div class="mb-4 flex items-center gap-2">
            <input v-model="newActionDraft" type="text"
              class="flex-1 rounded border border-emerald-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Add your own proposed action…"
              @keydown.enter.prevent="addUserAction" />
            <button type="button"
              class="px-3 py-1.5 rounded bg-white border border-emerald-300 hover:bg-emerald-50 text-xs font-semibold text-emerald-700"
              @click="addUserAction">+ Add</button>
          </div>

          <!-- Action list -->
          <div class="space-y-3">
            <div v-for="a in actionItems" :key="a.id"
                 class="rounded-lg border border-emerald-200 bg-white shadow-sm p-3">
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <textarea v-model="a.description" rows="1"
                    class="w-full rounded border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
                </div>
                <span class="text-[11px] px-2 py-0.5 rounded-full border shrink-0 self-start"
                      :class="ACTION_STATUS_TONE[a.status]">
                  {{ ACTION_STATUS_LABEL[a.status] }}
                </span>
              </div>
              <textarea v-if="a.rationale !== undefined" v-model="a.rationale" rows="1"
                class="w-full mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs italic focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Rationale (optional)"></textarea>
              <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] text-slate-500">Owner</span>
                  <input v-model="a.owner" type="text"
                    class="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Name / role" />
                </label>
                <label class="flex flex-col gap-0.5">
                  <span class="text-[11px] text-slate-500">Due</span>
                  <input v-model="a.dueDate" type="date"
                    class="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <SourceBadge v-if="a.provenance" :provenance="a.provenance" />
                <span class="text-[10px] text-slate-400">Created {{ formatTimestamp(a.createdAt) }}</span>
                <div class="ml-auto flex gap-1">
                  <button v-for="s in ACTION_STATUSES" :key="s"
                    type="button"
                    class="text-[11px] px-2 py-0.5 rounded border transition-colors"
                    :class="a.status === s ? ACTION_STATUS_TONE[s] + ' font-semibold' : 'border-slate-300 text-slate-600 hover:bg-slate-50'"
                    :title="`Set status: ${ACTION_STATUS_LABEL[s]}`"
                    @click="setActionStatus(a, s)">
                    {{ ACTION_STATUS_LABEL[s] }}
                  </button>
                  <button type="button"
                    class="text-[11px] px-2 py-0.5 rounded border border-rose-300 text-rose-600 hover:bg-rose-50"
                    @click="removeAction(a.id)">Remove</button>
                </div>
              </div>
            </div>
          </div>

          <p v-if="actionItems.length === 0" class="text-xs text-slate-500 italic mt-3">
            No actions yet.  Add one above or click "Copy Claudian actions prompt" to get suggestions.
          </p>
        </template>

        <!-- Phase-3 prev-only walk-nav (last phase — no next). -->
        <div class="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <button v-if="hasPrevPhase && prevPhaseRef" type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px] border-2 text-xs font-semibold shadow-sm hover:shadow transition-all"
            :class="PHASE_META[prevPhaseRef].tone"
            :title="`Back to ${PHASE_META[prevPhaseRef].long}`"
            @click="prevPhase">
            ← <span class="opacity-75">Previous phase:</span>
            <span>{{ PHASE_META[prevPhaseRef].icon }} {{ PHASE_META[prevPhaseRef].short }}</span>
          </button>
          <span class="text-[11px] text-emerald-700 italic">
            ✅ End of Study-Act for this Evo Step.  Use the stage bar above to move to Resources (10) or back to a different Evo Step.
          </span>
        </div>
      </template>
    </template>
  </section>
</template>
