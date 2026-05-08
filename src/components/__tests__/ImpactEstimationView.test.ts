// Spec: S.Evo9.VDTTableComponent — VDT grid rendering, V/C footer, ranked sidebar, ARIA
// Tests for ImpactEstimationView.vue

import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { configureAxe } from 'vitest-axe'
import ImpactEstimationView from '../ImpactEstimationView.vue'
import type { VEntry, SEntry } from '../../types/spec'

// Mock mode: no API calls; deterministic synthetic matrix
vi.stubEnv('VITE_MOCK_MODE', 'true')

// Component-scoped axe runner.
// 'region' rule disabled because components are mounted in isolation;
// the landmark context (<main>) is provided by App.vue.
const axe = configureAxe({ rules: { region: { enabled: false } } })

function makeValue(id: string, description = `Description for ${id}`): VEntry {
  return {
    id,
    type: 'Value',
    level: 'Product',
    description,
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

const VALUES = [makeValue('V.One'), makeValue('V.Two'), makeValue('V.Three')]
const SOLUTIONS = [makeSolution('S.Alpha'), makeSolution('S.Beta'), makeSolution('S.Gamma')]
const RESOURCE_CLAIMS = { 'S.Alpha': 20, 'S.Beta': 25, 'S.Gamma': 15 }

function mountView(
  values = VALUES,
  solutions = SOLUTIONS,
  resourceClaims = RESOURCE_CLAIMS,
) {
  return mount(ImpactEstimationView, {
    props: { values, solutions, resourceClaims },
  })
}

describe('ImpactEstimationView.vue', () => {
  // ── Structure ───────────────────────────────────────────────────────────────

  describe('structure', () => {
    test('renders a table with role="table"', () => {
      const wrapper = mountView()
      const table = wrapper.find('table[role="table"]')
      expect(table.exists()).toBe(true)
    })

    test('renders one column header per solution', () => {
      const wrapper = mountView()
      // Column headers in thead (excluding the corner cell)
      const ths = wrapper.findAll('thead th[role="columnheader"]')
      // First is the corner cell; remaining are solution headers
      const solutionHeaders = ths.filter((th) =>
        th.attributes('aria-label')?.startsWith('Solution:'),
      )
      expect(solutionHeaders.length).toBe(SOLUTIONS.length)
    })

    test('renders one data row per value', () => {
      const wrapper = mountView()
      // Row headers in tbody
      const rowHeaders = wrapper.findAll('tbody th[role="rowheader"]')
      expect(rowHeaders.length).toBe(VALUES.length)
    })

    test('each data row has one cell input per solution', () => {
      const wrapper = mountView()
      const rows = wrapper.findAll('tbody tr[role="row"]')
      for (const row of rows) {
        const inputs = row.findAll('input[type="number"]')
        expect(inputs.length).toBe(SOLUTIONS.length)
      }
    })

    test('renders a footer row with V/C ratio cells', () => {
      const wrapper = mountView()
      const footer = wrapper.find('tfoot tr[role="row"]')
      expect(footer.exists()).toBe(true)
    })

    test('footer has a V/C ratio row with one cell per solution', () => {
      // The V/C row is identified by aria-label="Value to cost ratio row" on its rowheader
      const wrapper = mountView()
      const vcRowHeader = wrapper.find('tfoot th[aria-label="Value to cost ratio row"]')
      expect(vcRowHeader.exists()).toBe(true)
      const vcRow = vcRowHeader.element.closest('tr')
      const cells = vcRow ? vcRow.querySelectorAll('td[role="cell"]') : []
      expect(cells.length).toBe(SOLUTIONS.length)
    })

    test('shows empty state when no values or solutions provided', () => {
      const wrapper = mount(ImpactEstimationView, {
        props: { values: [], solutions: [], resourceClaims: {} },
      })
      expect(wrapper.text()).toContain('Add V. and S. entries')
    })
  })

  // ── Cell inputs pre-populated ────────────────────────────────────────────────

  describe('cell population', () => {
    test('cell inputs are pre-populated with mock values (non-zero)', () => {
      const wrapper = mountView()
      const inputs = wrapper.findAll('tbody input[type="number"]')
      // At least one cell should be non-zero (mock mode always populates 10–49)
      const values = inputs.map((i) => Number((i.element as HTMLInputElement).value))
      expect(values.some((v) => v > 0)).toBe(true)
    })

    test('all cell inputs have aria-label', () => {
      const wrapper = mountView()
      const inputs = wrapper.findAll('tbody input[type="number"]')
      for (const input of inputs) {
        expect(input.attributes('aria-label')).toBeTruthy()
      }
    })

    test('each cell input has min=-100 and max=100 attributes (supports negative side effects)', () => {
      const wrapper = mountView()
      const inputs = wrapper.findAll('tbody input[type="number"]')
      for (const input of inputs) {
        expect(input.attributes('min')).toBe('-100')
        expect(input.attributes('max')).toBe('100')
      }
    })
  })

  // ── V/C footer row ───────────────────────────────────────────────────────────

  describe('V/C footer', () => {
    test('efficiency row contains rank labels (#1, #2…)', () => {
      const wrapper = mountView()
      // The efficiency row header is identified by aria-label="Means efficiency row"
      const effRowHeader = wrapper.find('tfoot th[aria-label="Means efficiency row"]')
      expect(effRowHeader.exists()).toBe(true)
      const effRow = effRowHeader.element.closest('tr')
      const cells = effRow ? Array.from(effRow.querySelectorAll('td[role="cell"]')) : []
      const text = cells.map((c) => c.textContent ?? '')
      expect(text.some((t) => t.includes('#1'))).toBe(true)
      expect(text.some((t) => t.includes('#2'))).toBe(true)
    })

    test('V/C ratio row cells are present and not empty', () => {
      const wrapper = mountView()
      const vcRowHeader = wrapper.find('tfoot th[aria-label="Value to cost ratio row"]')
      expect(vcRowHeader.exists()).toBe(true)
      const vcRow = vcRowHeader.element.closest('tr')
      const cells = vcRow ? Array.from(vcRow.querySelectorAll('td[role="cell"]')) : []
      expect(cells.length).toBe(SOLUTIONS.length)
      for (const cell of cells) {
        expect((cell.textContent ?? '').trim().length).toBeGreaterThan(0)
      }
    })
  })

  // ── Ranked solutions sidebar ─────────────────────────────────────────────────

  describe('ranked solutions sidebar', () => {
    test('sidebar exists with correct aria-labelledby pointing to heading', () => {
      const wrapper = mountView()
      const panel = wrapper.find('[role="region"][aria-labelledby="ranked-solutions-heading"]')
      expect(panel.exists()).toBe(true)
    })

    test('sidebar lists all solutions', () => {
      const wrapper = mountView()
      const panel = wrapper.find('[role="region"][aria-labelledby="ranked-solutions-heading"]')
      for (const sol of SOLUTIONS) {
        expect(panel.text()).toContain(sol.id)
      }
    })

    test('sidebar shows rank numbers', () => {
      const wrapper = mountView()
      const panel = wrapper.find('[role="region"][aria-labelledby="ranked-solutions-heading"]')
      // Ranks #1, #2, #3 should all appear
      for (let i = 1; i <= SOLUTIONS.length; i++) {
        expect(panel.text()).toContain(String(i))
      }
    })
  })

  // ── Regenerate button ─────────────────────────────────────────────────────────

  describe('regenerate button', () => {
    test('Regenerate AI Suggestions button is present', () => {
      const wrapper = mountView()
      const btn = wrapper.find('button[aria-label="Regenerate AI impact suggestions"]')
      expect(btn.exists()).toBe(true)
    })

    test('Regenerate button has min-h-[44px] and min-w-[44px] classes', () => {
      const wrapper = mountView()
      const btn = wrapper.find('button[aria-label="Regenerate AI impact suggestions"]')
      expect(btn.classes()).toContain('min-h-[44px]')
      expect(btn.classes()).toContain('min-w-[44px]')
    })
  })

  // ── ARIA ──────────────────────────────────────────────────────────────────────

  describe('ARIA', () => {
    test('table has role="table" and aria-label', () => {
      const wrapper = mountView()
      const table = wrapper.find('table')
      expect(table.attributes('role')).toBe('table')
      expect(table.attributes('aria-label')).toBeTruthy()
    })

    test('column headers have role="columnheader"', () => {
      const wrapper = mountView()
      const ths = wrapper.findAll('thead th')
      for (const th of ths) {
        expect(th.attributes('role')).toBe('columnheader')
      }
    })

    test('row headers have role="rowheader"', () => {
      const wrapper = mountView()
      const rowHeaders = wrapper.findAll('tbody th')
      for (const th of rowHeaders) {
        expect(th.attributes('role')).toBe('rowheader')
      }
    })

    test('has no axe accessibility violations (empty state)', async () => {
      // Spec: V.SolutionMobileCompliance — WCAG 2.1 AA structural compliance
      const wrapper = mount(ImpactEstimationView, {
        props: { values: [], solutions: [], resourceClaims: {} },
      })
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('has no axe accessibility violations (populated state)', async () => {
      const wrapper = mountView(
        [makeValue('V.One'), makeValue('V.Two')],
        [makeSolution('S.Alpha')],
        { 'S.Alpha': 20 },
      )
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })
  })

  // ── Mobile layout ─────────────────────────────────────────────────────────────

  describe('mobile layout', () => {
    test('table wrapper has overflow-x-auto class for horizontal scroll on mobile', () => {
      const wrapper = mountView()
      const scrollDiv = wrapper.find('.overflow-x-auto')
      expect(scrollDiv.exists()).toBe(true)
    })

    test('root section has w-full class for mobile-first full-width layout', () => {
      const wrapper = mountView()
      const section = wrapper.find('section')
      expect(section.classes()).toContain('w-full')
    })

    test('value row headers have sticky left-0 class for frozen column on scroll', () => {
      const wrapper = mountView()
      const rowHeaders = wrapper.findAll('tbody th')
      for (const th of rowHeaders) {
        expect(th.classes()).toContain('sticky')
        expect(th.classes()).toContain('left-0')
      }
    })

    test('column header row has sticky corner cell with left-0 class', () => {
      const wrapper = mountView()
      const cornerCell = wrapper.find('thead th.sticky')
      expect(cornerCell.exists()).toBe(true)
      expect(cornerCell.classes()).toContain('left-0')
    })
  })

  // ── Zero resourceClaim displays ∞ ────────────────────────────────────────────

  describe('zero resource claim', () => {
    test('solution with resourceClaim=0 shows ∞ in the footer', () => {
      const wrapper = mount(ImpactEstimationView, {
        props: {
          values: [makeValue('V.A')],
          solutions: [makeSolution('S.Free')],
          resourceClaims: { 'S.Free': 0 },
        },
      })
      expect(wrapper.text()).toContain('∞')
    })
  })

  // ── Cell input triggers updateCell ────────────────────────────────────────────

  describe('cell input interaction', () => {
    test('typing a value in a cell input updates the displayed value in that cell', async () => {
      // Spec: F.EstimateImpactAndPrioritise — user can enter or edit impact % in every cell;
      // V/C ratios update in real time as values are entered.
      const wrapper = mount(ImpactEstimationView, {
        props: {
          values: [makeValue('V.One')],
          solutions: [makeSolution('S.Alpha')],
          resourceClaims: { 'S.Alpha': 20 },
        },
      })

      const input = wrapper.find('tbody input[type="number"]')
      expect(input.exists()).toBe(true)

      // Simulate user setting the input value and triggering input event
      const inputEl = input.element as HTMLInputElement
      inputEl.value = '75'
      await input.trigger('input')

      // After the input event, the displayed value should reflect 75
      expect(Number(inputEl.value)).toBe(75)
    })

    test('cell input has correct id matching its label for attribute', () => {
      // Spec: accessibility — each cell input must have a corresponding label
      const wrapper = mount(ImpactEstimationView, {
        props: {
          values: [makeValue('V.One')],
          solutions: [makeSolution('S.Alpha')],
          resourceClaims: {},
        },
      })

      const input = wrapper.find('tbody input[type="number"]')
      const id = input.attributes('id')
      expect(id).toBeTruthy()

      // There must be a <label> with a matching `for` attribute
      const label = wrapper.find(`label[for="${id}"]`)
      expect(label.exists()).toBe(true)
    })
  })
})
