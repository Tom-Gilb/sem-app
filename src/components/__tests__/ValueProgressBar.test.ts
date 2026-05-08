// UNIT_TYPE=Test
// Tests for ValueProgressBar.vue — Change 1: inline progress bar for V. entries

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ValueProgressBar from '../ValueProgressBar.vue'

describe('ValueProgressBar — Change 1', () => {
  it('renders without errors given numeric values', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: '35%', tolerable: '15%', goal: '5%' },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows "lower is better" label when status > goal', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: '35%', tolerable: '15%', goal: '5%' },
    })
    expect(wrapper.text()).toContain('lower is better')
  })

  it('shows "higher is better" label when status < goal', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: '35%', tolerable: '65%', goal: '90%' },
    })
    expect(wrapper.text()).toContain('higher is better')
  })

  it('shows non-numeric fallback when values cannot be parsed', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: 'baseline', tolerable: '', goal: 'target' },
    })
    expect(wrapper.text()).toContain('non-numeric scale')
  })

  it('renders marker labels for Status, Tolerable, Goal', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: '35%', tolerable: '15%', goal: '5%' },
    })
    // Marker row should contain all three icons
    expect(wrapper.text()).toContain('📍')
    expect(wrapper.text()).toContain('🟡')
    expect(wrapper.text()).toContain('🟢')
  })

  it('works with no Tolerable provided', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: '35%', tolerable: '', goal: '5%' },
    })
    expect(wrapper.exists()).toBe(true)
    // No amber marker label
    expect(wrapper.text()).not.toContain('🟡')
  })

  it('has aria-label on the container', () => {
    const wrapper = mount(ValueProgressBar, {
      props: { status: '35%', tolerable: '15%', goal: '5%' },
    })
    const el = wrapper.find('[aria-label]')
    expect(el.exists()).toBe(true)
  })
})
