// Tests for SpecWizard.vue — Feature #53: Progressive spec wizard

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SpecWizard from '../SpecWizard.vue'

function makeWrapper(overrides: { onSubmit?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn> } = {}) {
  const onSubmit = overrides.onSubmit ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()
  const wrapper = mount(SpecWizard, {
    props: { onSubmit, onClose },
  })
  return { wrapper, onSubmit, onClose }
}

describe('SpecWizard.vue', () => {

  test('renders step 1 on mount', () => {
    const { wrapper } = makeWrapper()
    const indicator = wrapper.find('[data-testid="step-indicator"]')
    expect(indicator.exists()).toBe(true)
    expect(indicator.text()).toBe('Step 1 of 4')
  })

  test('"Step 1 of 4" text is visible', () => {
    const { wrapper } = makeWrapper()
    expect(wrapper.text()).toContain('Step 1 of 4')
  })

  test('progress bar has exactly 4 segments', () => {
    const { wrapper } = makeWrapper()
    const segments = wrapper.findAll('[data-testid="progress-segment"]')
    expect(segments).toHaveLength(4)
  })

  test('first step has one emerald segment and three gray segments', () => {
    const { wrapper } = makeWrapper()
    const segments = wrapper.findAll('[data-testid="progress-segment"]')
    expect(segments[0].classes()).toContain('bg-emerald-500')
    expect(segments[1].classes()).toContain('bg-gray-200')
    expect(segments[2].classes()).toContain('bg-gray-200')
    expect(segments[3].classes()).toContain('bg-gray-200')
  })

  test('stakes textarea is present and accepts input', async () => {
    const { wrapper } = makeWrapper()
    const textarea = wrapper.find('[data-testid="step-textarea"]')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('My stakes value')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('My stakes value')
  })

  test('"Next →" button text on steps 1–3', () => {
    const { wrapper } = makeWrapper()
    const nextBtn = wrapper.find('[data-testid="next-button"]')
    expect(nextBtn.text()).toBe('Next →')
  })

  test('"Next →" button moves to step 2', async () => {
    const { wrapper } = makeWrapper()
    const nextBtn = wrapper.find('[data-testid="next-button"]')
    await nextBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="step-indicator"]').text()).toBe('Step 2 of 4')
  })

  test('Back button is disabled on step 1', () => {
    const { wrapper } = makeWrapper()
    const backBtn = wrapper.find('[data-testid="back-button"]')
    expect(backBtn.attributes('disabled')).toBeDefined()
  })

  test('on step 2, Back button is enabled and moves back to step 1', async () => {
    const { wrapper } = makeWrapper()
    // Go to step 2
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="step-indicator"]').text()).toBe('Step 2 of 4')

    const backBtn = wrapper.find('[data-testid="back-button"]')
    expect(backBtn.attributes('disabled')).toBeUndefined()

    await backBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="step-indicator"]').text()).toBe('Step 1 of 4')
  })

  test('on step 4, submit button says "✨ Generate Spec"', async () => {
    const { wrapper } = makeWrapper()
    const nextBtn = wrapper.find('[data-testid="next-button"]')
    // Advance to step 4
    for (let i = 0; i < 3; i++) {
      await nextBtn.trigger('click')
      await wrapper.vm.$nextTick()
    }
    expect(wrapper.find('[data-testid="step-indicator"]').text()).toBe('Step 4 of 4')
    expect(wrapper.find('[data-testid="next-button"]').text()).toBe('✨ Generate Spec')
  })

  test('clicking "✨ Generate Spec" calls onSubmit with filled values', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const wrapper = mount(SpecWizard, { props: { onSubmit, onClose } })
    const nextBtn = wrapper.find('[data-testid="next-button"]')

    // Step 1 — stakes
    await wrapper.find('[data-testid="step-textarea"]').setValue('My stakes')
    await nextBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Step 2 — ends
    await wrapper.find('[data-testid="step-textarea"]').setValue('My ends')
    await nextBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Step 3 — means
    await wrapper.find('[data-testid="step-textarea"]').setValue('My means')
    await nextBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // Step 4 — one-liner
    await wrapper.find('[data-testid="step-textarea"]').setValue('My one liner')
    await nextBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith('My stakes', 'My ends', 'My means', 'My one liner')
  })

  test('clicking "✨ Generate Spec" calls onClose', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const wrapper = mount(SpecWizard, { props: { onSubmit, onClose } })
    const nextBtn = wrapper.find('[data-testid="next-button"]')

    // Advance to step 4 and submit
    for (let i = 0; i < 3; i++) {
      await nextBtn.trigger('click')
      await wrapper.vm.$nextTick()
    }
    await nextBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(onClose).toHaveBeenCalledOnce()
  })

  test('example text click inserts example into textarea', async () => {
    const { wrapper } = makeWrapper()
    const exampleBtn = wrapper.find('[data-testid="example-button"]')
    const exampleText = exampleBtn.text()

    await exampleBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const textarea = wrapper.find('[data-testid="step-textarea"]')
    expect((textarea.element as HTMLTextAreaElement).value).toBe(exampleText)
  })

  test('close × button calls onClose', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const wrapper = mount(SpecWizard, { props: { onSubmit, onClose } })
    await wrapper.find('[aria-label="Close wizard"]').trigger('click')
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('step title changes as user progresses', async () => {
    const { wrapper } = makeWrapper()
    expect(wrapper.find('[data-testid="step-title"]').text()).toBe("What's at stake?")
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="step-title"]').text()).toBe('What outcomes do you want?')
  })

})
