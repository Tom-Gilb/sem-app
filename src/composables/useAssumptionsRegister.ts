// UNIT_TYPE=Composable
// Feature #87 — Spec "assumptions register"
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface Assumption {
  id: string
  source: string
  text: string
  risk: 'H' | 'M' | 'L'
  validation: string
}

const ASSUMPTION_TRIGGERS = [
  'assuming',
  'assumes',
  'expected to',
  'will be',
  'should be',
  'typically',
  'usually',
  'as long as',
  'provided that',
  'given that',
  'once',
  'after',
  'when available',
  'if needed',
  'pending',
]

const EXTERNAL_SYSTEM_SIGNALS = [
  'api',
  'service',
  'database',
  'system',
  'platform',
  'infrastructure',
  'cloud',
  'network',
  'third-party',
  'external',
  'integration',
]

const PROCESS_SIGNALS = [
  'team',
  'stakeholder',
  'process',
  'approval',
  'review',
  'sign',
  'owner',
  'responsible',
  'workflow',
  'meeting',
]

/** Extract the sentence containing a trigger from a text */
function extractSentence(text: string, triggerIndex: number): string {
  const start = Math.max(0, text.lastIndexOf('.', triggerIndex - 1) + 1)
  const end = text.indexOf('.', triggerIndex)
  return end === -1
    ? text.slice(start).trim()
    : text.slice(start, end + 1).trim()
}

function computeRisk(sentence: string): 'H' | 'M' | 'L' {
  const lower = sentence.toLowerCase()
  if (EXTERNAL_SYSTEM_SIGNALS.some(sig => lower.includes(sig))) return 'H'
  if (PROCESS_SIGNALS.some(sig => lower.includes(sig))) return 'M'
  return 'L'
}

function computeValidation(source: string, risk: 'H' | 'M' | 'L', text: string): string {
  const shortText = text.slice(0, 40).replace(/\.$/, '')
  switch (risk) {
    case 'H': return `Verify with integration team: confirm ${shortText}…`
    case 'M': return `Workshop validation: confirm ${shortText}… with stakeholders`
    default: return `Desk check: confirm ${shortText}…`
  }
}

const SYNTHETIC_ASSUMPTION: Assumption = {
  id: 'A1',
  source: 'general',
  text: 'Stakeholders agree on the measurement methodology',
  risk: 'M',
  validation: 'Workshop validation: confirm measurement approach with all key stakeholders',
}

export function useAssumptionsRegister(spec: Ref<SpecBlock | null>) {
  const assumptionsOpen = ref(false)
  const assumptions = ref<Assumption[]>([])

  function extractAssumptions(): void {
    if (!spec.value) {
      assumptions.value = [{ ...SYNTHETIC_ASSUMPTION }]
      return
    }

    const found: Assumption[] = []
    const allEntries = [
      ...spec.value.functions.map(f => ({ id: f.id, text: f.description })),
      ...spec.value.values.map(v => ({ id: v.id, text: `${v.description} ${v.scale}` })),
      ...spec.value.solutions.map(s => ({ id: s.id, text: s.description })),
    ]

    let counter = 1

    for (const entry of allEntries) {
      const lower = entry.text.toLowerCase()
      for (const trigger of ASSUMPTION_TRIGGERS) {
        const idx = lower.indexOf(trigger)
        if (idx !== -1) {
          const sentence = extractSentence(entry.text, idx)
          if (sentence.length > 0) {
            const risk = computeRisk(sentence)
            found.push({
              id: `A${counter}`,
              source: entry.id,
              text: sentence,
              risk,
              validation: computeValidation(entry.id, risk, sentence),
            })
            counter++
          }
          break // one trigger match per entry to avoid duplicates
        }
      }
    }

    if (found.length === 0) {
      found.push({ ...SYNTHETIC_ASSUMPTION })
    }

    assumptions.value = found
  }

  function copyRegister(): void {
    if (assumptions.value.length === 0) return
    const header = '| ID | Source | Assumption | Risk | Validation |'
    const divider = '| --- | --- | --- | --- | --- |'
    const rows = assumptions.value.map(a =>
      `| ${a.id} | ${a.source} | ${a.text} | ${a.risk} | ${a.validation} |`
    )
    const text = [header, divider, ...rows].join('\n')
    navigator.clipboard.writeText(text).catch(() => { /* ignore */ })
  }

  return { assumptionsOpen, assumptions, extractAssumptions, copyRegister }
}
