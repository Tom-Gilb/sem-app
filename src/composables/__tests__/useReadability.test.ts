// UNIT_TYPE=Test
// Feature #41 — Tests for useReadability composable

import { describe, it, expect } from 'vitest'
import { useReadability } from '../useReadability'
import type { SpecBlock } from '../../types/spec'

const { scoreText, scoreSpec } = useReadability()

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSingleEntrySpec(description: string): SpecBlock {
  return {
    functions: [],
    solutions: [],
    values: [
      {
        id: 'V.Test',
        type: 'Value',
        level: 'Product',
        description,
        scale: '',
        meter: '',
        status: '',
        tolerable: '',
        goal: '',
        valueOfFunction: '',
      },
    ],
  }
}

function makeMultiEntrySpec(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.One',
        type: 'Function',
        level: 'Product',
        description: 'The system logs in users.',
        successCriteria: '',
        functionOfValue: '',
      },
    ],
    values: [
      {
        id: 'V.Two',
        type: 'Value',
        level: 'Product',
        description: 'The system measures speed.',
        scale: '',
        meter: '',
        status: '',
        tolerable: '',
        goal: '',
        valueOfFunction: '',
      },
    ],
    solutions: [
      {
        id: 'S.Three',
        type: 'Solution',
        level: 'Product',
        description: 'The system caches data.',
        impact: '',
        function: '',
      },
    ],
  }
}

// ── scoreText tests ───────────────────────────────────────────────────────────

describe('useReadability — scoreText', () => {
  it('simple short sentence scores above 60 (easy text)', () => {
    const score = scoreText('The cat sat on the mat.')
    expect(score).toBeGreaterThan(60)
  })

  it('simple multi-sentence text scores above 60', () => {
    const score = scoreText('The dog runs fast. It is fun. We love dogs.')
    expect(score).toBeGreaterThan(60)
  })

  it('complex multi-syllabic academic sentence scores below 40', () => {
    const score = scoreText(
      'The architectural implementation of distributed microservices necessitates rigorous asynchronous orchestration mechanisms throughout the transactional infrastructure.',
    )
    expect(score).toBeLessThan(40)
  })

  it('very long complex paragraph scores below 40', () => {
    const score = scoreText(
      'The comprehensive evaluation of multidimensional parametric configurations within the distributed computational infrastructure necessitates sophisticated algorithmic optimization. ' +
      'The probabilistic determination of systematic vulnerabilities across heterogeneous interconnected subsystems constitutes an extraordinarily challenging multifaceted endeavour.',
    )
    expect(score).toBeLessThan(40)
  })

  it('result is clamped to 0–100', () => {
    const score1 = scoreText('Hi.')
    const score2 = scoreText('Supercalifragilistic expialidocious antidisestablishmentarianism pneumonoultramicroscopicsilicovolcanoconiosis.')
    expect(score1).toBeGreaterThanOrEqual(0)
    expect(score1).toBeLessThanOrEqual(100)
    expect(score2).toBeGreaterThanOrEqual(0)
    expect(score2).toBeLessThanOrEqual(100)
  })

  it('empty string returns neutral score 50', () => {
    expect(scoreText('')).toBe(50)
  })
})

// ── Grade boundary tests ──────────────────────────────────────────────────────

describe('useReadability — grade boundaries', () => {
  it('score >= 80 → Very Easy', () => {
    const result = scoreSpec(makeSingleEntrySpec('Go run. Do it. Be fast. Have fun. No stress.'))
    if (result.score >= 80) {
      expect(result.grade).toBe('Very Easy')
    }
  })

  it('score >= 60 and < 80 → Easy', () => {
    // Craft a result where score is in 60–79 range and verify grade mapping
    // We'll use the scoreSpec with moderate text and check grade consistency
    const result = scoreSpec(makeSingleEntrySpec('The system allows users to log in quickly.'))
    if (result.score >= 60 && result.score < 80) {
      expect(result.grade).toBe('Easy')
    }
    // Grade must always be one of the valid grades
    expect(['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard']).toContain(result.grade)
  })

  it('grade thresholds are applied correctly for all bands', () => {
    // Directly test the grade assignment by checking known score ranges
    // We create specs with predictable scores by using controlled text

    // Very Easy: single short words, many sentences
    const veryEasyResult = scoreSpec(makeSingleEntrySpec('Run. Jump. Go. Sit. Up. Down. In. Out.'))
    expect(['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard']).toContain(veryEasyResult.grade)
    if (veryEasyResult.score >= 80) expect(veryEasyResult.grade).toBe('Very Easy')
    else if (veryEasyResult.score >= 60) expect(veryEasyResult.grade).toBe('Easy')
    else if (veryEasyResult.score >= 40) expect(veryEasyResult.grade).toBe('Moderate')
    else if (veryEasyResult.score >= 20) expect(veryEasyResult.grade).toBe('Hard')
    else expect(veryEasyResult.grade).toBe('Very Hard')
  })

  it('grade and score are always consistent', () => {
    const texts = [
      'Run fast.',
      'The system processes data efficiently.',
      'The architectural optimization of distributed transactional microservices necessitates sophisticated instrumentation.',
    ]
    for (const text of texts) {
      const result = scoreSpec(makeSingleEntrySpec(text))
      if (result.score >= 80) expect(result.grade).toBe('Very Easy')
      else if (result.score >= 60) expect(result.grade).toBe('Easy')
      else if (result.score >= 40) expect(result.grade).toBe('Moderate')
      else if (result.score >= 20) expect(result.grade).toBe('Hard')
      else expect(result.grade).toBe('Very Hard')
    }
  })
})

// ── scoreSpec tests ───────────────────────────────────────────────────────────

describe('useReadability — scoreSpec', () => {
  it('single-entry spec returns perEntryScores.length === 1', () => {
    const result = scoreSpec(makeSingleEntrySpec('The system logs in users quickly.'))
    expect(result.perEntryScores).toHaveLength(1)
    expect(result.perEntryScores[0].entryId).toBe('V.Test')
  })

  it('multi-entry spec returns correct perEntryScores count', () => {
    const result = scoreSpec(makeMultiEntrySpec())
    // 1 function + 1 value + 1 solution = 3 entries
    expect(result.perEntryScores).toHaveLength(3)
  })

  it('perEntryScores contains correct entryIds', () => {
    const result = scoreSpec(makeMultiEntrySpec())
    const ids = result.perEntryScores.map(e => e.entryId)
    expect(ids).toContain('F.One')
    expect(ids).toContain('V.Two')
    expect(ids).toContain('S.Three')
  })

  it('average aggregation is correct', () => {
    // Build a spec with two entries whose individual scores we can reason about
    // By using the same description for both, overall score == individual score
    const text = 'The system runs fast.'
    const singleScore = scoreText(text)
    const spec: SpecBlock = {
      functions: [],
      solutions: [],
      values: [
        {
          id: 'V.A',
          type: 'Value',
          level: 'Product',
          description: text,
          scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '',
        },
        {
          id: 'V.B',
          type: 'Value',
          level: 'Product',
          description: text,
          scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '',
        },
      ],
    }
    const result = scoreSpec(spec)
    // Both entries have same description → overall score should equal individual score
    expect(result.score).toBe(Math.round(singleScore))
    expect(result.perEntryScores).toHaveLength(2)
  })

  it('empty spec returns score 50 and perEntryScores is empty', () => {
    const result = scoreSpec({ functions: [], values: [], solutions: [] })
    expect(result.score).toBe(50)
    expect(result.perEntryScores).toHaveLength(0)
  })

  it('result always has valid grade', () => {
    const result = scoreSpec(makeMultiEntrySpec())
    expect(['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard']).toContain(result.grade)
  })

  it('avgSentenceLength and avgWordLength are non-negative numbers', () => {
    const result = scoreSpec(makeMultiEntrySpec())
    expect(result.avgSentenceLength).toBeGreaterThanOrEqual(0)
    expect(result.avgWordLength).toBeGreaterThanOrEqual(0)
  })
})
