// UNIT_TYPE=Widget
// Tests for InviteAcceptView.vue — structure, ARIA, states, events, and accessibility
// Spec: S.EvoStep4.InvitationFlow / V.EvoStep4.InvitationSuccessRate

import { describe, test, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { configureAxe } from 'vitest-axe'

// Component-scoped axe runner.
// The 'region' rule is disabled because components are mounted in isolation;
// the landmark context (<main>) is provided by App.vue, not by individual components.
const axe = configureAxe({ rules: { region: { enabled: false } } })
import InviteAcceptView from '../InviteAcceptView.vue'

// --- Mock useAuth composable ---
// acceptInvite return value is controlled per test.

const mockAcceptInvite = vi.fn()
const mockError = ref('')
const mockLoading = ref(false)

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    loading: mockLoading,
    error: mockError,
    acceptInvite: mockAcceptInvite,
  }),
  _resetAuthForTest: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockError.value = ''
  mockLoading.value = false
})

describe('InviteAcceptView', () => {

  describe('ARIA structure', () => {

    // Spec: S.EvoStep4.InvitationFlow — invite accept view announces status to screen readers
    it('outer wrapper has role=status and aria-live=polite', () => {
      mockAcceptInvite.mockResolvedValue(true)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-1' } })
      // role=status is always present on the outer div
      const statusEl = wrapper.find('[role="status"]')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.attributes('aria-live')).toBe('polite')
    })

    it('failed state renders a div with role=alert', async () => {
      mockAcceptInvite.mockResolvedValue(false)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-bad' } })
      await flushPromises()

      const alertEl = wrapper.find('[role="alert"]')
      expect(alertEl.exists()).toBe(true)
    })

  })

  describe('states', () => {

    // Spec: V.EvoStep4.InvitationSuccessRate — success state shown after token accepted
    it('shows success heading after acceptInvite resolves true', async () => {
      mockAcceptInvite.mockResolvedValue(true)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-ok' } })
      await flushPromises()

      expect(wrapper.text()).toContain('Invitation accepted')
    })

    it('shows failed heading after acceptInvite resolves false', async () => {
      mockAcceptInvite.mockResolvedValue(false)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-bad' } })
      await flushPromises()

      expect(wrapper.text()).toContain('Invitation failed')
    })

    it('shows processing spinner before acceptInvite resolves', () => {
      // Return a promise that never resolves — component stays in processing state
      mockAcceptInvite.mockReturnValue(new Promise(() => {}))
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-pending' } })

      expect(wrapper.text()).toContain('Verifying your invitation')
    })

    it('calls acceptInvite with the supplied token on mount', async () => {
      mockAcceptInvite.mockResolvedValue(true)
      mount(InviteAcceptView, { props: { token: 'my-token' } })
      await flushPromises()

      expect(mockAcceptInvite).toHaveBeenCalledWith('my-token', 'invite')
    })

    it('uses custom tokenType when provided', async () => {
      mockAcceptInvite.mockResolvedValue(true)
      mount(InviteAcceptView, { props: { token: 'my-token', tokenType: 'email' } })
      await flushPromises()

      expect(mockAcceptInvite).toHaveBeenCalledWith('my-token', 'email')
    })

  })

  describe('events', () => {

    // Spec: S.EvoStep4.InvitationFlow — emits invite-accepted when token is valid
    it('emits "invite-accepted" on successful token exchange', async () => {
      mockAcceptInvite.mockResolvedValue(true)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-ok' } })
      await flushPromises()

      expect(wrapper.emitted('invite-accepted')).toBeTruthy()
    })

    it('emits "invite-failed" on failed token exchange', async () => {
      mockAcceptInvite.mockResolvedValue(false)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-bad' } })
      await flushPromises()

      expect(wrapper.emitted('invite-failed')).toBeTruthy()
    })

  })

  describe('mobile layout', () => {

    // Spec: V.SolutionMobileCompliance — 375px operable (MOBILE_02)
    it('container has w-full class', () => {
      mockAcceptInvite.mockResolvedValue(true)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok' } })
      expect(wrapper.find('div').classes()).toContain('w-full')
    })

  })

  describe('accessibility (axe-core)', () => {

    // Spec: Accessibility — must meet WCAG 2.1 AA (axe-core violations = 0)
    test('has no accessibility violations in success state', async () => {
      mockAcceptInvite.mockResolvedValue(true)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-ok' } })
      await flushPromises()

      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('has no accessibility violations in failed state', async () => {
      mockAcceptInvite.mockResolvedValue(false)
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-bad' } })
      await flushPromises()

      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

    test('has no accessibility violations in processing state', async () => {
      mockAcceptInvite.mockReturnValue(new Promise(() => {}))
      const wrapper = mount(InviteAcceptView, { props: { token: 'tok-pending' } })

      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

  })

})
