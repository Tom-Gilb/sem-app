// UNIT_TYPE=Hook
// useDefine — AI-powered term definition with source attribution.
// Works on any selected text in the app.
//
// Three entry points:
//   1. defineTerm(term, spec)        — direct call with a known term
//   2. defineCurrentSelection(spec)  — reads window.getSelection()
//   3. keyboard shortcut / voice "Define" both call defineCurrentSelection()
//
// Module-level shared state so SelectionDefiner.vue (the floating pill +
// result panel) and App.vue (keyboard / voice) share the same session.

// r93uuu — Anthropic SDK fallback REMOVED 2026-06-13 per Tom Gilb's greenlight
// "go item 1". Replaced by Tom Gilb's Twin Consultant /api/chat (by Kai Gilb)
// via `useTwinCitation`. This kills the long-standing Claude-Code-as-AI-Layer
// SUPREME rule violation: no more in-app Anthropic API call, no more reliance
// on `VITE_ANTHROPIC_API_KEY`, no more in-browser `dangerouslyAllowBrowser`.
// The Twin is publicly hosted by Kai (CORS-open, no-auth) — SEM App is a
// CONSUMER of a public service, not an embedded API client. Composes with
// r93ooo Twin Integration + r93ppp Twin-as-Destination funding-loop.
import { ref, readonly } from 'vue'
import { useTwinCitation } from './useTwinCitation'
import type { SpecBlock } from '../types/spec'

// ── Type badge colours ─────────────────────────────────────────────────────

export type DefineType =
  | 'planguage-term'
  | 'CE-concept'
  | 'domain-term'
  | 'technical-standard'
  | 'general-business'

export const DEFINE_TYPE_LABELS: Record<DefineType, string> = {
  'planguage-term':     'Planguage term',
  'CE-concept':         'CE concept',
  'domain-term':        'Domain term',
  'technical-standard': 'Technical standard',
  'general-business':   'General business',
}

export const DEFINE_TYPE_COLOURS: Record<DefineType, string> = {
  'planguage-term':     'bg-violet-100 text-violet-700',
  'CE-concept':         'bg-indigo-100 text-indigo-700',
  'domain-term':        'bg-sky-100 text-sky-700',
  'technical-standard': 'bg-teal-100 text-teal-700',
  'general-business':   'bg-slate-100 text-slate-600',
}

export interface DefineResult {
  term: string
  definition: string
  /** Attribution string — specific reference, e.g. "Tom Gilb, Competitive Engineering (2005), p.47" */
  source: string
  type: DefineType
}

// ── Module-level state ────────────────────────────────────────────────────

const _result  = ref<DefineResult | null>(null)
const _loading = ref(false)
const _error   = ref('')
const _open    = ref(false)
const _term    = ref('')   // tracks the pending/active term for UI display

// ── Call-ID guard ─────────────────────────────────────────────────────────
// Incremented on every defineTerm() call. Each async invocation captures
// its own ID at start; before writing any result it checks that no newer
// call has started. This prevents a slow first call from overwriting a
// faster second call's result.
let _currentCallId = 0

// ── Adaptive timeout ──────────────────────────────────────────────────────
// Local Ollama inference (llama3.1:8b on CPU/Apple Silicon) can take 6–12 s
// under real-world load. Cloud API (claude-*) typically responds in 2–4 s.
// Using the same 8 s cap for both means local mode times out almost every
// request — which is why Illuminate appeared "broken for days" (it works fine
// in Ollama, just needed more time).
//
// Fix: detect local mode at module load time and use a generous 45 s cap for
// Ollama, keeping 15 s for cloud so the user still gets a fast failure signal.
// The watchdog sits 10 s above ILLUMINATE_TIMEOUT_MS so it only fires if the
// Promise.race itself somehow fails to reject — a true last resort.
const _IS_LOCAL_OLLAMA = !!(
  import.meta.env.VITE_OLLAMA_MODEL ||
  import.meta.env.VITE_OLLAMA_BASE_URL
)
// Cloud timeout reduced 15 s → 8 s (2026-05-27 r09): cloud API typically responds
// in 2-4 s; 15 s was too long to be comfortable. 8 s still gives 2× headroom.
// Ollama stays at 45 s (CPU inference can take 6-12 s under load).
const ILLUMINATE_TIMEOUT_MS  = _IS_LOCAL_OLLAMA ? 45_000 : 8_000
const ILLUMINATE_WATCHDOG_MS = ILLUMINATE_TIMEOUT_MS + 5_000   // 13 s cloud, 50 s Ollama

// ── Watchdog timer ────────────────────────────────────────────────────────
// Absolute last-resort: if _loading is still true after ILLUMINATE_WATCHDOG_MS
// (timeout race failed, call ID stale chain, or any other edge case),
// force-reset to an error state so the spinner NEVER runs forever.
let _watchdogTimer: ReturnType<typeof setTimeout> | null = null

function _startWatchdog(): void {
  if (_watchdogTimer !== null) clearTimeout(_watchdogTimer)
  _watchdogTimer = setTimeout(() => {
    _watchdogTimer = null
    if (_loading.value) {
      _loading.value = false
      _error.value   = 'Illuminate timed out — please try again'
    }
  }, ILLUMINATE_WATCHDOG_MS)
}

function _clearWatchdog(): void {
  if (_watchdogTimer !== null) {
    clearTimeout(_watchdogTimer)
    _watchdogTimer = null
  }
}

// ── Nav-bar "💡 Illuminate ⌘I" trigger ────────────────────────────────────
// Set to true by openDefineSearch() (called from the Plan Crest / toolbar
// buttons).  SelectionDefiner reads this directly — NO watch() needed.
// SelectionDefiner resets it to false once it has acted on the request
// (either defining the live selection, or showing the term-search panel).
// Using a plain boolean rather than an incrementing counter avoids any
// Vue scheduler re-entrancy hazards.
const _defineSearchOpen = ref(false)

// ── Helpers ───────────────────────────────────────────────────────────────
// r93uuu — `_getClient()` (Anthropic SDK constructor) deleted. The Twin
// citation composable is the new fallback path; no in-app SDK instantiation.

function _specContext(spec: SpecBlock | null): string {
  if (!spec) return ''
  return [
    ...spec.functions.map((f) => f.description),
    ...spec.values.map((v) => `${v.description} measured by ${v.scale}`),
    ...spec.solutions.map((s) => s.description),
  ]
    .join(' · ')
    .slice(0, 500)
}

function _stripFences(text: string): string {
  return text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
}

// ── Private helpers: two AI back-ends ────────────────────────────────────
//
// Tom Gilb, 2026-06-06: "assume I am using ollama for all SEM execution
// until further notice."
//
// Ollama is the PRIMARY path. Tom Gilb's Twin Consultant (by Kai Gilb) is
// the SECONDARY fallback — r93uuu migration (2026-06-13). The caller
// (defineTerm) tries Ollama first; only on failure does it call the Twin.
// This keeps the hot path local + offline-capable; the Twin provides the
// canonical Glossary entry + concept number when Ollama is unavailable.
//
// Architectural note: the Twin's /api/chat is a public CORS-open service
// hosted by Kai Gilb. SEM App is a CONSUMER, not an embedded API client.
// This composes with Claude-Code-as-AI-Layer SUPREME (no in-app SDK) and
// r93ppp Twin-as-Destination (every Twin call is a funding-loop touch).

const OLLAMA_TIMEOUT_MS = 45_000   // local inference can take 6-12 s on CPU

function _buildPrompt(cleaned: string, context: string): string {
  return `You are a Competitive Engineering (CE) and Planguage methodology expert, trained on Tom Gilb's work.

The user has selected the following term or phrase from a planning document and wants a precise definition:

Term: "${cleaned}"
${context ? `\nProject context (the spec this term appears in):\n"${context}"` : ''}

Provide:
1. A clear 1–2 sentence definition of the term, tailored to this project's domain and to Planguage/CE methodology where relevant.
2. The most specific source you can cite — prefer named works: Tom Gilb's "Competitive Engineering" (2005), ISO standards, IEEE standards, TOGAF, etc. If it is a general business or domain term, say so plainly.
3. Classify the term type.

Output ONLY a valid JSON object — no prose, no code fences:
{"definition": "...", "source": "...", "type": "planguage-term|CE-concept|domain-term|technical-standard|general-business"}`
}

async function _ollamaDefine(
  cleaned: string,
  context: string,
): Promise<DefineResult & { via: 'ollama' }> {
  const ollamaBase  = (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined) ?? 'http://localhost:11434'
  const ollamaModel = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'llama3.2'
  const prompt      = _buildPrompt(cleaned, context)

  const ctl     = new AbortController()
  const timeout = setTimeout(() => ctl.abort(), OLLAMA_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(`${ollamaBase}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  ctl.signal,
      body:    JSON.stringify({ model: ollamaModel, prompt, stream: false, format: 'json' }),
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`)
  const ollamaJson = await resp.json() as { response?: string }
  const raw = (ollamaJson.response ?? '').trim()
  if (!raw) throw new Error('Empty Ollama response')
  const parsed = JSON.parse(_stripFences(raw)) as { definition: string; source: string; type: string }
  return {
    term:       cleaned,
    definition: parsed.definition,
    source:     `${parsed.source} · 🦙 Ollama ${ollamaModel}`,
    type:       (parsed.type as DefineType) ?? 'domain-term',
    via:        'ollama',
  }
}

/**
 * r93uuu — Tom Gilb's Twin Consultant fallback (by Kai Gilb).
 *
 * Replaces the pre-r93uuu Anthropic SDK fallback. Calls the Twin's public
 * CORS-open `/api/chat` via `useTwinCitation().citeTerm()`, returns the
 * canonical Glossary entry, parses concept numbers (*NNN), and maps the
 * answer back into the `DefineResult` shape the SelectionDefiner UI expects.
 *
 * Type detection: if any `*NNN` concept number was found in the response, the
 * term is treated as a Planguage / CE concept; otherwise `domain-term` is the
 * default. Source attribution includes the concept number(s), the canonical
 * Twin concept URL (so the user can deep-link to the Glossary page), and the
 * "Tom Gilb Consultant Twin — by Kai Gilb" attribution per r93ppp.
 */
/**
 * r32 (Tom Gilb 2026-06-13: "Priority: Use the internal vault glossary. Then
 * the twin search is extra bonus for special users.") — Tier 1 local vault
 * Glossary at `/api/glossary?term=X` (served by `glossaryPlugin()` in
 * `vite.config.ts`, sourced from `10.Standard/2.Glossary/PlanguageGlossary/`).
 * Resolution pipeline already supports synonym / article / singular / derived
 * forms (handled server-side), so this client just calls the endpoint once.
 *
 * Returns a `DefineResult` typed `planguage-term` (the local Glossary is
 * authoritative for Planguage / CE concepts).  Source attribution names the
 * canonical concept + the X-Synonym-Of header when the input was a synonym.
 *
 * Throws if the endpoint returns 404 / 503 / network error → caller falls
 * through to Twin tier 2.
 */
async function _localGlossaryDefine(
  cleaned: string,
  _context: string,
): Promise<DefineResult & { via: 'local-glossary' }> {
  const res = await fetch(`/api/glossary?term=${encodeURIComponent(cleaned)}`)
  if (res.status === 404) throw new Error(`Local Glossary: term not found (${cleaned})`)
  if (res.status === 503) throw new Error('Local Glossary: vault not accessible')
  if (!res.ok)            throw new Error(`Local Glossary: HTTP ${res.status}`)

  const markdown = await res.text()
  const synonymOf = res.headers.get('x-synonym-of') ?? null

  // Pull the canonical name + concept number out of the frontmatter / heading.
  const nameMatch    = markdown.match(/^english_name:\s*["']?([^"'\n]+)["']?/m)
  const numberMatch  = markdown.match(/^concept_number:\s*["']?\*?(\d{2,4}[a-z]?)["']?/m)
  const canonicalName = (nameMatch?.[1] ?? cleaned).trim()
  const conceptNumber = numberMatch?.[1] ?? ''

  // Extract the [!example] Definition block as the short answer.
  const exMatch = markdown.match(/^>\s*\[!example\][^\n]*\n((?:>\s*[^\n]*\n?)+)/m)
  const defLines = exMatch ? exMatch[1].split('\n').map(l => l.replace(/^>\s?/, '')) : []
  const definition = defLines.join('\n').trim() || `${canonicalName} — see full Glossary entry below.`

  // Build the source line — local vault is tier 1, optional synonym attribution.
  const sourceParts = [
    'Planguage Glossary (Tom Gilb)',
    conceptNumber ? `*${conceptNumber}` : '',
    'vault tier 1 · /10.Standard/2.Glossary/PlanguageGlossary/',
    synonymOf && synonymOf.toLowerCase() !== cleaned.toLowerCase() ? `Matched as: ${synonymOf}` : '',
  ].filter(Boolean)

  return {
    term:       canonicalName,
    definition,
    source:     sourceParts.join(' · '),
    type:       'planguage-term',
    via:        'local-glossary',
  }
}

async function _twinDefine(
  cleaned: string,
  _context: string,   // currently unused; the Twin uses its own loaded context
): Promise<DefineResult & { via: 'twin' }> {
  const { citeTerm } = useTwinCitation()
  const twinResult = await citeTerm(cleaned)

  // Type classification — concept numbers in the response signal a Planguage
  // or CE concept. Heuristic: 1-3 digit concept numbers are usually CE / Planguage.
  const hasConceptNumber = twinResult.conceptNumbers.length > 0
  const type: DefineType = hasConceptNumber
    ? (twinResult.text.toLowerCase().includes('planguage') ? 'planguage-term' : 'CE-concept')
    : 'domain-term'

  // Source attribution — primary concept URL if available, else generic Twin link.
  const conceptCite = twinResult.conceptNumbers.length > 0
    ? `*${twinResult.conceptNumbers.join(' · *')}`
    : ''
  const urlCite = twinResult.primaryConceptUrl ?? 'https://www.gilb.com/tomtwin/login'
  const source = [
    'Tom Gilb Consultant Twin (by Kai Gilb)',
    conceptCite,
    urlCite,
  ].filter(Boolean).join(' · ')

  return {
    term:       cleaned,
    definition: twinResult.text,
    source,
    type,
    via:        'twin',
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up an AI-generated definition + source for any term.
 * Opens the result panel immediately (loading state), fills in when done.
 *
 * Execution order (Tom Gilb 2026-06-13 r32 — replaces r93uuu Ollama-first):
 *   1. **Local vault Glossary** at `/api/glossary?term=X` — PRIMARY.  Tom verbatim:
 *      "Priority: Use the internal vault glossary. Then the twin search is extra
 *      bonus for special users."  Sourced from 10.Standard/2.Glossary/
 *      PlanguageGlossary/ — 663 concept entries with full resolution pipeline.
 *   2. Tom Gilb's Twin Consultant (fallback for non-Planguage terms or vault miss)
 *      — public CORS-open `/api/chat`, returns canonical concept entries with
 *      concept numbers; every call composes with r93ppp Twin-as-Destination
 *      funding-loop.
 *   3. Ollama — REMOVED.  CLAUDE.md commented out Ollama 2026-06-02 ("hijacking
 *      ALL @anthropic-ai/sdk calls"); the previous defineTerm still tried it
 *      first → 404 → unnecessary failure layer.  Gone.
 */
export async function defineTerm(term: string, spec: SpecBlock | null): Promise<void> {
  const cleaned = term.trim().slice(0, 120)    // cap at reasonable length
  if (!cleaned) return

  // Claim this call's ID. Any in-flight call with a lower ID is now stale
  // and will discard its result when it eventually resolves.
  const myCallId = ++_currentCallId

  _term.value    = cleaned
  _result.value  = null
  _error.value   = ''
  _loading.value = true
  _open.value    = true
  _startWatchdog()   // absolute backstop — resets spinner no matter what

  try {
    // ── Mock mode ────────────────────────────────────────────────────────
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 700))
      if (myCallId !== _currentCallId) return
      _result.value = {
        term: cleaned,
        definition: `${cleaned} — a concept used within this specification context. In Competitive Engineering, it relates to measurable outcomes tied to stakeholder value.`,
        source: 'Mock mode · Tom Gilb, Competitive Engineering (2005)',
        type: 'CE-concept',
      }
      return
    }

    const context = _specContext(spec)

    // ── PRIMARY (r32): Local vault Glossary ──────────────────────────────
    let localError = ''
    try {
      const result = await _localGlossaryDefine(cleaned, context)
      if (myCallId !== _currentCallId) return   // stale — discard
      _result.value = result
      return                                    // SUCCESS — done.  No Twin fallback needed.
    } catch (localErr) {
      localError = localErr instanceof Error ? localErr.message : String(localErr)
      // Fall through to Twin (tier 2) for non-Planguage terms or vault miss.
    }

    // ── SECONDARY: Tom Gilb's Twin Consultant ────────────────────────────
    try {
      const result = await _twinDefine(cleaned, context)
      if (myCallId !== _currentCallId) return   // stale — discard
      _result.value = result
    } catch (twinErr) {
      if (myCallId !== _currentCallId) return   // stale error — discard
      const twinMsg = twinErr instanceof Error ? twinErr.message : String(twinErr)
      _error.value = `Illuminate failed — Vault Glossary: ${localError.slice(0, 80)} · Twin: ${twinMsg.slice(0, 80)}. Open https://www.gilb.com/tomtwin/login to search directly.`
    }
  } finally {
    _clearWatchdog()
    // UNCONDITIONAL: always clear loading when this call's async work ends.
    _loading.value = false
  }
}

/**
 * Define whatever text is currently selected in the browser.
 * Safe to call from a voice command or keyboard shortcut.
 * No-op if nothing is selected or selection is empty/whitespace.
 */
export function defineCurrentSelection(spec: SpecBlock | null): void {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const text = sel.toString().trim()
  if (!text) return
  defineTerm(text, spec)
}

/** Close the definition panel. */
export function closeDefine(): void {
  _clearWatchdog()
  _open.value    = false
  _result.value  = null
  _error.value   = ''
  _term.value    = ''
  _loading.value = false   // safety reset — clears any stuck loading state (HMR or mid-flight close)
}

/**
 * Cancel an in-flight Illuminate call without closing the panel.
 * Increments _currentCallId so the in-flight promise discards its result.
 * Sets an error message so the user sees feedback and can retry.
 * Design log r09 2026-05-27: added so loading state always has an escape hatch.
 */
export function cancelDefine(): void {
  _clearWatchdog()
  ++_currentCallId   // make in-flight call stale — its finally still runs but result is discarded
  _loading.value = false
  _error.value   = 'Cancelled — select a term and click Illuminate, or type one below'
}

/**
 * Open the Define term-search panel from anywhere (e.g. nav-bar buttons).
 * Sets _defineSearchOpen = true. SelectionDefiner reads this directly —
 * no watch() or counter needed. SelectionDefiner clears the flag after acting.
 */
export function openDefineSearch(): void {
  _defineSearchOpen.value = true
}

// ── HMR dispose ───────────────────────────────────────────────────────────
// When Vite hot-replaces this module, the OLD module's _loading ref stays
// bound to SelectionDefiner.vue (which hasn't re-mounted yet).  Without this
// hook the panel shows an eternal spinner until the user manually closes it
// or the page reloads.  dispose() fires on the OLD module instance just before
// replacement — clearing _loading=false means SelectionDefiner.vue immediately
// sees no spinner, and the new module starts with a clean slate.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _clearWatchdog()
    _loading.value = false
    _error.value   = ''
    _open.value    = false
  })
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useDefine() {
  return {
    result:  readonly(_result),
    loading: readonly(_loading),
    error:   readonly(_error),
    open:    readonly(_open),
    term:    readonly(_term),
    /** Set to true by openDefineSearch() (nav-bar button). SelectionDefiner
     *  reads this directly and resets it to false after acting. No watch(). */
    defineSearchOpen: _defineSearchOpen,   // writable — SelectionDefiner owns the reset
    defineTerm,
    defineCurrentSelection,
    closeDefine,
    openDefineSearch,
  }
}
