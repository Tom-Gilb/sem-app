// UNIT_TYPE=Test
// Feature #39 — IET Actuals Column
// Tests for actuals logging mode in ImpactEstimationView.vue

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImpactEstimationView from '../ImpactEstimationView.vue'
import type { VEntry, SEntry } from '../../types/spec'

// Mock mode: no API calls; deterministic synthetic matrix
vi.stubEnv('VITE_MOCK_MODE', 'true')

function makeValue(id: string): VEntry {
  return {
    id,
    type: 'Value',
    level: 'Product',
    description: `Description for ${id}`,
    scale: 'Percentage',
    meter: 'Survey',
    status: 'pre-build',
    tolerable: '50%',
    goal: '80%',
    valueOfFunction: 'F.Test',
  }
}

function makeSolution(id: string): SEntry {
  return {
    id,
    type: 'Solution',
    level: 'Product',
    description: `Description for ${id}`,
    impact: 'V.Test ~50%',
    function: 'F.Test',
  }
}

const VALUES = [makeValue('V.One'), makeValue('V.Two')]
const SOLUTIONS = [makeSolution('S.Alpha'), makeSolution('S.Beta')]
const RESOURCE_CLAIMS = { 'S.Alpha': 20, 'S.Beta': 25 }

function mountView(
  values = VALUES,
  solutions = SOLUTIONS,
  resourceClaims = RESOURCE_CLAIMS,
) {
  return mount(ImpactEstimationView, {
    props: { values, solutions, resourceClaims },
  })
}

describe('ImpactEstimationView — Actuals Column (#39)', () => {

  test('Log Actuals button renders with correct aria-label', () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="toggle-actuals"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBe('Toggle actuals logging mode')
  })

  test('Log Actuals button has h-11 class', () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="toggle-actuals"]')
    expect(btn.classes()).toContain('h-11')
  })

  test('clicking Log Actuals toggles actualsMode (shows number inputs)', async () => {
    const wrapper = mountView()

    // Initially no actuals inputs
    const inputsBefore = wrapper.findAll('input[type="number"][aria-label^="Actual impact %"]')
    expect(inputsBefore.length).toBe(0)

    // Click to enable
    const btn = wrapper.find('[data-testid="toggle-actuals"]')
    await btn.trigger('click')
    await nextTick()

    const inputsAfter = wrapper.findAll('input[type="number"][aria-label^="Actual impact %"]')
    expect(inputsAfter.length).toBe(SOLUTIONS.length)
  })

  test('clicking Log Actuals again toggles it off (hides inputs)', async () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="toggle-actuals"]')

    await btn.trigger('click')
    await nextTick()
    expect(wrapper.findAll('input[type="number"][aria-label^="Actual impact %"]').length).toBe(SOLUTIONS.length)

    await btn.trigger('click')
    await nextTick()
    expect(wrapper.findAll('input[type="number"][aria-label^="Actual impact %"]').length).toBe(0)
  })

  test('in actualsMode, number inputs render below each column header with correct aria-labels', async () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="toggle-actuals"]')
    await btn.trigger('click')
    await nextTick()

    for (const sol of SOLUTIONS) {
      const input = wrapper.find(`input[aria-label="Actual impact % for ${sol.id}"]`)
      expect(input.exists()).toBe(true)
      expect(input.attributes('type')).toBe('number')
    }
  })

  test('changing actuals input value updates the actuals record and exposes via getSnapshot', async () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="toggle-actuals"]')
    await btn.trigger('click')
    await nextTick()

    const input = wrapper.find('input[aria-label="Actual impact % for S.Alpha"]')
    await input.setValue('75')
    await input.trigger('input')
    await nextTick()

    // getSnapshot should include the actuals
    const vm = wrapper.vm as InstanceType<typeof ImpactEstimationView>
    const snapshot = (vm as unknown as { getSnapshot: () => Record<string, unknown> }).getSnapshot()
    const actuals = snapshot.actuals as Record<string, number>
    expect(actuals['S.Alpha']).toBe(75)
  })

})
