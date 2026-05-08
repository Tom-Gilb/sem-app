// UNIT_TYPE=Composable
// Feature #108 — Spec "decision log"
import { ref } from 'vue'

export interface Decision {
  id: string
  what: string       // what was decided
  why: string        // rationale
  who: string        // who made the decision
  when: string       // ISO date string (input as date)
  specContext: string // derived from current spec domain + entry count
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString()
}

export function useDecisionLog() {
  const decisionsOpen = ref(false)
  const decisions = ref<Decision[]>([]) // in-memory only
  const newWhat = ref('')
  const newWhy = ref('')
  const newWho = ref('')
  const newWhen = ref(new Date().toISOString().split('T')[0]) // today's date

  function addDecision(specContext: string): void {
    if (!newWhat.value.trim()) return

    decisions.value.unshift({
      id: generateId(),
      what: newWhat.value.trim(),
      why: newWhy.value.trim(),
      who: newWho.value.trim(),
      when: newWhen.value,
      specContext,
    })

    newWhat.value = ''
    newWhy.value = ''
    newWho.value = ''
    // Keep newWhen as-is
  }

  function removeDecision(id: string): void {
    decisions.value = decisions.value.filter(d => d.id !== id)
  }

  function copyLog(): void {
    const header = '## Decision Log\n\n| When | What | Why | Who |'
    const separator = '|---|---|---|---|'
    const rows = decisions.value
      .map(d => `| ${d.when} | ${d.what} | ${d.why} | ${d.who} |`)
      .join('\n')
    const md = `${header}\n${separator}\n${rows}`
    navigator.clipboard.writeText(md).catch(() => {/* no-op */})
  }

  return {
    decisionsOpen,
    decisions,
    newWhat,
    newWhy,
    newWho,
    newWhen,
    addDecision,
    removeDecision,
    copyLog,
  }
}
