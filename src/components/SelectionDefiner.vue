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
import { useGlossaryEntry } from '../composables/useGlossaryEntry'
import { parseGlossaryEntry } from '../utils/parseGlossaryEntry'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock | null
}>()

const { result, loading, error, open, term, defineSearchOpen } = useDefine()
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

  // Ignore selections inside input/textarea elements
  if (
    document.activeElement instanceof HTMLInputElement ||
    document.activeElement instanceof HTMLTextAreaElement
  ) {
    pillVisible.value = false
    return
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
  // Opt+I (Option+I) — illuminate selection (or open term search if nothing selected).
  // Uses e.code === 'KeyI' (physical key) not e.key because Option+I on Mac produces
  // a dead key (circumflex), so e.key === 'Dead', not 'i'. e.code is layout-independent.
  // NOTE: ⌥I is owned by Safari (Email Page Link) and cannot be overridden from JS.
  // Guard: skip only if result panel is already open (user can see it, no double-trigger).
  // NOTE: do NOT guard on loading.value — _loading is module-level state that Vite HMR
  // preserves across hot reloads, so a loading=true from an interrupted call permanently
  // blocks ⌥I for the rest of the session.  open.value covers the same case because
  // _open is set true at the same moment _loading is set true inside defineTerm().
  if (e.altKey && e.code === 'KeyI') {
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

const detailTabs: { key: DetailTab; emoji: string; label: string }[] = [
  { key: 'card',     emoji: '🃏', label: 'At a Glance' },
  { key: 'notes',    emoji: '📝', label: 'Notes'        },
  { key: 'examples', emoji: '💡', label: 'Examples'     },
  { key: 'diagram',  emoji: '🗂️', label: 'Diagram'      },
  { key: 'mistakes', emoji: '⚠️', label: 'Mistakes'     },
  { key: 'joke',     emoji: '😄', label: 'Joke'         },
  { key: 'related',  emoji: '🔗', label: 'Related'      },
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
        <kbd class="ml-0.5 text-[9px] font-mono bg-violet-500/60 rounded px-1 py-0.5 leading-none" aria-hidden="true">⌥I</kbd>
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
        role="dialog"
        aria-modal="true"
        aria-label="Term definition"
      ><!-- Universal Define-by-Selection rule: z-[10100] sits above most surfaces.
            History and PlanModels drawers are at z-[10200]/z-[10201] so they
            correctly cover this panel when open (drawers take priority). -->
        <!-- Backdrop — pointer-events-none so it does NOT block clicks on
             Plan Crest bar (z-[300]) or other surfaces below z-[10100].
             Click-outside-to-close is handled by _onOutsideMousedown above. -->
        <div
          class="fixed inset-0 z-[-1] pointer-events-none"
          aria-hidden="true"
        />

        <!-- Card — max-h set so it scrolls on small screens.
             data-seldef-card: marker used by _updatePill() so that selections
             made INSIDE this card flip the Define pill BELOW the selection
             (otherwise the pill would land on the violet header bar above). -->
        <div
          data-seldef-card
          class="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl
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
            <CloseDot
        variant="on-dark"
        title="Close"
        aria-label="Close definition"
        @click="closeDefine"
      />
          </div>

          <!-- Body (scrollable) — plain overflow div; no scroll indicator overlay.
               ScrollContainer's gradient/pill both obscure the "More Concept Detail" pin
               and tab bar (and the diagram when rendered), so indicator is omitted here.
               The pin button + tab structure already communicate that more content exists.
               audit-ignore: scroll — documented opt-out, see comment above. -->
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
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
              <!-- Definition -->
              <p class="text-sm text-slate-800 leading-relaxed">{{ result.definition }}</p>

              <!-- Source attribution -->
              <div class="mt-3 flex items-start gap-2 pt-3 border-t border-slate-100">
                <span class="text-base flex-shrink-0" aria-hidden="true">📚</span>
                <div>
                  <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Source</p>
                  <p class="text-xs text-slate-600 leading-relaxed">{{ result.source }}</p>
                </div>
              </div>

              <!-- Type badge (full width) -->
              <div class="mt-3">
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                  :class="typeColour"
                >
                  {{ typeLabel }}
                </span>
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

                      <!-- Tab bar -->
                      <div class="flex gap-1 overflow-x-auto pb-1 mb-2 border-b border-slate-100">
                        <button
                          v-for="tab in detailTabs"
                          :key="tab.key"
                          type="button"
                          :aria-selected="activeDetailTab === tab.key"
                          :class="[
                            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-colors',
                            activeDetailTab === tab.key
                              ? 'bg-violet-100 text-violet-700'
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50',
                          ]"
                          @click="activeDetailTab = tab.key"
                        >
                          <span aria-hidden="true">{{ tab.emoji }}</span>
                          {{ tab.label }}
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
              <kbd class="font-mono bg-amber-100 border border-amber-200 rounded px-1 text-[10px] text-amber-700">⌥I</kbd>
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

          <!-- Footer hint -->
          <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            <p class="text-[10px] text-slate-400">
              Select any text and click <strong>💡 Illuminate</strong>, or say <strong>"Illuminate"</strong>, or press <kbd class="font-mono border border-slate-200 rounded px-1 bg-white text-slate-400">⌥I</kbd>
            </p>
            <button
              type="button"
              class="text-[11px] text-violet-600 hover:text-violet-800 font-medium
                     focus:outline-none focus:ring-2 focus:ring-violet-400 rounded px-1"
              @click="closeDefine"
            >
              Close
            </button>
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
          <kbd class="text-[10px] text-white/70 font-mono bg-white/15 rounded px-1.5 py-0.5">⌥I</kbd>
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
  </Teleport>
</template>
