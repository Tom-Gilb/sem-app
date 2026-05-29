// Tests for impliedHierarchies.ts — Tier 1 rule-based implied-entry suggestions.
// Regression guard: rules are deterministic and silent failures are invisible to
// the user (panel simply shows no suggestions).

import { describe, test, expect } from 'vitest'
import {
  computeImpliedEntries,
  IMPLIED_RULES,
  type ImpliedEntry,
} from '../impliedHierarchies'

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyChips() {
  return { stakeholders: [] as string[], values: [] as string[], means: [] as string[] }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeImpliedEntries — baseline
// ─────────────────────────────────────────────────────────────────────────────

describe('computeImpliedEntries — no triggers fire', () => {

  test('returns empty array when all chip arrays are empty', () => {
    const result = computeImpliedEntries(emptyChips())
    expect(result).toHaveLength(0)
  })

  test('returns empty array when chips have unrelated content', () => {
    const result = computeImpliedEntries({
      stakeholders: ['board of directors'],
      values:       ['executive satisfaction'],
      means:        ['strategy review'],
    })
    expect(result).toHaveLength(0)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Rule: ai-means-to-values (triggers on means containing AI keywords)
// ─────────────────────────────────────────────────────────────────────────────

describe('rule ai-means-to-values', () => {

  test('fires when means contains "AI"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      means: ['AI'],
    })
    const ruleEntries = result.filter(e => e.ruleId === 'ai-means-to-values')
    expect(ruleEntries.length).toBeGreaterThan(0)
  })

  test('fires when means contains "machine learning" (case-insensitive phrase)', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      means: ['Machine Learning'],
    })
    const ruleEntries = result.filter(e => e.ruleId === 'ai-means-to-values')
    expect(ruleEntries.length).toBeGreaterThan(0)
  })

  test('fires when means contains "chatbot"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      means: ['build a chatbot'],
    })
    expect(result.some(e => e.ruleId === 'ai-means-to-values')).toBe(true)
  })

  test('does NOT fire when AI keyword is absent from means', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      means: ['manual review process'],
    })
    expect(result.some(e => e.ruleId === 'ai-means-to-values')).toBe(false)
  })

  test('suggests "time saved per task" as a value', () => {
    const result = computeImpliedEntries({ ...emptyChips(), means: ['AI'] })
    expect(result.some(e => e.group === 'values' && e.text === 'time saved per task')).toBe(true)
  })

  test('suggests "data" as a stakeholder (inanimate stakeholder rule)', () => {
    const result = computeImpliedEntries({ ...emptyChips(), means: ['ai'] })
    expect(result.some(e => e.group === 'stakeholders' && e.text === 'data')).toBe(true)
  })

  test('suggests "training data pipeline" as a means', () => {
    const result = computeImpliedEntries({ ...emptyChips(), means: ['llm'] })
    expect(result.some(e => e.group === 'means' && e.text === 'training data pipeline')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Rule: engineer-stakeholder
// ─────────────────────────────────────────────────────────────────────────────

describe('rule engineer-stakeholder', () => {

  test('fires when stakeholders contains "engineers"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['engineers'],
    })
    expect(result.some(e => e.ruleId === 'engineer-stakeholder')).toBe(true)
  })

  test('fires when stakeholders contains "developer" (singular)', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['developer'],
    })
    expect(result.some(e => e.ruleId === 'engineer-stakeholder')).toBe(true)
  })

  test('suggests "deployment frequency" as a DORA value', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['engineers'],
    })
    expect(result.some(e => e.group === 'values' && e.text === 'deployment frequency')).toBe(true)
  })

  test('suggests "codebase" as an inanimate stakeholder', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['developers'],
    })
    expect(result.some(e => e.group === 'stakeholders' && e.text === 'codebase')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Rule: customer-stakeholder
// ─────────────────────────────────────────────────────────────────────────────

describe('rule customer-stakeholder', () => {

  test('fires when stakeholders contains "customer"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['customer'],
    })
    expect(result.some(e => e.ruleId === 'customer-stakeholder')).toBe(true)
  })

  test('fires when stakeholders contains "users" (plural)', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['users'],
    })
    expect(result.some(e => e.ruleId === 'customer-stakeholder')).toBe(true)
  })

  test('suggests "net promoter score"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['customers'],
    })
    expect(result.some(e => e.text === 'net promoter score')).toBe(true)
  })

  test('suggests "churn rate"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['buyers'],
    })
    expect(result.some(e => e.text === 'churn rate')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication: same suggestion from multiple rules appears only once
// ─────────────────────────────────────────────────────────────────────────────

describe('deduplication', () => {

  test('"regulator" stakeholder appears only once when multiple rules suggest it', () => {
    // Both ai-means-to-values and patient-stakeholder suggest "regulator"
    const result = computeImpliedEntries({
      ...emptyChips(),
      means:        ['AI'],
      stakeholders: ['patients'],
    })
    const regulatorEntries = result.filter(
      e => e.group === 'stakeholders' && e.text === 'regulator'
    )
    expect(regulatorEntries).toHaveLength(1)
  })

  test('"data" stakeholder appears only once when two rules suggest it', () => {
    // ai-means-to-values and security-means both suggest "data"
    const result = computeImpliedEntries({
      ...emptyChips(),
      means:  ['AI', 'encryption'],
      values: [],
    })
    const dataEntries = result.filter(
      e => e.group === 'stakeholders' && e.text === 'data'
    )
    expect(dataEntries).toHaveLength(1)
  })

  test('each suggestion has a ruleId identifying which rule produced it', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      means: ['AI'],
    })
    for (const entry of result) {
      expect(typeof entry.ruleId).toBe('string')
      expect(entry.ruleId.length).toBeGreaterThan(0)
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Existing chips are filtered out
// ─────────────────────────────────────────────────────────────────────────────

describe('existing chips are excluded from suggestions', () => {

  test('does not suggest a value already present in values chips', () => {
    const result = computeImpliedEntries({
      stakeholders: [],
      values:       ['net promoter score'],  // already present
      means:        [],
    })
    expect(result.some(e => e.text === 'net promoter score')).toBe(false)
  })

  test('exclusion is case-insensitive (chip "Net Promoter Score" blocks suggestion)', () => {
    const result = computeImpliedEntries({
      stakeholders: ['customer'],
      values:       ['Net Promoter Score'],  // uppercase variant already present
      means:        [],
    })
    // "net promoter score" would be suggested by customer-stakeholder rule
    expect(result.some(e => e.text.toLowerCase() === 'net promoter score')).toBe(false)
  })

  test('does not suggest a stakeholder already present', () => {
    const result = computeImpliedEntries({
      stakeholders: ['regulator'],  // already there
      values:       [],
      means:        ['AI'],
    })
    expect(result.some(e => e.group === 'stakeholders' && e.text === 'regulator')).toBe(false)
  })

  test('still suggests OTHER entries from the same rule when only one is filtered', () => {
    // customer-stakeholder rule has 4 suggestions; if NPS is already present,
    // the other 3 should still appear
    const result = computeImpliedEntries({
      stakeholders: ['customer'],
      values:       ['net promoter score'],  // block one
      means:        [],
    })
    expect(result.some(e => e.text === 'churn rate')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Multiple rules fire simultaneously
// ─────────────────────────────────────────────────────────────────────────────

describe('multiple rules firing at once', () => {

  test('suggestions from all firing rules are returned (union)', () => {
    const result = computeImpliedEntries({
      stakeholders: ['engineers'],    // fires engineer-stakeholder
      values:       ['revenue'],      // fires revenue-values
      means:        [],
    })
    const hasDora = result.some(e => e.text === 'deployment frequency')
    const hasConversion = result.some(e => e.text === 'conversion rate')
    expect(hasDora).toBe(true)
    expect(hasConversion).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Rule: world-stakeholder (universal scope)
// ─────────────────────────────────────────────────────────────────────────────

describe('rule world-stakeholder', () => {

  test('fires when stakeholders contains "world"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['world'],
    })
    expect(result.some(e => e.ruleId === 'world-stakeholder')).toBe(true)
  })

  test('fires when values contains "global" (dual-group trigger)', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      values: ['global reach'],
    })
    expect(result.some(e => e.ruleId === 'world-stakeholder')).toBe(true)
  })

  test('suggests "All people / Humanity" as stakeholder', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      stakeholders: ['humanity'],
    })
    expect(result.some(e => e.text === 'All people / Humanity')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Rule: universal-beneficiary (joy, happiness, wellbeing…)
// Tom 2026-05-17: "joy to the world" — the universal beneficiary is implied
// ─────────────────────────────────────────────────────────────────────────────

describe('rule universal-beneficiary', () => {

  test('fires when values contains "joy"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      values: ['joy'],
    })
    expect(result.some(e => e.ruleId === 'universal-beneficiary')).toBe(true)
  })

  test('fires when values contains "happiness"', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      values: ['happiness'],
    })
    expect(result.some(e => e.ruleId === 'universal-beneficiary')).toBe(true)
  })

  test('suggests "All people / Humanity" as stakeholder for joy-typed values', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      values: ['joy'],
    })
    expect(result.some(e => e.group === 'stakeholders' && e.text === 'All people / Humanity')).toBe(true)
  })

  test('suggests "wellbeing score" as measurable outcome', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      values: ['wellbeing'],
    })
    expect(result.some(e => e.group === 'values' && e.text === 'wellbeing score')).toBe(true)
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// Shape of returned entries
// ─────────────────────────────────────────────────────────────────────────────

describe('ImpliedEntry shape', () => {

  test('every entry has group, text, why, ruleId fields', () => {
    const result = computeImpliedEntries({
      ...emptyChips(),
      means: ['AI'],
    })
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) {
      expect(['stakeholders', 'values', 'means']).toContain(entry.group)
      expect(typeof entry.text).toBe('string')
      expect(entry.text.length).toBeGreaterThan(0)
      expect(typeof entry.why).toBe('string')
      expect(entry.why.length).toBeGreaterThan(0)
      expect(typeof entry.ruleId).toBe('string')
      expect(entry.ruleId.length).toBeGreaterThan(0)
    }
  })

})

// ─────────────────────────────────────────────────────────────────────────────
// IMPLIED_RULES data integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('IMPLIED_RULES data integrity', () => {

  test('every rule has a unique id', () => {
    const ids = IMPLIED_RULES.map(r => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  test('every rule has at least one trigger and at least one suggestion', () => {
    for (const rule of IMPLIED_RULES) {
      expect(rule.triggers.length).toBeGreaterThan(0)
      expect(rule.suggest.length).toBeGreaterThan(0)
    }
  })

  test('every trigger group is a valid SugGroup', () => {
    const valid = new Set(['stakeholders', 'values', 'means'])
    for (const rule of IMPLIED_RULES) {
      for (const trigger of rule.triggers) {
        expect(valid.has(trigger.group)).toBe(true)
      }
    }
  })

  test('every suggestion group is a valid SugGroup', () => {
    const valid = new Set(['stakeholders', 'values', 'means'])
    for (const rule of IMPLIED_RULES) {
      for (const sug of rule.suggest) {
        expect(valid.has(sug.group)).toBe(true)
      }
    }
  })

})
