// UNIT_TYPE=Widget
// Tests for EvoPlanView.vue — Feature #27: Evo Step Risk Radar integration

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import EvoPlanView from '../EvoPlanView.vue'
import type { EvoStep } from '../../types/evo-plan'
import type { SpecBlock } from '../../types/spec'

// ── Mock useEvoPlan composable ────────────────────────────────────────────────

const mockPlan = ref<{ steps: EvoStep[] } | null>(null)
const mockIsConfirmed = ref(false)
const mockLoading = ref(false)
const mockError = ref('')

const mockFetchPlan = vi.fn()
const mockReorderSteps = vi.fn()
const mockRenameStep = vi.fn()
const mockRemoveStep = vi.fn()
const mockConfirmPlan = vi.fn()

vi.mock('../../composables/useEvoPlan', () => ({
  useEvoPlan: () => ({
    plan: readonly(mockPlan),
    isConfirmed: readonly(mockIsConfirmed),
    loading: readonly(mockLoading),
    error: readonly(mockError),
    fetchPlan: mockFetchPlan,
    reorderSteps: mockReorderSteps,
    renameStep: mockRenameStep,
    removeStep: mockRemoveStep,
    confirmPlan: mockConfirmPlan,
    cancelFetch: vi.fn(),
    generatedSolutionsKey: readonly(ref<string | null>(null)),
  }),
  solutionsFingerprint: () => '__empty__',
}))

// ── Minimal SpecBlock prop ─────────────────────────────────────────────────────

const SPEC_BLOCK: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeStep(
  name: string,
  effortPercent = 20,
  linkedValues: string[] = [],
): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues,
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

const SAMPLE_STEPS: EvoStep[] = [
  makeStep('Alpha Step', 40, ['V.Alpha', 'V.Beta']),
  makeStep('Beta Step', 30, ['V.Alpha']),
  makeStep('Gamma Step', 30, ['V.Gamma']),
]

// Mount helper — always uses Plan tab (default)
function mountView(overrides: {
  plan?: { steps: EvoStep[] } | null
  confirmed?: boolean
} = {}) {
  mockPlan.value = overrides.plan !== undefined ? overrides.plan : { steps: SAMPLE_STEPS }
  mockIsConfirmed.value = overrides.confirmed ?? false
  mockLoading.value = false
  mockError.value = ''
  return mount(EvoPlanView, { props: { specBlock: SPEC_BLOCK } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPlan.value = null
  mockIsConfirmed.value = false
  mockLoading.value = false
  mockError.value = ''
})

// ── Tests ─────────────────────────────────────────────────────────────────────

// SKIPPED 2026-06-09: Risk Radar panel is v-if="false"; tab bar removed.
// Rewrite needed when the panel is re-exposed via activeTab routing.
describe.skip('EvoPlanView — Risk Radar integration (Feature #27)', () => {

  // ── Mini radar presence ────────────────────────────────────────────────────

  describe('mini radar in step cards', () => {
    test('each step card contains a risk radar button', () => {
      const wrapper = mountView()
      const riskButtons = wrapper.findAll('[data-testid^="risk-btn-"]')
      expect(riskButtons.length).toBe(SAMPLE_STEPS.length)
    })

    test('each risk radar button contains an SVG element', () => {
      const wrapper = mountView()
      const riskButtons = wrapper.findAll('[data-testid^="risk-btn-"]')
      for (const btn of riskButtons) {
        const svg = btn.find('svg')
        expect(svg.exists()).toBe(true)
      }
    })

    test('mini radar SVGs have viewBox="0 0 36 36"', () => {
      const wrapper = mountView()
      const riskButtons = wrapper.findAll('[data-testid^="risk-btn-"]')
      for (const btn of riskButtons) {
        const svg = btn.find('svg')
        expect(svg.attributes('viewBox')).toBe('0 0 36 36')
      }
    })

    test('risk button has correct aria-label', () => {
      const wrapper = mountView()
      const btn0 = wrapper.find('[data-testid="risk-btn-0"]')
      expect(btn0.attributes('aria-label')).toBe(`View risk detail for ${SAMPLE_STEPS[0].name}`)
    })

    test('risk button meets 44×44px touch target (min-w and min-h classes)', () => {
      const wrapper = mountView()
      const btn0 = wrapper.find('[data-testid="risk-btn-0"]')
      expect(btn0.classes()).toContain('min-w-[44px]')
      expect(btn0.classes()).toContain('min-h-[44px]')
    })
  })

  // ── Expand / collapse ───────────────────────────────────────────────────────

  describe('clicking risk button expands the detail panel', () => {
    test('risk detail panel is not visible before click', () => {
      const wrapper = mountView()
      const panel0 = wrapper.find('[data-testid="risk-panel-0"]')
      expect(panel0.exists()).toBe(false)
    })

    test('clicking risk button shows the expanded detail panel', async () => {
      const wrapper = mountView()
      const btn0 = wrapper.find('[data-testid="risk-btn-0"]')
      await btn0.trigger('click')
      const panel0 = wrapper.find('[data-testid="risk-panel-0"]')
      expect(panel0.exists()).toBe(true)
    })

    test('expanded panel contains an SVG with viewBox="0 0 180 180"', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-0"]').trigger('click')
      const panel = wrapper.find('[data-testid="risk-panel-0"]')
      const svg = panel.find('svg')
      expect(svg.exists()).toBe(true)
      expect(svg.attributes('viewBox')).toBe('0 0 180 180')
    })

    test('expanded panel contains the explanation text', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-0"]').trigger('click')
      const panel = wrapper.find('[data-testid="risk-panel-0"]')
      expect(panel.text()).toContain('Risk score based on effort %')
    })

    test('only one panel is shown at a time (clicking second closes first)', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-0"]').trigger('click')
      expect(wrapper.find('[data-testid="risk-panel-0"]').exists()).toBe(true)
      await wrapper.find('[data-testid="risk-btn-1"]').trigger('click')
      // First panel should now be gone, second should be visible
      expect(wrapper.find('[data-testid="risk-panel-0"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="risk-panel-1"]').exists()).toBe(true)
    })

    test('clicking same button again collapses the panel (toggle)', async () => {
      const wrapper = mountView()
      const btn0 = wrapper.find('[data-testid="risk-btn-0"]')
      await btn0.trigger('click')
      expect(wrapper.find('[data-testid="risk-panel-0"]').exists()).toBe(true)
      await btn0.trigger('click')
      expect(wrapper.find('[data-testid="risk-panel-0"]').exists()).toBe(false)
    })
  })

  // ── Close button ────────────────────────────────────────────────────────────

  describe('close button collapses the panel', () => {
    test('close button exists inside expanded panel', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-0"]').trigger('click')
      const closeBtn = wrapper.find('[data-testid="risk-close-0"]')
      expect(closeBtn.exists()).toBe(true)
    })

    test('clicking close button hides the panel', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-0"]').trigger('click')
      expect(wrapper.find('[data-testid="risk-panel-0"]').exists()).toBe(true)
      await wrapper.find('[data-testid="risk-close-0"]').trigger('click')
      expect(wrapper.find('[data-testid="risk-panel-0"]').exists()).toBe(false)
    })

    test('close button meets 44px touch target', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-0"]').trigger('click')
      const closeBtn = wrapper.find('[data-testid="risk-close-0"]')
      expect(closeBtn.classes()).toContain('min-h-[44px]')
    })
  })

  // ── Works for different step indices ────────────────────────────────────────

  describe('risk panels for different step indices', () => {
    test('risk panel for step index 2 shows correct aria-label on close', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="risk-btn-2"]').trigger('click')
      const panel = wrapper.find('[data-testid="risk-panel-2"]')
      expect(panel.exists()).toBe(true)
      const closeBtn = wrapper.find('[data-testid="risk-close-2"]')
      expect(closeBtn.exists()).toBe(true)
    })
  })
})
