// UNIT_TYPE=Widget
// Feature #38 — Component-level integration test for the ♿ Check button in SpecOutput.vue
// After the dropdown-menu-bar redesign (Feature UI Redesign), the button lives inside
// the "Review" dropdown.  Tests open that menu first before interacting with the button.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SpecOutput from '../SpecOutput.vue'
import type { SpecBlock } from '../../types/spec'

const SPEC: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'The system sends notifications.',
      successCriteria: 'All notifications delivered within 2 seconds.',
      functionOfValue: 'V.Delivery',
    },
  ],
  values: [
    {
      id: 'V.Delivery',
      type: 'Value',
      level: 'Product',
      description: 'Notification delivery speed.',
      scale: 'Time from event to delivery in seconds (0–10s)',
      meter: 'Automated log sampling.',
      status: '5s',
      tolerable: '3s',
      goal: '1s',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Notifier',
      type: 'Solution',
      level: 'Product',
      description: 'Push notification service dispatches alerts immediately.',
      impact: 'V.Delivery ~1s',
      function: 'F.Test',
    },
  ],
}

function mountWithSpec() {
  return mount(SpecOutput, {
    props: {
      loading: false,
      error: '',
      spec: SPEC,
      markdown: '',
    },
  })
}

/** Opens the Analyse dropdown menu in the menu bar (Feature #38 lives in Analyse). */
async function openAnalyseMenu(wrapper: ReturnType<typeof mountWithSpec>) {
  const triggers = wrapper.findAll('button[aria-haspopup="true"]')
  const analyseTrigger = triggers.find(b => b.text().includes('Analyse'))
  expect(analyseTrigger?.exists()).toBe(true)
  await analyseTrigger!.trigger('click')
  await nextTick()
}

/** Finds the Accessibility Check button inside the open Review dropdown. */
function findA11yButton(wrapper: ReturnType<typeof mountWithSpec>) {
  // The dropdown item renders the palette label: "Accessibility Check"
  return wrapper.findAll('button').find(b => b.text().includes('Accessibility Check'))
}

describe('SpecOutput — ♿ Check button (Feature #38)', () => {
  it('accessibility check entry appears in the Analyse dropdown when a spec is present', async () => {
    const wrapper = mountWithSpec()
    await openAnalyseMenu(wrapper)
    const btn = findA11yButton(wrapper)
    expect(btn).toBeDefined()
    expect(btn!.exists()).toBe(true)
  })

  it('accessibility check button renders the ♿ emoji in its label', async () => {
    const wrapper = mountWithSpec()
    await openAnalyseMenu(wrapper)
    const btn = findA11yButton(wrapper)
    expect(btn!.text()).toContain('♿')
  })

  it('clicking the accessibility check button opens the accessibility issues panel', async () => {
    const wrapper = mountWithSpec()
    await openAnalyseMenu(wrapper)
    const btn = findA11yButton(wrapper)
    await btn!.trigger('click')
    await nextTick()
    // Panel has aria-label="Spec accessibility check results"
    const panel = wrapper.find('[aria-label="Spec accessibility check results"]')
    expect(panel.exists()).toBe(true)
  })

  it('accessibility issues panel shows issue count after clicking Check', async () => {
    const wrapper = mountWithSpec()
    await openAnalyseMenu(wrapper)
    const btn = findA11yButton(wrapper)
    await btn!.trigger('click')
    await nextTick()
    const panel = wrapper.find('[aria-label="Spec accessibility check results"]')
    // Panel text should contain "issue" (singular or plural)
    expect(panel.text()).toMatch(/issue/)
  })

  it('Review dropdown entry is absent when spec prop is null', () => {
    const wrapper = mount(SpecOutput, {
      props: { loading: false, error: '', spec: null, markdown: '' },
    })
    // The whole dropdown bar is inside <template v-if="spec"> — no menu triggers at all
    const triggers = wrapper.findAll('button[aria-haspopup="true"]')
    expect(triggers.length).toBe(0)
  })
})
