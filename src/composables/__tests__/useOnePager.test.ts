// UNIT_TYPE=Test
// Feature #142 — useOnePager composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useOnePager } from '../useOnePager'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; goal?: string; scale?: string; description?: string }>
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
      status: '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useOnePager', () => {
  it('onePager is null before generate is called', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta' }],
    })
    const { onePager } = useOnePager([block])
    expect(onePager.value).toBeNull()
  })

  it('generating starts as false', () => {
    const block = makeBlock()
    const { generating } = useOnePager([block])
    expect(generating.value).toBe(false)
  })

  it('generate sets onePager to non-null', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.CreateEntry' }],
      values: [{ id: 'V.Fluency' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value).not.toBeNull()
  })

  it('headline contains first F. entry name', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.BuildDashboard' }],
      values: [{ id: 'V.Efficiency' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.headline).toContain('F.BuildDashboard')
  })

  it('headline ends with "— Built for Results"', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.headline).toContain('Built for Results')
  })

  it('subheadline contains first V. entry name', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Revenue' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.subheadline).toContain('V.Revenue')
  })

  it('benefits length is at most 3', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [
        { id: 'V.One' },
        { id: 'V.Two' },
        { id: 'V.Three' },
        { id: 'V.Four' },
      ],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.benefits.length).toBeLessThanOrEqual(3)
  })

  it('benefits length is 3 even with fewer V. entries', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.One' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.benefits).toHaveLength(3)
  })

  it('proofPoints length is exactly 2', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [
        { id: 'V.One', goal: 'Goal 80%' },
        { id: 'V.Two', goal: 'Goal 90%' },
        { id: 'V.Three', goal: 'Goal 95%' },
      ],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.proofPoints).toHaveLength(2)
  })

  it('proofPoints length is 2 even with no V. entries having goals', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.proofPoints).toHaveLength(2)
  })

  it('cta contains first F. entry name', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.LaunchPipeline' }],
      values: [{ id: 'V.Speed' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.cta).toContain('F.LaunchPipeline')
  })

  it('cta starts with "Get started with"', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.cta).toMatch(/^Get started with/)
  })

  it('markdown field is non-empty after generate', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta' }],
    })
    const { onePager, generate } = useOnePager([block])
    await generate()
    expect(onePager.value!.markdown.length).toBeGreaterThan(0)
  })

  it('generating is false after generate completes', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta' }],
    })
    const { generating, generate } = useOnePager([block])
    await generate()
    expect(generating.value).toBe(false)
  })

  it('copyMarkdown sets copied to true after generate', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Beta', goal: 'Goal 90%' }],
    })
    const { generate, copyMarkdown, copied } = useOnePager([block])
    await generate()
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })
})
