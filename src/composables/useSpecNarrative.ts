// UNIT_TYPE=Composable
// Feature #63 — Spec narrative export
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export function useSpecNarrative(_apiKey?: string) {
  const narrative = ref('')
  const loading = ref(false)
  const error = ref('')
  const copied = ref(false)

  function buildMockNarrative(spec: SpecBlock): string {
    const sections: string[] = []

    // Opening: what we're building
    const funcs = spec.functions.slice(0, 2)
    if (funcs.length > 0) {
      const fDesc = funcs.map(f => f.description.toLowerCase()).join(' and ')
      sections.push(`This initiative will deliver ${fDesc}.`)
    }

    // Value impact: what success looks like
    const vals = spec.values.slice(0, 3)
    if (vals.length > 0) {
      const vParts = vals.map(v => {
        const goal = v.goal ? `reaching ${v.goal}` : 'improving measurably'
        return `${v.description.toLowerCase()} (${goal})`
      })
      sections.push(`The expected outcomes include ${vParts.join(', ')}.`)
    }

    // Solution path: how we'll get there
    const sols = spec.solutions.slice(0, 2)
    if (sols.length > 0) {
      const sParts = sols.map(s => s.description.toLowerCase()).join(' and ')
      sections.push(`The primary approach involves ${sParts}.`)
    }

    // Closing
    const totalEntries = spec.functions.length + spec.values.length + spec.solutions.length
    sections.push(`This specification encompasses ${totalEntries} requirements across ${spec.functions.length} functions, ${spec.values.length} values, and ${spec.solutions.length} solutions.`)

    return sections.join(' ')
  }

  async function generateNarrative(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''
    narrative.value = ''

    if (!_apiKey || import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 400))
      narrative.value = buildMockNarrative(spec)
    } else {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey: _apiKey, dangerouslyAllowBrowser: true })
        const specText = JSON.stringify(spec, null, 2).slice(0, 3000)
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 400,
          system: 'Write a 3–4 sentence plain-English narrative describing what this Planguage spec aims to achieve, for a non-technical executive audience. Be direct and concrete. No bullet points.',
          messages: [{ role: 'user', content: specText }],
        })
        narrative.value = msg.content[0].type === 'text' ? msg.content[0].text : ''
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Narrative failed'
      }
    }
    loading.value = false
  }

  async function copyNarrative(): Promise<void> {
    if (!narrative.value) return
    try {
      await navigator.clipboard.writeText(narrative.value)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch { /* ignore */ }
  }

  return { narrative, loading, error, copied, generateNarrative, copyNarrative }
}
