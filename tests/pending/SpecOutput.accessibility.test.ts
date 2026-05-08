// PENDING: F.EvoStep2.DeliverSDKPipeline / Rule_Code_accessibility — waiting for vitest-axe installation in a future increment
// Spec: Rule_Code_accessibility.md — every component must have at least one axe-core accessibility check

// To activate: run `npm install --save-dev axe-core vitest-axe` then move this file to
// src/components/__tests__/SpecOutput.accessibility.test.ts

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { axe, toHaveNoViolations } from 'vitest-axe'
import SpecOutput from '../../src/components/SpecOutput.vue'

expect.extend(toHaveNoViolations)

describe('SpecOutput accessibility', () => {

  // Spec: Accessibility — must meet WCAG 2.1 AA (meter: axe-core violations = 0)
  it('has no accessibility violations in loading state', async () => {
    const wrapper = mount(SpecOutput, {
      props: { loading: true, error: '', markdown: '' },
    })
    const results = await axe(wrapper.element)
    expect(results).toHaveNoViolations()
  })

  // Spec: Accessibility — error state must meet WCAG 2.1 AA
  it('has no accessibility violations in error state', async () => {
    const wrapper = mount(SpecOutput, {
      props: { loading: false, error: 'Translation failed — check your API key.', markdown: '' },
    })
    const results = await axe(wrapper.element)
    expect(results).toHaveNoViolations()
  })

  // Spec: Accessibility — output state with Copy button must meet WCAG 2.1 AA
  it('has no accessibility violations in output state', async () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        markdown: '#### F.Example\nType: Function\nLevel: Product\nDescription: Example function',
      },
    })
    const results = await axe(wrapper.element)
    expect(results).toHaveNoViolations()
  })

})
