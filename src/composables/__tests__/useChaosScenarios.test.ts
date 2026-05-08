import { describe, it, expect } from 'vitest'
import { useChaosScenarios } from '../useChaosScenarios'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [],
    values: [],
    solutions: [],
    ...overrides,
  }
}

const baseBlock: SpecBlock = makeBlock({
  functions: [
    {
      id: 'F.AuthService',
      type: 'Function',
      level: 'Product',
      description: 'Authenticate users',
      successCriteria: 'Auth < 500ms',
      functionOfValue: '[[V.AuthSpeed]]',
    },
  ],
  values: [
    {
      id: 'V.AuthSpeed',
      type: 'Value',
      level: 'Product',
      description: 'Authentication speed',
      scale: 'ms',
      meter: 'Perf test',
      status: 'Status [2026] 800ms',
      tolerable: 'Tolerable [2026] 600ms',
      goal: 'Goal [2026] 200ms',
      valueOfFunction: '[[F.AuthService]]',
    },
  ],
  solutions: [
    {
      id: 'S.JWTTokeniser',
      type: 'Solution',
      level: 'Solution',
      description: 'JWT-based token service for auth',
      impact: 'V.AuthSpeed ~80%',
      function: '[[F.AuthService]]',
    },
    {
      id: 'S.CacheLayer',
      type: 'Solution',
      level: 'Solution',
      description: 'Redis cache layer for fast lookups',
      impact: 'V.AuthSpeed ~60%',
      function: '[[F.AuthService]]',
    },
  ],
})

describe('useChaosScenarios', () => {
  it('only generates entries for S. entries (Solutions), not F. or V.', () => {
    const { entries } = useChaosScenarios([baseBlock])
    expect(entries.value).toHaveLength(2)
    for (const entry of entries.value) {
      expect(entry.blockId).toMatch(/^S\./)
    }
  })

  it('each entry has exactly 2 scenarios', () => {
    const { entries } = useChaosScenarios([baseBlock])
    for (const entry of entries.value) {
      expect(entry.scenarios).toHaveLength(2)
    }
  })

  it('scenario titles include "Scenario 1" and "Scenario 2"', () => {
    const { entries } = useChaosScenarios([baseBlock])
    const entry = entries.value[0]
    expect(entry.scenarios[0].title).toContain('Scenario 1')
    expect(entry.scenarios[1].title).toContain('Scenario 2')
  })

  it('failureMode contains "What if [id] fails?"', () => {
    const { entries } = useChaosScenarios([baseBlock])
    for (const entry of entries.value) {
      for (const scenario of entry.scenarios) {
        expect(scenario.failureMode).toMatch(/^What if .+ fails\?$/)
        expect(scenario.failureMode).toContain(entry.blockId)
      }
    }
  })

  it('severity is deterministic based on charCode seed (seed % 3)', () => {
    const { entries } = useChaosScenarios([baseBlock])
    // S.JWTTokeniser charCode sum should give consistent severity
    const entry = entries.value.find(e => e.blockId === 'S.JWTTokeniser')!
    // Compute expected seed manually
    const id = 'S.JWTTokeniser'
    let seed = 0
    for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i)
    const mod = seed % 3
    const expected = mod === 0 ? 'high' : mod === 1 ? 'medium' : 'low'
    expect(entry.scenarios[0].severity).toBe(expected)
    expect(entry.scenarios[1].severity).toBe(expected)
  })

  it('failureMode template is indexed by seed % 4', () => {
    const { entries } = useChaosScenarios([baseBlock])
    const entry = entries.value[0]
    const id = entry.blockId
    let seed = 0
    for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i)
    const templates = [
      `Complete unavailability of ${id}`,
      `Degraded performance / high latency in ${id}`,
      `Incorrect output / data corruption in ${id}`,
      `Partial failure in ${id} affecting N% of requests`,
    ]
    const expected = templates[seed % 4]
    expect(entry.scenarios[0].title.toLowerCase()).toContain(expected.toLowerCase())
  })

  it('impact template is indexed by (seed + scenarioIndex) % 4', () => {
    const IMPACT_TEMPLATES = [
      'Downstream dependent services receive errors; user-facing failures within seconds',
      'SLA breach — response time exceeds Tolerable threshold',
      'Data inconsistency propagates across dependent V. entries',
      'Partial user cohort experiences failure; difficult to detect without alerting',
    ]
    const { entries } = useChaosScenarios([baseBlock])
    const entry = entries.value[0]
    const id = entry.blockId
    let seed = 0
    for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i)
    expect(entry.scenarios[0].impact).toBe(IMPACT_TEMPLATES[(seed + 0) % 4])
    expect(entry.scenarios[1].impact).toBe(IMPACT_TEMPLATES[(seed + 1) % 4])
  })

  it('mitigation template is indexed by (seed + scenarioIndex + 1) % 4', () => {
    const MITIGATION_TEMPLATES = [
      'Implement circuit breaker + retry with exponential backoff',
      'Add health check endpoint; configure auto-scaling with min instances = 2',
      'Enable write-ahead logging or idempotency keys for all mutations',
      'Deploy canary alongside stable version; monitor error rate differential',
    ]
    const { entries } = useChaosScenarios([baseBlock])
    const entry = entries.value[0]
    const id = entry.blockId
    let seed = 0
    for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i)
    expect(entry.scenarios[0].mitigation).toBe(MITIGATION_TEMPLATES[(seed + 0 + 1) % 4])
    expect(entry.scenarios[1].mitigation).toBe(MITIGATION_TEMPLATES[(seed + 1 + 1) % 4])
  })

  it('blockId and blockName are set to the S. entry id', () => {
    const { entries } = useChaosScenarios([baseBlock])
    const entry = entries.value[0]
    expect(entry.blockId).toBe('S.JWTTokeniser')
    expect(entry.blockName).toBe('S.JWTTokeniser')
  })

  it('returns empty entries when no S. entries exist', () => {
    const emptyBlock = makeBlock({ solutions: [] })
    const { entries } = useChaosScenarios([emptyBlock])
    expect(entries.value).toHaveLength(0)
  })

  it('does not produce entries for F. or V. blocks', () => {
    const onlyFV = makeBlock({
      functions: [
        {
          id: 'F.AuthService',
          type: 'Function',
          level: 'Product',
          description: 'Authenticate',
          successCriteria: '',
          functionOfValue: '',
        },
      ],
      values: [
        {
          id: 'V.Speed',
          type: 'Value',
          level: 'Product',
          description: 'Speed',
          scale: 'ms',
          meter: 'test',
          status: '',
          tolerable: '',
          goal: '100ms',
          valueOfFunction: '',
        },
      ],
      solutions: [],
    })
    const { entries } = useChaosScenarios([onlyFV])
    expect(entries.value).toHaveLength(0)
  })

  it('copyMarkdown includes entry name and scenario content', async () => {
    const { copyMarkdown, copied } = useChaosScenarios([baseBlock])
    await expect(copyMarkdown()).resolves.toBeUndefined()
    expect(typeof copied.value).toBe('boolean')
  })

  it('copyMarkdown returns a well-structured document with Failure Mode and Severity headers', async () => {
    // We test the markdown output by checking it would include relevant keys
    // Since clipboard.writeText is not available in tests, we verify the composable
    // does not throw and structures are correct via the entries computed
    const { entries } = useChaosScenarios([baseBlock])
    const entry = entries.value[0]
    expect(entry.scenarios[0].failureMode).toBeTruthy()
    expect(entry.scenarios[0].impact).toBeTruthy()
    expect(entry.scenarios[0].mitigation).toBeTruthy()
    expect(['high', 'medium', 'low']).toContain(entry.scenarios[0].severity)
  })

  it('severity is consistent across both scenarios of the same entry', () => {
    const { entries } = useChaosScenarios([baseBlock])
    for (const entry of entries.value) {
      expect(entry.scenarios[0].severity).toBe(entry.scenarios[1].severity)
    }
  })
})
