<!-- UNIT_TYPE=Panel -->
<!--
  SolutionSharpenPanel.vue — Solution Sharpening Interview · Stage 5

  Tom Gilb 2026-06-08 verbatim:
    "SOLUTION SHARPENING: REPLACE THE GENERIC SHARPENING CURRENTLY HERE.
     Major purposes: Solution Spec with better teeth in them, new Solutions,
     Replace with solutions using fewer critical resources. Solutions with
     multiple effects. Getting rid of risks and negative side effects in
     solutions. Detailing fluffy solution ideas into subsets of several well
     defined sub-ideas. Finding Adaptive Solutions that can be tuned as we
     get feedback, or reversed out if we regret them. Solutions that are more
     architecture than local patching. Solutions that can be reused.
     Same generic logic as the other sharpening processes."

  Design:
    - 26 themes (Tom's verbatim list from solutionSharpInterview.ts)
    - 2 questions per theme (52 total), each with:
        · pointed question + rationale
        · output-type badge: → New Solution / → Improve Solution / → New Value Requirement
        · typed planner answer (textarea)
        · 3 AI-suggested answers (tick-to-approve, SourceBadge per suggestion)
        · effective answer preview
    - Sidebar: scrollable theme list with accent color bars + answered/total counts
    - Footer: progress + Export Markdown + Start Fresh
    - Answers persist to localStorage scoped by planId

  Rules complied with:
    · CloseDot rule — header has <CloseDot> at end of flex header
    · ScrollContainer rule — sidebar + main pane both wrapped
    · Single-Surface — App.vue registers `solutionSharpenOpen` via registerExclusiveSurface
    · Interaction Disclosure (DD-009) — every button has :title
    · Planguage-Glyph-First (DD-011) — PlSolutionIcon in header
    · Banned-Scrum-Vocabulary — Evo / Planguage terms only
    · Claude-Code-as-AI-Layer — no in-app API calls; suggestions are static data
    · Color-on-Background Contrast (DD-017) — output-type badges on white bg
    · Twin portability — pure data in, pure event out; no global state coupling
-->

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlSolutionIcon from './icons/PlSolutionIcon.vue'
import SourceBadge from './SourceBadge.vue'
import JustificationGlyph from './icons/JustificationGlyph.vue'
import type { SpecBlock } from '../types/spec'
import {
  SOLUTION_SHARP_THEMES,
  SOLUTION_SHARP_TOTAL_QUESTIONS,
  type SolutionSharpTheme,
  type SolutionSharpQuestion,
  type SolutionSharpOutputType,
} from '../data/solutionSharpInterview'
import type { SourceProvenance } from '../data/aiSource'
import {
  credibilityZone,
  CREDIBILITY_DOT_CLASS,
  CREDIBILITY_LABEL_CLASS,
  CREDIBILITY_ZONE_LABEL,
  DEFAULT_CREDIBILITY,
  type SuggestionJustification,
} from '../data/sharpenJustification'
import {
  exportEmail,
  exportCopy,
  exportDownload,
  htmlDocumentShell,
  htmlEsc,
} from '../composables/useExportShared'
import { useToast } from '../composables/useToast'
import {
  copyUniversalSharp,
  emailUniversalSharp,
  type UniversalSharpExportInput,
} from '../composables/useUniversalSharpExport'

// ─── Props & Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Current spec (used for display + future spec-write integration). */
  spec: SpecBlock | null
  /** Stable plan identifier for localStorage scoping. */
  planId?: string
}>()

const emit = defineEmits<{
  close: []
  /** Fired when the planner approves the sharpening changes and integrates them.
   *  Parent (App.vue) may route to Spec Editor or simply close the panel. */
  'sharpen-complete': []
}>()

// ─── Answer state ──────────────────────────────────────────────────────────────
// answers[`${themeId}:${questionId}`] = { typed, ticked, because, sources, … }
// Persists to localStorage by planId so sharpening sessions survive refresh.

const STORAGE_KEY = computed(() =>
  `solution-sharp-answers:${props.planId ?? 'default'}`,
)

/**
 * Q&A Justification — Tom Gilb 2026-06-08.
 * Extended with Planguage Parameter "Justification": planner's own Because + Sources.
 * These are the planner's authored justification fields (analogous to IET Source + Evidence in CE).
 * Old localStorage records without these fields load safely (undefined → falsy defaults).
 */
interface AnswerEntry {
  typed: string
  ticked: number[]
  /** Planguage Parameter "Justification" — planner's [!] Because: why they wrote this answer. */
  because?: string
  /** Planguage Parameter "Justification" — planner's ["] Sources: what they referenced. */
  sources?: string
  /**
   * Per-suggestion planner justification (sparse, keyed by suggestion index).
   * Because: why the planner approved this specific suggestion.
   */
  suggBecause?: Record<number, string>
  /**
   * Per-suggestion planner justification (sparse, keyed by suggestion index).
   * Sources: what the planner referenced when approving this suggestion.
   */
  suggSources?: Record<number, string>
}

const answers = reactive<Record<string, AnswerEntry>>({})

// ─── Q&A Justification visibility state ────────────────────────────────────────
// UI-only — not persisted (reconstructed from answers on mount).
// Key formats:
//   `q:${themeId}:${qId}`          — question-level justification
//   `s:${themeId}:${qId}:${idx}`   — suggestion-level justification
//   `bc:${themeId}:${qId}`         — planner's Because/Sources fields
const openJustifications = reactive<Set<string>>(new Set())

function toggleJustification(key: string): void {
  if (openJustifications.has(key)) {
    openJustifications.delete(key)
  } else {
    openJustifications.add(key)
  }
}

function isJustOpen(key: string): boolean {
  return openJustifications.has(key)
}

/** Auto-open question justification for a given themeId:qId key (called when answered). */
function autoOpenQuestionJust(themeId: string, qId: string): void {
  openJustifications.add(`q:${themeId}:${qId}`)
}

/** Auto-open suggestion justification (called when suggestion is ticked). */
function autoOpenSuggJust(themeId: string, qId: string, idx: number): void {
  openJustifications.add(`s:${themeId}:${qId}:${idx}`)
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY.value)
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, AnswerEntry>
      Object.assign(answers, parsed)
      // Reconstruct open-justification state from persisted answers
      for (const [k, v] of Object.entries(parsed)) {
        const [themeId, qId] = k.split(':')
        if (v.typed?.trim()) openJustifications.add(`q:${themeId}:${qId}`)
        for (const idx of (v.ticked ?? [])) {
          openJustifications.add(`s:${themeId}:${qId}:${idx}`)
        }
      }
    }
  } catch { /* ignore */ }
})

// Load saved versions alongside answers (separate localStorage key)
onMounted(loadSavedVersions)

// Persist on every change (deep watch is fine — interview data is small)
watch(answers, () => {
  try { localStorage.setItem(STORAGE_KEY.value, JSON.stringify(answers)) } catch { /* ignore */ }
}, { deep: true })

/** Returns the answer entry for (themeId, questionId), initialising if absent. */
function getAnswer(themeId: string, qId: string): AnswerEntry {
  const k = `${themeId}:${qId}`
  if (!answers[k]) answers[k] = { typed: '', ticked: [] }
  return answers[k]
}

function setTyped(themeId: string, qId: string, val: string) {
  getAnswer(themeId, qId).typed = val
  // Auto-open question justification when the planner starts writing (Tom Gilb 2026-06-08)
  if (val.trim().length > 0) autoOpenQuestionJust(themeId, qId)
}

function toggleTicked(themeId: string, qId: string, idx: number) {
  const a = getAnswer(themeId, qId)
  const pos = a.ticked.indexOf(idx)
  if (pos === -1) {
    a.ticked.push(idx)
    // Auto-open suggestion justification when ticked (Tom Gilb 2026-06-08)
    autoOpenSuggJust(themeId, qId, idx)
  } else {
    a.ticked.splice(pos, 1)
  }
}

function isTicked(themeId: string, qId: string, idx: number): boolean {
  return getAnswer(themeId, qId).ticked.includes(idx)
}

// Planner's own Q&A Justification setters (Planguage Parameter "Justification")
function setPlannerBecause(themeId: string, qId: string, val: string): void {
  getAnswer(themeId, qId).because = val
}
function setPlannerSources(themeId: string, qId: string, val: string): void {
  getAnswer(themeId, qId).sources = val
}
function setSuggBecause(themeId: string, qId: string, idx: number, val: string): void {
  const a = getAnswer(themeId, qId)
  if (!a.suggBecause) a.suggBecause = {}
  a.suggBecause[idx] = val
}
function setSuggSources(themeId: string, qId: string, idx: number, val: string): void {
  const a = getAnswer(themeId, qId)
  if (!a.suggSources) a.suggSources = {}
  a.suggSources[idx] = val
}

/** True when the question has any typed content OR at least one ticked suggestion. */
function isAnswered(themeId: string, qId: string): boolean {
  const a = getAnswer(themeId, qId)
  return a.typed.trim().length > 0 || a.ticked.length > 0
}

/** Builds the effective answer text: typed + all ticked suggestions, separated. */
function effectiveAnswer(themeId: string, qId: string, suggs: string[]): string {
  const a = getAnswer(themeId, qId)
  const parts: string[] = []
  if (a.typed.trim().length > 0) parts.push(a.typed.trim())
  for (const idx of a.ticked.slice().sort((x, y) => x - y)) {
    const s = suggs[idx]
    if (s) parts.push(s)
  }
  return parts.join('\n\n')
}

// ─── Progress ──────────────────────────────────────────────────────────────────

const totalQuestions = SOLUTION_SHARP_TOTAL_QUESTIONS  // 52

const answeredCount = computed<number>(() => {
  let n = 0
  for (const theme of SOLUTION_SHARP_THEMES) {
    for (const q of theme.questions) {
      if (isAnswered(theme.id, q.id)) n++
    }
  }
  return n
})

const progressPercent = computed<number>(() =>
  totalQuestions === 0 ? 0 : Math.round((answeredCount.value / totalQuestions) * 100),
)

// r41 v283 (Tom Gilb 2026-06-22 "All sharpening answers must be exportable")
function _buildExportInput(): UniversalSharpExportInput {
  return {
    panelName: 'Solution Sharpening',
    planName:  (props.spec as unknown as { plan?: { name?: string } })?.plan?.name || 'Untitled Plan',
    subtitle:  '26 themes × 2 questions = 52 Q&A pairs across Solution-design dimensions (Gilb-cited).',
    sections:  SOLUTION_SHARP_THEMES.map(theme => ({
      headline: theme.title,
      subtitle: `${theme.purpose} — ${theme.gilbSource}`,
      color:    /amber/.test(theme.accent)  ? '#d97706'
              : /violet/.test(theme.accent) ? '#7c3aed'
              : /rose/.test(theme.accent)   ? '#e11d48'
              : /emerald/.test(theme.accent)? '#059669'
              : /sky/.test(theme.accent)    ? '#0284c7'
              : /indigo/.test(theme.accent) ? '#4f46e5'
              : /teal/.test(theme.accent)   ? '#0d9488'
              : /fuchsia/.test(theme.accent)? '#c026d3'
              : '#475569',
      items: theme.questions.map(q => {
        const a = getAnswer(theme.id, q.id)
        const tickedSet = new Set(a.ticked ?? [])
        const suggestions = q.suggestedAnswers.map((text, idx) => ({
          text,
          ticked: tickedSet.has(idx),
          source: q.suggestedAnswerProvenances?.[idx]?.note,
        }))
        return {
          question:  q.text,
          typed:     a.typed ?? '',
          suggestions,
          rationale: q.rationale,
          source:    a.sources?.trim() || undefined,
        }
      }),
    })),
  }
}
async function copyAllAnswers(): Promise<void>  { await copyUniversalSharp(_buildExportInput())  }
async function emailAllAnswers(): Promise<void> { await emailUniversalSharp(_buildExportInput()) }

/** Number of answered questions within a theme (for sidebar badge). */
function answeredInTheme(theme: SolutionSharpTheme): number {
  return theme.questions.filter(q => isAnswered(theme.id, q.id)).length
}

// ─── Active theme ──────────────────────────────────────────────────────────────

const activeThemeId = ref<string>(SOLUTION_SHARP_THEMES[0]?.id ?? '')

const activeTheme = computed<SolutionSharpTheme | undefined>(() =>
  SOLUTION_SHARP_THEMES.find(t => t.id === activeThemeId.value),
)

/** Advance to the next theme (wraps at end). */
function nextTheme(): void {
  const idx = SOLUTION_SHARP_THEMES.findIndex(t => t.id === activeThemeId.value)
  if (idx >= 0 && idx < SOLUTION_SHARP_THEMES.length - 1) {
    activeThemeId.value = SOLUTION_SHARP_THEMES[idx + 1].id
  }
}

/** Go back to the previous theme. */
function prevTheme(): void {
  const idx = SOLUTION_SHARP_THEMES.findIndex(t => t.id === activeThemeId.value)
  if (idx > 0) {
    activeThemeId.value = SOLUTION_SHARP_THEMES[idx - 1].id
  }
}

const activeThemeIndex = computed<number>(() =>
  SOLUTION_SHARP_THEMES.findIndex(t => t.id === activeThemeId.value),
)

// ─── Output-type badge styles ───────────────────────────────────────────────────

interface OutputBadge {
  cls: string
  dotCls: string
}

function outputBadgeStyle(outputType: SolutionSharpOutputType): OutputBadge {
  switch (outputType) {
    case 'new-solution':
      return {
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        dotCls: 'bg-emerald-400',
      }
    case 'improved-solution':
      return {
        cls: 'bg-orange-50 text-orange-700 border-orange-300',
        dotCls: 'bg-orange-400',
      }
    case 'new-value':
      return {
        cls: 'bg-violet-50 text-violet-700 border-violet-300',
        dotCls: 'bg-violet-400',
      }
  }
}

// ─── Solution Justification helpers ──────────────────────────────────────────
// Tom Gilb 2026-06-08: "Analysis / Knowledge base / Credibility 0-10"
// Falls back gracefully when per-suggestion justifications are absent.

/** Returns the resolved justification for suggestion[idx] in question q.
 *  Falls back to the question rationale + theme gilbSource + DEFAULT_CREDIBILITY
 *  so every suggestion shows justification immediately. */
function getJustification(
  theme: SolutionSharpTheme,
  q: SolutionSharpQuestion,
  idx: number,
): SuggestionJustification {
  const j = q.suggestedAnswerJustifications?.[idx]
  return {
    analysis:      j?.analysis      ?? q.rationale,
    knowledgeBase: j?.knowledgeBase ?? theme.gilbSource,
    credibility:   j?.credibility   ?? DEFAULT_CREDIBILITY,
  }
}

// ─── Done Sharpening — Change Review & Plan Integration ──────────────────────
//
// Tom Gilb 2026-06-08: "I cannot see any 'done sharpening' — integrate into the
// Planguage Plan Sharpened Version, List Changes, Seek Approval to change the
// Master Plan."
//
// Workflow:
//   1. Planner clicks "✓ Done Sharpening" → Change Review panel opens.
//   2. Review lists ALL effective answers as proposed Planguage entries
//      (grouped by outputType: → New S. / → Improve S. / → New V.).
//   3. Each proposed change has an approve checkbox (all ticked by default).
//   4. "Integrate Approved → Plan" builds a colourful HTML summary + plain text,
//      copies to clipboard, opens Mail with SEM Email Body Standard, emits
//      `sharpen-complete` so App.vue can route to Spec Editor.
//   5. "← Back to Interview" returns without applying anything.

interface ProposedChange {
  key: string               // unique: `${themeId}:${qId}`
  themeId: string
  themeTitle: string
  qId: string
  questionText: string
  outputType: SolutionSharpOutputType
  outputLabel: string
  effectiveText: string     // the planner's full answer (typed + ticked suggestions)
  approved: boolean         // default true — planner unchecks to reject
}

const showChanges     = ref(false)
const proposedChanges = ref<ProposedChange[]>([])
/** Snapshot of the live-session proposed changes — preserved when a saved version is restored. */
const liveChanges     = ref<ProposedChange[]>([])

/** Builds the proposed-change list from all currently-answered questions. */
function buildProposedChanges(): ProposedChange[] {
  const result: ProposedChange[] = []
  for (const theme of SOLUTION_SHARP_THEMES) {
    for (const q of theme.questions) {
      const eff = effectiveAnswer(theme.id, q.id, q.suggestedAnswers)
      if (!eff.trim()) continue
      result.push({
        key:          `${theme.id}:${q.id}`,
        themeId:      theme.id,
        themeTitle:   theme.title,
        qId:          q.id,
        questionText: q.text,
        outputType:   q.outputType,
        outputLabel:  q.outputLabel,
        effectiveText: eff,
        approved:     true,
      })
    }
  }
  return result
}

const approvedCount = computed(() => proposedChanges.value.filter(c => c.approved).length)

function onDoneSharpening(): void {
  const built          = buildProposedChanges()
  proposedChanges.value = built
  liveChanges.value    = [...built]
  activeVersionId.value = null
  changeView.value     = 'review'
  showChanges.value    = true
}

function onApprovAll(): void  { proposedChanges.value.forEach(c => { c.approved = true  }) }
function onRejectAll(): void  { proposedChanges.value.forEach(c => { c.approved = false }) }

/** Builds colourful HTML of the APPROVED proposed changes — for clipboard + email. */
function buildChangesHtml(approved: ProposedChange[]): string {
  const specName = props.spec?.title ?? 'Unnamed Spec'
  const dateStr  = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  // Group by outputType
  const groups: { type: SolutionSharpOutputType; label: string; stripe: string; bg: string; text: string }[] = [
    { type: 'new-solution',      label: '→ New Solution Entries',      stripe: '#10b981', bg: '#d1fae5', text: '#065f46' },
    { type: 'improved-solution', label: '→ Improved Solution Entries', stripe: '#f97316', bg: '#ffedd5', text: '#7c2d12' },
    { type: 'new-value',         label: '→ New Value Entries',         stripe: '#8b5cf6', bg: '#ede9fe', text: '#4c1d95' },
  ]

  let body = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#0f172a" style="background:#0f172a;color:#e2e8f0;padding:14px 22px;font:700 15px/1.3 'Helvetica Neue',Arial,sans-serif;">Solution Sharpening — Proposed Changes</td></tr>
  <tr><td bgcolor="#1e293b" style="background:#1e293b;color:#94a3b8;padding:6px 22px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(specName)} &nbsp;·&nbsp; ${htmlEsc(dateStr)} &nbsp;·&nbsp; ${approved.length} change${approved.length === 1 ? '' : 's'} approved for integration</td></tr>
  <tr><td bgcolor="#334155" style="background:#334155;color:#cbd5e1;padding:6px 22px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">These entries are proposed additions to the Planguage Master Plan. Each is derived from a Solution Sharpening Interview answer. Review and add to your spec in the Spec Editor.</td></tr>
</table>`

  for (const grp of groups) {
    const items = approved.filter(c => c.outputType === grp.type)
    if (items.length === 0) continue

    body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;">
  <tr><td bgcolor="${grp.stripe}" style="background:${grp.stripe};color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.07em;text-transform:uppercase;">${htmlEsc(grp.label)} &nbsp;(${items.length})</td></tr>
</table>`

    for (const item of items) {
      body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border-left:4px solid ${grp.stripe};">
  <tr>
    <td bgcolor="${grp.bg}" style="background:${grp.bg};color:${grp.text};padding:5px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;width:140px;vertical-align:top;">${htmlEsc(grp.type === 'new-solution' ? 'NEW Solution' : grp.type === 'improved-solution' ? 'IMPROVED Solution' : 'NEW Value')}</td>
    <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;padding:5px 14px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;">Theme: <b>${htmlEsc(item.themeTitle)}</b></td>
  </tr>
  <tr>
    <td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;padding:4px 12px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;font-style:italic;">Question</td>
    <td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#475569;padding:4px 14px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(item.questionText)}</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">${htmlEsc(grp.type === 'new-value' ? 'Value Entry' : 'Solution Entry')}</td>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#1e293b;padding:8px 14px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;white-space:normal;">${htmlEsc(item.effectiveText)}</td>
  </tr>
</table>`
    }

    body += `\n<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;border-collapse:collapse;"><tr><td bgcolor="#e2e8f0" style="background:#e2e8f0;height:2px;font-size:0;line-height:0;"></td></tr></table>`
  }

  return htmlDocumentShell({ title: `Solution Sharpening Changes · ${specName}`, bodyHtml: body })
}

/** Plain-text version of the approved changes for mailto: body. */
function buildChangesPlain(approved: ProposedChange[]): string {
  const specName = props.spec?.title ?? 'Unnamed Spec'
  const SEP = '─'.repeat(56)
  const lines: string[] = [
    'SOLUTION SHARPENING — PROPOSED CHANGES',
    `Spec: ${specName}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `${approved.length} change${approved.length === 1 ? '' : 's'} approved for integration`,
    '',
    SEP,
    '',
  ]
  for (const type of ['new-solution', 'improved-solution', 'new-value'] as SolutionSharpOutputType[]) {
    const items = approved.filter(c => c.outputType === type)
    if (items.length === 0) continue
    const heading = type === 'new-solution' ? 'NEW SOLUTION ENTRIES' : type === 'improved-solution' ? 'IMPROVED SOLUTION ENTRIES' : 'NEW VALUE ENTRIES'
    lines.push(`== ${heading} ==`)
    lines.push('')
    for (const item of items) {
      lines.push(`Theme: ${item.themeTitle}`)
      lines.push(`Q: ${item.questionText}`)
      lines.push('')
      lines.push(item.effectiveText)
      lines.push('')
      lines.push(SEP)
      lines.push('')
    }
  }
  return lines.join('\n')
}

/** Integrates approved changes: HTML clipboard + email + sharpen-complete emit. */
async function onIntegrateChanges(): Promise<void> {
  const { showToast } = useToast()
  const approved = proposedChanges.value.filter(c => c.approved)
  if (approved.length === 0) {
    showToast('No changes approved — tick at least one entry to integrate', 3500)
    return
  }
  const specName = props.spec?.title ?? 'Unnamed Spec'
  await exportEmail(
    buildChangesHtml(approved),
    `Solution Sharpening Changes · ${specName}`,
    `${approved.length} Sharpening Change${approved.length === 1 ? '' : 's'} HTML`,
    'Tom@Gilb.com',
    buildChangesPlain(approved),
  )
  showToast(`✓ ${approved.length} sharpening change${approved.length === 1 ? '' : 's'} sent to Mail — paste into Spec Editor to apply`, 6000)
  emit('sharpen-complete')
}

// ─── Version History & Governance ─────────────────────────────────────────────
// Tom Gilb 2026-06-08: "keep a version without changing the Master, return to it
// later through restore, compare to other versions, export, or approve it becoming
// part of the master plan. Put the options in a clear menu."
//
// Governance model:
//   draft      — saved snapshot, not yet integrated into Master Plan
//   integrated — approved and sent to Master Plan via email (irreversible label only)
//
// Storage: localStorage `solution-sharp-versions:${planId}` — separate key from answers.
// Each SharpeningVersion deep-clones ProposedChange[] so it is truly immutable.
//
// Panel tabs:
//   'review'  — review / approve the currently loaded changes (live or restored)
//   'history' — list all saved versions with governance actions
//   'compare' — two-column diff of any two versions (or live session)

interface SharpeningVersion {
  id:       string                  // `v-${Date.now()}` — unique, stable
  label:    string                  // auto-generated; planner can rename inline
  savedAt:  string                  // ISO timestamp
  specName: string                  // spec title at save time (for display)
  changes:  ProposedChange[]        // deep-cloned snapshot; planner may toggle approve on it
  status:   'draft' | 'integrated'  // governance status
  notes?:   string                  // reserved for future annotation
}

const VER_KEY = computed(() => `solution-sharp-versions:${props.planId ?? 'default'}`)

const savedVersions   = ref<SharpeningVersion[]>([])
/** null = live session; version id = a saved version is loaded into the Review tab. */
const activeVersionId = ref<string | null>(null)
/** Which tab of the Change Review panel is showing. */
const changeView      = ref<'review' | 'history' | 'compare'>('review')
/** [leftId, rightId] — null means "live session" for that slot. */
const compareIds      = ref<[string | null, string | null]>([null, null])
/** Inline rename state. */
const editingVerId    = ref<string | null>(null)
const editingVerLabel = ref('')

function loadSavedVersions(): void {
  try {
    const raw = localStorage.getItem(VER_KEY.value)
    if (raw) savedVersions.value = JSON.parse(raw) as SharpeningVersion[]
  } catch { /* ignore corrupt data */ }
}

function persistVersions(): void {
  try { localStorage.setItem(VER_KEY.value, JSON.stringify(savedVersions.value)) } catch { /* ignore */ }
}

/** The changes visible in the Review panel — live session or restored version. */
const displayedChanges = computed<ProposedChange[]>(() =>
  activeVersionId.value === null
    ? proposedChanges.value
    : (savedVersions.value.find(v => v.id === activeVersionId.value)?.changes ?? []),
)

const activeVersion = computed<SharpeningVersion | null>(() =>
  activeVersionId.value
    ? (savedVersions.value.find(v => v.id === activeVersionId.value) ?? null)
    : null,
)

const displayedApprovedCount = computed(() => displayedChanges.value.filter(c => c.approved).length)

/** Toggle approve/reject on a displayed change + persist when on a saved version. */
function toggleDisplayedChange(c: ProposedChange): void {
  c.approved = !c.approved
  if (activeVersionId.value !== null) persistVersions()
}

function approveAllDisplayed(): void {
  displayedChanges.value.forEach(c => { c.approved = true  })
  if (activeVersionId.value !== null) persistVersions()
}
function rejectAllDisplayed(): void {
  displayedChanges.value.forEach(c => { c.approved = false })
  if (activeVersionId.value !== null) persistVersions()
}

function saveCurrentVersion(): void {
  const { showToast } = useToast()
  const source = activeVersionId.value === null ? proposedChanges.value : displayedChanges.value
  if (source.length === 0) { showToast('No proposed changes to save yet — complete the interview first', 3500); return }
  const specName = props.spec?.title ?? 'Unnamed Spec'
  const now      = new Date()
  const label    = `Session ${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
  const ver: SharpeningVersion = {
    id:       `v-${now.getTime()}`,
    label,
    savedAt:  now.toISOString(),
    specName,
    changes:  JSON.parse(JSON.stringify(source)) as ProposedChange[],
    status:   'draft',
  }
  savedVersions.value.unshift(ver)
  persistVersions()
  showToast(`✓ Saved "${label}" — ${ver.changes.length} proposed changes`, 5000)
}

function restoreVersion(id: string): void {
  // Preserve live session before restoring
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

function startRenameVersion(v: SharpeningVersion): void {
  editingVerId.value = v.id; editingVerLabel.value = v.label
}
function commitRenameVersion(): void {
  const v = savedVersions.value.find(x => x.id === editingVerId.value)
  if (v && editingVerLabel.value.trim()) { v.label = editingVerLabel.value.trim(); persistVersions() }
  editingVerId.value = null; editingVerLabel.value = ''
}
function cancelRenameVersion(): void { editingVerId.value = null; editingVerLabel.value = '' }

function openCompare(a: string | null, b: string | null): void {
  compareIds.value = [a, b]; changeView.value = 'compare'
}

function changesFor(id: string | null): ProposedChange[] {
  if (id === null) return liveChanges.value.length > 0 ? liveChanges.value : proposedChanges.value
  return savedVersions.value.find(v => v.id === id)?.changes ?? []
}

function versionLabel(id: string | null): string {
  if (id === null) return 'Live Session'
  return savedVersions.value.find(v => v.id === id)?.label ?? 'Unknown'
}

interface CompareSlot {
  key:          string
  themeTitle:   string
  questionText: string
  outputType:   SolutionSharpOutputType
  left:         ProposedChange | undefined
  right:        ProposedChange | undefined
}

const compareSlots = computed<CompareSlot[]>(() => {
  const aList = changesFor(compareIds.value[0])
  const bList = changesFor(compareIds.value[1])
  const aMap  = new Map(aList.map(c => [c.key, c]))
  const bMap  = new Map(bList.map(c => [c.key, c]))
  const keys  = new Set([...aMap.keys(), ...bMap.keys()])
  return [...keys].map(key => {
    const sample = (aMap.get(key) ?? bMap.get(key))!
    return {
      key,
      themeTitle:   sample.themeTitle,
      questionText: sample.questionText,
      outputType:   sample.outputType,
      left:         aMap.get(key),
      right:        bMap.get(key),
    }
  })
})

/** Email integration for a saved version (governance — marks it 'integrated'). */
async function approveVersionToMaster(ver: SharpeningVersion): Promise<void> {
  const { showToast } = useToast()
  const approved = ver.changes.filter(c => c.approved)
  if (approved.length === 0) {
    showToast('No changes approved in this version — tick at least one entry', 3500)
    return
  }
  const specName = props.spec?.title ?? ver.specName
  await exportEmail(
    buildChangesHtml(approved),
    `Solution Sharpening Changes · ${specName}`,
    `${approved.length} Changes from "${ver.label}"`,
    'Tom@Gilb.com',
    buildChangesPlain(approved),
  )
  const v = savedVersions.value.find(x => x.id === ver.id)
  if (v) { v.status = 'integrated'; persistVersions() }
  showToast(`✓ ${approved.length} changes from "${ver.label}" sent to Mail — paste into Spec Editor`, 6000)
  emit('sharpen-complete')
}

async function copyVersionHtml(ver: SharpeningVersion): Promise<void> {
  const { showToast } = useToast()
  const approved = ver.changes.filter(c => c.approved)
  const ok = await exportCopy(buildChangesHtml(approved), buildChangesPlain(approved))
  showToast(ok ? `✓ "${ver.label}" HTML copied — ⌘V to paste` : 'Copy failed — try again', 4000)
}

// ─── Export — colourful HTML (replaces Markdown, Tom Gilb 2026-06-08) ──────────
//
// Tom Gilb verbatim: "why export markdown? I have asked to avoid markdown and get
// HTML, for expert function (email etc). Please put my export button on this."
//
// Three-button export pattern (useExportShared.ts):
//   [⬇ Copy]          → colourful HTML to clipboard
//   [📧 Email]         → clipboard + ⌘V banner + Mail auto-open to Tom@Gilb.com
//   [↓ Download HTML]  → saves .html file (Safari renders it immediately)

// Output-type colour palette (mirrors the UI chip colours, Keynote-safe bgcolor=)
const OUTPUT_COLORS = {
  'new-solution':      { stripe: '#10b981', bg: '#d1fae5', text: '#065f46', label: '→ New Solution' },
  'improved-solution': { stripe: '#f97316', bg: '#ffedd5', text: '#7c2d12', label: '→ Improve Solution' },
  'new-value':         { stripe: '#8b5cf6', bg: '#ede9fe', text: '#4c1d95', label: '→ New Value' },
} as const

/** Build the colourful flat-table HTML — one top-level table per answered theme. */
function buildSharpeningHtml(): string {
  const specName = props.spec?.title ?? 'Unnamed Spec'
  const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const answeredThemes = SOLUTION_SHARP_THEMES.filter(t => answeredInTheme(t) > 0)

  // ── Title header ──────────────────────────────────────────────────────────
  let body = `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;border-collapse:collapse;">
  <tr><td bgcolor="#ea580c" style="background:#ea580c;color:#fff7ed;padding:14px 22px;font:700 15px/1.3 'Helvetica Neue',Arial,sans-serif;">Solution Sharpening Interview</td></tr>
  <tr><td bgcolor="#fdba74" style="background:#fdba74;color:#7c2d12;padding:6px 22px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(specName)} &nbsp;·&nbsp; ${htmlEsc(dateStr)} &nbsp;·&nbsp; ${answeredThemes.length} of 26 themes answered</td></tr>
  <tr><td bgcolor="#fff7ed" style="background:#fff7ed;color:#78350f;padding:6px 22px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">Legend: &nbsp;<b style="color:#10b981;">→ New Solution</b> = new Planguage Solution entry &nbsp;·&nbsp; <b style="color:#f97316;">→ Improve Solution</b> = refine existing Solution &nbsp;·&nbsp; <b style="color:#8b5cf6;">→ New Value</b> = measurable requirement</td></tr>
</table>`

  if (answeredThemes.length === 0) {
    body += `<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:18px;color:#64748b;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;">(No answers recorded yet — work through the 26 themes to generate sharpening output.)</td></tr></table>`
    return htmlDocumentShell({ title: `Solution Sharpening · ${specName}`, bodyHtml: body })
  }

  for (const theme of answeredThemes) {
    const answeredQs = theme.questions
      .map(q => ({ q, eff: effectiveAnswer(theme.id, q.id, q.suggestedAnswers) }))
      .filter(x => x.eff.trim().length > 0)

    // Theme section header
    body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 2px 0;border-collapse:collapse;">
  <tr><td bgcolor="#f97316" style="background:#f97316;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.07em;text-transform:uppercase;">${htmlEsc(theme.title)}</td></tr>
  <tr><td bgcolor="#fed7aa" style="background:#fed7aa;color:#7c2d12;padding:4px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">${htmlEsc(theme.purpose)}</td></tr>
  <tr><td bgcolor="#fff7ed" style="background:#fff7ed;color:#9a3412;padding:3px 18px 5px 18px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;">Source: ${htmlEsc(theme.gilbSource)}</td></tr>
</table>`

    for (const { q, eff } of answeredQs) {
      const col = OUTPUT_COLORS[q.outputType]
      const ans = getAnswer(theme.id, q.id)

      // Q + effective answer
      body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border-left:4px solid ${col.stripe};">
  <tr>
    <td bgcolor="${col.bg}" style="background:${col.bg};color:${col.text};padding:5px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;width:160px;vertical-align:top;">${htmlEsc(col.label)}</td>
    <td bgcolor="#f8fafc" style="background:#f8fafc;color:#334155;padding:5px 14px;font:600 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(q.text)}</td>
  </tr>
  <tr>
    <td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;padding:4px 12px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;font-style:italic;">Rationale</td>
    <td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;padding:4px 14px;font:400 9px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(q.rationale)}</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:3px 12px;font:400 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">Answer</td>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#1e293b;padding:8px 14px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;white-space:normal;">${htmlEsc(eff)}</td>
  </tr>${ans.because?.trim() || ans.sources?.trim() ? `
  <tr>
    <td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#3730a3;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">[?!"]<br>Justification</td>
    <td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:6px 14px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">${ans.because?.trim() ? `<b>Because [!]:</b> ${htmlEsc(ans.because.trim())}<br>` : ''}${ans.sources?.trim() ? `<b>Sources ["]:</b> ${htmlEsc(ans.sources.trim())}` : ''}</td>
  </tr>` : ''}
</table>`

      // Per-suggestion planner justifications (for ticked suggestions with because/sources)
      for (const idx of (ans.ticked ?? []).slice().sort((a, b) => a - b)) {
        const bc = ans.suggBecause?.[idx]?.trim()
        const sr = ans.suggSources?.[idx]?.trim()
        if (!bc && !sr) continue
        const sugg = q.suggestedAnswers[idx] ?? `Suggestion ${idx + 1}`
        const truncated = sugg.length > 80 ? sugg.slice(0, 80) + '…' : sugg
        body += `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;border-left:4px solid #a5b4fc;">
  <tr>
    <td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#3730a3;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;width:160px;">Suggestion #${idx + 1}</td>
    <td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:5px 14px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;font-style:italic;">${htmlEsc(truncated)}</td>
  </tr>
  <tr>
    <td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#3730a3;padding:4px 12px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;vertical-align:top;">[?!"] Justification</td>
    <td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:5px 14px;font:400 10px/1.5 'Helvetica Neue',Arial,sans-serif;">${bc ? `<b>Because [!]:</b> ${htmlEsc(bc)}<br>` : ''}${sr ? `<b>Sources ["]:</b> ${htmlEsc(sr)}` : ''}</td>
  </tr>
</table>`
      }
    }

    // Spacer between themes
    body += `\n<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;border-collapse:collapse;"><tr><td bgcolor="#e2e8f0" style="background:#e2e8f0;height:2px;font-size:0;line-height:0;"></td></tr></table>`
  }

  return htmlDocumentShell({ title: `Solution Sharpening · ${specName}`, bodyHtml: body })
}

/** Plain-text version — no markdown, used for mailto: body + clipboard fallback. */
function buildSharpeningPlain(): string {
  const specName = props.spec?.title ?? 'Unnamed Spec'
  const dateStr = new Date().toISOString().slice(0, 10)
  const SEP = '─'.repeat(56)
  const answeredThemes = SOLUTION_SHARP_THEMES.filter(t => answeredInTheme(t) > 0)
  const lines: string[] = [
    'SOLUTION SHARPENING INTERVIEW',
    `Spec: ${specName}`,
    `Generated: ${dateStr}`,
    `Themes answered: ${answeredThemes.length} of 26`,
    '',
    SEP,
    '',
    'Legend: New Solution = new S. entry | Improve Solution = refine S. | New Value = new V. entry',
    '',
    SEP,
    '',
  ]

  for (const theme of answeredThemes) {
    const answeredQs = theme.questions
      .map(q => ({ q, eff: effectiveAnswer(theme.id, q.id, q.suggestedAnswers) }))
      .filter(x => x.eff.trim().length > 0)
    if (answeredQs.length === 0) continue

    lines.push(`== ${theme.title.toUpperCase()} ==`)
    lines.push(`   ${theme.purpose}`)
    lines.push(`   Source: ${theme.gilbSource}`)
    lines.push('')
    for (const { q, eff } of answeredQs) {
      const ans = getAnswer(theme.id, q.id)
      lines.push(`${OUTPUT_COLORS[q.outputType].label}`)
      lines.push(`Q: ${q.text}`)
      lines.push('')
      lines.push(eff)
      if (ans.because?.trim() || ans.sources?.trim()) {
        lines.push('')
        lines.push('Justification:')
        if (ans.because?.trim()) lines.push(`  Because: ${ans.because.trim()}`)
        if (ans.sources?.trim()) lines.push(`  Sources: ${ans.sources.trim()}`)
      }
      lines.push('')
    }
    lines.push(SEP)
    lines.push('')
  }

  if (answeredThemes.length === 0) {
    lines.push('(No answers recorded yet — work through the 26 themes to generate sharpening output.)')
  }

  return lines.join('\n')
}

// ── Three export handlers ─────────────────────────────────────────────────────

async function onExportEmail(): Promise<void> {
  const specName = props.spec?.title ?? 'Unnamed Spec'
  await exportEmail(
    buildSharpeningHtml(),
    `Solution Sharpening · ${specName}`,
    'Solution Sharpening colourful HTML',
    'Tom@Gilb.com',
    buildSharpeningPlain(),
  )
}

async function onExportCopy(): Promise<void> {
  const { showToast } = useToast()
  const ok = await exportCopy(buildSharpeningHtml(), buildSharpeningPlain())
  showToast(
    ok ? '⬇ Colourful HTML copied — paste with ⌘V anywhere' : 'Copy failed — try again',
    4000,
  )
}

function onExportDownload(): void {
  const specName = (props.spec?.title ?? 'Solution-Sharpening').replace(/[^a-zA-Z0-9]+/g, '-')
  exportDownload(buildSharpeningHtml(), `Solution-Sharpening-${specName}-${new Date().toISOString().slice(0, 10)}`)
}

function onClearConfirm(): void {
  if (confirm('Clear ALL Solution Sharpening answers? This cannot be undone.')) {
    const keys = Object.keys(answers)
    for (const k of keys) delete answers[k]
    try { localStorage.removeItem(STORAGE_KEY.value) } catch { /* ignore */ }
  }
}
</script>

<template>
  <Teleport to="body">
    <!--
      Backdrop — click-outside closes (CloseDot rule).
      Uses fixed inset-0 outer + absolute inset-y panel — same pattern as ResourcesKissPanel
      that fixes Safari's "align-items:stretch + padding" indefinite-height bug where
      ScrollContainer children never got a definite height and overflow never triggered.
    -->
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solution-sharp-title"
      @click.self="$emit('close')"
    >
      <div class="absolute inset-y-4 left-4 right-4 sm:inset-y-8 sm:left-8 sm:right-8
                  max-w-6xl mx-auto rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- ── Header ─────────────────────────────────────────────────────── -->
        <header class="flex items-center gap-3 px-5 py-3
                       bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white
                       flex-shrink-0">
          <PlSolutionIcon class="w-7 h-7 text-white flex-shrink-0" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="solution-sharp-title" class="text-base font-bold leading-tight">
              Solution Sharpening Interview
            </h2>
            <p class="text-[11px] text-orange-50 mt-0.5">
              {{ answeredCount }} of {{ totalQuestions }} questions answered ({{ progressPercent }}%)
              · 26 themes · 52 questions · 156 AI suggestions
              · output: new Solutions, improved Solutions, new Value Requirements
            </p>
          </div>

          <!-- Theme position indicator -->
          <span class="text-[11px] text-orange-100 font-mono flex-shrink-0 hidden sm:block">
            Theme {{ activeThemeIndex + 1 }} / {{ SOLUTION_SHARP_THEMES.length }}
          </span>

          <!-- r41 v283 (Tom Gilb 2026-06-22 "All sharpening answers must be exportable") -->
          <button type="button" class="px-2.5 py-1.5 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-white/30" title="📋 Copy all Solution Sharpening Q&A as colourful HTML" @click="copyAllAnswers">📋 Copy</button>
          <button type="button" class="px-2.5 py-1.5 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold whitespace-nowrap transition-colors ring-1 ring-white/30" title="📧 Email all Solution Sharpening Q&A — opens Mail.app pre-filled" @click="emailAllAnswers">📧 Email</button>

          <!-- CloseDot rule: at the END (right) of flex header -->
          <CloseDot
            title="Close Solution Sharpening Interview — answers are auto-saved"
            @click="$emit('close')"
          />
        </header>

        <!-- Progress bar -->
        <div class="h-1.5 bg-slate-100 flex-shrink-0">
          <div
            class="h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-[width] duration-300"
            :style="{ width: progressPercent + '%' }"
            role="progressbar"
            :aria-valuenow="progressPercent"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Sharpening progress: ${progressPercent}%`"
          />
        </div>

        <!-- ── Body — sidebar + main pane (interview) / Change Review panel ── -->
        <div v-if="!showChanges" class="flex-1 flex min-h-0">

          <!-- Sidebar — 26 theme navigation list
               Note: ScrollContainer requires min-h-0 + relative so h-full is auto-injected
               into the inner overflow-y-auto div and the scroll indicators can position correctly. -->
          <div class="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
            <!-- Sidebar header — clearly labels this as the theme navigator -->
            <div class="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0 bg-slate-100/60">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">26 Themes</span>
              <span class="text-[9px] text-slate-400 font-mono">{{ SOLUTION_SHARP_THEMES.filter(t => answeredInTheme(t) > 0).length }}/26 explored</span>
            </div>

            <ScrollContainer
              class="flex-1 min-h-0 relative"
              inner-class="p-2 space-y-0.5"
            >
            <button
              v-for="theme in SOLUTION_SHARP_THEMES"
              :key="theme.id"
              type="button"
              class="w-full text-left rounded-lg px-3 py-2 transition-colors group"
              :class="theme.id === activeThemeId
                ? 'bg-white shadow-sm ring-1 ring-orange-200'
                : 'hover:bg-white/70'"
              :title="`${theme.title} — ${theme.purpose} (${answeredInTheme(theme)} of ${theme.questions.length} answered) · Source: ${theme.gilbSource}`"
              @click="activeThemeId = theme.id"
            >
              <div class="flex items-center gap-2 mb-0.5">
                <!-- Accent bar (each theme has a unique colour from the data file) -->
                <div class="w-1 h-4 rounded-full flex-shrink-0" :class="theme.accent" aria-hidden="true" />
                <span class="text-[11px] font-semibold text-slate-800 leading-tight flex-1 min-w-0 truncate">{{ theme.title }}</span>
                <!-- answered/total badge -->
                <span
                  class="text-[9px] font-mono px-1 py-px rounded flex-shrink-0"
                  :class="answeredInTheme(theme) === theme.questions.length
                    ? 'bg-emerald-100 text-emerald-700'
                    : answeredInTheme(theme) > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-400'"
                  :aria-label="`${answeredInTheme(theme)} of ${theme.questions.length} answered`"
                >{{ answeredInTheme(theme) }}/{{ theme.questions.length }}</span>
              </div>
              <p class="text-[9px] text-slate-400 leading-snug ml-3 truncate group-hover:text-slate-600">
                {{ theme.purpose }}
              </p>
            </button>
          </ScrollContainer>
          </div><!-- end sidebar wrapper -->

          <!-- Main pane — questions for active theme.
               Answer key strip sits at top of main pane so it is clearly about the question badges,
               not about the theme list in the sidebar. -->
          <div class="flex-1 flex flex-col min-h-0">

            <!-- Answer key (was misleadingly labelled "Output types:" at top of whole panel) -->
            <div class="flex items-center gap-3 px-4 py-1.5 bg-slate-50/80 border-b border-slate-100 flex-shrink-0 flex-wrap">
              <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Answer produces:</span>
              <span class="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" aria-hidden="true"></span>
                → New Solution
              </span>
              <span class="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                <span class="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" aria-hidden="true"></span>
                → Improve Solution
              </span>
              <span class="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                <span class="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" aria-hidden="true"></span>
                → New Value
              </span>
            </div>

          <ScrollContainer class="flex-1 min-h-0 relative" inner-class="p-6 space-y-6">
            <template v-if="activeTheme">

              <!-- Theme header -->
              <div class="border-b border-slate-200 pb-4">
                <div class="flex items-center gap-2.5 mb-2">
                  <div class="w-2 h-6 rounded-full flex-shrink-0" :class="activeTheme.accent" aria-hidden="true" />
                  <h3 class="text-lg font-extrabold text-slate-800 leading-tight">{{ activeTheme.title }}</h3>
                </div>
                <p class="text-sm text-slate-600 ml-4.5 mb-1 font-medium">{{ activeTheme.purpose }}</p>
                <p class="text-[11px] text-slate-400 ml-[18px] italic">{{ activeTheme.gilbSource }}</p>

                <!-- Theme navigation (DD-014: also at top of content area) -->
                <div class="flex items-center gap-2 mt-3 ml-[18px]">
                  <button
                    type="button"
                    class="text-[10px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-600
                           hover:bg-slate-100 hover:border-slate-400 transition-colors disabled:opacity-30"
                    :disabled="activeThemeIndex === 0"
                    :title="`Previous theme: ${SOLUTION_SHARP_THEMES[activeThemeIndex - 1]?.title ?? ''}`"
                    @click="prevTheme"
                  >← Previous theme</button>
                  <span class="text-[10px] text-slate-400 font-mono">{{ activeThemeIndex + 1 }} / {{ SOLUTION_SHARP_THEMES.length }}</span>
                  <button
                    type="button"
                    class="text-[10px] px-2.5 py-1 rounded-lg border border-orange-300 bg-orange-50 text-orange-700
                           hover:bg-orange-100 hover:border-orange-400 transition-colors disabled:opacity-30"
                    :disabled="activeThemeIndex === SOLUTION_SHARP_THEMES.length - 1"
                    :title="`Next theme: ${SOLUTION_SHARP_THEMES[activeThemeIndex + 1]?.title ?? ''}`"
                    @click="nextTheme"
                  >Next theme →</button>
                </div>
              </div>

              <!-- 2 questions per theme -->
              <div
                v-for="q in activeTheme.questions"
                :key="q.id"
                class="space-y-3 pb-5 border-b border-slate-100 last:border-b-0"
              >

                <!-- Question text + output-type badge + [?!"] justification pin -->
                <div class="flex items-start gap-2 flex-wrap">
                  <p class="flex-1 text-sm font-semibold text-slate-800 leading-snug">{{ q.text }}</p>
                  <span
                    class="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    :class="outputBadgeStyle(q.outputType).cls"
                    :title="`Answering this question will produce: ${q.outputLabel} — added to your Planguage spec`"
                  >
                    <span class="w-1.5 h-1.5 rounded-full inline-block" :class="outputBadgeStyle(q.outputType).dotCls" />
                    → {{ q.outputLabel }}
                  </span>
                  <!-- [?!"] — Q&A Justification pin for this question (DD-016, DD-015) -->
                  <JustificationGlyph
                    :open="isJustOpen(`q:${activeTheme.id}:${q.id}`)"
                    @toggle="toggleJustification(`q:${activeTheme.id}:${q.id}`)"
                  />
                </div>

                <!-- Q&A Justification block for question — hidden until pin clicked or planner answers -->
                <div
                  v-if="isJustOpen(`q:${activeTheme.id}:${q.id}`)"
                  class="rounded-lg bg-indigo-50/70 border border-indigo-200 px-3 py-2 space-y-1"
                >
                  <p class="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1">
                    [?!"] Q&amp;A Justification
                  </p>
                  <!-- Analysis [!] — 2-line max (Tom Gilb 2026-06-08: "maximum 2 lines") -->
                  <p
                    class="text-[10px] text-slate-700 leading-snug line-clamp-2"
                    :title="q.rationale"
                  >
                    <span class="font-bold text-slate-800">Analysis [!]:</span>
                    {{ q.rationale }}
                  </p>
                  <!-- Source ["] — 2-line max -->
                  <p
                    class="text-[10px] text-slate-500 leading-snug line-clamp-2"
                    :title="activeTheme.gilbSource"
                  >
                    <span class="font-bold text-slate-600">Source [&quot;]:</span>
                    {{ activeTheme.gilbSource }}
                  </p>
                </div>

                <!-- Planner's typed answer + Because/Sources (Planguage Parameter "Justification") -->
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-orange-700 flex-1">
                      Your answer
                    </p>
                    <!-- [?!"] pin for planner's own justification (Because + Sources) -->
                    <JustificationGlyph
                      :open="isJustOpen(`bc:${activeTheme.id}:${q.id}`)"
                      @toggle="toggleJustification(`bc:${activeTheme.id}:${q.id}`)"
                    />
                    <span class="text-[9px] text-slate-400 italic">add your justification</span>
                  </div>
                  <textarea
                    :value="getAnswer(activeTheme.id, q.id).typed"
                    placeholder="Your sharpening answer — type anything or tick a suggestion below…"
                    rows="2"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800
                           placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400
                           transition-colors resize-y"
                    :aria-label="`Your answer to: ${q.text}`"
                    @input="(e) => setTyped(activeTheme!.id, q.id, (e.target as HTMLTextAreaElement).value)"
                  ></textarea>
                  <!-- Planner's Because / Sources — gated behind [?!"] pin (Tom Gilb 2026-06-08) -->
                  <div
                    v-if="isJustOpen(`bc:${activeTheme.id}:${q.id}`)"
                    class="mt-1.5 space-y-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2"
                  >
                    <p class="text-[9px] font-bold uppercase tracking-wider text-indigo-500">
                      Planguage Justification — your [!] Because + [&quot;] Sources
                    </p>
                    <div>
                      <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Because [!]: why you wrote this answer</p>
                      <textarea
                        :value="getAnswer(activeTheme.id, q.id).because ?? ''"
                        placeholder="Because: your reasoning for this answer…"
                        rows="2"
                        class="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700
                               placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400
                               transition-colors resize-y"
                        :aria-label="`Because: justification for your answer to: ${q.text}`"
                        @input="(e) => setPlannerBecause(activeTheme!.id, q.id, (e.target as HTMLTextAreaElement).value)"
                      ></textarea>
                    </div>
                    <div>
                      <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Sources [&quot;]: your references</p>
                      <input
                        type="text"
                        :value="getAnswer(activeTheme.id, q.id).sources ?? ''"
                        placeholder="Sources: books, URLs, case studies…"
                        class="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700
                               placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400
                               transition-colors"
                        :aria-label="`Sources: references for your answer to: ${q.text}`"
                        @input="(e) => setPlannerSources(activeTheme!.id, q.id, (e.target as HTMLInputElement).value)"
                      />
                    </div>
                  </div>
                </div>

                <!-- 3 AI-suggested answers — tick to approve, [?!"] pin per suggestion -->
                <div class="space-y-2">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-1">
                    AI-suggested answers — tick any to approve
                    <span class="font-normal text-slate-400 normal-case">([?!"] to show justification)</span>
                  </p>

                  <!--
                    Suggestion chip: <div> outer (border/bg) + <label> inner (checkbox row) +
                    Q&A Justification block (hidden behind [?!"] pin; auto-shows when ticked).
                    [?!"] sits inside <label> with @click.stop so it does NOT toggle the checkbox.
                  -->
                  <div
                    v-for="(sugg, idx) in q.suggestedAnswers"
                    :key="idx"
                    class="rounded-lg border bg-white transition-colors"
                    :class="isTicked(activeTheme.id, q.id, idx)
                      ? 'border-indigo-300 bg-indigo-50/60'
                      : 'border-slate-200 hover:border-slate-300'"
                  >
                    <!-- ── Suggestion row (clickable checkbox area) ─────────────────────── -->
                    <label
                      class="flex items-start gap-2 px-3 py-2 cursor-pointer"
                      :title="`Suggestion ${idx + 1} of ${q.suggestedAnswers.length} — click to ${isTicked(activeTheme.id, q.id, idx) ? 'remove from' : 'add to'} effective answer`"
                    >
                      <input
                        type="checkbox"
                        :checked="isTicked(activeTheme.id, q.id, idx)"
                        class="mt-0.5 flex-shrink-0 accent-indigo-600 cursor-pointer"
                        :aria-label="`Tick suggestion ${idx + 1} for: ${q.text}`"
                        @change="toggleTicked(activeTheme!.id, q.id, idx)"
                      />
                      <span class="text-xs text-slate-700 leading-snug flex-1">
                        <span class="text-[9px] font-mono font-bold text-indigo-500 mr-1">#{{ idx + 1 }}</span>
                        {{ sugg }}
                      </span>
                      <!-- Per-suggestion Conjunction-of-Technologies source badge -->
                      <SourceBadge
                        class="flex-shrink-0 mt-0.5"
                        :provenance="(q.suggestedAnswerProvenances?.[idx] as SourceProvenance | undefined) ?? 'template'"
                        size="compact"
                      />
                      <!-- [?!"] pin — @click.stop prevents propagation to label/checkbox -->
                      <JustificationGlyph
                        class="flex-shrink-0 self-start"
                        :open="isJustOpen(`s:${activeTheme.id}:${q.id}:${idx}`)"
                        @click.stop="toggleJustification(`s:${activeTheme.id}:${q.id}:${idx}`)"
                      />
                    </label>

                    <!-- ── Q&A Justification block — hidden until pin or auto-shown on tick ── -->
                    <div
                      v-if="isJustOpen(`s:${activeTheme.id}:${q.id}:${idx}`)"
                      class="px-3 pb-2 pt-1.5 border-t border-slate-100 bg-slate-50/60 rounded-b-lg space-y-1.5"
                    >
                      <!-- Credibility meter: 10 dots + zone chip -->
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">Credibility</span>
                        <span
                          v-for="dot in 10"
                          :key="dot"
                          class="inline-block w-2 h-2 rounded-full transition-colors"
                          :class="dot <= getJustification(activeTheme, q, idx).credibility
                            ? CREDIBILITY_DOT_CLASS[credibilityZone(getJustification(activeTheme, q, idx).credibility)]
                            : 'bg-slate-200'"
                          aria-hidden="true"
                        />
                        <span
                          class="text-[8px] font-bold px-1.5 py-px rounded border ml-0.5"
                          :class="CREDIBILITY_LABEL_CLASS[credibilityZone(getJustification(activeTheme, q, idx).credibility)]"
                          :title="`Credibility ${getJustification(activeTheme, q, idx).credibility}/10 — ${CREDIBILITY_ZONE_LABEL[credibilityZone(getJustification(activeTheme, q, idx).credibility)]} (analogous to ±Uncertainty in CE)`"
                        >
                          {{ getJustification(activeTheme, q, idx).credibility }}/10 · {{ CREDIBILITY_ZONE_LABEL[credibilityZone(getJustification(activeTheme, q, idx).credibility)] }}
                        </span>
                      </div>

                      <!-- Analysis [!] — max 2 lines -->
                      <p
                        class="text-[10px] text-slate-600 leading-snug line-clamp-2"
                        :title="getJustification(activeTheme, q, idx).analysis"
                      >
                        <span class="font-bold text-slate-700">Analysis [!]:</span>
                        {{ getJustification(activeTheme, q, idx).analysis }}
                      </p>

                      <!-- Source ["] — max 2 lines -->
                      <p
                        class="text-[10px] text-slate-500 leading-snug line-clamp-2"
                        :title="getJustification(activeTheme, q, idx).knowledgeBase"
                      >
                        <span class="font-bold text-slate-600">Source [&quot;]:</span>
                        {{ getJustification(activeTheme, q, idx).knowledgeBase }}
                      </p>

                      <!-- Planner's per-suggestion Because/Sources — shown when ticked -->
                      <template v-if="isTicked(activeTheme.id, q.id, idx)">
                        <div class="border-t border-indigo-100 pt-1.5 space-y-1">
                          <p class="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">
                            Your justification for approving this
                          </p>
                          <div>
                            <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Because [!]: why you approved this</p>
                            <textarea
                              :value="getAnswer(activeTheme.id, q.id).suggBecause?.[idx] ?? ''"
                              placeholder="Optional: your reasoning for approving this suggestion…"
                              rows="2"
                              class="w-full rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700
                                     placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400
                                     transition-colors resize-y"
                              :aria-label="`Because: why you approved suggestion ${idx + 1}`"
                              @input="(e) => setSuggBecause(activeTheme!.id, q.id, idx, (e.target as HTMLTextAreaElement).value)"
                            ></textarea>
                          </div>
                          <div>
                            <p class="text-[9px] font-semibold text-slate-600 mb-0.5">Sources [&quot;]: your references</p>
                            <input
                              type="text"
                              :value="getAnswer(activeTheme.id, q.id).suggSources?.[idx] ?? ''"
                              placeholder="Optional: books, URLs, case studies…"
                              class="w-full rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700
                                     placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400
                                     transition-colors"
                              :aria-label="`Sources: references for approving suggestion ${idx + 1}`"
                              @input="(e) => setSuggSources(activeTheme!.id, q.id, idx, (e.target as HTMLInputElement).value)"
                            />
                          </div>
                        </div>
                      </template>

                    </div><!-- end justification block -->

                  </div><!-- end suggestion chip -->
                </div>

                <!-- Effective answer preview -->
                <div class="rounded-lg bg-emerald-50/60 border border-emerald-200 px-3 py-2">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1">
                    Effective answer
                    <span class="font-normal text-slate-400 normal-case">(typed + all ticked suggestions)</span>
                  </p>
                  <p
                    v-if="effectiveAnswer(activeTheme.id, q.id, q.suggestedAnswers).trim().length > 0"
                    class="text-[11px] text-slate-800 whitespace-pre-wrap leading-snug"
                  >{{ effectiveAnswer(activeTheme.id, q.id, q.suggestedAnswers) }}</p>
                  <p v-else class="text-[11px] text-slate-400 italic">
                    (empty — type an answer or tick a suggestion to populate)
                  </p>
                </div>

              </div><!-- end questions loop -->

              <!-- ── Bottom Navigation Mirror (DD-014) ────────────────────── -->
              <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 flex-wrap">
                <button
                  type="button"
                  class="text-sm px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-600
                         hover:bg-slate-100 hover:border-slate-400 transition-colors disabled:opacity-30"
                  :disabled="activeThemeIndex === 0"
                  :title="`Previous theme: ${SOLUTION_SHARP_THEMES[activeThemeIndex - 1]?.title ?? ''}`"
                  @click="prevTheme"
                >← Previous theme</button>

                <span class="text-xs text-slate-400 font-mono">
                  Theme {{ activeThemeIndex + 1 }} / {{ SOLUTION_SHARP_THEMES.length }}
                  · {{ answeredCount }} answered
                </span>

                <button
                  type="button"
                  class="text-sm px-4 py-2 rounded-xl border border-orange-300 bg-orange-50 text-orange-700
                         hover:bg-orange-100 hover:border-orange-400 transition-colors font-semibold
                         disabled:opacity-30"
                  :disabled="activeThemeIndex === SOLUTION_SHARP_THEMES.length - 1"
                  :title="`Next theme: ${SOLUTION_SHARP_THEMES[activeThemeIndex + 1]?.title ?? ''}`"
                  @click="nextTheme"
                >Next theme →</button>
              </div>

            </template>
          </ScrollContainer>
          </div><!-- end main pane wrapper -->

        </div><!-- end interview body -->

        <!--
          ── Change Review panel ──────────────────────────────────────────────
          Tom Gilb 2026-06-08: "I cannot see any 'done sharpening' — integrate
          into the Planguage Plan Sharpened Version, List Changes, Seek Approval
          to change the Master Plan."
          Shown when showChanges = true. All proposed changes start approved (true);
          planner unchecks to reject before integrating.
        -->
        <div v-else class="flex-1 flex flex-col min-h-0">

          <!-- Change Review sub-header: Row 1 — title + bulk approve controls -->
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
            <!-- Approve All / Reject All — only visible in Review tab -->
            <div v-if="changeView === 'review'" class="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                class="text-[11px] px-2.5 py-1 rounded-lg border border-emerald-400 bg-emerald-800/60 text-emerald-200
                       hover:bg-emerald-700/60 transition-colors font-semibold"
                title="Approve all displayed changes — tick all items"
                @click="approveAllDisplayed"
              >✓ Approve All</button>
              <button
                type="button"
                class="text-[11px] px-2.5 py-1 rounded-lg border border-slate-500 bg-slate-700/60 text-slate-300
                       hover:bg-slate-600/60 transition-colors"
                title="Reject all displayed changes — untick all items"
                @click="rejectAllDisplayed"
              >✕ Reject All</button>
            </div>
          </div>

          <!-- Row 2 — tab strip -->
          <div class="flex items-center gap-0 px-5 bg-slate-700 flex-shrink-0 border-b border-slate-600">
            <button
              type="button"
              class="text-[11px] px-4 py-2 font-semibold transition-colors border-b-2"
              :class="changeView === 'review'
                ? 'text-white border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'"
              title="Review proposed changes and approve or reject each one"
              @click="changeView = 'review'"
            >✓ Review Changes</button>
            <button
              type="button"
              class="text-[11px] px-4 py-2 font-semibold transition-colors border-b-2"
              :class="changeView === 'history'
                ? 'text-white border-indigo-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'"
              title="Saved versions — restore, compare, or approve to Master Plan"
              @click="changeView = 'history'"
            >💾 Past Versions ({{ savedVersions.length }})</button>
            <button
              type="button"
              class="text-[11px] px-4 py-2 font-semibold transition-colors border-b-2"
              :class="changeView === 'compare'
                ? 'text-white border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'"
              title="Compare two versions side-by-side"
              @click="changeView = 'compare'"
            >⇄ Compare</button>
          </div>

          <!-- ── TAB: Review Changes ──────────────────────────────────────────── -->
          <template v-if="changeView === 'review'">

            <!-- Version restored banner -->
            <div
              v-if="activeVersionId"
              class="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0"
            >
              <span class="text-[11px] text-amber-800 font-semibold">
                Viewing saved version: <b>{{ activeVersion?.label }}</b>
                ({{ activeVersion?.savedAt }})
              </span>
              <button
                type="button"
                class="text-[10px] px-2.5 py-0.5 rounded border border-amber-400 bg-amber-100 text-amber-800
                       hover:bg-amber-200 transition-colors font-medium ml-auto"
                title="Return to the live sharpening session"
                @click="returnToLiveSession"
              >↩ Return to Live Session</button>
            </div>

            <!-- Empty state -->
            <div v-if="displayedChanges.length === 0" class="flex-1 flex items-center justify-center">
              <div class="text-center text-slate-400 px-8 py-12">
                <p class="text-sm font-semibold text-slate-600 mb-1">No answers to integrate yet</p>
                <p class="text-xs leading-relaxed mb-4">Work through the 26 themes and answer at least one question,<br>
                then click <b>✓ Done Sharpening</b> to review your proposed changes.</p>
                <button
                  type="button"
                  class="text-xs px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-600
                         hover:bg-slate-100 transition-colors font-medium"
                  title="Return to the sharpening interview"
                  @click="showChanges = false"
                >← Back to Interview</button>
              </div>
            </div>

            <!-- Proposed-change list — grouped by outputType -->
            <ScrollContainer v-else class="flex-1 min-h-0 relative" inner-class="p-5 space-y-3">

              <!-- ── Group: New Solutions ──────────────────────────────────────── -->
              <template v-if="displayedChanges.filter(c => c.outputType === 'new-solution').length > 0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block" aria-hidden="true" />
                  → New Solution Entries
                  <span class="font-normal text-emerald-500">({{ displayedChanges.filter(c => c.outputType === 'new-solution').length }})</span>
                </p>
                <div
                  v-for="change in displayedChanges.filter(c => c.outputType === 'new-solution')"
                  :key="change.key"
                  class="rounded-xl border bg-white overflow-hidden transition-opacity"
                  :class="change.approved ? 'border-emerald-200' : 'border-slate-200 opacity-50'"
                >
                  <label
                    class="flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    :class="change.approved ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'"
                    :title="`${change.approved ? 'Untick to reject' : 'Tick to approve'}: ${change.themeTitle} — ${change.questionText}`"
                  >
                    <input
                      type="checkbox"
                      :checked="change.approved"
                      class="mt-0.5 flex-shrink-0 accent-emerald-600 cursor-pointer w-4 h-4"
                      :aria-label="`Approve proposed S. entry from: ${change.themeTitle} — ${change.questionText}`"
                      @change="toggleDisplayedChange(change)"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-0.5">
                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">NEW Solution</span>
                        <span class="text-[10px] text-slate-500 font-medium">{{ change.themeTitle }}</span>
                      </div>
                      <p class="text-[11px] text-slate-500 italic leading-snug">{{ change.questionText }}</p>
                    </div>
                    <span class="flex-shrink-0 text-[10px] font-semibold" :class="change.approved ? 'text-emerald-600' : 'text-slate-400'">
                      {{ change.approved ? 'Approved' : 'Rejected' }}
                    </span>
                  </label>
                  <div class="px-4 py-2.5 border-t bg-white" :class="change.approved ? 'border-emerald-100' : 'border-slate-100'">
                    <p class="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Proposed Planguage Solution Entry</p>
                    <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ change.effectiveText }}</p>
                  </div>
                </div>
              </template>

              <!-- ── Group: Improved Solutions ────────────────────────────────── -->
              <template v-if="displayedChanges.filter(c => c.outputType === 'improved-solution').length > 0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1.5 pt-1">
                  <span class="w-2 h-2 rounded-full bg-orange-400 inline-block" aria-hidden="true" />
                  → Improved Solution Entries
                  <span class="font-normal text-orange-500">({{ displayedChanges.filter(c => c.outputType === 'improved-solution').length }})</span>
                </p>
                <div
                  v-for="change in displayedChanges.filter(c => c.outputType === 'improved-solution')"
                  :key="change.key"
                  class="rounded-xl border bg-white overflow-hidden transition-opacity"
                  :class="change.approved ? 'border-orange-200' : 'border-slate-200 opacity-50'"
                >
                  <label
                    class="flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    :class="change.approved ? 'bg-orange-50/70 hover:bg-orange-50' : 'bg-slate-50 hover:bg-slate-100'"
                    :title="`${change.approved ? 'Untick to reject' : 'Tick to approve'}: ${change.themeTitle} — ${change.questionText}`"
                  >
                    <input
                      type="checkbox"
                      :checked="change.approved"
                      class="mt-0.5 flex-shrink-0 accent-orange-600 cursor-pointer w-4 h-4"
                      :aria-label="`Approve improved S. entry from: ${change.themeTitle} — ${change.questionText}`"
                      @change="toggleDisplayedChange(change)"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-0.5">
                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300">IMPROVED Solution</span>
                        <span class="text-[10px] text-slate-500 font-medium">{{ change.themeTitle }}</span>
                      </div>
                      <p class="text-[11px] text-slate-500 italic leading-snug">{{ change.questionText }}</p>
                    </div>
                    <span class="flex-shrink-0 text-[10px] font-semibold" :class="change.approved ? 'text-orange-600' : 'text-slate-400'">
                      {{ change.approved ? 'Approved' : 'Rejected' }}
                    </span>
                  </label>
                  <div class="px-4 py-2.5 border-t bg-white" :class="change.approved ? 'border-orange-100' : 'border-slate-100'">
                    <p class="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Proposed Planguage Solution Entry (Improvement)</p>
                    <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ change.effectiveText }}</p>
                  </div>
                </div>
              </template>

              <!-- ── Group: New Values ─────────────────────────────────────────── -->
              <template v-if="displayedChanges.filter(c => c.outputType === 'new-value').length > 0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1.5 pt-1">
                  <span class="w-2 h-2 rounded-full bg-violet-400 inline-block" aria-hidden="true" />
                  → New Value Entries
                  <span class="font-normal text-violet-500">({{ displayedChanges.filter(c => c.outputType === 'new-value').length }})</span>
                </p>
                <div
                  v-for="change in displayedChanges.filter(c => c.outputType === 'new-value')"
                  :key="change.key"
                  class="rounded-xl border bg-white overflow-hidden transition-opacity"
                  :class="change.approved ? 'border-violet-200' : 'border-slate-200 opacity-50'"
                >
                  <label
                    class="flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    :class="change.approved ? 'bg-violet-50/70 hover:bg-violet-50' : 'bg-slate-50 hover:bg-slate-100'"
                    :title="`${change.approved ? 'Untick to reject' : 'Tick to approve'}: ${change.themeTitle} — ${change.questionText}`"
                  >
                    <input
                      type="checkbox"
                      :checked="change.approved"
                      class="mt-0.5 flex-shrink-0 accent-violet-600 cursor-pointer w-4 h-4"
                      :aria-label="`Approve proposed V. entry from: ${change.themeTitle} — ${change.questionText}`"
                      @change="toggleDisplayedChange(change)"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-0.5">
                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-300">NEW Value</span>
                        <span class="text-[10px] text-slate-500 font-medium">{{ change.themeTitle }}</span>
                      </div>
                      <p class="text-[11px] text-slate-500 italic leading-snug">{{ change.questionText }}</p>
                    </div>
                    <span class="flex-shrink-0 text-[10px] font-semibold" :class="change.approved ? 'text-violet-600' : 'text-slate-400'">
                      {{ change.approved ? 'Approved' : 'Rejected' }}
                    </span>
                  </label>
                  <div class="px-4 py-2.5 border-t bg-white" :class="change.approved ? 'border-violet-100' : 'border-slate-100'">
                    <p class="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">Proposed Planguage Value Entry</p>
                    <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ change.effectiveText }}</p>
                  </div>
                </div>
              </template>

            </ScrollContainer>
          </template>

          <!-- ── TAB: Version History ─────────────────────────────────────────── -->
          <template v-else-if="changeView === 'history'">
            <div v-if="savedVersions.length === 0" class="flex-1 flex items-center justify-center">
              <div class="text-center text-slate-400 px-8 py-12">
                <p class="text-3xl mb-3">💾</p>
                <p class="text-sm font-semibold text-slate-600 mb-1">No saved versions yet</p>
                <p class="text-xs leading-relaxed mb-4">
                  Switch to <b>Review Changes</b> and click <b>💾 Save Version</b> to snapshot the current session.<br>
                  Saved versions can be restored, compared, or approved to the Master Plan independently.
                </p>
              </div>
            </div>
            <ScrollContainer v-else class="flex-1 min-h-0 relative" inner-class="p-5 space-y-3">
              <div
                v-for="ver in savedVersions"
                :key="ver.id"
                class="rounded-xl border bg-white overflow-hidden"
                :class="ver.id === activeVersionId ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-slate-200'"
              >
                <!-- Version card header -->
                <div class="flex items-start gap-3 px-4 py-3">
                  <div class="flex-1 min-w-0">
                    <!-- Label — inline rename [*]→[**] -->
                    <div v-if="editingVerId === ver.id" class="flex items-center gap-2 mb-0.5">
                      <input
                        v-model="editingVerLabel"
                        type="text"
                        class="flex-1 text-sm font-bold rounded border border-indigo-300 px-2 py-0.5
                               focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        :aria-label="`Rename version: ${ver.label}`"
                        @keydown.enter="commitRenameVersion"
                        @keydown.escape="cancelRenameVersion"
                      />
                      <button type="button"
                        class="text-[10px] px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold"
                        title="Save new name" @click="commitRenameVersion">Save</button>
                      <button type="button"
                        class="text-[10px] px-2 py-0.5 rounded border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Cancel rename" @click="cancelRenameVersion">✕</button>
                    </div>
                    <div v-else class="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h4 class="text-sm font-bold text-slate-800 truncate">{{ ver.label }}</h4>
                      <button
                        type="button"
                        class="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-400
                               hover:text-indigo-600 hover:border-indigo-300 transition-colors font-mono"
                        :title="`Rename version: ${ver.label}`"
                        @click="startRenameVersion(ver)"
                      >[*]→[**]</button>
                      <span
                        class="text-[9px] px-1.5 py-0.5 rounded-full border font-semibold"
                        :class="ver.status === 'integrated'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300'"
                      >{{ ver.status === 'integrated' ? '✓ Integrated' : 'Draft' }}</span>
                    </div>
                    <p class="text-[10px] text-slate-400">
                      Saved {{ ver.savedAt }}
                      · {{ ver.changes.filter(c => c.approved).length }} approved of {{ ver.changes.length }} changes
                    </p>
                    <p v-if="ver.notes" class="text-[10px] text-slate-500 italic mt-0.5">{{ ver.notes }}</p>
                  </div>
                  <span
                    v-if="ver.id === activeVersionId"
                    class="text-[9px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 font-semibold flex-shrink-0"
                  >Active</span>
                </div>
                <!-- Version card actions -->
                <div class="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex-wrap">
                  <button
                    type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-indigo-700
                           hover:bg-indigo-50 transition-colors font-semibold"
                    :title="`Restore '${ver.label}' — load its changes into the Review tab`"
                    @click="restoreVersion(ver.id)"
                  >↩ Restore / Review</button>
                  <button
                    type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-700
                           hover:bg-sky-50 transition-colors font-medium"
                    :title="`Compare '${ver.label}' to the live session`"
                    @click="openCompare(ver.id, null)"
                  >⇄ Compare to Live</button>
                  <button
                    type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600
                           hover:bg-slate-100 transition-colors font-medium"
                    :title="`Copy colourful HTML of '${ver.label}' to clipboard`"
                    @click="copyVersionHtml(ver)"
                  >[*]=[*] Copy HTML</button>
                  <div class="flex-1" />
                  <button
                    v-if="ver.status !== 'integrated'"
                    type="button"
                    class="text-[11px] px-3 py-1.5 rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-700
                           hover:bg-emerald-100 transition-colors font-semibold"
                    :title="`Approve '${ver.label}' and integrate its approved changes into the Master Plan`"
                    @click="approveVersionToMaster(ver)"
                  >✓ Approve → Master Plan</button>
                  <button
                    type="button"
                    class="text-[11px] px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-500
                           hover:bg-red-50 hover:border-red-300 transition-colors"
                    :title="`Permanently delete '${ver.label}' — this cannot be undone`"
                    @click="deleteVersion(ver.id)"
                  >✕ Delete</button>
                </div>
              </div>
            </ScrollContainer>
          </template>

          <!-- ── TAB: Compare ─────────────────────────────────────────────────── -->
          <template v-else-if="changeView === 'compare'">
            <ScrollContainer class="flex-1 min-h-0 relative" inner-class="p-5 space-y-4">

              <!-- Version selectors -->
              <div class="flex items-center gap-4 p-3 rounded-xl bg-slate-100 border border-slate-200">
                <div class="flex-1">
                  <label class="text-[9px] font-bold uppercase tracking-wider text-sky-700 block mb-1">Left (A)</label>
                  <select
                    class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white
                           focus:outline-none focus:ring-1 focus:ring-sky-400"
                    :value="compareIds[0] ?? ''"
                    @change="compareIds[0] = ($event.target as HTMLSelectElement).value || null"
                  >
                    <option value="">Live Session</option>
                    <option v-for="ver in savedVersions" :key="ver.id" :value="ver.id">{{ ver.label }}</option>
                  </select>
                </div>
                <span class="text-slate-400 font-bold text-lg">⇄</span>
                <div class="flex-1">
                  <label class="text-[9px] font-bold uppercase tracking-wider text-rose-700 block mb-1">Right (B)</label>
                  <select
                    class="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white
                           focus:outline-none focus:ring-1 focus:ring-rose-400"
                    :value="compareIds[1] ?? ''"
                    @change="compareIds[1] = ($event.target as HTMLSelectElement).value || null"
                  >
                    <option value="">Live Session</option>
                    <option v-for="ver in savedVersions" :key="ver.id" :value="ver.id">{{ ver.label }}</option>
                  </select>
                </div>
              </div>

              <!-- Colour legend -->
              <div class="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-sky-100 border border-sky-300 inline-block" />Left (A) only</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" />Right (B) only</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block" />Both — different approval</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 inline-block" />Both — same approval</span>
              </div>

              <!-- Column headers -->
              <div class="grid grid-cols-2 gap-3">
                <div class="text-[10px] font-bold text-sky-700 uppercase tracking-wide px-1">
                  A: {{ versionLabel(compareIds[0]) }}
                </div>
                <div class="text-[10px] font-bold text-rose-700 uppercase tracking-wide px-1">
                  B: {{ versionLabel(compareIds[1]) }}
                </div>
              </div>

              <!-- Compare rows — one row per unique change key -->
              <div
                v-for="slot in compareSlots"
                :key="slot.key"
                class="grid grid-cols-2 gap-0 rounded-xl overflow-hidden border"
                :class="!slot.left
                  ? 'border-rose-200'
                  : !slot.right
                  ? 'border-sky-200'
                  : slot.left.approved === slot.right.approved
                  ? 'border-emerald-200'
                  : 'border-amber-300'"
              >
                <!-- Left cell -->
                <div class="p-3" :class="!slot.left ? 'bg-slate-50/50' : 'bg-sky-50/40'">
                  <p v-if="!slot.left" class="text-[10px] text-slate-400 italic text-center py-4">(not in A)</p>
                  <template v-else>
                    <span class="text-[9px] font-semibold block mb-1"
                      :class="slot.left.approved ? 'text-emerald-600' : 'text-slate-400'">
                      {{ slot.left.approved ? '✓ Approved' : '✕ Rejected' }}
                    </span>
                    <p class="text-[10px] text-slate-600 font-medium mb-0.5">{{ slot.themeTitle }}</p>
                    <p class="text-[9px] text-slate-400 italic mb-1 leading-snug">{{ slot.questionText }}</p>
                    <p class="text-[10px] text-slate-800 leading-snug">{{ slot.left.effectiveText }}</p>
                  </template>
                </div>
                <!-- Right cell -->
                <div class="p-3 border-l" :class="!slot.right ? 'bg-slate-50/50 border-slate-100' : 'bg-rose-50/40 border-rose-100'">
                  <p v-if="!slot.right" class="text-[10px] text-slate-400 italic text-center py-4">(not in B)</p>
                  <template v-else>
                    <span class="text-[9px] font-semibold block mb-1"
                      :class="slot.right.approved ? 'text-emerald-600' : 'text-slate-400'">
                      {{ slot.right.approved ? '✓ Approved' : '✕ Rejected' }}
                    </span>
                    <p class="text-[10px] text-slate-600 font-medium mb-0.5">{{ slot.themeTitle }}</p>
                    <p class="text-[9px] text-slate-400 italic mb-1 leading-snug">{{ slot.questionText }}</p>
                    <p class="text-[10px] text-slate-800 leading-snug">{{ slot.right.effectiveText }}</p>
                  </template>
                </div>
              </div>

              <p v-if="compareSlots.length === 0" class="text-center text-slate-400 text-xs py-8">
                No changes to compare — both selections are empty or identical.
              </p>

            </ScrollContainer>
          </template>

        </div><!-- end change review body -->

        <!-- ── Footer ────────────────────────────────────────────────────────── -->
        <!--
          Export button on all windows rule (Tom Gilb 2026-06-08):
          Three actions: Copy (clipboard only) · Email (clipboard + ⌘V banner + Mail auto-open) · Download (HTML file)
          No Markdown — colourful flat-table HTML only (Colorful HTML Spec Email Rule, SUPREME).
        -->
        <!--
          Footer — two modes:
          (a) Interview mode (!showChanges): progress + Start Fresh + export trio + Done Sharpening CTA
          (b) Change Review mode (showChanges): Back + approved count + Integrate primary CTA
              (mirrors the bottom CTA inside the ScrollContainer per DD-014 — always visible at fold)
        -->
        <footer class="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs flex-shrink-0 flex-wrap">

          <!-- ── Interview footer ─────────────────────────────────────────── -->
          <template v-if="!showChanges">
            <span class="text-slate-600">
              <span class="font-bold">{{ answeredCount }}</span> / {{ totalQuestions }} questions answered
              ({{ SOLUTION_SHARP_THEMES.filter(t => answeredInTheme(t) > 0).length }} of 26 themes explored)
            </span>
            <div class="flex-1" />
            <!-- Start Fresh -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300
                     hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
              title="Clear ALL Solution Sharpening answers (cannot be undone)"
              @click="onClearConfirm"
            >Start Fresh</button>
            <!-- Copy — colourful HTML to clipboard -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-300
                     hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-xs font-semibold"
              title="Copy colourful HTML to clipboard — paste with ⌘V into Mail, Notes, Keynote, Word"
              @click="onExportCopy"
            >[*]=[*] Copy HTML</button>
            <!-- Email — clipboard + ⌘V banner + Mail auto-open to Tom@Gilb.com -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-white bg-orange-600 hover:bg-orange-700
                     transition-colors text-xs font-bold"
              title="Export as colourful HTML — copies to clipboard, opens Mail to Tom@Gilb.com, press ⌘V in body for colour"
              @click="onExportEmail"
            >[*]---→[*] Export + Email</button>
            <!-- Download — saves .html file -->
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300
                     hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
              title="Download as standalone colourful HTML file — opens in Safari immediately"
              @click="onExportDownload"
            >*→[*] Download HTML</button>
            <!-- ✓ Done Sharpening — primary CTA (Tom Gilb 2026-06-08: MOVE principle, always visible) -->
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700
                     transition-colors text-xs font-bold shadow-sm"
              title="Done sharpening — review all proposed changes, approve or reject, then integrate into Master Plan"
              @click="onDoneSharpening"
            >✓ Done Sharpening</button>
          </template>

          <!-- ── Change Review footer — tab-aware MOVE mirror ──────────────────── -->
          <template v-else>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300
                     hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
              title="Return to the sharpening interview to continue answering questions"
              @click="showChanges = false"
            >← Back to Interview</button>
            <div class="flex-1" />
            <!-- Review tab footer actions -->
            <template v-if="changeView === 'review'">
              <span class="text-slate-500 font-mono">
                <span class="font-bold text-emerald-600">{{ displayedApprovedCount }}</span>
                of {{ displayedChanges.length }} approved
                <template v-if="activeVersionId"> · <span class="text-amber-600 text-[10px]">saved version</span></template>
              </span>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-300
                       hover:bg-indigo-100 transition-colors text-xs font-semibold"
                title="Save a named snapshot of this version"
                @click="saveCurrentVersion"
              >💾 Save Version</button>
              <button
                v-if="activeVersionId === null"
                type="button"
                class="px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700
                       transition-colors text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="displayedApprovedCount === 0"
                title="Copy colourful HTML to clipboard + open Mail to Tom@Gilb.com — paste ⌘V into body"
                @click="onIntegrateChanges"
              >Integrate Approved → Plan</button>
              <button
                v-else
                type="button"
                class="px-4 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700
                       transition-colors text-xs font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="displayedApprovedCount === 0"
                :title="`Approve saved version '${activeVersion?.label}' → Master Plan`"
                @click="activeVersion && approveVersionToMaster(activeVersion)"
              >✓ Approve → Master Plan</button>
            </template>
            <!-- History tab footer -->
            <template v-else-if="changeView === 'history'">
              <span class="text-slate-500 font-mono text-[10px]">{{ savedVersions.length }} saved version{{ savedVersions.length === 1 ? '' : 's' }}</span>
            </template>
            <!-- Compare tab footer -->
            <template v-else-if="changeView === 'compare'">
              <span class="text-slate-500 font-mono text-[10px]">
                A: {{ versionLabel(compareIds[0]) }} ⇄ B: {{ versionLabel(compareIds[1]) }}
              </span>
            </template>
          </template>

        </footer>

      </div>
    </div>
  </Teleport>
</template>
