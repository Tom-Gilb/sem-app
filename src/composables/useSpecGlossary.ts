// UNIT_TYPE=Composable
// Feature #61 — Spec glossary auto-builder
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface GlossaryEntry {
  term: string
  definition: string
  usedIn: string[]   // entry IDs where this term appears
  type: 'acronym' | 'domain-term' | 'metric'
}

// Common non-domain words to exclude
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'this', 'that', 'these', 'those', 'it', 'its', 'will', 'should', 'must',
  'each', 'all', 'any', 'per', 'via', 'vs', 'etc', 'eg', 'ie',
])

function classifyTerm(term: string): 'acronym' | 'domain-term' | 'metric' {
  if (/^[A-Z]{2,}$/.test(term)) return 'acronym'
  if (/\d/.test(term) || /%|ms|px|usd|\$/.test(term.toLowerCase())) return 'metric'
  return 'domain-term'
}

function generateDefinition(term: string, type: 'acronym' | 'domain-term' | 'metric', context: string): string {
  if (type === 'acronym') {
    const acronyms: Record<string, string> = {
      'API': 'Application Programming Interface — a contract for software communication',
      'UI': 'User Interface — the visual layer users interact with',
      'UX': 'User Experience — the overall quality of a user\'s interaction',
      'SLA': 'Service Level Agreement — a contractual performance commitment',
      'KPI': 'Key Performance Indicator — a measurable value tracking goal progress',
      'NPS': 'Net Promoter Score — a measure of customer loyalty (-100 to +100)',
      'MRR': 'Monthly Recurring Revenue — predictable monthly income',
      'ARR': 'Annual Recurring Revenue — annualised predictable income',
      'MVP': 'Minimum Viable Product — smallest shippable version',
      'ROI': 'Return on Investment — benefit relative to cost',
    }
    return acronyms[term] ?? `${term} — acronym used in this specification`
  }
  if (type === 'metric') {
    return `${term} — a measurable quantity tracked in this specification`
  }
  // Domain term: generate from context
  const words = context.split(/\s+/).slice(0, 8).join(' ')
  return `${term} — domain concept referenced in the context of: "${words.slice(0, 60)}…"`
}

export function useSpecGlossary(_apiKey?: string) {
  const glossary = ref<GlossaryEntry[]>([])
  const loading = ref(false)
  const copied = ref(false)

  function extractTerms(spec: SpecBlock): void {
    const termMap = new Map<string, { usedIn: string[]; contexts: string[] }>()
    const allEntries = [
      ...spec.functions.map(f => ({ id: f.id, text: f.description })),
      ...spec.values.map(v => ({ id: v.id, text: `${v.description} ${v.scale ?? ''} ${v.goal ?? ''}` })),
      ...spec.solutions.map(s => ({ id: s.id, text: s.description })),
    ]

    for (const entry of allEntries) {
      // Extract acronyms (2+ uppercase letters)
      const acronyms = entry.text.match(/\b[A-Z]{2,}\b/g) ?? []
      // Extract capitalised domain terms (not at sentence start)
      const capTerms = entry.text.match(/(?<![.!?]\s)(?<!\n)\b[A-Z][a-z]{2,}\b/g) ?? []
      // Extract hyphenated terms
      const hyphenated = entry.text.match(/\b[a-zA-Z]+-[a-zA-Z]+\b/g) ?? []

      const allTerms = [...new Set([...acronyms, ...capTerms, ...hyphenated])]
      for (const term of allTerms) {
        if (STOP_WORDS.has(term.toLowerCase())) continue
        if (term.length < 3) continue
        const existing = termMap.get(term) ?? { usedIn: [], contexts: [] }
        if (!existing.usedIn.includes(entry.id)) existing.usedIn.push(entry.id)
        existing.contexts.push(entry.text)
        termMap.set(term, existing)
      }
    }

    glossary.value = Array.from(termMap.entries())
      .filter(([, v]) => v.usedIn.length >= 1)
      .slice(0, 20)  // cap at 20 for readability
      .map(([term, data]) => {
        const type = classifyTerm(term)
        return {
          term,
          type,
          usedIn: data.usedIn,
          definition: generateDefinition(term, type, data.contexts[0] ?? ''),
        }
      })
      .sort((a, b) => a.term.localeCompare(b.term))
  }

  function toMarkdown(): string {
    const lines = [
      '# Spec Glossary',
      '',
      ...glossary.value.map(e => `**${e.term}** — ${e.definition} *(used in: ${e.usedIn.join(', ')})*`),
    ]
    return lines.join('\n\n')
  }

  async function copyGlossary(): Promise<void> {
    try {
      await navigator.clipboard.writeText(toMarkdown())
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch { /* ignore */ }
  }

  return { glossary, loading, copied, extractTerms, copyGlossary, toMarkdown }
}
