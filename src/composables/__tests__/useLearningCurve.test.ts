// UNIT_TYPE=Test
// Feature #189 — Tests for useLearningCurve composable

import { describe, it, expect } from 'vitest'
import {
  seed,
  computeComplexityScore,
  stageFromScore,
  stageEmojiFromStage,
  buildLearningEntry,
  useLearningCurve,
} from '../useLearningCurve'
import type { SpecBlock } from '../../types/spec'

function makeF(id: string, description: string) {
  return {
    id,
    type: 'Function',
    level: 'Product',
    description,
    successCriteria: 'Meet target',
    functionOfValue: 'V.Test',
  }
}

function makeBlock(fEntries = [makeF('F.Alpha', 'Implement async api integration pipeline')]): SpecBlock {
  return {
    functions: fEntries,
    values: [],
    solutions: [],
  }
}

function makeEmptyBlock(): SpecBlock {
  return { functions: [], values: [], solutions: [] }
}

// ── seed unit tests ───────────────────────────────────────────────────────────

describe('seed', () => {
  it('returns a number in range [0, mod)', () => {
    const result = seed('F.TestId', 10)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(10)
  })

  it('is deterministic for same input', () => {
    expect(seed('F.TestId', 8)).toBe(seed('F.TestId', 8))
  })

  it('returns 0 for empty string with any mod', () => {
    expect(seed('', 10)).toBe(0)
  })
})

// ── computeComplexityScore unit tests ─────────────────────────────────────────

describe('computeComplexityScore', () => {
  it('technical keyword adds 8 pts each', () => {
    const score = computeComplexityScore('api')
    expect(score).toBe(8)
  })

  it('domain keyword adds 6 pts each', () => {
    const score = computeComplexityScore('compliance')
    expect(score).toBe(6)
  })

  it('abstraction keyword adds 4 pts each', () => {
    const score = computeComplexityScore('model')
    expect(score).toBe(4)
  })

  it('simple keyword subtracts 4 pts', () => {
    const score = computeComplexityScore('button')
    expect(score).toBe(0) // clamped to 0
  })

  it('score is clamped to 0 minimum', () => {
    const score = computeComplexityScore('button label text toggle hide')
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('score is clamped to 100 maximum', () => {
    const bigDesc = 'api api api api api api api api api api api api api api api'
    const score = computeComplexityScore(bigDesc)
    expect(score).toBe(100)
  })

  it('empty description → score 0', () => {
    expect(computeComplexityScore('')).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(computeComplexityScore('API')).toBe(computeComplexityScore('api'))
  })

  it('multiple keyword types accumulate correctly', () => {
    // api=8, compliance=6, model=4 → 18
    const score = computeComplexityScore('api compliance model')
    expect(score).toBe(18)
  })
})

// ── stageFromScore unit tests ─────────────────────────────────────────────────

describe('stageFromScore', () => {
  it('score < 34 → Novice', () => {
    expect(stageFromScore(0)).toBe('Novice')
    expect(stageFromScore(33)).toBe('Novice')
  })

  it('score 34–66 → Practitioner', () => {
    expect(stageFromScore(34)).toBe('Practitioner')
    expect(stageFromScore(66)).toBe('Practitioner')
  })

  it('score >= 67 → Expert', () => {
    expect(stageFromScore(67)).toBe('Expert')
    expect(stageFromScore(100)).toBe('Expert')
  })
})

// ── stageEmojiFromStage unit tests ────────────────────────────────────────────

describe('stageEmojiFromStage', () => {
  it('Novice → 🌱', () => expect(stageEmojiFromStage('Novice')).toBe('🌱'))
  it('Practitioner → 🌿', () => expect(stageEmojiFromStage('Practitioner')).toBe('🌿'))
  it('Expert → 🌳', () => expect(stageEmojiFromStage('Expert')).toBe('🌳'))
})

// ── buildLearningEntry unit tests ─────────────────────────────────────────────

describe('buildLearningEntry', () => {
  it('description truncated to 60 chars', () => {
    const e = buildLearningEntry('F.X', 'A'.repeat(100))
    expect(e.description).toHaveLength(60)
  })

  it('description shorter than 60 kept as-is', () => {
    const e = buildLearningEntry('F.X', 'Short')
    expect(e.description).toBe('Short')
  })

  it('estimatedHours = Math.round(complexityScore * 0.4 + seed(id+"hrs",8) + 2)', () => {
    const id = 'F.TestEntry'
    const desc = 'api integration'
    const complexityScore = computeComplexityScore(desc)
    const expectedHours = Math.round(complexityScore * 0.4 + seed(id + 'hrs', 8) + 2)
    const e = buildLearningEntry(id, desc)
    expect(e.estimatedHours).toBe(expectedHours)
  })

  it('estimatedHours is at least 2', () => {
    const e = buildLearningEntry('F.Simple', 'button')
    expect(e.estimatedHours).toBeGreaterThanOrEqual(2)
  })

  it('stage matches complexityScore', () => {
    const e = buildLearningEntry('F.Expert', 'api integration async distributed concurrent latency throughput schema pipeline encryption inference algorithm')
    expect(e.stage).toBe('Expert')
  })

  it('stageEmoji matches stage', () => {
    const e = buildLearningEntry('F.Novice', 'Show a label')
    expect(e.stageEmoji).toBe(stageEmojiFromStage(e.stage))
  })

  it('id stored correctly', () => {
    const e = buildLearningEntry('F.MyId', 'Some description')
    expect(e.id).toBe('F.MyId')
  })
})

// ── useLearningCurve composable tests ─────────────────────────────────────────

describe('useLearningCurve', () => {
  it('empty blocks → no entries', () => {
    const { entries } = useLearningCurve([])
    expect(entries.value).toHaveLength(0)
  })

  it('empty block → no entries', () => {
    const { entries } = useLearningCurve([makeEmptyBlock()])
    expect(entries.value).toHaveLength(0)
  })

  it('processes only F. entries', () => {
    const block: SpecBlock = {
      functions: [makeF('F.A', 'api'), makeF('F.B', 'model')],
      values: [
        {
          id: 'V.X',
          type: 'Value',
          level: 'Product',
          description: 'Some value',
          scale: 'n',
          meter: 'm',
          status: 'Status 0',
          tolerable: 'Tolerable 10',
          goal: 'Goal 20',
          valueOfFunction: 'F.A',
        },
      ],
      solutions: [],
    }
    const { entries } = useLearningCurve([block])
    expect(entries.value).toHaveLength(2)
  })

  it('entries sorted by complexityScore descending', () => {
    const block: SpecBlock = {
      functions: [
        makeF('F.Simple', 'show button'),
        makeF('F.Complex', 'api integration async distributed pipeline'),
      ],
      values: [],
      solutions: [],
    }
    const { entries } = useLearningCurve([block])
    expect(entries.value[0].complexityScore).toBeGreaterThanOrEqual(entries.value[1].complexityScore)
  })

  it('avgHours is 0 when no entries', () => {
    const { avgHours } = useLearningCurve([])
    expect(avgHours.value).toBe(0)
  })

  it('avgHours = Math.round(sum/count)', () => {
    const { entries, avgHours } = useLearningCurve([makeBlock()])
    const expected = Math.round(entries.value.reduce((a, e) => a + e.estimatedHours, 0) / entries.value.length)
    expect(avgHours.value).toBe(expected)
  })

  it('open ref starts false', () => {
    const { open } = useLearningCurve([makeBlock()])
    expect(open.value).toBe(false)
  })

  it('copied ref starts false', () => {
    const { copied } = useLearningCurve([makeBlock()])
    expect(copied.value).toBe(false)
  })

  it('flattens multiple blocks', () => {
    const { entries } = useLearningCurve([makeBlock(), makeBlock()])
    expect(entries.value).toHaveLength(2)
  })

  it('single entry → avgHours equals that entry estimatedHours', () => {
    const { entries, avgHours } = useLearningCurve([makeBlock()])
    expect(avgHours.value).toBe(entries.value[0].estimatedHours)
  })
})
