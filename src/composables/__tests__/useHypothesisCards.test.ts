// UNIT_TYPE=Test
// Feature #124 — useHypothesisCards composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useHypothesisCards,
  buildHypothesisCard,
  formatHypothesisCardMarkdown,
} from '../useHypothesisCards'
import type { SpecBlock } from '../../types/spec'

function makeBlock(
  opts: {
    valueId?: string
    valueDesc?: string
    valueTolerable?: string
    valueGoal?: string
    functionId?: string
  } = {},
): SpecBlock {
  const {
    valueId,
    valueDesc = 'A measurable improvement in the product experience',
    valueTolerable = '',
    valueGoal = '',
    functionId,
  } = opts
  return {
    functions: functionId
      ? [
          {
            id: functionId,
            type: 'Function',
            level: 'Product',
            description: `Desc for ${functionId}`,
            successCriteria: '',
            functionOfValue: '',
          },
        ]
      : [],
    values: valueId
      ? [
          {
            id: valueId,
            type: 'Value',
            level: 'Product',
            description: valueDesc,
            scale: '',
            meter: '',
            status: '',
            tolerable: valueTolerable,
            goal: valueGoal,
            valueOfFunction: '',
          },
        ]
      : [],
    solutions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildHypothesisCard', () => {
  it('sets blockId from V. entry id', () => {
    const block = makeBlock({ valueId: 'V.Fluency' })
    const card = buildHypothesisCard(block)
    expect(card.blockId).toBe('V.Fluency')
  })

  it('sets blockName from V. entry id', () => {
    const block = makeBlock({ valueId: 'V.Throughput' })
    const card = buildHypothesisCard(block)
    expect(card.blockName).toBe('V.Throughput')
  })

  it('derives weBelieve from first 80 chars of description', () => {
    const desc = 'A'.repeat(100)
    const block = makeBlock({ valueId: 'V.Alpha', valueDesc: desc })
    const card = buildHypothesisCard(block)
    expect(card.weBelieve).toBe('A'.repeat(80))
  })

  it('uses fallback weBelieve when description is empty', () => {
    const block = makeBlock({ valueId: 'V.Empty', valueDesc: '' })
    const card = buildHypothesisCard(block)
    expect(card.weBelieve).toBe('this improvement delivers measurable value')
  })

  it('sets weWill to "implement and measure [blockName]"', () => {
    const block = makeBlock({ valueId: 'V.Latency' })
    const card = buildHypothesisCard(block)
    expect(card.weWill).toBe('implement and measure V.Latency')
  })

  it('parses Goal field for weKnow', () => {
    const block = makeBlock({ valueId: 'V.Speed', valueGoal: 'Goal [2026-Q1] <200ms' })
    const card = buildHypothesisCard(block)
    expect(card.weKnow).toBe('Goal <200ms is reached')
  })

  it('uses fallback weKnow when goal is empty', () => {
    const block = makeBlock({ valueId: 'V.NoGoal', valueGoal: '' })
    const card = buildHypothesisCard(block)
    expect(card.weKnow).toBe('measurable improvement is observed')
  })

  it('builds evidenceThreshold from tolerable and goal', () => {
    const block = makeBlock({
      valueId: 'V.Range',
      valueTolerable: 'Tolerable [2026-Q1] 50%',
      valueGoal: 'Goal [2026-Q1] 80%',
    })
    const card = buildHypothesisCard(block)
    expect(card.evidenceThreshold).toBe('50% to 80%')
  })

  it('uses fallback evidenceThreshold when tolerable or goal is missing', () => {
    const block = makeBlock({ valueId: 'V.Only', valueGoal: 'Goal [2026-Q1] 80%' })
    const card = buildHypothesisCard(block)
    expect(card.evidenceThreshold).toBe('statistically significant improvement')
  })

  it('falls back to function id when no V. entry exists', () => {
    const block = makeBlock({ functionId: 'F.Deploy' })
    const card = buildHypothesisCard(block)
    expect(card.blockId).toBe('F.Deploy')
  })
})

describe('formatHypothesisCardMarkdown', () => {
  it('includes all 5 required fields in output', () => {
    const block = makeBlock({ valueId: 'V.Test', valueDesc: 'Improve test coverage metric' })
    const card = buildHypothesisCard(block)
    const md = formatHypothesisCardMarkdown(card)
    expect(md).toContain('## Hypothesis — V.Test')
    expect(md).toContain('**We believe:**')
    expect(md).toContain('**We will:**')
    expect(md).toContain("**We'll know it worked when:**")
    expect(md).toContain('**Evidence threshold:**')
  })

  it('uses blockName in heading', () => {
    const block = makeBlock({ valueId: 'V.Reliability' })
    const card = buildHypothesisCard(block)
    const md = formatHypothesisCardMarkdown(card)
    expect(md).toContain('## Hypothesis — V.Reliability')
  })
})

describe('useHypothesisCards', () => {
  it('returns one card per V. entry block', () => {
    const blocks = [
      makeBlock({ valueId: 'V.Alpha' }),
      makeBlock({ valueId: 'V.Beta' }),
      makeBlock({ valueId: 'V.Gamma' }),
    ]
    const { cards } = useHypothesisCards(blocks)
    expect(cards.value).toHaveLength(3)
  })

  it('excludes blocks without V. entries', () => {
    const blocks = [
      makeBlock({ valueId: 'V.Alpha' }),
      makeBlock({ functionId: 'F.NoValue' }),
    ]
    const { cards } = useHypothesisCards(blocks)
    expect(cards.value).toHaveLength(1)
  })

  it('returns empty cards for empty blocks', () => {
    const { cards } = useHypothesisCards([])
    expect(cards.value).toHaveLength(0)
  })

  it('selectedCard starts null', () => {
    const { selectedCard } = useHypothesisCards([makeBlock({ valueId: 'V.X' })])
    expect(selectedCard.value).toBeNull()
  })

  it('selectCard sets selectedCard', () => {
    const block = makeBlock({ valueId: 'V.Select' })
    const { cards, selectedCard, selectCard } = useHypothesisCards([block])
    selectCard(cards.value[0])
    expect(selectedCard.value?.blockId).toBe('V.Select')
  })

  it('copyCard writes formatted markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const block = makeBlock({ valueId: 'V.Copy', valueDesc: 'Some description to copy' })
    const { cards, copyCard } = useHypothesisCards([block])
    await copyCard(cards.value[0])
    expect(written[0]).toContain('## Hypothesis — V.Copy')
    expect(written[0]).toContain('**We believe:**')
  })

  it('copyAll joins all cards with --- separator', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const blocks = [
      makeBlock({ valueId: 'V.One' }),
      makeBlock({ valueId: 'V.Two' }),
    ]
    const { copyAll } = useHypothesisCards(blocks)
    await copyAll()
    expect(written[0]).toContain('---')
    expect(written[0]).toContain('V.One')
    expect(written[0]).toContain('V.Two')
  })

  it('copyAll does nothing when there are no cards', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyAll } = useHypothesisCards([])
    await copyAll()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copied starts false', () => {
    const { copied } = useHypothesisCards([])
    expect(copied.value).toBe(false)
  })
})
