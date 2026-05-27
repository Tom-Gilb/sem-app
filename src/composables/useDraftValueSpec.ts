/**
 * useDraftValueSpec — AI-powered drafting of missing Value specification fields
 *
 * Provides functions to draft missing Value fields (scale, tolerable, wish) using:
 * - Claude API in live mode (calls with entry context + Functions list + format examples)
 * - Pattern-detection heuristics in mock mode (no API calls)
 *
 * Emits results as DraftResult objects that can be individually accepted/rejected
 * with optional uncertainty markers (?) to indicate provisional/speculative values.
 *
 * Source: Evo Step 12 (Stage 2 refinement), DD-008 (2026-05-27)
 */

import { ref, computed } from 'vue'
import type { VEntry, SpecBlock } from '../types/spec'
import { useAnthropicKey } from './useAnthropicKey'

export interface DraftResult {
  entryId: string
  scale: string
  tolerable: string
  wish: string
}

// ── Composable state ──────────────────────────────────────────────────────────

const loading = ref(false)
const error = ref<string | null>(null)
const draftResult = ref<DraftResult | null>(null)

const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true'

// ── Mock mode: pattern-detection heuristics ──────────────────────────────────
//
// When no real Claude API is available, guess reasonable defaults based on
// entry description keywords. Examples:
//   "Response time" → milliseconds
//   "Cost" → dollars
//   "Quality" → percentage
//
// This demonstrates the feature without requiring API key setup during testing.

function mockDraftValue(entry: VEntry): DraftResult {
  const desc = (entry.description || '').toLowerCase()

  // Infer scale/units from keywords in the description
  let scale = 'count'
  let unit = ''

  if (desc.includes('time') || desc.includes('latency') || desc.includes('speed')) {
    scale = 'milliseconds'
    unit = 'ms'
  } else if (desc.includes('cost') || desc.includes('price') || desc.includes('budget') || desc.includes('expense')) {
    scale = 'USD'
    unit = '$'
  } else if (desc.includes('quality') || desc.includes('satisfaction') || desc.includes('rating')) {
    scale = 'percent'
    unit = '%'
  } else if (desc.includes('availability') || desc.includes('uptime') || desc.includes('reliability')) {
    scale = 'percent'
    unit = '%'
  } else if (desc.includes('memory') || desc.includes('storage') || desc.includes('capacity')) {
    scale = 'megabytes'
    unit = 'MB'
  }

  // Heuristic tolerable/wish values based on scale
  const baseTolerable = unit === '%' ? '80%' : unit === 'ms' ? '500ms' : unit === '$' ? '10000$' : '50'
  const baseWish = unit === '%' ? '95%' : unit === 'ms' ? '100ms' : unit === '$' ? '5000$' : '100'

  return {
    entryId: entry.id,
    scale: scale,
    tolerable: baseTolerable,
    wish: baseWish,
  }
}

// ── Live mode: Claude API calls ───────────────────────────────────────────────
//
// Call Claude with:
// 1. Entry description + ID
// 2. List of all Functions (for context on what this Value enables)
// 3. Format examples showing what good scale/tolerable/wish look like

async function apiDraftValue(
  entry: VEntry,
  functions: SpecBlock['functions'],
  apiKey: string,
): Promise<DraftResult> {
  const functionsText = functions
    .map(f => `- ${f.id}: ${f.description}`)
    .join('\n')

  const prompt = `You are a Planguage planning expert. A user is drafting a Value entry and needs help completing the missing fields.

Value Entry:
- ID: ${entry.id}
- Description: ${entry.description}
- Current scale: ${entry.scale || '(not set)'}
- Current tolerable: ${entry.tolerable || '(not set)'}
- Current wish: ${entry.wish || '(not set)'}

Functions this Value affects:
${functionsText}

Please suggest ONLY the missing fields. Return a JSON object with exactly these fields (all required, use empty string "" if unknown):
{
  "scale": "unit/measurement (e.g., 'milliseconds', 'USD', 'percent', 'count')",
  "tolerable": "minimum acceptable value (e.g., '500ms', '80%', '1000 users')",
  "wish": "goal/target value (e.g., '100ms', '99%', '10000 users')"
}

Return ONLY valid JSON, no markdown fence or explanatory text.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>
  }
  const text = data.content[0]?.text || '{}'
  const parsed = JSON.parse(text) as {
    scale?: string
    tolerable?: string
    wish?: string
  }

  return {
    entryId: entry.id,
    scale: parsed.scale || '',
    tolerable: parsed.tolerable || '',
    wish: parsed.wish || '',
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function useDraftValueSpec() {
  const { apiKey } = useAnthropicKey()

  /**
   * Draft missing fields for a single Value entry.
   * Returns a DraftResult that the caller can accept/reject/edit.
   */
  async function draftOne(
    entry: VEntry,
    spec: SpecBlock,
  ): Promise<DraftResult> {
    loading.value = true
    error.value = null

    try {
      let result: DraftResult

      if (isMockMode || !apiKey.value) {
        result = mockDraftValue(entry)
      } else {
        result = await apiDraftValue(entry, spec.functions, apiKey.value)
      }

      draftResult.value = result
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Draft all incomplete Values in a spec (bulk operation).
   * Returns an array of DraftResults keyed by entry ID.
   */
  async function draftAllIncomplete(spec: SpecBlock): Promise<Record<string, DraftResult>> {
    loading.value = true
    error.value = null
    const results: Record<string, DraftResult> = {}

    try {
      const incompleteEntries = spec.values.filter(v => {
        const missing = [
          !v.scale,
          !v.tolerable,
          !v.wish,
        ].filter(Boolean).length
        return missing > 0
      })

      for (const entry of incompleteEntries) {
        try {
          const result = await draftOne(entry, spec)
          results[entry.id] = result
        } catch (err) {
          // Log individual failures but continue with others
          console.warn(`Failed to draft ${entry.id}:`, err)
        }
      }

      return results
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    draftResult: computed(() => draftResult.value),

    // Methods
    draftOne,
    draftAllIncomplete,
  }
}
