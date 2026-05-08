// UNIT_TYPE=Test
// Feature #127 — useJobDescription composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useJobDescription } from '../useJobDescription'
import type { SpecBlock } from '../../types/spec'

function makeBlock(opts: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; goal?: string }>
  solutions?: Array<{ id: string; description?: string }>
} = {}): SpecBlock {
  return {
    functions: (opts.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? `Description for ${f.id}`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (opts.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? `Description for ${v.id}`,
      scale: '',
      meter: '',
      status: '',
      tolerable: '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: (opts.solutions ?? []).map(s => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: s.description ?? `Description for ${s.id}`,
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useJobDescription — mock generation', () => {
  it('generate() with empty apiKey uses mock mode', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Deploy', description: 'Deploy the application to production' }],
      values: [{ id: 'V.Uptime', goal: 'Goal [2026-Q1] 99.9%' }],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    expect(jd.value).not.toBeNull()
  })

  it('roleSummary contains first F. entry description content', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Process', description: 'process incoming requests efficiently' }],
      values: [{ id: 'V.Speed' }],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    expect(jd.value?.roleSummary).toContain('process incoming requests efficiently'.slice(0, 40))
  })

  it('responsibilities count matches number of F. entries', async () => {
    const block = makeBlock({
      functions: [
        { id: 'F.One', description: 'first function' },
        { id: 'F.Two', description: 'second function' },
        { id: 'F.Three', description: 'third function' },
      ],
      values: [{ id: 'V.Alpha' }],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    expect(jd.value?.responsibilities).toHaveLength(3)
  })

  it('successMetrics count matches number of V. entries', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.One' }],
      values: [
        { id: 'V.Alpha', goal: 'Goal [2026-Q1] 90%' },
        { id: 'V.Beta', goal: 'Goal [2026-Q1] 80%' },
      ],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    expect(jd.value?.successMetrics).toHaveLength(2)
  })

  it('qualifications always has exactly 3 items', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.One' }],
      values: [{ id: 'V.Alpha' }],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    expect(jd.value?.qualifications).toHaveLength(3)
  })

  it('qualifications has 3 items even with many solutions', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.One' }],
      values: [{ id: 'V.Alpha' }],
      solutions: [
        { id: 'S.One' },
        { id: 'S.Two' },
        { id: 'S.Three' },
        { id: 'S.Four' },
      ],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    expect(jd.value?.qualifications).toHaveLength(3)
  })

  it('successMetrics include Goal value from V. entry', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.Deploy' }],
      values: [{ id: 'V.Latency', goal: 'Goal [2026-Q1] <100ms' }],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    const metrics = jd.value?.successMetrics ?? []
    expect(metrics.some(m => m.includes('<100ms'))).toBe(true)
  })

  it('generating flag is true during generation and false after', async () => {
    const block = makeBlock({ functions: [{ id: 'F.One' }], values: [{ id: 'V.Alpha' }] })
    const { generating, generate } = useJobDescription([block], '')
    const promise = generate()
    // After await, generating should be false
    await promise
    expect(generating.value).toBe(false)
  })

  it('jd starts null', () => {
    const { jd } = useJobDescription([], '')
    expect(jd.value).toBeNull()
  })

  it('copied starts false', () => {
    const { copied } = useJobDescription([], '')
    expect(copied.value).toBe(false)
  })
})

describe('useJobDescription — copyMarkdown', () => {
  it('copyMarkdown writes JD markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn((t: string) => {
          written.push(t)
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock({
      functions: [{ id: 'F.Build', description: 'build the product from scratch' }],
      values: [{ id: 'V.Quality', goal: 'Goal [2026-Q1] 95%' }],
    })
    const { generate, copyMarkdown } = useJobDescription([block], '')
    await generate()
    await copyMarkdown()
    expect(written[0]).toContain('## Role Summary')
    expect(written[0]).toContain('## Responsibilities')
    expect(written[0]).toContain('## Success Metrics')
    expect(written[0]).toContain('## Qualifications')
  })

  it('copyMarkdown does nothing when jd is null', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyMarkdown } = useJobDescription([], '')
    await copyMarkdown()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('roleSummary mentions measurable outcomes count', async () => {
    const block = makeBlock({
      functions: [{ id: 'F.One', description: 'deliver high quality software releases' }],
      values: [{ id: 'V.A' }, { id: 'V.B' }],
    })
    const { jd, generate } = useJobDescription([block], '')
    await generate()
    // 2 value entries → "2 measurable outcomes"
    expect(jd.value?.roleSummary).toContain('2')
  })
})
