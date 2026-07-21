// UNIT_TYPE=Widget
// Tests for SpecOutput.vue — Feature #10 Animation, #11 Tooltips, #20 Domain Badge

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SpecOutput from '../SpecOutput.vue'

// Full stub spec with Engineering keywords for domain detection
const engineeringSpec = {
  functions: [
    {
      id: 'F.Build',
      type: 'Function',
      level: 'Product',
      description: 'Implement and deploy the software pipeline architecture',
      successCriteria: 'build completes under 5 minutes',
      functionOfValue: '',
    },
  ],
  values: [
    {
      id: 'V.Speed',
      type: 'Value',
      level: 'Product',
      description: 'Build pipeline code speed using API system algorithm',
      scale: 'seconds',
      meter: 'CI timer',
      status: '120s',
      tolerable: '60s',
      goal: '30s',
      valueOfFunction: '',
    },
  ],
  solutions: [
    {
      id: 'S.Cache',
      type: 'Solution',
      level: 'Product',
      description: 'Software deploy cache for the architecture',
      impact: 'V.Speed ~50%',
      function: '',
    },
  ],
}

const genericSpec = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Do the thing',
      successCriteria: '',
      functionOfValue: '',
    },
  ],
  values: [],
  solutions: [],
}

describe('SpecOutput Feature #20 — Domain Badge', () => {
  it('renders domain badge when spec has content', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
      },
    })
    const badge = wrapper.find('[aria-label="Detected planning domain"]')
    expect(badge.exists()).toBe(true)
  })

  it('shows Engineering domain for engineering-keyword spec', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
      },
    })
    const badge = wrapper.find('[aria-label="Detected planning domain"]')
    expect(badge.text()).toContain('Engineering')
  })

  it('shows General domain for a no-keyword spec', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: genericSpec,
        markdown: '',
      },
    })
    const badge = wrapper.find('[aria-label="Detected planning domain"]')
    expect(badge.text()).toContain('General')
  })

  it('applies Engineering badge colour classes', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
      },
    })
    const badge = wrapper.find('[aria-label="Detected planning domain"]')
    expect(badge.classes()).toContain('bg-blue-100')
    expect(badge.classes()).toContain('text-blue-800')
  })

  it('does not render badge when spec is null', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: null,
        markdown: '',
      },
    })
    const badge = wrapper.find('[aria-label="Detected planning domain"]')
    expect(badge.exists()).toBe(false)
  })
})

describe('SpecOutput Feature #11 — HoverHint aria wiring', () => {
  it('PlanguageTerm label has aria-describedby attribute', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
      },
    })
    // Find a term label — should have aria-describedby
    const termLabels = wrapper.findAll('[aria-describedby]')
    expect(termLabels.length).toBeGreaterThan(0)
  })

  // PlanguageTerm tooltips are <Teleport to="body"> — wrapper.find() cannot see
  // them. Tests use attachTo: document.body + document.body.querySelector.

  it('HoverHint is shown when a PlanguageTerm is hovered (mouseenter)', async () => {
    const wrapper = mount(SpecOutput, {
      props: { loading: false, error: '', spec: engineeringSpec, markdown: '' },
      attachTo: document.body,
    })
    const termLabel = wrapper.find('[aria-describedby]')
    expect(termLabel.exists()).toBe(true)

    await termLabel.trigger('mouseenter')
    await nextTick()

    // HoverHint is teleported to body — query document directly
    expect(document.body.querySelector('[role="tooltip"]')).toBeTruthy()
    wrapper.unmount()
  })

  it('HoverHint disappears after mouseleave', async () => {
    const wrapper = mount(SpecOutput, {
      props: { loading: false, error: '', spec: engineeringSpec, markdown: '' },
      attachTo: document.body,
    })
    const termLabel = wrapper.find('[aria-describedby]')
    await termLabel.trigger('mouseenter')
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeTruthy()

    await termLabel.trigger('mouseleave')
    await nextTick()
    expect(document.body.querySelector('[role="tooltip"]')).toBeFalsy()
    wrapper.unmount()
  })

  it('HoverHint appears on focus for keyboard accessibility', async () => {
    const wrapper = mount(SpecOutput, {
      props: { loading: false, error: '', spec: engineeringSpec, markdown: '' },
      attachTo: document.body,
    })
    const termLabel = wrapper.find('[aria-describedby]')
    await termLabel.trigger('focus')
    await nextTick()

    expect(document.body.querySelector('[role="tooltip"]')).toBeTruthy()
    wrapper.unmount()
  })
})

describe('SpecOutput Feature #10 — Animation Key', () => {
  it('spec-entry-card elements are rendered in the After view', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
      },
    })
    const cards = wrapper.findAll('.spec-entry-card')
    // engineeringSpec has 1 function + 1 value + 1 solution = 3 cards
    expect(cards.length).toBe(3)
  })

  it('spec-entry-card has animation-delay style set', () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
      },
    })
    const cards = wrapper.findAll('.spec-entry-card')
    // First card: 0ms delay
    expect(cards[0].attributes('style')).toContain('animation-delay: 0ms')
    // Second card: 80ms delay
    expect(cards[1].attributes('style')).toContain('animation-delay: 80ms')
    // Third card: 160ms delay
    expect(cards[2].attributes('style')).toContain('animation-delay: 160ms')
  })

  it('animationKey increments when spec changes from null to a SpecBlock', async () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: null,
        markdown: '',
      },
    })
    // Mount with null spec, then set a real spec
    await wrapper.setProps({ spec: genericSpec })
    await nextTick()

    // Cards should now be rendered (spec is set)
    const cards = wrapper.findAll('.spec-entry-card')
    expect(cards.length).toBe(1)
  })

  it('animationKey increments when spec changes from one SpecBlock to another', async () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: genericSpec,
        markdown: '',
      },
    })

    const initialCards = wrapper.findAll('.spec-entry-card')
    expect(initialCards.length).toBe(1)

    // Change to a different spec
    await wrapper.setProps({ spec: engineeringSpec })
    await nextTick()

    // Cards should now reflect the new spec (3 cards)
    const newCards = wrapper.findAll('.spec-entry-card')
    expect(newCards.length).toBe(3)
  })

  it('spec-entry-cards are NOT rendered in the Before view', async () => {
    const wrapper = mount(SpecOutput, {
      props: {
        loading: false,
        error: '',
        spec: engineeringSpec,
        markdown: '',
        rawInput: { stakes: 'something', ends: 'something', means: 'something' },
      },
    })
    // Click the toggle button to go to Before view
    const toggleBtn = wrapper.find('button[aria-label="Switch to raw input view"]')
    await toggleBtn.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.spec-entry-card')
    expect(cards.length).toBe(0)
  })
})
