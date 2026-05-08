// UNIT_TYPE=Test
// Tests for useAmbitious composable (Feature #19)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAmbitious } from '../useAmbitious'
import type { SpecBlock } from '../../types/spec'

vi.stubEnv('VITE_MOCK_MODE', 'false') // let apiKey control mock path

const specWith90: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function',
      successCriteria: 'It works',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Test value',
      scale: '% passing',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Test solution',
      impact: 'V.Test ~90%',
      function: 'F.Test',
    },
  ],
}

describe('useAmbitious — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('makeAmbitious in mock mode returns a SpecBlock', async () => {
    const { result, makeAmbitious } = useAmbitious()
    // No apiKey → mock mode
    const promise = makeAmbitious(specWith90)
    vi.runAllTimersAsync()
    const out = await promise
    expect(out).not.toBeNull()
    expect(out?.functions).toBeDefined()
    expect(out?.values).toBeDefined()
    expect(out?.solutions).toBeDefined()
    expect(result.value).not.toBeNull()
  })

  it('Goal values are higher than input Goals (numeric comparison)', async () => {
    const { makeAmbitious } = useAmbitious()
    const promise = makeAmbitious(specWith90)
    vi.runAllTimersAsync()
    const out = await promise
    expect(out).not.toBeNull()

    for (let i = 0; i < specWith90.values.length; i++) {
      const originalGoal = specWith90.values[i].goal
      const newGoal = out!.values[i].goal
      // Extract numeric parts and compare
      const originalNum = parseFloat(originalGoal.match(/[\d]+(?:\.\d+)?/)?.[0] ?? '0')
      const newNum = parseFloat(newGoal.match(/[\d]+(?:\.\d+)?/)?.[0] ?? '0')
      if (originalNum > 0) {
        expect(newNum).toBeGreaterThan(originalNum)
      }
    }
  })

  it('result ref is populated after makeAmbitious', async () => {
    const { result, makeAmbitious } = useAmbitious()
    expect(result.value).toBeNull()
    const promise = makeAmbitious(specWith90)
    vi.runAllTimersAsync()
    await promise
    expect(result.value).not.toBeNull()
  })

  it('loading cycles true → false', async () => {
    const { loading, makeAmbitious } = useAmbitious()
    expect(loading.value).toBe(false)
    const promise = makeAmbitious(specWith90)
    expect(loading.value).toBe(true)
    vi.runAllTimersAsync()
    await promise
    expect(loading.value).toBe(false)
  })

  // ── Change 2 — Ambition Level auto-population ────────────────────────────────

  it('each V. entry has an ambitionLevel array after makeAmbitious', async () => {
    const { makeAmbitious } = useAmbitious()
    const promise = makeAmbitious(specWith90)
    vi.runAllTimersAsync()
    const out = await promise
    expect(out).not.toBeNull()
    for (const v of out!.values) {
      expect(Array.isArray(v.ambitionLevel)).toBe(true)
      expect(v.ambitionLevel!.length).toBeGreaterThan(0)
    }
  })

  it('ambitionLevel entry has source="app" in mock mode', async () => {
    const { makeAmbitious } = useAmbitious()
    const promise = makeAmbitious(specWith90)
    vi.runAllTimersAsync()
    const out = await promise
    expect(out).not.toBeNull()
    const al = out!.values[0].ambitionLevel!
    expect(al[0].source).toBe('app')
  })

  it('ambitionLevel label contains "Make Ambitious"', async () => {
    const { makeAmbitious } = useAmbitious()
    const promise = makeAmbitious(specWith90)
    vi.runAllTimersAsync()
    const out = await promise
    const al = out!.values[0].ambitionLevel!
    expect(al[0].label).toMatch(/Make Ambitious/)
  })

  it('pre-existing ambitionLevel entries are preserved (append, not replace)', async () => {
    const { makeAmbitious } = useAmbitious()
    // Add an existing stakeholder-sourced entry
    const specWithExistingAL = {
      ...specWith90,
      values: specWith90.values.map((v) => ({
        ...v,
        ambitionLevel: [{ source: 'stakeholder' as const, text: 'Zero defects aspiration' }],
      })),
    }
    const promise = makeAmbitious(specWithExistingAL)
    vi.runAllTimersAsync()
    const out = await promise
    expect(out).not.toBeNull()
    const al = out!.values[0].ambitionLevel!
    // Should have 2 entries: the original stakeholder entry + the new app entry
    expect(al.length).toBe(2)
    expect(al[0].source).toBe('stakeholder')
    expect(al[1].source).toBe('app')
  })
})
