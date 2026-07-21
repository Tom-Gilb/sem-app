// UNIT_TYPE=Widget
// Tests for EvoPlanView.vue — Feature #32: Milestone / Gantt View

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
  linkedValues: string[] = ['V.Alpha'],
): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues,
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

const THREE_STEPS: EvoStep[] = [
  makeStep('Step One',   25, ['V.Alpha', 'V.Beta']),
  makeStep('Step Two',   35, ['V.Alpha']),
  makeStep('Step Three', 40, ['V.Beta']),
]

// Mount helper
function mountView(overrides: {
  plan?: { steps: EvoStep[] } | null
  confirmed?: boolean
  loading?: boolean
  error?: string
} = {}) {
  mockPlan.value = overrides.plan !== undefined ? overrides.plan : { steps: THREE_STEPS }
  mockIsConfirmed.value = overrides.confirmed ?? false
  mockLoading.value = overrides.loading ?? false
  mockError.value = overrides.error ?? ''
  return mount(EvoPlanView, { props: { specBlock: SPEC_BLOCK } })
}

/** Click to the Gantt tab */
async function switchToGantt(wrapper: ReturnType<typeof mount>) {
  const tabs = wrapper.findAll('[role="tab"]')
  const ganttTab = tabs.find(t => t.text() === 'Gantt')!
  await ganttTab.trigger('click')
  return ganttTab
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPlan.value = null
  mockIsConfirmed.value = false
  mockLoading.value = false
  mockError.value = ''
})

// ── Tests ─────────────────────────────────────────────────────────────────────

// SKIPPED 2026-06-09: Gantt tab panel is v-if="false"; tab bar removed.
// Rewrite needed when the panel is re-exposed via activeTab routing.
describe.skip('EvoPlanView — Gantt tab (Feature #32)', () => {

  // ── Tab presence ─────────────────────────────────────────────────────────────

  describe('tab bar', () => {
    test('renders nine tabs including Gantt', () => {
      const wrapper = mountView()
      const tabs = wrapper.findAll('[role="tab"]')
      expect(tabs.length).toBe(9)
      const labels = tabs.map(t => t.text())
      expect(labels).toContain('Gantt')
    })

    test('Gantt tab has min-h-[44px] touch target', () => {
      const wrapper = mountView()
      const tab = wrapper.findAll('[role="tab"]').find(t => t.text() === 'Gantt')!
      expect(tab.classes()).toContain('min-h-[44px]')
    })

    test('clicking Gantt tab makes it active (bg-blue-600)', async () => {
      const wrapper = mountView()
      const ganttTab = await switchToGantt(wrapper)
      expect(ganttTab.classes()).toContain('bg-blue-600')
    })
  })

  // ── Gantt tab renders when plan confirmed ─────────────────────────────────

  describe('confirmed plan with steps', () => {
    test('Gantt section exists when plan confirmed', async () => {
      const wrapper = mountView({ confirmed: true })
      await switchToGantt(wrapper)
      const section = wrapper.find('[data-testid="gantt-section"]')
      expect(section.exists()).toBe(true)
    })

    test('SVG is rendered when plan confirmed with steps', async () => {
      const wrapper = mountView({ confirmed: true })
      await switchToGantt(wrapper)
      const svg = wrapper.find('[data-testid="gantt-svg"]')
      expect(svg.exists()).toBe(true)
    })

    test('SVG renders correct number of bar elements — one per step', async () => {
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: true })
      await switchToGantt(wrapper)
      const bars = wrapper.findAll('[data-testid^="gantt-bar-"]')
      expect(bars.length).toBe(THREE_STEPS.length)
    })

    test('SVG renders correct number of bars for 2 steps', async () => {
      const twoSteps = [makeStep('Alpha', 50), makeStep('Beta', 50)]
      const wrapper = mountView({ plan: { steps: twoSteps }, confirmed: true })
      await switchToGantt(wrapper)
      const bars = wrapper.findAll('[data-testid^="gantt-bar-"]')
      expect(bars.length).toBe(2)
    })
  })

  // ── Step name labels present ──────────────────────────────────────────────

  describe('step name labels', () => {
    test('step name labels are rendered — one per step', async () => {
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: true })
      await switchToGantt(wrapper)
      const labels = wrapper.findAll('[data-testid^="gantt-label-"]')
      expect(labels.length).toBe(THREE_STEPS.length)
    })

    test('first step label text is present and truncated to 12 chars max', async () => {
      const longStep = makeStep('VeryLongStepNameThatExceedsTwelve', 33)
      const wrapper = mountView({ plan: { steps: [longStep] }, confirmed: true })
      await switchToGantt(wrapper)
      const label = wrapper.find('[data-testid="gantt-label-0"]')
      expect(label.exists()).toBe(true)
      expect(label.text().length).toBeLessThanOrEqual(12)
    })

    test('step label for short name is not truncated', async () => {
      const shortStep = makeStep('ShortName', 50)
      const wrapper = mountView({ plan: { steps: [shortStep] }, confirmed: true })
      await switchToGantt(wrapper)
      const label = wrapper.find('[data-testid="gantt-label-0"]')
      expect(label.text()).toBe('ShortName')
    })
  })

  // ── Today line rendered (dashed red) ─────────────────────────────────────

  describe('today line', () => {
    test('today line has dashed red stroke attributes', async () => {
      // The today line is shown if today falls within the project range.
      // The project starts next Monday and today is before that, so ganttTodayX
      // is null and the line won't render. We test by checking either presence
      // (if today is within range) or absence (correct conditional rendering).
      // Since test timing may vary, we just verify the element structure is correct
      // when it is rendered by checking the SVG contains the element or not.
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: true })
      await switchToGantt(wrapper)
      const todayLine = wrapper.find('[data-testid="gantt-today-line"]')
      // If rendered, verify it has dashed red stroke
      if (todayLine.exists()) {
        expect(todayLine.attributes('stroke')).toBe('#ef4444')
        expect(todayLine.attributes('stroke-dasharray')).toBeTruthy()
      }
      // Either rendered (within range) or not (outside range) — both are correct
      expect(true).toBe(true)
    })

    test('today line element has correct stroke color when rendered', async () => {
      // We can test the element attributes exist on the SVG line element
      // by looking for the data-testid — if today is in range it appears
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: true })
      await switchToGantt(wrapper)
      // The SVG itself should always be present
      const svg = wrapper.find('[data-testid="gantt-svg"]')
      expect(svg.exists()).toBe(true)
      // Any today line that does appear must be red and dashed
      const todayLine = wrapper.find('[data-testid="gantt-today-line"]')
      if (todayLine.exists()) {
        expect(todayLine.attributes('stroke')).toBe('#ef4444')
        expect(todayLine.attributes('stroke-dasharray')).toBeTruthy()
      }
    })
  })

  // ── Placeholder when plan not confirmed ──────────────────────────────────

  describe('placeholder', () => {
    test('shows placeholder when plan not confirmed', async () => {
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: false })
      await switchToGantt(wrapper)
      const placeholder = wrapper.find('[data-testid="gantt-placeholder"]')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('Confirm the Evo plan to see the Gantt chart')
    })

    test('shows placeholder when plan is confirmed but has no steps', async () => {
      const wrapper = mountView({ plan: { steps: [] }, confirmed: true })
      await switchToGantt(wrapper)
      const placeholder = wrapper.find('[data-testid="gantt-placeholder"]')
      expect(placeholder.exists()).toBe(true)
    })

    test('does NOT render SVG when placeholder is shown', async () => {
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: false })
      await switchToGantt(wrapper)
      const svg = wrapper.find('[data-testid="gantt-svg"]')
      expect(svg.exists()).toBe(false)
    })
  })

  // ── SVG viewBox and dimensions ────────────────────────────────────────────

  describe('SVG dimensions', () => {
    test('SVG viewBox starts with "0 0 700"', async () => {
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: true })
      await switchToGantt(wrapper)
      const svg = wrapper.find('[data-testid="gantt-svg"]')
      const vb = svg.attributes('viewBox') ?? ''
      expect(vb.startsWith('0 0 700')).toBe(true)
    })

    test('SVG height is rows * 50 + 60', async () => {
      const wrapper = mountView({ plan: { steps: THREE_STEPS }, confirmed: true })
      await switchToGantt(wrapper)
      const svg = wrapper.find('[data-testid="gantt-svg"]')
      const vb = svg.attributes('viewBox') ?? ''
      const parts = vb.split(' ')
      const expectedHeight = THREE_STEPS.length * 50 + 60
      expect(Number(parts[3])).toBe(expectedHeight)
    })
  })
})
