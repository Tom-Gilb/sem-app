// UNIT_TYPE=Hook
// useSpecCoach — AI Spec Coach composable (Feature #35)
// Provides a conversational interface for asking questions about a generated SpecBlock.

import { ref } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import { parseApiError } from '../utils/parseApiError'

export interface CoachMessage {
  id: string
  role: 'user' | 'coach'
  text: string
  timestamp: number
}

const COACH_SYSTEM_PROMPT =
  'You are a Planguage specification expert and coach. The user has a generated spec' +
  ' (provided as JSON context). Answer their question about the spec in 2-3 sentences.' +
  ' Be specific and reference actual values from the spec. Focus on: measurability,' +
  ' Scale/Meter/Goal clarity, and practical improvement suggestions.'

function getMockResponse(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('scale')) {
    return "The Scale defines what you're measuring. Make sure it's a specific, observable dimension — like '% completion rate' rather than 'satisfaction'."
  }
  if (q.includes('meter')) {
    return "The Meter describes HOW you'll measure Scale. It should specify frequency, who measures, and what tool — e.g. 'Monthly survey of 50 users via Typeform'."
  }
  if (q.includes('goal')) {
    return 'Your Goal should be ambitious but achievable — the ideal outcome if everything goes right. Benchmark against industry data or past performance where possible.'
  }
  if (q.includes('tolerable')) {
    return "The Tolerable level is your minimum acceptable outcome. Below this, the feature has failed. Set it at the level where you'd consider cancelling the initiative."
  }
  return "That's a great question about your spec. The key is to ensure every V. entry has a measurable Scale, a concrete Meter, and distinct Goal vs. Tolerable levels."
}

export function useSpecCoach() {
  const messages = ref<CoachMessage[]>([])
  const loading = ref(false)
  const error = ref('')

  async function ask(question: string, spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''

    // Append user message immediately
    const userMsg: CoachMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user',
      text: question,
      timestamp: Date.now(),
    }
    messages.value = [...messages.value, userMsg]

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

      let responseText: string

      if (!apiKey || import.meta.env.VITE_MOCK_MODE === 'true') {
        // Mock mode: return canned response based on keyword
        await new Promise((r) => setTimeout(r, 600))
        responseText = getMockResponse(question)
      } else {
        const client = new Anthropic({
          apiKey,
          dangerouslyAllowBrowser: true,
          timeout: 90_000,
        })
        const specContext = `Here is the user's spec as JSON:\n${JSON.stringify(spec, null, 2)}`

        // Build conversation history: include all prior turns so follow-up
        // questions have context. CoachMessage.role 'coach' → 'assistant' in API.
        const history: Array<{ role: 'user' | 'assistant'; content: string }> =
          messages.value.map((m) => ({
            role: m.role === 'coach' ? 'assistant' : 'user',
            content: m.text,
          }))
        // The current question was already appended to messages.value above
        // but we reconstruct from history so we don't double-send — history
        // now includes it as the last element.

        const response = await client.messages.create({
          model: MODEL_ID,
          max_tokens: 1024,
          system: `${COACH_SYSTEM_PROMPT}\n\n${specContext}`,
          messages: history,
        })

        const textBlock = response.content.find((b) => b.type === 'text')
        responseText =
          textBlock && textBlock.type === 'text'
            ? textBlock.text.trim()
            : 'Sorry, I could not generate a response.'
      }

      const coachMsg: CoachMessage = {
        id: `coach-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'coach',
        text: responseText,
        timestamp: Date.now(),
      }
      messages.value = [...messages.value, coachMsg]
    } catch (err) {
      const parsed = parseApiError(err)
      error.value = `${parsed.title}: ${parsed.detail}`
      if (parsed.actionUrl) error.value += ` (${parsed.actionUrl})`
    } finally {
      loading.value = false
    }
  }

  return { messages, loading, error, ask }
}
