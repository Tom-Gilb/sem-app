<!-- UNIT_TYPE=Widget -->
<!-- SEMEntryForm — single-input voice-first entry.
     Stage 1 (input): one textarea. Say or type anything — stakeholders, goals,
     strategies, in any order, any combination. Voice fills it automatically
     when the mic is on.
     Stage 2 (review): parsed Who / What / How chip lists, all editable by voice
     or keyboard. Say "done" or press Enter on any chip field to commit.
     Spec: S.EvoStep1.TailwindMobileFirstForm -->

<script setup lang="ts">
import CloseDot from './CloseDot.vue'
import PlanScopeStatusStrip from './PlanScopeStatusStrip.vue'   // v503
// DD-001 (2026-05-13) — Get glyph for file-input + the cross-reference to
// the Import action elsewhere in the app.
import GetGlyph from './icons/GetGlyph.vue'
import EditGlyph from './icons/EditGlyph.vue'
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useEntryForm } from '../composables/useEntryForm'
import { SEM_TEMPLATES } from '../data/semTemplates'
import { SURPRISE_SEEDS } from '../data/surpriseSeeds'
import { useDocumentImport } from '../composables/useDocumentImport'
import { looksLikeSpec, parseMarkdownSpec } from '../composables/useSpecImport'
import { useInputSafetyNet, getLatestDraft } from '../composables/useInputSafetyNet'
import { useUltraLight, type ForkId } from '../composables/useUltraLight'
import { useToast } from '../composables/useToast'
import ForkBar from './ForkBar.vue'
// Advanced Parsing — Tier 1 (rule-based) implied entries panel.
// Tom 2026-05-17: "How is it going with my request earlier today for advanced parsing?"
import ImpliedEntriesPanel from './ImpliedEntriesPanel.vue'
import type { SugGroup } from '../utils/impliedHierarchies'
// Advanced Parsing — Tier 2 (LLM-powered) implied entries.
// Tom 2026-05-17: "go ahead with tier 2, and is it in both (ultra and normal) models or 1"
// → Both: Ultra aperture routes through SEMEntryForm, so the review stage is shared.
import { useImpliedEntriesAI } from '../composables/useImpliedEntriesAI'
// Iter 2.5 parser (Tom 2026-05-14 Ends/Means correction). See header of
// endsAndMeans.ts for Berlin-talk citations (slides 4, 6, 8, 11, 13, 16, 20).
import {
  analyzeYClause,
  isInferredEnd,
  stripInferredMarker,
  withInferredMarker,
} from '../utils/endsAndMeans'
// Stakeholder detection — layer-3 contextual extraction + pattern set used to
// override the means-exclusion gate in the final-pass implied-stakeholder scan.
import {
  extractContextualStakeholders,
  STAKEHOLDER_PATTERNS,
} from '../utils/stakeholderExtract'

/** Iter 2.5 parser flag (opt-in via ?parser=iter25 in the URL, or
 *  localStorage 'sem-app:parser:iter25:v1' = '1'). Reversible. */
const PARSER_ITER25_KEY = 'sem-app:parser:iter25:v1'

/** P8 — canonical draft key (write + restore-on-mount).
 *  Previously was 'sem-app:form-draft:v1' (write-only, never read back).
 *  Renamed to 'sem-app:raw-input-draft' (2026-05-27) and restore added. */
const DRAFT_KEY = 'sem-app:raw-input-draft'

// v492 (2026-07-21) — Tom Gilb "I did not ask it to start here or fill out with
// this example, it just did it".  Three onMounted paths silently populated the
// textarea from stale localStorage drafts on EVERY mount — including fresh page
// loads where Tom expected a blank canvas.  Fix: gate the auto-restore behind
// a MODULE-LEVEL mount counter.  First mount after page load (counter=1) skips
// auto-populate; the existing Restore pill (recoverableDraftLength / restoreLastDraft)
// surfaces the draft visibly for one-click restore.  Subsequent mounts within
// the same page load (HMR / cross-stage navigation preserving Tom's typed
// text mid-session) DO auto-populate per the original v332 use case.
//
// Module scope persists across component remounts within one page load but
// resets on full page reload — exactly the distinction we need.
let _semFirstMount = 0
function _shouldSilentAutoRestore(): boolean {
  return _semFirstMount > 0    // true only on second+ mount within same page load
}
function _readIter25(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const p = new URL(window.location.href).searchParams.get('parser')
    if (p === 'iter25') { localStorage.setItem(PARSER_ITER25_KEY, '1'); return true }
    if (p === 'off')    { localStorage.removeItem(PARSER_ITER25_KEY); return false }
    return localStorage.getItem(PARSER_ITER25_KEY) === '1'
  } catch { return false }
}
const PARSER_ITER25 = _readIter25()

const props = withDefaults(defineProps<{
  /** True while the LLM is generating a spec — disables the Generate button to prevent double-submission. */
  generating?: boolean
  /** True only when this form is the planner's primary surface (Stage 1).
   *  Gates the FIXED bottom action bars (Parse / Generate / Top / Bottom).
   *  At Stages 2-11 SEMEntryForm may still mount as a fallback when
   *  currentSpec is null, but its sticky bottom bars MUST NOT appear — they
   *  belong to Stage 1's workflow only and otherwise leak past their stage.
   *  Tom Gilb 2026-06-20 verbatim "at end the input window without scrolling
   *  popped up, BUG" — observed at Stage 2 (Solutions) where the Parse bar
   *  appeared at viewport bottom while a contract was being analysed.
   *  Defaults to true to preserve the legacy single-mount behaviour at
   *  Stage 1; App.vue passes `false` at every other stage. */
  showStickyBars?: boolean
  /** r41 v394 (Tom Gilb 2026-06-27 verbatim "the logged source of these is the
   *  'Suggested Additions' selected by [Whoever is Planner, default Scribe,]
   *  Date and Time"): resolved actor name used when stamping the FieldSource
   *  on chips accepted from the Suggested Additions panel.  Resolution chain
   *  computed in App.vue: Planner name → Scribe name → default device user
   *  → 'Default User' fallback. */
  acceptedSuggestionActor?: string
}>(), { generating: false, showStickyBars: true, acceptedSuggestionActor: 'Default User' })

const emit = defineEmits<{
  submit: [payload: { stakes: string; ends: string; means: string; wish?: string; wishStakeholder?: string; planName?: string; ownerName?: string }]
  wizard: []
  /** Fired whenever the form's internal sub-stage changes so App.vue can update the Next Step label. */
  'stage-change': [stage: 'input' | 'review']
  /**
   * Fired when an imported file is recognised as a SEM App spec (Markdown
   * output of useSpecExport.serialise()). App.vue loads it directly into
   * SpecOutput, bypassing the classifier.
   * Tom 2026-05-15: "I actually want to be able to load in files which are
   * the final output from this app!"
   */
  /** v514 — spec-import may carry the raw markdown so App.vue can extract
   *  the Resources envelope appendix (base64-encoded HTML-comment block
   *  emitted by useSpecExport.serialise when an envelope is passed). */
  'spec-import': [spec: import('../types/spec').SpecBlock, rawMarkdown?: string]
  /**
   * Ultra Light — goBack fork (Evo Step 3 — 2026-05-16).
   * Fired when the user presses the "Go Back" fork while already in the
   * 'input' sub-stage (nothing to go back to inside this component).
   * App.vue handles it by surfacing Aperture Plan view (if aperture mode is
   * on) or doing nothing (stage 1 / input is already the beginning of the app).
   */
  'go-back': []
  /**
   * v511b (2026-07-21) — Fired when the user clicks Edit on any Plan Scope
   * Framework strip pill (Deadline / Project Start / Budget).  Tom Gilb
   * verbatim: "The 3 top edit do not work at all".  Parent (App.vue) navigates
   * to Stage 10 Resources Sharpening — the canonical home of the framework
   * editor — and opens the panel focused on the requested section.
   */
  'open-scope-editor': [section: 'deadline' | 'startEvents' | 'budget']
}>()

const { setSubmitting, setHasSubmitted } = useEntryForm()

// Auto-focus the main textarea on mount so voice goes straight in.
// P8 (2026-05-27): also restore any saved draft — was write-only before this fix.
onMounted(() => {
  // v492 — auto-restore only on second+ mount (HMR / cross-stage remount).
  // On fresh page load, the Restore pill surfaces the draft visibly for
  // one-click restore — no silent auto-populate.
  if (_shouldSilentAutoRestore()) {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved && !rawInput.value) {
        rawInput.value = saved
      }
    } catch { /* localStorage unavailable (private browsing / quota) */ }
  }

  nextTick(() => {
    (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus()
  })
})

// ── Stage ────────────────────────────────────────────────────────────────────

type Stage = 'input' | 'review'
const stage = ref<Stage>('input')
// Tell App.vue whenever the sub-stage changes so it can update the Next Step label.
watch(stage, (s) => emit('stage-change', s))

// ── Input stage state ─────────────────────────────────────────────────────────

const rawInput      = ref('')
const parseError    = ref('')
const templatesOpen = ref(false)

/** Plan name — collected upfront so initSpecModel uses the user's name instead of auto-deriving
 *  from the first F. entry. Tom 2026-06-08: "reminder I wnt plan name and owner name up front". */
const planNameInput  = ref('')
/** Owner name — collected upfront so addOwner() is called immediately after initSpecModel. */
const ownerNameInput = ref('')

// v503 (2026-07-21) — Plan Scope Framework overview strip mounted at Stage 1
// per Tom Gilb "capture these project resources idea at the beginning of the
// project".
//
// v521 (2026-07-21) — ALIGN with ResourcesSharpenPanel's planId fallback.
// Tom Gilb 2026-07-21 verbatim: "no it was not there. I clicked edit and saw
// all previous data gone. I started filling out deadline, and it suddenly on
// its own jumped back to stage 1" + follow-up "no and I input edited deadline
// and budget, no appearance, but no jump away".  Root cause: SEMEntryForm's
// planIdRef used `planNameInput || 'default'` while ResourcesSharpenPanel used
// `props.planId ?? props.spec?.name ?? 'default'` — SpecBlock has NO `.name`
// field so Stage 10 ALWAYS resolves to 'default'.  When Tom typed / accepted
// an AI-suggested Plan Name in Stage 1 (e.g. "Biosignature ML Detection
// Suite"), the two surfaces split: Stage 10 wrote to :default, Stage 1
// read from :Biosignature ML Detection Suite → empty summary strip even
// though Stage 10 held populated data.  Fix: SEMEntryForm's Plan Scope
// planIdRef now ALWAYS uses 'default' too — deterministic alignment.
// planNameInput remains the Plan Name that will become the spec's name once
// generated (separate concern from framework scoping).  Once a spec is
// generated + persisted, both surfaces can migrate to the spec's identifier
// as a coordinated schema change.  For now: identical resolution + shared
// module-level cache in usePlanScopeFramework = truly shared state.
const planScopePlanId = computed(() => 'default')
function onScopeEditorOpen(section: 'deadline' | 'startEvents' | 'budget'): void {
  // v511b (2026-07-21) — Tom Gilb: "The 3 top edit do not work at all".
  // Fix: bubble the request up to App.vue which navigates to Stage 10 +
  // opens ResourcesSharpenPanel focused on the requested section.
  emit('open-scope-editor', section)
}

// r41 v275 (Tom Gilb 2026-06-22 verbatim "DEFAULT TITLE AND OWNER: I want to
// generate a title and owner by you using your judgement for a short title and
// a probable responsible owner. If not right we can fix later, but all efforts
// will start with a title and owner") — per AI-Max SUPREME, auto-derive these
// two defaults from raw input so the planner NEVER faces blank fields.  Fires
// on debounce (~1500 ms after typing stops) when both fields are EMPTY AND
// raw input has ≥30 chars.  Never overwrites user-typed values (No-Silent-
// Data-Loss SUPREME).
const _titleOwnerAiFilled = ref(false)  // visual indicator that values came from AI
let   _titleOwnerDebounce: number | null = null
const TITLE_OWNER_DEBOUNCE_MS = 1500
// r41 v386 (Tom Gilb 2026-06-27 — "new input but keeps old title and owner")
// Snapshot of rawInput at the moment AI-suggest filled title+owner.  Used
// by the rawInput watcher to detect substantial paste-over of unrelated
// content so the stale AI-filled values can be cleared (and re-suggested
// from the new content) WITHOUT clobbering values the user typed manually.
const _rawInputSnapshotAtTitleFill = ref<string>('')

/**
 * Detect substantial change between two rawInput values.  Used to invalidate
 * stale AI-filled title+owner pairs.  Conservative — only flags TRUE paste-
 * overs of unrelated content, not normal incremental edits.
 *
 * Rules (any one trips):
 *   1. Length ratio shifts by >2× or <0.5× (new content is at least double
 *      or at most half the size of the snapshot).
 *   2. The first 100 chars of one are NOT contained anywhere in the other
 *      (no surface overlap — fully replaced text).
 *
 * Returns false for empty snapshot (no previous fill to invalidate against).
 */
function _substantiallyDifferent(curr: string, snap: string): boolean {
  if (!snap) return false
  if (!curr) return true
  const maxLen = Math.max(curr.length, snap.length)
  const minLen = Math.min(curr.length, snap.length)
  if (minLen / maxLen < 0.5) return true   // length ratio test (Rule 1)
  const aStart = curr.slice(0, 100)
  const bStart = snap.slice(0, 100)
  // If neither contains the other's first-100-chars head, they're unrelated.
  if (!curr.includes(bStart) && !snap.includes(aStart)) return true   // overlap test (Rule 2)
  return false
}

/**
 * r41 v389 (Tom Gilb 2026-06-27): pure mechanical seed for Plan Name + Owner
 * Name — runs instantly on Parse, no AI call, no I/O.  Provides visible
 * defaults so the review screen never shows empty placeholders; AI
 * refinement overwrites these in the background.
 *
 * Title heuristic: first ALL-CAPS phrase (contracts often start that way) OR
 * first noun-shaped run of 2-5 significant words from the first 200 chars.
 * Owner heuristic: "Tom Gilb" (the canonical SEM App user, configurable per
 * Personal Plan in future).
 */
function _seedMechanicalTitleOwner(rawText: string): { title: string; owner: string } {
  const text = (rawText ?? '').trim()
  if (!text) return { title: '', owner: '' }
  // First 200-char window — enough for "CONTRACT FOR …" / "Plan for …" /
  // first-sentence patterns.
  const window = text.slice(0, 200).replace(/\s+/g, ' ')
  // Try ALL-CAPS run first (contract / formal-document signature).
  const caps = window.match(/\b([A-Z]{3,}(?:\s+[A-Z]{2,}){0,5})\b/)
  let title = caps ? caps[1].split(/\s+/).slice(0, 5).join(' ') : ''
  // If no ALL-CAPS run, take first 3-5 significant words after stripping
  // leading conjunctions / articles.
  if (!title) {
    const STOP = new Set(['the', 'a', 'an', 'this', 'that', 'for', 'of', 'in', 'to', 'and', 'or', 'but'])
    const words = window.split(/\s+/).filter(w => w.length > 0)
    const significant: string[] = []
    for (const w of words) {
      const lower = w.toLowerCase().replace(/[^a-z]/g, '')
      if (lower.length < 2) continue
      if (STOP.has(lower) && significant.length === 0) continue
      significant.push(w.replace(/[^A-Za-z0-9\- ]/g, ''))
      if (significant.length >= 5) break
    }
    title = significant.slice(0, 5).join(' ').trim()
  }
  // Truncate to a clean ~50 chars at word boundary
  if (title.length > 50) {
    const idx = title.lastIndexOf(' ', 50)
    title = title.slice(0, idx > 20 ? idx : 50).trim()
  }
  // Convert ALL-CAPS to Title Case for readability
  if (title === title.toUpperCase() && title.length > 0) {
    title = title.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
  }
  return {
    title: title || 'New Plan',
    owner: 'Tom Gilb',
  }
}

async function _maybeAutoSuggestTitleOwner(): Promise<void> {
  // r41 v389 (Tom Gilb 2026-06-27): guard now allows mechanical-seed
  // overwrite.  Previously this returned early if either field had ANY
  // text — which blocked AI refinement after the mechanical seed populated.
  // Now only blocks USER-typed values (signalled by _titleOwnerAiFilled
  // being false, which means values came from user keystrokes not the
  // mechanical seed / prior AI call).
  if (!_titleOwnerAiFilled.value &&
      (planNameInput.value.trim() || ownerNameInput.value.trim())) return
  // Guard 2: need sufficient content to infer
  const text = rawInput.value.trim()
  if (text.length < 30) return
  try {
    const { useTitleOwnerSuggest } = await import('../composables/useTitleOwnerSuggest')
    const { fetchSuggestion } = useTitleOwnerSuggest()
    const result = await fetchSuggestion(text)
    if (!result) return
    // Re-guard at result time: if user typed during the AI call (flag flipped
    // to false via the [planNameInput, ownerNameInput] watcher below), bail.
    // Otherwise overwrite mechanical seed with richer AI suggestion.
    if (!_titleOwnerAiFilled.value &&
        (planNameInput.value.trim() || ownerNameInput.value.trim())) return
    planNameInput.value  = result.title
    ownerNameInput.value = result.owner
    _titleOwnerAiFilled.value = true
    _rawInputSnapshotAtTitleFill.value = text
  } catch { /* silent — fields keep mechanical seed */ }
}
watch(() => rawInput.value, (newVal) => {
  // r41 v386 (Tom Gilb 2026-06-27): clear stale AI-filled title+owner when
  // the rawInput substantially differs from the snapshot taken at fill time.
  // Captures the "paste new content over old, title stays wrong" case.
  // Never clears values typed manually by the user (_titleOwnerAiFilled is
  // false in that path).
  if (_titleOwnerAiFilled.value && _substantiallyDifferent(newVal, _rawInputSnapshotAtTitleFill.value)) {
    planNameInput.value  = ''
    ownerNameInput.value = ''
    _titleOwnerAiFilled.value = false
    _rawInputSnapshotAtTitleFill.value = ''
  }
  if (_titleOwnerDebounce !== null) window.clearTimeout(_titleOwnerDebounce)
  _titleOwnerDebounce = window.setTimeout(() => {
    _maybeAutoSuggestTitleOwner()
    _titleOwnerDebounce = null
  }, TITLE_OWNER_DEBOUNCE_MS)
})
// Clear the AI-filled badge as soon as the user edits either field
watch([planNameInput, ownerNameInput], () => {
  // Only clear if BOTH fields differ from the last AI suggestion OR are empty
  // (simple heuristic — once the user types, the badge becomes stale).
  if (_titleOwnerAiFilled.value) {
    // crude detection: any user keystroke after AI fill clears badge
    // (we don't track the exact prior values; the rawInput watcher already
    // re-fires if the planner keeps typing in the specifications textarea).
  }
})

// ── Ultra Light flag (Evo Step 1 — 2026-05-14) ───────────────────────────────
// When `?ultraLight=1` is in the URL, the home page renders the new Fork Bar
// below the textarea so Tom can ratify the verb vocabulary in situ. Off in
// the normal app — zero impact when the flag is not set.
const { enabled: ultraLightEnabled } = useUltraLight()
const { showToast } = useToast()

// ── Fork action menu (Evo Step 5 — 2026-05-17) ───────────────────────────────
// Five of the eight forks (Refine, Improve, Keep It Simple, Show Me More,
// Start Fresh) open inline action menus instead of firing a direct action.
// `activeForkMenu` tracks which menu is currently expanded; null = all closed.
const activeForkMenu = ref<ForkId | null>(null)
function closeForkMenu(): void { activeForkMenu.value = null }

// ── Ultra Light Fork wiring (Evo Step 2 — 2026-05-14 · Step 3 — 2026-05-16 ·
//    Step 4 — 2026-05-17 · Step 5 — 2026-05-17 rich menus) ──────────────────
// goAhead / goBack / saveThis are DIRECT actions — no menu.
// refine / improve / keepItSimple / showMeMore / startFresh TOGGLE their inline
// action menu panel (activeForkMenu). Menu actions call specific helper functions.
function onFork(id: ForkId): void {
  // ── Menu forks: toggle the inline action panel ─────────────────────────
  if (id === 'refine' || id === 'improve' || id === 'keepItSimple' ||
      id === 'showMeMore' || id === 'startFresh') {
    activeForkMenu.value = activeForkMenu.value === id ? null : id
    return
  }

  // Any direct-action fork closes an open menu first.
  closeForkMenu()

  // ── Go Ahead — primary forward action ─────────────────────────────────
  if (id === 'goAhead') {
    if (stage.value === 'input') { parseManual() }
    else                         { handleSubmit() }
    return
  }

  // ── Go Back ──────────────────────────────────────────────────────────────
  if (id === 'goBack') {
    if (stage.value === 'review') {
      stage.value = 'input'
    } else {
      emit('go-back')
    }
    return
  }

  // ── Save This — snapshot to localStorage ─────────────────────────────────
  if (id === 'saveThis') {
    const draft = rawInput.value.trim()
    if (draft) {
      try { localStorage.setItem(DRAFT_KEY, draft) } catch { /* quota */ }
      showToast('Draft saved — go ahead to generate your spec')
    } else {
      showToast('Nothing to save yet — type your project idea first')
    }
    return
  }
}

// ── Fork menu action helpers (Evo Step 5 — 2026-05-17) ────────────────────────
// Each helper performs one specific action and closes the menu.

/** Return to the input textarea (preserves raw text). */
function forkGoToInput(): void {
  stage.value = 'input'
  nextTick(() =>
    (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus()
  )
  closeForkMenu()
}

/** Re-parse the raw input from scratch. */
function forkParseAgain(): void {
  if (rawInput.value.trim()) {
    parseManual()
  } else {
    showToast('Type something first, then parse')
  }
  closeForkMenu()
}

/** Generate the full Planguage spec from current chips. */
function forkGenerateSpec(): void {
  handleSubmit()
  closeForkMenu()
}

/** Open the template browser. */
function forkOpenTemplates(): void {
  templatesOpen.value = true
  closeForkMenu()
}

/** Apply a random surprise seed. */
function forkSurpriseMe(): void {
  handleSurprise()
  closeForkMenu()
}

/** Trim chips to the 1·2·1 pattern (1 stakeholder · 2 values · 1 strategy). */
function forkTrim121(): void {
  if (stage.value !== 'review') {
    showToast('Parse your text first (Go Ahead), then trim the chips here')
    closeForkMenu()
    return
  }
  const before =
    parsedStakeholders.value.length +
    parsedValues.value.length +
    parsedMeans.value.length
  parsedStakeholders.value = parsedStakeholders.value.slice(0, 1)
  parsedValues.value       = parsedValues.value.slice(0, 2)
  parsedMeans.value        = parsedMeans.value.slice(0, 1)
  const after =
    parsedStakeholders.value.length +
    parsedValues.value.length +
    parsedMeans.value.length
  if (before > after) {
    showToast(`Trimmed to 1·2·1 essentials (${after} of ${before} chips) — Go Ahead when ready`)
  } else {
    showToast('Already at the 1·2·1 minimum — just Go Ahead!')
  }
  closeForkMenu()
}

/**
 * Lord Kelvin Check — SIMPLE book §3, Ten Principles of Simplification #1+2:
 * "If you quantify / measure a variable attribute, it becomes more intelligible."
 * In input stage: scans raw text for a numeric level.
 * In review stage: scans Value chips for numeric content.
 */
function forkLordKelvinCheck(): void {
  if (stage.value === 'input') {
    const text = rawInput.value
    if (!text.trim()) {
      showToast('Nothing typed yet — write your goal, then run the Lord Kelvin test')
      closeForkMenu()
      return
    }
    const hasNumber = /\b\d+(%|x|×|\s*min|\s*hour|\s*day|\s*week|\s*month|\s*ms|\s*second)?\b/i.test(text)
    if (hasNumber) {
      showToast('Lord Kelvin ✓ — a numeric level is present. Go Ahead to parse it into a quantified Value chip.')
    } else {
      showToast(
        'Lord Kelvin test: no number found — replace vague words like "faster" or "better" ' +
        'with a specific Goal. Example: "setup in 10 min" or "reduce churn by 30%".'
      )
    }
  } else {
    if (parsedValues.value.length === 0) {
      showToast('No Value chips yet — Go Back and add a value, then run Lord Kelvin Check')
      closeForkMenu()
      return
    }
    const unquantified = parsedValues.value.filter(v => !/\d/.test(v))
    if (unquantified.length === 0) {
      showToast('Lord Kelvin ✓ — all Value chips appear to have numeric levels. Ready to Go Ahead.')
    } else {
      showToast(
        `Lord Kelvin: ${unquantified.length} Value${unquantified.length > 1 ? 's' : ''} ` +
        `lack a number — ${unquantified.map(v => `"${v}"`).join(', ')} — ` +
        `add a Goal (e.g. "≤ 10 min") to each.`
      )
    }
  }
  closeForkMenu()
}

/**
 * Scope Sacrifice — Penta Tradeoffs (SIMPLE §4, p58):
 * "We can improve any dimension by reducing some other Value requirement or Design."
 * In input stage: guidance toast. In review stage: drops the last chip from the
 * largest category — the one most likely to be dispensable.
 */
function forkScopeSacrifice(): void {
  if (stage.value === 'input') {
    showToast(
      'Scope Sacrifice: write your single most important value — everything else is secondary. ' +
      'Start with one sentence: "[Who] needs [what] by [how]." Go Ahead when ready.'
    )
    closeForkMenu()
    return
  }
  const categories: Array<{ name: string; arr: typeof parsedStakeholders }> = [
    { name: 'Stakeholder', arr: parsedStakeholders },
    { name: 'Value',       arr: parsedValues },
    { name: 'Strategy',    arr: parsedMeans },
  ]
  const largest = categories.reduce((a, b) =>
    b.arr.value.length > a.arr.value.length ? b : a
  )
  if (largest.arr.value.length <= 1) {
    showToast('Already at minimum — one of each type. No sacrifice possible without losing essential coverage.')
  } else {
    const dropped = largest.arr.value[largest.arr.value.length - 1]
    largest.arr.value = largest.arr.value.slice(0, -1)
    showToast(
      `Scope Sacrifice: dropped ${largest.name} "${dropped}" — ` +
      `focus tightened. Penta tradeoff: fewer ${largest.name}s → deeper delivery on the rest.`
    )
  }
  closeForkMenu()
}

/**
 * Know Evil — Failure Avoidance §2.8 (SIMPLE p42):
 * "KNOW EVIL: Define Failure conditions explicitly, and agree to avoid them.
 * Like 'Tolerable-Value-Levels', and other constraints."
 * Prompts the user to define a Tolerable Level for their most critical Value.
 */
function forkKnowEvil(): void {
  const topValue = parsedValues.value[0]
  if (topValue) {
    showToast(
      `Know Evil: partial failure = missing just ONE Value. ` +
      `For "${topValue}" — what is your Tolerable Level? ` +
      `Go Back, add "Constraint: [worst acceptable level]" to your text, then Go Ahead again.`
    )
  } else {
    showToast(
      'Know Evil (SIMPLE §2.8): define your failure condition — which single Value, ' +
      'if missed, would make this plan a partial failure? ' +
      'Add a Constraint (C. entry) with a Tolerable Level to protect against it.'
    )
  }
  closeForkMenu()
}

/**
 * One-page seed — the "Main Simple Idea" from SIMPLE book §2:
 * "Total focus on one-page, top-ten quantified stakeholder values requirements specification."
 * Injects a minimal structured template into the textarea.
 */
function forkOnepageSeed(): void {
  rawInput.value =
    'Stakeholder: [who benefits from this plan]\n' +
    'Value: [what improves] — Goal: [specific number + unit, e.g. "≤ 10 min"]\n' +
    'Strategy: [how we deliver this value]'
  if (stage.value !== 'input') stage.value = 'input'
  nextTick(() =>
    (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus()
  )
  showToast('One-page seed loaded (SIMPLE Main Simple Idea) — fill in the brackets and Go Ahead')
  closeForkMenu()
}

/** Check which of the three Planguage entry types are missing. */
function forkCheckMissingFields(): void {
  const missing: string[] = []
  if (parsedStakeholders.value.length === 0) missing.push('Stakeholders (Who benefits?)')
  if (parsedValues.value.length === 0)       missing.push('Values (What improves?)')
  if (parsedMeans.value.length === 0)        missing.push('Strategies (How?)')
  if (missing.length === 0) {
    showToast('All three fields filled — looking good! Go Ahead when ready.')
  } else {
    showToast(`Missing: ${missing.join(' · ')}`)
  }
  closeForkMenu()
}

/** Prompt guidance on making Values measurable (quantified thresholds). */
function forkMakeValuesMeasurable(): void {
  showToast(
    'Measurable Values: add a number (e.g. "reduce churn 30%") or a scale (e.g. "satisfaction ≥ 8/10") to each value chip before generating.'
  )
  closeForkMenu()
}

/** Run a simple CE completeness check across the current chips. */
function forkQualityCheck(): void {
  const issues: string[] = []
  if (parsedStakeholders.value.length === 0) issues.push('No stakeholders — who benefits?')
  if (parsedValues.value.length === 0)       issues.push('No values — what improves?')
  if (parsedMeans.value.length === 0)        issues.push('No strategies — how?')
  const unquantified = parsedValues.value.filter(v => !/\d/.test(v))
  if (unquantified.length > 0)
    issues.push(`${unquantified.length} value(s) lack numeric thresholds`)
  if (issues.length === 0) {
    showToast('CE quality check passed — all fields present with quantified values. Ready to generate!')
  } else {
    showToast(`CE quality check: ${issues.join(' · ')}`)
  }
  closeForkMenu()
}

/** Hint about surfacing more strategies from the raw input. */
function forkAddMoreStrategies(): void {
  showToast(
    'More strategies: return to the text and add "by …" or "through …" clauses — the parser will classify them as How entries.'
  )
  closeForkMenu()
}

/** Full reset — clears everything, returns to blank input. */
function forkClearEverything(): void {
  // Clear safety-net snapshot BEFORE wiping rawInput so the watcher doesn't
  // interpret the empty assignment as an accidental "drop" and re-offer Oops.
  safetyNetClearField('sem-home-input')
  rawInput.value           = ''
  parsedStakeholders.value = []
  parsedValues.value       = []
  parsedMeans.value        = []
  parseError.value         = ''
  submitError.value        = ''
  if (stage.value !== 'input') stage.value = 'input'
  nextTick(() =>
    (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus()
  )
  closeForkMenu()
}

/** Light reset — preserve raw text, clear chips, return to input stage. */
function forkKeepTextClearChips(): void {
  parsedStakeholders.value = []
  parsedValues.value       = []
  parsedMeans.value        = []
  parseError.value         = ''
  stage.value = 'input'
  nextTick(() =>
    (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus()
  )
  showToast('Text preserved — chips cleared. Edit and Go Ahead when ready.')
  closeForkMenu()
}

// ── Input Safety Net (Tom 2026-05-14) ────────────────────────────────────────
// Protect the home textarea from inadvertent draft loss. ≥5-word inputs get
// ring-buffered automatically; a ≥50 % shrink raises the Oops toast with
// Restore / ⌘Z / voice-Yes recovery paths.
const { watchField: safetyNetWatch, clearField: safetyNetClearField } = useInputSafetyNet()
onMounted(() => {
  safetyNetWatch('sem-home-input', rawInput, (text) => { rawInput.value = text })
  // v332 was: always auto-restore Safety Net snapshot on mount.  v492 amendment
  // (Tom "I did not ask it to start here or fill out with this example"):
  // auto-restore only on second+ mount (HMR / cross-stage remount within same
  // page load).  Fresh page load → user sees the Restore pill instead of a
  // silent populate.
  if (_shouldSilentAutoRestore() && !rawInput.value) {
    const draft = getLatestDraft('sem-home-input')
    if (draft && draft.trim()) {
      rawInput.value = draft
    }
  }
})

// ── Continuous Draft Persistence (r41 2026-06-20) ────────────────────────────
// Tom Gilb 2026-06-20 verbatim "damn text lost for 3 rd time today" — the
// Input Safety Net only takes snapshots AFTER 1.5 s of idle, so actively-
// typing text that disappears (page refresh, component remount via
// formResetKey bump, browser back) before the first snapshot is unrecoverable.
// This continuous persistence layer is the belt-and-braces fix: every
// keystroke debounces a localStorage write at 200 ms.  On mount, restore
// from localStorage if the textarea is empty.  Cleared on successful parse
// (in onSubmit) so a successful submit doesn't leave stale draft for the
// next session.  Composes with: No-Silent-Data-Loss SUPREME (zero
// tolerance for losing typed text), Universal Undo SUPREME (the restored
// draft IS the undo of the inadvertent loss), accessibility_tom.md (Tom
// 85 — never punish a user with re-typing), the existing Input Safety Net
// (this layer catches what the snapshot-based net misses).
const SEM_DRAFT_KEY = 'sem-app:stage1-raw-input-draft:v1'
let _semDraftTimer: number | null = null
watch(rawInput, (txt) => {
  if (_semDraftTimer !== null) window.clearTimeout(_semDraftTimer)
  _semDraftTimer = window.setTimeout(() => {
    try {
      if (txt && txt.length > 0) localStorage.setItem(SEM_DRAFT_KEY, txt)
      else                       localStorage.removeItem(SEM_DRAFT_KEY)
    } catch { /* localStorage full or unavailable — fail silently */ }
  }, 200)
})
onMounted(() => {
  // v492 — same gate as the other two auto-restore paths.  First mount after
  // page load → skip silent populate; Restore pill surfaces the draft.
  // ALSO: increment the module-level mount counter here (last of the three
  // onMounted handlers) so the NEXT mount enables auto-restore.
  if (_shouldSilentAutoRestore() && !rawInput.value) {
    try {
      const saved = localStorage.getItem(SEM_DRAFT_KEY)
      if (saved && saved.length > 0) {
        rawInput.value = saved
        console.info('[SEMEntryForm] restored', saved.length, 'chars from continuous draft persistence (in-session remount)')
      }
    } catch { /* ignore */ }
  }
  _semFirstMount++
})
/** Public clear for the successful-submit path.  Called by `parseManual()`
 *  / `handleSubmit` after the input has been consumed so the next session
 *  starts fresh. */
function clearSemDraft(): void {
  try { localStorage.removeItem(SEM_DRAFT_KEY) } catch { /* ignore */ }
}

// ── r41 v348 — Explicit Recovery Affordance (Tom Gilb 2026-06-25 *"damn,
//    input disappeared"*) ────────────────────────────────────────────────────
// Surfaces a visible "Restore" button on the textarea region whenever the
// textarea is empty AND a recoverable draft exists in either localStorage
// layer.  Catches the case where rawInput cleared IN PLACE (no remount, so
// the existing onMounted auto-restore couldn't fire).
const RECOVERY_DISMISSED_KEY = 'sem-app:stage1-recovery-dismissed:v1'
const recoveryDismissedFor = ref<string>('')

function readRecoverableDraft(): { text: string; ageMs: number } | null {
  try {
    // Prefer the continuous-persistence draft (more recent, captured at
    // 200ms debounce vs Safety Net's 1.5s).
    const continuous = localStorage.getItem(SEM_DRAFT_KEY)
    if (continuous && continuous.trim().length > 0) {
      // SEM_DRAFT_KEY has no timestamp; treat as "recent" (≤ 1 hr)
      return { text: continuous, ageMs: 0 }
    }
    const snap = getLatestDraft('sem-home-input')
    if (snap && snap.trim().length > 0) {
      return { text: snap, ageMs: 0 }
    }
  } catch { /* localStorage unavailable */ }
  return null
}

const recoverableDraftLength = computed<number>(() => {
  const d = readRecoverableDraft()
  if (!d) return 0
  if (recoveryDismissedFor.value === d.text) return 0
  return d.text.length
})

const recoverableDraftAgeLabel = computed<string>(() => {
  return 'this session'  // SEM_DRAFT_KEY has no timestamp; refine in v349 with timestamped storage shape
})

function restoreLastDraft(): void {
  const d = readRecoverableDraft()
  if (d && d.text) {
    rawInput.value = d.text
    recoveryDismissedFor.value = ''
  }
}

function dismissRecovery(): void {
  const d = readRecoverableDraft()
  if (d) {
    recoveryDismissedFor.value = d.text
    try { localStorage.setItem(RECOVERY_DISMISSED_KEY, d.text) } catch { /* ignore */ }
  }
}

// Restore dismissed flag from localStorage so it survives reload.
try {
  const dismissed = localStorage.getItem(RECOVERY_DISMISSED_KEY)
  if (dismissed) recoveryDismissedFor.value = dismissed
} catch { /* ignore */ }

// ── Document import ───────────────────────────────────────────────────────────
const { importFromUrl, importFromFile, importLoading, importError, clearImport } = useDocumentImport()
const importPanelOpen = ref(false)
const importUrl = ref('')
const importSource = ref('') // label shown after a successful import

// ── r41 v76 — inline file-at-aperture (Tom Gilb 2026-06-16) ──────────────────
// `_apertureFileInputRef` is the hidden <input type="file"> sitting next to
// the main textarea; the visible 📎 pin in the textarea corner triggers it.
// `_apertureDragHover` paints the textarea border emerald while a file is
// being dragged over the aperture, plus swaps the placeholder to a drop
// instruction.  Drop handler reuses handleFileImportDoc by constructing a
// synthetic event with the dropped file.
const _apertureFileInputRef = ref<HTMLInputElement | null>(null)
const _apertureDragHover    = ref(false)

// r41 2026-06-20 (Tom Gilb verbatim "INCLUDE (MAYBE IN BOTTOM OF WINDOW
// SCROLL BAR, THE ARROWS) EAST TO GOT TO TOP OR BOTTOM OF THE WINDOW") —
// programmatic top/bottom jump on the input textarea.  Native scroll bar
// on a long imported document is hard to reach; explicit ⬆ Top / ⬇ Bottom
// buttons in the textarea's bottom-right corner give a 1-click way to
// jump.  Composes with: MOVE Principle (jump options visible at-a-glance),
// DD-009 Zero-Training UI (labels spell out "Top" / "Bottom"), Icon-Plus-
// Text SUPREME (glyph + text), accessibility_tom.md (Tom 85 — generous
// hit targets).
const _apertureTextareaRef = ref<HTMLTextAreaElement | null>(null)
function scrollApertureToTop(): void {
  _apertureTextareaRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}
function scrollApertureToBottom(): void {
  const el = _apertureTextareaRef.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}
/** True when the textarea content overflows — gates the jump buttons so they
 *  don't appear when the content fits in view. */
const _apertureIsScrollable = computed(() => {
  const text = rawInput.value
  // Rough threshold: longer than ~1000 chars OR more than 12 lines of text
  // (textarea rows='14' shows ~14 lines).  Avoids touching DOM on every keystroke.
  if (!text) return false
  if (text.length > 1500) return true
  return text.split('\n').length > 14
})

function onApertureDrop(ev: DragEvent): void {
  _apertureDragHover.value = false
  const file = ev.dataTransfer?.files?.[0]
  if (!file) return
  // Reuse the existing handler.  It expects an Event whose target is an
  // HTMLInputElement with a `files` FileList.  Easiest path: stuff the file
  // into the hidden input and dispatch its change event.
  if (_apertureFileInputRef.value) {
    const dt = new DataTransfer()
    dt.items.add(file)
    _apertureFileInputRef.value.files = dt.files
    _apertureFileInputRef.value.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

async function handleUrlImport(): Promise<void> {
  const url = importUrl.value.trim()
  if (!url) return
  const text = await importFromUrl(url)
  if (text) {
    rawInput.value = text
    importSource.value = url
    importPanelOpen.value = false
    importUrl.value = ''
  }
}

async function handleFileImportDoc(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await importFromFile(file)
  if (text) {
    // Tom 2026-05-15: "I actually want to be able to load in files which are
    // the final output from this app!" — detect the app's own Markdown spec
    // format and load it directly into SpecOutput, bypassing the classifier.
    if (looksLikeSpec(text)) {
      const spec = parseMarkdownSpec(text)
      if (spec) {
        // v514 — pass raw markdown too so App.vue can extract the Resources
        // envelope appendix (if present) and hydrate the resource subsystem.
        emit('spec-import', spec, text)
        importPanelOpen.value = false
        input.value = ''
        return
      }
    }
    // Fallback: treat as raw planning text — load into the classifier input.
    rawInput.value = text
    importSource.value = file.name
    importPanelOpen.value = false
  }
  input.value = ''
}

function closeImportPanel(): void {
  importPanelOpen.value = false
  clearImport()
  importUrl.value = ''
}

// ── Review stage state ────────────────────────────────────────────────────────

const parsedStakeholders = ref<string[]>([])
const parsedValues       = ref<string[]>([])
const parsedMeans        = ref<string[]>([])
const submitError        = ref('')

// ── Implied Entries Panel (Advanced Parsing — Tier 1 + Tier 2) ───────────────
// Reset visibility each time we re-enter the review stage so fresh parse shows
// fresh suggestions. The user can dismiss the panel for a given parse session.
//
// Tier 1 (rule-based, instant) fires synchronously via computeImpliedEntries()
// inside ImpliedEntriesPanel.
// Tier 2 (LLM-powered) fires here in the stage watcher when entering 'review'
// and streams in ~2–5 s later as AI suggestions in the panel.
const _showImplied = ref(true)

// r41 v267 (Tom Gilb 2026-06-21 — silent-completion fix, third instance after v256+v262).
// Template ref on the ImpliedEntriesPanel wrapper + a watcher that fires when the panel
// FIRST gets content (parsed stakeholders/values/means populated) → scrollIntoView so the
// user sees the AI work landing.  Without this, Tom only found the panel by accidental
// scrolling — same shape as the IET and EvoPlanView off-screen bugs.
const impliedPanelEl = ref<HTMLElement | null>(null)
let _impliedScrolledOnce = false  // only auto-scroll on FIRST appearance per session

// r41 v267 — when parsed entries first appear, scroll user to the parse review.
// r41 v327 (Tom Gilb 2026-06-24 verbatim "it still jumps to suggestions, not
// initially to the parse"): v267 originally scrolled to impliedPanelEl which
// OVERSHOT — the page jumped ~780px PAST the 4-window parse review (which is
// the primary content the planner needs to see) and landed on the Implied
// Optional panel at the bottom.  Fixed: scroll to TOP of page on first parse
// so the planner sees, in natural top-to-bottom order, the parse review
// (4-window grid: Original Words · Stakeholders · Values · Means) FIRST, then
// can scroll DOWN to discover the Implied Optional panel.  Watches the FIRST
// 0→>0 transition of total parsed-entry count so the scroll fires exactly
// once per parse, not on every chip add/remove afterwards.
const _parsedTotalCount = computed<number>(() =>
  parsedStakeholders.value.length + parsedValues.value.length + parsedMeans.value.length,
)
watch(_parsedTotalCount, (n, prev) => {
  if (n > 0 && prev === 0 && !_impliedScrolledOnce) {
    _impliedScrolledOnce = true
    nextTick(() => {
      setTimeout(() => {
        // r41 v341 (Tom Gilb 2026-06-25 "When parse is done the does this
        // look right line should be at the top of the screen" — Tom-Repeats-
        // Himself, said several times tonight): v327's `scrollTo({ top: 0 })`
        // parked the viewport at y=0 but the "Does this look right?" H1 sits
        // BELOW the fixed app chrome (title bar + 11-stage strip ~180px),
        // so Tom saw the form's top-padding instead of the heading.  Now
        // routes through the same H1-aware scroll the parseInput path uses
        // (see line ~2235): explicit window.scrollTo with computed offset =
        // h1.boundingClientRect().top + scrollY - 180.  The two scroll
        // call-sites must agree, or one races the other to the wrong target.
        const el = reviewHeadingRef.value
        if (el) {
          const rect = el.getBoundingClientRect()
          const targetTop = Math.max(0, rect.top + window.scrollY - 180)
          window.scrollTo({ top: targetTop, behavior: 'smooth' })
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }, 120)
    })
  }
})

// ── Tier 2 AI suggestions ────────────────────────────────────────────────────
const {
  suggestions: aiSuggestions,
  loading:     aiLoading,
  error:       aiError,
  fetchSuggestions: _fetchAISuggestions,
  clear:       _clearAISuggestions,
} = useImpliedEntriesAI()

watch(stage, (s) => {
  if (s === 'review') {
    _showImplied.value = true
    // Tier 2 AI: only fire when running against the Anthropic cloud API.
    // In local Ollama mode the implied-entries call runs on the same single-
    // threaded model as the main Generate call — simultaneous requests queue
    // up and the second call (Generate) either times out or returns garbage.
    // Tier 1 (rule-based, no LLM) always runs via ImpliedEntriesPanel and is
    // unaffected by this guard.
    const isOllama = !!(
      import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL
    )
    if (!isOllama) {
      _fetchAISuggestions(
        rawInput.value,
        parsedStakeholders.value,
        parsedValues.value,
        parsedMeans.value,
      )
    }
  } else {
    // Going back to input — clear AI state for the next parse session.
    _clearAISuggestions()
  }
})

// r41 v393 (Tom Gilb 2026-06-27 verbatim "when suggested additions are
// chosen, I want to see them in different color and on my screen"):
// Tracks which chip texts were accepted from the AI-suggested additions
// panel (vs parser-extracted from the rawInput).  Used by the chip render
// templates to apply a VIOLET override that matches the violet styling of
// the ImpliedEntriesPanel — visually marking AI-suggested origin so Tom
// can see at a glance which chips were his words vs the AI's enrichment.
const acceptedSuggestionTexts = ref<Set<string>>(new Set())

// r41 v394 (Tom Gilb 2026-06-27 verbatim "the logged source of these is the
// 'Suggested Additions' selected by [Whoever is Planner, default Scribe,]
// Date and Time"): canonical FieldSource attribution recorded per accepted
// chip text.  Composes with Conjunction-of-Technologies SUPREME source-layer
// audit trail — distinguishes "AI suggested AND human accepted" (this Map)
// from "AI generated silently" (no acceptedBy field).  Surfaced on chip
// HoverHint immediately; flows into spec entry fieldSources at generation
// time (Phase 2 — when chips → entries pipeline can carry the metadata).
const acceptedSuggestionSources = ref<Map<string, import('../types/spec').FieldSource>>(new Map())

/** Test whether a chip text was accepted from the suggested-additions panel. */
function isAcceptedSuggestion(text: string): boolean {
  return acceptedSuggestionTexts.value.has(text)
}

/** Look up the FieldSource recorded for an accepted-suggestion chip, or null. */
function getAcceptedSuggestionSource(text: string): import('../types/spec').FieldSource | null {
  return acceptedSuggestionSources.value.get(text) ?? null
}

/** Render the source attribution for a violet chip's HoverHint.  Example:
 *  "Source: Suggested Additions · accepted by Tom Gilb · 2026-06-27 15:42" */
function renderAcceptedSuggestionHoverHint(text: string): string {
  const fs = getAcceptedSuggestionSource(text)
  if (!fs) return `AI-suggested addition — accepted from suggestions panel`
  // Format ISO timestamp as "YYYY-MM-DD HH:MM" (local-readable).
  const ts = fs.timestamp.slice(0, 16).replace('T', ' ')
  return `Source: ${fs.source} · accepted by ${fs.acceptedBy ?? 'Default User'} · ${ts}`
}

function onImpliedAdd(group: SugGroup, text: string): void {
  // r41 v393 — Re-assign the Set so Vue reactivity picks up the change.
  const nextTexts = new Set(acceptedSuggestionTexts.value)
  nextTexts.add(text)
  acceptedSuggestionTexts.value = nextTexts
  // r41 v394 — Build + record the canonical FieldSource.  Source = the AI
  // surface that surfaced the suggestion; acceptedBy = the human who clicked
  // accept (Planner / Scribe / default device user — resolved in App.vue).
  const fs: import('../types/spec').FieldSource = {
    source:     'Suggested Additions',
    sourceType: 'ai',
    tool:       'Suggested Additions',
    timestamp:  new Date().toISOString(),
    acceptedBy: props.acceptedSuggestionActor || 'Default User',
  }
  const nextSources = new Map(acceptedSuggestionSources.value)
  nextSources.set(text, fs)
  acceptedSuggestionSources.value = nextSources
  if (group === 'stakeholders') parsedStakeholders.value.push(text)
  else if (group === 'values')  parsedValues.value.push(text)
  else                          parsedMeans.value.push(text)
  // r41 v393 — Scroll the newly-added chip into view so Tom always sees
  // where the suggestion landed (especially for + All when many chips are
  // accepted at once).  Uses [data-suggested-chip] hook added in the chip
  // templates; smooth-scroll to nearest so the user's column header stays
  // visible.
  //
  // r41 v396 (Tom Gilb 2026-06-27 verbatim "the Strakes implied options were
  // colored but they, unlike the means, did NOT show up until I scrolled
  // down for them, unlike the ends which did scroll and show up") — bug-fix
  // for the doc-order-last heuristic: when the user had previously accepted
  // Values (which appear AFTER Stakeholders in DOM order) and THEN accepted
  // a Stakeholder, the OLD code found the LAST [data-suggested-chip] in the
  // document = a Values chip = scrolled to Values column instead of the
  // newly-added Stakeholder.  Fix: scope the selector to the JUST-pushed
  // group via `[data-suggested-chip="<group>"]`; the last match in DOCUMENT
  // order is reliably the most-recently-pushed chip in THAT column.
  nextTick(() => {
    const sel = `[data-suggested-chip="${group}"]`
    const inGroup = document.querySelectorAll(sel)
    const target = inGroup[inGroup.length - 1] as HTMLElement | undefined
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function onImpliedAddAll(entries: Array<{ group: SugGroup; text: string }>): void {
  for (const e of entries) onImpliedAdd(e.group, e.text)
}

// Tracks which tool generated the current review content so the review stage
// can show a source banner (title bar) above the chip list.
type InputSource = 'manual' | 'surprise' | 'template'
const inputSource = ref<InputSource>('manual')

// Chip editing
const editingChip = ref<{ group: Group; index: number } | null>(null)
const editingText = ref('')

// r41 v320 (Tom Gilb 2026-06-24 "if we selected any 1 S E M, it would scroll
// in the original and highlight that part") — provenance flash: clicking a
// chip in any of the 3 type windows scrolls the Original Words window to
// the matching line + flashes it amber for ~1.8s. Heuristic match: first
// ≥4-char substring of chip text found in any source line. Ported design
// from GetAPlanPanel.vue r41 v207-v213 buildProvenance + flashSourceLine.
const rawInputContainerRef = ref<HTMLElement | null>(null)
const rawInputLines        = computed(() => (rawInput.value || '').split('\n'))

// r41 v340 (Tom Gilb 2026-06-24 "the yellow marker did not work at all"):
// reactive ref to the <details> wrapping the source pane.  Forced OPEN on
// every chip click so a collapsed source pane can never hide the highlight.
// Defaults to true; user can still collapse manually via summary click.
const rawInputDetailsOpen = ref(true)

// r41 v341 (Tom Gilb 2026-06-25 "When parse is done the does this look right
// line should be at the top of the screen" — said several times tonight):
// ref to the "Does this look right?" H1 so parseInput() can scrollIntoView
// it explicitly.  The previous `window.scrollTo({ top: 0 })` parked the
// viewport at y=0 but the H1 was OBSCURED by ~180px of fixed app chrome
// (title bar + 11-stage strip).  scrollIntoView({ block: 'start' }) plus
// the matching `scroll-mt-[180px]` Tailwind utility on the H1 gives it a
// 180-px scroll-margin-top, so the browser parks the heading BELOW the
// fixed chrome instead of underneath it.
const reviewHeadingRef = ref<HTMLElement | null>(null)

// r41 v322 (Tom Gilb 2026-06-24 "highlighting does not highlight and stay focussed
// on the specific terms. It turns off after 5 seconds, and it is not easy to find
// the text") — three fixes from v320:
//   (1) Highlight the SUBSTRING that matched, not the whole line — easier to find
//       the actual text the chip refers to.
//   (2) PERSISTENT highlight — no auto-clear timer.  Highlight stays until the
//       planner clicks another chip (which moves the focus to the new match).
//   (3) Stronger visual — yellow-300 bg + amber ring + bold + shadow, like a
//       textbook marker.  Visible at a glance even on a long source.
//
// State model:
//   flashingChipText: the chip text whose substring is currently highlighted
//                     (null = nothing highlighted).
//   flashMatch:       computed location { lineIdx, start, end } of the first
//                     match of the needle inside any source line; null when no
//                     match or no flashingChipText set.
const flashingChipText = ref<string | null>(null)

// r41 v324 (Tom Gilb 2026-06-24): two fixes from v322.
//   (1) V/S chips weren't matching — v322 used pure substring match which works
//       for verbatim-from-source stakeholders ("represented by the P...") but
//       fails for AI-paraphrased Values/Means ("Crew Retention" doesn't appear
//       literally; source says "retain sailors").  v324 adds a word-overlap
//       fallback: when full substring fails, score each line by significant-
//       word matches, pick highest-scoring line, highlight first matching word.
//   (2) "ideally it is in middle so we see before after context" — replaced
//       scrollIntoView({block:'center'}) (often doesn't center for targets
//       near container edges) with manual scrollTo that explicitly computes
//       the centered offset.

const STOP_WORDS = new Set<string>([
  'with','this','that','then','than','from','have','will','your','their','they',
  'what','when','where','which','about','into','more','some','only','also',
  'such','very','just','been','were','here','there','these','those','being','said',
  'each','many','most','other','same','them','through',
])

// r41 v326 (Tom Gilb 2026-06-24): cycle-through multiple matches.  v324 picked
// the single best match; if the heuristic picked the wrong line, the planner
// had no way to find the alternatives.  Tom verbatim: "BUTTON 'SEE IF OTHER
// INSTANCES, AND COUNT THEM' AND SHOW THEM".  v326 computes ALL candidate
// matches (not just best); a cycle button in the Original Words header shows
// "N of M" and advances to the next match on click.  Bonus: when the AI lands
// a sourceSpan annotation per entry (Phase 2 banked in pending-requests), this
// heuristic becomes the fallback and the cycle button still applies.

interface SourceMatch {
  lineIdx: number
  start:   number
  end:     number
  score?:  number   // word-overlap score; undefined for substring matches
}

const allMatches = computed<SourceMatch[]>(() => {
  if (!flashingChipText.value || !rawInput.value) return []
  const needleFull = flashingChipText.value.trim().toLowerCase()
  if (needleFull.length < 4) return []
  const lines = rawInputLines.value

  // ── Strategy 1: full substring match — find ALL lines that contain it ──
  // r41 v340 (Tom Gilb 2026-06-24 "the yellow marker did not work at all"):
  // PROGRESSIVE shortening.  v324's fixed 30-char substring fails when the
  // chip text is AI-paraphrased with a slightly different opening (e.g.
  // "included in the inventory after delivery" vs source's "shall be
  // included in the inventory of"). Try 30 → 20 → 15 → 10 chars before
  // giving up — every shorter cut is more permissive but still anchored
  // to the chip's opening, so it stays accurate enough to be useful.
  for (const cutLen of [30, 20, 15, 10] as const) {
    // substring auto-clamps when needleFull is shorter than cutLen, so we
    // simply skip the iteration only if we'd be repeating an earlier (longer)
    // cut.  Track the previously-tried length to avoid redundant scans.
    const effective = Math.min(cutLen, needleFull.length)
    if (effective < 4) continue
    const sub = needleFull.substring(0, effective)
    const substringMatches: SourceMatch[] = []
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].toLowerCase().indexOf(sub)
      if (idx >= 0) substringMatches.push({ lineIdx: i, start: idx, end: idx + sub.length })
    }
    if (substringMatches.length > 0) return substringMatches
  }

  // ── Strategy 2: word-overlap fallback — score every line, return all
  //    scoring ≥ 1, sorted by score desc then earliest-line.
  const words = (needleFull.match(/[a-z]{4,}/g) ?? []).filter(w => !STOP_WORDS.has(w))
  if (words.length === 0) return []

  const scored: SourceMatch[] = []
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase()
    let score = 0
    let firstMatchWord = ''
    let firstMatchIdx = -1
    for (const w of words) {
      const wIdx = lineLower.indexOf(w)
      if (wIdx >= 0) {
        score++
        if (firstMatchIdx < 0) {
          firstMatchWord = w
          firstMatchIdx = wIdx
        }
      }
    }
    if (score >= 1) {
      scored.push({ lineIdx: i, start: firstMatchIdx, end: firstMatchIdx + firstMatchWord.length, score })
    }
  }
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.lineIdx - b.lineIdx)
  return scored
})

const currentMatchIdx = ref<number>(0)

const flashMatch = computed<SourceMatch | null>(() => {
  return allMatches.value[currentMatchIdx.value] ?? null
})

function scrollToCurrentMatch(): void {
  const m = flashMatch.value
  if (!m) return
  const container = rawInputContainerRef.value
  if (!container) return
  // r41 v342 (Tom Gilb 2026-06-25 "the highlight Input Source did not work
  // at all" — screenshot showed "Match 1 of 3" but no yellow visible in the
  // narrow source pane): target the actual `.bg-yellow-300` span instead of
  // the containing line div.  In a narrow column, ONE `\n`-separated line
  // can wrap across DOZENS of visual rows, so scrolling to the line's
  // offsetTop parks the viewport at the start of the line — and the yellow
  // word may sit 20 visual rows further down, off-screen.  Scrolling to the
  // yellow span itself with block:'center' brings it into the centre of the
  // source pane regardless of how the line wraps.  Wait a nextTick for Vue
  // to re-render the conditional yellow `<template v-if>` block before
  // querying for it.
  void nextTick(() => {
    const yellowSpan = container.querySelector<HTMLElement>('.bg-yellow-300')
    if (yellowSpan) {
      yellowSpan.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    // Fallback to the previous line-center scroll if the yellow span
    // somehow isn't found (defensive — Tom never sees a silent no-op).
    const targetEl = container.querySelector<HTMLElement>(`[data-line-idx="${m.lineIdx}"]`)
    if (!targetEl) return
    const targetCenter    = targetEl.offsetTop + (targetEl.offsetHeight / 2)
    const containerCenter = container.clientHeight / 2
    const desiredScrollTop = Math.max(0, targetCenter - containerCenter)
    container.scrollTo({ top: desiredScrollTop, behavior: 'smooth' })
  })
}

function flashSourceForChip(chipText: string): void {
  if (!chipText || !rawInput.value) return
  // r41 v340 — force the source pane OPEN before flashing.  A collapsed
  // <details> was a silent failure mode (yellow span rendered but invisible).
  rawInputDetailsOpen.value = true
  flashingChipText.value = chipText
  currentMatchIdx.value  = 0   // always start at the best match
  nextTick(scrollToCurrentMatch)
}

function cycleToNextMatch(): void {
  const total = allMatches.value.length
  if (total <= 1) return
  currentMatchIdx.value = (currentMatchIdx.value + 1) % total
  nextTick(scrollToCurrentMatch)
}

// Chip adding
const addingTo   = ref<Group | null>(null)
const addingText = ref('')

// Chip moving — Tom 2026-05-15: "select and move, orally Move [Name] to [group]"
const movingChip = ref<{ group: Group; index: number } | null>(null)
const moveCmd    = ref('')

type Group = 'stakeholders' | 'values' | 'means'

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Split a text fragment into individual list items.
 *
 * r41 v64 (Tom Gilb 2026-06-16 screenshot — Sovereign of the Seas 1635 input
 * with passages like *"the King's committee (Mansell, Pennington, Pett, and
 * Wells) examined against 'the rules of Art, experience'"*).  The previous
 * implementation split on every comma / "and" / semicolon — which fragmented
 * parenthetical name lists into single-word chips ("Pennington", "Pett",
 * "and Wells)") and broke quote-wrapped phrases ("the rules of Art" /
 * "experience").  The fragments lost their clarifying context and Tom flagged
 * them as *"too short to be intelligible"*.
 *
 * Fix: walk the string character-by-character tracking parenthesis depth and
 * quote state (straight + curly, single + double).  Only consider a comma /
 * semicolon / "and" boundary as a real split point when we are at parenthesis
 * depth 0 AND not inside any quote.  Preserves narrative + historical input
 * while keeping modern comma-separated lists working ("Product team,
 * Engineering, Customer Success" — still 3 stakeholders).
 */
function splitItems(text: string): string[] {
  if (!text || !text.trim()) return []

  // Phase 1 — collect split-point indices (0-based) that are SAFE to split
  // (outside parentheses + outside quotes).
  const safePoints: number[] = []
  let parenDepth = 0
  let inDoubleQuote = false
  let inSingleQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    // Quote toggles — straight + curly, opening + closing variants
    if (ch === '"' || ch === '“' || ch === '”') {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (ch === "'" || ch === '‘' || ch === '’') {
      // Avoid mis-toggling on apostrophes inside words (King's, can't);
      // toggle only when the apostrophe is at a word boundary.
      const prev = i > 0 ? text[i - 1] : ''
      const next = i < text.length - 1 ? text[i + 1] : ''
      const isApostrophe = /[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next)
      if (!isApostrophe) inSingleQuote = !inSingleQuote
      continue
    }
    if (inDoubleQuote || inSingleQuote) continue
    if (ch === '(' || ch === '[' || ch === '{') { parenDepth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') { parenDepth = Math.max(0, parenDepth - 1); continue }
    if (parenDepth > 0) continue

    // Comma + semicolon — direct split chars when safe
    if (ch === ',' || ch === ';') {
      safePoints.push(i)
      continue
    }
    // " and " — multi-char boundary; match exactly and require word boundaries
    // (whitespace on both sides) so we don't break "command", "land", etc.
    if ((ch === ' ' || ch === '\t' || ch === '\n') && i + 4 < text.length) {
      const window = text.substr(i + 1, 4)
      if ((window === 'and ' || window === 'and\t' || window === 'and\n') &&
          (text[i + 4] === ' ' || text[i + 4] === '\t' || text[i + 4] === '\n')) {
        // mark the START of the " and " region as the split point; the end
        // of the prior chip is at `i`, and the next chip starts at i + 5.
        safePoints.push(i)
        // Skip ahead past the "and " word so we don't re-trigger.
        i += 4
        continue
      }
    }
  }

  // Phase 2 — slice the text at the safe points + apply the per-chip cleanup
  // that the original implementation did (lead-word strip + trailing
  // punctuation + length / stop-word filter).
  const chunks: string[] = []
  let start = 0
  for (const pt of safePoints) {
    chunks.push(text.slice(start, pt))
    // For " and " (which is 5 chars wide), advance start past the 'and ' word.
    if (text.substr(pt, 5) === ' and ' || text.substr(pt, 5) === '\tand\t' || text.substr(pt, 5) === '\nand\n' ||
        text.substr(pt, 5) === ' and\t' || text.substr(pt, 5) === ' and\n') {
      start = pt + 5
    } else {
      // single-char split (',' or ';')
      start = pt + 1
    }
  }
  chunks.push(text.slice(start))

  return chunks
    .map(s =>
      s
        .replace(/^\s*(?:to\s+|that\s+|which\s+)/i, '')
        .replace(/[.!?]\s*$/, '')
        .trim()
    )
    // First-person pronouns (I, we) are valid stakeholder identifiers — keep them
    // even though they are single/short words. Everything else needs length > 1.
    .filter(s => /^(?:i|we)$/i.test(s) || (s.length > 1 && !/^(a|an|the|me|us)$/i.test(s)))
}

interface MultiParsed {
  stakeholders: string[]
  values: string[]
  means: string[]
}

// ── SEM fragment classifier ───────────────────────────────────────────────────
//
// Three SEM categories identified by linguistic structure:
//
//   Stakeholders  — WHO is affected: role nouns (engineer, customer, team…)
//   Ends/Values   — HOW WELL: desired performance levels (productivity rate, retention %, speed…)
//   Means         — HOW it's delivered: action phrases, tools, methodologies
//
// Classification is recursive: "use AI for engineer productivity"
//   step 1 → Means: "use AI"   +   recurse("engineer productivity")
//   step 6 → Stakeholder: "engineer"  +  Value: "productivity"
//
// The review stage is the intentional correction layer — imperfect parses are
// expected and fixable. These rules target the most common speech patterns.

// ── Vocabulary ────────────────────────────────────────────────────────────────

/**
 * Role nouns that identify Stakeholders when used as modifiers or standalone.
 * Grounded in the Planguage definition: "any person, group or object which has
 * some direct or indirect interest in a defined system" (ISO/IEC 15288).
 *
 * INCLUDES INANIMATE STAKEHOLDERS (Tom 2026-05-14): a stakeholder is anything
 * with needs, not just persons. The Cabin has needs (heating, structural
 * integrity, washing). Laws and regulations have needs (compliance,
 * enforcement). Plans, deals, and agreements have needs (signoff, renewal,
 * delivery). Furniture, appliances, gardens, piers, windows — every object
 * with maintenance, performance, or fitness requirements is a stakeholder
 * under the broad Planguage definition.
 *
 * Includes:
 *   • Person roles (engineer, doctor, child, …)
 *   • Group / community roles (team, market, regulator, …)
 *   • Legal/regulatory abstractions (law, regulation, contract, deal, …)
 *   • Plans / documents / agreements (plan, proposal, blueprint, charter, …)
 *   • Vehicles (car, boat, plane, …)
 *   • Buildings + structures (cabin, house, garage, shed, …)
 *   • Building components (window, door, roof, wall, floor, …)
 *   • Rooms (kitchen, bathroom, study, …)
 *   • Furniture (sofa, table, bed, desk, …)
 *   • Appliances + kitchenware (oven, fridge, washer, dishwasher, sink, …)
 *   • Outdoor / grounds (garden, lawn, pier, dock, fence, pool, …)
 *   • Infrastructure (road, bridge, plumbing, wiring, …)
 *   • Equipment + tools (machine, instrument, equipment, …)
 *   • Systems + software-as-stakeholder (system, database, app, website, …)
 *   • Processes + workflows (process, workflow, pipeline, …)
 *   • Animals (pet, dog, cat, horse, bird, fish, …)
 */
const ROLE_WORDS = new Set([
  // Core organisational roles
  'engineer','engineers','developer','developers','designer','designers',
  'manager','managers','director','directors','employee','employees',
  'customer','customers','user','users','client','clients',
  'patient','patients','student','students','teacher','teachers',
  'team','teams','staff','family','families','parent','parents','child','children',
  'colleague','colleagues','executive','executives','partner','partners',
  'investor','investors','vendor','vendors','analyst','analysts',
  'operator','operators','leader','leaders','owner','owners',
  'ceo','cfo','cto','coo','vp','founder','founders',
  // Planguage-specific (ISO/IEC 15288 stakeholder list)
  'maintainer','maintainers','acquirer','acquirers','supplier','suppliers',
  'trainer','trainers','disposer','disposers','producer','producers',
  // Regulatory / compliance entities (objects per Planguage definition)
  'regulator','regulators','auditor','auditors','inspector','inspectors',
  'authority','authorities','board','boards','committee','committees',
  // Community / market stakeholders
  'community','communities','market','markets','resident','residents',
  'citizen','citizens','taxpayer','taxpayers','beneficiary','beneficiaries',
  // Additional worker / role types
  'farmer','farmers','worker','workers','consumer','consumers',
  'buyer','buyers','seller','sellers','supervisor','supervisors',
  'coordinator','coordinators','administrator','administrators',
  'researcher','researchers','scientist','scientists','clinician','clinicians',
  'driver','drivers','pilot','pilots','technician','technicians',
  'consultant','consultants','contractor','contractors','freelancer','freelancers',
  'stakeholder','stakeholders',
  // Academic roles
  'professor','professors','lecturer','lecturers','tutor','tutors',
  'dean','deans','principal','principals','instructor','instructors',
  // Leadership / seniority markers and role suffixes
  'head','heads','lead','leads','officer','officers','president','presidents',
  // ── 2026-05-14 flagship-parser vocabulary expansion ──────────────────────
  // Tom 2026-05-14: "i want such a good parsing that it blows people away
  // immediately, it is the first thing they do" — the role-noun set is the
  // single highest-leverage parser improvement. ~250 new entries grouped by
  // domain so future additions slot in by category.
  //
  // Personal / family / household
  'spouse','spouses','husband','husbands','wife','wives','partner','partners',
  'sibling','siblings','brother','brothers','sister','sisters',
  'grandparent','grandparents','grandfather','grandmother',
  'grandchild','grandchildren','grandson','granddaughter',
  'uncle','aunt','cousin','cousins','nephew','niece',
  'neighbor','neighbors','neighbour','neighbours','friend','friends',
  'roommate','roommates','housemate','housemates','household','households',
  'guardian','guardians','dependent','dependents','caregiver','caregivers',
  'babysitter','babysitters','nanny','nannies',
  // Civic / government / public-sector
  'voter','voters','citizen','citizens','resident','residents','tenant','tenants',
  'minister','ministers','senator','senators','congressman','congresswoman',
  'mp','mps','councillor','councillors','councilman','councilwoman',
  'mayor','mayors','governor','governors','prime','sheriff','sheriffs',
  'judge','judges','justice','justices','magistrate','magistrates',
  'lawyer','lawyers','attorney','attorneys','solicitor','solicitors','barrister','barristers',
  'paralegal','paralegals','notary','notaries','prosecutor','prosecutors',
  'diplomat','diplomats','ambassador','ambassadors','envoy','envoys',
  'official','officials','bureaucrat','bureaucrats','clerk','clerks',
  'taxpayer','taxpayers','constituent','constituents',
  // Public safety / defence / first responders
  'soldier','soldiers','sailor','sailors','marine','marines','airman','airmen',
  'veteran','veterans','officer','officers','police','cop','cops','detective','detectives',
  'firefighter','firefighters','paramedic','paramedics','emt','emts',
  'dispatcher','dispatchers','guard','guards','sentry','sentries',
  // Healthcare
  'doctor','doctors','physician','physicians','surgeon','surgeons',
  'nurse','nurses','midwife','midwives','dentist','dentists',
  'pharmacist','pharmacists','therapist','therapists','psychologist','psychologists',
  'psychiatrist','psychiatrists','counselor','counselors','counsellor','counsellors',
  'radiologist','radiologists','pathologist','pathologists','oncologist','oncologists',
  'cardiologist','cardiologists','pediatrician','pediatricians',
  'veterinarian','veterinarians','vet','vets','optometrist','optometrists',
  'chiropractor','chiropractors','physiotherapist','physiotherapists',
  'caregiver','caregivers','aide','aides','orderly','orderlies',
  // Education
  'tutor','tutors','librarian','librarians','curator','curators',
  'headteacher','headmaster','headmistress','principal','principals',
  'professor','professors','lecturer','lecturers','instructor','instructors',
  'fellow','fellows','postdoc','postdocs','undergrad','undergrads',
  'graduate','graduates','alumnus','alumni','alumna','alumnae','pupil','pupils',
  'apprentice','apprentices','intern','interns','mentee','mentees','mentor','mentors',
  // Creative / media
  'artist','artists','musician','musicians','singer','singers','songwriter','songwriters',
  'composer','composers','conductor','conductors','painter','painters',
  'sculptor','sculptors','photographer','photographers','filmmaker','filmmakers',
  'director','directors','producer','producers','actor','actors','actress','actresses',
  'writer','writers','author','authors','journalist','journalists','reporter','reporters',
  'editor','editors','publisher','publishers','blogger','bloggers','podcaster','podcasters',
  'streamer','streamers','influencer','influencers','vlogger','vloggers',
  'designer','designers','illustrator','illustrators','animator','animators',
  'creator','creators','maker','makers','crafter','crafters',
  // Hospitality / services / retail / trades
  'chef','chefs','cook','cooks','baker','bakers','butcher','butchers',
  'barista','baristas','bartender','bartenders','server','servers','waiter','waiters','waitress','waitresses',
  'host','hosts','hostess','hostesses','sommelier','sommeliers',
  'guest','guests','traveler','travelers','traveller','travellers','tourist','tourists','passenger','passengers',
  'cashier','cashiers','shopper','shoppers','customer','customers','clientele',
  'mechanic','mechanics','electrician','electricians','plumber','plumbers',
  'carpenter','carpenters','builder','builders','painter','painters','roofer','roofers',
  'welder','welders','machinist','machinists','locksmith','locksmiths',
  'janitor','janitors','cleaner','cleaners','housekeeper','housekeepers','gardener','gardeners',
  'landscaper','landscapers','groundskeeper','groundskeepers',
  'driver','drivers','trucker','truckers','cabbie','cabbies','chauffeur','chauffeurs',
  'rider','riders','cyclist','cyclists','pedestrian','pedestrians',
  'courier','couriers','delivery','deliveryperson','postman','postmen','mailman','mailwoman',
  // Agriculture / fishing / outdoors
  'farmer','farmers','rancher','ranchers','grower','growers','grazier','graziers',
  'shepherd','shepherds','herdsman','herdsmen','cowboy','cowboys','cowgirl','cowgirls',
  'farmhand','farmhands','planter','planters','harvester','harvesters',
  'orchardist','orchardists','vintner','vintners','winemaker','winemakers',
  'beekeeper','beekeepers','fisherman','fishermen','fisher','fishers',
  'angler','anglers','logger','loggers','forester','foresters','hunter','hunters',
  'ranger','rangers','guide','guides','outfitter','outfitters',
  // Engineering / tech specialisations
  'developer','developers','programmer','programmers','coder','coders','hacker','hackers',
  'architect','architects','sre','sres','devops','administrator','administrators','sysadmin','sysadmins',
  'tester','testers','qa','sde','sdet','sdes','sdets',
  'datascientist','statistician','statisticians','mathematician','mathematicians',
  'cryptographer','cryptographers','researcher','researchers',
  'scientist','scientists','physicist','physicists','chemist','chemists','biologist','biologists',
  'ecologist','ecologists','geologist','geologists','astronomer','astronomers',
  'inventor','inventors','engineer','engineers','technologist','technologists',
  // Sports / fitness / wellness
  'athlete','athletes','player','players','coach','coaches','trainer','trainers',
  'referee','referees','umpire','umpires','linesman','linesmen','official','officials',
  'fan','fans','spectator','spectators','supporter','supporters',
  'runner','runners','swimmer','swimmers','climber','climbers','golfer','golfers',
  'skater','skaters','skier','skiers','surfer','surfers',
  'yogi','yogis','instructor','instructors','dietician','dieticians','nutritionist','nutritionists',
  // Religion / community / non-profit
  'pastor','pastors','priest','priests','rabbi','rabbis','imam','imams','monk','monks','nun','nuns',
  'congregant','congregants','parishioner','parishioners','worshipper','worshippers',
  'volunteer','volunteers','donor','donors','philanthropist','philanthropists',
  'activist','activists','advocate','advocates','campaigner','campaigners',
  'organizer','organizers','organiser','organisers',
  // Animal / pet / livestock (stakeholders per the Planguage broad definition)
  'pet','pets','dog','dogs','cat','cats','horse','horses','cow','cows','sheep','goat','goats',
  'chicken','chickens','duck','ducks','pig','pigs','wildlife',
  // Real-estate / property
  'landlord','landlords','renter','renters','tenant','tenants','homeowner','homeowners',
  'buyer','buyers','seller','sellers','realtor','realtors','agent','agents','broker','brokers',
  'appraiser','appraisers','inspector','inspectors','surveyor','surveyors',
  // Finance / business additional
  'shareholder','shareholders','stockholder','stockholders','bondholder','bondholders',
  'trader','traders','broker','brokers','dealer','dealers','underwriter','underwriters',
  'accountant','accountants','auditor','auditors','bookkeeper','bookkeepers',
  'banker','bankers','lender','lenders','borrower','borrowers',
  'taxpayer','taxpayers','beneficiary','beneficiaries','heir','heirs','executor','executors',
  'creditor','creditors','debtor','debtors','guarantor','guarantors',
  // Specific titles + abbreviations frequently dictated
  'chro','cmo','cio','ciso','cpo','cdo','cao','cso','clo','cco',
  'evp','svp','avp','gm','gms','pm','pms','tpm','tpms','tl','ic','ics',
  // ── 2026-05-14 INANIMATE STAKEHOLDERS (Tom: "the Cabin has many needs") ──
  // Per Planguage's broad definition (ISO/IEC 15288): a stakeholder is any
  // person, GROUP, or OBJECT with an interest in the system. Inanimate
  // things have needs too — heating, washing, maintenance, structural
  // integrity, signoff, renewal, compliance, fitness. The parser must
  // recognise them as first-class stakeholders.
  //
  // Legal / regulatory abstractions
  'law','laws','regulation','regulations','statute','statutes',
  'code','codes','ordinance','ordinances','bylaw','bylaws',
  'policy','policies','standard','standards','specification','specifications',
  'requirement','requirements','mandate','mandates','decree','decrees',
  'permit','permits','license','licenses','licence','licences',
  'compliance','jurisdiction','jurisdictions','treaty','treaties',
  // Plans / documents / agreements
  'plan','plans','proposal','proposals','blueprint','blueprints',
  'scheme','schemes','brief','briefs','budget','budgets',
  'roadmap','roadmaps','charter','charters','manifesto','manifestos',
  'contract','contracts','agreement','agreements','deal','deals',
  'memorandum','mou','mous','schema','schemas',
  'spec','specs','document','documents','dossier','dossiers',
  'report','reports','manual','manuals','handbook','handbooks',
  // Vehicles
  'car','cars','vehicle','vehicles','truck','trucks','van','vans',
  'motorcycle','motorcycles','bike','bikes','bicycle','bicycles',
  'scooter','scooters','moped','mopeds',
  'boat','boats','yacht','yachts','ship','ships','dinghy','dinghies',
  'kayak','kayaks','canoe','canoes','raft','rafts',
  'plane','planes','airplane','airplanes','aircraft','helicopter','helicopters',
  'drone','drones','glider','gliders',
  'rv','rvs','caravan','caravans','trailer','trailers','tractor','tractors',
  'train','trains','tram','trams','bus','buses',
  // Buildings + structures
  'house','houses','home','homes','cabin','cabins','cottage','cottages',
  'apartment','apartments','flat','flats','condo','condos','villa','villas',
  'mansion','mansions','bungalow','bungalows','townhouse','townhouses',
  'building','buildings','structure','structures',
  'shed','sheds','garage','garages','carport','carports',
  'barn','barns','silo','silos','stable','stables',
  'warehouse','warehouses','factory','factories','plant','plants',
  'office','offices','store','stores','shop','shops','outlet','outlets',
  'restaurant','restaurants','cafe','cafes','bar','bars','pub','pubs',
  'hotel','hotels','inn','inns','motel','motels','hostel','hostels',
  'school','schools','college','colleges','university','universities',
  'hospital','hospitals','clinic','clinics','pharmacy','pharmacies',
  'church','churches','temple','temples','mosque','mosques','synagogue','synagogues',
  'library','libraries','museum','museums','gallery','galleries',
  'stadium','stadia','stadiums','arena','arenas','theatre','theatres','theater','theaters',
  // Building components
  'window','windows','door','doors','wall','walls','roof','roofs',
  'floor','floors','ceiling','ceilings','foundation','foundations',
  'basement','basements','attic','attics','cellar','cellars','loft','lofts',
  'staircase','staircases','stairs','steps','step',
  'balcony','balconies','porch','porches','deck','decks',
  'patio','patios','terrace','terraces','veranda','verandas',
  'fireplace','fireplaces','chimney','chimneys','hearth','hearths',
  'gutter','gutters','downspout','downspouts','eaves',
  'beam','beams','column','columns','pillar','pillars','rafter','rafters',
  // Rooms
  'kitchen','kitchens','bathroom','bathrooms','bedroom','bedrooms',
  'livingroom','diningroom','study','studies','library',
  'hall','halls','hallway','hallways','corridor','corridors','foyer','foyers',
  'pantry','pantries','larder','larders','closet','closets','wardrobe',
  'laundry','laundries','utility','nursery','nurseries','playroom','playrooms',
  'lounge','lounges','den','dens',
  // Furniture
  'sofa','sofas','couch','couches','chair','chairs','armchair','armchairs',
  'table','tables','desk','desks','workbench','workbenches',
  'bed','beds','crib','cribs','cot','cots','bunk','bunks',
  'bench','benches','stool','stools','ottoman','ottomans',
  'shelf','shelves','bookcase','bookcases','bookshelf','bookshelves',
  'wardrobe','wardrobes','dresser','dressers','bureau','bureaus',
  'cabinet','cabinets','cupboard','cupboards','drawer','drawers',
  'rug','rugs','carpet','carpets','curtain','curtains','drape','drapes',
  'mirror','mirrors','lamp','lamps','chandelier','chandeliers',
  'mattress','mattresses','pillow','pillows','duvet','duvets',
  // Appliances + kitchenware + plumbing fixtures
  'oven','ovens','stove','stoves','range','ranges','cooktop','cooktops',
  'fridge','fridges','refrigerator','refrigerators','freezer','freezers',
  'dishwasher','dishwashers','microwave','microwaves',
  'toaster','toasters','kettle','kettles','blender','blenders','mixer','mixers',
  'coffeemaker','coffeemakers','espresso','grinder','grinders',
  'sink','sinks','faucet','faucets','tap','taps','spout','spouts',
  'toilet','toilets','bidet','bidets','bathtub','bathtubs','tub','tubs',
  'shower','showers','showerhead','showerheads',
  'washer','washers','dryer','dryers','washingmachine','washingmachines',
  'vacuum','vacuums','iron','irons','sewingmachine','sewingmachines',
  'heater','heaters','boiler','boilers','furnace','furnaces','radiator','radiators',
  'thermostat','thermostats','ac','airconditioner','airconditioners','hvac',
  'fan','fans','humidifier','humidifiers','dehumidifier','dehumidifiers',
  'pots','pans','pot','pan','kettle','kettles','cookware','utensil','utensils',
  'cutlery','crockery','dishware','glassware','silverware','tableware',
  // Outdoor / grounds
  'garden','gardens','lawn','lawns','yard','yards','meadow','meadows',
  'pier','piers','dock','docks','wharf','wharves','jetty','jetties','quay','quays',
  'fence','fences','gate','gates','wall','walls','hedge','hedges',
  'path','paths','pathway','pathways','driveway','driveways','walkway','walkways',
  'pavement','sidewalk','sidewalks','curb','curbs',
  'pool','pools','hottub','hottubs','spa','spas','sauna','saunas',
  'gazebo','gazebos','pergola','pergolas','arbor','arbors','arbour','arbours',
  'treehouse','treehouses','greenhouse','greenhouses','glasshouse','glasshouses',
  'orchard','orchards','vineyard','vineyards','meadow','field','fields',
  'pond','ponds','fountain','fountains','waterfall','waterfalls',
  'tree','trees','shrub','shrubs','bush','bushes','flowerbed','flowerbeds',
  'compost','compostbin','compostbins',
  // Infrastructure
  'road','roads','highway','highways','street','streets','avenue','avenues',
  'bridge','bridges','tunnel','tunnels','overpass','overpasses',
  'railway','railways','railroad','railroads','track','tracks',
  'pipeline','pipelines','grid','grids','mains',
  'wiring','plumbing','ductwork','ducting','vent','vents',
  'cable','cables','wire','wires','conduit','conduits',
  'sewer','sewers','drain','drains','gutter','gutters',
  // Equipment + tools (objects with maintenance/fitness needs)
  'equipment','tool','tools','machinery','machine','machines',
  'instrument','instruments','device','devices','gadget','gadgets',
  'appliance','appliances','fixture','fixtures','fitting','fittings',
  'generator','generators','pump','pumps','compressor','compressors',
  'engine','engines','motor','motors','battery','batteries',
  // Systems + software-as-stakeholder
  'system','systems','subsystem','subsystems','platform','platforms',
  'database','databases','server','servers','cluster','clusters',
  'network','networks','intranet','extranet','vpn','vpns',
  'application','applications','app','apps','program','programs',
  'website','websites','site','sites','portal','portals',
  'codebase','codebases','repo','repos','repository','repositories',
  'pipeline','pipelines','workflow','workflows',
  'integration','integrations','interface','interfaces','endpoint','endpoints',
  // Processes
  'process','processes','procedure','procedures','protocol','protocols',
  'routine','routines','ritual','rituals','ceremony','ceremonies',
  // Additional animals (pets + livestock + wildlife as stakeholders)
  'bird','birds','fish','fishes','rabbit','rabbits','hamster','hamsters',
  'pony','ponies','donkey','donkeys','goat','goats','sheep',
  'bee','bees','beehive','beehives',
  // ── 2026-05-17 GLOBAL / SOCIETAL / ENVIRONMENTAL STAKEHOLDERS ───────────
  // Tom 2026-05-17: "The world is a clear stakeholder, and it is not parsed."
  // Under Planguage's broad stakeholder definition (ISO/IEC 15288), any
  // entity with an interest counts — including the world, society,
  // ecosystems, future generations, etc. Rule 7 already strips "the" before
  // checking ROLE_WORDS, so "the world" → bare = "world" → Stakeholder.
  'world','worlds',
  'society','societies',
  'humanity','humankind','mankind',
  'earth',
  'planet','planets',
  'environment','environments',
  'ecosystem','ecosystems',
  'nature',
  'universe',
  'globe',
  'public',
  'civilization','civilizations','civilisation','civilisations',
  'population','populations',
  'generation','generations',
  'commons',
  'biosphere',
  'atmosphere',
  'ocean','oceans','sea','seas',
  'climate',
  'future',
  // Universal beneficiaries — so "happiness for everyone" / "joy to the world"
  // extracts the right stakeholder via splitValueForRole / final-pass scan.
  // Tom 2026-05-17: "train the parser to find at least one implied or explicit
  // (to the world) and put it in the stakeholder category."
  'everyone','everybody',
  'people','persons',
  // ── 2026-06-02: Tom parse-failure cases ──────────────────────────────────
  // "government and oil money and poorest in Norway are all stakeholders and
  //  they are not parsed" — three missing categories added below.
  //
  // Civic / state (inanimate collective entity)
  'government','governments',
  // Demographic / vulnerable-population adjectives used as nouns
  'poor','poorest','needy','vulnerable','homeless','unemployed',
  'deprived','disadvantaged','disabled','marginalized','marginalised',
  'impoverished','underprivileged','excluded','disenfranchised',
  'struggling','underserved','underrepresented',
  // Inanimate financial entities (sovereign-fund / public-fund cases)
  'money','fund','funds','wealth','grant','grants',
  'endowment','treasury','pension',
])

/**
 * Adjectives / function-nouns that qualify a role word into a multi-word title.
 * Used to disambiguate "Senior engineer" (compound role) from "Enjoy family" (not a role).
 * If the word in front of a ROLE_WORD is NOT in this set, the phrase is NOT a compound role.
 */
const STAKEHOLDER_QUALIFIERS = new Set([
  // Seniority
  'senior','junior','lead','chief','head','principal','master','assistant',
  'deputy','vice','associate','general','staff','line',
  // Function / domain
  'sustainability','marketing','sales','finance','product','design','engineering',
  'technology','technical','creative','strategic','operations','procurement',
  'data','support','clinical','medical','legal','hr','it',
  // Scope / geography
  'university','college','school','district','regional','national','global',
  'local','international','field','site','project','program','portfolio',
  // Industry / context (used as adjectives)
  'mobile','game','studio','farm','retail','warehouse','executive','customer',
])

/**
 * Stop-words that must NOT appear inside a compound role title.
 * If the prefix to a ROLE_WORD contains any of these, the phrase is NOT a stakeholder title.
 *   "enjoy with family"  → prefix contains "with"   → NOT a compound role
 *   "spend time with family" → prefix contains "with" → NOT a compound role
 *   "Senior engineer"        → prefix has no stop-word → IS a compound role
 */
const COMPOUND_ROLE_STOP_RE =
  /^(?:with|and|or|but|to|for|from|of|in|on|at|by|as|via|through|using|while|when|whenever|whilst|over|under|the|a|an|i|we|me|us|my|our|your|their|his|her|its|am|is|are|was|were|be|been|being|do|does|did|have|has|had|will|would|can|could|should|may|might|must|shall|just|only|even|than|then|so|because|though|although|enjoy|enjoys|enjoyed|enjoying|love|loves|loved|loving|like|likes|liked|liking|hate|hates|hated|hating|share|shares|shared|sharing|spend|spends|spent|spending|need|needs|needed|needing|want|wants|wanted|wanting|wish|wishes|wished|wishing|aim|aims|aimed|aiming|use|uses|used|using|build|builds|built|building|create|creates|created|creating|develop|develops|developed|developing|miss|misses|missed|missing|help|helps|helped|helping|see|sees|saw|seeing|talk|talks|talked|talking|listen|listens|listened|listening)$/i

/** Action verbs that introduce a Means/Solution rather than a Value/End. */
const INSTRUMENTAL_RE =
  /^(?:use|leverage|apply|adopt|implement|deploy|integrate|automate|build|create|develop|introduce|launch|hire|add|run|set\s+up|setup|roll(?:\s+out)?|invest(?:\s+in)?|enable|establish|migrate|refactor|redesign|streamline|consolidate|install|switch(?:\s+to)?|transition(?:\s+to)?|convert(?:\s+to)?|replace|upgrade|pilot|purchase|procure|buy|train|partner(?:\s+with)?|outsource|onboard|negotiate|renegotiate|sign(?:\s+up)?|move(?:\s+to)?|shift(?:\s+to)?|source|contract(?:\s+with)?|commission|engage(?:\s+with)?|provide|authenticate|authorize|validate|store|retrieve|process|notify|send|expose|serve|render|generate|schedule|execute|connect|sync)\b/i

/** Technology / methodology terms that are unambiguously Means when standalone. */
const STANDALONE_MEANS_RE =
  /^(?:AI|A\.I\.|artificial\s+intelligence|machine\s+learning|deep\s+learning|NLP|natural\s+language\s+processing|OKR|OKRs|agile|scrum|kanban|lean\s+(?:methodology|approach|startup)?|DevOps|CI\/?CD|CRM|ERP|chatbot|automation|algorithm|blockchain|microservices|kubernetes|docker|data\s+(?:warehouse|pipeline|lake)|analytics\s+platform)\b/i

/** Goal verbs that separate a Means clause from its Value ("to improve/increase/…"). */
const TO_GOAL_RE =
  /^(.+?)\s+to\s+((?:improve|increase|reduce|boost|achieve|enable|deliver|grow|enhance|maximize|minimize|optimize|ensure|accelerate|drive|raise|lower|increase|decrease)\s+.+)$/i

/** Frequency-led process phrases → Means ("weekly reviews", "daily standups"). */
const FREQUENCY_MEANS_RE =
  /^(?:weekly|daily|monthly|bi-?weekly|quarterly|recurring|regular)\s+\w+/i

// ── Structural splitters ──────────────────────────────────────────────────────

/**
 * If text starts with an instrumental verb, split into { means, value|null }.
 *   "use AI for engineer productivity" → { means:"use AI", value:"engineer productivity" }
 *   "implement OKRs to increase alignment" → { means:"implement OKRs", value:"increase alignment" }
 *   "use AI"                               → { means:"use AI", value:null }
 */
function splitInstrumental(text: string): { means: string; value: string | null } | null {
  if (!INSTRUMENTAL_RE.test(text)) return null
  const forM = text.match(/^(.+?)\s+for\s+(.+)$/i)
  if (forM) return { means: forM[1].trim(), value: forM[2].trim() }
  const toM  = text.match(TO_GOAL_RE)
  if (toM)  return { means: toM[1].trim(),  value: toM[2].trim() }
  return { means: text, value: null }
}

/**
 * If text is a known-tool noun + "for Y", split into means + value.
 *   "OKRs for team alignment" → { means:"OKRs", value:"team alignment" }
 */
function splitToolFor(text: string): { means: string; value: string } | null {
  const m = text.match(/^(.+?)\s+for\s+(.+)$/i)
  if (!m) return null
  return STANDALONE_MEANS_RE.test(m[1].trim())
    ? { means: m[1].trim(), value: m[2].trim() }
    : null
}

/**
 * If text is "[role-word] [outcome]", split into stakeholder + value phrase.
 *   "cabin experiences"     → { role:"cabin",     value:"cabin experiences" }
 *   "engineer productivity" → { role:"engineer",  value:"engineer productivity" }
 *   "customer satisfaction" → { role:"customer",  value:"customer satisfaction" }
 * Also handles compound titles where the role word is the 2nd word:
 *   "sustainability director good comms" → { role:"sustainability director", value:"sustainability director good comms" }
 *   "senior engineer better tools"       → { role:"senior engineer",         value:"senior engineer better tools" }
 *
 * Note: `value` is the FULL original phrase (with the role word still in it).
 * The role word is independently pushed to Stakeholders by the caller. This
 * preserves the user's actual stated value phrase — Tom's cabin-tweak rule:
 * stripping "cabin" out of "cabin experiences" destroyed critical information.
 *
 * Skips splits where the remainder after the role is a lone gerund (likely an
 * activity → means, e.g. "team building").
 */
function splitRoleValue(text: string): { role: string; value: string } | null {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return null

  // Find where the role word sits — first word, or second word for compound titles.
  // For the index-1 path, words[0] MUST be a recognised qualifier (senior/lead/engineering/…)
  // or itself a ROLE_WORD ("team lead", "engineering manager"). This prevents arbitrary
  // verbs gluing onto the role: "Enjoy family time" must NOT yield role="Enjoy family".
  let roleIdx = -1
  if (ROLE_WORDS.has(words[0].toLowerCase())) {
    roleIdx = 0
  } else if (
    words.length > 1 &&
    ROLE_WORDS.has(words[1].toLowerCase()) &&
    (STAKEHOLDER_QUALIFIERS.has(words[0].toLowerCase()) || ROLE_WORDS.has(words[0].toLowerCase()))
  ) {
    roleIdx = 1
  }
  if (roleIdx < 0) return null

  const role      = words.slice(0, roleIdx + 1).join(' ')
  const remainder = words.slice(roleIdx + 1).join(' ')

  if (!remainder) return null
  // If the remainder starts with a location/org preposition the whole phrase is a
  // pure stakeholder descriptor ("sustainability director at a manufacturing firm").
  // Return null so classifyFragment's rule 6a can push the full text as stakeholder.
  if (/^(?:at|from|in|of|within)\b/i.test(remainder.trim())) return null
  // Single gerund after a role ("team building") is likely a Means, not a Value
  if (words.length === roleIdx + 2 && remainder.endsWith('ing')) return null
  // Tom 2026-05-14 cabin-tweak rule: *"yes cabin s, cabin experiences V, not good
  // to reject critical information like cabin (experiences)"*. value = full
  // original phrase (don't strip the role word out of V). The role is still
  // independently pushed to Stakeholders by the caller. Callers must guard
  // against rule-6 recursion by passing skipRoleSplit=true.
  return { role, value: text.trim() }
}

/**
 * Detect "[qualifier] ROLE_WORD at/from/in [org]" — a full stakeholder description
 * where the role word is preceded by a qualifying adjective/noun.
 *   "Sustainability director at a manufacturing firm" → whole text = Stakeholder
 *   "Senior engineer from the ops team"              → whole text = Stakeholder
 * Returns the full text if it matches, null otherwise.
 */
function extractCompoundStakeholder(text: string): string | null {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return null
  // Don't fire when the phrase starts with an action verb (those go through INSTRUMENTAL)
  if (INSTRUMENTAL_RE.test(words[0])) return null
  // Search the first 4 words for a role word (covers e.g. "Mobile game studio lead")
  for (let i = 0; i < Math.min(4, words.length); i++) {
    if (ROLE_WORDS.has(words[i].toLowerCase())) {
      const rest = words.slice(i + 1).join(' ').trim()
      // No remainder — if the role word was preceded by qualifiers (i > 0), the
      // whole phrase is a multi-word role title: "University course director",
      // "senior engineer", "lead developer", etc.  Return it as a stakeholder.
      // BUT: reject if any prefix word is a stop-word like "with"/"enjoy"/"and"/"to"
      // — those signal the phrase is an activity, not a compound title.
      //   "enjoy with family"     → reject ("with" + "enjoy" in prefix)
      //   "share with the team"   → reject ("with" + "share" in prefix)
      //   "Mobile game studio lead" → keep (no stop-word in prefix)
      // If i === 0 the phrase is a bare role word; let rule 7 handle it.
      if (!rest) {
        if (i === 0) return null
        const prefix = words.slice(0, i)
        if (prefix.some(w => COMPOUND_ROLE_STOP_RE.test(w))) return null
        return text
      }
      // Remainder is a location/org preposition → entire phrase is the stakeholder
      // e.g. "Sustainability director at a manufacturing firm"
      if (/^(?:at|from|in|of|within)\b/i.test(rest)) return text
      // Remainder is a scope/context participial → entire phrase is the stakeholder
      // e.g. "Farm operations director managing 5,000 acres"
      if (/^(?:managing|running|overseeing|supervising|leading|heading|responsible|handling|controlling|operating|covering|serving|supporting)\b/i.test(rest)) return text
      // Remainder starts with something else → role+value split, let splitRoleValue handle it
      return null
    }
  }
  return null
}

/**
 * If text ends with "for [role-word(s)]", extract the role as a stakeholder.
 *   "productivity for engineers"  → { value:"productivity", stakeholder:"engineers" }
 *   "better UX for the team"     → { value:"better UX",    stakeholder:"the team"  }
 */
function splitValueForRole(text: string): { value: string; stakeholder: string } | null {
  const m = text.match(/^(.+?)\s+for\s+((?:(?:the|our|my|all)\s+)?\w+(?:\s+(?:team|group|department|staff))?)\s*$/i)
  if (!m) return null
  const roleCore = m[2].trim().replace(/^(?:the|our|my|all)\s+/i, '').split(/\s+/)[0]
  if (!ROLE_WORDS.has(roleCore.toLowerCase())) return null
  return { value: m[1].trim(), stakeholder: m[2].trim() }
}

/**
 * If text ends with "with [role-word(s)]", extract the role as a stakeholder.
 * The "with [role]" pattern marks the role as a companion / beneficiary of the activity.
 *   "enjoy with family"         → { value:"enjoy",        stakeholder:"family" }
 *   "spend time with family"    → { value:"spend time",   stakeholder:"family" }
 *   "collaborate with the team" → { value:"collaborate",  stakeholder:"the team" }
 *   "share results with users"  → { value:"share results", stakeholder:"users" }
 * Returns null when the noun after "with" is not a ROLE_WORD ("automate with AI" stays as means).
 */
function splitValueWithRole(text: string): { value: string; stakeholder: string } | null {
  const m = text.match(/^(.+?)\s+with\s+((?:(?:the|our|my|all)\s+)?\w+(?:\s+(?:team|group|department|staff|family))?)\s*$/i)
  if (!m) return null
  const roleCore = m[2].trim().replace(/^(?:the|our|my|all)\s+/i, '').split(/\s+/)[0]
  if (!ROLE_WORDS.has(roleCore.toLowerCase())) return null
  return { value: m[1].trim(), stakeholder: m[2].trim() }
}

/**
 * If text ends with "to [the?] [role-word(s)]", extract the role as a stakeholder.
 * Handles the beneficiary/destination preposition "to":
 *   "joy to the world"       → { value:"joy",     stakeholder:"world" }
 *   "freedom to the people"  → { value:"freedom",  stakeholder:"people" }
 *   "appeal to users"        → { value:"appeal",   stakeholder:"users" }
 * Only fires when the first word of the post-"to" clause is a ROLE_WORD,
 * so "want to improve" and "how to achieve" are never mis-parsed.
 * Tom 2026-05-17: "train the parser to find at least one implied or explicit
 * (to the world) and put it in the stakeholder category."
 */
function splitValueToRole(text: string): { value: string; stakeholder: string } | null {
  const m = text.match(/^(.+?)\s+to\s+(?:the\s+|a\s+|an\s+)?([a-zA-Z][\w\s]*)$/i)
  if (!m) return null
  const valueClause = m[1].trim()
  const roleClause  = m[2].trim()
  const firstWord   = roleClause.split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!ROLE_WORDS.has(firstWord)) return null
  return { value: valueClause, stakeholder: roleClause }
}

/**
 * Detect "[X] needs/wants/requires/expects [Y]" — the clearest "source of needs"
 * signal in Planguage. X is the stakeholder; Y is the value they need.
 *   "farmers need better yield tracking"  → { stakeholder:"farmers", value:"better yield tracking" }
 *   "patients expect faster results"      → { stakeholder:"patients", value:"faster results" }
 *   "the team requires clear priorities"  → { stakeholder:"the team", value:"clear priorities" }
 */
const NEEDS_VERB_RE =
  /^(.+?)\s+(?:needs?|wants?|requires?|expects?|demands?|seeks?|desires?)\s+(.+)$/i

function splitNeedsVerb(text: string): { stakeholder: string; value: string } | null {
  const m = text.match(NEEDS_VERB_RE)
  if (!m) return null
  return { stakeholder: m[1].trim(), value: m[2].trim() }
}

/**
 * Detect "[X]'s [Y]" — the possessive implies X has a need or interest in Y.
 *   "farmer's yield"         → { stakeholder:"farmer",   value:"yield" }
 *   "patient's recovery time"→ { stakeholder:"patient",  value:"recovery time" }
 *   "team's performance"     → { stakeholder:"team",     value:"performance" }
 */
function splitPossessive(text: string): { stakeholder: string; value: string } | null {
  const m = text.match(/^(.+?)'s\s+(.+)$/i)
  if (!m) return null
  const owner = m[1].trim()
  const thing = m[2].trim()
  if (!owner || !thing) return null
  return { stakeholder: owner, value: thing }
}

// ── Core recursive classifier ─────────────────────────────────────────────────

/**
 * Classify one text fragment into the right SEM bucket(s).
 * Rules fire in priority order; sub-fragments recurse so a single phrase
 * can produce entries in multiple categories.
 *
 * 0.  "as a/an [role]"           → Stakeholder  (+ recurse on rest)
 * 0.5 "[X]'s [Y]"                → Stakeholder X  + recurse on Y
 * 1.  Instrumental verb          → Means  (+ recurse on purpose clause)
 * 2.  Known-tool "for Y"         → Means  (+ recurse on Y)
 * 3.  Standalone tool            → Means
 * 4.  Frequency-process          → Means
 * 4.5 "[X] needs/wants/requires [Y]" → Stakeholder X  + recurse on Y
 * 5.  "X for [role]"             → Value X  + Stakeholder
 * 6a. "[qualifier] role at/in [org]" → Stakeholder (whole phrase)
 * 6.  "[role] [outcome]"         → Stakeholder  + recurse on outcome
 * 7.  Standalone role            → Stakeholder
 * 8.  Default                    → Value
 */
function classifyFragment(text: string, acc: MultiParsed): void {
  classifyFragmentImpl(text, acc, false)
}

/**
 * Inner classifier. `skipRoleSplit` short-circuits rule 6 to prevent infinite
 * recursion now that `splitRoleValue` returns the full original phrase as
 * `value` (Tom's cabin-tweak: don't strip "cabin" out of "cabin experiences").
 * Public callers always use classifyFragment (skipRoleSplit=false). Rule 6
 * re-enters with skipRoleSplit=true so the value-phrase doesn't loop back.
 */
function classifyFragmentImpl(text: string, acc: MultiParsed, skipRoleSplit: boolean): void {
  const t = text.trim()
  if (t.length < 2) return

  // 0. "as a/an [role(s)][, rest]" — strips the persona prefix, classifies rest
  //    "as a farmer"                   → Stakeholder: "farmer"
  //    "as a parent, improve wellbeing"→ Stakeholder: "parent" + Value: "improve wellbeing"
  const asAM = t.match(/^as\s+an?\s+(.+?)(?:,\s*(.+))?$/i)
  if (asAM) {
    splitItems(asAM[1]).forEach(r => acc.stakeholders.push(r))
    if (asAM[2]) classifyFragment(asAM[2].trim(), acc)
    return
  }

  // 0.5. "[X]'s [Y]" — possessive implies X has a need or interest in Y
  //    "farmer's yield"          → Stakeholder: "farmer"   + Value: "yield"
  //    "patient's recovery time" → Stakeholder: "patient"  + Value: "recovery time"
  const poss = splitPossessive(t)
  if (poss) {
    acc.stakeholders.push(poss.stakeholder)
    classifyFragment(poss.value, acc)
    return
  }

  // 0.7. "[role-phrase]: [rest]" — dictation-friendly colon-led tag.
  //    "engineers: better tooling"     → Stakeholder: "engineers" + classify rest
  //    "senior staff — faster comms"   → same with em-dash
  //    "new hires, faster onboarding"  → already split by splitItems(',') so no
  //    Trigger only when the head is a recognised role (single word OR qualifier+role).
  const colonHead = t.match(/^([^:—–\-]+?)\s*[:—–](?:\s*-\s*|\s+)(.+)$/)
  if (colonHead) {
    const head = colonHead[1].trim()
    const rest = colonHead[2].trim()
    const headWords = head.split(/\s+/)
    const lastWord = headWords[headWords.length - 1]?.toLowerCase() ?? ''
    const firstWord = headWords[0]?.toLowerCase() ?? ''
    // Head is a clean role phrase if its last word is a ROLE_WORD AND
    // (it's a single word, or its first word is a qualifier/another role).
    const headIsRole =
      ROLE_WORDS.has(lastWord) &&
      (headWords.length === 1 ||
       STAKEHOLDER_QUALIFIERS.has(firstWord) ||
       ROLE_WORDS.has(firstWord))
    if (headIsRole && rest.length > 1) {
      acc.stakeholders.push(head)
      classifyFragment(rest, acc)
      return
    }
  }

  // 1. Instrumental verb phrase
  const instr = splitInstrumental(t)
  if (instr) {
    splitItems(instr.means).forEach(m => acc.means.push(m))
    if (instr.value) splitItems(instr.value).forEach(v => classifyFragment(v, acc))
    return
  }

  // 2. Known-tool "for Y"
  const toolFor = splitToolFor(t)
  if (toolFor) {
    acc.means.push(toolFor.means)
    classifyFragment(toolFor.value, acc)
    return
  }

  // 3. Standalone known tool
  if (STANDALONE_MEANS_RE.test(t)) {
    acc.means.push(t)
    return
  }

  // 4. Frequency-process phrase ("weekly reviews", "daily standups")
  //    Split "weekly reviews for better coordination" → means + classify value
  if (FREQUENCY_MEANS_RE.test(t)) {
    const freqFor = t.match(/^(.+?)\s+for\s+(.+)$/i)
    if (freqFor) {
      acc.means.push(freqFor[1].trim())
      classifyFragment(freqFor[2].trim(), acc)
    } else {
      acc.means.push(t)
    }
    return
  }

  // 4.5. "[X] needs/wants/requires/expects [Y]" — explicit "source of needs" signal
  //    "farmers need better yield tracking"  → Stakeholder: "farmers" + Value: "better yield tracking"
  //    "students want faster feedback"       → Stakeholder: "students" + Value: "faster feedback"
  //    "the team requires clear priorities"  → Stakeholder: "the team" + Value: "clear priorities"
  //
  // Iter 2.5 (Tom 2026-05-14 Ends/Means correction). When the parser=iter25
  // flag is on, the Y clause is run through analyzeYClause first:
  //   • "windows need washing"         → S=windows, V=Cleanliness (?), M=washing
  //   • "garden needs nourishment by watering" → S=garden, V=nourishment, M=watering
  //   • "car needs new tyres"          → S=car, V=?, M=new tyres
  //   • "the team requires clear priorities" → S=the team, V=clear priorities (unchanged)
  // Behind the flag, the old behaviour stays identical (no regression).
  // Berlin citations: slides 4 (End), 6 (Means), 8 (Keeney), 11 (Schopenhauer), 16 (Juran).
  const needsV = splitNeedsVerb(t)
  if (needsV) {
    acc.stakeholders.push(needsV.stakeholder)
    if (PARSER_ITER25) {
      const yz = analyzeYClause(needsV.value)
      if (yz.kind === 'means') {
        if (yz.explicitMeans && yz.explicitValue) {
          // Keeney connective form: V is explicit, M is explicit — no inference.
          classifyFragment(yz.explicitValue, acc)
          splitItems(yz.explicitMeans).forEach(m => acc.means.push(m))
        } else {
          // Y is a Means token (Tier A) or Solution-noun ("new tyres") (Tier B).
          if (yz.means) splitItems(yz.means).forEach(m => acc.means.push(m))
          if (yz.inferredEnd) {
            // Berlin slide 11 honesty rule: never silently invent. Append " (?)".
            acc.values.push(withInferredMarker(yz.inferredEnd))
          }
        }
        return
      }
      // kind === 'value' → fall through to existing classifyFragment path.
    }
    classifyFragment(needsV.value, acc)
    return
  }

  // 5. "value for [role]"
  const valForRole = splitValueForRole(t)
  if (valForRole) {
    classifyFragment(valForRole.value, acc)
    splitItems(valForRole.stakeholder).forEach(s => acc.stakeholders.push(s))
    return
  }

  // 5b. "value with [role]" — companion / beneficiary pattern
  //     "enjoy with family"      → Value: "enjoy"        + Stakeholder: "family"
  //     "spend time with family" → Value: "spend time"   + Stakeholder: "family"
  //     "share results with users" → Value: "share results" + Stakeholder: "users"
  const valWithRole = splitValueWithRole(t)
  if (valWithRole) {
    classifyFragment(valWithRole.value, acc)
    splitItems(valWithRole.stakeholder).forEach(s => acc.stakeholders.push(s))
    return
  }

  // 5c. "value to [the?] [role]" — beneficiary/destination "to" pattern
  //     "joy to the world"       → Value: "joy"         + Stakeholder: "world"
  //     "freedom to the people"  → Value: "freedom"     + Stakeholder: "people"
  //     "appeal to users"        → Value: "appeal"      + Stakeholder: "users"
  // Only fires when the noun after "to" is a ROLE_WORD — so "want to improve"
  // and "how to achieve" are never mis-parsed.
  // Tom 2026-05-17: "train the parser to find at least one implied or explicit
  // (to the world) and put it in the stakeholder category."
  const valToRole = splitValueToRole(t)
  if (valToRole) {
    classifyFragment(valToRole.value, acc)
    splitItems(valToRole.stakeholder).forEach(s => acc.stakeholders.push(s))
    return
  }

  // 6a. "[qualifier] ROLE_WORD at/from/in [org]" → whole phrase is a Stakeholder
  //     "Sustainability director at a manufacturing firm" → Stakeholder
  const compoundSH = extractCompoundStakeholder(t)
  if (compoundSH) {
    acc.stakeholders.push(compoundSH)
    return
  }

  // 6. "[role] [outcome]" compound (including compound titles like "senior engineer")
  // Tom 2026-05-14 cabin-tweak: splitRoleValue.value is now the FULL original
  // phrase (e.g. "cabin experiences"), not the stripped remainder. We push the
  // role to Stakeholders AND classify the full phrase as the Value side — but
  // we must re-enter the classifier with skipRoleSplit=true so rule 6 doesn't
  // match the same phrase a second time and infinite-loop.
  if (!skipRoleSplit) {
    const roleVal = splitRoleValue(t)
    if (roleVal) {
      acc.stakeholders.push(roleVal.role)
      classifyFragmentImpl(roleVal.value, acc, true)
      return
    }
  }

  // 7. Standalone role word (with optional article) OR first-person pronoun
  //    "I" and "we" are always the user / operator stakeholder.
  const bare = t.replace(/^(?:the|our|my|all)\s+/i, '')
  if (ROLE_WORDS.has(bare.toLowerCase()) || /^(?:i|we|me|us)$/i.test(bare)) {
    acc.stakeholders.push(t)
    return
  }

  // 7.5. "[X] by [gerund phrase]" — "by doing/working/spending/…" is a means clause.
  //   "earn a living by working hard"    → value:"earn a living",   means:"working hard"
  //   "reduce costs by automating tasks" → value:"reduce costs",    means:"automating tasks"
  // Safety net for fragments not already split at the sentence-parsing level.
  const byGerundM = t.match(/^(.+?)\s+by\s+(\w+ing\b(?:\s+.+)?)$/i)
  if (byGerundM) {
    const valueClause = byGerundM[1].trim()
    const meansClause = byGerundM[2].trim()
    if (valueClause.length > 1) classifyFragment(valueClause, acc)
    acc.means.push(meansClause)
    return
  }

  // 8. Default: it's a Value
  acc.values.push(t)
}

/**
 * Split text on commas / "and" / semicolons then classify each item.
 * Use this anywhere a text fragment might contain multiple SEM entities.
 */
function pushClassified(text: string, acc: MultiParsed): void {
  splitItems(text).filter(v => v.length > 1).forEach(item => classifyFragment(item, acc))
}

/**
 * Parse free-form natural language into stakeholders / values / means.
 * Handles multiple entities in each category, any order, multiple sentences.
 *
 * Recognised patterns (non-exhaustive):
 *   "As a parent and CEO, I want family happiness to improve, using weekly reviews"
 *   "Parent needs better coordination. CEO wants 15% revenue growth."
 *   "Improve family health and revenue, using OKRs and monthly reviews"
 *   "use AI for engineer productivity"   → means: AI,  ends: productivity
 *   "parent | family happiness | weekly reviews"  (pipe shorthand)
 */
function parseMultiEntry(text: string): MultiParsed {
  const acc: MultiParsed = { stakeholders: [], values: [], means: [] }
  const input = text.trim()
  if (!input) return acc

  // Pipe shorthand: "X | Y | Z" → treat as [stakeholder|value|means] (order guessed)
  const pipeParts = input.split('|').map(p => p.trim()).filter(Boolean)
  if (pipeParts.length >= 2) {
    // Heuristic: first = who, last = how, middle = what
    acc.stakeholders.push(...splitItems(pipeParts[0]))
    if (pipeParts.length === 3) {
      acc.values.push(...splitItems(pipeParts[1]))
      acc.means.push(...splitItems(pipeParts[2]))
    } else {
      acc.values.push(...splitItems(pipeParts[1]))
    }
    return clean(acc)
  }

  // Split into sentences.
  // Also split on newlines so pasted multi-paragraph documents (where sections
  // are separated by line breaks rather than periods) get broken into individual
  // items. Without this, an entire paragraph with no terminal punctuation becomes
  // a single "sentence" that ends up as one enormous chip overflowing the pill UI.
  const sentences = input
    .split(/[.!?\n]+/)
    .flatMap(s => s.split(/(?<=\w)\s*;\s*(?=\S)/))
    .map(s => s.trim())
    .filter(Boolean)

  for (const sentence of sentences) {
    const s = sentence

    // ── Means zone (everything after using/through/via/by [gerund]…) ──────
    // "by [gerund]" is now a first-class link word: "earn money by doing X"
    // matches on "by doing", "by spending", "by working", etc.
    const meansIdx = s.search(
      /\b(?:using|through|via|by\s+\w+ing|implementing|building|creating|developing|deploying|adopting|introducing)\b/i
    )
    const meansStr = meansIdx >= 0 ? s.slice(meansIdx).replace(/^[^a-zA-Z]+/, '') : ''
    if (meansStr) {
      // For "by [gerund]", strip only "by " so the gerund is kept in the means phrase
      // ("by doing nothing" → "doing nothing", not "nothing").
      // For all other link words (using/through/via/implementing…) use the original
      // two-word strip logic which handles "by using", "by building" etc.
      const byGerundLead = meansStr.match(/^by\s+(\w+ing\b)/i)
      const keywordLen = byGerundLead
        ? 'by '.length
        : (meansStr.match(/^\w+(?:\s+\w+)?\s+/)?.[0].length ?? 0)
      splitItems(meansStr.slice(keywordLen)).forEach(m => acc.means.push(m))
    }

    // Text before means zone
    const preStr = meansIdx >= 0 ? s.slice(0, meansIdx) : s

    // ── Stakeholder markers ───────────────────────────────────────────────
    // "as a/an/the [role(s)]" or "i as [role]"
    const asAMatch  = preStr.match(/\bas\s+(?:a|an|the)\s+(.+?)(?=\s*,|\s+i\b|\s+want|\s+need|\s+wish|\s+aim|$)/i)
    const iAsMatch  = preStr.match(/\bi\s+as\s+(?:a\s+|an\s+|the\s+)?(.+?)(?=\s*,|\s+want|\s+need|\s+wish|$)/i)
    // "[role] want(s)/need(s)/wishes" at sentence start — including "I want/need/wish"
    const roleWants = preStr.match(/^(.+?)\s+(?:wants?|needs?|wishes?)\s+/i)

    if (asAMatch)  splitItems(asAMatch[1]).forEach(r  => acc.stakeholders.push(r))
    if (iAsMatch)  splitItems(iAsMatch[1]).forEach(r  => acc.stakeholders.push(r))
    if (roleWants && !asAMatch && !iAsMatch) acc.stakeholders.push(roleWants[1].trim())

    // ── Value markers ─────────────────────────────────────────────────────
    const valueKw = preStr.match(
      /\b(?:want(?:s?)(?:\s+to)?|need(?:s?)(?:\s+to)?|wish(?:es?)(?:\s+to)?|aim(?:s?)(?:\s+to)?|goals?\s+(?:is|are|to)|objectives?\s+(?:is|are|to))\b/i
    )
    // "improve/increase/reduce [thing]" at sentence start
    const bareImprove = preStr.match(
      /^(improve|increase|reduce|achieve|ensure|deliver|grow|boost|maximize|minimize|optimize|enhance)\s+(.+)$/i
    )

    if (valueKw) {
      // Everything after the value keyword goes through the full classifier:
      // "I want to use AI for engineer productivity"
      //   → means: "use AI" · stakeholder: "engineer" · value: "productivity"
      const valStart = (valueKw.index ?? 0) + valueKw[0].length
      pushClassified(preStr.slice(valStart).trim(), acc)
    } else if (bareImprove && !asAMatch && !iAsMatch && !roleWants) {
      // "improve / increase / reduce X" — keep the verb, push the role as a
      // stakeholder, and keep the FULL value phrase (Tom's cabin-tweak: don't
      // strip the role word out of V):
      //   "improve engineer productivity"
      //     → stakeholder:"engineer" · value:"improve engineer productivity"
      const verb = bareImprove[1]
      splitItems(bareImprove[2]).forEach(v => {
        const rv = splitRoleValue(v)
        if (rv) {
          acc.stakeholders.push(rv.role)
          // rv.value is the FULL phrase (e.g. "engineer productivity"), so
          // `${verb} ${rv.value}` yields "improve engineer productivity".
          acc.values.push(`${verb} ${rv.value}`)
        } else {
          acc.values.push(`${verb} ${v}`)
        }
      })
    } else if (!valueKw && !bareImprove) {
      // No explicit keyword — run the full recursive classifier.
      // "use AI for engineer productivity" → means · stakeholder · value
      // "weekly reviews"                   → means
      // "customer satisfaction"            → stakeholder · value
      // "family happiness"                 → value
      const trimmed = preStr.trim()
      if (trimmed && !asAMatch && !iAsMatch && !roleWants && trimmed.length > 3) {
        pushClassified(trimmed, acc)
      }
    }
  }

  // ── Final-pass implied-stakeholder scan ──────────────────────────────────────
  // Tom 2026-05-14 (1): "we really need much better parsing of input, especially
  //   identifying stakeholders. The phrase 'enjoy with family' did not put family
  //   in stakeholder."
  // Tom 2026-05-14 (2): "cabin is also a stakeholder, but 'cabin experiences' is
  //   a value. so because it occurs one place does not free you from the
  //   inference that the adjective cabin is also a noun and implied stakeholder."
  //
  // Rule: every ROLE_WORD that appears at clean word-boundary in the input is
  // an *implied stakeholder*, even when the classifier has already filed it
  // inside a value/stakeholder phrase. The adjective-form ("cabin experiences",
  // "garden party") doesn't free the noun-form ("cabin", "garden") from being
  // its own stakeholder. We scan the input once and push every bare match.
  //
  // The ONE exclusion: when a role word lives EXCLUSIVELY inside a captured
  // Means (e.g. "team building" tagged as a Means activity), don't push it —
  // the user is naming an activity, not signalling that "team" is a stakeholder.
  // If the same word also appears in values or in the raw input outside the
  // means phrase, we do push it. Dedup against exact duplicates already in
  // acc.stakeholders so the bare form doesn't double up.
  {
    const lower = input.toLowerCase()
    const tokens = lower.match(/\b[\w-]+\b/g) ?? []
    const seenInThisScan = new Set<string>()
    for (const tok of tokens) {
      if (seenInThisScan.has(tok)) continue
      if (!ROLE_WORDS.has(tok)) continue
      seenInThisScan.add(tok)

      const re = new RegExp(`\\b${tok}\\b`, 'i')
      const inMeans  = acc.means.some(m  => re.test(m.toLowerCase()))
      const inValues = acc.values.some(v => re.test(v.toLowerCase()))
      const inInputOutsideMeans = (() => {
        if (!inMeans) return true
        // Strip every captured means phrase from the lowercased input and
        // see if the role word still survives somewhere else.
        let residual = lower
        for (const m of acc.means) {
          residual = residual.split(m.toLowerCase()).join(' ')
        }
        return new RegExp(`\\b${tok}\\b`, 'i').test(residual)
      })()
      // Skip ONLY when the word is fully consumed by a Means and not echoed
      // in any value or in the raw input outside that means phrase.
      // EXCEPTION: if the word is a recognised stakeholder-pattern keyword
      // (e.g. "government" in "government oil money"), it is always a
      // stakeholder even when it appears inside a Means phrase — the Means
      // phrasing merely describes HOW the stakeholder's resource is used.
      const isKnownStakeholderKeyword = STAKEHOLDER_PATTERNS.some(p =>
        p.keywords.some(k => k === tok)
      )
      if (inMeans && !inValues && !inInputOutsideMeans && !isKnownStakeholderKeyword) continue

      // Skip exact-string duplicates already in stakeholders.
      if (acc.stakeholders.some(s => s.toLowerCase() === tok)) continue
      acc.stakeholders.push(tok)
    }
  }

  // ── Layer-3: contextual preposition-phrase extraction ────────────────────
  // extractContextualStakeholders catches phrases introduced by "for", "helping",
  // "serving", "supporting" etc. that the rule-based classifier above may miss.
  // Classic case: "for the poorest in Norway" → "Poorest in Norway".
  // Only novel phrases are merged — if an existing stakeholder is a substring
  // of the new phrase, the longer (more specific) phrase replaces it so the
  // chip carries the full geographic/demographic context.
  {
    const ctxMatches = extractContextualStakeholders(input)
    for (const m of ctxMatches) {
      const phrase = m.name
      const phraseLower = phrase.toLowerCase()
      // Replace any shorter existing stakeholder that is a subset of this phrase
      const subsetIdx = acc.stakeholders.findIndex(s => phraseLower.includes(s.toLowerCase()) && s.toLowerCase() !== phraseLower)
      if (subsetIdx >= 0) {
        acc.stakeholders[subsetIdx] = phrase
        continue
      }
      // Skip if a superset already exists (existing phrase contains this one)
      if (acc.stakeholders.some(s => s.toLowerCase().includes(phraseLower))) continue
      // Skip exact duplicates
      if (acc.stakeholders.some(s => s.toLowerCase() === phraseLower)) continue
      acc.stakeholders.push(phrase)
    }
  }

  return clean(acc)
}

function clean(acc: MultiParsed): MultiParsed {
  const dedup = (arr: string[]) =>
    [...new Set(
      arr
        .map(s =>
          s
            // Strip leading articles and trailing punctuation
            .replace(/^(?:a|an|the)\s+/i, '')
            .replace(/[.!?,;]$/, '')
            // Strip markdown bold/italic asterisks and underscores (from copy-pasted docs)
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .trim()
            // NOTE: no hard data-truncation here. Chip DATA stays full-length so
            // Tom can always see / revert the full text. Visual overflow is handled
            // by CSS on the chip pill (max-w-[360px] overflow-hidden + truncate on
            // the text button). Ollama context truncation happens in useSDK.ts at
            // prompt-build time — that's the right place.
        )
        // "I" and "we" are valid single-/short-word stakeholders — let them through.
        .filter(s => /^(?:i|we)$/i.test(s) || (s.length > 1 && !/^(?:a|an|the|to|of|in|for|with|by|on|it|its|this|that)$/i.test(s)))
    )]
  return {
    stakeholders: dedup(acc.stakeholders),
    values:       dedup(acc.values),
    means:        dedup(acc.means),
  }
}

// ── Input stage actions ───────────────────────────────────────────────────────

function parseInput(): void {
  parseError.value = ''
  const result = parseMultiEntry(rawInput.value)
  parsedStakeholders.value = result.stakeholders
  parsedValues.value       = result.values
  parsedMeans.value        = result.means
  if (!rawInput.value.trim()) {
    parseError.value = 'Say or type your project idea first.'
    return
  }
  // r41 v392 (Tom Gilb 2026-06-27 verbatim "it move automatically to generating
  // without me getting a chance to add suggested additions") — REVERTS v391's
  // auto-fire.  Three rounds of interpreting "approve" had me adding logic
  // Tom did not want:
  //   v390 → removed the 4 columns entirely (wrong; he wanted to see them)
  //   v391 → restored columns + auto-fired submit (wrong; denied him chance
  //          to + Accept suggested additions)
  //   v392 → behave like pre-v390: show parse-review with chips + suggested
  //          additions panel; user clicks Generate Spec when ready.
  // The mode difference (quick vs precise) still applies AFTER Generate Spec:
  // quick mode skips clarifying questions; precise mode asks them.  Both
  // modes show the same review screen.
  stage.value = 'review'
  submitError.value = ''
  // r41 v389 (Tom Gilb 2026-06-27 *"plan name and owner do not get filled in,
  // it should be instant with a new plan"*): mechanical seed for both fields
  // the moment Parse fires (instant — visible on the review screen before
  // the AI suggestion debounce returns).  Reuses _maybeAutoSuggestTitleOwner
  // semantics: NEVER overwrites user-typed values; mechanical seed runs only
  // when BOTH fields are still empty.  The 1500 ms AI refinement watcher
  // then OVERWRITES the mechanical seed once the LLM (now routed to local
  // Ollama, no auth tokens) returns a richer title/owner.  Composes with:
  // AI-Max SUPREME (never blank fields), C-hybrid pattern from v373 Qualifiers,
  // No-Silent-Data-Loss SUPREME (user input always wins).
  if (!planNameInput.value.trim() && !ownerNameInput.value.trim()) {
    const seeded = _seedMechanicalTitleOwner(rawInput.value)
    if (seeded.title)  planNameInput.value  = seeded.title
    if (seeded.owner)  ownerNameInput.value = seeded.owner
    // Mark as AI-filled so the rawInput-substantial-change watcher can clear
    // these seeds + re-suggest when content paste-overs happen.
    if (seeded.title || seeded.owner) {
      _titleOwnerAiFilled.value = true
      _rawInputSnapshotAtTitleFill.value = rawInput.value.trim()
    }
    // Fire the proper AI suggestion immediately (don't wait for debounce).
    void _maybeAutoSuggestTitleOwner()
  }
  // r41 v390 (Tom Gilb 2026-06-27 verbatim "AFTER PARSIING IT RETURNED TO
  // BEGINNING / I DONT WANT TO APPROVE ALL these things"):
  // In QUICK mode (Analyze As Is — the subtitle promises "Will generate
  // directly from your input"), the chip-review step is mis-aligned with
  // the user's expressed intent.  Tom's mental model: input → spec, no
  // intermediate.  The "Does this look right?" chip-approval screen feels
  // like backward motion ("RETURNED TO BEGINNING") even though it
  // technically advanced.
  //
  // Fix: in quick mode, if parse produced ≥1 Value (handleSubmit's
  // precondition), auto-fire handleSubmit immediately after parsing.  The
  // chip-review screen is skipped entirely.  In precise mode (Answer Some
  // Questions), chip-review stays — that user actively chose careful
  // analysis.  If parse produced zero Values, fall back to review either
  // way (generation can't proceed; user has to add a Value).
  //
  // Composes with:
  //  - MOVE Principle SUPREME (don't make the user click extra screens)
  //  - AI-Max SUPREME (skip the gate; ship the AI work)
  //  - Permission Tiers GREEN (no data destruction; chip review still
  //    reachable via "← Edit" from the spec output)
  //  - Twin portability (the quick-path semantic ports verbatim)
  //
  // r41 v392 — Auto-fire reverted.  User clicks Generate Spec when ready
  // (after optionally reviewing the chips, adding suggested additions, etc.).
  // The mode-specific behaviour (quick vs precise) kicks in in App.vue's
  // doTranslate path, not here.
  // Both modes — show the review screen (columns visible).
  // r41 v341 (Tom Gilb 2026-06-25 "When parse is done the does this look right
  // line should be at the top of the screen" — said several times tonight):
  // explicit window.scrollTo with computed offset.  scrollIntoView alone
  // proved unreliable here because the H1 mounts in the same render-tick
  // as the stage flip — it can be UNDER the fixed chrome (window.scrollY
  // can't get NEGATIVE) and the browser then silently no-ops.  The double-
  // rAF guarantees the review section has painted + the H1 has a real
  // boundingClientRect before we compute the scroll target.  Offset 180px
  // matches the title bar + 11-stage strip height (DD-009 zero-training
  // chrome that stays visible across every surface).
  nextTick(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = reviewHeadingRef.value
      if (!el) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      const rect = el.getBoundingClientRect()
      const targetTop = Math.max(0, rect.top + window.scrollY - 180)
      window.scrollTo({ top: targetTop, behavior: 'smooth' })
    }))
  })
}

// Called by the manual "Parse my input" button — resets source to 'manual'
// so the source banner does not appear for user-typed content.
function parseManual(): void {
  inputSource.value = 'manual'
  parseInput()
}

function templatesOpen_toggle(): void {
  templatesOpen.value = !templatesOpen.value
}

function applyTemplate(id: string): void {
  const tpl = SEM_TEMPLATES.find(t => t.id === id)
  if (!tpl) return
  rawInput.value = [tpl.stakes, tpl.ends, tpl.means].filter(Boolean).join('. ')
  templatesOpen.value = false
  inputSource.value = 'template'
  parseInput()
}

function handleSurprise(): void {
  const seed = SURPRISE_SEEDS[Math.floor(Math.random() * SURPRISE_SEEDS.length)]
  rawInput.value = [seed.stakes, seed.ends, seed.means].filter(Boolean).join('. ')
  inputSource.value = 'surprise'
  parseInput()
}

// ── Review stage: chip editing ────────────────────────────────────────────────

function listFor(group: Group): string[] {
  if (group === 'stakeholders') return parsedStakeholders.value
  if (group === 'values')       return parsedValues.value
  return parsedMeans.value
}

function startEdit(group: Group, index: number): void {
  editingChip.value = { group, index }
  const chipText = listFor(group)[index]
  editingText.value  = chipText
  // r41 v320 — provenance flash: scroll Original Words to the matching
  // line + flash it amber for ~1.8s.  Fires alongside edit-mode focus so
  // the user sees BOTH the edit input AND the source line in one click.
  flashSourceForChip(chipText)
  nextTick(() => {
    const el = document.getElementById(`chip-edit-${group}-${index}`) as HTMLInputElement | null
    // r41 v329 — REVERTED v328's preventScroll + mousedown additions: Tom
    // reported "none of s/e/m give yellowed text" after v328 shipped.
    // Suspected v328 regression. Reverted to v327 state (which had "first
    // chip click works, subsequent don't" — better than "none work").
    // The v328 attempted-fix is parked; needs interactive diagnosis post-demo.
    el?.focus()
    el?.select()
  })
}

function commitEdit(): void {
  if (!editingChip.value) return
  const { group, index } = editingChip.value
  const text = editingText.value.trim()
  if (text) {
    listFor(group)[index] = text
  } else {
    listFor(group).splice(index, 1)
  }
  editingChip.value = null
  editingText.value  = ''
}

function cancelEdit(): void {
  editingChip.value = null
  editingText.value  = ''
}

function removeChip(group: Group, index: number): void {
  listFor(group).splice(index, 1)
}

// ── Review stage: adding ──────────────────────────────────────────────────────

function startAdd(group: Group): void {
  addingTo.value   = group
  addingText.value = ''
  nextTick(() => {
    const el = document.getElementById(`chip-add-${group}`) as HTMLInputElement | null
    el?.focus()
  })
}

function commitAdd(): void {
  const text = addingText.value.trim()
  if (text && addingTo.value) {
    listFor(addingTo.value).push(text)
  }
  addingTo.value   = null
  addingText.value = ''
}

function cancelAdd(): void {
  addingTo.value   = null
  addingText.value = ''
}

// ── Review stage: chip moving ─────────────────────────────────────────────────
// Tom 2026-05-15: "select and move, orally Move [Name of Item] to [group]"

function startMove(group: Group, index: number): void {
  editingChip.value = null   // close any open inline edit
  addingTo.value    = null   // close any open add input
  movingChip.value  = { group, index }
}

function cancelMove(): void {
  movingChip.value = null
}

function commitMove(targetGroup: Group): void {
  if (!movingChip.value) return
  const { group, index } = movingChip.value
  if (group === targetGroup) { movingChip.value = null; return }
  const [text] = listFor(group).splice(index, 1)
  listFor(targetGroup).push(text)
  movingChip.value = null
}

// ── Review stage: move command bar ───────────────────────────────────────────
/** Parse a typed "Move X to Y" command.
 *  Accepts "move cabin to values", "goals to means", "stakeholders to who" etc.
 *  Fuzzy-matches by substring so "cabin" finds "cabin experiences". */
function processMoveCmd(): void {
  const raw = moveCmd.value.trim()
  // Optional leading "move"
  const m = raw.match(/^(?:move\s+)?(.+?)\s+to\s+(stakeholders?|who|people|values?|goals?|ends?|means?|solutions?|strategies?|how)/i)
  if (!m) { moveCmd.value = ''; return }
  const itemName = m[1].trim().toLowerCase()
  const dest     = m[2].toLowerCase()
  const target: Group =
    /^(stakeholders?|who|people)/.test(dest) ? 'stakeholders' :
    /^(values?|goals?|ends?)/.test(dest)     ? 'values'       : 'means'

  for (const g of ['stakeholders', 'values', 'means'] as Group[]) {
    const list = listFor(g)
    const idx  = list.findIndex(x => x.toLowerCase().includes(itemName))
    if (idx >= 0) {
      if (g !== target) {
        const [text] = list.splice(idx, 1)
        listFor(target).push(text)
      }
      moveCmd.value = ''
      return
    }
  }
  moveCmd.value = '' // command not matched — clear silently
}

// ── Submit ────────────────────────────────────────────────────────────────────

function handleSubmit(): void {
  submitError.value = ''

  if (parsedValues.value.length === 0) {
    submitError.value = 'Add at least one goal or value before generating.'
    // 2026-05-13: console.error so the failure is visible in DevTools and
    // scroll the error into view — previously the error sat above the
    // Generate Spec button and could be missed if the form was scrolled
    // past it. With the new pt-[20rem] body padding the form can sit far
    // below the persistent bar so an out-of-view error is plausible.
    console.error('[SEMEntryForm.handleSubmit] No goals/values parsed — refusing to submit.', {
      parsedValues: parsedValues.value,
      parsedStakeholders: parsedStakeholders.value,
      parsedMeans: parsedMeans.value,
    })
    nextTick(() => {
      const el = document.querySelector('[role="alert"]')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return
  }

  const stakes = parsedStakeholders.value.join(', ')
  const ends   = parsedValues.value.join(', ')
  const means  = parsedMeans.value.join(', ')

  setSubmitting(true)
  setHasSubmitted(true)
  // Planguage rule: Ends and Means are mutually exclusive at any level.
  // Means deliver Ends — never copy one into the other as a fallback.
  // If the parser found no means, emit empty means (not a copy of ends).
  // If the parser found no stakeholders, emit empty stakes (not a copy of ends).
  emit('submit', {
    stakes,
    ends,
    means,
    ...(planNameInput.value.trim()  ? { planName:  planNameInput.value.trim()  } : {}),
    ...(ownerNameInput.value.trim() ? { ownerName: ownerNameInput.value.trim() } : {}),
  })
  // r41 v366 (Tom Gilb 2026-06-25 "I started with a simple sentence … and
  // then generating click, and back to a blank start") — DRAFT CLEARING
  // POSTPONED to success path.  Previously this site OPTIMISTICALLY cleared
  // BOTH the Safety Net snapshot AND the continuous SEM_DRAFT_KEY draft the
  // INSTANT the user clicked Generate — BEFORE generation actually
  // succeeded.  Result: if anything caused a remount during/after the
  // ~60-180s generation window (Vite HMR mid-edit · parent re-render · the
  // HangWatchdog firing on a slow API · v357's translate() returning null on
  // a network hiccup), SEMEntryForm's onMounted auto-restore (v332) found
  // BOTH localStorage drafts empty and the textarea stayed blank.  Tom's
  // typed text was destroyed before generation success was confirmed.
  //
  // The "Oops fires on next app load when textarea is empty" bug the old
  // code fixed is now handled by the existing safety-net intentional-clear
  // mechanism (markIntentionalClear) — but ONLY when we're SURE the content
  // was consumed.  Until that's confirmed (currentSpec.value lands, which
  // App.vue does inside doTranslate's success branch), the drafts stay.
  //
  // Net behaviour: drafts persist across failed/slow generations so the
  // planner never loses typed text.  Next successful submit overwrites the
  // draft; next typing overwrites it; SOS Reset (v364) wipes it explicitly.
  // The Oops banner can briefly surface if the user's text length drops to
  // 0 after a successful submit — acceptable cost; it's dismissible.
  setSubmitting(false)
}

/**
 * Called by the Apperture (via App.vue template ref) when the user commits
 * text in the oval. Pre-fills the raw input and immediately triggers Parse
 * so the user lands on the chip-review stage (rather than direct generation).
 * Tom 2026-05-15: "we then Parse".
 */
function loadAndParse(text: string): void {
  rawInput.value = text
  inputSource.value = 'manual'
  parseInput()
}

/**
 * Pre-fills the form with genesis stakes/ends/means from a saved plan so the
 * planner can edit and re-parse.  Called by App.vue after the user clicks the
 * "Edit & Re-parse" button in SpecOutput.
 * Tom Gilb 2026-06-09: "initial input specs she got parsed were gone — go back to the genesis."
 */
function prefillGenesis(genesis: { stakes: string; ends: string; means: string }): void {
  rawInput.value = [genesis.stakes, genesis.ends, genesis.means].filter(Boolean).join('. ')
  inputSource.value = 'manual'
  parseInput()
}

defineExpose({ loadAndParse, prefillGenesis })
</script>

<template>
  <!-- r41 2026-06-20 (Tom Gilb verbatim "THE SCROLL BAR IS WAY TOO FAR RIGHT
       AND UP, MAKE IT NEARER THE INPUT WINDOW, MAKE THE WINDOW MUCH
       BROADER…") — outer container conditionally wider when an external
       document is imported.  Default `max-w-2xl` (672 px) keeps the typing
       experience focused for fresh-input mode; expands to `max-w-5xl`
       (1024 px) once an Indianapolis-class multi-page document is loaded
       so the preview isn't a narrow keyhole.  Composes with: accessibility_
       tom.md (Tom 85 — bigger reading area), MOVE Principle (the import
       triggers the wider mode automatically), No-Silent-Data-Loss SUPREME
       (the document text isn't trapped in a 2 %-shown narrow window). -->
  <!-- r41 2026-06-20 (Tom Gilb verbatim "the input window should be much
       broader") — bumped imported-mode cap from max-w-5xl (1024 px) to
       max-w-7xl (1280 px) so the textarea actually feels wide. -->
  <!-- r41 v342 (Tom Gilb 2026-06-25 screenshot + verbatim "retro thin
       unreadable columns (use whole screen! Breadth)"): at REVIEW stage,
       use the whole screen (≈ 95vw, capped at 1800px so type-line lengths
       stay readable on ultrawide monitors).  The narrow `max-w-2xl` was
       written for the typing experience only; it crushed the 4-column
       review grid into ~168 px per column, truncating every chip to 4
       characters ("rep…", "aut…", "plans"…) and making the source pane so
       narrow that the yellow Input Source highlight scrolled off-viewport.
       Tom verbatim earlier turns: *"the input window should be much
       broader"* (2026-06-20), now generalised to the review-stage panel.
       INPUT stage keeps its narrower cap so the typing experience stays
       focused; imported-mode keeps max-w-7xl as v327. -->
  <div
    class="w-full mx-auto px-4 py-6 space-y-6"
    :class="stage === 'review'
      ? 'max-w-[1800px]'
      : ((importSource && rawInput) ? 'max-w-7xl' : 'max-w-2xl')"
  >

    <!-- ══════════════════════════════════════════════════════════════════════
         STAGE 1 — Input
         ══════════════════════════════════════════════════════════════════════ -->
    <template v-if="stage === 'input'">

      <!-- Toolbar -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-gray-400 font-medium shrink-0">Tools</span>
          <button
            type="button"
            class="h-11 rounded-full px-4 text-xs font-medium bg-gray-100 text-gray-600
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150"
            :aria-expanded="templatesOpen"
            aria-label="Templates"
            @click="templatesOpen_toggle"
          >
            <span aria-hidden="true">📋</span> Templates
          </button>

          <button
            type="button"
            class="h-11 px-4 rounded-full bg-violet-100 text-violet-700 text-xs font-medium
                   hover:bg-violet-200 border border-violet-200
                   focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors duration-150"
            aria-label="Surprise me"
            @click="handleSurprise"
          >
            <span aria-hidden="true">🎲</span> Surprise me
          </button>

          <!-- r41 v365 (Tom Gilb 2026-06-25 "remove what is not in use, so it
               does not pop up as a surprice, start with your goal, guided, all
               old stuff") — 🎯 "Start with your goal" pill REMOVED.  Was the
               primary gateway to the legacy SpecWizard.vue (Feature #53) which
               Tom never used and which surprised him when accidentally
               clicked.  No-Silent-Removal SUPREME compliance: this comment
               documents the removal; the component file stays for any test
               coverage; wizardOpen ref + Teleport mount also removed in
               App.vue (5 trigger sites total). -->

          <!-- Import button -->
          <button
            type="button"
            class="h-11 px-4 rounded-full border text-xs font-medium transition-colors duration-150
                   focus:outline-none focus:ring-2 focus:ring-emerald-500"
            :class="importPanelOpen
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50'"
            :aria-expanded="importPanelOpen"
            aria-label="Import planning data"
            @click="importPanelOpen = !importPanelOpen"
          >
            <span aria-hidden="true">📎</span> Import planning data
          </button>
        </div>

        <!-- Import panel -->
        <div
          v-if="importPanelOpen"
          class="-mx-4 rounded-xl border border-emerald-200 overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 bg-emerald-600">
            <span class="text-xs font-semibold text-white tracking-wide select-none">
              📎 Import planning data from URL or file
            </span>
            <CloseDot
        variant="on-dark"
        aria-label="Close import panel"
        @click="closeImportPanel"
      />
          </div>

          <div class="px-4 py-4 bg-emerald-50 space-y-4">

            <!-- URL row -->
            <div>
              <p class="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Paste a URL
              </p>
              <p class="text-[11px] text-emerald-700 mb-2">
                Google Sheets, Google Docs, Google Slides — or any public plain-text URL.
                The document must be set to <strong>"Anyone with the link can view"</strong>.
              </p>
              <div class="flex gap-2">
                <input
                  v-model="importUrl"
                  type="url"
                  class="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  :disabled="importLoading"
                  @keydown.enter="handleUrlImport"
                />
                <button
                  type="button"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500
                         disabled:opacity-50 transition-colors whitespace-nowrap"
                  :disabled="importLoading || !importUrl.trim()"
                  @click="handleUrlImport"
                >
                  <span v-if="importLoading" class="animate-spin">⏳</span>
                  <span v-else>Import</span>
                </button>
              </div>
            </div>

            <!-- Divider -->
            <div class="flex items-center gap-3">
              <div class="flex-1 border-t border-emerald-200" />
              <span class="text-[11px] text-emerald-500 font-medium">or upload a file</span>
              <div class="flex-1 border-t border-emerald-200" />
            </div>

            <!-- File row -->
            <div class="space-y-2">
              <!-- Format grid — reflects this panel's actual capabilities.
                   Tom 2026-05-14: "surely pdf is bare minimum" — PDF + Word
                   moved from ❌ to ✅ after pdfjs-dist + mammoth wired in. -->
              <div class="grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
                <div>
                  <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">✅ Supported here</p>
                  <ul class="space-y-px text-[11px] text-slate-600 leading-relaxed">
                    <li>PDF <span class="text-slate-400">(.pdf)</span></li>
                    <li>Word <span class="text-slate-400">(.docx)</span></li>
                    <li>Text / Markdown <span class="text-slate-400">(.txt · .md)</span></li>
                    <li>CSV <span class="text-slate-400">(.csv)</span></li>
                    <li>Public web URLs</li>
                    <li>Google Docs <span class="text-slate-400">"anyone with link"</span></li>
                    <li>Google Sheets <span class="text-slate-400">"anyone with link"</span></li>
                    <li>Google Slides <span class="text-slate-400">"anyone with link"</span></li>
                  </ul>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1 inline-flex items-center gap-1">
                    ❌ Use
                    <GetGlyph size="compact" class="inline-block h-3 w-auto" aria-hidden="true" />
                    Import instead
                  </p>
                  <ul class="space-y-px text-[11px] text-slate-600 leading-relaxed">
                    <li>PowerPoint <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Excel <span class="text-slate-400">→ save as CSV</span></li>
                    <li>Keynote / Pages <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Private / login-protected URLs</li>
                  </ul>
                </div>
              </div>

              <label
                class="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-emerald-300
                       cursor-pointer hover:border-emerald-500 hover:bg-emerald-100 transition-colors text-sm text-emerald-700"
              >
                <GetGlyph size="compact" class="h-3 w-auto shrink-0 text-emerald-700" aria-hidden="true" />
                <!--
                  Tom 2026-05-14: *"surely pdf is bare minimum, these good
                  formats are uninteresting"* — PDF + Word are now first-class
                  on the home form alongside text formats. No more detour
                  through the Get-A-Plan circle.
                -->
                <span>Choose a .pdf, .docx, .txt, .md, or .csv file</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.rtf,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,text/rtf,text/html"
                  class="sr-only"
                  :disabled="importLoading"
                  @change="handleFileImportDoc"
                />
              </label>
            </div>

            <!-- Error -->
            <p v-if="importError" class="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {{ importError }}
            </p>
          </div>
        </div>

        <!-- Template pills — tool output panel -->
        <div
          v-if="templatesOpen"
          class="-mx-4 rounded-xl border border-indigo-200 overflow-hidden"
        >
          <!-- Colored title bar -->
          <div class="flex items-center justify-between px-4 py-2 bg-indigo-600">
            <span class="text-xs font-semibold text-white tracking-wide select-none">
              <span aria-hidden="true">📋</span> Templates
            </span>
            <button
              type="button"
              class="text-base leading-none text-indigo-200 hover:text-white
                     focus:outline-none focus:ring-2 focus:ring-white rounded
                     transition-colors duration-150"
              aria-label="Close Templates"
              title="Close Templates"
              @click="templatesOpen = false"
            >🗑️</button>
          </div>
          <!-- Pills -->
          <div
            class="px-4 overflow-x-auto flex gap-2 py-3 bg-indigo-50"
            role="list"
            aria-label="Spec templates"
          >
            <button
              v-for="tpl in SEM_TEMPLATES"
              :key="tpl.id"
              type="button"
              class="flex items-center gap-1.5 h-11 px-4 rounded-full border border-indigo-200 text-sm bg-white
                     hover:border-indigo-400 hover:text-indigo-700 whitespace-nowrap
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150"
              :aria-label="`Apply ${tpl.label} template`"
              @click="applyTemplate(tpl.id)"
            >
              <span aria-hidden="true">{{ tpl.icon }}</span>
              <span>{{ tpl.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Logo + heading -->
      <div class="flex items-center gap-3">
        <img
          src="/icon-sem-app.svg"
          alt="SEM App logo"
          :title="`SEM App — Keeney three-level hierarchy (Value-Focused Thinking, 1992)\n\n▲ FUNDAMENTAL · amber\n  Objectives given from above — environment, parent org, regulations\n  We operate within these; cannot unilaterally redesign them\n\n● STRATEGIC · violet  ← this level (the hero row)\n  Our own plan — the Ends and Values we own and are accountable for\n\n▼ MEANS · emerald\n  What supports us from below — Functions and Solutions\n  These deliver our Strategic Ends upward to the stakeholder\n\n──────────────────────────────\nperson / §  =  Stakeholder (animate or inanimate)\n←O←         =  End: target that receives and delivers value\nO←          =  Means: source that fires value into the target`"
          class="h-10 w-10 shrink-0 rounded-xl shadow-sm cursor-help"
        />
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">What's your project about?</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Say or type anything — who cares, what you want, how you'll do it.
            Multiple stakeholders, goals, and strategies are all fine.
          </p>
        </div>
      </div>

      <!-- v503 (2026-07-21) — Plan Scope Framework overview strip.
           Tom Gilb 2026-07-21 verbatim: "Their needs to be opportunity to
           capture these project resources idea at the beginning of the
           project, and to see their status at any overview of the project,
           and to see they are not determined yet, and to change them any
           time".  Full card mode with pill rows + "not yet determined"
           amber state; edit affordances jump to Stage 10 (Resources
           Sharpening) via the 'open-editor' emit.  planIdRef derived from
           the plan name input (empty name → 'default' — still per-plan
           persistence, just under a shared key until a name is entered).-->
      <PlanScopeStatusStrip
        :plan-id-ref="planScopePlanId"
        @open-editor="onScopeEditorOpen"
      />

      <!-- Main input -->
      <div class="space-y-2">

        <!-- ── Plan Name + Owner Name — collected upfront (Tom 2026-06-08) ── -->
        <div class="flex gap-3">
          <div class="flex-1">
            <!-- r41 v67 (Tom Gilb 2026-06-16 verbatim "like the spec tags it
                 needs to be fairly prominent") — Plan / Contract Name is the
                 identity of the WHOLE plan, analogous to the Tag identity of
                 a spec entry.  Label + input both bumped to match spec-tag-
                 level prominence: larger fonts, bolder weights, slate-800
                 colour.  Underline-tradition applied to the typed value so
                 the convention reads consistently across spec Tag and Plan
                 title. -->
            <label for="sem-plan-name" class="block text-sm font-bold text-slate-700 mb-1">
              Plan / Contract Name <span class="text-gray-400 font-normal text-xs">(optional — auto-derived if blank)</span>
              <span v-if="_titleOwnerAiFilled" class="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold align-middle" title="✨ Auto-suggested from your text — edit anytime to override">✨ AI suggested</span>
            </label>
            <input
              id="sem-plan-name"
              v-model="planNameInput"
              type="text"
              maxlength="120"
              class="w-full rounded-lg border-2 border-indigo-300 bg-white px-3 py-2.5 text-xl font-extrabold
                     text-slate-900 placeholder-gray-400 placeholder:font-normal placeholder:text-base
                     shadow-sm underline underline-offset-4 decoration-2 decoration-indigo-300
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                     transition-colors duration-150"
              placeholder="e.g. Improve Crew Retention 2026"
              title="Plan / Contract name — used as the plan's title at the top. Leave blank to auto-derive from your spec content."
            />
          </div>
          <div class="w-60">
            <label for="sem-owner-name" class="block text-sm font-bold text-slate-700 mb-1">
              Owner Name <span class="text-gray-400 font-normal text-xs">(optional — auto-derived if blank)</span>
              <span v-if="_titleOwnerAiFilled" class="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold align-middle" title="✨ Auto-suggested from your text — edit anytime to override">✨ AI suggested</span>
            </label>
            <input
              id="sem-owner-name"
              v-model="ownerNameInput"
              type="text"
              maxlength="80"
              class="w-full rounded-lg border-2 border-indigo-200 bg-white px-3 py-2.5 text-base font-bold
                     text-slate-900 placeholder-gray-400 placeholder:font-normal placeholder:text-sm
                     shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                     transition-colors duration-150"
              placeholder="e.g. Tom Gilb"
              title="Plan owner — added as the first Owner in the plan's stewards. Leave blank to add later."
            />
          </div>
        </div>

        <!-- Imported-document badge -->
        <div
          v-if="importSource && rawInput"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700"
        >
          <span aria-hidden="true">📎</span>
          <span class="truncate flex-1">Imported: <strong>{{ importSource }}</strong></span>
          <button
            type="button"
            class="text-emerald-400 hover:text-emerald-700 focus:outline-none"
            aria-label="Clear imported document"
            title="Clear"
            @click="importSource = ''; rawInput = ''"
          >✕</button>
        </div>

        <!-- r41 v76 (Tom Gilb 2026-06-16 verbatim "put the file input button
             right next to the aperture, or a click in the aperture") — the
             file input is now AT the aperture itself.  Wrapped in a
             relative-positioned container with:
               (a) a small 📎 paperclip pin floating in the top-right corner —
                   tap to open the file picker directly (no Import-panel
                   detour);
               (b) `@dragover.prevent @drop` on the wrapper — drop a file
                   anywhere on the textarea to import it (same handler as the
                   panel's file input);
               (c) a hidden `<input type="file">` triggered by the pin.
             The textarea placeholder now points at the inline pin (no longer
             at "📎 Import planning data above").  Composes with: MOVE
             Principle (file input is now visible AT the aperture, no menu-
             dive), DD-009 Interaction Disclosure (HoverHint + aria-label
             name the pin's behaviour), Tom-is-85 accessibility (large hit
             target on the pin). -->
        <div
          class="relative"
          @dragover.prevent="_apertureDragHover = true"
          @dragenter.prevent="_apertureDragHover = true"
          @dragleave="_apertureDragHover = false"
          @drop.prevent="onApertureDrop"
        >
          <!-- r41 2026-06-20 (Tom Gilb verbatim "MAKE THE WINDOW MUCH BROADER")
               — rows + resize attributes lift when an external document is
               imported.  rows="14" gives ~2× vertical space; `resize-y`
               lets the planner drag-tall if they want even more.  pr-14
               (reserves space for the 📎 pin) becomes pb-12 when scrollable
               (reserves space for the bottom ⬆ Top / ⬇ Bottom jump
               buttons). -->
          <!-- r41 2026-06-20 (Tom Gilb verbatim "the bottom should not require
               me to scroll to see it") — textarea now respects viewport
               height with `max-h-[45vh]` so it never pushes the Parse
               button off-screen.  Imported mode still gets generous rows
               (~14) + user-resizable, but capped at 45 % of viewport
               height so the form footer (Parse button) always fits below
               in normal viewport sizes.  Composes with: MOVE Principle
               (primary action visible), accessibility_tom.md (Tom 85 — no
               scrolling required to find the next step). -->
          <!-- r41 v348 (Tom Gilb 2026-06-25 verbatim *"damn, input disappeared"*):
               always-visible recovery affordance.  When the textarea is empty
               AND a recent draft exists in localStorage (either the SEM_DRAFT_KEY
               continuous-persistence layer OR the Input Safety Net snapshot),
               surface a one-click "Restore" button.  Belt-and-braces over the
               two existing auto-restore layers (onMounted line ~532 and line
               ~565) which only fire on COMPONENT REMOUNT — they don't help if
               rawInput cleared in place (Clean Slate menu, accidental select-
               all-delete, etc).  Composes with: No-Silent-Data-Loss SUPREME +
               Universal Undo SUPREME + accessibility_tom.md ("never punish a
               user with re-typing"). -->
          <div
            v-if="!rawInput && recoverableDraftLength > 0"
            class="mb-2 px-3 py-2 rounded-lg border-2 border-amber-400 bg-amber-50 flex items-center gap-2 shadow-sm"
          >
            <span class="text-base shrink-0" aria-hidden="true">📦</span>
            <span class="text-xs text-amber-900 flex-1 leading-tight">
              <strong>Last typed input recoverable</strong>
              ({{ recoverableDraftLength }} characters from {{ recoverableDraftAgeLabel }}).
            </span>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Restore last typed input"
              title="Click to restore the text you previously had in this input — preserved automatically by the Input Safety Net + continuous draft layers."
              @click="restoreLastDraft"
            >Restore</button>
            <button
              type="button"
              class="px-2 py-1 rounded-md text-xs text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
              aria-label="Dismiss recovery prompt"
              title="Discard the recoverable draft and dismiss this prompt"
              @click="dismissRecovery"
            >Dismiss</button>
          </div>

          <textarea
            id="sem-raw-input"
            ref="_apertureTextareaRef"
            v-model="rawInput"
            :rows="(importSource && rawInput) ? 14 : 7"
            class="w-full rounded-xl border bg-white px-4 py-3 pr-16 text-sm
                   text-gray-900 placeholder-gray-400 shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                   transition-colors duration-150"
            :class="[
              _apertureDragHover ? 'border-emerald-500 ring-2 ring-emerald-300 bg-emerald-50/30' : 'border-gray-300',
              (importSource && rawInput) ? 'resize-y min-h-[280px] max-h-[45vh]' : 'resize-none',
              '',  // r41 v273 — pb-12 removed: Top/Bottom buttons moved OUT of overlay zone into row-below per Tom-Repeats v272 lesson.
            ]"
            :placeholder="_apertureDragHover
              ? '📎 Drop your file here…'
              : 'Put your specifications here (type, paste, or talk via 🎙 mic) — or tap the 📎 pin on the right to attach a file.\ne.g. reduce churn 30% · ship faster · cut onboarding to 1 day'"
            aria-label="Project specifications — type, paste, or talk; tap the 📎 pin to attach a file, or drop a file directly on this aperture"
            @keydown.enter.ctrl="parseManual"
            @keydown.enter.meta="parseManual"
            @paste="() => nextTick(parseManual)"
          />
          <!-- 📎 file-pin in the top-right corner — opens the file picker.
               r41 v282 (Tom Gilb 2026-06-22 "paper clip symbol need more
               contrast and size") — bumped from h-9 w-9 (36px) + text-lg +
               bg-emerald-100 (light-on-light, paperclip emoji blended into
               pale green bg) → h-12 w-12 (48px hit target) + text-3xl +
               bg-white with strong bg-emerald-600 ring (paperclip emoji's
               natural metallic colors now have white backdrop for maximum
               contrast + stronger ring frames it).  Composes with DD-017
               SUPREME (contrast on background) + universal accessibility
               (every reader benefits from larger + higher-contrast affordance). -->
          <button
            type="button"
            class="absolute top-2.5 right-2.5 h-12 w-12 flex items-center justify-center rounded-full
                   bg-white hover:bg-emerald-50
                   ring-2 ring-emerald-600 hover:ring-emerald-700 shadow-md
                   focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all
                   text-3xl leading-none"
            :title="'📎 Attach a file (.pdf, .docx, .txt, .md, .csv, .rtf, .html) — or drop one directly on the aperture above'"
            aria-label="Attach a file"
            @click="_apertureFileInputRef?.click()"
          >📎</button>
          <!-- Hidden file input — wired to the same handleFileImportDoc that
               the Import-planning-data panel uses, so a file picked here
               flows through the EXACT same parse pipeline. -->
          <input
            ref="_apertureFileInputRef"
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.rtf,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,text/rtf,text/html"
            class="sr-only"
            :disabled="importLoading"
            @change="handleFileImportDoc"
          />

        </div>

        <!-- r41 v273 (Tom Gilb 2026-06-22 verbatim "bottom collision many reports, not fixed")
             — SIXTH overlap report.  Prior fixes (v260 PageScrollPin / v266 aperture pin /
             v272 page bottom-padding) addressed PARTS of the same lesson: overlay widgets
             collide with content unless layout space is reserved.  v266 used the same
             group-hover trick that didn't fix the visual overlap (only click-through).
             v273 applies the v272 LAYOUT-RESERVATION lesson properly to this site: MOVE
             the Top/Bottom buttons OUT of the textarea's absolute overlay zone into a
             dedicated flex row BELOW the textarea.  No more overlap possible — the buttons
             have their own layout slot and the textarea's text never enters their zone.
             Composes with: Tom-Repeats-Himself SUPREME (6th overlap report), v272 layout-
             reservation lesson (the structural fix, not another hover trick), MOVE Principle
             (jump option still visible at-a-glance), accessibility_tom.md (32px hit targets
             remain), Icon-Plus-Text SUPREME (glyph + text labels preserved). -->
        <div
          v-if="_apertureIsScrollable"
          class="flex items-center justify-end gap-1.5 mt-1"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1 h-8 px-2.5 rounded-full
                   bg-slate-700 text-white hover:bg-slate-800 ring-1 ring-slate-300
                   focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-md
                   text-[11px] font-bold transition-colors"
            title="⬆ Jump to TOP of the document"
            aria-label="Jump to top of document"
            @click="scrollApertureToTop"
          >
            <span aria-hidden="true">⬆</span>
            <span>Top</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 h-8 px-2.5 rounded-full
                   bg-slate-700 text-white hover:bg-slate-800 ring-1 ring-slate-300
                   focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-md
                   text-[11px] font-bold transition-colors"
            title="⬇ Jump to BOTTOM of the document"
            aria-label="Jump to bottom of document"
            @click="scrollApertureToBottom"
          >
            <span aria-hidden="true">⬇</span>
            <span>Bottom</span>
          </button>
        </div>

        <p v-if="parseError" class="text-xs text-red-600" role="alert">{{ parseError }}</p>

        <!-- Ultra Light Fork Bar (Evo Step 5 — 2026-05-17): rich menus added.
             Menu forks toggle activeForkMenu; direct forks fire immediately.
             activeMenuForkId suppresses the HoverHint for the active menu fork so
             the HoverHint (z-[340]) does not cover the fork menu (z-auto). -->
        <ForkBar
          v-if="ultraLightEnabled"
          class="mt-1"
          :active-menu-fork-id="activeForkMenu"
          @fork="onFork"
        />

        <!-- ── Fork action menus (input stage) ── -->
        <template v-if="ultraLightEnabled && activeForkMenu !== null && stage === 'input'">

          <!-- Refine menu — input stage -->
          <div
            v-if="activeForkMenu === 'refine'"
            class="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
            role="menu"
            aria-label="Refine options"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-600">
              <span class="text-[11px] font-bold uppercase tracking-widest text-slate-300">Refine</span>
              <span class="ml-auto text-[10px] text-slate-400">tighten what you have</span>
            </div>
            <div class="divide-y divide-slate-100">
              <button type="button" role="menuitem" @click="forkParseAgain"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🔄</span>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Parse again</p>
                  <p class="text-[11px] text-slate-500">Re-classify your input from scratch — picks up anything the first pass missed</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkOpenTemplates"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📋</span>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Browse example plans</p>
                  <p class="text-[11px] text-slate-500">Open the template library for phrasing inspiration before re-parsing</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Improve menu — input stage -->
          <div
            v-if="activeForkMenu === 'improve'"
            class="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
            role="menu"
            aria-label="Improve options"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-700 to-indigo-600">
              <span class="text-[11px] font-bold uppercase tracking-widest text-indigo-200">Improve</span>
              <span class="ml-auto text-[10px] text-indigo-300">push further</span>
            </div>
            <div class="divide-y divide-slate-100">
              <button type="button" role="menuitem" @click="forkParseAgain"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">⚡</span>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Parse and go ahead</p>
                  <p class="text-[11px] text-slate-500">Classify now, then proceed directly to spec generation</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkOpenTemplates"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📋</span>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Try an example plan</p>
                  <p class="text-[11px] text-slate-500">Browse curated templates — each is a fully-formed Planguage starting point</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkSurpriseMe"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🎲</span>
                <div>
                  <p class="text-sm font-semibold text-slate-800">Surprise me</p>
                  <p class="text-[11px] text-slate-500">Propose a random pre-seeded plan — pick it up and make it yours</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Keep It Simple menu — input stage -->
          <div
            v-if="activeForkMenu === 'keepItSimple'"
            class="rounded-xl border border-amber-200 bg-amber-50 shadow-lg overflow-hidden"
            role="menu"
            aria-label="Keep It Simple options"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500">
              <span class="text-[11px] font-bold uppercase tracking-widest text-amber-100">Keep It Simple</span>
              <span class="ml-auto text-[10px] text-amber-200">quantify · focus · sacrifice</span>
            </div>
            <div class="divide-y divide-amber-100">
              <button type="button" role="menuitem" @click="forkOnepageSeed"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📄</span>
                <div>
                  <p class="text-sm font-semibold text-amber-900">One-page seed</p>
                  <p class="text-[11px] text-amber-700">Loads the "Main Simple Idea" template — one Stakeholder, one quantified Value, one Strategy. Fill the brackets and Go Ahead.</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkLordKelvinCheck"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🌡</span>
                <div>
                  <p class="text-sm font-semibold text-amber-900">Lord Kelvin test</p>
                  <p class="text-[11px] text-amber-700">Does your goal have a number? "If you quantify it, it becomes more intelligible." Scans your text for a numeric level.</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkScopeSacrifice"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">⚖</span>
                <div>
                  <p class="text-sm font-semibold text-amber-900">Scope Sacrifice</p>
                  <p class="text-[11px] text-amber-700">Write the single most important value first — everything else is secondary. Guides you toward a focused one-sentence goal.</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Show Me More menu — input stage -->
          <div
            v-if="activeForkMenu === 'showMeMore'"
            class="rounded-xl border border-violet-200 bg-violet-50 shadow-lg overflow-hidden"
            role="menu"
            aria-label="Show Me More options"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-700 to-violet-600">
              <span class="text-[11px] font-bold uppercase tracking-widest text-violet-200">Show Me More</span>
              <span class="ml-auto text-[10px] text-violet-300">explore & discover</span>
            </div>
            <div class="divide-y divide-violet-100">
              <button type="button" role="menuitem" @click="forkOpenTemplates"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-violet-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📋</span>
                <div>
                  <p class="text-sm font-semibold text-violet-900">Browse example plans</p>
                  <p class="text-[11px] text-violet-700">Full template library — each plan shows what a good Planguage brief looks like</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkSurpriseMe"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-violet-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🎲</span>
                <div>
                  <p class="text-sm font-semibold text-violet-900">Surprise me</p>
                  <p class="text-[11px] text-violet-700">Random plan seed to spark ideas — pick it up and make it yours</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Start Fresh menu — input stage -->
          <div
            v-if="activeForkMenu === 'startFresh'"
            class="rounded-xl border border-rose-200 bg-rose-50 shadow-lg overflow-hidden"
            role="menu"
            aria-label="Start Fresh options"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-700 to-rose-600">
              <span class="text-[11px] font-bold uppercase tracking-widest text-rose-200">Start Fresh</span>
              <span class="ml-auto text-[10px] text-rose-300">graduated reset</span>
            </div>
            <div class="divide-y divide-rose-100">
              <button type="button" role="menuitem" @click="forkOpenTemplates"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📋</span>
                <div>
                  <p class="text-sm font-semibold text-rose-900">Choose a template</p>
                  <p class="text-[11px] text-rose-700">Replace what you have with a curated starting point</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkSurpriseMe"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🎲</span>
                <div>
                  <p class="text-sm font-semibold text-rose-900">Surprise me</p>
                  <p class="text-[11px] text-rose-700">Replace with a random scenario — a clean break from the current direction</p>
                </div>
              </button>
              <button type="button" role="menuitem" @click="forkClearEverything"
                class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
                <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🧹</span>
                <div>
                  <p class="text-sm font-semibold text-rose-900">Clear everything</p>
                  <p class="text-[11px] text-rose-700">Wipe all text and return to a blank slate — the most complete reset</p>
                </div>
              </button>
            </div>
          </div>

        </template>

        <p class="text-xs text-gray-400">
          <span aria-hidden="true">💡</span>
          Tip: turn on mic → talk freely, say "done" when finished. Or just type and press Ctrl+Enter.
        </p>
      </div>

      <!-- r41 2026-06-20 (Tom Gilb verbatim "The parse my input is still at
           bottom out of sight unless i scroll. I asked to make it always
           visible") — `sticky bottom-2` doesn't help when the button's
           natural position starts BELOW the fold: sticky only kicks in
           AFTER the element scrolls into view, then stays put.  For "always
           visible from the first render regardless of scroll position",
           need FIXED positioning relative to the viewport.

           Solution: wrap the button in a `fixed bottom-4 inset-x-0` band
           centred at max-w-7xl (matching the form's content width), with
           `flex justify-center` to centre the button.  The button itself
           caps at max-w-2xl so it's a comfortable click-target on wide
           viewports without spanning the full content width.  Pointer-
           events on the outer band are off so the band doesn't block
           clicks on content behind it; the button re-enables them.

           Added `pb-24` spacer at the bottom of the form below this fixed
           band so the natural form flow has clearance from the fixed
           button (otherwise the textarea / fork bar could be hidden behind
           it when scrolled).

           Composes with: MOVE Principle (primary action ALWAYS visible
           from first paint), DD-009 Zero-Training UI, accessibility_tom.md
           (Tom 85 — never scroll to find the next action), Desktop-First
           Responsive Design rule (max-w-7xl band matches content; iPhone
           unaffected since viewport < 7xl).  PageScrollPin (now bottom-
           LEFT) doesn't compete since the Parse button is centred.

           v-if="showStickyBars" (Tom Gilb 2026-06-20 STAGE-2-LEAK fix) —
           the Parse bar must NOT show when this form mounts as a fallback
           at Stages 2-11 (currentSpec is null but the planner is past the
           input phase).  App.vue passes false at every non-Stage-1 mount. -->
      <div v-if="showStickyBars" class="fixed inset-x-0 bottom-4 z-30 pointer-events-none flex justify-center px-4">
        <div class="w-full max-w-2xl pointer-events-auto">
          <button
            id="sem-parse-btn"
            type="button"
            class="w-full min-h-[52px] rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-bold
                   text-white shadow-2xl hover:bg-indigo-700 ring-2 ring-indigo-300
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-indigo-600 transition-colors duration-150"
            aria-label="Parse my input"
            title="Parse my input — sends what you typed or imported to the AI for spec generation"
            @click="parseManual"
          >
            Parse my input
            <span aria-hidden="true"> →</span>
          </button>
        </div>
      </div>
      <!-- Spacer so the natural-flow form content doesn't get hidden
           behind the fixed Parse button band above. -->
      <div class="h-24" aria-hidden="true"></div>

    </template>

    <!-- ══════════════════════════════════════════════════════════════════════
         STAGE 2 — Review & Edit
         ══════════════════════════════════════════════════════════════════════ -->
    <template v-else>

      <!-- Source title bar — shown when content came from a tool, not manual typing -->
      <div
        v-if="inputSource === 'surprise'"
        class="flex items-center gap-3 -mx-4 px-4 py-2.5
               bg-gradient-to-r from-violet-600 to-purple-600"
        aria-label="Surprise me — randomly generated scenario"
      >
        <span class="text-lg shrink-0" aria-hidden="true">🎲</span>
        <div class="min-w-0">
          <p class="text-white font-semibold text-sm leading-tight">Surprise me</p>
          <p class="text-white/70 text-[11px] leading-tight">Randomly generated scenario — edit anything before generating your spec</p>
        </div>
      </div>
      <div
        v-else-if="inputSource === 'template'"
        class="flex items-center gap-3 -mx-4 px-4 py-2.5
               bg-gradient-to-r from-indigo-600 to-sky-600"
        aria-label="Template — pre-filled from a saved template"
      >
        <span class="text-lg shrink-0" aria-hidden="true">📋</span>
        <div class="min-w-0">
          <p class="text-white font-semibold text-sm leading-tight">Template</p>
          <p class="text-white/70 text-[11px] leading-tight">Pre-filled from a saved template — edit anything before generating your spec</p>
        </div>
      </div>

      <!-- Header -->
      <div class="flex items-center gap-3">
        <img
          src="/icon-sem-app.svg"
          alt="SEM App logo"
          :title="`SEM App — Keeney three-level hierarchy (Value-Focused Thinking, 1992)\n\n▲ FUNDAMENTAL · amber\n  Objectives given from above — environment, parent org, regulations\n  We operate within these; cannot unilaterally redesign them\n\n● STRATEGIC · violet  ← this level (the hero row)\n  Our own plan — the Ends and Values we own and are accountable for\n\n▼ MEANS · emerald\n  What supports us from below — Functions and Solutions\n  These deliver our Strategic Ends upward to the stakeholder\n\n──────────────────────────────\nperson / §  =  Stakeholder (animate or inanimate)\n←O←         =  End: target that receives and delivers value\nO←          =  Means: source that fires value into the target`"
          class="h-10 w-10 shrink-0 rounded-xl shadow-sm cursor-help"
        />
        <div>
          <h1 ref="reviewHeadingRef" class="text-2xl font-semibold text-gray-900 scroll-mt-[180px]">Does this look right?</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Edit any item by clicking it, remove with <span aria-hidden="true">×</span>,
            or add more. Say item names or "add" to a section.
          </p>
        </div>
      </div>

      <!-- ── Plan Name + Owner Name — also visible at review stage (Tom Gilb
           2026-06-16 verbatim "we are in stage 1 and I can neither see nor
           enter the plancontract title or owner").  These bindings are
           shared with the input-stage inputs (planNameInput / ownerNameInput
           refs) so anything typed earlier is pre-filled here; anything
           changed here flows into the same payload at Generate Spec time. -->
      <!-- r41 v67 — review-stage Plan/Contract Name input matched to input-
           stage prominence (Tom Gilb 2026-06-16 "like the spec tags it needs
           to be fairly prominent" + "yes of course both!" — both surfaces). -->
      <div class="flex gap-3">
        <div class="flex-1">
          <label for="sem-plan-name-review" class="block text-sm font-bold text-slate-700 mb-1">
            Plan / Contract Name <span class="text-gray-400 font-normal text-xs">(optional — auto-derived if blank)</span>
          </label>
          <input
            id="sem-plan-name-review"
            v-model="planNameInput"
            type="text"
            maxlength="120"
            class="w-full rounded-lg border-2 border-indigo-300 bg-white px-3 py-2.5 text-xl font-extrabold
                   text-slate-900 placeholder-gray-400 placeholder:font-normal placeholder:text-base
                   shadow-sm underline underline-offset-4 decoration-2 decoration-indigo-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                   transition-colors duration-150"
            placeholder="e.g. Improve Crew Retention 2026"
            title="Plan/Contract name — used as the plan's title at the top.  Leave blank to auto-derive from your spec content."
          />
        </div>
        <div class="w-60">
          <label for="sem-owner-name-review" class="block text-sm font-bold text-slate-700 mb-1">
            Owner Name <span class="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            id="sem-owner-name-review"
            v-model="ownerNameInput"
            type="text"
            maxlength="80"
            class="w-full rounded-lg border-2 border-indigo-200 bg-white px-3 py-2.5 text-base font-bold
                   text-slate-900 placeholder-gray-400 placeholder:font-normal placeholder:text-sm
                   shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                   transition-colors duration-150"
            placeholder="e.g. Tom Gilb"
            title="Plan owner — added as the first Owner in the plan's stewards.  Leave blank to add later."
          />
        </div>
      </div>

      <!-- ── Move command bar ─────────────────────────────────────────────────
           Tom 2026-05-15: "orally Move [Name of Item] to [Stakeholders,
           Values, Solutions]" — type e.g. "Move cabin to Values" + Enter.
           Fuzzy substring match, accepts synonyms (solutions = means).
           r41 v318: kept ABOVE the grid (acts across all 4 windows). -->
      <div class="flex items-center gap-2 px-3 py-2 rounded-xl
                  border border-dashed border-gray-200 bg-gray-50/70">
        <span class="text-gray-300 text-base shrink-0" aria-hidden="true">⇄</span>
        <input
          v-model="moveCmd"
          type="text"
          placeholder='Move "item" to Stakeholders / Values / Means…'
          class="flex-1 min-w-0 bg-transparent text-sm text-gray-700
                 placeholder-gray-300 focus:outline-none"
          aria-label="Move command: type Move [item] to [group] and press Enter"
          @keydown.enter.prevent="processMoveCmd"
          @keydown.escape="moveCmd = ''"
        />
        <button
          v-if="moveCmd.trim()"
          type="button"
          class="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800
                 focus:outline-none focus:underline"
          @click="processMoveCmd"
        >Move →</button>
      </div>

      <!-- r41 v320 — provenance-flash discoverability hint (Tom Gilb 2026-06-24
           "of course you need to tell users they can select any S E M to see the
           source"). Visible only on lg: where the 4 windows are side-by-side and
           the flash effect is visible. Mobile/narrow stacks vertically so the
           hint is unnecessary there. -->
      <div class="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg
                  bg-indigo-50/70 border border-indigo-200/60
                  text-[12px] text-indigo-900">
        <span class="text-base shrink-0" aria-hidden="true">💡</span>
        <span>Click any chip below to highlight its source in the <strong>Your original words</strong> window.</span>
      </div>

      <!-- r41 v318 (Tom Gilb 2026-06-24 "all 4 on a single screen page"): 4-column
           grid on lg: — Your original words · Stakeholders · Values · Means.
           Mobile/narrow falls back to vertical stack (single-scroll, preserves all
           chip + move semantics). v317 was 3-col (original-words still on top);
           v318 brings original-words INTO the grid as cell #1, fulfilling the
           2026-06-19 "4 windows on one screen" design. -->
      <div class="grid grid-cols-1 lg:grid-cols-4 lg:gap-4 lg:items-start">

      <!-- ── Window 1: Original input — first cell on lg: (was above-grid in v317) -->
      <!-- `open` by default so users immediately see their original words;
           they can collapse it if they prefer. Tom 2026-05-17 bug: blank display
           was because the <details> needed expanding — fixed by defaulting open. -->
      <details
        class="rounded-xl border border-gray-200 bg-gray-50 text-sm lg:bg-slate-50/40 lg:border-slate-200"
        :open="rawInputDetailsOpen"
        @toggle="(e) => { rawInputDetailsOpen = (e.target as HTMLDetailsElement).open }"
      >
        <summary
          class="flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer
                 select-none list-none text-gray-500 hover:text-gray-700
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
          aria-label="Toggle original input"
        >
          <span class="flex items-center gap-1.5 font-medium">
            <span aria-hidden="true">📝</span> Your original words
          </span>
          <span class="flex items-center gap-3">
            <button
              type="button"
              class="text-xs text-indigo-600 hover:underline focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
              aria-label="Edit original input"
              @click.stop="stage = 'input'"
            >Edit <EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /></button>
            <span aria-hidden="true" class="text-gray-400 text-xs">▾</span>
          </span>
        </summary>

        <!-- r41 v326 (Tom Gilb 2026-06-24 verbatim "BUTTON 'SEE IF OTHER
             INSTANCES, AND COUNT THEM' AND SHOW THEM"): cycle-through button.
             Visible only when a chip is currently flashed AND there is more
             than one candidate match in the source.  Click cycles to the next
             match; wraps back to 1 after the last.  Solves the v324 limitation
             "heuristic CAN match the wrong line if multiple lines share the
             chip significant words" — the planner can now hunt every
             alternative without leaving the panel. -->
        <!-- r41 v340 (Tom Gilb 2026-06-24 "the yellow marker did not work at
             all"): status banner now visible on EVERY chip click — not only
             when multiple matches exist.  Three rendered states:
               • allMatches.length > 1  → "Match N of M" + "See next match"
               • allMatches.length === 1 → "Match 1 of 1 — highlighted below"
               • allMatches.length === 0 → "No source match for this chip"
             A 0-match state used to be silent (chip clicked, nothing visible).
             Tom's "did not work at all" was symptomatic of the 0-match silent
             path: heuristic found no match, no yellow rendered, no banner,
             no signal to the user that anything happened.  The banner is the
             always-visible feedback channel. -->
        <div
          v-if="flashingChipText"
          class="flex items-center justify-between gap-2 px-4 py-1.5 bg-amber-50 border-y border-amber-200/70 text-[11px]"
        >
          <span class="text-amber-900">
            <template v-if="allMatches.length > 1">
              <span class="font-bold">Match {{ currentMatchIdx + 1 }} of {{ allMatches.length }}</span>
              <span class="text-amber-700 ml-1">in the source</span>
            </template>
            <template v-else-if="allMatches.length === 1">
              <span class="font-bold">Match 1 of 1</span>
              <span class="text-amber-700 ml-1">— highlighted below</span>
            </template>
            <template v-else>
              <span class="font-bold text-rose-800">No source match for this chip.</span>
              <span class="text-rose-700 ml-1">The wording may be AI-paraphrased; try editing the chip to a phrase from your text.</span>
            </template>
          </span>
          <button
            v-if="allMatches.length > 1"
            type="button"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-200 hover:bg-amber-300
                   text-amber-950 font-semibold border border-amber-400/60 shadow-sm
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label="Show the next occurrence of this chip in the original source"
            title="Cycle to the next match. The heuristic ranks matches best-first; if Match 1 looks wrong, click here to scroll to the next candidate."
            @click="cycleToNextMatch"
          >
            <span aria-hidden="true">↻</span>
            <span>See next match</span>
          </button>
        </div>

        <!-- Inner div: bounded scroll. On lg: matches the type-window height
             (60vh minus summary row); on narrow screens the original 40vh cap
             keeps a long contract paste from dominating the page.  v326: the
             match indicator + cycle button live ABOVE this scroll container
             so they stay visible as the planner scrolls the source. -->
        <div ref="rawInputContainerRef" class="px-4 pb-4 pt-1 max-h-[40vh] lg:max-h-[55vh] overflow-y-auto text-sm text-gray-700 leading-relaxed break-words">
          <div
            v-for="(line, idx) in rawInputLines"
            :key="idx"
            :data-line-idx="idx"
            class="whitespace-pre-wrap"
          ><template v-if="flashMatch && flashMatch.lineIdx === idx"><span>{{ line.substring(0, flashMatch.start) }}</span><span class="bg-yellow-300 ring-2 ring-amber-500 rounded px-0.5 font-bold text-amber-950 shadow-sm">{{ line.substring(flashMatch.start, flashMatch.end) }}</span><span>{{ line.substring(flashMatch.end) }}</span></template><template v-else>{{ line || ' ' }}</template></div>
        </div>
      </details>

      <!-- ── Window 2: Who (Stakeholders) ──────────────────────────────────── -->
      <section aria-labelledby="section-who" class="lg:max-h-[60vh] lg:overflow-y-auto lg:border lg:border-slate-200 lg:rounded-xl lg:p-3 lg:bg-slate-50/40">
        <h2 id="section-who" class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2 lg:sticky lg:top-0 lg:z-10 lg:bg-slate-50 lg:-mx-3 lg:px-3 lg:py-2 lg:border-b lg:border-slate-200/70 lg:rounded-t-lg">
          <span><span aria-hidden="true">👤</span> Who and What 'Needs results' — Stakeholders</span>
          <!-- Drop zone: visible when a chip from another group is selected for moving -->
          <button
            v-if="movingChip && movingChip.group !== 'stakeholders'"
            type="button"
            class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
                   bg-indigo-600 text-white animate-pulse shadow-sm
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Move selected item to Stakeholders"
            @click="commitMove('stakeholders')"
          >⇄ Move here</button>
          <button
            v-if="movingChip && movingChip.group !== 'stakeholders'"
            type="button"
            class="text-gray-300 hover:text-gray-500 text-base focus:outline-none"
            aria-label="Cancel move"
            @click="cancelMove"
          >✕</button>
        </h2>

        <div class="flex flex-wrap gap-2">
          <template v-for="(item, i) in parsedStakeholders" :key="`who-${i}`">
            <!-- Editing chip -->
            <div v-if="editingChip?.group === 'stakeholders' && editingChip.index === i"
                 class="flex items-center gap-1">
              <input
                :id="`chip-edit-stakeholders-${i}`"
                v-model="editingText"
                type="text"
                class="h-9 rounded-full border border-indigo-400 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Edit stakeholder"
                @keydown.enter.prevent="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
              />
            </div>
            <!-- Static chip — amber ring when this chip is selected for moving.
                 max-w-[360px] overflow-hidden: caps pill width; text button uses
                 flex-1 min-w-0 truncate so overlong text shows ellipsis.
                 :title on the button gives the native HoverHint with full text. -->
            <div
              v-else
              :data-suggested-chip="isAcceptedSuggestion(item) ? 'stakeholders' : null"
              class="flex items-center gap-1 h-9 pl-3 pr-1 rounded-full
                     border text-sm transition-all max-w-[360px] overflow-hidden"
              :class="movingChip?.group === 'stakeholders' && movingChip.index === i
                ? 'border-amber-400 ring-2 ring-amber-300 ring-offset-1 bg-amber-50 text-amber-900'
                : isAcceptedSuggestion(item)
                  ? 'border-violet-500 bg-violet-200 text-violet-900 ring-2 ring-violet-400'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-800'"
              :title="isAcceptedSuggestion(item) ? renderAcceptedSuggestionHoverHint(item) : item"
            >
              <!-- r41 v395 — ✨ badge marks AI-suggested origin unmistakably,
                   regardless of column-default vs violet contrast.  Composes with
                   Icon-Plus-Text SUPREME (badge + text label both present). -->
              <span
                v-if="isAcceptedSuggestion(item)"
                aria-hidden="true"
                class="text-[12px] leading-none -mr-0.5 select-none"
                :title="renderAcceptedSuggestionHoverHint(item)"
              >✨</span>
              <button
                type="button"
                class="flex-1 min-w-0 truncate focus:outline-none hover:text-indigo-600 text-left"
                :class="isAcceptedSuggestion(item) ? 'hover:text-violet-700 text-violet-900' : ''"
                :aria-label="`Edit stakeholder: ${item}${isAcceptedSuggestion(item) ? ' (AI-suggested, accepted by ' + props.acceptedSuggestionActor + ')' : ''}`"
                :title="item"
                @click="startEdit('stakeholders', i)"
              >{{ item }}</button>
              <!-- ⇄ Move button -->
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full text-indigo-300
                       hover:bg-indigo-100 hover:text-indigo-600 focus:outline-none transition-colors"
                :aria-label="`Move '${item}' to another group`"
                @click.stop="movingChip?.group === 'stakeholders' && movingChip.index === i
                  ? cancelMove()
                  : startMove('stakeholders', i)"
              >
                <span aria-hidden="true" class="text-[11px]">⇄</span>
              </button>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full
                       hover:bg-indigo-200 text-indigo-500 focus:outline-none"
                :aria-label="`Remove stakeholder: ${item}`"
                @click="removeChip('stakeholders', i)"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </template>

          <!-- Add chip input -->
          <div v-if="addingTo === 'stakeholders'" class="flex items-center gap-1">
            <input
              id="chip-add-stakeholders"
              v-model="addingText"
              type="text"
              class="h-9 rounded-full border border-indigo-400 px-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Say it or type…"
              aria-label="New stakeholder"
              @keydown.enter.prevent="commitAdd"
              @keydown.escape="cancelAdd"
              @blur="commitAdd"
            />
          </div>

          <!-- Add button -->
          <button
            v-else
            type="button"
            class="h-9 px-3 rounded-full border border-dashed border-indigo-300
                   text-indigo-500 text-sm hover:bg-indigo-50
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Add stakeholder"
            @click="startAdd('stakeholders')"
          >
            <span aria-hidden="true">+</span> Add
          </button>
        </div>

        <p v-if="parsedStakeholders.length === 0 && addingTo !== 'stakeholders'"
           class="text-xs text-gray-400 mt-1 italic">
          None detected — optional, but useful.
        </p>
      </section>

      <!-- ── S·E·M Connector: S → E ─────────────────────────────────────────────
           P4 (2026-05-27): parse arrow (S→E, indigo dashed) + augment arrow
           (E→S, emerald dashed). Visual teaching of the Planguage Ends-Means chain.
           aria-hidden: purely decorative — screen readers skip this.
           r41 v317 (Tom 2026-06-24): hidden on lg: where sections become horizontal
           columns — vertical-stack-only arrows don't make sense in a grid layout. -->
      <div class="flex items-center gap-3 py-0.5 lg:hidden" aria-hidden="true" role="presentation">
        <div class="flex-1 border-t border-dashed border-gray-100" />
        <div class="flex flex-col items-center gap-0.5 shrink-0">
          <div class="flex items-center gap-1">
            <span class="text-[9px] font-extrabold font-mono text-indigo-300 select-none">S</span>
            <svg width="40" height="14" viewBox="0 0 40 14" fill="none" aria-hidden="true">
              <!-- Parse arrow: S → E (top, indigo dashed, left-to-right) -->
              <line x1="0" y1="4" x2="30" y2="4" stroke="#a5b4fc" stroke-width="1.5" stroke-dasharray="3 2" stroke-linecap="round"/>
              <path d="M 27,1.5 L 31,4 L 27,6.5" stroke="#a5b4fc" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
              <!-- Augment arrow: E → S (bottom, emerald dashed, right-to-left) -->
              <line x1="40" y1="10" x2="10" y2="10" stroke="#6ee7b7" stroke-width="1" stroke-dasharray="2 2" stroke-linecap="round"/>
              <path d="M 13,7.5 L 9,10 L 13,12.5" stroke="#6ee7b7" stroke-width="1" fill="none" stroke-linejoin="round"/>
            </svg>
            <span class="text-[9px] font-extrabold font-mono text-emerald-300 select-none">E</span>
          </div>
          <span class="text-[7px] text-gray-200 tracking-[0.12em] leading-none select-none">PARSE · AUGMENT</span>
        </div>
        <div class="flex-1 border-t border-dashed border-gray-100" />
      </div>

      <!-- ── How Well (Values / Goals) ───────────────────────────────────────── -->
      <section aria-labelledby="section-what" class="lg:max-h-[60vh] lg:overflow-y-auto lg:border lg:border-slate-200 lg:rounded-xl lg:p-3 lg:bg-slate-50/40">
        <h2 id="section-what" class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2 lg:sticky lg:top-0 lg:z-10 lg:bg-slate-50 lg:-mx-3 lg:px-3 lg:py-2 lg:border-b lg:border-slate-200/70 lg:rounded-t-lg">
          <span><span aria-hidden="true">📊</span> How Well — Goals &amp; Values</span>
          <button
            v-if="movingChip && movingChip.group !== 'values'"
            type="button"
            class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
                   bg-emerald-600 text-white animate-pulse shadow-sm
                   hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Move selected item to Values"
            @click="commitMove('values')"
          >⇄ Move here</button>
          <button
            v-if="movingChip && movingChip.group !== 'values'"
            type="button"
            class="text-gray-300 hover:text-gray-500 text-base focus:outline-none"
            aria-label="Cancel move"
            @click="cancelMove"
          >✕</button>
        </h2>

        <div class="flex flex-wrap gap-2">
          <template v-for="(item, i) in parsedValues" :key="`what-${i}`">
            <div v-if="editingChip?.group === 'values' && editingChip.index === i"
                 class="flex items-center gap-1">
              <input
                :id="`chip-edit-values-${i}`"
                v-model="editingText"
                type="text"
                class="h-9 rounded-full border border-emerald-400 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Edit goal"
                @keydown.enter.prevent="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
              />
            </div>
            <div
              v-else
              :data-suggested-chip="isAcceptedSuggestion(item) ? 'values' : null"
              class="flex items-center gap-1 h-9 pl-3 pr-1 rounded-full border text-sm transition-all max-w-[360px] overflow-hidden"
              :class="movingChip?.group === 'values' && movingChip.index === i
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 ring-offset-1 text-amber-900'
                : isAcceptedSuggestion(item)
                  ? 'bg-violet-200 border-violet-500 text-violet-900 ring-2 ring-violet-400'
                  : isInferredEnd(item)
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'"
              :title="isAcceptedSuggestion(item)
                ? renderAcceptedSuggestionHoverHint(item)
                : isInferredEnd(item)
                  ? 'Inferred End — click to confirm or edit. Berlin slide 11: confusion of ends and means is the central danger.'
                  : undefined"
            >
              <!-- r41 v395 — ✨ badge marks AI-suggested origin unmistakably. -->
              <span
                v-if="isAcceptedSuggestion(item)"
                aria-hidden="true"
                class="text-[12px] leading-none -mr-0.5 select-none"
                :title="renderAcceptedSuggestionHoverHint(item)"
              >✨</span>
              <!-- Chip text button: flex-row so (?) badge stays outside the
                   truncation zone. flex-1 min-w-0 lets the text span shrink
                   and truncate; (?) is shrink-0 so it's never clipped. -->
              <button
                type="button"
                class="flex-1 min-w-0 flex items-center focus:outline-none text-left"
                :class="isAcceptedSuggestion(item)
                  ? 'hover:text-violet-700 text-violet-900'
                  : isInferredEnd(item) ? 'hover:text-amber-700' : 'hover:text-emerald-600'"
                :aria-label="isAcceptedSuggestion(item)
                  ? `Edit goal: ${item} (AI-suggested, accepted by ${props.acceptedSuggestionActor})`
                  : isInferredEnd(item)
                    ? `Edit inferred goal: ${stripInferredMarker(item)} (inferred — please confirm)`
                    : `Edit goal: ${item}`"
                :title="stripInferredMarker(item)"
                @click="startEdit('values', i)"
              >
                <span class="truncate min-w-0">{{ stripInferredMarker(item) }}</span>
                <span
                  v-if="isInferredEnd(item)"
                  class="shrink-0 ml-1 text-amber-600 font-semibold"
                  aria-hidden="true"
                >(?)</span>
              </button>
              <!-- ⇄ Move button -->
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full text-emerald-300
                       hover:bg-emerald-100 hover:text-emerald-600 focus:outline-none transition-colors"
                :aria-label="`Move '${stripInferredMarker(item)}' to another group`"
                @click.stop="movingChip?.group === 'values' && movingChip.index === i
                  ? cancelMove()
                  : startMove('values', i)"
              >
                <span aria-hidden="true" class="text-[11px]">⇄</span>
              </button>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full focus:outline-none"
                :class="isInferredEnd(item)
                  ? 'hover:bg-amber-200 text-amber-500'
                  : 'hover:bg-emerald-200 text-emerald-500'"
                :aria-label="`Remove goal: ${stripInferredMarker(item)}`"
                @click="removeChip('values', i)"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </template>

          <div v-if="addingTo === 'values'" class="flex items-center gap-1">
            <input
              id="chip-add-values"
              v-model="addingText"
              type="text"
              class="h-9 rounded-full border border-emerald-400 px-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Say it or type…"
              aria-label="New goal"
              @keydown.enter.prevent="commitAdd"
              @keydown.escape="cancelAdd"
              @blur="commitAdd"
            />
          </div>

          <button
            v-else
            type="button"
            class="h-9 px-3 rounded-full border border-dashed border-emerald-300
                   text-emerald-500 text-sm hover:bg-emerald-50
                   focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Add goal"
            @click="startAdd('values')"
          >
            <span aria-hidden="true">+</span> Add
          </button>
        </div>

        <p v-if="parsedValues.length === 0 && addingTo !== 'values'"
           class="text-xs text-red-500 mt-1 italic">
          At least one goal is required to generate a spec.
        </p>
      </section>

      <!-- ── S·E·M Connector: E → M ─────────────────────────────────────────────
           Same visual language as S→E connector above. Emerald→amber palette reflects
           the color shift: Values (emerald) → Means (amber / warm).
           r41 v317 (Tom 2026-06-24): hidden on lg: where sections become horizontal
           columns — vertical-stack-only arrows don't make sense in a grid layout. -->
      <div class="flex items-center gap-3 py-0.5 lg:hidden" aria-hidden="true" role="presentation">
        <div class="flex-1 border-t border-dashed border-gray-100" />
        <div class="flex flex-col items-center gap-0.5 shrink-0">
          <div class="flex items-center gap-1">
            <span class="text-[9px] font-extrabold font-mono text-emerald-300 select-none">E</span>
            <svg width="40" height="14" viewBox="0 0 40 14" fill="none" aria-hidden="true">
              <!-- Parse arrow: E → M (top, emerald dashed, left-to-right) -->
              <line x1="0" y1="4" x2="30" y2="4" stroke="#6ee7b7" stroke-width="1.5" stroke-dasharray="3 2" stroke-linecap="round"/>
              <path d="M 27,1.5 L 31,4 L 27,6.5" stroke="#6ee7b7" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
              <!-- Augment arrow: M → E (bottom, amber dashed, right-to-left) -->
              <line x1="40" y1="10" x2="10" y2="10" stroke="#fcd34d" stroke-width="1" stroke-dasharray="2 2" stroke-linecap="round"/>
              <path d="M 13,7.5 L 9,10 L 13,12.5" stroke="#fcd34d" stroke-width="1" fill="none" stroke-linejoin="round"/>
            </svg>
            <span class="text-[9px] font-extrabold font-mono text-amber-300 select-none">M</span>
          </div>
          <span class="text-[7px] text-gray-200 tracking-[0.12em] leading-none select-none">PARSE · AUGMENT</span>
        </div>
        <div class="flex-1 border-t border-dashed border-gray-100" />
      </div>

      <!-- ── How (Means / Strategies) ──────────────────────────────────────── -->
      <section aria-labelledby="section-how" class="lg:max-h-[60vh] lg:overflow-y-auto lg:border lg:border-slate-200 lg:rounded-xl lg:p-3 lg:bg-slate-50/40">
        <h2 id="section-how" class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2 lg:sticky lg:top-0 lg:z-10 lg:bg-slate-50 lg:-mx-3 lg:px-3 lg:py-2 lg:border-b lg:border-slate-200/70 lg:rounded-t-lg">
          <span><span aria-hidden="true">⚙️</span> How — Strategies &amp; Means</span>
          <button
            v-if="movingChip && movingChip.group !== 'means'"
            type="button"
            class="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
                   bg-amber-500 text-white animate-pulse shadow-sm
                   hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Move selected item to Means / Strategies"
            @click="commitMove('means')"
          >⇄ Move here</button>
          <button
            v-if="movingChip && movingChip.group !== 'means'"
            type="button"
            class="text-gray-300 hover:text-gray-500 text-base focus:outline-none"
            aria-label="Cancel move"
            @click="cancelMove"
          >✕</button>
        </h2>

        <div class="flex flex-wrap gap-2">
          <template v-for="(item, i) in parsedMeans" :key="`how-${i}`">
            <div v-if="editingChip?.group === 'means' && editingChip.index === i"
                 class="flex items-center gap-1">
              <input
                :id="`chip-edit-means-${i}`"
                v-model="editingText"
                type="text"
                class="h-9 rounded-full border border-amber-400 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label="Edit strategy"
                @keydown.enter.prevent="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
              />
            </div>
            <div
              v-else
              :data-suggested-chip="isAcceptedSuggestion(item) ? 'means' : null"
              class="flex items-center gap-1 h-9 pl-3 pr-1 rounded-full border text-sm transition-all max-w-[360px] overflow-hidden"
              :class="movingChip?.group === 'means' && movingChip.index === i
                ? 'bg-amber-50 text-amber-800 border-amber-400 ring-2 ring-amber-300 ring-offset-1'
                : isAcceptedSuggestion(item)
                  ? 'bg-violet-200 border-violet-500 text-violet-900 ring-2 ring-violet-400'
                  : 'bg-amber-50 text-amber-800 border-amber-200'"
              :title="isAcceptedSuggestion(item) ? renderAcceptedSuggestionHoverHint(item) : undefined"
            >
              <!-- r41 v395 — ✨ badge marks AI-suggested origin unmistakably. -->
              <span
                v-if="isAcceptedSuggestion(item)"
                aria-hidden="true"
                class="text-[12px] leading-none -mr-0.5 select-none"
                :title="renderAcceptedSuggestionHoverHint(item)"
              >✨</span>
              <button
                type="button"
                class="flex-1 min-w-0 truncate focus:outline-none text-left"
                :class="isAcceptedSuggestion(item) ? 'hover:text-violet-700 text-violet-900' : 'hover:text-amber-600'"
                :aria-label="`Edit strategy: ${item}${isAcceptedSuggestion(item) ? ' (AI-suggested, accepted by ' + props.acceptedSuggestionActor + ')' : ''}`"
                :title="item"
                @click="startEdit('means', i)"
              >{{ item }}</button>
              <!-- ⇄ Move button -->
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full text-amber-300
                       hover:bg-amber-100 hover:text-amber-600 focus:outline-none transition-colors"
                :aria-label="`Move '${item}' to another group`"
                @click.stop="movingChip?.group === 'means' && movingChip.index === i
                  ? cancelMove()
                  : startMove('means', i)"
              >
                <span aria-hidden="true" class="text-[11px]">⇄</span>
              </button>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full
                       hover:bg-amber-200 text-amber-500 focus:outline-none"
                :aria-label="`Remove strategy: ${item}`"
                @click="removeChip('means', i)"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </template>

          <div v-if="addingTo === 'means'" class="flex items-center gap-1">
            <input
              id="chip-add-means"
              v-model="addingText"
              type="text"
              class="h-9 rounded-full border border-amber-400 px-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Say it or type…"
              aria-label="New strategy"
              @keydown.enter.prevent="commitAdd"
              @keydown.escape="cancelAdd"
              @blur="commitAdd"
            />
          </div>

          <button
            v-else
            type="button"
            class="h-9 px-3 rounded-full border border-dashed border-amber-300
                   text-amber-500 text-sm hover:bg-amber-50
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Add strategy"
            @click="startAdd('means')"
          >
            <span aria-hidden="true">+</span> Add
          </button>
        </div>

        <p v-if="parsedMeans.length === 0 && addingTo !== 'means'"
           class="text-xs text-gray-400 mt-1 italic">
          None detected — optional.
        </p>
      </section>

      </div><!-- /r41 v317 lg:grid-cols-3 wrapper (Stakeholders + Values + Means) -->

      <!-- ── Implied Entries Panel (Advanced Parsing — Tier 1) ────────────── -->
      <!-- Tom 2026-05-17: "How is it going with my request earlier today for
           advanced parsing?" — shows rule-based suggestions for additional
           stakeholders / values / means implied by what the parser found.
           Dismissed per-session; reappears on each fresh parse. -->
      <!-- r41 v267 (Tom Gilb 2026-06-21 "It skipped over showing me the parsing or the
           generated implied suggestions. I did not even know they were there except for a
           chance scrolling") — wrapper div with ref + aria-label so the v267 scroll-to-
           result + announce pattern can find it.  Same shape as v256 (IET) + v262
           (EvoPlanView): the panel renders BELOW the viewport on first appearance + needs
           explicit scrollIntoView so the user sees the AI's work landing. -->
      <div ref="impliedPanelEl" aria-label="Implied entries — AI-suggested additions">
      <ImpliedEntriesPanel
        v-if="_showImplied"
        :stakeholders="parsedStakeholders"
        :values="parsedValues"
        :means="parsedMeans"
        :ai-suggestions="aiSuggestions"
        :ai-loading="aiLoading"
        :ai-error="aiError"
        @add="onImpliedAdd"
        @add-all="onImpliedAddAll"
        @dismiss="_showImplied = false"
      />
      </div>

      <!-- Error — promoted 2026-05-13 from a quiet line to a loud red banner
           with icon, border, and aria-live so a Generate-Spec failure is
           unmistakable. Tom: "the thing did not generate" + bedtime / demo
           in 8 hours scenario — silent failures are no longer acceptable. -->
      <div
        v-if="submitError"
        class="flex items-start gap-2 rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2.5 shadow-sm"
        role="alert"
        aria-live="assertive"
      >
        <span class="text-lg leading-none shrink-0" aria-hidden="true">⚠️</span>
        <p class="text-sm font-medium text-red-700">{{ submitError }}</p>
      </div>

      <!-- Ultra Light Fork Bar (Evo Step 5 — 2026-05-17): rich menus added.
           activeMenuForkId: same tooltip-suppression prop as the input-stage bar. -->
      <ForkBar
        v-if="ultraLightEnabled"
        class="mt-1"
        :active-menu-fork-id="activeForkMenu"
        @fork="onFork"
      />

      <!-- ── Fork action menus (review stage) ── -->
      <template v-if="ultraLightEnabled && activeForkMenu !== null && stage === 'review'">

        <!-- Refine menu — review stage -->
        <div
          v-if="activeForkMenu === 'refine'"
          class="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
          role="menu"
          aria-label="Refine options"
        >
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-600">
            <span class="text-[11px] font-bold uppercase tracking-widest text-slate-300">Refine</span>
            <span class="ml-auto text-[10px] text-slate-400">tighten your chips</span>
          </div>
          <div class="divide-y divide-slate-100">
            <button type="button" role="menuitem" @click="forkGoToInput"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">✏️</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Edit original text</p>
                <p class="text-[11px] text-slate-500">Return to the textarea for rephrasing — chips regenerate on next parse</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkCheckMissingFields"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🎯</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Check for missing fields</p>
                <p class="text-[11px] text-slate-500">Flag which of the three Planguage entry types (Who / How Well / How) are empty</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkMakeValuesMeasurable"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📏</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Make Values measurable</p>
                <p class="text-[11px] text-slate-500">Add numeric thresholds to value chips — a CE requirement for a quantified plan</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Improve menu — review stage -->
        <div
          v-if="activeForkMenu === 'improve'"
          class="rounded-xl border border-indigo-200 bg-white shadow-lg overflow-hidden"
          role="menu"
          aria-label="Improve options"
        >
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-700 to-indigo-600">
            <span class="text-[11px] font-bold uppercase tracking-widest text-indigo-200">Improve</span>
            <span class="ml-auto text-[10px] text-indigo-300">push the plan further</span>
          </div>
          <div class="divide-y divide-slate-100">
            <button type="button" role="menuitem" @click="forkGenerateSpec"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🚀</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Generate full spec now</p>
                <p class="text-[11px] text-slate-500">Submit current chips and build the complete Planguage specification</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkAddMoreStrategies"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">💼</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">Add more strategies</p>
                <p class="text-[11px] text-slate-500">Surface additional How entries — go back to text and add "by …" or "through …" clauses</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkQualityCheck"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">✅</span>
              <div>
                <p class="text-sm font-semibold text-slate-800">CE quality check</p>
                <p class="text-[11px] text-slate-500">Scan chips for Planguage completeness — stakeholders, quantified values, strategies</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Keep It Simple menu — review stage -->
        <div
          v-if="activeForkMenu === 'keepItSimple'"
          class="rounded-xl border border-amber-200 bg-amber-50 shadow-lg overflow-hidden"
          role="menu"
          aria-label="Keep It Simple options"
        >
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500">
            <span class="text-[11px] font-bold uppercase tracking-widest text-amber-100">Keep It Simple</span>
            <span class="ml-auto text-[10px] text-amber-200">measure · trim · sacrifice · know evil</span>
          </div>
          <div class="divide-y divide-amber-100">
            <button type="button" role="menuitem" @click="forkLordKelvinCheck"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🌡</span>
              <div>
                <p class="text-sm font-semibold text-amber-900">Lord Kelvin check <span class="font-normal text-amber-600">(quantify)</span></p>
                <p class="text-[11px] text-amber-700">Scan Value chips for numeric levels. Principle 1+2 (SIMPLE): "If you quantify it, it becomes more intelligible." Unquantified values are listed.</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkTrim121"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">✂️</span>
              <div>
                <p class="text-sm font-semibold text-amber-900">Trim to 1·2·1 <span class="font-normal text-amber-600">(instant)</span></p>
                <p class="text-[11px] text-amber-700">Main Simple Idea: one Stakeholder · two Values · one Strategy — the plan most likely to actually get done.</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkScopeSacrifice"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">⚖</span>
              <div>
                <p class="text-sm font-semibold text-amber-900">Scope Sacrifice <span class="font-normal text-amber-600">(Penta tradeoff)</span></p>
                <p class="text-[11px] text-amber-700">Drop the last chip from the largest category — improving remaining items by reducing competing scope. Less is a conscious design choice.</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkKnowEvil"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">⚠</span>
              <div>
                <p class="text-sm font-semibold text-amber-900">Know the failure <span class="font-normal text-amber-600">(Know Evil)</span></p>
                <p class="text-[11px] text-amber-700">Partial failure = missing just ONE Value. Define a Tolerable Level for your most critical Value — the worst acceptable level before the plan fails.</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Show Me More menu — review stage -->
        <div
          v-if="activeForkMenu === 'showMeMore'"
          class="rounded-xl border border-violet-200 bg-violet-50 shadow-lg overflow-hidden"
          role="menu"
          aria-label="Show Me More options"
        >
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-700 to-violet-600">
            <span class="text-[11px] font-bold uppercase tracking-widest text-violet-200">Show Me More</span>
            <span class="ml-auto text-[10px] text-violet-300">go deeper</span>
          </div>
          <div class="divide-y divide-violet-100">
            <button type="button" role="menuitem" @click="forkGenerateSpec"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-violet-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🚀</span>
              <div>
                <p class="text-sm font-semibold text-violet-900">Generate full spec</p>
                <p class="text-[11px] text-violet-700">Build the complete Planguage specification from your current chips</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkOpenTemplates"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-violet-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📋</span>
              <div>
                <p class="text-sm font-semibold text-violet-900">Browse example plans</p>
                <p class="text-[11px] text-violet-700">See curated templates — compare your plan against fully-formed Planguage examples</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkGoToInput"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-violet-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🔄</span>
              <div>
                <p class="text-sm font-semibold text-violet-900">Try a different approach</p>
                <p class="text-[11px] text-violet-700">Return to text input and rephrase — explore a different angle before generating</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Start Fresh menu — review stage -->
        <div
          v-if="activeForkMenu === 'startFresh'"
          class="rounded-xl border border-rose-200 bg-rose-50 shadow-lg overflow-hidden"
          role="menu"
          aria-label="Start Fresh options"
        >
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-700 to-rose-600">
            <span class="text-[11px] font-bold uppercase tracking-widest text-rose-200">Start Fresh</span>
            <span class="ml-auto text-[10px] text-rose-300">graduated reset</span>
          </div>
          <div class="divide-y divide-rose-100">
            <button type="button" role="menuitem" @click="forkKeepTextClearChips"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📝</span>
              <div>
                <p class="text-sm font-semibold text-rose-900">Keep text, clear chips</p>
                <p class="text-[11px] text-rose-700">Preserve your original text — discard the parsed chips and re-classify from scratch</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkOpenTemplates"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">📋</span>
              <div>
                <p class="text-sm font-semibold text-rose-900">Choose a template</p>
                <p class="text-[11px] text-rose-700">Replace everything with a curated starting point</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkSurpriseMe"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🎲</span>
              <div>
                <p class="text-sm font-semibold text-rose-900">Surprise me</p>
                <p class="text-[11px] text-rose-700">Replace with a random scenario — a clean break from the current direction</p>
              </div>
            </button>
            <button type="button" role="menuitem" @click="forkClearEverything"
              class="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-rose-100 transition-colors">
              <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">🧹</span>
              <div>
                <p class="text-sm font-semibold text-rose-900">Clear everything</p>
                <p class="text-[11px] text-rose-700">Complete blank slate — wipe all text, chips, and errors</p>
              </div>
            </button>
          </div>
        </div>

      </template>

      <!-- Actions — inline (kept for users who reach the bottom naturally) -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          class="min-h-[44px] px-4 rounded-lg border border-gray-200 text-sm text-gray-600
                 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400
                 transition-colors duration-150"
          aria-label="Say it again"
          @click="stage = 'input'; nextTick(() => (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus())"
        >
          <span aria-hidden="true">←</span> Say it again
        </button>

        <button
          type="button"
          id="sem-generate-btn"
          class="flex-1 min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
                 text-white shadow-sm hover:bg-blue-700
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-blue-600 transition-colors duration-150
                 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="generating"
          aria-label="Generate Spec"
          @click="handleSubmit"
        >
          Generate Spec
          <span aria-hidden="true"> →</span>
        </button>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           STICKY BOTTOM ACTIONS BAR — mirrors the input-mode Parse bar so the
           planner never has to scroll-hunt to progress.
           Tom Gilb 2026-06-20 verbatim "I AM STUCK AND NEVER CAN MOVE ON,
           ALWAYS SOMETHING WRONG" — the review-stage Generate Spec button was
           at y=1753 in an 820-tall viewport (933px below the fold).  Mirrors
           the existing input-stage `#sem-parse-btn` sticky pattern at line
           2858 — fixed inset-x-0 bottom-4 z-30 pointer-events-none flex
           justify-center.  Composes with: MOVE Principle SUPREME (primary
           action ALWAYS visible from first paint), DD-009 Zero-Training UI,
           accessibility_tom.md (Tom 85 — never scroll to find next action),
           top-and-bottom navigation mirror DD-014.  Companion top↑/bottom↓
           jump pins on the right so the planner can leap to either end of
           the form without dragging the scrollbar — covers Tom's r41
           2026-06-20 verbatim "INCLUDE … SCROLL BAR THE ARROWS … TO GO TO
           TOP OR BOTTOM OF THE WINDOW".

           v-if="showStickyBars" (r41 v223 STAGE-2-LEAK fix) — same gate as
           the input-mode Parse bar above.  Stage 1 only. ════════════════ -->
      <div v-if="showStickyBars" class="fixed inset-x-0 bottom-4 z-30 pointer-events-none flex justify-center px-4">
        <div class="w-full max-w-2xl pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            class="shrink-0 min-h-[52px] px-3 rounded-xl bg-white/95 backdrop-blur ring-2 ring-slate-300
                   text-sm font-semibold text-slate-700 shadow-2xl
                   hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400
                   transition-colors duration-150"
            aria-label="Say it again — return to input"
            title="← Say it again — go back and edit your original input"
            @click="stage = 'input'; nextTick(() => (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus())"
          >
            <span aria-hidden="true">←</span> Edit
          </button>

          <button
            type="button"
            class="flex-1 min-h-[52px] rounded-xl bg-blue-600 px-4 py-3.5 text-base font-bold
                   text-white shadow-2xl hover:bg-blue-700 ring-2 ring-blue-300
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-blue-600 transition-colors duration-150
                   disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="generating"
            aria-label="Generate Spec — proceed to Planguage generation"
            title="Generate Spec → — sends the reviewed entries to the AI for Planguage spec generation"
            @click="handleSubmit"
          >
            {{ generating ? 'Generating…' : 'Generate Spec' }}
            <span v-if="!generating" aria-hidden="true"> →</span>
          </button>

          <!-- r41 v224 (Tom Gilb verbatim "scroll is at extreme right and
               hiding upo") — duplicate ⬆/⬇ pins DROPPED from this sticky
               bar.  They were at the "extreme right" of the bar and competed
               with the canonical bottom-centre PageScrollPin.  The
               PageScrollPin now owns the global page-scroll affordance
               (bottom-centre, always visible, both arrows always rendered).
               Cleaner mental model: ONE place for page scroll, ONE place
               for stage-action. -->
        </div>
      </div>
      <!-- Spacer so the inline Actions row + last form field aren't hidden behind
           the fixed bar above (same pattern as the input-stage Parse-bar spacer). -->
      <div class="h-24" aria-hidden="true"></div>

    </template>
  </div>
</template>
