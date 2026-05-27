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

import Anthropic from '@anthropic-ai/sdk'
import { ref, readonly } from 'vue'
import { MODEL_ID } from '../config/llm'
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

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 30_000 })
}

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

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up an AI-generated definition + source for any term.
 * Opens the result panel immediately (loading state), fills in when done.
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
  _startWatchdog()   // absolute backstop — resets spinner after 25 s no matter what

  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 700))
      if (myCallId !== _currentCallId) return   // stale — a newer call started
      _result.value = {
        term: cleaned,
        definition: `${cleaned} — a concept used within this specification context. In Competitive Engineering, it relates to measurable outcomes tied to stakeholder value.`,
        source: 'Mock mode · Tom Gilb, Competitive Engineering (2005)',
        type: 'CE-concept',
      }
      return
    }

    const client  = _getClient()
    const context = _specContext(spec)

    const prompt = `You are a Competitive Engineering (CE) and Planguage methodology expert, trained on Tom Gilb's work.

The user has selected the following term or phrase from a planning document and wants a precise definition:

Term: "${cleaned}"
${context ? `\nProject context (the spec this term appears in):\n"${context}"` : ''}

Provide:
1. A clear 1–2 sentence definition of the term, tailored to this project's domain and to Planguage/CE methodology where relevant.
2. The most specific source you can cite — prefer named works: Tom Gilb's "Competitive Engineering" (2005), ISO standards, IEEE standards, TOGAF, etc. If it is a general business or domain term, say so plainly.
3. Classify the term type.

Output ONLY a valid JSON object — no prose, no code fences:
{
  "definition": "...",
  "source": "...",
  "type": "planguage-term|CE-concept|domain-term|technical-standard|general-business"
}`

    // Promise.race: hard timeout backstop.
    // 45 s in local-Ollama mode (inference can take 6–12 s under load),
    // 15 s for cloud API (responses are typically 2–4 s; fail fast is good UX).
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Illuminate timed out — check your connection and try again')),
        ILLUMINATE_TIMEOUT_MS,
      ),
    )

    const response = await Promise.race([
      client.messages.create({
        model: MODEL_ID,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
      timeoutPromise,
    ])

    // Stale-result guard: discard if a newer call has already started.
    if (myCallId !== _currentCallId) return

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    const parsed = JSON.parse(_stripFences(textBlock.text)) as {
      definition: string
      source: string
      type: string
    }

    _result.value = {
      term: cleaned,
      definition: parsed.definition,
      source: parsed.source,
      type: (parsed.type as DefineType) ?? 'domain-term',
    }
  } catch (err) {
    if (myCallId !== _currentCallId) return   // stale error — discard silently
    _error.value =
      err instanceof Error ? err.message : 'Illuminate failed — please try again'
  } finally {
    _clearWatchdog()
    // UNCONDITIONAL: always clear loading when this call's async work ends.
    //
    // The conditional guard (myCallId === _currentCallId) was a premature
    // optimisation that caused an eternal spinner: any double-trigger that
    // increments _currentCallId before the first call completes leaves
    // _loading permanently true — the "last" call may also be stale.
    //
    // The brief flash (loading=false, result=null) while a concurrent call
    // is still running is imperceptible in practice and infinitely better
    // than an eternal spinner.  The stale-result guards on _result and
    // _error (above) are kept — they prevent overwriting a newer result.
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
