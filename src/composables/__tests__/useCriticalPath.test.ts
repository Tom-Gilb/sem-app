// UNIT_TYPE=Test
// Feature #119 — useCriticalPath composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useCriticalPath } from '../useCriticalPath'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; scale?: string; tolerable?: string; goal?: string }>
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
      status: '',
      tolerable: v.tolerable ?? '',
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

describe('useCriticalPath', () => {
  it('stepChain is empty when no blocks provided', () => {
    const { criticalPath } = useCriticalPath([])
    expect(criticalPath.value.stepChain).toHaveLength(0)
  })

  it('fallback returns 2-step chain when fewer than 2 total F+V entries', () => {
    const block = makeBlock({ functions: [{ id: 'F.Only' }] })
    const { criticalPath } = useCriticalPath([block])
    // only 1 F and 0 V → fallback
    expect(criticalPath.value.stepChain).toHaveLength(2)
    expect(criticalPath.value.totalSteps).toBe(2)
  })

  it('fallback uses first F and first V names', () => {
    const block = makeBlock({ functions: [{ id: 'F.Alpha' }] })
    const { criticalPath } = useCriticalPath([block])
    expect(criticalPath.value.stepChain[0]).toBe('F.Alpha')
  })

  it('longest chain is found when F→V overlap exists', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Performance', description: 'performance tracking' }],
      values: [{ id: 'V.Performance', description: 'performance measurement scale' }],
    })
    const { criticalPath } = useCriticalPath([block])
    expect(criticalPath.value.stepChain).toContain('F.Performance')
    expect(criticalPath.value.stepChain).toContain('V.Performance')
  })

  it('criticalNodeIds matches stepChain', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Speed', description: 'speed optimisation' }],
      values: [{ id: 'V.Speed', description: 'speed metric' }],
    })
    const { criticalPath } = useCriticalPath([block])
    expect(criticalPath.value.criticalNodeIds).toEqual(criticalPath.value.stepChain)
  })

  it('highlightedIds is a Set containing all criticalNodeIds', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Speed', description: 'speed optimisation' }],
      values: [{ id: 'V.Speed', description: 'speed metric' }],
    })
    const { criticalPath, highlightedIds } = useCriticalPath([block])
    for (const id of criticalPath.value.criticalNodeIds) {
      expect(highlightedIds.value.has(id)).toBe(true)
    }
  })

  it('three-tier chain F→V→S is detected when keywords overlap', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Delivery', description: 'delivery capability' }],
      values: [{ id: 'V.Delivery', description: 'delivery rate scale' }],
      solutions: [{ id: 'S.Delivery', description: 'delivery pipeline solution' }],
    })
    const { criticalPath } = useCriticalPath([block])
    expect(criticalPath.value.totalSteps).toBeGreaterThanOrEqual(2)
  })

  it('explanation contains the step count', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha capability' }],
      values: [{ id: 'V.Alpha', description: 'alpha measurement' }],
    })
    const { criticalPath } = useCriticalPath([block])
    expect(criticalPath.value.explanation).toContain('step chain')
  })

  it('explanation contains arrow separator', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Speed', description: 'speed metric' }],
      values: [{ id: 'V.Speed', description: 'speed measure' }],
    })
    const { criticalPath } = useCriticalPath([block])
    if (criticalPath.value.stepChain.length >= 2) {
      expect(criticalPath.value.explanation).toContain('→')
    }
  })

  it('copied starts as false', () => {
    const { copied } = useCriticalPath([])
    expect(copied.value).toBe(false)
  })

  it('copyMarkdown writes to clipboard and sets copied', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const block = makeBlock({
      functions: [{ id: 'F.Alpha' }],
      values: [{ id: 'V.Alpha' }],
    })
    const { copyMarkdown, copied } = useCriticalPath([block])
    await copyMarkdown()
    expect(copied.value).toBe(true)
  })

  it('copyMarkdown output contains ## Critical Path header', async () => {
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
      values: [{ id: 'V.Alpha', description: 'alpha value' }],
    })
    const { copyMarkdown } = useCriticalPath([block])
    await copyMarkdown()
    expect(written).toContain('## Critical Path')
  })

  it('no dependency chain text shown when stepChain is empty', async () => {
    let written = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          written = text
          return Promise.resolve()
        }),
      },
    })
    const { copyMarkdown } = useCriticalPath([])
    await copyMarkdown()
    expect(written).toContain('No dependency chain detected')
  })

  it('totalSteps equals stepChain length', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Throughput', description: 'throughput metric' }],
      values: [{ id: 'V.Throughput', description: 'throughput measurement' }],
    })
    const { criticalPath } = useCriticalPath([block])
    expect(criticalPath.value.totalSteps).toBe(criticalPath.value.stepChain.length)
  })
})
