<!-- SharpenPanel.vue — Sharpening Cycles UI
     Shows after spec generation (inline, Stage 1) or from the nav bar (modal).

     Props:  spec     — the current SpecBlock to sharpen
             modal    — when true, renders as a Teleport overlay (nav-triggered use)
     Emits:  sharpened(SpecBlock)  — a round completed; parent should update currentSpec
             done                  — user clicked "Sharp Enough" / "Done"; parent may proceed

     KEY DESIGN RULE: the "Sharp Enough" / "Done" close button is ALWAYS visible and
     ALWAYS clickable, regardless of the current phase. Phase only affects what appears
     in the body panel below the header. This prevents the button from disappearing mid-round. -->

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { openEml, textToEmailHtml } from '../composables/useEmlExport'
import {
  exportEmail,
  htmlDocumentShell,
  htmlEsc,
  softWrap,
} from '../composables/useExportShared'
import {
  useSharpen,
  type SharpenCategory,
  type SharpenRound,
  type PlannerSuggestionMode,
} from '../composables/useSharpen'
import SharpenDiffList from './SharpenDiffList.vue'
import SpecActionFooter from './SpecActionFooter.vue'
import CloseDot from './CloseDot.vue'
import PlanIdentityBand from './PlanIdentityBand.vue'  // r41 v92 (Tom Gilb 2026-06-16 "go phase 2")
import CopyGlyph  from './icons/CopyGlyph.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
import JustificationGlyph from './icons/JustificationGlyph.vue'
import type { SpecBlock } from '../types/spec'
import ScrollContainer from './ScrollContainer.vue'
import PriorityActionButton from './PriorityActionButton.vue'
import { useInputSafetyNet } from '../composables/useInputSafetyNet'
import { useSpecHistory }    from '../composables/useSpecHistory'
import { useSpecLock }       from '../composables/useSpecLock'
import AmuseMeButton from './AmuseMeButton.vue'
// r41 v79 (Tom Gilb 2026-06-16 "the sharpening q and a needs export badly
// everywhere now") — Sharpening Q&A export per the SUPREME "Export button
// on all windows" rule.  copySharpen + emailSharpen + previewSharpen all
// build the same colourful HTML capturing every Round (category + Qs +
// As + AI suggestions + spec changes) and route through the standard
// dual-MIME clipboard + Mail.app pipeline.
import { copySharpen, emailSharpen, previewSharpen } from '../composables/useSharpenExport'
import { getLastClipboardResult } from '../composables/useExportShared'
import { useToast }          from '../composables/useToast'

const props = defineProps<{
  spec: SpecBlock
  /** When true: renders as a fixed full-screen overlay via Teleport */
  modal?: boolean
  /** Plan name + version for the export header.  Optional — falls back to
   *  "Sharpening Q&A" if absent. */
  planName?: string
  planVersion?: string
  /** r41 v92 (Tom Gilb 2026-06-16 "go phase 2") — identity band fields. */
  planOwner?: string
  generatedAt?: string
}>()

const emit = defineEmits<{
  sharpened:      [spec: SpecBlock]
  done:           []
  'open-visualise': []
  'open-global-priority': []
  'open-priority-info': []
  /** r41 v92 — bubble history selection to App.vue. */
  'select-history': [versionId: string]
}>()

const {
  phase,
  currentCategory,
  currentQuestions,
  rounds,
  loading,
  error,
  openQLoading,
  openQError,
  plannerActionLoading,
  plannerActionError,
  SHARPEN_CATEGORIES,
  startSharpen,
  submitSharpenAnswers,
  fetchOpenAnswers,
  processPlannerSuggestion,
  cancelSharpen,
} = useSharpen()

// ── Standard Done-Changing Close Process (DD-standard-close-2026-06-09) ─────
const { isLocked, lock, unlock } = useSpecLock()
const { addVersion: _addSpecSnapshot } = useSpecHistory()
/** Count of sharpening rounds completed since the last version snapshot. */
const _roundsCompleted = ref(0)
const _lastSaved       = ref<Date | null>(null)

// ── r41 v79 — Sharpening Q&A export ─────────────────────────────────────────
const { showToast: _showSharpenToast } = useToast()
const _effectivePlanName = computed(() => props.planName?.trim() || 'Planning Spec')
const _effectivePlanVersion = computed(() => props.planVersion?.trim() || undefined)
/** Whether enough Q&A state exists to make an export meaningful — at least
 *  one completed round OR the current round has at least one question
 *  loaded. */
const sharpenExportReady = computed<boolean>(() =>
  rounds.value.length > 0 || currentQuestions.value.length > 0,
)
async function onCopySharpen(): Promise<void> {
  if (!sharpenExportReady.value) {
    _showSharpenToast('Nothing to export yet — answer at least one Sharpening question first.', 4500)
    return
  }
  // Include the current in-progress round (if any) alongside completed rounds.
  const exportRounds = _buildExportRounds()
  try {
    // r41 v85 — pass live spec so renderer can surface per-field source attribution
    await copySharpen(exportRounds, _effectivePlanName.value, _effectivePlanVersion.value, props.spec)
    // r41 v81 — surface the truth about what landed on clipboard.
    const result = getLastClipboardResult()
    if (result === 'html+plain') {
      _showSharpenToast('📋 Sharpening Q&A copied — ✓ COLOUR HTML on clipboard.  Paste into Mail, Notes, Keynote, Claude, ChatGPT, anywhere.', 6000)
    } else if (result === 'plain-fallback') {
      _showSharpenToast('⚠ Colour HTML write FAILED — only plain text on clipboard.  Open DevTools Console for the error.  Common fix: click in the SEM App first, then click 📋 Copy again.', 12000)
    } else {
      _showSharpenToast('⚠ Clipboard write FAILED entirely.  Open Console for the error.', 12000)
    }
  } catch (e) {
    _showSharpenToast(`Copy failed — ${String(e).slice(0, 80)}`, 6000)
  }
}
async function onEmailSharpen(): Promise<void> {
  if (!sharpenExportReady.value) {
    _showSharpenToast('Nothing to email yet — answer at least one Sharpening question first.', 4500)
    return
  }
  const exportRounds = _buildExportRounds()
  try {
    // r41 v85 — pass live spec so renderer can surface per-field source attribution
    await emailSharpen(exportRounds, _effectivePlanName.value, _effectivePlanVersion.value, props.spec)
    // r41 v81 — surface the truth about what landed on clipboard.
    const result = getLastClipboardResult()
    if (result === 'html+plain') {
      _showSharpenToast('📨 Mail opening — type recipient + ⌘V the COLOUR Q&A.  ✓ Colour HTML on clipboard.  If paste lands plain anyway: Mail → Format → Make Rich Text.', 9000)
    } else if (result === 'plain-fallback') {
      _showSharpenToast('⚠ Colour HTML write FAILED — Mail will open with plain-text-only on clipboard.  Open DevTools Console for the error.  Common fix: click in the SEM App first, then click 📨 Mail again.', 12000)
    } else {
      _showSharpenToast('⚠ Clipboard write FAILED entirely.  Mail will open but nothing will paste.  Open Console for the error.', 12000)
    }
  } catch (e) {
    _showSharpenToast(`Email failed — ${String(e).slice(0, 80)}`, 6000)
  }
}
function onPreviewSharpen(): void {
  if (!sharpenExportReady.value) {
    _showSharpenToast('Nothing to preview yet — answer at least one Sharpening question first.', 4500)
    return
  }
  previewSharpen(_buildExportRounds(), _effectivePlanName.value, _effectivePlanVersion.value, props.spec)
}
/** Build the rounds array for export — completed rounds + (if in progress)
 *  the current category snapshot so the user can export mid-flow without
 *  needing to finish a round first.
 *
 *  Bug fix 2026-06-22 (Tom Gilb report: "I DID THIS ROUND AND ANSWERED
 *  QUESTION BUT THE MAIL VERSION CLAIMS NOT Q ANSWERED").  Root cause: this
 *  function was pushing the raw `answers.value` textarea contents — which
 *  are empty when the user ticked a suggestion chip without ALSO typing
 *  free-text.  The committed-round path (line ~748) correctly uses
 *  effectiveAnswers() which fuses chips + typed text; the mid-flow export
 *  path silently dropped the chip-only answers.  Renderer downstream
 *  correctly translated empty → "(skipped)", so the export looked like the
 *  user had skipped every chip-only question.  Fix: call effectiveAnswers()
 *  on the in-progress round, same as round submission does. */
function _buildExportRounds() {
  const completed = [...rounds.value] as Array<typeof rounds.value[number]>
  if (currentCategory.value && currentQuestions.value.length > 0 && phase.value !== 'idle') {
    completed.push({
      category:  currentCategory.value,
      questions: [...currentQuestions.value],
      answers:   effectiveAnswers(),
      changes:   [],
    })
  }
  return completed
}

// Local answer state — reset when a new category starts
const answers = ref<string[]>([])

// Input Safety Net — protect every sharpen answer the user types from
// inadvertent erase. answers is an array of strings; each non-empty index
// gets its own per-field snapshot ring via watchArrayField.
const _safetyNet = useInputSafetyNet()
_safetyNet.watchArrayField('sharpen-answer', answers)

// Multi-select suggestion chips — tracks which chip(s) are selected per question.
// Each Set holds the suggestion text strings that are currently toggled on.
// Reset whenever a new category starts, alongside `answers`.
const selectedSugs = ref<Set<string>[]>([])

/** Toggle a suggestion chip on/off for question index qi. */
function toggleSuggestion(qi: number, sug: string): void {
  const next = selectedSugs.value.map(s => new Set(s))
  if (!next[qi]) next[qi] = new Set()
  next[qi].has(sug) ? next[qi].delete(sug) : next[qi].add(sug)
  selectedSugs.value = next
}

/**
 * Build the effective answer list for submission.
 * For each question: join selected chips (in order they appear) + free-text textarea content.
 * Either part may be empty — only non-empty parts are included, joined by "; ".
 */
function effectiveAnswers(): string[] {
  return currentQuestions.value.map((q, i) => {
    const chips = q.suggestions.filter(s => selectedSugs.value[i]?.has(s))
    const typed = (answers.value[i] ?? '').trim()
    return [...chips, ...(typed ? [typed] : [])].join('; ')
  })
}

// Local toggle for the "Show changes" collapsible section (idle state, across all rounds)
const changesOpen = ref(false)

// ── Post-round results state ──────────────────────────────────────────────
// After every refining round completes the panel pauses in this "results"
// view before returning to the category picker.  The user sees the F/V/S
// change counts for the round that just finished and can expand a full diff
// before choosing to sharpen again or exit.
const showRoundResult     = ref(false)
const justCompletedRound  = ref<SharpenRound | null>(null)
const roundResultDiffOpen = ref(false)

// ── Copy + Email (round results) ─────────────────────────────────────────────
const sharpenCopyDone = ref(false)
let _sharpenCopyTimer: ReturnType<typeof setTimeout> | null = null

// ── Q&A Justification [?!"] — suggestion group context pins ─────────────────
// UI-only; not persisted. Key = question index (i). When open, shows the
// AI source layer badge + category context for the suggestion group.
const openJustifications = ref<Set<number>>(new Set())
function isJustOpen(i: number): boolean { return openJustifications.value.has(i) }
function toggleJust(i: number): void {
  const next = new Set(openJustifications.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  openJustifications.value = next
}

/** Per-type change counts for the round that just completed. */
const roundResultCounts = computed(() => {
  const r = justCompletedRound.value
  if (!r) return { F: 0, V: 0, S: 0, total: 0 }
  const F = r.changes.filter(c => c.entryType === 'F').length
  const V = r.changes.filter(c => c.entryType === 'V').length
  const S = r.changes.filter(c => c.entryType === 'S').length
  return { F, V, S, total: F + V + S }
})

/** Dismiss the round-results view and return to the category picker. */
function dismissRoundResult(): void {
  showRoundResult.value     = false
  justCompletedRound.value  = null
  roundResultDiffOpen.value = false
  sharpenCopyDone.value     = false
  if (_sharpenCopyTimer) { clearTimeout(_sharpenCopyTimer); _sharpenCopyTimer = null }
}

function buildSharpenPlainText(): string {
  const r = justCompletedRound.value
  if (!r) return ''
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const lines: string[] = [
    `Sharpening Changes — ${r.category.label} — ${date}`,
    '',
  ]
  r.changes.forEach(c => {
    const typeLabel = c.entryType === 'F' ? 'Function' : c.entryType === 'V' ? 'Value' : 'Solution'
    lines.push(`${c.status === 'added' ? 'ADDED' : 'MODIFIED'} ${typeLabel} ${c.id}`)
    if (c.status === 'added') {
      Object.entries(c.after).forEach(([f, v]) => { if (v) lines.push(`  ${f}: ${v}`) })
    } else {
      c.changedFields.forEach(f => {
        const before = c.before?.[f] ?? ''
        const after  = c.after[f]  ?? ''
        lines.push(`  ${f}: "${before}" → "${after}"`)
      })
    }
    lines.push('')
  })
  return lines.join('\n').trim()
}

async function copySharpenAll(): Promise<void> {
  try {
    await navigator.clipboard.writeText(buildSharpenPlainText())
  } catch {
    // Clipboard API blocked — silently ignore (button still reveals Email pin)
  }
  sharpenCopyDone.value = true
  if (_sharpenCopyTimer) clearTimeout(_sharpenCopyTimer)
  _sharpenCopyTimer = setTimeout(() => { sharpenCopyDone.value = false }, 12000)
}

/** Builds a colourful flat-table HTML for the completed sharpening round.
 *  Amber/white scheme — grouped by entry type (Function / Value / Solution).
 *  Per Colorful HTML Spec Email Rule: ONE flat table, no nested tables,
 *  bgcolor= on every cell. */
function buildSharpenColorHtml(): string {
  const r = justCompletedRound.value
  if (!r) return ''
  const date    = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const catLabel = r.category.label
  const fChanges = r.changes.filter(c => c.entryType === 'F')
  const vChanges = r.changes.filter(c => c.entryType === 'V')
  const sChanges = r.changes.filter(c => c.entryType === 'S')

  const renderGroup = (label: string, bg: string, changes: typeof r.changes): string => {
    if (changes.length === 0) return ''
    let rows = `<tr><td colspan="2" bgcolor="${bg}" style="background:${bg};color:#ffffff;padding:8px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.1em;">${htmlEsc(label)}</td></tr>`
    for (const c of changes) {
      const statusLabel = c.status === 'added' ? 'ADDED' : 'MODIFIED'
      rows += `<tr>
  <td bgcolor="#fff8f0" style="background:#fff8f0;padding:4px 18px 2px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;color:#92400e;width:80px;">${htmlEsc(statusLabel)}</td>
  <td bgcolor="#fff8f0" style="background:#fff8f0;padding:4px 18px 2px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${htmlEsc(c.id)}</td>
</tr>`
      if (c.status === 'added') {
        for (const [f, v] of Object.entries(c.after)) {
          if (!v) continue
          const lines = softWrap(String(v), 70)
          for (let li = 0; li < lines.length; li++) {
            rows += `<tr>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:${li === 0 ? '2' : '0'}px 18px 0 36px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#92400e;">${li === 0 ? htmlEsc(f) + ':' : ''}</td>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:${li === 0 ? '2' : '0'}px 18px 0 0;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#374151;">${htmlEsc(lines[li])}</td>
</tr>`
          }
        }
      } else {
        for (const f of c.changedFields) {
          const before  = String(c.before?.[f] ?? '')
          const after   = String(c.after[f] ?? '')
          const bLines  = softWrap(before, 65)
          const aLines  = softWrap(after, 65)
          const maxRows = Math.max(bLines.length, aLines.length)
          for (let li = 0; li < maxRows; li++) {
            rows += `<tr>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:${li === 0 ? '2' : '0'}px 18px 0 36px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#92400e;">${li === 0 ? htmlEsc(f) + ':' : ''}</td>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:${li === 0 ? '2' : '0'}px 18px 0 0;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#374151;">${li === 0 ? `<span style="color:#b91c1c;text-decoration:line-through;">${htmlEsc(bLines[0] ?? '')}</span> → ` : ''}${htmlEsc((aLines[li] ?? bLines[li]) ?? '')}</td>
</tr>`
          }
        }
      }
      // spacer row
      rows += `<tr><td bgcolor="#ffffff" height="6" style="background:#ffffff;height:6px;"></td><td bgcolor="#ffffff" style="background:#ffffff;"></td></tr>`
    }
    return rows
  }

  const bodyRows =
    renderGroup('Functions', '#15803d', fChanges) +
    renderGroup('Values', '#6d28d9', vChanges) +
    renderGroup('Solutions', '#c2410c', sChanges)

  const headerHtml = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#d97706" style="background:#d97706;color:#ffffff;padding:8px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">Sharpening Changes — ${htmlEsc(catLabel)}</td></tr>
  <tr><td bgcolor="#f59e0b" style="background:#f59e0b;color:#fff7ed;padding:4px 22px 10px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Exported: ${htmlEsc(date)} · ${r.changes.length} change${r.changes.length === 1 ? '' : 's'}</td></tr>
</table>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #fcd34d;">
  ${bodyRows}
</table>`

  return htmlDocumentShell({ title: `Sharpening Changes — ${catLabel}`, bodyHtml: headerHtml })
}

async function emailSharpenAll(): Promise<void> {
  const r       = justCompletedRound.value
  const subject = `Sharpening Changes — ${r?.category.label ?? 'Spec'}`
  const html    = buildSharpenColorHtml()
  const plain   = buildSharpenPlainText()
  await exportEmail(html, subject, 'Sharpening Changes', plain)
}

// ── Open Critical Question sub-flow ──────────────────────────────────────────
// Appears as the last item in the Q&A panel, below the AI questions.
// Flow:
//   1. Planner types a question → clicks "Get AI Answer Options"
//   2. AI returns 3 answers (openAnswers); planner selects ≥0 and/or types their own
//   3. "Suggest more" → AI returns 3 different answers (passes all prev as context)
//   4. "Enough…" dismisses this section for the current round
//   On "Apply Sharpening" the selected/typed open answers are included as extraQA.
const openQuestion        = ref('')
const openQSubmitted      = ref(false)   // true after first fetch completes
const openQDismissed      = ref(false)   // true after "Enough…" clicked
const openAnswers         = ref<string[]>([])
const selectedOpenAnswers = ref<Set<number>>(new Set())
const plannerOpenAnswer   = ref('')

// Input Safety Net — protect the two open-question free-text inputs.
_safetyNet.watchField('sharpen-open-question',     openQuestion,     (t) => { openQuestion.value     = t })
_safetyNet.watchField('sharpen-planner-open-answer', plannerOpenAnswer, (t) => { plannerOpenAnswer.value = t })
const allPrevOpenAnswers  = ref<string[]>([]) // accumulates across "suggest more" rounds

// ── Planner-suggestion action sub-flow ───────────────────────────────────────
// After the planner types their own answer, four optional action buttons appear:
//   🔍 Analyze This Suggestion
//   💡 Suggest a Better Idea
//   💡 Suggest 5 Better Ideas
//   ✏️ Suggest a Sharper Formulation of My Idea
// AI results are shown as multi-select toggle buttons.
// "None of these. Stop Sharpening [Aspect] for now"  → dismiss open-Q section
// "Solutions... move forward" → lock in selected results, dismiss section
// Confirmed selections are included in extraQA when Apply Sharpening fires.
const plannerActionResults   = ref<string[]>([])
const plannerActionLabel     = ref('')           // human-readable description of what was run
const selectedPlannerResults = ref<Set<number>>(new Set())
const confirmedPlannerResults = ref<string[]>([]) // locked in by "move forward"

function _resetOpenQ(): void {
  // Tell the safety net these clears are intentional (category change /
  // panel reset), not user-erase, so it doesn't raise false Oops offers.
  _safetyNet.markIntentionalClear('sharpen-open-question')
  _safetyNet.markIntentionalClear('sharpen-planner-open-answer')
  openQuestion.value          = ''
  openQSubmitted.value        = false
  openQDismissed.value        = false
  openAnswers.value           = []
  selectedOpenAnswers.value   = new Set()
  plannerOpenAnswer.value     = ''
  allPrevOpenAnswers.value    = []
  plannerActionResults.value  = []
  plannerActionLabel.value    = ''
  selectedPlannerResults.value = new Set()
  confirmedPlannerResults.value = []
}

function toggleOpenAnswer(i: number): void {
  const s = new Set(selectedOpenAnswers.value)
  s.has(i) ? s.delete(i) : s.add(i)
  selectedOpenAnswers.value = s
}

async function handleFetchOpenAnswers(): Promise<void> {
  if (!openQuestion.value.trim() || !currentCategory.value) return
  const opts = await fetchOpenAnswers(props.spec, currentCategory.value, openQuestion.value.trim())
  if (opts.length > 0) {
    openAnswers.value         = opts
    selectedOpenAnswers.value = new Set()
    openQSubmitted.value      = true
  }
}

async function handleSuggestMore(): Promise<void> {
  if (!currentCategory.value) return
  // Accumulate all previously shown answers as context so AI avoids repeating them
  allPrevOpenAnswers.value = [...allPrevOpenAnswers.value, ...openAnswers.value]
  const opts = await fetchOpenAnswers(
    props.spec,
    currentCategory.value,
    openQuestion.value.trim(),
    allPrevOpenAnswers.value,
  )
  if (opts.length > 0) {
    openAnswers.value         = opts
    selectedOpenAnswers.value = new Set()
  }
}

function togglePlannerResult(i: number): void {
  const s = new Set(selectedPlannerResults.value)
  s.has(i) ? s.delete(i) : s.add(i)
  selectedPlannerResults.value = s
}

const ACTION_LABELS: Record<PlannerSuggestionMode, string> = {
  'analyze':      '🔍 Analysis of your suggestion',
  'better-one':   '💡 A better idea',
  'better-five':  '💡 5 better ideas',
  'sharper':      '✏️ Sharper formulation of your idea',
}

async function handlePlannerAction(mode: PlannerSuggestionMode): Promise<void> {
  if (!currentCategory.value) return
  // Reset previous results before each new action
  plannerActionResults.value   = []
  selectedPlannerResults.value = new Set()
  plannerActionLabel.value     = ACTION_LABELS[mode]

  const results = await processPlannerSuggestion(
    props.spec,
    currentCategory.value,
    openQuestion.value.trim(),
    plannerOpenAnswer.value.trim(),
    mode,
  )
  if (results.length > 0) {
    plannerActionResults.value = results
  }
}

function handlePlannerMoveForward(): void {
  // Lock in whatever is selected from the action results
  confirmedPlannerResults.value = [...selectedPlannerResults.value]
    .sort((a, b) => a - b)
    .map(i => plannerActionResults.value[i])
    .filter(Boolean)
  openQDismissed.value = true
}

// ── Loading progress timer ────────────────────────────────────────────────
// Three-tier progress curve — bar always moves, never freezes at 88%:
//   Tier 1 (0 → expected duration): fast linear ramp, 0 % → 88 %
//   Tier 2 (overrun up to 24 s):    slow crawl,       88 % → 96 %
//   Tier 3 (overrun > 24 s):        very slow,        96 % → 99 %
// When loading completes a 600 ms "done flash" shows 100 % in green before
// the answering / idle view replaces the panel.
//
// Expected durations: 'questions' ≈ 8 s, 'refining' ≈ 25 s.
const loadingStartTime = ref<number | null>(null)
const elapsedSeconds   = ref(0)

// ── Running-commentary phase narratives (Tom Gilb 2026-06-16) ────────────────
// Tom verbatim: *"I like the idea of the running commentary of what a stage is
// doing when the progress bar is running. Can you look into doing it on all
// stages?"* Pattern matches the LoadingProgress phases prop ratified 2026-06-03
// and the GENERATION_PHASES rotation in SpecOutput.vue. Each phase pairs an
// elapsed-seconds boundary with a sentence narrating what the AI is conceptually
// doing — visible to the planner during the wait, teaching the Sharpening
// methodology in Planguage-native terms per SEM-teaches-incrementally SUPREME.
interface SharpenNarrativePhase { atSecond: number; message: string }

const SHARPEN_QUESTIONS_PHASES: SharpenNarrativePhase[] = [
  { atSecond: 0,  message: '📥 Reading the spec — pulling the entries this category will sharpen.' },
  { atSecond: 3,  message: '🧠 Identifying gaps + ambiguities — what is missing, vague, or under-specified.' },
  { atSecond: 6,  message: '✍ Drafting Planguage-grounded questions — each one targets one Tom Gilb principle.' },
  { atSecond: 10, message: '🔍 Refining the questions — clarity, brevity, one concept per question.' },
  { atSecond: 15, message: '⏱ Still working — long specs need more questions.  Watchdog active.' },
]

const SHARPEN_REFINING_PHASES: SharpenNarrativePhase[] = [
  { atSecond: 0,  message: '📥 Reading your answers — combining your insights with the current spec.' },
  { atSecond: 5,  message: '🎯 Locating the affected entries — finding which Value / Function / Solution / Constraint / Resource each insight touches.' },
  { atSecond: 12, message: '✍ Drafting field-level edits — Scale / Meter / Tolerable / Goal / Wish updates per insight.' },
  { atSecond: 20, message: '🔗 Cross-linking + validating the Planguage Representation.' },
  { atSecond: 30, message: '🧬 Applying changes — preserving every field you did not change, updating only the targeted ones.' },
  { atSecond: 45, message: '⏱ Still working — long answer sets take longer.' },
]

const currentSharpenNarrative = computed<string>(() => {
  const list = phase.value === 'questions'
    ? SHARPEN_QUESTIONS_PHASES
    : phase.value === 'refining'
      ? SHARPEN_REFINING_PHASES
      : null
  if (!list) return ''
  let pick = list[0].message
  for (const p of list) {
    if (p.atSecond <= elapsedSeconds.value) pick = p.message
    else break
  }
  return pick
})
let _timerHandle: ReturnType<typeof setInterval> | null = null

// Done-flash state — true for 600 ms after each loading phase completes.
const _showDone  = ref(false)
const _donePhase = ref<'questions' | 'refining' | null>(null)

watch(loading, (isLoading, wasLoading) => {
  if (isLoading) {
    // New load started — reset timer
    loadingStartTime.value = Date.now()
    elapsedSeconds.value   = 0
    _timerHandle = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - (loadingStartTime.value ?? Date.now())) / 1000)
    }, 1000)
  } else {
    // Load finished — stop timer
    if (_timerHandle !== null) { clearInterval(_timerHandle); _timerHandle = null }
    loadingStartTime.value = null

    if (wasLoading) {
      // Determine which phase just completed by inspecting where phase landed
      _donePhase.value = phase.value === 'answering' ? 'questions' : 'refining'
      _showDone.value  = true
      setTimeout(() => {
        const completedPhase = _donePhase.value   // capture before clearing
        _showDone.value  = false
        _donePhase.value = null
        elapsedSeconds.value = 0
        // After a refining round completes, pause in the post-round results view
        // so the user can see the F/V/S change counts before choosing the next step.
        if (completedPhase === 'refining' && rounds.value.length > 0) {
          justCompletedRound.value  = rounds.value[rounds.value.length - 1]
          roundResultDiffOpen.value = false
          showRoundResult.value     = true
        }
      }, 600)
    } else {
      elapsedSeconds.value = 0
    }
  }
})

onUnmounted(() => {
  if (_timerHandle !== null) clearInterval(_timerHandle)
})

/**
 * Time-based progress estimate.
 * Questions: 0 % → 99 % (step 1 of 2, expected ≈ 8 s)
 * Refining:  starts at 50 % (step 1 already done) → 99 % (expected ≈ 25 s)
 * Three tiers per phase; never freezes.
 */
const estimatedPct = computed<number>(() => {
  const s = elapsedSeconds.value

  if (phase.value === 'questions') {
    // Step 1 of 2: fast ramp 0 → 88 % in 8 s
    if (s <= 8)  return Math.round((s / 8)  * 88)
    const over = s - 8
    if (over <= 24) return 88 + Math.round((over / 24) * 8)   // 88→96% slow
    return Math.min(99, 96 + Math.round((over - 24) / 10))     // 96→99% very slow
  }

  if (phase.value === 'refining') {
    // Step 2 of 2: bar starts at 50 % (questions already done)
    // Ramp 50 → 88 % over 25 s, then slow-crawl to 99 %
    if (s <= 25) return 50 + Math.round((s / 25) * 38)         // 50→88%
    const over = s - 25
    if (over <= 24) return 88 + Math.round((over / 24) * 8)    // 88→96% slow
    return Math.min(99, 96 + Math.round((over - 24) / 10))     // 96→99% very slow
  }

  return 0
})

/** Percentage shown in the bar — 100 during the done flash. */
const displayPct = computed<number>(() => _showDone.value ? 100 : estimatedPct.value)

/**
 * Total number of planner-provided insights feeding the current refining call.
 *
 * A "main-question insight" counts when EITHER the typed answer is non-empty
 * OR at least one suggestion chip was selected — both feed `effectiveAnswers()`
 * which is what's actually sent to the AI.  Previously only typed answers were
 * counted, so common chips-only flows reported "1 insight" when several
 * questions were genuinely answered.
 *
 * The open critical question counts as one if it has any selected/typed content.
 */
const answeredInsightCount = computed<number>(() => {
  const mainCount = currentQuestions.value.reduce((acc, _q, i) => {
    const typed = (answers.value[i] ?? '').trim()
    const chipsSelected = (selectedSugs.value[i]?.size ?? 0) > 0
    return acc + (typed || chipsSelected ? 1 : 0)
  }, 0)
  const hasOpenContent =
    openQSubmitted.value &&
    !openQDismissed.value &&
    openQuestion.value.trim() &&
    (
      selectedOpenAnswers.value.size > 0 ||
      plannerOpenAnswer.value.trim() ||
      confirmedPlannerResults.value.length > 0
    )
  return mainCount + (hasOpenContent ? 1 : 0)
})

/** Main spinner label — four distinct stages per phase plus done flash. */
const statusLabel = computed<string>(() => {
  const cat = currentCategory.value?.label ?? ''
  if (_showDone.value) {
    return _donePhase.value === 'questions'
      ? `${cat} Questions ready`
      : `${cat} Insights applied`
  }
  const pct = estimatedPct.value
  if (phase.value === 'questions') {
    if (pct < 88) return `Generating ${cat} Questions… (step 1 of 2)`
    if (pct < 96) return `AI is finishing questions — almost there…`
    return `Parsing questions…`
  }
  const n = answeredInsightCount.value
  const insightWord = n === 1 ? 'insight' : 'insights'
  if (phase.value === 'refining') {
    if (pct < 88) return `Updating your plan with ${n} ${cat} ${insightWord}… (step 2 of 2)`
    if (pct < 96) return `Updating your plan with ${n} ${cat} ${insightWord}. Done soon!`
    return `Applying ${cat} changes to your Plan, now…`
  }
  return ''
})

/** Time-remaining hint shown below the progress bar. */
const timeHintLabel = computed<string>(() => {
  if (_showDone.value) return ''
  const s = elapsedSeconds.value
  if (phase.value === 'questions') {
    if (s < 8) return `~${Math.max(1, 8 - s)}s remaining`
    if (s < 23) return 'Taking a little longer than expected…'
    return 'Waiting for AI response…'
  }
  if (phase.value === 'refining') {
    if (s < 25) return `~${Math.max(1, 25 - s)}s remaining`
    if (s < 40) return 'Taking a little longer than expected…'
    return 'Waiting for AI response…'
  }
  return ''
})

async function handleCategoryClick(cat: SharpenCategory): Promise<void> {
  // Visualise is a special category — it opens the diagram modal, no AI Q&A.
  if (cat.key === 'visualise') {
    emit('open-visualise')
    return
  }
  // If a round is already in flight (singleton phase stuck non-idle from a
  // prior aborted attempt), force-reset it before starting a new one — the
  // previous silent return inside startSharpen made the chip click feel dead.
  if (phase.value !== 'idle') {
    console.warn('[Sharpen] Phase was', phase.value, '— resetting before starting', cat.key)
    cancelSharpen()
  }
  // Tell the safety net: this clear is intentional (new category starts),
  // so any previously-captured snapshots for `sharpen-answer-*` should not
  // raise Oops on the array drop to [].
  _safetyNet.markIntentionalClearForPrefix('sharpen-answer-')
  answers.value     = []
  selectedSugs.value = []
  changesOpen.value = false
  dismissRoundResult()
  _resetOpenQ()
  await startSharpen(props.spec, cat)
}

async function handleSubmit(): Promise<void> {
  // If the open-question sub-flow produced selected/typed answers, inject them
  // as an extra QA pair so the refining prompt incorporates them.
  type ExtraQA = { question: string; answer: string }
  const extraQA: ExtraQA[] = []
  if (openQSubmitted.value && openQuestion.value.trim()) {
    const selectedTexts = [...selectedOpenAnswers.value]
      .sort((a, b) => a - b)
      .map(i => openAnswers.value[i])
      .filter(Boolean)
    // Include planner's own text + any confirmed action-result selections
    const combined = [
      ...selectedTexts,
      plannerOpenAnswer.value.trim(),
      ...confirmedPlannerResults.value,
    ].filter(Boolean).join('; ')
    if (combined) extraQA.push({ question: openQuestion.value.trim(), answer: combined })
  }

  const refined = await submitSharpenAnswers(
    props.spec,
    effectiveAnswers(),
    extraQA.length ? extraQA : undefined,
  )
  if (refined) {
    emit('sharpened', refined)
    _roundsCompleted.value++
  }
}

function handleDone(): void {
  // Inline mode ("Sharp Enough"): cancel any in-progress round — the planner
  // is moving on and the round should not linger.
  //
  // Modal mode ("Done sharpening" / ×): only CLOSE the modal, never cancel.
  // The inline SharpenPanel at Stage 1 may own the active round; destroying it
  // here would reset the phase to idle and cause the inline panel to jump back
  // to the category picker or re-generate questions.
  // The "Cancel round" button in the header is the explicit abort path for modal use.
  if (!props.modal) cancelSharpen()
  // Done-Changing process: auto-snapshot if any sharpening rounds were completed.
  if (_roundsCompleted.value > 0 && props.spec) {
    const rCount = _roundsCompleted.value
    const label = `Sharpening · ${rCount} round${rCount !== 1 ? 's' : ''} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    _addSpecSnapshot(props.spec, label)
    _roundsCompleted.value = 0
    _lastSaved.value = new Date()
  }
  emit('done')
}

/** Save a version snapshot mid-session without closing (SpecActionFooter "Save Version"). */
function handleSaveVersionSharpen(): void {
  if (!props.spec || _roundsCompleted.value === 0) return
  const rCount = _roundsCompleted.value
  const label = `Sharpening · ${rCount} round${rCount !== 1 ? 's' : ''} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  _addSpecSnapshot(props.spec, label)
  _roundsCompleted.value = 0
  _lastSaved.value = new Date()
}

function isRoundDone(key: string): boolean {
  return rounds.value.some((r) => r.category.key === key)
}

/** Total entries changed across all rounds (for the "Show changes" button label). */
function totalChanges(): number {
  return rounds.value.reduce((sum, r) => sum + r.changes.length, 0)
}
</script>

<template>
  <!-- ════════════════════════════════════════════════
       INLINE MODE (stage 1 — between spec and Plan)
       ════════════════════════════════════════════════ -->
  <!-- overflow-hidden removed from outer container: Safari clips pointer-event hit-testing at
       border-radius corners when overflow:hidden is set, making the top-right "Sharp Enough"
       button unreachable (same fix already applied to modal mode). rounded-t-2xl on the header
       preserves the clipped gradient corners without affecting pointer events on child buttons. -->
  <div
    v-if="!modal"
    class="w-full max-w-xl mt-6 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm"
  >
    <!-- Header bar — "Sharp Enough" is ALWAYS present here, never gated on phase -->
    <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xl flex-shrink-0" aria-hidden="true">🔪</span>
        <div class="min-w-0">
          <span class="text-sm font-bold text-white tracking-widest uppercase">Sharpening Cycles</span>
          <span v-if="rounds.length > 0" class="ml-2 text-xs text-amber-100">
            {{ rounds.length }} round{{ rounds.length !== 1 ? 's' : '' }} complete
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Cancel current round — only shown when a round is in flight -->
        <button
          v-if="phase !== 'idle'"
          type="button"
          class="text-amber-100 hover:text-white text-xs underline
                 focus:outline-none focus:ring-2 focus:ring-white rounded px-1"
          aria-label="Cancel this sharpening round"
          @click.stop="cancelSharpen"
        >
          Cancel round
        </button>
        <!-- ⚖️ Global Priority — Tom 2026-05-13: needs to be a button here.
             Opens the Global Priority panel; exclusive-surface rule closes
             this Sharpening surface automatically. -->
        <!-- Split-button (DD-002 2026-05-14): glyph half → About modal, action
             half → Global Priority. Hover glyph for the ? hint. -->
        <PriorityActionButton
          label="Edit Priority"
          chrome-class="bg-white/15 text-white"
          rounded-class="rounded-full"
          height-class="h-7"
          text-size-class="text-xs"
          glyph-size-class="h-4"
          action-title="Open Global Priority — rank stakeholders, values, costs, constraints and solutions"
          action-aria-label="Open Global Priority"
          @action="emit('open-global-priority')"
          @info="emit('open-priority-info')"
        />
        <!-- r41 v412 (Tom Gilb 2026-06-28 verbatim "apply sharpening needs
             also to be in top banner, else enough sharpening can be confused
             as accept") — Apply Sharpening mirror in the TOP banner.
             Why this exists: the bottom-of-panel Apply Sharpening button
             (line ~1443) is the canonical primary action when phase ==
             'answering' — but the panel can scroll for many questions, so
             the bottom button can be off-screen.  Without a top mirror, the
             planner sees ONLY "✅ Sharp Enough" in the visible viewport and
             reads it as "Accept these sharpening changes" — semantically
             WRONG.  "Sharp Enough" CLOSES the panel without applying the
             current in-progress round; "Apply Sharpening" ACCEPTS the
             round's edits into the spec.  Two opposite actions sharing a
             green checkmark surface is the trust violation Tom is flagging.
             Phase-gated to `answering` so it only appears when applying is
             meaningful — never competes with Sharp Enough at idle.  This is
             also DD-014 Top-and-Bottom Navigation Mirror SUPREME applied to
             the action button (not just nav) — same lesson, action layer.
             Composes with: MOVE Principle (action visible at-a-glance, no
             scroll-hunt) + Done/You-Can/Continue SUPREME (each action's
             intent is unambiguous at every phase) + accessibility universal-
             baseline (the bottom Apply may be off-screen for any reader) +
             Tom-Repeats-Himself SUPREME (the "confused as accept" wording
             names the exact failure mode of leaving Sharp Enough alone). -->
        <button
          v-if="phase === 'answering'"
          type="button"
          :disabled="loading || openQLoading || plannerActionLoading"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 bg-amber-900 text-amber-50 text-xs font-bold
                 hover:bg-amber-950 active:bg-black
                 disabled:opacity-60 disabled:cursor-not-allowed
                 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-amber-500
                 ring-2 ring-amber-200 shadow-md
                 transition-colors"
          :title="loading ? 'Sharpening in progress…' : '🔪 Apply Sharpening — accept the answers + insights you have entered, mutate the spec, record this as one completed sharpening round'"
          aria-label="Apply Sharpening to spec"
          @click.stop="handleSubmit"
        >
          <span v-if="loading" class="h-3 w-3 animate-spin rounded-full border-2 border-amber-50/40 border-t-amber-50" aria-hidden="true" />
          {{ loading ? 'Sharpening…' : '🔪 Apply Sharpening' }}
        </button>
        <!-- Sharp Enough — ALWAYS present, never hidden by phase.
             r41 v412 — title clarified so the planner sees the contrast with
             "Apply Sharpening" in HoverHint.  Sharp Enough = CLOSE the
             sharpening surface without committing the current in-progress
             round; Apply Sharpening = COMMIT the current round into the
             spec. -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 bg-white text-amber-700 text-xs font-semibold
                 hover:bg-amber-50 active:bg-amber-100
                 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-amber-500
                 transition-colors"
          title="✅ Sharp Enough — done sharpening for now; CLOSE the panel and move on.  Does NOT apply the current in-progress round (use 🔪 Apply Sharpening for that)."
          aria-label="Sharp Enough — proceed to planning without applying the current in-progress round"
          @click.stop="handleDone"
        >
          ✅ Sharp Enough
        </button>
      </div>
    </div>

    <!-- Plan identity band (r41 v92 — Phase 2 sweep) — amber-toned for Sharpen. -->
    <PlanIdentityBand
      :plan-name="planName"
      :plan-owner="planOwner"
      :plan-version="planVersion"
      :generated-at="generatedAt"
      :theme="{ bg: 'bg-amber-700', borderTop: 'border-amber-500', label: 'text-amber-100', pickerBorder: 'border-amber-300' }"
      @select-history="(id: string) => emit('select-history', id)"
    />

    <!-- r41 v79 (Tom Gilb 2026-06-16 verbatim "the sharpening q and a needs
         export badly everywhere now") — Export pin row.  Renders directly
         below the header bar so the Export trio is visible at EVERY phase
         (idle / questions / answering / refining / done-flash).  Three micro-
         pins: 📋 Copy (dual-MIME), 📨 Email (Mail.app + SEM Email Body
         Standard), 👁 Preview (new window with the rendered HTML).  All
         three call onCopySharpen / onEmailSharpen / onPreviewSharpen which
         build the same colourful HTML capturing every Round + Q + A + spec
         change made.  Disabled (greyed) when there's no Q&A yet.  Per the
         SUPREME "Export button on all windows" rule. -->
    <div class="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
      <span class="text-[10px] uppercase tracking-wider font-bold text-amber-700 mr-1">Export Q&amp;A:</span>
      <button
        type="button"
        :disabled="!sharpenExportReady"
        class="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors
               border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400
               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
               focus:outline-none focus:ring-2 focus:ring-amber-400"
        title="Copy the full Sharpening Q&A (colour HTML + plain text) to clipboard — paste into Mail, Notes, Keynote, Claude, ChatGPT, anywhere"
        aria-label="Copy Sharpening Q&A to clipboard"
        @click.stop="onCopySharpen"
      >📋 Copy</button>
      <button
        type="button"
        :disabled="!sharpenExportReady"
        class="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors
               border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400
               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
               focus:outline-none focus:ring-2 focus:ring-amber-400"
        title="Open Mail.app to Tom@Gilb.com with the Sharpening Q&A on the clipboard — press ⌘V in the body to paste the colour version, then Send"
        aria-label="Email Sharpening Q&A"
        @click.stop="onEmailSharpen"
      >📨 Mail</button>
      <button
        type="button"
        :disabled="!sharpenExportReady"
        class="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors
               border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400
               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
               focus:outline-none focus:ring-2 focus:ring-amber-400"
        title="Preview the rendered Sharpening Q&A in a new window — see 100% of what will be exported"
        aria-label="Preview Sharpening Q&A"
        @click.stop="onPreviewSharpen"
      >👁 Preview</button>
      <span v-if="!sharpenExportReady" class="text-[10px] italic text-amber-500 ml-1">
        Answer at least one question to enable export
      </span>
      <span v-else class="text-[10px] italic text-amber-600 ml-1">
        {{ rounds.length }} round{{ rounds.length === 1 ? '' : 's' }} ready · auto-includes current round in progress
      </span>
    </div>

    <!-- Body: post-round results — shown after refining done-flash, before the category picker -->
    <div v-if="phase === 'idle' && !_showDone && showRoundResult" class="px-4 py-4 space-y-4">
      <!-- Round complete header -->
      <div class="flex items-center gap-3">
        <span class="text-3xl leading-none flex-shrink-0" aria-hidden="true">{{ justCompletedRound?.category.emoji }}</span>
        <div>
          <p class="text-sm font-bold text-gray-800">✅ {{ justCompletedRound?.category.label }} — round complete</p>
          <p class="text-[11px] text-gray-500">Here's what changed in your spec</p>
        </div>
      </div>

      <!-- F / V / S change counts — 3-column grid -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-blue-200 bg-blue-50 px-2 py-3 text-center">
          <div class="text-2xl font-bold text-blue-700 leading-none">{{ roundResultCounts.F }}</div>
          <div class="text-[11px] text-blue-600 font-semibold mt-1">Function{{ roundResultCounts.F !== 1 ? 's' : '' }}</div>
          <div class="text-[10px] text-blue-400 mt-0.5">changed</div>
        </div>
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-3 text-center">
          <div class="text-2xl font-bold text-indigo-700 leading-none">{{ roundResultCounts.V }}</div>
          <div class="text-[11px] text-indigo-600 font-semibold mt-1">Value{{ roundResultCounts.V !== 1 ? 's' : '' }}</div>
          <div class="text-[10px] text-indigo-400 mt-0.5">changed</div>
        </div>
        <div class="rounded-lg border border-violet-200 bg-violet-50 px-2 py-3 text-center">
          <div class="text-2xl font-bold text-violet-700 leading-none">{{ roundResultCounts.S }}</div>
          <div class="text-[11px] text-violet-600 font-semibold mt-1">Solution{{ roundResultCounts.S !== 1 ? 's' : '' }}</div>
          <div class="text-[10px] text-violet-400 mt-0.5">changed</div>
        </div>
      </div>

      <!-- No-changes message -->
      <p v-if="roundResultCounts.total === 0" class="text-[11px] text-amber-700 bg-amber-50 rounded-lg border border-amber-200 px-3 py-2">
        No changes were needed — your spec was already well-defined for the
        <strong>{{ justCompletedRound?.category.label }}</strong> dimension.
      </p>

      <!-- "See what changed" — prominent full-width button -->
      <div v-if="roundResultCounts.total > 0">
        <button
          type="button"
          class="w-full flex items-center justify-between px-4 py-2.5 rounded-lg
                 border border-amber-300 bg-white text-amber-800 text-sm font-semibold
                 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          :aria-expanded="roundResultDiffOpen"
          @click="roundResultDiffOpen = !roundResultDiffOpen"
        >
          <span class="flex items-center gap-2">
            <span aria-hidden="true">📋</span>
            {{ roundResultDiffOpen ? 'Hide' : 'See' }} what changed
            <span class="text-amber-500 font-normal text-[11px]">
              ({{ roundResultCounts.total }} {{ roundResultCounts.total === 1 ? 'entry' : 'entries' }})
            </span>
          </span>
          <span aria-hidden="true" class="text-amber-400 text-xs">{{ roundResultDiffOpen ? '▾' : '▸' }}</span>
        </button>
        <div
          v-if="roundResultDiffOpen"
          class="mt-2 rounded-xl border border-amber-200 bg-white divide-y divide-amber-100"
        >
          <SharpenDiffList :rounds="justCompletedRound ? [justCompletedRound] : []" />
        </div>
      </div>

      <!-- Copy + Email row (inline) — both always visible when there are results -->
      <div v-if="roundResultCounts.total > 0" class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold
                 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
          :class="sharpenCopyDone
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50'"
          :aria-label="sharpenCopyDone ? 'Copied to clipboard' : 'Copy sharpening changes as colored HTML table'"
          title="Copy sharpening changes as colored HTML table"
          @click="copySharpenAll"
        >
          <span v-if="sharpenCopyDone" class="font-bold">✓</span>
          <CopyGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
          {{ sharpenCopyDone ? 'Copied' : 'Copy' }}
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold
                 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
          :class="'border-indigo-200 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50'"
          aria-label="Email sharpening changes — opens Mail.app pre-filled"
          title="Email sharpening changes — opens Mail.app pre-filled"
          @click="emailSharpenAll"
        >
          <EmailGlyph size="compact" class="h-3.5 w-auto" aria-label="" />
          Email
        </button>
      </div>

      <!-- Continue to next round -->
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
               bg-amber-500 text-white text-sm font-semibold
               hover:bg-amber-600 active:bg-amber-700
               focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
        @click="dismissRoundResult"
      >
        🔪 Sharpen another dimension
      </button>
    </div>

    <!-- Body: category picker (idle) — hidden during done-flash and during post-round results -->
    <div v-else-if="phase === 'idle' && !_showDone && !showRoundResult" class="px-4 py-4">
      <p class="text-xs font-medium text-amber-800 mb-3">
        <template v-if="rounds.length === 0">
          Choose a dimension to sharpen your spec — or click ✅ Sharp Enough to proceed:
        </template>
        <template v-else>
          Sharp so far! Sharpen another dimension, or click ✅ Sharp Enough to proceed:
        </template>
      </p>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Sharpening dimensions">
        <button
          v-for="cat in SHARPEN_CATEGORIES"
          :key="cat.key"
          type="button"
          :aria-label="`Sharpen ${cat.label}${isRoundDone(cat.key) ? ' (already done)' : ''}`"
          :title="cat.hint"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium
                 transition-all duration-150
                 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
          :class="isRoundDone(cat.key)
            ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400 hover:shadow-sm'"
          @click="handleCategoryClick(cat)"
        >
          <span class="text-base leading-none" aria-hidden="true">{{ cat.emoji }}</span>
          {{ cat.label }}
          <span v-if="isRoundDone(cat.key)" class="text-xs text-green-600 font-bold" aria-hidden="true">✓</span>
        </button>
      </div>

      <!-- Completed rounds summary + Show changes -->
      <div v-if="rounds.length > 0" class="mt-4 space-y-3">
        <div>
          <p class="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Sharpened so far</p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="r in rounds"
              :key="r.category.key"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium"
            >
              {{ r.category.emoji }} {{ r.category.label }}
              <span class="ml-0.5 opacity-70 font-normal">· {{ r.changes.length }}</span>
            </span>
          </div>
        </div>

        <!-- Show changes toggle -->
        <button
          v-if="totalChanges() > 0"
          type="button"
          class="flex items-center gap-1.5 text-[11px] font-medium text-amber-700
                 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-1"
          :aria-expanded="changesOpen"
          aria-controls="sharpen-changes-inline"
          @click="changesOpen = !changesOpen"
        >
          <span aria-hidden="true">{{ changesOpen ? '▾' : '▸' }}</span>
          📋 {{ changesOpen ? 'Hide' : 'Show' }} sharpening changes
          <span class="text-amber-500">({{ totalChanges() }} entries)</span>
        </button>

        <!-- Changes panel (collapsible) -->
        <div
          v-if="changesOpen"
          id="sharpen-changes-inline"
          class="rounded-xl border border-amber-200 bg-white divide-y divide-amber-100"
        >
          <SharpenDiffList :rounds="rounds" />
        </div>
      </div>
    </div>

    <!-- Body: generating questions (also shown during 600 ms done-flash after questions complete) -->
    <div v-else-if="phase === 'questions' || (_showDone && _donePhase === 'questions')" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
      <div class="flex items-center gap-3">
        <div
          v-if="!_showDone"
          class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600"
          aria-hidden="true"
        />
        <span v-else class="text-lg leading-none" aria-hidden="true">✅</span>
        <span class="text-sm font-medium" :class="_showDone ? 'text-green-700 font-semibold' : displayPct >= 88 ? 'text-amber-800' : 'text-amber-700'">
          {{ statusLabel }}
        </span>
      </div>
      <div class="space-y-1.5">
        <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-out"
            :class="_showDone ? 'bg-green-500' : displayPct >= 96 ? 'bg-amber-600' : displayPct >= 88 ? 'bg-amber-500 animate-pulse' : 'bg-amber-500'"
            :style="{ width: displayPct + '%' }"
            role="progressbar"
            :aria-valuenow="displayPct"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="statusLabel"
          />
        </div>
        <p class="text-[11px]" :class="_showDone ? 'text-green-600 font-medium' : displayPct >= 88 ? 'text-amber-700 font-medium' : 'text-amber-500'">
          <template v-if="!_showDone">~{{ displayPct }}% · {{ timeHintLabel }}</template>
          <template v-else>Done</template>
        </p>
      </div>
      <!-- r41 v57 (Tom Gilb 2026-06-16 "running commentary … all stages") —
           Phase-narrative banner: sentence-length description of what the AI
           is conceptually doing right now, rotating with elapsed seconds. -->
      <div
        v-if="!_showDone && currentSharpenNarrative"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 leading-snug"
        role="status"
        aria-live="polite"
      >
        {{ currentSharpenNarrative }}
      </div>
      <!-- AmuseMeButton: sharpening takes 8–30s; entertain the user while waiting -->
      <AmuseMeButton v-if="!_showDone" :is-loading="loading" class="w-full" />
    </div>

    <!-- Body: Q&A (answering) — only shown when not in a done-flash -->
    <div v-else-if="phase === 'answering' && !_showDone" class="px-4 py-4">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-2xl leading-none" aria-hidden="true">{{ currentCategory?.emoji }}</span>
        <div>
          <p class="text-sm font-bold text-amber-800">{{ currentCategory?.label }} Questions</p>
          <p class="text-[11px] text-amber-600">Click a suggestion or type your own — skip anything not yet decided</p>
        </div>
      </div>
      <div class="space-y-5">
        <div v-for="(q, i) in currentQuestions" :key="i" class="space-y-2">
          <label :for="`sharpen-q-${i}`" class="block text-sm font-medium text-gray-800 leading-snug">
            <span class="text-amber-500 font-bold mr-1">{{ i + 1 }}.</span>{{ q.text }}
          </label>
          <!-- Multi-select suggestion chips — click to toggle; selected chips are joined at submit -->
          <div v-if="q.suggestions.length > 0">
            <!-- Suggestion label row + [?!"] Justification pin (DD-009, DD-011) -->
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Suggested answers</span>
              <JustificationGlyph
                :open="isJustOpen(i)"
                @toggle="toggleJust(i)"
              />
            </div>
            <!-- Justification context block — AI source layer (UI-only, not persisted) -->
            <div
              v-if="isJustOpen(i)"
              class="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] space-y-1.5"
            >
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-indigo-700 text-[10px]">[?]</span>
                <span class="text-slate-700"><b>Question source:</b> AI sharpening interview — category <em>{{ currentCategory?.label ?? '—' }}</em></span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-indigo-700 text-[10px]">[!]</span>
                <span class="text-slate-700"><b>Source layer:</b> LLM training — general Planguage + spec-engineering knowledge applied to your current spec</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-indigo-700 text-[10px]">["]</span>
                <span class="text-slate-700"><b>How to use:</b> Tick any suggestion to include it in your effective answer. Add your own typed answer to override or extend.</span>
              </div>
            </div>
            <!-- Chip row -->
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="sug in q.suggestions"
                :key="sug"
                type="button"
                :aria-pressed="!!selectedSugs[i]?.has(sug)"
                :aria-label="`${selectedSugs[i]?.has(sug) ? 'Deselect' : 'Select'} suggestion: ${sug}`"
                :title="`${selectedSugs[i]?.has(sug) ? 'Deselect' : 'Select'}: ${sug}`"
                class="px-2.5 py-1 rounded-full border text-[11px] font-medium
                       focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                :class="selectedSugs[i]?.has(sug)
                  ? 'border-amber-500 bg-amber-400 text-white'
                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-200 hover:border-amber-400'"
                @click="toggleSuggestion(i, sug)"
              >
                <span v-if="selectedSugs[i]?.has(sug)" class="mr-1" aria-hidden="true">✓</span>{{ sug }}
              </button>
            </div>
          </div>
          <!-- Selected chips preview (only when ≥1 chip selected) -->
          <p v-if="selectedSugs[i]?.size" class="text-[10px] text-amber-700 leading-snug">
            <span class="font-semibold">Selected:</span>
            {{ [...(selectedSugs[i] ?? [])].join(' · ') }}
          </p>
          <textarea
            :id="`sharpen-q-${i}`"
            v-model="answers[i]"
            rows="2"
            class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2
                   text-sm text-gray-800 placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
                   resize-none transition-colors"
            placeholder="Add your own thoughts, or leave blank to use the selections above…"
          />
        </div>
      </div>

      <!-- ── Open Critical Question sub-flow ────────────────────────── -->
      <div v-if="!openQDismissed" class="mt-6 pt-5 border-t border-amber-200/70 space-y-3">
        <p class="text-[11px] font-bold text-amber-700 uppercase tracking-widest">💬 Your Critical Question</p>

        <!-- Step 1: question input -->
        <template v-if="!openQSubmitted">
          <label class="block text-sm text-gray-700 leading-snug">
            Ask a critical or challenging question about
            <span class="font-semibold text-amber-800">{{ currentCategory?.label }}</span> here:
          </label>
          <textarea
            v-model="openQuestion"
            rows="2"
            class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2
                   text-sm text-gray-800 placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            :placeholder="`Ask a critical or challenging question about ${currentCategory?.label} here…`"
          />
          <button
            type="button"
            :disabled="!openQuestion.trim() || openQLoading"
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50
                   text-amber-800 text-sm font-semibold hover:bg-amber-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            @click="handleFetchOpenAnswers"
          >
            <span v-if="openQLoading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" aria-hidden="true" />
            {{ openQLoading ? 'Getting options…' : 'Get AI Answer Options →' }}
          </button>
        </template>

        <!-- Step 2+: question + AI answers + planner answer -->
        <template v-else>
          <!-- The question bubble -->
          <div class="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2">
            <p class="text-[10px] text-amber-600 font-bold uppercase tracking-wide mb-0.5">Your question</p>
            <p class="text-sm text-amber-900 font-medium leading-snug">{{ openQuestion }}</p>
          </div>

          <!-- AI loading -->
          <div v-if="openQLoading" class="flex items-center gap-2 py-1">
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
            <span class="text-sm text-amber-700">Getting better answer options…</span>
          </div>

          <!-- AI answers — multi-select -->
          <div v-else-if="openAnswers.length > 0" class="space-y-2">
            <p class="text-[11px] text-gray-500 font-medium">Select one or more answers (or write your own below):</p>
            <button
              v-for="(ans, i) in openAnswers"
              :key="i"
              type="button"
              class="w-full text-left px-3 py-2.5 rounded-lg border text-sm leading-snug
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              :class="selectedOpenAnswers.has(i)
                ? 'border-amber-500 bg-amber-100 text-amber-900 font-medium shadow-sm'
                : 'border-amber-200 bg-white text-gray-700 hover:bg-amber-50 hover:border-amber-300'"
              :aria-pressed="selectedOpenAnswers.has(i)"
              @click="toggleOpenAnswer(i)"
            >
              <span class="mr-2 text-[11px]" aria-hidden="true">{{ selectedOpenAnswers.has(i) ? '✅' : '○' }}</span>{{ ans }}
            </button>
          </div>

          <!-- Planner's own answer -->
          <div class="space-y-1">
            <label class="text-[11px] font-medium text-gray-500 block">
              Or give your own answer about <span class="font-semibold text-amber-800">{{ currentCategory?.label }}</span>:
            </label>
            <textarea
              v-model="plannerOpenAnswer"
              rows="2"
              class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2
                     text-sm text-gray-800 placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              :placeholder="`Give your best shot at a great answer here about ${currentCategory?.label}…`"
            />
          </div>

          <!-- ── Planner-suggestion action buttons ── -->
          <div class="flex flex-wrap gap-2 pt-1">
            <button type="button"
              :disabled="!plannerOpenAnswer.trim() || plannerActionLoading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                     text-amber-800 text-xs font-semibold hover:bg-amber-50
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              @click="handlePlannerAction('analyze')"
            >🔍 Analyze This Suggestion</button>
            <button type="button"
              :disabled="plannerActionLoading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                     text-amber-800 text-xs font-semibold hover:bg-amber-50
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              @click="handlePlannerAction('better-one')"
            >💡 Suggest a Better Idea</button>
            <button type="button"
              :disabled="plannerActionLoading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                     text-amber-800 text-xs font-semibold hover:bg-amber-50
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              @click="handlePlannerAction('better-five')"
            >💡 Suggest 5 Better Ideas</button>
            <button type="button"
              :disabled="!plannerOpenAnswer.trim() || plannerActionLoading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                     text-amber-800 text-xs font-semibold hover:bg-amber-50
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              @click="handlePlannerAction('sharper')"
            >✏️ Suggest a Sharper Formulation of My Idea</button>
          </div>

          <!-- Action loading -->
          <div v-if="plannerActionLoading" class="flex items-center gap-2 py-1">
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
            <span class="text-sm text-amber-700">{{ plannerActionLabel }}…</span>
          </div>

          <!-- Action results — multi-select -->
          <div v-else-if="plannerActionResults.length > 0" class="space-y-2">
            <p class="text-[11px] text-gray-500 font-semibold">{{ plannerActionLabel }}:</p>
            <button
              v-for="(res, i) in plannerActionResults"
              :key="i"
              type="button"
              class="w-full text-left px-3 py-2.5 rounded-lg border text-sm leading-snug
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              :class="selectedPlannerResults.has(i)
                ? 'border-amber-500 bg-amber-100 text-amber-900 font-medium shadow-sm'
                : 'border-amber-200 bg-white text-gray-700 hover:bg-amber-50 hover:border-amber-300'"
              :aria-pressed="selectedPlannerResults.has(i)"
              @click="togglePlannerResult(i)"
            >
              <span class="mr-2 text-[11px]" aria-hidden="true">{{ selectedPlannerResults.has(i) ? '✅' : '○' }}</span>{{ res }}
            </button>

            <!-- Navigation for action results -->
            <div class="flex flex-col gap-2 pt-1">
              <button
                type="button"
                class="w-full px-3 py-2.5 rounded-lg border border-red-200 bg-red-50
                       text-red-700 text-sm font-medium hover:bg-red-100
                       focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                @click="openQDismissed = true"
              >
                ✗ None of these. Stop Sharpening <strong>{{ currentCategory?.label }}</strong> for now
              </button>
              <button
                type="button"
                class="w-full px-3 py-2.5 rounded-lg border border-indigo-300 bg-indigo-50
                       text-indigo-700 text-sm font-semibold hover:bg-indigo-100
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                @click="handlePlannerMoveForward"
              >
                → Solutions we would like to put in our plan are selected, move forward
              </button>
            </div>
          </div>

          <!-- Action error -->
          <p v-if="plannerActionError" class="text-xs text-red-600" role="alert">{{ plannerActionError }}</p>

          <!-- Error (from open-Q fetch) -->
          <p v-if="openQError" class="text-xs text-red-600" role="alert">{{ openQError }}</p>

          <!-- Suggest more (re-fetch 3 AI answer options) -->
          <button
            type="button"
            :disabled="openQLoading"
            class="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white
                   text-amber-700 text-sm font-medium hover:bg-amber-50 hover:border-amber-400
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            @click="handleSuggestMore"
          >
            💭 I did not like any of the answers about <strong>{{ currentCategory?.label }}</strong> — please suggest some more!
          </button>

          <!-- Global escape hatch — always visible -->
          <button
            type="button"
            class="w-full px-3 py-2 rounded-lg border border-green-200 bg-green-50
                   text-green-700 text-sm font-medium hover:bg-green-100
                   focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors"
            @click="openQDismissed = true"
          >
            ✓ Enough Plan Sharpening for <strong>{{ currentCategory?.label }}</strong>, for the moment
          </button>
        </template>
      </div>
      <!-- ─────────────────────────────────────────────────────────────── -->

      <p v-if="error" class="mt-3 text-xs text-red-600" role="alert">{{ error }}</p>
      <button
        type="button"
        :disabled="loading || openQLoading || plannerActionLoading"
        class="mt-5 w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg
               bg-amber-500 text-white text-sm font-semibold
               hover:bg-amber-600 active:bg-amber-700
               disabled:opacity-60 disabled:cursor-not-allowed
               focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
               transition-colors duration-150"
        aria-label="Apply sharpening to spec"
        @click="handleSubmit"
      >
        <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
        {{ loading ? 'Sharpening…' : '🔪 Apply Sharpening' }}
      </button>
    </div>

    <!-- Body: refining (also shown during 600 ms done-flash after refining completes) -->
    <div v-else-if="phase === 'refining' || (_showDone && _donePhase === 'refining')" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
      <div class="flex items-center gap-3">
        <div
          v-if="!_showDone"
          class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600"
          aria-hidden="true"
        />
        <span v-else class="text-lg leading-none" aria-hidden="true">✅</span>
        <span class="text-sm font-medium" :class="_showDone ? 'text-green-700 font-semibold' : displayPct >= 88 ? 'text-amber-800' : 'text-amber-700'">
          {{ statusLabel }}
        </span>
      </div>
      <div class="space-y-1.5">
        <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-out"
            :class="_showDone ? 'bg-green-500' : displayPct >= 96 ? 'bg-amber-600' : displayPct >= 88 ? 'bg-amber-500 animate-pulse' : 'bg-amber-500'"
            :style="{ width: displayPct + '%' }"
            role="progressbar"
            :aria-valuenow="displayPct"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="statusLabel"
          />
        </div>
        <p class="text-[11px]" :class="_showDone ? 'text-green-600 font-medium' : displayPct >= 88 ? 'text-amber-700 font-medium' : 'text-amber-500'">
          <template v-if="!_showDone">~{{ displayPct }}% · {{ timeHintLabel }}</template>
          <template v-else>Done</template>
        </p>
      </div>
      <!-- r41 v57 — phase narrative banner (refining phase) -->
      <div
        v-if="!_showDone && currentSharpenNarrative"
        class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 leading-snug"
        role="status"
        aria-live="polite"
      >
        {{ currentSharpenNarrative }}
      </div>
      <!-- AmuseMeButton: sharpening takes 8–30s; entertain the user while waiting -->
      <AmuseMeButton v-if="!_showDone" :is-loading="loading" class="w-full" />
    </div>
  </div>

  <!-- ════════════════════════════════════════════════
       MODAL MODE (nav-triggered — Teleport to body)
       ════════════════════════════════════════════════ -->
  <Teleport v-if="modal" to="body">
    <!-- Outer container: backdrop + positioning.
         @click.self fires only when the click originates AND ends on THIS div (the dark area),
         not when it bubbles up from the card — no separate backdrop div needed.
         Using @click rather than @pointerup: click is a composed event that requires both
         pointerdown AND pointerup on the same element, so it can never fire from a pointer
         sequence that began before this element was mounted (prevents the "modal opens and
         immediately closes" Safari timing bug where a pointerup from the triggering gesture
         could land on the freshly-teleported backdrop).
         This also avoids the Safari overflow-hidden+border-radius pointer-event clip bug. -->
    <div
      class="fixed inset-0 z-[400] flex items-end sm:items-start justify-center p-4 sm:pt-10 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Sharpening Cycles"
      @click.self="handleDone"
    >

      <!-- Card — overflow-hidden removed: Safari clips pointer-event hit-testing at border-radius
           corners when overflow:hidden is set, making header buttons at top-right unreachable. -->
      <div class="relative w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 shadow-2xl">

        <!-- Modal header — BOTH "Done sharpening" and × are ALWAYS present, never gated on phase.
             rounded-t-2xl compensates for removing overflow-hidden from the card — clips the
             gradient visually at the top-left and top-right corners. -->
        <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xl flex-shrink-0" aria-hidden="true">🔪</span>
            <span class="text-sm font-bold text-white tracking-widest uppercase">Sharpening Cycles</span>
            <span v-if="rounds.length > 0" class="text-xs text-amber-100">
              · {{ rounds.length }} round{{ rounds.length !== 1 ? 's' : '' }}
            </span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Cancel current round — only shown when a round is in flight.
                 Uses plain @click (no .stop) — same pattern as the category picker buttons
                 which are confirmed to work in Safari+Teleport. The outer container uses
                 @click.self (requires both pointerdown AND pointerup on the backdrop div),
                 so a click originating on this button will never double-trigger the backdrop
                 close (event.target is this button, not the backdrop). -->
            <button
              v-if="phase !== 'idle'"
              type="button"
              class="text-amber-100 hover:text-white text-xs underline
                     focus:outline-none focus:ring-2 focus:ring-white rounded px-1"
              aria-label="Cancel this sharpening round"
              @click="cancelSharpen"
            >
              Cancel round
            </button>
            <!-- ⚖️ Global Priority — Tom 2026-05-13: needs to be reachable here too. -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                     bg-white/15 hover:bg-white/25 text-white text-xs font-semibold
                     focus:outline-none focus:ring-2 focus:ring-white
                     transition-colors"
              title="Open Global Priority — rank stakeholders, values, costs, constraints and solutions"
              aria-label="Open Global Priority"
              @click="emit('open-global-priority')"
            >⚖️ Priority</button>
            <!-- r41 v412 — Apply Sharpening mirror in MODAL header.
                 Same rationale as the inline-mode mirror above: without
                 this, "✅ Done sharpening" and "✅ Apply Sharpening" share
                 the green-check vocabulary and the planner reads "Done" as
                 "Accept these changes" — which it is NOT.  Phase-gated to
                 'answering' so it only appears when applying is meaningful. -->
            <button
              v-if="phase === 'answering'"
              type="button"
              :disabled="loading || openQLoading || plannerActionLoading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                     bg-amber-900 text-amber-50 text-xs font-bold
                     hover:bg-amber-950 active:bg-black
                     disabled:opacity-60 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-amber-500
                     ring-2 ring-amber-200 shadow-md
                     transition-colors"
              :title="loading ? 'Sharpening in progress…' : '🔪 Apply Sharpening — accept the answers + insights you have entered, mutate the spec, record this as one completed sharpening round'"
              aria-label="Apply Sharpening to spec"
              @click.stop="handleSubmit"
            >
              <span v-if="loading" class="h-3 w-3 animate-spin rounded-full border-2 border-amber-50/40 border-t-amber-50" aria-hidden="true" />
              {{ loading ? 'Sharpening…' : '🔪 Apply Sharpening' }}
            </button>
            <!-- Done sharpening — ALWAYS present.  r41 v412 — title clarifies
                 the contrast with Apply Sharpening: Done = close without
                 committing the current round; Apply = commit the current
                 round into the spec. -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-amber-700
                     text-xs font-semibold hover:bg-amber-50 active:bg-amber-100
                     focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-amber-500
                     transition-colors"
              title="✅ Done sharpening — done sharpening for now; CLOSE the panel and move on.  Does NOT apply the current in-progress round (use 🔪 Apply Sharpening for that)."
              aria-label="Done sharpening — close panel without applying the current in-progress round"
              @click="handleDone"
            >
              ✅ Done sharpening
            </button>
            <!-- × escape hatch — ALWAYS present -->
            <CloseDot
        variant="on-dark"
        title="Close"
        aria-label="Close sharpening panel"
        @click="handleDone"
      />
          </div>
        </div>

        <!-- Plan identity band (r41 v92 — Phase 2 sweep) — modal version. -->
        <PlanIdentityBand
          :plan-name="planName"
          :plan-owner="planOwner"
          :plan-version="planVersion"
          :generated-at="generatedAt"
          :theme="{ bg: 'bg-amber-700', borderTop: 'border-amber-500', label: 'text-amber-100', pickerBorder: 'border-amber-300' }"
          @select-history="(id: string) => emit('select-history', id)"
        />

        <!-- r41 v79 — Modal-mode Export pin row (same trio as inline mode) -->
        <div class="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
          <span class="text-[10px] uppercase tracking-wider font-bold text-amber-700 mr-1">Export Q&amp;A:</span>
          <button
            type="button"
            :disabled="!sharpenExportReady"
            class="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors
                   border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Copy the full Sharpening Q&A (colour HTML + plain text) to clipboard — paste into Mail, Notes, Keynote, Claude, ChatGPT, anywhere"
            aria-label="Copy Sharpening Q&A to clipboard"
            @click="onCopySharpen"
          >📋 Copy</button>
          <button
            type="button"
            :disabled="!sharpenExportReady"
            class="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors
                   border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Open Mail.app to Tom@Gilb.com with the Sharpening Q&A on the clipboard — press ⌘V in the body to paste the colour version, then Send"
            aria-label="Email Sharpening Q&A"
            @click="onEmailSharpen"
          >📨 Mail</button>
          <button
            type="button"
            :disabled="!sharpenExportReady"
            class="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors
                   border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Preview the rendered Sharpening Q&A in a new window — see 100% of what will be exported"
            aria-label="Preview Sharpening Q&A"
            @click="onPreviewSharpen"
          >👁 Preview</button>
          <span v-if="!sharpenExportReady" class="text-[10px] italic text-amber-500 ml-1">Answer at least one question to enable export</span>
          <span v-else class="text-[10px] italic text-amber-600 ml-1">
            {{ rounds.length }} round{{ rounds.length === 1 ? '' : 's' }} ready · auto-includes current round in progress
          </span>
        </div>

        <!-- Modal body: post-round results — shown after refining done-flash, before category picker -->
        <ScrollContainer v-if="phase === 'idle' && !_showDone && showRoundResult" outer-class="relative" inner-class="px-4 py-4 max-h-[70vh] space-y-4" fade-from="#fffbeb">
          <!-- Round complete header -->
          <div class="flex items-center gap-3">
            <span class="text-3xl leading-none flex-shrink-0" aria-hidden="true">{{ justCompletedRound?.category.emoji }}</span>
            <div>
              <p class="text-sm font-bold text-gray-800">✅ {{ justCompletedRound?.category.label }} — round complete</p>
              <p class="text-[11px] text-gray-500">Here's what changed in your spec</p>
            </div>
          </div>

          <!-- F / V / S change counts -->
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-blue-200 bg-blue-50 px-2 py-3 text-center">
              <div class="text-2xl font-bold text-blue-700 leading-none">{{ roundResultCounts.F }}</div>
              <div class="text-[11px] text-blue-600 font-semibold mt-1">Function{{ roundResultCounts.F !== 1 ? 's' : '' }}</div>
              <div class="text-[10px] text-blue-400 mt-0.5">changed</div>
            </div>
            <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-3 text-center">
              <div class="text-2xl font-bold text-indigo-700 leading-none">{{ roundResultCounts.V }}</div>
              <div class="text-[11px] text-indigo-600 font-semibold mt-1">Value{{ roundResultCounts.V !== 1 ? 's' : '' }}</div>
              <div class="text-[10px] text-indigo-400 mt-0.5">changed</div>
            </div>
            <div class="rounded-lg border border-violet-200 bg-violet-50 px-2 py-3 text-center">
              <div class="text-2xl font-bold text-violet-700 leading-none">{{ roundResultCounts.S }}</div>
              <div class="text-[11px] text-violet-600 font-semibold mt-1">Solution{{ roundResultCounts.S !== 1 ? 's' : '' }}</div>
              <div class="text-[10px] text-violet-400 mt-0.5">changed</div>
            </div>
          </div>

          <!-- No-changes message -->
          <p v-if="roundResultCounts.total === 0" class="text-[11px] text-amber-700 bg-amber-50 rounded-lg border border-amber-200 px-3 py-2">
            No changes were needed — your spec was already well-defined for the
            <strong>{{ justCompletedRound?.category.label }}</strong> dimension.
          </p>

          <!-- "See what changed" button -->
          <div v-if="roundResultCounts.total > 0">
            <button
              type="button"
              class="w-full flex items-center justify-between px-4 py-2.5 rounded-lg
                     border border-amber-300 bg-white text-amber-800 text-sm font-semibold
                     hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              :aria-expanded="roundResultDiffOpen"
              @click="roundResultDiffOpen = !roundResultDiffOpen"
            >
              <span class="flex items-center gap-2">
                <span aria-hidden="true">📋</span>
                {{ roundResultDiffOpen ? 'Hide' : 'See' }} what changed
                <span class="text-amber-500 font-normal text-[11px]">
                  ({{ roundResultCounts.total }} {{ roundResultCounts.total === 1 ? 'entry' : 'entries' }})
                </span>
              </span>
              <span aria-hidden="true" class="text-amber-400 text-xs">{{ roundResultDiffOpen ? '▾' : '▸' }}</span>
            </button>
            <div
              v-if="roundResultDiffOpen"
              class="mt-2 rounded-xl border border-amber-200 bg-white divide-y divide-amber-100"
            >
              <SharpenDiffList :rounds="justCompletedRound ? [justCompletedRound] : []" />
            </div>
          </div>

          <!-- Copy + Email row (modal) -->
          <div v-if="roundResultCounts.total > 0" class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold
                     focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
              :class="sharpenCopyDone
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50'"
              :aria-label="sharpenCopyDone ? 'Copied to clipboard' : 'Copy all changes to clipboard'"
              @click="copySharpenAll"
            >
              <span aria-hidden="true">{{ sharpenCopyDone ? '✓' : '📋' }}</span>
              {{ sharpenCopyDone ? 'Copied' : 'Copy changes' }}
            </button>
            <button
              v-if="sharpenCopyDone"
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-300
                     bg-indigo-50 text-indigo-700 text-xs font-semibold
                     hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
              aria-label="Email the sharpening changes"
              @click="emailSharpenAll"
            >
              <span aria-hidden="true">📧</span> Email this
            </button>
          </div>

          <!-- Continue to next round -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                   bg-amber-500 text-white text-sm font-semibold
                   hover:bg-amber-600 active:bg-amber-700
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
            @click="dismissRoundResult"
          >
            🔪 Sharpen another dimension
          </button>
        </ScrollContainer>

        <!-- Modal body: category picker (idle) — hidden during done-flash and during post-round results -->
        <ScrollContainer v-else-if="phase === 'idle' && !_showDone && !showRoundResult" outer-class="relative" inner-class="px-4 py-4 max-h-[70vh]" fade-from="#fffbeb">
          <p class="text-xs font-medium text-amber-800 mb-3">
            <template v-if="rounds.length === 0">Choose a dimension to sharpen your spec:</template>
            <template v-else>Sharpen another dimension, or click Done:</template>
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="cat in SHARPEN_CATEGORIES"
              :key="cat.key"
              type="button"
              :title="cat.hint"
              class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium
                     transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-400"
              :class="isRoundDone(cat.key)
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100 hover:border-amber-400'"
              @click="handleCategoryClick(cat)"
            >
              <span aria-hidden="true">{{ cat.emoji }}</span>
              {{ cat.label }}
              <span v-if="isRoundDone(cat.key)" class="text-xs text-green-600 font-bold">✓</span>
            </button>
          </div>

          <!-- Completed rounds summary -->
          <div v-if="rounds.length > 0" class="mt-4 space-y-3">
            <div>
              <p class="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Sharpened so far</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="r in rounds"
                  :key="r.category.key"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium"
                >
                  {{ r.category.emoji }} {{ r.category.label }}
                  <span class="ml-0.5 opacity-70 font-normal">· {{ r.changes.length }}</span>
                </span>
              </div>
            </div>

            <!-- Show changes toggle -->
            <button
              v-if="totalChanges() > 0"
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-medium text-amber-700
                     hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded px-1"
              :aria-expanded="changesOpen"
              aria-controls="sharpen-changes-modal"
              @click="changesOpen = !changesOpen"
            >
              <span aria-hidden="true">{{ changesOpen ? '▾' : '▸' }}</span>
              📋 {{ changesOpen ? 'Hide' : 'Show' }} sharpening changes
              <span class="text-amber-500">({{ totalChanges() }} entries)</span>
            </button>

            <!-- Changes panel -->
            <div
              v-if="changesOpen"
              id="sharpen-changes-modal"
              class="rounded-xl border border-amber-200 bg-white divide-y divide-amber-100"
            >
              <SharpenDiffList :rounds="rounds" />
            </div>
          </div>
        </ScrollContainer>

        <!-- Modal body: generating questions (also shown during done-flash) -->
        <div v-else-if="phase === 'questions' || (_showDone && _donePhase === 'questions')" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
          <div class="flex items-center gap-3">
            <div
              v-if="!_showDone"
              class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600"
              aria-hidden="true"
            />
            <span v-else class="text-lg leading-none" aria-hidden="true">✅</span>
            <span class="text-sm font-medium" :class="_showDone ? 'text-green-700 font-semibold' : displayPct >= 88 ? 'text-amber-800' : 'text-amber-700'">
              {{ statusLabel }}
            </span>
          </div>
          <div class="space-y-1.5">
            <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-500 ease-out"
                :class="_showDone ? 'bg-green-500' : displayPct >= 96 ? 'bg-amber-600' : displayPct >= 88 ? 'bg-amber-500 animate-pulse' : 'bg-amber-500'"
                :style="{ width: displayPct + '%' }"
                role="progressbar"
                :aria-valuenow="displayPct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="statusLabel"
              />
            </div>
            <p class="text-[11px]" :class="_showDone ? 'text-green-600 font-medium' : displayPct >= 88 ? 'text-amber-700 font-medium' : 'text-amber-500'">
              <template v-if="!_showDone">~{{ displayPct }}% · {{ timeHintLabel }}</template>
              <template v-else>Done</template>
            </p>
          </div>
          <!-- r41 v57 — phase narrative banner (modal · questions phase) -->
          <div
            v-if="!_showDone && currentSharpenNarrative"
            class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 leading-snug"
            role="status"
            aria-live="polite"
          >
            {{ currentSharpenNarrative }}
          </div>
          <!-- AmuseMeButton: sharpening takes 8–30s; entertain the user while waiting -->
          <AmuseMeButton v-if="!_showDone" :is-loading="loading" class="w-full" />
        </div>

        <!-- Modal body: Q&A — only when not in done-flash -->
        <ScrollContainer v-else-if="phase === 'answering' && !_showDone" outer-class="relative" inner-class="px-4 py-4 max-h-[70vh]" fade-from="#fffbeb">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-2xl" aria-hidden="true">{{ currentCategory?.emoji }}</span>
            <div>
              <p class="text-sm font-bold text-amber-800">{{ currentCategory?.label }} Questions</p>
              <p class="text-[11px] text-amber-600">Click a suggestion or type your own — skip anything not yet decided</p>
            </div>
          </div>
          <div class="space-y-5">
            <div v-for="(q, i) in currentQuestions" :key="i" class="space-y-2">
              <label :for="`sharpen-modal-q-${i}`" class="block text-sm font-medium text-gray-800">
                <span class="text-amber-500 font-bold mr-1">{{ i + 1 }}.</span>{{ q.text }}
              </label>
              <!-- Multi-select suggestion chips — click to toggle; selected chips are joined at submit -->
              <div v-if="q.suggestions.length > 0">
                <!-- Suggestion label row + [?!"] Justification pin (DD-009, DD-011) -->
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Suggested answers</span>
                  <JustificationGlyph
                    :open="isJustOpen(i)"
                      @toggle="toggleJust(i)"
                  />
                </div>
                <!-- Justification context block (UI-only, not persisted) -->
                <div
                  v-if="isJustOpen(i)"
                  class="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] space-y-1.5"
                >
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-indigo-700 text-[10px]">[?]</span>
                    <span class="text-slate-700"><b>Question source:</b> AI sharpening interview — category <em>{{ currentCategory?.label ?? '—' }}</em></span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-indigo-700 text-[10px]">[!]</span>
                    <span class="text-slate-700"><b>Source layer:</b> LLM training — general Planguage + spec-engineering knowledge applied to your current spec</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-indigo-700 text-[10px]">["]</span>
                    <span class="text-slate-700"><b>How to use:</b> Tick any suggestion to include it in your effective answer. Add your own typed answer to override or extend.</span>
                  </div>
                </div>
                <!-- Chip row -->
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="sug in q.suggestions"
                    :key="sug"
                    type="button"
                    :aria-pressed="!!selectedSugs[i]?.has(sug)"
                    :aria-label="`${selectedSugs[i]?.has(sug) ? 'Deselect' : 'Select'} suggestion: ${sug}`"
                    :title="`${selectedSugs[i]?.has(sug) ? 'Deselect' : 'Select'}: ${sug}`"
                    class="px-2.5 py-1 rounded-full border text-[11px] font-medium
                           focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                    :class="selectedSugs[i]?.has(sug)
                      ? 'border-amber-500 bg-amber-400 text-white'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-200 hover:border-amber-400'"
                    @click="toggleSuggestion(i, sug)"
                  >
                    <span v-if="selectedSugs[i]?.has(sug)" class="mr-1" aria-hidden="true">✓</span>{{ sug }}
                  </button>
                </div>
              </div>
              <!-- Selected chips preview (only when ≥1 chip selected) -->
              <p v-if="selectedSugs[i]?.size" class="text-[10px] text-amber-700 leading-snug">
                <span class="font-semibold">Selected:</span>
                {{ [...(selectedSugs[i] ?? [])].join(' · ') }}
              </p>
              <textarea
                :id="`sharpen-modal-q-${i}`"
                v-model="answers[i]"
                rows="2"
                class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="Add your own thoughts, or leave blank to use the selections above…"
              />
            </div>
          </div>

          <!-- ── Open Critical Question sub-flow (modal) ──────────────── -->
          <div v-if="!openQDismissed" class="mt-6 pt-5 border-t border-amber-200/70 space-y-3">
            <p class="text-[11px] font-bold text-amber-700 uppercase tracking-widest">💬 Your Critical Question</p>

            <template v-if="!openQSubmitted">
              <label class="block text-sm text-gray-700 leading-snug">
                Ask a critical or challenging question about
                <span class="font-semibold text-amber-800">{{ currentCategory?.label }}</span> here:
              </label>
              <textarea
                v-model="openQuestion"
                rows="2"
                class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2
                       text-sm text-gray-800 placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                :placeholder="`Ask a critical or challenging question about ${currentCategory?.label} here…`"
              />
              <button
                type="button"
                :disabled="!openQuestion.trim() || openQLoading"
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50
                       text-amber-800 text-sm font-semibold hover:bg-amber-100
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                @click="handleFetchOpenAnswers"
              >
                <span v-if="openQLoading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" aria-hidden="true" />
                {{ openQLoading ? 'Getting options…' : 'Get AI Answer Options →' }}
              </button>
            </template>

            <template v-else>
              <div class="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2">
                <p class="text-[10px] text-amber-600 font-bold uppercase tracking-wide mb-0.5">Your question</p>
                <p class="text-sm text-amber-900 font-medium leading-snug">{{ openQuestion }}</p>
              </div>

              <div v-if="openQLoading" class="flex items-center gap-2 py-1">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
                <span class="text-sm text-amber-700">Getting better answer options…</span>
              </div>

              <div v-else-if="openAnswers.length > 0" class="space-y-2">
                <p class="text-[11px] text-gray-500 font-medium">Select one or more answers (or write your own below):</p>
                <button
                  v-for="(ans, i) in openAnswers"
                  :key="i"
                  type="button"
                  class="w-full text-left px-3 py-2.5 rounded-lg border text-sm leading-snug
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  :class="selectedOpenAnswers.has(i)
                    ? 'border-amber-500 bg-amber-100 text-amber-900 font-medium shadow-sm'
                    : 'border-amber-200 bg-white text-gray-700 hover:bg-amber-50 hover:border-amber-300'"
                  :aria-pressed="selectedOpenAnswers.has(i)"
                  @click="toggleOpenAnswer(i)"
                >
                  <span class="mr-2 text-[11px]" aria-hidden="true">{{ selectedOpenAnswers.has(i) ? '✅' : '○' }}</span>{{ ans }}
                </button>
              </div>

              <div class="space-y-1">
                <label class="text-[11px] font-medium text-gray-500 block">
                  Or give your own answer about <span class="font-semibold text-amber-800">{{ currentCategory?.label }}</span>:
                </label>
                <textarea
                  v-model="plannerOpenAnswer"
                  rows="2"
                  class="w-full rounded-lg border border-amber-200 bg-white px-3 py-2
                         text-sm text-gray-800 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  :placeholder="`Give your best shot at a great answer here about ${currentCategory?.label}…`"
                />
              </div>

              <!-- ── Planner-suggestion action buttons (modal) ── -->
              <div class="flex flex-wrap gap-2 pt-1">
                <button type="button"
                  :disabled="!plannerOpenAnswer.trim() || plannerActionLoading"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                         text-amber-800 text-xs font-semibold hover:bg-amber-50
                         disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                  @click="handlePlannerAction('analyze')"
                >🔍 Analyze This Suggestion</button>
                <button type="button"
                  :disabled="plannerActionLoading"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                         text-amber-800 text-xs font-semibold hover:bg-amber-50
                         disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                  @click="handlePlannerAction('better-one')"
                >💡 Suggest a Better Idea</button>
                <button type="button"
                  :disabled="plannerActionLoading"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                         text-amber-800 text-xs font-semibold hover:bg-amber-50
                         disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                  @click="handlePlannerAction('better-five')"
                >💡 Suggest 5 Better Ideas</button>
                <button type="button"
                  :disabled="!plannerOpenAnswer.trim() || plannerActionLoading"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white
                         text-amber-800 text-xs font-semibold hover:bg-amber-50
                         disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                  @click="handlePlannerAction('sharper')"
                >✏️ Suggest a Sharper Formulation of My Idea</button>
              </div>

              <!-- Action loading (modal) -->
              <div v-if="plannerActionLoading" class="flex items-center gap-2 py-1">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" aria-hidden="true" />
                <span class="text-sm text-amber-700">{{ plannerActionLabel }}…</span>
              </div>

              <!-- Action results — multi-select (modal) -->
              <div v-else-if="plannerActionResults.length > 0" class="space-y-2">
                <p class="text-[11px] text-gray-500 font-semibold">{{ plannerActionLabel }}:</p>
                <button
                  v-for="(res, i) in plannerActionResults"
                  :key="i"
                  type="button"
                  class="w-full text-left px-3 py-2.5 rounded-lg border text-sm leading-snug
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  :class="selectedPlannerResults.has(i)
                    ? 'border-amber-500 bg-amber-100 text-amber-900 font-medium shadow-sm'
                    : 'border-amber-200 bg-white text-gray-700 hover:bg-amber-50 hover:border-amber-300'"
                  :aria-pressed="selectedPlannerResults.has(i)"
                  @click="togglePlannerResult(i)"
                >
                  <span class="mr-2 text-[11px]" aria-hidden="true">{{ selectedPlannerResults.has(i) ? '✅' : '○' }}</span>{{ res }}
                </button>

                <!-- Navigation for action results (modal) -->
                <div class="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    class="w-full px-3 py-2.5 rounded-lg border border-red-200 bg-red-50
                           text-red-700 text-sm font-medium hover:bg-red-100
                           focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                    @click="openQDismissed = true"
                  >
                    ✗ None of these. Stop Sharpening <strong>{{ currentCategory?.label }}</strong> for now
                  </button>
                  <button
                    type="button"
                    class="w-full px-3 py-2.5 rounded-lg border border-indigo-300 bg-indigo-50
                           text-indigo-700 text-sm font-semibold hover:bg-indigo-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                    @click="handlePlannerMoveForward"
                  >
                    → Solutions we would like to put in our plan are selected, move forward
                  </button>
                </div>
              </div>

              <!-- Action error (modal) -->
              <p v-if="plannerActionError" class="text-xs text-red-600" role="alert">{{ plannerActionError }}</p>

              <p v-if="openQError" class="text-xs text-red-600" role="alert">{{ openQError }}</p>

              <button
                type="button"
                :disabled="openQLoading"
                class="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white
                       text-amber-700 text-sm font-medium hover:bg-amber-50 hover:border-amber-400
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                @click="handleSuggestMore"
              >
                💭 I did not like any of the answers about <strong>{{ currentCategory?.label }}</strong> — please suggest some more!
              </button>

              <!-- Global escape hatch (modal) — always visible -->
              <button
                type="button"
                class="w-full px-3 py-2 rounded-lg border border-green-200 bg-green-50
                       text-green-700 text-sm font-medium hover:bg-green-100
                       focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors"
                @click="openQDismissed = true"
              >
                ✓ Enough Plan Sharpening for <strong>{{ currentCategory?.label }}</strong>, for the moment
              </button>
            </template>
          </div>
          <!-- ─────────────────────────────────────────────────────────── -->

          <p v-if="error" class="mt-3 text-xs text-red-600" role="alert">{{ error }}</p>
          <button
            type="button"
            :disabled="loading || openQLoading || plannerActionLoading"
            class="mt-5 w-full flex items-center justify-center gap-2 min-h-[44px] rounded-lg
                   bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600
                   disabled:opacity-60 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
            @click="handleSubmit"
          >
            <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            {{ loading ? 'Sharpening…' : '🔪 Apply Sharpening' }}
          </button>
        </ScrollContainer>

        <!-- Modal body: refining (also shown during done-flash) -->
        <div v-else-if="phase === 'refining' || (_showDone && _donePhase === 'refining')" class="px-4 py-6 space-y-3" role="status" aria-live="polite">
          <div class="flex items-center gap-3">
            <div
              v-if="!_showDone"
              class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600"
              aria-hidden="true"
            />
            <span v-else class="text-lg leading-none" aria-hidden="true">✅</span>
            <span class="text-sm font-medium" :class="_showDone ? 'text-green-700 font-semibold' : displayPct >= 88 ? 'text-amber-800' : 'text-amber-700'">
              {{ statusLabel }}
            </span>
          </div>
          <div class="space-y-1.5">
            <div class="h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-500 ease-out"
                :class="_showDone ? 'bg-green-500' : displayPct >= 96 ? 'bg-amber-600' : displayPct >= 88 ? 'bg-amber-500 animate-pulse' : 'bg-amber-500'"
                :style="{ width: displayPct + '%' }"
                role="progressbar"
                :aria-valuenow="displayPct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="statusLabel"
              />
            </div>
            <p class="text-[11px]" :class="_showDone ? 'text-green-600 font-medium' : displayPct >= 88 ? 'text-amber-700 font-medium' : 'text-amber-500'">
              <template v-if="!_showDone">~{{ displayPct }}% · {{ timeHintLabel }}</template>
              <template v-else>Done</template>
            </p>
          </div>
          <!-- r41 v57 — phase narrative banner (modal · refining phase) -->
          <div
            v-if="!_showDone && currentSharpenNarrative"
            class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 leading-snug"
            role="status"
            aria-live="polite"
          >
            {{ currentSharpenNarrative }}
          </div>
          <!-- AmuseMeButton: sharpening takes 8–30s; entertain the user while waiting -->
          <AmuseMeButton v-if="!_showDone" :is-loading="loading" class="w-full" />
        </div>

      <!-- Standard Done-Changing Close Footer (DD-standard-close-2026-06-09) -->
      <SpecActionFooter
        :change-count="_roundsCompleted"
        :last-saved="_lastSaved"
        :is-locked="isLocked"
        @close="handleDone"
        @save-version="handleSaveVersionSharpen"
        @toggle-lock="isLocked ? unlock() : lock()"
      />
      </div><!-- end card -->
    </div><!-- end outer container -->
  </Teleport>
</template>
