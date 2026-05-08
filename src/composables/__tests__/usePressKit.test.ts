// UNIT_TYPE=Test
// Feature #162 — usePressKit composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildPressKit, formatPressKitMarkdown, usePressKit } from '../usePressKit'
import type { SpecBlock } from '../../types/spec'

function makeBlock(opts: {
  functionId?: string
  functionDesc?: string
  valueId?: string
  valueGoal?: string
  valueScale?: string
  valueMeter?: string
  solutionId?: string
  solutionDesc?: string
} = {}): SpecBlock {
  const {
    functionId,
    functionDesc = 'improve user workflow and efficiency',
    valueId,
    valueGoal = 'Better Outcomes',
    valueScale = 'performance',
    valueMeter = 'quantitative data',
    solutionId,
    solutionDesc = 'automated pipeline for processing',
  } = opts

  return {
    functions: functionId
      ? [{
          id: functionId,
          type: 'Function',
          level: 'Product',
          description: functionDesc,
          successCriteria: '',
          functionOfValue: '',
        }]
      : [],
    values: valueId
      ? [{
          id: valueId,
          type: 'Value',
          level: 'Product',
          description: 'A measurable value outcome',
          scale: valueScale,
          meter: valueMeter,
          status: '',
          tolerable: '',
          goal: valueGoal,
          valueOfFunction: '',
        }]
      : [],
    solutions: solutionId
      ? [{
          id: solutionId,
          type: 'Solution',
          level: 'Product',
          description: solutionDesc,
          impact: '',
          function: '',
        }]
      : [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildPressKit', () => {
  it('returns an object with all required fields', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Launch', valueId: 'V.Speed' })])
    expect(kit).toHaveProperty('headline')
    expect(kit).toHaveProperty('subheadline')
    expect(kit).toHaveProperty('keyFacts')
    expect(kit).toHaveProperty('quotes')
    expect(kit).toHaveProperty('boilerplate')
  })

  it('keyFacts has exactly 3 items', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Deploy', valueId: 'V.Reliability', solutionId: 'S.Auto' })])
    expect(kit.keyFacts).toHaveLength(3)
  })

  it('quotes has exactly 2 items', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Integrate', valueId: 'V.Adoption' })])
    expect(kit.quotes).toHaveLength(2)
  })

  it('headline contains first F. entry id', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.CoreEngine', valueId: 'V.Throughput' })])
    expect(kit.headline).toContain('F.CoreEngine')
  })

  it('headline contains the V. goal when present', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Ship', valueId: 'V.Satisfaction', valueGoal: '95% CSAT' })])
    expect(kit.headline).toContain('95% CSAT')
  })

  it('headline falls back to "Better Results" when no V. goal', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Build' })])
    expect(kit.headline).toContain('Better Results')
  })

  it('headline falls back to "this product" when no F. entries', () => {
    const kit = buildPressKit([makeBlock({ valueId: 'V.Speed' })])
    expect(kit.headline).toContain('this product')
  })

  it('keyFacts[0] counts F. and V. entries', () => {
    const blocks = [
      makeBlock({ functionId: 'F.One', valueId: 'V.Alpha' }),
      makeBlock({ functionId: 'F.Two', valueId: 'V.Beta' }),
    ]
    const kit = buildPressKit(blocks)
    expect(kit.keyFacts[0]).toContain('2 key capabilities')
    expect(kit.keyFacts[0]).toContain('2 measurable outcomes')
  })

  it('keyFacts[1] mentions scale and meter from first V. entry', () => {
    const kit = buildPressKit([makeBlock({
      functionId: 'F.Proc',
      valueId: 'V.Quality',
      valueScale: 'defect rate',
      valueMeter: 'automated scan',
    })])
    expect(kit.keyFacts[1]).toContain('defect rate')
    expect(kit.keyFacts[1]).toContain('automated scan')
  })

  it('keyFacts[2] counts S. entries', () => {
    const blocks = [
      makeBlock({ solutionId: 'S.One' }),
      makeBlock({ solutionId: 'S.Two' }),
      makeBlock({ solutionId: 'S.Three' }),
    ]
    const kit = buildPressKit(blocks)
    expect(kit.keyFacts[2]).toContain('3 solution approaches')
  })

  it('boilerplate is a non-empty string', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.X' })])
    expect(typeof kit.boilerplate).toBe('string')
    expect(kit.boilerplate.length).toBeGreaterThan(0)
  })

  it('works with completely empty blocks array', () => {
    const kit = buildPressKit([])
    expect(kit.keyFacts).toHaveLength(3)
    expect(kit.quotes).toHaveLength(2)
    expect(kit.headline).toBeTruthy()
    expect(kit.boilerplate).toBeTruthy()
  })
})

describe('formatPressKitMarkdown', () => {
  it('includes headline as H1', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Release', valueId: 'V.Revenue', valueGoal: 'Revenue growth' })])
    const md = formatPressKitMarkdown(kit)
    expect(md).toContain(`# ${kit.headline}`)
  })

  it('includes subheadline as italic text', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Demo' })])
    const md = formatPressKitMarkdown(kit)
    expect(md).toContain(`*${kit.subheadline}*`)
  })

  it('includes Key Facts section', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Build', valueId: 'V.NPS' })])
    const md = formatPressKitMarkdown(kit)
    expect(md).toContain('## Key Facts')
  })

  it('includes Quotes section', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Scale' })])
    const md = formatPressKitMarkdown(kit)
    expect(md).toContain('## Quotes')
  })

  it('includes Boilerplate section', () => {
    const kit = buildPressKit([makeBlock({ functionId: 'F.Launch' })])
    const md = formatPressKitMarkdown(kit)
    expect(md).toContain('## Boilerplate')
  })
})

describe('usePressKit', () => {
  it('copied starts false', () => {
    const { copied } = usePressKit([])
    expect(copied.value).toBe(false)
  })

  it('pressKit computed returns a PressKit object', () => {
    const { pressKit } = usePressKit([makeBlock({ functionId: 'F.Core', valueId: 'V.Perf' })])
    expect(pressKit.value).toHaveProperty('headline')
    expect(pressKit.value).toHaveProperty('keyFacts')
    expect(pressKit.value.keyFacts).toHaveLength(3)
    expect(pressKit.value.quotes).toHaveLength(2)
  })

  it('pressKit.value reflects blocks passed at call time', () => {
    const blocks = [makeBlock({ functionId: 'F.Distinct', valueId: 'V.Retention' })]
    const { pressKit } = usePressKit(blocks)
    expect(pressKit.value.headline).toContain('F.Distinct')
  })

  it('pressKit works with empty blocks', () => {
    const { pressKit } = usePressKit([])
    expect(pressKit.value.keyFacts).toHaveLength(3)
    expect(pressKit.value.quotes).toHaveLength(2)
  })

  it('copyMarkdown writes markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn((t: string) => {
          written.push(t)
          return Promise.resolve()
        }),
      },
    })
    const { copyMarkdown } = usePressKit([makeBlock({ functionId: 'F.Press', valueId: 'V.Reach' })])
    await copyMarkdown()
    expect(written).toHaveLength(1)
    expect(written[0]).toContain('# ')
    expect(written[0]).toContain('## Key Facts')
  })

  it('copied becomes true after copyMarkdown', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const { copied, copyMarkdown } = usePressKit([makeBlock({ functionId: 'F.A' })])
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown does not throw when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.reject(new Error('no clipboard'))) },
    })
    const { copyMarkdown } = usePressKit([])
    await expect(copyMarkdown()).resolves.not.toThrow()
  })

  it('copied stays false when clipboard write fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) },
    })
    const { copied, copyMarkdown } = usePressKit([makeBlock({ functionId: 'F.Fail' })])
    await copyMarkdown()
    expect(copied.value).toBe(false)
  })
})
