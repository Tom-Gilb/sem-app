// UNIT_TYPE=Composable
// Feature #64 — Evo step cost estimator
import { ref, computed, type Ref } from 'vue'

export interface StepCost {
  stepId: string
  stepName: string
  estimatedHours: number
  cost: number
  formattedCost: string
}

export function useStepCostEstimator(
  steps: Ref<Array<{ id?: string; name: string; effort?: number; estimatedHours?: number }>>
) {
  const hourlyRate = ref(100)  // default $100/hr
  const costPanelOpen = ref(false)

  const stepCosts = computed<StepCost[]>(() => {
    return steps.value.map((step, i) => {
      const hours = step.effort ?? step.estimatedHours ?? (i + 1) * 8  // fallback: 8h per step
      const cost = hours * hourlyRate.value
      return {
        stepId: step.id ?? `step-${i}`,
        stepName: step.name,
        estimatedHours: hours,
        cost,
        formattedCost: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cost),
      }
    })
  })

  const totalCost = computed(() =>
    stepCosts.value.reduce((sum, s) => sum + s.cost, 0)
  )

  const formattedTotalCost = computed(() =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalCost.value)
  )

  const averageCostPerStep = computed(() =>
    stepCosts.value.length > 0 ? totalCost.value / stepCosts.value.length : 0
  )

  const formattedAverageCost = computed(() =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(averageCostPerStep.value)
  )

  return {
    hourlyRate,
    costPanelOpen,
    stepCosts,
    totalCost,
    formattedTotalCost,
    averageCostPerStep,
    formattedAverageCost,
  }
}
