<script setup lang="ts">
/**
 * GilbIllustrationPicker — full-screen panel for searching every illustration
 * across every Tom Gilb book TwinPod, and inserting one into the calling
 * surface.
 *
 * SUPREME composition:
 *   - Universal Undo Rule — inserting an illustration goes through
 *     useUndoHistory.record() via the @insert event handler in the parent.
 *   - MOVE Principle — search box visible at top, grid below, Insert + Close
 *     pins both at top AND bottom (DD-014 mirror).
 *   - Single-Surface Rule — registers via useExclusiveSurfaces.
 *   - CloseDot rule — backdrop click + Escape + CloseDot all close.
 *   - HoverHint rule — every interactive element has plain-English title.
 *   - American English Standard — "Color" / "Illustration" / "Catalog".
 *   - Banned word "tooltip" → HoverHint vocabulary in comments and UI.
 *   - Loading-State rule — spinner + elapsed-seconds + amuse content while
 *     the index loads (small file, usually <500 ms, but the pattern is
 *     mandatory per Rule 8).
 *   - Conjunction-of-Technologies — every inserted illustration carries
 *     a citation back to the source book + page + Twin Consultant URL
 *     (r93ppp Twin promotional discipline).
 *
 * Emits 'insert' with the chosen illustration; parent decides where it goes
 * (description, rationale, longDef, etc).
 */

import { ref, computed, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import { useGilbIllustrations, type GilbIllustration } from '../composables/useGilbIllustrations'
import { useTwinSearch } from '../composables/useTwinSearch'
import { usePlanguageGlossaryIndex } from '../composables/usePlanguageGlossaryIndex'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import PlanguageUniverse from './PlanguageUniverse.vue'  // r41 v4 — 663-concept Planguage universe constellation map
import BookKaleidoscope from './BookKaleidoscope.vue'    // r41 v27 — 📚 Books tab: 48 book covers + illustrations
import { classifyConcept, AREA_META, type IlluminateTabSuggestion } from '../composables/useIlluminateClassifier' // r41 v30 — Phase 2 classifier
import IlluminationSettingsPanel from './IlluminationSettingsPanel.vue' // r41 v32 — Phase 3 per-Owner Settings drawer
import { useIlluminationPreferences } from '../composables/useIlluminationPreferences' // r41 v32 — Phase 3 per-Owner prefs
import IlluminationSessionEmailModal, { sendIlluminationSessionEmail } from './IlluminationSessionEmailModal.vue' // r41 v33 — Phase 5 email surfaces
import { useIlluminationSession } from '../composables/useIlluminationSession' // r41 v33 — Phase 5 session log
import IlluminatePurposeMenu from './IlluminatePurposeMenu.vue' // r41 v34 — Phase 4 Purposes menu
import { useIlluminatePurposes } from '../composables/useIlluminatePurposes' // r41 v34 — Phase 4 Purposes state
import RenderedMarkdown from './RenderedMarkdown.vue'
import { useToast } from '../composables/useToast'
import { renderGilbPickerHtml, renderGilbPickerPlain, type GilbPickerExportState, type PickerTextResult } from '../composables/useGilbPickerExport'

const { showToast } = useToast()

// r93qqq 2026-06-13 — Tom: "cmd-I for both. (Illumination, information,
// Illustrations) ... search words can give both, display both (text, ills) and
// we can select".  Two columns: TEXT (Planguage Glossary + chapter excerpts)
// on the left; ILLUSTRATIONS on the right.  Same search drives both.

/** A text-result card — either a Planguage Glossary entry or a book chapter excerpt. */
interface TextResult {
  id:       string
  kind:     'glossary' | 'chapter'
  title:    string                    // headline (e.g. "Tolerable *539" or "7.9 Diagrams/Icons")
  subtitle: string                    // sub-line (e.g. role text or book title)
  body:     string                    // searchable + insertable body text (plain)
  bodyRich: string                    // FORMATTED HTML — paragraphs, bold, italic, color
  icon:     string                    // single-emoji visual cue
  twinUrl?: string                    // r93ppp — Tom Gilb Consultant Twin destination
  bookId?:  string                    // for chapters
  bookTitle?: string                  // for chapters
}

/**
 * Tom Gilb 2026-06-13 (verbatim): "i have asked severaltimes today, for you to
 * edit with new lines, bold italics color these boring long definition chunks".
 *
 * Standing rule for every long-form definition surface in SEM:
 *   - One paragraph per `<p>` (NO wall of text)
 *   - First sentence of each paragraph: BOLD
 *   - Capitalised structural terms (TOLERABLE, GOAL, WISH, WHOLE PROJECT, STG, etc.): COLORED + BOLD
 *   - Italics for Tom's verbatim quotes (recognised by " inside the body)
 *   - Concept numbers (*123): VIOLET monospace pill
 *   - Sources / "below it", "above" / "between" — slate small caps
 *
 * Returns SAFE inline-styled HTML (escaped first, then style tags injected).
 */
function formatRichDefinition(termName: string, conceptNumber: string, shortDef: string, longDef: string[]): string {
  // Words / phrases that should always be COLORED + BOLD when they appear inline.
  // Order matters — longer patterns first so e.g. "WHOLE PROJECT" wins before "WHOLE".
  const HIGHLIGHTS: Array<{ pattern: RegExp, color: string }> = [
    { pattern: /\bWHOLE PROJECT\b/g,         color: '#dc2626' }, // red — survival/failure language
    { pattern: /\bSTG\b/g,                   color: '#7c3aed' }, // violet — Planguage structure
    { pattern: /\bTOLERABLE\b/g,             color: '#dc2626' },
    { pattern: /\bSURVIVAL\b/g,              color: '#dc2626' },
    { pattern: /\bFAIL(?:S|ED|URE)?\b/g,     color: '#dc2626' },
    { pattern: /\bGOAL\b/g,                  color: '#059669' }, // emerald
    { pattern: /\bWISH\b/g,                  color: '#7c3aed' }, // violet
    { pattern: /\bSTRETCH\b/g,               color: '#0891b2' }, // cyan
    { pattern: /\bTARGET\b/g,                color: '#059669' },
    { pattern: /\bCONSTRAINT\b/g,            color: '#ea580c' }, // orange
    { pattern: /\bAMBITION\b/g,              color: '#9333ea' },
    { pattern: /\bcommitted promise\b/gi,    color: '#059669' },
    { pattern: /\bsurvival line\b/gi,        color: '#dc2626' },
    { pattern: /\bnegotiated\b/gi,           color: '#0891b2' },
    { pattern: /\bvalid only\b/gi,           color: '#dc2626' },
    { pattern: /\b7 (?:validity )?conditions?\b/gi, color: '#059669' },
  ]

  function escapeHtmlText(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  }

  function richify(plain: string): string {
    let html = escapeHtmlText(plain)
    for (const { pattern, color } of HIGHLIGHTS) {
      html = html.replace(pattern, m => `<span style="color:${color};font-weight:700;">${m}</span>`)
    }
    // Quoted material → italics with a light-grey background
    html = html.replace(/&quot;([^&]+?)&quot;/g, '<em style="color:#475569;background:#f1f5f9;padding:0 3px;border-radius:3px;">"$1"</em>')
    return html
  }

  // First sentence of each paragraph: BOLD
  function paragraphHtml(plain: string): string {
    const rich = richify(plain)
    // Match up to the first sentence-ending punctuation followed by space/end
    const m = rich.match(/^(.+?[.!?])(\s|$)/)
    if (!m) return `<p style="margin:0 0 10px 0;font-size:13px;line-height:1.55;color:#1e293b;">${rich}</p>`
    const first = m[1]
    const rest  = rich.slice(m[0].length)
    return `<p style="margin:0 0 10px 0;font-size:13px;line-height:1.55;color:#1e293b;">` +
             `<strong style="color:#0f172a;">${first}</strong>` +
             (rest ? ` ${rest}` : '') +
           `</p>`
  }

  const conceptPill = conceptNumber
    ? `<span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;color:#5b21b6;background:#ede9fe;border:1px solid #c4b5fd;padding:1px 6px;border-radius:4px;margin-left:6px;">${escapeHtmlText(conceptNumber)}</span>`
    : ''

  const head = `<div style="margin-bottom:8px;">` +
                 `<span style="font-size:15px;font-weight:800;color:#5b21b6;">${escapeHtmlText(termName)}</span>` +
                 conceptPill +
               `</div>`

  const shortHtml = shortDef ? paragraphHtml(shortDef) : ''
  const longHtml  = longDef.map(paragraphHtml).join('')

  return head + shortHtml + longHtml
}

// r41 v27 — Tab IA restructure (Tom Gilb 2026-06-15 verbatim: *"it is time to
// organize all the cmnd i stuff much better. can you come up with an elegant
// useful beautiful design and carrit out?"*).  Six lateral surfaces, ONE
// active at a time; tab strip below search row.  Default tab = 'define'
// (definition-seeker most-common case).  Persisted in localStorage.  App.vue
// can preset the tab when launching via the new top-right 📚 Books pin.
export type IlluminateTab = 'define' | 'diagram' | 'pictures' | 'universe' | 'books' | 'twin'
const ALL_TABS: IlluminateTab[] = ['define', 'diagram', 'pictures', 'universe', 'books', 'twin']
const TAB_STORAGE_KEY = 'sem-app:illuminate-picker-tab:v1'

const props = defineProps<{
  open: boolean
  /** Optional pre-filter — restrict the picker to one book. */
  bookId?: string
  /** r41 v27 — optional initial tab override.  When App.vue launches the picker
   *  via the new 📚 Books pin, this is 'books'; otherwise the picker hydrates
   *  the last-used tab from localStorage. */
  initialTab?: IlluminateTab
  /** r41 v32 — Phase 3 Per-Owner preferences keys.  Defaults safely to '?'
   *  strings when unset so the lookup still resolves to global defaults. */
  planId?:    string
  ownerName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** Fires when the user picks an illustration. */
  (e: 'insert', payload: { illustration: GilbIllustration, html: string, markdown: string }): void
  /** r29 — fires when the user clicks "💡 Open full Glossary entry" on a card. */
  (e: 'illuminate-term', payload: { term: string }): void
  /** r31 (Tom 2026-06-13: "missing the ontology diagram") — opens the 🌳
   *  Planguage Ontology — Clickable Concept Tree (663 concepts in 106
   *  categories).  Parent closes the picker and opens the diagram. */
  (e: 'open-ontology'): void
}>()

const { isLoading, error, totalCount, books, all: allIllustrations, search, strongestSignal, citation } = useGilbIllustrations()

// r93qqq r22 (Tom Gilb 2026-06-13: "what is this 8 term local glossary, the
// Planguage glossary your should havre access to in the vault has about 700
// terms").  The CANONICAL 663-term Planguage Glossary lives at
// 10.Standard/2.Glossary/PlanguageGlossary/ in the vault.  Built into a flat
// JSON index by `_build-index.py` and served by Vite.
const { search: glossarySearch, totalConcepts: glossaryCount } = usePlanguageGlossaryIndex()

// r93qqq r19 — Tom Gilb 2026-06-13 verbatim: "I hope you can make use of the
// twins advanced search logic, noting less is interesting".  Twin Insights
// banner above the local columns.  Debounced auto-fire on queryText after
// 800 ms of typing pause so we don't hammer /api/chat with every keystroke.
const { searchTwin, isLoading: twinLoading, lastResult: twinResult, lastError: twinError, elapsedSeconds: twinElapsed, TWIN_BASE } = useTwinSearch()

let _twinDebounceTimer: number | null = null
function _kickTwinSearch(q: string): void {
  if (_twinDebounceTimer) window.clearTimeout(_twinDebounceTimer)
  if (!q.trim()) return  // empty query — leave the banner showing the last result
  _twinDebounceTimer = window.setTimeout(() => {
    searchTwin(q).catch(() => { /* error captured in twinError */ })
  }, 800)
}

// r41 v32 — Phase 3 per-Owner preferences singleton.  Effective preferences
// = personal override OR global default per field.
const { effective: effectivePrefs } = useIlluminationPreferences()
const effPrefs = computed(() => effectivePrefs(props.planId ?? '?', props.ownerName ?? '?'))

// Settings drawer state (⚙ pin in picker header opens this).
const _settingsOpen = ref(false)
function _openIlluminationSettings(): void { _settingsOpen.value = true }
function _closeIlluminationSettings(): void { _settingsOpen.value = false }

// r41 v33 — Phase 5 ILLUMINATION AI session log + email surfaces.
// Tom Gilb 2026-06-15 verbatim: *"Ill-AI: EMAIL ME EVERYTHING IN THIS SESSION
// ABOUT THIS CONCEPT.  EMAIL ME THE FOLLOWING (give a list of those things we
// looked at to select from)"*.
const _sessionEmailModalOpen = ref(false)
const sessionLog = useIlluminationSession()

async function _emailEverything(): Promise<void> {
  if (sessionLog.events.value.length === 0) {
    showToast('No session events captured yet — explore at least one tab first.', 3000)
    return
  }
  await sendIlluminationSessionEmail({
    events:         sessionLog.events.value,
    conceptName:    sessionLog.concept.value,
    startedAt:      sessionLog.session.value.startedAt,
    endedAt:        sessionLog.session.value.endedAt,
    classification: sessionLog.session.value.classification,
    recipientEmail: effPrefs.value.preferredEmailAddress || 'Tom@Gilb.com',
    recipientName:  props.ownerName,
  })
  showToast(`📧 Mail opening — press ⌘V in the body to paste the colourful session.  Recipient: ${effPrefs.value.preferredEmailAddress || 'Tom@Gilb.com'}.`, 6000)
}
// r41 v34 — Phase 4 — "Your Purposes" menu + guided flow.
const _purposeMenuOpen = ref(false)
const purposes = useIlluminatePurposes()

function _openPurposeMenu(): void { _purposeMenuOpen.value = true }
function _closePurposeMenu(): void { _purposeMenuOpen.value = false }
function _pickPurpose(payload: { purposeId: string; freeText?: string }): void {
  purposes.setPurpose(payload.purposeId, payload.freeText)
  // Jump to the first tab in the recommended sequence + log the purpose.
  const first = purposes.currentTabInSequence.value
  if (first) setActiveTab(first as IlluminateTab)
  try {
    sessionLog.session.value.classification = sessionLog.session.value.classification ?? null
    // Note the purpose in the event log so the email body carries it.
    sessionLog.session.value.events.push({
      kind: 'classifier-suggested',
      timestamp: Date.now() - sessionLog.session.value.startedAt,
      label: `🎯 Purpose: ${purposes.purpose.value?.label ?? payload.purposeId}${payload.freeText ? ` — "${payload.freeText}"` : ''}`,
    })
  } catch { /* sessionLog may not be initialised */ }
}

function _openEmailSelectModal(): void {
  if (sessionLog.events.value.length === 0) {
    showToast('No session events to pick from — explore a tab or two first.', 3000)
    return
  }
  _sessionEmailModalOpen.value = true
}

// r41 v34 — Phase 4 "Sharp Enough" completion signal.  Marks the session
// ended in the in-memory log + closes the picker.  Future Phase 4 work will
// optionally auto-fire the Email-everything send based on per-Owner prefs.
function _signalSharpEnough(): void {
  try {
    sessionLog.logSharpEnough()
    sessionLog.endSession()
  } catch { /* sessionLog may not be initialised in odd race conditions */ }
  emit('close')
}

// r41 v28 — ILLUMINATION AI Phase 1 state (declared early so the watch
// on queryText below can reference it).
const _illuminationExpanded = ref(false)
function _expandIllumination(): void {
  _illuminationExpanded.value = true
  // r41 v33 — Phase 5 — log the glance expansion event.
  try { sessionLog.logGlanceExpanded() } catch { /* sessionLog may not yet be initialised */ }
}

// r41 v30 — ILLUMINATION AI Phase 2 — Tom Gilb 2026-06-15 verbatim:
// *"so fist they ask the concept words, they you parse it (what type of words,
// requirements, processes, design, qa, management, finances)"*.  Classify the
// current query against the six sharpening-style areas; surface the primary
// lens chip + a "try this tab first" suggestion on the glance card.

// Short-definition helper for the glance card.  Pulls the first sentence
// from the rich body text — preferring up to ~240 chars, breaking at the
// first '.', '!', '?' followed by whitespace.  Falls back to the first
// 240 chars if no sentence break appears.
function _shortDefFromBody(body: string | undefined): string {
  if (!body) return 'No short definition recorded yet — open the full entry below to read everything.'
  const oneLine = body.replace(/\s+/g, ' ').trim()
  if (!oneLine) return 'No short definition recorded yet.'
  const sentenceMatch = oneLine.match(/^.{20,240}?[.!?](?=\s|$)/)
  if (sentenceMatch) return sentenceMatch[0]
  return oneLine.length > 240 ? oneLine.slice(0, 237) + '…' : oneLine
}

const queryText        = ref('')
const bookFilter       = ref<string>('')

// r41 v30 — Reactive classifier output.  Pure compute, no side-effects.
const illuminateClassification = computed(() => classifyConcept(queryText.value))

// Helper used by the glance card to jump to the suggested tab.
function _jumpToSuggestedTab(t: IlluminateTabSuggestion): void {
  setActiveTab(t)
  // Suggested-tab jumps also expand the Define content if the target is Define
  // (so the planner doesn't have to click "Yes, want to know more" right after).
  if (t === 'define') _illuminationExpanded.value = true
}

// Every new query collapses back to the glance-card so the planner gets ONE
// short definition first; expand-on-click is a fresh consent for each concept
// (Tom Gilb 2026-06-15 "one thing initially").  r41 v32 — honours effective
// preferences: depth='deep' or showGlanceCard=false → start expanded.
let _lastQueryForReset = ''
watch(queryText, (q) => {
  const trimmed = q.trim()
  if (trimmed && trimmed !== _lastQueryForReset) {
    _illuminationExpanded.value = (effPrefs.value.depth === 'deep') || !effPrefs.value.showGlanceCard
    _lastQueryForReset = trimmed
    // r41 v33 — Phase 5 — fresh session per concept.
    sessionLog.startSession(trimmed, {
      primaryArea:  illuminateClassification.value.primaryArea,
      suggestedTab: illuminateClassification.value.suggestedTab,
      confidence:   illuminateClassification.value.confidence,
    })
    if (illuminateClassification.value.primaryArea) {
      sessionLog.logClassifierSuggestion(
        illuminateClassification.value.primaryArea,
        illuminateClassification.value.suggestedTab || '?',
        illuminateClassification.value.confidence,
      )
    }
    // r41 v32 — Phase 3 alwaysDiagramFirst preference: if turned on, auto-jump
    // to the 📐 Diagram tab as soon as a Glossary entry with a diagram exists.
    // The diagram availability is updated reactively by the existing
    // watch(primaryGlossary) → mermaid render chain; we re-check after one
    // tick to give that chain time to fire.
    if (effPrefs.value.alwaysDiagramFirst) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (glossaryDiagramSvg.value && activeTab.value !== 'diagram') {
            activeTab.value = 'diagram'
          }
        })
      })
    }
  }
})
/** Either 'ill:<id>' for an illustration or 'txt:<id>' for a text result. */
const selectedId       = ref<string | null>(null)

// r41 v27 — Active tab.  Hydrate from localStorage on module init so the
// previously-active tab is restored across opens.  Default = 'define'.
function _hydrateTab(): IlluminateTab {
  if (typeof localStorage === 'undefined') return 'define'
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as IlluminateTab | null
    if (saved && ALL_TABS.includes(saved)) return saved
  } catch { /* localStorage may be disabled — fall through */ }
  return 'define'
}
const activeTab = ref<IlluminateTab>(_hydrateTab())
function setActiveTab(t: IlluminateTab): void {
  activeTab.value = t
  try { localStorage.setItem(TAB_STORAGE_KEY, t) } catch { /* ignore */ }
  // r41 v33 — Phase 5 — capture tab visits in the session log.
  try { sessionLog.logTabVisited(t) } catch { /* sessionLog may not yet be initialised on first call */ }
}

// Initialize bookFilter from prop on open; honour initialTab override
// when App.vue launched the picker via the new 📚 Books pin.
watch(() => props.open, (open) => {
  if (open) {
    queryText.value  = ''
    bookFilter.value = props.bookId ?? ''
    selectedId.value = null
    // r41 v33 — Phase 5 — start a fresh session log on every picker open.
    sessionLog.startSession(null, null)
    // r41 v32 — Phase 3: pre-expand glance based on effective preferences.
    //   depth='deep' → always start expanded (no glance).
    //   depth='short' → keep glance (collapsed).
    //   depth='standard' → keep glance (collapsed) per r41 v28 design.
    //   showGlanceCard=false → skip glance entirely (effPrefs override).
    _illuminationExpanded.value = (effPrefs.value.depth === 'deep') || !effPrefs.value.showGlanceCard
    if (props.initialTab && ALL_TABS.includes(props.initialTab)) {
      activeTab.value = props.initialTab
    } else {
      // No initialTab → honour effective preference default-tab.
      const prefTab = effPrefs.value.defaultTab as IlluminateTab
      if (ALL_TABS.includes(prefTab)) {
        activeTab.value = prefTab
      }
    }
  }
})

// ── ILLUSTRATIONS column ─────────────────────────────────────────────────────
// r41 v5 (Tom Gilb 2026-06-14 verbatim: "mckinney still there, and why does
// it say 300 matchs when there is nothing in the aperture?") — two bugs, one
// root cause: `search('', …)` returns the first 300 illustrations of the
// alphabetically-sorted index (Argumenteering ch.1 first → McKinney page
// surfaces).  Guard: with no query AND no book filter, return zero matches
// so the illustrations area + count badge are EMPTY until the user types.
const illustrationResults = computed(() => {
  const q = queryText.value.trim()
  if (!q && !bookFilter.value) return []
  return search(q, { bookId: bookFilter.value || undefined, limit: 300 })
})

// ── TEXT column — Planguage Glossary + chapter excerpts ──────────────────────
// Sourced from PLANGUAGE_TERMS (Glossary) and the same illustration index
// (chapter titles + captions are real Tom prose).  All deterministic — no
// extra fetch required.

const allTextResults = computed<TextResult[]>(() => {
  const out: TextResult[] = []
  // (1) FULL Planguage Glossary — 663 concepts from
  //     10.Standard/2.Glossary/PlanguageGlossary/ (NOT the 8-term hardcoded
  //     list).  r22 fix per Tom 2026-06-13.
  // Note: this computed depends on `glossarySearch('')` which returns the
  // first `limit` entries — for the "all" cache we ask for a high limit.
  for (const c of glossarySearch('', { limit: 1000 })) {
    // r24 defensive — 9/663 entries had keyedIcon: [] from the Python parser bug
    const keyedIcon = (typeof c.keyedIcon === 'string' && c.keyedIcon) ? c.keyedIcon : '💡'
    out.push({
      id:       `glossary:${c.id}`,
      kind:     'glossary',
      title:    `${c.name} *${c.conceptNumber}`,
      subtitle: c.type || 'Planguage concept',
      body:     [c.definition, c.overview].filter(Boolean).join('\n\n'),
      bodyRich: formatRichDefinition(c.name, `*${c.conceptNumber}`, c.definition, c.overview ? [c.overview] : []),
      icon:     keyedIcon,
      twinUrl:  c.twinUrl,
    })
  }

  // (2) Chapter excerpts — every illustration's chapter + caption already in
  //     the index.  Dedupe by chapterTitle per book so each chapter shows once.
  const seen = new Set<string>()
  for (const ill of allIllustrations.value) {
    if (!ill.chapterTitle) continue
    const k = `${ill.bookId}::${ill.chapterTitle}`
    if (seen.has(k)) continue
    seen.add(k)
    const bodyPlain = ill.caption || ill.chapterTitle
    out.push({
      id:        `chapter:${k}`,
      kind:      'chapter',
      title:     ill.chapterTitle,
      subtitle:  ill.bookTitle,
      body:      bodyPlain,
      bodyRich:  `<div style="margin-bottom:6px;"><span style="font-size:15px;font-weight:800;color:#0f172a;">${ill.chapterTitle.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]!)}</span></div><p style="margin:0 0 8px 0;font-size:12px;color:#64748b;font-style:italic;">from <strong>${ill.bookTitle.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]!)}</strong></p><p style="margin:0;font-size:13px;line-height:1.55;color:#1e293b;">${bodyPlain.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]!)}</p>`,
      icon:      '📖',
      twinUrl:   `https://www.gilb.com/tomtwin/book/${ill.bookId}`,
      bookId:    ill.bookId,
      bookTitle: ill.bookTitle,
    })
  }
  return out
})

/** Text results = weighted-ranked Glossary hits (via usePlanguageGlossaryIndex.search)
 *  + filtered chapter excerpts.  r22 (Tom 2026-06-13: 663-term Glossary).  When
 *  query is empty, show a small useful slice of the Glossary (top 30 alpha) — not
 *  the full 663 (too noisy as a default state). */
const textResults = computed<TextResult[]>(() => {
  const q = queryText.value.trim()
  // Glossary side — uses the dedicated weighted search from the Glossary composable.
  // Empty query → return the first 30 alpha-sorted concepts as a useful default state.
  const glossaryTextResults: TextResult[] = q
    ? glossarySearch(q, { limit: 60 }).map(c => {
        const keyedIcon = (typeof c.keyedIcon === 'string' && c.keyedIcon) ? c.keyedIcon : '💡'
        return {
          id:       `glossary:${c.id}`,
          kind:     'glossary' as const,
          title:    `${c.name} *${c.conceptNumber}`,
          subtitle: c.type || 'Planguage concept',
          body:     [c.definition, c.overview].filter(Boolean).join('\n\n'),
          bodyRich: formatRichDefinition(c.name, `*${c.conceptNumber}`, c.definition, c.overview ? [c.overview] : []),
          icon:     keyedIcon,
          twinUrl:  c.twinUrl,
        }
      })
    : allTextResults.value.filter(t => t.kind === 'glossary').slice(0, 30)
  if (!q) return glossaryTextResults

  // Chapter side — substring filter against the pre-built chapter pool.
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  let chapterPool = allTextResults.value.filter(t => t.kind === 'chapter')
  if (bookFilter.value) chapterPool = chapterPool.filter(t => t.bookId === bookFilter.value)
  const scoredChapters = chapterPool.map(t => {
    const hay = `${t.title} ${t.subtitle} ${t.body}`.toLowerCase()
    const hits = terms.reduce((n, term) => n + (hay.includes(term) ? 1 : 0), 0)
    return { t, hits }
  }).filter(s => s.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 60).map(s => s.t)

  // Glossary results come first (higher signal), chapters second.
  return [...glossaryTextResults, ...scoredChapters]
})

const selectedIllustration = computed<GilbIllustration | null>(() => {
  if (!selectedId.value?.startsWith('ill:')) return null
  const id = selectedId.value.slice(4)
  return illustrationResults.value.find(r => r.id === id) ?? null
})

const selectedText = computed<TextResult | null>(() => {
  if (!selectedId.value?.startsWith('txt:')) return null
  const id = selectedId.value.slice(4)
  return textResults.value.find(t => t.id === id) ?? null
})

const hasSelection = computed(() => selectedIllustration.value || selectedText.value)

// r93qqq r30 (Tom Gilb 2026-06-13: "If there is a glossary hit, then display
// that , maybe full width, with the other related options in a list to choose
// from as an option" + "The pictures, secondary, maybe only on request, one at
// a time, or a list of options") — restructure picker:
//   - PRIMARY (full-width): top Glossary hit displayed prominently
//   - SECONDARY (compact list): other Glossary matches as a clickable list
//   - TERTIARY (collapsed): illustrations behind a "Show pictures" toggle
//   - Twin Insights stays as a compact strip ABOVE the primary hit
// r35 — pictures DEFAULT visible (Tom Gilb 2026-06-13: "cant see any pictures yet").
// r36 — illustrations are now ALWAYS visible (top of body); this ref is retained for
//        backward compat but is no longer toggled by UI (no toggle button any more).
const showIllustrations = ref(true)
// r36 — Tom Gilb 2026-06-14: primary Glossary card was eating the whole viewport,
//        pushing illustrations below the fold.  Default to a 4-line clamp with a
//        "Read full definition" expander.  Resets to collapsed whenever
//        primaryGlossary changes (new query → new entry → start collapsed).
const primaryExpanded = ref(false)
// r36 — Chapter mentions: default 4 visible, "Show all" expands to 8.
//        Resets when query changes.
const chapterShowAll = ref(false)
const glossaryMatches = computed(() => textResults.value.filter(t => t.kind === 'glossary'))
const chapterMatches  = computed(() => textResults.value.filter(t => t.kind === 'chapter'))

/** Strip a trailing ` *NNN` suffix from a Glossary title so we can compare names. */
function _stripNumberSuffix(title: string): string {
  return title.replace(/\s*\*\d+\s*$/, '').trim()
}

/** Test whether the local top hit is an EXACT-name match for the query
 *  (case-insensitive, ignoring the ` *NNN` suffix and surrounding whitespace). */
function _isLocalExactNameMatch(top: TextResult | undefined, query: string): boolean {
  if (!top) return false
  const q = query.trim().toLowerCase()
  if (!q) return false
  const name = _stripNumberSuffix(top.title).toLowerCase()
  return name === q
}

/** Test whether a Twin concept name matches the query exactly or as a stem prefix. */
function _isTwinNameMatch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  const n = name.toLowerCase()
  if (n === q) return true
  // stem-prefix: "usabil" ⊂ "usability" or "usability" ⊂ "usability-aspect"
  return n.startsWith(q) || q.startsWith(n)
}

/** r35 — Twin promotion fallback (Tom Gilb 2026-06-13):
 *  "I put in usability, and top hit (sticking from earlier, earlier should be
 *  wiped out) ambition."
 *
 *  Decision ladder:
 *    1. Local top hit is an EXACT-name match for the query → use it (badge: local-exact)
 *    2. Twin has a top concept whose name matches the query exactly OR as a
 *       stem prefix → SYNTHESIZE a primary card from the Twin result
 *       (badge: twin · Glossary not local)
 *    3. Twin has no exact match either → show local top hit decorated
 *       (badge: loose match · query found inside body)
 *    4. No results anywhere → null
 *
 *  This ensures the user never sees "Ambition" as the primary card when they
 *  typed "usability" just because Ambition's body literally contains the word
 *  "Usability" as an example.
 */
const primaryGlossary = computed<TextResult | null>(() => {
  const q = queryText.value.trim()
  const localTop = glossaryMatches.value[0]

  // Path 1 — local exact name match: trust the local Glossary
  if (_isLocalExactNameMatch(localTop, q)) return localTop ?? null

  // Path 2 — Twin promotion: scan Twin concept URLs for an exact / stem-prefix
  // name match.  If found, build a synthetic TextResult that the template
  // renders identically to a local Glossary card.
  if (q && twinResult.value && twinResult.value.query.trim().toLowerCase() === q.toLowerCase()) {
    const twinHit = twinResult.value.conceptUrls.find(c => _isTwinNameMatch(c.name, q))
    if (twinHit) {
      // Try to surface a Twin body snippet — pull the first ~6 lines around the
      // first mention of the concept name in the Twin response text.
      const txt = twinResult.value.text || ''
      let snippet = ''
      const idx = txt.toLowerCase().indexOf(twinHit.name.toLowerCase())
      if (idx >= 0) {
        const slice = txt.slice(idx, idx + 480)
        snippet = slice.split('\n').slice(0, 6).join('\n').replace(/\*\*/g, '').trim()
      }
      const body = snippet
        || `Canonical Planguage concept (*${twinHit.number}). The local vault Glossary at 10.Standard/2.Glossary/PlanguageGlossary/ does not yet contain this entry — open the Twin entry below for the full canonical definition.`
      const safeBody = body.replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' })[c]!)
      return {
        id:       `twin:${twinHit.name}.${twinHit.number}`,
        kind:     'glossary',
        title:    `${twinHit.name} *${twinHit.number}`,
        subtitle: 'Canonical Planguage concept — sourced from Tom Gilb Consultant Twin',
        body,
        bodyRich: `<div style="margin-bottom:8px;">` +
                    `<span style="font-size:15px;font-weight:800;color:#5b21b6;">${twinHit.name}</span>` +
                    `<span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;color:#5b21b6;background:#ede9fe;border:1px solid #c4b5fd;padding:1px 6px;border-radius:4px;margin-left:6px;">*${twinHit.number}</span>` +
                  `</div>` +
                  `<p style="margin:0 0 10px 0;font-size:13px;line-height:1.55;color:#1e293b;white-space:pre-wrap;">${safeBody}</p>` +
                  `<p style="margin:8px 0 0 0;font-size:11px;color:#7c3aed;font-style:italic;">` +
                    `Local vault Glossary does not yet carry this concept. Open the Twin entry for the canonical definition.` +
                  `</p>`,
        icon:     '🌐',
        twinUrl:  twinHit.url,
      } as TextResult
    }
  }

  // Path 3 — local loose match (top hit exists but is not an exact-name match
  // and Twin had nothing exact either) — surface it with the warning badge
  if (localTop) return localTop

  // Path 4 — nothing
  return null
})

/** r35 — provenance of the primary card, drives the badge in the template. */
const primarySource = computed<'local-exact' | 'local-loose' | 'twin' | null>(() => {
  const q = queryText.value.trim()
  const p = primaryGlossary.value
  if (!p) return null
  if (p.id.startsWith('twin:')) return 'twin'
  if (_isLocalExactNameMatch(p, q)) return 'local-exact'
  return 'local-loose'
})

/** Other Glossary matches — exclude the chosen primary so it doesn't appear twice. */
const secondaryGlossary = computed<TextResult[]>(() => {
  const primaryId = primaryGlossary.value?.id
  return glossaryMatches.value.filter(t => t.id !== primaryId).slice(0, 12)
})

// r34 viewer state (replaces the r31 always-on auto-advance).
type ViewerMode = 'diagram' | 'rotating' | 'manual'
const viewerMode         = ref<ViewerMode>('diagram')
const carouselIndex      = ref(0)              // current index when rotating OR manual
const carouselAuto       = ref(false)          // mirrors viewerMode === 'rotating' for legacy
const carouselWindowSize = ref(10)             // 10 in the strip (2 × 5)
const carouselOffset     = ref(0)              // offset into illustrationResults (for "Load 10 more")
const carouselTimer      = ref<number | null>(null)

const carouselWindow = computed<GilbIllustration[]>(() =>
  illustrationResults.value.slice(0, carouselWindowSize.value),
)
const currentCarouselIll = computed<GilbIllustration | null>(() =>
  carouselWindow.value[carouselIndex.value] ?? null,
)
function _stopCarouselAuto(): void {
  if (carouselTimer.value !== null) {
    window.clearInterval(carouselTimer.value)
    carouselTimer.value = null
  }
}
function _carouselSize(): number {
  // r33 — count Glossary diagram slot if present.
  return carouselWindow.value.length + (glossaryDiagramSvg.value ? 1 : 0)
}
function _startCarouselAuto(): void {
  _stopCarouselAuto()
  if (viewerMode.value !== 'rotating') return
  // r34 — rotation cycles through ILLUSTRATIONS only, not the diagram.
  const illsLen = carouselWindow.value.length
  if (illsLen <= 1) return
  const diagOffset = glossaryDiagramSvg.value ? 1 : 0
  carouselTimer.value = window.setInterval(() => {
    if (viewerMode.value !== 'rotating') { _stopCarouselAuto(); return }
    const newThumbIdx = (carouselIndex.value - diagOffset + 1) % illsLen
    carouselIndex.value = newThumbIdx + diagOffset
  }, 10_000)
}
function nextCarousel(): void {
  const total = _carouselSize()
  if (!total) return
  carouselIndex.value = (carouselIndex.value + 1) % total
  if (carouselAuto.value) _startCarouselAuto()
}
function prevCarousel(): void {
  const total = _carouselSize()
  if (!total) return
  carouselIndex.value = (carouselIndex.value - 1 + total) % total
  if (carouselAuto.value) _startCarouselAuto()
}
// r41 v21 (Tom Gilb 2026-06-14 verbatim: "+ next 10 button probably added 10
// more, but there was no feedback, seemed dead, we could say '+10 ills added
// below' and auto scroll down to them, and separate each group of 10
// visually") — three-part fix:
//   (1) toast confirms how many were added (+ how many remain in the index)
//   (2) auto-scroll the body so the newly-added first thumb of the new batch
//       is at the top of the visible scroll area, with a violet flash
//   (3) batch separator visually divides each group of 10 in the grid (see
//       template — every 10th thumb gets a top-of-batch label)
const _newBatchStartIdx = ref<number>(-1)  // flash anchor — the first thumb of the just-added batch
function loadMoreCarousel(): void {
  const prevSize = carouselWindowSize.value
  const newSize = Math.min(illustrationResults.value.length, prevSize + 10)
  const added = newSize - prevSize
  carouselWindowSize.value = newSize
  if (added === 0) {
    showToast('📖 No more illustrations in this set — try a broader query', 3500)
    return
  }
  _newBatchStartIdx.value = prevSize
  const remaining = illustrationResults.value.length - newSize
  showToast(
    `📖 +${added} illustration${added === 1 ? '' : 's'} added below (batch ${Math.ceil(newSize / 10)})`
    + (remaining > 0 ? ` · ${remaining} remaining in this query` : ' · last batch'),
    3500,
  )
  // Auto-scroll to the new batch's first thumb after Vue mounts it
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-gilb-thumb-idx="${prevSize}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      // Auto-clear flash after 2 s
      window.setTimeout(() => {
        if (_newBatchStartIdx.value === prevSize) _newBatchStartIdx.value = -1
      }, 2200)
    })
  })
}
function toggleCarouselAuto(): void {
  carouselAuto.value = !carouselAuto.value
  if (carouselAuto.value) _startCarouselAuto()
  else _stopCarouselAuto()
}
// Restart timer when carousel becomes visible or when query changes the result list
watch(showIllustrations, on => {
  carouselIndex.value = 0
  if (on) _startCarouselAuto()
  else    _stopCarouselAuto()
})
watch(illustrationResults, () => {
  carouselIndex.value = 0
  carouselWindowSize.value = 10
  if (showIllustrations.value && carouselAuto.value) _startCarouselAuto()
})
onBeforeUnmount(() => _stopCarouselAuto())

// r34 (Tom Gilb 2026-06-13 spec — 6-point):
//   1. IF Glossary diagram exists → STAY on diagram (NOT rotating)
//   2. Stable until user clicks "Show me other topic illustrations (rotating every 10s)"
//   3. Thumbnail strip below: 10 mini-pictures in 2×5 grid, visible without scroll
//   4. Click any thumb → main shows that one, STABLE until user re-clicks "Show carousel"
//   5. Export any single picture + the set of 10
//   6. Every picture: Tag · "Go to TomTwin where this illustration is found"
//      OR "Copy URL for this Picture"
//
// Three viewer modes:
//   • 'diagram'   — Glossary mermaid diagram in main (default if available)
//   • 'rotating'  — auto-advance every 10s through the 10-strip
//   • 'manual'    — user clicked a specific thumb; stable until rotate reasserted

const glossaryDiagramSvg = ref<string>('')
// r41 v10 (Tom 2026-06-14) — track when the current main carousel image has
// finished loading so the "pod slow…" spinner overlay vanishes (was permanent
// before, ruining screen clips).  Reset on image change via watcher below.
const _currentImgLoaded = ref(false)

// r41 v16 (Tom Gilb 2026-06-14 "no close and no export" — clicking the chip
// opened the raw image URL in Safari with no SEM UI) — SEM-native illustration
// lightbox with CloseDot + Export following the canonical rule pattern.
const illustrationLightboxOpen = ref(false)
const illustrationLightboxItem = ref<GilbIllustration | null>(null)
function openIllustrationLightbox(item: GilbIllustration): void {
  illustrationLightboxItem.value = item
  illustrationLightboxOpen.value = true
  if (typeof document !== 'undefined') document.body.style.overflow = 'hidden'
}

// r41 v222 (Tom Gilb 2026-06-19 "I clicke a picture from my book, not the
// cover, it jumped out of the entire window") — BookKaleidoscope emits this
// instead of using a raw `<a href={illustrationUrl} target="_blank">` link
// that Safari was rendering as a bare image with no SEM UI.  Build a
// GilbIllustration-shaped object from the kaleidoscope book and open the
// SEM-native lightbox so the user stays inside SEM with CloseDot + Export.
interface _KaleidoscopeBook {
  title:                string
  bookId?:              string
  subdomain?:           string
  illustrationUrl:      string
  illustrationCaption?: string
  illustrationPage?:    number | null
}
function onKaleidoscopeIllustrationClick(book: _KaleidoscopeBook): void {
  const filename = book.illustrationUrl.split('/').pop() ?? 'illustration'
  const synth: GilbIllustration = {
    id:           `${book.bookId ?? book.subdomain ?? book.title}/${filename}`,
    bookId:       book.bookId ?? book.subdomain ?? book.title,
    bookTitle:    book.title,
    url:          book.illustrationUrl,
    filename,
    page:         book.illustrationPage ?? null,
    kind:         'Illustration',
    figureIndex:  null,
    chapterTitle: '',
    chapterIndex: null,
    caption:      book.illustrationCaption ?? '',
    keywords:     [],
    ocrText:      '',
  }
  openIllustrationLightbox(synth)
}
function closeIllustrationLightbox(): void {
  illustrationLightboxOpen.value = false
  illustrationLightboxItem.value = null
  if (typeof document !== 'undefined') document.body.style.overflow = ''
}
function _onIllustrationLightboxKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && illustrationLightboxOpen.value) {
    e.stopPropagation()
    closeIllustrationLightbox()
  }
}
onMounted(() => document.addEventListener('keydown', _onIllustrationLightboxKey, true))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', _onIllustrationLightboxKey, true)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

async function exportIllustrationLightbox(): Promise<void> {
  const i = illustrationLightboxItem.value
  if (!i) return
  const isoDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  // Try to embed image as data URI (Notes-compatible).
  const dataUri = await _fetchAsDataUri(i.url)
  const imgSrc = dataUri ?? i.url
  const escapeHtmlLocal = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]!)
  const book = escapeHtmlLocal(i.bookTitle || '')
  const chap = escapeHtmlLocal(i.chapterTitle || '')
  const cap = escapeHtmlLocal(i.caption || '')
  const page = i.page ? `p.${i.page}` : ''
  const url = escapeHtmlLocal(i.url || '')
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${book} ${page}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table cellpadding="0" cellspacing="0" border="0" width="1000" align="center" bgcolor="#ffffff" style="background:#ffffff;border-collapse:collapse;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,23,42,0.08);margin:0 auto;">
  <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:22px 32px;">
    <div style="font-size:11px;color:#a78bfa;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Illustration from Tom Gilb's published corpus</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;margin-top:4px;">${book}${page ? ` <span style="color:#cbd5e1;font-weight:500;font-size:18px;">· ${page}</span>` : ''}</div>
    ${chap ? `<div style="font-size:13px;color:#cbd5e1;margin-top:4px;font-style:italic;">${chap}</div>` : ''}
  </td></tr>
  <tr><td style="padding:0;text-align:center;background:#f8fafc;">
    <img src="${imgSrc}" alt="${cap || book}" style="display:block;max-width:100%;height:auto;margin:0 auto;" />
  </td></tr>
  ${cap && cap !== chap ? `<tr><td style="padding:14px 32px;background:#ffffff;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.55;color:#1e293b;"><strong>Caption:</strong> ${cap}</td></tr>` : ''}
  <tr><td style="padding:12px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:11px;color:#475569;">
    <strong>Source URL:</strong> <a href="${url}" style="color:#7c3aed;text-decoration:none;">${url}</a>
  </td></tr>
  <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:14px 32px;font-size:10px;color:#94a3b8;line-height:1.5;">
    <strong style="color:#cbd5e1;">SEM App</strong> · Exported ${isoDate} · &#x2318;I picker → 🔍 Enlarge → Export<br>
    <strong style="color:#cbd5e1;">Tom Gilb Consultant Twin</strong> — Kai Gilb's commercial product, free reading tier · <a href="https://www.gilb.com/tomtwin" style="color:#a78bfa;text-decoration:none;">gilb.com/tomtwin ↗</a>
  </td></tr>
</table>
</body></html>`
  const plain = `${i.bookTitle}${i.page ? ' · p.' + i.page : ''}${i.chapterTitle ? '\n' + i.chapterTitle : ''}${i.caption && i.caption !== i.chapterTitle ? '\n' + i.caption : ''}\nSource: ${i.url}\nExported: ${isoDate}\n\nSourced from Tom Gilb Consultant Twin — https://www.gilb.com/tomtwin\n`
  // r41 v20 — wrap with action bar (Open Mail / Copy / Save / Close)
  const subjectIll = `${i.bookTitle}${i.page ? ' · p.' + i.page : ''} — illustration · ${isoDate}`
  const sepIll = '─'.repeat(56)
  const mailtoBodyIll = ['PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION', `Exported: ${isoDate}`, sepIll, '', '[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]'].join('\n')
  const wrappedHtmlIll = _wrapPreviewWithActions({
    innerHtml: html,
    subject:   subjectIll,
    plainBody: mailtoBodyIll,
    title:     `${i.bookTitle}${i.page ? ' · p.' + i.page : ''} — illustration`,
  })
  try {
    const w = window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')
    if (w) { w.document.open(); w.document.write(wrappedHtmlIll); w.document.close() }
  } catch (err) { console.warn('[exportIllustrationLightbox] preview window failed', err) }
  let clipboardOK = false
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
      clipboardOK = true
    } catch (err) { console.warn('[exportIllustrationLightbox] clipboard.write failed', err) }
  }
  if (!clipboardOK) {
    try { await navigator.clipboard.writeText(plain); clipboardOK = true } catch { /* continue */ }
  }
  window.location.href = `mailto:Tom@Gilb.com?subject=${encodeURIComponent(subjectIll)}&body=${encodeURIComponent(mailtoBodyIll)}`
  showToast(`📧 Mail opening + preview window has Open Mail / Copy / Save / Close buttons — ⌘V in Mail to paste the colourful illustration${clipboardOK ? '' : ' · clipboard failed'}`, 6500)
}
// r37 (Tom Gilb 2026-06-14 verbatim: "the tiny digram does not enlarge") —
// fullscreen lightbox state for the embedded ontology diagram.
const diagramExpanded = ref(false)
function _onDiagramEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape' && diagramExpanded.value) {
    diagramExpanded.value = false
    e.stopPropagation()  // don't ALSO close the picker
  }
}
onMounted(() => document.addEventListener('keydown', _onDiagramEsc, true))
onBeforeUnmount(() => document.removeEventListener('keydown', _onDiagramEsc, true))
const glossaryDiagramTerm = ref<string>('')   // the term the current SVG was rendered for

let _mermaidLib: { render: (id: string, src: string) => Promise<{ svg: string }> ; initialize: (opts: object) => void } | null = null
async function _loadMermaid(): Promise<typeof _mermaidLib> {
  if (_mermaidLib) return _mermaidLib
  const w = window as unknown as { mermaid?: typeof _mermaidLib }
  if (w.mermaid) { _mermaidLib = w.mermaid; return _mermaidLib }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = '/mermaid.min.js'
    s.onload = () => {
      const w2 = window as unknown as { mermaid?: typeof _mermaidLib }
      if (w2.mermaid) { _mermaidLib = w2.mermaid; resolve(_mermaidLib) }
      else reject(new Error('mermaid global not found after load'))
    }
    s.onerror = () => reject(new Error('Failed to load /mermaid.min.js'))
    document.head.appendChild(s)
  })
}

watch(primaryGlossary, async (entry) => {
  glossaryDiagramSvg.value = ''
  glossaryDiagramTerm.value = ''
  // r36 — collapse the primary definition when the entry changes (new query).
  primaryExpanded.value = false
  chapterShowAll.value = false
  if (!entry) return
  const term = entry.title.replace(/ \*\d+$/, '')
  try {
    const res = await fetch(`/api/glossary?term=${encodeURIComponent(term)}`)
    if (!res.ok) return
    const md = await res.text()
    // Extract first ```mermaid block
    const m = md.match(/```mermaid\s*\n([\s\S]+?)```/m)
    if (!m) return
    const src = m[1].trim()
    if (!src) return
    const mermaid = await _loadMermaid()
    if (!mermaid) return
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    const id = `gilb-picker-onto-${Date.now()}`
    const { svg } = await mermaid.render(id, src)
    glossaryDiagramSvg.value = svg
    glossaryDiagramTerm.value = term
    // Reset to position 0 so the diagram appears immediately
    carouselIndex.value = 0
  } catch (e) {
    console.warn('[GilbPicker] Glossary diagram render failed:', e)
  }
})

// r41 v4 (Tom Gilb 2026-06-14 verbatim: "in sem when we bring to glossary
// diagram I asked for click on any part of the diagram, and skip to its
// diagram , is that possible?") — YES.  After mermaid renders the SVG, walk
// the DOM to find every <g class="node"> element, extract its concept label,
// and attach a click handler that types that concept into the picker's search
// box.  The existing watch(primaryGlossary) chain then re-fetches the Glossary
// entry, re-renders its mermaid source, and the new diagram replaces the old
// one in the same spot.  Intra-diagram navigation = drill-in through the
// Planguage ontology with one click per concept.
//
// Implementation detail: mermaid emits each node as <g class="node ...">
// containing a <text>...</text> element with the label.  Label format is
// either "*NNN Concept Name" or "Concept Name" or "Concept Name *NNN" — we
// strip the *NNN concept number and trim before searching.  Clicks bubble
// to the wrapper button (which enlarges) so we stopPropagation on node hits.
function _stripConceptNumber(label: string): string {
  // r41 v14 (Tom Gilb 2026-06-14 verbatim "I clicked on bug and this syst eng
  // diagram came up. BUG") — node labels can include rich annotation like
  // "Bug / Fault *339(defect in the implemented system — latent)".  The old
  // regex only stripped *NNN at start or end, leaving the slash-alias and
  // parenthetical → garbled query → wrong primary card.
  //
  // New rules, in order:
  //   1. Drop everything from the first '(' onward (the parenthetical defn).
  //   2. Drop ANY *NNN[letter] token anywhere in the string.
  //   3. Take the FIRST term before a '/' (slash separates aliases — first is
  //      the canonical concept name).
  //   4. Collapse whitespace + trim.
  let s = label
  s = s.replace(/\([^)]*\)?/g, ' ')              // step 1 — kill (...) blocks
  s = s.replace(/\*\d+[a-z]?/gi, ' ')            // step 2 — kill *NNN tokens
  if (s.includes('/')) s = s.split('/')[0]       // step 3 — first slash-alias
  s = s.replace(/\s+/g, ' ').trim()              // step 4 — collapse + trim
  return s
}

function _wireDiagramNodeClicksOn(host: HTMLElement): void {
  const nodes = host.querySelectorAll<SVGGElement>('g.node, g.cluster')
  nodes.forEach((node) => {
    const labelText = (node.querySelector('text, foreignObject')?.textContent ?? '').trim()
    if (!labelText) return
    const concept = _stripConceptNumber(labelText)
    if (!concept) return
    if (concept.toLowerCase() === glossaryDiagramTerm.value.toLowerCase()) return
    node.style.cursor = 'pointer'
    node.setAttribute('data-gilb-concept', concept)
    node.setAttribute('aria-label', `Click to navigate to the ${concept} Glossary entry and its ontology diagram`)
    node.classList.add('gilb-diagram-node-clickable')
  })
  host.onclick = (e: MouseEvent) => {
    const target = e.target as Element | null
    if (!target) return
    const nodeG = target.closest('[data-gilb-concept]') as HTMLElement | null
    if (!nodeG) return
    e.stopPropagation()
    e.preventDefault()
    const concept = nodeG.getAttribute('data-gilb-concept')
    if (!concept) return
    queryText.value = concept
    // r41 v13 (Tom Gilb 2026-06-14 — fullscreen-diagram-clicks-not-wired bug)
    // If a node is clicked WHILE the fullscreen lightbox is open, close the
    // lightbox so the parent picker lands on the new concept's freshly-rendered
    // diagram + Glossary card (same UX pattern as PlanguageUniverse fullscreen).
    if (diagramExpanded.value) {
      diagramExpanded.value = false
    }
  }
}

function _wireDiagramNodeClicks(): void {
  // r41 v13 (Tom 2026-06-14 screenshot: "these were not clickable" — lightbox
  // diagram nodes did nothing).  Wire BOTH the embedded host AND the
  // fullscreen lightbox host.  Each has its own onclick delegation; the
  // embedded host stays put when lightbox opens (just hidden behind it).
  const embedded = document.querySelector<HTMLElement>('.gilb-mermaid-host-large')
  if (embedded) _wireDiagramNodeClicksOn(embedded)
  const fullscreen = document.querySelector<HTMLElement>('.gilb-mermaid-host-fullscreen')
  if (fullscreen) _wireDiagramNodeClicksOn(fullscreen)
}

// Watch the rendered SVG: after Vue has injected the HTML via v-html, wait two
// animation frames so the SVG is parsed and laid out, then attach handlers.
watch(glossaryDiagramSvg, (svg) => {
  if (!svg) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _wireDiagramNodeClicks()
    })
  })
})

// r41 v13 — when the lightbox opens, its v-html re-injects the SVG; the
// previously-wired DOM nodes inside the embedded host are NOT the same nodes
// as those in the new lightbox host.  Re-run wiring after Vue mounts the
// lightbox content.
watch(diagramExpanded, (open) => {
  if (!open) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _wireDiagramNodeClicks()
    })
  })
})

// Composite carousel — if a Glossary diagram is available, it's slot 0;
// then come the illustration matches up to the window size.
const carouselTotalLength = computed(() =>
  carouselWindow.value.length + (glossaryDiagramSvg.value ? 1 : 0),
)
const isCarouselSlotDiagram = computed(() =>
  !!glossaryDiagramSvg.value && carouselIndex.value === 0,
)
const _illustrationOffset = computed(() => glossaryDiagramSvg.value ? -1 : 0)
const currentCarouselIllAdjusted = computed<GilbIllustration | null>(() => {
  if (isCarouselSlotDiagram.value) return null
  return carouselWindow.value[carouselIndex.value + _illustrationOffset.value] ?? null
})
// r41 v10 — reset image-loaded flag whenever the main carousel illustration
// changes, so the spinner re-appears for the new image until @load fires.
watch(() => currentCarouselIllAdjusted.value?.id, () => {
  _currentImgLoaded.value = false
})

// r34 — Mode-switching API.
function showDiagram(): void {
  _stopCarouselAuto()
  viewerMode.value  = 'diagram'
  carouselAuto.value = false
  carouselIndex.value = 0
}
function showRotating(): void {
  viewerMode.value   = 'rotating'
  carouselAuto.value = true
  // Start rotation index at slot 1 (first illustration) if diagram is in slot 0
  carouselIndex.value = glossaryDiagramSvg.value ? 1 : 0
  _startCarouselAuto()
}
// r41 (Tom Gilb 2026-06-14 verbatim: "when thumb is clicked, id like a
// feedback reaction, and then it needs to go itself to the upper picture of
// the thumbnail") — selectThumb now:
//   (1) flashes the clicked thumbnail with a violet pulse (visual feedback)
//   (2) updates carouselIndex so main picture re-renders the chosen image
//   (3) smooth-scrolls the main-picture area into view at top of body
const _clickedThumbIdx = ref<number | null>(null)
function selectThumb(idxInWindow: number): void {
  _stopCarouselAuto()
  viewerMode.value    = 'manual'
  carouselAuto.value  = false
  // (1) feedback flash
  _clickedThumbIdx.value = idxInWindow
  window.setTimeout(() => {
    if (_clickedThumbIdx.value === idxInWindow) _clickedThumbIdx.value = null
  }, 900)
  // (2) update main picture
  // If diagram occupies slot 0, the displayed index needs to be +1 to address the illustration.
  carouselIndex.value = idxInWindow + (glossaryDiagramSvg.value ? 1 : 0)
  // (3) auto-scroll the picker body to the very top — the ILLUSTRATIONS
  // section is order-1 (first in flex column) so scrollTop:0 lands on the
  // main-picture container.  Robust against image-load timing because we
  // scroll the CONTAINER, not the element-with-data-attr (which may not
  // have its new image rendered yet).
  // r41 v3 (Tom 2026-06-14 verbatim "clicking on thumb does NOT scroll up to
  // main picture") — previous nextTick + scrollIntoView() approach was racing
  // image load + flex re-layout.  Direct scrollTo on the scroll container
  // works deterministically.  Two RAFs guarantee the new image has triggered
  // a layout pass before we scroll.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollEl = document.querySelector<HTMLElement>('.gilb-picker-scroll-inner')
      if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })
}

// r34 — Per-illustration actions.
function twinBookUrl(i: GilbIllustration): string {
  return `https://www.gilb.com/tomtwin/book/${i.bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}
function illTag(i: GilbIllustration): string {
  return i.keywords?.[0] ?? i.chapterTitle ?? `${i.bookTitle} p.${i.page ?? '?'}`
}
async function copyUrl(url: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url)
    console.log(`[GilbPicker] copied ${label} URL: ${url}`)
  } catch (e) {
    console.warn('[GilbPicker] copy failed', e)
  }
}

// r41 v31 — TRUE blob-download for "📥 Export pic" — Tom Gilb 2026-06-15
// verbatim BUG report: *"WE GOT TO THIS IMAGE, DEAD STOP, NO REVERT, NO CLOSE
// VIOLATES THE RULE I TRIED TO TEACH TODAY, ALWAYS UNDO ALWAYS CLOSE ETC"*.
//
// Root cause: the old `<a href=ill.url download target="_blank">` pattern
// causes Safari to IGNORE the `download` attribute for cross-origin URLs
// and instead navigate the new tab to the raw image — dead-ending the user
// on a page with no SEM UI (no CloseDot, no back button beyond Safari's).
//
// Fix: fetch the bytes via JS, create a blob URL, click a hidden anchor with
// the SAME-ORIGIN blob URL (which Safari WILL honour the download attribute on).
// No navigation, no dead-end.  If the fetch fails (CORS, network), fall back
// to opening the raw URL in a TRUE new tab with `noopener` AND surfacing a
// toast that names the failure so the user knows what happened.
//
// Composes with: Universal Undo SUPREME (file-saves are external actions and
// stay non-undoable per the rule's "What stays NOT undoable" exception list,
// but the previously-broken "dead-end nav" was the actual rule violation —
// now closed); CloseDot rule (no SEM UI surface is replaced with a raw image
// URL); MOVE Principle (one click does the right thing).
async function saveIllustrationFile(i: GilbIllustration | null): Promise<void> {
  if (!i) return
  try {
    const res = await fetch(i.url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href     = blobUrl
    a.download = i.filename || (i.url.split('/').pop() ?? 'illustration.png')
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Defer revoke a tick so Safari completes the download trigger first.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
    showToast(`📥 Saved ${a.download} to your Downloads folder.`, 3500)
  } catch (err) {
    console.warn('[GilbPicker] blob download failed; falling back to new-tab open', err)
    // Safe fallback: open in a TRUE new tab (noopener) so SEM stays put.
    const w = window.open(i.url, '_blank', 'noopener,noreferrer')
    if (!w) {
      showToast('📥 Could not auto-download (CORS) and pop-ups blocked.  Right-click "Copy URL" instead.', 5500)
    } else {
      showToast(`📥 Cross-origin save blocked — opened raw image in a new tab.  ⌘W there to return to SEM.`, 5500)
    }
  }
}
// r41 v8 (Tom Gilb 2026-06-14 verbatim: "when I copied all 10 illustration,
// and then pasted to notes, i got only text, i expect the illustrations, maybe
// neatly separated and with a text below them (source, page, text on the ill)")
// — fix: write text/html to clipboard via ClipboardItem so Apple Notes (and
// any HTML-aware paste target) fetches the actual images and embeds them.
// Plain-text fallback is still written for text-only targets.
//
// Layout per illustration: card-style block — image at top, then under it:
//   bold book title · italic chapter title · "p.N" · caption text
// Each card has a thin slate border, ~16 px gap, all in ONE outer table per
// r93aaa one-table-for-cohesion (pastes as one cohesive document, not split
// across Keynote slides).
function _escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!)
}
// r41 v9 (Tom Gilb 2026-06-14 verbatim: "pasting 10, went well in apple mail,
// but not in notes, no ills at all only links and they were not live") —
// Apple Notes strips `<img src="https://...">` (remote URLs) on paste — security
// default.  Fix: fetch each illustration as a blob, convert to base64 data URI,
// embed inline.  Data URIs are treated as local content by Notes and render.
// Also restructure to simple <div>/<p> blocks (no nested tables) since Notes
// handles flow content more reliably than tables.
async function _fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('[GilbPicker] data-URI fetch failed for', url, err)
    return null
  }
}
function _renderIllustrationsHtml(items: Array<GilbIllustration & { embedSrc?: string | null }>, q: string): string {
  const head = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;">Top ${items.length} illustrations${q ? ` for &ldquo;${_escapeHtml(q)}&rdquo;` : ''}</div>
    <div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:14px;">From Tom Gilb's published corpus · &#x2318;I in the SEM App · ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>`
  const rows = items.map((i, idx) => {
    const cap = _escapeHtml(i.caption || i.chapterTitle || i.filename || '')
    const book = _escapeHtml(i.bookTitle || '')
    const chap = _escapeHtml(i.chapterTitle || '')
    const page = i.page ? `p.${i.page}` : ''
    const url = _escapeHtml(i.url || '')
    // Prefer data URI (embeds into Notes) — fall back to remote URL (works in Mail).
    const imgSrc = i.embedSrc ?? url
    return `<div style="margin:0 0 22px 0;padding:0;">
      <div style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">&#x2014; ${idx + 1} &#x2014;</div>
      <img src="${imgSrc}" alt="${cap}" style="display:block;max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:6px;margin:0 0 8px 0;" />
      <p style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 2px 0;">${book}${page ? ` <span style="color:#64748b;font-weight:400;">&middot; ${page}</span>` : ''}</p>
      ${chap ? `<p style="font-size:11px;color:#475569;font-style:italic;margin:0 0 4px 0;">${chap}</p>` : ''}
      ${cap && cap !== chap ? `<p style="font-size:12px;color:#1e293b;margin:0 0 4px 0;line-height:1.4;">${cap}</p>` : ''}
      <p style="font-size:10px;color:#64748b;margin:4px 0 0 0;">Source: <a href="${url}" style="color:#7c3aed;">${url}</a></p>
    </div>`
  }).join('\n')
  return head + rows + `<p style="font-size:10px;color:#94a3b8;margin-top:8px;font-style:italic;">Sourced from <a href="https://www.gilb.com/tomtwin" style="color:#7c3aed;">Tom Gilb Consultant Twin</a> (free reading tier &middot; Kai Gilb).</p>`
}
function _renderIllustrationsPlain(items: GilbIllustration[], q: string): string {
  const head = `# Top ${items.length} illustrations${q ? ` for "${q}"` : ''}\n# From Tom Gilb's published corpus · ⌘I in the SEM App\n\n`
  const rows = items.map((i, idx) => {
    const cap = (i.caption || i.chapterTitle || i.filename || '').replace(/[[\]]/g, '')
    const lines = [
      `${idx + 1}. ${i.bookTitle}${i.page ? ' · p.' + i.page : ''}`,
      i.chapterTitle ? `   ${i.chapterTitle}` : null,
      cap && cap !== i.chapterTitle ? `   ${cap}` : null,
      `   ${i.url}`,
    ].filter(Boolean)
    return lines.join('\n')
  }).join('\n\n')
  return head + rows + '\n\nSourced via the Tom Gilb Consultant Twin — https://www.gilb.com/tomtwin\n'
}
// r41 v20 (Tom Gilb 2026-06-14: "no options lie email and no close button" on
// the export preview window) — every preview HTML now opens inside a sticky
// action bar wrapper.  Buttons: Open Mail (re-fires mailto) · Copy HTML to
// clipboard · Save as .html · Close window.  Plus a clear hint about what's
// already on the clipboard so the user knows the ⌘V paste path.
function _wrapPreviewWithActions(opts: {
  innerHtml:  string
  subject:    string
  plainBody:  string  // SEM Email Body Standard body (LOUD ⌘V cue + stamp + sep + edit-prompt)
  title:      string
}): string {
  const escAttr = (s: string) => s.replace(/&/g,'&amp;').replace(/'/g,'&apos;').replace(/"/g,'&quot;')
  const mailto = `mailto:Tom@Gilb.com?subject=${encodeURIComponent(opts.subject)}&body=${encodeURIComponent(opts.plainBody)}`
  // Strip the existing <!DOCTYPE/html/head/body> from innerHtml — we'll wrap it
  // in our own document.  Tolerant of partial-document innerHtml (just <table>).
  let body = opts.innerHtml
  body = body.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '')
  // Inline JS for the copy + close + save actions.  All run on click (user
  // gesture) which satisfies the clipboard-permission requirement.
  const actionsJs = `
    <script>
    (function() {
      const HTML_BLOB = ${JSON.stringify(opts.innerHtml)};
      const PLAIN_TEXT = ${JSON.stringify(opts.plainBody)};
      async function copyHtml() {
        try {
          if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([new ClipboardItem({
              'text/html':  new Blob([HTML_BLOB],  { type: 'text/html'  }),
              'text/plain': new Blob([PLAIN_TEXT], { type: 'text/plain' }),
            })]);
          } else {
            await navigator.clipboard.writeText(PLAIN_TEXT);
          }
          showFlash('Copied colourful HTML + plain to clipboard — ⌘V into Mail / Notes / Pages');
        } catch (err) {
          showFlash('Copy failed — try clicking ⌘C with this page selected', true);
        }
      }
      function saveHtml() {
        const blob = new Blob([HTML_BLOB], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ${JSON.stringify(opts.title.replace(/[^\w\-]+/g, '-').slice(0, 80) + '.html')};
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showFlash('Saved to Downloads');
      }
      function closeWin() { window.close(); }
      function showFlash(msg, err) {
        const el = document.getElementById('gilb-flash');
        if (!el) return;
        el.textContent = msg;
        el.style.background = err ? '#fee2e2' : '#dcfce7';
        el.style.color = err ? '#991b1b' : '#166534';
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 3500);
      }
      window.gilbCopy  = copyHtml;
      window.gilbSave  = saveHtml;
      window.gilbClose = closeWin;
    })();
    </${'script'}>`
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${escAttr(opts.title)}</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; }
  #gilb-actions { position:sticky; top:0; z-index:1000; background:#ffffff; border-bottom:2px solid #e2e8f0; padding:12px 24px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; box-shadow:0 2px 8px rgba(15,23,42,0.06); }
  #gilb-actions .title { font-weight:800; color:#0f172a; font-size:14px; flex:1; min-width:200px; }
  #gilb-actions .hint  { font-size:11px; color:#64748b; font-style:italic; flex:1; min-width:240px; }
  #gilb-actions a, #gilb-actions button { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:6px; font-weight:700; font-size:13px; text-decoration:none; cursor:pointer; border:1px solid transparent; line-height:1; }
  #gilb-actions .btn-mail { background:#7c3aed; color:#ffffff; border-color:#6d28d9; }
  #gilb-actions .btn-mail:hover { background:#6d28d9; }
  #gilb-actions .btn-copy { background:#fef3c7; color:#92400e; border-color:#fcd34d; }
  #gilb-actions .btn-copy:hover { background:#fde68a; }
  #gilb-actions .btn-save { background:#dbeafe; color:#1e40af; border-color:#93c5fd; }
  #gilb-actions .btn-save:hover { background:#bfdbfe; }
  #gilb-actions .btn-close { background:#ef4444; color:#ffffff; border-color:#dc2626; }
  #gilb-actions .btn-close:hover { background:#dc2626; }
  #gilb-flash { transition:opacity 0.4s ease; opacity:0; padding:6px 12px; border-radius:6px; font-weight:600; font-size:12px; background:#dcfce7; color:#166534; margin-left:8px; }
  #gilb-content { padding:24px; }
</style>
</head><body>
<div id="gilb-actions">
  <div class="title">📄 ${escAttr(opts.title)}</div>
  <a class="btn-mail" href="${escAttr(mailto)}" title="Open Mail with the SEM Email Body Standard pre-filled — paste with ⌘V"><span>📧</span><span>Open Mail</span></a>
  <button type="button" class="btn-copy" onclick="window.gilbCopy()" title="Copy the colourful HTML + plain text to your clipboard — ⌘V into any HTML-aware app"><span>📋</span><span>Copy</span></button>
  <button type="button" class="btn-save" onclick="window.gilbSave()" title="Save this preview as a stand-alone .html file to Downloads"><span>💾</span><span>Save</span></button>
  <button type="button" class="btn-close" onclick="window.gilbClose()" title="Close this preview window"><span>✕</span><span>Close</span></button>
  <span id="gilb-flash"></span>
</div>
<div class="hint" style="padding:6px 24px 0 24px;font-size:11px;color:#64748b;font-style:italic;">SEM App export preview — the colourful HTML is already on your clipboard from the export action.  These buttons let you re-trigger if needed.</div>
<div id="gilb-content">
${body}
</div>
${actionsJs}
</body></html>`
}

// r41 v15 (Tom Gilb 2026-06-14: "no export from here") — Universal
// Export-on-all-windows rule binds to the diagram lightbox too.
// Builds a single colourful HTML document containing the diagram's
// rendered SVG, term + concept number, Twin URL, ⌘V cue, then opens
// preview + clipboard + Mail.
async function exportLightboxDiagram(): Promise<void> {
  if (!glossaryDiagramSvg.value || !glossaryDiagramTerm.value) {
    showToast('Diagram not ready — try again in a moment', 3000)
    return
  }
  // Look up the local Glossary entry (verified twinUrl) for the current term.
  const term = glossaryDiagramTerm.value
  const matches = glossarySearch(term, { limit: 1 })
  const entry = matches[0]
  const twinUrl = entry?.twinUrl ?? `https://www.gilb.com/tomtwin/?q=${encodeURIComponent(term)}`
  const conceptNumber = entry?.conceptNumber ? `*${entry.conceptNumber}` : ''
  const isoDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  // Build a self-contained HTML document with the rendered SVG inline.
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${term} ${conceptNumber} — Planguage Ontology Diagram</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table cellpadding="0" cellspacing="0" border="0" width="1000" align="center" bgcolor="#ffffff" style="background:#ffffff;border-collapse:collapse;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,23,42,0.08);margin:0 auto;">
  <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:22px 32px;">
    <div style="font-size:11px;color:#a78bfa;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Planguage Ontology Diagram</div>
    <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:4px;letter-spacing:0.3px;">${term} ${conceptNumber ? `<span style="color:#a78bfa;font-weight:600;font-size:18px;margin-left:6px;">${conceptNumber}</span>` : ''}</div>
    <div style="font-size:12px;color:#cbd5e1;margin-top:8px;">From the local Planguage Glossary · 663 concepts · vault tier 1</div>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;background:#ffffff;">
    <div style="max-width:100%;overflow:auto;">${glossaryDiagramSvg.value}</div>
  </td></tr>
  <tr><td style="padding:14px 32px 18px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.55;">
    <strong>Open this concept on Tom Gilb Consultant Twin:</strong>
    <div style="margin-top:4px;"><a href="${twinUrl}" style="color:#7c3aed;font-weight:600;text-decoration:none;">${twinUrl}</a></div>
    ${entry?.definition ? `<div style="margin-top:10px;color:#1e293b;font-size:13px;"><strong>Definition:</strong> ${entry.definition.replace(/\s+/g, ' ').trim().slice(0, 360)}${entry.definition.length > 360 ? '…' : ''}</div>` : ''}
  </td></tr>
  <tr><td bgcolor="#0f172a" style="background:#0f172a;padding:14px 32px;font-size:10px;color:#94a3b8;line-height:1.5;">
    <strong style="color:#cbd5e1;">SEM App</strong> · Exported ${isoDate} · &#x2318;I picker → enlarged diagram → Export<br>
    <strong style="color:#cbd5e1;">Tom Gilb Consultant Twin</strong> — Kai Gilb's commercial product, free reading tier · <a href="https://www.gilb.com/tomtwin" style="color:#a78bfa;text-decoration:none;">gilb.com/tomtwin ↗</a>
  </td></tr>
</table>
</body></html>`
  const plain = `${term} ${conceptNumber} — Planguage Ontology Diagram\nExported: ${isoDate}\n\nSource: local Planguage Glossary (663 concepts, vault tier 1)\nTwin URL: ${twinUrl}\n${entry?.definition ? '\nDefinition:\n' + entry.definition.replace(/\s+/g, ' ').trim() : ''}\n\n[Mermaid SVG omitted in plain text — see HTML export above for the rendered diagram]\n\nSourced from Tom Gilb Consultant Twin — https://www.gilb.com/tomtwin\n`
  // r41 v20 — wrap preview with action bar (Open Mail / Copy / Save / Close)
  const subject = `${term} ${conceptNumber} — Planguage Ontology Diagram · ${isoDate}`
  const separator = '─'.repeat(56)
  const mailtoBody = [
    'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
    `Exported: ${isoDate}`,
    separator,
    '',
    '[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]',
  ].join('\n')
  const wrappedHtml = _wrapPreviewWithActions({
    innerHtml: html,
    subject,
    plainBody: mailtoBody,
    title: `${term} ${conceptNumber} — Planguage Ontology Diagram`,
  })
  try {
    const w = window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')
    if (w) { w.document.open(); w.document.write(wrappedHtml); w.document.close() }
  } catch (err) { console.warn('[exportLightboxDiagram] preview window failed', err) }
  // Clipboard
  let clipboardOK = false
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
      clipboardOK = true
    } catch (err) { console.warn('[exportLightboxDiagram] clipboard.write failed', err) }
  }
  if (!clipboardOK) {
    try { await navigator.clipboard.writeText(plain); clipboardOK = true } catch { /* continue */ }
  }
  // Mail auto-open per SEM Email Body Standard
  // r41 v20 — vars `subject` + `mailtoBody` already declared above for the
  // preview wrapper.  Fire mailto and toast.
  window.location.href = `mailto:Tom@Gilb.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`
  showToast(
    `📧 Mail opening + preview window has Open Mail / Copy / Save / Close buttons — press ⌘V in Mail to paste the colourful ${term} ontology diagram`
    + (clipboardOK ? '' : ' · clipboard write failed'),
    6500,
  )
}

async function copyMarkdownAll(): Promise<void> {
  const items = carouselWindow.value
  if (items.length === 0) {
    showToast('📋 No illustrations to copy yet — type a query first', 3000)
    return
  }
  // r41 v9 — fetch + base64-embed images so Apple Notes accepts them.
  // Mail.app and Pages handle either path; Notes needs data URIs.
  showToast(`📥 Fetching ${items.length} images for embedded copy… (Notes-compatible — ~5–20 s)`, 20000)
  const itemsWithEmbed = await Promise.all(items.map(async (i) => {
    const embedSrc = await _fetchAsDataUri(i.url)
    return { ...i, embedSrc }
  }))
  const embeddedCount = itemsWithEmbed.filter(x => !!x.embedSrc).length
  const html = _renderIllustrationsHtml(itemsWithEmbed, queryText.value)
  const plain = _renderIllustrationsPlain(items, queryText.value)
  let ok = false
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
      ok = true
    } catch (err) {
      console.warn('[GilbPicker copyAll] ClipboardItem write failed:', err)
    }
  }
  if (!ok) {
    try { await navigator.clipboard.writeText(plain); ok = true }
    catch (err) { console.warn('[GilbPicker copyAll] writeText fallback failed:', err) }
  }
  if (ok) {
    const failed = items.length - embeddedCount
    const msg = embeddedCount === items.length
      ? `📋 ${items.length} illustrations copied — ⌘V into Apple Notes / Mail / Pages (images embed natively)`
      : `📋 ${items.length} illustrations copied · ${embeddedCount} fully embedded${failed > 0 ? `, ${failed} as remote URL (CORS-blocked — may not render in Notes)` : ''}`
    showToast(msg, 6500)
  } else {
    showToast('📋 Copy failed — clipboard permission denied', 4000)
  }
}

// r93qqq r15 diagnostic — log every queryText change + the resulting match counts
// so Tom (or anyone) can verify in the Safari console that v-model is firing.
// Remove when search bug is permanently confirmed dead.
watchEffect(() => {
  if (props.open) {
    console.log(`[GilbPicker] query="${queryText.value}" → text:${textResults.value.length}  ills:${illustrationResults.value.length}  totalIndexed:${allIllustrations.value.length}`)
  }
})

// r19 — fire Twin search whenever the picker is open and the query changes.
watch([() => props.open, queryText], ([open, q]) => {
  if (open) _kickTwinSearch(q)
})

/** Build the embed payload for the parent to splice into its text. */
function buildPayload(i: GilbIllustration) {
  const cap = i.caption || i.chapterTitle || i.filename
  const cite = citation(i)
  const markdown =
    `![${cap.replace(/[\[\]]/g, '')}](${i.url})\n\n` +
    `*${cite.plain}*\n`
  const html =
    `<figure style="margin:14px 0;">` +
      `<img src="${i.url}" alt="${escapeAttr(cap)}" style="max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:6px;" />` +
      `<figcaption style="margin-top:6px;">` +
        `<div style="font-size:13px;color:#1e293b;">${escapeHtml(cap)}</div>` +
        `<div style="margin-top:3px;">${cite.html}</div>` +
      `</figcaption>` +
    `</figure>`
  return { illustration: i, html, markdown }
}

/** Build the embed payload for a TEXT result (Glossary entry or chapter excerpt).
 *  Uses the pre-formatted bodyRich (paragraphs + bold/italic/color) for HTML,
 *  and the plain `body` for markdown so plain-text targets stay readable. */
function buildTextPayload(t: TextResult) {
  const linkTail = t.twinUrl ? ` — [Tom Gilb Consultant Twin](${t.twinUrl})` : ''
  const markdown = `> **${t.title}** — ${t.subtitle}\n>\n> ${t.body.replace(/\n/g, '\n> ')}\n>\n> *Source: Tom Gilb${linkTail}*\n`
  const sourceLine = t.twinUrl
    ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:11px;color:#475569;">Source: <em>Tom Gilb</em> — <a href="${t.twinUrl}" target="_blank" rel="noopener" style="color:#5b21b6;">Tom Gilb Consultant Twin</a></div>`
    : `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:11px;color:#475569;">Source: <em>Tom Gilb</em></div>`
  const html =
    `<blockquote style="margin:14px 0;padding:14px 16px;border-left:4px solid #8b5cf6;background:#f5f3ff;border-radius:6px;">` +
      t.bodyRich +
      sourceLine +
    `</blockquote>`
  return { textResult: t, html, markdown }
}

// ── r35 EXPORT — Universal Export-button-on-all-windows rule ─────────────────
// Tom Gilb 2026-06-13: "export on all windows that can exceed the screen".
// Pattern mirrors useMultiVisionExport: build full HTML + plain, open preview
// window, write clipboard, fire mailto to Tom@Gilb.com with SEM Email Body Std.
function _toPickerTextResult(t: TextResult): PickerTextResult {
  return {
    id:        t.id,
    kind:      t.kind,
    title:     t.title,
    subtitle:  t.subtitle,
    body:      t.body,
    twinUrl:   t.twinUrl,
    bookTitle: t.bookTitle,
  }
}

async function exportPicker(): Promise<void> {
  try {
    const exportState: GilbPickerExportState = {
      query:                    queryText.value || '(none)',
      primaryGlossary:          primaryGlossary.value ? _toPickerTextResult(primaryGlossary.value) : null,
      primarySource:            primarySource.value,
      secondaryGlossary:        secondaryGlossary.value.map(_toPickerTextResult),
      chapterMatches:           chapterMatches.value.map(_toPickerTextResult),
      illustrations:            carouselWindow.value,
      totalIllustrationMatches: illustrationResults.value.length,
      twinConceptUrls:          twinResult.value
        ? twinResult.value.conceptUrls.map(c => ({ name: c.name, number: c.number, url: c.url }))
        : [],
      twinText: twinResult.value?.text,
    }

    const isoDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const htmlText  = renderGilbPickerHtml(exportState, isoDate)
    const plainText = renderGilbPickerPlain(exportState, isoDate)
    const subject = `Illumination Picker · "${exportState.query}" · ${isoDate}`
    const separator = '─'.repeat(56)
    const mailtoBody = [
      'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
      `Exported: ${isoDate}`,
      separator,
      '',
      '[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]',
    ].join('\n')

    // Step 2 — preview window (100% of the model, cures the "27% of model" complaint)
    // r41 v20 — wrap with action bar (Open Mail / Copy / Save / Close)
    const wrappedHtmlText = _wrapPreviewWithActions({
      innerHtml: htmlText,
      subject,
      plainBody: mailtoBody,
      title:     `Illumination Picker · ${exportState.query}`,
    })
    try {
      const w = window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')
      if (w) { w.document.open(); w.document.write(wrappedHtmlText); w.document.close() }
    } catch (err) {
      console.warn('[GilbPicker export] preview window failed', err)
    }

    // Step 3 — clipboard (HTML + plain). Must run synchronously enough to stay
    // in user-gesture chain for the mailto auto-open.
    let clipboardOK = false
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':  new Blob([htmlText],  { type: 'text/html'  }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        })])
        clipboardOK = true
      } catch (err) {
        console.warn('[GilbPicker export] clipboard.write failed', err)
      }
    }
    if (!clipboardOK) {
      try { await navigator.clipboard.writeText(plainText); clipboardOK = true } catch { /* continue */ }
    }

    // Step 4 — auto-open Mail to Tom@Gilb.com per SEM Email Body Standard
    const href = `mailto:Tom@Gilb.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`
    window.location.href = href

    // Step 6 — confirmation toast
    showToast(
      '📧 Mail opening — press ⌘V in the body to paste the colourful illustration set · preview window also open'
      + (clipboardOK ? '' : ' · clipboard write failed, paste-back unavailable'),
      6500,
    )
  } catch (err) {
    console.error('[GilbPicker export] unexpected failure', err)
    showToast(`Export failed: ${String(err).slice(0, 90)}`, 5000)
  }
}

function onInsert() {
  if (selectedIllustration.value) {
    emit('insert', buildPayload(selectedIllustration.value))
    emit('close')
    return
  }
  if (selectedText.value) {
    const p = buildTextPayload(selectedText.value)
    // Reuse 'insert' channel — payload has .html and .markdown but no .illustration;
    // parent's handler reads those generic fields.
    emit('insert', { illustration: null, html: p.html, markdown: p.markdown } as any)
    emit('close')
    return
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    // Don't fire if user is in the search box mid-type
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea') return
    emit('close')
  }
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

// r41 (Tom Gilb 2026-06-14 verbatim: "the picture in back fuzzy does scrool
// to no urpose") — lock background page scroll while the picker is open so
// trackpad gestures over the dimmed backdrop don't scroll the SEM app behind.
// Standard modal pattern.  Restores previous overflow on close + on unmount.
let _prevBodyOverflow: string | null = null
watch(() => props.open, (open) => {
  if (typeof document === 'undefined') return
  if (open) {
    _prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else if (_prevBodyOverflow !== null) {
    document.body.style.overflow = _prevBodyOverflow
    _prevBodyOverflow = null
  }
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined' && _prevBodyOverflow !== null) {
    document.body.style.overflow = _prevBodyOverflow
    _prevBodyOverflow = null
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!)
}
function escapeAttr(s: string): string { return escapeHtml(s) }

// r41 v27 — Tab metadata + live counters for the new tab strip.
// Each tab knows its icon, label, HoverHint, and a counter (or null = no counter).
//
// Counter semantics:
//   - define   → primary + secondary Glossary hits (text-card count)
//   - diagram  → 1 if a mermaid ontology diagram is currently rendered, else 0
//   - pictures → number of illustration matches for the current query
//   - universe → total Glossary concepts in the constellation map (deterministic 663)
//   - books    → number of books in the BookKaleidoscope manifest (lazy-loaded)
//   - twin     → seconds spent thinking, or final concept count
const _bookKaleidoscopeCount = ref<number | null>(null)
onMounted(async () => {
  try {
    const res = await fetch(`/book-kaleidoscope.json?v=${Date.now() % 100000}`)
    if (!res.ok) return
    const j = await res.json()
    _bookKaleidoscopeCount.value = Array.isArray(j?.books) ? j.books.length : null
  } catch { /* offline — tab counter just renders 0 */ }
})

interface TabMeta {
  id:    IlluminateTab
  icon:  string
  label: string
  title: string
  count: () => number | null
}
const TAB_META: TabMeta[] = [
  {
    id: 'define', icon: '📖', label: 'Define',
    title: 'Glossary primary hit + secondary chips + chapter mentions — the text-grounded definition path.',
    count: () => (primaryGlossary.value ? 1 : 0) + secondaryGlossary.value.length,
  },
  {
    id: 'diagram', icon: '📐', label: 'Diagram',
    title: 'Ontology diagram for the current Glossary entry — click any node to drill in.',
    count: () => glossaryDiagramSvg.value ? 1 : 0,
  },
  {
    id: 'pictures', icon: '🎨', label: 'Pictures',
    title: 'Illustration carousel + thumbnail strip across 61 Tom Gilb books — 4,363 illustrations indexed.',
    count: () => illustrationResults.value.length,
  },
  {
    id: 'universe', icon: '🌌', label: 'Universe',
    title: '663 Planguage concepts as a constellation map — hover any star for definition, click to navigate.',
    count: () => glossaryCount.value || 663,
  },
  {
    id: 'books', icon: '📚', label: 'Books',
    title: 'BookKaleidoscope — Tom Gilb\'s 48 published books as alternating cover + sample-illustration tiles.  Click any tile to open it on Tom Gilb Consultant Twin (free, no login).',
    count: () => _bookKaleidoscopeCount.value,
  },
  {
    id: 'twin', icon: '🧠', label: 'Ask Twin',
    title: 'Tom Gilb Consultant Twin — ontology-backed search across the full corpus, with cite-back URLs.',
    count: () => twinResult.value ? twinResult.value.conceptNumbers.length : null,
  },
]
</script>

<template>
  <!--
    Backdrop + panel.  Backdrop click closes per CloseDot rule.
    Z-index 800 sits above ordinary modals (600) but below toast (900).
  -->
  <div
    v-if="open"
    class="fixed inset-0 z-[800] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    @click="onBackdrop"
  >
    <!-- r35 — Tom Gilb 2026-06-13: "scrolling, export on all windows that can
         exceed the screen".  Cap height tighter (90vh) so footer is reachable
         on 13" laptops; rely on the body ScrollContainer for inner overflow. -->
    <div
      class="bg-white rounded-xl shadow-2xl w-full flex flex-col overflow-hidden"
      style="max-width: min(1600px, 96vw); max-height: 96vh;"
      @click.stop
    >
      <!-- HEADER -->
      <header class="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-violet-50 via-amber-50 to-orange-50 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-2xl">💡</span>
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-slate-800 leading-tight">
              Illumination · Information · Illustrations
            </h2>
            <p class="text-xs text-slate-600 leading-tight mt-0.5">
              {{ totalCount }} illustrations + Planguage Glossary across {{ books.length }} Tom Gilb books · ⌘I · cited automatically
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <!-- r35 — Universal Export-button-on-all-windows rule.  Builds one
               colourful HTML document with primary Glossary card + Twin drill-in
               concepts + chapter mentions + illustration thumbnails + canonical
               Glossary footnote.  Opens preview window (100% of model) + writes
               clipboard + auto-opens Mail to Tom@Gilb.com per SEM Email Body Std. -->
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 shadow"
            title="Export — open preview window with 100% of this picker’s model, copy colourful HTML + plain to clipboard, and auto-open Mail to Tom@Gilb.com with the SEM Email Body Standard ⌘V cue. Sends primary Glossary card + Twin drill-in concepts + chapter mentions + illustration thumbnails + canonical Glossary footnote in ONE cohesive document."
            @click="exportPicker()"
          >
            📧 Export
          </button>
          <!-- r41 v33 — Phase 5 — Email-the-session buttons (Tom Gilb 2026-06-15
               verbatim: "EMAIL ME EVERYTHING IN THIS SESSION ABOUT THIS CONCEPT.
               EMAIL ME THE FOLLOWING …"). -->
          <button
            type="button"
            class="px-2 py-1 text-[11px] font-bold rounded-md bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-300 shadow-sm"
            :disabled="sessionLog.events.value.length === 0"
            :title="sessionLog.events.value.length === 0 ? 'Explore at least one tab to populate the session log.' : `📧 Email everything (${sessionLog.events.value.length} events) about this concept session to ${effPrefs.preferredEmailAddress || 'Tom@Gilb.com'}. Tom Gilb 2026-06-15 verbatim Phase 5 mandate. Colourful HTML body + ⌘V cue per SEM Email Body Standard.`"
            @click="_emailEverything"
          >📧 Email all</button>
          <button
            type="button"
            class="px-2 py-1 text-[11px] font-bold rounded-md bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-300 shadow-sm"
            :disabled="sessionLog.events.value.length === 0"
            :title="sessionLog.events.value.length === 0 ? 'Explore at least one tab to populate the session log.' : `📧 Email the following… — opens a checklist of all ${sessionLog.events.value.length} session events; you tick which to include before sending. Tom Gilb 2026-06-15 verbatim Phase 5b mandate.`"
            @click="_openEmailSelectModal"
          >📧 Select…</button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow"
            :disabled="!hasSelection"
            :title="hasSelection ? 'Insert the selected text or illustration into your clipboard' : 'Select a text card OR an illustration first'"
            @click="onInsert"
          >
            Insert ↩
          </button>
          <!-- r41 v32 — Phase 3 ⚙ Illumination Settings pin.  Opens a side
               drawer where the planner can set personal preferences that
               override the global defaults from Settings → Illumination AI. -->
          <button
            type="button"
            class="px-2.5 py-1.5 rounded-md bg-white border-2 border-amber-300 text-amber-800 hover:bg-amber-50 shadow-sm text-base leading-none"
            :title="`⚙ Illumination Settings — personal preferences for ${ownerName || '(no owner)'} on this plan.  Overrides the global Illumination defaults.  Tom Gilb 2026-06-15 design: per-Plan-Owner / Planner preferences sit on top of the global defaults baseline.`"
            aria-label="Open Illumination Settings drawer"
            @click="_openIlluminationSettings"
          >⚙</button>
          <CloseDot size="lg" aria-label="Close Illumination Picker" @click="emit('close')" />
        </div>
      </header>

      <!-- r93qqq r14 — Tom 2026-06-13: "if somebody wants to see all the ills in
           my book they can just got to the twin, free". Prominent banner directing
           browsers to the Twin Consultant (r93ppp Twin promotional discipline).
           This panel is for OCCASIONAL insertion into the spec; the Twin is for
           sustained browsing. -->
      <div class="flex items-center gap-3 px-5 py-2 border-b border-slate-200 shrink-0 bg-gradient-to-r from-violet-100 to-amber-100">
        <span class="text-base shrink-0">📖</span>
        <span class="text-xs text-slate-700 flex-1 min-w-0">
          For sustained <strong>browsing</strong> across every Gilb book — open the <strong>Tom Gilb Consultant Twin</strong> (free):
        </span>
        <!-- r31 (Tom 2026-06-13: "missing the ontology diagram") — 🌳 button
             opens the 663-concept clickable Planguage Ontology tree, in line
             with the Twin link so both deep-dive surfaces are visible. -->
        <button
          type="button"
          class="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shrink-0 shadow"
          title="🌳 Planguage Ontology — 663-concept clickable tree (106 categories) sourced from 10.Standard/2.Glossary/PlanguageGlossary/. Click any concept to open it on Tom Gilb Consultant Twin (free)."
          @click="emit('open-ontology'); emit('close')"
        >🌳 Ontology Tree</button>
        <a
          href="https://www.gilb.com/tomtwin"
          target="_blank"
          rel="noopener"
          class="px-3 py-1 rounded-md bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shrink-0 shadow"
          title="Open Tom Gilb Consultant Twin — Kai Gilb's commercial product, free reading tier. Use this for sustained browsing across all 4,363+ illustrations + full Glossary."
        >Open Twin ↗</a>
      </div>

      <!-- SEARCH + FILTER ROW — r93qqq r15 (Tom 2026-06-13: "the search does not
           turn up anything relevant").  Bigger input.  Loud match-count chips
           that change colour on hit/miss so the planner can SEE the search is
           working in real time. -->
      <div class="flex flex-wrap items-center gap-2 px-5 py-3 border-b-2 border-violet-200 shrink-0 bg-gradient-to-r from-violet-50 to-amber-50">
        <input
          v-model="queryText"
          type="text"
          placeholder='Type any word: "stakeholder", "tolerable", "feedback", "evo", "qualifier"…'
          class="flex-1 min-w-[260px] px-4 py-2.5 text-base font-medium border-2 border-violet-400 rounded-lg focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200 bg-white shadow-sm placeholder:text-slate-400 placeholder:font-normal"
          title="Full-text search across Planguage Glossary, Tom's caption text, chapter titles, book titles, keywords, and OCR'd image text.  Order-independent like the Twin Consultant."
          autofocus
        />
        <select
          v-model="bookFilter"
          class="px-3 py-2.5 text-sm border-2 border-slate-300 rounded-lg bg-white"
          title="Restrict to one book (filters both text and illustration columns)"
        >
          <option value="">All books</option>
          <option
            v-for="b in books"
            :key="b.id"
            :value="b.id"
          >{{ b.title }} ({{ b.count }})</option>
        </select>
        <!-- Live match-count chips — green on hit, red on miss so the planner SEES
             whether the search is working without scrolling. -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span
            class="text-xs px-2 py-1 rounded-md font-bold"
            :class="textResults.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'"
            title="Text matches in left column (Planguage Glossary + chapter excerpts)"
          >💡 {{ textResults.length }}</span>
          <span
            class="text-xs px-2 py-1 rounded-md font-bold"
            :class="illustrationResults.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'"
            title="Illustration matches in right column"
          >📖 {{ illustrationResults.length }}</span>
        </div>
      </div>
      <!-- Index-state line — confirms the index actually loaded.  If totalCount
           shows 0 here, the index fetch silently failed (Safari cache, network). -->
      <div v-if="!isLoading && !error" class="px-5 py-1.5 border-b border-slate-200 bg-white shrink-0 text-[11px] text-slate-600">
        Indexed: <strong>{{ totalCount }}</strong> illustrations + <strong>{{ glossaryCount }}</strong> Planguage Glossary concepts · across <strong>{{ books.length }}</strong> Tom Gilb books · {{ queryText ? `searching for "${queryText}"` : 'type anything above' }}
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           r41 v27 — TAB STRIP (Tom Gilb 2026-06-15: "organize all the cmnd i stuff
           much better … elegant useful beautiful").  Six lateral surfaces, one
           active at a time.  Live counter chip on every tab so the planner sees
           at a glance which surfaces have content for the current query.
           Persistent via localStorage; defaults to Define on first open.
           ════════════════════════════════════════════════════════════════════ -->
      <nav
        v-if="!isLoading && !error"
        class="px-5 py-2 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50/60 to-amber-50/60 shrink-0 flex items-center gap-1.5 flex-wrap"
        aria-label="Illuminate picker — lateral surfaces"
      >
        <!-- r41 v34 — Phase 4 active-purpose chip — visible when the planner
             has picked a purpose so they can see what guides the flow. -->
        <span
          v-if="purposes.purpose.value"
          class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-100 text-violet-800 border border-violet-300 flex items-center gap-1 mr-2"
          :title="`🎯 Purpose: ${purposes.purpose.value.label}.  Sequence: ${purposes.purpose.value.sequence.join(' → ')}.  Click to change your purpose.`"
          @click="_openPurposeMenu"
          role="button"
          style="cursor: pointer;"
        >
          <span>{{ purposes.purpose.value.emoji }}</span>
          <span>{{ purposes.purpose.value.label }}</span>
          <span class="opacity-60">·</span>
          <span class="text-[10px] font-mono">{{ purposes.sequenceIdx.value + 1 }}/{{ purposes.purpose.value.sequence.length }}</span>
        </span>
        <button
          v-for="tab in TAB_META"
          :key="tab.id"
          type="button"
          class="gilb-tab-pill px-3 py-1.5 text-sm font-bold rounded-md flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 relative"
          :class="activeTab === tab.id
            ? 'bg-violet-600 text-white shadow-md ring-1 ring-violet-700/20'
            : purposes.nextTabInSequence.value === tab.id
              ? 'bg-white text-violet-800 border-2 border-violet-400 ring-2 ring-violet-200 animate-pulse'
              : 'bg-white text-slate-700 hover:bg-violet-50 border border-slate-300'"
          :title="purposes.nextTabInSequence.value === tab.id ? `🎯 Next recommended tab for purpose '${purposes.purpose.value?.label}'. ${purposes.purpose.value?.perTabTip?.[tab.id] || tab.title}` : tab.title"
          :aria-pressed="activeTab === tab.id"
          @click="setActiveTab(tab.id); purposes.syncSequenceToTab(tab.id)"
        >
          <span class="text-base leading-none">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.count() !== null"
            class="text-[10px] px-1.5 py-0.5 rounded-full font-extrabold leading-none min-w-[18px] text-center"
            :class="activeTab === tab.id
              ? 'bg-white/25 text-white'
              : 'bg-violet-100 text-violet-800'"
          >{{ tab.count() }}</span>
        </button>
      </nav>

      <!-- BODY — loading | error | two-column lookup -->
      <div class="flex-1 min-h-0 flex flex-col">
        <!-- LOADING -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-16 gap-3 flex-1">
          <div class="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
          <p class="text-sm text-slate-600">Loading Illumination · Information · Illustrations…</p>
          <p class="text-xs text-slate-500 max-w-md text-center italic">
            "Without illustrations, planning words travel only as far as the reader's
            patience." — Tom Gilb tradition
          </p>
        </div>

        <!-- ERROR -->
        <div v-else-if="error" class="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-4 m-5">
          <p class="font-semibold mb-1">Could not load the catalog.</p>
          <p>{{ error }}</p>
          <p class="text-xs mt-2 text-rose-600">
            Run <code class="bg-rose-100 px-1 rounded">python3 "/Users/Tomgilbs/Documents/MyVault/0 - TOMS BOOKS/twinpod-illustrations/build-index.py"</code>
            to regenerate the index, then refresh.
          </p>
        </div>

        <!-- r30 LAYOUT (Tom Gilb 2026-06-13 priority restructure) — Glossary PRIMARY (full
             width), Twin Insights compact strip, Illustrations behind opt-in toggle. -->
        <div v-else class="flex-1 min-h-0 flex flex-col">

          <!-- 🔮 TWIN INSIGHTS — Tom Gilb 2026-06-13 verbatim: "I hope you can make
               use of the twins advanced search logic, noting less is interesting".
               r41 v27 — now lives inside the 🧠 Ask Twin tab. -->
          <div v-show="activeTab === 'twin'" class="shrink-0">
          <div v-if="!queryText" class="px-5 py-8 text-center text-sm text-slate-500 italic">
            Type a query in the search box above — Tom's Twin Consultant searches your full Gilb corpus with ontology-backed reasoning, 800 ms after you pause typing.
          </div>
          <div v-if="queryText" class="border-b border-violet-200 bg-gradient-to-r from-violet-50 via-indigo-50 to-violet-50 shrink-0">
            <div class="px-5 py-2.5">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-base">🔮</span>
                <span class="text-[11px] font-bold uppercase tracking-wider text-violet-800">
                  Tom's Twin Consultant — ontology-backed search
                </span>
                <span class="text-[10px] text-slate-500 italic ml-auto">"{{ queryText }}"</span>
              </div>
              <div v-if="twinLoading" class="flex items-center gap-2 text-xs text-violet-700">
                <span class="inline-block w-4 h-4 rounded-full border-2 border-violet-600 border-t-transparent animate-spin"></span>
                <span>Twin is thinking…</span>
                <span v-if="twinElapsed > 0" class="font-mono text-[11px] text-violet-500">{{ twinElapsed }}s</span>
              </div>
              <div v-else-if="twinError && !twinResult" class="text-xs text-rose-700 flex items-center gap-2">
                <span>⚠ Twin lookup failed: {{ twinError }}</span>
                <a :href="TWIN_BASE" target="_blank" rel="noopener" class="text-violet-700 underline font-bold">Open Twin Consultant ↗</a>
              </div>
              <div v-else-if="twinResult && twinResult.query.toLowerCase() === queryText.trim().toLowerCase()" class="max-h-44 overflow-y-auto bg-white rounded-md border border-violet-200 px-3 py-2 text-sm leading-relaxed">
                <RenderedMarkdown :markdown="twinResult.text" />
                <div v-if="twinResult.conceptUrls.length" class="mt-2 pt-2 border-t border-violet-100 flex flex-wrap gap-1.5">
                  <span class="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Drill in →</span>
                  <a
                    v-for="c in twinResult.conceptUrls.slice(0, 8)"
                    :key="c.url"
                    :href="c.url"
                    target="_blank"
                    rel="noopener"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-200"
                    :title="`Open ${c.name} *${c.number} in Tom Gilb Consultant Twin (free, no login)`"
                  >{{ c.name }} *{{ c.number }} ↗</a>
                </div>
                <div class="mt-1.5 text-[10px] text-slate-400 italic">
                  Twin response · {{ Math.round(twinResult.elapsedMs / 100) / 10 }}s · {{ twinResult.conceptNumbers.length }} concepts found
                </div>
              </div>
              <div v-else class="text-[11px] text-slate-500 italic">
                Type a query above — Twin search fires 800 ms after you pause typing.
              </div>
            </div>
          </div>
          </div><!-- /v-show twin tab outer wrapper -->

          <!-- r36 layout — pictures TOP (order-1), primary Glossary 4-line clamp (order-2),
               secondary chips (order-3), chapter mentions max-4 (order-4), empty-state (order-5).
               Inner div is `flex flex-col` so children can be re-ordered via `order-*` regardless
               of their source-code position.  Tom Gilb 2026-06-14 r34 spec §1: pictures
               in-window IMMEDIATELY, not below the fold. -->
          <!-- r41 v2 (Tom Gilb 2026-06-14) — TWO-DIV SANDWICH for scroll + flex-order.
               Why two divs and not one: a `flex flex-col` container with `overflow-y: scroll`
               makes its children flex items with default `flex-shrink: 1` — they shrink to
               fit the container instead of overflowing.  Result: scrollbar shows but
               scrolling does nothing (Tom's exact symptom: "no scroll").
               Fix: outer div is the SCROLL CONTAINER (block, overflow-y:scroll, h-full).
                    Inner div is the FLEX-COL WRAPPER for the `order-*` reordering.
               The inner div takes its natural height; when that exceeds the outer's
               bounded height, the outer scrolls.  Canonical pattern. -->
          <div
            class="gilb-picker-scroll-inner flex-1 min-h-0 bg-violet-50/20"
          >
            <div class="flex flex-col px-4 py-3">

            <!-- ════════════════════════════════════════════════════════════════
                 r41 v27 — 📖 DEFINE TAB BODY
                 Primary Glossary card + secondary chip strip + chapter mentions
                 + empty-state.  Was always-visible; now tab-gated.
                 ════════════════════════════════════════════════════════════════ -->
            <div v-show="activeTab === 'define'" class="contents">

            <!-- ════════════════════════════════════════════════════════════════
                 r41 v28 — ILLUMINATION AI Phase 1 — Tom Gilb 2026-06-15 verbatim
                 *"we give one thing initially. 1. A good short definition. Along
                 with something like 2. 'Would you like to know more?'"*
                 GLANCE-FIRST landing card.  Only renders when a primary Glossary
                 hit exists AND the user has not yet expanded.  Two CTAs:
                  💡 Yes, want to know more  → reveals the rest of the Define tab
                  ✓ Sharp Enough             → closes the picker
                 ════════════════════════════════════════════════════════════════ -->
            <section
              v-if="primaryGlossary && !_illuminationExpanded"
              class="order-0 mb-3 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-violet-50 shadow-lg overflow-hidden"
            >
              <header class="px-4 py-2 border-b border-amber-200 bg-white/60 flex items-center gap-2 flex-wrap">
                <span class="text-base">{{ primaryGlossary.icon }}</span>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Illumination · glance</span>
                <span class="text-[10px] text-slate-600">one short definition first · expand when ready</span>
                <!-- r41 v30 — Phase 2 primary-lens chip — Tom Gilb 2026-06-15
                     "parse it (what type of words, requirements, processes,
                     design, qa, management, finances)".  r41 v32 — Phase 3
                     gated by effPrefs.showClassifierLens (default on). -->
                <span
                  v-if="illuminateClassification.primaryArea && effPrefs.showClassifierLens"
                  class="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-100 text-violet-800 border border-violet-200 flex items-center gap-1"
                  :title="`Primary lens — ${AREA_META[illuminateClassification.primaryArea].label}.  ${AREA_META[illuminateClassification.primaryArea].blurb}  Confidence: ${Math.round(illuminateClassification.confidence * 100)}%.`"
                >
                  <span>{{ AREA_META[illuminateClassification.primaryArea].emoji }}</span>
                  <span>{{ AREA_META[illuminateClassification.primaryArea].label }}</span>
                </span>
              </header>
              <div class="px-5 py-4">
                <h3 class="text-xl font-extrabold text-slate-800 mb-1.5 leading-tight">
                  {{ primaryGlossary.title }}
                </h3>
                <p class="text-base text-slate-700 leading-relaxed">
                  {{ _shortDefFromBody(primaryGlossary.body) }}
                </p>
                <p v-if="primarySource" class="mt-2 text-[10px] text-slate-500 italic">
                  Source: {{ primarySource === 'twin' ? 'Tom Gilb Consultant Twin (commercial tier, free reading)' : primarySource === 'local-loose' ? 'Vault Glossary — near-match' : 'Vault Glossary — exact match (10.Standard/2.Glossary/PlanguageGlossary/)' }}
                </p>
                <!-- r41 v30 — Phase 2 suggested-tab nudge.  Shown when the
                     classifier suggests a tab OTHER than 'define' (since we're
                     already on Define).  Click jumps the planner to the
                     recommended starting surface. -->
                <p
                  v-if="illuminateClassification.suggestedTab && illuminateClassification.suggestedTab !== 'define' && effPrefs.showClassifierLens"
                  class="mt-3 text-[12px] text-slate-700 flex items-center gap-2 flex-wrap"
                >
                  <span class="italic">Looks like a <strong>{{ AREA_META[illuminateClassification.primaryArea!].label }}</strong> question — start with</span>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-md text-[12px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                    :title="`Jump to the ${illuminateClassification.suggestedTab} tab — best surface for ${AREA_META[illuminateClassification.primaryArea!].label} concepts.  Composes the Illumination flow Tom Gilb specified 2026-06-15.`"
                    @click="_jumpToSuggestedTab(illuminateClassification.suggestedTab)"
                  >
                    {{ illuminateClassification.suggestedTab === 'diagram'   ? '📐 Diagram'   : '' }}{{ illuminateClassification.suggestedTab === 'pictures' ? '🎨 Pictures' : '' }}{{ illuminateClassification.suggestedTab === 'universe' ? '🌌 Universe' : '' }}{{ illuminateClassification.suggestedTab === 'books'    ? '📚 Books'    : '' }}{{ illuminateClassification.suggestedTab === 'twin'     ? '🧠 Ask Twin' : '' }}
                  </button>
                  <span class="text-[10px] text-slate-500 italic">— or expand below for the full definition.</span>
                </p>
              </div>
              <footer class="px-5 py-3 border-t border-amber-200 bg-white flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 shadow active:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
                  title="Reveal the full Glossary entry, secondary chips, chapter mentions — and unlock the other tabs' deeper content (Diagram, Pictures, Universe, Books, Ask Twin all stay one click away)."
                  @click="_expandIllumination"
                >💡 Yes, want to know more</button>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
                  title="✓ Sharp Enough — close the picker.  Your Illumination is complete for this concept; nothing more needed.  Phase 5: this also marks the session as ended in the in-memory session log."
                  @click="_signalSharpEnough"
                >✓ Sharp Enough</button>
                <!-- r41 v34 — Phase 4 third CTA: "🎯 What's my purpose?" — opens
                     the purpose menu and starts the guided flow. -->
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm font-bold bg-violet-100 text-violet-800 hover:bg-violet-200 border border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
                  title='🎯 Tell the Illumination AI your purpose for this inquiry.  Each purpose maps to a recommended sequence of tabs — the picker will guide you through useful material until your Illumination is "Sharp Enough".  Tom Gilb 2026-06-15 Phase 4 design.'
                  @click="_openPurposeMenu"
                >🎯 What's my purpose?</button>
                <span class="ml-auto text-[10px] text-slate-500 italic">tabs above stay clickable — jump anywhere any time</span>
              </footer>
            </section>

            <!-- ════════════════════════════════════════════════════════════════
                 EXPANDED DEFINE CONTENT — primary Glossary card + secondary chips
                 + chapter mentions + empty-state.  Hidden until the planner
                 clicks "💡 Yes, want to know more" on the glance card above.
                 ════════════════════════════════════════════════════════════════ -->
            <div v-show="_illuminationExpanded || !primaryGlossary" class="contents">

            <!-- ── PRIMARY GLOSSARY HIT — full-width, rich, prominent ─────────────── -->
            <!-- r36 order-2: secondary to pictures (order-1).  Body of card is now
                 truncated to ~4 lines via -webkit-line-clamp + Read-full expander. -->
            <section v-if="primaryGlossary" class="order-2 rounded-lg border-2 shadow-md mb-3"
                     :class="primarySource === 'twin'
                       ? 'border-violet-400 bg-white'
                       : primarySource === 'local-loose'
                         ? 'border-amber-400 bg-white'
                         : 'border-violet-300 bg-white'">
              <header class="flex items-center gap-2 px-3 py-1.5 border-b border-violet-200 bg-gradient-to-r from-violet-100 via-violet-50 to-white flex-wrap">
                <span class="text-lg">{{ primaryGlossary.icon }}</span>
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">Top Glossary hit</span>
                <!-- r35 primarySource badge — tells the user where the card came from -->
                <span
                  v-if="primarySource === 'twin'"
                  class="text-[10px] px-2 py-0.5 rounded font-extrabold bg-violet-600 text-white uppercase tracking-wider"
                  title="Local vault Glossary does not carry this concept — the canonical entry was pulled from Tom Gilb Consultant Twin (Kai Gilb's commercial product, free reading tier)."
                >🌐 Twin concept · Glossary not local</span>
                <span
                  v-else-if="primarySource === 'local-loose'"
                  class="text-[10px] px-2 py-0.5 rounded font-extrabold bg-amber-500 text-white uppercase tracking-wider"
                  title="Local top hit is NOT an exact name match for your query — the query word was found inside the body text of this Glossary entry. Try a different word or check the Twin Insights banner above."
                >⚠ Loose match · query found in body</span>
                <span
                  v-else-if="primarySource === 'local-exact'"
                  class="text-[10px] px-2 py-0.5 rounded font-extrabold bg-emerald-600 text-white uppercase tracking-wider"
                  title="Exact-name match in the local vault Planguage Glossary."
                >✓ Exact match</span>
                <span class="text-[10px] text-slate-500 italic ml-auto">vault tier 1 · 10.Standard/2.Glossary/PlanguageGlossary/</span>
              </header>
              <div class="px-4 py-3">
                <div class="text-[15px] font-extrabold text-violet-800 mb-0.5">{{ primaryGlossary.title }}</div>
                <div class="text-[11px] text-slate-600 mb-2 italic">{{ primaryGlossary.subtitle }}</div>
                <!-- r36 — clamp the rich body to 4 lines unless user expanded it.
                     The CSS line-clamp lives in the scoped <style> block at the
                     bottom of this file (.gilb-rich-def--clamp). -->
                <div
                  class="text-sm text-slate-800 leading-relaxed gilb-rich-def"
                  :class="primaryExpanded ? '' : 'gilb-rich-def--clamp'"
                  v-html="primaryGlossary.bodyRich"
                ></div>
                <button
                  type="button"
                  class="mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                  :title="primaryExpanded ? 'Collapse to a 4-line preview' : 'Expand to read the full Glossary definition'"
                  @click="primaryExpanded = !primaryExpanded"
                >{{ primaryExpanded ? '▴ Collapse' : '▾ Read full definition' }}</button>
              </div>
              <footer class="flex items-center gap-2 px-3 py-1.5 border-t border-violet-100 bg-slate-50">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-md text-[11px] font-extrabold text-white bg-violet-600 hover:bg-violet-700 shadow-sm flex items-center gap-1"
                  :title="`💡 Open the full LOCAL Glossary entry for ${primaryGlossary.title} — at-a-glance card, diagram, notes, examples, mistakes, related concepts.`"
                  @click="emit('illuminate-term', { term: primaryGlossary.title.replace(/ \*\d+$/, '') })"
                >
                  <span>💡 Open full Glossary entry</span>
                  <span aria-hidden="true">→</span>
                </button>
                <a
                  v-if="primaryGlossary.twinUrl"
                  :href="primaryGlossary.twinUrl"
                  target="_blank"
                  rel="noopener"
                  class="px-2 py-1 rounded-md text-[10px] font-semibold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                  :title="`Open this term on Tom Gilb Consultant Twin — canonical entry served by Kai's Twin.`"
                >📖 View Term on Twin ↗</a>
                <button
                  type="button"
                  class="ml-auto px-2 py-1 rounded-md text-[11px] font-semibold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                  title="Select this entry for clipboard insert (⌘V)"
                  @click="selectedId = 'txt:' + primaryGlossary.id"
                >Select for ⌘V</button>
              </footer>
            </section>

            <!-- ── SECONDARY GLOSSARY MATCHES — clickable list of other related entries ── -->
            <section v-if="secondaryGlossary.length" class="order-3 mb-3">
              <header class="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-1.5 flex items-center gap-1.5">
                <span>💡</span><span>Other Glossary matches</span>
                <span class="text-slate-400 normal-case font-normal">click to make primary</span>
              </header>
              <ul class="flex flex-wrap gap-1.5">
                <li v-for="t in secondaryGlossary" :key="t.id">
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-white"
                    :class="selectedId === ('txt:' + t.id)
                      ? 'border-violet-600 bg-violet-100 text-violet-900'
                      : 'border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-400'"
                    :title="t.body.slice(0, 200)"
                    @click="selectedId = 'txt:' + t.id"
                    @dblclick="emit('illuminate-term', { term: t.title.replace(/ \*\d+$/, '') })"
                  >{{ t.title }}</button>
                </li>
              </ul>
            </section>

            <!-- ── CHAPTER MATCHES — same compact pattern ──────────────────────────── -->
            <!-- r36 order-4; default max-4 rows visible, rest behind "Show all".
                 chapterShowAll ref toggles between slice(0,4) and slice(0,8). -->
            <section v-if="chapterMatches.length" class="order-4 mb-3">
              <header class="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <span>📖</span><span>Chapter mentions</span>
                <span class="text-slate-400 normal-case font-normal">{{ chapterMatches.length }} in {{ books.length }} books</span>
                <button
                  v-if="chapterMatches.length > 4"
                  type="button"
                  class="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white normal-case"
                  :title="chapterShowAll ? 'Show only the top 4 chapter mentions' : `Show all ${Math.min(chapterMatches.length, 8)} chapter mentions`"
                  @click="chapterShowAll = !chapterShowAll"
                >{{ chapterShowAll ? '▴ Show 4' : `▾ Show all (${Math.min(chapterMatches.length, 8)})` }}</button>
              </header>
              <ul class="flex flex-col gap-1">
                <li v-for="t in chapterMatches.slice(0, chapterShowAll ? 8 : 4)" :key="t.id">
                  <button
                    type="button"
                    class="w-full text-left rounded-md border px-2 py-1 text-[11px] bg-white"
                    :class="selectedId === ('txt:' + t.id)
                      ? 'border-slate-600 bg-slate-100'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-400'"
                    @click="selectedId = 'txt:' + t.id"
                  >
                    <span class="font-bold">{{ t.title }}</span>
                    <span class="text-slate-500"> — {{ t.subtitle }}</span>
                  </button>
                </li>
              </ul>
            </section>

            <!-- ── EMPTY-STATE message when no Glossary AND no chapter matches ──────── -->
            <div v-if="!primaryGlossary && !chapterMatches.length" class="order-5 text-sm text-slate-500 italic text-center py-12">
              No Glossary matches for "{{ queryText || '' }}".
              <div class="text-xs mt-2">Try a Planguage concept word — e.g. <strong>stakeholder</strong>, <strong>tolerable</strong>, <strong>qualifier</strong>, <strong>goal</strong>, or a concept number like <strong>233</strong>.</div>
            </div>

            </div><!-- /r41 v28 expanded-define wrapper -->
            </div><!-- /v-show define tab wrapper -->

            <!-- ════════════════════════════════════════════════════════════════
                 r41 v27 — 📐 DIAGRAM TAB BODY
                 Clean diagram-only view.  Reuses the mermaid SVG that was being
                 rendered in carousel slot 0 — extracted here for a focused tab.
                 ════════════════════════════════════════════════════════════════ -->
            <section v-show="activeTab === 'diagram'" class="order-1 mb-3">
              <header class="flex items-center gap-2 px-2 py-1 mb-1.5 rounded bg-violet-50 border border-violet-200">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">📐 Ontology Diagram</span>
                <span v-if="glossaryDiagramTerm" class="text-[10px] text-slate-600 italic">from <strong>{{ glossaryDiagramTerm }}</strong> Glossary entry</span>
                <button
                  v-if="glossaryDiagramSvg && !diagramExpanded"
                  type="button"
                  class="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white font-bold hover:bg-violet-700 active:bg-violet-800 cursor-pointer transition-colors"
                  :title="`Open the ${glossaryDiagramTerm} ontology diagram fullscreen — bigger view, hover/click any node to drill in`"
                  @click="diagramExpanded = true"
                >🔍 Click to enlarge</button>
              </header>
              <div v-if="glossaryDiagramSvg" class="bg-white rounded-lg border-2 border-violet-200 overflow-hidden">
                <button
                  type="button"
                  class="block w-full bg-white p-4 overflow-auto flex items-center justify-center cursor-zoom-in hover:bg-violet-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
                  style="min-height: 540px; max-height: 1200px;"
                  :title="`Click to enlarge the ${glossaryDiagramTerm} ontology diagram fullscreen`"
                  @click="diagramExpanded = true"
                >
                  <div class="gilb-mermaid-host-large" v-html="glossaryDiagramSvg"></div>
                </button>
                <div class="p-2.5 border-t border-violet-100 bg-violet-50/40">
                  <div class="text-xs font-extrabold text-violet-800">{{ glossaryDiagramTerm }} — Planguage ontology diagram</div>
                  <div class="text-[11px] text-slate-700 leading-snug mt-0.5">
                    Sourced inline from <code class="text-[10px] bg-white px-1 rounded">{{ glossaryDiagramTerm }}.NNN.md</code> via the vault Glossary at <code class="text-[10px] bg-white px-1 rounded">10.Standard/2.Glossary/PlanguageGlossary/</code>.
                    Click any node in the diagram to navigate to its own ontology.
                  </div>
                </div>
              </div>
              <div v-else class="px-5 py-10 text-center text-sm text-slate-500 italic bg-white rounded-lg border-2 border-violet-100">
                No ontology diagram for "{{ queryText || '(no query)' }}".  Try a concept that has a Glossary entry with a mermaid block —
                e.g. <strong>Stakeholder</strong>, <strong>Goal</strong>, <strong>Tolerable</strong>, <strong>Qualifier</strong>, <strong>Function</strong>, <strong>Solution</strong>.
              </div>
            </section>

            <!-- ── ILLUSTRATIONS — Tom Gilb 2026-06-14 r36 — pictures TOP, always visible per r34 spec ── -->
            <!-- order-1 (first child in flex column) regardless of source-code position
                 so the user sees a picture IMMEDIATELY on opening, per r34 §1.
                 r41 v27 — now gated to the 🎨 Pictures tab. -->
            <section v-show="activeTab === 'pictures'" class="order-1 mb-3">
              <header class="flex items-center gap-2 px-2 py-1 mb-1.5 rounded bg-orange-50 border border-orange-200">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-orange-700">📖 Illustrations</span>
                <span class="text-[10px] text-slate-600">{{ illustrationResults.length }} match{{ illustrationResults.length === 1 ? '' : 'es' }}</span>
              </header>
              <!-- r31 TIMED CAROUSEL · r33 r-DIAGRAM-FIRST · r36 always-visible — Tom Gilb 2026-06-14.
                   Slot 0 = the primary Glossary's mermaid ontology diagram (if any)
                   rendered inline via /mermaid.min.js.  Subsequent slots = the
                   first N (default 10) illustration matches from the index. -->
              <div v-if="(glossaryDiagramSvg || currentCarouselIllAdjusted)"
                   data-picker-main-picture
                   class="mt-2 bg-white rounded-lg border-2 border-orange-200 overflow-hidden"
                   @mouseenter="_stopCarouselAuto"
                   @mouseleave="carouselAuto && _startCarouselAuto()">

                <!-- SLOT 0 — Glossary ontology diagram (r33) · r37 click-to-enlarge -->
                <template v-if="isCarouselSlotDiagram">
                  <div class="bg-violet-50 border-b-2 border-violet-200 px-3 py-1.5 flex items-center gap-2">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">📐 Ontology Diagram</span>
                    <span class="text-[10px] text-slate-600 italic">from <strong>{{ glossaryDiagramTerm }}</strong> Glossary entry</span>
                    <!-- r41 v12 (Tom Gilb 2026-06-14: "the click to enlarge button
                         seemed dead, maybe because it was already enlarged, but then
                         it should not show an option it did not have") — was a
                         non-clickable <span>; now an actual <button> wired to
                         diagramExpanded.  Hidden when lightbox already open
                         (since "enlarge what's already enlarged" is the option
                         that doesn't exist). -->
                    <button
                      v-if="!diagramExpanded"
                      type="button"
                      class="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white font-bold hover:bg-violet-700 active:bg-violet-800 cursor-pointer transition-colors"
                      title="Open this ontology diagram fullscreen — bigger view, hover/click any node to drill in"
                      @click.stop="diagramExpanded = true"
                    >🔍 Click to enlarge</button>
                  </div>
                  <button
                    type="button"
                    class="block w-full bg-white p-4 overflow-auto flex items-center justify-center cursor-zoom-in hover:bg-violet-50 transition-colors ring-0 hover:ring-2 hover:ring-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    style="min-height: 540px; max-height: 1200px;"
                    :title="`Click to enlarge the ${glossaryDiagramTerm} ontology diagram fullscreen`"
                    @click="diagramExpanded = true"
                  >
                    <!-- r41 v3 (Tom 2026-06-14: "the initial diagram is far too small to read
                         anything. make it at least 3x lrger") — bumped from max-h-96 (384px)
                         to min-height 540px / max-height 1200px (~3× the area).  The inner
                         mermaid SVG is forced to fill via the unscoped global CSS rule
                         at the end of the file. -->
                    <!-- r41 v4 — pointer-events ENABLED so node clicks are
                         caught by the delegated handler in _wireDiagramNodeClicks.
                         Empty-space clicks still bubble up to the outer button. -->
                    <div class="gilb-mermaid-host-large" v-html="glossaryDiagramSvg"></div>
                  </button>
                  <div class="p-2.5 border-t border-violet-100 bg-violet-50/40">
                    <div class="text-xs font-extrabold text-violet-800">{{ glossaryDiagramTerm }} — Planguage ontology diagram</div>
                    <div class="text-[11px] text-slate-700 leading-snug mt-0.5">
                      Sourced inline from <code class="text-[10px] bg-white px-1 rounded">{{ glossaryDiagramTerm }}.NNN.md</code> via the vault Glossary at <code class="text-[10px] bg-white px-1 rounded">10.Standard/2.Glossary/PlanguageGlossary/</code>.
                      Click any node in the diagram to navigate to its own ontology.  Click <strong>💡 Open full Glossary entry</strong> above for the interactive Illuminate panel.
                    </div>
                  </div>

                  <!-- Universe used to live here; r41 v6 hoisted it OUT of
                       the v-if=isCarouselSlotDiagram block so it shows even
                       with an empty query (lead picture). -->
                </template>

                <!-- SLOT 1+ — illustration matches -->
                <template v-else-if="currentCarouselIllAdjusted">
                  <div class="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden relative">
                    <!-- r41 v10 (Tom Gilb 2026-06-14 verbatim "a go to twin text
                         in middel (not good in case we screen clip, move to a
                         side top bottom) and we did not go to the page, but
                         started loading the book, we want the page or the
                         illustration") — TWO FIXES:
                         (a) Loading spinner overlay is now v-if-guarded by
                             _currentImgLoaded so it disappears once the image
                             paints (was permanently centred over loaded image,
                             ruining screen-clips).
                         (b) The "View on Twin" link is moved to the
                             BOTTOM-LEFT CORNER as a small chip — out of the
                             middle of the picture so screen-clips are clean.
                         (c) Its href now points to the DIRECT illustration
                             URL (i.url — the image itself on the book
                             subdomain) NOT the Twin's book page (which loads
                             the whole 59.9 MB book). -->
                    <div
                      v-if="!_currentImgLoaded"
                      class="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 text-xs px-2 text-center pointer-events-none"
                      aria-hidden="true"
                    >
                      <svg class="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke-opacity="0.25" stroke-width="3" />
                        <path d="M12 2 a10 10 0 0 1 10 10" stroke-width="3" stroke-linecap="round" />
                      </svg>
                      <span>pod slow…</span>
                    </div>
                    <!-- r41 v16 (Tom Gilb 2026-06-14 "no close and no export"
                         from Safari raw-image-URL tab) — replaced with a button
                         that opens the SEM-native illustration lightbox.  The
                         lightbox has CloseDot, Export, and a SECONDARY "Open
                         raw image in new tab" link for the original behaviour. -->
                    <button
                      type="button"
                      class="absolute bottom-2 left-2 z-20 text-[10px] font-bold px-2 py-1 rounded-md bg-violet-700/85 text-white hover:bg-violet-800 shadow-md backdrop-blur-sm flex items-center gap-1"
                      :title="`Open this illustration full-screen in SEM with Export, close pin, and source info — ${currentCarouselIllAdjusted.bookTitle}${currentCarouselIllAdjusted.page ? ' p.' + currentCarouselIllAdjusted.page : ''}`"
                      @click.stop="openIllustrationLightbox(currentCarouselIllAdjusted)"
                    >🔍 Enlarge</button>
                    <img
                      :src="currentCarouselIllAdjusted.url"
                      :alt="currentCarouselIllAdjusted.caption || currentCarouselIllAdjusted.filename"
                      class="max-w-full max-h-full object-contain relative z-10 bg-white cursor-pointer"
                      :title="`Click to select for ⌘V · Double-click to insert directly`"
                      @click="selectedId = 'ill:' + currentCarouselIllAdjusted.id"
                      @dblclick="onInsert"
                      @load="_currentImgLoaded = true"
                      @error="_currentImgLoaded = true"
                    />
                  </div>
                  <div class="p-2.5 border-t border-orange-100">
                    <div v-if="queryText && strongestSignal(currentCarouselIllAdjusted, queryText)" class="mb-1">
                      <span
                        class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                        :class="{
                          'bg-emerald-100 text-emerald-800': strongestSignal(currentCarouselIllAdjusted, queryText) === 'BOOK',
                          'bg-violet-100 text-violet-800':   strongestSignal(currentCarouselIllAdjusted, queryText) === 'CHAPTER',
                          'bg-amber-100 text-amber-800':     strongestSignal(currentCarouselIllAdjusted, queryText) === 'KEYWORDS',
                          'bg-slate-100 text-slate-700':     ['CAPTION','OCR','FILENAME'].includes(strongestSignal(currentCarouselIllAdjusted, queryText) || ''),
                        }"
                      >{{ strongestSignal(currentCarouselIllAdjusted, queryText) }}</span>
                    </div>
                    <div class="text-xs font-extrabold text-orange-700 truncate">
                      {{ currentCarouselIllAdjusted.bookTitle }}<span v-if="currentCarouselIllAdjusted.page" class="text-slate-500 font-normal"> · p.{{ currentCarouselIllAdjusted.page }}</span>
                    </div>
                    <div class="text-[11px] text-slate-700 leading-snug mt-0.5">
                      {{ currentCarouselIllAdjusted.caption || currentCarouselIllAdjusted.chapterTitle || currentCarouselIllAdjusted.filename }}
                    </div>
                  </div>
                </template>
                <!-- r34 Action bar — Tag · Copy URL · Go to TomTwin · Export -->
                <div v-if="currentCarouselIllAdjusted" class="flex items-center gap-2 px-2.5 py-1.5 border-t border-orange-100 bg-orange-50/30 flex-wrap">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-orange-700">Tag</span>
                  <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white border border-orange-200 text-orange-800 truncate max-w-[40%]">{{ illTag(currentCarouselIllAdjusted) }}</span>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded text-[11px] font-semibold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                    title="Copy URL for this Picture"
                    @click="copyUrl(currentCarouselIllAdjusted.url, 'picture')"
                  >📋 Copy URL</button>
                  <a
                    :href="twinBookUrl(currentCarouselIllAdjusted)"
                    target="_blank"
                    rel="noopener"
                    class="px-2 py-0.5 rounded text-[11px] font-semibold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                    title="Go to TomTwin where this illustration is found"
                  >🔗 Go to TomTwin</a>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 bg-white ml-auto"
                    title="📥 Save this picture file to ~/Downloads via a true JS-driven blob download.  Cross-origin Safari ignores the &quot;download&quot; attribute on raw anchors and dead-ends on the image URL — this button fetches the bytes and triggers a real save with no navigation."
                    @click="saveIllustrationFile(currentCarouselIllAdjusted)"
                  >📥 Export pic</button>
                </div>

                <!-- r34 MODE TOGGLE — "Show me other topic illustrations, rotating every 10 s" / "Stop rotation" -->
                <div class="flex items-center gap-2 px-2.5 py-1.5 border-t border-orange-100 bg-white">
                  <button
                    v-if="viewerMode !== 'rotating'"
                    type="button"
                    class="flex-1 px-2 py-1.5 rounded text-[11px] font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm"
                    :disabled="carouselWindow.length === 0"
                    title="Start rotating through the 10 cached illustrations (advance every 10 s).  Click any thumb below to stop on it."
                    @click="showRotating"
                  >▶ Show me other topic illustrations · rotating every 10 s</button>
                  <button
                    v-else
                    type="button"
                    class="flex-1 px-2 py-1.5 rounded text-[11px] font-extrabold text-orange-900 bg-orange-200 hover:bg-orange-300 border border-orange-400"
                    title="Stop the rotation and stay on the current illustration"
                    @click="selectThumb(carouselIndex - (glossaryDiagramSvg ? 1 : 0))"
                  >⏸ Stop rotation</button>
                  <button
                    v-if="glossaryDiagramSvg && viewerMode !== 'diagram'"
                    type="button"
                    class="px-2 py-1 rounded text-[11px] font-bold text-violet-700 hover:bg-violet-100 border border-violet-300 bg-white"
                    title="Return to the Glossary ontology diagram"
                    @click="showDiagram"
                  >📐 Back to diagram</button>
                </div>

                <!-- r34 THUMBNAIL STRIP — 10 thumbs in 2×5 grid, visible without scroll -->
                <div v-if="carouselWindow.length > 0" class="px-2.5 py-2 border-t border-orange-100 bg-slate-50">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                      Thumbs · {{ carouselWindow.length }} of {{ illustrationResults.length }} match{{ illustrationResults.length === 1 ? '' : 'es' }}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 bg-white"
                        title="Copy a markdown list of all 10 illustration URLs to the clipboard"
                        @click="copyMarkdownAll"
                      >📋 Copy all 10</button>
                      <button
                        v-if="carouselWindowSize < illustrationResults.length"
                        type="button"
                        class="px-1.5 py-0.5 rounded text-[10px] font-semibold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                        :title="`Refresh the strip with the next 10 illustrations (${illustrationResults.length - carouselWindowSize - carouselOffset} remaining)`"
                        @click="loadMoreCarousel"
                      >+ Next 10</button>
                    </div>
                  </div>
                  <!-- r41 v21 (Tom Gilb 2026-06-14 "we could say '+10 ills added
                       below' and auto scroll down to them, and separate each
                       group of 10 visually") — batch separator labels at every
                       10-thumb boundary; first batch has no label (already at
                       top).  Newly-added batch's label glows violet briefly.
                       Each thumb carries `data-gilb-thumb-idx` so loadMore
                       can scroll-to + flash the first thumb of the new batch. -->
                  <div class="grid grid-cols-5 gap-1.5">
                    <template v-for="(i, idx) in carouselWindow" :key="i.id">
                      <div
                        v-if="idx > 0 && idx % 10 === 0"
                        class="col-span-5 mt-2 mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border-t border-violet-200 pt-1.5 transition-colors"
                        :class="_newBatchStartIdx === idx
                          ? 'text-violet-900 bg-violet-100 rounded px-2 py-1 ring-2 ring-violet-400 -mx-1'
                          : 'text-violet-700'"
                      >
                        <span>—</span>
                        <span>Batch {{ Math.floor(idx / 10) + 1 }} · illustrations {{ idx + 1 }}–{{ Math.min(idx + 10, carouselWindow.length) }}</span>
                        <span v-if="_newBatchStartIdx === idx" class="ml-1 px-1.5 py-0.5 rounded-full bg-violet-700 text-white text-[9px] tracking-wider">JUST ADDED</span>
                        <span class="flex-1 border-t border-dashed border-violet-200"></span>
                      </div>
                      <button
                        type="button"
                        :data-gilb-thumb-idx="idx"
                        class="aspect-square rounded border-2 overflow-hidden bg-white relative group transition-all"
                        :class="[
                          (viewerMode !== 'diagram') && (carouselIndex - (glossaryDiagramSvg ? 1 : 0)) === idx
                            ? 'border-orange-600 ring-2 ring-orange-300'
                            : 'border-slate-200 hover:border-orange-400',
                          _clickedThumbIdx === idx ? 'gilb-thumb-click-flash' : '',
                          (_newBatchStartIdx >= 0 && idx >= _newBatchStartIdx && idx < _newBatchStartIdx + 10) ? 'gilb-thumb-new-batch-flash' : ''
                        ]"
                        :title="`${illTag(i)} · ${i.bookTitle}${i.page ? ' p.' + i.page : ''} — click to show in main viewer above`"
                        @click="selectThumb(idx)"
                      >
                        <img
                          :src="i.url"
                          :alt="i.caption || i.filename"
                          loading="lazy"
                          class="w-full h-full object-cover"
                        />
                        <span class="absolute top-0 left-0 bg-black/60 text-white text-[8px] px-1 leading-tight rounded-br">{{ idx + 1 }}</span>
                        <!-- r41 — feedback overlay on click -->
                        <span
                          v-if="_clickedThumbIdx === idx"
                          class="absolute inset-0 flex items-center justify-center bg-orange-500/40 pointer-events-none"
                        >
                          <span class="text-2xl text-white drop-shadow-lg">⬆</span>
                        </span>
                      </button>
                    </template>
                  </div>
                </div>
              </div>
              <!-- r36 — compact one-line placeholder when there is no Glossary diagram
                   AND no illustration matches.  Single-line, NOT 12 lines tall, so
                   it does not push other content below the fold (Tom Gilb 2026-06-14
                   r36 spec: "compact one-line placeholder"). -->
              <div v-else class="flex items-center justify-between gap-2 px-3 py-1.5 bg-white rounded-lg border border-orange-200 text-[11px]">
                <span class="text-slate-600 truncate">
                  📖 No illustrations indexed for "{{ queryText || '(empty)' }}" — try broader term, or click any star in the universe below
                </span>
                <a
                  href="https://www.gilb.com/tomtwin"
                  target="_blank"
                  rel="noopener"
                  class="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-violet-700 hover:bg-violet-100 border border-violet-200 bg-white"
                  title="Open Tom Gilb Consultant Twin (free reading tier) — browse every illustration across the full Tom Gilb corpus."
                >Open Twin ↗</a>
              </div>

              <!-- r41 v27 — Universe used to live here; hoisted into its own
                   tab block below for the new tab IA. -->
            </section>

            <!-- ════════════════════════════════════════════════════════════════
                 r41 v27 — 🌌 UNIVERSE TAB BODY
                 PlanguageUniverse constellation map (663 concepts × 106 categories).
                 ════════════════════════════════════════════════════════════════ -->
            <section v-show="activeTab === 'universe'" class="order-1 mb-3">
              <header class="flex items-center gap-2 px-2 py-1 mb-1.5 rounded bg-indigo-50 border border-indigo-200">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">🌌 Planguage Universe</span>
                <span class="text-[10px] text-slate-600 italic">{{ glossaryCount || 663 }} concepts as a starfield · hover for definition · click to navigate</span>
              </header>
              <div class="p-3 rounded-lg border-2 border-indigo-200 bg-gradient-to-b from-indigo-50 to-slate-50">
                <PlanguageUniverse @select-concept="(name: string) => { queryText = name }" />
              </div>
            </section>

            <!-- ════════════════════════════════════════════════════════════════
                 r41 v27 — 📚 BOOKS TAB BODY (NEW — Tom Gilb 2026-06-15 verbatim:
                 *"i cannot see how to get to bookkaleidoscope"*).  BookKaleidoscope
                 grid of 48 covers + alternating sample illustrations.  Cover tiles
                 link to Tom Gilb Consultant Twin per r41 v26.
                 ════════════════════════════════════════════════════════════════ -->
            <section v-show="activeTab === 'books'" class="order-1 mb-3">
              <header class="flex items-center gap-2 px-2 py-1 mb-1.5 rounded bg-amber-50 border border-amber-200">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">📚 BookKaleidoscope</span>
                <span class="text-[10px] text-slate-600 italic">
                  <strong>{{ _bookKaleidoscopeCount ?? 48 }}</strong> Tom Gilb books · alternating cover + sample illustration · click any tile to open on Tom Gilb Consultant Twin (free, no login).
                </span>
              </header>
              <div class="p-3 rounded-lg border-2 border-amber-200 bg-gradient-to-b from-amber-50/60 to-slate-50">
                <BookKaleidoscope
                  :tile-size="130"
                  @illustration-click="onKaleidoscopeIllustrationClick"
                />
              </div>
            </section>

            </div><!-- /flex-col wrapper (r41 v2 two-div sandwich) -->
          </div><!-- /gilb-picker-scroll-inner — outer scroll container -->
        </div><!-- close v-else flex-col (r30 wrapper) -->
      </div><!-- close BODY wrapper -->

      <!-- BOTTOM-MIRROR Insert + Close (DD-014) — only visible after load -->
      <footer
        v-if="!isLoading && !error"
        class="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex-wrap"
      >
        <div class="text-xs text-slate-600 min-w-0">
          <span v-if="selectedIllustration">
            📖 Illustration selected: <strong>{{ selectedIllustration.bookTitle }}</strong>
            <span v-if="selectedIllustration.page"> p.{{ selectedIllustration.page }}</span>
          </span>
          <span v-else-if="selectedText">
            💡 Text selected: <strong>{{ selectedText.title }}</strong>
            <span class="text-slate-400"> — {{ selectedText.subtitle }}</span>
          </span>
          <span v-else class="italic">Click a text card (left) OR an illustration (right) · double-click inserts directly.</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-md bg-white border border-slate-300 hover:bg-slate-100"
            title="Close without inserting"
            @click="emit('close')"
          >Cancel</button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow"
            :disabled="!hasSelection"
            :title="hasSelection ? 'Insert the selected card to clipboard, then ⌘V into any spec field' : 'Select first'"
            @click="onInsert"
          >Insert ↩</button>
        </div>
      </footer>
    </div>

    <!-- r37 (Tom Gilb 2026-06-14 verbatim: "the tiny digram does not enlarge") —
         fullscreen lightbox overlay for the embedded ontology diagram.  Click
         the embedded diagram → opens this overlay at near-full viewport.
         ESC / click-outside / red close pin all dismiss. -->
    <Teleport to="body">
      <div
        v-if="diagramExpanded && glossaryDiagramSvg"
        class="fixed inset-0 z-[2000] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-3"
        @click.self="diagramExpanded = false"
      >
        <div
          class="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style="width: 98vw; height: 96vh; max-width: 1900px;"
          @click.stop
        >
          <!-- r41 v15 (Tom Gilb 2026-06-14: "no export from here, and esc and
               outside is not the standard close button, we are not following
               the design rules") — rule compliance:
                 - CloseDot at END of header (Universal Close-Button rule)
                 - 📧 Export button (Universal Export-on-all-windows rule)
                 - Backdrop click + Escape continue to work alongside CloseDot
                   (CloseDot rule requires ALL THREE close affordances) -->
          <header class="flex items-center gap-3 px-5 py-3 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50 to-amber-50 shrink-0">
            <!-- r41 v24 (Tom Gilb 2026-06-14 Universal-Back-Navigation rule) —
                 ← Back at header LEFT slot returns to the picker (parent). -->
            <button
              type="button"
              class="px-3 py-1 rounded-md text-lg font-extrabold bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-800 border border-slate-300 hover:border-violet-400 leading-none transition-colors"
              title="← Back — close the enlarged diagram and return to the picker (the previous view).  Esc / outside-click / red close also dismiss."
              @click="diagramExpanded = false"
            >←</button>
            <span class="text-2xl">📐</span>
            <div class="min-w-0 flex-1">
              <div class="text-base font-extrabold text-violet-800">{{ glossaryDiagramTerm }} — Planguage Ontology</div>
              <div class="text-[11px] text-slate-600">From the Glossary entry · click any node to drill into its own ontology · ← Back / Esc / outside-click / red close all return to picker</div>
            </div>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 flex items-center gap-1"
              title="📧 Export this enlarged ontology diagram — preview window with the SVG at full resolution, clipboard HTML+plain, auto-open Mail to Tom@Gilb.com with the SEM Email Body Standard ⌘V cue.  Includes the term, concept number, Twin URL, and the diagram itself."
              @click="exportLightboxDiagram()"
            ><span>📧</span><span>Export</span></button>
            <CloseDot
              size="lg"
              aria-label="Close the enlarged ontology diagram"
              @click="diagramExpanded = false"
            />
          </header>
          <div class="flex-1 min-h-0 overflow-auto p-6 bg-white flex items-center justify-center">
            <div
              class="gilb-mermaid-host-fullscreen"
              v-html="glossaryDiagramSvg"
            ></div>
          </div>
          <footer class="px-5 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 shrink-0">
            🔍 Enlarged from the picker · click outside or press Esc to close
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- r41 v16 (Tom Gilb 2026-06-14 "no close and no export") — SEM-native
         illustration lightbox replacing the previous "open raw image in Safari"
         behaviour.  Follows the rule-compliant pattern: CloseDot at END of
         header (rightmost), Export button per Universal-Export-on-all-windows,
         backdrop click + Escape dismiss.  Secondary "Open raw image in new
         tab" link inside the lightbox preserves the old direct-access path. -->
    <Teleport to="body">
      <div
        v-if="illustrationLightboxOpen && illustrationLightboxItem"
        class="fixed inset-0 z-[2000] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-3"
        @click.self="closeIllustrationLightbox"
      >
        <div
          class="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style="width: 98vw; height: 96vh; max-width: 1900px;"
          @click.stop
        >
          <header class="flex items-center gap-3 px-5 py-3 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50 to-amber-50 shrink-0">
            <!-- r41 v24 (Universal-Back-Navigation rule) — ← Back at far left. -->
            <button
              type="button"
              class="px-3 py-1 rounded-md text-lg font-extrabold bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-800 border border-slate-300 hover:border-violet-400 leading-none transition-colors"
              title="← Back — close this enlarged illustration and return to the picker (the previous view).  Esc / outside-click / red close also dismiss."
              @click="closeIllustrationLightbox"
            >←</button>
            <span class="text-2xl">📖</span>
            <div class="min-w-0 flex-1">
              <div class="text-base font-extrabold text-violet-800 truncate">
                {{ illustrationLightboxItem.bookTitle }}<span v-if="illustrationLightboxItem.page" class="text-slate-500 font-semibold"> · p.{{ illustrationLightboxItem.page }}</span>
              </div>
              <div class="text-[11px] text-slate-600 truncate">
                {{ illustrationLightboxItem.chapterTitle || illustrationLightboxItem.caption || 'Illustration from Tom Gilb\'s published corpus' }}
                · ← Back / Esc / outside-click / red close all return to picker
              </div>
            </div>
            <!-- r41 v25 (Tom Gilb 2026-06-14: "the download does not work at
                 all, but it should not be necessary if the export button
                 works") — removed the Download button entirely.  The HTML
                 `download` attribute is silently ignored on cross-origin URLs
                 (illustrations live at <subdomain>.gilb.com, app at
                 localhost:5173) — Safari security policy.  The Export button
                 covers the use case: the preview window's 💾 Save action
                 writes a self-contained HTML, OR the user can right-click the
                 in-app lightbox image → Save Image As. -->

            <button
              type="button"
              class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 flex items-center gap-1"
              title="📧 Export this illustration — preview window with the image embedded + book + page + caption + source URL.  Clipboard HTML+plain.  Auto-open Mail to Tom@Gilb.com with the SEM Email Body Standard ⌘V cue."
              @click="exportIllustrationLightbox()"
            ><span>📧</span><span>Export</span></button>
            <CloseDot
              size="lg"
              aria-label="Close the enlarged illustration"
              @click="closeIllustrationLightbox"
            />
          </header>
          <div class="flex-1 min-h-0 overflow-auto p-3 bg-slate-50 flex items-center justify-center">
            <img
              :src="illustrationLightboxItem.url"
              :alt="illustrationLightboxItem.caption || illustrationLightboxItem.bookTitle"
              class="max-w-full max-h-full object-contain bg-white shadow-lg rounded"
              style="max-height: 88vh;"
            />
          </div>
          <footer class="px-5 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 shrink-0 flex items-center justify-between gap-3 flex-wrap">
            <span v-if="illustrationLightboxItem.caption && illustrationLightboxItem.caption !== illustrationLightboxItem.chapterTitle" class="truncate flex-1 min-w-0">{{ illustrationLightboxItem.caption }}</span>
            <span class="font-mono text-[10px] text-slate-500 shrink-0 truncate max-w-[40%]">{{ illustrationLightboxItem.url }}</span>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- r41 v32 — Phase 3 Illumination Settings drawer (per-Owner preferences).
         Teleported to body so it overlays the picker cleanly. -->
    <IlluminationSettingsPanel
      :open="_settingsOpen"
      :plan-id="props.planId ?? '?'"
      :owner-name="props.ownerName ?? '?'"
      @close="_closeIlluminationSettings"
      @changed="() => { /* effPrefs auto-updates via singleton reactive */ }"
    />

    <!-- r41 v33 — Phase 5 Email-the-following modal (checklist of session events). -->
    <IlluminationSessionEmailModal
      :open="_sessionEmailModalOpen"
      :recipient-email="effPrefs.preferredEmailAddress || 'Tom@Gilb.com'"
      :recipient-name="props.ownerName"
      @close="_sessionEmailModalOpen = false"
      @sent="(p) => showToast(`📧 Mail opened with ${p.count} event${p.count === 1 ? '' : 's'} selected.`, 4000)"
    />

    <!-- r41 v34 — Phase 4 Your Purposes menu. -->
    <IlluminatePurposeMenu
      :open="_purposeMenuOpen"
      :current-purpose-id="purposes.purpose.value?.id ?? null"
      :current-free-text="purposes.freeText.value"
      @close="_closePurposeMenu"
      @pick="_pickPurpose"
    />
  </div>
</template>

<style scoped>
/* r36 — Tom Gilb 2026-06-14
 * Fix C: make the scroll affordance VISIBLE.  ScrollContainer already renders
 * a right-edge progress track + bouncing pill at the bottom when content
 * overflows, but a real native webkit scrollbar gives a second, well-known
 * affordance that users instantly recognise.  Style applies to the
 * inner overflow-y-auto div inside .gilb-picker-scroll via :deep().
 */
/* r37 — Force scrollbar visibility (Tom Gilb 2026-06-14: "the window does not scroll").
 * r36's :deep(.overflow-y-auto) selector failed to apply in practice (Safari macOS
 * default-hides scrollbars when not actively hovering, and Vue scoped CSS through
 * ScrollContainer's component boundary was fragile).  r37 fix:
 *   (a) Target a UNIQUE class `gilb-picker-scroll-inner` injected via inner-class
 *       on ScrollContainer — this class lands DIRECTLY on the overflow-y-auto div.
 *   (b) Force overflow-y: scroll (not auto) so the bar ALWAYS reserves space and
 *       Safari always renders it.
 *   (c) :deep() still required because the styled element is rendered by
 *       ScrollContainer (a child component), not by this picker.
 *   (d) Bumped from 10px → 14px so the violet bar is unmistakable. */
/* r41 (Tom Gilb 2026-06-14) — scrollbar moved to the GLOBAL <style> block at
 * the end of this file because Vue's scoped :deep() across the ScrollContainer
 * component boundary wasn't applying reliably.  See bottom of file for the
 * unscoped rules. */

/* r36 — Fix B: clamp the primary Glossary definition to 4 lines unless
 * the user clicks "Read full definition".  CSS line-clamp is supported in
 * all modern browsers (Safari/Chrome/Firefox/Edge) via the -webkit prefix. */
.gilb-rich-def--clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* preserve newlines inside the clamp window */
  white-space: normal;
}
</style>

<!-- r41 (Tom Gilb 2026-06-14) — UNSCOPED global CSS for cross-component-boundary
     rules.  Scoped `:deep()` was not matching reliably through ScrollContainer's
     inheritAttrs:false root.  The class names are unique enough to be globally
     safe.  Rules:
       1. Force `overflow-y: scroll` on the picker body so the scrollbar always
          reserves space and engages reliably even when macOS auto-hides bars.
       2. Visible 14 px violet webkit scrollbar.
       3. Fullscreen mermaid SVG sized to fill the lightbox. -->
<style>
.gilb-picker-scroll-inner {
  overflow-y: scroll !important;
  scrollbar-color: #a78bfa #ede9fe;
  scrollbar-width: auto;
}
.gilb-picker-scroll-inner::-webkit-scrollbar {
  width: 14px;
  background: #ede9fe;
}
.gilb-picker-scroll-inner::-webkit-scrollbar-track {
  background: #ede9fe;
  border-radius: 7px;
}
.gilb-picker-scroll-inner::-webkit-scrollbar-thumb {
  background: #a78bfa;
  border-radius: 7px;
  border: 2px solid #ede9fe;
  min-height: 40px;
}
.gilb-picker-scroll-inner::-webkit-scrollbar-thumb:hover {
  background: #8b5cf6;
}
.gilb-mermaid-host-fullscreen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gilb-mermaid-host-fullscreen svg {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 90vh !important;
}
/* r41 v3 (Tom 2026-06-14) — embedded mermaid host scaled ~3× larger.
   Mermaid emits SVG with explicit width=/height= attributes; we override via
   CSS+!important so the diagram fills the enlarged container.  width 100%
   means it expands to fill horizontally; height auto preserves aspect. */
.gilb-mermaid-host-large {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gilb-mermaid-host-large svg {
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  min-height: 480px !important;
  max-height: 1100px !important;
}
/* r41 v4 (Tom Gilb 2026-06-14) — intra-diagram navigation hover affordance.
   Every mermaid node tagged with .gilb-diagram-node-clickable gets a violet
   hover halo + slight scale on hover so the user knows "click to drill in
   to this concept's diagram".  The transform uses transform-box so SVG
   nested transforms compose correctly. */
.gilb-mermaid-host-large g.gilb-diagram-node-clickable {
  transition: filter 0.2s ease, opacity 0.2s ease;
  transform-box: fill-box;
  transform-origin: center;
}
.gilb-mermaid-host-large g.gilb-diagram-node-clickable:hover {
  filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.6));
}
.gilb-mermaid-host-large g.gilb-diagram-node-clickable:hover rect,
.gilb-mermaid-host-large g.gilb-diagram-node-clickable:hover polygon,
.gilb-mermaid-host-large g.gilb-diagram-node-clickable:hover circle,
.gilb-mermaid-host-large g.gilb-diagram-node-clickable:hover ellipse,
.gilb-mermaid-host-large g.gilb-diagram-node-clickable:hover path {
  stroke: #7c3aed !important;
  stroke-width: 2.5px !important;
}
/* r41 v13 — same hover affordance for the fullscreen lightbox diagram nodes. */
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable {
  transition: filter 0.2s ease, opacity 0.2s ease;
  transform-box: fill-box;
  transform-origin: center;
}
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable:hover {
  filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.7));
}
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable:hover rect,
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable:hover polygon,
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable:hover circle,
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable:hover ellipse,
.gilb-mermaid-host-fullscreen g.gilb-diagram-node-clickable:hover path {
  stroke: #7c3aed !important;
  stroke-width: 3px !important;
}
/* r41 (Tom Gilb 2026-06-14: "when thumb is clicked, id like a feedback reaction") —
   thumbnail click flash animation: scale pulse + orange ring. */
.gilb-thumb-click-flash {
  animation: gilb-thumb-click-pulse 0.7s ease-out;
}
@keyframes gilb-thumb-click-pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.0); }
  30%  { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(249, 115, 22, 0.45); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.0); }
}
/* r41 v21 (Tom Gilb 2026-06-14: "auto scroll down to them, and separate each
   group of 10 visually") — newly-added thumbs flash violet so the user sees
   exactly which ten are the freshly-loaded batch. */
.gilb-thumb-new-batch-flash {
  animation: gilb-thumb-new-batch 2.2s ease-out;
}
@keyframes gilb-thumb-new-batch {
  0%   { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.0); }
  15%  { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0.55); }
  100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.0); }
}
</style>
