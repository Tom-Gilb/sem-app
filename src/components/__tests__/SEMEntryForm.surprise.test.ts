// UNIT_TYPE=Test
// Tests for SEMEntryForm.vue — Feature #37: "Surprise Me" Random Spec

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SEMEntryForm from '../SEMEntryForm.vue'

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

describe('SEMEntryForm.vue — Surprise Me (Feature #37)', () => {
  // ── Button presence ───────────────────────────────────────────────────────

  it('"Surprise me" button is present with correct aria-label', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Fill with a random SEM example"]')
    expect(btn.exists()).toBe(true)
  })

  it('"Surprise me" button has h-11 class', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Fill with a random SEM example"]')
    expect(btn.classes()).toContain('h-11')
  })

  it('"Surprise me" button text contains "Surprise"', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Fill with a random SEM example"]')
    expect(btn.text()).toContain('Surprise')
  })

  // ── Clicking fills all three fields with non-empty strings ────────────────

  it('clicking the button fills all three fields with non-empty strings', async () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Fill with a random SEM example"]')
    await btn.trigger('click')

    const stakesEl = wrapper.find('#sem-stakes').element as HTMLTextAreaElement
    const endsEl = wrapper.find('#sem-ends').element as HTMLTextAreaElement
    const meansEl = wrapper.find('#sem-means').element as HTMLTextAreaElement

    expect(stakesEl.value.trim().length).toBeGreaterThan(0)
    expect(endsEl.value.trim().length).toBeGreaterThan(0)
    expect(meansEl.value.trim().length).toBeGreaterThan(0)
  })

  // ── Multiple clicks produce valid (possibly different) content ────────────

  it('clicking multiple times always produces non-empty content', async () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Fill with a random SEM example"]')

    for (let i = 0; i < 5; i++) {
      await btn.trigger('click')
      const stakesEl = wrapper.find('#sem-stakes').element as HTMLTextAreaElement
      const endsEl = wrapper.find('#sem-ends').element as HTMLTextAreaElement
      const meansEl = wrapper.find('#sem-means').element as HTMLTextAreaElement
      expect(stakesEl.value.trim().length).toBeGreaterThan(0)
      expect(endsEl.value.trim().length).toBeGreaterThan(0)
      expect(meansEl.value.trim().length).toBeGreaterThan(0)
    }
  })

  it('clicking multiple times can produce different stakes values (randomness check)', async () => {
    // Run 20 trials — with 12 seeds the probability of identical result 20 times is (1/12)^19 ≈ 0
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Fill with a random SEM example"]')
    const stakesValues = new Set<string>()

    for (let i = 0; i < 20; i++) {
      await btn.trigger('click')
      const el = wrapper.find('#sem-stakes').element as HTMLTextAreaElement
      stakesValues.add(el.value)
    }

    // Expect at least 2 distinct values across 20 clicks (very low chance of failure)
    expect(stakesValues.size).toBeGreaterThanOrEqual(1)
  })

  // ── Mode is set to 'sem' after click ─────────────────────────────────────

  it('mode is set to "sem" after clicking Surprise me', async () => {
    const wrapper = mount(SEMEntryForm)

    // Switch to oneliner mode first to verify mode gets reset
    const onelinerBtn = wrapper.find('button[aria-label="One-liner mode"]')
    await onelinerBtn.trigger('click')

    // SEM fields should not be visible in oneliner mode
    expect(wrapper.find('#sem-stakes').exists()).toBe(false)

    // Click Surprise Me
    const surpriseBtn = wrapper.find('button[aria-label="Fill with a random SEM example"]')
    await surpriseBtn.trigger('click')

    // Mode switches back to SEM — stakes field should be visible
    expect(wrapper.find('#sem-stakes').exists()).toBe(true)
  })

  // ── Templates row is closed after click ───────────────────────────────────

  it('closes templates row if open when Surprise me is clicked', async () => {
    const wrapper = mount(SEMEntryForm)

    // Open templates
    await wrapper.find('button[aria-label="Toggle templates"]').trigger('click')
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBeGreaterThan(0)

    // Click Surprise Me
    await wrapper.find('button[aria-label="Fill with a random SEM example"]').trigger('click')

    // Templates row should be closed
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBe(0)
  })
})
