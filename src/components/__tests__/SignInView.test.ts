// UNIT_TYPE=Widget
// Tests for SignInView.vue — structure, ARIA, mobile, events, and accessibility
// Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer

import { describe, test, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { configureAxe } from 'vitest-axe'

// Component-scoped axe runner.
// The 'region' rule is disabled because components are mounted in isolation;
// the landmark context (<main>) is provided by App.vue, not by individual components.
// All other WCAG 2.1 AA rules remain active.
const axe = configureAxe({ rules: { region: { enabled: false } } })
import SignInView from '../SignInView.vue'

// --- Mock useAuth so the component never calls real Supabase ---
// Use shared refs so tests can control the state the component observes.

const mockSignIn = vi.fn()
const mockError = ref('')
const mockLoading = ref(false)

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    loading: mockLoading,
    error: mockError,
    signIn: mockSignIn,
  }),
  _resetAuthForTest: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockError.value = ''
  mockLoading.value = false
})

describe('SignInView', () => {

  describe('ARIA structure', () => {

    // Spec: S.EvoStep4.InvitationFlow — sign-in form accessible to screen readers
    it('has a labelled email input', () => {
      const wrapper = mount(SignInView)
      const emailInput = wrapper.find('#signin-email')
      const label = wrapper.find('label[for="signin-email"]')
      expect(emailInput.exists()).toBe(true)
      expect(label.exists()).toBe(true)
    })

    it('has a labelled password input', () => {
      const wrapper = mount(SignInView)
      const passwordInput = wrapper.find('#signin-password')
      const label = wrapper.find('label[for="signin-password"]')
      expect(passwordInput.exists()).toBe(true)
      expect(label.exists()).toBe(true)
    })

    it('submit button is a semantic button element', () => {
      const wrapper = mount(SignInView)
      const submitBtn = wrapper.find('button[type="submit"]')
      expect(submitBtn.exists()).toBe(true)
    })

    it('renders error banner with role=alert when error is present', async () => {
      mockError.value = 'Invalid credentials'
      const wrapper = mount(SignInView)
      await wrapper.vm.$nextTick()

      const alertBanner = wrapper.find('[role="alert"]')
      expect(alertBanner.exists()).toBe(true)
      expect(alertBanner.text()).toContain('Invalid credentials')
    })

    it('does not render error banner when error is empty', () => {
      mockError.value = ''
      const wrapper = mount(SignInView)
      const alertBanner = wrapper.find('[role="alert"]')
      expect(alertBanner.exists()).toBe(false)
    })

  })

  describe('mobile layout', () => {

    // Spec: V.SolutionMobileCompliance — 375px operable; no fixed widths (MOBILE_02)
    it('container has w-full class for responsive layout', () => {
      const wrapper = mount(SignInView)
      const container = wrapper.find('div')
      expect(container.classes()).toContain('w-full')
    })

    // Spec: MOBILE_03 — all interactive elements ≥ 44×44px touch target
    it('email input has min-h-[44px] class', () => {
      const wrapper = mount(SignInView)
      const emailInput = wrapper.find('#signin-email')
      expect(emailInput.attributes('class')).toContain('min-h-[44px]')
    })

    it('password input has min-h-[44px] class', () => {
      const wrapper = mount(SignInView)
      const passwordInput = wrapper.find('#signin-password')
      expect(passwordInput.attributes('class')).toContain('min-h-[44px]')
    })

    it('submit button has min-h-[44px] class', () => {
      const wrapper = mount(SignInView)
      const submitBtn = wrapper.find('button[type="submit"]')
      expect(submitBtn.attributes('class')).toContain('min-h-[44px]')
    })

    it('"Create an account" button has min-h-[44px] class', () => {
      const wrapper = mount(SignInView)
      const createBtn = wrapper.find('button[type="button"]')
      expect(createBtn.attributes('class')).toContain('min-h-[44px]')
    })

  })

  describe('events', () => {

    // Spec: S.EvoStep4.InvitationFlow — emits signed-in on successful sign-in
    it('emits "signed-in" when signIn returns true', async () => {
      mockSignIn.mockResolvedValue(true)
      const wrapper = mount(SignInView)

      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('signed-in')).toBeTruthy()
    })

    it('does not emit "signed-in" when signIn returns false', async () => {
      mockSignIn.mockResolvedValue(false)
      const wrapper = mount(SignInView)

      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('signed-in')).toBeFalsy()
    })

    it('emits "go-sign-up" when "Create an account" button is clicked', async () => {
      const wrapper = mount(SignInView)
      await wrapper.find('button[type="button"]').trigger('click')
      expect(wrapper.emitted('go-sign-up')).toBeTruthy()
    })

  })

  describe('accessibility (axe-core)', () => {

    // Spec: Accessibility — must meet WCAG 2.1 AA (axe-core violations = 0)
    test('has no accessibility violations', async () => {
      const wrapper = mount(SignInView)
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

  })

})
