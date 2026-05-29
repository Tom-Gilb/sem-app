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

/**
 * Parses the raw JSON string returned by the LLM into a validated MariaResult.
 *
 * Defensive strategy (same as useSDK.ts / parseSpecBlock):
 *   1. Strip markdown code fences if the model added them.
 *   2. JSON.parse the cleaned string.
 *   3. If that fails, scan for the first `{…}` block (prose prefix from chatty models).
 *   4. Validate all four required arrays are present — throw with a clear message if not.
 *   5. Coerce scalar fields to their expected types (generatedAt → ISO string, sourceWordCount → number).
 *   6. Ensure authorityGapNote is only present when authorityGapFlagged is true.
 *
 * @throws {Error} when the response cannot be parsed or is missing required structure.
 */
export function parseMariaResult(raw: string): MariaResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Some models prepend prose before the JSON block — extract the first {...}.
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch { /* fall through */ }
    }
    if (!parsed) {
      throw new Error(`Maria response is not valid JSON:\n${raw.slice(0, 400)}`)
    }
  }

  const obj = parsed as Record<string, unknown>

  // Structural validation — all four arrays must be present.
  if (!Array.isArray(obj.decisionInventory)) {
    throw new Error('Maria response is missing required array: decisionInventory')
  }
  if (!Array.isArray(obj.authorityReport)) {
    throw new Error('Maria response is missing required array: authorityReport')
  }
  if (!Array.isArray(obj.governanceGaps)) {
    throw new Error('Maria response is missing required array: governanceGaps')
  }
  if (!Array.isArray(obj.patternAnalysis)) {
    throw new Error('Maria response is missing required array: patternAnalysis')
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
