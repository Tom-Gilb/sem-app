<!--
  SpecInputPanel.vue — r41 v207 (Tom Gilb 2026-06-19) — REFIT to two-column
  layout per Tom's verbatim "put them in separate scrollable windows, that
  we can check if we want, or not. The input can be narrow, but the parse
  should be in one window for each type (S V F C). Finally a control
  panel."

  Layout (after parse):
  ┌──────────────┬────────────────────────────────────────────────────┐
  │ INPUT (narrow│ PARSED GRID (3×2)                                  │
  │ ~380px)      │ ┌─ Stakeholder ─┐ ┌─ Function ─┐ ┌─ Value ───────┐│
  │ mode tabs    │ │  ☑ A          │ │  ☑ B       │ │  ☑ C          ││
  │ textarea/url │ │  ☑ ...        │ │  ☑ ...     │ │  ☑ ...        ││
  │ /file        │ │  ↕ scroll     │ │  ↕ scroll  │ │  ↕ scroll     ││
  │              │ ├───────────────┤ ├────────────┤ ├───────────────┤│
  │ ↕ scroll     │ │ Solution      │ │ Constraint │ │ Resource      ││
  │              │ │  ☑ ...        │ │  ☑ ...     │ │  ☑ ...        ││
  │              │ │  ↕ scroll     │ │  ↕ scroll  │ │  ↕ scroll     ││
  │              │ └───────────────┘ └────────────┘ └───────────────┘│
  ├──────────────┴────────────────────────────────────────────────────┤
  │ CONTROL PANEL                                                     │
  │ Apply: ⦿ Add to spec  ○ Replace      Re-parse | Generate Spec →   │
  └───────────────────────────────────────────────────────────────────┘

  Features:
   • Each type window is its own ScrollContainer (per ScrollContainer rule)
   • Per-entry checkbox — only ticked entries flow into the spec on Generate
   • Provenance flash — click a parsed entry → scrolls input to the source
     line that produced it + briefly border-flashes (heuristic match on id +
     first 25 chars of description)
   • Control panel: Apply mode (Add / Replace) · Re-parse · Generate Spec →
     + Generate + Sharpen 🔪 secondary
   • Mode tabs (Text / URL / File) remain in the input column

  Emits unchanged (back-compat):
   imported              — Use spec as-is (Replace flow when hasCurrentPlan)
   imported-and-sharpen  — Use spec + open SharpenPanel
   add-to                — Merge parsed spec into existing live spec
   close                 — Dismiss modal

  Composes with: ScrollContainer rule (per-window scroll), Spell-out-Type-
  Names SUPREME (full English type words), DD-009 Zero-Training UI (counts +
  HoverHints), No-Silent-Data-Loss SUPREME (per-entry tick is explicit),
  MOVE Principle (Apply mode + Generate visible at-a-glance), Both-surfaces
  rule (parsed spec data shape unchanged on the wire).
-->

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import {
  planInputLoading,
  planInputError,
  planInputProgress,
  extractFromUrl,
  extractFromFile,
  parseAsPlanguage,
  type PlanInputMode,
} from '../composables/useSpecInput'
import type { SpecBlock, FEntry, VEntry, SEntry, CEntry, REntry } from '../types/spec'
import LoadingProgress, { type LoadingPhase } from './LoadingProgress.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'

const props = defineProps<{
  hasCurrentPlan?: boolean
}>()

const emit = defineEmits<{
  imported:             [spec: SpecBlock]
  'imported-and-sharpen': [spec: SpecBlock]
  'add-to':             [spec: SpecBlock]
  close:                []
}>()

// ── Running-commentary phases (Tom Gilb 2026-06-16 "all stages") ─────────────
const SPEC_INPUT_PHASES: LoadingPhase[] = [
  { atSecond: 0,  message: '📥 Reading your input — pulling text from URL / file / paste.' },
  { atSecond: 6,  message: '🧠 Understanding the source — identifying domain + intent.' },
  { atSecond: 14, message: '🔍 Extracting Planguage entries — Stakeholders, Functions, Values, Solutions, Constraints.' },
  { atSecond: 24, message: '🎯 Quantifying Values — drafting Scale / Tolerable / Goal / Wish.' },
  { atSecond: 32, message: '🔗 Cross-linking + validating the Planguage Representation.' },
  { atSecond: 50, message: '⏱ Still working — long documents legitimately take 60s+.' },
]

// ── State ─────────────────────────────────────────────────────────────────────

const mode         = ref<PlanInputMode>('text')
const pastedText   = ref('')
const urlInput     = ref('')
const selectedFile = ref<File | null>(null)
const parsedSpec   = ref<SpecBlock | null>(null)
/** Raw source text that produced the parse — used for provenance highlighting. */
const sourceText   = ref('')

/** Per-entry checkbox state.  Keyed by entry id.  Default = ticked on parse. */
const entrySelection = ref<Record<string, boolean>>({})

/** Provenance map: entry.id → 0-based line index in sourceText that best
 *  matches it (heuristic).  Used to scroll the input area on entry click. */
const entryProvenance = ref<Record<string, number>>({})

/** Apply mode for Generate Spec — Add merges with existing spec; Replace
 *  overwrites.  Default to Add per "Never silently destroy work" disposition. */
const applyMode = ref<'add' | 'replace'>('add')

/** Stakeholder entries derived from spec.stakeholderEntries (Tom Gilb r68+). */
type StakeholderEntry = { id: string; description?: string; definition?: string }

/** Refs for input scroll-to-line provenance flash. */
const inputTextareaRef = ref<HTMLTextAreaElement | null>(null)

// ── Helpers ───────────────────────────────────────────────────────────────────

function selectMode(m: PlanInputMode): void {
  mode.value       = m
  parsedSpec.value = null
  sourceText.value = ''
  entrySelection.value  = {}
  entryProvenance.value = {}
  planInputError.value = ''
}

function handleFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  selectedFile.value   = input.files?.[0] ?? null
  parsedSpec.value     = null
  sourceText.value     = ''
  entrySelection.value  = {}
  entryProvenance.value = {}
  planInputError.value = ''
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

// ── Parse ─────────────────────────────────────────────────────────────────────

async function handleParse(): Promise<void> {
  planInputError.value    = ''
  parsedSpec.value        = null
  sourceText.value        = ''
  entrySelection.value    = {}
  entryProvenance.value   = {}
  planInputLoading.value  = true
  planInputProgress.value = ''

  try {
    let rawSource = ''
    if (mode.value === 'text') {
      if (!pastedText.value.trim()) { planInputError.value = 'Paste some text to parse.'; return }
      rawSource = pastedText.value.trim()
      parsedSpec.value = await parseAsPlanguage(rawSource)
    } else if (mode.value === 'url') {
      if (!urlInput.value.trim()) { planInputError.value = 'Enter a URL.'; return }
      rawSource = await extractFromUrl(urlInput.value.trim())
      parsedSpec.value = await parseAsPlanguage(rawSource)
    } else {
      if (!selectedFile.value) { planInputError.value = 'Choose a file.'; return }
      const { text, isPdf, pdfBase64 } = await extractFromFile(selectedFile.value)
      rawSource = text
      parsedSpec.value = await parseAsPlanguage(text, { isPdf, pdfBase64 })
    }

    sourceText.value = rawSource

    if (!parsedSpec.value) {
      planInputError.value =
        'Could not extract a Planguage spec from this content. ' +
        'Try adding more detail, or paste a longer section of the document.'
      return
    }

    // Initialise per-entry selection (all ticked) + build provenance map.
    initSelection(parsedSpec.value)
    entryProvenance.value = buildProvenance(parsedSpec.value, rawSource)
    // If the source mode is 'text', mirror the pasted text into the input
    // textarea so provenance highlights work.  For URL / file modes, also
    // populate pastedText so the user can see the source they parsed against.
    if (mode.value !== 'text') {
      pastedText.value = rawSource
    }
    await nextTick()
  } catch (err) {
    planInputError.value = err instanceof Error ? err.message : 'An unexpected error occurred.'
  } finally {
    planInputLoading.value  = false
    planInputProgress.value = ''
  }
}

// ── Filter spec by selection before emit ──────────────────────────────────────

function filteredSpec(): SpecBlock | null {
  const src = parsedSpec.value
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

// ── Generate (single button, applies the Apply-mode toggle) ───────────────────

function handleGenerate(): void {
  const spec = filteredSpec()
  if (!spec) return
  if (props.hasCurrentPlan && applyMode.value === 'add') {
    emit('add-to', spec)
  } else {
    emit('imported', spec)
  }
}

function handleGenerateSharpen(): void {
  const spec = filteredSpec()
  if (!spec) return
  // Sharpen path always emits imported-and-sharpen — apply mode handled by parent.
  emit('imported-and-sharpen', spec)
}

// ── Provenance flash on entry click ───────────────────────────────────────────

const flashTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function flashSourceLine(entryId: string): void {
  const lineIdx = entryProvenance.value[entryId]
  if (lineIdx == null) return
  const ta = inputTextareaRef.value
  if (!ta) return
  // Approximate scroll target: font-mono text-sm line-height ≈ 20px.
  const LINE_PX = 20
  const target  = Math.max(0, lineIdx * LINE_PX - ta.clientHeight / 3)
  ta.scrollTo({ top: target, behavior: 'smooth' })
  // Border-flash so Tom sees something happened.
  ta.classList.add('ring-2', 'ring-amber-400', 'ring-offset-1')
  if (flashTimer.value) clearTimeout(flashTimer.value)
  flashTimer.value = setTimeout(() => {
    ta.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-1')
  }, 1500)
}

// ── Per-window counts ─────────────────────────────────────────────────────────

const fnCount  = computed(() => parsedSpec.value?.functions.length ?? 0)
const valCount = computed(() => parsedSpec.value?.values.length ?? 0)
const solCount = computed(() => parsedSpec.value?.solutions.length ?? 0)
const conCount = computed(() => parsedSpec.value?.constraints?.length ?? 0)
const resCount = computed(() => parsedSpec.value?.resources?.length ?? 0)
const shCount  = computed(() => ((parsedSpec.value as { stakeholderEntries?: StakeholderEntry[] } | null)?.stakeholderEntries ?? []).length)

const tickedCount = computed(() => {
  if (!parsedSpec.value) return 0
  return Object.values(entrySelection.value).filter(Boolean).length
})

const totalCount = computed(() => fnCount.value + valCount.value + solCount.value + conCount.value + resCount.value + shCount.value)

// Stakeholder list accessor (for template).
const stakeholderList = computed<StakeholderEntry[]>(() =>
  ((parsedSpec.value as { stakeholderEntries?: StakeholderEntry[] } | null)?.stakeholderEntries ?? [])
)

// ── Clear parsed state when input mode/value changes substantially ────────────
// (Allow editing input without immediately invalidating parsed state — but if
//  the user switches mode, the parse no longer matches the source.)
watch(mode, () => { /* selectMode already clears; this is a guard */ })
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel — wider than the v76 version to fit the 3×2 parsed grid -->
    <div
      class="fixed inset-0 z-[510] flex items-center justify-center p-3 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Import Planning Data"
    >
      <div class="w-full max-w-[1400px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto max-h-[94vh]">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 bg-indigo-600 rounded-t-2xl flex-shrink-0">
          <div class="flex items-center gap-2 text-white">
            <GetGlyph size="standard" class="h-4 w-auto" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-white tracking-wide">Stage 1 · Import Planning Data</h2>
            <span v-if="parsedSpec" class="ml-2 text-[11px] font-mono px-2 py-0.5 bg-indigo-500/60 rounded-full">
              {{ tickedCount }} / {{ totalCount }} ticked
            </span>
          </div>
          <CloseDot
            variant="on-dark"
            aria-label="Close import panel"
            @click="emit('close')"
          />
        </div>

        <!-- Body: two-column flex split — INPUT (narrow left) · PARSED grid (right) -->
        <div class="flex-1 min-h-0 flex flex-col">
          <div class="flex-1 min-h-0 flex flex-row">

            <!-- ═══ LEFT COLUMN — INPUT (narrow, scrollable) ═══════════════════ -->
            <div class="w-[380px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
              <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full p-4 space-y-3">

                <!-- Mode tabs -->
                <div
                  class="flex rounded-lg border border-slate-200 bg-white p-1 gap-1"
                  role="tablist"
                  aria-label="Input mode"
                >
                  <button
                    v-for="tab in ([
                      { key: 'text', icon: '📝', label: 'Text' },
                      { key: 'url',  icon: '🔗', label: 'URL' },
                      { key: 'file', icon: '📄', label: 'File' },
                    ] as const)"
                    :key="tab.key"
                    type="button"
                    role="tab"
                    :aria-selected="mode === tab.key"
                    :class="[
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                      mode === tab.key
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                    ]"
                    @click="selectMode(tab.key)"
                  >
                    <span aria-hidden="true">{{ tab.icon }}</span>
                    {{ tab.label }}
                  </button>
                </div>

                <!-- Paste text — also serves as the source-view textarea after parse,
                     so the provenance flash scrolls a visible region. -->
                <div v-if="mode === 'text' || parsedSpec" class="space-y-1.5">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide" for="plan-paste">
                    Source text {{ parsedSpec ? '(click an entry to scroll here)' : '' }}
                  </label>
                  <textarea
                    id="plan-paste"
                    ref="inputTextareaRef"
                    v-model="pastedText"
                    rows="18"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                           resize-y placeholder:text-slate-400 font-mono leading-snug bg-white
                           transition-shadow"
                    placeholder="Paste your plan, strategy doc, project brief, meeting notes, OKRs, roadmap — any text…"
                    :disabled="planInputLoading"
                  />
                </div>

                <!-- URL input -->
                <div v-if="mode === 'url' && !parsedSpec" class="space-y-2">
                  <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide" for="plan-url">
                    Page URL
                  </label>
                  <input
                    id="plan-url"
                    v-model="urlInput"
                    type="url"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                           placeholder:text-slate-400"
                    placeholder="https://…"
                    :disabled="planInputLoading"
                    @keydown.enter="handleParse"
                  />
                  <p class="text-[10px] text-slate-500">Public web pages, GitHub READMEs, Google Docs (published).</p>
                </div>

                <!-- File upload -->
                <div v-if="mode === 'file' && !parsedSpec" class="space-y-2">
                  <label
                    class="flex flex-col items-center gap-2 px-4 py-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
                    :class="selectedFile
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'"
                  >
                    <span class="text-2xl" aria-hidden="true">{{ selectedFile ? '📄' : '📂' }}</span>
                    <p class="text-xs font-medium text-slate-700 text-center">
                      {{ selectedFile ? selectedFile.name : 'Drop file or click' }}
                    </p>
                    <p class="text-[10px] text-slate-400">PDF · .docx · .txt · .md · .html · .csv</p>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.html,.htm,.csv"
                      class="sr-only"
                      :disabled="planInputLoading"
                      @change="handleFileChange"
                    />
                  </label>
                  <p v-if="selectedFile" class="text-[10px] text-slate-500">
                    {{ (selectedFile.size / 1024).toFixed(0) }} KB · {{ selectedFile.name.split('.').pop()?.toUpperCase() }}
                  </p>
                </div>

                <!-- Replace-warning -->
                <div
                  v-if="props.hasCurrentPlan && !parsedSpec"
                  class="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800"
                  role="alert"
                >
                  <span aria-hidden="true">⚠️</span>
                  <div>
                    <p class="font-semibold">Replace warning</p>
                    <p class="text-amber-700 leading-snug mt-0.5">
                      Apply: <strong>Add</strong> merges; <strong>Replace</strong> overwrites your live spec.
                      Save first
                      (<span class="inline-flex items-center gap-1 align-middle"><SaveGlyph size="compact" class="inline-block h-2.5 w-auto -mt-0.5" /></span>)
                      if you want to keep it.
                    </p>
                  </div>
                </div>

                <!-- Parse button (in left column when no parsed yet) -->
                <button
                  v-if="!parsedSpec"
                  type="button"
                  class="w-full flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg
                         bg-indigo-600 text-white text-xs font-semibold
                         hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                         transition-colors"
                  :disabled="planInputLoading"
                  @click="handleParse"
                >
                  <template v-if="planInputLoading">
                    <div class="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {{ planInputProgress || 'Parsing…' }}
                  </template>
                  <template v-else>
                    <span aria-hidden="true">🔍</span>
                    Parse as Planguage Spec
                  </template>
                </button>

                <LoadingProgress
                  :loading="planInputLoading"
                  :label="planInputProgress || 'Processing…'"
                  :baseline="35"
                  hint="can take up to 60s for large documents"
                  color="indigo"
                  :phases="SPEC_INPUT_PHASES"
                />

                <p
                  v-if="planInputError"
                  class="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 leading-snug"
                  role="alert"
                >
                  {{ planInputError }}
                </p>

              </ScrollContainer>
            </div>

            <!-- ═══ RIGHT COLUMN — PARSED 3×2 GRID ═══════════════════════════════ -->
            <div class="flex-1 min-h-0 bg-slate-100">

              <!-- Empty state — when no parse yet -->
              <div
                v-if="!parsedSpec"
                class="h-full flex items-center justify-center p-6"
              >
                <div class="max-w-md text-center space-y-2">
                  <div class="text-4xl">⬅️</div>
                  <p class="text-sm font-semibold text-slate-700">
                    Paste / fetch / upload your source on the left
                  </p>
                  <p class="text-xs text-slate-500 leading-relaxed">
                    Once parsed, each Planguage entry type gets its own scrollable
                    window here. Tick the entries you want in your spec.
                  </p>

                  <!-- Supported formats moved here (was a sidebar grid; folded into the empty state) -->
                  <div class="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 mt-4 text-left">
                    <div>
                      <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">Supported</p>
                      <ul class="space-y-0.5 text-[10px] text-slate-600 leading-relaxed">
                        <li>PDF · Word .docx · .txt · .md</li>
                        <li>HTML · CSV · RTF</li>
                        <li>Any pasted text · public web URLs</li>
                        <li>Google Docs/Sheets/Slides (anyone-with-link)</li>
                      </ul>
                    </div>
                    <div>
                      <p class="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">Not available</p>
                      <ul class="space-y-0.5 text-[10px] text-slate-600 leading-relaxed">
                        <li>.doc → save as .docx</li>
                        <li>PowerPoint/Keynote → PDF</li>
                        <li>Excel → CSV</li>
                        <li>Private URLs → paste content</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Parsed: 3×2 grid of type windows -->
              <div
                v-else
                class="h-full p-3"
              >
                <div class="h-full grid grid-cols-3 grid-rows-2 gap-3">

                  <!-- Helper: per-type window template -->
                  <!-- Stakeholder (slate-blue) -->
                  <div class="flex flex-col rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-200">
                      <span class="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Stakeholder</span>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {{ stakeholderList.filter(sh => entrySelection[sh.id]).length }} / {{ shCount }}
                      </span>
                    </div>
                    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-2 py-1.5">
                      <div v-if="shCount === 0" class="text-[11px] italic text-slate-400 px-2 py-1.5">No stakeholders detected.</div>
                      <label
                        v-for="sh in stakeholderList"
                        :key="sh.id"
                        class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-blue-50 cursor-pointer text-xs"
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

                  <!-- Function (green) -->
                  <div class="flex flex-col rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 bg-emerald-50 border-b border-emerald-200">
                      <span class="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Function</span>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                        {{ parsedSpec.functions.filter((f: FEntry) => entrySelection[f.id]).length }} / {{ fnCount }}
                      </span>
                    </div>
                    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-2 py-1.5">
                      <div v-if="fnCount === 0" class="text-[11px] italic text-slate-400 px-2 py-1.5">No functions detected.</div>
                      <label
                        v-for="f in parsedSpec.functions"
                        :key="f.id"
                        class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-emerald-50 cursor-pointer text-xs"
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
                  <div class="flex flex-col rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-200">
                      <span class="text-[11px] font-semibold text-violet-700 uppercase tracking-wide">Value</span>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">
                        {{ parsedSpec.values.filter((v: VEntry) => entrySelection[v.id]).length }} / {{ valCount }}
                      </span>
                    </div>
                    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-2 py-1.5">
                      <div v-if="valCount === 0" class="text-[11px] italic text-slate-400 px-2 py-1.5">No values detected.</div>
                      <label
                        v-for="v in parsedSpec.values"
                        :key="v.id"
                        class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-violet-50 cursor-pointer text-xs"
                        @click="flashSourceLine(v.id)"
                      >
                        <input type="checkbox" v-model="entrySelection[v.id]" class="mt-0.5 shrink-0 accent-violet-600" />
                        <div class="flex-1 min-w-0">
                          <p class="font-mono font-semibold text-violet-700 truncate">{{ v.id }}</p>
                          <p v-if="v.description" class="text-slate-600 leading-snug line-clamp-2">{{ v.description }}</p>
                          <p v-if="v.goal" class="text-emerald-700 text-[10px] mt-0.5"><span class="font-semibold">Goal:</span> {{ v.goal }}</p>
                        </div>
                      </label>
                    </ScrollContainer>
                  </div>

                  <!-- Solution (orange) -->
                  <div class="flex flex-col rounded-xl border border-orange-200 bg-white shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 bg-orange-50 border-b border-orange-200">
                      <span class="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">Solution</span>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                        {{ parsedSpec.solutions.filter((s: SEntry) => entrySelection[s.id]).length }} / {{ solCount }}
                      </span>
                    </div>
                    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-2 py-1.5">
                      <div v-if="solCount === 0" class="text-[11px] italic text-slate-400 px-2 py-1.5">No solutions detected.</div>
                      <label
                        v-for="s in parsedSpec.solutions"
                        :key="s.id"
                        class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-orange-50 cursor-pointer text-xs"
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
                  <div class="flex flex-col rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 bg-red-50 border-b border-red-200">
                      <span class="text-[11px] font-semibold text-red-700 uppercase tracking-wide">Constraint</span>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                        {{ (parsedSpec.constraints ?? []).filter((c: CEntry) => entrySelection[c.id]).length }} / {{ conCount }}
                      </span>
                    </div>
                    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-2 py-1.5">
                      <div v-if="conCount === 0" class="text-[11px] italic text-slate-400 px-2 py-1.5">No constraints detected.</div>
                      <label
                        v-for="c in (parsedSpec.constraints ?? [])"
                        :key="c.id"
                        class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-red-50 cursor-pointer text-xs"
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
                  <div class="flex flex-col rounded-xl border border-teal-200 bg-white shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 bg-teal-50 border-b border-teal-200">
                      <span class="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">Resource</span>
                      <span class="text-[10px] font-mono px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">
                        {{ (parsedSpec.resources ?? []).filter((r: REntry) => entrySelection[r.id]).length }} / {{ resCount }}
                      </span>
                    </div>
                    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full px-2 py-1.5">
                      <div v-if="resCount === 0" class="text-[11px] italic text-slate-400 px-2 py-1.5">No resources detected.</div>
                      <label
                        v-for="r in (parsedSpec.resources ?? [])"
                        :key="r.id"
                        class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-teal-50 cursor-pointer text-xs"
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
          </div>

          <!-- ═══ CONTROL PANEL (bottom bar — only after parse) ═══════════════════ -->
          <div
            v-if="parsedSpec"
            class="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0"
          >
            <!-- Apply mode toggle -->
            <div class="flex items-center gap-3">
              <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Apply</span>
              <div
                class="flex rounded-lg border border-slate-200 bg-white p-0.5 gap-0.5"
                role="radiogroup"
                aria-label="Apply mode"
              >
                <button
                  type="button"
                  role="radio"
                  :aria-checked="applyMode === 'add'"
                  :class="[
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                    applyMode === 'add'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-700',
                  ]"
                  @click="applyMode = 'add'"
                >
                  Add to spec
                </button>
                <button
                  type="button"
                  role="radio"
                  :aria-checked="applyMode === 'replace'"
                  :class="[
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                    applyMode === 'replace'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'text-slate-500 hover:text-slate-700',
                  ]"
                  @click="applyMode = 'replace'"
                >
                  Replace
                </button>
              </div>
              <p class="text-[10px] text-slate-400 italic">
                {{ applyMode === 'add' ? 'Merges with existing entries' : 'Overwrites the live spec' }}
              </p>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600
                       hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400
                       transition-colors"
                title="Re-run the parser against the current source text"
                @click="handleParse"
              >
                ↻ Re-parse
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white
                       hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400
                       transition-colors flex items-center gap-1"
                title="Generate the spec then immediately open the Sharpening panel"
                :disabled="tickedCount === 0"
                @click="handleGenerateSharpen"
              >
                <span>🔪</span> Generate + Sharpen
              </button>
              <button
                type="button"
                class="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400
                       transition-colors flex items-center gap-1.5
                       disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="tickedCount === 0"
                @click="handleGenerate"
              >
                Generate Spec
                <span class="font-mono text-[10px] bg-indigo-500/60 px-1.5 py-0.5 rounded">{{ tickedCount }}</span>
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
