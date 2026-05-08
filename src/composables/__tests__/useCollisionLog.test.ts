// UNIT_TYPE=Hook
// Tests for useCollisionLog composable
// Spec: S.EvoStep4.WorkspaceModel / S.EvoStep4.InvitationFlow

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useCollisionLog } from '../useCollisionLog'

// --- Mock the Supabase config module ---

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order']
  for (const m of methods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return builder
}

const mockFrom = vi.fn()

vi.mock('../../config/supabase', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCollisionLog', () => {

  describe('loadCollisions', () => {

    // Spec: S.EvoStep4.InvitationFlow — admin sees list of all suffixed identifiers
    test('populates collisions array on success', async () => {
      const fakeRows = [
        {
          id: 'c-1',
          workspace_id: 'ws-1',
          original_id: 'F.ExampleFunction',
          suffixed_id: 'F.ExampleFunction_2',
          logged_at: '2026-05-01T10:00:00Z',
          logged_by: 'user-1',
        },
      ]
      const builder = makeQueryBuilder({ data: fakeRows, error: null })
      mockFrom.mockReturnValue(builder)

      const { collisions, loadCollisions, error } = useCollisionLog()
      await loadCollisions('ws-1')

      expect(error.value).toBe('')
      expect(collisions.value).toEqual(fakeRows)
    })

    test('sets error when workspaceId is empty', async () => {
      const { loadCollisions, error } = useCollisionLog()
      await loadCollisions('')
      expect(error.value).toBe('workspaceId is required')
    })

    test('sets error on database failure', async () => {
      const builder = makeQueryBuilder({ data: null, error: { message: 'Access denied' } })
      mockFrom.mockReturnValue(builder)

      const { loadCollisions, error } = useCollisionLog()
      await loadCollisions('ws-1')

      expect(error.value).toBe('Access denied')
    })

    test('sets collisions to empty array when no rows returned', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      const { collisions, loadCollisions } = useCollisionLog()
      await loadCollisions('ws-1')

      expect(collisions.value).toHaveLength(0)
    })

    test('queries the spec_collisions table with correct workspace filter', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      await useCollisionLog().loadCollisions('ws-abc')

      expect(mockFrom).toHaveBeenCalledWith('spec_collisions')
      expect(builder.eq).toHaveBeenCalledWith('workspace_id', 'ws-abc')
    })

    test('orders results by logged_at descending', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      await useCollisionLog().loadCollisions('ws-abc')

      expect(builder.order).toHaveBeenCalledWith('logged_at', { ascending: false })
    })

    test('loading is false after call completes', async () => {
      const builder = makeQueryBuilder({ data: [], error: null })
      mockFrom.mockReturnValue(builder)

      const { loadCollisions, loading } = useCollisionLog()
      await loadCollisions('ws-1')

      expect(loading.value).toBe(false)
    })

  })

})
