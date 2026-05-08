// UNIT_TYPE=Test
// Feature #142 — useMarketingOnePager composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useMarketingOnePager } from '../useMarketingOnePager'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; goal?: string; status?: string; description?: string }>
  solutions?: Array<{ id: string }>
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
      scale: '',
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
      description: '',
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useMarketingOnePager', () => {
  it('headline uses first V. goal and first F. name when both present', () => {
    const block = makeBlock({
      functions: [{ id: 'F.CoreFeature' }],
      values: [{ id: 'V.Revenue', goal: 'Goal 95% retention' }],
    })
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.headline).toContain('F.CoreFeature')
    expect(onePager.value.headline).toContain('95% retention')
  })

  it('headline starts with "Achieve" when V. and F. entries present', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Func' }],
      values: [{ id: 'V.Val', goal: 'Goal 80%' }],
    })
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.headline).toMatch(/^Achieve /)
  })

  it('headline falls back when no V. or F. entries', () => {
    const block = makeBlock()
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.headline).toBe('Deliver measurable value with Planguage')
  })

  it('subheadline contains function count', () => {
    const block = makeBlock({
      functions: [{ id: 'F.A' }, { id: 'F.B' }, { id: 'F.C' }],
    })
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.subheadline).toContain('3')
    expect(onePager.value.subheadline).toContain('capabilities')
  })

  it('subheadline contains value count', () => {
    const block = makeBlock({
      values: [{ id: 'V.A' }, { id: 'V.B' }],
    })
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.subheadline).toContain('2')
    expect(onePager.value.subheadline).toContain('outcomes')
  })

  it('benefits always has exactly 3 items', () => {
    const block = makeBlock()
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.benefits).toHaveLength(3)
  })

  it('benefits uses first 3 V. entries when 3+ present', () => {
    const block = makeBlock({
      values: [
        { id: 'V.Alpha', goal: 'Goal 90%' },
        { id: 'V.Beta', goal: 'Goal 80%' },
        { id: 'V.Gamma', goal: 'Goal 70%' },
        { id: 'V.Delta', goal: 'Goal 60%' },
      ],
    })
    const { onePager } = useMarketingOnePager([block])
    const benefitText = onePager.value.benefits.join('\n')
    expect(benefitText).toContain('V.Alpha')
    expect(benefitText).toContain('V.Beta')
    expect(benefitText).toContain('V.Gamma')
    expect(benefitText).not.toContain('V.Delta')
  })

  it('benefits are padded with generic bullets when fewer than 3 V. entries', () => {
    const block = makeBlock({
      values: [{ id: 'V.OnlyOne', goal: 'Goal 75%' }],
    })
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.benefits).toHaveLength(3)
    // At least one generic bullet should be present
    const genericBullets = ['Measurable goals', 'Planguage scales', 'Structured specs']
    const benefitText = onePager.value.benefits.join(' ')
    const hasGeneric = genericBullets.some(g => benefitText.includes(g))
    expect(hasGeneric).toBe(true)
  })

  it('proofPoints has exactly 2 items when 2+ V. entries', () => {
    const block = makeBlock({
      values: [
        { id: 'V.A', goal: 'Goal 95%' },
        { id: 'V.B', goal: 'Goal 80%' },
      ],
    })
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.proofPoints).toHaveLength(2)
  })

  it('proofPoints sorted by descending numeric goal value', () => {
    const block = makeBlock({
      values: [
        { id: 'V.Low', goal: 'Goal 10 items' },
        { id: 'V.High', goal: 'Goal 100 items' },
      ],
    })
    const { onePager } = useMarketingOnePager([block])
    // High should come first
    expect(onePager.value.proofPoints[0]).toContain('V.High')
    expect(onePager.value.proofPoints[1]).toContain('V.Low')
  })

  it('cta is the fixed string', () => {
    const block = makeBlock()
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.cta).toBe('Get started — your first spec in under 5 minutes')
  })

  it('footer is the fixed string', () => {
    const block = makeBlock()
    const { onePager } = useMarketingOnePager([block])
    expect(onePager.value.footer).toBe('Built on Planguage — measurable specifications since 1988')
  })

  it('copyMarkdown contains headline', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      functions: [{ id: 'F.Feature' }],
      values: [{ id: 'V.Outcome', goal: 'Goal 90%' }],
    })
    const { onePager, copyMarkdown } = useMarketingOnePager([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain(onePager.value.headline)
  })

  it('copyMarkdown contains cta', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock()
    const { copyMarkdown } = useMarketingOnePager([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('Get started')
  })

  it('copyMarkdown contains footer', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock()
    const { copyMarkdown } = useMarketingOnePager([block])
    await copyMarkdown()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('Planguage — measurable specifications since 1988')
  })

  it('copyMarkdown sets copied to true', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock()
    const { copyMarkdown, copied } = useMarketingOnePager([block])
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })
})
