// UNIT_TYPE=Hook
// Tests for useAuth composable
// Spec: S.EvoStep4.InvitationFlow / V.EvoStep4.InvitationSuccessRate

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useAuth, _resetAuthForTest } from '../useAuth'

// --- Mock the Supabase config module ---
// We replace getSupabaseClient() with a factory that returns a mock client
// so tests never make real network calls.

const mockSignUp = vi.fn()
const mockSignIn = vi.fn()
const mockSignOut = vi.fn()
const mockVerifyOtp = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../../config/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      verifyOtp: mockVerifyOtp,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  _resetAuthForTest()

  // Default: getSession returns no session
  mockGetSession.mockResolvedValue({ data: { session: null } })
  // Default: onAuthStateChange is a no-op
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('useAuth', () => {

  // ── signUp ───────────────────────────────────────────────────────────────

  describe('signUp', () => {

    // Spec: F.ImplementMultiUserAuthLayer — new user follows invitation link and creates account
    test('returns true and clears error on successful sign-up', async () => {
      mockSignUp.mockResolvedValue({ data: {}, error: null })
      const { signUp, error } = useAuth()

      const result = await signUp('user@example.com', 'password123')

      expect(result).toBe(true)
      expect(error.value).toBe('')
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      })
    })

    test('returns false and sets error on Supabase auth error', async () => {
      mockSignUp.mockResolvedValue({ data: null, error: { message: 'User already exists' } })
      const { signUp, error } = useAuth()

      const result = await signUp('existing@example.com', 'password123')

      expect(result).toBe(false)
      expect(error.value).toBe('User already exists')
    })

    test('returns false and sets error on network failure', async () => {
      mockSignUp.mockRejectedValue(new Error('Network error'))
      const { signUp, error } = useAuth()

      const result = await signUp('user@example.com', 'password123')

      expect(result).toBe(false)
      expect(error.value).toContain('Network error')
    })

    test('sets loading to true during call and false after', async () => {
      let loadingDuringCall = false
      mockSignUp.mockImplementation(async () => {
        loadingDuringCall = true
        return { data: {}, error: null }
      })
      const { signUp, loading } = useAuth()

      await signUp('user@example.com', 'password123')

      expect(loadingDuringCall).toBe(true)
      expect(loading.value).toBe(false)
    })

  })

  // ── signIn ───────────────────────────────────────────────────────────────

  describe('signIn', () => {

    // Spec: F.ImplementMultiUserAuthLayer — sign-in flow
    test('returns true on successful sign-in', async () => {
      mockSignIn.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
      const { signIn, error } = useAuth()

      const result = await signIn('user@example.com', 'password123')

      expect(result).toBe(true)
      expect(error.value).toBe('')
    })

    test('returns false and sets error on invalid credentials', async () => {
      mockSignIn.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } })
      const { signIn, error } = useAuth()

      const result = await signIn('user@example.com', 'wrongpassword')

      expect(result).toBe(false)
      expect(error.value).toBe('Invalid login credentials')
    })

    test('calls signInWithPassword with correct arguments', async () => {
      mockSignIn.mockResolvedValue({ data: {}, error: null })
      const { signIn } = useAuth()

      await signIn('test@example.com', 'mypassword')

      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'mypassword',
      })
    })

  })

  // ── signOut ──────────────────────────────────────────────────────────────

  describe('signOut', () => {

    test('returns true and clears session refs on successful sign-out', async () => {
      mockSignOut.mockResolvedValue({ error: null })
      const { signOut, user, session } = useAuth()

      const result = await signOut()

      expect(result).toBe(true)
      expect(user.value).toBeNull()
      expect(session.value).toBeNull()
    })

    test('returns false and sets error on sign-out failure', async () => {
      mockSignOut.mockResolvedValue({ error: { message: 'Session expired' } })
      const { signOut, error } = useAuth()

      const result = await signOut()

      expect(result).toBe(false)
      expect(error.value).toBe('Session expired')
    })

  })

  // ── init ────────────────────────────────────────────────────────────────

  describe('init', () => {

    // Spec: S.EvoStep4.InvitationFlow — session restored from storage on init
    test('restores session from Supabase getSession on first call', async () => {
      const fakeUser = { id: 'u-1', email: 'user@example.com' }
      const fakeSession = { user: fakeUser, access_token: 'tok' }
      mockGetSession.mockResolvedValueOnce({ data: { session: fakeSession } })

      const { init, user, session } = useAuth()
      await init()

      expect(user.value).toEqual(fakeUser)
      expect(session.value).toEqual(fakeSession)
    })

    test('does not call getSession a second time when init is called twice', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })

      const { init } = useAuth()
      await init()
      await init()

      expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    test('sets user and session to null when no persisted session exists', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })

      const { init, user, session } = useAuth()
      await init()

      expect(user.value).toBeNull()
      expect(session.value).toBeNull()
    })

  })

  // ── acceptInvite ─────────────────────────────────────────────────────────

  describe('acceptInvite', () => {

    // Spec: S.EvoStep4.InvitationFlow — invitation token acceptance
    test('returns true when OTP verification succeeds', async () => {
      mockVerifyOtp.mockResolvedValue({ data: {}, error: null })
      const { acceptInvite, error } = useAuth()

      const result = await acceptInvite('token-abc', 'invite')

      expect(result).toBe(true)
      expect(error.value).toBe('')
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'token-abc',
        type: 'invite',
      })
    })

    test('returns false and sets error on expired token', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: null,
        error: { message: 'Token has expired or is invalid' },
      })
      const { acceptInvite, error } = useAuth()

      const result = await acceptInvite('expired-token', 'invite')

      expect(result).toBe(false)
      expect(error.value).toBe('Token has expired or is invalid')
    })

    test('defaults token type to invite when not specified', async () => {
      mockVerifyOtp.mockResolvedValue({ data: {}, error: null })
      const { acceptInvite } = useAuth()

      await acceptInvite('token-xyz')

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'token-xyz',
        type: 'invite',
      })
    })

  })

})
