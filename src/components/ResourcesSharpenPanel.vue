<!-- ResourcesSharpenPanel.vue — Stage 10 / Resources sharpening guided panel.
     Tom Gilb 2026-06-04: Phase 0 of the Resources stage beef-up.
     Shows the 9 sharpening dimensions (Calendar Time / Work Hours /
     Specialists / Tech Debt / Future Maintenance / Decommissioning / ROI /
     Efficiency / Tradeoffs), each with guided questions + worked examples
     + Gilb citation per the Conjunction-of-Technologies SUPREME rule.

     Composes WITH:
       • SingleSurface (registerExclusiveSurface) — modal-style overlay.
       • CloseDot rule — close affordance at top-right.
       • ScrollContainer rule — all overflow-y-auto wrapped.
       • DD-009 Interaction Disclosure — every multi-mode element has a title.
       • Conjunction-of-Technologies — each dimension card shows the Gilb cite.

     This v1 is a GUIDE only — does NOT yet write R. entries to the SpecBlock.
     Schema change (REntry type, resources?: REntry[] on SpecBlock) is Phase 1,
     pending Tom's OK. The Claudian-path analysis prompt is exported alongside
     so Tom can already drive an analysis manually via Claudian. -->

<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref, computed, watch, onMounted } from 'vue'
import CloseDot from './CloseDot.vue'
import PlanIdentityBand from './PlanIdentityBand.vue'  // r41 v96 (Tom Gilb 2026-06-16 "do that" — Phase 3 sweep)
import ScrollContainer from './ScrollContainer.vue'
import JustificationGlyph from './icons/JustificationGlyph.vue'
import { RESOURCES_SHARPEN_DIMENSIONS, RESOURCES_ADVANCED_TOOLS, RESOURCES_ANALYSIS_PROMPT } from '../data/resourcesSharpenDimensions'
import type { ResourcesSharpenDimension } from '../data/resourcesSharpenDimensions'
import type { SpecBlock } from '../types/spec'
import { rBudget, rBudgetLabel } from '../types/spec'
import { useToast } from '../composables/useToast'
import {
  exportArtefact,
  exportCopy,
  exportEmail,
  exportDownload,
  htmlEsc,
  softWrap,
  htmlDocumentShell,
  sectionHeaderHtml,
} from '../composables/useExportShared'
import {
  parseResourcesAnalysis,
  applyApprovedToSpec,
  SOURCE_LAYER_LABELS,
  SOURCE_LAYER_TONES,
  type ResourcesAnalysisOutput,
  type AnalyticalFinding,
  type REntryProposal,
  type SEntryProposal,
  type CEntryProposal,
  type ApprovalSet,
} from '../composables/useResourcesAnalysisParser'
import { useResourcesSharpAnswers, type SelectionMode } from '../composables/useResourcesSharpAnswers'
import {
  usePlanScopeFramework,
  BUDGET_TYPES,
  type BudgetType,
} from '../composables/usePlanScopeFramework'  // v503
import ResourceEstimationCard from './ResourceEstimationCard.vue'  // v504

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
  planId?: string
  capturedCalendarCosts?: Record<string, number>
  capturedCapitalCosts?:  Record<string, number>
  capturedVCRatios?:      Record<string, number>
  /** r41 v96 — identity band fields (Phase 3 sweep). */
  planName?: string
  planOwner?: string
  planVersion?: string
  generatedAt?: string
}>()

const emit = defineEmits<{
  close: []
  /** Phase 2 (r88): emitted when user approves findings and clicks "Apply".
   *  Payload is the updated SpecBlock; parent merges into `currentSpec.value`. */
  'apply-analysis': [updatedSpec: SpecBlock]
  /** r41 v96 — bubble history selection. */
  'select-history': [versionId: string]
  /** v509 — bubble Resources Agent open request from ResourceEstimationCard. */
  'open-resources-agent': []
}>()

const { showToast } = useToast()

// ─── Resources sharp answers composable ──────────────────────────────────────
const planIdRef = computed(() => props.planId ?? props.spec?.name ?? 'default')
const {
  getAnswer,
  setTypedAnswer,
  toggleTicked,
  setMode,
  isTicked,
  getEffectiveAnswer,
  answeredInCategory,
  setPlannerBecause,
  setPlannerSources,
  setSuggBecause,
  setSuggSources,
} = useResourcesSharpAnswers(planIdRef)

// ─── v503 (2026-07-21) — Plan Scope Framework via shared composable ─────────
// State + persistence + human-readable helpers extracted to
// `usePlanScopeFramework.ts` so ANY overview surface (Stage 1, Plan Crest,
// dashboards) can consume the same reactive state per planId.  Source
// attribution per section added at composable level.
const {
  state: scopeFramework,
  isDeadlineDetermined,
  isStartEventsDetermined,
  isBudgetDetermined,
  projectStartEventCount,
  budgetTypeCount,
} = usePlanScopeFramework(planIdRef)
// Suppress unused warnings — these are exposed for the template
void isDeadlineDetermined
void isStartEventsDetermined
void isBudgetDetermined

// v503 — legacy inline state (v501/v502) fully replaced by usePlanScopeFramework
// composable above.  Only the template mutation helper remains local:
function toggleBudgetType(t: BudgetType): void {
  if (t in scopeFramework.value.budgetAmounts) {
    delete scopeFramework.value.budgetAmounts[t]
  } else {
    scopeFramework.value.budgetAmounts[t] = 0
  }
}

// v524 (2026-07-21) — Tom Gilb: *"they say source undetermined, but the source
// was me here now"*.  After v523 fixed the cross-surface data flow, source
// pills still showed "SOURCE: UNDETERMINED" even when Tom explicitly typed
// values in this panel.  v-model on the primitive fields never touched the
// `sourceDeadline` / `sourceStartEvents` / `sourceBudget` objects.  Fix: three
// deep watchers that stamp the corresponding source as `'planner'` AFTER the
// initial mount (so hydration from storage doesn't false-stamp).  Each watcher
// tracks a shallow snapshot of the fields in its section — mutations by the
// user (via v-model) trigger the watcher; the composable's own auto-load path
// doesn't (because we gate on _initialLoadComplete).
let _initialLoadComplete = false
onMounted(() => {
  // Push the flag flip to the next microtask so the first watcher-callback
  // triggered by mount-time settled state doesn't false-stamp.
  Promise.resolve().then(() => { _initialLoadComplete = true })
})
function _stampSource(section: 'deadline' | 'startEvents' | 'budget'): void {
  if (!_initialLoadComplete) return
  const now = new Date().toISOString()
  const src = { kind: 'planner' as const, at: now, note: '' }
  if (section === 'deadline')    scopeFramework.value.sourceDeadline = src
  if (section === 'startEvents') scopeFramework.value.sourceStartEvents = src
  if (section === 'budget')      scopeFramework.value.sourceBudget = src
}
// Deadline section
watch(
  () => [
    scopeFramework.value.deadlineMode,
    scopeFramework.value.deadlineDate,
    scopeFramework.value.deadlineFromStartValue,
    scopeFramework.value.deadlineFromStartUnit,
  ],
  () => _stampSource('deadline'),
  { deep: false },
)
// Project-start events section
watch(
  () => [
    scopeFramework.value.startPlanningStarted,
    scopeFramework.value.startContractSigned,
    scopeFramework.value.startBudgetApproved,
    scopeFramework.value.startPlanApproved,
    scopeFramework.value.startStaffReady,
    scopeFramework.value.startFirstEvoStepsStarted,
    scopeFramework.value.startCustomEventChecked,
    scopeFramework.value.startCustomEventLabel,
  ],
  () => _stampSource('startEvents'),
  { deep: false },
)
// Budget section
watch(
  () => [
    scopeFramework.value.hasBudget,
    JSON.stringify(scopeFramework.value.budgetAmounts),
  ],
  () => _stampSource('budget'),
  { deep: false },
)
// Selection mode pills — same UX as EvoSharpInterview.
const SELECTION_MODES: Array<{ id: SelectionMode; label: string; title: string }> = [
  { id: 'mixed',       label: 'Mixed',         title: 'Use your typed answer + any ticked suggestions (default)' },
  { id: 'all',         label: 'All',            title: 'Use your typed answer + ALL suggestions regardless of ticks' },
  { id: 'typed-only',  label: 'My answer only', title: 'Use only your typed answer; ignore all suggestions' },
  { id: 'ticked-only', label: 'Ticked only',    title: 'Use only the suggestions you have ticked; ignore your typed answer' },
]

// ─── JustificationGlyph open/close state ─────────────────────────────────────
// Keys: `q:${dim.id}:${qi}` for questions, `s:${dim.id}:${qi}:${si}` for suggestions
const openJustifications = ref<Set<string>>(new Set())

function justKey(dimId: string, qi: number): string {
  return `q:${dimId}:${qi}`
}
function suggJustKey(dimId: string, qi: number, si: number): string {
  return `s:${dimId}:${qi}:${si}`
}
function isJustOpen(key: string): boolean {
  return openJustifications.value.has(key)
}
function toggleJust(key: string): void {
  const next = new Set(openJustifications.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openJustifications.value = next
}

// ─── Change Review panel state ────────────────────────────────────────────────

/** A proposed change derived from the sharpening interview answers. */
interface ResourcesProposedChange {
  key: string
  dimId: string
  dimLabel: string
  qi: number
  questionText: string
  effectiveText: string
  approved: boolean
  // v526 — universal Source + Timestamp + Basis attribution (Tom Gilb
  // 2026-07-21: "all resource stipulations and all estimates the source and
  // timestamp, and basis were to be noted and kept").
  source?: string        // 'planner' | 'ai' | 'contract' | 'imported' | 'external' | undefined
  savedAt?: string       // ISO
  basisBecause?: string  // planner's "Because" note (why they wrote this)
  basisSources?: string  // planner's "Sources" note (what they referenced)
}

/** A saved snapshot version of the sharpening session. */
interface ResourcesSharpeningVersion {
  id: string
  label: string
  savedAt: string
  changes: ResourcesProposedChange[]
  status: 'draft' | 'integrated'
}

const showChangeReview = ref(false)
const changeReviewTab = ref<'review' | 'history' | 'compare'>('review')
const versions = ref<ResourcesSharpeningVersion[]>([])
const compareVersionA = ref<string | null>(null)  // null = live session
const compareVersionB = ref<string | null>(null)   // null = live session

function versionStorageKey(): string {
  return `resources-sharp-versions:${planIdRef.value}`
}
function loadVersions(): void {
  try {
    const raw = localStorage.getItem(versionStorageKey())
    if (!raw) { versions.value = []; return }
    versions.value = JSON.parse(raw) as ResourcesSharpeningVersion[]
  } catch {
    versions.value = []
  }
}
function saveVersionsToStorage(): void {
  try {
    localStorage.setItem(versionStorageKey(), JSON.stringify(versions.value))
  } catch { /* quota or private mode */ }
}

// Load versions on mount (reactive to planId via computed).
loadVersions()

/** Collects all non-empty effective answers across all dimensions into a change list. */
const displayedChanges = computed<ResourcesProposedChange[]>(() => {
  const changes: ResourcesProposedChange[] = []
  for (const dim of RESOURCES_SHARPEN_DIMENSIONS) {
    for (let qi = 0; qi < dim.questions.length; qi++) {
      const effectiveText = getEffectiveAnswer(dim.id, String(qi), dim.suggestedAnswers?.[qi] ?? [])
      if (effectiveText.trim().length === 0) continue
      // v526 — pull attribution + basis from the raw QuestionAnswer.
      const raw = getAnswer(dim.id, String(qi))
      changes.push({
        key: `${dim.id}:${qi}`,
        dimId: dim.id,
        dimLabel: dim.label,
        qi,
        questionText: dim.questions[qi],
        effectiveText,
        approved: false,
        source:       raw.source,
        savedAt:      raw.savedAt,
        basisBecause: raw.because,
        basisSources: raw.sources,
      })
    }
  }
  return changes
})

/** Two-column diff slots for the Compare tab. */
interface CompareSlot {
  key: string
  dimLabel: string
  questionText: string
  left: string
  right: string
}
const compareSlots = computed<CompareSlot[]>(() => {
  const getVersionChanges = (versionId: string | null): Map<string, string> => {
    if (versionId === null) {
      // Live session
      const map = new Map<string, string>()
      for (const c of displayedChanges.value) map.set(c.key, c.effectiveText)
      return map
    }
    const ver = versions.value.find(v => v.id === versionId)
    if (!ver) return new Map()
    const map = new Map<string, string>()
    for (const c of ver.changes) map.set(c.key, c.effectiveText)
    return map
  }

  const leftMap = getVersionChanges(compareVersionA.value)
  const rightMap = getVersionChanges(compareVersionB.value)
  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()])

  const slots: CompareSlot[] = []
  for (const key of allKeys) {
    const [dimId, qiStr] = key.split(':')
    const dim = RESOURCES_SHARPEN_DIMENSIONS.find(d => d.id === dimId)
    const qi = Number(qiStr)
    slots.push({
      key,
      dimLabel: dim?.label ?? dimId,
      questionText: dim?.questions?.[qi] ?? key,
      left: leftMap.get(key) ?? '(not present)',
      right: rightMap.get(key) ?? '(not present)',
    })
  }
  return slots
})

function openChangeReview(): void {
  loadVersions()
  showChangeReview.value = true
  changeReviewTab.value = 'review'
}

function saveVersion(): void {
  const id = `v-${Date.now()}`
  const label = `Draft ${new Date().toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}`
  const newVersion: ResourcesSharpeningVersion = {
    id,
    label,
    savedAt: new Date().toISOString(),
    changes: displayedChanges.value.map(c => ({ ...c })),
    status: 'draft',
  }
  versions.value.push(newVersion)
  saveVersionsToStorage()
  showToast(`Saved as "${label}" — ${displayedChanges.value.length} changes`, 4000)
}

function integrateVersion(): void {
  // Mark all draft versions as integrated, emit changes if needed.
  for (const v of versions.value) {
    if (v.status === 'draft') v.status = 'integrated'
  }
  saveVersionsToStorage()
  showToast('Integrated into plan — all draft versions marked as integrated', 4000)
  showChangeReview.value = false
}

function renameVersion(id: string, newLabel: string): void {
  const v = versions.value.find(v => v.id === id)
  if (v) { v.label = newLabel; saveVersionsToStorage() }
}

function deleteVersion(id: string): void {
  versions.value = versions.value.filter(v => v.id !== id)
  saveVersionsToStorage()
  showToast('Version deleted', 2500)
}

/** Builds colourful HTML (emerald/teal, flat-table) for the change review export.
 *  @param approved If true, only "approved" changes; if false, all changes. */
function buildChangesHtml(approved: boolean): string {
  const changes = approved
    ? displayedChanges.value.filter(c => c.approved)
    : displayedChanges.value

  // Group by dimension
  const byDim = new Map<string, { label: string; items: ResourcesProposedChange[] }>()
  for (const c of changes) {
    if (!byDim.has(c.dimId)) byDim.set(c.dimId, { label: c.dimLabel, items: [] })
    byDim.get(c.dimId)!.items.push(c)
  }

  let body = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#0f766e" style="background:#0f766e;color:#ffffff;padding:8px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">Resources Sharpening · Change Review</td></tr>
  <tr><td bgcolor="#14b8a6" style="background:#14b8a6;color:#ccfbf1;padding:4px 22px 10px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">${changes.length} changes · ${new Date().toLocaleDateString('en-AU')}</td></tr>
</table>`

  for (const [, { label, items }] of byDim) {
    body += sectionHeaderHtml(label, '#0f766e')
    for (const item of items) {
      const qLines = softWrap(item.questionText, 70)
      const qRows = qLines.map((line, i) =>
        `<tr><td bgcolor="#f0fdfa" style="background:#f0fdfa;color:#134e4a;border-left:3px solid #14b8a6;padding:${i === 0 ? '4' : '1'}px 14px;font:${i === 0 ? '600' : '400'} 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(line)}</td></tr>`
      ).join('')
      const ansLines = softWrap(item.effectiveText, 80)
      const ansRows = ansLines.map((line, i) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#1f2937;border-left:3px solid #14b8a6;padding:${i === 0 ? '6' : '2'}px 14px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(line)}</td></tr>`
      ).join('')
      body += `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border:1px solid #99f6e4;">${qRows}${ansRows}</table>`
    }
  }

  return htmlDocumentShell({ title: 'Resources Sharpening · Change Review', bodyHtml: body })
}

// ─── Three-button export handlers ─────────────────────────────────────────────

async function onExportCopy(): Promise<void> {
  const ok = await exportCopy(
    _renderResourcesSharpenHtml(),
    _renderResourcesSharpenPlainText(),
  )
  showToast(ok ? '[*]=[*] Colourful HTML copied to clipboard — ⌘V to paste' : 'Copy failed — try again', 4000)
}

async function onExportEmail(): Promise<void> {
  await exportEmail(
    _renderResourcesSharpenHtml(),
    `Resources Sharpen · ${new Date().toLocaleDateString('en-AU')}`,
    'Resources Sharpen colourful HTML',
    'Tom@Gilb.com',
    _renderResourcesSharpenPlainText(),
  )
}

function onExportDownload(): void {
  exportDownload(
    _renderResourcesSharpenHtml(),
    `resources-sharpen-${new Date().toISOString().slice(0, 10)}`,
  )
  showToast('*→[*] Downloading Resources Sharpen HTML', 3000)
}

/** Counts answered questions for one dimension (memoised via helper to avoid
 *  repeated inline expression in template). */
function dimAnsweredCount(dim: ResourcesSharpenDimension): number {
  return answeredInCategory(
    dim.id,
    dim.questions.map((_, qi) => ({ id: String(qi), suggestedAnswers: dim.suggestedAnswers?.[qi] })),
  )
}

// Progress counters for the header subtitle.
const totalQuestionsCount = computed(() =>
  RESOURCES_SHARPEN_DIMENSIONS.reduce((s, d) => s + d.questions.length, 0),
)
const totalAnsweredCount = computed(() =>
  RESOURCES_SHARPEN_DIMENSIONS.reduce((s, dim) => s + dimAnsweredCount(dim), 0),
)

// Which dimension card is expanded (single-expand for focus).
const expandedId = ref<string | null>(RESOURCES_SHARPEN_DIMENSIONS[0]?.id ?? null)
const expandedToolId = ref<string | null>(null)

function toggle(id: string): void {
  expandedId.value = expandedId.value === id ? null : id
}
function toggleTool(id: string): void {
  expandedToolId.value = expandedToolId.value === id ? null : id
}

// ─── Phase 2 (r88): Apply Claudian Analysis ──────────────────────────────────
// Paste-back textarea → parse → staged findings → tick-to-approve → emit
// updated SpecBlock to parent.  Per Claude-Code-as-AI-Layer SUPREME rule,
// SEM never calls an external AI; the AI work happens in Claudian (local
// terminal) and the user round-trips the JSON manually.

const pastedAnalysisText = ref('')
const parsedAnalysis     = ref<ResourcesAnalysisOutput | null>(null)
const parseErrors        = ref<string[]>([])
const parseWarnings      = ref<string[]>([])

/** Set of stage-keys that are TICKED to approve.  Key format depends on type:
 *    `findingApprovalKey()` for analytical findings
 *    `proposalApprovalKey()` for generative tool proposals
 *  Removing a key = un-tick. */
const approvedKeys = ref<Set<string>>(new Set())

function parsePastedAnalysis(): void {
  const result = parseResourcesAnalysis(pastedAnalysisText.value)
  parsedAnalysis.value = result.data ?? null
  parseErrors.value    = result.errors
  parseWarnings.value  = result.warnings
  // Don't auto-tick anything — user must explicitly approve.
  approvedKeys.value = new Set()
  if (result.ok) {
    const aCount = Object.values(result.data?.partA ?? {}).reduce((s, arr) => s + arr.length, 0)
    const bCount = Object.values(result.data?.partB ?? {}).reduce((s, tool) => {
      return s + (tool.proposedREntries?.length ?? 0)
               + (tool.proposedSEntries?.length ?? 0)
               + (tool.proposedCEntries?.length ?? 0)
               + (tool.proposedFieldEdits?.length ?? 0)
    }, 0)
    showToast(`Parsed ${aCount} analytical findings + ${bCount} generative proposals — tick to approve`, 5000)
  } else {
    showToast(`Parse failed — ${result.errors.length} errors; fix the Planguage Representation and try again`, 6000)
  }
}

function findingApprovalKey(dimensionId: string, idx: number): string {
  return `A:${dimensionId}:${idx}`
}
function proposalApprovalKey(toolId: string, kind: 'R'|'S'|'C'|'F', idx: number): string {
  return `B:${toolId}:${kind}:${idx}`
}
function toggleApproval(key: string): void {
  const next = new Set(approvedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  approvedKeys.value = next
}

const approvalCount = computed(() => approvedKeys.value.size)

/** Walk the parsed analysis + the approvedKeys set and build the ApprovalSet
 *  shape the apply-handler consumes. */
function buildApprovalSet(): ApprovalSet {
  const out: ApprovalSet = { rEntries: [], sEntries: [], cEntries: [], fieldEdits: [] }
  if (!parsedAnalysis.value) return out
  // Part A — each finding may have a proposedREntry that gets approved if the
  // FINDING is ticked (the tradeoff field is informational only — applies on its own row).
  for (const [dimId, findings] of Object.entries(parsedAnalysis.value.partA ?? {})) {
    findings.forEach((f, i) => {
      if (!approvedKeys.value.has(findingApprovalKey(dimId, i))) return
      if (f.proposedREntry) out.rEntries.push(f.proposedREntry)
    })
  }
  // Part B — per tool, walk proposal arrays and include only the ticked.
  for (const [toolId, tool] of Object.entries(parsedAnalysis.value.partB ?? {})) {
    ;(tool.proposedREntries ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'R', i))) out.rEntries.push(p)
    })
    ;(tool.proposedSEntries ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'S', i))) out.sEntries.push(p)
    })
    ;(tool.proposedCEntries ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'C', i))) out.cEntries.push(p)
    })
    ;(tool.proposedFieldEdits ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'F', i))) {
        out.fieldEdits.push({ entryId: p.entryId, field: p.field, proposedValue: p.proposedValue })
      }
    })
  }
  return out
}

function applyApproved(): void {
  if (!props.spec) {
    showToast('No Spec loaded — nothing to write findings into', 4000)
    return
  }
  if (approvalCount.value === 0) {
    showToast('Tick at least one finding before applying', 3500)
    return
  }
  const approvals = buildApprovalSet()
  const updatedSpec = applyApprovedToSpec(props.spec, approvals)
  emit('apply-analysis', updatedSpec)
  const summary = [
    approvals.rEntries.length   ? `${approvals.rEntries.length} R.` : null,
    approvals.sEntries.length   ? `${approvals.sEntries.length} S.` : null,
    approvals.cEntries.length   ? `${approvals.cEntries.length} C.` : null,
    approvals.fieldEdits.length ? `${approvals.fieldEdits.length} field edit${approvals.fieldEdits.length !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' + ')
  showToast(`✓ Applied ${summary} — spec updated`, 5500)
  // Reset staging so the user can paste a fresh analysis if they want another round.
  approvedKeys.value = new Set()
}

// Cost-data summary panels — derived from prior-stage captured data.
const totalCalendarCost = computed(() =>
  Object.values(props.capturedCalendarCosts ?? {}).reduce((sum, v) => sum + (v || 0), 0)
)
const totalCapitalCost = computed(() =>
  Object.values(props.capturedCapitalCosts ?? {}).reduce((sum, v) => sum + (v || 0), 0)
)
const topVCRatios = computed(() => {
  const entries = Object.entries(props.capturedVCRatios ?? {})
  return entries.sort((a, b) => b[1] - a[1]).slice(0, 5)
})

// Copy the Claudian analysis prompt + spec to clipboard for the AI-assist path.
async function copyAnalysisRequest(): Promise<void> {
  const payload = [
    RESOURCES_ANALYSIS_PROMPT,
    '',
    'INPUT_SPEC_JSON:',
    JSON.stringify(props.spec ?? {}, null, 2),
    '',
    'CAPTURED_COSTS:',
    JSON.stringify({
      calendarCosts: props.capturedCalendarCosts ?? {},
      capitalCosts:  props.capturedCapitalCosts  ?? {},
      vcRatios:      props.capturedVCRatios      ?? {},
    }, null, 2),
  ].join('\n')

  try {
    await navigator.clipboard.writeText(payload)
    showToast('📋 Resources analysis prompt + spec copied — paste into Claudian to run analysis', 6000)
  } catch (err) {
    showToast('Copy blocked — see Console', 5000)
    console.error('[ResourcesSharpenPanel] clipboard copy failed', err)
  }
}

// ── Export · Full Model — Tom Gilb 2026-06-06 universal Export rule ──────────

function _renderResourcesSharpenHtml(): string {
  const resources = props.spec?.resources ?? []
  const headerHtml = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#0f766e" style="background:#0f766e;color:#ffffff;padding:8px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">Resources Sharpen · 9 Gilb Dimensions</td></tr>
  <tr><td bgcolor="#14b8a6" style="background:#14b8a6;color:#ccfbf1;padding:4px 22px 10px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">${resources.length} Resource entries · ${approvalCount.value} approved improvements</td></tr>
</table>`

  // Resource entries
  let rRows = ''
  for (const r of resources) {
    const descLines = softWrap(r.description || r.id, 60)
    const descRowsHtml = descLines.map((line, i) =>
      `<tr><td bgcolor="#ccfbf1" style="background:#ccfbf1;color:#134e4a;padding:${i === 0 ? '4' : '1'}px 18px;font:${i === 0 ? '700' : '400'} 12px/1.5 'Helvetica Neue',Arial,sans-serif;">${i === 0 ? `<b>${htmlEsc(r.id)}</b> · ` : ''}${htmlEsc(line)}</td></tr>`
    ).join('')
    rRows += `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border:1px solid #99f6e4;">
  ${descRowsHtml}
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 6px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;"><b>Scale:</b> ${htmlEsc(r.scale || '—')} · <b>Tolerable >>:</b> ${htmlEsc(r.tolerable || '—')} · <b>${htmlEsc(rBudgetLabel(r))}:</b> ${htmlEsc(rBudget(r) || '—')} · <b>Wish >?:</b> ${htmlEsc(r.wish || '—')}</td></tr>
</table>`
  }

  // 9 Gilb Dimensions list — include effective answers when present
  const dimsHtml = RESOURCES_SHARPEN_DIMENSIONS.map((d: ResourcesSharpenDimension) => {
    const summaryLines = softWrap(d.summary || '', 64)
    const summaryRowsHtml = summaryLines.map((line, i) =>
      `<tr><td bgcolor="#f0fdfa" style="background:#f0fdfa;color:#134e4a;padding:${i === 0 ? '3' : '1'}px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(line)}</td></tr>`
    ).join('')
    // Include planner answers per question
    let answersHtml = ''
    for (let qi = 0; qi < d.questions.length; qi++) {
      const eff = getEffectiveAnswer(d.id, String(qi), d.suggestedAnswers?.[qi] ?? [])
      if (!eff.trim()) continue
      const qLines = softWrap(d.questions[qi], 60)
      const qHtml = qLines.map((line, i) =>
        `<tr><td bgcolor="#ecfdf5" style="background:#ecfdf5;color:#065f46;border-left:3px solid #10b981;padding:${i === 0 ? '3' : '1'}px 14px;font:${i === 0 ? '600' : '400'} 10px/1.4 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(line)}</td></tr>`
      ).join('')
      const aLines = softWrap(eff, 70)
      const aHtml = aLines.map((line, i) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#1f2937;border-left:3px solid #10b981;padding:${i === 0 ? '3' : '1'}px 14px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(line)}</td></tr>`
      ).join('')
      answersHtml += qHtml + aHtml
    }
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border:1px solid #99f6e4;">
  <tr><td bgcolor="#0f766e" style="background:#0f766e;color:#ffffff;padding:4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${htmlEsc(d.label)}</td></tr>
  ${summaryRowsHtml}
  ${answersHtml}
</table>`
  }).join('')

  return htmlDocumentShell({
    title: 'Resources Sharpen',
    bodyHtml: headerHtml +
      sectionHeaderHtml(`RESOURCE ENTRIES · ${resources.length}`, '#0f766e') + rRows +
      sectionHeaderHtml(`9 GILB SHARPENING DIMENSIONS`, '#14b8a6') + dimsHtml,
  })
}

function _renderResourcesSharpenPlainText(): string {
  const resources = props.spec?.resources ?? []
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push('Resources Sharpen · 9 Gilb Dimensions')
  lines.push(`${resources.length} Resource entries · ${approvalCount.value} approved improvements`)
  lines.push(HR)
  lines.push('')
  lines.push('RESOURCE ENTRIES')
  lines.push(SR)
  for (const r of resources) {
    lines.push(`${r.id}: ${r.description}`)
    lines.push(`  Scale: ${r.scale || '—'}`)
    lines.push(`  Tolerable >>: ${r.tolerable || '—'}   ${rBudgetLabel(r)}: ${rBudget(r) || '—'}   Wish >?: ${r.wish || '—'}`)
    lines.push('')
  }
  lines.push('9 GILB SHARPENING DIMENSIONS')
  lines.push(SR)
  for (const d of RESOURCES_SHARPEN_DIMENSIONS) {
    lines.push(`${d.label}`)
    lines.push(`  ${d.summary}`)
    for (let qi = 0; qi < d.questions.length; qi++) {
      const eff = getEffectiveAnswer(d.id, String(qi), d.suggestedAnswers?.[qi] ?? [])
      if (eff.trim()) {
        lines.push(`  Q: ${d.questions[qi]}`)
        lines.push(`  A: ${eff.trim()}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}

async function exportResourcesSharpen(): Promise<void> {
  await exportArtefact({
    htmlText:     _renderResourcesSharpenHtml(),
    plainText:    _renderResourcesSharpenPlainText(),
    subject:      `Resources Sharpen · ${new Date().toLocaleDateString('en-AU')}`,
    artefactName: 'Resources Sharpen',
    // Mailto-No-Self-To SUPREME (Tom Gilb 2026-06-16 verbatim "EMAIL SHARPENING
    // YOU PUT THE MAIN IN THE TO SECTION, SILLY BOY"): Tom is the SENDER on a
    // SEM-App-initiated export; recipient must be empty.  Without this explicit
    // '', useExportShared.ts defaults to Tom@Gilb.com and Tom would email himself.
    to: '',
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="resources-panel">
      <div v-if="open" class="fixed inset-0 z-[700]">
        <!-- Backdrop (CloseDot rule: click-outside closes) -->
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')" />

        <!-- Panel -->
        <section
          class="absolute inset-4 md:inset-10 lg:inset-16 rounded-2xl bg-white shadow-2xl
                 ring-1 ring-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Stage 10 · Resources Sharpening"
        >
          <!-- Header -->
          <header class="flex items-start justify-between px-6 py-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-200">
            <div class="flex items-center gap-4">
              <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-2 select-none
                          bg-gradient-to-r from-emerald-500 to-teal-500
                          shadow-lg ring-2 ring-emerald-300/40">
                <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                      aria-hidden="true">10</span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100">Stage Now</span>
                  <span class="text-base font-extrabold text-white">Resources</span>
                </span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-emerald-900">Resources Sharpening</h2>
                <p class="text-[12px] text-emerald-700/80">
                  9 dimensions · {{ totalAnsweredCount }} / {{ totalQuestionsCount }} questions answered · Conjunction-of-Technologies: every finding traces to a Gilb source.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- 📤 Export pin — Export-Button-on-All-Windows SUPREME sweep target.
                   Wraps the previously-orphaned exportResourcesSharpen() handler
                   (existed since r41 v?? but never wired into the template) into a
                   single-click action: clipboard + preview + auto-open Mail (with
                   To: empty per Mailto-No-Self-To SUPREME). -->
              <!-- r41 v413 (Tom Gilb 2026-06-28 "applies to all sharpening") —
                   Apply Approved Findings MIRROR in the header.  Long
                   sharpening surface ⇒ bottom Apply CTA (~line 1267) can be
                   off-screen ⇒ planner only sees CloseDot at top ⇒ ambiguity
                   with accept.  Gated on `approvalCount > 0` (matches the
                   bottom CTA's gate) so the pill never competes when there's
                   nothing to apply. -->
              <button
                v-if="parsedAnalysis && approvalCount > 0"
                type="button"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-extrabold shadow ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
                :title="`Apply ${approvalCount} ticked finding${approvalCount === 1 ? '' : 's'} → SpecBlock (reversible via Universal Undo ⌘Z)`"
                :aria-label="`Apply ${approvalCount} approved finding${approvalCount === 1 ? '' : 's'}`"
                @click="applyApproved()"
              >
                ✓ Apply {{ approvalCount }} finding{{ approvalCount === 1 ? '' : 's' }} →
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900
                       bg-white hover:bg-emerald-50 border border-emerald-300
                       rounded-lg px-3 py-1.5 transition-colors shadow-sm"
                title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
                aria-label="Export Resources Sharpening — colourful HTML to clipboard, preview window, and Mail"
                @click="exportResourcesSharpen"
              >
                <span>📤</span><span>Export</span>
              </button>
              <CloseDot size="lg" title="Close · Cancel without applying — ticked findings are NOT committed unless you click Apply" aria-label="Close panel without applying" @click="emit('close')" />
            </div>
          </header>

          <!-- Plan identity band (r41 v96 — Phase 3 sweep) — emerald/teal-toned. -->
          <PlanIdentityBand
            :plan-name="props.planName"
            :plan-owner="props.planOwner"
            :plan-version="props.planVersion"
            :generated-at="props.generatedAt"
            :theme="{ bg: 'bg-teal-700', borderTop: 'border-emerald-400', label: 'text-emerald-100', pickerBorder: 'border-emerald-300' }"
            @select-history="(id: string) => emit('select-history', id)"
          />

          <!-- Body — ScrollContainer rule: outer must have min-h-0 (flex child can't
               shrink below content-size without it) + relative (absolute overlay
               indicator needs a positioning context); inner gets h-full so the
               overflow-y-auto div is height-constrained and actually scrolls.
               Padding lives on inner-class so it's inside the scroll area. -->
          <ScrollContainer class="flex-1 min-h-0 relative" inner-class="h-full px-6 py-5">
            <!-- v501 (2026-07-21) — Plan Scope Framework.  Tom Gilb 2026-07-21:
                 "the basic question is what is the long term deadline for
                 reaching the top critical Goals of the plan? and Is there any
                 type of budget, and what type: total, annual, suggested/
                 contracted/fixed/paidout. The long term deadline should be able
                 to be expressed as a specific date, or a time period from
                 project start (defined as a set of events, like contract
                 signed, budget approved, staff ready)". -->
            <div class="mb-6 rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 space-y-5">
              <div>
                <div class="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">🎯 Plan Scope Framework</div>
                <div class="text-[11px] text-indigo-900/70 mt-0.5">Top-level bounds for every Evo Step + Task below.  Auto-saves per plan.</div>
              </div>

              <!-- SECTION 1 — Long-term deadline -->
              <fieldset class="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
                <legend class="px-2 text-[10px] uppercase font-bold text-indigo-700 tracking-wide">
                  Long-Term Deadline
                  <span class="ml-1 text-[9px] font-normal text-indigo-800/70 normal-case tracking-normal italic">— for reaching the top critical Goals</span>
                </legend>
                <div class="flex flex-wrap gap-2 items-center text-[11px]">
                  <span class="font-semibold text-indigo-900">Expressed as:</span>
                  <label class="flex items-center gap-1 cursor-pointer" title="Express the deadline as a specific calendar date">
                    <input type="radio" v-model="scopeFramework.deadlineMode" value="date" class="accent-indigo-600" />
                    <span>Specific date</span>
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer" title="Express the deadline as N days/weeks/months/years from project start">
                    <input type="radio" v-model="scopeFramework.deadlineMode" value="from-start" class="accent-indigo-600" />
                    <span>Time period from project start</span>
                  </label>
                  <button
                    v-if="scopeFramework.deadlineMode !== null"
                    type="button" class="ml-auto text-[10px] text-slate-500 hover:text-slate-800 underline"
                    title="Clear the deadline (return to 'not yet set')"
                    @click="scopeFramework.deadlineMode = null; scopeFramework.deadlineDate = null; scopeFramework.deadlineFromStartValue = null"
                  >clear</button>
                </div>
                <div v-if="scopeFramework.deadlineMode === 'date'" class="flex items-center gap-2 pl-4">
                  <label class="text-[10px] font-semibold text-indigo-800">Deadline date:</label>
                  <input
                    v-model="scopeFramework.deadlineDate" type="date"
                    class="rounded-md border-2 border-indigo-200 bg-white px-2 py-1 text-sm font-bold text-indigo-900 focus:outline-none focus:border-indigo-500"
                    title="Specific calendar date by which top critical Goals must be reached"
                    aria-label="Long-term deadline date"
                  />
                </div>
                <div v-else-if="scopeFramework.deadlineMode === 'from-start'" class="flex items-center gap-2 pl-4 flex-wrap">
                  <label class="text-[10px] font-semibold text-indigo-800">Time from project start:</label>
                  <input
                    v-model.number="scopeFramework.deadlineFromStartValue" type="number" min="1" step="1"
                    class="w-16 rounded-md border-2 border-indigo-200 bg-white px-2 py-1 text-sm font-bold text-indigo-900 focus:outline-none focus:border-indigo-500"
                    placeholder="—"
                    title="Number of time-units from project start until top critical Goals must be reached"
                    aria-label="Time period value"
                  />
                  <select
                    v-model="scopeFramework.deadlineFromStartUnit"
                    class="rounded-md border-2 border-indigo-200 bg-white px-2 py-1 text-sm text-indigo-900 focus:outline-none focus:border-indigo-500"
                    aria-label="Time period unit"
                  >
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                    <option value="years">years</option>
                  </select>
                  <span class="text-[10px] text-indigo-800/70 italic">from project start (defined below)</span>
                </div>
              </fieldset>

              <!-- SECTION 2 — Project start events (shown when 'from-start' selected) -->
              <fieldset
                v-if="scopeFramework.deadlineMode === 'from-start'"
                class="rounded-lg border border-indigo-200 bg-white p-3 space-y-2"
              >
                <legend class="px-2 text-[10px] uppercase font-bold text-indigo-700 tracking-wide">
                  Project Start
                  <span class="ml-1 text-[9px] font-normal text-indigo-800/70 normal-case tracking-normal italic">— project starts when ALL checked events have occurred ({{ projectStartEventCount }} selected)</span>
                </legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                  <!-- v502 — six standard events, ordered by typical temporal sequence -->
                  <label class="flex items-center gap-2 cursor-pointer" title="Project start includes: planning phase has started">
                    <input type="checkbox" v-model="scopeFramework.startPlanningStarted" class="accent-indigo-600" />
                    <span>🗓 Planning Started</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer" title="Project start includes: contract signed">
                    <input type="checkbox" v-model="scopeFramework.startContractSigned" class="accent-indigo-600" />
                    <span>📝 Contract Signed</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer" title="Project start includes: budget approved">
                    <input type="checkbox" v-model="scopeFramework.startBudgetApproved" class="accent-indigo-600" />
                    <span>💰 Budget Approved</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer" title="Project start includes: plan formally approved">
                    <input type="checkbox" v-model="scopeFramework.startPlanApproved" class="accent-indigo-600" />
                    <span>✅ Plan Approved</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer" title="Project start includes: staff ready to begin work">
                    <input type="checkbox" v-model="scopeFramework.startStaffReady" class="accent-indigo-600" />
                    <span>👥 Staff Ready</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer" title="Project start includes: first Evo Steps begun (Stage 6 → 7 execution kickoff)">
                    <input type="checkbox" v-model="scopeFramework.startFirstEvoStepsStarted" class="accent-indigo-600" />
                    <span>🚀 First Evo Steps Started</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer md:col-span-2" :title="`Project start includes: ${scopeFramework.startCustomEventLabel || 'custom event'}`">
                    <input type="checkbox" v-model="scopeFramework.startCustomEventChecked" class="accent-indigo-600" />
                    <input
                      v-model="scopeFramework.startCustomEventLabel" type="text"
                      class="flex-1 min-w-0 rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[12px] text-indigo-900 focus:outline-none focus:border-indigo-500"
                      placeholder="✨ Custom event (e.g. Regulatory approval)"
                      aria-label="Custom project start event label"
                    />
                  </label>
                </div>
              </fieldset>

              <!-- SECTION 3 — Budget -->
              <fieldset class="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
                <legend class="px-2 text-[10px] uppercase font-bold text-indigo-700 tracking-wide">
                  Budget
                  <span class="ml-1 text-[9px] font-normal text-indigo-800/70 normal-case tracking-normal italic">— is there any type of budget?</span>
                </legend>
                <div class="flex flex-wrap gap-3 items-center text-[11px]">
                  <label class="flex items-center gap-1 cursor-pointer" title="Yes — a budget exists in some form">
                    <input type="radio" v-model="scopeFramework.hasBudget" value="yes" class="accent-indigo-600" />
                    <span>Yes</span>
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer" title="No — no budget defined (bound only by other constraints)">
                    <input type="radio" v-model="scopeFramework.hasBudget" value="no" class="accent-indigo-600" />
                    <span>No</span>
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer" title="Undecided — budget conversation not yet had">
                    <input type="radio" v-model="scopeFramework.hasBudget" value="undecided" class="accent-indigo-600" />
                    <span>Undecided</span>
                  </label>
                  <button
                    v-if="scopeFramework.hasBudget !== null"
                    type="button" class="ml-auto text-[10px] text-slate-500 hover:text-slate-800 underline"
                    title="Clear the budget presence answer"
                    @click="scopeFramework.hasBudget = null"
                  >clear</button>
                </div>
                <div v-if="scopeFramework.hasBudget === 'yes'" class="pt-2 space-y-2">
                  <div class="text-[10px] font-semibold text-indigo-800">
                    Budget types — tick each type that applies ({{ budgetTypeCount }} selected).  A plan can carry multiple (e.g. Contracted + Paid Out).
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                      v-for="t in BUDGET_TYPES" :key="t.id"
                      class="flex items-center gap-2 rounded-md border p-2"
                      :class="t.id in scopeFramework.budgetAmounts ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-white'"
                    >
                      <label class="flex items-center gap-1.5 cursor-pointer shrink-0" :title="`Toggle the ${t.label} budget type — ${t.hint}`">
                        <input
                          type="checkbox"
                          :checked="t.id in scopeFramework.budgetAmounts"
                          class="accent-indigo-600"
                          @change="toggleBudgetType(t.id)"
                        />
                        <span class="text-[11px] font-bold text-indigo-900">{{ t.label }}</span>
                      </label>
                      <span v-if="t.id in scopeFramework.budgetAmounts" class="text-sm font-bold text-indigo-800">$</span>
                      <input
                        v-if="t.id in scopeFramework.budgetAmounts"
                        :value="scopeFramework.budgetAmounts[t.id]" type="number" min="0" step="1000"
                        class="flex-1 min-w-0 rounded-md border-2 border-indigo-200 bg-white px-2 py-1 text-sm font-bold text-indigo-900 focus:outline-none focus:border-indigo-500"
                        placeholder="0"
                        :title="`${t.label} — ${t.hint}`"
                        :aria-label="`${t.label} budget amount`"
                        @input="scopeFramework.budgetAmounts[t.id] = Number(($event.target as HTMLInputElement).value) || 0"
                      />
                      <span v-else class="flex-1 text-[10px] text-indigo-800/60 italic">{{ t.hint }}</span>
                    </div>
                  </div>
                </div>
                <div v-else-if="scopeFramework.hasBudget === 'no'" class="pl-1 text-[11px] italic text-slate-600">
                  No budget defined — Evo Steps + Tasks are bound only by other constraints (calendar, capacity, quality).
                </div>
                <div v-else-if="scopeFramework.hasBudget === 'undecided'" class="pl-1 text-[11px] italic text-amber-800">
                  Budget conversation not yet had — flagging as pending decision.  Return here once resolved.
                </div>
              </fieldset>
            </div>

            <!-- v504 (2026-07-21) — Resource Estimation Card.
                 Tom Gilb's estimation subsystem MVP: three central resources
                 (Capital Cost / Calendar Time / Specialist Staff) compared
                 against the Plan Scope Framework budgets, with traffic-light
                 status + threshold settings + manual "Add Estimation" + full
                 history + Sharpen-Resources pin when a resource overflows.
                 Auto-triggers on spec changes + AI-driven estimation land in v505. -->
            <div class="mb-6">
              <ResourceEstimationCard
                :plan-id-ref="planIdRef"
                @open-sharpening="(r) => showToast(`🔪 Resources Sharpening for ${r} — AI advice dialogue lands in v510 · today: click Open Resources Agent above for the full hub`, 4000)"
                @open-resources-agent="emit('open-resources-agent')"
              />
            </div>

            <!-- Derived cost summary -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div class="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
                <div class="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Calendar Cost (from prior stages)</div>
                <div class="text-2xl font-extrabold text-emerald-900 mt-1">
                  {{ totalCalendarCost.toLocaleString() }}
                  <span class="text-xs font-normal text-emerald-700/80 ml-1">days</span>
                </div>
              </div>
              <div class="rounded-xl border-2 border-violet-200 bg-violet-50 p-3">
                <div class="text-[10px] uppercase font-bold text-violet-700 tracking-wider">Capital Cost (captured)</div>
                <div class="text-2xl font-extrabold text-violet-900 mt-1">
                  ${{ totalCapitalCost.toLocaleString() }}
                </div>
              </div>
              <div class="rounded-xl border-2 border-blue-200 bg-blue-50 p-3">
                <div class="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Top V/C ratios (efficiency)</div>
                <ul class="text-[11px] text-blue-900 mt-1 space-y-0.5">
                  <li v-for="[k, v] in topVCRatios" :key="k">
                    <b>{{ k }}</b>: {{ v.toFixed(2) }}
                  </li>
                  <li v-if="topVCRatios.length === 0" class="italic opacity-70">No V/C data yet — complete Impact Estimation first.</li>
                </ul>
              </div>
            </div>

            <!-- AI-assist CTA -->
            <div class="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <span class="text-2xl" aria-hidden="true">🧠</span>
              <div class="flex-1">
                <div class="font-bold text-amber-900">AI-assist via Claudian (local — per Claude-Code-as-AI-Layer rule)</div>
                <div class="text-[12px] text-amber-800 mt-1 leading-relaxed">
                  Copy the analysis prompt + current spec to your clipboard, paste into Claudian,
                  and Claudian writes a structured Planguage Representation analysis (one finding per dimension, with Gilb citations).
                  No external API call from the SEM App — the AI work happens in your local Claude Code session.
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm
                       hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                title="Copy the analysis prompt + current spec (as Planguage Representation) to clipboard, ready to paste into Claudian"
                @click="copyAnalysisRequest()"
              >📋 Copy prompt + spec</button>
            </div>

            <!-- Dimension cards -->
            <ol class="space-y-3">
              <li
                v-for="(dim, idx) in RESOURCES_SHARPEN_DIMENSIONS"
                :key="dim.id"
                class="rounded-xl border-2 transition-all duration-150"
                :class="expandedId === dim.id
                  ? 'border-emerald-400 bg-white shadow-md'
                  : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'"
              >
                <button
                  type="button"
                  class="w-full flex items-start gap-3 p-4 text-left
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
                  :aria-expanded="expandedId === dim.id"
                  :aria-controls="`dim-body-${dim.id}`"
                  :title="`${dim.label} — ${dim.summary}`"
                  @click="toggle(dim.id)"
                >
                  <span class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
                               bg-emerald-100 text-emerald-700 font-extrabold text-sm">
                    {{ idx + 1 }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                      <span class="font-bold text-slate-900 text-[15px]">{{ dim.label }}</span>
                      <span
                        class="shrink-0 text-[9px] font-mono px-1 py-px rounded ml-1"
                        :class="dimAnsweredCount(dim) === dim.questions.length
                          ? 'bg-emerald-100 text-emerald-700'
                          : dimAnsweredCount(dim) > 0
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-400'"
                      >{{ dimAnsweredCount(dim) }}/{{ dim.questions.length }}</span>
                    </div>
                    <div class="text-[12px] text-slate-600 mt-0.5">{{ dim.summary }}</div>
                  </div>
                  <span class="shrink-0 text-slate-400 text-xs mt-1" aria-hidden="true">
                    {{ expandedId === dim.id ? '▼' : '▶' }}
                  </span>
                </button>
                <div
                  v-if="expandedId === dim.id"
                  :id="`dim-body-${dim.id}`"
                  class="px-4 pb-4 pt-1 border-t border-emerald-100"
                >
                  <!-- Why it matters -->
                  <div class="mb-3 px-3 py-2 rounded-md bg-amber-50 border-l-4 border-amber-400">
                    <span class="text-[11px] uppercase font-bold text-amber-700 tracking-wider mr-2">Why this matters</span>
                    <span class="text-[12px] text-amber-900">{{ dim.whyItMatters }}</span>
                  </div>
                  <!-- Interactive per-question blocks (EvoSharpInterview-style UX) -->
                  <div class="mb-4 space-y-4">
                    <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-2">Guided questions</div>
                    <div
                      v-for="(q, qi) in dim.questions"
                      :key="qi"
                      class="space-y-2 pb-3 border-b border-slate-100 last:border-b-0"
                    >
                      <!-- Question row: text + JustificationGlyph pin -->
                      <div class="flex items-start gap-2">
                        <span class="text-sm font-semibold text-slate-800 flex-1">{{ q }}</span>
                        <JustificationGlyph
                          :open="isJustOpen(justKey(dim.id, qi))"
                          :title="'[?!] Q&A Justification for: ' + q"
                          @click.stop="toggleJust(justKey(dim.id, qi))"
                        />
                      </div>

                      <!-- Planner textarea -->
                      <div>
                        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Planner's answer</p>
                        <textarea
                          :value="getAnswer(dim.id, String(qi)).typed"
                          placeholder="Your answer…"
                          rows="2"
                          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800
                                 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400
                                 transition-colors resize-y"
                          :aria-label="`Your answer to: ${q}`"
                          @input="(e) => setTypedAnswer(dim.id, String(qi), (e.target as HTMLTextAreaElement).value)"
                        />
                      </div>

                      <!-- Planner Because/Sources — shown when justification panel is open -->
                      <div
                        v-if="isJustOpen(justKey(dim.id, qi))"
                        class="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5 space-y-2"
                      >
                        <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700">[?!\"] Justification fields</p>
                        <div>
                          <label class="block text-[10px] font-semibold text-indigo-700 mb-0.5">[!] Because (your reasoning)</label>
                          <textarea
                            :value="getAnswer(dim.id, String(qi)).because ?? ''"
                            placeholder="Why you answered this way…"
                            rows="2"
                            class="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-slate-800
                                   placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
                            :aria-label="`Because field for question: ${q}`"
                            @input="(e) => setPlannerBecause(dim.id, String(qi), (e.target as HTMLTextAreaElement).value)"
                          />
                        </div>
                        <div>
                          <label class="block text-[10px] font-semibold text-indigo-700 mb-0.5">[\"] Sources (citations, references)</label>
                          <textarea
                            :value="getAnswer(dim.id, String(qi)).sources ?? ''"
                            placeholder="References and sources…"
                            rows="2"
                            class="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-slate-800
                                   placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
                            :aria-label="`Sources field for question: ${q}`"
                            @input="(e) => setPlannerSources(dim.id, String(qi), (e.target as HTMLTextAreaElement).value)"
                          />
                        </div>
                      </div>

                      <!-- Suggested answers chips -->
                      <div v-if="dim.suggestedAnswers?.[qi]?.length" class="space-y-1.5">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-0.5">Suggested answers — tick any to approve</p>
                        <div
                          v-for="(sugg, si) in dim.suggestedAnswers![qi]"
                          :key="si"
                          class="rounded-lg border border-slate-200 bg-white hover:bg-emerald-50/40 transition-colors"
                          :class="isTicked(dim.id, String(qi), si) ? 'border-emerald-300 bg-emerald-50/60' : ''"
                        >
                          <div class="flex items-start gap-2 px-2.5 py-1.5">
                            <label
                              class="flex items-start gap-2 cursor-pointer flex-1"
                              :title="`Suggestion ${si + 1} — click to ${isTicked(dim.id, String(qi), si) ? 'remove from' : 'add to'} effective answer (Mixed mode)`"
                            >
                              <input
                                type="checkbox"
                                :checked="isTicked(dim.id, String(qi), si)"
                                class="mt-0.5 flex-shrink-0 accent-emerald-600 cursor-pointer"
                                :aria-label="`Tick suggestion ${si + 1} for question: ${q}`"
                                @change="toggleTicked(dim.id, String(qi), si)"
                              />
                              <span class="text-xs text-slate-700 leading-snug">
                                <span class="text-[9px] font-mono font-bold text-emerald-600 mr-1">#{{ si + 1 }}</span>{{ sugg }}
                              </span>
                            </label>
                            <JustificationGlyph
                              :open="isJustOpen(suggJustKey(dim.id, qi, si))"
                              :title="'[?!] Justification for suggestion #' + (si + 1)"
                              @click.stop="toggleJust(suggJustKey(dim.id, qi, si))"
                            />
                          </div>
                          <!-- Suggestion Because/Sources -->
                          <div
                            v-if="isJustOpen(suggJustKey(dim.id, qi, si))"
                            class="px-2.5 pb-2 pt-1 border-t border-indigo-100 bg-indigo-50/60 space-y-1.5"
                          >
                            <p class="text-[9px] font-bold uppercase tracking-wide text-indigo-600">[?!\"] Justification for suggestion #{{ si + 1 }}</p>
                            <div>
                              <label class="block text-[9px] font-semibold text-indigo-600 mb-0.5">[!] Because</label>
                              <textarea
                                :value="getAnswer(dim.id, String(qi)).suggBecause?.[si] ?? ''"
                                placeholder="Why approve this suggestion…"
                                rows="1"
                                class="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-slate-800
                                       placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
                                :aria-label="`Because for suggestion ${si + 1}`"
                                @input="(e) => setSuggBecause(dim.id, String(qi), si, (e.target as HTMLTextAreaElement).value)"
                              />
                            </div>
                            <div>
                              <label class="block text-[9px] font-semibold text-indigo-600 mb-0.5">[\"] Sources</label>
                              <textarea
                                :value="getAnswer(dim.id, String(qi)).suggSources?.[si] ?? ''"
                                placeholder="References…"
                                rows="1"
                                class="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-slate-800
                                       placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
                                :aria-label="`Sources for suggestion ${si + 1}`"
                                @input="(e) => setSuggSources(dim.id, String(qi), si, (e.target as HTMLTextAreaElement).value)"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Mode pills -->
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1">Use:</span>
                        <button
                          v-for="m in SELECTION_MODES"
                          :key="m.id"
                          type="button"
                          class="text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors"
                          :class="getAnswer(dim.id, String(qi)).mode === m.id
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'"
                          :title="m.title"
                          @click="setMode(dim.id, String(qi), m.id)"
                        >{{ m.label }}</button>
                      </div>

                      <!-- Effective answer preview -->
                      <div class="rounded-lg bg-emerald-50/60 border border-emerald-200 px-2.5 py-1.5">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Effective answer (what will export)</p>
                        <p
                          v-if="getEffectiveAnswer(dim.id, String(qi), dim.suggestedAnswers?.[qi] ?? []).trim().length > 0"
                          class="text-[11px] text-slate-800 whitespace-pre-wrap leading-snug"
                        >{{ getEffectiveAnswer(dim.id, String(qi), dim.suggestedAnswers?.[qi] ?? []) }}</p>
                        <p v-else class="text-[11px] text-slate-400 italic">
                          (empty — type an answer or tick a suggestion to populate)
                        </p>
                      </div>
                    </div>
                  </div>
                  <!-- Examples -->
                  <div class="mb-3">
                    <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-1">Worked examples</div>
                    <ul class="space-y-1.5">
                      <li
                        v-for="(ex, ei) in dim.examples"
                        :key="ei"
                        class="font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5"
                      >{{ ex }}</li>
                    </ul>
                  </div>
                  <!-- Gilb citation -->
                  <div class="px-3 py-2 rounded-md bg-violet-50 border-l-4 border-violet-400">
                    <span class="text-[11px] uppercase font-bold text-violet-700 tracking-wider mr-2">Cited from Gilb</span>
                    <span class="text-[12px] text-violet-900 italic">{{ dim.gilbCite }}</span>
                  </div>
                  <!-- Standard link if any -->
                  <div v-if="dim.standardRef" class="mt-2 text-[11px] text-slate-500">
                    Canonical: <code class="text-slate-700">{{ dim.standardRef }}</code>
                  </div>
                </div>
              </li>
            </ol>

            <!-- ── Advanced Tools section ─────────────────────────────────────
                 Tom 2026-06-04 extension: 5 GENERATIVE tools (vs the 9
                 analytical dimensions above).  Each tool, when run via
                 Claudian, produces NEW spec content — proposed R. entry
                 tightenings, sharpened Scales+Meters, new S. strategies,
                 new C. binary constraints, and Scale Qualifier audits. -->
            <div class="mt-8 pt-6 border-t-2 border-emerald-200">
              <div class="flex items-center gap-3 mb-3">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full
                             bg-violet-600 text-white font-extrabold text-sm" aria-hidden="true">⚙</span>
                <div>
                  <h3 class="text-base font-extrabold text-violet-900">Advanced Resource Tools</h3>
                  <p class="text-[12px] text-violet-700/80">
                    Generative tools — produce sharpened or new spec content.  Run any tool via Claudian using
                    the prompt + spec copy button above.  This is advanced Planguage —
                    cite Competitive Engineering (CE 2005), Cost Engineering, Optima, and Systems Enterprise Architecture (SEA).
                  </p>
                </div>
              </div>
              <ol class="space-y-3">
                <li
                  v-for="(tool, idx) in RESOURCES_ADVANCED_TOOLS"
                  :key="tool.id"
                  class="rounded-xl border-2 transition-all duration-150"
                  :class="expandedToolId === tool.id
                    ? 'border-violet-400 bg-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'"
                >
                  <button
                    type="button"
                    class="w-full flex items-start gap-3 p-4 text-left
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-xl"
                    :aria-expanded="expandedToolId === tool.id"
                    :aria-controls="`tool-body-${tool.id}`"
                    :title="`${tool.label} — ${tool.summary}`"
                    @click="toggleTool(tool.id)"
                  >
                    <span class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
                                 bg-violet-100 text-violet-700 font-extrabold text-sm">
                      {{ idx + 1 }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="font-bold text-slate-900 text-[15px]">{{ tool.label }}</div>
                      <div class="text-[12px] text-slate-600 mt-0.5">{{ tool.summary }}</div>
                    </div>
                    <span class="shrink-0 text-slate-400 text-xs mt-1" aria-hidden="true">
                      {{ expandedToolId === tool.id ? '▼' : '▶' }}
                    </span>
                  </button>
                  <div
                    v-if="expandedToolId === tool.id"
                    :id="`tool-body-${tool.id}`"
                    class="px-4 pb-4 pt-1 border-t border-violet-100"
                  >
                    <div class="mb-3 px-3 py-2 rounded-md bg-blue-50 border-l-4 border-blue-400">
                      <span class="text-[11px] uppercase font-bold text-blue-700 tracking-wider mr-2">When to use</span>
                      <span class="text-[12px] text-blue-900">{{ tool.whenToUse }}</span>
                    </div>
                    <div class="mb-3">
                      <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-1">Output shape (what Claudian produces)</div>
                      <div class="font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5 whitespace-pre-wrap">{{ tool.outputShape }}</div>
                    </div>
                    <div class="mb-3">
                      <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-1">Worked examples</div>
                      <ul class="space-y-1.5">
                        <li
                          v-for="(ex, ei) in tool.examples"
                          :key="ei"
                          class="font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5"
                        >{{ ex }}</li>
                      </ul>
                    </div>
                    <div class="px-3 py-2 rounded-md bg-violet-50 border-l-4 border-violet-400">
                      <span class="text-[11px] uppercase font-bold text-violet-700 tracking-wider mr-2">Cited from Gilb</span>
                      <span class="text-[12px] text-violet-900 italic">{{ tool.gilbCite }}</span>
                    </div>
                    <div v-if="tool.standardRef" class="mt-2 text-[11px] text-slate-500">
                      Canonical: <code class="text-slate-700">{{ tool.standardRef }}</code>
                    </div>
                  </div>
                </li>
              </ol>
            </div>

            <!-- ── Phase 2 (r88): Apply Claudian Analysis ──────────────────────
                 Paste-back textarea → parser → staged findings list → tick-to-
                 approve per finding → "Apply Approved" emits updated SpecBlock.
                 Per AI-Max rule: nothing is imposed; every proposal is opt-in
                 with a visible source-layer badge so the user knows where it
                 came from (derived-from-plan / cited-from-gilb / etc.). -->
            <div class="mt-8 pt-6 border-t-2 border-slate-300">
              <div class="flex items-center gap-3 mb-3">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full
                             bg-emerald-700 text-white font-extrabold text-sm" aria-hidden="true">⇩</span>
                <div class="flex-1">
                  <h3 class="text-base font-extrabold text-emerald-900">Apply Claudian Analysis</h3>
                  <p class="text-[12px] text-emerald-700/80">
                    Paste the Planguage Representation Claudian emitted after running the prompt above.  Each finding shows its source-layer
                    badge.  Tick to approve, then click <b>Apply Approved Findings</b> — proposed R./S./C. entries land
                    in <code>SpecBlock</code>.
                  </p>
                </div>
              </div>

              <textarea
                v-model="pastedAnalysisText"
                rows="6"
                placeholder='Paste Claudian Planguage Representation here, e.g. { "schemaVersion": "1", "partA": { … }, "partB": { … } }'
                class="w-full font-mono text-[12px] text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-lg
                       p-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              <div class="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                  :disabled="!pastedAnalysisText.trim()"
                  @click="parsePastedAnalysis()"
                >Parse</button>
                <button
                  v-if="parsedAnalysis"
                  type="button"
                  class="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm
                         hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
                  @click="pastedAnalysisText = ''; parsedAnalysis = null; parseErrors = []; parseWarnings = []; approvedKeys = new Set()"
                >Clear</button>
                <span v-if="parsedAnalysis" class="text-[12px] text-emerald-700 italic ml-auto">
                  {{ approvalCount }} tick{{ approvalCount === 1 ? '' : 's' }} approved
                </span>
              </div>

              <!-- Parse errors / warnings -->
              <div v-if="parseErrors.length > 0" class="mt-3 px-3 py-2 rounded-md bg-red-50 border-l-4 border-red-500">
                <div class="text-[11px] uppercase font-bold text-red-700 tracking-wider mb-1">Parse errors ({{ parseErrors.length }})</div>
                <ul class="list-disc pl-5 text-[12px] text-red-900 space-y-0.5">
                  <li v-for="(e, i) in parseErrors" :key="i" class="font-mono">{{ e }}</li>
                </ul>
              </div>
              <div v-if="parseWarnings.length > 0" class="mt-2 px-3 py-2 rounded-md bg-amber-50 border-l-4 border-amber-400">
                <div class="text-[11px] uppercase font-bold text-amber-700 tracking-wider mb-1">Warnings ({{ parseWarnings.length }})</div>
                <ul class="list-disc pl-5 text-[12px] text-amber-900 space-y-0.5">
                  <li v-for="(w, i) in parseWarnings" :key="i" class="font-mono">{{ w }}</li>
                </ul>
              </div>

              <!-- Staged findings — Part A analytical -->
              <div v-if="parsedAnalysis?.partA && Object.keys(parsedAnalysis.partA).length > 0" class="mt-5">
                <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-2">Analytical findings (Part A)</div>
                <div v-for="(findings, dimId) in parsedAnalysis.partA" :key="dimId" class="mb-4">
                  <div class="text-[11px] font-bold text-emerald-800 mb-1">{{ dimId }}</div>
                  <ul class="space-y-2">
                    <li
                      v-for="(f, i) in (findings as AnalyticalFinding[])"
                      :key="i"
                      class="rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer"
                          :checked="approvedKeys.has(findingApprovalKey(dimId, i))"
                          @change="toggleApproval(findingApprovalKey(dimId, i))"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              class="text-[10px] uppercase font-bold rounded px-1.5 py-0.5"
                              :style="{
                                backgroundColor: SOURCE_LAYER_TONES[f.source].bg,
                                color: SOURCE_LAYER_TONES[f.source].text,
                                borderLeft: `3px solid ${SOURCE_LAYER_TONES[f.source].border}`,
                              }"
                            >{{ SOURCE_LAYER_LABELS[f.source] }}</span>
                            <span class="text-[10px] uppercase font-bold text-slate-500">{{ f.severity }}</span>
                          </div>
                          <div class="font-bold text-[13px] text-slate-900">{{ f.title }}</div>
                          <div class="text-[12px] text-slate-700 mt-0.5">{{ f.description }}</div>
                          <div v-if="f.gilbCite" class="text-[11px] text-violet-700 italic mt-1">{{ f.gilbCite }}</div>
                          <div v-if="f.proposedREntry" class="mt-2 px-2 py-1.5 rounded bg-teal-50 border-l-3 border-teal-500 text-[11.5px] font-mono text-teal-900">
                            <b>Proposed R. entry:</b> {{ f.proposedREntry.id }} · {{ rBudgetLabel(f.proposedREntry) }}: {{ rBudget(f.proposedREntry) }} · Tolerable: {{ f.proposedREntry.tolerable }}
                          </div>
                          <div v-if="f.tradeoff" class="mt-1 px-2 py-1.5 rounded bg-orange-50 border-l-3 border-orange-500 text-[11.5px] text-orange-900">
                            <b>Tradeoff:</b> give "{{ f.tradeoff.give }}", save "{{ f.tradeoff.save }}" — needs approval from {{ f.tradeoff.approvedBy || 'stakeholders' }}
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Staged proposals — Part B generative -->
              <div v-if="parsedAnalysis?.partB && Object.keys(parsedAnalysis.partB).length > 0" class="mt-5">
                <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-2">Generative proposals (Part B)</div>
                <div v-for="(tool, toolId) in parsedAnalysis.partB" :key="toolId" class="mb-4">
                  <div class="text-[11px] font-bold text-violet-800 mb-1">{{ toolId }}</div>
                  <!-- New R. entries -->
                  <ul v-if="(tool.proposedREntries ?? []).length > 0" class="space-y-1.5 mb-2">
                    <li
                      v-for="(p, i) in (tool.proposedREntries as REntryProposal[])"
                      :key="`R${i}`"
                      class="rounded-lg border-2 border-teal-200 bg-teal-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-teal-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'R', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'R', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-teal-800">NEW R. {{ p.id }}</b><br>
                          Scale: {{ p.scale }}<br>
                          Tolerable: {{ p.tolerable }} · Goal: {{ p.goal }}
                        </div>
                      </div>
                    </li>
                  </ul>
                  <!-- New S. entries -->
                  <ul v-if="(tool.proposedSEntries ?? []).length > 0" class="space-y-1.5 mb-2">
                    <li
                      v-for="(p, i) in (tool.proposedSEntries as SEntryProposal[])"
                      :key="`S${i}`"
                      class="rounded-lg border-2 border-orange-200 bg-orange-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-orange-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'S', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'S', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-orange-800">NEW S. {{ p.id }}</b><br>
                          {{ p.description }}<br>
                          Impact: {{ p.impact }}
                        </div>
                      </div>
                    </li>
                  </ul>
                  <!-- New C. entries -->
                  <ul v-if="(tool.proposedCEntries ?? []).length > 0" class="space-y-1.5 mb-2">
                    <li
                      v-for="(p, i) in (tool.proposedCEntries as CEntryProposal[])"
                      :key="`C${i}`"
                      class="rounded-lg border-2 border-red-200 bg-red-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-red-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'C', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'C', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-red-800">NEW C. {{ p.id }}</b><br>
                          {{ p.description }}<br>
                          <span v-if="p.scope" class="text-slate-700">Scope: {{ p.scope }}</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                  <!-- Field edits (modify existing entries) -->
                  <ul v-if="(tool.proposedFieldEdits ?? []).length > 0" class="space-y-1.5">
                    <li
                      v-for="(p, i) in (tool.proposedFieldEdits ?? [])"
                      :key="`F${i}`"
                      class="rounded-lg border-2 border-violet-200 bg-violet-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-violet-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'F', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'F', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-violet-800">EDIT {{ p.entryId }}.{{ p.field }}</b><br>
                          <span class="text-slate-500 line-through" v-if="p.currentValue">{{ p.currentValue }}</span><br>
                          <span class="text-violet-900">→ {{ p.proposedValue }}</span>
                          <div v-if="p.gilbCite" class="text-violet-700 italic mt-1">{{ p.gilbCite }}</div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Apply CTA -->
              <div v-if="parsedAnalysis && approvalCount > 0" class="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  class="px-5 py-3 rounded-lg bg-emerald-600 text-white font-extrabold text-sm shadow
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                  title="Apply ticked findings to SpecBlock"
                  @click="applyApproved()"
                >Apply {{ approvalCount }} Approved Finding{{ approvalCount === 1 ? '' : 's' }} → SpecBlock</button>
                <span class="text-[11px] text-slate-500 italic">
                  Writes to <code>spec.resources / solutions / constraints</code>; existing entries with same id are replaced (upsert).
                </span>
              </div>
            </div>

            <!-- ── Change Review Overlay ─────────────────────────────────────────
                 Absolute inset-0 within the ScrollContainer (which has relative)
                 so it covers the scroll body without a second modal. -->
            <div
              v-if="showChangeReview"
              class="absolute inset-0 z-10 bg-white flex flex-col rounded-2xl overflow-hidden"
            >
              <!-- Dark teal header with tabs -->
              <div class="bg-gradient-to-r from-teal-800 to-emerald-800 px-5 py-3 flex items-center gap-3">
                <h3 class="text-white font-extrabold text-base flex-1">Done Sharpening · Change Review</h3>
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="px-3 py-1 rounded font-semibold text-xs transition"
                    :class="changeReviewTab === 'review' ? 'bg-white text-teal-800' : 'text-teal-100 hover:bg-teal-700/60'"
                    title="Review all sharpening changes"
                    @click="changeReviewTab = 'review'"
                  >Review</button>
                  <button
                    type="button"
                    class="px-3 py-1 rounded font-semibold text-xs transition"
                    :class="changeReviewTab === 'history' ? 'bg-white text-teal-800' : 'text-teal-100 hover:bg-teal-700/60'"
                    title="Version history — saved snapshots of sharpening sessions"
                    @click="changeReviewTab = 'history'"
                  >Past Versions ({{ versions.length }})</button>
                  <button
                    type="button"
                    class="px-3 py-1 rounded font-semibold text-xs transition"
                    :class="changeReviewTab === 'compare' ? 'bg-white text-teal-800' : 'text-teal-100 hover:bg-teal-700/60'"
                    title="Compare two versions side by side"
                    @click="changeReviewTab = 'compare'"
                  >Compare</button>
                </div>
              </div>

              <!-- Tab body -->
              <!-- audit-ignore: scroll — this tab body is inside the Change Review overlay which is bounded by a fixed-height parent; nesting a second ScrollContainer inside the outer panel ScrollContainer (line 657) would create confusing double-scroll UX; the overlay manages its own bounded height -->
              <div class="flex-1 overflow-y-auto px-5 py-4">

                <!-- Review tab -->
                <div v-if="changeReviewTab === 'review'">
                  <p class="text-[12px] text-slate-600 mb-4">
                    {{ displayedChanges.length }} answered question{{ displayedChanges.length === 1 ? '' : 's' }} across the sharpening interview.
                    Save a version to snapshot this state, or Integrate to apply to the plan.
                  </p>
                  <div v-if="displayedChanges.length === 0" class="text-sm text-slate-400 italic">
                    No answers yet — return to the interview and fill in your responses.
                  </div>
                  <div
                    v-for="change in displayedChanges"
                    :key="change.key"
                    class="mb-4 rounded-lg border border-teal-200 bg-teal-50/40 overflow-hidden"
                  >
                    <div class="bg-teal-700 px-3 py-1.5">
                      <span class="text-white font-bold text-[11px] uppercase tracking-wide">{{ change.dimLabel }}</span>
                    </div>
                    <div class="px-3 py-2">
                      <p class="text-[11px] font-semibold text-slate-700 mb-1">{{ change.questionText }}</p>
                      <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ change.effectiveText }}</p>
                      <!-- v526 — Source · Timestamp · Basis attribution (Tom Gilb
                           2026-07-21: "all resource stipulations and all
                           estimates the source and timestamp, and basis were
                           to be noted and kept"). -->
                      <div class="mt-2 pt-2 border-t border-teal-200/60 text-[10px] leading-snug flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
                        <span>
                          <span class="uppercase tracking-wider font-semibold text-slate-500">Source:</span>
                          <span class="ml-1" v-if="change.source === 'planner'">👤 Planner</span>
                          <span class="ml-1" v-else-if="change.source === 'ai'">🤖 AI</span>
                          <span class="ml-1" v-else-if="change.source === 'contract'">📝 Contract</span>
                          <span class="ml-1" v-else-if="change.source === 'imported'">📥 Imported</span>
                          <span class="ml-1" v-else-if="change.source === 'external'">🌐 External</span>
                          <span class="ml-1 italic text-slate-400" v-else>❔ undetermined</span>
                        </span>
                        <span v-if="change.savedAt">
                          <span class="uppercase tracking-wider font-semibold text-slate-500">Timestamp:</span>
                          <span class="ml-1 text-slate-500">{{ new Date(change.savedAt).toLocaleString() }}</span>
                        </span>
                        <span v-if="change.basisBecause?.trim()">
                          <span class="uppercase tracking-wider font-semibold text-slate-500">Basis (Because):</span>
                          <span class="ml-1 italic text-slate-700">{{ change.basisBecause }}</span>
                        </span>
                        <span v-if="change.basisSources?.trim()">
                          <span class="uppercase tracking-wider font-semibold text-slate-500">Basis (Sources):</span>
                          <span class="ml-1 italic text-slate-700">{{ change.basisSources }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- History tab -->
                <div v-else-if="changeReviewTab === 'history'">
                  <p class="text-[12px] text-slate-600 mb-4">
                    Saved snapshots of this plan's sharpening sessions.
                    Use Save Version to snapshot the current session state.
                  </p>
                  <div v-if="versions.length === 0" class="text-sm text-slate-400 italic">
                    No saved versions yet — click Save Version in the footer.
                  </div>
                  <div
                    v-for="ver in versions"
                    :key="ver.id"
                    class="mb-3 rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-3"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span
                          class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                          :class="ver.status === 'integrated' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                        >{{ ver.status }}</span>
                        <span class="font-semibold text-sm text-slate-800">{{ ver.label }}</span>
                      </div>
                      <p class="text-[11px] text-slate-500">{{ new Date(ver.savedAt).toLocaleString('en-AU') }} · {{ ver.changes.length }} changes</p>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button
                        type="button"
                        class="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                        :title="`Rename version: ${ver.label}`"
                        @click="() => { const n = window.prompt('New name:', ver.label); if (n) renameVersion(ver.id, n) }"
                      >Rename</button>
                      <button
                        type="button"
                        class="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition"
                        :title="`Delete version: ${ver.label}`"
                        @click="deleteVersion(ver.id)"
                      >Delete</button>
                    </div>
                  </div>
                </div>

                <!-- Compare tab -->
                <div v-else-if="changeReviewTab === 'compare'">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="flex-1">
                      <label class="text-[10px] font-bold uppercase text-slate-600 block mb-1">Version A (left)</label>
                      <select
                        :value="compareVersionA ?? ''"
                        class="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                        title="Select version A for comparison"
                        @change="(e) => { compareVersionA = (e.target as HTMLSelectElement).value || null }"
                      >
                        <option value="">Live Session</option>
                        <option v-for="ver in versions" :key="ver.id" :value="ver.id">{{ ver.label }}</option>
                      </select>
                    </div>
                    <span class="text-slate-400 font-bold mt-4">⇄</span>
                    <div class="flex-1">
                      <label class="text-[10px] font-bold uppercase text-slate-600 block mb-1">Version B (right)</label>
                      <select
                        :value="compareVersionB ?? ''"
                        class="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                        title="Select version B for comparison"
                        @change="(e) => { compareVersionB = (e.target as HTMLSelectElement).value || null }"
                      >
                        <option value="">Live Session</option>
                        <option v-for="ver in versions" :key="ver.id" :value="ver.id">{{ ver.label }}</option>
                      </select>
                    </div>
                  </div>
                  <div v-if="compareSlots.length === 0" class="text-sm text-slate-400 italic">
                    No differences to compare — add answers or select different versions.
                  </div>
                  <div
                    v-for="slot in compareSlots"
                    :key="slot.key"
                    class="mb-4 rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <div class="bg-slate-100 px-3 py-1.5">
                      <span class="font-bold text-[11px] text-slate-700">{{ slot.dimLabel }}</span>
                      <span class="text-[11px] text-slate-500 ml-2">{{ slot.questionText }}</span>
                    </div>
                    <div class="grid grid-cols-2 divide-x divide-slate-200">
                      <div class="p-3">
                        <p class="text-[9px] font-bold uppercase text-teal-700 mb-1">Version A</p>
                        <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ slot.left }}</p>
                      </div>
                      <div class="p-3">
                        <p class="text-[9px] font-bold uppercase text-emerald-700 mb-1">Version B</p>
                        <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ slot.right }}</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <!-- Change Review footer -->
              <div class="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-300 transition"
                  title="Return to the sharpening interview"
                  @click="showChangeReview = false"
                >← Back to Interview</button>

                <template v-if="changeReviewTab === 'review'">
                  <button
                    type="button"
                    class="px-3 py-2 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition"
                    title="Save current answers as a named version snapshot"
                    @click="saveVersion()"
                  >Save Version</button>
                  <button
                    type="button"
                    class="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition"
                    title="Integrate all approved changes into the plan"
                    @click="integrateVersion()"
                  >Integrate → Plan</button>
                </template>

                <template v-else-if="changeReviewTab === 'history'">
                  <span class="text-[12px] text-slate-500 italic ml-2">{{ versions.length }} version{{ versions.length === 1 ? '' : 's' }} saved</span>
                </template>

                <template v-else-if="changeReviewTab === 'compare'">
                  <span class="text-[12px] text-slate-500 italic ml-2">{{ compareSlots.length }} question{{ compareSlots.length === 1 ? '' : 's' }} compared · A ⇄ B</span>
                </template>

                <div class="flex-1" />
                <button
                  type="button"
                  class="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-600 font-semibold text-xs hover:bg-slate-200 transition font-mono"
                  title="Download change review as HTML file"
                  @click="() => exportDownload(buildChangesHtml(false), `resources-change-review-${new Date().toISOString().slice(0,10)}`)"
                >*→[*] Export Review</button>
              </div>
            </div>
            <!-- /Change Review Overlay -->

          </ScrollContainer>

          <!-- Footer — three-button export + Done Sharpening.
               v527 (2026-07-21) — Tom Gilb: "done sharpening button is dead
               but close works".  When the Change Review overlay is open,
               the outer Copy/Email/Download HTML + Done Sharpening buttons
               were still visible but non-functional (Change Review's own
               inner footer has its own Back to Interview + Save Version +
               Integrate → Plan + Export Review pins).  Clicking outer Done
               Sharpening while Change Review was already open just re-set
               showChangeReview=true (no-op = felt DEAD).  Fix: hide the
               interview-context export + Done Sharpening buttons while the
               Change Review overlay is open.  Close stays visible so the
               user always has a way out of the whole panel. -->
          <footer class="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2 flex-wrap">
            <!-- Three-button export group — hidden during Change Review -->
            <template v-if="!showChangeReview">
              <button
                type="button"
                class="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-300 font-mono font-semibold text-xs hover:bg-indigo-100 transition
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
                title="[*]=[*] Copy colourful HTML to clipboard — ⌘V to paste into Mail or Keynote"
                @click="onExportCopy"
              >[*]=[*] Copy HTML</button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 font-mono font-semibold text-xs hover:bg-amber-100 transition
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
                title="[*]---→[*] Email · copies colourful HTML to clipboard + auto-opens Mail to Tom@Gilb.com"
                @click="onExportEmail"
              >[*]---→[*] Email</button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 font-mono font-semibold text-xs hover:bg-slate-200 transition
                       focus:outline-none focus:ring-2 focus:ring-slate-400"
                title="*→[*] Download colourful HTML as a standalone .html file"
                @click="onExportDownload"
              >*→[*] Download HTML</button>
            </template>

            <div class="flex-1" />

            <!-- Primary CTA: Done Sharpening → Change Review — hidden while
                 Change Review is already open (would be a no-op). -->
            <button
              v-if="!showChangeReview"
              type="button"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-sm shadow hover:bg-emerald-700 transition
                     focus:outline-none focus:ring-2 focus:ring-emerald-400"
              title="Done sharpening — open the Change Review panel to review, save, and integrate your answers"
              @click="openChangeReview()"
            >✓ Done Sharpening</button>
            <!-- audit-ignore: close — this is a secondary footer close button (DD-014 bottom-mirror pattern); the primary CloseDot is already in the header (line 649) -->
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800
                     focus:outline-none focus:ring-2 focus:ring-slate-400"
              title="Close this panel"
              @click="emit('close')"
            >Close</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.resources-panel-enter-active { animation: resources-panel-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.resources-panel-leave-active { animation: resources-panel-in 180ms cubic-bezier(0.7, 0, 0.84, 0) reverse both; }
@keyframes resources-panel-in {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
