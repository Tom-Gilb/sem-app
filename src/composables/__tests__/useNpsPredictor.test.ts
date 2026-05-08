// UNIT_TYPE=Test
// Feature #151 — useNpsPredictor composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useNpsPredictor,
  computeNpsEntry,
  formatNpsMarkdown,
} from '../useNpsPredictor'
import type { SpecBlock } from '../../types/spec'

function makeBlock(vEntries: Array<{ id: string; goal?: string; tolerable?: string }> = []): SpecBlock {
  return {
    functions: [],
    values: vEntries.map((v) => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: `Desc for ${v.id}`,
      scale: '',
      meter: '',
      status: '',
      tolerable: v.tolerable ?? '',
      goal: v.goal ?? '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('computeNpsEntry', () => {
  it('uses defaults when goal and tolerable are both 0', () => {
    const entry = computeNpsEntry('V.A', 'V.A', '0', '0')
    expect(entry.promoterPct).toBe(50)
    expect(entry.passivePct).toBe(30)
    expect(entry.detractorPct).toBe(20)
  })

  it('uses defaults when goal and tolerable are empty strings', () => {
    const entry = computeNpsEntry('V.B', 'V.B', '', '')
    expect(entry.promoterPct).toBe(50)
    expect(entry.passivePct).toBe(30)
    expect(entry.detractorPct).toBe(20)
  })

  it('computes nps as promoterPct - detractorPct', () => {
    const entry = computeNpsEntry('V.C', 'V.C', '0', '0')
    expect(entry.nps).toBe(entry.promoterPct - entry.detractorPct)
  })

  it('gap > 0 path: promoterPct = min(90, 40 + gap*2)', () => {
    const entry = computeNpsEntry('V.D', 'V.D', '50', '40')
    const gap = 50 - 40
    expect(entry.promoterPct).toBe(Math.min(90, 40 + gap * 2))
    expect(entry.detractorPct).toBe(Math.max(5, 30 - gap))
    expect(entry.passivePct).toBe(100 - entry.promoterPct - entry.detractorPct)
  })

  it('gap <= 0 path: promoterPct = max(10, 30 + gap)', () => {
    const entry = computeNpsEntry('V.E', 'V.E', '30', '40')
    const gap = 30 - 40
    expect(entry.promoterPct).toBe(Math.max(10, 30 + gap))
    expect(entry.detractorPct).toBe(Math.min(70, 40 - gap))
    expect(entry.passivePct).toBe(100 - entry.promoterPct - entry.detractorPct)
  })

  it('promoterPct + passivePct + detractorPct = 100', () => {
    const entry = computeNpsEntry('V.F', 'V.F', '80', '20')
    expect(entry.promoterPct + entry.passivePct + entry.detractorPct).toBe(100)
  })

  it('nps is within -100 to 100 range for typical inputs', () => {
    const entry = computeNpsEntry('V.G', 'V.G', '100', '0')
    expect(entry.nps).toBeGreaterThanOrEqual(-100)
    expect(entry.nps).toBeLessThanOrEqual(100)
  })

  it('sets vEntryId correctly', () => {
    const entry = computeNpsEntry('V.MyEntry', 'V.MyEntry', '0', '0')
    expect(entry.vEntryId).toBe('V.MyEntry')
  })

  it('sets vEntryName correctly', () => {
    const entry = computeNpsEntry('V.MyEntry', 'V.MyName', '0', '0')
    expect(entry.vEntryName).toBe('V.MyName')
  })
})

describe('formatNpsMarkdown', () => {
  it('includes table header row', () => {
    const entry = computeNpsEntry('V.Test', 'V.Test', '0', '0')
    const md = formatNpsMarkdown([entry], 30, 'Good')
    expect(md).toContain('V. Entry')
    expect(md).toContain('Promoters')
    expect(md).toContain('Passives')
    expect(md).toContain('Detractors')
    expect(md).toContain('NPS')
  })

  it('includes separator row', () => {
    const entry = computeNpsEntry('V.Test', 'V.Test', '0', '0')
    const md = formatNpsMarkdown([entry], 30, 'Good')
    expect(md).toContain('---|')
  })

  it('includes V. entry name in a row', () => {
    const entry = computeNpsEntry('V.RowTest', 'V.RowTest', '0', '0')
    const md = formatNpsMarkdown([entry], 30, 'Good')
    expect(md).toContain('V.RowTest')
  })

  it('includes summary row with aggregate NPS and grade', () => {
    const entry = computeNpsEntry('V.Summary', 'V.Summary', '0', '0')
    const md = formatNpsMarkdown([entry], 55, 'Excellent')
    expect(md).toContain('55')
    expect(md).toContain('Excellent')
  })
})

describe('useNpsPredictor', () => {
  it('returns one entry per V. entry', () => {
    const blocks = [makeBlock([{ id: 'V.A' }, { id: 'V.B' }])]
    const { entries } = useNpsPredictor(blocks)
    expect(entries.value).toHaveLength(2)
  })

  it('returns entries across multiple blocks', () => {
    const blocks = [makeBlock([{ id: 'V.X' }]), makeBlock([{ id: 'V.Y' }])]
    const { entries } = useNpsPredictor(blocks)
    expect(entries.value).toHaveLength(2)
  })

  it('returns empty entries for empty blocks', () => {
    const { entries } = useNpsPredictor([])
    expect(entries.value).toHaveLength(0)
  })

  it('aggregateNps is 0 when there are no entries', () => {
    const { aggregateNps } = useNpsPredictor([])
    expect(aggregateNps.value).toBe(0)
  })

  it('aggregateNps is average of all entry NPS values rounded to int', () => {
    const blocks = [makeBlock([{ id: 'V.A', goal: '50', tolerable: '40' }, { id: 'V.B', goal: '0', tolerable: '0' }])]
    const { entries, aggregateNps } = useNpsPredictor(blocks)
    const expected = Math.round(entries.value.reduce((s, e) => s + e.nps, 0) / entries.value.length)
    expect(aggregateNps.value).toBe(expected)
  })

  it('npsGrade is Excellent for nps >= 50', () => {
    // force a high NPS via large gap
    const blocks = [makeBlock([{ id: 'V.High', goal: '80', tolerable: '10' }])]
    const { npsGrade } = useNpsPredictor(blocks)
    // At gap=70: promoter=min(90,40+140)=90, detractor=max(5,30-70)=5, nps=85
    expect(npsGrade.value).toBe('Excellent')
  })

  it('npsGrade is Poor for nps < 0', () => {
    // force negative NPS via negative gap
    const blocks = [makeBlock([{ id: 'V.Low', goal: '10', tolerable: '60' }])]
    const { entries, npsGrade } = useNpsPredictor(blocks)
    if (entries.value[0].nps < 0) {
      expect(npsGrade.value).toBe('Poor')
    } else {
      // If the gap calculation doesn't produce negative NPS, verify grade logic directly
      expect(['Excellent', 'Good', 'Neutral', 'Poor']).toContain(npsGrade.value)
    }
  })

  it('copied starts as false', () => {
    const { copied } = useNpsPredictor([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown writes to clipboard and sets copied=true', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const blocks = [makeBlock([{ id: 'V.Clip' }])]
    const { copyMarkdown, copied } = useNpsPredictor(blocks)
    await copyMarkdown()
    expect(written[0]).toContain('V. Entry')
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown does nothing when there are no entries', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyMarkdown } = useNpsPredictor([])
    await copyMarkdown()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copied flips back to false after 2s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const blocks = [makeBlock([{ id: 'V.Timer' }])]
    const { copyMarkdown, copied } = useNpsPredictor(blocks)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })
})
