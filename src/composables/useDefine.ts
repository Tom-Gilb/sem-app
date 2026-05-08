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

// ── Helpers ───────────────────────────────────────────────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 30_000 })
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

  _term.value    = cleaned
  _result.value  = null
  _error.value   = ''
  _loading.value = true
  _open.value    = true

  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 700))
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

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

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
    _error.value =
      err instanceof Error ? err.message : 'Definition lookup failed — please try again'
  } finally {
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
  _open.value    = false
  _result.value  = null
  _error.value   = ''
  _term.value    = ''
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useDefine() {
  return {
    result:  readonly(_result),
    loading: readonly(_loading),
    error:   readonly(_error),
    open:    readonly(_open),
    term:    readonly(_term),
    defineTerm,
    defineCurrentSelection,
    closeDefine,
  }
}
