// UNIT_TYPE=Test
// Feature #120 — usePressRelease composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { usePressRelease } from '../usePressRelease'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; goal?: string }>
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
      scale: '',
      meter: '',
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

describe('usePressRelease', () => {
  it('release is null before generate is called', () => {
    const { release } = usePressRelease([], '')
    expect(release.value).toBeNull()
  })

  it('generating is false before generate is called', () => {
    const { generating } = usePressRelease([], '')
    expect(generating.value).toBe(false)
  })

  it('generate sets release in mock mode (no apiKey)', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.MyFeature', description: 'enables fast processing' }],
      values: [{ id: 'V.MyMetric', description: 'processing speed' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value).not.toBeNull()
  })

  it('mock headline contains first F name', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.EntryFluency', description: 'improves entry speed' }],
      values: [{ id: 'V.Speed', description: 'entry speed' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.headline).toContain('EntryFluency')
  })

  it('mock headline contains first V name', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'enable capability' }],
      values: [{ id: 'V.OutputQuality', description: 'output quality' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.headline).toContain('OutputQuality')
  })

  it('mock headline is 80 chars or fewer', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.VeryLongFeatureNameThatExceedsExpectedLength', description: 'long description here' }],
      values: [{ id: 'V.AnotherVeryLongValueNameThatIsAlsoQuiteLong', description: 'long value' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.headline.length).toBeLessThanOrEqual(80)
  })

  it('mock body mentions function count and value count', async () => {
    const block = makeBlock({
      functions: [
        { id: 'F.One', description: 'first function' },
        { id: 'F.Two', description: 'second function' },
      ],
      values: [
        { id: 'V.Alpha', description: 'alpha value' },
        { id: 'V.Beta', description: 'beta value' },
        { id: 'V.Gamma', description: 'gamma value' },
      ],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.body).toContain('2')
    expect(release.value!.body).toContain('3')
  })

  it('mock quote contains "The Team"', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha' }],
      values: [{ id: 'V.Alpha', description: 'alpha' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.quote).toContain('The Team')
  })

  it('mock dateline starts with FOR IMMEDIATE RELEASE', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha' }],
      values: [{ id: 'V.Alpha', description: 'alpha' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.dateline).toMatch(/^FOR IMMEDIATE RELEASE/)
  })

  it('mock dateline contains ISO date format', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha' }],
      values: [{ id: 'V.Alpha', description: 'alpha' }],
    })
    const { generate, release } = usePressRelease([block], '')
    await generate()
    expect(release.value!.dateline).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('generating is false after generate completes in mock mode', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha' }],
      values: [{ id: 'V.Alpha', description: 'alpha' }],
    })
    const { generate, generating } = usePressRelease([block], '')
    await generate()
    expect(generating.value).toBe(false)
  })

  it('copied starts as false', () => {
    const { copied } = usePressRelease([], '')
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown sets copied to true when release exists', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha capability' }],
      values: [{ id: 'V.Alpha', description: 'alpha metric' }],
    })
    const { generate, copyMarkdown, copied } = usePressRelease([block], '')
    await generate()
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown output contains headline and dateline', async () => {
    let written = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          written = text
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha capability' }],
      values: [{ id: 'V.Alpha', description: 'alpha metric' }],
    })
    const { generate, copyMarkdown } = usePressRelease([block], '')
    await generate()
    await copyMarkdown()
    expect(written).toContain('FOR IMMEDIATE RELEASE')
    expect(written).toContain('Alpha')
  })
})
