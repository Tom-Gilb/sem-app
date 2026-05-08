// UNIT_TYPE=Hook
// useChallenge — AI "Challenge This" composable (Feature #13)

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'

const MOCK_CHALLENGES = [
  'V.MockValue — Goal of "90%" is not measurable without a baseline Status value. Add a current-state measurement date.',
  'V.MockValue — Meter relies on manual review: replace with an automated tracking mechanism to avoid measurement gaps.',
  'F.MockFunction — Success Criteria lacks a time-box. Specify by which date or sprint the criterion must be met.',
  'S.MockSolution — Impact estimate "~70%" is not justified. Link it to a specific Scale unit and data source.',
]

/**
 * Composable for the "Challenge This" AI review of a Planguage spec.
 *
 * In live mode: calls the Anthropic API and returns 4 specific improvement suggestions.
 * In mock mode (no API key): returns hardcoded example suggestions immediately.
 */
export function useChallenge(apiKey?: string) {
  const loading = ref(false)
  const challenges = ref<string[]>([])
  const error = ref('')

  async function challengeSpec(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''
    challenges.value = []

    try {
      const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || !apiKey

      if (isMock) {
        await new Promise((r) => setTimeout(r, 600))
        challenges.value = MOCK_CHALLENGES
        return
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const prompt = `You are a Planguage specification expert.
Review this Planguage spec and return EXACTLY 4 specific, actionable improvements as a JSON array of strings.
Focus on: missing measurability, vague Goals, weak Meters, unrealistic Scale.
Spec: ${JSON.stringify(spec)}
Return ONLY valid JSON: ["improvement 1", "improvement 2", ...]`

      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text block in challenge response')
      }

      const parsed = JSON.parse(textBlock.text.trim()) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('Challenge response was not a JSON array')
      }
      challenges.value = parsed as string[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return { loading, challenges, error, challengeSpec }
}
