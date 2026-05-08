// Tests for CelebrationEffect.vue — Feature #12

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CelebrationEffect from '../CelebrationEffect.vue'

describe('CelebrationEffect.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders 20 particles when visible=true', () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    const particles = wrapper.findAll('.celebration-particle')
    expect(particles.length).toBe(20)
  })

  test('renders no particles when visible=false', () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: false },
    })
    const particles = wrapper.findAll('.celebration-particle')
    expect(particles.length).toBe(0)
  })

  test('overlay has pointer-events-none equivalent (aria-hidden)', () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    const overlay = wrapper.find('.celebration-overlay')
    expect(overlay.attributes('aria-hidden')).toBe('true')
  })

  test('emits "done" after 3000ms', async () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    expect(wrapper.emitted('done')).toBeUndefined()

    vi.advanceTimersByTime(3000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('done')).toBeTruthy()
    expect(wrapper.emitted('done')!.length).toBe(1)
  })

  test('does not emit "done" before 3000ms', () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    vi.advanceTimersByTime(2999)
    expect(wrapper.emitted('done')).toBeUndefined()
  })

  test('particles have staggered animation-delay styles', () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    const particles = wrapper.findAll('.celebration-particle')
    // First particle should have delay 0ms
    expect(particles[0].attributes('style')).toContain('animation-delay: 0ms')
    // Last particle should have delay 1000ms
    expect(particles[particles.length - 1].attributes('style')).toContain('animation-delay: 1000ms')
  })

  test('particles use expected colours', () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    const firstParticle = wrapper.find('.celebration-particle')
    // First colour in list is #6366f1
    expect(firstParticle.attributes('style')).toContain('#6366f1')
  })

  test('hides immediately when visible prop changes to false', async () => {
    const wrapper = mount(CelebrationEffect, {
      props: { visible: true },
    })
    expect(wrapper.findAll('.celebration-particle').length).toBe(20)

    await wrapper.setProps({ visible: false })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.celebration-particle').length).toBe(0)
  })
})
