<!-- GetAPlanPanel.vue — "Get A Plan" unified entry point.
     Three tabs:
       📄 Read In      — paste text / URL / file upload → AI parse → use/sharpen/add-to
       🕐 From History — browse plan models + spec versions → load or restore
       🔀 Merge Plans  — multi-select any combination + free text → AI merge → use/sharpen/add-to
     Emits:
       imported(spec)              — replace current plan with spec
       imported-and-sharpen(spec)  — replace + open SharpenPanel immediately
       add-to(spec)                — merge spec into existing live plan
       load-model(model)           — activate a saved PlanModel from history
       restore-version(version)    — restore a saved SpecVersion from history
       close                       — dismiss modal -->

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { exportEmail, exportCopy } from '../composables/useExportShared'
import { useToast } from '../composables/useToast'

const { showToast } = useToast()
import {
  planInputLoading,
  planInputError,
  planInputProgress,
  mergeLoading,
  mergeError,
  extractFromUrl,
  extractFromFile,
  // r41 v184 → v189 (2026-06-18) — direct local Planguage parse + merge.
  // Tom Gilb 2026-06-18 verbatim: "I cannot get the innapolis file in to
  // get parsed.  I do not want or need to go via claudian.  stop it!"
  // The screenshot showed "Send to Claudian failed: Can't find variable:
  // parseAsPlanguage" — root cause was that v184 reverted handleReadInParse /
  // handleMerge to call parseAsPlanguage / mergePlansAsPlanguage directly but
  // the imports were never re-added (they had been removed when v177
  // introduced the Claudian round-trip).  Restored here so the handlers run.
  parseAsPlanguage,
  mergePlansAsPlanguage,
  // Claudian round-trip helpers — kept imported because the back-compat
  // applyClaudianParseResult / applyClaudianMergeResult handlers and the
  // refresh-from-disk pin are still wired in the template even though the
  // primary path no longer uses them.
  requestClaudianParse,
  applyClaudianParseResult,
  loadParseResultFromDisk,
  requestClaudianMerge,
  applyClaudianMergeResult,
  type PlanInputMode,
} from '../composables/useSpecInput'
// r41 v208 — capture the planner's raw initial input (Tom Gilb 2026-06-19
// "INITIAL SPECS: I went back I I could not find the initial input… A
// thought it could be saved immediately as initial input for both
// recovery, and for later analysis and comparison").  Stage to a pending
// key here; App.vue's import handler transfers it to the per-spec key
// once the new spec model has been assigned an id.
import { stagePendingInitialInput } from '../composables/useInitialInput'
import { useSpecModel, type PlanModel } from '../composables/useSpecModel'
import { useSpecHistory, type SpecVersion } from '../composables/useSpecHistory'
import type { SpecBlock } from '../types/spec'
import LoadingProgress, { type LoadingPhase } from './LoadingProgress.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import AmuseMeButton from './AmuseMeButton.vue'
// DD-001 (2026-05-13).
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'

const props = defineProps<{
  /** True when a live spec is already loaded. Used to warn about replacement. */
  hasCurrentPlan?: boolean
  /** r41 v211 (Tom Gilb 2026-06-19 "it goes back to 1.2 but there is no
   *  input so it should go to 1.1 and ideally it would keep or refresh
   *  the previous input").  When App.vue opens this panel for a recovery
   *  flow (empty-spec callout button etc.), it passes the captured
   *  initial-input snapshot here so the relevant Read-In tab + field can
   *  be auto-restored.  Restore only happens when the current matching
   *  field is empty — never silently overwrites in-progress typed text
   *  (No-Silent-Data-Loss SUPREME). */
  restoreSnapshot?: {
    text:   string
    mode:   'text' | 'url' | 'file'
    source?: string
  } | null
}>()

const emit = defineEmits<{
  imported:              [spec: SpecBlock]
  'imported-and-sharpen': [spec: SpecBlock]
  /** imported + apply plan name + owner name before returning */
  'imported-with-meta':  [spec: SpecBlock, meta: { planName: string; ownerName: string }]
  /** imported-and-sharpen + apply plan name + owner name */
  'imported-and-sharpen-with-meta': [spec: SpecBlock, meta: { planName: string; ownerName: string }]
  'add-to':              [spec: SpecBlock]
  'load-model':          [model: PlanModel]
  'restore-version':     [version: SpecVersion]
  /** r41 v264 (Tom Gilb 2026-06-21 "parse failing message again") — when the parse
   *  fails AND the file looks contract-like, the failure banner offers a one-click
   *  jump to the Contracts agent (which handles legal/contract PDFs natively).  Tom
   *  was previously expected to READ the long failure message + manually navigate to
   *  Contracts.  This emit closes the panel + opens Contracts in one step. */
  'open-contracts-agent':[]
  close:                 []
}>()

// ── Top-level tab ──────────────────────────────────────────────────────────────

type TopTab = 'read-in' | 'from-history' | 'merge'
const topTab = ref<TopTab>('read-in')

// ── Running-commentary phase narratives (Tom Gilb 2026-06-16) ────────────────
// Tom verbatim: *"I like the idea of the running commentary of what a stage is
// doing when the progress bar is running.  Can you look into doing it on all
// stages?"*  Pattern matches the SpecOutput.vue GENERATION_PHASES rotation
// and the LoadingProgress phases prop ratified 2026-06-03.  Each phase pairs
// an elapsed-seconds boundary with a short user-facing sentence describing
// what the AI is conceptually working on at that moment.  Picked as the
// LAST phase whose atSecond ≤ elapsed.
const READ_IN_PHASES: LoadingPhase[] = [
  { atSecond: 0,  message: '📥 Reading your input — pulling text from URL / file / paste.' },
  { atSecond: 6,  message: '🧠 Understanding the source — identifying the domain and the planner\'s intent.' },
  { atSecond: 14, message: '🔍 Extracting Planguage entries — naming Stakeholders, Functions, Values, Solutions, Constraints.' },
  { atSecond: 24, message: '🎯 Quantifying Values — drafting Scale / Tolerable / Goal / Wish on each Value entry.' },
  { atSecond: 32, message: '🔗 Cross-linking — wiring Value ↔ Function ↔ Solution + validating the Planguage Representation.' },
  { atSecond: 50, message: '⏱ Still working — long documents legitimately take 60s+.  Watchdog active.' },
]

const MERGE_PHASES: LoadingPhase[] = [
  { atSecond: 0,  message: '📚 Loading all sources — opening each plan / spec / contract for merging.' },
  { atSecond: 6,  message: '🔀 Detecting overlaps — finding shared Stakeholders / Values / Solutions across sources.' },
  { atSecond: 14, message: '🤝 Resolving conflicts — when sources disagree, picking the more recent or more specific.' },
  { atSecond: 24, message: '🧬 Composing the merged spec — preserving every unique entry + dropping duplicates.' },
  { atSecond: 35, message: '🔗 Cross-linking — re-wiring Value ↔ Function ↔ Solution in the merged result.' },
  { atSecond: 50, message: '⏱ Still working — complex merges with many sources take longer.' },
]

function switchTab(t: TopTab): void {
  topTab.value = t
  readInParsed.value   = null
  mergeParsed.value    = null
  planInputError.value = ''
  mergeError.value     = ''
  showFullSpec.value   = false
  copySpecDone.value   = false
}

// ── History data ──────────────────────────────────────────────────────────────

const { allModels }  = useSpecModel()
const { history }    = useSpecHistory()

// ── TAB 1: Read In ─────────────────────────────────────────────────────────────

const readInMode      = ref<PlanInputMode>('text')
const pastedText      = ref('')
const urlInput        = ref('')
const selectedFile    = ref<File | null>(null)
const fileInputRef    = ref<HTMLInputElement | null>(null)

// ── Plan identity — filled before parsing (r25, Tom 2026-06-07) ───────────────
// "I want to be able to name a project and owner early, before input and parsing"
// If set, emitted alongside the spec as 'imported-with-meta' so App.vue can
// apply the name + owner immediately after the plan is loaded.
const planNameInput   = ref('')
const planOwnerInput  = ref('')

function triggerFilePicker(): void {
  fileInputRef.value?.click()
}
const readInParsed    = ref<SpecBlock | null>(null)
const showFullSpec    = ref(false)
const copySpecDone    = ref(false)
let _copySpecTimer: ReturnType<typeof setTimeout> | null = null

// ── r41 v213 (Tom Gilb 2026-06-19) — per-entry selection + provenance ─────────
// Tom's "two-column refit" design: input narrow LEFT + 3×2 type grid RIGHT +
// control panel BOTTOM with per-entry checkboxes.  See r41 v212 design history
// row for the full rationale (was r41 v207 in the dead SpecInputPanel.vue file).

/** Per-entry checkbox state for the parsed Read-In result.  Default = ticked. */
const entrySelection = ref<Record<string, boolean>>({})

/** Provenance map: entry.id → 0-based source line index (heuristic match). */
const entryProvenance = ref<Record<string, number>>({})

/** Apply mode for Generate Spec — Add merges with existing spec; Replace
 *  overwrites.  Default Add per "Never silently destroy work". */
const applyMode = ref<'add' | 'replace'>('add')

/** Ref to the input textarea for provenance scroll-to-line flash. */
const inputTextareaRef = ref<HTMLTextAreaElement | null>(null)

/** Timer for the amber border-flash that signals the matched source line. */
let _flashTimer: ReturnType<typeof setTimeout> | null = null

interface StakeholderEntry {
  id: string; description?: string; definition?: string;
}

/** Build provenance map by heuristic match against source lines. */
function buildProvenance(spec: SpecBlock, src: string): Record<string, number> {
  const lines = src.split(/\r?\n/)
  const out: Record<string, number> = {}
  const stakeholders = (spec as { stakeholderEntries?: StakeholderEntry[] }).stakeholderEntries ?? []
  const all: Array<{ id: string; desc: string }> = [
    ...spec.functions.map(f => ({ id: f.id, desc: f.description ?? '' })),
    ...spec.values.map(v => ({ id: v.id, desc: v.description ?? '' })),
    ...spec.solutions.map(s => ({ id: s.id, desc: s.description ?? '' })),
    ...(spec.constraints ?? []).map(c => ({ id: c.id, desc: c.description ?? '' })),
    ...(spec.resources ?? []).map(r => ({ id: r.id, desc: r.description ?? '' })),
    ...stakeholders.map(sh => ({ id: sh.id, desc: sh.definition ?? sh.description ?? '' })),
  ]
  for (const e of all) {
    const idShort = e.id.replace(/^[A-Z]\./, '').replace(/\s+/g, ' ').toLowerCase().trim()
    const descSnip = (e.desc || '').slice(0, 25).replace(/\s+/g, ' ').toLowerCase().trim()
    let bestLine = -1
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i].toLowerCase()
      if (idShort.length > 3 && L.includes(idShort)) { bestLine = i; break }
      if (descSnip.length > 8 && L.includes(descSnip)) { bestLine = i; break }
    }
    if (bestLine >= 0) out[e.id] = bestLine
  }
  return out
}

/** Initialise per-entry selection to all-ticked after a successful parse. */
function initSelection(spec: SpecBlock): void {
  const sel: Record<string, boolean> = {}
  const stakeholders = (spec as { stakeholderEntries?: StakeholderEntry[] }).stakeholderEntries ?? []
  for (const f of spec.functions)            sel[f.id]  = true
  for (const v of spec.values)               sel[v.id]  = true
  for (const s of spec.solutions)            sel[s.id]  = true
  for (const c of spec.constraints ?? [])    sel[c.id]  = true
  for (const r of spec.resources ?? [])      sel[r.id]  = true
  for (const sh of stakeholders)             sel[sh.id] = true
  entrySelection.value = sel
}

/** Filter the parsed SpecBlock by the per-entry selection map. */
function filteredReadInSpec(): SpecBlock | null {
  const src = readInParsed.value
  if (!src) return null
  const sel = entrySelection.value
  const stakeholders = (src as { stakeholderEntries?: StakeholderEntry[] }).stakeholderEntries ?? []
  const out: SpecBlock = {
    functions:   src.functions.filter(f  => sel[f.id]),
    values:      src.values.filter(v     => sel[v.id]),
    solutions:   src.solutions.filter(s  => sel[s.id]),
    constraints: (src.constraints ?? []).filter(c => sel[c.id]),
    resources:   (src.resources   ?? []).filter(r => sel[r.id]),
    stakes:      src.stakes,
  }
  if (stakeholders.length) {
    (out as { stakeholderEntries?: StakeholderEntry[] }).stakeholderEntries =
      stakeholders.filter(sh => sel[sh.id])
  }
  return out
}

/** Flash the input textarea at the source line that produced this entry. */
function flashSourceLine(entryId: string): void {
  const lineIdx = entryProvenance.value[entryId]
  if (lineIdx == null) return
  const ta = inputTextareaRef.value
  if (!ta) return
  const LINE_PX = 20
  const target  = Math.max(0, lineIdx * LINE_PX - ta.clientHeight / 3)
  ta.scrollTo({ top: target, behavior: 'smooth' })
  ta.classList.add('ring-2', 'ring-amber-400', 'ring-offset-1')
  if (_flashTimer) clearTimeout(_flashTimer)
  _flashTimer = setTimeout(() => {
    ta.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-1')
  }, 1500)
}

/** Live ticked-count across all 6 types. */
const tickedReadInCount = computed(() => {
  if (!readInParsed.value) return 0
  return Object.values(entrySelection.value).filter(Boolean).length
})

/** Stakeholder accessor for template. */
const readInStakeholders = computed<StakeholderEntry[]>(() =>
  ((readInParsed.value as { stakeholderEntries?: StakeholderEntry[] } | null)?.stakeholderEntries ?? [])
)

/** r41 v211 — restore captured initial-input snapshot when the parent opens
 *  this panel for a recovery flow (empty-spec callout button).  Switches
 *  to the matching tab and pre-fills the matching input field, but ONLY
 *  when that field is currently empty (No-Silent-Data-Loss SUPREME — never
 *  overwrites in-progress typed text).  File mode can't actually re-attach
 *  the File object from a name, so we switch the tab + remind the planner
 *  to re-select via the existing Browse picker. */
watch(
  () => props.restoreSnapshot,
  (snap) => {
    if (!snap || !snap.text) return
    if (snap.mode === 'text') {
      if (pastedText.value.trim().length === 0) {
        pastedText.value  = snap.text
        readInMode.value  = 'text'
        showToast(`✓ Previous input restored (${snap.text.length.toLocaleString()} chars). Click 🔍 Parse to try again.`, 4500)
      } else {
        showToast('A previous input exists — current text kept. Clear the textarea to restore the previous input.', 5000)
      }
    } else if (snap.mode === 'url') {
      if (urlInput.value.trim().length === 0) {
        urlInput.value    = snap.text
        readInMode.value  = 'url'
        showToast(`✓ Previous URL restored. Click 🔍 Parse to try again.`, 4500)
      } else {
        showToast('A previous URL exists — current URL kept. Clear the URL field to restore the previous one.', 5000)
      }
    } else if (snap.mode === 'file') {
      readInMode.value = 'file'
      // No way to re-attach a File from a name; the planner must re-select.
      showToast(`Previous file was: ${snap.source ?? snap.text}. Click Browse below to re-select it from your Mac.`, 6000)
    }
  },
  { immediate: true },
)

function selectReadInMode(m: PlanInputMode): void {
  readInMode.value     = m
  readInParsed.value   = null
  planInputError.value = ''
  showFullSpec.value   = false
  copySpecDone.value   = false
}

function handleFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  selectedFile.value   = input.files?.[0] ?? null
  readInParsed.value   = null
  planInputError.value = ''
}

// r41 v177 — Claudian-routed parse flow (replaces the old direct Anthropic
// call).  Three new pieces of state hold the handoff:
//   awaitingClaudian       — true once the planner has clicked Send to Claudian
//   claudianPrompt         — the paste-ready prompt (also pre-copied to clipboard)
//   parseResultPasteText   — bound to the paste-back textarea
//   parseResultPasteError  — friendly error shown when the paste fails to parse
//   refreshBusy            — disables Refresh from disk while a fetch is in flight
//   refreshMessage         — human-readable result of the last Refresh attempt

const awaitingClaudian      = ref(false)
const claudianPrompt        = ref('')
const parseResultPasteText  = ref('')
const parseResultPasteError = ref('')
const refreshBusy           = ref(false)
const refreshMessage        = ref('')
// r41 v181 — DOM refs so we can scrollIntoView the awaiting-Claudian
// block (success) or the error banner (failure) after the planner clicks
// Send to Claudian.  Tom Gilb 2026-06-19 "nada nada" — the awaiting block
// had been rendering BELOW the fold so it looked like nothing happened.
const awaitingPanelRef      = ref<HTMLElement | null>(null)
const errorBannerRef        = ref<HTMLElement | null>(null)

/** r41 v183 — Universal Export per the Export-button-on-all-windows rule.
 *  Tom Gilb 2026-06-19 "no scrollor export on this initial input window".
 *  Builds a colourful HTML snapshot of the panel's current state (Plan
 *  identity + current tab + input source + content + Claudian prompt if
 *  generated + parsed result if applied), copies it to clipboard, AND
 *  auto-opens Mail.app per the SEM Email Body Standard.  Provides an
 *  audit trail / "send myself what I just typed" capability so the
 *  planner can review or share the input snapshot before completing
 *  the Claudian round-trip. */
async function exportInputSnapshot(): Promise<void> {
  const ts = new Date().toLocaleString()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  // r41 v218 — rename "From History" → "Past Versions" per Tom's
  // "getting rid of the term history everywhere" sweep continuation.
  const tabLabel = topTab.value === 'read-in' ? 'Read In' : topTab.value === 'from-history' ? 'Past Versions' : 'Merge Plans'

  const rows: string[] = []
  rows.push('<table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;width:100%;max-width:780px;margin:0 0 14px 0;">')
  rows.push(`<tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;padding:14px 18px;font-size:18px;font-weight:800;line-height:1.4;">Get a Spec — Input Snapshot</td></tr>`)
  rows.push(`<tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font-size:11px;font-style:italic;">Tab: ${esc(tabLabel)} · Exported: ${esc(ts)}</td></tr>`)

  // Plan identity
  if (planNameInput.value.trim() || planOwnerInput.value.trim()) {
    rows.push(`<tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#4c1d95;padding:12px 18px 4px 18px;font-size:14px;font-weight:700;">Plan Identity</td></tr>`)
    rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;padding:6px 18px;font-size:13px;"><strong>Plan name:</strong> ${esc(planNameInput.value.trim() || '—')}</td></tr>`)
    rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;padding:0 18px 8px 18px;font-size:13px;"><strong>Owner name:</strong> ${esc(planOwnerInput.value.trim() || '—')}</td></tr>`)
  }

  // Input source + content
  if (topTab.value === 'read-in') {
    let sourceLabel = ''
    let sourceContent = ''
    if (readInMode.value === 'text') {
      sourceLabel = 'Pasted text'
      sourceContent = pastedText.value
    } else if (readInMode.value === 'url') {
      sourceLabel = 'URL'
      sourceContent = urlInput.value
    } else if (readInMode.value === 'file') {
      sourceLabel = 'File'
      sourceContent = selectedFile.value
        ? `${selectedFile.value.name} (${(selectedFile.value.size / 1024).toFixed(0)} KB)`
        : '—'
    }
    if (sourceContent) {
      rows.push(`<tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#4c1d95;padding:12px 18px 4px 18px;font-size:14px;font-weight:700;">Input Source — ${esc(sourceLabel)}</td></tr>`)
      rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:6px 18px 12px 18px;font-size:12px;font-family:Menlo,Monaco,monospace;line-height:1.5;white-space:pre-wrap;">${esc(sourceContent)}</td></tr>`)
    }

    // Claudian prompt (if generated)
    if (claudianPrompt.value) {
      rows.push(`<tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#4c1d95;padding:12px 18px 4px 18px;font-size:14px;font-weight:700;">Claudian Prompt (already on clipboard)</td></tr>`)
      rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:6px 18px 12px 18px;font-size:11px;font-family:Menlo,Monaco,monospace;line-height:1.5;white-space:pre-wrap;">${esc(claudianPrompt.value)}</td></tr>`)
    }

    // Parsed result (if applied)
    if (readInParsed.value) {
      const r = readInParsed.value
      rows.push(`<tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#4c1d95;padding:12px 18px 4px 18px;font-size:14px;font-weight:700;">Parsed Result</td></tr>`)
      rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;padding:6px 18px 12px 18px;font-size:12px;line-height:1.5;"><strong>${r.functions.length}</strong> ${r.functions.length === 1 ? 'Function' : 'Functions'} · <strong>${r.values.length}</strong> ${r.values.length === 1 ? 'Value' : 'Values'} · <strong>${r.solutions.length}</strong> ${r.solutions.length === 1 ? 'Solution' : 'Solutions'}</td></tr>`)
    }
  }
  rows.push('</table>')

  const html = rows.join('')
  const plain = `Get a Spec — Input Snapshot\nTab: ${tabLabel} · ${ts}\n\nPlan name: ${planNameInput.value.trim() || '—'}\nOwner name: ${planOwnerInput.value.trim() || '—'}\n`

  const ok = await exportCopy(html, plain)
  if (ok) {
    showToast('📤 Input snapshot copied — ⌘V into Mail / Notes / Keynote', 3500)
  } else {
    showToast('Could not copy to clipboard — check browser permissions', 4000)
  }
}

/** r41 v182 — Walk up from the target element finding every scrollable
 *  ancestor and scroll each so the target lands in view.  Vanilla
 *  `scrollIntoView` only scrolls the closest scrollable ancestor; this
 *  Get a Spec panel is nested inside ScrollContainer → Teleport → body, so
 *  several layers need to scroll for the target to actually be visible. */
function _scrollAllAncestorsIntoView(el: HTMLElement | null): void {
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  let parent: HTMLElement | null = el.parentElement
  while (parent) {
    const cs = getComputedStyle(parent)
    const oy = cs.overflowY
    if ((oy === 'auto' || oy === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      const targetTop = el.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - 16
      parent.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
    parent = parent.parentElement
  }
}

async function handleReadInParse(): Promise<void> {
  // r41 v184 — Tom Gilb 2026-06-19 "this is totally screwed up and
  // unnecessary to via claudian at all. just let the input in as usual".
  // Reverted to direct-Anthropic parse: paste/URL/file → extract → call
  // parseAsPlanguage → result lands in readInParsed.  The awaiting-Claudian
  // round-trip is no longer fired by default (the helpers stay in the
  // composable for any future opt-in flow).
  showToast('🔍 Parsing as Planguage…', 1600)

  planInputError.value        = ''
  readInParsed.value          = null
  planInputLoading.value      = true
  planInputProgress.value     = 'Starting…'

  try {
    if (readInMode.value === 'text') {
      if (!pastedText.value.trim()) { planInputError.value = 'Paste some text to parse.'; return }
      planInputProgress.value = 'Parsing as Planguage…'
      readInParsed.value = await parseAsPlanguage(pastedText.value.trim())
    } else if (readInMode.value === 'url') {
      if (!urlInput.value.trim()) { planInputError.value = 'Enter a URL.'; return }
      planInputProgress.value = 'Fetching URL…'
      const text = await extractFromUrl(urlInput.value.trim())
      planInputProgress.value = 'Parsing as Planguage…'
      readInParsed.value = await parseAsPlanguage(text)
    } else {
      if (!selectedFile.value) { planInputError.value = 'Choose a file.'; return }
      const ext = selectedFile.value.name.split('.').pop()?.toLowerCase() ?? ''
      planInputProgress.value = ext === 'pdf'  ? 'Extracting text from PDF…'
                              : ext === 'docx' ? 'Reading Word document…'
                              :                  'Reading file…'
      const { text, isPdf, pdfBase64 } = await extractFromFile(selectedFile.value)
      planInputProgress.value = 'Parsing as Planguage…'
      readInParsed.value = await parseAsPlanguage(text, { isPdf, pdfBase64 })
    }

    if (!readInParsed.value) {
      // r41 v210 (Tom Gilb 2026-06-19 "same fail again") — preserve any
      // specific error message that `parseAsPlanguage` already set INSIDE
      // (e.g. PDF native-extraction failure, URL fetch failure, Anthropic
      // API error message).  Only fall back to the generic try-more-detail
      // message when no specific reason was set.  Earlier rev unconditionally
      // clobbered the specific error, which meant every parse failure looked
      // identical to the planner with zero diagnostic.
      if (!planInputError.value) {
        planInputError.value =
          'Could not extract a Planguage spec from this content.  Try adding more detail, or paste a longer section of the document.'
      }
      showToast('⚠ Parse returned no spec — see error below', 5000)
      await nextTick()
      _scrollAllAncestorsIntoView(errorBannerRef.value)
    } else {
      const r = readInParsed.value
      const totalReal =
        r.functions.length + r.values.length + r.solutions.length +
        (r.constraints?.length ?? 0) + (r.resources?.length ?? 0)
      // r41 v213 — init per-entry selection (all ticked) + build provenance map
      initSelection(r)
      // Source text for provenance is whatever the user supplied — for URL/file
      // modes the extracted text lives in pastedText only when text mode; for
      // those modes mirror the extracted source into pastedText so the
      // provenance flash has a visible scroll target.
      let _sourceForProv = pastedText.value
      if (readInMode.value !== 'text') {
        // The extracted text is already in scope as `text` for URL/file modes
        // but it lives in a closure; for safety, just use what's currently
        // visible in pastedText (which we don't override on URL/file mode).
        // Heuristic: if pastedText is empty (typical), provenance won't fire —
        // which is acceptable (flash gracefully no-ops when no match).
        _sourceForProv = pastedText.value
      }
      entryProvenance.value = buildProvenance(r, _sourceForProv)
      showToast(`✅ Parsed — ${r.functions.length} Functions · ${r.values.length} Values · ${r.solutions.length} Solutions`, 4000)
      // r41 v208 — stage the raw initial input for the spec model that
      // App.vue's import handler is about to create.  SpecBlock has no
      // id; the model id is assigned at import.  The pending key bridges
      // that gap (commitPendingInitialInput runs from the import handler
      // once the new id is known).
      if (readInMode.value === 'text') {
        stagePendingInitialInput({ text: pastedText.value.trim(), mode: 'text' })
      } else if (readInMode.value === 'url') {
        stagePendingInitialInput({ text: urlInput.value.trim(), mode: 'url', source: urlInput.value.trim() })
      } else if (selectedFile.value) {
        // For file uploads, store the file NAME as both text + source — the
        // extracted text landed in the spec parse path; the name is the
        // provenance trail the planner uses to recognise which document it was.
        stagePendingInitialInput({ text: selectedFile.value.name, mode: 'file', source: selectedFile.value.name })
      }
      // r41 v217 (Tom Gilb 2026-06-19) — the r41 v201 auto-emit SUPERSEDED.
      // The new 3×2 grid + per-entry checkbox + Generate Spec button design
      // (r41 v213/v215/v216) replaces the "hidden two-step" failure mode
      // v201 was solving.  Now the planner sees a 6-window review grid
      // IMMEDIATELY on parse-success — that IS the "parsing happened"
      // feedback v201 was creating with the auto-emit.  Auto-emitting would
      // close the modal BEFORE the grid has a chance to render, defeating
      // the entire refit.  The explicit Generate Spec button at the bottom
      // of the control panel is now the apply trigger, with the live
      // ticked-count chip for transparent action.  v201's failure mode
      // (parse seemed to do nothing) is closed by the visible grid, not by
      // auto-applying behind the user's back.
      // Composes with: No-Silent-Data-Loss SUPREME (no silent apply),
      // MOVE Principle (Generate Spec button visible at-a-glance in the
      // control panel — the planner sees what they need to click),
      // Permission Tiers GREEN (per-entry ticked apply is explicit + safe).
      void totalReal // referenced for future grid-summary use
    }
  } catch (err) {
    planInputError.value = err instanceof Error ? err.message : 'An unexpected error occurred.'
    showToast(`⚠ Parse failed — ${planInputError.value.slice(0, 80)}`, 6000)
    await nextTick()
    _scrollAllAncestorsIntoView(errorBannerRef.value)
  } finally {
    planInputLoading.value  = false
    planInputProgress.value = ''
  }
}

/** r41 v177 — Apply Claudian's pasted result.  Parses the paste; sets
 *  `readInParsed` on success so the existing result view renders; surfaces
 *  a friendly error on failure. */
function handleApplyParseResult(): void {
  parseResultPasteError.value = ''
  try {
    const spec = applyClaudianParseResult(parseResultPasteText.value)
    if (!spec) {
      parseResultPasteError.value = 'The pasted result did not contain any Functions or Values.  Ask Claudian to re-parse with more context.'
      return
    }
    readInParsed.value          = spec
    awaitingClaudian.value      = false
    claudianPrompt.value        = ''
    parseResultPasteText.value  = ''
  } catch (err) {
    parseResultPasteError.value = err instanceof Error ? err.message : 'Could not parse the pasted result.'
  }
}

/** r41 v177 — Pull a batch result Claudian wrote to
 *  `public/data/getAPlanResult.json`.  Same path the Stakeholder Mapper
 *  Refresh-from-disk uses.  Friendly banner on success or empty file. */
async function handleRefreshFromDisk(): Promise<void> {
  refreshBusy.value    = true
  refreshMessage.value = ''
  try {
    const { spec, reason } = await loadParseResultFromDisk()
    if (spec) {
      readInParsed.value         = spec
      awaitingClaudian.value     = false
      claudianPrompt.value       = ''
      parseResultPasteText.value = ''
      refreshMessage.value       = 'Loaded a parse result from disk.'
    } else {
      refreshMessage.value = reason ?? 'No new result on disk.'
    }
  } finally {
    refreshBusy.value = false
  }
}

/** r41 v177 — Cancel the awaiting-Claudian handoff and return to the input
 *  form (the planner changed their mind about this document). */
function cancelClaudianRequest(): void {
  awaitingClaudian.value      = false
  claudianPrompt.value        = ''
  parseResultPasteText.value  = ''
  parseResultPasteError.value = ''
}

function handleReadInUse(): void {
  // r41 v213 — emit FILTERED spec (only ticked entries)
  const spec = filteredReadInSpec()
  if (!spec) return
  const name  = planNameInput.value.trim()
  const owner = planOwnerInput.value.trim()
  if (name || owner) {
    emit('imported-with-meta', spec, { planName: name, ownerName: owner })
  } else {
    emit('imported', spec)
  }
}
function handleReadInSharpen(): void {
  // r41 v213 — emit FILTERED spec (only ticked entries)
  const spec = filteredReadInSpec()
  if (!spec) return
  const name  = planNameInput.value.trim()
  const owner = planOwnerInput.value.trim()
  if (name || owner) {
    emit('imported-and-sharpen-with-meta', spec, { planName: name, ownerName: owner })
  } else {
    emit('imported-and-sharpen', spec)
  }
}
function handleReadInAddTo(): void {
  // r41 v213 — emit FILTERED spec (only ticked entries)
  const spec = filteredReadInSpec()
  if (spec) emit('add-to', spec)
}
/** r41 v213 — single Generate handler driven by the bottom-bar Apply-mode toggle. */
function handleReadInGenerate(): void {
  if (props.hasCurrentPlan && applyMode.value === 'add') {
    handleReadInAddTo()
  } else {
    handleReadInUse()
  }
}

/** Go back to the input form from the results view. */
function resetReadIn(): void {
  readInParsed.value   = null
  planInputError.value = ''
  showFullSpec.value   = false
  copySpecDone.value   = false
}

/** Build a plain-text summary of the extracted spec for clipboard copy. */
function _buildSpecPlainText(spec: SpecBlock): string {
  const lines: string[] = ['Extracted Planguage Spec', '']
  spec.functions.forEach(f => {
    lines.push(`F. ${f.id}  ${f.description}`)
    if (f.successCriteria) lines.push(`   ✓ ${f.successCriteria}`)
  })
  if (spec.functions.length) lines.push('')
  spec.values.forEach(v => {
    lines.push(`V. ${v.id}  ${v.description}`)
    if (v.scale)     lines.push(`   Scale:     ${v.scale}`)
    if (v.meter)     lines.push(`   Meter:     ${v.meter}`)
    if (v.status)    lines.push(`   Status:    ${v.status}`)
    if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
    if (v.goal)      lines.push(`   Goal:      ${v.goal}`)
  })
  if (spec.values.length) lines.push('')
  spec.solutions.forEach(s => {
    lines.push(`S. ${s.id}  ${s.description}`)
    if (s.impact) lines.push(`   Impact: ${s.impact}`)
  })
  return lines.join('\n').trim()
}

async function copyExtractedSpec(): Promise<void> {
  if (!readInParsed.value) return
  try {
    await navigator.clipboard.writeText(_buildSpecPlainText(readInParsed.value))
  } catch { /* silently ignore clipboard permission errors */ }
  copySpecDone.value = true
  if (_copySpecTimer) clearTimeout(_copySpecTimer)
  _copySpecTimer = setTimeout(() => { copySpecDone.value = false }, 10_000)
}

// ── TAB 2: From History ────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function fmtTs(ts: number): string {
  try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return String(ts) }
}

// ── TAB 2: From History — type-safe click handlers (no casts in template) ──────

/** Called from template v-for: load a plan model (cast safely in script) */
function handleHistoryLoadModel(raw: unknown): void {
  emit('load-model', raw as PlanModel)
}

/** Called from template v-for: restore a spec version (cast safely in script) */
function handleHistoryRestoreVersion(raw: unknown): void {
  emit('restore-version', raw as SpecVersion)
}

// ── TAB 3: Merge Plans ─────────────────────────────────────────────────────────

/** IDs of selected plan models for merge */
const mergeModelIds    = ref<Set<string>>(new Set())
/** IDs of selected spec versions for merge */
const mergeVersionIds  = ref<Set<string>>(new Set())
const mergeFreeText    = ref('')
const mergeParsed      = ref<SpecBlock | null>(null)
const scrollMergeRef   = ref<InstanceType<typeof ScrollContainer> | null>(null)

/** Human-readable labels of the sources selected at the time "Merge" was clicked */
const mergeSourceLabels = ref<string[]>([])

/** Snapshot of the live spec at the moment merging started (to compute a diff) */
const mergeBeforeSpec = ref<SpecBlock | null>(null)

/** Per-entry diff: new entries (in merged but not in before-spec, by ID) */
const mergeDiffNew = computed<{ id: string; entryType: 'F' | 'V' | 'S'; description: string }[]>(() => {
  if (!mergeParsed.value || !mergeBeforeSpec.value) return []
  const beforeIds = new Set([
    ...mergeBeforeSpec.value.functions.map(e => e.id),
    ...mergeBeforeSpec.value.values.map(e => e.id),
    ...mergeBeforeSpec.value.solutions.map(e => e.id),
  ])
  return [
    ...mergeParsed.value.functions.filter(e => !beforeIds.has(e.id)).map(e => ({ id: e.id, entryType: 'F' as const, description: e.description })),
    ...mergeParsed.value.values.filter(e => !beforeIds.has(e.id)).map(e => ({ id: e.id, entryType: 'V' as const, description: e.description })),
    ...mergeParsed.value.solutions.filter(e => !beforeIds.has(e.id)).map(e => ({ id: e.id, entryType: 'S' as const, description: e.description })),
  ]
})

const mergeDiffCounts = computed(() => {
  const spec = mergeParsed.value
  if (!spec) return { F: 0, V: 0, S: 0, total: 0 }
  return {
    F: spec.functions.length,
    V: spec.values.length,
    S: spec.solutions.length,
    total: spec.functions.length + spec.values.length + spec.solutions.length,
  }
})

function toggleMergeModel(id: string): void {
  const next = new Set(mergeModelIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  mergeModelIds.value = next
}

function toggleMergeVersion(id: string): void {
  const next = new Set(mergeVersionIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  mergeVersionIds.value = next
}

const mergeSelectionCount = computed(() =>
  mergeModelIds.value.size + mergeVersionIds.value.size + (mergeFreeText.value.trim() ? 1 : 0),
)

function _serializeModel(m: PlanModel): string {
  return `Plan Model: "${m.name}" v${m.version} (updated ${fmtDate(m.updatedAt)})\n` +
         JSON.stringify(m.spec, null, 2)
}

function _serializeVersion(sv: SpecVersion): string {
  return `Spec Version: "${sv.label}" — ${sv.summary} (${fmtTs(sv.timestamp)})\n` +
         JSON.stringify(sv.spec, null, 2)
}

// r41 v177 — Merge awaiting-Claudian state (mirrors the Read In tab's
// awaitingClaudian / claudianPrompt / etc.).
const mergeAwaitingClaudian = ref(false)
const mergePrompt           = ref('')
const mergePasteText        = ref('')
const mergePasteError       = ref('')

async function handleMerge(): Promise<void> {
  mergeError.value        = ''
  mergeParsed.value       = null
  mergeSourceLabels.value = []
  mergePasteError.value   = ''

  const inputs: string[] = []
  const labels: string[] = []

  for (const m of allModels.value) {
    if (mergeModelIds.value.has(m.id)) {
      inputs.push(_serializeModel(m as PlanModel))
      labels.push(`📋 ${(m as PlanModel).name} v${(m as PlanModel).version}`)
    }
  }
  for (const sv of history.value) {
    if (mergeVersionIds.value.has(sv.id)) {
      inputs.push(_serializeVersion(sv))
      labels.push(`🕐 ${sv.label} (${fmtTs(sv.timestamp)})`)
    }
  }
  if (mergeFreeText.value.trim()) {
    inputs.push(mergeFreeText.value.trim())
    labels.push('📝 Free text')
  }

  if (!inputs.length) {
    mergeError.value = 'Select at least one source or add some text before merging.'
    return
  }

  mergeSourceLabels.value = labels

  // r41 v184 — direct merge restored per Tom's "as usual" directive.
  mergeParsed.value = await mergePlansAsPlanguage(inputs)
  if (!mergeParsed.value && !mergeError.value) {
    mergeError.value = 'Could not merge the selected sources into a valid spec.  Try adding more content.'
  } else if (mergeParsed.value) {
    await nextTick()
    const el = scrollMergeRef.value?.el
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

function handleApplyMergeResult(): void {
  mergePasteError.value = ''
  try {
    const spec = applyClaudianMergeResult(mergePasteText.value)
    if (!spec) {
      mergePasteError.value = 'The pasted result did not contain any Functions or Values.  Ask Claudian to re-merge with more context.'
      return
    }
    mergeParsed.value           = spec
    mergeAwaitingClaudian.value = false
    mergePrompt.value           = ''
    mergePasteText.value        = ''
    void nextTick().then(() => {
      const el = scrollMergeRef.value?.el
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  } catch (err) {
    mergePasteError.value = err instanceof Error ? err.message : 'Could not parse the pasted result.'
  }
}

function cancelMergeRequest(): void {
  mergeAwaitingClaudian.value = false
  mergePrompt.value           = ''
  mergePasteText.value        = ''
  mergePasteError.value       = ''
}

function handleMergeUse():     void { if (mergeParsed.value) emit('imported', mergeParsed.value) }
function handleMergeSharpen(): void { if (mergeParsed.value) emit('imported-and-sharpen', mergeParsed.value) }
function handleMergeAddTo():   void { if (mergeParsed.value) emit('add-to', mergeParsed.value) }

// ── Export: Copy & Email as colored HTML tables ────────────────────────────────
// Colorful Exports Rule (2026-05-26): every export MUST be a colored HTML table.
// Pattern mirrors PrioritisedPlanView.vue copyRich() / buildFullPlanClipboardHTML().
// Inline styles only — sanitizers strip external <style> blocks.

const _EF  = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif'
const _ETB = `border-collapse:collapse;font-family:${_EF};font-size:13px;width:100%;margin-bottom:16px`
const _ETD = 'padding:8px 12px;border:1px solid #e5e7eb;color:#374151;vertical-align:top;white-space:normal'
const _ETA = `${_ETD};background:#f9fafb`

function _eEsc(s: string | undefined | null): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function _eTH(bg: string): string {
  return `background:${bg};color:#fff;padding:8px 12px;font-size:12px;font-weight:700;text-align:left;white-space:normal`
}
function _eNow(): string {
  const d = new Date()
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function _eReadInSource(): string {
  if (readInMode.value === 'url')  return `URL: ${urlInput.value}`
  if (readInMode.value === 'file') return `File: ${selectedFile.value?.name ?? 'unknown'}`
  return 'Pasted text'
}

function _eHeaderTable(title: string, detail: string, source: string, ts: string): string {
  return `<table style="${_ETB}"><tbody>
    <tr>
      <td style="background:#0f172a;color:#f1f5f9;padding:10px 14px;font-size:15px;font-weight:700;letter-spacing:-0.01em">
        SEM — ${_eEsc(title)}
      </td>
      <td style="background:#0f172a;color:#94a3b8;padding:10px 14px;font-size:11px;text-align:right;white-space:nowrap;vertical-align:middle">
        ${_eEsc(ts)}
      </td>
    </tr>
    <tr>
      <td style="background:#1e293b;color:#cbd5e1;padding:6px 14px;font-size:11px">${_eEsc(detail)}</td>
      <td style="background:#1e293b;color:#64748b;padding:6px 14px;font-size:11px;text-align:right;white-space:nowrap">
        Source: ${_eEsc(source)}
      </td>
    </tr>
  </tbody></table>`
}

function _eFTable(spec: SpecBlock): string {
  if (!spec.functions.length) return ''
  const H = _eTH('#1d4ed8')
  let t = `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em">
      Functions (${spec.functions.length})
    </caption>
    <thead><tr>
      <th style="${H}">Function</th>
      <th style="${H}">Presence Test</th>
      <th style="${H}">For Value</th>
    </tr></thead><tbody>`
  spec.functions.forEach((f, i) => {
    const td = i % 2 === 0 ? _ETD : _ETA
    const pt = _eEsc(f.presenceTest ?? f.successCriteria)
    t += `<tr>
      <td style="${td};font-weight:600">${_eEsc(f.description)}</td>
      <td style="${td}">${pt}</td>
      <td style="${td}">${_eEsc(f.functionOfValue)}</td>
    </tr>`
  })
  return t + '</tbody></table>'
}

function _eVTable(spec: SpecBlock): string {
  if (!spec.values.length) return ''
  const H = _eTH('#6d28d9')
  let t = `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em">
      Values (${spec.values.length})
    </caption>
    <thead><tr>
      <th style="${H}">Value</th>
      <th style="${H}">Scale</th>
      <th style="${H}">Meter</th>
      <th style="${H}">Status</th>
      <th style="${H}">Tolerable</th>
      <th style="${H}">Goal</th>
    </tr></thead><tbody>`
  spec.values.forEach((v, i) => {
    const td = i % 2 === 0 ? _ETD : _ETA
    t += `<tr>
      <td style="${td};font-weight:600">${_eEsc(v.description)}</td>
      <td style="${td}">${_eEsc(v.scale)}</td>
      <td style="${td}">${_eEsc(v.meter)}</td>
      <td style="${td}">${_eEsc(v.status)}</td>
      <td style="${td}">${_eEsc(v.tolerable)}</td>
      <td style="${td}">${_eEsc(v.goal)}</td>
    </tr>`
  })
  return t + '</tbody></table>'
}

function _eSTable(spec: SpecBlock): string {
  if (!spec.solutions.length) return ''
  const H = _eTH('#c2410c')
  let t = `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.05em">
      Solutions (${spec.solutions.length})
    </caption>
    <thead><tr>
      <th style="${H}">Solution</th>
      <th style="${H}">Impact</th>
      <th style="${H}">For Function</th>
    </tr></thead><tbody>`
  spec.solutions.forEach((s, i) => {
    const td = i % 2 === 0 ? _ETD : _ETA
    t += `<tr>
      <td style="${td};font-weight:600">${_eEsc(s.description)}</td>
      <td style="${td}">${_eEsc(s.impact)}</td>
      <td style="${td}">${_eEsc(s.function)}</td>
    </tr>`
  })
  return t + '</tbody></table>'
}

function _eOrigTable(rawText: string, sourceLabel: string): string {
  if (!rawText.trim()) return ''
  const H = _eTH('#374151')
  return `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em">
      Original Input — ${_eEsc(sourceLabel)}
    </caption>
    <thead><tr><th style="${H}">Original Text</th></tr></thead>
    <tbody><tr>
      <td style="${_ETD};white-space:pre-wrap;font-family:monospace;font-size:11px;max-width:600px">${_eEsc(rawText)}</td>
    </tr></tbody>
  </table>`
}

function _eWrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:${_EF};padding:16px;background:#fff;max-width:900px">${body}</body></html>`
}

type ExportSection = 'all' | 'F' | 'V' | 'S'

// ── Read In export builders ────────────────────────────────────────────────────
function _buildReadInHtml(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = _eReadInSource()
  const counts = `${spec.functions.length}F · ${spec.values.length}V · ${spec.solutions.length}S`
  const detail = section === 'all' ? `Parse Results — ${counts}` :
    section === 'F' ? `Functions (${spec.functions.length})` :
    section === 'V' ? `Values (${spec.values.length})` :
                      `Solutions (${spec.solutions.length})`
  let body = _eHeaderTable('Parse Results', detail, source, ts)
  if (section === 'all' || section === 'F') body += _eFTable(spec)
  if (section === 'all' || section === 'V') body += _eVTable(spec)
  if (section === 'all' || section === 'S') body += _eSTable(spec)
  const rawText = readInMode.value === 'text' ? pastedText.value : ''
  body += _eOrigTable(rawText, source)
  return _eWrap(body)
}

function _buildReadInTsv(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = _eReadInSource()
  const lines: string[] = [`SEM Parse Results · ${ts} · Source: ${source}`, '']
  if (section === 'all' || section === 'F') {
    lines.push('── Functions ──')
    spec.functions.forEach(f => {
      lines.push(`F. ${f.description}`)
      const pt = f.presenceTest ?? f.successCriteria
      if (pt) lines.push(`   Presence test: ${pt}`)
      if (f.functionOfValue) lines.push(`   For value: ${f.functionOfValue}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'V') {
    lines.push('── Values ──')
    spec.values.forEach(v => {
      lines.push(`V. ${v.description}`)
      if (v.scale)     lines.push(`   Scale:     ${v.scale}`)
      if (v.meter)     lines.push(`   Meter:     ${v.meter}`)
      if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
      if (v.goal)      lines.push(`   Goal:      ${v.goal}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'S') {
    lines.push('── Solutions ──')
    spec.solutions.forEach(s => {
      lines.push(`S. ${s.description}`)
      if (s.impact) lines.push(`   Impact: ${s.impact}`)
    })
  }
  if (readInMode.value === 'text' && pastedText.value.trim()) {
    lines.push('', '── Original Input ──', pastedText.value)
  }
  return lines.join('\n').trim()
}

// ── Merge export builders ──────────────────────────────────────────────────────
function _buildMergeHtml(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = mergeSourceLabels.value.join(' · ') || 'Merge'
  const counts = `${spec.functions.length}F · ${spec.values.length}V · ${spec.solutions.length}S`
  const detail = section === 'all' ? `Merge Results — ${counts}` :
    section === 'F' ? `Functions (${spec.functions.length})` :
    section === 'V' ? `Values (${spec.values.length})` :
                      `Solutions (${spec.solutions.length})`
  let body = _eHeaderTable('Merge Results', detail, source, ts)
  if (section === 'all' || section === 'F') body += _eFTable(spec)
  if (section === 'all' || section === 'V') body += _eVTable(spec)
  if (section === 'all' || section === 'S') body += _eSTable(spec)
  if (mergeFreeText.value.trim()) body += _eOrigTable(mergeFreeText.value, 'Free text input')
  return _eWrap(body)
}

function _buildMergeTsv(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = mergeSourceLabels.value.join(' · ') || 'Merge'
  const lines: string[] = [`SEM Merge Results · ${ts} · Sources: ${source}`, '']
  if (section === 'all' || section === 'F') {
    lines.push('── Functions ──')
    spec.functions.forEach(f => {
      lines.push(`F. ${f.description}`)
      const pt = f.presenceTest ?? f.successCriteria
      if (pt) lines.push(`   Presence test: ${pt}`)
      if (f.functionOfValue) lines.push(`   For value: ${f.functionOfValue}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'V') {
    lines.push('── Values ──')
    spec.values.forEach(v => {
      lines.push(`V. ${v.description}`)
      if (v.scale)     lines.push(`   Scale:     ${v.scale}`)
      if (v.meter)     lines.push(`   Meter:     ${v.meter}`)
      if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
      if (v.goal)      lines.push(`   Goal:      ${v.goal}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'S') {
    lines.push('── Solutions ──')
    spec.solutions.forEach(s => {
      lines.push(`S. ${s.description}`)
      if (s.impact) lines.push(`   Impact: ${s.impact}`)
    })
  }
  if (mergeFreeText.value.trim()) {
    lines.push('', '── Free text input ──', mergeFreeText.value)
  }
  return lines.join('\n').trim()
}

// ── Rich clipboard writer ──────────────────────────────────────────────────────
// Writes text/html + text/plain together: HTML-capable apps (Mail, Keynote, Pages,
// Notes) receive styled colored tables; plain-text apps get TSV fallback.
const copiedExport = ref<string | null>(null)
let _exportTimer: ReturnType<typeof setTimeout> | null = null

async function _copyRich(key: string, html: string, tsv: string): Promise<void> {
  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv],  { type: 'text/plain' }),
        }),
      ])
    } else {
      await navigator.clipboard.writeText(tsv)
    }
  } catch {
    try { await navigator.clipboard.writeText(tsv) } catch { /* silent */ }
  }
  copiedExport.value = key
  if (_exportTimer) clearTimeout(_exportTimer)
  _exportTimer = setTimeout(() => { copiedExport.value = null }, 4000)
}

async function copyReadIn(section: ExportSection): Promise<void> {
  if (!readInParsed.value) return
  const ts = _eNow()
  await _copyRich(`ri-${section}`, _buildReadInHtml(readInParsed.value, section, ts), _buildReadInTsv(readInParsed.value, section, ts))
}

async function emailReadIn(): Promise<void> {
  if (!readInParsed.value) return
  const ts   = _eNow()
  const spec = readInParsed.value
  const subj = `SEM Parse Results — ${spec.functions.length}F ${spec.values.length}V ${spec.solutions.length}S · ${ts}`
  await exportEmail(_buildReadInHtml(spec, 'all', ts), subj, 'Parse Results')
}

async function copyMerge(section: ExportSection): Promise<void> {
  if (!mergeParsed.value) return
  const ts = _eNow()
  await _copyRich(`mg-${section}`, _buildMergeHtml(mergeParsed.value, section, ts), _buildMergeTsv(mergeParsed.value, section, ts))
}

async function emailMerge(): Promise<void> {
  if (!mergeParsed.value) return
  const ts   = _eNow()
  const spec = mergeParsed.value
  const subj = `SEM Merge Results — ${spec.functions.length}F ${spec.values.length}V ${spec.solutions.length}S · ${ts}`
  await exportEmail(_buildMergeHtml(spec, 'all', ts), subj, 'Merge Results')
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[510] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Get A Plan"
    >
      <!-- r41 v215 (Tom Gilb 2026-06-19 "not seperate windows") — widened
           panel from max-w-2xl (672 px) to max-w-[1400px] so the 3×2 grid
           of per-type windows actually has horizontal space to render as
           3 columns × 2 rows.  At max-w-2xl the input column (340 px) +
           3-col grid (~450 px minimum) was overflowing into vertical
           stacking — Tom saw the result as one column, not 6 windows. -->
      <div class="w-full max-w-[1400px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto max-h-[94vh]">

        <!-- ── Header — r41 v183 (Tom Gilb 2026-06-19 "no scrollor export
             on this initial input window"): Export pin added per the
             Universal Export rule (Export button on all windows).  Copies a
             colourful HTML snapshot of the current input state (Plan
             identity + tab + source + content + Claudian prompt + parsed
             result) to clipboard + fires confirmation toast. ── -->
        <div class="flex items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-2xl flex-shrink-0">
          <div class="flex items-center gap-2 text-white">
            <GetGlyph size="standard" class="h-4 w-auto" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-white tracking-wide">Get a Spec</h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label="Export input snapshot"
              title="📤 Export — copy a colourful HTML snapshot of this panel's current state (Plan identity + tab + source + content + Claudian prompt if generated + parsed result if applied) to the clipboard.  ⌘V into Mail / Notes / Keynote."
              class="h-8 flex items-center justify-center gap-1 px-2.5 rounded-lg
                     bg-white/15 text-white hover:bg-white/25 ring-1 ring-white/30
                     focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
              @click="exportInputSnapshot"
            >
              <span class="text-sm leading-none" aria-hidden="true">📤</span>
              <span class="text-[11px] font-bold leading-none">Export</span>
            </button>
            <!-- Close — universal CloseDot per "Universal Close-Button Rule" -->
            <CloseDot
              size="lg"
              variant="on-dark"
              aria-label="Close Get A Plan"
              @click="emit('close')"
            />
          </div>
        </div>

        <!-- ── Top-level tab bar ── -->
        <div
          class="flex border-b border-slate-200 bg-slate-50 flex-shrink-0 px-2 pt-2 gap-1"
          role="tablist"
          aria-label="Spec source"
        >
          <button
            v-for="tab in ([
              { key: 'read-in',      icon: '📄', label: 'Read In' },
              { key: 'from-history', icon: '🕐', label: 'Past Versions' },
              { key: 'merge',        icon: '🔀', label: 'Merge Plans' },
            ] as const)"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="topTab === tab.key"
            :class="[
              'flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px',
              topTab === tab.key
                ? 'border-indigo-500 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60',
            ]"
            @click="switchTab(tab.key)"
          >
            <span aria-hidden="true">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        </div>

        <!-- ══════════════════════════════════════════════════════════════
             TAB 1 — READ IN
        ═══════════════════════════════════════════════════════════════ -->
        <template v-if="topTab === 'read-in'">
          <!-- r41 v214 (Tom Gilb 2026-06-19 "nope, one gigantil long scroll")
               — break the parsed-result rendering OUT of the outer
               ScrollContainer so the 6 per-type windows + control panel
               take the full available height with NO outer scroll consuming
               them.  Branch at the v-if level: parsed → flex-col fill-height
               layout (no outer scroll, grid has its own scrolls); not
               parsed → original ScrollContainer wrapping the input form. -->

          <!-- ═══ PARSED RESULTS — full-height layout, scroll only for the
                supplementary Copy & Email + Preview blocks below the grid ═══
                r41 v216 (Tom Gilb 2026-06-19 "I want to see copy email etc"
                + "no" to hiding them).  Strategy: outer ScrollContainer
                handles overflow when Copy & Email + Preview don't fit.  The
                grid + control panel block uses min-h-[460px] so it's
                always FULL HEIGHT at the top of the scroll — when the user
                scrolls down, they reach Copy & Email + Preview.  Per-type
                windows inside the grid retain their own internal
                ScrollContainer, so the grid scroll is INDEPENDENT of the
                outer panel scroll. -->
          <ScrollContainer
            v-if="readInParsed && !planInputLoading"
            outer-class="flex-1 min-h-0 relative"
            inner-class="h-full p-4 space-y-3"
          >

              <!-- Back-link — lets user re-parse without closing the panel -->
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                @click="resetReadIn"
              >
                <span aria-hidden="true">←</span> Parse another document
              </button>

              <div class="space-y-4">

                <!-- r41 v213 (Tom Gilb 2026-06-19) — Two-column refit per
                     "put them in separate scrollable windows, that we can
                     check if we want, or not. The input can be narrow, but
                     the parse should be in one window for each type".
                     LEFT  = input textarea (source-text, narrow, scrollable,
                            receives provenance flash on entry click)
                     RIGHT = 3×2 grid of per-type windows with per-entry
                            checkboxes; each window has its own scrollbar.
                     Bottom of this block = control panel with Apply mode
                     toggle + Re-parse + Generate + Sharpen + Generate Spec. -->

                <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">

                  <!-- Header chip: ticked / total summary + counts banner -->
                  <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50 border-b border-emerald-200">
                    <div class="flex items-center gap-2 text-sm text-emerald-800 font-medium">
                      <span aria-hidden="true">✅</span>
                      <span>
                        Extracted
                        <strong>{{ readInParsed.functions.length }}</strong> Function{{ readInParsed.functions.length === 1 ? '' : 's' }} ·
                        <strong>{{ readInParsed.values.length }}</strong> Value{{ readInParsed.values.length === 1 ? '' : 's' }} ·
                        <strong>{{ readInParsed.solutions.length }}</strong> Solution{{ readInParsed.solutions.length === 1 ? '' : 's' }}
                      </span>
                    </div>
                    <span class="text-[11px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                      {{ tickedReadInCount }} ticked
                    </span>
                  </div>

                  <!-- Two-column body: input narrow LEFT · parsed grid RIGHT -->
                  <div class="flex flex-row min-h-[460px]">

                    <!-- LEFT: input column (narrow, source-text textarea) -->
                    <div class="w-[340px] shrink-0 border-r border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
                      <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide" for="readin-source">
                        Source — click an entry to scroll here
                      </label>
                      <textarea
                        id="readin-source"
                        ref="inputTextareaRef"
                        v-model="pastedText"
                        rows="18"
                        class="flex-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs
                               focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                               resize-none placeholder:text-slate-400 font-mono leading-snug bg-white
                               transition-shadow"
                        placeholder="(Source text — paste, fetch, or upload feeds here)"
                      />
                      <p class="text-[10px] text-slate-400 leading-snug">
                        Heuristic match — entries whose id or first-25-chars
                        of description appear here will flash a region on click.
                      </p>
                    </div>

                    <!-- RIGHT: 3×2 grid of per-type windows -->
                    <div class="flex-1 min-w-0 p-3 bg-slate-100">
                      <div class="h-full grid grid-cols-3 grid-rows-2 gap-2.5">

                        <!-- Stakeholder (blue) -->
                        <div class="flex flex-col rounded-lg border border-blue-200 bg-white overflow-hidden">
                          <div class="flex items-center justify-between px-2.5 py-1.5 bg-blue-50 border-b border-blue-200">
                            <span class="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Stakeholder</span>
                            <span class="text-[9px] font-mono px-1.5 py-px bg-blue-100 text-blue-700 rounded">
                              {{ readInStakeholders.filter(sh => entrySelection[sh.id]).length }} / {{ readInStakeholders.length }}
                            </span>
                          </div>
                          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-1.5 py-1">
                            <div v-if="readInStakeholders.length === 0" class="text-[10px] italic text-slate-400 px-1.5 py-1">None detected.</div>
                            <label
                              v-for="sh in readInStakeholders"
                              :key="sh.id"
                              class="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-blue-50 cursor-pointer text-[11px]"
                              @click="flashSourceLine(sh.id)"
                            >
                              <input type="checkbox" v-model="entrySelection[sh.id]" class="mt-0.5 shrink-0 accent-blue-600" />
                              <div class="flex-1 min-w-0">
                                <p class="font-mono font-semibold text-blue-700 truncate">{{ sh.id }}</p>
                                <p v-if="sh.definition || sh.description" class="text-slate-600 leading-snug line-clamp-2">
                                  {{ sh.definition || sh.description }}
                                </p>
                              </div>
                            </label>
                          </ScrollContainer>
                        </div>

                        <!-- Function (emerald) -->
                        <div class="flex flex-col rounded-lg border border-emerald-200 bg-white overflow-hidden">
                          <div class="flex items-center justify-between px-2.5 py-1.5 bg-emerald-50 border-b border-emerald-200">
                            <span class="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Function</span>
                            <span class="text-[9px] font-mono px-1.5 py-px bg-emerald-100 text-emerald-700 rounded">
                              {{ readInParsed.functions.filter(f => entrySelection[f.id]).length }} / {{ readInParsed.functions.length }}
                            </span>
                          </div>
                          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-1.5 py-1">
                            <div v-if="readInParsed.functions.length === 0" class="text-[10px] italic text-slate-400 px-1.5 py-1">None detected.</div>
                            <label
                              v-for="f in readInParsed.functions"
                              :key="f.id"
                              class="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-emerald-50 cursor-pointer text-[11px]"
                              @click="flashSourceLine(f.id)"
                            >
                              <input type="checkbox" v-model="entrySelection[f.id]" class="mt-0.5 shrink-0 accent-emerald-600" />
                              <div class="flex-1 min-w-0">
                                <p class="font-mono font-semibold text-emerald-700 truncate">{{ f.id }}</p>
                                <p v-if="f.description" class="text-slate-600 leading-snug line-clamp-2">{{ f.description }}</p>
                              </div>
                            </label>
                          </ScrollContainer>
                        </div>

                        <!-- Value (violet) -->
                        <div class="flex flex-col rounded-lg border border-violet-200 bg-white overflow-hidden">
                          <div class="flex items-center justify-between px-2.5 py-1.5 bg-violet-50 border-b border-violet-200">
                            <span class="text-[10px] font-semibold text-violet-700 uppercase tracking-wide">Value</span>
                            <span class="text-[9px] font-mono px-1.5 py-px bg-violet-100 text-violet-700 rounded">
                              {{ readInParsed.values.filter(v => entrySelection[v.id]).length }} / {{ readInParsed.values.length }}
                            </span>
                          </div>
                          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-1.5 py-1">
                            <div v-if="readInParsed.values.length === 0" class="text-[10px] italic text-slate-400 px-1.5 py-1">None detected.</div>
                            <label
                              v-for="v in readInParsed.values"
                              :key="v.id"
                              class="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-violet-50 cursor-pointer text-[11px]"
                              @click="flashSourceLine(v.id)"
                            >
                              <input type="checkbox" v-model="entrySelection[v.id]" class="mt-0.5 shrink-0 accent-violet-600" />
                              <div class="flex-1 min-w-0">
                                <p class="font-mono font-semibold text-violet-700 truncate">{{ v.id }}</p>
                                <p v-if="v.description" class="text-slate-600 leading-snug line-clamp-2">{{ v.description }}</p>
                                <p v-if="v.goal" class="text-emerald-700 text-[9px] mt-0.5"><span class="font-semibold">Goal:</span> {{ v.goal }}</p>
                              </div>
                            </label>
                          </ScrollContainer>
                        </div>

                        <!-- Solution (orange) -->
                        <div class="flex flex-col rounded-lg border border-orange-200 bg-white overflow-hidden">
                          <div class="flex items-center justify-between px-2.5 py-1.5 bg-orange-50 border-b border-orange-200">
                            <span class="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Solution</span>
                            <span class="text-[9px] font-mono px-1.5 py-px bg-orange-100 text-orange-700 rounded">
                              {{ readInParsed.solutions.filter(s => entrySelection[s.id]).length }} / {{ readInParsed.solutions.length }}
                            </span>
                          </div>
                          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-1.5 py-1">
                            <div v-if="readInParsed.solutions.length === 0" class="text-[10px] italic text-slate-400 px-1.5 py-1">None detected.</div>
                            <label
                              v-for="s in readInParsed.solutions"
                              :key="s.id"
                              class="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-orange-50 cursor-pointer text-[11px]"
                              @click="flashSourceLine(s.id)"
                            >
                              <input type="checkbox" v-model="entrySelection[s.id]" class="mt-0.5 shrink-0 accent-orange-600" />
                              <div class="flex-1 min-w-0">
                                <p class="font-mono font-semibold text-orange-700 truncate">{{ s.id }}</p>
                                <p v-if="s.description" class="text-slate-600 leading-snug line-clamp-2">{{ s.description }}</p>
                              </div>
                            </label>
                          </ScrollContainer>
                        </div>

                        <!-- Constraint (red) -->
                        <div class="flex flex-col rounded-lg border border-red-200 bg-white overflow-hidden">
                          <div class="flex items-center justify-between px-2.5 py-1.5 bg-red-50 border-b border-red-200">
                            <span class="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Constraint</span>
                            <span class="text-[9px] font-mono px-1.5 py-px bg-red-100 text-red-700 rounded">
                              {{ (readInParsed.constraints ?? []).filter(c => entrySelection[c.id]).length }} / {{ (readInParsed.constraints ?? []).length }}
                            </span>
                          </div>
                          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-1.5 py-1">
                            <div v-if="(readInParsed.constraints ?? []).length === 0" class="text-[10px] italic text-slate-400 px-1.5 py-1">None detected.</div>
                            <label
                              v-for="c in (readInParsed.constraints ?? [])"
                              :key="c.id"
                              class="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-red-50 cursor-pointer text-[11px]"
                              @click="flashSourceLine(c.id)"
                            >
                              <input type="checkbox" v-model="entrySelection[c.id]" class="mt-0.5 shrink-0 accent-red-600" />
                              <div class="flex-1 min-w-0">
                                <p class="font-mono font-semibold text-red-700 truncate">{{ c.id }}</p>
                                <p v-if="c.description" class="text-slate-600 leading-snug line-clamp-2">{{ c.description }}</p>
                              </div>
                            </label>
                          </ScrollContainer>
                        </div>

                        <!-- Resource (teal) -->
                        <div class="flex flex-col rounded-lg border border-teal-200 bg-white overflow-hidden">
                          <div class="flex items-center justify-between px-2.5 py-1.5 bg-teal-50 border-b border-teal-200">
                            <span class="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Resource</span>
                            <span class="text-[9px] font-mono px-1.5 py-px bg-teal-100 text-teal-700 rounded">
                              {{ (readInParsed.resources ?? []).filter(r => entrySelection[r.id]).length }} / {{ (readInParsed.resources ?? []).length }}
                            </span>
                          </div>
                          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-1.5 py-1">
                            <div v-if="(readInParsed.resources ?? []).length === 0" class="text-[10px] italic text-slate-400 px-1.5 py-1">None detected.</div>
                            <label
                              v-for="r in (readInParsed.resources ?? [])"
                              :key="r.id"
                              class="flex items-start gap-1.5 px-1.5 py-1 rounded hover:bg-teal-50 cursor-pointer text-[11px]"
                              @click="flashSourceLine(r.id)"
                            >
                              <input type="checkbox" v-model="entrySelection[r.id]" class="mt-0.5 shrink-0 accent-teal-600" />
                              <div class="flex-1 min-w-0">
                                <p class="font-mono font-semibold text-teal-700 truncate">{{ r.id }}</p>
                                <p v-if="r.description" class="text-slate-600 leading-snug line-clamp-2">{{ r.description }}</p>
                              </div>
                            </label>
                          </ScrollContainer>
                        </div>

                      </div>
                    </div>

                  </div>

                  <!-- Control panel (bottom bar): Apply mode + actions -->
                  <div class="border-t border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">

                    <!-- Apply mode toggle (only meaningful when there's a current plan) -->
                    <div v-if="props.hasCurrentPlan" class="flex items-center gap-2">
                      <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Apply</span>
                      <div class="flex rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5" role="radiogroup" aria-label="Apply mode">
                        <button
                          type="button"
                          role="radio"
                          :aria-checked="applyMode === 'add'"
                          :class="[
                            'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                            applyMode === 'add'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'text-slate-500 hover:text-slate-700',
                          ]"
                          @click="applyMode = 'add'"
                        >Add</button>
                        <button
                          type="button"
                          role="radio"
                          :aria-checked="applyMode === 'replace'"
                          :class="[
                            'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                            applyMode === 'replace'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'text-slate-500 hover:text-slate-700',
                          ]"
                          @click="applyMode = 'replace'"
                        >Replace</button>
                      </div>
                      <p class="text-[10px] text-slate-400 italic">
                        {{ applyMode === 'add' ? 'Merges with existing' : 'Overwrites the live spec' }}
                      </p>
                    </div>
                    <div v-else class="flex-1" />

                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600
                               hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                        title="Re-run the parser against the current source text"
                        @click="handleReadInParse"
                      >↻ Re-parse</button>
                      <button
                        type="button"
                        class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white
                               hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors
                               flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Generate the spec then immediately open the Sharpening panel"
                        :disabled="tickedReadInCount === 0"
                        @click="handleReadInSharpen"
                      ><span>🔪</span> Generate + Sharpen</button>
                      <button
                        type="button"
                        class="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white
                               hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors
                               flex items-center gap-1.5
                               disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="tickedReadInCount === 0"
                        @click="handleReadInGenerate"
                      >
                        Generate Spec
                        <span class="font-mono text-[10px] bg-indigo-500/60 px-1.5 py-0.5 rounded">{{ tickedReadInCount }}</span>
                        →
                      </button>
                    </div>
                  </div>
                </div>

                <!-- ── Copy & Email export ── -->
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Copy &amp; Email Parse Results</p>

                  <!-- All-3 row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg
                             bg-slate-800 text-white text-xs font-semibold
                             hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all 3 components (Functions + Values + Solutions) as a colored HTML table — paste with ⌘V in Mail, Keynote, or Notes. Includes original input text and timestamp."
                      :aria-label="copiedExport === 'ri-all' ? 'Copied!' : 'Copy all 3 components as colored HTML tables'"
                      @click="copyReadIn('all')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-all' ? '✓' : '📋' }}</span>
                      {{ copiedExport === 'ri-all' ? 'Copied!' : 'Copy All · Function + Value + Solution' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg
                             bg-indigo-600 text-white text-xs font-semibold
                             hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all results to clipboard as colored tables, then open Mail.app — paste with ⌘V in the email body for full-color tables. Subject line includes entry counts and timestamp."
                      :aria-label="copiedExport === 'ri-email' ? 'Copied — Mail opening' : 'Email all parse results'"
                      @click="emailReadIn"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-email' ? '✓' : '✉️' }}</span>
                      {{ copiedExport === 'ri-email' ? 'Opening Mail…' : 'Mail All' }}
                    </button>
                  </div>

                  <!-- Individual component row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold
                             hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy Functions only (${readInParsed?.functions.length ?? 0} entries) as a colored blue HTML table — paste with ⌘V. Includes original input and timestamp.`"
                      :aria-label="copiedExport === 'ri-F' ? 'Functions copied' : 'Copy Functions only'"
                      @click="copyReadIn('F')"
                    >
                      <span v-if="copiedExport === 'ri-F'" aria-hidden="true">✓</span>
                      {{ copiedExport === 'ri-F' ? 'Copied' : 'Functions' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-violet-300 bg-violet-50 text-violet-700 text-xs font-semibold
                             hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy Values only (${readInParsed?.values.length ?? 0} entries) as a colored violet HTML table — paste with ⌘V. Includes Scale, Meter, Tolerable, Goal, original input, and timestamp.`"
                      :aria-label="copiedExport === 'ri-V' ? 'Values copied' : 'Copy Values only'"
                      @click="copyReadIn('V')"
                    >
                      <span v-if="copiedExport === 'ri-V'" aria-hidden="true">✓</span>
                      {{ copiedExport === 'ri-V' ? 'Copied' : 'Values' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-orange-300 bg-orange-50 text-orange-700 text-xs font-semibold
                             hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy Solutions only (${readInParsed?.solutions.length ?? 0} entries) as a colored orange HTML table — paste with ⌘V. Includes Impact, For Function, original input, and timestamp.`"
                      :aria-label="copiedExport === 'ri-S' ? 'Solutions copied' : 'Copy Solutions only'"
                      @click="copyReadIn('S')"
                    >
                      <span v-if="copiedExport === 'ri-S'" aria-hidden="true">✓</span>
                      {{ copiedExport === 'ri-S' ? 'Copied' : 'Solutions' }}
                    </button>
                  </div>

                  <!-- Confirmation hint -->
                  <p
                    v-if="copiedExport?.startsWith('ri-')"
                    class="text-[11px] text-emerald-600 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    ✓ Copied — paste with ⌘V in Mail, Keynote, or Notes for full-color tables
                  </p>
                </div>

                <!-- ── Preview (supplementary — below the CTAs) ── -->
                <div class="border-t border-slate-100 pt-3 space-y-3">

                  <!-- Preview toggle + copy -->
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      :class="showFullSpec
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'"
                      @click="showFullSpec = !showFullSpec"
                    >
                      <span aria-hidden="true">{{ showFullSpec ? '▾' : '▸' }}</span>
                      {{ showFullSpec ? 'Hide entries' : 'Preview all entries' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      :class="copySpecDone
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'"
                      :aria-label="copySpecDone ? 'Copied' : 'Copy extracted spec to clipboard'"
                      @click="copyExtractedSpec"
                    >
                      <span aria-hidden="true">{{ copySpecDone ? '✓' : '📋' }}</span>
                      {{ copySpecDone ? 'Copied' : 'Copy' }}
                    </button>
                  </div>

                  <!-- Full spec list (expanded) -->
                  <ScrollContainer v-if="showFullSpec" outer-class="rounded-xl border border-slate-200 bg-slate-50 relative" inner-class="p-3 space-y-3" inner-style="max-height: 16rem" :no-pill="true">
                    <!-- Functions -->
                    <div v-if="readInParsed.functions.length">
                      <p class="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1.5">Functions ({{ readInParsed.functions.length }})</p>
                      <div class="space-y-2">
                        <div v-for="f in readInParsed.functions" :key="f.id" class="text-xs">
                          <div class="flex items-start gap-2">
                            <span class="shrink-0 font-mono font-bold text-green-600 w-[90px]">{{ f.id }}</span>
                            <span class="text-slate-700">{{ f.description }}</span>
                          </div>
                          <p v-if="f.successCriteria" class="ml-[98px] text-slate-400 mt-0.5">✓ {{ f.successCriteria }}</p>
                        </div>
                      </div>
                    </div>
                    <!-- Values -->
                    <div v-if="readInParsed.values.length">
                      <p class="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">Values ({{ readInParsed.values.length }})</p>
                      <div class="space-y-2">
                        <div v-for="v in readInParsed.values" :key="v.id" class="text-xs">
                          <div class="flex items-start gap-2">
                            <span class="shrink-0 font-mono font-bold text-violet-600 w-[90px]">{{ v.id }}</span>
                            <span class="text-slate-700">{{ v.description }}</span>
                          </div>
                          <div class="ml-[98px] mt-0.5 space-y-0.5 text-[11px] text-slate-500">
                            <p v-if="v.scale">📐 {{ v.scale }}</p>
                            <p v-if="v.tolerable">🟡 Tolerable: {{ v.tolerable }}</p>
                            <p v-if="v.goal">⭐ Goal: {{ v.goal }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- Solutions -->
                    <div v-if="readInParsed.solutions.length">
                      <p class="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1.5">Solutions ({{ readInParsed.solutions.length }})</p>
                      <div class="space-y-1.5">
                        <div v-for="s in readInParsed.solutions" :key="s.id" class="flex items-start gap-2 text-xs">
                          <span class="shrink-0 font-mono font-bold text-orange-600 w-[90px]">{{ s.id }}</span>
                          <span class="text-slate-700">{{ s.description }}</span>
                        </div>
                      </div>
                    </div>
                  </ScrollContainer>

                  <!-- Compact cross-type preview (collapsed) — shows F + V + S so all types are visible -->
                  <div v-else class="space-y-1">
                    <div v-for="f in readInParsed.functions.slice(0, 2)" :key="f.id" class="flex items-start gap-2 text-xs text-slate-600">
                      <span class="shrink-0 font-mono text-green-600 font-semibold w-[86px]">{{ f.id }}</span>
                      <span class="truncate">{{ f.description }}</span>
                    </div>
                    <div v-for="v in readInParsed.values.slice(0, 2)" :key="v.id" class="flex items-start gap-2 text-xs text-slate-600">
                      <span class="shrink-0 font-mono text-violet-600 font-semibold w-[86px]">{{ v.id }}</span>
                      <span class="truncate">{{ v.description }}</span>
                    </div>
                    <div v-for="s in readInParsed.solutions.slice(0, 1)" :key="s.id" class="flex items-start gap-2 text-xs text-slate-600">
                      <span class="shrink-0 font-mono text-orange-500 font-semibold w-[86px]">{{ s.id }}</span>
                      <span class="truncate">{{ s.description }}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 italic pt-0.5">
                      ▸ Preview all entries above to see complete spec
                    </p>
                  </div>

                </div>
              </div>
          </ScrollContainer>

          <!-- ═══ INPUT FORM — shown while no result is available ═══ -->
          <ScrollContainer
            v-else
            outer-class="flex-1 min-h-0 relative"
            inner-class="h-full p-5 space-y-5"
          >

              <!-- ── Project identity — name + owner before parsing (r25, Tom 2026-06-07) ── -->
              <!-- "I want to be able to name a project and owner early, before input and parsing" -->
              <div class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 space-y-2.5">
                <p class="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
                  Project identity <span class="font-normal normal-case text-indigo-400 ml-1">— optional, applied immediately after parse</span>
                </p>
                <div class="flex gap-3">
                  <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-semibold text-indigo-700 mb-1" for="proj-name">
                      Plan name
                    </label>
                    <input
                      id="proj-name"
                      v-model="planNameInput"
                      type="text"
                      class="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm
                             text-slate-800 placeholder-slate-400 focus:outline-none
                             focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      placeholder="e.g. DOVE Q3 2026"
                      :disabled="planInputLoading"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <label class="block text-[11px] font-semibold text-indigo-700 mb-1" for="proj-owner">
                      Owner name
                    </label>
                    <input
                      id="proj-owner"
                      v-model="planOwnerInput"
                      type="text"
                      class="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm
                             text-slate-800 placeholder-slate-400 focus:outline-none
                             focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      placeholder="e.g. Tom Gilb"
                      :disabled="planInputLoading"
                    />
                  </div>
                </div>
              </div>

              <!-- Format availability grid -->
              <div class="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">✅ Supported</p>
                  <ul class="space-y-0.5 text-[11px] text-slate-600 leading-relaxed">
                    <li>PDF <span class="text-slate-400">(.pdf)</span></li>
                    <li>Word <span class="text-slate-400">(.docx)</span></li>
                    <li>Plain text <span class="text-slate-400">(.txt · .md)</span></li>
                    <li>HTML <span class="text-slate-400">(.html)</span></li>
                    <li>CSV <span class="text-slate-400">(.csv)</span></li>
                    <li>RTF <span class="text-slate-400">(.rtf)</span></li>
                    <li>Any pasted text</li>
                    <li>Public web URLs</li>
                    <li>Google Docs / Sheets / Slides <span class="text-slate-400">("anyone with link")</span></li>
                  </ul>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">❌ Not available</p>
                  <ul class="space-y-0.5 text-[11px] text-slate-600 leading-relaxed">
                    <li>.doc <span class="text-slate-400">→ save as .docx</span></li>
                    <li>PowerPoint <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Excel <span class="text-slate-400">→ save as CSV</span></li>
                    <li>Keynote / Pages <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Private URLs <span class="text-slate-400">→ paste content instead</span></li>
                  </ul>
                </div>
              </div>

              <!-- Input mode sub-tabs -->
              <div class="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1" role="tablist" aria-label="Input mode">
                <button
                  v-for="(tab, i) in ([
                    { key: 'text', icon: '📝', label: 'Text' },
                    { key: 'url',  icon: '🔗', label: 'URL' },
                    { key: 'file', icon: '📄', label: 'Upload file' },
                  ] as const)"
                  :key="i"
                  type="button"
                  role="tab"
                  :aria-selected="readInMode === tab.key"
                  :class="[
                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    readInMode === tab.key
                      ? 'bg-white shadow-sm text-indigo-700 border border-indigo-100'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60',
                  ]"
                  @click="selectReadInMode(tab.key)"
                >
                  <span aria-hidden="true">{{ tab.icon }}</span>
                  {{ tab.label }}
                </button>
              </div>

              <!-- Paste text — r41 v179 (Tom Gilb 2026-06-19 "still paste nix").
                   v178 added the emerald "Text accepted" banner with an inline
                   Send pin, but placed it BELOW the rows="10" textarea — Tom's
                   screenshot showed the banner sitting off-screen below the fold.
                   v179 hoists the banner + inline Send pin ABOVE the textarea
                   so they appear AT THE TOP of the input area, where the
                   planner's eyes land after clicking Paste text.  Composes with
                   MOVE Principle (next action visible WITHOUT scrolling). -->
              <div v-if="readInMode === 'text'" class="space-y-2">
                <!-- r41 v184 — direct-parse flow restored.  The 4-step
                     Claudian journey breadcrumb is removed; "Parse as
                     Planguage Spec" runs the parse inline. -->
                <div
                  v-if="pastedText.trim()"
                  class="flex items-center gap-3 rounded-lg bg-emerald-50 border-2 border-emerald-400 px-3 py-2.5 text-xs text-emerald-800 shadow-sm"
                >
                  <span class="text-lg shrink-0" aria-hidden="true">✓</span>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold">Text accepted — {{ pastedText.length.toLocaleString() }} characters.</p>
                    <p class="text-emerald-700 text-[11px] mt-0.5">Click <strong>🔍 Parse as Planguage Spec</strong> to extract Functions, Values, Solutions, Constraints, and Resources.</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors disabled:opacity-90 ring-2 ring-indigo-300 flex items-center gap-1.5 min-w-[180px] justify-center"
                    :disabled="planInputLoading"
                    title="Run the AI parse on the input text and return a Planguage spec."
                    @click="handleReadInParse"
                  >
                    <template v-if="planInputLoading">
                      <div class="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                      {{ planInputProgress || 'Working…' }}
                    </template>
                    <template v-else>🔍 Parse as Planguage Spec</template>
                  </button>
                </div>

                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide" for="plan-paste">
                  Plan content
                </label>
                <textarea
                  id="plan-paste"
                  v-model="pastedText"
                  rows="10"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                         resize-y placeholder:text-slate-400 font-mono"
                  placeholder="Paste your plan, strategy doc, project brief, meeting notes, OKRs, roadmap — any text…"
                  :disabled="planInputLoading"
                />
                <p class="text-xs text-slate-400">Works with any plain text: Word copy-paste, PDF copy-paste, Notion export, email, slides notes…</p>
              </div>

              <!-- URL -->
              <div v-else-if="readInMode === 'url'" class="space-y-3">
                <!-- r41 v184 — direct-parse banner. -->
                <div
                  v-if="urlInput.trim()"
                  class="flex items-center gap-3 rounded-lg bg-emerald-50 border-2 border-emerald-400 px-3 py-2.5 text-xs text-emerald-800 shadow-sm"
                >
                  <span class="text-lg shrink-0" aria-hidden="true">✓</span>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold truncate">URL accepted — {{ urlInput.trim() }}</p>
                    <p class="text-emerald-700 text-[11px] mt-0.5">Click <strong>🔍 Parse as Planguage Spec</strong> to fetch + parse inline.</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors disabled:opacity-90 ring-2 ring-indigo-300 flex items-center gap-1.5 min-w-[180px] justify-center"
                    :disabled="planInputLoading"
                    title="Fetch the URL, extract its text, then run the AI parse and return a Planguage spec."
                    @click="handleReadInParse"
                  >
                    <template v-if="planInputLoading">
                      <div class="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                      {{ planInputProgress || 'Working…' }}
                    </template>
                    <template v-else>🔍 Parse as Planguage Spec</template>
                  </button>
                </div>

                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide" for="plan-url">
                  Page URL
                </label>
                <input
                  id="plan-url"
                  v-model="urlInput"
                  type="url"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                         placeholder:text-slate-400"
                  placeholder="https://…"
                  :disabled="planInputLoading"
                  @keydown.enter="handleReadInParse"
                />
                <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 space-y-1">
                  <p><strong>Works best with:</strong> public web pages, Confluence/Notion public links, GitHub READMEs, Google Docs (published to web).</p>
                  <p><strong>Behind a login?</strong> Copy-paste the content into the text tab instead.</p>
                </div>
              </div>

              <!-- File upload -->
              <div v-else class="space-y-3">
                <!-- r41 v184 — direct-parse banner. -->
                <div
                  v-if="selectedFile"
                  class="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-400 shadow-sm"
                >
                  <span class="text-2xl leading-none shrink-0" aria-hidden="true">✓</span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-emerald-800 truncate">File accepted — {{ selectedFile.name }}</p>
                    <p class="text-[11px] text-emerald-700 mt-0.5">
                      {{ (selectedFile.size / 1024).toFixed(0) }} KB · {{ selectedFile.name.split('.').pop()?.toUpperCase() }}
                      · Click <strong>🔍 Parse as Planguage Spec</strong> to extract + parse inline.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors disabled:opacity-90 ring-2 ring-indigo-300 flex items-center gap-1.5 min-w-[180px] justify-center"
                    :disabled="planInputLoading"
                    title="Extract the file's text, then run the AI parse and return a Planguage spec."
                    @click="handleReadInParse"
                  >
                    <template v-if="planInputLoading">
                      <div class="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                      {{ planInputProgress || 'Working…' }}
                    </template>
                    <template v-else>🔍 Parse as Planguage Spec</template>
                  </button>
                </div>

                <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Choose file</p>

                <!-- Hidden real file input — triggered by the button below -->
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.html,.htm,.csv"
                  class="sr-only"
                  :disabled="planInputLoading"
                  @change="handleFileChange"
                />

                <!-- Explicit Browse button — always visible, always clickable -->
                <button
                  type="button"
                  class="w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl
                         border-2 border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold text-sm
                         hover:bg-indigo-100 hover:border-indigo-500
                         active:scale-[0.98] transition-all duration-150
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Click to open the Mac file picker and choose a PDF, Word, Text, Markdown, HTML or CSV file"
                  :disabled="planInputLoading"
                  @click="triggerFilePicker"
                >
                  <span class="text-2xl leading-none" aria-hidden="true">📂</span>
                  <span>{{ selectedFile ? 'Change file…' : 'Browse for file on Mac…' }}</span>
                </button>

                <p class="text-xs text-slate-400">Supports: PDF · Word (.docx) · Text · Markdown · HTML · CSV</p>
              </div>

              <!-- Replace warning -->
              <div
                v-if="props.hasCurrentPlan"
                class="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                role="alert"
              >
                <span class="flex-shrink-0 text-base" aria-hidden="true">⚠️</span>
                <div>
                  <p class="font-semibold">This will replace your current live plan.</p>
                  <p class="text-xs text-amber-700 mt-0.5">
                    Save first
                    (<span class="inline-flex items-center gap-1 align-middle"><SaveGlyph size="compact" class="inline-block h-3 w-auto -mt-0.5" /> Save now</span>)
                    if you want to keep it. Archived history is not affected.
                  </p>
                </div>
              </div>

              <!-- Parse button — direct local Planguage parse (NO Claudian round-trip).
                   Tom Gilb 2026-06-18 verbatim: "I do not want or need to go via Claudian.
                   stop it!"  The button label, HoverHint, loading hint, and error banner
                   are now honest about what the handler actually does: deterministic
                   in-browser parsing via parseAsPlanguage() → _parseLocalText().
                   r41 v177 stale Claudian-round-trip labels cleared in this rev. -->
              <button
                v-if="!awaitingClaudian"
                type="button"
                class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                       bg-indigo-600 text-white text-sm font-semibold
                       hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                       transition-colors"
                :disabled="planInputLoading"
                title="Parse the input as a Planguage spec.  When the input already carries canonical Planguage tags (Function./Value./Solution./Constraint./Resource.) the local parser runs instantly.  Otherwise the AI extractor runs (~30–90s) — Claude reads the document natively, including PDFs and URLs, and returns structured Planguage entries.  Last-resort fallback wraps bulk text as a single Value entry so nothing is silently dropped."
                @click="handleReadInParse"
              >
                <template v-if="planInputLoading">
                  <div class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                  {{ planInputProgress || 'Processing…' }}
                </template>
                <template v-else>
                  <span aria-hidden="true">✨</span>
                  Parse as Planguage
                </template>
              </button>

              <LoadingProgress
                :loading="planInputLoading"
                :label="planInputProgress || 'Processing…'"
                :baseline="35"
                hint="parses locally in the browser — no AI round-trip"
                color="indigo"
                :phases="READ_IN_PHASES"
              />
              <AmuseMeButton :is-loading="planInputLoading" class="w-full mt-2" />

              <!-- r41 v185 — awaiting-Claudian UI block removed (dead since v184
                   reverted the round-trip).  Direct local parse is the only path. -->

              <!-- Error message — shown in the input form so it's in context with the Parse button.
                   r41 v264 (Tom Gilb 2026-06-21 "parse failing message again") — when the failure
                   message mentions the Contracts agent path, expose a ONE-CLICK button that closes
                   the panel + opens the Contracts agent.  Tom was expected to read + navigate; now
                   the system does it for him.  Composes with MOVE Principle + Do-Not-Outsource-
                   Investigation + accessibility_tom.md (one click vs read-then-navigate).  Also
                   exposes a one-click Retry button so transient Claude/pdfjs failures aren't a
                   manual re-upload chore. -->
              <div
                v-if="planInputError"
                ref="errorBannerRef"
                class="text-sm text-red-700 bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3 scroll-mt-4 shadow-sm space-y-3"
                role="alert"
              >
                <p>
                  <strong class="block mb-0.5">⚠ Parse failed</strong>
                  {{ planInputError }}
                </p>
                <div class="flex flex-wrap gap-2 pt-1 border-t border-red-200">
                  <button
                    v-if="/contract|legal/i.test(planInputError)"
                    type="button"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 active:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors shadow-sm"
                    title="Close this panel + open the 📜 Contracts agent (designed for legal/contract PDFs).  Tom Gilb 2026-06-21: one click instead of reading + navigating."
                    aria-label="Open the Contracts agent — handles legal and contract PDFs natively"
                    @click="emit('open-contracts-agent')"
                  >
                    <span aria-hidden="true">📜</span>
                    <span>Open Contracts Agent →</span>
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border-2 border-red-300 text-red-700 text-xs font-semibold hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                    title="Retry the parse — handles transient Claude API rate limits or pdfjs worker race conditions"
                    aria-label="Retry parse"
                    @click="handleReadInParse()"
                  >
                    <span aria-hidden="true">↻</span>
                    <span>Retry Parse</span>
                  </button>
                </div>
              </div>

          </ScrollContainer>
        </template>

        <!-- ══════════════════════════════════════════════════════════════
             TAB 2 — FROM HISTORY
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="topTab === 'from-history'">
          <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full p-5 space-y-6">

            <!-- Plan Models section -->
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Spec Models</p>
              <div v-if="allModels.length === 0" class="text-sm text-slate-400 italic">No saved plan models yet.</div>
              <div v-else class="space-y-2">
                <div
                  v-for="model in allModels"
                  :key="model.id"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800 truncate">{{ model.name }}</p>
                    <p class="text-xs text-slate-400 mt-0.5">
                      v{{ model.version }}
                      · {{ model.spec.functions.length }}F {{ model.spec.values.length }}V {{ model.spec.solutions.length }}S
                      · {{ fmtDate(model.updatedAt) }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg
                           bg-indigo-600 text-white text-xs font-semibold
                           hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
                           transition-colors"
                    @click="handleHistoryLoadModel(model)"
                  >
                    <span aria-hidden="true">↩</span> Load Plan
                  </button>
                </div>
              </div>
            </div>

            <!-- Spec Versions section -->
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Spec Versions</p>
              <div v-if="history.length === 0" class="text-sm text-slate-400 italic">No saved spec versions yet.</div>
              <div v-else class="space-y-2">
                <div
                  v-for="sv in history"
                  :key="sv.id"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-violet-200 hover:bg-violet-50/30 transition-colors"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800">
                      <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 mr-1.5">{{ sv.label }}</span>
                      {{ fmtTs(sv.timestamp) }}
                    </p>
                    <p class="text-xs text-slate-400 mt-0.5 truncate">{{ sv.summary }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg
                           bg-violet-600 text-white text-xs font-semibold
                           hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                           transition-colors"
                    @click="handleHistoryRestoreVersion(sv)"
                  >
                    <span aria-hidden="true">↩</span> Restore
                  </button>
                </div>
              </div>
            </div>

          </ScrollContainer>
        </template>

        <!-- ══════════════════════════════════════════════════════════════
             TAB 3 — MERGE PLANS
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else>
          <ScrollContainer ref="scrollMergeRef" outer-class="flex-1 min-h-0 relative" inner-class="h-full p-5 space-y-5">

            <!-- Explainer -->
            <div class="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
              <span class="text-base shrink-0" aria-hidden="true">🔀</span>
              <div>
                <p class="font-semibold mb-0.5">Merge any combination of saved plans, spec versions, and free text.</p>
                <p class="text-sky-700">The AI deduplicates, resolves contradictions, and synthesises a single Planguage spec. Great for combining an old plan with meeting notes, or merging two competing specs.</p>
              </div>
            </div>

            <!-- Plan Models selection -->
            <div v-if="allModels.length > 0">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Spec Models</p>
              <div class="space-y-1.5">
                <label
                  v-for="model in allModels"
                  :key="model.id"
                  class="flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors"
                  :class="mergeModelIds.has(model.id)
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    :checked="mergeModelIds.has(model.id)"
                    @change="toggleMergeModel(model.id)"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ model.name }}</p>
                    <p class="text-xs text-slate-400">v{{ model.version }} · {{ fmtDate(model.updatedAt) }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Spec Versions selection -->
            <div v-if="history.length > 0">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Spec Versions</p>
              <div class="space-y-1.5">
                <label
                  v-for="sv in history"
                  :key="sv.id"
                  class="flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors"
                  :class="mergeVersionIds.has(sv.id)
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                    :checked="mergeVersionIds.has(sv.id)"
                    @change="toggleMergeVersion(sv.id)"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800">
                      <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 mr-1.5">{{ sv.label }}</span>
                      {{ fmtTs(sv.timestamp) }}
                    </p>
                    <p class="text-xs text-slate-400 truncate">{{ sv.summary }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- No saved items nudge -->
            <div
              v-if="allModels.length === 0 && history.length === 0"
              class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 text-center"
            >
              No saved plans or spec versions yet.<br>
              <span class="text-xs text-slate-400">Add free text below to merge from scratch, or save some plans first.</span>
            </div>

            <!-- Free text input -->
            <div class="space-y-2">
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide" for="merge-text">
                Add free text (optional)
              </label>
              <textarea
                id="merge-text"
                v-model="mergeFreeText"
                rows="5"
                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent
                       resize-y placeholder:text-slate-400 font-mono"
                placeholder="Paste meeting notes, email threads, additional plan text, or any free-form content to merge in…"
                :disabled="mergeLoading"
              />
            </div>

            <!-- Selection count badge -->
            <div v-if="mergeSelectionCount > 0" class="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
              <span aria-hidden="true">✓</span>
              <strong>{{ mergeSelectionCount }} source{{ mergeSelectionCount !== 1 ? 's' : '' }}</strong> selected for merge
            </div>

            <!-- r41 v177 — Send-to-Claudian merge button -->
            <button
              v-if="!mergeAwaitingClaudian"
              type="button"
              class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                     bg-gradient-to-r from-violet-600 to-sky-600 text-white text-sm font-semibold
                     hover:from-violet-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2
                     transition-all shadow-md shadow-violet-200/60"
              :disabled="mergeLoading || mergeSelectionCount === 0"
              title="Merge the selected sources into a single consolidated Planguage spec — runs locally in the browser, no AI round-trip."
              @click="handleMerge"
            >
              <template v-if="mergeLoading">
                <div class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                Merging…
              </template>
              <template v-else>
                <span aria-hidden="true">🔀</span>
                Merge {{ mergeSelectionCount > 0 ? `${mergeSelectionCount} source${mergeSelectionCount !== 1 ? 's' : ''}` : 'Plans' }}
              </template>
            </button>

            <LoadingProgress
              :loading="mergeLoading"
              label="Building merge prompt…"
              :baseline="40"
              :phases="MERGE_PHASES"
              hint="merges locally in the browser — no AI round-trip"
              color="indigo"
            />
            <AmuseMeButton :is-loading="mergeLoading" class="w-full mt-2" />

            <!-- r41 v185 — merge awaiting-Claudian UI block removed (dead
                 since v184 reverted the round-trip). -->

            <p v-if="mergeError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3" role="alert">
              {{ mergeError }}
            </p>

            <!-- ── Merge results ── -->
            <template v-if="mergeParsed && !mergeLoading">
              <div class="border-t border-slate-100 pt-5 space-y-4">

                <!-- Header -->
                <div class="flex items-center gap-2">
                  <span class="text-xl" aria-hidden="true">✅</span>
                  <p class="text-sm font-bold text-slate-800">Merge complete</p>
                </div>

                <!-- Sources that contributed -->
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Sources merged</p>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="(label, i) in mergeSourceLabels"
                      :key="i"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                             bg-violet-100 text-violet-800 border border-violet-200"
                    >
                      {{ label }}
                    </span>
                  </div>
                </div>

                <!-- F / V / S count grid -->
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Spec entry counts</p>
                  <div class="grid grid-cols-3 gap-2">
                    <div class="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-center">
                      <p class="text-2xl font-black text-blue-700 leading-none">{{ mergeDiffCounts.F }}</p>
                      <p class="text-[10px] text-blue-500 font-semibold mt-1 uppercase tracking-wide">Functions</p>
                    </div>
                    <div class="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2.5 text-center">
                      <p class="text-2xl font-black text-indigo-700 leading-none">{{ mergeDiffCounts.V }}</p>
                      <p class="text-[10px] text-indigo-500 font-semibold mt-1 uppercase tracking-wide">Values</p>
                    </div>
                    <div class="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2.5 text-center">
                      <p class="text-2xl font-black text-violet-700 leading-none">{{ mergeDiffCounts.S }}</p>
                      <p class="text-[10px] text-violet-500 font-semibold mt-1 uppercase tracking-wide">Solutions</p>
                    </div>
                  </div>
                </div>

                <!-- New entries (vs current plan) — only when there was a plan before -->
                <div v-if="mergeDiffNew.length > 0">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                    New entries not in your current plan ({{ mergeDiffNew.length }})
                  </p>
                  <div class="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div
                      v-for="entry in mergeDiffNew.slice(0, 6)"
                      :key="entry.id"
                      class="flex items-start gap-2 text-xs"
                    >
                      <span
                        class="shrink-0 font-mono font-bold"
                        :class="{
                          'text-blue-600': entry.entryType === 'F',
                          'text-indigo-600': entry.entryType === 'V',
                          'text-violet-600': entry.entryType === 'S',
                        }"
                      >{{ entry.id }}</span>
                      <span class="text-emerald-800 truncate">{{ entry.description }}</span>
                    </div>
                    <p v-if="mergeDiffNew.length > 6" class="text-xs text-emerald-600 italic">
                      + {{ mergeDiffNew.length - 6 }} more new entries…
                    </p>
                  </div>
                </div>

                <!-- Full entry preview -->
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Preview of merged spec</p>
                  <div class="space-y-1">
                    <div
                      v-for="f in mergeParsed.functions.slice(0, 2)"
                      :key="f.id"
                      class="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-100"
                    >
                      <span class="shrink-0 font-mono text-blue-500 font-semibold w-[80px]">{{ f.id }}</span>
                      <span class="truncate">{{ f.description }}</span>
                    </div>
                    <div
                      v-for="v in mergeParsed.values.slice(0, 2)"
                      :key="v.id"
                      class="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-100"
                    >
                      <span class="shrink-0 font-mono text-indigo-500 font-semibold w-[80px]">{{ v.id }}</span>
                      <span class="truncate">{{ v.description }}</span>
                    </div>
                    <div
                      v-for="s in mergeParsed.solutions.slice(0, 1)"
                      :key="s.id"
                      class="flex items-start gap-2 text-xs text-slate-600 py-1"
                    >
                      <span class="shrink-0 font-mono text-violet-500 font-semibold w-[80px]">{{ s.id }}</span>
                      <span class="truncate">{{ s.description }}</span>
                    </div>
                    <p v-if="mergeDiffCounts.total > 5" class="text-xs text-slate-400 italic pt-1">
                      + {{ mergeDiffCounts.total - 5 }} more entries in merged spec…
                    </p>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="space-y-2 pt-1">
                  <button
                    v-if="props.hasCurrentPlan"
                    type="button"
                    class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                           bg-emerald-600 text-white text-sm font-semibold
                           hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 transition-colors"
                    title="Merge the result into your existing live plan — new entries are added alongside existing ones. No existing entries are removed."
                    @click="handleMergeAddTo"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    Add to current plan
                    <span class="text-emerald-200 text-xs font-normal">(keeps existing entries)</span>
                  </button>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold
                             focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                      :class="props.hasCurrentPlan
                        ? 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-400'
                        : 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-400'"
                      :title="props.hasCurrentPlan
                        ? 'Replace your current live plan with the merged spec — your existing entries will be overwritten.'
                        : 'Load the merged spec as your live plan and start working with it.'"
                      @click="handleMergeUse"
                    >
                      <span aria-hidden="true">{{ props.hasCurrentPlan ? '↩' : '✓' }}</span>
                      {{ props.hasCurrentPlan ? 'Replace current plan' : 'Use merged spec' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px]
                             rounded-xl bg-amber-500 text-white text-sm font-semibold
                             hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
                      title="Load the merged spec and immediately open the Sharpen panel to refine and improve it with AI."
                      @click="handleMergeSharpen"
                    >
                      <span aria-hidden="true">🔪</span> Use + Sharpen
                    </button>
                  </div>
                </div>

                <!-- ── Copy & Email export ── -->
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Copy &amp; Email Merge Results</p>

                  <!-- All-3 row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg
                             bg-slate-800 text-white text-xs font-semibold
                             hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all 3 merged components (Functions + Values + Solutions) as a colored HTML table — paste with ⌘V in Mail, Keynote, or Notes. Includes source labels and timestamp."
                      :aria-label="copiedExport === 'mg-all' ? 'Copied!' : 'Copy all 3 merged components as colored HTML tables'"
                      @click="copyMerge('all')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-all' ? '✓' : '📋' }}</span>
                      {{ copiedExport === 'mg-all' ? 'Copied!' : 'Copy All · Function + Value + Solution' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg
                             bg-violet-600 text-white text-xs font-semibold
                             hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all merge results to clipboard as colored tables, then open Mail.app — paste with ⌘V in the email body for full-color tables. Subject includes entry counts and timestamp."
                      :aria-label="copiedExport === 'mg-email' ? 'Copied — Mail opening' : 'Email all merge results'"
                      @click="emailMerge"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-email' ? '✓' : '✉️' }}</span>
                      {{ copiedExport === 'mg-email' ? 'Opening Mail…' : 'Mail All' }}
                    </button>
                  </div>

                  <!-- Individual component row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold
                             hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy merged Functions only (${mergeParsed?.functions.length ?? 0} entries) as a colored blue HTML table — paste with ⌘V. Includes source labels and timestamp.`"
                      :aria-label="copiedExport === 'mg-F' ? 'Functions copied' : 'Copy merged Functions only'"
                      @click="copyMerge('F')"
                    >
                      <span v-if="copiedExport === 'mg-F'" aria-hidden="true">✓</span>
                      {{ copiedExport === 'mg-F' ? 'Copied' : 'Functions' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-violet-300 bg-violet-50 text-violet-700 text-xs font-semibold
                             hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy merged Values only (${mergeParsed?.values.length ?? 0} entries) as a colored violet HTML table — paste with ⌘V. Includes Scale, Meter, Tolerable, Goal, source labels, and timestamp.`"
                      :aria-label="copiedExport === 'mg-V' ? 'Values copied' : 'Copy merged Values only'"
                      @click="copyMerge('V')"
                    >
                      <span v-if="copiedExport === 'mg-V'" aria-hidden="true">✓</span>
                      {{ copiedExport === 'mg-V' ? 'Copied' : 'Values' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-orange-300 bg-orange-50 text-orange-700 text-xs font-semibold
                             hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy merged Solutions only (${mergeParsed?.solutions.length ?? 0} entries) as a colored orange HTML table — paste with ⌘V. Includes Impact, For Function, source labels, and timestamp.`"
                      :aria-label="copiedExport === 'mg-S' ? 'Solutions copied' : 'Copy merged Solutions only'"
                      @click="copyMerge('S')"
                    >
                      <span v-if="copiedExport === 'mg-S'" aria-hidden="true">✓</span>
                      {{ copiedExport === 'mg-S' ? 'Copied' : 'Solutions' }}
                    </button>
                  </div>

                  <!-- Confirmation hint -->
                  <p
                    v-if="copiedExport?.startsWith('mg-')"
                    class="text-[11px] text-emerald-600 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    ✓ Copied — paste with ⌘V in Mail, Keynote, or Notes for full-color tables
                  </p>
                </div>

              </div>
            </template>

          </ScrollContainer>
        </template>

      </div>
    </div>
  </Teleport>
</template>
