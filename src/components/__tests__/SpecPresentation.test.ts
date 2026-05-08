// Tests for SpecPresentation.vue — Feature #71: Spec Presentation Mode

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SpecPresentation from '../SpecPresentation.vue'
import type { SpecBlock } from '../../types/spec'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSpec(): SpecBlock {
  return {
    functions: [
      {
        id: 'F.ProvideInterface',
        type: 'Function',
        level: 'Product',
        description: 'Provide a clean SEM entry interface.',
        successCriteria: 'Users can enter SEM triple in < 30 s.',
        functionOfValue: '[[V.EntryFluency]]',
      },
      {
        id: 'F.GenerateSpec',
        type: 'Function',
        level: 'Product',
        description: 'Generate Planguage spec from SEM triple.',
        successCriteria: 'Spec generated in < 10 s.',
        functionOfValue: '[[V.OutputCompleteness]]',
      },
    ],
    values: [
      {
        id: 'V.EntryFluency',
        type: 'Value',
        level: 'Stakeholder',
        description: 'How quickly users can fill in the SEM form.',
        scale: 'Seconds per completed entry',
        meter: 'Stopwatch from page load to submit',
        status: 'Status [2026-05, baseline] 90s',
        tolerable: 'Tolerable [2026-06] 45s',
        goal: 'Goal [2026-07] 20s',
        valueOfFunction: '[[F.ProvideInterface]]',
      },
    ],
    solutions: [
      {
        id: 'S.AutoFillTemplates',
        type: 'Solution',
        level: 'Solution',
        description: 'Auto-fill stakeholder templates from prior entries.',
        impact: 'V.EntryFluency ~70%',
        function: '[[F.ProvideInterface]]',
      },
    ],
  }
}

// A spec with no entries
const EMPTY_SPEC: SpecBlock = { functions: [], values: [], solutions: [] }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpecPresentation.vue', () => {

  // 1. Does not render when open=false
  test('renders nothing when open=false', () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: false },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  // 2. Does not render when spec is null (open=true but no spec)
  test('renders no-spec message when open=true and spec is null', () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: null, open: true },
    })
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(wrapper.text()).toContain('No spec loaded')
  })

  // 3. Does not render slides when spec has no entries
  test('shows no-spec message when open=true but spec has no entries', () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: EMPTY_SPEC, open: true },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No spec loaded')
  })

  // 4. Renders when open=true with a spec containing entries
  test('renders presentation when open=true with a populated spec', () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    // First slide is F.ProvideInterface
    expect(wrapper.text()).toContain('F.ProvideInterface')
  })

  // 5. Slide counter shows "1 / N" on first slide
  test('shows "1 / 4" slide counter on first slide', () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    // 2 F + 1 V + 1 S = 4 slides total
    expect(wrapper.text()).toContain('1 / 4')
  })

  // 6. next() advances to slide 2 — counter becomes "2 / 4"
  test('next button advances to slide 2', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const nextBtn = wrapper.find('[aria-label="Next slide"]')
    await nextBtn.trigger('click')
    expect(wrapper.text()).toContain('2 / 4')
    expect(wrapper.text()).toContain('F.GenerateSpec')
  })

  // 7. prev() does nothing on slide 0 — counter stays "1 / N"
  test('prev button does nothing on first slide', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const prevBtn = wrapper.find('[aria-label="Previous slide"]')
    await prevBtn.trigger('click')
    expect(wrapper.text()).toContain('1 / 4')
  })

  // 8. prev() goes back from slide 2 to slide 1
  test('prev button goes back from slide 2 to slide 1', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const nextBtn = wrapper.find('[aria-label="Next slide"]')
    const prevBtn = wrapper.find('[aria-label="Previous slide"]')

    await nextBtn.trigger('click') // now at slide 2
    expect(wrapper.text()).toContain('2 / 4')

    await prevBtn.trigger('click') // back to slide 1
    expect(wrapper.text()).toContain('1 / 4')
    expect(wrapper.text()).toContain('F.ProvideInterface')
  })

  // 9. Last slide: next button is disabled
  test('next button is disabled on last slide', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const nextBtn = wrapper.find('[aria-label="Next slide"]')

    // Navigate to last slide (index 3 = slide 4 of 4)
    await nextBtn.trigger('click') // slide 2
    await nextBtn.trigger('click') // slide 3
    await nextBtn.trigger('click') // slide 4 (last)

    expect(nextBtn.attributes('disabled')).toBeDefined()
  })

  // 10. Escape key emits 'close'
  test('Escape key emits close event', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    await wrapper.trigger('keydown', { key: 'Escape' })
    // Also test via the document event listener path
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  // 11. V. entry shows Scale, Meter, Goal, Tolerable rows
  test('V. entry slide shows scale, meter, goal, tolerable', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const nextBtn = wrapper.find('[aria-label="Next slide"]')
    // Navigate past 2 F entries to reach the V entry (slide 3)
    await nextBtn.trigger('click')
    await nextBtn.trigger('click')

    expect(wrapper.text()).toContain('V.EntryFluency')
    expect(wrapper.text()).toContain('Scale')
    expect(wrapper.text()).toContain('Meter')
    expect(wrapper.text()).toContain('Goal')
    expect(wrapper.text()).toContain('Tolerable')
  })

  // 12. Prev button is disabled on first slide
  test('prev button is disabled on first slide', () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const prevBtn = wrapper.find('[aria-label="Previous slide"]')
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  // 13. Close × button emits 'close'
  test('close × button emits close', async () => {
    const wrapper = mount(SpecPresentation, {
      props: { spec: makeSpec(), open: true },
    })
    const closeBtn = wrapper.find('[aria-label="Close presentation"]')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
