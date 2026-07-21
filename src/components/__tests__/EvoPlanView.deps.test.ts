// UNIT_TYPE=Widget
// Tests for EvoPlanView.vue — Feature #21: Evo Step Dependency Visualiser

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

/** Two steps that share 'V.Alpha' — dependency should be inferred */
const STEPS_SHARED: EvoStep[] = [
  makeStep('Step One', 20, ['V.Alpha', 'V.Beta']),
  makeStep('Step Two', 30, ['V.Alpha', 'V.Gamma']),
]

/** Three steps with NO shared values — should fall back to linear chain */
const STEPS_NO_SHARED: EvoStep[] = [
  makeStep('Step A', 20, ['V.Alpha']),
  makeStep('Step B', 20, ['V.Beta']),
  makeStep('Step C', 20, ['V.Gamma']),
]

/** Four steps, all sharing a value — infers edges for each step to its first predecessor */
const STEPS_FOUR_SHARED: EvoStep[] = [
  makeStep('Step 1', 25, ['V.Alpha', 'V.Beta']),
  makeStep('Step 2', 25, ['V.Alpha']),
  makeStep('Step 3', 25, ['V.Beta']),
  makeStep('Step 4', 25, ['V.Alpha', 'V.Beta']),
]

// Mount helper
function mountView(overrides: {
  plan?: { steps: EvoStep[] } | null
  confirmed?: boolean
  loading?: boolean
  error?: string
} = {}) {
  mockPlan.value = overrides.plan !== undefined ? overrides.plan : { steps: STEPS_SHARED }
  mockIsConfirmed.value = overrides.confirmed ?? false
  mockLoading.value = overrides.loading ?? false
  mockError.value = overrides.error ?? ''
  return mount(EvoPlanView, { props: { specBlock: SPEC_BLOCK } })
}

/** Click to the Dependencies tab */
async function switchToDeps(wrapper: ReturnType<typeof mount>) {
  const tabs = wrapper.findAll('[role="tab"]')
  const depTab = tabs.find(t => t.text() === 'Dependencies')!
  await depTab.trigger('click')
  return depTab
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPlan.value = null
  mockIsConfirmed.value = false
  mockLoading.value = false
  mockError.value = ''
})

// ── Tests ─────────────────────────────────────────────────────────────────────

// SKIPPED 2026-06-09: Dependencies tab panel is v-if="false"; tab bar removed.
// Rewrite needed when the panel is re-exposed via activeTab routing.
describe.skip('EvoPlanView — Dependencies tab (Feature #21)', () => {

  // ── Tab presence ─────────────────────────────────────────────────────────────

  describe('tab bar', () => {
    test('renders nine tabs including Dependencies', () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      expect(tabs.length).toBe(9)
      const labels = tabs.map(t => t.text())
      expect(labels).toContain('Dependencies')
    })

    test('Dependencies tab has min-h-[44px] touch target', () => {
      const wrapper = mountView()
      const tab = wrapper.findAll('[role="tab"]').find(t => t.text() === 'Dependencies')!
      expect(tab.classes()).toContain('min-h-[44px]')
    })

    test('clicking Dependencies tab makes it active', async () => {
      const wrapper = mountView()
      const depTab = await switchToDeps(wrapper)
      expect(depTab.classes()).toContain('bg-blue-600')
    })
  })

  // ── Dependencies tab renders with confirmed plan ≥2 steps ────────────────────

  describe('confirmed plan with ≥2 steps', () => {
    test('Dependencies tab renders section when plan confirmed + ≥2 steps', async () => {
      const wrapper = mountView({ confirmed: true })
      await switchToDeps(wrapper)
      const section = wrapper.find('[data-testid="dependencies-section"]')
      expect(section.exists()).toBe(true)
    })

    test('SVG is rendered when plan confirmed with ≥2 steps', async () => {
      const wrapper = mountView({ confirmed: true })
      await switchToDeps(wrapper)
      const svg = wrapper.find('[data-testid="dependencies-svg"]')
      expect(svg.exists()).toBe(true)
    })

    test('SVG renders correct number of <rect> nodes — one per step', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const rects = wrapper.findAll('[data-testid="dependencies-svg"] rect')
      expect(rects.length).toBe(STEPS_SHARED.length)
    })

    test('SVG renders correct number of <rect> nodes for 4 steps', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_FOUR_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const rects = wrapper.findAll('[data-testid="dependencies-svg"] rect')
      expect(rects.length).toBe(STEPS_FOUR_SHARED.length)
    })
  })

  // ── Placeholder when plan not confirmed ───────────────────────────────────────

  describe('placeholder', () => {
    test('shows placeholder when plan not confirmed', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: false })
      await switchToDeps(wrapper)
      const placeholder = wrapper.find('[data-testid="dependencies-placeholder"]')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('Confirm the Evo plan to see the dependency graph')
    })

    test('shows placeholder when plan is confirmed but has no steps', async () => {
      const wrapper = mountView({ plan: { steps: [] }, confirmed: true })
      await switchToDeps(wrapper)
      const placeholder = wrapper.find('[data-testid="dependencies-placeholder"]')
      expect(placeholder.exists()).toBe(true)
    })

    test('does NOT show SVG when placeholder is shown', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: false })
      await switchToDeps(wrapper)
      const svg = wrapper.find('[data-testid="dependencies-svg"]')
      expect(svg.exists()).toBe(false)
    })
  })

  // ── Fallback: single step ─────────────────────────────────────────────────────

  describe('single-step fallback', () => {
    test('shows fallback when only 1 step exists', async () => {
      const wrapper = mountView({ plan: { steps: [makeStep('Solo', 100, ['V.X'])] }, confirmed: true })
      await switchToDeps(wrapper)
      const fallback = wrapper.find('[data-testid="dependencies-fallback"]')
      expect(fallback.exists()).toBe(true)
      expect(fallback.text()).toContain('Add more Evo steps to see dependencies')
    })

    test('does NOT show SVG for single step', async () => {
      const wrapper = mountView({ plan: { steps: [makeStep('Solo', 100, ['V.X'])] }, confirmed: true })
      await switchToDeps(wrapper)
      const svg = wrapper.find('[data-testid="dependencies-svg"]')
      expect(svg.exists()).toBe(false)
    })
  })

  // ── Arrows when shared values exist ──────────────────────────────────────────

  describe('dependency arrows', () => {
    test('arrow <path> elements are rendered when shared values exist', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      // STEPS_SHARED has steps that share V.Alpha — expect 1 arrow
      const arrows = wrapper.findAll('[data-testid^="dep-arrow-"]')
      expect(arrows.length).toBeGreaterThan(0)
    })

    test('arrows have marker-end attribute for arrowhead', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const arrows = wrapper.findAll('[data-testid^="dep-arrow-"]')
      for (const arrow of arrows) {
        expect(arrow.attributes('marker-end')).toBeTruthy()
      }
    })
  })

  // ── Linear chain fallback ─────────────────────────────────────────────────────

  describe('linear chain fallback', () => {
    test('arrows equal steps.length - 1 when no shared values exist', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_NO_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const arrows = wrapper.findAll('[data-testid^="dep-arrow-"]')
      expect(arrows.length).toBe(STEPS_NO_SHARED.length - 1)
    })
  })

  // ── SVG viewBox ───────────────────────────────────────────────────────────────

  describe('SVG viewBox', () => {
    test('viewBox is "0 0 700 160" for ≤6 steps', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const svg = wrapper.find('[data-testid="dependencies-svg"]')
      expect(svg.attributes('viewBox')).toBe('0 0 700 160')
    })

    test('viewBox is "0 0 700 280" for >6 steps', async () => {
      const manySteps: EvoStep[] = Array.from({ length: 7 }, (_, i) =>
        makeStep(`Step ${i + 1}`, 14, [`V.X${i}`]),
      )
      const wrapper = mountView({ plan: { steps: manySteps }, confirmed: true })
      await switchToDeps(wrapper)
      const svg = wrapper.find('[data-testid="dependencies-svg"]')
      expect(svg.attributes('viewBox')).toBe('0 0 700 280')
    })
  })

  // ── What If slider on Dependencies tab ───────────────────────────────────────

  describe('What If slider on Dependencies tab', () => {
    test('What If slider is shown on Dependencies tab when plan confirmed', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const slider = wrapper.find('[data-testid="dep-whatif-slider"]')
      expect(slider.exists()).toBe(true)
    })

    test('What If summary banner exists on Dependencies tab', async () => {
      const wrapper = mountView({ plan: { steps: STEPS_SHARED }, confirmed: true })
      await switchToDeps(wrapper)
      const summary = wrapper.find('[data-testid="dep-whatif-summary"]')
      expect(summary.exists()).toBe(true)
      expect(summary.text()).toContain('hrs/week')
    })
  })
})
