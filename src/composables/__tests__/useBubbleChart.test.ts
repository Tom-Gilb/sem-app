// UNIT_TYPE=Composable
// Feature #89 — Tests for useBubbleChart composable
import { describe, test, expect } from 'vitest'
import { ref } from 'vue'
import { useBubbleChart } from '../useBubbleChart'
import type { EvoStep } from '../../types/evo-plan'

function makeStep(name: string, effortPercent = 20): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues: ['V.Alpha'],
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

describe('useBubbleChart', () => {
  test('initial: selectedStepId is null', () => {
    const steps = ref<EvoStep[]>([])
    const { selectedStepId } = useBubbleChart(steps)
    expect(selectedStepId.value).toBeNull()
  })

  test('empty steps: bubblePoints is empty', () => {
    const steps = ref<EvoStep[]>([])
    const { bubblePoints } = useBubbleChart(steps)
    expect(bubblePoints.value).toHaveLength(0)
  })

  test('1 step: produces 1 bubble point', () => {
    const steps = ref<EvoStep[]>([makeStep('Step A', 50)])
    const { bubblePoints } = useBubbleChart(steps)
    expect(bubblePoints.value).toHaveLength(1)
  })

  test('bubble.x is within 0–100', () => {
    const steps = ref<EvoStep[]>([
      makeStep('Step A', 0),
      makeStep('Step B', 50),
      makeStep('Step C', 100),
    ])
    const { bubblePoints } = useBubbleChart(steps)
    for (const point of bubblePoints.value) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(100)
    }
  })

  test('bubble.y is within 0–100', () => {
    const steps = ref<EvoStep[]>([
      makeStep('Step A', 20),
      makeStep('Step B', 30),
      makeStep('Step C', 50),
    ])
    const { bubblePoints } = useBubbleChart(steps)
    for (const point of bubblePoints.value) {
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(100)
    }
  })

  test('bubble.radius is within 8–24', () => {
    const steps = ref<EvoStep[]>([
      makeStep('Step A', 0),
      makeStep('Step B', 50),
      makeStep('Step C', 100),
    ])
    const { bubblePoints } = useBubbleChart(steps)
    for (const point of bubblePoints.value) {
      expect(point.radius).toBeGreaterThanOrEqual(8)
      expect(point.radius).toBeLessThanOrEqual(24)
    }
  })

  test('selectStep sets selectedStepId', () => {
    const steps = ref<EvoStep[]>([makeStep('Step A', 20)])
    const { selectedStepId, selectStep } = useBubbleChart(steps)
    selectStep('step-0')
    expect(selectedStepId.value).toBe('step-0')
  })

  test('selectStep(null) clears selectedStepId', () => {
    const steps = ref<EvoStep[]>([makeStep('Step A', 20)])
    const { selectedStepId, selectStep } = useBubbleChart(steps)
    selectStep('step-0')
    expect(selectedStepId.value).toBe('step-0')
    selectStep(null)
    expect(selectedStepId.value).toBeNull()
  })

  test('selected bubble has selected=true when stepId matches', () => {
    const steps = ref<EvoStep[]>([
      makeStep('Step A', 20),
      makeStep('Step B', 40),
    ])
    const { bubblePoints, selectStep } = useBubbleChart(steps)
    selectStep('step-0')
    const selected = bubblePoints.value.find(p => p.stepId === 'step-0')
    const notSelected = bubblePoints.value.find(p => p.stepId === 'step-1')
    expect(selected?.selected).toBe(true)
    expect(notSelected?.selected).toBe(false)
  })

  test('title is truncated to 20 chars', () => {
    const longName = 'A Very Long Step Name That Exceeds Twenty Characters'
    const steps = ref<EvoStep[]>([makeStep(longName, 20)])
    const { bubblePoints } = useBubbleChart(steps)
    expect(bubblePoints.value[0].title).toHaveLength(20)
  })

  test('multiple steps produce correct count of bubble points', () => {
    const steps = ref<EvoStep[]>([
      makeStep('Step A', 10),
      makeStep('Step B', 20),
      makeStep('Step C', 30),
      makeStep('Step D', 40),
      makeStep('Step E', 50),
    ])
    const { bubblePoints } = useBubbleChart(steps)
    expect(bubblePoints.value).toHaveLength(5)
  })

  test('bubble colours rotate through the palette', () => {
    const steps = ref<EvoStep[]>(Array.from({ length: 7 }, (_, i) => makeStep(`Step ${i}`, 20)))
    const { bubblePoints } = useBubbleChart(steps)
    // First and 7th bubble (index 0 and 6) should have the same colour (palette length is 6)
    expect(bubblePoints.value[0].colour).toBe(bubblePoints.value[6].colour)
  })
})
