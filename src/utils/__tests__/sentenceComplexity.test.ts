// UNIT_TYPE=Test
// Feature #65 — Tests for sentenceComplexity utility

import { describe, it, expect } from 'vitest'
import {
  scoreSentenceComplexity,
  complexityColour,
  complexityBarWidth,
  countSpecWords,
} from '../sentenceComplexity'

describe('scoreSentenceComplexity', () => {
  it('returns 0 for empty string', () => {
    expect(scoreSentenceComplexity('')).toBe(0)
  })

  it('returns 0 for whitespace-only string', () => {
    expect(scoreSentenceComplexity('   ')).toBe(0)
  })

  it('returns < 30 for a simple short sentence', () => {
    expect(scoreSentenceComplexity('Simple text.')).toBeLessThan(30)
  })

  it('returns > 40 for a long complex sentence with subordinate clauses', () => {
    const complex = 'This is a very long sentence with many words that uses several subordinate clauses which increase complexity however.'
    expect(scoreSentenceComplexity(complex)).toBeGreaterThan(40)
  })

  it('returns a number between 0 and 100', () => {
    const score = scoreSentenceComplexity('Some moderately complex text with multiple clauses however therefore.')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('complexityColour', () => {
  it('returns emerald (#10...) for score < 30', () => {
    expect(complexityColour(20)).toMatch(/^#10/)
  })

  it('returns amber (#f5...) for score between 30 and 59', () => {
    expect(complexityColour(45)).toMatch(/^#f5/)
  })

  it('returns red (#ef...) for score >= 60', () => {
    expect(complexityColour(75)).toMatch(/^#ef/)
  })

  it('returns emerald at score 0', () => {
    expect(complexityColour(0)).toMatch(/^#10/)
  })

  it('returns red at score 100', () => {
    expect(complexityColour(100)).toMatch(/^#ef/)
  })
})

describe('complexityBarWidth', () => {
  it('returns "50%" for score 50', () => {
    expect(complexityBarWidth(50)).toBe('50%')
  })

  it('returns minimum "4%" for score 0', () => {
    expect(complexityBarWidth(0)).toBe('4%')
  })

  it('returns minimum "4%" for score below minimum', () => {
    expect(complexityBarWidth(2)).toBe('4%')
  })

  it('returns "100%" for score 100', () => {
    expect(complexityBarWidth(100)).toBe('100%')
  })
})

describe('countSpecWords', () => {
  it('counts words across all three entry types', () => {
    const spec = {
      functions: [{ description: 'hello world' }],
      values: [],
      solutions: [],
    }
    expect(countSpecWords(spec)).toBe(2)
  })

  it('returns 0 for empty spec', () => {
    const spec = { functions: [], values: [], solutions: [] }
    expect(countSpecWords(spec)).toBe(0)
  })

  it('counts words across multiple entries', () => {
    const spec = {
      functions: [{ description: 'one two' }],
      values: [{ description: 'three four five' }],
      solutions: [{ description: 'six' }],
    }
    expect(countSpecWords(spec)).toBe(6)
  })

  it('ignores extra whitespace', () => {
    const spec = {
      functions: [{ description: '  hello   world  ' }],
      values: [],
      solutions: [],
    }
    expect(countSpecWords(spec)).toBe(2)
  })
})
