// useGenerateSolutions.ts — Stage 2.2 auto-generate Solutions for Values
// that don't yet have a linked Solution.
//
// Tom Gilb 2026-06-25 verbatim: *"2.2 did not clearly generate solutions, and
// we need the proof of that with the same window we just developed for
// stage 2 (Name = Planguage Progress window)"*.  The fix: a one-click action
// that identifies Values without linked Solutions, fires an AI call asking
// for one Solution per unaddressed Value with the full Tier-1 26-parameter
// set populated (per Solution Parameters SUPREME), and surfaces the
// PlanguageProgressWindow as the live receipt.
//
// Composes with:
//   - Solution Parameters SUPREME (every new Solution gets 7 Tier-1 params)
//   - Conjunction-of-Technologies SUPREME (the Window IS the verification surface)
//   - Universal Undo SUPREME (every new Solution recorded via undo.record())
//   - Honest Loading Hint Copy SUPREME (real AI call, no fake / fallback)
//   - AI-Max (one-click auto-generate; no per-call prompting)
//   - Canonical Planguage Extractor SUPREME (imports CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT)

import { ref, computed, type Ref } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock, SEntry, VEntry } from '../types/spec'

// Module-private client cache — mirrors useSDK.ts pattern.
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (!apiKey) {
      throw new Error('VITE_ANTHROPIC_API_KEY is not set — Stage 2.2 Solution generation requires the AI key.')
    }
    _client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      timeout: 120_000,
    })
  }
  return _client
}

/** Identify Values with no linked Solution.  A Value is "unaddressed" when
 *  NO existing Solution entry mentions this Value in its `derivedFrom` or
 *  `function` field (the two wikilink fields where Solution→Value linkage
 *  is recorded per the canonical SEntry schema). */
export function findUnaddressedValues(spec: SpecBlock | null | undefined): VEntry[] {
  if (!spec?.values?.length) return []
  const sols = spec.solutions ?? []
  // Build the set of Value ids referenced by ANY existing Solution.
  const addressedIds = new Set<string>()
  for (const s of sols) {
    const haystack = `${s.derivedFrom ?? ''} ${s.function ?? ''} ${s.mainImpacts ?? ''}`
    for (const v of spec.values) {
      if (haystack.includes(v.id)) addressedIds.add(v.id)
    }
  }
  return spec.values.filter(v => !addressedIds.has(v.id))
}

/** AI prompt builder — focused Solution generation, NOT full-spec rewrite. */
function buildSolutionPrompt(spec: SpecBlock, unaddressed: VEntry[]): string {
  const valuesBlock = unaddressed.map(v => {
    const scale  = v.scale  ? `Scale: ${v.scale}` : ''
    const meter  = v.meter  ? `Meter: ${v.meter}` : ''
    const tol    = v.tolerable ? `Tolerable: ${v.tolerable}` : ''
    const goal   = v.goal   ? `Goal: ${v.goal}` : ''
    return [
      `### ${v.id}: ${v.description ?? '(no description)'}`,
      scale, meter, tol, goal,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const constraintsBlock = (spec.constraints ?? []).map(c =>
    `- [[${c.id}]]: ${c.description ?? c.id}`
  ).join('\n')

  return `You are a Planguage Solution architect.  Generate ONE design Solution per unaddressed Value listed below.  Every Solution must satisfy ALL existing Constraints.

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

## Unaddressed Values (one Solution per Value):
${valuesBlock}

## Existing Constraints (every new Solution MUST comply):
${constraintsBlock || '(none)'}

## Output schema — return ONLY this JSON, no prose:
{
  "solutions": [
    {
      "id": "S.MnemonicTag",                  // 1-3 word mnemonic per Planguage ID Standard
      "type": "Solution",
      "level": "Solution",
      "status": "NotProduction",
      "description": "...",                   // ≤25 words naming what this design idea IS
      "derivedFrom": "[[V.TargetValue]]",     // wikilink to the Value this Solution addresses
      "function": "[[F.AssociatedFunction]]", // wikilink to a Function (best-fit existing or new)
      "mainImpacts": "[[V.TargetValue]] +30%", // estimated % impact per addressed Value
      "relatedTo": "[[Stakeholder1]]",         // wikilinks to relevant Stakeholders
      "implementationResponsible": "...",      // single named person/team
      "sideEffects": "...",                    // unintended impacts on other Values
      "costAspects": "...",                    // CapEx / OpEx / staff
      "longTermCosts": "...",                  // annual run-rate + maintenance
      "qualifiers": "[when=..., where=..., who=...]", // r93jjj Infinity-Trap protection
      "impact": "..."                          // legacy field — same content as mainImpacts
    }
  ]
}

Generate EXACTLY ${unaddressed.length} Solution(s), one per Value above.  Use canonical Planguage IDs (1-3 word mnemonic), populate ALL Tier-1 required fields per Solution Parameters SUPREME, and respect every Constraint.`
}

/** Parse the AI's JSON response into SEntry[].  Defensive — returns [] on any
 *  parse failure (caller's error ref surfaces the issue). */
function parseSolutionResponse(rawText: string): SEntry[] {
  // Strip any fenced markdown wrapping the JSON.
  const jsonStart = rawText.indexOf('{')
  const jsonEnd   = rawText.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) return []
  const slice = rawText.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(slice) as { solutions?: Partial<SEntry>[] }
    if (!Array.isArray(parsed.solutions)) return []
    return parsed.solutions.map((s, i) => ({
      id: s.id ?? `S.Generated${i + 1}`,
      type: s.type ?? 'Solution',
      level: s.level ?? 'Solution',
      status: s.status ?? 'NotProduction',
      description: s.description ?? '',
      derivedFrom: s.derivedFrom ?? '',
      function: s.function ?? '',
      mainImpacts: s.mainImpacts ?? '',
      relatedTo: s.relatedTo ?? '',
      implementationResponsible: s.implementationResponsible ?? '',
      sideEffects: s.sideEffects ?? '',
      costAspects: s.costAspects ?? '',
      longTermCosts: s.longTermCosts ?? '',
      qualifiers: s.qualifiers ?? '',
      impact: s.impact ?? s.mainImpacts ?? '',
    } as SEntry))
  } catch {
    return []
  }
}

export interface UseGenerateSolutionsReturn {
  /** Reactive count of Values that have no linked Solution. */
  unaddressedCount: Ref<number>
  /** Reactive list of unaddressed Value entries. */
  unaddressed:      Ref<VEntry[]>
  /** True while the AI call is in flight. */
  isGenerating:     Ref<boolean>
  /** Seconds elapsed since the current generation started.  Drives the
   *  PlanguageProgressWindow's solution-tile spinner. */
  elapsed:          Ref<number>
  /** Last error message — empty when no error. */
  error:            Ref<string>
  /** Count of solutions generated in the last successful run. */
  lastGeneratedCount: Ref<number>
  /** Run the generation.  Returns the new SEntry[] on success, [] on failure. */
  generate:         () => Promise<SEntry[]>
  /** Cancel any in-flight call (best-effort — Anthropic SDK abort signal). */
  cancel:           () => void
}

/** Composable wiring an AI-driven auto-generate-Solutions flow for Stage 2.2.
 *  The caller (App.vue Stage 2.2 handler) is responsible for:
 *   - Merging the returned SEntry[] into `currentSpec.value.solutions` via
 *     Universal Undo (`undo.record({...})`).
 *   - Mounting `<PlanguageProgressWindow schedule="solutions-only">` while
 *     `isGenerating === true`.
 *   - Showing the success / failure notification to the user. */
export function useGenerateSolutions(spec: Ref<SpecBlock | null | undefined>): UseGenerateSolutionsReturn {
  const isGenerating = ref(false)
  const elapsed = ref(0)
  const error = ref('')
  const lastGeneratedCount = ref(0)
  let _timer: number | null = null
  let _abortController: AbortController | null = null

  const unaddressed = computed<VEntry[]>(() => findUnaddressedValues(spec.value))
  const unaddressedCount = computed<number>(() => unaddressed.value.length)

  async function generate(): Promise<SEntry[]> {
    if (!spec.value) { error.value = 'No spec loaded.'; return [] }
    const targets = unaddressed.value
    if (targets.length === 0) {
      error.value = 'All Values already have at least one linked Solution — nothing to generate.'
      return []
    }
    isGenerating.value = true
    elapsed.value = 0
    error.value = ''
    if (_timer !== null) clearInterval(_timer)
    _timer = window.setInterval(() => { elapsed.value++ }, 1000)
    _abortController = new AbortController()
    try {
      const client = getClient()
      const prompt = buildSolutionPrompt(spec.value, targets)
      const resp = await client.messages.create(
        {
          model: MODEL_ID,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal: _abortController.signal },
      )
      const text = resp.content
        .map((c: { type: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : ''))
        .join('\n')
      const generated = parseSolutionResponse(text)
      lastGeneratedCount.value = generated.length
      if (generated.length === 0) {
        error.value = 'AI response could not be parsed into Solutions.  Try again or open Sharpen for the interactive flow.'
      }
      return generated
    } catch (e) {
      const msg = (e instanceof Error) ? e.message : String(e)
      if (msg.includes('aborted')) {
        error.value = 'Generation cancelled.'
      } else {
        error.value = `AI call failed: ${msg}`
      }
      return []
    } finally {
      isGenerating.value = false
      if (_timer !== null) { clearInterval(_timer); _timer = null }
      _abortController = null
    }
  }

  function cancel(): void {
    if (_abortController) _abortController.abort()
  }

  return {
    unaddressedCount,
    unaddressed,
    isGenerating,
    elapsed,
    error,
    lastGeneratedCount,
    generate,
    cancel,
  }
}
