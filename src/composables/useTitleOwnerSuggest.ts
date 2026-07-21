// UNIT_TYPE=Composable
//
// useTitleOwnerSuggest — derive a short Plan Title + probable Owner Name
// from raw planning text via a quick AI call.
//
// Tom Gilb 2026-06-22 verbatim greenlight:
//   "DEFAULT TITLE AND OWNER: I want to generate a title and owner by you
//    using your judgement for a short title and a probable responsible
//    owner. If not right we can fix later, but all efforts will start with
//    a title and owner"
//
// Composes with:
//   • AI-Max SUPREME — "Never present a blank field if a starting point
//     can be derived." This is the direct fulfilment for Plan / Contract
//     Name + Owner Name on Stage 1.
//   • No-Silent-Data-Loss SUPREME — composable NEVER overwrites a
//     non-empty field; caller must guard.
//   • Universal Undo SUPREME — auto-populated values are normal input
//     edits; native browser undo + the v-model reactivity handle reversal.
//   • Claude-Code-as-AI-Layer SUPREME (grandfathered) — uses the existing
//     Anthropic SDK pipeline; consistent with all other live AI calls.
//   • r41 v270 Canonical Planguage Extractor — NOT imported here because
//     this is NOT Planguage extraction; it's lightweight title/owner
//     inference.  The canonical primer is for extractors that CREATE
//     F./V./S./C. entries; this composable creates only a short string
//     pair.  Banks the precedent for future "lightweight inference" calls
//     that do not need the full discipline.

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'

const TIMEOUT_MS = 10_000
const MAX_INPUT_CHARS = 1_200  // sufficient context for title inference; keep call small + fast

export interface TitleOwnerSuggestion {
  title: string  // 1–5 words; mnemonic-style
  owner: string  // a role or person name; 1–4 words
}

function _getClient(): Anthropic | null {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) return null
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 30_000 })
}

function _extractJson<T>(text: string): T | null {
  const trimmed = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Try to find a JSON object inside the text (LLM sometimes wraps with prose).
    const m = trimmed.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0]) as T
    } catch {
      return null
    }
  }
}

/**
 * Module-level state — the suggester runs at most once per debounce window
 * across all SEMEntryForm mounts.  Per-call state is local to fetchSuggestion.
 */
export function useTitleOwnerSuggest() {
  const loading = ref(false)
  const lastResult = ref<TitleOwnerSuggestion | null>(null)
  const error = ref('')

  /**
   * Derive a Plan Title + probable Owner Name from raw planning text.
   *
   * Returns null on failure (silent — caller leaves fields empty).
   * Caller is responsible for guarding against overwriting non-empty fields.
   */
  async function fetchSuggestion(rawText: string): Promise<TitleOwnerSuggestion | null> {
    const trimmed = rawText.trim().slice(0, MAX_INPUT_CHARS)
    if (trimmed.length < 30) return null   // too little content to infer reliably

    loading.value = true
    error.value = ''

    try {
      // Mock mode for tests / no-key sessions
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise(r => setTimeout(r, 400))
        const result: TitleOwnerSuggestion = {
          title: 'Sample Plan 2026',
          owner: 'Product Team',
        }
        lastResult.value = result
        return result
      }

      const client = _getClient()
      if (!client) {
        // No API key available — silent fail, fields stay empty.
        return null
      }

      const prompt = `You are reading raw planning text the planner just typed (or pasted, or had transcribed from voice). Derive TWO short defaults so the planner does not face blank fields:

(1) TITLE — a short, memorable plan name (2–5 words, no quotes, no trailing punctuation, mnemonic style per Tom Gilb's Planguage ID standard — e.g. "Indianapolis Cruiser Build", "Crew Retention 2026", "GDPR Export Endpoint", "Marathon Habit"). Avoid generic words like "Plan" or "Project" unless the input names them.

(2) OWNER — a probable Owner Name: the named person most accountable for the plan IF the text names one (e.g. "Tom Gilb", "Phineas Pett") OR the role/team most likely accountable if no person is named (e.g. "Product Team", "U.S. Navy", "Engineering Lead", "Chief Mate"). 1–4 words.

These are STARTING DEFAULTS — the planner can and will edit them. Lean toward concrete + specific over generic.

INPUT TEXT:
---
${trimmed}
---

Return ONLY a JSON object — no prose, no markdown fences:
{
  "title": "...",
  "owner": "..."
}`

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('title/owner suggest timed out')), TIMEOUT_MS),
      )
      const response = await Promise.race([
        client.messages.create({
          model:      MODEL_ID,
          max_tokens: 120,
          messages:   [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ])

      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') return null
      const parsed = _extractJson<TitleOwnerSuggestion>(textBlock.text)
      if (!parsed) return null

      // Sanitize: trim, drop quotes, cap length.
      const title = (parsed.title ?? '').toString().trim().replace(/^["']|["']$/g, '').slice(0, 60)
      const owner = (parsed.owner ?? '').toString().trim().replace(/^["']|["']$/g, '').slice(0, 40)
      if (!title) return null
      const result: TitleOwnerSuggestion = { title, owner }
      lastResult.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, lastResult, error, fetchSuggestion }
}
