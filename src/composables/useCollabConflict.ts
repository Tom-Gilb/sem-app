// UNIT_TYPE=Composable
// Feature #51 — Spec collaboration conflict detector
import { ref, watch, type Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface SpecConflict {
  entryId: string
  field: 'goal' | 'scale' | 'tolerable' | 'description'
  localValue: string
  remoteValue: string
  remoteUser: string
}

export function useCollabConflict(
  localSpec: Ref<SpecBlock | null>,
  activeUserCount: Ref<number>,
  apiKey?: string
) {
  const conflicts = ref<SpecConflict[]>([])
  const isMonitoring = ref(false)
  let mockTimer: ReturnType<typeof setTimeout> | null = null

  function clearConflicts(): void {
    conflicts.value = []
  }

  function injectMockConflict(spec: SpecBlock): void {
    // Simulate a remote user changing a Goal value
    const firstV = spec.values[0]
    if (!firstV) return
    const fakeGoal = firstV.goal
      ? firstV.goal.replace(/\d+/, n => String(Number(n) + 10))
      : '95%'
    conflicts.value = [{
      entryId: firstV.id,
      field: 'goal',
      localValue: firstV.goal ?? '(none)',
      remoteValue: fakeGoal,
      remoteUser: 'alex@example.com',
    }]
  }

  function startMonitoring(): void {
    if (isMonitoring.value) return
    isMonitoring.value = true

    if (!apiKey || import.meta.env.VITE_MOCK_MODE === 'true') {
      // Mock mode: inject a conflict after 5s if ≥2 users active
      mockTimer = setTimeout(() => {
        if (activeUserCount.value >= 2 && localSpec.value) {
          injectMockConflict(localSpec.value)
        }
      }, 5000)
    }
    // Live mode: In real Supabase setup, this would broadcast spec snapshots
    // via the existing Realtime Presence channel and compare V. entry fields.
    // That wiring lives in useCollaborationCursors and is deferred to live integration.
  }

  function stopMonitoring(): void {
    if (mockTimer) clearTimeout(mockTimer)
    isMonitoring.value = false
    conflicts.value = []
  }

  // Auto-start when ≥2 users active, auto-stop when alone
  watch(activeUserCount, count => {
    if (count >= 2) startMonitoring()
    else stopMonitoring()
  }, { immediate: true })

  return { conflicts, isMonitoring, clearConflicts, startMonitoring, stopMonitoring }
}
