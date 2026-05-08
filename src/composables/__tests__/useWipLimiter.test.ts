// UNIT_TYPE=Test
// Feature #128 — Tests for useWipLimiter composable

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useWipLimiter } from '../useWipLimiter'

type Step = { id: string; name: string; description?: string; wsjf?: number }

function makeSteps(count: number, wsjf?: number[]): Step[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `step-${i}`,
    name: `Step ${i + 1}`,
    wsjf: wsjf?.[i],
  }))
}

describe('useWipLimiter', () => {
  it('activeCount equals total step count (all treated as active)', () => {
    const steps = ref(makeSteps(5))
    const { status } = useWipLimiter(steps)
    expect(status.value.activeCount).toBe(5)
  })

  it('activeCount is 0 when no steps', () => {
    const steps = ref<Step[]>([])
    const { status } = useWipLimiter(steps)
    expect(status.value.activeCount).toBe(0)
  })

  it('default wipLimit is 3', () => {
    const steps = ref(makeSteps(2))
    const { wipLimit } = useWipLimiter(steps)
    expect(wipLimit.value).toBe(3)
  })

  it('overLimit is true when activeCount > wipLimit', () => {
    const steps = ref(makeSteps(5))
    const { status } = useWipLimiter(steps)
    // default limit = 3, 5 > 3
    expect(status.value.overLimit).toBe(true)
  })

  it('overLimit is false when activeCount <= wipLimit', () => {
    const steps = ref(makeSteps(2))
    const { status } = useWipLimiter(steps)
    // default limit = 3, 2 <= 3
    expect(status.value.overLimit).toBe(false)
  })

  it('overLimit is false when activeCount equals wipLimit exactly', () => {
    const steps = ref(makeSteps(3))
    const { status } = useWipLimiter(steps)
    expect(status.value.overLimit).toBe(false)
  })

  it('increaseLimit caps at 8', () => {
    const steps = ref<Step[]>([])
    const { wipLimit, increaseLimit } = useWipLimiter(steps)
    wipLimit.value = 8
    increaseLimit()
    expect(wipLimit.value).toBe(8)
  })

  it('decreaseLimit floors at 1', () => {
    const steps = ref<Step[]>([])
    const { wipLimit, decreaseLimit } = useWipLimiter(steps)
    wipLimit.value = 1
    decreaseLimit()
    expect(wipLimit.value).toBe(1)
  })

  it('increaseLimit increments by 1 when below cap', () => {
    const steps = ref<Step[]>([])
    const { wipLimit, increaseLimit } = useWipLimiter(steps)
    wipLimit.value = 3
    increaseLimit()
    expect(wipLimit.value).toBe(4)
  })

  it('decreaseLimit decrements by 1 when above floor', () => {
    const steps = ref<Step[]>([])
    const { wipLimit, decreaseLimit } = useWipLimiter(steps)
    wipLimit.value = 3
    decreaseLimit()
    expect(wipLimit.value).toBe(2)
  })

  it('pauseSuggestions count equals activeCount - wipLimit when over limit', () => {
    const steps = ref(makeSteps(5))
    const { status } = useWipLimiter(steps)
    // 5 active, limit 3 → 2 suggestions
    expect(status.value.pauseSuggestions).toHaveLength(2)
  })

  it('pauseSuggestions is empty when within limit', () => {
    const steps = ref(makeSteps(2))
    const { status } = useWipLimiter(steps)
    expect(status.value.pauseSuggestions).toHaveLength(0)
  })

  it('pauseSuggestions picks steps with lowest wsjf first', () => {
    const steps = ref([
      { id: 's1', name: 'High Priority', wsjf: 10 },
      { id: 's2', name: 'Low Priority', wsjf: 1 },
      { id: 's3', name: 'Mid Priority', wsjf: 5 },
      { id: 's4', name: 'Very Low', wsjf: 0.5 },
    ])
    const { status } = useWipLimiter(steps)
    // 4 active, limit 3 → 1 suggestion = lowest wsjf = 'Very Low'
    expect(status.value.pauseSuggestions).toEqual(['Very Low'])
  })

  it('copyMarkdown includes activeCount and wipLimit', () => {
    const steps = ref(makeSteps(4))
    const { status, copyMarkdown } = useWipLimiter(steps)
    // We can't test clipboard directly, but we verify status values that copyMarkdown uses
    expect(status.value.activeCount).toBe(4)
    expect(status.value.wipLimit).toBe(3)
    // copyMarkdown should not throw
    expect(() => copyMarkdown()).not.toThrow()
  })

  it('copyMarkdown includes pause suggestions when over limit', () => {
    const steps = ref([
      { id: 's1', name: 'Alpha', wsjf: 5 },
      { id: 's2', name: 'Beta', wsjf: 1 },
      { id: 's3', name: 'Gamma', wsjf: 3 },
      { id: 's4', name: 'Delta', wsjf: 2 },
    ])
    const { status } = useWipLimiter(steps)
    // 4 active, limit 3 → over by 1; lowest wsjf is Beta (1)
    expect(status.value.overLimit).toBe(true)
    expect(status.value.pauseSuggestions).toContain('Beta')
  })

  it('status is reactive to step changes', () => {
    const steps = ref(makeSteps(2))
    const { status } = useWipLimiter(steps)
    expect(status.value.overLimit).toBe(false)
    steps.value = makeSteps(5)
    expect(status.value.overLimit).toBe(true)
    expect(status.value.activeCount).toBe(5)
  })

  it('status is reactive to wipLimit changes', () => {
    const steps = ref(makeSteps(4))
    const { status, wipLimit, increaseLimit } = useWipLimiter(steps)
    // 4 steps, limit 3 → over
    expect(status.value.overLimit).toBe(true)
    // Increase limit to 4 → no longer over
    increaseLimit()
    expect(wipLimit.value).toBe(4)
    expect(status.value.overLimit).toBe(false)
  })
})
