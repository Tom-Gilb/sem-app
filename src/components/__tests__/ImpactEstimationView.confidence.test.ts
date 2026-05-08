// Feature #24 — Confidence-Weighted Impact Heatmap Toggle
// Tests for the view mode toggle and confidence overlay in ImpactEstimationView.vue

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

describe('ImpactEstimationView — Confidence Heatmap Toggle (#24)', () => {
  // ── Toggle renders ─────────────────────────────────────────────────────────

  describe('toggle UI', () => {
    test('renders an "Impact" toggle button', () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-impact"]')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toBe('Impact')
    })

    test('renders a "Confidence" toggle button', () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-confidence"]')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toBe('Confidence')
    })

    test('both toggle buttons meet 44px min-height requirement', () => {
      const wrapper = mountView()
      const impact = wrapper.find('[data-testid="toggle-impact"]')
      const confidence = wrapper.find('[data-testid="toggle-confidence"]')
      expect(impact.classes()).toContain('min-h-[44px]')
      expect(confidence.classes()).toContain('min-h-[44px]')
    })

    test('toggle group has aria-label "Select view mode"', () => {
      const wrapper = mountView()
      const group = wrapper.find('[role="group"][aria-label="Select view mode"]')
      expect(group.exists()).toBe(true)
    })
  })

  // ── Default state ─────────────────────────────────────────────────────────

  describe('default view mode', () => {
    test('default view mode is "impact" — Impact button has active class', () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-impact"]')
      expect(btn.classes()).toContain('bg-indigo-600')
      expect(btn.classes()).toContain('text-white')
    })

    test('default view mode is "impact" — Confidence button is inactive', () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-confidence"]')
      expect(btn.classes()).toContain('bg-gray-100')
      expect(btn.classes()).not.toContain('bg-indigo-600')
    })

    test('Impact button has aria-pressed="true" by default', () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-impact"]')
      expect(btn.attributes('aria-pressed')).toBe('true')
    })

    test('Confidence button has aria-pressed="false" by default', () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-confidence"]')
      expect(btn.attributes('aria-pressed')).toBe('false')
    })
  })

  // ── Clicking Confidence sets viewMode ────────────────────────────────────

  describe('switching to confidence mode', () => {
    test('clicking Confidence button activates it (gets bg-indigo-600)', async () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-confidence"]')
      await btn.trigger('click')
      expect(btn.classes()).toContain('bg-indigo-600')
      expect(btn.classes()).toContain('text-white')
    })

    test('clicking Confidence button deactivates Impact button', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const impactBtn = wrapper.find('[data-testid="toggle-impact"]')
      expect(impactBtn.classes()).toContain('bg-gray-100')
      expect(impactBtn.classes()).not.toContain('bg-indigo-600')
    })

    test('clicking Confidence sets aria-pressed="true" on Confidence button', async () => {
      const wrapper = mountView()
      const btn = wrapper.find('[data-testid="toggle-confidence"]')
      await btn.trigger('click')
      expect(btn.attributes('aria-pressed')).toBe('true')
    })

    test('clicking back to Impact re-activates Impact button', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      await wrapper.find('[data-testid="toggle-impact"]').trigger('click')
      const impactBtn = wrapper.find('[data-testid="toggle-impact"]')
      expect(impactBtn.classes()).toContain('bg-indigo-600')
    })
  })

  // ── Legend visible only in confidence mode ────────────────────────────────

  describe('confidence legend', () => {
    test('legend is NOT rendered in impact mode (default)', () => {
      const wrapper = mountView()
      const legend = wrapper.find('[data-testid="confidence-legend"]')
      expect(legend.exists()).toBe(false)
    })

    test('legend IS rendered after switching to confidence mode', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const legend = wrapper.find('[data-testid="confidence-legend"]')
      expect(legend.exists()).toBe(true)
    })

    test('legend contains "High" text in confidence mode', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const legend = wrapper.find('[data-testid="confidence-legend"]')
      expect(legend.text()).toContain('High')
    })

    test('legend contains "Medium" text in confidence mode', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const legend = wrapper.find('[data-testid="confidence-legend"]')
      expect(legend.text()).toContain('Medium')
    })

    test('legend contains "Low" text in confidence mode', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const legend = wrapper.find('[data-testid="confidence-legend"]')
      expect(legend.text()).toContain('Low')
    })

    test('legend is hidden again when switching back to impact mode', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      await wrapper.find('[data-testid="toggle-impact"]').trigger('click')
      const legend = wrapper.find('[data-testid="confidence-legend"]')
      expect(legend.exists()).toBe(false)
    })
  })

  // ── Confidence overlay on cells ────────────────────────────────────────────

  describe('confidence overlay styles on data cells', () => {
    test('in impact mode, data cells have no data-confidence attribute', () => {
      const wrapper = mountView()
      const cells = wrapper.findAll('tbody td[role="cell"]')
      for (const cell of cells) {
        expect(cell.attributes('data-confidence')).toBeUndefined()
      }
    })

    test('in confidence mode, data cells have data-confidence attribute', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const cells = wrapper.findAll('tbody td[role="cell"]')
      expect(cells.length).toBeGreaterThan(0)
      for (const cell of cells) {
        const conf = cell.attributes('data-confidence')
        expect(['high', 'medium', 'low']).toContain(conf)
      }
    })

    test('high-confidence cells have no stripe overlay in confidence mode', async () => {
      // Mount with a high V/C scenario: resource claims 0 makes V/C "unconstrained"
      // — test that high-confidence cells do NOT have the stripe background-image
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const highCells = wrapper.findAll('tbody td[data-confidence="high"]')
      for (const cell of highCells) {
        const style = cell.attributes('style') ?? ''
        expect(style).not.toContain('repeating-linear-gradient')
      }
    })

    test('low-confidence cells have stripe overlay applied in confidence mode', async () => {
      // This test verifies that when a cell IS low confidence, its style includes the heavy stripe.
      // We use a resourceClaims value that will produce low V/C (very high claim relative to impact).
      // With RESOURCE_CLAIMS of 20 and 25, and typical mock impacts in 30-99 range,
      // V/C may vary. We validate the attribute + stripe logic are wired correctly.
      const wrapper = mountView(
        [makeValue('V.One'), makeValue('V.Two'), makeValue('V.Three')],
        [makeSolution('S.LowVC')],
        // Huge resource claim ensures V/C < 0.8
        { 'S.LowVC': 999999 },
      )
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')

      const cells = wrapper.findAll('tbody td[role="cell"]')
      expect(cells.length).toBeGreaterThan(0)

      // All cells for this solution must be low confidence (V/C ≈ 0)
      for (const cell of cells) {
        expect(cell.attributes('data-confidence')).toBe('low')
        const style = cell.attributes('style') ?? ''
        expect(style).toContain('repeating-linear-gradient')
        expect(style).toContain('rgba(0,0,0,0.18)')
      }
    })

    test('medium-confidence cells have light stripe overlay in confidence mode', async () => {
      // resource claim that puts V/C in 0.8–1.49 range: sum of mock impacts for 2 values
      // is roughly 30-99*2 = 60-198; with claim ~100 we land in medium range
      const wrapper = mountView(
        [makeValue('V.One'), makeValue('V.Two')],
        [makeSolution('S.MidVC')],
        { 'S.MidVC': 100 },
      )
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')

      const cells = wrapper.findAll('tbody td[role="cell"]')
      expect(cells.length).toBeGreaterThan(0)

      // Find any medium cell and verify stripe style
      const mediumCells = wrapper.findAll('tbody td[data-confidence="medium"]')
      for (const cell of mediumCells) {
        const style = cell.attributes('style') ?? ''
        expect(style).toContain('repeating-linear-gradient')
        expect(style).toContain('rgba(0,0,0,0.08)')
      }
    })
  })

  // ── Existing impact mode unaffected ──────────────────────────────────────

  describe('impact mode unchanged', () => {
    test('in impact mode, data cells still have the impact cellStyle applied', () => {
      const wrapper = mountView()
      const cells = wrapper.findAll('tbody td[role="cell"]')
      expect(cells.length).toBeGreaterThan(0)
      for (const cell of cells) {
        const style = cell.attributes('style') ?? ''
        // The cellStyle always sets border-left
        expect(style).toContain('border-left')
      }
    })

    test('in confidence mode, existing impact styles are still present (additive)', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="toggle-confidence"]').trigger('click')
      const cells = wrapper.findAll('tbody td[role="cell"]')
      for (const cell of cells) {
        const style = cell.attributes('style') ?? ''
        // Impact style always includes border-left
        expect(style).toContain('border-left')
      }
    })
  })
})
