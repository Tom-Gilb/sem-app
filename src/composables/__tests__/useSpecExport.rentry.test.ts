// UNIT_TYPE=Test
// useSpecExport — REntry round-trip tests for Phase 1 of Resources beef-up.
// Tom Gilb 2026-06-04 (r77): pin the new Resource entry schema across both
// Markdown and plain-text serialisers, and back-compat for older specs.

import { describe, it, expect } from 'vitest'
import { useSpecExport, serialisePlainText } from '../useSpecExport'
import type { SpecBlock, REntry } from '../../types/spec'

describe('REntry — Phase 1 schema round-trip (r77)', () => {
  const sampleR: REntry = {
    id: 'R.CalendarBudget',
    type: 'Resource',
    level: 'Product',
    description: 'Real elapsed time from project start to delivery.',
    scale: 'days from project start [Sponsor approval]',
    meter: 'Project Gantt closed-out at delivery sign-off',
    status: 'Now: not yet started',
    tolerable: 'Tolerable [Sponsor, Worst-Case] = 180 days',
    goal: 'Goal [Sponsor, Best-Case] = 120 days',
    wish: '90 days if specialist staffing arrives Q1',
    wishStakeholder: 'Sponsor',
    forecast: 'Forecast [Mid-build] = 140 days',
    resourceForValue: 'V.DeliveryTimeline',
    consumedBy: 'S.IroncladSteamBatteryDesign',
    currentStatus: 'available',
  }

  function specWithResource(): SpecBlock {
    return {
      functions:   [],
      values:      [],
      solutions:   [],
      constraints: [],
      resources:   [sampleR],
    }
  }

  it('plain-text export includes a RESOURCES section', () => {
    const out = serialisePlainText(specWithResource())
    expect(out).toContain('RESOURCES')
    expect(out).toContain('R.CalendarBudget')
    expect(out).toContain('days from project start')
    expect(out).toContain('Tolerable [Sponsor, Worst-Case] = 180 days')
    expect(out).toContain('Goal [Sponsor, Best-Case] = 120 days')
  })

  it('plain-text omits RESOURCES heading when resources field is missing', () => {
    const out = serialisePlainText({ functions: [], values: [], solutions: [] })
    expect(out).not.toContain('RESOURCES')
  })

  it('plain-text omits RESOURCES heading when array is empty', () => {
    const out = serialisePlainText({ functions: [], values: [], solutions: [], resources: [] })
    expect(out).not.toContain('RESOURCES')
  })

  it('Markdown export via useSpecExport().serialise() includes R. entry section', () => {
    const { serialise } = useSpecExport()
    const md = serialise(specWithResource())
    expect(md).toContain('#### R.CalendarBudget')
    expect(md).toContain('Type: Resource')
    expect(md).toContain('Scale: days from project start')
    expect(md).toContain('Tolerable: Tolerable [Sponsor, Worst-Case] = 180 days')
    expect(md).toContain('Goal: Goal [Sponsor, Best-Case] = 120 days')
    expect(md).toContain('Wish: 90 days if specialist staffing arrives Q1')
    expect(md).toContain('Forecast: Forecast [Mid-build] = 140 days')
    expect(md).toContain('Resource of Value: V.DeliveryTimeline')
    expect(md).toContain('Consumed by: S.IroncladSteamBatteryDesign')
  })

  it('Markdown export omits optional fields when empty (no orphan headings)', () => {
    const minimalR: REntry = {
      id: 'R.MinimalBudget', type: 'Resource', level: 'Product',
      description: 'minimal', scale: 'units', meter: 'how',
      status: '', tolerable: '', goal: '',
    }
    const { serialise } = useSpecExport()
    const md = serialise({ functions: [], values: [], solutions: [], resources: [minimalR] })
    expect(md).toContain('#### R.MinimalBudget')
    expect(md).not.toContain('Wish:')
    expect(md).not.toContain('Forecast:')
    expect(md).not.toContain('Consumed by:')
    expect(md).not.toContain('Current Status:')
  })

  it('older specs without resources field still serialise without crash (back-compat)', () => {
    const oldSpec: SpecBlock = { functions: [], values: [], solutions: [] }
    expect(() => serialisePlainText(oldSpec)).not.toThrow()
    const { serialise } = useSpecExport()
    expect(() => serialise(oldSpec)).not.toThrow()
  })

  it('plain-text never emits literal "undefined" for missing R-entry fields', () => {
    const minimalR: REntry = {
      id: 'R.Min', type: 'Resource', level: 'Product',
      description: 'x', scale: '', meter: '', status: '', tolerable: '', goal: '',
    }
    const out = serialisePlainText({ functions: [], values: [], solutions: [], resources: [minimalR] })
    expect(out).not.toContain('undefined')
  })
})
