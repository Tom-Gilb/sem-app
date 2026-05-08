// UNIT_TYPE=Test
// Feature #171 — useInvestorFaq composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useInvestorFaq } from '../useInvestorFaq'
import type { SpecBlock } from '../../types/spec'

function makeFullBlock(): SpecBlock {
  return {
    functions: [{
      id: 'F.Solve',
      type: 'Function',
      level: 'Product',
      description: 'Provides a fast SEM interface for users',
      successCriteria: '',
      functionOfValue: '',
    }],
    values: [{
      id: 'V.Speed',
      type: 'Value',
      level: 'Product',
      description: 'Speed of entry',
      scale: 'Seconds per entry',
      meter: 'Automated timer',
      status: 'Status now 10s',
      tolerable: 'Tolerable 5s',
      goal: 'Goal 2s',
      valueOfFunction: '',
    }],
    solutions: [{
      id: 'S.Optimise',
      type: 'Solution',
      level: 'Product',
      description: 'Optimise the parsing pipeline to reduce latency',
      impact: 'V.Speed ~80%',
      function: '',
    }],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useInvestorFaq', () => {
  it('always returns exactly 5 FAQ items', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value).toHaveLength(5)
  })

  it('returns exactly 5 items for empty blocks', () => {
    const { faqs } = useInvestorFaq([makeEmptyBlock()])
    expect(faqs.value).toHaveLength(5)
  })

  it('FAQ 1 question is "What problem are you solving?"', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[0].question).toBe('What problem are you solving?')
  })

  it('FAQ 1 answer uses first F. entry description', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[0].answer).toContain('Provides a fast SEM interface')
  })

  it('FAQ 2 question is "What does success look like?"', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[1].question).toBe('What does success look like?')
  })

  it('FAQ 2 answer includes the V. goal and scale', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[1].answer).toContain('Goal 2s')
    expect(faqs.value[1].answer).toContain('Seconds per entry')
  })

  it('FAQ 3 question is "How is this measured?"', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[2].question).toBe('How is this measured?')
  })

  it('FAQ 3 answer includes the V. meter and scale', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[2].answer).toContain('Automated timer')
    expect(faqs.value[2].answer).toContain('Seconds per entry')
  })

  it('FAQ 4 question is "What are the key risks?"', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[3].question).toBe('What are the key risks?')
  })

  it('FAQ 4 answer mentions measurement gaps when V. meter is missing', () => {
    const block: SpecBlock = {
      functions: [],
      values: [{ id: 'V.Gapped', type: 'Value', level: 'Product', description: 'desc', scale: 's', meter: '', status: '', tolerable: '', goal: 'g', valueOfFunction: '' }],
      solutions: [],
    }
    const { faqs } = useInvestorFaq([block])
    expect(faqs.value[3].answer).toContain('Measurement gaps exist in V.Gapped')
  })

  it('FAQ 4 answer is "Primary risk: unclear adoption velocity" when all meters present', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[3].answer).toBe('Primary risk: unclear adoption velocity')
  })

  it('FAQ 5 question is "What is the implementation path?"', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[4].question).toBe('What is the implementation path?')
  })

  it('FAQ 5 answer uses first S. entry description', () => {
    const { faqs } = useInvestorFaq([makeFullBlock()])
    expect(faqs.value[4].answer).toContain('Optimise the parsing pipeline')
  })

  it('FAQ 5 answer mentions F./S. counts when no S. entry exists', () => {
    const block: SpecBlock = {
      functions: [{ id: 'F.One', type: 'Function', level: 'Product', description: 'desc', successCriteria: '', functionOfValue: '' }],
      values: [],
      solutions: [],
    }
    const { faqs } = useInvestorFaq([block])
    expect(faqs.value[4].answer).toContain('1 function')
    expect(faqs.value[4].answer).toContain('0 solutions')
  })

  it('open starts as false', () => {
    const { open } = useInvestorFaq([])
    expect(open.value).toBe(false)
  })

  it('copied starts as false', () => {
    const { copied } = useInvestorFaq([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown writes Investor FAQ markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useInvestorFaq([makeFullBlock()])
    await copyMarkdown()
    expect(written[0]).toContain('## Investor FAQ')
    expect(written[0]).toContain('What problem are you solving?')
  })

  it('copyMarkdown does not throw for empty blocks', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const { copyMarkdown } = useInvestorFaq([makeEmptyBlock()])
    await expect(copyMarkdown()).resolves.not.toThrow()
  })
})
