// Spec: S.Evo8.TaskDecompositionComponent — task checklist UI per Evo step
// Tests for TaskList.vue

import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { configureAxe } from 'vitest-axe'
import TaskList from '../TaskList.vue'
import type { EvoStep } from '../../types/evo-plan'

// Component-scoped axe runner.
// 'region' rule disabled because components are mounted in isolation;
// the landmark context (<main>) is provided by App.vue.
const axe = configureAxe({ rules: { region: { enabled: false } } })

/** Minimal EvoStep fixture */
function makeStep(name: string, description = ''): EvoStep {
  return {
    name,
    description,
    linkedValues: ['V.Test'],
    linkedSolution: 'S.Test',
    effortPercent: 10,
  }
}

const STEPS: EvoStep[] = [
  makeStep('S.Evo8.StepOne', 'Implement the handler. Create the schema.'),
  makeStep('S.Evo8.StepTwo', 'Build the component. Add unit tests.'),
]

describe('TaskList.vue', () => {

  describe('structure', () => {
    test('renders one collapsible section per step', () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      const details = wrapper.findAll('details')
      expect(details.length).toBe(2)
    })

    test('renders step name as heading inside summary', () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      const summaries = wrapper.findAll('summary')
      expect(summaries[0].text()).toContain('S.Evo8.StepOne')
      expect(summaries[1].text()).toContain('S.Evo8.StepTwo')
    })

    test('shows empty state message when no steps are provided', () => {
      const wrapper = mount(TaskList, { props: { steps: [] } })
      expect(wrapper.text()).toContain('No Evo steps available')
    })
  })

  describe('task pre-population', () => {
    test('pre-populates tasks from useTaskSuggestions when section is first expanded', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')

      // Manually open the details element and trigger the toggle event
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      // After toggle, task rows should appear
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      // Step description has 2 imperative sentences → 2 tasks
      expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    })

    test('does not re-run suggestion logic on subsequent toggles', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement

      // First open
      detailsEl.open = true
      await details.trigger('toggle')
      const countAfterFirst = wrapper.findAll('input[type="checkbox"]').length

      // Close then reopen
      detailsEl.open = false
      await details.trigger('toggle')
      detailsEl.open = true
      await details.trigger('toggle')

      const countAfterSecond = wrapper.findAll('input[type="checkbox"]').length
      // Count should be the same — suggestions not re-generated
      expect(countAfterSecond).toBe(countAfterFirst)
    })
  })

  describe('add task', () => {
    test('Add Task button is present for each step', () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      // There should be one Add Task button per step (visible in the DOM even when closed)
      const addButtons = wrapper.findAll('button').filter(b =>
        b.text().includes('Add Task')
      )
      expect(addButtons.length).toBe(2)
    })

    test('clicking Add Task adds a new blank task row', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const beforeCount = wrapper.findAll('input[type="checkbox"]').length

      const addButton = wrapper.findAll('button').find(b => b.text().includes('Add Task'))
      await addButton!.trigger('click')

      const afterCount = wrapper.findAll('input[type="checkbox"]').length
      expect(afterCount).toBe(beforeCount + 1)
    })
  })

  describe('remove task', () => {
    test('clicking Remove button removes the task row', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const beforeCount = wrapper.findAll('input[type="checkbox"]').length
      expect(beforeCount).toBeGreaterThan(0)

      // Click the first remove button
      const removeButtons = wrapper.findAll('button').filter(b =>
        b.attributes('aria-label')?.includes('Remove task')
      )
      await removeButtons[0].trigger('click')

      const afterCount = wrapper.findAll('input[type="checkbox"]').length
      expect(afterCount).toBe(beforeCount - 1)
    })
  })

  describe('completed toggle', () => {
    test('toggling checkbox marks the task completed', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const firstCheckbox = wrapper.find('input[type="checkbox"]')
      expect((firstCheckbox.element as HTMLInputElement).checked).toBe(false)
      await firstCheckbox.trigger('change')
      expect((firstCheckbox.element as HTMLInputElement).checked).toBe(true)
    })
  })

  describe('mobile compliance', () => {
    test('Add Task button has min-h-[44px] class for 44px touch target', () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const addButtons = wrapper.findAll('button').filter(b =>
        b.text().includes('Add Task')
      )
      expect(addButtons[0].classes()).toContain('min-h-[44px]')
    })

    test('Remove Task button has min-h-[44px] and min-w-[44px] classes', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const removeButtons = wrapper.findAll('button').filter(b =>
        b.attributes('aria-label')?.includes('Remove task')
      )
      expect(removeButtons[0].classes()).toContain('min-w-[44px]')
      expect(removeButtons[0].classes()).toContain('min-h-[44px]')
    })

    test('summary element has min-h-[44px] class for 44px touch target', () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const summary = wrapper.find('summary')
      expect(summary.classes()).toContain('min-h-[44px]')
    })
  })

  describe('accessibility', () => {
    test('has no axe accessibility violations (empty state)', async () => {
      // Spec: V.SolutionMobileCompliance — WCAG 2.1 AA structural compliance
      const wrapper = mount(TaskList, { props: { steps: [] } })
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('has no axe accessibility violations (with steps)', async () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('all Remove Task buttons have aria-label', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const removeButtons = wrapper.findAll('button').filter(b =>
        b.attributes('aria-label')?.includes('Remove task')
      )
      for (const btn of removeButtons) {
        expect(btn.attributes('aria-label')).toBeTruthy()
      }
    })

    test('summary elements use native details/summary for collapse toggle', () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      // details/summary elements are present — accessibility handled natively
      expect(wrapper.findAll('details').length).toBe(2)
      expect(wrapper.findAll('summary').length).toBe(2)
    })
  })

  describe('inline description editing', () => {
    // Spec: S.Evo8.TaskDecompositionComponent — description (editable inline on click)

    test('clicking the description button shows an input field for editing', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      // Initially no text input for description should be visible
      const descInputsBefore = wrapper.findAll('input[type="text"]').filter(i =>
        i.attributes('aria-label')?.includes('Edit description')
      )
      expect(descInputsBefore.length).toBe(0)

      // Click the description button for the first task
      const descButton = wrapper.findAll('button').find(b =>
        b.attributes('aria-label')?.includes('Edit description for task')
      )
      expect(descButton).toBeDefined()
      await descButton!.trigger('click')

      // After click, a text input for description should appear
      const descInputsAfter = wrapper.findAll('input[type="text"]').filter(i =>
        i.attributes('aria-label')?.includes('Edit description')
      )
      expect(descInputsAfter.length).toBe(1)
    })

    test('description edit input has correct aria-label', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const descButton = wrapper.findAll('button').find(b =>
        b.attributes('aria-label')?.includes('Edit description for task')
      )
      await descButton!.trigger('click')

      const editInput = wrapper.find('input[aria-label*="Edit description for task"]')
      expect(editInput.exists()).toBe(true)
    })
  })

  describe('effort hours input', () => {
    // Spec: S.Evo8.TaskDecompositionComponent — effort hours field (optional number input)

    test('each task row contains an effort hours number input', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const effortInputs = wrapper.findAll('input[type="number"]')
      expect(effortInputs.length).toBeGreaterThanOrEqual(2)
    })

    test('effort hours inputs have correct aria-labels', async () => {
      const wrapper = mount(TaskList, { props: { steps: [STEPS[0]] } })
      const details = wrapper.find('details')
      const detailsEl = details.element as HTMLDetailsElement
      detailsEl.open = true
      await details.trigger('toggle')

      const effortInputs = wrapper.findAll('input[type="number"]')
      for (const input of effortInputs) {
        expect(input.attributes('aria-label')).toContain('Effort hours for task')
      }
    })
  })

  describe('mobile layout', () => {
    // Spec: V.SolutionMobileCompliance — full-width at 375px, no fixed widths

    test('root section element has w-full class for mobile-first full-width layout', () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      const section = wrapper.find('section')
      expect(section.classes()).toContain('w-full')
    })

    test('no fixed pixel widths on the root section (no w-[Npx] style classes)', () => {
      const wrapper = mount(TaskList, { props: { steps: STEPS } })
      const section = wrapper.find('section')
      // None of the section classes should be a fixed pixel width pattern like w-[375px]
      const hasFixedWidth = section.classes().some(cls => /^w-\[\d+px\]$/.test(cls))
      expect(hasFixedWidth).toBe(false)
    })
  })
})
