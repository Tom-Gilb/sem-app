<!-- SelectionDefiner.vue — Global selection → define feature.
     Mount this once at the app level (inside <template v-else-if="view === 'app'">).

     Three surfaces:
       1. Floating "📖 Define" pill — appears above any non-trivial text selection.
          Clicking it triggers an AI definition lookup.
       2. Result panel — slides up from the bottom showing the definition + source.
       3. Keyboard: Opt+I (Option+I) calls defineCurrentSelection().
          Voice "Define" is wired in App.vue dictation commands.

     For Planguage terms: a "More Concept Detail" section appears below the AI definition,
     loading the full glossary entry from the vault via the local /api/glossary endpoint.
     The entry is organised into tabs (Card · Notes · Examples · Diagram · Mistakes).
     Diagrams are rendered on demand using mermaid (lazy-loaded to keep initial bundle small).

     Props:  spec — the current SpecBlock (passed as context for AI definitions).
     No emits — self-contained via useDefine module-level state. -->

<script setup lang="ts">
import CloseDot from './CloseDot.vue'
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import {
  useDefine,
  defineTerm,
  defineCurrentSelection,
  closeDefine,
  cancelDefine,
  DEFINE_TYPE_LABELS,
  DEFINE_TYPE_COLOURS,
} from '../composables/useDefine'
import { useTwinCitation, twinConceptUrl } from '../composables/useTwinCitation'
import RenderedMarkdown from './RenderedMarkdown.vue'
import { useGlossaryEntry } from '../composables/useGlossaryEntry'
import { parseGlossaryEntry } from '../utils/parseGlossaryEntry'
import type { SpecBlock } from '../types/spec'
// r93ll — Export-on-all-windows SUPREME rule: Copy + Email actions
import { exportCopy, exportEmail } from '../composables/useExportShared'
import { useToast } from '../composables/useToast'
const { showToast: _illuminateToast } = useToast()

const props = defineProps<{
  spec: SpecBlock | null
}>()

const { result, loading, error, open, term, defineSearchOpen } = useDefine()

// ── r93ttt — Tom's Twin tier (Tom Gilb 2026-06-12 "Go for the design for Illum") ──
const {
  citeTerm: _twinCiteTerm,
  isLoading: twinLoading,
  lastResult: twinResult,
  lastError: twinError,
  TWIN_LOGIN_URL,
} = useTwinCitation()

const twinElapsed = ref(0)
let _twinElapsedTimer: ReturnType<typeof setInterval> | null = null

// r93zzz — Twin navigation: stack of previously-viewed concept terms so the
// user can drill into related concepts and back out again.
const twinHistory = ref<string[]>([])
const twinEnlarged = ref(false)

async function askTwin(t: string): Promise<void> {
  twinElapsed.value = 0
  if (_twinElapsedTimer) { clearInterval(_twinElapsedTimer); _twinElapsedTimer = null }
  const start = Date.now()
  _twinElapsedTimer = setInterval(() => {
    twinElapsed.value = Math.round((Date.now() - start) / 1000)
  }, 250)
  try {
    await _twinCiteTerm(t)
  } catch { /* twinError is already set by the composable */ }
  if (_twinElapsedTimer) { clearInterval(_twinElapsedTimer); _twinElapsedTimer = null }
}

/** r93zzz — drill-into-related-concept handler. Push the current term onto the
 *  navigation history, then query the Twin for the new term. The user can
 *  navigate back via the ← arrow that appears next to the From-Twin header. */
async function onConceptDrilldown(payload: { name: string; number: string }): Promise<void> {
  const current = (twinResult.value?.term ?? '').trim()
  if (current) twinHistory.value.push(current)
  await askTwin(payload.name)
}

/** r93d7 — 💡 Illuminate (⌘I) on a concept row. Tom Gilb 2026-06-13: "click on
 *  the glossary diagram elements … look it up in illustrate cmnd i". Routes
 *  through the CANONICAL Illuminate entry point — `defineTerm()` — exactly
 *  as the ⌥I keyboard shortcut would. That runs: local Planguage Glossary
 *  tier 1 (instant) + Twin Consultant fallback (r93uuu chain). Updates the
 *  Illuminate panel's `result` ref; the user can re-click 🔮 Ask Tom's Twin
 *  to refresh the rich Twin response for the new concept. */
function onConceptIlluminate(payload: { name: string; number: string }): void {
  defineTerm(payload.name, props.spec)
}

/** r93zzz — pop the last term off the history and re-query Twin for it. */
async function onTwinBack(): Promise<void> {
  const prev = twinHistory.value.pop()
  if (prev) await askTwin(prev)
}
const { loading: gLoading, entry: gEntry, error: gError, synonymOf: gSynonymOf, nearMatchOptions: gNearMatchOptions, probeError: gProbeError, fetchEntry, clearEntry } = useGlossaryEntry()

// ── Floating pill state ────────────────────────────────────────────────────

const pillVisible = ref(false)
const pillX       = ref(0)   // CSS left (pixels from viewport left)
const pillY       = ref(0)   // CSS top (pixels from viewport top)
const pillTerm    = ref('')

// ── Persistent Define FAB + Term Search ───────────────────────────────────

// defineSearchOpen comes from useDefine() module-level shared state.
// openDefineSearch() (called from nav-bar buttons in App.vue) sets it true.
// We read + write it directly here — no watch() needed, no reactive loop risk.
// Local alias for ergonomics (same semantics as the old local termSearchOpen ref).
const termSearchValue = ref('')
const termSearchInputRef = ref<HTMLInputElement | null>(null)

/** Last 5 defined terms — persisted to localStorage for quick re-lookup */
const RECENT_TERMS_KEY = 'sem-define-recent'
const recentTerms = ref<string[]>(
  // IIFE required — ref() does NOT accept a factory function (that is a React pattern).
  // Passing a function directly stores the function as the value, not the return value.
  (() => {
    try { return JSON.parse(localStorage.getItem(RECENT_TERMS_KEY) ?? '[]') as string[] } catch { return [] }
  })()
)

function _recordRecentTerm(t: string): void {
  const next = [t, ...recentTerms.value.filter(r => r.toLowerCase() !== t.toLowerCase())].slice(0, 6)
  recentTerms.value = next
  try { localStorage.setItem(RECENT_TERMS_KEY, JSON.stringify(next)) } catch { /* quota */ }
}

/** Handle the always-visible 📖 Define FAB click. */
function handleDefineFABClick(): void {
  // Priority 1: live text selection
  const sel = window.getSelection()?.toString().trim() ?? ''
  if (sel.length >= MIN_CHARS && sel.length <= MAX_CHARS) {
    pillVisible.value = false
    defineTerm(sel, props.spec)
    return
  }
  // Priority 2: last pill term (user selected text but pill is still pending)
  if (pillTerm.value) {
    pillVisible.value = false
    defineTerm(pillTerm.value, props.spec)
    return
  }
  // Priority 3: no selection — open term search panel
  defineSearchOpen.value = true
  termSearchValue.value = ''
  nextTick(() => termSearchInputRef.value?.focus())
}

function handleTermSearchSubmit(): void {
  const t = termSearchValue.value.trim()
  if (t) {
    defineSearchOpen.value = false
    termSearchValue.value = ''
    defineTerm(t, props.spec)
  }
}

function closeTermSearch(): void {
  defineSearchOpen.value = false
  termSearchValue.value = ''
}

// ── First-use ⌥I discovery tip ────────────────────────────────────────────
// Shown once after the first successful define (any method), then permanently
// dismissed via localStorage flag.  Teaches the keyboard shortcut + no-
// selection path at the moment of highest engagement — right after the user
// sees their first definition result.
const TIP_SHOWN_KEY = 'sem-define-tip-shown'
const tipDismissed = ref<boolean>(
  (() => { try { return localStorage.getItem(TIP_SHOWN_KEY) === '1' } catch { return false } })(),
)

function dismissTip(): void {
  tipDismissed.value = true
  try { localStorage.setItem(TIP_SHOWN_KEY, '1') } catch { /* quota */ }
}

let _selectionTimer: ReturnType<typeof setTimeout> | null = null

/** Minimum / maximum word count for the pill to appear. */
const MIN_CHARS = 2
const MAX_CHARS = 120

// ── Illuminate loading animation — spinner + elapsed + % (no amuse; short calls) ──
// Asymptote τ=20s: reaches ~50% at 14s, ~80% at 32s, caps at 95% until done.
// No wisdom carousel — Tom: "do not include amuse, as I do not expect long waits."

const illuminateElapsed  = ref(0)
const illuminateProgress = ref(0)

let _ilElapsedTimer: ReturnType<typeof setInterval> | null = null
let _ilAnimStart = 0

function _startIlluminateAnimation(): void {
  _ilAnimStart = Date.now()
  illuminateElapsed.value  = 0
  illuminateProgress.value = 0
  if (_ilElapsedTimer) { clearInterval(_ilElapsedTimer); _ilElapsedTimer = null }
  _ilElapsedTimer = setInterval(() => {
    const secs = Math.round((Date.now() - _ilAnimStart) / 1000)
    illuminateElapsed.value  = secs
    illuminateProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 20)) * 100))
  }, 250)
}

function _stopIlluminateAnimation(): void {
  if (_ilElapsedTimer) { clearInterval(_ilElapsedTimer); _ilElapsedTimer = null }
  illuminateProgress.value = 100
}

watch(loading, (nowLoading) => {
  if (nowLoading) _startIlluminateAnimation()
  else            _stopIlluminateAnimation()
})

function _updatePill(): void {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    pillVisible.value = false
    return
  }

  const text = sel.toString().trim()
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
    pillVisible.value = false
    return
  }

  // r41 v368 (Tom Gilb 2026-06-25 "selecting a word does not any longer open
  // illumination") — RELAXED the input/textarea suppression.  The old check
  // queried `document.activeElement` — which returns the LAST-FOCUSED element
  // even when the user's CURRENT selection is somewhere else entirely.
  // Scenario: Tom types Plan Name in an <input>, clicks out, then drag-
  // selects text in a paragraph below.  activeElement is still the input,
  // pillVisible is suppressed, the floating Illuminate pill never appears.
  //
  // Fix: examine the SELECTION's commonAncestorContainer, not the focused
  // element.  Suppress the pill ONLY when the actual range lives inside an
  // input/textarea (which is the rare case where we don't want to disrupt
  // typing).  This restores the Define-by-Selection rule's promise.
  try {
    const range = sel.getRangeAt(0)
    let node: Node | null = range.commonAncestorContainer
    while (node && node !== document.body) {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        pillVisible.value = false
        return
      }
      node = node.parentNode
    }
  } catch {
    // getRangeAt(0) can throw if selection collapsed mid-flight — fall through
  }

  try {
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      pillVisible.value = false
      return
    }

    // Position: centred above the selection, 8px gap.
    //
    // Flip logic: show below selection only when placing above would put the
    // pill behind the fixed Plan Crest + stage bar at the top of the viewport
    // (~200px). For selections anywhere else — including text selected INSIDE
    // the More Concept Detail window — the pill appears ABOVE the word, which
    // is where users expect it (Tom 2026-06-01: "right above the selected word").
    // The pill uses z-[10102] so it renders above the result panel (z-[10100]).
    const PILL_HEIGHT = 36
    const rawTop = rect.top - PILL_HEIGHT - 4   // 4px gap: closer to the selected word (Tom 2026-06-01)
    const flipBelow = rawTop < 200    // 200px ≈ Plan Crest (60px) + stage bar (124px) + 16px buffer

    pillX.value       = Math.min(
      Math.max(rect.left + rect.width / 2, 60),
      window.innerWidth - 60,
    )
    pillY.value       = flipBelow ? rect.bottom + 4 : rawTop
    pillTerm.value    = text
    pillVisible.value = true
  } catch {
    pillVisible.value = false
  }
}

function _onSelectionChange(): void {
  if (_selectionTimer !== null) clearTimeout(_selectionTimer)
  // Debounce 220 ms — avoids flickering during drag-select
  _selectionTimer = setTimeout(_updatePill, 220)
}

function _onMouseup(): void {
  if (_selectionTimer !== null) clearTimeout(_selectionTimer)
  _selectionTimer = setTimeout(_updatePill, 100)
}

function _onKeydown(e: KeyboardEvent): void {
  // r93h1 — Illuminate shortcut binding. Tom Gilb 2026-06-13 verbatim:
  //   "btw 2x using cmnd i it suddenly jumps to email mine"
  //
  // Root cause: Tom presses ⌘I (Cmd+I) per his "cmnd i" wording — but Safari's
  // native binding for ⌘I is "Email Link to This Page", which opens Mail.app
  // with a share-link composer. The pre-r93h1 handler only bound ⌥I (Option+I),
  // so ⌘I went straight through to Safari → Mail opened. Twice = TWO emails.
  //
  // Fix: bind BOTH ⌘I AND ⌥I, and call preventDefault EARLY so Safari's
  // native handler doesn't fire. e.preventDefault on keydown reliably
  // suppresses ⌘I → Email Page Link in current Safari (the pre-r93h1 stale
  // comment "cannot be overridden from JS" was wrong; current Safari honours
  // preventDefault from a captured keydown). The legacy comment about ⌥I being
  // "owned by Safari" was also incorrect — ⌥I produces a dead-key circumflex
  // in text fields but is otherwise free; Safari's email shortcut is ⌘I.
  //
  // Both physical-key codes (`KeyI`) match because ⌥ + I on Mac produces a
  // dead-key (so e.key === 'Dead', not 'i') — we use e.code for layout-
  // independent matching.
  if ((e.altKey || e.metaKey) && e.code === 'KeyI') {
    // Guard: don't intercept when the user is typing in a text field.
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) return
    e.preventDefault()
    // Evaluate selection BEFORE the completed-result guard so concept-within-concept
    // drill-down works: user can select text INSIDE the More Concept Detail window and
    // press ⌥I to look up that term. Design requirement 2026-06-01.
    const sel = window.getSelection()?.toString().trim() ?? ''
    const hasSelection = sel.length >= MIN_CHARS && sel.length <= MAX_CHARS
    // Block ⌥I only when a completed result is showing, the panel is not loading,
    // AND the user has no new text selected (pressing ⌥I with nothing selected while
    // a result is visible would open a blank search, losing the current view pointlessly).
    // With a selection always proceed — drill-down from inside the detail window.
    // If the panel is stuck on a spinner (open=true, loading=true, result=null),
    // allow ⌥I to start a fresh call so the user is never locked out.
    if (open.value && result.value && !loading.value && !hasSelection) return
    if (hasSelection) {
      defineCurrentSelection(props.spec)
    } else {
      // ⌥I with no live selection → always open a BLANK term search aperture.
      // Do NOT fall back to pillTerm (last hovered term) — Tom: "I want ⌥I to
      // open a blank aperture to put in a new word." pillTerm is used only by
      // the floating pill click path, not by the keyboard shortcut.
      defineSearchOpen.value = true
      termSearchValue.value  = ''
      nextTick(() => termSearchInputRef.value?.focus())
    }
  }
  // Escape — close result panel OR term search
  if (e.key === 'Escape') {
    if (open.value) { closeDefine(); return }
    if (defineSearchOpen.value) { closeTermSearch(); return }
  }
}

function handlePillClick(): void {
  // Clear browser selection so it does not persist into the next lookup's DOM.
  // Stale selection ranges can cause _updatePill to fire with old coordinates
  // when the new concept detail content mounts, showing a mispositioned pill.
  window.getSelection()?.removeAllRanges()
  pillVisible.value = false
  defineTerm(pillTerm.value, props.spec)
}

// ── Click-outside handler (replaces fixed-inset-0 backdrops) ─────────────────
// The old approach used `fixed inset-0 z-[-1]` backdrop divs inside z-[10100]
// stacking contexts.  Those backdrops cover the entire viewport at z-[10100]
// level globally — blocking clicks on the Plan Crest bar (z-[300]) and any
// other surface below z-[10100] whenever the define panel or term search is
// open.  Using capture-phase mousedown on document instead costs nothing and
// lets all other surfaces receive their clicks normally.
function _onOutsideMousedown(e: MouseEvent): void {
  const t = e.target as Element | null
  if (!t) return
  // The floating Illuminate pill (data-seldef-pill) is Teleported to <body> —
  // it is NOT a descendant of data-seldef-card. Without this guard the capture-
  // phase handler would call closeDefine() every time the pill is clicked,
  // causing the panel to flash close-and-reopen (true→false→true on _open)
  // before handlePillClick() fires. That rapid toggle corrupts the watch(open)
  // → clearEntry() sequence and breaks subsequent selections. (2026-06-01)
  if ((t as Element).closest?.('[data-seldef-pill]')) return
  // Term-search popup: check first (it is z-[10101] — child of the same session)
  if (defineSearchOpen.value) {
    const search = document.querySelector<HTMLElement>('[data-seldef-search]')
    if (search && !search.contains(t)) closeTermSearch()
  }
  // Main define panel
  if (open.value) {
    const card = document.querySelector<HTMLElement>('[data-seldef-card]')
    if (card && !card.contains(t)) closeDefine()
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', _onSelectionChange)
  document.addEventListener('mouseup',         _onMouseup)
  window.addEventListener('keydown',           _onKeydown)
  document.addEventListener('mousedown',       _onOutsideMousedown, true) // capture

  // HMR safety: when Vite hot-reloads this component while the Define panel is
  // already showing a result, the new instance's watch(result) does NOT fire
  // (no change occurred — the module-level result ref kept its value across the
  // hot-reload). Manually probe the glossary for the active term so gEntry is
  // populated and the "More Concept Detail" button appears.
  if (result.value?.term) {
    fetchEntry(result.value.term)
  }
})

// ─── r93ll — Export Illuminate (Copy + Email) ────────────────────────────
//
// Tom Gilb 2026-06-11 (SUPREME upgrade to Export-on-all-windows rule):
//   "The export ideally should be everything the window can offer, not just what
//    is immediately visible. All choices such as diagrams, and triangle flip down
//    lines. Assure me you can do this, if not we need a message of what the export
//    will not contain, and how to get it sent."
//
// Captures EVERY tab's content into a single colourful HTML document:
//   - At a Glance (summary + card markdown)
//   - Notes (markdown)
//   - Examples (markdown)
//   - Diagram (Mermaid SOURCE included verbatim; note that rendered SVG is
//     environment-dependent and the user views it inside the app for the live render)
//   - Mistakes (markdown, if present)
//   - Joke (if present)
//   - Related concepts list
// The Completeness Pledge: every section that exists in the entry is INCLUDED.
// What's NOT included is explicitly NAMED at the bottom of the email so the
// recipient knows what to view in the app.

function _safeMd(text: string | undefined | null): string {
  if (!text) return ''
  // Minimal escaping — preserve the markdown source as a code block.
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** r93oo (Tom Gilb 2026-06-11 "I did not get the diagram") — render each Mermaid source
 *  to inline SVG via the in-app mermaid instance so the email/clipboard contains the
 *  VISUAL diagram, not just the source code. SVGs land inline so they survive Mail.app
 *  rendering. Returns parallel array to diagrams[]; SVG string per index, OR null when
 *  rendering failed (so the caller can fall back to source + explicit note). */
async function _renderDiagramsToSvg(diagrams: string[]): Promise<(string | null)[]> {
  if (diagrams.length === 0) return []
  try {
    const m = await _loadMermaidScript()
    // Set theme so SVG colours match the in-app render
    m.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    const out: (string | null)[] = []
    for (let i = 0; i < diagrams.length; i++) {
      try {
        // Unique id per render (mermaid requires it)
        const id = `illum-export-${Date.now()}-${i}`
        const { svg } = await m.render(id, diagrams[i])
        out.push(svg)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[illuminate-export] mermaid render failed for diagram', i, err)
        out.push(null)
      }
    }
    return out
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[illuminate-export] mermaid script load failed', err)
    return diagrams.map(() => null)
  }
}

function renderIlluminateHtml(diagramSvgs: (string | null)[] = []): string {
  const e = gEntry.value
  if (!e) return ''
  const term = e.term ?? result.value?.term ?? '—'
  const conceptNum = (e as { conceptNumber?: string }).conceptNumber ?? ''
  const keyedIcon  = (e as { keyedIcon?: string }).keyedIcon ?? ''
  const atGlance   = (e as { atAGlanceSummary?: string }).atAGlanceSummary ?? ''
  const atGlanceC  = (e as { atAGlanceCard?: string }).atAGlanceCard ?? ''
  const notes      = (e as { notes?: string }).notes ?? ''
  const examples   = (e as { examples?: string }).examples ?? ''
  const mistakes   = (e as { mistakes?: string }).mistakes ?? ''
  const joke       = (e as { joke?: string }).joke ?? ''
  const related    = (e as { relatedConcepts?: string }).relatedConcepts ?? ''
  const diagrams   = (e as { diagrams?: string[] }).diagrams ?? []

  const section = (title: string, body: string, bg: string, accent: string) =>
    body ? `
  <tr><td bgcolor="${bg}" style="background:${bg};padding:14px 20px;border-left:4px solid ${accent};">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${accent};letter-spacing:1px;">${title}</div>
    <div style="font-size:13px;color:#1e293b;line-height:1.55;margin-top:6px;font-family:system-ui,-apple-system,sans-serif;white-space:pre-wrap;">${_safeMd(body)}</div>
  </td></tr>` : ''

  // r93oo — render diagrams as inline SVG when mermaid produced one; fall back to source
  // code in a <pre> block ONLY when the render failed (with an explanatory note).
  const diagramsBlock = diagrams.length > 0 ? `
  <tr><td bgcolor="#f0fdf4" style="background:#f0fdf4;padding:14px 20px;border-left:4px solid #16a34a;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#14532d;letter-spacing:1px;">Diagram${diagrams.length > 1 ? 's' : ''}</div>
    ${diagrams.map((d, i) => {
      const svg = diagramSvgs[i]
      const heading = diagrams.length > 1 ? `<div style="font-size:11px;font-weight:600;color:#14532d;margin-top:10px;">Diagram ${i + 1}</div>` : ''
      if (svg) {
        // Inline SVG — render visually in any HTML email/document viewer.
        // Wrap in a div with max-width so wide diagrams don't blow out the email column.
        return `${heading}<div style="background:#fff;border:1px solid #d1fae5;border-radius:6px;padding:10px;margin-top:6px;text-align:center;overflow-x:auto;">${svg}</div>`
      }
      // Fallback: render failed → embed source + explicit note per Completeness Pledge
      return `${heading}<div style="font-size:11px;color:#92400e;margin-top:6px;font-style:italic;">Mermaid render failed in this export — Mermaid source below; paste into any Mermaid-aware viewer (mermaid.live) or open the term in the SEM App via ⌘I for the live SVG.</div><pre style="background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:6px;margin:6px 0 0 0;font-family:ui-monospace,monospace;font-size:11px;line-height:1.45;overflow-x:auto;white-space:pre-wrap;">${_safeMd(d)}</pre>`
    }).join('')}
  </td></tr>` : ''

  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:780px;font-family:system-ui,-apple-system,sans-serif;border-collapse:collapse;">
  <tr><td bgcolor="#6d28d9" style="background:linear-gradient(90deg,#7c3aed,#4f46e5);color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:0.85;">💡 Illuminate · Planguage Term</div>
    <div style="font-size:22px;font-weight:900;margin-top:6px;">"${_safeMd(term)}"</div>
    ${conceptNum ? `<div style="font-size:13px;opacity:0.85;margin-top:4px;">Concept ${_safeMd(conceptNum)} · ${_safeMd(keyedIcon)}</div>` : ''}
  </td></tr>
  ${result.value?.definition ? section('Definition (in context)', result.value.definition, '#eff6ff', '#2563eb') : ''}
  ${section('At a Glance', atGlance, '#f5f3ff', '#7c3aed')}
  ${atGlanceC ? section('At-a-Glance Card (markdown source)', atGlanceC, '#faf5ff', '#9333ea') : ''}
  ${section('Notes', notes, '#fffbeb', '#d97706')}
  ${section('Examples', examples, '#ecfeff', '#0891b2')}
  ${section('Mistakes', mistakes, '#fef2f2', '#dc2626')}
  ${section('Joke', joke, '#fdf2f8', '#db2777')}
  ${section('Related Concepts', related, '#f0f9ff', '#0284c7')}
  ${diagramsBlock}
  <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:12px 20px;border-radius:0 0 12px 12px;font-size:10px;color:#475569;">
    <strong>Completeness Pledge (r93ll / r93oo):</strong> this export includes every section the Illuminate panel can show for this term — At a Glance, Notes, Examples, Mistakes, Joke, Related — plus the Diagram <em>rendered inline as SVG</em> (not just source). The SEM App's interactive click-to-zoom / pan affordances on the diagram are environment-specific; open the term in the SEM App via ⌘I for the interactive view.
  </td></tr>
</table>`
}

function renderIlluminatePlain(): string {
  const e = gEntry.value
  if (!e) return ''
  const term = e.term ?? result.value?.term ?? '—'
  const conceptNum = (e as { conceptNumber?: string }).conceptNumber ?? ''
  const lines: string[] = [
    `ILLUMINATE · Planguage Term · "${term}"`,
    conceptNum ? `Concept ${conceptNum}` : '',
    '',
  ]
  const block = (title: string, body: string | undefined | null) => {
    if (!body) return
    lines.push(title.toUpperCase(), body.trim(), '')
  }
  if (result.value?.definition) block('Definition (in context)', result.value.definition)
  block('At a Glance',           (e as { atAGlanceSummary?: string }).atAGlanceSummary)
  block('At-a-Glance Card',      (e as { atAGlanceCard?: string }).atAGlanceCard)
  block('Notes',                 (e as { notes?: string }).notes)
  block('Examples',              (e as { examples?: string }).examples)
  block('Mistakes',              (e as { mistakes?: string }).mistakes)
  block('Joke',                  (e as { joke?: string }).joke)
  block('Related Concepts',      (e as { relatedConcepts?: string }).relatedConcepts)
  const diagrams = (e as { diagrams?: string[] }).diagrams ?? []
  if (diagrams.length > 0) {
    lines.push('DIAGRAM SOURCE (Mermaid — view in the app for rendered SVG)')
    diagrams.forEach((d, i) => {
      if (diagrams.length > 1) lines.push(`--- Diagram ${i + 1} ---`)
      lines.push(d, '')
    })
  }
  lines.push('')
  lines.push('COMPLETENESS PLEDGE (r93ll/r93oo): every section the Illuminate panel can show for')
  lines.push('this term is included above. The HTML colour version on your clipboard ALSO carries')
  lines.push('the rendered diagram SVG inline (paste with ⌘V into Mail / Notes / Keynote to see it).')
  lines.push('Mermaid source above is the canonical text form; the live SEM App (⌘I) renders the')
  lines.push('diagram interactively with click-to-zoom and pan.')
  return lines.join('\n')
}

async function exportIlluminate(mode: 'copy' | 'email'): Promise<void> {
  if (!gEntry.value) return
  const term     = gEntry.value.term ?? result.value?.term ?? '—'
  const diagrams = (gEntry.value as { diagrams?: string[] }).diagrams ?? []
  // r93oo — render diagrams to SVG via mermaid BEFORE building HTML so the email
  // carries the visual diagram, not just source.
  _illuminateToast(diagrams.length > 0
    ? `💡 Rendering ${diagrams.length} diagram${diagrams.length === 1 ? '' : 's'}…`
    : `💡 Preparing export…`, 2000)
  const diagramSvgs = await _renderDiagramsToSvg(diagrams)
  const html  = renderIlluminateHtml(diagramSvgs)
  const plain = renderIlluminatePlain()
  if (mode === 'copy') {
    await exportCopy(html, plain)
    _illuminateToast(`💡 Illuminate "${term}" copied as colourful HTML — paste with ⌘V`, 5000)
  } else {
    await exportEmail(html, `Illuminate · "${term}"`, `Illuminate "${term}"`, 'Tom@Gilb.com', plain)
  }
}

onUnmounted(() => {
  document.removeEventListener('selectionchange', _onSelectionChange)
  document.removeEventListener('mouseup',         _onMouseup)
  window.removeEventListener('keydown',           _onKeydown)
  document.removeEventListener('mousedown',       _onOutsideMousedown, true)
  if (_selectionTimer !== null) clearTimeout(_selectionTimer)
  _stopIlluminateAnimation()
})

// ── Result panel computed helpers ─────────────────────────────────────────

const typeLabel = computed(() =>
  result.value ? DEFINE_TYPE_LABELS[result.value.type] : '',
)
const typeColour = computed(() =>
  result.value ? DEFINE_TYPE_COLOURS[result.value.type] : 'bg-slate-100 text-slate-600',
)

// ── More Concept Detail — Planguage glossary section ──────────────────────

/** Whether the glossary panel is expanded */
const detailOpen    = ref(false)
/** Active tab in the detail panel */
type DetailTab = 'card' | 'notes' | 'examples' | 'diagram' | 'mistakes' | 'joke' | 'related'
const activeDetailTab = ref<DetailTab>('card')

// r41 v27 (Tom Gilb 2026-06-14 verbatim: "SOMEWHERE I SAID I DID NOT WANT
// THE OLD ICONS BUT I LIKE THOSE THAT MIMIC A MINI CLIP OF WHAT IS SHOWN IN
// THE TOOL") — applying the Thumbnail Reality rule (sem-app-ui-rules Rule 5):
// each tab icon is now a mini-SVG preview of what that tab's content looks
// like.  Generic emoji replaced.
//
// Per-tab mini-clip design:
//   At a Glance → tiny spec card (heading + 3 horizontal data lines)
//   Notes       → lined sheet (5 horizontal text lines)
//   Examples    → numbered list (1. 2. 3. with stub lines)
//   Diagram     → 3 connected nodes (mini ontology graph)
//   Mistakes    → checklist with X marks (anti-pattern list)
//   Joke        → speech bubble (quotation)
//   Related     → dot-and-link network (cross-reference graph)
//
// All SVGs use currentColor so they inherit the tab's theme color.
const detailTabs: {
  key: DetailTab
  label: string
  /** Inline SVG path content — drawn in a 32×24 viewBox for landscape mini-clip */
  svg:  string
  /** Active-state colour family — tailwind class roots */
  active:  string
  hover:   string
  tinted:  string
}[] = [
  { key: 'card',     label: 'At a Glance',
    // Mini spec card: heading bar + 3 short data lines (mimics At-a-Glance card)
    svg: '<rect x="3" y="3" width="26" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>\
<rect x="6" y="6"  width="16" height="2" rx="0.6" fill="currentColor"/>\
<rect x="6" y="11" width="20" height="1.5" rx="0.4" fill="currentColor" opacity="0.55"/>\
<rect x="6" y="14" width="14" height="1.5" rx="0.4" fill="currentColor" opacity="0.55"/>\
<rect x="6" y="17" width="18" height="1.5" rx="0.4" fill="currentColor" opacity="0.55"/>',
    active: 'bg-violet-600 text-white ring-violet-900 shadow-violet-200',
    hover:  'hover:bg-violet-50 hover:text-violet-700',
    tinted: 'text-violet-500' },
  { key: 'notes',    label: 'Notes',
    // Lined sheet — 5 horizontal lines, like ruled notebook paper
    svg: '<rect x="4" y="2" width="22" height="20" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>\
<line x1="7" y1="6"  x2="23" y2="6"  stroke="currentColor" stroke-width="1.4" opacity="0.7"/>\
<line x1="7" y1="9.5"  x2="22" y2="9.5"  stroke="currentColor" stroke-width="1.4" opacity="0.7"/>\
<line x1="7" y1="13" x2="23" y2="13" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>\
<line x1="7" y1="16.5" x2="20" y2="16.5" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>\
<line x1="7" y1="20" x2="18" y2="20" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>',
    active: 'bg-blue-600 text-white ring-blue-900 shadow-blue-200',
    hover:  'hover:bg-blue-50 hover:text-blue-700',
    tinted: 'text-blue-500' },
  { key: 'examples', label: 'Examples',
    // Numbered list — 1. 2. 3. with stub lines (mimics worked-example list)
    svg: '<text x="3"  y="9"  font-size="6" font-weight="900" font-family="ui-sans-serif" fill="currentColor">1.</text>\
<line x1="11" y1="7.5" x2="27" y2="7.5" stroke="currentColor" stroke-width="1.6"/>\
<text x="3"  y="15" font-size="6" font-weight="900" font-family="ui-sans-serif" fill="currentColor">2.</text>\
<line x1="11" y1="13.5" x2="25" y2="13.5" stroke="currentColor" stroke-width="1.6"/>\
<text x="3"  y="21" font-size="6" font-weight="900" font-family="ui-sans-serif" fill="currentColor">3.</text>\
<line x1="11" y1="19.5" x2="22" y2="19.5" stroke="currentColor" stroke-width="1.6"/>',
    active: 'bg-amber-500 text-white ring-amber-700 shadow-amber-200',
    hover:  'hover:bg-amber-50 hover:text-amber-700',
    tinted: 'text-amber-600' },
  { key: 'diagram',  label: 'Diagram',
    // Mini ontology: parent node at top, two children connected by lines
    svg: '<rect x="11" y="2" width="10" height="6" rx="1" fill="currentColor"/>\
<line x1="14" y1="9"  x2="9"  y2="14" stroke="currentColor" stroke-width="1.4"/>\
<line x1="18" y1="9"  x2="23" y2="14" stroke="currentColor" stroke-width="1.4"/>\
<rect x="3"  y="14" width="11" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>\
<rect x="18" y="14" width="11" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    active: 'bg-emerald-600 text-white ring-emerald-900 shadow-emerald-200',
    hover:  'hover:bg-emerald-50 hover:text-emerald-700',
    tinted: 'text-emerald-600' },
  { key: 'mistakes', label: 'Mistakes',
    // Checklist with three rows, each prefixed with a red × — anti-pattern list
    svg: '<text x="3"  y="9"  font-size="7" font-weight="900" font-family="ui-sans-serif" fill="currentColor">✕</text>\
<line x1="11" y1="7.5" x2="27" y2="7.5" stroke="currentColor" stroke-width="1.6" opacity="0.7"/>\
<text x="3"  y="15" font-size="7" font-weight="900" font-family="ui-sans-serif" fill="currentColor">✕</text>\
<line x1="11" y1="13.5" x2="25" y2="13.5" stroke="currentColor" stroke-width="1.6" opacity="0.7"/>\
<text x="3"  y="21" font-size="7" font-weight="900" font-family="ui-sans-serif" fill="currentColor">✕</text>\
<line x1="11" y1="19.5" x2="22" y2="19.5" stroke="currentColor" stroke-width="1.6" opacity="0.7"/>',
    active: 'bg-red-600 text-white ring-red-900 shadow-red-200',
    hover:  'hover:bg-red-50 hover:text-red-700',
    tinted: 'text-red-500' },
  { key: 'joke',     label: 'Joke',
    // Speech bubble with three tiny dots inside (jokes are quoted speech)
    svg: '<path d="M3 5 Q3 3 5 3 H27 Q29 3 29 5 V14 Q29 16 27 16 H12 L8 21 V16 H5 Q3 16 3 14 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>\
<circle cx="11" cy="10" r="1.5" fill="currentColor"/>\
<circle cx="16" cy="10" r="1.5" fill="currentColor"/>\
<circle cx="21" cy="10" r="1.5" fill="currentColor"/>',
    active: 'bg-pink-500 text-white ring-pink-700 shadow-pink-200',
    hover:  'hover:bg-pink-50 hover:text-pink-700',
    tinted: 'text-pink-500' },
  { key: 'related',  label: 'Related',
    // Dot-and-link network — 5 nodes with connecting lines (cross-reference graph)
    svg: '<circle cx="6"  cy="6"  r="2" fill="currentColor"/>\
<circle cx="16" cy="3"  r="2" fill="currentColor"/>\
<circle cx="26" cy="6"  r="2" fill="currentColor"/>\
<circle cx="8"  cy="18" r="2" fill="currentColor"/>\
<circle cx="24" cy="20" r="2" fill="currentColor"/>\
<circle cx="16" cy="13" r="2.5" fill="currentColor"/>\
<line x1="6"  y1="6"  x2="16" y2="13" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>\
<line x1="16" y1="3"  x2="16" y2="13" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>\
<line x1="26" y1="6"  x2="16" y2="13" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>\
<line x1="8"  y1="18" x2="16" y2="13" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>\
<line x1="24" y1="20" x2="16" y2="13" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>',
    active: 'bg-indigo-600 text-white ring-indigo-900 shadow-indigo-200',
    hover:  'hover:bg-indigo-50 hover:text-indigo-700',
    tinted: 'text-indigo-500' },
]

// ── Related-concept diagram fallback ─────────────────────────────────────
// When the primary entry has no diagrams, we probe related concepts in order
// and use the first one that has a diagram.

const relatedDiagrams       = ref<string[]>([])
const relatedDiagramLabel   = ref('')   // human-readable name of the source concept
const relatedDiagramLoading = ref(false)

/** Diagrams to actually render — primary entry first, related entry as fallback. */
const activeDiagrams = computed<string[]>(() =>
  (gEntry.value?.diagrams.length ?? 0) > 0
    ? gEntry.value!.diagrams
    : relatedDiagrams.value,
)

// When any result arrives, reset diagram + tab state and background-probe the
// glossary. The pin appears only when the vault actually has an entry for this
// term — so classification (planguage-term vs CE concept etc.) no longer matters.
//
// Bug fix (2026-05-12): `detailOpen` is now STICKY across re-defines. If the
// More Concept Detail panel was already open and the user selects another term
// inside it (drill-down within the glossary itself), keep it expanded so the
// new entry replaces the old one in-place — instead of forcing the user to
// re-click the "More Concept Detail" pin every single time.
// Auto-expand the glossary detail panel the moment an entry is loaded.
// This is a synchronous reactive watcher — no async .then() chain needed.
// Fires whenever gEntry changes (null → entry = expand; entry → null = collapse).
// User can still manually collapse by clicking the "More Concept Detail" pin;
// the panel won't re-expand until a NEW entry loads (gEntry changes reference).
watch(gEntry, (newEntry) => {
  console.debug('[illuminate] watch(gEntry) fired — newEntry:', newEntry?.term ?? 'null', '→ detailOpen =', !!newEntry)
  if (newEntry) detailOpen.value = true
})

watch(result, (r) => {
  console.debug('[illuminate] watch(result) fired — r.term:', r?.term ?? 'null')
  activeDetailTab.value    = 'card'
  diagramRendered.value    = false
  diagramError.value       = ''
  diagramRendering.value   = false
  relatedDiagrams.value    = []
  relatedDiagramLabel.value = ''
  clearEntry()
  // Silent background probe — 404s are swallowed; pin shows only on a vault match.
  // detailOpen is now driven reactively by watch(gEntry) above, not by this async chain.
  if (r?.term) {
    fetchEntry(r.term).then(async () => {
      console.debug('[illuminate] fetchEntry().then() — gEntry.value:', gEntry.value?.term ?? 'null', 'nearMatches:', gNearMatchOptions.value)
      // Auto-load best near-match: if no exact entry but near-matches exist, silently
      // fetch the first so the full glossary tabs appear without a user click.
      if (!gEntry.value && gNearMatchOptions.value.length > 0) {
        await fetchEntry(gNearMatchOptions.value[0])
      }
      if (gEntry.value) {
        // Record in Recent only after a confirmed successful illumination.
        // _recordRecentTerm is intentionally here (not before clearEntry) so that
        // a crash in it cannot abort the fetchEntry call — and so only vault-matched
        // terms end up in the Recent list.
        _recordRecentTerm(gEntry.value.term)
        // Belt-and-suspenders: set detailOpen here in case watch(gEntry) fires
        // before Vue flushes reactivity after an awaited fetch in an async context.
        detailOpen.value = true
      }
    })
  } else {
    detailOpen.value = false
  }
})

// When the result panel opens: immediately hide the floating pill so it can't
// be double-clicked while a lookup is in flight (the "eternal spinner" bug).
// When the panel closes: reset detail state.
watch(open, (o) => {
  if (o) {
    // Panel just opened — pill must vanish so user can't re-trigger define
    pillVisible.value = false
  } else {
    detailOpen.value = false
    clearEntry()
  }
})

// ── Helpers: related-concept diagram fetch ─────────────────────────────────

/** Extract file stems from all [[wikilinks]] in a markdown string. */
function parseWikilinkTerms(md: string): string[] {
  const re = /\[\[([^\]|]+?)(?:\|[^\]]*?)?\]\]/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    const stem = m[1].trim()
    if (stem) seen.add(stem)
  }
  return [...seen]
}

/**
 * Walk related concepts in order; fetch the first one that has diagrams.
 * Sets relatedDiagrams and relatedDiagramLabel on success.
 */
async function fetchRelatedDiagram(): Promise<void> {
  if (!gEntry.value || relatedDiagramLoading.value) return
  const terms = parseWikilinkTerms(gEntry.value.relatedConcepts)
  if (terms.length === 0) return

  relatedDiagramLoading.value = true
  try {
    for (const term of terms) {
      try {
        const res = await fetch(`/api/glossary?term=${encodeURIComponent(term)}`)
        if (!res.ok) continue
        const md      = await res.text()
        const related = parseGlossaryEntry(md, term)
        if (related.diagrams.length > 0) {
          relatedDiagrams.value      = related.diagrams
          relatedDiagramLabel.value  = related.term
          return
        }
      } catch {
        // try next related concept
      }
    }
  } finally {
    relatedDiagramLoading.value = false
  }
}

// ── Auto-render watches ───────────────────────────────────────────────────

/**
 * Core trigger: called whenever the diagram tab becomes active.
 * 1. If primary entry has diagrams → auto-render immediately.
 * 2. Otherwise → fetch first related concept with a diagram, then render.
 */
async function _triggerDiagramTab(): Promise<void> {
  if (!gEntry.value || !detailOpen.value) return

  if (activeDiagrams.value.length > 0) {
    if (!diagramRendered.value && !diagramRendering.value) renderDiagram(0, activeDiagrams.value)
    return
  }
  // No diagrams yet — try related concepts
  if (!relatedDiagramLoading.value && relatedDiagrams.value.length === 0) {
    await fetchRelatedDiagram()
  }
  if (activeDiagrams.value.length > 0 && !diagramRendered.value && !diagramRendering.value) {
    renderDiagram(0, activeDiagrams.value)
  }
}

// Fire when user switches to the Diagram tab
watch(activeDetailTab, (tab) => {
  if (tab === 'diagram') _triggerDiagramTab()
})

// Fire when gEntry arrives late (e.g. entry loaded after user opened diagram tab)
watch(gEntry, () => {
  if (activeDetailTab.value === 'diagram' && detailOpen.value) _triggerDiagramTab()
})

function handleMoreDetailClick(): void {
  if (detailOpen.value) {
    detailOpen.value = false
    return
  }
  detailOpen.value = true
  // User-initiated fetch — shows vault errors if the endpoint is unreachable
  if (!gEntry.value && !gLoading.value && result.value) {
    fetchEntry(result.value.term, true)
  }
}

// ── Mermaid diagram rendering ─────────────────────────────────────────────
//
// mermaid@11 ships only as chunked ESM builds (.core.mjs / .esm.min.mjs).
// All builds use relative dynamic chunk imports at runtime:
//   await import("./chunks/mermaid.core/flowDiagram-*.mjs")
// Vite's dep pre-bundler (esbuild) inlines static imports but preserves
// dynamic imports, so the chunk paths break when the pre-bundled file is
// placed outside node_modules — causing "Importing a module script failed"
// in every browser.
//
// The fix: load mermaid.min.js (the IIFE/UMD build — zero dynamic imports,
// fully self-contained, sets globalThis.mermaid) as a plain <script> from
// /public. Files in public/ bypass Vite's module pipeline entirely.
// The script is injected lazily the first time the Diagram tab is opened,
// then cached in `_mermaidInstance` for all subsequent renders.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MermaidGlobal = { initialize(cfg: Record<string, unknown>): void; render(id: string, src: string): Promise<{ svg: string }> }
let _mermaidInstance: MermaidGlobal | null = null

function _loadMermaidScript(): Promise<MermaidGlobal> {
  // Already loaded in a previous render
  if (_mermaidInstance) return Promise.resolve(_mermaidInstance)
  // globalThis.mermaid set by a previous script-tag injection this session
  const existing = (globalThis as Record<string, unknown>).mermaid as MermaidGlobal | undefined
  if (existing) { _mermaidInstance = existing; return Promise.resolve(existing) }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // /public/mermaid.min.js — copied from node_modules at build time,
    // served as a static file with no Vite transforms.
    script.src = '/mermaid.min.js'
    script.onload = () => {
      const m = (globalThis as Record<string, unknown>).mermaid as MermaidGlobal | undefined
      if (m) { _mermaidInstance = m; resolve(m) }
      else reject(new Error('mermaid global not found after script load'))
    }
    script.onerror = () => reject(new Error('Failed to load /mermaid.min.js — check public/ folder'))
    document.head.appendChild(script)
  })
}

const diagramContainer = ref<HTMLElement | null>(null)
const diagramRendered  = ref(false)
const diagramError     = ref('')
const diagramRendering = ref(false)
let   _diagramIndex    = 0   // which diagram is being shown (0-based)

async function renderDiagram(index = 0, sourceDiagrams?: string[]): Promise<void> {
  const diagrams = sourceDiagrams ?? gEntry.value?.diagrams ?? []
  if (diagrams.length === 0) return
  const source = diagrams[index]
  if (!source) return

  diagramRendering.value = true
  diagramError.value     = ''
  _diagramIndex          = index

  // Switch to diagram tab so the container mounts
  activeDetailTab.value = 'diagram'
  await nextTick()

  if (!diagramContainer.value) {
    diagramError.value = 'Diagram container not ready — try again.'
    diagramRendering.value = false
    return
  }

  try {
    const mermaid = await _loadMermaidScript()
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    })
    const id = `sel-def-diagram-${Date.now()}`
    const { svg } = await mermaid.render(id, source)
    diagramContainer.value.innerHTML = svg
    // Bug fix (2026-05-12): mermaid 11 stamps the rendered <svg> with an
    // inline `style="max-width: …px; max-height: …px"` plus explicit width/
    // height attributes that match its OWN measured viewport — NOT the
    // SelectionDefiner card's width. When the card body is narrower than
    // mermaid's measurement, the bottom half of every diagram silently
    // clipped (the user only saw the top text, edges and arrow tails were
    // cut off). Strip those constraints and force a responsive sizing
    // contract: width 100% of the container, height auto-derived from the
    // viewBox aspect ratio, no max-height cap. The Tailwind selectors on
    // the container (`[&_svg]:max-w-full [&_svg]:h-auto`) cover the
    // breakpoint defaults; this block guarantees mermaid's inline styles
    // don't override them.
    const svgEl = diagramContainer.value.querySelector('svg')
    if (svgEl) {
      svgEl.removeAttribute('width')
      svgEl.removeAttribute('height')
      svgEl.style.cssText = 'display:block;width:100%;height:auto;max-width:100%;max-height:none;'
      // Expand viewBox to include all content: Mermaid calculates the viewBox
      // in whatever container it used for offscreen rendering, which is often
      // narrower than the card — right-edge and left-edge nodes get clipped.
      // getBBox() forces a synchronous layout reflow and returns the actual
      // bounding box of ALL rendered elements in SVG user-space, regardless
      // of the current viewBox. We then set a new viewBox that covers every
      // node with 16px padding. (Tom 2026-06-01: "text cut off at right")
      try {
        const bbox = (svgEl as SVGGraphicsElement).getBBox()
        if (bbox.width > 0 && bbox.height > 0) {
          const pad = 16
          svgEl.setAttribute(
            'viewBox',
            `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`,
          )
        }
      } catch {
        // getBBox() may throw if the SVG has no renderable elements — leave
        // Mermaid's original viewBox in place.
      }
    }
    diagramRendered.value = true
  } catch (err) {
    diagramError.value = err instanceof Error ? err.message : 'Diagram render failed.'
    diagramRendered.value = false
  } finally {
    diagramRendering.value = false
  }
}

// Simple markdown table → HTML renderer (handles | col | col | tables only)
function renderMarkdownTable(md: string): string {
  const lines = md.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 2) return `<pre class="text-xs text-slate-600 whitespace-pre-wrap">${md}</pre>`

  const rows = lines.map(l =>
    l.split('|').slice(1, -1).map(c => c.trim()),
  )
  // Filter separator rows (|---|---|)
  const dataRows = rows.filter(r => !r.every(c => /^[-:]+$/.test(c)))
  if (dataRows.length === 0) return ''

  const [head, ...body] = dataRows
  const ths = head.map(c => `<th class="px-3 py-1.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">${c}</th>`).join('')
  const trs = body.map(r =>
    `<tr class="border-b border-slate-100 last:border-0">${r.map((c, i) => `<td class="px-3 py-2 text-xs text-slate-700 ${i === 0 ? 'font-medium w-32 flex-shrink-0' : ''}">${c}</td>`).join('')}</tr>`,
  ).join('')

  return `<table class="w-full text-left border border-slate-200 rounded-lg overflow-hidden text-xs"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
}

// Render a markdown section (strip Mermaid blocks, basic formatting)
function renderMarkdownText(md: string): string {
  return md
    // Remove mermaid blocks entirely (shown in Diagram tab)
    .replace(/```mermaid[\s\S]*?```/g, '')
    // Code blocks → <pre>
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="bg-slate-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto my-2 leading-relaxed">${escapeHtml(code.trim())}</pre>`,
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-violet-700 text-[10px] px-1 rounded">$1</code>')
    // Wikilinks → plain text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, _path, alias) => alias ?? _path.split('/').pop() ?? _path)
    // Markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // ❌ / ✓ lines (list items)
    .replace(/^[-*] (❌|✓|⚠️) /gm, '<span class="mr-1">$1</span>')
    // List items
    .replace(/^[-*] (.+)$/gm, '<li class="mb-1">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)+/g, '<ul class="list-none space-y-1 my-2 pl-0">$&</ul>')
    // Headings stripped
    .replace(/^#{1,6} .+$/gm, '')
    // Paragraphs: blank lines → paragraph breaks
    .replace(/\n{2,}/g, '</p><p class="mb-3">')
    .replace(/^/, '<p class="mb-3">')
    .replace(/$/, '</p>')
    // Clean up empty paragraphs
    .replace(/<p class="mb-3"><\/p>/g, '')
    .trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
</script>

<template>
  <!-- ────────────────────────────────────────────────────────────────────────
       1. FLOATING PILL — appears above selected text
       Uses fixed positioning so it follows the viewport regardless of scroll.
       ──────────────────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-90"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <!-- Universal Define-by-Selection rule (DD-002 follow-up 2026-05-14):
           pill renders above most surfaces at z-[10100].
           z history: z-[380] → z-[700] (2026-05-14) → z-[950] (2026-05-17)
           → z-[10100] (2026-05-17).
           NOTE: the Version History drawer and PlanModelPanel drawer are now
           at z-[10200]/z-[10201] so they correctly cover the pill when open —
           the pill should not be reachable when a full-panel overlay is up. -->
      <button
        v-if="pillVisible"
        type="button"
        data-seldef-pill
        aria-label="Illuminate selected text"
        class="fixed z-[10102] flex items-center gap-1.5 px-3 py-1.5 rounded-full
               bg-violet-600 text-white text-xs font-semibold shadow-lg
               hover:bg-violet-700 active:scale-95
               focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
               transition-colors select-none"
        :style="{
          left: `${pillX}px`,
          top: `${pillY}px`,
          transform: 'translateX(-50%)',
        }"
        @mousedown.prevent="handlePillClick"
      >
        <span aria-hidden="true">💡</span>
        Illuminate
        <!-- Tom 2026-05-17: teach ⌥I at the exact moment of first discovery -->
        <kbd class="ml-0.5 text-[9px] font-mono bg-violet-500/60 rounded px-1 py-0.5 leading-none" aria-hidden="true">⌘I</kbd>
      </button>
    </Transition>
  </Teleport>

  <!-- ────────────────────────────────────────────────────────────────────────
       2. RESULT PANEL — slides up from the bottom
       ──────────────────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="open"
        class="fixed bottom-0 left-0 right-0 z-[10100] flex justify-center px-4 pb-4 pt-0"
        style="transform: translateZ(0);"
        role="dialog"
        aria-modal="true"
        aria-label="Term definition"
      ><!-- Universal Define-by-Selection rule: z-[10100] sits above most surfaces.
            History and PlanModels drawers are at z-[10200]/z-[10201] so they
            correctly cover this panel when open (drawers take priority). -->
        <!-- r93ll (Tom Gilb 2026-06-11 "the dark bar is a bug") — visible backdrop:
             previously this backdrop was `pointer-events-none z-[-1]` with no visible
             tint, leaving the underlying PentaPanel "Locked — edits disabled" footer
             bleeding through under the Illuminate popover. Now the backdrop has a soft
             white tint + backdrop-blur so the popover sits on a clean field. Still
             pointer-events-none so it doesn't block clicks on the Plan Crest bar
             (z-[300]) above the popover. Click-outside-to-close handled via
             _onOutsideMousedown above. -->
        <!-- r93rr (Tom Gilb 2026-06-11 "grey line and it prohibits selection of options"):
             previous r93ll backdrop was `bg-white/85` (85% opacity). The underlying PentaPanel
             "Locked — edits disabled" bar bled through the remaining 15% as a grey horizontal
             strip that made the bottom of the popover LOOK disabled and confused Tom into
             thinking options were unreachable. Switched to FULLY OPAQUE bg-white so nothing
             underneath shows through. Still `pointer-events-none` so the Define-by-Selection
             pill above (z-[10102]) still receives mouse events unimpeded. -->
        <div
          class="fixed inset-0 z-[-1] pointer-events-none bg-white"
          aria-hidden="true"
        />

        <!-- Card — max-h set so it scrolls on small screens.
             data-seldef-card: marker used by _updatePill() so that selections
             made INSIDE this card flip the Define pill BELOW the selection
             (otherwise the pill would land on the violet header bar above). -->
        <!-- r93zzz — widened panel + responsive max-width so the Twin Related-
             Concepts table has breathing room (Tom Gilb 2026-06-13: "why is the
             info so narrow, is widening it a good idea?"). max-w-lg (32 rem) →
             responsive ladder: mobile stays 32 rem; sm 42 rem; md 56 rem; lg 72 rem.
             The 72 rem desktop width matches the Aspects panel + lets the
             Related-Concepts table breathe. The Enlarge button (added below)
             opens a full-viewport modal for the user who wants more still. -->
        <div
          data-seldef-card
          class="w-full max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-[72rem] rounded-2xl overflow-hidden shadow-2xl
                 border border-violet-200 bg-white flex flex-col max-h-[90dvh]"
        >
          <!-- Header -->
          <div class="flex items-start justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base" aria-hidden="true">💡</span>
                <span class="text-sm font-bold text-white tracking-wide">Illuminating</span>
                <!-- Type badge (shown after result arrives) -->
                <span
                  v-if="result"
                  class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white"
                >
                  {{ typeLabel }}
                </span>
              </div>
              <!-- The term itself -->
              <p class="mt-1 text-base font-semibold text-white leading-tight break-words">
                "{{ term || result?.term }}"
              </p>
            </div>
            <!-- r93ll — Export buttons (Copy + Email) per Export-on-all-windows SUPREME rule.
                 Tom Gilb 2026-06-11: "All info, I said this rule before did I not, all windows,
                 need an export button. The export ideally should be everything the window can
                 offer, not just what is immediately visible." Captures EVERY tab's content (At a
                 Glance / Notes / Examples / Mistakes / Joke / Related) + the diagram source.
                 Disabled until the glossary entry has loaded. -->
            <!-- r93mm — Completeness Pledge surfaced in HoverHint (Tom Gilb 2026-06-11
                 "it seems prudent to add in the export hover: that we will export more data
                 than might be visible, all the options"). Universal pattern: every Export
                 HoverHint must tell the user it captures more than what's currently visible. -->
            <button
              type="button"
              class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold whitespace-nowrap transition-colors ring-1 ring-emerald-800 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!gEntry"
              title="📋 Copy — captures MORE than what's currently visible. Includes EVERY tab (At a Glance, Notes, Examples, Mistakes, Joke, Related), every collapsed/hidden section, AND the Diagram source — not just whatever tab you're currently looking at. Paste with ⌘V into Mail, Notes, Keynote, anywhere. The export ends with a Completeness Pledge naming anything that requires the live app to render."
              @click="exportIlluminate('copy')"
            >📋 Copy</button>
            <button
              type="button"
              class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold whitespace-nowrap transition-colors ring-1 ring-blue-800 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!gEntry"
              title="✉ Email — captures MORE than what's currently visible. Includes EVERY tab + every collapsed/hidden section + Diagram source. Not just whatever tab you're currently looking at. Auto-opens Mail to Tom@Gilb.com with colourful HTML on clipboard — paste with ⌘V in body. Completeness Pledge in the export footer names anything that needs the live app to render."
              @click="exportIlluminate('email')"
            >✉ Email</button>
            <CloseDot
              variant="on-dark"
              size="lg"
              title="Close the Illuminate panel — Esc also closes"
              aria-label="Close the Illuminate panel"
              @click="closeDefine"
            />
          </div>

          <!-- Body (scrollable) — plain overflow div; no scroll indicator overlay.
               ScrollContainer's gradient/pill both obscure the "More Concept Detail" pin
               and tab bar (and the diagram when rendered), so indicator is omitted here.
               The pin button + tab structure already communicate that more content exists.
               audit-ignore: scroll — documented opt-out, see comment above. -->
          <!-- r41 v22 (Tom Gilb 2026-06-14 "so much missing and not scrolled,
               closed, export") — added gilb-illuminate-scroll class so the
               unscoped CSS at file end can paint a visible 14 px violet
               scrollbar (mirrors GilbIllustrationPicker r41).  Forces
               overflow-y: scroll so the bar always reserves space. -->
          <div class="gilb-illuminate-scroll flex-1 min-h-0 px-4 py-4">
            <!-- Loading state — Rule 8: spinner + elapsed secs + % progress + amuse cards.
                 Cancel always visible so user is never trapped.
                 Timer driven by watch(loading) → _startIlluminateAnimation / _stop. -->
            <div v-if="loading" class="space-y-3" role="status" aria-live="polite">

              <!-- Row 1: spinner + elapsed counter -->
              <div class="flex items-center gap-2.5">
                <div class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" aria-hidden="true" />
                <span class="text-sm font-medium text-slate-600">Illuminating "{{ term }}"</span>
                <span class="ml-auto text-xs tabular-nums text-slate-400">{{ illuminateElapsed }}s elapsed</span>
              </div>

              <!-- Row 2: simulated progress bar + % -->
              <div class="space-y-1">
                <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-violet-500 rounded-full transition-all duration-500"
                    :style="{ width: illuminateProgress + '%' }"
                  />
                </div>
                <div class="flex justify-between text-[10px] text-slate-400">
                  <span>Searching Planguage glossary…</span>
                  <span class="tabular-nums">{{ illuminateProgress }}%</span>
                </div>
              </div>

              <!-- Cancel -->
              <button
                type="button"
                class="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2
                       transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
                title="Cancel the Illuminate lookup and return to idle state"
                aria-label="Cancel Illuminate lookup"
                @click="cancelDefine()"
              >✕ Cancel</button>
            </div>

            <!-- Error state — Retry button so user can try again without re-selecting. -->
            <div v-else-if="error" class="space-y-2">
              <p class="text-sm text-red-600" role="alert">{{ error }}</p>
              <button
                type="button"
                class="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2
                       transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
                aria-label="Retry Illuminate lookup"
                @click="defineTerm(term, props.spec)"
              >↻ Try again</button>
            </div>

            <!-- Result -->
            <template v-else-if="result">
              <!-- r93qqq r17 — Top tier-1 paragraph + source + type badge HIDDEN once the
                   Twin response below has loaded (Tom Gilb 2026-06-13: "it looks lke the
                   entire top parGRAPH IS SUPERFLUOUS, IT IS REPEATED BELOW AND MORE NICELY
                   PRESENTED"). The Twin block renders the same content in structured form
                   with WHAT'S MISSING / NEXT STEP sections; the plain wall is redundant. -->

              <!-- Definition — only when no Twin result yet (or Twin failed) -->
              <p v-if="!twinResult" class="text-sm text-slate-800 leading-relaxed">{{ result.definition }}</p>

              <!-- Source attribution — only when no Twin result yet -->
              <div v-if="!twinResult" class="mt-3 flex items-start gap-2 pt-3 border-t border-slate-100">
                <span class="text-base flex-shrink-0" aria-hidden="true">📚</span>
                <div>
                  <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Source</p>
                  <p class="text-xs text-slate-600 leading-relaxed">{{ result.source }}</p>
                </div>
              </div>

              <!-- Type badge — always visible (small, useful context whether Twin loaded or not) -->
              <div class="mt-3">
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                  :class="typeColour"
                >
                  {{ typeLabel }}
                </span>
              </div>

              <!-- ── r93ttt — TIER 2: Tom's Twin Consultant (Tom Gilb 2026-06-12) ──────
                   Implicit + conscious paths per Tom verbatim: "cmnd I … can be
                   consciously or implicitly used to access toms twin books". Adds
                   the Twin canonical Glossary entry on top of the local tier-1
                   answer above. Composes with r93ooo Twin Integration + r93ppp
                   Twin-as-Destination (every Ask is a funding-loop brick). -->
              <div class="mt-4 border-t border-slate-100 pt-3">
                <div v-if="!twinResult && !twinLoading && !twinError" class="space-y-2">
                  <p class="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span aria-hidden="true">🔮</span>
                    <span>For the canonical Glossary entry + concept number + sources, ask Tom's Twin:</span>
                  </p>
                  <button
                    type="button"
                    class="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-[12px] font-bold transition-all shadow-sm hover:shadow-md ring-1 ring-violet-700/50 flex items-center justify-center gap-2"
                    :title="`Ask Tom's Twin Consultant (by Kai Gilb) for the canonical Glossary entry of '${result.term}' — ontology-backed search across Tom Gilb's full corpus. Free for the query; concept URLs link into the paid Twin Consultant for deeper consultation. r93ppp funding-loop discipline.`"
                    @click="askTwin(result.term)"
                  >
                    <span aria-hidden="true">🔮</span>
                    <span>Ask Tom's Twin →</span>
                  </button>
                </div>

                <!-- Loading state: spinner + elapsed -->
                <div v-else-if="twinLoading" class="space-y-2">
                  <div class="flex items-center gap-2 text-[12px] text-violet-700 font-semibold">
                    <span
                      class="inline-block w-4 h-4 rounded-full border-2 border-violet-600 border-t-transparent animate-spin"
                      aria-hidden="true"
                    ></span>
                    <span>Asking Tom's Twin (ontology-backed search across the corpus)…</span>
                    <span v-if="twinElapsed > 0" class="font-mono text-[11px] text-violet-500">{{ twinElapsed }}s</span>
                  </div>
                </div>

                <!-- Error state -->
                <div v-else-if="twinError" class="space-y-2">
                  <p class="text-[11px] text-red-700 flex items-start gap-1.5" role="alert">
                    <span aria-hidden="true">⚠</span>
                    <span>Twin lookup failed: {{ twinError }}. <a :href="TWIN_LOGIN_URL" target="_blank" rel="noopener" class="text-violet-700 underline font-bold">Open Twin Consultant ↗</a></span>
                  </p>
                  <button
                    type="button"
                    class="text-[11px] text-violet-600 hover:text-violet-800 underline"
                    @click="askTwin(result.term)"
                  >↻ Retry Twin</button>
                </div>

                <!-- Twin result — r93vvv/www/xxx/yyy + r93zzz drill-down + enlarge.
                     Renders the Twin's markdown response with table hoisted as the
                     featured centerpiece + colour-coded rows + ✦ glyphs (r93yyy).
                     Row clicks emit drilldown → loads that concept inside the same
                     panel (with back-arrow navigation history). The ⛶ button at
                     the top-right opens the same content in a full-viewport modal. -->
                <div v-else-if="twinResult" class="space-y-3 rounded-lg bg-violet-50/60 ring-1 ring-violet-200 px-3.5 py-3">
                  <!-- Header strip — Back arrow (when history) + From Twin + Enlarge -->
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1.5">
                      <!-- Back arrow — only visible when there's drill-down history -->
                      <button
                        v-if="twinHistory.length > 0"
                        type="button"
                        class="text-violet-700 hover:text-violet-900 hover:bg-violet-100 rounded px-1.5 py-0.5 text-[12px] font-bold shrink-0 transition-colors"
                        :title="`Back to ${twinHistory[twinHistory.length - 1]} — return to the previously-viewed concept (you can drill into related concepts as deeply as you like).`"
                        @click="onTwinBack"
                      >← Back</button>
                      <span class="text-[11px] font-bold uppercase tracking-wider text-violet-800 flex items-center gap-1.5 flex-1">
                        <span aria-hidden="true">🔮</span>
                        <span>From Tom's Twin Consultant</span>
                      </span>
                      <span class="text-[10px] text-violet-500 italic font-normal hidden sm:inline">by Kai Gilb</span>
                      <!-- Enlarge button — open the rendered content full-viewport -->
                      <button
                        type="button"
                        class="text-violet-700 hover:text-violet-900 hover:bg-violet-100 rounded p-1 text-[14px] shrink-0 transition-colors"
                        title="⛶ Enlarge — open the full Twin Glossary entry + the Related-Concepts diagram in a full-viewport modal. Press Escape (or click outside) to return."
                        aria-label="Open Twin response in full-viewport modal"
                        @click="twinEnlarged = true"
                      >⛶</button>
                    </div>
                    <!-- Clickable concept-number chips — each opens the Twin concept page -->
                    <div v-if="twinResult.conceptNumbers.length > 0" class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-[10px] uppercase tracking-wider text-violet-500 font-semibold">Concepts:</span>
                      <a
                        v-for="n in twinResult.conceptNumbers"
                        :key="n"
                        :href="twinResult.term && n === twinResult.conceptNumbers[0]
                          ? twinConceptUrl(twinResult.term, n)
                          : `https://www.gilb.com/tomtwin/login?concept=${n}`"
                        target="_blank"
                        rel="noopener"
                        class="font-mono font-bold text-[11px] px-2 py-0.5 rounded-full bg-white ring-1 ring-violet-300 text-violet-700 hover:bg-violet-100 hover:ring-violet-500 transition-colors"
                        :title="`Open Planguage Glossary concept *${n} in Tom Gilb's Twin Consultant (by Kai Gilb) — passwordless, free at-a-click. Funds continued Claudian development.`"
                      >*{{ n }} ↗</a>
                    </div>
                  </div>

                  <!-- Twin response — rendered Markdown via the universal
                       <RenderedMarkdown> component (r93www) + r93zzz drilldown
                       wiring: clicking any Related-Concepts row triggers an
                       Illuminate re-query inside the same panel, with the
                       current concept pushed onto the back-stack so the user
                       can navigate freely through the concept graph. -->
                  <RenderedMarkdown
                    :source="twinResult.text"
                    no-trap-warning
                    @drilldown="onConceptDrilldown"
                    @illuminate-concept="onConceptIlluminate"
                  />
                  <!--
                    Pre-r93www smoke test of the renderer in case Tom still sees raw markdown
                    after this turn: open browser devtools console and run
                      document.querySelector('.rendered-markdown')?.innerHTML?.slice(0,200)
                    to confirm the v-html populated. If it shows raw `##` text instead of
                    rendered tags, the issue is HMR cache — ⌘R Safari to reload.
                  -->

                  <!-- r93xxx — single compact footer (Tom Gilb 2026-06-13: "we do not
                       need concept data duplication, repetition, if one use the twin").
                       Pre-r93xxx had THREE redundant Twin-reference surfaces stacked:
                       (a) clickable concept-number chips in the header, (b) a legend
                       paragraph explaining `*NNN`, (c) a Tier-3 action row with "Open
                       *NNN in Twin" + "Open Twin Consultant" buttons. All three pointed
                       to the same places. r93xxx collapses them into ONE compact line:
                       the legend stays (it's the only one that EXPLAINS what `*NNN`
                       means), with the Twin Consultant landing link inline. The
                       chips at the top + inline `*NNN` links in the rendered body
                       already cover the action surfaces — no need to repeat them. -->
                  <p class="text-[10.5px] text-violet-700 italic pt-2 border-t border-violet-200 leading-snug flex items-start gap-1.5">
                    <span aria-hidden="true" class="shrink-0 pt-px">ℹ</span>
                    <span>
                      Concept numbers <b>*NNN</b> are clickable — open in the
                      <a :href="TWIN_LOGIN_URL" target="_blank" rel="noopener" class="text-violet-800 hover:text-violet-900 underline font-bold">Tom Gilb Consultant Twin</a>
                      (passwordless, free, at-a-click; by Kai Gilb — funds Claudian dev).
                      URLs in the text are also clickable.
                    </span>
                  </p>
                </div>
              </div>

              <!-- ── Near-match suggestions — vault has no direct entry but prefix-similar concepts exist ── -->
              <div
                v-if="!gEntry && gNearMatchOptions.length > 0"
                class="mt-4 border-t border-slate-100 pt-3"
              >
                <p class="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
                  <span aria-hidden="true">🔍</span>
                  Not in vault glossary. Related concepts:
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="option in gNearMatchOptions"
                    :key="option"
                    type="button"
                    :aria-label="`Define ${option}`"
                    class="px-2.5 py-1 rounded-full text-xs font-semibold
                           bg-violet-50 text-violet-700 border border-violet-200
                           hover:bg-violet-100 active:scale-95 transition-colors
                           focus:outline-none focus:ring-2 focus:ring-violet-400"
                    @click="defineTerm(option, props.spec)"
                  >
                    {{ option }}
                  </button>
                </div>
              </div>

              <!-- ── Vault unreachable hint — shown when probe failed with 503 or network error.
                   Distinct from 404 (term absent): probeError means the dev server was
                   not running, so glossary data MAY exist but could not be fetched.
                   Clicking "retry" re-runs fetchEntry with userInitiated=true so the
                   user sees a proper error message if the server is still down. -->
              <div
                v-if="!gEntry && !gLoading && gProbeError"
                class="mt-3 border-t border-slate-100 pt-3 flex items-start gap-2"
              >
                <span class="text-base flex-shrink-0" aria-hidden="true">📚</span>
                <p class="text-[11px] text-slate-400 leading-relaxed">
                  Vault glossary unavailable — the full Planguage concept detail
                  ({{ result?.term }}) may exist but the dev server is not reachable.
                  <button
                    type="button"
                    class="ml-1 underline underline-offset-2 text-violet-500 hover:text-violet-700
                           focus:outline-none focus:ring-1 focus:ring-violet-400 rounded transition-colors"
                    title="Retry glossary lookup — will show an error message if dev server is still down"
                    @click="result && fetchEntry(result.term, true)"
                  >Retry</button>
                </p>
              </div>

              <!-- ── More Concept Detail pin — shown when vault has a glossary entry ── -->
              <div v-if="gEntry" class="mt-4 border-t border-violet-100 pt-3">
                <button
                  type="button"
                  :aria-expanded="detailOpen"
                  :aria-label="detailOpen ? 'Hide concept detail' : 'Show more concept detail from vault glossary'"
                  class="w-full flex items-center justify-between px-3 py-2 rounded-xl
                         bg-violet-50 hover:bg-violet-100 border border-violet-200
                         text-xs font-semibold text-violet-700 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-violet-400"
                  @click="handleMoreDetailClick"
                >
                  <span class="flex items-center gap-2">
                    <span aria-hidden="true">🔍</span>
                    More Concept Detail
                    <span
                      v-if="gEntry"
                      class="text-[9px] font-normal text-violet-500"
                    >
                      {{ gEntry.conceptNumber }} · {{ gEntry.keyedIcon }}
                    </span>
                  </span>
                  <!-- Chevron -->
                  <span
                    class="text-violet-400 transition-transform duration-200"
                    :class="detailOpen ? 'rotate-180' : ''"
                    aria-hidden="true"
                  >▾</span>
                </button>

                <!-- ── Detail panel (expanded) ── -->
                <Transition
                  enter-active-class="transition-all duration-200 ease-out overflow-hidden"
                  enter-from-class="opacity-0 max-h-0"
                  enter-to-class="opacity-100 max-h-[2000px]"
                  leave-active-class="transition-all duration-150 ease-in overflow-hidden"
                  leave-from-class="opacity-100 max-h-[2000px]"
                  leave-to-class="opacity-0 max-h-0"
                >
                  <div v-if="detailOpen" class="mt-2">

                    <!-- Loading glossary entry -->
                    <div v-if="gLoading" class="flex items-center gap-2 py-3 text-xs text-slate-400" role="status">
                      <div class="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" aria-hidden="true" />
                      Loading from vault glossary…
                    </div>

                    <!-- Glossary not found -->
                    <p v-else-if="gError" class="text-xs text-amber-600 py-2">
                      {{ gError }}
                    </p>

                    <!-- Glossary entry loaded -->
                    <template v-else-if="gEntry">
                      <!-- Summary callout -->
                      <div
                        v-if="gEntry.atAGlanceSummary"
                        class="mb-3 bg-violet-50 border-l-4 border-violet-400 rounded-r-lg px-3 py-2"
                      >
                        <p class="text-[11px] text-violet-800 leading-relaxed">{{ gEntry.atAGlanceSummary }}</p>
                      </div>

                      <!-- Synonym resolution badge -->
                      <div
                        v-if="gSynonymOf"
                        class="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-lg
                               bg-slate-50 border border-slate-200 text-[10px] text-slate-400"
                      >
                        <span aria-hidden="true">↩</span>
                        Matched as:
                        <span class="font-semibold text-violet-600">{{ gSynonymOf }}</span>
                      </div>

                      <!-- r41 v26 (Tom Gilb 2026-06-14 "THIS NEEDS MORE
                           DRAMATIC LARGE COLOR BETTER ICONS PRESENTATION") —
                           tab bar now per-tab colour + bigger emoji + bolder
                           label + dramatic active state (shadow + ring +
                           filled background + white text + 5% scale).
                           Inactive tabs show the SAME big emoji but in a
                           subtle theme tint so the user senses the colour
                           system without active loudness. -->
                      <div class="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b-2 border-slate-200">
                        <button
                          v-for="tab in detailTabs"
                          :key="tab.key"
                          type="button"
                          :aria-selected="activeDetailTab === tab.key"
                          :class="[
                            'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg text-[11px] font-extrabold flex-shrink-0 transition-all min-w-[68px]',
                            activeDetailTab === tab.key
                              ? `${tab.active} ring-2 shadow-md scale-105 -translate-y-0.5`
                              : `bg-white border border-slate-200 ${tab.tinted} ${tab.hover} hover:border-current hover:shadow-sm`,
                          ]"
                          :title="`Switch to ${tab.label} — ${tab.key === 'card' ? 'concise summary' : tab.key === 'notes' ? 'expanded notes from the Glossary entry' : tab.key === 'examples' ? 'worked examples and use cases' : tab.key === 'diagram' ? 'rendered ontology diagram for this concept' : tab.key === 'mistakes' ? 'common errors and anti-patterns' : tab.key === 'joke' ? 'a mnemonic joke or quip' : 'related concepts and cross-references'}`"
                          @click="activeDetailTab = tab.key"
                        >
                          <!-- r41 v27 — mini-clip SVG of the tab's content
                               (Thumbnail Reality rule, Tom Gilb 2026-06-14). -->
                          <svg
                            class="w-7 h-5 flex-shrink-0"
                            viewBox="0 0 32 24"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                            v-html="tab.svg"
                          ></svg>
                          <span class="uppercase tracking-wide leading-tight whitespace-nowrap">{{ tab.label }}</span>
                        </button>
                      </div>

                      <!-- Tab: At a Glance -->
                      <div v-if="activeDetailTab === 'card'" class="overflow-x-auto">
                        <div
                          v-if="gEntry.atAGlanceCard"
                          v-html="renderMarkdownTable(gEntry.atAGlanceCard)"
                        />
                        <p v-else class="text-xs text-slate-400 italic">No at-a-glance card in this entry.</p>
                      </div>

                      <!-- Tab: Notes -->
                      <div
                        v-else-if="activeDetailTab === 'notes'"
                        class="text-xs text-slate-700 leading-relaxed space-y-2 [&_strong]:font-semibold [&_code]:text-violet-700 [&_code]:bg-violet-50 [&_code]:px-1 [&_code]:rounded [&_pre]:overflow-x-auto"
                      >
                        <div v-if="gEntry.notes" v-html="renderMarkdownText(gEntry.notes)" />
                        <p v-else class="text-slate-400 italic">No notes section in this entry.</p>
                      </div>

                      <!-- Tab: Examples -->
                      <div v-else-if="activeDetailTab === 'examples'">
                        <div
                          v-if="gEntry.examples"
                          class="text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-[10px]"
                          v-html="renderMarkdownText(gEntry.examples)"
                        />
                        <p v-else class="text-xs text-slate-400 italic">No examples in this entry.</p>
                      </div>

                      <!-- Tab: Diagram -->
                      <div v-else-if="activeDetailTab === 'diagram'">

                        <!-- Nothing available anywhere -->
                        <div
                          v-if="activeDiagrams.length === 0 && !relatedDiagramLoading"
                          class="text-xs text-slate-400 italic"
                        >
                          No diagrams in this entry or its related concepts.
                        </div>

                        <!-- Searching related concepts -->
                        <div
                          v-if="relatedDiagramLoading"
                          class="flex items-center gap-2 py-3 text-xs text-slate-400"
                          role="status"
                        >
                          <div class="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" aria-hidden="true" />
                          Searching related concepts for a diagram…
                        </div>

                        <!-- Related concept attribution -->
                        <div
                          v-if="relatedDiagramLabel && (gEntry?.diagrams.length ?? 0) === 0 && relatedDiagrams.length > 0"
                          class="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-lg
                                 bg-amber-50 border border-amber-200 text-[10px] text-amber-700"
                        >
                          <span aria-hidden="true">🔗</span>
                          No direct diagram — using related:
                          <span class="font-semibold">{{ relatedDiagramLabel }}</span>
                        </div>

                        <template v-if="activeDiagrams.length > 0">
                          <!-- Multi-diagram selector -->
                          <div v-if="activeDiagrams.length > 1" class="flex gap-2 mb-2 flex-wrap">
                            <button
                              v-for="(_, idx) in activeDiagrams"
                              :key="idx"
                              type="button"
                              class="px-2 py-1 text-[10px] rounded bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                              @click="renderDiagram(idx, activeDiagrams)"
                            >
                              Diagram {{ idx + 1 }}
                            </button>
                          </div>

                          <!-- Auto-rendering spinner -->
                          <div v-if="diagramRendering" class="flex items-center gap-2 py-4 justify-center text-xs text-slate-400" role="status">
                            <div class="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" aria-hidden="true" />
                            Rendering diagram…
                          </div>

                          <!-- Render error + retry -->
                          <div v-if="diagramError" class="py-2 space-y-2">
                            <p class="text-xs text-red-500">{{ diagramError }}</p>
                            <button
                              type="button"
                              class="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold
                                     hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400
                                     transition-colors"
                              @click="renderDiagram(0, activeDiagrams)"
                            >
                              🔄 Retry
                            </button>
                          </div>

                          <!-- Rendered SVG container -->
                          <div
                            ref="diagramContainer"
                            class="overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
                            aria-label="Mermaid diagram"
                          />
                        </template>
                      </div>

                      <!-- Tab: Mistakes -->
                      <div
                        v-else-if="activeDetailTab === 'mistakes'"
                        class="text-xs text-slate-700 leading-relaxed [&_strong]:font-semibold [&_code]:text-violet-700 [&_code]:bg-violet-50 [&_code]:px-1 [&_code]:rounded"
                      >
                        <div v-if="gEntry.commonMistakes" v-html="renderMarkdownText(gEntry.commonMistakes)" />
                        <p v-else class="text-slate-400 italic">No common mistakes section in this entry.</p>
                      </div>

                      <!-- Tab: Joke -->
                      <div
                        v-else-if="activeDetailTab === 'joke'"
                        class="text-xs text-slate-700 leading-relaxed [&_strong]:font-semibold"
                      >
                        <div
                          v-if="gEntry.joke"
                          class="bg-amber-50 border-l-4 border-amber-300 rounded-r-lg px-3 py-2"
                        >
                          <p class="text-[11px] text-amber-800 leading-relaxed">{{ gEntry.joke }}</p>
                        </div>
                        <p v-else class="text-slate-400 italic">No joke in this entry.</p>
                      </div>

                      <!-- Tab: Related -->
                      <div
                        v-else-if="activeDetailTab === 'related'"
                        class="text-xs text-slate-700 leading-relaxed [&_strong]:font-semibold [&_code]:text-violet-700 [&_code]:bg-violet-50 [&_code]:px-1 [&_code]:rounded"
                      >
                        <div
                          v-if="gEntry.relatedConcepts"
                          v-html="renderMarkdownText(gEntry.relatedConcepts)"
                        />
                        <p v-else class="text-slate-400 italic">No related concepts in this entry.</p>
                      </div>
                    </template>
                  </div>
                </Transition>
              </div>
              <!-- End More Concept Detail -->

            </template>
          </div>

          <!-- ── ⌥I first-use tip — amber strip, flex-shrink-0 so it never scrolls away.
               Shown once after first successful illumination (any trigger method).
               Dismissed to localStorage; never shown again. Tom 2026-05-17:
               "whenever define is actually used a reminder that ⌥I will give
               illuminate without the term select." -->
          <div
            v-if="result && !tipDismissed"
            class="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 flex-shrink-0"
            role="note"
          >
            <span class="text-sm flex-shrink-0" aria-hidden="true">✨</span>
            <span class="flex-1 text-[11px] text-amber-800 leading-snug">
              Tip: press
              <kbd class="font-mono bg-amber-100 border border-amber-200 rounded px-1 text-[10px] text-amber-700">⌘I</kbd>
              anytime — no selection needed.
            </span>
            <!-- CloseDot rule: inline tip panel dismiss -->
            <CloseDot
              variant="on-light"
              aria-label="Dismiss tip"
              title="Dismiss this tip"
              @click="dismissTip"
            />
          </div>

          <!-- Footer hint — r41 v22 (Tom 2026-06-14): removed non-canonical
               violet "Close" text button.  The header CloseDot is the
               canonical close affordance.  Esc + click-outside also work. -->
          <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            <p class="text-[10px] text-slate-400">
              Select any text and click <strong>💡 Illuminate</strong>, or say <strong>"Illuminate"</strong>, or press <kbd class="font-mono border border-slate-200 rounded px-1 bg-white text-slate-400">⌘I</kbd>
            </p>
            <p class="text-[10px] text-slate-400 italic">
              Esc · click outside · or red close (top-right) — all dismiss
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ────────────────────────────────────────────────────────────────────────
       3. TERM SEARCH PANEL — opens via nav-bar Illuminate button or ⌥I with no selection.
          FAB removed 2026-05-18 (was cluttering bottom-right, redundant with nav bar button).
       ──────────────────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <!-- Term-search panel — shown when nav-bar Illuminate button or ⌥I clicked with no active selection -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-2"
    >
      <div
        v-if="defineSearchOpen"
        data-seldef-search
        class="fixed bottom-[8.5rem] right-4 z-[10101] w-72 rounded-2xl
               overflow-hidden shadow-2xl border border-violet-200 bg-white"
        role="dialog"
        aria-label="Define a term"
      >
        <!-- Backdrop — pointer-events-none so it does NOT block clicks below.
             Click-outside handled by _onOutsideMousedown (capture-phase). -->
        <div
          class="fixed inset-0 z-[-1] pointer-events-none"
          aria-hidden="true"
        />
        <!-- Header -->
        <div class="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center gap-2">
          <span class="text-sm" aria-hidden="true">💡</span>
          <span class="text-xs font-bold text-white tracking-wide flex-1">Illuminate any term</span>
          <kbd class="text-[10px] text-white/70 font-mono bg-white/15 rounded px-1.5 py-0.5">⌘I</kbd>
        </div>
        <!-- Input -->
        <div class="px-3 py-2.5">
          <input
            ref="termSearchInputRef"
            v-model="termSearchValue"
            type="text"
            placeholder="Type any Planguage term…"
            class="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm
                   text-slate-800 placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent
                   bg-violet-50"
            @keydown.enter.prevent="handleTermSearchSubmit"
            @keydown.escape.prevent="closeTermSearch"
          />
        </div>
        <!-- Recent terms quick-picks -->
        <div v-if="recentTerms.length > 0" class="px-3 pb-3 flex flex-wrap gap-1.5">
          <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-full">Recent</span>
          <button
            v-for="rt in recentTerms"
            :key="rt"
            type="button"
            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                   bg-violet-50 text-violet-700 border border-violet-200
                   hover:bg-violet-100 hover:text-violet-800 transition-colors"
            @click="termSearchValue = rt; handleTermSearchSubmit()"
          >
            {{ rt }}
          </button>
        </div>
        <!-- Footer hint -->
        <div class="px-4 pb-2.5 text-[10px] text-slate-400 flex items-center gap-1.5">
          <kbd class="font-mono bg-slate-100 rounded px-1">↵</kbd> define ·
          <kbd class="font-mono bg-slate-100 rounded px-1">Esc</kbd> close
        </div>
      </div>
    </Transition>

    <!-- FAB removed 2026-05-17: redundant — nav bar has "💡 Illuminate ⌥I" button,
         floating pill appears on text selection, ⌥I works globally.
         The persistent FAB was cluttering the bottom-right and clashing with
         the Actions / Mic / Read Aloud buttons. -->

    <!-- r93zzz — ENLARGE modal: full-viewport view of the Twin response with
         the same drill-down + back-navigation. Opens when ⛶ is clicked in the
         normal panel. Backdrop click + Escape close it. z-index sits above
         the normal panel (z-[10100]) so it lifts cleanly. -->
    <Teleport to="body">
      <div
        v-if="twinEnlarged && twinResult"
        class="fixed inset-0 z-[10200] flex items-stretch justify-center p-4 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Tom's Twin Consultant — enlarged view"
        @keyup.esc="twinEnlarged = false"
      >
        <!-- Backdrop (click to close) -->
        <div
          class="absolute inset-0 bg-violet-950/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="twinEnlarged = false"
        ></div>
        <!-- Enlarged card -->
        <div class="relative w-full max-w-[96rem] bg-white rounded-2xl shadow-2xl ring-1 ring-violet-300 flex flex-col max-h-full overflow-hidden">
          <!-- Header bar with title + close -->
          <div class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-violet-700 via-violet-600 to-indigo-700 text-white shrink-0">
            <button
              v-if="twinHistory.length > 0"
              type="button"
              class="text-white hover:bg-white/15 rounded px-2 py-0.5 text-[13px] font-bold shrink-0 transition-colors"
              :title="`Back to ${twinHistory[twinHistory.length - 1]}`"
              @click="onTwinBack"
            >← Back</button>
            <span class="text-[12px] font-extrabold uppercase tracking-[0.18em]">🔮 From Tom's Twin Consultant</span>
            <span class="text-[11px] opacity-85 italic ml-2">by Kai Gilb · funds Claudian dev</span>
            <span class="flex-1"></span>
            <span class="text-[11px] opacity-75 hidden md:inline">Click any row to drill into a related concept · Esc to close</span>
            <button
              type="button"
              class="text-white hover:bg-white/15 rounded p-1.5 text-[18px] shrink-0 transition-colors"
              title="Close enlarged view (Esc)"
              aria-label="Close enlarged Twin view"
              @click="twinEnlarged = false"
            >✕</button>
          </div>
          <!-- Concepts chip row -->
          <div v-if="twinResult.conceptNumbers.length > 0" class="flex items-center gap-1.5 flex-wrap px-5 py-2.5 bg-violet-50 border-b border-violet-200">
            <span class="text-[10px] uppercase tracking-wider text-violet-600 font-semibold">Concepts:</span>
            <a
              v-for="n in twinResult.conceptNumbers"
              :key="`enl-${n}`"
              :href="twinResult.term && n === twinResult.conceptNumbers[0]
                ? twinConceptUrl(twinResult.term, n)
                : `https://www.gilb.com/tomtwin/login?concept=${n}`"
              target="_blank"
              rel="noopener"
              class="font-mono font-bold text-[12px] px-2.5 py-1 rounded-full bg-white ring-1 ring-violet-300 text-violet-700 hover:bg-violet-100 hover:ring-violet-500 transition-colors"
            >*{{ n }} ↗</a>
          </div>
          <!-- Body — same rendered Markdown, but in the wider canvas -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <RenderedMarkdown
              :source="twinResult.text"
              no-trap-warning
              @drilldown="onConceptDrilldown"
              @illuminate-concept="onConceptIlluminate"
            />
          </div>
          <!-- Footer -->
          <div class="px-5 py-2.5 bg-violet-50 border-t border-violet-200 text-[11px] text-violet-700 italic flex items-center justify-between gap-3 shrink-0">
            <span>Concept numbers <b>*NNN</b> open the canonical Glossary entry in the Twin Consultant (passwordless, free at-a-click).</span>
            <a
              :href="TWIN_LOGIN_URL"
              target="_blank"
              rel="noopener"
              class="text-violet-800 hover:text-violet-900 underline font-bold shrink-0"
            >Open Twin Consultant ↗</a>
          </div>
        </div>
      </div>
    </Teleport>
  </Teleport>
</template>

<!-- r41 v22 (Tom Gilb 2026-06-14: "so much missing and not scrolled, closed,
     export") — UNSCOPED visible-scrollbar CSS following the canonical
     pattern shipped on the picker.  Class is unique enough to be safe
     globally.  overflow-y: scroll !important forces space-reservation so
     Safari macOS doesn't auto-hide the bar. -->
<style>
.gilb-illuminate-scroll {
  overflow-y: scroll !important;
  scrollbar-color: #a78bfa #ede9fe;
  scrollbar-width: auto;
}
.gilb-illuminate-scroll::-webkit-scrollbar { width: 14px; background: #ede9fe; }
.gilb-illuminate-scroll::-webkit-scrollbar-track { background: #ede9fe; border-radius: 7px; }
.gilb-illuminate-scroll::-webkit-scrollbar-thumb {
  background: #a78bfa;
  border-radius: 7px;
  border: 2px solid #ede9fe;
  min-height: 40px;
}
.gilb-illuminate-scroll::-webkit-scrollbar-thumb:hover { background: #8b5cf6; }
</style>
