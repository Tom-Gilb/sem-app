// UNIT_TYPE=Config
// Supabase client configuration
// Spec: S.EvoStep4.WorkspaceModel / S.SupabaseAuthConfig
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the environment.
// Both variables must be set for a real Supabase connection.
// In test environments, the client is mocked — this file is not imported directly.

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// --- Lazy singleton pattern ---
// The client is created once on first call to getSupabaseClient().
// Tests replace this via vi.mock() — they never call getSupabaseClient().

let _client: SupabaseClient | null = null

/**
 * Returns the singleton Supabase client, initialised lazily from env vars.
 *
 * @throws {Error} if VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are not set
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

    if (!url || !key) {
      throw new Error(
        'Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
      )
    }

    _client = createClient(url, key)
  }

  return _client
}

/**
 * Resets the singleton Supabase client.
 * Exposed for test isolation only — never call in production code.
 * @internal
 */
export function _resetSupabaseClientForTest(): void {
  _client = null
}
