// UNIT_TYPE=Test
// Tests for SEMEntryForm.vue — Feature #30: One-Click Spec Templates

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SEMEntryForm from '../SEMEntryForm.vue'
import { SEM_TEMPLATES } from '../../data/semTemplates'

// Mock useVoice to avoid browser API issues in test environment
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

describe('SEMEntryForm.vue — Templates (Feature #30)', () => {
  it('Templates toggle button is present', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Toggle templates"]')
    expect(btn.exists()).toBe(true)
  })

  it('Templates toggle button has min h-11 (44px equivalent)', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Toggle templates"]')
    expect(btn.classes()).toContain('h-11')
  })

  it('template pills are hidden by default', () => {
    const wrapper = mount(SEMEntryForm)
    const pills = wrapper.findAll('button[aria-label*="Apply"]')
    expect(pills.length).toBe(0)
  })

  it('clicking toggle button shows template pills', async () => {
    const wrapper = mount(SEMEntryForm)
    const toggleBtn = wrapper.find('button[aria-label="Toggle templates"]')
    await toggleBtn.trigger('click')
    const pills = wrapper.findAll('button[aria-label*="Apply"]')
    expect(pills.length).toBe(SEM_TEMPLATES.length)
  })

  it('all 6 templates are rendered when open', async () => {
    const wrapper = mount(SEMEntryForm)
    await wrapper.find('button[aria-label="Toggle templates"]').trigger('click')
    const pills = wrapper.findAll('button[aria-label*="Apply"]')
    expect(pills.length).toBe(6)
  })

  it('clicking a template pill fills fields and closes template row', async () => {
    const wrapper = mount(SEMEntryForm)
    // Open templates
    await wrapper.find('button[aria-label="Toggle templates"]').trigger('click')
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBeGreaterThan(0)

    // Click first template
    const firstPill = wrapper.find('button[aria-label="Apply Product Launch template"]')
    expect(firstPill.exists()).toBe(true)
    await firstPill.trigger('click')

    // Template row should be closed
    const pills = wrapper.findAll('button[aria-label*="Apply"]')
    expect(pills.length).toBe(0)

    // Stakes textarea should have product-launch template value
    const stakesTextarea = wrapper.find('#sem-stakes')
    expect((stakesTextarea.element as HTMLTextAreaElement).value).toBe(
      SEM_TEMPLATES[0].stakes,
    )
  })

  it('template pills show icon and label', async () => {
    const wrapper = mount(SEMEntryForm)
    await wrapper.find('button[aria-label="Toggle templates"]').trigger('click')

    for (const tpl of SEM_TEMPLATES) {
      const pill = wrapper.find(`button[aria-label="Apply ${tpl.label} template"]`)
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toContain(tpl.icon)
      expect(pill.text()).toContain(tpl.label)
    }
  })

  it('clicking toggle button again hides template pills', async () => {
    const wrapper = mount(SEMEntryForm)
    const toggleBtn = wrapper.find('button[aria-label="Toggle templates"]')
    await toggleBtn.trigger('click')
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBe(6)
    await toggleBtn.trigger('click')
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBe(0)
  })
})
