// UNIT_TYPE=Composable
// Feature #129 — Spec Innovation Score
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface InnovationScore {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  topTerms: string[]
  breakdown: { category: string; matched: number; weight: number }[]
}

const AI_ML_TERMS = [
  'ai', 'ml', 'machine learning', 'neural', 'llm', 'gpt', 'model', 'inference',
  'embedding', 'prediction', 'classification', 'transformer', 'generative', 'anthropic', 'openai',
]

const NOVEL_TECH_TERMS = [
  'blockchain', 'edge computing', 'quantum', 'microservices', 'serverless', 'webassembly',
  'wasm', 'stream', 'real-time', 'distributed', 'kubernetes', 'container', 'vector', 'semantic',
]

const FORWARD_LOOKING_TERMS = [
  'automate', 'autonomous', 'self-', 'intelligent', 'adaptive', 'dynamic', 'evolve',
  'scale', 'future', 'next-gen', 'emerging', 'innovative', 'transform', 'disrupt',
]

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

export function useInnovationScore(blocks: SpecBlock[]) {
  const innovationScore = computed<InnovationScore>(() => {
    if (blocks.length === 0) {
      return {
        score: 0,
        grade: 'F',
        topTerms: [],
        breakdown: [
          { category: 'AI/ML', matched: 0, weight: 3 },
          { category: 'Novel Tech', matched: 0, weight: 2 },
          { category: 'Forward-looking', matched: 0, weight: 1 },
        ],
      }
    }

    // Collect all text from F., V., S. entries
    const texts: string[] = []
    for (const block of blocks) {
      for (const f of block.functions) {
        texts.push(f.id.toLowerCase(), f.description.toLowerCase())
      }
      for (const v of block.values) {
        texts.push(v.id.toLowerCase(), v.description.toLowerCase())
      }
      for (const s of block.solutions) {
        texts.push(s.id.toLowerCase(), s.description.toLowerCase())
      }
    }
    const fullText = texts.join(' ')

    // Count term frequencies
    const termFrequency: Record<string, number> = {}

    let aiMatched = 0
    let novelMatched = 0
    let forwardMatched = 0

    for (const term of AI_ML_TERMS) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const count = (fullText.match(regex) ?? []).length
      if (count > 0) {
        aiMatched += count
        termFrequency[term] = (termFrequency[term] ?? 0) + count
      }
    }

    for (const term of NOVEL_TECH_TERMS) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const count = (fullText.match(regex) ?? []).length
      if (count > 0) {
        novelMatched += count
        termFrequency[term] = (termFrequency[term] ?? 0) + count
      }
    }

    for (const term of FORWARD_LOOKING_TERMS) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const count = (fullText.match(regex) ?? []).length
      if (count > 0) {
        forwardMatched += count
        termFrequency[term] = (termFrequency[term] ?? 0) + count
      }
    }

    const weightedSum = aiMatched * 3 + novelMatched * 2 + forwardMatched * 1
    const rawScore = weightedSum / blocks.length
    const score = Math.round(Math.min(100, rawScore * 20))

    const grade = getGrade(score)

    // Top terms sorted by frequency
    const topTerms = Object.entries(termFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term)

    const breakdown = [
      { category: 'AI/ML', matched: aiMatched, weight: 3 },
      { category: 'Novel Tech', matched: novelMatched, weight: 2 },
      { category: 'Forward-looking', matched: forwardMatched, weight: 1 },
    ]

    return { score, grade, topTerms, breakdown }
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const s = innovationScore.value
    const lines = [
      `## Innovation Score: ${s.score}/100 (Grade ${s.grade})`,
      '',
      '### Breakdown',
      '| Category | Matched | Weight |',
      '|---|---|---|',
      ...s.breakdown.map(b => `| ${b.category} | ${b.matched} | ${b.weight} |`),
      '',
      `### Top Terms`,
      s.topTerms.length > 0 ? s.topTerms.map(t => `- ${t}`).join('\n') : '- (none)',
    ]
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    innovationScore,
    copyMarkdown,
    copied,
  }
}
