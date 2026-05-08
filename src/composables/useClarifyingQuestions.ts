// UNIT_TYPE=Hook
// useClarifyingQuestions — AI-generated clarifying questions to sharpen SEM input
// before spec translation. Real mode: Anthropic API. Mock mode: static fallback.

import { ref } from 'vue'
import { useLoadingState } from './useLoadingState'

const MOCK_QUESTIONS: string[] = [
  'What specific metric or KPI will indicate success? (e.g. %, count, time, score)',
  'What is the target timeline for this outcome? (e.g. by Q3, within 6 months)',
  'Who is the primary stakeholder most directly impacted?',
  'What is the current baseline measurement, if known?',
  'Are there any known constraints — budget, technology, or team size — on the approach?',
]

/**
 * Composable that calls the Anthropic API to generate 3–5 clarifying questions
 * for a SEM (Stakes, Ends, Means) entry. Falls back to MOCK_QUESTIONS on error
 * or when VITE_MOCK_MODE=true.
 */
export function useClarifyingQuestions() {
  const questions = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { startLoading, stopLoading } = useLoadingState()

  async function generateQuestions(payload: {
    stakes: string
    ends: string
    means: string
  }): Promise<void> {
    loading.value = true
    error.value = null
    questions.value = []
    startLoading('clarify:generate', 'Generating questions…')

    try {
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise((r) => setTimeout(r, 700))
        questions.value = [...MOCK_QUESTIONS]
        return
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
        dangerouslyAllowBrowser: true,
        timeout: 30_000, // 30s — questions are short; fall back to mock on timeout
      })

      const userContent =
        `You are a Planguage specification assistant. Given the SEM entry below, ` +
        `return ONLY a JSON array of 3 to 5 short clarifying questions that would make the spec ` +
        `more precise and measurable. Focus on: success metrics, measurement methods, timelines, ` +
        `stakeholder specifics, and scope boundaries. No other text.\n\n` +
        `Stakes: ${payload.stakes}\nEnds: ${payload.ends}\nMeans: ${payload.means}`

      const response = await client.messages.create({
        model: (import.meta.env.VITE_ANTHROPIC_MODEL as string) ?? 'claude-sonnet-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: userContent }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text response')

      const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array')

      questions.value = (parsed as unknown[])
        .filter((q): q is string => typeof q === 'string')
        .slice(0, 5)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not generate questions'
      questions.value = [...MOCK_QUESTIONS]
    } finally {
      loading.value = false
      stopLoading('clarify:generate')
    }
  }

  return { questions, loading, error, generateQuestions }
}
