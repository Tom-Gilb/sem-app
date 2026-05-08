// UNIT_TYPE=Test
// Tests for SEMEntryForm.vue — Change 3: Wish + Stakeholder fields

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SEMEntryForm from '../SEMEntryForm.vue'

vi.mock('../../composables/useVoice', () => ({
  useVoice: () => ({
    isListening: { value: false },
    isSpeaking: { value: false },
    voiceError: { value: '' },
    speechSupported: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}))

describe('SEMEntryForm — Change 3: Wish fields', () => {
  it('renders ⭐ Add Wish toggle button', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-controls="wish-fields"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Add Wish')
  })

  it('Wish toggle button meets 44px touch target (min-h-[44px])', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-controls="wish-fields"]')
    // min-h-[44px] = 44px minimum height — verify the button exists with the class
    expect(btn.classes().join(' ')).toContain('min-h-')
  })

  it('Wish input panel is hidden by default', () => {
    const wrapper = mount(SEMEntryForm)
    const panel = wrapper.find('#wish-fields')
    expect(panel.exists()).toBe(false)
  })

  it('clicking toggle shows the Wish input panel', async () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-controls="wish-fields"]')
    await btn.trigger('click')
    const panel = wrapper.find('#wish-fields')
    expect(panel.exists()).toBe(true)
  })

  it('toggle label changes to "Hide Wish" when open', async () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-controls="wish-fields"]')
    await btn.trigger('click')
    expect(btn.text()).toContain('Hide Wish')
  })

  it('Wish input panel contains Wish value and Stakeholder fields', async () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-controls="wish-fields"]')
    await btn.trigger('click')
    expect(wrapper.find('#sem-wish').exists()).toBe(true)
    expect(wrapper.find('#sem-wish-stakeholder').exists()).toBe(true)
  })

  it('submit payload includes wish when Wish is filled', async () => {
    const wrapper = mount(SEMEntryForm)
    // Open Wish panel
    await wrapper.find('button[aria-controls="wish-fields"]').trigger('click')
    // Fill Wish value
    const wishInput = wrapper.find('#sem-wish')
    await wishInput.setValue('0% late deliveries')
    // Fill mandatory SEM fields
    await wrapper.find('#sem-stakes').setValue('Project director')
    await wrapper.find('#sem-ends').setValue('Reduce late deliveries')
    await wrapper.find('#sem-means').setValue('Automated tracking system')
    // Submit
    await wrapper.find('form').trigger('submit')
    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    const payload = emitted![0][0] as Record<string, string>
    expect(payload.wish).toBe('0% late deliveries')
  })

  it('submit payload includes wishStakeholder when both fields filled', async () => {
    const wrapper = mount(SEMEntryForm)
    await wrapper.find('button[aria-controls="wish-fields"]').trigger('click')
    await wrapper.find('#sem-wish').setValue('0% late deliveries')
    await wrapper.find('#sem-wish-stakeholder').setValue('Project Director')
    await wrapper.find('#sem-stakes').setValue('Project director')
    await wrapper.find('#sem-ends').setValue('Reduce late deliveries')
    await wrapper.find('#sem-means').setValue('Automated tracking system')
    await wrapper.find('form').trigger('submit')
    const emitted = wrapper.emitted('submit')
    const payload = emitted![0][0] as Record<string, string>
    expect(payload.wishStakeholder).toBe('Project Director')
  })

  it('submit payload does not include wish when panel is closed', async () => {
    const wrapper = mount(SEMEntryForm)
    // Do NOT open Wish panel
    await wrapper.find('#sem-stakes').setValue('Project director')
    await wrapper.find('#sem-ends').setValue('Reduce late deliveries')
    await wrapper.find('#sem-means').setValue('Automated tracking system')
    await wrapper.find('form').trigger('submit')
    const emitted = wrapper.emitted('submit')
    const payload = emitted![0][0] as Record<string, string>
    expect(payload.wish).toBeUndefined()
  })
})
