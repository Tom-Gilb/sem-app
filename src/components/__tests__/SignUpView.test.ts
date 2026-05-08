// UNIT_TYPE=Widget
// Tests for SignUpView.vue — structure, ARIA, mobile, events, and accessibility
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
import SignUpView from '../SignUpView.vue'

// --- Mock useAuth so the component never calls real Supabase ---

const mockSignUp = vi.fn()
const mockError = ref('')
const mockLoading = ref(false)

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    loading: mockLoading,
    error: mockError,
    signUp: mockSignUp,
  }),
  _resetAuthForTest: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockError.value = ''
  mockLoading.value = false
})

describe('SignUpView', () => {

  describe('ARIA structure', () => {

    // Spec: S.EvoStep4.InvitationFlow — sign-up form accessible to screen readers
    it('has a labelled email input', () => {
      const wrapper = mount(SignUpView)
      const emailInput = wrapper.find('#signup-email')
      const label = wrapper.find('label[for="signup-email"]')
      expect(emailInput.exists()).toBe(true)
      expect(label.exists()).toBe(true)
    })

    it('has a labelled password input', () => {
      const wrapper = mount(SignUpView)
      const passwordInput = wrapper.find('#signup-password')
      const label = wrapper.find('label[for="signup-password"]')
      expect(passwordInput.exists()).toBe(true)
      expect(label.exists()).toBe(true)
    })

    it('has a labelled confirm-password input', () => {
      const wrapper = mount(SignUpView)
      const confirmInput = wrapper.find('#signup-confirm')
      const label = wrapper.find('label[for="signup-confirm"]')
      expect(confirmInput.exists()).toBe(true)
      expect(label.exists()).toBe(true)
    })

    it('submit button is a semantic button element', () => {
      const wrapper = mount(SignUpView)
      const submitBtn = wrapper.find('button[type="submit"]')
      expect(submitBtn.exists()).toBe(true)
    })

  })

  describe('client-side validation', () => {

    // Spec: F.ImplementMultiUserAuthLayer — client-side password mismatch check before Supabase call
    it('shows error banner with role=alert when passwords do not match', async () => {
      const wrapper = mount(SignUpView)

      await wrapper.find('#signup-email').setValue('a@b.com')
      await wrapper.find('#signup-password').setValue('password1')
      await wrapper.find('#signup-confirm').setValue('password2')
      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      const alertBanner = wrapper.find('[role="alert"]')
      expect(alertBanner.exists()).toBe(true)
      expect(alertBanner.text()).toContain('do not match')
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('shows error banner when password is shorter than 8 characters', async () => {
      const wrapper = mount(SignUpView)

      await wrapper.find('#signup-email').setValue('a@b.com')
      await wrapper.find('#signup-password').setValue('short')
      await wrapper.find('#signup-confirm').setValue('short')
      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      const alertBanner = wrapper.find('[role="alert"]')
      expect(alertBanner.exists()).toBe(true)
      expect(alertBanner.text()).toContain('8 characters')
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('calls signUp when passwords match and meet length requirement', async () => {
      mockSignUp.mockResolvedValue(true)
      const wrapper = mount(SignUpView)

      await wrapper.find('#signup-email').setValue('a@b.com')
      await wrapper.find('#signup-password').setValue('validpassword')
      await wrapper.find('#signup-confirm').setValue('validpassword')
      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(mockSignUp).toHaveBeenCalledWith('a@b.com', 'validpassword')
    })

  })

  describe('mobile layout', () => {

    // Spec: V.SolutionMobileCompliance — 375px operable; no fixed widths (MOBILE_02)
    it('container has w-full class for responsive layout', () => {
      const wrapper = mount(SignUpView)
      const container = wrapper.find('div')
      expect(container.classes()).toContain('w-full')
    })

    // Spec: MOBILE_03 — all interactive elements ≥ 44×44px touch target
    it('email input has min-h-[44px] class', () => {
      const wrapper = mount(SignUpView)
      expect(wrapper.find('#signup-email').attributes('class')).toContain('min-h-[44px]')
    })

    it('password input has min-h-[44px] class', () => {
      const wrapper = mount(SignUpView)
      expect(wrapper.find('#signup-password').attributes('class')).toContain('min-h-[44px]')
    })

    it('confirm input has min-h-[44px] class', () => {
      const wrapper = mount(SignUpView)
      expect(wrapper.find('#signup-confirm').attributes('class')).toContain('min-h-[44px]')
    })

    it('submit button has min-h-[44px] class', () => {
      const wrapper = mount(SignUpView)
      expect(wrapper.find('button[type="submit"]').attributes('class')).toContain('min-h-[44px]')
    })

  })

  describe('events', () => {

    // Spec: S.EvoStep4.InvitationFlow — emits signed-up on successful registration
    it('emits "signed-up" when signUp returns true', async () => {
      mockSignUp.mockResolvedValue(true)
      const wrapper = mount(SignUpView)

      await wrapper.find('#signup-email').setValue('a@b.com')
      await wrapper.find('#signup-password').setValue('validpassword')
      await wrapper.find('#signup-confirm').setValue('validpassword')
      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('signed-up')).toBeTruthy()
    })

    it('does not emit "signed-up" when signUp returns false', async () => {
      mockSignUp.mockResolvedValue(false)
      const wrapper = mount(SignUpView)

      await wrapper.find('#signup-email').setValue('a@b.com')
      await wrapper.find('#signup-password').setValue('validpassword')
      await wrapper.find('#signup-confirm').setValue('validpassword')
      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('signed-up')).toBeFalsy()
    })

    it('emits "go-sign-in" when "Sign in" button is clicked', async () => {
      const wrapper = mount(SignUpView)
      await wrapper.find('button[type="button"]').trigger('click')
      expect(wrapper.emitted('go-sign-in')).toBeTruthy()
    })

  })

  describe('accessibility (axe-core)', () => {

    // Spec: Accessibility — must meet WCAG 2.1 AA (axe-core violations = 0)
    test('has no accessibility violations', async () => {
      const wrapper = mount(SignUpView)
      const results = await axe(wrapper.element)
      expect(results).toHaveNoViolations()
    })

  })

})
