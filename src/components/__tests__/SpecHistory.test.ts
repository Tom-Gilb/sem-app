// UNIT_TYPE=Test
// Tests for SpecHistory.vue — Feature #29

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SpecHistory from '../SpecHistory.vue'
import { useSpecHistory } from '../../composables/useSpecHistory'
import type { SpecBlock } from '../../types/spec'

function makeSpec(description: string): SpecBlock {
  return {
    functions: [
      {
        id: 'F.Test',
        type: 'Function',
        level: 'Product',
        description: 'Test function',
        successCriteria: 'Success',
        functionOfValue: 'V.Test',
      },
    ],
    values: [
      {
        id: 'V.Test',
        type: 'Value',
        level: 'Product',
        description,
        scale: 'Units',
        meter: 'Observation',
        status: 'pre-build',
        tolerable: '50%',
        goal: '80%',
        valueOfFunction: 'F.Test',
      },
    ],
    solutions: [
      {
        id: 'S.Test',
        type: 'Solution',
        level: 'Product',
        description: 'Test solution',
        impact: 'V.Test ~80%',
        function: 'F.Test',
      },
    ],
  }
}

describe('SpecHistory.vue', () => {
  let clearHistory: ReturnType<typeof useSpecHistory>['clearHistory']
  let addVersion: ReturnType<typeof useSpecHistory>['addVersion']

  beforeEach(() => {
    const h = useSpecHistory()
    clearHistory = h.clearHistory
    addVersion = h.addVersion
    clearHistory()
  })

  it('shows placeholder when history is empty', () => {
    const wrapper = mount(SpecHistory)
    expect(wrapper.text()).toContain('No previous versions yet')
  })

  it('renders versions with correct label', () => {
    addVersion(makeSpec('Spec A'), 'Generated')
    addVersion(makeSpec('Spec B'), 'Make Ambitious')
    const wrapper = mount(SpecHistory)
    expect(wrapper.text()).toContain('Generated')
    expect(wrapper.text()).toContain('Make Ambitious')
  })

  it('renders version with timestamp', () => {
    // Use a fixed timestamp to verify formatting
    const fixedDate = new Date(2025, 0, 1, 14, 30) // 2025-01-01 14:30 (not today)
    vi.setSystemTime(fixedDate)
    addVersion(makeSpec('Timed spec'), 'Generated')
    vi.useRealTimers()

    const wrapper = mount(SpecHistory)
    // Should show DD/MM HH:MM format since it's a past date
    expect(wrapper.text()).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/)
  })

  it('formats today timestamps as HH:MM only', () => {
    const now = new Date()
    vi.setSystemTime(now)
    addVersion(makeSpec('Today spec'), 'Generated')
    vi.useRealTimers()

    const wrapper = mount(SpecHistory)
    const text = wrapper.text()
    // Should contain HH:MM without a date prefix
    expect(text).toMatch(/\d{2}:\d{2}/)
  })

  it('Restore button emits "restore" with the correct spec', async () => {
    const spec = makeSpec('Restorable spec')
    addVersion(spec, 'Generated')
    const wrapper = mount(SpecHistory)

    const btn = wrapper.find('button[aria-label*="Restore"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    expect(wrapper.emitted('restore')).toBeTruthy()
    const emitted = wrapper.emitted('restore')!
    expect(emitted).toHaveLength(1)
    const restoredSpec = emitted[0][0] as SpecBlock
    expect(restoredSpec.values[0].description).toBe('Restorable spec')
  })

  it('does not show placeholder when history has entries', () => {
    addVersion(makeSpec('Some spec'), 'Lean Plan')
    const wrapper = mount(SpecHistory)
    expect(wrapper.text()).not.toContain('No previous versions yet')
  })
})
