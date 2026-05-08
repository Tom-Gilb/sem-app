// UNIT_TYPE=Widget
// Tests for EvoPlanView.vue — tab bar, Timeline, Coverage, What If slider
// Covers Features #2, #3, #5

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

function makeStep(
  name: string,
  effortPercent = 20,
  linkedValues: string[] = ['V.Alpha', 'V.Beta'],
): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues,
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

const STEPS_THREE: EvoStep[] = [
  makeStep('Step One', 20, ['V.Alpha', 'V.Beta', 'V.Gamma']),
  makeStep('Step Two', 30, ['V.Alpha', 'V.Delta']),
  makeStep('Step Three', 25, ['V.Beta', 'V.Gamma', 'V.Delta']),
]

// Mount helper
function mountView(overrides: {
  plan?: { steps: EvoStep[] } | null
  confirmed?: boolean
  loading?: boolean
  error?: string
} = {}) {
  mockPlan.value = overrides.plan !== undefined ? overrides.plan : { steps: STEPS_THREE }
  mockIsConfirmed.value = overrides.confirmed ?? false
  mockLoading.value = overrides.loading ?? false
  mockError.value = overrides.error ?? ''
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

describe('EvoPlanView tabs', () => {

  // ── Tab bar structure ────────────────────────────────────────────────────────

  describe('tab bar', () => {
    test('renders nine tabs: Plan, Timeline, Coverage, Dependencies, Gantt, Effort, Skills, Bubble, Knowledge Graph', () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      expect(tabs.length).toBe(9)
      const labels = tabs.map(t => t.text())
      expect(labels).toContain('Plan')
      expect(labels).toContain('Timeline')
      expect(labels).toContain('Coverage')
      expect(labels).toContain('Dependencies')
      expect(labels).toContain('Gantt')
      expect(labels).toContain('Effort')
      expect(labels).toContain('Skills')
      expect(labels).toContain('🫧 Bubble')
      expect(labels).toContain('🕸️ Knowledge Graph')
    })

    test('Plan tab is active by default (has bg-blue-600 class)', () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      const planTab = tabs.find(t => t.text() === 'Plan')
      expect(planTab).toBeDefined()
      expect(planTab!.classes()).toContain('bg-blue-600')
    })

    test('inactive tabs have bg-gray-100 class', () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      const timelineTab = tabs.find(t => t.text() === 'Timeline')
      const coverageTab = tabs.find(t => t.text() === 'Coverage')
      expect(timelineTab!.classes()).toContain('bg-gray-100')
      expect(coverageTab!.classes()).toContain('bg-gray-100')
    })

    test('each tab button has min-h-[44px] for touch compliance', () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      for (const tab of tabs) {
        expect(tab.classes()).toContain('min-h-[44px]')
      }
    })

    test('clicking Timeline tab makes it active', async () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      const timelineTab = tabs.find(t => t.text() === 'Timeline')!
      await timelineTab.trigger('click')
      expect(timelineTab.classes()).toContain('bg-blue-600')
    })

    test('clicking Coverage tab makes it active', async () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      const coverageTab = tabs.find(t => t.text() === 'Coverage')!
      await coverageTab.trigger('click')
      expect(coverageTab.classes()).toContain('bg-blue-600')
    })
  })

  // ── Timeline tab ─────────────────────────────────────────────────────────────

  describe('Timeline tab', () => {
    test('clicking Timeline tab shows timeline section', async () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      const timelineTab = tabs.find(t => t.text() === 'Timeline')!
      await timelineTab.trigger('click')
      const section = wrapper.find('[data-testid="timeline-section"]')
      expect(section.exists()).toBe(true)
    })

    test('shows placeholder when plan not confirmed', async () => {
      const wrapper = mountView({ confirmed: false })
      const tabs = wrapper.findAll('[role="tab"]')
      const timelineTab = tabs.find(t => t.text() === 'Timeline')!
      await timelineTab.trigger('click')
      const placeholder = wrapper.find('[data-testid="timeline-placeholder"]')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('Confirm the Evo plan to see the timeline diagram')
    })

    test('shows placeholder when no steps exist', async () => {
      const wrapper = mountView({ plan: { steps: [] }, confirmed: true })
      const tabs = wrapper.findAll('[role="tab"]')
      const timelineTab = tabs.find(t => t.text() === 'Timeline')!
      await timelineTab.trigger('click')
      const placeholder = wrapper.find('[data-testid="timeline-placeholder"]')
      expect(placeholder.exists()).toBe(true)
    })

    test('shows SVG chart when plan confirmed with steps', async () => {
      const wrapper = mountView({ confirmed: true })
      const tabs = wrapper.findAll('[role="tab"]')
      const timelineTab = tabs.find(t => t.text() === 'Timeline')!
      await timelineTab.trigger('click')
      const svg = wrapper.find('[data-testid="timeline-section"] svg')
      expect(svg.exists()).toBe(true)
    })

    test('SVG chart has correct viewBox', async () => {
      const wrapper = mountView({ confirmed: true })
      const tabs = wrapper.findAll('[role="tab"]')
      await tabs.find(t => t.text() === 'Timeline')!.trigger('click')
      const svg = wrapper.find('[data-testid="timeline-section"] svg')
      expect(svg.attributes('viewBox')).toBe('0 0 620 280')
    })

    test('Timeline SVG contains emerald polyline (value curve)', async () => {
      const wrapper = mountView({ confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Timeline')!.trigger('click')
      const polylines = wrapper.findAll('[data-testid="timeline-section"] polyline')
      const emerald = polylines.find(p => p.attributes('stroke') === '#10b981')
      expect(emerald).toBeDefined()
    })

    test('Timeline SVG contains amber polyline (cost curve)', async () => {
      const wrapper = mountView({ confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Timeline')!.trigger('click')
      const polylines = wrapper.findAll('[data-testid="timeline-section"] polyline')
      const amber = polylines.find(p => p.attributes('stroke') === '#f59e0b')
      expect(amber).toBeDefined()
    })
  })

  // ── Coverage tab ──────────────────────────────────────────────────────────────

  describe('Coverage tab', () => {
    test('clicking Coverage tab shows coverage section', async () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      const coverageTab = tabs.find(t => t.text() === 'Coverage')!
      await coverageTab.trigger('click')
      const section = wrapper.find('[data-testid="coverage-section"]')
      expect(section.exists()).toBe(true)
    })

    test('shows placeholder when plan not confirmed', async () => {
      const wrapper = mountView({ confirmed: false })
      const tabs = wrapper.findAll('[role="tab"]')
      await tabs.find(t => t.text() === 'Coverage')!.trigger('click')
      const placeholder = wrapper.find('[data-testid="coverage-placeholder"]')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('Confirm the Evo plan to see stakeholder coverage')
    })

    test('shows placeholder when no steps', async () => {
      const wrapper = mountView({ plan: { steps: [] }, confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Coverage')!.trigger('click')
      const placeholder = wrapper.find('[data-testid="coverage-placeholder"]')
      expect(placeholder.exists()).toBe(true)
    })

    test('shows radial fallback when fewer than 3 unique values', async () => {
      const stepsWithFewValues: EvoStep[] = [
        makeStep('S1', 20, ['V.Alpha']),
        makeStep('S2', 20, ['V.Beta']),
      ]
      const wrapper = mountView({ plan: { steps: stepsWithFewValues }, confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Coverage')!.trigger('click')
      const fallback = wrapper.find('[data-testid="coverage-fallback"]')
      expect(fallback.exists()).toBe(true)
      expect(fallback.text()).toContain('Not enough linked values to draw radial chart (need ≥3)')
    })

    test('shows SVG radial chart when confirmed with ≥3 unique values', async () => {
      const wrapper = mountView({ confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Coverage')!.trigger('click')
      const svg = wrapper.find('[data-testid="coverage-section"] svg')
      expect(svg.exists()).toBe(true)
    })

    test('Coverage SVG has viewBox="0 0 440 440"', async () => {
      const wrapper = mountView({ confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Coverage')!.trigger('click')
      const svg = wrapper.find('[data-testid="coverage-section"] svg')
      expect(svg.attributes('viewBox')).toBe('0 0 440 440')
    })

    test('Coverage chart legend shows step names', async () => {
      const wrapper = mountView({ confirmed: true })
      await wrapper.findAll('[role="tab"]').find(t => t.text() === 'Coverage')!.trigger('click')
      const section = wrapper.find('[data-testid="coverage-section"]')
      expect(section.text()).toContain('Step One')
      expect(section.text()).toContain('Step Two')
      expect(section.text()).toContain('Step Three')
    })
  })

  // ── What If slider (Feature #5) ───────────────────────────────────────────────

  describe('What If slider', () => {
    test('slider is NOT shown when plan is not confirmed', () => {
      const wrapper = mountView({ confirmed: false })
      const sliderSection = wrapper.find('[data-testid="whatif-slider"]')
      expect(sliderSection.exists()).toBe(false)
    })

    test('slider is NOT shown when there are no steps', () => {
      const wrapper = mountView({ plan: { steps: [] }, confirmed: true })
      const sliderSection = wrapper.find('[data-testid="whatif-slider"]')
      expect(sliderSection.exists()).toBe(false)
    })

    test('slider IS shown when plan is confirmed and has steps', () => {
      const wrapper = mountView({ confirmed: true })
      const sliderSection = wrapper.find('[data-testid="whatif-slider"]')
      expect(sliderSection.exists()).toBe(true)
    })

    test('slider default value is 10', () => {
      const wrapper = mountView({ confirmed: true })
      const slider = wrapper.find('input[type="range"]')
      expect((slider.element as HTMLInputElement).value).toBe('10')
    })

    test('slider has min=1 max=40 step=1', () => {
      const wrapper = mountView({ confirmed: true })
      const slider = wrapper.find('input[type="range"]')
      expect(slider.attributes('min')).toBe('1')
      expect(slider.attributes('max')).toBe('40')
      expect(slider.attributes('step')).toBe('1')
    })

    test('summary banner contains default hours/week value', () => {
      const wrapper = mountView({ confirmed: true })
      const summary = wrapper.find('[data-testid="whatif-summary"]')
      expect(summary.exists()).toBe(true)
      expect(summary.text()).toContain('At 10 hrs/week')
    })

    test('changing slider value updates summary text', async () => {
      const wrapper = mountView({ confirmed: true })
      const slider = wrapper.find('input[type="range"]')
      const el = slider.element as HTMLInputElement
      el.value = '20'
      await slider.trigger('input')
      const summary = wrapper.find('[data-testid="whatif-summary"]')
      expect(summary.text()).toContain('At 20 hrs/week')
    })

    test('summary banner contains "all steps complete by" text', () => {
      const wrapper = mountView({ confirmed: true })
      const summary = wrapper.find('[data-testid="whatif-summary"]')
      expect(summary.text()).toContain('all steps complete by')
    })

    test('slider shows one row per step', () => {
      const wrapper = mountView({ confirmed: true })
      // Step names appear in the "ends ..." rows list
      expect(wrapper.text()).toContain('Step One')
      expect(wrapper.text()).toContain('Step Two')
      expect(wrapper.text()).toContain('Step Three')
    })
  })
})
