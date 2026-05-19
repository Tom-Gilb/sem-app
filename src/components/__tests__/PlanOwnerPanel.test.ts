// UNIT_TYPE=Test
/**
 * PlanOwnerPanel.test.ts — pins down the 2026-05-12 bug Tom reported:
 * "There is a bug, it keeps losing things put in and puts Planner data in owner".
 *
 * Cause was: the watcher on activeTab fired AFTER the tab had mutated, so
 * the auto-save dispatcher misfiled in-progress Planner data into the
 * Owners collection. Fix: saveFormToTab(oldTab) — explicitly pass the
 * pre-switch tab into the dispatcher.
 *
 * These tests guard the regression by simulating the exact sequence:
 *   1. Open the panel on the Planners tab
 *   2. Type a name + responsibility
 *   3. Click the Owners tab
 *   4. Assert the data ended up under planners[], NOT owners[]
 *
 * Also covers the renamed header ("Plan Responsibilities") and the new
 * tab-named primary save button ("Save Owner" / "Save Planner" / "Save Scribe").
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PlanOwnerPanel from '../PlanOwnerPanel.vue'
import {
  initPlanModel,
  clearPlanModel,
  deletePlanModel,
  getAllPlanModels,
  usePlanModel,
} from '../../composables/usePlanModel'
import type { SpecBlock } from '../../types/spec'

function makeSpec(): SpecBlock {
  return {
    functions: [{
      id: 'F.Test', type: 'Function', level: 'Product',
      description: 'Test function', successCriteria: 'OK', functionOfValue: 'V.Test',
    }],
    values: [{
      id: 'V.Test', type: 'Value', level: 'Product',
      description: 'Test value', scale: 'Units', meter: 'Observation',
      status: 'pre-build', tolerable: '50%', goal: '80%', valueOfFunction: 'F.Test',
    }],
    solutions: [{
      id: 'S.Test', type: 'Solution', level: 'Product',
      description: 'Test solution', impact: 'V.Test ~80%', function: 'F.Test',
    }],
  }
}

function resetState(): void {
  const all = [...getAllPlanModels()]
  for (const m of all) deletePlanModel(m.id)
  clearPlanModel()
  localStorage.clear()
}

describe('PlanOwnerPanel.vue — auto-save tab-switch bug fix (2026-05-12)', () => {
  beforeEach(resetState)

  function mountWithFreshModel(initialTab: 'owners' | 'planners' | 'scribes' = 'planners') {
    const model = initPlanModel(makeSpec(), 'Test Plan')
    // Stub <Teleport> so the panel renders inside the wrapper rather than
    // jumping to document.body — makes wrapper.find() / .text() work.
    const wrapper = mount(PlanOwnerPanel, {
      props: { planModel: model, initialTab },
      global: {
        stubs: { Teleport: { template: '<div><slot /></div>' } },
      },
    })
    return { wrapper, model }
  }

  // Helper — robustly find inputs by their label text
  function findInputByLabel(wrapper: ReturnType<typeof mount>, labelText: string) {
    const labels = wrapper.findAll('label')
    const lbl = labels.find((l) => l.text().includes(labelText))
    if (!lbl) return null
    // The input is the next sibling of the label inside the same wrapper div
    const div = lbl.element.parentElement!
    const input = div.querySelector('input') as HTMLInputElement | null
    return input
  }

  it('renders the renamed header "Plan Responsibilities"', () => {
    const { wrapper } = mountWithFreshModel()
    expect(wrapper.text()).toContain('Plan Responsibilities')
    expect(wrapper.text()).not.toContain('Plan People')
  })

  it('shows the tab-named primary save button ("Add Planner")', async () => {
    const { wrapper } = mountWithFreshModel('planners')
    const addBtn = wrapper.findAll('button').find((b) => b.text().startsWith('+ Add'))
    expect(addBtn, 'Add button not found').toBeTruthy()
    await addBtn!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toMatch(/Add Planner/)
  })

  it('routes in-progress Planner data into planners[] when the user switches to Owners mid-edit', async () => {
    const { wrapper } = mountWithFreshModel('planners')

    const addBtn = wrapper.findAll('button').find((b) => b.text().startsWith('+ Add'))
    await addBtn!.trigger('click')
    await nextTick()

    // Type a name into the Planner form using the underlying DOM input
    const nameInput = findInputByLabel(wrapper, 'Name')
    expect(nameInput, 'Name input not found').toBeTruthy()
    nameInput!.value = 'Alice Planner'
    nameInput!.dispatchEvent(new Event('input'))
    await nextTick()

    // Click the OWNERS tab — this used to misfile the Planner into Owners
    const ownersTab = wrapper.findAll('button').find((b) =>
      /Owner/.test(b.text()) && !b.text().startsWith('+'),
    )
    expect(ownersTab, 'Owners tab not found').toBeTruthy()
    await ownersTab!.trigger('click')
    await nextTick()

    // The active model singleton should now have Alice in planners, NOT owners
    const { currentModel } = usePlanModel()
    const m = currentModel.value
    expect(m).toBeTruthy()
    const planners = m!.planners.map((p) => p.name)
    const owners = m!.owners.map((p) => p.name)
    expect(planners, 'Alice should be filed as a Planner').toContain('Alice Planner')
    expect(owners, 'Alice should NOT have leaked into Owners').not.toContain('Alice Planner')
  })

  it('routes in-progress Owner data into owners[] when the user switches to Planners mid-edit', async () => {
    const { wrapper } = mountWithFreshModel('owners')

    const addBtn = wrapper.findAll('button').find((b) => b.text().startsWith('+ Add'))
    await addBtn!.trigger('click')
    await nextTick()

    const nameInput = findInputByLabel(wrapper, 'Name')
    nameInput!.value = 'Bob Owner'
    nameInput!.dispatchEvent(new Event('input'))
    await nextTick()

    const plannersTab = wrapper.findAll('button').find((b) =>
      /Planner/.test(b.text()) && !b.text().startsWith('+'),
    )
    await plannersTab!.trigger('click')
    await nextTick()

    const { currentModel } = usePlanModel()
    const m = currentModel.value
    expect(m).toBeTruthy()
    expect(m!.owners.map((p) => p.name)).toContain('Bob Owner')
    expect(m!.planners.map((p) => p.name)).not.toContain('Bob Owner')
  })

  it('explicit Save button persists to the active tab', async () => {
    const { wrapper } = mountWithFreshModel('owners')

    const addBtn = wrapper.findAll('button').find((b) => b.text().startsWith('+ Add'))
    await addBtn!.trigger('click')
    await nextTick()

    const nameInput = findInputByLabel(wrapper, 'Name')
    nameInput!.value = 'Carol Owner'
    nameInput!.dispatchEvent(new Event('input'))
    await nextTick()

    // Click the prominent Save button (text = "Add Owner" since we're adding)
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Add Owner') && !b.text().startsWith('+'))
    expect(saveBtn, 'Save button not found').toBeTruthy()
    await saveBtn!.trigger('click')
    await nextTick()

    const { currentModel } = usePlanModel()
    expect(currentModel.value!.owners.map((p) => p.name)).toContain('Carol Owner')
  })
})
