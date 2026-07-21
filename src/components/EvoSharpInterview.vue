<!-- UNIT_TYPE=Panel -->
<!--
  EvoSharpInterview.vue — "Sharpen Next Step" modal · Evo Steps sharpening.

  Tom Gilb 2026-06-03 (verbatim):
    "Evo Tool: 'Next Value Step Focus'… Sub-Tool 'Evo Sharp Interview'…"

  Tom Gilb 2026-06-08 (feature spread request):
    "[?!"] and other new sharpening things are really useful, so please spread
    to the other sharpening processes."

  Features (r12 — spread from SolutionSharpenPanel):
    · JustificationGlyph [?!"] pins per question + per suggestion chip
    · Planner Because [!] / Sources ["] fields (gated behind pin)
    · Per-suggestion planner justification (auto-opens when suggestion ticked)
    · ✓ Done Sharpening → three-tab Change Review panel
    · Version History & Governance (save/restore/rename/delete/compare/approve)
    · Colourful HTML export: [*]=[*] Copy · [*]---→[*] Email · *→[*] Download
    · Safari scroll fix: absolute inset-y-4 panel inside fixed inset-0 backdrop

  Rules complied with:
    · Single-Surface — caller (App.vue) registers `evoSharpOpen` exclusive
    · ScrollContainer — sidebar + main pane + Change Review tabs all wrapped
    · CloseDot — header has <CloseDot> at end of flex header
    · Interaction Disclosure (DD-009) — every button has :title
    · Planguage-Glyph-First (DD-011) — PlEvoStepIcon in header
    · JustificationGlyph (DD-016) — [?!"] is the Planguage keyed notation
    · Banned-Scrum-Vocabulary — Planguage / Evo terms only
    · Claude-Code-as-AI-Layer — no in-app API calls
    · Color-on-Background Contrast (DD-017) — badges on white bg
    · MOVE principle — Done Sharpening always visible in footer
    · DD-014 (Top-and-Bottom Navigation Mirror) — category nav mirrored at bottom

  Twin portability: pure data in (steps[], planId), pure event out (close).
  All AI suggestions are static data; no runtime API calls.
-->

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import SourceBadge from './SourceBadge.vue'
import JustificationGlyph from './icons/JustificationGlyph.vue'
import { EVO_SHARP_CATEGORIES, totalQuestionCount, type SharpCategory } from '../data/evoSharpInterview'
import { useEvoSharpAnswers } from '../composables/useEvoSharpAnswers'
import type { SourceProvenance } from '../data/aiSource'
import type { EvoStep } from '../types/evo-plan'
import {
  exportEmail,
  exportCopy,
  exportDownload,
  htmlDocumentShell,
  htmlEsc,
} from '../composables/useExportShared'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  steps: EvoStep[]
  planId?: string
}>()

defineEmits<{ close: [] }>()

// ── Step selection ────────────────────────────────────────────────────────────
const selectedStepName = ref<string>(props.steps[0]?.name ?? '')

watch(
  () => props.steps,
  (newSteps) => {
    if (!newSteps.some(s => s.name === selectedStepName.value)) {
      selectedStepName.value = newSteps[0]?.name ?? ''
    }
  },
)

const selectedStep = computed<EvoStep | undefined>(() =>
  props.steps.find(s => s.name === selectedStepName.value),
)

// ── Answer persistence (extended with justification fields) ──────────────────
const planIdRef = computed(() => props.planId ?? 'default')
const stepNameRef = computed(() => selectedStepName.value)
const {
  getAnswer,
  setTypedAnswer,
  toggleTicked,
  setMode,
  isTicked,
  getEffectiveAnswer,
  clear,
  answeredCount,
  answeredInCategory,
  setPlannerBecause,
  setPlannerSources,
  setSuggBecause,
  setSuggSources,
} = useEvoSharpAnswers(planIdRef, stepNameRef)

// ── Q&A Justification visibility state ────────────────────────────────────────
// UI-only — not persisted. Key formats:
//   `q:${catId}:${qId}`        — question-level justification
//   `s:${catId}:${qId}:${idx}` — suggestion-level justification
//   `bc:${catId}:${qId}`       — planner's Because/Sources fields
const openJustifications = reactive<Set<string>>(new Set())

function toggleJustification(key: string): void {
  if (openJustifications.has(key)) openJustifications.delete(key)
  else openJustifications.add(key)
}
function isJustOpen(key: string): boolean { return openJustifications.has(key) }
function autoOpenQuestionJust(catId: string, qId: string): void { openJustifications.add(`q:${catId}:${qId}`) }
function autoOpenSuggJust(catId: string, qId: string, idx: number): void { openJustifications.add(`s:${catId}:${qId}:${idx}`) }

// Reconstruct open-justification state from persisted answers on mount
onMounted(() => {
  for (const cat of EVO_SHARP_CATEGORIES) {
    for (const q of cat.questions) {
      const a = getAnswer(cat.id, q.id)
      if (a.typed?.trim()) openJustifications.add(`q:${cat.id}:${q.id}`)
      for (const idx of (a.ticked ?? [])) openJustifications.add(`s:${cat.id}:${q.id}:${idx}`)
    }
  }
})

// ── Selection mode picker ─────────────────────────────────────────────────────
const SELECTION_MODES: Array<{ id: 'mixed' | 'all' | 'typed-only' | 'ticked-only'; label: string; title: string }> = [
  { id: 'mixed',       label: 'Mixed (default)', title: 'Typed answer + only TICKED suggestions (default — Tom 2026-06-03).' },
  { id: 'all',         label: 'All',              title: 'Typed answer + ALL suggestions (ignores ticked state).' },
  { id: 'typed-only',  label: 'My answer only',   title: 'Just the typed answer; suggestions excluded.' },
  { id: 'ticked-only', label: 'Ticked only',      title: 'Just the ticked suggestions; typed answer excluded.' },
]

// ── Category navigation ───────────────────────────────────────────────────────
const activeCategoryId = ref<string>(EVO_SHARP_CATEGORIES[0]?.id ?? '')

const activeCategory = computed<SharpCategory | undefined>(() =>
  EVO_SHARP_CATEGORIES.find(c => c.id === activeCategoryId.value),
)

const activeCategoryIndex = computed<number>(() =>
  EVO_SHARP_CATEGORIES.findIndex(c => c.id === activeCategoryId.value),
)

function nextCategory(): void {
  const idx = activeCategoryIndex.value
  if (idx >= 0 && idx < EVO_SHARP_CATEGORIES.length - 1)
    activeCategoryId.value = EVO_SHARP_CATEGORIES[idx + 1].id
}
function prevCategory(): void {
  const idx = activeCategoryIndex.value
  if (idx > 0) activeCategoryId.value = EVO_SHARP_CATEGORIES[idx - 1].id
}

// ── Progress ──────────────────────────────────────────────────────────────────
const totalQuestions = totalQuestionCount()
const _allCats = EVO_SHARP_CATEGORIES
const progressPercent = computed<number>(() =>
  totalQuestions === 0 ? 0 : Math.round((answeredCount(_allCats) / totalQuestions) * 100),
)
const totalAnsweredCount = computed<number>(() => answeredCount(_allCats))

// ── Done Sharpening — Change Review ─────────────────────────────────────────
interface EvoProposedChange {
  key:           string   // `${categoryId}:${qId}`
  categoryId:    string
  categoryLabel: string
  qId:           string
  questionText:  string
  effectiveText: string
  approved:      boolean
}

const showChanges     = ref(false)
const proposedChanges = ref<EvoProposedChange[]>([])
const liveChanges     = ref<EvoProposedChange[]>([])

function buildProposedChanges(): EvoProposedChange[] {
  const result: EvoProposedChange[] = []
  for (const cat of EVO_SHARP_CATEGORIES) {
    for (const q of cat.questions) {
      const eff = getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? [])
      if (!eff.trim()) continue
      result.push({
        key:           `${cat.id}:${q.id}`,
        categoryId:    cat.id,
        categoryLabel: cat.label,
        qId:           q.id,
        questionText:  q.text,
        effectiveText: eff,
        approved:      true,
      })
    }
  }
  return result
}

const approvedCount = computed(() => proposedChanges.value.filter(c => c.approved).length)

function onDoneSharpening(): void {
  const built         = buildProposedChanges()
  proposedChanges.value = built
  liveChanges.value   = [...built]
  activeVersionId.value = null
  changeView.value    = 'review'
  showChanges.value   = true
}

function onApproveAll():  void { displayedChanges.value.forEach(c => { c.approved = true  }); if (activeVersionId.value !== null) persistVersions() }
function onRejectAll():   void { displayedChanges.value.forEach(c => { c.approved = false }); if (activeVersionId.value !== null) persistVersions() }

// ── Version History & Governance ─────────────────────────────────────────────
interface EvoSharpeningVersion {
  id:       string
  label:    string
  savedAt:  string
  stepName: string
  changes:  EvoProposedChange[]
  status:   'draft' | 'integrated'
}

const VER_KEY = computed(() => `evo-sharp-versions:${props.planId ?? 'default'}:${selectedStepName.value}`)

const savedVersions   = ref<EvoSharpeningVersion[]>([])
const activeVersionId = ref<string | null>(null)
const changeView      = ref<'review' | 'history' | 'compare'>('review')
const compareIds      = ref<[string | null, string | null]>([null, null])
const editingVerId    = ref<string | null>(null)
const editingVerLabel = ref('')

onMounted(loadSavedVersions)
watch(selectedStepName, loadSavedVersions)

function loadSavedVersions(): void {
  try {
    const raw = localStorage.getItem(VER_KEY.value)
    savedVersions.value = raw ? (JSON.parse(raw) as EvoSharpeningVersion[]) : []
  } catch { savedVersions.value = [] }
}

function persistVersions(): void {
  try { localStorage.setItem(VER_KEY.value, JSON.stringify(savedVersions.value)) } catch { /* ignore */ }
}

const displayedChanges = computed<EvoProposedChange[]>(() =>
  activeVersionId.value === null
    ? proposedChanges.value
    : (savedVersions.value.find(v => v.id === activeVersionId.value)?.changes ?? []),
)

const activeVersion = computed<EvoSharpeningVersion | null>(() =>
  activeVersionId.value ? (savedVersions.value.find(v => v.id === activeVersionId.value) ?? null) : null,
)

const displayedApprovedCount = computed(() => displayedChanges.value.filter(c => c.approved).length)

function toggleDisplayedChange(c: EvoProposedChange): void {
  c.approved = !c.approved
  if (activeVersionId.value !== null) persistVersions()
}

function saveCurrentVersion(): void {
  const { showToast } = useToast()
  const source = displayedChanges.value
  if (source.length === 0) { showToast('No proposed changes yet — complete the interview first', 3500); return }
  const now   = new Date()
  const label = `Session ${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
  const ver: EvoSharpeningVersion = {
    id: `v-${now.getTime()}`, label, savedAt: now.toISOString(),
    stepName: selectedStepName.value,
    changes: JSON.parse(JSON.stringify(source)) as EvoProposedChange[],
    status: 'draft',
  }
  savedVersions.value.unshift(ver)
  persistVersions()
  showToast(`✓ Saved "${label}" — ${ver.changes.length} proposed changes`, 5000)
}

function restoreVersion(id: string): void {
  if (activeVersionId.value === null) liveChanges.value = [...proposedChanges.value]
  activeVersionId.value = id
  changeView.value = 'review'
}
function returnToLiveSession(): void {
  if (liveChanges.value.length > 0) proposedChanges.value = liveChanges.value
  activeVersionId.value = null
}
function deleteVersion(id: string): void {
  if (!confirm('Delete this saved version? This cannot be undone.')) return
  savedVersions.value = savedVersions.value.filter(v => v.id !== id)
  persistVersions()
  if (activeVersionId.value === id) returnToLiveSession()
}
function startRenameVersion(v: EvoSharpeningVersion): void { editingVerId.value = v.id; editingVerLabel.value = v.label }
function commitRenameVersion(): void {
  const v = savedVersions.value.find(x => x.id === editingVerId.value)
  if (v && editingVerLabel.value.trim()) { v.label = editingVerLabel.value.trim(); persistVersions() }
  editingVerId.value = null; editingVerLabel.value = ''
}
function cancelRenameVersion(): void { editingVerId.value = null; editingVerLabel.value = '' }

function openCompare(a: string | null, b: string | null): void {
  compareIds.value = [a, b]; changeView.value = 'compare'
}

function changesFor(id: string | null): EvoProposedChange[] {
  if (id === null) return liveChanges.value.length > 0 ? liveChanges.value : proposedChanges.value
  return savedVersions.value.find(v => v.id === id)?.changes ?? []
}
function versionLabel(id: string | null): string {
  if (id === null) return 'Live Session'
  return savedVersions.value.find(v => v.id === id)?.label ?? 'Unknown'
}

interface CompareSlot {
  key:          string
  categoryLabel: string
  questionText: string
  left:         EvoProposedChange | undefined
  right:        EvoProposedChange | undefined
}

const compareSlots = computed<CompareSlot[]>(() => {
  const aList = changesFor(compareIds.value[0])
  const bList = changesFor(compareIds.value[1])
  const aMap  = new Map(aList.map(c => [c.key, c]))
  const bMap  = new Map(bList.map(c => [c.key, c]))
  const keys  = new Set([...aMap.keys(), ...bMap.keys()])
  return [...keys].map(key => {
    const sample = (aMap.get(key) ?? bMap.get(key))!
    return { key, categoryLabel: sample.categoryLabel, questionText: sample.questionText, left: aMap.get(key), right: bMap.get(key) }
  })
})

// ── Colourful HTML builders ───────────────────────────────────────────────────
// Amber/orange theme matching the Evo Steps gradient.
// Flat-table format (Colorful HTML Spec Email Rule, SUPREME).

function buildChangesHtml(approved: EvoProposedChange[]): string {
  const stepName = selectedStep.value?.name ?? selectedStepName.value
  const dateStr  = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  // Group by category
  const catMap = new Map<string, { label: string; items: EvoProposedChange[] }>()
  for (const c of approved) {
    if (!catMap.has(c.categoryId)) catMap.set(c.categoryId, { label: c.categoryLabel, items: [] })
    catMap.get(c.categoryId)!.items.push(c)
  }

  let body = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#d97706" style="background:#d97706;color:#fffbeb;padding:14px 22px;font:700 15px/1.3 'Helvetica Neue',Arial,sans-serif;">Evo Step Sharpening — Proposed Changes</td></tr>
  <tr><td bgcolor="#f59e0b" style="background:#f59e0b;color:#78350f;padding:6px 22px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(stepName)} &nbsp;·&nbsp; ${htmlEsc(dateStr)} &nbsp;·&nbsp; ${approved.length} change${approved.length === 1 ? '' : 's'} approved</td></tr>
</table>`

  for (const [, { label, items }] of catMap) {
    body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;">
  <tr><td bgcolor="#92400e" style="background:#92400e;color:#fef3c7;padding:7px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.07em;text-transform:uppercase;">${htmlEsc(label)} &nbsp;(${items.length})</td></tr>
</table>`
    for (const item of items) {
      body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border-left:4px solid #f59e0b;">
  <tr>
    <td bgcolor="#fef3c7" style="background:#fef3c7;color:#92400e;padding:5px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;width:120px;vertical-align:top;">Evo Sharp</td>
    <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;padding:5px 14px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">${htmlEsc(item.questionText)}</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">Answer</td>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#1e293b;padding:8px 14px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;white-space:normal;">${htmlEsc(item.effectiveText)}</td>
  </tr>
</table>`
    }
    body += `\n<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;border-collapse:collapse;"><tr><td bgcolor="#e2e8f0" style="background:#e2e8f0;height:2px;font-size:0;line-height:0;"></td></tr></table>`
  }

  return htmlDocumentShell({ title: `Evo Step Sharpening Changes · ${stepName}`, bodyHtml: body })
}

function buildChangesPlain(approved: EvoProposedChange[]): string {
  const stepName = selectedStep.value?.name ?? selectedStepName.value
  const SEP = '─'.repeat(56)
  const lines: string[] = [
    'EVO STEP SHARPENING — PROPOSED CHANGES',
    `Step: ${stepName}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `${approved.length} change${approved.length === 1 ? '' : 's'} approved`,
    '', SEP, '',
  ]
  const catMap = new Map<string, { label: string; items: EvoProposedChange[] }>()
  for (const c of approved) {
    if (!catMap.has(c.categoryId)) catMap.set(c.categoryId, { label: c.categoryLabel, items: [] })
    catMap.get(c.categoryId)!.items.push(c)
  }
  for (const [, { label, items }] of catMap) {
    lines.push(`== ${label.toUpperCase()} ==`, '')
    for (const item of items) {
      lines.push(`Q: ${item.questionText}`, '', item.effectiveText, '', SEP, '')
    }
  }
  return lines.join('\n')
}

async function onIntegrateChanges(): Promise<void> {
  const { showToast } = useToast()
  const approved = displayedChanges.value.filter(c => c.approved)
  if (approved.length === 0) { showToast('No changes approved — tick at least one to integrate', 3500); return }
  const stepName = selectedStep.value?.name ?? selectedStepName.value
  await exportEmail(
    buildChangesHtml(approved),
    `Evo Step Sharpening Changes · ${stepName}`,
    `${approved.length} Sharpening Change${approved.length === 1 ? '' : 's'} HTML`,
    'Tom@Gilb.com',
    buildChangesPlain(approved),
  )
  showToast(`✓ ${approved.length} change${approved.length === 1 ? '' : 's'} sent to Mail — paste into Spec Editor to apply`, 6000)
}

async function approveVersionToMaster(ver: EvoSharpeningVersion): Promise<void> {
  const { showToast } = useToast()
  const approved = ver.changes.filter(c => c.approved)
  if (approved.length === 0) { showToast('No approved changes in this version', 3500); return }
  await exportEmail(
    buildChangesHtml(approved),
    `Evo Step Sharpening Changes · ${ver.stepName}`,
    `${approved.length} Changes from "${ver.label}"`,
    'Tom@Gilb.com',
    buildChangesPlain(approved),
  )
  const v = savedVersions.value.find(x => x.id === ver.id)
  if (v) { v.status = 'integrated'; persistVersions() }
  showToast(`✓ ${approved.length} changes from "${ver.label}" sent to Mail`, 6000)
}

async function copyVersionHtml(ver: EvoSharpeningVersion): Promise<void> {
  const { showToast } = useToast()
  const approved = ver.changes.filter(c => c.approved)
  const ok = await exportCopy(buildChangesHtml(approved), buildChangesPlain(approved))
  showToast(ok ? `✓ "${ver.label}" HTML copied — ⌘V to paste` : 'Copy failed — try again', 4000)
}

// ── Full interview export (all answered questions, grouped by category) ───────
function buildSharpeningHtml(): string {
  const stepName = selectedStep.value?.name ?? selectedStepName.value
  const dateStr  = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const answeredCats = EVO_SHARP_CATEGORIES.filter(cat =>
    cat.questions.some(q => getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? []).trim()),
  )

  let body = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;border-collapse:collapse;">
  <tr><td bgcolor="#d97706" style="background:#d97706;color:#fffbeb;padding:14px 22px;font:700 15px/1.3 'Helvetica Neue',Arial,sans-serif;">Evo Step Sharpening Interview</td></tr>
  <tr><td bgcolor="#f59e0b" style="background:#f59e0b;color:#78350f;padding:6px 22px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(stepName)} &nbsp;·&nbsp; ${htmlEsc(dateStr)} &nbsp;·&nbsp; ${answeredCats.length} of ${EVO_SHARP_CATEGORIES.length} categories answered</td></tr>
</table>`

  if (answeredCats.length === 0) {
    body += `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;border-collapse:collapse;"><tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#92400e;padding:14px 22px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;font-style:italic;">(No answers recorded yet.)</td></tr></table>`
    return htmlDocumentShell({ title: `Evo Step Sharpening · ${stepName}`, bodyHtml: body })
  }

  for (const cat of answeredCats) {
    const answeredQs = cat.questions
      .map(q => ({ q, eff: getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? []) }))
      .filter(x => x.eff.trim())
    if (answeredQs.length === 0) continue

    body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;">
  <tr><td bgcolor="#92400e" style="background:#92400e;color:#fef3c7;padding:8px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">${htmlEsc(cat.label)}</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:5px 18px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;font-style:italic;">${htmlEsc(cat.description)}</td></tr>
</table>`

    for (const { q, eff } of answeredQs) {
      const ans = getAnswer(cat.id, q.id)
      body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;border-left:4px solid #f59e0b;">
  <tr>
    <td bgcolor="#fef9c3" style="background:#fef9c3;color:#713f12;padding:5px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;width:110px;vertical-align:top;">Question</td>
    <td bgcolor="#fef9c3" style="background:#fef9c3;color:#713f12;padding:5px 14px;font:600 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(q.text)}</td>
  </tr>${q.rationale ? `
  <tr>
    <td bgcolor="#f8fafc" style="background:#f8fafc;color:#64748b;padding:4px 12px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;font-style:italic;">Rationale</td>
    <td bgcolor="#f8fafc" style="background:#f8fafc;color:#64748b;padding:4px 14px;font:400 9px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(q.rationale)}</td>
  </tr>` : ''}
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">Answer</td>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#1e293b;padding:8px 14px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;white-space:normal;">${htmlEsc(eff)}</td>
  </tr>${ans.because?.trim() || ans.sources?.trim() ? `
  <tr>
    <td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#3730a3;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">[?!"]<br>Justification</td>
    <td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:6px 14px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">${ans.because?.trim() ? `<b>Because [!]:</b> ${htmlEsc(ans.because.trim())}<br>` : ''}${ans.sources?.trim() ? `<b>Sources ["]:</b> ${htmlEsc(ans.sources.trim())}` : ''}</td>
  </tr>` : ''}
</table>`
    }
    body += `\n<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;border-collapse:collapse;"><tr><td bgcolor="#e2e8f0" style="background:#e2e8f0;height:2px;font-size:0;line-height:0;"></td></tr></table>`
  }

  return htmlDocumentShell({ title: `Evo Step Sharpening · ${stepName}`, bodyHtml: body })
}

function buildSharpeningPlain(): string {
  const stepName = selectedStep.value?.name ?? selectedStepName.value
  const SEP = '─'.repeat(56)
  const answeredCats = EVO_SHARP_CATEGORIES.filter(cat =>
    cat.questions.some(q => getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? []).trim()),
  )
  const lines: string[] = [
    'EVO STEP SHARPENING INTERVIEW',
    `Step: ${stepName}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Categories answered: ${answeredCats.length} of ${EVO_SHARP_CATEGORIES.length}`,
    '', SEP, '',
  ]
  for (const cat of answeredCats) {
    lines.push(`== ${cat.label.toUpperCase()} ==`, `   ${cat.description}`, '')
    for (const q of cat.questions) {
      const eff = getEffectiveAnswer(cat.id, q.id, q.suggestedAnswers ?? [])
      if (!eff.trim()) continue
      const ans = getAnswer(cat.id, q.id)
      lines.push(`Q: ${q.text}`, '', eff)
      if (ans.because?.trim() || ans.sources?.trim()) {
        lines.push('', 'Justification:')
        if (ans.because?.trim()) lines.push(`  Because: ${ans.because.trim()}`)
        if (ans.sources?.trim()) lines.push(`  Sources: ${ans.sources.trim()}`)
      }
      lines.push('')
    }
    lines.push(SEP, '')
  }
  if (answeredCats.length === 0) lines.push('(No answers recorded yet.)')
  return lines.join('\n')
}

async function onExportEmail(): Promise<void> {
  const stepName = selectedStep.value?.name ?? selectedStepName.value
  await exportEmail(buildSharpeningHtml(), `Evo Step Sharpening · ${stepName}`, 'Evo Step Sharpening colourful HTML', 'Tom@Gilb.com', buildSharpeningPlain())
}
async function onExportCopy(): Promise<void> {
  const { showToast } = useToast()
  const ok = await exportCopy(buildSharpeningHtml(), buildSharpeningPlain())
  showToast(ok ? '⬇ Colourful HTML copied — paste with ⌘V anywhere' : 'Copy failed — try again', 4000)
}
function onExportDownload(): void {
  const stepName = (selectedStep.value?.name ?? 'Evo-Step').replace(/[^a-zA-Z0-9]+/g, '-')
  exportDownload(buildSharpeningHtml(), `Evo-Sharpening-${stepName}-${new Date().toISOString().slice(0, 10)}`)
}

function onClearConfirm(): void {
  if (confirm(`Clear ALL answers for "${selectedStepName.value}"? This cannot be undone.`)) clear()
}

// Suppress unused variable warning — approvedCount is referenced in template
void approvedCount
</script>

<template>
  <Teleport to="body">
    <!--
      Safari scroll fix: fixed inset-0 backdrop + absolute inset-y-4 inner panel.
      This gives ScrollContainer children a definite height so overflow triggers correctly.
      Same pattern as SolutionSharpenPanel (fixed r06 Safari bug 2026-06-07).
    -->
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evo-sharp-title"
      @click.self="$emit('close')"
    >
      <div class="absolute inset-y-4 left-4 right-4 sm:inset-y-8 sm:left-8 sm:right-8
                  max-w-6xl mx-auto rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex-shrink-0">
          <PlEvoStepIcon size="md" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="evo-sharp-title" class="text-base font-bold leading-tight">Sharpen Next Step</h2>
            <p class="text-[11px] text-amber-50 mt-0.5">
              Evo Sharp Interview · {{ totalAnsweredCount }} of {{ totalQuestions }} answered ({{ progressPercent }}%)
              · {{ EVO_SHARP_CATEGORIES.length }} categories · Default mode: <span class="font-bold">Mixed</span>
            </p>
          </div>
          <label class="flex items-center gap-2 text-xs text-amber-50 flex-shrink-0">
            <span class="font-semibold">Step:</span>
            <select
              v-model="selectedStepName"
              class="text-sm text-slate-900 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 max-w-[260px]"
              :title="`Pick which Evo Step to sharpen. Answers persist per step.`"
              aria-label="Select Evo Step to sharpen"
            >
              <option v-for="step in steps" :key="step.name" :value="step.name">{{ step.name }}</option>
            </select>
          </label>
          <CloseDot title="Close Sharpen Next Step — answers are auto-saved" @click="$emit('close')" />
        </header>

        <!-- Progress bar -->
        <div class="h-1.5 bg-slate-100 flex-shrink-0">
          <div
            class="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-300"
            :style="{ width: progressPercent + '%' }"
            role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100"
            :aria-label="`Interview progress ${progressPercent}%`"
          />
        </div>

        <!-- ── INTERVIEW BODY ──────────────────────────────────────────────────── -->
        <div v-if="!showChanges" class="flex-1 flex min-h-0">

          <!-- Sidebar — category list -->
          <div class="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
            <div class="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0 bg-slate-100/60">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">{{ EVO_SHARP_CATEGORIES.length }} Categories</span>
              <span class="text-[9px] text-slate-400 font-mono">{{ EVO_SHARP_CATEGORIES.filter(c => answeredInCategory(c.id, c.questions) > 0).length }}/{{ EVO_SHARP_CATEGORIES.length }} explored</span>
            </div>
            <ScrollContainer class="flex-1 min-h-0 relative" inner-class="p-2 space-y-0.5">
              <button
                v-for="cat in EVO_SHARP_CATEGORIES"
                :key="cat.id"
                type="button"
                class="w-full text-left rounded-lg px-3 py-2 transition-colors group"
                :class="cat.id === activeCategoryId ? 'bg-white shadow-sm ring-1 ring-amber-200' : 'hover:bg-white/70'"
                :title="`${cat.label} — ${cat.description}. ${answeredInCategory(cat.id, cat.questions)} of ${cat.questions.length} answered.`"
                @click="activeCategoryId = cat.id"
              >
                <div class="flex items-center gap-2 mb-0.5">
                  <div class="w-1 h-3.5 rounded-full flex-shrink-0" :class="cat.accent" aria-hidden="true" />
                  <span class="text-[12px] font-semibold text-slate-800 leading-tight flex-1 min-w-0 truncate">{{ cat.label }}</span>
                  <span
                    class="text-[9px] font-mono px-1 py-px rounded flex-shrink-0"
                    :class="answeredInCategory(cat.id, cat.questions) === cat.questions.length
                      ? 'bg-emerald-100 text-emerald-700'
                      : answeredInCategory(cat.id, cat.questions) > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-400'"
                  >{{ answeredInCategory(cat.id, cat.questions) }}/{{ cat.questions.length }}</span>
                </div>
                <p class="text-[10px] text-slate-500 leading-snug ml-3 truncate group-hover:text-slate-600">{{ cat.description }}</p>
                <span
                  v-if="cat.proposed"
                  class="inline-block text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 mt-1 ml-3 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                >Proposed</span>
              </button>
            </ScrollContainer>
          </div>

          <!-- Main pane — questions for active category -->
          <div class="flex-1 flex flex-col min-h-0">
            <ScrollContainer class="flex-1 min-h-0 relative" inner-class="p-6 space-y-5">
              <div v-if="!selectedStep" class="text-center text-slate-500 py-12">
                <p>No Evo Step selected — pick one from the dropdown above, or generate an Evo plan first.</p>
              </div>

              <template v-else-if="activeCategory">
                <!-- Category header -->
                <div class="border-b border-slate-200 pb-3">
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-1.5 h-5 rounded-full flex-shrink-0" :class="activeCategory.accent" aria-hidden="true" />
                    <h3 class="text-base font-bold text-slate-800">{{ activeCategory.label }}</h3>
                    <span
                      v-if="activeCategory.proposed"
                      class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"
                    >Proposed</span>
                  </div>
                  <p class="text-xs text-slate-600 ml-[18px]">{{ activeCategory.description }}</p>
                  <p class="text-[11px] text-slate-500 mt-1 ml-[18px]">
                    Sharpening: <span class="font-mono text-slate-700">{{ selectedStep.name }}</span>
                  </p>
                  <!-- Category navigation (DD-014: top nav mirror) -->
                  <div class="flex items-center gap-2 mt-3 ml-[18px]">
                    <button
                      type="button"
                      class="text-[10px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-600
                             hover:bg-slate-100 hover:border-slate-400 transition-colors disabled:opacity-30"
                      :disabled="activeCategoryIndex === 0"
                      :title="`Previous category: ${EVO_SHARP_CATEGORIES[activeCategoryIndex - 1]?.label ?? ''}`"
                      @click="prevCategory"
                    >← Previous category</button>
                    <span class="text-[10px] text-slate-400 font-mono">{{ activeCategoryIndex + 1 }} / {{ EVO_SHARP_CATEGORIES.length }}</span>
                    <button
                      type="button"
                      class="text-[10px] px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700
                             hover:bg-amber-100 hover:border-amber-400 transition-colors disabled:opacity-30"
                      :disabled="activeCategoryIndex === EVO_SHARP_CATEGORIES.length - 1"
                      :title="`Next category: ${EVO_SHARP_CATEGORIES[activeCategoryIndex + 1]?.label ?? ''}`"
                      @click="nextCategory"
                    >Next category →</button>
                  </div>
                </div>

                <!-- Questions loop -->
                <div
                  v-for="q in activeCategory.questions"
                  :key="q.id"
                  class="space-y-2 pb-4 border-b border-slate-100 last:border-b-0"
                >
                  <!-- Question + [?!"] pin -->
                  <div class="flex items-start gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-slate-800 flex-1 leading-snug">{{ q.text }}</span>
                    <JustificationGlyph
                      :open="isJustOpen(`q:${activeCategory.id}:${q.id}`)"
                      @toggle="toggleJustification(`q:${activeCategory.id}:${q.id}`)"
                    />
                  </div>

                  <!-- Q&A Justification block for question -->
                  <div
                    v-if="isJustOpen(`q:${activeCategory.id}:${q.id}`)"
                    class="rounded-lg bg-indigo-50/70 border border-indigo-200 px-3 py-2 space-y-1"
                  >
                    <p class="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1">[?!"] Q&amp;A Justification</p>
                    <p v-if="q.rationale" class="text-[10px] text-slate-700 leading-snug line-clamp-2" :title="q.rationale">
                      <span class="font-bold text-slate-800">Analysis [!]:</span> {{ q.rationale }}
                    </p>
                    <p class="text-[10px] text-slate-500 leading-snug line-clamp-2" :title="activeCategory.description">
                      <span class="font-bold text-slate-600">Source [&quot;]:</span> {{ activeCategory.description }}
                    </p>
                  </div>

                  <!-- Planner's typed answer + [?!"] pin for justification -->
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-amber-700 flex-1">Planner's answer (yours)</p>
                      <JustificationGlyph
                        :open="isJustOpen(`bc:${activeCategory.id}:${q.id}`)"
                        @toggle="toggleJustification(`bc:${activeCategory.id}:${q.id}`)"
                      />
                      <span class="text-[9px] text-slate-400 italic">add your justification</span>
                    </div>
                    <textarea
                      :value="getAnswer(activeCategory.id, q.id).typed"
                      :placeholder="q.placeholder ?? 'Your answer…'"
                      rows="2"
                      class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800
                             placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
                             transition-colors resize-y"
                      :aria-label="`Your answer to: ${q.text}`"
                      @input="(e) => { setTypedAnswer(activeCategory!.id, q.id, (e.target as HTMLTextAreaElement).value); if ((e.target as HTMLTextAreaElement).value.trim()) autoOpenQuestionJust(activeCategory!.id, q.id) }"
                    />
                    <!-- Planner's Because/Sources — behind [?!"] pin -->
                    <div
                      v-if="isJustOpen(`bc:${activeCategory.id}:${q.id}`)"
                      class="mt-1.5 space-y-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2"
                    >
                      <p class="text-[9px] font-bold uppercase tracking-wider text-indigo-500">Planguage Justification — your [!] Because + [&quot;] Sources</p>
                      <div>
                        <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Because [!]: why you wrote this answer</p>
                        <textarea
                          :value="getAnswer(activeCategory.id, q.id).because ?? ''"
                          placeholder="Because: your reasoning for this answer…"
                          rows="2"
                          class="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700
                                 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors resize-y"
                          :aria-label="`Because: justification for your answer to: ${q.text}`"
                          @input="(e) => setPlannerBecause(activeCategory!.id, q.id, (e.target as HTMLTextAreaElement).value)"
                        />
                      </div>
                      <div>
                        <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Sources [&quot;]: your references</p>
                        <input
                          type="text"
                          :value="getAnswer(activeCategory.id, q.id).sources ?? ''"
                          placeholder="Sources: books, URLs, case studies…"
                          class="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700
                                 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
                          :aria-label="`Sources: references for your answer to: ${q.text}`"
                          @input="(e) => setPlannerSources(activeCategory!.id, q.id, (e.target as HTMLInputElement).value)"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- AI-suggested answers (only if suggestedAnswers present) -->
                  <div v-if="q.suggestedAnswers && q.suggestedAnswers.length > 0" class="space-y-1.5">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-0.5">
                      Suggested answers — tick any to approve
                      <span class="font-normal text-slate-400 normal-case">([?!"] to show justification)</span>
                    </p>
                    <div
                      v-for="(sugg, idx) in q.suggestedAnswers"
                      :key="idx"
                      class="rounded-lg border bg-white transition-colors"
                      :class="isTicked(activeCategory.id, q.id, idx) ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'"
                    >
                      <!-- Suggestion row -->
                      <label
                        class="flex items-start gap-2 px-3 py-2 cursor-pointer"
                        :title="`Suggestion ${idx + 1} — click to ${isTicked(activeCategory.id, q.id, idx) ? 'remove from' : 'add to'} effective answer`"
                      >
                        <input
                          type="checkbox"
                          :checked="isTicked(activeCategory.id, q.id, idx)"
                          class="mt-0.5 flex-shrink-0 accent-indigo-600 cursor-pointer"
                          :aria-label="`Tick suggestion ${idx + 1} for: ${q.text}`"
                          @change="() => { toggleTicked(activeCategory!.id, q.id, idx); autoOpenSuggJust(activeCategory!.id, q.id, idx) }"
                        />
                        <span class="text-xs text-slate-700 leading-snug flex-1">
                          <span class="text-[9px] font-mono font-bold text-indigo-500 mr-1">#{{ idx + 1 }}</span>{{ sugg }}
                        </span>
                        <SourceBadge
                          class="flex-shrink-0 mt-0.5"
                          :provenance="(q.suggestedAnswerProvenances?.[idx] as SourceProvenance | undefined) ?? { source: 'template' }"
                          size="compact"
                        />
                        <JustificationGlyph
                          class="flex-shrink-0 self-start"
                          :open="isJustOpen(`s:${activeCategory.id}:${q.id}:${idx}`)"
                          @click.stop="toggleJustification(`s:${activeCategory.id}:${q.id}:${idx}`)"
                        />
                      </label>

                      <!-- Suggestion justification block -->
                      <div
                        v-if="isJustOpen(`s:${activeCategory.id}:${q.id}:${idx}`)"
                        class="px-3 pb-2 pt-1.5 border-t border-slate-100 bg-slate-50/60 rounded-b-lg space-y-1.5"
                      >
                        <p v-if="q.rationale" class="text-[10px] text-slate-600 leading-snug line-clamp-2" :title="q.rationale">
                          <span class="font-bold text-slate-700">Analysis [!]:</span> {{ q.rationale }}
                        </p>
                        <p class="text-[10px] text-slate-500 leading-snug line-clamp-2" :title="activeCategory.description">
                          <span class="font-bold text-slate-600">Source [&quot;]:</span> {{ activeCategory.description }}
                        </p>
                        <!-- Planner's per-suggestion Because/Sources — shown when ticked -->
                        <template v-if="isTicked(activeCategory.id, q.id, idx)">
                          <div class="border-t border-indigo-100 pt-1.5 space-y-1">
                            <p class="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">Your justification for approving this</p>
                            <div>
                              <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Because [!]: why you approved this</p>
                              <textarea
                                :value="getAnswer(activeCategory.id, q.id).suggBecause?.[idx] ?? ''"
                                placeholder="Optional: your reasoning for approving this suggestion…"
                                rows="2"
                                class="w-full rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700
                                       placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors resize-y"
                                :aria-label="`Because: why you approved suggestion ${idx + 1}`"
                                @input="(e) => setSuggBecause(activeCategory!.id, q.id, idx, (e.target as HTMLTextAreaElement).value)"
                              />
                            </div>
                            <div>
                              <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Sources [&quot;]: your references</p>
                              <input
                                type="text"
                                :value="getAnswer(activeCategory.id, q.id).suggSources?.[idx] ?? ''"
                                placeholder="Optional: books, URLs, case studies…"
                                class="w-full rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700
                                       placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-colors"
                                :aria-label="`Sources: references for approving suggestion ${idx + 1}`"
                                @input="(e) => setSuggSources(activeCategory!.id, q.id, idx, (e.target as HTMLInputElement).value)"
                              />
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>

                  <!-- Selection mode picker -->
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1">Use:</span>
                    <button
                      v-for="m in SELECTION_MODES"
                      :key="m.id"
                      type="button"
                      class="text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors"
                      :class="getAnswer(activeCategory.id, q.id).mode === m.id
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'"
                      :title="m.title"
                      @click="setMode(activeCategory!.id, q.id, m.id)"
                    >{{ m.label }}</button>
                  </div>

                  <!-- Effective answer preview -->
                  <div class="rounded-lg bg-emerald-50/60 border border-emerald-200 px-2.5 py-1.5">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">
                      Effective answer (what will export)
                    </p>
                    <p
                      v-if="getEffectiveAnswer(activeCategory.id, q.id, q.suggestedAnswers ?? []).trim().length > 0"
                      class="text-[11px] text-slate-800 whitespace-pre-wrap leading-snug"
                    >{{ getEffectiveAnswer(activeCategory.id, q.id, q.suggestedAnswers ?? []) }}</p>
                    <p v-else class="text-[11px] text-slate-400 italic">(empty — type an answer or tick a suggestion)</p>
                  </div>

                </div><!-- end question -->

                <!-- Bottom navigation mirror (DD-014) -->
                <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 flex-wrap">
                  <button
                    type="button"
                    class="text-sm px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-600
                           hover:bg-slate-100 hover:border-slate-400 transition-colors disabled:opacity-30"
                    :disabled="activeCategoryIndex === 0"
                    :title="`Previous category: ${EVO_SHARP_CATEGORIES[activeCategoryIndex - 1]?.label ?? ''}`"
                    @click="prevCategory"
                  >← Previous category</button>
                  <span class="text-xs text-slate-400 font-mono">
                    Category {{ activeCategoryIndex + 1 }} / {{ EVO_SHARP_CATEGORIES.length }} · {{ totalAnsweredCount }} answered
                  </span>
                  <button
                    type="button"
                    class="text-sm px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700
                           hover:bg-amber-100 hover:border-amber-400 transition-colors font-semibold disabled:opacity-30"
                    :disabled="activeCategoryIndex === EVO_SHARP_CATEGORIES.length - 1"
                    :title="`Next category: ${EVO_SHARP_CATEGORIES[activeCategoryIndex + 1]?.label ?? ''}`"
                    @click="nextCategory"
                  >Next category →</button>
                </div>

              </template>
            </ScrollContainer>
          </div><!-- end main pane -->

        </div><!-- end interview body -->

        <!-- ── CHANGE REVIEW PANEL ─────────────────────────────────────────────── -->
        <div v-else class="flex-1 flex flex-col min-h-0">

          <!-- Sub-header Row 1 — title + bulk controls -->
          <div class="flex items-center gap-3 px-5 py-2.5 bg-slate-800 text-white flex-shrink-0">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-white leading-tight">
                <template v-if="changeView === 'history'">Version History
                  <span class="text-slate-400 font-normal text-xs ml-1">({{ savedVersions.length }} saved)</span>
                </template>
                <template v-else-if="changeView === 'compare'">Compare Versions</template>
                <template v-else>
                  {{ activeVersionId ? (activeVersion?.label ?? '') + ' — Review' : 'Proposed Changes — Seek Approval' }}
                </template>
              </h3>
              <p v-if="changeView === 'review'" class="text-[11px] text-slate-300 mt-0.5">
                {{ displayedChanges.length }} change{{ displayedChanges.length === 1 ? '' : 's' }}
                · <span class="font-bold text-emerald-300">{{ displayedApprovedCount }}</span> approved
                <template v-if="activeVersionId"> · <span class="text-amber-300 font-semibold">Saved version — edits persist to this version</span></template>
                <template v-else> · untick any row to reject before integrating</template>
              </p>
            </div>
            <div v-if="changeView === 'review'" class="flex items-center gap-2 flex-shrink-0">
              <button type="button"
                class="text-[11px] px-2.5 py-1 rounded-lg border border-emerald-400 bg-emerald-800/60 text-emerald-200 hover:bg-emerald-700/60 transition-colors font-semibold"
                title="Approve all displayed changes" @click="onApproveAll">✓ Approve All</button>
              <button type="button"
                class="text-[11px] px-2.5 py-1 rounded-lg border border-slate-500 bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 transition-colors"
                title="Reject all displayed changes" @click="onRejectAll">✕ Reject All</button>
            </div>
          </div>

          <!-- Row 2 — tab strip -->
          <div class="flex items-center gap-0 px-5 bg-slate-700 flex-shrink-0 border-b border-slate-600">
            <button type="button"
              class="text-[11px] px-4 py-2 font-semibold transition-colors border-b-2"
              :class="changeView === 'review' ? 'text-white border-emerald-400' : 'text-slate-400 border-transparent hover:text-slate-200'"
              title="Review proposed changes" @click="changeView = 'review'">✓ Review Changes</button>
            <button type="button"
              class="text-[11px] px-4 py-2 font-semibold transition-colors border-b-2"
              :class="changeView === 'history' ? 'text-white border-indigo-400' : 'text-slate-400 border-transparent hover:text-slate-200'"
              title="Saved versions — restore, compare, or approve to Master Plan" @click="changeView = 'history'">💾 Past Versions ({{ savedVersions.length }})</button>
            <button type="button"
              class="text-[11px] px-4 py-2 font-semibold transition-colors border-b-2"
              :class="changeView === 'compare' ? 'text-white border-sky-400' : 'text-slate-400 border-transparent hover:text-slate-200'"
              title="Compare two versions side-by-side" @click="changeView = 'compare'">⇄ Compare</button>
          </div>

          <!-- TAB: Review Changes -->
          <template v-if="changeView === 'review'">
            <div v-if="activeVersionId" class="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
              <span class="text-[11px] text-amber-800 font-semibold">Viewing saved version: <b>{{ activeVersion?.label }}</b></span>
              <button type="button"
                class="text-[10px] px-2.5 py-0.5 rounded border border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors font-medium ml-auto"
                title="Return to the live sharpening session" @click="returnToLiveSession">↩ Return to Live Session</button>
            </div>

            <div v-if="displayedChanges.length === 0" class="flex-1 flex items-center justify-center">
              <div class="text-center text-slate-400 px-8 py-12">
                <p class="text-sm font-semibold text-slate-600 mb-1">No answers to integrate yet</p>
                <p class="text-xs leading-relaxed mb-4">Answer at least one question, then click <b>✓ Done Sharpening</b>.</p>
                <button type="button"
                  class="text-xs px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                  title="Return to the interview" @click="showChanges = false">← Back to Interview</button>
              </div>
            </div>

            <ScrollContainer v-else class="flex-1 min-h-0 relative" inner-class="p-5 space-y-3">
              <!-- Group by category -->
              <template v-for="cat in EVO_SHARP_CATEGORIES" :key="cat.id">
                <template v-if="displayedChanges.filter(c => c.categoryId === cat.id).length > 0">
                  <p class="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full inline-block" :class="cat.accent" aria-hidden="true" />
                    {{ cat.label }}
                    <span class="font-normal text-amber-500">({{ displayedChanges.filter(c => c.categoryId === cat.id).length }})</span>
                  </p>
                  <div
                    v-for="change in displayedChanges.filter(c => c.categoryId === cat.id)"
                    :key="change.key"
                    class="rounded-xl border bg-white overflow-hidden transition-opacity"
                    :class="change.approved ? 'border-amber-200' : 'border-slate-200 opacity-50'"
                  >
                    <label
                      class="flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                      :class="change.approved ? 'bg-amber-50/70 hover:bg-amber-50' : 'bg-slate-50 hover:bg-slate-100'"
                      :title="`${change.approved ? 'Untick to reject' : 'Tick to approve'}: ${change.categoryLabel} — ${change.questionText}`"
                    >
                      <input
                        type="checkbox"
                        :checked="change.approved"
                        class="mt-0.5 flex-shrink-0 accent-amber-600 cursor-pointer w-4 h-4"
                        :aria-label="`Approve proposed change from: ${change.categoryLabel} — ${change.questionText}`"
                        @change="toggleDisplayedChange(change)"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap mb-0.5">
                          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">Evo Sharp</span>
                          <span class="text-[10px] text-slate-500 font-medium">{{ change.categoryLabel }}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 italic leading-snug">{{ change.questionText }}</p>
                      </div>
                      <span class="flex-shrink-0 text-[10px] font-semibold" :class="change.approved ? 'text-amber-600' : 'text-slate-400'">
                        {{ change.approved ? 'Approved' : 'Rejected' }}
                      </span>
                    </label>
                    <div class="px-4 py-2.5 border-t bg-white" :class="change.approved ? 'border-amber-100' : 'border-slate-100'">
                      <p class="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Proposed Evo Sharp Answer</p>
                      <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ change.effectiveText }}</p>
                    </div>
                  </div>
                </template>
              </template>
            </ScrollContainer>
          </template>

          <!-- TAB: Version History -->
          <template v-else-if="changeView === 'history'">
            <div v-if="savedVersions.length === 0" class="flex-1 flex items-center justify-center">
              <div class="text-center text-slate-400 px-8 py-12">
                <p class="text-3xl mb-3">💾</p>
                <p class="text-sm font-semibold text-slate-600 mb-1">No saved versions yet</p>
                <p class="text-xs leading-relaxed mb-4">Switch to <b>Review Changes</b> and click <b>💾 Save Version</b> to snapshot the current session.</p>
              </div>
            </div>
            <ScrollContainer v-else class="flex-1 min-h-0 relative" inner-class="p-5 space-y-3">
              <div
                v-for="ver in savedVersions"
                :key="ver.id"
                class="rounded-xl border bg-white overflow-hidden"
                :class="ver.id === activeVersionId ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-slate-200'"
              >
                <div class="flex items-start gap-3 px-4 py-3">
                  <div class="flex-1 min-w-0">
                    <div v-if="editingVerId === ver.id" class="flex items-center gap-2 mb-0.5">
                      <input v-model="editingVerLabel" type="text"
                        class="flex-1 text-sm font-bold rounded border border-indigo-300 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        :aria-label="`Rename version: ${ver.label}`"
                        @keydown.enter="commitRenameVersion" @keydown.escape="cancelRenameVersion" />
                      <button type="button" class="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold" title="Save new name" @click="commitRenameVersion">Save</button>
                      <button type="button" class="text-[10px] px-2 py-0.5 rounded border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors" title="Cancel rename" @click="cancelRenameVersion">✕</button>
                    </div>
                    <div v-else class="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h4 class="text-sm font-bold text-slate-800 truncate">{{ ver.label }}</h4>
                      <button type="button"
                        class="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors font-mono"
                        :title="`Rename version: ${ver.label}`" @click="startRenameVersion(ver)">[*]→[**]</button>
                      <span class="text-[9px] px-1.5 py-0.5 rounded-full border font-semibold"
                        :class="ver.status === 'integrated' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'">
                        {{ ver.status === 'integrated' ? '✓ Integrated' : 'Draft' }}</span>
                    </div>
                    <p class="text-[10px] text-slate-400">Step: {{ ver.stepName }} · Saved {{ ver.savedAt }} · {{ ver.changes.filter(c => c.approved).length }} approved of {{ ver.changes.length }}</p>
                  </div>
                  <span v-if="ver.id === activeVersionId" class="text-[9px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 font-semibold flex-shrink-0">Active</span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex-wrap">
                  <button type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors font-semibold"
                    :title="`Restore '${ver.label}'`" @click="restoreVersion(ver.id)">↩ Restore / Review</button>
                  <button type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-700 hover:bg-sky-50 transition-colors font-medium"
                    :title="`Compare '${ver.label}' to live session`" @click="openCompare(ver.id, null)">⇄ Compare to Live</button>
                  <button type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                    :title="`Copy colourful HTML of '${ver.label}'`" @click="copyVersionHtml(ver)">[*]=[*] Copy HTML</button>
                  <div class="flex-1" />
                  <button v-if="ver.status !== 'integrated'" type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-semibold"
                    :title="`Approve '${ver.label}' to Master Plan`" @click="approveVersionToMaster(ver)">✓ Approve → Master Plan</button>
                  <button type="button"
                    class="text-[11px] px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                    :title="`Permanently delete '${ver.label}'`" @click="deleteVersion(ver.id)">✕ Delete</button>
                </div>
              </div>
            </ScrollContainer>
          </template>

          <!-- TAB: Compare -->
          <template v-else-if="changeView === 'compare'">
            <ScrollContainer class="flex-1 min-h-0 relative" inner-class="p-5 space-y-4">
              <div class="flex items-center gap-4 p-3 rounded-xl bg-slate-100 border border-slate-200">
                <div class="flex-1">
                  <label class="text-[9px] font-bold uppercase tracking-wider text-sky-700 block mb-1">Left (A)</label>
                  <select class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
                    :value="compareIds[0] ?? ''" @change="compareIds[0] = ($event.target as HTMLSelectElement).value || null">
                    <option value="">Live Session</option>
                    <option v-for="ver in savedVersions" :key="ver.id" :value="ver.id">{{ ver.label }}</option>
                  </select>
                </div>
                <span class="text-slate-400 font-bold text-lg">⇄</span>
                <div class="flex-1">
                  <label class="text-[9px] font-bold uppercase tracking-wider text-rose-700 block mb-1">Right (B)</label>
                  <select class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                    :value="compareIds[1] ?? ''" @change="compareIds[1] = ($event.target as HTMLSelectElement).value || null">
                    <option value="">Live Session</option>
                    <option v-for="ver in savedVersions" :key="ver.id" :value="ver.id">{{ ver.label }}</option>
                  </select>
                </div>
              </div>
              <div class="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-sky-100 border border-sky-300 inline-block" />Left (A) only</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" />Right (B) only</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block" />Both — different approval</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 inline-block" />Both — same approval</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="text-[10px] font-bold text-sky-700 uppercase tracking-wide px-1">A: {{ versionLabel(compareIds[0]) }}</div>
                <div class="text-[10px] font-bold text-rose-700 uppercase tracking-wide px-1">B: {{ versionLabel(compareIds[1]) }}</div>
              </div>
              <div v-for="slot in compareSlots" :key="slot.key"
                class="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border"
                :class="!slot.left ? 'border-rose-200' : !slot.right ? 'border-sky-200' : slot.left.approved === slot.right.approved ? 'border-emerald-200' : 'border-amber-300'">
                <div class="p-3" :class="!slot.left ? 'bg-slate-50/50' : 'bg-sky-50/40'">
                  <p v-if="!slot.left" class="text-[10px] text-slate-400 italic text-center py-4">(not in A)</p>
                  <template v-else>
                    <span class="text-[9px] font-semibold block mb-1" :class="slot.left.approved ? 'text-emerald-600' : 'text-slate-400'">{{ slot.left.approved ? '✓ Approved' : '✕ Rejected' }}</span>
                    <p class="text-[10px] text-slate-600 font-medium mb-0.5">{{ slot.categoryLabel }}</p>
                    <p class="text-[9px] text-slate-400 italic mb-1 leading-snug">{{ slot.questionText }}</p>
                    <p class="text-[10px] text-slate-800 leading-snug">{{ slot.left.effectiveText }}</p>
                  </template>
                </div>
                <div class="p-3 border-l" :class="!slot.right ? 'bg-slate-50/50 border-slate-100' : 'bg-rose-50/40 border-rose-100'">
                  <p v-if="!slot.right" class="text-[10px] text-slate-400 italic text-center py-4">(not in B)</p>
                  <template v-else>
                    <span class="text-[9px] font-semibold block mb-1" :class="slot.right.approved ? 'text-emerald-600' : 'text-slate-400'">{{ slot.right.approved ? '✓ Approved' : '✕ Rejected' }}</span>
                    <p class="text-[10px] text-slate-600 font-medium mb-0.5">{{ slot.categoryLabel }}</p>
                    <p class="text-[9px] text-slate-400 italic mb-1 leading-snug">{{ slot.questionText }}</p>
                    <p class="text-[10px] text-slate-800 leading-snug">{{ slot.right.effectiveText }}</p>
                  </template>
                </div>
              </div>
              <p v-if="compareSlots.length === 0" class="text-center text-slate-400 text-xs py-8">No changes to compare — both selections are empty or identical.</p>
            </ScrollContainer>
          </template>

        </div><!-- end change review -->

        <!-- ── Footer ─────────────────────────────────────────────────────────── -->
        <footer class="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs flex-shrink-0 flex-wrap">

          <!-- Interview footer -->
          <template v-if="!showChanges">
            <span class="text-slate-600">
              <span class="font-bold">{{ totalAnsweredCount }}</span> / {{ totalQuestions }} answered ({{ progressPercent }}%)
            </span>
            <div class="flex-1" />
            <button type="button"
              class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
              title="Clear ALL answers for this step (cannot be undone)" @click="onClearConfirm">Start Fresh</button>
            <button type="button"
              class="px-3 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-xs font-semibold"
              title="Copy colourful HTML to clipboard — paste with ⌘V into Mail, Notes, Keynote, Word" @click="onExportCopy">[*]=[*] Copy HTML</button>
            <button type="button"
              class="px-3 py-1.5 rounded-lg text-white bg-amber-600 hover:bg-amber-700 transition-colors text-xs font-bold"
              title="Export as colourful HTML — copies to clipboard, opens Mail to Tom@Gilb.com" @click="onExportEmail">[*]---→[*] Export + Email</button>
            <button type="button"
              class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
              title="Download as standalone colourful HTML file" @click="onExportDownload">*→[*] Download HTML</button>
            <button type="button"
              class="px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors text-xs font-bold shadow-sm"
              title="Done sharpening — review proposed changes, approve or reject, then integrate into Master Plan" @click="onDoneSharpening">✓ Done Sharpening</button>
          </template>

          <!-- Change Review footer — tab-aware MOVE mirror -->
          <template v-else>
            <button type="button"
              class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
              title="Return to the sharpening interview" @click="showChanges = false">← Back to Interview</button>
            <div class="flex-1" />
            <template v-if="changeView === 'review'">
              <span class="text-slate-500 font-mono">
                <span class="font-bold text-emerald-600">{{ displayedApprovedCount }}</span> of {{ displayedChanges.length }} approved
                <template v-if="activeVersionId"> · <span class="text-amber-600 text-[10px]">saved version</span></template>
              </span>
              <button type="button"
                class="px-3 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 transition-colors text-xs font-semibold"
                title="Save a named snapshot of this version" @click="saveCurrentVersion">💾 Save Version</button>
              <button v-if="activeVersionId === null" type="button"
                class="px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="displayedApprovedCount === 0"
                title="Copy colourful HTML to clipboard + open Mail to Tom@Gilb.com" @click="onIntegrateChanges">Integrate Approved → Plan</button>
              <button v-else type="button"
                class="px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="displayedApprovedCount === 0"
                :title="`Approve saved version '${activeVersion?.label}' → Master Plan`"
                @click="activeVersion && approveVersionToMaster(activeVersion)">✓ Approve → Master Plan</button>
            </template>
            <template v-else-if="changeView === 'history'">
              <span class="text-slate-500 font-mono text-[10px]">{{ savedVersions.length }} saved version{{ savedVersions.length === 1 ? '' : 's' }}</span>
            </template>
            <template v-else-if="changeView === 'compare'">
              <span class="text-slate-500 font-mono text-[10px]">A: {{ versionLabel(compareIds[0]) }} ⇄ B: {{ versionLabel(compareIds[1]) }}</span>
            </template>
          </template>

        </footer>

      </div>
    </div>
  </Teleport>
</template>
