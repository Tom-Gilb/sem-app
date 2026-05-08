// Feature #164 — useRiskValue tests
import { useRiskValue } from '../useRiskValue'
import type { SpecBlock } from '../../types/spec'

function makeBlock(vIds: string[], fIds: string[] = []): SpecBlock {
  return {
    functions: fIds.map(id => ({
      id,
      type: 'Function',
      level: 'Business',
      description: `Function description for ${id}`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: vIds.map(id => ({
      id,
      type: 'Value',
      level: 'Business',
      description: `Value description for ${id}`,
      scale: 'Scale',
      meter: 'Meter',
      status: 'Status',
      tolerable: 'Tolerable',
      goal: `Goal [2026, condition] 80`,
      valueOfFunction: '',
    })),
    solutions: [],
  }
}

const FIBONACCI = [1, 2, 3, 5, 8]

describe('useRiskValue', () => {
  it('open starts as false', () => {
    const { open } = useRiskValue([])
    expect(open.value).toBe(false)
  })

  it('entries is empty for empty blocks', () => {
    const { entries } = useRiskValue([])
    expect(entries.value).toHaveLength(0)
  })

  it('entries count matches total V. entries across blocks', () => {
    const block = makeBlock(['V.A', 'V.B', 'V.C'])
    const { entries } = useRiskValue([block])
    expect(entries.value).toHaveLength(3)
  })

  it('entries count works across multiple blocks', () => {
    const b1 = makeBlock(['V.A', 'V.B'])
    const b2 = makeBlock(['V.C'])
    const { entries } = useRiskValue([b1, b2])
    expect(entries.value).toHaveLength(3)
  })

  it('seeding is deterministic — same input → same output', () => {
    const block = makeBlock(['V.TestId'])
    const { entries: e1 } = useRiskValue([block])
    const { entries: e2 } = useRiskValue([block])
    expect(e1.value[0].probability).toBe(e2.value[0].probability)
    expect(e1.value[0].adjustedValue).toBe(e2.value[0].adjustedValue)
  })

  it('default probability is seeded between 50 and 89', () => {
    const block = makeBlock(['V.SeedTest'])
    const { entries } = useRiskValue([block])
    expect(entries.value[0].probability).toBeGreaterThanOrEqual(50)
    expect(entries.value[0].probability).toBeLessThanOrEqual(89)
  })

  it('setProbability clamps value to 0 minimum', () => {
    const block = makeBlock(['V.Clamp'])
    const { entries, setProbability } = useRiskValue([block])
    setProbability('V.Clamp', -10)
    expect(entries.value[0].probability).toBe(0)
  })

  it('setProbability clamps value to 100 maximum', () => {
    const block = makeBlock(['V.Clamp2'])
    const { entries, setProbability } = useRiskValue([block])
    setProbability('V.Clamp2', 150)
    expect(entries.value[0].probability).toBe(100)
  })

  it('setProbability accepts valid values within range', () => {
    const block = makeBlock(['V.Valid'])
    const { entries, setProbability } = useRiskValue([block])
    setProbability('V.Valid', 65)
    expect(entries.value[0].probability).toBe(65)
  })

  it('totalAdjusted is less than or equal to totalRaw when prob < 100', () => {
    const block = makeBlock(['V.X', 'V.Y'])
    const { entries, setProbability, totalAdjusted, totalRaw } = useRiskValue([block])
    // Set both to 70%
    setProbability('V.X', 70)
    setProbability('V.Y', 70)
    expect(totalAdjusted.value).toBeLessThanOrEqual(totalRaw.value)
  })

  it('totalAdjusted equals totalRaw when all probabilities are 100', () => {
    const block = makeBlock(['V.Full'])
    const { entries, setProbability, totalAdjusted, totalRaw } = useRiskValue([block])
    setProbability('V.Full', 100)
    // With prob=100: adjustedValue = goalNumeric * 1.0 = goalNumeric (subject to rounding)
    expect(Math.abs(totalAdjusted.value - totalRaw.value)).toBeLessThan(1)
  })

  it('goalNumeric is parsed from goal string — first number found', () => {
    const block: SpecBlock = {
      functions: [],
      values: [{
        id: 'V.Parsed',
        type: 'Value',
        level: 'Business',
        description: 'Test',
        scale: '',
        meter: '',
        status: '',
        tolerable: '',
        goal: 'Goal [condition] 42.5',
        valueOfFunction: '',
      }],
      solutions: [],
    }
    const { entries } = useRiskValue([block])
    expect(entries.value[0].goalNumeric).toBe(42.5)
  })

  it('goalNumeric defaults to 50 when no number in goal string', () => {
    const block: SpecBlock = {
      functions: [],
      values: [{
        id: 'V.NoNum',
        type: 'Value',
        level: 'Business',
        description: 'Test',
        scale: '',
        meter: '',
        status: '',
        tolerable: '',
        goal: 'Goal [condition] not-a-number',
        valueOfFunction: '',
      }],
      solutions: [],
    }
    const { entries } = useRiskValue([block])
    expect(entries.value[0].goalNumeric).toBe(50)
  })

  it('copied starts as false', () => {
    const { copied } = useRiskValue([])
    expect(copied.value).toBe(false)
  })

  it('vDescription is truncated to 50 characters', () => {
    const longDesc = 'a'.repeat(100)
    const block: SpecBlock = {
      functions: [],
      values: [{
        id: 'V.LongDesc',
        type: 'Value',
        level: 'Business',
        description: longDesc,
        scale: '',
        meter: '',
        status: '',
        tolerable: '',
        goal: 'Goal 10',
        valueOfFunction: '',
      }],
      solutions: [],
    }
    const { entries } = useRiskValue([block])
    expect(entries.value[0].vDescription.length).toBeLessThanOrEqual(50)
  })
})
