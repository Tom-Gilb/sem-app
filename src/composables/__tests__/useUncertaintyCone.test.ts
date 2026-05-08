// UNIT_TYPE=Test
// Feature #168 — Tests for useUncertaintyCone composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUncertaintyCone } from '../useUncertaintyCone'

const STEPS_3 = [
  { id: 'step-0', title: 'Discovery', completed: true },
  { id: 'step-1', title: 'Implementation', completed: false },
  { id: 'step-2', title: 'Delivery', completed: false },
]

const STEPS_ALL_INCOMPLETE = [
  { id: 'step-0', title: 'Phase One', completed: false },
  { id: 'step-1', title: 'Phase Two', completed: false },
  { id: 'step-2', title: 'Phase Three', completed: false },
]

const STEPS_ALL_COMPLETE = [
  { id: 'step-0', title: 'Done A', completed: true },
  { id: 'step-1', title: 'Done B', completed: true },
]

describe('useUncertaintyCone', () => {
  // 1 — open starts false
  it('open starts false', () => {
    const { open } = useUncertaintyCone(() => STEPS_3)
    expect(open.value).toBe(false)
  })

  // 2 — correct step count
  it('points has the same length as input steps', () => {
    const { points } = useUncertaintyCone(() => STEPS_3)
    expect(points.value).toHaveLength(3)
  })

  // 3 — upperBound and lowerBound are non-negative
  it('upperBound and lowerBound are non-negative for all steps', () => {
    const { points } = useUncertaintyCone(() => STEPS_3)
    for (const p of points.value) {
      expect(p.upperBound).toBeGreaterThanOrEqual(0)
      expect(p.lowerBound).toBeGreaterThanOrEqual(0)
    }
  })

  // 4 — confidence is between 0 and 100
  it('confidence is between 0 and 100 for all steps', () => {
    const { points } = useUncertaintyCone(() => STEPS_3)
    for (const p of points.value) {
      expect(p.confidence).toBeGreaterThanOrEqual(0)
      expect(p.confidence).toBeLessThanOrEqual(100)
    }
  })

  // 5 — overallConfidence is average of all step confidences
  it('overallConfidence is the rounded average of all step confidences', () => {
    const { points, overallConfidence } = useUncertaintyCone(() => STEPS_3)
    const sum = points.value.reduce((a, p) => a + p.confidence, 0)
    const expected = Math.round(sum / points.value.length)
    expect(overallConfidence.value).toBe(expected)
  })

  // 6 — empty steps: points is empty, overallConfidence is 100
  it('edge case: empty steps returns empty points and overallConfidence=100', () => {
    const { points, overallConfidence } = useUncertaintyCone(() => [])
    expect(points.value).toHaveLength(0)
    expect(overallConfidence.value).toBe(100)
  })

  // 7 — single step
  it('single step: points has exactly 1 entry', () => {
    const { points } = useUncertaintyCone(() => [{ id: 'step-0', title: 'Solo', completed: false }])
    expect(points.value).toHaveLength(1)
  })

  // 8 — completed steps have lower or equal cone than incomplete at same position
  it('completed steps have lower uncertainty (cone) than their incomplete counterpart', () => {
    // Compare same index with completed=true vs completed=false
    const { points: completedPoints } = useUncertaintyCone(() => [
      { id: 'step-0', title: 'Step A', completed: true },
    ])
    const { points: incompletePoints } = useUncertaintyCone(() => [
      { id: 'step-0', title: 'Step A', completed: false },
    ])
    // Completed step cone (upper bound) should be <= incomplete cone
    expect(completedPoints.value[0].upperBound).toBeLessThanOrEqual(incompletePoints.value[0].upperBound)
  })

  // 9 — stepIndex matches array index
  it('stepIndex matches the array position', () => {
    const { points } = useUncertaintyCone(() => STEPS_3)
    points.value.forEach((p, i) => {
      expect(p.stepIndex).toBe(i)
    })
  })

  // 10 — stepTitle truncated to 12 chars
  it('stepTitle is truncated to at most 12 characters', () => {
    const { points } = useUncertaintyCone(() => [
      { id: 'step-0', title: 'A'.repeat(20), completed: false },
    ])
    expect(points.value[0].stepTitle.length).toBeLessThanOrEqual(12)
  })

  // 11 — completed flag is preserved
  it('completed field on ConePoint matches input step completed flag', () => {
    const { points } = useUncertaintyCone(() => STEPS_3)
    expect(points.value[0].completed).toBe(true)
    expect(points.value[1].completed).toBe(false)
    expect(points.value[2].completed).toBe(false)
  })

  // 12 — copyMarkdown returns string with correct headers
  it('copyMarkdown returns string containing expected headers', () => {
    const { copyMarkdown } = useUncertaintyCone(() => STEPS_3)
    const md = copyMarkdown()
    expect(md).toContain('# Uncertainty Cone')
    expect(md).toContain('Overall confidence:')
    expect(md).toContain('| Step | Upper | Lower | Confidence |')
  })

  // 13 — copyMarkdown table rows contain step titles and % symbols
  it('copyMarkdown table includes step titles and percentage values', () => {
    const { copyMarkdown } = useUncertaintyCone(() => STEPS_3)
    const md = copyMarkdown()
    expect(md).toContain('Discovery')
    expect(md).toContain('%')
  })

  // 14 — all-complete steps: confidence should be relatively high
  it('all-complete steps: overallConfidence is high (>= 80)', () => {
    const { overallConfidence } = useUncertaintyCone(() => STEPS_ALL_COMPLETE)
    expect(overallConfidence.value).toBeGreaterThanOrEqual(80)
  })

  // 15 — all-incomplete steps: later steps have higher uncertainty than earlier steps
  it('all-incomplete: later steps have >= uncertainty than earlier steps', () => {
    const { points } = useUncertaintyCone(() => STEPS_ALL_INCOMPLETE)
    // With no completed steps, cone should grow with position
    const first = points.value[0].upperBound
    const last = points.value[points.value.length - 1].upperBound
    expect(last).toBeGreaterThanOrEqual(first)
  })

  // 16 — upperBound equals lowerBound for symmetrical cone
  it('upperBound equals lowerBound (symmetric cone)', () => {
    const { points } = useUncertaintyCone(() => STEPS_3)
    for (const p of points.value) {
      expect(p.upperBound).toBe(p.lowerBound)
    }
  })

  // 17 — completed defaults to false when not provided
  it('completed defaults to false when not provided in step data', () => {
    const { points } = useUncertaintyCone(() => [{ id: 'step-0', title: 'No Flag' }])
    expect(points.value[0].completed).toBe(false)
  })
})
