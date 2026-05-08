// UNIT_TYPE=Composable
// Feature #118 — Spec Sentiment Analyser
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'urgent'

export interface SentimentResult {
  block: SpecBlock
  label: SentimentLabel
  score: number
  keywords: string[]
  entryId: string
  entryType: string
}

const POSITIVE_KW = [
  'improve', 'enhance', 'increase', 'achieve', 'succeed',
  'optimise', 'benefit', 'deliver', 'enable', 'support',
]
const NEGATIVE_KW = [
  'fail', 'defect', 'error', 'risk', 'missing',
  'lack', 'insufficient', 'problem', 'issue', 'prevent',
]
const URGENT_KW = [
  'critical', 'immediate', 'urgent', 'asap', 'deadline',
  'block', 'must', 'required', 'mandatory', 'emergency',
]

function analyseText(text: string): {
  score: number
  label: SentimentLabel
  keywords: string[]
} {
  const lower = text.toLowerCase()
  const matched: string[] = []

  let positiveMatches = 0
  let negativeMatches = 0
  let urgentMatches = 0

  for (const kw of POSITIVE_KW) {
    if (lower.includes(kw)) {
      positiveMatches++
      matched.push(kw)
    }
  }
  for (const kw of NEGATIVE_KW) {
    if (lower.includes(kw)) {
      negativeMatches++
      matched.push(kw)
    }
  }
  for (const kw of URGENT_KW) {
    if (lower.includes(kw)) {
      urgentMatches++
      matched.push(kw)
    }
  }

  const score = positiveMatches - negativeMatches
  let label: SentimentLabel
  if (urgentMatches > 0) {
    label = 'urgent'
  } else if (score > 0) {
    label = 'positive'
  } else if (score < 0) {
    label = 'negative'
  } else {
    label = 'neutral'
  }

  return { score, label, keywords: matched }
}

export function useSpecSentiment(blocks: SpecBlock[]) {
  const results = computed<SentimentResult[]>(() => {
    const out: SentimentResult[] = []
    for (const block of blocks) {
      for (const f of block.functions) {
        const text = [f.id, f.description, f.successCriteria].join(' ')
        const { score, label, keywords } = analyseText(text)
        out.push({ block, label, score, keywords, entryId: f.id, entryType: 'Function' })
      }
      for (const v of block.values) {
        const text = [v.id, v.description, v.scale, v.goal, v.status].join(' ')
        const { score, label, keywords } = analyseText(text)
        out.push({ block, label, score, keywords, entryId: v.id, entryType: 'Value' })
      }
      for (const s of block.solutions) {
        const text = [s.id, s.description, s.impact].join(' ')
        const { score, label, keywords } = analyseText(text)
        out.push({ block, label, score, keywords, entryId: s.id, entryType: 'Solution' })
      }
    }
    return out
  })

  const distribution = computed<Record<SentimentLabel, number>>(() => {
    const d: Record<SentimentLabel, number> = { positive: 0, neutral: 0, negative: 0, urgent: 0 }
    for (const r of results.value) {
      d[r.label]++
    }
    return d
  })

  const dominantLabel = computed<SentimentLabel>(() => {
    const d = distribution.value
    let best: SentimentLabel = 'neutral'
    let bestCount = -1
    for (const key of Object.keys(d) as SentimentLabel[]) {
      if (d[key] > bestCount) {
        bestCount = d[key]
        best = key
      }
    }
    return best
  })

  const urgentEntries = computed<SentimentResult[]>(() =>
    results.value.filter(r => r.label === 'urgent'),
  )

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const header = '| Name | Label | Score | Keywords |'
    const sep = '|---|---|---|---|'
    const rows = results.value.map(
      r => `| ${r.entryId} | ${r.label} | ${r.score >= 0 ? '+' : ''}${r.score} | ${r.keywords.join(', ')} |`,
    )
    const text = [header, sep, ...rows].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    results,
    distribution,
    dominantLabel,
    urgentEntries,
    copyMarkdown,
    copied,
  }
}
