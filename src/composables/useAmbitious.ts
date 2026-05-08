// UNIT_TYPE=Hook
// useAmbitious — "Make It More Ambitious" composable (Feature #19)
// Change 2: auto-populates ambitionLevel on each V. entry when Make Ambitious fires.

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock, VEntry, AmbitionLevelEntry } from '../types/spec'

/**
 * Attempts to parse a numeric value from a Planguage Goal string.
 * Returns null if no number is found.
 */
function extractNumeric(goal: string): number | null {
  const match = goal.match(/[\d]+(?:\.\d+)?/)
  return match ? parseFloat(match[0]) : null
}

/**
 * Builds the app-sourced AmbitionLevelEntry label for a Make Ambitious operation.
 * Format: "Make Ambitious — YYYY-MM-DD HH:MM"
 */
function makeAmbitiousLabel(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5)
  return `Make Ambitious — ${date} ${time}`
}

/**
 * Merges a new app-sourced AmbitionLevelEntry into an existing list.
 * Appends; does not replace so Mode A + Mode B coexist.
 */
function appendAmbitionEntry(
  existing: AmbitionLevelEntry[] | undefined,
  newEntry: AmbitionLevelEntry,
): AmbitionLevelEntry[] {
  return [...(existing ?? []), newEntry]
}

/**
 * Doubles numeric goal values in mock mode.
 * Non-numeric goals get a static ambitious restatement.
 * Change 2: appends an app-sourced AmbitionLevelEntry to each V. entry.
 */
function mockDoubleGoals(spec: SpecBlock): SpecBlock {
  const label = makeAmbitiousLabel()
  return {
    ...spec,
    values: spec.values.map((v): VEntry => {
      const numeric = extractNumeric(v.goal)
      const newGoal = numeric !== null
        ? v.goal.replace(/[\d]+(?:\.\d+)?/, String(numeric * 2))
        : `${v.goal} (2× target)`
      const appEntry: AmbitionLevelEntry = { source: 'app', label }
      return {
        ...v,
        goal: newGoal,
        ambitionLevel: appendAmbitionEntry(v.ambitionLevel, appEntry),
      }
    }),
  }
}

/**
 * Composable for rewriting Goal levels to be approximately 2× more ambitious.
 *
 * In live mode: calls the Anthropic API to rewrite Goal fields.
 * In mock mode (no API key / VITE_MOCK_MODE): doubles numeric goals locally.
 */
export function useAmbitious(apiKey?: string) {
  const loading = ref(false)
  const result = ref<SpecBlock | null>(null)
  const error = ref('')

  async function makeAmbitious(spec: SpecBlock): Promise<SpecBlock | null> {
    loading.value = true
    error.value = ''
    result.value = null

    try {
      const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || !apiKey

      if (isMock) {
        await new Promise((r) => setTimeout(r, 800))
        const ambitious = mockDoubleGoals(spec)
        result.value = ambitious
        return ambitious
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const label = makeAmbitiousLabel()
      const prompt = `You are a Planguage spec writer. Take this spec and rewrite ONLY the Goal levels for each V. entry, making them approximately 2× more ambitious (but still realistic).
Keep all other fields identical. Return the complete spec as valid JSON in the same format as the input.
For each V. entry, set "ambitionLevel" to an array with one object: { "source": "app", "label": "${label}" }.
If the entry already has an ambitionLevel array, append to it rather than replacing.
Input spec: ${JSON.stringify(spec)}
Return ONLY valid JSON — no prose, no markdown fences.`

      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text block in ambitious response')
      }

      const parsed = JSON.parse(textBlock.text.trim()) as SpecBlock
      result.value = parsed
      return parsed
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, result, error, makeAmbitious }
}
