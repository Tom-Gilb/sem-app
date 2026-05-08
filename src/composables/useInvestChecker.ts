// UNIT_TYPE=Composable
// Feature #111 — INVEST checker
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export const INVEST_CRITERIA = [
  'Independent',
  'Negotiable',
  'Valuable',
  'Estimable',
  'Small',
  'Testable',
] as const

export interface InvestResult {
  block: SpecBlock
  scores: Record<string, boolean>  // e.g. { Independent: true, Negotiable: false, ... }
  total: number  // 0–6
}

export function mockScoreForBlock(block: SpecBlock): Record<string, boolean> {
  // Use charCode sum of all value entry names as seed
  const name = block.values.map(v => v.id).join('')
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const scores: Record<string, boolean> = {}
  INVEST_CRITERIA.forEach((criterion, idx) => {
    scores[criterion] = (seed + idx) % 3 !== 0
  })
  return scores
}

export function useInvestChecker(spec: Ref<SpecBlock | null>, apiKey: string) {
  const results = ref<InvestResult[]>([])
  const checking = ref(false)

  async function check(): Promise<void> {
    const currentSpec = spec.value
    if (!currentSpec) {
      results.value = []
      return
    }

    const blocks = [currentSpec]
    checking.value = true

    const isMock = !apiKey || import.meta.env.VITE_MOCK_MODE === 'true'

    if (isMock) {
      results.value = blocks.map(block => {
        const scores = mockScoreForBlock(block)
        const total = Object.values(scores).filter(Boolean).length
        return { block, scores, total }
      })
      checking.value = false
      return
    }

    // Live mode: single Anthropic call (claude-haiku-4-5) with all V. entries
    try {
      const allValues = blocks.flatMap(b => b.values)
      const valueList = allValues
        .map(v => `- ${v.id}: ${v.description}`)
        .join('\n')

      const prompt = `You are a software delivery expert. For each value entry below, evaluate it against the INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable). Return a JSON object mapping each value entry ID to an object with boolean fields for each criterion.

Value entries:
${valueList}

Return ONLY valid JSON in this format:
{
  "V.ExampleId": { "Independent": true, "Negotiable": false, "Valuable": true, "Estimable": true, "Small": false, "Testable": true },
  ...
}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      const text = data.content?.[0]?.text || '{}'
      const parsed = JSON.parse(text) as Record<string, Record<string, boolean>>

      results.value = blocks.map(block => {
        // Aggregate scores across all V. entries in this block
        const blockValues = block.values
        if (blockValues.length === 0) {
          const scores = mockScoreForBlock(block)
          return { block, scores, total: Object.values(scores).filter(Boolean).length }
        }
        // Majority vote per criterion across all V. entries in block
        const scores: Record<string, boolean> = {}
        INVEST_CRITERIA.forEach(criterion => {
          const passes = blockValues.filter(v => parsed[v.id]?.[criterion] === true).length
          scores[criterion] = passes > blockValues.length / 2
        })
        const total = Object.values(scores).filter(Boolean).length
        return { block, scores, total }
      })
    } catch {
      // Fallback to mock on API error
      results.value = blocks.map(block => {
        const scores = mockScoreForBlock(block)
        const total = Object.values(scores).filter(Boolean).length
        return { block, scores, total }
      })
    } finally {
      checking.value = false
    }
  }

  function copyMarkdown(): void {
    if (!results.value.length) return
    const header = `| Block | ${INVEST_CRITERIA.join(' | ')} | Total |`
    const separator = `|---|${INVEST_CRITERIA.map(() => '---').join('|')}|---|`
    const rows = results.value.map(r => {
      const blockName = r.block.values[0]?.id || r.block.functions[0]?.id || 'Unknown'
      const cells = INVEST_CRITERIA.map(c => (r.scores[c] ? '✅' : '❌'))
      return `| ${blockName} | ${cells.join(' | ')} | ${r.total}/6 |`
    })
    const text = [header, separator, ...rows].join('\n')
    try {
      navigator.clipboard.writeText(text)
    } catch {
      // clipboard not available
    }
  }

  return { results, checking, check, copyMarkdown }
}
