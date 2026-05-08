// UNIT_TYPE=Hook
// useAuth — Supabase Auth composable for SEM App
// Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer

import { ref, readonly } from 'vue'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../config/supabase'
import { useLoadingState } from './useLoadingState'

// --- Module-level reactive state ---
// Shared across all composable instances so any component can read auth state.

const _user = ref<User | null>(null)
const _session = ref<Session | null>(null)
const _loading = ref(false)
const _error = ref<string>('')

// --- Initialise session from Supabase on module load ---
// This restores an existing session if one is present in localStorage.
// We call this lazily on first composable use, not at module evaluation time,
// so that test environments can mock the Supabase client before it is called.

let _initialised = false

async function initSession(): Promise<void> {
  if (_initialised) return
  _initialised = true

  try {
    const client = getSupabaseClient()
    const { data } = await client.auth.getSession()
    _session.value = data.session
    _user.value = data.session?.user ?? null

    // Listen for auth state changes (sign in, sign out, token refresh)
    client.auth.onAuthStateChange((_event, session) => {
      _session.value = session
      _user.value = session?.user ?? null
    })
  } catch {
    // Supabase not configured — silent; app still renders unauthenticated
  }
}

/** Formats an AuthError or plain error object into a user-friendly string. */
function formatAuthError(err: AuthError | Error | unknown): string {
  if (err instanceof Error) return err.message
  // Supabase returns error objects shaped { message: string } but not instanceof Error
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err)
}

/**
 * Composable for Supabase authentication flows.
 *
 * Covers sign-up, sign-in, sign-out, and invitation-link acceptance.
 * Reactive state is module-level (shared singleton) so all components
 * see the same auth context without a Vuex store.
 *
 * @returns {{
 *   user: Readonly<Ref<User | null>>,
 *   session: Readonly<Ref<Session | null>>,
 *   loading: Readonly<Ref<boolean>>,
 *   error: Readonly<Ref<string>>,
 *   signUp,
 *   signIn,
 *   signOut,
 *   acceptInvite,
 *   init,
 * }}
 *
 * Preconditions: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.
 * Errors: exposed via `error` ref; all public functions catch and surface errors.
 */
export function useAuth() {
  const { startLoading, stopLoading } = useLoadingState()

  /**
   * Signs up a new user with email and password.
   *
   * @param email - User's email address
   * @param password - User's chosen password
   * @returns true on success; false on error (check error ref)
   */
  async function signUp(email: string, password: string): Promise<boolean> {
    _loading.value = true
    _error.value = ''
    startLoading('auth:signUp', 'Creating account…')
    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.signUp({ email, password })
      if (error) {
        _error.value = formatAuthError(error)
        return false
      }
      return true
    } catch (err) {
      _error.value = formatAuthError(err)
      return false
    } finally {
      _loading.value = false
      stopLoading('auth:signUp')
    }
  }

  /**
   * Signs in an existing user with email and password.
   *
   * @param email - User's email address
   * @param password - User's password
   * @returns true on success; false on error (check error ref)
   */
  async function signIn(email: string, password: string): Promise<boolean> {
    _loading.value = true
    _error.value = ''
    startLoading('auth:signIn', 'Signing in…')
    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) {
        _error.value = formatAuthError(error)
        return false
      }
      return true
    } catch (err) {
      _error.value = formatAuthError(err)
      return false
    } finally {
      _loading.value = false
      stopLoading('auth:signIn')
    }
  }

  /**
   * Signs out the current user and clears session state.
   *
   * @returns true on success; false on error
   */
  async function signOut(): Promise<boolean> {
    _loading.value = true
    _error.value = ''
    startLoading('auth:signOut', 'Signing out…')
    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.signOut()
      if (error) {
        _error.value = formatAuthError(error)
        return false
      }
      _user.value = null
      _session.value = null
      return true
    } catch (err) {
      _error.value = formatAuthError(err)
      return false
    } finally {
      _loading.value = false
      stopLoading('auth:signOut')
    }
  }

  /**
   * Processes an invitation token from a deep link URL.
   *
   * Supabase sends invitation emails containing a URL with a one-time token.
   * The invitee's browser lands on the app with that token in the URL hash or
   * query string.  This function exchanges the token for a session, granting
   * the invitee the role that was pre-assigned when the invitation was sent.
   *
   * Spec: S.EvoStep4.InvitationFlow — 48-hour expiry enforced server-side.
   *
   * @param token - The OTP/invite token from the URL
   * @param type  - Token type: 'invite' for workspace invitations
   * @returns true on success (session established); false on error
   */
  async function acceptInvite(token: string, type: string = 'invite'): Promise<boolean> {
    _loading.value = true
    _error.value = ''
    startLoading('auth:acceptInvite', 'Accepting invitation…')
    try {
      const client = getSupabaseClient()
      // Supabase verifyOtp accepts EmailOtpType values for token_hash flow.
      // 'invite' is valid for workspace invitation tokens.
      const { error } = await client.auth.verifyOtp({
        token_hash: token,
        type: type as 'invite' | 'email' | 'recovery' | 'magiclink' | 'signup',
      })
      if (error) {
        _error.value = formatAuthError(error)
        return false
      }
      return true
    } catch (err) {
      _error.value = formatAuthError(err)
      return false
    } finally {
      _loading.value = false
      stopLoading('auth:acceptInvite')
    }
  }

  /**
   * Initialises the auth session from Supabase (restores persisted session).
   * Safe to call multiple times — executes only once.
   */
  async function init(): Promise<void> {
    await initSession()
  }

  return {
    user: readonly(_user),
    session: readonly(_session),
    loading: readonly(_loading),
    error: readonly(_error),
    signUp,
    signIn,
    signOut,
    acceptInvite,
    init,
  }
}

/**
 * Resets module-level auth state for test isolation.
 * @internal
 */
export function _resetAuthForTest(): void {
  _user.value = null
  _session.value = null
  _loading.value = false
  _error.value = ''
  _initialised = false
}
