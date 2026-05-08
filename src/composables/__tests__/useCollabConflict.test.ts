// Tests for useCollabConflict composable — Feature #51

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useCollabConflict } from '../useCollabConflict'
import type { SpecBlock } from '../../types/spec'

const makeSpec = (goalValue = '85%'): SpecBlock => ({
  functions: [],
  values: [
    {
      id: 'V.TestValue',
      type: 'Value',
      level: 'Product',
      description: 'Test value entry',
      scale: 'Score 0–100',
      meter: 'Automated test',
      status: 'Status [now] 70%',
      tolerable: 'Tolerable [now] 75%',
      goal: goalValue,
      valueOfFunction: '[[F.Test]]',
    },
  ],
  solutions: [],
})

const makeEmptySpec = (): SpecBlock => ({
  functions: [],
  values: [],
  solutions: [],
})

describe('useCollabConflict', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state with 1 active user', () => {
    test('conflicts is empty initially', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec())
      const activeUserCount = ref(1)
      const { conflicts } = useCollabConflict(localSpec, activeUserCount)
      expect(conflicts.value).toHaveLength(0)
    })

    test('isMonitoring is false when activeUserCount is 1', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec())
      const activeUserCount = ref(1)
      const { isMonitoring } = useCollabConflict(localSpec, activeUserCount)
      expect(isMonitoring.value).toBe(false)
    })
  })

  // ── Watch: activeUserCount ≥ 2 triggers monitoring ─────────────────────

  describe('when activeUserCount changes to ≥2', () => {
    test('isMonitoring becomes true', async () => {
      const localSpec = ref<SpecBlock | null>(makeSpec())
      const activeUserCount = ref(2)
      const { isMonitoring } = useCollabConflict(localSpec, activeUserCount)
      // immediate watch fires on creation
      expect(isMonitoring.value).toBe(true)
    })

    test('after 5100ms in mock mode a conflict is injected', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec('85%'))
      const activeUserCount = ref(2)
      const { conflicts } = useCollabConflict(localSpec, activeUserCount)

      expect(conflicts.value).toHaveLength(0)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value).toHaveLength(1)
      expect(conflicts.value[0].field).toBe('goal')
      expect(conflicts.value[0].remoteUser).toBe('alex@example.com')
    })
  })

  // ── stopMonitoring ────────────────────────────────────────────────────────

  describe('stopMonitoring', () => {
    test('sets isMonitoring to false', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec())
      const activeUserCount = ref(2)
      const { isMonitoring, stopMonitoring } = useCollabConflict(localSpec, activeUserCount)
      expect(isMonitoring.value).toBe(true)
      stopMonitoring()
      expect(isMonitoring.value).toBe(false)
    })

    test('clears conflicts', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec('85%'))
      const activeUserCount = ref(2)
      const { conflicts, stopMonitoring } = useCollabConflict(localSpec, activeUserCount)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value).toHaveLength(1)
      stopMonitoring()
      expect(conflicts.value).toHaveLength(0)
    })

    test('cancels pending mock timer (no conflict injected after stop)', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec())
      const activeUserCount = ref(2)
      const { conflicts, stopMonitoring } = useCollabConflict(localSpec, activeUserCount)
      stopMonitoring()
      vi.advanceTimersByTime(6000)
      expect(conflicts.value).toHaveLength(0)
    })
  })

  // ── startMonitoring direct call ───────────────────────────────────────────

  describe('startMonitoring called directly', () => {
    test('isMonitoring becomes true', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec())
      const activeUserCount = ref(1)
      const { isMonitoring, startMonitoring } = useCollabConflict(localSpec, activeUserCount)
      expect(isMonitoring.value).toBe(false)
      activeUserCount.value = 2 // ensure count ≥2 so timer fires
      startMonitoring()
      expect(isMonitoring.value).toBe(true)
    })

    test('after 5100ms conflict is injected when spec has V. entries', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec('90%'))
      const activeUserCount = ref(1)
      const { conflicts, stopMonitoring, startMonitoring } = useCollabConflict(localSpec, activeUserCount)
      // stop the auto-monitoring (not running yet, just precaution)
      stopMonitoring()
      activeUserCount.value = 2
      startMonitoring()
      vi.advanceTimersByTime(5100)
      expect(conflicts.value).toHaveLength(1)
      expect(conflicts.value[0].localValue).toBe('90%')
      // Remote value should have the number bumped by 10
      expect(conflicts.value[0].remoteValue).toBe('100%')
    })
  })

  // ── clearConflicts ────────────────────────────────────────────────────────

  describe('clearConflicts', () => {
    test('empties conflicts without stopping monitoring', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec('80%'))
      const activeUserCount = ref(2)
      const { conflicts, isMonitoring, clearConflicts } = useCollabConflict(localSpec, activeUserCount)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value).toHaveLength(1)
      clearConflicts()
      expect(conflicts.value).toHaveLength(0)
      expect(isMonitoring.value).toBe(true)
    })
  })

  // ── injectMockConflict with no V. entries ─────────────────────────────────

  describe('mock conflict with empty spec (no V. entries)', () => {
    test('conflicts remains empty — graceful no-op', () => {
      const localSpec = ref<SpecBlock | null>(makeEmptySpec())
      const activeUserCount = ref(2)
      const { conflicts } = useCollabConflict(localSpec, activeUserCount)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value).toHaveLength(0)
    })
  })

  // ── Conflict field content ────────────────────────────────────────────────

  describe('conflict entry content', () => {
    test('entryId matches first V. entry id', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec('75%'))
      const activeUserCount = ref(2)
      const { conflicts } = useCollabConflict(localSpec, activeUserCount)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value[0].entryId).toBe('V.TestValue')
    })

    test('field is "goal"', () => {
      const localSpec = ref<SpecBlock | null>(makeSpec('75%'))
      const activeUserCount = ref(2)
      const { conflicts } = useCollabConflict(localSpec, activeUserCount)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value[0].field).toBe('goal')
    })

    test('goal with no digits defaults remoteValue to "95%"', () => {
      const spec = makeSpec()
      spec.values[0].goal = ''
      const localSpec = ref<SpecBlock | null>(spec)
      const activeUserCount = ref(2)
      const { conflicts } = useCollabConflict(localSpec, activeUserCount)
      vi.advanceTimersByTime(5100)
      expect(conflicts.value[0].remoteValue).toBe('95%')
    })
  })
})
