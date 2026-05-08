// UNIT_TYPE=Test
// Feature #42 — Tests for useGoalSensitivity composable

import { describe, it, expect } from 'vitest'
import { useGoalSensitivity } from '../useGoalSensitivity'
import type { SpecBlock } from '../../types/spec'

const { applyMultiplier } = useGoalSensitivity()

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSpec(goal: string, tolerable: string): SpecBlock {
  return {
    functions: [],
    solutions: [],
    values: [
      {
        id: 'V.Test',
        type: 'Value',
        level: 'Product',
        description: 'Test value',
        scale: 'Percentage',
        meter: 'Automated tests',
        status: '50%',
        tolerable,
        goal,
        valueOfFunction: '',
      },
    ],
  }
}

function makeMultiValueSpec(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.One',
        type: 'Function',
        level: 'Product',
        description: 'Function one',
        successCriteria: 'Passes tests',
        functionOfValue: 'V.Speed',
      },
    ],
    solutions: [
      {
        id: 'S.One',
        type: 'Solution',
        level: 'Product',
        description: 'Solution one',
        impact: 'V.Speed ~80%',
        function: 'F.One',
      },
    ],
    values: [
      {
        id: 'V.Speed',
        type: 'Value',
        level: 'Product',
        description: 'System speed',
        scale: 'Milliseconds',
        meter: 'Timer',
        status: '200ms',
        tolerable: '500ms',
        goal: '100ms',
        valueOfFunction: 'F.One',
      },
      {
        id: 'V.Accuracy',
        type: 'Value',
        level: 'Product',
        description: 'System accuracy',
        scale: 'Percentage',
        meter: 'Test suite',
        status: '70%',
        tolerable: '80%',
        goal: '95%',
        valueOfFunction: 'F.One',
      },
    ],
  }
}

// ── multiplier = 1.0 ─────────────────────────────────────────────────────────

describe('useGoalSensitivity — multiplier 1.0', () => {
  it('multiplier=1.0 returns identical goal value', () => {
    const spec = makeSpec('Goal [2025] 80%', 'Tolerable [2025] 60%')
    const result = applyMultiplier(spec, 1.0)
    expect(result.values[0].goal).toBe('Goal [2025] 80%')
  })

  it('multiplier=1.0 returns identical tolerable value', () => {
    const spec = makeSpec('Goal [2025] 80%', 'Tolerable [2025] 60%')
    const result = applyMultiplier(spec, 1.0)
    expect(result.values[0].tolerable).toBe('Tolerable [2025] 60%')
  })

  it('multiplier=1.0 does not mutate the original spec', () => {
    const spec = makeSpec('95%', '70%')
    const result = applyMultiplier(spec, 1.0)
    expect(result).not.toBe(spec)
    expect(result.values[0]).not.toBe(spec.values[0])
  })
})

// ── multiplier = 2.0 ─────────────────────────────────────────────────────────

describe('useGoalSensitivity — multiplier 2.0', () => {
  it('multiplier=2.0 doubles numeric goal value', () => {
    const spec = makeSpec('80%', '60%')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toBe('160%')
  })

  it('multiplier=2.0 doubles numeric tolerable value', () => {
    const spec = makeSpec('80%', '60%')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].tolerable).toBe('120%')
  })

  it('multiplier=2.0 doubles goal with surrounding text (no leading year)', () => {
    // The regex finds the FIRST number, so avoid years in brackets
    // Use a format that has the number value first
    const spec = makeSpec('Goal [release] 50ms', 'Tolerable 25ms')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toBe('Goal [release] 100ms')
  })

  it('multiplier=2.0 doubles integer ms value correctly', () => {
    const spec = makeSpec('100ms', '500ms')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toBe('200ms')
    expect(result.values[0].tolerable).toBe('1000ms')
  })
})

// ── multiplier = 0.5 ─────────────────────────────────────────────────────────

describe('useGoalSensitivity — multiplier 0.5', () => {
  it('multiplier=0.5 halves numeric goal value', () => {
    const spec = makeSpec('80%', '60%')
    const result = applyMultiplier(spec, 0.5)
    expect(result.values[0].goal).toBe('40%')
  })

  it('multiplier=0.5 halves numeric tolerable value', () => {
    const spec = makeSpec('80%', '60%')
    const result = applyMultiplier(spec, 0.5)
    expect(result.values[0].tolerable).toBe('30%')
  })

  it('multiplier=0.5 on 100ms gives 50ms', () => {
    const spec = makeSpec('100ms', '200ms')
    const result = applyMultiplier(spec, 0.5)
    expect(result.values[0].goal).toBe('50ms')
    expect(result.values[0].tolerable).toBe('100ms')
  })
})

// ── Non-numeric strings ───────────────────────────────────────────────────────

describe('useGoalSensitivity — non-numeric strings', () => {
  it('non-numeric goal string is left unchanged', () => {
    const spec = makeSpec('TBD', 'TBD')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toBe('TBD')
  })

  it('empty goal string is left unchanged', () => {
    const spec = makeSpec('', '')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toBe('')
  })

  it('goal with no number is left unchanged by any multiplier', () => {
    const spec = makeSpec('Meets user expectations', 'Acceptable quality')
    const result = applyMultiplier(spec, 1.5)
    expect(result.values[0].goal).toBe('Meets user expectations')
    expect(result.values[0].tolerable).toBe('Acceptable quality')
  })
})

// ── Units preservation ────────────────────────────────────────────────────────

describe('useGoalSensitivity — units preserved', () => {
  it('% unit is preserved', () => {
    const spec = makeSpec('95%', '70%')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toContain('%')
  })

  it('ms unit is preserved', () => {
    const spec = makeSpec('100ms', '500ms')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toContain('ms')
    expect(result.values[0].tolerable).toContain('ms')
  })

  it('USD unit is preserved', () => {
    const spec = makeSpec('1000 USD', '2000 USD')
    const result = applyMultiplier(spec, 1.5)
    expect(result.values[0].goal).toContain('USD')
    expect(result.values[0].goal).toBe('1500 USD')
  })

  it('prefix text before number is preserved', () => {
    const spec = makeSpec('Goal: 80 points', 'Min: 50 points')
    const result = applyMultiplier(spec, 2.0)
    expect(result.values[0].goal).toBe('Goal: 160 points')
    expect(result.values[0].tolerable).toBe('Min: 100 points')
  })

  it('fractional result is formatted to 1 decimal place', () => {
    const spec = makeSpec('3%', '2%')
    const result = applyMultiplier(spec, 1.5)
    // 3 * 1.5 = 4.5
    expect(result.values[0].goal).toBe('4.5%')
  })
})

// ── Multiple V. entries ───────────────────────────────────────────────────────

describe('useGoalSensitivity — multiple V. entries', () => {
  it('multiplier applies to all V. entries', () => {
    const result = applyMultiplier(makeMultiValueSpec(), 2.0)
    expect(result.values[0].goal).toBe('200ms')
    expect(result.values[1].goal).toBe('190%')
  })

  it('functions and solutions are unchanged by applyMultiplier', () => {
    const spec = makeMultiValueSpec()
    const result = applyMultiplier(spec, 2.0)
    expect(result.functions).toBe(spec.functions)
    expect(result.solutions).toBe(spec.solutions)
  })
})
