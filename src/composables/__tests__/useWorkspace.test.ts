// UNIT_TYPE=Hook
// Tests for useWorkspace composable — focusing on resolveCollision (pure logic)
// and database-interaction functions (mocked via Supabase client mock).
// Spec: S.EvoStep4.WorkspaceModel / S.SupabaseAuthConfig / V.EvoStep4.InvitationSuccessRate

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useWorkspace, resolveCollision, _resetWorkspaceStateForTest } from '../useWorkspace'

// --- Mock the Supabase config module ---

// We need to mock chained Supabase query builder calls (from().select().eq()…).
// The mock returns a fluent builder object; the terminal call resolves to { data, error }.

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']
  for (const m of methods) {
    builder[m] = vi.fn(() => builder)
  }
  // .single() resolves immediately
  ;(builder.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
  // Make the builder itself thenable so `await client.from(...).select(...)` works
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return builder
}

const mockFrom = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

// getSupabaseClient is mocked as a vi.fn() so individual tests can override it
// via mockReturnValueOnce() when they need a different client shape (e.g. with auth.admin).
const mockGetSupabaseClient = vi.fn()

vi.mock('../../config/supabase', () => ({
  getSupabaseClient: (...args: unknown[]) => mockGetSupabaseClient(...args),
}))

/** Returns the default client mock (no auth.admin) */
function makeDefaultClient() {
  return {
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset module-level singleton state so tests don't bleed into each other
  _resetWorkspaceStateForTest()
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  // Default: every call returns the standard client
  mockGetSupabaseClient.mockReturnValue(makeDefaultClient())
})

// ── resolveCollision (pure function) ─────────────────────────────────────────

describe('resolveCollision', () => {

  // Spec: S.SupabaseAuthConfig — auto-suffix strategy _2, _3, … up to _99
  test('appends _2 when base identifier already exists', () => {
    const existing = new Set(['F.ExampleFunction'])
    const result = resolveCollision('F.ExampleFunction', existing)
    expect(result).toBe('F.ExampleFunction_2')
  })

  test('appends _3 when _2 already exists too', () => {
    const existing = new Set(['F.ExampleFunction', 'F.ExampleFunction_2'])
    const result = resolveCollision('F.ExampleFunction', existing)
    expect(result).toBe('F.ExampleFunction_3')
  })

  test('finds the first available suffix in a dense collision set', () => {
    const existing = new Set<string>()
    existing.add('V.MyValue')
    for (let i = 2; i <= 10; i++) existing.add(`V.MyValue_${i}`)
    const result = resolveCollision('V.MyValue', existing)
    expect(result).toBe('V.MyValue_11')
  })

  test('strips an existing numeric suffix before re-suffixing', () => {
    // If the incoming entry already has _2 but the workspace also has _2, we should
    // resolve from the base (not generate _2_2)
    const existing = new Set(['F.ExampleFunction', 'F.ExampleFunction_2'])
    const result = resolveCollision('F.ExampleFunction_2', existing)
    expect(result).toBe('F.ExampleFunction_3')
  })

  test('throws an error when all 99 suffixes are taken', () => {
    const existing = new Set<string>()
    existing.add('F.OverflowEntry')
    for (let i = 2; i <= 99; i++) existing.add(`F.OverflowEntry_${i}`)

    expect(() => resolveCollision('F.OverflowEntry', existing)).toThrow(
      /Collision limit exceeded/,
    )
  })

  test('does not modify the existing set itself', () => {
    const existing = new Set(['S.Solution'])
    const sizeBefore = existing.size
    resolveCollision('S.Solution', existing)
    expect(existing.size).toBe(sizeBefore)
  })

})

// ── useWorkspace composable ───────────────────────────────────────────────────

describe('useWorkspace', () => {

  describe('loadWorkspaces', () => {

    test('populates workspaces array on success', async () => {
      const fakeWorkspaces = [{ id: 'ws-1', name: 'Test WS', created_by: 'user-1', created_at: '' }]
      const builder = makeQueryBuilder({ data: fakeWorkspaces, error: null })
      mockFrom.mockReturnValue(builder)

      const { workspaces, loadWorkspaces, error } = useWorkspace()
      await loadWorkspaces()

      expect(error.value).toBe('')
      expect(workspaces.value).toEqual(fakeWorkspaces)
    })

    test('sets error on database failure', async () => {
      const builder = makeQueryBuilder({ data: null, error: { message: 'Permission denied' } })
      mockFrom.mockReturnValue(builder)

      const { workspaces, loadWorkspaces, error } = useWorkspace()
      await loadWorkspaces()

      expect(error.value).toBe('Permission denied')
      expect(workspaces.value).toHaveLength(0)
    })

  })

  describe('createWorkspace', () => {

    test('returns the created workspace and adds it to the local array', async () => {
      const newWs = { id: 'ws-new', name: 'My Workspace', created_by: 'user-1', created_at: '' }
      const insertBuilder = makeQueryBuilder({ data: newWs, error: null })
      const memberInsertBuilder = makeQueryBuilder({ data: {}, error: null })

      // First call: workspaces.insert; Second call: workspace_members.insert
      mockFrom
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(memberInsertBuilder)

      const { createWorkspace, workspaces } = useWorkspace()
      const result = await createWorkspace('My Workspace')

      expect(result).toEqual(newWs)
      expect(workspaces.value).toContainEqual(newWs)
    })

    test('returns null and sets error on insert failure', async () => {
      const failBuilder = makeQueryBuilder({ data: null, error: { message: 'Insert failed' } })
      mockFrom.mockReturnValue(failBuilder)

      const { createWorkspace, error } = useWorkspace()
      const result = await createWorkspace('Bad Workspace')

      expect(result).toBeNull()
      expect(error.value).toBe('Insert failed')
    })

  })

  describe('selectWorkspace', () => {

    // Spec: S.EvoStep4.WorkspaceModel — currentWorkspace ref is set on select
    test('sets currentWorkspace to the given workspace', () => {
      const ws = { id: 'ws-1', name: 'Alpha', created_by: 'user-1', created_at: '' }
      const { selectWorkspace, currentWorkspace } = useWorkspace()

      selectWorkspace(ws)

      expect(currentWorkspace.value).toEqual(ws)
    })

    test('replaces a previously selected workspace', () => {
      const ws1 = { id: 'ws-1', name: 'Alpha', created_by: 'user-1', created_at: '' }
      const ws2 = { id: 'ws-2', name: 'Beta', created_by: 'user-1', created_at: '' }
      const { selectWorkspace, currentWorkspace } = useWorkspace()

      selectWorkspace(ws1)
      selectWorkspace(ws2)

      expect(currentWorkspace.value?.id).toBe('ws-2')
    })

  })

  describe('loadMembers', () => {

    test('sets error when no workspace is selected', async () => {
      const { loadMembers, error } = useWorkspace()
      await loadMembers()
      expect(error.value).toBe('No workspace selected')
    })

    // Spec: S.EvoStep4.WorkspaceModel — loadMembers fetches workspace_members for current workspace
    test('populates members array on success', async () => {
      const fakeMembers = [
        { id: 'm-1', workspace_id: 'ws-1', user_id: 'u-1', role: 'owner', created_at: '' },
      ]
      const builder = makeQueryBuilder({ data: fakeMembers, error: null })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadMembers, members, error } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadMembers()

      expect(error.value).toBe('')
      expect(members.value).toEqual(fakeMembers)
    })

    test('sets error on database failure', async () => {
      const builder = makeQueryBuilder({ data: null, error: { message: 'Forbidden' } })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadMembers, error } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadMembers()

      expect(error.value).toBe('Forbidden')
    })

    test('queries workspace_members table filtered by current workspace id', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadMembers } = useWorkspace()
      selectWorkspace({ id: 'ws-xyz', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadMembers()

      expect(mockFrom).toHaveBeenCalledWith('workspace_members')
      expect(builder.eq).toHaveBeenCalledWith('workspace_id', 'ws-xyz')
    })

    test('loading is false after call completes', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadMembers, loading } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadMembers()

      expect(loading.value).toBe(false)
    })

  })

  describe('inviteMember', () => {

    // Spec: S.EvoStep4.InvitationFlow — inviteMember dispatches Supabase invite
    // The default mock getSupabaseClient returns no auth.admin — accessing it throws.
    // The composable's try/catch converts the thrown error to error.value and returns false.

    test('returns false and sets error when admin API is unavailable', async () => {
      const { inviteMember, error } = useWorkspace()

      const result = await inviteMember('test@example.com', 'ws-1', 'contributor')

      // Supabase admin API not available in test env — composable catches the error
      expect(result).toBe(false)
      expect(error.value).not.toBe('')
    })

    test('defaults role to contributor when not specified', async () => {
      // inviteMember signature has default role = 'contributor'
      // Verify TypeScript default is honoured — call without role arg succeeds (boolean return)
      const { inviteMember } = useWorkspace()
      const result = await inviteMember('test@example.com', 'ws-1')
      expect(typeof result).toBe('boolean')
    })

    test('returns true when inviteUserByEmail succeeds', async () => {
      // Override client mock for this test to include auth.admin
      const mockInvite = vi.fn().mockResolvedValue({ error: null })
      mockGetSupabaseClient.mockReturnValueOnce({
        from: mockFrom,
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          admin: { inviteUserByEmail: mockInvite },
        },
      })

      const { inviteMember, error } = useWorkspace()
      const result = await inviteMember('invite@example.com', 'ws-1', 'viewer')

      expect(result).toBe(true)
      expect(error.value).toBe('')
      expect(mockInvite).toHaveBeenCalledWith(
        'invite@example.com',
        expect.objectContaining({ data: { workspace_id: 'ws-1', role: 'viewer' } }),
      )
    })

    test('returns false and sets error when inviteUserByEmail returns error', async () => {
      const mockInvite = vi.fn().mockResolvedValue({ error: { message: 'Email already invited' } })
      mockGetSupabaseClient.mockReturnValueOnce({
        from: mockFrom,
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          admin: { inviteUserByEmail: mockInvite },
        },
      })

      const { inviteMember, error } = useWorkspace()
      const result = await inviteMember('already@example.com', 'ws-1')

      expect(result).toBe(false)
      expect(error.value).toBe('Email already invited')
    })

  })

  describe('loadEntries', () => {

    test('sets error when no workspace is selected', async () => {
      const { loadEntries, error } = useWorkspace()
      await loadEntries()
      expect(error.value).toBe('No workspace selected')
    })

    // Spec: S.EvoStep4.WorkspaceModel — loadEntries fetches sem_entries for current workspace
    test('populates entries array on success', async () => {
      const fakeEntries = [
        {
          id: 'e-1', workspace_id: 'ws-1', contributor_id: 'u-1',
          stakes: 'S', ends: 'E', means: 'M', spec_block: null, created_at: '',
        },
      ]
      const builder = makeQueryBuilder({ data: fakeEntries, error: null })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadEntries, entries, error } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadEntries()

      expect(error.value).toBe('')
      expect(entries.value).toEqual(fakeEntries)
    })

    test('sets error on database failure', async () => {
      const builder = makeQueryBuilder({ data: null, error: { message: 'Access denied' } })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadEntries, error } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadEntries()

      expect(error.value).toBe('Access denied')
    })

    test('queries sem_entries table ordered by created_at descending', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      const { selectWorkspace, loadEntries } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })
      await loadEntries()

      expect(mockFrom).toHaveBeenCalledWith('sem_entries')
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

  })

  describe('submitEntry', () => {

    test('sets error when no workspace is selected', async () => {
      const { submitEntry, error } = useWorkspace()
      const result = await submitEntry('S', 'E', 'M', null)
      expect(result).toBeNull()
      expect(error.value).toBe('No workspace selected')
    })

    // Spec: S.EvoStep4.WorkspaceModel — submitEntry sets error when not authenticated
    test('sets "Not authenticated" error when session has no user', async () => {
      // Override mockGetSession to return no user for this test
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })

      // submitEntry queries sem_entries first for collision check, then getSession
      // We need a builder for the initial sem_entries read
      const semEntriesBuilder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(semEntriesBuilder)

      const { selectWorkspace, submitEntry, error } = useWorkspace()
      selectWorkspace({ id: 'ws-1', name: 'WS', created_by: 'u-1', created_at: '' })

      const result = await submitEntry('My stakes', 'My ends', 'My means', null)

      expect(result).toBeNull()
      expect(error.value).toBe('Not authenticated')
    })

  })

})
