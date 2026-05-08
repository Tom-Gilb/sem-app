// UNIT_TYPE=Composable
// Feature #138 — Evo step blocker log
import { ref } from 'vue'

export type BlockerSeverity = 'P1' | 'P2' | 'P3'

export interface Blocker {
  id: string          // Date.now().toString() + random suffix
  description: string
  severity: BlockerSeverity
  resolved: boolean
  resolvedDate: string | null  // ISO date or null
  addedAt: string     // ISO date
}

export interface StepBlockerLog {
  stepId: string
  blockers: Blocker[]
  open: boolean
  activeCount: number    // blockers where resolved === false
  resolvedCount: number  // blockers where resolved === true
}

function recount(log: StepBlockerLog): void {
  log.activeCount = log.blockers.filter(b => !b.resolved).length
  log.resolvedCount = log.blockers.filter(b => b.resolved).length
}

export function useBlockerLog() {
  const blockerMap = ref<Record<string, StepBlockerLog>>({})

  function initStep(stepId: string): void {
    if (!blockerMap.value[stepId]) {
      blockerMap.value[stepId] = {
        stepId,
        blockers: [],
        open: false,
        activeCount: 0,
        resolvedCount: 0,
      }
    }
  }

  function addBlocker(stepId: string, description: string, severity: BlockerSeverity): void {
    initStep(stepId)
    const log = blockerMap.value[stepId]
    const blocker: Blocker = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
      description,
      severity,
      resolved: false,
      resolvedDate: null,
      addedAt: new Date().toISOString(),
    }
    log.blockers.push(blocker)
    recount(log)
  }

  function resolveBlocker(stepId: string, blockerId: string): void {
    const log = blockerMap.value[stepId]
    if (!log) return
    const blocker = log.blockers.find(b => b.id === blockerId)
    if (!blocker) return
    blocker.resolved = true
    blocker.resolvedDate = new Date().toISOString().slice(0, 10)
    recount(log)
  }

  function removeBlocker(stepId: string, blockerId: string): void {
    const log = blockerMap.value[stepId]
    if (!log) return
    log.blockers = log.blockers.filter(b => b.id !== blockerId)
    recount(log)
  }

  function toggleOpen(stepId: string): void {
    const log = blockerMap.value[stepId]
    if (!log) return
    log.open = !log.open
  }

  function copyLog(stepId: string): void {
    const log = blockerMap.value[stepId]
    if (!log) return

    const lines: string[] = [
      `## Blocker Log — ${stepId}`,
      `Active: ${log.activeCount} | Resolved: ${log.resolvedCount}`,
      '',
    ]

    for (const b of log.blockers) {
      const status = b.resolved ? `RESOLVED: ${b.resolvedDate}` : 'OPEN'
      const addedDate = b.addedAt.slice(0, 10)
      lines.push(`[${b.severity}] ${b.description} — ${addedDate} ${status}`)
    }

    const text = lines.join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { blockerMap, initStep, addBlocker, resolveBlocker, removeBlocker, toggleOpen, copyLog }
}
