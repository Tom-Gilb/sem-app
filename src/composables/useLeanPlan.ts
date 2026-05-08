// UNIT_TYPE=Hook
// useLeanPlan — "Reduce Scope / Lean Plan" composable (Feature #28)

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'

/**
 * Composable for generating a lean minimum-viable plan from a full SpecBlock.
 *
 * Mock mode (VITE_MOCK_MODE=true or no API key):
 *   Returns a new SpecBlock with the first F., first V., and first S. entry,
 *   each with "[Lean] " prepended to their description.
 *
 * Live mode:
 *   Sends the spec to the LLM and asks it to identify the single highest-impact
 *   F./V./S. triplet delivering ~80% of the Goal with minimum effort.
 */
export function useLeanPlan(apiKey?: string) {
  const loading = ref(false)
  const leanSpec = ref<SpecBlock | null>(null)
  const error = ref('')

  async function reduceScopeToLean(spec: SpecBlock): Promise<SpecBlock | null> {
    if (!spec.functions.length || !spec.values.length || !spec.solutions.length) {
      // Empty/incomplete spec — return null without crash
      loading.value = false
      return null
    }

    loading.value = true
    error.value = ''
    leanSpec.value = null

    try {
      const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || !apiKey

      if (isMock) {
        await new Promise((r) => setTimeout(r, 800))

        const lean: SpecBlock = {
          functions: [
            {
              ...spec.functions[0],
              description: `[Lean] ${spec.functions[0].description}`,
            },
          ],
          values: [
            {
              ...spec.values[0],
              description: `[Lean] ${spec.values[0].description}`,
            },
          ],
          solutions: [
            {
              ...spec.solutions[0],
              description: `[Lean] ${spec.solutions[0].description}`,
            },
          ],
        }

        leanSpec.value = lean
        return lean
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const prompt = `You are a Planguage spec strategist. Given this spec, identify the SINGLE highest-impact F./V./S. triplet that would deliver 80% of the stated Goal with minimum effort.
Return a valid SpecBlock JSON with exactly 1 F entry, 1 V entry, 1 S entry — same schema as input.
Preserve all measurement fields on V. entries. Spec: ${JSON.stringify(spec)}
Return ONLY valid JSON — no prose, no markdown fences.`

      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text block in lean plan response')
      }

      const parsed = JSON.parse(textBlock.text.trim()) as SpecBlock
      leanSpec.value = parsed
      return parsed
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, leanSpec, error, reduceScopeToLean }
}
