// UNIT_TYPE=Hook
// useCollaborationCursors — Real-Time Collaboration Cursors via Supabase Realtime Presence
// Feature #16
// Tracks remote user cursor positions. Each user broadcasts cursor position (x%, y%
// of viewport) and display name. Local cursor is excluded from the rendered list.

import { ref } from 'vue'
import { getSupabaseClient } from '../config/supabase'

export interface RemoteCursor {
  userId: string
  displayName: string
  color: string      // from a fixed palette based on userId hash
  xPct: number       // 0–100% of viewport width
  yPct: number       // 0–100% of viewport height
  lastSeen: number   // Date.now() timestamp
}

/** Colour palette — cycling by userId hash */
export const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899']

/** Deterministic colour from userId string via simple char-code hash. */
export function getColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return COLORS[hash % COLORS.length]
}

// Presence payload shape
interface PresencePayload {
  userId: string
  displayName: string
  xPct: number
  yPct: number
  lastSeen: number
}

/**
 * Composable for real-time collaboration cursor tracking.
 *
 * Uses Supabase Realtime Presence on channel `workspace:{workspaceId}`.
 * Mouse movements are throttled to one broadcast per 50 ms.
 * Cursors older than 5 s are pruned from remoteCursors.
 *
 * Graceful degradation: if workspaceId is null or Supabase is not configured
 * (no VITE_SUPABASE_URL), start() sets isActive = false and returns immediately.
 *
 * @param workspaceId - Workspace identifier for the Presence channel, or null for mock mode.
 */
export function useCollaborationCursors(workspaceId: string | null) {
  const remoteCursors = ref<RemoteCursor[]>([])
  const isActive = ref(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _channel: any = null
  let _userId = ''
  let _pruneInterval: ReturnType<typeof setInterval> | null = null
  let _lastBroadcast = 0
  let _mouseMoveHandler: ((e: MouseEvent) => void) | null = null

  /**
   * Start tracking: subscribe to Presence channel, throttle mousemove broadcasts,
   * and prune stale cursors every second.
   */
  function start(userId: string, displayName: string): void {
    // Graceful degradation — no workspace or Supabase not configured
    if (!workspaceId || !import.meta.env.VITE_SUPABASE_URL) {
      isActive.value = false
      return
    }

    _userId = userId

    let client
    try {
      client = getSupabaseClient()
    } catch {
      isActive.value = false
      return
    }

    const channelName = `workspace:${workspaceId}`
    _channel = client.channel(channelName)

    // Subscribe to presence sync events — rebuild remoteCursors from presence state
    _channel.on('presence', { event: 'sync' }, () => {
      const state: Record<string, PresencePayload[]> = _channel.presenceState()
      const cursors: RemoteCursor[] = []
      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (!p.userId || p.userId === _userId) continue
          cursors.push({
            userId: p.userId,
            displayName: p.displayName || 'Guest',
            color: getColor(p.userId),
            xPct: p.xPct ?? 0,
            yPct: p.yPct ?? 0,
            lastSeen: p.lastSeen ?? Date.now(),
          })
        }
      }
      remoteCursors.value = cursors
    })

    _channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        isActive.value = true
      }
    })

    // Throttled mousemove → broadcast position
    _mouseMoveHandler = (e: MouseEvent) => {
      const now = Date.now()
      if (now - _lastBroadcast < 50) return
      _lastBroadcast = now

      const xPct = (e.clientX / window.innerWidth) * 100
      const yPct = (e.clientY / window.innerHeight) * 100

      void _channel.track({
        userId,
        displayName,
        xPct,
        yPct,
        lastSeen: Date.now(),
      } satisfies PresencePayload)
    }

    window.addEventListener('mousemove', _mouseMoveHandler)

    // Prune cursors older than 5 s every second
    _pruneInterval = setInterval(() => {
      const cutoff = Date.now() - 5000
      remoteCursors.value = remoteCursors.value.filter((c) => c.lastSeen > cutoff)
    }, 1000)
  }

  /** Cleanup: unsubscribe channel, remove mousemove listener, stop prune interval. */
  function stop(): void {
    if (_mouseMoveHandler) {
      window.removeEventListener('mousemove', _mouseMoveHandler)
      _mouseMoveHandler = null
    }
    if (_pruneInterval !== null) {
      clearInterval(_pruneInterval)
      _pruneInterval = null
    }
    if (_channel) {
      try {
        void _channel.unsubscribe()
      } catch {
        // ignore
      }
      _channel = null
    }
    isActive.value = false
    remoteCursors.value = []
  }

  return { remoteCursors, isActive, start, stop }
}
