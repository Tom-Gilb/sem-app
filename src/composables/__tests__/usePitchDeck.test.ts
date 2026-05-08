// UNIT_TYPE=Test
// Feature #137 — usePitchDeck composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { usePitchDeck } from '../usePitchDeck'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; goal?: string; status?: string; description?: string; scale?: string }>
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
      meter: '',
      status: v.status ?? '',
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

describe('usePitchDeck', () => {
  it('always produces exactly 10 slides', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta' }],
    })
    const { slides } = usePitchDeck([block])
    expect(slides.value).toHaveLength(10)
  })

  it('produces 10 slides even with empty blocks', () => {
    const block = makeBlock()
    const { slides } = usePitchDeck([block])
    expect(slides.value).toHaveLength(10)
  })

  it('slide titles are in correct order', () => {
    const block = makeBlock()
    const { slides } = usePitchDeck([block])
    const expectedTitles = [
      'Problem', 'Solution', 'Market', 'Product', 'Traction',
      'Business Model', 'Competition', 'Team', 'Roadmap', 'Ask',
    ]
    expect(slides.value.map(s => s.title)).toEqual(expectedTitles)
  })

  it('slide numbers are 1 through 10', () => {
    const block = makeBlock()
    const { slides } = usePitchDeck([block])
    expect(slides.value.map(s => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('slide 1 (Problem) references first V. entry name and goal', () => {
    const block = makeBlock({
      values: [{ id: 'V.Fluency', goal: 'Goal 95%' }],
    })
    const { slides } = usePitchDeck([block])
    const problem = slides.value[0]
    expect(problem.bullets[0]).toContain('V.Fluency')
    expect(problem.bullets[0]).toContain('Goal 95%')
  })

  it('slide 2 (Solution) contains function count', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.One', description: 'Does one thing' },
        { id: 'F.Two', description: 'Does two things' },
      ],
    })
    const { slides } = usePitchDeck([block])
    const solution = slides.value[1]
    expect(solution.bullets[0]).toContain('2')
    expect(solution.bullets[0]).toContain('core capabilities')
  })

  it('slide 2 (Solution) references first F. entry', () => {
    const block = makeBlock({
      functions: [{ id: 'F.CoreFunc', description: 'Main feature description' }],
    })
    const { slides } = usePitchDeck([block])
    const solution = slides.value[1]
    expect(solution.bullets[1]).toContain('F.CoreFunc')
  })

  it('slide 5 (Traction) uses first V. entry goal', () => {
    const block = makeBlock({
      values: [{ id: 'V.Speed', goal: '$100,000', status: 'Status $5,000' }],
    })
    const { slides } = usePitchDeck([block])
    const traction = slides.value[4]
    expect(traction.bullets[1]).toContain('$100,000')
  })

  it('slide 5 (Traction) uses first V. entry status', () => {
    const block = makeBlock({
      values: [{ id: 'V.Rev', goal: '$200,000', status: 'Status $50,000' }],
    })
    const { slides } = usePitchDeck([block])
    const traction = slides.value[4]
    expect(traction.bullets[0]).toContain('Status $50,000')
  })

  it('slide 9 (Roadmap) references first and second F. entries', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.StepOne', description: 'first step' },
        { id: 'F.StepTwo', description: 'second step' },
      ],
    })
    const { slides } = usePitchDeck([block])
    const roadmap = slides.value[8]
    expect(roadmap.bullets[0]).toContain('F.StepOne')
    expect(roadmap.bullets[1]).toContain('F.StepTwo')
  })

  it('slide 10 (Ask) references first V. goal and name', () => {
    const block = makeBlock({
      values: [{ id: 'V.Target', goal: '99.9% uptime' }],
    })
    const { slides } = usePitchDeck([block])
    const ask = slides.value[9]
    expect(ask.bullets[1]).toContain('99.9% uptime')
    expect(ask.bullets[1]).toContain('V.Target')
  })

  it('copyMarkdown produces exactly 10 ## headings', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta', goal: '90%' }],
    })
    const { copyMarkdown, copied } = usePitchDeck([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const headings = written.match(/^## /gm)
    expect(headings).toHaveLength(10)
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown headings include all 10 slide titles', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock()
    const { copyMarkdown } = usePitchDeck([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    for (const title of ['Problem', 'Solution', 'Market', 'Product', 'Traction', 'Business Model', 'Competition', 'Team', 'Roadmap', 'Ask']) {
      expect(written).toContain(title)
    }
  })

  it('each slide has at least 2 bullet points', () => {
    const block = makeBlock({
      functions: [{ id: 'F.A' }, { id: 'F.B' }],
      values: [{ id: 'V.A', goal: '95%', status: 'Status 80%' }],
    })
    const { slides } = usePitchDeck([block])
    for (const slide of slides.value) {
      expect(slide.bullets.length).toBeGreaterThanOrEqual(2)
    }
  })
})
