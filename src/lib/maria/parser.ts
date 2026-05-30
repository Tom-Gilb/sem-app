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
  // decisionInventory variants — the LLM drifts toward many synonyms for this key
  decisions:               'decisionInventory',
  decision_inventory:      'decisionInventory',
  decisionList:            'decisionInventory',
  decision_list:           'decisionInventory',
  // Observed in production (2026-05-30): model returned boardActions / decisionTimeline
  // / derivedDecisionData instead of decisionInventory. All three map here.
  boardActions:            'decisionInventory',
  board_actions:           'decisionInventory',
  decisionTimeline:        'decisionInventory',
  decision_timeline:       'decisionInventory',
  derivedDecisionData:     'decisionInventory',
  derivedDecisions:        'decisionInventory',
  derivedDecisionDetails:  'decisionInventory',
  derivedDecisionDa:       'decisionInventory', // truncated variant seen in error log
  boardDecisions:          'decisionInventory',
  board_decisions:         'decisionInventory',
  decisionLog:             'decisionInventory',
  decision_log:            'decisionInventory',
  // authorityReport variants
  authority_report:        'authorityReport',
  authorityGaps:           'authorityReport',
  authority_gaps:          'authorityReport',
  authorityEntries:        'authorityReport',
  authorityClarity:        'authorityReport',
  authority_clarity:       'authorityReport',
  // governanceGaps variants
  governance_gaps:         'governanceGaps',
  gaps:                    'governanceGaps',
  governmentGaps:          'governanceGaps', // typo the model occasionally produces
  governanceGaves:         'governanceGaps', // typo (missing 'p') seen 2026-05-30
  governanceIssues:        'governanceGaps',
  governance_issues:       'governanceGaps',
  missingDecisions:        'governanceGaps',
  // patternAnalysis variants
  pattern_analysis:        'patternAnalysis',
  patterns:                'patternAnalysis',
  patternList:             'patternAnalysis',
  pattern_list:            'patternAnalysis',
  governancePatterns:      'patternAnalysis',
  governance_patterns:     'patternAnalysis',
}

/**
 * All known key names the LLM might use to carry decision-inventory data.
 * Used by the merge fallback when no single alias resolves to decisionInventory.
 * If the LLM splits decisions across MULTIPLE arrays, this concatenates them.
 */
const _DECISION_MERGE_CANDIDATES = [
  'boardActions', 'board_actions', 'decisionTimeline', 'decision_timeline',
  'derivedDecisionData', 'derivedDecisions', 'derivedDecisionDetails', 'derivedDecisionDa',
  'boardDecisions', 'board_decisions', 'decisionLog', 'decision_log',
  'decisions', 'decisionList', 'decision_list', 'decision_inventory',
]

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

  // Step 3 — decisionInventory merge fallback.
  // If decisionInventory is STILL missing after alias normalisation, the LLM may
  // have split decision data across multiple keys (observed in production 2026-05-30:
  // model returned boardActions + decisionTimeline + derivedDecisionData separately).
  // Concatenate all candidate arrays into a single decisionInventory.
  if (!Array.isArray(out.decisionInventory)) {
    const merged: unknown[] = []
    for (const key of _DECISION_MERGE_CANDIDATES) {
      if (Array.isArray(out[key]) && (out[key] as unknown[]).length > 0) {
        merged.push(...(out[key] as unknown[]))
      }
    }
    if (merged.length > 0) {
      out.decisionInventory = merged
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
  console.log('[Maria Parser] Starting parse, raw length:', raw.length)

  // Strip ALL markdown code fences (some models insert them mid-response too).
  console.log('[Maria Parser] Stripping markdown fences...')
  const cleaned = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  console.log('[Maria Parser] After strip, cleaned length:', cleaned.length)

  let parsed: unknown
  try {
    console.log('[Maria Parser] Attempting JSON.parse on cleaned string...')
    parsed = JSON.parse(cleaned)
    console.log('[Maria Parser] JSON.parse succeeded on first try')
  } catch (e) {
    console.log('[Maria Parser] JSON.parse failed, trying to extract first {...} block...')
    // OPTIMIZATION (2026-05-30): Skip expensive matchAll fallback.
    // If JSON.parse fails on the full cleaned string, try extracting the first {...} block only.
    // This is much faster than matchAll for large responses, and covers 99% of cases
    // where the LLM wraps the JSON in a single data/result/output wrapper.
    const bracketMatch = cleaned.match(/\{[\s\S]*\}/)
    if (bracketMatch) {
      try {
        console.log('[Maria Parser] Trying to parse extracted {...} block...')
        parsed = JSON.parse(bracketMatch[0])
        console.log('[Maria Parser] Extracted block parse succeeded')
      } catch (e2) {
        console.log('[Maria Parser] Extracted block parse also failed')
        throw new Error(
          `Maria response is not valid JSON. First 400 chars:\n${raw.slice(0, 400)}`,
        )
      }
    } else {
      throw new Error(
        `Maria response is not valid JSON. First 400 chars:\n${raw.slice(0, 400)}`,
      )
    }
  }

  console.log('[Maria Parser] Parsed object obtained, running normaliseResponse...')
  // Normalise field names before validation.
  const obj = normaliseResponse(parsed as Record<string, unknown>)
  console.log('[Maria Parser] normaliseResponse complete')

  // Structural validation — report the actual keys returned to aid diagnosis.
  console.log('[Maria Parser] Starting validation...')
  const actualKeys = Object.keys(obj).join(', ')
  console.log('[Maria Parser] Actual top-level keys:', actualKeys)

  if (!Array.isArray(obj.decisionInventory)) {
    throw new Error(
      `Maria response is missing required array "decisionInventory". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  console.log('[Maria Parser] ✓ decisionInventory found, length:', (obj.decisionInventory as unknown[]).length)

  if (!Array.isArray(obj.authorityReport)) {
    throw new Error(
      `Maria response is missing required array "authorityReport". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  console.log('[Maria Parser] ✓ authorityReport found, length:', (obj.authorityReport as unknown[]).length)

  if (!Array.isArray(obj.governanceGaps)) {
    throw new Error(
      `Maria response is missing required array "governanceGaps". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  console.log('[Maria Parser] ✓ governanceGaps found, length:', (obj.governanceGaps as unknown[]).length)

  if (!Array.isArray(obj.patternAnalysis)) {
    throw new Error(
      `Maria response is missing required array "patternAnalysis". ` +
      `Actual top-level keys: [${actualKeys}]`,
    )
  }
  console.log('[Maria Parser] ✓ patternAnalysis found, length:', (obj.patternAnalysis as unknown[]).length)

  // Defensive coercion — ensure scalar fields are the expected types.
  console.log('[Maria Parser] Running defensive coercions...')
  if (typeof obj.generatedAt !== 'string') {
    obj.generatedAt = new Date().toISOString()
  }
  if (typeof obj.sourceWordCount !== 'number') {
    obj.sourceWordCount = 0
  }

  // Defensive: authorityGapNote must only appear when authorityGapFlagged is true.
  console.log('[Maria Parser] Cleaning authorityGapNote fields...')
  for (const d of obj.decisionInventory as Array<Record<string, unknown>>) {
    if (!d.authorityGapFlagged) delete d.authorityGapNote
  }
  console.log('[Maria Parser] ✓ Parse complete, returning MariaResult')

  return obj as unknown as MariaResult
}
