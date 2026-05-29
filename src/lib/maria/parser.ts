// UNIT_TYPE=Lib
// maria/parser.ts — raw LLM response → MariaResult
//
// Pure function. No Vue, no Anthropic SDK, no browser APIs.
// Accepts the raw string returned by the LLM, strips markdown fences if the
// model wrapped its output, validates structural integrity, applies defensive
// coercions, and returns a typed MariaResult.
//
// Portability: import this anywhere — Node, Deno, browser, Kai-Zen, Twin.
// The only dependency is src/types/maria.ts which is also framework-free.

import type { MariaResult } from '../../types/maria'

// ── Field-name aliases the LLM sometimes uses instead of the canonical names ──
// Handles snake_case, singular, and common paraphrases. Each entry maps an
// alternate key → the canonical MariaResult key it should normalise to.
const FIELD_ALIASES: Record<string, string> = {
  // decisionInventory variants
  decisions:          'decisionInventory',
  decision_inventory: 'decisionInventory',
  decisionList:       'decisionInventory',
  decision_list:      'decisionInventory',
  // authorityReport variants
  authority_report:   'authorityReport',
  authorityGaps:      'authorityReport',
  authority_gaps:     'authorityReport',
  authorityEntries:   'authorityReport',
  // governanceGaps variants
  governance_gaps:    'governanceGaps',
  gaps:               'governanceGaps',
  governmentGaps:     'governanceGaps', // typo the model occasionally produces
  // patternAnalysis variants
  pattern_analysis:   'patternAnalysis',
  patterns:           'patternAnalysis',
  patternList:        'patternAnalysis',
  pattern_list:       'patternAnalysis',
}

/**
 * Applies field-alias normalisation and one level of nesting unwrapping to a
 * parsed-but-unvalidated object from the LLM.
 *
 * Handles:
 *   • snake_case keys (decision_inventory → decisionInventory)
 *   • Common alias names (decisions → decisionInventory, patterns → patternAnalysis)
 *   • One-deep wrapper objects ({ data: { decisionInventory: [] } })
 *
 * Returns the normalised object — may still be missing required arrays if the
 * model returned genuinely incomplete data, in which case validation below will
 * throw a clear human-readable error.
 */
function normaliseResponse(raw: Record<string, unknown>): Record<string, unknown> {
  // Step 1 — try to unwrap one level of nesting.
  // Models occasionally wrap the result in { data: {...} }, { result: {...} }, etc.
  const wrappers = ['data', 'result', 'analysis', 'output', 'response', 'report']
  for (const key of wrappers) {
    const inner = raw[key]
    if (
      inner !== null &&
      typeof inner === 'object' &&
      !Array.isArray(inner) &&
      Array.isArray((inner as Record<string, unknown>).decisionInventory)
    ) {
      return inner as Record<string, unknown>
    }
  }

  // Step 2 — alias normalisation: copy aliased keys to canonical names.
  const out: Record<string, unknown> = { ...raw }
  for (const [alias, canonical] of Object.entries(FIELD_ALIASES)) {
    if (out[alias] !== undefined && out[canonical] === undefined) {
      out[canonical] = out[alias]
    }
  }

  return out
}

/**
 * Parses the raw JSON string returned by the LLM into a validated MariaResult.
 *
 * Defensive strategy (same as useSDK.ts / parseSpecBlock):
 *   1. Strip markdown code fences — both leading and any embedded fences.
 *   2. JSON.parse the cleaned string.
 *   3. If that fails, scan for the last (largest) `{…}` block to skip chatty prose.
 *   4. Apply field-alias normalisation + one-level nesting unwrap.
 *   5. Validate all four required arrays — throw with a clear message (including
 *      the actual keys returned) so the developer can diagnose model drift.
 *   6. Coerce scalar fields to their expected types.
 *   7. Ensure authorityGapNote is only present when authorityGapFlagged is true.
 *
 * @throws {Error} when the response cannot be parsed or is missing required structure.
 */
export function parseMariaResult(raw: string): MariaResult {
  // Strip ALL markdown code fences (some models insert them mid-response too).
  const cleaned = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Some models prepend prose before the JSON block.
    // Take the LAST (largest) {...} block — it's most likely the full result
    // rather than a small object from an opening sentence.
    const matches = [...cleaned.matchAll(/\{[\s\S]*?\}/g)]
    // Prefer the longest match — greedy scan of the entire string
    const bigMatch = cleaned.match(/\{[\s\S]*\}/)
    if (bigMatch) {
      try { parsed = JSON.parse(bigMatch[0]) } catch { /* fall through */ }
    }
    if (!parsed && matches.length > 0) {
      for (const m of matches.reverse()) {
        try { parsed = JSON.parse(m[0]); break } catch { /* continue */ }
      }
    }
    if (!parsed) {
      throw new Error(
        `Maria response is not valid JSON. First 400 chars:\n${raw.slice(0, 400)}`,
      )
    }
  }

  // Normalise field names before validation.
  const obj = normaliseResponse(parsed as Record<string, unknown>)

  // Structural validation — report the actual keys returned to aid diagnosis.
  const actualKeys = Object.keys(obj).join(', ')

  if (!Array.isArray(obj.decisionInventory)) {
    throw new Error(
      `Maria response is missing required array "decisionInventory". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  if (!Array.isArray(obj.authorityReport)) {
    throw new Error(
      `Maria response is missing required array "authorityReport". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  if (!Array.isArray(obj.governanceGaps)) {
    throw new Error(
      `Maria response is missing required array "governanceGaps". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  if (!Array.isArray(obj.patternAnalysis)) {
    throw new Error(
      `Maria response is missing required array "patternAnalysis". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }

  // Defensive coercion — ensure scalar fields are the expected types.
  if (typeof obj.generatedAt !== 'string') {
    obj.generatedAt = new Date().toISOString()
  }
  if (typeof obj.sourceWordCount !== 'number') {
    obj.sourceWordCount = 0
  }

  // Defensive: authorityGapNote must only appear when authorityGapFlagged is true.
  for (const d of obj.decisionInventory as Array<Record<string, unknown>>) {
    if (!d.authorityGapFlagged) delete d.authorityGapNote
  }

  return obj as unknown as MariaResult
}
