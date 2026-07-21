// UNIT_TYPE=Test
// Tests for SpecCoach.vue — Feature #35

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SpecCoach from '../SpecCoach.vue'
import type { SpecBlock } from '../../types/spec'

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function',
      successCriteria: 'It works',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Test value',
      scale: '% passing',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Test solution',
      impact: 'V.Test ~90%',
      function: 'F.Test',
    },
  ],
}

describe('SpecCoach.vue', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '')
    vi.stubEnv('VITE_MOCK_MODE', 'false')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('renders nothing when visible=false', () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: false },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders FAB button when visible=true (collapsed state)', () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    const fab = wrapper.find('button[aria-label="Ask Anything"]')
    expect(fab.exists()).toBe(true)
  })

  it('FAB has aria-label="Ask Anything"', () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    const fab = wrapper.find('button')
    expect(fab.attributes('aria-label')).toBe('Ask Anything')
  })

  it('FAB has min-h-[56px] class', () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    const fab = wrapper.find('button[aria-label="Ask Anything"]')
    expect(fab.classes()).toContain('min-h-[56px]')
  })

  // The expanded panel uses <Teleport to="body"> — wrapper.find() cannot see
  // teleported content. These tests use attachTo+document.body.querySelector instead.
  // See: https://test-utils.vuejs.org/guide/advanced/teleport

  it('clicking FAB shows expanded chat panel', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Ask Anything"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Expanded panel is teleported to body — query document directly
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
    wrapper.unmount()
  })

  it('close button collapses the panel back to FAB', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Ask Anything"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()

    const closeBtn = document.body.querySelector('button[aria-label="Close Ask Anything"]') as HTMLButtonElement | null
    expect(closeBtn).toBeTruthy()
    closeBtn!.click()
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('[role="dialog"]')).toBeFalsy()
    expect(wrapper.find('button[aria-label="Ask Anything"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Send button has h-11 class (≥44px)', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Ask Anything"]').trigger('click')
    await wrapper.vm.$nextTick()

    const sendBtn = document.body.querySelector('button[aria-label="Send question"]') as HTMLButtonElement | null
    expect(sendBtn).toBeTruthy()
    expect(sendBtn!.classList.contains('h-11')).toBe(true)
    wrapper.unmount()
  })

  it('empty state message is shown when messages is empty', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Ask Anything"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Ask me anything about your spec!')
    wrapper.unmount()
  })

  it('after ask(), user message appears in list', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
      attachTo: document.body,
    })
    await wrapper.find('button[aria-label="Ask Anything"]').trigger('click')
    await wrapper.vm.$nextTick()

    const input = document.body.querySelector('input[type="text"]') as HTMLInputElement | null
    expect(input).toBeTruthy()
    // Set value via Vue model binding
    input!.value = 'What is the scale?'
    input!.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()

    const sendBtn = document.body.querySelector('button[aria-label="Send question"]') as HTMLButtonElement | null
    expect(sendBtn).toBeTruthy()
    sendBtn!.click()
    await wrapper.vm.$nextTick()

    // The user message should appear immediately (before async coach response)
    expect(document.body.textContent).toContain('What is the scale?')
    wrapper.unmount()
  })
})
