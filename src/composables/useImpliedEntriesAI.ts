// UNIT_TYPE=Hook
// useImpliedEntriesAI — Tier 2 of Advanced Parsing.
//
// PURPOSE
// ───────
// After the Tier 1 rule-based parser (impliedHierarchies.ts) proposes
// implied entries, this composable fires an LLM call to discover
// ADDITIONAL stakeholders / values / means that the rules cannot catch
// — domain-specific context, rare vocabularies, non-English phrases,
// compound goals, etc.
//
// DESIGN
// ──────
// Per-instance state (not module-level shared refs) — each SEMEntryForm
// mount gets its own loading/result cycle. No cross-component bleed.
//
// Entries are tagged ruleId: 'ai-tier2' so the panel can render a
// ✨ badge to distinguish them from rule-derived suggestions.
//
// Tom 2026-05-17: "go ahead with tier 2, and is it in both (ultra and
// normal) models or 1" → both, because Ultra aperture routes through
// SEMEntryForm.loadAndParse which reaches the same review stage.

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'
import type { ImpliedEntry, SugGroup } from '../utils/impliedHierarchies'

const TIMEOUT_MS = 12_000

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 30_000 })
}

function _stripFences(text: string): string {
  return text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
}

export function useImpliedEntriesAI() {
  const suggestions = ref<ImpliedEntry[]>([])
  const loading     = ref(false)
  const error       = ref('')

  /**
   * Ask the LLM for additional implied entries beyond what Tier 1 rules found.
   *
   * @param rawText             The original raw text the user typed (≤800 chars used)
   * @param existingStakeholders  Tier-1-parsed stakeholder chips
   * @param existingValues        Tier-1-parsed value chips
   * @param existingMeans         Tier-1-parsed means chips
   */
  async function fetchSuggestions(
    rawText: string,
    existingStakeholders: string[],
    existingValues: string[],
    existingMeans: string[],
  ): Promise<void> {
    const trimmed = rawText.trim().slice(0, 800)
    if (!trimmed) return

    loading.value     = true
    error.value       = ''
    suggestions.value = []

    try {
      // ── Mock mode ──────────────────────────────────────────────────────────
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise(r => setTimeout(r, 1_200))
        suggestions.value = [
          { group: 'stakeholders', text: 'regulator',             why: 'Often implied by any operational system', ruleId: 'ai-tier2' },
          { group: 'values',       text: 'user satisfaction score', why: 'Human-facing systems need satisfaction measurement', ruleId: 'ai-tier2' },
        ]
        return
      }

      // ── Live LLM call ──────────────────────────────────────────────────────
      const client = _getClient()

      // r41 v271 (Tom Gilb 2026-06-21 SUPREME — "sweep the rest"): refactored
      // to import canonical Planguage primer per Canonical Planguage Extractor
      // SUPREME rule.  This is Tier 2 implied-entries discovery: surfaces
      // additional Stakeholders/Values/Means beyond what the Tier 1 rule-based
      // parser found.  Suggestion-only mode (returns text+why, not full entries)
      // so the JSON shape is lighter than full extraction.  Canonical primer
      // ensures the Stakeholder discipline + Value-rich rules + ID-mnemonic
      // discipline all flow into suggestions automatically.
      const prompt = `You are a Competitive Engineering (CE) consultant trained in Tom Gilb's Planguage / SEM methodology.

== IMPLIED-ENTRIES TIER 2 INPUT FORMAT (input shape for this caller) ==
The user typed raw planning text. A Tier 1 rule-based parser has ALREADY
identified some entries. Your job is to suggest ADDITIONAL entries strongly
implied by the text that the rules missed — domain-specific context, rare
vocabularies, non-English phrases, compound goals.

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== TIER 2 SPECIFIC CONSTRAINTS ==
Raw text:
"${trimmed}"

Already-identified by Tier 1 (do NOT re-suggest):
  Stakeholders:  ${existingStakeholders.length ? existingStakeholders.join(', ') : '(none)'}
  Values:        ${existingValues.length       ? existingValues.join(', ')       : '(none)'}
  Means:         ${existingMeans.length        ? existingMeans.join(', ')        : '(none)'}

Suggestion-only mode: return text+why pairs per group (NOT full Planguage
entries). Each suggestion's text follows the mnemonic-ID discipline from the
canonical primer above. Each "why" must reference the specific word or
phrase in the input that implies the entry. Maximum 3 suggestions per group.
If nothing is genuinely implied for a group, return an empty array.

== OUTPUT JSON SHAPE (caller-specific) ==
Output ONLY valid JSON — no prose, no markdown fences:
{
  "stakeholders": [{"text": "...", "why": "..."}],
  "values":       [{"text": "...", "why": "..."}],
  "means":        [{"text": "...", "why": "..."}]
}`

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('AI suggestions timed out — check your connection and try again')),
          TIMEOUT_MS,
        ),
      )

      const response = await Promise.race([
        client.messages.create({
          model:      MODEL_ID,
          max_tokens: 400,
          messages:   [{ role: 'user', content: prompt }],
        }),
        timeoutPromise,
      ])

      const textBlock = response.content.find(b => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

      const parsed = JSON.parse(_stripFences(textBlock.text)) as {
        stakeholders?: { text: string; why: string }[]
        values?:       { text: string; why: string }[]
        means?:        { text: string; why: string }[]
      }

      // Build dedup sets for each group (case-insensitive)
      const existing: Record<SugGroup, Set<string>> = {
        stakeholders: new Set(existingStakeholders.map(s => s.toLowerCase())),
        values:       new Set(existingValues.map(s => s.toLowerCase())),
        means:        new Set(existingMeans.map(s => s.toLowerCase())),
      }

      const result: ImpliedEntry[] = []
      const groups: SugGroup[] = ['stakeholders', 'values', 'means']
      for (const group of groups) {
        for (const item of (parsed[group] ?? [])) {
          const text = item.text?.trim()
          if (!text) continue
          if (existing[group].has(text.toLowerCase())) continue   // already in chips
          result.push({
            group,
            text,
            why:    item.why?.trim() ?? 'Implied by context',
            ruleId: 'ai-tier2',
          })
        }
      }
      suggestions.value = result
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'AI suggestions failed — please try again'
    } finally {
      loading.value = false
    }
  }

  /** Reset all AI state — call when the user navigates back to input stage. */
  function clear(): void {
    suggestions.value = []
    loading.value     = false
    error.value       = ''
  }

  return { suggestions, loading, error, fetchSuggestions, clear }
}
