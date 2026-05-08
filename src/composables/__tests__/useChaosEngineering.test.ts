// UNIT_TYPE=Test
// Feature #146 — useChaosEngineering composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useChaosEngineering } from '../useChaosEngineering'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string }>
  solutions?: Array<{ id: string; description?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map((f) => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map((v) => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: '',
      scale: '',
      meter: '',
      status: '',
      tolerable: '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: (overrides?.solutions ?? []).map((s) => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: s.description ?? '',
      impact: '',
      function: '',
    })),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useChaosEngineering', () => {
  it('creates one ChaosScenario per S. entry', () => {
    const block = makeBlock({
      solutions: [
        { id: 'S.AuthService' },
        { id: 'S.DataPipeline' },
        { id: 'S.CacheLayer' },
      ],
    })
    const { chaosScenarios } = useChaosEngineering([block])
    expect(chaosScenarios.value).toHaveLength(3)
  })

  it('each ChaosScenario has exactly 2 ChaosCase entries', () => {
    const block = makeBlock({ solutions: [{ id: 'S.PaymentGateway' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    expect(chaosScenarios.value[0].scenarios).toHaveLength(2)
  })

  it('sEntryId and sEntryName are set to the S. entry id', () => {
    const block = makeBlock({ solutions: [{ id: 'S.UserAuth' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    const scenario = chaosScenarios.value[0]
    expect(scenario.sEntryId).toBe('S.UserAuth')
    expect(scenario.sEntryName).toBe('S.UserAuth')
  })

  it('ChaosCase titles come from the 8-entry title bank', () => {
    const BANK = [
      'Latency spike',
      'Dependency timeout',
      'Data corruption',
      'Resource exhaustion',
      'Network partition',
      'Auth service failure',
      'Cache miss storm',
      'Queue backlog',
    ]
    const block = makeBlock({ solutions: [{ id: 'S.Test' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    const cases = chaosScenarios.value[0].scenarios
    expect(BANK).toContain(cases[0].title)
    expect(BANK).toContain(cases[1].title)
  })

  it('case 2 title is offset by 4 from case 1 (deterministic)', () => {
    const BANK = [
      'Latency spike',
      'Dependency timeout',
      'Data corruption',
      'Resource exhaustion',
      'Network partition',
      'Auth service failure',
      'Cache miss storm',
      'Queue backlog',
    ]
    const block = makeBlock({ solutions: [{ id: 'S.MyService' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    const cases = chaosScenarios.value[0].scenarios
    const title1Idx = BANK.indexOf(cases[0].title)
    const title2Idx = BANK.indexOf(cases[1].title)
    expect(title1Idx).toBeGreaterThanOrEqual(0)
    expect(title2Idx).toBeGreaterThanOrEqual(0)
    // offset of 4 (mod 8)
    expect((title1Idx + 4) % 8).toBe(title2Idx)
  })

  it('injection uses "Inject Ns delay" for case 1', () => {
    const block = makeBlock({ solutions: [{ id: 'S.Alpha' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    const case1 = chaosScenarios.value[0].scenarios[0]
    expect(case1.injection).toMatch(/^Inject \d+s delay$/)
  })

  it('injection uses "Inject X% error rate" for case 2', () => {
    const block = makeBlock({ solutions: [{ id: 'S.Alpha' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    const case2 = chaosScenarios.value[0].scenarios[1]
    expect(case2.injection).toMatch(/^Inject \d+% error rate$/)
  })

  it('impact is derived from S. description first 30 chars + " degraded"', () => {
    const desc = 'This is a very long description text that exceeds thirty chars'
    const block = makeBlock({
      solutions: [{ id: 'S.Fast', description: desc }],
    })
    const { chaosScenarios } = useChaosEngineering([block])
    const case1 = chaosScenarios.value[0].scenarios[0]
    expect(case1.impact).toBe(desc.slice(0, 30) + ' degraded')
  })

  it('severity is high when seed%3===0, medium when seed%3===1, low otherwise', () => {
    // charCodeSum('S.A') = 83+46+65 = 194; 194%3 = 2 → low
    const blockA = makeBlock({ solutions: [{ id: 'S.A' }] })
    const { chaosScenarios: cs1 } = useChaosEngineering([blockA])
    expect(cs1.value[0].scenarios[0].severity).toBe('low')

    // charCodeSum('S.B') = 83+46+66 = 195; 195%3 = 0 → high
    const blockB = makeBlock({ solutions: [{ id: 'S.B' }] })
    const { chaosScenarios: cs2 } = useChaosEngineering([blockB])
    expect(cs2.value[0].scenarios[0].severity).toBe('high')
  })

  it('mock is deterministic — same input always yields same output', () => {
    const block = makeBlock({ solutions: [{ id: 'S.Deterministic' }] })
    const { chaosScenarios: cs1 } = useChaosEngineering([block])
    const { chaosScenarios: cs2 } = useChaosEngineering([block])
    expect(cs1.value[0].scenarios[0].title).toBe(cs2.value[0].scenarios[0].title)
    expect(cs1.value[0].scenarios[0].injection).toBe(cs2.value[0].scenarios[0].injection)
    expect(cs1.value[0].scenarios[0].severity).toBe(cs2.value[0].scenarios[0].severity)
  })

  it('empty blocks produces empty chaosScenarios', () => {
    const { chaosScenarios } = useChaosEngineering([])
    expect(chaosScenarios.value).toHaveLength(0)
  })

  it('block with no solutions produces empty chaosScenarios', () => {
    const block = makeBlock({ functions: [{ id: 'F.Only' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    expect(chaosScenarios.value).toHaveLength(0)
  })

  it('copyMarkdown writes a markdown table per S. entry', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const block = makeBlock({
      solutions: [{ id: 'S.Service', description: 'Core auth service' }],
    })
    const { copyMarkdown } = useChaosEngineering([block])
    await copyMarkdown()
    expect(writeText).toHaveBeenCalledOnce()
    const text: string = writeText.mock.calls[0][0]
    expect(text).toContain('S.Service')
    expect(text).toContain('Title')
    expect(text).toContain('Injection')
    expect(text).toContain('Severity')
  })

  it('copied starts false, flips true after copyMarkdown, reverts to false after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const block = makeBlock({ solutions: [{ id: 'S.CopyTest' }] })
    const { copyMarkdown, copied } = useChaosEngineering([block])
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2001)
    expect(copied.value).toBe(false)
    vi.useRealTimers()
  })

  it('each ChaosCase has all required fields (title, injection, impact, severity)', () => {
    const block = makeBlock({ solutions: [{ id: 'S.FullCheck', description: 'service layer' }] })
    const { chaosScenarios } = useChaosEngineering([block])
    for (const c of chaosScenarios.value[0].scenarios) {
      expect(c.title).toBeTruthy()
      expect(c.injection).toBeTruthy()
      expect(c.impact).toBeTruthy()
      expect(['high', 'medium', 'low']).toContain(c.severity)
    }
  })

  it('multiple blocks aggregate all S. entries', () => {
    const block1 = makeBlock({ solutions: [{ id: 'S.One' }] })
    const block2 = makeBlock({ solutions: [{ id: 'S.Two' }, { id: 'S.Three' }] })
    const { chaosScenarios } = useChaosEngineering([block1, block2])
    expect(chaosScenarios.value).toHaveLength(3)
  })
})
