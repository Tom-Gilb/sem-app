// Tests for ReplayOverlay.vue — Feature #40

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReplayOverlay from '../ReplayOverlay.vue'
import type { EvoStep } from '../../types/evo-plan'

function makeStep(name: string, effortPercent = 20): EvoStep {
  return {
    name,
    description: 'A step',
    linkedValues: ['V.Test'],
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

const STEPS: EvoStep[] = [
  makeStep('S.Evo1'),
  makeStep('S.Evo2'),
  makeStep('S.Evo3'),
]

describe('ReplayOverlay.vue', () => {
  test('not rendered when isReplaying=false', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: -1,
        replayValue: 0,
        isReplaying: false,
      },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  test('rendered when isReplaying=true', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 0,
        replayValue: 10,
        isReplaying: true,
      },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  test('shows replayValue as formatted percentage', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 1,
        replayValue: 42.7,
        isReplaying: true,
      },
    })
    expect(wrapper.text()).toContain('43% value delivered')
  })

  test('shows replayValue=0 as "0% value delivered"', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 0,
        replayValue: 0,
        isReplaying: true,
      },
    })
    expect(wrapper.text()).toContain('0% value delivered')
  })

  test('steps list renders correct count', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 0,
        replayValue: 0,
        isReplaying: true,
      },
    })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(STEPS.length)
  })

  test('active step has ▶ indicator', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 1,
        replayValue: 20,
        isReplaying: true,
      },
    })
    const items = wrapper.findAll('li')
    // index 1 is the active step
    expect(items[1].text()).toContain('▶')
  })

  test('completed steps have ✅ indicator', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 2,
        replayValue: 40,
        isReplaying: true,
      },
    })
    const items = wrapper.findAll('li')
    // indices 0 and 1 are complete
    expect(items[0].text()).toContain('✅')
    expect(items[1].text()).toContain('✅')
  })

  test('pending steps have ⏳ indicator', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 0,
        replayValue: 0,
        isReplaying: true,
      },
    })
    const items = wrapper.findAll('li')
    // indices 1 and 2 are pending
    expect(items[1].text()).toContain('⏳')
    expect(items[2].text()).toContain('⏳')
  })

  test('active step row has bg-emerald-50 class', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 1,
        replayValue: 20,
        isReplaying: true,
      },
    })
    const items = wrapper.findAll('li')
    expect(items[1].classes()).toContain('bg-emerald-50')
  })

  test('stop button has min-h-[44px]', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 0,
        replayValue: 0,
        isReplaying: true,
      },
    })
    const stopBtn = wrapper.find('button')
    expect(stopBtn.exists()).toBe(true)
    expect(stopBtn.classes()).toContain('min-h-[44px]')
  })

  test('stop button click emits stop event', async () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 0,
        replayValue: 0,
        isReplaying: true,
      },
    })
    const stopBtn = wrapper.find('button')
    await stopBtn.trigger('click')
    expect(wrapper.emitted('stop')).toBeTruthy()
    expect(wrapper.emitted('stop')).toHaveLength(1)
  })

  test('completion banner shown when replayStep === steps.length', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: STEPS.length,
        replayValue: 60,
        isReplaying: true,
      },
    })
    expect(wrapper.text()).toContain('All value delivered!')
  })

  test('completion banner not shown when replayStep < steps.length', () => {
    const wrapper = mount(ReplayOverlay, {
      props: {
        steps: STEPS,
        replayStep: 1,
        replayValue: 20,
        isReplaying: true,
      },
    })
    expect(wrapper.text()).not.toContain('All value delivered!')
  })
})
