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
    const fab = wrapper.find('button[aria-label="Open spec coach"]')
    expect(fab.exists()).toBe(true)
  })

  it('FAB has aria-label="Open spec coach"', () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    const fab = wrapper.find('button')
    expect(fab.attributes('aria-label')).toBe('Open spec coach')
  })

  it('FAB has min-h-[56px] class', () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    const fab = wrapper.find('button[aria-label="Open spec coach"]')
    expect(fab.classes()).toContain('min-h-[56px]')
  })

  it('clicking FAB shows expanded chat panel', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    const fab = wrapper.find('button[aria-label="Open spec coach"]')
    await fab.trigger('click')

    // Expanded panel should be visible — look for the dialog role
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('close button collapses the panel back to FAB', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    // Open first
    await wrapper.find('button[aria-label="Open spec coach"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    // Close
    const closeBtn = wrapper.find('button[aria-label="Close spec coach"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Open spec coach"]').exists()).toBe(true)
  })

  it('Send button has h-11 class (≥44px)', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    await wrapper.find('button[aria-label="Open spec coach"]').trigger('click')

    const sendBtn = wrapper.find('button[aria-label="Send message"]')
    expect(sendBtn.exists()).toBe(true)
    expect(sendBtn.classes()).toContain('h-11')
  })

  it('empty state message is shown when messages is empty', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    await wrapper.find('button[aria-label="Open spec coach"]').trigger('click')

    expect(wrapper.text()).toContain('Ask me anything about your spec!')
  })

  it('after ask(), user message appears in list', async () => {
    const wrapper = mount(SpecCoach, {
      props: { spec: minimalSpec, visible: true },
    })
    await wrapper.find('button[aria-label="Open spec coach"]').trigger('click')

    // Type a message
    const input = wrapper.find('input[type="text"]')
    await input.setValue('What is the scale?')

    // Click Send
    const sendBtn = wrapper.find('button[aria-label="Send message"]')
    await sendBtn.trigger('click')

    // The user message should appear immediately (before async coach response)
    expect(wrapper.text()).toContain('What is the scale?')
  })
})
