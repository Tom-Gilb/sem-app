// UNIT_TYPE=Test
// Feature #64 — Tests for useStepCostEstimator composable

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useStepCostEstimator } from '../useStepCostEstimator'

describe('useStepCostEstimator', () => {
  it('stepCosts is empty when steps ref is empty', () => {
    const steps = ref<Array<{ name: string; effort?: number }>>([])
    const { stepCosts } = useStepCostEstimator(steps)
    expect(stepCosts.value).toHaveLength(0)
  })

  it('with 1 step (effort=10), hourlyRate=100 → cost=$1000', () => {
    const steps = ref([{ name: 'Step A', effort: 10 }])
    const { stepCosts, hourlyRate } = useStepCostEstimator(steps)
    hourlyRate.value = 100
    expect(stepCosts.value[0].cost).toBe(1000)
  })

  it('formattedTotalCost includes "$"', () => {
    const steps = ref([{ name: 'Step A', effort: 10 }])
    const { formattedTotalCost } = useStepCostEstimator(steps)
    expect(formattedTotalCost.value).toContain('$')
  })

  it('totalCost equals sum of individual step costs for 3 steps', () => {
    const steps = ref([
      { name: 'Step A', effort: 10 },
      { name: 'Step B', effort: 20 },
      { name: 'Step C', effort: 5 },
    ])
    const { stepCosts, totalCost, hourlyRate } = useStepCostEstimator(steps)
    hourlyRate.value = 50
    const sumOfIndividual = stepCosts.value.reduce((sum, s) => sum + s.cost, 0)
    expect(totalCost.value).toBe(sumOfIndividual)
  })

  it('hourlyRate change updates stepCosts reactively', () => {
    const steps = ref([{ name: 'Step A', effort: 10 }])
    const { stepCosts, hourlyRate } = useStepCostEstimator(steps)
    hourlyRate.value = 100
    expect(stepCosts.value[0].cost).toBe(1000)
    hourlyRate.value = 200
    expect(stepCosts.value[0].cost).toBe(2000)
  })

  it('averageCostPerStep equals totalCost divided by stepCount', () => {
    const steps = ref([
      { name: 'Step A', effort: 10 },
      { name: 'Step B', effort: 30 },
    ])
    const { totalCost, averageCostPerStep, hourlyRate } = useStepCostEstimator(steps)
    hourlyRate.value = 100
    expect(averageCostPerStep.value).toBe(totalCost.value / 2)
  })

  it('fallback effort (no effort field): cost > 0 (default hours applied)', () => {
    const steps = ref([{ name: 'Step with no effort' }])
    const { stepCosts, hourlyRate } = useStepCostEstimator(steps)
    hourlyRate.value = 100
    expect(stepCosts.value[0].cost).toBeGreaterThan(0)
    expect(stepCosts.value[0].estimatedHours).toBeGreaterThan(0)
  })

  it('costPanelOpen starts false', () => {
    const steps = ref([{ name: 'Step A', effort: 10 }])
    const { costPanelOpen } = useStepCostEstimator(steps)
    expect(costPanelOpen.value).toBe(false)
  })
})
