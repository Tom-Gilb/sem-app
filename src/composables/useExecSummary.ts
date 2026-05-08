// UNIT_TYPE=Hook
// useExecSummary — Executive Summary export composable (Feature #44)

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'

/**
 * Composable for generating a plain-English executive summary of a Planguage spec.
 *
 * In live mode: calls the Anthropic API for a 3-sentence stakeholder summary.
 * In mock mode (no API key): generates the summary from spec content directly.
 */
export function useExecSummary(apiKey?: string) {
  const loading = ref(false)
  const summary = ref('')
  const error = ref('')

  async function generateSummary(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''
    summary.value = ''

    try {
      const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || !apiKey

      if (isMock) {
        await new Promise((r) => setTimeout(r, 500))

        const firstF = spec.functions[0]
        const firstV = spec.values[0]
        const firstS = spec.solutions[0]

        const fDesc = firstF
          ? firstF.description.slice(0, 80).toLowerCase()
          : 'the described outcome'
        const vScale = firstV ? firstV.scale : 'the target metric'
        const vGoal = firstV ? firstV.goal : 'the target level'
        const vStatus = firstV ? firstV.status : 'the current baseline'
        const sDesc = firstS
          ? firstS.description.slice(0, 80).toLowerCase()
          : 'the described approach'

        summary.value =
          `This initiative addresses ${fDesc}. ` +
          `Success is measured by ${vScale} reaching ${vGoal} from a current baseline of ${vStatus}. ` +
          `The approach involves ${sDesc}.`
        return
      }

      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const prompt = `You are a business analyst writing an executive summary.
In exactly 3 sentences (no more, no less), summarise this Planguage spec for a non-technical stakeholder.
Focus on: what problem is being solved, what measurable outcome is targeted, and how it will be achieved.
Avoid all technical jargon. Spec: ${JSON.stringify(spec)}`

      const response = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text block in exec summary response')
      }

      summary.value = textBlock.text.trim()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return { loading, summary, error, generateSummary }
}
