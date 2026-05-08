// UNIT_TYPE=Test
// Feature #118 — useSpecSentiment composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useSpecSentiment } from '../useSpecSentiment'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string; successCriteria?: string }>
  values?: Array<{ id: string; description?: string; scale?: string; goal?: string; status?: string }>
  solutions?: Array<{ id: string; description?: string; impact?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: f.successCriteria ?? '',
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
      impact: s.impact ?? '',
      function: '',
    })),
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useSpecSentiment', () => {
  it('results is empty when blocks have no entries', () => {
    const { results } = useSpecSentiment([{ functions: [], values: [], solutions: [] }])
    expect(results.value).toHaveLength(0)
  })

  it('matches positive keyword and sets positive label', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Improve', description: 'improve user experience' }],
    })
    const { results } = useSpecSentiment([block])
    const r = results.value.find(r => r.entryId === 'F.Improve')!
    expect(r.label).toBe('positive')
    expect(r.keywords).toContain('improve')
  })

  it('matches negative keyword and sets negative label', () => {
    const block = makeBlock({
      functions: [{ id: 'F.FailCase', description: 'system may fail under load' }],
    })
    const { results } = useSpecSentiment([block])
    const r = results.value.find(r => r.entryId === 'F.FailCase')!
    expect(r.label).toBe('negative')
    expect(r.keywords).toContain('fail')
  })

  it('urgent keyword overrides positive score', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Urgent', description: 'improve and enhance but critical deadline' }],
    })
    const { results } = useSpecSentiment([block])
    const r = results.value.find(r => r.entryId === 'F.Urgent')!
    expect(r.label).toBe('urgent')
  })

  it('neutral when no keywords match', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Neutral', description: 'renders the page content' }],
    })
    const { results } = useSpecSentiment([block])
    const r = results.value.find(r => r.entryId === 'F.Neutral')!
    expect(r.label).toBe('neutral')
    expect(r.score).toBe(0)
  })

  it('score equals positive count minus negative count', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Mixed', description: 'improve and enhance but fail and error' }],
    })
    const { results } = useSpecSentiment([block])
    const r = results.value.find(r => r.entryId === 'F.Mixed')!
    // positive: improve, enhance = 2; negative: fail, error = 2; score = 0
    expect(r.score).toBe(0)
  })

  it('distribution counts per label are correct', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Pos', description: 'improve outcomes' },
        { id: 'F.Neg', description: 'risk of failure' },
        { id: 'F.Neu', description: 'renders the page' },
      ],
    })
    const { distribution } = useSpecSentiment([block])
    expect(distribution.value.positive).toBeGreaterThanOrEqual(1)
    expect(distribution.value.negative).toBeGreaterThanOrEqual(1)
  })

  it('dominantLabel returns the label with highest count', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.P1', description: 'improve user flow' },
        { id: 'F.P2', description: 'enhance experience' },
        { id: 'F.P3', description: 'enable better outcomes' },
        { id: 'F.N1', description: 'risk of error' },
      ],
    })
    const { dominantLabel } = useSpecSentiment([block])
    expect(dominantLabel.value).toBe('positive')
  })

  it('urgentEntries filters only urgent results', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Critical', description: 'critical mandatory deadline' },
        { id: 'F.Normal', description: 'renders the page' },
      ],
    })
    const { urgentEntries } = useSpecSentiment([block])
    expect(urgentEntries.value.length).toBeGreaterThanOrEqual(1)
    expect(urgentEntries.value.every(r => r.label === 'urgent')).toBe(true)
  })

  it('urgentEntries is empty when no urgent keywords match', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Normal', description: 'improve the system' }],
    })
    const { urgentEntries } = useSpecSentiment([block])
    expect(urgentEntries.value).toHaveLength(0)
  })

  it('includes V. and S. entries in results', () => {
    const block = makeBlock({
      values: [{ id: 'V.Alpha', description: 'improve value' }],
      solutions: [{ id: 'S.Beta', description: 'deliver capability' }],
    })
    const { results } = useSpecSentiment([block])
    const ids = results.value.map(r => r.entryId)
    expect(ids).toContain('V.Alpha')
    expect(ids).toContain('S.Beta')
  })

  it('copied starts as false', () => {
    const { copied } = useSpecSentiment([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown sets copied to true on success', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'improve system' }],
    })
    const { copyMarkdown, copied } = useSpecSentiment([block])
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown output contains all required headers', async () => {
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
      functions: [{ id: 'F.Alpha', description: 'improve system' }],
    })
    const { copyMarkdown } = useSpecSentiment([block])
    await copyMarkdown()
    expect(written).toContain('Name')
    expect(written).toContain('Label')
    expect(written).toContain('Score')
    expect(written).toContain('Keywords')
  })

  it('matches multiple urgent keywords and records them all', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Emerg', description: 'emergency mandatory asap fix' }],
    })
    const { results } = useSpecSentiment([block])
    const r = results.value.find(r => r.entryId === 'F.Emerg')!
    expect(r.keywords.length).toBeGreaterThanOrEqual(2)
    expect(r.label).toBe('urgent')
  })
})
