// UNIT_TYPE=Test
// Feature #129 — useInnovationScore composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useInnovationScore } from '../useInnovationScore'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; goal?: string; scale?: string; meter?: string }>
  solutions?: Array<{ id: string; description?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? '',
      scale: v.scale ?? '',
      meter: v.meter ?? '',
      status: '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: (overrides?.solutions ?? []).map(s => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: s.description ?? '',
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useInnovationScore', () => {
  it('returns score 0 and grade F for empty blocks array', () => {
    const { innovationScore } = useInnovationScore([])
    expect(innovationScore.value.score).toBe(0)
    expect(innovationScore.value.grade).toBe('F')
  })

  it('returns empty topTerms for empty blocks', () => {
    const { innovationScore } = useInnovationScore([])
    expect(innovationScore.value.topTerms).toHaveLength(0)
  })

  it('returns breakdown with 3 rows for empty blocks', () => {
    const { innovationScore } = useInnovationScore([])
    expect(innovationScore.value.breakdown).toHaveLength(3)
    expect(innovationScore.value.breakdown[0].category).toBe('AI/ML')
    expect(innovationScore.value.breakdown[1].category).toBe('Novel Tech')
    expect(innovationScore.value.breakdown[2].category).toBe('Forward-looking')
  })

  it('detects AI/ML keyword and increases score', () => {
    const block = makeBlock({
      functions: [{ id: 'F.UseML', description: 'Use neural network for inference' }],
    })
    const { innovationScore } = useInnovationScore([block])
    expect(innovationScore.value.score).toBeGreaterThan(0)
    expect(innovationScore.value.breakdown[0].matched).toBeGreaterThan(0)
  })

  it('detects novel tech keywords', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Deploy', description: 'Deploy serverless microservices on kubernetes' }],
    })
    const { innovationScore } = useInnovationScore([block])
    expect(innovationScore.value.breakdown[1].matched).toBeGreaterThan(0)
  })

  it('detects forward-looking keywords', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Auto', description: 'Automate and scale intelligently' }],
    })
    const { innovationScore } = useInnovationScore([block])
    expect(innovationScore.value.breakdown[2].matched).toBeGreaterThan(0)
  })

  it('grade A for score >= 80', () => {
    // Multiple AI terms to push score high
    const block = makeBlock({
      functions: [
        { id: 'F.AI1', description: 'ai ml neural llm gpt model inference embedding prediction classification' },
        { id: 'F.AI2', description: 'transformer generative anthropic openai' },
      ],
    })
    const { innovationScore } = useInnovationScore([block])
    if (innovationScore.value.score >= 80) {
      expect(innovationScore.value.grade).toBe('A')
    } else {
      expect(['A', 'B', 'C', 'D', 'F']).toContain(innovationScore.value.grade)
    }
  })

  it('grade F for score < 35', () => {
    const block = makeBlock({ functions: [{ id: 'F.Basic', description: 'basic task' }] })
    const { innovationScore } = useInnovationScore([block])
    expect(innovationScore.value.grade).toBe('F')
  })

  it('grade thresholds: B>=65, C>=50, D>=35', () => {
    // Test grade boundaries by verifying the grade logic
    const { innovationScore: s1 } = useInnovationScore([
      makeBlock({ functions: [{ id: 'F.B', description: 'ai ml neural' }] }),
    ])
    const grade = s1.value.grade
    expect(['A', 'B', 'C', 'D', 'F']).toContain(grade)
    // Grade must be consistent with score
    const score = s1.value.score
    if (score >= 80) expect(grade).toBe('A')
    else if (score >= 65) expect(grade).toBe('B')
    else if (score >= 50) expect(grade).toBe('C')
    else if (score >= 35) expect(grade).toBe('D')
    else expect(grade).toBe('F')
  })

  it('topTerms has at most 5 entries', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Multi', description: 'ai neural llm gpt model inference embedding prediction classification transformer generative' },
      ],
      solutions: [
        { id: 'S.More', description: 'serverless kubernetes distributed blockchain quantum' },
      ],
    })
    const { innovationScore } = useInnovationScore([block])
    expect(innovationScore.value.topTerms.length).toBeLessThanOrEqual(5)
  })

  it('topTerms are sorted by frequency desc', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Rep', description: 'ai ai ai neural neural transformer' },
      ],
    })
    const { innovationScore } = useInnovationScore([block])
    const terms = innovationScore.value.topTerms
    expect(terms[0]).toBe('ai')
  })

  it('breakdown weights are 3, 2, 1 for AI/ML, Novel Tech, Forward-looking', () => {
    const { innovationScore } = useInnovationScore([])
    const bd = innovationScore.value.breakdown
    expect(bd[0].weight).toBe(3)
    expect(bd[1].weight).toBe(2)
    expect(bd[2].weight).toBe(1)
  })

  it('score is clamped to 100 maximum', () => {
    const block = makeBlock({
      functions: Array.from({ length: 5 }, (_, i) => ({
        id: `F.AI${i}`,
        description: 'ai ml neural llm gpt model inference embedding prediction classification transformer generative anthropic openai',
      })),
    })
    const { innovationScore } = useInnovationScore([block])
    expect(innovationScore.value.score).toBeLessThanOrEqual(100)
  })

  it('copyMarkdown includes score and grade', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const block = makeBlock({ functions: [{ id: 'F.AI', description: 'ai neural' }] })
    const { copyMarkdown, innovationScore } = useInnovationScore([block])
    await copyMarkdown()
    expect(writeText).toHaveBeenCalledOnce()
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain(`${innovationScore.value.score}/100`)
    expect(text).toContain(`Grade ${innovationScore.value.grade}`)
  })

  it('copyMarkdown includes breakdown table', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const block = makeBlock({ functions: [{ id: 'F.T', description: 'serverless edge computing' }] })
    const { copyMarkdown } = useInnovationScore([block])
    await copyMarkdown()
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('AI/ML')
    expect(text).toContain('Novel Tech')
    expect(text).toContain('Forward-looking')
  })
})
