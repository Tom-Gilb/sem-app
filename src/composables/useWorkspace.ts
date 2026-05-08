// UNIT_TYPE=Hook
// useWorkspace — workspace management composable for SEM App
// Spec: S.EvoStep4.WorkspaceModel / S.EvoStep4.InvitationFlow

import { ref, readonly } from 'vue'
import { getSupabaseClient } from '../config/supabase'

// ─── Type definitions ────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'contributor' | 'viewer'

export interface Workspace {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
}

export interface SemEntry {
  id: string
  workspace_id: string
  contributor_id: string
  stakes: string
  ends: string
  means: string
  spec_block: Record<string, unknown> | null
  created_at: string
}

// ─── Collision resolution ─────────────────────────────────────────────────────

/**
 * Resolves an identifier collision using the auto-suffix strategy.
 *
 * Spec: S.SupabaseAuthConfig — appends _2, _3, … up to _99.
 * If the base identifier already has more than 99 collisions, throws an error.
 *
 * @param baseId       - The original entry identifier (e.g. "F.ExampleFunction")
 * @param existingIds  - Set of identifiers already present in the workspace spec
 * @returns The suffixed identifier (e.g. "F.ExampleFunction_2")
 * @throws {Error} if more than 99 collisions exist for the same base identifier
 */
export function resolveCollision(baseId: string, existingIds: Set<string>): string {
  // Strip any existing numeric suffix so we always suffix from the original base
  const strippedBase = baseId.replace(/_\d+$/, '')

  for (let n = 2; n <= 99; n++) {
    const candidate = `${strippedBase}_${n}`
    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  // More than 99 suffixes for the same base — hard error per spec
  throw new Error(
    `Collision limit exceeded: "${strippedBase}" already has 99 suffixed variants in this workspace. Rename the entry before submitting.`,
  )
}

// ─── Module-level singleton state ─────────────────────────────────────────────
// Shared across all useWorkspace() calls so every composable (useEvoPlan, etc.)
// sees the same currentWorkspace without prop-drilling.

const workspaces = ref<Workspace[]>([])
const currentWorkspace = ref<Workspace | null>(null)
const members = ref<WorkspaceMember[]>([])
const entries = ref<SemEntry[]>([])
const loading = ref(false)
const error = ref('')

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable for workspace CRUD, membership management, invitation dispatch,
 * and SEM entry submission with auto-suffix collision resolution.
 *
 * State is module-level (singleton) — all callers share the same
 * currentWorkspace, workspaces, members, and entries refs.
 *
 * All database writes go through Supabase; RLS policies enforce role permissions
 * at the database layer — this composable does not re-check roles client-side.
 *
 * @returns {{
 *   workspaces, currentWorkspace, members, entries,
 *   loading, error,
 *   loadWorkspaces, createWorkspace, selectWorkspace,
 *   loadMembers, inviteMember, loadEntries, submitEntry,
 * }}
 *
 * Preconditions: user must be authenticated (Supabase session active).
 * Errors: exposed via `error` ref; all public functions catch and surface errors.
 */
export function useWorkspace() {

  // --- Workspaces ---

  /**
   * Loads all workspaces the current user is a member of.
   */
  async function loadWorkspaces(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()
      const { data, error: dbError } = await client.from('workspaces').select('*')
      if (dbError) {
        error.value = dbError.message
        return
      }
      workspaces.value = data as Workspace[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a new workspace and inserts the creator as 'owner'.
   *
   * @param name - Display name for the workspace
   * @returns The created workspace, or null on error
   */
  async function createWorkspace(name: string): Promise<Workspace | null> {
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()

      // Insert workspace row — RLS ensures only authenticated users can insert
      const { data: wsData, error: wsError } = await client
        .from('workspaces')
        .insert({ name })
        .select()
        .single()

      if (wsError) {
        error.value = wsError.message
        return null
      }

      const ws = wsData as Workspace

      // Add creator as owner member
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (userId) {
        await client.from('workspace_members').insert({
          workspace_id: ws.id,
          user_id: userId,
          role: 'owner',
        })
      }

      workspaces.value.push(ws)
      return ws
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Sets the currently active workspace.
   *
   * @param workspace - The workspace to activate
   */
  function selectWorkspace(workspace: Workspace): void {
    currentWorkspace.value = workspace
  }

  // --- Members & Invitations ---

  /**
   * Loads all members of the current workspace.
   * RLS policy ensures only workspace members can read this data.
   */
  async function loadMembers(): Promise<void> {
    if (!currentWorkspace.value) {
      error.value = 'No workspace selected'
      return
    }
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()
      const { data, error: dbError } = await client
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', currentWorkspace.value.id)
      if (dbError) {
        error.value = dbError.message
        return
      }
      members.value = data as WorkspaceMember[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Sends a workspace invitation to the given email address.
   *
   * Spec: S.EvoStep4.InvitationFlow — Supabase invite API; 48-hour expiry
   * is configured in the Supabase project dashboard (not set here).
   * The invited user receives an email with a deep link; on click, the app
   * reads the token from the URL and calls useAuth().acceptInvite().
   *
   * @param email       - The invitee's email address
   * @param workspaceId - Workspace to grant access to
   * @param role        - Role to assign on acceptance ('contributor' | 'viewer')
   * @returns true on success; false on error
   */
  async function inviteMember(
    email: string,
    workspaceId: string,
    role: WorkspaceRole = 'contributor',
  ): Promise<boolean> {
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()

      // Supabase Admin API invite — requires service_role key on server side.
      // In the client context we use the standard invite flow with redirectTo.
      const { error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
        data: { workspace_id: workspaceId, role },
        redirectTo: `${window.location.origin}?invite=true&workspace=${workspaceId}&role=${role}`,
      })

      if (inviteError) {
        error.value = inviteError.message
        return false
      }
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      loading.value = false
    }
  }

  // --- SEM Entries ---

  /**
   * Loads all SEM entries for the current workspace.
   */
  async function loadEntries(): Promise<void> {
    if (!currentWorkspace.value) {
      error.value = 'No workspace selected'
      return
    }
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()
      const { data, error: dbError } = await client
        .from('sem_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.value.id)
        .order('created_at', { ascending: false })
      if (dbError) {
        error.value = dbError.message
        return
      }
      entries.value = data as SemEntry[]
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Submits a SEM entry to the current workspace.
   *
   * Applies auto-suffix collision resolution if the entry's spec identifier
   * conflicts with an existing identifier in this workspace. Records a row in
   * spec_collisions for every suffix applied (admin audit log).
   *
   * Spec: S.SupabaseAuthConfig — suffix strategy _2 … _99; error above 99.
   *
   * @param stakes    - The Stakes text from the SEM entry form
   * @param ends      - The Ends text
   * @param means     - The Means text
   * @param specBlock - The generated spec block (from useSDK)
   * @returns The inserted SemEntry, or null on error
   */
  async function submitEntry(
    stakes: string,
    ends: string,
    means: string,
    specBlock: Record<string, unknown> | null,
  ): Promise<SemEntry | null> {
    if (!currentWorkspace.value) {
      error.value = 'No workspace selected'
      return null
    }
    loading.value = true
    error.value = ''
    try {
      const client = getSupabaseClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) {
        error.value = 'Not authenticated'
        return null
      }

      // Build the set of existing identifiers in this workspace for collision check
      const existingEntries = await client
        .from('sem_entries')
        .select('spec_block')
        .eq('workspace_id', currentWorkspace.value.id)

      const existingIds = new Set<string>()
      if (existingEntries.data) {
        for (const row of existingEntries.data as Array<{ spec_block: Record<string, unknown> | null }>) {
          if (row.spec_block) {
            const block = row.spec_block as { functions?: Array<{ id: string }>; values?: Array<{ id: string }>; solutions?: Array<{ id: string }> }
            for (const entry of [...(block.functions ?? []), ...(block.values ?? []), ...(block.solutions ?? [])]) {
              existingIds.add(entry.id)
            }
          }
        }
      }

      // Apply collision resolution to the incoming specBlock identifiers
      const resolvedBlock = specBlock ? applyCollisionResolution(specBlock, existingIds) : null

      // Log any collisions that occurred
      if (resolvedBlock?.collisions.length) {
        for (const collision of resolvedBlock.collisions) {
          await client.from('spec_collisions').insert({
            workspace_id: currentWorkspace.value.id,
            original_id: collision.original,
            suffixed_id: collision.resolved,
            logged_by: userId,
          })
        }
      }

      // Insert the SEM entry
      const { data, error: insertError } = await client
        .from('sem_entries')
        .insert({
          workspace_id: currentWorkspace.value.id,
          contributor_id: userId,
          stakes,
          ends,
          means,
          spec_block: resolvedBlock?.block ?? specBlock,
        })
        .select()
        .single()

      if (insertError) {
        error.value = insertError.message
        return null
      }

      const inserted = data as SemEntry
      entries.value.unshift(inserted)
      return inserted
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    workspaces: readonly(workspaces),
    currentWorkspace: readonly(currentWorkspace),
    members: readonly(members),
    entries: readonly(entries),
    loading: readonly(loading),
    error: readonly(error),
    loadWorkspaces,
    createWorkspace,
    selectWorkspace,
    loadMembers,
    inviteMember,
    loadEntries,
    submitEntry,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface CollisionRecord {
  original: string
  resolved: string
}

interface ResolvedBlock {
  block: Record<string, unknown>
  collisions: CollisionRecord[]
}

/**
 * Walks every F., V., S. entry in the spec block and resolves any identifier
 * that conflicts with an existing workspace identifier.
 *
 * Mutates a deep clone of the block — the input is not modified.
 */
function applyCollisionResolution(
  specBlock: Record<string, unknown>,
  existingIds: Set<string>,
): ResolvedBlock {
  // Deep clone to avoid mutating the composable's reactive state
  const block = JSON.parse(JSON.stringify(specBlock)) as Record<string, unknown>
  const collisions: CollisionRecord[] = []

  // Track IDs assigned in this submission to prevent intra-batch collisions
  const assignedIds = new Set<string>(existingIds)

  function resolveEntry(entry: { id: string }): void {
    if (assignedIds.has(entry.id)) {
      const original = entry.id
      const resolved = resolveCollision(entry.id, assignedIds)
      collisions.push({ original, resolved })
      entry.id = resolved
    }
    assignedIds.add(entry.id)
  }

  const functions = block.functions as Array<{ id: string }> | undefined
  const values = block.values as Array<{ id: string }> | undefined
  const solutions = block.solutions as Array<{ id: string }> | undefined

  for (const entry of functions ?? []) resolveEntry(entry)
  for (const entry of values ?? []) resolveEntry(entry)
  for (const entry of solutions ?? []) resolveEntry(entry)

  return { block, collisions }
}

/**
 * Resets all module-level singleton state to initial values.
 * For test isolation only — do not call in production code.
 * @internal
 */
export function _resetWorkspaceStateForTest(): void {
  workspaces.value = []
  currentWorkspace.value = null
  members.value = []
  entries.value = []
  loading.value = false
  error.value = ''
}
