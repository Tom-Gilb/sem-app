// Tests for ValueCounter.vue — Feature #15

import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ValueCounter from '../ValueCounter.vue'
import type { EvoStep } from '../../types/evo-plan'

function makeStep(name: string): EvoStep {
  return {
    name,
    description: 'A step',
    linkedValues: ['V.Test'],
    linkedSolution: 'S.Test',
    effortPercent: 20,
  }
}

const STEPS: EvoStep[] = [makeStep('S.Evo1'), makeStep('S.Evo2')]

describe('ValueCounter.vue', () => {
  test('renders nothing when currentStage < 2', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 1 },
    })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  test('renders nothing when confirmedSteps is empty', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: [], currentStage: 3 },
    })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  test('renders when currentStage >= 2 and steps exist', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 2 },
    })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  test('stage 2 shows 20% value', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 2 },
    })
    expect(wrapper.text()).toContain('20%')
  })

  test('stage 3 shows 40% value', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 3 },
    })
    expect(wrapper.text()).toContain('40%')
  })

  test('stage 4 shows 60% value', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 4 },
    })
    expect(wrapper.text()).toContain('60%')
  })

  test('stage 5 shows 80% value', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 5 },
    })
    expect(wrapper.text()).toContain('80%')
  })

  test('prioritisedExported=true shows 100%', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 5, prioritisedExported: true },
    })
    expect(wrapper.text()).toContain('100%')
  })

  test('bar width style reflects target percentage for stage 3', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 3 },
    })
    const bar = wrapper.find('.bg-emerald-500')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('style')).toContain('width: 40%')
  })

  test('bar width style reflects target percentage for stage 5', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 5 },
    })
    const bar = wrapper.find('.bg-emerald-500')
    expect(bar.attributes('style')).toContain('width: 80%')
  })

  test('label text contains "Value delivered"', () => {
    const wrapper = mount(ValueCounter, {
      props: { confirmedSteps: STEPS, currentStage: 2 },
    })
    expect(wrapper.text()).toContain('Value delivered')
  })
})
