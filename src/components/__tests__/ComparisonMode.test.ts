// Tests for ComparisonMode.vue — Feature #17

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ComparisonMode from '../ComparisonMode.vue'

// Stub child components to keep the test focused on ComparisonMode's own behaviour.
// SEMEntryForm and SpecOutput render substantial UI that's already covered by their own tests.
vi.mock('../SEMEntryForm.vue', () => ({
  default: {
    name: 'SEMEntryForm',
    template: '<form data-testid="sem-entry-form"><slot /></form>',
    emits: ['submit'],
  },
}))

vi.mock('../SpecOutput.vue', () => ({
  default: {
    name: 'SpecOutput',
    template: '<div data-testid="spec-output"><slot /></div>',
    props: ['loading', 'error', 'spec', 'markdown', 'rawInput'],
  },
}))

// Mock useSDK to avoid API calls
vi.mock('../../composables/useSDK', () => ({
  useSDK: () => ({
    loading: { value: false },
    error: { value: '' },
    translate: vi.fn().mockResolvedValue(null),
  }),
}))

// Mock useSpecExport
vi.mock('../../composables/useSpecExport', () => ({
  useSpecExport: () => ({
    serialise: vi.fn().mockReturnValue(''),
  }),
}))

describe('ComparisonMode.vue', () => {
  test('renders two SEMEntryForm instances', () => {
    const wrapper = mount(ComparisonMode)
    const forms = wrapper.findAll('[data-testid="sem-entry-form"]')
    expect(forms.length).toBe(2)
  })

  test('renders two SpecOutput instances', () => {
    const wrapper = mount(ComparisonMode)
    const outputs = wrapper.findAll('[data-testid="spec-output"]')
    expect(outputs.length).toBe(2)
  })

  test('emits "close" when back button is clicked', async () => {
    const wrapper = mount(ComparisonMode)
    const backBtn = wrapper.find('button[aria-label="Back to single view"]')
    expect(backBtn.exists()).toBe(true)

    await backBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)
  })

  test('back button has min-h-[44px] class', () => {
    const wrapper = mount(ComparisonMode)
    const backBtn = wrapper.find('button[aria-label="Back to single view"]')
    expect(backBtn.classes()).toContain('min-h-[44px]')
  })

  test('renders comparison mode title in header', () => {
    const wrapper = mount(ComparisonMode)
    expect(wrapper.text()).toContain('Comparison Mode')
  })

  test('header bar has gradient background classes', () => {
    const wrapper = mount(ComparisonMode)
    const header = wrapper.find('.from-indigo-600')
    expect(header.exists()).toBe(true)
  })

  test('two-panel layout uses grid with md:grid-cols-2', () => {
    const wrapper = mount(ComparisonMode)
    const grid = wrapper.find('.md\\:grid-cols-2')
    expect(grid.exists()).toBe(true)
  })
})
