// UNIT_TYPE=Hook
// usePeerReview — Adversarial AI peer review composable (Feature #43)

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'

export interface PeerReviewComment {
  target: string
  type: 'assumption' | 'ambiguity' | 'risk' | 'contradiction'
  comment: string
  severity: 'high' | 'medium' | 'low'
}

const MOCK_COMMENTS: PeerReviewComment[] = [
  {
    target: 'V.MockValue.goal',
    type: 'assumption',
    comment: 'This Goal assumes current market conditions remain stable — no contingency for downturns.',
    severity: 'high',
  },
  {
    target: 'V.MockValue.meter',
    type: 'risk',
    comment: 'Manual review meter can be gamed by the team doing the measuring — consider third-party validation.',
    severity: 'medium',
  },
  {
    target: 'F.MockFunction.description',
    type: 'ambiguity',
    comment: "'Deliver the outcome' is circular — it doesn't specify HOW the function causes the value.",
    severity: 'high',
  },
  {
    target: 'S.MockSolution.impact',
    type: 'contradiction',
    comment: 'The impact claim (70%) is inconsistent with the Tolerable level (70%) — at Tolerable you\'re at the minimum, not delivering impact.',
    severity: 'medium',
  },
  {
    target: 'V.MockValue.scale',
    type: 'ambiguity',
    comment: "The Scale doesn't specify a time window — 'improvement' over what period?",
    severity: 'low',
  },
]

/**
 * Composable for the "Peer Review" adversarial AI critique of a Planguage spec.
 *
 * In live mode: calls the Anthropic API to identify 5 specific weaknesses.
 * In mock mode (no API key): returns hardcoded example comments immediately.
 */
export function usePeerReview(apiKey?: string) {
  const loading = ref(false)
  const comments = ref<PeerReviewComment[]>([])
  const error = ref('')

  async function reviewSpec(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''
    comments.value = []

    try {
      const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || !apiKey

      if (isMock) {
        await new Promise((r) => setTimeout(r, 700))
        comments.value = MOCK_COMMENTS
        return
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const prompt = `You are a sceptical peer reviewer stress-testing a Planguage specification.
Identify 5 specific weaknesses using these types:
- assumption: an unstated assumption that may not hold
- ambiguity: a term or value that is unclear or context-dependent
- risk: a Goal or Meter that may be gamed or hard to measure honestly
- contradiction: inconsistency between two entries
Return JSON array: [{ target, type, comment, severity }, ...]
Target format: 'EntryId.fieldName'. Spec: ${JSON.stringify(spec)}`

      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text block in peer review response')
      }

      const parsed = JSON.parse(textBlock.text.trim()) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('Peer review response was not a JSON array')
      }
      comments.value = parsed as PeerReviewComment[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return { loading, comments, error, reviewSpec }
}
