// UNIT_TYPE=Composable
// Feature #116 — Evo step Definition of Ready composable
import { ref } from 'vue'

export interface ReadyItem {
  id: string
  label: string
  checked: boolean
}

export interface StepReadiness {
  stepId: string
  items: ReadyItem[]
  open: boolean
  ready: boolean
  blockedCount: number
}

const DEFAULT_ITEMS: Array<{ id: string; label: string }> = [
  { id: 'acceptance-criteria', label: 'Acceptance criteria defined' },
  { id: 'dependencies', label: 'Dependencies unblocked' },
  { id: 'resources', label: 'Resources assigned' },
  { id: 'design', label: 'Design approved' },
  { id: 'tests', label: 'Tests scoped' },
]

function computeReady(items: ReadyItem[]): boolean {
  return items.length > 0 && items.every(item => item.checked)
}

function computeBlockedCount(items: ReadyItem[]): number {
  return items.filter(item => !item.checked).length
}

export function useStepReady() {
  const readyMap = ref<Record<string, StepReadiness>>({})

  function initStep(stepId: string): void {
    if (readyMap.value[stepId]) return
    const items: ReadyItem[] = DEFAULT_ITEMS.map(def => ({
      id: def.id,
      label: def.label,
      checked: false,
    }))
    readyMap.value[stepId] = {
      stepId,
      items,
      open: false,
      ready: false,
      blockedCount: items.length,
    }
  }

  function toggleItem(stepId: string, itemId: string): void {
    const state = readyMap.value[stepId]
    if (!state) return
    const item = state.items.find(i => i.id === itemId)
    if (!item) return
    item.checked = !item.checked
    state.ready = computeReady(state.items)
    state.blockedCount = computeBlockedCount(state.items)
  }

  function toggleOpen(stepId: string): void {
    const state = readyMap.value[stepId]
    if (!state) return
    state.open = !state.open
  }

  function isReady(stepId: string): boolean {
    const state = readyMap.value[stepId]
    if (!state) return false
    return computeReady(state.items)
  }

  function copyReadiness(stepId: string): void {
    const state = readyMap.value[stepId]
    if (!state) return

    const lines = state.items.map(item =>
      `${item.checked ? '- [x]' : '- [ ]'} ${item.label}`,
    )

    const statusLine = state.ready
      ? 'Status: Ready ✅'
      : `Status: Not Ready ⛔ (${state.blockedCount} items blocking)`

    const markdown = `## Definition of Ready — ${stepId}\n${lines.join('\n')}\n${statusLine}`

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }
  }

  return { readyMap, initStep, toggleItem, toggleOpen, isReady, copyReadiness }
}
