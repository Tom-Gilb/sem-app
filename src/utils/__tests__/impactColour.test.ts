// Tests for impactColour utility — pure colour-coding functions.
// Spec: S.ImpactEstimationUI — boundary value tests for getImpactColour and getVCColour.

import { describe, test, expect } from 'vitest'
import { getImpactColour, getVCColour, interpretImpact } from '../impactColour'

// ── getImpactColour ────────────────────────────────────────────────────────────

describe('getImpactColour', () => {
  // Boundary values: 0, 29, 30, 59, 60, 100

  test('returns gray for 0 (no estimate)', () => {
    expect(getImpactColour(0)).toBe('#d1d5db')
  })

  test('returns red for 1 (weak positive)', () => {
    expect(getImpactColour(1)).toBe('#ef4444')
  })

  test('returns red for 29 (below amber threshold)', () => {
    expect(getImpactColour(29)).toBe('#ef4444')
  })

  test('returns amber for 30 (amber lower bound)', () => {
    expect(getImpactColour(30)).toBe('#f59e0b')
  })

  test('returns amber for 59 (amber upper bound)', () => {
    expect(getImpactColour(59)).toBe('#f59e0b')
  })

  test('returns green for 60 (green lower bound)', () => {
    expect(getImpactColour(60)).toBe('#22c55e')
  })

  test('returns green for 100 (maximum)', () => {
    expect(getImpactColour(100)).toBe('#22c55e')
  })

  test('returns red for -1 (negative side effect)', () => {
    expect(getImpactColour(-1)).toBe('#ef4444')
  })

  test('returns red for -50 (severe negative side effect)', () => {
    expect(getImpactColour(-50)).toBe('#ef4444')
  })

  test('returns red for -100 (worst negative)', () => {
    expect(getImpactColour(-100)).toBe('#ef4444')
  })
})

// ── getVCColour ────────────────────────────────────────────────────────────────

describe('getVCColour', () => {
  // Boundary values: 0, 0.79, 0.8, 1.49, 1.5

  test('returns red for 0 (zero ratio)', () => {
    expect(getVCColour(0)).toBe('#ef4444')
  })

  test('returns red for 0.79 (below amber threshold)', () => {
    expect(getVCColour(0.79)).toBe('#ef4444')
  })

  test('returns amber for 0.8 (amber lower bound)', () => {
    expect(getVCColour(0.8)).toBe('#f59e0b')
  })

  test('returns amber for 1.49 (amber upper bound)', () => {
    expect(getVCColour(1.49)).toBe('#f59e0b')
  })

  test('returns green for 1.5 (green lower bound)', () => {
    expect(getVCColour(1.5)).toBe('#22c55e')
  })

  test('returns green for 5.0 (high ratio)', () => {
    expect(getVCColour(5.0)).toBe('#22c55e')
  })

  test('returns red for negative V/C (pathological input)', () => {
    expect(getVCColour(-1)).toBe('#ef4444')
  })
})

// ── interpretImpact ────────────────────────────────────────────────────────────

describe('interpretImpact', () => {
  test('returns "strong impact" for 60', () => {
    expect(interpretImpact(60)).toBe('strong impact')
  })

  test('returns "strong impact" for 100', () => {
    expect(interpretImpact(100)).toBe('strong impact')
  })

  test('returns "moderate impact" for 30', () => {
    expect(interpretImpact(30)).toBe('moderate impact')
  })

  test('returns "moderate impact" for 59', () => {
    expect(interpretImpact(59)).toBe('moderate impact')
  })

  test('returns "weak impact" for 1', () => {
    expect(interpretImpact(1)).toBe('weak impact')
  })

  test('returns "weak impact" for 29', () => {
    expect(interpretImpact(29)).toBe('weak impact')
  })

  test('returns "no estimate" for 0', () => {
    expect(interpretImpact(0)).toBe('no estimate')
  })

  test('returns "negative side effect" for -1', () => {
    expect(interpretImpact(-1)).toBe('negative side effect')
  })
})
