// UNIT_TYPE=Widget
// Tests for CollisionLog.vue — structure, ARIA, states, mobile, and accessibility
// Spec: S.EvoStep4.InvitationFlow / S.EvoStep4.WorkspaceModel

import { describe, test, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { configureAxe } from 'vitest-axe'

// Component-scoped axe runner.
// The 'region' rule is disabled because components are mounted in isolation;
// the landmark context (<main>) is provided by App.vue, not by individual components.
const axe = configureAxe({ rules: { region: { enabled: false } } })
import CollisionLog from '../CollisionLog.vue'

// --- Mock useCollisionLog composable ---
// Use shared reactive refs so the component template re-renders when values change.

const mockLoadCollisions = vi.fn()
const mockCollisions = ref<unknown[]>([])
const mockLoading = ref(false)
const mockError = ref('')

vi.mock('../../composables/useCollisionLog', () => ({
  useCollisionLog: () => ({
    collisions: mockCollisions,
    loading: mockLoading,
    error: mockError,
    loadCollisions: mockLoadCollisions,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockCollisions.value = []
  mockLoading.value = false
  mockError.value = ''
})

describe('CollisionLog', () => {

  describe('ARIA structure', () => {

    // Spec: S.EvoStep4.InvitationFlow — CollisionLog section labelled for screen readers
    it('section has aria-labelledby pointing to the heading', () => {
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const section = wrapper.find('section')
      expect(section.attributes('aria-labelledby')).toBe('collision-log-heading')
    })

    it('heading has id="collision-log-heading"', () => {
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const heading = wrapper.find('#collision-log-heading')
      expect(heading.exists()).toBe(true)
    })

    it('reload button has aria-label', () => {
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const btn = wrapper.find('button[type="button"]')
      expect(btn.attributes('aria-label')).toBe('Reload collision log')
    })

    it('error state renders div with role=alert', () => {
      mockError.value = 'Access denied'
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const alertEl = wrapper.find('[role="alert"]')
      expect(alertEl.exists()).toBe(true)
      expect(alertEl.text()).toContain('Access denied')
    })

    it('loading state renders div with role=status and aria-live=polite', () => {
      mockLoading.value = true
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const statusEl = wrapper.find('[role="status"]')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.attributes('aria-live')).toBe('polite')
    })

  })

  describe('states', () => {

    it('shows empty state message when no collisions', () => {
      mockCollisions.value = []
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      expect(wrapper.text()).toContain('No identifier collisions')
    })

    // Spec: S.EvoStep4.InvitationFlow — collision table shows original and resolved IDs
    it('renders table with original and resolved IDs when collisions exist', () => {
      mockCollisions.value = [
        {
          id: 'c-1', workspace_id: 'ws-1',
          original_id: 'F.Example', suffixed_id: 'F.Example_2',
          logged_at: '2026-05-01T10:00:00Z', logged_by: 'u-1',
        },
      ]
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const tableText = wrapper.text()
      expect(tableText).toContain('F.Example')
      expect(tableText).toContain('F.Example_2')
    })

    it('renders collision count summary when collisions exist', () => {
      mockCollisions.value = [
        {
          id: 'c-1', workspace_id: 'ws-1',
          original_id: 'F.A', suffixed_id: 'F.A_2',
          logged_at: '2026-05-01T10:00:00Z', logged_by: 'u-1',
        },
      ]
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      expect(wrapper.text()).toContain('1 collision')
    })

    it('calls loadCollisions with the workspaceId on mount', () => {
      mount(CollisionLog, { props: { workspaceId: 'ws-abc' } })
      expect(mockLoadCollisions).toHaveBeenCalledWith('ws-abc')
    })

  })

  describe('mobile layout', () => {

    // Spec: V.SolutionMobileCompliance — 375px operable; table responsive (MOBILE_02)
    it('section has w-full class', () => {
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      expect(wrapper.find('section').classes()).toContain('w-full')
    })

    // Spec: MOBILE_03 — reload button ≥ 44×44px touch target
    it('reload button has min-h-[44px] and min-w-[44px] classes', () => {
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const btn = wrapper.find('button[type="button"]')
      expect(btn.attributes('class')).toContain('min-h-[44px]')
      expect(btn.attributes('class')).toContain('min-w-[44px]')
    })

    it('"Logged at" column header has hidden sm:table-cell classes for mobile responsive hide', () => {
      mockCollisions.value = [
        {
          id: 'c-1', workspace_id: 'ws-1',
          original_id: 'F.A', suffixed_id: 'F.A_2',
          logged_at: '2026-05-01T10:00:00Z', logged_by: 'u-1',
        },
      ]
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const headers = wrapper.findAll('th')
      const loggedAtHeader = headers.find(h => h.text().toLowerCase().includes('logged at'))
      expect(loggedAtHeader).toBeTruthy()
      expect(loggedAtHeader?.attributes('class')).toContain('hidden')
      expect(loggedAtHeader?.attributes('class')).toContain('sm:table-cell')
    })

  })

  describe('accessibility (axe-core)', () => {

    // Spec: Accessibility — must meet WCAG 2.1 AA (axe-core violations = 0)
    test('has no accessibility violations in empty state', async () => {
      mockCollisions.value = []
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('has no accessibility violations with collision table rendered', async () => {
      mockCollisions.value = [
        {
          id: 'c-1', workspace_id: 'ws-1',
          original_id: 'F.Example', suffixed_id: 'F.Example_2',
          logged_at: '2026-05-01T10:00:00Z', logged_by: 'u-1',
        },
      ]
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('has no accessibility violations in error state', async () => {
      mockError.value = 'Access denied'
      const wrapper = mount(CollisionLog, { props: { workspaceId: 'ws-1' } })
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

  })

})
