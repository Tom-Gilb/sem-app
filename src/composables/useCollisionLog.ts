// UNIT_TYPE=Hook
// useCollisionLog — reads spec_collisions table for admin review
// Spec: S.EvoStep4.InvitationFlow / S.EvoStep4.WorkspaceModel

import { ref, readonly } from 'vue'
import { getSupabaseClient } from '../config/supabase'

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface CollisionLogEntry {
  id: string
  workspace_id: string
  original_id: string
  suffixed_id: string
  logged_at: string
  logged_by: string
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable for the admin-only CollisionLog view.
 *
 * Fetches all spec_collisions rows for a given workspace.
 * RLS policy restricts this to admin and owner roles — a viewer or contributor
 * will receive an empty result set (Supabase RLS silently filters rows).
 *
 * @returns {{
 *   collisions: Readonly<Ref<CollisionLogEntry[]>>,
 *   loading: Readonly<Ref<boolean>>,
 *   error: Readonly<Ref<string>>,
 *   loadCollisions,
 * }}
 *
 * Preconditions: user must be authenticated with admin or owner role in the workspace.
 * Errors: exposed via `error` ref.
 */
export function useCollisionLog() {
  const collisions = ref<CollisionLogEntry[]>([])
  const loading = ref(false)
  const error = ref('')

  /**
   * Loads all collision log entries for the given workspace.
   * Ordered by logged_at descending (newest first).
   *
   * @param workspaceId - The workspace to fetch collisions for
   */
  async function loadCollisions(workspaceId: string): Promise<void> {
    if (!workspaceId) {
      error.value = 'workspaceId is required'
      return
    }
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()
      const { data, error: dbError } = await client
        .from('spec_collisions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('logged_at', { ascending: false })

      if (dbError) {
        error.value = dbError.message
        return
      }
      collisions.value = data as CollisionLogEntry[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return {
    collisions: readonly(collisions),
    loading: readonly(loading),
    error: readonly(error),
    loadCollisions,
  }
}
