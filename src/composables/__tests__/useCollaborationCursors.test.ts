// Tests for useCollaborationCursors composable — Feature #16

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useCollaborationCursors, getColor, COLORS } from '../useCollaborationCursors'

// Mock Supabase config — prevent real client instantiation
vi.mock('../../config/supabase', () => ({
  getSupabaseClient: vi.fn(() => {
    throw new Error('Supabase not configured in test environment')
  }),
}))

// Ensure VITE_SUPABASE_URL is absent so graceful degradation path is taken
// (vi.stubEnv sets import.meta.env values for the test run)

describe('useCollaborationCursors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure no VITE_SUPABASE_URL is set — composable should degrade gracefully
    vi.unstubAllEnvs()
  })

  // ── getColor ─────────────────────────────────────────────────────────────────

  describe('getColor', () => {
    test('returns a string from the COLORS palette', () => {
      const color = getColor('user-123')
      expect(COLORS).toContain(color)
    })

    test('returns a hex colour string', () => {
      const color = getColor('any-user-id')
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    })

    test('returns deterministic colour for the same userId', () => {
      expect(getColor('user-abc')).toBe(getColor('user-abc'))
    })

    test('covers all COLORS palette entries given enough distinct ids', () => {
      // Generate IDs until we see all 7 palette entries, or give up after 1000
      const seen = new Set<string>()
      for (let i = 0; seen.size < COLORS.length && i < 1000; i++) {
        seen.add(getColor(`user-${i}`))
      }
      expect(seen.size).toBe(COLORS.length)
    })
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    test('remoteCursors is empty initially', () => {
      const { remoteCursors } = useCollaborationCursors('ws-1')
      expect(remoteCursors.value).toHaveLength(0)
    })

    test('isActive is false initially', () => {
      const { isActive } = useCollaborationCursors('ws-1')
      expect(isActive.value).toBe(false)
    })
  })

  // ── start() with null workspaceId ─────────────────────────────────────────

  describe('start() with null workspaceId', () => {
    test('sets isActive=false immediately and returns without error', () => {
      const { isActive, start } = useCollaborationCursors(null)
      expect(() => start('user-1', 'Alice')).not.toThrow()
      expect(isActive.value).toBe(false)
    })

    test('remoteCursors remains empty after start() with null workspaceId', () => {
      const { remoteCursors, start } = useCollaborationCursors(null)
      start('user-1', 'Alice')
      expect(remoteCursors.value).toHaveLength(0)
    })
  })

  // ── start() without VITE_SUPABASE_URL ─────────────────────────────────────

  describe('start() without VITE_SUPABASE_URL configured', () => {
    test('sets isActive=false when VITE_SUPABASE_URL is absent', () => {
      // VITE_SUPABASE_URL is not stubbed — import.meta.env.VITE_SUPABASE_URL is undefined
      const { isActive, start } = useCollaborationCursors('ws-1')
      start('user-1', 'Alice')
      expect(isActive.value).toBe(false)
    })
  })

  // ── stop() ────────────────────────────────────────────────────────────────

  describe('stop()', () => {
    test('clears remoteCursors', () => {
      const { remoteCursors, stop } = useCollaborationCursors('ws-1')
      // Manually inject a cursor to verify it gets cleared
      remoteCursors.value = [
        {
          userId: 'u1',
          displayName: 'Alice',
          color: '#6366f1',
          xPct: 50,
          yPct: 50,
          lastSeen: Date.now(),
        },
      ]
      stop()
      expect(remoteCursors.value).toHaveLength(0)
    })

    test('sets isActive to false after stop()', () => {
      const { isActive, stop } = useCollaborationCursors('ws-1')
      stop()
      expect(isActive.value).toBe(false)
    })

    test('stop() does not throw when called before start()', () => {
      const { stop } = useCollaborationCursors('ws-1')
      expect(() => stop()).not.toThrow()
    })
  })
})
