// UNIT_TYPE=Widget
// Tests for EvoPlanView.vue — Feature #36: Evo Step Effort Breakdown Pie

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
  }),
}))

// ── Minimal SpecBlock prop ─────────────────────────────────────────────────────

const SPEC_BLOCK: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeStep(name: string, effortPercent = 25): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues: ['V.Alpha'],
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

const TWO_STEPS: EvoStep[] = [
  makeStep('Step One', 40),
  makeStep('Step Two', 60),
]

function mountView(overrides: {
  plan?: { steps: EvoStep[] } | null
  confirmed?: boolean
  loading?: boolean
  error?: string
} = {}) {
  mockPlan.value = overrides.plan !== undefined ? overrides.plan : { steps: TWO_STEPS }
  mockIsConfirmed.value = overrides.confirmed ?? false
  mockLoading.value = overrides.loading ?? false
  mockError.value = overrides.error ?? ''
  return mount(EvoPlanView, { props: { specBlock: SPEC_BLOCK } })
}

/** Click to the Effort tab */
async function switchToEffort(wrapper: ReturnType<typeof mount>) {
  const tabs = wrapper.findAll('[role="tab"]')
  const effortTab = tabs.find(t => t.text() === 'Effort')!
  await effortTab.trigger('click')
  return effortTab
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPlan.value = null
  mockIsConfirmed.value = false
  mockLoading.value = false
  mockError.value = ''
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EvoPlanView — Effort Breakdown tab (Feature #36)', () => {

  describe('tab bar', () => {
    test('Effort tab has min-h-[44px] touch target', () => {
      const wrapper = mountView()
      const tab = wrapper.findAll('[role="tab"]').find(t => t.text() === 'Effort')!
      expect(tab.exists()).toBe(true)
      expect(tab.classes()).toContain('min-h-[44px]')
    })

    test('clicking Effort tab makes it active (bg-blue-600)', async () => {
      const wrapper = mountView()
      const effortTab = await switchToEffort(wrapper)
      expect(effortTab.classes()).toContain('bg-blue-600')
    })
  })

  describe('placeholder', () => {
    test('shows placeholder when plan not confirmed', async () => {
      const wrapper = mountView({ confirmed: false })
      await switchToEffort(wrapper)
      const placeholder = wrapper.find('[data-testid="effort-placeholder"]')
      expect(placeholder.exists()).toBe(true)
    })

    test('shows placeholder when plan is confirmed but has no steps', async () => {
      const wrapper = mountView({ plan: { steps: [] }, confirmed: true })
      await switchToEffort(wrapper)
      const placeholder = wrapper.find('[data-testid="effort-placeholder"]')
      expect(placeholder.exists()).toBe(true)
    })

    test('does NOT show effort grid when placeholder is shown', async () => {
      const wrapper = mountView({ confirmed: false })
      await switchToEffort(wrapper)
      const grid = wrapper.find('[data-testid="effort-grid"]')
      expect(grid.exists()).toBe(false)
    })
  })

  describe('confirmed plan with steps', () => {
    async function mountConfirmed() {
      const wrapper = mountView({ plan: { steps: TWO_STEPS }, confirmed: true })
      await switchToEffort(wrapper)
      return wrapper
    }

    test('Effort section exists when plan confirmed', async () => {
      const wrapper = await mountConfirmed()
      const section = wrapper.find('[data-testid="effort-section"]')
      expect(section.exists()).toBe(true)
    })

    test('effort grid renders one card per step', async () => {
      const wrapper = await mountConfirmed()
      const cards = wrapper.findAll('[data-testid^="effort-card-"]')
      expect(cards).toHaveLength(TWO_STEPS.length)
    })

    test('each card contains a doughnut SVG', async () => {
      const wrapper = await mountConfirmed()
      const doughnuts = wrapper.findAll('[data-testid^="effort-doughnut-"]')
      expect(doughnuts).toHaveLength(TWO_STEPS.length)
    })

    test('each doughnut has 3 slice path elements (F./V./S.)', async () => {
      const wrapper = await mountConfirmed()
      // First doughnut slices: data-testid="effort-slice-0-0", "effort-slice-0-1", "effort-slice-0-2"
      const slices0 = wrapper.findAll('[data-testid^="effort-slice-0-"]')
      expect(slices0).toHaveLength(3)
    })

    test('effort legend is rendered', async () => {
      const wrapper = await mountConfirmed()
      const legend = wrapper.find('[data-testid="effort-legend"]')
      expect(legend.exists()).toBe(true)
    })

    test('effort legend contains F. Work, V. Work, S. Work labels', async () => {
      const wrapper = await mountConfirmed()
      const legend = wrapper.find('[data-testid="effort-legend"]')
      expect(legend.text()).toContain('F. Work')
      expect(legend.text()).toContain('V. Work')
      expect(legend.text()).toContain('S. Work')
    })
  })
})
