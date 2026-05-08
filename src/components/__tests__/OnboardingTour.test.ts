// Tests for OnboardingTour.vue — Feature #77: Animated Onboarding Tour

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OnboardingTour from '../OnboardingTour.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mountTour() {
  return mount(OnboardingTour)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OnboardingTour.vue', () => {

  // 1. Renders when mounted
  test('renders when mounted', () => {
    const wrapper = mountTour()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  // 2. Shows step 1 on mount (currentStep = 0)
  test('shows step 1 on mount', () => {
    const wrapper = mountTour()
    // Step 1 icon and region
    expect(wrapper.text()).toContain('SEM Entry Form')
    expect(wrapper.text()).toContain('Start with your goal')
  })

  // 3. Step counter shows "Step 1 of 6"
  test('step counter shows "Step 1 of 6"', () => {
    const wrapper = mountTour()
    expect(wrapper.text()).toContain('Step 1 of 6')
  })

  // 4. "Next →" button advances to step 2
  test('Next button advances to step 2', async () => {
    const wrapper = mountTour()
    const nextBtn = wrapper.find('button[class*="emerald"]')
    await nextBtn.trigger('click')
    expect(wrapper.text()).toContain('Step 2 of 6')
    expect(wrapper.text()).toContain('Spec Panel')
  })

  // 5. Prev button is not shown on step 1
  test('prev button is not shown on step 1', () => {
    const wrapper = mountTour()
    // The Back button only appears when currentStep > 0
    const buttons = wrapper.findAll('button')
    const backBtn = buttons.find(b => b.text().includes('Back'))
    expect(backBtn).toBeUndefined()
  })

  // 6. Prev button shown on step 2
  test('prev button is shown on step 2', async () => {
    const wrapper = mountTour()
    const nextBtn = wrapper.find('button[class*="emerald"]')
    await nextBtn.trigger('click')
    const buttons = wrapper.findAll('button')
    const backBtn = buttons.find(b => b.text().includes('Back'))
    expect(backBtn).toBeDefined()
  })

  // 7. On last step (step 6), button shows "Finish ✓"
  test('on last step the action button shows "Finish ✓"', async () => {
    const wrapper = mountTour()
    const nextBtn = wrapper.find('button[class*="emerald"]')
    // Advance through steps 1 → 6 (5 clicks)
    for (let i = 0; i < 5; i++) {
      await nextBtn.trigger('click')
    }
    expect(wrapper.text()).toContain('Step 6 of 6')
    expect(nextBtn.text()).toBe('Finish ✓')
  })

  // 8. Clicking Finish emits 'close'
  test('clicking Finish emits close', async () => {
    const wrapper = mountTour()
    const nextBtn = wrapper.find('button[class*="emerald"]')
    for (let i = 0; i < 5; i++) {
      await nextBtn.trigger('click')
    }
    await nextBtn.trigger('click') // click Finish
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  // 9. Clicking × emits 'close'
  test('clicking × close button emits close', async () => {
    const wrapper = mountTour()
    const closeBtn = wrapper.find('[aria-label="Close tour"]')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  // 10. Progress bar width increases between steps
  test('progress bar width increases as steps advance', async () => {
    const wrapper = mountTour()
    const getWidth = () => {
      const bar = wrapper.find('[role="progressbar"]')
      return parseFloat(bar.element.style.width)
    }

    const widthStep1 = getWidth()
    const nextBtn = wrapper.find('button[class*="emerald"]')
    await nextBtn.trigger('click')
    const widthStep2 = getWidth()

    expect(widthStep2).toBeGreaterThan(widthStep1)
  })

  // 11. Clicking Skip emits 'close'
  test('clicking Skip emits close', async () => {
    const wrapper = mountTour()
    const buttons = wrapper.findAll('button')
    const skipBtn = buttons.find(b => b.text() === 'Skip')
    expect(skipBtn).toBeDefined()
    await skipBtn!.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  // 12. Back button decrements step — going from step 2 to step 1
  test('back button returns to previous step', async () => {
    const wrapper = mountTour()
    const nextBtn = wrapper.find('button[class*="emerald"]')
    await nextBtn.trigger('click')
    expect(wrapper.text()).toContain('Step 2 of 6')

    const buttons = wrapper.findAll('button')
    const backBtn = buttons.find(b => b.text().includes('Back'))!
    await backBtn.trigger('click')
    expect(wrapper.text()).toContain('Step 1 of 6')
  })

})
