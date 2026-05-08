// UNIT_TYPE=Test
// Feature #114 — useVelocityTracker composable tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseStatusNum,
  buildSparklinePoints,
  computeTrend,
  useVelocityTracker,
} from '../useVelocityTracker'
import type { SpecBlock } from '../../types/spec'

function makeBlock(values: Array<{ id: string; status?: string }>): SpecBlock {
  return {
    functions: [],
    values: values.map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: `Desc ${v.id}`,
      scale: '',
      meter: '',
      status: v.status ?? '',
      tolerable: '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

// Mock sessionStorage before each test
const mockSessionStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockSessionStorage.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockSessionStorage.store[key] = value }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage.store[key] }),
  clear: vi.fn(() => { mockSessionStorage.store = {} }),
}

beforeEach(() => {
  mockSessionStorage.store = {}
  mockSessionStorage.getItem.mockClear()
  mockSessionStorage.setItem.mockClear()
  mockSessionStorage.removeItem.mockClear()
  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseStatusNum', () => {
  it('extracts first numeric value from status string', () => {
    expect(parseStatusNum('Status: 75%')).toBe(75)
  })

  it('returns 0 for empty string', () => {
    expect(parseStatusNum('')).toBe(0)
  })

  it('returns 0 when no number present', () => {
    expect(parseStatusNum('no numbers here')).toBe(0)
  })

  it('handles comma-formatted numbers', () => {
    expect(parseStatusNum('1,500 entries')).toBe(1500)
  })

  it('uses first number when multiple present', () => {
    expect(parseStatusNum('10 out of 100')).toBe(10)
  })
})

describe('buildSparklinePoints', () => {
  it('returns empty string for empty history', () => {
    expect(buildSparklinePoints([])).toBe('')
  })

  it('returns a flat line for single point history', () => {
    const pts = buildSparklinePoints([{ statusNum: 50 }])
    expect(pts).toBeTruthy()
    // single point should produce a pair of points
    expect(pts.split(' ')).toHaveLength(2)
  })

  it('returns correct number of points for multi-entry history', () => {
    const history = [
      { statusNum: 10 },
      { statusNum: 20 },
      { statusNum: 30 },
    ]
    const pts = buildSparklinePoints(history)
    const pairs = pts.trim().split(' ')
    expect(pairs).toHaveLength(3)
  })

  it('first x is 0 for multi-point history', () => {
    const history = [{ statusNum: 10 }, { statusNum: 20 }]
    const pts = buildSparklinePoints(history)
    // First pair x value should be 0 (may be formatted as "0.0")
    const firstX = parseFloat(pts.split(' ')[0].split(',')[0])
    expect(firstX).toBe(0)
  })

  it('last x is 40 for multi-point history', () => {
    const history = [{ statusNum: 10 }, { statusNum: 20 }]
    const pts = buildSparklinePoints(history)
    const pairs = pts.trim().split(' ')
    const lastX = parseFloat(pairs[pairs.length - 1].split(',')[0])
    expect(lastX).toBe(40)
  })

  it('normalizes y values to 0–20 range', () => {
    const history = [{ statusNum: 0 }, { statusNum: 100 }]
    const pts = buildSparklinePoints(history)
    const pairs = pts.trim().split(' ')
    const ys = pairs.map(p => parseFloat(p.split(',')[1]))
    const allInRange = ys.every(y => y >= 0 && y <= 20)
    expect(allInRange).toBe(true)
  })
})

describe('computeTrend', () => {
  it('returns → for single-entry history', () => {
    expect(computeTrend([{ statusNum: 50 }])).toBe('→')
  })

  it('returns → for empty history', () => {
    expect(computeTrend([])).toBe('→')
  })

  it('returns ↑ when last > first', () => {
    expect(computeTrend([{ statusNum: 10 }, { statusNum: 90 }])).toBe('↑')
  })

  it('returns ↓ when last < first', () => {
    expect(computeTrend([{ statusNum: 90 }, { statusNum: 10 }])).toBe('↓')
  })

  it('returns → when first equals last', () => {
    expect(computeTrend([{ statusNum: 50 }, { statusNum: 50 }])).toBe('→')
  })
})

describe('useVelocityTracker', () => {
  it('entries has one entry per V. entry', () => {
    const block = makeBlock([{ id: 'V.Alpha' }, { id: 'V.Beta' }])
    const { entries } = useVelocityTracker([block])
    expect(entries.value).toHaveLength(2)
  })

  it('entry id matches V. entry id', () => {
    const block = makeBlock([{ id: 'V.EntryFluency' }])
    const { entries } = useVelocityTracker([block])
    expect(entries.value[0].id).toBe('V.EntryFluency')
  })

  it('velocityScore is 0 when no history', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { velocityScore } = useVelocityTracker([block])
    expect(velocityScore.value).toBe(0)
  })

  it('overallTrend is → when no history data', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { overallTrend } = useVelocityTracker([block])
    expect(overallTrend.value).toBe('→')
  })

  it('clearHistory removes sessionStorage key', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { clearHistory } = useVelocityTracker([block])
    clearHistory()
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('sem-velocity-v1')
  })

  it('clearHistory resets historyMap', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { entries, clearHistory } = useVelocityTracker([block])
    clearHistory()
    expect(entries.value[0].history).toHaveLength(0)
  })

  it('sparklinePoints is empty string when no history', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { entries } = useVelocityTracker([block])
    expect(entries.value[0].sparklinePoints).toBe('')
  })

  it('recordSnapshot adds to history for each V. entry', () => {
    const block = makeBlock([{ id: 'V.Alpha', status: 'Status: 50%' }])
    const { entries, recordSnapshot } = useVelocityTracker([block])
    recordSnapshot()
    expect(entries.value[0].history.length).toBeGreaterThanOrEqual(1)
  })

  it('copied starts as false', () => {
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { copied } = useVelocityTracker([block])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown sets copied to true on success', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { copyMarkdown, copied } = useVelocityTracker([block])
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })

  it('markdown output contains Name and Snapshots headers', async () => {
    let written = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          written = text
          return Promise.resolve()
        }),
      },
    })
    const block = makeBlock([{ id: 'V.Alpha' }])
    const { copyMarkdown } = useVelocityTracker([block])
    await copyMarkdown()
    expect(written).toContain('Name')
    expect(written).toContain('Snapshots')
    expect(written).toContain('Trend')
  })

  it('returns empty entries for block with no V. entries', () => {
    const block: SpecBlock = { functions: [], values: [], solutions: [] }
    const { entries } = useVelocityTracker([block])
    expect(entries.value).toHaveLength(0)
  })
})
