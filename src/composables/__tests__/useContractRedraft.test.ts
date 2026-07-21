// UNIT_TYPE=Test
// Regression tests for computeCHI + _finalizeCHI (r41 v439).
//
// Bug (2026-07-02, Tom): CHI dashboard on USS Monitor contract showed
// Precision 25/25, Measurement 25/25, Bounded Scope 15/15, Standards
// Conformance 10/10 with captions "0 of 0 Function entries have a
// testable Presence Test" etc.  Total CHI = 85/100 AMBER.  Nothing was
// actually measured on 4 of 6 dimensions — they silently defaulted to
// full credit because `denominator > 0 ? actual/denom : 1` awarded a
// ratio of 1 when the extractor returned 0 entries.
//
// This is exactly the r93mmm Infinity-Trap failure inverted: unmeasurable
// got silently promoted to "perfect".  Fix: dimensions with a zero
// denominator carry `measurable: false`, score 0, and are excluded from
// CHI numerator + denominator (renormalized).
//
// Tom picked Option A ("N/A + renormalize") 2026-07-02.

import { describe, it, expect } from 'vitest'
import { computeCHI, _finalizeCHI } from '../useContractRedraft'
import type { ContractModel } from '../../types/contractTypes'
import type { ContractHealthDimensionId, ContractHealthDimension } from '../../types/contractRedraft'

const WEIGHTS: Record<ContractHealthDimensionId, number> = {
  'precision':                25,
  'measurement':              25,
  'stakeholder-coverage':     15,
  'bounded-scope':            15,
  'standards-conformance':    10,
  'structural-completeness':  10,
}

/** Minimum shape needed by computeCHI — cast through unknown because
 *  ContractModel has many required fields the function never reads. */
function makeContract(entries: Array<Partial<{
  id: string; type: 'F' | 'V' | 'S'; presenceTest?: string
  scale?: string; goal?: string; tolerable?: string
  obligatedParty?: string; standardsViolations?: unknown[]
  sourceType?: 'human' | 'ai' | 'system'
}>>): ContractModel {
  return {
    clauses: [
      { entries: entries.map((e, i) => ({ id: e.id ?? `E${i}`, ...e })) },
    ],
  } as unknown as ContractModel
}

describe('computeCHI — r93mmm Infinity Trap discipline', () => {
  it('marks Precision N/A when there are 0 Function entries (does NOT award full credit)', () => {
    const chi = computeCHI(makeContract([]), WEIGHTS)
    const precision = chi.breakdown.find(d => d.id === 'precision')!
    expect(precision.measurable).toBe(false)
    expect(precision.score).toBe(0)
    expect(precision.detail).toMatch(/cannot be measured/)
  })

  it('marks Measurement N/A when there are 0 Value entries', () => {
    const chi = computeCHI(makeContract([]), WEIGHTS)
    const measurement = chi.breakdown.find(d => d.id === 'measurement')!
    expect(measurement.measurable).toBe(false)
    expect(measurement.score).toBe(0)
  })

  it('marks Bounded Scope N/A when there are 0 Value entries', () => {
    const chi = computeCHI(makeContract([]), WEIGHTS)
    const bs = chi.breakdown.find(d => d.id === 'bounded-scope')!
    expect(bs.measurable).toBe(false)
    expect(bs.score).toBe(0)
  })

  it('marks Standards Conformance N/A when there are 0 entries total', () => {
    const chi = computeCHI(makeContract([]), WEIGHTS)
    const sc = chi.breakdown.find(d => d.id === 'standards-conformance')!
    expect(sc.measurable).toBe(false)
    expect(sc.score).toBe(0)
  })

  it('keeps Stakeholder Coverage measurable at 0 (honest 0, target ≥ 4)', () => {
    const chi = computeCHI(makeContract([]), WEIGHTS)
    const sh = chi.breakdown.find(d => d.id === 'stakeholder-coverage')!
    expect(sh.measurable).toBe(true)
    expect(sh.score).toBe(0)
  })

  it('an empty contract renormalizes: CHI ≠ 85 (was the bug); CHI = 0 over the 25 measurable points', () => {
    const chi = computeCHI(makeContract([]), WEIGHTS)
    // Only Stakeholder Coverage (15) + Structural Completeness (10) are
    // measurable pre-redraft, both score 0 → CHI = 0 over 25 available.
    expect(chi.availableMax).toBe(25)
    expect(chi.skippedMax).toBe(75)
    expect(chi.score).toBe(0)
    expect(chi.colourBand).toBe('red')
  })

  it('a contract with 1 Function + Presence Test scores Precision 25/25 measurable', () => {
    const chi = computeCHI(makeContract([
      { id: 'F1', type: 'F', presenceTest: 'Turret is installed' },
    ]), WEIGHTS)
    const precision = chi.breakdown.find(d => d.id === 'precision')!
    expect(precision.measurable).toBe(true)
    expect(precision.score).toBe(25)
  })

  it('a contract with 1 Function + NO Presence Test scores Precision 0/25 measurable', () => {
    const chi = computeCHI(makeContract([
      { id: 'F1', type: 'F' },
    ]), WEIGHTS)
    const precision = chi.breakdown.find(d => d.id === 'precision')!
    expect(precision.measurable).toBe(true)
    expect(precision.score).toBe(0)
    // renormalized: precision 0/25, standards-conformance 10/10, stakeholder 0/15,
    // structural 0/10 → measurable dims = 25+10+15+10=60 → earned=10 → 17
    expect(chi.availableMax).toBe(60)
    expect(chi.skippedMax).toBe(40)
  })

  it('_finalizeCHI renormalizes correctly when all dimensions measurable', () => {
    const dims: ContractHealthDimension[] = [
      { id: 'precision',              label: 'Precision',              maxScore: 25, score: 25, measurable: true, detail: '' },
      { id: 'measurement',            label: 'Measurement',            maxScore: 25, score: 25, measurable: true, detail: '' },
      { id: 'stakeholder-coverage',   label: 'Stakeholder Coverage',   maxScore: 15, score: 15, measurable: true, detail: '' },
      { id: 'bounded-scope',          label: 'Bounded Scope',          maxScore: 15, score: 15, measurable: true, detail: '' },
      { id: 'standards-conformance',  label: 'Standards Conformance',  maxScore: 10, score: 10, measurable: true, detail: '' },
      { id: 'structural-completeness',label: 'Structural Completeness',maxScore: 10, score: 10, measurable: true, detail: '' },
    ]
    const chi = _finalizeCHI(dims)
    expect(chi.score).toBe(100)
    expect(chi.availableMax).toBe(100)
    expect(chi.skippedMax).toBe(0)
    expect(chi.colourBand).toBe('green')
  })

  it('_finalizeCHI renormalizes over subset when some dimensions are N/A', () => {
    const dims: ContractHealthDimension[] = [
      { id: 'precision',              label: 'Precision',              maxScore: 25, score: 0,  measurable: false, detail: '' },
      { id: 'measurement',            label: 'Measurement',            maxScore: 25, score: 0,  measurable: false, detail: '' },
      { id: 'stakeholder-coverage',   label: 'Stakeholder Coverage',   maxScore: 15, score: 15, measurable: true,  detail: '' },
      { id: 'bounded-scope',          label: 'Bounded Scope',          maxScore: 15, score: 0,  measurable: false, detail: '' },
      { id: 'standards-conformance',  label: 'Standards Conformance',  maxScore: 10, score: 0,  measurable: false, detail: '' },
      { id: 'structural-completeness',label: 'Structural Completeness',maxScore: 10, score: 10, measurable: true,  detail: '' },
    ]
    const chi = _finalizeCHI(dims)
    // measurable maxScore sum = 15 + 10 = 25; earned = 15 + 10 = 25 → 100/100
    expect(chi.availableMax).toBe(25)
    expect(chi.skippedMax).toBe(75)
    expect(chi.score).toBe(100)
  })

  // r41 v456 (Tom Gilb 2026-07-02 "bar table smells wrong") — placeholder
  // strings and system-sourced entries should not silently inflate CHI.
  it('a Function with presenceTest="TBD" does NOT count as populated (placeholder discipline)', () => {
    const chi = computeCHI(makeContract([
      { id: 'F1', type: 'F', presenceTest: 'TBD' },
      { id: 'F2', type: 'F', presenceTest: 'TBD ← \'no commencement milestone identified\'' },
      { id: 'F3', type: 'F', presenceTest: 'The Turret is installed and passes acceptance trial.' },
    ]), WEIGHTS)
    const precision = chi.breakdown.find(d => d.id === 'precision')!
    expect(precision.measurable).toBe(true)
    // 1 of 3 has a REAL presence test → score = round(1/3 * 25) = 8
    expect(precision.score).toBe(8)
    expect(precision.detail).toMatch(/placeholder/i)
  })

  it('a Value with scale="TBD" or goal="TBD" does NOT count as measured', () => {
    const chi = computeCHI(makeContract([
      { id: 'V1', type: 'V', scale: 'TBD', goal: '95%' },                  // scale placeholder → not counted
      { id: 'V2', type: 'V', scale: 'Uptime %', goal: 'TBD ← reason' },     // goal placeholder, no tolerable → not counted
      { id: 'V3', type: 'V', scale: 'Uptime %', tolerable: '≥ 99.5%' },    // real Scale + real Tolerable → counted
    ]), WEIGHTS)
    const measurement = chi.breakdown.find(d => d.id === 'measurement')!
    expect(measurement.measurable).toBe(true)
    expect(measurement.score).toBe(8) // 1/3 * 25 = 8.33 → round to 8
  })

  it('Standards Conformance is Not Measurable when ALL entries are system-sourced (recovery/import case)', () => {
    // Every recovered entry from the v454 .eml recovery is stamped
    // sourceType='system' + has an empty standardsViolations array.
    // Pre-v456 that scored 10/10 = false positive; v456 marks Not Measurable.
    const contract = makeContract([
      { id: 'F1', type: 'F' },
      { id: 'V1', type: 'V' },
      { id: 'S1', type: 'S' },
    ])
    for (const cl of contract.clauses) for (const e of cl.entries) (e as unknown as { sourceType: string }).sourceType = 'system'
    const chi = computeCHI(contract, WEIGHTS)
    const sc = chi.breakdown.find(d => d.id === 'standards-conformance')!
    expect(sc.measurable).toBe(false)
    expect(sc.score).toBe(0)
    expect(sc.detail).toMatch(/recovery|import|standards checker was never run/i)
  })

  it('Standards Conformance IS Measurable when at least one entry carries a violation flag (evidence of analysis)', () => {
    const contract = makeContract([
      { id: 'F1', type: 'F' },
      { id: 'V1', type: 'V' },
    ])
    // System-sourced but with one real violation flag → analyser ran →
    // Measurable (zero-flag entries are legitimately clean).
    for (const cl of contract.clauses) for (const e of cl.entries) (e as unknown as { sourceType: string }).sourceType = 'system'
    for (const cl of contract.clauses) (cl.entries[0] as unknown as { standardsViolations: unknown[] }).standardsViolations = [{ standard: 'MSCD', issue: 'ambiguous' }]
    const chi = computeCHI(contract, WEIGHTS)
    const sc = chi.breakdown.find(d => d.id === 'standards-conformance')!
    expect(sc.measurable).toBe(true)
    // 1 violation / 2 entries = 50% violation rate → 50% conformance → 5/10
    expect(sc.score).toBe(5)
  })
})
