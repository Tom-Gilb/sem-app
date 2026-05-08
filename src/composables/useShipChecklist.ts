// UNIT_TYPE=Composable
// Feature #62 — "Before we ship" checklist
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface ChecklistItem {
  entryId: string
  description: string
  goal: string
  status: string
  checkStatus: CheckStatus
  notes: string
}

function parseNumber(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

function evaluateStatus(goal: string | undefined, status: string | undefined): CheckStatus {
  if (!goal) return 'unknown'
  if (!status || status.trim() === '') return 'fail'

  const goalNum = parseNumber(goal)
  const statusNum = parseNumber(status)

  if (goalNum !== null && statusNum !== null) {
    // Numeric comparison — check direction hint from goal string
    const isLowerBetter = /< |≤ |max |under |below /.test(goal.toLowerCase())
    if (isLowerBetter) {
      return statusNum <= goalNum ? 'pass' : statusNum <= goalNum * 1.2 ? 'warn' : 'fail'
    } else {
      return statusNum >= goalNum ? 'pass' : statusNum >= goalNum * 0.8 ? 'warn' : 'fail'
    }
  }

  // Text comparison: if status mentions goal keywords, treat as pass
  const goalWords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const statusLower = status.toLowerCase()
  const matchCount = goalWords.filter(w => statusLower.includes(w)).length
  if (matchCount >= 2) return 'pass'
  if (matchCount === 1) return 'warn'
  return status.length > 0 ? 'warn' : 'fail'
}

export function useShipChecklist() {
  const checklist = ref<ChecklistItem[]>([])
  const overallStatus = ref<'ready' | 'caution' | 'not-ready'>('not-ready')
  const copied = ref(false)

  function generateChecklist(spec: SpecBlock): void {
    const items: ChecklistItem[] = spec.values.map(v => {
      const cs = evaluateStatus(v.goal, v.status)
      return {
        entryId: v.id,
        description: v.description,
        goal: v.goal ?? '(not set)',
        status: v.status ?? '(not measured)',
        checkStatus: cs,
        notes: cs === 'pass' ? 'Goal reached ✅' :
               cs === 'warn' ? 'Getting close — check and confirm' :
               cs === 'fail' ? 'Not yet at Goal level' :
               'No Goal defined',
      }
    })

    checklist.value = items

    const passes = items.filter(i => i.checkStatus === 'pass').length
    const fails = items.filter(i => i.checkStatus === 'fail').length
    if (passes === items.length && items.length > 0) overallStatus.value = 'ready'
    else if (fails > passes) overallStatus.value = 'not-ready'
    else overallStatus.value = 'caution'
  }

  function toMarkdown(): string {
    const statusEmoji = { pass: '✅', warn: '⚠️', fail: '❌', unknown: '❓' }
    const lines = [
      '# Ship Checklist',
      '',
      `Overall: ${overallStatus.value === 'ready' ? '🚀 Ready to ship!' : overallStatus.value === 'caution' ? '⚠️ Caution' : '🛑 Not ready'}`,
      '',
      ...checklist.value.map(item =>
        `${statusEmoji[item.checkStatus]} **${item.entryId}** — Goal: ${item.goal} | Status: ${item.status}`
      ),
    ]
    return lines.join('\n')
  }

  async function copyChecklist(): Promise<void> {
    try {
      await navigator.clipboard.writeText(toMarkdown())
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch { /* ignore */ }
  }

  return { checklist, overallStatus, copied, generateChecklist, copyChecklist }
}
